/**
 * palette - Ctrl/⌘+K 万能命令面板的动作注册表
 *
 * 与搜索面板（search.js / ui.js）共用一个输入框：
 *   - 空查询时列出全部动作，直接点击执行
 *   - 输入 `>` 前缀进入纯命令模式（只匹配动作）
 *   - 普通查询时文档结果之后追加命中的动作（混排）
 *
 * 动作覆盖高频操作：主题切换、开关侧边栏、打开设置、导出、
 * 复制链接、全量离线缓存、随机阅读、专注模式、打开编辑器。
 * 新增动作只需在 ACTIONS 里加一项（icon 为 index.html SVG sprite id）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.palette = {};

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function icon(name, size) {
    return `<svg width="${size || 14}" height="${size || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // ============== 动作注册表 ==============
  const THEME_ACTIONS = [
    { id: 'auto', labelKey: 'settings.theme.auto', fallback: '自动（跟随系统）' },
    { id: 'default', labelKey: 'settings.theme.default', fallback: '紫粉渐变' },
    { id: 'github-light', label: 'GitHub Light' },
    { id: 'github-dark', label: 'GitHub Dark' },
    { id: 'notion', label: 'Notion' },
    { id: 'arc', label: 'Arc Dark' },
    { id: 'dracula', label: 'Dracula' },
    { id: 'nord', label: 'Nord' }
  ];

  function themeAction(theme) {
    return {
      id: 'theme-' + theme.id,
      icon: theme.id === 'auto' ? 'i-refresh' : (DARKISH.has(theme.id) ? 'i-moon' : 'i-sun'),
      label: theme.label || t(theme.labelKey, theme.fallback),
      group: t('cmd.groupTheme', '主题'),
      run: () => {
        if (window.MarkdownPreview.themes) {
          window.MarkdownPreview.themes.setTheme(theme.id);
        }
      }
    };
  }

  const DARKISH = new Set(['github-dark', 'arc', 'dracula', 'nord']);

  function focusModeRun() {
    const on = window.MarkdownPreview.focusMode ? window.MarkdownPreview.focusMode.toggle() : false;
    if (window.MarkdownPreview.settings) {
      const s = window.MarkdownPreview.settings.load();
      s.focusMode = on;
      window.MarkdownPreview.settings.save(s);
    }
  }

  function randomDocRun() {
    const { fileTree, markdown } = window.MarkdownPreview;
    const files = fileTree && fileTree.getAllFilesInDFSOrder ? fileTree.getAllFilesInDFSOrder() : [];
    if (!files.length) return;
    const pick = files[Math.floor(Math.random() * files.length)];
    markdown.loadMarkdownFile(pick.path);
    fileTree.highlightFileInSidebar(pick.path);
  }

  function copyPageLinkRun() {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  function cacheAllRun(btn) {
    const { offline } = window.MarkdownPreview;
    if (!offline || !offline.swSupported()) return;
    const labelEl = btn.querySelector('span');
    const original = labelEl ? labelEl.textContent : '';
    offline.cacheAll({
      onProgress: (done, total) => {
        if (labelEl) labelEl.textContent = `${done}/${total}`;
      }
    }).then(result => {
      if (labelEl) {
        labelEl.textContent = t('cmd.cacheDone', '已缓存 {n} 篇').replace('{n}', result.done);
        setTimeout(() => { labelEl.textContent = original; }, 2000);
      }
    });
  }

  function buildActions() {
    const actions = [
      {
        id: 'toggle-sidebar',
        icon: 'i-list',
        label: t('cmd.toggleSidebar', '开关侧边栏'),
        run: () => window.MarkdownPreview.fileTree && window.MarkdownPreview.fileTree.toggleSidebar()
      },
      {
        id: 'open-settings',
        icon: 'i-gear',
        label: t('cmd.openSettings', '打开设置'),
        run: () => window.MarkdownPreview.settings && window.MarkdownPreview.settings.open()
      },
      {
        id: 'focus-mode',
        icon: 'i-eye',
        label: t('cmd.focusMode', '专注模式'),
        run: focusModeRun
      },
      {
        id: 'random-doc',
        icon: 'i-shuffle',
        label: t('cmd.randomDoc', '随机读一篇'),
        run: randomDocRun
      },
      {
        id: 'copy-link',
        icon: 'i-link',
        label: t('cmd.copyLink', '复制页面链接'),
        run: copyPageLinkRun
      },
      {
        id: 'export-pdf',
        icon: 'i-download',
        label: t('cmd.exportPdf', '导出 PDF（打印）'),
        run: () => window.print()
      },
      {
        id: 'export-md',
        icon: 'i-download',
        label: t('cmd.exportMd', '导出 Markdown'),
        run: () => window.MarkdownPreview.settings && window.MarkdownPreview.settings.downloadCurrentFile()
      },
      {
        id: 'export-html',
        icon: 'i-download',
        label: t('cmd.exportHtml', '导出单文件 HTML'),
        run: () => window.MarkdownPreview.settings && window.MarkdownPreview.settings.exportStandaloneHtml()
      },
      {
        id: 'cache-all',
        icon: 'i-zap',
        label: t('cmd.cacheAll', '缓存全部文档（离线）'),
        run: cacheAllRun
      },
      {
        id: 'open-editor',
        icon: 'i-code',
        label: t('cmd.openEditor', '打开编辑器'),
        run: () => window.MarkdownPreview.enterEditorMode && window.MarkdownPreview.enterEditorMode()
      }
    ];
    THEME_ACTIONS.forEach(theme => actions.push(themeAction(theme)));
    return actions;
  }

  let cachedActions = null;
  function actions() {
    if (!cachedActions) cachedActions = buildActions();
    return cachedActions;
  }

  // ============== 渲染 ==============

  function matchActions(query) {
    const q = (query || '').toLowerCase().trim();
    const list = actions();
    if (!q) return list;
    return list.filter(a =>
      a.label.toLowerCase().includes(q) ||
      (a.group || '').toLowerCase().includes(q) ||
      a.id.includes(q)
    );
  }

  function buildItem(action) {
    const item = document.createElement('div');
    item.className = 'search-result-item palette-command-item';
    item.innerHTML = `
      <span class="palette-command-icon">${icon(action.icon, 15)}</span>
      <div class="palette-command-body">
        <div class="search-result-title">${escapeHtml(action.label)}</div>
      </div>
      <span class="palette-command-group">${escapeHtml(action.group || t('cmd.groupAction', '命令'))}</span>
    `;
    item.addEventListener('click', () => {
      closePalette();
      action.run(item);
    });
    return item;
  }

  function sectionHeader(text) {
    const el = document.createElement('div');
    el.className = 'palette-section-header';
    el.textContent = text;
    return el;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function closePalette() {
    if (window.MarkdownPreview.ui && window.MarkdownPreview.ui.closeSearchPalette) {
      window.MarkdownPreview.ui.closeSearchPalette();
    }
  }

  // 纯命令模式（查询以 > 开头）：结果容器里只渲染动作
  function renderCommands(filterText) {
    const { dom } = window.MarkdownPreview;
    const container = dom.searchResults;
    container.innerHTML = '';
    container.classList.add('active');

    const matched = matchActions(filterText);
    if (matched.length === 0) {
      container.innerHTML = `<div class="search-no-results">${t('cmd.noMatch', '没有匹配的命令')}</div>`;
      return;
    }
    container.appendChild(sectionHeader(t('cmd.groupCommands', '命令')));
    matched.forEach(a => container.appendChild(buildItem(a)));
  }

  // 混排模式：文档结果之后追加命中动作（最多 4 条）
  function appendInline(query, container, limit) {
    const matched = matchActions(query).slice(0, limit || 4);
    if (matched.length === 0) return;
    container.appendChild(sectionHeader(t('cmd.groupCommands', '命令')));
    matched.forEach(a => container.appendChild(buildItem(a)));
  }

  // 查询是否为纯命令模式
  function isCommandQuery(query) {
    return typeof query === 'string' && query.trimStart().startsWith('>');
  }

  function stripPrefix(query) {
    return query.trimStart().replace(/^>\s*/, '');
  }

  window.MarkdownPreview.palette = {
    renderCommands,
    appendInline,
    isCommandQuery,
    stripPrefix,
    actions
  };
})();
