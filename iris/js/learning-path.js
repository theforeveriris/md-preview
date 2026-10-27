/**
 * learning-path - 学习路径（prerequisites 前置阅读链）
 *
 * frontmatter 写 `prerequisites: [docs/a.md, docs/b.md]`，文档头渲染
 * 「前置阅读」卡片链（标题取自文件树，缺失路径灰显提示）；图谱上由
 * build-file-tree.js 采集的字段画出有向学习路径边（graph.js）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function parseList(raw) {
    if (!raw) return [];
    let s = String(raw).trim();
    if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
    return s.split(/[,，]/).map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }

  function findDoc(path) {
    let found = null;
    (function walk(items) {
      (items || []).forEach(item => {
        if (found) return;
        if (item.type === 'folder') walk(item.children);
        else if (item.path === path) found = item;
      });
    })(window.MarkdownPreview.state?.fileTreeData);
    return found;
  }

  function onDocRendered(currentPath, frontmatter) {
    const fm = frontmatter || window.MarkdownPreview.state?.currentFrontmatter || {};
    const prereqs = parseList(fm.prerequisites);
    if (prereqs.length === 0) return;

    const container = window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent;
    if (!container) return;
    container.querySelectorAll('.learning-path-bar').forEach(el => el.remove());

    const cards = prereqs.map(p => {
      const doc = findDoc(p);
      if (doc) {
        const title = doc.title || String(doc.name || '').replace(/\.md$/i, '');
        return `<a class="lp-card" href="#/${encodeURI(doc.path)}" title="${esc(p)}">
          <span class="lp-card-title">${esc(title)}</span>
          <span class="lp-card-path">${esc(p)}</span>
        </a>`;
      }
      return `<span class="lp-card lp-card-missing" title="${esc(t('lp.missing', '文件树中未找到该文档'))}">
        <span class="lp-card-title">${esc(p.split('/').pop())}</span>
        <span class="lp-card-path">${esc(p)}</span>
      </span>`;
    }).join('<span class="lp-arrow">→</span>');

    const bar = document.createElement('div');
    bar.className = 'learning-path-bar';
    bar.innerHTML = `<span class="lp-label">📚 ${esc(t('lp.prerequisites', '前置阅读'))}</span><div class="lp-cards">${cards}</div>`;
    const anchor = container.querySelector('.reading-time');
    if (anchor) anchor.parentNode.insertBefore(bar, anchor);
    else container.insertBefore(bar, container.firstChild);
  }

  window.MarkdownPreview.learningPath = { onDocRendered };
})();
