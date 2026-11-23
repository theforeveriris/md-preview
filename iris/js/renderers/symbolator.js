/**
 * Symbolator 硬件符号图渲染器
 *
 * Markdown 语法：
 *   ```symbolator
 *   module demo (
 *     input wire a,
 *     output wire y
 *   );
 *   endmodule
 *   ```
 *
 * 正文是 Verilog / VHDL，顶部可写 `//# {{分组|分组名}}` 注释给端口分组；
 * 交给 Kroki 的 symbolator 服务渲染成硬件符号图。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="symbolator"]');
    for (const pre of blocks) {
      if (pre.dataset.krokiDone) continue;
      pre.dataset.krokiDone = '1';
      const client = window.MarkdownPreview.krokiClient;
      if (!client) continue;
      try {
        await client.renderBlock(pre, 'symbolator', { containerClass: 'symbolator-diagram' });
      } catch (e) {
        console.warn('[symbolator] render failed:', e);
      }
    }
  }

  window.MarkdownPreview.renderers.symbolator = { render };
})();
