"""Packet Tracer JSON 输出模块

构造顶层分区式 JSON schema：
{
    "meta": {
        "source": "xxx.pkt",
        "version": "PT 7.x / PT 8.x",
        "generatedAt": "2024-...",
        "deviceCount": N,
        "linkCount": N
    },
    "devices": [...],
    "links": [...],
    "configs": [...],
    "interfaces": {deviceId: [...]},
    "vlans": {deviceId: [...]},
    "acls": {deviceId: [...]},
    "routes": {deviceId: [...]},
    "groups": [...],
    "error": null | {"code": "...", "message": "..."}
}
"""

import ipaddress
import json
import os
from datetime import datetime


def build_topology_json(
    source_filename: str,
    parsed_data: dict,
    pt_version: str = 'unknown',
) -> dict:
    """构造完整的拓扑 JSON

    参数：
        source_filename: 原始 .pkt 文件名
        parsed_data: parse_xml 返回的结构化数据
        pt_version: 检测到的 PT 版本

    返回：顶层分区式 JSON dict
    """
    devices = parsed_data.get('devices', [])
    links = parsed_data.get('links', [])
    configs = parsed_data.get('configs', [])

    # 构建设备列表，附加主 IP
    enriched_devices = []
    interfaces_map = parsed_data.get('interfaces', {})

    for dev in devices:
        dev_id = dev['id']
        # 找主 IP（第一个有 IP 的接口）
        primary_ip = ''
        dev_interfaces = interfaces_map.get(dev_id, [])
        for iface in dev_interfaces:
            if iface.get('ip'):
                primary_ip = iface['ip']
                break

        enriched_dev = {
            'id': dev_id,
            'name': dev['name'],
            'type': dev['type'],
            'rawType': dev.get('rawType', ''),
            'model': dev.get('model', ''),
            'x': dev['x'],
            'y': dev['y'],
            'primaryIp': primary_ip,
            'interfaceCount': len(dev_interfaces),
            'vlanCount': len(parsed_data.get('vlans', {}).get(dev_id, [])),
            'aclCount': len(parsed_data.get('acls', {}).get(dev_id, [])),
            'routeCount': len(parsed_data.get('routes', {}).get(dev_id, [])),
            'gateway': dev.get('gateway', ''),
            'dns': dev.get('dns', ''),
            'mac': dev.get('mac', ''),
        }
        enriched_devices.append(enriched_dev)

    # 构建链路列表，附加速率和网段信息
    enriched_links = []
    for link in links:
        # 从接口表查找带宽
        bandwidth = None
        src_ifaces = interfaces_map.get(link['srcDevice'], [])
        for iface in src_ifaces:
            if _interface_name_match(iface['name'], link['srcInterface']):
                bandwidth = iface.get('bandwidth')
                break

        # 推算链路网段及两端接口 IP
        subnet, src_ip, dst_ip = _compute_link_subnet(link, interfaces_map)

        enriched_link = {
            'id': link['id'],
            'source': link['srcDevice'],
            'target': link['dstDevice'],
            'sourceInterface': link['srcInterface'],
            'targetInterface': link['dstInterface'],
            'cableType': link['cableType'],
            'cableRawType': link.get('cableRawType', ''),
            'bandwidth': bandwidth,
            'subnet': subnet,
            'srcIp': src_ip,
            'dstIp': dst_ip,
        }
        enriched_links.append(enriched_link)

    # 构建完整 JSON
    topology = {
        'meta': {
            'source': source_filename,
            'ptVersion': pt_version,
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'deviceCount': len(enriched_devices),
            'linkCount': len(enriched_links),
            'configCount': len(configs),
            'parserVersion': '1.0.0',
        },
        'devices': enriched_devices,
        'links': enriched_links,
        'configs': configs,
        'interfaces': parsed_data.get('interfaces', {}),
        'vlans': parsed_data.get('vlans', {}),
        'acls': parsed_data.get('acls', {}),
        'routes': parsed_data.get('routes', {}),
        'groups': parsed_data.get('groups', []),
        'error': None,
    }

    return topology


def build_error_json(source_filename: str, error_code: str, error_message: str, error_detail: str = '') -> dict:
    """构造错误 JSON

    当解析失败时，生成带 error 字段的 JSON，
    前端渲染时显示错误信息卡片。
    """
    return {
        'meta': {
            'source': source_filename,
            'ptVersion': 'unknown',
            'generatedAt': datetime.utcnow().isoformat() + 'Z',
            'deviceCount': 0,
            'linkCount': 0,
            'configCount': 0,
            'parserVersion': '1.0.0',
        },
        'devices': [],
        'links': [],
        'configs': [],
        'interfaces': {},
        'vlans': {},
        'acls': {},
        'routes': {},
        'groups': [],
        'error': {
            'code': error_code,
            'message': error_message,
            'detail': error_detail,
        },
    }


def _interface_name_match(config_name: str, link_name: str) -> bool:
    """判断配置中的接口名是否匹配链路中的接口名

    PT 的接口名可能有多种缩写形式：
    - GigabitEthernet0/0 vs gi0/0
    - FastEthernet0/1 vs fa0/1
    """
    if not config_name or not link_name:
        return False
    # 直接匹配
    if config_name.lower() == link_name.lower():
        return True
    # 标准化后匹配
    norm_config = _normalize_interface_name(config_name)
    norm_link = _normalize_interface_name(link_name)
    return norm_config == norm_link


def _normalize_interface_name(name: str) -> str:
    """标准化接口名"""
    name = name.lower().strip()
    # 缩写扩展
    abbreviations = {
        'gi': 'gigabitethernet',
        'fa': 'fastethernet',
        'eth': 'ethernet',
        'se': 'serial',
        'lo': 'loopback',
        'tu': 'tunnel',
        'vl': 'vlan',
        'po': 'port-channel',
    }
    for abbr, full in abbreviations.items():
        if name.startswith(abbr):
            name = full + name[len(abbr):]
            break
    # 去除空格
    name = name.replace(' ', '')
    return name


def _compute_link_subnet(link: dict, interfaces_map: dict) -> tuple:
    """根据链路两端设备的接口 IP 推算网段

    查找 source 设备上 sourceInterface 对应的接口 IP，以及
    target 设备上 targetInterface 对应的接口 IP。
    两个 IP 应在同一网段，用 ipaddress 模块计算网络地址。

    返回 (subnet, src_ip, dst_ip)，如 ("172.16.1.0/24", "172.16.1.1", "172.16.1.2")。
    无法推算时对应字段为空字符串。
    """
    src_ip = ''
    dst_ip = ''
    src_mask = ''
    dst_mask = ''

    # 查找源设备接口 IP 和掩码
    src_dev_id = link.get('srcDevice', '')
    src_if_name = link.get('srcInterface', '')
    for iface in interfaces_map.get(src_dev_id, []):
        if _interface_name_match(iface.get('name', ''), src_if_name):
            src_ip = iface.get('ip', '')
            src_mask = iface.get('mask', '')
            break

    # 查找目的设备接口 IP 和掩码
    dst_dev_id = link.get('dstDevice', '')
    dst_if_name = link.get('dstInterface', '')
    for iface in interfaces_map.get(dst_dev_id, []):
        if _interface_name_match(iface.get('name', ''), dst_if_name):
            dst_ip = iface.get('ip', '')
            dst_mask = iface.get('mask', '')
            break

    # 计算网段：优先用源端，其次用目的端
    subnet = ''
    for ip, mask in ((src_ip, src_mask), (dst_ip, dst_mask)):
        if ip and mask:
            try:
                network = ipaddress.IPv4Network(f'{ip}/{mask}', strict=False)
                subnet = str(network)
                break
            except ValueError:
                continue

    return subnet, src_ip, dst_ip


def write_json(data: dict, output_path: str) -> None:
    """写入 JSON 文件"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def write_xml(xml_text: str, output_path: str) -> None:
    """写入 XML 文件（解密后的中间产物）"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xml_text)
