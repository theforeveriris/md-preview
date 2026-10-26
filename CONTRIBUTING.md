# 贡献指南

感谢你愿意为 Markdown Preview 出一份力。

这是一个**纯静态、零构建**的前端文档站：没有打包器、没有后端、运行时零 npm 依赖。
所有依赖都 vendor 在 `iris/vendor/`，由 `index.html` 按需加载。这带来一些不常见的约束，
本文档会把它们讲清楚 —— **先读「架构约定」，再动手，能省掉很多返工。**

- 想了解项目本身怎么跑起来的 → [readme-dev.md](readme-dev.md)
- 想写插件 → [docs/plugin-development.md](docs/plugin-development.md)
- 想加渲染器 / 主题 → 本文「加一个渲染器」「加一个主题」

---

## 目录

- [快速上手](#快速上手)
- [架构约定（动手前必读）](#架构约定-动手前必读)
- [提交 PR](#提交-pr)
- [CI 会检查什么](#ci-会检查什么)
- [代码规范](#代码规范)
- [加一个渲染器](#加一个渲染器)
- [加一个主题](#加一个主题)
- [加一个插件](#加一个插件)
- [写文档](#写文档)
- [常见坑](#常见坑)
- [许可与署名](#许可与署名)

---

## 快速上手

### 本地预览

```bash
git clone https://github.com/theforeveriris/md-preview.git
cd md-preview

# 用简单静态服务器打开（不要用 file://）
python3 -m http.server 8080
# 访问 http://localhost:8080/
```

> 直接双击 `index.html` 会被 Service Worker、CORS、`fetch` 本地文件卡住。
> 必须走 HTTP。

### 常用构建脚本

改完代码后，按需重建数据产物（都是可选的，不重建时运行时会回退到 GitHub API）：

```bash
node iris/scripts/build-file-tree.js       # 侧边栏文件树
node iris/scripts/build-search-index.js   # 全文搜索索引
node iris/scripts/build-links.js          # 图谱 / 反向链接
node iris/scripts/build-feed.js           # RSS feed
node iris/scripts/build-sitemap.js        # sitemap
node iris/scripts/link-check.js           # 死链检查（内链全量 + 外链抽查）
```

### 自检

提交前至少跑这两个：

```bash
node iris/scripts/smoke-test.js           # 语法 + 结构 + i18n + 数据产物
node iris/scripts/lint-cjk.js             # 中文排版检查（只报告）
```

`smoke-test.js` 依赖 jsdom：

```bash
npm install --no-save --prefix iris jsdom@^29.1.1
```

---

## 架构约定（动手前必读）

这几条是**刻意选择**，不是遗留代码。改动前请先评估连带影响。

### 1. 模块系统：传统 `<script>` + IIFE，不是 ES module

全部运行时 JS 用 `<script defer src="iris/js/xxx.js">` 加载，文件内容是 IIFE
（立即执行函数表达式），通过 `window.MarkdownPreview` 命名空间对外暴露：

```js
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  // ...
})();
```

**不要**：

- 改用 ES module / `import` / `export`
- 把 IIFE 里的东西抽到顶层作用域（顶层 `const`/`let` 会污染全局并相互覆盖）
- 调整 `index.html` 里的 `<script>` 加载顺序

**为什么**：

- `index.html` 的 script 标签数量随功能增减（当前约 70 个）+ 17 个渲染器，加载顺序有严格约束（可用 `node iris/scripts/check-script-order.js` 门禁校验）
  （`md-render.js` 必须先于所有引用 `mdRender` 的模块，由
  `iris/scripts/check-script-order.js` 检查）
- 模块间通过 `window.MarkdownPreview` 通信，且支持**运行时动态加载**
  （`dom.js` 会按需加载样式与工具），与 ESM 的静态 import 图不兼容
- 同一份 JS 要同时被浏览器和 Node 构建脚本复用 ——
  `iris/js/name-sort.js` 浏览器用 `<script>`、Node 用 `require`
- `type="module"` 加载失败是**静默的**，排查成本极高

### 2. 顶层变量

- 跨模块通信一律走 `window.MarkdownPreview.<module>`，不要新增全局变量
- 老文件里存在 `var`，**新增**代码用 `const` / `let` 即可；
  不要建议批量重写已有 `var`（无收益的大范围改动）

### 3. 纯静态、零构建

- 没有打包器，没有运行时 npm 依赖
- 引入第三方库必须 vendor 进 `iris/vendor/` 并在 `index.html` 里按需加载
- **不要**建议：npm 安装依赖 / 引入构建步骤 / 改用 TypeScript / 用框架重写

### 4. 界面文案必须双语齐备

任何用户可见文案都要**同时**加进 `iris/js/i18n.js` 的 `zh` 与 `en` 两段，key 命名一致。

- `index.html` 上的静态文案 → 用 `data-i18n` 系列属性标记
  （`data-i18n` / `data-i18n-title` / `data-i18n-aria` / `data-i18n-placeholder`）
- JS 动态生成的文案 → `MarkdownPreview.t(key, fallback)`，`fallback` 写中文原文
- 漏了英文是**必须修**的问题（`smoke-test.js` 会检查 `data-i18n` 的 key 齐备性）

### 5. 设置项要同步四处

新增设置项时，下面四个地方都要改：

1. `iris/js/settings.js` 的 `defaultSettings`
2. `load()` 里的取值逻辑
3. `applyAllSettings()` 里的控件回填
4. `iris/js/i18n.js` 的 zh / en 文案

设置持久化在 `localStorage('md-preview-settings')`。

### 6. 脚本里操作 git 的注意事项

读取文件列表 / 路径时**必须加 `-c core.quotePath=false`**：

```js
git(['-c', 'core.quotePath=false', 'diff', '--name-only'])
```

git 默认对非 ASCII 路径做八进制转义，输出形如 `docs/\346\226\207.md`，
该路径在磁盘上不存在 —— 会导致**中文文件名被静默漏检**（本项目踩过这个坑）。

### 7. 通用工具：直接用，别再写本地副本

新增代码请直接用这些既有实现，不要另写一份：

| 工具 | 用途 |
|---|---|
| `mdRender.escapeHtml(s)` | HTML 转义（推荐用这个） |
| `mdRender.slugify(text)` | 标题锚点 slug（`markdown.js` 与 `split-view.js` 共用） |
| `MarkdownPreview.t(key, fallback)` | i18n 文案 |
| `markdown.parseFrontmatter(md)` | frontmatter 解析 |
| `markdown.extractExcerpt(md)` | 摘要提取 |

> 已知还有两处本地副本，**新代码不要跟着抄**：
> `iris/js/palette.js` 的 `escapeHtml`（用 DOM 转义，实现不同）、
> `iris/js/pkt/pkt-renderer.js` 的 `escapeHtml`（只转义 `& < >`，不转义引号）。
>
> `link-check.js` 在 Node 侧有一份 `slugify` 副本，注释里指向了 `markdown.js`，
> 改动规则时**两处要同步**。

### 8. 共享纯函数放 `iris/scripts/lib/`

避免多份副本漂移。参考 `iris/scripts/lib/md-links.js`（`build-links.js` 与
`link-check.js` 共用同一套 Markdown 链接解析）。

---

## 提交 PR

### 流程

1. Fork 仓库，开分支（分支名随意，建议 `feat/xxx`、`fix/xxx`）
2. 改动 → 本地自检（`smoke-test.js` + `lint-cjk.js`）
3. 推送到你的 Fork
4. 在上游开 PR

**建议**：开 PR 前先在 PR 描述里写清楚**改了什么**和**为什么**。
本项目的维护者会看 diff，描述能省掉很多来回。

### 分支与提交信息

- 一个 PR 聚焦一件事，别把重构和功能混在一起
- 提交信息用中文，遵循 Conventional Commits 前缀：

  ```
  feat(file-tree): 新增侧边栏排序策略
  fix(cjk-lint): 修复中文文件名被 git 转义导致漏检
  docs(readme): 补充构建脚本说明
  refactor(name-sort): 清理未使用的导出
  chore(ci): 修正工作流配置
  ```

  常见前缀：`feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `chore` / `ci` / `style`

- 中文文案提交信息末尾加 `[skip ci]`，避免机器人提交触发新一轮流水线

### AI 代码审查

仓库配置了 [CodeRabbit](https://www.coderabbit.ai)（公开仓库免费），
PR 打开 / 更新时会自动审查并发行内评论。**只评论，不自动批准、不阻断合并** ——
合并决策权始终在维护者手里。

它的审查范围与规则见 `.coderabbit.yaml`（含 `path_instructions`：
本项目的架构约定、哪些路径会被审查、哪些是构建产物）。

想让它做别的事，在 PR 里 `@coderabbitai` 就行。

### 人工审查

看 diff 的时候，维护者大概会关注这些：

- 改动是否真的解决了提出的问题（有没有夹带无关改动）
- 有没有破坏上面那 8 条架构约定
- 边界条件、异步竞态、事件监听未解绑、资源未释放
- 跨 Shadow DOM 的访问方式是否正确
- 拼接 HTML 前是否转义
- 新增界面文案的中英文是否齐备

---

## CI 会检查什么

| 工作流 | 触发条件 | 检查内容 |
|---|---|---|
| `smoke-test.yml` | push / PR 到 `main` | 全部构建脚本 + 冒烟测试 + 死链检查 + CodeRabbit 配置校验 |
| `cjk-typography-lint.yml` | push / PR 且 `**/*.md` 变化 | 中文排版校验；`main` 上自动修正并由机器人提交 |
| `build-*.yml` | 按路径触发 | 重建数据产物并提交回仓库 |

### 冒烟测试（`iris/scripts/smoke-test.js`）分 5 项

1. **语法检查** —— 全部第一方 JS 用 `vm.Script` 解析，任何语法错误直接失败
2. **index.html 结构** —— 关键骨架节点存在；每个 `<script src>` / 本地 `<link href>`
   在磁盘上真实存在（引用 404 是运行时白屏的头号来源）
3. **i18n 完整性** —— `index.html` 里所有 `data-i18n*` 的 key 都必须在 zh 语言包里有翻译
4. **数据产物** —— `file-tree.json` / `search-index.json` / `precache-manifest.json`
   可解析；precache 引用的文件都存在；`feed.xml` / `sitemap.xml` 结构正确
5. **文件树自然排序** —— 回归测试（`iris/scripts/test-file-tree-sort.js`）

### 中文排版校验

依据《[中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines)》，
由 `iris/scripts/lint-cjk.js` 检查：

| 规则 | 可自动修复 | 说明 |
|---|---|---|
| `spacing` | ✅ | 中英文 / 数字之间加空格 |
| `unit` | ✅ | 数字与单位之间加空格（`10 Gbps`；`%` / `°` 例外） |
| `punct` | ✅ | 中文后用全角标点 |
| `punct-space` | ✅ | 全角标点旁不加空格 |
| `dup-punct` | ✅ | 不重复使用标点 |
| `fullwidth-digit` | ✅ | 数字用半角 |
| `line-start` | ❌ | 行首禁则（移动标点会改变语义） |
| `quote` | ❌ | 中文旁的直引号（需判断是引号还是配置片段） |

**注意**：

- 行内代码、链接、图片、URL、HTML 标签、代码围栏、frontmatter、HTML 注释
  一律跳过，不会被改
- 代码围栏内按「安全片段」切分，只修复普通文本部分
- 标 `[manual]` 的是需人工处理的（行首禁则 / 直引号），只报告不阻断
- 退出码只对「本该被自动修掉却还在」的问题返回 1

本地可 `--fix` 自动修复：

```bash
node iris/scripts/lint-cjk.js --fix
```

### 并发推送

多个工作流会同时向 `main` 推送。写工作流时如果涉及提交与推送，
**必须处理 non-fast-forward**：

```bash
for i in 1 2 3 4 5; do
  if git push origin "HEAD:refs/heads/$BRANCH"; then exit 0; fi
  git fetch origin "$BRANCH"
  git rebase "origin/$BRANCH" || { git rebase --abort; exit 1; }
done
```

> 别用 `EndBug/add-and-commit` 的默认配置：它的执行顺序是
> `add → pull → commit → push`，只要暂存了改动，随后的 `git pull --rebase`
> 就会报 `cannot pull with rebase: Your index contains uncommitted changes`。

---

## 代码规范

没有 ESLint 配置，风格靠约定 + `smoke-test.js` 的语法检查兜底。

- **缩进**：2 空格
- **分号**：语句结尾加分号
- **引号**：单引号（HTML 属性、JSON、模板字符串除外）
- **文件编码**：UTF-8，**不带 BOM**
- **换行符**：项目自有文件统一 LF（`iris/vendor/` 下的第三方文件维持原样，不要动）
- **注释**：解释「为什么」，不解释「是什么」

### 中文注释

本项目源码注释是中文。写新代码时保持一致 —— 注释说明设计意图，
这类信息读代码是读不出来的。

---

## 加一个渲染器

渲染器处理特定代码块 / 指令，约定见 `readme-dev.md` 的「渲染器（Renderer）」。

1. 在 `iris/js/renderers/` 新建文件
2. 注册到全局注册表：

   ```js
   window.MarkdownPreview.renderers.<id> = { render };
   ```

3. 在 `index.html` 引入脚本（**加载顺序即执行顺序**）
4. 实现 `render(root?)`：
   - `root` 是本次渲染的根容器；文档站主管线传 `null`，
     自行回退到全局 `.markdown-body`
   - 编辑器 cell / 对照阅读栏会传入自己的容器，也可用 `opts.only` 只执行子集
   - **查询 DOM 无命中直接 return**，避免无谓加载 vendor 库
   - 返回 Promise 或 undefined
   - 抛错会被调度器隔离，不影响其余渲染器

5. 依赖的第三方库**按需加载**（在渲染器里动态注入 `<script>` / `<link>`），
   不要在 `index.html` 里无条件引入

---

## 加一个主题

主题的色值定义在 `iris/css/themes/themes.css`（形如 `[data-theme="github-light"]`），
应用逻辑在 `iris/js/themes/theme-manager.js`。

- 颜色一律用 CSS 变量（`--color-*`），不要写死颜色值
- 变量清单见 `readme-dev.md` 的「CSS 变量约定」
- 新增主题要同步三处：`iris/css/themes/themes.css`（色值）、
  `iris/js/themes/theme-manager.js`（主题元信息）、
  `index.html` 的 `<select id="themeSelect">`（设置面板下拉项）

---

## 加一个插件

详见 [docs/plugin-development.md](docs/plugin-development.md)。

**插件是本项目里唯一使用 ES Module 的地方** —— 加载器
`iris/js/plugins/loader.js` 用 `import()` 动态加载它们，所以插件可以写
`export default { ... }`。这一点与「运行时 JS 一律用传统 `<script>`」的约定不冲突：
插件走独立的动态加载通道，不进 `index.html` 的 script 标签。

插件对象提供的钩子：

| 成员 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 唯一标识 |
| `description` | | 描述信息 |
| `priority` | | 优先级，默认 0，越大越优先 |
| `init(config)` | | 初始化，接收 `config.json` 里的配置 |
| `test(code, language)` | | 判断是否处理该代码块，默认 `language === name` |
| `beforeRender(code, container, context)` | | 渲染前钩子 |
| `render(code, container, context)` | ✅ | 渲染内容到容器，可 async |
| `afterRender(container, context)` | | 渲染后钩子 |
| `destroy()` | | 清理资源 |

新插件文件放进 `iris/plugins/`。

`iris/plugins/directory.json` 是插件索引，运行时由 `iris/js/plugins/loader.js`
读取（`docs/plugin-development.md` 建议在 CI 里生成它）。

> **现状**：本仓库目前是**手动维护**这个文件的（`description` 里虽写着
> "Auto-generated"，但没有对应的工作流）。所以提 PR 时**请一并把新插件的文件名
> 加进 `directory.json` 的 `files` 数组**，否则运行时不会加载你的插件。
>
> 加载器有三级回退：`config.plugins.manifest` → `directory.json` → 目录扫描
> （部分静态托管不支持目录扫描，所以前两级更可靠）。

---

## 写文档

文档放 `docs/`，会被构建进站点文件树与搜索索引。

- **frontmatter** 至少写 `title`（侧边栏显示用），可选 `tags`：

  ```yaml
  ---
  title: 我的文档
  tags: [指南]
  ---
  ```

- **中文排版**遵循《中文文案排版指北》，CI 会自动校验并修正
  （中英文之间加空格、中文用全角标点、代码与链接不计入等）
- **链接**用相对路径，指向同目录或上级目录的文件；锚点用中文标题时
  `link-check.js` 会按运行时 slug 规则校验
- **代码示例**用围栏标注语言，并考虑用四反引号包裹含三反引号的内容
- **图片**放 `docs/` 下的合适目录，相对路径引用

---

## 常见坑

### 改了 `iris/js/` 但页面没变化

Service Worker 缓存。`sw.js` 顶部有 `CACHE_NAME` 和 `RUNTIME_CACHE` 两个版本号，
**发布时两个都要递增**，否则旧缓存会一直存活。

调试时可以直接 `?debug=1` 打开 Debug Panel（右下角），查看缓存与网络状态。

### 构建脚本扫到了 `dist/`

`build-file-tree` / `build-links` / `gen-pinyin-table` / `link-check`
的目录排除表都已加入 `dist` 与 `src-tauri`。新增构建脚本时记得也排除掉。

### 改了 `index.html` 的 script 顺序

`node iris/scripts/check-script-order.js` 会检查。
`md-render.js` 必须先于所有在顶层引用 `mdRender` 的模块。

### 改坏了文件树排序

`iris/js/name-sort.js` 是运行时与构建期**共用**的排序实现，改动要同时验证两边。
回归测试：`node iris/scripts/test-file-tree-sort.js`。

### 中文字体名

`Intl.Collator` 的 `caseFirst` / `numeric` 选项影响文件名排序结果，
改比较器选项时注意跨浏览器、跨平台的一致性。

### 桌面端（Tauri）

`npm run desktop:dist` 打包资源，`npm run desktop:build` 走 Tauri 完整构建。
NSIS 首次打包需要联网下载工具链，超时的手动处理步骤见 `readme-dev.md` 的「常见坑」。

---

## 许可与署名

本项目采用**代码与内容分离**的多许可证方案：

| 范围 | 许可证 |
|------|--------|
| 项目源代码（`iris/` 目录） | [AGPL-3.0](./LICENSE) |
| 文档内容（`docs/` 目录） | [CC-BY-SA-4.0](./docs/LICENSE) |
| 第三方依赖 | 各自原有许可证（见 [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES)） |

- 贡献代码即表示同意以 **AGPL-3.0** 授权你的改动
- 贡献文档内容即表示同意以 **CC-BY-SA-4.0** 授权
- 引入新的第三方库时，**必须**同步更新 `THIRD_PARTY_LICENSES`
  （写明库名、版本、许可证、用途、来源链接）
- 不要直接复制粘贴来源不明的代码片段

---

## 提问

- 架构、构建、渲染器、桌面端 → 看 [readme-dev.md](readme-dev.md)
- 插件 → 看 [docs/plugin-development.md](docs/plugin-development.md)
- 功能需求与候选池 → 看 [docs/requirements.md](docs/requirements.md)
- 正式规划 → 看 [docs/roadmap.md](docs/roadmap.md)
- 其它 → 开 issue 讨论

任何问题都欢迎先开 issue 聊清楚再动手，能少走很多弯路。

## docs/zw/ 测试夹具目录

`docs/zw/` 是中文排版 lint（cjk-typography-lint.yml）的故意写错样例目录，
**不属于站点内容**——构建脚本（file-tree / search-index / feed / sitemap）已排除。
修改排版 lint 规则时，用这些样例验证检出效果；新增样例 frontmatter 带 `tags: [测试]`。
