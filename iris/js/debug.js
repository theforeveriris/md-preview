(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  const debugState = {
    apiCalls: 0,
    cacheHits: 0,
    startTime: null,
    enabled: false,
    refreshTimer: null,
    fcpTime: null
  };

  function initDebug() {
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug');

    if (debugMode === '1' || debugMode === 'true') {
      debugState.enabled = true;
      debugState.startTime = performance.now();
      showDebugPanel();
      setupDebugClose();
      observeFCP();
      updateAll();
      // 周期刷新（文档切换、内存变化、视口变化等）
      debugState.refreshTimer = setInterval(updateAll, 2000);
      // 页面加载完成后再次刷新（拿 load 时长）
      window.addEventListener('load', () => setTimeout(updateAll, 100));
    }
  }

  function showDebugPanel() {
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
      debugPanel.classList.remove('hidden');
    }
  }

  function setupDebugClose() {
    const closeBtn = document.getElementById('debugClose');
    const debugPanel = document.getElementById('debugPanel');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (debugPanel) {
          debugPanel.classList.add('hidden');
        }
        if (debugState.refreshTimer) {
          clearInterval(debugState.refreshTimer);
          debugState.refreshTimer = null;
        }
      });
    }
  }

  function incrementApiCalls() {
    if (!debugState.enabled) return;
    debugState.apiCalls++;
    updateApiAndCache();
  }

  function incrementCacheHits() {
    if (!debugState.enabled) return;
    debugState.cacheHits++;
    updateApiAndCache();
  }

  function observeFCP() {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const obs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            debugState.fcpTime = Math.round(entry.startTime);
            updatePerformance();
            obs.disconnect();
            break;
          }
        }
      });
      obs.observe({ type: 'paint', buffered: true });
    } catch (e) {
      // 部分浏览器不支持，忽略
    }
  }

  // ============== 工具函数 ==============

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatBytes(bytes) {
    if (bytes == null) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function formatMs(ms) {
    if (ms == null || isNaN(ms)) return '-';
    return Math.round(ms) + ' ms';
  }

  function detectBrowser() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Edge ' + (ua.match(/Edg\/(\d+)/) || [])[1];
    if (/Chrome\//.test(ua)) return 'Chrome ' + (ua.match(/Chrome\/(\d+)/) || [])[1];
    if (/Firefox\//.test(ua)) return 'Firefox ' + (ua.match(/Firefox\/(\d+)/) || [])[1];
    if (/Safari\//.test(ua)) return 'Safari ' + (ua.match(/Version\/(\d+)/) || [])[1];
    return 'Unknown';
  }

  function countFilesInTree(data) {
    if (!Array.isArray(data)) return 0;
    let count = 0;
    for (const item of data) {
      if (item.type === 'file') count++;
      else if (item.type === 'directory' && item.children) count += countFilesInTree(item.children);
    }
    return count;
  }

  function getLocalStorageUsage() {
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key) || '';
        total += key.length + val.length;
      }
    } catch (e) {}
    // 字符 -> 字节（粗略按 UTF-16 2 字节）
    return total * 2;
  }

  // ============== 分组更新 ==============

  function updateAll() {
    if (!debugState.enabled) return;
    updateEnvironment();
    updatePerformance();
    updateDocument();
    updateFileTree();
    updateSearch();
    updateTheme();
    updateApiAndCache();
    updateCacheAndSW();
  }

  function updateEnvironment() {
    setText('dbgBrowser', detectBrowser());
    setText('dbgViewport', `${window.innerWidth} × ${window.innerHeight} @${window.devicePixelRatio || 1}x`);
    setText('dbgOnline', navigator.onLine ? '在线' : '离线');
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    setText('dbgConn', conn ? (conn.effectiveType || '-') : '-');
    setText('dbgPlatform', navigator.platform || '-');
    setText('dbgLang', navigator.language || '-');
  }

  function updatePerformance() {
    setText('dbgFirstScreen', formatMs(performance.now() - debugState.startTime));

    const t = performance.timing;
    if (t && t.navigationStart > 0) {
      const domReady = t.domContentLoadedEventEnd - t.navigationStart;
      const load = t.loadEventEnd - t.navigationStart;
      const ttfb = t.responseStart - t.navigationStart;
      setText('dbgDomReady', domReady > 0 ? formatMs(domReady) : '-');
      setText('dbgLoad', load > 0 ? formatMs(load) : '-');
      setText('dbgTtfb', ttfb > 0 ? formatMs(ttfb) : '-');
    }

    setText('dbgFcp', debugState.fcpTime != null ? formatMs(debugState.fcpTime) : '-');

    // 内存（仅 Chrome）
    if (performance.memory) {
      setText('dbgMemJs', formatBytes(performance.memory.usedJSHeapSize));
      setText('dbgMemTotal', formatBytes(performance.memory.totalJSHeapSize));
      setText('dbgMemLimit', formatBytes(performance.memory.jsHeapSizeLimit));
    } else {
      setText('dbgMemJs', 'N/A');
      setText('dbgMemTotal', 'N/A');
      setText('dbgMemLimit', 'N/A');
    }
  }

  function updateDocument() {
    const state = window.MarkdownPreview.state;
    const path = state && state.currentFilePath;
    setText('dbgDocPath', path || '(未加载)');

    const stats = state && state.lastDocStats;
    if (stats) {
      setText('dbgDocSourceSize', formatBytes(stats.sourceLength));
      setText('dbgDocHtmlSize', formatBytes(stats.htmlLength));
      setText('dbgDocRenderMs', formatMs(stats.renderMs));
    } else {
      setText('dbgDocSourceSize', '-');
      setText('dbgDocHtmlSize', '-');
      setText('dbgDocRenderMs', '-');
    }

    // DOM 统计
    const body = document.querySelector('.markdown-body');
    if (body) {
      const headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
      const images = body.querySelectorAll('img').length;
      const codeBlocks = body.querySelectorAll('pre.code-block').length;
      const tables = body.querySelectorAll('table').length;
      const links = body.querySelectorAll('a[href]').length;
      setText('dbgHeadings', headings);
      setText('dbgImages', images);
      setText('dbgCodeBlocks', codeBlocks);
      setText('dbgTables', tables);
      setText('dbgLinks', links);
    } else {
      ['dbgHeadings', 'dbgImages', 'dbgCodeBlocks', 'dbgTables', 'dbgLinks'].forEach(id => setText(id, '-'));
    }

    // Frontmatter
    const fm = state && state.currentFrontmatter;
    setText('dbgFrontmatter', fm && Object.keys(fm).length > 0 ? Object.keys(fm).join(', ') : '无');
  }

  function updateFileTree() {
    const state = window.MarkdownPreview.state;
    const total = countFilesInTree(state && state.fileTreeData);
    setText('dbgFileTotal', total);
    setText('dbgFileSource', state && state.fileTreeSource ? state.fileTreeSource : '-');
  }

  function updateSearch() {
    const state = window.MarkdownPreview.state;
    const stats = state && state.searchIndexStats;
    if (stats) {
      setText('dbgSearchSource', stats.source);
      setText('dbgSearchEntries', stats.entries);
    } else {
      setText('dbgSearchSource', '-');
      setText('dbgSearchEntries', '-');
    }
    setText('dbgSearchEngine', typeof FlexSearch !== 'undefined' ? 'FlexSearch' : 'simple');
  }

  function updateTheme() {
    const theme = localStorage.getItem('md-preview-theme') || 'default';
    setText('dbgTheme', theme);

    // 自定义色数
    try {
      const settingsStr = localStorage.getItem('md-preview-settings');
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      const customColors = settings.customColors || {};
      const colorCount = Object.keys(customColors).filter(k => customColors[k]).length;
      setText('dbgCustomColors', colorCount);
    } catch (e) {
      setText('dbgCustomColors', '-');
    }

    setText('dbgCustomCSS', localStorage.getItem('md-preview-custom-css') ? '是' : '否');
    setText('dbgCustomHljs', localStorage.getItem('md-preview-custom-hljs') ? '是' : '否');
    setText('dbgCodeTheme', (localStorage.getItem('md-preview-settings') && JSON.parse(localStorage.getItem('md-preview-settings')).codeTheme) || 'github');
  }

  function updateApiAndCache() {
    setText('dbgApiCalls', debugState.apiCalls + ' 次');
    setText('dbgCacheHits', debugState.cacheHits + ' / ' + debugState.apiCalls);
  }

  function updateCacheAndSW() {
    setText('dbgLocalStorage', formatBytes(getLocalStorageUsage()));

    // Service Worker 状态
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setText('dbgSW', navigator.serviceWorker.controller.state);
    } else if ('serviceWorker' in navigator) {
      setText('dbgSW', '未注册');
    } else {
      setText('dbgSW', '不支持');
    }
  }

  // 兼容旧 API
  function updateRenderTime() {
    updatePerformance();
  }

  window.MarkdownPreview.debug = {
    init: initDebug,
    incrementApiCalls,
    incrementCacheHits,
    updateRenderTime,
    updateAll
  };
})();
