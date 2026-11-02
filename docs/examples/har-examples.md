---
title: HAR 瀑布图与请求分析
tags: [HAR, 网络]
---

# HAR 瀑布图与请求分析

## 内联 HAR

**源码**（HAR 1.2 JSON，重点在 `entries[].timings` 的分段计时）：

````markdown
```har
{"log":{"version":"1.2","creator":{"name":"demo","version":"1"},"entries":[{"startedDateTime":"2026-11-02T10:00:00.000Z","time":42,"_resourceType":"document","request":{"method":"GET","url":"https://example.com/index.html","headers":[{"name":"Accept","value":"text/html"}]},"response":{"status":200,"headers":[{"name":"Content-Type","value":"text/html"}],"content":{"size":10240}},"timings":{"blocked":4,"dns":10,"connect":12,"send":1,"wait":12,"receive":3}},{"startedDateTime":"2026-11-02T10:00:00.045Z","time":128,"_resourceType":"stylesheet","request":{"method":"GET","url":"https://example.com/app.css","headers":[]},"response":{"status":200,"headers":[],"content":{"size":24800}},"timings":{"blocked":2,"dns":0,"connect":0,"send":1,"wait":90,"receive":35}}]}}
```
````

**渲染效果**（点击任意行展开请求头 / 响应头 / 分段计时）：

```har
{"log":{"version":"1.2","creator":{"name":"demo","version":"1"},"entries":[{"startedDateTime":"2026-11-02T10:00:00.000Z","time":42,"_resourceType":"document","request":{"method":"GET","url":"https://example.com/index.html","headers":[{"name":"Accept","value":"text/html"}]},"response":{"status":200,"headers":[{"name":"Content-Type","value":"text/html"}],"content":{"size":10240}},"timings":{"blocked":4,"dns":10,"connect":12,"send":1,"wait":12,"receive":3}},{"startedDateTime":"2026-11-02T10:00:00.045Z","time":128,"_resourceType":"stylesheet","request":{"method":"GET","url":"https://example.com/app.css","headers":[]},"response":{"status":200,"headers":[],"content":{"size":24800}},"timings":{"blocked":2,"dns":0,"connect":0,"send":1,"wait":90,"receive":35}}]}}
```

## 嵌入 HAR 文件

**源码**（`@[har](路径)` 引用仓库内 `.har` 文件，这里用 `docs/examples/demo.har`）：

````markdown
```har
@[har](docs/examples/demo.har)
```
````

**渲染效果**（6 请求，含一条 504 失败——红色状态标记）：

```har
@[har](docs/examples/demo.har)
```

能力说明：瀑布条按 blocked / DNS / connect / SSL / send / wait / receive 分段着色；顶部汇总请求数、总大小、总耗时、失败数；支持搜索 URL、按类型 / 域名 / 状态过滤，导出 CSV。解析失败回退为源码块。
