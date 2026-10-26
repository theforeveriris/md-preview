---
title: 浏览器原生 HTML 元素与 Web API 示例
tags: [排版]
---

# 浏览器原生 HTML 元素与 Web API 示例

本页面展示丰富的浏览器原生功能，零 JS、零后端即可使用！

---

## 一、语义与排版

### 1.1 原生模态对话框

```html
<dialog id="dialogDemo">
  <h3>欢迎！</h3>
  <p>这是一个纯 HTML 原生模态对话框。</p>
  <button onclick="document.getElementById('dialogDemo').close()">关闭</button>
</dialog>
<button onclick="document.getElementById('dialogDemo').showModal()">打开对话框</button>
```

<dialog id="dialogDemo">
  <h3>欢迎！</h3>
  <p>这是一个纯 HTML 原生模态对话框。</p>
  <button onclick="document.getElementById('dialogDemo').close()">关闭</button>
</dialog>
<button onclick="document.getElementById('dialogDemo').showModal()">打开对话框</button>

---

### 1.2 折叠面板

```html
<details>
  <summary>点击展开/收起</summary>
  <p>这是一个可嵌套的折叠面板内容。</p>
  <details>
    <summary>再展开一层</summary>
    <p>多层嵌套也支持！</p>
  </details>
</details>
```

<details>
  <summary>点击展开/收起</summary>
  <p>这是一个可嵌套的折叠面板内容。</p>
  <details>
    <summary>再展开一层</summary>
    <p>多层嵌套也支持！</p>
  </details>
</details>

---

### 1.3 中文注音

```html
<ruby>
  中 <rp>(</rp><rt>zhōng</rt><rp>)</rp>
  文 <rp>(</rp><rt>wén</rt><rp>)</rp>
</ruby>
```

<ruby>
  中 <rp>(</rp><rt>zhōng</rt><rp>)</rp>
  文 <rp>(</rp><rt>wén</rt><rp>)</rp>
</ruby>

---

### 1.4 文本高亮

```html
<mark>这是文本高亮</mark>，像荧光笔一样！
```

<mark>这是文本高亮</mark>，像荧光笔一样！

---

### 1.5 键盘按键

```html
按 <kbd>Ctrl</kbd> + <kbd>C</kbd> 复制
```

按 <kbd>Ctrl</kbd> + <kbd>C</kbd> 复制

---

### 1.6 下标上标

```html
H<sub>2</sub>O - 水的化学式
x<sup>2</sup> + y<sup>2</sup> = z<sup>2</sup>
```

H<sub>2</sub>O - 水的化学式<br>
x<sup>2</sup> + y<sup>2</sup> = z<sup>2</sup>

---

### 1.7 缩写说明

```html
<abbr title="HyperText Markup Language">HTML</abbr> 是网页的基础
```

<abbr title="HyperText Markup Language">HTML</abbr> 是网页的基础

---

### 1.8 时间标记

```html
发布于 <time datetime="2024-05-20">2024年5月20日</time>
```

发布于 <time datetime="2024-05-20">2024年5月20日</time>

---

### 1.9 增删标记

```html
删除内容：<del>旧功能</del>
新增内容：<ins>新功能</ins>
```

删除内容：<del>旧功能</del><br>
新增内容：<ins>新功能</ins>

---

### 1.10 图文组合

```html
<figure>
  <canvas id="demoCanvas" width="200" height="100" style="background:#f0f0f0; border-radius:8px;"></canvas>
  <figcaption>示例图表 - 一个简单的画布</figcaption>
</figure>
```

<figure>
  <canvas id="demoCanvas" width="200" height="100" style="background:#f0f0f0; border-radius:8px;"></canvas>
  <figcaption>示例图表 - 一个简单的画布</figcaption>
</figure>

<script>
  // 简单的 canvas 绘制
  const canvas = document.getElementById('demoCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8B5CF6';
    ctx.fillRect(10, 10, 50, 80);
    ctx.fillStyle = '#D946EF';
    ctx.fillRect(70, 20, 50, 70);
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(130, 40, 50, 50);
  }
</script>

---

## 二、多媒体与嵌入

### 2.1 内联 SVG

```html
<svg width="200" height="100" viewBox="0 0 200 100">
  <rect x="10" y="10" width="80" height="60" fill="#8B5CF6" rx="8"/>
  <circle cx="150" cy="40" r="30" fill="#D946EF"/>
  <text x="100" y="85" text-anchor="middle" fill="#333" font-size="14">内联 SVG 示例</text>
</svg>
```

<svg width="200" height="100" viewBox="0 0 200 100">
  <rect x="10" y="10" width="80" height="60" fill="#8B5CF6" rx="8"/>
  <circle cx="150" cy="40" r="30" fill="#D946EF"/>
  <text x="100" y="85" text-anchor="middle" fill="#333" font-size="14">内联 SVG 示例</text>
</svg>

---

### 2.2 Canvas 2D 绘制

```html
<canvas id="animatedCanvas" width="200" height="100" style="background:#f8fafc; border-radius:8px;"></canvas>
```

<canvas id="animatedCanvas" width="200" height="100" style="background:#f8fafc; border-radius:8px;"></canvas>

<script>
  const animCanvas = document.getElementById('animatedCanvas');
  if (animCanvas) {
    const ctx = animCanvas.getContext('2d');
    let angle = 0;
    function draw() {
      ctx.clearRect(0, 0, 200, 100);
      ctx.save();
      ctx.translate(100, 50);
      ctx.rotate(angle);
      ctx.fillStyle = '#8B5CF6';
      ctx.fillRect(-20, -20, 40, 40);
      ctx.restore();
      angle += 0.02;
      requestAnimationFrame(draw);
    }
    draw();
  }
</script>

---

### 2.3 内联 iframe

```html
<iframe srcdoc="<h3>内联 HTML</h3><p>这是通过 srcdoc 嵌入的内容</p>"
        width="100%" height="120" style="border:1px solid #e5e7eb; border-radius:8px;"></iframe>
```

<iframe srcdoc="<h3 style='margin:8px 16px; color:#333; font-size:18px;'>内联 HTML</h3><p style='margin:8px 16px; color:#666;'>这是通过 srcdoc 嵌入的内容</p>"
        width="100%" height="120" style="border:1px solid #e5e7eb; border-radius:8px;"></iframe>

---

## 三、表单与交互

### 3.1 仪表盘

```html
<meter value="75" min="0" max="100" low="33" high="66" optimum="80">75/100</meter>
```

<meter value="75" min="0" max="100" low="33" high="66" optimum="80">75/100</meter>

---

### 3.2 进度条

```html
<progress value="60" max="100">60%</progress>
```

<progress value="60" max="100">60%</progress>

---

### 3.3 自动补全

```html
<label>选择语言：</label>
<input list="languages">
<datalist id="languages">
  <option value="JavaScript">
  <option value="Python">
  <option value="TypeScript">
  <option value="Java">
  <option value="Go">
</datalist>
```

<label>选择语言：</label>
<input list="languages">
<datalist id="languages">
  <option value="JavaScript">
  <option value="Python">
  <option value="TypeScript">
  <option value="Java">
  <option value="Go">
</datalist>

---

### 3.4 计算结果

```html
<form oninput="result.value = Number(a.value) + Number(b.value)">
  <input type="number" id="a" value="5" style="width:60px;"> +
  <input type="number" id="b" value="10" style="width:60px;"> =
  <output name="result" for="a b">15</output>
</form>
```

<form oninput="result.value = Number(a.value) + Number(b.value)">
  <input type="number" id="a" value="5" style="width:60px; padding:4px 8px; border:1px solid #e5e7eb; border-radius:4px;"> +
  <input type="number" id="b" value="10" style="width:60px; padding:4px 8px; border:1px solid #e5e7eb; border-radius:4px;"> =
  <output name="result" for="a b" style="font-weight:bold; color:#8B5CF6;">15</output>
</form>

---

### 3.5 内容分组

```html
<fieldset style="border:2px solid #8B5CF6; padding:16px; border-radius:8px;">
  <legend style="color:#8B5CF6; padding:0 8px;">用户信息</legend>
  <p>姓名：张三</p>
  <p>年龄：28</p>
</fieldset>
```

<fieldset style="border:2px solid #8B5CF6; padding:16px; border-radius:8px;">
  <legend style="color:#8B5CF6; padding:0 8px;">用户信息</legend>
  <p>姓名：张三</p>
  <p>年龄：28</p>
</fieldset>

---

## 四、全局属性增强

### 4.1 可编辑区域

```html
<div contenteditable="true" style="border:1px dashed #8B5CF6; padding:12px; border-radius:8px;">
  点击这里开始编辑！这是一个纯前端的可编辑区域。
</div>
```

<div contenteditable="true" style="border:1px dashed #8B5CF6; padding:12px; border-radius:8px;">
  点击这里开始编辑！这是一个纯前端的可编辑区域。
</div>

---

### 4.2 可拖拽

```html
<div draggable="true" style="background:#8B5CF6; color:white; padding:16px; border-radius:8px; cursor:grab; display:inline-block;">
  拖拽我试试看！
</div>
```

<div draggable="true" style="background:#8B5CF6; color:white; padding:16px; border-radius:8px; cursor:grab; display:inline-block;">
  拖拽我试试看！
</div>

---

### 4.3 原生弹出层

```html
<button popovertarget="popDemo">打开弹出层</button>
<div id="popDemo" popover style="border:2px solid #D946EF; padding:16px; border-radius:8px; background:white;">
  <p>这是一个原生弹出层！</p>
  <button onclick="document.getElementById('popDemo').hidePopover()">关闭</button>
</div>
```

<button popovertarget="popDemo" style="background:#8B5CF6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">打开弹出层</button>
<div id="popDemo" popover style="border:2px solid #D946EF; padding:16px; border-radius:8px; background:white;">
  <p>这是一个原生弹出层！</p>
  <button onclick="document.getElementById('popDemo').hidePopover()" style="background:#D946EF; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">关闭</button>
</div>

---

## 五、Web Animations API

```html
<div id="animTarget" style="width:100px; height:100px; background:#8B5CF6; border-radius:8px;"></div>
<button onclick="startAnimation()" style="margin-top:16px;">开始动画</button>
```

<div id="animTarget" style="width:100px; height:100px; background:#8B5CF6; border-radius:8px;"></div>
<button onclick="startAnimation()" style="margin-top:16px; background:#8B5CF6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">开始动画</button>

<script>
  function startAnimation() {
    const target = document.getElementById('animTarget');
    if (target && target.animate) {
      target.animate([
        { transform: 'rotate(0deg) scale(1)', backgroundColor: '#8B5CF6' },
        { transform: 'rotate(360deg) scale(1.5)', backgroundColor: '#D946EF' },
        { transform: 'rotate(0deg) scale(1)', backgroundColor: '#8B5CF6' }
      ], {
        duration: 2000,
        iterations: 1
      });
    }
  }
</script>

---

## 六、程序输出示例

### 6.1 变量

```html
圆周率 <var>π</var> ≈ 3.14159
```

圆周率 <var>π</var> ≈ 3.14159

---

### 6.2 程序输出

```html
程序输出：<samp>Hello, World!</samp>
```

程序输出：<samp>Hello, World!</samp>

---

### 6.3 定义术语

```html
<dfn>语义化 HTML</dfn> 是指使用合适的标签来描述内容的含义
```

<dfn>语义化 HTML</dfn> 是指使用合适的标签来描述内容的含义

---

### 6.4 引用

```html
短引用：<q>知识就是力量</q> - 培根

块引用：
<blockquote cite="https://example.com">
  这是一个块级引用，可以包含更多内容
</blockquote>
```

短引用：<q>知识就是力量</q> - 培根<br><br>

块引用：
<blockquote style="border-left:4px solid #8B5CF6; padding-left:16px; margin-left:0; color:#666;">
  这是一个块级引用，可以包含更多内容
</blockquote>

---

### 6.5 联系信息

```html
<address>
  作者：李四<br>
  邮箱：example@example.com<br>
  网站：https://example.com
</address>
```

<address style="font-style:normal; padding:12px; background:#f8fafc; border-radius:8px;">
  作者：李四<br>
  邮箱：example@example.com<br>
  网站：https://example.com
</address>

---

### 6.6 小号文字

```html
<small>© 2024 Copyright All Rights Reserved</small>
```

<small>© 2024 Copyright All Rights Reserved</small>

---

## 七、作品引用

```html
阅读 <cite>《三体》</cite> 是一次精彩的体验
```

阅读 <cite>《三体》</cite> 是一次精彩的体验

---

## 八、可选换行点

```html
Supercalifragilisticexpialidocious
（不换行） vs
Super<wbr>cali<wbr>fragilistic<wbr>expiali<wbr>docious
（有换行点）
```

Supercalifragilisticexpialidocious（不换行）vs<br>
Super<wbr>cali<wbr>fragilistic<wbr>expiali<wbr>docious（有换行点）

---

## 九、双向文本

```html
<bdi>مرحبا</bdi> - 阿拉伯语问候
```

<bdi>مرحبا</bdi> - 阿拉伯语问候

---

## 十、数据关联

```html
<data value="3.14159">圆周率</data>
```

<data value="3.14159">圆周率</data>

---

## 十一、模板元素

```html
<template id="myTemplate">
  <div style="border:1px solid #8B5CF6; padding:12px; border-radius:8px;">
    这是一个模板内容，点击按钮后会显示出来！
  </div>
</template>
<button onclick="useTemplate()">使用模板</button>
<div id="templateContainer"></div>
```

<template id="myTemplate">
  <div style="border:1px solid #8B5CF6; padding:12px; border-radius:8px;">
    这是一个模板内容，点击按钮后会显示出来！
  </div>
</template>
<button onclick="useTemplate()" style="background:#8B5CF6; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">使用模板</button>
<div id="templateContainer"></div>

<script>
  function useTemplate() {
    const template = document.getElementById('myTemplate');
    const container = document.getElementById('templateContainer');
    if (template && container) {
      const clone = template.content.cloneNode(true);
      container.appendChild(clone);
    }
  }
</script>

---

## 总结

以上展示了浏览器原生 HTML 元素和 Web API 的强大功能！所有这些功能都可以在纯前端环境中使用，无需任何后端服务。
