(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 按需加载 vendor 脚本/样式（带去重缓存） ==============
  // 首屏不再 defer 加载重型库，改由各渲染器在真正需要时调用
  window.MarkdownPreview._scriptCache = window.MarkdownPreview._scriptCache || {};
  window.MarkdownPreview._styleCache = window.MarkdownPreview._styleCache || {};

  window.MarkdownPreview.loadScript = function(src) {
    const cache = window.MarkdownPreview._scriptCache;
    if (cache[src]) return cache[src];
    // 已经存在同名 <script>（例如历史遗留标签）则复用
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing && existing.dataset.loaded === '1') {
      cache[src] = Promise.resolve();
      return cache[src];
    }
    cache[src] = new Promise((resolve, reject) => {
      if (existing) {
        existing.addEventListener('load', () => { existing.dataset.loaded = '1'; resolve(); });
        existing.addEventListener('error', () => { delete cache[src]; reject(new Error('Failed to load ' + src)); });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => { delete cache[src]; s.remove(); reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
    return cache[src];
  };

  window.MarkdownPreview.loadStyle = function(href) {
    const cache = window.MarkdownPreview._styleCache;
    if (cache[href]) return cache[href];
    if (document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) {
      cache[href] = Promise.resolve();
      return cache[href];
    }
    cache[href] = new Promise((resolve, reject) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = () => resolve();
      l.onerror = () => { delete cache[href]; l.remove(); reject(new Error('Failed to load ' + href)); };
      document.head.appendChild(l);
    });
    return cache[href];
  };

  window.MarkdownPreview.dom = {
    fileTree: document.getElementById('fileTree'),
    markdownContent: document.getElementById('markdownContent'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    progressBar: document.getElementById('progressBar'),
    readingProgressBar: document.querySelector('.reading-progress-bar'),
    modeFiles: document.getElementById('modeFiles'),
    modeIndex: document.getElementById('modeIndex'),
    indexTree: document.getElementById('indexTree'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    pageHeader: document.getElementById('pageHeader'),
    pageBreadcrumbs: document.getElementById('pageBreadcrumbs'),
    editPageBtn: document.getElementById('editPageBtn'),
    floatingMenu: document.getElementById('floatingMenu'),
    menuTrigger: document.getElementById('menuTrigger'),
    menuItems: document.querySelector('.menu-items'),
    backToTopBtn: document.getElementById('backToTopBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    showReadingProgressToggle: document.getElementById('showReadingProgressToggle')
  };
})();
