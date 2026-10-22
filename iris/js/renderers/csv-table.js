/**
 * CSV / TSV 交互表格渲染器
 *
 * Markdown 语法：
 *   ```csv          （或 ```tsv，按制表符分列）
 *   name,age,city
 *   Alice,30,Beijing
 *   ```
 *
 * 渲染为可排序、可搜索、可按列筛选的交互表格：
 *   - 表头点击排序（升 → 降 → 恢复原始顺序），数值列按数值比较
 *   - 工具栏搜索框即时过滤行（不区分大小写，匹配任意单元格）
 *   - 每列表头漏斗按钮弹出勾选面板，按该列的唯一值筛选
 *   - 复制 CSV / 下载 CSV（保留原始文本）
 *   - 行数徽章随筛选实时更新
 *
 * 由 markdown.js 渲染管线在文档渲染后调用 render()（与 apexcharts 等同链）。
 * 仅处理文档正文（.markdown-body）内的 ```csv / ```tsv 代码块。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // i18n 文案统一走 i18n.js 的权威实现（MarkdownPreview.t，全站唯一，避免多处包装漂移）
  const t = window.MarkdownPreview.t;

  // HTML 转义统一走 md-render.js 的权威实现（全站唯一，避免多处副本漂移）。
  // md-render.js 先于渲染器脚本加载，此处 IIFE 执行时必然可用。
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function icon(name, size) {
    return `<svg width="${size || 14}" height="${size || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // ============== 解析（RFC 4180 引号规则；tsv 按制表符） ==============
  function parseDelimited(text, delim) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(field); field = '';
      } else if (ch === '\n') {
        row.push(field); field = '';
        rows.push(row); row = [];
      } else if (ch === '\r') {
        // 跳过（\r\n 与孤立 \r 均视为换行的一部分）
      } else {
        field += ch;
      }
    }
    // 末行（无换行结尾）
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    // 去掉完全为空的行
    return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
  }

  function parseCsv(text) { return parseDelimited(text, ','); }
  function parseTsv(text) { return parseDelimited(text, '\t'); }

  // ============== 数值判定与比较 ==============
  function toNumber(v) {
    if (v == null || String(v).trim() === '') return null;
    const n = Number(String(v).trim().replace(/[,%\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function compareValues(a, b) {
    const na = toNumber(a), nb = toNumber(b);
    if (na !== null && nb !== null) return na - nb;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  // ============== 表格构建 ==============
  function buildWidget(pre, rows, isTsv) {
    const header = rows[0].map(c => String(c).trim());
    const colCount = Math.max(header.length, ...rows.slice(1).map(r => r.length));
    for (let i = 0; i < colCount; i++) if (header[i] == null) header[i] = t('csv.untitled', '列') + (i + 1);
    const dataRows = rows.slice(1).map(r => {
      const out = r.slice(0, colCount).map(c => String(c == null ? '' : c));
      while (out.length < colCount) out.push('');
      return out;
    });

    const rawText = pre.querySelector('code')?.textContent ?? '';
    const state = { q: '', sortCol: -1, sortDir: 1, filters: {} };

    const widget = document.createElement('div');
    widget.className = 'csv-table';
    widget.innerHTML = `
      <div class="csv-table-toolbar">
        <div class="csv-table-search">
          ${icon('i-search', 13)}
          <input type="search" class="csv-search-input" placeholder="${esc(t('csv.searchPlaceholder', '搜索表格…'))}" aria-label="${esc(t('csv.searchPlaceholder', '搜索表格…'))}">
        </div>
        <span class="csv-table-count" role="status"></span>
        <span class="csv-table-toolbar-space"></span>
        <span class="csv-chart-ctrl">
          <select class="csv-chart-type theme-select" aria-label="${esc(t('csv.chartType', '图表类型'))}">
            <option value="line">${esc(t('csv.chart.line', '折线'))}</option>
            <option value="bar">${esc(t('csv.chart.bar', '柱状'))}</option>
            <option value="area">${esc(t('csv.chart.area', '面积'))}</option>
            <option value="pie">${esc(t('csv.chart.pie', '饼图'))}</option>
          </select>
          <button type="button" class="csv-tool-btn csv-chart-btn" title="${esc(t('csv.chart.build', '画成图'))}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 15l3-4 3 3 4-6"/></svg><span>${esc(t('csv.chart.build', '画成图'))}</span></button>
        </span>
        <button type="button" class="csv-tool-btn csv-copy" title="${esc(t('csv.copyCsv', '复制 CSV'))}">${icon('i-clipboard')}<span>${esc(t('csv.copyCsv', '复制 CSV'))}</span></button>
        <button type="button" class="csv-tool-btn csv-download" title="${esc(t('csv.downloadCsv', '下载 CSV'))}">${icon('i-download')}<span>${esc(t('csv.downloadCsv', '下载 CSV'))}</span></button>
      </div>
      <div class="csv-table-scroll"><table></table></div>
    `;

    const table = widget.querySelector('table');

    // 表头
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    header.forEach((name, col) => {
      const th = document.createElement('th');
      th.innerHTML = `
        <button type="button" class="csv-sort-btn" aria-label="${esc(t('csv.sort', '排序'))}"><span class="csv-col-name">${esc(name)}</span><span class="csv-sort-arrow" aria-hidden="true"></span></button>
        <button type="button" class="csv-filter-btn" aria-label="${esc(t('csv.filter', '按列筛选'))}" data-col="${col}">${icon('i-filter', 12)}</button>
      `;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    // ============== 过滤 + 搜索 + 排序 ==============
    function visibleRows() {
      let rowsOut = dataRows;
      const q = state.q.trim().toLowerCase();
      if (q) {
        rowsOut = rowsOut.filter(r => r.some(cell => cell.toLowerCase().includes(q)));
      }
      Object.keys(state.filters).forEach(col => {
        const allowed = state.filters[col];
        if (!allowed) return;
        rowsOut = rowsOut.filter(r => allowed.has(r[col]));
      });
      if (state.sortCol >= 0) {
        const col = state.sortCol;
        rowsOut = rowsOut.slice().sort((a, b) => state.sortDir * compareValues(a[col], b[col]));
      }
      return rowsOut;
    }

    function renderBody() {
      const rowsOut = visibleRows();
      tbody.innerHTML = '';
      const frag = document.createDocumentFragment();
      rowsOut.forEach(r => {
        const tr = document.createElement('tr');
        r.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);

      const count = widget.querySelector('.csv-table-count');
      if (rowsOut.length === dataRows.length) {
        count.textContent = t('csv.rowCount', '{n} 行').replace('{n}', dataRows.length);
      } else {
        count.textContent = t('csv.filteredCount', '{m} / {n} 行')
          .replace('{m}', rowsOut.length).replace('{n}', dataRows.length);
      }
      if (rowsOut.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = colCount;
        td.className = 'csv-empty';
        td.textContent = t('csv.empty', '没有匹配的行');
        tr.appendChild(td);
        tbody.appendChild(tr);
      }

      // 表头排序箭头与筛选态标记
      table.querySelectorAll('th').forEach((th, col) => {
        const arrow = th.querySelector('.csv-sort-arrow');
        arrow.textContent = state.sortCol === col ? (state.sortDir === 1 ? '↑' : '↓') : '';
        th.classList.toggle('has-filter', !!state.filters[col]);
      });
    }

    // 排序：升 → 降 → 取消
    table.querySelector('thead').addEventListener('click', (e) => {
      const sortBtn = e.target.closest('.csv-sort-btn');
      if (!sortBtn) return;
      const col = Array.from(table.querySelectorAll('th')).indexOf(sortBtn.closest('th'));
      if (col < 0) return;
      if (state.sortCol !== col) { state.sortCol = col; state.sortDir = 1; }
      else if (state.sortDir === 1) { state.sortDir = -1; }
      else { state.sortCol = -1; state.sortDir = 1; }
      renderBody();
    });

    // 搜索
    widget.querySelector('.csv-search-input').addEventListener('input', (e) => {
      state.q = e.target.value;
      renderBody();
    });

    // 复制 / 下载 CSV（保留原文）
    widget.querySelector('.csv-copy').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      copyText(rawText).then(() => {
        const label = btn.querySelector('span');
        const old = label.textContent;
        label.textContent = t('ctx.copied', '已复制');
        setTimeout(() => { label.textContent = old; }, 1200);
      });
    });
    widget.querySelector('.csv-download').addEventListener('click', () => {
      const blob = new Blob(['\ufeff' + rawText], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (docSlug() || 'table') + (isTsv ? '.tsv' : '.csv');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    // ============== CSV → 图表联动 ==============
    const chartBtn = widget.querySelector('.csv-chart-btn');
    const chartTypeSel = widget.querySelector('.csv-chart-type');
    let chartPanel = null;
    let chartInstance = null;

    // 数值列：非空单元格中数值占比 ≥ 60%
    function numericColumns() {
      const cols = [];
      for (let c = 0; c < colCount; c++) {
        let nonEmpty = 0, numeric = 0;
        dataRows.forEach(r => {
          if (String(r[c]).trim() === '') return;
          nonEmpty++;
          if (toNumber(r[c]) !== null) numeric++;
        });
        if (nonEmpty > 0 && numeric / nonEmpty >= 0.6) cols.push(c);
      }
      return cols;
    }

    function buildChartConfig(type) {
      const rows = visibleRows();
      if (rows.length === 0) return null;
      const numCols = numericColumns();
      if (numCols.length === 0) return null;
      const numSet = new Set(numCols);
      let catCol = -1;
      for (let c = 0; c < colCount; c++) { if (!numSet.has(c)) { catCol = c; break; } }
      const cats = rows.map((r, i) => catCol >= 0 ? String(r[catCol]) : String(i + 1));
      let seriesCols = numCols.filter(c => c !== catCol);
      if (seriesCols.length === 0) seriesCols = numCols.slice(0, 1);
      const series = seriesCols.map(c => ({
        name: header[c] || (t('csv.column', '列') + (c + 1)),
        data: rows.map(r => { const n = toNumber(r[c]); return n === null ? 0 : n; })
      }));
      if (type === 'pie') {
        const c0 = seriesCols[0];
        return {
          chart: { type: 'pie' },
          labels: cats,
          series: rows.map(r => { const n = toNumber(r[c0]); return n === null ? 0 : n; })
        };
      }
      return { chart: { type }, series, xaxis: { categories: cats } };
    }

    function ensureChartPanel() {
      if (chartPanel) return chartPanel;
      chartPanel = document.createElement('div');
      chartPanel.className = 'csv-chart-panel';
      const anchor = widget.querySelector('.csv-table-scroll') || table;
      anchor.insertAdjacentElement('afterend', chartPanel);
      return chartPanel;
    }

    async function renderChart() {
      const panel = ensureChartPanel();
      const type = chartTypeSel.value || 'line';
      const baseCfg = buildChartConfig(type);
      if (!baseCfg) {
        panel.innerHTML = '<div class="csv-chart-msg">' + esc(t('csv.chart.noNumeric', '没有可用于绘图的数值列')) + '</div>';
        return;
      }
      if (typeof ApexCharts === 'undefined') {
        panel.innerHTML = '<div class="csv-chart-msg">' + esc(t('csv.chart.loading', '正在加载图表库…')) + '</div>';
        try { await window.MarkdownPreview.loadScript('iris/vendor/apexcharts.min.js'); } catch (e) { /* ignore */ }
      }
      if (typeof ApexCharts === 'undefined') {
        panel.innerHTML = '<div class="csv-chart-msg">' + esc(t('csv.chart.loadFail', '图表库加载失败')) + '</div>';
        return;
      }
      if (chartInstance) { try { chartInstance.destroy(); } catch (e) { /* ignore */ } chartInstance = null; }
      panel.innerHTML = '';
      const mount = document.createElement('div');
      panel.appendChild(mount);
      const cfg = {
        ...baseCfg,
        colors: ['#8B5CF6', '#D946EF', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'],
        chart: { ...baseCfg.chart, height: 320, toolbar: { show: false } },
        dataLabels: { enabled: false },
        legend: { position: 'bottom' }
      };
      try {
        chartInstance = new ApexCharts(mount, cfg);
        chartInstance.render();
      } catch (e) {
        mount.innerHTML = '<div class="csv-chart-msg">' + esc(t('csv.chart.renderFail', '图表渲染失败')) + ': ' + esc(e.message) + '</div>';
      }
    }

    chartBtn.addEventListener('click', renderChart);
    chartTypeSel.addEventListener('change', () => { if (chartPanel) renderChart(); });

    // ============== 列筛选面板 ==============
    let popover = null;
    function closePopover() { if (popover) { popover.remove(); popover = null; } }

    widget.querySelector('thead').addEventListener('click', (e) => {
      const filterBtn = e.target.closest('.csv-filter-btn');
      if (!filterBtn) return;
      e.stopPropagation();
      const col = parseInt(filterBtn.dataset.col, 10);
      if (popover && popover.dataset.col === String(col)) { closePopover(); return; }
      closePopover();

      const values = Array.from(new Set(dataRows.map(r => r[col]).filter(v => v.trim() !== '')));
      values.sort((a, b) => compareValues(a, b));
      const allowed = state.filters[col] || null;

      popover = document.createElement('div');
      popover.className = 'csv-filter-popover';
      popover.dataset.col = String(col);
      popover.innerHTML = `
        <div class="csv-filter-title">${esc(t('csv.filterBy', '筛选'))}：${esc(header[col])}</div>
        <div class="csv-filter-list"></div>
        <div class="csv-filter-actions">
          <button type="button" class="csv-filter-all">${esc(t('csv.selectAll', '全选'))}</button>
          <button type="button" class="csv-filter-clear">${esc(t('csv.clearFilter', '清除'))}</button>
        </div>
      `;
      const list = popover.querySelector('.csv-filter-list');
      values.forEach(v => {
        const label = document.createElement('label');
        label.className = 'csv-filter-item';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !allowed || allowed.has(v);
        cb.addEventListener('change', () => {
          const checked = Array.from(list.querySelectorAll('input:checked')).map(i => i.dataset.value);
          const allChecked = checked.length === values.length;
          if (allChecked) delete state.filters[col];
          else state.filters[col] = new Set(checked);
          filterBtn.classList.toggle('active', !allChecked);
          renderBody();
        });
        cb.dataset.value = v;
        label.appendChild(cb);
        const span = document.createElement('span');
        span.textContent = v;
        span.className = 'csv-filter-value';
        label.appendChild(span);
        list.appendChild(label);
      });
      popover.querySelector('.csv-filter-all').addEventListener('click', () => {
        delete state.filters[col];
        filterBtn.classList.remove('active');
        list.querySelectorAll('input').forEach(i => { i.checked = true; });
        renderBody();
      });
      popover.querySelector('.csv-filter-clear').addEventListener('click', () => {
        delete state.filters[col];
        filterBtn.classList.remove('active');
        closePopover();
        renderBody();
      });
      document.body.appendChild(popover);
      const rect = filterBtn.getBoundingClientRect();
      const pw = 220, ph = Math.min(320, 60 + values.length * 28);
      popover.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - pw - 8)) + 'px';
      popover.style.top = Math.min(rect.bottom + 6, window.innerHeight - ph - 8) + 'px';
    });
    document.addEventListener('click', (e) => {
      if (popover && !popover.contains(e.target)) closePopover();
    }, true);
    window.addEventListener('resize', closePopover);

    renderBody();
    return widget;
  }

  function copyText(text) {
    return new Promise((resolve, reject) => {
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

  function docSlug() {
    const st = window.MarkdownPreview.state;
    const name = (st && (st.currentFilePath || (st.localDoc && st.localDoc.name))) || '';
    return String(name).replace(/^.*\//, '').replace(/\.md$/i, '') || '';
  }

  // ============== 入口：替换文档内的 csv/tsv 代码块 ==============
  function render(root) {
    // 容器解析走 mdRender.resolveRoot（split-view 隐藏面板同样带 .markdown-body，
    // 全局查询会命中空面板——见 md-render.js resolveRoot 注释）
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang="csv"], pre.code-block[data-lang="tsv"]');
    blocks.forEach(pre => {
      if (pre.dataset.csvDone) return;
      pre.dataset.csvDone = '1';
      const isTsv = pre.dataset.lang === 'tsv';
      const code = pre.querySelector('code');
      if (!code) return;
      const rows = isTsv ? parseTsv(code.textContent) : parseCsv(code.textContent);
      if (rows.length < 2 || rows[0].length === 0) return; // 无表头/数据行，保留原代码块
      const widget = buildWidget(pre, rows, isTsv);
      pre.parentNode.replaceChild(widget, pre);
    });
  }

  window.MarkdownPreview.renderers.csvtable = { render };
})();
