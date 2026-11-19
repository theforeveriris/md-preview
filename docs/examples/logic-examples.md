---
title: 数字逻辑电路
tags: [图表, 硬件, 教学]
---

# 数字逻辑电路

` ```logic ` 围栏用一套专用 DSL 描述数字电路：门、触发器、寄存器、计数器、
组合逻辑与时序逻辑都能画。解析、布局、SVG 绘制全部在站内完成，不依赖
Mermaid / Graphviz / Kroki 等通用图表工具，也不请求外部渲染服务。

- **自动布局**：按信号深度分列，正交走线；反馈回路从底部绕回。
- **ANSI 符号**：AND / OR / NOT / NAND / NOR / XOR / XNOR / BUF；
  触发器与寄存器画成带引脚的矩形块。
- **真值表**：纯组合电路且输入位不超过 8 位时自动生成，可折叠。
- **交互**：悬停高亮整条网络；工具栏可显示/隐藏引脚名、导出 SVG。
- **诊断**：未定义网络、位宽不匹配、重复驱动、缺少时钟等会给出提示。

---

## 一、语法速查

### 端口

```text
input A, B, Cin
output S, Cout
clock CLK
input D[3:0]
output Q[3:0]
```

- `input` / `output` 声明端口；`clock` 是带时钟标记的输入。
- `name[msb:lsb]` 声明总线，例如 `D[3:0]` 是 4 位。
- 位选：`D[0]`、`D[3:2]`；常量：`0`、`1`。

### 门

```text
and g1 = A, B
or  g2 = A, B
not g3 = A
nand g4 = A, B
nor  g5 = A, B
xor  g6 = A, B
xnor g7 = A, B
buf  g8 = A
```

- `and / or / nand / nor / xor / xnor` 支持两个以上输入。
- 门的输出就是等号左边的网络名；可以直接与 `output` 同名。

### 触发器

```text
dff    ff1 (D, CLK) -> Q, Qn
jkff   ff2 (J, K, CLK) -> Q, Qn
tff    ff3 (T, CLK) -> Q, Qn
srff   ff4 (S, R, CLK) -> Q, Qn
dlatch l1  (D, EN) -> Q, Qn
srlatch l2 (S, R) -> Q, Qn
```

- `dff / jkff / tff` 可在时钟后追加 `RST`；`dff` 还可再加 `SET`。
- 输出可以只写 `Q`，也可以写 `Q, Qn`。

### 块

```text
register r0[4] (D[3:0], CLK, EN, CLR) -> Q[3:0]
counter  c0[4] (CLK, EN, CLR) -> Q[3:0], CO
shiftreg s0[4] (D, CLK, EN, DIR) -> Q[3:0]
mux2     m1 (A, B, S) -> Y
mux4     m2 (D[3:0], S[1:0]) -> Y
decoder  d1[2] (A[1:0], EN) -> Y[3:0]
adder    a1[4] (A[3:0], B[3:0], Cin) -> S[3:0], Cout
connect  Q[0] -> LED0
```

- `register / counter / shiftreg / decoder / adder` 必须写 `name[n]`。
- `register` 输入可省略 `EN` / `CLR`；`counter` 可省略 `EN` / `CLR`，
  或同时给出 `LOAD` 与 `D`；`shiftreg` 可省略 `EN` / `DIR`。
- `connect` 用于把总线位选接到另一个网络，画成一条导线。

### 元数据

```text
title: 4 位计数器
truth: on
pins: on
```

- `truth: on | off | auto`：控制真值表默认是否展开；`auto` 在输入位 ≤ 4 时展开。
- `pins: on | off`：控制引脚名与网络标签是否显示。

---

## 二、基本门

### 与、或、非

**源码**：

````markdown
```logic
input A, B
output Yand, Yor, Ynot

and Yand = A, B
or  Yor  = A, B
not Ynot = A
```
````

**渲染效果**：

```logic
input A, B
output Yand, Yor, Ynot

and Yand = A, B
or  Yor  = A, B
not Ynot = A
```

### 与非、或非、异或、同或

**源码**：

````markdown
```logic
input A, B
output Ynand, Ynor, Yxor, Yxnor

nand Ynand = A, B
nor  Ynor  = A, B
xor  Yxor  = A, B
xnor Yxnor = A, B
```
````

**渲染效果**：

```logic
input A, B
output Ynand, Ynor, Yxor, Yxnor

nand Ynand = A, B
nor  Ynor  = A, B
xor  Yxor  = A, B
xnor Yxnor = A, B
```

### 常量与多输入门

**源码**：

````markdown
```logic
input A
output Y1, Y0

and Y1 = A, 1
or  Y0 = A, 0
```
````

**渲染效果**：

```logic
input A
output Y1, Y0

and Y1 = A, 1
or  Y0 = A, 0
```

> `and` / `or` / `xor` 可以写三个以上输入，例如 `and g = A, B, C`。

---

## 三、组合逻辑

### 半加器

**源码**：

````markdown
```logic
input A, B
output S, C

xor S = A, B
and C = A, B
```
````

**渲染效果**：

```logic
input A, B
output S, C

xor S = A, B
and C = A, B
```

### 全加器

**源码**：

````markdown
```logic
input A, B, Cin
output S, Cout

xor x1 = A, B
xor S  = x1, Cin
and a1 = A, B
and a2 = x1, Cin
or  Cout = a1, a2
```
````

**渲染效果**：

```logic
input A, B, Cin
output S, Cout

xor x1 = A, B
xor S  = x1, Cin
and a1 = A, B
and a2 = x1, Cin
or  Cout = a1, a2
```

### 2:1 多路选择器

**源码**：

````markdown
```logic
input A, B, S
output Y

mux2 m1 (A, B, S) -> Y
```
````

**渲染效果**：

```logic
input A, B, S
output Y

mux2 m1 (A, B, S) -> Y
```

### 4:1 多路选择器

真值表有 64 行，默认收起；点击右上角「真值表」展开。

**源码**：

````markdown
```logic
truth: off
input D[3:0], S[1:0]
output Y

mux4 m1 (D[3:0], S[1:0]) -> Y
```
````

**渲染效果**：

```logic
truth: off
input D[3:0], S[1:0]
output Y

mux4 m1 (D[3:0], S[1:0]) -> Y
```

### 2-4 译码器

**源码**：

````markdown
```logic
input A[1:0], EN
output Y[3:0]

decoder d1[2] (A[1:0], EN) -> Y[3:0]
```
````

**渲染效果**：

```logic
input A[1:0], EN
output Y[3:0]

decoder d1[2] (A[1:0], EN) -> Y[3:0]
```

### 4 位加法器

用 `adder` 块把四个全加器封装成一位宽可配的加法器。输入共 9 位，
超过真值表 8 位上限，因此不生成真值表。

**源码**：

````markdown
```logic
truth: off
input A[3:0], B[3:0], Cin
output S[3:0], Cout

adder a1[4] (A[3:0], B[3:0], Cin) -> S[3:0], Cout
```
````

**渲染效果**：

```logic
truth: off
input A[3:0], B[3:0], Cin
output S[3:0], Cout

adder a1[4] (A[3:0], B[3:0], Cin) -> S[3:0], Cout
```

---

## 四、锁存器与触发器

### NOR 交叉耦合 SR 锁存器

两个 NOR 门交叉连接，形成最基本的 1 位存储单元。反馈线会自动绕到图的下方。

**源码**：

````markdown
```logic
input S, R
output Q, Qn

nor Q  = R, Qn
nor Qn = S, Q
```
````

**渲染效果**：

```logic
input S, R
output Q, Qn

nor Q  = R, Qn
nor Qn = S, Q
```

### 门控 SR 锁存器（块）

**源码**：

````markdown
```logic
input S, R
output Q, Qn

srlatch l1 (S, R) -> Q, Qn
```
````

**渲染效果**：

```logic
input S, R
output Q, Qn

srlatch l1 (S, R) -> Q, Qn
```

### D 触发器

**源码**：

````markdown
```logic
clock CLK
input D, RST, SET
output Q, Qn

dff ff1 (D, CLK, RST, SET) -> Q, Qn
```
````

**渲染效果**：

```logic
clock CLK
input D, RST, SET
output Q, Qn

dff ff1 (D, CLK, RST, SET) -> Q, Qn
```

### JK 触发器

**源码**：

````markdown
```logic
clock CLK
input J, K, RST
output Q, Qn

jkff ff1 (J, K, CLK, RST) -> Q, Qn
```
````

**渲染效果**：

```logic
clock CLK
input J, K, RST
output Q, Qn

jkff ff1 (J, K, CLK, RST) -> Q, Qn
```

### T 触发器

**源码**：

````markdown
```logic
clock CLK
input T
output Q, Qn

tff ff1 (T, CLK) -> Q, Qn
```
````

**渲染效果**：

```logic
clock CLK
input T
output Q, Qn

tff ff1 (T, CLK) -> Q, Qn
```

### 时钟 SR 触发器

**源码**：

````markdown
```logic
clock CLK
input S, R
output Q, Qn

srff ff1 (S, R, CLK) -> Q, Qn
```
````

**渲染效果**：

```logic
clock CLK
input S, R
output Q, Qn

srff ff1 (S, R, CLK) -> Q, Qn
```

---

## 五、寄存器与计数器

### 4 位寄存器（使能 + 异步清零）

**源码**：

````markdown
```logic
clock CLK
input D[3:0], EN, CLR
output Q[3:0]

register r0[4] (D[3:0], CLK, EN, CLR) -> Q[3:0]
```
````

**渲染效果**：

```logic
clock CLK
input D[3:0], EN, CLR
output Q[3:0]

register r0[4] (D[3:0], CLK, EN, CLR) -> Q[3:0]
```

### 4 位移位寄存器

`DIR` 为 0 时左移、为 1 时右移。

**源码**：

````markdown
```logic
clock CLK
input D, EN, DIR
output Q[3:0]

shiftreg s0[4] (D, CLK, EN, DIR) -> Q[3:0]
```
````

**渲染效果**：

```logic
clock CLK
input D, EN, DIR
output Q[3:0]

shiftreg s0[4] (D, CLK, EN, DIR) -> Q[3:0]
```

### 4 位同步计数器

**源码**：

````markdown
```logic
clock CLK
input EN, CLR
output Q[3:0], CO

counter c0[4] (CLK, EN, CLR) -> Q[3:0], CO
```
````

**渲染效果**：

```logic
clock CLK
input EN, CLR
output Q[3:0], CO

counter c0[4] (CLK, EN, CLR) -> Q[3:0], CO
```

### 带加载的计数器

`LOAD` 与 `D` 必须同时给出；`LOAD=1` 时载入 `D`。

**源码**：

````markdown
```logic
clock CLK
input EN, CLR, LOAD, D[3:0]
output Q[3:0], CO

counter c1[4] (CLK, EN, CLR, LOAD, D[3:0]) -> Q[3:0], CO
```
````

**渲染效果**：

```logic
clock CLK
input EN, CLR, LOAD, D[3:0]
output Q[3:0], CO

counter c1[4] (CLK, EN, CLR, LOAD, D[3:0]) -> Q[3:0], CO
```

---

## 六、总线与位选

`D[3:0]` 是 4 位总线，`D[0]` 取最低位。`connect` 把位选接到输出，
不需要额外的门。

**源码**：

````markdown
```logic
input D[3:0]
output Q0, Q3

connect D[0] -> Q0
connect D[3] -> Q3
```
````

**渲染效果**：

```logic
input D[3:0]
output Q0, Q3

connect D[0] -> Q0
connect D[3] -> Q3
```

### 寄存器输出接到 LED

把 4 位寄存器的每一位接到独立输出，用于示意 LED 或测试点。

**源码**：

````markdown
```logic
clock CLK
input D[3:0], EN
output Q[3:0], L0, L1, L2, L3

register r0[4] (D[3:0], CLK, EN) -> Q[3:0]
connect Q[0] -> L0
connect Q[1] -> L1
connect Q[2] -> L2
connect Q[3] -> L3
```
````

**渲染效果**：

```logic
clock CLK
input D[3:0], EN
output Q[3:0], L0, L1, L2, L3

register r0[4] (D[3:0], CLK, EN) -> Q[3:0]
connect Q[0] -> L0
connect Q[1] -> L1
connect Q[2] -> L2
connect Q[3] -> L3
```

---

## 七、组合 + 时序：计数器驱动译码器

计数器输出 `Q[3:0]` 接到 2-4 译码器？这里用低两位 `Q[1:0]` 选择输出，
演示总线位选与组合块混用。译码器输出可直接驱动 LED。

**源码**：

````markdown
```logic
clock CLK
input EN, CLR
output Q[3:0], Y[3:0]

counter c0[4] (CLK, EN, CLR) -> Q[3:0], CO
connect Q[1:0] -> A
decoder d1[2] (A, 1) -> Y[3:0]
```
````

**渲染效果**：

```logic
clock CLK
input EN, CLR
output Q[3:0], Y[3:0]

counter c0[4] (CLK, EN, CLR) -> Q[3:0], CO
connect Q[1:0] -> A
decoder d1[2] (A, 1) -> Y[3:0]
```

> `connect Q[1:0] -> A` 把计数器低两位接到译码器地址总线；`EN` 接常量 `1`。

---

## 八、常见错误与诊断

解析器会尽量把能画的部分画出来，并在图上方列出错误。常见情况：

- 引用了未声明的网络；
- 位宽不匹配，例如把 4 位总线接到单 bit 门输入；
- 同一个网络被两个组件驱动；
- 触发器 / 寄存器没有时钟输入（会给提示，不阻止出图）。

**示例：未定义网络**

````markdown
```logic
input A
output Y

and g1 = A, X
```
````

**渲染效果**：

```logic
input A
output Y

and g1 = A, X
```

---

## 九、已知限制

- 真值表只对**纯组合**且输入位 ≤ 8 的电路生成；时序、带反馈电路会显示提示。
- 自动布局适合教学规模（约 20 个组件以内）；更大的电路建议拆成多个图。
- 总线按整组连接；位选会画成分支，复杂位选可能产生较多交叉。
- 目前不做时序仿真 / 波形，只画电路结构与组合真值表。

---

## 十、完整语法表

| 语句 | 示例 | 说明 |
|------|------|------|
| 输入 | `input A, B` | 单 bit 输入 |
| 总线输入 | `input D[3:0]` | 4 位输入 |
| 输出 | `output Y` | 单 bit 输出 |
| 时钟 | `clock CLK` | 带时钟标记的输入 |
| 门 | `and g1 = A, B` | 输出网络名为 `g1` |
| 多输入门 | `xor g2 = A, B, C` | 支持 2 个以上输入 |
| 触发器 | `dff ff1 (D, CLK) -> Q, Qn` | 可选 RST / SET |
| 寄存器 | `register r0[4] (D[3:0], CLK, EN, CLR) -> Q[3:0]` | 可选 EN / CLR |
| 计数器 | `counter c0[4] (CLK, EN, CLR) -> Q[3:0], CO` | 可加 LOAD + D |
| 移位寄存器 | `shiftreg s0[4] (D, CLK, EN, DIR) -> Q[3:0]` | 可选 EN / DIR |
| 多路选择 | `mux2 m1 (A, B, S) -> Y` | `mux4` 用 4 位 D + 2 位 S |
| 译码器 | `decoder d1[2] (A[1:0], EN) -> Y[3:0]` | 输出 2^n 位 |
| 加法器 | `adder a1[4] (A[3:0], B[3:0], Cin) -> S[3:0], Cout` | 位宽可配 |
| 连线 | `connect Q[0] -> LED0` | 位选 / 网络别名 |
| 元数据 | `truth: on` / `pins: off` / `title: ...` | 控制显示 |
