/**
 * sync-tabs - 多标签页状态同步（BroadcastChannel）
 *
 * 同一浏览器多窗口/多标签打开本站时，主题、设置（外观/阅读/宽度等）
 * 与界面语言在一个标签页修改后，其余标签页即时跟随，不再各调各的。
 *
 * 通道消息：
 *   { type: 'theme',    theme }             —— 监听全局 themechange 事件
 *   { type: 'settings', settings }          —— 包装 settings.saveSettings()
 *   { type: 'lang',     lang }              —— 监听 i18n langchange 事件
 *
 * 防回环：应用远端消息期间置 applyingRemote，本地事件处理器据此跳过广播。
 * BroadcastChannel 不可用（旧浏览器 / file:// 某些场景）时静默降级为无同步。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const CHANNEL = 'md-preview-sync';
  let bc = null;
  let applyingRemote = false;

  if (typeof BroadcastChannel !== 'undefined') {
    try { bc = new BroadcastChannel(CHANNEL); } catch (e) { bc = null; }
  }

  function post(message) {
    if (!bc || applyingRemote) return;
    try { bc.postMessage(message); } catch (e) { /* 结构化克隆失败等，忽略 */ }
  }

  function onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    applyingRemote = true;
    try {
      if (msg.type === 'theme' && msg.theme && window.MarkdownPreview.themes) {
        window.MarkdownPreview.themes.setTheme(msg.theme, false);
      } else if (msg.type === 'settings' && msg.settings && typeof msg.settings === 'object') {
        if (window.MarkdownPreview.settings && window.MarkdownPreview.settings.applyRemote) {
          window.MarkdownPreview.settings.applyRemote(msg.settings);
        }
      } else if (msg.type === 'lang' && msg.lang && window.MarkdownPreview.i18n) {
        if (window.MarkdownPreview.i18n.getLang() !== msg.lang) {
          window.MarkdownPreview.i18n.setLang(msg.lang);
        }
      }
    } finally {
      // setLang / setTheme 的内部事件同步派发完后才解除守卫
      setTimeout(() => { applyingRemote = false; }, 0);
    }
  }

  function init() {
    if (!bc) return;
    bc.onmessage = (e) => onMessage(e.data);

    // 主题：theme-manager.js 每次切换都会派发
    window.addEventListener('themechange', (e) => {
      post({ type: 'theme', theme: e.detail && e.detail.theme });
    });

    // 界面语言：i18n.js 每次切换都会派发
    window.addEventListener('langchange', (e) => {
      post({ type: 'lang', lang: e.detail && e.detail.lang });
    });
  }

  window.MarkdownPreview.syncTabs = { init, post };
})();
