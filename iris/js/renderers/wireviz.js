/**
 * WireViz 线束 / 接线图渲染器
 *
 * Markdown 语法：
 *   ```wireviz
 *   connectors:
 *     X1: ...
 *   cables:
 *     W1: ...
 *   connections:
 *     - [X1:1, W1:1]
 *   ```
 *
 * 正文是 WireViz YAML，交给 Kroki 的 wireviz 服务渲染；编码 / 轮试 /
 * 失败回退由 kroki-client 提供。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="wireviz"]');
    for (const pre of blocks) {
      if (pre.dataset.krokiDone) continue;
      pre.dataset.krokiDone = '1';
      const client = window.MarkdownPreview.krokiClient;
      if (!client) continue;
      try {
        await client.renderBlock(pre, 'wireviz', { containerClass: 'wireviz-diagram' });
      } catch (e) {
        console.warn('[wireviz] render failed:', e);
      }
    }
  }

  window.MarkdownPreview.renderers.wireviz = { render };
})();
