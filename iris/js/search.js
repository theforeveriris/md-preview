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
        const combined = (doc.title || '') + ' ' + (doc.preview || '') + ' ' + (doc.path || '');
        flexIndex.add(i, combined);
      });
      console.log('FlexSearch index built with', documents.length, 'documents');
    } else {
      console.warn('FlexSearch not available, falling back to simple search');
    }
  }

  async function buildIndex() {
    const indexData = await loadSearchIndex();
    initSearchIndex(indexData);
    return indexData.length;
  }

  async function ensureIndexLoaded() {
    if (!isIndexLoaded) {
      await buildIndex();
    }
  }

  // 降级方案：纯 includes 子串匹配
  function simpleSearch(query) {
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
    return results.slice(0, 20).map(r => r.index);
  }

  // FlexSearch 主搜索 + 后排序加权
  function flexSearch(query) {
    if (!flexIndex) return simpleSearch(query);

    const ids = flexIndex.search(query, 20);
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
    if (!query.trim()) {
      hideSearchResults();
      return;
    }

    currentQuery = query.trim();
    console.log('Searching for:', query);

    try {
      const results = flexIndex ? flexSearch(query) : simpleSearch(query);
      console.log('Results count:', results.length);
      displaySearchResults(results);
    } catch (e) {
      console.error('Search error:', e);
      hideSearchResults();
    }
  }

  function displaySearchResults(results) {
    const { dom, fileTree, markdown } = window.MarkdownPreview;
    const container = dom.searchResults;
    container.innerHTML = '';
    container.classList.add('active');

    if (!results || results.length === 0) {
      container.innerHTML = '<div class="search-no-results">没有找到相关文档</div>';
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
      container.innerHTML = '<div class="search-no-results">没有找到相关文档</div>';
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
        markdown.loadMarkdownFile(result.path);
        fileTree.highlightFileInSidebar(result.path);
        hideSearchResults();
        dom.searchInput.value = '';
      });

      container.appendChild(item);
    });
  }

  function hideSearchResults() {
    const { dom } = window.MarkdownPreview;
    dom.searchResults.classList.remove('active');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 转义 HTML 后，将命中关键词片段用 <mark> 包裹（大小写不敏感）
  function highlightMatch(text, query) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    if (!query) return escaped;
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp(safeQuery, 'gi');
      return escaped.replace(regex, m => '<mark>' + m + '</mark>');
    } catch (e) {
      return escaped;
    }
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
    buildIndex();
  }

  window.MarkdownPreview.search = {
    init: init,
    buildIndex: buildIndex
  };
})();
