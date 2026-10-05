/**
 * 存储管理页（设置面板「存储」区块）
 *
 * 把 IndexedDB / localStorage 的占用从黑盒变成可管理的清单：
 *   - navigator.storage.estimate() 用量条（已用 / 配额，浏览器精度不同，
 *     展示为近似值）
 *   - 编辑器笔记本（IndexedDB mdnb-db / notebooks）：逐条删除 + 全部清空，
 *     均带二次确认，删除后即时刷新
 *   - 浏览数据（localStorage）：阅读历史与收藏、阅读位置，显示条数并支持
 *     一键清理；设置本身不在此清理（避免误触丢配置）
 *
 * 由 settings.js 打开设置面板时调用 refresh() 渲染 / 刷新。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const HISTORY_KEY = 'md-preview-history';
  const FAV_KEY = 'md-preview-favorites';
  const READING_POS_KEY = 'md-preview-reading-pos';

  let els = null;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    if (bytes >= 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return bytes + ' B';
  }

  function readJsonArray(key) {
    try {
      const arr = JSON.parse(localStorage.getItem(key));
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function readJsonObject(key) {
    try {
      const obj = JSON.parse(localStorage.getItem(key));
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : {};
    } catch (e) { return {}; }
  }

  function lsBytes(key) {
    try { return (localStorage.getItem(key) || '').length; }
    catch (e) { return 0; }
  }

  // ============== 用量条 ==============
  async function renderUsage() {
    if (!els.usageFill || !els.usageText) return;
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
      els.usageText.textContent = t('storage.unavailable', '当前浏览器不支持存储用量查询');
      els.usageFill.style.width = '0';
      return;
    }
    try {
      const { usage, quota } = await navigator.storage.estimate();
      const pct = quota > 0 ? Math.min(100, (usage / quota) * 100) : 0;
      els.usageFill.style.width = pct.toFixed(1) + '%';
      els.usageText.textContent = t('storage.usage', '已用 {used} / 约 {quota}（{pct}%）')
        .replace('{used}', formatBytes(usage))
        .replace('{quota}', formatBytes(quota))
        .replace('{pct}', pct < 0.1 && pct > 0 ? '<0.1' : pct.toFixed(1));
    } catch (e) {
      els.usageText.textContent = t('storage.estimateFailed', '存储用量查询失败');
    }
  }

  // ============== 编辑器笔记本 ==============
  function renderNotebookRow(nb) {
    const li = document.createElement('li');
    li.className = 'storage-notebook-item';

    const main = document.createElement('div');
    main.className = 'storage-notebook-main';
    const name = document.createElement('span');
    name.className = 'storage-notebook-name';
    name.textContent = nb.title || t('storage.notebook.untitled', '未命名笔记本');
    const meta = document.createElement('span');
    meta.className = 'storage-notebook-meta';
    const cellCount = Array.isArray(nb.cells) ? nb.cells.length : 0;
    meta.textContent = t('storage.notebook.meta', '{cells} 个单元格 · 约 {size}')
      .replace('{cells}', cellCount)
      .replace('{size}', formatBytes(JSON.stringify(nb).length));
    main.append(name, meta);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'download-btn storage-notebook-delete';
    del.textContent = t('storage.delete', '删除');
    del.addEventListener('click', async () => {
      const ok = confirm(t('storage.notebook.deleteConfirm', '确定删除笔记本「{title}」？此操作不可恢复。')
        .replace('{title}', nb.title || nb.id));
      if (!ok) return;
      try {
        await window.MarkdownPreview.storage.deleteNotebook(nb.id);
      } catch (e) {
        alert(t('storage.notebook.deleteFailed', '删除失败，请重试'));
      }
      refresh();
    });

    li.append(main, del);
    return li;
  }

  async function renderNotebooks() {
    if (!els.notebookList || !els.notebookDesc) return;
    const storage = window.MarkdownPreview.storage;
    if (!storage || !storage.isAvailable || !storage.isAvailable()) {
      els.notebookDesc.textContent = t('storage.notebooks.unavailable', '当前浏览器不支持 IndexedDB');
      els.notebookList.innerHTML = '';
      return;
    }
    let notebooks = [];
    try {
      notebooks = await storage.listNotebooks();
    } catch (e) {
      els.notebookDesc.textContent = t('storage.notebooks.loadFailed', '笔记本数据读取失败');
      return;
    }
    notebooks.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { numeric: true }));
    const totalBytes = notebooks.reduce((sum, nb) => sum + JSON.stringify(nb).length, 0);
    els.notebookDesc.textContent = notebooks.length === 0
      ? t('storage.notebooks.empty', '暂无笔记本数据')
      : t('storage.notebooks.summary', '{n} 个笔记本 · 共约 {size}')
          .replace('{n}', notebooks.length)
          .replace('{size}', formatBytes(totalBytes));
    els.notebookClearBtn.hidden = notebooks.length === 0;
    els.notebookList.innerHTML = '';
    notebooks.forEach(nb => els.notebookList.appendChild(renderNotebookRow(nb)));
  }

  async function clearAllNotebooks() {
    const storage = window.MarkdownPreview.storage;
    if (!storage) return;
    let notebooks = [];
    try { notebooks = await storage.listNotebooks(); } catch (e) { return; }
    if (notebooks.length === 0) return;
    const ok = confirm(t('storage.notebooks.clearConfirm',
      '确定清空全部 {n} 个笔记本？此操作不可恢复。').replace('{n}', notebooks.length));
    if (!ok) return;
    for (const nb of notebooks) {
      try { await storage.deleteNotebook(nb.id); } catch (e) { /* 继续清理其余 */ }
    }
    refresh();
  }

  // ============== 浏览数据（localStorage） ==============
  function renderDataRow(key, rows) {
    const row = document.createElement('div');
    row.className = 'setting-item storage-data-row';

    const info = document.createElement('div');
    const label = document.createElement('div');
    label.className = 'setting-label';
    label.textContent = rows.label;
    const desc = document.createElement('div');
    desc.className = 'setting-description';
    desc.textContent = rows.desc
      .replace('{n}', rows.count)
      .replace('{size}', formatBytes(lsBytes(rows.keys[0]) + (rows.keys[1] ? lsBytes(rows.keys[1]) : 0)));
    info.append(label, desc);

    const control = document.createElement('div');
    control.className = 'setting-control';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'download-btn';
    clear.textContent = t('storage.clear', '清理');
    clear.disabled = rows.count === 0;
    clear.addEventListener('click', () => {
      const ok = confirm(t('storage.clearConfirm', '确定清理「{label}」？此操作不可恢复。')
        .replace('{label}', rows.label));
      if (!ok) return;
      rows.keys.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) { /* 忽略 */ }
      });
      // 历史与收藏清理后同步刷新文件树内的收藏 / 最近提示
      if (rows.keys.indexOf(HISTORY_KEY) !== -1 || rows.keys.indexOf(FAV_KEY) !== -1) {
        window.MarkdownPreview.history?.syncTreeHints?.();
      }
      refresh();
    });
    control.appendChild(clear);

    row.append(info, control);
    return row;
  }

  function renderBrowsingData() {
    if (!els.dataList) return;
    const favs = readJsonArray(FAV_KEY);
    const history = readJsonArray(HISTORY_KEY);
    const pos = readJsonObject(READING_POS_KEY);
    const posCount = Object.keys(pos).length;

    els.dataList.innerHTML = '';
    els.dataList.appendChild(renderDataRow(HISTORY_KEY, {
      label: t('storage.data.historyFav', '阅读历史与收藏'),
      desc: t('storage.data.historyFavDesc', '{n} 条记录 · 约 {size}'),
      count: history.length + favs.length,
      keys: [HISTORY_KEY, FAV_KEY]
    }));
    els.dataList.appendChild(renderDataRow(READING_POS_KEY, {
      label: t('storage.data.readingPos', '阅读位置'),
      desc: t('storage.data.readingPosDesc', '{n} 篇文档 · 约 {size}'),
      count: posCount,
      keys: [READING_POS_KEY]
    }));
  }

  // ============== 入口 ==============
  function bindOnce() {
    if (els) return;
    els = {
      usageFill: document.getElementById('storageUsageFill'),
      usageText: document.getElementById('storageUsageText'),
      notebookList: document.getElementById('storageNotebookList'),
      notebookDesc: document.getElementById('storageNotebooksDesc'),
      notebookClearBtn: document.getElementById('storageNotebooksClearBtn'),
      dataList: document.getElementById('storageDataList')
    };
    els.notebookClearBtn?.addEventListener('click', clearAllNotebooks);
  }

  function refresh() {
    bindOnce();
    if (!els.usageText) return;
    renderUsage();
    renderNotebooks();
    renderBrowsingData();
  }

  // 语言切换后重建动态文案（静态标签由 data-i18n + i18n.apply 处理）
  window.addEventListener('langchange', () => refresh());

  window.MarkdownPreview.storageManager = { refresh };
})();
