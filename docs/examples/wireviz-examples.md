---
title: WireViz 线束与接线图
tags: [图表, 硬件, 线束]
---

# WireViz 线束与接线图

` ```wireviz ` 围栏写入 WireViz YAML（连接器、线缆、连接关系），渲染成
接线图 / 线束图。适合硬件接线、机柜配线、传感器与电源线说明。

常用字段：

- `connectors`: 连接器，`type` / `subtype` / `pinlabels`（或旧版的 `pins`）
- `cables`: 线缆，`wirecount` / `wirelabels` / `gauge` / `length` / `color_code` / `shield`
- `connections`: 连接表，每行是若干 `- 连接器或线缆: 引脚列表`
- `options.bgcolor`: 背景色（透明用 `"#ffffff00"`）

> 本页示例按 Kroki 上 WireViz 的语法校验过；连接器请优先用 `pinlabels`，
> 部分版本的 `pins:` 简写还不支持。

## 基础：D-Sub 到 Molex

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"

connectors:
  X1:
    type: D-Sub
    subtype: female
    pinlabels: [DCD, RX, TX, DTR, GND, DSR, RTS, CTS, RI]
  X2:
    type: Molex KK 254
    subtype: female
    pinlabels: [GND, RX, TX]

cables:
  W1:
    gauge: "0.25 mm2"
    length: 0.2
    color_code: DIN
    wirecount: 3
    shield: true

connections:
  -
    - X1: [5,2,3]
    - W1: [1,2,3]
    - X2: [1,3,2]
  -
    - X1: 5
    - W1: s
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"

connectors:
  X1:
    type: D-Sub
    subtype: female
    pinlabels: [DCD, RX, TX, DTR, GND, DSR, RTS, CTS, RI]
  X2:
    type: Molex KK 254
    subtype: female
    pinlabels: [GND, RX, TX]

cables:
  W1:
    gauge: "0.25 mm2"
    length: 0.2
    color_code: DIN
    wirecount: 3
    shield: true

connections:
  -
    - X1: [5,2,3]
    - W1: [1,2,3]
    - X2: [1,3,2]
  -
    - X1: 5
    - W1: s
```

## USB-A 到 USB-C

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  J1:
    type: USB-A
    pinlabels: [VBUS, D-, D+, GND, SHIELD]
  J2:
    type: USB-C
    pinlabels: [VBUS, D-, D+, GND, SHIELD]
cables:
  W1:
    wirecount: 4
    wirelabels: [VBUS, D-, D+, GND]
    gauge: "0.25 mm2"
    length: 1.0
    shield: true
connections:
  -
    - J1: [1,2,3,4]
    - W1: [1,2,3,4]
    - J2: [1,2,3,4]
  -
    - J1: 5
    - W1: s
    - J2: 5
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  J1:
    type: USB-A
    pinlabels: [VBUS, D-, D+, GND, SHIELD]
  J2:
    type: USB-C
    pinlabels: [VBUS, D-, D+, GND, SHIELD]
cables:
  W1:
    wirecount: 4
    wirelabels: [VBUS, D-, D+, GND]
    gauge: "0.25 mm2"
    length: 1.0
    shield: true
connections:
  -
    - J1: [1,2,3,4]
    - W1: [1,2,3,4]
    - J2: [1,2,3,4]
  -
    - J1: 5
    - W1: s
    - J2: 5
```

## RJ45 网线

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  P1:
    type: RJ45
    pinlabels: ["1","2","3","4","5","6","7","8"]
  P2:
    type: RJ45
    pinlabels: ["1","2","3","4","5","6","7","8"]
cables:
  W1:
    wirecount: 8
    wirelabels: [T+,T-,R+,B1,B2,R-,B3,B4]
    length: 2.0
connections:
  -
    - P1: [1,2,3,4,5,6,7,8]
    - W1: [1,2,3,4,5,6,7,8]
    - P2: [1,2,3,4,5,6,7,8]
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  P1:
    type: RJ45
    pinlabels: ["1","2","3","4","5","6","7","8"]
  P2:
    type: RJ45
    pinlabels: ["1","2","3","4","5","6","7","8"]
cables:
  W1:
    wirecount: 8
    wirelabels: [T+,T-,R+,B1,B2,R-,B3,B4]
    length: 2.0
connections:
  -
    - P1: [1,2,3,4,5,6,7,8]
    - W1: [1,2,3,4,5,6,7,8]
    - P2: [1,2,3,4,5,6,7,8]
```

## 音频：TRS 到 RCA

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  J1:
    type: Jack
    subtype: TRS
    pinlabels: [TIP, RING, SLEEVE]
  J2:
    type: RCA
    pinlabels: [SIGNAL, GND]
cables:
  W1:
    wirecount: 2
    wirelabels: [SIGNAL, GND]
    gauge: "0.5 mm2"
connections:
  -
    - J1: [1,3]
    - W1: [1,2]
    - J2: [1,2]
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  J1:
    type: Jack
    subtype: TRS
    pinlabels: [TIP, RING, SLEEVE]
  J2:
    type: RCA
    pinlabels: [SIGNAL, GND]
cables:
  W1:
    wirecount: 2
    wirelabels: [SIGNAL, GND]
    gauge: "0.5 mm2"
connections:
  -
    - J1: [1,3]
    - W1: [1,2]
    - J2: [1,2]
```

## IEC 电源线

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  IN:
    type: IEC C14
    pinlabels: [L, N, PE]
  OUT:
    type: IEC C13
    pinlabels: [L, N, PE]
cables:
  W1:
    wirecount: 3
    wirelabels: [L, N, PE]
    gauge: "1.0 mm2"
    length: 1.8
    color_code: IEC
connections:
  -
    - IN: [1,2,3]
    - W1: [1,2,3]
    - OUT: [1,2,3]
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  IN:
    type: IEC C14
    pinlabels: [L, N, PE]
  OUT:
    type: IEC C13
    pinlabels: [L, N, PE]
cables:
  W1:
    wirecount: 3
    wirelabels: [L, N, PE]
    gauge: "1.0 mm2"
    length: 1.8
    color_code: IEC
connections:
  -
    - IN: [1,2,3]
    - W1: [1,2,3]
    - OUT: [1,2,3]
```

## 多段线束（两根电缆）

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  A:
    type: Molex
    pinlabels: [A1, A2, A3]
  B:
    type: Molex
    pinlabels: [B1, B2]
  C:
    type: JST
    pinlabels: [C1, C2]
cables:
  W1:
    wirecount: 2
    wirelabels: [PWR, GND]
    length: 0.4
  W2:
    wirecount: 2
    wirelabels: [SIG, GND]
    length: 0.6
connections:
  -
    - A: [1,2]
    - W1: [1,2]
    - B: [1,2]
  -
    - A: [3,2]
    - W2: [1,2]
    - C: [1,2]
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  A:
    type: Molex
    pinlabels: [A1, A2, A3]
  B:
    type: Molex
    pinlabels: [B1, B2]
  C:
    type: JST
    pinlabels: [C1, C2]
cables:
  W1:
    wirecount: 2
    wirelabels: [PWR, GND]
    length: 0.4
  W2:
    wirecount: 2
    wirelabels: [SIG, GND]
    length: 0.6
connections:
  -
    - A: [1,2]
    - W1: [1,2]
    - B: [1,2]
  -
    - A: [3,2]
    - W2: [1,2]
    - C: [1,2]
```

## 屏蔽线 + 排流线

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  X1:
    type: Circular
    pinlabels: [PWR, GND, SHLD]
  X2:
    type: Circular
    pinlabels: [PWR, GND, SHLD]
cables:
  W1:
    wirecount: 2
    wirelabels: [PWR, GND]
    shield: true
    length: 0.5
connections:
  -
    - X1: [1,2]
    - W1: [1,2]
    - X2: [1,2]
  -
    - X1: 3
    - W1: s
    - X2: 3
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  X1:
    type: Circular
    pinlabels: [PWR, GND, SHLD]
  X2:
    type: Circular
    pinlabels: [PWR, GND, SHLD]
cables:
  W1:
    wirecount: 2
    wirelabels: [PWR, GND]
    shield: true
    length: 0.5
connections:
  -
    - X1: [1,2]
    - W1: [1,2]
    - X2: [1,2]
  -
    - X1: 3
    - W1: s
    - X2: 3
```

## 三芯传感器线

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  J1:
    type: JST XH
    pinlabels: [VCC, OUT, GND]
  J2:
    type: JST XH
    pinlabels: [VCC, OUT, GND]
cables:
  W1:
    wirecount: 3
    wirelabels: [VCC, OUT, GND]
    length: 0.3
connections:
  -
    - J1: [1,2,3]
    - W1: [1,2,3]
    - J2: [1,2,3]
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  J1:
    type: JST XH
    pinlabels: [VCC, OUT, GND]
  J2:
    type: JST XH
    pinlabels: [VCC, OUT, GND]
cables:
  W1:
    wirecount: 3
    wirelabels: [VCC, OUT, GND]
    length: 0.3
connections:
  -
    - J1: [1,2,3]
    - W1: [1,2,3]
    - J2: [1,2,3]
```

## 电源 + 信号混合线束

**源码**：

````markdown
```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  PSU:
    type: XT60
    pinlabels: [V+, GND]
  ESC:
    type: XT60
    pinlabels: [V+, GND]
  FC:
    type: JST
    pinlabels: [TX, RX, GND]
  RX:
    type: JST
    pinlabels: [TX, RX, GND]
cables:
  W1:
    wirecount: 2
    wirelabels: [V+, GND]
    gauge: "1.5 mm2"
    length: 0.15
  W2:
    wirecount: 3
    wirelabels: [TX, RX, GND]
    length: 0.2
connections:
  -
    - PSU: [1,2]
    - W1: [1,2]
    - ESC: [1,2]
  -
    - FC: [1,2,3]
    - W2: [1,2,3]
    - RX: [1,2,3]
```
````

**渲染效果**：

```wireviz
options:
  bgcolor: "#ffffff00"
connectors:
  PSU:
    type: XT60
    pinlabels: [V+, GND]
  ESC:
    type: XT60
    pinlabels: [V+, GND]
  FC:
    type: JST
    pinlabels: [TX, RX, GND]
  RX:
    type: JST
    pinlabels: [TX, RX, GND]
cables:
  W1:
    wirecount: 2
    wirelabels: [V+, GND]
    gauge: "1.5 mm2"
    length: 0.15
  W2:
    wirecount: 3
    wirelabels: [TX, RX, GND]
    length: 0.2
connections:
  -
    - PSU: [1,2]
    - W1: [1,2]
    - ESC: [1,2]
  -
    - FC: [1,2,3]
    - W2: [1,2,3]
    - RX: [1,2,3]
```
