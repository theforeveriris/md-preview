/**
 * widget-chrome - 组件统一控件层（筛选面板 + 悬停浮窗）
 *
 * 约定（各渲染器自行拼 HTML，本模块只负责交互）：
 *   .w-float             组件右上角的悬停浮窗（无头部组件用这一套）
 *   .w-chrome            单行头部（尚未迁移的组件保留）
 *     .w-info            左：.w-title + .w-chips（.w-chip）
 *     .w-inline          （可选）常显主操控，自动靠右
 *     .w-filter-btn      筛选图标按钮；可带 .w-badge 显示生效筛选数
 *     .w-pop             筛选面板（内放输入框/下拉）
 *     .w-actions         悬停胶囊（复制/导出等次级操作）
 *
 * 交互：点筛选按钮打开 .w-pop（点外部 / Esc 关闭）；
 *       浮窗由 CSS 在组件悬停或 focus-within 时显示，触屏常显；
 *       面板打开期间浮窗保持可见（.open）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  let bound = false;

  function closeAll(except) {
    document.querySelectorAll('.w-chrome.open, .w-float.open').forEach((el) => {
      if (el !== except) el.classList.remove('open');
    });
  }

  function init(root) {
    const scope = root || document;
    // root 本身是控件层时（各渲染器常直接传头部元素），querySelectorAll 找不到自己
    const list = Array.from(scope.querySelectorAll('.w-chrome, .w-float'));
    ['.w-chrome', '.w-float'].forEach((sel) => {
      if (scope.matches && scope.matches(sel) && !list.includes(scope)) list.unshift(scope);
    });
    list.forEach((el) => {
      if (el.dataset.wReady) return;
      el.dataset.wReady = '1';

      const btn = el.querySelector('.w-filter-btn');
      const pop = el.querySelector('.w-pop');
      if (!btn || !pop) return;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = el.classList.toggle('open');
        if (!open) return;
        closeAll(el);
        const focusable = pop.querySelector('input, select, button');
        if (focusable) setTimeout(() => { try { focusable.focus(); } catch (err) { /* ignore */ } }, 0);
      });
    });

    if (bound) return;
    bound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.w-chrome, .w-float')) closeAll(null);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAll(null);
    });
  }

  window.MarkdownPreview.widgetChrome = { init };
})();
