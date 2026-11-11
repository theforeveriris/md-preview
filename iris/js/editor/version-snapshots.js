/**
 * editor/version-snapshots - 笔记本版本快照
 *
 * 自动保存之外的安全网：手动 + 定时保留最近 N 个版本到 IndexedDB
 * （storage.js 的 versions store），面板内可 diff 对比与一键回滚——防手滑删稿。
 *
 * - 手动：面板「保存快照」按钮 / 「下载」菜单
 * - 定时：每次自动保存成功后检查，距上次快照 ≥ 30 分钟且内容有实质
 *   变化（长度差 > 200 字符）才落盘，标签「自动」
 * - 上限：每笔记本 30 个，超出按时间淘汰最旧
 * - diff：行级 LCS（超长截断降级为整体替换块），自绘统一视图
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.editorModules = window.MarkdownPreview.editorModules || {};

  const MAX_SNAPSHOTS = 30;
  const AUTO_INTERVAL = 30 * 60 * 1000;
  const AUTO_MIN_DELTA = 200; // 字符
  const DIFF_LINE_CAP = 2000;

  window.MarkdownPreview.editorModules.versionSnapshots = {
    init: function(ctx) {
      const editorT = ctx.editorT;
      const showToast = ctx.showToast;
      const storage = window.MarkdownPreview.storage;

      let panel = null;
      let lastAuto = { ts: 0, len: 0 };

      // ============== 快照存取 ==============

      function currentCells() {
        return ctx.getCells().map(c => ({
          type: c.type || 'markdown',
          content: c.textarea.value
        }));
      }

      function cellsToText(cells) {
        return cells
          .map(c => (c.type === 'plaintext' ? '<!-- cell: plaintext -->\n' : '') + c.content.trim())
          .join('\n<!-- mdp2:cell -->\n');
      }

      function totalLength(cells) {
        return cells.reduce((n, c) => n + c.content.length, 0);
      }

      async function snapshot(label) {
        if (!storage || !storage.isAvailable()) { showToast(editorT('snap.unavailable', 'IndexedDB 不可用，无法保存快照')); return; }
        const notebookId = ctx.getNotebookId();
        const cells = currentCells();
        if (totalLength(cells) === 0) { showToast(editorT('snap.emptyNotebook', '笔记本是空的，无需快照')); return; }
        await storage.saveVersionSnapshot({
          notebookId,
          ts: Date.now(),
          label: label || editorT('snap.manual', '手动'),
          cells
        });
        await prune(notebookId);
        showToast(editorT('snap.saved', '已保存版本快照'));
      }

      async function prune(notebookId) {
        const list = await storage.listVersionSnapshots(notebookId);
        if (list.length <= MAX_SNAPSHOTS) return;
        list.sort((a, b) => a.ts - b.ts);
        for (const old of list.slice(0, list.length - MAX_SNAPSHOTS)) {
          await storage.deleteVersionSnapshot(old.id);
        }
      }

      // 自动保存钩子（editor.js autosave 成功后调用）
      async function maybeAutoSnapshot() {
        if (!storage || !storage.isAvailable()) return;
        try {
          const len = totalLength(currentCells());
          if (len < AUTO_MIN_DELTA) return;
          if (Date.now() - lastAuto.ts < AUTO_INTERVAL) return;
          if (lastAuto.len && Math.abs(len - lastAuto.len) < AUTO_MIN_DELTA && lastAuto.ts !== 0) return;
          lastAuto = { ts: Date.now(), len };
          await snapshot(editorT('snap.auto', '自动'));
        } catch (e) { /* 快照失败不打扰编辑 */ }
      }

      // ============== 行级 LCS diff ==============
      // 共享实现（md-render.js diffLines），与「与 git HEAD 对比」共用

      function diffLines(aText, bText) {
        return window.MarkdownPreview.mdRender.diffLines(aText, bText, DIFF_LINE_CAP);
      }

      // ============== 面板 ==============

      const esc = window.MarkdownPreview.mdRender.escapeHtml;

      function ensurePanel() {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.className = 'snapshots-overlay';
        panel.innerHTML = `
          <div class="snapshots-card" role="dialog" aria-modal="true">
            <div class="snapshots-head">
              <span class="snapshots-title">${esc(editorT('snap.panelTitle', '版本快照'))}</span>
              <span class="snapshots-actions">
                <button type="button" class="download-btn snap-save-btn">${esc(editorT('snap.saveNow', '保存快照'))}</button>
                <button type="button" class="find-bar-btn snapshots-close" aria-label="${esc(editorT('common.close', '关闭'))}">✕</button>
              </span>
            </div>
            <div class="snapshots-body"></div>
          </div>`;
        document.body.appendChild(panel);
        panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
        panel.querySelector('.snapshots-close').addEventListener('click', close);
        panel.querySelector('.snap-save-btn').addEventListener('click', async () => {
          await snapshot(editorT('snap.manual', '手动'));
          renderList();
        });
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && panel.classList.contains('open')) close();
        });
        return panel;
      }

      function close() { if (panel) panel.classList.remove('open'); }

      function fmtTime(ts) {
        try { return new Date(ts).toLocaleString('zh-CN', { hour12: false }); } catch (e) { return String(ts); }
      }

      function renderList() {
        const body = panel.querySelector('.snapshots-body');
        storage.listVersionSnapshots(ctx.getNotebookId()).then(list => {
          list.sort((a, b) => b.ts - a.ts);
          if (list.length === 0) {
            body.innerHTML = `<div class="snapshots-empty">${esc(editorT('snap.empty', '还没有快照。点右上角「保存快照」，或等 30 分钟自动快照。'))}</div>`;
            return;
          }
          body.innerHTML = `<ul class="snapshots-list">${list.map(s => `
            <li class="snapshots-item">
              <div class="snapshots-item-info">
                <span class="snapshots-item-label">${esc(s.label)}</span>
                <span class="snapshots-item-time">${esc(fmtTime(s.ts))}</span>
                <span class="snapshots-item-meta">${esc(editorT('snap.cellCount', '{n} 个 Cell').replace('{n}', s.cells.length))} · ${totalLength(s.cells)} 字符</span>
              </div>
              <div class="snapshots-item-actions">
                <button type="button" class="download-btn" data-act="diff" data-id="${s.id}">${esc(editorT('snap.diff', '与当前对比'))}</button>
                <button type="button" class="download-btn" data-act="rollback" data-id="${s.id}">${esc(editorT('snap.rollback', '回滚'))}</button>
                <button type="button" class="download-btn snapshots-del" data-act="del" data-id="${s.id}">${esc(editorT('common.delete', '删除'))}</button>
              </div>
            </li>`).join('')}</ul>`;
          body.querySelectorAll('button[data-act]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = parseInt(btn.dataset.id, 10);
              const act = btn.dataset.act;
              const snap = await storage.getVersionSnapshot(id);
              if (!snap) return;
              if (act === 'del') {
                await storage.deleteVersionSnapshot(id);
                renderList();
              } else if (act === 'diff') {
                renderDiff(snap);
              } else if (act === 'rollback') {
                if (!confirm(editorT('snap.rollbackConfirm', '回滚将用该快照替换当前全部 Cell（可先对当前内容另存快照），继续？'))) return;
                await snapshot(editorT('snap.beforeRollback', '回滚前自动快照'));
                // 结构化恢复：快照的 cells 数组原样还原（cellsToText 经
                // Markdown 拆分会把含 --- 的单 Cell 错拆、丢空 Cell）
                await ctx.restoreCells(snap.cells);
                close();
              }
            });
          });
        });
      }

      function renderDiff(snap) {
        const body = panel.querySelector('.snapshots-body');
        const current = cellsToText(currentCells());
        const before = cellsToText(snap.cells);
        const ops = diffLines(before, current);
        const rows = ops.map(op => {
          const sign = op.type === 'del' ? '−' : op.type === 'add' ? '+' : op.type === 'note' ? '…' : ' ';
          const cls = op.type === 'del' ? 'del' : op.type === 'add' ? 'add' : op.type === 'note' ? 'note' : 'ctx';
          return `<div class="snap-diff-row snap-diff-${cls}"><span class="snap-diff-sign">${sign}</span><code>${esc(op.text) || '&nbsp;'}</code></div>`;
        }).join('');
        body.innerHTML = `
          <button type="button" class="download-btn snap-back">← ${esc(editorT('snap.backToList', '返回快照列表'))}</button>
          <div class="snap-diff-title">${esc(editorT('snap.diffTitle', '快照 {t} → 当前内容').replace('{t}', fmtTime(snap.ts)))}
            <span class="snap-diff-legend">
              <span class="snap-diff-del">${esc(editorT('snap.legendDel', '− 快照有'))}</span>
              <span class="snap-diff-add">${esc(editorT('snap.legendAdd', '+ 当前有'))}</span>
            </span>
          </div>
          <div class="snap-diff">${rows}</div>`;
        body.querySelector('.snap-back').addEventListener('click', renderList);
      }

      function openPanel() {
        ensurePanel();
        panel.classList.add('open');
        renderList();
      }

      ctx.registerMenuAction('version-snapshots', openPanel);

      return { snapshot, maybeAutoSnapshot, openPanel };
    }
  };
})();
