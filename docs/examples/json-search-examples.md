---
title: JSON 树搜索与 JSONPath
tags: [JSON, 数据]
---

# JSON 树搜索与 JSONPath

`json` 围栏渲染为可折叠的 JSON 树；工具条内提供关键字搜索与 JSONPath 查询。

**源码**：

````markdown
```json
{
  "project": "md-preview",
  "version": "0.1.0",
  "deps": {
    "marked": "^12.0.0",
    "highlight.js": "^11.0.0"
  },
  "users": [
    { "id": 1, "name": "Alice", "role": "admin" },
    { "id": 2, "name": "Bob", "role": "editor" },
    { "id": 3, "name": "Carol", "role": "viewer" }
  ],
  "stats": { "stars": 1200, "forks": 340 }
}
```
````

**渲染效果**（试试在「搜索」框输入 `Bob`，或在「JSONPath」框输入 `$.users[*].name` 后点「运行」）：

```json
{
  "project": "md-preview",
  "version": "0.1.0",
  "deps": {
    "marked": "^12.0.0",
    "highlight.js": "^11.0.0"
  },
  "users": [
    { "id": 1, "name": "Alice", "role": "admin" },
    { "id": 2, "name": "Bob", "role": "editor" },
    { "id": 3, "name": "Carol", "role": "viewer" }
  ],
  "stats": { "stars": 1200, "forks": 340 }
}
```

工具条能力：

- **搜索**：输入关键字，命中节点高亮并统计，祖先节点自动展开。
- **JSONPath**：支持 `$`、`.key`、`['key']`、`[n]`、`[*]`、`.*`、`..key`，如 `$.users[*].name`、`$..role`、`$.deps.marked`；命中数显示在输入框右侧，`Esc` 清空。
- 原有 收起 / 展开 / 复制 JSON / 下载 json 不变；解析失败回退为源码块。
