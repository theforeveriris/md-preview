---
title: Git Diff 可视化示例
tags: [图表]
---

# Git Diff 可视化示例

本页面展示如何使用 diff2html 可视化展示 Git Diff 内容。

---

## 1. 基本用法

### 简单的文件修改

**源码格式：**
```txt
diff --git a/app.js b/app.js
index 1a2b3c4..5d6e7f8 100644
--- a/app.js
+++ b/app.js
@@ -10,7 +10,7 @@
   console.log('Hello World');
   
   function greet(name) {
-    return 'Hello, ' + name;
+    return `Hello, ${name}!`;
   }
```

**渲染效果：**

```diff
diff --git a/app.js b/app.js
index 1a2b3c4..5d6e7f8 100644
--- a/app.js
+++ b/app.js
@@ -10,7 +10,7 @@
   console.log('Hello World');
   
   function greet(name) {
-    return 'Hello, ' + name;
+    return `Hello, ${name}!`;
   }
```

---

## 2. 多文件修改

**渲染效果：**

```diff
diff --git a/README.md b/README.md
index 3f5d7e8..9b4a2c1 100644
--- a/README.md
+++ b/README.md
@@ -1,6 +1,8 @@
 # Markdown 预览器
 
-纯前端的 Markdown 预览工具。
+纯前端的 Markdown 预览工具，支持多种内容渲染。
+
+## 功能特点
 
 ## 使用方法
 
diff --git a/app.js b/app.js
index 1a2b3c4..5d6e7f8 100644
--- a/app.js
+++ b/app.js
@@ -1,3 +1,4 @@
+// 新增的文件头部
 function init() {
-  console.log('Initializing...');
+  console.log('Application initialized');
 }
```

---

## 3. 不同类型的变更

### 新增文件

```diff
diff --git a/new-file.js b/new-file.js
new file mode 100644
index 0000000..c0d3a0e
--- /dev/null
+++ b/new-file.js
@@ -0,0 +1,8 @@
+// 这是一个新文件
+
+export function newFunction() {
+  console.log('This is a new function');
+  return true;
+}
+
+console.log('File loaded');
```

### 删除文件

```diff
diff --git a/old-file.js b/old-file.js
deleted file mode 100644
index 3a1b2c4..0000000
--- a/old-file.js
+++ /dev/null
@@ -1,8 +0,0 @@
-// 这是一个被删除的文件
-
-function oldFunction() {
-  console.log('This function is removed');
-  return false;
-}
-
-console.log('This file is deleted');
```

### 重命名文件

```diff
diff --git a/old-name.js b/new-name.js
similarity index 90%
rename from old-name.js
rename to new-name.js
index 3a1b2c4..5d6e7f8 100644
--- a/old-name.js
+++ b/new-name.js
@@ -1,5 +1,5 @@
-// 旧文件名
+// 新文件名
 
-function calculate() {
+function compute() {
   return 42;
 }
```

---

## 4. 复杂示例

### 完整的功能变更

```diff
diff --git a/components/Button.js b/components/Button.js
index 2a3b4c5..6d7e8f9 100644
--- a/components/Button.js
+++ b/components/Button.js
@@ -1,15 +1,25 @@
 import React from 'react';
+import PropTypes from 'prop-types';
 
-export default function Button({ children, onClick, disabled }) {
+const Button = ({ children, onClick, disabled, variant = 'primary' }) => {
   return (
-    <button
-      onClick={onClick}
-      disabled={disabled}
-      style={{
-        padding: '10px 20px',
-        cursor: disabled ? 'not-allowed' : 'pointer'
-      }}
+    <button
+      onClick={onClick}
+      disabled={disabled}
+      className={`button button-${variant}`}
     >
       {children}
     </button>
   );
 }
+
+Button.propTypes = {
+  children: PropTypes.node.isRequired,
+  onClick: PropTypes.func,
+  disabled: PropTypes.bool,
+  variant: PropTypes.oneOf(['primary', 'secondary', 'danger'])
+};
+
+export default Button;
diff --git a/styles.css b/styles.css
index 1c2d3e4..5f6a7b8 100644
--- a/styles.css
+++ b/styles.css
@@ -1,5 +1,20 @@
 body {
   font-family: sans-serif;
 }
+
+.button {
+  padding: 10px 20px;
+  border-radius: 4px;
+  border: none;
+  cursor: pointer;
+}
+
+.button-primary {
+  background: #007bff;
+  color: white;
+}
+
+.button-secondary {
+  background: #6c757d;
+  color: white;
+}
```

---

## 5. 使用说明

### 语法规则

1. 使用 ` ```diff ` 代码块标记
2. 内容必须是标准的 Git Diff 格式
3. 支持单个或多个文件的差异展示

### 功能特性

- **文件列表**：显示所有被修改的文件
- **逐行对比**：清晰展示每一行的变更
- **代码高亮**：支持代码语法高亮
- **同步滚动**：左右滚动同步

### Diff 格式说明

```diff
diff --git a/旧文件 b/新文件
index 旧哈希..新哈希 文件权限
--- a/旧文件
+++ b/新文件
@@ -起始行号,显示行数 +起始行号,显示行数 @@
- 被删除的行
+ 新添加的行
  未变更的行
```

---

## 6. 注意事项

1. 确保使用标准的 Git Diff 格式
2. 可以使用 `git diff` 命令生成 diff 内容
3. 支持多个文件的 diff 同时展示
4. 代码块标记必须是 `diff` 类型
