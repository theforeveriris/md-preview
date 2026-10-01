# 主题定制

Markdown Preview 提供三种层级的外观定制方式，由易到难：

1. **预设主题** — 内置 7 套配色，一键切换
2. **可视化取色器** — 拖动色块即可调整主题色，无需写 CSS
3. **自定义 CSS** — 加载外部 CSS 文件，完全控制样式

---

## 一、内置主题

| ID | 名称 | 说明 |
|----|------|------|
| `default` | 默认 | 浅紫浅粉渐变风格 |
| `github-light` | GitHub Light | GitHub 明亮风格 |
| `github-dark` | GitHub Dark | GitHub 深色风格 |
| `notion` | Notion | Notion 暖灰风格 |
| `arc-dark` | Arc Dark | Arc 浏览器彩虹紫风格 |
| `dracula` | Dracula | Dracula 经典配色 |
| `nord` | Nord | 北极光配色 |

在悬浮球菜单中点击设置图标 → **外观 → 预设主题** 即可切换。

> **注意**：选择预设主题会清空自定义配色，恢复为该主题的默认变量值。

### 自动主题（跟随系统亮暗）

预设主题支持 `auto` 档位：跟随系统 `prefers-color-scheme` 实时切换——系统亮色时使用「亮色配对」主题（默认紫粉渐变），暗色时使用「暗色配对」主题（默认 GitHub Dark）。

- 亮 / 暗配对可在设置面板中自由组合；
- 系统亮暗变化时即时生效，无需刷新（含 PWA 桌面模式）；
- 深层实现：`themechange` 事件携带的始终是解析后的实际主题 ID，自定义 CSS / 代码高亮联动不受影响。

---

## 二、可视化取色器（推荐）

无需写 CSS，直接通过取色器调整 CSS 变量。设置面板 → **外观 → 自定义配色**。

### 强调色

| 色块 | CSS 变量 | 说明 |
|------|----------|------|
| 主色 | `--color-accent-purple` | 主要强调色 |
| 粉色 | `--color-accent-pink` | 渐变派生色 |
| 深色 | `--color-accent-purple-deep` | 深色派生 |

### 中性色

通过中性色组合可做出亮色或暗色主题：

| 色块 | CSS 变量 | 说明 |
|------|----------|------|
| 背景 | `--color-bg` | 页面背景 |
| 表面 | `--color-surface` | 卡片、面板表面 |
| 边框 | `--color-border` | 分隔线、边框 |
| 文字 | `--color-text` | 主文字 |
| 次要 | `--color-text-muted` | 次要文字 |

### 暗色主题示例

将中性色调整为：

- 背景 `#1a1a1a`
- 表面 `#2d2d2d`
- 边框 `#3a3a3a`
- 文字 `#e0e0e0`
- 次要 `#999999`

即可得到暗色主题。

### 重置

点击「重置」按钮可恢复所有取色器为默认值。

> 取色器仅调整颜色变量，不会改变布局或字体。所有改动保存在浏览器 localStorage 中。

---

## 三、自定义 CSS

适合需要深度定制（布局、字体、间距等）的用户。

### 使用方法

1. 准备一份 CSS 文件（可托管在 GitHub raw、CDN、或任意可公开访问的位置）
2. 设置面板 → **外观 → 高级 → 自定义 CSS**
3. 填入 CSS 文件 URL，回车应用

### 自定义主题 CSS 结构

自定义 CSS 可以定义以下 CSS 变量（参考 `iris/css/base.css` 的 `:root`）：

```css
:root {
  /* 背景与表面 */
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  
  /* 边框与分隔 */
  --color-border: #f0f0f0;
  
  /* 文字颜色 */
  --color-text: #2d2d2d;
  --color-text-muted: #999999;
  
  /* 主题色 */
  --color-accent-purple: #d4a5c9;
  --color-accent-pink: #f2c4ce;
  --color-accent-purple-deep: #b88aad;
  
  /* 其他 */
  --color-shadow: rgba(0, 0, 0, 0.04);
  --color-overlay: rgba(255, 255, 255, 0.85);
}
```

也可以覆盖任意选择器的样式，例如修改正文字号：

```css
.markdown-body {
  font-size: 17px;
  line-height: 1.8;
}
```

> **提示**：你可以复制 `iris/css/themes/themes.css` 中任意一个主题的变量定义作为起点，修改颜色值即可。

### 清除自定义 CSS

清空输入框回车，或直接删除 localStorage 中的 `md-preview-custom-css` 键。

---

## 四、代码高亮主题

代码块的颜色方案独立于界面主题，详见 [代码高亮主题](code-highlight-theme.md)。

支持 10 种内置方案 + 加载外部 highlight.js 主题 CSS。

---

## 主题持久化

所有主题相关设置保存在浏览器 localStorage：

| Key | 内容 |
|-----|------|
| `md-preview-theme` | 当前预设主题 ID（选自动主题时为 `auto`） |
| `md-preview-theme-light` | 自动主题的亮色配对主题 ID |
| `md-preview-theme-dark` | 自动主题的暗色配对主题 ID |
| `md-preview-settings` | 自定义配色（取色器值） |
| `md-preview-custom-css` | 自定义 CSS URL |
| `md-preview-custom-hljs` | 自定义 highlight.js 主题 URL |
