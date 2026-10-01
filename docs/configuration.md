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

### 配置加载顺序

1. 内置默认配置
2. `iris/config.json` 中的配置（覆盖默认值）
3. 用户本地存储的设置（如主题选择，会覆盖前两者）

---

## 二、运行时设置（用户级）

通过悬浮球菜单 → **设置** 打开设置面板，所有改动保存在浏览器 localStorage，仅对当前浏览器生效。

设置面板分三大区块：

### 外观

#### 语言

设置面板最顶部为「语言」选择：**自动（跟随浏览器）/ 中文 / English**。选择「自动」时按浏览器语言自动判定；切换立即生效并记忆，无需刷新。

#### 预设主题

| ID | 名称 |
|----|------|
| `auto` | 自动（跟随系统亮暗） |
| `default` | 默认（紫粉渐变） |
| `github-light` | GitHub Light |
| `github-dark` | GitHub Dark |
| `notion` | Notion |
| `arc-dark` | Arc Dark |
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

#### 高级

- **自定义 CSS** — 加载外部 CSS 文件 URL，回车应用
- **自定义高亮 JS** — 加载外部 highlight.js 主题 CSS URL，回车应用（覆盖内置代码主题）

### 功能

#### 显示

| 选项 | 说明 |
|------|------|
| 显示阅读进度 | 控制顶部进度条 |
| 显示字数统计 | 控制文件树中每个文件旁的字数显示 |
| 截断长文件名 | 开启时文件名过长省略号显示，关闭时展开（区域可横向滚动，隐藏滚动条） |
| 内容区宽度 | 滑杆调整 Markdown 正文最大宽度（600–1400px，默认 720px），拖动即时生效，可一键重置 |
| 正文占满可用宽度 | 开启后正文铺满窗口可用宽度，忽略上方宽度设置，适合宽屏显示器 |

> 侧边栏折叠：桌面端可通过侧边栏标题栏的汉堡按钮或快捷键 `Ctrl/⌘ + B` 折叠/展开侧边栏，折叠后左上角浮现展开按钮，状态自动记忆（与移动端抽屉行为一致）。
>
> 以上宽度与侧边栏操作均有键盘快捷键（`Ctrl/⌘ + Alt + =/-/0/F`、`Ctrl/⌘ + B`、`[` / `]` 等），完整清单见 [快捷键](shortcuts.md)。

### 操作

| 操作 | 说明 |
|------|------|
| 下载 Markdown | 下载当前打开的 `.md` 源文件 |
| 导出 PDF | 通过浏览器打印对话框导出为 PDF（自动隐藏侧边栏、悬浮球等 UI） |

---

## 三、悬浮球菜单

悬浮球展开后提供 7 个快捷入口：

| 入口 | 说明 |
|------|------|
| 回到顶部 | 平滑滚动到文档顶部 |
| 上一篇 | 跳转文件树中相邻的上一份文档 |
| 下一篇 | 跳转文件树中相邻的下一份文档 |
| 打开本地 MD | 选择本地 `.md` 文件预览（不写入 URL，刷新后丢失） |
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
