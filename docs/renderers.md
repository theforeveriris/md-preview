---
title: 渲染器清单与运行来源
tags: [开发, 架构, 渲染器]
---

# 渲染器清单与运行来源

这篇文档回答三个问题：**每个渲染器在哪里运行、代码在仓库哪个位置、依赖是本地文件还是外部服务。**

判定口径：

- **本地**：渲染时不需要离开仓库，库文件在 `iris/vendor/`，或完全由站内 JS 实现。
- **外部服务**：渲染或交互时必须请求外部地址（渲染服务 / API / 瓦片 / iframe）。
- **混合**：主体本地，但某个动作或其中一部分资源走外网（例如地图底图、OpenAPI 的「试一下」）。
- **CDN**：特指从公共 CDN 拉取 JS/CSS 库文件；和“外部渲染 API”不是一回事。

---

## 一、注册与加载机制

| 环节 | 位置 | 说明 |
|------|------|------|
| 渲染器清单 | `iris/scripts/renderer-manifest.json` | 决定文件路径、加载顺序、类型（renderer / shared / plugin） |
| 功能开关 | `iris/config.json` → `features` | `enabled:false` 时 `sync-features` 会把文件移入 `.disabled/` 并摘掉 `<script>` |
| 脚本注入 | `index.html` 的 `BEGIN/END RENDERER SCRIPTS` 区块 | 由 `npm run sync:features` 整块重建，不要手改 |
| 运行时调度 | `iris/js/md-render.js` → `runRenderers()` | 按注册顺序调用各渲染器；部分重渲染器滚动到附近才初始化 |
| 懒加载名单 | `iris/js/md-render.js` → `DEFAULT_LAZY` | 目前是 `mermaid / plantuml / apexcharts / csvtable / jsontree / graph / logic / geogebra` |
| 文档数据 | `iris/data/file-tree.json`、`links.json`、`search-index.json` 等 | 由 `iris/scripts/build-*.js` 生成 |

新增渲染器的最小步骤：新建 `iris/js/renderers/xxx.js` → 在 `renderer-manifest.json` 加条目 → 在 `config.json` 的 `features` 加开关 → 跑 `npm run sync:features` → 补示例文档。

---

## 二、本地渲染器

### 2.1 使用仓库内 vendor 库

| 渲染器 | 代码位置 | 触发语法 | 本地依赖 |
|--------|----------|----------|----------|
| Mermaid | `iris/js/renderers/mermaid.js` | ` ```mermaid ` | `iris/vendor/mermaid.min.js` |
| SQL DDL / DBML → ER | `iris/js/renderers/sql-erd.js` | ` ```dbml `、` ```sql ddl `、` ```ddl `、` ```erd ` | 原生解析，出图交给本地 Mermaid |
| ApexCharts | `iris/js/renderers/apexcharts.js` | ` ```apexcharts ` | `iris/vendor/apexcharts.min.js` |
| KaTeX | `iris/js/renderers/katex.js` | `$...$`、`$$...$$` | `iris/vendor/katex/katex.min.js`、`auto-render.min.js`、`katex.min.css`、本地字体 |
| 文档图谱 | `iris/js/renderers/graph.js` | ` ```graph `、`#/graph` | `iris/vendor/cytoscape/cytoscape.min.js` |
| Packet Tracer / eNSP | `iris/js/pkt/pkt-renderer.js` | ` ```pkt `、`@[pkt](…)` | `iris/vendor/cytoscape/cytoscape.min.js` + `iris/data/pkt/icons.svg` |
| 代码阅读 / 编辑 | `iris/js/renderers/code-reader.js`、`iris/js/cm-editor.js` | ` ```code `、`@[code](…)`、`@[file](…)` | `iris/vendor/codemirror/codemirror.min.js`、`iris/vendor/highlight.js/` |
| OpenAPI 文档主体 | `iris/js/renderers/openapi.js` | ` ```openapi `、` ```swagger ` | `iris/vendor/js-yaml/js-yaml.min.js`（「试一下」另算，见外部服务） |
| 搜索 | `iris/js/search.js` | 站内搜索 | `iris/vendor/flexsearch.bundle.js` |
| 文件树 | `iris/js/file-tree.js` | 侧边栏 | `iris/vendor/file-tree/prod.js` + `iris/data/file-tree.json` |
| Markdown 渲染 | `iris/js/markdown.js`、`iris/js/md-render.js` | 全部文档 | `iris/vendor/marked.js`、`marked-footnote.min.js`、`highlight.js` |

### 2.2 纯原生实现（不加载第三方库）

| 渲染器 | 代码位置 | 触发语法 | 备注 |
|--------|----------|----------|------|
| Git Diff | `iris/js/renderers/diff.js` | ` ```diff ` | 自写解析，无 diff2html |
| 步骤 / 引用 / 组织图 | `iris/js/renderers/steps.js` | ` ```steps `、` ```quote `、` ```orgchart ` | 生成 Mermaid 块交给本地 Mermaid |
| 数字逻辑电路 | `iris/js/renderers/logic.js`、`iris/js/logic-core.js` | ` ```logic `、` ```circuit ` | 专用 DSL；原生 SVG + 真值表，无第三方库 |
| JSON 树 | `iris/js/renderers/json-tree.js` | ` ```json `、` ```json-tree ` | 可折叠树 |
| JSONPath 搜索 | `iris/js/renderers/json-search.js` | 增强 `json` 块 | 依赖 json-tree 的产物 |
| CSV / TSV 表格 | `iris/js/renderers/csv-table.js` | ` ```csv `、` ```tsv `、` ```csv rules ` | 「画成图」时才加载本地 ApexCharts |
| 表格交互 | `iris/js/renderers/table-tools.js` | 所有 Markdown 表格 | 排序 / 过滤 / 列显隐 / 导出 |
| 日志 / CLI 表格 | `iris/js/renderers/log.js` | ` ```log `、` ```clitable ` | 原生解析 |
| HAR 瀑布 | `iris/js/renderers/har.js` | ` ```har `、`@[har](…)` | 原生解析 |
| PCAP 抓包 | `iris/js/renderers/pcap.js` | ` ```pcap `、`@[pcap](…)` | 数据由 `iris/scripts/pcap/` 预处理为 JSON |
| Trace 瀑布 | `iris/js/renderers/trace.js` | ` ```trace `、`@[trace](…)` | OTLP / Jaeger / Zipkin |
| LLDP / CDP 拓扑 | `iris/js/renderers/lldp.js` | ` ```lldp `、` ```cdp ` | 原生 SVG |
| ACL 规则表 | `iris/js/renderers/acl.js` | ` ```acl ` | 原生解析 + 命中测试 |
| 路由表 | `iris/js/renderers/route-table.js` | ` ```route-table ` | 原生解析 + 搜索 |
| traceroute / ping | `iris/js/renderers/traceroute.js` | ` ```traceroute `、` ```tracert `、` ```ping ` | 原生 |
| Nmap / dig / BGP | `iris/js/renderers/net-tools.js` | ` ```nmap `、` ```dig `、` ```bgp ` | 原生 |
| 协议注册表 | `iris/js/renderers/registry.js` | ` ```registry `、`@[registry](…)` | 原生 |
| IP 计算器 | `iris/js/renderers/ipcalc.js` | ` ```ipcalc ` | 原生 |
| 配置语义 diff | `iris/js/renderers/config-diff.js` | ` ```config-diff ios `（或 `vrp`） | 原生 |
| 术语表 | `iris/js/renderers/glossary.js` | ` ```glossary ` | 原生 |
| 沙箱 | `iris/js/renderers/sandbox.js` | ` ```html live `、` ```js live `、` ```css live ` | 本地 iframe；内容里的外链由用户决定 |
| Pulse 波形 | `iris/js/renderers/pulse.js` | `[pulse]…[/pulse]`、`[pulsemini]…[/pulsemini]` | 原生 Canvas |
| 终端回放 | `iris/js/renderers/terminal.js` | ` ```terminal ` | 原生 |
| CLI 演练 | `iris/js/renderers/cli-lab.js` | ` ```cli ` | 原生 |
| CLI 帮助 | `iris/js/renderers/clihelp.js` | ` ```clihelp ` | 原生 |
| 敏感遮罩 | `iris/js/renderers/secret.js` | ` ```secret `、` ```secret 口令 ` | 原生 |
| 图片热点 | `iris/js/renderers/hotspot.js` | ` ```hotspot ` | 原生 |
| 日历热图 | `iris/js/renderers/heatmap.js` | ` ```heatmap ` | 原生 |
| PPTX 嵌入 | `iris/js/renderers/pptx.js` | ` ```pptx `、`@[pptx](…)` | 仓库内图片与 JSON |

> 旧的 ` ```bits ` 位标注已由 Bytefield 取代，代码与示例都已删除。

---

## 三、外部服务与混合型

| 渲染器 | 代码位置 | 触发语法 | 外部依赖 | 触发方式 / 可配置 |
|--------|----------|----------|----------|-------------------|
| Kroki 通用 | `iris/js/renderers/kroki.js` | ` ```kroki <type> ` | `https://kroki.io/<type>/svg/…` | 渲染时自动；`config.json` 的 `krokiServers` |
| WaveDrom | `iris/js/renderers/wavedrom.js` | ` ```wavedrom ` | 同上（`wavedrom` 类型） | 渲染时自动 |
| WireViz | `iris/js/renderers/wireviz.js` | ` ```wireviz ` | 同上（`wireviz` 类型） | 渲染时自动 |
| Bytefield | `iris/js/renderers/bytefield.js` | ` ```bytefield ` | 同上（`bytefield` 类型） | 渲染时自动 |
| Symbolator | `iris/js/renderers/symbolator.js` | ` ```symbolator ` | 同上（`symbolator` 类型） | 渲染时自动 |
| Kroki 共用客户端 | `iris/js/kroki-client.js` | — | 编码用本地 `pako`，请求发往 Kroki | 失败回退源码 + 在线链接 |
| PlantUML | `iris/js/renderers/plantuml.js` | ` ```plantuml ` | `https://www.plantuml.com/plantuml`，失败回退 `https://kroki.io/plantuml` | 渲染时自动；`plantumlServers` |
| Vega-Lite | `iris/js/renderers/vega-lite.js` | ` ```vega-lite ` | **CDN**：`cdn.jsdelivr.net` 的 `vega@5`、`vega-lite@5`、`vega-embed@6` | 渲染时自动；暂无本地 vendor 版本 |
| 地理地图 | `iris/js/renderers/geo.js` | ` ```geojson `、` ```topojson `、`@[geojson](…)`、`@[topojson](…)` | 本地 `iris/vendor/leaflet/`；底图瓦片 `tile.openstreetmap.org` | 混合：断网仍有图形，无底图 |
| GitHub 卡片 | `iris/js/renderers/github.js` | `@[github](owner/repo)`、`@[pr](…)`、`@[issue](…)`、`@[release](…)` | `https://api.github.com/…` | 渲染时自动；公开 API 限流 |
| HTTP 请求块 | `iris/js/renderers/http-request.js` | ` ```http ` | 代码块里写的目标 URL | 点「发送」才请求 |
| OpenAPI 试请求 | `iris/js/renderers/openapi.js` | ` ```openapi ` | spec 的 `servers[].url` | 点「试一下」才请求 |
| 通用嵌入 | `iris/js/renderers/embedded.js` | `@[youtube]`、`@[bilibili]`、`@[vimeo]`、`@[figma]`、`@[codepen]`、`@[jsfiddle]`、`@[stackblitz]`、`@[twitter]` | 对应站点 iframe；Twitter 额外加载 `platform.twitter.com/widgets.js` | 渲染时自动 |
| GeoGebra | `iris/js/renderers/geogebra.js` | ` ```geogebra `、`@[geogebra](材料ID)` | `geogebra.org/apps/deployggb.js` + GeoGebra Apps（CDN / 外部服务） | 默认点击加载；`geogebraScript` 可指向镜像；非商业许可 |

外部服务的失败策略：Kroki / PlantUML / Vega-Lite / GeoGebra 失败都会**保留源码**并提供在线打开或编辑器链接，不会留下空白块。

---

## 四、非渲染器但会发起外部请求的功能

| 功能 | 代码位置 | 外部地址 |
|------|----------|----------|
| 文件树 / 提交历史 / 贡献者 / 编辑链接 | `iris/js/file-tree.js`、`git-history.js`、`contributors.js`、`git-provider.js` | `api.github.com`、`github.com`、`gitee.com`、`gitlab.com` |
| 默认字体 | `index.html` | `fonts.googleapis.com`、`fonts.gstatic.com` |
| 编辑器 AI | `iris/js/editor/editor-ai.js` | `api.openai.com`（用户自填 Key） |
| 远程字体 / 外部 CSS / 代码高亮主题 | `iris/js/settings.js`、`iris/js/editor.js` | 用户填写的 URL |
| 图床上传 | 设置面板 | 用户填写的上传接口 |
| 分享二维码 | `iris/js/qr-encoder.js`、`qr-share.js` | 无，本地生成 |
| 站内搜索 | `iris/js/search.js` | 无，本地 FlexSearch |

---

## 五、如何自建 / 离线化

### 自建 Kroki 与 PlantUML

```json
{
  "krokiServers": ["https://kroki.example.com"],
  "plantumlServers": [
    { "type": "plantuml", "base": "https://plantuml.example.com/plantuml" }
  ]
}
```

放在 `iris/config.json` 顶层即可覆盖默认服务。

### 把 Vega-Lite 变成本地

1. 把 `vega.min.js`、`vega-lite.min.js`、`vega-embed.min.js` 放进 `iris/vendor/vega/`；
2. 把 `iris/js/renderers/vega-lite.js` 顶部的 `CDN` 常量改成 `iris/vendor/vega/...`；
3. 跑 `npm run sync:features` 更新 precache。

### 地图底图

Leaflet 已本地化；如需完全离线，需要自建瓦片服务并替换 `geo.js` 里的 `tileLayer` 地址。

---

## 六、功能开关速查

```json
"features": {
  "mermaid": { "enabled": true },
  "kroki": { "enabled": false },
  "wavedrom": { "enabled": false }
}
```

- 关闭后 `npm run sync:features` 会把对应文件移到同目录 `.disabled/`，并从 `index.html` 摘掉脚本。
- 依赖链：`wavedrom / wireviz / bytefield / symbolator` 依赖 `kroki-client`（shared），关闭 `kroki` 不影响它们，但关闭 `kroki-client` 会让这四个一起失效。
- `sql-erd` 依赖 `mermaid`；关闭 `mermaid` 后 DBML/SQL 图不会出图，只保留转换后的代码块。
- `logic` 依赖 `logic-core`（shared）；关闭 `logic-core` 会让逻辑电路渲染器失效。
- `@[geogebra](…)` 的材料嵌入由 `embedded` 分发；只关闭 `geogebra` 时命令围栏也不可用，`@[geogebra]` 会保留源码块。
- GeoGebra 使用非商业许可；商用部署前需要取得授权。
