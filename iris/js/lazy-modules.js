/**
 * 按需加载器（PERF：首屏脚本瘦身）
 *
 * 编辑器全家桶（codemirror.min.js + cm-editor.js + editor.js ≈ 300KB+）
 * 与波形生成器（pulse-generator.js）纯阅读模式用不到：从 index.html 的
 * defer 列表移除，对应隐藏 HTML 移入 <template> 不参与首屏解析；
 * 进入对应模式（?mode=editor/pulsegen 或点击入口）时先注入模板再经
 * dom.js#loadScript 按序拉取。
 *
 * 机制：把 MarkdownPreview.enterEditorMode / enterPulseGen 换成加载 shim；
 * 目标脚本加载后 IIFE 会用真实实现覆盖 shim（editor.js/pulse-generator.js
 * 末尾都有 `window.MarkdownPreview.enterXxx = enterXxx`），shim 内重新调用
 * 同名函数即命中真实实现。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  const MP = window.MarkdownPreview;

  // 模板注入：把 <template> 的顶层节点搬进 body（编辑器初始化依赖这些
  // 元素已存在——editor.js 顶层就要 getElementById）
  function injectTemplate(id) {
    const tpl = document.getElementById(id);
    if (tpl) {
      document.body.appendChild(tpl.content);
      tpl.remove();
    }
  }

  function loadOnce(key, srcs) {
    loadOnce.cache = loadOnce.cache || {};
    if (!loadOnce.cache[key]) {
      const chain = srcs.reduce(
        (p, src) => p.then(() => MP.loadScript(src)),
        Promise.resolve()
      );
      loadOnce.cache[key] = chain.catch(e => {
        delete loadOnce.cache[key]; // 允许失败后重试
        console.error('[lazy-modules] ' + srcs.join(' → ') + ' 加载失败:', e);
        throw e;
      });
    }
    return loadOnce.cache[key];
  }

  // ---- 编辑器（codemirror → cm-editor → editor 顺序不可乱） ----
  MP.enterEditorMode = function() {
    injectTemplate('tplEditorHtml');
    loadOnce('editor', [
      'iris/vendor/codemirror/codemirror.min.js',
      'iris/js/cm-editor.js',
      'iris/js/editor/completions.js',
      'iris/js/editor/find-replace.js',
      'iris/js/editor/media-upload.js',
      'iris/js/editor/version-snapshots.js',
      'iris/js/editor/mermaid-pip.js',
      'iris/js/editor/table-editor.js',
      'iris/js/editor.js'
    ]).then(() => {
      // editor.js 已覆盖本 shim：再调一次命中的就是真实实现
      if (typeof MP.enterEditorMode === 'function' && !MP.enterEditorMode._isLazyShim) {
        MP.enterEditorMode();
      }
    });
  };
  MP.enterEditorMode._isLazyShim = true;

  // URL 直达编辑器模式（替代 editor.js 内部的 checkEditorMode）
  if (new URLSearchParams(window.location.search).get('mode') === 'editor') {
    MP.enterEditorMode();
  }

  // ---- 波形生成器 ----
  MP.enterPulseGen = function() {
    injectTemplate('tplPulseGenHtml');
    loadOnce('pulsegen', ['iris/js/pulse-generator.js']).then(() => {
      if (typeof MP.enterPulseGen === 'function' && !MP.enterPulseGen._isLazyShim) {
        MP.enterPulseGen();
      }
    });
  };
  MP.enterPulseGen._isLazyShim = true;

  if (new URLSearchParams(window.location.search).get('mode') === 'pulsegen') {
    MP.enterPulseGen();
  }
})();
