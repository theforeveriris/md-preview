/**
 * i18n - 界面多语言（zh / en）
 *
 * 设计：
 *   - 语言包在下方字典中维护，zh 为基准语言（key 缺失时回退 zh）
 *   - 静态 HTML 文案通过 data-i18n（textContent）/ data-i18n-title /
 *     data-i18n-aria（aria-label）/ data-i18n-placeholder 属性标记，
 *     apply() 按当前语言批量替换
 *   - JS 动态生成的文案通过 t(key, fallback) 取词，fallback 为中文原文，
 *     保证 i18n 模块缺失或 key 未登记时界面不至于空缺
 *   - 语言选择持久化在 localStorage('md-preview-lang')：
 *     'auto'（默认，跟随浏览器语言）/ 'zh' / 'en'
 *   - 切换语言后广播 'langchange' 事件，动态渲染的模块（本地文件面板等）
 *     监听后自行重渲染
 *
 * 迁移说明：编辑器（editor.js 工具栏/菜单）文案暂未纳入语言包，
 * 仍为中文；后续可按 data-i18n + t() 模式逐步迁移。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const LANG_KEY = 'md-preview-lang';

  const zh = {
    // 通用
    'common.reset': '重置',
    'common.close': '关闭',

    // 侧边栏
    'sidebar.searchPlaceholder': '搜索文档…',
    'sidebar.searchAria': '搜索文档',
    'sidebar.localTitle': '本地文件',
    'sidebar.localClear': '清空本地文件列表',

    // 悬浮球菜单
    'menu.backToTop': '回到顶部',
    'menu.prev': '上一篇',
    'menu.next': '下一篇',
    'menu.openLocalMd': '打开本地 MD',
    'menu.openLocalFolder': '打开本地文件夹',
    'menu.installPwa': '安装到桌面',
    'menu.editPage': '编辑此页',
    'menu.settings': '设置',

    // 设置面板：骨架
    'settings.title': '设置',
    'settings.section.language': '语言',
    'settings.section.appearance': '外观',
    'settings.section.features': '功能',
    'settings.sub.theme': '主题',
    'settings.sub.colors': '自定义配色',
    'settings.sub.codeHighlight': '代码高亮',
    'settings.sub.font': '字体',
    'settings.sub.advanced': '高级',
    'settings.sub.display': '显示',
    'settings.sub.actions': '操作',

    // 语言
    'settings.lang.label': '界面语言',
    'settings.lang.desc': '切换界面显示语言，选择「自动」时跟随浏览器语言',
    'settings.lang.auto': '自动（跟随浏览器）',

    // 主题
    'settings.theme.label': '预设主题',
    'settings.theme.desc': '选择预设界面主题，会清空自定义配色',
    'settings.theme.auto': '自动（跟随系统）',
    'settings.theme.autoPair': '自动主题配对',
    'settings.theme.autoPairDesc': '系统亮色时使用亮色主题，暗色时使用暗色主题',
    'settings.theme.autoLight.default': '亮 · 紫粉渐变',
    'settings.theme.autoLight.github': '亮 · GitHub Light',
    'settings.theme.autoLight.notion': '亮 · Notion',
    'settings.theme.autoDark.github': '暗 · GitHub Dark',
    'settings.theme.autoDark.arc': '暗 · Arc Dark',
    'settings.theme.autoDark.dracula': '暗 · Dracula',
    'settings.theme.autoDark.nord': '暗 · Nord',
    'settings.theme.default': '紫粉渐变',

    // 自定义配色
    'settings.colors.accent': '强调色',
    'settings.colors.accentDesc': '主色及派生色，点击色块取色',
    'settings.colors.main': '主色',
    'settings.colors.pink': '粉色',
    'settings.colors.deep': '深色',
    'settings.colors.neutral': '中性色',
    'settings.colors.neutralDesc': '背景、表面、文字与边框色，可做出亮色或暗色主题',
    'settings.colors.bg': '背景',
    'settings.colors.surface': '表面',
    'settings.colors.border': '边框',
    'settings.colors.text': '文字',
    'settings.colors.muted': '次要',
    'colorTitle.main': '主色 (--color-accent-purple)',
    'colorTitle.pink': '粉色 (--color-accent-pink)',
    'colorTitle.deep': '深色 (--color-accent-purple-deep)',
    'colorTitle.bg': '背景 (--color-bg)',
    'colorTitle.surface': '表面 (--color-surface)',
    'colorTitle.border': '边框 (--color-border)',
    'colorTitle.text': '文字 (--color-text)',
    'colorTitle.muted': '次要文字 (--color-text-muted)',

    // 代码高亮
    'settings.code.label': '代码配色方案',
    'settings.code.desc': '选择代码块语法高亮主题',

    // 字体
    'settings.font.remote': '远程字体 URL',
    'settings.font.remoteDesc': '加载远程字体，支持 Google Fonts 样式的 CSS URL（例：https://fonts.googleapis.com/css2?family=Noto+Sans+SC）。回车或失去焦点后应用，留空则禁用',
    'settings.font.display': '展示字体族（标题等衬线体）',
    'settings.font.displayDesc': '设置 CSS font-family，多个字体用英文逗号分隔；远程字体加载完毕后可直接填字体名',
    'settings.font.body': '正文字体族（UI/正文无衬线体）',
    'settings.font.bodyDesc': '设置 CSS font-family，多个字体用英文逗号分隔',
    'settings.font.size': '字号',
    'settings.font.sizeDesc': '控制界面与 Markdown 正文字号（单位 px）',
    'settings.font.sizeUi': 'UI 字号',
    'settings.font.sizeBody': '正文',
    'settings.font.weight': '字重',
    'settings.font.weightDesc': '控制字体粗细（300 细 / 400 常规 / 500 中等 / 600 半粗 / 700 粗体）',
    'settings.font.weightDisplay': '展示体',
    'weight.300': '300 细',
    'weight.400': '400 常规',
    'weight.500': '500 中等',
    'weight.600': '600 半粗',
    'weight.700': '700 粗',
    'weight.800': '800 特粗',
    'settings.font.color': '字色',
    'settings.font.colorDesc': '主文字与次要文字颜色；强调色（链接、高亮等）在上方「自定义配色」调节',
    'settings.font.colorBody': '正文',
    'settings.font.colorMuted': '次要',
    'settings.font.resetFont': '重置字体',
    'settings.font.sansDigits': '标题数字使用无衬线字体',
    'settings.font.sansDigitsDesc': '默认关闭，标题数字随标题字体（默认衬线体，数字同为衬线）；开启后仅标题中的阿拉伯数字改用无衬线字体渲染，其余文字不受影响',

    // 高级
    'settings.adv.customCss': '自定义 CSS',
    'settings.adv.customCssDesc': '加载外部 CSS 文件 URL，回车应用',
    'settings.adv.customCssPlaceholder': 'CSS 文件 URL',
    'settings.adv.customHljs': '自定义高亮 JS',
    'settings.adv.customHljsDesc': '加载外部 highlight.js 主题 CSS URL，回车应用',
    'settings.adv.customHljsPlaceholder': 'hljs 主题 CSS URL',

    // 显示
    'settings.display.readingProgress': '显示阅读进度',
    'settings.display.readingProgressDesc': '显示页面阅读进度',
    'settings.display.wordCount': '显示词数统计',
    'settings.display.wordCountDesc': '在文件列表中显示每个文件的词数',
    'settings.display.truncate': '折叠过长文件名',
    'settings.display.truncateDesc': '开启时用省略号截断；关闭时显示完整文件名，超出部分可在该文件所在文件夹区域内横向滚动查看',
    'settings.display.contentWidth': '内容区宽度',
    'settings.display.contentWidthDesc': '调整 Markdown 正文的最大宽度，拖动即时生效；快捷键 Ctrl/⌘+B 可折叠侧边栏获得更宽空间',
    'settings.display.tableBleed': '长表格延伸到右侧空白',
    'settings.display.tableBleedDesc': '内容宽度设置保持不变，宽表格向右适度越过正文边界、利用右侧空白显示更多列；仍放不下的部分在表格内横向滚动',

    // 操作
    'settings.actions.editor': 'Markdown 编辑器',
    'settings.actions.editorDesc': '在新标签页打开交互式编辑器，支持语法快速输入和实时渲染',
    'settings.actions.openEditor': '打开编辑器',
    'settings.actions.pulseGen': '波形生成器',
    'settings.actions.pulseGenDesc': '可视化生成 DG-LAB 郊狼 .pulse 波形文件，最多 20 个',
    'settings.actions.openPulseGen': '打开生成器',
    'settings.actions.downloadMd': '下载此文章',
    'settings.actions.downloadMdDesc': '下载当前文档为 MD 格式',
    'settings.actions.downloadMdBtn': '下载 MD',
    'settings.actions.exportPdf': '导出 PDF',
    'settings.actions.exportPdfDesc': '通过浏览器打印对话框导出为 PDF',
    'settings.actions.exportPdfBtn': '导出 PDF',
    'settings.actions.exportHtml': '导出 HTML',
    'settings.actions.exportHtmlDesc': '保存为内联当前主题样式的单文件 HTML，双击即可离线查看',
    'settings.actions.exportHtmlBtn': '导出 HTML',

    // 欢迎页 / 更新提示 / 搜索面板
    'welcome.text': '选择一个文件开始阅读',
    'toast.update': '有新版本可用',
    'toast.refresh': '刷新',
    'palette.placeholder': '搜索文档...',
    'palette.clear': '清空搜索词',
    'palette.dialog': '搜索文档',

    // 动态文案：markdown 渲染
    'md.readingTime': '预计阅读 {n} 分钟',
    'md.loadFailed': '无法加载文件',
    'md.welcome': '选择一个文件开始阅读',
    'md.copyAnchor': '复制此标题的直达链接',
    'md.noIndex': '当前文件无目录',
    'md.defaultDescription': '一个简洁优雅的 Markdown 文档预览站点，支持多种渲染功能',
    'footnote.description': '脚注',
    'footnote.backRef': '返回引用 {0}',

    // 动态文案：搜索 / 文件树
    'search.noResults': '没有找到相关文档',
    'tree.loadFailed': '无法加载文件列表，请检查网络或手动配置',
    'tree.componentFailed': '文件树组件加载失败',

    // 动态文案：内容右键菜单 / 表格手柄
    'ctx.copied': '已复制',
    'ctx.copyLatex': '复制 LaTeX 公式',
    'ctx.tableOps': '表格操作',
    'ctx.downloadImage': '下载图片',
    'ctx.copyMd': '复制 Markdown 源码',
    'ctx.copyCsv': '复制 CSV',

    // 动态文案：导出
    'export.needDoc': '请先打开一个文档',
    'export.downloadFailed': '下载失败，请重试',

    // 动态文案：本地文件 / 本地文件夹
    'local.title': '本地文件',
    'local.remove': '从列表移除',
    'local.removeAria': '移除 ',
    'local.tooLarge': '（超过 10MB）',
    'local.tooLargeOpen': '（超过 10MB，无法打开）',
    'local.readFailed': '（读取失败）',
    'local.listFull': '（列表已满 20 个）',
    'local.skippedFiles': '以下文件未加入列表：\n',
    'local.folderEmpty': '该文件夹内没有找到 .md 文件',
    'local.folderFull': '（超出 500 个文件上限）',
    'local.folderReplaceConfirm': '打开新文件夹将替换当前本地文件列表，是否继续？',
    'local.folderUnsupported': '当前浏览器不支持打开文件夹，请使用多选文件的方式',
    'wordCount.unit': ' words',

    // 动态文案：PlantUML
    'plantuml.renderFailed': 'PlantUML 渲染服务均不可用，已回退为源码展示',
    'plantuml.renderError': 'PlantUML 渲染错误',
    'plantuml.openInEditor': '在 PlantUML 在线编辑器中打开',

    // 动态文案：收藏（长按文件树）与悬浮预览
    'fav.added': '已收藏《{t}》',
    'fav.removed': '已取消收藏《{t}》',
    'preview.loading': '加载中…',
    'preview.noExcerpt': '（暂无摘要）',

    // 动态文案：扫码续读（悬浮球）
    'menu.qrShare': '扫码续读',
    'qr.title': '扫码续读',
    'qr.hint': '用手机扫码，接着读当前文档',
    'qr.position': '当前读到 {pct}%，手机打开后将定位到此处',
    'qr.fromTop': '手机打开后将从头开始阅读',

    // 动态文案：阅读位置续读
    'reading.resume': '上次读到 {pct}%，继续？',
    'reading.resumeGo': '继续阅读',
    'reading.resumeDismiss': '忽略',

    // 动态文案：选中文字浮动工具栏
    'sel.copy': '复制',
    'sel.search': '站内搜索',
    'sel.card': '分享卡片',

    // 动态文案：CSV / TSV 交互表格
    'csv.searchPlaceholder': '搜索表格…',
    'csv.rowCount': '{n} 行',
    'csv.filteredCount': '{m} / {n} 行',
    'csv.copyCsv': '复制 CSV',
    'csv.downloadCsv': '下载 CSV',
    'csv.sort': '排序',
    'csv.filter': '按列筛选',
    'csv.filterBy': '筛选',
    'csv.selectAll': '全选',
    'csv.clearFilter': '清除',
    'csv.empty': '没有匹配的行',
    'csv.untitled': '列',

    // 动态文案：设置面板 · 全量离线缓存
    'settings.offline.label': '全量离线缓存',
    'settings.offline.desc': '把文件树覆盖的所有文档拉进 PWA 缓存，离线也能整站阅读',
    'settings.offline.btn': '缓存全部文档',
    'settings.offline.progress': '缓存中 {done}/{total}…',
    'settings.offline.done': '已缓存 {n} 篇文档，离线也能整站阅读',
    'settings.offline.doneFailed': '已缓存 {done} 篇文档（{failed} 篇失败）',
    'settings.offline.clear': '清除文档缓存',
    'settings.offline.cleared': '已清除全部文档缓存',
    'settings.offline.unsupported': '当前环境不支持 Service Worker（需通过 HTTPS 部署访问后使用）',
    'settings.offline.failed': '缓存失败，请稍后重试'
  };

  const en = {
    'common.reset': 'Reset',
    'common.close': 'Close',

    'sidebar.searchPlaceholder': 'Search docs…',
    'sidebar.searchAria': 'Search docs',
    'sidebar.localTitle': 'Local Files',
    'sidebar.localClear': 'Clear local file list',

    'menu.backToTop': 'Back to Top',
    'menu.prev': 'Previous',
    'menu.next': 'Next',
    'menu.openLocalMd': 'Open Local MD',
    'menu.openLocalFolder': 'Open Local Folder',
    'menu.installPwa': 'Install App',
    'menu.editPage': 'Edit this Page',
    'menu.settings': 'Settings',

    'settings.title': 'Settings',
    'settings.section.language': 'Language',
    'settings.section.appearance': 'Appearance',
    'settings.section.features': 'Features',
    'settings.sub.theme': 'Theme',
    'settings.sub.colors': 'Custom Colors',
    'settings.sub.codeHighlight': 'Code Highlighting',
    'settings.sub.font': 'Fonts',
    'settings.sub.advanced': 'Advanced',
    'settings.sub.display': 'Display',
    'settings.sub.actions': 'Actions',

    'settings.lang.label': 'Interface Language',
    'settings.lang.desc': 'Switch the UI language. "Auto" follows the browser language',
    'settings.lang.auto': 'Auto (follow browser)',

    'settings.theme.label': 'Preset Theme',
    'settings.theme.desc': 'Pick a preset theme; custom colors will be cleared',
    'settings.theme.auto': 'Auto (follow system)',
    'settings.theme.autoPair': 'Auto Theme Pair',
    'settings.theme.autoPairDesc': 'Use the light theme when the system is light, and the dark theme when it is dark',
    'settings.theme.autoLight.default': 'Light · Purple Gradient',
    'settings.theme.autoLight.github': 'Light · GitHub Light',
    'settings.theme.autoLight.notion': 'Light · Notion',
    'settings.theme.autoDark.github': 'Dark · GitHub Dark',
    'settings.theme.autoDark.arc': 'Dark · Arc Dark',
    'settings.theme.autoDark.dracula': 'Dark · Dracula',
    'settings.theme.autoDark.nord': 'Dark · Nord',
    'settings.theme.default': 'Purple Gradient',

    'settings.colors.accent': 'Accent Colors',
    'settings.colors.accentDesc': 'Primary and derived colors, click a swatch to pick',
    'settings.colors.main': 'Main',
    'settings.colors.pink': 'Pink',
    'settings.colors.deep': 'Deep',
    'settings.colors.neutral': 'Neutral Colors',
    'settings.colors.neutralDesc': 'Background, surface, text and border colors — build your own light or dark theme',
    'settings.colors.bg': 'Background',
    'settings.colors.surface': 'Surface',
    'settings.colors.border': 'Border',
    'settings.colors.text': 'Text',
    'settings.colors.muted': 'Muted',
    'colorTitle.main': 'Main (--color-accent-purple)',
    'colorTitle.pink': 'Pink (--color-accent-pink)',
    'colorTitle.deep': 'Deep (--color-accent-purple-deep)',
    'colorTitle.bg': 'Background (--color-bg)',
    'colorTitle.surface': 'Surface (--color-surface)',
    'colorTitle.border': 'Border (--color-border)',
    'colorTitle.text': 'Text (--color-text)',
    'colorTitle.muted': 'Muted text (--color-text-muted)',

    'settings.code.label': 'Code Color Scheme',
    'settings.code.desc': 'Choose the syntax highlighting theme for code blocks',

    'settings.font.remote': 'Remote Font URL',
    'settings.font.remoteDesc': 'Load a remote font via a Google Fonts style CSS URL (e.g. https://fonts.googleapis.com/css2?family=Noto+Sans+SC). Press Enter or blur to apply; leave empty to disable',
    'settings.font.display': 'Display Font Family (serif headings)',
    'settings.font.displayDesc': 'Set a CSS font-family; separate multiple fonts with commas. After a remote font loads you can use its name directly',
    'settings.font.body': 'Body Font Family (UI/body sans-serif)',
    'settings.font.bodyDesc': 'Set a CSS font-family; separate multiple fonts with commas',
    'settings.font.size': 'Font Size',
    'settings.font.sizeDesc': 'Controls UI and Markdown body font size (px)',
    'settings.font.sizeUi': 'UI size',
    'settings.font.sizeBody': 'Body',
    'settings.font.weight': 'Font Weight',
    'settings.font.weightDesc': 'Controls font weight (300 light / 400 regular / 500 medium / 600 semibold / 700 bold)',
    'settings.font.weightDisplay': 'Display',
    'weight.300': '300 Light',
    'weight.400': '400 Regular',
    'weight.500': '500 Medium',
    'weight.600': '600 SemiBold',
    'weight.700': '700 Bold',
    'weight.800': '800 ExtraBold',
    'settings.font.color': 'Text Color',
    'settings.font.colorDesc': 'Primary and muted text colors; accent colors (links, highlights, etc.) are adjusted under "Custom Colors" above',
    'settings.font.colorBody': 'Body',
    'settings.font.colorMuted': 'Muted',
    'settings.font.resetFont': 'Reset Fonts',
    'settings.font.sansDigits': 'Sans-serif Digits in Headings',
    'settings.font.sansDigitsDesc': 'Off by default: heading digits follow the heading font (serif). When on, only Arabic digits in headings render in a sans-serif face; other text is unaffected',

    'settings.adv.customCss': 'Custom CSS',
    'settings.adv.customCssDesc': 'Load an external CSS file URL, press Enter to apply',
    'settings.adv.customCssPlaceholder': 'CSS file URL',
    'settings.adv.customHljs': 'Custom highlight.js',
    'settings.adv.customHljsDesc': 'Load an external highlight.js theme CSS URL, press Enter to apply',
    'settings.adv.customHljsPlaceholder': 'hljs theme CSS URL',

    'settings.display.readingProgress': 'Reading Progress',
    'settings.display.readingProgressDesc': 'Show the page reading progress bar',
    'settings.display.wordCount': 'Word Count',
    'settings.display.wordCountDesc': 'Show each file\'s word count in the file list',
    'settings.display.truncate': 'Truncate Long File Names',
    'settings.display.truncateDesc': 'Truncate with ellipsis when on; when off, full names are shown and overflow scrolls horizontally within the folder area',
    'settings.display.contentWidth': 'Content Width',
    'settings.display.contentWidthDesc': 'Adjust the max width of the Markdown body, applies live; Ctrl/⌘+B collapses the sidebar for more room',
    'settings.display.tableBleed': 'Wide Tables Extend Right',
    'settings.display.tableBleedDesc': 'Content width stays unchanged; wide tables extend past the body edge into the right margin to show more columns, scrolling horizontally if still too wide',

    'settings.actions.editor': 'Markdown Editor',
    'settings.actions.editorDesc': 'Open the interactive editor in a new tab with syntax shortcuts and live preview',
    'settings.actions.openEditor': 'Open Editor',
    'settings.actions.pulseGen': 'Pulse Generator',
    'settings.actions.pulseGenDesc': 'Visually generate DG-LAB .pulse waveforms, up to 20',
    'settings.actions.openPulseGen': 'Open Generator',
    'settings.actions.downloadMd': 'Download Article',
    'settings.actions.downloadMdDesc': 'Download the current document as Markdown',
    'settings.actions.downloadMdBtn': 'Download MD',
    'settings.actions.exportPdf': 'Export PDF',
    'settings.actions.exportPdfDesc': 'Export as PDF via the browser print dialog',
    'settings.actions.exportPdfBtn': 'Export PDF',
    'settings.actions.exportHtml': 'Export HTML',
    'settings.actions.exportHtmlDesc': 'Save as a single-file HTML with the current theme inlined — double-click to view offline',
    'settings.actions.exportHtmlBtn': 'Export HTML',

    'welcome.text': 'Select a file to start reading',
    'toast.update': 'A new version is available',
    'toast.refresh': 'Refresh',
    'palette.placeholder': 'Search docs...',
    'palette.clear': 'Clear search',
    'palette.dialog': 'Search docs',

    'md.readingTime': '{n} min read',
    'md.loadFailed': 'Failed to load file',
    'md.welcome': 'Select a file to start reading',
    'md.copyAnchor': 'Copy link to this heading',
    'md.noIndex': 'No headings in this file',
    'md.defaultDescription': 'A clean, elegant Markdown preview site with rich rendering support',
    'footnote.description': 'Footnotes',
    'footnote.backRef': 'Back to reference {0}',

    'search.noResults': 'No matching documents found',
    'tree.loadFailed': 'Failed to load the file list. Check your network or configure manually',
    'tree.componentFailed': 'Failed to load the file tree component',

    'ctx.copied': 'Copied',
    'ctx.copyLatex': 'Copy LaTeX formula',
    'ctx.tableOps': 'Table actions',
    'ctx.downloadImage': 'Download image',
    'ctx.copyMd': 'Copy Markdown source',
    'ctx.copyCsv': 'Copy CSV',

    'export.needDoc': 'Open a document first',
    'export.downloadFailed': 'Download failed, please retry',

    'local.title': 'Local Files',
    'local.remove': 'Remove from list',
    'local.removeAria': 'Remove ',
    'local.tooLarge': ' (over 10MB)',
    'local.tooLargeOpen': ' (over 10MB, cannot open)',
    'local.readFailed': ' (failed to read)',
    'local.listFull': ' (list is full, 20 max)',
    'local.skippedFiles': 'These files were not added:\n',
    'local.folderEmpty': 'No .md files found in this folder',
    'local.folderFull': ' (exceeds the 500-file limit)',
    'local.folderReplaceConfirm': 'Opening a new folder will replace the current local file list. Continue?',
    'local.folderUnsupported': 'This browser cannot open folders; please pick multiple files instead',
    'wordCount.unit': ' words',

    'plantuml.renderFailed': 'All PlantUML render servers unavailable; showing source instead',
    'plantuml.renderError': 'PlantUML render error',
    'plantuml.openInEditor': 'Open in the PlantUML online editor',

    'fav.added': 'Favorited "{t}"',
    'fav.removed': 'Removed favorite "{t}"',
    'preview.loading': 'Loading…',
    'preview.noExcerpt': '(no excerpt)',

    'menu.qrShare': 'Continue on phone',
    'qr.title': 'Continue on Phone',
    'qr.hint': 'Scan with your phone to keep reading',
    'qr.position': 'You are at {pct}% — the phone will jump here',
    'qr.fromTop': 'The phone will start from the top',

    'reading.resume': 'Continue from {pct}%?',
    'reading.resumeGo': 'Continue',
    'reading.resumeDismiss': 'Dismiss',

    'sel.copy': 'Copy',
    'sel.search': 'Search docs',
    'sel.card': 'Share card',

    'csv.searchPlaceholder': 'Search table…',
    'csv.rowCount': '{n} rows',
    'csv.filteredCount': '{m} / {n} rows',
    'csv.copyCsv': 'Copy CSV',
    'csv.downloadCsv': 'Download CSV',
    'csv.sort': 'Sort',
    'csv.filter': 'Filter column',
    'csv.filterBy': 'Filter',
    'csv.selectAll': 'Select all',
    'csv.clearFilter': 'Clear',
    'csv.empty': 'No matching rows',
    'csv.untitled': 'Column',

    'settings.offline.label': 'Full offline cache',
    'settings.offline.desc': 'Cache every document in the file tree for full offline reading',
    'settings.offline.btn': 'Cache all documents',
    'settings.offline.progress': 'Caching {done}/{total}…',
    'settings.offline.done': 'Cached {n} documents — full offline reading ready',
    'settings.offline.doneFailed': 'Cached {done} documents ({failed} failed)',
    'settings.offline.clear': 'Clear document cache',
    'settings.offline.cleared': 'Document cache cleared',
    'settings.offline.unsupported': 'Service Worker is unavailable (requires HTTPS deployment)',
    'settings.offline.failed': 'Caching failed, please retry'
  };

  const dicts = { zh, en };

  let setting = 'auto';   // 'auto' | 'zh' | 'en'
  let currentLang = 'zh'; // 解析结果：'zh' | 'en'

  function detectLang() {
    const langs = navigator.languages || [navigator.language || 'zh-CN'];
    const zhMatch = langs.some(l => typeof l === 'string' && /^zh\b|^zh-/i.test(l));
    return zhMatch ? 'zh' : 'en';
  }

  function resolve() {
    return setting === 'auto' ? detectLang() : setting;
  }

  function t(key, fallback) {
    const dict = dicts[currentLang] || zh;
    if (dict[key] != null) return dict[key];
    if (zh[key] != null) return zh[key];
    return fallback != null ? fallback : key;
  }

  function setHtmlLang() {
    document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-CN';
  }

  // 批量替换静态标记的文案
  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const v = t(el.getAttribute('data-i18n'));
      if (v != null) el.textContent = v;
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    setHtmlLang();
  }

  function setLang(next) {
    if (!['auto', 'zh', 'en'].includes(next)) return;
    setting = next;
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch (e) { /* 忽略存储失败 */ }
    currentLang = resolve();
    apply();
    const sel = document.getElementById('langSelect');
    if (sel) sel.value = setting;
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));
  }

  function getLang() {
    return currentLang;
  }

  function getSetting() {
    return setting;
  }

  function init() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'zh' || saved === 'en' || saved === 'auto') setting = saved;
    } catch (e) { /* 忽略读取失败 */ }
    currentLang = resolve();

    apply();

    const sel = document.getElementById('langSelect');
    if (sel) {
      sel.value = setting;
      sel.addEventListener('change', () => setLang(sel.value));
    }
  }

  // 模块加载即解析语言，保证其他模块在 DOMContentLoaded 前调用 t() 已有正确语向
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'zh' || saved === 'en' || saved === 'auto') setting = saved;
  } catch (e) { /* 忽略读取失败 */ }
  currentLang = resolve();

  window.MarkdownPreview.i18n = {
    t,
    apply,
    setLang,
    getLang,
    getSetting
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
