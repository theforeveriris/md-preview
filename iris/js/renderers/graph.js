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
 * 形态：#/graph 是独立沉浸式页面（body.graph-page）—— 画布撑满可用视口，
 *       阅读页的 chrome（侧边栏按钮 / 面包屑标题）全部不出现，
 *       搜索 / 图例 / 功能区都是画布上的浮层，正文不再输出 H1 与描述。
 *
 * 交互：
 *   - 拖拽平移 / 滚轮缩放 / 左键点击节点打开文档
 *   - 节点默认不显示文字；被引 top-N 常显，悬停显示该节点与其一跳邻居的名字
 *   - 搜索：命中节点高亮 + 显示名字 + 自动居中
 *   - 图例 chip：高亮该标签子图（不额外加文字）
 *   - 左下角功能区：退回文档站 / 缩放 ± / 适配画布 / 重置视图 / 全屏 / 无链接文档显隐
 *   - 配色：标签色相轮 + 频次分层 —— 出现 ≥ MAJOR_TAG_MIN 次的标签各占一档色相，
 *     低频标签合并为中性灰（26 档单色明度阶梯人眼分不出，有效颜色控制在 16 档以内）
 *   - 布局：concentric 同心圆，按连接数（入链 + 出链）分层，枢纽文档居中
 *   - 孤立文档（无入链也无出链）默认隐藏，功能区按钮一键显示 / 隐藏
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
  // 出现次数达到该值的标签才分得独立色相；其余合并为中性灰
  const MAJOR_TAG_MIN = 3;
  // 独立色相的上限：超过 16 档后相邻色相差 < 22°，又开始难分了
  const MAX_MAJOR_HUES = 16;
  // 默认常显标题的被引榜长度
  const LABEL_TOP_N = 10;
  const ZOOM_STEP = 1.35;
  const ZOOM_MIN = 0.15;
  const ZOOM_MAX = 3;
  const MIN_HEIGHT = 320;

  // 画布控件图标（自包含，不依赖 index.html 的 symbol 精灵）
  const ICONS = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    zoomIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M11 8.5v5M8.5 11h5M20.5 20.5 16.5 16.5"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M8.5 11h5M20.5 20.5 16.5 16.5"/></svg>',
    fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="3"/><path d="M8.5 7H7v1.5M15.5 7H17v1.5M8.5 17H7v-1.5M15.5 17H17v-1.5"/></svg>',
    exitFullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="2.5" width="19" height="19" rx="3"/><path d="M7 8.5h2.5V6M17 8.5h-2.5V6M7 15.5h2.5V18M17 15.5h-2.5V18"/></svg>',
    eyeOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.73 5.08A9.4 9.4 0 0 1 12 5c6.5 0 10 7 10 7a17.5 17.5 0 0 1-2.16 3.19M6.61 6.61A14.6 14.6 0 0 0 2 12s3.5 7 10 7a9.9 9.9 0 0 0 5.39-1.61M2 2l20 20"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/></svg>',
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
    // 桌面端本地知识库：链接关系在挂载时扫描，替代站内 links.json
    const kb = window.MarkdownPreview.desktopKb;
    if (kb && kb.isActive && kb.isActive() && kb.getLinksData) {
      return Promise.resolve(kb.getLinksData());
    }
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
    const outdegCount = new Map();
    const indeg = new Map();
    Object.keys(linkMap).forEach(from => {
      const targets = linkMap[from] || {};
      const keys = Object.keys(targets);
      if (keys.length) outdeg.add(from);
      outdegCount.set(from, keys.length);
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
          // 总连接数：concentric 布局的分层依据（只看入链会把「引用别人的索引页」推到外圈）
          links: degree + (outdegCount.get(d.path) || 0),
          size: 20 + Math.min(38, degree * 4),
        },
      };
    });

    const elements = [];
    nodes.forEach(n => elements.push(n));
    edges
      .filter(e => known.has(e.from) && known.has(e.to))
      .forEach(e => elements.push({
        // 边宽随权重走（同一对文档互链多次 = 关系更紧密），上限 3.4px
        data: {
          id: `${e.from}→${e.to}`,
          source: e.from,
          target: e.to,
          weight: e.weight || 1,
          width: 1.2 + Math.min(2.2, ((e.weight || 1) - 1) * 0.35),
        },
      }));

    // 出现次数多的标签排在前面，拿到阶梯里对比度最强的一档
    const tags = Array.from(tagCount.entries())
      .map(([name, count], order) => ({ name, count, order }))
      .sort((a, b) => (b.count - a.count) || (a.order - b.order))
      .map(({ name, count }) => ({ name, count }));

    return { elements, tags, isolatedCount: nodes.filter(n => n.data.isolated).length };
  }

  // cytoscape 不解析 CSS var()，样式里要给出实际颜色 / 字体
  // 主题变量读取统一走 ColorUtils.getThemeVar
  const cssVar = (name, fallback) => window.MarkdownPreview.ColorUtils.getThemeVar(name, fallback);

  // ---- 配色：主题强调色的明度阶梯 ----
  // 不用 CSS color-mix：浏览器会把它的计算值序列化成 color(srgb …) / oklab()，
  // cytoscape 的解析器只认 rgb()/#hex，解析不了就会退回黑色。这里自己算 RGB。

  // 颜色解析/亮度/对比度统一走 MarkdownPreview.ColorUtils
  // （此前与 iris/plugins/color.js 两套并行实现，已收敛；本地薄封装保持调用点不变）
  const parseColor = (str) => window.MarkdownPreview.ColorUtils.parseRgb(str);
  const resolveColor = (cssValue, fallback) => window.MarkdownPreview.ColorUtils.resolveColor(cssValue, fallback);
  const luminanceOf = (rgb) => window.MarkdownPreview.ColorUtils.luminance(rgb);
  const rgbToCss = (rgb) => window.MarkdownPreview.ColorUtils.rgbToCss(rgb);
  const hslToRgb = (h, sl, l) => window.MarkdownPreview.ColorUtils.hslToRgb(h, sl, l);

  // ---- 标签配色：色相轮 + 频次分层 ----
  // 旧方案是主题强调色的明度阶梯：单一色相撑不起 26 档（人眼在同色相上只能辨
  // 约 10 级明度），所有标签糊成一种灰粉。现在出现 ≥ MAJOR_TAG_MIN 次的标签在
  // 色相轮上各占一档（上限 MAX_MAJOR_HUES 档），低频标签合并为中性灰 ——
  // 图例里低频 chip 依然是灰点，悬停节点仍能在 tooltip 里看到完整标签列表。
  // tags 须按出现次数降序（buildElements 已排好）：排在前面的拿到更大的相邻色相差。
  function buildTagColors(tags) {
    const majors = tags.filter(tag => tag.count >= MAJOR_TAG_MIN).slice(0, MAX_MAJOR_HUES);
    const neutral = rgbToCss(resolveColor(cssVar('--color-text-muted', '#8a8a8a'), '#8a8a8a'));
    // 浅色主题配深色节点、深色主题配亮色节点，保证在画布底色上都有对比
    const bg = resolveColor(cssVar('--color-bg', '#ffffff'), '#ffffff');
    const dark = luminanceOf(bg) < 0.4;
    const sat = dark ? 0.62 : 0.55;
    const light = dark ? 0.68 : 0.44;
    // 偏移 12° 避开正红 —— 红色在界面语言里容易和错误态混淆
    const offset = 12;
    const hueOf = new Map(majors.map((tag, i) => [tag.name, (i * 360 / majors.length + offset) % 360]));
    return tags.map(tag => {
      const hue = hueOf.get(tag.name);
      return hue === undefined
        ? neutral
        : rgbToCss(hslToRgb(hue, sat, light));
    });
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
    const surface = cssVar('--color-surface', '#ffffff');
    const muted = cssVar('--color-text-muted', '#8a8a8a');
    // 边用中性灰而不是边框色：边框色在浅色底上对比度太低，几乎看不见；
    // 用文字的弱化色则深浅主题都自适应，也不会和 10+ 档节点色相打架
    const edgeColor = rgbToCss(resolveColor(muted, '#8a8a8a'));
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
          // 默认无文字：被引 top-N 由 node.pinned 常显，悬停 / 搜索命中时由 node.labeled 打开
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
        // 孤立节点用 class 而不是 node[isolated] 数据选择器：本仓库 vendor 的
        // cytoscape 对布尔 data 字段按「存在」而非「真值」匹配，isolated:false
        // 的普通节点也会被 [isolated] 命中，导致全部节点虚线化
        selector: 'node.isolated',
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
          width: 'data(width)',
          'line-color': edgeColor,
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.9,
          'curve-style': 'bezier',
          opacity: 0.75,
        },
      },
      {
        selector: '.dimmed',
        style: { opacity: 0.11, 'text-opacity': 0.05 },
      },
      // 放在最后：常显 / 悬停 / 搜索命中的标签要盖过 .dimmed 的 text-opacity
      {
        selector: 'node.pinned',
        style: { label: 'data(label)', 'text-opacity': 1 },
      },
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
        const colors = buildTagColors(tags);

        // 同心圆：按总连接数（log2 分档）分层，枢纽文档落在中心。
        // 旧方案 cose 在这种稀疏树状图（中位度数 1）上会把节点炸到四周，
        // concentric 确定性强，且「圈层 = 重要程度」与节点大小（入度）同一套语言。
        function makeLayoutOpts() {
          return {
            name: 'concentric',
            animate: !prefersReducedMotion(),
            animationDuration: 700,
            padding: 48,
            // log2 让「引用 50 篇的索引页」和「引用 3 篇的普通页」不至于拉开 47 个圈
            concentric: node => Math.log2(1 + (node.data('links') || 0)),
            levelWidth: () => 0.5,
            minNodeSpacing: 42,
            avoidOverlap: true,
            spacingFactor: 1.05,
          };
        }

        // 孤立节点默认不进画布（示例文档等未互链的页面只会干扰布局），
        // 左下角按钮按需加回；加回 / 移除后重跑一次布局让它们落到正确圈层
        const isoElements = elements.filter(el => el.data && el.data.isolated);
        const mainElements = elements.filter(el => !(el.data && el.data.isolated));

        const cy = window.cytoscape({
          container: canvas,
          elements: mainElements,
          style: graphStyle(tags, colors),
          minZoom: ZOOM_MIN,
          maxZoom: ZOOM_MAX,
          layout: makeLayoutOpts(),
        });
        activeCy = cy;

        function toggleIsolated(show) {
          // 孤立节点打 .isolated class（别用 [isolated] 数据选择器，见 graphStyle 里的注释）
          cy.batch(() => {
            if (show) isoElements.forEach(el => cy.add(el).addClass('isolated'));
            else cy.nodes('.isolated').remove();
          });
          // 布局自带 end-fit（padding 同 makeLayoutOpts），不用再手动 fitView 抢动画
          cy.layout(makeLayoutOpts()).run();
        }

        // 被引最多的前 N 篇常显标题（导航场景里最有用的地标）；孤立节点不入榜
        cy.nodes()
          .not('.isolated')
          .sort((a, b) => b.data('degree') - a.data('degree'))
          .slice(0, LABEL_TOP_N)
          .addClass('pinned');

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

        // 退回文档站：回到进入图谱前正在读的文档；直开图谱页（没读过文档）则回站点首页
        function backToSite() {
          const md = window.MarkdownPreview.markdown;
          if (!md || !md.loadMarkdownFile) return;
          const st = window.MarkdownPreview.state || {};
          const paths = flattenDocs(st.fileTreeData, []).map(d => d.path);
          const target = st.currentFilePath && paths.indexOf(st.currentFilePath) !== -1
            ? st.currentFilePath
            : (paths.indexOf('README.md') !== -1 ? 'README.md' : paths[0]);
          if (target) md.loadMarkdownFile(target);
        }

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

        // 左下角功能区：退回文档站 / 缩放 ± / 适配画布 / 重置视图 / 全屏 / 无链接文档显隐
        let isolatedShown = false;
        const isolatedLabel = () => isolatedShown
          ? t('graph.isolated.shown', '无链接文档已显示 · 点击隐藏')
          : t('graph.isolated.hidden', '{n} 篇无链接文档已隐藏 · 点击显示').replace('{n}', isolatedCount);
        const actionItems = [
          { key: 'back', label: t('graph.backToSite', '退回文档站'), icon: ICONS.back, onClick: backToSite },
          { key: 'zoom-in', label: t('graph.zoomIn', '放大'), icon: ICONS.zoomIn, onClick: () => zoomBy(cy, ZOOM_STEP) },
          { key: 'zoom-out', label: t('graph.zoomOut', '缩小'), icon: ICONS.zoomOut, onClick: () => zoomBy(cy, 1 / ZOOM_STEP) },
          { key: 'fit', label: t('graph.fit', '适配画布'), icon: ICONS.fit, onClick: () => fitView(cy) },
          { key: 'reset', label: t('graph.reset', '重置视图'), icon: ICONS.reset, onClick: resetView },
          { key: 'fullscreen', label: t('graph.fullscreen', '全屏'), icon: ICONS.fullscreen, onClick: toggleFullscreen },
        ];
        if (isolatedCount > 0) {
          actionItems.push({
            key: 'isolated',
            label: isolatedLabel(),
            icon: ICONS.eyeOff,
            onClick: (btn) => {
              isolatedShown = !isolatedShown;
              toggleIsolated(isolatedShown);
              btn.setAttribute('aria-pressed', String(isolatedShown));
              btn.innerHTML = isolatedShown ? ICONS.eyeOn : ICONS.eyeOff;
              const label = isolatedLabel();
              btn.title = label;
              btn.setAttribute('aria-label', label);
            },
          });
        }
        const actions = renderActions(host, actionItems);
        if (actions.isolated) actions.isolated.setAttribute('aria-pressed', 'false');

        cy.on('tap', 'node', (evt) => {
          const path = evt.target.data('path');
          if (!path) return;
          // 注意别用 router.updateHash：它只做 replaceState 静默改 URL，不会触发
          // hashchange，文档永远不加载（点了像没反应，稍一移动就变成拖拽）。
          // 站内导航统一走 loadMarkdownFile（同文件树 / 命令面板）
          if (window.MarkdownPreview.fileTree && window.MarkdownPreview.fileTree.highlightFileInSidebar) {
            window.MarkdownPreview.fileTree.highlightFileInSidebar(path);
          }
          const md = window.MarkdownPreview.markdown;
          if (md && md.loadMarkdownFile) md.loadMarkdownFile(path);
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

  // 供虚拟路由 #/graph 调用：走标准虚拟文档管线（hash 分享 / 导出能力都在），
  // 但页面是独立沉浸式形态 —— 正文只留图谱挂载点，不出 H1，也不出
  // renderVirtualDoc 点亮的面包屑标题栏（body.graph-page 的 CSS 同时隐藏侧边栏按钮）
  function openPage() {
    const md = window.MarkdownPreview.markdown;
    if (!md || !md.renderVirtualDoc) return;
    const title = t('graph.pageTitle', '文档图谱');
    md.renderVirtualDoc('```graph\n```\n', title);
    const header = document.getElementById('pageHeader');
    if (header) header.style.display = 'none';
    // 正文不再输出 H1，文档标题得自己设（renderMarkdown 是从 H1 里取的）
    const repo = (window.MarkdownPreview.config && window.MarkdownPreview.config.repo) || 'Markdown Preview';
    document.title = title + ' | ' + repo;
    document.body.classList.add('graph-page');
  }

  // graphStyle / buildTagColors 一并导出：两者都被回归测试直接调用
  // （标签规则与配色解析在浏览器 DOM 里查不到，只能靠 headless cytoscape 与纯函数断言）
  window.MarkdownPreview.renderers.graph = { render, graphStyle };
  window.MarkdownPreview.graph = { openPage, buildTagColors, parseColor };
})();
