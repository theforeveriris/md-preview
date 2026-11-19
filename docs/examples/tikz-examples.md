---
title: TikZ / PGF 图形
tags: [图表, 矢量, 数学]
---

# TikZ / PGF 图形

` ```tikz `（或 ` ```pgf `）围栏写 TikZ 代码，由 Kroki 的 `tikz` 服务渲染为 SVG。
适合几何图、流程图、树、坐标图、3D 示意和论文风格的矢量插图。

两种写法：

1. **只写 `tikzpicture` 内容**：渲染器自动补全 `standalone` 文档。
2. **写完整 LaTeX 文档**：从 `\documentclass` 开始，原样交给 Kroki，适合加载
   `\usetikzlibrary` / `\definecolor` / 自定义样式。

> TikZ 由 Kroki 外部渲染。Kroki 的 LaTeX 环境不含 CJK 宏包，图中的文字请用
> 英文或数学公式；中文可以写在图外的说明文字里。

---

## 一、基础图形

只写绘图命令时，渲染器会自动包一层 `tikzpicture`。

**源码**：

````markdown
```tikz
\draw[thick, fill=blue!10] (0,0) -- (3,0) -- (2,2) -- cycle;
\draw[thick, fill=orange!20] (4,0) rectangle (7,2);
\draw[thick] (5.5,1) circle (1);
\node at (1.6,0.7) {Triangle};
\node at (5.5,0.7) {Rect};
```
````

**渲染效果**：

```tikz
\draw[thick, fill=blue!10] (0,0) -- (3,0) -- (2,2) -- cycle;
\draw[thick, fill=orange!20] (4,0) rectangle (7,2);
\draw[thick] (5.5,1) circle (1);
\node at (1.6,0.7) {Triangle};
\node at (5.5,0.7) {Rect};
```

---

## 二、节点、标签与样式

**源码**：

````markdown
```tikz
\usetikzlibrary{positioning}
\node[draw, rounded corners, fill=green!10, minimum width=3cm] (a) at (0,0) {Input};
\node[draw, rounded corners, fill=blue!10, minimum width=3cm] (b) at (4,0) {Output};
\draw[->, thick] (a) -- node[above] {process} (b);
\node[below=2mm of a] {source};
```
````

**渲染效果**：

```tikz
\usetikzlibrary{positioning}
\node[draw, rounded corners, fill=green!10, minimum width=3cm] (a) at (0,0) {Input};
\node[draw, rounded corners, fill=blue!10, minimum width=3cm] (b) at (4,0) {Output};
\draw[->, thick] (a) -- node[above] {process} (b);
\node[below=2mm of a] {source};
```

> `below=2mm of ...` 需要 `positioning` 库。上面的简写由渲染器自动补全
> `tikzpicture`，没有加载库；下一节展示带库的完整写法。

---

## 三、流程图（positioning + arrows.meta）

**源码**：

````markdown
```tikz
\usetikzlibrary{positioning,arrows.meta,shapes.geometric}
\begin{tikzpicture}[
  node distance=10mm,
  box/.style={draw, rounded corners, fill=blue!8, minimum width=26mm, minimum height=8mm},
  dec/.style={draw, diamond, aspect=2, fill=orange!15, inner sep=1pt},
  arr/.style={-{Latex[length=2mm]}, thick}
]
\node[box] (start) {Start};
\node[dec, below=of start] (check) {OK?};
\node[box, below=of check] (work) {Work};
\node[box, right=of check] (end) {End};
\draw[arr] (start) -- (check);
\draw[arr] (check) -- node[left] {yes} (work);
\draw[arr] (check) -- node[above] {no} (end);
\draw[arr] (work) |- (end);
\end{tikzpicture}
```
````

**渲染效果**：

```tikz
\usetikzlibrary{positioning,arrows.meta,shapes.geometric}
\begin{tikzpicture}[
  node distance=10mm,
  box/.style={draw, rounded corners, fill=blue!8, minimum width=26mm, minimum height=8mm},
  dec/.style={draw, diamond, aspect=2, fill=orange!15, inner sep=1pt},
  arr/.style={-{Latex[length=2mm]}, thick}
]
\node[box] (start) {Start};
\node[dec, below=of start] (check) {OK?};
\node[box, below=of check] (work) {Work};
\node[box, right=of check] (end) {End};
\draw[arr] (start) -- (check);
\draw[arr] (check) -- node[left] {yes} (work);
\draw[arr] (check) -- node[above] {no} (end);
\draw[arr] (work) |- (end);
\end{tikzpicture}
```

---

## 四、树

**源码**：

````markdown
```tikz
\begin{tikzpicture}[
  level 1/.style={sibling distance=32mm},
  level 2/.style={sibling distance=16mm},
  every node/.style={draw, rounded corners, fill=green!8, inner sep=3pt}
]
\node {Root}
  child { node {A}
    child { node {A1} }
    child { node {A2} }
  }
  child { node {B}
    child { node {B1} }
    child { node {B2} }
  };
\end{tikzpicture}
```
````

**渲染效果**：

```tikz
\begin{tikzpicture}[
  level 1/.style={sibling distance=32mm},
  level 2/.style={sibling distance=16mm},
  every node/.style={draw, rounded corners, fill=green!8, inner sep=3pt}
]
\node {Root}
  child { node {A}
    child { node {A1} }
    child { node {A2} }
  }
  child { node {B}
    child { node {B1} }
    child { node {B2} }
  };
\end{tikzpicture}
```

---

## 五、几何：角、弧与辅助线

**源码**：

````markdown
```tikz
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (4,0);
  \coordinate (C) at (1.5,2.5);
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \draw (A) ++(0.8,0) arc (0:55:0.8);
  \node at (1.3,0.35) {$55^\circ$};
  \draw[dashed] (C) -- (1.5,0);
  \node[below] at (2,0) {$c$};
  \node[left] at (1.5,1.25) {$h$};
\end{tikzpicture}
```
````

**渲染效果**：

```tikz
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (4,0);
  \coordinate (C) at (1.5,2.5);
  \draw[thick] (A) -- (B) -- (C) -- cycle;
  \draw (A) ++(0.8,0) arc (0:55:0.8);
  \node at (1.3,0.35) {$55^\circ$};
  \draw[dashed] (C) -- (1.5,0);
  \node[below] at (2,0) {$c$};
  \node[left] at (1.5,1.25) {$h$};
\end{tikzpicture}
```

---

## 六、坐标网格与循环

**源码**：

````markdown
```tikz
\begin{tikzpicture}
  \draw[step=0.5, gray!25, very thin] (0,0) grid (4,3);
  \draw[thick, ->] (0,0) -- (4.4,0) node[right] {$x$};
  \draw[thick, ->] (0,0) -- (0,3.4) node[above] {$y$};
  \foreach \x in {1,2,3} {
    \foreach \y in {1,2} {
      \fill[blue!60] (\x,\y) circle (2pt);
    }
  }
\end{tikzpicture}
```
````

**渲染效果**：

```tikz
\begin{tikzpicture}
  \draw[step=0.5, gray!25, very thin] (0,0) grid (4,3);
  \draw[thick, ->] (0,0) -- (4.4,0) node[right] {$x$};
  \draw[thick, ->] (0,0) -- (0,3.4) node[above] {$y$};
  \foreach \x in {1,2,3} {
    \foreach \y in {1,2} {
      \fill[blue!60] (\x,\y) circle (2pt);
    }
  }
\end{tikzpicture}
```

---

## 七、函数曲线

**源码**：

````markdown
```tikz
\begin{tikzpicture}
  \draw[->] (-0.2,0) -- (6.5,0) node[right] {$x$};
  \draw[->] (0,-1.4) -- (0,1.6) node[above] {$y$};
  \draw[domain=0:6.2, samples=100, thick, blue] plot (\x, {sin(\x r)});
  \draw[dashed, gray] (0,1) -- (6.2,1);
  \node[below] at (3.14,0) {$\pi$};
\end{tikzpicture}
```
````

**渲染效果**：

```tikz
\begin{tikzpicture}
  \draw[->] (-0.2,0) -- (6.5,0) node[right] {$x$};
  \draw[->] (0,-1.4) -- (0,1.6) node[above] {$y$};
  \draw[domain=0:6.2, samples=100, thick, blue] plot (\x, {sin(\x r)});
  \draw[dashed, gray] (0,1) -- (6.2,1);
  \node[below] at (3.14,0) {$\pi$};
\end{tikzpicture}
```

---

## 八、三维坐标示意

**源码**：

````markdown
```tikz
\begin{tikzpicture}[x={(1cm,0.3cm)}, y={(0cm,1cm)}, z={(-0.5cm,-0.3cm)}]
  \draw[->] (0,0,0) -- (3,0,0) node[right] {$x$};
  \draw[->] (0,0,0) -- (0,3,0) node[above] {$y$};
  \draw[->] (0,0,0) -- (0,0,3) node[below left] {$z$};
  \draw[thick, blue] (0,0,0) -- (2,2,1) -- (2,0,1) -- cycle;
\end{tikzpicture}
```
````

**渲染效果**：

```tikz
\begin{tikzpicture}[x={(1cm,0.3cm)}, y={(0cm,1cm)}, z={(-0.5cm,-0.3cm)}]
  \draw[->] (0,0,0) -- (3,0,0) node[right] {$x$};
  \draw[->] (0,0,0) -- (0,3,0) node[above] {$y$};
  \draw[->] (0,0,0) -- (0,0,3) node[below left] {$z$};
  \draw[thick, blue] (0,0,0) -- (2,2,1) -- (2,0,1) -- cycle;
\end{tikzpicture}
```

---

## 九、自定义样式与颜色

`\tikzset` / `\definecolor` 会自动放进导言区。

**源码**：

````markdown
```tikz
\definecolor{brand}{HTML}{3B6FD4}
\tikzset{
  card/.style={draw=brand, fill=brand!8, rounded corners, minimum width=34mm, minimum height=10mm},
  link/.style={->, thick, draw=brand}
}
\begin{tikzpicture}
  \node[card] (a) at (0,0) {Draft};
  \node[card] (b) at (0,-1.6) {Review};
  \node[card] (c) at (0,-3.2) {Publish};
  \draw[link] (a) -- (b);
  \draw[link] (b) -- (c);
\end{tikzpicture}
```
````

**渲染效果**：

```tikz
\definecolor{brand}{HTML}{3B6FD4}
\tikzset{
  card/.style={draw=brand, fill=brand!8, rounded corners, minimum width=34mm, minimum height=10mm},
  link/.style={->, thick, draw=brand}
}
\begin{tikzpicture}
  \node[card] (a) at (0,0) {Draft};
  \node[card] (b) at (0,-1.6) {Review};
  \node[card] (c) at (0,-3.2) {Publish};
  \draw[link] (a) -- (b);
  \draw[link] (b) -- (c);
\end{tikzpicture}
```

---

## 十、完整 LaTeX 文档

需要更多库或自定义导言区时，直接写完整文档：

````markdown
```tikz
\documentclass[tikz,border=5pt]{standalone}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows.meta}
\begin{document}
\begin{tikzpicture}[box/.style={draw, fill=blue!10, rounded corners, minimum width=4cm}]
\node[box] (a) {Full document};
\node[box, below=of a] (b) {With libraries};
\draw[-{Latex}] (a) -- (b);
\end{tikzpicture}
\end{document}
```
````

**渲染效果**：

```tikz
\documentclass[tikz,border=5pt]{standalone}
\usepackage{tikz}
\usetikzlibrary{positioning,arrows.meta}
\begin{document}
\begin{tikzpicture}[box/.style={draw, fill=blue!10, rounded corners, minimum width=4cm}]
\node[box] (a) {Full document};
\node[box, below=of a] (b) {With libraries};
\draw[-{Latex}] (a) -- (b);
\end{tikzpicture}
\end{document}
```

---

## 十一、`pgf` 别名

` ```pgf ` 与 ` ```tikz ` 等价，适合按 PGF 命名习惯书写：

````markdown
```pgf
\draw[very thick, ->] (0,0) -- (3,1);
\fill[red] (3,1) circle (3pt);
\node[right] at (3,1) {PGF};
```
````

**渲染效果**：

```pgf
\draw[very thick, ->] (0,0) -- (3,1);
\fill[red] (3,1) circle (3pt);
\node[right] at (3,1) {PGF};
```

---

## 十二、限制与回退

- Kroki 的 TikZ 服务不包含 `ctex` / `xeCJK`，**中文标签会编译失败**；请用英文或
  数学公式。中文说明写在图外。
- 复杂图形可能触发 Kroki 超时；建议拆分或减少 `samples` / 循环次数。
- 渲染失败时会保留源码，并提供在线打开链接（由 `kroki-client` 处理）。
- 可以配置 `iris/config.json` 的 `krokiServers` 指向自建 Kroki，以支持更多
  LaTeX 宏包或离线环境。
