/**
 * contributors - 贡献者徽标
 *
 * 构建期 git-times 已扫提交历史（build-file-tree 采集 contributors 字段），
 * 文档头显示贡献者 GitHub 头像栈（github.com/<email>.png 会重定向到该
 * 邮箱关联账号的头像；无关联账号时回退为首字母圆章）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

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

  function onDocRendered(currentPath) {
    const container = window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent;
    if (!container) return;
    container.querySelectorAll('.contributors-bar').forEach(el => el.remove());
    if (!currentPath) return;
    const doc = findDoc(currentPath);
    const list = (doc && Array.isArray(doc.contributors)) ? doc.contributors : [];
    if (list.length === 0) return;

    const bar = document.createElement('div');
    bar.className = 'contributors-bar';
    // 隐私：产物不含邮箱（CWE-359），头像用首字母章 + 由名字派生的色相
    const hueFor = (name) => {
      let h = 0;
      for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) % 360;
      return h;
    };
    const chips = list.map((a, i) => {
      const title = `${a.name} · ${t('contributors.commits', '{n} 次提交').replace('{n}', a.count)}`;
      const hue = hueFor(a.name || '?');
      return `<span class="contributor-chip" title="${esc(title)}" data-order="${i}">
        <span class="contributor-fallback" style="background:hsl(${hue}, 62%, 52%)">${esc((a.name || '?')[0].toUpperCase())}</span>
      </span>`;
    }).join('');
    bar.innerHTML = `<span class="contributors-label">👥 ${esc(t('contributors.label', '贡献者'))}</span><span class="contributors-stack">${chips}</span>`;

    const anchor = container.querySelector('.reading-time');
    if (anchor) anchor.parentNode.insertBefore(bar, anchor);
    else container.insertBefore(bar, container.firstChild);
  }

  window.MarkdownPreview.contributors = { onDocRendered };
})();
