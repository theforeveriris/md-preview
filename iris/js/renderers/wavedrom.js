/**
 * WaveDrom 数字时序图渲染器
 *
 * Markdown 语法：
 *   ```wavedrom
 *   {signal: [{name:'clk', wave:'p....'}, {name:'data', wave:'x345x', data:'head body'}]}
 *   ```
 *
 * 正文是 WaveJSON，交给 Kroki 的 wavedrom 服务渲染为 SVG；编码 / 多服务器
 * 轮试 / 失败回退由 kroki-client 提供。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="wavedrom"]');
    for (const pre of blocks) {
      if (pre.dataset.krokiDone) continue;
      pre.dataset.krokiDone = '1';
      const client = window.MarkdownPreview.krokiClient;
      if (!client) continue;
      try {
        await client.renderBlock(pre, 'wavedrom', { containerClass: 'wavedrom-diagram' });
      } catch (e) {
        console.warn('[wavedrom] render failed:', e);
      }
    }
  }

  window.MarkdownPreview.renderers.wavedrom = { render };
})();
