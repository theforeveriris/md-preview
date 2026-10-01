# Cisco IOS / 华为 VRP 配置高亮示例

内置两个网络设备配置语法包：`ios`（Cisco IOS / IOS-XE）与 `vrp`（华为 VRP）。命令关键字、注释、字符串与地址分级着色，与内置 10 套代码高亮主题自动兼容。

## Cisco IOS（```ios）

```ios
! 接口配置
interface GigabitEthernet0/0/1
 description TO-CORE-SW-01
 ip address 10.0.0.1 255.255.255.252
 ip ospf 1 area 0
 no shutdown
!
! OSPF 进程
router ospf 1
 router-id 1.1.1.1
 network 10.0.0.0 0.0.0.3 area 0
 passive-interface default
 no passive-interface GigabitEthernet0/0/1
!
! ACL 与 NAT
ip access-list extended LAN-OUT
 permit ip 192.168.0.0 0.0.255.255 any
 deny   ip any any log
!
ip route 0.0.0.0 0.0.0.0 203.0.113.1
!
line vty 0 4
 transport input ssh
 login local
!
banner motd # Authorized access only! #
end
```

语法说明：

- `!` 开头的行按注释着色（`show running-config` 的分段线同款）
- `banner motd #...#` 这类以 `#` 界定的标语：界符内的 `!` 不会误判为注释，建议用引号或注意排版
- 关键字不区分大小写，`interface` / `INTERFACE` 均可

## 别名 ```cisco

```cisco
hostname edge-rtr-01
enable secret 9 $9$xxxx
username admin privilege 15 secret 9 $9$yyyy
crypto key generate rsa modulus 2048
ip domain-name example.com
```

## 华为 VRP（```vrp）

```vrp
# sysname core-sw-01
#
vlan batch 10 20 30
#
interface GigabitEthernet0/0/1
 description TO-AGG-SW-01
 port link-type trunk
 port trunk allow-pass vlan 10 20 30
 stp root secondary
#
# OSPF
ospf 1 router-id 1.1.1.1
 area 0.0.0.0
  network 10.0.0.0 0.0.0.3
#
# ACL
acl number 3000
 rule 5 permit ip source 192.168.0.0 0.0.255.255
 rule 10 deny ip
#
ip route-static 0.0.0.0 0.0.0.0 203.0.113.1
#
user-interface vty 0 4
 authentication-mode aaa
 protocol inbound ssh
#
return
```

语法说明：

- `#` 开头的行按注释着色（VRP 配置的分段符同款）
- `display` / `undo` / `port link-type` 等 VRP 特有关键字均在词表内

## 别名 ```huawei

```huawei
sysname agg-sw-01
dhcp enable
interface Vlanif10
 ip address 192.168.10.1 255.255.255.0
 dhcp select relay
 dhcp relay server-ip 10.0.4.5
```
