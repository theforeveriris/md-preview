/**
 * 移动端手势（触屏）
 *
 * 两个手势，均只在移动端视口（≤768px）且触屏设备上生效：
 *   - 正文区左右滑（横向位移 ≥60px、纵向 ≤40px）→ 上一篇 / 下一篇，
 *     复用悬浮球与 [ / ] 快捷键的翻页逻辑（本地文件会话优先，其次仓库文档）
 *   - 屏幕左缘约 24px 起始的右滑 → 呼出侧边栏抽屉（移动端 drawer）
 *
 * 冲突规避：
 *   - 设置开关「启用移动端手势」（settings.mobileGestures，默认开启）
 *   - 编辑器模式 / 设置面板 / 搜索面板 / 灯箱 / PPTX 放映打开时不启用
 *   - 手势起点落在横向滚动容器（长表格、代码块）、侧边栏、悬浮球等
 *     浮层内时不启用，避免与横向滚动 / 浮层交互互相抢占
 *   - iOS Safari 边缘右滑默认让位系统返回：系统接管时 touchcancel，
 *     本模块自然不触发；多指触摸（捏合等）忽略
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const SWIPE_MIN_PX = 60;   // 翻页手势横向位移阈值
  const SWIPE_MAX_DY = 40;   // 纵向位移上限（超过视为滚动，不判翻页）
  const EDGE_PX = 24;        // 左缘侧边栏手势判定带宽
  const EDGE_MIN_PX = 60;    // 侧边栏手势最小右滑位移

  // 一次只跟踪一个触摸点
  let touch = null; // { x, y, edge }

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function gesturesEnabled() {
    const settings = window.MarkdownPreview.settings;
    try {
      if (settings && settings.load) return settings.load().mobileGestures !== false;
    } catch (e) { /* 设置未就绪时按默认开启处理 */ }
    return true;
  }

  function isMobileViewport() {
    return window.innerWidth <= 768;
  }

  // 浮层打开时让位：与 ui.js isMediaOverlayOpen 同口径，另含设置 / 搜索面板
  function overlayBlocking() {
    const lightbox = document.getElementById('lightboxOverlay');
    const pptx = document.getElementById('pptx-slideshow-overlay');
    const settingsOverlay = document.getElementById('settingsOverlay');
    const palette = document.getElementById('paletteOverlay');
    if (lightbox && lightbox.classList.contains('open')) return true;
    if (pptx && pptx.classList.contains('is-open')) return true;
    if (settingsOverlay && settingsOverlay.classList.contains('open')) return true;
    if (palette && palette.classList.contains('active')) return true;
    return false;
  }

  // 手势起点排除区：横向滚动容器与各种浮层 / 交互控件
  const EXCLUDE_SELECTOR = [
    '.table-wrapper', 'table', 'pre',
    '#sidebar', '#sidebarOverlay',
    '.floating-menu', '.settings-overlay', '.local-pick-overlay',
    '.palette-overlay', '.resume-toast', '.mini-toast',
    '.doc-selection-toolbar', '.qr-share-modal', '.drop-overlay',
    'input, textarea, select, button, a, [contenteditable="true"]'
  ].join(', ');

  function inExcludedZone(el) {
    return !!(el && el.closest && el.closest(EXCLUDE_SELECTOR));
  }

  // 翻页：本地文件会话优先（与 localDocs 的 [ / ] 行为一致），其次仓库文档
  function navigate(direction) {
    const md = window.MarkdownPreview;
    if (!md || !md.state) return;
    if (md.state.localFiles && md.state.localFiles.length > 0 &&
        md.localDocs && md.localDocs.navigateLocal) {
      if (md.localDocs.navigateLocal(direction)) return;
    }
    if (!md.state.currentFilePath) return;
    const { prev, next } = md.fileTree.getAdjacentFiles(md.state.currentFilePath);
    const target = direction === 'prev' ? prev : next;
    if (!target) return;
    md.markdown.loadMarkdownFile(target.path);
    md.fileTree.highlightFileInSidebar(target.path);
  }

  // 左缘右滑：呼出侧边栏抽屉（已打开则不重复动作）
  function openSidebarDrawer() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (!sidebar.classList.contains('open')) {
      window.MarkdownPreview.fileTree.toggleSidebar();
    }
  }

  function onTouchStart(e) {
    if (touch) return;
    if (e.touches.length !== 1) return;
    if (!isMobileViewport() || !gesturesEnabled()) return;
    if (document.body.classList.contains('editor-mode')) return;
    if (overlayBlocking()) return;

    const t0 = e.touches[0];
    const startEl = e.target;
    if (inExcludedZone(startEl)) return;

    touch = {
      x: t0.clientX,
      y: t0.clientY,
      edge: t0.clientX <= EDGE_PX
    };
  }

  function onTouchEnd(e) {
    if (!touch) return;
    const t0 = e.changedTouches[0];
    if (!t0) { touch = null; return; }

    const dx = t0.clientX - touch.x;
    const dy = t0.clientY - touch.y;
    const edge = touch.edge;
    touch = null;

    if (Math.abs(dy) > SWIPE_MAX_DY) return;

    // 左缘右滑 → 呼出侧边栏
    if (edge && dx > EDGE_MIN_PX) {
      openSidebarDrawer();
      return;
    }

    // 正文横向滑动 → 翻页：左滑下一篇，右滑上一篇
    if (!edge && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      navigate(dx < 0 ? 'next' : 'prev');
    }
  }

  function onTouchCancel() {
    touch = null;
  }

  function init() {
    // 无触屏的桌面环境不监听，避免无谓开销
    if (!('ontouchstart' in window) && !(navigator.maxTouchPoints > 0)) return;
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
  }

  window.MarkdownPreview.gestures = { init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
