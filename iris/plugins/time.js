// 时间戳 / 时区转换插件（TOOL-4）
// ```time
// 1700000000          ← 可省略：留空则显示当前时刻
// ```
export default {
  name: 'time',
  description: '时间戳 / 时区实时对照',
  priority: 5,

  render(code, container, context) {
    const esc = window.MarkdownPreview.mdRender.escapeHtml;
    const raw = String(code).trim().split('\n')[0].trim();
    const zones = ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];

    let base = null;
    if (raw) {
      if (/^\d+$/.test(raw)) {
        const n = Number(raw);
        base = new Date(raw.length <= 10 ? n * 1000 : n);
      } else {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) base = d;
      }
    }

    container.className = 'devtool devtool-time';
    container.innerHTML = `<div class="devtool-time-label"></div><div class="devtool-time-rows"></div>`;
    const labelEl = container.querySelector('.devtool-time-label');
    const rowsEl = container.querySelector('.devtool-time-rows');

    function fmt(d, tz) {
      try {
        return new Intl.DateTimeFormat('zh-CN', {
          timeZone: tz, hour12: false,
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(d);
      } catch (e) { return d.toISOString(); }
    }

    function draw() {
      const now = new Date();
      const t = base || now;
      labelEl.textContent = (base ? (raw + ' → ') : '') + '时间戳 ' + Math.floor(t.getTime() / 1000)
        + (base ? '（' + (t > now ? '未来 ' : '过去 ') + humanDelta(Math.abs(t - now)) + '）' : '');
      rowsEl.innerHTML = zones.map(z =>
        `<div class="devtool-time-row"><span class="devtool-time-zone">${esc(z)}</span><span class="devtool-time-val">${esc(fmt(t, z))}</span></div>`
      ).join('');
    }

    draw();
    if (!base) {
      const id = setInterval(draw, 1000);
      if (context && typeof context.registerResource === 'function') {
        context.registerResource({ destroy() { clearInterval(id); } });
      }
    }
  }
};

function humanDelta(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + ' 秒';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' 分钟';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时';
  return Math.floor(h / 24) + ' 天';
}
