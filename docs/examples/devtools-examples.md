---
title: 开发者工具与交互组件示例
tags: [示例, 工具]
---

# 开发者工具与交互组件示例

本篇演示「文档即工具」的若干能力：术语表、HTTP 请求块、OpenAPI 文档、
SQL DDL → ER 图、开发者小工具（正则 / cron / 时间 / 色板 / 哈希 / JWT）、拼音注音，
以及 CSV → 图表联动。每节都给出 markdown 源码与实际渲染效果。

## 术语表悬浮

**源码**：

````markdown
```glossary
OSPF | 开放最短路径优先，一种链路状态路由协议
BGP | 边界网关协议，用于自治系统之间的路由
VLAN | 虚拟局域网，把一个物理交换机划分为多个逻辑网络
```
````

**渲染效果**：

```glossary
OSPF | 开放最短路径优先，一种链路状态路由协议
BGP | 边界网关协议，用于自治系统之间的路由
VLAN | 虚拟局域网，把一个物理交换机划分为多个逻辑网络
```

正文里首次出现 OSPF、BGP、VLAN 时会加下划线，悬停即可看到解释（本段即命中）。

## HTTP 实时请求块

`http` 围栏的第一行是方法 + URL，随后的 `Header: value` 行是请求头，
空行之后是请求体（GET/HEAD 会忽略请求体）。点击「发送」后才会真正发起请求。

### GET · JSON 响应

**源码**：

````markdown
```http
GET https://httpbin.org/json
Accept: application/json
```
````

**渲染效果**：

```http
GET https://httpbin.org/json
Accept: application/json
```

### GET · 纯文本响应

**源码**：

````markdown
```http
GET https://httpbin.org/robots.txt
```
````

**渲染效果**：

```http
GET https://httpbin.org/robots.txt
```

### GET · 带查询参数

**源码**：

````markdown
```http
GET https://httpbin.org/get?from=md-preview&lang=zh
Accept: application/json
```
````

**渲染效果**：

```http
GET https://httpbin.org/get?from=md-preview&lang=zh
Accept: application/json
```

### POST · JSON 请求体

**源码**：

````markdown
```http
POST https://httpbin.org/post
Content-Type: application/json

{"project":"md-preview","ok":true}
```
````

**渲染效果**：

```http
POST https://httpbin.org/post
Content-Type: application/json

{"project":"md-preview","ok":true}
```

### PUT · 覆盖资源

**源码**：

````markdown
```http
PUT https://httpbin.org/put
Content-Type: application/json

{"id":7,"name":"updated"}
```
````

**渲染效果**：

```http
PUT https://httpbin.org/put
Content-Type: application/json

{"id":7,"name":"updated"}
```

### PATCH · 局部更新

**源码**：

````markdown
```http
PATCH https://httpbin.org/patch
Content-Type: application/json

{"status":"draft"}
```
````

**渲染效果**：

```http
PATCH https://httpbin.org/patch
Content-Type: application/json

{"status":"draft"}
```

### DELETE · 删除资源

**源码**：

````markdown
```http
DELETE https://httpbin.org/delete?id=7
```
````

**渲染效果**：

```http
DELETE https://httpbin.org/delete?id=7
```

### 自定义请求头

**源码**：

````markdown
```http
GET https://httpbin.org/headers
X-Demo: iris
Accept-Language: zh-CN
```
````

**渲染效果**：

```http
GET https://httpbin.org/headers
X-Demo: iris
Accept-Language: zh-CN
```

### 错误响应

**源码**：

````markdown
```http
GET https://httpbin.org/status/404
```
````

**渲染效果**：

```http
GET https://httpbin.org/status/404
```

> 跨域（CORS）由目标服务决定；部分接口需在其服务端允许浏览器直接访问。

## 数据库模型图

SQL DDL / DBML 到 ER 图的能力已独立成篇，见 [DBML 与 ER 图](dbml-examples.md)（支持 ` ```dbml `、` ```sql ddl `）。

## OpenAPI 交互文档

**源码**：

````markdown
```openapi
{
  "openapi": "3.0.0",
  "info": { "title": "演示 API", "version": "1.0.0" },
  "servers": [{ "url": "https://httpbin.org" }],
  "paths": {
    "/get": {
      "get": {
        "summary": "测试 GET 请求",
        "parameters": [
          { "name": "foo", "in": "query", "schema": { "type": "string" }, "description": "示例查询参数" }
        ],
        "responses": { "200": { "description": "成功" } }
      }
    }
  }
}
```
````

**渲染效果**：

```openapi
{
  "openapi": "3.0.0",
  "info": { "title": "演示 API", "version": "1.0.0" },
  "servers": [{ "url": "https://httpbin.org" }],
  "paths": {
    "/get": {
      "get": {
        "summary": "测试 GET 请求",
        "parameters": [
          { "name": "foo", "in": "query", "schema": { "type": "string" }, "description": "示例查询参数" }
        ],
        "responses": { "200": { "description": "成功" } }
      }
    }
  }
}
```

## 开发者小工具

### 正则测试器

**源码**：

````markdown
```regex
/(\w+)@(\w+)\.(\w+)/g
联系人：alice@example.com，备用 bob@example.org
```
````

**渲染效果**：

```regex
/(\w+)@(\w+)\.(\w+)/g
联系人：alice@example.com，备用 bob@example.org
```

### Cron 解释

**源码**：

````markdown
```cron
*/15 9-18 * * 1-5
```
````

**渲染效果**：

```cron
*/15 9-18 * * 1-5
```

### 时间戳 / 时区

**源码**：

````markdown
```time
1700000000
```
````

**渲染效果**：

```time
1700000000
```

### 色板与对比度

**源码**：

````markdown
```color
#8B5CF6
#1f2937
rgb(139, 92, 246)
```
````

**渲染效果**：

```color
#8B5CF6
#1f2937
rgb(139, 92, 246)
```

### 文本哈希

**源码**：

````markdown
```hash
Markdown Preview
```
````

**渲染效果**：

```hash
Markdown Preview
```

### JWT 解码

**源码**：

````markdown
```jwt
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123
```
````

**渲染效果**：

```jwt
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123
```

## 拼音注音

语法 `{汉字|hán zì}`：{漢字|hàn zì}、{網絡|wǎng luò}。

**源码**：

````markdown
语法 `{汉字|hán zì}`：{漢字|hàn zì}、{網絡|wǎng luò}。
````

## CSV → 图表联动

**源码**：

````markdown
```csv
月份,访问量,转化
1月,1200,80
2月,1800,120
3月,1500,95
4月,2200,160
```
````

**渲染效果**：

```csv
月份,访问量,转化
1月,1200,80
2月,1800,120
3月,1500,95
4月,2200,160
```

点击表格浮窗里的「画成图」即可生成折线 / 柱状 / 面积 / 饼图。
