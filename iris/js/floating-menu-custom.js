/**
 * floating-menu-custom - 悬浮球菜单自定义（可配置 / 可排序）
 *
 * 悬浮球按钮多了菜单变长的解法：设置面板「布局 → 悬浮球菜单」里
 * 勾选显示项、上下调顺序，存进 settings（随设置导出/导入）。
 * 菜单条目直接重排现有 DOM 节点，不重建（事件与 i18n 标签无损）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // 排序兜底顺序（未配置时 = index.html 里的原始顺序）
  const DEFAULT_ORDER = [
    'backToTopBtn', 'openLocalBtn', 'kbMountBtn', 'qrShareBtn', 'splitViewBtn',
    'snapshotShareBtn', 'installPwaBtn', 'editPageBtn', 'historyBtn', 'openSettingsBtn'
  ];
  // 设置项永远最后且不可隐藏（逃生门）
  const PINNED = ['openSettingsBtn'];

  function getConfig() {
    const settings = window.MarkdownPreview.settings;
    let cfg = null;
    if (settings && settings.load) {
      cfg = settings.load().floatingMenu || null;
    }
    const order = (cfg && Array.isArray(cfg.order)) ? cfg.order.filter(id => DEFAULT_ORDER.includes(id)) : [];
    // 补上缺失项，保持默认相对序
    DEFAULT_ORDER.forEach(id => { if (!order.includes(id)) order.push(id); });
    const hidden = (cfg && Array.isArray(cfg.hidden)) ? cfg.hidden.filter(id => DEFAULT_ORDER.includes(id)) : [];
    return { order, hidden };
  }

  function saveConfig(order, hidden) {
    const settings = window.MarkdownPreview.settings;
    if (!settings || !settings.save) return;
    const s = settings.load();
    s.floatingMenu = { order, hidden };
    settings.save(s);
  }

  // ============== 应用到菜单 DOM ==============

  function apply() {
    const menuItems = document.querySelector('.floating-menu .menu-items');
    if (!menuItems) return;
    const { order, hidden } = getConfig();
    const nodes = new Map();
    Array.from(menuItems.children).forEach(el => { if (el.id) nodes.set(el.id, el); });
    // 按 order 重排
    order.forEach(id => {
      const el = nodes.get(id);
      if (el) menuItems.appendChild(el);
    });
    // 未在 order 里的剩余节点跟在后面
    nodes.forEach((el, id) => { if (!order.includes(id)) menuItems.appendChild(el); });
    // 显隐
    nodes.forEach((el, id) => {
      if (PINNED.includes(id)) return;
      el.style.display = hidden.includes(id) ? 'none' : '';
    });
  }

  // ============== 设置面板 UI ==============

  function labelFor(el) {
    const span = el.querySelector('.menu-item-label');
    if (span && span.textContent.trim()) return span.textContent.trim();
    return el.title || el.id;
  }

  function renderUI(container) {
    const { order, hidden } = getConfig();
    container.innerHTML = `
      <div class="fm-list">
        ${order.map(id => {
          const el = document.getElementById(id);
          if (!el) return '';
          const isPinned = PINNED.includes(id);
          return `<div class="fm-row" data-id="${esc(id)}">
            <button type="button" class="fm-btn" data-act="up" ${isPinned ? 'disabled' : ''} aria-label="上移">↑</button>
            <button type="button" class="fm-btn" data-act="down" ${isPinned ? 'disabled' : ''} aria-label="下移">↓</button>
            <span class="fm-label">${esc(labelFor(el))}${isPinned ? ' 🔒' : ''}</span>
            <label class="switch">
              <input type="checkbox" data-act="toggle" ${hidden.includes(id) ? '' : 'checked'} ${isPinned ? 'disabled' : ''}>
              <span class="switch-slider"></span>
            </label>
          </div>`;
        }).join('')}
      </div>`;

    container.querySelectorAll('.fm-row').forEach(row => {
      const id = row.dataset.id;
      row.querySelectorAll('[data-act="up"], [data-act="down"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cfg = getConfig();
          const idx = cfg.order.indexOf(id);
          const dir = btn.dataset.act === 'up' ? -1 : 1;
          const swap = cfg.order[idx + dir];
          if (swap == null || PINNED.includes(id) || PINNED.includes(swap)) return;
          cfg.order[idx] = swap;
          cfg.order[idx + dir] = id;
          saveConfig(cfg.order, cfg.hidden);
          apply();
          renderUI(container);
        });
      });
      row.querySelector('[data-act="toggle"]')?.addEventListener('change', (e) => {
        const cfg = getConfig();
        if (e.target.checked) cfg.hidden = cfg.hidden.filter(x => x !== id);
        else cfg.hidden.push(id);
        saveConfig(cfg.order, cfg.hidden);
        apply();
      });
    });
  }

  function init() {
    apply();
    const container = document.getElementById('floatingMenuCustom');
    if (container && !container.dataset.fmInit) {
      container.dataset.fmInit = '1';
      const refresh = () => { renderUI(container); };
      refresh();
      window.addEventListener('langchange', refresh);
      // 设置导出/导入后跟随
      window.addEventListener('fm-config-changed', refresh);
      window.addEventListener('langchange', apply);
    }
    // 桌面端知识库按钮挂载后补充进默认序（kbMountBtn 显示与否由 desktop-kb 控制）
    window.addEventListener('filetreeloaded', apply);
  }

  window.MarkdownPreview.floatingMenuCustom = { init, apply };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
