(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  // 悬浮侧边栏拖拽调宽/调高：右缘调宽、下缘调高，桌面端仅展开态可用
  // 尺寸持久化到 localStorage（md-preview-sidebar-size），与 --sidebar-width / --sidebar-height CSS 变量联动

  const STORAGE_KEY = 'md-preview-sidebar-size';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function loadSize() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return {
        width: Number(parsed.width) || null,
        height: Number(parsed.height) || null
      };
    } catch (e) {
      return {};
    }
  }

  function saveSize(size) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
    } catch (e) { /* 存储不可用时静默降级为会话内生效 */ }
  }

  function applySize(size) {
    const root = document.documentElement;
    if (size.width) {
      root.style.setProperty('--sidebar-width', size.width + 'px');
    } else {
      root.style.removeProperty('--sidebar-width');
    }
    if (size.height) {
      root.style.setProperty('--sidebar-height', size.height + 'px');
    } else {
      root.style.removeProperty('--sidebar-height');
    }
  }

  function init() {
    // 移动端抽屉（≤768px）不启用拖拽
    if (window.matchMedia('(max-width: 768px)').matches) return;

    const sidebar = document.getElementById('sidebar');
    const handleE = document.getElementById('sidebarResizeE');
    const handleS = document.getElementById('sidebarResizeS');
    if (!sidebar || !handleE || !handleS) return;

    const size = loadSize();
    applySize(size);

    function startDrag(e, dir) {
      // 折叠态不可拖拽
      if (document.body.classList.contains('sidebar-collapsed')) return;
      e.preventDefault();

      const point = e.touches ? e.touches[0] : e;
      const startX = point.clientX;
      const startY = point.clientY;
      const rect = sidebar.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;

      const css = getComputedStyle(document.documentElement);
      const minWidth = parseInt(css.getPropertyValue('--sidebar-min-width'), 10) || 240;
      const maxWidth = parseInt(css.getPropertyValue('--sidebar-max-width'), 10) || 420;
      const inset = parseInt(css.getPropertyValue('--sidebar-inset'), 10) || 10;
      const maxHeight = window.innerHeight - inset * 2;

      document.body.classList.add('sidebar-resizing');

      function onMove(ev) {
        const p = ev.touches ? ev.touches[0] : ev;
        if (dir === 'e') {
          const next = clamp(startWidth + (p.clientX - startX), minWidth, maxWidth);
          size.width = Math.round(next);
          document.documentElement.style.setProperty('--sidebar-width', size.width + 'px');
        } else {
          const next = clamp(startHeight + (p.clientY - startY), 200, maxHeight);
          size.height = Math.round(next);
          document.documentElement.style.setProperty('--sidebar-height', size.height + 'px');
        }
        if (ev.cancelable) ev.preventDefault();
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
        document.body.classList.remove('sidebar-resizing');
        saveSize(size);
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }

    handleE.addEventListener('mousedown', (e) => startDrag(e, 'e'));
    handleS.addEventListener('mousedown', (e) => startDrag(e, 's'));
    handleE.addEventListener('touchstart', (e) => startDrag(e, 'e'), { passive: false });
    handleS.addEventListener('touchstart', (e) => startDrag(e, 's'), { passive: false });
  }

  window.MarkdownPreview.sidebarResize = { init };
})();
