/**
 * steps / quote / orgchart 语法糖渲染器（第四轮三件套）
 *
 *   ```steps            教学逐步揭示：`序号 | 标题 | 详情`，点击展开
 *   ```quote            引用卡片：`引文 | 出处`，空行分隔多条
 *   ```orgchart         架构图语法糖：缩进文本 → mermaid graph TD
 *                       （先于 mermaid 渲染器执行，注入后由其接管）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // ============== steps：逐步点击展开 ==============

  function renderSteps(pre) {
    const lines = String(pre.querySelector('code')?.textContent ?? '')
      .split('\n').map(l => l.trim()).filter(Boolean);
    const steps = lines.map(l => l.split('|').map(s => s.trim())).filter(p => p.length >= 2);
    if (steps.length === 0) return false;

    const widget = document.createElement('div');
    widget.className = 'steps-widget';
    widget.innerHTML = steps.map((p, i) => `
      <div class="steps-item" data-i="${i}">
        <button type="button" class="steps-head" aria-expanded="false">
          <span class="steps-num">${esc(p[0] || String(i + 1))}</span>
          <span class="steps-title">${esc(p[1])}</span>
          <span class="steps-chevron"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#i-chevron-down"/></svg></span>
        </button>
        <div class="steps-body" hidden>${p[2] ? esc(p[2]) : ''}</div>
      </div>`).join('');

    widget.querySelectorAll('.steps-head').forEach(head => {
      head.addEventListener('click', () => {
        const item = head.closest('.steps-item');
        const body = item.querySelector('.steps-body');
        const open = !body.hidden;
        body.hidden = open;
        head.setAttribute('aria-expanded', String(!open));
        item.classList.toggle('steps-open', !open);
      });
    });

    pre.parentNode.replaceChild(widget, pre);
    return true;
  }

  // ============== quote：带出处署名的引用卡片 ==============

  function renderQuote(pre) {
    const blocks = String(pre.querySelector('code')?.textContent ?? '')
      .split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
    if (blocks.length === 0) return false;

    const widget = document.createElement('div');
    widget.className = 'quote-cards';
    widget.innerHTML = blocks.map(block => {
      const parts = block.split('|');
      const text = parts[0].trim();
      const author = parts.length > 1 ? parts.slice(1).join('|').trim() : '';
      return `<figure class="quote-card">
        <span class="quote-mark">“</span>
        <blockquote>${esc(text)}</blockquote>
        ${author ? `<figcaption>— ${esc(author)}</figcaption>` : ''}
      </figure>`;
    }).join('');

    pre.parentNode.replaceChild(widget, pre);
    return true;
  }

  // ============== orgchart：缩进文本 → mermaid ==============

  function renderOrgChart(pre) {
    const lines = String(pre.querySelector('code')?.textContent ?? '')
      .split('\n');
    const nodes = [];
    lines.forEach(line => {
      if (!line.trim() || line.trim().startsWith('//')) return;
      const indent = line.match(/^\s*/)[0].length;
      const label = line.trim().replace(/^-\s*/, '');
      if (!label) return;
      nodes.push({ indent, label });
    });
    if (nodes.length < 2) return false; // 至少根 + 一个子节点

    const out = ['graph TD'];
    const stack = [{ indent: -1, id: 'N0' }];
    let counter = 0;
    nodes.forEach((node, i) => {
      counter++;
      const id = 'N' + counter;
      while (stack.length > 1 && stack[stack.length - 1].indent >= node.indent) stack.pop();
      const parentId = stack[stack.length - 1].id;
      out.push(`  ${id}[${node.label.replace(/[[\]{}()]/g, ' ')}]`);
      if (parentId) out.push(`  ${parentId} --> ${id}`);
      stack.push({ indent: node.indent, id });
    });

    const newPre = document.createElement('pre');
    newPre.className = 'code-block';
    newPre.dataset.lang = 'mermaid';
    const code = document.createElement('code');
    code.className = 'language-mermaid';
    code.textContent = out.join('\n');
    newPre.appendChild(code);
    // mermaid 渲染器按 code.language-mermaid 接管（本渲染器先于其执行）
    pre.parentNode.replaceChild(newPre, pre);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      try {
        if (lang === 'steps') renderSteps(pre);
        else if (lang === 'quote') renderQuote(pre);
        else if (lang === 'orgchart') renderOrgChart(pre);
      } catch (e) { /* 保留源码 */ }
    });
  }

  window.MarkdownPreview.renderers.steps = { render };
})();
