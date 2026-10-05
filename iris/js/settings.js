(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  const STORAGE_KEY = 'md-preview-settings';
  const REMOTE_FONT_STYLE_ID = 'remote-font-stylesheet';

  // i18n 文案读取：i18n 模块未加载或语言包缺 key 时回退到内置中文
  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  const defaultSettings = {
    showReadingProgress: true,
    showWordCount: false,
    truncateFileNames: true,
    codeTheme: 'github',
    customColors: {},
    fontConfig: {},
    sidebarOpen: false,
    contentWidth: 720,
    contentFullWidth: false,
    tableBleed: false,
    sansHeadingDigits: false,
    mobileGestures: true,
    sectionCollapse: true,
    splitSyncScroll: true,
    focusMode: false
  };

  // 内容区宽度范围（与设置面板滑杆一致）
  const CONTENT_WIDTH_MIN = 600;
  const CONTENT_WIDTH_MAX = 1400;
  const CONTENT_WIDTH_DEFAULT = 720;

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

  // 字体默认值（与 base.css / markdown.css :root 保持一致）
  const defaultFontConfig = {
    remoteFontUrl: '',
    fontFamilyDisplay: "'Cormorant Garamond', Georgia, serif",
    fontFamilyBody: "'IBM Plex Sans', -apple-system, sans-serif",
    fontSizeBody: 16,
    fontSizeMd: 18,
    fontSizeH1: 36,   // 2.25rem → 约 36px (base 16)
    fontSizeH2: 28,   // 1.75rem → 28px
    fontSizeH3: 22,   // 1.375rem → 22px
    fontWeightBody: '400',
    fontWeightMd: '400',
    fontWeightDisplay: '400',
    fontWeightH1: '600',
    fontWeightH2: '600',
    fontWeightH3: '600'
  };

  // 取色器分组：强调色 / 中性色。glow 是 rgba，需特殊处理
  const colorGroups = {
    accent: ['--color-accent-purple', '--color-accent-pink', '--color-accent-purple-deep'],
    neutral: ['--color-bg', '--color-surface', '--color-border', '--color-text', '--color-text-muted']
  };

  // settings → fontConfig 读取，合并默认值
  function normalizeFontConfig(cfg) {
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    const out = {};
    Object.keys(defaultFontConfig).forEach(k => {
      out[k] = cfg[k] != null ? cfg[k] : defaultFontConfig[k];
    });
    return out;
  }

  function normalizeContentWidth(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return CONTENT_WIDTH_DEFAULT;
    return Math.min(CONTENT_WIDTH_MAX, Math.max(CONTENT_WIDTH_MIN, Math.round(n)));
  }

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
          customColors: (parsed.customColors && typeof parsed.customColors === 'object') ? parsed.customColors : {},
          fontConfig: normalizeFontConfig(parsed.fontConfig),
          sidebarOpen: parsed.sidebarOpen === true,
          contentWidth: normalizeContentWidth(parsed.contentWidth ?? defaultSettings.contentWidth),
          contentFullWidth: parsed.contentFullWidth === true,
          tableBleed: parsed.tableBleed === true,
          sansHeadingDigits: parsed.sansHeadingDigits === true,
          mobileGestures: parsed.mobileGestures !== false,
          sectionCollapse: parsed.sectionCollapse !== false,
          splitSyncScroll: parsed.splitSyncScroll !== false,
          focusMode: parsed.focusMode === true
        };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return {
      ...defaultSettings,
      fontConfig: normalizeFontConfig(defaultFontConfig)
    };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
    // 多标签页同步：设置变化广播给其他标签页（sync-tabs.js）
    if (window.MarkdownPreview.syncTabs) {
      window.MarkdownPreview.syncTabs.post({ type: 'settings', settings });
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

    // ---------- 悬浮球交互 ----------
    // 桌面端鼠标掠过即展开；触屏无 hover，点击仍可直接开关。
    // 展开延迟 100ms：过滤无意飞掠，又接近即时响应。
    // 收回区分两种情况：
    //   掠过（未在展开菜单内停留）→ 离开 0.4s 后快速收回；
    //   停留过（进入展开菜单 ≥0.4s，视为有意使用）→ 离开后不快速收回，
    //   保持展开，直到点击外部 / 滚动页面 / Esc / 选中菜单项。
    const OPEN_DELAY = 100;
    const CLOSE_DELAY = 400;
    const DWELL_DELAY = 400;
    let openTimer = null;
    let closeTimer = null;
    let dwellTimer = null;
    let dwelled = false;

    const clearTimers = () => { clearTimeout(openTimer); clearTimeout(closeTimer); };
    const openMenu = () => {
      clearTimers();
      dwelled = false;
      menuItems.classList.add('open');
      menuTrigger.classList.add('active');
    };
    const closeMenu = () => {
      clearTimers();
      clearTimeout(dwellTimer);
      dwelled = false;
      menuItems.classList.remove('open');
      menuTrigger.classList.remove('active');
    };

    menuTrigger.addEventListener('mouseenter', () => {
      clearTimeout(closeTimer);
      openTimer = setTimeout(openMenu, OPEN_DELAY);
    });
    // 绑在整个浮层容器上：球 ↔ 菜单项之间移动不会触发离开
    floatingMenu.addEventListener('mouseleave', () => {
      clearTimeout(openTimer);
      // 停留过则不排定自动收回；未停留（掠过）才快速收回
      if (!dwelled) closeTimer = setTimeout(closeMenu, CLOSE_DELAY);
    });
    floatingMenu.addEventListener('mouseenter', () => clearTimeout(closeTimer));

    // 停留检测：进入展开菜单 DWELL_DELAY 后标记为有意使用
    menuItems.addEventListener('mouseenter', () => {
      if (!menuItems.classList.contains('open')) return;
      dwellTimer = setTimeout(() => { dwelled = true; }, DWELL_DELAY);
    });
    menuItems.addEventListener('mouseleave', () => clearTimeout(dwellTimer));

    // 停留后保持展开的关闭途径：点击外部 / 滚动 / Esc
    document.addEventListener('click', (e) => {
      if (menuItems.classList.contains('open') && !floatingMenu.contains(e.target)) closeMenu();
    });
    window.addEventListener('scroll', () => {
      if (menuItems.classList.contains('open') && dwelled) closeMenu();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuItems.classList.contains('open')) closeMenu();
    });

    menuTrigger.addEventListener('click', () => {
      if (menuItems.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    backToTopBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      menuItems.classList.remove('open');
      menuTrigger.classList.remove('active');
    });

    // 打开本地文件：先弹出选择面板（文件 / 文件夹），由面板按钮触发对应选择器
    // （浏览器原生对话框无法同时选择文件与文件夹，故在面板内二选一）
    const openLocalBtn = document.getElementById('openLocalBtn');
    const localPickOverlay = document.getElementById('localPickOverlay');
    const pickLocalFilesBtn = document.getElementById('pickLocalFilesBtn');
    const pickLocalFolderBtn = document.getElementById('pickLocalFolderBtn');
    const localPickCloseBtn = document.getElementById('localPickCloseBtn');
    const localMdInput = document.getElementById('localMdInput');
    const closeLocalPick = () => {
      localPickOverlay.classList.remove('open');
      localPickOverlay.setAttribute('aria-hidden', 'true');
    };
    openLocalBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      localPickOverlay.classList.add('open');
      localPickOverlay.setAttribute('aria-hidden', 'false');
      menuItems.classList.remove('open');
      menuTrigger.classList.remove('active');
    });
    localPickOverlay?.addEventListener('click', (e) => {
      if (e.target === localPickOverlay) closeLocalPick();
    });
    localPickCloseBtn?.addEventListener('click', closeLocalPick);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && localPickOverlay.classList.contains('open')) {
        e.stopPropagation();
        closeLocalPick();
      }
    }, true);
    pickLocalFilesBtn?.addEventListener('click', () => {
      closeLocalPick();
      if (!localMdInput) return;
      // 必须在用户手势同步上下文中触发文件选择器
      localMdInput.click();
    });
    pickLocalFolderBtn?.addEventListener('click', () => {
      closeLocalPick();
      const localDocs = window.MarkdownPreview.localDocs;
      if (localDocs && localDocs.openLocalFolder) {
        // showDirectoryPicker 必须在用户手势同步上下文中调用
        localDocs.openLocalFolder();
      }
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

    // 内容区宽度：滑杆 / 全宽开关 / 重置
    const contentWidthRange = document.getElementById('contentWidthRange');
    const contentFullWidthToggle = document.getElementById('contentFullWidthToggle');
    const resetContentWidthBtn = document.getElementById('resetContentWidthBtn');

    contentWidthRange?.addEventListener('input', (e) => {
      const settings = loadSettings();
      settings.contentWidth = normalizeContentWidth(e.target.value);
      saveSettings(settings);
      applyContentWidthSettings(settings);
      syncContentWidthControls(settings);
    });

    contentFullWidthToggle?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.contentFullWidth = e.target.checked;
      saveSettings(settings);
      applyContentWidthSettings(settings);
      syncContentWidthControls(settings);
    });

    // 长表格右侧越界
    document.getElementById('tableBleedToggle')?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.tableBleed = e.target.checked;
      saveSettings(settings);
      applyTableBleed(settings.tableBleed);
    });

    // 标题数字无衬线
    document.getElementById('sansHeadingDigitsToggle')?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.sansHeadingDigits = e.target.checked;
      saveSettings(settings);
      applySansHeadingDigits(settings.sansHeadingDigits);
    });

    // 移动端手势（左右滑翻页 / 左缘右滑呼出侧边栏）
    document.getElementById('mobileGesturesToggle')?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.mobileGestures = e.target.checked;
      saveSettings(settings);
    });

    // 章节折叠（section-collapse.js 读取；关闭时清掉现有折叠态）
    document.getElementById('sectionCollapseToggle')?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.sectionCollapse = e.target.checked;
      saveSettings(settings);
      if (!e.target.checked && window.MarkdownPreview.sectionCollapse) {
        window.MarkdownPreview.sectionCollapse.clearAll();
      } else if (e.target.checked && window.MarkdownPreview.sectionCollapse) {
        window.MarkdownPreview.sectionCollapse.onDocRendered(loadSettings() && window.MarkdownPreview.state.currentFilePath);
      }
    });

    // 专注模式（focus-mode.js：当前段落高亮、其余淡化）
    document.getElementById('focusModeToggle')?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.focusMode = e.target.checked;
      saveSettings(settings);
      applyFocusMode(settings.focusMode);
    });

    // 对照阅读默认同步滚动（split-view.js 打开时读取；开着时即时生效）
    document.getElementById('splitSyncScrollToggle')?.addEventListener('change', (e) => {
      const settings = loadSettings();
      settings.splitSyncScroll = e.target.checked;
      saveSettings(settings);
      if (window.MarkdownPreview.splitView && window.MarkdownPreview.splitView.isOpen()) {
        window.MarkdownPreview.splitView.setSyncEnabled(e.target.checked);
      }
    });

    resetContentWidthBtn?.addEventListener('click', () => {
      resetContentWidth();
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

    // 字体自定义
    bindFontControls();
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

  // ---------- 远程字体加载（Google Fonts 等 CSS URL）----------
  function applyRemoteFont(url) {
    const existing = document.getElementById(REMOTE_FONT_STYLE_ID);
    if (existing) existing.remove();
    const trimmed = (url || '').trim();
    if (!trimmed) return;
    const link = document.createElement('link');
    link.id = REMOTE_FONT_STYLE_ID;
    link.rel = 'stylesheet';
    link.href = trimmed;
    link.onerror = () => console.warn('[font] Remote font CSS failed to load:', trimmed);
    document.head.appendChild(link);
  }

  // 应用字体配置到 :root / body
  function applyFontConfig(fontCfg) {
    const cfg = normalizeFontConfig(fontCfg || {});
    const root = document.documentElement;

    // 1) 远程字体 CSS
    applyRemoteFont(cfg.remoteFontUrl);

    // 2) font-family
    if (cfg.fontFamilyDisplay) root.style.setProperty('--font-display', cfg.fontFamilyDisplay);
    else root.style.removeProperty('--font-display');
    if (cfg.fontFamilyBody) root.style.setProperty('--font-body', cfg.fontFamilyBody);
    else root.style.removeProperty('--font-body');

    // 3) font-size（带 px 单位，H1~H3 直接 px 绝对尺寸，避免受 body 字号放大再缩放）
    setPxProp(root, '--font-size-body', cfg.fontSizeBody);
    setPxProp(root, '--font-size-md', cfg.fontSizeMd);
    setPxProp(root, '--font-size-h1', cfg.fontSizeH1);
    setPxProp(root, '--font-size-h2', cfg.fontSizeH2);
    setPxProp(root, '--font-size-h3', cfg.fontSizeH3);

    // 4) font-weight
    setProp(root, '--font-weight-body', cfg.fontWeightBody);
    setProp(root, '--font-weight-md', cfg.fontWeightMd);
    setProp(root, '--font-weight-display', cfg.fontWeightDisplay);
    setProp(root, '--font-weight-h1', cfg.fontWeightH1);
    setProp(root, '--font-weight-h2', cfg.fontWeightH2);
    setProp(root, '--font-weight-h3', cfg.fontWeightH3);
  }

  function setPxProp(root, varName, val) {
    const n = Number(val);
    if (Number.isFinite(n) && n > 0) {
      root.style.setProperty(varName, `${n}px`);
    } else {
      root.style.removeProperty(varName);
    }
  }
  function setProp(root, varName, val) {
    if (val != null && val !== '') {
      root.style.setProperty(varName, String(val));
    } else {
      root.style.removeProperty(varName);
    }
  }

  // 重置字体为默认值
  function resetFontConfig() {
    const settings = loadSettings();
    settings.fontConfig = normalizeFontConfig(defaultFontConfig);
    saveSettings(settings);
    applyFontConfig(settings.fontConfig);
    // 同步 UI
    populateFontControls(settings.fontConfig);
  }

  // 把字体配置值回填到 UI
  function populateFontControls(cfg) {
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = (v ?? '');
    };
    setVal('remoteFontUrl', cfg.remoteFontUrl || '');
    setVal('fontFamilyDisplay', cfg.fontFamilyDisplay || '');
    setVal('fontFamilyBody', cfg.fontFamilyBody || '');
    setVal('fontSizeBody', cfg.fontSizeBody);
    setVal('fontSizeMd', cfg.fontSizeMd);
    setVal('fontSizeH1', cfg.fontSizeH1);
    setVal('fontSizeH2', cfg.fontSizeH2);
    setVal('fontSizeH3', cfg.fontSizeH3);
    setVal('fontWeightBody', cfg.fontWeightBody);
    setVal('fontWeightMd', cfg.fontWeightMd);
    setVal('fontWeightDisplay', cfg.fontWeightDisplay);
    setVal('fontWeightH1', cfg.fontWeightH1);
    setVal('fontWeightH2', cfg.fontWeightH2);
    setVal('fontWeightH3', cfg.fontWeightH3);
  }

  // 绑定字体 UI 到设置
  function bindFontControls() {
    const settings = loadSettings();
    populateFontControls(settings.fontConfig);

    const updateFont = (patch) => {
      const s = loadSettings();
      s.fontConfig = normalizeFontConfig({ ...s.fontConfig, ...patch });
      saveSettings(s);
      applyFontConfig(s.fontConfig);
    };

    // 文本类：回车或失焦保存
    ['remoteFontUrl', 'fontFamilyDisplay', 'fontFamilyBody'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const commit = () => updateFont({ [id]: el.value });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
      el.addEventListener('blur', commit);
    });

    // 字号 / 字重：变化即实时保存
    ['fontSizeBody', 'fontSizeMd', 'fontSizeH1', 'fontSizeH2', 'fontSizeH3'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => updateFont({ [id]: el.value }));
    });
    ['fontWeightBody', 'fontWeightMd', 'fontWeightDisplay',
     'fontWeightH1', 'fontWeightH2', 'fontWeightH3'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => updateFont({ [id]: el.value }));
    });

    // 重置按钮
    document.getElementById('resetFontBtn')?.addEventListener('click', resetFontConfig);
  }

  function openSettingsPanel() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
      settingsOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    // 打开面板时刷新存储管理区块（用量 / 笔记本 / 浏览数据）
    window.MarkdownPreview.storageManager?.refresh?.();
  }

  function closeSettingsPanel() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (settingsOverlay) {
      settingsOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  // 快捷键入口：设置面板开关（Ctrl/⌘+,）
  function toggleSettingsPanel() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    if (!settingsOverlay) return;
    if (settingsOverlay.classList.contains('open')) {
      closeSettingsPanel();
    } else {
      openSettingsPanel();
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
    window.MarkdownPreview?.localDocs?.refresh();
  }

  function toggleTruncateFileNames(truncate) {
    if (window.MarkdownPreview?.fileTree?.setTruncateNames) {
      window.MarkdownPreview.fileTree.setTruncateNames(truncate);
    }
    window.MarkdownPreview?.localDocs?.refresh();
  }

  // ---------- 侧边栏折叠状态（桌面端）----------
  // file-tree.js 的按钮/快捷键负责切换并持久化（sidebarOpen，默认收起，
  // 用户展开后记住）；这里只在启动时恢复
  function applySidebarState(open) {
    document.body.classList.toggle('sidebar-collapsed', open !== true);
  }

  // ---------- 内容区宽度 ----------
  function applyContentWidthSettings(settings) {
    document.body.classList.toggle('content-full-width', settings.contentFullWidth === true);
    const root = document.documentElement;
    if (settings.contentFullWidth) return; // 全宽模式忽略滑杆值
    root.style.setProperty('--content-width', `${settings.contentWidth}px`);
  }

  // 双栏对照期间的临时宽度：只改实时样式、不写入用户设置。
  // 进入时套默认 720（非默认宽度下分栏正文会越过分栏边界），退出恢复已保存值
  function applyTempContentWidth(width) {
    applyContentWidthSettings({ ...loadSettings(), contentFullWidth: false, contentWidth: normalizeContentWidth(width) });
  }

  function restoreContentWidth() {
    applyContentWidthSettings(loadSettings());
  }

  // 把宽度配置回填到设置面板控件
  function syncContentWidthControls(settings) {
    const range = document.getElementById('contentWidthRange');
    const value = document.getElementById('contentWidthValue');
    const fullToggle = document.getElementById('contentFullWidthToggle');
    if (range) {
      range.value = settings.contentWidth;
      range.disabled = settings.contentFullWidth === true;
    }
    if (value) value.textContent = `${settings.contentWidth}px`;
    if (fullToggle) fullToggle.checked = settings.contentFullWidth === true;
  }

  // 快捷键入口：宽度微调（Ctrl/⌘+Alt + = / -），步进 20px；
  // 全宽模式下第一次微调会先退出全宽，从当前滑杆值起调
  function nudgeContentWidth(delta) {
    const settings = loadSettings();
    settings.contentFullWidth = false;
    const base = Number(settings.contentWidth) || CONTENT_WIDTH_DEFAULT;
    settings.contentWidth = normalizeContentWidth(base + delta);
    saveSettings(settings);
    applyContentWidthSettings(settings);
    syncContentWidthControls(settings);
  }

  function resetContentWidth() {
    const settings = loadSettings();
    settings.contentWidth = CONTENT_WIDTH_DEFAULT;
    saveSettings(settings);
    applyContentWidthSettings(settings);
    syncContentWidthControls(settings);
  }

  // 快捷键入口：全宽开关（Ctrl/⌘+Alt+F）
  function toggleContentFullWidth() {
    const settings = loadSettings();
    settings.contentFullWidth = !settings.contentFullWidth;
    saveSettings(settings);
    applyContentWidthSettings(settings);
    syncContentWidthControls(settings);
  }

  // ---------- 长表格右侧越界 ----------
  // 内容宽度设置不变：把正文右缘到窗口边缘的空白量写入 --table-bleed-x，
  // .table-wrapper 借它向右延伸（见 markdown.css）。侧边栏开合、窗口缩放、
  // 宽度设置变化都会改变右缘位置，用 ResizeObserver + resize 跟随。
  let tableBleedRO = null;

  function updateTableBleedVar() {
    const content = document.getElementById('markdownContent');
    if (!content) return;
    const rect = content.getBoundingClientRect();
    // 表格容器受正文内边距约束，右缘 = 边界盒右缘 - 内边距；再留 16px 呼吸位
    const padRight = parseFloat(getComputedStyle(content).paddingRight) || 0;
    const bleed = Math.max(0, Math.round(window.innerWidth - (rect.right - padRight) - 16));
    document.documentElement.style.setProperty('--table-bleed-x', `${bleed}px`);
  }

  function applyTableBleed(enabled) {
    document.body.classList.toggle('table-bleed', enabled === true);
    const root = document.documentElement;
    if (enabled !== true) {
      root.style.removeProperty('--table-bleed-x');
      if (tableBleedRO) { tableBleedRO.disconnect(); tableBleedRO = null; }
      window.removeEventListener('resize', updateTableBleedVar);
      return;
    }
    if (!tableBleedRO) {
      tableBleedRO = new ResizeObserver(updateTableBleedVar);
      // 侧边栏开合只平移固定宽度的正文，不改变其尺寸——
      // 还要观察会随之变宽窄的 .main-content 才能感知右缘移动
      const content = document.getElementById('markdownContent');
      const mainContent = document.querySelector('.main-content');
      if (content) tableBleedRO.observe(content);
      if (mainContent) tableBleedRO.observe(mainContent);
      if (!content && !mainContent) tableBleedRO.observe(document.body);
    }
    window.addEventListener('resize', updateTableBleedVar);
    updateTableBleedVar();
  }

  // ---------- 标题数字无衬线 ----------
  // 数字字形由 CSS 的 @font-face + unicode-range 提供（见 markdown.css），
  // 这里只负责开关 body class。默认关闭：数字随标题字体（衬线体）
  function applySansHeadingDigits(enabled) {
    document.body.classList.toggle('sans-heading-digits', enabled === true);
  }
  
  function downloadCurrentFile() {
    const { state } = window.MarkdownPreview;

    // 本地打开的 MD：直接下载内存中的原文，不走 fetch
    const local = state.localDoc;
    if (local && typeof local.content === 'string') {
      const baseName = (local.name || 'document').replace(/\.md$/i, '');
      const blob = new Blob([local.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    const currentPath = state.currentFilePath;
    if (!currentPath) {
      alert(t('export.needDoc', '请先打开一个文档'));
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
      alert(t('export.downloadFailed', '下载失败，请重试'));
    }
  }
  
  function initDownloadButtons() {
    const downloadMdBtn = document.getElementById('downloadMdBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const downloadHtmlBtn = document.getElementById('downloadHtmlBtn');
    const openEditorBtn = document.getElementById('openEditorBtn');
    const openPulseGenBtn = document.getElementById('openPulseGenBtn');
    const cacheAllBtn = document.getElementById('cacheAllBtn');
    const offlineCacheDesc = document.getElementById('offlineCacheDesc');

    downloadMdBtn?.addEventListener('click', () => downloadCurrentFile());
    downloadPdfBtn?.addEventListener('click', exportPdf);
    downloadHtmlBtn?.addEventListener('click', exportStandaloneHtml);

    // 整站打包导出（export-bundle.js）：EPUB 单篇 / EPUB 合订本 / 全部 MD ZIP。
    // bundle 必须在点击时惰性获取：deferred 脚本按序执行，settings.js 的 init
    // 先于 export-bundle.js 运行，init 时模块尚未注册，捕获会产生恒 undefined
    const bundleButtons = [
      { btn: 'downloadEpubBtn', desc: 'exportEpubDesc', scope: 'doc' },
      { btn: 'downloadSiteEpubBtn', desc: 'exportSiteEpubDesc', scope: 'site' },
      { btn: 'downloadSiteMdBtn', desc: 'exportSiteMdDesc', scope: 'md' }
    ];
    bundleButtons.forEach(({ btn, desc, scope }) => {
      const btnEl = document.getElementById(btn);
      const descEl = document.getElementById(desc);
      btnEl?.addEventListener('click', async () => {
        const bundle = window.MarkdownPreview.exportBundle;
        if (!bundle || btnEl.dataset.running === '1') return;
        const defaultDesc = descEl ? descEl.textContent : '';
        btnEl.dataset.running = '1';
        btnEl.disabled = true;
        const onProgress = (done, total, label) => {
          if (!descEl) return;
          const phase = label === 'assets'
            ? t('settings.export.phaseAssets', '打包图片')
            : t('settings.export.phaseDocs', '拉取文档');
          descEl.textContent = `${phase} ${done}/${total}…`;
        };
        try {
          if (scope === 'md') await bundle.exportSiteMdZip(onProgress);
          else await bundle.exportEpub(scope, onProgress);
          if (descEl) descEl.textContent = t('settings.export.done', '已导出');
        } catch (e) {
          console.error('[settings] 导出失败:', e);
          if (descEl) descEl.textContent = t('settings.export.failed', '导出失败，请重试');
        } finally {
          btnEl.dataset.running = '';
          btnEl.disabled = false;
          setTimeout(() => { if (descEl) descEl.textContent = defaultDesc; }, 5000);
        }
      });
    });

    // 全量离线缓存：把文件树覆盖的所有 .md 拉进 SW RUNTIME_CACHE
    cacheAllBtn?.addEventListener('click', async () => {
      const offline = window.MarkdownPreview.offline;
      if (!offline) return;
      const defaultDesc = offlineCacheDesc ? offlineCacheDesc.textContent : '';
      if (!offline.swSupported()) {
        if (offlineCacheDesc) {
          offlineCacheDesc.textContent = t('settings.offline.unsupported',
            '当前环境不支持 Service Worker（需通过 HTTPS 部署访问后使用）');
        }
        return;
      }
      if (cacheAllBtn.dataset.running === '1') return;
      cacheAllBtn.dataset.running = '1';
      cacheAllBtn.disabled = true;
      const total = offline.docPaths().length;
      const onProgress = (done, all) => {
        if (offlineCacheDesc) {
          offlineCacheDesc.textContent = t('settings.offline.progress', '缓存中 {done}/{total}…')
            .replace('{done}', done).replace('{total}', all);
        }
      };
      onProgress(0, total);
      try {
        const result = await offline.cacheAll({ onProgress });
        if (offlineCacheDesc) {
          if (result.failed > 0) {
            offlineCacheDesc.textContent = t('settings.offline.doneFailed',
              '已缓存 {done} 篇文档（{failed} 篇失败）')
              .replace('{done}', result.done).replace('{failed}', result.failed);
          } else {
            offlineCacheDesc.textContent = t('settings.offline.done',
              '已缓存 {n} 篇文档，离线也能整站阅读').replace('{n}', result.done);
          }
          // 追加「清除文档缓存」入口
          const clear = document.createElement('button');
          clear.type = 'button';
          clear.className = 'download-btn';
          clear.style.marginLeft = '8px';
          clear.textContent = t('settings.offline.clear', '清除文档缓存');
          clear.addEventListener('click', async () => {
            const ok = await offline.clearDocCache();
            offlineCacheDesc.textContent = ok
              ? t('settings.offline.cleared', '已清除全部文档缓存')
              : t('settings.offline.unsupported', '当前环境不支持 Service Worker（需通过 HTTPS 部署访问后使用）');
            setTimeout(() => { offlineCacheDesc.textContent = defaultDesc; }, 2500);
          });
          offlineCacheDesc.appendChild(clear);
        }
      } catch (e) {
        console.error('[settings] 缓存全部文档失败:', e);
        if (offlineCacheDesc) offlineCacheDesc.textContent = t('settings.offline.failed', '缓存失败，请稍后重试');
      } finally {
        cacheAllBtn.dataset.running = '';
        cacheAllBtn.disabled = false;
        // 完成文案停留一段时间后恢复默认描述（清除按钮随之移除）
        setTimeout(() => {
          if (offlineCacheDesc && offlineCacheDesc.querySelector('.download-btn')) return;
          if (offlineCacheDesc) offlineCacheDesc.textContent = defaultDesc;
        }, 6000);
      }
    });

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

    // 设置导出 / 导入（含主题、语言）
    const backupExportBtn = document.getElementById('settingsExportBtn');
    const backupImportBtn = document.getElementById('settingsImportBtn');
    const backupImportInput = document.getElementById('settingsImportInput');

    backupExportBtn?.addEventListener('click', exportSettings);
    backupImportBtn?.addEventListener('click', () => backupImportInput?.click());
    backupImportInput?.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) await importSettings(file);
      e.target.value = '';
    });
  }

  // ============== 设置导出 / 导入 ==============
  // 带走外观与阅读相关的全部 localStorage 键：设置、主题（含自动配对、
  // 自定义 CSS / hljs）与界面语言。导入采用「写回后刷新」，保证主题、
  // 字体、i18n 等按启动流程重新应用，避免逐项手工同步遗漏。
  const BACKUP_KEYS = {
    settings: 'md-preview-settings',
    theme: 'md-preview-theme',
    themeLight: 'md-preview-theme-light',
    themeDark: 'md-preview-theme-dark',
    customCss: 'md-preview-custom-css',
    customHljs: 'md-preview-custom-hljs',
    lang: 'md-preview-lang'
  };

  function exportSettings() {
    const data = {};
    Object.keys(BACKUP_KEYS).forEach(name => {
      try {
        const val = localStorage.getItem(BACKUP_KEYS[name]);
        if (val != null) data[name] = val;
      } catch (e) { /* 隐私模式等场景跳过 */ }
    });
    const payload = {
      app: 'md-preview',
      type: 'settings-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'md-preview-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function validBackupLang(v) {
    return v === 'auto' || v === 'zh' || v === 'en';
  }

  async function importSettings(file) {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (e) {
      alert(t('settings.backup.invalid', '导入失败：不是有效的设置备份文件'));
      return;
    }
    if (!payload || payload.app !== 'md-preview' || payload.type !== 'settings-backup' ||
        !payload.data || typeof payload.data !== 'object') {
      alert(t('settings.backup.invalid', '导入失败：不是有效的设置备份文件'));
      return;
    }
    const data = payload.data;
    try {
      // settings 单独校验：必须是可解析的 JSON 对象
      if (typeof data.settings === 'string') JSON.parse(data.settings);
      if (data.theme != null && typeof data.theme !== 'string') throw new Error('bad theme');
      if (data.lang != null && !validBackupLang(data.lang)) throw new Error('bad lang');
      Object.keys(BACKUP_KEYS).forEach(name => {
        const val = data[name];
        if (val == null) return;
        localStorage.setItem(BACKUP_KEYS[name], String(val));
      });
    } catch (e) {
      alert(t('settings.backup.invalid', '导入失败：不是有效的设置备份文件'));
      return;
    }
    location.reload();
  }

  // 导出 PDF：通过浏览器打印对话框
  function exportPdf() {
    const { state } = window.MarkdownPreview;
    // 仓库内文档与「打开本地 MD」渲染的文档都支持打印导出
    if (!state.currentFilePath && !state.localDoc) {
      alert(t('export.needDoc', '请先打开一个文档'));
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

  // ============== 导出单文件 HTML ==============
  // 将当前渲染结果 + 站点全部本地样式 + 主题/配色/字体 CSS 变量
  // 打包成一个双击即可离线打开的独立 HTML 文件。
  // styles.css 通过 @import 引入子模块，需递归展开 CSSImportRule；
  // 跨域样式表访问 cssRules 会抛错，直接返回空
  function readSheetRules(sheet, depth) {
    if (!sheet || depth > 5) return '';
    let css = '';
    try {
      for (const rule of sheet.cssRules) {
        if (rule.styleSheet && rule.cssText.startsWith('@import')) {
          css += readSheetRules(rule.styleSheet, depth + 1);
        } else {
          css += rule.cssText + '\n';
        }
      }
    } catch (e) {
      return '';
    }
    return css;
  }

  function tryReadLoadedStylesheet(linkEl) {
    try {
      const sheets = Array.from(document.styleSheets);
      const sheet = sheets.find(s => s.href === linkEl.href);
      if (!sheet) return '';
      return readSheetRules(sheet, 0);
    } catch (e) {
      return '';
    }
  }

  // 把相对路径的图片/链接改写为绝对地址，导出后仍能加载远程资源；
  // 本地 MD 的图片本来就不可达，保持原样
  function absolutizeUrls(html) {
    const tpl = document.createElement('div');
    tpl.innerHTML = html;
    const base = location.href;
    tpl.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (!/^(https?:|data:|blob:|#)/i.test(src)) {
        try { img.setAttribute('src', new URL(src, base).href); } catch (e) { /* 非法路径保持原样 */ }
      }
    });
    tpl.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (!/^(https?:|data:|blob:|#|mailto:)/i.test(href)) {
        try { a.setAttribute('href', new URL(href, base).href); } catch (e) { /* 非法路径保持原样 */ }
      }
    });
    return tpl.innerHTML;
  }

  function exportStandaloneHtml() {
    const { state } = window.MarkdownPreview;
    if (!state.currentFilePath && !state.localDoc) {
      alert(t('export.needDoc', '请先打开一个文档'));
      return;
    }

    const article = document.getElementById('markdownContent');
    if (!article) return;

    // 内联全部已加载的本地样式表（iris/ 开头），跳过跨域 CDN
    const collected = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('iris/') || href.startsWith('/iris/')) {
        const cssText = tryReadLoadedStylesheet(link);
        if (cssText) collected.push(cssText);
      }
    });
    // head 里已有的内联样式块一并带走
    document.querySelectorAll('head style').forEach(styleEl => {
      const cssText = styleEl.textContent;
      if (cssText && cssText.trim()) collected.push(cssText);
    });
    // 远程字体（Google Fonts 等）无法读取 cssRules，保留外链
    const remoteFontLink = document.getElementById('remote-font-stylesheet');
    const remoteFontTag = remoteFontLink ? remoteFontLink.outerHTML : '';

    // 主题与自定义配色 / 字体都通过 <html> 上的 CSS 变量与 data-theme 生效，
    // 原样带上即可完整复刻当前外观
    const rootAttrs = [];
    const themeAttr = document.documentElement.getAttribute('data-theme');
    if (themeAttr) rootAttrs.push(` data-theme="${themeAttr}"`);
    const rootStyle = document.documentElement.getAttribute('style');
    if (rootStyle) rootAttrs.push(` style="${rootStyle.replace(/"/g, '&quot;')}"`);

    const title = (document.title || 'document').replace(/[\\/:*?"<>|]/g, '_');
    const bodyHtml = absolutizeUrls(article.innerHTML);
    const html = `<!DOCTYPE html>
<html lang="${document.documentElement.getAttribute('lang') || 'zh-CN'}"${rootAttrs.join('')}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${title}</title>
${remoteFontTag}
<style>
${collected.join('\n')}
body { margin: 0; }
</style>
</head>
<body>
<article class="markdown-body" id="markdownContent">${bodyHtml}</article>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 专注模式（focus-mode.js 提供开关与滚动跟踪）
  function applyFocusMode(on) {
    if (window.MarkdownPreview.focusMode) {
      window.MarkdownPreview.focusMode.applyPersisted(on);
    }
  }

  // 应用全部设置到界面（init 与远端标签页同步共用）
  function applyAllSettings(settings) {
    toggleReadingProgress(settings.showReadingProgress);
    toggleWordCount(settings.showWordCount);
    toggleTruncateFileNames(settings.truncateFileNames);
    applyCodeTheme(settings.codeTheme);
    applyCustomColors(settings.customColors || {});
    applyFontConfig(settings.fontConfig || defaultFontConfig);
    applySidebarState(settings.sidebarOpen);
    applyContentWidthSettings(settings);
    syncContentWidthControls(settings);
    applyTableBleed(settings.tableBleed);
    applySansHeadingDigits(settings.sansHeadingDigits);
    applyFocusMode(settings.focusMode);

    const showReadingProgressToggle = document.getElementById('showReadingProgressToggle');
    const showWordCountToggle = document.getElementById('showWordCountToggle');
    const truncateFileNamesToggle = document.getElementById('truncateFileNamesToggle');
    const codeThemeSelect = document.getElementById('codeThemeSelect');
    const tableBleedToggle = document.getElementById('tableBleedToggle');
    const sansHeadingDigitsToggle = document.getElementById('sansHeadingDigitsToggle');
    const mobileGesturesToggle = document.getElementById('mobileGesturesToggle');
    const focusModeToggle = document.getElementById('focusModeToggle');

    if (showReadingProgressToggle) showReadingProgressToggle.checked = settings.showReadingProgress;
    if (showWordCountToggle) showWordCountToggle.checked = settings.showWordCount;
    if (truncateFileNamesToggle) truncateFileNamesToggle.checked = settings.truncateFileNames !== false;
    if (codeThemeSelect) codeThemeSelect.value = settings.codeTheme;
    if (tableBleedToggle) tableBleedToggle.checked = settings.tableBleed === true;
    if (sansHeadingDigitsToggle) sansHeadingDigitsToggle.checked = settings.sansHeadingDigits === true;
    if (mobileGesturesToggle) mobileGesturesToggle.checked = settings.mobileGestures !== false;
    const sectionCollapseToggle = document.getElementById('sectionCollapseToggle');
    if (sectionCollapseToggle) sectionCollapseToggle.checked = settings.sectionCollapse !== false;
    const splitSyncScrollToggle = document.getElementById('splitSyncScrollToggle');
    if (splitSyncScrollToggle) splitSyncScrollToggle.checked = settings.splitSyncScroll !== false;
    if (focusModeToggle) focusModeToggle.checked = settings.focusMode === true;

    // 取色器显示：有自定义值用自定义值，否则显示默认色
    document.querySelectorAll('input[type="color"][data-var]').forEach(input => {
      const varName = input.dataset.var;
      const custom = settings.customColors && settings.customColors[varName];
      input.value = custom || defaultColors[varName];
    });
  }

  // 远端标签页推送的设置：写入本地后整体应用（sync-tabs.js 调用）
  function applyRemoteSettings(remote) {
    if (!remote || typeof remote !== 'object') return;
    // 远端为全量 settings 快照：直接采用并回写
    saveSettings(remote);
    applyAllSettings(remote);
  }

  function init() {
    const settings = loadSettings();
    initFloatingMenu();
    initSettingsPanel();
    initDownloadButtons();
    applyAllSettings(settings);
  }

  window.MarkdownPreview.settings = {
    load: loadSettings,
    save: saveSettings,
    applyAll: applyAllSettings,
    applyRemote: applyRemoteSettings,
    applyTempContentWidth,
    restoreContentWidth,
    open: openSettingsPanel,
    close: closeSettingsPanel,
    toggle: toggleSettingsPanel,
    nudgeContentWidth: nudgeContentWidth,
    resetContentWidth: resetContentWidth,
    toggleContentFullWidth: toggleContentFullWidth,
    resetCustomColors: resetCustomColors,
    downloadCurrentFile: () => downloadCurrentFile(),
    exportStandaloneHtml: () => exportStandaloneHtml(),
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
