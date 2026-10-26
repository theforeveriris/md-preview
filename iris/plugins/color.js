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

// 颜色解析/亮度/对比度统一走 MarkdownPreview.ColorUtils（全站唯一实现）
const { parseColor, luminance, contrast } = window.MarkdownPreview.ColorUtils;

