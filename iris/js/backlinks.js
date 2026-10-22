/**
 * 反向链接与相关文档（LINK-1）
 *
 * 在正文末尾追加两块信息（均为「读到结尾才需要」的内容，不干扰正文阅读）：
 *   1. 被 N 篇引用：由 iris/data/links.json 反演得到「谁链接到本文」，点击直达；
 *      没有引用时显示空态提示（与图谱里灰显的孤立文档互相印证）。
 *   2. 相关文档：按「共享标签 × 互链」加权排序（相似度留待二期），
 *      默认 5 条，可展开全部（上限 20 条）；已在「被引用」中出现的文档不重复列出。
 *
 * 数据来源与 #/graph 图谱同一份 links.json（构建期由 build-links.js 产出）。
 * 虚拟文档（标签聚合页 / 目录聚合页）与本地文件（无仓库路径）不显示本区块。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  const LINKS_URL = 'iris/data/links.json';
  const TOP_N = 5;
  const MAX_RELATED = 20;

  let linksCache = null;
  let linksPromise = null;
  let lastPath = '';
  let expanded = false;

  function loadLinks() {
    if (linksCache) return Promise.resolve(linksCache);
    if (!linksPromise) {
      linksPromise = fetch(LINKS_URL, { cache: 'no-cache' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { linksCache = d; return d; })
        .catch(() => null);
    }
    return linksPromise;
  }

  // state.fileTreeData（嵌套）→ Map<path, { title, tags }>
  function docIndex() {
    const map = new Map();
    (function walk(items) {
      (items || []).forEach(item => {
        if (!item) return;
        if (item.type === 'folder') walk(item.children);
        else if (item.type === 'file' && item.path) {
          map.set(item.path, {
            title: item.title || item.name || item.path,
            tags: Array.isArray(item.tags) ? item.tags : [],
          });
        }
      });
    })(window.MarkdownPreview.state.fileTreeData);
    return map;
  }

  function sameDir(a, b) {
    const da = a.slice(0, a.lastIndexOf('/'));
    const db = b.slice(0, b.lastIndexOf('/'));
    return da === db;
  }

  function buildModel(path, links, index) {
    const linkMap = (links && links.links) || {};
    const outgoing = linkMap[path] || {};

    const incoming = Object.keys(linkMap)
      .filter(from => from !== path && (linkMap[from] || {})[path])
      .filter(from => index.has(from))
      .sort((a, b) => index.get(a).title.localeCompare(index.get(b).title, 'zh'));

    const incomingSet = new Set(incoming);
    const selfTags = new Set((index.get(path) || {}).tags || []);
    const related = [];

    index.forEach((meta, other) => {
      if (other === path || incomingSet.has(other)) return;
      let shared = 0;
      (meta.tags || []).forEach(tag => { if (selfTags.has(tag)) shared++; });
      const mutual = (outgoing[other] ? 1 : 0) + (incomingSet.has(other) ? 1 : 0);
      if (shared === 0 && mutual === 0) return;
      let score = shared * 2 + mutual * 3;
      if (sameDir(path, other)) score += 1;   // 同目录作为最后一级权重
      related.push({ path: other, title: meta.title, shared, score });
    });

    related.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh'));
    return { incoming, related: related.slice(0, MAX_RELATED) };
  }

  function linkItem(path, title) {
    return `<li><a href="#/${encodeURI(path)}" data-path="${esc(path)}">${esc(title)}</a></li>`;
  }

  function blockHtml(model, index) {
    const count = model.incoming.length;
    const backlinks = count
      ? `<ul class="doc-backlinks-list">${model.incoming.map(p => linkItem(p, index.get(p).title)).join('')}</ul>`
      : `<div class="doc-backlinks-empty">${esc(t('backlinks.empty', '暂无其他文档引用本文'))}</div>`;

    let related = '';
    if (model.related.length) {
      const shown = expanded ? model.related : model.related.slice(0, TOP_N);
      const more = model.related.length > TOP_N
        ? `<button type="button" class="doc-related-more">${esc(
            expanded
              ? t('backlinks.collapse', '收起')
              : t('backlinks.expand', '显示全部（{n}）').replace('{n}', model.related.length))}</button>`
        : '';
      related = `
        <div class="doc-backlinks-block">
          <h2 class="doc-backlinks-title">${esc(t('backlinks.related', '相关文档'))}</h2>
          <ul class="doc-backlinks-list doc-related-list">
            ${shown.map(item => `<li><a href="#/${encodeURI(item.path)}">${esc(item.title)}</a>${
              item.shared > 0
                ? `<span class="doc-related-why">${esc(t('backlinks.sharedTags', '共同标签 {n}').replace('{n}', item.shared))}</span>`
                : ''}</li>`).join('')}
          </ul>
          ${more}
        </div>`;
    }

    return `
      <section class="doc-backlinks" aria-label="${esc(t('backlinks.title', '反向链接'))}">
        <div class="doc-backlinks-block">
          <h2 class="doc-backlinks-title">${esc(
            count
              ? t('backlinks.count', '被 {n} 篇引用').replace('{n}', count)
              : t('backlinks.title', '反向链接'))}</h2>
          ${backlinks}
        </div>
        ${related}
      </section>
    `;
  }

  function removeBlock() {
    const existing = document.querySelector('#markdownContent > .doc-backlinks');
    if (existing) existing.remove();
  }

  function render(path, links) {
    const host = document.getElementById('markdownContent');
    if (!host) return;
    if (!path) { removeBlock(); return; }

    const index = docIndex();
    if (!index.has(path)) { removeBlock(); return; }

    const model = buildModel(path, links, index);
    removeBlock();

    const template = document.createElement('div');
    template.innerHTML = blockHtml(model, index).trim();
    const wrapper = template.firstElementChild;
    if (!wrapper) return;

    // 插入到「上一篇 / 下一篇」之前，保持结尾导航仍在最末
    const nav = host.querySelector('.doc-navigation');
    if (nav) host.insertBefore(wrapper, nav);
    else host.appendChild(wrapper);

    const more = wrapper.querySelector('.doc-related-more');
    if (more) {
      more.addEventListener('click', () => {
        expanded = !expanded;
        render(path, links);
      });
    }
  }

  function afterRender(path) {
    expanded = false;
    lastPath = path || '';
    if (!lastPath) { removeBlock(); return; }
    loadLinks().then(links => {
      // 异步返回时文档可能已切换
      if (lastPath !== path || window.MarkdownPreview.state.currentFilePath !== path) return;
      render(path, links);
    });
  }

  function init() {
    window.addEventListener('langchange', () => {
      if (!lastPath) return;
      loadLinks().then(links => {
        if (window.MarkdownPreview.state.currentFilePath !== lastPath) return;
        render(lastPath, links);
      });
    });
  }

  window.MarkdownPreview.backlinks = { init: init, afterRender: afterRender };
})();
