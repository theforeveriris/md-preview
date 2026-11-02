---
title: GitHub 卡片与协议注册表
tags: [GitHub, 外部卡片, 协议]
---

# GitHub 卡片与协议注册表

## GitHub 卡片

引用 repo / issue / PR / release 时直接显示状态、作者、标签与更新时间；API 失败或限流时自动回退为可点击链接。

**源码**（仓库卡片）：

````markdown
```github
@[github](theforeveriris/md-preview)
```
````

**渲染效果**：

```github
@[github](theforeveriris/md-preview)
```

**源码**（PR 卡片，指向本仓库真实存在的 PR）：

````markdown
```github
@[pr](https://github.com/theforeveriris/md-preview/pull/15)
```
````

**渲染效果**：

```github
@[pr](https://github.com/theforeveriris/md-preview/pull/15)
```

**源码**（issue 卡片）：

````markdown
```github
@[issue](https://github.com/kubernetes/kubernetes/issues/1)
```
````

**渲染效果**：

```github
@[issue](https://github.com/kubernetes/kubernetes/issues/1)
```

**源码**（release 卡片）：

````markdown
```github
@[release](https://github.com/git-lfs/git-lfs/releases/tag/v3.5.1)
```
````

**渲染效果**：

```github
@[release](https://github.com/git-lfs/git-lfs/releases/tag/v3.5.1)
```

**源码**（不存在的编号 → 演示失败回退）：

````markdown
```github
@[issue](https://github.com/theforeveriris/md-preview/issues/99999)
```
````

**渲染效果**（回退为链接卡片）：

```github
@[issue](https://github.com/theforeveriris/md-preview/issues/99999)
```

## 协议注册表

**源码**（`registry common` 显示内置 50+ 条常用协议表）：

````markdown
```registry common
```
````

**渲染效果**：

```registry common
```

