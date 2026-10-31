/**
 * PWA 启动逻辑（原 index.html 内联脚本外提）
 *
 * 外提原因：Tauri 桌面端 CSP 的 script-src 要去掉 'unsafe-inline'，
 * 内联 <script> 会被策略拦截，安装按钮/Service Worker 注册全部失效。
 *
 * 行为与原来的内联脚本一致：注册 Service Worker、接管 beforeinstallprompt、
 * 维护「安装到本地」按钮的显隐与点击。作为 defer 脚本加载，
 * 执行时机从「解析到该位置」变为「解析完成后」，本模块不依赖解析期状态。
 */
(function() {
  'use strict';

  // 用户可见文案统一走 i18n 权威实现（键缺失时回退中文）
  function t(key, fallback) {
    const i18n = window.MarkdownPreview && window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  let deferredPrompt = null;
  let swRegistration = null;

  function showInstallButton() {
    const installBtn = document.getElementById('installPwaBtn');
    if (installBtn) {
      installBtn.style.display = 'flex';
      console.log('[PWA] Install button shown');
    }
  }

  function hideInstallButton() {
    const installBtn = document.getElementById('installPwaBtn');
    if (installBtn) {
      installBtn.style.display = 'none';
      console.log('[PWA] Install button hidden');
    }
  }

  function checkStandaloneMode() {
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone ||
        document.referrer.includes('android-app://')) {
      console.log('[PWA] App is running in standalone mode');
      hideInstallButton();
      return true;
    }
    return false;
  }

  function registerServiceWorker() {
    // 桌面端（Tauri）里所有资源都已在本地包内，SW 的缓存拦截没有意义，
    // 自定义协议下注册也容易出问题 —— 直接跳过。网页版行为不变。
    if (window.__TAURI_INTERNALS__) return;
    if ('serviceWorker' in navigator) {
      // 每次都以 no-cache 拉取 sw.js，保证部署后新版本能被浏览器发现
      fetch('sw.js', { cache: 'no-store' })
        .then(() => {
          return navigator.serviceWorker.register('sw.js', {
            scope: './',
            updateViaCache: 'none'
          });
        })
        .then(reg => {
          swRegistration = reg;
          console.log('[PWA] Service Worker registered, scope:', reg.scope);

          // 每次进入页面主动触发一次 update 检查
          try { reg.update && reg.update(); } catch (_) { /* ignore */ }

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              console.log('[PWA] Worker state:', newWorker.state);
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });

          if (navigator.serviceWorker.controller) {
            console.log('[PWA] Service Worker is active');
          }
        })
        .catch(err => {
          console.error('[PWA] Service Worker registration failed:', err);
        });

      // 新 SW 接管后显示更新提示
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        showUpdateToast();
      });
    }
  }

  function showUpdateToast() {
    // 避免首次安装时触发
    if (!sessionStorage.getItem('sw-first-load')) {
      sessionStorage.setItem('sw-first-load', '1');
      return;
    }
    const toast = document.getElementById('updateToast');
    if (!toast) return;
    // 「查看本次更新」：跳转变更日志最新一段（构建期按日期分节，第一节即本次）
    const clBtn = document.getElementById('updateChangelogBtn');
    if (clBtn) {
      clBtn.hidden = false;
      clBtn.addEventListener('click', () => {
        dismissUpdateToast();
        const markdown = window.MarkdownPreview.markdown;
        if (!markdown || !markdown.loadMarkdownFile) return;
        markdown.loadMarkdownFile('docs/changelog.md').then(() => {
          setTimeout(() => {
            const h2 = document.querySelector('#markdownContent h2');
            if (h2) {
              h2.scrollIntoView({ behavior: 'smooth', block: 'start' });
              h2.classList.add('changelog-flash');
              setTimeout(() => h2.classList.remove('changelog-flash'), 2400);
            }
          }, 350);
        });
      });
    }
    toast.classList.add('show');
  }

  function dismissUpdateToast() {
    const toast = document.getElementById('updateToast');
    if (toast) toast.classList.remove('show');
  }

  function handleBeforeInstallPrompt(e) {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt fired');
    showInstallButton();
  }

  function showInstallProgress() {
    const menuItems = document.querySelector('.menu-items');
    if (menuItems) {
      const progressDiv = document.createElement('div');
      progressDiv.className = 'install-progress';
      progressDiv.innerHTML = `
        <div class="install-progress-spinner"></div>
        <span>${t('pwa.installing', '正在安装中...')}</span>
      `;
      menuItems.appendChild(progressDiv);
    }
  }

  function hideInstallProgress() {
    const progressDiv = document.querySelector('.install-progress');
    if (progressDiv) {
      progressDiv.remove();
    }
  }

  function handleInstallClick() {
    if (deferredPrompt) {
      const installBtn = document.getElementById('installPwaBtn');
      if (installBtn) {
        installBtn.classList.add('loading');
      }
      showInstallProgress();

      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choiceResult => {
        console.log('[PWA] User choice:', choiceResult.outcome);
        hideInstallProgress();

        if (installBtn) {
          installBtn.classList.remove('loading');
        }

        deferredPrompt = null;
        if (choiceResult.outcome === 'accepted') {
          hideInstallButton();
        }
      }).catch(err => {
        console.error('[PWA] Install prompt error:', err);
        hideInstallProgress();

        if (installBtn) {
          installBtn.classList.remove('loading');
        }
        deferredPrompt = null;
      });
    } else {
      console.log('[PWA] No install prompt available');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    checkStandaloneMode();

    window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
      checkStandaloneMode();
    });

    registerServiceWorker();

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      hideInstallButton();
      deferredPrompt = null;
    });

    const installBtn = document.getElementById('installPwaBtn');
    if (installBtn) {
      installBtn.addEventListener('click', handleInstallClick);
    }

    const updateRefreshBtn = document.getElementById('updateRefreshBtn');
    if (updateRefreshBtn) {
      // 单次刷新生效：等 waiting SW 接管（controllerchange）后再 reload，
      // 否则 reload 时页面仍由旧 SW 控制、静态资源命中旧缓存（要刷两次）
      updateRefreshBtn.addEventListener('click', () => {
        let reloaded = false;
        const doReload = () => { if (!reloaded) { reloaded = true; window.location.reload(); } };
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
          // 兜底：600ms 内没触发 controllerchange（如无 waiting SW）也照常刷新
          setTimeout(doReload, 600);
        } else {
          doReload();
        }
      });
    }
    const updateDismissBtn = document.getElementById('updateDismissBtn');
    if (updateDismissBtn) {
      updateDismissBtn.addEventListener('click', dismissUpdateToast);
    }

    setTimeout(() => {
      if (!deferredPrompt && !checkStandaloneMode()) {
        console.log('[PWA] Checking if installable after 5 seconds');
      }
    }, 5000);
  });

  // ============== 字体 CSS 激活 ==============
  // 字体样式表用 media="print" 非阻塞加载，加载完成后再切回 all。
  // 原来写在 <link onload="this.media='all'"> 里，CSP 收紧后内联事件会被拦截。
  (function activateDeferredFontCss() {
    const link = document.getElementById('googleFontsCss');
    if (!link) return;
    const apply = () => { link.media = 'all'; };
    link.addEventListener('load', apply);
    // 命中缓存时 load 可能已经错过，直接看 sheet 是否就绪
    if (link.sheet) apply();
    setTimeout(() => { if (link.sheet && link.media !== 'all') apply(); }, 1500);
  })();

})();