/**
 * gen-cover - 生成式封面（确定性程序化插画）
 *
 * 没有配图的文档按「路径哈希」确定性生成一张主题配色的几何封面：
 * 同一文档永远同一张图，零外部资源、零维护。样式家族四种（同心圆 /
 * 流线 / 山脊线 / 方点阵），按哈希挑选；构图参数（相位/密度/色带）同样
 * 从哈希推导——「哈希 → 种子 → 画」纯函数，无随机数，跨设备一致。
 *
 * 消费方：
 *   - 博客流 / 历史页 / 站点统计：列表卡片配图（getCoverElement）
 *   - 分享卡片：无图文档的 drawQuoteCard 背景（getCoverCanvas）
 * 惰性创建：只有页面真的要求封面时才画（每张 ~1ms 级）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 哈希与随机数 ==============

  function hashPath(path) {
    // FNV-1a 32bit：确定性、跨设备一致
    let h = 0x811c9dc5;
    const s = String(path || 'default');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // mulberry32：以哈希为种子的确定性 PRNG
  function rng(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex, fallback) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim().replace(/^#(?=[0-9a-f]{3}$)/i, ''));
    if (!m) {
      const m6 = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
      if (!m6) return fallback;
      const n6 = parseInt(m6[1], 16);
      return [(n6 >> 16) & 255, (n6 >> 8) & 255, n6 & 255];
    }
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(rgb, a) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

  // ============== 四种构图家族（W×H 逻辑坐标内绘制） ==============

  function drawRings(ctx, W, H, rand, accent, pink, text) {
    const cx = W * (0.3 + rand() * 0.4);
    const cy = H * (0.35 + rand() * 0.3);
    const rings = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < rings; i++) {
      const r = (Math.max(W, H) * 0.08) * (i + 1) * (0.8 + rand() * 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 ? rgba(accent, 0.32) : rgba(pink, 0.22);
      ctx.lineWidth = 2 + rand() * 3;
      ctx.stroke();
    }
  }

  function drawFlow(ctx, W, H, rand, accent, pink, text) {
    const lines = 9 + Math.floor(rand() * 5);
    const phase = rand() * Math.PI * 2;
    const amp = H * (0.06 + rand() * 0.08);
    for (let i = 0; i < lines; i++) {
      const y = (H / (lines + 1)) * (i + 1);
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) {
        const yy = y + Math.sin(x / W * Math.PI * 2 + phase + i * 0.4) * amp * (0.5 + i / lines);
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.strokeStyle = i % 3 === 0 ? rgba(pink, 0.28) : rgba(accent, 0.3);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  function drawRidge(ctx, W, H, rand, accent, pink, text) {
    const rows = 6 + Math.floor(rand() * 3);
    for (let r = 0; r < rows; r++) {
      const baseY = H * (0.35 + (r / rows) * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 10) {
        const noise = Math.sin(x * 0.02 + r * 1.7 + rand() * 0.02) * H * 0.05
          + Math.sin(x * 0.005 + r) * H * 0.04;
        ctx.lineTo(x, baseY - Math.abs(noise));
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = rgba(accent, 0.07 + r * 0.028);
      ctx.fill();
      ctx.strokeStyle = rgba(r % 2 ? pink : accent, 0.25);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  function drawDots(ctx, W, H, rand, accent, pink, text) {
    const gap = 26 + Math.floor(rand() * 14);
    for (let y = gap / 2; y < H; y += gap) {
      for (let x = gap / 2; x < W; x += gap) {
        const d = 1.5 + rand() * 3.5;
        ctx.beginPath();
        ctx.arc(x, y, d, 0, Math.PI * 2);
        ctx.fillStyle = rand() > 0.82 ? rgba(pink, 0.4) : rgba(accent, 0.3);
        ctx.fill();
      }
    }
    // 一条斜贯的强调色带
    ctx.strokeStyle = rgba(accent, 0.35);
    ctx.lineWidth = 5 + rand() * 4;
    ctx.beginPath();
    const sy = H * rand();
    ctx.moveTo(0, sy);
    ctx.quadraticCurveTo(W / 2, sy + (rand() - 0.5) * H * 0.6, W, H * rand());
    ctx.stroke();
  }

  const FAMILIES = [drawRings, drawFlow, drawRidge, drawDots];

  // ============== 公开 API ==============

  function themeColors() {
    const css = getComputedStyle(document.documentElement);
    const CU = window.MarkdownPreview.ColorUtils;
    const bg = css.getPropertyValue('--color-bg').trim() || '#fafafa';
    return {
      bg,
      accent: hexToRgb(css.getPropertyValue('--color-accent-purple').trim() || '#d4a5c9', [212, 165, 201]),
      pink: hexToRgb(css.getPropertyValue('--color-accent-pink').trim() || '#f2c4ce', [242, 196, 206]),
      text: hexToRgb(css.getPropertyValue('--color-text').trim() || '#2d2d2d', [45, 45, 45]),
      dark: CU ? CU.luminance(CU.resolveColor(bg, '#ffffff')) < 0.4 : false
    };
  }

  // 画到一个已有 canvas（逻辑尺寸 W×H，2x 超采样）
  function paintCover(canvas, path, W, H) {
    const seed = hashPath(path);
    const rand = rng(seed);
    const family = FAMILIES[seed % FAMILIES.length];
    const c = themeColors();

    const dpr = 2;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // 底色 + 暗角渐变让构图不贴边
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, W, H);
    const vign = ctx.createLinearGradient(0, 0, W, H);
    vign.addColorStop(0, rgba(c.accent, c.dark ? 0.10 : 0.07));
    vign.addColorStop(1, rgba(c.pink, c.dark ? 0.08 : 0.05));
    ctx.fillStyle = vign;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    family(ctx, W, H, rand, c.accent, c.pink, c.text);
    ctx.restore();

    // 左上角路径首字母角标（标识「这是生成封面」+ 文档区分度）
    const initial = String(path || '').split('/').pop().replace(/\.(md|txt)$/i, '').charAt(0).toUpperCase();
    if (initial) {
      ctx.fillStyle = rgba(c.text, 0.16);
      ctx.font = `700 ${Math.round(H * 0.1)}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(initial, W * 0.045, H * 0.05);
    }
    return canvas;
  }

  // 生成一个新 canvas 元素（列表卡片用）
  function getCoverElement(path, W, H) {
    const canvas = document.createElement('canvas');
    canvas.className = 'gen-cover';
    canvas.setAttribute('aria-hidden', 'true');
    paintCover(canvas, path, W || 320, H || 180);
    return canvas;
  }

  window.MarkdownPreview.genCover = { getCoverElement, paintCover, hashPath };
})();
