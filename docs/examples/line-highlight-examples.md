---
title: 代码行高亮示例
tags: [代码高亮]
---

# 代码行高亮

两种标记方式：fence 信息串 `{2,5-8}`（行号）与代码内 `[!code highlight]` 注释，
可叠加使用。高亮为覆盖层实现，不影响 hljs 语法着色。

## 行号标记

**源码**

````markdown
```js {2,5-8}
const store = new Map();        // ← 高亮第 2 行
function get(key) {
  return store.get(key);
}
function set(key, value) {      // ← 高亮 5-8 行
  store.set(key, value);
  return value;
}
```
````

**渲染效果**

````js {2,5-8}
const store = new Map();        // ← 高亮第 2 行
function get(key) {
  return store.get(key);
}
function set(key, value) {      // ← 高亮 5-8 行
  store.set(key, value);
  return value;
}
````

## 注释标记

**源码**

````markdown
```js
const a = 1; // [!code highlight]
const b = 2;
const c = a + b; // [!code highlight]
```
````

**渲染效果**

````js
const a = 1; // [!code highlight]
const b = 2;
const c = a + b; // [!code highlight]
````

## 叠加

**源码**

````markdown
```python {1}
import os # [!code highlight]
print(os.getcwd())
```
````

**渲染效果**

````python {1}
import os # [!code highlight]
print(os.getcwd())
````
