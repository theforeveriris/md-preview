/**
 * config-diff - 配置语义 diff 渲染器
 *
 * Markdown 语法（第二 token 可选 ios/vrp，默认 ios）：
 *   ```config-diff ios
 *   interface GigabitEthernet0/0
 *    ip address 10.1.1.1 255.255.255.0
 *   ===升配后
 *   interface GigabitEthernet0/0
 *    ip address 10.1.1.1 255.255.255.252
 *   ```
 *
 * `===分隔线(可选标签)` 把两份配置隔开，各按缩进层级解析成命令树
 * （IOS/VRP 的 interface/aaa 等块状结构），以「祖先命令链」为路径做集合
 * 对比——语义对齐而非行对齐：同一条命令挪了位置不误报，改了参数成对
 * 呈现 −旧 +新。升配/迁移 review 场景。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // ============== 配置解析 ==============

  // 跳过空行与 ! 注释（IOS），保留缩进结构
  function parseConfigTree(text) {
    const root = { line: '', children: [] };
    const stack = [{ indent: -1, node: root }];
    String(text || '').split('\n').forEach(raw => {
      const line = raw.replace(/\r/g, '');
      const trimmed = line.trim();
      if (!trimmed || trimmed === '!') return;
      const indent = line.match(/^\s*/)[0].length;
      const node = { line: trimmed, children: [] };
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      stack[stack.length - 1].node.children.push(node);
      stack.push({ indent, node });
    });
    return root;
  }

  // 展开为叶子命令路径（祖先命令链），路径即语义身份
  function flattenPaths(node, prefix, out) {
    node.children.forEach(child => {
      const path = prefix.concat(child.line);
      if (child.children.length === 0) out.push(path);
      else flattenPaths(child, path, out);
    });
    return out;
  }

  // ============== diff ==============

  function diffConfigs(beforeText, afterText) {
    const before = flattenPaths(parseConfigTree(beforeText), [], []);
    const after = flattenPaths(parseConfigTree(afterText), [], []);
    const keyOf = path => path.join('\u0001');
    const afterMap = new Map(after.map(p => [keyOf(p), p]));
    const beforeMap = new Map(before.map(p => [keyOf(p), p]));
    const removed = before.filter(p => !afterMap.has(keyOf(p)));
    const added = after.filter(p => !beforeMap.has(keyOf(p)));
    return { removed, added };
  }

  // 变更叶子按顶层命令分组排序渲染
  function renderEntries(paths, cls, sign) {
    return paths.map(path => {
      const depth = path.length - 1;
      const indent = depth > 0 ? `style="padding-left:${10 + depth * 14}px"` : '';
      return `<div class="cfgdiff-entry cfgdiff-${cls}" ${indent}><span class="cfgdiff-sign">${sign}</span><code>${path.map(esc).join(' <span class="cfgdiff-sep">›</span> ')}</code></div>`;
    }).join('');
  }

  // ============== 渲染 ==============

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      const parts = lang.split(/\s+/);
      if (parts[0] !== 'config-diff') return;
      const flavor = parts[1] || 'ios';
      const beforeLabel = t('cfgdiff.before', '变更前') + `（${flavor}）`;
      const afterLabel = t('cfgdiff.after', '变更后');

      const body = pre.querySelector('code')?.textContent ?? '';
      // ===分隔线：前段 before，后段 after（分隔线后的剩余文字作为 after 标签）
      const segs = body.split(/\n[ \t]*={3,}[ \t]*(.*)$/m);
      if (segs.length < 3) return; // 没有分隔线：保留源码走高亮
      const beforeText = segs[0];
      const customAfterLabel = (segs[1] || '').trim();
      const afterText = segs.slice(2).join('\n');

      const { removed, added } = diffConfigs(beforeText, afterText);
      if (removed.length === 0 && added.length === 0) return; // 无差异

      const widget = document.createElement('div');
      widget.className = 'cfgdiff-widget';
      widget.innerHTML = `
        <div class="cfgdiff-head">
          <span class="cfgdiff-flavor">${esc(flavor.toUpperCase())}</span>
          <span class="cfgdiff-summary">
            <span class="cfgdiff-add-count">+${added.length}</span>
            <span class="cfgdiff-del-count">−${removed.length}</span>
          </span>
        </div>
        <div class="cfgdiff-cols">
          <div class="cfgdiff-col">
            <div class="cfgdiff-col-title">${esc(customAfterLabel || afterLabel)}</div>
            ${renderEntries(added, 'add', '+') || `<div class="cfgdiff-none">${esc(t('cfgdiff.none', '无'))}</div>`}
          </div>
          <div class="cfgdiff-col">
            <div class="cfgdiff-col-title">${esc(beforeLabel)}</div>
            ${renderEntries(removed, 'del', '−') || `<div class="cfgdiff-none">${esc(t('cfgdiff.none', '无'))}</div>`}
          </div>
        </div>`;
      pre.parentNode.replaceChild(widget, pre);
    });
  }

  window.MarkdownPreview.renderers.configdiff = { render };
})();
