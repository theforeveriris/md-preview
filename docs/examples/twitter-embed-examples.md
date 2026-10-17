---
title: Twitter/X 嵌入示例
tags: [嵌入]
---

# Twitter/X 嵌入示例

本页面展示如何使用 Markdown 预览器嵌入 Twitter/X 推文和时间线。

---

## 1. 基本用法

### 嵌入单条推文

**源码：**

```markdown
@[twitter](https://twitter.com/elonmusk/status/1726876868777328640)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/elonmusk/status/1726876868777328640)
```

---

### 使用 X 替代 Twitter

**源码：**

```markdown
@[x](https://x.com/OpenAI/status/1234567890)
```

**渲染效果：**

```x
@[x](https://x.com/OpenAI/status/1234567890)
```

---

## 2. 用户时间线嵌入

### 嵌入用户时间线

**源码：**

```markdown
@[twitter](https://twitter.com/OpenAI)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/OpenAI)
```

**说明：**
- 显示该用户最近的推文
- 自动刷新显示最新内容
- 高度可自定义

---

### 嵌入用户喜欢的内容

**源码：**

```markdown
@[twitter](https://twitter.com/username/likes)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/username/likes)
```

---

### 嵌入用户媒体

**源码：**

```markdown
@[twitter](https://twitter.com/nasa/media)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/nasa/media)
```

---

## 3. 列表和时间线

### 嵌入列表

**源码：**

```markdown
@[twitter](https://twitter.com/username/lists/tech-news)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/username/lists/tech-news)
```

---

## 4. 高级用法

### 嵌入线程（Thread）

线程是一系列相关的推文，可以完整嵌入：

**源码：**

```markdown
@[twitter](https://twitter.com/username/status/线程第一条ID)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/username/status/线程第一条ID)
```

**说明：**
- 点击嵌入的推文可以查看完整线程
- 线程会自动聚合显示
- 支持回复和互动

---

### 嵌入引用推文

引用推文会自动显示原始推文和引用内容：

**源码：**

```markdown
@[twitter](https://twitter.com/username/status/引用推文ID)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/username/status/引用推文ID)
```

---

## 5. 使用说明

### 语法规则

1. **基本格式**：`@[twitter](URL)` 或 `@[x](URL)`
2. **URL 类型**：支持推文链接、用户主页、列表等
3. **自动识别**：系统会自动识别 URL 类型并生成对应嵌入代码

### 支持的 URL 类型

| URL 类型 | 嵌入效果 |
|---------|---------|
| `twitter.com/user/status/ID` | 单条推文 |
| `twitter.com/user` | 用户时间线 |
| `twitter.com/user/likes` | 用户喜欢的推文 |
| `twitter.com/user/media` | 用户媒体 |
| `twitter.com/user/lists/name` | 用户列表 |
| `x.com/*` | 同样支持（X 链接） |

### 工作原理

1. **URL 解析**：系统识别 URL 类型
2. **代码生成**：根据类型生成 Twitter 嵌入代码
3. **Widget 初始化**：调用 Twitter widget.js 渲染
4. **异步加载**：确保页面性能不受影响

---

## 6. 样式定制

### 默认样式

- 圆角边框：12px
- 阴影：轻微投影效果
- 间距：1.5em 垂直外边距
- 最大宽度：100%

### 悬停效果

```css
.twitter-timeline:hover {
  background: rgba(212, 165, 201, 0.05);
  border-color: var(--color-accent-purple);
}
```

---

## 7. 注意事项

### 1. 隐私和显示

- 嵌入的推文取决于用户设置
- 部分推文可能被设置为不嵌入
- 需要稳定的网络连接加载 Twitter 内容

### 2. 性能考虑

- Twitter widget.js 异步加载
- 页面加载速度不受影响
- 首次加载可能需要几秒钟

### 3. 移动端适配

- 嵌入内容响应式显示
- 触摸操作流畅
- 自动适应屏幕宽度

### 4. 浏览器兼容性

- 支持所有现代浏览器
- Chrome、Firefox、Safari、Edge
- 需要启用 JavaScript

---

## 8. 常见问题

### Q: 为什么嵌入的推文没有显示？

**A:** 可能的原因：
- 推文被删除或设置为不公开
- 网络连接问题
- Twitter 服务暂时不可用

### Q: 可以自定义嵌入的样式吗？

**A:** 可以修改 `styles.css` 中的 `.twitter-tweet` 和 `.twitter-timeline` 样式类。

### Q: 支持嵌入视频和图片吗？

**A:** 是的，Twitter widget.js 自动处理媒体内容，包括视频、图片、GIF 等。

### Q: 如何获取推文链接？

**A:**
1. 打开目标推文
2. 点击推文下方的分享图标
3. 选择"复制链接"
4. 将链接粘贴到 `@[twitter](链接)` 中

---

## 9. 实际应用场景

### 技术博客

在博客文章中嵌入相关讨论：

**源码：**

```markdown
@[twitter](https://twitter.com/username/status/1234567890)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/username/status/1234567890)
```

### 产品发布

展示产品发布相关推文：

**源码：**

```markdown
@[twitter](https://twitter.com/company/status/发布推文ID)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/company/status/发布推文ID)
```

### 新闻报道

引用重要新闻人物的推文：

**源码：**

```markdown
@[twitter](https://twitter.com/official_user/status/新闻推文ID)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/official_user/status/新闻推文ID)
```

### 社区文档

在文档中添加社区讨论链接：

**源码：**

```markdown
@[twitter](https://twitter.com/community_handle)
```

**渲染效果：**

```twitter
@[twitter](https://twitter.com/community_handle)
```

---

## 10. 示例代码

### 完整示例

```markdown
# 最新动态

以下是今天的技术新闻：

@[twitter](https://twitter.com/TechCrunch/status/1234567890)

---

更多来自 OpenAI 的更新：

@[twitter](https://twitter.com/OpenAI)

---

今天最受欢迎的推文：

@[twitter](https://twitter.com/elonmusk/status/9876543210)
```

---

## 11. 技术细节

### 使用的资源

- **Twitter Widget.js**：`https://platform.twitter.com/widgets.js`
- **嵌入方式**：Twitter 官方 iframe/blockquote 嵌入
- **异步加载**：使用 `async` 属性确保不阻塞页面加载

### 代码示例

**生成的 HTML：**
```html
<!-- 单条推文 -->
<blockquote class="twitter-tweet">
  <a href="https://twitter.com/user/status/1234567890">Loading tweet...</a>
</blockquote>

<!-- 用户时间线 -->
<a class="twitter-timeline" href="https://twitter.com/user">
  Tweets by @user
</a>
```

**JavaScript 初始化：**
```javascript
if (typeof twttr !== 'undefined' && twttr.widgets) {
  twttr.widgets.load();
}
```

---

## 12. 相关资源

- [Twitter 嵌入文档](https://developer.twitter.com/en/docs/twitter-for-websites/embedded-tweets/overview)
- [Twitter widgets.js](https://platform.twitter.com/widgets.js)
- [Twitter 开发者平台](https://developer.twitter.com/)

---

**最后更新**：2026-05-24