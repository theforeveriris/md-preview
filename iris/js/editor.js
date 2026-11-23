(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 编辑器模式切换 ==============
  const editorOverlay = document.getElementById('editorOverlay');
  let editorInitialized = false;

  function enterEditorMode() {
    if (!editorOverlay) return;
    // 必须用 flex 而非 block，否则 .editor-overlay 的 flex 布局失效，
    // 编辑区无法获得剩余高度
    editorOverlay.style.display = 'flex';
    document.body.classList.add('editor-mode');
    // 更新 URL（保留 hash）
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'editor');
    window.history.replaceState({}, '', url.toString());
    if (!editorInitialized) {
      editorInitialized = true;
      initEditor();
    }
  }

  function exitEditorMode() {
    if (!editorOverlay) return;
    editorOverlay.style.display = 'none';
    document.body.classList.remove('editor-mode');
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url.toString());
  }

  window.MarkdownPreview.enterEditorMode = enterEditorMode;
  window.MarkdownPreview.exitEditorMode = exitEditorMode;

  function checkEditorMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'editor') {
      enterEditorMode();
    }
  }

  document.getElementById('exitEditorBtn')?.addEventListener('click', exitEditorMode);

  function initEditor() {

  // ============== 状态 ==============
  // 单文档模型：cells 数组只保留一个「文档」条目。保留这条数据结构是为了
  // 让查找替换 / 图片上传 / 版本快照等既有子系统继续工作；界面上不再有
  // Cell 概念——没有 Cell 头、运行按钮、输出区，整篇 Markdown 是一条源码。
  let restoreDepth = 0;
  let cells = [];
  let cellCounter = 0;
  let activeCellId = null;
  let editorMode = 'wysiwyg';        // 'wysiwyg' | 'split'
  let splitPreviewTimer = null;
  let syncingScroll = false;

  // 子系统（initEditor 末尾注入，先声明避免 TDZ）
  let findReplace = null;
  let tableEditor = null;
  let outline = null;
  let mermaidPip = null;
  let versionSnapshots = null;

  // ============== 画廊样式注册 ==============
  const mdRender = window.MarkdownPreview.mdRender;
  const svgWrap = (path) => `<svg class="alert-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const EDITOR_ALERT_TYPES = {
    NOTE:     { icon: svgWrap('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'), title: 'Note' },
    IMPORTANT:{ icon: svgWrap('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'), title: 'Important' },
    WARNING:  { icon: svgWrap('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>'), title: 'Warning' },
    TIP:      { icon: svgWrap('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3v1h6v-1c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'), title: 'Tip' },
    CAUTION:  { icon: svgWrap('<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>'), title: 'Caution' }
  };

  const autocompleteItems = window.MarkdownPreview.editorCompletions || [];

  // 子模块入口（初始化在下方统一注入）
  const mediaUpload = window.MarkdownPreview.editorModules.mediaUpload;

  // ============== DOM 引用 ==============
  const editorMain = document.getElementById('editorMain');
  const docSourcePane = document.getElementById('docSourcePane');
  const docPreviewPane = document.getElementById('docPreviewPane');
  const docPreview = document.getElementById('docPreview');
  const docSplitDivider = document.getElementById('docSplitDivider');
  const modeSwitch = document.getElementById('modeSwitch');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const autocompleteList = document.getElementById('autocompleteList');
  const fmtFloat = document.getElementById('fmtFloat');
  const statusWords = document.getElementById('statusWords');
  const statusLines = document.getElementById('statusLines');
  const statusCursor = document.getElementById('statusCursor');
  const statusMode = document.getElementById('statusMode');
  const statusSave = document.getElementById('statusSave');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('editorSearchInput');
  const replaceInput = document.getElementById('replaceInput');
  const searchInfo = document.getElementById('searchInfo');
  const fontSizeMenu = document.getElementById('fontSizeMenu');
  const fontSizeBtn = document.getElementById('fontSizeBtn');
  const searchBtn = document.getElementById('searchBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const fileInput = document.getElementById('fileInput');
  const imageUploadBtn = document.getElementById('imageUploadBtn');
  const imageUploadPopover = document.getElementById('imageUploadPopover');

  // ============== 通用 ==============

  let toastTimer = null;
  function editorT(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  function showToast(msg, action) {
    let toast = document.getElementById('editorToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'editorToast';
      toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);padding:8px 16px;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px;font-size:13px;z-index:9999;opacity:0;transition:opacity 0.2s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    if (toast._actionBtn) { toast._actionBtn.remove(); toast._actionBtn = null; }
    if (action) {
      const btn = document.createElement('button');
      btn.textContent = action.label;
      btn.style.cssText = 'margin-left:10px;padding:2px 10px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.6);border-radius:4px;font-size:12px;cursor:pointer;';
      btn.addEventListener('click', () => {
        toast.style.opacity = '0';
        action.run();
      });
      toast.appendChild(btn);
      toast._actionBtn = btn;
      toast.style.pointerEvents = 'auto';
    } else {
      toast.style.pointerEvents = 'none';
    }
    toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, action ? 6000 : 1500);
  }

  function countWords(text) {
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    return chineseChars.length + englishWords.length;
  }

  const downloadBlob = window.MarkdownPreview.downloadBlob;

  // ============== 单文档编辑器 ==============

  function createCell() {
    if (cells.length > 0) return cells[0];
    cellCounter = 1;
    const id = 1;

    const host = document.createElement('div');
    host.className = 'doc-cm-host';
    host.dataset.cellId = String(id);
    docSourcePane.appendChild(host);

    const isDark = document.body.classList.contains('editor-dark-mode');
    const editor = new window.CodeMirrorEditor(host, {
      value: '',
      placeholder: '开始输入 Markdown…（渲染后的块点一下即可编辑源码）',
      dark: isDark,
      livePreview: editorMode === 'wysiwyg',
      livePreviewOptions: { renderBlock: renderBlockInto }
    });
    editor.dataset.cellId = String(id);

    const cellData = {
      id,
      div: editorMain,
      host,
      editor,
      textarea: editor, // 既有子系统的兼容别名
      output: docPreview, // 双栏预览即输出容器（表格编辑器等按 owner.output 回查）
      outputToolbar: null,
      header: null,
      statusDot: null,
      linesLabel: null,
      typeBadge: null,
      collapseBtn: null,
      type: 'markdown',
      lastRunContent: ''
    };
    cells.push(cellData);
    activeCellId = id;

    editor.addEventListener('focus', () => {
      activeCellId = id;
      updateStatusbar();
      mermaidPip?.onCellActivity?.(cellData);
    });

    editor.addEventListener('input', () => {
      onTextareaInput({ target: editor });
      updateCellMeta(cellData);
      markUnsaved();
      updateStatusbar();
      findReplace?.invalidateMatches?.();
      mermaidPip?.onCellActivity?.(cellData);
      if (editorMode === 'split') scheduleSplitPreview();
    });

    editor.addEventListener('keydown', onTextareaKeydown);
    editor.addEventListener('keyup', () => { updateStatusbar(); mermaidPip?.onCellActivity?.(cellData); });
    editor.addEventListener('click', () => { updateStatusbar(); mermaidPip?.onCellActivity?.(cellData); });
    editor.addEventListener('select', () => {
      updateStatusbar();
      if (editor.view.hasFocus) {
        // updateListener 触发期间 coordsAtPos 可能测量失败，延迟到本轮更新结束后定位
        setTimeout(() => updateSelectionToolbar({ target: editor }), 0);
      }
    });
    editor.addEventListener('mouseup', () => updateSelectionToolbar({ target: editor }));
    editor.addEventListener('blur', () => {
      setTimeout(hideSelectionToolbar, 150);
      setTimeout(hideAutocomplete, 150);
    });

    // 图片粘贴 / 拖拽：直接插入到当前光标
    editorMain.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      imageFiles.forEach(file => mediaUpload.insertImageToCell(cellData, file));
    });

    editorMain.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        editorMain.classList.add('drag-over');
      }
    });
    editorMain.addEventListener('dragleave', (e) => {
      if (!editorMain.contains(e.relatedTarget)) editorMain.classList.remove('drag-over');
    });
    editorMain.addEventListener('drop', (e) => {
      editorMain.classList.remove('drag-over');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || files.length === 0) return;
      const imageFiles = Array.from(files).filter(f => f.type && f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      e.preventDefault();
      activeCellId = id;
      imageFiles.forEach(file => mediaUpload.insertImageToCell(cellData, file));
    });

    // 双栏同步滚动：编辑区 ⇄ 预览区
    const scroller = editor.view.scrollDOM;
    scroller.addEventListener('scroll', () => {
      if (editorMode !== 'split' || syncingScroll || !docPreview) return;
      syncingScroll = true;
      const maxSrc = scroller.scrollHeight - scroller.clientHeight;
      const maxDst = docPreview.scrollHeight - docPreview.clientHeight;
      if (maxSrc > 0 && maxDst > 0) docPreview.scrollTop = (scroller.scrollTop / maxSrc) * maxDst;
      setTimeout(() => { syncingScroll = false; }, 50);
    });
    docPreview?.addEventListener('scroll', () => {
      if (editorMode !== 'split' || syncingScroll) return;
      syncingScroll = true;
      const maxSrc = docPreview.scrollHeight - docPreview.clientHeight;
      const maxDst = scroller.scrollHeight - scroller.clientHeight;
      if (maxSrc > 0 && maxDst > 0) scroller.scrollTop = (docPreview.scrollTop / maxSrc) * maxDst;
      setTimeout(() => { syncingScroll = false; }, 50);
    });

    updateStatusbar();
    return cellData;
  }

  function getCell(id) {
    return cells.find(c => c.id === id);
  }

  function getActiveCell() {
    return getCell(activeCellId) || cells[0] || null;
  }

  function setDocContent(text, opts) {
    const cell = cells[0];
    if (!cell) return;
    cell.textarea.setValue(text || '', opts || { skipHistory: true });
    try {
      cell.editor.view.dispatch({ selection: { anchor: 0 } });
    } catch (e) { /* ignore */ }
  }

  // 旧数据（一个或多个 Cell）→ 单篇 Markdown：Cell 之间空一行拼接，
  // plaintext Cell 包成 ```text 围栏，保持「不渲染」的原意。
  function mergeCellContents(cellList) {
    if (!Array.isArray(cellList)) return '';
    return cellList.map((s) => {
      const content = String(s.content || '');
      if (s.type === 'plaintext') {
        return '```text\n' + content.replace(/\n?$/, '\n') + '```';
      }
      return content;
    }).join('\n\n');
  }

  // 兼容空函数：旧实现里负责同步行号/状态点，单文档模式由 CM6 自行维护
  function updateLineNumbers() {}
  function updateCellMeta() { outline?.refresh?.(); }
  function markModified() {}
  function markRun() {}
  function renumberCells() {}

  // ============== Markdown 渲染 ==============

  let pendingRendererRoots = [];
  let rendererScheduleTimer = null;

  // 渲染器统一调度（插件围栏先于渲染器，与文档站编排一致）。
  // 渲染块是临时 widget，只渲染仍在 DOM 中的容器。
  function scheduleRenderers(root) {
    if (root) pendingRendererRoots.push(root);
    if (rendererScheduleTimer) return;
    rendererScheduleTimer = setTimeout(() => {
      rendererScheduleTimer = null;
      const roots = pendingRendererRoots;
      pendingRendererRoots = [];
      const excluded = mdRender.CELL_RENDERER_EXCLUDED;
      roots.filter(el => el && el.isConnected).forEach(el => {
        const plugins = window.MarkdownPreview.plugins;
        const pluginPass = plugins && typeof plugins.render === 'function'
          ? Promise.resolve(plugins.render({ root: el, documentPath: '' }))
              .catch(e => console.warn('[Editor] Plugin render error:', e))
          : Promise.resolve();
        pluginPass
          .then(() => mdRender.runRenderers(el, { except: excluded }))
          .catch(e => console.warn('[Editor] Renderer render error:', e));
      });
    }, 200);
  }

  function applyMarkdownExtras(el, content, opts) {
    mdRender.groupGalleries(el);
    mdRender.initSliders(el);
    mdRender.highlightCodeBlocks(el);
    mdRender.initCodeTabs(el);
    window.MarkdownPreview.lineHighlight?.apply?.(el);
    mdRender.applyTablePresets?.(el);

    // 标题锚点（与文档站同规则；同名标题追加序号）
    const seenSlugs = new Set();
    el.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      const base = mdRender.slugify(h.textContent) || 'section';
      let id = base;
      let n = 2;
      while (seenSlugs.has(id)) id = `${base}-${n++}`;
      seenSlugs.add(id);
      h.id = id;
    });

    if (opts && opts.tableEdit) tableEditor?.attach?.(el);
    if (!opts || opts.scheduleRenderers !== false) scheduleRenderers(el);
  }

  // 单块渲染（实时预览 widget 用）：同步生成 HTML，重型渲染器延后调度
  function renderBlockInto(el, markdown) {
    // 表格胶囊的「编辑」需要回写本块源码，先把源码挂到渲染容器上
    el.__mdSource = markdown;
    const { html } = mdRender.parseMarkdown(markdown, { alertTypes: EDITOR_ALERT_TYPES });
    el.innerHTML = html;
    // 纯文字块（标题/段落/列表）不需要跑全部渲染器，避免每个块都遍历
    // 整个渲染器注册表；围栏、表格、图片、公式、嵌入等内容才调度。
    const rich = /```|~~~|\$\$|^\s*:::|^\s*<|!\[|^\s*\|/m.test(markdown) ||
      !!el.querySelector('pre, table, img, svg, canvas, .katex');
    applyMarkdownExtras(el, markdown, { tableEdit: false, scheduleRenderers: rich });
  }

  // 整篇渲染（双栏预览 / 导出用）
  function renderCellMarkdown(content, outputElement, opts) {
    const { html } = mdRender.parseMarkdown(content, { alertTypes: EDITOR_ALERT_TYPES });
    outputElement.innerHTML = html;
    applyMarkdownExtras(outputElement, content, { tableEdit: opts && opts.tableEdit });
    outputElement.classList.add('visible');
  }

  function renderSplitPreview() {
    const cell = cells[0];
    if (!cell || !docPreview) return;
    renderCellMarkdown(cell.textarea.value, docPreview, { tableEdit: true });
  }

  function scheduleSplitPreview() {
    if (splitPreviewTimer) clearTimeout(splitPreviewTimer);
    splitPreviewTimer = setTimeout(() => {
      splitPreviewTimer = null;
      if (editorMode === 'split') renderSplitPreview();
    }, 220);
  }

  // ============== 模式：所见即所得 / 源码·预览双栏 ==============

  function updateModeUI() {
    const split = editorMode === 'split';
    document.body.dataset.editorMode = editorMode;
    editorMain.classList.toggle('mode-split', split);
    editorMain.classList.toggle('mode-wysiwyg', !split);
    if (docPreviewPane) docPreviewPane.hidden = !split;
    if (docSplitDivider) docSplitDivider.hidden = !split;
    // 右上角模式图标：双栏模式显示「眼睛」图标（点回所见即所得），反之显示「分栏」
    if (modeSwitch) {
      modeSwitch.innerHTML = split
        ? '<svg class="ico ico-sm"><use href="#i-eye"/></svg>'
        : '<svg class="ico ico-sm"><use href="#i-split"/></svg>';
      modeSwitch.title = split
        ? '返回所见即所得 (Ctrl+Shift+M)'
        : '切换源码/渲染双栏 (Ctrl+Shift+M)';
      modeSwitch.setAttribute('aria-pressed', split ? 'true' : 'false');
    }
    if (statusMode) statusMode.textContent = split ? '双栏模式' : '所见即所得';
  }

  function setEditorMode(mode, opts) {
    opts = opts || {};
    const next = mode === 'split' ? 'split' : 'wysiwyg';
    editorMode = next;
    updateModeUI();
    const cell = cells[0];
    if (cell) {
      // 双栏时关掉块级实时预览，左侧显示纯源码
      cell.editor.setLivePreview(next === 'wysiwyg');
      if (next === 'split') renderSplitPreview();
      setTimeout(() => {
        try { cell.editor.requestMeasure(); } catch (e) { /* ignore */ }
      }, 0);
    }
    if (!opts.silent) {
      try { localStorage.setItem('mdnb_editor_mode', next); } catch (e) { /* ignore */ }
    }
    updateStatusbar();
  }

  function toggleEditorMode() {
    setEditorMode(editorMode === 'wysiwyg' ? 'split' : 'wysiwyg');
  }

  modeSwitch?.addEventListener('click', () => toggleEditorMode());

  // 分隔条拖拽调整左右宽度
  (function initSplitResize() {
    if (!docSplitDivider || !docSourcePane) return;
    let dragging = false;
    docSplitDivider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      document.body.classList.add('doc-split-dragging');
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const rect = editorMain.getBoundingClientRect();
      let width = e.clientX - rect.left;
      width = Math.max(220, Math.min(rect.width - 220, width));
      docSourcePane.style.flex = '0 0 ' + (width / rect.width * 100) + '%';
      try { cells[0]?.editor.requestMeasure(); } catch (err) { /* ignore */ }
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove('doc-split-dragging');
    });
  })();

  // ============== 工具栏：下拉菜单 / 插入 ==============

  function insertAtCursor(editor, text, cursorOffset) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.replaceRange(start, end, text);
    if (cursorOffset) {
      const newPos = start + text.length + cursorOffset;
      editor.setSelectionRange(newPos, newPos);
    }
    editor.focus();
    updateCellMeta(getCell(parseInt(editor.dataset.cellId)));
    updateStatusbar();
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.toolbar-dropdown').forEach(d => d.classList.remove('open'));
  }

  document.querySelectorAll('.toolbar-dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.toolbar-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) dropdown.classList.add('open');
    });
  });

  document.addEventListener('click', closeAllDropdowns);

  // 快速插入按钮点击（下拉菜单项与格式条图标按钮通用）
  document.querySelectorAll('[data-insert]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const cell = getActiveCell();
      if (!cell) return;
      const text = item.dataset.insert.replace(/\\n/g, '\n');
      const cursorOffset = item.dataset.cursor ? parseInt(item.dataset.cursor) : 0;
      insertAtCursor(cell.textarea, text, cursorOffset);
      closeAllDropdowns();
    });
  });

  // 格式按钮（格式条图标 / 标题菜单项），与选中文字浮动工具栏共用 applyFormat
  document.querySelectorAll('[data-format]:not(.sel-btn)').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const cell = getActiveCell();
      if (!cell) return;
      applyFormat(cell.textarea, item.dataset.format);
      closeAllDropdowns();
    });
  });

  // 菜单动作注册表（模块化功能经 ctx.registerMenuAction 挂入）
  const menuActions = {};
  function registerMenuAction(name, fn) { menuActions[name] = fn; }

  document.querySelectorAll('.dropdown-item[data-action]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      if (action === 'download-md') downloadCurrentMd();
      else if (action === 'download-html') downloadCurrentHtml();
      else if (action === 'download-html-inline') downloadCurrentHtmlInline();
      else if (action === 'download-pdf') downloadCurrentPdf();
      else if (action === 'download-notebook') downloadNotebook();
      else if (action === 'import-mdnb') triggerImport('import-mdnb');
      else if (action === 'import-md-cells') triggerImport('import-md-cells');
      else if (action === 'import-md-current') triggerImport('import-md-current');
      else if (menuActions[action]) menuActions[action]();
      else if (action.startsWith('insert-')) handleDynamicInsert(action);
      closeAllDropdowns();
    });
  });

  function pad2(n) { return String(n).padStart(2, '0'); }

  function handleDynamicInsert(action) {
    const cell = getActiveCell();
    if (!cell) return;
    const now = new Date();
    let text = '';

    if (action === 'insert-date') {
      text = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    } else if (action === 'insert-time') {
      text = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    } else if (action === 'insert-datetime') {
      text = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    } else if (action === 'insert-timestamp') {
      text = String(Math.floor(now.getTime() / 1000));
    } else if (action.startsWith('insert-placeholder')) {
      const sizes = {
        'insert-placeholder-300': '300/200',
        'insert-placeholder-600': '600/400',
        'insert-placeholder-1200': '1200/600',
        'insert-placeholder-square': '500/500'
      };
      const size = sizes[action] || '300/200';
      text = `![占位图](https://placehold.co/${size})`;
    }

    if (text) insertAtCursor(cell.textarea, text, 0);
  }

  // ============== 选中文字浮动工具栏 ==============

  // 浮动格式条：选中文字 / 双击单词时出现在选区上方（默认隐藏）
  function updateSelectionToolbar(e) {
    const editor = e.target;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    if (start === end) {
      hideSelectionToolbar();
      return;
    }
    try {
      const view = editor.view;
      const sel = view.state.selection.main;
      const coords = view.coordsAtPos(sel.head);
      if (!coords) return;
      // 先显示再测量（display:none 时宽高为 0）
      fmtFloat.classList.add('visible');
      const rect = fmtFloat.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      let left = coords.left - rect.width / 2;
      left = Math.max(8, Math.min(vw - rect.width - 8, left));
      let top = coords.top - rect.height - 8;
      // 选区贴近页面顶端时放到光标下方，避免被标签栏遮挡
      if (top < 44) top = coords.bottom + 10;
      fmtFloat.style.left = Math.round(left) + 'px';
      fmtFloat.style.top = Math.round(top) + 'px';
    } catch (err) { /* 测量失败不影响编辑 */ }
  }

  function hideSelectionToolbar() {
    fmtFloat?.classList.remove('visible');
  }

  // 在格式条上按下鼠标不转移焦点：编辑器保持选中状态，条不会消失
  fmtFloat?.addEventListener('mousedown', (e) => e.preventDefault());

  function applyFormat(editor, format) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end);

    // 行首前缀类格式在无选区时也允许（对当前行生效）
    const lineStartFormats = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'task', 'task-done', 'quote'];
    if (!selected && !lineStartFormats.includes(format)) {
      return;
    }

    switch (format) {
      case 'bold': editor.wrapSelection('**'); break;
      case 'italic': editor.wrapSelection('*'); break;
      case 'strike': editor.wrapSelection('~~'); break;
      case 'code': editor.wrapSelection('`'); break;
      case 'link': {
        const url = prompt('输入链接 URL:', 'https://');
        if (!url) return;
        const text = selected || '链接文字';
        editor.replaceRange(start, end, `[${text}](${url})`);
        break;
      }
      case 'h1': editor.insertAtLineStart('# '); break;
      case 'h2': editor.insertAtLineStart('## '); break;
      case 'h3': editor.insertAtLineStart('### '); break;
      case 'h4': editor.insertAtLineStart('#### '); break;
      case 'h5': editor.insertAtLineStart('##### '); break;
      case 'h6': editor.insertAtLineStart('###### '); break;
      case 'quote': editor.insertAtLineStart('> '); break;
      case 'ul': editor.insertAtLineStart('- '); break;
      case 'ol': editor.insertAtLineStart('1. '); break;
      case 'task': editor.insertAtLineStart('- [ ] '); break;
      case 'task-done': editor.insertAtLineStart('- [x] '); break;
    }

    editor.focus();
    updateStatusbar();
  }

  // ============== 自动补全 ==============

  let acIndex = -1;
  let acVisible = false;
  let acTextarea = null;
  let acLineStart = 0;
  let acReplaceLength = 0;

  function showAutocomplete(textarea, filter, trigger, lineStart, replaceLength) {
    let candidates = autocompleteItems.filter(it => it.trigger === trigger);
    if (filter) {
      const f = filter.toLowerCase();
      candidates = candidates.filter(it => it.label.toLowerCase().includes(f));
    }
    if (candidates.length === 0) { hideAutocomplete(); return; }

    acTextarea = textarea;
    acLineStart = lineStart;
    acReplaceLength = replaceLength;

    autocompleteList.innerHTML = '';
    candidates.forEach((it, i) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item' + (i === 0 ? ' active' : '');
      div.innerHTML = `<span class="autocomplete-item-label">${it.label}</span><span class="autocomplete-item-desc">${it.desc}</span>`;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        applyAutocomplete(textarea, it, lineStart, replaceLength);
      });
      autocompleteList.appendChild(div);
    });

    let coords = null;
    try {
      const view = textarea.view;
      const pos = view.state.selection.main.head;
      coords = view.coordsAtPos(pos);
    } catch (e) {
      coords = null;
    }
    if (coords) {
      autocompleteList.style.top = (coords.bottom + 4) + 'px';
      autocompleteList.style.left = (coords.left) + 'px';
    }
    autocompleteList.classList.add('visible');
    acIndex = 0;
    acVisible = true;
  }

  function hideAutocomplete() {
    autocompleteList?.classList.remove('visible');
    acVisible = false;
    acIndex = -1;
    acTextarea = null;
  }

  const PAIR_CLOSER = { '[': ']', '(': ')', '{': '}' };
  function pairedCloserOf(prefix) {
    let open = null;
    for (const ch of prefix) {
      if (PAIR_CLOSER[ch]) open = ch;
      else if (open && ch === PAIR_CLOSER[open]) open = null;
    }
    return open ? PAIR_CLOSER[open] : null;
  }

  function applyAutocomplete(editor, item, lineStart, replaceLength) {
    const prefix = editor.value.substring(lineStart, lineStart + replaceLength);
    const closer = pairedCloserOf(prefix);
    editor.replaceAtLineStart(replaceLength, item.insert, closer);
    let delta = 0;
    if (typeof item.cursorOffset === 'number') delta = item.cursorOffset;
    else if (item.insert.endsWith('```')) delta = -4;
    if (delta) {
      const pos = Math.max(lineStart, lineStart + item.insert.length + delta);
      editor.setSelectionRange(pos, pos);
    }
    hideAutocomplete();
    editor.focus();
    updateStatusbar();
  }

  function onTextareaInput(e) {
    const editor = e.target;
    const lineBeforeCursor = editor.getLineBeforeCursor();
    const lineStart = editor.getLineStart();

    if (lineBeforeCursor.match(/^```[\w-]*$/)) {
      showAutocomplete(editor, lineBeforeCursor.substring(3), '```', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^> \[!?[\w]*$/)) {
      const m = lineBeforeCursor.match(/^> \[!?([\w]*)$/);
      showAutocomplete(editor, m ? m[1] : '', '> [!', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^>\s?$/) && !lineBeforeCursor.includes('[')) {
      showAutocomplete(editor, '', '>', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^:::\s*\w*$/)) {
      showAutocomplete(editor, lineBeforeCursor.substring(3).trim(), ':::', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^\|\|$/)) {
      showAutocomplete(editor, '', '||', lineStart, 2);
    } else if (lineBeforeCursor.match(/^-{3,}$/)) {
      showAutocomplete(editor, '', '---', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^-\s?$/)) {
      showAutocomplete(editor, '', '-', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^#{1,6}$/)) {
      showAutocomplete(editor, lineBeforeCursor, '#', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^\|$/)) {
      showAutocomplete(editor, '', '|', lineStart, 1);
    } else if (lineBeforeCursor.match(/^\$\$$/)) {
      showAutocomplete(editor, '', '$$', lineStart, 2);
    } else if (lineBeforeCursor.match(/^!\[?$/)) {
      showAutocomplete(editor, '', '![', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^\[$/)) {
      showAutocomplete(editor, '', '[', lineStart, 1);
    } else if (lineBeforeCursor.match(/^\[pulse\w*$/)) {
      showAutocomplete(editor, '', '[pulse', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^\[\^[\w]*$/)) {
      showAutocomplete(editor, lineBeforeCursor, '[^', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^@\w*$/)) {
      showAutocomplete(editor, lineBeforeCursor.substring(1), '@', lineStart, lineBeforeCursor.length);
    } else if (lineBeforeCursor.match(/^<!--\s?[#\w:-]*$/)) {
      showAutocomplete(editor, lineBeforeCursor.replace(/^<!--\s?/, ''), '<!--', lineStart, lineBeforeCursor.length);
    } else {
      hideAutocomplete();
    }
  }

  // ============== 键盘快捷键 ==============

  function onTextareaKeydown(e) {
    const editor = e.target;

    if (acVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        items[acIndex]?.classList.remove('active');
        acIndex = (acIndex + 1) % items.length;
        items[acIndex]?.classList.add('active');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        items[acIndex]?.classList.remove('active');
        acIndex = (acIndex - 1 + items.length) % items.length;
        items[acIndex]?.classList.add('active');
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        if (items[acIndex]) {
          const label = items[acIndex].querySelector('.autocomplete-item-label').textContent;
          const item = autocompleteItems.find(it => it.label === label);
          if (item) applyAutocomplete(editor, item, acLineStart, acReplaceLength);
        }
        return;
      }
      if (e.key === 'Escape') {
        hideAutocomplete();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        hideAutocomplete();
      }
    }

    // Ctrl/Cmd + Shift + M：所见即所得 ↔ 源码/预览双栏
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      toggleEditorMode();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      findReplace?.openSearchPanel?.();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      findReplace?.openSearchPanel?.();
      setTimeout(() => replaceInput?.focus(), 50);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); applyFormat(editor, 'bold'); return; }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); applyFormat(editor, 'italic'); return; }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); applyFormat(editor, 'link'); return; }
      if (e.key === '`') { e.preventDefault(); applyFormat(editor, 'code'); return; }
    }

    // Tab 缩进由 CM6 原生 indentWithTab 处理
  }

  // ============== 状态栏 ==============

  function updateStatusbar() {
    const cell = getActiveCell();
    if (cell) {
      try {
        const cursor = cell.editor.getCursorPos();
        statusCursor.textContent = `行 ${cursor.line}, 列 ${cursor.col}`;
      } catch (e) { /* ignore */ }
    }
    if (!statusStatsTimer) {
      statusStatsTimer = setTimeout(() => {
        statusStatsTimer = null;
        computeStatusStats();
      }, 300);
    }
  }

  let statusStatsTimer = null;
  function computeStatusStats() {
    const text = cells[0] ? cells[0].textarea.value : '';
    if (statusWords) statusWords.textContent = `${countWords(text)} 字`;
    if (statusLines) statusLines.textContent = `${text ? text.split('\n').length : 0} 行`;
  }

  // ============== 下载 / 导出 ==============

  function docFilename(ext) {
    const title = deriveTitleFromCells();
    const safe = (title || 'document').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 60) || 'document';
    return `${safe}.${ext}`;
  }

  function renderDocToHtml() {
    const cell = cells[0];
    if (!cell) return '';
    const tmp = document.createElement('div');
    renderCellMarkdown(cell.textarea.value, tmp, { tableEdit: false });
    return tmp.innerHTML;
  }

  function downloadCurrentMd() {
    const cell = getActiveCell();
    if (!cell) return;
    const content = cell.textarea.value;
    if (!content.trim()) { showToast(editorT('editor.docEmpty', '文档还是空的')); return; }
    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), docFilename('md'));
  }

  function downloadCurrentHtml() {
    const html = renderDocToHtml();
    if (!html.trim()) { showToast(editorT('editor.docEmpty', '文档还是空的')); return; }
    const fullHtml = buildStandaloneHtml(html, deriveTitleFromCells() || 'Markdown', false);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), docFilename('html'));
  }

  function downloadCurrentHtmlInline() {
    const html = renderDocToHtml();
    if (!html.trim()) { showToast(editorT('editor.docEmpty', '文档还是空的')); return; }
    const fullHtml = buildStandaloneHtml(html, deriveTitleFromCells() || 'Markdown', true);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), docFilename('offline.html'));
  }

  // 构建独立 HTML（离线可用时内联 CSS）
  function buildStandaloneHtml(bodyHtml, title, inlineCss) {
    const styleHrefs = [
      'iris/styles.css',
      'iris/css/galleries.css',
      'iris/vendor/highlight.js/styles/github.css',
      'iris/vendor/katex/katex.min.css'
    ];
    let headExtra = '';
    if (inlineCss) {
      const collected = [];
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        if (!href.startsWith('iris/') && !href.startsWith('/iris/')) return;
        const cssText = tryReadLoadedStylesheet(link);
        if (cssText) collected.push(cssText);
      });
      if (document.body.classList.contains('editor-dark-mode')) {
        collected.push('body{background:#1e1e2e;color:#e0e0e8;}');
      }
      headExtra = `<style>\n${collected.join('\n')}\n</style>`;
    } else {
      headExtra = styleHrefs.map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
    }
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>${headExtra}</head><body><article class="markdown-body" style="max-width:800px;margin:40px auto;padding:0 20px;">${bodyHtml}</article></body></html>`;
  }

  function readSheetRules(sheet, depth) {
    if (!sheet || depth > 5) return '';
    let css = '';
    try {
      for (const rule of sheet.cssRules) {
        if (rule.styleSheet && rule.cssText.startsWith('@import')) {
          css += readSheetRules(rule.styleSheet, depth + 1);
        } else {
          css += rule.cssText + '\n';
        }
      }
    } catch (e) {
      return '';
    }
    return css;
  }

  function tryReadLoadedStylesheet(linkEl) {
    try {
      const sheets = Array.from(document.styleSheets);
      const href = linkEl.href;
      const sheet = sheets.find(s => s.href === href);
      if (!sheet) return '';
      return readSheetRules(sheet, 0);
    } catch (e) {
      return '';
    }
  }

  function downloadCurrentPdf() {
    const html = renderDocToHtml();
    if (!html.trim()) { showToast(editorT('editor.docEmpty', '文档还是空的')); return; }
    const title = deriveTitleFromCells() || 'Markdown';
    const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><link rel="stylesheet" href="iris/styles.css"><link rel="stylesheet" href="iris/css/galleries.css"><link rel="stylesheet" href="iris/vendor/highlight.js/styles/github.css"><link rel="stylesheet" href="iris/vendor/katex/katex.min.css"><style>@media print{body{margin:0;}}</style></head><body><article class="markdown-body" style="max-width:800px;margin:20px auto;padding:0 20px;">${html}</article></body></html>`;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    frame.srcdoc = doc;
    frame.addEventListener('load', () => {
      setTimeout(() => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch (e) {
          showToast(editorT('editor.printFailed', '打印窗口打开失败'));
        }
        setTimeout(() => frame.remove(), 1000);
      }, 500);
    });
    document.body.appendChild(frame);
  }

  // 旧版备份格式（.mdnb）：保留单 cell 结构，便于旧版本反向导入
  function downloadNotebook() {
    const cell = getActiveCell();
    if (!cell) return;
    const data = {
      version: 2,
      type: 'mdnb',
      created: new Date().toISOString(),
      cells: [{ id: 1, type: 'markdown', content: cell.textarea.value, output_html: '' }]
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), docFilename('mdnb'));
  }

  // ============== 导入 ==============

  function triggerImport(mode) {
    if (!fileInput) return;
    fileInput.dataset.mode = mode;
    fileInput.value = '';
    fileInput.click();
  }

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const mode = fileInput.dataset.mode || 'import-md-current';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result || '');
      if (mode === 'import-mdnb') importMdnb(text);
      else if (mode === 'import-md-cells') importMdReplace(text);
      else if (mode === 'import-md-current') importMdInsert(text);
    };
    reader.readAsText(file);
  });

  async function importMdnb(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) {
      showToast(editorT('editor.invalidMdnb', '无效的 .mdnb 文件'));
      return;
    }
    if (!data || !Array.isArray(data.cells)) {
      showToast(editorT('editor.badFileFormat', '文件格式不正确'));
      return;
    }
    const cell = getActiveCell();
    if (cell && cell.textarea.value.trim() && !confirm('导入将替换当前文档，是否继续？')) return;
    setDocContent(mergeCellContents(data.cells));
    updateStatusbar();
    markUnsaved();
    if (editorMode === 'split') scheduleSplitPreview();
    showToast(editorT('editor.importedCells', '已导入 {n} 个 Cell').replace('{n}', data.cells.length));
  }

  function importMdReplace(text) {
    const cell = getActiveCell();
    if (cell && cell.textarea.value.trim() && !confirm('导入将替换当前文档，是否继续？')) return;
    const merged = text.includes('<!-- mdp2:cell -->')
      ? mergeCellContents(text.split(/\n?\s*<!-- mdp2:cell -->\s*\n?/).map(s => ({ content: s })))
      : text;
    setDocContent(merged);
    updateStatusbar();
    markUnsaved();
    if (editorMode === 'split') scheduleSplitPreview();
    showToast(editorT('editor.importedDoc', '已导入 Markdown 文档'));
  }

  function importMdInsert(text) {
    const cell = getActiveCell();
    if (!cell) return;
    cell.textarea.insertText(text);
    updateStatusbar();
    markUnsaved();
    if (editorMode === 'split') scheduleSplitPreview();
    showToast(editorT('editor.importedToCurrent', '已插入到光标处'));
  }

  // ============== 清空文档 ==============

  clearAllBtn?.addEventListener('click', () => {
    if (!confirm('确定清空当前文档吗？此操作不可撤销（可用 Ctrl+Z 撤销）。')) return;
    const cell = getActiveCell();
    if (!cell) return;
    cell.textarea.setValue('');
    updateStatusbar();
    markUnsaved();
    if (editorMode === 'split') renderSplitPreview();
    cell.textarea.focus();
  });

  // ============== 全局事件 ==============

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      toggleEditorMode();
      return;
    }
    if (e.key === 'F3' && findReplace?.isPanelOpen?.()) {
      e.preventDefault();
      if (e.shiftKey) findReplace.searchNavigate(-1);
      else findReplace.searchNavigate(1);
    }
    if (e.key === 'Escape') {
      hideAutocomplete();
      hideSelectionToolbar();
      closeAllDropdowns();
      if (findReplace?.isPanelOpen?.()) findReplace.closeSearchPanel();
    }
  });

  window.addEventListener('scroll', hideSelectionToolbar, true);

  // ============== 自动保存 / 多标签 ==============

  const STORAGE_KEY = 'mdnb_autosave_v2'; // 兼容旧 localStorage key，仅用于迁移
  let NOTEBOOK_ID = 'autosave';
  const storage = window.MarkdownPreview.storage;
  let saveTimer = null;
  let isUnsaved = false;
  let useIndexedDB = storage && storage.isAvailable();

  const tabList = document.getElementById('tabList');
  const tabNewBtn = document.getElementById('tabNewBtn');

  let tabs = [];
  let activeTabId = null;
  let tabCounter = 0;
  let isSwitching = false;
  let pendingTab = null;

  function genTabId() {
    tabCounter++;
    return 'nb-' + Date.now().toString(36) + '-' + tabCounter;
  }

  function defaultTabTitle(index) {
    return '文档 ' + index;
  }

  function deriveTitleFromCells() {
    for (const c of cells) {
      const v = (c.textarea.value || '').trim();
      if (v) {
        const firstLine = v.split(/\r?\n/)[0].replace(/^#+\s*/, '').trim();
        if (firstLine) return firstLine.slice(0, 30);
      }
    }
    return null;
  }

  function getTabById(id) {
    return tabs.find(t => t.id === id);
  }

  function refreshActiveTabTitle() {
    const t = getTabById(activeTabId);
    const derived = deriveTitleFromCells();
    if (t && derived && t.title !== derived) {
      t.title = derived;
      renderTabs();
      persistTabMeta();
    }
  }

  function renderTabs() {
    if (!tabList) return;
    tabList.innerHTML = '';
    tabs.forEach((t, idx) => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (t.id === activeTabId ? ' active' : '') + (t.unsaved ? ' unsaved' : '');
      item.dataset.tabId = t.id;
      item.title = t.title + (t.unsaved ? ' (未保存)' : '');
      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = t.title || defaultTabTitle(idx + 1);
      const dot = document.createElement('span');
      dot.className = 'tab-unsaved-dot';
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.title = '关闭';
      close.innerHTML = '<svg><use href="#i-x"/></svg>';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(t.id);
      });
      item.addEventListener('click', () => switchTab(t.id));
      item.appendChild(titleEl);
      item.appendChild(dot);
      item.appendChild(close);
      tabList.appendChild(item);
    });
    const active = tabList.querySelector('.tab-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function persistTabMeta() {
    if (!useIndexedDB || !storage) return;
    try {
      storage.setMeta('tabOrder', tabs.map(t => ({ id: t.id, title: t.title })));
      storage.setMeta('activeTab', activeTabId);
    } catch (e) { /* ignore */ }
  }

  function serializeNotebook() {
    const cell = cells[0];
    return {
      id: NOTEBOOK_ID,
      version: 2,
      type: 'mdnb-autosave',
      saved: new Date().toISOString(),
      cells: [{
        id: 1,
        type: 'markdown',
        content: cell ? cell.textarea.value : '',
        output_html: ''
      }]
    };
  }

  function autosaveLocalStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function scheduleAutosave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(autosave, 1500);
  }

  const tabRevisions = new Map();
  function bumpRevision(tabId) {
    if (!tabId) return;
    tabRevisions.set(tabId, (tabRevisions.get(tabId) || 0) + 1);
  }

  function markUnsaved() {
    bumpRevision(activeTabId);
    isUnsaved = true;
    if (statusSave) {
      statusSave.textContent = '未保存 *';
      statusSave.style.color = 'var(--color-warning)';
    }
    const t = getTabById(activeTabId);
    if (t && !t.unsaved) {
      t.unsaved = true;
      const derived = deriveTitleFromCells();
      if (derived) t.title = derived;
      renderTabs();
    }
    scheduleAutosave();
  }

  function markSaved(savedTabId, savedRevision) {
    if (savedTabId !== undefined && savedTabId !== activeTabId) {
      const t0 = getTabById(savedTabId);
      const revChanged = savedRevision !== undefined &&
        (tabRevisions.get(savedTabId) || 0) !== savedRevision;
      if (t0 && t0.unsaved && !revChanged) {
        t0.unsaved = false;
        renderTabs();
      }
      return;
    }
    if (savedRevision !== undefined && (tabRevisions.get(savedTabId) || 0) !== savedRevision) {
      return;
    }
    isUnsaved = false;
    if (statusSave) {
      statusSave.textContent = '已保存 ✓';
      statusSave.style.color = 'var(--color-success)';
    }
    const t = getTabById(activeTabId);
    if (t && t.unsaved) {
      t.unsaved = false;
      renderTabs();
    }
  }

  async function autosave() {
    if (restoreDepth > 0) {
      scheduleAutosave();
      return;
    }
    const savedTabId = activeTabId;
    const savedRevision = tabRevisions.get(savedTabId) || 0;
    refreshActiveTabTitle();
    const data = serializeNotebook();
    if (useIndexedDB) {
      try {
        await storage.saveNotebook(data);
        markSaved(savedTabId, savedRevision);
        if (versionSnapshots) versionSnapshots.maybeAutoSnapshot();
      } catch (e) {
        if (autosaveLocalStorage(data)) {
          markSaved(savedTabId, savedRevision);
          showToast(editorT('editor.idbFallback', 'IndexedDB 写入失败，已回退到 localStorage'));
        } else {
          if (statusSave) {
            statusSave.textContent = '保存失败';
            statusSave.style.color = 'var(--color-error)';
          }
          showToast(editorT('editor.autosaveFull', '自动保存失败：存储空间可能已满'));
        }
      }
    } else if (autosaveLocalStorage(data)) {
      markSaved(savedTabId, savedRevision);
      if (versionSnapshots) versionSnapshots.maybeAutoSnapshot();
    } else {
      if (statusSave) {
        statusSave.textContent = '保存失败';
        statusSave.style.color = 'var(--color-error)';
      }
      showToast(editorT('editor.autosaveFull', '自动保存失败：存储空间可能已满'));
    }
  }

  async function restoreFromData(data, opts) {
    opts = opts || {};
    const list = (data && Array.isArray(data.cells)) ? data.cells : [];
    const md = mergeCellContents(list);
    // 启动恢复：用户已经开始输入的文档不被历史记录覆盖
    if (opts.guardUserInput) {
      const current = cells[0] ? cells[0].textarea.value : '';
      if (current.trim()) return false;
    }
    restoreDepth++;
    try {
      if (!cells[0]) createCell();
      setDocContent(md, { skipHistory: true });
      updateStatusbar();
      // 浏览器布局完成后重新测量（切换文档/恢复整篇内容）
      setTimeout(() => { try { cells[0]?.editor.requestMeasure(); } catch (e) {} }, 0);
      findReplace?.invalidateMatches?.();
      if (editorMode === 'split') renderSplitPreview();
    } finally {
      restoreDepth--;
    }
    return list.length > 0;
  }

  async function saveCurrentTabToStorage() {
    if (!useIndexedDB) return;
    const data = serializeNotebook();
    try { await storage.saveNotebook(data); } catch (e) { /* ignore */ }
  }

  async function activateTab(id, opts) {
    opts = opts || {};
    const tab = getTabById(id);
    if (!tab) return;
    if (isSwitching) { pendingTab = { id, opts }; return; }
    isSwitching = true;
    try {
      if (activeTabId && activeTabId !== id) {
        refreshActiveTabTitle();
        try { await saveCurrentTabToStorage(); } catch (e) { /* ignore */ }
      }
      NOTEBOOK_ID = id;
      activeTabId = id;
      let data = opts.initData || null;
      if (!data && useIndexedDB) {
        try { data = await storage.loadNotebook(id); } catch (e) { data = null; }
      }
      await restoreFromData(data || { cells: [] });
      isUnsaved = false;
      markSaved();
      refreshActiveTabTitle();
      renderTabs();
      persistTabMeta();
    } finally {
      isSwitching = false;
      if (pendingTab && pendingTab.id !== activeTabId) {
        const next = pendingTab;
        pendingTab = null;
        activateTab(next.id, next.opts);
      } else {
        pendingTab = null;
      }
    }
  }

  async function switchTab(id) {
    if (id === activeTabId) return;
    await activateTab(id);
  }

  async function createTab(opts) {
    opts = opts || {};
    if (!opts.skipSaveCurrent && activeTabId && tabs.length > 0) {
      try { await saveCurrentTabToStorage(); } catch (e) { /* ignore */ }
    }
    const id = opts.id || genTabId();
    const tab = { id, title: opts.title || defaultTabTitle(tabs.length + 1), unsaved: false };
    tabs.push(tab);
    if (!opts.skipSwitch) {
      await activateTab(tab.id, { initData: opts.initData || null });
    }
    persistTabMeta();
    return tab;
  }

  async function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tab = tabs[idx];
    const cell = getActiveCell();
    if (id === activeTabId && tab.unsaved && cell && cell.textarea.value.trim()) {
      if (!confirm(`「${tab.title}」还有未保存的修改，关闭后仍会保留在浏览器缓存中。确定关闭标签吗？`)) {
        return;
      }
    }
    tabs.splice(idx, 1);
    if (useIndexedDB) {
      try { await storage.deleteNotebook(id); } catch (e) { /* ignore */ }
    }
    if (tabs.length === 0) {
      await createTab({ skipSaveCurrent: true });
    } else if (activeTabId === id) {
      activeTabId = null;
      await activateTab(tabs[Math.min(idx, tabs.length - 1)].id);
    } else {
      renderTabs();
    }
    persistTabMeta();
    showToast(editorT('editor.tabClosed', '已关闭「{t}」').replace('{t}', tab.title));
  }

  tabNewBtn?.addEventListener('click', () => createTab());

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      createTab();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault();
      if (tabs.length < 2) return;
      const idx = tabs.findIndex(t => t.id === activeTabId);
      if (idx === -1) return;
      const nextIdx = e.shiftKey
        ? (idx - 1 + tabs.length) % tabs.length
        : (idx + 1) % tabs.length;
      switchTab(tabs[nextIdx].id);
    }
  });

  function readLocalStorageBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return (data && Array.isArray(data.cells)) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function deriveTabTitleFromData(data) {
    if (!data || !Array.isArray(data.cells)) return null;
    for (const c of data.cells) {
      const v = (c.content || '').trim();
      if (v) {
        const firstLine = v.split(/\r?\n/)[0].replace(/^#+\s*/, '').trim();
        if (firstLine) return firstLine.slice(0, 30);
      }
    }
    return null;
  }

  // 启动恢复拦截：默认文档已被输入过就不再被历史数据覆盖
  function hadBootInput() {
    return !!(cells[0] && cells[0].textarea.value.trim());
  }

  async function loadAutosave() {
    try {
      if (useIndexedDB) {
        let tabOrder = null;
        let savedActive = null;
        try {
          tabOrder = await storage.getMeta('tabOrder');
          savedActive = await storage.getMeta('activeTab');
        } catch (e) { /* ignore */ }

        if (Array.isArray(tabOrder) && tabOrder.length) {
          const valid = [];
          for (const t of tabOrder) {
            try {
              const d = await storage.loadNotebook(t.id);
              if (d) valid.push({ id: t.id, title: t.title || defaultTabTitle(valid.length + 1), unsaved: false });
            } catch (e) { /* ignore */ }
          }
          if (valid.length) {
            tabs = valid;
            const target = valid.find(t => t.id === savedActive) ? savedActive : valid[0].id;
            activeTabId = target;
            NOTEBOOK_ID = target;
            renderTabs();
            const data = await storage.loadNotebook(target);
            // 恢复前用户已经输入：不覆盖（restoreFromData 内部拦截），并保持未保存状态
            const blocked = hadBootInput();
            await restoreFromData(data || { cells: [] }, { guardUserInput: true });
            if (blocked) markUnsaved(); else markSaved();
            refreshActiveTabTitle();
            persistTabMeta();
            return !blocked && !!(data && Array.isArray(data.cells) && data.cells.length);
          }
        }

        // 旧版本：无 tabOrder 但有 autosave 笔记本 / localStorage 旧键
        let legacy = null;
        try { legacy = await storage.loadNotebook('autosave'); } catch (e) { legacy = null; }
        if (!legacy) {
          try { legacy = await storage.migrateFromLocalStorage(STORAGE_KEY, 'autosave'); } catch (e) { legacy = null; }
        }
        const backup = readLocalStorageBackup();
        if (backup && (!legacy || (backup.saved || '') > (legacy.saved || ''))) legacy = backup;
        if (legacy) {
          tabs = [{ id: legacy.id || 'autosave', title: deriveTabTitleFromData(legacy) || defaultTabTitle(1), unsaved: false }];
          activeTabId = tabs[0].id;
          NOTEBOOK_ID = activeTabId;
          renderTabs();
          const blocked = hadBootInput();
          await restoreFromData(legacy, { guardUserInput: true });
          if (blocked) markUnsaved(); else markSaved();
          persistTabMeta();
          return !blocked;
        }
        return false;
      }

      // IndexedDB 不可用：localStorage 单文档兜底
      const data = readLocalStorageBackup();
      if (data) {
        tabs = [{ id: 'autosave', title: deriveTabTitleFromData(data) || defaultTabTitle(1), unsaved: false }];
        activeTabId = 'autosave';
        NOTEBOOK_ID = 'autosave';
        renderTabs();
        const blocked = hadBootInput();
        await restoreFromData(data, { guardUserInput: true });
        if (blocked) markUnsaved(); else markSaved();
        return !blocked;
      }
      return false;
    } catch (e) {
      console.warn('[autosave] 恢复失败:', e);
      return false;
    }
  }

  window.addEventListener('beforeunload', () => {
    if (restoreDepth > 0) return;
    if (isUnsaved) {
      const data = serializeNotebook();
      if (useIndexedDB) {
        try { storage.saveNotebook(data); } catch (e) { /* ignore */ }
        try { storage.setMeta('tabOrder', tabs.map(t => ({ id: t.id, title: t.title }))); } catch (e) { /* ignore */ }
        try { storage.setMeta('activeTab', activeTabId); } catch (e) { /* ignore */ }
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    }
  });

  // ============== 字号 / 主题 ==============

  function applyFontSize(size) {
    cells.forEach(c => c.editor.setFontSize(size));
    document.documentElement.style.setProperty('--doc-editor-font-size', size + 'px');
    try { localStorage.setItem('mdnb_fontsize', String(size)); } catch (e) { /* ignore */ }
    document.querySelectorAll('.font-size-item').forEach(it => {
      it.classList.toggle('active', parseInt(it.dataset.size) === size);
    });
  }

  fontSizeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = fontSizeBtn.getBoundingClientRect();
    fontSizeMenu.style.top = (rect.bottom + 4) + 'px';
    fontSizeMenu.style.left = rect.left + 'px';
    fontSizeMenu.classList.toggle('visible');
  });

  document.querySelectorAll('.font-size-item').forEach(item => {
    item.addEventListener('click', () => {
      applyFontSize(parseInt(item.dataset.size));
      fontSizeMenu.classList.remove('visible');
    });
  });

  document.addEventListener('click', (e) => {
    if (fontSizeMenu && !fontSizeMenu.contains(e.target) && e.target !== fontSizeBtn) {
      fontSizeMenu.classList.remove('visible');
    }
  });

  function applyEditorDarkMode(isDark) {
    document.body.classList.toggle('editor-dark-mode', isDark);
    cells.forEach(c => c.editor.setDarkMode(isDark));
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = isDark
        ? '<svg class="ico"><use href="#i-sun"/></svg>'
        : '<svg class="ico"><use href="#i-moon"/></svg>';
    }
  }

  function siteModeDark() {
    return document.documentElement.getAttribute('data-mode') === 'dark';
  }

  function sessionEditorDark() {
    try { return sessionStorage.getItem('mdnb_theme'); } catch (e) { return null; }
  }

  function loadTheme() {
    const saved = sessionEditorDark();
    const isDark = saved === 'dark' ? true : saved === 'light' ? false : siteModeDark();
    applyEditorDarkMode(isDark);
  }

  themeToggleBtn?.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('editor-dark-mode');
    applyEditorDarkMode(isDark);
    try { sessionStorage.setItem('mdnb_theme', isDark ? 'dark' : 'light'); } catch (e) { /* ignore */ }
  });

  window.addEventListener('themechange', () => {
    if (sessionEditorDark() === null) applyEditorDarkMode(siteModeDark());
  });

  // ============== 初始化 ==============

  loadTheme();
  createCell(); // 先创建空文档，避免界面空白
  markSaved();

  // 对外最小 API：便于控制台/宿主页面读写当前文档与切换模式
  window.MarkdownPreview.editor = {
    getValue: () => (cells[0] ? cells[0].textarea.value : ''),
    setValue: (text, opts) => {
      setDocContent(String(text == null ? '' : text), opts);
      updateStatusbar();
      markUnsaved();
      if (editorMode === 'split') renderSplitPreview();
    },
    getMode: () => editorMode,
    setMode: (mode) => setEditorMode(mode),
    toggleMode: () => toggleEditorMode(),
    setSelection: (start, end) => {
      const cell = cells[0];
      if (!cell) return;
      try {
        // 先聚焦再设选区：select 事件在已聚焦状态下才会触发浮动作标注定位
        cell.editor.focus();
        cell.editor.setSelectionRange(Math.max(0, start), Math.max(0, end == null ? start : end));
      } catch (e) { /* ignore */ }
    },
    focus: () => { try { cells[0] && cells[0].textarea.focus(); } catch (e) {} }
  };

  // 恢复上次字号
  try {
    const savedSize = parseInt(localStorage.getItem('mdnb_fontsize'));
    if (savedSize) applyFontSize(savedSize);
  } catch (e) { /* ignore */ }

  // ===== 子系统注入 =====
  findReplace = window.MarkdownPreview.editorModules.findReplace.init({
    searchPanel, searchInput, replaceInput, searchInfo, searchBtn,
    getCells: () => cells,
    getCell,
    getActiveCell,
    setActiveCellId: (id) => { activeCellId = id; },
    updateCellMeta,
    markModified,
    markUnsaved
  });

  mediaUpload.init({
    editorT,
    showToast,
    markUnsaved,
    insertAtCursor,
    imageUploadBtn,
    imageUploadPopover,
    setActiveCellId: (id) => { activeCellId = id; }
  });

  const mermaidPipMod = window.MarkdownPreview.editorModules.mermaidPip;
  mermaidPip = mermaidPipMod ? mermaidPipMod.init({ editorT }) : null;

  const outlineMod = window.MarkdownPreview.editorModules.outline;
  outline = outlineMod ? outlineMod.init({ editorT, getCells: () => cells }) : null;

  const aiMod = window.MarkdownPreview.editorModules.editorAI;
  if (aiMod) {
    try {
      aiMod.init({
        editorT, showToast,
        getCells: () => cells,
        getActiveCellId: () => activeCellId
      });
    } catch (e) {
      console.error('[editor] AI 助手初始化失败（不影响其余编辑器功能）:', e);
    }
  }

  const tableEditorMod = window.MarkdownPreview.editorModules.tableEditor;
  tableEditor = tableEditorMod ? tableEditorMod.init({
    editorT, showToast,
    getCells: () => cells,
    afterSourceEdit: () => {
      markUnsaved();
      updateStatusbar();
      if (editorMode === 'split') renderSplitPreview();
    }
  }) : null;

  // 表格胶囊的「编辑」：区分双栏预览（整篇映射）与 WYSIWYG 渲染块（按块回写）
  document.addEventListener('mdt-edit-table', (e) => {
    const table = e.detail && e.detail.table;
    if (!table || !table.isConnected || !tableEditor) return;
    const cell = getActiveCell();
    if (!cell) return;

    // 双栏预览：输出容器即 docPreview，现有指纹映射可直接用
    if (table.closest('#docPreview')) {
      tableEditor.openEditor(cell, table);
      return;
    }

    // WYSIWYG 渲染块：以「当前块」为源码范围打开网格编辑器
    const body = table.closest('.lp-block-body');
    const wrap = body && body.closest('.lp-block');
    const source = body && body.__mdSource;
    if (!body || !wrap || typeof source !== 'string') return;

    let from = -1;
    try { from = cell.editor.view.posAtDOM(wrap, 0); } catch (err) { from = -1; }
    if (from < 0) return;

    const proxy = {
      type: 'markdown',
      output: body,
      textarea: {
        get value() { return source; },
        setValue(newText) {
          const cur = cell.textarea.value;
          let at = from;
          if (cur.slice(at, at + source.length) !== source) {
            // 块上方内容被改过导致位置漂移：按块源码重新定位
            at = cur.indexOf(source);
            if (at < 0) {
              showToast(editorT('tbl.locateFailed', '找不到表格所在段落，已取消回写'));
              return;
            }
          }
          cell.textarea.setValue(cur.slice(0, at) + newText + cur.slice(at + source.length));
        }
      }
    };
    tableEditor.openEditor(proxy, table);
  });

  // 模板脚手架：命令面板 / 「导入」菜单「从模板新建」经此建新标签
  window.MarkdownPreview.editorCreateTab = (initData, title) => {
    return createTab({ initData, title, skipSaveCurrent: true });
  };
  registerMenuAction('new-from-template', () => {
    window.MarkdownPreview.docTemplates?.openPicker?.();
  });

  // 仓库文档 → 编辑器标签的路径登记（「与 git HEAD 对比」用）
  const editorRepoPaths = window.MarkdownPreview.editorRepoPaths =
    window.MarkdownPreview.editorRepoPaths || new Map();
  registerMenuAction('diff-vs-head', () => {
    const repoPath = editorRepoPaths.get(activeTabId);
    if (!repoPath) {
      showToast(editorT('editor.notFromRepo', '当前文档不是从仓库打开的（用「在编辑器打开当前文档」试试）'));
      return;
    }
    const cell = getActiveCell();
    window.MarkdownPreview.gitHistory?.openWorkingDiff?.(repoPath, cell ? cell.textarea.value : '');
  });

  const versionSnapshotsMod = window.MarkdownPreview.editorModules.versionSnapshots;
  if (versionSnapshotsMod) {
    versionSnapshots = versionSnapshotsMod.init({
      editorT, showToast,
      getNotebookId: () => NOTEBOOK_ID,
      getCells: () => cells,
      restoreCells: async (cellsData) => {
        if (!Array.isArray(cellsData)) return;
        restoreDepth++;
        try {
          setDocContent(mergeCellContents(cellsData), { skipHistory: true });
          updateStatusbar();
        } finally {
          restoreDepth--;
        }
        markUnsaved();
        if (editorMode === 'split') renderSplitPreview();
      },
      registerMenuAction
    });
  }

  // 取件箱消费统一延迟到 loadAutosave 之后
  function consumePendingEditorJobs() {
    window.MarkdownPreview.docTemplates?.consumePending?.();
    const pendingDoc = window.MarkdownPreview.editorPendingContent;
    if (pendingDoc) {
      window.MarkdownPreview.editorPendingContent = null;
      createTab({ initData: pendingDoc.initData, title: pendingDoc.title, skipSaveCurrent: true })
        .then(tab => { if (pendingDoc.repoPath) editorRepoPaths.set(tab.id, pendingDoc.repoPath); });
    }
  }

  // 初始模式：URL 参数 > 上次会话模式 > 所见即所得
  let bootMode = 'wysiwyg';
  try {
    const p = new URLSearchParams(window.location.search).get('view');
    const saved = localStorage.getItem('mdnb_editor_mode');
    bootMode = p === 'split' ? 'split' : p === 'wysiwyg' ? 'wysiwyg' : (saved === 'split' ? 'split' : 'wysiwyg');
  } catch (e) { /* ignore */ }
  setEditorMode(bootMode, { silent: true });

  loadAutosave().then(restored => {
    consumePendingEditorJobs();
    if (restored) {
      showToast(editorT('editor.sessionRestored', '已恢复上次会话'));
    } else if (tabs.length === 0) {
      return createTab({ skipSaveCurrent: true });
    }
  }).catch(e => {
    console.warn('[autosave] 恢复失败:', e);
    if (tabs.length === 0) createTab({ skipSaveCurrent: true }).catch(() => {});
  });

  } // end initEditor()

  // 页面加载后检查是否需要进入编辑器模式
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkEditorMode);
  } else {
    checkEditorMode();
  }

})();
