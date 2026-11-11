/**
 * route-table - 路由表分析块渲染器
 *
 * Markdown 语法：```route-table`，正文粘贴 `show ip route` / VRP
 * `display ip routing-table` 输出。
 *
 * 渲染：可排序表（协议/前缀/AD/度量/下一跳/出接口）+ 协议分布统计条。
 * 解析不了的行原样跳过；一行都识别不了则保留源码高亮。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // 协议代号 → 名称与颜色档
  const PROTO_META = {
    C: { name: 'Connected', cls: 'p-c' },
    L: { name: 'Local', cls: 'p-l' },
    S: { name: 'Static', cls: 'p-s' },
    O: { name: 'OSPF', cls: 'p-o' },
    'O IA': { name: 'OSPF inter-area', cls: 'p-o' },
    'O E1': { name: 'OSPF ext-1', cls: 'p-o' },
    'O E2': { name: 'OSPF ext-2', cls: 'p-o' },
    'O N1': { name: 'OSPF nssa-1', cls: 'p-o' },
    'O N2': { name: 'OSPF nssa-2', cls: 'p-o' },
    D: { name: 'EIGRP', cls: 'p-d' },
    'D EX': { name: 'EIGRP external', cls: 'p-d' },
    R: { name: 'RIP', cls: 'p-r' },
    B: { name: 'BGP', cls: 'p-b' },
    'B E': { name: 'BGP external', cls: 'p-b' },
    'B I': { name: 'BGP internal', cls: 'p-b' },
    i: { name: 'IS-IS', cls: 'p-i' },
    'i L1': { name: 'IS-IS L1', cls: 'p-i' },
    'i L2': { name: 'IS-IS L2', cls: 'p-i' },
    U: { name: 'Per-user static', cls: 'p-u' },
    '+': { name: 'Recursive', cls: 'p-x' },
    '*': { name: 'Candidate default', cls: 'p-x' },
  };

  // 一行路由：`O  10.2.0.0/16 [110/20] via 10.1.1.2, 00:12:34, GigabitEthernet0/0`
  const ROUTE_RE = /^([A-Za-z+\*]+(?:\s+(?:IA|E1|E2|N1|N2|EX|L1|L2|I|E))?)\s{1,}(\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2})(?:\s+\[((\d+)(?:\/(\d+))?)\])?\s+(.*)$/;

  function parseRouteLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const m = ROUTE_RE.exec(trimmed);
    if (!m) return null;
    let proto = m[1].replace(/\*$/, '');
    let candidate = /\*/.test(m[1]);
    const rest = m[6] || '';
    // 下一跳 / 出接口解析
    let nextHop = '';
    let iface = '';
    let age = '';
    const viaM = /via\s+(\d{1,3}(?:\.\d{1,3}){3})/.exec(rest);
    if (viaM) nextHop = viaM[1];
    const directM = /is directly connected/i.exec(rest);
    const ifaceM = /(?:,\s*)?([A-Za-z][\w-]*(?:\d+(?:\/[\d.]+)*)?)\s*$/.exec(rest.trim());
    if (ifaceM && (directM || viaM)) iface = ifaceM[1];
    const ageM = /\b(\d{1,2}:\d{2}:\d{2}|\d{1,2}w\dd|\d{1,2}d\d{1,2}h|\d{1,2}h\d{1,2}m|\d+w|\dd|\dh|\dm)\b/.exec(rest);
    if (ageM) age = ageM[1];
    // VRP 形态：`OSPF 10 20  RIP 100` 协议后跟优先级数字已并入 AD
    const ad = m[4] !== undefined ? parseInt(m[4], 10) : '';
    const metric = m[5] !== undefined ? parseInt(m[5], 10) : '';
    return { proto: proto.trim(), candidate, prefix: m[2], ad, metric, nextHop, iface, age, rest };
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      if (lang !== 'route-table') return;
      const text = pre.querySelector('code')?.textContent ?? '';
      const routes = [];
      text.split('\n').forEach(line => {
        const r = parseRouteLine(line);
        if (r && PROTO_META[r.proto]) routes.push(r);
      });
      if (routes.length === 0) return;

      // 协议分布
      const dist = new Map();
      routes.forEach(r => dist.set(r.proto, (dist.get(r.proto) || 0) + 1));
      const distHtml = [...dist.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([proto, count]) => {
          const meta = PROTO_META[proto] || { name: proto, cls: 'p-x' };
          return `<span class="rt-dist-chip ${meta.cls}">${esc(proto)} · ${esc(meta.name)} <strong>${count}</strong></span>`;
        }).join('');

      const widget = document.createElement('div');
      widget.className = 'rt-widget';
      widget.innerHTML = `
        <div class="rt-head">
          <span class="rt-title">${esc(t('rt.title', '路由表'))}</span>
          <span class="rt-dist">${distHtml}</span>
        </div>
        <div class="rt-table-wrap"><table>
          <thead><tr>
            <th data-sort="proto">${esc(t('rt.proto', '协议'))}</th>
            <th data-sort="prefix">${esc(t('rt.prefix', '前缀'))}</th>
            <th data-sort="ad">${esc(t('rt.ad', 'AD'))}</th>
            <th data-sort="metric">${esc(t('rt.metric', '度量'))}</th>
            <th data-sort="nexthop">${esc(t('rt.nexthop', '下一跳'))}</th>
            <th data-sort="iface">${esc(t('rt.iface', '出接口'))}</th>
            <th data-sort="age">${esc(t('rt.age', '存活'))}</th>
          </tr></thead>
          <tbody></tbody>
        </table></div>`;

      const tbody = widget.querySelector('tbody');
      let sortKey = null;
      let sortAsc = false;

      function renderBody() {
        const rows = routes.slice();
        if (sortKey) {
          rows.sort((a, b) => {
            let va = a[sortKey], vb = b[sortKey];
            if (sortKey === 'proto') { va = PROTO_META[a.proto] ? PROTO_META[a.proto].name : a.proto; vb = PROTO_META[b.proto] ? PROTO_META[b.proto].name : b.proto; }
            if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va;
            va = String(va || ''); vb = String(vb || '');
            return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
          });
        }
        tbody.innerHTML = rows.map(r => {
          const meta = PROTO_META[r.proto] || { name: r.proto, cls: 'p-x' };
          return `<tr>
            <td><span class="rt-proto ${meta.cls}" title="${esc(meta.name)}">${esc(r.proto)}${r.candidate ? '*' : ''}</span></td>
            <td><code>${esc(r.prefix)}</code></td>
            <td>${esc(String(r.ad))}</td>
            <td>${esc(String(r.metric))}</td>
            <td>${r.nextHop ? `<code>${esc(r.nextHop)}</code>` : (r.rest.includes('directly connected') ? `<span class="rt-direct">${esc(t('rt.direct', '直连'))}</span>` : '')}</td>
            <td>${esc(r.iface)}</td>
            <td>${esc(r.age)}</td>
          </tr>`;
        }).join('');
      }

      widget.querySelectorAll('th[data-sort]').forEach(th => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          const key = th.dataset.sort;
          if (sortKey === key) sortAsc = !sortAsc;
          else { sortKey = key; sortAsc = true; }
          widget.querySelectorAll('th').forEach(x => x.classList.remove('rt-sorted-asc', 'rt-sorted-desc'));
          th.classList.add(sortAsc ? 'rt-sorted-asc' : 'rt-sorted-desc');
          renderBody();
        });
      });

      renderBody();
      pre.parentNode.replaceChild(widget, pre);
    });
  }

  window.MarkdownPreview.renderers.routetable = { render };
})();
