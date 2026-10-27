---
title: 终端回放与敏感遮罩示例
tags: [网络, 工具]
---

# 终端回放块

` ```terminal `：`$` / `#` 开头的行是命令（逐字打字），其余是输出（逐行闪现）。
播放 / 重播 / 1×-4× 倍速，也可「直接看结果」；跟随系统减动效偏好。

````terminal
$ ssh admin@10.1.1.1
Password:
Core-SW> enable
Core-SW# show ip interface brief | exclude unassigned
Interface              IP-Address      Status                Protocol
GigabitEthernet0/0     10.1.1.1        up                    up
GigabitEthernet0/1     10.1.2.1        up                    up
Core-SW# copy running-config startup-config
Destination filename [startup-config]?
Building configuration...
[OK]
````

# 敏感信息遮罩块

` ```secret ` 点击揭示；` ```secret 口令 ` 输对口令才展开。导出 PDF
（打印）时无论是否已揭示都会保持打码——贴配置藏密码/IP。

## 点击揭示

````secret
enable secret 5 $1$mERr$hx5rVt7rPNoS4wqbXKX7m0
username admin privilege 15 secret 5 $1$mERr$3XKc1mYtGQcK0V0eT1ZmL1
snmp-server community public RO
````

## 口令揭示

````secret 2024
vpn pre-shared-key hex 2A4F6B8C0D1E3F5A7B9C2D4E6F8A0C2E
````

口令就是今年年份（演示用）。
