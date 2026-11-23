/**
 * Markdown 表格交互化（B1）
 *
 * 给正文里的普通 Markdown 表格加一层轻量工具条，不改变文档语法：
 *   - 点击表头排序（升序 → 降序 → 原始顺序），数值列按数值比较
 *   - 关键字过滤（匹配任意单元格，实时显示 匹配数 / 总数）
 *   - 列显示/隐藏（列多时折叠）
 *   - 复制为 TSV / 导出 CSV
 *   - 行数超过阈值时固定表头并在表格内部滚动（长表）
 *
 * 约定：
 *   - 只处理带 <thead> 且有表体的普通表格；CSV/JSON/协议等渲染器
 *     自己生成的可交互表格带 data-md-table-tools="off" 会被跳过。
 *   - 幂等：data-mdt-ready 标记；重复渲染不会叠加工具条。
 *   - 所有来自文档的文本都通过 textContent / escapeHtml 输出。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  // 共享图标构造（dom.js 提供）：工具条按钮一律用图标
  const icon = window.MarkdownPreview.icon || ((name, size) =>
    '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#' + name + '"/></svg>');

  const LONG_TABLE_ROWS = 14;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  function isSkipped(table) {
    if (table.closest('[data-md-table-tools="off"]')) return true;
    if (table.closest('.csv-table, .json-tree, .har-view, .trace-view, .nmap-view, .bgp-view, .dig-view, .registry-view, .diff-view, .no-table-tools')) return true;
    if (table.dataset.mdtReady) return true;
    return false;
  }

  function cellText(td) {
    return (td ? td.textContent : '').replace(/\s+/g, ' ').trim();
  }

  function numericValue(text) {
    const cleaned = text.replace(/[,\s]/g, '').replace(/^[\$€£¥]/, '');
    if (!cleaned) return null;
    // 纯数字（允许正负、小数、百分比、常见单位后缀）
    if (/^[+-]?\d+(\.\d+)?(%|[a-zA-Z]{1,4})?$/.test(cleaned)) {
      return parseFloat(cleaned);
    }
    return null;
  }

  function sortRows(tbody, colIndex, dir, originalOrder) {
    const rows = Array.from(tbody.querySelectorAll(':scope > tr'));
    const sorted = rows.slice();
    if (dir === 0) {
      sorted.sort((a, b) => originalOrder.get(a) - originalOrder.get(b));
    } else {
      sorted.sort((a, b) => {
        const av = cellText(a.children[colIndex]);
        const bv = cellText(b.children[colIndex]);
        const an = numericValue(av);
        const bn = numericValue(bv);
        let cmp;
        if (an != null && bn != null) cmp = an - bn;
        else cmp = collator.compare(av, bv);
        if (cmp === 0) cmp = (originalOrder.get(a) || 0) - (originalOrder.get(b) || 0);
        return dir === 1 ? cmp : -cmp;
      });
    }
    sorted.forEach(row => tbody.appendChild(row));
  }

  function toCSV(rows) {
    return rows.map(cells => cells.map(c => {
      const s = String(c == null ? '' : c);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function flashButton(btn, text) {
    if (!btn) return;
    const label = btn.querySelector('.mdt-btn-label') || btn;
    const prev = label.textContent;
    label.textContent = text;
    btn.classList.add('mdt-btn-done');
    clearTimeout(btn._mdtTimer);
    btn._mdtTimer = setTimeout(() => {
      label.textContent = prev;
      btn.classList.remove('mdt-btn-done');
    }, 1400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove();
      return ok;
    }
  }

  // 紧凑胶囊的筛选面板关闭逻辑用全局单例：WYSIWYG 每次重渲染都会新建
  // 表格，逐个绑 document 监听器会不断累积
  function bindCompactDismiss() {
    if (bindCompactDismiss.done) return;
    bindCompactDismiss.done = true;
    document.addEventListener('click', (e) => {
      document.querySelectorAll('.mdt-compact.open').forEach(t => {
        if (!t.contains(e.target)) t.classList.remove('open');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelectorAll('.mdt-compact.open').forEach(t => t.classList.remove('open'));
    });
    // 触屏：点空白处收起常显的胶囊
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) {
      document.addEventListener('click', (e) => {
        document.querySelectorAll('.mdt-compact.visible').forEach(t => {
          if (t.contains(e.target)) return;
          if (t._table && t._table.contains(e.target)) return;
          t.classList.remove('visible');
        });
      });
    }
  }

  function enhanceTable(table) {
    if (isSkipped(table)) return;
    const thead = table.tHead;
    const tbody = table.tBodies && table.tBodies[0];
    if (!thead || !tbody) return;
    const headerCells = Array.from(thead.rows[0] ? thead.rows[0].cells : []);
    if (!headerCells.length) return;

    const wrapper = table.closest('.table-wrapper') || table.parentElement;
    if (!wrapper) return;
    if (wrapper.closest('pre')) return;

    table.dataset.mdtReady = '1';
    wrapper.classList.add('mdt-wrapper');

    const originalOrder = new Map();
    Array.from(tbody.rows).forEach((row, i) => originalOrder.set(row, i));

    const allRows = () => Array.from(tbody.rows).filter(r => !r.classList.contains('mdt-empty-row'));
    const total = allRows().length;

    // ---------- 工具条 ----------
    // 全站统一紧凑形态：默认隐身，悬停表格时右上角浮出一枚图标胶囊。
    // 胶囊固定定位、挂在正文流之外，因此不会被表格横向滚动容器裁切。
    const insideEditor = !!table.closest('.editor-overlay');
    const compact = true;
    const tools = document.createElement('div');
    tools.className = 'mdt-tools' + (compact ? ' mdt-compact' : '');
    tools.setAttribute('role', 'toolbar');
    tools.setAttribute('aria-label', t('table.tools', '表格工具'));
    // 按钮一律用图标，文字靠悬停提示（data-tip），工具条只占一行高
    const copyLabel = t('table.copy', '复制');
    const csvLabel = t('table.exportCsv', '导出 CSV');
    const colLabel = t('table.columns', '列');
    const editLabel = t('table.edit', '编辑表格');
    const filterLabel = t('table.filter', '筛选表格');
    const colActions =
      '<div class="mdt-menu-actions">' +
        '<button type="button" class="mdt-linkbtn" data-act="cols-all">' + esc(t('table.showAll', '全部显示')) + '</button>' +
        '<button type="button" class="mdt-linkbtn" data-act="cols-none">' + esc(t('table.hideAll', '全部隐藏')) + '</button>' +
      '</div>';
    const searchBox =
      '<label class="mdt-search">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
        '<input type="search" class="mdt-search-input" placeholder="' + esc(t('table.filterPlaceholder', '筛选表格…')) + '" aria-label="' + esc(filterLabel) + '">' +
      '</label>';

    if (compact) {
      tools.innerHTML =
        '<button type="button" class="mdt-btn mdt-btn-filter" data-act="filter" data-tip="' + esc(filterLabel) + ' / ' + esc(colLabel) + '" title="' + esc(filterLabel) + ' / ' + esc(colLabel) + '" aria-label="' + esc(filterLabel) + '">' +
          icon('i-search', 15) + '</button>' +
        '<button type="button" class="mdt-btn" data-act="copy" data-tip="' + esc(copyLabel) + '" title="' + esc(copyLabel) + '" aria-label="' + esc(copyLabel) + '">' +
          icon('i-copy', 15) + '<span class="mdt-btn-label">' + esc(copyLabel) + '</span></button>' +
        '<button type="button" class="mdt-btn" data-act="csv" data-tip="' + esc(csvLabel) + '" title="' + esc(csvLabel) + '" aria-label="' + esc(csvLabel) + '">' +
          icon('i-download', 15) + '<span class="mdt-btn-label">CSV</span></button>' +
        (insideEditor
          ? '<button type="button" class="mdt-btn" data-act="edit" data-tip="' + esc(editLabel) + '" title="' + esc(editLabel) + '" aria-label="' + esc(editLabel) + '">' +
            icon('i-table', 15) + '</button>'
          : '') +
        '<div class="mdt-float-pop">' +
          '<span class="mdt-count" aria-live="polite"></span>' +
          searchBox +
          colActions +
          '<div class="mdt-col-list"></div>' +
        '</div>';
    } else {
      tools.innerHTML =
        '<span class="mdt-count" aria-live="polite"></span>' +
        searchBox +
        '<span class="mdt-spacer"></span>' +
        '<button type="button" class="mdt-btn" data-act="copy" data-tip="' + esc(copyLabel) + '" title="' + esc(copyLabel) + '" aria-label="' + esc(copyLabel) + '">' +
          icon('i-copy', 15) + '<span class="mdt-btn-label">' + esc(copyLabel) + '</span></button>' +
        '<button type="button" class="mdt-btn" data-act="csv" data-tip="' + esc(csvLabel) + '" title="' + esc(csvLabel) + '" aria-label="' + esc(csvLabel) + '">' +
          icon('i-download', 15) + '<span class="mdt-btn-label">CSV</span></button>' +
        '<details class="mdt-menu"><summary class="mdt-btn" data-tip="' + esc(colLabel) + '" title="' + esc(colLabel) + '" aria-label="' + esc(colLabel) + '">' +
          icon('i-list', 15) + '</summary>' +
          '<div class="mdt-menu-panel">' + colActions +
          '<div class="mdt-col-list"></div></div>' +
        '</details>';
    }

    const countEl = tools.querySelector('.mdt-count');
    const searchInput = tools.querySelector('.mdt-search-input');
    const colList = tools.querySelector('.mdt-col-list');

    if (compact) {
      const filterBtn = tools.querySelector('[data-act="filter"]');
      filterBtn.addEventListener('click', () => {
        const open = tools.classList.toggle('open');
        if (open) setTimeout(() => searchInput.focus(), 0);
      });
      const editBtn = tools.querySelector('[data-act="edit"]');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.preventDefault();
          table.dispatchEvent(new CustomEvent('mdt-edit-table', {
            bubbles: true,
            detail: { table }
          }));
        });
      }
      bindCompactDismiss();
    }

    function updateCount(visibleRows) {
      if (visibleRows == null) visibleRows = allRows().filter(r => !r.hidden).length;
      countEl.textContent = visibleRows === total
        ? t('table.rowCount', '{n} 行').replace('{n}', total)
        : t('table.filteredCount', '{m} / {n} 行').replace('{m}', visibleRows).replace('{n}', total);
    }
    updateCount(total);

    // ---------- 排序 ----------
    let sortCol = -1;
    let sortDir = 0;
    headerCells.forEach((th, idx) => {
      if (th.dataset.mdtSortable === '0') return;
      th.classList.add('mdt-sortable');
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'columnheader');
      th.setAttribute('aria-sort', 'none');
      const arrow = document.createElement('span');
      arrow.className = 'mdt-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      th.appendChild(arrow);

      const apply = () => {
        if (sortCol === idx) sortDir = (sortDir + 1) % 3;
        else { sortCol = idx; sortDir = 1; }
        headerCells.forEach((h, i) => {
          h.classList.toggle('mdt-sorted', i === sortCol && sortDir !== 0);
          h.classList.remove('mdt-desc');
          h.setAttribute('aria-sort', i === sortCol && sortDir !== 0 ? (sortDir === 1 ? 'ascending' : 'descending') : 'none');
          const a = h.querySelector('.mdt-arrow');
          if (a) a.textContent = (i === sortCol && sortDir !== 0) ? (sortDir === 1 ? '↑' : '↓') : '';
          if (h === th && sortDir === 2) h.classList.add('mdt-desc');
        });
        sortRows(tbody, idx, sortDir, originalOrder);
        filterRows();
      };
      th.addEventListener('click', (e) => {
        if (e.target.closest('a, button, input, select')) return;
        apply();
      });
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apply(); }
      });
    });

    // ---------- 过滤 ----------
    function filterRows() {
      const q = searchInput.value.trim().toLowerCase();
      let visible = 0;
      allRows().forEach(row => {
        const match = !q || Array.from(row.cells).some(td => {
          if (td.hidden) return false;
          return cellText(td).toLowerCase().includes(q);
        });
        row.hidden = !match;
        if (match) visible++;
      });
      let empty = tbody.querySelector('.mdt-empty-row');
      if (!visible && total) {
        if (!empty) {
          empty = document.createElement('tr');
          empty.className = 'mdt-empty-row';
          const td = document.createElement('td');
          td.colSpan = headerCells.length;
          td.className = 'mdt-empty';
          td.textContent = t('table.empty', '没有匹配的行');
          empty.appendChild(td);
          tbody.appendChild(empty);
        }
        empty.hidden = false;
      } else if (empty) {
        empty.hidden = true;
      }
      updateCount(visible);
    }
    searchInput.addEventListener('input', filterRows);

    // ---------- 列显示/隐藏 ----------
    headerCells.forEach((th, idx) => {
      const id = 'mdt-col-' + Math.random().toString(36).slice(2, 8);
      const label = document.createElement('label');
      label.className = 'mdt-col-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.col = String(idx);
      cb.id = id;
      const span = document.createElement('span');
      span.textContent = cellText(th) || ('#' + (idx + 1));
      label.appendChild(cb);
      label.appendChild(span);
      colList.appendChild(label);
      cb.addEventListener('change', () => {
        const hide = !cb.checked;
        th.hidden = hide;
        allRows().forEach(row => { if (row.cells[idx]) row.cells[idx].hidden = hide; });
        filterRows();
      });
    });
    tools.querySelector('[data-act="cols-all"]').addEventListener('click', () => {
      colList.querySelectorAll('input').forEach(cb => { if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); } });
    });
    tools.querySelector('[data-act="cols-none"]').addEventListener('click', () => {
      colList.querySelectorAll('input').forEach(cb => { if (cb.checked) { cb.checked = false; cb.dispatchEvent(new Event('change')); } });
    });

    // ---------- 复制 / 导出 ----------
    function tableMatrix() {
      const rows = [];
      const head = headerCells.filter(th => !th.hidden).map(cellText);
      rows.push(head);
      allRows().forEach(row => {
        if (row.hidden) return;
        rows.push(Array.from(row.cells).filter(td => !td.hidden).map(cellText));
      });
      return rows;
    }
    tools.querySelector('[data-act="copy"]').addEventListener('click', async (e) => {
      const ok = await copyText(tableMatrix().map(r => r.join('\t')).join('\n'));
      flashButton(e.currentTarget, ok ? t('table.copied', '已复制') : t('table.copyFail', '复制失败'));
    });
    tools.querySelector('[data-act="csv"]').addEventListener('click', (e) => {
      const name = (window.MarkdownPreview.state?.currentFilePath || 'table').replace(/\.(md|txt)$/i, '').split('/').pop() || 'table';
      download(name + '.csv', '\ufeff' + toCSV(tableMatrix()));
      flashButton(e.currentTarget, t('table.exported', '已导出'));
    });

    // 关闭列菜单：点击外部
    document.addEventListener('click', (e) => {
      const menu = tools.querySelector('.mdt-menu');
      if (menu && menu.open && !menu.contains(e.target)) menu.open = false;
    });

    // 长表：内部滚动 + 固定表头；胶囊是 fixed 定位，不会被滚动容器裁切
    if (total > LONG_TABLE_ROWS) {
      wrapper.classList.add('mdt-long');
      table.classList.add('mdt-long-table');
    }

    // 组件自带悬停浮窗时（.w-has-float）不再生成全局胶囊：
    // 两套控件会叠在表格右上角，筛选入口由组件浮窗提供
    if (compact && !table.closest('.w-has-float')) {
      // 胶囊挂在正文流之外（编辑器挂 overlay，文档站挂 body），fixed 定位：
      // 宽表的 overflow-x 容器不会裁切它，滚动时按表格矩形重新吸附。
      const layer = table.closest('.editor-overlay') || document.body;
      layer.appendChild(tools);
      tools._table = table;

      let hideTimer = null;
      tools._reposition = () => {
        if (!tools.classList.contains('visible')) return;
        const r = table.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) {
          tools.classList.remove('visible', 'open');
          return;
        }
        // 宽表放在可横向滚动的容器里时，锚定容器的「可见右缘」而不是表格
        // 自身的右缘：表格左右滚动时胶囊保持不动，不会跟着内容漂移。
        const host = wrapper && wrapper.getBoundingClientRect ? wrapper.getBoundingClientRect() : r;
        const scrollable = wrapper && wrapper.scrollWidth > wrapper.clientWidth + 1;
        const anchorRight = scrollable ? host.right : Math.min(r.right, host.right);
        const w = tools.offsetWidth;
        const h = tools.offsetHeight;
        let left = Math.min(window.innerWidth - w - 8, Math.max(8, anchorRight - w));
        let top = r.top - h - 6;
        // 表格贴近视口顶部时，胶囊落在表格内部右上角
        if (top < 8) top = r.top + 4;
        tools.style.left = Math.round(left) + 'px';
        tools.style.top = Math.round(top) + 'px';
      };

      const show = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        tools.classList.add('visible');
        tools._reposition();
      };
      const hideSoon = () => {
        if (tools.classList.contains('open') || tools.contains(document.activeElement)) return;
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          tools.classList.remove('visible');
          hideTimer = null;
        }, 220);
      };

      // 悬停表格（或胶囊本身）时出现；移开稍后隐藏，便于鼠标跨过间隙
      wrapper.addEventListener('mouseenter', show);
      wrapper.addEventListener('mouseleave', hideSoon);
      tools.addEventListener('mouseenter', show);
      tools.addEventListener('mouseleave', hideSoon);
      tools.addEventListener('mousedown', (e) => e.stopPropagation());
      tools.addEventListener('click', (e) => e.stopPropagation());

      // 触屏没有 hover：点表格时显式唤出胶囊
      const coarse = window.matchMedia && window.matchMedia('(hover: none)').matches;
      if (coarse) {
        wrapper.addEventListener('click', show);
      }

      // 滚动/缩放时重新吸附；全局单例，避免逐表累积监听器
      bindCompactPosition();
    } else {
      wrapper.parentNode.insertBefore(tools, wrapper);
    }
    tools._mdt = { updateCount, filterRows };
  }

  // 全局单例：滚动/缩放时让所有可见胶囊重新吸附表格
  function bindCompactPosition() {
    if (bindCompactPosition.done) return;
    bindCompactPosition.done = true;
    const repositionAll = () => {
      document.querySelectorAll('.mdt-compact.visible').forEach(t => t._reposition && t._reposition());
    };
    window.addEventListener('scroll', repositionAll, true);
    window.addEventListener('resize', repositionAll);
  }

  // 文档站/编辑器重渲染后清掉指向已销毁表格的残留胶囊
  function cleanupCompactTools() {
    document.querySelectorAll('.mdt-tools.mdt-compact').forEach(t => {
      if (!t._table || !t._table.isConnected) t.remove();
    });
  }

  function render(root) {
    cleanupCompactTools();
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('table').forEach(enhanceTable);
  }

  window.MarkdownPreview.renderers.tables = { render };
})();
