---
title: 代码高亮主题开发指南
tags: [主题, 代码高亮]
---

# 代码高亮主题开发指南

## 概述

Markdown Preview 使用 [highlight.js](https://highlightjs.org/) 进行代码语法高亮。内置了 10 种常用主题，并支持自定义主题。

## 内置主题

| 主题 ID | 名称 | 类型 |
|---------|------|------|
| `github` | GitHub Light | 亮色 |
| `github-dark` | GitHub Dark | 暗色 |
| `atom-one-light` | Atom One Light | 亮色 |
| `atom-one-dark` | Atom One Dark | 暗色 |
| `monokai` | Monokai | 暗色 |
| `dracula` | Dracula | 暗色 |
| `nord` | Nord | 暗色 |
| `vs2015` | VS 2015 | 暗色 |
| `solarized-light` | Solarized Light | 亮色 |
| `solarized-dark` | Solarized Dark | 暗色 |

在悬浮球菜单 → 设置 → 外观 → 代码高亮主题 中切换。

## 代码块增强

每个代码块除语法高亮外，还有以下交互：

| 特性 | 说明 |
|------|------|
| 复制按钮 | 代码块右上角，点击复制全部代码到剪贴板 |
| 语言标签 | 顶部显示代码语言标识（如 `javascript`、`python`） |
| 横向滚动 | 长行代码横向滚动，不换行 |
| `data-lang` 属性 | `<pre>` 元素附带 `data-lang` 属性，便于插件扩展 |

复制按钮使用 Clipboard API，老浏览器降级到 `execCommand('copy')`。

## 使用自定义主题

highlight.js 有上百种社区主题，你可以加载任意主题 CSS 文件。

### 方法：加载外部 highlight.js 主题 CSS

1. 找到你喜欢的主题 CSS（例如从 [highlight.js demo](https://highlightjs.org/demo) 或 CDN 获取）
2. 在设置面板的 **外观 → 高级 → 自定义高亮主题** 输入框中填入主题 CSS 的 URL
3. 回车应用

自定义 hljs CSS 会插入到内置 `#hljs-theme` 之后，确保覆盖内置主题。

> **注意**：自定义高亮主题 优先级高于「代码高亮主题」下拉框的选择。如需切换回内置主题，清空自定义高亮主题 输入框回车即可。
>
> 「自定义 CSS」与「自定义高亮主题」是两个独立输入框：前者用于覆盖整站样式（布局、字体等），后者仅用于代码块语法颜色。

## 开发自定义主题

### highlight.js 主题结构

一个典型的 highlight.js 主题文件结构如下：

```css
.hljs {
  display: block;
  overflow-x: auto;
  padding: 0.5em;
  background: #282c34;
  color: #abb2bf;
}

.hljs-comment,
.hljs-quote {
  color: #5c6370;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-literal {
  color: #c678dd;
}

.hljs-string,
.hljs-attr {
  color: #98c379;
}

.hljs-number,
.hljs-symbol {
  color: #d19a66;
}

/* ... 更多高亮类别 */
```

### 可用的高亮类别

| 类别名 | 说明 |
|--------|------|
| `hljs-comment` | 注释 |
| `hljs-keyword` | 关键字 |
| `hljs-string` | 字符串 |
| `hljs-number` | 数字 |
| `hljs-function` | 函数 |
| `hljs-title` | 函数/标题名 |
| `hljs-params` | 参数 |
| `hljs-built_in` | 内置函数/类型 |
| `hljs-type` | 类型 |
| `hljs-literal` | 字面量（true/false/null 等） |
| `hljs-variable` | 变量 |
| `hljs-attr` | 属性 |
| `hljs-tag` | HTML 标签 |
| `hljs-name` | 标签名/函数名 |
| `hljs-selector-tag` | CSS 选择器标签 |
| `hljs-selector-class` | CSS 类选择器 |
| `hljs-selector-id` | CSS ID 选择器 |
| `hljs-meta` | 元信息 |
| `hljs-section` | 章节 |
| `hljs-addition` | 新增（diff） |
| `hljs-deletion` | 删除（diff） |
| `hljs-emphasis` | 强调 |
| `hljs-strong` | 粗体 |

### 与项目样式配合

代码块的基础样式定义在 `iris/css/markdown.css` 中，包括：

- `.markdown-body pre` — 代码块容器（边框、圆角、内边距）
- `.markdown-body pre.code-block` — 带复制按钮的代码块（顶部内边距）
- `.markdown-body pre .copy-btn` — 复制按钮样式
- `.markdown-body pre code` — `<code>` 元素样式

主题文件只需要定义 `.hljs-*` 相关的语法颜色，不需要关心容器样式。

## 添加内置主题

要将新主题添加到内置主题列表：

### 1. 准备主题文件

将主题 CSS 文件放入 `iris/vendor/highlight.js/styles/` 目录，命名为 `主题名.css`。

### 2. 在设置面板中添加选项

编辑 `index.html`，在 `#codeThemeSelect` 中添加新的 `<option>`：

```html
<select id="codeThemeSelect" class="theme-select">
  <!-- 已有选项 -->
  <option value="your-theme">你的主题名</option>
</select>
```

### 3. 注意事项

- 主题 CSS 文件中只包含 `.hljs-*` 选择器，不要修改代码块容器样式
- 亮色和暗色主题都应提供，以便匹配不同的界面主题
- 建议同时提供 `.min.css` 压缩版本

## 支持的语言

内置 highlight.js 包含常用语言支持：

JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust, Ruby, PHP, Shell, SQL, HTML, CSS, JSON, YAML, Markdown, Dockerfile, Git, Diff 等。

## 示例

以下是一个简单的自定义主题示例：

```css
/* 暖色浅色主题 */
.hljs {
  background: #fdf6e3;
  color: #657b83;
}

.hljs-comment,
.hljs-quote {
  color: #93a1a1;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-literal {
  color: #859900;
}

.hljs-string {
  color: #2aa198;
}

.hljs-number {
  color: #d33682;
}

.hljs-function .hljs-title {
  color: #268bd2;
}

.hljs-type,
.hljs-class .hljs-title {
  color: #b58900;
}
```
