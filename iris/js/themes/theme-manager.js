// Theme Manager - 主题管理系统

(function() {
  const STORAGE_KEY = 'md-preview-theme';
  const CUSTOM_CSS_KEY = 'md-preview-custom-css';
  const CUSTOM_HLJS_KEY = 'md-preview-custom-hljs';
  const AUTO_LIGHT_KEY = 'md-preview-theme-light';
  const AUTO_DARK_KEY = 'md-preview-theme-dark';

  const VALID_THEMES = ['default', 'iris', 'github-light', 'github-dark', 'notion', 'arc', 'dracula', 'nord'];
  const DARK_THEMES = ['github-dark', 'arc', 'dracula', 'nord'];
  const LIGHT_THEMES = ['default', 'iris', 'github-light', 'notion'];
  const DEFAULT_AUTO_LIGHT = 'default';
  const DEFAULT_AUTO_DARK = 'github-dark';

  // currentTheme 是「实际生效」的主题（auto 模式下为解析结果）；
  // currentSetting 是用户的选择，可能为 'auto'
  let currentTheme = 'default';
  let currentSetting = 'default';
  let customCSSLink = null;
  let customHljsLink = null;
  let darkMedia = null;

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function getAutoPair() {
    const light = localStorage.getItem(AUTO_LIGHT_KEY);
    const dark = localStorage.getItem(AUTO_DARK_KEY);
    return {
      light: LIGHT_THEMES.includes(light) ? light : DEFAULT_AUTO_LIGHT,
      dark: DARK_THEMES.includes(dark) ? dark : DEFAULT_AUTO_DARK
    };
  }

  function setAutoPair(light, dark) {
    if (LIGHT_THEMES.includes(light)) localStorage.setItem(AUTO_LIGHT_KEY, light);
    if (DARK_THEMES.includes(dark)) localStorage.setItem(AUTO_DARK_KEY, dark);
    if (currentSetting === 'auto') {
      applyResolved(systemPrefersDark() ? getAutoPair().dark : getAutoPair().light, false);
    }
  }

  // 解析当前应生效的主题（auto 模式下按系统亮暗选配对主题）
  function resolveTheme(setting) {
    if (setting !== 'auto') return setting;
    const pair = getAutoPair();
    return systemPrefersDark() ? pair.dark : pair.light;
  }

  function applyResolved(themeId, save) {
    currentTheme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);
    // 移动端地址栏 / 系统 UI 的 theme-color 跟随主题（原本写死默认主题色）
    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta && bg) meta.setAttribute('content', bg);
    } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeId, setting: currentSetting } }));
    if (save !== false) (window.MarkdownPreview.debug?.debugLog || (() => {}))(`Theme changed to: ${themeId} (setting: ${currentSetting})`);
  }

  // 初始化主题系统
  function init() {
    // 加载保存的主题
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme === 'auto' || savedTheme && VALID_THEMES.includes(savedTheme)) {
      setTheme(savedTheme, false);
    }

    // auto 模式下监听系统亮暗变化，实时切换
    if (window.matchMedia) {
      darkMedia = window.matchMedia('(prefers-color-scheme: dark)');
      const onMediaChange = () => {
        if (currentSetting !== 'auto') return;
        applyResolved(resolveTheme('auto'), false);
      };
      if (darkMedia.addEventListener) {
        darkMedia.addEventListener('change', onMediaChange);
      } else if (darkMedia.addListener) {
        darkMedia.addListener(onMediaChange); // 旧版 Safari
      }
    }

    // 加载自定义 CSS
    loadCustomCSS();

    // 加载自定义高亮 JS 主题
    loadCustomHljs();

    // 绑定设置面板中的主题选择器
    bindSettingsPanel();
  }

  // 设置主题
  function setTheme(themeId, save = true) {
    const validSettings = VALID_THEMES.concat(['auto']);
    if (!validSettings.includes(themeId)) {
      console.warn(`Theme ${themeId} not found`);
      return;
    }

    currentSetting = themeId;
    if (save) {
      localStorage.setItem(STORAGE_KEY, themeId);
    }
    applyResolved(resolveTheme(themeId), false);
    (window.MarkdownPreview.debug?.debugLog || (() => {}))(`Theme setting: ${themeId}`);
  }

  // 获取当前实际生效的主题
  function getCurrentTheme() {
    return currentTheme;
  }

  // 获取用户的主题设置（可能是 'auto'）
  function getThemeSetting() {
    return currentSetting;
  }

  // 外链 CSS 仅接受 https: 与站内相对路径：恶意备份文件可借此注入远程
  // 样式做追踪/改写，http:/javascript:/data: 等协议一律拒绝
  function safeCssUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed; // 相对路径
    if (/^https:/i.test(trimmed)) return trimmed;
    console.warn('[theme] 外链样式仅支持 https: 或相对路径，已忽略：', trimmed);
    return '';
  }

  // 加载自定义 CSS
  function loadCustomCSS(url) {
    // 移除旧的 custom CSS
    if (customCSSLink) {
      customCSSLink.remove();
      customCSSLink = null;
    }

    if (!url) {
      // 从 localStorage 加载
      url = localStorage.getItem(CUSTOM_CSS_KEY);
    }

    url = safeCssUrl(url);
    if (url) {
      customCSSLink = document.createElement('link');
      customCSSLink.rel = 'stylesheet';
      customCSSLink.href = url;
      document.head.appendChild(customCSSLink);
      (window.MarkdownPreview.debug?.debugLog || (() => {}))(`Custom CSS loaded: ${url}`);
    }
  }

  // 设置自定义 CSS
  function setCustomCSS(url) {
    localStorage.setItem(CUSTOM_CSS_KEY, url);
    loadCustomCSS(url);
  }

  // 清除自定义 CSS
  function clearCustomCSS() {
    localStorage.removeItem(CUSTOM_CSS_KEY);
    if (customCSSLink) {
      customCSSLink.remove();
      customCSSLink = null;
    }
  }

  // 加载自定义高亮 JS 主题 CSS
  function loadCustomHljs(url) {
    // 移除旧的
    if (customHljsLink) {
      customHljsLink.remove();
      customHljsLink = null;
    }

    if (!url) {
      url = localStorage.getItem(CUSTOM_HLJS_KEY);
    }

    url = safeCssUrl(url);
    if (url) {
      customHljsLink = document.createElement('link');
      customHljsLink.rel = 'stylesheet';
      customHljsLink.href = url;
      // 插入到 hljs-theme 之后，确保覆盖内置主题
      const hljsTheme = document.getElementById('hljs-theme');
      if (hljsTheme && hljsTheme.parentNode) {
        hljsTheme.parentNode.insertBefore(customHljsLink, hljsTheme.nextSibling);
      } else {
        document.head.appendChild(customHljsLink);
      }
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('Custom hljs CSS loaded:', url);
    }
  }

  // 设置自定义高亮 JS 主题
  function setCustomHljs(url) {
    localStorage.setItem(CUSTOM_HLJS_KEY, url);
    loadCustomHljs(url);
  }

  // 清除自定义高亮 JS 主题
  function clearCustomHljs() {
    localStorage.removeItem(CUSTOM_HLJS_KEY);
    if (customHljsLink) {
      customHljsLink.remove();
      customHljsLink = null;
    }
  }

  // 绑定设置面板
  function bindSettingsPanel() {
    const themeSelect = document.getElementById('themeSelect');
    const autoPairRow = document.getElementById('autoThemePairRow');
    const autoLightSelect = document.getElementById('autoThemeLightSelect');
    const autoDarkSelect = document.getElementById('autoThemeDarkSelect');
    const customCSSInput = document.getElementById('customCSSInput');
    const customHljsInput = document.getElementById('customHljsInput');

    if (themeSelect) {
      // 设置当前值
      themeSelect.value = currentSetting;
      syncAutoPairRow(autoPairRow, currentSetting === 'auto');
      if (autoLightSelect && autoDarkSelect) {
        const pair = getAutoPair();
        autoLightSelect.value = pair.light;
        autoDarkSelect.value = pair.dark;
        autoLightSelect.addEventListener('change', () => {
          setAutoPair(autoLightSelect.value, autoDarkSelect.value);
        });
        autoDarkSelect.addEventListener('change', () => {
          setAutoPair(autoLightSelect.value, autoDarkSelect.value);
        });
      }

      // 监听变化
      themeSelect.addEventListener('change', (e) => {
        setTheme(e.target.value);
        syncAutoPairRow(autoPairRow, e.target.value === 'auto');
        // 互斥：选预设主题时清空自定义配色
        const settings = window.MarkdownPreview.settings;
        if (settings && settings.resetCustomColors) {
          settings.resetCustomColors();
        }
      });
    }

    if (customCSSInput) {
      // 设置当前值
      const savedCSS = localStorage.getItem(CUSTOM_CSS_KEY);
      if (savedCSS) {
        customCSSInput.value = savedCSS;
      }

      // 回车应用
      customCSSInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const url = e.target.value.trim();
          if (url) {
            setCustomCSS(url);
          } else {
            clearCustomCSS();
          }
        }
      });
    }

    if (customHljsInput) {
      // 设置当前值
      const savedHljs = localStorage.getItem(CUSTOM_HLJS_KEY);
      if (savedHljs) {
        customHljsInput.value = savedHljs;
      }

      // 回车应用
      customHljsInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const url = e.target.value.trim();
          if (url) {
            setCustomHljs(url);
          } else {
            clearCustomHljs();
          }
        }
      });
    }
  }

  // auto 配对子选项只在选择「自动」时显示
  function syncAutoPairRow(row, show) {
    if (row) row.hidden = !show;
  }

  // 导出到全局
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.themes = {
    init: init,
    setTheme: setTheme,
    getCurrentTheme: getCurrentTheme,
    getThemeSetting: getThemeSetting,
    setCustomCSS: setCustomCSS,
    clearCustomCSS: clearCustomCSS
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
