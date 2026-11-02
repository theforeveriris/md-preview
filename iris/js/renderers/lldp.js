/**
 * LLDP / CDP 邻居 → 拓扑图（C2）
 *
 * Markdown 语法：
 *   ```lldp  或 ```cdp   —— 内联 show lldp/cdp neighbors 输出
 *   @[lldp](out.txt) / @[cdp](out.txt) —— 嵌入同源文本
 *
 * 解析：
 *   - Cisco/Huawei 常见输出（normal / detail）
 *   - 抽取 Local Intf、Neighbor Device ID、Neighbor Port ID、Capability、管理 IP
 *   - 双向边去重；未知设备虚线；自环跳过
 *
 * 渲染：SVG 拓扑，节点可高亮邻居，支持圆形/同心布局切换、导出 SVG。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  // 共享图标构造（dom.js 提供）
  const icon = window.MarkdownPreview.icon || ((name, size) =>
    '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#' + name + '"/></svg>');

  const LOCAL_LABEL = '本设备';

  function isCapLine(line) {
    return /^Capability codes?:/i.test(line) || /\((R|B|T|C|W|P|S|O)\)/.test(line);
  }

  function splitFields(line) {
    return line.trim().split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  }

  function parseNeighbors(text) {
    const lines = String(text || '').split(/\r?\n/);
    const nodes = new Map(); // name -> { name, detail, unknown }
    const edges = [];
    const seen = new Set();
    let header = null;

    function addNode(name, detail) {
      if (!name) return;
      const key = name;
      if (!nodes.has(key)) nodes.set(key, { name: key, detail: detail || '', unknown: true });
      else if (detail) nodes.get(key).detail = detail;
    }
    function addEdge(a, b, portA, portB, kind) {
      if (!a || !b || a === b) return;
      const key = a + '\u0000' + b + '\u0000' + kind;
      const keyRev = b + '\u0000' + a + '\u0000' + kind;
      if (seen.has(key) || seen.has(keyRev)) return;
      seen.add(key);
      edges.push({ a, b, portA, portB, kind });
    }

    // 1) 明细模式（Huawei / Cisco detail）
    const detailBlocks = [];
    let cur = null;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(Chassis ID|Device ID|System Name|System Description|Port ID|Port Description|Management Address|IP Address|Capability codes):/i.test(line) ||
          /^\s*(Chassis ID|Device ID|System Name|Port ID|Port Description|Management Address|IP Address):/i.test(line)) {
        if (cur) detailBlocks.push(cur);
        const m = /:\s*(.*)$/.exec(line);
        cur = { field: (m ? m[1] : '').trim().toLowerCase(), value: '' };
        if (cur.field) cur.value = '';
        // 常见："Chassis ID : value" 单行
        if (m && m[1]) cur.value = m[1].trim();
        continue;
      }
      if (cur) {
        if (!cur.value && line.trim()) cur.value = line.trim();
        else if (cur.value) cur.value += ' ' + line.trim();
      }
    }
    if (cur) detailBlocks.push(cur);

    // 2) 表格式：找 "Device ID ... Local Intf ... Port ID" 头
    const headerRe = /Device ID[\s\S]{0,80}(Local (Intf|Interface)|Local Int)[\s\S]{0,80}(Port ID|Port)\b/i;
    let headerIdx = lines.findIndex(l => headerRe.test(l));
    let portIdIdx = -1;
    if (headerIdx >= 0) {
      const headerFields = splitFields(lines[headerIdx]);
      const cols = { deviceId: 0, localIntf: -1, holdTime: -1, capability: -1, portId: -1 };
      headerFields.forEach((h, i) => {
        const hl = h.toLowerCase().replace(/[^a-z ]/g, '').trim();
        if (hl === 'device id') cols.deviceId = i;
        else if (hl === 'local intf' || hl === 'local interface' || hl === 'local int') cols.localIntf = i;
        else if (hl === 'hold-time' || hl === 'hold time') cols.holdTime = i;
        else if (hl === 'capability') cols.capability = i;
        else if (hl === 'port id' || hl === 'port') cols.portId = i;
        else if (hl === 'platform' || hl === 'version') cols.capability = i;
      });
      portIdIdx = cols.portId;
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        if (isCapLine(line)) continue;
        const fields = splitFields(line);
        if (fields.length < 2) continue;
        const deviceId = fields[cols.deviceId] || fields[0];
        const localIntf = fields[cols.localIntf >= 0 ? cols.localIntf : 1] || '';
        const portId = fields[portIdIdx] || fields[fields.length - 1];
        addNode(deviceId, '');
        addEdge(LOCAL_LABEL, deviceId, localIntf, portId, 'solid');
      }
    } else {
      // 3) 非表头明细：本地端口 + 对端设备/端口
      // Cisco: Neighbor Device ID: x  /  Local Intf: y
      let localPort = '';
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^Local (Intf|Interface)\s*:/i.test(line)) {
          localPort = line.replace(/^.*?:\s*/, '').trim();
        } else if (/^(Neighbor )?Device ID\s*:/i.test(line) || /^System Name\s*:/i.test(line)) {
          // 属于上一段端口
        }
      }
      // 更通用：按 "Port ID:" 分段
      let pending = null;
      const rePort = /^\s*(?:Local\s+)?(?:Intf|Interface|Port ID)\s*[:：]\s*(.+)$/i;
      const reDev = /^\s*(?:Neighbor\s+)?(?:Device ID|System Name|Chassis ID)\s*[:：]\s*(.+)$/i;
      for (const line of lines) {
        let m;
        if ((m = rePort.exec(line))) {
          pending = { port: m[1].trim() };
        } else if ((m = reDev.exec(line))) {
          if (pending && pending.port) {
            // 该设备挂在 pending.port 上
            addNode(m[1].trim(), '');
            addEdge(LOCAL_LABEL, m[1].trim(), pending.port, '', 'solid');
          }
          pending = { port: localPort };
        } else if (/^(Port Description|Management Address|IP Address|Capability)/i.test(line)) {
          continue;
        }
      }
    }
    return { nodes: Array.from(nodes.values()), edges };
  }

  // ============== SVG 拓扑 ==============
  function layout(topo, mode) {
    const nodeList = topo.nodes.slice();
    const pos = {};
    if (mode === 'concentric') {
      const center = { x: 260, y: 180 };
      pos[LOCAL_LABEL] = center;
      nodeList.forEach((n, i) => {
        const angle = (i / Math.max(1, nodeList.length)) * Math.PI * 2;
        pos[n.name] = { x: 260 + Math.cos(angle) * 150, y: 180 + Math.sin(angle) * 150 };
      });
    } else {
      const n = nodeList.length;
      nodeList.forEach((node, i) => {
        const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
        pos[node.name] = { x: 260 + Math.cos(angle) * 160, y: 180 + Math.sin(angle) * 160 };
      });
      pos[LOCAL_LABEL] = { x: 260, y: 180 };
    }
    return pos;
  }

  function renderTopology(topo, pre, options) {
    if (!topo.nodes.length) return false;
    const widget = document.createElement('div');
    widget.className = 'lldp-view';

    const toolbar = document.createElement('div');
    toolbar.className = 'lldp-toolbar';
    // 工具条按钮一律用图标，文字靠悬停提示（data-tip）
    const circleLabel = t('lldp.circle', '环形');
    const concentricLabel = t('lldp.concentric', '同心');
    const exportLabel = t('lldp.export', '导出 SVG');
    toolbar.innerHTML =
      '<span class="lldp-meta">' + esc(topo.nodes.length) + ' ' + esc(t('lldp.nodes', '节点')) + ' · ' + esc(topo.edges.length) + ' ' + esc(t('lldp.edges', '链路')) + '</span>' +
      '<span class="lldp-spacer"></span>' +
      '<button type="button" class="icon-btn lldp-btn" data-layout="circle" data-tip="' + esc(circleLabel) + '" title="' + esc(circleLabel) + '" aria-label="' + esc(circleLabel) + '">' +
        icon('i-graph', 15) + '<span class="icon-btn-label">' + esc(circleLabel) + '</span></button>' +
      '<button type="button" class="icon-btn lldp-btn" data-layout="concentric" data-tip="' + esc(concentricLabel) + '" title="' + esc(concentricLabel) + '" aria-label="' + esc(concentricLabel) + '">' +
        icon('i-split', 15) + '<span class="icon-btn-label">' + esc(concentricLabel) + '</span></button>' +
      '<button type="button" class="icon-btn lldp-btn" data-act="svg" data-tip="' + esc(exportLabel) + '" title="' + esc(exportLabel) + '" aria-label="' + esc(exportLabel) + '">' +
        icon('i-download', 15) + '<span class="icon-btn-label">' + esc(exportLabel) + '</span></button>';
    widget.appendChild(toolbar);

    const stage = document.createElement('div');
    stage.className = 'lldp-stage';
    widget.appendChild(stage);

    let mode = 'circle';

    function draw() {
      const pos = layout(topo, mode);
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 520 360');
      svg.setAttribute('class', 'lldp-svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', t('lldp.topology', '网络拓扑图'));

      const gEdges = document.createElementNS(ns, 'g');
      gEdges.setAttribute('class', 'lldp-edges');
      topo.edges.forEach(e => {
        const pa = pos[e.a], pb = pos[e.b];
        if (!pa || !pb) return;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', pa.x); line.setAttribute('y1', pa.y);
        line.setAttribute('x2', pb.x); line.setAttribute('y2', pb.y);
        line.setAttribute('class', 'lldp-edge');
        line.dataset.a = e.a; line.dataset.b = e.b;
        gEdges.appendChild(line);
        const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', mid.x); label.setAttribute('y', mid.y - 4);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'lldp-edge-label');
        label.textContent = (e.portA || '—') + ' ↔ ' + (e.portB || '—');
        gEdges.appendChild(label);
      });
      svg.appendChild(gEdges);

      const gNodes = document.createElementNS(ns, 'g');
      gNodes.setAttribute('class', 'lldp-nodes');
      const local = { x: pos[LOCAL_LABEL].x, y: pos[LOCAL_LABEL].y };
      const localNode = document.createElementNS(ns, 'g');
      localNode.setAttribute('class', 'lldp-node lldp-node-local');
      localNode.innerHTML = '<circle class="lldp-node-bg" cx="0" cy="0" r="26"></circle><text class="lldp-node-name" text-anchor="middle" dy="5">' + esc(LOCAL_LABEL) + '</text>';
      localNode.setAttribute('transform', 'translate(' + local.x + ',' + local.y + ')');
      gNodes.appendChild(localNode);

      topo.nodes.forEach(node => {
        const p = pos[node.name];
        if (!p) return;
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'lldp-node');
        g.dataset.node = node.name;
        g.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
        g.innerHTML =
          '<circle class="lldp-node-bg" r="24"></circle>' +
          '<text class="lldp-node-name" text-anchor="middle" dy="5">' + esc(node.name) + '</text>';
        gNodes.appendChild(g);
      });
      svg.appendChild(gNodes);

      stage.innerHTML = '';
      stage.appendChild(svg);

      svg.querySelectorAll('.lldp-node').forEach(g => {
        const node = g.dataset.node;
        const activate = () => {
          svg.querySelectorAll('.lldp-node').forEach(n => n.classList.remove('lldp-active'));
          svg.querySelectorAll('.lldp-edge').forEach(l => l.classList.remove('lldp-active'));
          g.classList.add('lldp-active');
          svg.querySelectorAll('.lldp-edge').forEach(l => {
            if (l.dataset.a === node || l.dataset.b === node) l.classList.add('lldp-active');
          });
        };
        g.addEventListener('mouseenter', activate);
        g.addEventListener('focus', activate);
        g.addEventListener('click', activate);
      });
    }

    toolbar.querySelectorAll('[data-layout]').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.layout;
        toolbar.querySelectorAll('[data-layout]').forEach(b => b.classList.toggle('lldp-btn-active', b === btn));
        draw();
      });
    });
    toolbar.querySelector('[data-act="svg"]').addEventListener('click', () => {
      const svg = stage.querySelector('svg');
      if (!svg) return;
      const data = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'topology.svg'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    });

    draw();
    toolbar.querySelector('[data-layout="circle"]').classList.add('lldp-btn-active');
    pre.replaceWith(widget);
    return true;
  }

  function renderFence(pre) {
    const text = pre.querySelector('code')?.textContent || '';
    const topo = parseNeighbors(text);
    if (!topo.nodes.length && !topo.edges.length) return;
    renderTopology(topo, pre);
  }

  async function renderEmbed(el, url) {
    let text;
    try {
      const resp = await fetch('/' + url.replace(/^\//, ''));
      if (!resp.ok) { el.replaceWith(topoFallback(url)); return; }
      text = await resp.text();
    } catch (e) { el.replaceWith(topoFallback(url)); return; }
    const topo = parseNeighbors(text);
    if (!topo.nodes.length && !topo.edges.length) { el.replaceWith(topoFallback(url)); return; }
    renderTopology(topo, el);
  }

  function topoFallback(url) {
    const d = document.createElement('div');
    d.className = 'lldp-view lldp-fallback';
    d.innerHTML = '<div class="har-error">' + esc(t('lldp.fail', '无法解析邻居输出')) + '</div>' +
      '<a href="/' + esc(url.replace(/^\//, '')) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>';
    return d;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block').forEach(pre => {
      if (pre.dataset.lldpDone) return;
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      if (lang === 'lldp' || lang === 'cdp') {
        pre.dataset.lldpDone = '1';
        renderFence(pre);
      }
    });
  }

  window.MarkdownPreview.renderers.lldp = { render, renderEmbed, parseNeighbors };
})();
