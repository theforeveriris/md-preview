/**
 * 扫码续读
 *
 * 桌面端悬浮球 →「扫码续读」：生成当前文档（含阅读位置）的二维码，
 * 手机扫码后在手机上打开同一文档并自动滚动到桌面端当前的阅读位置。
 *
 * 二维码 URL 形如：https://site/?pos=62#/docs/x.md
 *   - pos 为桌面端当前阅读百分比（< 5% 时省略）；reading-pos.js 在目标
 *     设备打开后读取该参数，渲染完成后一次性跳转并从 URL 移除
 *   - 位置走 query 而非 hash 附加，避免与文档路由冲突
 *
 * 二维码图片沿用 qrcode 插件的外部服务方案（api.qrserver.com 优先，
 * Google Chart 兜底，与 iris/plugins/qrcode.js 一致，零本地依赖）。
 * 生成时桌面端在线即可；扫码后目标设备独立加载。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  let dialogEl = null;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function currentPct() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return Math.round((window.scrollY / max) * 100);
  }

  function buildQrUrl() {
    const st = window.MarkdownPreview.state || {};
    if (!st.currentFilePath) return null;
    const pct = currentPct();
    const params = (pct >= 5 && pct <= 95) ? '?pos=' + pct : '';
    const hash = '#/' + encodeURI(st.currentFilePath);
    return location.origin + location.pathname + params + hash;
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('div');
    dialogEl.className = 'qr-share-dialog';
    dialogEl.innerHTML = `
      <div class="qr-share-backdrop"></div>
      <div class="qr-share-card" role="dialog" aria-modal="true">
        <button type="button" class="qr-share-close" aria-label="${t('common.close', '关闭')}">✕</button>
        <div class="qr-share-title">${t('qr.title', '扫码续读')}</div>
        <div class="qr-share-img-wrap"><img class="qr-share-img" alt="QR Code"></div>
      </div>
    `;
    document.body.appendChild(dialogEl);

    dialogEl.querySelector('.qr-share-close').addEventListener('click', close);
    dialogEl.querySelector('.qr-share-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dialogEl.classList.contains('open')) close();
    }, true);
    return dialogEl;
  }

  function close() {
    if (!dialogEl) return;
    dialogEl.classList.remove('open');
  }

  function open() {
    const st = window.MarkdownPreview.state || {};
    if (!st.currentFilePath) return;
    const url = buildQrUrl();
    if (!url) return;

    const el = ensureDialog();
    const img = el.querySelector('.qr-share-img');
    const size = 220;
    // 双端点回退：主服务失败时换 Google Chart（与 qrcode 插件同策略）
    img.onerror = () => {
      if (img.dataset.fallback === '1') { img.onerror = null; return; }
      img.dataset.fallback = '1';
      img.src = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(url)}`;
    };
    delete img.dataset.fallback;
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

    el.classList.add('open');
  }

  function init() {
    const btn = document.getElementById('qrShareBtn');
    if (btn) btn.addEventListener('click', open);
  }

  window.MarkdownPreview.qrShare = { init, open, close };
})();
