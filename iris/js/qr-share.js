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
 * 二维码本地生成（iris/js/qr-encoder.js 按需懒加载）：文档路径与阅读进度
 * 属于本机浏览记录，不应作为 query 发给第三方服务。
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

  async function open() {
    const st = window.MarkdownPreview.state || {};
    if (!st.currentFilePath) return;
    const url = buildQrUrl();
    if (!url) return;

    const el = ensureDialog();
    const wrap = el.querySelector('.qr-share-img-wrap');
    const size = 220;
    // 本地生成：文档路径与阅读进度不出本机（首次调用懒加载编码器）
    try {
      if (!window.MarkdownPreview.QREncoder) {
        await window.MarkdownPreview.loadScript('iris/js/qr-encoder.js');
      }
      const svg = window.MarkdownPreview.QREncoder.toSVG(url, { ecl: 'M', margin: 2 });
      if (!svg) throw new Error('too-long');
      wrap.innerHTML = svg;
      const svgEl = wrap.firstElementChild;
      svgEl.style.width = size + 'px';
      svgEl.style.height = size + 'px';
    } catch (e) {
      wrap.innerHTML = '';
      const errBox = document.createElement('div');
      errBox.style.cssText = 'padding:10px 14px;border:1px solid #ff6b6b;border-radius:8px;background:#fff0f0;color:#cc0000;font-size:14px';
      errBox.textContent = e && e.message === 'too-long'
        ? '链接过长，无法生成二维码'
        : '二维码组件加载失败，请检查网络后重试';
      wrap.appendChild(errBox);
    }

    el.classList.add('open');
  }

  function init() {
    const btn = document.getElementById('qrShareBtn');
    if (btn) btn.addEventListener('click', open);
  }

  window.MarkdownPreview.qrShare = { init, open, close };
})();
