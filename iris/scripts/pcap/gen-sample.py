"""生成一份真实结构的示例抓包：ARP → DNS → TCP 三次握手 → TLS Client Hello → 应用数据 → FIN"""
import dpkt, time

pc = dpkt.pcap.Writer(open('iris/data/pcap/raw/demo.pcap', 'wb')  # 从仓库根运行)
base = time.time()
mac_c = bytes.fromhex('aabbccddeeff')
mac_g = bytes.fromhex('112233445566')
ip_c = '192.168.1.10'
ip_g = '192.168.1.1'

def eth_ipv4(src_mac, dst_mac, src_ip, dst_ip, proto):
    ip = dpkt.ip.IP(src=bytes(map(int, src_ip.split('.'))), dst=bytes(map(int, dst_ip.split('.'))))
    ip.p = proto
    ip.len = 20
    ip.id = 0
    ip.off = 0
    ip.ttl = 64
    eth = dpkt.ethernet.Ethernet(src=src_mac, dst=dst_mac, data=ip)
    return eth, ip

def arp(ts, src, dst, op, spa, tpa, sha, tha):
    a = dpkt.arp.ARP()
    a.op = op
    a.spa = bytes(map(int, spa.split('.')))
    a.tpa = bytes(map(int, tpa.split('.')))
    a.sha = sha
    a.tha = tha
    e = dpkt.ethernet.Ethernet(src=sha, dst=(dst if dst is not None else b'\xff'*6), data=a)
    pc.writepkt(e, ts)

def udp(ts, sip, dip, sport, dport, payload):
    u = dpkt.udp.UDP(sport=sport, dport=dport, data=payload)
    u.ulen = 8 + len(payload)
    e, ip = eth_ipv4(mac_c, mac_g, sip, dip, 17)
    ip.data = u
    ip.len = 20 + u.ulen
    pc.writepkt(e, ts)

def tcp(ts, sip, dip, sport, dport, seq, ack, flags, payload=b''):
    t = dpkt.tcp.TCP(sport=sport, dport=dport, seq=seq, ack=ack, flags=flags, data=payload)
    t.win = 64240
    t.opts = b''
    t.urp = 0
    e, ip = eth_ipv4(mac_c, mac_g, sip, dip, 6)
    ip.data = t
    ip.len = 20 + 20 + len(payload)
    pc.writepkt(e, ts)

def dns_query(name, tid):
    d = dpkt.dns.DNS()
    d.id = tid
    d.qr = 0
    d.qdcount = 1
    d.qd = [dpkt.dns.DNS.Q(name=name, type=dpkt.dns.DNS_A)]
    return bytes(d)

def dns_answer(name, tid, ip):
    d = dpkt.dns.DNS()
    d.id = tid
    d.qr = 1
    d.qdcount = 1
    d.ancount = 1
    d.qd = [dpkt.dns.DNS.Q(name=name, type=dpkt.dns.DNS_A)]
    d.an = [dpkt.dns.DNS.RR(name=name, type=dpkt.dns.DNS_A, ttl=60, rdlen=4, rdata=bytes(map(int, ip.split('.'))))]
    return bytes(d)

# 1) ARP 请求/应答
arp(base, mac_c, None, 1, ip_c, ip_g, mac_c, b'\x00'*6)
arp(base+0.0002, mac_g, mac_c, 2, ip_g, ip_c, mac_g, mac_c)
# 2) DNS query/response
udp(base+0.001, ip_c, '8.8.8.8', 54321, 53, dns_query('example.com', 0x1234))
udp(base+0.030, '8.8.8.8', ip_c, 53, 54321, dns_answer('example.com', 0x1234, '93.184.216.34'))
# 3) TCP 三次握手
sip, dip, sport, dport = ip_c, '93.184.216.34', 54322, 443
seq0, aseq0 = 0x20000000, 0x90000000
tcp(base+0.032, sip, dip, sport, dport, seq0, 0, dpkt.tcp.TH_SYN)
tcp(base+0.110, dip, sip, dport, sport, aseq0, seq0+1, dpkt.tcp.TH_SYN|dpkt.tcp.TH_ACK)
tcp(base+0.111, sip, dip, sport, dport, seq0+1, aseq0+1, dpkt.tcp.TH_ACK)
# 4) TLS Client Hello（构造合法头）
ch_body = bytes([0x03,0x03, 0x00,0x2f, 0x00,0x00,0x00,0x00]) + b'\x00'*40
hello = bytes([0x16, 0x03, 0x01, len(ch_body)//256, len(ch_body)%256, 0x01, 0x00, 0x00,0x00,0x00]) + ch_body
tcp(base+0.115, sip, dip, sport, dport, seq0+1, aseq0+1, dpkt.tcp.TH_PUSH|dpkt.tcp.TH_ACK, hello)
# 5) 应用数据与挥手
tcp(base+0.130, dip, sip, dport, sport, aseq0+1, seq0+1+len(hello), dpkt.tcp.TH_PUSH|dpkt.tcp.TH_ACK, b'\x17\x03\x03\x00\x20' + b'\x00'*32)
tcp(base+0.140, sip, dip, sport, dport, seq0+1+len(hello), aseq0+1+37, dpkt.tcp.TH_FIN|dpkt.tcp.TH_ACK)
tcp(base+0.150, dip, sip, dport, sport, aseq0+1+37, seq0+2+len(hello), dpkt.tcp.TH_ACK)
pc.close()
print('demo.pcap written')
