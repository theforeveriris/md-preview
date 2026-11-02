---
title: 分布式 Trace 瀑布
tags: [Trace, 可观测性]
---

# 分布式 Trace 瀑布

支持 OTLP、Jaeger、Zipkin 三种格式。span 按父子层级缩进，关键路径高亮，点击展开属性。

## OTLP

**源码**（OTLP JSON 数组，service 取自 `resource.attributes` 的 `service.name`，时间为 `startTimeUnixNano`/`endTimeUnixNano`）：

````markdown
```trace
[
  {"traceId":"abc123","spanId":"1","name":"GET /api","startTimeUnixNano":1700000000000000000,"endTimeUnixNano":1700000000200000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"gateway"}}]}},
  {"traceId":"abc123","spanId":"2","parentSpanId":"1","name":"auth.check","startTimeUnixNano":1700000000020000000,"endTimeUnixNano":1700000000080000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"auth"}}]}},
  {"traceId":"abc123","spanId":"3","parentSpanId":"1","name":"db.query","startTimeUnixNano":1700000000090000000,"endTimeUnixNano":1700000000180000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"db"}}]}},
  {"traceId":"abc123","spanId":"4","parentSpanId":"3","name":"redis.get","startTimeUnixNano":1700000000100000000,"endTimeUnixNano":1700000000140000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"cache"}}]}},
  {"traceId":"abc123","spanId":"5","parentSpanId":"1","name":"render","startTimeUnixNano":1700000000185000000,"endTimeUnixNano":1700000000200000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"gateway"}}]}}
]
```
````

**渲染效果**（auth.check / db.query / redis.get 按父子层级缩进，根到最耗时子链即关键路径）：

```trace
[
  {"traceId":"abc123","spanId":"1","name":"GET /api","startTimeUnixNano":1700000000000000000,"endTimeUnixNano":1700000000200000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"gateway"}}]}},
  {"traceId":"abc123","spanId":"2","parentSpanId":"1","name":"auth.check","startTimeUnixNano":1700000000020000000,"endTimeUnixNano":1700000000080000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"auth"}}]}},
  {"traceId":"abc123","spanId":"3","parentSpanId":"1","name":"db.query","startTimeUnixNano":1700000000090000000,"endTimeUnixNano":1700000000180000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"db"}}]}},
  {"traceId":"abc123","spanId":"4","parentSpanId":"3","name":"redis.get","startTimeUnixNano":1700000000100000000,"endTimeUnixNano":1700000000140000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"cache"}}]}},
  {"traceId":"abc123","spanId":"5","parentSpanId":"1","name":"render","startTimeUnixNano":1700000000185000000,"endTimeUnixNano":1700000000200000000,"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"gateway"}}]}}
]
```

## Jaeger

**源码**（Jaeger HTTP API 的 `{data:[{traceID, spans, processes}]}` 结构）：

````markdown
```trace
{"data":[{"traceID":"def456","spans":[
  {"spanID":"1","operationName":"web","startTime":1700000000000000,"duration":30000, "processID":"p1","references":[]},
  {"spanID":"2","operationName":"api","startTime":1700000000100000,"duration":20000,"processID":"p2","references":[{"refType":"CHILD","spanID":"1","traceID":"def456"}]}
]}],"processes":{"p1":{"serviceName":"web"},"p2":{"serviceName":"api"}}}
```
````

**渲染效果**：

```trace
{"data":[{"traceID":"def456","spans":[
  {"spanID":"1","operationName":"web","startTime":1700000000000000,"duration":30000, "processID":"p1","references":[]},
  {"spanID":"2","operationName":"api","startTime":1700000000100000,"duration":20000,"processID":"p2","references":[{"refType":"CHILD","spanID":"1","traceID":"def456"}]}
]}],"processes":{"p1":{"serviceName":"web"},"p2":{"serviceName":"api"}}}
```

## Zipkin

**源码**（Zipkin v2 的 `tags` 是对象；span 有属性时点击行可展开查看）：

````markdown
```trace
[
  {"traceId":"789abc","id":"a","name":"GET /cart","timestamp":1700000000000000,"duration":50000,
   "localEndpoint":{"serviceName":"cart"},
   "tags":{"http.method":"GET","http.path":"/cart","user.id":"u1024"}},
  {"traceId":"789abc","id":"b","parentId":"a","name":"mysql SELECT","timestamp":1700000000100000,"duration":30000,
   "localEndpoint":{"serviceName":"db"},
   "tags":{"db.statement":"SELECT * FROM cart WHERE uid=?","db.rows":"3"}}
]
```
````

**渲染效果**（点击 GET /cart 或 mysql SELECT 行展开属性面板）：

```trace
[
  {"traceId":"789abc","id":"a","name":"GET /cart","timestamp":1700000000000000,"duration":50000,
   "localEndpoint":{"serviceName":"cart"},
   "tags":{"http.method":"GET","http.path":"/cart","user.id":"u1024"}},
  {"traceId":"789abc","id":"b","parentId":"a","name":"mysql SELECT","timestamp":1700000000100000,"duration":30000,
   "localEndpoint":{"serviceName":"db"},
   "tags":{"db.statement":"SELECT * FROM cart WHERE uid=?","db.rows":"3"}}
]
```

## 说明

- `@[trace](trace.json)` 可嵌入仓库内 trace 文件（OTLP/Jaeger/Zipkin 自动识别）。
- 时间轴按全 trace 归一化；关键路径（根到最耗时子链）的行与条以主题色高亮。
- 服务过滤、关键字搜索与 CSV 导出均可用；解析失败会回退为源码块。
