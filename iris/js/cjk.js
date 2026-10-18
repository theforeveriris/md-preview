/**
 * 中文阅读与排版（CJK-1 繁简转换 / CJK-4 中文排版渲染选项）
 *
 * 繁简转换：
 *   - 阅读时把正文在简体 / 繁体之间转换，不改动源文件
 *   - 依赖按需加载的 opencc-js（iris/vendor/opencc/opencc.min.js，约 450KB），
 *     仅在用户启用转换时加载；离线 / 加载失败时静默降级为「原文」
 *   - 只处理 .markdown-body 内的文本节点，跳过代码块 / 行内代码 / 公式 / 图表
 *   - 每个被转换的文本节点记录原始值（node.__mdpOrig），切换或关闭时按原文还原
 *
 * 排版选项：中西文自动间距 / 标点悬挂 / 标点挤压（CSS 属性，浏览器不支持时自动忽略）
 *
 * 设置由 settings.js 持久化（md-preview-settings）；本模块自带初始化，
 * 即使 settings.js 的初次 apply 早于本模块加载也能生效。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const OPENCC_URL = 'iris/vendor/opencc/opencc.min.js';

  let converters = null;      // { tw, cn }
  let loadingPromise = null;
  let currentMode = 'off';    // 'off' | 'tw' | 'cn'

  // 不参与繁简转换的标签 / 容器（代码、公式、图表、表格数据等）
  const SKIP_TAGS = { CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, KBD: 1, SAMP: 1 };
  const SKIP_CLASSES = ['katex', 'mermaid-diagram', 'csv-table', 'no-cjk-convert', 'code-block'];

  function loadSettings() {
    const s = window.MarkdownPreview.settings;
    try { return s && typeof s.load === 'function' ? s.load() : null; } catch (e) { return null; }
  }

  async function ensureConverters() {
    if (converters) return converters;
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      if (typeof window.OpenCC === 'undefined') {
        try {
          await window.MarkdownPreview.loadScript(OPENCC_URL);
        } catch (e) {
          console.warn('[CJK] opencc 加载失败：', e && e.message);
        }
      }
      if (typeof window.OpenCC === 'undefined' || typeof window.OpenCC.Converter !== 'function') {
        console.warn('[CJK] OpenCC 不可用，繁简转换降级为原文');
        return null;
      }
      try {
        converters = {
          tw: window.OpenCC.Converter({ from: 'cn', to: 'tw' }),
          cn: window.OpenCC.Converter({ from: 'tw', to: 'cn' })
        };
      } catch (e) {
        console.warn('[CJK] OpenCC 初始化失败：', e && e.message);
        converters = null;
      }
      return converters;
    })();
    return loadingPromise;
  }

  function shouldSkip(node) {
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS[el.tagName]) return true;
      if (el.classList) {
        for (let i = 0; i < SKIP_CLASSES.length; i++) {
          if (el.classList.contains(SKIP_CLASSES[i])) return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  }

  function resolveScope(root) {
    const md = window.MarkdownPreview.mdRender;
    if (md && typeof md.resolveRoot === 'function') {
      const r = md.resolveRoot(root);
      if (r) return r;
    }
    return root || document.getElementById('markdownContent');
  }

  // 收集需要转换的文本节点（含中文、未被排除）
  function collectTextNodes(scope) {
    const out = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const v = n.nodeValue;
        if (!v || !v.trim()) return NodeFilter.FILTER_REJECT;
        if (!/[\u4e00-\u9fff]/.test(v)) return NodeFilter.FILTER_REJECT;
        if (shouldSkip(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  // 还原所有记录过原文的文本节点
  function restore(scope) {
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.__mdpOrig != null && n.nodeValue !== n.__mdpOrig) {
        n.nodeValue = n.__mdpOrig;
      }
    }
  }

  async function applyToRoot(root) {
    const scope = resolveScope(root);
    if (!scope) return;
    restore(scope);
    if (currentMode === 'off') return;
    const conv = await ensureConverters();
    if (!conv) return;
    const fn = conv[currentMode];
    if (typeof fn !== 'function') return;
    collectTextNodes(scope).forEach(node => {
      if (node.__mdpOrig == null) node.__mdpOrig = node.nodeValue;
      try {
        node.nodeValue = fn(node.__mdpOrig);
      } catch (e) {
        node.nodeValue = node.__mdpOrig;
      }
    });
  }

  function afterRender() {
    if (currentMode !== 'off') applyToRoot();
  }

  async function setMode(mode) {
    currentMode = (mode === 'tw' || mode === 'cn') ? mode : 'off';
    if (currentMode === 'off') {
      restore(resolveScope());
      return;
    }
    await applyToRoot();
  }

  // ---------- 排版选项（CSS 类，浏览器不支持时自动忽略） ----------
  function applyTypography(settings) {
    const cfg = settings || loadSettings() || {};
    const body = document.body;
    if (!body) return;
    body.classList.toggle('cjk-indent', cfg.typographyIndent === true);
    body.classList.toggle('cjk-hanging-punct', cfg.typographyHangingPunct === true);
    body.classList.toggle('cjk-text-spacing', cfg.typographyTextSpacing === true);
  }

  // ---------- 初始化 ----------
  function init() {
    const settings = loadSettings();
    applyTypography(settings);
    if (settings && (settings.textConversion === 'tw' || settings.textConversion === 'cn')) {
      setMode(settings.textConversion);
    }
  }

  window.MarkdownPreview.cjk = {
    setMode,
    applyToRoot,
    afterRender,
    applyTypography,
    getMode: () => currentMode
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
