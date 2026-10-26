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
    'menu.openLocal': '打开本地文件',
    'menu.installPwa': '安装到桌面',
    'menu.editPage': '编辑此页',
    'menu.settings': '设置',

    // 本地文件选择面板
    'local.pickFiles': '选择文件…',
    'local.pickFilesDesc': '选择一个或多个 .md 文件（可多选）',
    'local.pickFolder': '选择文件夹…',
    'local.pickFolderDesc': '导入整个文件夹，按目录树展示',

    // 设置面板：骨架
    'settings.title': '设置',
    'settings.search.placeholder': '搜索设置…',
    'settings.search.aria': '搜索设置',
    'settings.search.empty': '没有匹配的设置项',
    'settings.section.language': '语言',
    'settings.section.appearance': '外观',
    'settings.section.fonts': '字体',
    'settings.section.reading': '阅读',
    'settings.section.layout': '布局',
    'settings.section.toolsExport': '工具与导出',
    'settings.sub.theme': '主题',
    'settings.sub.colors': '自定义配色',
    'settings.sub.codeHighlight': '代码高亮',
    'settings.sub.font': '字体',
    'settings.sub.customCss': '自定义 CSS',
    'settings.sub.display': '显示选项',
    'settings.sub.layout': '布局',
    'settings.sub.tools': '工具',
    'settings.sub.export': '导出',
    'settings.sub.offline': '离线缓存',

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
    'settings.adv.customCss': '外部样式表 URL',
    'settings.adv.customCssDesc': '加载外部 CSS 文件 URL，回车应用',
    'settings.adv.customCssPlaceholder': 'CSS 文件 URL',
    'settings.adv.customHljs': '自定义高亮主题',
    'settings.adv.customHljsDesc': '加载外部 highlight.js 主题 CSS URL，回车应用',
    'settings.adv.customHljsPlaceholder': 'hljs 主题 CSS URL',

    // 显示
    'settings.display.readingProgress': '显示阅读进度',
    'settings.display.readingProgressDesc': '显示页面阅读进度',
    'settings.display.wordCount': '显示词数统计',
    'settings.display.wordCountDesc': '在文件列表中显示每个文件的词数',
    'settings.display.truncate': '折叠过长文件名',
    'settings.display.truncateDesc': '默认关闭，完整显示文件名；开启后用省略号截断过长文件名，超出部分悬停可横向滚动查看',
    'settings.display.expandFolders': '侧边栏文件夹默认展开',
    'settings.display.expandFoldersDesc': '开启时文件树中的文件夹全部展开显示；关闭时默认折叠，点击文件夹手动展开',
    'settings.display.treeSort': '侧边栏排序',
    'settings.display.treeSortDesc': '文件树中文件与文件夹的排列顺序',
    'settings.treeSort.smart': '智能顺序',
    'settings.treeSort.createdDesc': '最初创建时间（新 → 旧）',
    'settings.treeSort.createdAsc': '最初创建时间（旧 → 新）',
    'settings.treeSort.modifiedDesc': '最后修改时间（新 → 旧）',
    'settings.treeSort.modifiedAsc': '最后修改时间（旧 → 新）',
    'settings.layout.sidebarStyle': '侧边栏样式',
    'settings.layout.sidebarStyleDesc': '经典：贴边通栏、微色差微阴影无边框；悬浮：四周留缝的圆角卡片（桌面端）',
    'settings.layout.sidebarClassic': '经典（贴边）',
    'settings.layout.sidebarFloating': '悬浮卡片',
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
    'palette.placeholder': '搜索文档，或输入 > 执行命令...',
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
    'footnote.cardTitle': '脚注',
    'footnote.jump': '跳转到脚注',

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
    'ctx.copySrc': '复制源码',
    'ctx.srcCopied': '源码已复制',
    'ctx.copyFailed': '复制失败',
    'ctx.exportSvg': '导出 SVG',
    'ctx.exportPng': '导出 PNG',
    'ctx.svgUnavailable': '该图表无 SVG 可导出，请用 PNG',
    'ctx.exportFailed': '导出失败：图片服务不允许跨域获取',

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

    // 动态文案：Pulse 波形渲染器
    'pulse.titleFallback': 'Pulse 波形',
    'pulse.rest': '休息',
    'pulse.mode.global': '全局',
    'pulse.mode.scroll': '滚动',
    'pulse.line.vline': '竖线',
    'pulse.line.curve': '曲线',
    'pulse.download': '下载 .pulse',
    'pulse.source': '源码',
    'pulse.copySource': '复制源码',
    'pulse.frameOf': '帧 {i}/{n}',
    'pulse.sections': '{enabled}/{total} 段',
    'pulse.speed': '{x}x 速度',
    'pulse.restSec': '休息 {s}s',
    'pulse.cycle': '周期 {s}s',
    'pulse.freqMode': ['', '固定', '节内渐变', '元内渐变', '元间渐变'],
    'pulse.freqModeFallback': '固定',
    'pulse.tipFreqA': '频率A:{a}({ams}ms) · 频率B:{b}({bms}ms)',
    'pulse.tipDuration': '时长滑块:{d} · 模式:{m}',
    'pulse.tipPoints': '脉冲元:{n}点 ({s}s)',
    'pulse.tipEnabled': '启用',
    'pulse.tipDisabled': '禁用',
    'pulse.parseFailed': 'Pulse 数据解析失败：格式不符合 Dungeonlab+pulse 规范',
    'pulse.parseFailedShort': '解析失败',

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
    'settings.offline.failed': '缓存失败，请稍后重试',

    // 设置面板 · 移动端手势
    'settings.display.gestures': '启用移动端手势',
    'settings.display.gesturesDesc': '触屏设备上左右滑动正文切换上一篇 / 下一篇，自屏幕左缘右滑呼出侧边栏',

    // 设置面板 · 配置备份（设置导出 / 导入）
    'settings.sub.backup': '配置备份',
    'settings.backup.export': '导出设置',
    'settings.backup.exportDesc': '把主题、配色、字体、阅读偏好与界面语言保存为 JSON 文件',
    'settings.backup.exportBtn': '导出',
    'settings.backup.import': '导入设置',
    'settings.backup.importDesc': '选择本站导出的 JSON 备份文件，导入后自动刷新生效',
    'settings.backup.importBtn': '导入',
    'settings.backup.invalid': '导入失败：不是有效的设置备份文件',

    // 设置面板 · 存储管理
    'settings.section.storage': '存储',
    'settings.sub.storageUsage': '空间占用',
    'settings.sub.notebooks': '编辑器笔记本',
    'settings.sub.browsingData': '浏览数据',
    'storage.usage': '已用 {used} / 约 {quota}（{pct}%）',
    'storage.unavailable': '当前浏览器不支持存储用量查询',
    'storage.estimateFailed': '存储用量查询失败',
    'storage.notebooks.label': '笔记本数据',
    'storage.notebooks.loading': '正在读取…',
    'storage.notebooks.summary': '{n} 个笔记本 · 共约 {size}',
    'storage.notebooks.empty': '暂无笔记本数据',
    'storage.notebooks.clearAll': '全部清空',
    'storage.notebooks.unavailable': '当前浏览器不支持 IndexedDB',
    'storage.notebooks.loadFailed': '笔记本数据读取失败',
    'storage.notebook.untitled': '未命名笔记本',
    'storage.notebook.meta': '{cells} 个单元格 · 约 {size}',
    'storage.notebook.deleteConfirm': '确定删除笔记本「{title}」？此操作不可恢复。',
    'storage.notebook.deleteFailed': '删除失败，请重试',
    'storage.delete': '删除',
    'storage.clear': '清理',
    'storage.clearConfirm': '确定清理「{label}」？此操作不可恢复。',
    'storage.data.historyFav': '阅读历史与收藏',
    'storage.data.historyFavDesc': '{n} 条记录 · 约 {size}',
    'storage.data.readingPos': '阅读位置',
    'storage.data.readingPosDesc': '{n} 篇文档 · 约 {size}',

    // 拖拽打开文件 / 文件夹
    'drop.title': '松开以打开',
    'drop.desc': '支持 .md / .markdown 文件与整个文件夹',

    // 悬浮球：对照阅读
    'menu.splitView': '对照阅读',
    'menu.snapshotShare': '快照分享',
    'menu.openMenu': '打开菜单',

    // 文章内查找条
    'find.placeholder': '在本文中查找…',
    'find.prev': '上一个 (Shift+Enter)',
    'find.next': '下一个 (Enter)',
    'find.noResult': '无结果',

    // JSON 可折叠树
    'json.items': '{n} 项',
    'json.keys': '{n} 个键',
    'json.copyPath': '复制路径',
    'json.collapseAll': '收起',
    'json.expandAll': '展开',
    'json.copyJson': '复制 JSON',
    'json.download': '下载 .json',
    'json.rootArray': '根数组 · {n} 项',
    'json.rootObject': '根对象 · {n} 个键',

    // 代码块 live 预览沙箱
    'sandbox.consoleEmpty': '没有 console 输出。用 console.log() 试试',
    'sandbox.hint': '脚本在隔离沙箱中运行',
    'sandbox.run': '运行',
    'sandbox.reset': '重置',
    'sandbox.runPreview': '点击运行预览',
    'sandbox.source': '源码',
    'sandbox.frameTitle': '代码运行预览',
    'sandbox.cssSampleText': '这是一段示例文本，包含 ',
    'sandbox.cssSampleLink': '链接',
    'sandbox.cssSampleBold': '加粗',
    'sandbox.cssSampleButton': '按钮',
    'sandbox.cssSampleList': '列表项一',
    'sandbox.cssSampleList2': '列表项二',

    // 标签系统
    'tags.panelTitle': '标签',
    'tags.openTag': '查看该标签下的文档',
    'tags.pageTitle': '标签',
    'tags.docCount': '共 {n} 篇文档',
    'dir.docCount': '共 {n} 篇文档',
    'dir.empty': '该目录下暂无文档',
    'tags.empty': '该标签下暂无文档',

    // 快照分享
    'snap.loadFailed': '文档内容获取失败',
    'snap.noDoc': '当前没有可分享的文档',
    'snap.compressFailed': '压缩组件加载失败',
    'snap.badLinkTitle': '快照链接无效',
    'snap.badLinkBody': '链接中的快照数据缺失或已损坏。',
    'snap.name': '快照',
    'snap.bannerTitle': '这是一份快照分享',
    'snap.bannerBody': '内容仅存在于链接与本机，不会被上传或收录',
    'snap.saveSession': '存入本地会话',
    'snap.working': '正在生成快照链接…',
    'snap.copied': '已复制快照链接，发给对方即可打开',
    'snap.copiedOversize': '已复制快照链接（内容较大，部分环境可能打不开）',

    // 万能命令面板
    'cmd.groupCommands': '命令',
    'cmd.groupAction': '命令',
    'cmd.groupTheme': '主题',
    'cmd.noMatch': '没有匹配的命令',
    'cmd.toggleSidebar': '开关侧边栏',
    'cmd.openSettings': '打开设置',
    'cmd.focusMode': '专注模式',
    'cmd.randomDoc': '随机读一篇',
    'cmd.copyLink': '复制页面链接',
    'cmd.exportPdf': '导出 PDF（打印）',
    'cmd.exportMd': '导出 Markdown',
    'cmd.exportHtml': '导出单文件 HTML',
    'cmd.cacheAll': '缓存全部文档（离线）',
    'cmd.openEditor': '打开编辑器',
    'cmd.cacheDone': '已缓存 {n} 篇',

    // 章节折叠
    'collapse.collapse': '折叠本章',
    'collapse.expand': '展开本章',

    // 双栏对照阅读
    'split.title': '对照阅读',
    'split.syncScroll': '同步滚动',
    'split.hint': 'Esc 退出',
    'split.syncOn': '同步滚动：开',
    'split.syncOff': '同步滚动：关',
    'split.changeDoc': '更换文档',
    'split.pickTitle': '选择右栏文档',
    'split.pickerPlaceholder': '按名称或路径筛选…',
    'split.pickerEmpty': '没有匹配的文档',
    'split.rightEmpty': '右栏未选择',
    'split.pickDoc': '选择右栏文档',
    'split.emptyText': '选择一篇文档开始对照',
    'split.emptyHint': '站点文档与本地会话文档都可以选',
    'split.needDoc': '请先打开一个文档',
    'split.localBadge': '本地',
    'split.loadFailed': '文档加载失败，请重试',

    // 设置：章节折叠 / 打包导出
    'settings.display.sectionCollapse': '启用章节折叠',
    'settings.display.sectionCollapseDesc': 'H2 标题栏右侧出现折叠按钮，点击折叠该章节；折叠状态按文档记忆，重开自动恢复',
    'settings.display.splitSyncScroll': '对照阅读默认同步滚动',
    'settings.display.focusMode': '专注模式',
    'settings.display.focusModeDesc': '当前阅读段落保持高亮，其余内容淡化（也可在 Ctrl/⌘+K 命令面板开关）',
    'settings.display.splitSyncScrollDesc': '打开双栏对照阅读时两栏按比例同步滚动（快捷键 Ctrl/⌘+Alt+S 可随时开关本次会话的同步）',
    'settings.actions.exportEpub': '导出 EPUB',
    'settings.actions.exportEpubDesc': '当前文档导出为 EPUB 电子书，本地相对路径图片随文打包',
    'settings.actions.exportEpubBtn': '导出 EPUB',
    'settings.actions.exportSiteEpub': '整站 EPUB 合订本',
    'settings.actions.exportSiteEpubDesc': '全部文档按文件树顺序合订为一本 EPUB 电子书',
    'settings.actions.exportSiteEpubBtn': '导出合订本',
    'settings.actions.exportSiteMd': '整站 MD 打包下载',
    'settings.actions.exportSiteMdDesc': '全部 .md 按仓库目录结构打包为 ZIP 一键带走',
    'settings.actions.exportSiteMdBtn': '打包下载',
    'settings.export.phaseDocs': '拉取文档',
    'settings.export.phaseAssets': '打包图片',
    'settings.export.done': '已导出',
    'settings.export.failed': '导出失败，请重试',

    // 分享卡片模板
    'sel.cardPick': '选择卡片模板',
    'sel.cardQuote': '引言 · 横版 1200×630',
    'sel.cardQuoteV': '引言 · 竖版 3:4',
    'sel.cardCode': '代码卡片',
    'sel.cardTable': '表格卡片',
    'sel.cardTableHint': '选区需落在表格内',
    'sel.cardTableMore': '… 其余 {n} 行未展示',
    'sel.issue': '反馈问题',
    'sel.issueDoc': '**文档**：',
    'sel.issueWhere': '**位置**：',
    'sel.issueQuote': '**引文**：',
    'sel.issueDesc': '**问题描述**：',

    // EPUB / 打包导出
    'export.epub.toc': '目录',
    'export.noDocs': '没有可打包的文档（文件树未加载或为空）',
    'export.fetchFailed': '文档获取失败，请重试',

    // 设置面板：中文 / 性能
    'settings.section.cjk': '中文',
    'settings.section.perf': '性能',
    'settings.sub.typography': '中文排版',
    'settings.cjk.convert': '正文繁简转换',
    'settings.cjk.convertDesc': '阅读时转换正文的简体 / 繁体，不改动源文件（代码块、公式不转换）',
    'settings.cjk.off': '原文',
    'settings.cjk.toTw': '转为繁体',
    'settings.cjk.toCn': '转为简体',
    'settings.cjk.indent': '首行缩进',
    'settings.cjk.indentDesc': '正文段落首行缩进两字符',
    'settings.cjk.hanging': '标点悬挂',
    'settings.cjk.hangingDesc': '行尾标点悬挂到边距外（支持的浏览器生效）',
    'settings.cjk.spacing': '中西文间距 / 标点挤压',
    'settings.cjk.spacingDesc': '中英文之间自动加间距、压缩标点周围空白（支持的浏览器生效）',
    'settings.perf.cv': '屏外内容跳过布局',
    'settings.perf.cvDesc': '长文档屏外区块跳过布局与绘制，滚动更顺滑（可能影响阅读位置百分比）',
    'settings.perf.prefetch': '相邻文档预取',
    'settings.perf.prefetchDesc': '空闲时预取上一篇 / 下一篇，翻页更即时；移动端流量敏感时可关闭',

    // CSV → 图表联动
    'csv.chart.build': '画成图',
    'csv.chartType': '图表类型',
    'csv.chart.line': '折线',
    'csv.chart.bar': '柱状',
    'csv.chart.area': '面积',
    'csv.chart.pie': '饼图',
    'csv.chart.noNumeric': '没有可用于绘图的数值列',
    'csv.chart.loading': '正在加载图表库…',
    'csv.chart.loadFail': '图表库加载失败',
    'csv.chart.renderFail': '图表渲染失败',
    'csv.column': '列',

    // 术语表 / HTTP 请求块
    'glossary.title': '术语表',
    'http.send': '发送',
    'http.sending': '请求中…',
    'http.failed': '请求失败',
    'http.cors': '请求失败（可能是跨域限制或网络问题）',
    'timeline.today': '今天',
    'timeline.empty': '时间线为空：每行写「时间 | 事件 | 备注 | 状态」',

    // 文档图谱（GRAPH-1）
    'graph.pageTitle': '文档图谱',
    'graph.search.placeholder': '搜索文档…',
    'graph.legend': '标签',
    'graph.backToSite': '退回文档站',
    'graph.isolated.hidden': '{n} 篇无链接文档已隐藏 · 点击显示',
    'graph.isolated.shown': '无链接文档已显示 · 点击隐藏',
    'graph.degree': '被引用 {n} 篇',
    'graph.empty': '没有可绘制的文档',
    'graph.loadFail': '图谱组件加载失败',
    'graph.zoomIn': '放大',
    'graph.zoomOut': '缩小',
    'graph.fit': '适配画布',
    'graph.reset': '重置视图',
    'graph.fullscreen': '全屏',
    'graph.exitFullscreen': '退出全屏',
    'cmd.openGraph': '文档图谱',

    // 反向链接与相关文档（LINK-1）
    'backlinks.title': '反向链接',
    'backlinks.count': '被 {n} 篇引用',
    'backlinks.related': '相关文档',
    'backlinks.sharedTags': '共同标签 {n}',
    'backlinks.empty': '暂无其他文档引用本文',
    'backlinks.expand': '显示全部（{n}）',
    'backlinks.collapse': '收起',

    // 图 / 表编号（FIGURES-1）
    'figure.figure': '图',
    'figure.table': '表',
    'figure.copyAnchor': '复制图表锚点链接',

    // 竖排 / OpenAPI / Git 历史
    'menu.history': '历史与变更',
    'settings.cjk.vertical': '竖排阅读',
    'settings.cjk.verticalDesc': '正文竖排（右起竖排），适合文言 / 诗词；代码块与表格保持横向',
    'openapi.try': '试一下',
    'openapi.responses': '响应',
    'history.loading': '加载中…',
    'history.empty': '暂无提交记录（或仓库不可访问）',
    'history.watch': '关注此文档',
    'history.unwatch': '取消关注',
    'history.back': '返回列表',
    'history.rateLimited': 'GitHub API 限流（未登录 60 次/时）。请稍后再试或配置 Token。',
    'history.resetAt': '限额重置：',
    'history.forbidden': 'GitHub 拒绝了请求（403，非限流）。',
    'history.notFound': '未找到该文档的提交（可能是新文件或私有仓库）。',
    'history.failed': '加载失败：',
    'history.binary': '（无文本 diff）',
    'history.updated': '此文档有更新',
    'history.viewChanges': '查看变更',
    'history.markRead': '标记已读'
  };

  // en 语言包按需加载（见 iris/js/i18n-en.js）：首屏只内联 zh（默认语向）。
  // currentLang 为 en 时在 init/setLang 中拉取后注册；未就绪期间 t() 走
  // zh 回退 + 调用方 fallback，DOM 文案在 ensureEnDict 完成后统一 apply。
  let enDict = window.MarkdownPreview.I18N_EN || null;

  function ensureEnDict() {
    if (enDict) {
      dicts.en = enDict;
      return Promise.resolve(enDict);
    }
    return window.MarkdownPreview.loadScript('iris/js/i18n-en.js').then(() => {
      enDict = window.MarkdownPreview.I18N_EN || {};
      dicts.en = enDict;
      return enDict;
    });
  }


  const dicts = { zh };

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
    const finish = () => {
      apply();
      const sel = document.getElementById('langSelect');
      if (sel) sel.value = setting;
      window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));
    };
    // en 语言包按需加载；加载失败仍 finish（t() 有 zh/fallback 兜底）
    if (currentLang === 'en' && !dicts.en) {
      ensureEnDict().then(finish, finish);
    } else {
      finish();
    }
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

    const finish = () => {
      apply();
      const sel = document.getElementById('langSelect');
      if (sel) {
        sel.value = setting;
        sel.addEventListener('change', () => setLang(sel.value));
      }
    };
    if (currentLang === 'en' && !dicts.en) {
      ensureEnDict().then(finish, finish);
    } else {
      finish();
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

  // 全站通用的 t() 快捷引用：供各模块 `const t = window.MarkdownPreview.t` 替换
  // 各自手写的 i18n 包装函数（i18n.js 在绝大多数模块之前加载）。
  window.MarkdownPreview.t = t;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
