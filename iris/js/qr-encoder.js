/**
 * QR Code 编码器（字节模式，版本 1–10，纠错等级 L/M/Q/H，全 8 掩码评分）
 *
 * 为什么手写：qrcode 插件与 qr-share 原先把内容明文发给第三方二维码 API
 * （api.qrserver.com / chart.googleapis.com），且 fallback 是不可扫描的伪二维码。
 * 本地生成后内容不出本机。独立单文件、零依赖、按需 loadScript 加载。
 *
 * 算法：ISO/IEC 18004。块结构与 EC 表、对齐图案坐标、format/version 信息的
 * BCH 多项式（0x537 / 0x1F25，掩码 0x5412）均按规范实现；生成后用内置的
 * 「去掩码 → 解交织 → RS 校验 → 码流重解析」回读管线自验（见 selfTest）。
 *
 * API：
 *   QREncoder.encode(text, { ecl }) -> { size, modules } | null（超长返回 null）
 *   QREncoder.toSVG(text, opts)     -> '<svg …>' 字符串
 *   QREncoder.capacity(ecl)         -> 当前实现支持的最大字节数
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const MAX_VERSION = 10;

  // format info 中的纠错等级两位：L=01 M=00 Q=11 H=10
  const ECL_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
  const ECL_ORDER = { L: 0, M: 1, Q: 2, H: 3 };

  // 每版本每等级：[每块EC码字, A组块数, A组每块数据码字, (B组块数, B组每块数据码字)]
  const BLOCK_TABLE = {
    1:  { L: [7, 1, 19],            M: [10, 1, 16],          Q: [13, 1, 13],          H: [17, 1, 9] },
    2:  { L: [10, 1, 34],           M: [16, 1, 28],          Q: [22, 1, 22],          H: [28, 1, 16] },
    3:  { L: [15, 1, 55],           M: [26, 1, 44],          Q: [18, 2, 17],          H: [22, 2, 13] },
    4:  { L: [20, 1, 80],           M: [18, 2, 32],          Q: [26, 2, 24],          H: [16, 4, 9] },
    5:  { L: [26, 1, 108],          M: [24, 2, 43],          Q: [18, 2, 15, 2, 16],   H: [22, 2, 11, 2, 12] },
    6:  { L: [18, 2, 68],           M: [16, 4, 27],          Q: [24, 4, 19],          H: [28, 4, 15] },
    7:  { L: [20, 2, 78],           M: [18, 4, 31],          Q: [18, 2, 14, 4, 15],   H: [26, 4, 13, 1, 14] },
    8:  { L: [24, 2, 97],           M: [22, 2, 38, 2, 39],   Q: [22, 4, 18, 2, 19],   H: [26, 4, 14, 2, 15] },
    9:  { L: [30, 2, 116],          M: [22, 3, 36, 2, 37],   Q: [20, 4, 16, 4, 17],   H: [24, 4, 12, 4, 13] },
    10: { L: [18, 2, 68, 2, 69],    M: [26, 4, 43, 1, 44],   Q: [24, 6, 19, 2, 20],   H: [28, 6, 15, 2, 16] }
  };

  // 各版本对齐图案中心坐标（v1 无）
  const ALIGNMENT = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  // 每版本数据区排布后的剩余位（v1: 0，v2–6: 7，v7–13: 0）
  const REMAINDER_BITS = { 1: 0, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 0, 8: 0, 9: 0, 10: 0 };

  // ============== GF(256)（多项式 0x11D） ==============
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  // RS 生成多项式（degree = ecLen）
  const GEN_CACHE = {};
  function rsGenerator(ecLen) {
    if (GEN_CACHE[ecLen]) return GEN_CACHE[ecLen];
    let poly = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gmul(poly[j], EXP[i]);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    // poly 现为低次在前（常数项在前），翻转为高次在前便于除法
    const result = poly.reverse();
    GEN_CACHE[ecLen] = result;
    return result;
  }

  function rsEncode(data, ecLen) {
    const gen = rsGenerator(ecLen);
    const rem = new Uint8Array(ecLen);
    for (const b of data) {
      const factor = b ^ rem[0];
      rem.copyWithin(0, 1);
      rem[ecLen - 1] = 0;
      if (factor !== 0) {
        for (let i = 0; i < ecLen; i++) rem[i] ^= gmul(gen[i + 1], factor);
      }
    }
    return rem;
  }

  // ============== 位流 ==============
  function BitBuffer() {
    this.bytes = [];
    this.len = 0; // 位长
  }
  BitBuffer.prototype.append = function(value, bits) {
    for (let i = bits - 1; i >= 0; i--) {
      const bit = (value >>> i) & 1;
      const byteIdx = this.len >> 3;
      if (byteIdx >= this.bytes.length) this.bytes.push(0);
      if (bit) this.bytes[byteIdx] |= (0x80 >> (this.len & 7));
      this.len++;
    }
  };

  // ============== 几何 ==============
  function sizeOf(version) { return version * 4 + 17; }

  function buildFunctionPatterns(version) {
    const size = sizeOf(version);
    // 0=数据区，1=功能区；再单独记录功能区颜色（2=恒暗）
    const isFunction = new Uint8Array(size * size);
    const set = (x, y, v) => { isFunction[y * size + x] = 1; if (v !== undefined) isFunction[y * size + x] = v; };

    // 三个定位图案（含分隔符）+ 恒暗边界
    const finder = (cx, cy) => {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || x >= size || y < 0 || y >= size) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const dark = dist !== 2 && dist !== 4; // 3圈黑、1圈白、外圈白分隔
          set(x, y, dark ? 2 : 1);
        }
      }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);

    // 时机图案
    for (let i = 8; i < size - 8; i++) {
      const dark = i % 2 === 0 ? 2 : 1;
      if (!isFunction[6 * size + i]) set(i, 6, dark);
      if (!isFunction[i * size + 6]) set(6, i, dark);
    }

    // 对齐图案
    const centers = ALIGNMENT[version];
    for (const cy of centers) {
      for (const cx of centers) {
        // 避开三个定位角
        if ((cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const dark = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
            set(cx + dx, cy + dy, dark ? 2 : 1);
          }
        }
      }
    }

    // 恒暗模块 + 格式信息保留区（防数据位溢入，颜色稍后由 drawFormatBits 覆写）
    set(8, size - 8, 2);
    // 第一份：列 8 行 0-5/7/8 + 行 8 列 0-5/7（行/列 6 是时机图案，跳过）
    for (let i = 0; i <= 5; i++) { set(8, i, 1); set(i, 8, 1); }
    set(8, 7, 1); set(8, 8, 1); set(7, 8, 1);
    // 第二份：行 8 尾部 8 格 + 列 8 尾部 7 格
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, 1);
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, 1);

    // version info（v7+，两份 6×3）
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = (bits >>> i) & 1 ? 2 : 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        set(a, b, bit);
        set(b, a, bit);
      }
    }
    return { isFunction, size };
  }

  function drawFormatBits(setModule, size, ecl, mask) {
    const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = i => (bits >>> i) & 1 ? 2 : 1;
    // 第一份（左上）
    for (let i = 0; i <= 5; i++) setModule(8, i, bit(i));
    setModule(8, 7, bit(6));
    setModule(8, 8, bit(7));
    setModule(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setModule(14 - i, 8, bit(i));
    // 第二份（拆两段）
    for (let i = 0; i < 8; i++) setModule(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setModule(8, size - 15 + i, bit(i));
    setModule(8, size - 8, 2); // 恒暗
  }

  // ============== 主编码流程 ==============

  function chooseVersion(byteLen, ecl) {
    for (let v = 1; v <= MAX_VERSION; v++) {
      const totalData = dataCodewords(v, ecl);
      // 头部：模式 4 位 + 字符数（v1–9: 8 位，v10+: 16 位）
      const headerBits = 4 + (v <= 9 ? 8 : 16);
      const capacityBits = totalData * 8;
      if (headerBits + byteLen * 8 + 4 <= capacityBits) return v; // 4 位 terminator 至少留出
    }
    return null;
  }

  function dataCodewords(version, ecl) {
    const t = BLOCK_TABLE[version][ecl];
    let sum = 0;
    for (let i = 1; i < t.length; i += 2) sum += t[i] * t[i + 1];
    return sum;
  }

  function makeCodewords(version, ecl, dataBytes) {
    const t = BLOCK_TABLE[version][ecl];
    const ecLen = t[0];
    const blocks = [];
    let offset = 0;
    for (let i = 1; i < t.length; i += 2) {
      const count = t[i], dataLen = t[i + 1];
      for (let b = 0; b < count; b++) {
        const block = dataBytes.subarray(offset, offset + dataLen);
        offset += dataLen;
        blocks.push({ data: block, ec: rsEncode(block, ecLen) });
      }
    }
    // 交织输出：先逐列取所有块的数据码字，再逐列取 EC 码字
    const maxData = Math.max(...blocks.map(b => b.data.length));
    const out = [];
    for (let i = 0; i < maxData; i++) {
      for (const b of blocks) if (i < b.data.length) out.push(b.data[i]);
    }
    for (let i = 0; i < ecLen; i++) {
      for (const b of blocks) out.push(b.ec[i]);
    }
    return Uint8Array.from(out);
  }

  const MASK_FNS = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0
  ];

  function penaltyScore(modules, size) {
    let score = 0;
    const at = (x, y) => modules[y * size + x];

    // N1：行/列同色连续段 ≥5
    const lineRuns = (get, n) => {
      for (let a = 0; a < n; a++) {
        let run = 1;
        let prev = get(a, 0);
        for (let b = 1; b < n; b++) {
          const cur = get(a, b);
          if (cur === prev) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else { run = 1; prev = cur; }
        }
      }
    };
    lineRuns((a, b) => at(b, a), size); // 行
    lineRuns((a, b) => at(a, b), size); // 列

    // N2：2×2 同色块
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const v = at(x, y);
        if (v === at(x + 1, y) && v === at(x, y + 1) && v === at(x + 1, y + 1)) score += 3;
      }
    }

    // N3：1:1:3:1:1 图案（带 4 亮边：10111010000 / 00001011101）
    const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const scan = (get, n) => {
      for (let a = 0; a < n; a++) {
        for (let b = 0; b <= n - 11; b++) {
          let m1 = true, m2 = true;
          for (let k = 0; k < 11; k++) {
            const v = get(a, b + k);
            if (v !== P1[k]) m1 = false;
            if (v !== P2[k]) m2 = false;
            if (!m1 && !m2) break;
          }
          if (m1 || m2) score += 40;
        }
      }
    };
    scan((a, b) => at(b, a), size);
    scan((a, b) => at(a, b), size);

    // N4：暗模块占比偏离 50%
    let dark = 0;
    for (let i = 0; i < modules.length; i++) if (modules[i]) dark++;
    const total = size * size;
    const k = Math.floor(Math.abs(dark * 100 / total - 50) / 5);
    score += k * 10;
    return score;
  }

  /**
   * 编码文本为 QR 矩阵
   * @param {string} text - UTF-8 文本
   * @param {Object} [opts] - { ecl: 'L'|'M'|'Q'|'H'（默认 'M'） }
   * @returns {{ size: number, modules: Uint8Array } | null} 超长/失败返回 null
   */
  function encode(text, opts) {
    opts = opts || {};
    const ecl = opts.ecl && ECL_FORMAT_BITS[opts.ecl] !== undefined ? opts.ecl : 'M';

    const utf8 = new TextEncoder().encode(String(text == null ? '' : text));
    const version = chooseVersion(utf8.length, ecl);
    if (!version) return null;

    // --- 位流：模式 + 字符数 + 数据 + terminator + pad ---
    const buf = new BitBuffer();
    buf.append(4, 4); // byte mode
    buf.append(utf8.length, version <= 9 ? 8 : 16);
    for (const b of utf8) buf.append(b, 8);
    const capacityBits = dataCodewords(version, ecl) * 8;
    const termLen = Math.min(4, capacityBits - buf.len);
    if (termLen > 0) buf.append(0, termLen);
    while (buf.len % 8 !== 0) buf.append(0, 1);
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (buf.bytes.length < dataCodewords(version, ecl)) buf.append(padBytes[padIdx++ % 2], 8);

    // --- 码字交织 + 矩阵放置 ---
    const codewords = makeCodewords(version, ecl, Uint8Array.from(buf.bytes));
    const { isFunction, size } = buildFunctionPatterns(version);

    const modules = new Uint8Array(size * size);
    const reserve = (x, y, v) => { modules[y * size + x] = v; };

    // 数据位按之字形放置（跳过功能区）
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y * size + x] && bitIdx < totalBits) {
            modules[y * size + x] = (codewords[bitIdx >> 3] >>> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
        }
      }
    }

    // 掩码评分（在格式位写出前对数据区应用各掩码并打分）
    let bestMask = 0, bestScore = Infinity;
    const masked = new Uint8Array(size * size);
    for (let m = 0; m < 8; m++) {
      masked.set(modules);
      const fn = MASK_FNS[m];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (!isFunction[y * size + x] && fn(y, x)) masked[y * size + x] ^= 1;
        }
      }
      const s = penaltyScore(masked, size);
      if (s < bestScore) { bestScore = s; bestMask = m; }
    }

    // 应用最优掩码 + 功能图案着色 + 写格式信息
    const fn = MASK_FNS[bestMask];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const f = isFunction[y * size + x];
        if (f) {
          // 功能区（定位/时机/对齐/格式保留）：按图案颜色落笔（2=暗 1=亮）
          modules[y * size + x] = f === 2 ? 1 : 0;
        } else if (fn(y, x)) {
          modules[y * size + x] ^= 1;
        }
      }
    }
    // 格式信息写两份（v=2 恒暗 → 1）
    drawFormatBits((x, y, v) => { modules[y * size + x] = v === 2 ? 1 : 0; }, size, ecl, bestMask);

    return { size, modules };
  }

  // ============== SVG 输出 ==============

  /**
   * @param {string} text
   * @param {Object} [opts] - { ecl, margin（默认 4 模块静区）, scale（默认 8）, dark, light }
   */
  function toSVG(text, opts) {
    opts = opts || {};
    const qr = encode(text, opts);
    if (!qr) return null;
    // 静区按规范至少 4 个模块（quiet zone），低于该值部分扫码器识别率下降
    const margin = opts.margin !== undefined ? opts.margin : 4;
    const scale = opts.scale || 8;
    const dark = opts.dark || '#000000';
    const light = opts.light || '#ffffff';
    const dim = (qr.size + margin * 2) * scale;
    let rects = '';
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.modules[y * qr.size + x]) {
          rects += `<rect x="${(x + margin) * scale}" y="${(y + margin) * scale}" width="${scale}" height="${scale}"/>`;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" ` +
      `shape-rendering="crispEdges" role="img"><rect width="${dim}" height="${dim}" fill="${light}"/>` +
      `<g fill="${dark}">${rects}</g></svg>`;
  }

  function capacity(ecl) {
    const v = MAX_VERSION;
    const totalData = dataCodewords(v, ecl && ECL_FORMAT_BITS[ecl] !== undefined ? ecl : 'M');
    // 4 位模式 + 16 位字符数 + 最多 4 位 terminator
    return Math.floor((totalData * 8 - 24) / 8);
  }

  // ============== 自验（去掩码 → RS 校验 → 码流重解析） ==============

  function selfTest() {
    const results = [];
    for (const ecl of ['L', 'M', 'Q', 'H']) {
      const cap = capacity(ecl);
      for (const len of [1, 7, 14, 27, 60, 120, 200, cap].filter(n => n <= cap)) {
        const text = 'A'.repeat(len);
        const qr = encode(text, { ecl });
        results.push(qr && readBack(qr, ecl, text) === true);
      }
    }
    // 容量边界：超长必须返回 null
    results.push(encode('A'.repeat(capacity('M') + 1), { ecl: 'M' }) === null);
    return results.every(Boolean);
  }

  function readBack(qr, ecl, originalText) {
    const { size, modules } = qr;
    // 读格式信息（左上副本）得掩码号
    let fmt = 0;
    for (let i = 0; i <= 5; i++) fmt |= (modules[i * size + 8] ? 1 : 0) << i;
    fmt |= (modules[7 * size + 8] ? 1 : 0) << 6;
    fmt |= (modules[8 * size + 8] ? 1 : 0) << 7;
    fmt |= (modules[8 * size + 7] ? 1 : 0) << 8;
    for (let i = 9; i < 15; i++) fmt |= (modules[8 * size + (14 - i)] ? 1 : 0) << i;
    fmt ^= 0x5412;
    // 重算 BCH 余式校验格式信息完整性
    const fmtData = fmt >> 10;
    let rem2 = fmtData;
    for (let i = 0; i < 10; i++) rem2 = (rem2 << 1) ^ ((rem2 >>> 9) * 0x537);
    if (((fmtData << 10) | rem2) !== fmt) return false;
    // 格式码字布局：[ecl 2 位 | mask 3 位 | BCH 余式 10 位]
    const maskId = (fmt >>> 10) & 7;
    const eclBits = (fmt >>> 13) & 3;
    if (eclBits !== ECL_FORMAT_BITS[ecl]) return false;

    // 去掩码收集数据区位（尾部剩余位不计入码字）
    const version = versionOf(size);
    const fn = buildFunctionPatterns(version);
    const bits = [];
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!fn.isFunction[y * size + x]) {
            let v = modules[y * size + x];
            if (MASK_FNS[maskId](y, x)) v ^= 1;
            bits.push(v);
          }
        }
      }
    }
    const totalCw = (bits.length - REMAINDER_BITS[version]) / 8;
    const codewords = new Uint8Array(totalCw);
    for (let i = 0; i < totalCw; i++) {
      let b = 0;
      for (let k = 0; k < 8; k++) b = (b << 1) | bits[i * 8 + k];
      codewords[i] = b;
    }
    // 解交织 + RS 校验
    const t = BLOCK_TABLE[version][ecl];
    const ecLen = t[0];
    const blocks = [];
    for (let i = 1; i < t.length; i += 2) {
      for (let b = 0; b < t[i]; b++) blocks.push(t[i + 1]);
    }
    const maxData = Math.max(...blocks);
    const blockData = blocks.map(len => new Uint8Array(len));
    let p = 0;
    for (let i = 0; i < maxData; i++) {
      for (let b = 0; b < blocks.length; b++) {
        if (i < blocks[b]) blockData[b][i] = codewords[p++];
      }
    }
    const blockEc = blocks.map(() => new Uint8Array(ecLen));
    for (let i = 0; i < ecLen; i++) {
      for (let b = 0; b < blocks.length; b++) blockEc[b][i] = codewords[p++];
    }
    for (let b = 0; b < blocks.length; b++) {
      const all = new Uint8Array(blocks[b] + ecLen);
      all.set(blockData[b], 0);
      all.set(blockEc[b], blocks[b]);
      const synd = rsSyndromes(all, ecLen);
      if (synd.some(s => s !== 0)) return false;
    }
    // 码流重解析
    const dataBytes = concat(blockData);
    const reader = { pos: 0, bytes: dataBytes };
    const mode = readBits(reader, 4);
    if (mode !== 4) return false;
    const count = readBits(reader, versionOf(size) <= 9 ? 8 : 16);
    if (count !== originalText.length) return false;
    for (let i = 0; i < count; i++) {
      if (readBits(reader, 8) !== 0x41) return false; // 'A'
    }
    return true;
  }

  function rsSyndromes(codewords, ecLen) {
    // S_i = C(α^i)：将码字多项式（高次在前）在 α^i 处 Horner 求值
    const synd = [];
    for (let i = 0; i < ecLen; i++) {
      const alpha = EXP[i];
      let s = 0;
      for (let j = 0; j < codewords.length; j++) {
        s = gmul(s, alpha) ^ codewords[j];
      }
      synd.push(s);
    }
    return synd;
  }

  function readBits(reader, n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = reader.bytes[reader.pos >> 3] || 0;
      v = (v << 1) | ((byte >> (7 - (reader.pos & 7))) & 1);
      reader.pos++;
    }
    return v;
  }

  function concat(arrs) {
    let len = 0;
    for (const a of arrs) len += a.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const a of arrs) { out.set(a, off); off += a.length; }
    return out;
  }

  function versionOf(size) { return (size - 17) / 4; }

  window.MarkdownPreview.QREncoder = { encode, toSVG, capacity, selfTest };
})();
