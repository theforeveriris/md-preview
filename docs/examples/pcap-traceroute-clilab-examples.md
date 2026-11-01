---
title: pcap / traceroute / CLI 演练示例
tags: [网络, 示例]
---

# pcap / traceroute / CLI 演练

三个面向网络工程师的交互渲染块：抓包分析、路径追踪、可敲命令的演练终端。
编辑器里输入 ```` ```pcap ```` / ```` ```traceroute ```` / ```` ```cli ```` 可从补全面板快速插入模板。

## 一、pcap 抓包渲染

```` ```pcap ```` 代码块渲染为**类 Wireshark 包列表**。两种用法：

1. **引用构建期产物**（推荐）：仓库内 `.pcap` 文件放进 `iris/data/pcap/raw/`，
   由 `python iris/scripts/pcap/main.py`（scapy 优先 / dpkt 回退）转为 JSON，正文写 `@[pcap](文件名)`；
2. **内嵌 JSON**：与 ```apexcharts 同惯例，直接把 `{ "packets": [...] }` 写进代码块。

能力：协议着色 chip、列排序（点表头）、**display filter**（`tcp`、`dns`、`port 53`、
`src==10.0.0.1`、`len>100`，空格 = 隐式 AND）、点击行展开字段树、协议分布条 + 图例；
TCP 53 这类知名端口自动识别为应用层（显示 DNS）。

**源码**

````markdown
```pcap
{
  "file": "内嵌示例.json",
  "count": 8,
  "packets": [
    { "no": 1, "time": 0,        "src": "192.168.1.10", "dst": "192.168.1.1",  "proto": "ARP",  "stack": ["Ethernet", "ARP"], "length": 42,  "info": "ARP who-has 192.168.1.1" },
    { "no": 2, "time": 0.0002,   "src": "192.168.1.1",  "dst": "192.168.1.10", "proto": "ARP",  "stack": ["Ethernet", "ARP"], "length": 42,  "info": "ARP is-at aa:bb:cc:dd:ee:ff" },
    { "no": 3, "time": 0.001,    "src": "192.168.1.10", "dst": "8.8.8.8",      "proto": "UDP",  "stack": ["Ethernet", "IP", "UDP", "DNS"], "srcPort": 54321, "dstPort": 53, "length": 74, "info": "DNS query: example.com" },
    { "no": 4, "time": 0.030,    "src": "8.8.8.8",      "dst": "192.168.1.10", "proto": "DNS",  "stack": ["Ethernet", "IP", "UDP", "DNS"], "srcPort": 53, "dstPort": 54321, "length": 90, "info": "DNS response: 93.184.216.34" },
    { "no": 5, "time": 0.032,    "src": "192.168.1.10", "dst": "93.184.216.34","proto": "TCP",  "stack": ["Ethernet", "IP", "TCP"], "srcPort": 54322, "dstPort": 443, "length": 66, "info": "[SYN]" },
    { "no": 6, "time": 0.110,    "src": "93.184.216.34","dst": "192.168.1.10", "proto": "TCP",  "stack": ["Ethernet", "IP", "TCP", "TLS"], "srcPort": 443, "dstPort": 54322, "length": 66, "info": "[SYN, ACK]" },
    { "no": 7, "time": 0.111,    "src": "192.168.1.10", "dst": "93.184.216.34","proto": "TLS",  "stack": ["Ethernet", "IP", "TCP", "TLS"], "srcPort": 54322, "dstPort": 443, "length": 517, "info": "Client Hello" },
    { "no": 8, "time": 0.115,    "src": "192.168.1.10", "dst": "192.168.1.255","proto": "UDP",  "stack": ["Ethernet", "IP", "UDP"], "srcPort": 137, "dstPort": 137, "length": 78, "info": "NBNS 名称注册" }
  ]
}
```
````

**渲染效果**

```pcap
{
  "file": "内嵌示例.json",
  "count": 8,
  "packets": [
    { "no": 1, "time": 0,        "src": "192.168.1.10", "dst": "192.168.1.1",  "proto": "ARP",  "stack": ["Ethernet", "ARP"], "length": 42,  "info": "ARP who-has 192.168.1.1" },
    { "no": 2, "time": 0.0002,   "src": "192.168.1.1",  "dst": "192.168.1.10", "proto": "ARP",  "stack": ["Ethernet", "ARP"], "length": 42,  "info": "ARP is-at aa:bb:cc:dd:ee:ff" },
    { "no": 3, "time": 0.001,    "src": "192.168.1.10", "dst": "8.8.8.8",      "proto": "UDP",  "stack": ["Ethernet", "IP", "UDP", "DNS"], "srcPort": 54321, "dstPort": 53, "length": 74, "info": "DNS query: example.com" },
    { "no": 4, "time": 0.030,    "src": "8.8.8.8",      "dst": "192.168.1.10", "proto": "DNS",  "stack": ["Ethernet", "IP", "UDP", "DNS"], "srcPort": 53, "dstPort": 54321, "length": 90, "info": "DNS response: 93.184.216.34" },
    { "no": 5, "time": 0.032,    "src": "192.168.1.10", "dst": "93.184.216.34","proto": "TCP",  "stack": ["Ethernet", "IP", "TCP"], "srcPort": 54322, "dstPort": 443, "length": 66, "info": "[SYN]" },
    { "no": 6, "time": 0.110,    "src": "93.184.216.34","dst": "192.168.1.10", "proto": "TCP",  "stack": ["Ethernet", "IP", "TCP", "TLS"], "srcPort": 443, "dstPort": 54322, "length": 66, "info": "[SYN, ACK]" },
    { "no": 7, "time": 0.111,    "src": "192.168.1.10", "dst": "93.184.216.34","proto": "TLS",  "stack": ["Ethernet", "IP", "TCP", "TLS"], "srcPort": 54322, "dstPort": 443, "length": 517, "info": "Client Hello" },
    { "no": 8, "time": 0.115,    "src": "192.168.1.10", "dst": "192.168.1.255","proto": "UDP",  "stack": ["Ethernet", "IP", "UDP"], "srcPort": 137, "dstPort": 137, "length": 78, "info": "NBNS 名称注册" }
  ]
}
```

试试点第 7 行展开字段树；在过滤框输入 `dns` 或 `port 443` 看列表收缩与协议分布条变化。

## 二、traceroute / ping 渲染

```` ```traceroute ```` / ```` ```tracert ```` / ```` ```ping ```` 代码块粘贴原始命令输出即可，
Cisco / Windows / Linux / mtr 风格都认，`* * *` 显示为灰色超时档。
每跳 RTT 条形按全图最大值归一化（慢跳变红），ping 模式另有 min/avg/max/丢包统计卡与逐包序列图。点击跳地址可复制。

**源码**

````markdown
```traceroute
traceroute to example.com (93.184.216.34), 30 hops max
 1  192.168.1.1 (192.168.1.1)  1.2 ms  1.0 ms  0.9 ms
 2  10.8.0.1 (10.8.0.1)  12.3 ms  12.1 ms  11.8 ms
 3  100.64.0.1 (100.64.0.1)  15.6 ms  15.2 ms  14.9 ms
 4  * * *
 5  203.0.113.9 (203.0.113.9)  45.7 ms  78.3 ms  44.1 ms
 6  93.184.216.34 (93.184.216.34)  46.2 ms  45.8 ms  45.5 ms
```
````

**渲染效果**

```traceroute
traceroute to example.com (93.184.216.34), 30 hops max
 1  192.168.1.1 (192.168.1.1)  1.2 ms  1.0 ms  0.9 ms
 2  10.8.0.1 (10.8.0.1)  12.3 ms  12.1 ms  11.8 ms
 3  100.64.0.1 (100.64.0.1)  15.6 ms  15.2 ms  14.9 ms
 4  * * *
 5  203.0.113.9 (203.0.113.9)  45.7 ms  78.3 ms  44.1 ms
 6  93.184.216.34 (93.184.216.34)  46.2 ms  45.8 ms  45.5 ms
```

ping 示例（统计卡 + 逐包 RTT 序列图）：

````markdown
```ping
PING example.com (93.184.216.34): 56 data bytes
64 bytes from 93.184.216.34: icmp_seq=0 ttl=56 time=45.3 ms
64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=44.9 ms
64 bytes from 93.184.216.34: icmp_seq=2 ttl=56 time=46.1 ms
64 bytes from 93.184.216.34: icmp_seq=3 ttl=56 time=45.7 ms
--- example.com ping statistics ---
4 packets transmitted, 4 received, 0.0% packet loss
round-trip min/avg/max = 44.9/45.5/46.1 ms
```
````

```ping
PING example.com (93.184.216.34): 56 data bytes
64 bytes from 93.184.216.34: icmp_seq=0 ttl=56 time=45.3 ms
64 bytes from 93.184.216.34: icmp_seq=1 ttl=56 time=44.9 ms
64 bytes from 93.184.216.34: icmp_seq=2 ttl=56 time=46.1 ms
64 bytes from 93.184.216.34: icmp_seq=3 ttl=56 time=45.7 ms
--- example.com ping statistics ---
4 packets transmitted, 4 received, 0.0% packet loss
round-trip min/avg/max = 44.9/45.5/46.1 ms
```

## 三、CLI 演练块

```` ```cli ```` 代码块是一段「命令 → 期望输出」的**剧本**：提示符行（`Router>` /
`Router#` / `<Huawei>` / `$` 等）后跟的命令就是本节要练的内容，紧随的非提示符行是该
命令的期望输出。渲染为可敲命令的终端——命中回放剧本输出，未命中提示，
**单独输入 `?`** 可列出待练命令（漏题选项），有进度徽章与重置按钮。

**源码**

````markdown
```cli
Router> show version
Cisco IOS Software, Version 15.2
Router uptime is 3 weeks
Router> enable
Router# configure terminal
Enter configuration commands, one per line.
Router(config)# hostname BRANCH-01
BRANCH-01(config)#
```
````

**渲染效果**（把下面每条命令敲进输入框试试；忘了就输入 `?`）

```cli
Router> show version
Cisco IOS Software, Version 15.2
Router uptime is 3 weeks
Router> enable
Router# configure terminal
Enter configuration commands, one per line.
Router(config)# hostname BRANCH-01
BRANCH-01(config)#
```

## 构建期说明（pcap）

- 放置抓包：`iris/data/pcap/raw/*.pcap`（或 `.pcapng`）；
- 本地构建：`python iris/scripts/pcap/main.py`（增量）或 `--force`（CI 恒为全量）；
- CI：`build-pcap.yml` 在 main 分支的 raw/ 或脚本变更时自动重建 JSON 并回写仓库；
- 正文引用：`@[pcap](文件名)`（无需扩展名），也可直接内嵌 JSON。

相关文档：[IOS/VRP 配置高亮示例](ios-vrp-examples.md) · [ACL 分析示例](acl-route-examples.md) · [PKT 拓扑示例](pkt-examples.md)
