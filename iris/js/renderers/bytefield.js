/**
 * Bytefield 字节域 / 报文结构图渲染器
 *
 * Markdown 语法：
 *   ```bytefield
 *   (def boxes-per-row 16)
 *   (draw-column-headers)
 *   (draw-box "Type" {:span 8})
 *   (draw-box "Payload" {:span 8})
 *   ```
 *
 * 正文是 bytefield-svg 的 Clojure DSL；交给 Kroki 的 bytefield 服务渲染。
 * 取代旧的 ```bits 位标注块：支持任意字节宽度、跨字节字段、多行与断行、
 * 颜色与底部注释。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="bytefield"]');
    for (const pre of blocks) {
      if (pre.dataset.krokiDone) continue;
      pre.dataset.krokiDone = '1';
      const client = window.MarkdownPreview.krokiClient;
      if (!client) continue;
      try {
        await client.renderBlock(pre, 'bytefield', { containerClass: 'bytefield-diagram' });
      } catch (e) {
        console.warn('[bytefield] render failed:', e);
      }
    }
  }

  window.MarkdownPreview.renderers.bytefield = { render };
})();
