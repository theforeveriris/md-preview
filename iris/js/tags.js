/**
 * tags - 标签系统
 *
 * 数据：构建脚本（build-file-tree.js / build-search-index.js）解析 frontmatter
 * `tags: [网络, OSPF]`（或逗号分隔）写入 file-tree.json / search-index.json；
 * 运行时 GitHub API 回退路径没有标签数据，标签面板自动隐藏。
 *
 * 能力：
 *   - 侧边栏「标签」面板：全部标签按文档数排序，点击进入聚合页
 *   - 标签聚合页：#/tag/<name> 虚拟路由，合成 Markdown 走既有渲染管线
 *   - 搜索过滤：查询里写 `tag:xxx` 只搜带该标签的文档（可多 token 叠加）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============== 数据聚合 ==============

  let tagIndex = null; // Map<tagName, Array<{path, title}>>

  function traverse(items, acc) {
    for (const item of items) {
      if (item.type === 'folder' && item.children) {
        traverse(item.children, acc);
      } else if (item.type === 'file' && Array.isArray(item.tags) && item.tags.length) {
        item.tags.forEach(tag => {
          if (!acc.has(tag)) acc.set(tag, []);
          acc.get(tag).push({
            path: item.path,
            title: item.title || item.name.replace(/\.md$/i, '')
          });
        });
      }
    }
    return acc;
  }

  function buildIndex() {
    const state = window.MarkdownPreview.state;
    if (tagIndex) return tagIndex;
    if (!state || !Array.isArray(state.fileTreeData)) return null;
    tagIndex = traverse(state.fileTreeData, new Map());
    return tagIndex;
  }

  function invalidate() { tagIndex = null; }

  // ============== 侧边栏标签面板 ==============

  function renderPanel() {
    const panel = document.getElementById('tagPanel');
    if (!panel) return;
    const index = buildIndex();

    // 没有任何标签数据（未重跑构建 / 运行时回退）：整个面板不出现
    if (!index || index.size === 0) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }

    const tags = [...index.entries()]
      .map(([name, docs]) => ({ name, count: docs.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    panel.hidden = false;
    panel.innerHTML = `
      <div class="tag-panel-header">
        <span class="tag-panel-title">${icon('i-tag', 13)}<span>${esc(t('tags.panelTitle', '标签'))}</span></span>
      </div>
      <div class="tag-cloud">
        ${tags.map(tag => `
          <button type="button" class="tag-chip" data-tag="${esc(tag.name)}" title="${esc(t('tags.openTag', '查看该标签下的文档'))}">
            ${esc(tag.name)}<span class="tag-chip-count">${tag.count}</span>
          </button>
        `).join('')}
      </div>
    `;

    panel.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', () => openTagPage(btn.dataset.tag));
    });
  }

  function icon(name, size) {
    return `<svg width="${size || 13}" height="${size || 13}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // ============== 标签聚合页（#/tag/<name>） ==============

  function openTagPage(name) {
    const index = buildIndex();
    const docs = (index && index.get(name)) || [];
    const lines = [];
    lines.push(`# ${t('tags.pageTitle', '标签')}:${name}`);
    lines.push('');
    lines.push(`> ${t('tags.docCount', '共 {n} 篇文档').replace('{n}', docs.length)}`);
    lines.push('');
    docs.forEach(doc => {
      lines.push(`- [${doc.title}](#/${encodeURI(doc.path)})`);
      lines.push(`  \`${doc.path}\``);
    });
    if (docs.length === 0) {
      lines.push(`*${t('tags.empty', '该标签下暂无文档')}*`);
    }

    const { markdown } = window.MarkdownPreview;
    if (markdown && markdown.renderVirtualDoc) {
      markdown.renderVirtualDoc(lines.join('\n'), `${t('tags.pageTitle', '标签')}:${name}`);
    }
  }

  // ============== 搜索 tag: 过滤（search.js 调用） ==============

  // 拆出查询里的 tag:xxx token，返回 { text, tags }
  function extractTagFilters(query) {
    const tags = [];
    const text = String(query || '').replace(/tag:(\S+)/gi, (_, tag) => {
      tags.push(tag.toLowerCase());
      return ' ';
    });
    return { text: text.replace(/\s+/g, ' ').trim(), tags };
  }

  function docHasTags(doc, wanted) {
    if (!wanted.length) return true;
    if (!doc || !Array.isArray(doc.tags)) return false;
    const lower = doc.tags.map(x => String(x).toLowerCase());
    return wanted.every(w => lower.includes(w));
  }

  function init() {
    invalidate();
    renderPanel();
    // 文件树加载完成（含运行时回退）后重建面板
    window.addEventListener('filetreeloaded', () => {
      invalidate();
      renderPanel();
    });
    window.addEventListener('langchange', () => renderPanel());
  }

  window.MarkdownPreview.tags = {
    init,
    renderPanel,
    openTagPage,
    extractTagFilters,
    docHasTags
  };
})();
