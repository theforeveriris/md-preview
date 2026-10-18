---
title: 开发者工具与交互组件示例
tags: [示例, 工具]
---

# 开发者工具与交互组件示例

本篇演示本轮新增的若干「文档即工具」能力：术语表、HTTP 请求块、OpenAPI 文档、
SQL DDL → ER 图、开发者小工具（正则 / cron / 时间 / 色板 / 哈希 / JWT）、拼音注音，
以及 CSV → 图表联动。

## 术语表悬浮

```glossary
OSPF | 开放最短路径优先，一种链路状态路由协议
BGP | 边界网关协议，用于自治系统之间的路由
VLAN | 虚拟局域网，把一个物理交换机划分为多个逻辑网络
```

正文里首次出现 OSPF、BGP、VLAN 时会加下划线，悬停即可看到解释（本段即命中）。

## HTTP 实时请求块

点击「发送」后才会真正发起请求（JSON 响应会自动格式化）：

```http
GET https://httpbin.org/json
Accept: application/json
```

> 跨域（CORS）由目标服务决定；部分接口需在其服务端允许浏览器直接访问。

## SQL DDL → ER 图

贴建表语句即自动生成 ER 图：

```sql ddl
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  email VARCHAR(120)
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT,
  total DECIMAL(10,2),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## OpenAPI 交互文档

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

```regex
/(\w+)@(\w+)\.(\w+)/g
联系人：alice@example.com，备用 bob@example.org
```

### Cron 解释

```cron
*/15 9-18 * * 1-5
```

### 时间戳 / 时区

```time
1700000000
```

### 色板与对比度

```color
#d4a5c9
#1f2937
rgb(139, 92, 246)
```

### 文本哈希

```hash
Markdown Preview
```

### JWT 解码

```jwt
eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123
```

## 拼音注音

语法 `{汉字|hán zì}`：{漢字|hàn zì}、{網絡|wǎng luò}。

## CSV → 图表联动

```csv
月份,访问量,转化
1月,1200,80
2月,1800,120
3月,1500,95
4月,2200,160
```

点击表格工具栏的「画成图」即可生成折线 / 柱状 / 面积 / 饼图。
