(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  const STORAGE_KEY = 'md-preview-settings';

  const defaultSettings = {
    showReadingProgress: true,
    showWordCount: false,
    truncateFileNames: true,
    codeTheme: 'github',
    customColors: {}
  };

  // 主题色默认值（与 base.css :root 保持一致）
  const defaultColors = {
    '--color-accent-purple': '#d4a5c9',
    '--color-accent-pink': '#f2c4ce',
    '--color-accent-purple-deep': '#b88aad',
    '--color-glow': 'rgba(255, 255, 255, 0.8)',
    '--color-bg': '#fafafa',
    '--color-surface': '#ffffff',
    '--color-border': '#f0f0f0',
    '--color-text': '#2d2d2d',
    '--color-text-muted': '#999999'
  };

  // 取色器分组：强调色 / 中性色。glow 是 rgba，需特殊处理
  const colorGroups = {
    accent: ['--color-accent-purple', '--color-accent-pink', '--color-accent-purple-deep'],
    neutral: ['--color-bg', '--color-surface', '--color-border', '--color-text', '--color-text-muted']
  };

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultSettings,
          showReadingProgress: parsed.showReadingProgress ?? defaultSettings.showReadingProgress,
          showWordCount: parsed.showWordCount ?? defaultSettings.showWordCount,
          truncateFileNames: parsed.truncateFileNames ?? defaultSettings.truncateFileNames,
          codeTheme: parsed.codeTheme ?? defaultSettings.codeTheme,
          customColors: (parsed.customColors && typeof parsed.customColors === 'object') ? parsed.customColors : {}
        };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return defaultSettings;
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  function initFloatingMenu() {
    const floatingMenu = document.getElementById('floatingMenu');
    const menuTrigger = document.getElementById('menuTrigger');
    const menuItems = document.querySelector('.menu-items');
    const backToTopBtn = document.getElementById('backToTopBtn');
    const openSettingsBtn = document.getElementById('openSettingsBtn');

    if (!floatingMenu || !menuTrigger || !menuItems) {
      return;
    }

    menuTrigger.addEventListener('click', () => {
      const isOpen = menuItems.classList.contains('open');
      menuItems.classList.toggle('open');
      menuTrigger.classList.toggle('active');
    });

    backToTopBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      menuItems.classList.remove('open');
      menuTrigger.classList.remove('active');
    });

    // 上一篇/下一篇：复用 file-tree.getAdjacentFiles
    const prevDocBtn = document.getElementById('prevDocBtn');
    const nextDocBtn = document.getElementById('nextDocBtn');
    const navigateDoc = (direction) => {
      const { state, fileTree, markdown } = window.MarkdownPreview;
      if (!state.currentFilePath) {
        alert('请先打开一个文档');
        return;
      }
      const { prev, next } = fileTree.getAdjacentFiles(state.currentFilePath);
      const target = direction === 'prev' ? prev : next;
      if (target) {
        markdown.loadMarkdownFile(target.path);
      } else {
        alert(direction === 'prev' ? '已经是第一篇了' : '已经是最后一篇了');
      }
      menuItems.classList.remove('open');
      menuTrigger.classList.remove('active');
    };
    prevDocBtn?.addEventListener('click', () => navigateDoc('prev'));
    nextDocBtn?.addEventListener('click', () => navigateDoc('next'));

    // 打开本地 MD 文件
    const openLocalMdBtn = document.getElementById('openLocalMdBtn');
    const localMdInput = document.getElementById('localMdInput');
    openLocalMdBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!localMdInput) return;
      // 必须在用户手势同步上下文中触发文件选择器
      localMdInput.click();
      // 延迟收起菜单，避免干扰文件选择器
      setTimeout(() => {
        menuItems.classList.remove('open');
        menuTrigger.classList.remove('active');
      }, 300);
    });
    localMdInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target.result;
        // 本地文件不写进 URL，刷新后丢失
        window.MarkdownPreview.state.currentFilePath = '';
        window.MarkdownPreview.markdown.renderMarkdownDirect(content, file.name);
      };
      reader.onerror = () => alert('读取文件失败，请重试');
      reader.readAsText(file, 'utf-8');
      // 重置 input，允许重复选择同一文件
      e.target.value = '';
    });

    openSettingsBtn?.addEventListener('click', () => {
      openSettingsPanel();
      menuItems.classList.remove('open');
      menuTrigger.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
      if (!floatingMenu.contains(e.target) && menuItems.classList.contains('open')) {
        menuItems.classList.remove('open');
        menuTrigger.classList.remove('active');
      }
    });
  }

  function initSettingsPanel() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const showReadingProgressToggle = document.getElementById('showReadingProgressToggle');
    const showWordCountToggle = document.getElementById('showWordCountToggle');
    const truncateFileNamesToggle = document.getElementById('truncateFileNamesToggle');
    const codeThemeSelect = document.getElementById('codeThemeSelect');

    if (!settingsOverlay) {
      return;
    }

    closeSettingsBtn?.addEventListener('click', () => {
      closeSettingsPanel();
    });

    settingsOverlay.addEventListener('click', (e) => {
      if (e.target === settingsOverlay) {
        closeSettingsPanel();
      }
    });

    showReadingProgressToggle?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.showReadingProgress = e.target.checked;
      saveSettings(settings);
      toggleReadingProgress(settings.showReadingProgress);
    });

    showWordCountToggle?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.showWordCount = e.target.checked;
      saveSettings(settings);
      toggleWordCount(settings.showWordCount);
    });

    truncateFileNamesToggle?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.truncateFileNames = e.target.checked;
      saveSettings(settings);
      toggleTruncateFileNames(settings.truncateFileNames);
    });

    codeThemeSelect?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.codeTheme = e.target.value;
      saveSettings(settings);
      applyCodeTheme(settings.codeTheme);
    });

    // 自定义主题色取色器
    document.querySelectorAll('input[type="color"][data-var]').forEach(input => {
      input.addEventListener('input', (e) => {
        const varName = e.target.dataset.var;
        const settings = loadSettings();
        if (!settings.customColors) settings.customColors = {};
        settings.customColors[varName] = e.target.value;
        saveSettings(settings);
        applyCustomColors(settings.customColors);
      });
    });

    const resetColorsBtn = document.getElementById('resetColorsBtn');
    resetColorsBtn?.addEventListener('click', resetCustomColors);
  }

  function applyCodeTheme(theme) {
    const link = document.getElementById('hljs-theme');
    if (link) {
      link.href = `iris/vendor/highlight.js/styles/${theme}.css`;
    }
  }

  // 应用自定义主题色到 :root，覆盖 base.css 默认值
  function applyCustomColors(colors) {
    const root = document.documentElement;
    Object.keys(defaultColors).forEach(varName => {
      const val = colors && colors[varName];
      if (val) {
        root.style.setProperty(varName, val);
      } else {
        root.style.removeProperty(varName);
      }
    });
  }

  // 重置自定义主题色，恢复 base.css 默认值
  function resetCustomColors() {
    const settings = loadSettings();
    settings.customColors = {};
    saveSettings(settings);
    applyCustomColors({});
    // 同步取色器显示为默认色
    Object.keys(defaultColors).forEach(varName => {
      const input = document.querySelector(`input[type="color"][data-var="${varName}"]`);
      if (input) input.value = defaultColors[varName];
    });
  }

  function openSettingsPanel() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
      settingsOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeSettingsPanel() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
      settingsOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function toggleReadingProgress(show) {
    const readingProgress = document.getElementById('readingProgress');
    if (readingProgress) {
      readingProgress.style.display = show ? 'block' : 'none';
    }
  }
  
  function toggleWordCount(show) {
    if (window.MarkdownPreview?.fileTree?.setWordCountVisibility) {
      window.MarkdownPreview.fileTree.setWordCountVisibility(show);
    }
  }

  function toggleTruncateFileNames(truncate) {
    if (window.MarkdownPreview?.fileTree?.setTruncateNames) {
      window.MarkdownPreview.fileTree.setTruncateNames(truncate);
    }
  }
  
  function downloadCurrentFile() {
    const { state } = window.MarkdownPreview;
    const currentPath = state.currentFilePath;
    
    if (!currentPath) {
      alert('请先打开一个文档');
      return;
    }
    
    const fileName = currentPath.split('/').pop().replace('.md', '');
    downloadMarkdown(currentPath, fileName);
  }
  
  async function downloadMarkdown(path, fileName) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const content = await response.text();
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('下载失败，请重试');
    }
  }
  
  function initDownloadButtons() {
    const downloadMdBtn = document.getElementById('downloadMdBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const openEditorBtn = document.getElementById('openEditorBtn');
    const openPulseGenBtn = document.getElementById('openPulseGenBtn');

    downloadMdBtn?.addEventListener('click', () => downloadCurrentFile());
    downloadPdfBtn?.addEventListener('click', exportPdf);
    openEditorBtn?.addEventListener('click', () => {
      closeSettingsPanel();
      if (window.MarkdownPreview?.enterEditorMode) {
        window.MarkdownPreview.enterEditorMode();
      }
    });
    openPulseGenBtn?.addEventListener('click', () => {
      closeSettingsPanel();
      if (window.MarkdownPreview?.enterPulseGen) {
        window.MarkdownPreview.enterPulseGen();
      }
    });
  }

  // 导出 PDF：通过浏览器打印对话框
  function exportPdf() {
    const { state } = window.MarkdownPreview;
    if (!state.currentFilePath) {
      alert('请先打开一个文档');
      return;
    }

    // 临时展开侧边栏折叠状态并应用打印样式
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const beforeprintHandler = () => {
      document.body.classList.add('printing');
    };
    const afterprintHandler = () => {
      document.body.classList.remove('printing');
      window.removeEventListener('beforeprint', beforeprintHandler);
      window.removeEventListener('afterprint', afterprintHandler);
    };
    window.addEventListener('beforeprint', beforeprintHandler);
    window.addEventListener('afterprint', afterprintHandler);

    // 短暂延迟确保打印样式生效
    setTimeout(() => window.print(), 50);
  }

  function init() {
    const settings = loadSettings();
    initFloatingMenu();
    initSettingsPanel();
    initDownloadButtons();
    toggleReadingProgress(settings.showReadingProgress);
    toggleWordCount(settings.showWordCount);
    toggleTruncateFileNames(settings.truncateFileNames);
    applyCodeTheme(settings.codeTheme);
    applyCustomColors(settings.customColors || {});

    const showReadingProgressToggle = document.getElementById('showReadingProgressToggle');
    const showWordCountToggle = document.getElementById('showWordCountToggle');
    const truncateFileNamesToggle = document.getElementById('truncateFileNamesToggle');
    const codeThemeSelect = document.getElementById('codeThemeSelect');

    if (showReadingProgressToggle) showReadingProgressToggle.checked = settings.showReadingProgress;
    if (showWordCountToggle) showWordCountToggle.checked = settings.showWordCount;
    if (truncateFileNamesToggle) truncateFileNamesToggle.checked = settings.truncateFileNames !== false;
    if (codeThemeSelect) codeThemeSelect.value = settings.codeTheme;

    // 取色器显示：有自定义值用自定义值，否则显示默认色
    document.querySelectorAll('input[type="color"][data-var]').forEach(input => {
      const varName = input.dataset.var;
      const custom = settings.customColors && settings.customColors[varName];
      input.value = custom || defaultColors[varName];
    });
  }

  window.MarkdownPreview.settings = {
    load: loadSettings,
    save: saveSettings,
    open: openSettingsPanel,
    close: closeSettingsPanel,
    resetCustomColors: resetCustomColors,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
