---
title: Kroki 与 Vega-Lite
tags: [图表, Kroki, Vega]
---

# Kroki 与 Vega-Lite

## Kroki 通用入口

一个 `kroki` 入口支持 Blockdiag / Seqdiag / Actdiag / Nwdiag / Packetdiag /
Rackdiag / Bytefield / Ditaa / Erd / Graphviz / Nomnoml / Svgbob / Umlet 等：
fence 信息串第二个 token 是图类型，正文为图源码。

**源码**（blockdiag：节点标签用 `label="…"` 紧贴引号写法）：

````markdown
```kroki blockdiag
{
  orientation = portrait
  A[label="客户端"];
  B[label="网关"];
  C[label="认证服务"];
  D[label="业务服务"];
  E[label="数据库"];
  A -> B; B -> C; B -> D; C -> E;
}
```
````

**渲染效果**：

```kroki blockdiag
{
  orientation = portrait
  A[label="客户端"];
  B[label="网关"];
  C[label="认证服务"];
  D[label="业务服务"];
  E[label="数据库"];
  A -> B; B -> C; B -> D; C -> E;
}
```

**源码**（seqdiag：边标签用 `[label="…"]`）：

````markdown
```kroki seqdiag
{
  client -> gateway [label="GET /api"];
  gateway -> auth [label="校验"];
  auth -> gateway [label="通过"];
  gateway -> db [label="查询"];
  gateway -> client [label="响应"];
}
```
````

**渲染效果**：

```kroki seqdiag
{
  client -> gateway [label="GET /api"];
  gateway -> auth [label="校验"];
  auth -> gateway [label="通过"];
  gateway -> db [label="查询"];
  gateway -> client [label="响应"];
}
```

**源码**（nwdiag 拓扑网）：

````markdown
```kroki nwdiag
nwdiag {
  network dmz {
    web01 [label = "Web 01"];
    web02 [label = "Web 02"];
  }
  network core {
    gw01 [label = "网关"];
  }
}
```
````

**渲染效果**：

```kroki nwdiag
nwdiag {
  network dmz {
    web01 [label = "Web 01"];
    web02 [label = "Web 02"];
  }
  network core {
    gw01 [label = "网关"];
  }
}
```

**源码**（actdiag 活动图）：

````markdown
```kroki actdiag
actdiag {
  write -> review -> publish
  lane user {
    write [label = "写文档"];
    publish [label = "发布"];
  }
  lane team {
    review [label = "评审"];
  }
}
```
````

**渲染效果**：

```kroki actdiag
actdiag {
  write -> review -> publish
  lane user {
    write [label = "写文档"];
    publish [label = "发布"];
  }
  lane team {
    review [label = "评审"];
  }
}
```

## Vega-Lite

**源码**（JSON 规范；渲染 treemap / density / facet / transform 等 ApexCharts 覆盖不到的图，vega 系列按需从 CDN 懒加载）：

````markdown
```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple bar chart",
  "data": {
    "values": [
      {"category": "A", "value": 28},
      {"category": "B", "value": 55},
      {"category": "C", "value": 43},
      {"category": "D", "value": 91},
      {"category": "E", "value": 81}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "category", "type": "nominal", "axis": {"labelAngle": 0}},
    "y": {"field": "value", "type": "quantitative"}
  }
}
```
````

**渲染效果**：

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "A simple bar chart",
  "data": {
    "values": [
      {"category": "A", "value": 28},
      {"category": "B", "value": 55},
      {"category": "C", "value": 43},
      {"category": "D", "value": 91},
      {"category": "E", "value": 81}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "category", "type": "nominal", "axis": {"labelAngle": 0}},
    "y": {"field": "value", "type": "quantitative"}
  }
}
```

### 堆叠条形图（按区域分组）

**源码**：

````markdown
```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Stacked bar chart by region",
  "data": {
    "values": [
      {"region": "华东", "quarter": "Q1", "amount": 120},
      {"region": "华东", "quarter": "Q2", "amount": 165},
      {"region": "华北", "quarter": "Q1", "amount": 98},
      {"region": "华北", "quarter": "Q2", "amount": 143},
      {"region": "华南", "quarter": "Q1", "amount": 76},
      {"region": "华南", "quarter": "Q2", "amount": 112}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "quarter", "type": "nominal", "axis": {"title": null}},
    "y": {"field": "amount", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "region", "type": "nominal"},
    "xOffset": {"field": "region"}
  }
}
```
````

**渲染效果**：

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Stacked bar chart by region",
  "data": {
    "values": [
      {"region": "华东", "quarter": "Q1", "amount": 120},
      {"region": "华东", "quarter": "Q2", "amount": 165},
      {"region": "华北", "quarter": "Q1", "amount": 98},
      {"region": "华北", "quarter": "Q2", "amount": 143},
      {"region": "华南", "quarter": "Q1", "amount": 76},
      {"region": "华南", "quarter": "Q2", "amount": 112}
    ]
  },
  "mark": {"type": "bar"},
  "encoding": {
    "x": {"field": "quarter", "type": "nominal", "axis": {"title": null}},
    "y": {"field": "amount", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "region", "type": "nominal"},
    "xOffset": {"field": "region"}
  }
}
```

### 折线图（多序列 + 数据点）

**源码**：

````markdown
```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Multi-series line chart",
  "data": {
    "values": [
      {"month": "1月", "core01": 42, "core02": 35},
      {"month": "2月", "core01": 51, "core02": 39},
      {"month": "3月", "core01": 47, "core02": 55},
      {"month": "4月", "core01": 63, "core02": 58},
      {"month": "5月", "core01": 59, "core02": 71},
      {"month": "6月", "core01": 74, "core02": 66}
    ]
  },
  "mark": {"type": "line", "point": true},
  "encoding": {
    "x": {"field": "month", "type": "ordinal", "axis": {"title": null}},
    "y": {"field": "value", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "key", "type": "nominal"}
  }
}
```
````

**渲染效果**：

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "description": "Multi-series line chart",
  "data": {
    "values": [
      {"month": "1月", "core01": 42, "core02": 35},
      {"month": "2月", "core01": 51, "core02": 39},
      {"month": "3月", "core01": 47, "core02": 55},
      {"month": "4月", "core01": 63, "core02": 58},
      {"month": "5月", "core01": 59, "core02": 71},
      {"month": "6月", "core01": 74, "core02": 66}
    ]
  },
  "mark": {"type": "line", "point": true},
  "encoding": {
    "x": {"field": "month", "type": "ordinal", "axis": {"title": null}},
    "y": {"field": "value", "type": "quantitative", "axis": {"title": null}},
    "color": {"field": "key", "type": "nominal"}
  }
}
```

服务失败或离线时两者都会回退为源码 + 在线打开链接；错误响应（如 400）也会触发回退而不是把错误图当结果展示。
