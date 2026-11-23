/**
 * Nomnoml UML / 关系图渲染器
 *
 * Markdown 语法：
 *   ```nomnoml
 *   [Customer|+ id: int;+ name: string] -> [Order]
 *   ```
 *
 * 支持类图、对象图、组件图、用例图、流程图节点、包 / 框架、注释与指令。
 * 渲染由 Kroki 的 nomnoml 服务完成（外部服务）；编码、轮试、失败回退
 * 由 kroki-client 提供。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="nomnoml"]');
    for (const pre of blocks) {
      if (pre.dataset.krokiDone) continue;
      pre.dataset.krokiDone = '1';
      const client = window.MarkdownPreview.krokiClient;
      if (!client) continue;
      try {
        await client.renderBlock(pre, 'nomnoml', {
          containerClass: 'nomnoml-diagram',
          alt: 'Nomnoml diagram'
        });
      } catch (e) {
        console.warn('[nomnoml] render failed:', e);
      }
    }
  }

  window.MarkdownPreview.renderers.nomnoml = { render };
})();
