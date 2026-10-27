/**
 * unread - 未读更新列表
 *
 * localStorage 按文档路径记录上次访问时间，与 file-tree.json 的 modified
 * 字段对比，侧边栏药丸按钮 + 命令面板动作列出「自上次访问后更新的 N 篇」。
 *
 * 语义：
 *   - 首次到站把当前文件树全量写为基线（此刻的文档都算「已读」），
 *     之后新出现的文档（无访问记录）视为未读
 *   - 打开文档即更新访问时间，从列表消失
 *   - 数据全现成：modified 构建期已写入 file-tree.json（epoch 秒）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const STORE_KEY = 'md-preview-lastvisit';
  const MAX_DOCS = 500;

  const t = window.MarkdownPreview.t;
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  function readStore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY));
      return (data && typeof data === 'object') ? data : {};
    } catch (e) { return {}; }
  }

  function writeStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { /* 隐私模式等场景跳过 */ }
  }

  function walkFiles(items, out) {
    (items || []).forEach(item => {
      if (item.type === 'folder' && item.children) walkFiles(item.children, out);
      else if (item.type === 'file' && item.path) out.push(item);
    });
    return out;
  }

  // 首次到站：把当前文件树全量写为基线，避免整站文档一开门全标未读
  let baselineDone = false;
  function ensureBaseline(files) {
    if (baselineDone) return;
    baselineDone = true;
    const store = readStore();
    if (Object.keys(store).length > 0) return;
    const now = Date.now();
    files.forEach(f => { store[f.path] = now; });
    writeStore(store);
  }

  // ============== 未读聚合 ==============

  function getUnread() {
    const st = window.MarkdownPreview.state;
    if (!st || !Array.isArray(st.fileTreeData)) return [];
    const files = walkFiles(st.fileTreeData, []);
    ensureBaseline(files);
    const store = readStore();
    return files
      .filter(f => f.modified && f.modified * 1000 > (store[f.path] || 0))
      .map(f => ({
        path: f.path,
        title: f.title || String(f.name || '').replace(/\.md$/i, ''),
        modified: f.modified
      }))
      .sort((a, b) => b.modified - a.modified);
  }

  // ============== 文档打开时更新访问时间 ==============

  function onDocRendered(path) {
    if (!path) return;
    const store = readStore();
    if (store[path] && Date.now() - store[path] < 60 * 1000) {
      updatePill(); // 1 分钟内重复打开不反复写存储
      return;
    }
    store[path] = Date.now();
    const keys = Object.keys(store);
    if (keys.length > MAX_DOCS) {
      // 近似 LRU：这里没有时间有序保证，直接淘汰前一半旧键（与 collapse 同策略）
      keys.slice(0, keys.length - Math.floor(MAX_DOCS / 2)).forEach(k => delete store[k]);
    }
    writeStore(store);
    updatePill();
  }

  // ============== 未读更新聚合页 ==============

  function openUnreadPage() {
    const unread = getUnread();
    const lines = [];
    lines.push(`# ${t('unread.pageTitle', '未读更新')}`);
    lines.push('');
    lines.push(`> ${t('unread.docCount', '自上次访问后更新了 {n} 篇').replace('{n}', unread.length)}`);
    lines.push('');
    unread.forEach(doc => {
      const date = new Date(doc.modified * 1000);
      const dateStr = isNaN(date) ? '' : date.toISOString().slice(0, 10);
      lines.push(`- [${doc.title}](#/${encodeURI(doc.path)})`);
      lines.push(`  \`${doc.path}\`${dateStr ? ' · ' + dateStr : ''}`);
    });
    if (unread.length === 0) {
      lines.push(`*${t('unread.empty', '没有未读更新，追上进度了 🎉')}*`);
    }

    const { markdown } = window.MarkdownPreview;
    if (markdown && markdown.renderVirtualDoc) {
      markdown.renderVirtualDoc(lines.join('\n'), t('unread.pageTitle', '未读更新'));
    }
  }

  // ============== 侧边栏药丸按钮 ==============

  function updatePill() {
    const pill = document.getElementById('unreadPill');
    if (!pill) return;
    const unread = getUnread();
    if (unread.length === 0) {
      pill.hidden = true;
      return;
    }
    pill.hidden = false;
    const label = pill.querySelector('.unread-pill-text');
    if (label) label.textContent = t('unread.pill', '{n} 篇更新').replace('{n}', unread.length);
  }

  function init() {
    const pill = document.getElementById('unreadPill');
    if (pill && !pill.dataset.init) {
      pill.dataset.init = '1';
      pill.addEventListener('click', openUnreadPage);
    }
    window.addEventListener('filetreeloaded', updatePill);
    window.addEventListener('langchange', updatePill);
    updatePill();
  }

  window.MarkdownPreview.unread = { init, getUnread, openUnreadPage, onDocRendered };
})();
