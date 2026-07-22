# 代码选项卡使用示例

使用 `::: code-tabs` 语法可以创建多语言代码选项卡，点击顶部标签切换不同语言的代码示例。

---

## 基础用法

源码：

````markdown
::: code-tabs
@tab JavaScript
```js
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet('World'));
```

@tab Python
```python
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
```

@tab Go
```go
package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}

func main() {
    fmt.Println(greet("World"))
}
```
:::
````

渲染效果：

::: code-tabs
@tab JavaScript
```js
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet('World'));
```

@tab Python
```python
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
```

@tab Go
```go
package main

import "fmt"

func greet(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}

func main() {
    fmt.Println(greet("World"))
}
```
:::

点击上方标签可以切换不同语言的代码。

---

## 两语言对比

源码：

````markdown
::: code-tabs
@tab JavaScript
```js
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const sum = numbers.reduce((a, b) => a + b, 0);
```

@tab Rust
```rust
let numbers = vec![1, 2, 3, 4, 5];
let doubled: Vec<i32> = numbers.iter().map(|n| n * 2).collect();
let sum: i32 = numbers.iter().sum();
```
:::
````

渲染效果：

::: code-tabs
@tab JavaScript
```js
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
const sum = numbers.reduce((a, b) => a + b, 0);
```

@tab Rust
```rust
let numbers = vec![1, 2, 3, 4, 5];
let doubled: Vec<i32> = numbers.iter().map(|n| n * 2).collect();
let sum: i32 = numbers.iter().sum();
```
:::

---

## 前端框架对比

源码：

````markdown
::: code-tabs
@tab React
```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

@tab Vue
```vue
<template>
  <div class="counter">
    <p>Count: {{ count }}</p>
    <button @click="count++">
      Increment
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
```

@tab Svelte
```svelte
<script>
  let count = 0;
</script>

<div class="counter">
  <p>Count: {count}</p>
  <button on:click={() => count++}>
    Increment
  </button>
</div>
```

@tab Solid
```jsx
function Counter() {
  const [count, setCount] = createSignal(0);

  return (
    <div className="counter">
      <p>Count: {count()}</p>
      <button onClick={() => setCount(count() + 1)}>
        Increment
      </button>
    </div>
  );
}
```
:::
````

渲染效果：

::: code-tabs
@tab React
```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

@tab Vue
```vue
<template>
  <div class="counter">
    <p>Count: {{ count }}</p>
    <button @click="count++">
      Increment
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
const count = ref(0);
</script>
```

@tab Svelte
```svelte
<script>
  let count = 0;
</script>

<div class="counter">
  <p>Count: {count}</p>
  <button on:click={() => count++}>
    Increment
  </button>
</div>
```

@tab Solid
```jsx
function Counter() {
  const [count, setCount] = createSignal(0);

  return (
    <div className="counter">
      <p>Count: {count()}</p>
      <button onClick={() => setCount(count() + 1)}>
        Increment
      </button>
    </div>
  );
}
```
:::

---

## HTTP 请求示例

源码：

````markdown
::: code-tabs
@tab fetch (浏览器)
```js
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}
```

@tab axios
```js
import axios from 'axios';

async function fetchUser(id) {
  try {
    const response = await axios.get(`/api/users/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}
```

@tab Python (requests)
```python
import requests

def fetch_user(id):
    try:
        response = requests.get(f"/api/users/{id}")
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching user: {e}")
        raise
```

@tab curl
```bash
curl -X GET "https://api.example.com/users/123" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```
:::
````

渲染效果：

::: code-tabs
@tab fetch (浏览器)
```js
async function fetchUser(id) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}
```

@tab axios
```js
import axios from 'axios';

async function fetchUser(id) {
  try {
    const response = await axios.get(`/api/users/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}
```

@tab Python (requests)
```python
import requests

def fetch_user(id):
    try:
        response = requests.get(f"/api/users/{id}")
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching user: {e}")
        raise
```

@tab curl
```bash
curl -X GET "https://api.example.com/users/123" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"
```
:::

---

## 数据库操作

源码：

````markdown
::: code-tabs
@tab SQL
```sql
SELECT u.id, u.name, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC
LIMIT 10;
```

@tab MongoDB
```javascript
db.users.aggregate([
  { $match: { status: "active" } },
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "userId",
      as: "orders"
    }
  },
  { $match: { "orders.5": { $exists: true } } },
  {
    $project: {
      name: 1,
      email: 1,
      orderCount: { $size: "$orders" }
    }
  },
  { $sort: { orderCount: -1 } },
  { $limit: 10 }
]);
```
:::
````

渲染效果：

::: code-tabs
@tab SQL
```sql
SELECT u.id, u.name, u.email, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.status = 'active'
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC
LIMIT 10;
```

@tab MongoDB
```javascript
db.users.aggregate([
  { $match: { status: "active" } },
  {
    $lookup: {
      from: "orders",
      localField: "_id",
      foreignField: "userId",
      as: "orders"
    }
  },
  { $match: { "orders.5": { $exists: true } } },
  {
    $project: {
      name: 1,
      email: 1,
      orderCount: { $size: "$orders" }
    }
  },
  { $sort: { orderCount: -1 } },
  { $limit: 10 }
]);
```
:::

---

## 语法说明

````text
::: code-tabs
@tab 标签名1
```语言
代码内容
```

@tab 标签名2
```语言
代码内容
```
:::
````

### 规则

- 使用 `::: code-tabs` 开始选项卡组，`:::` 结束
- 每个标签页用 `@tab 标签名` 标记
- 标签名后紧跟一个代码块
- 可以包含任意数量的标签页（建议 2-5 个最佳）
- 默认显示第一个标签页
- 代码块语法高亮和复制按钮正常可用
- 代码块内的 `:::` 或 `@tab` 不会被解析为选项卡语法
