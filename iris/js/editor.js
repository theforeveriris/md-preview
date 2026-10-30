(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 编辑器模式切换 ==============
  const editorOverlay = document.getElementById('editorOverlay');
  let editorInitialized = false;

  function enterEditorMode() {
    if (!editorOverlay) return;
    // 必须用 flex 而非 block，否则 .editor-overlay 的 flex 布局失效，
    // .editor-main 无法获得剩余高度，导致无法滚动
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

  // 暴露给外部调用
  window.MarkdownPreview.enterEditorMode = enterEditorMode;
  window.MarkdownPreview.exitEditorMode = exitEditorMode;

  // 根据 URL 参数自动进入编辑器模式
  function checkEditorMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'editor') {
      enterEditorMode();
    }
  }

  // 退出按钮
  document.getElementById('exitEditorBtn')?.addEventListener('click', exitEditorMode);

  function initEditor() {

  // ============== 状态 ==============
  // 恢复/导入是异步的（output_html 净化要 await）：期间 cells 只重建了一部分，
  // 若自动保存此刻触发，会把「半成品」用同一个 notebook id 覆盖完整记录。
  // 用计数器覆盖整个生命周期，autosave / beforeunload 检测到就延后/跳过。
  let restoreDepth = 0;
  let cells = [];
  let cellCounter = 0;
  let activeCellId = null;
  let contextMenuCellId = null;
  let globalAddBtn = null;

  // ============== 画廊样式注册（来自共享渲染模块） ==============
  const mdRender = window.MarkdownPreview.mdRender;
  const knownStyles = mdRender.KNOWN_STYLES;
  // editor.js 使用 SVG 版本的 Alert 图标
  const svgWrap = (path) => `<svg class="alert-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const EDITOR_ALERT_TYPES = {
    NOTE:     { icon: svgWrap('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'), title: 'Note' },
    IMPORTANT:{ icon: svgWrap('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'), title: 'Important' },
    WARNING:  { icon: svgWrap('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>'), title: 'Warning' },
    TIP:      { icon: svgWrap('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3v1h6v-1c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'), title: 'Tip' },
    CAUTION:  { icon: svgWrap('<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>'), title: 'Caution' }
  };

  // ============== 自动补全：多触发器条目库 ==============
  // 条目库已外移至 iris/js/editor/completions.js（纯静态数据，editor.js 拆分第一批）
  const autocompleteItems = window.MarkdownPreview.editorCompletions;


  // ============== DOM 引用 ==============
  const editorMain = document.getElementById('editorMain');
  const runCurrentBtn = document.getElementById('runCurrentBtn');
  const runAllBtn = document.getElementById('runAllBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const autocompleteList = document.getElementById('autocompleteList');
  const selectionToolbar = document.getElementById('selectionToolbar');
  const contextMenu = document.getElementById('contextMenu');
  const cellCountBadge = document.getElementById('cellCountBadge');
  const statusCellCount = document.getElementById('statusCellCount');
  const statusWords = document.getElementById('statusWords');
  const statusLines = document.getElementById('statusLines');
  const statusCursor = document.getElementById('statusCursor');
  const statusActive = document.getElementById('statusActive');
  const statusRunStats = document.getElementById('statusRunStats');
  const statusCurCellWords = document.getElementById('statusCurCellWords');
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

  // ============== 双屏编辑模式 ==============
  // 将某个 Cell 的 CodeMirror host 移动到双屏 overlay 左侧，右侧实时预览渲染结果。
  // 退出时把 host 移回原 Cell，CodeMirror 实例与撤销栈保持不变，其它 Cell 完全不受影响。
  const dualPaneOverlay = document.getElementById('dualPaneOverlay');
  const dualPaneLeft = document.getElementById('dualPaneLeft');
  const dualPaneRight = document.getElementById('dualPaneRight');
  const dualPanePreview = document.getElementById('dualPanePreview');
  const dualPaneCellNum = document.getElementById('dualPaneCellNum');
  const dualPaneCloseBtn = document.getElementById('dualPaneCloseBtn');
  const dualPaneSyncBtn = document.getElementById('dualPaneSyncBtn');
  const dualPaneDivider = document.getElementById('dualPaneDivider');

  let dualPaneState = null; // { cell, originalHostParent, inputHandler, escHandler }

  function renderDualPanePreview(content) {
    if (!dualPaneState) return;
    // 复用 Cell 渲染管线：parseMarkdown + 画廊/代码高亮 + 各渲染器
    renderCellMarkdown(content, dualPanePreview);
  }

  function openDualPane(id) {
    const cell = getCell(id);
    if (!cell) return;
    if (dualPaneState) closeDualPane(); // 防止重复打开

    const cmHost = cell.div.querySelector('.cell-cm-host');
    const originalHostParent = cmHost.parentElement; // .cell-editor-wrap

    dualPaneCellNum.textContent = id;
    // 把 CodeMirror host 移入左侧（实例不变，撤销栈保留）
    dualPaneLeft.appendChild(cmHost);

    // 初始渲染一次
    renderDualPanePreview(cell.textarea.value);

    // 输入时实时预览（防抖 250ms，避免渲染器频繁重入）。
    // 计时器存到 dualPaneState 上：闭包局部变量外部清不到，closeDualPane
    // 的 clearTimeout 会永远扑空（旧 Bug）
    const paneState = { cell, cmHost, originalHostParent, inputHandler: null, escHandler: null, debounceTimer: null };
    const inputHandler = () => {
      updateCellMeta(cell);
      markUnsaved();
      updateStatusbar();
      if (paneState.debounceTimer) clearTimeout(paneState.debounceTimer);
      paneState.debounceTimer = setTimeout(() => {
        renderDualPanePreview(cell.textarea.value);
      }, 250);
    };
    cell.textarea.addEventListener('input', inputHandler);

    // Esc 退出
    const escHandler = (e) => {
      if (e.key === 'Escape' && dualPaneState) {
        e.preventDefault();
        closeDualPane();
      }
    };
    document.addEventListener('keydown', escHandler);

    paneState.inputHandler = inputHandler;
    paneState.escHandler = escHandler;
    dualPaneState = paneState;

    dualPaneOverlay.classList.add('visible');
    document.body.classList.add('dual-pane-active');

    // CodeMirror 重新挂载后需要重新测量视口，延迟 focus 触发刷新
    setTimeout(() => {
      try { cell.textarea.focus(); } catch (e) {}
    }, 50);
  }

  function closeDualPane() {
    if (!dualPaneState) return;
    const { cell, cmHost, originalHostParent, inputHandler, escHandler, debounceTimer } = dualPaneState;
    if (debounceTimer) clearTimeout(debounceTimer);

    cell.textarea.removeEventListener('input', inputHandler);
    document.removeEventListener('keydown', escHandler);

    // 把 CodeMirror host 移回原 Cell 的编辑区容器
    if (cmHost && originalHostParent) {
      originalHostParent.appendChild(cmHost);
    }

    // 清空预览区，避免残留渲染器实例/监听
    dualPanePreview.innerHTML = '';

    dualPaneOverlay.classList.remove('visible');
    document.body.classList.remove('dual-pane-active');

    dualPaneState = null;

    // 移回后重新测量 CodeMirror
    setTimeout(() => {
      try { cell.textarea.focus(); } catch (e) {}
    }, 50);
  }

  dualPaneCloseBtn.addEventListener('click', closeDualPane);

  // 同步滚动：左侧滚动时，右侧按比例滚动
  let syncScrollEnabled = true;
  dualPaneSyncBtn.addEventListener('click', () => {
    syncScrollEnabled = !syncScrollEnabled;
    dualPaneSyncBtn.classList.toggle('active', syncScrollEnabled);
  });
  dualPaneLeft.addEventListener('scroll', () => {
    if (!syncScrollEnabled || !dualPaneState) return;
    const ratio = dualPaneLeft.scrollTop / Math.max(1, dualPaneLeft.scrollHeight - dualPaneLeft.clientHeight);
    dualPaneRight.scrollTop = ratio * Math.max(1, dualPaneRight.scrollHeight - dualPaneRight.clientHeight);
  });

  // 拖拽分隔条调整左右宽度
  let dragResizing = false;
  dualPaneDivider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragResizing) return;
    const rect = dualPaneOverlay.querySelector('.dual-pane-body').getBoundingClientRect();
    let leftWidth = e.clientX - rect.left;
    // 限制最小宽度，避免某一侧消失
    leftWidth = Math.max(160, Math.min(rect.width - 160, leftWidth));
    const leftPct = (leftWidth / rect.width) * 100;
    dualPaneLeft.style.flex = '0 0 ' + leftPct + '%';
    dualPaneRight.style.flex = '1 1 ' + (100 - leftPct) + '%';
  });
  document.addEventListener('mouseup', () => {
    if (!dragResizing) return;
    dragResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // ============== Cell 管理 ==============

  function createCell(afterCellId, initialContent, opts) {
    opts = opts || {};
    cellCounter++;
    const id = cellCounter;
    const cellType = opts.type || 'markdown'; // 'markdown' | 'plaintext'

    const cellDiv = document.createElement('div');
    cellDiv.className = 'cell cell-type-' + cellType;
    cellDiv.dataset.cellId = id;
    cellDiv.dataset.cellType = cellType;

    cellDiv.innerHTML = `
      <div class="cell-header">
        <div class="cell-header-left">
          <span class="cell-number">
            <span class="cell-status-dot"></span>
            Cell [<span class="cell-num">${id}</span>]
          </span>
          <span class="cell-type-badge">${cellType === 'plaintext' ? 'TXT' : 'MD'}</span>
          <span class="cell-meta cell-lines">0 行</span>
        </div>
        <div class="cell-header-right">
          <button class="cell-action-btn cell-run-btn" data-cell-id="${id}" title="运行 (Ctrl+Enter)"><svg class="ico ico-sm"><use href="#i-play"/></svg></button>
          <button class="cell-action-btn cell-split-btn" data-cell-id="${id}" title="双屏编辑"><svg class="ico ico-sm"><use href="#i-split"/></svg></button>
          <button class="cell-action-btn cell-collapse-btn" data-cell-id="${id}" title="折叠/展开"><svg class="ico ico-sm"><use href="#i-chevron-right"/></svg></button>
          <button class="cell-action-btn cell-up-btn" data-cell-id="${id}" title="上移"><svg class="ico ico-sm"><use href="#i-arrow-up"/></svg></button>
          <button class="cell-action-btn cell-down-btn" data-cell-id="${id}" title="下移"><svg class="ico ico-sm"><use href="#i-arrow-down"/></svg></button>
          <button class="cell-action-btn cell-duplicate-btn" data-cell-id="${id}" title="复制"><svg class="ico ico-sm"><use href="#i-copy"/></svg></button>
          <button class="cell-action-btn cell-delete-btn" data-cell-id="${id}" title="删除"><svg class="ico ico-sm"><use href="#i-x"/></svg></button>
        </div>
      </div>
      <div class="cell-editor-wrap">
        <div class="cell-cm-host" data-cell-id="${id}"></div>
      </div>
      <div class="cell-output markdown-body" data-cell-id="${id}"></div>
      <div class="cell-output-toolbar" data-cell-id="${id}">
        <button class="cell-output-toolbar-btn" data-out-action="copy-html">复制 HTML</button>
        <button class="cell-output-toolbar-btn" data-out-action="clear">清空输出</button>
        <button class="cell-output-toolbar-btn" data-out-action="collapse">折叠输出</button>
        <button class="cell-output-toolbar-btn" data-out-action="export">导出此 Cell</button>
      </div>
    `;

    // 创建 CodeMirror 6 编辑器实例（替代 textarea）
    const cmHost = cellDiv.querySelector('.cell-cm-host');
    const isDark = document.body.classList.contains('editor-dark-mode');
    const editor = new window.CodeMirrorEditor(cmHost, {
      value: initialContent || '',
      placeholder: cellType === 'plaintext' ? '输入纯文本（不渲染）...' : '输入 Markdown...',
      dark: isDark,
    });
    editor.dataset.cellId = String(id);

    const cellData = {
      id,
      div: cellDiv,
      editor,
      textarea: editor, // 兼容别名：大量现有代码通过 cell.textarea.value 访问
      output: cellDiv.querySelector('.cell-output'),
      outputToolbar: cellDiv.querySelector('.cell-output-toolbar'),
      statusDot: cellDiv.querySelector('.cell-status-dot'),
      linesLabel: cellDiv.querySelector('.cell-lines'),
      typeBadge: cellDiv.querySelector('.cell-type-badge'),
      collapseBtn: cellDiv.querySelector('.cell-collapse-btn'),
      type: cellType,
      lastRunContent: ''
    };
    cells.push(cellData);

    // 插入到 DOM：在全局 addBtn 之前插入
    if (afterCellId) {
      const afterCell = getCell(afterCellId);
      if (afterCell) {
        afterCell.div.after(cellDiv);
      } else {
        editorMain.insertBefore(cellDiv, globalAddBtn);
      }
    } else {
      editorMain.insertBefore(cellDiv, globalAddBtn);
    }

    // 恢复字号（CM6 实例需要单独设置）
    try {
      const savedSize = parseInt(localStorage.getItem('mdnb_fontsize'));
      if (savedSize) editor.setFontSize(savedSize);
    } catch (e) {}

    // 事件绑定
    bindCellEvents(cellData);

    activeCellId = id;
    renumberCells();
    updateStatusbar();
    editor.focus();

    return cellData;
  }

  function bindCellEvents(cellData) {
    const { id, textarea, div, outputToolbar, collapseBtn } = cellData;

    textarea.addEventListener('focus', () => {
      activeCellId = id;
      document.querySelectorAll('.cell.cell-active').forEach(c => c.classList.remove('cell-active'));
      div.classList.add('cell-active');
      updateStatusbar();
      mermaidPip?.onCellActivity?.(cellData);
    });

    textarea.addEventListener('input', () => {
      onTextareaInput({ target: textarea });
      updateCellMeta(cellData);
      markModified(cellData);
      markUnsaved();
      updateStatusbar();
      // 内容已变，旧偏移的查找匹配失效（外移模块：find-replace.js）
      findReplace.invalidateMatches();
      mermaidPip?.onCellActivity?.(cellData);
    });

    textarea.addEventListener('keydown', onTextareaKeydown);
    textarea.addEventListener('keyup', () => { updateStatusbar(); mermaidPip?.onCellActivity?.(cellData); });
    textarea.addEventListener('click', () => { updateStatusbar(); mermaidPip?.onCellActivity?.(cellData); });
    textarea.addEventListener('select', () => updateSelectionToolbar({ target: textarea }));
    textarea.addEventListener('mouseup', () => updateSelectionToolbar({ target: textarea }));
    textarea.addEventListener('blur', () => {
      setTimeout(hideSelectionToolbar, 150);
      setTimeout(hideAutocomplete, 150);
    });

    // 拖拽排序：手柄是 cell-number 徽标（编辑区文本拖拽不受影响）
    const dragHandle = div.querySelector('.cell-number');
    if (dragHandle) {
      dragHandle.draggable = true;
      dragHandle.title = '拖动调整 Cell 顺序';
      dragHandle.style.cursor = 'grab';
      dragHandle.addEventListener('dragstart', (e) => {
        draggingCellId = id;
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(id)); } catch (err) { /* ignore */ }
        requestAnimationFrame(() => div.classList.add('cell-dragging'));
      });
      dragHandle.addEventListener('dragend', () => {
        draggingCellId = null;
        div.classList.remove('cell-dragging');
        document.querySelectorAll('.cell-drag-over-top, .cell-drag-over-bottom')
          .forEach(el => el.classList.remove('cell-drag-over-top', 'cell-drag-over-bottom'));
      });
    }
    div.addEventListener('dragover', (e) => {
      if (draggingCellId == null || draggingCellId === id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = div.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      div.classList.toggle('cell-drag-over-top', before);
      div.classList.toggle('cell-drag-over-bottom', !before);
    });
    div.addEventListener('dragleave', () => {
      div.classList.remove('cell-drag-over-top', 'cell-drag-over-bottom');
    });
    div.addEventListener('drop', (e) => {
      if (draggingCellId == null || draggingCellId === id) return;
      e.preventDefault();
      const rect = div.getBoundingClientRect();
      moveCellOnto(draggingCellId, id, e.clientY < rect.top + rect.height / 2);
    });

    div.querySelector('.cell-run-btn').addEventListener('click', () => runCell(id));
    div.querySelector('.cell-split-btn').addEventListener('click', () => openDualPane(id));
    div.querySelector('.cell-delete-btn').addEventListener('click', () => deleteCell(id));
    div.querySelector('.cell-up-btn').addEventListener('click', () => moveCell(id, -1));
    div.querySelector('.cell-down-btn').addEventListener('click', () => moveCell(id, 1));
    div.querySelector('.cell-duplicate-btn').addEventListener('click', () => duplicateCell(id));
    collapseBtn.addEventListener('click', () => toggleCellCollapse(cellData));

    // 输出工具栏
    outputToolbar.querySelectorAll('.cell-output-toolbar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.outAction;
        if (action === 'copy-html') copyOutputHtml(cellData);
        else if (action === 'clear') clearOutput(cellData);
        else if (action === 'collapse') cellData.div.classList.toggle('cell-output-collapsed');
        else if (action === 'export') exportCellStandalone(cellData);
      });
    });

    // 右键菜单
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenuCellId = id;
      showContextMenu(e.clientX, e.clientY);
    });

    // 图片粘贴：检测剪贴板中的图片文件
    div.addEventListener('paste', (e) => {
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

    // 图片拖拽：dragover 阻止默认以允许 drop
    div.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        div.classList.add('drag-over');
      }
    });
    div.addEventListener('dragleave', (e) => {
      if (!div.contains(e.relatedTarget)) div.classList.remove('drag-over');
    });
    div.addEventListener('drop', (e) => {
      div.classList.remove('drag-over');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || files.length === 0) return;
      const imageFiles = Array.from(files).filter(f => f.type && f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      e.preventDefault();
      activeCellId = id;
      imageFiles.forEach(file => mediaUpload.insertImageToCell(cellData, file));
    });
  }

  // ============== 行号 ==============
  // CM6 自带行号（lineNumbers 扩展），此处保留空函数以兼容旧调用

  function updateLineNumbers(cellData) {
    // CM6 原生管理行号，无需手动更新
  }

  // ============== Cell 输出操作 ==============

  function copyOutputHtml(cellData) {
    const html = cellData.output.innerHTML;
    if (!html.trim()) { showToast(editorT('editor.needRunThisCell', '请先运行此 Cell')); return; }
    navigator.clipboard.writeText(html).then(() => {
      showToast(editorT('editor.htmlCopied', '已复制 HTML'));
    }).catch(() => {
      // 兜底
      const ta = document.createElement('textarea');
      ta.value = html;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(editorT('editor.htmlCopied', '已复制 HTML'));
    });
  }

  function clearOutput(cellData) {
    cellData.output.innerHTML = '';
    cellData.output.classList.remove('visible');
    cellData.statusDot.classList.remove('run');
    updateStatusbar();
  }

  function exportCellStandalone(cellData) {
    const idx = cells.findIndex(c => c.id === cellData.id) + 1;
    const html = cellData.output.innerHTML;
    if (!html.trim()) { showToast(editorT('editor.needRunThisCell', '请先运行此 Cell')); return; }
    const fullHtml = buildStandaloneHtml(html, `Cell ${idx}`);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `cell-${idx}.html`);
  }

  // ============== Toast 提示 ==============

  let toastTimer = null;
  // i18n：用户可见文案统一走全站 t()（editor.js 分批迁移：本批为 toast/confirm）
  function editorT(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  function showToast(msg) {
    let toast = document.getElementById('editorToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'editorToast';
      toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);padding:8px 16px;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px;font-size:13px;z-index:9999;opacity:0;transition:opacity 0.2s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1500);
  }

  // ============== Cell 折叠 ==============

  function toggleCellCollapse(cellData) {
    cellData.div.classList.toggle('cell-collapsed');
    cellData.collapseBtn.innerHTML = cellData.div.classList.contains('cell-collapsed')
      ? '<svg class="ico ico-sm"><use href="#i-chevron-down"/></svg>'
      : '<svg class="ico ico-sm"><use href="#i-chevron-right"/></svg>';
  }

  function collapseAllCells() {
    cells.forEach(c => {
      c.div.classList.add('cell-collapsed');
      if (c.collapseBtn) c.collapseBtn.innerHTML = '<svg class="ico ico-sm"><use href="#i-chevron-down"/></svg>';
    });
  }

  function expandAllCells() {
    cells.forEach(c => {
      c.div.classList.remove('cell-collapsed');
      if (c.collapseBtn) c.collapseBtn.innerHTML = '<svg class="ico ico-sm"><use href="#i-chevron-right"/></svg>';
    });
  }

  // ============== Cell 类型切换 ==============

  function toggleCellType(cellData) {
    cellData.type = cellData.type === 'markdown' ? 'plaintext' : 'markdown';
    cellData.div.dataset.cellType = cellData.type;
    cellData.div.classList.remove('cell-type-markdown', 'cell-type-plaintext');
    cellData.div.classList.add('cell-type-' + cellData.type);
    if (cellData.typeBadge) cellData.typeBadge.textContent = cellData.type === 'plaintext' ? 'TXT' : 'MD';
    cellData.textarea.placeholder = cellData.type === 'plaintext' ? '输入纯文本（不渲染）...' : '输入 Markdown...';
    updateStatusbar();
  }

  // ============== Cell 拖拽 ==============

  function getCell(id) {
    return cells.find(c => c.id === id);
  }

  function getActiveCell() {
    return getCell(activeCellId);
  }

  function deleteCell(id) {
    if (cells.length <= 1) return;
    const idx = cells.findIndex(c => c.id === id);
    if (idx === -1) return;
    const cell = cells[idx];
    // 销毁 CM6 实例，避免内存泄漏（cell.textarea 是 CodeMirrorEditor 的兼容别名）
    if (cell.textarea && typeof cell.textarea.destroy === 'function') {
      cell.textarea.destroy();
    }
    cell.div.remove();
    cells.splice(idx, 1);
    // 插件资源（倒计时定时器等）按 output 容器追踪，cell 删除时定向清理
    window.MarkdownPreview.plugins?.dispose?.(cell.output);
    // pkt 等渲染器持有全局注册表：清理已脱离 DOM 的孤儿实例（对照 split-view.js）
    window.MarkdownPreview.pkt?.destroyOrphaned?.();
    if (activeCellId === id) {
      const newIdx = Math.min(idx, cells.length - 1);
      activeCellId = cells[newIdx].id;
      cells[newIdx].textarea.focus();
    }
    renumberCells();
    updateStatusbar();
  }

  function moveCell(id, direction) {
    const idx = cells.findIndex(c => c.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= cells.length) return;

    const cell = cells[idx];
    const other = cells[newIdx];

    // 交换 cells 数组顺序
    cells[idx] = other;
    cells[newIdx] = cell;

    // 重新排序 DOM：按 cells 数组顺序重建
    rebuildCellDOMOrder();

    renumberCells();
    cell.textarea.focus();
  }

  // ============== Cell 拖拽排序（RD-1） ==============
  // 拖拽中单元格 id（DataTransfer 在 dragover 阶段不可读，用模块级变量接力）
  let draggingCellId = null;

  function moveCellOnto(dragId, targetId, before) {
    const dragCell = getCell(dragId);
    const targetCell = getCell(targetId);
    if (!dragCell || !targetCell || dragId === targetId) return;
    if (before) targetCell.div.parentNode.insertBefore(dragCell.div, targetCell.div);
    else targetCell.div.after(dragCell.div);
    const fromIdx = cells.indexOf(dragCell);
    cells.splice(fromIdx, 1);
    const targetIdx = cells.indexOf(targetCell);
    cells.splice(before ? targetIdx : targetIdx + 1, 0, dragCell);
    renumberCells();
    markUnsaved();
    updateStatusbar();
  }

  function rebuildCellDOMOrder() {
    // 增量移动 DOM 节点（而非 innerHTML='' 重建），保留 CM6 编辑器状态和 undo 栈
    cells.forEach(cell => {
      if (cell.div.parentNode !== editorMain || cell.div.nextSibling !== (cells[cells.indexOf(cell) + 1]?.div || globalAddBtn)) {
        editorMain.appendChild(cell.div);
      }
    });
    editorMain.appendChild(globalAddBtn);
  }

  function duplicateCell(id) {
    const cell = getCell(id);
    if (!cell) return;
    createCell(id, cell.textarea.value, { type: cell.type });
  }

  function renumberCells() {
    cells.forEach((c, i) => {
      c.div.querySelector('.cell-num').textContent = i + 1;
    });
  }

  function updateCellMeta(cellData) {
    outline?.refresh?.();
    const lines = cellData.textarea.value.split('\n').length;
    cellData.linesLabel.textContent = `${lines} 行`;
  }

  function markModified(cellData) {
    if (cellData.lastRunContent !== '' && cellData.textarea.value !== cellData.lastRunContent) {
      cellData.statusDot.classList.remove('run');
      cellData.statusDot.classList.add('modified');
    }
  }

  function markRun(cellData) {
    cellData.statusDot.classList.remove('modified');
    cellData.statusDot.classList.add('run');
    cellData.lastRunContent = cellData.textarea.value;
    cellData._outputHtmlCache = undefined; // 输出已变化，序列化缓存失效
  }

  // ============== Markdown 渲染（共享渲染逻辑） ==============
  //
  // processGitHubAlerts / protectLaTeXBlocks / createMdRenderer / 画廊分组 / 轮播 / 代码高亮
  // 这些函数已在 iris/js/md-render.js 中统一实现，这里仅保留 cell 级编排。
  // editor.js 传入 SVG 版 Alert 图标，与文档站的 emoji 版本区分。

  function renderCellMarkdown(content, outputElement) {
    const { html } = mdRender.parseMarkdown(content, { alertTypes: EDITOR_ALERT_TYPES });
    outputElement.innerHTML = html;
    mdRender.groupGalleries(outputElement);
    mdRender.initSliders(outputElement);
    mdRender.highlightCodeBlocks(outputElement);
    // 代码选项卡点击切换（dataset.codeTabsInit 幂等，容器为常驻节点）
    mdRender.initCodeTabs(outputElement);
    // 代码行高亮（```js {2,5-8} / [!code highlight]；pre 每轮重建，守卫自然复位）
    window.MarkdownPreview.lineHighlight?.apply?.(outputElement);
    // 可视化表格编辑器：输出区表格挂「编辑」按钮（外移模块：table-editor.js）
    tableEditor?.attach?.(outputElement);
    // 表格样式预设标记套用
    window.MarkdownPreview.mdRender.applyTablePresets?.(outputElement);
    // 标题锚点 id（与文档站 markdown.js 同规则；跨 cell 重名仅影响跨 cell 跳转）
    outputElement.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      h.id = mdRender.slugify(h.textContent);
    });

    // 渲染器批量调度：runAllCells 时 N 个 cell 各自 setTimeout 会叠 N 批，
    // 收集 roots 合并为一次 200ms 调度
    scheduleCellRenderers(outputElement);

    outputElement.classList.add('visible');
  }

  // cell 渲染器批量调度器（范围常量来自 mdRender.CELL_RENDERER_EXCLUDED，
  // 与 split-view.js 共用；默认全量注册表，新渲染器自动生效）
  let pendingRendererRoots = [];
  let rendererScheduleTimer = null;
  function scheduleCellRenderers(outputElement) {
    if (outputElement) pendingRendererRoots.push(outputElement);
    if (rendererScheduleTimer) return;
    rendererScheduleTimer = setTimeout(() => {
      rendererScheduleTimer = null;
      const roots = pendingRendererRoots;
      pendingRendererRoots = [];
      const excluded = mdRender.CELL_RENDERER_EXCLUDED;
      // 缓存挂在 cell 对象上（serializeNotebook 读 c._outputHtmlCache），
      // 这里拿到的是 output DOM 节点，必须回查所属 cell 再失效，
      // 否则渲染器改动过的输出会一直复用旧缓存
      const invalidateOutputCache = (outputElement) => {
        const owner = cells.find(c => c.output === outputElement);
        if (owner) owner._outputHtmlCache = undefined;
      };
      roots.forEach(root => {
        try {
          // 插件围栏（```qrcode/countdown/regex/...）先于渲染器调度，与文档站
          // 编排一致（markdown.js 先 plugins.render 后 runRenderers）。
          // scoped 渲染按容器追踪资源，重复运行同一 cell 自动清理上一轮定时器
          const plugins = window.MarkdownPreview.plugins;
          const pluginPass = plugins && typeof plugins.render === 'function'
            ? Promise.resolve(plugins.render({ root, documentPath: '' })).catch(e => {
                console.warn('[Editor] Plugin render error:', e);
              })
            : Promise.resolve();
          pluginPass
            .then(() => mdRender.runRenderers(root, { except: excluded }))
            .then(() => invalidateOutputCache(root))
            .catch(e => {
              invalidateOutputCache(root);
              console.warn('[Editor] Renderer render error:', e);
            });
        } catch (e) {
          invalidateOutputCache(root);
          console.warn('[Editor] Renderer render error:', e);
        }
      });
    }, 200);
  }

  // ============== 运行 Cell ==============

  function runCell(id) {
    const cell = getCell(id);
    if (!cell) return;
    const content = cell.textarea.value;
    if (!content.trim()) return;

    cell.div.classList.add('cell-running');
    setTimeout(() => cell.div.classList.remove('cell-running'), 600);

    // 纯文本 Cell：直接显示文本不渲染
    if (cell.type === 'plaintext') {
      cell.output.innerHTML = '';
      const pre = document.createElement('pre');
      pre.textContent = content;
      cell.output.appendChild(pre);
      cell.output.classList.add('visible');
    } else {
      renderCellMarkdown(content, cell.output);
    }

    markRun(cell);
    activeCellId = id;
    // 显示输出工具栏
    if (cell.outputToolbar) cell.outputToolbar.classList.add('visible');
    // 滚动到输出
    setTimeout(() => {
      cell.output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    updateStatusbar();
  }

  function runAllCells() {
    cells.forEach(c => runCell(c.id));
  }

  function runCellAndBelow(id) {
    const idx = cells.findIndex(c => c.id === id);
    if (idx === -1) return;
    for (let i = idx; i < cells.length; i++) {
      runCell(cells[i].id);
    }
  }

  // ============== 工具栏快速插入 ==============

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

  // ============== 下拉菜单管理 ==============

  function closeAllDropdowns() {
    document.querySelectorAll('.toolbar-dropdown').forEach(d => d.classList.remove('open'));
  }

  document.querySelectorAll('.toolbar-dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.toolbar-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) dropdown.classList.add('open');
    });
  });

  document.addEventListener('click', closeAllDropdowns);

  // 快速插入按钮点击
  document.querySelectorAll('.dropdown-item[data-insert]').forEach(item => {
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

  // 菜单动作注册表（模块化功能经 ctx.registerMenuAction 挂入）
  const menuActions = {};
  function registerMenuAction(name, fn) { menuActions[name] = fn; }

  // 下载 / 动态插入按钮点击
  document.querySelectorAll('.dropdown-item[data-action]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      if (action === 'download-md') downloadCurrentMd();
      else if (action === 'download-html') downloadCurrentHtml();
      else if (action === 'download-html-inline') downloadCurrentHtmlInline();
      else if (action === 'download-pdf') downloadCurrentPdf();
      else if (action === 'download-notebook') downloadNotebook();
      else if (action === 'download-all-md') downloadAllMd();
      else if (action === 'import-mdnb') triggerImport('import-mdnb');
      else if (action === 'import-md-cells') triggerImport('import-md-cells');
      else if (action === 'import-md-current') triggerImport('import-md-current');
      else if (menuActions[action]) menuActions[action]();
      else if (action.startsWith('insert-')) handleDynamicInsert(action);
      closeAllDropdowns();
    });
  });

  // ============== 动态内容插入 ==============

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
        'insert-placeholder-square': '500/500',
      };
      const size = sizes[action] || '300/200';
      text = `![占位图](https://placehold.co/${size})`;
    }

    if (text) insertAtCursor(cell.textarea, text, 0);
  }

  // ============== 选中文字浮动工具栏 ==============

  function updateSelectionToolbar(e) {
    const editor = e.target;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start === end) {
      hideSelectionToolbar();
      return;
    }

    // 使用 CM6 的坐标 API 获取选区位置
    const view = editor.view;
    const sel = view.state.selection.main;
    const coords = view.coordsAtPos(sel.head);
    if (!coords) return;

    selectionToolbar.style.top = (coords.top - 44) + 'px';
    selectionToolbar.style.left = (coords.left) + 'px';
    selectionToolbar.classList.add('visible');
  }

  function hideSelectionToolbar() {
    selectionToolbar.classList.remove('visible');
  }

  // 浮动工具栏按钮点击
  selectionToolbar.querySelectorAll('.sel-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // 防止 textarea 失焦
      const format = btn.dataset.format;
      const cell = getActiveCell();
      if (!cell) return;
      applyFormat(cell.textarea, format);
      hideSelectionToolbar();
    });
  });

  function applyFormat(editor, format) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end);

    if (!selected && format !== 'h1' && format !== 'h2' && format !== 'h3' && format !== 'ul' && format !== 'quote') {
      return;
    }

    switch (format) {
      case 'bold':
        editor.wrapSelection('**');
        break;
      case 'italic':
        editor.wrapSelection('*');
        break;
      case 'strike':
        editor.wrapSelection('~~');
        break;
      case 'code':
        editor.wrapSelection('`');
        break;
      case 'link': {
        const url = prompt('输入链接 URL:', 'https://');
        if (!url) return;
        const text = selected || '链接文字';
        editor.replaceRange(start, end, `[${text}](${url})`);
        break;
      }
      case 'h1':
        editor.insertAtLineStart('# ');
        break;
      case 'h2':
        editor.insertAtLineStart('## ');
        break;
      case 'h3':
        editor.insertAtLineStart('### ');
        break;
      case 'quote':
        editor.insertAtLineStart('> ');
        break;
      case 'ul':
        editor.insertAtLineStart('- ');
        break;
    }

    editor.focus();
    updateCellMeta(getCell(parseInt(editor.dataset.cellId)));
    markModified(getCell(parseInt(editor.dataset.cellId)));
    updateStatusbar();
  }

  // ============== Cell 右键上下文菜单 ==============

  function showContextMenu(x, y) {
    // 先显示以获取尺寸
    contextMenu.style.left = '0px';
    contextMenu.style.top = '0px';
    contextMenu.classList.add('visible');
    const rect = contextMenu.getBoundingClientRect();
    const menuW = rect.width;
    const menuH = rect.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // 水平定位：优先在点击点右侧，超出则左侧，再不行贴边
    let left = x;
    if (left + menuW > vw - margin) left = x - menuW;
    if (left < margin) left = Math.min(x, vw - menuW - margin);
    left = Math.max(margin, left);

    // 垂直定位：优先在点击点下方，超出则上方，再不行贴边
    let top = y;
    if (top + menuH > vh - margin) top = y - menuH;
    if (top < margin) top = Math.min(y, vh - menuH - margin);
    top = Math.max(margin, top);

    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';

    // 禁用/启用菜单项
    const idx = cells.findIndex(c => c.id === contextMenuCellId);
    const moveUpItem = contextMenu.querySelector('[data-action="ctx-move-up"]');
    const moveDownItem = contextMenu.querySelector('[data-action="ctx-move-down"]');
    if (moveUpItem) moveUpItem.classList.toggle('context-menu-item-disabled', idx <= 0);
    if (moveDownItem) moveDownItem.classList.toggle('context-menu-item-disabled', idx >= cells.length - 1);
  }

  function hideContextMenu() {
    contextMenu.classList.remove('visible');
  }

  contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.classList.contains('context-menu-item-disabled')) return;
      const action = item.dataset.action;
      const id = contextMenuCellId;
      if (!id) return;

      switch (action) {
        case 'ctx-run': runCell(id); break;
        case 'ctx-run-below': runCellAndBelow(id); break;
        case 'ctx-insert-above': {
          const idx = cells.findIndex(c => c.id === id);
          const newCell = createCell(idx > 0 ? cells[idx - 1].id : null);
          // 如果是第一个，createCell 把新 cell 加到了末尾，需要移动到最前面
          if (idx === 0) {
            editorMain.insertBefore(newCell.div, cells[1].div);
          }
          renumberCells();
          break;
        }
        case 'ctx-insert-below': createCell(id); break;
        case 'ctx-move-up': moveCell(id, -1); break;
        case 'ctx-move-down': moveCell(id, 1); break;
        case 'ctx-duplicate': duplicateCell(id); break;
        case 'ctx-toggle-type': {
          const cell = getCell(id);
          if (cell) toggleCellType(cell);
          break;
        }
        case 'ctx-collapse-editor': {
          const cell = getCell(id);
          if (cell) cell.div.classList.toggle('cell-editor-collapsed');
          break;
        }
        case 'ctx-collapse-output': {
          const cell = getCell(id);
          if (cell) cell.div.classList.toggle('cell-output-collapsed');
          break;
        }
        case 'ctx-copy-html': {
          const cell = getCell(id);
          if (cell) copyOutputHtml(cell);
          break;
        }
        case 'ctx-export-cell': {
          const cell = getCell(id);
          if (cell) exportCellStandalone(cell);
          break;
        }
        case 'ctx-collapse-all': collapseAllCells(); break;
        case 'ctx-expand-all': expandAllCells(); break;
        case 'ctx-clear-output': {
          const cell = getCell(id);
          if (cell) clearOutput(cell);
          break;
        }
        case 'ctx-clear-content': {
          const cell = getCell(id);
          if (cell) {
            cell.textarea.setValue('');
            cell.output.innerHTML = '';
            cell.output.classList.remove('visible');
            cell.statusDot.classList.remove('run', 'modified');
            updateCellMeta(cell);
            cell.textarea.focus();
          }
          break;
        }
        case 'ctx-delete': deleteCell(id); break;
      }
      hideContextMenu();
    });
  });

  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) hideContextMenu();
  });
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.cell')) hideContextMenu();
  });

  // ============== 自动补全 ==============

  let acIndex = -1;
  let acVisible = false;
  let acTextarea = null;
  let acLineStart = 0;
  let acReplaceLength = 0;

  function showAutocomplete(textarea, filter, trigger, lineStart, replaceLength) {
    // 1. 按 trigger 类别筛选
    let candidates = autocompleteItems.filter(it => it.trigger === trigger);
    // 2. 按 filter 字符串筛选（label 包含 filter，忽略大小写）
    if (filter) {
      const f = filter.toLowerCase();
      candidates = candidates.filter(it => it.label.toLowerCase().includes(f));
    }
    if (candidates.length === 0) { hideAutocomplete(); return; }

    // 记录上下文供键盘导航使用
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

    // 使用 CM6 坐标 API 定位补全列表
    // coordsAtPos 依赖真实布局（getClientRects），在无布局环境（headless/jsdom/隐藏容器）可能抛错，
    // 测量失败时仅跳过定位，不影响补全列表显示。
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
    autocompleteList.classList.remove('visible');
    acVisible = false;
    acIndex = -1;
    acTextarea = null;
  }

  // CM6 closeBrackets 会在输入 opener（如 [）时自动补出配对闭符，该闭符位于
  // 被替换前缀之后；补全展开后紧邻插入文本的配对闭符需一并吞掉，
  // 否则 [](https://) 之后会残留一个 ]（旧 textarea 时代无此问题）。
  // 扫描前缀找「最后一个未闭合的 opener」（[^ 输入序列的 ] 同样要吞）。
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
    // 光标落点：显式 cursorOffset 优先；否则当 insert 以闭合围栏 ``` 结尾时
    // 统一落到闭合围栏之前的块内（空白模板落在空行上，填充模板落在末行内容后）
    let delta = 0;
    if (typeof item.cursorOffset === 'number') delta = item.cursorOffset;
    else if (item.insert.endsWith('```')) delta = -4;
    if (delta) {
      const pos = Math.max(lineStart, lineStart + item.insert.length + delta);
      editor.setSelectionRange(pos, pos);
    }
    hideAutocomplete();
    editor.focus();
    updateCellMeta(getCell(parseInt(editor.dataset.cellId)));
    updateStatusbar();
  }

  function onTextareaInput(e) {
    const editor = e.target;
    const lineBeforeCursor = editor.getLineBeforeCursor();
    const lineStart = editor.getLineStart();

    // ``` 代码块语言触发（先检查多字符前缀）
    if (lineBeforeCursor.match(/^```[\w-]*$/)) {
      const filter = lineBeforeCursor.substring(3);
      showAutocomplete(editor, filter, '```', lineStart, lineBeforeCursor.length);
    }
    // > [! GitHub Alert 触发（比 > 更具体，先检查）
    else if (lineBeforeCursor.match(/^> \[!?[\w]*$/)) {
      const m = lineBeforeCursor.match(/^> \[!?([\w]*)$/);
      const filter = m ? m[1] : '';
      showAutocomplete(editor, filter, '> [!', lineStart, lineBeforeCursor.length);
    }
    // > 普通引用触发（仅 > 或 > 后跟空格，且不是 > [）
    else if (lineBeforeCursor.match(/^>\s?$/) && !lineBeforeCursor.includes('[')) {
      showAutocomplete(editor, '', '>', lineStart, lineBeforeCursor.length);
    }
    // ::: 容器触发（code-tabs / columns）
    else if (lineBeforeCursor.match(/^:::\s*\w*$/)) {
      const filter = lineBeforeCursor.substring(3).trim();
      showAutocomplete(editor, filter, ':::', lineStart, lineBeforeCursor.length);
    }
    // || 剧透触发
    else if (lineBeforeCursor.match(/^\|\|$/)) {
      showAutocomplete(editor, '', '||', lineStart, 2);
    }
    // --- 水平线 / Frontmatter 触发（3 个以上 -）
    else if (lineBeforeCursor.match(/^-{3,}$/)) {
      showAutocomplete(editor, '', '---', lineStart, lineBeforeCursor.length);
    }
    // - 列表触发（单个 - 或 - 后跟空格）
    else if (lineBeforeCursor.match(/^-\s?$/)) {
      showAutocomplete(editor, '', '-', lineStart, lineBeforeCursor.length);
    }
    // # 标题触发（1-6 个 #）
    else if (lineBeforeCursor.match(/^#{1,6}$/)) {
      showAutocomplete(editor, lineBeforeCursor, '#', lineStart, lineBeforeCursor.length);
    }
    // | 表格触发（单个 |）
    else if (lineBeforeCursor.match(/^\|$/)) {
      showAutocomplete(editor, '', '|', lineStart, 1);
    }
    // $$ KaTeX 公式块触发
    else if (lineBeforeCursor.match(/^\$\$$/)) {
      showAutocomplete(editor, '', '$$', lineStart, 2);
    }
    // ![ 图片触发
    else if (lineBeforeCursor.match(/^!\[?$/)) {
      showAutocomplete(editor, '', '![', lineStart, lineBeforeCursor.length);
    }
    // [ 链接触发（单个 [）
    else if (lineBeforeCursor.match(/^\[$/)) {
      showAutocomplete(editor, '', '[', lineStart, 1);
    }
    // [pulse DG-LAB 波形触发
    else if (lineBeforeCursor.match(/^\[pulse\w*$/)) {
      showAutocomplete(editor, '', '[pulse', lineStart, lineBeforeCursor.length);
    }
    // [^ 脚注触发（须在 [ 触发之前判断）
    else if (lineBeforeCursor.match(/^\[\^[\w]*$/)) {
      showAutocomplete(editor, lineBeforeCursor, '[^', lineStart, lineBeforeCursor.length);
    }
    // @ 画廊样式触发
    else if (lineBeforeCursor.match(/^@\w*$/)) {
      const filter = lineBeforeCursor.substring(1);
      showAutocomplete(editor, filter, '@', lineStart, lineBeforeCursor.length);
    }
    // <!-- 注释标记触发（图表编号 / 表格样式预设）
    else if (lineBeforeCursor.match(/^<!--\s?[#\w:-]*$/)) {
      const filter = lineBeforeCursor.replace(/^<!--\s?/, '');
      showAutocomplete(editor, filter, '<!--', lineStart, lineBeforeCursor.length);
    }
    else {
      hideAutocomplete();
    }
  }

  // ============== 键盘快捷键 ==============

  function onTextareaKeydown(e) {
    const editor = e.target;

    // 自动补全导航
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

    // Ctrl/Cmd + Enter: 运行当前 cell
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const cellId = parseInt(editor.dataset.cellId);
      runCell(cellId);
      return;
    }

    // Ctrl/Cmd + Shift + Enter: 运行全部
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      runAllCells();
      return;
    }

    // Ctrl/Cmd + Shift + N: 下方新建 Cell
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      const cellId = parseInt(editor.dataset.cellId);
      createCell(cellId);
      return;
    }

    // Ctrl/Cmd + F: 全局搜索（仅在编辑器内）；Ctrl+H: 替换
    // （面板开关已外移至 find-replace.js 模块）
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      findReplace.openSearchPanel();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      findReplace.openSearchPanel();
      setTimeout(() => replaceInput.focus(), 50);
      return;
    }

    // 格式快捷键
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        applyFormat(editor, 'bold');
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        applyFormat(editor, 'italic');
        return;
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        applyFormat(editor, 'link');
        return;
      }
      if (e.key === '`') {
        e.preventDefault();
        applyFormat(editor, 'code');
        return;
      }
    }

    // Tab 缩进由 CM6 原生 indentWithTab 处理，无需手写
  }

  // ============== 状态栏 ==============

  function countWords(text) {
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    return chineseChars.length + englishWords.length;
  }

  function updateStatusbar() {
    // Cell 数量
    statusCellCount.textContent = `${cells.length} Cell`;
    cellCountBadge.textContent = `${cells.length} Cell`;

    // 活跃 Cell
    if (activeCellId) {
      const idx = cells.findIndex(c => c.id === activeCellId);
      statusActive.textContent = `活跃: Cell ${idx + 1}`;
    } else {
      statusActive.textContent = '无活跃 Cell';
    }

    // 运行统计：已运行 / 总数
    const runCount = cells.filter(c => c.output.classList.contains('visible')).length;
    if (statusRunStats) statusRunStats.textContent = `运行 ${runCount}/${cells.length}`;

    // 光标位置（CM6 原生行列 API，开销小，立即更新保证跟手）
    const cell = getActiveCell();
    if (cell) {
      const cursor = cell.editor.getCursorPos();
      statusCursor.textContent = `行 ${cursor.line}, 列 ${cursor.col}`;
    }

    // 字数与行数（两个正则全文扫描 × 全部 Cell）：300ms 防抖。
    // 此函数在每个按键的 input/keyup/click 里都会触发，长文档同步算必卡
    if (!statusStatsTimer) {
      statusStatsTimer = setTimeout(() => {
        statusStatsTimer = null;
        computeStatusStats();
      }, 300);
    }
  }

  let statusStatsTimer = null;
  function computeStatusStats() {
    // 字数与行数（全部 Cell 汇总）
    let totalWords = 0;
    let totalLines = 0;
    cells.forEach(c => {
      const val = c.textarea.value;
      totalLines += val.split('\n').length;
      totalWords += countWords(val);
    });
    statusWords.textContent = `${totalWords} 字`;
    statusLines.textContent = `${totalLines} 行`;

    // 当前 Cell 字数
    const activeCell = getActiveCell();
    if (activeCell && statusCurCellWords) {
      statusCurCellWords.textContent = `当前 ${countWords(activeCell.textarea.value)} 字`;
    } else if (statusCurCellWords) {
      statusCurCellWords.textContent = '当前 0 字';
    }
  }

  // ============== 下载功能 ==============

  // 统一走 MarkdownPreview.downloadBlob（export-bundle.js 版，延迟 revoke
  // 防下载截断；旧本地副本立即 revoke 有截断风险）
  const downloadBlob = window.MarkdownPreview.downloadBlob;

  function downloadCurrentMd() {
    const cell = getActiveCell();
    if (!cell) return;
    const content = cell.textarea.value;
    if (!content.trim()) { showToast(editorT('editor.cellEmpty', '当前 Cell 为空')); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `cell-${idx}.md`);
  }

  function downloadCurrentHtml() {
    const cell = getActiveCell();
    if (!cell) return;
    const html = cell.output.innerHTML;
    if (!html.trim()) { showToast(editorT('editor.needRunCurrentCell', '请先运行当前 Cell')); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    const fullHtml = buildStandaloneHtml(html, `Cell ${idx}`, false);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `cell-${idx}.html`);
  }

  function downloadCurrentHtmlInline() {
    const cell = getActiveCell();
    if (!cell) return;
    const html = cell.output.innerHTML;
    if (!html.trim()) { showToast(editorT('editor.needRunCurrentCell', '请先运行当前 Cell')); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    const fullHtml = buildStandaloneHtml(html, `Cell ${idx}`, true);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `cell-${idx}-offline.html`);
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
      // 尝试内联当前页面已加载的样式表
      const collected = [];
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        // 仅内联 iris/ 开头的本地样式（避免抓取跨域 CDN）
        if (!href.startsWith('iris/') && !href.startsWith('/iris/')) return;
        const cssText = tryReadLoadedStylesheet(link);
        if (cssText) collected.push(cssText);
      });
      // 编辑器暗色模式
      if (document.body.classList.contains('editor-dark-mode')) {
        collected.push('body{background:#1e1e2e;color:#e0e0e8;}');
      }
      headExtra = `<style>\n${collected.join('\n')}\n</style>`;
    } else {
      headExtra = styleHrefs.map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
    }
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>${headExtra}</head><body><article class="markdown-body" style="max-width:800px;margin:40px auto;padding:0 20px;">${bodyHtml}</article></body></html>`;
  }

  // styles.css 通过 @import 引入子模块，需递归展开 CSSImportRule；
  // 跨域样式表会抛错，这里直接返回空
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
    // 尝试从已加载的 StyleSheet.cssRules 提取文本
    try {
      const sheets = Array.from(document.styleSheets);
      const href = linkEl.href;
      const sheet = sheets.find(s => s.href === href);
      if (!sheet) return '';
      return readSheetRules(sheet, 0);
    } catch (e) {
      // 跨域样式表会抛错，这里直接返回空
      return '';
    }
  }

  function downloadCurrentPdf() {
    const cell = getActiveCell();
    if (!cell) return;
    const html = cell.output.innerHTML;
    if (!html.trim()) { showToast(editorT('editor.needRunCurrentCell', '请先运行当前 Cell')); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    // 沙箱 iframe 替代 document.write：不含 allow-scripts，活动内容不执行
    //（旧实现把 cell 原始 innerHTML 写进同源 about:blank 窗口，活动内容以
    // 完整源权限运行）；打印由父页面调用 contentWindow.print()
    const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cell ${idx}</title><link rel="stylesheet" href="iris/styles.css"><link rel="stylesheet" href="iris/css/galleries.css"><link rel="stylesheet" href="iris/vendor/highlight.js/styles/github.css"><link rel="stylesheet" href="iris/vendor/katex/katex.min.css"><style>@media print{body{margin:0;}}</style></head><body><article class="markdown-body" style="max-width:800px;margin:20px auto;padding:0 20px;">${html}</article></body></html>`;
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

  function downloadNotebook() {
    const data = {
      version: 2,
      type: 'mdnb',
      created: new Date().toISOString(),
      cells: cells.map(c => ({
        id: c.id,
        type: c.type || 'markdown',
        content: c.textarea.value,
        output_html: c.output.classList.contains('visible') ? c.output.innerHTML : ''
      }))
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), 'notebook.mdnb');
  }

  // 显式 cell 边界标记：正文里的独立水平线（---）不会再被导入误拆
  const CELL_BOUNDARY = '<!-- mdp2:cell -->';

  function downloadAllMd() {
    const content = cells.map(c => {
      const typeTag = c.type === 'plaintext' ? '<!-- cell: plaintext -->\n' : '';
      return typeTag + c.textarea.value;
    }).join('\n\n' + CELL_BOUNDARY + '\n\n');
    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), 'all-cells.md');
  }

  // ============== 导入功能 ==============

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
      else if (mode === 'import-md-cells') importMdCells(text);
      else if (mode === 'import-md-current') importMdCurrent(text);
      markUnsaved();
    };
    reader.readAsText(file);
  });

  async function importMdnb(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { showToast(editorT('editor.invalidMdnb', '无效的 .mdnb 文件')); return; }
    if (!data || !Array.isArray(data.cells)) { showToast(editorT('editor.badFileFormat', '文件格式不正确')); return; }
    // 确认清空现有
    if (cells.length > 0 && cells.some(c => c.textarea.value.trim())) {
      if (!confirm('导入将替换当前所有 Cell，是否继续？')) return;
    }
    // 清空现有 Cell
    resetAllCells();
    // 创建新 Cell。output_html 来自外部文件（非受信内容，可能是他人分享的
    // 笔记本），注入前必须经 DOMPurify 净化，防止导入即触发的存储型 XSS。
    // 净化是 await，期间不能自动保存（会用半成品覆盖原笔记本）
    restoreDepth++;
    try {
    for (const s of data.cells) {
      const newCell = createCell(null, s.content || '', { type: s.type === 'plaintext' ? 'plaintext' : 'markdown' });
      if (s.output_html) {
        const clean = await mdRender.sanitizeHtml(s.output_html).catch(() => null);
        if (clean == null) {
          showToast(editorT('editor.sanitizeFailed', '净化组件加载失败，已丢弃运行结果，可重新运行 Cell 恢复'));
        } else {
          newCell.output.innerHTML = clean;
          newCell.output.classList.add('visible');
          if (newCell.outputToolbar) newCell.outputToolbar.classList.add('visible');
          markRun(newCell);
        }
      }
      updateLineNumbers(newCell);
    }
    } finally {
      restoreDepth--;
    }
    if (cells.length === 0) createCell();
    renumberCells();
    updateStatusbar();
    if (restoreDepth === 0) scheduleAutosave();
    showToast(editorT('editor.importedCells', '已导入 {n} 个 Cell').replace('{n}', data.cells.length));
  }

  function importMdCells(text, opts) {
    // 优先按显式 cell 边界切分（downloadAllMd 导出格式，正文含 --- 也安全）；
    // 无标记的旧文件/手写文件回退按 --- 切分
    const parts = text.includes(CELL_BOUNDARY)
      ? text.split(/\n?\s*<!-- mdp2:cell -->\s*\n?/)
      : text.split(/\n\s*---\s*\n/);
    // 快照回滚等已在调用方确认过的路径传 skipConfirm 免二次打断
    if (!(opts && opts.skipConfirm) && cells.some(c => c.textarea.value.trim())) {
      if (!confirm('导入将替换当前所有 Cell，是否继续？')) return;
    }
    resetAllCells();
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      // 检测纯文本标记
      const isPlaintext = trimmed.startsWith('<!-- cell: plaintext -->');
      const content = isPlaintext ? trimmed.replace(/^<!-- cell: plaintext -->\n?/, '') : trimmed;
      const newCell = createCell(null, content, { type: isPlaintext ? 'plaintext' : 'markdown' });
      updateLineNumbers(newCell);
    });
    if (cells.length === 0) createCell();
    renumberCells();
    updateStatusbar();
    showToast(editorT('editor.importedCells', '已导入 {n} 个 Cell').replace('{n}', cells.length));
  }

  function importMdCurrent(text) {
    const cell = getActiveCell();
    if (!cell) { showToast(editorT('editor.noActiveCell', '没有活跃 Cell')); return; }
    cell.textarea.setValue(text);
    updateCellMeta(cell);
    markModified(cell);
    markUnsaved();
    updateStatusbar();
    showToast(editorT('editor.importedToCurrent', '已导入到当前 Cell'));
  }

  // ============== 清空所有 Cell ==============

  clearAllBtn?.addEventListener('click', () => {
    if (!confirm('确定清空所有 Cell 内容吗？此操作不可撤销。')) return;
    cells.forEach(c => {
      c.textarea.setValue('');
      c.output.innerHTML = '';
      c.output.classList.remove('visible');
      if (c.outputToolbar) c.outputToolbar.classList.remove('visible');
      c.statusDot.classList.remove('run', 'modified');
      c.lastRunContent = '';
      updateCellMeta(c);
    });
    updateStatusbar();
    markUnsaved();
    cells[0]?.textarea.focus();
  });

  // ============== 事件绑定 ==============

  runCurrentBtn.addEventListener('click', () => {
    if (activeCellId) runCell(activeCellId);
  });

  runAllBtn.addEventListener('click', runAllCells);

  // 全局键盘快捷键
  document.addEventListener('keydown', (e) => {
    // 焦点在 CM6 编辑器内时跳过（由 cell 级 keydown 处理，避免重复运行）
    const inCellEditor = e.target.classList && (e.target.classList.contains('cm-content') || e.target.closest && e.target.closest('.cell-cm-host'));
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey && !inCellEditor) {
      e.preventDefault();
      if (activeCellId) runCell(activeCellId);
    }
    // 全局 F3 / Shift+F3 搜索导航（外移模块：find-replace.js）
    if (e.key === 'F3' && findReplace.isPanelOpen()) {
      e.preventDefault();
      if (e.shiftKey) findReplace.searchNavigate(-1);
      else findReplace.searchNavigate(1);
    }
    if (e.key === 'Escape') {
      hideContextMenu();
      hideAutocomplete();
      hideSelectionToolbar();
      if (findReplace.isPanelOpen()) findReplace.closeSearchPanel();
    }
  });

  // 滚动时隐藏浮动工具栏（位置会错位）
  window.addEventListener('scroll', hideSelectionToolbar, true);

  // ============== 图片上传 ==============
  // 已外移至 iris/js/editor/media-upload.js（editor.js 拆分第一批），
  // initEditor 通过 editorModules.mediaUpload.init(ctx) 注入协作对象。

  // ============== 自动保存（IndexedDB，localStorage 兜底） ==============

  const STORAGE_KEY = 'mdnb_autosave_v2'; // 兼容旧 localStorage key，仅用于迁移
  let NOTEBOOK_ID = 'autosave';           // 当前激活笔记本 ID（IndexedDB key）
  const storage = window.MarkdownPreview.storage;
  let saveTimer = null;
  let isUnsaved = false;
  let useIndexedDB = storage && storage.isAvailable();

  // ============== 多标签页 ==============
  //
  // 每个 tab 对应一个独立笔记本：
  //   { id, title, unsaved, savedAt }
  // tabs 数组保序；activeTabId 指向当前激活的笔记本
  // 切换时：序列化当前 → 恢复目标；新建时：先保存当前再开新空白；
  // 关闭时：从列表与 IndexedDB 中移除，无 tab 则自动建一个空白

  const tabBar = document.getElementById('tabBar');
  const tabList = document.getElementById('tabList');
  const tabNewBtn = document.getElementById('tabNewBtn');

  let tabs = [];            // [{ id, title, unsaved }]
  let activeTabId = null;
  let tabCounter = 0;
  let isSwitching = false;  // 切换中禁止 autosave 重入

  function genTabId() {
    tabCounter++;
    return 'nb-' + Date.now().toString(36) + '-' + tabCounter;
  }

  function defaultTabTitle(index) {
    return '笔记本 ' + index;
  }

  function deriveTitleFromCells() {
    // 取第一个非空 Cell 的第一行作为标题
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
    // 滚动到激活 tab
    const active = tabList.querySelector('.tab-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateActiveTabState() {
    const t = getTabById(activeTabId);
    if (!t) return;
    const derived = deriveTitleFromCells();
    if (derived) t.title = derived;
    t.unsaved = isUnsaved;
    renderTabs();
  }

  function persistTabMeta() {
    if (!useIndexedDB || !storage) return;
    try {
      storage.setMeta('tabOrder', tabs.map(t => ({ id: t.id, title: t.title })));
      storage.setMeta('activeTab', activeTabId);
    } catch (e) { /* 忽略元信息写入失败 */ }
  }

  async function createTab(opts) {
    opts = opts || {};
    // 先保存当前 tab 数据
    if (!opts.skipSaveCurrent && activeTabId && tabs.length > 0) {
      try { await saveCurrentTabToStorage(); } catch (e) {}
    }
    const id = opts.id || genTabId();
    const idx = tabs.length + 1;
    const tab = { id, title: opts.title || defaultTabTitle(idx), unsaved: false };
    tabs.push(tab);
    if (!opts.skipSwitch) {
      await activateTab(tab.id, { initData: opts.initData || null });
    }
    persistTabMeta();
    return tab;
  }

  async function saveCurrentTabToStorage() {
    if (!useIndexedDB) return;
    const data = serializeNotebook();
    try { await storage.saveNotebook(data); } catch (e) {}
  }

  let pendingTab = null;
  async function activateTab(id, opts) {
    opts = opts || {};
    const tab = getTabById(id);
    if (!tab) return;
    if (isSwitching) { pendingTab = { id, opts }; return; } // 排队而非静默丢弃（opts 含 initData，重试时传回）
    isSwitching = true;
    try {
      // 1) 保存当前 notebook 数据（先序列化，不动 DOM）
      if (activeTabId && activeTabId !== id) {
        try { await saveCurrentTabToStorage(); } catch (e) {}
      }
      // 2) 切换 NOTEBOOK_ID
      NOTEBOOK_ID = id;
      activeTabId = id;
      // 3) 加载目标 notebook
      let restored = false;
      if (opts.initData) {
        restored = await restoreFromData(opts.initData);
      } else if (useIndexedDB) {
        try {
          const data = await storage.loadNotebook(id);
          if (data) restored = await restoreFromData(data);
        } catch (e) { console.warn('[tabs] 加载笔记本失败:', e); }
      }
      if (!restored) {
        // 空白笔记本
        await restoreFromData({ cells: [] });
      }
      // 4) 更新 UI 状态
      isUnsaved = false;
      markSaved();
      renderTabs();
      persistTabMeta();
    } finally {
      isSwitching = false;
      // 处理切换期间排队的请求（跳过中间态，直达最后点击的 tab）
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

  async function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tab = tabs[idx];
    // 未保存则提示
    if (tab.unsaved && !confirm('笔记本「' + tab.title + '」尚未保存，关闭后将丢失未保存内容。确定关闭吗？')) {
      return;
    }
    tabs.splice(idx, 1);
    // 从 IndexedDB 删除
    if (useIndexedDB) {
      try { await storage.deleteNotebook(id); } catch (e) {}
    }
    if (tabs.length === 0) {
      // 自动创建空白笔记本
      await createTab({ skipSaveCurrent: true });
    } else if (activeTabId === id) {
      // 切到相邻 tab
      const next = tabs[Math.min(idx, tabs.length - 1)];
      await activateTab(next.id);
    } else {
      renderTabs();
    }
    persistTabMeta();
    showToast(editorT('editor.tabClosed', '已关闭「{t}」').replace('{t}', tab.title));
  }

  // 新建按钮
  tabNewBtn?.addEventListener('click', () => createTab());

  // Ctrl+T 新建标签
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey && !e.altKey) {
      // 避免与浏览器新建标签冲突：使用 Ctrl+Alt+T
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      createTab();
    }
    // Ctrl+Tab / Ctrl+Shift+Tab 切换标签
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

  function markUnsaved() {
    bumpRevision(activeTabId);
    isUnsaved = true;
    if (statusSave) {
      statusSave.textContent = '未保存 *';
      statusSave.style.color = 'var(--color-warning)';
    }
    // 同步 tab 状态
    const t = getTabById(activeTabId);
    if (t && !t.unsaved) {
      t.unsaved = true;
      const derived = deriveTitleFromCells();
      if (derived) t.title = derived;
      renderTabs();
    }
    scheduleAutosave();
  }

  // 每个 tab 的编辑修订号：保存开始时记录，完成时比对。
  // 只比 tabId 无法识别「同一 tab 在 await 期间又改了」——旧写入完成会把
  // 新编辑误标为已保存，closeTab 于是跳过确认导致丢失。
  const tabRevisions = new Map();
  function bumpRevision(tabId) {
    if (!tabId) return;
    tabRevisions.set(tabId, (tabRevisions.get(tabId) || 0) + 1);
  }

  function markSaved(savedTabId, savedRevision) {
    // 异步保存完成时若已切到其他 tab：只清发起保存那个 tab 的未保存标记，
    // 不得触碰当前 tab 的 isUnsaved/状态栏（否则当前 tab 未保存的编辑会被
    // closeTab 误判「已保存」而跳过确认，导致丢失）
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
    // 同 tab：保存期间又产生了新编辑 → 保留未保存状态，等下一轮保存
    if (savedRevision !== undefined && (tabRevisions.get(savedTabId) || 0) !== savedRevision) {
      return;
    }
    isUnsaved = false;
    if (statusSave) {
      statusSave.textContent = '已保存 ✓';
      statusSave.style.color = 'var(--color-success)';
    }
    // 同步 tab 状态
    const t = getTabById(activeTabId);
    if (t && t.unsaved) {
      t.unsaved = false;
      renderTabs();
    }
  }

  function scheduleAutosave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(autosave, 1500);
  }

  function serializeNotebook() {
    return {
      id: NOTEBOOK_ID,
      version: 2,
      type: 'mdnb-autosave',
      saved: new Date().toISOString(),
      cells: cells.map(c => ({
        id: c.id,
        type: c.type || 'markdown',
        content: c.textarea.value,
        // output_html 序列化缓存：打字触发的 1.5s 自动保存不再全量重读
        // 每个 cell 的 output DOM（含 base64 图/mermaid SVG 的 innerHTML
        // 序列化是最大头）；markRun / 渲染器跑完时失效重建
        output_html: c.output.classList.contains('visible')
          ? (c._outputHtmlCache !== undefined ? c._outputHtmlCache : (c._outputHtmlCache = c.output.innerHTML))
          : ''
      }))
    };
  }

  // 兜底：IndexedDB 不可用时回退到 localStorage
  function autosaveLocalStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  async function autosave() {
    // 恢复/导入进行中：数据结构不完整，延后到恢复结束（见 restoreDepth）
    if (restoreDepth > 0) {
      scheduleAutosave();
      return;
    }
    // await 期间用户可能切 tab：捕获发起保存时的 tabId，
    // 完成后只清该 tab 的标记（见 markSaved 的防串扰逻辑）
    const savedTabId = activeTabId;
    const savedRevision = tabRevisions.get(savedTabId) || 0;
    const data = serializeNotebook();
    if (useIndexedDB) {
      try {
        await storage.saveNotebook(data);
        markSaved(savedTabId, savedRevision);
        if (versionSnapshots) versionSnapshots.maybeAutoSnapshot();
      } catch (e) {
        // IndexedDB 写入失败，回退 localStorage
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
    } else {
      if (autosaveLocalStorage(data)) {
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
  }

  async function restoreFromData(data) {
    restoreDepth++;
    try {
      return await restoreFromDataInner(data);
    } finally {
      restoreDepth--;
      if (restoreDepth === 0) scheduleAutosave();
    }
  }

  // 清空全部 Cell 的统一入口：closeDualPane（cmHost 不残留双屏 overlay）
  // + findReplace 匹配失效（cellCounter 归零后新 Cell 复用旧 id）。
  // 此前四处复制、已出现分歧（CodeRabbit review fix）
  function resetAllCells() {
    closeDualPane();
    if (findReplace) findReplace.invalidateMatches();
    cells.slice().forEach(c => {
      if (c.textarea && typeof c.textarea.destroy === 'function') c.textarea.destroy();
      c.div.remove();
    });
    cells.length = 0;
    cellCounter = 0;
  }

  async function restoreFromDataInner(data) {
    const cellList = (data && Array.isArray(data.cells)) ? data.cells : [];
    // 旧 cell 即将被销毁：先关双屏，否则 cmHost 残留在双屏 overlay 里
    // 形成死编辑器 + escHandler 泄漏
    resetAllCells();
    // output_html 持久化在 IndexedDB / localStorage：旧版本导入的污染数据可能
    // 已入库，统一在注入前净化（导入边界已有一次净化，这里是纵深防御）
    for (const s of cellList) {
      const newCell = createCell(null, s.content || '', { type: s.type === 'plaintext' ? 'plaintext' : 'markdown' });
      if (s.output_html) {
        const clean = await mdRender.sanitizeHtml(s.output_html).catch(() => null);
        if (clean != null) {
          newCell.output.innerHTML = clean;
          newCell.output.classList.add('visible');
          if (newCell.outputToolbar) newCell.outputToolbar.classList.add('visible');
          markRun(newCell);
        }
      }
    }
    if (cells.length === 0) createCell();
    renumberCells();
    updateStatusbar();
    // 旧 cellId 已全部失效：清掉查找匹配，F3 不再按陈旧偏移选中
    // （外移模块：find-replace.js；initEditor 首次运行前模块未注入，需判空）
    if (findReplace) findReplace.invalidateMatches();
    return cellList.length > 0;
  }

  // 启动恢复会销毁初始 cell，所以「用户是否已在初始 cell 输入」必须在
  // 恢复前判定：恢复之后再拿 cells.includes(bootCell) 恒为 false，
  // 那个检查等于没做。
  let bootCellsRef = null;
  function userTypedInBootCells() {
    if (!bootCellsRef) return false;
    return bootCellsRef.some(c => c && c.isConnected !== false &&
      cells.includes(c) && (c.textarea.value || '').trim());
  }

  async function loadAutosave() {
    // 多标签页模式：从 meta 读取 tab 列表，逐个加载笔记本
    if (useIndexedDB) {
      try {
        let tabOrder = await storage.getMeta('tabOrder');
        let savedActive = await storage.getMeta('activeTab');
        // 兼容旧版本：无 tabOrder 但有 autosave 笔记本
        if (!tabOrder || !Array.isArray(tabOrder) || tabOrder.length === 0) {
          let legacyData = await storage.loadNotebook('autosave');
          if (!legacyData) {
            legacyData = await storage.migrateFromLocalStorage(STORAGE_KEY, 'autosave');
          }
          // 兜底快照可能比 IDB 最后一次成功保存更新（卸载时 IDB 异步写未完成）：
          // 按 saved 时间戳取新者，别让同步写完的 localStorage 数据被忽略
          const backup0 = readLocalStorageBackup();
          if (backup0 && (!legacyData || (backup0.saved || '') > (legacyData.saved || ''))) {
            legacyData = backup0;
          }
          // 创建单个 tab 承载旧数据
          const legacyId = (legacyData && legacyData.id) || 'autosave';
          tabs = [{ id: legacyId, title: deriveTabTitleFromData(legacyData) || defaultTabTitle(1), unsaved: false }];
          activeTabId = legacyId;
          NOTEBOOK_ID = legacyId;
          renderTabs();
          if (legacyData) {
            if (userTypedInBootCells()) return false;
            await restoreFromData(legacyData);
            return true;
          }
          return false;
        }
        // 多 tab 模式
        tabs = tabOrder.map(t => ({ id: t.id, title: t.title || defaultTabTitle(1), unsaved: false }));
        // 验证每个 tab 在 IndexedDB 中确实有数据；过滤掉没有数据的（可能是被外部清理）
        const validTabs = [];
        for (const t of tabs) {
          const data = await storage.loadNotebook(t.id);
          if (data) {
            validTabs.push(t);
          }
        }
        if (validTabs.length === 0) {
          // 数据全丢失：清空 meta，建空白笔记本
          tabs = [];
          await createTab({ skipSaveCurrent: true });
          return false;
        }
        tabs = validTabs;
        // 选择激活 tab
        let target = savedActive && tabs.find(t => t.id === savedActive) ? savedActive : tabs[0].id;
        // 同 id 的 localStorage 兜底快照更新时，直接以快照初始化该 tab
        const backup = readLocalStorageBackup();
        if (backup && backup.id === target) {
          try {
            const idbData = await storage.loadNotebook(target);
            if (!idbData || (backup.saved || '') >= (idbData.saved || '')) {
              if (userTypedInBootCells()) return false;
              activeTabId = null;
              await activateTab(target, { initData: backup });
              return true;
            }
          } catch (e) { /* IDB 读取失败：用快照兜底 */ }
        }
        if (userTypedInBootCells()) return false;
        activeTabId = null; // 强制 activateTab 走完整加载流程
        await activateTab(target);
        return true;
      } catch (e) {
        console.warn('[autosave] IndexedDB 读取失败，回退 localStorage:', e);
        useIndexedDB = false;
        // 回退到 localStorage（单 tab 模式）
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            tabs = [{ id: 'autosave', title: deriveTabTitleFromData(data) || defaultTabTitle(1), unsaved: false }];
            activeTabId = 'autosave';
            NOTEBOOK_ID = 'autosave';
            renderTabs();
            if (userTypedInBootCells()) return false;
            await restoreFromData(data);
            return true;
          }
        } catch (e2) {}
        return false;
      }
    }
    // localStorage 兜底（单 tab）
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      tabs = [{ id: 'autosave', title: deriveTabTitleFromData(data) || defaultTabTitle(1), unsaved: false }];
      activeTabId = 'autosave';
      NOTEBOOK_ID = 'autosave';
      renderTabs();
      if (userTypedInBootCells()) return false;
      await restoreFromData(data);
      return true;
    } catch (e) {
      showToast(editorT('editor.restoreFailed', '恢复自动保存失败：数据可能已损坏'));
      return false;
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

  // 读取 beforeunload 写入 localStorage 的兜底快照
  function readLocalStorageBackup() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return (data && Array.isArray(data.cells)) ? data : null;
    } catch (e) { return null; }
  }

  // 页面卸载前尽力保存（IndexedDB 异步，无法保证完成，但 1.5s 防抖通常已保存）
  window.addEventListener('beforeunload', () => {
    if (restoreDepth > 0) return; // 恢复中的半成品不得写进兜底快照
    if (isUnsaved) {
      const data = serializeNotebook();
      if (useIndexedDB) {
        // fire-and-forget，浏览器会在卸载前尽量完成
        try { storage.saveNotebook(data); } catch (e) {}
        try { storage.setMeta('tabOrder', tabs.map(t => ({ id: t.id, title: t.title }))); } catch (e) {}
        try { storage.setMeta('activeTab', activeTabId); } catch (e) {}
      }
      // 同时写 localStorage 作为兜底（同步，确保完成）
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    }
  });

  // ============== 搜索/替换 ==============
  // 已外移至 iris/js/editor/find-replace.js（editor.js 拆分第一批），
  // initEditor 末尾通过 editorModules.findReplace.init(ctx) 注入协作对象。

  // ============== 字号调节 ==============

  function applyFontSize(size) {
    // CM6 编辑器实例通过 setFontSize 设置字号
    cells.forEach(c => c.editor.setFontSize(size));
    try { localStorage.setItem('mdnb_fontsize', String(size)); } catch (e) {}
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

  // ============== 主题切换 ==============

  // 编辑器明暗由「站点主题（html data-mode）+ 会话内手动反转」共同决定：
  // 站点换到 dracula 等暗色主题时编辑器画布若仍停留在上次的亮色主题，
  // 会出现深底白卡打架；工具栏日月按钮只做本次会话的临时反转（sessionStorage）
  function applyEditorDarkMode(isDark) {
    document.body.classList.toggle('editor-dark-mode', isDark);
    // 同步切换所有 CM6 编辑器实例的主题
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
    try { sessionStorage.setItem('mdnb_theme', isDark ? 'dark' : 'light'); } catch (e) {}
  });

  // 编辑器开着时站点主题被切换（悬浮球设置面板）：未手动反转过则跟随
  window.addEventListener('themechange', () => {
    if (sessionEditorDark() === null) applyEditorDarkMode(siteModeDark());
  });

  // ============== 初始化 ==============

  // 创建全局"新建 Cell"按钮（始终在最后一个 cell 下方）
  globalAddBtn = document.createElement('button');
  globalAddBtn.className = 'add-cell-btn';
  globalAddBtn.textContent = '+ 新建 Cell';
  globalAddBtn.addEventListener('click', () => {
    // 在最后一个 cell 后方新建
    const lastCell = cells[cells.length - 1];
    createCell(lastCell ? lastCell.id : null);
  });
  editorMain.appendChild(globalAddBtn);

  loadTheme();

  // 恢复字号
  try {
    const savedSize = parseInt(localStorage.getItem('mdnb_fontsize'));
    if (savedSize) applyFontSize(savedSize);
  } catch (e) {}

  // 尝试恢复自动保存（IndexedDB 异步读取）
  createCell(); // 先创建默认 Cell，避免界面空白
  markSaved();
  // ===== 子系统注入（editor.js 拆分第一批：查找替换 / 图片上传外移模块） =====
  const findReplace = window.MarkdownPreview.editorModules.findReplace.init({
    searchPanel, searchInput, replaceInput, searchInfo, searchBtn,
    getCells: () => cells,
    getCell,
    getActiveCell,
    setActiveCellId: (id) => { activeCellId = id; },
    updateCellMeta,
    markModified,
    markUnsaved
  });
  const mediaUpload = window.MarkdownPreview.editorModules.mediaUpload;
  mediaUpload.init({
    editorT,
    showToast,
    markUnsaved,
    insertAtCursor,
    imageUploadBtn,
    imageUploadPopover,
    setActiveCellId: (id) => { activeCellId = id; }
  });

  // 版本快照（防手滑删稿的安全网：手动 + 30 分钟定时，可 diff 与回滚）
  // Mermaid 画中画（光标在 ```mermaid 围栏内时右下角实时预览）
  const mermaidPipMod = window.MarkdownPreview.editorModules &&
    window.MarkdownPreview.editorModules.mermaidPip;
  const mermaidPip = mermaidPipMod ? mermaidPipMod.init({ editorT }) : null;

  // 笔记本大纲侧栏（各 Cell 标题行 → 点击跳转定位）
  const outlineMod = window.MarkdownPreview.editorModules &&
    window.MarkdownPreview.editorModules.outline;
  const outline = outlineMod ? outlineMod.init({
    editorT,
    getCells: () => cells
  }) : null;

  // 可视化表格编辑器（输出区表格「编辑」→ 网格编辑 → 回写 Markdown 源码）
  const tableEditorMod = window.MarkdownPreview.editorModules &&
    window.MarkdownPreview.editorModules.tableEditor;
  const tableEditor = tableEditorMod ? tableEditorMod.init({
    editorT,
    showToast,
    getCells: () => cells,
    afterSourceEdit: (cellData) => {
      updateCellMeta(cellData);
      markModified(cellData);
      markUnsaved();
      runCell(cellData.id);
    }
  }) : null;

  // 模板脚手架：命令面板 / 「导入」菜单「从模板新建」经此建新笔记本
  window.MarkdownPreview.editorCreateTab = (initData, title) => {
    return createTab({ initData, title, skipSaveCurrent: true });
  };
  registerMenuAction('new-from-template', () => {
    window.MarkdownPreview.docTemplates?.openPicker?.();
  });

  // 仓库文档 → 编辑器 tab 的路径登记（「与 git HEAD 对比」用）
  const editorRepoPaths = window.MarkdownPreview.editorRepoPaths =
    window.MarkdownPreview.editorRepoPaths || new Map();
  registerMenuAction('diff-vs-head', () => {
    const repoPath = editorRepoPaths.get(activeTabId);
    if (!repoPath) {
      showToast(editorT('editor.notFromRepo', '当前笔记本不是从仓库文档打开的（用「在编辑器打开当前文档」试试）'));
      return;
    }
    const text = cells.map(c => c.textarea.value).join(String.fromCharCode(10, 10));
    window.MarkdownPreview.gitHistory?.openWorkingDiff?.(repoPath, text);
    window.MarkdownPreview.gitHistory?.openWorkingDiff?.(repoPath, text);
  });

  const versionSnapshotsMod = window.MarkdownPreview.editorModules &&
    window.MarkdownPreview.editorModules.versionSnapshots;
  let versionSnapshots = null;
  if (versionSnapshotsMod) {
    versionSnapshots = versionSnapshotsMod.init({
      editorT,
      showToast,
      getNotebookId: () => NOTEBOOK_ID,
      getCells: () => cells,
      // 结构化恢复：不经 Markdown 拆分，保留类型/内容/顺序/空 Cell
      restoreCells: async (cellsData) => {
        if (!Array.isArray(cellsData)) return;
        restoreDepth++;
        try {
          resetAllCells();
          for (const sdata of cellsData) {
            const nc = createCell(null, sdata.content || '', {
              type: sdata.type === 'plaintext' ? 'plaintext' : 'markdown'
            });
            updateLineNumbers(nc);
          }
          if (cells.length === 0) createCell();
          renumberCells();
          updateStatusbar();
        } finally {
          restoreDepth--;
        }
        markUnsaved();
      },
      registerMenuAction
    });
  }

  // 取件箱消费统一延迟到 loadAutosave 之后：否则有历史会话时 tabOrder 恢复
  // 会覆盖刚建的模板/文档 tab（CodeRabbit review fix）
  function consumePendingEditorJobs() {
    // 命令面板「从模板新建」在编辑器加载完成前点的
    window.MarkdownPreview.docTemplates?.consumePending?.();

    // 命令面板「在编辑器打开当前文档」：登记 repoPath 供 HEAD 对比
    const pendingDoc = window.MarkdownPreview.editorPendingContent;
    if (pendingDoc) {
      window.MarkdownPreview.editorPendingContent = null;
      createTab({ initData: pendingDoc.initData, title: pendingDoc.title, skipSaveCurrent: true })
        .then(tab => { if (pendingDoc.repoPath) editorRepoPaths.set(tab.id, pendingDoc.repoPath); });
    }
  }

  const bootCells = cells.slice(); // 启动时的初始 cell 引用
  bootCellsRef = bootCells;       // 供 loadAutosave 在恢复前判定是否已被输入
  loadAutosave().then(restored => {
    consumePendingEditorJobs();
    // 判定已下沉到 loadAutosave 的每个恢复分支之前（恢复后再查必然为 false）
    const userTypedFirst = bootCells.some(c => c && (c.textarea.value || '').trim());
    if (!restored && userTypedFirst) {
      showToast(editorT('editor.restoreSkipped', '检测到上次会话，但已有输入，未自动恢复'));
      return;
    }
    if (restored) {
      showToast(editorT('editor.sessionRestored', '已恢复上次会话'));
    } else if (tabs.length === 0) {
      // 无历史数据，初始化第一个空白 tab
      return createTab({ skipSaveCurrent: true });
    }
  }).catch(e => {
    console.warn('[autosave] 恢复失败:', e);
    if (tabs.length === 0) {
      createTab({ skipSaveCurrent: true }).catch(() => {});
    }
  });

  } // end initEditor()

  // 页面加载后检查是否需要进入编辑器模式
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkEditorMode);
  } else {
    checkEditorMode();
  }

})();
