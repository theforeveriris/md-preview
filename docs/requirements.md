---
title: 需求整理（候选功能）
tags: [规划]
---

# 需求整理（候选功能）

本文整理自一轮功能头脑风暴中筛选出的候选需求，作为**排期参考**。

与 [功能路线图](roadmap.md) 的分工：roadmap 是维护者已确认的正式规划，本文是**待评估的候选池**；某项落地后，请移入 roadmap / README 特性清单，并从本表移除。

约定：**优先级** P0（低风险快赢）→ P1（体感/内容增强）→ P2（攻坚）；**工作量** 小（≤ 半天）→ 中（1~3 天）→ 大（多日）。

---

## 总览

| ID | 名称 | 分组 | 优先级 | 工作量 | 主要复用 |
|----|------|------|--------|--------|----------|
| PERF-1 | 可见即渲染（图表延迟初始化） | 性能与阅读体验 | P1 | 中 | `md-render.js` 调度器、`dom.js` 懒加载 |
| PERF-2 | 屏外内容跳过布局（`content-visibility`） | 性能与阅读体验 | P1 | 小 | `markdown.css` |
| PERF-3 | 长文档渐进渲染 | 性能与阅读体验 | P2 | 中 | `markdown.js` 渲染管线 |
| PERF-4 | 相邻文档预取 | 性能与阅读体验 | P0 | 小 | `hover-preview.js`、`file-tree.js` |
| DATA-1 | CSV / TSV → 图表联动 | 内容增强 | P0 | 中 | `csv-table.js`、`apexcharts.js` |
| CONTENT-1 | 术语表悬浮解释 | 内容增强 | P1 | 中 | `hover-preview.js`、frontmatter |
| TOOL-1 | OpenAPI 交互文档 | API / 开发者工具 | P2 | 中 | 渲染器注册、`sandbox.js` |
| TOOL-2 | `::: http` 实时请求块 | API / 开发者工具 | P1 | 小 | `json-tree.js`、highlight |
| TOOL-3 | SQL DDL → ER 图 | API / 开发者工具 | P0 | 小 | `mermaid.js` |
| TOOL-4 | 开发者小工具家族 | API / 开发者工具 | P0 | 小 | `plugins/loader.js` |
| CJK-1 | 繁简一键切换 | 中文与东亚特化 | P0 | 小 | `settings.js`、i18n |
| CJK-2 | 拼音注音（ruby） | 中文与东亚特化 | P1 | 小 | 渲染管线、`settings.js` |
| CJK-3 | 竖排模式 | 中文与东亚特化 | P2 | 中 | `markdown.css`、`theme-manager.js` |
| CJK-4 | CJK 排版渲染选项 | 中文与东亚特化 | P1 | 小 | `settings.js`、`markdown.css` |
| BUILD-1 | 中文排版 lint（构建期） | 构建与工程 | P0 | 中 | `build-*.js`、`smoke-test.yml` |
| GIT-1 | 单篇文档历史 / blame | Git 与协作 | P1 | 中 | GitHub API、`diff.js` |
| GIT-2 | 自动变更日志页 | Git 与协作 | P0 | 小 | `build-sitemap.js` 的 git 用法 |
| GIT-3 | 文档变更订阅 | Git 与协作 | P2 | 中 | GIT-1、`feed.xml` `lastmod` |
| NAV-1 | 文档图谱 `#/graph` | 导航与关系 | P1 | 中 | `build-links.js`、Cytoscape.js（已 vendor） |
| NAV-2 | 反向链接 + 相关文档 | 导航与关系 | P1 | 中 | `links.json`、`hover-preview.js` |
| SEARCH-1 | 繁简互通 + 拼音首字母 | 搜索 | P1 | 中 | `build-search-index.js`、opencc、静态拼音表 |
| TYPE-1 | 图 / 表自动编号 + 交叉引用 | 排版 | P1 | 中 | 渲染管线、`section-collapse.js` 的锚点交互 |
| CONTENT-2 | 时间线组件 | 内容增强 | P0 | 小 | 插件系统 |
| UI-1 | 脚注悬浮预览 | 阅读体验 | P0 | 小 | `hover-preview.js`、`marked-footnote` |
| UI-2 | 设置项搜索 | 设置面板 | P0 | 小 | `settings.js`、`floating.css` |

---

## 落地进度

- **批次 1（已完成）**：PERF-4 相邻文档预取、PERF-2 屏外内容跳过布局、DATA-1 CSV→图表联动、TOOL-3 SQL DDL→ER 图、CJK-1 繁简切换、CJK-4 中文排版渲染选项、GIT-2 自动变更日志页。
- **批次 2（已完成）**：PERF-1 可见即渲染（重型渲染器延迟初始化）、CONTENT-1 术语表悬浮、TOOL-2 `::: http` 实时请求块、TOOL-4 开发者小工具家族（regex / cron / time / color / hash / jwt）、BUILD-1 中文排版 lint、CJK-2 拼音注音（`{汉字|hán zì}`）。
- **批次 3（已完成）**：PERF-3 长文档渐进渲染（渐进式代码高亮 + 屏外跳过布局）、TOOL-1 OpenAPI 交互文档、CJK-3 竖排模式、GIT-1 单篇历史 / blame、GIT-3 文档变更订阅。

## 候选池：本轮已落地

以下候选需求已实现，说明见 [README 特性清单](../README.md#特性) 与对应示例文档：

| ID | 名称 | 说明 |
|----|------|------|
| NAV-1 | 文档图谱 `#/graph` | 入口=命令面板「文档图谱」；沉浸式整屏画布：节点=文档、边=站内链接、颜色=主题强调色深浅、大小=被引用数；悬停出该节点与邻居标签 / 搜索定位居中 / 标签高亮子图 / 缩放·适配·重置·全屏 / 孤立节点灰显 |
| NAV-2 | 反向链接与相关文档 | 文末「被 N 篇引用」+「相关文档」（共享标签 × 互链加权，5 条可展开） |
| SEARCH-1 | 繁简互通 + 拼音首字母 | 构建期写入 `searchText`，运行时零新增体积 |
| TYPE-1 | 图 / 表自动编号与交叉引用 | 连续编号、`<!-- #fig:别名 -->`、空链接自动填充、题注可复制锚点 |
| CONTENT-2 | 时间线组件 | `timeline` 代码块，状态色 + 今日标记线 |
| UI-1 | 脚注悬浮预览 | 悬停 / 聚焦角标浮出脚注原文 |
| UI-2 | 设置项搜索 | 行级过滤 + 隐藏空分组 + 唯一命中自动跳转 |

## 一、性能与阅读体验

### PERF-1 可见即渲染（图表延迟初始化）

**目标**：打开文档时不再一次性初始化全部重型渲染器；含 30 个 Mermaid 的文档首屏不再卡顿。

**现状**：`iris/js/md-render.js` 的 `runRenderers()` 会在文档注入后**顺序 await 全部渲染器**，每个渲染器自行查询 DOM、命中即加载 vendor 并初始化。

**交互 / 验收**：滚动到图表附近（预留 `rootMargin` 约 300px）才初始化；未初始化区显示轻量占位骨架（高度稳定，避免抖动）；滚动到含图区域时肉眼无可感延迟；一篇 30 图文档的 DOM 注入耗时显著下降。

**实现要点**：

- 引入「可延迟渲染器」清单（mermaid / plantuml / apexcharts / katex / diff / geo / pkt / pptx / csv / json）。
- 需要小改 `runRenderers`：支持**按块调度**（对每个命中的代码块容器注册 IntersectionObserver，进入视野后再调用对应渲染器并限定作用域），而非仅按渲染器整体执行。
- 保持现有「单渲染器失败隔离」「顺序 await（避免 innerHTML 竞态）」语义。

**依赖与风险**：部分渲染器会整体重写容器 innerHTML（`embedded.js`），需确认延迟执行不影响其清理时序；打印（`Ctrl/⌘+P`）与「导出 PDF」前需强制初始化全部未渲染块。

### PERF-2 屏外内容跳过布局（`content-visibility`）

**目标**：长文档屏外区块跳过布局与绘制，滚动更顺滑。

**实现要点**：正文顶层区块加 `content-visibility: auto` + `contain-intrinsic-size`（给估算高度，减少滚动条跳动）。仅作用于 `.markdown-body` 下的块级子节点。

**依赖与风险**：会改变滚动高度估算，需回归「阅读位置续读」百分比、章节折叠、查找条（`find-bar.js`，TreeWalker 不依赖布局，影响小）与锚点跳转定位；`contain-intrinsic-size` 需实测调参。

### PERF-3 长文档渐进渲染

**目标**：超长文档先渲染首屏前 N 块，其余在空闲时补齐，首屏更快可见。

**实现要点**：`marked.parse` 产出整段 HTML 后，按顶层块切片：首屏块立即插入，剩余块用 `requestIdleCallback`（降级 `setTimeout`）分批插入，或先插入但依赖 PERF-2 的 `content-visibility` 推迟布局。

**依赖与风险**：与 PERF-1 / PERF-2 方案有重叠，**建议三者合并为一个「渲染调度」改造**统一设计，避免三套机制互相打架；需保证文档切换时取消上一轮未完成的空闲任务。

### PERF-4 相邻文档预取

**目标**：`[` / `]`、悬浮球上/下一篇、侧边栏点击时切换「瞬时」。

**交互 / 验收**：悬停文件树条目、空闲、或当前文档渲染完成后，预取上一/下一篇的 `.md`；切换时命中缓存直达。

**实现要点**：复用 `hover-preview.js` 的 fetch + 内存缓存思路；预取由 Service Worker 拦截入库，顺带提升离线命中。见上/下一篇顺序来源 `file-tree.js`（DFS）。

**依赖与风险**：注意并发上限与移动端流量；仅预取相邻 1~2 篇，不做全量。

---

## 二、内容增强

### DATA-1 CSV / TSV → 图表联动

**目标**：交互表格上加「画成图」，一键生成 ApexCharts，免手写图表配置。

**交互 / 验收**：` ```csv ` 表格右上角新增「画成图」按钮 → 弹出图表类型选择（折线/柱状/饼/散点）→ 按列语义自动推断 X 轴与系列 → 内联渲染图表；另提供「复制为 ` ```apexcharts ` 配置」，便于回写文档源码。

**实现要点**：`iris/js/renderers/csv-table.js` 已将数据解析到内存，直接构造 ApexCharts options；按需 `loadScriptOnce` 加载 apexcharts（复用 `renderers/apexcharts.js` 的加载方式）；类型推断：数值列 → 系列，首个非数值或时间列 → 类别轴。

**复用**：`csv-table.js`、`apexcharts.js`、`dom.js`。

**依赖与风险**：列类型误判需允许用户手动改；大数据表限制系列/点数。

### CONTENT-1 术语表悬浮解释

**目标**：frontmatter 声明术语，正文首次出现自动高亮并可悬浮查看解释。

**交互 / 验收**：frontmatter 写 `glossary: { OSPF: 开放最短路径优先… }`（或以独立术语文件提供）；正文命中术语加细下划线样式，鼠标悬浮弹出解释卡片（触屏长按）。

**实现要点**：渲染后对正文做一趟 TreeWalker 文本扫描（**跳过** `code` / `pre` / 链接 / 标题锚点 / 已处理节点），仅高亮**首次**出现，控制每篇命中上限以保证性能；卡片定位复用 `hover-preview.js` 的边界规避逻辑。

**依赖与风险**：文本节点切分会干扰其它后处理（锚点、查找条高亮），需确定执行顺序；术语过多时性能与视觉噪音需设置开关。

---

## 三、API / 开发者工具块

> 说明：本站定位为文档站，迟早要写 API / 开发者文档，目前**完全没有工具类组件**。本组为「文档语法糖 + 交互组件」，均为渲染器或插件形态。

### TOOL-1 OpenAPI 交互文档

**目标**：贴 `swagger.json` / `openapi.yaml` → 渲染接口文档 + 在线「Try it」发请求看响应。

**交互 / 验收**：` ```openapi ` 块解析为按 tag 分组的接口列表（路径、方法、参数、请求体、响应码/示例），每接口带「试一下」按钮，填参后显示状态码、响应头与响应体。

**实现要点**：新增渲染器 `renderers/openapi.js`；YAML 解析按需加载 `js-yaml`（mermaid vendor 内已含，但不对外暴露，需独立引入并按需加载）；请求体与响应体复用 `json-tree.js` 展示；「Try it」用 `fetch`。

**依赖与风险**：跨域（CORS）会导致部分接口无法直连，需明示「仅支持允许跨域的端点」；鉴权参数如何传递（header/query）需设计；不做自动执行，默认点击才发请求。

### TOOL-2 `::: http` 实时请求块

**目标**：文档内贴一个请求，读者点一下看真实返回。

**交互 / 验收**：`::: http GET https://… :::` 渲染为请求卡片（方法 + URL + 「发送」按钮）→ 展示状态码、耗时、响应头、响应体（JSON 走折叠树，其它走高亮）。

**实现要点**：新块语法 + 渲染器；默认方法 GET；响应展示复用 `json-tree.js` 与 highlight；与 TOOL-1 共用请求/展示组件。

**依赖与风险**：CORS 同上；默认仅 GET，避免危险方法误触发。

### TOOL-3 SQL DDL → ER 图

**目标**：贴建表语句自动生成 ER 图。

**交互 / 验收**：` ```sql ddl `（或 ` ```erd `）解析 `CREATE TABLE` + 外键 → 生成 Mermaid `erDiagram` 源码 → 复用 mermaid 渲染器出图；解析失败回退普通 SQL 高亮。

**实现要点**：正则解析表名、字段（类型/主键/非空）、`FOREIGN KEY` / `REFERENCES` 关系 → 拼 `erDiagram` 文本 → 交给 `renderers/mermaid.js`；提供「复制 Mermaid 源码」。

**复用**：`mermaid.js`（按需加载已有）。

**依赖与风险**：复杂 DDL（复合键、约束、方言）解析有限，需明确回退。

### TOOL-4 开发者小工具家族

**目标**：攒一批零依赖、即插即用的文档内小工具。

**清单**（可分批落地）：

| 工具 | 语法 | 说明 | 实现 |
|------|------|------|------|
| 正则测试 | `::: regex` | 输入正则 + 样本，实时高亮匹配、捕获组 | 原生 RegExp |
| Cron 解释 | `::: cron` | `*/5 * * * *` → 人类可读描述 | 轻量解析表 |
| 时间戳/时区 | `::: time` | 时间戳 ↔ 各时区对照，实时刷新 | `Intl.DateTimeFormat` |
| JWT 解析 | `::: jwt` | 解码 header/payload，标注过期 | base64 + JSON |
| 哈希 | `::: hash` | 文本 → MD5/SHA-1/SHA-256 | `crypto.subtle` |
| 色板/对比度 | `::: color` | 色值 → 色板 + WCAG 对比度检查 | 原生计算 |

**实现要点**：走**插件系统**（`iris/plugins/loader.js`，参考 qrcode / countdown / colorcard 插件），每个工具一个插件文件，零新依赖优先。

**依赖与风险**：MD5 需自实现或引入（`crypto.subtle` 不含 MD5）；工具语义都应可在文档静态阅读（不可用时降级为普通代码块）。

---

## 四、中文与东亚特化

> 说明：本项目为**中文优先**文档站，但缺少中文/东亚特有的阅读与排版能力。本组是相对其他文档站最具辨识度的方向。

### CJK-1 繁简一键切换

**目标**：正文繁体 ↔ 简体切换（阅读向，不改源文件）。

**交互 / 验收**：设置面板「阅读」区块加开关；切换后正文即时转换并记忆偏好；代码块、URL、`code` 内容**不转换**。

**实现要点**：引入 `opencc-js`（按需加载、可 vendor），对渲染后正文文本节点做转换，跳过 `code` / `pre` / `script` / 链接 URL；随主题同款持久化（`localStorage`）。

**依赖与风险**：字典体积需评估（懒加载）；是否同时转换 UI 文案需决策（建议仅正文）。

### CJK-2 拼音注音（ruby）

**目标**：为生僻字 / 学习类内容提供注音。

**交互 / 验收**：支持作者手写注音语法（如 `{漢字|hàn zì}` 或复用既有语法约定）渲染为 `<ruby>`；可选「自动注音」对正文汉字加拼音。

**实现要点**：作者语法零依赖，优先实现；自动注音需拼音数据（如 pinyin-pro），体量大，按需加载并仅对指定区块启用。

**依赖与风险**：自动注音体积与多音字准确度；默认关闭，避免全站注音噪音。

### CJK-3 竖排模式

**目标**：正文竖排阅读，服务于文言/诗词/排版展示场景。

**交互 / 验收**：设置面板或悬浮球提供「竖排」开关；正文 `writing-mode: vertical-rl`，滚动方向随之变化；代码块、表格、图表保持横向容器。

**实现要点**：作用于 `.markdown-body` 的 CSS；`theme-manager.js` / `settings.js` 记忆状态；处理滚动进度、锚点定位、灯箱与图表在竖排下的布局。

**依赖与风险**：滚动方向改变会影响「阅读位置续读」「上/下一篇手势」；`vertical` 与部分组件兼容性需逐一回归。观感独特，属高辨识度彩蛋级功能。

### CJK-4 CJK 排版渲染选项

**目标**：把「中文排版讲究」做成可开关的渲染选项。

**清单**：中西文自动间距、标点悬挂（`hanging-punctuation`）、行首/行尾禁则（避免行首出现 `，。」` 等）、首行缩进、标点挤压。

**实现要点**：多数为 `.markdown-body` 上的 CSS 变量/类；`text-spacing` 等新属性支持度有限时，用轻量 JS 在标点后插入零宽间距降级；统一挂到设置面板新增的「排版」区块，状态持久化。

**复用**：`settings.js`、`markdown.css`、i18n。

---

## 五、构建与工程

### BUILD-1 中文排版 lint（构建期）

**目标**：中文文档的排版规范检查与自动修复，CI 可卡门禁；后续可复用于编辑器实时提示。

**检查规则**：

- 中英文 / 中文与数字之间缺少空格；
- 全角 / 半角标点混用、中文用 `“”` 而非 `""`、单引号 `‘’`；
- 行首禁则（行首不出现 `，。！？、）」』` 等）；
- 中英混排括号配对与嵌套。

**交互 / 验收**：新增 `iris/scripts/lint-cjk.js`，默认**只报告不修改**；`--fix` 显式自动修复；由独立工作流 `cjk-typography-lint.yml` 接入 CI（首次全量、之后增量，main 上自动修复并由机器人提交，PR 上仅提示）。`smoke-test.yml` 中保留一条告警级调用。

**实现要点**：扫描仓库内全部 Markdown（`git ls-files '*.md'` 为准，与 `link-check.js` 同构）；**必须跳过**代码围栏、行内代码、URL、frontmatter、HTML 注释（复用 `link-check.js` 的围栏/转义处理思路）；修复逐条可定位（文件：行：列）。

**依赖与风险**：自动修复会产生大范围 diff，故默认关闭 `--fix`；规则需可配置白名单豁免（如刻意保留的半角括号）。

---

## 六、Git 与协作

> 说明：`lastmod` 已从 git 提取（`build-sitemap.js`），但界面上完全不可见。

### GIT-1 单篇文档历史 / blame

**目标**：文档页可查看「谁最后改的、改了什么」，内嵌 diff。

**交互 / 验收**：文档标题区或悬浮球加「历史」入口 → 列出该文件的提交时间线（作者、时间、信息）→ 点条目显示该次提交的 diff 视图。

**实现要点**：GitHub API `GET /repos/{owner}/{repo}/commits?path=<path>` 与 `/commits/{sha}`；`owner`/`repo` 来自 `iris/config.js`；diff 展示复用 `renderers/diff.js`（diff2html）；结果内存缓存。

**依赖与风险**：未鉴权 API 限流（60 次/时）→ 需缓存 + 可选填 GitHub Token；私有仓库必须带 Token；离线 / API 不可用时静默降级隐藏入口。

### GIT-2 自动变更日志页

**目标**：从 git log 生成站点变更日志页。

**交互 / 验收**：构建后生成变更日志（如 `docs/changelog.md` 或 `iris/data/changelog.json` + `#/changelog` 路由），按时间倒序列出变更。

**实现要点**：新增 `iris/scripts/build-changelog.js`，取 git log（复用 `build-sitemap.js` 的 git 调用）；可只收录 `docs/**` 变更；接入 CI（参考 `build-feed.yml`：产物有变化才提交回仓库）。

**复用**：`build-sitemap.js`、`build-feed.yml` 工作流模式。

### GIT-3 文档变更订阅

**目标**：关注某篇文档，它有更新时在界面提示并可看新旧 diff（「watch this doc」）。

**交互 / 验收**：文档页「关注」按钮；关注列表存本地；打开站点时检查关注文档的最新提交/更新时间，有更新则显示标记，点击查看变更。

**实现要点**：本地存 `{ path: lastSeenCommit }`；检查优先用 `file-tree.json` / `sitemap` 的 `lastmod`（离线可用），需要 diff 时再走 GIT-1 的 API。

**依赖与风险**：依赖 GIT-1；限流与离线降级同 GIT-1。

---

## 建议落地批次

| 批次 | 目标 | 需求 | 理由 |
|------|------|------|------|
| 批次 1 | 低风险快赢 | PERF-4、PERF-2、DATA-1、TOOL-3、CJK-1、CJK-4、GIT-2 | 改动面小、几乎零新依赖，受众感知强 |
| 批次 2 | 体感与内容 | PERF-1、CONTENT-1、TOOL-2、TOOL-4、BUILD-1、CJK-2 | 体感提升最大的性能项 + 内容增强 |
| 批次 3 | 攻坚 | PERF-3、TOOL-1、CJK-3、GIT-1、GIT-3 | 需重构 / 外部依赖 / 更多边界回归 |

---

## 横切要求（每条需求都要满足）

- **i18n**：新增 UI 文案一律进 `iris/js/i18n.js`（zh/en 双份），静态文案用 `data-i18n*`，动态走 `t(key, fallback)`。
- **无障碍**：新组件需可键盘操作、选区/焦点合理、必要处加 `aria-*`。
- **冒烟测试**：新增渲染器 / 插件 / 构建脚本 / i18n key 需同步更新 `iris/scripts/smoke-test.js` 与 `index.html`，避免 CI 失败。
- **懒加载与 PWA**：新增 vendor 库必须走 `dom.js` 的 `loadScriptOnce` / `loadStyleOnce`，并纳入 `precache-manifest` 与 SW 策略，不得拖累首屏。
- **渲染器 / 插件约定**：渲染器注册到 `window.MarkdownPreview.renderers.<id>` 并在 `index.html` 按序引入；文档级工具优先走插件系统。
- **性能预算**：首屏体积与主线程占用不得劣化（现为约 1 MB / 按需加载），改渲染管线时以 Debug Panel（`?debug=1`）实测为准。

---

## 待确认 / 决策点

1. **渲染调度合并**：PERF-1 / PERF-2 / PERF-3 是否合并为一次「渲染调度」重构统一实现？（建议是）
2. **跨域请求类组件**（TOOL-1、TOOL-2）：CORS 限制如何向读者解释？是否内置一个可选的代理说明？
3. **GitHub API 鉴权**：GIT-1 / GIT-3 是否需要引导用户填 Token？私有仓库如何支持？
4. **繁简范围**（CJK-1）：仅正文，还是含 UI 文案与侧边栏？
5. **CJK lint 门禁**（BUILD-1）：默认告警还是致命？`--fix` 是否加入某条工作流？
6. **术语表来源**（CONTENT-1）：frontmatter 内联，还是独立的术语文件 / 构建期汇总？
