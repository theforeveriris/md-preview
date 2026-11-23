// Cron 表达式解释器插件（TOOL-4）
// ```cron
// */15 9-18 * * 1-5
// ```
export default {
  name: 'cron',
  description: 'cron 表达式人类可读解释 + 下次运行时间',
  priority: 5,

  render(code, container) {
    const esc = window.MarkdownPreview.mdRender.escapeHtml;
    const expr = String(code).trim().split('\n')[0].trim();
    const parts = expr.split(/\s+/);
    container.className = 'devtool devtool-cron';

    if (parts.length !== 5) {
      container.innerHTML = '<div class="devtool-error">请输入 5 段 cron 表达式：分 时 日 月 周（例：*/15 9-18 * * 1-5）</div>';
      return;
    }

    const labels = ['分钟', '小时', '日', '月', '周'];
    const units = [
      { min: 0, max: 59 },
      { min: 0, max: 23 },
      { min: 1, max: 31 },
      { min: 1, max: 12 },
      { min: 0, max: 6 }
    ];
    const desc = parts.map((p, i) => labels[i] + '：' + describeField(p, i)).join('；');
    const next = nextRuns(parts, units, 5);

    container.innerHTML =
      `<div class="devtool-meta">${esc(expr)}</div>` +
      `<div class="devtool-cron-desc">${esc(desc)}</div>` +
      (next.length
        ? `<div class="devtool-cron-label">下次运行</div><ul class="devtool-cron-next">${next.map(d => `<li>${esc(d)}</li>`).join('')}</ul>`
        : '');
  }
};

function describeField(spec, fieldIndex) {
  if (spec === '*') return '每' + ['分钟', '小时', '天', '个月', '天'][fieldIndex] + '';
  if (/^\*\/\d+$/.test(spec)) return '每 ' + spec.slice(2) + [
    ' 分钟', ' 小时', ' 天', ' 个月（近似）', ' 天'][fieldIndex];
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const month = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const map = v => fieldIndex === 4 ? (weekday[v] || v) : (fieldIndex === 3 ? (month[v] || v) : v);
  if (/^[\d,]+$/.test(spec)) return spec.split(',').map(v => map(Number(v))).join('、');
  if (/^\d+-\d+$/.test(spec)) {
    const [a, b] = spec.split('-').map(Number);
    return map(a) + ' 到 ' + map(b);
  }
  if (/^\d+-\d+\/\d+$/.test(spec)) {
    const [range, step] = spec.split('/');
    const [a, b] = range.split('-').map(Number);
    return map(a) + ' 到 ' + map(b) + ' 每 ' + step;
  }
  return spec;
}

function fieldsToSet(spec, min, max) {
  const set = new Set();
  spec.split(',').forEach(part => {
    let step = 1;
    let body = part;
    const slash = part.indexOf('/');
    if (slash >= 0) { step = parseInt(part.slice(slash + 1), 10) || 1; body = part.slice(0, slash); }
    let lo = min, hi = max;
    if (body !== '*') {
      if (body.indexOf('-') >= 0) {
        const [a, b] = body.split('-').map(Number);
        lo = a; hi = b;
      } else {
        lo = hi = parseInt(body, 10);
      }
    }
    for (let v = lo; v <= hi; v += step) set.add(v);
  });
  return set;
}

function nextRuns(parts, units, count) {
  const sets = parts.map((p, i) => fieldsToSet(p, units[i].min, units[i].max));
  const out = [];
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit && out.length < count; i++) {
    const d = new Date(start.getTime() + i * 60000);
    const dow = d.getDay();
    if (sets[0].has(d.getMinutes()) &&
        sets[1].has(d.getHours()) &&
        sets[2].has(d.getDate()) &&
        sets[3].has(d.getMonth() + 1) &&
        (sets[4].has(dow) || (dow === 0 && sets[4].has(7)))) {
      out.push(d.toLocaleString('zh-CN', { hour12: false }));
    }
  }
  return out;
}
