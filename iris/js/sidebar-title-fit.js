/**
 * sidebar-title-fit - 让侧栏标题「Files / Index / Tags」永远排在一行
 *
 * 侧栏标题用的是主题的展示字体（--font-display），而各主题的展示字体
 * 宽窄差别很大：衬线体 200px 上下就够，等宽体（Courier New）或手写体
 * （Chalkboard SE / Segoe Print）要 230~270px，侧栏标题位只有 220px 出头，
 * 于是这些主题下标题会折成两三行，把侧栏头部撑得很高。
 *
 * 这里做两件事：
 *   1. CSS 侧给 .sidebar-title 加 white-space: nowrap，保证不折行；
 *   2. 每次主题切换、侧栏宽度变化、字体加载完成后，量一次标题「不折行时
 *      需要多宽」，比可用宽度宽就按比例调小字号（不小于 11px）。
 */
(function () {
  'use strict';

  const MIN_SIZE = 11;
  let raf = 0;

  function fit() {
    const title = document.querySelector('#sidebar .sidebar-title');
    if (!title) return;
    const header = title.parentElement;
    if (!header) return;

    // 先回到主题给定的字号，作为缩放基准
    title.style.fontSize = '';
    const cs = getComputedStyle(title);
    const base = parseFloat(cs.fontSize) || 18;

    // 可用宽度 = 头部内容宽 - 其它子元素（折叠按钮等）- 间距
    const hcs = getComputedStyle(header);
    const padL = parseFloat(hcs.paddingLeft) || 0;
    const padR = parseFloat(hcs.paddingRight) || 0;
    const gap = parseFloat(hcs.gap) || 0;
    let others = 0;
    for (const child of header.children) {
      if (child === title) continue;
      others += child.getBoundingClientRect().width;
    }
    const avail = header.clientWidth - padL - padR - others - gap;
    if (!(avail > 0)) return;

    // 量「不折行时」的宽度：临时脱离文档流，宽度取内容宽
    const prevPosition = title.style.position;
    const prevWidth = title.style.width;
    const prevFontSize = title.style.fontSize;
    title.style.position = 'absolute';
    title.style.width = 'max-content';
    title.style.fontSize = base + 'px';
    const need = title.getBoundingClientRect().width;
    title.style.position = prevPosition;
    title.style.width = prevWidth;
    title.style.fontSize = prevFontSize;

    if (need > avail) {
      const size = Math.max(MIN_SIZE, Math.floor(base * (avail / need) * 10) / 10);
      title.style.fontSize = size + 'px';
    } else {
      title.style.fontSize = '';
    }
  }

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      try { fit(); } catch (e) { /* 布局未就绪时忽略 */ }
    });
  }

  function init() {
    schedule();
    // 主题切换 → 展示字体变了，要重新量
    window.addEventListener('themechange', schedule);
    window.addEventListener('resize', schedule);
    // 侧栏宽度变化（拖拽调宽、展开/收起）由 ResizeObserver 覆盖
    const sidebar = document.getElementById('sidebar');
    if (sidebar && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(schedule).observe(sidebar);
    }
    // 网络字体加载完成后字宽会变
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(schedule).catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
