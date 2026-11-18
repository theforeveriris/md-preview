---
title: WaveDrom 时序图示例
tags: [图表, 波形, 硬件]
---

# WaveDrom 时序图

` ```wavedrom ` 围栏写入 WaveJSON，渲染为数字时序图（SVG）。适合总线、
握手、时钟与协议帧的说明；由 Kroki 的 wavedrom 服务出图，失败时保留源码。

WaveJSON 常用字段：

- `signal`: 信号数组，每项 `{name, wave, data, node, period, phase}`
- `wave`: 波形串，`0/1` 低/高、`p/n` 上升/下降时钟、`x` 未知、`z` 高阻、
  `.` 延续、`|` 间隔、`2`-`9` 彩色状态
- `data`: 与 `3/4/5…` 数据段对齐的标签数组
- `edge`: 箭头关系，如 `'a~>b'`；`node`: 在波形上打点名
- `head` / `foot`: 标题与脚注；`config.hscale` 控制横向缩放

## 时钟与数据总线

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'clk', wave:'p....'},
  {name:'bus', wave:'x345x', data:'head body tail'},
  {name:'data', wave:'0.1..0'}
]}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'clk', wave:'p....'},
  {name:'bus', wave:'x345x', data:'head body tail'},
  {name:'data', wave:'0.1..0'}
]}
```

## Valid / Ready 握手

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'clk', wave:'p......'},
  {name:'valid', wave:'01...0.'},
  {name:'ready', wave:'0.1...0'},
  {name:'data', wave:'x.3.4.x', data:['D0','D1']}
], head:{text:'Valid / Ready 握手'}}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'clk', wave:'p......'},
  {name:'valid', wave:'01...0.'},
  {name:'ready', wave:'0.1...0'},
  {name:'data', wave:'x.3.4.x', data:['D0','D1']}
], head:{text:'Valid / Ready 握手'}}
```

## SPI 传输

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'sclk', wave:'p....|...'},
  {name:'mosi', wave:'0.1.0|1..', data:['b7','b6']},
  {name:'cs_n', wave:'10...|1..'}
]}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'sclk', wave:'p....|...'},
  {name:'mosi', wave:'0.1.0|1..', data:['b7','b6']},
  {name:'cs_n', wave:'10...|1..'}
]}
```

## I²C 起始与数据

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'scl', wave:'1.0.1.0.1.0.1'},
  {name:'sda', wave:'10.1.0..1.0'},
  {name:'start', wave:'0....1....'}
]}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'scl', wave:'1.0.1.0.1.0.1'},
  {name:'sda', wave:'10.1.0..1.0'},
  {name:'start', wave:'0....1....'}
]}
```

## UART 帧

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'uart', wave:'1.0.10101010.1', data:'start b0 b1 b2 b3 b4 b5 b6 b7 stop'}
]}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'uart', wave:'1.0.10101010.1', data:'start b0 b1 b2 b3 b4 b5 b6 b7 stop'}
]}
```

## PWM 占空比

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'pwm', wave:'0.1.0.1.0.1.0.1'}
]}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'pwm', wave:'0.1.0.1.0.1.0.1'}
]}
```

## DDR 采样

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'clk', wave:'p....'},
  {name:'dqs', wave:'0.1.0.1.'},
  {name:'dq', wave:'x3x4x5x', data:'A B C'}
]}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'clk', wave:'p....'},
  {name:'dqs', wave:'0.1.0.1.'},
  {name:'dq', wave:'x3x4x5x', data:'A B C'}
]}
```

## 状态机（彩色状态）

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'state', wave:'2345678', data:'IDLE INIT RUN WAIT DONE'}
], config:{hscale:2}}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'state', wave:'2345678', data:'IDLE INIT RUN WAIT DONE'}
], config:{hscale:2}}
```

## 箭头与注释

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'req', wave:'0.1..', node:'.a..'},
  {name:'ack', wave:'0..1.', node:'...b'}
], edge:['a~>b'], foot:{text:'请求 - 应答'}}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'req', wave:'0.1..', node:'.a..'},
  {name:'ack', wave:'0..1.', node:'...b'}
], edge:['a~>b'], foot:{text:'请求 - 应答'}}
```

## 相位与周期

**源码**：

````markdown
```wavedrom
{signal:[
  {name:'clk', wave:'p..', period:2, phase:0.5},
  {name:'en', wave:'0.1'}
]}
```
````

**渲染效果**：

```wavedrom
{signal:[
  {name:'clk', wave:'p..', period:2, phase:0.5},
  {name:'en', wave:'0.1'}
]}
```
