---
title: Countdown 插件示例
---

# Countdown 倒计时插件示例

`countdown` 插件将 Markdown 代码块渲染为实时刷新的倒计时 / 正计时卡片，适合用于：

- 距离某个固定时间点的倒计时（截止日期、活动开始、考试倒计时等）
- 自某个历史时间点起的正计时（项目开始至今、产品上线至今等）
- 相对时长的倒计时（30 分钟后、1 天 2 小时后等）

## 基础用法

### 1. ISO 日期字符串

直接传入任何 `Date.parse` 能识别的日期字符串，默认倒计时方向。

````markdown
```countdown
2026-12-31T23:59:59
```
````

```countdown
2026-12-31T23:59:59
```

### 2. 相对时长

支持 `1d2h3m4s` 形式的相对时长，自动从当前时间起向后推算目标时间。

````markdown
```countdown
1d2h30m
```
````

```countdown
1d2h30m
```

支持的单位：

| 单位 | 含义 | 示例 |
|------|------|------|
| `d` | 天 | `1d` |
| `h` | 小时 | `2h` |
| `m` | 分钟 | `30m` |
| `s` | 秒 | `15s` |

可任意组合，如 `1d12h`、`90m`、`2h45m30s`。

### 3. JSON 配置

JSON 形式可以同时指定目标时间、方向、标题等：

````markdown
```countdown
{
  "target": "2026-01-01",
  "direction": "down",
  "title": "距离元旦"
}
```
````

```countdown
{
  "target": "2026-01-01",
  "direction": "down",
  "title": "距离元旦"
}
```

## 正计时（自某时间起）

当目标时间已过或显式指定 `"direction": "up"`，会切换为正计时模式：

````markdown
```countdown
{
  "target": "2020-01-01",
  "direction": "up",
  "title": "项目启动至今"
}
```
````

```countdown
{
  "target": "2020-01-01",
  "direction": "up",
  "title": "项目启动至今"
}
```

## 使用 duration 替代 target

如果不想算具体目标时间，可以直接用 `duration` 字段：

````markdown
```countdown
{
  "duration": "1h30m",
  "title": "本场会议剩余"
}
```
````

```countdown
{
  "duration": "1h30m",
  "title": "本场会议剩余"
}
```

## 全局配置

在 [iris/config.json](../../iris/config.json) 中可以为所有 `countdown` 代码块提供默认配置：

```json
{
  "plugins": {
    "countdown": {
      "updateIntervalMs": 1000,
      "labelFinished": "已结束",
      "labelCountingUp": "已过去",
      "locale": "zh-CN"
    }
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `updateIntervalMs` | `number` | `1000` | 数字刷新间隔（毫秒） |
| `labelFinished` | `string` | `已结束` | 倒计时归零时的标题文案 |
| `labelCountingUp` | `string` | `已过去` | 正计时模式下的标题文案 |
| `locale` | `string` | `zh-CN` | `toLocaleString` 使用的区域 |

## 输入格式总览

| 格式 | 示例 | 说明 |
|------|------|------|
| ISO 日期 | `2026-12-31T23:59:59` | 任意 `Date.parse` 支持的格式 |
| 相对时长 | `1d2h30m` | 自动转换为「现在 + 时长」 |
| JSON 对象 | `{"target": "...", "direction": "up"}` | 完整配置 |
| JSON 对象 + duration | `{"duration": "1h"}` | 用相对时长指定目标 |
| JSON 数组 | `[{"target": "..."}]` | 取数组第一项 |

## 错误处理

如果输入无法解析，会显示红色错误卡片而不是抛出异常。例如：

````markdown
```countdown
这不是一个有效的日期或时长
```
````

## 实现要点

本插件演示了插件 API 的以下能力（参见 [iris/plugins/countdown.js](../../iris/plugins/countdown.js)）：

- **省略 `test`**：默认精确匹配 `language === 'countdown'`
- **`init(config)`**：合并 `config.json` 中的 `plugins.countdown` 配置
- **`beforeRender`**：设置容器初始透明度做淡入
- **同步 `render`**：内部使用 `setInterval`，注册资源以便后续清理
- **`registerResource`**：注册包含 `destroy()` 的资源对象，由 loader 在注销时统一调用
- **`destroy()`**：兜底清理所有未释放的定时器，避免内存泄漏

## 注意事项

- 倒计时会在文档切换时自动停止（loader 调用 `destroy`），不会泄漏定时器
- 时区以浏览器本地时区为准，ISO 字符串带 `Z` 时按 UTC 解析
- `updateIntervalMs` 不建议低于 `250`，避免过度刷新影响性能
