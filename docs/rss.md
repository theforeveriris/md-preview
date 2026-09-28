# RSS 订阅

Markdown Preview 自动为 `docs/` 目录下的所有 Markdown 文档生成 RSS 2.0 feed，方便他人通过 RSS 阅读器订阅你的文档更新。

---

## 订阅地址

部署后，RSS feed 位于：

```
https://<owner>.github.io/<repo>/iris/data/feed.xml
```

例如本站：

```
https://theforeveriris.github.io/md-preview/iris/data/feed.xml
```

> feed.xml 不放在仓库根目录，而是放在 `iris/data/` 下，与 `file-tree.json`、`search-index.json` 等预构建数据并列。

## 自动发现

`index.html` 中已添加：

```html
<link rel="alternate" type="application/rss+xml" title="Markdown Preview" href="iris/data/feed.xml">
```

主流浏览器和 RSS 阅读器扩展会自动发现并提示订阅。

## Feed 内容

每篇文档对应一个 `<item>`，包含：

| 字段 | 来源 |
|------|------|
| `<title>` | frontmatter.title → 文档首个 `#` 标题 → 文件名 |
| `<link>` | 站点 URL + `docs/` 文档相对路径，指向可直接抓取的原始 Markdown 文件（标准 RSS 阅读器不执行站点 JS，hash fragment `#/docs/foo.md` 无法解析） |
| `<guid>` | 与 `<link>` 相同，作为永久链接 |
| `<pubDate>` | frontmatter.date → git 最后提交时间 → 文件 mtime |
| `<description>` | frontmatter.description → 正文前 200 字（去除代码块/标题/markdown 符号） |

`<channel>` 包含站点标题、链接、描述、语言、最后构建时间和自引用 `<atom:link>`。

## 通过 Frontmatter 自定义

在 Markdown 文件头部添加 YAML frontmatter 可自定义 feed 条目：

```markdown
---
title: 我的自定义标题
description: 这是一段自定义摘要，会显示在 RSS 阅读器中
date: 2026-01-15
---

# 正文开始
...
```

| 字段 | 说明 |
|------|------|
| `title` | 覆盖自动提取的标题 |
| `description` | 覆盖自动提取的摘要 |
| `date` | 覆盖 git 提交时间作为发布时间（格式：`YYYY-MM-DD` 或 ISO 8601） |

## 自动重建

GitHub Actions 工作流 [.github/workflows/build-feed.yml](../.github/workflows/build-feed.yml) 会在以下情况自动重建 feed：

- `main` 分支上 `docs/**` 路径下文件变更
- 手动触发（workflow_dispatch）

工作流步骤：
1. `fetch-depth: 0` 拉取完整 git 历史（用于读取文件提交时间）
2. 运行 `node iris/scripts/build-feed.js`
3. 自动提交并推送 `iris/data/feed.xml`

## 手动构建

本地预览或调试时，可手动运行：

```bash
node iris/scripts/build-feed.js
```

会扫描 `docs/` 下所有 `.md` 文件，生成 `iris/data/feed.xml`。

> 本地运行时若文件未被 git 跟踪，`git log` 失败会自动回退到文件 mtime。

## 实现细节

构建脚本：[iris/scripts/build-feed.js](../iris/scripts/build-feed.js)

- 递归扫描 `docs/` 目录（不读 `file-tree.json`，避免 node_modules 噪音）
- 仅处理 `.md` 文件
- XML 特殊字符转义（`&` `<` `>` `"` `'`）
- 按 `pubDate` 倒序排列
- 输出 RSS 2.0 + Atom 命名空间（支持 `<atom:link rel="self">` 自引用）

## 验证

生成后可使用以下工具验证 feed 合规性：

- [W3C Feed Validation Service](https://validator.w3.org/feed/)
- RSS 阅读器（Feedly、Inoreader、NetNewsWire 等）直接订阅测试
