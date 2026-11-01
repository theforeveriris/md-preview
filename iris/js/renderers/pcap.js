/**
 * pcap - 抓包文件渲染器（类 Wireshark 包列表）
 *
 * Markdown 语法（两种）：
 *   1. 构建期产物引用（推荐，仓库内 .pcap 经 Python 脚本转 JSON）：
 *      ```pcap
 *      @[pcap](demo)
 *      ```
 *      → fetch iris/data/pcap/json/demo.json
 *   2. 内嵌 JSON（与 apexcharts 同惯例）：
 *      ```pcap { "packets": [...] }
 *
 * 能力：
 *   - 包列表：No / 时间 / 源地址 / 目的地址 / 协议 / 长度 / 摘要
 *   - 协议着色（TCP 绿 / UDP 蓝 / ICMP 粉 / DNS 青 / ARP 橙 …）
 *   - 列排序（点击表头）+ display filter（BPF 风格简版：
 *     tcp、udp port 53、ip.src==192.168.1.1、dns 等关键字过滤）
 *   - 点击行展开字段树（完整协议栈逐层键值）
 *   - 协议分布统计条 + 包数徽章
 *   - 主题变量着色，跟随明暗
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  const icon = window.MarkdownPreview.icon;

  // 协议 → 颜色档（走主题变量，暗色自动适配）
  const PROTO_CLS = {
    TCP: 'pc-proto-tcp', UDP: 'pc-proto-udp', ICMP: 'pc-proto-icmp',
    DNS: 'pc-proto-dns', ARP: 'pc-proto-arp', TLS: 'pc-proto-tls',
    HTTP: 'pc-proto-http', DHCP: 'pc-proto-dhcp', IPv6: 'pc-proto-ipv6',
    SSDP: 'pc-proto-ssdp', MDNS: 'pc-proto-dns', NBNS: 'pc-proto-dns',
    IGMP: 'pc-proto-igmp', OSPF: 'pc-proto-ospf'
  };
  // 端口 → 应用层协议识别（无 DPI，纯端口约定）
  const WELL_PORTS = { 53: 'DNS', 80: 'HTTP', 443: 'TLS', 67: 'DHCP', 68: 'DHCP', 123: 'NTP', 1900: 'SSDP', 5353: 'MDNS', 137: 'NBNS', 520: 'RIP', 179: 'BGP', 22: 'SSH', 21: 'FTP', 25: 'SMTP', 110: 'POP3', 143: 'IMAP', 3389: 'RDP' };

  const MAX_RENDER_ROWS = 2000;

  function protoClass(proto) { return PROTO_CLS[String(proto || '').toUpperCase()] || 'pc-proto-other'; }

  // 入口字段净化：no/length/port 在模板里不经 esc 直接插值（数字语境），
  // 内嵌 JSON 可注入字符串——统一在此钳制成有限数字或 ''，
  // 消除存储型 XSS 面（mdRender.escapeHtml 注释把文档内容视为不可信输入）
  function toCount(v) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n < Number.MAX_SAFE_INTEGER ? n : 0;
  }

  function enrich(entry) {
    // 摘要增强：知名端口识别为应用层协议（TCP 53 → DNS），填 stack 尾部
    const e = Object.assign({}, entry);
    e.no = toCount(e.no);
    e.length = toCount(e.length);
    e.time = Number(e.time) || 0;
    if (e.srcPort != null) e.srcPort = toCount(e.srcPort);
    if (e.dstPort != null) e.dstPort = toCount(e.dstPort);
    if (Array.isArray(e.stack)) e.stack = e.stack.map(x => String(x));
    else e.stack = [];
    e.proto = String(e.proto || '').slice(0, 24);
    if (e.info != null) e.info = String(e.info).slice(0, 300);
    if ((e.proto === 'TCP' || e.proto === 'UDP') && !/^[A-Z]/.test((e.stack && e.stack[e.stack.length - 1]) || '')) {
      const app = WELL_PORTS[e.dstPort] || WELL_PORTS[e.srcPort];
      if (app) {
        e.appProto = app;
        e.stack = (e.stack || []).concat([app]);
      }
    }
    return e;
  }

  // ============== display filter（BPF 简版） ==============
  // 支持：协议名（tcp/udp/icmp/dns/arp/tls/http…）、addr==x、src==x、dst==x、
  //       port N、src port N / dst port N、len>N / len<N，空格 AND 组合（隐式与）。
  // 带空格的谓词（src port 53）不能先按空白切 token——正则整体扫描拼接串
  function parseFilter(q) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return null;
    // 全局扫描：命中一个谓词就消费掉，剩余部分递归处理；未命中的首个
    // 空白段作为协议名 token
    const preds = [];
    const PATTERNS = [
      { re: /(?:ip\.)?src\s*==\s*(\S+)/, mk: m => ({ type: 'src', v: m[1] }) },
      { re: /(?:ip\.)?dst\s*==\s*(\S+)/, mk: m => ({ type: 'dst', v: m[1] }) },
      { re: /(?:ip\.)?addr\s*==\s*(\S+)/, mk: m => ({ type: 'addr', v: m[1] }) },
      { re: /src\s+port\s+(\d+)/, mk: m => ({ type: 'sport', v: Number(m[1]) }) },
      { re: /dst\s+port\s+(\d+)/, mk: m => ({ type: 'dport', v: Number(m[1]) }) },
      { re: /\bport\s+(\d+)/, mk: m => ({ type: 'port', v: Number(m[1]) }) },
      { re: /len\s*([<>])\s*(\d+)/, mk: m => ({ type: 'len', op: m[1], v: Number(m[2]) }) }
    ];
    let rest = s;
    let guard = 0;
    while (rest.trim() && guard++ < 50) {
      const trimmed = rest.trim();
      let matched = false;
      for (const p of PATTERNS) {
        const m = p.re.exec(trimmed);
        // 只接受从前缀开始的命中（如 "port 53" / "src == x"），避免吞掉
        // 中段的碎片
        if (m && m.index === 0) {
          preds.push(p.mk(m));
          rest = trimmed.slice(m[0].length);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      // 没有谓词前缀：消费一个词作为协议名
      const word = /^(\S+)\s*/.exec(trimmed);
      preds.push({ type: 'proto', v: word[1] });
      rest = trimmed.slice(word[0].length);
    }
    return preds.length ? preds : null;
  }

  function matchEntry(entry, preds) {
    if (!preds) return true;
    const stackText = (entry.stack || []).join(' ').toLowerCase();
    return preds.every(p => {
      switch (p.type) {
        case 'proto':
          if (p.v === 'ip') return !entry.proto || /^(TCP|UDP|ICMP|DNS|HTTP|TLS|IP)$/.test(entry.proto);
          return entry.proto.toLowerCase().includes(p.v) || stackText.includes(p.v);
        case 'src': return String(entry.src || '').toLowerCase() === p.v;
        case 'dst': return String(entry.dst || '').toLowerCase() === p.v;
        case 'addr': return String(entry.src || '').toLowerCase() === p.v || String(entry.dst || '').toLowerCase() === p.v;
        case 'sport': return entry.srcPort === p.v;
        case 'dport': return entry.dstPort === p.v;
        case 'port': return entry.srcPort === p.v || entry.dstPort === p.v;
        case 'len': return p.op === '>' ? entry.length > p.v : entry.length < p.v;
        default: return true;
      }
    });
  }

  // ============== 字段树（点击行展开） ==============
  function fieldTreeHtml(entry) {
    const rows = [];
    const push = (depth, k, v) => rows.push(
      `<div class="pc-field" style="padding-left:${8 + depth * 16}px"><span class="pc-field-k">${esc(k)}</span><span class="pc-field-v">${esc(String(v))}</span></div>`
    );
    push(0, 'Frame', `#${entry.no} · ${entry.length} bytes`);
    push(0, 'Time', `+${Number(entry.time).toFixed(6)}s`);
    (entry.stack || []).forEach((layer, i) => push(0, `Layer ${i + 1}`, layer));
    push(0, 'Protocol', entry.proto);
    if (entry.src != null) push(1, 'Source', entry.src + (entry.srcPort ? ':' + entry.srcPort : ''));
    if (entry.dst != null) push(1, 'Destination', entry.dst + (entry.dstPort ? ':' + entry.dstPort : ''));
    if (entry.srcPort != null) push(1, 'Source Port', entry.srcPort);
    if (entry.dstPort != null) push(1, 'Destination Port', entry.dstPort);
    if (entry.info) push(1, 'Info', entry.info);
    return rows.join('');
  }

  // ============== 构建 widget ==============
  function buildWidget(pre, data) {
    const widget = document.createElement('div');
    widget.className = 'pcap-table';
    widget.dataset.src = JSON.stringify(data); // 工具条复制源码用

    if (data.error) {
      widget.innerHTML = `<div class="pcap-error">${esc(t('pcap.parseFailed', '抓包文件解析失败'))}：${esc(data.error)}</div>`;
      pre.parentNode.replaceChild(widget, pre);
      return;
    }

    const allPackets = (data.packets || []).map(enrich);
    let sortCol = -1;
    let sortDir = 1;
    let filterText = '';

    widget.innerHTML = `
      <div class="pcap-toolbar">
        <div class="pcap-filter">
          ${icon('i-filter', 13)}
          <input type="search" class="pcap-filter-input" spellcheck="false"
                 placeholder="${esc(t('pcap.filterPlaceholder', '显示过滤：tcp、dns、port 53、src==10.0.0.1…'))}"
                 aria-label="${esc(t('pcap.filterPlaceholder', '显示过滤'))}">
        </div>
        <span class="pcap-count" role="status"></span>
        <span class="pcap-toolbar-space"></span>
        <span class="pcap-file-badge">${esc(data.file || '')}${data.backend ? ' · ' + esc(data.backend) : ''}</span>
      </div>
      <div class="pcap-proto-bar" aria-hidden="true"></div>
      <div class="pcap-scroll">
        <table class="pcap-grid">
          <thead><tr>
            <th data-col="no" class="pc-num">#</th>
            <th data-col="time">${esc(t('pcap.time', '时间'))}</th>
            <th data-col="src">${esc(t('pcap.source', '源地址'))}</th>
            <th data-col="dst">${esc(t('pcap.destination', '目的地址'))}</th>
            <th data-col="proto">${esc(t('pcap.protocol', '协议'))}</th>
            <th data-col="length" class="pc-num">${esc(t('pcap.length', '长度'))}</th>
            <th data-col="info">${esc(t('pcap.info', '摘要'))}</th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <div class="pcap-detail" hidden></div>
    `;

    const tbody = widget.querySelector('tbody');
    const countEl = widget.querySelector('.pcap-count');
    const protoBar = widget.querySelector('.pcap-proto-bar');
    const detail = widget.querySelector('.pcap-detail');
    let detailNo = null;

    function visibleRows() {
      const preds = parseFilter(filterText);
      const rows = allPackets.filter(p => matchEntry(p, preds));
      if (sortCol >= 0) {
        const key = ['no', 'time', 'src', 'dst', 'proto', 'length', 'info'][sortCol];
        rows.sort((a, b) => {
          const av = a[key], bv = b[key];
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sortDir;
          return String(av == null ? '' : av).localeCompare(String(bv == null ? '' : bv), 'zh-Hans-CN') * sortDir;
        });
      }
      return rows;
    }

    function renderProtoBar(rows) {
      // 协议分布：按当前过滤结果统计（过滤本身就是协议分析工作流）
      const counts = new Map();
      rows.forEach(p => {
        const k = p.appProto || p.proto || 'OTHER';
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      const total = rows.length || 1;
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      protoBar.innerHTML = sorted.map(([name, n]) => {
        const pct = Math.max(1.2, (n / total) * 100);
        const cls = protoClass(name === 'OTHER' ? 'other' : name);
        return `<span class="pcap-proto-seg ${cls}" style="flex-grow:${n}" title="${esc(name)} ${n} (${Math.round(n / total * 100)}%)"></span>`;
      }).join('') + `<span class="pcap-proto-legend">${sorted.map(([name, n]) =>
        `<span class="pcap-legend-item"><span class="pcap-dot ${protoClass(name === 'OTHER' ? 'other' : name)}"></span>${esc(name)} ${n}</span>`).join('')}</span>`;
    }

    function render() {
      const rows = visibleRows();
      const shown = rows.slice(0, MAX_RENDER_ROWS);
      tbody.innerHTML = shown.map(p => `
        <tr class="pcap-row" data-no="${p.no}" data-pidx="${allPackets.indexOf(p)}">
          <td class="pc-num">${p.no}</td>
          <td class="pc-num">${Number(p.time).toFixed(6)}</td>
          <td class="pc-addr">${esc(p.src != null ? p.src + (p.srcPort ? ':' + p.srcPort : '') : '')}</td>
          <td class="pc-addr">${esc(p.dst != null ? p.dst + (p.dstPort ? ':' + p.dstPort : '') : '')}</td>
          <td><span class="pcap-proto-chip ${protoClass(p.appProto || p.proto)}">${esc(p.appProto || p.proto || '')}</span></td>
          <td class="pc-num">${p.length}</td>
          <td class="pc-info" title="${esc(p.info || '')}">${esc(p.info || '')}</td>
        </tr>`).join('');
      countEl.textContent = t('pcap.count', '{shown} / {total} 包')
        .replace('{shown}', rows.length).replace('{total}', allPackets.length);
      renderProtoBar(rows);
      if (rows.length > MAX_RENDER_ROWS) {
        countEl.textContent += t('pcap.renderCapped', '（仅渲染前 {n} 行）').replace('{n}', MAX_RENDER_ROWS);
      }
      // 表头排序指示
      widget.querySelectorAll('th[data-col]').forEach((th, i) => {
        th.classList.toggle('pc-sorted', i === sortCol);
        th.classList.toggle('pc-sorted-asc', i === sortCol && sortDir === 1);
        th.classList.toggle('pc-sorted-desc', i === sortCol && sortDir === -1);
      });
    }

    // 排序
    widget.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('th[data-col]');
      if (!th) return;
      const col = Array.from(widget.querySelectorAll('th[data-col]')).indexOf(th);
      if (sortCol === col) { sortDir = -sortDir; }
      else { sortCol = col; sortDir = 1; }
      render();
    });

    // 过滤（300ms 防抖）
    let filterTimer = null;
    widget.querySelector('.pcap-filter-input').addEventListener('input', (e) => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => { filterText = e.target.value; render(); }, 300);
    });

    // 点击行展开字段树
    tbody.addEventListener('click', (e) => {
      const row = e.target.closest('.pcap-row');
      if (!row) return;
      const entry = allPackets[Number(row.dataset.pidx)];
      if (!entry) return;
      if (detailNo === entry.no) {
        detail.hidden = true;
        detail.innerHTML = '';
        detailNo = null;
        row.classList.remove('pc-expanded');
        return;
      }
      tbody.querySelectorAll('.pc-expanded').forEach(r => r.classList.remove('pc-expanded'));
      row.classList.add('pc-expanded');
      detailNo = entry.no;
      detail.hidden = false;
      detail.innerHTML = `<div class="pcap-detail-title">${esc(t('pcap.frameDetail', '帧详情'))} · #${entry.no}</div>${fieldTreeHtml(entry)}`;
      detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    pre.parentNode.replaceChild(widget, pre);
    render();
  }

  // ============== 入口 ==============
  async function resolveData(text, docPath) {
    const embedRef = /@\[\s*pcap\s*\]\(([^)]+)\)/.exec(text);
    if (embedRef) {
      const name = embedRef[1].trim().replace(/\.json$/i, '');
      const url = 'iris/data/pcap/json/' + name + '.json';
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + url);
      return await resp.json();
    }
    return JSON.parse(text);
  }

  async function render(root) {
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;
    const pres = Array.from(markdownBody.querySelectorAll('pre.code-block[data-lang="pcap"]'));
    if (!pres.length) return;

    for (const pre of pres) {
      if (pre.dataset.pcapDone === '1') continue;
      pre.dataset.pcapDone = '1';
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      try {
        const data = await resolveData(text);
        buildWidget(pre, data);
      } catch (e) {
        console.error('[pcap] render failed:', e);
        // 与 apexcharts/plantuml 同款降级：错误提示 + 保留源码
        const box = document.createElement('div');
        box.className = 'pcap-error pcap-error-box';
        box.textContent = t('pcap.parseFailed', '抓包文件解析失败') + '：' + (e.message || e);
        pre.parentNode.insertBefore(box, pre);
      }
    }
  }

  window.MarkdownPreview.renderers.pcap = { render };
})();
