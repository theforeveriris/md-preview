# 功能总览

Markdown Preview 是一个极简风格的 Markdown 文档预览站点，专为 GitHub Pages 设计，完全静态，无需后端。

---

## 一、文档浏览

| 功能 | 说明 |
|------|------|
| 自动发现 | 扫描仓库所有 `.md` 文件，构建嵌套目录树 |
| 字数统计 | 每个文件旁显示字数（可在设置中关闭） |
| 文件名截断 | 长文件名截断/展开切换（展开时区域可横向滚动，隐藏滚动条） |
| Hash 路由 | 每个文档有独立 URL（`#/docs/foo.md`），支持分享与书签 |
| 上一篇 / 下一篇 | 悬浮球快速翻阅相邻文档 |
| 打开本地 MD | 选择本地 `.md` 文件预览（不写入 URL，刷新后丢失） |
| 阅读时间估算 | 自动计算预计阅读时长 |
| Frontmatter | 支持 YAML 元数据解析（title / description / date 等） |
| 面包屑导航 | 顶部显示当前文档路径 |
| 编辑此页 | 悬浮球跳转 GitHub 编辑页面 |

## 二、全文搜索

| 功能 | 说明 |
|------|------|
| FlexSearch 引擎 | 中文分词、模糊匹配、标题 + 正文 + 路径复合索引 |
| 预构建索引 | `iris/data/search-index.json`，避免运行时全量扫描 |
| 关键词高亮 | 搜索结果中匹配片段用 `<mark>` 高亮 |
| 实时搜索 | 输入即时返回结果 |
| 完整路径 | 直接使用索引中的 `path`，避免硬编码前缀拼接 |

## 三、Markdown 渲染

| 功能 | 说明 |
|------|------|
| GFM | 支持 GitHub Flavored Markdown（表格、任务列表、删除线等） |
| 代码块增强 | 复制按钮、语言标签、`data-lang` 属性、横向滚动 |
| 图片增强 | 懒加载、画廊模式、错误降级 |
| 图片灯箱 | 点击放大、滚轮缩放、左右键翻页、Esc 关闭 |
| 长表格优化 | 自动包裹 `.table-wrapper` 支持横向滚动 |
| GitHub Alerts | `[!NOTE]` `[!TIP]` `[!WARNING]` `[!IMPORTANT]` `[!CAUTION]` |
| 标题锚点 | 标题悬浮出现复制链接按钮，直达章节 |
| 动态标题 | `document.title` 随文档更新（SEO 友好） |

## 四、扩展渲染器

| 类型 | 说明 | 示例 |
|------|------|------|
| Mermaid | 流程图、时序图、甘特图等 18+ 种 | [示例](examples/mermaid-examples.md) |
| PlantUML | UML 图、架构图、思维导图 | [示例](examples/plantuml-examples.md) |
| ApexCharts | 交互式折线图、柱状图、饼图 | [示例](examples/apexcharts-examples.md) |
| LaTeX | 基于 KaTeX 的数学公式 | [示例](examples/latex-examples.md) |
| 二维码 | `qrcode` 代码块 | [示例](examples/qrcode-examples.md) |
| Diff | Git Diff 语法高亮对比 | [示例](examples/diff-examples.md) |
| GeoJSON | 基于 Leaflet 的地理数据地图 | [示例](examples/geojson-examples.md) |
| Packet Tracer | Cisco .pkt 网络拓扑图（Cytoscape.js 渲染） | [示例](examples/pkt-examples.md) |
| 外部嵌入 | YouTube、Bilibili、Figma、CodePen 等 | [示例](examples/embed-examples.md) |
| Pulse 波形 | 郊狼 Dungeonlab+pulse 波形文件动态渲染 | [示例](examples/pulse-examples.md) |

## 五、主题与外观

| 功能 | 说明 |
|------|------|
| 7 种内置主题 | default / github-light / github-dark / notion / arc-dark / dracula / nord |
| 取色器（强调色） | 主色 / 粉色 / 深色独立调整 |
| 取色器（中性色） | 背景 / 表面 / 边框 / 文字 / 次要文字，可组合亮色或暗色主题 |
| 代码高亮主题 | 10 种内置方案 |
| 自定义高亮 JS | 加载外部 highlight.js 主题 CSS URL |
| 自定义 CSS | 加载外部 CSS 文件完全定制样式 |
| 主题持久化 | 所有设置保存在 localStorage |

详见 [主题定制](theme-customization.md) 与 [代码高亮主题](code-highlight-theme.md)。

## 六、输出与订阅

| 功能 | 说明 |
|------|------|
| 下载 Markdown | 下载当前打开的 `.md` 源文件 |
| 导出 PDF | 通过浏览器打印对话框导出 PDF（`@media print` 自动隐藏 UI） |
| RSS 源 | 自动生成 `feed.xml`，支持 RSS 阅读器订阅，详见 [RSS 订阅](rss.md) |

## 七、PWA

| 功能 | 说明 |
|------|------|
| 可安装 | 安装到桌面/手机主屏幕 |
| 离线访问 | 预缓存首屏静态资源，文档网络优先 + 离线降级缓存 |
| 更新提示 | 资源更新时 toast 提示用户刷新 |
| 安装入口 | 悬浮球菜单中的「安装到桌面」按钮（仅浏览器支持时显示） |

## 八、插件系统

支持扩展自定义渲染器，插件放入 `iris/plugins/` 目录自动发现注册。详见 [插件开发指南](plugin-development.md)。

## 八.5、内置 Markdown 编辑器

类 Jupyter 的 Cell 化编辑器，全屏覆盖层形式叠加在文档站之上，复用站点渲染管线。详见 [编辑器说明](editor.md)。

| 功能 | 说明 |
|------|------|
| 入口 | URL `?mode=editor` / 设置面板「打开编辑器」/ `MarkdownPreview.enterEditorMode()` |
| Cell 模型 | markdown / plaintext 两种类型，每 Cell 独立编辑 + 渲染输出 |
| 运行 | 运行当前 (`Ctrl+Enter`) / 运行全部 (`Ctrl+Shift+Enter`) / 运行此 Cell 及下方 |
| 自动保存 | localStorage `mdnb_autosave_v2`，1.5s 防抖，刷新不丢内容 |
| 自动补全 | 11 类触发字符（`@` / ` ``` ` / `> [!` / `#` / `-` / `\|` / `---` / `>` / `$$` / `![` / `[`），120+ 条目 |
| 工具栏菜单 | 8 大下拉：Markdown / HTML / 私有语法 / 工具渲染 / 插入 / 嵌入 / 下载 / 导入 |
| 右键菜单 | 2 列 17 项操作，视口边界自适应定位，窄屏回退单列 |
| 搜索替换 | 跨所有 Cell 查找 / 替换 / 全部替换，`F3` / `Shift+F3` 导航 |
| 选中浮动工具栏 | B / I / S / code / H1~H3 / link / quote / ul 快速格式化 |
| 字号与主题 | 4 档字号（12/14/16/18）、亮/暗主题，独立于文档站持久化 |
| 导入导出 | `.md` / `.html` / 内联 CSS HTML / `.pdf` / `.mdnb` 笔记本 / 合并 `.md` |
| 快捷键 | `Ctrl+B/I/K/`` ` 格式化、`Tab` / `Shift+Tab` 缩进、`Esc` 关闭弹层 |
| 状态栏 | Cell 数 / 运行统计 / 字数 / 行数 / 光标 / 活跃 Cell / 保存状态 |

## 九、工程能力

| 能力 | 说明 |
|------|------|
| GitHub Pages 部署 | 推送 `main` 自动构建部署 |
| 文件树预构建 | `build-file-tree.js` |
| 搜索索引预构建 | `build-search-index.js`（`docs/**` 变更自动触发） |
| RSS feed 预构建 | `build-feed.js`（`docs/**` 变更自动触发） |
| PKT 拓扑构建 | `build-pkt.yml` CI 自动解密解析 .pkt 文件生成 JSON（mtime 增量） |
| Product 分支同步 | 自动创建无文档的纯应用分支 |
| 调试模式 | URL 加 `?debug=1` 显示环境/性能/文档/搜索/主题/缓存 6 大类调试信息，每 2 秒自动刷新 |

## 十、悬浮球菜单

7 个快捷入口：

1. 回到顶部
2. 上一篇
3. 下一篇
4. 打开本地 MD
5. 安装到桌面（PWA）
6. 编辑此页
7. 设置

---

## 相关文档

- [快速开始](getting-started.md)
- [编辑器说明](editor.md)
- [Packet Tracer 拓扑示例](examples/pkt-examples.md)
- [配置参考](configuration.md)
- [主题定制](theme-customization.md)
- [代码高亮主题](code-highlight-theme.md)
- [插件开发指南](plugin-development.md)
- [RSS 订阅](rss.md)
- [优化路线图](feat.md)
- [开发者文档](../readme-dev.md)
