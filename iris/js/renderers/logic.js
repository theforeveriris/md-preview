/**
 * 数字逻辑电路渲染器
 *
 * Markdown 语法：
 *   ```logic
 *   input A, B, Cin
 *   output S, Cout
 *   xor x1 = A, B
 *   xor S  = x1, Cin
 *   and a1 = A, B
 *   and a2 = x1, Cin
 *   or  Cout = a1, a2
 *   ```
 *
 * 解析与布局在 iris/js/logic-core.js；本文件负责 SVG 绘制、真值表、
 * 工具栏与导出。支持门、触发器、寄存器、计数器、移位寄存器、MUX、
 * 译码器、加法器、总线与位选。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  function core() {
    return window.MarkdownPreview.logicCore;
  }

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  function esc(value) {
    const fn = window.MarkdownPreview.mdRender && window.MarkdownPreview.mdRender.escapeHtml;
    if (fn) return fn(String(value));
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function icon(name, size) {
    const fn = window.MarkdownPreview.icon;
    if (fn) return fn(name, size || 15);
    return '';
  }

  const BLOCK_LABEL = {
    register: 'REG',
    counter: 'CNT',
    shiftreg: 'SHIFT',
    mux2: 'MUX 2:1',
    mux4: 'MUX 4:1',
    decoder: 'DEC',
    adder: 'ADD'
  };

  const FF_LABEL = {
    dff: 'DFF',
    jkff: 'JKFF',
    tff: 'TFF',
    srff: 'SRFF',
    dlatch: 'LATCH',
    srlatch: 'SR LATCH'
  };

  function portLabel(port) {
    return port.width > 1
      ? port.name + '[' + port.msb + ':' + port.lsb + ']'
      : port.name;
  }

  function pinLabel(pin) {
    return pin.width > 1
      ? pin.name + '[' + (pin.width - 1) + ':0]'
      : pin.name;
  }

  // ---------- 图元绘制 ----------

  function gatePath(node, bubble) {
    const x = node.x;
    const y = node.y;
    const h = node.h;
    const w = node.w;
    const bw = w - (bubble ? 10 : 0);
    const cy = y + h / 2;
    const type = node.type;
    if (type === 'and' || type === 'nand') {
      const r = h / 2;
      return {
        body: 'M' + x + ' ' + y + ' H' + (x + bw - r) +
          ' A' + r + ' ' + r + ' 0 0 1 ' + (x + bw - r) + ' ' + (y + h) +
          ' H' + x + ' Z',
        arc: ''
      };
    }
    if (type === 'or' || type === 'nor' || type === 'xor' || type === 'xnor') {
      const body = 'M' + x + ' ' + y +
        ' Q' + (x + bw * 0.55) + ' ' + y + ' ' + (x + bw) + ' ' + cy +
        ' Q' + (x + bw * 0.55) + ' ' + (y + h) + ' ' + x + ' ' + (y + h) +
        ' Q' + (x + bw * 0.28) + ' ' + cy + ' ' + x + ' ' + y + ' Z';
      const arc = (type === 'xor' || type === 'xnor')
        ? 'M' + (x - 7) + ' ' + y +
          ' Q' + (x + bw * 0.28 - 7) + ' ' + cy + ' ' + (x - 7) + ' ' + (y + h)
        : '';
      return { body: body, arc: arc };
    }
    // not / buf：三角形
    return {
      body: 'M' + x + ' ' + y + ' L' + (x + bw) + ' ' + cy + ' L' + x + ' ' + (y + h) + ' Z',
      arc: ''
    };
  }

  function drawGate(node) {
    const spec = core().GATES[node.type] || {};
    const bw = node.w - (spec.bubble ? 10 : 0);
    const cy = node.y + node.h / 2;
    const paths = gatePath(node, !!spec.bubble);
    let out = '<g class="logic-node logic-node-gate" data-node="' + esc(node.id) + '">';
    out += '<title>' + esc(node.type.toUpperCase() + ' ' + node.name) + '</title>';
    out += '<path class="logic-gate" d="' + paths.body + '"/>';
    if (paths.arc) out += '<path class="logic-gate logic-gate-arc" d="' + paths.arc + '"/>';
    if (spec.bubble) {
      out += '<circle class="logic-gate logic-bubble" cx="' + (node.x + bw + 5) + '" cy="' + cy + '" r="5"/>';
    }
    if (node.type !== 'not') {
      const tx = node.x + bw / 2 + (node.type === 'xor' || node.type === 'xnor' ? -2 : 0);
      out += '<text class="logic-gate-label" x="' + tx + '" y="' + (cy + 4) + '">' + esc(spec.label || '') + '</text>';
    }
    out += '</g>';
    return out;
  }

  function drawFF(node) {
    const x = node.x;
    const y = node.y;
    const w = node.w;
    const h = node.h;
    let out = '<g class="logic-node logic-node-ff" data-node="' + esc(node.id) + '">';
    out += '<title>' + esc((FF_LABEL[node.type] || node.type) + ' ' + node.name) + '</title>';
    out += '<rect class="logic-block" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6"/>';
    out += '<text class="logic-block-name" x="' + (x + 8) + '" y="' + (y + 16) + '">' + esc(node.name) + '</text>';
    out += '<text class="logic-block-type" x="' + (x + w - 8) + '" y="' + (y + 16) + '" text-anchor="end">' +
      esc(FF_LABEL[node.type] || node.type) + '</text>';

    node.inputs.forEach(pin => {
      const py = pin.y;
      if (pin.name === 'CLK') {
        out += '<path class="logic-clock-mark" d="M' + x + ' ' + (py - 5) + ' L' + (x + 7) + ' ' + py + ' L' + x + ' ' + (py + 5) + '"/>';
      }
      out += '<text class="logic-pin-label logic-pin-in" x="' + (x + 9) + '" y="' + (py + 4) + '">' +
        esc(pinLabel(pin)) + '</text>';
    });
    node.outputs.forEach(pin => {
      const py = pin.y;
      if (pin.qn) {
        out += '<circle class="logic-bubble" cx="' + (x + w - 5) + '" cy="' + py + '" r="3.5"/>';
        out += '<text class="logic-pin-label logic-pin-out" x="' + (x + w - 13) + '" y="' + (py + 4) + '" text-anchor="end">' +
          esc(pin.name) + '</text>';
      } else {
        out += '<text class="logic-pin-label logic-pin-out" x="' + (x + w - 9) + '" y="' + (py + 4) + '" text-anchor="end">' +
          esc(pinLabel(pin)) + '</text>';
      }
    });
    out += '</g>';
    return out;
  }

  function drawBlock(node) {
    const x = node.x;
    const y = node.y;
    const w = node.w;
    const h = node.h;
    const sizeTypes = { register: 1, counter: 1, shiftreg: 1, adder: 1, decoder: 1 };
    const typeLabel = (BLOCK_LABEL[node.type] || node.type.toUpperCase()) +
      (sizeTypes[node.type] ? ' ' + node.width : '');
    let out = '<g class="logic-node logic-node-block" data-node="' + esc(node.id) + '">';
    out += '<title>' + esc(typeLabel + ' ' + node.name) + '</title>';
    out += '<rect class="logic-block" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6"/>';
    out += '<text class="logic-block-name" x="' + (x + 8) + '" y="' + (y + 16) + '">' + esc(node.name) + '</text>';
    out += '<text class="logic-block-type" x="' + (x + w - 8) + '" y="' + (y + 16) + '" text-anchor="end">' + esc(typeLabel) + '</text>';

    node.inputs.forEach(pin => {
      out += '<text class="logic-pin-label logic-pin-in" x="' + (x + 9) + '" y="' + (pin.y + 4) + '">' +
        esc(pinLabel(pin)) + '</text>';
    });
    node.outputs.forEach(pin => {
      out += '<text class="logic-pin-label logic-pin-out" x="' + (x + w - 9) + '" y="' + (pin.y + 4) + '" text-anchor="end">' +
        esc(pinLabel(pin)) + '</text>';
    });
    out += '</g>';
    return out;
  }

  function drawPort(node) {
    const x = node.x;
    const y = node.y;
    const w = node.w;
    const h = node.h;
    const isOut = node.dir === 'output';
    const label = portLabel(node);
    let out = '<g class="logic-node logic-node-port ' + (isOut ? 'logic-port-out' : 'logic-port-in') +
      '" data-node="' + esc(node.id) + '">';
    out += '<title>' + esc((node.clock ? 'CLK ' : '') + node.name) + '</title>';
    out += '<rect class="logic-port" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="7"/>';
    out += '<text class="logic-port-label" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 4) + '" text-anchor="middle">' +
      esc(label) + '</text>';
    if (node.clock) {
      out += '<circle class="logic-clock-ring" cx="' + (x + 11) + '" cy="' + (y + h / 2) + '" r="4.5"/>';
      out += '<path class="logic-clock-hand" d="M' + (x + 11) + ' ' + (y + h / 2 - 3) + ' V' + (y + h / 2) + ' H' + (x + 14) + '"/>';
    }
    out += '</g>';
    return out;
  }

  function drawConst(node) {
    return '<g class="logic-node logic-node-const" data-node="' + esc(node.id) + '">' +
      '<rect class="logic-const" x="' + node.x + '" y="' + node.y + '" width="' + node.w + '" height="' + node.h + '" rx="4"/>' +
      '<text class="logic-const-label" x="' + (node.x + node.w / 2) + '" y="' + (node.y + node.h / 2 + 4) + '" text-anchor="middle">' +
      esc(node.name) + '</text></g>';
  }

  function drawTap(node) {
    // connect 只是一条导线别名，不画额外节点
    if (node.type === 'connect') return '';
    let label = '';
    if (node.type === 'tap') {
      label = node.index !== undefined
        ? '[' + node.index + ']'
        : (node.range ? '[' + node.range.msb + ':' + node.range.lsb + ']' : '');
    }
    let out = '<g class="logic-node logic-node-tap" data-node="' + esc(node.id) + '">' +
      '<circle class="logic-junction" cx="' + node.x + '" cy="' + node.y + '" r="3.6"/>';
    if (label) {
      out += '<text class="logic-tap-label" x="' + (node.x + 6) + '" y="' + (node.y - 7) + '">' + esc(label) + '</text>';
    }
    out += '</g>';
    return out;
  }

  function drawNode(node) {
    if (node.kind === 'gate') return drawGate(node);
    if (node.kind === 'ff') return drawFF(node);
    if (node.kind === 'block') return drawBlock(node);
    if (node.kind === 'port') return drawPort(node);
    if (node.kind === 'const') return drawConst(node);
    if (node.kind === 'tap') return drawTap(node);
    return '';
  }

  // ---------- 连线 ----------

  function driverPin(net) {
    const d = net && net.driver;
    if (!d) return null;
    if (d.kind === 'node') return { node: d.node, pin: d.pin };
    if (d.kind === 'port') {
      const node = d.port.node;
      return { node: node, pin: node.outputs && node.outputs[0] };
    }
    if (d.kind === 'const') return { node: d.node, pin: d.node.outputs[0] };
    return null;
  }

  function feedbackKey(model, from, to) {
    return model.feedbackEdges && model.feedbackEdges.indexOf(from.id + '->' + to.id) !== -1;
  }

  function collectEdges(model) {
    const edges = [];
    model.nodes.forEach(node => {
      node.inputs.forEach(pin => {
        if (!pin.net) return;
        const d = driverPin(pin.net);
        if (!d || !d.pin) return;
        edges.push({
          net: pin.net,
          from: d.node,
          fromPin: d.pin,
          to: node,
          toPin: pin,
          sx: d.pin.x,
          sy: d.pin.y,
          tx: pin.x,
          ty: pin.y,
          width: pin.net.width,
          feedback: feedbackKey(model, d.node, node)
        });
      });
    });
    return edges;
  }

  // 若水平段会穿过其他元件，绕到元件上方 / 下方走线
  function findDetour(edge, model) {
    if (edge.feedback || edge.backward) return null;
    const x1 = Math.min(edge.sx, edge.tx);
    const x2 = Math.max(edge.sx, edge.tx);
    const y = edge.ty;
    let top = Infinity;
    let bottom = -Infinity;
    model.nodes.forEach(n => {
      if (n === edge.from || n === edge.to) return;
      if (n.kind === 'tap' || n.kind === 'const') return;
      if (n.x + n.w <= x1 + 2 || n.x >= x2 - 2) return;
      if (y > n.y - 2 && y < n.y + n.h + 2) {
        top = Math.min(top, n.y - 16);
        bottom = Math.max(bottom, n.y + n.h + 16);
      }
    });
    if (top === Infinity) return null;
    return top > 12 ? top : bottom;
  }

  function assignLanes(model, edges) {
    const groups = new Map();
    edges.forEach(e => {
      if (e.feedback) return;
      if (e.tx <= e.sx + 2) {
        e.backward = true;
        return;
      }
      const key = Math.round(e.sx / 4) * 4;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });
    groups.forEach(list => {
      list.sort((a, b) => a.ty - b.ty);
      list.forEach((e, i) => {
        e.mx = e.sx + 22 + (i % 6) * 4;
      });
    });
    let index = 0;
    const bottom = model.layout.height - 18;
    edges.forEach(e => {
      if (e.feedback || e.backward) {
        e.by = bottom - (index++) * 7;
      }
    });
  }

  function wirePath(e) {
    const sx = e.sx;
    const sy = e.sy;
    const tx = e.tx;
    const ty = e.ty;
    if (e.feedback || e.backward) {
      return 'M' + sx + ' ' + sy + ' V' + e.by + ' H' + tx + ' V' + ty;
    }
    if (e.detourY !== undefined) {
      const dx = sx + (tx > sx ? 12 : -12);
      return 'M' + sx + ' ' + sy + ' H' + dx + ' V' + e.detourY + ' H' + tx + ' V' + ty;
    }
    if (Math.abs(sx - tx) < 0.5) {
      return 'M' + sx + ' ' + sy + ' V' + ty;
    }
    if (Math.abs(sy - ty) < 0.5) {
      return 'M' + sx + ' ' + sy + ' H' + tx;
    }
    const mx = e.mx === undefined ? sx + 24 : e.mx;
    return 'M' + sx + ' ' + sy + ' H' + mx + ' V' + ty + ' H' + tx;
  }

  function drawWires(model, edges) {
    edges.forEach(e => {
      const detour = findDetour(e, model);
      if (detour !== null) e.detourY = detour;
    });
    assignLanes(model, edges);
    let out = '<g class="logic-wires">';
    edges.forEach(e => {
      const cls = 'logic-wire' +
        (e.width > 1 ? ' logic-bus' : '') +
        (e.feedback ? ' logic-feedback' : '') +
        (e.backward ? ' logic-backward' : '');
      out += '<path class="' + cls + '" data-net="' + esc(e.net.name) + '" d="' + wirePath(e) + '"/>';
    });

    // 分叉点
    const dots = new Set();
    model.nets.forEach(net => {
      if (net.sinks.length > 1 || net.isTap) {
        const d = driverPin(net);
        if (!d || !d.pin) return;
        const key = d.pin.x.toFixed(1) + ',' + d.pin.y.toFixed(1);
        if (dots.has(key)) return;
        dots.add(key);
        out += '<circle class="logic-junction" cx="' + d.pin.x + '" cy="' + d.pin.y + '" r="3"/>';
      }
    });
    out += '</g>';
    return out;
  }

  function netLabelPos(net) {
    const d = driverPin(net);
    if (!d || !d.pin) return null;
    if (net.isTap) {
      return { x: d.pin.x + 7, y: d.pin.y - 6, text: net.name };
    }
    if (d.node.kind === 'gate') {
      const spec = core().GATES[d.node.type] || {};
      return { x: d.pin.x + (spec.bubble ? 13 : 7), y: d.pin.y - 6, text: net.name };
    }
    if (d.node.kind === 'block' || d.node.kind === 'ff') {
      // 块内已经有引脚名，不再重复
      return null;
    }
    return null;
  }

  function drawNetLabels(model) {
    const seen = new Set();
    let out = '<g class="logic-labels">';
    model.nets.forEach(net => {
      if (seen.has(net.name)) return;
      const pos = netLabelPos(net);
      if (!pos) return;
      seen.add(net.name);
      out += '<text class="logic-net-label" x="' + pos.x + '" y="' + pos.y + '">' + esc(pos.text) + '</text>';
    });
    out += '</g>';
    return out;
  }

  function buildSvg(model) {
    const edges = collectEdges(model);
    const width = model.layout.width;
    const height = model.layout.height;
    let svg = '<svg class="logic-svg" width="' + width + '" height="' + height + '" ' +
      'viewBox="0 0 ' + width + ' ' + height + '" ' +
      'role="img" aria-label="' + esc(model.title || t('logic.diagram', '数字逻辑电路图')) + '" ' +
      'preserveAspectRatio="xMidYMid meet">';
    svg += '<title>' + esc(model.title || t('logic.diagram', '数字逻辑电路图')) + '</title>';
    svg += drawWires(model, edges);
    svg += '<g class="logic-nodes">';
    model.nodes.forEach(node => { svg += drawNode(node); });
    svg += '</g>';
    svg += drawNetLabels(model);
    svg += '</svg>';
    return svg;
  }

  // ---------- 真值表 ----------

  function renderTruthTable(tt) {
    let html = '<div class="logic-truth-wrap" hidden><table class="logic-truth"><caption>' +
      esc(t('logic.truth', '真值表')) + '</caption><thead><tr>';
    tt.columns.forEach(c => {
      html += '<th class="logic-th-' + c.dir + '">' + esc(c.name) + '</th>';
    });
    html += '</tr></thead><tbody>';
    tt.rows.forEach(row => {
      html += '<tr>';
      row.forEach((bit, i) => {
        html += '<td class="logic-td-' + tt.columns[i].dir + '">' + bit + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  // ---------- 诊断 ----------

  function diagHtml(model) {
    const errors = model.errors || [];
    const warnings = model.warnings || [];
    if (!errors.length && !warnings.length) return '';
    let html = '<div class="logic-diag">';
    if (errors.length) {
      html += '<div class="logic-diag-title logic-diag-error">' + esc(t('logic.errors', '电路有错误')) + '</div><ul>';
      errors.slice(0, 12).forEach(e => {
        html += '<li>' + (e.line ? 'L' + e.line + '：' : '') + esc(e.msg) + '</li>';
      });
      html += '</ul>';
    }
    if (warnings.length) {
      html += '<div class="logic-diag-title logic-diag-warn">' + esc(t('logic.warnings', '提示')) + '</div><ul>';
      warnings.slice(0, 8).forEach(e => {
        html += '<li>' + (e.line ? 'L' + e.line + '：' : '') + esc(e.msg) + '</li>';
      });
      html += '</ul>';
    }
    html += '</div>';
    return html;
  }

  function showFatal(pre, model) {
    const box = document.createElement('div');
    box.className = 'logic-diag logic-diag-fatal';
    box.innerHTML = '<div class="logic-diag-title logic-diag-error">' +
      esc(t('logic.parseFailed', '逻辑电路解析失败，已保留源码')) + '</div>' +
      '<ul>' + (model.errors || []).slice(0, 8).map(e =>
        '<li>' + (e.line ? 'L' + e.line + '：' : '') + esc(e.msg) + '</li>'
      ).join('') + '</ul>';
    pre.parentNode.insertBefore(box, pre);
  }

  // ---------- 交互与导出 ----------

  function inlineStyleForExport(svg, widget) {
    const cs = window.getComputedStyle(widget);
    const text = cs.getPropertyValue('--color-text').trim() || '#222';
    const surface = cs.getPropertyValue('--color-surface').trim() || '#fff';
    const muted = cs.getPropertyValue('--color-text-muted').trim() || '#777';
    const border = cs.getPropertyValue('--color-border').trim() || '#ddd';
    return '<style>' +
      '.logic-svg{background:' + surface + '}' +
      '.logic-wire{fill:none;stroke:' + muted + ';stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}' +
      '.logic-bus{stroke-width:3.2}' +
      '.logic-feedback{stroke-dasharray:5 4}' +
      '.logic-gate,.logic-block,.logic-port,.logic-const{fill:' + surface + ';stroke:' + text + ';stroke-width:1.6}' +
      '.logic-port-in{fill:' + surface + '}' +
      '.logic-port-out{fill:' + surface + '}' +
      '.logic-const{fill:' + surface + '}' +
      '.logic-junction{fill:' + text + ';stroke:none}' +
      '.logic-bubble{fill:' + surface + ';stroke:' + text + ';stroke-width:1.4}' +
      '.logic-clock-mark{fill:none;stroke:' + text + ';stroke-width:1.4}' +
      '.logic-clock-ring,.logic-clock-hand{fill:none;stroke:' + text + ';stroke-width:1.2}' +
      '.logic-svg text{fill:' + text + ';font-family:ui-monospace,SFMono-Regular,Menlo,monospace}' +
      '.logic-block-type,.logic-pin-label,.logic-tap-label,.logic-net-label{fill:' + muted + '}' +
      '.logic-gate-label{font-size:12px;font-weight:600;text-anchor:middle}' +
      '.logic-block-name{font-size:11px;font-weight:600}' +
      '.logic-block-type{font-size:9px}' +
      '.logic-pin-label{font-size:9px}' +
      '.logic-tap-label,.logic-net-label{font-size:9px}' +
      '.logic-const-label,.logic-port-label{font-size:10px;text-anchor:middle}' +
      '</style>';
  }

  function exportSvg(widget) {
    const svg = widget.querySelector('svg.logic-svg');
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const box = (clone.getAttribute('viewBox') || '0 0 800 600').split(/\s+/);
    clone.setAttribute('width', box[2] || '800');
    clone.setAttribute('height', box[3] || '600');
    const style = inlineStyleForExport(clone, widget);
    clone.insertAdjacentHTML('afterbegin', style);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logic-circuit.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindWidget(widget, model, tt) {
    const svg = widget.querySelector('svg.logic-svg');
    if (svg) {
      const clear = () => {
        widget.classList.remove('is-hovering');
        widget.querySelectorAll('.is-hot').forEach(el => el.classList.remove('is-hot'));
      };
      svg.addEventListener('mouseover', e => {
        const target = e.target.closest && e.target.closest('[data-net]');
        if (!target) return;
        const net = target.getAttribute('data-net');
        clear();
        widget.classList.add('is-hovering');
        widget.querySelectorAll('[data-net="' + net.replace(/"/g, '\\"') + '"]').forEach(el => el.classList.add('is-hot'));
      });
      svg.addEventListener('mouseleave', clear);
    }

    const truthBtn = widget.querySelector('[data-act="truth"]');
    if (truthBtn && tt) {
      truthBtn.addEventListener('click', () => {
        const wrap = widget.querySelector('.logic-truth-wrap');
        if (!wrap) return;
        wrap.hidden = !wrap.hidden;
        truthBtn.setAttribute('aria-pressed', wrap.hidden ? 'false' : 'true');
      });
    }

    const pinsBtn = widget.querySelector('[data-act="pins"]');
    if (pinsBtn) {
      pinsBtn.addEventListener('click', () => {
        const hidden = widget.classList.toggle('logic-hide-pins');
        pinsBtn.setAttribute('aria-pressed', hidden ? 'false' : 'true');
      });
    }

    const exportBtn = widget.querySelector('[data-act="svg"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => exportSvg(widget));
    }
  }

  // ---------- 入口 ----------

  function buildWidget(model, tt) {
    const widget = document.createElement('div');
    widget.className = 'logic-view w-has-float' + (model.pins === 'off' ? ' logic-hide-pins' : '');

    const toolbar = document.createElement('div');
    toolbar.className = 'w-float';
    const truthLabel = t('logic.truth', '真值表');
    const pinsLabel = t('logic.pins', '显示引脚名');
    const exportLabel = t('logic.export', '导出 SVG');
    const showTruth = !!tt && !tt.tooLarge;
    let buttons = '';
    if (showTruth) {
      buttons += '<button type="button" class="icon-btn logic-btn" data-act="truth" aria-pressed="' +
        (model.truth === 'on' || (model.truth === 'auto' && tt.inBits <= 4) ? 'true' : 'false') +
        '" data-tip="' + esc(truthLabel) + '" title="' + esc(truthLabel) + '" aria-label="' + esc(truthLabel) + '">' +
        icon('i-table', 15) + '<span class="icon-btn-label">' + esc(truthLabel) + '</span></button>';
    }
    buttons += '<button type="button" class="icon-btn logic-btn" data-act="pins" aria-pressed="true" data-tip="' +
      esc(pinsLabel) + '" title="' + esc(pinsLabel) + '" aria-label="' + esc(pinsLabel) + '">' +
      icon('i-eye', 15) + '<span class="icon-btn-label">' + esc(pinsLabel) + '</span></button>';
    buttons += '<button type="button" class="icon-btn logic-btn" data-act="svg" data-tip="' + esc(exportLabel) +
      '" title="' + esc(exportLabel) + '" aria-label="' + esc(exportLabel) + '">' +
      icon('i-download', 15) + '<span class="icon-btn-label">' + esc(exportLabel) + '</span></button>';
    toolbar.innerHTML = buttons;
    widget.appendChild(toolbar);

    const diag = diagHtml(model);
    if (diag) widget.insertAdjacentHTML('beforeend', diag);

    const stage = document.createElement('div');
    stage.className = 'logic-stage';
    stage.innerHTML = buildSvg(model);
    widget.appendChild(stage);

    if (showTruth) {
      const wrap = document.createElement('div');
      wrap.innerHTML = renderTruthTable(tt);
      const table = wrap.firstChild;
      widget.appendChild(table);
      if (model.truth === 'on' || (model.truth === 'auto' && tt.inBits <= 4)) {
        table.hidden = false;
      }
    } else if (tt && tt.tooLarge) {
      const note = document.createElement('div');
      note.className = 'logic-note';
      note.textContent = t('logic.tooMany', '输入位超过 8 位，未生成真值表；可减少位宽或只保留关键输入。');
      widget.appendChild(note);
    } else if (model.hasSequential || (model.feedbackEdges && model.feedbackEdges.length)) {
      const note = document.createElement('div');
      note.className = 'logic-note';
      note.textContent = t('logic.seqNote', '时序 / 带反馈电路不生成真值表，图中已标出时钟与反馈连线。');
      widget.appendChild(note);
    }

    bindWidget(widget, model, tt);
    return widget;
  }

  function renderFence(pre) {
    if (pre.dataset.logicDone) return;
    pre.dataset.logicDone = '1';
    const code = pre.querySelector('code') || pre;
    const model = core().build(code.textContent || '');
    if (!model.nodes.length) {
      showFatal(pre, model);
      return;
    }
    const tt = core().truthTable(model);
    const widget = buildWidget(model, tt);
    pre.replaceWith(widget);
  }

  function render(root) {
    const mdRender = window.MarkdownPreview.mdRender;
    const scope = mdRender && mdRender.resolveRoot
      ? mdRender.resolveRoot(root)
      : (root || document.getElementById('markdownContent'));
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="logic"], pre.code-block[data-lang^="circuit"]');
    blocks.forEach(pre => renderFence(pre));
  }

  window.MarkdownPreview.renderers.logic = {
    render: render,
    build: source => core().build(source)
  };
})();
