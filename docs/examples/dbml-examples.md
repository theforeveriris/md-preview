---
title: DBML 与 ER 图
tags: [数据库, 图表, DBML]
---

# DBML 与 ER 图

` ```dbml ` 围栏会把 DBML 表定义渲染成实体关系图：表 → 实体，列 → 属性，
`[pk]` → 主键标记，`Ref` / 内联 `[ref: ...]` → 关系连线。渲染走站内
Mermaid ER，跟随主题配色；解析不出表时保留源码。

支持的写法：

- `Table name { ... }`，可带 `as 别名`、schema 前缀或引号标识符
- 列设置：`pk` / `primary key`、`unique`、`not null`、`note`、`default`、`ref`
- 关系：独立 `Ref: A.x > B.y` / `Ref 名称: ...`，或列上的 `[ref: > B.y]`
- 基数：`>` 多对一、`<` 一对多、`-` 一对一、`<>` 多对多
- `Enum` / `TableGroup` / `Project` / `indexes` 解析时忽略，不影响出图

## 基础：两张表的内联外键

**源码**：

````markdown
```dbml
Table users {
  id int [pk]
  name varchar
  email varchar [unique]
}

Table posts {
  id int [pk]
  user_id int [ref: > users.id]
  title varchar
  body text
}
```
````

**渲染效果**：

```dbml
Table users {
  id int [pk]
  name varchar
  email varchar [unique]
}

Table posts {
  id int [pk]
  user_id int [ref: > users.id]
  title varchar
  body text
}
```

## 表别名与独立 Ref

**源码**：

````markdown
```dbml
Table users as U {
  id int [pk]
  display_name varchar
}

Table orders {
  id int [pk]
  buyer_id int
  total decimal(10,2)
}

Ref: orders.buyer_id > U.id
```
````

**渲染效果**：

```dbml
Table users as U {
  id int [pk]
  display_name varchar
}

Table orders {
  id int [pk]
  buyer_id int
  total decimal(10,2)
}

Ref: orders.buyer_id > U.id
```

## 一对一关系

**源码**：

````markdown
```dbml
Table users {
  id int [pk]
  name varchar
}

Table profiles {
  id int [pk]
  user_id int
  bio text
  avatar_url varchar
}

Ref: profiles.user_id - users.id
```
````

**渲染效果**：

```dbml
Table users {
  id int [pk]
  name varchar
}

Table profiles {
  id int [pk]
  user_id int
  bio text
  avatar_url varchar
}

Ref: profiles.user_id - users.id
```

## 多对多关系

**源码**：

````markdown
```dbml
Table authors {
  id int [pk]
  name varchar
}

Table books {
  id int [pk]
  title varchar
}

Ref: authors.id <> books.id
```
````

**渲染效果**：

```dbml
Table authors {
  id int [pk]
  name varchar
}

Table books {
  id int [pk]
  title varchar
}

Ref: authors.id <> books.id
```

## 关联表（显式中间表）

**源码**：

````markdown
```dbml
Table students {
  id int [pk]
  name varchar
}

Table courses {
  id int [pk]
  title varchar
}

Table enrollments {
  student_id int [ref: > students.id]
  course_id int [ref: > courses.id]
  score decimal(5,2)

  indexes {
    (student_id, course_id) [pk]
  }
}
```
````

**渲染效果**：

```dbml
Table students {
  id int [pk]
  name varchar
}

Table courses {
  id int [pk]
  title varchar
}

Table enrollments {
  student_id int [ref: > students.id]
  course_id int [ref: > courses.id]
  score decimal(5,2)

  indexes {
    (student_id, course_id) [pk]
  }
}
```

## 自引用：员工与上级

**源码**：

````markdown
```dbml
Table employees {
  id int [pk]
  name varchar
  manager_id int [ref: > employees.id]
  department varchar
}
```
````

**渲染效果**：

```dbml
Table employees {
  id int [pk]
  name varchar
  manager_id int [ref: > employees.id]
  department varchar
}
```

## 复合主键

**源码**：

````markdown
```dbml
Table order_items {
  order_id int [pk]
  product_id int [pk]
  quantity int [not null]
  unit_price decimal(10,2)
}

Table orders {
  id int [pk]
  created_at timestamp
}

Table products {
  id int [pk]
  name varchar
}

Ref: order_items.order_id > orders.id
Ref: order_items.product_id > products.id
```
````

**渲染效果**：

```dbml
Table order_items {
  order_id int [pk]
  product_id int [pk]
  quantity int [not null]
  unit_price decimal(10,2)
}

Table orders {
  id int [pk]
  created_at timestamp
}

Table products {
  id int [pk]
  name varchar
}

Ref: order_items.order_id > orders.id
Ref: order_items.product_id > products.id
```

## 枚举、备注与索引

**源码**：

````markdown
```dbml
Enum order_status {
  pending
  paid
  shipped
  cancelled
}

Table orders {
  id int [pk, increment]
  status order_status [not null, default: 'pending']
  note text [note: '客户备注，展示在发货单上']
  placed_at timestamp

  indexes {
    placed_at
    (status, placed_at) [name: 'idx_status_time']
  }
}
```
````

**渲染效果**：

```dbml
Enum order_status {
  pending
  paid
  shipped
  cancelled
}

Table orders {
  id int [pk, increment]
  status order_status [not null, default: 'pending']
  note text [note: '客户备注，展示在发货单上']
  placed_at timestamp

  indexes {
    placed_at
    (status, placed_at) [name: 'idx_status_time']
  }
}
```

## 带 schema 与引号标识符

**源码**：

````markdown
```dbml
Table "sales"."order items" {
  "item id" int [pk]
  "order id" int
  qty int
}

Table sales.orders {
  id int [pk]
  buyer varchar
}

Ref: "sales"."order items"."order id" > sales.orders.id
```
````

**渲染效果**：

```dbml
Table "sales"."order items" {
  "item id" int [pk]
  "order id" int
  qty int
}

Table sales.orders {
  id int [pk]
  buyer varchar
}

Ref: "sales"."order items"."order id" > sales.orders.id
```

## 完整电商模型

**源码**：

````markdown
```dbml
Table users {
  id int [pk, increment]
  email varchar [unique, not null]
  name varchar
  created_at timestamp
}

Table addresses {
  id int [pk]
  user_id int [ref: > users.id]
  city varchar
  street varchar
  is_default boolean
}

Table products {
  id int [pk]
  sku varchar [unique]
  name varchar
  price decimal(10,2)
  stock int
}

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
  address_id int [ref: > addresses.id]
  status order_status
  total decimal(12,2)
  created_at timestamp
}

Table order_items {
  order_id int [pk]
  product_id int [pk]
  quantity int
  unit_price decimal(10,2)
}

Table payments {
  id int [pk]
  order_id int [ref: > orders.id]
  method varchar
  paid_at timestamp
}

Enum order_status {
  pending
  paid
  shipped
  done
}

Ref: order_items.order_id > orders.id
Ref: order_items.product_id > products.id
```
````

**渲染效果**：

```dbml
Table users {
  id int [pk, increment]
  email varchar [unique, not null]
  name varchar
  created_at timestamp
}

Table addresses {
  id int [pk]
  user_id int [ref: > users.id]
  city varchar
  street varchar
  is_default boolean
}

Table products {
  id int [pk]
  sku varchar [unique]
  name varchar
  price decimal(10,2)
  stock int
}

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
  address_id int [ref: > addresses.id]
  status order_status
  total decimal(12,2)
  created_at timestamp
}

Table order_items {
  order_id int [pk]
  product_id int [pk]
  quantity int
  unit_price decimal(10,2)
}

Table payments {
  id int [pk]
  order_id int [ref: > orders.id]
  method varchar
  paid_at timestamp
}

Enum order_status {
  pending
  paid
  shipped
  done
}

Ref: order_items.order_id > orders.id
Ref: order_items.product_id > products.id
```

## 兼容：SQL DDL

旧的 ` ```sql ddl `（以及 ` ```ddl ` / ` ```erd `）写法仍然可用：

**源码**：

````markdown
```sql ddl
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT,
  total DECIMAL(10,2),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```
````

**渲染效果**：

```sql ddl
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(50) NOT NULL
);

CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT,
  total DECIMAL(10,2),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```
