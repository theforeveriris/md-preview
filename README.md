# Markdown Preview

<div class="badge-row">
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript"><img src="https://img.shields.io/badge/Made%20with-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="made-with-javascript"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/HTML"><img src="https://img.shields.io/badge/Made%20with-HTML5-E34F26?logo=html5&logoColor=white" alt="made-with-html5"></a>
  <a href="https://developer.mozilla.org/en-US/docs/Web/CSS"><img src="https://img.shields.io/badge/Made%20with-CSS3-1572B6?logo=css3&logoColor=white" alt="made-with-css3"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Made%20with-Node.js-339933?logo=nodedotjs&logoColor=white" alt="made-with-nodejs"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Made%20with-Python-3776AB?logo=python&logoColor=white" alt="made-with-python"></a>
  <a href="https://daringfireball.net/projects/markdown/"><img src="https://img.shields.io/badge/Markdown-000000?logo=markdown&logoColor=white" alt="markdown"></a>
  <a href="https://github.com/markedjs/marked"><img src="https://img.shields.io/badge/Powered%20by-Marked-brightgreen" alt="marked"></a>
  <a href="https://mermaid.js.org/"><img src="https://img.shields.io/badge/Chart-Mermaid-FF3670?logo=mermaid" alt="mermaid"></a>
  <a href="https://plantuml.com/"><img src="https://img.shields.io/badge/UML-PlantUML-1ABD1A" alt="plantuml"></a>
  <a href="https://apexcharts.com/"><img src="https://img.shields.io/badge/Charts-ApexCharts-008FFB" alt="apexcharts"></a>
  <a href="https://katex.org/"><img src="https://img.shields.io/badge/Math-KaTeX-008080" alt="katex"></a>
  <a href="https://highlightjs.org/"><img src="https://img.shields.io/badge/Syntax-Highlight.js-519ABA?logo=hljs" alt="highlight.js"></a>
  <a href="https://cytoscape.org/"><img src="https://img.shields.io/badge/Topology-Cytoscape.js-F7DF1E?logo=cytoscapedotjs&logoColor=black" alt="cytoscape.js"></a>
  <a href="https://leafletjs.com/"><img src="https://img.shields.io/badge/Map-Leaflet-199900?logo=leaflet&logoColor=white" alt="leaflet"></a>
  <a href="https://web.dev/progressive-web-apps/"><img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa" alt="pwa"></a>
  <a href="https://pages.github.com/"><img src="https://img.shields.io/badge/Deploy-GitHub%20Pages-222222?logo=githubpages" alt="github-pages"></a>
  <a href="https://github.com/features/actions"><img src="https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white" alt="github-actions"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?logo=gnu" alt="license"></a>
  <a href="./docs/LICENSE"><img src="https://img.shields.io/badge/Docs%20License-CC--BY--SA--4.0-EF9421?logo=creativecommons&logoColor=white" alt="license-docs"></a>
</div>

一个~~极简~~**我流**风格的 Markdown 文档预览站点，专为 GitHub Pages 设计，完全静态，无需后端。

---
**本项目建立的初衷是我的其他项目需要文档站，但网路上现存的文档站要么丑，要么部署麻烦（我期望动动手指在 GitHub Mobile 传几个 .md 文件就自动在本仓库里部署了，要么没有我想要的功能没有预置）。好啦，那干脆自己做一个好了，那时的我如是想。**


几经放弃，中途也萌生过换技术栈为 react，但由于种种原因，居然还是使用传统的 js 写完了。这算是复古吗？~~或许我哪天心血来潮就去改成 react了？~~ 就像我重拾废弃的项目时。~~AI 时代的新模型总能给我重构和 debug 的信心。~~ 

闲话说完，本项目包含基础 markdown、mermaid 渲染、plantuml 渲染、 ApexCharts 的各种图表渲染、多栏文本、类似于萌娘百科的文本遮罩、多标签代码块、diff 渲染、外部服务嵌入、~~推特帖子嵌入（待修复）~~、pkt 或 ensp 拓扑图渲染、ppt 渲染、latex 公式渲染、多种主题画廊渲染、郊狼波形渲染，支持显示自定义页面主题、配色、css，支持 pwa 安装、rss 订阅，内置包含各类本项目语法糖的仿 jupyter notebook 渲染页、郊狼波形生成器等等

Demo：https://theforeveriris.github.io/md-preview/

项目各功能截图展示和索引：https://theforeveriris.github.io/md-preview/#/docs/show.md

---

## 特性

### 文档浏览

- 自动发现：自动扫描仓库中所有 `.md` 文件，构建文档目录树（含字数统计）
- 全文搜索：基于 FlexSearch 的中文分词全文检索，结果关键词高亮
- Hash 路由：每个文档有独立 URL，支持分享和书签
- 上一篇 / 下一篇：悬浮球快速翻阅相邻文档
- 打开本地 MD：临时预览本地 Markdown 文件，无需入库
- 阅读时间估算：自动计算预计阅读时长
- Frontmatter：支持 YAML 元数据解析

### 渲染能力

- 7 种内置主题：默认 / GitHub Light / GitHub Dark / Notion / Arc Dark / Dracula / Nord
- 图片灯箱：点击放大、缩放、键盘左右键翻页
- GitHub 风格 Alerts：支持 `[!NOTE]` `[!WARNING]` 等提示语法
- 代码块增强：一键复制按钮、语言标签、横向滚动优化、代码 Tabs
- 长表格优化：自动包裹支持横向滚动
- 标题锚点分享：标题悬浮出现复制链接按钮，直达章节
- Packet Tracer 拓扑：解析 Cisco `.pkt` 文件，渲染交互式网络拓扑图（基于 Cytoscape.js）
- 华为 eNSP 拓扑：解析 `.topo` / `.zip` 华为 eNSP 工程文件，渲染路由器/交换机等网络设备拓扑
- PPTX 嵌入：通过预处理将 PPTX 渲染为多页图片网格，点击可进入全屏放映模式
- 画廊布局：@grid / @cardstack / @filmstrip / @polaroid 等多种图片画廊 CSS 布局
- 二维码生成：`qrcode` 代码块生成任意内容二维码
- 倒计时组件：`countdown` 代码块渲染实时倒计时
- Spoiler 折叠：内置剧透折叠块语法
- Columns / ColorCard：页面分栏与彩色卡片布局

### 主题与外观

- 可视化配色取色器：强调色 / 中性色独立调整，支持自定义亮色或暗色主题
- 字体自定义：
  - 远程字体 URL（Google Fonts 等 CSS URL 即可加载）
  - 展示字体族（标题衬线体）与正文字体族（UI/正文无衬线体）自由填写
  - 字号细调：UI / 正文 / H1 / H2 / H3 独立设置
  - 字重细调：UI / 正文 / 展示体 / H1 / H2 / H3 独立选择（300 ~ 800）
  - 字色：正文与次要文字颜色独立取色
  - 一键「重置字体」恢复默认
- 代码高亮主题：10 种内置方案 + 自定义 highlight.js 主题 URL
- 自定义 CSS：加载外部 CSS 文件进一步定制

### 输出与订阅

- 导出 PDF：通过浏览器打印对话框导出为 PDF
- 导出 Markdown：下载当前文章为 `.md`
- RSS 源：自动生成 `feed.xml`，支持 RSS 阅读器订阅
- PWA 支持：可安装到桌面，离线访问已访问文档，更新时提示刷新

### 工程与开发

- 插件系统：支持扩展自定义渲染器
- 编辑此页：悬浮球快速跳转 GitHub 编辑页面
- 响应式设计：完美适配桌面端和移动端
- 按需懒加载：Mermaid / ApexCharts / Leaflet / KaTeX / Diff2Html / Cytoscape.js 等重型库只在命中对应代码块时加载，首屏体积从约 6.8MB 降至约 1MB

### 内置编辑器

- 类 Jupyter Cell 编辑器：全屏覆盖层，按 Cell 编写并即时渲染 Markdown
- 运行与预览：单 Cell 运行 / 运行全部 / 运行至下方，渲染管线与文档站一致
- 自动保存：IndexedDB 存储 + 1.5s 防抖保存，刷新不丢内容，多笔记本多 Tab 支持
- 搜索替换：跨所有 Cell 查找、替换、跳转
- 11 类自动补全：`@` / `` ``` `` / `#` / `$$` / `![` 等触发字符即弹补全，120+ 条目
- 8 大工具栏菜单：Markdown / HTML / 私有语法 / 工具渲染 / 插入 / 嵌入 / 下载 / 导入
- 2 列右键菜单：17 项 Cell 操作，视口边界自适应定位
- 导入导出：`.md` / `.html` / `.pdf` / `.mdnb` 笔记本格式
- 字号与主题：4 档字号、亮/暗主题独立切换

详见 [编辑器说明](docs/editor.md)。

## 快速开始

### GitHub Pages 部署

1. Fork 本仓库
2. 进入仓库 Settings → Pages
3. Source 选择 GitHub Actions
4. 修改 `iris/config.json` 中的 `owner` 和 `repo` 为你的信息
5. 推送代码，等待 GitHub Actions 自动构建部署

### 本地预览

```bash
# 克隆仓库
git clone <your-repo-url>
cd <repo-name>

# 构建文件树（可选，不构建则使用 GitHub API 回退）
node iris/scripts/build-file-tree.js

# 构建搜索索引
node iris/scripts/build-search-index.js

# 构建 RSS feed
node iris/scripts/build-feed.js

# 构建 PKT/eNSP 产物（若有 raw 目录文件）
python3 iris/scripts/pkt/main.py
python3 iris/scripts/ensp/main.py

# 构建 PPTX 产物（若有 data/pptx/raw 下的 ppt/pptx 文件）
python3 iris/scripts/pptx/main.py

# 用浏览器打开 index.html
```

## 配置

修改 `iris/config.json` 自定义基础配置：

```json
{
  "owner": "your-username",
  "repo": "your-repo-name"
}
```

更多运行时配置（主题、配色、代码高亮、显示选项、字体定制等）在站点右上角悬浮球 → 设置 中调整，详见 [配置参考](docs/configuration.md)。

## 文档放置

在仓库任意位置创建 `.md` 文件即可，系统会自动发现并显示在侧边栏。推荐放在 `docs/` 目录下。

```
你的仓库/
├── README.md
├── readme-dev.md
├── docs/
│   ├── guide.md
│   ├── api/
│   │   └── reference.md
│   └── examples/
│       └── table-examples.md
└── ...
```

## 支持的渲染功能

| 功能 | 说明 |
|------|------|
| Markdown 基础 | 标题、列表、表格、引用、代码块等 |
| Mermaid 图表 | 流程图、时序图、甘特图等 18+ 种 |
| PlantUML | UML 图、架构图、思维导图等 |
| ApexCharts | 交互式折线图、柱状图、饼图等 |
| LaTeX 公式 | 基于 KaTeX 的数学公式渲染 |
| 二维码 | 使用 `qrcode` 代码块生成二维码 |
| Diff 可视化 | Git Diff 语法高亮对比 |
| GeoJSON | 基于 Leaflet 的地理数据地图 |
| Packet Tracer | Cisco .pkt 网络拓扑图渲染（Cytoscape.js） |
| 华为 eNSP | .topo / .zip 路由器交换机网络拓扑图渲染（Cytoscape.js） |
| PPTX 嵌入 | 图片网格 + 全屏放映，支持 CI/CD 自动预处理 |
| 外部嵌入 | YouTube、Bilibili、Twitter、Figma、CodePen 等 |
| GitHub Alerts | `[!NOTE]` `[!TIP]` `[!WARNING]` 等 |
| Pulse 波形 | DG-LAB 郊狼电击器 `.pulse` 波形解析、迷你波形、滚动/全局模式、可视化波形生成器 |

## 示例文档索引

全部示例位于 [docs/examples/](docs/examples/)，按文件名与功能对应关系如下：

| 文件名 | 功能说明 |
|--------|----------|
| `markdown-syntax.md` | Markdown 基础语法总览 |
| `basic-usage.md` | 基础使用与常见排版 |
| `table-examples.md` | 表格展示与长表格优化 |
| `theme-demo.md` | 7 种内置主题的视觉对比 |
| `image-gallery-examples.md` | 图片与灯箱功能示例 |
| `gallery-layouts.md` | @grid / @cardstack 等画廊布局示例 |
| `github-alerts-examples.md` | GitHub 风格 Alerts 提示语法 |
| `native-html-examples.md` | HTML 原生标签排版技巧 |
| `columns-examples.md` | Columns 分栏布局 |
| `colorcard-examples.md` | ColorCard 彩色卡片 |
| `spoiler-examples.md` | 剧透/折叠块语法 |
| `code-tabs-examples.md` | 代码 Tabs 多语言并排 |
| `countdown-examples.md` | Countdown 倒计时组件 |
| `qrcode-examples.md` | 二维码生成 |
| `mermaid-examples.md` | Mermaid 各类图表 |
| `plantuml-examples.md` | PlantUML UML 与架构图 |
| `apexcharts-examples.md` | ApexCharts 交互式图表 |
| `latex-examples.md` | LaTeX / KaTeX 数学公式 |
| `diff-examples.md` | Diff 差异可视化 |
| `geojson-examples.md` | GeoJSON 地图 |
| `pkt-examples.md` | Packet Tracer .pkt 拓扑渲染 |
| `ensp-examples.md` | 华为 eNSP .topo/.zip 拓扑渲染 |
| `pptx-examples.md` | PPTX 嵌入语法与放映示例 |
| `pulse-examples.md` | DG-LAB 郊狼 `.pulse` 波形与迷你波形示例 |
| `pulse-generator-page.md` | 郊狼波形批量生成特殊页面说明（`?mode=pulsegen`） |
| `pkt-huawei-vrp-解析示例.md` | 华为 VRP 配置步骤推算解析示例 |
| `embed-examples.md` | YouTube / Bilibili / Figma / CodePen 嵌入 |
| `twitter-embed-examples.md` | Twitter 推文嵌入 |
| `plugin-demo.md` | 插件系统演示 |

## 项目结构

```
.
├── index.html              # 入口页面
├── manifest.json           # PWA 清单
├── sw.js                   # Service Worker
├── README.md               # 用户手册
├── readme-dev.md           # 开发者文档
├── iris/
│   ├── app.js              # 应用入口
│   ├── config.json         # 用户配置（owner/repo 等）
│   ├── styles.css          # 样式入口
│   ├── css/                # 模块化样式
│   │   ├── base.css        # 基础变量与 reset
│   │   ├── layout.css      # 侧边栏与布局
│   │   ├── markdown.css    # Markdown 正文样式
│   │   ├── floating.css    # 悬浮球、设置面板、工具栏
│   │   ├── editor.css      # 内置编辑器样式
│   │   ├── themes/         # 7 种内置主题
│   │   ├── pkt/            # Packet Tracer 渲染样式
│   │   └── pptx.css        # PPTX 缩略图网格与放映样式
│   ├── js/                 # 核心功能模块
│   │   ├── settings.js     # 设置面板、配色、字体自定义
│   │   ├── themes/theme-manager.js  # 主题切换
│   │   ├── markdown.js     # Markdown 渲染 + 图片灯箱
│   │   ├── renderers/      # 各代码块渲染器（mermaid/pkt/pptx 等）
│   │   └── storage.js      # IndexedDB 笔记本存储
│   ├── vendor/             # 第三方依赖（本地化）
│   ├── plugins/            # 插件目录
│   ├── icons/              # 图标资源
│   ├── data/               # 预构建数据
│   │   ├── file-tree.json
│   │   ├── search-index.json
│   │   ├── feed.xml
│   │   ├── pkt/ json + images
│   │   ├── ensp/ json + xml
│   │   └── pptx/ json + svg/png
│   └── scripts/            # 构建脚本
│       ├── build-file-tree.js
│       ├── build-search-index.js
│       ├── build-feed.js
│       ├── pkt/main.py       # PKT 产物生成
│       ├── ensp/main.py      # eNSP 拓扑 XML → JSON 解析
│       └── pptx/main.py      # PPTX → PDF → PNG/SVG 转换
├── docs/                   # 用户文档
│   ├── editor.md
│   ├── show.md             # 运行时截图展示
│   ├── configuration.md
│   ├── theme-customization.md
│   ├── code-highlight-theme.md
│   ├── plugin-development.md
│   ├── rss.md
│   ├── getting-started.md
│   └── examples/           # 功能示例（27+ 篇）
└── .github/workflows/      # GitHub Actions：build-site / build-pkt / build-pptx
```

## 文档

- [快速开始](docs/getting-started.md)
- [系统运行时截图](docs/show.md)
- [编辑器说明](docs/editor.md)
- [配置参考](docs/configuration.md)
- [主题定制](docs/theme-customization.md)
- [代码高亮主题](docs/code-highlight-theme.md)
- [插件开发指南](docs/plugin-development.md)
- [RSS 订阅](docs/rss.md)
- [开发者文档](readme-dev.md)

## 致谢

本项目基于众多优秀的开源项目构建，在此向所有项目的作者和贡献者表示衷心感谢。

### 核心引擎

| 项目 | 用途 | 许可证 |
|------|------|--------|
| [marked](https://github.com/markedjs/marked) | Markdown 解析为 HTML 的核心引擎 | MIT |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 代码块语法高亮（10 套主题） | BSD-3-Clause |
| [FlexSearch](https://github.com/nextapps-de/flexsearch) | 中文分词全文搜索引擎 | Apache-2.0 |

### 图表与可视化

| 项目 | 用途 | 许可证 |
|------|------|--------|
| [Mermaid](https://github.com/mermaid-js/mermaid) | 流程图、时序图、甘特图等 18+ 种图表 | MIT |
| [ApexCharts](https://github.com/apexcharts/apexcharts.js) | 交互式折线图、柱状图、饼图等 | MIT |
| [KaTeX](https://github.com/KaTeX/KaTeX) | LaTeX 数学公式渲染 | MIT |
| [Diff2Html](https://github.com/rtfpessoa/diff2html) | Git Diff 差异可视化 | MIT |
| [Cytoscape.js](https://github.com/cytoscape/cytoscape.js) | Packet Tracer 网络拓扑图渲染 | MIT |

### 地图与地理数据

| 项目 | 用途 | 许可证 |
|------|------|--------|
| [Leaflet](https://github.com/Leaflet/Leaflet) | GeoJSON / TopoJSON 地图渲染 | BSD-2-Clause |
| [OpenStreetMap](https://www.openstreetmap.org) | 地图瓦片数据服务 | ODbL |

### 工具库

| 项目 | 用途 | 许可证 |
|------|------|--------|
| [pako](https://github.com/nodeca/pako) | PlantUML 文本压缩（zlib） | MIT AND Zlib |
| [sharp](https://github.com/lovell/sharp) | PWA 图标生成（构建期） | Apache-2.0 |
| [LibreOffice](https://www.libreoffice.org) | PPTX → PDF 导出（CI 构建期） | MPL 2.0 |
| [Poppler / pdftoppm](https://poppler.freedesktop.org) | PDF → PNG/SVG 转换（CI 构建期） | GPL |

### 图标与设计资源

| 项目 | 用途 | 许可证 |
|------|------|--------|
| [VMware Clarity Icons](https://github.com/vmware-archive/clarity-assets) | 网络设备图标（路由器/交换机/防火墙等） | MIT |
| [Tabler Icons](https://github.com/tabler/tabler-icons) | 设备图标补充 | MIT |
| [Geist UI Icons](https://github.com/vercel/geist-ui) | 文件树组件图标 | MIT |

### 字体

| 项目 | 用途 | 许可证 |
|------|------|--------|
| [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) | 标题衬线字体（默认） | OFL 1.1 |
| [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) | 正文无衬线字体（默认） | OFL 1.1 |
| [Google Fonts](https://fonts.google.com) | 字体分发服务，也支持用户在设置里填写任意远程字体 URL | — |

### 运行时服务

以下服务在运行时被调用，感谢其提供的公共服务：

- PlantUML 公共服务器 — UML 图表渲染
- OpenStreetMap — 地图瓦片
- Shields.io / Badgen — 徽章图生成
- YouTube / Bilibili / Twitter / CodePen / Figma 等嵌入服务

## License

本项目采用代码与内容分离的多许可证方案：

| 范围 | 许可证 | 说明 |
|------|--------|------|
| 项目源代码（`iris/` 目录） | [AGPL-3.0](./LICENSE) | 允许商用，但修改后部署为网络服务须公开源码 |
| 文档内容（`docs/` 目录） | [CC-BY-SA-4.0](./docs/LICENSE) | 允许再分发，但须署名并以相同许可共享 |
| 第三方依赖 | 各自原有许可证 | 详见 THIRD_PARTY_LICENSES |

### 为什么选择 AGPL-3.0

AGPL-3.0 在 GPL 的基础上增加了"网络交互即触发分发"条款，能有效防止他人将本项目修改后部署为闭源网络服务。对于纯前端静态站点项目，这是保护开源的最有效方案。
