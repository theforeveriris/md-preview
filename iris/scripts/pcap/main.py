#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""pcap 抓包 → JSON 预处理脚本（与 iris/scripts/pkt 同构的构建期管线）

功能：
1. 扫描 iris/data/pcap/raw/ 下的所有 .pcap / .pcapng 文件
2. 对比 mtime 实现增量处理
3. 解析包列表（时间戳/长度/协议栈/IP 端口/摘要）→ JSON 输出到 iris/data/pcap/json/
4. 依赖：优先 scapy，回退 dpkt；都不可用时给出安装指引并退出
5. 失败时生成错误 JSON（渲染器会显示可读错误，不炸页面）

产物 JSON 结构（渲染器消费）：
{
  "file": "demo.pcap",
  "generatedAt": "...",
  "linkType": "Ethernet",
  "count": 123,
  "truncated": false,          // 超过 MAX_PACKETS 截断
  "packets": [
    {
      "no": 1,
      "time": 1698000000.123,  // 相对首包秒
      "src": "192.168.1.10", "dst": "192.168.1.1",
      "srcPort": 54321, "dstPort": 443,
      "proto": "TCP",          // 物理层之上的最高可读协议
      "stack": ["Eth", "IP", "TCP", "TLS"],
      "length": 517,
      "info": "517 → 443 [ACK] Seq=1 Win=64240"  // 协议相关摘要
    }
  ]
}

用法：
    python iris/scripts/pcap/main.py            # 增量处理
    python iris/scripts/pcap/main.py --force    # 强制全量重建
    python iris/scripts/pcap/main.py --verbose  # 详细输出
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent  # iris/scripts/pcap → iris → 项目根

RAW_DIR = PROJECT_ROOT / 'iris' / 'data' / 'pcap' / 'raw'
JSON_DIR = PROJECT_ROOT / 'iris' / 'data' / 'pcap' / 'json'

MAX_PACKETS = 3000       # 每个文件最多输出的包数（页面渲染量级控制）
VERBOSE = False


def log(msg):
    if VERBOSE:
        print(msg)


# ============== 解析后端 ==============

def parse_with_scapy(path, max_packets):
    """scapy 后端：协议覆盖最全（Ethernet/ARP/IP/TCP/UDP/ICMP/DNS/TLS 握手可辨）"""
    from scapy.all import PcapReader, IP, TCP, UDP, ICMP, ARP, DNS, IPv6

    def info_of(pkt):
        if TCP in pkt:
            flags = str(pkt[TCP].flags)
            extra = []
            if 'S' in flags and 'A' not in flags:
                extra.append('[SYN]')
            elif 'S' in flags:
                extra.append('[SYN, ACK]')
            elif 'F' in flags:
                extra.append('[FIN, ACK]')
            elif 'R' in flags:
                extra.append('[RST]')
            else:
                extra.append('[ACK]')
            payload = bytes(pkt[TCP].payload)
            if payload:
                extra.append('Len=%d' % len(payload))
            return ' '.join(extra)
        if UDP in pkt:
            if DNS in pkt:
                try:
                    q = pkt[DNS].qd.qname.decode(errors='replace').rstrip('.')
                    return 'DNS query: %s' % q
                except Exception:
                    return 'DNS'
            return 'UDP %d → %d' % (pkt[UDP].sport, pkt[UDP].dport)
        if ICMP in pkt:
            return 'ICMP type=%d code=%d' % (pkt[ICMP].type, pkt[ICMP].code)
        if ARP in pkt:
            return '%s %s → %s' % ('ARP', pkt[ARP].psrc, pkt[ARP].pdst)
        return ''

    packets = []
    first_ts = None
    truncated = False
    count = 0
    with PcapReader(str(path)) as reader:
        for pkt in reader:
            count += 1
            if len(packets) >= max_packets:
                truncated = True
                continue  # 继续数总数但不再存
            ts = float(pkt.time)
            if first_ts is None:
                first_ts = ts
            entry = {
                'no': count,
                'time': round(ts - (first_ts if first_ts is not None else ts), 6),
                'length': len(pkt),
                'stack': [layer.__name__ for layer in pkt.layers()],
                'info': info_of(pkt),
            }
            if IPv6 in pkt:
                entry['src'] = pkt[IPv6].src
                entry['dst'] = pkt[IPv6].dst
                entry['proto'] = pkt[IPv6].payload.__class__.__name__.upper()
            elif IP in pkt:
                entry['src'] = pkt[IP].src
                entry['dst'] = pkt[IP].dst
                if TCP in pkt:
                    entry['proto'] = 'TCP'
                    entry['srcPort'] = int(pkt[TCP].sport)
                    entry['dstPort'] = int(pkt[TCP].dport)
                elif UDP in pkt:
                    entry['proto'] = 'UDP'
                    entry['srcPort'] = int(pkt[UDP].sport)
                    entry['dstPort'] = int(pkt[UDP].dport)
                elif ICMP in pkt:
                    entry['proto'] = 'ICMP'
                else:
                    entry['proto'] = pkt[IP].payload.__class__.__name__.upper() or 'IP'
            elif ARP in pkt:
                entry['proto'] = 'ARP'
                entry['src'] = pkt[ARP].psrc
                entry['dst'] = pkt[ARP].pdst
            else:
                entry['proto'] = (entry['stack'][-1] if entry['stack'] else 'RAW').upper()
            packets.append(entry)
    return {
        'count': count,
        'truncated': truncated,
        'packets': packets,
        'linkType': 'Ethernet',
    }


def parse_with_dpkt(path, max_packets):
    """dpkt 后端：轻量（无 C 依赖编译问题），覆盖 Ethernet/ARP/IP/TCP/UDP/ICMP"""
    import dpkt

    def tcp_flags_name(flags):
        names = []
        if flags & 0x02 and not flags & 0x10:
            return '[SYN]'
        if flags & 0x02 and flags & 0x10:
            return '[SYN, ACK]'
        if flags & 0x01:
            return '[FIN, ACK]'
        if flags & 0x04:
            return '[RST]'
        if flags & 0x10:
            return '[ACK]'
        return ''

    packets = []
    first_ts = None
    truncated = False
    count = 0
    with open(str(path), 'rb') as f:
        try:
            reader = dpkt.pcapng.Reader(f)
        except ValueError:
            f.seek(0)
            reader = dpkt.pcap.Reader(f)
        for ts, buf in reader:
            count += 1
            if len(packets) >= max_packets:
                truncated = True
                continue
            if first_ts is None:
                first_ts = ts
            entry = {
                'no': count,
                'time': round(ts - first_ts, 6),
                'length': len(buf),
                'stack': [],
                'info': '',
            }
            eth = dpkt.ethernet.Ethernet(buf)
            entry['stack'].append('Ethernet')
            if isinstance(eth.data, dpkt.arp.ARP):
                arp = eth.data
                entry['proto'] = 'ARP'
                entry['stack'].append('ARP')
                entry['src'] = '.'.join(str(b) for b in arp.spa)
                entry['dst'] = '.'.join(str(b) for b in arp.tpa)
            elif isinstance(eth.data, dpkt.ip.IP):
                ip = eth.data
                entry['stack'].append('IP')
                entry['src'] = '.'.join(str(b) for b in ip.src)
                entry['dst'] = '.'.join(str(b) for b in ip.dst)
                if isinstance(ip.data, dpkt.tcp.TCP):
                    tcp = ip.data
                    entry['proto'] = 'TCP'
                    entry['stack'].append('TCP')
                    entry['srcPort'] = tcp.sport
                    entry['dstPort'] = tcp.dport
                    entry['info'] = tcp_flags_name(tcp.flags)
                elif isinstance(ip.data, dpkt.udp.UDP):
                    udp = ip.data
                    entry['proto'] = 'UDP'
                    entry['stack'].append('UDP')
                    entry['srcPort'] = udp.sport
                    entry['dstPort'] = udp.dport
                    if udp.dport == 53 or udp.sport == 53:
                        entry['proto'] = 'DNS'
                        entry['stack'].append('DNS')
                elif isinstance(ip.data, dpkt.icmp.ICMP):
                    entry['proto'] = 'ICMP'
                    entry['stack'].append('ICMP')
                    entry['info'] = 'ICMP type=%d code=%d' % (ip.data.type, ip.data.code)
                else:
                    entry['proto'] = 'IP'
            else:
                entry['proto'] = 'ETH'
            packets.append(entry)
    return {
        'count': count,
        'truncated': truncated,
        'packets': packets,
        'linkType': 'Ethernet',
    }


# ============== 主流程 ==============

def build_error_json(rel_name, reason):
    return {
        'file': rel_name,
        'error': reason,
        'count': 0,
        'packets': [],
    }


def process_file(path, force):
    rel = path.name
    out_file = JSON_DIR / (path.stem + '.json')
    if not force and out_file.exists() and out_file.stat().st_mtime >= path.stat().st_mtime:
        log('跳过（已是最新）: %s' % rel)
        return 'skip'

    try:
        try:
            result = parse_with_scapy(path, MAX_PACKETS)
            backend = 'scapy'
        except ImportError:
            result = parse_with_dpkt(path, MAX_PACKETS)
            backend = 'dpkt'
        data = {
            'file': rel,
            'generatedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            'backend': backend,
            'linkType': result.get('linkType', 'Ethernet'),
            'count': result['count'],
            'truncated': result['truncated'],
            'packets': result['packets'],
        }
        out_file.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print('  %s: %d 包（%s%s）' % (rel, data['count'], backend, '，已截断' if data['truncated'] else ''))
        return 'ok'
    except ImportError as e:
        print('ERROR: 解析 %s 需要 scapy 或 dpkt：pip install scapy（或 pip install dpkt）' % rel, file=sys.stderr)
        out_file.write_text(json.dumps(build_error_json(rel, str(e)), ensure_ascii=False), encoding='utf-8')
        return 'error'
    except Exception as e:
        print('WARN: 解析失败 %s: %s' % (rel, e), file=sys.stderr)
        out_file.write_text(json.dumps(build_error_json(rel, str(e)), ensure_ascii=False), encoding='utf-8')
        return 'error'


def main():
    global VERBOSE
    parser = argparse.ArgumentParser(description='pcap → JSON 预处理')
    parser.add_argument('--force', action='store_true', help='忽略 mtime 全量重建')
    parser.add_argument('--verbose', action='store_true', help='详细输出')
    args = parser.parse_args()
    VERBOSE = args.verbose

    if not RAW_DIR.exists():
        print('iris/data/pcap/raw/ 不存在，无 pcap 可处理。')
        return

    JSON_DIR.mkdir(parents=True, exist_ok=True)
    stats = {'ok': 0, 'skip': 0, 'error': 0}
    for p in sorted(RAW_DIR.iterdir()):
        if p.suffix.lower() not in ('.pcap', '.pcapng') or not p.is_file():
            continue
        stats[process_file(p, args.force)] += 1
    print('pcap 构建完成: %d 成功, %d 跳过, %d 失败' % (stats['ok'], stats['skip'], stats['error']))


if __name__ == '__main__':
    main()
