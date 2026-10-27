/**
 * lang-links - 多语言文档关联（双语知识库互跳）
 *
 * frontmatter 写 `lang: zh` 声明本文语言，`en: path/to/en.md` 指向对应
 * 语言的译文（键为语言代码）；双方各自声明对方的路径即实现互跳。
 * 文档头渲染「查看英文版」等语言药丸条，点击直达译文。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;

  // 语言代码 → 原文名（药丸上展示的语言自称）
  const LANG_NAMES = {
    zh: '中文', 'zh-hans': '简体中文', 'zh-hant': '繁體中文', 'zh-tw': '繁體中文',
    en: 'English', ja: '日本語', ko: '한국어', fr: 'Français', de: 'Deutsch',
    es: 'Español', ru: 'Русский', pt: 'Português', it: 'Italiano'
  };

  function onDocRendered(currentPath, frontmatter) {
    const fm = frontmatter || window.MarkdownPreview.state?.currentFrontmatter || {};
    const links = [];
    Object.keys(fm).forEach(key => {
      const code = String(key).toLowerCase().trim();
      const value = fm[key];
      if (!LANG_NAMES[code] || !value || typeof value !== 'string') return;
      if (code === String(fm.lang || '').toLowerCase().trim()) return; // 本文语言不列
      if (!/\.md$/i.test(value.trim())) return;
      links.push({ code, name: LANG_NAMES[code], path: value.trim().replace(/^\/+/, '') });
    });
    if (links.length === 0) return;

    const container = window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent;
    if (!container) return;
    // 旧条清理（重渲染 / 虚拟文档切换）
    container.querySelectorAll('.lang-links-bar').forEach(el => el.remove());

    const bar = document.createElement('div');
    bar.className = 'lang-links-bar';
    bar.innerHTML = links.map(l => {
      const label = t('langLinks.view', '查看{lang}版').replace('{lang}', l.name);
      return `<a class="lang-link" href="#/${encodeURI(l.path)}" title="${label}">🌐 ${l.name}</a>`;
    }).join('');
    // 语言切换器位置：文档头阅读时长行旁（reading-time 之前；无则置于最前）
    const anchor = container.querySelector('.reading-time');
    if (anchor) anchor.parentNode.insertBefore(bar, anchor);
    else container.insertBefore(bar, container.firstChild);
  }

  window.MarkdownPreview.langLinks = { onDocRendered };
})();
