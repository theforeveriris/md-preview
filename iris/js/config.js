(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  
  const DEFAULT_CONFIG = {
    owner: 'theforeveriris',
    repo: 'md-preview',
    branch: 'main',
    provider: 'github',
    gitlabUrl: 'https://gitlab.com',
    projectId: '',
    title: 'Markdown Preview',
    defaultTheme: 'default',
    showEditButton: true,
    showReadingTime: true,
    showBreadcrumbs: true,
    homepage: '',
    plantumlServers: [],
    plugins: {}
  };
  
  window.MarkdownPreview.CONFIG = { ...DEFAULT_CONFIG };
  
  window.MarkdownPreview.configLoaded = false;
  window.MarkdownPreview.configLoadPromise = null;
  
  async function loadConfig() {
    try {
      const response = await fetch('iris/config.json');
      if (response.ok) {
        const externalConfig = await response.json();
        // 就地合并：部分模块在顶层解构了 CONFIG（如 markdown.js 的
        // `const { CONFIG } = window.MarkdownPreview`），若这里整体替换对象，
        // 它们会一直持有旧默认值引用，config.json 的固定参数就形同虚设。
        Object.assign(window.MarkdownPreview.CONFIG, mergeDeep(DEFAULT_CONFIG, externalConfig));
        console.log('[Config] Loaded external config.json');
      } else {
        console.log('[Config] config.json not found, using defaults');
      }
    } catch (error) {
      console.log('[Config] Failed to load config.json, using defaults:', error);
    }
    window.MarkdownPreview.configLoaded = true;
  }
  
  function mergeDeep(target, source) {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = mergeDeep(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
  
  window.MarkdownPreview.loadConfig = loadConfig;
  window.MarkdownPreview.configLoadPromise = loadConfig();
})();
