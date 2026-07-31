# Markdown 编辑器

Markdown Preview 内置一个类 Jupyter 的 Cell 化 Markdown 编辑器，可在浏览器内即时编写、运行、预览 Markdown，并支持自动保存、搜索替换、导入导出等能力。

编辑器以全屏覆盖层的形式叠加在文档站之上，复用站点已有的渲染管线（marked.js + 各扩展渲染器），所有渲染结果与文档站完全一致。

---

## 一、入口与退出

### 进入编辑器

三种方式任选其一：

1. **URL 参数**：在站点任意 URL 后追加 `?mode=editor`，例如 `https://theforeveriris.github.io/md-preview/?mode=editor`
2. **设置面板**：右上角悬浮球 → 设置 → 操作 → 「打开编辑器」
3. **JS 调用**：在控制台或代码中执行 `window.MarkdownPreview.enterEditorMode()`

### 退出编辑器

- 工具栏左上角「文档站」按钮
- 调用 `window.MarkdownPreview.exitEditorMode()`

退出后 URL 上的 `mode=editor` 参数会被移除，回到文档浏览模式。

---

## 二、界面布局

编辑器为单页全屏结构，自上而下分为五个区域：

```
┌─────────────────────────────────────────────────────┐
│  顶部工具栏 (editor-toolbar)                          │
│  左：返回文档站 / 标题 / Cell 计数                     │
│  中：7 个下拉菜单（Markdown / HTML / 私有语法 /        │
│      工具渲染 / 插入 / 下载 / 导入）                   │
│  右：字号 / 搜索 / 主题 / 清空 / 全部运行 / 运行       │
├─────────────────────────────────────────────────────┤
│  搜索/替换面板 (search-panel，按需展开)                │
├─────────────────────────────────────────────────────┤
│  Cell 容器 (editor-main，可滚动)                      │
│    ┌───────────────────────────────────────────┐    │
│    │  Cell 1                                    │    │
│    │  ┌─────────────────────────────────────┐  │    │
│    │  │ 编辑区 (textarea + 行号)             │  │    │
│    │  └─────────────────────────────────────┘  │    │
│    │  ┌─────────────────────────────────────┐  │    │
│    │  │ 渲染输出区 (.cell-output)            │  │    │
│    │  └─────────────────────────────────────┘  │    │
│    └───────────────────────────────────────────┘    │
│    ┌───────────────────────────────────────────┐    │
│    │  Cell 2 ...                                │    │
│    └───────────────────────────────────────────┘    │
│    ┌─ + 新建 Cell (全局按钮，仅最后一个 Cell 下方) ─┐  │
├─────────────────────────────────────────────────────┤
│  底部状态栏 (editor-statusbar)                        │
│  左：Cell 数 / 运行统计 / 字数 / 行数 / 当前 Cell 字数 │
│  右：光标位置 / 活跃 Cell / 保存状态                  │
└─────────────────────────────────────────────────────┘
```

此外还有三个浮动元素：

- **选中文字浮动工具栏**：在 textarea 中选中文字时浮现，提供 B/I/S/code/H1~H3/link/quote/ul 快速格式化
- **Cell 右键菜单**：右键任意 Cell 弹出，2 列布局共 17 项操作
- **自动补全列表**：输入触发字符时浮现，按 ↑↓ 选择、Enter/Tab 确认

---

## 三、Cell 模型

### Cell 类型

| 类型 | 标识 | 行为 |
|------|------|------|
| `markdown` | MD | 内容经过完整渲染管线（Mermaid / KaTeX / 代码高亮等） |
| `plaintext` | TXT | 纯文本，不渲染，原样显示在输出区 |

通过右键菜单「切换类型」或导入时的 `---` 分隔符切换。

### Cell 结构

每个 Cell 由以下部分组成：

- **头部 (cell-header)**：Cell 编号、状态点（灰=未运行 / 绿=已运行 / 橙=已修改）、类型徽章、行数；右侧 6 个操作按钮（运行 / 折叠 / 上移 / 下移 / 复制 / 删除）
- **编辑区 (cell-editor-wrap)**：行号栏 + textarea，支持 Tab 缩进、Shift+Tab 反缩进
- **输出区 (cell-output)**：运行后显示渲染结果，未运行时隐藏
- **输出工具栏 (cell-output-toolbar)**：运行后浮现，提供「复制 HTML / 清空输出 / 折叠输出 / 导出此 Cell」四项操作

### 新建 Cell

- **全局按钮**：在最后一个 Cell 下方有且仅有一个「+ 新建 Cell」虚线按钮
- **快捷键**：`Ctrl+Shift+N` 在当前 Cell 下方新建
- **右键菜单**：「上方插入 Cell」/「下方插入 Cell」

### 运行 Cell

- **运行当前**：工具栏「运行」按钮 / Cell 头部播放按钮 / `Ctrl+Enter`
- **运行全部**：工具栏「全部运行」按钮 / `Ctrl+Shift+Enter`
- **运行此 Cell 及下方**：右键菜单
- 运行后状态点变绿；编辑后变橙（已修改，需重新运行）

---

## 四、顶部工具栏菜单

工具栏中央有 8 个下拉菜单，覆盖 Markdown 写作所需的全部能力。

### 1. Markdown

| 分组 | 项 |
|------|------|
| 标题 | H1 ~ H6 |
| 格式 | 粗体 / 斜体 / 粗斜体 / 删除线 / 行内代码 / 高亮 |
| 列表 | 无序 / 有序 / 任务 / 已完成任务 |
| 插入 | 链接 / 带标题链接 / 图片 / 带尺寸图片 / 代码块 / 引用 / 分隔线 |
| 表格 | 2 / 3 / 4 列表格 |
| 脚注 / 引用 | 脚注定义 / 脚注引用 / 引用式链接定义 |

### 2. HTML

| 分组 | 项 |
|------|------|
| 文本样式 | mark / u / small / sub / sup / kbd / abbr / time / del+ins / cite / var / samp / dfn / q / wbr |
| 结构与布局 | details 折叠面板 / 居中对齐 / dl 定义列表 / figure 图文组合 / ruby 注音 / address / br / hr |
| 交互组件 | dialog 模态对话框 / popover 原生弹出层 / contenteditable 可编辑区域 / template 模板 |
| 表单与控件 | meter 仪表盘 / progress 进度条 / datalist 自动补全 / output 计算表单 / fieldset 分组 |
| 多媒体与绘图 | 内联 SVG / Canvas 画布 / iframe srcdoc 内联框架 |
| 颜色与注释 | 红 / 蓝 / 绿 / 橙 / 紫彩色文字 / 背景高亮 / HTML 注释 |

### 3. 私有语法

| 分组 | 项 |
|------|------|
| 画廊样式 | 17 种：grid / cardstack / filmstrip / polaroid / stack / mosaic / scattered / hexagon / coverflow / tape / duotone / frame / arch / masonry / slider / ticket / panorama |
| GitHub 提示框 | NOTE / IMPORTANT / WARNING / TIP / CAUTION |
| 文档结构 | Frontmatter 头信息 / 目录 TOC |

> 画廊样式详细说明见 [图片画廊布局](examples/gallery-layouts.md) 与 [图片画廊示例](examples/image-gallery-examples.md)。

### 4. 工具渲染

| 分组 | 项 |
|------|------|
| Mermaid 图表（15 种） | flowchart / sequenceDiagram / classDiagram / stateDiagram-v2 / erDiagram / gantt / pie / journey / mindmap / timeline / quadrantChart / gitGraph / block / C4Context / xychart-beta |
| PlantUML（12 种） | 时序图 / 类图 / 用例图 / 活动图 / 状态图 / 组件图 / 部署图 / 思维导图 / WBS / JSON 数据图 / ER 实体关系图 / 线框图 salt |
| ApexCharts（13 种） | 折线 / 面积 / 柱状（分组）/ 堆叠柱状 / 条形（水平）/ 饼图 / 环形 donut / 雷达 / 散点 scatter / 气泡 bubble / 极坐标 polarArea / 范围区域 rangeArea / 烛台 candlestick |
| 代码与数学 | Diff 差异 / KaTeX 公式块 / 行内公式 / 矩阵 pmatrix / 方程组 cases / 求和与极限 / 二维码 / 二维码（自定义尺寸）/ ABC 乐谱 |
| 地理 | 坐标地图（北京 / 上海）/ GeoJSON 多点 / GeoJSON 线 / GeoJSON 多边形 / TopoJSON |

### 5. 插入

| 分组 | 项 |
|------|------|
| 日期时间 | 当前日期 / 当前时间 / 日期时间 / Unix 时间戳 |
| 占位图片 | 300×200 / 600×400 / 1200×600 横幅 / 500×500 方图 |
| 颜色色块 | 红 / 橙 / 黄 / 绿 / 蓝 / 紫（HTML 色点，非 emoji） |
| 分隔线样式 | `---` / `***` / `___` |
| 徽章 | Shields.io / Badgen |

### 6. 嵌入

| 分组 | 项 |
|------|------|
| 视频 | YouTube / Bilibili / Vimeo |
| 社交 | Twitter 推文 / Twitter 用户时间线 / GitHub Gist |
| 代码演示 | CodePen / JSFiddle / StackBlitz / Replit |
| 设计稿 | Figma |
| 地图 | Google Maps / OpenStreetMap |
| 办公文档 | Google Docs |

### 7. 下载

| 分组 | 项 |
|------|------|
| 当前 Cell | 下载源文件 (.md) / 下载渲染结果 (.html) / 导出离线 HTML（内联 CSS）/ 导出 PDF |
| 整个笔记本 | 导出笔记本 (.mdnb) / 合并导出全部 (.md) |

### 8. 导入

| 分组 | 项 |
|------|------|
| 笔记本 | 导入 .mdnb 笔记本 / 导入 .md（按 `---` 切分为 Cell） |
| 当前 Cell | 导入 .md 到当前 Cell |

---

## 五、自动补全

在编辑区输入触发字符即弹出补全列表，支持 ↑↓ 选择、Enter / Tab 确认、Esc 关闭。共 12 类触发字符，120+ 条目。

| 触发字符 | 补全内容 |
|----------|----------|
| `@` | 17 种画廊样式 + 13 种嵌入服务（YouTube / Bilibili / Vimeo / Twitter / Gist / CodePen / JSFiddle / StackBlitz / Replit / Figma / Google Maps / OpenStreetMap / Google Docs） |
| ` ``` ` | Mermaid 12 种 + PlantUML 10 种 + ApexCharts 9 种 + geo / geojson / topojson / qrcode / abc / diff + 19 种编程语言 |
| `> [!` | 5 种 GitHub Alerts |
| `#` | 6 级标题 |
| `-` | 无序列表 / 任务列表 |
| `\|` | 2 / 3 / 4 列表格 |
| `---` | 水平分割线 / Frontmatter |
| `>` | 普通引用 |
| `$$` | KaTeX 公式块 |
| `![` | 图片 / 带标题图片 |
| `[` | 链接 / 带标题链接 / 引用式链接 |

---

## 六、右键菜单

右键任意 Cell 弹出 2 列布局菜单，左列「运行与插入」7 项，右列「编辑与清理」10 项，共 17 项操作。菜单位置自动检测视口边界，避免溢出；窄屏自动回退为单列。

### 运行与插入（左列）

| 操作 | 说明 |
|------|------|
| 运行此 Cell | 等同 Ctrl+Enter |
| 运行此 Cell 及下方 | 顺序执行当前及下方所有 Cell |
| 上方插入 Cell | 在当前 Cell 上方新建空 Cell |
| 下方插入 Cell | 在当前 Cell 下方新建空 Cell |
| 上移 | 与上一个 Cell 交换位置 |
| 下移 | 与下一个 Cell 交换位置 |
| 复制 Cell | 在下方复制一份内容相同的 Cell |

### 编辑与清理（右列）

| 操作 | 说明 |
|------|------|
| 切换类型 | markdown ↔ plaintext |
| 折叠编辑器 | 隐藏编辑区，仅保留输出 |
| 折叠输出 | 隐藏输出区 |
| 复制输出 HTML | 将渲染后的 HTML 复制到剪贴板 |
| 导出此 Cell | 单独导出当前 Cell |
| 折叠全部 | 折叠所有 Cell 的编辑器 |
| 展开全部 | 展开所有 Cell |
| 清空输出 | 清除当前 Cell 的渲染结果 |
| 清空内容 | 清空当前 Cell 的编辑区文字 |
| 删除 Cell | 删除当前 Cell（危险操作，红色高亮） |

---

## 七、快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + Enter` | 运行当前 Cell |
| `Ctrl/Cmd + Shift + Enter` | 运行全部 Cell |
| `Ctrl/Cmd + Shift + N` | 当前 Cell 下方新建 |
| `Ctrl/Cmd + F` | 打开搜索面板 |
| `Ctrl/Cmd + H` | 打开替换面板 |
| `Ctrl/Cmd + B` | 粗体 |
| `Ctrl/Cmd + I` | 斜体 |
| `Ctrl/Cmd + K` | 链接 |
| `Ctrl/Cmd + ` ` | 行内代码 |
| `Tab` | 缩进 2 空格 |
| `Shift + Tab` | 移除行首 2 空格 |
| `F3` / `Shift + F3` | 搜索下一个 / 上一个 |
| `Esc` | 关闭右键菜单 / 补全 / 搜索面板 |

---

## 八、搜索与替换

工具栏右侧搜索图标（或 `Ctrl+F` / `Ctrl+H`）打开搜索面板：

- **查找**：跨所有 Cell 的 textarea 内容搜索
- **替换**：替换当前匹配 / 全部替换
- **导航**：`F3` 下一个、`Shift+F3` 上一个，或点击 ↑↓ 按钮
- **状态信息**：底部显示「N 个匹配 / 当前第 M 个」
- `Esc` 关闭面板

---

## 九、自动保存

编辑器启用 localStorage 自动保存，**无需手动保存**：

- **存储键**：`mdnb_autosave_v2`
- **触发**：内容变更后 1.5 秒防抖写入
- **保存内容**：每个 Cell 的 `id` / `type` / `content` / `output_html`
- **恢复**：再次进入编辑器时自动加载，重建所有 Cell
- **状态指示**：底部状态栏右侧显示「未保存 *」（橙色）/「已保存 ✓」（绿色）/「保存失败」（红色）

其他持久化设置：

| 键 | 内容 |
|----|------|
| `mdnb_fontsize` | 编辑区字号（12 / 14 / 16 / 18） |
| `mdnb_theme` | 编辑器主题（light / dark） |

> 自动保存仅写入浏览器本地存储，不会同步到仓库。如需持久分享，请使用「下载」菜单导出 `.mdnb` 笔记本或合并 `.md` 文件。

---

## 十、字号与主题

- **字号调节**：工具栏字号图标，可选 12 / 14 / 16 / 18 px，默认 14 px
- **主题切换**：工具栏主题图标，在亮色 / 暗色间切换，独立于文档站主题

---

## 十一、笔记本文件格式 (.mdnb)

`.mdnb` 是编辑器导出的笔记本格式，本质为 JSON：

```json
{
  "version": 2,
  "type": "mdnb-autosave",
  "saved": "2026-07-13T12:00:00.000Z",
  "cells": [
    {
      "id": 1,
      "type": "markdown",
      "content": "# 标题\n\n正文",
      "output_html": "<h1>标题</h1><p>正文</p>"
    },
    {
      "id": 2,
      "type": "plaintext",
      "content": "纯文本内容",
      "output_html": ""
    }
  ]
}
```

通过「导入」菜单可重新加载 `.mdnb` 文件，完整还原 Cell 结构、类型与渲染结果。

---

## 相关文档

- [快速开始](getting-started.md)
- [系统运行时截图](show.md)
- [图片画廊布局](examples/gallery-layouts.md)
- [Mermaid 示例](examples/mermaid-examples.md)
- [LaTeX 示例](examples/latex-examples.md)
- [开发者文档](../readme-dev.md)
