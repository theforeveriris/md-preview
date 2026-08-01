// Theme Manager - 主题管理系统

(function() {
  const STORAGE_KEY = 'md-preview-theme';
  const CUSTOM_CSS_KEY = 'md-preview-custom-css';
  const CUSTOM_HLJS_KEY = 'md-preview-custom-hljs';

  let currentTheme = 'default';
  let customCSSLink = null;
  let customHljsLink = null;

  // 初始化主题系统
  function init() {
    // 加载保存的主题
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme) {
      setTheme(savedTheme, false);
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
    const validThemes = ['default', 'github-light', 'github-dark', 'notion', 'arc', 'dracula', 'nord'];
    if (!validThemes.includes(themeId)) {
      console.warn(`Theme ${themeId} not found`);
      return;
    }

    currentTheme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);
    
    if (save) {
      localStorage.setItem(STORAGE_KEY, themeId);
    }

    // 触发主题切换事件
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeId } }));
    
    console.log(`Theme changed to: ${themeId}`);
  }

  // 获取当前主题
  function getCurrentTheme() {
    return currentTheme;
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

    if (url) {
      customCSSLink = document.createElement('link');
      customCSSLink.rel = 'stylesheet';
      customCSSLink.href = url;
      document.head.appendChild(customCSSLink);
      console.log(`Custom CSS loaded: ${url}`);
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
      console.log('Custom hljs CSS loaded:', url);
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
    const customCSSInput = document.getElementById('customCSSInput');
    const customHljsInput = document.getElementById('customHljsInput');

    if (themeSelect) {
      // 设置当前值
      themeSelect.value = currentTheme;

      // 监听变化
      themeSelect.addEventListener('change', (e) => {
        setTheme(e.target.value);
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

  // 导出到全局
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.themes = {
    init: init,
    setTheme: setTheme,
    getCurrentTheme: getCurrentTheme,
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
