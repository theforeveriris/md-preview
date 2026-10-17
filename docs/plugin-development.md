---
title: 插件开发指南
tags: [插件]
---

# 插件开发指南

## 插件机制概述

Markdown Preview 的插件系统允许你扩展 Markdown 渲染能力，自定义处理特定的代码块。插件放入 `iris/plugins/` 目录后，加载器会自动发现并注册。

## 插件接口（v2）

每个插件是一个导出对象的 JavaScript 模块（ES Module），支持以下接口：

```javascript
export default {
  name: 'plugin-name',          // 插件名称（唯一标识）
  description: '插件描述',       // 描述信息
  priority: 10,                 // 优先级（可选，默认 0，数值越大越优先）

  // 生命周期：初始化 — 接收来自 config.json 的配置
  init(config) {
    this._config = { ...config };
  },

  // 判断是否处理该代码块（可选，默认精确匹配 language === name）
  test(code, language) {
    return language === 'my-language';
  },

  // 渲染前钩子（可选）
  beforeRender(code, container, context) {
    container.style.opacity = '0.5';
  },

  // 渲染内容到容器（支持同步或 async）
  async render(code, container, context) {
    const data = JSON.parse(code);
    container.innerHTML = `<p>Hello ${data.name}</p>`;
  },

  // 渲染后钩子（可选）
  afterRender(container, context) {
    console.log('Rendered!');
  },

  // 生命周期：销毁 — 清理资源（可选）
  destroy() {
    console.log('Cleaning up...');
  }
};
```

### API 说明

| 字段/方法 | 类型 | 必填 | 说明 |
|-----------|------|------|------|
| `name` | `string` | ✅ | 插件唯一标识 |
| `description` | `string` | ❌ | 描述信息 |
| `priority` | `number` | ❌ | 优先级，默认 `0`，数值越大越优先匹配 |
| `test` | `(code, language) => boolean` | ❌ | 判断是否处理此代码块，省略时默认 `language === name` |
| `init` | `(config) => void` | ❌ | 初始化钩子，接收 `config.json` 中 `plugins[name]` 配置 |
| `beforeRender` | `(code, container, context) => void` | ❌ | 渲染前钩子 |
| `render` | `(code, container, context) => void \| Promise` | ✅ | 渲染函数，支持同步或 `async` |
| `afterRender` | `(container, context) => void` | ❌ | 渲染后钩子 |
| `destroy` | `() => void` | ❌ | 注销/销毁时调用，用于清理资源 |

### 上下文对象 `context`

`render`、`beforeRender`、`afterRender` 均接收第三个参数 `context`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `language` | `string` | 当前代码块的语言标识 |
| `pluginName` | `string` | 当前插件名称 |
| `documentPath` | `string` | 当前文档路径（相对于仓库根目录） |
| `config` | `object` | 来自 `config.json` 的该插件专属配置 |
| `registerResource` | `(resource) => void` | 注册可清理资源（如图表实例、定时器），资源需有 `destroy()` 方法 |

## 开发插件

### 第一步：创建插件文件

在 `iris/plugins/` 目录下创建新文件，例如 `weather.js`。

### 第二步：实现插件逻辑

以下是一个完整的示例——将 `weather` 代码块渲染为天气卡片：

```javascript
export default {
  name: 'weather',
  description: '天气卡片渲染',
  priority: 5,

  test(code, language) {
    return language === 'weather';
  },

  render(code, container, context) {
    try {
      const data = JSON.parse(code);
      container.innerHTML = `
        <div style="
          display: inline-block;
          padding: 16px 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, #89f7fe, #66a6ff);
          color: #fff;
          font-family: sans-serif;
        ">
          <div style="font-size: 2rem; font-weight: bold;">${data.temp}°C</div>
          <div>${data.city} · ${data.condition}</div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = '<p style="color: red;">天气数据格式错误</p>';
    }
  }
};
```

### 第三步：使用插件

在 Markdown 中使用对应的语言标识：

````markdown
```weather
{
  "temp": 25,
  "city": "北京",
  "condition": "晴"
}
```
````

## 插件配置

在 `iris/config.json` 中为插件提供配置：

```json
{
  "plugins": {
    "qrcode": {
      "defaultSize": 300
    }
  }
}
```

插件的 `init(config)` 钩子会接收到上述配置对象。

## 插件加载策略

加载器按以下优先级自动发现插件：

1. **`config.plugins.manifest`**：显式指定插件 URL 列表，最可靠
2. **`iris/plugins/directory.json`**：预构建的插件索引文件
3. **目录扫描**：回退到 `fetch('iris/plugins/')` 扫描 `.js` 文件（部分静态托管不支持）

推荐在 CI 中生成 `directory.json`：

```json
{
  "files": ["qrcode.js", "custom-chart.js"]
}
```

## 渲染时机

插件在 Markdown 渲染管道的最后阶段执行，顺序如下：

1. Marked.js 解析 Markdown → HTML
2. 处理 Frontmatter、Alerts、图片增强等
3. 调用各扩展渲染器（Mermaid、KaTeX 等）
4. **调用插件渲染**（此时执行）

## 参考实现

项目内置的二维码插件 [iris/plugins/qrcode.js](../iris/plugins/qrcode.js) 是一个完整的参考实现，演示了：

- 生命周期钩子（`init` / `beforeRender` / `afterRender` / `destroy`）
- 异步渲染（`async render` + 图片加载）
- 配置合并（`config.json` 中的 `defaultSize`）
- 资源注册（`registerResource`）

## 注意事项

- 插件文件必须放在 `iris/plugins/` 目录下，或使用 `config.plugins.manifest` 指定自定义路径
- 使用 ES Module 语法（`export default`），支持 `async/await`
- 插件的 `test` 方法应当精确匹配，避免与其他渲染器冲突
- `render` 方法中应处理异常，系统会捕获错误并显示友好的错误边界
- 插件运行在浏览器端，可以使用浏览器 API（Canvas、Fetch、WebSocket 等）
- 使用 `priority` 控制插件匹配顺序，避免不同插件竞争同一语言
- 需要清理资源（定时器、图表实例、事件监听）时，实现 `destroy()` 钩子并在其中释放，或使用 `context.registerResource()`
