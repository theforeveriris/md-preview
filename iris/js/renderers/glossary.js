/**
 * 术语表悬浮解释（CONTENT-1）
 *
 * Markdown 语法（```glossary 代码块，每行一个术语）：
 *   ```glossary
 *   OSPF | 开放最短路径优先，链路状态路由协议
 *   BGP：边界网关协议
 *   ```
 *
 * 渲染时：
 *   1. 代码块替换为「术语表」定义列表；
 *   2. 正文中每个术语的首次出现加下划线样式，鼠标悬浮 / 键盘聚焦弹出解释卡片。
 *
 * 只处理 .markdown-body 内的文本节点，跳过代码、行内代码、链接、标题、
 * 已有术语节点与公式；每个术语仅高亮一次，总量封顶，避免影响性能与观感。
 * 必须最后运行（注册在渲染器末尾），以免被 embedded 等重写 innerHTML 的渲染器冲掉。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const SKIP_TAGS = { CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, KBD: 1, SAMP: 1, A: 1 };
  const SKIP_CLASSES = ['katex', 'mermaid-diagram', 'glossary-term', 'glossary-list', 'no-cjk-convert'];
  const MAX_MARKS = 300;

  let cardEl = null;
  let activeTerm = null;

  function parseGlossary(code) {
    const terms = [];
    (code || '').split('\n').forEach(line => {
      const s = line.trim();
      if (!s) return;
      let idx = s.indexOf('|');
      if (idx < 0) idx = s.indexOf('：');
      if (idx < 0) idx = s.indexOf(':');
      if (idx < 0) return;
      const term = s.slice(0, idx).trim();
      const desc = s.slice(idx + 1).trim();
      if (term && desc) terms.push({ term, desc });
    });
    // 长词优先，避免短词先命中
    terms.sort((a, b) => b.term.length - a.term.length);
    return terms;
  }

  function shouldSkip(node) {
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS[el.tagName]) return true;
      if (/^H[1-6]$/.test(el.tagName)) return true;
      if (el.classList) {
        for (let i = 0; i < SKIP_CLASSES.length; i++) {
          if (el.classList.contains(SKIP_CLASSES[i])) return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  }

  function collectTextNodes(scope) {
    const out = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (shouldSkip(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function markTerms(scope, terms) {
    if (!terms.length) return;
    const nodes = collectTextNodes(scope);
    const remaining = new Set(terms.map(x => x.term));
    let count = 0;
    for (const node of nodes) {
      if (count >= MAX_MARKS || remaining.size === 0) break;
      for (const item of terms) {
        if (!remaining.has(item.term)) continue;
        const idx = node.nodeValue.indexOf(item.term);
        if (idx === -1) continue;
        const after = node.splitText(idx);
        const mid = after.splitText(item.term.length);
        const span = document.createElement('span');
        span.className = 'glossary-term';
        span.dataset.desc = item.desc;
        span.tabIndex = 0;
        span.textContent = item.term;
        after.parentNode.replaceChild(span, mid);
        remaining.delete(item.term);
        count++;
        break; // 每个文本节点只处理一个命中，避免索引错乱
      }
    }
  }

  // ---------- 悬浮卡片 ----------
  function ensureCard() {
    if (cardEl) return cardEl;
    cardEl = document.createElement('div');
    cardEl.className = 'glossary-card';
    cardEl.setAttribute('role', 'tooltip');
    document.body.appendChild(cardEl);
    return cardEl;
  }

  function positionCard(termEl) {
    if (!cardEl || !termEl) return;
    const rect = termEl.getBoundingClientRect();
    cardEl.style.left = '0px';
    cardEl.style.top = '0px';
    const w = cardEl.offsetWidth;
    const h = cardEl.offsetHeight;
    let x = rect.left;
    let y = rect.bottom + 8;
    if (x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
    if (y + h > window.innerHeight - 8) y = rect.top - h - 8;
    cardEl.style.left = Math.max(8, x) + 'px';
    cardEl.style.top = Math.max(8, y) + 'px';
  }

  function showCard(termEl) {
    const card = ensureCard();
    activeTerm = termEl;
    card.innerHTML = '<div class="glossary-card-term"></div><div class="glossary-card-desc"></div>';
    card.querySelector('.glossary-card-term').textContent = termEl.textContent;
    card.querySelector('.glossary-card-desc').textContent = termEl.dataset.desc || '';
    positionCard(termEl);
    card.classList.add('open');
  }

  function hideCard() {
    activeTerm = null;
    if (cardEl) cardEl.classList.remove('open');
  }

  function initCardEvents() {
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest('.glossary-term');
      if (el) showCard(el);
    });
    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest && e.target.closest('.glossary-term');
      if (el && el === activeTerm) {
        // 移向卡片本身时保持显示
        setTimeout(() => { if (cardEl && cardEl.matches(':hover')) return; hideCard(); }, 120);
      }
    });
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest && e.target.closest('.glossary-term');
      if (el) showCard(el);
    });
    document.addEventListener('focusout', hideCard);
    window.addEventListener('scroll', hideCard, true);
    window.addEventListener('resize', hideCard);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideCard(); }, true);
  }

  function buildList(terms) {
    const items = terms.map(x =>
      `<div class="glossary-list-item"><dt>${esc(x.term)}</dt><dd>${esc(x.desc)}</dd></div>`
    ).join('');
    return `<div class="glossary-list"><div class="glossary-list-title">${esc(t('glossary.title', '术语表'))}</div><dl>${items}</dl></div>`;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang="glossary"]');
    if (!blocks.length) return;
    let allTerms = [];
    blocks.forEach(pre => {
      if (pre.dataset.glossaryDone) return;
      pre.dataset.glossaryDone = '1';
      const code = pre.querySelector('code');
      const terms = parseGlossary(code ? code.textContent : '');
      if (!terms.length) return;
      allTerms = allTerms.concat(terms);
      const holder = document.createElement('div');
      holder.innerHTML = buildList(terms);
      pre.parentNode.replaceChild(holder.firstChild, pre);
    });
    if (allTerms.length) {
      markTerms(scope, allTerms);
      initCardEvents();
    }
  }

  window.MarkdownPreview.renderers.glossary = { render };
})();
