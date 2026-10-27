(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.search = {};

  let documents = [];
  let debounceTimer = null;
  let isIndexLoaded = false;
  let currentQuery = '';
  let flexIndex = null;

  async function loadSearchIndex() {
    try {
      const response = await fetch('iris/data/search-index.json');
      if (!response.ok) {
        console.warn('Search index not found');
        return [];
      }
      return await response.json();
    } catch (e) {
      console.error('Failed to load search index:', e);
      return [];
    }
  }

  // CJK 感知编码器：将中文字符拆为单字 token，拉丁文按词拆分
  function cjkEncode(str) {
    if (!str) return [];
    return str.toLowerCase()
      .replace(/[\u4e00-\u9fff]/g, ' $& ')
      .replace(/[^\w\u4e00-\u9fff\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function initSearchIndex(indexData) {
    documents = indexData;
    isIndexLoaded = true;

    // 标记索引来源：有数据则视为预构建，空数组回退运行时构建
    const { state } = window.MarkdownPreview;
    if (state) {
      state.searchIndexStats = {
        source: indexData && indexData.length > 0 ? 'prebuilt' : 'runtime',
        entries: indexData ? indexData.length : 0
      };
    }

    if (typeof FlexSearch !== 'undefined') {
      flexIndex = new FlexSearch.Index({
        encode: cjkEncode,
        tokenize: 'forward',
        resolution: 9,
        minlength: 1
      });
      documents.forEach((doc, i) => {
        // searchText 为构建期成型（含繁体形态与拼音首字母）；旧索引缺该字段时回退原拼接
        const combined = doc.searchText ||
          ((doc.title || '') + ' ' + (doc.preview || '') + ' ' + (doc.path || ''));
        flexIndex.add(i, combined);
      });
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('FlexSearch index built with', documents.length, 'documents');
    } else {
      console.warn('FlexSearch not available, falling back to simple search');
    }
  }

  let buildPromise = null;

  async function buildIndex() {
    // 幂等 + 并发去重：file-tree 加载/首搜/命令面板同时触发只 fetch+建一次
    //（此前 init 无守卫 + file-tree 500ms 后再建，56KB 索引至少拉两次）
    if (isIndexLoaded) return documents.length;
    if (!buildPromise) {
      buildPromise = loadSearchIndex().then(indexData => {
        initSearchIndex(indexData);
        buildPromise = null;
        return indexData.length;
      }).catch(e => {
        buildPromise = null;
        throw e;
      });
    }
    return buildPromise;
  }

  async function ensureIndexLoaded() {
    if (!isIndexLoaded) {
      await buildIndex();
    }
  }

  // 降级方案：纯 includes 子串匹配
  function simpleSearch(query, limit) {
    const results = [];
    const queryLower = query.toLowerCase();

    documents.forEach((doc, index) => {
      const titleLower = doc.title.toLowerCase();
      const pathLower = doc.path.toLowerCase();
      let score = 0;

      if (titleLower.includes(queryLower)) {
        score += 10;
        if (titleLower.indexOf(queryLower) === 0) score += 5;
      }
      const previewLower = doc.preview ? doc.preview.toLowerCase() : '';
      if (previewLower.includes(queryLower)) score += 5;
      if (pathLower.includes(queryLower)) score += 2;

      if (score > 0) {
        results.push({ index, score });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit || 20).map(r => r.index);
  }

  // FlexSearch 主搜索 + 后排序加权
  function flexSearch(query, limit) {
    if (!flexIndex) return simpleSearch(query, limit);

    const ids = flexIndex.search(query, limit || 20);
    const queryLower = query.toLowerCase();

    const ranked = ids.map(id => {
      const doc = documents[id];
      if (!doc) return { index: id, score: 0 };
      let score = 1; // FlexSearch 基础匹配分
      const titleLower = doc.title.toLowerCase();
      if (titleLower.includes(queryLower)) {
        score += 10;
        if (titleLower.indexOf(queryLower) === 0) score += 5;
      }
      if (doc.preview && doc.preview.toLowerCase().includes(queryLower)) score += 5;
      if (doc.path.toLowerCase().includes(queryLower)) score += 2;
      return { index: id, score };
    });

    ranked.sort((a, b) => b.score - a.score);
    return ranked.map(r => r.index);
  }

  async function performSearch(query) {
    await ensureIndexLoaded();

    const { dom } = window.MarkdownPreview;
    const palette = window.MarkdownPreview.palette;

    // 纯命令模式：> 前缀只匹配动作
    if (palette && palette.isCommandQuery(query)) {
      currentQuery = query.trim();
      palette.renderCommands(palette.stripPrefix(query));
      return;
    }

    if (!query.trim()) {
      // 空查询：命令面板空态列出全部动作（万能命令面板）
      if (palette) palette.renderCommands('');
      else hideSearchResults();
      return;
    }

    currentQuery = query.trim();
    (window.MarkdownPreview.debug?.debugLog || (() => {}))('Searching for:', query);

    // tag:xxx 过滤 token：拆出后按文档标签过滤结果
    const tagsMod = window.MarkdownPreview.tags;
    const tagFilter = tagsMod ? tagsMod.extractTagFilters(currentQuery) : { text: currentQuery, tags: [] };
    const searchText = tagFilter.text;

    try {
      // tag: 过滤时先取 100 条候补：只看 FlexSearch 截断的 top-20 会让
      // 文本排名 20 名外但标签命中的文档永远搜不到
      const limit = tagFilter.tags.length > 0 ? 100 : 20;
      let results = flexIndex ? flexSearch(searchText, limit) : simpleSearch(searchText, limit);
      if (tagFilter.tags.length > 0) {
        results = results.filter(id => tagsMod.docHasTags(documents[id], tagFilter.tags));
      }
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('Results count:', results.length);
      displaySearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
      hideSearchResults();
    }
  }

  // i18n 文案读取（统一 t() 风格，替代内联三元硬编码中文兜底）
  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  // ============== 内联计算器（SPOT-1） ==============
  // 命令面板输入数学表达式或 CIDR 直接出结果（Spotlight 风格，与 ipcalc 联动）

  // 数学表达式：仅允许数字与运算符（无标识符 → 无注入面），^ 幂转 **
  function calcMath(expr) {
    const cleaned = expr.replace(/\s+/g, '');
    if (!cleaned || !/^[0-9+\-*/().^%]+$/.test(cleaned)) return null;
    if (!/[+\-*/^%]/.test(cleaned)) return null; // 纯数字不当作表达式
    try {
      const js = cleaned.replace(/\^/g, '**');
      const val = Function('"use strict"; return (' + js + ')')();
      if (typeof val !== 'number' || !isFinite(val)) return null;
      return { kind: 'math', value: val };
    } catch (e) { return null; }
  }

  // CIDR 子网速算：192.168.1.0/26 → 网络/掩码/范围/可用数
  function calcSubnet(expr) {
    const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})\s*$/.exec(expr);
    if (!m) return null;
    const parts = m[1].split('.').map(Number);
    if (parts.some(n => n > 255)) return null;
    const prefix = parseInt(m[2], 10);
    if (prefix > 32) return null;
    const ip = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const int2ip = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    const usable = prefix >= 31 ? Math.pow(2, 32 - prefix) : Math.pow(2, 32 - prefix) - 2;
    const range = prefix >= 31
      ? `${int2ip(network)} — ${int2ip(broadcast)}`
      : `${int2ip(network + 1)} — ${int2ip(broadcast - 1)}`;
    return { kind: 'subnet', network: `${int2ip(network)}/${prefix}`, mask: int2ip(mask), range, usable };
  }

  function inlineCalc(query) {
    const q = String(query || '').trim();
    if (!q || q.length > 64) return null;
    return calcSubnet(q) || calcMath(q);
  }

  function appendCalcCard(container, expr, result) {
    const item = document.createElement('div');
    item.className = 'search-result-item palette-calc-item';
    const calcIcon = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11.01"/><line x1="12" y1="11" x2="12" y2="11.01"/><line x1="16" y1="11" x2="16" y2="11.01"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="12" y1="15" x2="12" y2="15.01"/><line x1="16" y1="15" x2="16" y2="15.01"/><line x1="8" y1="19" x2="8" y2="19.01"/><line x1="12" y1="19" x2="12" y2="19.01"/><line x1="16" y1="19" x2="16" y2="19.01"/></svg>';
    let valueHtml;
    if (result.kind === 'subnet') {
      valueHtml = `
        <div class="palette-calc-value">${escapeHtml(result.network)}</div>
        <div class="palette-calc-sub">${escapeHtml(t('calc.mask', '掩码'))} ${escapeHtml(result.mask)} ·
          ${escapeHtml(t('calc.range', '范围'))} ${escapeHtml(result.range)} ·
          ${escapeHtml(t('calc.usable', '可用 {n}').replace('{n}', result.usable.toLocaleString()))}</div>`;
    } else {
      const v = result.value;
      const shown = Number.isInteger(v) ? v.toLocaleString() : String(Math.round(v * 1e10) / 1e10);
      valueHtml = `<div class="palette-calc-value">${escapeHtml(shown)}</div>`;
    }
    item.innerHTML = `
      <span class="palette-command-icon">${calcIcon}</span>
      <div class="palette-command-body">
        <div class="search-result-title">${escapeHtml(expr)} <span class="palette-calc-eq">=</span></div>
        ${valueHtml}
      </div>
      <span class="palette-command-group">${escapeHtml(t('calc.group', '计算器 · 点击复制'))}</span>`;
    item.addEventListener('click', () => {
      const text = result.kind === 'subnet'
        ? `${result.network} ${result.mask} ${result.range} (${result.usable})`
        : String(result.value);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {});
    });
    container.appendChild(item);
  }

  function displaySearchResults(results) {
    const { dom, fileTree, markdown } = window.MarkdownPreview;
    const container = dom.searchResults;
    container.innerHTML = '';
    container.classList.add('active');

    // 内联计算器：查询形如 2^16-1 或 192.168.1.0/26 时置顶出结果卡
    const calc = inlineCalc(currentQuery);
    if (calc) appendCalcCard(container, currentQuery, calc);

    if (!results || results.length === 0) {
      container.innerHTML = `<div class="search-no-results">${t("search.noResults", "没有找到相关文档")}</div>`;
      if (window.MarkdownPreview.palette) {
        window.MarkdownPreview.palette.appendInline(window.MarkdownPreview.palette.stripPrefix(currentQuery), container, 4);
      }
      return;
    }

    const seen = new Set();
    const merged = [];

    for (const index of results) {
      if (seen.has(index)) continue;
      seen.add(index);
      const doc = documents[index];
      if (doc) merged.push(doc);
    }

    if (merged.length === 0) {
      container.innerHTML = `<div class="search-no-results">${t("search.noResults", "没有找到相关文档")}</div>`;
      return;
    }

    merged.slice(0, 15).forEach(result => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <div class="search-result-title">${highlightMatch(result.title, currentQuery)}</div>
        <div class="search-result-path">${highlightMatch(result.path, currentQuery)}</div>
        ${result.preview ? `<div class="search-result-preview">${highlightMatch(result.preview, currentQuery)}</div>` : ''}
      `;

      item.addEventListener('click', () => {
        const palette = window.MarkdownPreview.palette;
        // 直达关键词：文档渲染后用查找条定位首次命中（剔除 > 前缀与 tag: 过滤 token）
        let keyword = palette ? palette.stripPrefix(currentQuery) : currentQuery;
        if (window.MarkdownPreview.tags) {
          keyword = window.MarkdownPreview.tags.extractTagFilters(keyword).text;
        }
        const load = markdown.loadMarkdownFile(result.path);
        fileTree.highlightFileInSidebar(result.path);
        hideSearchResults();
        dom.searchInput.value = '';
        // 结果在命令面板中展示，选中后收起面板
        window.MarkdownPreview.ui?.closeSearchPalette?.();
        if (keyword && window.MarkdownPreview.findBar) {
          Promise.resolve(load).then(() => {
            setTimeout(() => window.MarkdownPreview.findBar.openWithQuery(keyword), 350);
          });
        }
      });

      container.appendChild(item);
    });

    // 混排：文档结果之后追加命中的命令动作
    if (window.MarkdownPreview.palette) {
      window.MarkdownPreview.palette.appendInline(
        window.MarkdownPreview.palette.stripPrefix(currentQuery), container, 4);
    }
  }

  function hideSearchResults() {
    const { dom } = window.MarkdownPreview;
    dom.searchResults.classList.remove('active');
    // 命令面板中结果区常驻显示，隐藏时同时清空内容，恢复空态提示
    dom.searchResults.innerHTML = '';
  }

  // 清空输入与结果（命令面板关闭/重新打开时调用）
  function reset() {
    const { dom } = window.MarkdownPreview;
    clearTimeout(debounceTimer);
    currentQuery = '';
    if (dom.searchInput) dom.searchInput.value = '';
    hideSearchResults();
  }

  // 转义 HTML 后，将命中关键词片段用 <mark> 包裹（大小写不敏感）
  // escapeHtml 统一走 md-render.js 的权威实现（全站唯一，避免多处副本漂移）
  // 惰性转发：解析期直接取全局依赖 index.html 加载顺序（曾按隐式契约）
  const escapeHtml = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  function highlightMatch(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regex;
    try {
      regex = new RegExp(safeQuery, 'gi');
    } catch (e) {
      return escapeHtml(text);
    }
    // 先在原文上计算命中区间再转义：在已转义文本上跑正则会命中
    // &amp; 这类实体的内部（查 "amp" 会产出 &<mark>amp</mark>;）
    const ranges = [];
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) { regex.lastIndex++; continue; }
      ranges.push([m.index, m.index + m[0].length]);
    }
    let out = '';
    let pos = 0;
    for (const [s0, e0] of ranges) {
      out += escapeHtml(text.slice(pos, s0)) + '<mark>' + escapeHtml(text.slice(s0, e0)) + '</mark>';
      pos = e0;
    }
    out += escapeHtml(text.slice(pos));
    return out;
  }

  function setupSearchEvents() {
    const { dom } = window.MarkdownPreview;
    if (!dom.searchInput) {
      console.error('searchInput not found!');
      return;
    }

    dom.searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performSearch(e.target.value);
      }, 300);
    });

    document.addEventListener('click', (e) => {
      if (!dom.searchInput.contains(e.target) && !dom.searchResults.contains(e.target)) {
        hideSearchResults();
      }
    });
  }

  function init() {
    setupSearchEvents();
    // 首建延迟到真正使用（搜索框聚焦/输入、命令面板打开）：
    // 56KB search-index.json + FlexSearch 全量重建不再占用首屏主线程
    const MPDom = window.MarkdownPreview.dom;
    if (MPDom && MPDom.searchInput) {
      // 命令面板与搜索共用此输入框：聚焦即触发首建
      MPDom.searchInput.addEventListener('focus', ensureIndexLoaded, { once: true });
    }
  }

  // ============== 桌面端本地知识库注入（desktop-kb.js 调用） ==============
  // injectDocuments：用挂载目录的轻量索引整体替换站内索引；
  // useBuiltinIndex：卸载后复位标记，下次搜索重新 fetch 站内 search-index.json
  function injectDocuments(docs) {
    documents = Array.isArray(docs) ? docs : [];
    isIndexLoaded = true;
    buildPromise = null;
    if (typeof FlexSearch !== 'undefined') {
      flexIndex = new FlexSearch.Index({
        encode: cjkEncode,
        tokenize: 'forward',
        resolution: 9,
        minlength: 1
      });
      documents.forEach((doc, i) => {
        flexIndex.add(i, (doc.title || '') + ' ' + (doc.preview || '') + ' ' + (doc.path || ''));
      });
    }
  }

  function useBuiltinIndex() {
    isIndexLoaded = false;
    buildPromise = null;
  }

  window.MarkdownPreview.search = {
    init: init,
    buildIndex: buildIndex,
    reset: reset,
    injectDocuments,
    useBuiltinIndex
  };
})();
