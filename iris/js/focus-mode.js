/**
 * focus-mode - 专注模式（当前段落高亮，其余淡化）
 *
 * 开启后 body 挂 .focus-mode，滚动时把视口中线所在的正文直接子元素
 * 标记为 .focus-current，其余兄弟块淡化（样式见 enhancements.css）。
 * 长文阅读的护眼辅助，与章节折叠同属阅读辅助类功能。
 *
 * 开关入口：
 *   - 设置面板「阅读 → 显示选项」开关（settings.js，持久化 focusMode）
 *   - Ctrl/⌘+K 命令面板「专注模式」动作（palette.js）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  let enabled = false;
  let rafId = 0;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function body() {
    const dom = window.MarkdownPreview.dom;
    if (dom && dom.markdownContent) return dom.markdownContent.querySelector('.markdown-body') || dom.markdownContent;
    return document.getElementById('markdownContent');
  }

  // 视口中线（略偏上 1/3，符合阅读视线落点）落在哪个直接子块内
  function pickCurrent() {
    const root = body();
    if (!root || !enabled) return;
    const blocks = root.children;
    if (!blocks.length) return;
    const line = window.innerHeight / 3;
    let current = null;
    for (const block of blocks) {
      const rect = block.getBoundingClientRect();
      if (rect.top <= line && rect.bottom >= line) { current = block; break; }
      // 中线落在块间空隙时取上一个块
      if (rect.top > line) break;
      current = block;
    }
    for (const block of blocks) {
      block.classList.toggle('focus-current', block === current);
    }
  }

  function scheduleUpdate() {
    if (!enabled || rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      pickCurrent();
    });
  }

  function setEnabled(on) {
    enabled = !!on;
    document.body.classList.toggle('focus-mode', enabled);
    if (enabled) {
      document.addEventListener('scroll', scheduleUpdate, { passive: true });
      window.addEventListener('resize', scheduleUpdate);
      scheduleUpdate();
    } else {
      document.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      const root = body();
      if (root) root.querySelectorAll('.focus-current').forEach(el => el.classList.remove('focus-current'));
    }
  }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  // settings.js 初始化 / 远端同步时调用（不写设置，只应用）
  function applyPersisted(on) {
    setEnabled(on === true);
  }

  window.MarkdownPreview.focusMode = { setEnabled, toggle, isEnabled: () => enabled, applyPersisted };
})();
