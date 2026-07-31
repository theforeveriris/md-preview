# PKT 华为 VRP 命令解析示例

> ⚠️ **重要说明：PKT 渲染器当前的解析逻辑并不是特别健壮。**
>
> PKT 拓扑渲染器（`iris/js/pkt/pkt-renderer.js`）中"可能的配置过程"推算逻辑基于**正则表达式 + 段落分割**实现，并非真正的语法解析器。它对常见的、格式规范的 VRP 配置文本能给出合理的步骤拆分，但在以下情况下**可能产生错误、遗漏或乱序**：
>
> - 配置文本被压缩、加密或经过非标准格式化（多余空格、Tab/空格混用、换行符不统一等）
> - 使用了未覆盖的协议（如 MPLS、OSPFv3、policy-based routing、QoS、802.1X、port-security、DHCP snooping、IPv6 NAT、IPSec 等）。**注**：常见协议如 OSPF/BGP/IS-IS/RIP/ACL/NAT/DHCP/VRRP/AAA/SSH/NTP/SNMP/STP 等均已支持，BGP 地址族子视图（ipv4-family / ipv6-family / address-family）也已支持
> - 深层嵌套子视图（如 OSPF Sham-Link、IS-IS multi-topology、BGP VPNv4 内的 peer-group 模板等）提示符可能错位
> - 厂商判定（Huawei vs Cisco）在混合风格配置上发生误判
>
> **近期已修复**（v6.17）：命令缩写归一化（`int`→`interface` 等）、`#` 分隔符缺失时自动 fallback 到缩进切分、OSPF 多进程 VRF 区分、BGP 地址族子视图提示符。详见文末"已知限制与已解决项"。
>
> 因此，**PKT 生成的步骤仅适合作为学习/复习参考，不能作为配置迁移或实际设备部署的依据**。如需精确还原，请以设备 `display current-configuration` 的原始输出为准。

---

## 一、PKT 解析器的工作流程

`pkt-renderer.js` 中的 `generateHuaweiSteps(configText, devName, devType)` 负责把一段 VRP 配置文本转换成有序的"配置步骤"。整体流程：

1. **提取 sysname**：从 `sysname XXX` 行取出设备名，用于构造各视图提示符（如 `[R3-GigabitEthernet0/0/0]`）。
2. **分段**：以 `#` 为分隔符，将配置切成若干 section，每个 section 包含一个 `header`（首行命令）和 `body`（后续缩进行）。
3. **分类收集**：遍历所有 section，按 header 的模式识别出 VLAN / 接口 / OSPF / IS-IS / BGP / RIP / ACL / 静态路由 / IPv6 路由 / NAT 地址组 / DHCP 池 / IP 前缀列表 / Route-policy / STP / NTP / SNMP / AAA / SSH-VTY 等模块。
4. **按固定顺序生成步骤**：进入系统视图 → VLAN → 接口 → IS-IS → OSPF → BGP → RIP → 静态路由 → ACL → IPv6 路由 → NAT → DHCP → 前缀列表 → 路由策略 → STP → NTP → SNMP → AAA → SSH/VTY → 保存。
5. **拼装提示符**：每个命令前加上对应视图的提示符，还原交互式 CLI 体验。

---

## 二、示例输入

下面是一段典型的华为 VRP 配置（综合了 OSPF、BGP、ACL、NAT、DHCP、VRRP 等常见特性）：

```text
#
sysname R3
#
interface GigabitEthernet0/0/0
 ip address 10.0.1.1 255.255.255.0
 description to-LAN
 vrrp vrid 10 virtual-ip 10.0.1.254
 vrrp vrid 10 priority 120
 vrrp vrid 10 preempt-mode
#
interface GigabitEthernet0/0/1
 ip address 200.1.1.1 255.255.255.252
 nat outbound 2001
#
interface LoopBack0
 ip address 3.3.3.3 255.255.255.255
#
acl number 2001
 rule 5 permit source 10.0.1.0 0.0.0.255
#
ospf 1
 area 0.0.0.0
  network 10.0.1.0 0.0.0.255
  abr-summary 10.0.0.0 255.255.0.0
 default-route-advertise always
 silent-interface GigabitEthernet0/0/1
#
bgp 65001
 peer 200.1.1.2 as-number 65002
 ipv4-family unicast
  peer 200.1.1.2 enable
  peer 200.1.1.2 route-policy RP10 export
  peer 200.1.1.2 next-hop-local
  aggregate 10.0.0.0 255.255.0.0
#
ip route-static 0.0.0.0 0.0.0.0 200.1.1.2
#
ip ip-prefix P10 index 10 permit 10.0.0.0 16
#
route-policy RP10 permit node 10
 if-match ip-prefix P10
#
dhcp enable
#
ip pool LAN10
 gateway-list 10.0.1.1
 network 10.0.1.0 mask 255.255.255.0
#
ntp-service unicast-server 200.1.1.2
#
snmp-agent community read Public
snmp-agent sys-info version v2c
#
aaa
 local-user admin password cipher Admin@123
 local-user admin privilege level 15
 local-user admin service-type telnet
#
stelnet server enable
ssh user admin authentication-type password
ssh user admin service-type stelnet
#
user-interface vty 0 4
 authentication-mode aaa
#
return
```

---

## 三、PKT 解析后的输出步骤

PKT 解析器会把上述输入转换为下列步骤（仅展示关键步骤，提示符按 `[R3-...]` 风格还原）：

### 步骤 1：进入系统视图

```text
<Huawei>system-view
[Huawei]sysname R3
[R3]
```

### 步骤 2：配置接口

```text
[R3]interface GigabitEthernet0/0/0
[R3-GigabitEthernet0/0/0]description to-LAN
[R3-GigabitEthernet0/0/0]ip address 10.0.1.1 255.255.255.0
[R3-GigabitEthernet0/0/0]vrrp vrid 10 virtual-ip 10.0.1.254
[R3-GigabitEthernet0/0/0]vrrp vrid 10 priority 120
[R3-GigabitEthernet0/0/0]vrrp vrid 10 preempt-mode
[R3-GigabitEthernet0/0/0]undo shutdown
[R3-GigabitEthernet0/0/0]quit
[R3]interface GigabitEthernet0/0/1
[R3-GigabitEthernet0/0/1]ip address 200.1.1.1 255.255.255.252
[R3-GigabitEthernet0/0/1]nat outbound 2001
[R3-GigabitEthernet0/0/1]undo shutdown
[R3-GigabitEthernet0/0/1]quit
[R3]interface LoopBack0
[R3-LoopBack0]ip address 3.3.3.3 255.255.255.255
[R3-LoopBack0]undo shutdown
[R3-LoopBack0]quit
```

> VRRP 三条子命令按原文顺序原样保留；接口在有 IP 时自动追加 `undo shutdown`。

### 步骤 3：配置 OSPF 进程 1

```text
[R3]ospf 1
[R3-ospf-1]area 0.0.0.0
[R3-ospf-1-area-0.0.0.0]network 10.0.1.0 0.0.0.255
[R3-ospf-1-area-0.0.0.0]abr-summary 10.0.0.0 255.255.0.0
[R3-ospf-1-area-0.0.0.0]quit
[R3-ospf-1]default-route-advertise always
[R3-ospf-1]silent-interface GigabitEthernet0/0/1
[R3-ospf-1]quit
```

> 关键点：当遇到 `default-route-advertise`、`silent-interface` 等**进程级命令**时，PKT 解析器会先调用 `exitArea()` 退出 area 子视图，再以 `[R3-ospf-1]` 提示符输出，避免把进程级命令误放到 area 视图下。

### 步骤 4：配置 BGP

```text
[R3]bgp 65001
[R3-bgp]peer 200.1.1.2 as-number 65002
[R3-bgp]ipv4-family unicast
[R3-bgp-af]peer 200.1.1.2 enable
[R3-bgp-af]peer 200.1.1.2 route-policy RP10 export
[R3-bgp-af]peer 200.1.1.2 next-hop-local
[R3-bgp-af]aggregate 10.0.0.0 255.255.0.0
[R3-bgp-af]quit
[R3-bgp]quit
```

### 步骤 5：配置静态路由

```text
[R3]ip route-static 0.0.0.0 0.0.0.0 200.1.1.2
```

### 步骤 6：配置 ACL

```text
[R3]acl number 2001
[R3-acl-basic-2001]rule 5 permit source 10.0.1.0 0.0.0.255
[R3-acl-basic-2001]quit
```

> ACL 编号 2001 落在 2000–2999 区间，PKT 识别为基本 ACL，提示符使用 `[R3-acl-basic-2001]`；若编号为 3000–3999 则使用 `[R3-acl-adv-XXXX]`。

### 步骤 7：配置 IP 前缀列表

```text
[R3]ip ip-prefix P10 index 10 permit 10.0.0.0 16
```

### 步骤 8：配置路由策略

```text
[R3]route-policy RP10 permit node 10
[R3-route-policy-RP10-10]if-match ip-prefix P10
[R3-route-policy-RP10-10]quit
```

### 步骤 9：配置 DHCP 服务器地址池

```text
[R3]dhcp enable
[R3]ip pool LAN10
[R3-ip-pool-LAN10]gateway-list 10.0.1.1
[R3-ip-pool-LAN10]network 10.0.1.0 mask 255.255.255.0
[R3-ip-pool-LAN10]quit
```

### 步骤 10：配置 NTP

```text
[R3]ntp-service unicast-server 200.1.1.2
```

### 步骤 11：配置 SNMP

```text
[R3]snmp-agent community read Public
[R3]snmp-agent sys-info version v2c
```

### 步骤 12：配置 AAA 与本地用户

```text
[R3]aaa
[R3-aaa]local-user admin password cipher Admin@123
[R3-aaa]local-user admin privilege level 15
[R3-aaa]local-user admin service-type telnet
[R3-aaa]quit
```

### 步骤 13：配置 SSH/VTY

```text
[R3]stelnet server enable
[R3]ssh user admin authentication-type password
[R3]ssh user admin service-type stelnet
[R3]user-interface vty 0 4
[R3-ui-vty0-4]authentication-mode aaa
[R3-ui-vty0-4]quit
```

### 步骤 14：保存配置

```text
<R3>save
```

---

## 四、PKT 识别规则速查

| 模块 | 触发 header / 行 | 解析要点 |
|------|------------------|----------|
| VLAN | `vlan N` / `vlan batch N1 N2` | 支持 `batch` 多个 ID 和 `N-M` 范围；body 中的 `name XXX` 提取为 VLAN 名 |
| 接口 | `interface NAME` | 收集 ip/description/link-protocol/isis enable/ospf enable/port link-type/trunk allow-pass/vrrp/eth-trunk/dhcp select/nat/mtu/ipv6/dot1q 等 |
| OSPF | `ospf N` | area 子视图收集 network/abr-summary/stub/nssa/range/virtual-link/authentication；进程级命令 default-route-advertise/silent-interface/preference/bandwidth-reference 会先退出 area |
| IS-IS | `isis N` | 逐行解析 is-level/network-entity/cost-style/import-route/filter-policy/preference/flash-flood/silent-interface |
| BGP | `bgp AS` | peer 行 + ipv4-family 子视图下的 peer 属性 + aggregate/import-route 等 |
| RIP | `rip N` | version/network/peer/import-route/filter-policy/preference/maximum/timers |
| 静态路由 | `ip route-static ...` | 全局正则扫描，可在任意位置出现 |
| ACL | `acl number N` / `acl name FOO [advance\|basic]` | 按 number 范围推断 basic/adv；命名 ACL 按 advance/basic 字段决定提示符 |
| 前缀列表 | `ip ip-prefix NAME index N permit/deny X Y` | 全局正则扫描 |
| 路由策略 | `route-policy NAME permit/deny node N` | 收集 body 中的 if-match/apply 行 |
| DHCP 池 | `ip pool NAME` | gateway-list/network/lease/dns-list 等 body 行原样输出 |
| NAT 地址组 | `nat address-group N X.X.X.X Y.Y.Y.Y` | 全局正则扫描 |
| NTP | `ntp-service unicast-server X` | 单行命令 |
| SNMP | `snmp-agent community ...` / `snmp-agent sys-info ...` | 多行收集 |
| STP | `stp mode/priority/enable` | 多行收集 |
| AAA | `aaa` 块 | 收集 local-user/password/privilege/service-type |
| SSH/VTY | `stelnet server enable` / `ssh user ...` / `user-interface vty ...` | 分散行收集后统一输出 |

---

## 五、PKT 已知限制与已解决项

### ✅ 已解决的问题（v6.17）

下列问题在近期更新中已修复：

1. **命令缩写**：`normalizeAbbreviations()` 在生成步骤前对配置文本做行首缩写归一化，支持 `int`→`interface`、`osp`→`ospf`、`bg`→`bgp`、`rou`→`router`、`router osp`→`router ospf`、`ip add`→`ip address`、`no sh`→`no shutdown` 等常见缩写。每行最多应用一条规则，避免链式误伤；`show`、`address` 等全称不会被误改。
2. **`#` 分隔符依赖**：`splitConfigSections()` 现在会检测 `#` 分隔符的出现频率，若占比过低（< 10% 或不足 3 个），自动 fallback 到**基于缩进的段落切分**（未缩进行=header，缩进行=body）。直接粘贴 `display current-configuration` 部分输出也能正确切分。
3. **多进程 VRF 区分**：OSPF 解析现支持 `ospf N vpn-instance NAME`（华为）/ `router ospf N vrf NAME`（思科），步骤标题会显示 `(VPN-instance: NAME)` / `(VRF: NAME)`，进入命令也带上对应参数。
4. **BGP 地址族子视图**：BGP 解析现支持地址族切换，正确切换提示符：
   - 华为：`ipv4-family unicast`→`[host-bgp-af]`、`ipv4-family vpnv4`→`[host-bgp-af-vpnv4]`、`ipv4-family vpn-instance NAME`→`[host-bgp-af-NAME]`、`ipv6-family unicast`→`[host-bgp-af-ipv6]`
   - 思科：`address-family ipv4/ipv6/vpnv4/vpnv6 [vrf NAME] [unicast]`→`(config-router-af)#`，`exit-address-family` 退出
   - 切换地址族前自动 `quit` / `exit-address-family` 退出当前地址族

### ⚠️ 仍然存在的限制

下列情况**当前 PKT 解析器仍不能正确处理**：

1. **未实现的协议**：MPLS / MPLS L3VPN / OSPFv3 / policy-based routing / QoS / 802.1X / port-security / DHCP snooping / IPv6 NAT / IPSec 等命令会被**静默丢弃**，不出现在步骤中。（注：BGP IPv6 单播已通过 `ipv6-family` 支持）
2. **深层嵌套视图**：虽然 BGP 地址族子视图已支持，但更深层嵌套（如 OSPF Sham-Link、IS-IS multi-topology、BGP VPNv4 内的 peer-group 模板等）提示符仍可能错位。
3. **顺序问题**：PKT **强制按固定顺序**输出步骤（VLAN → 接口 → IS-IS → OSPF → ...），与原始配置在文件中的先后顺序可能不一致。这是**有意设计**——按配置最佳实践重组，对学习者更友好；但意味着依赖顺序的命令在视觉上可能显得"跳"。
4. **大小写还原**：所有正则使用 `i` 标志做大小写不敏感匹配，但提示符中的视图名严格按原文大小写还原。这其实是**正确行为**——设备上 sysname 就是按用户输入的大小写显示。
5. **加密配置**：`password cipher XXX` 中的密文会原样输出。这是 VRP 的安全设计——`cipher` 是单向哈希，**技术上无法解密**，设备本身也只能显示密文。

如需扩展某个未覆盖的协议，可在 `generateHuaweiSteps` 中按"收集 → 生成"两段式添加对应逻辑，并在 `splitConfigSections` 后的遍历循环中新增 header 匹配分支。
