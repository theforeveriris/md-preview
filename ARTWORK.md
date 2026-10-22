---
title: 美术设计规范
tags: [开发, 设计]
---

# 美术设计规范 — Markdown Preview

本文件是本项目所有图像资产（应用图标、PWA 图标、桌面端 exe 图标、分享卡片、README 横幅）的设计规范与生成流程。

设计标识是**鸢尾花（Iris）**——对应项目作者 `theforeveriris`，同时 `iris/` 目录名也取自这里。整套资产围绕一枚单色鸢尾剪影展开。

> 本文件面向开发者与后续维护者。终端用户可参考 [docs/theme-customization.md](docs/theme-customization.md) 调整站点主题色。

---

## 一、设计令牌

### 1.1 主色板

| 令牌 | 色值 | 用途 |
|------|------|------|
| `iris` | `#8B5CF6` | **品牌主色**。图标主体填充色、强调色、描边色 |
| `iris-deep` | `#6D28D9` | 深色变体。文字强调、图标渐变末端、图表折线 |
| `iris-light` | `#A78BFA` | 浅色变体。图表柱状图次级填充 |
| `iris-pale` | `#C4B5FD` | 极浅变体。图表最浅填充、装饰线条 |
| `iris-wash` | `#EDE7FE` | 浅紫底。标签胶囊背景、卡片描边 |
| `iris-mist` | `#DDD6FE` | 分隔线、坐标轴 |
| `iris-tint` | `#F3EEFE` | 页面浅紫底（Hero 渐变中段） |
| `iris-fade` | `#FAF8FF` | 页面近白底（Hero 渐变起点） |
| `ink` | `#2B1E4A` | 深紫黑。标题文字 |
| `ink-soft` | `#3B2E63` | 次级标题 |
| `body` | `#5B4F7D` | 正文 |
| `muted` | `#7A6E9B` | 弱化说明文字 |

### 1.2 语义色

| 令牌 | 色值 | 用途 |
|------|------|------|
| `paper` | `#FFFFFF` | 卡片底 |
| `paper-soft` | `#F7F5FF` | 卡片渐变末端 |
| `line` | `#D6CDF5` | 卡片描边 |
| `text-line` | `#C9BFEA` | 插画中的文本行占位 |

### 1.3 字体

| 场景 | 字体栈 |
|------|--------|
| 拉丁标题 | `Georgia, 'Noto Serif SC', serif` |
| 中文正文 | `'Microsoft YaHei', 'Noto Sans SC', sans-serif` |
| 代码/标识 | `Georgia, serif` |

站点正文的衬线 / 无衬线字体与站点主题一致（默认 Cormorant Garamond + IBM Plex Sans），但**图像资产内的文字不依赖网络字体**，全部使用系统栈，保证离线渲染与跨机一致。

### 1.4 渐变

| 名称 | 定义 |
|------|------|
| `irisGrad` | `#A78BFA` → `#7C3AED`，45° 方向 |
| `heroBg` | `#FAF8FF` → `#F3EEFE` → `#EDE7FE`，45° 方向 |
| `cardGrad` | `#FFFFFF` → `#F7F5FF`，垂直方向 |

---

## 二、图形设计规范

### 2.1 鸢尾剪影

图标主体是一枚**单色 die-cut 剪影**，风格参照 Obsidian 应用图标：

- **结构**：上部三片挺立旗瓣（中央一片最高）+ 下部三片垂瓣（中央一片最宽）
- **无茎、无叶、无枝杈**——只取花头
- **单色平涂**：无渐变、无描边、无阴影、无 3D
- **边缘**：圆润柔和，无尖角

矢量源：6 条 `<path>`，绘制在 `512×512` 画布内，图形实际占位约 `28×28` 到 `482×482`（留白约 8%）。

### 2.2 栅格与留白

| 规则 | 值 |
|------|-----|
| 画布 | `512×512` viewBox |
| 图形外接框 | 约 `455×440` |
| 四边最小留白 | `28`（约 5.5%） |
| 对称轴 | 垂直，x = 256 |
| 花瓣顶缘 | y ≈ 35 |
| 垂瓣底缘 | y ≈ 475 |

### 2.3 安全区

| 版本 | 规则 |
|------|------|
| `any`（普通图标） | 图形按 8% 边距内缩 |
| `maskable`（PWA 可遮罩） | 图形缩到 **62%**，落在中心安全区内 |

maskable 版采用「紫底 + 白鸢尾」反色方案，避免系统在裁切时露出透明边。

### 2.4 使用场景与配色规则

| 场景 | 底色 | 图形色 |
|------|------|--------|
| 网页 favicon | 透明 | `#8B5CF6` |
| PWA any | 透明 | `#8B5CF6` |
| PWA maskable | `#8B5CF6` 实底 | `#FFFFFF` |
| apple-touch-icon | `#FFFFFF` 实底 | `#8B5CF6` |
| 桌面端 exe / ico | 透明 | `#8B5CF6` |
| Hero 横幅 | 浅紫渐变 | 紫→深紫渐变 |

---

## 三、尺寸与用途清单

### 3.1 `iris/icons/` —— 站点与 PWA

| 文件 | 尺寸 | 格式 | 用途 | 引用位置 |
|------|------|------|------|----------|
| `icon.svg` | 512×512 viewBox | SVG | 主矢量图标，无损缩放 | `index.html` favicon、`manifest.json` |
| `icon.png` | 1024×1024 | PNG RGBA | 高清母版 | 生成中间产物 |
| `icon-512.png` | 512×512 | PNG RGBA | PWA 主图标 | `manifest.json` |
| `icon-192.png` | 192×192 | PNG RGBA | PWA 小图标、快捷方式图标 | `manifest.json` shortcuts |
| `favicon-32.png` | 32×32 | PNG RGBA | 浏览器标签页 | `index.html` |
| `apple-touch-icon.png` | 180×180 | PNG RGB | iOS 主屏图标（不支持透明，故铺白底） | `index.html` |
| `icon-maskable.svg` | 512×512 viewBox | SVG | PWA maskable 矢量 | `manifest.json` |
| `icon-maskable-512.png` | 512×512 | PNG RGBA | PWA maskable 位图 | `manifest.json` |
| `hero.svg` | 1280×440 viewBox | SVG | README 横幅矢量源 | 源文件 |
| `hero.png` | 1280×440 | PNG RGB | README 横幅成品 | `README.md` 顶部 |
| `og-image.png` | 1200×630 | PNG RGB | 社交分享卡片（OG / Twitter Card） | `index.html` og:image |
| `iris-icon-src2.png` | 1024×1024 | PNG RGB | **素材源**：洋红底原图，供重新抠像 | 生成脚本输入 |

### 3.2 `src-tauri/icons/` —— 桌面端（Tauri）

由 `tauri icon` 从 `iris/icons/icon.svg` 生成，覆盖 Windows / macOS / Linux。

| 文件 | 尺寸 | 用途 |
|------|------|------|
| `32x32.png` | 32×32 | 任务栏、窗口标题栏 |
| `64x64.png` | 64×64 | 通用小尺寸 |
| `128x128.png` | 128×128 | 通用尺寸 |
| `128x128@2x.png` | 256×256 | 高 DPI 变体（`bundle.icon` 中引用此项） |
| `icon.png` | 512×512 | 桌面端主图标 |
| `icon.ico` | 16/24/32/48/64/256 | Windows exe 与安装包图标 |
| `icon.icns` | 多尺寸 | macOS 图标（本项目未用） |
| `Square*Logo.png` | 30～310 | Windows Store 磁贴（未用） |
| `StoreLogo.png` | 50×50 | Windows Store 小图标（未用） |

`bundle.icon` 生效的 5 项：`32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.icns`、`icon.ico`。

### 3.3 `docs/image/` —— 文档截图

38 张运行时界面截图，位于 `docs/image/`，由 [docs/show.md](docs/show.md) 索引。**不属于美术资产**，不随图标规范维护，仅作功能演示。

---

## 四、生成脚本与工作流

### 4.1 脚本清单

| 脚本 | 语言 | 作用 |
|------|------|------|
| `iris/scripts/make-iris-icon.py` | Python + Pillow | 从素材源抠像，生成全部 `iris/icons/` 图标（PNG 各尺寸 + SVG 描摹） |
| `iris/scripts/make-hero-image.py` | Python + cairosvg | 由 `hero.svg` 渲染出 `hero.png` |
| `iris/scripts/make-og-image.py` | Python + Pillow | 生成 `og-image.png` 社交分享卡片 |

依赖：`pip install pillow cairosvg`。`cairosvg` 需要系统有 Cairo 库（Windows 可用 `pip install cairosvg` 自带的二进制轮子）。

### 4.2 重新生成

```bash
# 1) 全套站点图标（含 SVG 描摹）
python iris/scripts/make-iris-icon.py

# 2) README 横幅
python iris/scripts/make-hero-image.py

# 3) 社交分享卡片
python iris/scripts/make-og-image.py

# 4) 桌面端 exe 图标（从矢量源生成全套）
npm run desktop:icon
```

`npm run desktop:icon` 会额外产出 `android/` 与 `ios/` 目录，本项目只发布 Windows，**可安全删除**。

### 4.3 重新绘制鸢尾图形

鸢尾剪影的 6 条 path 位于 `iris/icons/icon.svg` 与 `iris/icons/hero.svg` 中，两处需保持一致。

修改流程：

1. 编辑 `iris/icons/iris-icon-src2.png` 的**替代源**（当前是 AI 生成的洋红底图）
2. 在 `make-iris-icon.py` 中调整 `chroma_key()` 的阈值——脚本用 `|R - B|` 区分洋红底与紫色主体
3. 重新执行上述四条命令
4. 同步 `dist/`：`npm run desktop:dist`

### 4.4 SVG 描摹原理

`make-iris-icon.py` 生成矢量图标时：

1. 二值化遮罩 → 连通域标记，把 6 片花瓣切成 6 个色块
2. **Moore 邻域跟踪**（不是极角排序）提取每块的有序闭合外轮廓
3. **Douglas-Peucker** 简化（ε = 1.2 px）
4. 坐标换算到 512 viewBox 输出 `<path>`

早期版本用「绕质心极角排序」提取边界，会在花瓣间的凹角产生锯齿伪影；Moore 跟踪可正确保持轮廓顺序。

### 4.5 抠像阈值说明

素材源底色为洋红 `R≈220, G≈80, B≈233`，主体为紫 `R≈135, G≈45, B≈233`。两者 `|R-B|` 差异显著：

| `|R-B|` | 判定 |
|---------|------|
| ≤ 45 | 背景，透明 |
| 45 ~ 70 | 过渡带，按线性插值算 alpha |
| ≥ 70 | 主体，不透明 |

---

## 五、接入点清单

改动图标时需同步检查以下位置：

| 文件 | 涉及内容 |
|------|----------|
| `index.html` | favicon 链接、`theme-color`、`og:image` |
| `manifest.json` | `theme_color`、`icons` 数组、`shortcuts` 图标 |
| `package.json` | `desktop:icon` 脚本的源文件路径 |
| `src-tauri/tauri.conf.json` | `bundle.icon` 数组 |
| `README.md` | 顶部横幅 `hero.png` |

---

## 六、命名约定

| 前缀 / 后缀 | 含义 |
|-------------|------|
| `icon.*` | 应用主图标 |
| `icon-{size}.png` | 主图标的位图尺寸变体 |
| `icon-maskable.*` | PWA 可遮罩版本 |
| `favicon-{size}.png` | 浏览器标签页图标 |
| `apple-touch-icon.png` | iOS 主屏图标 |
| `hero.*` | README 顶部横幅 |
| `og-image.png` | 社交分享卡片 |
| `*-src*.png` | 生成脚本的素材源，非最终产物 |
| `Square*Logo.png` / `StoreLogo.png` | Tauri 生成的 Windows Store 图标 |

---

## 七、待办与已知问题

- [ ] 站点主题强调色仍是旧的粉紫 `#d4a5c9`（`iris/css/base.css` 的 `--color-accent-purple`），与鸢尾紫 `#8B5CF6` 未统一。该变量被 Mermaid、郊狼波形、分享卡片、文档图谱等渲染器引用，改动需回归测试
- [ ] `hero.svg` 与 `icon.svg` 中的鸢尾 path 目前是两处独立副本，未做单一来源同步
- [ ] `docs/image/` 下的 38 张截图为旧粉紫主题，尚未重拍

---

## License

图标与美术资产随项目源代码采用 [AGPL-3.0](LICENSE) 授权。
