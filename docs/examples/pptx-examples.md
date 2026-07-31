---
title: PPTX 演示嵌入示例
---

# PPTX 演示嵌入

本站点支持在 Markdown 文档中嵌入 PPTX 演示文稿（**预处理产物方案**，与 `pkt` / `ensp` 拓扑嵌入完全同风格）。

## 为什么采用「预处理产物」？

与 PDF/PPTX 在前端动态解码相比，「提前导出每页图片 + 元数据 JSON」有以下优势：

| 方案 | 首屏速度 | 依赖体积 | 兼容性 | 可搜索 |
|---|---|---|---|---|
| 前端实时解码 PPTX | ❌ 慢（~几 MB 解码库） | ❌ 重 | ⚠️ 复杂效果易错位 | ❌ |
| **预处理图片 + JSON** | ✅ 快（首屏只拉 JSON + 第一页图） | ✅ 0 依赖 | ✅ 所见即所得 | ✅ 图片可加入搜索 |

前端渲染器 **零第三方库**，仅 200 余行原生 JS 实现缩略图网格 + 全屏放映模式。

## 目录约定

```
iris/data/pptx/
  ├── json/
  │   └── my-deck.json    ← 元数据：{ title, pages, ext?, width?, height? }
  └── images/
      ├── my-deck-1.png   ← 第 1 页
      ├── my-deck-2.png   ← 第 2 页
      └── ...
```

### 元数据 JSON 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 演示文稿标题（显示在缩略图网格标题栏） |
| `pages` | number | ✅ | 总页数，正整数 |
| `ext`   | string | 否 | 图片扩展名，默认 `png`；支持 `svg/jpg/jpeg/webp` |
| `width` / `height` | number | 否 | 原始 PPT 尺寸（仅元信息，暂未用） |

### 如何生成产物？

**PowerPoint / Keynote / WPS**：导出 / 另存为 → 「PNG」或「JPEG」，按序号命名为 `{slug}-1.png … {slug}-N.png`，再手写一份 `{slug}.json` 即可。

命令行批量（用 LibreOffice）：
```bash
libreoffice --headless --convert-to png MyDeck.pptx --outdir .
# 得到 MyDeck-1.png ~ MyDeck-N.png，再重命名为 slug-1.png …
```

## 基本用法

与 `pkt` 完全一致：用 `pptx` 代码块包裹 `@[pptx](slug)`：

````markdown
```pptx
@[pptx](example)
```
````

渲染效果如下（示例为「产品路线图 · 2026 Q3」，共 8 页 SVG 占位图）：

```pptx
@[pptx](example)
```

> **提示**：
> - 点击任意缩略图即可从该页开始**全屏放映**
> - 键盘：`←` / `→` 或 `Space` 翻页，`ESC` 关闭，`Home` / `End` 跳到首尾
> - 鼠标：点击屏幕左 / 右半区翻页，点击空白或右上角 ✕ 关闭
> - slug 含空格请用 `%20` 编码：`@[pptx](my%20deck)`

## 错误引导（演示加载失败时的友好提示）

故意引用一个不存在的 slug：加载失败不会崩溃，而是渲染一张带「如何修复」指引的卡片：

```pptx
@[pptx](this-does-not-exist)
```

（你将看到友好的错误提示与目录结构示例）

## 多个嵌入串联

文档中可同时嵌入多份演示，互不干扰：

- 📑 产品路线图：上面的 `example`
- 🧭 技术方案：`@[pptx](tech-design)`（需自行放入 images + json）

## 自定义图片扩展名

如果导出的是 WebP（体积比 PNG 小 40%+），在 JSON 里指定：

```json
{ "title": "技术方案", "pages": 18, "ext": "webp" }
```

缩略图和放映模式会自动请求 `tech-design-1.webp ~ tech-design-18.webp`。
