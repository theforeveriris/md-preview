/**
 * sensitive-mode - 全文敏感模式（一键模糊 IP / 密码）
 *
 * 命令面板「敏感模式」切换：正文（含代码块）里的 IPv4 地址与
 * password/secret/community/psk 等赋值全部高斯模糊，点击单个蒙版临时
 * 显示——演示/投屏场景保命开关。状态记忆在 localStorage，文档切换
 * 自动重刷（markdown.js 渲染管线末尾调用 applyIfOn）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const STORE_KEY = 'md-preview-sensitive-mode';
  const MAX_NODES = 6000;
  const MAX_BLURS = 500;

  const SENSITIVE_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:password|passwd|pwd|secret|community|psk|pre-shared-key)\s*[:=]\s*\S+/gi;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  function isOn() {
    try { return localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  }

  function setOn(on) {
    try { localStorage.setItem(STORE_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function rootEl() {
    return document.getElementById('markdownContent') ||
      document.querySelector('.markdown-body');
  }

  function blurMatches(root) {
    // 按块级容器分组收集文本节点：hljs 等会把一段赋值拆进多个 span，
    // 单节点匹配会漏——把同一块内的连续文本拼接后再匹配（CodeRabbit
    // review fix：跨节点匹配），命中部分逐节点拆分包裹。
    const groups = new Map(); // blockEl -> [textNode]
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest('.sensitive-blur')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let scanned = 0;
    while (walker.nextNode()) {
      if (scanned >= MAX_NODES) break;
      const node = walker.currentNode;
      const block = node.parentElement
        ? node.parentElement.closest('p, li, td, th, h1, h2, h3, h4, h5, h6, pre, blockquote, dt, dd, figcaption, div')
        : null;
      const key = block || root;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(node);
      scanned++;
    }

    let count = 0;
    groups.forEach(nodes => {
      if (count >= MAX_BLURS) return;
      // 拼接块内文本，记录每个片段到节点的映射
      const parts = []; // { node, start, end }（在拼接串中的偏移）
      let joined = '';
      nodes.forEach(node => {
        parts.push({ node, start: joined.length, end: joined.length + node.nodeValue.length });
        joined += node.nodeValue;
      });
      SENSITIVE_RE.lastIndex = 0;
      const matches = [];
      let m;
      while ((m = SENSITIVE_RE.exec(joined)) !== null && matches.length < MAX_BLURS - count) {
        matches.push(m);
        if (m[0].length === 0) SENSITIVE_RE.lastIndex++;
      }
      if (matches.length === 0) return;

      // 逐命中逐节点包裹：命中的偏移区间落到哪些片段就拆哪些节点
      matches.forEach(match => {
        const mStart = match.index;
        const mEnd = mStart + match[0].length;
        parts.forEach(part => {
          const s = Math.max(part.start, mStart);
          const e = Math.min(part.end, mEnd);
          if (s >= e) return;
          const node = part.node;
          if (!node.parentNode) return;
          const value = node.nodeValue;
          const localS = s - part.start;
          const localE = e - part.start;
          const frag = document.createDocumentFragment();
          if (localS > 0) frag.appendChild(document.createTextNode(value.slice(0, localS)));
          const span = document.createElement('span');
          span.className = 'sensitive-blur';
          span.textContent = value.slice(localS, localE);
          span.title = t('sensitive.revealHint', '点击临时显示');
          span.addEventListener('click', () => span.classList.toggle('revealed'));
          frag.appendChild(span);
          if (localE < value.length) frag.appendChild(document.createTextNode(value.slice(localE)));
          node.parentNode.replaceChild(frag, node);
          count++;
        });
      });
    });
    return count;
  }

  function unblur(root) {
    root.querySelectorAll('.sensitive-blur').forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
  }

  function apply() {
    const root = rootEl();
    if (!root) return;
    if (isOn()) {
      const count = blurMatches(root);
      if (count > 0) {
        document.body.classList.add('sensitive-mode');
      }
    } else {
      unblur(root);
      document.body.classList.remove('sensitive-mode');
    }
  }

  function applyIfOn() {
    if (!isOn()) return;
    const root = rootEl();
    if (!root) return;
    unblur(root); // 重渲染后重建（渲染器可能替换过节点）
    blurMatches(root);
    document.body.classList.add('sensitive-mode');
  }

  function toggle() {
    const next = !isOn();
    setOn(next);
    apply();
    return next;
  }

  window.MarkdownPreview.sensitiveMode = { toggle, applyIfOn, isOn };

  function init() {
    // 渐进式高亮异步完成后重刷（避免新高亮的代码块绕过模糊）
    window.addEventListener('md-hljs-done', () => { if (isOn()) applyIfOn(); });
    const palette = window.MarkdownPreview.palette;
    if (palette && palette.extraActions) {
      palette.extraActions.push({
        id: 'sensitive-mode',
        icon: 'i-eye',
        label: () => (isOn()
          ? t('sensitive.off', '关闭敏感模式')
          : t('sensitive.on', '敏感模式（模糊 IP/密码）')),
        run: () => {
          const on = toggle();
          // 动态 label 的动作列表无需重建；提示结果即可
          alert(on
            ? t('sensitive.enabled', '已开启敏感模式：正文中的 IP 与密码已模糊，点击蒙版可临时显示')
            : t('sensitive.disabled', '已关闭敏感模式'));
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
