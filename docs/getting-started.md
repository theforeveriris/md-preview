# 快速开始

## 部署到 GitHub Pages

### 1. Fork 仓库

点击右上角的 Fork 按钮，将仓库复制到你的账号下。

### 2. 开启 GitHub Pages

1. 进入 Fork 后的仓库
2. 点击 **Settings** → **Pages**
3. 在 **Build and deployment** 中，Source 选择 **GitHub Actions**

### 3. 修改配置

编辑 `iris/config.json`，将 `owner` 和 `repo` 改为你的信息：

```json
{
  "owner": "your-username",
  "repo": "your-repo-name"
}
```

### 4. 推送并等待部署

提交修改并推送到 `main` 分支，GitHub Actions 会自动构建并部署。部署完成后，访问 `https://your-username.github.io/your-repo-name/` 即可查看。

## 添加文档

在仓库的任意位置创建 `.md` 文件，系统会自动发现并显示在侧边栏。推荐放在 `docs/` 目录下。

```
你的仓库/
├── README.md
├── docs/
│   ├── guide.md
│   └── api/
│       └── reference.md
└── ...
```

### 文件命名建议

- 使用小写字母和连字符：`my-document.md`
- 文件名会作为侧边栏显示名称（自动去除扩展名和连字符）

## 本地预览

```bash
# 克隆仓库
git clone <your-repo-url>
cd <repo-name>

# 构建文件树（可选）
node iris/scripts/build-file-tree.js

# 构建搜索索引（可选）
node iris/scripts/build-search-index.js

# 构建 RSS feed（可选）
node iris/scripts/build-feed.js

# 直接用浏览器打开
open index.html
```

> **注意**：直接打开 `index.html` 时，如果预构建文件不存在，会通过 GitHub API 加载文件树，可能受 API 限流影响。建议先构建文件树再预览。
>
> 在 GitHub Pages 部署后，搜索索引与 RSS feed 会通过 GitHub Actions 在 `docs/**` 变更时自动重建。

## 下一步

- 查看 [配置参考](configuration.md) 了解所有可配置项
- 查看 [主题定制](theme-customization.md) 自定义外观
- 查看 [代码高亮主题](code-highlight-theme.md) 自定义代码配色
- 查看 [RSS 订阅](rss.md) 了解如何让他人订阅你的文档更新
- 查看 [插件开发指南](plugin-development.md) 扩展渲染能力
- 浏览 [系统运行时截图](show.md) 了解完整界面效果
- 浏览 [examples/](examples/) 目录查看所有支持的渲染功能
