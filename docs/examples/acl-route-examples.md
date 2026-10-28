---
title: ACL 与路由表分析示例
tags: [网络, 工具]
---

# ACL 分析块

` ```acl ` 粘贴 IOS/VRP ACL：渲染匹配顺序表 + 五元组命中测试。自上而下
模拟求值，第一条命中即返回；无命中提示隐式 deny——排查「为什么这条流量
被拒」不用再肉眼逐条比对了。

## 命名 ACL（序号行）

**源码**

````markdown
```acl ios
10 permit tcp 10.1.1.0 0.0.0.255 any eq 443
20 permit tcp 10.1.1.0 0.0.0.255 host 8.8.8.8 eq 53
30 permit udp any host 8.8.8.8 eq 53
40 deny ip any any
```
````

**渲染效果**

````acl ios
10 permit tcp 10.1.1.0 0.0.0.255 any eq 443
20 permit tcp 10.1.1.0 0.0.0.255 host 8.8.8.8 eq 53
30 permit udp any host 8.8.8.8 eq 53
40 deny ip any any
````

点「测试」改源/目的/端口试试：`10.1.1.8 → 8.8.8.8:53` 命中第 2 条；
`10.1.1.8 → 1.1.1.1:80` 落入第 4 条显式 deny；换成没写 deny 的 ACL
则提示隐式 deny。

# 路由表分析块

` ```route-table ` 粘贴 `show ip route` 输出：可排序表 + 协议分布统计。

**源码**

````markdown
```route-table
Codes: L - local, C - connected, S - static, O - OSPF, B - BGP

Gateway of last resort is 10.1.1.254 to network 0.0.0.0

C    10.1.1.0/24 is directly connected, GigabitEthernet0/0
L    10.1.1.1/32 is directly connected, GigabitEthernet0/0
O    10.2.0.0/16 [110/20] via 10.1.1.2, 00:12:34, GigabitEthernet0/0
O E2 192.168.50.0/24 [110/20] via 10.1.1.2, 00:12:34, GigabitEthernet0/0
S*   0.0.0.0/0 [1/0] via 10.1.1.254
B    172.16.0.0/16 [200/0] via 10.1.1.3, 00:05:00
S    10.99.0.0/16 [1/0] via 10.1.1.9
```
````

**渲染效果**

````route-table
Codes: L - local, C - connected, S - static, O - OSPF, B - BGP

Gateway of last resort is 10.1.1.254 to network 0.0.0.0

C    10.1.1.0/24 is directly connected, GigabitEthernet0/0
L    10.1.1.1/32 is directly connected, GigabitEthernet0/0
O    10.2.0.0/16 [110/20] via 10.1.1.2, 00:12:34, GigabitEthernet0/0
O E2 192.168.50.0/24 [110/20] via 10.1.1.2, 00:12:34, GigabitEthernet0/0
S*   0.0.0.0/0 [1/0] via 10.1.1.254
B    172.16.0.0/16 [200/0] via 10.1.1.3, 00:05:00
S    10.99.0.0/16 [1/0] via 10.1.1.9
````
