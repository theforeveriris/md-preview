/**
 * 浏览历史与收藏（文件树内提示）
 *
 * 不设独立的侧边栏分组，直接在文件树上呈现：
 *   - 长按文件树中的文档（约 600ms）→ 收藏 / 取消收藏；
 *     收藏文档的文件图标变为强调色（默认主题下为淡紫色，随主题变量适配）
 *   - 最近打开的最多 5 篇文档在文件树中淡化显示（文件名颜色变浅）
 *
 * 存储（localStorage）：
 *   - md-preview-history    最近打开的仓库文档（去重置顶，上限 50 条）
 *   - md-preview-favorites  收藏的文档（上限 100 条）
 *   条目：{ path, title, ts }
 *
 * 实现要点：
 *   - 路径 → li 映射来自 file-tree.js 的 state.fileLiMap（li 位于
 *     vendor 组件的 Shadow DOM 内）；提示样式由 file-tree.js 注入
 *     shadow 的 CSS 定义（li.fav / li.recent 类），颜色走主题变量
 *   - 长按通过 pointer 事件 + composedPath 穿透 Shadow DOM 定位 li；
 *     触发后拦截随之而来的 vendor click（避免误开文档），并抑制
 *     移动端长按弹出的系统菜单
 *   - 仅记录仓库文档；本地文件刷新即失效，不入历史
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const HISTORY_KEY = 'md-preview-history';
  const FAV_KEY = 'md-preview-favorites';
  const HISTORY_LIMIT = 50;
  const FAV_LIMIT = 100;
  const RECENT_LIMIT = 5;
  const LONG_PRESS_MS = 600;
  const MOVE_TOLERANCE = 8;

  let pressTimer = null;
  let pressStart = null;      // { x, y, li, pointerType }
  let lastPointerType = '';
  let suppressClickUntil = 0; // 长按后拦截 vendor click 的时间窗

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

  // ============== 文件树提示（fav / recent 类） ==============
  function syncTreeHints() {
    const st = window.MarkdownPreview.state;
    if (!st || !st.fileLiMap) return;
    const favs = new Set(load(FAV_KEY).map(item => item.path));
    const recents = new Set(load(HISTORY_KEY).slice(0, RECENT_LIMIT).map(item => item.path));
    for (const [path, li] of st.fileLiMap) {
      li.classList.toggle('fav', favs.has(path));
      li.classList.toggle('recent', recents.has(path));
    }
  }

  // ============== 长按收藏 ==============
  function findLiFromEvent(e) {
    const path = e.composedPath ? e.composedPath() : [];
    for (const node of path) {
      if (node.nodeType === 1 && node.tagName === 'LI' &&
          (node.classList && (node.classList.contains('file') || node.classList.contains('text')))) {
        return node;
      }
    }
    return null;
  }

  function pathForLi(li) {
    const st = window.MarkdownPreview.state;
    if (!st || !st.fileLiMap) return null;
    for (const [path, item] of st.fileLiMap) {
      if (item === li) return path;
    }
    return null;
  }

  function basename(path) {
    try {
      return decodeURIComponent(path.split('/').pop() || '').replace(/\.md$/i, '');
    } catch (e) {
      return path.split('/').pop() || path;
    }
  }

  let toastEl = null;
  let toastTimer = null;
  function showFavToast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'mini-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('open');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('open'), 1800);
  }

  function fireLongPress() {
    const start = pressStart;
    clearTimeout(pressTimer);
    pressStart = null;
    if (!start) return;
    const path = pathForLi(start.li);
    if (!path) return;
    const title = basename(path);
    const added = toggleFavorite(path, title);
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* 忽略 */ } }
    // 拦截随之而来的 vendor click，避免长按后误开文档
    suppressClickUntil = Date.now() + 400;
    showFavToast(added
      ? t('fav.added', '已收藏《{t}》').replace('{t}', title)
      : t('fav.removed', '已取消收藏《{t}》').replace('{t}', title));
    syncTreeHints();
  }

  function initLongPress() {
    const treeRoot = document.getElementById('fileTree');
    if (!treeRoot || treeRoot.dataset.longPressInit) return;
    treeRoot.dataset.longPressInit = '1';

    treeRoot.addEventListener('pointerdown', (e) => {
      const li = findLiFromEvent(e);
      lastPointerType = e.pointerType || '';
      if (!li) return;
      pressStart = { x: e.clientX, y: e.clientY, li };
      clearTimeout(pressTimer);
      pressTimer = setTimeout(fireLongPress, LONG_PRESS_MS);
    });
    const cancelPress = () => {
      clearTimeout(pressTimer);
      pressStart = null;
    };
    treeRoot.addEventListener('pointermove', (e) => {
      if (!pressStart) return;
      if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > MOVE_TOLERANCE) {
        cancelPress();
      }
    });
    treeRoot.addEventListener('pointerup', cancelPress);
    treeRoot.addEventListener('pointercancel', cancelPress);

    // 长按触发后的 click（vendor 自定义事件）不打开文档
    treeRoot.addEventListener('click', (e) => {
      if (Date.now() > suppressClickUntil) return;
      if (e.detail && typeof e.detail === 'object' &&
          e.detail.action === 'click' && !e.detail.folder) {
        e.stopImmediatePropagation();
        e.preventDefault();
        suppressClickUntil = 0;
      }
    }, true);

    // 触摸长按时抑制系统菜单，保证收藏手势可靠
    treeRoot.addEventListener('contextmenu', (e) => {
      if (lastPointerType === 'touch') e.preventDefault();
    });
  }

  // ============== 对外钩子 ==============

  // 文档渲染完成（markdown.js 调用）：记录历史 + 刷新树内提示
  function onDocRendered(path, title) {
    if (!path) return;
    recordHistory(path, title);
    // 已收藏的文档同步更新标题（文件名 → 文档标题）
    const arr = load(FAV_KEY);
    const fav = arr.find(item => item.path === path);
    if (fav && title && fav.title !== title) {
      fav.title = title;
      save(FAV_KEY, arr);
    }
    syncTreeHints();
  }

  function init() {
    initLongPress();
    // 文件树（重）渲染后的提示刷新由 file-tree.js 渲染完成后直接调用 syncTreeHints()
  }

  window.MarkdownPreview.history = {
    init,
    onDocRendered,
    syncTreeHints,
    isFavorite,
    toggleFavorite
  };
})();
