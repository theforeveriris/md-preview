/**
 * ipcalc - 子网计算块渲染器
 *
 * Markdown 语法（lang 位置写目标网段，可多行多个网段）：
 *   ```ipcalc 10.1.1.0/24
 *   172.16.4.130/26
 *   ```
 *
 * 渲染掩码 / 通配符 / 可用范围 / 广播 / 主机数 + 子网划分表（/25.. /30）。
 * 纯 JS 零依赖，进 devtools 插件家族；解析失败回退普通代码块高亮。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // ============== IPv4 数值计算 ==============

  function ipToInt(ip) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim());
    if (!m) return null;
    const parts = m.slice(1).map(Number);
    if (parts.some(n => n > 255)) return null;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  function intToIp(n) {
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  function maskOf(prefix) {
    return prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
  }

  function isPrivate(ipInt) {
    const a = (ipInt >>> 24) & 255, b = (ipInt >>> 16) & 255;
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      a === 127 || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }

  function calcNetwork(ipStr, prefix) {
    const ip = ipToInt(ipStr);
    if (ip === null || prefix < 0 || prefix > 32) return null;
    const mask = maskOf(prefix);
    const network = (ip & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const total = Math.pow(2, 32 - prefix);
    const usable = prefix >= 31 ? total : total - 2;
    const first = prefix >= 31 ? network : network + 1;
    const last = prefix >= 31 ? broadcast : broadcast - 1;
    return {
      ip, ipStr: intToIp(ip), prefix, mask, network, broadcast,
      wildcard: (~mask >>> 0), total, usable,
      firstHost: intToIp(first), lastHost: intToIp(last),
      private: isPrivate(ip)
    };
  }

  // 子网划分表：/25.. /30 逐级列出（每级最多展示 8 个，超出计数）
  function divisions(n) {
    const rows = [];
    for (let p = Math.min(n.prefix + 1, 30); p <= 30; p++) {
      const subMask = maskOf(p);
      const size = Math.pow(2, 32 - p);
      const count = Math.pow(2, p - n.prefix);
      const subs = [];
      for (let i = 0; i < Math.min(count, 8); i++) {
        const net = (n.network + i * size) >>> 0;
        subs.push(`${intToIp(net)}/${p}`);
      }
      rows.push({ prefix: p, count, size, subs, more: count - Math.min(count, 8) });
    }
    return rows;
  }

  // ============== 渲染 ==============

  function fieldRow(label, value, extra) {
    return `<div class="ipcalc-field"><span class="ipcalc-field-label">${esc(label)}</span>` +
      `<code class="ipcalc-field-value">${esc(value)}</code>${extra || ''}</div>`;
  }

  function widgetFor(n) {
    const cidr = `${n.ipStr}/${n.prefix}`;
    const w = document.createElement('div');
    w.className = 'ipcalc-widget';
    w.innerHTML = `
      <div class="ipcalc-head">
        <span class="ipcalc-cidr">${esc(cidr)}</span>
        ${n.private ? `<span class="ipcalc-badge">${esc(t('ipcalc.private', '私有地址'))}</span>` : ''}
      </div>
      <div class="ipcalc-grid">
        ${fieldRow(t('ipcalc.network', '网络地址'), `${intToIp(n.network)}/${n.prefix}`)}
        ${fieldRow(t('ipcalc.mask', '子网掩码'), intToIp(n.mask))}
        ${fieldRow(t('ipcalc.wildcard', '通配符掩码'), intToIp(n.wildcard))}
        ${fieldRow(t('ipcalc.broadcast', '广播地址'), intToIp(n.broadcast))}
        ${fieldRow(t('ipcalc.hostRange', '可用主机范围'), `${n.firstHost} — ${n.lastHost}`)}
        ${fieldRow(t('ipcalc.hosts', '可用主机数'), `${n.usable.toLocaleString()}（共 ${n.total.toLocaleString()}）`)}
      </div>
    `;
    const div = divisions(n);
    if (div.length) {
      const rows = div.map(d => `
        <tr>
          <td><code>/${d.prefix}</code></td>
          <td><code>${esc(intToIp(maskOf(d.prefix)))}</code></td>
          <td>${d.count.toLocaleString()}</td>
          <td class="ipcalc-subnets">${d.subs.map(s => `<code>${esc(s)}</code>`).join('')}${d.more > 0 ? `<span class="ipcalc-more">+${d.more}</span>` : ''}</td>
        </tr>`).join('');
      const wrap = document.createElement('div');
      wrap.className = 'ipcalc-divisions';
      wrap.innerHTML = `
        <div class="ipcalc-divisions-title">${esc(t('ipcalc.divisions', '子网划分'))}</div>
        <table>
          <thead><tr>
            <th>${esc(t('ipcalc.prefix', '前缀'))}</th>
            <th>${esc(t('ipcalc.mask', '子网掩码'))}</th>
            <th>${esc(t('ipcalc.subnetCount', '子网数'))}</th>
            <th>${esc(t('ipcalc.subnetList', '子网（前 8 个）'))}</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
      w.appendChild(wrap);
    }
    return w;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = pre.dataset.lang || '';
      if (!/^ipcalc(\s|$)/.test(lang.trim()) && lang.trim() !== 'ipcalc') return;
      const body = (lang.replace(/^ipcalc\s*/, '').trim() + '\n' +
        (pre.querySelector('code')?.textContent ?? '')).trim();
      if (!body) return;

      const widget = document.createElement('div');
      widget.className = 'ipcalc-widget-group';
      let parsed = 0;
      body.split(/\n+/).forEach(line => {
        const m = /^\s*([0-9.]+)(?:\/(\d{1,2}))?\s*$/.exec(line);
        if (!m) return;
        const n = calcNetwork(m[1], m[2] === undefined ? 32 : parseInt(m[2], 10));
        if (!n) return;
        widget.appendChild(widgetFor(n));
        parsed++;
      });
      if (parsed === 0) return; // 解析失败：保留原代码块走高亮回退
      pre.parentNode.replaceChild(widget, pre);
    });
  }

  window.MarkdownPreview.renderers.ipcalc = { render };
})();
