---
title: ColorCard 插件示例
---

# ColorCard 颜色卡片插件示例

`colorcard` 插件将颜色列表渲染为可点击复制的色卡墙，自动根据背景亮度自适应文字颜色。常用于：

- 设计稿配色展示
- 品牌色 / 主题色文档
- 调色板分享
- 数据可视化色阶说明

支持三种代码块语言别名：`colorcard`、`colors`、`palette`。

## 基础用法

### 1. 行分隔色值（最简形式）

每行一个颜色，支持十六进制、颜色名、`rgb()`、`hsl()` 等任意浏览器识别的格式。

````markdown
```colorcard
#FF6B6B
#4ECDC4
#45B7D1
#FFA07A
#98D8C8
```
````

```colorcard
#FF6B6B
#4ECDC4
#45B7D1
#FFA07A
#98D8C8
```

### 2. CSV 形式

用逗号分隔：

````markdown
```colorcard
#d4a5c9, #f2c4ce, #b88aad, #6b5b73
```
````

```colorcard
#d4a5c9, #f2c4ce, #b88aad, #6b5b73
```

### 3. 带色名

支持 `name: #hex`、`name = #hex`、`name #hex` 等形式：

````markdown
```colorcard
主色: #d4a5c9
粉色: #f2c4ce
深色: #b88aad
中性: #6b5b73
```
````

```colorcard
主色: #d4a5c9
粉色: #f2c4ce
深色: #b88aad
中性: #6b5b73
```

### 4. CSS 颜色名

````markdown
```colorcard
crimson
rebeccapurple
darkorange
teal
slateblue
```
````

```colorcard
crimson
rebeccapurple
darkorange
teal
slateblue
```

### 5. rgb / hsl 函数

````markdown
```colorcard
rgb(99, 102, 241)
rgb(236, 72, 153)
hsl(160, 60%, 45%)
hsl(35, 90%, 55%)
```
````

```colorcard
rgb(99, 102, 241)
rgb(236, 72, 153)
hsl(160, 60%, 45%)
hsl(35, 90%, 55%)
```

## JSON 形式

### 对象数组（推荐用于结构化数据）

````markdown
```colorcard
[
  { "name": "Brand",     "color": "#d4a5c9" },
  { "name": "Accent",    "color": "#f2c4ce" },
  { "name": "Deep",      "color": "#b88aad" },
  { "name": "Neutral",   "color": "#6b5b73" }
]
```
````

```colorcard
[
  { "name": "Brand",     "color": "#d4a5c9" },
  { "name": "Accent",    "color": "#f2c4ce" },
  { "name": "Deep",      "color": "#b88aad" },
  { "name": "Neutral",   "color": "#6b5b73" }
]
```

### 带 colors 字段的对象

````markdown
```colorcard
{
  "colors": [
    "#fafafa", "#f0f0f0", "#d4d4d4", "#a3a3a3", "#525252", "#171717"
  ]
}
```
````

```colorcard
{
  "colors": [
    "#fafafa", "#f0f0f0", "#d4d4d4", "#a3a3a3", "#525252", "#171717"
  ]
}
```

## 交互

每张色卡都可以点击复制：

- 默认复制 **十六进制** 值（如 `#D4A5C9`）
- 鼠标悬停时右上角显示「点击复制」提示
- 复制成功时卡片上覆盖短暂 Toast，显示复制的值
- 在不安全的上下文（HTTP / 拒绝权限）下，自动回退到 `execCommand('copy')`

## 全局配置

在 [iris/config.json](../../iris/config.json) 中可以为所有 `colorcard` 代码块提供默认配置：

```json
{
  "plugins": {
    "colorcard": {
      "columns": 6,
      "copyFormat": "hex",
      "showLabels": true,
      "enableCopy": true
    }
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `columns` | `number` | `4` | 网格列数，自动限制在 1–12 之间 |
| `copyFormat` | `'hex' \| 'rgb' \| 'hsl'` | `'hex'` | 点击复制时使用的格式 |
| `showLabels` | `boolean` | `true` | 是否显示色名（仅当色卡有色名时） |
| `enableCopy` | `boolean` | `true` | 是否启用点击复制 |

例如把列数改为 6：

````markdown
```colorcard
#ef4444,#f97316,#f59e0b,#84cc16,#10b981,#06b6d4
#3b82f6,#6366f1,#8b5cf6,#a855f7,#d946ef,#ec4899
```
````

```colorcard
#ef4444,#f97316,#f59e0b,#84cc16,#10b981,#06b6d4
#3b82f6,#6366f1,#8b5cf6,#a855f7,#d946ef,#ec4899
```

## 错误处理

无法识别的颜色会被静默跳过；如果整个列表都解析失败，会显示红色错误卡片：

````markdown
```colorcard
not-a-color
```
````

## 实现要点

本插件演示了插件 API 的以下能力（参见 [iris/plugins/colorcard.js](../../iris/plugins/colorcard.js)）：

- **自定义 `test`**：同时匹配 `colorcard` / `colors` / `palette` 三种语言别名
- **`init(config)`**：合并 `config.json` 中的 `plugins.colorcard` 配置
- **`async render`**：使用 `await navigator.clipboard.writeText()` 异步复制
- **多格式解析**：JSON、CSV、行分隔、`name: color` 混合形式统一处理
- **事件监听器清理**：每个色卡的 click 监听器都通过 `registerResource` 注册，避免内存泄漏
- **`destroy()`**：兜底清理所有未释放的事件监听器
- **亮度自适应**：根据 WCAG 相对亮度公式选择文字颜色，确保对比度

## 注意事项

- 颜色解析依赖浏览器 `style.color` 赋值 + `getComputedStyle` 计算，因此任意 CSS 颜色都能识别
- 解析阶段会临时挂载一个不可见的探测元素到 `document.body`，解析后立即移除
- 复制功能在 HTTPS 或 `localhost` 下使用原生 Clipboard API，否则回退到 `execCommand`
- 卡片背景使用原始色值，文字色按 WCAG 亮度阈值（0.5）自动选择黑 / 白
