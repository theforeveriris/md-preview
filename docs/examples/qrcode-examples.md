---
title: 二维码插件示例
---

# 美化二维码插件示例

这是一个展示 Markdown Preview 二维码插件功能的示例文档，包含多种美化风格、配色方案和高级自定义选项。

## 基本用法

### 默认渐变风格
```qrcode
https://github.com/theforeveriris/md-preview
```

### 简单文本
```qrcode
Hello, Beautiful QR Code!
```

## 视觉风格展示

### 圆点风格 - 海洋配色
```qrcode
{
  "data": "https://github.com",
  "style": "dots",
  "colorScheme": "ocean",
  "size": 320
}
```

### 圆角风格 - 日落配色
```qrcode
{
  "data": "扫描二维码，体验美化效果！",
  "style": "rounded",
  "colorScheme": "sunset",
  "size": 300
}
```

### 霓虹风格 - 森林配色
```qrcode
{
  "data": "https://example.com/neon-qr",
  "style": "neon",
  "colorScheme": "forest"
}
```

### 经典风格 - 紫色配色
```qrcode
{
  "data": "Classic style with gradient colors",
  "style": "classic",
  "colorScheme": "purple",
  "size": 280
}
```

### 渐变风格 - 火焰配色
```qrcode
{
  "data": "https://your-website.com",
  "style": "gradient",
  "colorScheme": "fire"
}
```

## 配色方案展示

### 单色方案
```qrcode
{
  "data": "Monochrome QR Code",
  "colorScheme": "monochrome",
  "style": "rounded"
}
```

### 粉彩方案
```qrcode
{
  "data": "Pastel Colors",
  "colorScheme": "pastel",
  "style": "dots"
}
```

### 赛博朋克方案
```qrcode
{
  "data": "Cyberpunk Style",
  "colorScheme": "cyberpunk",
  "style": "neon"
}
```

## 高级自定义

### 自定义标题和文本
```qrcode
{
  "data": "https://custom-title.com",
  "title": "访问我们的网站",
  "colorScheme": "ocean"
}
```

### 隐藏标题和文本
```qrcode
{
  "data": "https://minimal.com",
  "showTitle": false,
  "showText": false,
  "colorScheme": "forest"
}
```

### 无Logo版本
```qrcode
{
  "data": "QR Code without center logo",
  "style": "dots",
  "colorScheme": "ocean",
  "showLogo": false
}
```

### 紧凑布局
```qrcode
{
  "data": "Compact Layout",
  "containerClass": "compact",
  "size": 240
}
```

### 极简风格
```qrcode
{
  "data": "Minimal Style",
  "containerClass": "minimal",
  "shadow": "none"
}
```

### 华丽模式
```qrcode
{
  "data": "Fancy Mode",
  "containerClass": "fancy",
  "shadow": "xl",
  "colorScheme": "purple"
}
```

## CSS主题应用

### 优雅主题
```qrcode
{
  "data": "Elegant Theme",
  "theme": "elegant",
  "style": "rounded"
}
```

### 活力主题
```qrcode
{
  "data": "Vibrant Theme",
  "theme": "vibrant",
  "style": "dots"
}
```

### 自然主题
```qrcode
{
  "data": "Nature Theme",
  "theme": "nature",
  "style": "rounded"
}
```

### 海洋主题
```qrcode
{
  "data": "Ocean Theme",
  "theme": "ocean",
  "style": "gradient"
}
```

## 边框和阴影

### 实线边框
```qrcode
{
  "data": "Solid Border",
  "border": "solid",
  "colorScheme": "gradient"
}
```

### 虚线边框
```qrcode
{
  "data": "Dashed Border",
  "border": "dashed",
  "colorScheme": "sunset"
}
```

### 渐变边框
```qrcode
{
  "data": "Gradient Border",
  "border": "gradient",
  "shadow": "lg"
}
```

### 小阴影
```qrcode
{
  "data": "Small Shadow",
  "shadow": "sm",
  "colorScheme": "pastel"
}
```

### 超大阴影
```qrcode
{
  "data": "Extra Large Shadow",
  "shadow": "xl",
  "colorScheme": "fire"
}
```

## 背景样式

### 透明背景
```qrcode
{
  "data": "Transparent Background",
  "background": "transparent",
  "colorScheme": "gradient"
}
```

### 模糊背景
```qrcode
{
  "data": "Blur Background",
  "background": "blur",
  "colorScheme": "ocean"
}
```

### 暖色背景
```qrcode
{
  "data": "Warm Background",
  "background": "warm",
  "colorScheme": "sunset"
}
```

### 冷色背景
```qrcode
{
  "data": "Cool Background",
  "background": "cool",
  "colorScheme": "ocean"
}
```

## 自定义颜色

### 完全自定义配色
```qrcode
{
  "data": "Custom Colors",
  "customColors": {
    "start": "#FF1493",
    "end": "#00CED1",
    "bg": "#FFF0F5",
    "text": "#8B008B"
  },
  "style": "dots"
}
```

## 组合示例

### 终极自定义
```qrcode
{
  "data": "https://ultimate-custom.com",
  "style": "dots",
  "colorScheme": "cyberpunk",
  "size": 350,
  "showLogo": true,
  "title": "🚀 扫描体验未来",
  "showTitle": true,
  "showText": true,
  "theme": "vibrant",
  "shadow": "xl",
  "border": "gradient",
  "background": "blur"
}
```

## 可用配置选项完整列表

### 基础选项
- `data` (string, 必需) - 二维码内容
- `size` (number, 默认320) - 二维码尺寸（像素）

### 样式选项 (style)
- `gradient` - 渐变风格（默认）
- `dots` - 圆点风格
- `rounded` - 圆角风格
- `neon` - 霓虹发光风格
- `classic` - 经典精致风格

### 配色方案 (colorScheme)
- `gradient` - 紫色渐变（默认）
- `ocean` - 海洋蓝
- `sunset` - 日落橙红
- `forest` - 森林绿
- `neon` - 霓虹绿蓝
- `purple` - 紫粉渐变
- `fire` - 火焰橙黄
- `monochrome` - 单色黑白
- `pastel` - 粉彩柔和
- `cyberpunk` - 赛博朋克

### 显示选项
- `showLogo` (boolean, 默认true) - 是否显示中心Logo
- `showTitle` (boolean, 默认true) - 是否显示标题
- `showText` (boolean, 默认true) - 是否显示二维码内容文本
- `title` (string, 默认"扫描二维码") - 自定义标题文本

### 容器样式
- `containerClass` (string) - 容器CSS类：`compact`（紧凑）、`minimal`（极简）、`fancy`（华丽）
- `theme` (string) - 主题：`elegant`、`vibrant`、`nature`、`ocean`、`sunset`
- `shadow` (string) - 阴影大小：`sm`、`lg`、`xl`、`none`
- `background` (string) - 背景样式：`transparent`、`blur`、`warm`、`cool`
- `border` (string) - 边框样式：`solid`、`dashed`、`dotted`、`gradient`

### 高级选项
- `customColors` (object) - 自定义颜色：`{ start, end, bg, text }`

## 特性总结

✨ **多种美化样式** - 5种不同的视觉风格
🎨 **丰富配色方案** - 10种精心设计的配色
💎 **CSS控制器** - 完整的CSS变量系统
🔍 **中心Logo** - 可选的扫描图标装饰
💫 **平滑动画** - 优雅的渐入效果
📱 **响应式设计** - 适配不同尺寸
🎭 **装饰元素** - 精美的背景装饰
🎪 **主题系统** - 预设主题和自定义主题
🌓 **暗色模式** - 自适应暗色主题
🖨️ **打印友好** - 优化的打印样式
♿ **无障碍** - 高对比度支持

## 使用建议

1. **品牌推广** - 使用`customColors`匹配品牌色
2. **社交媒体** - 选择`dots`或`rounded`风格，使用`vibrant`主题
3. **技术文档** - 使用`classic`或`gradient`风格，`elegant`主题
4. **创意设计** - 尝试`neon`风格配合`cyberpunk`配色
5. **打印材料** - 使用较大的`size`（350-400px），`monochrome`配色
6. **移动端** - 使用`compact`布局，较小的`size`（240-280px）
7. **极简设计** - 使用`minimal`容器类，`shadow: "none"`
