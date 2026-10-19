/**
 * 文档图谱渲染器（GRAPH-1）
 *
 * Markdown 语法（```graph 代码块）：
 *   ```graph
 *   ```
 *
 * 代码块内容被忽略，仅作为**挂载点**：#/graph 虚拟文档（见 iris/js/graph 的 openPage）
 * 用它把图谱挂进标准渲染管线 —— 面包屑、侧边栏、hash 分享、导出等能力全部沿用。
 * 在编辑器 cell 里写 ```graph 同样可以就地预览图谱。
 *
 * 数据来源：
 *   - 节点：state.fileTreeData（与侧边栏文件树同源，含标题与标签）
 *   - 边：iris/data/links.json（构建期由 build-links.js 产出，与文末反向链接共用）
 *
 * 交互：拖拽平移 / 滚轮缩放 / 点击节点跳转文档 / 悬停信息浮层 /
 *       搜索框定位高亮 / 标签图例筛选子图 / 重置视图。孤立文档（无链接）灰显保留。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  const CYTOSCAPE_URL = 'iris/vendor/cytoscape/cytoscape.min.js';
  const LINKS_URL = 'iris/data/links.json';

  // 标签配色（深浅主题下均可辨；按标签出现顺序稳定分配）
  const TAG_COLORS = [
    '#8B5CF6', '#EC4899', '#0EA5E9', '#10B981', '#F59E0B',
    '#EF4444', '#14B8A6', '#6366F1', '#A855F7', '#84CC16',
  ];

  let activeCy = null;
  let activeTip = null;
  let linksCache = null;
  let linksPromise = null;

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

  // state.fileTreeData（嵌套）→ 扁平文档列表 [{ path, title, tags }]
  function flattenDocs(items, out) {
    (items || []).forEach(item => {
      if (!item) return;
      if (item.type === 'folder') flattenDocs(item.children, out);
      else if (item.type === 'file' && item.path) {
        out.push({
          path: item.path,
          title: item.title || item.name || item.path,
          tags: Array.isArray(item.tags) ? item.tags : [],
        });
      }
    });
    return out;
  }

  // 上一个实例已脱离 DOM 时销毁（跨文档切换避免 canvas / 动画帧泄漏，同 pkt 的做法）
  function cleanupIfDetached() {
    if (activeCy && (!activeCy.container() || !document.body.contains(activeCy.container()))) {
      try { activeCy.destroy(); } catch (e) { /* ignore */ }
      activeCy = null;
    }
    if (activeTip && !document.body.contains(activeTip)) {
      activeTip = null;
    }
  }

  function buildElements(docs, links) {
    const tagOrder = [];
    const tagCount = new Map();
    const indeg = new Map();
    docs.forEach(d => {
      (d.tags || []).forEach(tag => {
        if (!tagCount.has(tag)) { tagCount.set(tag, 0); tagOrder.push(tag); }
        tagCount.set(tag, tagCount.get(tag) + 1);
      });
    });

    const linkMap = (links && links.links) || {};
    const edges = [];
    const outdeg = new Set();
    Object.keys(linkMap).forEach(from => {
      const targets = linkMap[from] || {};
      const keys = Object.keys(targets);
      if (keys.length) outdeg.add(from);
      keys.forEach(to => {
        indeg.set(to, (indeg.get(to) || 0) + 1);
        edges.push({ from, to, weight: targets[to] });
      });
    });

    const known = new Set(docs.map(d => d.path));
    const nodes = docs.map(d => {
      const degree = indeg.get(d.path) || 0;
      // 孤立 = 既没有入链也没有出链（只有出链的文档仍与图有连接，不算孤立）
      const isolated = degree === 0 && !outdeg.has(d.path);
      return {
        data: {
          id: d.path,
          label: d.title,
          path: d.path,
          tags: d.tags,
          mainTag: d.tags[0] || '',
          degree: degree,
          isolated: isolated,
          size: 20 + Math.min(38, degree * 4),
        },
      };
    });

    const elements = [];
    nodes.forEach(n => elements.push(n));
    edges
      .filter(e => known.has(e.from) && known.has(e.to))
      .forEach(e => elements.push({
        data: { id: `${e.from}→${e.to}`, source: e.from, target: e.to, weight: e.weight || 1 },
      }));

    const tags = tagOrder.map((name, i) => ({
      name,
      count: tagCount.get(name),
      color: TAG_COLORS[i % TAG_COLORS.length],
    }));

    return { elements, tags, isolatedCount: nodes.filter(n => n.data.isolated).length };
  }

  // cytoscape 不解析 CSS var()，样式里要给出实际颜色 / 字体
  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function graphStyle(tags) {
    const textColor = cssVar('--color-text', '#2d2d2d');
    const fontFamily = cssVar('--font-body', 'sans-serif');
    const base = [
      {
        selector: 'node',
        style: {
          'background-color': '#94A3B8',
          'background-opacity': 0.85,
          'border-width': 1,
          'border-color': '#ffffff',
          label: 'data(label)',
          color: textColor,
          'font-size': 9,
          'font-family': fontFamily,
          'text-valign': 'bottom',
          'text-margin-y': 3,
          'text-wrap': 'ellipsis',
          'text-max-width': '120px',
          width: 'data(size)',
          height: 'data(size)',
          'text-opacity': 0.85,
          'transition-property': 'opacity, border-width',
          'transition-duration': '0.15s',
        },
      },
      {
        selector: 'node[isolated]',
        style: {
          'background-color': '#CBD5E1',
          'background-opacity': 0.55,
          'border-style': 'dashed',
          'border-color': '#94A3B8',
          'text-opacity': 0.5,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.1,
          'line-color': '#CBD5E1',
          'target-arrow-color': '#CBD5E1',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.8,
          'curve-style': 'bezier',
          opacity: 0.7,
        },
      },
      {
        selector: '.dimmed',
        style: { opacity: 0.12, 'text-opacity': 0.08 },
      },
      {
        selector: 'node.matched',
        style: { 'border-width': 3, 'border-color': '#EC4899', 'text-opacity': 1 },
      },
    ];
    tags.forEach(tag => {
      base.push({
        selector: `node[mainTag="${tag.name}"]`,
        style: { 'background-color': tag.color },
      });
    });
    return base;
  }

  function renderToolbar(docEl, tags, isolatedCount, onSearch, onResetTag) {
    const bar = document.createElement('div');
    bar.className = 'doc-graph-bar';
    bar.innerHTML = `
      <input type="search" class="doc-graph-search" placeholder="${esc(t('graph.search.placeholder', '搜索文档…'))}"
             aria-label="${esc(t('graph.search.placeholder', '搜索文档…'))}">
      <div class="doc-graph-legend" role="group" aria-label="${esc(t('graph.legend', '标签'))}"></div>
      <span class="doc-graph-hint">${esc(t('graph.hint', '拖拽平移 · 滚轮缩放 · 点击节点跳转'))}</span>
    `;
    const legend = bar.querySelector('.doc-graph-legend');
    tags.forEach(tag => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'doc-graph-chip';
      chip.dataset.tag = tag.name;
      chip.innerHTML = `<span class="doc-graph-chip-dot" style="background:${esc(tag.color)}"></span>${esc(tag.name)}`;
      chip.addEventListener('click', () => onResetTag(tag.name, chip));
      legend.appendChild(chip);
    });
    if (isolatedCount > 0) {
      const note = document.createElement('span');
      note.className = 'doc-graph-note';
      note.textContent = t('graph.isolated', '{n} 篇无链接文档已灰显').replace('{n}', isolatedCount);
      bar.appendChild(note);
    }
    const search = bar.querySelector('.doc-graph-search');
    search.addEventListener('input', () => onSearch(search.value));
    docEl.appendChild(bar);
    return bar;
  }

  function ensureTip() {
    if (activeTip && document.body.contains(activeTip)) return activeTip;
    activeTip = document.createElement('div');
    activeTip.className = 'doc-graph-tip';
    activeTip.setAttribute('role', 'tooltip');
    document.body.appendChild(activeTip);
    return activeTip;
  }

  function showTip(node, container) {
    const tip = ensureTip();
    const d = node.data();
    const tags = (d.tags || []).map(tag => `<span class="doc-graph-tip-tag">${esc(tag)}</span>`).join('');
    tip.innerHTML = `
      <div class="doc-graph-tip-title">${esc(d.label)}</div>
      <div class="doc-graph-tip-path">${esc(d.path)}</div>
      ${tags ? `<div class="doc-graph-tip-tags">${tags}</div>` : ''}
      <div class="doc-graph-tip-meta">${esc(
        t('graph.degree', '被引用 {n} 篇').replace('{n}', d.degree))}</div>
    `;
    tip.classList.add('open');
    const rect = container.getBoundingClientRect();
    const pos = node.renderedPosition();
    tip.style.left = Math.max(8, Math.min(window.innerWidth - tip.offsetWidth - 8, rect.left + pos.x + 12)) + 'px';
    tip.style.top = Math.max(8, rect.top + pos.y + 12) + 'px';
  }

  function hideTip() {
    if (activeTip) activeTip.classList.remove('open');
  }

  function mount(pre) {
    if (!pre.parentNode) return Promise.resolve();
    const doc = pre.ownerDocument;
    const host = doc.createElement('div');
    host.className = 'doc-graph';
    const canvas = doc.createElement('div');
    canvas.className = 'doc-graph-canvas';
    host.appendChild(canvas);

    // 先把挂载点放进文档：cytoscape 初始化时要用容器尺寸做布局，
    // 元素还游离在文档外时会量到 0×0 视口并抛错（Cannot read properties of undefined）
    pre.parentNode.replaceChild(host, pre);

    const docs = flattenDocs(window.MarkdownPreview.state.fileTreeData, []);
    if (!docs.length) {
      host.innerHTML = `<div class="doc-graph-empty">${esc(t('graph.empty', '没有可绘制的文档'))}</div>`;
      return Promise.resolve();
    }

    return Promise.all([loadLinks(), window.MarkdownPreview.loadScript(CYTOSCAPE_URL)])
      .then(([links]) => {
        if (typeof window.cytoscape !== 'function') {
          console.error('[Graph] cytoscape 未就绪:', typeof window.cytoscape);
          host.innerHTML = `<div class="doc-graph-empty">${esc(t('graph.loadFail', '图谱组件加载失败'))}</div>`;
          return;
        }

        const { elements, tags, isolatedCount } = buildElements(docs, links);
        let activeTag = '';

        const cy = window.cytoscape({
          container: canvas,
          elements,
          style: graphStyle(tags),
          minZoom: 0.15,
          maxZoom: 3,
          layout: {
            name: 'cose',
            animate: false,
            padding: 28,
            nodeRepulsion: 9000,
            idealEdgeLength: 90,
            nodeOverlap: 8,
          },
        });
        activeCy = cy;

        const clearHighlight = () => {
          cy.elements().removeClass('dimmed matched');
        };
        const applyTag = (tag) => {
          activeTag = tag;
          cy.elements().removeClass('dimmed matched');
          if (!tag) return;
          cy.nodes().forEach(n => {
            const hit = (n.data('tags') || []).indexOf(tag) !== -1;
            n.toggleClass('matched', hit);
          });
          cy.edges().forEach(e => {
            const hit = e.source().hasClass('matched') && e.target().hasClass('matched');
            e.toggleClass('dimmed', !hit);
          });
          cy.nodes().forEach(n => n.toggleClass('dimmed', !n.hasClass('matched')));
        };

        renderToolbar(host, tags, isolatedCount, (query) => {
          const q = String(query || '').trim().toLowerCase();
          clearHighlight();
          if (!q) return;
          const hits = [];
          cy.nodes().forEach(n => {
            const d = n.data();
            if (String(d.label).toLowerCase().indexOf(q) !== -1 ||
                String(d.path).toLowerCase().indexOf(q) !== -1) {
              n.addClass('matched');
              hits.push(n);
            } else {
              n.addClass('dimmed');
            }
          });
          if (hits.length === 1) {
            cy.animate({ center: { eles: hits[0] }, zoom: 1.3, duration: 280 });
          } else if (hits.length > 1) {
            cy.animate({ fit: { eles: cy.collection(hits), padding: 60 }, duration: 280 });
          }
        }, (tag, chip) => {
          const next = activeTag === tag ? '' : tag;
          host.querySelectorAll('.doc-graph-chip').forEach(c => c.classList.toggle('active', c === chip && !!next));
          applyTag(next);
        });

        cy.on('tap', 'node', (evt) => {
          const path = evt.target.data('path');
          if (!path) return;
          if (window.MarkdownPreview.fileTree && window.MarkdownPreview.fileTree.highlightFileInSidebar) {
            window.MarkdownPreview.fileTree.highlightFileInSidebar(path);
          }
          if (window.MarkdownPreview.router) window.MarkdownPreview.router.updateHash(path);
          else window.location.hash = '#/' + path;
        });
        cy.on('mouseover', 'node', (evt) => showTip(evt.target, canvas));
        cy.on('mouseout', 'node', hideTip);
        cy.on('dragpan zoom', hideTip);
      })
      .catch((err) => {
        console.error('[Graph] 渲染失败:', err);
        host.innerHTML = `<div class="doc-graph-empty">${esc(t('graph.loadFail', '图谱组件加载失败'))}</div>`;
      });
  }

  function render(root) {
    cleanupIfDetached();
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang="graph"]');
    if (!blocks.length) return;
    return Promise.all(Array.from(blocks).map(mount));
  }

  // 供虚拟路由 #/graph 调用：走标准虚拟文档管线（面包屑 / 侧边栏 / hash 分享都在）
  function openPage() {
    const md = window.MarkdownPreview.markdown;
    if (!md || !md.renderVirtualDoc) return;
    const title = t('graph.pageTitle', '文档图谱');
    const hint = t('graph.pageDesc', '节点为文档、连线为站内链接，节点越大被引用越多。');
    md.renderVirtualDoc(`# ${title}\n\n${hint}\n\n\`\`\`graph\n\n\`\`\`\n`, title);
  }

  // 悬浮球菜单入口已移除：图谱只保留命令面板（Ctrl+K）里的「文档图谱」。
  // #/graph 路由与 ```graph 代码块走 renderer，不依赖这里的初始化。

  window.MarkdownPreview.renderers.graph = { render };
  window.MarkdownPreview.graph = { openPage: openPage };
})();
