/**
 * JSON 可折叠树渲染器
 *
 * Markdown 语法：
 *   ```json
 *   { "name": "md-preview", "tags": ["a", "b"] }
 *   ```
 *
 * 渲染为可交互的折叠树：
 *   - 节点点击折叠 / 展开，折叠时显示键数（或元素数）徽章
 *   - 悬停节点出现「复制路径」按钮（点号路径，非标识符键用方括号）
 *   - 工具栏：全部展开 / 全部收起、复制 JSON、下载 .json
 *   - 解析失败或超大 JSON 自动回退为普通代码块高亮
 *
 * 由 markdown.js 渲染管线在文档渲染后调用 render()（与 csvtable 同链）。
 * 仅处理文档正文（.markdown-body）内的 ```json 代码块。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // 超限回退：体积或节点数过大的 JSON 树交互意义不大且有卡顿风险
  const MAX_BYTES = 256 * 1024;
  const MAX_NODES = 5000;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function icon(name, size) {
    return `<svg width="${size || 14}" height="${size || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // ============== 路径格式化 ==============
  // 标识符键用 a.b.c，其余用 a["b-c"][0]
  function formatPath(path) {
    if (path.length === 0) return '$';
    return path.reduce((acc, seg) => {
      if (typeof seg === 'number') return `${acc}[${seg}]`;
      return /^[A-Za-z_$][\w$]*$/.test(seg) ? (acc ? acc + '.' + seg : seg) : `${acc}[${JSON.stringify(seg)}]`;
    }, '');
  }

  // ============== 树构建 ==============
  let nodeCount = 0;

  function countNodes(value) {
    if (nodeCount > MAX_NODES) return nodeCount;
    if (value && typeof value === 'object') {
      nodeCount++;
      const children = Array.isArray(value) ? value : Object.keys(value).map(k => value[k]);
      children.forEach(countNodes);
    }
    return nodeCount;
  }

  function valuePreview(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  function typeClass(value) {
    if (value === null) return 'json-null';
    if (Array.isArray(value)) return 'json-array';
    if (typeof value === 'object') return 'json-object';
    return typeof value; // string / number / boolean
  }

  function summarize(value) {
    if (Array.isArray(value)) return t('json.items', '{n} 项').replace('{n}', value.length);
    return t('json.keys', '{n} 个键').replace('{n}', Object.keys(value).length);
  }

  function buildNode(key, value, path) {
    const li = document.createElement('div');
    li.className = 'json-node';

    const isBranch = value !== null && typeof value === 'object';
    const line = document.createElement('div');
    line.className = 'json-line';
    let toggle = null;

    if (isBranch) {
      toggle = document.createElement('button');
      toggle.className = 'json-toggle';
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.innerHTML = icon('i-chevron-down', 12);
      line.appendChild(toggle);
    } else {
      const indent = document.createElement('span');
      indent.className = 'json-toggle-spacer';
      line.appendChild(indent);
    }

    if (key !== null) {
      const keyEl = document.createElement('span');
      keyEl.className = 'json-key';
      keyEl.textContent = typeof key === 'number' ? `${key}:` : key;
      line.appendChild(keyEl);
    }

    if (isBranch) {
      const bracket = document.createElement('span');
      bracket.className = 'json-bracket';
      bracket.textContent = Array.isArray(value) ? '[' : '{';
      line.appendChild(bracket);

      const badge = document.createElement('span');
      badge.className = 'json-badge';
      badge.textContent = summarize(value);
      line.appendChild(badge);

      const children = document.createElement('div');
      children.className = 'json-children';
      const entries = Array.isArray(value)
        ? value.map((v, i) => [i, v])
        : Object.keys(value).map(k => [k, value[k]]);
      entries.forEach(([k, v]) => children.appendChild(buildNode(k, v, path.concat(k))));

      const closeBracket = document.createElement('span');
      closeBracket.className = 'json-bracket json-bracket-close';
      closeBracket.textContent = Array.isArray(value) ? ']' : '}';
      children.appendChild(closeBracket);

      li.appendChild(line);
      li.appendChild(children);

      toggle.addEventListener('click', () => setCollapsed(li, !li.classList.contains('json-collapsed')));
    } else {
      const val = document.createElement('span');
      val.className = `json-value ${typeClass(value)}`;
      val.textContent = valuePreview(value);
      line.appendChild(val);
      li.appendChild(line);
    }

    // 复制路径按钮（悬停显示）
    const copyPath = document.createElement('button');
    copyPath.className = 'json-copy-path';
    copyPath.type = 'button';
    copyPath.title = t('json.copyPath', '复制路径');
    copyPath.innerHTML = icon('i-copy', 12);
    copyPath.addEventListener('click', (e) => {
      e.stopPropagation();
      copyTextToClipboard(formatPath(path));
      copyPath.classList.add('done');
      setTimeout(() => copyPath.classList.remove('done'), 800);
    });
    line.appendChild(copyPath);

    return li;
  }

  function setCollapsed(node, collapsed) {
    const toggle = node.querySelector(':scope > .json-line > .json-toggle');
    node.classList.toggle('json-collapsed', collapsed);
    if (toggle) toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  function setAllCollapsed(root, collapsed) {
    root.querySelectorAll('.json-node').forEach(n => {
      // 只折叠分支节点（有 toggle 的）
      if (n.querySelector(':scope > .json-line > .json-toggle')) setCollapsed(n, collapsed);
    });
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    ta.remove();
  }

  function download(name, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function docSlug() {
    const st = window.MarkdownPreview.state;
    const name = (st && (st.currentFilePath || (st.localDoc && st.localDoc.name))) || 'data';
    return String(name).replace(/^.*\//, '').replace(/\.md$/i, '') || 'data';
  }

  // ============== 入口：替换文档内的 json 代码块 ==============
  // fence 信息串追加 raw 标记（```json raw）可强制保留代码块展示
  function render(root) {
    const scope = root || document;
    const blocks = scope.querySelectorAll('.markdown-body pre.code-block[data-lang]');
    blocks.forEach(pre => {
      if (pre.dataset.jsonDone) return;
      const parts = String(pre.dataset.lang || '').toLowerCase().trim().split(/\s+/);
      if (parts[0] !== 'json') return;
      if (parts.includes('raw')) return;
      const code = pre.querySelector('code');
      if (!code) return;
      const text = code.textContent;
      if (!text.trim() || text.length > MAX_BYTES) return; // 超限保留代码块

      let data;
      try { data = JSON.parse(text); } catch (e) { return; } // 解析失败保留代码块
      nodeCount = 0;
      if (countNodes(data) > MAX_NODES) return;
      pre.dataset.jsonDone = '1';

      const widget = document.createElement('div');
      widget.className = 'json-tree';

      const toolbar = document.createElement('div');
      toolbar.className = 'json-tree-toolbar';
      toolbar.innerHTML = `
        <span class="json-tree-lang">JSON</span>
        <span class="json-tree-info">${summarizeRoot(data)}</span>
        <span class="json-tree-actions">
          <button type="button" class="json-tree-btn" data-act="collapse">${icon('i-chevron-down')}<span>${t('json.collapseAll', '收起')}</span></button>
          <button type="button" class="json-tree-btn" data-act="expand">${icon('i-chevron-up')}<span>${t('json.expandAll', '展开')}</span></button>
          <button type="button" class="json-tree-btn" data-act="copy">${icon('i-copy')}<span>${t('json.copyJson', '复制 JSON')}</span></button>
          <button type="button" class="json-tree-btn" data-act="download">${icon('i-download')}<span>${t('json.download', '下载 .json')}</span></button>
        </span>
      `;

      const tree = document.createElement('div');
      tree.className = 'json-tree-body';
      tree.appendChild(buildNode(null, data, []));

      toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'expand') setAllCollapsed(tree, false);
        else if (act === 'collapse') setAllCollapsed(tree, true);
        else if (act === 'copy') copyTextToClipboard(JSON.stringify(data, null, 2));
        else if (act === 'download') download(`${docSlug()}.json`, JSON.stringify(data, null, 2));
      });

      widget.appendChild(toolbar);
      widget.appendChild(tree);
      pre.parentNode.replaceChild(widget, pre);
    });
  }

  function summarizeRoot(data) {
    if (Array.isArray(data)) return t('json.rootArray', '根数组 · {n} 项').replace('{n}', data.length);
    if (data !== null && typeof data === 'object') return t('json.rootObject', '根对象 · {n} 个键').replace('{n}', Object.keys(data).length);
    return '';
  }

  window.MarkdownPreview.renderers.jsontree = { render };
})();
