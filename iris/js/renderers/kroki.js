/**
 * 通用 Kroki 渲染器（D1）
 *
 * Markdown 语法：
 *   ```kroki <type>
 *   <源码>
 *   ```
 * 或首行即类型：
 *   ```kroki blockdiag
 *
 * 支持图类型：blockdiag / seqdiag / actdiag / nwdiag / packetdiag / rackdiag /
 * bytefield / ditaa / erd / graphviz / nomnoml / svgbob / umlet / plantuml /
 * mermaid / c4plantuml / excalidraw / dbml / roadmap / structurizr / tidytree。
 *
 * 复用 PlantUML 的 Kroki 编码（deflate + base64url）与服务器轮试思路：
 *   默认 https://kroki.io，可通过 iris/config.json 的 krokiServers 覆盖。
 * 输出 SVG；失败回退源码 + 在线编辑器链接。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const DEFAULT_BASES = ['https://kroki.io'];

  function getBases() {
    const cfg = window.MarkdownPreview.CONFIG || {};
    if (Array.isArray(cfg.krokiServers) && cfg.krokiServers.length) {
      return cfg.krokiServers.map(s => typeof s === 'string' ? s : s.base);
    }
    return DEFAULT_BASES;
  }

  function encodeKroki(source) {
    const encoder = new TextEncoder();
    const utf8 = encoder.encode(source);
    // Kroki 服务端用 zlib.decompress 解码：必须带 zlib 头（pako.deflate），不能 deflateRaw
    const compressed = pako.deflate(utf8);
    let bin = '';
    compressed.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function buildUrl(base, type, encoded) {
    return base.replace(/\/$/, '') + '/' + type + '/svg/' + encoded;
  }

  function fallback(anchor, type, source) {
    const box = document.createElement('div');
    box.className = 'kroki-fallback';
    const note = document.createElement('div');
    note.className = 'kroki-fallback-note';
    note.textContent = t('kroki.renderFailed', 'Kroki 渲染失败，已回退源码');
    const actions = document.createElement('div');
    actions.className = 'kroki-fallback-actions';
    const a = document.createElement('a');
    a.href = 'https://kroki.io/' + type + '/svg/' + encodeKrokiSafe(source);
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

  function encodeKrokiSafe(source) {
    try { return encodeKroki(source); } catch (e) { return ''; }
  }

  // blockdiag 家族要求源码带 `blockdiag {` 关键字头；裸 `{` 时自动补
  const DIAG_KEYWORD = new Set([
    'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag'
  ]);

  async function renderOne(pre, type) {
    const codeEl = pre.querySelector('code');
    let source = (codeEl ? codeEl.textContent : '').replace(/^\n+/, '');
    if (!source.trim()) return;
    if (DIAG_KEYWORD.has(type) && !new RegExp('^\\s*' + type + '\\b').test(source)) {
      source = type + ' ' + source;
    }

    if (typeof pako === 'undefined') {
      await window.MarkdownPreview.loadScript('iris/vendor/pako.min.js');
    }
    if (typeof pako === 'undefined') { fallback(pre, type, source); return; }

    const encoded = encodeKroki(source);
    const container = document.createElement('div');
    container.className = 'kroki-diagram';
    container.dataset.src = source;
    container.dataset.type = type;
    const img = document.createElement('img');
    img.alt = type + ' diagram';
    img.loading = 'lazy';
    container.appendChild(img);
    pre.replaceWith(container);

    const bases = getBases();
    let i = 0;
    const tryNext = async (reason) => {
      if (i >= bases.length) { fallback(container, type, source); return; }
      const base = bases[i++];
      const url = buildUrl(base, type, encoded);
      // Kroki 的 400 错误也以 image/svg 返回，img.onerror 不会触发；
      // 先用 fetch 探测状态码（同源代理或 CORS 可用时），失败退回直接 img
      try {
        const resp = await fetch(url, { mode: 'cors' });
        if (!resp.ok) { console.warn('[kroki] server error', resp.status, url, reason || ''); tryNext(url); return; }
        const blob = await resp.blob();
        const fixed = await fixSvgTextLength(blob);
        img.src = URL.createObjectURL(fixed);
      } catch (e) {
        // CORS/网络受限：退回 <img> 直载（错误图会显示 Kroki 的错误 SVG）
        img.onerror = () => { console.warn('[kroki] server failed:', url, reason || ''); tryNext(url); };
        img.src = url;
      }
    };
    tryNext();
  }

  /**
   * 去掉 SVG 里的 textLength / lengthAdjust。
   *
   * Kroki 的 diagram 引擎按「字符数」估算文本宽度，给每个 <text> 写死
   * textLength="20"。中文是双宽字符，实际宽度远大于估算值，浏览器会把
   * 字形挤到 textLength 里——于是中文标签互相叠字（看着像乱码）。
   * 去掉这个属性后浏览器按字体实际排版，中文就不叠了。
   */
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

  const KROKI_TYPES = new Set([
    'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag',
    'bytefield', 'ditaa', 'erd', 'graphviz', 'nomnoml', 'svgbob', 'umlet',
    'plantuml', 'mermaid', 'c4plantuml', 'excalidraw', 'dbml', 'roadmap',
    'structurizr', 'tidytree', 'vega', 'vegalite', 'wttr'
  ]);

  function isKrokiType(t) { return KROKI_TYPES.has(String(t || '').toLowerCase()); }

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const pres = Array.from(scope.querySelectorAll('pre'));
    for (const pre of pres) {
      const codeEl = pre.querySelector('code');
      if (!codeEl) continue;
      const markers = String(pre.dataset.lang || '').trim().split(/\s+/).filter(Boolean);
      if (markers[0] !== 'kroki') continue;
      // 类型优先取 fence 信息串的第二个 token，回退到正文首行
      let type = isKrokiType(markers[1]) ? markers[1].toLowerCase() : null;
      const body = codeEl.textContent;
      if (!type) {
        const m = /^\s*(\w+)\s*\n?/.exec(body);
        if (m && isKrokiType(m[1])) type = m[1].toLowerCase();
      }
      if (!type) continue;
      await renderOne(pre, type);
    }
  }

  window.MarkdownPreview.renderers.kroki = { render, encodeKroki };
})();
