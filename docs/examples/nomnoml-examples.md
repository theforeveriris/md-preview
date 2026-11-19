---
title: Nomnoml UML 与关系图
tags: [图表, UML, 架构]
---

# Nomnoml UML 与关系图

` ```nomnoml ` 用简洁的文本描述类图、对象图、组件图、用例图与流程图节点，
由 Kroki 的 `nomnoml` 服务渲染为 SVG。语法比 PlantUML 更轻，适合快速画
结构草图、模块关系和教学示例。

基本语法：

```
[类名|字段;方法]
[A] -> [B]
```

- 方括号是节点，`|` 分隔标题、字段、方法。
- `;` 分隔同一栏中的多行。
- `->` / `-` / `<->` 等表示关系。
- `#` 开头是指令（方向、间距、颜色等）。
- 中文标签可以直接使用。

---

## 一、最简单的类图

**源码**：

````markdown
```nomnoml
[Customer] -> [Order]
[Order] -> [LineItem]
```
````

**渲染效果**：

```nomnoml
[Customer] -> [Order]
[Order] -> [LineItem]
```

---

## 二、字段、方法与可见性

`+` 表示 public，`-` 表示 private；字段与方法用 `;` 分隔。

**源码**：

````markdown
```nomnoml
[<class> Customer|+ id: int;+ name: string;+ email: string|+ placeOrder();+ cancel()]
[<class> Order|+ id: int;+ total: decimal;- paid: boolean|+ addItem();+ pay()]
[Customer] -> [Order]
```
````

**渲染效果**：

```nomnoml
[<class> Customer|+ id: int;+ name: string;+ email: string|+ placeOrder();+ cancel()]
[<class> Order|+ id: int;+ total: decimal;- paid: boolean|+ addItem();+ pay()]
[Customer] -> [Order]
```

---

## 三、继承、组合、聚合与依赖

| 写法 | 含义 |
|------|------|
| `[A] <:- [B]` | 继承 / 泛化（B 继承 A） |
| `[A] --:> [B]` | 接口实现（虚线） |
| `[A] +-> [B]` | 组合 |
| `[A] o-> [B]` | 聚合 |
| `[A] --> [B]` | 依赖（虚线箭头） |
| `[A] -> [B]` | 关联 |
| `[A] -/- [B]` | 隐藏连线（仅布局） |
| `[A] -- [<note> 说明]` | 注释 |

**源码**：

````markdown
```nomnoml
[<abstract> Payment|+ amount: decimal|+ pay()]
[<class> CardPayment]
[<class> WalletPayment]
[Payment] <:- [CardPayment]
[Payment] <:- [WalletPayment]

[<class> Order|+ id: int]
[<class> LineItem|+ qty: int]
[Order] +-> [LineItem]

[<class> Cart]
[<class> Product]
[Cart] o-> [Product]

[Checkout] --> [Payment]
```
````

**渲染效果**：

```nomnoml
[<abstract> Payment|+ amount: decimal|+ pay()]
[<class> CardPayment]
[<class> WalletPayment]
[Payment] <:- [CardPayment]
[Payment] <:- [WalletPayment]

[<class> Order|+ id: int]
[<class> LineItem|+ qty: int]
[Order] +-> [LineItem]

[<class> Cart]
[<class> Product]
[Cart] o-> [Product]

[Checkout] --> [Payment]
```

---

## 四、包与框架

**源码**：

````markdown
```nomnoml
[<frame> Shop|
  [<package> API|
    [Controller] -> [Service]
  ]
  [<package> Data|
    [Repository] -> [Database]
  ]
  [Service] -> [Repository]
]
```
````

**渲染效果**：

```nomnoml
[<frame> Shop|
  [<package> API|
    [Controller] -> [Service]
  ]
  [<package> Data|
    [Repository] -> [Database]
  ]
  [Service] -> [Repository]
]
```

---

## 五、用例图

**源码**：

````markdown
```nomnoml
[<actor> Customer] -> [<usecase> Browse]
[<actor> Customer] -> [<usecase> Checkout]
[<actor> Admin] -> [<usecase> Manage]
[Browse] -> [<database> Catalog]
[Checkout] -> [<database> Orders]
```
````

**渲染效果**：

```nomnoml
[<actor> Customer] -> [<usecase> Browse]
[<actor> Customer] -> [<usecase> Checkout]
[<actor> Admin] -> [<usecase> Manage]
[Browse] -> [<database> Catalog]
[Checkout] -> [<database> Orders]
```

---

## 六、组件图

`<lollipop>` 是提供的接口，`<socket>` 是需要的接口。

**源码**：

````markdown
```nomnoml
[Web] -> [<lollipop> REST]
[<socket> API] -> [Service]
[Service] -> [<database> DB]
[Service] -> [Cache]
```
````

**渲染效果**：

```nomnoml
[Web] -> [<lollipop> REST]
[<socket> API] -> [Service]
[Service] -> [<database> DB]
[Service] -> [Cache]
```

---

## 七、流程图节点

**源码**：

````markdown
```nomnoml
[<start> Start] -> [<input> Read config]
[Read config] -> [<choice> Valid?]
[Valid?] -> [<state> Running]
[Valid?] -> [<end> Exit with error]
[Running] -> [<end> Done]
```
````

**渲染效果**：

```nomnoml
[<start> Start] -> [<input> Read config]
[Read config] -> [<choice> Valid?]
[Valid?] -> [<state> Running]
[Valid?] -> [<end> Exit with error]
[Running] -> [<end> Done]
```

---

## 八、对象图与实例

**源码**：

````markdown
```nomnoml
[<instance> customer1: Customer|name = Alice;level = gold]
[<instance> order1: Order|id = 1001;total = 128.00]
[<instance> order2: Order|id = 1002;total = 56.50]
[customer1] -> [order1]
[customer1] -> [order2]
```
````

**渲染效果**：

```nomnoml
[<instance> customer1: Customer|name = Alice;level = gold]
[<instance> order1: Order|id = 1001;total = 128.00]
[<instance> order2: Order|id = 1002;total = 56.50]
[customer1] -> [order1]
[customer1] -> [order2]
```

---

## 九、表格与注释

**源码**：

````markdown
```nomnoml
[<table> Users| id | 1 || name | Alice || role | admin]
[<table> Orders| id | 1001 || user_id | 1 || total | 128.00]
[Users] -> [Orders]
[Orders] -- [<note> 订单创建后 24 小时内可取消]
```
````

**渲染效果**：

```nomnoml
[<table> Users| id | 1 || name | Alice || role | admin]
[<table> Orders| id | 1001 || user_id | 1 || total | 128.00]
[Users] -> [Orders]
[Orders] -- [<note> 订单创建后 24 小时内可取消]
```

---

## 十、指令：方向、间距与配色

指令写在节点之前。

**源码**：

````markdown
```nomnoml
#direction: right
#arrowSize: 1.2
#spacing: 55
#fontSize: 13
#edges: rounded
#fill: #eef4ff
#stroke: #345
[Start] -> [Middle] -> [End]
```
````

**渲染效果**：

```nomnoml
#direction: right
#arrowSize: 1.2
#spacing: 55
#fontSize: 13
#edges: rounded
#fill: #eef4ff
#stroke: #345
[Start] -> [Middle] -> [End]
```

---

## 十一、中文标签

Nomnoml 支持中文；字段与方法用 `;` 分隔即可。

**源码**：

````markdown
```nomnoml
[<class> 客户|+ 编号: int;+ 姓名: string;+ 手机号: string|+ 下单();+ 取消()]
[<class> 订单|+ 编号: int;+ 金额: decimal;+ 状态: string|+ 支付();+ 发货()]
[客户] -> [订单]
```
````

**渲染效果**：

```nomnoml
[<class> 客户|+ 编号: int;+ 姓名: string;+ 手机号: string|+ 下单();+ 取消()]
[<class> 订单|+ 编号: int;+ 金额: decimal;+ 状态: string|+ 支付();+ 发货()]
[客户] -> [订单]
```

---

## 十二、完整示例：分层架构

**源码**：

````markdown
```nomnoml
#direction: right
#spacing: 45
#fontSize: 12

[<frame> Web 应用|
  [<package> 接入层|
    [<actor> 浏览器] -> [Gateway]
  ]
  [<package> 服务层|
    [Gateway] -> [Auth]
    [Gateway] -> [OrderService]
    [OrderService] -> [Payment]
  ]
  [<package> 数据层|
    [OrderService] -> [OrderRepo]
    [OrderRepo] -> [<database> PostgreSQL]
  ]
]
```
````

**渲染效果**：

```nomnoml
#direction: right
#spacing: 45
#fontSize: 12

[<frame> Web 应用|
  [<package> 接入层|
    [<actor> 浏览器] -> [Gateway]
  ]
  [<package> 服务层|
    [Gateway] -> [Auth]
    [Gateway] -> [OrderService]
    [OrderService] -> [Payment]
  ]
  [<package> 数据层|
    [OrderService] -> [OrderRepo]
    [OrderRepo] -> [<database> PostgreSQL]
  ]
]
```

---

## 十三、限制与回退

- 由 Kroki 外部渲染；失败时保留源码并提供在线打开链接。
- `#import:` 依赖外部文件，Kroki 环境通常不可用；建议把内容直接写在围栏里。
- 超大图可能触发 Kroki 超时；建议拆分或减少节点。
- 可通过 `iris/config.json` 的 `krokiServers` 指向自建 Kroki。
