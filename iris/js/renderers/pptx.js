/**
 * PPTX 嵌入渲染器（与 pkt 嵌入完全同风格：预处理产物方案）
 *
 * Markdown 语法：
 *   ```pptx
 *   @[pptx](my-deck)
 *   ```
 *
 * 目录约定（对应 pkt 的 data/pkt/json + data/pkt/images 模式）：
 *   iris/data/pptx/json/{slug}.json  = { title, pages, ext?, width?, height? }
 *   iris/data/pptx/images/{slug}-1.png  ~  {slug}-{pages}.png
 *   （ext 字段可选，默认 png；也支持 svg/jpg/jpeg/webp）
 *
 * 功能：
 *   - 默认渲染缩略图网格（响应式）
 *   - 每页卡片：图片懒加载 + 页码徽章 + 悬停放大效果
 *   - 点击任意缩略图进入「全屏放映模式」
 *       · 点击左右半屏 / ← → 键 翻页
 *       · ESC / 点击空白区 / 点击 ✕ 关闭
 *       · 顶部计数器「第 5 页 / 共 12 页」
 */

(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 工具：GitHub Pages 子路径适配（与 pkt-renderer 同款） ==============
  function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/md-preview/')) return '/md-preview/';
    return '/';
  }

  // ============== 放映模式（全局单例 overlay） ==============
  let slideshowEl = null;
  let slideshowImgs = [];
  let slideshowIndex = 0;

  function ensureSlideshowEl() {
    if (slideshowEl) return slideshowEl;
    slideshowEl = document.createElement('div');
    slideshowEl.id = 'pptx-slideshow-overlay';
    slideshowEl.className = 'pptx-slideshow';
    slideshowEl.innerHTML = `
      <div class="pptx-slideshow__backdrop"></div>
      <button class="pptx-slideshow__close" aria-label="关闭放映">✕</button>
      <div class="pptx-slideshow__counter"><span class="pptx-slideshow__counter-cur">1</span> / <span class="pptx-slideshow__counter-total">1</span></div>
      <button class="pptx-slideshow__nav pptx-slideshow__nav--prev" aria-label="上一页">‹</button>
      <button class="pptx-slideshow__nav pptx-slideshow__nav--next" aria-label="下一页">›</button>
      <div class="pptx-slideshow__stage"><img class="pptx-slideshow__img" alt=""></div>
    `;
    document.body.appendChild(slideshowEl);

    // 事件绑定
    slideshowEl.querySelector('.pptx-slideshow__close').addEventListener('click', closeSlideshow);
    slideshowEl.querySelector('.pptx-slideshow__backdrop').addEventListener('click', closeSlideshow);
    slideshowEl.querySelector('.pptx-slideshow__nav--prev').addEventListener('click', (e) => { e.stopPropagation(); navigateSlideshow(-1); });
    slideshowEl.querySelector('.pptx-slideshow__nav--next').addEventListener('click', (e) => { e.stopPropagation(); navigateSlideshow(1); });

    // 点击左/右半屏翻页
    const stage = slideshowEl.querySelector('.pptx-slideshow__stage');
    stage.addEventListener('click', (e) => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      navigateSlideshow(x < rect.width / 2 ? -1 : 1);
    });

    document.addEventListener('keydown', onSlideshowKeydown);
    return slideshowEl;
  }

  function onSlideshowKeydown(e) {
    if (!slideshowEl || !slideshowEl.classList.contains('is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSlideshow(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateSlideshow(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navigateSlideshow(1); }
    else if (e.key === ' ') { e.preventDefault(); navigateSlideshow(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Home') { e.preventDefault(); navigateSlideshow(-1e9); }
    else if (e.key === 'End') { e.preventDefault(); navigateSlideshow(1e9); }
  }

  function openSlideshow(startIndex, imageUrls, title) {
    slideshowImgs = imageUrls.slice();
    slideshowIndex = 0;
    const el = ensureSlideshowEl();
    el.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (title) el.dataset.title = title;
    navigateSlideshow(startIndex);
  }

  function navigateSlideshow(delta) {
    const total = slideshowImgs.length;
    if (total === 0) return;
    slideshowIndex = Math.min(total - 1, Math.max(0, slideshowIndex + delta));
    const el = slideshowEl;
    const img = el.querySelector('.pptx-slideshow__img');
    img.src = slideshowImgs[slideshowIndex];
    el.querySelector('.pptx-slideshow__counter-cur').textContent = String(slideshowIndex + 1);
    el.querySelector('.pptx-slideshow__counter-total').textContent = String(total);
  }

  function closeSlideshow() {
    if (!slideshowEl) return;
    slideshowEl.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // ============== 缩略图网格渲染 ==============
  function renderThumbs(container, { slug, title, pages, ext, images }) {
    const base = getBasePath();
    const extEffective = ext || 'png';
    // 如果调用方给了预计算的 images（绝对路径数组），优先用；否则按约定拼
    const urls = (images && images.length === pages) ? images
      : Array.from({ length: pages }, (_, i) => `${base}iris/data/pptx/images/${slug}-${i + 1}.${extEffective}`);

    // 头部
    const heading = document.createElement('div');
    heading.className = 'pptx-header';
    heading.innerHTML = `
      <div class="pptx-header__title">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <path d="M3 9h18"></path><path d="M9 21V9"></path>
        </svg>
        <span>${title || slug}</span>
      </div>
      <div class="pptx-header__meta">共 ${pages} 页 · 点击任意页开始放映</div>
    `;

    const grid = document.createElement('div');
    grid.className = 'pptx-thumb-grid';
    urls.forEach((url, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pptx-thumb-card';
      card.dataset.index = String(i);
      card.dataset.pptxThumb = '1';
      card.innerHTML = `
        <div class="pptx-thumb-card__badge">${i + 1}</div>
        <img loading="lazy" decoding="async" src="${url}" alt="${title || slug} 第 ${i + 1} 页" data-pptx-thumb="1" data-lightbox-disable="1">
      `;
      card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSlideshow(i, urls, title || slug);
      });
      grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(heading);
    container.appendChild(grid);
  }

  // ============== 加载 JSON 并渲染 ==============
  async function loadAndRender(container, slug, options) {
    container.innerHTML = `
      <div class="pptx-container">
        <div class="pptx-loading">
          <div class="pptx-loading-spinner"></div>
          <div>正在加载演示文稿...</div>
        </div>
      </div>
    `;

    try {
      const base = getBasePath();
      let safeSlug = slug;
      if (!slug.startsWith('http') && !slug.startsWith('/')) {
        try { safeSlug = decodeURIComponent(slug); } catch (e) { /* 已是原始字符串 */ }
        safeSlug = encodeURIComponent(safeSlug);
      }
      const metaUrl = `${base}iris/data/pptx/json/${safeSlug}.json`;

      const resp = await fetch(metaUrl);
      if (!resp.ok) {
        throw new Error(`元数据加载失败：HTTP ${resp.status}（请检查 ${metaUrl} 是否存在）`);
      }
      const meta = await resp.json();
      const pages = parseInt(meta.pages, 10);
      if (!Number.isFinite(pages) || pages <= 0) {
        throw new Error('元数据 pages 字段无效，应为正整数');
      }

      container.innerHTML = '';
      renderThumbs(container, {
        slug,
        title: meta.title || '',
        pages,
        ext: meta.ext || 'png',
        width: meta.width,
        height: meta.height,
      });
    } catch (err) {
      container.innerHTML = `
        <div class="pptx-container">
          <div class="pptx-error-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <div class="pptx-error-title">加载失败</div>
            <div class="pptx-error-message">${err.message}</div>
            <details class="pptx-error-detail">
              <summary>如何修复？</summary>
              <div>
                <p>请按以下目录结构准备 pptx 预处理产物（参考 pkt 嵌入模式）：</p>
<pre style="text-align:left;margin-top:8px;padding:10px;background:rgba(0,0,0,.04);border-radius:6px;overflow-x:auto">iris/data/pptx/json/${slug}.json
  → 内容：{"title":"演讲标题","pages":12,"ext":"png"}
iris/data/pptx/images/${slug}-1.png
iris/data/pptx/images/${slug}-2.png
    ...
iris/data/pptx/images/${slug}-12.png</pre>
              </div>
            </details>
          </div>
        </div>
      `;
    }
  }

  // ============== 对外 API ==============
  window.MarkdownPreview.pptx = {
    loadAndRender,
    renderThumbs,
    openSlideshow,
    closeSlideshow,
  };
})();
