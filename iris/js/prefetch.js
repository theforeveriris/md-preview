/**
 * 相邻文档预取（PERF-4）
 *
 * [ / ] 与悬浮球、doc-navigation 的上/下一篇切换时，若目标文档已提前进入
 * HTTP 缓存（由 Service Worker 的 .md 运行时缓存接管），切换即为「瞬时」。
 *
 * 预取时机：
 *   - 文档渲染完成后（空闲时）预取文件树 DFS 顺序的上一篇 / 下一篇
 *   - 鼠标悬停文件树条目 / 正文内站内链接时，预取其指向的文档
 *
 * 开关：settings.prefetchAdjacent（默认开启）。移动端流量敏感场景可关闭。
 * 全部请求都是「尽力而为」——失败静默忽略，不影响阅读。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const warmed = new Set();
  let idleHandle = null;

  function enabled() {
    const s = window.MarkdownPreview.settings;
    try {
      const cfg = s && typeof s.load === 'function' ? s.load() : null;
      return !cfg || cfg.prefetchAdjacent !== false;
    } catch (e) {
      return true;
    }
  }

  function currentPath() {
    const st = window.MarkdownPreview.state;
    return st && st.currentFilePath ? st.currentFilePath : '';
  }

  // 预取单个文档（去重；不预取当前文档）
  function warm(path) {
    if (!path || typeof path !== 'string') return;
    if (!path.endsWith('.md')) return;
    if (path === currentPath()) return;
    if (warmed.has(path)) return;
    warmed.add(path);
    try {
      // 由 Service Worker 的 .md 处理器写入运行时缓存；失败无副作用
      fetch(path, { cache: 'default' }).catch(() => { warmed.delete(path); });
    } catch (e) {
      warmed.delete(path);
    }
  }

  function warmAdjacent(path) {
    if (!enabled()) return;
    const ft = window.MarkdownPreview.fileTree;
    if (!ft || typeof ft.getAdjacentFiles !== 'function') return;
    let adj;
    try { adj = ft.getAdjacentFiles(path || currentPath()); } catch (e) { return; }
    if (!adj) return;
    if (adj.prev && adj.prev.path) warm(adj.prev.path);
    if (adj.next && adj.next.path) warm(adj.next.path);
  }

  function scheduleIdle(path) {
    if (idleHandle != null) {
      try { cancelIdleCallback && cancelIdleCallback(idleHandle); } catch (e) { /* ignore */ }
      idleHandle = null;
    }
    const run = () => { idleHandle = null; warmAdjacent(path); };
    if (typeof requestIdleCallback === 'function') {
      idleHandle = requestIdleCallback(run, { timeout: 2000 });
    } else {
      idleHandle = setTimeout(run, 1200);
    }
  }

  // 文档渲染完成钩子（markdown.js 调用）
  function afterRender(path) {
    if (!enabled()) return;
    scheduleIdle(path);
  }

  // 悬停预取：文件树条目（[data-path]）与正文站内链接（a[href^="#/"]）
  function pathFromHref(href) {
    if (typeof href !== 'string' || !href.startsWith('#/')) return null;
    let p = href.slice(2);
    const i = p.indexOf('.md');
    if (i === -1) return null;
    p = p.slice(0, i + 3);
    try { p = decodeURIComponent(p); } catch (e) { /* keep */ }
    return p;
  }

  function init() {
    document.addEventListener('mouseover', (e) => {
      if (!enabled()) return;
      const t = e.target;
      if (!t || !t.closest) return;
      const el = t.closest('[data-path], a[href^="#/"]');
      if (!el) return;
      let p = el.getAttribute('data-path');
      if (!p) p = pathFromHref(el.getAttribute('href'));
      if (p) warm(p);
    }, { passive: true });
  }

  window.MarkdownPreview.prefetch = {
    warm,
    warmAdjacent,
    afterRender
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
