---
title: 变更日志
tags: [规划]
---

# 变更日志

> 本页由 `iris/scripts/build-changelog.js` 从 git 历史自动生成，请勿手动编辑。

## 2026-10-27

- `e635b5b` merge: 合并 main 的自动生成产物（数据文件冲突取本分支并重新生成） — theforeveriris
- `44c7657` fix(review): 处理 CodeRabbit 的 20 条 minor 与 2 条 nitpick — theforeveriris
- `7f6935e` fix(review): 修正 CodeRabbit 评审的 11 项问题 — theforeveriris
- `f7d8c95` fix(pulse)+feat(theme): 修复大波形不渲染、恢复默认配色、新增鸢尾花紫主题 — theforeveriris
- `7a52e94` build: 重新生成数据产物（changelog/feed/file-tree/links/precache/sitemap） — theforeveriris
- `f230013` docs(screenshots): 46 张运行时截图全量重拍（新品牌紫 + 新 UI），show.md 补第六/七节配图 — theforeveriris
- `ff29fdb` feat(artwork): 站点强调色统一为品牌紫 #8B5CF6 + 图标双源漂移门禁（原暂缓项） — theforeveriris
- `1ebb26b` docs: 06 文档问题修复（19/21，2 项需运行环境/设计工作） — theforeveriris
- `1a83ac2` feat(graph): 配色改色相轮分层 + 独立页形态 + 修复节点点击导航（SW v8.51） — theforeveriris
## 2026-10-26

- `e6dd36d` style: 中文排版自动修正 [skip ci] — github-actions[bot]
- `297e234` test(docs): 触发排版校验流水线 — theforeveriris
- `0d5c72b` test(docs): 触发排版校验流水线 — theforeveriris
- `12434b1` test(docs): 触发排版校验流水线 — theforeveriris
- `d9f1ceb` test(docs): 新增中文排版问题样例文档（docs/zw） — theforeveriris
- `ac25f3e` ci: 新增中文文案排版校验流水线（首次全量 + 后续增量 + 机器人提交） — theforeveriris
## 2026-10-19

- `4bcb72f` docs: 补桌面端构建说明；顺带刷新 file-tree 词数 — theforeveriris
- `6c5500c` docs: 同步文档图谱的入口收敛与沉浸式改版 — theforeveriris
- `8c83af3` docs: 同步本轮 8 项功能——README 特性清单 / 开发文档 / 路线图 / 候选池 + 重建产物 — theforeveriris
- `3a6c0bb` feat(batch4): 图 / 表自动编号与交叉引用（SW v8.48） — theforeveriris
- `09e9165` feat(batch1): 设置项搜索 + 脚注悬浮预览 + 时间线组件（SW v8.45） — theforeveriris
- `a761039` docs: 同步本轮新增功能到 README 特性清单与功能路线图 — theforeveriris
- `fe6ec47` feat(batch3): OpenAPI 交互文档 + 竖排模式 + Git 历史/变更订阅 + 渐进式代码高亮（SW v8.43） — theforeveriris
- `8ddc218` feat(batch2): 可见即渲染 + 术语表悬浮 + HTTP 请求块 + 开发者小工具 + 中文排版 lint + 拼音注音（SW v8.42） — theforeveriris
- `ecabc54` feat(batch1): 相邻文档预取 + 屏外跳过布局 + CSV→图表 + SQL DDL→ER + 正文繁简转换 + 中文排版选项 + 自动变更日志页（SW v8.41） — theforeveriris
## 2026-10-18

- `fdc726d` refactor(renderers): 统一渲染器调度器 runRenderers——注册表遍历顺序 await，消除三处硬编码清单；geo 转正支持围栏；embedded 四段挂载逻辑收敛为工厂；新增顺序/错误隔离测试（SW v8.38） — theforeveriris
## 2026-10-17

- `3f5cdf6` feat(tags): 全部文档补写 frontmatter tags（44 篇）+ 标签面板改为顶栏 Files/Index/标签 第三选项卡 — theforeveriris
## 2026-10-05

- `2f7b78c` feat: 标签系统 + 万能命令面板 + 搜索直达关键词 + live 预览沙箱 + JSON 可折叠树 + 图表悬浮工具条 + 快照分享 + 专注模式 + 多标签页同步 + Issue 一键反馈 + 讲义打印样式 — theforeveriris
## 2026-10-02

- `002f399` fix: 打包导出失效（settings.js 初始化早于 export-bundle.js 注册）+ 对照阅读沉浸化 — theforeveriris
- `35595da` feat: 文章内查找条 + 章节折叠 + 双栏对照阅读 + EPUB/整站打包导出 + 分享卡片多模板 + PWA shortcuts — theforeveriris
- `aa666a0` feat(ci): 死链检查——内链全量校验 + 外链按日确定性抽查 — theforeveriris
## 2026-10-01

- `208ce22` feat: 移动端手势 + 存储管理页 + 拖拽打开 + 设置导出/导入 + 全文 RSS + sitemap + CI 冒烟测试 — theforeveriris
- `17fdfe1` refactor(settings): 设置面板分组整理——语言/外观/阅读/工具与导出四大区块 — theforeveriris
- `aabc435` feat(ui): 「打开本地文件」改为单一入口 + 弹出式选择面板 — theforeveriris
- `0cd3dc6` feat(ui): 悬浮球菜单精简——去上下篇、合并本地文件入口、扫码弹窗去说明文字 — theforeveriris
- `04961df` feat: 长按收藏/树内足迹 + 链接悬浮预览 + 扫码续读；移除演示模式与页头图标 — theforeveriris
- `1e86d8b` feat: 文档演示模式 + CSV/TSV 表格 + IOS/VRP 高亮 + 历史收藏 + 阅读续读 + 全量离线 + 选区工具栏 + 分享卡片 — theforeveriris
- `9be029e` feat: 自动主题 + 本地文件夹 + 界面多语言 + 单文件 HTML 导出 + PlantUML 降级 — theforeveriris
## 2026-09-29

- `46e79b3` feat(ui): 搜索改造为居中命令面板（Ctrl/⌘+K） — theforeveriris
- `43003bf` feat(ui): 侧边栏标题显示 + 中文文件名解码 + 导航阅读进度重置 — theforeveriris
- `7ff069e` feat(ui): 全局快捷键扩展 + 快捷键文档 — theforeveriris
- `52e1578` feat(ui): 桌面端侧边栏折叠 + 内容区宽度可调 — theforeveriris
- `c576253` feat: 修复编辑器、XSS 与解析器共 22 处缺陷 — theforeveriris
## 2026-07-31

- `bb3ff1a` feat: 更新文档并创建系统演示 — theforeveriris
- `4ad2c06` feat: 更新文档并创建系统演示 — theforeveriris
- `b18a2da` Add files via upload — Iris
- `1ef2171` Create zhanweifu.png — Iris
- `4879ef3` chore(pptx): 移除示例文档中 example 演示及对应 data 产物 — theforeveriris
- `b99caed` feat: 分析打卡项目卡顿原因 — theforeveriris
- `075cc6d` feat(pptx): 新建 raw/pptx CI/CD 构建工作流，集成真实 PPTX 演示 — theforeveriris
- `3fce366` feat: 新增 PPTX 嵌入，参考 pkt 语法，支持缩略图网格+全屏放映 — theforeveriris
## 2026-07-22

- `7129817` fix: 语法说明代码块改用4反引号包裹避免内部反引号提前结束代码块 — theforeveriris
- `3f0c825` fix: 修复代码选项卡点击和代码块内语法误解析问题，重写示例文档 — theforeveriris
- `6747434` feat: 增加代码选项卡和分栏布局语法糖 — theforeveriris
- `655a9db` feat(spoiler): 添加 \|\|内容\|\| 遮罩/剧透语法支持 — theforeveriris
- `ebb9a5d` docs(pulse): 补充 pulsmini 迷你波形和波形生成器说明 — theforeveriris
- `1c610d1` feat(pulse): 添加竖线扫描线样式切换，修复代码块内标签渲染，更新示例文档 — theforeveriris
- `5cbe59d` feat(pulse): 更新为 DG-LAB 官方波形文件格式 — theforeveriris
- `8716213` feat: 文档站集成郊狼波形文件解析 — theforeveriris
## 2026-07-18

- `0b1b4b2` feat: Iris Plugin Development and Docs — omajili-manbu
## 2026-07-16

- `a5bd246` refactor(plugins): 重构插件系统 API，增强扩展能力与生命周期管理- 插件 loader 支持生命周期钩子（init/beforeRender/afterRender/destroy）- render 支持 async/await，内置错误边界与友好回退 UI- 新增 priority 优先级机制，解决多插件竞争冲突- 新增 context 上下文传递（documentPath、config、registerResource）- 简化 loadPlugin（直接使用 import(url)，移除 Blob 中间层）- autoLoad 新增 manifest/directory.json 策略，摆脱对目录列表的依赖- 重写 qrcode.js 作为 v2 API 参考实现- 更新 plugin-development.md 与 readme-dev.md 文档Co-authored-by: Kimi <kimi@moonshot.cn> — theforeveriris
- `c767dab` feat(ensp): 修复 eNSP XML 解析器并添加示例文档 — theforeveriris
## 2026-07-14

- `84d672d` license: 采用 AGPL-3.0 + CC-BY-SA-4.0 多许可证方案 — theforeveriris
- `db81c3f` fix(pkt): 修复 @[pkt] 嵌入语法不渲染的问题 — theforeveriris
- `5fbb165` fix(pkt): 修复 Twofish 解密 + XML 解析，添加真实拓扑示例 — trae
## 2026-07-13

- `01034be` docs(pkt): 更新文档，补充 Packet Tracer 拓扑渲染功能说明 — theforeveriris
- `a2247cf` feat(pkt): 新增 Packet Tracer .pkt 拓扑渲染功能 — theforeveriris
- `c5e67a6` feat(editor): 对照 examples 全面优化工具栏菜单覆盖度 — theforeveriris
- `ff4ce4e` docs: 新增编辑器说明文档，更新 README/readme-dev/features/feat — theforeveriris
- `1981224` fix(gallery): 修复移动端渲染问题，移除三种样式 — theforeveriris
- `032a9f6` feat(gallery): 删除 stamp，slider 改自动轮播，新增 4 种样式 — theforeveriris
- `8973da5` feat(gallery): editorial 改瀑布流，tape 改软木板，新增 3 种样式 — theforeveriris
- `8707338` feat(gallery): 删除 carousel，新增 4 种克制艺术风格 — theforeveriris
- `e1465b3` feat(gallery): 新增 5 种画廊布局样式 — theforeveriris
- `805452b` docs: 更新图片画廊示例文档 — theforeveriris
- `f74036d` feat(gallery): 支持通过 @style 标记指定画廊布局样式 — theforeveriris
- `d9fa764` feat(debug): 调试面板扩展为 6 分组实时监控 — theforeveriris
- `bb091b7` docs: 全面更新文档体系，反映近期所有功能更新 — theforeveriris
## 2026-07-11

- `a9635c8` chore: 清理根目录，移动 feat.md 到 docs/ — theforeveriris
## 2026-07-10

- `9e72bd6` feat: 添加代码高亮和代码块复制功能 — theforeveriris
- `2429e19` docs: 添加插件开发指南 — theforeveriris
## 2026-07-09

- `5906c31` docs: 重写项目文档，更新为当前实际代码结构 — github-actions[bot]
- `f121401` docs: 更新表格示例文档，添加使用提示 — theforeveriris
- `61ac951` docs: 添加表格使用示例文档 — theforeveriris
## 2026-05-24

- `5b54ffa` chore: remove giscus comments system — theforeveriris
- `d8e6ff3` Remove music notation rendering feature — theforeveriris
- `2382f27` Fix: use specific language types for embed rendering — theforeveriris
- `257b786` 调整示例文档格式：源码在代码块中，渲染效果直接显示 — theforeveriris
- `8fd67e9` 互换示例文档中的源码和渲染效果位置 — theforeveriris
- `2612ded` 完善项目文档系统 — theforeveriris
- `5fab43b` Add theme market system with 7 built-in themes and custom CSS support — theforeveriris
- `6d20886` 实现插件系统和二维码生成插件 — theforeveriris
## 2026-05-22

- `24b683f` 更新 latex-examples.md — 鸢尾
- `8f28f92` 更新 latex-examples.md — 鸢尾
- `0a28b8a` fix: 修复 katex.js 渲染器，直接处理 katex-block div — theforeveriris
- `5f4b91c` feat: 添加 LaTeX 公式支持 (KaTeX) — theforeveriris
- `2a3dd2f` Add image lazy loading, gallery mode, and error fallback — theforeveriris
- `8b07160` Add GitHub-style Alerts feature — theforeveriris
- `efb80a2` Refactor: Update geojson and twitter examples to match embed examples format — theforeveriris
- `7faffcb` 更新 embed-examples.md — 鸢尾
- `983f78f` 更新 embed-examples.md — 鸢尾
- `edce270` 更新 embed-examples.md — 鸢尾
- `e70ab11` 更新 embed-examples.md — 鸢尾
- `7b5258e` 更新 embed-examples.md — 鸢尾
- `d9b4484` 更新 embed-examples.md — 鸢尾
- `912867c` 更新 embed-examples.md — 鸢尾
- `de9ab65` 更新 embed-examples.md — 鸢尾
## 2026-05-21

- `825e378` docs: 从markdown语法说明中删除重复的Mermaid图表内容 — theforeveriris
## 2026-05-20

- `ba8fa4f` 添加 Twitter/X 嵌入功能 — theforeveriris
- `670479e` 添加 Git Diff 可视化功能 (diff2html) — theforeveriris
- `00dfa72` 添加 OSMD 乐谱渲染功能 — theforeveriris
- `4fcd83d` feat: 添加乐谱渲染支持 (ABC记谱法、MusicXML) — theforeveriris
- `4358df1` fix: 修正 ApexCharts 示例文档的代码块类型，源码改为txt — theforeveriris
- `7e3ecd6` feat: 添加 ApexCharts 交互式图表支持 — theforeveriris
- `dd07edc` feat: 添加浏览器原生 HTML 元素与 Web API 支持 — theforeveriris
- `5f66906` feat: 添加 GeoJSON/TopoJSON 地理数据可视化功能 — theforeveriris
- `0fcc181` feat: 添加外部服务嵌入功能 — theforeveriris
- `f1a3caf` fix: 修复多个 PlantUML 图表语法问题 — theforeveriris
- `71c8ca3` fix: 修复多个 PlantUML 图表渲染问题 — theforeveriris
- `b7abb03` feat: 添加 PlantUML 图表渲染支持 — theforeveriris
- `fcd3d01` 更新 mermaid-examples.md — 鸢尾
- `97bc72a` 更新 mermaid-examples.md — 鸢尾
- `98fdf21` 更新 mermaid-examples.md — 鸢尾
- `abb130f` fix: 严格修复四象限图、块图、XY图表的Mermaid语法 — theforeveriris
- `0165e88` Fix all mermaid source code blocks using txt format — theforeveriris
- `ad631e1` 更新 mermaid-examples.md — 鸢尾
- `f8c8f63` 添加完整的 Mermaid 图表示例文档 — theforeveriris
- `7738f7f` 添加 Mermaid 图表支持 — agelaia521
## 2026-05-19

- `e41fb66` 更新 Markdown 语法参考页面，添加每种语法的渲染效果预览 — agelaia521
- `2a992d1` 修复文档中的相对链接 — theforeveriris
- `f1be494` 更新所有文档 - 反映自动发现功能 — theforeveriris
- `b1eecd4` Add multi-level documentation structure with test files — theforeveriris
- `4a49e3b` Initial commit: Markdown previewer for GitHub Pages — agelaia521

> 共 132 条（最多展示 200 条）。
