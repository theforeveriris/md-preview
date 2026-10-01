/**
 * 内容交互增强
 *  - 共享浮动菜单（图标库图标，主题变量适配）
 *  - 右键 LaTeX 公式 → 复制 LaTeX 源码（源码来自渲染时写入的 data-latex）
 *  - 表格第一行左侧悬浮手柄 → 下载主题化 PNG / 复制 Markdown 源码 / 复制 CSV
 *
 * 不使用 emoji，全部使用 index.html 内联 SVG 符号库（<use href="#i-xxx">）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  // i18n 文案读取：i18n 模块未加载或语言包缺 key 时回退到内置中文
  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  // ============== 剪贴板（带降级） ==============
  function copyText(text) {
    return new Promise((resolve, reject) => {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(resolve, () => {
          try { legacyCopy(text); resolve(); } catch (e) { reject(e); }
        });
      } else {
        try { legacyCopy(text); resolve(); } catch (e) { reject(e); }
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
    document.execCommand('copy');
    ta.remove();
  }

  function icon(name, size) {
    return `<svg width="${size || 15}" height="${size || 15}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // ============== 共享浮动菜单 ==============
  let menuEl = null;
  let menuOpen = false;

  function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement('div');
    menuEl.className = 'ctx-menu';
    menuEl.setAttribute('role', 'menu');
    document.body.appendChild(menuEl);
    return menuEl;
  }

  /**
   * 在视口坐标 (x, y) 处显示浮动菜单
   * @param {Array<{icon: string, label: string, action: Function}>} items
   */
  function showMenu(items, x, y) {
    const el = ensureMenu();
    el.innerHTML = '';
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'ctx-menu-item';
      btn.type = 'button';
      btn.setAttribute('role', 'menuitem');
      btn.innerHTML = `${icon(item.icon)}<span class="ctx-menu-label">${item.label}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action(btn);
      });
      el.appendChild(btn);
    });

    menuOpen = true;
    // 先挂载拿到尺寸，再按视口边界修正位置
    el.style.left = '0px';
    el.style.top = '0px';
    el.classList.add('open');
    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 8;
    const maxY = window.innerHeight - rect.height - 8;
    el.style.left = Math.max(8, Math.min(x, maxX)) + 'px';
    el.style.top = Math.max(8, Math.min(y, maxY)) + 'px';
  }

  function hideMenu() {
    menuOpen = false;
    if (menuEl) menuEl.classList.remove('open');
  }

  // 点击菜单项后的「已复制」反馈：换图标文案，短暂停留后关闭
  function copiedFeedback(btn, originalHtml) {
    btn.innerHTML = `${icon('i-check')}<span class="ctx-menu-label">${t('ctx.copied', '已复制')}</span>`;
    btn.classList.add('copied');
    setTimeout(() => {
      hideMenu();
      setTimeout(() => { btn.innerHTML = originalHtml; btn.classList.remove('copied'); }, 200);
    }, 700);
  }

  function bindMenuDismiss() {
    document.addEventListener('click', (e) => {
      if (menuOpen && menuEl && !menuEl.contains(e.target)) hideMenu();
    });
    document.addEventListener('contextmenu', (e) => {
      if (menuOpen && menuEl && !menuEl.contains(e.target)) hideMenu();
    });
    // 菜单是 fixed 定位，滚动后锚点失准，直接关闭
    window.addEventListener('scroll', hideMenu, true);
    window.addEventListener('resize', hideMenu);
  }

  // ============== 右键复制 LaTeX ==============
  function initLatexContextMenu() {
    document.addEventListener('contextmenu', (e) => {
      const target = e.target.closest('[data-latex]');
      if (!target) return;
      e.preventDefault();
      const latex = target.getAttribute('data-latex') || '';
      if (!latex) return;
      const isBlock = target.classList.contains('katex-block');
      showMenu([{
        icon: 'i-copy',
        label: t('ctx.copyLatex', '复制 LaTeX 公式'),
        action: (btn) => {
          const originalHtml = btn.innerHTML;
          copyText(latex).then(
            () => copiedFeedback(btn, originalHtml),
            () => hideMenu()
          );
        }
      }], e.clientX + 2, e.clientY + 2);
    });
  }

  // ============== 表格手柄 ==============
  // 手柄挂在 body 上用 fixed 定位：wrapper 有 overflow-x:auto，
  // 放在其内部无法悬到表格左上角外侧（会被裁切或撑出滚动）。
  const HANDLE_ID = 'tableHoverHandle';
  let hideTimer = null;

  function ensureHandle() {
    let handle = document.getElementById(HANDLE_ID);
    if (!handle) {
      handle = document.createElement('button');
      handle.id = HANDLE_ID;
      handle.className = 'table-handle';
      handle.type = 'button';
      handle.title = t('ctx.tableOps', '表格操作');
      handle.innerHTML = icon('i-table', 14);
      handle.addEventListener('click', (e) => {
        e.stopPropagation();
        const table = handle._table;
        if (!table) return;
        const rect = handle.getBoundingClientRect();
        showTableMenu(table, rect.right + 6, rect.top);
      });
    }
    return handle;
  }

  // 手柄贴在表格第一行左侧外侧：垂直对齐首行中线，水平悬于表格左缘外 6px；
  // 表格贴近视口左缘时收敛到 8px，此时会短暂覆盖首行，可接受
  function positionHandle(table) {
    const handle = document.getElementById(HANDLE_ID);
    if (!handle || !handle.classList.contains('visible')) return;
    const rect = table.getBoundingClientRect();
    const firstRow = table.rows[0];
    const rowRect = firstRow ? firstRow.getBoundingClientRect() : rect;
    const rowCenter = rowRect.top + rowRect.height / 2;
    handle.style.left = Math.max(8, rect.left - 32) + 'px'; // 26px 手柄 + 6px 间距
    handle.style.top = Math.round(rowCenter - 13) + 'px';   // 26px 手柄垂直居中于首行
  }

  function showHandle(table) {
    clearTimeout(hideTimer);
    const handle = ensureHandle();
    handle._table = table;
    if (handle.parentElement !== document.body) document.body.appendChild(handle);
    handle.classList.add('visible');
    positionHandle(table);
  }

  function scheduleHideHandle() {
    clearTimeout(hideTimer);
    // 延迟收回：手柄在表格外侧，指针从表格移过来需要跨过间隙
    hideTimer = setTimeout(() => {
      const handle = document.getElementById(HANDLE_ID);
      if (handle) handle.classList.remove('visible');
    }, 600);
  }

  function repositionVisibleHandle() {
    const handle = document.getElementById(HANDLE_ID);
    if (handle && handle.classList.contains('visible') && handle._table) {
      positionHandle(handle._table);
    }
  }

  function initTableHandle() {
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest('.ctx-menu')) return;
      const table = e.target.closest('.markdown-body table, .table-wrapper table');
      if (table) {
        showHandle(table);
      } else if (e.target.closest('.table-handle')) {
        // 指针已到手柄上：取消已排定的收回，否则手柄会在点击前消失
        clearTimeout(hideTimer);
      } else {
        scheduleHideHandle();
      }
    });
    // fixed 手柄不随文档滚动：滚动/缩放时贴回表格当前位置
    //（capture 捕获 wrapper 内部的横向滚动）
    window.addEventListener('scroll', repositionVisibleHandle, true);
    window.addEventListener('resize', repositionVisibleHandle);
  }

  // ============== 表格菜单 ==============
  function showTableMenu(table, x, y) {
    showMenu([
      {
        icon: 'i-download',
        label: t('ctx.downloadImage', '下载图片'),
        action: () => { hideMenu(); exportTablePng(table); }
      },
      {
        icon: 'i-copy',
        label: t('ctx.copyMd', '复制 Markdown 源码'),
        action: (btn) => {
          const originalHtml = btn.innerHTML;
          copyText(tableToMarkdown(table)).then(
            () => copiedFeedback(btn, originalHtml),
            () => hideMenu()
          );
        }
      },
      {
        icon: 'i-clipboard',
        label: t('ctx.copyCsv', '复制 CSV'),
        action: (btn) => {
          const originalHtml = btn.innerHTML;
          copyText(tableToCsv(table)).then(
            () => copiedFeedback(btn, originalHtml),
            () => hideMenu()
          );
        }
      }
    ], x, y);
  }

  // ============== 表格序列化 ==============
  function cellText(cell) {
    // innerText 保留 <br> 换行；管道符转义，换行转 <br>（Markdown 单元格内换行写法）
    return (cell.innerText || cell.textContent || '')
      .replace(/\u00a0/g, ' ')
      .trim()
      .split('\n').map(line => line.trim())
      .filter((line, i, arr) => line !== '' || (i > 0 && i < arr.length - 1))
      .join('<br>')
      .replace(/\|/g, '\\|');
  }

  function tableAlignments(table) {
    const headCells = table.rows[0] ? Array.from(table.rows[0].cells) : [];
    return headCells.map(cell => {
      const align = (getComputedStyle(cell).textAlign || 'left').toLowerCase();
      if (align === 'center') return ':---:';
      if (align === 'right') return '---:';
      return ':---';
    });
  }

  function tableToMarkdown(table) {
    const alignments = tableAlignments(table);
    const rows = Array.from(table.rows).map(row =>
      Array.from(row.cells).map(cellText)
    );
    if (rows.length === 0) return '';
    const lines = [];
    lines.push('| ' + rows[0].join(' | ') + ' |');
    lines.push('| ' + alignments.join(' | ') + ' |');
    for (let i = 1; i < rows.length; i++) {
      lines.push('| ' + rows[i].join(' | ') + ' |');
    }
    return lines.join('\n');
  }

  function csvField(text) {
    if (/[",\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function tableToCsv(table) {
    const rows = Array.from(table.rows).map(row =>
      Array.from(row.cells).map(cell => {
        const text = (cell.innerText || cell.textContent || '').replace(/\u00a0/g, ' ').trim();
        return csvField(text);
      }).join(',')
    );
    return rows.join('\r\n');
  }

  // ============== 表格 → PNG（Canvas，跟随当前主题） ==============
  function effectiveBg(el) {
    // 单元格背景可能透明（条纹/表头才有色），向上找到第一个非透明背景
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(bg) && bg !== 'transparent') return bg;
      node = node.parentElement;
    }
    return '#ffffff';
  }

  function setRectFont(ctx, cell) {
    const cs = getComputedStyle(cell);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = 'alphabetic';
    return cs;
  }

  // 文本按像素宽度硬换行：按词切分（CJK 逐字），超宽的词再按字符拆
  function wrapLine(ctx, text, maxWidth) {
    if (!text) return [''];
    const tokens = text.split(/(\s+)/).filter(t => t !== '');
    const lines = [];
    let current = '';
    const push = () => { lines.push(current); current = ''; };
    for (let token of tokens) {
      if (ctx.measureText(token).width > maxWidth && token.length > 1) {
        // 单个词超宽（如长 CJK 串）：按字符拆
        for (const ch of token) {
          if (ctx.measureText(current + ch).width > maxWidth && current) push();
          current += ch;
        }
        continue;
      }
      if (ctx.measureText(current + token).width > maxWidth && current) {
        push();
        if (/^\s+$/.test(token)) continue; // 行首不保留空白
      }
      current += token;
    }
    if (current) lines.push(current);
    return lines;
  }

  async function exportTablePng(table) {
    // 等字体就绪，保证 Canvas 里的字体与页面一致
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const tableRect = table.getBoundingClientRect();
    const scale = 2;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = Math.ceil(tableRect.width * scale);
    canvas.height = Math.ceil(tableRect.height * scale);
    ctx.scale(scale, scale);

    // 页面底色（跟随主题），再逐格绘制
    ctx.fillStyle = effectiveBg(document.body);
    ctx.fillRect(0, 0, tableRect.width, tableRect.height);

    const tableCs = getComputedStyle(table);
    ctx.fillStyle = effectiveBg(table.parentElement);
    if (tableCs.backgroundColor && tableCs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      ctx.fillStyle = tableCs.backgroundColor;
    }
    ctx.fillRect(0, 0, tableRect.width, tableRect.height);

    Array.from(table.rows).forEach(row => {
      Array.from(row.cells).forEach(cell => {
        const r = cell.getBoundingClientRect();
        const x = r.left - tableRect.left;
        const y = r.top - tableRect.top;
        const w = r.width;
        const h = r.height;

        // 背景
        const cellBg = getComputedStyle(cell).backgroundColor;
        ctx.fillStyle = (cellBg && cellBg !== 'rgba(0, 0, 0, 0)') ? cellBg : effectiveBg(cell.parentElement);
        ctx.fillRect(x, y, w, h);

        // 边框（border-collapse 下相邻边重复绘制同色线，无视觉差异）
        const cs = getComputedStyle(cell);
        [['Top', y, x, y, x + w], ['Right', x + w, y, x + w, y + h],
         ['Bottom', y + h, x, y + h, x + w], ['Left', x, y, x, y + h]].forEach(([side, c1x, c1y, c2x, c2y]) => {
          const bw = parseFloat(cs['border' + side + 'Width']) || 0;
          if (bw <= 0 || cs['border' + side + 'Style'] === 'none') return;
          ctx.strokeStyle = cs['border' + side + 'Color'];
          ctx.lineWidth = bw;
          ctx.beginPath();
          ctx.moveTo(c1x, c1y);
          ctx.lineTo(c2x, c2y);
          ctx.stroke();
        });

        // 文本（支持 <br> 换行 + 自动折行）
        const text = (cell.innerText || '').replace(/\u00a0/g, ' ');
        if (!text.trim()) return;
        const textCs = setRectFont(ctx, cell);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        const padT = parseFloat(cs.paddingTop) || 0;
        const padB = parseFloat(cs.paddingBottom) || 0;
        const innerW = w - padL - padR;
        const lineHeight = (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4);
        const lines = [];
        text.split('\n').forEach(seg => lines.push(...wrapLine(ctx, seg.trim(), innerW)));

        const blockH = lines.length * lineHeight;
        const valign = cs.verticalAlign;
        let textTop;
        if (valign === 'top') textTop = y + padT;
        else if (valign === 'bottom') textTop = y + h - padB - blockH;
        else textTop = y + (h - blockH) / 2; // middle（单元格默认）

        ctx.textAlign = 'left';
        lines.forEach((line, i) => {
          const lineW = ctx.measureText(line).width;
          let textX = x + padL;
          if (textCs.textAlign === 'center') textX = x + (w - lineW) / 2;
          else if (textCs.textAlign === 'right') textX = x + w - padR - lineW;
          const baseline = textTop + lineHeight * i + (lineHeight - parseFloat(textCs.fontSize)) / 2 + parseFloat(textCs.fontSize) * 0.8;
          ctx.fillText(line, textX, Math.min(baseline, y + h - padB));
        });
      });
    });

    // 下载
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const docTitle = (window.MarkdownPreview.state && window.MarkdownPreview.state.currentFrontmatter && window.MarkdownPreview.state.currentFrontmatter.title) || 'table';
      a.href = url;
      a.download = docTitle.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40) + '-table.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  // ============== 初始化 ==============
  function init() {
    bindMenuDismiss();
    initLatexContextMenu();
    initTableHandle();
  }

  window.MarkdownPreview.interactions = {
    init,
    hideMenu,
    isMenuOpen: () => menuOpen
  };
})();
