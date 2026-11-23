/**
 * Vega-Lite 图表（D2）
 *
 * Markdown 语法：
 *   ```vega-lite
 *   { "$schema": "https://vega.github.io/schema/vega-lite/v5.json", ... }
 *   ```
 *
 * 用 JSON 规范渲染 ApexCharts 覆盖不到的图表（treemap、density、facet、
 * transform 等）。vega/vega-lite/vega-embed 体积大，按需从 CDN 懒加载。
 *
 * 失败回退：无法加载或渲染失败时显示源码块 + 在线编辑器链接。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const CDN = {
    vega: 'https://cdn.jsdelivr.net/npm/vega@5/build/vega.min.js',
    vegaLite: 'https://cdn.jsdelivr.net/npm/vega-lite@5/build/vega-lite.min.js',
    vegaEmbed: 'https://cdn.jsdelivr.net/npm/vega-embed@6/build/vega-embed.min.js'
  };
  const EDITOR_URL = 'https://vega.github.io/editor/#/config/vega-lite/url:';

  function fallback(pre, spec, reason) {
    const box = document.createElement('div');
    box.className = 'vegalite-fallback';
    const note = document.createElement('div');
    note.className = 'kroki-fallback-note';
    note.textContent = reason || t('vegalite.renderFailed', 'Vega-Lite 渲染失败，已回退源码');
    const a = document.createElement('a');
    a.href = EDITOR_URL + encodeURIComponent(JSON.stringify(spec));
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = t('vegalite.openEditor', '在线编辑器');
    box.appendChild(note);
    box.appendChild(a);
    const pre2 = document.createElement('pre');
    pre2.className = 'code-block';
    const code = document.createElement('code');
    code.className = 'language-json';
    code.textContent = JSON.stringify(spec, null, 2);
    pre2.appendChild(code);
    box.appendChild(pre2);
    pre.replaceWith(box);
  }

  function loadScriptOnce(url) {
    return new Promise((resolve, reject) => {
      if (window[url === CDN.vega ? 'vega' : url === CDN.vegaLite ? 'vegaLite' : 'vegaEmbed']) return resolve();
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load fail ' + url));
      document.head.appendChild(s);
    });
  }

  async function renderOne(pre) {
    const codeEl = pre.querySelector('code');
    const text = (codeEl ? codeEl.textContent : '').trim();
    let spec;
    try { spec = JSON.parse(text); } catch (e) { return; }
    if (!spec || typeof spec !== 'object') return;

    const container = document.createElement('div');
    container.className = 'vegalite-chart';
    pre.replaceWith(container);

    try {
      await loadScriptOnce(CDN.vega);
      await loadScriptOnce(CDN.vegaLite);
      await loadScriptOnce(CDN.vegaEmbed);
      if (typeof vegaEmbed !== 'function') throw new Error('vegaEmbed missing');
      // 容器刚插入时宽度可能未完成布局；规范未指定宽度时按容器实测宽度（320–760）渲染
      if (spec.width == null) {
        spec.width = Math.max(320, Math.min(760, container.clientWidth || 640));
      }
      await vegaEmbed(container, spec, { renderer: 'svg', actions: false });
    } catch (e) {
      console.warn('[vega-lite] render failed:', e);
      fallback(container, spec, t('vegalite.renderFailed', 'Vega-Lite 渲染失败，已回退源码'));
    }
  }

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const pres = Array.from(scope.querySelectorAll('pre'));
    for (const pre of pres) {
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      if (lang !== 'vega-lite') continue;
      await renderOne(pre);
    }
  }

  window.MarkdownPreview.renderers.vegalite = { render };
})();
