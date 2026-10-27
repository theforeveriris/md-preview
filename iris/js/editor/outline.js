/**
 * editor/outline - 笔记本大纲侧栏（相邻扩散）
 *
 * 侧边浮出本笔记本的标题大纲（各 Cell 内 #~#### 标题行），点击跳转到
 * 对应 Cell 并把光标定位到该标题行——长笔记本导航。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.editorModules = window.MarkdownPreview.editorModules || {};

  window.MarkdownPreview.editorModules.outline = {
    init: function(ctx) {
      const editorT = ctx.editorT;
      const esc = window.MarkdownPreview.mdRender.escapeHtml;
      let panel = null;
      let listEl = null;
      let visible = false;
      let refreshTimer = null;

      function collect() {
        const out = [];
        ctx.getCells().forEach(cell => {
          const value = cell.textarea.value || '';
          const lines = value.split('\n');
          let offset = 0;
          lines.forEach((line, i) => {
            const m = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
            if (m) out.push({ cell, line: i, level: m[1].length, text: m[2], offset });
            offset += line.length + 1;
          });
        });
        return out;
      }

      function refresh() {
        if (!listEl) return;
        const items = collect();
        if (items.length === 0) {
          listEl.innerHTML = `<div class="ed-outline-empty">${esc(editorT('outline.empty', '各 Cell 里写 # 标题就会出现在这里'))}</div>`;
          return;
        }
        listEl.innerHTML = items.map((item, idx) => `
          <button type="button" class="ed-outline-item" data-idx="${idx}" style="padding-left:${10 + (item.level - 1) * 12}px">
            <span class="ed-outline-h">H${item.level}</span>
            <span class="ed-outline-text">${esc(item.text)}</span>
          </button>`).join('');
        listEl.querySelectorAll('.ed-outline-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const item = items[parseInt(btn.dataset.idx, 10)];
            if (!item) return;
            item.cell.div.scrollIntoView({ behavior: 'smooth', block: 'start' });
            try {
              item.cell.editor.view.dispatch({
                selection: { anchor: Math.max(0, item.offset) },
                scrollIntoView: true
              });
              item.cell.editor.focus();
            } catch (e) { /* 光标失败不影响跳转 */ }
          });
        });
      }

      function scheduleRefresh() {
        if (!visible) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, 400);
      }

      function ensurePanel() {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.className = 'editor-outline';
        panel.innerHTML = `
          <div class="ed-outline-head">
            <span>${esc(editorT('outline.title', '大纲'))}</span>
            <button type="button" class="ed-outline-close" aria-label="${esc(editorT('common.close', '关闭'))}">✕</button>
          </div>
          <div class="ed-outline-list"></div>`;
        document.body.appendChild(panel);
        listEl = panel.querySelector('.ed-outline-list');
        panel.querySelector('.ed-outline-close').addEventListener('click', toggle);
        return panel;
      }

      function toggle() {
        ensurePanel();
        visible = !visible;
        panel.classList.toggle('open', visible);
        document.getElementById('outlineBtn')?.classList.toggle('active', visible);
        if (visible) refresh();
      }

      // 工具栏按钮（模板 DOM 在 lazy 注入后已存在）
      const btn = document.getElementById('outlineBtn');
      if (btn && !btn.dataset.outlineInit) {
        btn.dataset.outlineInit = '1';
        btn.addEventListener('click', toggle);
      }

      return { refresh: scheduleRefresh, toggle };
    }
  };
})();
