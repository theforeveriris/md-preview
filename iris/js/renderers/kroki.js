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
 * mermaid / c4plantuml / excalidraw / dbml / wavedrom / wireviz / symbolator /
 * roadmap / structurizr / tidytree。
 *
 * 编码、服务器轮试与错误回退由 kroki-client 提供；wavedrom / wireviz /
 * symbolator / bytefield 另有独立围栏渲染器复用同一客户端。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const KROKI_TYPES = new Set([
    'blockdiag', 'seqdiag', 'actdiag', 'nwdiag', 'packetdiag', 'rackdiag',
    'bytefield', 'ditaa', 'erd', 'graphviz', 'nomnoml', 'svgbob', 'umlet',
    'plantuml', 'mermaid', 'c4plantuml', 'excalidraw', 'dbml', 'wavedrom',
    'wireviz', 'symbolator', 'roadmap', 'structurizr', 'tidytree'
  ]);

  function client() {
    return window.MarkdownPreview.krokiClient;
  }

  function isKrokiType(type) {
    return KROKI_TYPES.has(String(type || '').toLowerCase());
  }

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="kroki"]');
    for (const pre of blocks) {
      if (pre.dataset.krokiDone) continue;
      pre.dataset.krokiDone = '1';
      const body = (pre.querySelector('code') || pre).textContent || '';
      let type = String(pre.dataset.lang || '').trim().split(/\s+/)[1] || '';
      if (!type) {
        const m = /^\s*(\w+)\s*\n?/.exec(body);
        if (m && isKrokiType(m[1])) type = m[1].toLowerCase();
      }
      if (!type || !isKrokiType(type)) continue;
      try {
        await client().renderBlock(pre, type.toLowerCase());
      } catch (e) {
        console.warn('[kroki] render failed:', e);
      }
    }
  }

  window.MarkdownPreview.renderers.kroki = {
    render,
    encodeKroki: (source) => client().encode(source)
  };
})();
