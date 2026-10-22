/**
 * section-collapse - 章节折叠
 *
 * 正文 H2 标题栏右侧出现折叠按钮，点击折叠/展开该章节（至下一个 H1/H2
 * 之前的全部内容），折叠状态按「文档路径 + 标题 id」记忆在 localStorage，
 * 重开文档自动恢复。设置面板「阅读 → 显示选项」提供总开关
 * （settings.sectionCollapse，默认开启；关闭时全部展开并移除按钮）。
 *
 * 设计：
 *   - 只处理 .markdown-body 的直接子级 H2（marked 输出中章节标题为顶层节点，
 *     避免把画廊 / 剧透块内部的标题误当章节边界）
 *   - 折叠实现为给章节内容加 .section-collapsed（display:none），不挪动 DOM，
 *     重渲染（markdown.js 每次整篇替换 innerHTML）后由 onDocRendered 重建
 *   - 与标题锚点按钮（仅 H1）、表格手柄、查找条互不冲突
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const STORE_KEY = 'md-preview-collapse';

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function enabled() {
    const settings = window.MarkdownPreview.settings;
    if (settings && settings.load) return settings.load().sectionCollapse !== false;
    return true;
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function writeStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { /* 隐私模式等场景跳过 */ }
  }

  function collapsedSet(docPath) {
    const all = readStore();
    return (all[docPath] || {});
  }

  function setCollapsed(docPath, headingId, collapsed) {
    const all = readStore();
    if (!all[docPath]) all[docPath] = {};
    if (collapsed) all[docPath][headingId] = 1;
    else delete all[docPath][headingId];
    writeStore(all);
  }

  function icon(name) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // 章节内容范围：H2 之后的兄弟节点，直到下一个顶层 H1/H2
  function sectionNodes(h2) {
    const nodes = [];
    let el = h2.nextElementSibling;
    while (el && !((el.tagName === 'H1' || el.tagName === 'H2') && el.parentElement === h2.parentElement)) {
      nodes.push(el);
      el = el.nextElementSibling;
    }
    return nodes;
  }

  function applyState(h2, collapsed) {
    h2.classList.toggle('section-collapsed-heading', collapsed);
    h2.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    const btn = h2.querySelector('.section-collapse-btn');
    if (btn) {
      btn.classList.toggle('is-collapsed', collapsed);
      btn.setAttribute('aria-label', collapsed ? t('collapse.expand', '展开本章') : t('collapse.collapse', '折叠本章'));
    }
    sectionNodes(h2).forEach(node => {
      // 篇尾导航（上一篇/下一篇）不属于章节内容
      if (node.classList.contains('doc-navigation')) return;
      node.classList.toggle('section-collapsed', collapsed);
    });
  }

  function clearAll() {
    document.querySelectorAll('.markdown-body .section-collapse-btn').forEach(b => b.remove());
    document.querySelectorAll('.markdown-body .section-collapsed').forEach(n => n.classList.remove('section-collapsed'));
    document.querySelectorAll('.markdown-body h2.section-collapsed-heading').forEach(h => {
      h.classList.remove('section-collapsed-heading');
      h.removeAttribute('aria-expanded');
    });
  }

  // markdown.js 渲染完成后调用
  function onDocRendered(currentPath) {
    clearAll();
    if (!enabled() || !currentPath) return;
    const container = window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent;
    if (!container) return;
    const store = collapsedSet(currentPath);
    const headings = container.querySelectorAll(':scope > h2');

    headings.forEach(h2 => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'section-collapse-btn';
      btn.innerHTML = icon('i-chevron-down');
      btn.setAttribute('aria-expanded', 'true');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const collapsed = !h2.classList.contains('section-collapsed-heading');
        applyState(h2, collapsed);
        setCollapsed(currentPath, h2.id || h2.textContent.trim(), collapsed);
      });
      h2.appendChild(btn);

      if (h2.id && store[h2.id]) applyState(h2, true);
    });
  }

  window.MarkdownPreview.sectionCollapse = { onDocRendered, clearAll, enabled };
})();
