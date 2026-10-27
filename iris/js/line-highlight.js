/**
 * line-highlight - 代码行高亮
 *
 * 两种标记方式（可叠加）：
 *   1. fence 信息串带 `{2,5-8}`：` ```js {2,5-8} `（md-render.js 摘到
 *      pre[data-line-hl]，data-lang 保持纯语言 token）
 *   2. 代码内注释标记：行内含 `[!code highlight]`（VitePress 风格），
 *      命中行同时把标记文字从显示中剔除
 *
 * 实现：覆盖层方案——不改动 hljs 渲染出的 HTML（hljs 的 span 会跨行，
 * 按行切 HTML 必碎），在 pre 内垫一个 pointer-events:none 的高亮层，
 * 按统一行高计算目标行的偏移。pre 的白-space:pre 保证行数稳定，
 * ResizeObserver 兜底字号设置变化后的重排。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const MARKER = '[!code highlight]';

  // {2,5-8} → [2,5,6,7,8]（1-based，越界行忽略）
  function parseSpec(spec) {
    const lines = new Set();
    String(spec || '').replace(/[{}]/g, '').split(',').forEach(part => {
      const seg = part.trim();
      if (!seg) return;
      const range = seg.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const a = parseInt(range[1], 10), b = parseInt(range[2], 10);
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) lines.add(i);
      } else if (/^\d+$/.test(seg)) {
        lines.add(parseInt(seg, 10));
      }
    });
    return lines;
  }

  // 文本节点内剔除标记文字（标记通常整体位于单个文本节点里）
  function stripMarkers(codeEl) {
    const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.nodeValue && node.nodeValue.includes(MARKER)) {
        node.nodeValue = node.nodeValue.split(MARKER).join('');
      }
    });
  }

  function buildOverlay(pre, code, lineSet) {
    let overlay = pre.querySelector('.line-hl-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'line-hl-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      pre.appendChild(overlay);
    }
    overlay.innerHTML = '';

    const cs = getComputedStyle(code);
    let lh = parseFloat(cs.lineHeight);
    if (!isFinite(lh) || lh <= 0) lh = parseFloat(cs.fontSize) * 1.6 || 21;

    const baseTop = code.offsetTop; // offsetParent 为 pre（见下方 position:relative）
    const lines = [...lineSet].sort((a, b) => a - b);
    lines.forEach(no => {
      const bar = document.createElement('div');
      bar.className = 'line-hl-bar';
      bar.style.top = (baseTop + (no - 1) * lh) + 'px';
      bar.style.height = lh + 'px';
      overlay.appendChild(bar);
    });
  }

  function apply(root) {
    const scope = root || document.getElementById('markdownContent') ||
      document.querySelector('.markdown-body');
    if (!scope) return;

    scope.querySelectorAll('pre.code-block[data-line-hl]').forEach(pre => {
      const code = pre.querySelector('code');
      if (!code || pre.dataset.lineHlInit) return;
      pre.dataset.lineHlInit = '1';
      pre.classList.add('has-line-hl');
      // overlay 的定位锚：确保 offsetParent 是 pre
      if (getComputedStyle(pre).position === 'static') pre.style.position = 'relative';

      const lineSet = parseSpec(pre.dataset.lineHl);

      // 注释标记行：先按纯文本定位行号，再剔除标记文字
      const text = code.textContent || '';
      const textLines = text.split('\n');
      let hasMarker = false;
      textLines.forEach((line, idx) => {
        if (line.includes(MARKER)) {
          lineSet.add(idx + 1);
          hasMarker = true;
        }
      });
      if (hasMarker) stripMarkers(code);

      if (lineSet.size === 0) return;

      const position = () => {
        if (!pre.isConnected) { ro.disconnect(); return; }
        buildOverlay(pre, code, lineSet);
      };
      const schedule = () => requestAnimationFrame(position);
      const ro = new ResizeObserver(schedule);
      ro.observe(code);
      // hljs 渐进高亮不改变行数，覆盖层可立即布局；字号/宽度变化由 RO 跟进
      schedule();
    });
  }

  window.MarkdownPreview.lineHighlight = { apply };
})();
