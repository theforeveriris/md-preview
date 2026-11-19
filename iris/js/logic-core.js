/**
 * logic-core - 数字逻辑电路 DSL 的解析、网表校验、布局与真值表
 *
 * 纯数据层，不依赖 DOM，便于 Node 单元测试。
 * 语法详见 docs/examples/logic-examples.md。
 */
(function() {
  'use strict';

  // 门类型：inputs 为固定数量或 '2+'（至少两个，可更多）
  const GATES = {
    and:  { inputs: '2+', label: '&',  bubble: false },
    or:   { inputs: '2+', label: '≥1', bubble: false },
    nand: { inputs: '2+', label: '&',  bubble: true },
    nor:  { inputs: '2+', label: '≥1', bubble: true },
    xor:  { inputs: '2+', label: '=1', bubble: false },
    xnor: { inputs: '2+', label: '=1', bubble: true },
    not:  { inputs: 1,    label: '1',  bubble: true },
    buf:  { inputs: 1,    label: '1',  bubble: false }
  };

  // 触发器签名：输入按位置解析，输出 Q / QN 可选
  const FFS = {
    dff:     { ins: ['D', 'CLK', 'RST', 'SET'] },
    jkff:    { ins: ['J', 'K', 'CLK', 'RST'] },
    tff:     { ins: ['T', 'CLK', 'RST'] },
    srff:    { ins: ['S', 'R', 'CLK'] },
    dlatch:  { ins: ['D', 'EN'] },
    srlatch: { ins: ['S', 'R'] }
  };

  // 组合 / 时序块签名。width 为真时，name[width] 必须给出。
  const BLOCKS = {
    register: {
      width: true,
      ins: [
        { name: 'D', width: 'w' },
        { name: 'CLK', width: 1 },
        { name: 'EN', width: 1, opt: true },
        { name: 'CLR', width: 1, opt: true }
      ],
      outs: [{ name: 'Q', width: 'w' }],
      seq: true
    },
    counter: {
      width: true,
      ins: [
        { name: 'CLK', width: 1 },
        { name: 'EN', width: 1, opt: true },
        { name: 'CLR', width: 1, opt: true },
        { name: 'LOAD', width: 1, opt: true },
        { name: 'D', width: 'w', opt: true }
      ],
      outs: [{ name: 'Q', width: 'w' }, { name: 'CO', width: 1 }],
      seq: true
    },
    shiftreg: {
      width: true,
      ins: [
        { name: 'D', width: 1 },
        { name: 'CLK', width: 1 },
        { name: 'EN', width: 1, opt: true },
        { name: 'DIR', width: 1, opt: true }
      ],
      outs: [{ name: 'Q', width: 'w' }],
      seq: true
    },
    mux2: {
      ins: [
        { name: 'A', width: 1 },
        { name: 'B', width: 1 },
        { name: 'S', width: 1 }
      ],
      outs: [{ name: 'Y', width: 1 }]
    },
    mux4: {
      ins: [
        { name: 'D', width: 4 },
        { name: 'S', width: 2 }
      ],
      outs: [{ name: 'Y', width: 1 }]
    },
    decoder: {
      width: true,
      ins: [
        { name: 'A', width: 'w' },
        { name: 'EN', width: 1 }
      ],
      outs: [{ name: 'Y', width: '2^w' }]
    },
    adder: {
      width: true,
      ins: [
        { name: 'A', width: 'w' },
        { name: 'B', width: 'w' },
        { name: 'Cin', width: 1 }
      ],
      outs: [{ name: 'S', width: 'w' }, { name: 'Cout', width: 1 }]
    }
  };

  const SEQ_TYPES = new Set(['dff', 'jkff', 'tff', 'srff', 'dlatch', 'srlatch']);

  function err(model, msg, line) {
    model.errors.push({ msg, line: line || 0 });
  }

  function warn(model, msg, line) {
    model.warnings.push({ msg, line: line || 0 });
  }

  function stripComment(line) {
    const i = line.indexOf('#');
    return i === -1 ? line : line.slice(0, i);
  }

  // 按顶层逗号切分，忽略 [] 与 () 内的逗号
  function splitTop(text) {
    const out = [];
    let cur = '';
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '[' || ch === '(') depth++;
      else if (ch === ']' || ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  // 解析端口 / 引脚引用：A、D[0]、D[3:0]、0、1
  function parseRef(text) {
    const s = String(text || '').trim();
    if (s === '0' || s === '1') return { const: Number(s) };
    const m = /^([A-Za-z_]\w*)(?:\s*\[\s*(\d+)\s*(?::\s*(\d+)\s*)?\])?$/.exec(s);
    if (!m) return null;
    if (m[2] === undefined) return { name: m[1] };
    if (m[3] === undefined) return { name: m[1], index: Number(m[2]) };
    return { name: m[1], msb: Number(m[2]), lsb: Number(m[3]) };
  }

  function refLabel(ref) {
    if (!ref) return '';
    if (ref.const !== undefined) return String(ref.const);
    if (ref.index !== undefined) return ref.name + '[' + ref.index + ']';
    if (ref.msb !== undefined) return ref.name + '[' + ref.msb + ':' + ref.lsb + ']';
    return ref.name;
  }

  function ensureNet(model, name, width, msb, lsb, line) {
    let net = model.nets.get(name);
    if (!net) {
      net = {
        name: name,
        width: width || 1,
        msb: msb === undefined ? (width || 1) - 1 : msb,
        lsb: lsb === undefined ? 0 : lsb,
        driver: null,
        sinks: [],
        order: model.nets.size
      };
      model.nets.set(name, net);
    } else if (width && net.width !== width) {
      err(model, '网络 ' + name + ' 位宽冲突：' + net.width + ' vs ' + width, line);
    }
    return net;
  }

  function addNode(model, node) {
    node.id = node.id || ('n' + (++model.idSeq));
    node.order = model.nodes.length;
    node.inputs = node.inputs || [];
    node.outputs = node.outputs || [];
    model.nodes.push(node);
    return node;
  }

  function nodeForPort(model, port) {
    const node = addNode(model, {
      kind: 'port',
      type: port.dir,
      dir: port.dir,
      name: port.name,
      width: port.width,
      msb: port.msb,
      lsb: port.lsb,
      clock: !!port.clock,
      inputs: [],
      outputs: port.dir === 'input' ? [{ name: port.name, width: port.width }] : []
    });
    if (port.dir === 'output') {
      node.inputs.push({ name: port.name, width: port.width, raw: { name: port.name } });
    }
    port.node = node;
    return node;
  }

  function getTap(model, base, index, range, line) {
    const key = index !== undefined
      ? base.name + '[' + index + ']'
      : base.name + '[' + Math.max(range.msb, range.lsb) + ':' + Math.min(range.msb, range.lsb) + ']';
    let net = model.nets.get(key);
    if (net) {
      if (!net.driver || net.driver.kind !== 'node' || net.driver.node.kind !== 'tap') {
        err(model, '网络 ' + key + ' 已被占用，不能作为位选', line);
      }
      return net;
    }

    const msb = index !== undefined ? index : Math.max(range.msb, range.lsb);
    const lsb = index !== undefined ? index : Math.min(range.msb, range.lsb);
    const width = msb - lsb + 1;
    net = ensureNet(model, key, width, msb, lsb, line);
    net.isTap = true;

    const node = addNode(model, {
      kind: 'tap',
      type: 'tap',
      name: key,
      width: width,
      index: index,
      range: index === undefined ? { msb: msb, lsb: lsb } : null,
      base: base,
      inputs: [{ name: base.name, width: base.width, net: base }],
      outputs: [{ name: key, width: width, net: net }]
    });
    node.inputs[0].node = node;
    base.sinks.push({ node: node, pin: node.inputs[0] });
    model.taps.set(key, node);
    if (net.driver) {
      err(model, '网络 ' + key + ' 存在多个驱动', line);
    } else {
      net.driver = { kind: 'node', node: node, pin: node.outputs[0] };
    }
    return net;
  }

  // 解析侧：把引用解析为网络；pinWidth 用于校验
  function resolveRef(model, ref, pinWidth, line, where) {
    if (!ref) {
      err(model, '无法解析引用' + (where ? '（' + where + '）' : ''), line);
      return null;
    }
    if (ref.const !== undefined) {
      const key = String(ref.const);
      let net = model.nets.get(key);
      if (!net) {
        net = ensureNet(model, key, 1, 0, 0, line);
        net.driver = { kind: 'const', value: ref.const };
        const node = addNode(model, {
          kind: 'const',
          type: 'const',
          name: key,
          value: ref.const,
          width: 1,
          inputs: [],
          outputs: [{ name: key, width: 1, net: net }]
        });
        net.driver.node = node;
      }
      if (pinWidth && pinWidth !== 1) {
        err(model, '常量 ' + key + ' 不能接到 ' + pinWidth + ' 位引脚上', line);
      }
      return net;
    }

    const base = model.nets.get(ref.name);
    if (!base) {
      err(model, '未定义网络 ' + ref.name + (where ? '（' + where + '）' : ''), line);
      return null;
    }

    let net = base;
    if (ref.index !== undefined) {
      if (ref.index < base.lsb || ref.index >= base.lsb + base.width) {
        err(model, '位选 ' + refLabel(ref) + ' 超出网络 ' + base.name + ' 的范围', line);
        return null;
      }
      net = base.width === 1 ? base : getTap(model, base, ref.index, null, line);
    } else if (ref.msb !== undefined) {
      const msb = Math.max(ref.msb, ref.lsb);
      const lsb = Math.min(ref.msb, ref.lsb);
      const width = msb - lsb + 1;
      if (lsb < base.lsb || msb >= base.lsb + base.width) {
        err(model, '位选 ' + refLabel(ref) + ' 超出网络 ' + base.name + ' 的范围', line);
        return null;
      }
      if (width === base.width && lsb === base.lsb) {
        net = base;
      } else {
        net = getTap(model, base, undefined, { msb: msb, lsb: lsb }, line);
      }
    }

    if (pinWidth && net.width !== pinWidth) {
      err(model, '网络 ' + net.name + ' 是 ' + net.width + ' 位，引脚需要 ' + pinWidth + ' 位' + (where ? '（' + where + '）' : ''), line);
    }
    return net;
  }

  function parsePorts(model, kind, body, line) {
    splitTop(body).forEach(part => {
      const ref = parseRef(part);
      if (!ref || ref.const !== undefined || ref.index !== undefined) {
        err(model, '端口声明无效：' + part, line);
        return;
      }
      const msb = ref.msb === undefined ? 0 : Math.max(ref.msb, ref.lsb);
      const lsb = ref.msb === undefined ? 0 : Math.min(ref.msb, ref.lsb);
      const width = ref.msb === undefined ? 1 : msb - lsb + 1;
      if (model.ports.some(p => p.name === ref.name)) {
        err(model, '端口重复声明：' + ref.name, line);
        return;
      }
      const port = {
        name: ref.name,
        dir: kind === 'output' ? 'output' : 'input',
        clock: kind === 'clock',
        width: width,
        msb: msb,
        lsb: lsb,
        line: line
      };
      model.ports.push(port);
      nodeForPort(model, port);
    });
  }

  function parseGate(model, m, line) {
    const type = m[1].toLowerCase();
    const name = m[2];
    const args = splitTop(m[3]).map(parseRef);
    const spec = GATES[type];
    if (args.some(a => !a)) {
      err(model, '门 ' + name + ' 的参数无法解析', line);
      return;
    }
    if (spec.inputs === '2+' && args.length < 2) {
      err(model, '门 ' + name + ' 至少需要两个输入', line);
    } else if (spec.inputs === 1 && args.length !== 1) {
      err(model, '门 ' + name + ' 只能有一个输入', line);
    }
    const node = addNode(model, {
      kind: 'gate',
      type: type,
      name: name,
      width: 1,
      inputs: args.map((ref, i) => ({ name: refLabel(ref), width: 1, raw: ref, idx: i })),
      outputs: [{ name: name, width: 1 }]
    });
    node.line = line;
  }

  function parseFF(model, m, line) {
    const type = m[1].toLowerCase();
    const name = m[2];
    const args = splitTop(m[3]).map(parseRef);
    const outs = splitTop(m[4]).map(parseRef);
    const spec = FFS[type];
    if (args.some(a => !a)) {
      err(model, '触发器 ' + name + ' 的参数无法解析', line);
      return;
    }
    if (args.length < 2 || args.length > spec.ins.length) {
      err(model, '触发器 ' + name + ' 的输入数量应为 2–' + spec.ins.length + '，实际 ' + args.length, line);
    }
    if (outs.length < 1 || outs.length > 2 || outs.some(o => !o || o.index !== undefined || o.msb !== undefined)) {
      err(model, '触发器 ' + name + ' 的输出应为 Q 或 Q, Qn', line);
      return;
    }
    const node = addNode(model, {
      kind: 'ff',
      type: type,
      name: name,
      width: 1,
      inputs: args.map((ref, i) => ({
        name: spec.ins[i] || ('IN' + i),
        width: 1,
        raw: ref,
        idx: i
      })),
      outputs: outs.map((ref, i) => ({
        name: ref.name,
        width: 1,
        qn: i === 1
      }))
    });
    node.line = line;
  }

  function parseBlock(model, m, line) {
    const type = m[1].toLowerCase();
    const name = m[2];
    const width = m[3] === undefined ? null : Number(m[3]);
    const args = splitTop(m[4]).map(parseRef);
    const outs = splitTop(m[5]).map(parseRef);
    const spec = BLOCKS[type];
    if (spec.width && (!width || width < 1 || width > 32)) {
      err(model, '块 ' + name + ' 需要用 name[n] 指定位宽（1–32）', line);
      return;
    }
    if (!spec.width && width !== null) {
      err(model, '块 ' + name + '（' + type + '）不使用位宽参数', line);
    }
    if (args.some(a => !a) || outs.some(o => !o || o.index !== undefined)) {
      err(model, '块 ' + name + ' 的参数无法解析', line);
      return;
    }
    const w = width || 1;

    // 可选尾部引脚：按数量取前缀
    const required = spec.ins.filter(p => !p.opt).length;
    const max = spec.ins.length;
    if (args.length < required || args.length > max) {
      err(model, '块 ' + name + ' 的输入数量应为 ' + required + '–' + max + '，实际 ' + args.length, line);
    }
    // counter 的 LOAD 与 D 必须成对出现
    if (type === 'counter' && args.length === 4) {
      err(model, 'counter ' + name + ' 的 LOAD 与 D 必须同时给出', line);
    }

    const pinWidth = (p) => {
      if (p.width === 'w') return w;
      if (p.width === '2^w') return Math.pow(2, w);
      return p.width;
    };
    const expectedOuts = spec.outs.map(p => ({ name: p.name, width: pinWidth(p) }));

    if (outs.length !== expectedOuts.length) {
      err(model, '块 ' + name + ' 需要 ' + expectedOuts.length + ' 个输出，实际 ' + outs.length, line);
    }
    outs.forEach((ref, i) => {
      const exp = expectedOuts[i];
      if (!exp) return;
      const ow = ref.msb === undefined ? (exp.width === 1 ? 1 : exp.width) : Math.max(ref.msb, ref.lsb) - Math.min(ref.msb, ref.lsb) + 1;
      if (ow !== exp.width) {
        err(model, '块 ' + name + ' 的输出 ' + ref.name + ' 应为 ' + exp.width + ' 位，实际 ' + ow + ' 位', line);
      }
    });

    const node = addNode(model, {
      kind: 'block',
      type: type,
      name: name,
      width: w,
      isSeq: !!spec.seq,
      inputs: args.map((ref, i) => {
        const p = spec.ins[i] || spec.ins[spec.ins.length - 1];
        return {
          name: p ? p.name : ('IN' + i),
          width: p ? pinWidth(p) : 1,
          raw: ref,
          idx: i
        };
      }),
      outputs: outs.map((ref, i) => {
        const exp = expectedOuts[i] || { name: ref.name, width: 1 };
        const msb = ref.msb === undefined ? exp.width - 1 : Math.max(ref.msb, ref.lsb);
        const lsb = ref.msb === undefined ? 0 : Math.min(ref.msb, ref.lsb);
        return { name: ref.name, width: exp.width, msb: msb, lsb: lsb };
      })
    });
    node.line = line;
  }

  function parseConnect(model, m, line) {
    const src = parseRef(m[1]);
    const dst = parseRef(m[2]);
    if (!src || !dst || dst.const !== undefined || dst.index !== undefined || dst.msb !== undefined) {
      err(model, 'connect 语法应为：connect 源 -> 目标网络', line);
      return;
    }
    const node = addNode(model, {
      kind: 'tap',
      type: 'connect',
      name: 'connect:' + dst.name,
      target: dst.name,
      width: 1,
      inputs: [{ name: refLabel(src), width: 1, raw: src }],
      outputs: [{ name: dst.name, width: 1 }]
    });
    node.line = line;
  }

  function parse(source) {
    const model = {
      title: '',
      truth: 'auto',
      pins: 'on',
      ports: [],
      nodes: [],
      nets: new Map(),
      taps: new Map(),
      errors: [],
      warnings: [],
      idSeq: 0,
      source: String(source || '')
    };

    const lines = model.source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      const line = stripComment(lines[i]).trim();
      if (!line) continue;

      let m;
      if ((m = /^title\s*:\s*(.+)$/i.exec(line))) { model.title = m[1].trim(); continue; }
      if ((m = /^truth\s*:\s*(on|off|auto)$/i.exec(line))) { model.truth = m[1].toLowerCase(); continue; }
      if ((m = /^pins\s*:\s*(on|off)$/i.exec(line))) { model.pins = m[1].toLowerCase(); continue; }

      if ((m = /^(input|output|clock)\b(.*)$/i.exec(line))) {
        parsePorts(model, m[1].toLowerCase(), m[2].trim(), lineNo);
        continue;
      }
      if ((m = /^connect\s+(.+?)\s*->\s*(.+)$/i.exec(line))) {
        parseConnect(model, m, lineNo);
        continue;
      }
      if ((m = /^(and|or|not|nand|nor|xor|xnor|buf)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/i.exec(line))) {
        parseGate(model, m, lineNo);
        continue;
      }
      if ((m = /^(dff|jkff|tff|srff|dlatch|srlatch)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*->\s*(.+)$/i.exec(line))) {
        parseFF(model, m, lineNo);
        continue;
      }
      if ((m = /^(register|counter|shiftreg|mux2|mux4|decoder|adder)\s+([A-Za-z_]\w*)(?:\s*\[\s*(\d+)\s*\])?\s*\(([^)]*)\)\s*->\s*(.+)$/i.exec(line))) {
        parseBlock(model, m, lineNo);
        continue;
      }

      err(model, '无法识别的语句：' + line, lineNo);
    }

    return model;
  }

  function finalize(model) {
    // 1) 端口网络
    model.ports.forEach(port => {
      const net = ensureNet(model, port.name, port.width, port.msb, port.lsb, port.line);
      net.port = port;
      if (port.dir === 'input') {
        if (net.driver) {
          err(model, '输入端口 ' + port.name + ' 与已有驱动冲突', port.line);
        } else {
          net.driver = { kind: 'port', port: port, node: port.node, pin: port.node.outputs[0] };
        }
      }
    });

    // 2) 组件输出网络
    model.nodes.forEach(node => {
      if (node.kind === 'port') return;
      node.outputs.forEach((out, idx) => {
        let name = out.name;
        let width = out.width || 1;
        if (node.kind === 'tap' && node.type === 'connect') {
          // 目标宽度在解析源之后再定
          return;
        }
        const net = ensureNet(model, name, width,
          out.msb === undefined ? width - 1 : out.msb,
          out.msb === undefined ? 0 : out.lsb,
          node.line);
        out.net = net;
        if (net.driver && net.driver.node !== node) {
          err(model, '网络 ' + name + ' 存在多个驱动', node.line);
        } else {
          net.driver = { kind: 'node', node: node, pin: out };
        }
      });
    });

    // 3) 解析输入引脚
    model.nodes.forEach(node => {
      if (node.kind === 'port') {
        if (node.dir === 'output') {
          const pin = node.inputs[0];
          const net = model.nets.get(pin.name);
          if (!net) {
            err(model, '输出端口 ' + pin.name + ' 未连接', node.line);
            return;
          }
          pin.net = net;
          pin.width = net.width;
          net.sinks.push({ node: node, pin: pin });
        }
        return;
      }
      if (node.kind === 'const') return;
      if (node.kind === 'tap' && node.type === 'connect') {
        const net = resolveRef(model, node.inputs[0].raw, null, node.line, 'connect');
        if (!net) return;
        node.inputs[0].net = net;
        node.inputs[0].width = net.width;
        net.sinks.push({ node: node, pin: node.inputs[0] });
        const target = node.target;
        const out = node.outputs[0];
        const tnet = ensureNet(model, target, net.width, net.width - 1, 0, node.line);
        if (tnet.driver && tnet.driver.node !== node) {
          err(model, '网络 ' + target + ' 存在多个驱动', node.line);
        } else {
          tnet.driver = { kind: 'node', node: node, pin: out };
        }
        out.width = net.width;
        out.net = tnet;
        node.width = net.width;
        return;
      }

      node.inputs.forEach(pin => {
        if (pin.net) {
          pin.net.sinks.push({ node: node, pin: pin });
          return;
        }
        const net = resolveRef(model, pin.raw, pin.width, node.line, node.name + '.' + pin.name);
        if (!net) return;
        pin.net = net;
        net.sinks.push({ node: node, pin: pin });
      });
    });

    // 4) 没有驱动的网络
    model.nets.forEach(net => {
      if (!net.driver && !net.isTap) {
        const port = net.port;
        if (port && port.dir === 'output') {
          err(model, '输出 ' + net.name + ' 没有驱动源', port.line);
        } else if (!net.sinks.length) {
          warn(model, '网络 ' + net.name + ' 未使用', 0);
        }
      } else if (!net.sinks.length && net.driver && net.driver.kind === 'node') {
        const dn = net.driver.node;
        // 触发器 / 块的空闲输出是正常暴露的引脚，不提示
        if (dn && (dn.kind === 'ff' || dn.kind === 'block')) return;
      }
    });

    // 5) 时序标记
    model.hasSequential = model.nodes.some(n =>
      n.kind === 'ff' ||
      (n.kind === 'block' && n.isSeq)
    );
    model.clockNets = new Set(model.ports.filter(p => p.clock).map(p => p.name));

    // 6) 时钟检查
    model.nodes.forEach(node => {
      if (node.kind !== 'ff' && node.kind !== 'block') return;
      const clk = node.inputs.find(p => p.name === 'CLK');
      if (clk && clk.net && !model.clockNets.has(clk.net.name)) {
        warn(model, node.name + ' 的 CLK 来自 ' + clk.net.name + '，建议用 clock 声明时钟输入', node.line);
      }
    });

    return model;
  }

  function buildEdges(model) {
    const edgeMap = new Map();
    model.nodes.forEach(node => { node.inEdges = []; node.outEdges = []; });

    function driverNode(net) {
      const d = net && net.driver;
      if (!d) return null;
      if (d.kind === 'node') return d.node;
      if (d.kind === 'port') return d.port.node;
      if (d.kind === 'const') return d.node;
      return null;
    }

    model.nets.forEach(net => {
      const from = driverNode(net);
      if (!from) return;
      net.sinks.forEach(sink => {
        const to = sink.node;
        if (!to || to === from) return;
        const key = from.id + '->' + to.id;
        let edge = edgeMap.get(key);
        if (!edge) {
          edge = { key: key, from: from, to: to, nets: [] };
          edgeMap.set(key, edge);
          from.outEdges.push(edge);
          to.inEdges.push(edge);
        }
        edge.nets.push(net);
      });
    });

    model.edges = Array.from(edgeMap.values());
    return model.edges;
  }

  // DFS 找反馈边（有向环中的回边）
  function markFeedback(model) {
    const state = new Map();
    const feedback = new Set();
    function dfs(u) {
      state.set(u, 1);
      u.outEdges.forEach(e => {
        const v = e.to;
        const st = state.get(v) || 0;
        if (st === 1) {
          e.feedback = true;
          feedback.add(e.key);
        } else if (st === 0) {
          dfs(v);
        }
      });
      state.set(u, 2);
    }
    model.nodes.forEach(n => {
      if ((state.get(n) || 0) === 0) dfs(n);
    });
    model.feedbackEdges = Array.from(feedback);
    return feedback;
  }

  function rankNodes(model) {
    const feedback = new Set(model.feedbackEdges || []);
    const indeg = new Map();
    const rank = new Map();
    model.nodes.forEach(n => { indeg.set(n, 0); rank.set(n, 0); });

    model.edges.forEach(e => {
      if (feedback.has(e.key)) return;
      indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
    });

    const queue = [];
    model.nodes.forEach(n => { if ((indeg.get(n) || 0) === 0) queue.push(n); });
    let processed = 0;
    while (queue.length) {
      const u = queue.shift();
      processed++;
      u.outEdges.forEach(e => {
        if (feedback.has(e.key)) return;
        const v = e.to;
        rank.set(v, Math.max(rank.get(v) || 0, (rank.get(u) || 0) + 1));
        indeg.set(v, (indeg.get(v) || 0) - 1);
        if (indeg.get(v) === 0) queue.push(v);
      });
    }

    if (processed < model.nodes.length) {
      // 理论上不会走到；兜底给未处理节点一个递增 rank
      model.nodes.forEach(n => {
        if (!rank.has(n)) rank.set(n, 1);
      });
    }

    // 输入 / 常量固定在 0 列
    model.nodes.forEach(n => {
      if (n.kind === 'port' && n.dir === 'input') rank.set(n, 0);
      if (n.kind === 'const') rank.set(n, 0);
    });

    // 输出端口放在它的驱动源右侧一列，避免所有输出都被推到最右边拉长走线
    let maxRank = 0;
    model.nodes.forEach(n => {
      if (n.kind === 'port' && n.dir === 'output') {
        const pin = n.inputs[0];
        const d = pin && pin.net && pin.net.driver;
        let r = 0;
        if (d) {
          const dn = d.kind === 'node' ? d.node : (d.kind === 'port' ? d.port.node : d.node);
          if (dn) r = rank.get(dn) || 0;
        }
        rank.set(n, r + 1);
      }
      maxRank = Math.max(maxRank, rank.get(n) || 0);
    });

    model.nodes.forEach(n => { n.rank = rank.get(n) || 0; });
    return rank;
  }

  function sizeNode(model, node) {
    if (node.kind === 'gate') {
      node.w = 64;
      node.h = Math.max(46, 16 + node.inputs.length * 14);
    } else if (node.kind === 'ff') {
      node.w = 92;
      node.h = Math.max(104, 46 + Math.max(node.inputs.length, node.outputs.length) * 20);
    } else if (node.kind === 'block') {
      node.w = node.type === 'register' || node.type === 'counter' ? 134 : 118;
      node.h = Math.max(88, 40 + Math.max(node.inputs.length, node.outputs.length) * 20);
    } else if (node.kind === 'port') {
      node.w = node.width > 1 ? 82 : 64;
      node.h = 32;
    } else if (node.kind === 'const') {
      node.w = 26;
      node.h = 24;
    } else {
      node.w = 0;
      node.h = 0;
    }
  }

  function layout(model) {
    const nodes = model.nodes;
    nodes.forEach(n => sizeNode(model, n));

    const ranks = new Map();
    nodes.forEach(n => {
      if (!ranks.has(n.rank)) ranks.set(n.rank, []);
      ranks.get(n.rank).push(n);
    });
    const rankKeys = Array.from(ranks.keys()).sort((a, b) => a - b);
    rankKeys.forEach(r => {
      ranks.get(r).sort((a, b) => a.order - b.order);
    });
    const maxRank = rankKeys[rankKeys.length - 1] || 0;

    // 重心法排序，减少交叉
    const pos = new Map();
    function refreshPos() {
      rankKeys.forEach(r => {
        ranks.get(r).forEach((n, i) => pos.set(n, i));
      });
    }
    refreshPos();

    // 小电路按声明顺序排更符合手绘习惯；大电路再用重心法减少交叉
    if (nodes.length > 10) {
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 1; i < rankKeys.length; i++) {
          const r = rankKeys[i];
          ranks.get(r).sort((a, b) => {
            const sa = avgPos(a.inEdges, pos, true);
            const sb = avgPos(b.inEdges, pos, true);
            return (sa - sb) || (a.order - b.order);
          });
          refreshPos();
        }
        for (let i = rankKeys.length - 2; i >= 0; i--) {
          const r = rankKeys[i];
          ranks.get(r).sort((a, b) => {
            const sa = avgPos(a.outEdges, pos, false);
            const sb = avgPos(b.outEdges, pos, false);
            return (sa - sb) || (a.order - b.order);
          });
          refreshPos();
        }
      }
    }

    // 列高与垂直居中
    const gapY = 26;
    const colHeights = new Map();
    rankKeys.forEach(r => {
      let h = 0;
      ranks.get(r).forEach(n => { h += n.h; });
      h += Math.max(0, ranks.get(r).length - 1) * gapY;
      colHeights.set(r, h);
    });
    const maxH = Math.max.apply(null, Array.from(colHeights.values()).concat([0]));

    const leftPad = 20;
    const topPad = 20;
    const rankWidth = new Map();
    rankKeys.forEach(r => {
      let w = 0;
      ranks.get(r).forEach(n => { w = Math.max(w, n.w); });
      rankWidth.set(r, w);
    });
    let colX = leftPad;
    rankKeys.forEach(r => {
      let y = topPad + (maxH - colHeights.get(r)) / 2;
      ranks.get(r).forEach(n => {
        n.x = colX;
        n.y = y;
        y += n.h + gapY;
      });
      colX += rankWidth.get(r) + (rankWidth.get(r) === 0 ? 42 : 70);
    });

    // tap 节点插在驱动源右侧
    const tapByBase = new Map();
    nodes.forEach(n => {
      if (n.kind !== 'tap' || n.type === 'connect') return;
      const base = n.base;
      if (!tapByBase.has(base)) tapByBase.set(base, []);
      tapByBase.get(base).push(n);
    });
    tapByBase.forEach((list, base) => {
      const driver = base.driver;
      let dx = leftPad;
      let dy = topPad;
      if (driver && driver.kind === 'node') {
        dx = driver.node.x + driver.node.w + 52;
        dy = driver.node.y + driver.node.h / 2;
      } else if (driver && driver.kind === 'port') {
        dx = driver.port.node.x + driver.port.node.w + 52;
        dy = driver.port.node.y + driver.port.node.h / 2;
      } else if (driver && driver.kind === 'const') {
        dx = driver.node.x + driver.node.w + 52;
        dy = driver.node.y + driver.node.h / 2;
      }
      list.sort((a, b) => (a.range ? a.range.msb : a.index) - (b.range ? b.range.msb : b.index));
      list.forEach((n, i) => {
        n.x = dx + i * 12;
        n.y = dy + (i - (list.length - 1) / 2) * 22;
        n.w = 0;
        n.h = 0;
      });
    });

    // 常量贴近它的负载，避免从最左侧拉一根长线穿过整张图
    nodes.forEach(n => {
      if (n.kind !== 'const' || !n.outputs[0] || !n.outputs[0].net) return;
      const sinks = n.outputs[0].net.sinks;
      if (!sinks || !sinks.length) return;
      const sink = sinks[0].node;
      if (!sink || sink.kind === 'port') return;
      n.x = Math.max(leftPad, sink.x - 56);
      n.y = sink.y + sink.h / 2 - n.h / 2;
    });

    // 引脚坐标
    nodes.forEach(n => {
      n.pins = { in: [], out: [] };
      if (n.kind === 'gate') {
        n.inputs.forEach((pin, i) => {
          pin.x = n.x;
          pin.y = n.y + n.h * (i + 1) / (n.inputs.length + 1);
          n.pins.in.push(pin);
        });
        n.outputs.forEach((pin, i) => {
          pin.x = n.x + n.w;
          pin.y = n.y + n.h / 2;
          n.pins.out.push(pin);
        });
      } else if (n.kind === 'ff' || n.kind === 'block') {
        const startIn = Math.max(n.y + 34, n.y + n.h / 2 - (n.inputs.length - 1) * 10);
        n.inputs.forEach((pin, i) => {
          pin.x = n.x;
          pin.y = startIn + i * 20;
          n.pins.in.push(pin);
        });
        const startOut = Math.max(n.y + 34, n.y + n.h / 2 - (n.outputs.length - 1) * 10);
        n.outputs.forEach((pin, i) => {
          pin.x = n.x + n.w;
          pin.y = startOut + i * 20;
          n.pins.out.push(pin);
        });
      } else if (n.kind === 'port') {
        if (n.dir === 'input') {
          const pin = n.outputs[0];
          pin.x = n.x + n.w;
          pin.y = n.y + n.h / 2;
          n.pins.out.push(pin);
        } else {
          const pin = n.inputs[0];
          pin.x = n.x;
          pin.y = n.y + n.h / 2;
          n.pins.in.push(pin);
        }
      } else if (n.kind === 'const') {
        const pin = n.outputs[0];
        pin.x = n.x + n.w;
        pin.y = n.y + n.h / 2;
        n.pins.out.push(pin);
      } else if (n.kind === 'tap') {
        const pinIn = n.inputs[0];
        const pinOut = n.outputs[0];
        pinIn.x = pinOut.x = n.x;
        pinIn.y = pinOut.y = n.y;
        n.pins.in.push(pinIn);
        n.pins.out.push(pinOut);
      }
    });

    // 边界
    let maxX = 0;
    let maxY = 0;
    nodes.forEach(n => {
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    });
    const feedbackCount = (model.feedbackEdges || []).length;
    maxY += 40 + feedbackCount * 6;

    model.layout = {
      width: Math.max(320, maxX + 30),
      height: Math.max(180, maxY + 30),
      leftPad: leftPad,
      topPad: topPad,
      maxRank: maxRank,
      colGap: 70
    };
    return model.layout;
  }

  function avgPos(edges, pos, useFrom) {
    if (!edges || !edges.length) return 1e9;
    let sum = 0;
    let n = 0;
    edges.forEach(e => {
      const node = useFrom ? e.from : e.to;
      if (pos.has(node)) {
        sum += pos.get(node);
        n++;
      }
    });
    return n ? sum / n : 1e9;
  }

  function build(source) {
    const model = parse(source);
    finalize(model);
    if (model.nodes.length) {
      buildEdges(model);
      markFeedback(model);
      rankNodes(model);
      layout(model);
    }
    return model;
  }

  // ---------- 组合逻辑求值 / 真值表 ----------

  function mask(width) {
    if (width >= 32) return 0xFFFFFFFF;
    return (1 << width) - 1;
  }

  function gateValue(node, vals) {
    const type = node.type;
    const a = vals[0] || 0;
    const b = vals[1] || 0;
    switch (type) {
      case 'not': return a ? 0 : 1;
      case 'buf': return a ? 1 : 0;
      case 'and': return vals.every(v => v) ? 1 : 0;
      case 'nand': return vals.every(v => v) ? 0 : 1;
      case 'or': return vals.some(v => v) ? 1 : 0;
      case 'nor': return vals.some(v => v) ? 0 : 1;
      case 'xor': return vals.reduce((acc, v) => acc ^ (v ? 1 : 0), 0) ? 1 : 0;
      case 'xnor': return vals.reduce((acc, v) => acc ^ (v ? 1 : 0), 0) ? 0 : 1;
      default: return 0;
    }
  }

  function blockValue(node, vals) {
    const w = node.width || 1;
    switch (node.type) {
      case 'mux2': return vals[2] ? vals[1] : vals[0];
      case 'mux4': return (vals[0] >> (vals[1] & 3)) & 1;
      case 'decoder': return vals[1] ? ((1 << (vals[0] & mask(w))) & mask(Math.pow(2, w))) : 0;
      case 'adder': {
        const sum = (vals[0] || 0) + (vals[1] || 0) + (vals[2] || 0);
        return sum;
      }
      default: return 0;
    }
  }

  function truthTable(model) {
    if (model.hasSequential || (model.feedbackEdges && model.feedbackEdges.length)) return null;

    const inputPorts = model.ports.filter(p => p.dir === 'input' && !p.clock);
    const outputPorts = model.ports.filter(p => p.dir === 'output');
    const inBits = inputPorts.reduce((s, p) => s + p.width, 0);
    const outBits = outputPorts.reduce((s, p) => s + p.width, 0);
    if (!inputPorts.length || !outputPorts.length) return null;

    const columns = [];
    inputPorts.forEach(p => {
      for (let i = p.width - 1; i >= 0; i--) {
        columns.push({ name: p.width > 1 ? p.name + '[' + (p.lsb + i) + ']' : p.name, port: p, bit: i, dir: 'in' });
      }
    });
    outputPorts.forEach(p => {
      for (let i = p.width - 1; i >= 0; i--) {
        columns.push({ name: p.width > 1 ? p.name + '[' + (p.lsb + i) + ']' : p.name, port: p, bit: i, dir: 'out' });
      }
    });

    if (inBits > 8) {
      return { tooLarge: true, inBits: inBits, outBits: outBits, columns: columns };
    }

    // 拓扑序（非反馈边）
    const feedback = new Set(model.feedbackEdges || []);
    const indeg = new Map();
    model.nodes.forEach(n => indeg.set(n, 0));
    model.edges.forEach(e => {
      if (!feedback.has(e.key)) indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
    });
    const queue = [];
    model.nodes.forEach(n => { if ((indeg.get(n) || 0) === 0) queue.push(n); });
    const order = [];
    while (queue.length) {
      const n = queue.shift();
      order.push(n);
      n.outEdges.forEach(e => {
        if (feedback.has(e.key)) return;
        indeg.set(e.to, (indeg.get(e.to) || 0) - 1);
        if (indeg.get(e.to) === 0) queue.push(e.to);
      });
    }
    if (order.length !== model.nodes.length) return null;

    // 组合节点里不应出现时序元件
    if (order.some(n => n.kind === 'ff' || (n.kind === 'block' && n.isSeq))) return null;

    const rows = [];
    const total = Math.pow(2, inBits);
    for (let r = 0; r < total; r++) {
      // 清值
      model.nets.forEach(net => { net.value = 0; });
      let k = 0;
      inputPorts.forEach(p => {
        let v = 0;
        for (let i = 0; i < p.width; i++) {
          const bit = (r >> k) & 1;
          if (bit) v |= (1 << i);
          k++;
        }
        model.nets.get(p.name).value = v;
      });

      order.forEach(n => {
        if (n.kind === 'port') return;
        if (n.kind === 'const') {
          model.nets.get(n.name).value = n.value ? 1 : 0;
          return;
        }
        if (n.kind === 'gate') {
          const vals = n.inputs.map(p => (p.net ? p.net.value : 0));
          const v = gateValue(n, vals) & 1;
          n.outputs.forEach(o => { if (o.net) o.net.value = v; });
          return;
        }
        if (n.kind === 'block') {
          if (n.isSeq) return;
          const vals = n.inputs.map(p => (p.net ? p.net.value : 0));
          let v = blockValue(n, vals);
          if (n.type === 'adder') {
            const w = n.width || 1;
            n.outputs.forEach(o => {
              if (o.name === 'S') o.net.value = v & mask(w);
              else if (o.name === 'Cout') o.net.value = (v >> w) & 1;
            });
          } else {
            v = v & mask(n.outputs[0].width || 1);
            n.outputs.forEach(o => { if (o.net) o.net.value = v; });
          }
          return;
        }
        if (n.kind === 'tap') {
          if (n.type === 'connect') {
            const v = n.inputs[0].net ? n.inputs[0].net.value : 0;
            n.outputs.forEach(o => { if (o.net) o.net.value = v & mask(o.width); });
            return;
          }
          const src = n.inputs[0].net ? n.inputs[0].net.value : 0;
          let v;
          let shift;
          if (n.index !== undefined) {
            shift = n.index - n.base.lsb;
            v = (src >> shift) & 1;
          } else {
            shift = n.range.lsb - n.base.lsb;
            v = (src >> shift) & mask(n.width);
          }
          n.outputs.forEach(o => { if (o.net) o.net.value = v & mask(o.width); });
        }
      });

      const cells = columns.map(c => {
        const v = model.nets.get(c.port.name).value || 0;
        return (v >> c.bit) & 1;
      });
      rows.push(cells);
    }

    return {
      columns: columns,
      rows: rows,
      inBits: inBits,
      outBits: outBits,
      inputCount: inputPorts.length,
      outputCount: outputPorts.length
    };
  }

  const api = {
    GATES: GATES,
    FFS: FFS,
    BLOCKS: BLOCKS,
    parse: parse,
    finalize: finalize,
    build: build,
    buildEdges: buildEdges,
    markFeedback: markFeedback,
    rankNodes: rankNodes,
    layout: layout,
    truthTable: truthTable,
    parseRef: parseRef,
    refLabel: refLabel,
    splitTop: splitTop
  };

  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.logicCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
