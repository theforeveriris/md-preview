/**
 * tags - 标签系统
 *
 * 数据：构建脚本（build-file-tree.js / build-search-index.js）解析 frontmatter
 * `tags: [网络, OSPF]`（或逗号分隔）写入 file-tree.json / search-index.json；
 * 运行时 GitHub API 回退路径没有标签数据，标签面板自动隐藏。
 *
 * 能力：
 *   - 侧边栏顶栏「标签」选项卡（Files / Index / 标签）：全部标签按文档数排序，点击进入聚合页
 *   - 标签聚合页：#/tag/<name> 虚拟路由，合成 Markdown 走既有渲染管线
 *   - 搜索过滤：查询里写 `tag:xxx` 只搜带该标签的文档（可多 token 叠加）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  // i18n 文案统一走 i18n.js 的权威实现（MarkdownPreview.t，全站唯一，避免多处包装漂移）
  const t = window.MarkdownPreview.t;

  // HTML 转义统一走 md-render.js 的权威实现（全站唯一，避免多处副本漂移）
  // 惰性转发：解析期直接取全局依赖 index.html 加载顺序（曾按隐式契约）
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

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

    // 没有任何标签数据（未重跑构建 / 运行时回退）：整个面板不出现，同时隐藏顶栏「标签」选项卡
    if (!index || index.size === 0) {
      panel.hidden = true;
      panel.innerHTML = '';
      const tab = document.getElementById('modeTags');
      const divider = tab && tab.previousElementSibling;
      if (tab) tab.hidden = true;
      if (divider && divider.classList.contains('mode-divider')) divider.hidden = true;
      return;
    }
    // 有数据：确保选项卡可见（filetreeloaded 晚于首次 render 时恢复）
    const tab = document.getElementById('modeTags');
    const divider = tab && tab.previousElementSibling;
    if (tab) tab.hidden = false;
    if (divider && divider.classList.contains('mode-divider')) divider.hidden = false;

    const tags = [...index.entries()]
      .map(([name, docs]) => ({ name, count: docs.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    // 层级标签（KNOW-2）：任一标签含 `/` 时渲染树形面板；
    // 纯平铺标签维持原云图视图
    const hierarchical = tags.some(tag => tag.name.includes('/'));
    const body = hierarchical
      ? renderTagTree(tags)
      : `<div class="tag-cloud">
          ${tags.map(tag => `
            <button type="button" class="tag-chip" data-tag="${esc(tag.name)}" title="${esc(t('tags.openTag', '查看该标签下的文档'))}">
              ${esc(tag.name)}<span class="tag-chip-count">${tag.count}</span>
            </button>
          `).join('')}
        </div>`;

    // filetreeloaded 晚于首次渲染时当前可能处于 files/index 模式，
    // 面板仅在「标签」选项卡激活时显示（选项卡本身始终恢复可见）
    const state = window.MarkdownPreview.state;
    panel.hidden = !(state && state.currentMode === 'tags');
    panel.innerHTML = `
      <div class="tag-panel-header">
        <span class="tag-panel-title">${icon('i-tag', 13)}<span>${esc(t('tags.panelTitle', '标签'))}</span></span>
      </div>
      ${body}
    `;

    panel.querySelectorAll('[data-tag]').forEach(btn => {
      btn.addEventListener('click', () => openTagPage(btn.dataset.tag));
    });
  }

  // 层级标签树：`network/ospf` → network 下挂 ospf，计数为该前缀下全部文档
  function renderTagTree(tags) {
    const root = { children: new Map() };
    tags.forEach(tag => {
      const parts = tag.name.split('/');
      let node = root;
      parts.forEach((part, i) => {
        const name = parts.slice(0, i + 1).join('/');
        if (!node.children.has(part)) {
          node.children.set(part, { name, count: 0, children: new Map() });
        }
        node = node.children.get(part);
        node.count += tag.count;
      });
    });

    const lines = [];
    (function renderNode(node, depth) {
      node.children.forEach(child => {
        lines.push(`
          <button type="button" class="tag-tree-item" data-tag="${esc(child.name)}" style="padding-left:${8 + depth * 14}px" title="${esc(t('tags.openTag', '查看该标签下的文档'))}">
            <span class="tag-tree-branch">${depth > 0 ? '└' : ''}</span>
            <span class="tag-tree-name">${esc(child.name.split('/').pop())}</span>
            <span class="tag-chip-count">${child.count}</span>
          </button>`);
        renderNode(child, depth + 1);
      });
    })(root, 0);
    return `<div class="tag-tree">${lines.join('')}</div>`;
  }

  function icon(name, size) {
    return `<svg width="${size || 13}" height="${size || 13}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // ============== 标签聚合页（#/tag/<name>） ==============

  function openTagPage(name) {
    const index = buildIndex();
    // 层级标签：`tag/network` 聚合页包含 `tag/network/*` 全部子层级
    const prefix = name + '/';
    const docs = [];
    const seen = new Set();
    if (index) {
      index.forEach((list, tagName) => {
        if (tagName !== name && !tagName.startsWith(prefix)) return;
        list.forEach(doc => {
          if (seen.has(doc.path)) return;
          seen.add(doc.path);
          docs.push(doc);
        });
      });
    }
    docs.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
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
    // 层级标签前缀匹配：tag:network 命中 network 与 network/ospf
    // （要求层级分隔符，不会让 os 误命中 ospf）
    return wanted.every(w => lower.some(x => x === w || x.startsWith(w + '/')));
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
    docHasTags,
    getIndex: buildIndex // 标签云页（pages.js）使用
  };
})();
