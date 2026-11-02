---
title: 代码阅读与源码嵌入
tags: [代码, 源码]
---

# 代码阅读与源码嵌入

本页演示代码块阅读模式、源码嵌入与统一代码工具条。

## 阅读模式

每个普通代码块自动升级为「阅读模式」：左上角显示语言与行数，右上角悬停浮现图标工具按钮（鼠标掠过显示文字提示），左侧行号与代码行严格对齐（换行模式下自动隐藏）。`{2,5-8}` 行高亮语法不受影响。

**源码**（fence 信息串里用 `{行}` 指定高亮行）：

````markdown
```js {2,5-8}
function parse(url) {
  let p = url;
  let range = null;
  let lang = '';
  const q = url.indexOf('?');
  if (q !== -1) {
    p = url.slice(0, q);
  }
  return { path: p, range, lang };
}
```
````

**渲染效果**：

```js {2,5-8}
function parse(url) {
  let p = url;
  let range = null;
  let lang = '';
  const q = url.indexOf('?');
  if (q !== -1) {
    p = url.slice(0, q);
  }
  return { path: p, range, lang };
}
```

工具按钮：

- **换行**：切换软换行；开启后行号隐藏，图标保持高亮，提示文字变为「不换行」。
- **折叠**：超过 30 行的代码块可折叠为前 24 行 + 渐变遮罩；展开/收起不影响复制内容。
- **纯文本**：临时去掉语法高亮，便于选择复制原始文本；再次点击恢复。

折叠按钮只在长代码块（>30 行）出现，短代码块保持原有紧凑外观。

## 源码嵌入

语法：`@[code](路径#Lx-Ly lang=js)` 或 `@[file](路径)`。行范围与 `lang=` 均可省略；优先读构建期快照 `iris/data/code-snippets.json`（离线可用），否则同源 `fetch`。

嵌入长片段（超过 30 行）时自动折叠为前 24 行，标题显示路径、行范围与总行数，行号从真实起始行起算。

**源码**（带行范围与语言覆盖）：

````markdown
```code
@[code](iris/js/renderers/table-tools.js#L1-L60 lang=js)
```
````

**渲染效果**：

```code
@[code](iris/js/renderers/table-tools.js#L1-L60 lang=js)
```

**源码**（整文件嵌入，以 49 行的 extra-langs.js 为例）：

````markdown
```code
@[file](iris/js/langs/extra-langs.js)
```
````

**渲染效果**：

```code
@[file](iris/js/langs/extra-langs.js)
```

**源码**（路径不存在时的失败演示）：

````markdown
```code
@[code](no/such/file.js#L1-L5)
```
````

**渲染效果**（降级为错误卡片，不白屏）：

```code
@[code](no/such/file.js#L1-L5)
```

构建期校验：`node iris/scripts/build-code-snippets.js` 会输出路径不存在、行号越界的告警。

## 统一工具条

换行 / 折叠 / 纯文本为图标按钮，与复制按钮一起悬停浮现于代码块右上角；鼠标掠过图标会显示文字提示，激活的功能（如已切到「不换行」）以主题色高亮。触屏设备控件常显；打印时控件隐藏、折叠块完整展开。
