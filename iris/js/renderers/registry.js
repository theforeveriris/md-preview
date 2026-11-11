/**
 * 协议注册表块（B3）
 *
 * Markdown 语法：
 *   ```registry
 *   port name proto description
 *   22   ssh   tcp  Secure Shell
 *   53   dns   udp  Domain Name System
 *   ```
 *   ```registry common
 *   —— 显示内置常用协议表
 *   @[registry](common) —— 嵌入内置协议表
 *
 * 渲染为可搜索、可排序的表格，复用 B1 表格工具。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const COMMON = [
    [20, 'ftp-data', 'tcp', 'File Transfer (data)'],
    [21, 'ftp', 'tcp', 'File Transfer Control'],
    [22, 'ssh', 'tcp', 'Secure Shell'],
    [23, 'telnet', 'tcp', 'Telnet'],
    [25, 'smtp', 'tcp', 'Simple Mail Transfer'],
    [53, 'domain', 'udp', 'Domain Name System'],
    [67, 'bootps', 'udp', 'BOOTP / DHCP server'],
    [68, 'bootpc', 'udp', 'BOOTP / DHCP client'],
    [69, 'tftp', 'udp', 'Trivial File Transfer'],
    [80, 'http', 'tcp', 'HTTP'],
    [110, 'pop3', 'tcp', 'Post Office Protocol v3'],
    [123, 'ntp', 'udp', 'Network Time Protocol'],
    [137, 'netbios-ns', 'udp', 'NetBIOS Name Service'],
    [138, 'netbios-dgm', 'udp', 'NetBIOS Datagram'],
    [139, 'netbios-ssn', 'tcp', 'NetBIOS Session'],
    [143, 'imap', 'tcp', 'Internet Message Access'],
    [161, 'snmp', 'udp', 'Simple Network Management'],
    [162, 'snmptrap', 'udp', 'SNMP Trap'],
    [389, 'ldap', 'tcp', 'Lightweight Directory Access'],
    [443, 'https', 'tcp', 'HTTPS / TLS'],
    [445, 'microsoft-ds', 'tcp', 'SMB / CIFS'],
    [465, 'smtps', 'tcp', 'SMTP over TLS'],
    [500, 'isakmp', 'udp', 'ISAKMP / IKE'],
    [514, 'syslog', 'udp', 'Syslog'],
    [520, 'rip', 'udp', 'Routing Information Protocol'],
    [546, 'dhcpv6-client', 'udp', 'DHCPv6 client'],
    [547, 'dhcpv6-server', 'udp', 'DHCPv6 server'],
    [587, 'submission', 'tcp', 'SMTP Submission'],
    [636, 'ldaps', 'tcp', 'LDAP over TLS'],
    [853, 'domain-s', 'tcp', 'DNS over TLS'],
    [873, 'rsync', 'tcp', 'Rsync'],
    [993, 'imaps', 'tcp', 'IMAP over TLS'],
    [995, 'pop3s', 'tcp', 'POP3 over TLS'],
    [1080, 'socks', 'tcp', 'SOCKS proxy'],
    [1194, 'openvpn', 'udp', 'OpenVPN'],
    [1812, 'radius', 'udp', 'RADIUS'],
    [1883, 'mqtt', 'tcp', 'MQTT'],
    [2049, 'nfs', 'tcp', 'Network File System'],
    [2375, 'docker', 'tcp', 'Docker API'],
    [3306, 'mysql', 'tcp', 'MySQL'],
    [3389, 'ms-wbt-server', 'tcp', 'RDP'],
    [5060, 'sip', 'udp', 'SIP'],
    [5432, 'postgresql', 'tcp', 'PostgreSQL'],
    [5601, 'kibana', 'tcp', 'Kibana'],
    [5672, 'amqp', 'tcp', 'AMQP'],
    [6379, 'redis', 'tcp', 'Redis'],
    [8080, 'http-alt', 'tcp', 'HTTP alternate'],
    [8443, 'https-alt', 'tcp', 'HTTPS alternate'],
    [9000, 'php-fpm', 'tcp', 'PHP-FPM'],
    [9090, 'prometheus', 'tcp', 'Prometheus'],
    [9200, 'elasticsearch', 'tcp', 'Elasticsearch'],
    [9300, 'elasticsearch', 'tcp', 'Elasticsearch transport'],
    [11211, 'memcached', 'tcp', 'Memcached'],
    [27017, 'mongodb', 'tcp', 'MongoDB']
  ];

  // 行列数多于表头时，把多余部分并回最后一列（如含空格的 description）
  function fitRow(r, n) {
    r = r.filter(Boolean);
    if (r.length > n && n >= 1) {
      return r.slice(0, n - 1).concat([r.slice(n - 1).join(' ')]);
    }
    return r;
  }

  function parseRegistry(text) {
    const raw = String(text || '').trim();
    if (!raw) return { common: true };
    if (/^\s*common\s*$/i.test(raw)) return { common: true };
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    // 表头 + 分隔
    for (let i = 0; i < lines.length; i++) {
      if (/^[-\s|]+$/.test(lines[i]) && i > 0) {
        const header = lines[i - 1].split(/\s*\|\s*|\s{2,}/).filter(Boolean);
        const rows = lines.slice(i + 1).map(l => fitRow(l.split(/\s*\|\s*|\s{2,}/), header.length));
        return { header, rows };
      }
    }
    // 管道行
    if (lines.every(l => l.includes('|'))) {
      const header = lines[0].split('|').map(s => s.trim()).filter(Boolean);
      const rows = lines.slice(1).map(l => fitRow(l.split('|').map(s => s.trim()), header.length));
      return { header, rows };
    }
    // 空格列（含表头）：行按 ≥2 空格切，不足处由单空格兜底
    if (lines.length >= 2) {
      const header = lines[0].split(/\s{2,}|\s+/).filter(Boolean);
      const rows = lines.slice(1).map(l => fitRow(l.split(/\s{2,}/), header.length));
      if (header.length >= 2) return { header, rows };
    }
    return null;
  }

  function renderFence(pre) {
    const parsed = parseRegistry(pre.querySelector('code')?.textContent || '');
    if (!parsed) return false;
    const widget = document.createElement('div');
    widget.className = 'registry-view';

    const head = document.createElement('div');
    head.className = 'nt-head';
    const header = parsed.common ? ['Port', 'Name', 'Proto', 'Description'] : parsed.header;
    const rows = parsed.common ? COMMON : parsed.rows;
    head.innerHTML = '<span class="nt-title">' + esc(t('registry.title', '协议注册表')) + '</span>' +
      '<span class="nt-meta">' + esc(rows.length) + ' ' + esc(t('registry.entries', '条')) + '</span>';
    widget.appendChild(head);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    header.forEach(h => { const th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
    thead.appendChild(tr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach(r => {
      const row = document.createElement('tr');
      header.forEach((_, i) => {
        const td = document.createElement('td');
        td.textContent = r[i] != null ? r[i] : '';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    const wrap = document.createElement('div');
    wrap.className = 'table-wrapper mdt-wrapper';
    wrap.appendChild(table);
    widget.appendChild(wrap);

    pre.replaceWith(widget);
    if (window.MarkdownPreview.renderers.tables) window.MarkdownPreview.renderers.tables.render(widget);
    return true;
  }

  function renderEmbed(el) {
    const widget = document.createElement('div');
    widget.className = 'registry-view';
    const head = document.createElement('div');
    head.className = 'nt-head';
    head.innerHTML = '<span class="nt-title">' + esc(t('registry.title', '协议注册表')) + '</span>' +
      '<span class="nt-meta">' + esc(COMMON.length) + ' ' + esc(t('registry.entries', '条')) + '</span>';
    widget.appendChild(head);
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Port</th><th>Name</th><th>Proto</th><th>Description</th></tr></thead>';
    const tbody = document.createElement('tbody');
    COMMON.forEach(r => {
      const tr = document.createElement('tr');
      r.forEach(c => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const wrap = document.createElement('div');
    wrap.className = 'table-wrapper mdt-wrapper';
    wrap.appendChild(table);
    widget.appendChild(wrap);
    el.replaceWith(widget);
    if (window.MarkdownPreview.renderers.tables) window.MarkdownPreview.renderers.tables.render(widget);
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block').forEach(pre => {
      if (pre.dataset.registryDone) return;
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      if (lang === 'registry') {
        pre.dataset.registryDone = '1';
        renderFence(pre);
      }
    });
  }

  window.MarkdownPreview.renderers.registry = { render, renderEmbed };
})();
