# Markdown Preview — 开发者文档

面向想贡献代码、扩展功能或进行深度定制的开发者。用户手册请见 [README.md](README.md)。

## 目录

- 架构概览
- 模块说明
  - 入口与生命周期
  - 核心模块
  - 渲染器（Renderer）
  - 插件系统
- CI / CD 工作流
  - 站点构建（build-site）
  - PKT / ENSP 产物构建（build-pkt）
  - PPTX 产物构建（build-pptx）
- 样式与主题系统
  - CSS 变量约定
  - 主题配色
  - 字体自定义系统
- 按需懒加载机制
- 笔记本存储（IndexedDB）
- 构建脚本参考
- 本地调试与常见坑
- 目录结构速查

## 架构概览

本项目是一个完全静态、纯前端的 Markdown 文档预览站点。运行时不依赖任何服务器：

1. 首次打开 `index.html`，`iris/app.js` 初始化。
2. 尝试从 `iris/data/file-tree.json` 读取预构建的文件树；若不存在则回退到 GitHub Contents API。
3. 侧边栏渲染文件树；用户点击 → Hash 路由 → 加载对应 `.md` → marked 解析 → 各 Renderer 对特定代码块后处理。
4. 设置、主题、字体、编辑器笔记本等持久化走 `localStorage` 或 `IndexedDB`。
5. Service Worker（`sw.js`）负责静态资源缓存和 PWA 更新提示。

## 模块说明

### 入口与生命周期

[`index.html`](index.html) 引入的脚本按以下顺序执行：

1. `iris/js/config.js` — 注入 owner / repo 等用户配置到 `window.MarkdownPreview.config`
2. `iris/js/themes/theme-manager.js` — 尽早应用主题（避免闪烁），加载自定义 CSS / 自定义 hljs
3. `iris/js/settings.js` — 读取并应用 `customColors`、`fontConfig`、远程字体 URL
4. `iris/vendor/marked.js`、`iris/vendor/highlight.js` 等按需 vendor
5. `iris/js/dom.js` — 按需加载样式、DOM 工具
6. `iris/js/file-tree.js` — 构建侧边栏
7. `iris/js/markdown.js` — Markdown 渲染 + 图片灯箱
8. `iris/js/app.js` — 组装 Hash 路由、编辑器模式、波形生成器模式

### 核心模块

| 模块 | 路径 | 职责 |
|------|------|------|
| Config | `iris/js/config.js` | 读取 `iris/config.json`，暴露到 `window.MarkdownPreview.config` |
| Theme Manager | `iris/js/themes/theme-manager.js` | 预设主题切换、自定义 CSS / hljs 主题加载 |
| Settings | `iris/js/settings.js` | 设置面板 UI、`customColors`、`fontConfig`、远程字体注入 |
| File Tree | `iris/js/file-tree.js` | 侧边栏文件树 / 索引、字数、搜索结果列表、上一篇/下一篇 |
| Markdown | `iris/js/markdown.js` | marked + 代码块高亮、标题锚点、图片灯箱（ArrowLeft/Right 翻页）、frontmatter 解析 |
| Interactions | `iris/js/interactions.js` | 表格悬浮手柄（主题化 PNG 导出 / 复制 Markdown / 复制 CSV）、LaTeX 右键复制 |
| Local Docs | `iris/js/local-docs.js` | 本地 MD 多选会话（侧边栏「本地文件」面板）+ 本地文件夹导入（懒加载目录树）+ 拖拽打开文件 / 文件夹（全屏遮罩 + webkitGetAsEntry 递归展开） |
| Gestures | `iris/js/gestures.js` | 移动端手势：左右滑翻上/下一篇（本地会话优先）、左缘右滑呼出侧边栏；编辑器/浮层/横向滚动容器内让位，设置开关 `mobileGestures` |
| History | `iris/js/history.js` | 浏览历史/收藏数据；长按文件树收藏（pointer + composedPath 穿透 Shadow DOM），最近 5 篇/收藏项的树内提示类切换 |
| Hover Preview | `iris/js/hover-preview.js` | 站内链接悬浮摘要卡片（fetch + parseFrontmatter + extractExcerpt，内存缓存） |
| QR Share | `iris/js/qr-share.js` | 悬浮球「扫码续读」二维码弹窗（外部 API 生成，`?pos=` 参数由 reading-pos.js 消费） |
| Search | `iris/js/search.js` | FlexSearch 全文索引加载与搜索命令面板 |
| UI | `iris/js/ui.js` | 全局事件与快捷键路由、搜索命令面板交互 |
| Storage | `iris/js/storage.js` | IndexedDB 笔记本存储（替代 localStorage 大内容） |
| Storage Manager | `iris/js/storage-manager.js` | 设置面板「存储」区块：`storage.estimate()` 用量条、笔记本删除/清空、历史收藏与阅读位置清理（打开面板时由 settings.js 触发 refresh） |
| i18n | `iris/js/i18n.js` | zh/en 语言包；静态文案用 `data-i18n` 系列属性标记，动态文案走 `t(key, fallback)`；语言选择存 `localStorage('md-preview-lang')`，切换后广播 `langchange` 事件 |
| App | `iris/js/app.js` | Hash 路由、编辑器模式 (`?mode=editor`)、Pulse 生成器 (`?mode=pulsegen`) |

### 渲染器（Renderer）

所有渲染器位于 `iris/js/renderers/`，统一被 `markdown.js` 在后处理阶段按 `tag` 匹配调用。

| 渲染器 | 文件 | 触发条件 | 依赖（按需加载） |
|--------|------|----------|-------------------|
| Mermaid | `mermaid.js` | ` ```mermaid ` | mermaid.min.js |
| PlantUML | `plantuml.js` | ` ```plantuml ` | pako（文本压缩为 deflate URL，请求 plantuml.com） |
| ApexCharts | `apexcharts.js` | ` ```apexcharts ` | apexcharts.js + apexcharts.css |
| LaTeX / KaTeX | `latex.js` | ` $$...$$ ` 或 ` ```latex ` | katex.min.js + katex.min.css |
| Diff2Html | `diff.js` | ` ```diff ` | diff2html.min.js + diff2html.min.css |
| GeoJSON | `geojson.js` | ` ```geojson ` | leaflet.js + leaflet.css + tile 服务 |
| Packet Tracer | `pkt.js` | `@[pkt](slug)` 或 ` ```pkt ` | cytoscape + css |
| 华为 eNSP | `ensp.js` | `@[ensp](slug)` 或 ` ```ensp ` | cytoscape + css（拓扑数据来自 XML 解析产物） |
| PPTX | `pptx.js` | `@[pptx](slug)` 或```` ```pptx ```` | 无额外依赖，图片取自预构建产物 |
| Pulse 波形 | `pulse.js` / `pulse-generator.js` | `[pulse ...]` / `[pulsemini ...]` BBcode，或 `?mode=pulse` 生成器 | 仅用 Canvas / SVG / 原生 JS 渲染波形播放头 |
| QRCode | `qrcode.js` | ` ```qrcode ` | qrcode.min.js（inline 本地） |
| Countdown | `countdown.js` | ` ```countdown ` | 零依赖，原生 Date |
| Embed | `embed.js` | YouTube / Bilibili / Twitter / Figma / CodePen 链接或 `@[embed]` | 通过原生 iframe，不额外加载库 |
| GitHub Alerts | 内建于 `markdown.js` | `> [!NOTE]` 等 | 纯 CSS |
| Gallery Layouts | `gallery.js` | `@grid / @cardstack / ...` 指令行 | 纯 CSS |

**扩展新 Renderer 最短路径**：

1. 新建 `iris/js/renderers/xxx.js`，对外暴露 `detect($root)` + `render($node)` 方法。
2. 在 `iris/js/markdown.js` 的 renderers 数组中注册。
3. 若需要重型依赖，参考 `mermaid.js` 的 `loadScriptOnce` + `loadStyleOnce` 模式，首次命中才真正加载。

### 插件系统

详见 [docs/plugin-development.md](docs/plugin-development.md)。插件本质上是一个提供 `install(app)` 方法的对象，可：

- 扩展 marked lexer / parser / renderer
- 注册自定义代码块语言（在 markdown.js 的 afterRender 里处理）
- 注入自定义 CSS 或 <script>
- 挂接路由、设置面板自定义控件

## CI / CD 工作流

全部位于 `.github/workflows/`：

| 工作流文件 | 触发条件 | 作用 |
|-----------|----------|------|
| `build-and-deploy.yml` | push 到 `main`，或手动触发 | 构建 file-tree / search-index / precache / sitemap 并部署到 GitHub Pages |
| `build-feed.yml` | push 到 `main` 且 `docs/**` 变化 | 运行 `build-feed.js` + `build-sitemap.js`，`feed.xml` / `sitemap.xml` 有变化时提交回仓库 |
| `build-search-index.yml` | push 到 `main` | 运行 `build-search-index.js`，`search-index.json` 有变化时提交回仓库 |
| `build-pkt.yml` | push 到 `main`，且 `iris/data/pkt/raw/**` 或 `iris/data/ensp/raw/**` 变化 | 执行 `iris/scripts/pkt/main.py` 和 `iris/scripts/ensp/main.py`，把产物 push 回 `data/pkt/json`、`data/pkt/images` 等 |
| `build-pptx.yml` | push 到 `main`，且 `iris/data/pptx/raw/**` 变化 | 安装 LibreOffice + poppler-utils，跑 `iris/scripts/pptx/main.py`：PPTX→PDF→PNG/SVG+元数据 JSON，push 回 |
| `smoke-test.yml` | push / PR 到 `main`，或手动触发 | 跑全部构建脚本验证可执行，安装 jsdom 后运行 `iris/scripts/smoke-test.js` 冒烟测试 |
| `sync-to-product.yml` | push 到 `main` | 将站点产物同步到 product 分支 |

### 产物存放约定

- PKT：`iris/data/pkt/json/<slug>.json` + `iris/data/pkt/images/<slug>-<N>.<ext>`
- eNSP：`iris/data/ensp/xml/<slug>.xml`（原始 XML）+ `iris/data/ensp/json/<slug>.json`（解析后拓扑 JSON）
- PPTX：`iris/data/pptx/json/<slug>.json` + `iris/data/pptx/images/<slug>-<N>.(svg/png)`

`slug` 来自 raw 目录文件名去扩展名。任何 `@[xxx](slug)` 嵌入语法按上面路径查找即可。

## 样式与主题系统

### CSS 变量约定

所有可定制的视觉量以 CSS 变量定义在 `iris/css/base.css :root`：

```
--color-bg / --color-surface / --color-border
--color-text / --color-text-muted
--color-accent-purple / --color-accent-pink / --color-accent-purple-deep
--color-glow
--font-display / --font-body
--font-size-body / --font-size-md / --font-size-h1 / --font-size-h2 / --font-size-h3
--font-weight-body / --font-weight-md / --font-weight-display
--font-weight-h1 / --font-weight-h2 / --font-weight-h3
--sidebar-width / --transition-smooth
```

### 主题配色

主题支持 `auto` 档位：跟随系统 `prefers-color-scheme` 在「亮色配对 / 暗色配对」间实时切换（配对存 `md-preview-theme-light` / `md-preview-theme-dark`，默认 紫粉渐变 + GitHub Dark）。`themechange` 事件的 `detail.theme` 始终是解析后的实际主题 ID。新增主题时：

1. 在 `theme-manager.js: validThemes` 加入 ID（暗色主题还需加入 `DARK_THEMES`，亮色加入 `LIGHT_THEMES` 以支持 auto 配对）
2. 在 `themes.css` 添加 `[data-theme="your-id"] { --color-xxx: ... }`
3. 在 `index.html` 中 `<select id="themeSelect">` 追加 option

### 字体自定义系统

- **存储键**：`localStorage.md-preview-settings.fontConfig`（序列化对象）
- **默认值**：见 `iris/js/settings.js:defaultFontConfig`
- **远程字体加载**：用户在设置中填写 Google Fonts / 任意 CSS URL → 由 `applyRemoteFont()` 生成 `<link id="remote-font-stylesheet">` 注入 `<head>`；重复切换时会先移除旧 link，避免堆积。
- **变量注入**：`applyFontConfig(cfg)` 逐个写入 `document.documentElement.style.setProperty(...)`。清除值时 `removeProperty()` 回退到 `base.css` 默认。
- **字体族自定义**：`--font-display`（标题、welcome、sidebar-title）与 `--font-body`（UI、正文）分别独立。

## 按需懒加载机制

首屏体积优化策略如下（对应 `iris/js/dom.js: loadScriptOnce / loadStyleOnce`）：

- vendor 中"重型"库（mermaid / apexcharts / katex / leaflet / diff2html / cytoscape）**不通过 `<script>` 引入 index.html**，而是由对应的 Renderer 在首次检测到自身代码块时 `loadScriptOnce(url)`。
- `styles.css` 中各子样式（leaflet.css / katex.min.css / diff2html.min.css）同样按需加载。
- 每个 `loadScriptOnce` 有 Promise 单例缓存，同一脚本不会并发加载两次。
- 实测首屏 JS 从约 6.8MB → 约 1MB。

## 笔记本存储（IndexedDB）

对应 `iris/js/storage.js`。

| 对象存储 | key | value 结构 |
|---------|-----|------------|
| notebooks | notebookId | `{ id, title, cells: [...], saved, version }` |
| meta | 任意字符串 | 任意（已用于 activeTab / tabOrder） |

单笔记本模式默认 key = `AUTOSAVE_KEY = 'autosave'`。首次打开会尝试从 `localStorage` 迁移旧数据（key 可指定），迁移成功后清掉 localStorage。

## 构建脚本参考

### file-tree 构建
```
node iris/scripts/build-file-tree.js
```
扫描仓库根下所有 `.md`（排除 node_modules / .git / vendor / .github），生成带字数统计的 `iris/data/file-tree.json`。

### search-index 构建
```
node iris/scripts/build-search-index.js
```
读取 file-tree 中每篇文档正文 → FlexSearch 文档索引 + 正文字段 → `iris/data/search-index.json`。

### feed 构建
```
node iris/scripts/build-feed.js
```
扫描 `docs/` 全部 `.md`，按发布时间倒序输出 RSS 2.0 的 `iris/data/feed.xml`（全文输出：正文用本地 `iris/vendor/marked.js` 渲染为 HTML，经 `<content:encoded>` 附于每条目，相对链接/图片改写为绝对地址）。

### sitemap 构建
```
node iris/scripts/build-sitemap.js
```
收录站点首页与 `docs/` 下全部 `.md` 直链，`lastmod` 取 git 最后提交时间，输出 `iris/data/sitemap.xml`；根目录 `robots.txt` 声明 `Sitemap:`。

### 冒烟测试
```
node iris/scripts/smoke-test.js        # 需先在 iris/ 下安装 jsdom
npm install --no-save jsdom@^29.1.1 --prefix iris   # 只装冒烟测试依赖
```
`iris/scripts/smoke-test.js` 做 4 组快速校验：① 全部第一方 JS 用 `vm.Script` 语法解析；② jsdom 解析 index.html，校验关键骨架节点与脚本/样式引用真实存在；③ 隔离沙箱加载 i18n.js，校验 `data-i18n*` key 在 zh 语言包齐全；④ 数据产物（file-tree / search-index / precache 清单引用 / feed 全文标记 / sitemap / robots.txt）完好。CI 中先跑全部构建脚本再跑冒烟（见 `smoke-test.yml`）。

### PKT / eNSP 构建
```
python3 iris/scripts/pkt/main.py   # raw/*.pkt → json + images
python3 iris/scripts/ensp/main.py  # raw/*.topo / *.zip → xml + json
```
增量处理：对 raw 里每个文件做 mtime 比较，仅产物缺失或 mtime 落后才重新解析。

### PPTX 构建
```
python3 iris/scripts/pptx/main.py
```
依赖系统命令：`libreoffice --headless --convert-to pdf` + `pdftoppm` / `pdftocairo`（poppler-utils）。流程：

1. raw 目录下发现 ppt/pptx → 导出 PDF → `pdftoppm` 每页导出 PNG/SVG。
2. 生成 `json/<slug>.json`：`{ title, pages: N, width, height, thumbType }`。
3. 产物推入仓库，前端渲染器直接读图片 + 元数据。

## 本地调试与常见坑

### 用简单静态服务器打开

直接 `file://` 打开会被 Service Worker、CORS、fetch file-tree.json 等卡住，建议：

```
python3 -m http.server 8080
# 访问 http://localhost:8080/
```

或使用 `npx serve .`。

### 调试模式

URL 加 `?debug=1`，右下角会出现 Debug Panel，实时显示：

- 环境（浏览器、视口、平台、语言、在线状态）
- 性能（首屏耗时、TTFB、DOM Ready、FCP、堆内存）
- 当前文档（路径、源大小、HTML 大小、渲染耗时、标题/图片/代码块/表格/链接数、Frontmatter）
- 文件树 & 搜索（文件总数、索引条目、搜索引擎）
- 主题（当前主题、代码主题、自定义色数、自定义 CSS / hljs）
- 缓存与网络（API 调用次数、缓存命中、LocalStorage、Service Worker 状态）

### Service Worker 缓存不清

`sw.js` 顶部 `CACHE_NAME` 手动升级版本号（例如 `v7.1 → v7.2`）会让下次 install 阶段跳过旧缓存，激活时把旧缓存清掉。
`index.html` 中 SW 注册用 `fetch('sw.js', { cache: 'no-store' })` + `updateViaCache: 'none'` 双保险，确保拿到最新脚本。

### PPT 缩略图点击触发"通用灯箱"

两重防护：
1. PPTX Renderer 对缩略图 click 调用 `e.stopPropagation()` + `e.preventDefault()`；
2. `markdown.js` 里 `isLightboxEligibleImage()` 排除 `[data-pptx-thumb]` / `.pptx-thumb-card` / `.pptx-embed` 以及已在 `#pptx-slideshow-overlay` 或 `#lightboxOverlay` 内的图片。
3. 键盘事件：PPT 放映在捕获阶段（`useCapture:true`）监听 keydown 并 `stopPropagation()`，优先于通用灯箱。

## 目录结构速查

```
.
├── index.html                    # 入口页面 + 设置面板 HTML
├── manifest.json                 # PWA 清单
├── sw.js                         # Service Worker（版本号控制缓存）
├── README.md                     # 用户手册
├── readme-dev.md                 # 本文件（开发者文档）
├── iris/
│   ├── app.js                    # Hash 路由 + 模式切换
│   ├── config.js                 # 读取 iris/config.json
│   ├── styles.css                # 样式入口（@import 各 css 子模块）
│   ├── css/
│   │   ├── base.css              # :root 变量、reset、body 默认
│   │   ├── layout.css            # sidebar、main、breadcrumb 等布局
│   │   ├── markdown.css          # .markdown-body H1-H6、p、code 等
│   │   ├── floating.css          # 悬浮球、设置面板、工具栏、字体小网格
│   │   ├── editor.css            # Markdown 编辑器模式样式
│   │   ├── pulse-generator.css   # Pulse 波形生成器样式
│   │   ├── galleries.css / components.css / responsive.css  # 画廊 / 组件 / 响应式
│   │   ├── pkt/pkt.css           # Packet Tracer 渲染样式
│   │   ├── pptx.css              # PPTX 网格 + 放映样式
│   │   └── themes/themes.css     # 7 种预设主题的 --color-* 覆盖
│   ├── js/
│   │   ├── settings.js           # 设置面板 + customColors + fontConfig
│   │   ├── themes/theme-manager.js
│   │   ├── markdown.js           # 渲染管线 + 图片灯箱
│   │   ├── file-tree.js          # 侧边栏/搜索/索引
│   │   ├── interactions.js       # 表格手柄、LaTeX 右键复制
│   │   ├── local-docs.js         # 本地文件/文件夹会话
│   │   ├── history.js / reading-pos.js  # 长按收藏·树内提示 / 阅读位置续读
│   │   ├── hover-preview.js / qr-share.js  # 链接悬浮预览 / 扫码续读
│   │   ├── gestures.js / storage-manager.js  # 移动端手势 / 设置面板存储管理区块
│   │   ├── search.js / ui.js     # 搜索命令面板 / 全局事件与快捷键路由
│   │   ├── i18n.js               # zh/en 界面语言包
│   │   ├── dom.js                # 按需加载 DOM 工具
│   │   ├── storage.js            # IndexedDB 笔记本
│   │   ├── pulse.js              # DG-LAB .pulse 波形解析与 [pulse]/[pulsemini] 渲染
│   │   ├── pulse-generator.js    # ?mode=pulsegen 可视化波形生成器
│   │   └── renderers/            # 14+ 个代码块/嵌入渲染器
│   ├── vendor/                   # 本地化的前端依赖
│   ├── plugins/                  # 插件（qrcode / countdown / colorcard）
│   ├── data/                     # 预构建数据
│   │   ├── file-tree.json / search-index.json / feed.xml / precache-manifest.json / sitemap.xml
│   │   ├── pkt/    json + images （Cisco Packet Tracer 拓扑）
│   │   ├── ensp/   xml + json    （华为 eNSP 拓扑：xml 原始工程，json 解析产物）
│   │   └── pptx/   json + svg/png （PPTX 渲染产物）
│   ├── icons/                    # 各类 PNG 图标
│   └── scripts/                  # 构建脚本（Node + Python）
│       ├── build-file-tree.js
│       ├── build-search-index.js
│       ├── build-feed.js
│       ├── build-sitemap.js      # sitemap.xml（robots.txt 指向）
│       ├── smoke-test.js         # CI 冒烟测试（jsdom）
│       ├── pkt/main.py           # .pkt 解析
│       ├── ensp/main.py          # .topo/.zip (华为 eNSP) → xml + json
│       └── pptx/main.py          # pptx → PDF → PNG/SVG + meta json
├── docs/
│   ├── show.md / getting-started.md
│   ├── editor.md / configuration.md
│   ├── roadmap.md / shortcuts.md
│   ├── theme-customization.md / code-highlight-theme.md
│   ├── plugin-development.md / rss.md
│   └── examples/                 # 27+ 篇功能示例
└── .github/workflows/
    ├── build-and-deploy.yml      # 构建产物 + 部署 GitHub Pages
    ├── build-feed.yml / build-search-index.yml  # feed + sitemap / 索引重建
    ├── build-pkt.yml / build-pptx.yml           # 拓扑 / PPTX 产物
    ├── smoke-test.yml            # CI 冒烟测试
    └── sync-to-product.yml       # 同步 product 分支
```
