/**
 * 全量离线缓存
 *
 * PWA 默认只缓存访问过的文档。本模块提供「缓存全部文档」能力：
 * 把文件树覆盖的所有 .md 逐个 fetch 一遍，由 Service Worker 的
 * fetch 拦截（.md 网络优先 + 成功写入 RUNTIME_CACHE）完成预热，
 * 之后整站文档均可离线阅读。
 *
 * 设置面板按钮触发（settings.js 接线），带进度反馈与取消；
 * 「清除文档缓存」通过 postMessage 让 SW 清空 RUNTIME_CACHE 中的 .md。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const CONCURRENCY = 4;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function docPaths() {
    const fileTree = window.MarkdownPreview.fileTree;
    if (!fileTree || typeof fileTree.getAllFilesInDFSOrder !== 'function') return [];
    return fileTree.getAllFilesInDFSOrder().map(f => f.path);
  }

  function swSupported() {
    return 'serviceWorker' in navigator && location.protocol !== 'file:';
  }

  /**
   * 预热全部文档缓存
   * @param {Object} handlers { onProgress(done, total), shouldContinue() }
   * @returns {Promise<{done: number, failed: number, total: number}>}
   */
  async function cacheAll(handlers) {
    handlers = handlers || {};
    const paths = docPaths();
    const total = paths.length;
    if (total === 0) return { done: 0, failed: 0, total: 0 };

    let done = 0;
    let failed = 0;
    let next = 0;

    async function worker() {
      while (next < paths.length) {
        if (handlers.shouldContinue && !handlers.shouldContinue()) return;
        const path = paths[next++];
        try {
          // 直接 fetch：SW 拦截 .md 请求，网络成功即写入 RUNTIME_CACHE
          const resp = await fetch(path, { cache: 'no-cache' });
          if (!resp.ok) failed++;
        } catch (e) {
          failed++;
        }
        done++;
        if (handlers.onProgress) handlers.onProgress(done, total);
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
    return { done, failed, total };
  }

  /** 清空 SW RUNTIME_CACHE 中的文档缓存（sw.js 处理 CLEAR_DOC_CACHE 消息） */
  function clearDocCache() {
    if (!swSupported()) return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(reg => {
      if (!reg.active) return false;
      reg.active.postMessage({ type: 'CLEAR_DOC_CACHE' });
      return true;
    }).catch(() => false);
  }

  window.MarkdownPreview.offline = {
    docPaths,
    cacheAll,
    clearDocCache,
    swSupported
  };
})();
