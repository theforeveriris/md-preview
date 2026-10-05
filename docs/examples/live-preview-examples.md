---
title: Live 预览与 JSON 树示例
tags: [图表, 数据]
---

# Live 预览与 JSON 树

fence 信息串追加 `live` 标记的 `html` / `js` / `css` 代码块会在文档内提供沙箱运行预览；`json` 代码块自动渲染为可折叠树（追加 `raw` 标记保留源码展示）。脚本运行在隔离 iframe（opaque origin）中，无法访问页面数据。

## HTML live 预览

```` ```html live ```` 写法：

```html live
<div style="font-family: system-ui; text-align: center; padding: 16px;">
  <h2 style="margin: 0 0 8px;">Hello, Sandbox!</h2>
  <button onclick="this.textContent = '点击了 ' + (++window._n || (window._n = 1)) + ' 次'">
    点我
  </button>
</div>
```

## JavaScript live 预览

```` ```js live ```` 写法，console 输出显示在预览面板：

```js live
// height: 220
const sizes = ['S', 'M', 'L'];
sizes.forEach((s, i) => console.log(i, '尺码:', s));
console.warn('这是一条 warning');
console.log({ name: 'md-preview', stars: 42 });
```

## CSS live 预览

```` ```css live ```` 写法，样式作用在预置示例骨架上：

```css live
main { max-width: 320px; margin: 0 auto; }
h1 { color: #b88aad; border-bottom: 2px dashed #d4a5c9; }
button { background: #d4a5c9; color: #fff; border: none; border-radius: 999px; padding: 6px 18px; }
li:hover { color: #b88aad; }
.__box { background: linear-gradient(135deg, #d4a5c9, #f2c4ce); }
```

## JSON 可折叠树

```` ```json ```` 自动渲染为可折叠树（节点可折叠、可复制路径）：

```json
{
  "name": "md-preview",
  "features": {
    "renderer": ["mermaid", "plantuml", "apexcharts"],
    "export": ["pdf", "html", "epub", "zip"]
  },
  "nested": { "deep": { "deeper": { "leaf": true } } },
  "count": 44,
  "openSource": true
}
```

保留源码展示时，追加 `raw` 标记：

```json raw
{ "note": "这棵不会变成树，仍显示为普通代码块" }
```
