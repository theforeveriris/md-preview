/**
 * shortcut-help - 快捷键速查面板（? 呼出，Esc / 点击遮罩关闭）
 *
 * 站点快捷键散落在 ui.js / find-bar / split-view / editor 等多处，
 * 此面板是唯一的汇总展示（数据与 docs/shortcuts.md 对应，此处只列
 * 高频项；完整说明以文档为准）。
 *
 * 触发：`?`（Shift+/）。编辑器模式、输入态、设置/媒体浮层打开时不触发
 * （编辑器有独立键位体系，且避免打断输入）。
 * 平台感知：macOS 显示 ⌘，Windows / Linux 显示 Ctrl。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const MOD = IS_MAC ? '⌘' : 'Ctrl';

  // 分组数据：k 为按键序列（MOD 占位符在 render 时替换）
  const GROUPS = [
    {
      title: 'help.groupReading', fb: '阅读与导航',
      items: [
        { keys: [MOD, 'B'], desc: '折叠 / 展开侧边栏' },
        { keys: [MOD, 'K'], desc: '搜索命令面板（支持拼音与 > 命令模式）' },
        { keys: [MOD, 'F'], desc: '文章内查找' },
        { keys: [MOD, ','], desc: '打开设置面板' },
        { keys: [MOD, '\\'], desc: '双栏对照阅读' },
        { keys: [MOD, 'Alt', 'S'], desc: '开关对照阅读同步滚动' },
        { keys: ['['], desc: '上一篇文档' },
        { keys: [']'], desc: '下一篇文档' },
        { keys: [MOD, 'Alt', '+ / − / 0'], desc: '内容区加宽 / 收窄 / 重置' },
        { keys: [MOD, 'Alt', 'F'], desc: '正文占满可用宽度' },
        { keys: ['Esc'], desc: '关闭当前浮层（面板 / 查找 / 对照 / 菜单）' }
      ]
    },
    {
      title: 'help.groupMedia', fb: '媒体查看',
      items: [
        { keys: ['← / →'], desc: '图片灯箱翻页' },
        { keys: ['+ / − / 0'], desc: '图片灯箱缩放 / 重置' },
        { keys: ['← / →', 'Space'], desc: 'PPTX 放映翻页（Space 仅下一页）' },
        { keys: ['Esc'], desc: '关闭灯箱 / 退出放映' }
      ]
    },
    {
      title: 'help.groupEditor', fb: '内置编辑器',
      note: 'help.groupEditorNote', noteFb: '编辑器模式（?mode=editor）下生效，与文档站键位隔离',
      items: [
        { keys: [MOD, 'Enter'], desc: '运行当前 Cell' },
        { keys: [MOD, 'Shift', 'Enter'], desc: '运行全部 Cell' }
      ]
    },
    {
      title: 'help.groupTouch', fb: '移动端手势',
      items: [
        { keys: ['←→ 滑动'], desc: '移动端翻上一篇 / 下一篇' },
        { keys: ['左缘右滑'], desc: '呼出侧边栏' }
      ]
    }
  ];

  let overlayEl = null;

  function renderKeys(keys) {
    return keys.map(k =>
      `<kbd class="sh-kbd">${esc(k.replace(/MOD/g, MOD))}</kbd>`
    ).join('<span class="sh-plus">+</span>');
  }

  function build() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'shortcut-help-overlay';
    const groupsHtml = GROUPS.map(g => `
      <div class="sh-group">
        <div class="sh-group-title">${esc(t(g.title, g.fb))}</div>
        ${g.note ? `<div class="sh-group-note">${esc(t(g.note, g.noteFb || g.note))}</div>` : ''}
        ${g.items.map(it => `
          <div class="sh-row">
            <span class="sh-keys">${renderKeys(it.keys)}</span>
            <span class="sh-desc">${esc(it.desc)}</span>
          </div>`).join('')}
      </div>`).join('');
    overlayEl.innerHTML = `
      <div class="sh-backdrop"></div>
      <div class="sh-panel" role="dialog" aria-modal="true" aria-label="${esc(t('help.title', '快捷键速查'))}">
        <header class="sh-head">
          <span class="sh-title">${esc(t('help.title', '快捷键速查'))}</span>
          <button type="button" class="sh-close" aria-label="${esc(t('common.close', '关闭'))}">${esc('×')}</button>
        </header>
        <div class="sh-body">${groupsHtml}
          <div class="sh-foot">${esc(t('help.foot', '完整说明见「快捷键」文档；`?` 呼出本面板。'))}</div>
        </div>
      </div>`;
    document.body.appendChild(overlayEl);
    // 同步加 open + 强制 reflow：入场过渡仍生效，且不依赖 rAF
    //（后台标签页 rAF 被节流，异步加 class 会导致面板不显示）
    void overlayEl.offsetWidth;
    overlayEl.classList.add('open');
    overlayEl.querySelector('.sh-close').addEventListener('click', close);
    overlayEl.querySelector('.sh-backdrop').addEventListener('click', close);
  }

  function open() {
    if (overlayEl) return;
    build();
  }

  function close() {
    if (!overlayEl) return;
    const node = overlayEl;
    overlayEl = null;
    node.remove();
  }

  function isOpen() { return !!overlayEl; }

  function isTypingTarget(el) {
    if (!el) return false;
    return el.closest && el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]');
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) { close(); return; }
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.body.classList.contains('editor-mode')) return; // 编辑器独立键位
      if (document.querySelector('.settings-overlay.open, .slides-overlay.open, .split-view-overlay.open, .lightbox')) return;
      e.preventDefault();
      open();
    });
  }

  window.MarkdownPreview.shortcutHelp = { open, close, isOpen };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
