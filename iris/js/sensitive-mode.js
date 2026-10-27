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
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.nodeValue || n.nodeValue.trim().length < 7) return NodeFilter.FILTER_REJECT;
        if (n.parentElement && n.parentElement.closest('.sensitive-blur')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
      if (nodes.length >= MAX_NODES) break;
    }
    let count = 0;
    nodes.forEach(node => {
      if (count >= MAX_BLURS) return;
      const text = node.nodeValue;
      SENSITIVE_RE.lastIndex = 0;
      if (!SENSITIVE_RE.test(text)) return;
      SENSITIVE_RE.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m;
      while ((m = SENSITIVE_RE.exec(text)) !== null) {
        if (count >= MAX_BLURS) break;
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement('span');
        span.className = 'sensitive-blur';
        span.textContent = m[0];
        span.title = t('sensitive.revealHint', '点击临时显示');
        span.addEventListener('click', () => span.classList.toggle('revealed'));
        frag.appendChild(span);
        last = m.index + m[0].length;
        count++;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      if (node.parentNode) node.parentNode.replaceChild(frag, node);
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
