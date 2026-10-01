/**
 * 浏览历史与收藏夹
 *
 * localStorage 记录阅读轨迹，侧边栏新增「最近阅读」「收藏」两个分组，
 * 与「本地文件」面板同级（位于其下、文件树之上），空组自动隐藏。
 *
 * 存储：
 *   - md-preview-history    最近打开的仓库文档（去重置顶，上限 50 条）
 *   - md-preview-favorites  收藏的文档（收藏按钮置顶/取消，上限 100 条）
 *   条目：{ path, title, ts }
 *
 * 收藏入口：页头右侧星标按钮（与「文档放映 / 分享卡片」同区），
 * 当前文档已收藏时常亮；悬停文档列表项的 × 可移除。
 *
 * 仅记录仓库文档；本地文件刷新即失效，不入历史。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const HISTORY_KEY = 'md-preview-history';
  const FAV_KEY = 'md-preview-favorites';
  const HISTORY_LIMIT = 50;
  const FAV_LIMIT = 100;

  let historyPanel = null;
  let favPanel = null;
  let favBtn = null;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function load(key) {
    try {
      const arr = JSON.parse(localStorage.getItem(key));
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function save(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); }
    catch (e) { /* 隐私模式下静默跳过 */ }
  }

  // ============== 数据操作 ==============
  function recordHistory(path, title) {
    if (!path) return;
    let arr = load(HISTORY_KEY).filter(item => item.path !== path);
    arr.unshift({ path, title: title || path, ts: Date.now() });
    save(HISTORY_KEY, arr.slice(0, HISTORY_LIMIT));
  }

  function isFavorite(path) {
    return load(FAV_KEY).some(item => item.path === path);
  }

  function toggleFavorite(path, title) {
    if (!path) return false;
    let arr = load(FAV_KEY);
    if (arr.some(item => item.path === path)) {
      arr = arr.filter(item => item.path !== path);
      save(FAV_KEY, arr);
      return false;
    }
    arr.unshift({ path, title: title || path, ts: Date.now() });
    save(FAV_KEY, arr.slice(0, FAV_LIMIT));
    return true;
  }

  function removeItem(key, path) {
    save(key, load(key).filter(item => item.path !== path));
  }

  function clearKey(key) {
    save(key, []);
  }

  // ============== 侧边栏面板 ==============
  function icon(name, size) {
    return `<svg width="${size || 13}" height="${size || 13}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  function ensurePanels() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const fileTree = document.getElementById('fileTree');
    if (!fileTree) return;

    if (!historyPanel) {
      historyPanel = document.createElement('div');
      historyPanel.className = 'local-files history-panel';
      historyPanel.id = 'historyPanel';
      historyPanel.hidden = true;
    }
    if (!favPanel) {
      favPanel = document.createElement('div');
      favPanel.className = 'local-files fav-panel';
      favPanel.id = 'favPanel';
      favPanel.hidden = true;
    }
    // 插入到文件树之前、本地文件面板之后
    const localPanel = document.getElementById('localFilesPanel');
    const anchor = localPanel ? localPanel.nextSibling : fileTree;
    if (historyPanel.parentNode !== sidebar) sidebar.insertBefore(historyPanel, anchor);
    if (favPanel.parentNode !== sidebar) sidebar.insertBefore(favPanel, anchor);
  }

  function buildPanel(panel, entries, opts) {
    panel.innerHTML = `
      <div class="local-files-header">
        <button type="button" class="local-files-toggle" aria-expanded="true">
          <span class="local-files-title"></span>
        </button>
        ${opts.clearable ? `<button type="button" class="local-files-clear" title="${esc(opts.clearTitle)}" aria-label="${esc(opts.clearTitle)}">${icon('i-trash')}</button>` : ''}
      </div>
      <ul class="local-files-list"></ul>
    `;
    panel.querySelector('.local-files-title').textContent = opts.title;
    // 折叠 / 展开（与会话记忆不同：组内不做持久化，简单切换即可）
    const toggle = panel.querySelector('.local-files-toggle');
    toggle.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('collapsed');
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
    if (opts.clearable) {
      panel.querySelector('.local-files-clear').addEventListener('click', () => {
        clearKey(opts.key);
        renderPanels();
      });
    }

    const list = panel.querySelector('.local-files-list');
    entries.forEach(item => {
      const li = document.createElement('li');
      li.className = 'local-file-item history-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'local-file-name history-item-name';
      btn.title = item.path;
      btn.textContent = item.title || item.path;
      btn.addEventListener('click', () => {
        window.MarkdownPreview.markdown.loadMarkdownFile(item.path);
        window.MarkdownPreview.fileTree.highlightFileInSidebar(item.path);
        window.MarkdownPreview.fileTree.closeSidebarOnMobile();
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'local-file-remove';
      remove.title = esc(opts.removeTitle);
      remove.setAttribute('aria-label', esc(opts.removeTitle));
      remove.innerHTML = icon('i-x', 11);
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        removeItem(opts.key, item.path);
        renderPanels();
      });

      li.appendChild(btn);
      li.appendChild(remove);
      list.appendChild(li);
    });

    panel.hidden = entries.length === 0;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderPanels() {
    ensurePanels();
    if (!historyPanel || !favPanel) return;
    buildPanel(historyPanel, load(HISTORY_KEY), {
      key: HISTORY_KEY,
      title: t('history.title', '最近阅读'),
      clearable: true,
      clearTitle: t('history.clear', '清空阅读历史'),
      removeTitle: t('history.remove', '从历史中移除')
    });
    buildPanel(favPanel, load(FAV_KEY), {
      key: FAV_KEY,
      title: t('fav.title', '收藏'),
      clearable: false,
      removeTitle: t('fav.remove', '取消收藏')
    });
    syncFavButton();
  }

  // ============== 页头星标按钮 ==============
  function ensureFavButton() {
    if (favBtn) return favBtn;
    favBtn = document.getElementById('favDocBtn');
    if (!favBtn) return null;
    favBtn.addEventListener('click', () => {
      const st = window.MarkdownPreview.state;
      if (!st.currentFilePath) return;
      toggleFavorite(st.currentFilePath, st.docTitle);
      renderPanels();
    });
    return favBtn;
  }

  function syncFavButton() {
    const st = window.MarkdownPreview.state;
    if (!favBtn) return;
    const active = st.currentFilePath && isFavorite(st.currentFilePath);
    favBtn.classList.toggle('active', !!active);
    favBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }

  // ---------- 对外钩子 ----------

  // 文档渲染完成（markdown.js 调用）：记录历史 + 同步星标态
  function onDocRendered(path, title) {
    if (!path) return;
    recordHistory(path, title);
    renderPanels();
  }

  function init() {
    ensureFavButton();
    renderPanels();
    // 语言切换后重建面板文案
    document.addEventListener('langchange', renderPanels);
  }

  window.MarkdownPreview.history = {
    init,
    onDocRendered,
    renderPanels,
    isFavorite,
    toggleFavorite
  };
})();
