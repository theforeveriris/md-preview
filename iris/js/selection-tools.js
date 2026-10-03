/**
 * 选中文字浮动工具栏 + 主题化分享卡片（多模板）
 *
 * 划选正文文字后浮出小工具条：复制 / 站内搜索 / 生成分享卡片。
 * 分享卡片提供四种模板（点击「分享卡片」后弹出模板菜单）：
 *   - 引言横版：1200×630，标题 + 摘录引言排版（经典样式）
 *   - 引言竖版：1200×1600（3:4），适合朋友圈 / 小红书等竖版场景
 *   - 代码卡片：1200×630，编辑器窗口风格深色底 + 等宽排版
 *   - 表格卡片：1200×630，选区落在表格内时可用，按当前主题重绘表格
 *
 * 全部 Canvas 手绘（不依赖 html2canvas），配色取当前主题 CSS 变量，
 * 深浅主题自动适配；代码卡片固定深色编辑器风格。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  let toolbarEl = null;
  let menuEl = null;
  let hideTimer = null;
  const MIN_SELECTION_LEN = 2;
  const CARD_MAX_CHARS = 600;
  const CARD_MAX_CHARS_VERTICAL = 1200;

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
    hideCardMenu();
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
    return {
      text: text.slice(0, CARD_MAX_CHARS),
      rawText: sel.toString(),
      rect,
      tableEl: el.closest('.markdown-body table') || null
    };
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
      showCardMenu(info);
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

  // ============== 分享卡片模板菜单 ==============
  function showCardMenu(info) {
    hideCardMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'card-template-menu';
    const hasTable = !!(info.tableEl && info.tableEl.rows && info.tableEl.rows.length > 0);
    menuEl.innerHTML = `
      <div class="card-template-title">${esc(t('sel.cardPick', '选择卡片模板'))}</div>
      <button type="button" data-template="quote">${icon('i-quote')}${esc(t('sel.cardQuote', '引言 · 横版 1200×630'))}</button>
      <button type="button" data-template="quote-v">${icon('i-list')}${esc(t('sel.cardQuoteV', '引言 · 竖版 3:4'))}</button>
      <button type="button" data-template="code">${icon('i-copy')}${esc(t('sel.cardCode', '代码卡片'))}</button>
      <button type="button" data-template="table" ${hasTable ? '' : 'disabled'} title="${hasTable ? '' : esc(t('sel.cardTableHint', '选区需落在表格内'))}">${icon('i-table')}${esc(t('sel.cardTable', '表格卡片'))}</button>
    `;
    menuEl.addEventListener('mousedown', (e) => e.preventDefault());
    menuEl.querySelectorAll('button[data-template]').forEach(btn => {
      btn.addEventListener('click', () => {
        const template = btn.dataset.template;
        hideCardMenu();
        hideToolbar();
        exportShareCard(
          { title: docTitle(), excerpt: info.text },
          { template, rawText: info.rawText, tableEl: info.tableEl, vertical: template === 'quote-v' }
        );
      });
    });
    document.body.appendChild(menuEl);
    menuEl.classList.add('open');
    // 定位在选区上方（复用工具条的视口规避逻辑）
    const r = menuEl.getBoundingClientRect();
    const x = Math.max(8, Math.min(info.rect.left, window.innerWidth - r.width - 8));
    const y = info.rect.top - r.height - 8;
    menuEl.style.left = x + 'px';
    menuEl.style.top = (y < 8 ? info.rect.bottom + 8 : y) + 'px';
  }

  function hideCardMenu() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
  }

  // ============== 主题化分享卡片（Canvas 多模板） ==============
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

  function truncateTail(lines, fullText) {
    if (lines.length && fullText && fullText.length > lines.join('').length) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '') + '…';
    }
    return lines;
  }

  function drawCardFrame(ctx, W, H, opts) {
    const bg = cssVar('--color-bg', '#fafafa');
    const surface = cssVar('--color-surface', '#ffffff');
    const border = cssVar('--color-border', '#f0f0f0');
    const accent1 = cssVar('--color-accent-purple', '#d4a5c9');
    const accent2 = cssVar('--color-accent-pink', '#f2c4ce');

    ctx.fillStyle = opts.dark ? '#1e1e28' : bg;
    ctx.fillRect(0, 0, W, H);
    roundRectPath(ctx, 28, 28, W - 56, H - 56, 20);
    ctx.fillStyle = opts.dark ? '#252533' : surface;
    ctx.fill();
    ctx.strokeStyle = opts.dark ? '#3a3a4c' : border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 顶部强调色渐变条
    const grad = ctx.createLinearGradient(28, 0, W - 28, 0);
    grad.addColorStop(0, accent1);
    grad.addColorStop(1, accent2);
    ctx.fillStyle = grad;
    roundRectPath(ctx, 28, 28, W - 56, 10, 5);
    ctx.fill();
  }

  function drawFooter(ctx, W, H, dark) {
    const muted = dark ? 'rgba(235,235,245,.55)' : cssVar('--color-text-muted', '#999999');
    const accent1 = cssVar('--color-accent-purple', '#d4a5c9');
    const accent2 = cssVar('--color-accent-pink', '#f2c4ce');
    const bodyFont = cardFont(false);
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
  }

  function cardFont(isTitle) {
    const bodyFont = getComputedStyle(document.querySelector('.markdown-body') || document.body).fontFamily || 'sans-serif';
    return bodyFont;
  }

  // 引言模板（横版 1200×630 / 竖版 1200×1600 共用一套排版）
  function drawQuoteCard(ctx, W, H, content) {
    const text = cssVar('--color-text', '#2d2d2d');
    const accent1 = cssVar('--color-accent-purple', '#d4a5c9');
    const vertical = H > W;
    const bodyFont = cardFont(true);
    const titleSize = vertical ? 56 : 46;
    const excerptSize = vertical ? 32 : 28;
    const lineHeight = vertical ? 50 : 44;
    const maxTitleLines = vertical ? 3 : 2;
    const maxExcerptLines = vertical ? 22 : 8;

    drawCardFrame(ctx, W, H, {});

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = text;
    ctx.font = `600 ${titleSize}px ${bodyFont}`;
    let titleLines = wrapLine(ctx, content.title || '', W - 160);
    if (titleLines.length > maxTitleLines) {
      titleLines = titleLines.slice(0, maxTitleLines);
      titleLines[titleLines.length - 1] = titleLines[titleLines.length - 1].replace(/\s*\S*$/, '') + '…';
    }
    titleLines.forEach((line, i) => ctx.fillText(line, 80, 130 + i * (titleSize + 12)));

    const excerptTop = 150 + titleLines.length * (titleSize + 12);
    ctx.fillStyle = text;
    ctx.font = `${excerptSize}px ${bodyFont}`;
    const excerptLines = [];
    (content.excerpt || '').split('\n').some(seg => {
      const wrapped = wrapLine(ctx, seg.trim(), W - 160);
      for (const line of wrapped) {
        if (excerptLines.length >= maxExcerptLines) return true;
        excerptLines.push(line);
      }
      return false;
    });
    truncateTail(excerptLines, content.excerpt || '');
    excerptLines.forEach((line, i) => ctx.fillText(line, 80, excerptTop + 30 + i * lineHeight));

    // 引号装饰
    ctx.fillStyle = accent1;
    ctx.font = `600 ${vertical ? 150 : 120}px Georgia, serif`;
    ctx.fillText('“', 52, excerptTop + 40);

    drawFooter(ctx, W, H, false);
  }

  // 代码卡片：固定深色编辑器窗口风格
  function drawCodeCard(ctx, W, H, content, rawText) {
    drawCardFrame(ctx, W, H, { dark: true });

    const mono = `ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace`;
    // 窗口标题栏（红黄绿三点 + 文档标题）
    ctx.fillStyle = '#14141d';
    roundRectPath(ctx, 28, 38, W - 56, 54, 14);
    ctx.fill();
    const dots = ['#ff5f56', '#ffbd2e', '#27c93f'];
    dots.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(66 + i * 30, 65, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(235,235,245,.75)';
    ctx.font = `20px ${mono}`;
    ctx.fillText((content.title || 'code').slice(0, 70), 170, 72);

    // 代码正文
    ctx.fillStyle = '#e8e8f0';
    ctx.font = `22px ${mono}`;
    const maxLines = 13;
    const lines = [];
    String(rawText || content.excerpt || '').replace(/\t/g, '  ').split('\n').some(raw => {
      const wrapped = wrapLine(ctx, raw.replace(/\s+$/, ''), W - 190);
      for (const line of wrapped) {
        if (lines.length >= maxLines) return true;
        lines.push(line);
      }
      return false;
    });
    truncateTail(lines, rawText || '');
    lines.forEach((line, i) => ctx.fillText(line, 80, 148 + i * 32));

    // 行号淡色装饰
    ctx.fillStyle = 'rgba(235,235,245,.28)';
    for (let i = 0; i < lines.length; i++) ctx.fillText(String(i + 1), 56, 148 + i * 32);

    drawFooter(ctx, W, H, true);
  }

  // 表格卡片：把选区所在表格按当前主题重绘
  function drawTableCard(ctx, W, H, content, tableEl) {
    drawCardFrame(ctx, W, H, {});
    const text = cssVar('--color-text', '#2d2d2d');
    const muted = cssVar('--color-text-muted', '#999999');
    const accent1 = cssVar('--color-accent-purple', '#d4a5c9');
    const bodyFont = cardFont(false);

    const rows = [...tableEl.rows].map(tr => [...tr.cells].map(td => td.textContent.replace(/\s+/g, ' ').trim()));
    if (rows.length === 0) return;
    const colCount = Math.max(...rows.map(r => r.length));
    const usable = W - 160;
    const fontSize = 24;
    ctx.font = `${fontSize}px ${bodyFont}`;

    // 列宽按内容测量，超宽按比例收缩
    const colW = [];
    for (let c = 0; c < colCount; c++) {
      let w = 0;
      for (const r of rows) {
        if (r[c] == null) continue;
        w = Math.max(w, ctx.measureText(r[c]).width);
      }
      colW.push(Math.min(Math.max(w + 32, 90), 420));
    }
    const rawTotal = colW.reduce((a, b) => a + b, 0);
    const scale = Math.min(1, usable / rawTotal);
    const widths = colW.map(w => w * scale);

    const rowH = 44;
    const headerTop = 160;
    const maxRows = Math.min(rows.length, Math.floor((H - headerTop - 120) / rowH));

    const drawRow = (cells, y, isHeader) => {
      if (isHeader) {
        ctx.fillStyle = accent1;
        ctx.fillRect(80, y, usable, rowH);
      } else if ((rows.indexOf(cells) % 2) === 0) {
        ctx.fillStyle = 'rgba(128,128,128,.08)';
        ctx.fillRect(80, y, usable, rowH);
      }
      let x = 80;
      ctx.fillStyle = isHeader ? '#ffffff' : text;
      ctx.font = `${isHeader ? '600 ' : ''}${fontSize}px ${bodyFont}`;
      cells.forEach((cell, c) => {
        if (c >= colCount) return;
        const avail = widths[c] - 20;
        const lines = wrapLine(ctx, cell, avail);
        ctx.fillText(lines[0].slice(0, 40) + (lines[0].length > 40 ? '…' : ''), x + 10, y + rowH / 2 + 8);
        x += widths[c];
        if (c < colCount - 1) {
          ctx.strokeStyle = 'rgba(128,128,128,.25)';
          ctx.beginPath();
          ctx.moveTo(x, y + 4);
          ctx.lineTo(x, y + rowH - 4);
          ctx.stroke();
        }
      });
      ctx.strokeStyle = 'rgba(128,128,128,.25)';
      ctx.beginPath();
      ctx.moveTo(80, y + rowH);
      ctx.lineTo(80 + usable, y + rowH);
      ctx.stroke();
    };

    rows.slice(0, maxRows).forEach((cells, i) => drawRow(cells, headerTop + i * rowH, i === 0));
    if (rows.length > maxRows) {
      ctx.fillStyle = muted;
      ctx.font = `20px ${bodyFont}`;
      ctx.fillText(t('sel.cardTableMore', '… 其余 {n} 行未展示').replace('{n}', rows.length - maxRows), 80, headerTop + maxRows * rowH + 34);
    }

    drawFooter(ctx, W, H, false);
  }

  /**
   * 生成并下载分享卡片 PNG
   * @param {{title:string, excerpt:string}} content
   * @param {{template?:'quote'|'quote-v'|'code'|'table', rawText?:string, tableEl?:HTMLTableElement, vertical?:boolean}} [opts]
   */
  async function exportShareCard(content, opts) {
    opts = opts || {};
    const template = opts.template || (opts.vertical ? 'quote-v' : 'quote');
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const dims = {
      'quote': [1200, 630],
      'quote-v': [1200, 1600],
      'code': [1200, 630],
      'table': [1200, 630]
    }[template] || [1200, 630];
    const W = dims[0], H = dims[1];
    const scale = 2;

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.textBaseline = 'alphabetic';

    if (template === 'code') drawCodeCard(ctx, W, H, content, opts.rawText);
    else if (template === 'table' && opts.tableEl) drawTableCard(ctx, W, H, content, opts.tableEl);
    else drawQuoteCard(ctx, W, H, content);

    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = (content.title || 'share').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40);
      a.href = url;
      a.download = `${slug}-${template}-card.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  // ============== 初始化 ==============
  function init() {
    document.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('.doc-selection-toolbar')) return;
      if (e.target.closest && e.target.closest('.card-template-menu')) return;
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
      if (e.key === 'Escape' && ((toolbarEl && toolbarEl.classList.contains('open')) || menuEl)) {
        hideToolbar();
      }
    }, true);
  }

  window.MarkdownPreview.selectionTools = {
    init,
    exportShareCard
  };
})();
