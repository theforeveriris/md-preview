---
title: 二维码插件示例
tags: [插件]
---

# 二维码生成插件示例

这是一个展示 Markdown Preview 二维码插件功能的示例文档。

## 基本用法

使用 `qrcode` 语言标签，内容就是你想要生成二维码的文本或 URL：

```qrcode
https://github.com
```

## 简单文本

```qrcode
Hello, World!
```

## 自定义大小

你可以使用 JSON 格式指定更多选项，比如二维码的大小：

```qrcode
{
  "data": "https://github.com",
  "size": 180
}
```

```qrcode
{
  "data": "Small QR Code",
  "size": 128
}
```

## 联系方式

```qrcode
mailto:example@example.com
```

## 长文本内容

```qrcode
这是一段很长的文本内容，用来测试二维码插件能否处理较长的输入。虽然我们的实现是简化版的，但应该能显示出基本的图案。
```

## 更多示例

```qrcode
https://en.wikipedia.org/wiki/QR_code
```

```qrcode
{
  "data": "Custom Size",
  "size": 300
}
```

---

## 插件功能说明

二维码插件支持：
- 直接文本和 URL
- JSON 配置（支持自定义大小）
- 自动显示二维码下方的内容预览
