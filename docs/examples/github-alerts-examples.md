---
title: GitHub Alerts 示例
tags: [排版]
---

# GitHub Alerts 示例

本页面展示如何在 Markdown 中使用 GitHub 风格的 Alerts 语法。

## 什么是 GitHub Alerts？

GitHub 引入了一种特殊的引用块语法，用于创建具有不同颜色和图标的提示框。

## 支持的类型

### [!NOTE]

> [!NOTE]
> 这是一个提示信息，用于提供额外的说明或重要信息。

### [!TIP]

> [!TIP]
> 这是一个技巧提示，用于提供有用的建议或最佳实践。

### [!IMPORTANT]

> [!IMPORTANT]
> 这是重要信息，需要用户特别注意的关键内容。

### [!WARNING]

> [!WARNING]
> 这是一个警告信息，提醒用户注意潜在的风险或问题。

### [!CAUTION]

> [!CAUTION]
> 这是一个谨慎提示，提醒用户非常小心处理某些操作。

## 语法格式

```markdown
> [!NOTE]
> 这是提示内容。

> [!TIP]
> 这是技巧提示。
```

## 更多示例

### 多行内容的 Alert

> [!NOTE]
> Alert 也可以包含多行内容。
> 
> 这样可以更详细地展示信息，
> 并且支持 Markdown 格式。

### 包含代码块的 Alert

> [!TIP]
> 你可以在 Alert 中嵌入代码块：
> 
> ```javascript
> function greet(name) {
>   return `Hello, ${name}!`;
> }
> ```

### 包含链接和列表的 Alert

> [!IMPORTANT]
> Alert 支持各种 Markdown 格式：
> 
> - 列表项 1
> - 列表项 2
> - [链接示例](https://github.com)
> 
> **加粗文本**和*斜体文本*也可以使用。
