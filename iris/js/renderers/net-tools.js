/**
 * Nmap / dig / BGP 专用视图（C4）
 *
 * Markdown 语法：
 *   ```nmap     Nmap 输出（normal / grepable / XML）
 *   ```dig      dig / nslookup 输出
 *   ```bgp      show ip bgp / show bgp summary
 *
 * 渲染为带协议语义的表格/分区视图：
 *   - Nmap：端口矩阵、开放端口统计、风险色
 *   - dig：按 ANSWER/AUTHORITY/ADDITIONAL 分区，记录类型/TTL/目标
 *   - BGP：前缀表、下一跳、AS Path chips、Local Pref/Med、best 标记
 *
 * 复用 B1 表格交互；解析失败回退源码。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const DNS_TYPES = {
    1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 15: 'MX', 16: 'TXT', 28: 'AAAA',
    33: 'SRV', 35: 'NAPTR', 39: 'DNAME', 43: 'DS', 44: 'SSHFP', 48: 'DNSKEY',
    50: 'NSEC3PARAM', 65: 'HTTPS', 99: 'SPF', 257: 'CAA'
  };
  const BGP_STATE = { i: 'i', e: 'e', '?': '?', h: 'h', s: 's', '*': '*' };

  function riskClass(state) {
    if (state === 'open') return 'nt-open';
    if (state === 'filtered') return 'nt-filtered';
    return 'nt-closed';
  }

  // ============== Nmap ==============
  function parseNmap(text) {
    const raw = String(text || '');
    const ports = [];
    let host = '';
    let mode = 'normal';

    if (/<nmaprun/i.test(raw)) {
      mode = 'xml';
      try {
        const doc = new DOMParser().parseFromString(raw, 'application/xml');
        host = (doc.querySelector('host[name]')?.getAttribute('name') ||
          doc.querySelector('host[address]')?.getAttribute('addr') || '');
        doc.querySelectorAll('port').forEach(p => {
          const state = p.querySelector('state')?.getAttribute('state') || '';
          const service = p.querySelector('service')?.getAttribute('name') || '';
          const version = p.querySelector('service')?.getAttribute('version') || '';
          ports.push({ port: p.getAttribute('portid'), proto: p.getAttribute('protocol') || 'tcp', state, service, version });
        });
      } catch (e) { return null; }
    } else if (/^# Starting Nmap/i.test(raw) || /^Host:\s/i.test(raw)) {
      mode = 'grepable';
      raw.split(/\r?\n/).forEach(line => {
        const m = /^(\d+)\/(tcp|udp)\s+(open|closed|filtered)\s*(.*)$/.exec(line.trim());
        if (m) ports.push({ port: m[1], proto: m[2], state: m[3], service: m[4].split(/\s+/)[0] || '', version: m[4] });
      });
    } else {
      raw.split(/\r?\n/).forEach(line => {
        const hostM = /Nmap scan report for (.+)$/.exec(line);
        if (hostM) host = hostM[1];
        const portM = /^\s*(\d+)\/(tcp|udp)\s+(open|closed|filtered)\s+([^\s]+)(?:\s+(.*))?$/.exec(line);
        if (portM) {
          ports.push({ port: portM[1], proto: portM[2], state: portM[3], service: portM[4], version: portM[5] || '' });
        }
      });
    }
    if (!ports.length) return null;
    return { host, mode, ports };
  }

  function renderNmap(pre) {
    const parsed = parseNmap(pre.querySelector('code')?.textContent || '');
    if (!parsed) return false;
    const widget = document.createElement('div');
    widget.className = 'nt-view nmap-view';

    const head = document.createElement('div');
    head.className = 'nt-head';
    const openCount = parsed.ports.filter(p => p.state === 'open').length;
    head.innerHTML =
      '<span class="nt-title">' + esc(t('nmap.title', 'Nmap 端口扫描')) + '</span>' +
      '<span class="nt-meta">' + esc(parsed.host || '—') + ' · ' + esc(t('nmap.ports', '{n} 端口').replace('{n}', parsed.ports.length)) + ' · ' +
      esc(t('nmap.open', '{n} 开放').replace('{n}', openCount)) + '</span>';
    widget.appendChild(head);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Port</th><th>Proto</th><th>State</th><th>Service</th><th>Version</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    parsed.ports.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="nt-port">' + esc(p.port) + '</td>' +
        '<td>' + esc(p.proto) + '</td>' +
        '<td class="nt-state ' + riskClass(p.state) + '">' + esc(p.state) + '</td>' +
        '<td>' + esc(p.service) + '</td>' +
        '<td>' + esc(p.version) + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    widget.appendChild(table);
    pre.replaceWith(widget);
    if (window.MarkdownPreview.renderers.tables) window.MarkdownPreview.renderers.tables.render(widget);
    return true;
  }

  // ============== dig / nslookup ==============
  function parseDig(text) {
    const raw = String(text || '');
    const lines = raw.split(/\r?\n/);
    const sections = {};
    let current = null;
    let server = '';
    let queryTime = '';
    const answer = [];

    const sectionRe = /^;;\s*(ANSWER|AUTHORITY|ADDITIONAL) SECTION:/i;
    for (const line of lines) {
      const sec = sectionRe.exec(line);
      if (sec) { current = sec[1].toUpperCase(); if (!sections[current]) sections[current] = []; continue; }
      if (/^;/.test(line)) continue;
      const srv = /^SERVER:\s*(.+)$/i.exec(line);
      if (srv) { server = srv[1]; continue; }
      const qt = /^Query time:\s*(.+)$/i.exec(line);
      if (qt) { queryTime = qt[1]; continue; }
      if (current && /^\S+\s+\d+\s+\S+\s+\S+\s+.+/.test(line)) {
        const parts = line.trim().split(/\s+/);
        const rec = {
          name: parts[0],
          type: DNS_TYPES[parts[1]] || parts[1],
          ttl: parts[2],
          target: parts.slice(3).join(' ')
        };
        answer.push(rec);
        if (sections[current]) sections[current].push(rec);
      }
    }
    if (!answer.length) return null;
    return { server, queryTime, sections, answer };
  }

  function renderDig(pre) {
    const parsed = parseDig(pre.querySelector('code')?.textContent || '');
    if (!parsed) return false;
    const widget = document.createElement('div');
    widget.className = 'nt-view dig-view';

    const head = document.createElement('div');
    head.className = 'nt-head';
    head.innerHTML =
      '<span class="nt-title">' + esc(t('dig.title', 'DNS 查询')) + '</span>' +
      '<span class="nt-meta">' + esc(parsed.server ? 'Server: ' + parsed.server : '') +
      (parsed.queryTime ? ' · ' + esc(t('dig.time', '耗时') + ': ' + parsed.queryTime) : '') + '</span>';
    widget.appendChild(head);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Name</th><th>Type</th><th>TTL</th><th>Target</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    parsed.answer.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(r.name) + '</td>' +
        '<td><span class="nt-type">' + esc(r.type) + '</span></td>' +
        '<td>' + esc(r.ttl) + '</td>' +
        '<td>' + esc(r.target) + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    const wrap = document.createElement('div');
    wrap.className = 'table-wrapper mdt-wrapper';
    wrap.appendChild(table);
    widget.appendChild(wrap);

    const sectionsInfo = Object.keys(parsed.sections)
      .map(k => esc(k) + ' ' + parsed.sections[k].length).join(' · ');
    if (sectionsInfo) {
      const foot = document.createElement('div');
      foot.className = 'nt-foot';
      foot.textContent = sectionsInfo;
      widget.appendChild(foot);
    }
    pre.replaceWith(widget);
    if (window.MarkdownPreview.renderers.tables) window.MarkdownPreview.renderers.tables.render(widget);
    return true;
  }

  // ============== BGP ==============
  function parseBgp(text) {
    const raw = String(text || '');
    const lines = raw.split(/\r?\n/);
    const prefixes = [];
    const summary = [];
    let isSummary = false;

    lines.forEach(line => {
      if (/Neighbor\s+AS\s+Status/i.test(line)) isSummary = true;
      if (/^Network\s+Next-Hop/i.test(line)) isSummary = false;
      if (isSummary) {
        const m = /^\s*(\S+)\s+(\d+)\s+(\w+)\s+(\d+)\s+(\d+)\s+(\d+)\s*(.*)$/.exec(line.trim());
        if (m) summary.push({ neighbor: m[1], as: m[2], status: m[3], recv: m[4], sent: m[5] });
        return;
      }
      // 前缀行：* Network Next-Hop Metric LocPrf Weight Path
      const m = /^\s*(\*?)\s*(\S+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S.*)$/.exec(line.trim());
      if (m && /\d+\.\d+\.\d+\.\d+/.test(m[3])) {
        const best = m[1] === '*';
        prefixes.push({
          network: m[2], nextHop: m[3], metric: m[4], locPrf: m[5], weight: m[6],
          path: m[7].trim().split(/\s+/).filter(Boolean), best
        });
      }
    });
    if (!prefixes.length && !summary.length) return null;
    return { prefixes, summary };
  }

  function asChip(token) {
    if (token === 'i') return { text: 'i', cls: 'nt-as-learned' };
    if (token === '?') return { text: '?', cls: 'nt-as-unknown' };
    if (/^\d+/.test(token)) {
      const last = token.slice(-1);
      return { text: token, cls: last === 'i' ? 'nt-as-learned' : (last === 'e' ? 'nt-as-external' : 'nt-as-chip') };
    }
    return { text: token, cls: 'nt-as-chip' };
  }

  function renderBgp(pre) {
    const parsed = parseBgp(pre.querySelector('code')?.textContent || '');
    if (!parsed) return false;
    const widget = document.createElement('div');
    widget.className = 'nt-view bgp-view';

    const head = document.createElement('div');
    head.className = 'nt-head';
    head.innerHTML = '<span class="nt-title">' + esc(t('bgp.title', 'BGP 前缀')) + '</span>' +
      '<span class="nt-meta">' + esc(t('bgp.prefixes', '{n} 前缀').replace('{n}', parsed.prefixes.length)) + '</span>';
    widget.appendChild(head);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Network</th><th>Next-Hop</th><th>Metric</th><th>LocPrf</th><th>Weight</th><th>AS Path</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    parsed.prefixes.forEach(p => {
      const tr = document.createElement('tr');
      const chips = p.path.map(tok => {
        const c = asChip(tok);
        return '<span class="nt-as ' + c.cls + '">' + esc(c.text) + '</span>';
      }).join('');
      tr.innerHTML =
        '<td class="nt-net' + (p.best ? ' nt-best' : '') + '">' +
          (p.best ? '<span class="nt-star" aria-hidden="true">★</span>' : '') +
          '<span class="nt-net-text">' + esc(p.network) + '</span>' +
        '</td>' +
        '<td>' + esc(p.nextHop) + '</td>' +
        '<td>' + esc(p.metric) + '</td>' +
        '<td>' + esc(p.locPrf) + '</td>' +
        '<td>' + esc(p.weight) + '</td>' +
        '<td class="nt-aspath">' + chips + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    widget.appendChild(table);

    if (parsed.summary.length) {
      const sub = document.createElement('div');
      sub.className = 'nt-summary';
      // 第二张表加个小标题，两张表的关系一眼可辨
      const label = document.createElement('div');
      label.className = 'nt-subtitle';
      label.textContent = t('bgp.neighbors', '邻居');
      sub.appendChild(label);
      const st = document.createElement('table');
      st.innerHTML = '<thead><tr><th>Neighbor</th><th>AS</th><th>Status</th><th>PfxRcvd</th><th>PfxSent</th></tr></thead>';
      const stb = document.createElement('tbody');
      parsed.summary.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + esc(s.neighbor) + '</td><td>' + esc(s.as) + '</td>' +
          '<td class="nt-state ' + (s.status === 'Established' ? 'nt-open' : 'nt-filtered') + '">' + esc(s.status) + '</td>' +
          '<td>' + esc(s.recv) + '</td><td>' + esc(s.sent) + '</td>';
        stb.appendChild(tr);
      });
      st.appendChild(stb);
      sub.appendChild(st);
      widget.appendChild(sub);
    }
    pre.replaceWith(widget);
    if (window.MarkdownPreview.renderers.tables) window.MarkdownPreview.renderers.tables.render(widget);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block').forEach(pre => {
      if (pre.dataset.ntDone) return;
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      pre.dataset.ntDone = '1';
      if (lang === 'nmap') renderNmap(pre);
      else if (lang === 'dig' || lang === 'nslookup') renderDig(pre);
      else if (lang === 'bgp') renderBgp(pre);
    });
  }

  window.MarkdownPreview.renderers.nmap = { render };
  window.MarkdownPreview.renderers.dig = { render };
  window.MarkdownPreview.renderers.bgp = { render };
})();
