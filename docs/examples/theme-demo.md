---
title: 主题市场演示
tags: [主题]
---

# 主题市场演示

这是一个展示主题系统的示例文档。点击左下角的调色盘图标可以切换不同的主题。

## 可用主题

| 主题名称 | 描述 |
|---------|------|
| 🌸 紫粉渐变 | 默认的浅紫浅粉渐变主题 |
| 💜 鸢尾花紫 | 亮色淡紫底 + 鸢尾品牌紫强调色 |
| ⚡ GitHub Light | 仿 GitHub 明亮主题 |
| 🌙 GitHub Dark | 仿 GitHub 深色主题 |
| 📝 Notion | 仿 Notion 暖灰主题 |
| 🌈 Arc Dark | 仿 Arc 浏览器彩虹紫主题 |
| 🧛 Dracula | 经典的 Dracula 配色 |
| ❄️ Nord | 北极光配色主题 |

## 自定义 CSS

除了内置主题外，你还可以通过配置文件注入自定义 CSS：

```json
{
  "customCSS": "https://example.com/my-theme.css"
}
```

自定义 CSS 中的变量会覆盖内置主题的默认值。

## 示例代码

```javascript
// 切换主题
MarkdownPreview.themes.setTheme('github-dark');

// 获取当前主题
const current = MarkdownPreview.themes.getCurrentTheme();

// 获取所有主题列表
const themes = MarkdownPreview.themes.getAllThemes();
```

## 链接示例

- [GitHub](https://github.com)
- [Markdown Guide](https://www.markdownguide.org)

## 列表示例

### 有序列表
1. 第一项
2. 第二项
3. 第三项

### 无序列表
- 苹果
- 香蕉
- 橙子

## 引用示例

> 这是一个引用块示例。
> 可以包含多行文字。

## 表格示例

| 功能 | 状态 |
|------|------|
| 主题切换 | ✅ 已实现 |
| 自定义 CSS | ✅ 已实现 |
| 主题持久化 | ✅ 已实现 |
