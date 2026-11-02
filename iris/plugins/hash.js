// 文本哈希插件（TOOL-4）
// ```hash
// 需要计算哈希的文本
// ```
export default {
  name: 'hash',
  description: '文本 SHA 哈希（SHA-1/256/384/512）',
  priority: 5,

  async render(code, container) {
    const esc = window.MarkdownPreview.mdRender.escapeHtml;
    const text = String(code);
    container.className = 'devtool devtool-hash';

    if (!(window.crypto && window.crypto.subtle)) {
      container.innerHTML = '<div class="devtool-error">当前环境不支持 WebCrypto（需 HTTPS 部署）</div>';
      return;
    }

    container.innerHTML = '<div class="devtool-meta">' + esc(text.length) + ' 字符</div><div class="devtool-hash-rows"></div>';
    const rowsEl = container.querySelector('.devtool-hash-rows');
    const algs = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
    const data = new TextEncoder().encode(text);

    for (const alg of algs) {
      try {
        const buf = await crypto.subtle.digest(alg, data);
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        const row = document.createElement('div');
        row.className = 'devtool-hash-row';
        row.innerHTML = `<span class="devtool-hash-alg">${esc(alg)}</span><code class="devtool-hash-val">${esc(hex)}</code>`;
        rowsEl.appendChild(row);
      } catch (e) {
        /* 忽略单个算法失败 */
      }
    }
  }
};
