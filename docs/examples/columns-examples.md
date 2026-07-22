# 分栏布局使用示例

使用 `::: columns` 语法可以在 Markdown 中创建多栏布局，每栏可以包含任意 Markdown 内容。

---

## 基础两栏布局

源码：

````markdown
::: columns
::: column 左侧标题
这是左侧栏的内容。

- 列表项 1
- 列表项 2
- 列表项 3
:::
::: column 右侧标题
这是右侧栏的内容。

> 这是一段引用

正常段落文字。
:::
:::
````

渲染效果：

::: columns
::: column 左侧标题
这是左侧栏的内容。

- 列表项 1
- 列表项 2
- 列表项 3
:::
::: column 右侧标题
这是右侧栏的内容。

> 这是一段引用

正常段落文字。
:::
:::

---

## 三栏布局

源码：

````markdown
::: columns
::: column 第一栏
**功能 A**

快速、高效、稳定的核心功能，满足日常需求。

- 高性能
- 低延迟
- 易使用
:::
::: column 第二栏
**功能 B**

丰富的扩展能力，灵活应对各种场景。

- 可定制
- 可扩展
- 可集成
:::
::: column 第三栏
**功能 C**

完善的生态系统和社区支持。

- 文档齐全
- 社区活跃
- 更新频繁
:::
:::
````

渲染效果：

::: columns
::: column 第一栏
**功能 A**

快速、高效、稳定的核心功能，满足日常需求。

- 高性能
- 低延迟
- 易使用
:::
::: column 第二栏
**功能 B**

丰富的扩展能力，灵活应对各种场景。

- 可定制
- 可扩展
- 可集成
:::
::: column 第三栏
**功能 C**

完善的生态系统和社区支持。

- 文档齐全
- 社区活跃
- 更新频繁
:::
:::

---

## 无标题分栏

源码：

````markdown
::: columns
::: column
左边内容，没有标题。
:::
::: column
右边内容，也没有标题。
:::
:::
````

渲染效果：

::: columns
::: column
左边内容，没有标题。
:::
::: column
右边内容，也没有标题。
:::
:::

---

## 带代码块的分栏

源码：

````markdown
::: columns
::: column JavaScript
```js
function hello() {
  return "Hello, World!";
}
```
:::
::: column Python
```python
def hello():
    return "Hello, World!"
```
:::
:::
````

渲染效果：

::: columns
::: column JavaScript
```js
function hello() {
  return "Hello, World!";
}
```
:::
::: column Python
```python
def hello():
    return "Hello, World!"
```
:::
:::

---

## 四栏布局

源码：

````markdown
::: columns
::: column 春
万物复苏，花开遍地。
:::
::: column 夏
烈日炎炎，绿树成荫。
:::
::: column 秋
秋高气爽，硕果累累。
:::
::: column 冬
白雪皑皑，银装素裹。
:::
:::
````

渲染效果：

::: columns
::: column 春
万物复苏，花开遍地。
:::
::: column 夏
烈日炎炎，绿树成荫。
:::
::: column 秋
秋高气爽，硕果累累。
:::
::: column 冬
白雪皑皑，银装素裹。
:::
:::

---

## 语法说明

```text
::: columns
::: column 栏1标题
栏1内容（任意 Markdown）
:::
::: column 栏2标题
栏2内容（任意 Markdown）
:::
:::
```

### 规则

- 使用 `::: columns` 开始分栏容器，`:::` 结束
- 每个栏用 `::: column 标题` 标记，标题可选
- 每个栏的内容用 `:::` 结束
- 可以包含任意数量的栏，宽度自动平均分配
- 栏内支持完整 Markdown 语法（列表、引用、代码块、图片等）
- 移动端（宽度 < 768px）自动变为上下堆叠布局
- 代码块内的 `:::` 不会被解析为分栏语法
