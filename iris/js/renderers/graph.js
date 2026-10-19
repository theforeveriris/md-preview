/**
 * 文档图谱渲染器（GRAPH-1）
 *
 * Markdown 语法（```graph 代码块）：
 *   ```graph
 *   ```
 *
 * 代码块内容被忽略，仅作为**挂载点**：#/graph 虚拟文档（见 openPage）
 * 用它把图谱挂进标准渲染管线 —— 面包屑、侧边栏、hash 分享、导出等能力全部沿用。
 * 在编辑器 cell 里写 ```graph 同样可以就地预览图谱。
 *
 * 数据来源：
 *   - 节点：state.fileTreeData（与侧边栏文件树同源，含标题与标签）
 *   - 边：iris/data/links.json（构建期由 build-links.js 产出，与文末反向链接共用）
 *
 * 形态：#/graph 是沉浸式页面（body.graph-page）—— 画布撑满可用视口，
 *       搜索 / 图例 / 控件 / 提示都是画布上的浮层，正文不再输出 H1 与描述。
 *
 * 交互：
 *   - 拖拽平移 / 滚轮缩放 / 点击节点直接跳转文档
 *   - 节点默认不显示文字；悬停显示该节点与其一跳邻居的名字
 *   - 搜索：命中节点高亮 + 显示名字 + 自动居中
 *   - 图例 chip：高亮该标签子图（不额外加文字）
 *   - 右下角控件：缩放 ± / 适配画布 / 重置视图 / 全屏（Fullscreen API）
 *   - 配色：主题强调色的明度阶梯（浅色主题往暗处混、深色主题往亮处混）
 *   - 孤立文档（无入链也无出链）灰显保留，数量提示在左下角
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  const CYTOSCAPE_URL = 'iris/vendor/cytoscape/cytoscape.min.js';
  const LINKS_URL = 'iris/data/links.json';

  // 标签超过这个数量就把图例收进一个折叠按钮（沉浸式画布上浮层不宜铺太大）
  const LEGEND_COLLAPSE_AT = 8;
  const ZOOM_STEP = 1.35;
  const ZOOM_MIN = 0.15;
  const ZOOM_MAX = 3;
  const MIN_HEIGHT = 320;

  // 画布控件图标（自包含，不依赖 index.html 的 symbol 精灵）
  const ICONS = {
    zoomIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M11 8.5v5M8.5 11h5M20.5 20.5 16.5 16.5"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8.5 11h5M20.5 20.5 16.5 16.5"/></svg>',
    fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="3"/><path d="M8.5 7H7v1.5M15.5 7H17v1.5M8.5 17H7v-1.5M15.5 17H17v-1.5"/></svg>',
    exitFullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="3"/><path d="M7 8.5h2.5V6M17 8.5h-2.5V6M7 15.5h2.5V18M17 15.5h-2.5V18"/></svg>',
  };

  let activeCy = null;
  let activeTip = null;
  let activeTeardown = null;
  let linksCache = null;
  let linksPromise = null;

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
    } catch (e) {
      return false;
    }
  }

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

  // 上一个实例已脱离 DOM 时销毁（跨文档切换避免 canvas / 动画帧 / window 监听泄漏，
  // 同 pkt 的做法）
  function cleanupIfDetached() {
    const container = activeCy ? activeCy.container() : null;
    if (container && document.body.contains(container)) return;
    if (activeCy) {
      try { activeCy.destroy(); } catch (e) { /* ignore */ }
      activeCy = null;
    }
    if (activeTeardown) {
      try { activeTeardown(); } catch (e) { /* ignore */ }
      activeTeardown = null;
    }
    if (activeTip && !document.body.contains(activeTip)) activeTip = null;
  }

  function buildElements(docs, links) {
    const tagCount = new Map();
    docs.forEach(d => {
      (d.tags || []).forEach(tag => {
        if (!tagCount.has(tag)) tagCount.set(tag, 0);
        tagCount.set(tag, tagCount.get(tag) + 1);
      });
    });

    const linkMap = (links && links.links) || {};
    const edges = [];
    const outdeg = new Set();
    const indeg = new Map();
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

    // 出现次数多的标签排在前面，拿到阶梯里对比度最强的一档
    const tags = Array.from(tagCount.entries())
      .map(([name, count], order) => ({ name, count, order }))
      .sort((a, b) => (b.count - a.count) || (a.order - b.order))
      .map(({ name, count }) => ({ name, count }));

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

  // ---- 配色：主题强调色的明度阶梯 ----
  // 不用 CSS color-mix：浏览器会把它的计算值序列化成 color(srgb …) / oklab()，
  // cytoscape 的解析器只认 rgb()/#hex，解析不了就会退回黑色。这里自己算 RGB。

  // hex / rgb() / rgba() / color(srgb …) → [r, g, b]（0-255）
  function parseColor(str) {
    const s = String(str || '').trim();
    let m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(n => Number.isFinite(n))) {
        return parts.slice(0, 3);
      }
      return null;
    }
    m = s.match(/^color\(srgb\s+([^)]+)\)$/i);
    if (m) {
      const parts = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(n => Number.isFinite(n))) {
        return parts.slice(0, 3).map(v => Math.round(v * 255));
      }
      return null;
    }
    m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
    return null;
  }

  // 交给浏览器解析成计算值（能吃 var() / 任意主题自定义格式），再转成 RGB
  function resolveColor(cssValue, fallback) {
    if (!cssValue) return parseColor(fallback) || [148, 163, 184];
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    probe.style.color = cssValue;
    document.body.appendChild(probe);
    let out = '';
    try { out = getComputedStyle(probe).color || ''; } catch (e) { out = ''; }
    probe.remove();
    return parseColor(out) || parseColor(cssValue) || parseColor(fallback) || [148, 163, 184];
  }

  function luminanceOf(rgb) {
    const f = c => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }

  function rgbToCss(rgb) {
    return 'rgb(' + rgb.map(c => Math.max(0, Math.min(255, Math.round(c)))).join(', ') + ')';
  }

  function mixToward(rgb, target, amount) {
    return rgb.map((c, i) => c + (target[i] - c) * amount);
  }

  // 单一强调色的明度阶梯：档位越靠前对比度越强（出现最多的标签最显眼）
  function buildColorLadder(n) {
    const accent = resolveColor(cssVar('--color-accent-purple', '#d4a5c9'), '#d4a5c9');
    if (n <= 1) return [rgbToCss(accent)];
    // 浅色主题往黑混、深色主题往白混，保证节点在画布底色上始终有对比
    const bg = resolveColor(cssVar('--color-bg', '#ffffff'), '#ffffff');
    const target = luminanceOf(bg) < 0.4 ? [255, 255, 255] : [0, 0, 0];
    const out = [];
    for (let i = 0; i < n; i++) {
      const amount = 0.42 * (1 - i / (n - 1));
      out.push(rgbToCss(mixToward(accent, target, amount)));
    }
    return out;
  }

  // cytoscape 属性选择器里的值需要转义，否则标签名里的引号会破坏选择器
  function selEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function graphStyle(tags, colors) {
    const textColor = cssVar('--color-text', '#2d2d2d');
    // cytoscape 会校验 font-family：带引号 / 逗号的多字体栈会被判为非法值并回退，
    // 这里只取第一个字体族
    const fontFamily = String(cssVar('--font-body', 'sans-serif'))
      .split(',')[0].replace(/['"]/g, '').trim() || 'sans-serif';
    const borderColor = cssVar('--color-border', '#e5e5e5');
    const surface = cssVar('--color-surface', '#ffffff');
    const muted = cssVar('--color-text-muted', '#8a8a8a');
    const matchedRing = cssVar('--color-accent-pink', '#EC4899');
    const fallbackColor = colors[0] || '#94A3B8';

    const base = [
      {
        selector: 'node',
        style: {
          'background-color': fallbackColor,
          'background-opacity': 0.9,
          'border-width': 1.5,
          'border-color': surface,
          // 默认无文字：悬停 / 搜索命中时由 node.labeled 打开（见 refreshLabels）
          label: '',
          color: textColor,
          'font-size': 10,
          'font-family': fontFamily,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'text-wrap': 'ellipsis',
          'text-max-width': '130px',
          'text-background-color': surface,
          'text-background-opacity': 0.88,
          'text-background-padding': '2px',
          width: 'data(size)',
          height: 'data(size)',
          'transition-property': 'opacity, border-width, background-color',
          'transition-duration': '0.15s',
          'transition-timing-function': 'ease-out',
        },
      },
      {
        selector: 'node[isolated]',
        style: {
          'background-opacity': 0.35,
          'border-style': 'dashed',
          'border-color': muted,
        },
      },
      {
        selector: 'node.matched',
        style: { 'border-width': 3, 'border-color': matchedRing },
      },
      {
        selector: 'edge',
        style: {
          width: 1.1,
          'line-color': borderColor,
          'target-arrow-color': borderColor,
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.75,
          'curve-style': 'bezier',
          opacity: 0.75,
        },
      },
      {
        selector: '.dimmed',
        style: { opacity: 0.11, 'text-opacity': 0.05 },
      },
      // 放在最后：悬停 / 搜索命中的标签要盖过 .dimmed 的 text-opacity
      {
        selector: 'node.labeled',
        style: { label: 'data(label)', 'text-opacity': 1 },
      },
    ];

    tags.forEach((tag, i) => {
      base.push({
        selector: `node[mainTag="${selEscape(tag.name)}"]`,
        style: { 'background-color': colors[i] || fallbackColor },
      });
    });
    return base;
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

  // 沉浸式：画布高度按视口实测，比 CSS 推算稳（面包屑高度随语言 / 字号变化）
  function applyHeight(host) {
    if (document.fullscreenElement) return; // 全屏时高度交给 UA / CSS
    const top = host.getBoundingClientRect().top;
    host.style.height = Math.max(MIN_HEIGHT, Math.round(window.innerHeight - top)) + 'px';
  }

  function zoomBy(cy, factor) {
    const level = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cy.zoom() * factor));
    cy.zoom({
      level,
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  }

  function fitView(cy) {
    if (prefersReducedMotion()) {
      cy.fit(undefined, 48);
      return;
    }
    cy.animate({ fit: { padding: 48 }, duration: 240 });
  }

  // 左上浮层：搜索框 + 标签图例（标签多时折叠）
  function renderPanel(host, tags, colors, handlers) {
    const panel = document.createElement('div');
    panel.className = 'doc-graph-panel';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'doc-graph-searchwrap';
    searchWrap.innerHTML = '<svg class="doc-graph-searchicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/></svg>';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'doc-graph-search';
    search.placeholder = t('graph.search.placeholder', '搜索文档…');
    search.setAttribute('aria-label', t('graph.search.placeholder', '搜索文档…'));
    search.addEventListener('input', () => handlers.onSearch(search.value));
    searchWrap.appendChild(search);
    panel.appendChild(searchWrap);

    const tagsBox = document.createElement('div');
    tagsBox.className = 'doc-graph-tags';

    const legend = document.createElement('div');
    legend.className = 'doc-graph-legend';
    legend.setAttribute('role', 'group');
    legend.setAttribute('aria-label', t('graph.legend', '标签'));

    let activeChip = null;
    tags.forEach((tag, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'doc-graph-chip';
      chip.dataset.tag = tag.name;
      chip.innerHTML = `<span class="doc-graph-chip-dot" style="background:${esc(colors[i] || colors[0])}"></span>${esc(tag.name)}`;
      chip.addEventListener('click', () => {
        const next = activeChip === chip ? null : chip;
        if (activeChip) activeChip.classList.remove('active');
        activeChip = next;
        if (next) next.classList.add('active');
        handlers.onTag(next ? tag.name : '');
      });
      legend.appendChild(chip);
    });

    const collapsed = tags.length > LEGEND_COLLAPSE_AT;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'doc-graph-legend-toggle';
    toggle.innerHTML = `<span class="doc-graph-legend-label">${esc(t('graph.legend', '标签'))}</span><span class="doc-graph-legend-count">${tags.length}</span>`;
    toggle.hidden = !collapsed;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', t('graph.legend', '标签'));
    toggle.addEventListener('click', () => {
      const open = !legend.classList.contains('open');
      legend.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    legend.classList.toggle('open', !collapsed);

    tagsBox.appendChild(toggle);
    tagsBox.appendChild(legend);
    panel.appendChild(tagsBox);
    host.appendChild(panel);

    return {
      search,
      clearActiveChip() {
        if (activeChip) activeChip.classList.remove('active');
        activeChip = null;
      },
    };
  }

  // 右下浮层：画布控件
  function renderActions(host, items) {
    const box = document.createElement('div');
    box.className = 'doc-graph-actions';
    const map = {};
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'doc-graph-action';
      btn.dataset.act = item.key;
      btn.title = item.label;
      btn.setAttribute('aria-label', item.label);
      btn.innerHTML = item.icon;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.onClick(btn);
      });
      box.appendChild(btn);
      map[item.key] = btn;
    });
    host.appendChild(box);
    return map;
  }

  // 左下浮层：操作提示 + 孤立文档数量
  function renderFoot(host, isolatedCount) {
    const foot = document.createElement('div');
    foot.className = 'doc-graph-foot';

    const hint = document.createElement('span');
    hint.className = 'doc-graph-hint';
    hint.textContent = t('graph.hint', '拖拽平移 · 滚轮缩放 · 点击节点跳转');
    foot.appendChild(hint);

    if (isolatedCount > 0) {
      const note = document.createElement('span');
      note.className = 'doc-graph-note';
      note.textContent = t('graph.isolated', '{n} 篇无链接文档已灰显').replace('{n}', isolatedCount);
      foot.appendChild(note);
    }

    host.appendChild(foot);
  }

  function mount(pre) {
    if (!pre.parentNode) return Promise.resolve();
    const doc = pre.ownerDocument;
    const host = doc.createElement('div');
    host.className = 'doc-graph';
    const canvas = doc.createElement('div');
    canvas.className = 'doc-graph-canvas';
    host.appendChild(canvas);

    // 先把挂载点放进文档再算高度：宿主元素游离在文档外时量不到尺寸
    pre.parentNode.replaceChild(host, pre);
    applyHeight(host);

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
        const colors = buildColorLadder(tags.length);

        const cy = window.cytoscape({
          container: canvas,
          elements,
          style: graphStyle(tags, colors),
          minZoom: ZOOM_MIN,
          maxZoom: ZOOM_MAX,
          layout: {
            name: 'cose',
            // 入场散开一次；尊重系统的「减少动态效果」
            animate: !prefersReducedMotion(),
            animationDuration: 900,
            padding: 48,
            nodeRepulsion: 9000,
            idealEdgeLength: 90,
            nodeOverlap: 8,
          },
        });
        activeCy = cy;

        // hover：当前悬停节点；hits：搜索命中集合。标签显示由 refreshLabels 统一推导，
        // 避免「搜索标签」与「悬停标签」互相覆盖。
        const mark = { hover: null, hits: null };

        function refreshLabels() {
          cy.nodes().removeClass('labeled');
          if (mark.hover && mark.hover.inside()) {
            mark.hover.closedNeighborhood().nodes().addClass('labeled');
          }
          if (mark.hits && mark.hits.length) mark.hits.addClass('labeled');
        }

        function clearHighlight() {
          cy.elements().removeClass('dimmed matched labeled');
          mark.hits = null;
        }

        function applySearch(query) {
          clearHighlight();
          const q = String(query || '').trim().toLowerCase();
          if (!q) {
            refreshLabels();
            return;
          }
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
          mark.hits = hits.length ? cy.collection(hits) : null;
          cy.edges().forEach(e => {
            const hit = e.source().hasClass('matched') && e.target().hasClass('matched');
            e.toggleClass('dimmed', !hit);
          });
          refreshLabels();

          if (hits.length === 1) {
            cy.animate({ center: { eles: hits[0] }, zoom: 1.3, duration: prefersReducedMotion() ? 0 : 280 });
          } else if (hits.length > 1) {
            cy.animate({
              fit: { eles: cy.collection(hits), padding: 80 },
              duration: prefersReducedMotion() ? 0 : 280,
            });
          }
        }

        function applyTag(tag) {
          clearHighlight();
          if (!tag) {
            refreshLabels();
            return;
          }
          cy.nodes().forEach(n => {
            n.toggleClass('matched', (n.data('tags') || []).indexOf(tag) !== -1);
          });
          cy.edges().forEach(e => {
            const hit = e.source().hasClass('matched') && e.target().hasClass('matched');
            e.toggleClass('dimmed', !hit);
          });
          cy.nodes().forEach(n => n.toggleClass('dimmed', !n.hasClass('matched')));
          refreshLabels();
        }

        function resetView() {
          clearHighlight();
          mark.hover = null;
          panel.clearActiveChip();
          panel.search.value = '';
          refreshLabels();
          fitView(cy);
        }

        const panel = renderPanel(host, tags, colors, {
          onSearch: applySearch,
          onTag: applyTag,
        });

        // 全屏：把整个 .doc-graph（含浮层）作为全屏元素
        function toggleFullscreen() {
          if (document.fullscreenElement) {
            if (document.exitFullscreen) {
              const p = document.exitFullscreen();
              if (p && p.catch) p.catch(() => {});
            }
            return;
          }
          if (host.requestFullscreen) {
            const p = host.requestFullscreen();
            // 有的环境（iframe / 无用户手势）会拒绝，别让它变成未处理的 rejection
            if (p && p.catch) p.catch(err => console.warn('[Graph] 全屏不可用:', err && err.message));
          }
        }

        const actions = renderActions(host, [
          { key: 'zoom-in', label: t('graph.zoomIn', '放大'), icon: ICONS.zoomIn, onClick: () => zoomBy(cy, ZOOM_STEP) },
          { key: 'zoom-out', label: t('graph.zoomOut', '缩小'), icon: ICONS.zoomOut, onClick: () => zoomBy(cy, 1 / ZOOM_STEP) },
          { key: 'fit', label: t('graph.fit', '适配画布'), icon: ICONS.fit, onClick: () => fitView(cy) },
          { key: 'reset', label: t('graph.reset', '重置视图'), icon: ICONS.reset, onClick: resetView },
          { key: 'fullscreen', label: t('graph.fullscreen', '全屏'), icon: ICONS.fullscreen, onClick: toggleFullscreen },
        ]);

        renderFoot(host, isolatedCount);

        cy.on('tap', 'node', (evt) => {
          const path = evt.target.data('path');
          if (!path) return;
          if (window.MarkdownPreview.fileTree && window.MarkdownPreview.fileTree.highlightFileInSidebar) {
            window.MarkdownPreview.fileTree.highlightFileInSidebar(path);
          }
          if (window.MarkdownPreview.router) window.MarkdownPreview.router.updateHash(path);
          else window.location.hash = '#/' + path;
        });

        cy.on('mouseover', 'node', (evt) => {
          mark.hover = evt.target;
          refreshLabels();
          showTip(evt.target, canvas);
        });
        cy.on('mouseout', 'node', () => {
          mark.hover = null;
          refreshLabels();
          hideTip();
        });
        cy.on('dragpan zoom', hideTip);

        // 视口 / 可见性变化：重算画布高度并让 cytoscape 重新量尺寸。
        // 后台标签页里字体与 content-visibility 都还没定下来，首测会偏小，切回前台要重测。
        const onResize = () => {
          applyHeight(host);
          cy.resize();
        };
        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onResize);
        requestAnimationFrame(() => {
          onResize();
          requestAnimationFrame(onResize);
        });

        const onFullscreenChange = () => {
          const isFull = document.fullscreenElement === host;
          host.style.height = '';           // 高度交给 UA / CSS
          if (!isFull) applyHeight(host);
          requestAnimationFrame(() => cy.resize());
          const btn = actions.fullscreen;
          const label = isFull ? t('graph.exitFullscreen', '退出全屏') : t('graph.fullscreen', '全屏');
          btn.innerHTML = isFull ? ICONS.exitFullscreen : ICONS.fullscreen;
          btn.title = label;
          btn.setAttribute('aria-label', label);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);

        activeTeardown = () => {
          window.removeEventListener('resize', onResize);
          document.removeEventListener('visibilitychange', onResize);
          document.removeEventListener('fullscreenchange', onFullscreenChange);
        };
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

  // 供虚拟路由 #/graph 调用：走标准虚拟文档管线（面包屑 / 侧边栏 / hash 分享都在），
  // 但正文只留图谱挂载点 —— 沉浸式布局不输出 H1 与描述（body.graph-page 见 markdown.js）。
  function openPage() {
    const md = window.MarkdownPreview.markdown;
    if (!md || !md.renderVirtualDoc) return;
    const title = t('graph.pageTitle', '文档图谱');
    md.renderVirtualDoc('```graph\n```\n', title);
    // 正文不再输出 H1，文档标题得自己设（renderMarkdown 是从 H1 里取的）
    const repo = (window.MarkdownPreview.config && window.MarkdownPreview.config.repo) || 'Markdown Preview';
    document.title = title + ' | ' + repo;
    document.body.classList.add('graph-page');
  }

  // graphStyle / buildColorLadder 一并导出：两者都被回归测试直接调用
  // （标签规则与配色解析在浏览器 DOM 里查不到，只能靠 headless cytoscape 与纯函数断言）
  window.MarkdownPreview.renderers.graph = { render, graphStyle };
  window.MarkdownPreview.graph = { openPage, buildColorLadder, parseColor };
})();
