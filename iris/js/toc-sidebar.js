/**
 * toc-sidebar - 文章侧边 mini-TOC + scrollspy
 *
 * 长文阅读时在视口右侧悬浮当前文档的 h2/h3 目录，滚动实时高亮当前章节，
 * 点击平滑滚动到对应标题（手动计算 topbar 偏移，不依赖 scroll-margin）。
 *
 * 行为约定：
 *   - 标题数 < MIN_HEADINGS 或视口 < MIN_VIEWPORT 时自动隐藏（短文/窄屏是噪音）；
 *   - 开关：设置面板「阅读 → 显示选项 → 文章侧边目录」（settings.miniToc，
 *     默认开）；关闭时 display:none 且不监听滚动；
 *   - 隐藏场景：编辑器模式 / 双屏对照 / 打印 / 欢迎页（无标题）；
 *   - code-tabs 未激活面板里的标题不进目录（offsetParent 为 null）。
 * 渲染接入：markdown.js 渲染完成后调 onDocRendered()（与 findBar 同款钩子）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const MIN_HEADINGS = 4;     // 标题数阈值：少于该数不出目录
  const MIN_ROOM = 260;       // 正文右缘余白阈值：更窄会与正文重叠，不出
  const TOP_OFFSET = 96;      // topbar 高度余量：scrollspy 判定线
  const SCROLL_MARGIN = 72;   // 点击跳转时标题距视口顶的落点

  let el = null;
  let headings = [];          // [{ el, level }]
  let visible = false;
  let ticking = false;

  function isEnabled() {
    const st = window.MarkdownPreview.settings;
    const cfg = st && typeof st.load === 'function' ? st.load() : {};
    return cfg.miniToc !== false;
  }

  // 余白自适应：正文右缘到视口右缘的空间足够放目录才显示
  //（内容宽度可调 600~1400，固定视口阈值会误伤）
  function hasRoom() {
    const body = document.querySelector('.markdown-body');
    if (!body) return false;
    return window.innerWidth - body.getBoundingClientRect().right > MIN_ROOM;
  }

  function ensureEl() {
    if (el) return el;
    el = document.createElement('nav');
    el.className = 'mini-toc';
    el.setAttribute('aria-label', '文章目录');
    el.innerHTML = '<div class="mini-toc-title"></div><ul class="mini-toc-list"></ul>';
    document.body.appendChild(el);
    return el;
  }

  // 收集当前文档可见的 h2/h3（code-tabs 未激活面板里的标题不可见，跳过）
  function collect() {
    const content = document.getElementById('markdownContent');
    if (!content) return [];
    return Array.from(content.querySelectorAll('h2, h3')).filter(h => {
      if (!h.textContent.trim()) return false;
      const panel = h.closest('.code-tab-panel');
      if (panel && !panel.classList.contains('active')) return false;
      return h.offsetParent !== null || getComputedStyle(h).position === 'fixed';
    }).map(h => ({ el: h, level: h.tagName === 'H2' ? 2 : 3 }));
  }

  function build() {
    headings = collect();
    if (!isEnabled() || headings.length < MIN_HEADINGS ||
        !hasRoom() || document.body.classList.contains('editor-mode')) {
      hide();
      return;
    }
    const node = ensureEl();
    node.querySelector('.mini-toc-title').textContent =
      window.MarkdownPreview.t ? window.MarkdownPreview.t('toc.title', '目录') : '目录';
    const list = node.querySelector('.mini-toc-list');
    list.innerHTML = '';
    headings.forEach((h, i) => {
      const li = document.createElement('li');
      li.className = 'lvl' + h.level;
      const a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.textContent = h.el.textContent.trim();
      a.addEventListener('click', () => {
        const top = h.el.getBoundingClientRect().top + window.scrollY - SCROLL_MARGIN;
        window.scrollTo({ top, behavior: 'smooth' });
        setActive(i);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    node.classList.add('show');
    visible = true;
    updateActive();
  }

  function hide() {
    if (el) el.classList.remove('show');
    visible = false;
  }

  function setActive(index) {
    if (!el || !visible) return;
    el.querySelectorAll('.mini-toc-list li').forEach((li, i) => {
      li.classList.toggle('active', i === index);
    });
  }

  // scrollspy：最后一个滚过判定线的标题为当前章节（rAF 节流）；
  // 页面尚在顶部时高亮第一项
  function updateActive() {
    if (!visible || !headings.length) return;
    let current = -1;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].el.getBoundingClientRect().top <= TOP_OFFSET) current = i;
      else break;
    }
    setActive(current < 0 ? 0 : current);
  }

  function onScroll() {
    if (!visible || ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; updateActive(); });
  }

  function onResize() {
    if (!el || !visible) return;
    if (!hasRoom()) { hide(); return; }
    build();
  }

  // markdown.js 渲染完成后重建（与 findBar.onDocRendered 同款钩子）
  function onDocRendered() {
    build();
  }

  // 设置开关实时生效（settings.js toggle 回调）
  function refresh() {
    if (isEnabled()) build();
    else hide();
  }

  function init() {
    window.addEventListener('scroll', onScroll, { passive: true });
    // 内容区自监控：虚拟路由（#/tags、#/graph 等）不经过 markdown.js 的
    // 渲染钩子，观察 DOM 变化兜底（防抖合并渲染期的批量变更）
    const content = document.getElementById('markdownContent');
    if (content) {
      let deb = null;
      new MutationObserver(() => {
        clearTimeout(deb);
        deb = setTimeout(() => { if (isEnabled()) build(); }, 200);
      }).observe(content, { childList: true, subtree: true });
    }
    window.addEventListener('resize', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => { ticking = false; onResize(); });
      }
    }, { passive: true });
  }

  window.MarkdownPreview.tocSidebar = { onDocRendered, refresh };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
