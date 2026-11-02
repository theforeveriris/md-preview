---
title: 图片热点与 CLI 帮助
tags: [图片, 教程, CLI]
---

# 图片热点与 CLI 帮助

## 图片热点标注

`hotspot` 围栏用百分比坐标在图片上标注热点：悬停/点击显示标签，热点带编号徽标，图片下方自动生成编号图例（打印时图例保留，悬停信息不丢失）。

**源码**（`x/y/w/h` 为相对图片宽高的百分比；`w/h` 缺省时按标签自适应大小）：

````markdown
```hotspot
{
  "image": "docs/image/share-card-code.png",
  "title": "分享卡片示例",
  "hotspots": [
    { "x": 12, "y": 18, "w": 34, "h": 10, "label": "标题区" },
    { "x": 55, "y": 70, "label": "二维码" }
  ]
}
```
````

**渲染效果**：

```hotspot
{
  "image": "docs/image/share-card-code.png",
  "title": "分享卡片示例",
  "hotspots": [
    { "x": 12, "y": 18, "w": 34, "h": 10, "label": "标题区" },
    { "x": 55, "y": 70, "label": "二维码" }
  ]
}
```

## CLI 帮助

把 `--help` 输出变成结构化帮助卡片。

**源码**：

````markdown
```clihelp
Usage: iris <command> [options]

Commands:
  build     构建文档站点
  serve     本地开发服务器
  test      运行测试

Options:
  -V, --version      输出版本号
  -h, --help         显示帮助
  --config <path>    配置文件路径
  --port <number>    服务端口

Examples:
  iris build --config config.json
  iris serve --port 8080
```
````

**渲染效果**：

```clihelp
Usage: iris <command> [options]

Commands:
  build     构建文档站点
  serve     本地开发服务器
  test      运行测试

Options:
  -V, --version      输出版本号
  -h, --help         显示帮助
  --config <path>    配置文件路径
  --port <number>    服务端口

Examples:
  iris build --config config.json
  iris serve --port 8080
```

解析规则：识别 `Usage:` / `Options:` / `Commands:` / `Examples:` 段；选项行把短选项、长选项、参数（`<path>`、`[n]`、`=值` 或与说明间隔 ≥2 空格的裸词）分列；无法识别时回退为源码块。

## 协议注册表

**源码**（列间用 ≥2 个空格对齐，末列可含空格）：

````markdown
```registry
port  name   proto  description
22    ssh    tcp    Secure Shell
53    dns    udp    Domain Name System
80    http   tcp    Hypertext Transfer Protocol
443   https  tcp    HTTPS
```
````

**渲染效果**：

```registry
port  name   proto  description
22    ssh    tcp    Secure Shell
53    dns    udp    Domain Name System
80    http   tcp    Hypertext Transfer Protocol
443   https  tcp    HTTPS
```

内置常用协议表可用 `registry common` 或 `@[registry](common)` 调用（可搜索、排序、导出）。
