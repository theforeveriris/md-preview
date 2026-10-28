/**
 * secret - 敏感信息遮罩块渲染器
 *
 * Markdown 语法：
 *   ```secret            点击揭示（先思考再看答案）
 *   ```secret 口令       输入口令才展开（口令写在 lang 位，demo 场景）
 *   ```secret raw        不遮罩，仅作样式标记（预留）
 *
 * 点击前内容高斯模糊不可读；导出 PDF（打印）时永远保持遮罩——
 * 贴配置藏密码/IP 的安全习惯靠样式兜底而不是靠自觉。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function widgetFor(pre, password) {
    const content = pre.querySelector('code')?.textContent ?? '';
    if (!content.trim()) return false;

    const widget = document.createElement('div');
    widget.className = 'secret-widget' + (password ? ' secret-needs-pass' : '');

    const contentHtml = `<pre class="secret-content"><code>${esc(content.replace(/\n$/, ''))}</code></pre>`;

    if (password) {
      widget.innerHTML = `
        <div class="secret-mask">
          <div class="secret-hint"><svg class="ico ico-xs" aria-hidden="true"><use href="#i-lock"/></svg><span>${esc(t('secret.passHint', '此内容已上锁，输入口令查看'))}</span></div>
          <div class="secret-pass-row">
            <input type="password" class="secret-pass-input" placeholder="${esc(t('secret.passPh', '口令'))}" aria-label="${esc(t('secret.passPh', '口令'))}">
            <button type="button" class="download-btn secret-unlock">${esc(t('secret.unlock', '解锁'))}</button>
          </div>
          <div class="secret-error" hidden>${esc(t('secret.wrongPass', '口令不对，再想想'))}</div>
        </div>
        ${contentHtml}`;
      const input = widget.querySelector('.secret-pass-input');
      const unlock = () => {
        if (input.value === password) {
          widget.classList.add('secret-revealed');
        } else {
          const err = widget.querySelector('.secret-error');
          err.hidden = false;
          widget.classList.remove('secret-shake');
          requestAnimationFrame(() => widget.classList.add('secret-shake'));
        }
      };
      widget.querySelector('.secret-unlock').addEventListener('click', unlock);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
    } else {
      widget.innerHTML = `
        <button type="button" class="secret-toggle">
          <span class="secret-eye"><svg class="ico ico-xs" aria-hidden="true"><use href="#i-eye"/></svg>${esc(t('secret.reveal', '点击揭示'))}</span>
        </button>
        ${contentHtml}`;
      widget.querySelector('.secret-toggle').addEventListener('click', () => {
        widget.classList.add('secret-revealed');
      });
    }

    pre.parentNode.replaceChild(widget, pre);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      if (lang !== 'secret' && !lang.startsWith('secret ')) return;
      const parts = lang.split(/\s+/);
      const token = parts[1] || '';
      const password = token && token !== 'raw' ? token : '';
      try { widgetFor(pre, password); } catch (e) { /* 保留源码 */ }
    });
  }

  window.MarkdownPreview.renderers.secret = { render };
})();
