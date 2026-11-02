---
title: 日志与 CLI 输出渲染
tags: [日志, 网络]
---

# 日志与 CLI 输出渲染

## 日志块

`log` 围栏自动识别时间戳、主机、进程、级别，并支持级别筛选（错误/警告/信息/调试）、关键字过滤与导出 CSV。

**源码**（混排 syslog 传统格式、ISO 时间戳格式与 JSON 行）：

````markdown
```log
Mar  1 12:00:01 core01 sshd[2451]: Accepted publickey for deploy
Mar  1 12:00:05 core01 systemd[1]: Started Session 42 of user deploy
2026-11-02T10:00:00.000Z core01 api[881]: INFO request handled in 12ms
2026-11-02T10:00:01.000Z core01 api[881]: WARN slow query 1.8s
2026-11-02T10:00:02.000Z core01 api[881]: ERROR upstream timed out
{"timestamp":"2026-11-02T10:00:03.000Z","level":"debug","logger":"worker","message":"poll tick"}
```
````

**渲染效果**（点级别 chip 筛掉对应级别；右侧计数实时显示可见行数）：

```log
Mar  1 12:00:01 core01 sshd[2451]: Accepted publickey for deploy
Mar  1 12:00:05 core01 systemd[1]: Started Session 42 of user deploy
2026-11-02T10:00:00.000Z core01 api[881]: INFO request handled in 12ms
2026-11-02T10:00:01.000Z core01 api[881]: WARN slow query 1.8s
2026-11-02T10:00:02.000Z core01 api[881]: ERROR upstream timed out
{"timestamp":"2026-11-02T10:00:03.000Z","level":"debug","logger":"worker","message":"poll tick"}
```

## CLI 表格

`clitable` 围栏把 `show` 系列输出变成可排序表格（复用统一表格工具条）。

**源码**（表头 + 分隔行）：

````markdown
```clitable
Interface     Description     Admin Status    Operational Status
----          -----------     -------------   -------------------
GigabitEthernet0/0/1  Uplink to core  up            up
GigabitEthernet0/0/2  DVR camera       up            up
GigabitEthernet0/0/3  spare            down          down
```
````

**渲染效果**：

```clitable
Interface     Description     Admin Status    Operational Status
----          -----------     -------------   -------------------
GigabitEthernet0/0/1  Uplink to core  up            up
GigabitEthernet0/0/2  DVR camera       up            up
GigabitEthernet0/0/3  spare            down          down
```

**源码**（键值输出也能识别）：

````markdown
```clitable
Vlan ID: 100
Vlan Name: mgmt
MTU: 1500
Primary MAC: 00-11-22-33-44-55
```
````

**渲染效果**：

```clitable
Vlan ID: 100
Vlan Name: mgmt
MTU: 1500
Primary MAC: 00-11-22-33-44-55
```

无法解析的输出会原样保留为代码块，不影响其他块渲染。
