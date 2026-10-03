"""Packet Tracer XML 解析模块

解析解压后的 XML，提取：
- 设备列表（类型/名称/坐标/型号）
- 链路列表（设备间连接/接口/线缆类型）
- 设备配置（startup-config 纯文本）
- 接口表（IP/掩码/状态/速率/双工/连接对端）
- VLAN 信息
- ACL 规则
- 路由表（从配置推算：静态路由 + 直连路由）

PT 的 XML schema 没有官方文档，结构随版本变化。
本模块兼容 PT 5.x / 6.x / 7.x / 8.x 的主要节点命名。
"""

import ipaddress
import re
import xml.etree.ElementTree as ET
from typing import Any


# ============== 设备类型识别 ==============

# PT 中设备类型的识别映射（不区分大小写）
DEVICE_TYPE_MAP = {
    'router': 'router',
    'Router-PT': 'router',
    '2811': 'router',
    '2901': 'router',
    '2911': 'router',
    '1841': 'router',
    '829': 'router',
    '819': 'router',
    'switch': 'switch',
    'Switch-PT': 'switch',
    '2960': 'switch',
    '2950': 'switch',
    '3560': 'switch',
    '3650': 'switch',
    'pc': 'pc',
    'PC-PT': 'pc',
    'PC': 'pc',
    'server': 'server',
    'Server-PT': 'server',
    'Server': 'server',
    'laptop': 'laptop',
    'Laptop-PT': 'laptop',
    'firewall': 'firewall',
    'ASA': 'firewall',
    'ASA-5505': 'firewall',
    'PIX': 'firewall',
    'phone': 'phone',
    'IP-Phone': 'phone',
    '7960': 'phone',
    'wireless': 'wireless',
    'Access-Point': 'access-point',
    'Access-Point-PT': 'access-point',
    'AP': 'access-point',
    'cloud': 'cloud',
    'Cloud-PT': 'cloud',
    'WAN-Emulator': 'cloud',
    'hub': 'hub',
    'Hub-PT': 'hub',
    'tv': 'tv',
    'TV-PT': 'tv',
    'tablet': 'tablet',
    'Tablet-PT': 'tablet',
}


def _normalize_device_type(raw_type: str) -> str:
    """规范化设备类型"""
    if not raw_type:
        return 'unknown'
    # 精确匹配
    if raw_type in DEVICE_TYPE_MAP:
        return DEVICE_TYPE_MAP[raw_type]
    # 模糊匹配（包含关键词）
    lower = raw_type.lower()
    for keyword, normalized in DEVICE_TYPE_MAP.items():
        if keyword.lower() in lower:
            return normalized
    return 'unknown'


# ============== 线缆类型识别 ==============

CABLE_TYPE_MAP = {
    'Straight': 'straight',
    'Copper-Straight': 'straight',
    'eStraight': 'straight',
    'eCopperStraight': 'straight',
    'Cross-Over': 'crossover',
    'Copper-Cross-Over': 'crossover',
    'eCrossOver': 'crossover',
    'eCopperCrossOver': 'crossover',
    'eCopper': 'copper',
    'Fiber': 'fiber',
    'Fiber-Straight': 'fiber',
    'eFiber': 'fiber',
    'Serial': 'serial',
    'Serial-DCE': 'serial-dce',
    'Serial-DTE': 'serial-dte',
    'eSerial': 'serial',
    'eSerialDCE': 'serial-dce',
    'eSerialDTE': 'serial-dte',
    'Console': 'console',
    'eConsole': 'console',
    'Coaxial': 'coaxial',
    'eCoaxial': 'coaxial',
    'Wireless': 'wireless',
    'eWireless': 'wireless',
}


def _normalize_cable_type(raw_type: str) -> str:
    """规范化线缆类型"""
    if not raw_type:
        return 'unknown'
    if raw_type in CABLE_TYPE_MAP:
        return CABLE_TYPE_MAP[raw_type]
    lower = raw_type.lower()
    for keyword, normalized in CABLE_TYPE_MAP.items():
        if keyword.lower() in lower:
            return normalized
    return 'unknown'


# ============== PORT 结构化字段识别 ==============

# PT 中 PORT TYPE 到接口名前缀的映射
PORT_TYPE_PREFIX = {
    'eCopperFastEthernet': 'FastEthernet',
    'eCopperGigabitEthernet': 'GigabitEthernet',
    'eFiber': 'Fiber',
    'eSerial': 'Serial',
    'eConsole': 'Console',
    'eWireless': 'Wireless',
}


def _iter_port_nodes(engine_node: ET.Element) -> list:
    """递归遍历 ENGINE 下 MODULE 子树中的所有 PORT 节点

    PC/路由器的网络端口位于 ENGINE/MODULE/SLOT/MODULE/PORT 结构中，
    而 BLUETOOTH_PORT 等非网络端口直接挂载在 ENGINE 下，需要排除。
    """
    if engine_node is None:
        return []
    ports = []
    # 仅在 MODULE 子树中查找 PORT，排除 BLUETOOTH_PORT 等
    for module in engine_node.findall('MODULE'):
        ports.extend(module.findall('.//PORT'))
    return ports


def _classful_mask(ip: str) -> str:
    """根据 IP 主类推算默认掩码

    A 类(1-126) → 255.0.0.0
    B 类(128-191) → 255.255.0.0
    C 类(192-223) → 255.255.255.0
    """
    try:
        first = int(ip.split('.')[0])
        if 1 <= first <= 126:
            return '255.0.0.0'
        elif 128 <= first <= 191:
            return '255.255.0.0'
        elif 192 <= first <= 223:
            return '255.255.255.0'
        return '255.255.255.0'
    except (ValueError, IndexError):
        return '255.255.255.0'


# ============== 设备解析 ==============

def _find_devices(root: ET.Element) -> list:
    """查找所有设备节点

    PT XML 中设备可能在以下路径：
    - NETWORK/DEVICES/DEVICE
    - NETWORK/DEVICES/DEVICE_LIST/DEVICE
    - .//DEVICE（任意深度）
    """
    devices = []

    # 尝试多种路径
    device_nodes = root.findall('.//DEVICE')
    if not device_nodes:
        # 尝试小写标签
        device_nodes = root.findall('.//device')

    for node in device_nodes:
        device = _parse_device_node(node)
        if device:
            devices.append(device)

    return devices


def _get_text(node: ET.Element, path: str) -> str:
    """安全获取子节点文本内容

    支持多种路径尝试，按优先级返回第一个非空值
    """
    if node is None:
        return ''
    paths = path.split('|')
    for p in paths:
        child = node.find(p.strip())
        if child is not None and child.text:
            return child.text.strip()
    return ''


def _get_attr_or_text(node: ET.Element, attr_names: str, text_paths: str = '') -> str:
    """优先从属性获取，其次从子节点文本获取

    attr_names: 多个属性名用 | 分隔
    text_paths: 多个子节点路径用 | 分隔
    """
    if node is None:
        return ''
    # 尝试属性
    for attr in attr_names.split('|'):
        val = node.get(attr.strip())
        if val:
            return val.strip()
    # 尝试子节点文本
    if text_paths:
        return _get_text(node, text_paths)
    return ''


def _parse_device_node(node: ET.Element) -> dict:
    """解析单个设备节点

    兼容多种 PT 版本的结构：
    - 旧版：信息在 DEVICE 节点属性中
    - 新版（PT 7.x+）：信息在 DEVICE/ENGINE 子节点中
    """
    engine = node.find('ENGINE')
    data_node = engine if engine is not None else node

    # 设备名
    name = _get_attr_or_text(node, 'NAME|name|DisplayName', 'ENGINE/NAME|NAME')
    # 设备类型（文本内容，如 "Router"、"Switch"）
    raw_type = _get_attr_or_text(node, 'TYPE|type|DEVICE_TYPE', 'ENGINE/TYPE|TYPE')
    # 设备型号（TYPE 节点的 model 属性，如 "2811"、"2960"）
    model = ''
    type_node = data_node.find('TYPE')
    if type_node is not None:
        model = type_node.get('model', '') or type_node.get('Model', '') or ''
    if not model:
        model = _get_attr_or_text(node, 'MODEL|model', '')

    device_type = _normalize_device_type(raw_type or model)
    # 设备 ID（优先用 SAVE_REF_ID，兼容旧版 DBID）
    dev_id = _get_attr_or_text(node, 'DBID|id|ID', 'ENGINE/SAVE_REF_ID|SAVE_REF_ID')
    if not dev_id:
        dev_id = name

    # 坐标（优先级：WORKSPACE/LOGICAL/X,Y > COORD_SETTINGS > 属性）
    x = 0.0
    y = 0.0

    # 1. 优先使用 WORKSPACE/LOGICAL 中的坐标（逻辑视图位置，即用户画布上的位置）
    workspace = node.find('WORKSPACE')
    if workspace is not None:
        logical = workspace.find('LOGICAL')
        if logical is not None:
            logical_x = _get_text(logical, 'X|x')
            logical_y = _get_text(logical, 'Y|y')
            if logical_x:
                x = _parse_float(logical_x)
            if logical_y:
                y = _parse_float(logical_y)

    # 2. 其次使用 ENGINE/COORD_SETTINGS 中的坐标
    if x == 0.0 and y == 0.0:
        coord_node = data_node.find('COORD_SETTINGS')
        if coord_node is not None:
            coord_x = _get_text(coord_node, 'X_COORD|x')
            coord_y = _get_text(coord_node, 'Y_COORD|y')
            if coord_x:
                x = _parse_float(coord_x)
            if coord_y:
                y = _parse_float(coord_y)

    # 3. 最后尝试从属性获取（旧版格式）
    if x == 0.0 and y == 0.0:
        x = _parse_float(_get_attr_or_text(node, 'POSITION_X|X|x', ''))
        y = _parse_float(_get_attr_or_text(node, 'POSITION_Y|Y|y', ''))

    if not name and not raw_type and not model:
        return None

    return {
        'id': str(dev_id),
        'name': name,
        'type': device_type,
        'rawType': raw_type,
        'model': model,
        'x': x,
        'y': y,
    }


def _parse_float(val: str, default: float = 0.0) -> float:
    """安全解析浮点数"""
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


# ============== 链路解析 ==============

def _find_links(root: ET.Element) -> list:
    """查找所有链路节点

    PT XML 中链路在 LINKS/LINK 下
    """
    links = []

    link_nodes = root.findall('.//LINK')
    if not link_nodes:
        link_nodes = root.findall('.//link')

    for node in link_nodes:
        link = _parse_link_node(node)
        if link:
            links.append(link)

    return links


def _parse_link_node(node: ET.Element) -> dict:
    """解析单个链路节点

    兼容多种 PT 版本的结构：
    - 旧版：信息在 LINK 节点属性中，或 FROM/TO 子节点属性中
    - 新版 PT 7.x+：信息在 LINK/CABLE 子节点中
      - CABLE/FROM: 源设备 ID（save-ref-id:...）
      - CABLE/TO: 目的设备 ID（save-ref-id:...）
      - CABLE/PORT: 两个 PORT 子节点，第一个是源接口，第二个是目的接口
      - CABLE/TYPE: 线缆具体类型（如 eCrossOver）
      - LINK/TYPE: 线缆大类（如 eCopper）
    """
    # 链路 ID
    link_id = _get_attr_or_text(node, 'DBID|id|ID', '')

    # 线缆类型
    cable_raw = ''
    # 先尝试属性
    cable_raw = node.get('CABLE_TYPE') or node.get('cableType') or node.get('TYPE') or ''

    # 尝试从 CABLE 子节点获取（新版结构）
    cable_node = node.find('CABLE')
    if cable_node is not None:
        # CABLE 中的 TYPE 是更具体的类型（如 eCrossOver）
        cable_type_inner = _get_text(cable_node, 'TYPE')
        if cable_type_inner:
            cable_raw = cable_type_inner
    if not cable_raw:
        # LINK 层面的 TYPE 是大类（如 eCopper）
        cable_raw = _get_text(node, 'TYPE')

    cable_type = _normalize_cable_type(cable_raw)

    # 两端设备 ID 和接口
    src_dev = ''
    dst_dev = ''
    src_if = ''
    dst_if = ''

    # 先尝试从属性获取（旧版）
    src_dev = node.get('SRC_DEVICE') or node.get('srcDevice') or node.get('FROM') or ''
    dst_dev = node.get('DST_DEVICE') or node.get('dstDevice') or node.get('TO') or ''
    src_if = node.get('SRC_PORT') or node.get('srcPort') or node.get('SRC_INTERFACE') or ''
    dst_if = node.get('DST_PORT') or node.get('dstPort') or node.get('DST_INTERFACE') or ''

    # 尝试从直接子节点解析（旧版的 FROM/TO 子节点）
    if not src_dev or not dst_dev:
        for child in node:
            tag = child.tag.upper()
            if tag in ('FROM', 'SRC', 'SOURCE', 'ENDPOINT1'):
                src_dev = src_dev or child.get('DEVICE') or child.get('device') or (child.text or '').strip() or ''
                src_if = src_if or child.get('PORT') or child.get('port') or child.get('INTERFACE') or ''
            elif tag in ('TO', 'DST', 'DEST', 'ENDPOINT2'):
                dst_dev = dst_dev or child.get('DEVICE') or child.get('device') or (child.text or '').strip() or ''
                dst_if = dst_if or child.get('PORT') or child.get('port') or child.get('INTERFACE') or ''

    # 尝试从 CABLE 子节点解析（新版 PT 7.x+ 结构）
    if cable_node is not None and (not src_dev or not dst_dev or not src_if or not dst_if):
        # 从 CABLE/FROM 和 CABLE/TO 获取设备 ID
        from_text = _get_text(cable_node, 'FROM')
        to_text = _get_text(cable_node, 'TO')
        if from_text:
            src_dev = src_dev or from_text
        if to_text:
            dst_dev = dst_dev or to_text

        # 从 CABLE/PORT 节点获取接口名
        # 注意：CABLE 下通常有两个 PORT 子节点，第一个是源端，第二个是目的端
        port_nodes = cable_node.findall('PORT')
        if len(port_nodes) >= 2:
            if not src_if and port_nodes[0].text:
                src_if = port_nodes[0].text.strip()
            if not dst_if and port_nodes[1].text:
                dst_if = port_nodes[1].text.strip()
        elif len(port_nodes) == 1:
            # 只有一个 PORT 的情况，尝试用其他方式区分
            if not src_if and port_nodes[0].text:
                src_if = port_nodes[0].text.strip()

    if not src_dev and not dst_dev:
        return None

    return {
        'id': str(link_id),
        'srcDevice': str(src_dev),
        'dstDevice': str(dst_dev),
        'srcInterface': str(src_if),
        'dstInterface': str(dst_if),
        'cableType': cable_type,
        'cableRawType': cable_raw,
    }


# ============== 配置解析 ==============

def _extract_config_from_device(device_node: ET.Element) -> str:
    """从设备节点中提取配置文本

    支持多种格式：
    1. 旧版：CONFIGURATION/IOS_CONFIG/CONFIG/RUNNING_CONFIG 等节点直接存文本
    2. 新版 PT 7.x+：ENGINE/RUNNINGCONFIG 下多个 LINE 子节点逐行存储
    3. 新版：ENGINE/STARTUPCONFIG（启动配置）
    """
    # 先尝试在 ENGINE 子节点中找（新版结构）
    engine = device_node.find('ENGINE')
    search_nodes = [engine] if engine is not None else []
    search_nodes.append(device_node)

    config_tags = [
        'RUNNINGCONFIG', 'RUNNING_CONFIG',
        'STARTUPCONFIG', 'STARTUP_CONFIG',
        'CONFIGURATION', 'IOS_CONFIG', 'CONFIG',
    ]

    for node in search_nodes:
        for tag in config_tags:
            config_node = node.find(tag)
            if config_node is None:
                continue

            # 情况1：节点有直接的文本内容
            if config_node.text and config_node.text.strip():
                return config_node.text.strip()

            # 情况2：节点下有多个 LINE 子节点（PT 7.x+ 格式）
            lines = []
            for line_node in config_node.findall('LINE'):
                if line_node.text is not None:
                    lines.append(line_node.text)
            if lines:
                return '\n'.join(lines)

    return ''


def _find_configs(root: ET.Element) -> list:
    """查找设备配置文本

    PT XML 中配置可能在多种位置，兼容不同版本：
    - 旧版：DEVICE/CONFIGURATION、DEVICE/IOS_CONFIG 等
    - 新版 PT 7.x+：DEVICE/ENGINE/RUNNINGCONFIG/LINE[]
    """
    configs = []

    # 查找所有设备节点（大小写都试）
    device_nodes = root.findall('.//DEVICE')
    if not device_nodes:
        device_nodes = root.findall('.//device')

    for device_node in device_nodes:
        # 用与 _parse_device_node 相同的方式获取设备 ID 和名称
        engine = device_node.find('ENGINE')
        data_node = engine if engine is not None else device_node

        dev_name = _get_attr_or_text(device_node, 'NAME|name|DisplayName', 'ENGINE/NAME|NAME')
        dev_id = _get_attr_or_text(device_node, 'DBID|id|ID', 'ENGINE/SAVE_REF_ID|SAVE_REF_ID')
        if not dev_id:
            dev_id = dev_name

        config_text = _extract_config_from_device(device_node)

        if config_text:
            configs.append({
                'deviceId': str(dev_id),
                'deviceName': dev_name,
                'config': config_text,
            })

    return configs


# ============== 接口表解析（从配置推算） ==============

# 接口名匹配正则
INTERFACE_PATTERN = re.compile(
    r'^interface\s+('
    r'(?:GigabitEthernet|FastEthernet|Ethernet|Serial|Loopback|Tunnel|Vlan|Port-channel|'
    r'gi|fa|eth|se|lo|tu|vl|po)'
    r'\d+(?:\.\d+)?(?:/\d+)*(?:\.\d+)?'
    r')',
    re.MULTILINE
)

# IP 地址匹配
IP_PATTERN = re.compile(
    r'^\s*ip address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)',
    re.MULTILINE
)

# CIDR 格式 IP
IP_CIDR_PATTERN = re.compile(
    r'^\s*ip address\s+(\d+\.\d+\.\d+\.\d+/\d+)',
    re.MULTILINE
)

# 带宽
BANDWIDTH_PATTERN = re.compile(r'^\s*bandwidth\s+(\d+)', re.MULTILINE)

# 双工
DUPLEX_PATTERN = re.compile(r'^\s*duplex\s+(\w+)', re.MULTILINE)

# 速率
SPEED_PATTERN = re.compile(r'^\s*speed\s+(\w+)', re.MULTILINE)

# 接口描述
DESCRIPTION_PATTERN = re.compile(r'^\s*description\s+(.+)$', re.MULTILINE)

# shutdown 状态
SHUTDOWN_PATTERN = re.compile(r'^\s*shutdown\s*$', re.MULTILINE)


def parse_interfaces_from_config(config: str) -> list:
    """从 Cisco IOS 配置文本中解析接口表

    解析：接口名/IP/掩码/描述/带宽/双工/速率/shutdown 状态
    """
    if not config:
        return []

    interfaces = []

    # 按 interface 分块
    blocks = re.split(r'^interface\s+', config, flags=re.MULTILINE)

    for block in blocks[1:]:  # 跳过第一块（interface 之前的内容）
        lines = block.strip().split('\n')
        if_name = lines[0].strip()

        # 提取 IP 和掩码
        ip_match = IP_PATTERN.search(block)
        ip_cidr_match = IP_CIDR_PATTERN.search(block)
        ip = ''
        mask = ''
        if ip_match:
            ip = ip_match.group(1)
            mask = ip_match.group(2)
        elif ip_cidr_match:
            cidr = ip_cidr_match.group(1)
            ip = cidr.split('/')[0]
            mask = _cidr_to_mask(int(cidr.split('/')[1]))

        # 带宽
        bw_match = BANDWIDTH_PATTERN.search(block)
        bandwidth = int(bw_match.group(1)) if bw_match else None

        # 双工
        dup_match = DUPLEX_PATTERN.search(block)
        duplex = dup_match.group(1) if dup_match else ''

        # 速率
        spd_match = SPEED_PATTERN.search(block)
        speed = spd_match.group(1) if spd_match else ''

        # 描述
        desc_match = DESCRIPTION_PATTERN.search(block)
        description = desc_match.group(1).strip() if desc_match else ''

        # shutdown 状态
        is_shutdown = bool(SHUTDOWN_PATTERN.search(block))

        interfaces.append({
            'name': if_name,
            'ip': ip,
            'mask': mask,
            'cidr': _mask_to_cidr(mask) if mask else None,
            'description': description,
            'bandwidth': bandwidth,
            'duplex': duplex,
            'speed': speed,
            'shutdown': is_shutdown,
            'status': 'down' if is_shutdown else ('up' if ip else 'no-ip'),
            'mac': '',  # MAC 地址，由 PORT 结构补充
            'gateway': '',  # 网关，由 PORT 结构补充
            'dns': '',  # DNS，由 PORT 结构补充
            'dhcp': False,  # DHCP 是否启用，由 PORT 结构补充
        })

    return interfaces


def _cidr_to_mask(cidr: int) -> str:
    """CIDR 转子网掩码"""
    if not (0 <= cidr <= 32):
        return '0.0.0.0'
    mask = (0xFFFFFFFF << (32 - cidr)) & 0xFFFFFFFF
    return f'{(mask >> 24) & 0xFF}.{(mask >> 16) & 0xFF}.{(mask >> 8) & 0xFF}.{mask & 0xFF}'


def _mask_to_cidr(mask: str) -> int:
    """子网掩码转 CIDR"""
    try:
        parts = mask.split('.')
        if len(parts) != 4:
            return 0
        bits = 0
        for part in parts:
            bits += bin(int(part)).count('1')
        return bits
    except (ValueError, AttributeError):
        return 0


# ============== VLAN 解析 ==============

VLAN_PATTERN = re.compile(
    r'^vlan\s+(\d+)\s*\n\s*name\s+(.+)$',
    re.MULTILINE
)

VLAN_RANGE_PATTERN = re.compile(
    r'^vlan\s+(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)\s*$',
    re.MULTILINE
)


def parse_vlans_from_config(config: str) -> list:
    """从配置中解析 VLAN"""
    if not config:
        return []

    vlans = []

    # 匹配带名称的 VLAN
    for match in VLAN_PATTERN.finditer(config):
        vlan_id = match.group(1)
        name = match.group(2).strip()
        vlans.append({
            'id': vlan_id,
            'name': name,
        })

    # 匹配仅 ID 的 VLAN（如果还没被上面匹配）
    for match in VLAN_RANGE_PATTERN.finditer(config):
        vlan_range = match.group(1)
        for part in vlan_range.split(','):
            if '-' in part:
                start, end = part.split('-')
                for i in range(int(start), int(end) + 1):
                    if not any(v['id'] == str(i) for v in vlans):
                        vlans.append({'id': str(i), 'name': f'VLAN{i}'})
            else:
                if not any(v['id'] == part for v in vlans):
                    vlans.append({'id': part, 'name': f'VLAN{part}'})

    return vlans


# ============== ACL 解析 ==============

ACL_PATTERN = re.compile(
    r'^(ip access-list (?:standard|extended)\s+(\S+)\s*\n((?:\s+\S.*\n?)*))',
    re.MULTILINE
)

ACL_LEGACY_PATTERN = re.compile(
    r'^(access-list\s+(\d+)\s+(.+))$',
    re.MULTILINE
)


def parse_acls_from_config(config: str) -> list:
    """从配置中解析 ACL 规则"""
    if not config:
        return []

    acls = []

    # 新式 ACL（ip access-list）
    for match in ACL_PATTERN.finditer(config):
        full = match.group(1).strip()
        name = match.group(2)
        body = match.group(3).strip()
        rules = [line.strip() for line in body.split('\n') if line.strip()]
        acls.append({
            'name': name,
            'type': 'named',
            'rules': rules,
            'raw': full,
        })

    # 旧式 ACL（access-list N ...）
    for match in ACL_LEGACY_PATTERN.finditer(config):
        full = match.group(1).strip()
        num = match.group(2)
        body = match.group(3).strip()
        # 查找是否已有同编号的 ACL
        existing = next((a for a in acls if a['name'] == num), None)
        if existing:
            existing['rules'].append(body)
            existing['raw'] += '\n' + full
        else:
            acls.append({
                'name': num,
                'type': 'numbered',
                'rules': [body],
                'raw': full,
            })

    return acls


# ============== 路由表推算 ==============

# 静态路由
STATIC_ROUTE_PATTERN = re.compile(
    r'^ip route\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)\s+(\S+)(?:\s+(\d+))?',
    re.MULTILINE
)

# OSPF 路由
OSPF_NETWORK_PATTERN = re.compile(
    r'^router ospf\s+(\d+)\s*\n((?:\s+network\s+\S+\s+\S+\s+area\s+\S+\s*\n?)+)',
    re.MULTILINE
)

OSPF_NETWORK_DETAIL = re.compile(
    r'network\s+(\S+)\s+(\S+)\s+area\s+(\S+)'
)

# BGP 路由：匹配整个 router bgp 块（到下一个 ! 或 router/ip 命令为止）
BGP_BLOCK_PATTERN = re.compile(
    r'^router bgp\s+(\d+)\s*\n(.*?)(?=^!|^router\s|^ip\s|\Z)',
    re.MULTILINE | re.DOTALL
)

# BGP network 命令（mask 可选，无 mask 时按主类推算）
BGP_NETWORK_PATTERN = re.compile(
    r'^\s*network\s+(\d+\.\d+\.\d+\.\d+)(?:\s+mask\s+(\d+\.\d+\.\d+\.\d+))?',
    re.MULTILINE
)

# BGP neighbor 命令
BGP_NEIGHBOR_PATTERN = re.compile(
    r'^\s*neighbor\s+(\d+\.\d+\.\d+\.\d+)\s+remote-as\s+(\d+)',
    re.MULTILINE
)

# RIP 路由：匹配整个 router rip 块
RIP_BLOCK_PATTERN = re.compile(
    r'^router rip\s*\n(.*?)(?=^!|^router\s|^ip\s|\Z)',
    re.MULTILINE | re.DOTALL
)

# RIP network 命令（network 为主类网络地址）
RIP_NETWORK_PATTERN = re.compile(
    r'^\s*network\s+(\d+\.\d+\.\d+\.\d+)',
    re.MULTILINE
)


def parse_routes_from_config(config: str, interfaces: list) -> list:
    """从配置推算路由表

    包含：
    1. 直连路由（从接口 IP 推算）
    2. 静态路由（ip route 命令）
    3. OSPF 路由（router ospf + network 命令）
    4. BGP 路由（router bgp + network/neighbor 命令）
    5. RIP 路由（router rip + network 命令）
    """
    if not config:
        return []

    routes = []

    # 1. 直连路由（从接口推算）
    for iface in interfaces:
        if iface['ip'] and iface['mask'] and not iface['shutdown']:
            cidr = iface.get('cidr') or _mask_to_cidr(iface['mask'])
            network = _get_network_address(iface['ip'], iface['mask'])
            if network:
                routes.append({
                    'type': 'connected',
                    'network': network,
                    'mask': iface['mask'],
                    'cidr': cidr,
                    'nextHop': 'directly connected',
                    'interface': iface['name'],
                    'source': 'interface',
                })

    # 2. 静态路由（含默认路由特殊标记）
    for match in STATIC_ROUTE_PATTERN.finditer(config):
        network = match.group(1)
        mask = match.group(2)
        next_hop = match.group(3)
        metric = match.group(4)
        # 默认路由：0.0.0.0/0 特殊标记为 default
        is_default = (network == '0.0.0.0' and mask == '0.0.0.0')
        routes.append({
            'type': 'default' if is_default else 'static',
            'network': network,
            'mask': mask,
            'cidr': _mask_to_cidr(mask),
            'nextHop': next_hop,
            'metric': int(metric) if metric else 1,
            'interface': '',
            'source': 'ip route',
        })

    # 3. OSPF 路由
    for match in OSPF_NETWORK_PATTERN.finditer(config):
        process_id = match.group(1)
        networks_block = match.group(2)
        for net_match in OSPF_NETWORK_DETAIL.finditer(networks_block):
            network = net_match.group(1)
            wildcard = net_match.group(2)
            area = net_match.group(3)
            # 通配符转掩码
            mask = _wildcard_to_mask(wildcard)
            routes.append({
                'type': 'ospf',
                'network': network,
                'mask': mask,
                'cidr': _mask_to_cidr(mask),
                'nextHop': f'OSPF area {area}',
                'processId': process_id,
                'area': area,
                'interface': '',
                'source': 'router ospf',
            })

    # 4. BGP 路由
    for match in BGP_BLOCK_PATTERN.finditer(config):
        process_id = match.group(1)  # AS 号
        block = match.group(2)
        # 解析 neighbor 列表
        neighbors = []
        for nbr_match in BGP_NEIGHBOR_PATTERN.finditer(block):
            neighbors.append({
                'ip': nbr_match.group(1),
                'remoteAs': nbr_match.group(2),
            })
        # 解析 network 命令，每个 network 生成一条路由
        for net_match in BGP_NETWORK_PATTERN.finditer(block):
            network = net_match.group(1)
            mask = net_match.group(2)
            # 无 mask 时按主类推算
            if not mask:
                mask = _classful_mask(network)
            routes.append({
                'type': 'bgp',
                'network': network,
                'mask': mask,
                'cidr': _mask_to_cidr(mask),
                'nextHop': f'BGP AS {process_id}',
                'processId': process_id,
                'neighbors': neighbors,
                'interface': '',
                'source': 'bgp',
            })

    # 5. RIP 路由
    for match in RIP_BLOCK_PATTERN.finditer(config):
        block = match.group(1)
        for net_match in RIP_NETWORK_PATTERN.finditer(block):
            network = net_match.group(1)
            # RIP network 为主类网络，按主类推算掩码
            mask = _classful_mask(network)
            routes.append({
                'type': 'rip',
                'network': network,
                'mask': mask,
                'cidr': _mask_to_cidr(mask),
                'nextHop': 'RIP',
                'processId': 'rip',
                'interface': '',
                'source': 'rip',
            })

    return routes


def _get_network_address(ip: str, mask: str) -> str:
    """计算网络地址"""
    try:
        ip_parts = [int(x) for x in ip.split('.')]
        mask_parts = [int(x) for x in mask.split('.')]
        if len(ip_parts) != 4 or len(mask_parts) != 4:
            return ''
        network_parts = [ip_parts[i] & mask_parts[i] for i in range(4)]
        return '.'.join(str(x) for x in network_parts)
    except (ValueError, AttributeError):
        return ''


def _wildcard_to_mask(wildcard: str) -> str:
    """通配符掩码转子网掩码"""
    try:
        parts = [int(x) for x in wildcard.split('.')]
        if len(parts) != 4:
            return '0.0.0.0'
        mask_parts = [255 - x for x in parts]
        return '.'.join(str(x) for x in mask_parts)
    except (ValueError, AttributeError):
        return '0.0.0.0'


# ============== PORT 结构化字段解析（PC/路由器通用） ==============

def parse_pc_interfaces_from_port(device_node: ET.Element) -> list:
    """从 PORT 结构化字段解析 PC 接口

    PC 没有 RUNNINGCONFIG 节点，IP/SUBNET/GATEWAY/DNS 存于
    ENGINE/MODULE/SLOT/MODULE/PORT/ 结构化字段中。

    返回接口列表，格式与 parse_interfaces_from_config 一致，
    额外含 mac/gateway/dns/dhcp 字段。
    """
    engine = device_node.find('ENGINE')
    if engine is None:
        return []

    interfaces = []
    # 各接口名前缀的索引计数（如 FastEthernet 0/1/2...）
    type_counters = {}

    for port_node in _iter_port_nodes(engine):
        type_str = _get_text(port_node, 'TYPE') or ''
        # 跳过蓝牙等非以太网/串行端口
        if 'Bluetooth' in type_str or not type_str:
            continue

        # 推断接口名：优先 PORT NAME 属性，否则按 TYPE 前缀 + 索引
        prefix = PORT_TYPE_PREFIX.get(type_str, 'Ethernet')
        idx = type_counters.get(prefix, 0)
        type_counters[prefix] = idx + 1
        name = port_node.get('NAME') or port_node.get('name') or f'{prefix}{idx}'

        ip = _get_text(port_node, 'IP')
        mask = _get_text(port_node, 'SUBNET')
        mac = _get_text(port_node, 'MACADDRESS')
        gateway = _get_text(port_node, 'PORT_GATEWAY')
        dns = _get_text(port_node, 'PORT_DNS')
        dhcp_raw = _get_text(port_node, 'PORT_DHCP_ENABLE')
        duplex_raw = _get_text(port_node, 'FULLDUPLEX')
        bandwidth_raw = _get_text(port_node, 'BANDWIDTH')

        # DHCP 是否启用
        dhcp = dhcp_raw.lower() == 'true' if dhcp_raw else False

        # 双工转换
        if duplex_raw.lower() == 'true':
            duplex = 'full'
        elif duplex_raw.lower() == 'false':
            duplex = 'half'
        else:
            duplex = ''

        # 带宽转换
        bandwidth = None
        if bandwidth_raw:
            try:
                bandwidth = int(bandwidth_raw)
            except ValueError:
                pass

        # 掩码转 CIDR
        cidr = _mask_to_cidr(mask) if mask else None

        interfaces.append({
            'name': name,
            'ip': ip,
            'mask': mask,
            'cidr': cidr,
            'description': '',
            'bandwidth': bandwidth,
            'duplex': duplex,
            'speed': '',
            'shutdown': False,
            'status': 'up' if ip else 'no-ip',
            'mac': mac,
            'gateway': gateway,
            'dns': dns,
            'dhcp': dhcp,
        })

    return interfaces


def parse_ports_from_device(device_node: ET.Element) -> list:
    """递归提取设备所有 PORT 节点的结构化字段

    用于补充路由器等设备的 MAC 地址等缺失字段。
    返回列表，每项含 ip/mac/subnet/bandwidth/fullduplex。
    """
    engine = device_node.find('ENGINE')
    if engine is None:
        return []

    ports = []
    for port_node in _iter_port_nodes(engine):
        type_str = _get_text(port_node, 'TYPE') or ''
        if 'Bluetooth' in type_str:
            continue

        ip = _get_text(port_node, 'IP')
        mac = _get_text(port_node, 'MACADDRESS')
        subnet = _get_text(port_node, 'SUBNET')
        bandwidth_raw = _get_text(port_node, 'BANDWIDTH')
        fullduplex_raw = _get_text(port_node, 'FULLDUPLEX')

        bandwidth = None
        if bandwidth_raw:
            try:
                bandwidth = int(bandwidth_raw)
            except ValueError:
                pass

        ports.append({
            'ip': ip,
            'mac': mac,
            'subnet': subnet,
            'bandwidth': bandwidth,
            'fullduplex': fullduplex_raw.lower() == 'true' if fullduplex_raw else False,
        })

    return ports


def parse_device_gateway(device_node: ET.Element) -> tuple:
    """提取设备顶层 GATEWAY 和 DNS_CLIENT/SERVER_IP

    PC 设备的网关和 DNS 存于 ENGINE 顶层（非 PORT 内）。
    返回 (gateway, dns)。
    """
    engine = device_node.find('ENGINE')
    if engine is None:
        return '', ''

    gateway = _get_text(engine, 'GATEWAY')
    dns = ''
    dns_client = engine.find('DNS_CLIENT')
    if dns_client is not None:
        dns = _get_text(dns_client, 'SERVER_IP')

    return gateway, dns


def _synthesize_pc_config(dev_name: str, interfaces: list, gateway: str, dns: str) -> str:
    """为 PC 设备合成配置文本（便于前端展示）

    格式示例：
        ! PC 配置
        interface FastEthernet0
         ip address 172.16.4.2 255.255.255.0
         mac-address 0005.5E60.4966
         duplex full
        !
        ip default-gateway 172.16.4.1
        ip name-server <dns>
        !
    """
    lines = ['! PC 配置']
    for iface in interfaces:
        lines.append(f"interface {iface['name']}")
        if iface.get('ip') and iface.get('mask'):
            lines.append(f" ip address {iface['ip']} {iface['mask']}")
        if iface.get('mac'):
            lines.append(f" mac-address {iface['mac']}")
        if iface.get('duplex'):
            lines.append(f" duplex {iface['duplex']}")
        lines.append('!')

    # 网关和 DNS
    if gateway or dns:
        if gateway:
            lines.append(f"ip default-gateway {gateway}")
        if dns:
            lines.append(f"ip name-server {dns}")
        lines.append('!')

    return '\n'.join(lines)


def _supplement_interfaces_with_ports(interfaces: list, ports: list) -> None:
    """用 PORT 结构化数据补充接口的缺失字段（如 MAC 地址）

    按 IP 匹配 PORT 与接口，填充 MAC/带宽等缺失字段。
    """
    # 按 IP 建立 PORT 索引
    ports_by_ip = {p['ip']: p for p in ports if p.get('ip')}

    for iface in interfaces:
        ip = iface.get('ip', '')
        if not ip or ip not in ports_by_ip:
            continue
        port = ports_by_ip[ip]
        # 仅补充缺失字段，不覆盖已有值
        if not iface.get('mac') and port.get('mac'):
            iface['mac'] = port['mac']
        if iface.get('bandwidth') is None and port.get('bandwidth') is not None:
            iface['bandwidth'] = port['bandwidth']


# ============== 设备分组解析 ==============

def _find_groups(root: ET.Element) -> list:
    """查找设备分组/集群信息"""
    groups = []

    # 尝试查找集群/分组节点
    for tag in ['CLUSTER', 'GROUP', 'cluster', 'group']:
        for node in root.findall(f'.//{tag}'):
            name = node.get('NAME') or node.get('name') or '未命名分组'
            # 查找组内设备
            members = []
            for member in node.findall('.//MEMBER'):
                dev_id = member.get('DEVICE') or member.get('device') or member.text
                if dev_id:
                    members.append(str(dev_id))
            if members:
                groups.append({
                    'name': name,
                    'members': members,
                })

    return groups


# ============== 统一解析入口 ==============

def parse_xml(xml_text: str) -> dict:
    """解析 PT XML 文本，返回结构化数据

    返回结构：
    {
        'devices': [...],
        'links': [...],
        'configs': [...],
        'interfaces': {deviceId: [...]},
        'vlans': {deviceId: [...]},
        'acls': {deviceId: [...]},
        'routes': {deviceId: [...]},
        'groups': [...],
    }
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        raise ValueError(f"XML 解析失败：{e}")

    # 解析设备
    devices = _find_devices(root)

    # 建立设备 ID 映射表：原始 ID -> 数字 ID（从 1 开始）
    # 用于将 save-ref-id:xxx 等长 ID 转换为前端兼容的数字 ID
    id_mapping = {}
    for idx, dev in enumerate(devices, start=1):
        old_id = dev['id']
        new_id = str(idx)
        id_mapping[old_id] = new_id
        dev['id'] = new_id

    # 解析链路
    links = _find_links(root)

    # 给链路分配 L1, L2, L3... 格式的 ID，并更新两端设备 ID
    for idx, link in enumerate(links, start=1):
        link['id'] = f'L{idx}'
        # 更新源设备 ID
        old_src = link['srcDevice']
        if old_src in id_mapping:
            link['srcDevice'] = id_mapping[old_src]
        # 更新目的设备 ID
        old_dst = link['dstDevice']
        if old_dst in id_mapping:
            link['dstDevice'] = id_mapping[old_dst]

    # 解析配置
    configs = _find_configs(root)

    # 更新配置中的设备 ID
    for cfg in configs:
        old_id = cfg['deviceId']
        if old_id in id_mapping:
            cfg['deviceId'] = id_mapping[old_id]

    # 重新查找所有设备节点，用于 PC 接口解析和 MAC 补充
    device_nodes = root.findall('.//DEVICE')
    if not device_nodes:
        device_nodes = root.findall('.//device')

    # 建立 原始ID -> (新ID, device_node) 映射
    dev_node_map = {}  # 新 ID -> device_node
    for dev_node in device_nodes:
        dev_name = _get_attr_or_text(dev_node, 'NAME|name|DisplayName', 'ENGINE/NAME|NAME')
        dev_id_raw = _get_attr_or_text(dev_node, 'DBID|id|ID', 'ENGINE/SAVE_REF_ID|SAVE_REF_ID')
        if not dev_id_raw:
            dev_id_raw = dev_name
        new_id = id_mapping.get(dev_id_raw, str(dev_id_raw))
        dev_node_map[new_id] = dev_node

    # 为每个设备提取网关/DNS/MAC（PC 有，路由器通常无网关/DNS）
    device_extra = {}  # 新 ID -> {gateway, dns, mac}
    for dev in devices:
        dev_id = dev['id']
        dev_node = dev_node_map.get(dev_id)
        if dev_node is None:
            device_extra[dev_id] = {'gateway': '', 'dns': '', 'mac': ''}
            continue
        gateway, dns = parse_device_gateway(dev_node)
        # 主接口 MAC：取第一个有 MAC 的 PORT
        ports = parse_ports_from_device(dev_node)
        mac = ''
        for p in ports:
            if p.get('mac'):
                mac = p['mac']
                break
        device_extra[dev_id] = {'gateway': gateway, 'dns': dns, 'mac': mac}
        # 同步写入设备字典，供 output 模块使用
        dev['gateway'] = gateway
        dev['dns'] = dns
        dev['mac'] = mac

    # 从配置推算接口表/VLAN/ACL/路由
    interfaces_by_device = {}
    vlans_by_device = {}
    acls_by_device = {}
    routes_by_device = {}

    # 已处理配置的设备 ID 集合
    config_device_ids = set()

    for cfg in configs:
        dev_id = cfg['deviceId']
        config_text = cfg['config']

        interfaces_by_device[dev_id] = parse_interfaces_from_config(config_text)
        vlans_by_device[dev_id] = parse_vlans_from_config(config_text)
        acls_by_device[dev_id] = parse_acls_from_config(config_text)
        routes_by_device[dev_id] = parse_routes_from_config(
            config_text,
            interfaces_by_device[dev_id]
        )
        config_device_ids.add(dev_id)

        # 用 PORT 结构补充路由器接口的 MAC 地址等缺失字段
        dev_node = dev_node_map.get(dev_id)
        if dev_node is not None:
            ports = parse_ports_from_device(dev_node)
            _supplement_interfaces_with_ports(interfaces_by_device[dev_id], ports)

    # 处理无 RUNNINGCONFIG 的设备（如 PC）：从 PORT 结构解析接口
    for dev in devices:
        dev_id = dev['id']
        if dev_id in config_device_ids:
            continue
        dev_node = dev_node_map.get(dev_id)
        if dev_node is None:
            continue

        # 尝试从 PORT 结构解析 PC 接口
        pc_interfaces = parse_pc_interfaces_from_port(dev_node)
        if not pc_interfaces:
            continue

        # 提取顶层网关和 DNS
        gateway, dns = parse_device_gateway(dev_node)

        # 设置 PC 接口表（VLAN/ACL/路由为空）
        interfaces_by_device[dev_id] = pc_interfaces
        vlans_by_device[dev_id] = []
        acls_by_device[dev_id] = []
        routes_by_device[dev_id] = []

        # 合成 PC 配置文本，便于前端展示
        config_text = _synthesize_pc_config(dev['name'], pc_interfaces, gateway, dns)
        configs.append({
            'deviceId': dev_id,
            'deviceName': dev['name'],
            'config': config_text,
        })
        config_device_ids.add(dev_id)

    # 解析分组
    groups = _find_groups(root)

    # 更新分组中的设备 ID
    for group in groups:
        updated_members = []
        for member in group['members']:
            if member in id_mapping:
                updated_members.append(id_mapping[member])
            else:
                updated_members.append(member)
        group['members'] = updated_members

    return {
        'devices': devices,
        'links': links,
        'configs': configs,
        'interfaces': interfaces_by_device,
        'vlans': vlans_by_device,
        'acls': acls_by_device,
        'routes': routes_by_device,
        'groups': groups,
    }
