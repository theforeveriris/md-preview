---
title: Bytefield 字节域图
tags: [图表, 协议, 教学]
---

# Bytefield 字节域图

` ```bytefield ` 围栏写入 [bytefield-svg](https://github.com/Deep-Symmetry/bytefield-svg)
的 Clojure DSL，渲染成报文结构图：适合协议首部、寄存器、帧格式与字段布局。
它取代了旧的 ` ```bits ` 位标注块：可以画任意字节宽度、跨字节字段、多行结构、
断行、颜色与底部注释。

常用指令：

- `(def boxes-per-row 16)`：每行格数（最大 16）
- `(draw-column-headers)`：画列号
- `(draw-box "Name" {:span 8})`：字段名与跨格数；`{:height 40}` 控制高度
- `(next-row 30)`：换行并指定行高；`(draw-gap "...")` 画省略断行
- `(defattrs :hdr {:fill "#cce5ff"})` + `[{:span 4} :hdr]`：给字段上色
- `(draw-bottom "说明")`：行的底部注释

## 基础：16 位首部

**源码**：

````markdown
```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Type" {:span 8})
(draw-box "Payload" {:span 8})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Type" {:span 8})
(draw-box "Payload" {:span 8})
```

## 8 位魔数 + 7 位地址

**源码**：

````markdown
```bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box 0x7e {:span 1})
(draw-box "addr" {:span 7})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box 0x7e {:span 1})
(draw-box "addr" {:span 7})
```

## 保留位不画框

**源码**：

````markdown
```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Header" {:span 4})
(draw-box "reserved" {:span 4 :borders #{}})
(draw-box "Body" {:span 8})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Header" {:span 4})
(draw-box "reserved" {:span 4 :borders #{}})
(draw-box "Body" {:span 8})
```

## 给字段上色

**源码**：

````markdown
```bytefield
(defattrs :hdr {:fill "#cce5ff"})
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Flags" [{:span 4} :hdr])
(draw-box "Value" {:span 12})
```
````

**渲染效果**：

```bytefield
(defattrs :hdr {:fill "#cce5ff"})
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Flags" [{:span 4} :hdr])
(draw-box "Value" {:span 12})
```

## 多行结构

**源码**：

````markdown
```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "A" {:span 16})
(next-row 30)
(draw-box "B" {:span 16})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "A" {:span 16})
(next-row 30)
(draw-box "B" {:span 16})
```

## 断行省略

**源码**：

````markdown
```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "A" {:span 16})
(next-row 30)
(draw-gap "...")
(next-row 30)
(draw-box "B" {:span 16})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "A" {:span 16})
(next-row 30)
(draw-gap "...")
(next-row 30)
(draw-box "B" {:span 16})
```

## IPv4 首部前 16 位

**源码**：

````markdown
```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Version" {:span 2})
(draw-box "IHL" {:span 2})
(draw-box "TOS" {:span 4})
(draw-box "Total Length" {:span 8})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Version" {:span 2})
(draw-box "IHL" {:span 2})
(draw-box "TOS" {:span 4})
(draw-box "Total Length" {:span 8})
```

## TCP 首部前 16 位

**源码**：

````markdown
```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Source Port" {:span 8})
(draw-box "Destination Port" {:span 8})
(next-row 30)
(draw-box "Sequence Number" {:span 16})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Source Port" {:span 8})
(draw-box "Destination Port" {:span 8})
(next-row 30)
(draw-box "Sequence Number" {:span 16})
```

## 以太网帧

**源码**：

````markdown
```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Preamble" {:span 4})
(draw-box "SFD" {:span 1})
(draw-box "Dst MAC" {:span 4})
(draw-box "Src MAC" {:span 4})
(draw-box "Type" {:span 1})
(draw-box "Payload" {:span 1})
(draw-box "FCS" {:span 1})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 16)
(draw-column-headers)
(draw-box "Preamble" {:span 4})
(draw-box "SFD" {:span 1})
(draw-box "Dst MAC" {:span 4})
(draw-box "Src MAC" {:span 4})
(draw-box "Type" {:span 1})
(draw-box "Payload" {:span 1})
(draw-box "FCS" {:span 1})
```

## TCP 标志位

**源码**：

````markdown
```bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box "Flags" {:span 8})
(draw-bottom "SYN  ACK  FIN")
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box "Flags" {:span 8})
(draw-bottom "SYN  ACK  FIN")
```

## 高字段：负载区

**源码**：

````markdown
```bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box "Payload" {:span 8 :height 40})
```
````

**渲染效果**：

```bytefield
(def boxes-per-row 8)
(draw-column-headers)
(draw-box "Payload" {:span 8 :height 40})
```
