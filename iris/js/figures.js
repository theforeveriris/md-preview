/**
 * 图 / 表自动编号与交叉引用（FIGURES-1）
 *
 * 编号对象（按文档顺序连续编号，跟随界面语言：图 1 / Figure 1）：
 *   - 图：mermaid / plantuml / apexcharts 代码块，以及「独立成段」的图片
 *     （段落里只有这一张图、且无其它文字；整行徽章、画廊多图、行内图标自动排除）
 *   - 表：正文表格（.table-wrapper）
 *   公式不参与编号（避免技术文档里编号过密）。
 *
 * 语法：
 *   - 普通用法：什么也不用写，自动编号
 *   - 别名（供交叉引用）：紧邻上一行写 HTML 注释
 *       <!-- #fig:topology -->            → 生成锚点 #fig:topology
 *       <!-- #tbl:qos 时延与队列对照 -->   → 别名 + 自定义题注
 *   - 交叉引用：标准 Markdown 链接写法（零新语法）
 *       [](#fig:topology)   或   [](#fig-2)
 *     链接文本为空时自动填入「图 2」；点击滚动到目标并高亮，不改变当前文档路由
 *   - 逃逸：给元素（或外层容器）加 class="no-figure" 即跳过编号
 *
 * 题注右侧的复制按钮给出直达链接（形如 #/docs/x.md#fig:topology）。
 *
 * 调用时机：正文渲染完成后（markdown.js 的 afterRender 钩子），此时 wrapTables 已执行；
 * 编号基于占位块在文档中的顺序，因此重型渲染器「可见即渲染」的延迟替换不影响编号稳定性 ——
 * 渲染器替换的是 figure 内部的节点，题注始终在外层。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const FIGURE_LANGS = { mermaid: 1, plantuml: 1, apexcharts: 1 };
  const ALIAS_RE = /^\s*#(fig|tbl):([A-Za-z0-9_\-.]+)(?:\s+([\s\S]*?))?\s*$/;
  const ANCHOR_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

  const aliasToId = new Map();   // 'fig:topology' -> 'fig-3'
  const idToText = new Map();    // 'fig-3' -> '图 3 拓扑示意'

  function captionText(kind, number, title) {
    const label = kind === 'tbl' ? t('figure.table', '表') : t('figure.figure', '图');
    return label + ' ' + number + (title ? ' ' + title : '');
  }

  // 取紧邻上一个非空节点里的 HTML 注释（marked 把独占一行的注释按顶层节点输出）
  function commentBefore(el) {
    let node = el.previousSibling;
    while (node) {
      if (node.nodeType === 3 && !String(node.textContent).trim()) {
        node = node.previousSibling;
        continue;
      }
      if (node.nodeType === 8) return String(node.textContent || '');
      return '';
    }
    return '';
  }

  function parseAlias(text) {
    const m = String(text || '').match(ALIAS_RE);
    if (!m) return null;
    return { kind: m[1], label: m[2], title: (m[3] || '').trim() };
  }

  // 候选块 → { block, kind, title }；返回 null 表示不参与编号
  function classify(el) {
    if (el.closest('.doc-figure') || el.closest('.no-figure')) return null;

    // 1) 图：重型图表代码块（此时仍是占位 pre，渲染器稍后替换其内部节点）
    if (el.tagName === 'PRE') {
      const lang = (el.dataset.lang || '').trim().split(/\s+/)[0];
      if (!FIGURE_LANGS[lang]) return null;
      return { block: el, kind: 'fig', title: '' };
    }

    // 2) 表：正文表格
    if (el.classList && el.classList.contains('table-wrapper')) {
      return { block: el, kind: 'tbl', title: '' };
    }

    // 3) 图：独立成段的图片（段落仅含这一张图且无其它文字）
    if (el.tagName === 'IMG' && el.parentElement && el.parentElement.tagName === 'P') {
      const p = el.parentElement;
      if (p.classList.contains('no-figure') || el.classList.contains('no-figure')) return null;
      if (p.querySelectorAll('img').length !== 1) return null;
      const text = Array.from(p.childNodes)
        .filter(n => !(n.nodeType === 1 && n.nodeName === 'IMG'))
        .map(n => n.textContent)
        .join('')
        .trim();
      if (text) return null;
      return { block: p, kind: 'fig', title: (el.getAttribute('alt') || '').trim() };
    }

    return null;
  }

  function copyText(text, btn) {
    const done = (ok) => {
      if (!btn) return;
      btn.classList.add(ok ? 'copied' : 'failed');
      setTimeout(() => btn.classList.remove('copied', 'failed'), 1200);
    };
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true)).catch(() => done(false));
      return;
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      done(ok);
    } catch (e) {
      done(false);
    }
  }

  function buildFigure(item, number) {
    const figure = document.createElement('figure');
    figure.className = 'doc-figure' + (item.kind === 'tbl' ? ' doc-figure-table' : '');
    figure.id = item.kind + '-' + number;
    figure.dataset.figKind = item.kind;
    figure.dataset.figNumber = String(number);
    figure.dataset.figTitle = item.title || '';

    if (item.alias) {
      const anchor = document.createElement('span');
      anchor.className = 'fig-anchor';
      anchor.id = item.kind + ':' + item.alias;
      figure.appendChild(anchor);
      aliasToId.set(anchor.id, figure.id);
    }

    const caption = document.createElement('figcaption');
    caption.className = 'doc-figure-caption';
    const textEl = document.createElement('span');
    textEl.className = 'doc-figure-text';
    textEl.textContent = captionText(item.kind, number, item.title);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'doc-figure-anchor';
    btn.title = t('figure.copyAnchor', '复制图表锚点链接');
    btn.setAttribute('aria-label', t('figure.copyAnchor', '复制图表锚点链接'));
    btn.innerHTML = ANCHOR_SVG;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const path = window.MarkdownPreview.state.currentFilePath;
      const base = window.location.origin + window.location.pathname;
      copyText(path ? `${base}#/${path}#${figure.id}` : `${base}#${figure.id}`, btn);
    });
    caption.appendChild(textEl);
    caption.appendChild(btn);

    const parent = item.block.parentNode;
    if (!parent) return null;
    parent.insertBefore(figure, item.block);
    // 题注位置遵循惯例：图在下、表在上
    if (item.kind === 'tbl') {
      figure.appendChild(caption);
      figure.appendChild(item.block);
    } else {
      figure.appendChild(item.block);
      figure.appendChild(caption);
    }

    idToText.set(figure.id, textEl.textContent);
    return figure;
  }

  // 空链接 [](#fig:x) → 自动填入「图 N」，并拦截点击（滚动 + 高亮，不改动当前路由）
  function fillReferences(scope) {
    scope.querySelectorAll('a[href^="#"]').forEach(a => {
      if (a.dataset.figRef === '1') return;
      if (String(a.textContent || '').trim()) return;
      const id = (a.getAttribute('href') || '').slice(1);
      if (!/^(fig|tbl)[-:]/.test(id)) return;
      const targetId = idToText.has(id) ? id : aliasToId.get(id);
      if (!targetId || !idToText.has(targetId)) return;
      a.dataset.figRef = '1';
      a.textContent = idToText.get(targetId);
      a.addEventListener('click', (e) => {
        const target = document.getElementById(targetId);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target.classList.add('fig-flash');
        setTimeout(() => target.classList.remove('fig-flash'), 1200);
      });
    });
  }

  // 语言切换后只刷新题注文本（不重新编号）
  function refreshCaptions() {
    document.querySelectorAll('.doc-figure').forEach(figure => {
      const el = figure.querySelector('.doc-figure-text');
      if (!el) return;
      const kind = figure.dataset.figKind === 'tbl' ? 'tbl' : 'fig';
      const number = Number(figure.dataset.figNumber) || 0;
      const title = figure.dataset.figTitle || '';
      el.textContent = captionText(kind, number, title);
      idToText.set(figure.id, el.textContent);
    });
  }

  function afterRender() {
    const scope = document.getElementById('markdownContent');
    if (!scope) return;
    if (scope.querySelector('.doc-figure[data-fig-done]')) return;   // 本页已编号，避免重复

    aliasToId.clear();
    idToText.clear();

    const candidates = scope.querySelectorAll('pre.code-block[data-lang], .table-wrapper, p > img');
    let figNo = 0;
    let tblNo = 0;

    Array.from(candidates).forEach(el => {
      const item = classify(el);
      if (!item) return;
      const alias = parseAlias(commentBefore(item.block));
      if (alias) {
        item.alias = alias.label;
        // 别名类型优先（作者显式声明），未写类型时按实际元素类型
        item.kind = alias.kind;
        if (alias.title) item.title = alias.title;
      }
      const number = item.kind === 'tbl' ? ++tblNo : ++figNo;
      const figure = buildFigure(item, number);
      if (figure) figure.dataset.figDone = '1';
    });

    fillReferences(scope);
  }

  function init() {
    window.addEventListener('langchange', refreshCaptions);
  }

  window.MarkdownPreview.figures = { init: init, afterRender: afterRender };
})();
