/**
 * JSON 树搜索 / JSONPath（B2）
 *
 * 在 json-tree 渲染器生成的 `.json-tree` 部件上追加工具条：
 *   - 关键字搜索：高亮所有匹配的叶子节点并统计命中数
 *   - JSONPath 查询：支持 $ .name ['name'] [n] [*] .* 与 ..name 递归下降
 *   - 命中节点自动展开，再次查询清除高亮
 *
 * 幂等：data-json-search-ready 标记。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // ============== 迷你 JSONPath ==============
  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    const src = String(expr || '');
    if (src[0] !== '$') return null;
    i = 1;
    while (i < src.length) {
      const c = src[i];
      if (c === '.') {
        if (src[i + 1] === '.') { tokens.push({ t: 'descendant' }); i += 2; continue; }
        i++;
        let name = '';
        while (i < src.length && /[\w$\-]/.test(src[i])) { name += src[i]; i++; }
        if (!name) return null;
        tokens.push({ t: 'key', v: name });
      } else if (/[\w$\-]/.test(c)) {
        // ..key 形式：递归下降后紧跟键名，无需再写点
        let name = '';
        while (i < src.length && /[\w$\-]/.test(src[i])) { name += src[i]; i++; }
        if (!name) return null;
        tokens.push({ t: 'key', v: name });
      } else if (c === '[') {
        const end = src.indexOf(']', i);
        if (end === -1) return null;
        const inner = src.slice(i + 1, end).trim();
        i = end + 1;
        if (inner === '*') tokens.push({ t: 'wildcard' });
        else if (/^\d+$/.test(inner)) tokens.push({ t: 'index', v: parseInt(inner, 10) });
        else if (/^['"]/.test(inner)) tokens.push({ t: 'key', v: inner.slice(1, -1) });
        else return null;
      } else if (c === '*') {
        tokens.push({ t: 'wildcard' });
        i++;
      } else {
        return null;
      }
    }
    return tokens;
  }

  function evalJsonPath(data, expr) {
    const tokens = tokenize(expr);
    if (!tokens) return [];
    let current = [{ path: '$', value: data, node: null }];
    for (const tok of tokens) {
      const next = [];
      current.forEach(item => {
        const v = item.value;
        if (tok.t === 'key') {
          if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, tok.v)) {
            next.push({ path: item.path + '.' + tok.v, value: v[tok.v] });
          }
        } else if (tok.t === 'index') {
          if (Array.isArray(v) && tok.v >= 0 && tok.v < v.length) {
            next.push({ path: item.path + '[' + tok.v + ']', value: v[tok.v] });
          }
        } else if (tok.t === 'wildcard') {
          if (Array.isArray(v)) {
            v.forEach((x, i) => next.push({ path: item.path + '[' + i + ']', value: x }));
          } else if (v && typeof v === 'object') {
            Object.keys(v).forEach(k => next.push({ path: item.path + '.' + k, value: v[k] }));
          }
        } else if (tok.t === 'descendant') {
          const stack = [{ path: item.path, value: v }];
          while (stack.length) {
            const cur = stack.pop();
            if (cur.value && typeof cur.value === 'object') {
              if (Array.isArray(cur.value)) {
                cur.value.forEach((x, i) => stack.push({ path: cur.path + '[' + i + ']', value: x }));
              } else {
                Object.keys(cur.value).forEach(k => stack.push({ path: cur.path + '.' + k, value: cur.value[k] }));
              }
            }
          }
          // descendant 自身也作为一个匹配点，交由后续 token 消费
          if (!tok.nextIsKey) {
            current = stack;
            return;
          }
        }
      });
      current = next;
    }
    return current;
  }

  // 解析 expr 里的 descendant：真正需要 ..key 语义，重新实现一个更直接的递归版
  function queryJsonPath(data, expr) {
    const tokens = tokenize(expr);
    if (!tokens) return [];
    // 把 descendant 拆成 [descendant, key]
    const steps = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].t === 'descendant' && tokens[i + 1] && tokens[i + 1].t === 'key') {
        steps.push({ t: 'recurse', key: tokens[i + 1].v });
        i++;
      } else if (tokens[i].t === 'descendant') {
        steps.push({ t: 'recurseAll' });
      } else {
        steps.push(tokens[i]);
      }
    }
    let current = [{ path: '$', value: data }];
    for (const tok of steps) {
      const next = [];
      current.forEach(item => {
        const v = item.value;
        if (tok.t === 'key') {
          if (v && typeof v === 'object' && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, tok.v)) {
            next.push({ path: item.path + '.' + tok.v, value: v[tok.v] });
          }
        } else if (tok.t === 'index') {
          if (Array.isArray(v) && tok.v >= 0 && tok.v < v.length) {
            next.push({ path: item.path + '[' + tok.v + ']', value: v[tok.v] });
          }
        } else if (tok.t === 'wildcard') {
          if (Array.isArray(v)) v.forEach((x, i) => next.push({ path: item.path + '[' + i + ']', value: x }));
          else if (v && typeof v === 'object') Object.keys(v).forEach(k => next.push({ path: item.path + '.' + k, value: v[k] }));
        } else if (tok.t === 'recurse') {
          collectRecursive(v, tok.key).forEach(r => next.push({ path: r.path, value: r.value }));
        } else if (tok.t === 'recurseAll') {
          collectAll(v).forEach(r => next.push({ path: r.path, value: r.value }));
        }
      });
      current = next;
    }
    return current;
  }

  function collectRecursive(value, key, prefix) {
    const out = [];
    prefix = prefix || '$';
    if (value && typeof value === 'object') {
      if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key)) {
        out.push({ path: prefix + '.' + key, value: value[key] });
      }
      if (Array.isArray(value)) {
        value.forEach((x, i) => out.push(...collectRecursive(x, key, prefix + '[' + i + ']')));
      } else {
        Object.keys(value).forEach(k => out.push(...collectRecursive(value[k], key, prefix + '.' + k)));
      }
    }
    return out;
  }

  function collectAll(value, prefix) {
    const out = [];
    prefix = prefix || '$';
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach((x, i) => { out.push({ path: prefix + '[' + i + ']', value: x }); out.push(...collectAll(x, prefix + '[' + i + ']')); });
      } else {
        Object.keys(value).forEach(k => { out.push({ path: prefix + '.' + k, value: value[k] }); out.push(...collectAll(value[k], prefix + '.' + k)); });
      }
    }
    return out;
  }

  // ============== UI ==============
  function getData(widget) {
    const raw = widget.querySelector('.json-tree-info')?.textContent;
    if (!raw) return null;
    return raw;
  }

  function clearHits(widget) {
    widget.querySelectorAll('.json-hit').forEach(n => n.classList.remove('json-hit'));
  }

  function applyHits(widget, predicate, label) {
    clearHits(widget);
    let count = 0;
    widget.querySelectorAll('.json-node').forEach(node => {
      const line = node.querySelector(':scope > .json-line');
      if (!line) return;
      // 叶子节点：值文本；分支：键名
      const valueEl = line.querySelector('.json-value');
      const keyEl = line.querySelector('.json-key');
      const text = valueEl ? valueEl.textContent : (keyEl ? keyEl.textContent : '');
      if (predicate(text, node)) {
        node.classList.add('json-hit');
        if (count === 0) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        count++;
        // 展开祖先
        let p = node.parentElement;
        while (p && p !== widget) {
          if (p.classList.contains('json-node')) {
            p.classList.remove('json-collapsed');
            const tg = p.querySelector(':scope > .json-line > .json-toggle');
            if (tg) tg.setAttribute('aria-expanded', 'true');
          }
          p = p.parentElement;
        }
      }
    });
    const badge = widget.querySelector('.json-hit-count');
    if (badge) badge.textContent = count ? count + ' ' + label : '';
    return count;
  }

  function enhance(widget) {
    if (widget.dataset.jsonSearchReady) return;
    const toolbar = widget.querySelector('.json-tree-toolbar');
    if (!toolbar) return;
    widget.dataset.jsonSearchReady = '1';

    // 需要原始数据：从源码 pre 已丢失，这里保存到 dataset 由渲染器注入
    const data = widget.__jsonData;
    if (data == null) return;

    const actions = toolbar.querySelector('.json-tree-actions');
    const controls = document.createElement('span');
    controls.className = 'json-tree-controls';
    controls.innerHTML =
      '<span class="json-tree-search">' +
        '<input type="search" class="json-tree-search-input" placeholder="' + esc(t('json.search', '搜索…')) + '" aria-label="' + esc(t('json.search', '搜索')) + '">' +
      '</span>' +
      '<span class="json-tree-path">' +
        '<input type="text" class="json-tree-path-input" placeholder="' + esc(t('json.jsonpath', 'JSONPath')) + '" aria-label="' + esc(t('json.jsonpath', 'JSONPath')) + '">' +
        '<button type="button" class="json-tree-path-btn">' + esc(t('json.run', '运行')) + '</button>' +
      '</span>' +
      '<span class="json-hit-count" aria-live="polite"></span>';
    if (actions) toolbar.insertBefore(controls, actions);
    else toolbar.appendChild(controls);

    const searchInput = toolbar.querySelector('.json-tree-search-input');
    const pathInput = toolbar.querySelector('.json-tree-path-input');

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { clearHits(widget); const b = widget.querySelector('.json-hit-count'); if (b) b.textContent = ''; return; }
      applyHits(widget, text => text.toLowerCase().includes(q), t('json.matches', '命中'));
    });
    pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { runPath(); }
    });
    toolbar.querySelector('.json-tree-path-btn').addEventListener('click', runPath);
    function runPath() {
      const expr = pathInput.value.trim();
      if (!expr) return;
      const results = queryJsonPath(data, expr);
      clearHits(widget);
      const paths = results.map(r => r.path);
      const nodeMap = widget.__jsonNodes || new Map();
      if (!paths.length) {
        const b = widget.querySelector('.json-hit-count');
        if (b) b.textContent = t('json.noMatch', '无匹配');
        return;
      }
      let count = 0;
      paths.forEach(p => {
        const node = nodeMap.get(p);
        if (!node) return;
        node.classList.add('json-hit');
        count++;
        if (count === 1) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        let anc = node.parentElement;
        while (anc && anc !== widget) {
          if (anc.classList.contains('json-node')) { anc.classList.remove('json-collapsed'); const tg = anc.querySelector(':scope > .json-line > .json-toggle'); if (tg) tg.setAttribute('aria-expanded', 'true'); }
          anc = anc.parentElement;
        }
      });
      const b = widget.querySelector('.json-hit-count');
      if (b) b.textContent = count + ' ' + t('json.results', '结果') + ' · ' + paths[0];
    }
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('.json-tree').forEach(enhance);
  }

  window.MarkdownPreview.renderers.jsonsearch = { render, queryJsonPath, tokenize };
})();
