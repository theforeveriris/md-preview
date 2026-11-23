/**
 * kroki-client - Kroki SVG 渲染共用客户端
 *
 * 供通用 kroki 渲染器与 wavedrom / wireviz / symbolator / bytefield 等
 * 专用围栏渲染器复用：deflate + base64url 编码、多服务器轮试、错误回退、
 * 去掉 textLength 修正中文排版。
 *
 * 用法：
 *   await window.MarkdownPreview.krokiClient.renderBlock(pre, 'wavedrom');
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const DEFAULT_BASES = ['https://kroki.io'];

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  function getBases() {
    const cfg = window.MarkdownPreview.CONFIG || {};
    if (Array.isArray(cfg.krokiServers) && cfg.krokiServers.length) {
      return cfg.krokiServers.map(s => typeof s === 'string' ? s : s.base);
    }
    return DEFAULT_BASES;
  }

  function encode(source) {
    const utf8 = new TextEncoder().encode(source);
    const compressed = pako.deflate(utf8);
    let bin = '';
    compressed.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function encodeSafe(source) {
    try { return encode(source); } catch (e) { return ''; }
  }

  function buildUrl(base, type, encoded) {
    return base.replace(/\/$/, '') + '/' + type + '/svg/' + encoded;
  }

  // blockdiag 家族要求源码带关键字头；裸 `{` 时自动补
  const KEYWORD_TYPES = new Set([
    'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag'
  ]);

  function fallback(anchor, type, source) {
    const box = document.createElement('div');
    box.className = 'kroki-fallback';
    const note = document.createElement('div');
    note.className = 'kroki-fallback-note';
    note.textContent = t('kroki.renderFailed', 'Kroki 渲染失败，已回退源码');
    const actions = document.createElement('div');
    actions.className = 'kroki-fallback-actions';
    const a = document.createElement('a');
    a.href = 'https://kroki.io/' + type + '/svg/' + encodeSafe(source);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = t('kroki.openOnline', '在线打开');
    actions.appendChild(a);
    const pre = document.createElement('pre');
    pre.className = 'code-block';
    const code = document.createElement('code');
    code.className = 'language-' + type;
    code.textContent = source;
    pre.appendChild(code);
    box.append(note, actions, pre);
    anchor.replaceWith(box);
  }

  // 去掉 SVG 的 textLength / lengthAdjust（Kroki 按字符数估算宽度，中文会叠字）
  async function fixSvgTextLength(blob) {
    try {
      const type = blob.type || '';
      if (!/svg/i.test(type) && !/\.svg/.test(type)) return blob;
      let text = await blob.text();
      if (!/<text/i.test(text)) return blob;
      text = text.replace(/\s+textLength="[^"]*"/gi, '')
                 .replace(/\s+lengthAdjust="[^"]*"/gi, '');
      return new Blob([text], { type: type || 'image/svg+xml' });
    } catch (e) {
      return blob;
    }
  }

  async function ensurePako() {
    if (typeof pako !== 'undefined') return true;
    try {
      await window.MarkdownPreview.loadScript('iris/vendor/pako.min.js');
    } catch (e) {
      return false;
    }
    return typeof pako !== 'undefined';
  }

  /**
   * 把一个代码块替换成 Kroki 渲染的 SVG。
   * @param {HTMLElement} pre  代码块
   * @param {string} type      Kroki 图类型
   * @param {object} [opts]    { containerClass, alt, transform }
   */
  async function renderBlock(pre, type, opts) {
    opts = opts || {};
    const codeEl = pre.querySelector('code');
    let source = (codeEl ? codeEl.textContent : '').replace(/^\n+/, '');
    if (!source.trim()) return false;
    if (typeof opts.transform === 'function') source = opts.transform(source, type) || source;
    if (KEYWORD_TYPES.has(type) && !new RegExp('^\\s*' + type + '\\b').test(source)) {
      source = type + ' ' + source;
    }

    if (!(await ensurePako())) { fallback(pre, type, source); return false; }

    const encoded = encode(source);
    const container = document.createElement('div');
    container.className = 'kroki-diagram' + (opts.containerClass ? ' ' + opts.containerClass : '');
    container.dataset.src = source;
    container.dataset.type = type;
    const img = document.createElement('img');
    img.alt = opts.alt || (type + ' diagram');
    img.decoding = 'async';
    container.appendChild(img);
    pre.replaceWith(container);

    const bases = getBases();
    let i = 0;
    const tryNext = async (reason) => {
      if (i >= bases.length) { fallback(container, type, source); return; }
      const base = bases[i++];
      const url = buildUrl(base, type, encoded);
      try {
        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) { console.warn('[kroki] server error', resp.status, url, reason || ''); tryNext(url); return; }
        const blob = await resp.blob();
        const fixed = await fixSvgTextLength(blob);
        img.src = URL.createObjectURL(fixed);
      } catch (e) {
        img.onerror = () => { console.warn('[kroki] server failed:', url, reason || ''); tryNext(url); };
        img.src = url;
      }
    };
    tryNext();
    return true;
  }

  window.MarkdownPreview.krokiClient = {
    encode,
    encodeSafe,
    getBases,
    renderBlock,
    fallback
  };
})();
