---
title: LLDP / CDP 邻居拓扑
tags: [网络, 拓扑]
---

# LLDP / CDP 邻居拓扑

粘贴 `show lldp neighbors` / `show cdp neighbors` 输出，即可得到可交互拓扑图。

## Cisco LLDP

**源码**（直接粘贴 `show lldp neighbors` 输出， Capability codes 段可留可去）：

````markdown
```lldp
Capability codes:
	(R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device
	(W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other

Device ID           Local Intf     Hold-time  Capability      Port ID
core01              Gi0/0/1        120        BR              Gi0/0/24
sw-access-02        Gi0/0/2        120        B               Gi0/0/5
sw-access-03        Gi0/0/3        120        B               Gi0/0/6
```
````

**渲染效果**（本设备为主题色节点，双击可切换布局）：

```lldp
Capability codes:
	(R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device
	(W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other

Device ID           Local Intf     Hold-time  Capability      Port ID
core01              Gi0/0/1        120        BR              Gi0/0/24
sw-access-02        Gi0/0/2        120        B               Gi0/0/5
sw-access-03        Gi0/0/3        120        B               Gi0/0/6
```

## CDP 邻居

**源码**：

````markdown
```cdp
Device ID        Local Int  Port      Hold-time  Capability  Platform
core01           Gi0/0/1    Gi0/0/24  165        R S I       SW-1
sw-access-02     Gi0/0/2    Gi0/0/5   165        B S         S2960
```
````

**渲染效果**：

```cdp
Device ID        Local Int  Port      Hold-time  Capability  Platform
core01           Gi0/0/1    Gi0/0/24  165        R S I       SW-1
sw-access-02     Gi0/0/2    Gi0/0/5   165        B S         S2960
```

交互说明：节点悬停或点击会高亮邻居链路（点本设备恢复），顶部按钮切换**环形 / 同心**布局，**导出 SVG** 下载当前图；双向边自动去重，边标签为 `本端口 ↔ 对端口`。解析失败回退为源码块。
