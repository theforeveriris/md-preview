/**
 * toc-sidebar - 文章侧边 mini-TOC + scrollspy
 *
 * 长文阅读时在视口右侧悬浮当前文档的 h2/h3 目录，滚动实时高亮当前章节，
 * 点击平滑滚动到对应标题（手动计算 topbar 偏移，不依赖 scroll-margin）。
 *
 * 显示条件（updateVisibility 统一判定，切换带滑动/淡入动画）：
 *   - 设置开关（settings.miniToc，默认开）；
 *   - 标题数 ≥ MIN_HEADINGS（短文是噪音）；
 *   - 正文右缘余白 > MIN_ROOM（自适应内容宽度，变宽挤压时自动收起）；
 *   - 侧边栏抽屉未展开（#sidebar.open）、悬浮球菜单未展开（.menu-items.open）；
 *   - 非编辑器模式；欢迎/虚拟聚合页（无标题）自然不出。
 * 渲染接入双通道：markdown.js 渲染后钩子 + #markdownContent 的
 * MutationObserver 自监控（虚拟路由不经过钩子）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const MIN_HEADINGS = 4;     // 标题数阈值：少于该数不出目录
  const MIN_ROOM = 240;       // 正文右缘余白阈值（TOC 宽 210 + 间隙），更窄不出
  const TOP_OFFSET = 96;      // topbar 高度余量：scrollspy 判定线
  const SCROLL_MARGIN = 72;   // 点击跳转时标题距视口顶的落点

  let el = null;
  let headings = [];          // [{ el, level }]
  let visible = false;
  let resizeLast = 0;

  function isEnabled() {
    const st = window.MarkdownPreview.settings;
    const cfg = st && typeof st.load === 'function' ? st.load() : {};
    return cfg.miniToc !== false;
  }

  // 余白自适应：正文右缘到视口右缘的空间足够放目录才显示
  //（内容宽度可调 600~1400，固定视口阈值会误伤）。
  // 必须用 #markdownContent：页面上有 4 个 .markdown-body（分栏左右 /
  // 编辑器双屏预览），querySelector 会命中隐藏的 split-pane 面板。
  function hasRoom() {
    const body = document.getElementById('markdownContent');
    if (!body) return false;
    return window.innerWidth - body.getBoundingClientRect().right > MIN_ROOM;
  }

  // 侧边栏展开态：桌面端侧边栏展开（未折叠）或移动端抽屉打开时收起 TOC——
  // 目录是阅读态的伴生件，展开侧边栏导航时让位；折叠回阅读态时滑回
  function isSidebarExpanded() {
    const drawer = document.getElementById('sidebar');
    if (drawer && drawer.classList.contains('open')) return true; // 移动端抽屉
    if (window.innerWidth > 768) {
      // 桌面端：折叠态写在 body.sidebar-collapsed，未折叠即展开
      return !document.body.classList.contains('sidebar-collapsed');
    }
    return false;
  }

  // 悬浮球菜单展开时收起 TOC
  function isNavMenuOpen() {
    const menu = document.querySelector('.menu-items');
    return !!(menu && menu.classList.contains('open'));
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

  // 重建目录列表（文档切换 / 标题集合变化时调用）
  function build() {
    headings = collect();
    ensureEl();
    const node = el;
    node.querySelector('.mini-toc-title').textContent =
      window.MarkdownPreview.t ? window.MarkdownPreview.t('toc.title', '目录') : '目录';
    const list = node.querySelector('.mini-toc-list');
    list.innerHTML = '';
    headings.forEach((h) => {
      const li = document.createElement('li');
      li.className = 'lvl' + h.level;
      const a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.textContent = h.el.textContent.trim();
      a.addEventListener('click', () => {
        const top = h.el.getBoundingClientRect().top + window.scrollY - SCROLL_MARGIN;
        window.scrollTo({ top, behavior: 'smooth' });
        setActive(headings.indexOf(h));
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    updateVisibility();
    updateActive();
  }

  // 显隐统一判定：所有条件在此汇合，切换只动 'show' class（CSS 负责动画）
  function updateVisibility() {
    if (!el) return;
    const ok = isEnabled() &&
      headings.length >= MIN_HEADINGS &&
      hasRoom() &&
      !isSidebarExpanded() &&
      !isNavMenuOpen() &&
      !document.body.classList.contains('editor-mode');
    visible = ok;
    el.classList.toggle('show', ok);
    if (ok) updateActive();
  }

  function hide() {
    if (!el) return;
    visible = false;
    el.classList.remove('show');
  }

  function setActive(index) {
    if (!el || !visible) return;
    const items = el.querySelectorAll('.mini-toc-list li');
    items.forEach((li, i) => {
      li.classList.toggle('active', i === index);
    });
    // 长目录（列表溢出可滚动）时，高亮项要随文件滚动保持在可视区内——
    // block: nearest 只滚 TOC 自身的滚动容器，不会牵动页面
    const active = items[index];
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest' });
    }
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

  let spyLast = 0;
  function onScroll() {
    if (!visible) return;
    // 时间戳节流而非 rAF：后台标签页 rAF 被冻结会导致高亮永不更新
    if (performance.now() - spyLast < 80) return;
    spyLast = performance.now();
    updateActive();
  }

  // markdown.js 渲染完成后重建（与 findBar.onDocRendered 同款钩子）
  function onDocRendered() {
    build();
  }

  // 设置开关实时生效（settings.js toggle 回调）
  function refresh() {
    build();
  }

  function init() {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      if (performance.now() - resizeLast < 100) return;
      resizeLast = performance.now();
      updateVisibility();
    }, { passive: true });

    // 内容区自监控（双通道之一）：虚拟路由（#/tags、#/graph 等）不经过
    // markdown.js 渲染钩子，DOM 变化兜底（防抖合并渲染期批量变更）
    const content = document.getElementById('markdownContent');
    if (content) {
      let deb = null;
      new MutationObserver(() => {
        clearTimeout(deb);
        deb = setTimeout(() => build(), 200);
      }).observe(content, { childList: true, subtree: true });
    }

    // 内容宽度变化（Ctrl+Alt+± / 设置滑杆）：正文右缘移动 → 重判余白
    const markdownBody = document.getElementById('markdownContent');
    if (markdownBody && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => updateVisibility()).observe(markdownBody);
    }

    // 侧边栏抽屉 / 悬浮球菜单展开态：class 属性变化即重判显隐
    const watch = (sel) => {
      const node = document.querySelector(sel);
      if (node && typeof MutationObserver !== 'undefined') {
        new MutationObserver(() => updateVisibility())
          .observe(node, { attributes: true, attributeFilter: ['class'] });
      }
    };
    watch('body');
    watch('#sidebar');
    watch('.menu-items');
  }

  window.MarkdownPreview.tocSidebar = { onDocRendered, refresh };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
