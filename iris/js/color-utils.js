/**
 * 全站共享颜色工具（graph.js 与 color 插件两套并行实现收敛于此）
 *
 * 契约：
 *   parseColor(str)          -> { hex, r, g, b } | null   支持 #hex3/#hex6（# 可省略）、rgb()/rgba()、color(srgb …)
 *   parseRgb(str)            -> [r, g, b] | null          数组形态（cytoscape/canvas 场景）
 *   resolveColor(cssValue, fallbackRgb) -> [r, g, b]      经浏览器计算值解析（能吃 var() / 任意主题格式）
 *   luminance(c)             -> 0..1                      入参 {r,g,b} 或 [r,g,b] 均可
 *   contrast(a, b)           -> 比值                       WCAG 对比度
 *   rgbToCss(rgb)            -> 'rgb(r, g, b)'
 *   hslToRgb(h, s, l)        -> [r, g, b]
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  function parseColor(str) {
    const s = String(str || '').trim();
    let m = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return { hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''), r, g, b };
    }
    m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(n => Number.isFinite(n))) {
        const r = Math.max(0, Math.min(255, Math.round(parts[0])));
        const g = Math.max(0, Math.min(255, Math.round(parts[1])));
        const b = Math.max(0, Math.min(255, Math.round(parts[2])));
        return { hex: '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''), r, g, b };
      }
      return null;
    }
    m = s.match(/^color\(srgb\s+([^)]+)\)$/i);
    if (m) {
      const parts = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
      if (parts.length >= 3 && parts.slice(0, 3).every(n => Number.isFinite(n))) {
        return parseColor('rgb(' + parts.slice(0, 3).map(v => Math.round(v * 255)).join(', ') + ')');
      }
      return null;
    }
    return null;
  }

  // 数组形态解析（graph.js 的 cytoscape/canvas 场景）
  function parseRgb(str) {
    const c = parseColor(str);
    return c ? [c.r, c.g, c.b] : null;
  }

  // 交给浏览器解析成计算值（能吃 var() / 任意主题自定义格式），再转成 RGB。
  // 不用 CSS color-mix：浏览器会把它的计算值序列化成 color(srgb …) / oklab()，
  // cytoscape 的解析器只认 rgb()/#hex，解析不了就会退回黑色。
  function resolveColor(cssValue, fallback) {
    if (!cssValue) return parseRgb(fallback) || [148, 163, 184];
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    probe.style.color = cssValue;
    document.body.appendChild(probe);
    let out = '';
    try { out = getComputedStyle(probe).color || ''; } catch (e) { out = ''; }
    probe.remove();
    return parseRgb(out) || parseRgb(cssValue) || parseRgb(fallback) || [148, 163, 184];
  }

  function toRgbTriple(c) {
    if (Array.isArray(c)) return c;
    if (c && typeof c === 'object') return [c.r, c.g, c.b];
    if (typeof c === 'string') {
      const parsed = parseColor(c);
      return parsed ? [parsed.r, parsed.g, parsed.b] : null;
    }
    return null;
  }

  function luminance(c) {
    const rgb = toRgbTriple(c);
    if (!rgb) return 0;
    const f = v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function rgbToCss(rgb) {
    return 'rgb(' + rgb.map(c => Math.max(0, Math.min(255, Math.round(c)))).join(', ') + ')';
  }

  function hslToRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0), f(8), f(4)].map(v => Math.round(v * 255));
  }

  window.MarkdownPreview.ColorUtils = { parseColor, parseRgb, resolveColor, luminance, contrast, rgbToCss, hslToRgb };
})();
