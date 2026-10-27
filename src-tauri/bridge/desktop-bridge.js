/**
 * 桌面端（Tauri）桥接脚本
 *
 * 只在 Tauri 里生效（靠 IPC 是否存在判断），由 iris/scripts/build-desktop-dist.js
 * 注入到 dist/index.html；不参与网页版发布。
 *
 * 解决两件事：
 *   1. 站点的 interceptLinks 明确跳过 http(s) 外链，点下去 WebView 会**把整个应用导航走**。
 *      这里在捕获阶段拦下外链，改交给系统默认浏览器。
 *   2. 站点里有 window.open / target="_blank" 的用法（如「编辑此页」），同样转交出去。
 *
 * 走的是应用自己的 Rust 命令 open_external（src-tauri/src/main.rs），
 * 不依赖任何 Tauri 插件的 JS 绑定与权限作用域。
 */
(function () {
  'use strict';

  // withGlobalTauri 注入 __TAURI__；__TAURI_INTERNALS__ 始终存在，作为兜底
  const invoke =
    (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) ||
    (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);

  if (typeof invoke !== 'function') return;

  const isExternal = (href) => /^(https?:)?\/\//i.test(String(href || ''));

  const open = (raw) => {
    const url = raw.startsWith('//') ? location.protocol + raw : raw;
    Promise.resolve(invoke('open_external', { url })).catch((err) => {
      console.warn('[Desktop] 打开外链失败:', url, err);
    });
  };

  // 捕获阶段：站点自己的 click 处理器不再有机会把应用导航走
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      const href = a.getAttribute('href');
      if (!isExternal(href)) return;
      e.preventDefault();
      open(href);
    },
    true
  );

  // window.open → 系统浏览器（只接管外链，其余保持原行为）
  const nativeOpen = window.open;
  window.open = function (url, ...rest) {
    if (typeof url === 'string' && isExternal(url)) {
      open(url);
      return null;
    }
    return nativeOpen.apply(window, [url, ...rest]);
  };

  // ============== 桌面端自动更新 ==============
  // 复用站点的 #updateToast 横幅（桌面端 SW 已禁用，不冲突）。
  // 更新端点与签名公钥在 src-tauri/tauri.conf.json 的 plugins.updater 配置。
  async function checkForUpdate() {
    if (!document.getElementById('updateToast')) return;
    let info;
    try {
      info = await invoke('check_update');
    } catch (err) {
      return; // 端点未配置 / 离线 / 公钥未配置：静默跳过
    }
    if (!info) return;

    const toast = document.getElementById('updateToast');
    const refreshBtn = document.getElementById('updateRefreshBtn');
    const text = toast.querySelector('.update-toast-text');
    if (text) {
      text.textContent = '桌面端新版本 v' + info.version + ' 可用，点击「更新」安装';
    }
    if (refreshBtn) {
      refreshBtn.textContent = '更新';
      refreshBtn.onclick = async () => {
        if (text) text.textContent = '正在下载更新…';
        try {
          await invoke('install_update');
          // Windows 上 install 完成会自动退出重启；到这里通常已经不在了
          if (text) text.textContent = '更新完成，即将重启…';
        } catch (err) {
          if (text) text.textContent = '更新失败：' + (err && err.message || err);
        }
      };
    }
    toast.classList.add('show');
  }

  // 启动后错峰检查，避免与首屏渲染抢资源
  setTimeout(checkForUpdate, 5000);
})();
