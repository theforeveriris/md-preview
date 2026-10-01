/**
 * 文档演示模式（?mode=slides）
 *
 * 把当前文档按 H2 分页，进入全屏放映：写完文档直接拿去讲。
 *
 * 入口：
 *   - URL 参数 ?mode=slides：文档渲染完成后自动进入（与 ?mode=editor 同惯例）
 *   - 页头「文档放映」按钮（header actions，history 模块同区）
 * 退出：
 *   - Esc / ✕ 按钮：还原文档 DOM、恢复滚动位置、移除 URL 参数
 *
 * 翻页：
 *   - 按 H2 切页，H3 及以下归入所属 H2；第一个 H2 之前的内容（H1 + 引言）为封面页
 *   - ← / → / Space / Shift+Space / Home / End 翻页；Esc 退出
 *   - 点击页面左 / 右半屏翻页；页脚显示文档标题与页码
 *
 * 实现要点：
 *   - 页面节点是「移动」而非克隆：apexcharts / mermaid / 代码 Tabs 等已渲染
 *     的交互实例原样保留，退出时按记录的原位插回，文档完全还原
 *   - 放映页容器复用 .markdown-body 类，正文样式（字体/表格/代码高亮）不变
 *   - 键盘监听在捕获阶段 stopPropagation，优先级同 PPTX 放映；
 *     灯箱与全局快捷键（ui.js / markdown.js）均让位本浮层
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  let pendingParam = false;
  let overlayEl = null;
  let open = false;
  let pages = [];
  let index = 0;
  let savedScrollY = 0;
  // 移动记录：[{ node, parent, nextSibling }]，退出时按序插回
  let movedRecords = [];

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function docTitle() {
    const st = window.MarkdownPreview.state || {};
    return st.docTitle || (document.title.split(' | ')[0] || '');
  }

  // ============== 分页：按 H2 切片 ==============
  function slicePages(source) {
    const result = [];
    let current = [];
    Array.from(source.children).forEach(node => {
      // 文档底部导航不进放映；其余节点按 H2 边界分组
      if (node.classList && node.classList.contains('doc-navigation')) return;
      if (node.tagName === 'H2' && current.length > 0) {
        result.push(current);
        current = [];
      }
      current.push(node);
    });
    if (current.length > 0) result.push(current);
    return result;
  }

  // ============== 浮层 DOM ==============
  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.id = 'slides-overlay';
    overlayEl.className = 'slides-overlay';
    overlayEl.innerHTML = `
      <div class="slides-backdrop"></div>
      <div class="slides-stage">
        <div class="slides-page markdown-body"></div>
      </div>
      <button type="button" class="slides-close" aria-label="${t('slides.close', '退出放映')}">✕</button>
      <button type="button" class="slides-nav slides-nav--prev" aria-label="${t('slides.prev', '上一页')}">‹</button>
      <button type="button" class="slides-nav slides-nav--next" aria-label="${t('slides.next', '下一页')}">›</button>
      <div class="slides-footer">
        <span class="slides-title"></span>
        <span class="slides-counter"><span class="slides-counter-cur">1</span> / <span class="slides-counter-total">1</span></span>
      </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.querySelector('.slides-close').addEventListener('click', exit);
    overlayEl.querySelector('.slides-nav--prev').addEventListener('click', (e) => { e.stopPropagation(); navigate(-1); });
    overlayEl.querySelector('.slides-nav--next').addEventListener('click', (e) => { e.stopPropagation(); navigate(1); });
    // 点击左/右半屏翻页（点击页脚/按钮除外）
    overlayEl.querySelector('.slides-stage').addEventListener('click', (e) => {
      if (e.target.closest('a, button, .csv-table, input, textarea, select')) return;
      const rect = e.currentTarget.getBoundingClientRect();
      navigate(e.clientX - rect.left < rect.width / 2 ? -1 : 1);
    });

    document.addEventListener('keydown', onKeydown, true);
    return overlayEl;
  }

  function onKeydown(e) {
    if (!open) return;
    // 输入控件内（如 CSV 表格搜索框）不拦截空格等按键
    const tgt = e.target;
    if (tgt && tgt.closest && tgt.closest('input, textarea, select, [contenteditable="true"]')) return;
    // 只拦截翻页 / 退出键，其余（Ctrl+C 等）放行
    const key = e.key;
    const pageKeys = ['Escape', 'ArrowLeft', 'ArrowRight', ' ', 'Home', 'End', 'PageUp', 'PageDown'];
    if (!pageKeys.includes(key)) return;
    e.preventDefault();
    e.stopPropagation();
    if (key === 'Escape') exit();
    else if (key === 'ArrowLeft' || key === 'PageUp') navigate(-1);
    else if (key === 'ArrowRight' || key === 'PageDown') navigate(1);
    else if (key === ' ') navigate(e.shiftKey ? -1 : 1);
    else if (key === 'Home') navigate(-1e9);
    else if (key === 'End') navigate(1e9);
  }

  // ============== 进入 / 翻页 / 退出 ==============
  function enter() {
    if (open) return;
    const source = document.getElementById('markdownContent');
    if (!source || source.children.length === 0) return;
    if (!window.MarkdownPreview.state) return;
    const groups = slicePages(source);
    if (groups.length === 0) return;

    savedScrollY = window.scrollY;
    movedRecords = [];

    const el = ensureOverlay();
    const pageEl = el.querySelector('.slides-page');
    pageEl.innerHTML = '';

    groups.forEach(nodes => {
      const page = document.createElement('div');
      page.className = 'slides-page-content';
      nodes.forEach(node => {
        movedRecords.push({ node, parent: node.parentNode, next: node.nextSibling });
        page.appendChild(node);
      });
      pageEl.appendChild(page);
    });

    pages = Array.from(pageEl.querySelectorAll('.slides-page-content'));
    el.querySelector('.slides-counter-total').textContent = String(pages.length);
    el.querySelector('.slides-title').textContent = docTitle();

    open = true;
    index = 0;
    el.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    // 收起可能正在显示的续读提示条，避免在放映背后残留
    document.querySelectorAll('.resume-toast.open').forEach(el => el.classList.remove('open'));
    el.dataset.docPath = window.MarkdownPreview.state.currentFilePath || '';
    navigate(0);
  }

  function navigate(delta) {
    if (!open || pages.length === 0) return;
    if (delta === -1e9) index = 0;
    else if (delta === 1e9) index = pages.length - 1;
    else index = Math.min(pages.length - 1, Math.max(0, index + delta));
    pages.forEach((p, i) => p.classList.toggle('slides-active', i === index));
    overlayEl.querySelector('.slides-counter-cur').textContent = String(index + 1);
    overlayEl.querySelector('.slides-stage').scrollTop = 0;
  }

  function exit() {
    if (!open) return;
    // 按记录原位插回所有节点
    movedRecords.forEach(rec => {
      if (rec.next && rec.next.parentNode === rec.parent) rec.parent.insertBefore(rec.node, rec.next);
      else rec.parent.appendChild(rec.node);
    });
    movedRecords = [];
    pages = [];
    open = false;
    overlayEl.classList.remove('is-open');
    document.body.style.overflow = '';
    // 还原滚动与 URL（移除 ?mode=slides，与编辑器模式行为一致）
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('mode') === 'slides') {
        url.searchParams.delete('mode');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch (e) { /* 忽略 */ }
  }

  // ---------- 对外钩子 ----------

  // 模块加载时记录 URL 参数并绑定页头「文档放映」按钮；
  // 文档渲染完成后按需自动进入
  function init() {
    try {
      pendingParam = new URLSearchParams(window.location.search).get('mode') === 'slides';
    } catch (e) { pendingParam = false; }
    const btn = document.getElementById('slidesBtn');
    if (btn) btn.addEventListener('click', () => {
      if (open) exit();
      else enter();
    });
  }

  function onDocRendered(path) {
    if (!pendingParam || !path) return;
    pendingParam = false;
    // 等渲染器链（mermaid/apexcharts 等）基本完成再进入，避免空页
    setTimeout(enter, 1200);
  }

  window.MarkdownPreview.slides = {
    init,
    enter,
    exit,
    onDocRendered,
    isOpen: () => open
  };
})();
