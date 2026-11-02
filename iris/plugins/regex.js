// Regex tester plugin（TOOL-4）
// ```regex
// /\b\w+@\w+\.\w+\b/g      ← 首行：/pattern/flags（或仅 pattern，默认 g 标志）
// 联系我：foo@example.com 或 bar@example.org
// ```
export default {
  name: 'regex',
  description: '正则表达式测试器',
  priority: 5,

  render(code, container) {
    const lines = String(code).replace(/\r\n?/g, '\n').split('\n');
    let pattern = (lines[0] || '').trim();
    let flags = 'g';
    const m = pattern.match(/^\/(.*)\/([a-z]*)$/);
    if (m) { pattern = m[1]; flags = m[2] || 'g'; }
    const sample = lines.slice(1).join('\n');

    container.className = 'devtool devtool-regex';
    container.innerHTML = `
      <div class="devtool-row">
        <input type="text" class="devtool-input devtool-regex-pattern" value="${escapeAttr(pattern)}" placeholder="正则表达式">
        <input type="text" class="devtool-input devtool-flags" value="${escapeAttr(flags)}" placeholder="gimsuy" size="6">
      </div>
      <textarea class="devtool-input devtool-sample" rows="3" placeholder="测试文本…">${escapeHtml(sample)}</textarea>
      <div class="devtool-result devtool-regex-result"></div>
    `;

    const pInput = container.querySelector('.devtool-regex-pattern');
    const fInput = container.querySelector('.devtool-flags');
    const sInput = container.querySelector('.devtool-sample');
    const out = container.querySelector('.devtool-regex-result');

    function run() {
      const p = pInput.value;
      const f = fInput.value.replace(/[^gimsuy]/g, '');
      const text = sInput.value;
      if (!p) { out.innerHTML = ''; return; }
      let re;
      try { re = new RegExp(p, f); }
      catch (e) { out.innerHTML = `<div class="devtool-error">${escapeHtml(e.message)}</div>`; return; }
      if (!f.includes('g')) {
        const mt = re.exec(text);
        out.innerHTML = renderMatches(text, mt ? [mt] : []);
      } else {
        const all = [];
        let mt;
        let guard = 0;
        while ((mt = re.exec(text)) !== null && guard++ < 5000) {
          all.push(Array.from(mt));
          if (mt.index === re.lastIndex) re.lastIndex++;
        }
        out.innerHTML = renderMatches(text, all);
      }
    }

    function renderMatches(text, matches) {
      let html = '';
      const g = matches.length;
      const groups = matches[0] ? matches[0].length - 1 : 0;
      html += `<div class="devtool-meta">${g} 处匹配${groups > 0 ? ' · ' + groups + ' 个捕获组' : ''}</div>`;
      // 高亮（仅首个标志位全局时按全部；这里按全部匹配区间合并）
      const ranges = matches.map(m => [m.index, m.index + String(m[0] == null ? '' : m[0]).length])
        .filter(r => r[1] > r[0]).sort((a, b) => a[0] - b[0]);
      let pos = 0;
      let hl = '';
      ranges.forEach(([s, e]) => {
        if (s < pos) return;
        hl += escapeHtml(text.slice(pos, s)) + '<mark>' + escapeHtml(text.slice(s, e)) + '</mark>';
        pos = e;
      });
      hl += escapeHtml(text.slice(pos));
      html += `<pre class="devtool-hl">${hl}</pre>`;
      return html;
    }

    pInput.addEventListener('input', run);
    fInput.addEventListener('input', run);
    sInput.addEventListener('input', run);
    run();
  }
};

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s) { return escapeHtml(s); }
