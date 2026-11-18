/**
 * diff - Git diff 可视化
 *
 * 视觉与本站「配置语义 diff」(cfgdiff) 保持一致：一张圆角卡片，
 * 头部是文件名 + +N/−N 计数，正文按 hunk 平铺，行号与符号单独成列。
 * 不再依赖 diff2html（省掉 ~1MB 的脚本与样式），样式全部走主题变量。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // ============== 解析 unified diff ==============
  function newFile(header) {
    return {
      header: header || '',
      oldPath: '',
      newPath: '',
      meta: [],
      hunks: [],
      add: 0,
      del: 0
    };
  }

  function cleanPath(p) {
    if (!p) return '';
    let v = String(p).trim();
    if (v === '/dev/null') return '';
    v = v.replace(/^"(.*)"$/, '$1');
    v = v.replace(/^[ab]\//, '');
    return v;
  }

  function parseHunkHeader(line) {
    const m = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
    if (!m) return { oldNo: 1, newNo: 1 };
    return { oldNo: parseInt(m[1], 10), newNo: parseInt(m[3], 10) };
  }

  function parseUnifiedDiff(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const files = [];
    let cur = null;
    let hunk = null;
    let oldNo = 0;
    let newNo = 0;

    lines.forEach((raw) => {
      const line = raw;

      if (/^diff --git /.test(line)) {
        cur = newFile(line);
        files.push(cur);
        hunk = null;
        return;
      }
      if (!cur) {
        // 没有 diff --git 头的裸 diff：遇到 --- / +++ / @@ 时兜底开一个文件
        if (/^(--- |\+\+\+ |@@ )/.test(line)) {
          cur = newFile('');
          files.push(cur);
        } else {
          return;
        }
      }

      if (/^\+\+\+ /.test(line)) {
        cur.newPath = cleanPath(line.slice(4));
        return;
      }
      if (/^--- /.test(line)) {
        cur.oldPath = cleanPath(line.slice(4));
        return;
      }
      if (/^@@ /.test(line)) {
        const pos = parseHunkHeader(line);
        oldNo = pos.oldNo;
        newNo = pos.newNo;
        hunk = { header: line, rows: [] };
        cur.hunks.push(hunk);
        return;
      }
      if (/^(index |new file mode|deleted file mode|old mode|new mode|similarity index|rename (from|to)|Binary files)/.test(line)) {
        cur.meta.push(line);
        return;
      }
      if (!hunk) return;

      if (line === '' || line === ' ') {
        // hunk 末尾的空行 / 被邮件折行吃掉的空上下文
        hunk.rows.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: '' });
        return;
      }

      const sign = line[0];
      const body = line.slice(1);
      if (sign === '+') {
        cur.add += 1;
        hunk.rows.push({ type: 'add', oldNo: null, newNo: newNo++, text: body });
      } else if (sign === '-') {
        cur.del += 1;
        hunk.rows.push({ type: 'del', oldNo: oldNo++, newNo: null, text: body });
      } else if (sign === '\\') {
        hunk.rows.push({ type: 'note', oldNo: null, newNo: null, text: line.trim() });
      } else {
        hunk.rows.push({ type: 'ctx', oldNo: oldNo++, newNo: newNo++, text: line.slice(1) });
      }
    });

    return files.filter(f => f.hunks.length || f.meta.length);
  }

  function fileLabel(file) {
    const path = file.newPath || file.oldPath;
    if (!path) return t('diff.unknownFile', '未命名文件');
    return path.split('/').pop() || path;
  }

  // ============== 渲染 ==============
  function rowHtml(row) {
    if (row.type === 'note') {
      return '<div class="diff-row diff-note"><span class="diff-note-text">' + esc(row.text) + '</span></div>';
    }
    const cls = row.type === 'add' ? ' diff-add' : row.type === 'del' ? ' diff-del' : '';
    const sign = row.type === 'add' ? '+' : row.type === 'del' ? '−' : '';
    const oldCell = row.oldNo == null ? '' : row.oldNo;
    const newCell = row.newNo == null ? '' : row.newNo;
    return '<div class="diff-row' + cls + '">' +
      '<span class="diff-no">' + oldCell + '</span>' +
      '<span class="diff-no">' + newCell + '</span>' +
      '<span class="diff-sign">' + sign + '</span>' +
      '<code class="diff-code">' + (esc(row.text) || '&nbsp;') + '</code>' +
    '</div>';
  }

  function fileHtml(file) {
    const name = fileLabel(file);
    const path = file.newPath || file.oldPath;
    let html = '<div class="diff-card">' +
      '<div class="diff-head">' +
        '<span class="diff-file" title="' + esc(path || name) + '">' + esc(name) + '</span>' +
        (file.meta.some(m => /^new file mode/.test(m)) ? '<span class="diff-tag">' + esc(t('diff.newFile', '新增')) + '</span>' : '') +
        (file.meta.some(m => /^deleted file mode/.test(m)) ? '<span class="diff-tag diff-tag-del">' + esc(t('diff.deletedFile', '删除')) + '</span>' : '') +
        '<span class="diff-counts">' +
          '<span class="diff-add-count">+' + file.add + '</span>' +
          '<span class="diff-del-count">−' + file.del + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="diff-body">';

    file.hunks.forEach((hunk) => {
      html += '<div class="diff-hunk">' + esc(hunk.header) + '</div>' +
        hunk.rows.map(rowHtml).join('');
    });

    html += '</div></div>';
    return html;
  }

  function renderDiff(pre) {
    const code = pre.querySelector('code');
    const text = code ? code.textContent : pre.textContent;
    const files = parseUnifiedDiff(text);
    if (!files.length) return false;

    const container = document.createElement('div');
    container.className = 'diff-view';
    container.innerHTML = files.map(fileHtml).join('');
    pre.parentNode.replaceChild(container, pre);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang="diff"], pre code.language-diff').forEach((node) => {
      const pre = node.closest('pre');
      if (!pre || pre.dataset.diffDone) return;
      pre.dataset.diffDone = '1';
      try {
        if (!renderDiff(pre)) delete pre.dataset.diffDone;
      } catch (e) {
        console.error('Diff rendering error:', e);
        delete pre.dataset.diffDone;
      }
    });
  }

  window.MarkdownPreview.renderers.diff = {
    render,
    // 供回归测试直接断言解析结果
    parseUnifiedDiff
  };
})();
