---
title: 配置语义 diff 示例
tags: [网络, 示例]
---

# 配置语义 diff

` ```config-diff ios `（或 `vrp`）代码块渲染两份配置的**语义**对比：
按缩进层级解析成命令树、以祖先命令链对齐，`===` 分隔线隔开变更前后。
同一条命令挪位置不误报；改参数的命令成对呈现 −旧 +新——升配/迁移 review 神器。

## IOS 接口地址变更

**源码**

````markdown
```config-diff ios
interface GigabitEthernet0/0
 ip address 10.1.1.1 255.255.255.0
 no shutdown
!
interface GigabitEthernet0/1
 ip address 10.1.2.1 255.255.255.0
===变更后
interface GigabitEthernet0/0
 ip address 10.1.1.1 255.255.255.252
 no shutdown
!
interface GigabitEthernet0/1
 ip address 10.1.2.1 255.255.255.0
 shutdown
```
````

**渲染效果**

````config-diff ios
interface GigabitEthernet0/0
 ip address 10.1.1.1 255.255.255.0
 no shutdown
!
interface GigabitEthernet0/1
 ip address 10.1.2.1 255.255.255.0
===变更后
interface GigabitEthernet0/0
 ip address 10.1.1.1 255.255.255.252
 no shutdown
!
interface GigabitEthernet0/1
 ip address 10.1.2.1 255.255.255.0
 shutdown
````

## VRP sysname 与 NTP

**源码**

````markdown
```config-diff vrp
sysname CORE-SW
ntp-service unicast-server 10.10.10.1
===升配后
sysname CORE-SW-NEW
ntp-service unicast-server 10.10.10.1
ntp-service unicast-server 10.10.10.2
```
````

**渲染效果**

````config-diff vrp
sysname CORE-SW
ntp-service unicast-server 10.10.10.1
===升配后
sysname CORE-SW-NEW
ntp-service unicast-server 10.10.10.1
ntp-service unicast-server 10.10.10.2
````
