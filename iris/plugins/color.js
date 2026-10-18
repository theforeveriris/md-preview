// 色板 / 对比度检查插件（TOOL-4）
// ```color
// #d4a5c9
// #1f2937
// rgb(139, 92, 246)
// ```
export default {
  name: 'color',
  description: '色板 + WCAG 对比度检查',
  priority: 5,

  render(code, container) {
    const esc = window.MarkdownPreview.mdRender.escapeHtml;
    const lines = String(code).replace(/\r\n?/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
    container.className = 'devtool devtool-color';

    const items = lines.map(parseColor).filter(Boolean);
    if (!items.length) {
      container.innerHTML = '<div class="devtool-error">请提供颜色：十六进制（#d4a5c9）或 rgb(139, 92, 246)</div>';
      return;
    }

    container.innerHTML = `<div class="devtool-color-grid">${items.map(c => {
      const white = contrast(c, { r: 255, g: 255, b: 255 });
      const black = contrast(c, { r: 0, g: 0, b: 0 });
      return `<div class="devtool-swatch">
        <span class="devtool-swatch-chip" style="background:${esc(c.hex)}"></span>
        <span class="devtool-swatch-info">
          <code>${esc(c.hex)}</code>
          <span class="devtool-swatch-rgb">rgb(${c.r}, ${c.g}, ${c.b})</span>
          <span class="devtool-swatch-contrast">白 ${white.toFixed(2)} · 黑 ${black.toFixed(2)}</span>
        </span>
      </div>`;
    }).join('')}</div>`;
  }
};

function parseColor(s) {
  let m = s.match(/^#?([0-9a-f]{6})$/i);
  if (m) {
    const hex = '#' + m[1].toLowerCase();
    return {
      hex,
      r: parseInt(m[1].slice(0, 2), 16),
      g: parseInt(m[1].slice(2, 4), 16),
      b: parseInt(m[1].slice(4, 6), 16)
    };
  }
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const r = Math.min(255, +m[1]), g = Math.min(255, +m[2]), b = Math.min(255, +m[3]);
    return { hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''), r, g, b };
  }
  return null;
}

function luminance(c) {
  const f = v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
