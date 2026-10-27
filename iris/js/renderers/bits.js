/**
 * bits - 位标注块渲染器
 *
 * Markdown 语法（lang 位写二进制，可空格分组；正文标注行 `位序|名称|说明`，
 * 位序为自最高位起算）：
 *   ```bits 1100 0011
 *   7 | SYN | 发起连接
 *   6 | ACK | 确认收到
 *   ```
 *
 * 渲染位条可视化（MSB 在左）+ 二/十六/十进制速读 + 点击位查看标注——
 * TCP flags、子网掩码、TOS 字段教学神器。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function parse(text) {
    const annotations = new Map(); // msbIndex -> { name, desc }
    String(text || '').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parts = trimmed.split('|').map(s => s.trim());
      const idx = parseInt(parts[0], 10);
      if (!Number.isFinite(idx) || idx < 0 || parts.length < 2) return;
      annotations.set(idx, { name: parts[1], desc: parts[2] || '' });
    });
    return annotations;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      if (lang !== 'bits' && !lang.startsWith('bits ')) return;
      const bin = lang.slice(4).replace(/[^01]/g, '');
      if (!bin || bin.length > 32) return; // 无二进制或超 32 位：保留源码

      const annotations = parse(pre.querySelector('code')?.textContent ?? '');
      const width = bin.length;
      const value = parseInt(bin, 2);
      const hex = '0x' + Math.abs(value).toString(16).toUpperCase().padStart(Math.ceil(width / 4), '0');

      const widget = document.createElement('div');
      widget.className = 'bits-widget';
      const groups = [];
      for (let i = 0; i < bin.length; i += 4) groups.push(bin.slice(i, i + 4));
      const bitCells = bin.split('').map((bit, i) => {
        const a = annotations.get(i);
        return `<button type="button" class="bits-cell ${bit === '1' ? 'is-one' : ''} ${a ? 'has-note' : ''}" data-i="${i}" title="${esc(a ? a.name : '')}">
          <span class="bits-value">${bit}</span>
          <span class="bits-index">${width - 1 - i}</span>
        </button>`;
      }).join('');

      widget.innerHTML = `
        <div class="bits-head">
          <span class="bits-num"><code>${esc(groups.join(' '))}</code></span>
          <span class="bits-bases">${esc(hex)} · ${esc(String(value))}</span>
        </div>
        <div class="bits-strip" style="--bits:${width}">${bitCells}</div>
        <div class="bits-notes">
          ${annotations.size === 0
            ? `<span class="bits-none">${esc(t('bits.noNotes', '正文加「位序 | 名称 | 说明」行即可标注每一位'))}</span>`
            : [...annotations.entries()].map(([i, a]) => `
              <div class="bits-note" data-i="${i}">
                <span class="bits-note-idx">${esc(t('bits.bit', '位 {n}').replace('{n}', String(width - 1 - i)))}</span>
                <span class="bits-note-name">${esc(a.name)}</span>
                <span class="bits-note-desc">${esc(a.desc)}</span>
              </div>`).join('')}
        </div>`;

      // 点击位：高亮对应标注行（有标注时）
      const strip = widget.querySelector('.bits-strip');
      strip.addEventListener('click', (e) => {
        const cell = e.target.closest('.bits-cell');
        if (!cell) return;
        strip.querySelectorAll('.bits-cell').forEach(c => c.classList.remove('picked'));
        cell.classList.add('picked');
        const i = cell.dataset.i;
        widget.querySelectorAll('.bits-note').forEach(n => {
          n.classList.toggle('picked', n.dataset.i === i);
        });
      });

      pre.parentNode.replaceChild(widget, pre);
    });
  }

  window.MarkdownPreview.renderers.bits = { render };
})();
