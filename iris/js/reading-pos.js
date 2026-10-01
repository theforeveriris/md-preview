/**
 * 阅读位置续读
 *
 * 每篇仓库文档记住滚动位置（百分比），重新打开同一篇时底部浮出提示：
 * 「上次读到 62%，继续？」，点击平滑滚回原位。
 *
 * 设计：
 *   - 存储 localStorage('md-preview-reading-pos')：{ [path]: { pct, ts } }
 *   - 滚动监听节流 1s 写入，标签页隐藏 / 卸载前兜底保存
 *   - 仅记录仓库文档（markdown.js loadMarkdownFile 钩子传入 path）；
 *     本地文件会话刷新即失效，不记录
 *   - 百分比 < 5% 或 > 95% 不记录、不提示，避免打扰首尾阅读
 *   - 提示条 8s 自动消失；「忽略」本次不再弹，「继续」平滑滚动到位置
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const STORE_KEY = 'md-preview-reading-pos';
  const MIN_PCT = 5;
  const MAX_PCT = 95;
  const TOAST_AUTOHIDE_MS = 8000;
  const SAVE_INTERVAL_MS = 1000;

  let currentPath = '';
  let toastEl = null;
  let toastTimer = null;
  let lastSaved = 0;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveStore(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (e) { /* 隐私模式等场景下 localStorage 可能不可用，静默跳过 */ }
  }

  function maxScroll() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  function currentPct() {
    const max = maxScroll();
    if (max <= 0) return 0;
    return Math.round((window.scrollY / max) * 100);
  }

  function saveCurrent(force) {
    if (!currentPath) return;
    const now = Date.now();
    if (!force && now - lastSaved < SAVE_INTERVAL_MS) return;
    lastSaved = now;
    const pct = currentPct();
    if (pct < MIN_PCT || pct > MAX_PCT) return;
    const store = loadStore();
    store[currentPath] = { pct, ts: now };
    // 上限保护：最多保留 200 篇，超出后淘汰最旧的
    const keys = Object.keys(store);
    if (keys.length > 200) {
      keys.sort((a, b) => (store[a].ts || 0) - (store[b].ts || 0));
      keys.slice(0, keys.length - 200).forEach(k => delete store[k]);
    }
    saveStore(store);
  }

  function hideToast() {
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
    if (toastEl) toastEl.classList.remove('open');
  }

  function jumpTo(pct) {
    const max = maxScroll();
    if (max <= 0) return;
    window.scrollTo({ top: (max * pct) / 100, behavior: 'smooth' });
  }

  function showToast(pct) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'resume-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = `
      <span class="resume-toast-text"></span>
      <span class="resume-toast-actions">
        <button type="button" class="resume-toast-go"></button>
        <button type="button" class="resume-toast-dismiss"></button>
      </span>
    `;
    toastEl.querySelector('.resume-toast-text').textContent =
      t('reading.resume', '上次读到 {pct}%，继续？').replace('{pct}', pct);
    const go = toastEl.querySelector('.resume-toast-go');
    const dismiss = toastEl.querySelector('.resume-toast-dismiss');
    go.textContent = t('reading.resumeGo', '继续阅读');
    dismiss.textContent = t('reading.resumeDismiss', '忽略');
    go.addEventListener('click', () => { hideToast(); jumpTo(pct); });
    dismiss.addEventListener('click', hideToast);
    // 显示前先回到新文档的顶部状态，避免提示条在旧滚动位置闪现
    requestAnimationFrame(() => toastEl.classList.add('open'));
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_AUTOHIDE_MS);
  }

  // ---------- 对外钩子（markdown.js 调用） ----------

  // 扫码续读：URL 带 ?pos=N 时一次性定位到 N%，随后把参数从 URL 移除
  // （避免站内继续导航时每篇都跳）。返回是否消费了参数。
  function consumePosParam() {
    let pct = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('pos');
      if (raw !== null) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= MIN_PCT && n <= MAX_PCT) pct = n;
        params.delete('pos');
        const qs = params.toString();
        history.replaceState(null, '',
          window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
      }
    } catch (e) { /* 忽略 */ }
    if (pct === null) return false;
    setTimeout(() => jumpTo(pct), 700);
    return true;
  }

  // 新文档渲染完成：?pos= 优先（扫码续读）；否则若该篇有记录且不在首尾，弹续读提示
  function onDocRendered(path) {
    hideToast();
    currentPath = path || '';
    if (!path) return;
    if (consumePosParam()) return;
    const rec = loadStore()[path];
    if (rec && rec.pct >= MIN_PCT && rec.pct <= MAX_PCT) {
      // 延迟到渲染 / 图片布局基本稳定后再弹
      setTimeout(() => {
        if (currentPath === path) showToast(rec.pct);
      }, 700);
    }
  }

  // ---------- 初始化 ----------
  function init() {
    window.addEventListener('scroll', () => saveCurrent(false), { passive: true });
    // 离开页面 / 切后台时兜底保存（scroll 节流可能刚好跳过最后一次位置）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveCurrent(true);
    });
    window.addEventListener('pagehide', () => saveCurrent(true));
  }

  window.MarkdownPreview.readingPos = {
    init,
    onDocRendered
  };
})();
