"""Huawei eNSP JSON 输出模块

构造顶层分区式 JSON schema（与 pkt 模块保持兼容）：
{
    "meta": {
        "source": "xxx.topo",
        "version": "eNSP",
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
    ensp_version: str = 'unknown',
) -> dict:
    """构造完整的拓扑 JSON

    参数：
        source_filename: 原始 .topo 文件名
        parsed_data: parse_xml 返回的结构化数据
        ensp_version: 检测到的 eNSP 版本

    返回：顶层分区式 JSON dict
    """
    devices = parsed_data.get('devices', [])
    links = parsed_data.get('links', [])
    configs = parsed_data.get('configs', [])

    enriched_devices = []
    interfaces_map = parsed_data.get('interfaces', {})

    for dev in devices:
        dev_id = dev['id']
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

    enriched_links = []
    for link in links:
        bandwidth = None
        src_ifaces = interfaces_map.get(link['srcDevice'], [])
        for iface in src_ifaces:
            if _interface_name_match(iface['name'], link['srcInterface']):
                bandwidth = iface.get('bandwidth')
                break

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

    topology = {
        'meta': {
            'source': source_filename,
            'ptVersion': ensp_version,
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
    """判断配置中的接口名是否匹配链路中的接口名"""
    if not config_name or not link_name:
        return False
    if config_name.lower() == link_name.lower():
        return True
    norm_config = _normalize_interface_name(config_name)
    norm_link = _normalize_interface_name(link_name)
    return norm_config == norm_link


def _normalize_interface_name(name: str) -> str:
    """标准化接口名"""
    name = name.lower().strip()
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
    name = name.replace(' ', '')
    return name


def _compute_link_subnet(link: dict, interfaces_map: dict) -> tuple:
    """根据链路两端设备的接口 IP 推算网段"""
    src_ip = ''
    dst_ip = ''
    src_mask = ''
    dst_mask = ''

    src_dev_id = link.get('srcDevice', '')
    src_if_name = link.get('srcInterface', '')
    for iface in interfaces_map.get(src_dev_id, []):
        if _interface_name_match(iface.get('name', ''), src_if_name):
            src_ip = iface.get('ip', '')
            src_mask = iface.get('mask', '')
            break

    dst_dev_id = link.get('dstDevice', '')
    dst_if_name = link.get('dstInterface', '')
    for iface in interfaces_map.get(dst_dev_id, []):
        if _interface_name_match(iface.get('name', ''), dst_if_name):
            dst_ip = iface.get('ip', '')
            dst_mask = iface.get('mask', '')
            break

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
    """写入 XML 文件（中间产物）"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xml_text)
