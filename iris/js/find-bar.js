/**
 * find-bar - 文章内查找条
 *
 * 接管 Ctrl/⌘ + F（ui.js 守卫后转入），对当前文档正文做就地查找：
 * 全部命中高亮 + 上/下跳转 + 「当前/总数」计数，替代浏览器原生查找的
 * 突兀遮罩。Esc 关闭、Enter / Shift+Enter 翻转命中、F3 / Shift+F3 同义。
 *
 * 设计：
 *   - 高亮用 <mark class="find-hit"> 包裹文本节点（TreeWalker 逐段扫描，
 *     大小写不敏感），命中数封顶防长文卡顿
 *   - 文档重渲染（切页/本地文档）由 markdown.js 调 onDocRendered() 通知，
 *     查找条开着时自动重跑当前关键词
 *   - 编辑器模式 / 输入控件 / 设置面板内 Ctrl+F 不接管（ui.js 守卫链）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const MAX_HITS = 500;
  const DEBOUNCE_MS = 150;

  let barEl = null, inputEl = null, countEl = null;
  let hits = [];
  let currentIndex = -1;
  let debounceTimer = 0;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function isOpen() { return !!(barEl && barEl.classList.contains('open')); }

  // 正文容器：必须用文章节点本身。双栏对照的 .split-pane-body 也带
  // .markdown-body 类且在 DOM 中位于正文之前，通配类选择器会命中空容器
  function bodyContainer() {
    const dom = window.MarkdownPreview.dom;
    if (dom && dom.markdownContent) return dom.markdownContent;
    return document.getElementById('markdownContent');
  }

  // ============== 高亮标记 ==============

  function clearMarks() {
    document.querySelectorAll('mark.find-hit').forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    });
    hits = [];
    currentIndex = -1;
  }

  function wrapRange(textNode, start, length) {
    const mark = document.createElement('mark');
    mark.className = 'find-hit';
    // 先切尾部再切头部：两次 split 后中段即为命中文本，替换为 <mark>
    textNode.splitText(start + length);
    const hitText = textNode.splitText(start);
    mark.appendChild(document.createTextNode(hitText.textContent));
    hitText.parentNode.replaceChild(mark, hitText);
  }

  function runSearch(query) {
    clearMarks();
    const root = bodyContainer();
    if (!root || !query) { updateCount(); return; }
    const q = query.toLowerCase();

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') return NodeFilter.FILTER_REJECT;
        if (parent.closest('.find-bar')) return NodeFilter.FILTER_REJECT;
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const pending = [];
    let node;
    while ((node = walker.nextNode()) && pending.length < MAX_HITS) {
      const text = node.nodeValue;
      const lower = text.toLowerCase();
      let idx = lower.indexOf(q);
      while (idx !== -1 && pending.length < MAX_HITS) {
        pending.push([node, idx, q.length]);
        idx = lower.indexOf(q, idx + q.length);
      }
    }

    // 倒序处理：splitText 会拆出新的后段节点，倒序保证索引不失效
    for (let i = pending.length - 1; i >= 0; i--) {
      const [node, start, len] = pending[i];
      // 节点可能已被前一次拆分替换，按内容重新校验
      if (!node.parentNode) continue;
      wrapRange(node, start, len);
    }

    hits = [...document.querySelectorAll('mark.find-hit')];
    currentIndex = hits.length > 0 ? 0 : -1;
    if (hits.length > 0) hits[0].classList.add('current');
    updateCount();
    if (hits.length > 0) hits[0].scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  function updateCount() {
    if (!countEl) return;
    if (!inputEl.value) { countEl.textContent = ''; return; }
    if (hits.length === 0) {
      countEl.textContent = t('find.noResult', '无结果');
      return;
    }
    const capped = hits.length >= MAX_HITS ? `${MAX_HITS}+` : String(hits.length);
    countEl.textContent = `${currentIndex + 1}/${capped}`;
  }

  function step(delta) {
    if (hits.length === 0) return;
    hits[currentIndex] && hits[currentIndex].classList.remove('current');
    currentIndex = (currentIndex + delta + hits.length) % hits.length;
    const mark = hits[currentIndex];
    mark.classList.add('current');
    updateCount();
    mark.scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  // ============== 开关 ==============

  function open() {
    ensure();
    barEl.classList.add('open');
    barEl.setAttribute('aria-hidden', 'false');
    inputEl.focus();
    inputEl.select();
    if (inputEl.value) runSearch(inputEl.value.trim());
    else updateCount();
  }

  function close() {
    if (!barEl) return;
    barEl.classList.remove('open');
    barEl.setAttribute('aria-hidden', 'true');
    clearMarks();
  }

  function toggle() { isOpen() ? close() : open(); }

  // 文档重渲染后由 markdown.js 通知：清掉旧标记；查找条开着则重跑
  function onDocRendered() {
    if (!barEl) return;
    const hadQuery = inputEl.value;
    clearMarks();
    updateCount();
    if (isOpen() && hadQuery) {
      setTimeout(() => { if (isOpen()) runSearch(inputEl.value.trim()); }, 120);
    }
  }

  // ============== 装配 ==============

  function ensure() {
    if (barEl) return;
    barEl = document.getElementById('findBar');
    if (!barEl) return;
    inputEl = barEl.querySelector('#findBarInput');
    countEl = barEl.querySelector('#findBarCount');

    inputEl.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => runSearch(inputEl.value.trim()), DEBOUNCE_MS);
    });
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        step(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });

    barEl.querySelector('#findBarPrev').addEventListener('click', () => step(-1));
    barEl.querySelector('#findBarNext').addEventListener('click', () => step(1));
    barEl.querySelector('#findBarClose').addEventListener('click', close);

    // 全局 F3 / Shift+F3：查找条开着时翻转命中
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'F3') {
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
      }
    });
    // 点击查找条外不关闭（区别于工具条：查找是持续态），仅 Esc / 关闭按钮收起
  }

  window.MarkdownPreview.findBar = { open, close, toggle, isOpen, onDocRendered };
})();
