---
title: 渲染内容改进总览
tags: [渲染, 新功能]
---

# 渲染内容改进总览

本页汇总「渲染内容改进实施总纲」落地的全部能力。每项均给出语法、示例文档与失败回退说明。

## 源码与代码阅读

### 源码嵌入 `@[code]` / `@[file]`

**源码**：

````markdown
```code
@[code](iris/js/renderers/table-tools.js#L1-L60 lang=js)
@[file](iris/js/renderers/code-reader.js)
```
````

**渲染效果**：

```code
@[code](iris/js/renderers/table-tools.js#L1-L60 lang=js)
@[file](iris/js/renderers/code-reader.js)
```

- 整文件 / 行范围（`#Lx-Ly`）/ `lang=` 覆盖三种写法。
- 优先读构建期快照 `iris/data/code-snippets.json`（离线可用），缺失时同源 `fetch`。
- 构建期校验：`node iris/scripts/build-code-snippets.js`（输出告警：路径不存在、行号越界）。
- 失败回退：错误卡片 + 源文件链接。
- 示例：[代码阅读与源码嵌入](examples/code-reader-examples.md)。

### 代码块阅读模式

每个代码块头部增加 `换行` / `折叠` / `纯文本`，左侧行号与代码行严格对齐（横向滚动时行号列 sticky 固定，换行模式下自动隐藏）；超过 30 行的块提供折叠：默认显示前 24 行 + 渐变遮罩 + 「展开全部」，折叠高度按实际渲染行高取整行数。复制沿用全局复制按钮，复制内容始终为完整源码。

### 补充：嵌入块默认折叠

`@[code]` / `@[file]` 嵌入超过 30 行时自动折叠（前 24 行 + 展开），标题显示路径、行范围与总行数；行号从真实起始行起算（如 `#L39-L50` 显示 39–50）。

### 配置语言高亮

`iris/js/langs/extra-langs.js` 为 toml / dockerfile / properties / nginx / apache / ssh / http / nmap / rst 注册别名，避免 no-highlight 回退。

### 通用代码工具条

与阅读模式合并实现：换行 / 折叠 / 纯文本为图标按钮（悬停显示文字提示，激活态主题色高亮），与复制按钮一起悬停浮现于代码块右上角；触屏常显，打印隐藏。

### CLI `--help` 渲染器

**源码**：

````markdown
```clihelp
Usage: iris <command> [options]
Options:
  -V, --version      输出版本号
  -h, --help         显示帮助
```
````

**渲染效果**：

```clihelp
Usage: iris <command> [options]
Options:
  -V, --version      输出版本号
  -h, --help         显示帮助
```

识别 Usage / Options / Commands / Examples，渲染为结构化帮助卡片。示例：[图片热点与 CLI 帮助](examples/hotspot-clihelp-examples.md)。

## 表格与结构数据

### Markdown 表格交互化

普通 Markdown 表格自动获得工具条：表头排序、关键字过滤、列显示/隐藏、复制 TSV、导出 CSV；长表固定表头并在内部滚动。可用 `<!-- table-tools: off -->` 关闭。

### JSON 搜索 / JSONPath

在 json-tree 工具条内新增搜索与 JSONPath 输入框，支持 `$`、`.key`、`['key']`、`[n]`、`[*]`、`.*`、`..key`。命中节点高亮并自动展开父节点。示例：[JSON 树搜索与 JSONPath](examples/json-search-examples.md)。

### 协议注册表块

**源码**（列间 ≥2 空格对齐）：

````markdown
```registry
port  name   proto  description
22    ssh    tcp    Secure Shell
53    dns    udp    Domain Name System
```
````

**渲染效果**：

```registry
port  name   proto  description
22    ssh    tcp    Secure Shell
53    dns    udp    Domain Name System
```

`registry common` 或 `@[registry](common)` 显示内置常用协议表（50+ 条），可搜索/排序/导出。

## 网络与可观测性

### log + clitable

**源码**：

````markdown
```log
2026-11-02T10:00:01.000Z host api[1]: ERROR upstream timed out
```
````

**渲染效果**：

```log
2026-11-02T10:00:01.000Z host api[1]: ERROR upstream timed out
```

识别 syslog / ISO / JSON 日志，级别筛选 + 关键字过滤 + 导出。`clitable` 解析 show 系列表格与 `key: value` 键值。示例：[日志与 CLI 输出渲染](examples/log-cli-examples.md)。

### LLDP / CDP 拓扑

**源码**：

````markdown
```lldp
Device ID           Local Intf     Hold-time  Capability      Port ID
core01              Gi0/0/1        120        BR              Gi0/0/24
```
````

**渲染效果**：

```lldp
Device ID           Local Intf     Hold-time  Capability      Port ID
core01              Gi0/0/1        120        BR              Gi0/0/24
```

渲染 SVG 拓扑，双向边去重，节点高亮邻居，布局切换（环形/同心），导出 SVG。示例：[LLDP / CDP 邻居拓扑](examples/lldp-examples.md)。

### HAR 瀑布图

**源码**（内联 JSON 或 `@[har](file.har)` 引用文件）：

````markdown
```har
{"log":{"entries":[...]}}
```
````

**渲染效果**（`entries` 留空时仅显示空态；完整演示见示例页）：

```har
{"log":{"entries":[]}}
```

按 blocked/dns/connect/ssl/send/wait/receive 分段着色，搜索 + 类型/域名/状态过滤，点击行展开请求/响应头与计时，导出 CSV。支持 `@[har](file.har)` 嵌入。示例：[HAR 瀑布图](examples/har-examples.md)。

### Nmap / dig / BGP 专用视图

`nmap`（normal/grepable/XML）端口矩阵与风险色；`dig` 按 ANSWER/AUTHORITY/ADDITIONAL 分区；`bgp` 前缀表 + AS Path chips + best 标记。示例：[Nmap / dig / BGP 专用视图](examples/net-tools-examples.md)。

### OpenTelemetry trace 瀑布

支持 OTLP / Jaeger / Zipkin，span 按父子层级缩进、关键路径高亮、服务过滤、导出 CSV。示例：[分布式 Trace 瀑布](examples/trace-examples.md)。

## 图表与图形

### 通用 Kroki 渲染器

**源码**（fence 第二个 token 为图类型）：

````markdown
```kroki blockdiag
{
  A[label="客户端"];
  B[label="网关"];
  A -> B;
}
```
````

**渲染效果**：

```kroki blockdiag
{
  A[label="客户端"];
  B[label="网关"];
  A -> B;
}
```

一个入口支持 blockdiag / seqdiag / actdiag / nwdiag / packetdiag / rackdiag / bytefield / ditaa / erd / graphviz / nomnoml / svgbob / umlet / plantuml / mermaid / dbml / excalidraw 等。失败回退源码 + 在线链接。

### Vega-Lite

**源码**：

````markdown
```vega-lite
{ "$schema": "...", "mark": "bar", "encoding": {...} }
```
````

**渲染效果**（`...` 为占位时整体回退为源码块，完整演示见示例页）：

```vega-lite
{ "$schema": "...", "mark": "bar", "encoding": {...} }
```

按需从 CDN 懒加载 vega / vega-lite / vega-embed；失败回退源码 + 在线编辑器。示例：[Kroki 与 Vega-Lite](examples/kroki-vega-examples.md)。

## 图片热点

### 图片热点标注

**源码**：

````markdown
```hotspot
{ "image": "docs/image/x.png",
  "hotspots": [ { "x": 12, "y": 18, "w": 34, "h": 10, "label": "标题区" } ] }
```
````

**渲染效果**（图片缺失时降级为错误卡片，完整演示见示例页）：

```hotspot
{ "image": "docs/image/x.png",
  "hotspots": [ { "x": 12, "y": 18, "w": 34, "h": 10, "label": "标题区" } ] }
```

x/y/w/h 为百分比；热点带编号徽标，悬停显示标签，点击固定，图片下方自动生成编号图例（悬停/点击图例项与热点双向联动，打印时图例保留）。

## 性能与架构

- **长文档渐进渲染**：超大文档（HTML > 120 KB）在渲染周期显示进度条。
- **渲染结果缓存**：sessionStorage 缓存 parse 结果（24h），非受信来源不缓存。
- **大表/大树虚拟滚动**：长表格行、日志行、JSON 节点使用 `content-visibility:auto` 跳过视口外渲染。
- **骨架屏**：lazy 渲染器等待时插入 `.md-skeleton` 骨架屏。

## 导入 / 导出

设置面板「工具与导出 → 工具 → 格式转换工具」：

- **HTML → Markdown**：粘贴或选择 `.html`，DOM 解析转 GFM（标题/列表/表格/代码/链接/图片）。
- **干净 CommonMark/GFM 导出**：去除站点私有注释、规范换行，复制/下载。
- **Obsidian 导入**：`[[wiki]]` → 相对链接、`![[img]]` → 图片、`> [!note]` → callout、`==高亮==` 保留。

## 外部卡片

### GitHub issue/PR/release/repo 卡片

**源码**：

````markdown
```github
@[github](owner/repo)
@[issue](https://github.com/owner/repo/issues/1)
@[pr](https://github.com/owner/repo/pull/2)
@[release](https://github.com/owner/repo/releases/tag/v1)
```
````

**渲染效果**（示例仓库不存在时回退为链接卡片，完整演示见示例页）：

```github
@[github](owner/repo)
@[issue](https://github.com/owner/repo/issues/1)
@[pr](https://github.com/owner/repo/pull/2)
@[release](https://github.com/owner/repo/releases/tag/v1)
```

渲染标题、状态、作者、标签、更新时间；匿名 API 限流或失败时回退纯链接。示例：[GitHub 卡片与协议注册表](examples/github-examples.md)。

## 约定与限制

- 所有文档内容拼 HTML 前均 `escapeHtml`；非受信来源再过 DOMPurify。
- 渲染器幂等（`data-*-done` 标记）；单个渲染器失败被隔离，不影响其他块。
- 解析失败一律回退源码块或错误卡片，不白屏。
- 打印时隐藏工具条；暗色主题自适应；尊重 `prefers-reduced-motion`。
