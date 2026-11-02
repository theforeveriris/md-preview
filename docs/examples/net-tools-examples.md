---
title: Nmap / dig / BGP 专用视图
tags: [网络, 排查]
---

# Nmap / dig / BGP 专用视图

每个视图都复用统一表格工具（排序/筛选/导出），并带有协议语义配色。

## Nmap

**源码**（normal 输出，也支持 grepable 与 XML）：

````markdown
```nmap
Nmap scan report for 10.0.0.5 (10.0.0.5)
Host is up (0.0012s latency).

PORT     STATE  SERVICE     VERSION
22/tcp   open  ssh         OpenSSH 8.9p1
80/tcp   open  http        nginx 1.24.0
443/tcp  open  https       nginx 1.24.0
2222/tcp  open  ssh         OpenSSH 8.9p1
3306/tcp  closed mysql
8080/tcp  filtered http
```
````

**渲染效果**（open 绿色 / closed 弱化 / filtered 黄色，头部汇总主机与开放端口数）：

```nmap
Nmap scan report for 10.0.0.5 (10.0.0.5)
Host is up (0.0012s latency).

PORT     STATE  SERVICE     VERSION
22/tcp   open  ssh         OpenSSH 8.9p1
80/tcp   open  http        nginx 1.24.0
443/tcp  open  https       nginx 1.24.0
2222/tcp  open  ssh         OpenSSH 8.9p1
3306/tcp  closed mysql
8080/tcp  filtered http
```

## dig

**源码**（按 ANSWER / AUTHORITY / ADDITIONAL 分区识别）：

````markdown
```dig
; <<>> DiG 9.18 <<>> example.com
;; global options: +cmd
;; ANSWER SECTION:
example.com.  3600  IN  A  93.184.216.34
example.com.  3600  IN  AAAA  2606:2800:220:1:248:1893:25c8:1946
;; AUTHORITY SECTION:
example.com.  3600  IN  NS  a.iana-servers.net.
;; Query time: 12 msec
;; SERVER: 192.168.1.1#53(192.168.1.1)
```
````

**渲染效果**（底部显示各分区记录数，头部显示服务器与耗时）：

```dig
; <<>> DiG 9.18 <<>> example.com
;; global options: +cmd
;; ANSWER SECTION:
example.com.  3600  IN  A  93.184.216.34
example.com.  3600  IN  AAAA  2606:2800:220:1:248:1893:25c8:1946
;; AUTHORITY SECTION:
example.com.  3600  IN  NS  a.iana-servers.net.
;; Query time: 12 msec
;; SERVER: 192.168.1.1#53(192.168.1.1)
```

## BGP

**源码**（`show ip bgp` 前缀表 + `show bgp summary` 邻居表）：

````markdown
```bgp
Network       Next-Hop       Metric LocPrf Weight Path
* 10.0.0.0/8   10.1.1.1       0      100    320 i
  172.16.0.0/12 10.1.1.2      0      100    65000 320 i
* 192.168.0.0/16 10.1.1.3     5      100    320 65000 i

Neighbor        AS     Status     PfxRcvd PfxSent OutQ
10.1.1.1        65000  Established 3       2       0
10.1.1.2        64512  Established 1       1       0
```
````

**渲染效果**（★ 标记 best path，AS Path 渲染为 chips，Established 绿色）：

```bgp
Network       Next-Hop       Metric LocPrf Weight Path
* 10.0.0.0/8   10.1.1.1       0      100    320 i
  172.16.0.0/12 10.1.1.2      0      100    65000 320 i
* 192.168.0.0/16 10.1.1.3     5      100    320 65000 i

Neighbor        AS     Status     PfxRcvd PfxSent OutQ
10.1.1.1        65000  Established 3       2       0
10.1.1.2        64512  Established 1       1       0
```

解析失败回退为源码块，不误识别普通代码块。
