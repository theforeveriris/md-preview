/**
 * 选中文字浮动工具栏 + 主题化分享卡片
 *
 * 划选正文文字后浮出小工具条：复制 / 站内搜索 / 生成分享卡片。
 * 交互对齐既有内容操作：表格手柄、LaTeX 右键复制（均使用内联 SVG 图标）。
 *
 * 分享卡片：Canvas 手绘 1200×630 卡片（与 OGP 分享图同尺寸），
 * 配色取当前主题 CSS 变量（--color-bg / --color-text / 强调色渐变），
 * 深浅主题自动适配。入口仅有选中文字工具条「分享卡片」。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  let toolbarEl = null;
  let hideTimer = null;
  const MIN_SELECTION_LEN = 2;
  const CARD_MAX_CHARS = 600;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function icon(name, size) {
    return `<svg width="${size || 15}" height="${size || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  function copyText(text) {
    return new Promise((resolve) => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(resolve, () => { legacyCopy(text); resolve(); });
      } else {
        legacyCopy(text); resolve();
      }
    });
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    ta.remove();
  }

  // ============== 选中工具条 ==============
  function ensureToolbar() {
    if (toolbarEl) return toolbarEl;
    toolbarEl = document.createElement('div');
    toolbarEl.className = 'doc-selection-toolbar';
    toolbarEl.setAttribute('role', 'toolbar');
    document.body.appendChild(toolbarEl);

    toolbarEl.addEventListener('mousedown', (e) => e.preventDefault()); // 防止点击按钮丢失选区
    return toolbarEl;
  }

  function hideToolbar() {
    if (toolbarEl) toolbarEl.classList.remove('open');
  }

  function getSelectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (text.length < MIN_SELECTION_LEN) return null;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!el || !el.closest) return null;
    // 只对文档正文生效；放映 / 编辑器 / 灯箱内不弹
    if (!el.closest('.markdown-body') || el.closest('.slides-overlay')) return null;
    if (el.closest('.doc-selection-toolbar, .ctx-menu, .csv-table')) return null;
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { text: text.slice(0, CARD_MAX_CHARS), rawText: sel.toString(), rect };
  }

  function showToolbar(info) {
    const el = ensureToolbar();
    el.innerHTML = `
      <button type="button" data-action="copy" title="${esc(t('sel.copy', '复制'))}">${icon('i-copy')}<span>${esc(t('sel.copy', '复制'))}</span></button>
      <button type="button" data-action="search" title="${esc(t('sel.search', '站内搜索'))}">${icon('i-search')}<span>${esc(t('sel.search', '站内搜索'))}</span></button>
      <button type="button" data-action="card" title="${esc(t('sel.card', '生成分享卡片'))}">${icon('i-image')}<span>${esc(t('sel.card', '分享卡片'))}</span></button>
    `;
    el.querySelector('[data-action="copy"]').addEventListener('click', () => {
      copyText(info.rawText).then(hideToolbar);
    });
    el.querySelector('[data-action="search"]').addEventListener('click', () => {
      const ui = window.MarkdownPreview.ui;
      hideToolbar();
      if (ui && typeof ui.openSearchPalette === 'function') {
        ui.openSearchPalette();
        const input = document.getElementById('searchInput');
        if (input) {
          input.value = info.text.slice(0, 60);
          input.dispatchEvent(new Event('input'));
        }
      }
    });
    el.querySelector('[data-action="card"]').addEventListener('click', () => {
      hideToolbar();
      exportShareCard({ title: docTitle(), excerpt: info.text });
    });

    // 先挂载拿到尺寸，再按视口边界定位在选区上方
    el.classList.add('open');
    const r = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(info.rect.left + info.rect.width / 2 - r.width / 2, window.innerWidth - r.width - 8));
    const y = info.rect.top - r.height - 8;
    el.style.left = x + 'px';
    // 选区太靠上时放到选区下方
    el.style.top = (y < 8 ? info.rect.bottom + 8 : y) + 'px';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function docTitle() {
    const st = window.MarkdownPreview.state || {};
    return st.docTitle || document.title.split(' | ')[0] || '';
  }

  // ============== 主题化分享卡片（Canvas） ==============
  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // 文本按像素宽度硬换行（CJK 逐字、西文按词，与表格 PNG 导出同思路）
  function wrapLine(ctx, text, maxWidth) {
    if (!text) return [''];
    const tokens = text.split(/(\s+)/).filter(tok => tok !== '');
    const lines = [];
    let current = '';
    const push = () => { lines.push(current); current = ''; };
    for (const token of tokens) {
      if (ctx.measureText(token).width > maxWidth && token.length > 1) {
        for (const ch of token) {
          if (ctx.measureText(current + ch).width > maxWidth && current) push();
          current += ch;
        }
        continue;
      }
      if (ctx.measureText(current + token).width > maxWidth && current) {
        push();
        if (/^\s+$/.test(token)) continue;
      }
      current += token;
    }
    if (current) lines.push(current);
    return lines;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function exportShareCard(content) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const W = 1200, H = 630, scale = 2;
    const bg = cssVar('--color-bg', '#fafafa');
    const text = cssVar('--color-text', '#2d2d2d');
    const muted = cssVar('--color-text-muted', '#999999');
    const accent1 = cssVar('--color-accent-purple', '#d4a5c9');
    const accent2 = cssVar('--color-accent-pink', '#f2c4ce');
    const surface = cssVar('--color-surface', '#ffffff');
    const bodyFont = getComputedStyle(document.querySelector('.markdown-body') || document.body).fontFamily || 'sans-serif';

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // 背景（页面底色）+ 卡片面
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    roundRectPath(ctx, 28, 28, W - 56, H - 56, 20);
    ctx.fillStyle = surface;
    ctx.fill();
    ctx.strokeStyle = cssVar('--color-border', '#f0f0f0');
    ctx.lineWidth = 1;
    ctx.stroke();

    // 顶部强调色渐变条
    const grad = ctx.createLinearGradient(28, 0, W - 28, 0);
    grad.addColorStop(0, accent1);
    grad.addColorStop(1, accent2);
    ctx.fillStyle = grad;
    roundRectPath(ctx, 28, 28, W - 56, 10, 5);
    ctx.fill();

    // 标题（最多两行，超出省略）
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = text;
    ctx.font = `600 46px ${bodyFont}`;
    let titleLines = wrapLine(ctx, content.title || '', W - 160);
    if (titleLines.length > 2) {
      titleLines = titleLines.slice(0, 2);
      titleLines[1] = titleLines[1].replace(/\s*\S*$/, '') + '…';
    }
    titleLines.forEach((line, i) => ctx.fillText(line, 80, 130 + i * 58));

    // 摘录正文（最多 8 行，超出省略）
    const excerptTop = 150 + titleLines.length * 58;
    ctx.fillStyle = text;
    ctx.font = `28px ${bodyFont}`;
    const excerptLines = [];
    const maxLines = 8;
    (content.excerpt || '').split('\n').some(seg => {
      const wrapped = wrapLine(ctx, seg.trim(), W - 160);
      for (const line of wrapped) {
        if (excerptLines.length >= maxLines) return true;
        excerptLines.push(line);
      }
      return false;
    });
    if (content.excerpt && excerptLines.length >= maxLines &&
        content.excerpt.length > excerptLines.join('').length) {
      excerptLines[maxLines - 1] = excerptLines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    }
    const lineHeight = 44;
    excerptLines.forEach((line, i) => ctx.fillText(line, 80, excerptTop + 30 + i * lineHeight));

    // 引号装饰
    ctx.fillStyle = accent1;
    ctx.font = `600 120px Georgia, serif`;
    ctx.fillText('“', 52, excerptTop + 40);

    // 页脚：站点名 + 装饰点
    const repo = (window.MarkdownPreview.CONFIG && window.MarkdownPreview.CONFIG.repo) ||
      (window.MarkdownPreview.config && window.MarkdownPreview.config.repo) || 'Markdown Preview';
    ctx.fillStyle = muted;
    ctx.font = `22px ${bodyFont}`;
    ctx.fillText(repo, 80, H - 72);
    ctx.fillStyle = accent2;
    ctx.beginPath();
    ctx.arc(W - 100, H - 80, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent1;
    ctx.beginPath();
    ctx.arc(W - 124, H - 80, 10, 0, Math.PI * 2);
    ctx.fill();

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = (content.title || 'share').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40);
      a.href = url;
      a.download = slug + '-card.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  // ============== 初始化 ==============
  function init() {
    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('.doc-selection-toolbar')) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        const info = getSelectionInfo();
        if (info) showToolbar(info);
        else hideToolbar();
      }, 10);
    });
    // 点击空白 / 滚动 / Esc / 选区变化时收起
    document.addEventListener('mousedown', (e) => {
      if (toolbarEl && toolbarEl.classList.contains('open') && !toolbarEl.contains(e.target)) {
        // 延迟判断：先让选区落定，若点击后仍有合法选区（如再次划选）则由 mouseup 重新定位
        setTimeout(() => {
          if (!getSelectionInfo()) hideToolbar();
        }, 0);
      }
    });
    window.addEventListener('scroll', hideToolbar, true);
    window.addEventListener('resize', hideToolbar);
    document.addEventListener('selectionchange', () => {
      if (toolbarEl && toolbarEl.classList.contains('open')) {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          if (!getSelectionInfo()) hideToolbar();
        }, 30);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && toolbarEl && toolbarEl.classList.contains('open')) {
        hideToolbar();
      }
    }, true);
  }

  window.MarkdownPreview.selectionTools = {
    init,
    exportShareCard
  };
})();
