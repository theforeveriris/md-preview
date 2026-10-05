---
title: LaTeX 公式示例
tags: [数学]
---

# LaTeX 公式示例

本文档展示了 KaTeX 支持的各类数学公式及其渲染效果。

---

## 1. 行内公式

行内公式使用单个 \$ 包裹，例如：

- 勾股定理：$a^2 + b^2 = c^2$
- 欧拉公式：$e^{i\pi} + 1 = 0$
- 二次方程根：$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$
- 积分：$\int_{a}^{b} f(x) dx$
- 求和：$\sum_{n=1}^{\infty} \frac{1}{n^2}$

---

## 2. 块级公式

块级公式使用双 \$\$ 包裹，居中显示：

### 2.1 基础公式

**勾股定理：**

$$
a^2 + b^2 = c^2
$$

**欧拉公式：**

$$
e^{i\pi} + 1 = 0
$$

**二次方程求根公式：**

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

### 2.2 微积分

**定积分：**

$$
\int_{a}^{b} f(x) dx = F(b) - F(a)
$$

**不定积分：**

$$
\int x^n dx = \frac{x^{n+1}}{n+1} + C
$$

**导数：**

$$
\frac{d}{dx} f(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}
$$

**偏导数：**

$$
\frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} = 0
$$

### 2.3 求和与乘积

**求和公式：**

$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}
$$

**乘积公式：**

$$
\prod_{k=1}^{n} k = n!
$$

### 2.4 极限

**基本极限：**

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1
$$

**重要极限：**

$$
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
$$

---

## 3. 矩阵

### 3.1 基础矩阵

$$
\begin{matrix}
a & b \\
c & d
\end{matrix}
$$

### 3.2 带括号的矩阵

$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
$$

$$
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$

$$
\begin{vmatrix}
a & b \\
c & d
\end{vmatrix}
$$

$$
\begin{Vmatrix}
a & b \\
c & d
\end{Vmatrix}
$$

### 3.3 大型矩阵

$$
\begin{pmatrix}
1 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & 1
\end{pmatrix}
$$

### 3.4 矩阵运算

矩阵乘法：

$$
\begin{pmatrix}
a_{11} & a_{12} \\
a_{21} & a_{22}
\end{pmatrix}
\begin{pmatrix}
b_{11} & b_{12} \\
b_{21} & b_{22}
\end{pmatrix}
=
\begin{pmatrix}
a_{11}b_{11}+a_{12}b_{21} & a_{11}b_{12}+a_{12}b_{22} \\
a_{21}b_{11}+a_{22}b_{21} & a_{21}b_{12}+a_{22}b_{22}
\end{pmatrix}
$$

---

## 4. 方程组与等式

### 4.1 线性方程组

$$
\begin{cases}
a_{11}x_1 + a_{12}x_2 + \cdots + a_{1n}x_n = b_1 \\
a_{21}x_1 + a_{22}x_2 + \cdots + a_{2n}x_n = b_2 \\
\cdots \\
a_{m1}x_1 + a_{m2}x_2 + \cdots + a_{mn}x_n = b_m
\end{cases}
$$

### 4.2 对齐的等式

$$
\begin{align*}
f(x) &= (x + 1)^2 \\
&= x^2 + 2x + 1
\end{align*}
$$

---

## 5. 希腊字母

### 5.1 小写希腊字母

$\alpha, \beta, \gamma, \delta, \epsilon, \zeta $
$\eta, \theta, \iota, \kappa, \lambda, \mu, \nu $
$\xi, \pi, \rho, \sigma, \tau, \upsilon, \phi, \chi $
$\psi, \omega$

### 5.2 大写希腊字母

$\Gamma, \Delta, \Theta, \Lambda, \Xi, \Pi, \Sigma, \Phi, \Psi, \Omega$

---

## 6. 函数与运算符

### 6.1 常用函数

三角函数：

$$
\sin^2 x + \cos^2 x = 1
$$

$$
\tan x = \frac{\sin x}{\cos x}
$$

对数函数：

$$
\log_a b = \frac{\ln b}{\ln a}
$$

指数函数：

$$
e^x = \sum_{n=0}^{\infty} \frac{x^n}{n!}
$$

### 6.2 运算符

模运算：

$$
a \equiv b \pmod{n}
$$

极限运算：

$$
\limsup_{n \to \infty} a_n \geq \liminf_{n \to \infty} a_n
$$

---

## 7. 统计与概率

### 7.1 概率

$$
P(A|B) = \frac{P(B|A)P(A)}{P(B)}
$$

### 7.2 期望与方差

期望：

$$
E[X] = \sum_{i=1}^{n} x_i p_i
$$

方差：

$$
Var(X) = E[X^2] - (E[X])^2
$$

### 7.3 正态分布

$$
f(x) = \frac{1}{\sigma \sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}
$$

---

## 8. 物理公式

### 8.1 力学

牛顿第二定律：

$F = ma$

万有引力定律：

$F = G \frac{m_1 m_2}{r^2}$

### 8.2 电磁学

麦克斯韦方程组：

$$
\begin{cases}
\nabla \cdot \mathbf{E} = \frac{\rho}{\epsilon_0} \\
\nabla \cdot \mathbf{B} = 0 \\
\nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t} \\
\nabla \times \mathbf{B} = \mu_0 \left(\mathbf{J} + \epsilon_0 \frac{\partial \mathbf{E}}{\partial t}\right)
\end{cases}
$$

### 8.3 量子力学

薛定谔方程：

$$
i\hbar \frac{\partial}{\partial t} \Psi(\mathbf{r}, t) = \hat{H} \Psi(\mathbf{r}, t)
$$

---

## 9. 化学公式

### 9.1 化学方程式

$$
2H_2 + O_2 \rightarrow 2H_2O
$$

$$
NaCl \rightarrow Na^+ + Cl^-
$$

### 9.2 有机化学

苯的结构：

$$
\text{C}_6\text{H}_6
$$

---

## 10. 高级数学

### 10.1 傅里叶变换

$$
\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x) e^{-2\pi i x \xi} dx
$$

### 10.2 拉普拉斯变换

$$
\mathcal{L}\{f(t)\}(s) = \int_{0}^{\infty} f(t) e^{-st} dt
$$

### 10.3 张量分析

爱因斯坦求和约定：

$$
g_{\mu\nu} dx^\mu dx^\nu
$$

### 10.4 微分几何

$$
ds^2 = g_{ij} dx^i dx^j
$$

---

## 11. 表格与数组

### 11.1 简单表格

$$
\begin{array}{|c|c|c|}
\hline
n & n^2 & n^3 \\
\hline
1 & 1 & 1 \\
2 & 4 & 8 \\
3 & 9 & 27 \\
4 & 16 & 64 \\
\hline
\end{array}
$$

---

## 12. 特殊符号

### 12.1 箭头

$\leftarrow, \rightarrow, \leftrightarrow, \Leftarrow, \Rightarrow, \Leftrightarrow, \uparrow, \downarrow, \updownarrow$

### 12.2 关系符号

$\leq, \geq, \neq, \equiv, \approx, \sim, \simeq, \cong, \propto$

### 12.3 集合符号

$\in, \notin, \subset, \supset, \subseteq, \supseteq, \cup, \cap, \emptyset, \mathbb{N}, \mathbb{Z}, \mathbb{Q}, \mathbb{R}, \mathbb{C}$

---

## 总结

KaTeX 支持丰富的 LaTeX 数学公式语法，包括：

1. **行内公式** - 使用单个 \$ 包裹
2. **块级公式** - 使用双 \$\$ 包裹
3. **微积分** - 积分、导数、极限
4. **矩阵** - 各种矩阵表示
5. **方程组** - 对齐、分组
6. **希腊字母** - 大小写
7. **函数与运算符** - 常用数学函数
8. **统计概率** - 分布、期望、方差
9. **物理化学公式** - 专业领域公式
10. **高级数学** - 傅里叶变换、张量等

更多详细信息请参考 [KaTeX 官方文档](https://katex.org/)。
