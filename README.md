# Markdown Preview

一个极简风格的 Markdown 文档预览站点，专为 GitHub Pages 设计，完全静态，无需后端。

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
│   ├── features.md
│   ├── configuration.md
│   ├── theme-customization.md
│   ├── code-highlight-theme.md
│   ├── plugin-development.md
│   ├── rss.md
│   ├── getting-started.md
│   └── examples/           # 功能示例（27 篇）
└── .github/workflows/      # GitHub Actions：build-site / build-pkt / build-pptx
```

## 文档

- [快速开始](docs/getting-started.md)
- [功能总览](docs/features.md)
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

## 近期变更记录

以下为远程 `main` 分支最近的 80 条提交（从 `40e1873` 回溯），完整历史请运行 `git log`。

| 提交 | 标题 |
|------|------|
| `40e1873` | docs: 重写 README.md 与 readme-dev.md，移除 emoji，新增 examples 索引与字体/PPTX/按需加载等当前功能说明 |
| `19d1169` | feat(settings): 添加字体自定义入口（字号/字重/字色/字体族 + 远程字体加载） |
| `b2b0132` | build: update feed.xml |
| `19d7cb8` | chore(pptx): 移除示例文档中 example 演示及对应 data 产物 |
| `a005c70` | build: update feed.xml |
| `b99caed` | feat: 分析打卡项目卡顿原因 |
| `ce8739b` | feat: 分析打卡项目卡顿原因 |
| `8ec9059` | fix(pptx): 缩略图点击避免触发通用图片灯箱 |
| `69ea9c3` | fix(sw): 解决 Markdown 文档变更后前端仍显示旧版本问题 |
| `075cc6d` | feat(pptx): 新建 raw/pptx CI/CD 构建工作流，集成真实 PPTX 演示 |
| `a72ddac` | Add files via upload |
| `90f9ef2` | build: update search-index.json |
| `3fce366` | feat: 新增 PPTX 嵌入，参考 pkt 语法，支持缩略图网格+全屏放映 |
| `97c9652` | perf: 重型 vendor 库按需懒加载，首屏体积从 6.8MB 降至约 1MB |
| `f01a022` | fix: 修复代码块内容未 HTML 转义导致标签丢失 |
| `6da605b` | fix: 修复代码选项卡中代码块被外层 marked.parse 二次解析破坏的问题 |
| `d6179a1` | fix: 修复代码选项卡渲染逻辑中的错误 |
| `7407dd0` | build: update feed.xml |
| `7129817` | fix: 语法说明代码块改用4反引号包裹避免内部反引号提前结束代码块 |
| `e1ef070` | fix: 代码选项卡代码块横向滚动，分栏移动端改为横向滚动多列 |
| `859dc08` | build: update feed.xml |
| `3f0c825` | fix: 修复代码选项卡点击和代码块内语法误解析问题，重写示例文档 |
| `258f946` | fix: 修复代码选项卡和分栏布局渲染失败的问题 |
| `a9ef845` | build: update feed.xml |
| `6747434` | feat: 增加代码选项卡和分栏布局语法糖 |
| `c4a4446` | build: update feed.xml |
| `655a9db` | feat(spoiler): 添加 \|\|内容\|\| 遮罩/剧透语法支持 |
| `869e075` | fix(pulse): 迷你波形组自动居中显示 |
| `bc975c7` | fix(pulse): 修复 pulsemini 迷你波形渲染失败的问题 |
| `fc734b2` | build: update feed.xml |
| `ebb9a5d` | docs(pulse): 补充 pulsmini 迷你波形和波形生成器说明 |
| `3d8cd6f` | feat(pulse): 添加 [pulsemini] 迷你波形渲染支持 |
| `1a616a9` | fix(pulse-gen): 复制下载按钮移到标题行右侧，只显示图标 |
| `60b87d6` | fix(pulse-gen): 隐藏侧边栏和结果区滚动条 |
| `d06c1d9` | fix(pulse-gen): 迷你波形默认改为竖线样式 |
| `de9fda4` | feat(pulse): 添加波形生成器页面，可视化生成 .pulse 波形文件 |
| `3cce9a7` | fix(pulse): 滚动模式播放头居中，容器尺寸各方向减少5px |
| `fa67f5a` | feat(pulse): 添加滚动模式切换，支持全局/滚动两种视图 |
| `dc54add` | fix(pulse): 移动端响应式适配优化 |
| `064efd7` | feat(pulse): 添加查看源代码按钮，可展开显示 pulse 源码 |
| `b56138c` | build: update feed.xml |
| `1c610d1` | feat(pulse): 添加竖线扫描线样式切换，修复代码块内标签渲染，更新示例文档 |
| `2387821` | build: update feed.xml |
| `5cbe59d` | feat(pulse): 更新为 DG-LAB 官方波形文件格式 |
| `cb7a992` | build: update feed.xml |
| `8716213` | feat: 文档站集成郊狼波形文件解析 |
| `107d0cd` | build: update feed.xml |
| `ab31aea` | Merge pull request #8 from omajili-manbu/main |
| `643ccbb` | Merge pull request #3 from omajili-manbu/trae/agent-Gkrsr1 |
| `0b1b4b2` | feat: Iris Plugin Development and Docs |
| `99de76b` | Merge pull request #7 from omajili-manbu/main |
| `7b691de` | refactor: 将 .build-cm6 移至 iris/scripts/cm6-bundle |
| `2478861` | Merge pull request #6 from omajili-manbu/main |
| `6456c52` | Merge pull request #2 from omajili-manbu/trae/agent-gkYtG1 |
| `1044cc9` | feat: sync latest updates |
| `7a832b9` | feat: save progress |
| `47b7936` | feat: sync latest updates |
| `5bbb1ab` | feat: sync latest updates |
| `c6bb356` | feat: update workspace |
| `1bd5e04` | feat: save progress |
| `9723df2` | feat: apply changes |
| `c959b3c` | feat: apply changes |
| `f369b83` | feat: update workspace |
| `a3614cc` | Merge pull request #1 from omajili-manbu/trae/agent-gkYtG1 |
| `cae9bc3` | feat: apply changes |
| `5b67ff9` | fix: 修复插件系统导致的页面崩溃 |
| `826f9d4` | build: update search-index.json |
| `a5bd246` | refactor(plugins): 重构插件系统 API，增强扩展能力与生命周期管理 |
| `448f126` | build: update feed.xml |
| `3ce1cc9` | build: update search-index.json |
| `c767dab` | feat(ensp): 修复 eNSP XML 解析器并添加示例文档 |
| `cb40e62` | Add files via upload |
| `e7e2239` | Create 1.txt |
| `e69e1a0` | feat: 添加目录树对齐线 |
| `7790127` | feat(ensp): 支持 .zip 压缩包导入 |
| `1b7a931` | feat: 添加目录树对齐线 |
| `c3c2d6a` | feat(topology): 新增 eNSP 和 Graphviz DOT 拓扑解析支持 |
| `0e45e19` | feat(pkt): 增强拓扑信息完整性——PC配置/BGP/RIP/默认路由/链路网段 |
| `a2b0700` | fix(editor): 修复 cell 中 pkt 拓扑图无法渲染的问题 |
| `2e8eb64` | build: update feed.xml |

> 若需更完整的历史（共 371 条），请在仓库目录执行：`git log --oneline`。
