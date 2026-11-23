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

  // 覆盖面：IPv4 / IPv6（≥4 组，避免误伤 12:30:45 这类时间）/ 密码与
  // 密钥类赋值（password/secret/community/psk/token/api key/私钥/
  // authorization）/ Bearer 凭证 / JWT（eyJ… 开头）
  const SENSITIVE_RE = new RegExp([
    '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b',
    '\\b(?:[0-9a-fA-F]{1,4}:){3,7}[0-9a-fA-F]{1,4}\\b',
    '\\b(?:password|passwd|pwd|secret|community|psk|pre-shared-key|token|api[_-]?key|access[_-]?key|secret[_-]?key|private[_-]?key|authorization)\\s*[:=]\\s*\\S+',
    '\\bBearer\\s+[A-Za-z0-9._\\-]+',
    '\\beyJ[A-Za-z0-9._\\-]{10,}'
  ].join('|'), 'gi');

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  // 轻量提示（mini-toast 同款，history.js 模式）——替代 toggle 的 alert()
  let toastEl = null;
  let toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'mini-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('open'), 2600);
  }

  // 上限触顶标记：fail-open 必须可感知——截断后剩余敏感内容未遮盖，
  // 用户至少要知道「还有漏网的」
  let lastTruncated = false;

  // 遮盖范围：主文档 + 双栏对照窗格（右栏渲染另一篇文档）。
  // 侧边栏/TOC 在 vendor Shadow DOM 内且随渲染重建，暂不纳入
  function rootEls() {
    const main = document.getElementById('markdownContent');
    const els = main ? [main] : [];
    document.querySelectorAll('.split-pane-body').forEach(el => els.push(el));
    if (!els.length) {
      document.querySelectorAll('.markdown-body').forEach(el => els.push(el));
    }
    return els;
  }

  function isOn() {
    try { return localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; }
  }

  function setOn(on) {
    try { localStorage.setItem(STORE_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function blurMatches(root) {
    lastTruncated = false;
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
    // 节点数触顶且后面还有：截断
    if (scanned >= MAX_NODES && walker.nextNode()) lastTruncated = true;

    let count = 0;
    groups.forEach(nodes => {
      if (count >= MAX_BLURS) { lastTruncated = true; return; }
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

      // 每个原始节点只重建一次：先汇总该节点内的全部命中区间再统一替换。
      // 逐命中替换会移除原始节点，同一节点的后续命中因 parentNode 为空
      // 被跳过而漏盖（CWE-200，CodeRabbit review fix）
      const segsByNode = new Map(); // node -> [{localS, localE}]
      matches.forEach(match => {
        const mStart = match.index;
        const mEnd = mStart + match[0].length;
        parts.forEach(part => {
          const s = Math.max(part.start, mStart);
          const e = Math.min(part.end, mEnd);
          if (s >= e) return;
          if (!part.node.parentNode) return;
          if (!segsByNode.has(part.node)) segsByNode.set(part.node, []);
          segsByNode.get(part.node).push({ localS: s - part.start, localE: e - part.start });
        });
      });
      segsByNode.forEach((segs, node) => {
        const value = node.nodeValue || '';
        segs.sort((a, b) => a.localS - b.localS);
        const frag = document.createDocumentFragment();
        let cursor = 0;
        segs.forEach(seg => {
          if (seg.localS < cursor) return; // 区间重叠防御：前一段已覆盖
          if (seg.localS > cursor) frag.appendChild(document.createTextNode(value.slice(cursor, seg.localS)));
          const span = document.createElement('span');
          span.className = 'sensitive-blur';
          span.textContent = value.slice(seg.localS, seg.localE);
          span.title = t('sensitive.revealHint', '点击临时显示');
          span.addEventListener('click', () => span.classList.toggle('revealed'));
          frag.appendChild(span);
          cursor = seg.localE;
          count++;
        });
        if (cursor < value.length) frag.appendChild(document.createTextNode(value.slice(cursor)));
        node.parentNode.replaceChild(frag, node);
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

  // 开启态常驻徽标：全局状态指示 + 点击一键重新遮盖（已点开的蒙版批量恢复）
  function ensureBadge() {
    let badge = document.querySelector('.sensitive-mode-badge');
    if (!badge) {
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'sensitive-mode-badge';
      badge.textContent = t('sensitive.badge', '敏感模式 · 点击重新遮盖');
      badge.addEventListener('click', () => {
        applyIfOn();
        toast(t('sensitive.reblurred', '已重新遮盖全部敏感内容'));
      });
      document.body.appendChild(badge);
    }
    return badge;
  }

  function apply() {
    const roots = rootEls();
    if (!roots.length) return;
    if (isOn()) {
      let count = 0;
      roots.forEach(root => { count += blurMatches(root); });
      if (count > 0) {
        document.body.classList.add('sensitive-mode');
      }
      ensureBadge().hidden = false;
      if (lastTruncated) {
        // fail-open 必须可感知：上限之外还有未遮盖的敏感内容
        toast(t('sensitive.truncated', '敏感内容较多，已遮盖部分——仍有漏网内容，请抽查'));
      }
    } else {
      roots.forEach(unblur);
      document.body.classList.remove('sensitive-mode');
      const badge = document.querySelector('.sensitive-mode-badge');
      if (badge) badge.hidden = true;
    }
  }

  function applyIfOn() {
    if (!isOn()) return;
    const roots = rootEls();
    if (!roots.length) return;
    roots.forEach(unblur); // 重渲染后重建（渲染器可能替换过节点）
    let count = 0;
    roots.forEach(root => { count += blurMatches(root); });
    document.body.classList.add('sensitive-mode');
    ensureBadge().hidden = false;
    if (lastTruncated) {
      toast(t('sensitive.truncated', '敏感内容较多，已遮盖部分——仍有漏网内容，请抽查'));
    }
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
    if (palette && palette.registerActions) {
      palette.registerActions([{
        id: 'sensitive-mode',
        icon: 'i-eye',
        label: () => (isOn()
          ? t('sensitive.off', '关闭敏感模式')
          : t('sensitive.on', '敏感模式（模糊 IP/密码）')),
        run: () => {
          const on = toggle();
          // toast 而非 alert：与全站反馈风格一致（mini-toast）
          toast(on
            ? t('sensitive.enabled', '已开启敏感模式：正文中的 IP 与密码已模糊，点击蒙版可临时显示')
            : t('sensitive.disabled', '已关闭敏感模式'));
        }
      }]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
