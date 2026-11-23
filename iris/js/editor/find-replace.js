/**
 * 编辑器查找/替换子系统（editor.js 拆分第一批）
 *
 * 从 editor.js 外移：面板开关、匹配收集/跳转、替换。与编辑器主体通过
 * init(ctx) 注入的协作对象解耦（cells/getCell/活动 cell 读写/元数据刷新等）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.editorModules = window.MarkdownPreview.editorModules || {};

  window.MarkdownPreview.editorModules.findReplace = {
    init: function(ctx) {
      const searchPanel = ctx.searchPanel;
      const searchInput = ctx.searchInput;
      const replaceInput = ctx.replaceInput;
      const searchInfo = ctx.searchInfo;

      let searchMatches = []; // [{cellId, start, end}]
      let searchIdx = -1;

      function openSearchPanel() {
        if (!searchPanel) return;
        searchPanel.classList.add('visible');
        setTimeout(() => searchInput.focus(), 50);
      }

      function closeSearchPanel() {
        if (!searchPanel) return;
        searchPanel.classList.remove('visible');
        searchMatches = [];
        searchIdx = -1;
        if (searchInfo) searchInfo.textContent = '未搜索';
        // 清除高亮（textarea 无法真正高亮，仅清除选中）
        const cell = ctx.getActiveCell();
        if (cell) cell.textarea.blur();
      }

      function doSearch(opts) {
        opts = opts || {};
        const query = searchInput.value;
        searchMatches = [];
        searchIdx = -1;
        if (!query) {
          if (searchInfo) searchInfo.textContent = '请输入查找内容';
          return;
        }
        const lowerQuery = query.toLowerCase();
        ctx.getCells().forEach(c => {
          const val = c.textarea.value.toLowerCase();
          // replaceOne 用：该 cell 从替换点之后开始收集
          let pos = (opts.skipCellId === c.id) ? Math.min(opts.skipPos || 0, val.length) : 0;
          while (true) {
            const idx = val.indexOf(lowerQuery, pos);
            if (idx === -1) break;
            searchMatches.push({ cellId: c.id, start: idx, end: idx + query.length });
            pos = idx + 1;
          }
        });
        if (searchMatches.length === 0) {
          if (searchInfo) searchInfo.textContent = '未找到匹配';
        } else {
          searchIdx = 0;
          highlightMatch(searchMatches[0]);
          if (searchInfo) searchInfo.textContent = `1 / ${searchMatches.length} 个匹配`;
        }
      }

      function highlightMatch(m) {
        const cell = ctx.getCell(m.cellId);
        if (!cell) return;
        ctx.setActiveCellId(m.cellId);
        cell.textarea.focus();
        cell.textarea.setSelectionRange(m.start, m.end);
        // CM6 的 scrollIntoView 在 setSelectionRange 中已处理
      }

      function searchNavigate(dir) {
        if (searchMatches.length === 0) return;
        searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;
        highlightMatch(searchMatches[searchIdx]);
        if (searchInfo) searchInfo.textContent = `${searchIdx + 1} / ${searchMatches.length} 个匹配`;
      }

      function replaceOne() {
        if (searchIdx < 0 || searchIdx >= searchMatches.length) return;
        const m = searchMatches[searchIdx];
        const cell = ctx.getCell(m.cellId);
        if (!cell) return;
        const replaceText = replaceInput.value;
        cell.textarea.replaceRange(m.start, m.end, replaceText);
        ctx.updateCellMeta(cell);
        ctx.markModified(cell);
        ctx.markUnsaved();
        // 替换词包含查询词时（a→aa），重查若从原偏移开始会反复命中自身：
        // 跳过刚替换完的区间
        doSearch({ skipCellId: m.cellId, skipPos: m.start + replaceText.length });
      }

      function replaceAll() {
        if (!searchInput.value) return;
        const replaceText = replaceInput.value;
        let count = 0;
        ctx.getCells().forEach(c => {
          const val = c.textarea.value;
          if (val.toLowerCase().indexOf(searchInput.value.toLowerCase()) !== -1) {
            const regex = new RegExp(escapeRegExp(searchInput.value), 'gi');
            const newVal = val.replace(regex, () => { count++; return replaceText; });
            if (newVal !== val) {
              c.textarea.setValue(newVal);
              ctx.updateCellMeta(c);
              ctx.markModified(c);
            }
          }
        });
        ctx.markUnsaved();
        if (searchInfo) searchInfo.textContent = `已替换 ${count} 处`;
        searchMatches = [];
        searchIdx = -1;
      }

      function escapeRegExp(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      // 搜索面板事件
      if (ctx.searchBtn) ctx.searchBtn.addEventListener('click', () => {
        if (searchPanel.classList.contains('visible')) closeSearchPanel();
        else openSearchPanel();
      });
      if (searchInput) {
        // 150ms 防抖（与文档站查找条 find-bar.js 对齐）：每次按键全量扫所有 cell
        let searchDebounce = null;
        searchInput.addEventListener('input', () => {
          if (searchDebounce) clearTimeout(searchDebounce);
          searchDebounce = setTimeout(doSearch, 150);
        });
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? searchNavigate(-1) : searchNavigate(1); }
        });
      }
      document.getElementById('searchPrevBtn')?.addEventListener('click', () => searchNavigate(-1));
      document.getElementById('searchNextBtn')?.addEventListener('click', () => searchNavigate(1));
      document.getElementById('replaceOneBtn')?.addEventListener('click', replaceOne);
      document.getElementById('replaceAllBtn')?.addEventListener('click', replaceAll);
      document.getElementById('searchCloseBtn')?.addEventListener('click', closeSearchPanel);

      return {
        openSearchPanel,
        closeSearchPanel,
        searchNavigate,
        isPanelOpen: () => !!(searchPanel && searchPanel.classList.contains('visible')),
        // 内容变化（cell 输入/恢复/导入）使旧偏移匹配失效
        invalidateMatches: function() {
          if (!searchMatches.length) return false;
          searchMatches = [];
          searchIdx = -1;
          if (searchInfo) searchInfo.textContent = '内容已修改，重新输入以查找';
          return true;
        }
      };
    }
  };
})();
