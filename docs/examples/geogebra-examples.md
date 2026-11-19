---
title: GeoGebra 交互图
tags: [图表, 数学, 交互]
---

# GeoGebra 交互图

GeoGebra 是数学与几何的动态交互工具。本站提供两种用法：

1. **嵌入公开材料**：把 GeoGebra 上已有的 applet / 活动嵌进文档。
2. **用命令画图**：在 ` ```geogebra ` 围栏里写 GeoGebra 命令，由站点创建 applet。

> GeoGebra 采用 **Non-Commercial License**。本站按非商业用途集成；如果用于
> 商业项目，需要先取得 GeoGebra 的授权。交互图由 `geogebra.org` 提供，
> 默认点击「加载交互图」后才请求外部脚本与图形，不会在打开文档时自动加载。

---

## 一、嵌入公开材料

````markdown
```embed
@[geogebra](https://www.geogebra.org/m/nv9vex3X)
```
````

也可以只写材料 ID：

````markdown
```embed
@[geogebra](nv9vex3X)
```
````

**渲染效果**：

```embed
@[geogebra](nv9vex3X)
```

### 三维曲面

```embed
@[geogebra](h9xS5ZZs)
```

> 材料嵌入使用 GeoGebra 官方推荐的 div 方式（`deployggb.js` + `material_id`），
> 不是旧的 `material/iframe` 地址；iOS 上也能正常显示。

---

## 二、命令围栏

````markdown
```geogebra
app: graphing
height: 420
auto: true
commands:
  - f(x) = sin(x)
  - (1, sin(1))
  - g(x) = f'(x)
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
auto: true
commands:
  - f(x) = sin(x)
  - (1, sin(1))
  - g(x) = f'(x)
```

没有 YAML 头时，每一行都按命令处理：

````markdown
```geogebra
f(x) = x^2
(1, f(1))
Tangent(1, f)
```
````

**渲染效果**：

```geogebra
f(x) = x^2
(1, f(1))
Tangent(1, f)
```

---

## 三、配置项

| 键 | 默认 | 说明 |
|----|------|------|
| `app` | `graphing` | `graphing` / `geometry` / `classic` / `3d` / `spreadsheet` / `probability` / `cas` |
| `width` | 容器宽度 | applet 宽度（320–1600），不写则自适应卡片宽度 |
| `height` | `420` | 高度（240–900） |
| `showMenuBar` | `false` | 顶部菜单栏 |
| `showAlgebraInput` | `false` | 左侧代数输入栏 |
| `showToolBar` | `false` | 工具栏 |
| `showResetIcon` | `true` | 右上角重置按钮 |
| `showFullscreenButton` | `true` | 全屏按钮 |
| `language` | `zh` | 界面语言 |
| `auto` | `false` | `true` 时进入视口后自动加载；默认点击加载 |
| `title` | 自动 | 卡片标题 |
| `base64` | — | 直接载入 `ggbBase64` 内容（可选） |
| `commands` | — | 命令列表；用 `-` 开头 |

---

## 四、函数与导数

### 三角函数与切线

````markdown
```geogebra
app: graphing
height: 420
commands:
  - f(x) = sin(x)
  - T = Tangent(1, f)
  - SetColor(f, "#6a8fd4")
  - SetColor(T, "#d46a9f")
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - f(x) = sin(x)
  - T = Tangent(1, f)
  - SetColor(f, "#6a8fd4")
  - SetColor(T, "#d46a9f")
```

### 导数函数

````markdown
```geogebra
app: graphing
height: 420
commands:
  - f(x) = x^3 - 3x
  - g(x) = f'(x)
  - SetColor(g, "#d46a9f")
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - f(x) = x^3 - 3x
  - g(x) = f'(x)
  - SetColor(g, "#d46a9f")
```

---

## 五、几何作图

### 点、线段、圆、中点

````markdown
```geogebra
app: geometry
height: 420
commands:
  - A = (0, 0)
  - B = (4, 0)
  - C = (1, 3)
  - Segment(A, B)
  - Segment(B, C)
  - Segment(C, A)
  - M = Midpoint(A, B)
  - Circle(M, 1.2)
```
````

**渲染效果**：

```geogebra
app: geometry
height: 420
commands:
  - A = (0, 0)
  - B = (4, 0)
  - C = (1, 3)
  - Segment(A, B)
  - Segment(B, C)
  - Segment(C, A)
  - M = Midpoint(A, B)
  - Circle(M, 1.2)
```

### 垂线与交点

````markdown
```geogebra
app: geometry
height: 420
commands:
  - f(x) = 0.5x + 1
  - A = (2, 0)
  - g = PerpendicularLine(A, f)
  - B = Intersect(f, g)
  - Segment(A, B)
```
````

**渲染效果**：

```geogebra
app: geometry
height: 420
commands:
  - f(x) = 0.5x + 1
  - A = (2, 0)
  - g = PerpendicularLine(A, f)
  - B = Intersect(f, g)
  - Segment(A, B)
```

---

## 六、滑杆与动态参数

````markdown
```geogebra
app: graphing
height: 440
commands:
  - a = Slider(-3, 3, 0.1)
  - f(x) = a x^2
  - SetColor(f, "#6a8fd4")
  - (0, 0)
```
````

**渲染效果**：

```geogebra
app: graphing
height: 440
commands:
  - a = Slider(-3, 3, 0.1)
  - f(x) = a x^2
  - SetColor(f, "#6a8fd4")
  - (0, 0)
```

---

## 七、不等式与区域

````markdown
```geogebra
app: graphing
height: 420
commands:
  - y > x^2 - 2
  - y < 2x + 1
  - f(x) = x^2 - 2
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - y > x^2 - 2
  - y < 2x + 1
  - f(x) = x^2 - 2
```

---

## 八、参数方程与极坐标

### 参数曲线

````markdown
```geogebra
app: graphing
height: 420
commands:
  - Curve(cos(t), sin(t), t, 0, 2pi)
  - Curve(2cos(t), sin(t), t, 0, 2pi)
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - Curve(cos(t), sin(t), t, 0, 2pi)
  - Curve(2cos(t), sin(t), t, 0, 2pi)
```

### 极坐标心形线

````markdown
```geogebra
app: graphing
height: 420
commands:
  - Curve((1 + cos(t)) cos(t), (1 + cos(t)) sin(t), t, 0, 2pi)
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - Curve((1 + cos(t)) cos(t), (1 + cos(t)) sin(t), t, 0, 2pi)
```

---

## 九、序列与散点

### 序列

````markdown
```geogebra
app: graphing
height: 420
commands:
  - Sequence((k, k^2), k, 1, 12)
  - f(x) = x^2
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - Sequence((k, k^2), k, 1, 12)
  - f(x) = x^2
```

### 散点与拟合线

````markdown
```geogebra
app: graphing
height: 420
commands:
  - data = {(1, 2), (2, 3), (3, 5), (4, 4), (5, 6)}
  - fit = FitLine(data)
  - SetColor(fit, "#d46a9f")
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - data = {(1, 2), (2, 3), (3, 5), (4, 4), (5, 6)}
  - fit = FitLine(data)
  - SetColor(fit, "#d46a9f")
```

---

## 十、三维曲面

````markdown
```geogebra
app: 3d
height: 460
commands:
  - f(x, y) = sin(x) * cos(y)
  - SetColor(f, "#6a8fd4")
```
````

**渲染效果**：

```geogebra
app: 3d
height: 460
commands:
  - f(x, y) = sin(x) * cos(y)
  - SetColor(f, "#6a8fd4")
```

---

## 十一、样式与文字

````markdown
```geogebra
app: graphing
height: 420
commands:
  - f(x) = sin(x)
  - SetColor(f, "#d46a9f")
  - SetLineThickness(f, 5)
  - T = Text("y = sin(x)", (1, 1.3))
  - SetColor(T, "#6a8fd4")
```
````

**渲染效果**：

```geogebra
app: graphing
height: 420
commands:
  - f(x) = sin(x)
  - SetColor(f, "#d46a9f")
  - SetLineThickness(f, 5)
  - T = Text("y = sin(x)", (1, 1.3))
  - SetColor(T, "#6a8fd4")
```

---

## 十二、失败回退

GeoGebra 脚本来自 `geogebra.org`。如果网络被拦截、脚本加载失败，或命令执行
失败，卡片会保留源码并给出提示：

- 脚本失败：显示“GeoGebra 加载失败，已回退源码”和打开链接；
- 某条命令失败：图仍会显示，卡片底部列出未执行的命令；
- 非法材料 ID：直接提示无法识别。

可以用 `iris/config.json` 的 `geogebraScript` 指向自建/镜像的
`deployggb.js`：

```json
{
  "geogebraScript": "https://your-mirror.example.com/deployggb.js"
}
```

> 自建 GeoGebra Apps 需要遵守其非商业许可；商用请先取得授权。

---

## 十三、已知限制

- GeoGebra 是外部服务，完全离线时无法加载交互图。
- 每个 applet 会独立初始化；文档里默认点击加载，避免一次拉起多个实例。
- 3D / CAS 等 app 体积较大，移动端加载会慢一些。
- 命令执行失败不会中断整个 applet，但失败命令会在卡片底部列出。
