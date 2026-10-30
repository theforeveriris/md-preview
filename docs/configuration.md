---
title: 配置参考
tags: [配置]
---

# 配置参考

Markdown Preview 的配置分为两层：

1. **构建/部署配置** — `iris/config.json`（仓库级，所有访客共享）
2. **运行时设置** — 浏览器 localStorage（用户级，仅当前浏览器生效）

---

## 一、`iris/config.json`（仓库级配置）

修改此文件后需推送代码触发重新部署。

### 基础配置

```json
{
  "owner": "your-username",
  "repo": "your-repo-name"
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `owner` | string | - | GitHub 用户名或组织名 |
| `repo` | string | - | 仓库名 |

### 完整配置项

```json
{
  "owner": "",
  "repo": "",
  "branch": "main",
  "title": "Markdown Preview",
  "defaultTheme": "default",
  "showEditButton": true,
  "showReadingTime": true,
  "showBreadcrumbs": true
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `branch` | string | `main` | 文档所在的 Git 分支 |
| `title` | string | `Markdown Preview` | 站点标题 |
| `defaultTheme` | string | `default` | 默认主题 ID |
| `showEditButton` | boolean | `true` | 是否显示"编辑此页"按钮 |
| `showReadingTime` | boolean | `true` | 是否显示阅读时间估算 |
| `showBreadcrumbs` | boolean | `true` | 是否显示面包屑导航 |
| `plantumlServers` | array | 内置列表 | PlantUML 渲染服务列表，按顺序尝试 |

#### PlantUML 渲染服务（plantumlServers）

PlantUML 图表默认依次尝试官方服务器与 Kroki 公共服务，全部失败时自动降级为源码展示并提供在线编辑器链接。若你自建了 PlantUML 服务或想使用其他镜像，可在 `iris/config.json` 中覆盖：

```json
{
  "plantumlServers": [
    { "type": "plantuml", "base": "https://your-self-hosted/plantuml" },
    { "type": "kroki", "base": "https://kroki.io/plantuml" }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `type` | `plantuml`（PlantUML 自定义编码）或 `kroki`（标准 base64url 编码） |
| `base` | 服务基础地址，渲染时自动拼接 `/svg/<编码>` |

### 首页（homepage）

不配置时打开站点显示「选择一个文件开始阅读」空状态；配置 `homepage` 后，打开站点（或点面包屑回首页）会先进入指定的首页形态：

```jsonc
{
  // 形态一：直接指定一篇文档作为首页
  "homepage": "docs/getting-started.md",

  // 形态二：门户页（hero 区 + 精选文档卡片网格 + 快捷链接）
  "homepage": {
    "mode": "portal",
    "title": "我的知识库",
    "subtitle": "网络 / 运维 / 随手记",
    "featured": ["docs/getting-started.md", "docs/show.md", "docs/roadmap.md"],
    "links": [
      { "text": "GitHub 仓库", "href": "https://github.com/your-name/your-repo" },
      { "text": "快速上手", "href": "docs/getting-started.md" }
    ]
  }
}
```

| 字段 | 说明 |
|------|------|
| `mode` | 门户页固定为 `portal` |
| `title` / `subtitle` | Hero 区标题与副标题（缺省取 `repo`） |
| `featured` | 精选文档路径列表，渲染为卡片网格（取自文件树的标题/词数/标签） |
| `links` | Hero 下方的快捷链接按钮；站内路径不带 `#/` 前缀，完整 URL 会被识别为外链 |

### 站内虚拟路由

除 `#/文档路径.md` 外，站点内置以下虚拟页面，可直接访问或从命令面板（`Ctrl/⌘+K`）进入：

| 路由 | 说明 |
|------|------|
| `#/blog` | 博客流视图：全站文档按更新时间倒序，`#/blog?p=2` 翻页 |
| `#/history` | 浏览足迹：最近 50 次阅读记录 |
| `#/tags` | 标签云：字号按文档数缩放，点击进入对应标签聚合页 |
| `#/index` | 全站目录：按目录分组的完整文档列表（打印友好） |
| `#/orphan` | 孤立文档检测：无反链 / 无标签 / 超短 / 长期未更新四类清单 |
| `#/graph` | 文档图谱 |

### 非 GitHub 托管（provider）

默认对接 GitHub API（文件树回退、git 历史、编辑此页链接）。托管在 Gitee / GitLab 时指定 `provider`：

```jsonc
{
  "provider": "gitee",          // github（默认）| gitee | gitlab
  "branch": "main",
  // 仅 gitlab 需要：
  "gitlabUrl": "https://gitlab.com",   // 自托管实例改这里
  "projectId": "group%2Frepo"          // 数字 ID 或 URL 编码的完整路径
}
```

私有仓库可在浏览器 `sessionStorage` 写 `md-preview-gitee-token` / `md-preview-gitlab-token` / `md-preview-github-token` 提高限额（标签页生命周期内有效）。

### 配置加载顺序

1. 内置默认配置
2. `iris/config.json` 中的配置（覆盖默认值）
3. 用户本地存储的设置（如主题选择，会覆盖前两者）

---

## 二、运行时设置（用户级）

通过悬浮球菜单 → **设置** 打开设置面板，所有改动保存在浏览器 localStorage，仅对当前浏览器生效。

设置面板分七个区块：**语言 / 外观 / 字体 / 阅读 / 布局 / 工具与导出 / 存储**（左侧分组导航，点击平滑滚动、滚动时自动同步高亮）。

### 语言

设置面板最顶部为「语言」选择：**自动（跟随浏览器）/ 中文 / English**。选择「自动」时按浏览器语言自动判定；切换立即生效并记忆，无需刷新。

### 外观

#### 预设主题

| ID | 名称 |
|----|------|
| `auto` | 自动（跟随系统亮暗） |
| `default` | 默认（紫粉渐变） |
| `github-light` | GitHub Light |
| `github-dark` | GitHub Dark |
| `notion` | Notion |
| `arc` | Arc Dark |
| `dracula` | Dracula |
| `nord` | Nord |

> 选择预设主题会清空自定义配色。

**自动主题（auto）**：跟随系统 `prefers-color-scheme` 实时切换——系统亮色时使用「自动主题配对」中的亮色主题（默认紫粉渐变），暗色时使用暗色主题（默认 GitHub Dark）。配对可在设置面板中自由组合，系统亮暗变化时即时生效（含 PWA 桌面模式）。

#### 自定义配色（取色器）

无需写 CSS，直接通过取色器调整：

| 分组 | 可调变量 | 说明 |
|------|----------|------|
| **强调色** | `--color-accent-purple` / `--color-accent-pink` / `--color-accent-purple-deep` | 主色及派生色 |
| **中性色** | `--color-bg` / `--color-surface` / `--color-border` / `--color-text` / `--color-text-muted` | 背景、表面、文字与边框 |

通过中性色调整即可做出亮色或暗色主题。点击「重置」恢复默认值。

详见 [主题定制](theme-customization.md)。

#### 字体自定义

设置面板 → **外观 → 字体**，无需写 CSS 即可精细控制排版：

| 选项 | 说明 |
|------|------|
| 远程字体 URL | 填写 Google Fonts 等 CSS URL 即可加载远程字体 |
| 展示字体族 | 标题衬线体，独立于正文 |
| 正文字体族 | UI / 正文无衬线体 |
| 字号细调 | UI / 正文 / H1 / H2 / H3 独立设置 |
| 字重细调 | UI / 正文 / 展示体 / H1 / H2 / H3 独立选择（300 ~ 800） |
| 字色 | 正文与次要文字颜色独立取色 |
| 标题数字无衬线 | 默认标题数字随标题字体（衬线）；开启后仅数字改用无衬线字形 |
| 重置字体 | 一键恢复全部字体默认值 |

#### 代码高亮主题

| 主题 ID | 名称 | 类型 |
|---------|------|------|
| `github` | GitHub Light | 亮色 |
| `github-dark` | GitHub Dark | 暗色 |
| `atom-one-light` | Atom One Light | 亮色 |
| `atom-one-dark` | Atom One Dark | 暗色 |
| `monokai` | Monokai | 暗色 |
| `dracula` | Dracula | 暗色 |
| `nord` | Nord | 暗色 |
| `vs2015` | VS 2015 | 暗色 |
| `solarized-light` | Solarized Light | 亮色 |
| `solarized-dark` | Solarized Dark | 暗色 |

详见 [代码高亮主题](code-highlight-theme.md)。

在「外观 → 代码高亮」中还可填写**自定义高亮主题**：加载外部 highlight.js 主题 CSS URL，回车应用（覆盖内置代码主题）。

#### 自定义 CSS

在「外观 → 自定义 CSS」中填写**外部样式表 URL**，加载外部 CSS 文件进一步定制页面，回车应用。

### 阅读

#### 显示选项

| 选项 | 说明 |
|------|------|
| 显示阅读进度 | 控制顶部进度条 |
| 显示字数统计 | 控制文件树中每个文件旁的字数显示 |
| 折叠过长文件名 | 开启时文件名过长省略号显示，关闭时完整展开（区域可横向滚动，隐藏滚动条）；默认关闭 |
| 侧边栏文件夹默认展开 | 开启时文件树中的文件夹全部展开显示；关闭时默认折叠，点击文件夹手动展开 |
| 启用移动端手势 | 触屏设备左右滑动正文切换上一篇 / 下一篇，自屏幕左缘右滑呼出侧边栏抽屉 |
| 启用章节折叠 | H2 标题栏右侧出现折叠按钮，折叠状态按文档记忆、重开自动恢复 |
| 对照阅读默认同步滚动 | 打开双栏对照阅读时两栏按比例同步滚动（`Ctrl/⌘+Alt+S` 可随时开关本次会话） |
| 专注模式 | 当前阅读段落保持高亮、其余内容淡化（也可在 `Ctrl/⌘+K` 命令面板开关） |

#### 布局

| 选项 | 说明 |
|------|------|
| 侧边栏样式 | 经典：贴边通栏、微色差微阴影无边框（默认）；悬浮卡片：四周留缝的圆角卡片（桌面端） |
| 内容区宽度 | 滑杆调整 Markdown 正文最大宽度（600–1400px，默认 720px），拖动即时生效，可一键重置 |
| 正文占满可用宽度 | 开启后正文铺满窗口可用宽度，忽略上方宽度设置，适合宽屏显示器 |
| 长表格延伸到右侧空白 | 内容宽度设置保持不变，宽表格向右适度越过正文边界、利用右侧空白显示更多列 |

> 侧边栏折叠：桌面端可通过侧边栏标题栏的汉堡按钮或快捷键 `Ctrl/⌘ + B` 折叠/展开侧边栏，折叠后左上角浮现展开按钮，状态自动记忆（与移动端抽屉行为一致）。
>
> 以上宽度与侧边栏操作均有键盘快捷键（`Ctrl/⌘ + Alt + =/-/0/F`、`Ctrl/⌘ + B`、`[` / `]` 等），完整清单见 [快捷键](shortcuts.md)。

### 工具与导出

#### 工具

| 工具 | 说明 |
|------|------|
| Markdown 编辑器 | 在新标签页打开交互式编辑器（`?mode=editor`），支持语法快速输入和实时渲染 |
| 波形生成器 | 可视化生成 DG-LAB 郊狼 `.pulse` 波形文件（`?mode=pulsegen`），最多 20 个 |

#### 导出

| 操作 | 说明 |
|------|------|
| 下载 Markdown | 下载当前打开的 `.md` 源文件 |
| 导出 PDF | 通过浏览器打印对话框导出为 PDF（自动隐藏侧边栏、悬浮球等 UI） |
| 导出 HTML | 保存为内联当前主题样式与全部本地 CSS 的单文件 HTML，双击即可离线查看 |

#### 离线缓存

| 操作 | 说明 |
|------|------|
| 全量离线缓存 | 把文件树覆盖的所有文档拉进 PWA 缓存（带进度反馈），离线也能整站阅读；支持一键清除文档缓存。需 HTTPS 部署访问后可用 |

### 存储

设置面板「存储」区块：`navigator.storage.estimate()` 用量条（已用 / 配额）、编辑器笔记本列表（逐条删除 / 全部清空，二次确认）、阅读历史与收藏 / 阅读位置的占用与一键清理（`iris/js/storage-manager.js`，打开面板时自动刷新）。

#### 导航增强

- **面包屑目录聚合页**：面包屑与正文同宽对齐；点击中间路径进入该目录的聚合页，集中浏览目录下全部文档
- **标签聚合页**：`#/tag/<标签>` 按标签聚合文档（见「标签系统」）

---

## 三、悬浮球菜单

悬浮球展开后提供 6 个快捷入口：

| 入口 | 说明 |
|------|------|
| 回到顶部 | 平滑滚动到文档顶部 |
| 打开本地文件 | 点击弹出选择面板：「选择文件…」可一次选中一个或多个本地 `.md` / `.txt` 文件预览（不写入 URL，刷新后丢失），未打开的文件进入侧边栏「本地文件」会话列表，可切换、移除或清空；「选择文件夹…」整体导入一个目录（File System Access API，旧浏览器回退 `webkitdirectory`），按目录树展示、文件夹可折叠、内容懒加载；最多收集 500 个文件，单文件 ≤ 10 MB。受浏览器限制，文件与文件夹需在面板中二选一进入。`.txt` 按「无特殊格式的纯文本」处理：不解析 frontmatter，正文照常按 Markdown 渲染 |
| 扫码续读 | 生成当前文档 + 阅读位置的二维码，手机扫码接着看 |
| 安装到桌面 | PWA 安装（仅浏览器支持时显示） |
| 编辑此页 | 在新标签页打开 GitHub 编辑界面 |
| 设置 | 打开设置面板 |

---

## 四、RSS 订阅

站点自动生成 RSS feed，订阅地址：

```
https://<owner>.github.io/<repo>/iris/data/feed.xml
```

详见 [RSS 订阅](rss.md)。
