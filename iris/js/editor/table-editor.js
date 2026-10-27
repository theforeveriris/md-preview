/**
 * editor/table-editor - 可视化表格编辑器
 *
 * Cell 输出区渲染出的表格右上角出现「编辑」按钮：网格化增删行列、
 * 单元格所见即所得编辑，保存后序列化回 Markdown 源码并重渲染——
 * 手写对齐竖线维护宽表最痛的点。
 *
 * 源码定位：fence 感知地扫描 Cell 内的 `|…|` 行块，第 N 个渲染表格
 * 对应第 N 个源码块；解析失败的表格不出按钮。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.editorModules = window.MarkdownPreview.editorModules || {};

  window.MarkdownPreview.editorModules.tableEditor = {
    init: function(ctx) {
      const editorT = ctx.editorT;
      const showToast = ctx.showToast;
      const esc = window.MarkdownPreview.mdRender.escapeHtml;

      // ============== 源码表格扫描 / 解析 / 序列化 ==============

      function findSourceTables(text) {
        const lines = text.split('\n');
        const spans = [];
        let start = -1;
        let fence = null;
        for (let i = 0; i <= lines.length; i++) {
          const line = i < lines.length ? lines[i] : '';
          const fm = line.match(/^\s*(`{3,}|~{3,})/);
          if (fm) {
            if (!fence) fence = { char: fm[1][0], len: fm[1].length };
            else if (fm[1][0] === fence.char && fm[1].length >= fence.len) fence = null;
          }
          const isRow = !fence && /^\s*\|.*\|\s*$/.test(line);
          if (isRow && start < 0) start = i;
          else if (!isRow && start >= 0) { spans.push({ start, end: i }); start = -1; }
        }
        return spans;
      }

      function parseTableBlock(rawLines) {
        const rows = [];
        let hasHeader = false;
        for (const line of rawLines) {
          const trimmed = line.trim();
          if (!/^\|/.test(trimmed)) return null;
          const cells = trimmed
            .replace(/^\|/, '')
            .replace(/\|$/, '')
            .split(/(?<!\\)\|/)
            .map(c => c.replace(/\\\|/g, '|').trim());
          if (rows.length >= 1 && cells.every(c => /^:?-{2,}:?$/.test(c) || c === '')) {
            hasHeader = true;
            continue;
          }
          rows.push(cells);
        }
        if (rows.length === 0) return null;
        const cols = Math.max(...rows.map(r => r.length), 1);
        rows.forEach(r => { while (r.length < cols) r.push(''); });
        return { rows, hasHeader };
      }

      function escapeCell(s) {
        return String(s).replace(/\|/g, '\\|');
      }

      function serializeTable(rows, hasHeader) {
        const cols = rows[0].length;
        const lines = ['| ' + rows[0].map(escapeCell).join(' | ') + ' |'];
        if (hasHeader) {
          lines.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
        }
        for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
          lines.push('| ' + rows[i].map(escapeCell).join(' | ') + ' |');
        }
        return lines.join('\n');
      }

      // ============== 输出区挂「编辑」按钮 ==============

      function attach(outputElement) {
        if (!outputElement) return;
        const owner = ctx.getCells().find(c => c.output === outputElement);
        if (!owner || owner.type === 'plaintext') return;
        outputElement.querySelectorAll('table').forEach(tbl => {
          if (tbl.parentElement && tbl.parentElement.classList.contains('cell-table-wrap')) return;
          if (tbl.closest('.cell-table-wrap')) return; // 已包裹
          const wrap = document.createElement('div');
          wrap.className = 'cell-table-wrap';
          tbl.parentNode.insertBefore(wrap, tbl);
          wrap.appendChild(tbl);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cell-table-edit-btn';
          btn.textContent = editorT('tbl.edit', '编辑');
          btn.title = editorT('tbl.editTitle', '可视化编辑此表格，保存后回写 Markdown 源码');
          btn.addEventListener('click', () => openEditor(owner, tbl));
          wrap.appendChild(btn);
        });
      }

      // ============== 网格编辑器 ==============

      function openEditor(cellData, tbl) {
        const text = cellData.textarea.value;
        // 渲染表格 ↔ 源码块按出现顺序对应
        const renderedIndex = Array.from(cellData.output.querySelectorAll('table')).indexOf(tbl);
        const spans = findSourceTables(text);
        if (renderedIndex < 0 || renderedIndex >= spans.length) {
          showToast(editorT('tbl.locateFail', '无法在源码中定位此表格（可能来自 HTML 或其他语法糖）'));
          return;
        }
        const span = spans[renderedIndex];
        const parsed = parseTableBlock(text.split('\n').slice(span.start, span.end));
        if (!parsed) {
          showToast(editorT('tbl.parseFail', '表格解析失败'));
          return;
        }
        let rows = parsed.rows.map(r => r.slice());
        let hasHeader = parsed.hasHeader;
        // 已有 table-style 标记 → 初始化预设选择框（否则仅改单元格保存
        // 会把旧样式丢掉）；改选「默认」可清除预设。
        // 只读紧邻表格的那一行标记（更后面的标记可能属于其他表格）
        let existingPreset = '';
        const nextLine = text.split('\n')[span.end] || '';
        const presetMatch = /<!--\s*table-style:\s*([\w\- ]+?)\s*-->/.exec(nextLine);
        if (presetMatch) existingPreset = presetMatch[1].trim();

        let overlay = document.getElementById('tblEditorOverlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'tblEditorOverlay';
          overlay.className = 'tbl-editor-overlay';
          document.body.appendChild(overlay);
          overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
          document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
          });
        }
        overlay.innerHTML = `
          <div class="tbl-editor-card" role="dialog" aria-modal="true">
            <div class="tbl-editor-head">
              <span class="tbl-editor-title">${esc(editorT('tbl.title', '表格编辑器'))}</span>
              <span class="tbl-editor-actions">
                <button type="button" class="download-btn" data-grid="add-row">${esc(editorT('tbl.addRow', '加行'))}</button>
                <button type="button" class="download-btn" data-grid="del-row">${esc(editorT('tbl.delRow', '删行'))}</button>
                <button type="button" class="download-btn" data-grid="add-col">${esc(editorT('tbl.addCol', '加列'))}</button>
                <button type="button" class="download-btn" data-grid="del-col">${esc(editorT('tbl.delCol', '删列'))}</button>
                <button type="button" class="download-btn" data-grid="toggle-header" title="${esc(editorT('tbl.toggleHeaderTitle', '首行是否为表头（带分隔线）'))}">${esc(editorT('tbl.toggleHeader', '表头'))}</button>
                <button type="button" class="find-bar-btn tbl-editor-close" aria-label="${esc(editorT('common.close', '关闭'))}">✕</button>
              </span>
            </div>
            <div class="tbl-editor-body"></div>
            <div class="tbl-editor-foot">
              <button type="button" class="download-btn tbl-save">${esc(editorT('tbl.save', '保存并回写源码'))}</button>
              <span class="tbl-editor-foot-mid">
                <label class="tbl-preset-label">${esc(editorT('tbl.preset', '样式预设'))}
                  <select class="tbl-preset-sel">
                    <option value="">${esc(editorT('tbl.presetDefault', '默认'))}</option>
                    <option value="md-table-zebra">${esc(editorT('tbl.presetZebra', '斑马纹'))}</option>
                    <option value="md-table-compact">${esc(editorT('tbl.presetCompact', '紧凑'))}</option>
                    <option value="md-table-accent-header">${esc(editorT('tbl.presetAccent', '强调首行'))}</option>
                  </select>
                </label>
              </span>
              <span class="tbl-editor-hint">${esc(editorT('tbl.hint', '保存后自动重渲染当前 Cell'))}</span>
            </div>
          </div>`;
        overlay.classList.add('open');

        const body = overlay.querySelector('.tbl-editor-body');

        function renderGrid() {
          const grid = document.createElement('table');
          grid.className = 'tbl-editor-grid';
          const rowsHtml = rows.map((row, ri) => {
            const isHead = hasHeader && ri === 0;
            return `<tr data-row="${ri}">${row.map((val, ci) =>
              `<td${isHead ? ' class="tbl-head-cell"' : ''}><input data-r="${ri}" data-c="${ci}" value="${esc(val)}"${isHead ? ' placeholder="表头"' : ''}></td>`
            ).join('')}</tr>`;
          }).join('');
          grid.innerHTML = `<tbody>${rowsHtml}</tbody>`;
          body.innerHTML = '';
          body.appendChild(grid);
          grid.addEventListener('input', (e) => {
            const input = e.target;
            if (input.dataset.r === undefined) return;
            rows[parseInt(input.dataset.r, 10)][parseInt(input.dataset.c, 10)] = input.value;
          });
        }

        overlay.querySelector('[data-grid="add-row"]').addEventListener('click', () => {
          rows.push(Array(rows[0].length).fill(''));
          renderGrid();
        });
        overlay.querySelector('[data-grid="del-row"]').addEventListener('click', () => {
          if (rows.length > 1) { rows.pop(); renderGrid(); }
        });
        overlay.querySelector('[data-grid="add-col"]').addEventListener('click', () => {
          rows.forEach(r => r.push(''));
          renderGrid();
        });
        overlay.querySelector('[data-grid="del-col"]').addEventListener('click', () => {
          if (rows[0].length > 1) { rows.forEach(r => r.pop()); renderGrid(); }
        });
        overlay.querySelector('[data-grid="toggle-header"]').addEventListener('click', () => {
          hasHeader = !hasHeader;
          renderGrid();
        });
        const presetSel = overlay.querySelector('.tbl-preset-sel');
        if (presetSel && existingPreset) presetSel.value = existingPreset;
        overlay.querySelector('.tbl-editor-close').addEventListener('click', close);

        overlay.querySelector('.tbl-save').addEventListener('click', () => {
          const lines = text.split('\n');
          // 样式预设（ADJ-TABLE-2）：非默认预设以 HTML 注释标记跟在表格后，
          // 渲染管线（mdRender.applyTablePresets）读标记给表格挂类。
          // 先移除紧跟表格后的旧标记（span.end 起），避免重复累积。
          let end = span.end;
          while (end < lines.length && /<!--\s*table-style:/.test(lines[end])) end++;
          const preset = overlay.querySelector('.tbl-preset-sel').value;
          const marker = preset ? '\n<!-- table-style: ' + preset + ' -->' : '';
          const tableText = serializeTable(rows, hasHeader) + marker;
          const newText = lines.slice(0, span.start)
            .concat([tableText], lines.slice(end))
            .join('\n');
          cellData.textarea.setValue(newText);
          ctx.afterSourceEdit(cellData);
          close();
        });

        renderGrid();
      }

      function close() {
        const overlay = document.getElementById('tblEditorOverlay');
        if (overlay) overlay.classList.remove('open');
      }

      return { attach, openEditor };
    }
  };
})();
