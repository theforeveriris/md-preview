/**
 * 代码块 live 预览沙箱
 *
 * Markdown 语法（fence 信息串追加 live 标记触发，避免接管既有展示型代码块）：
 *   ```html live   完整 HTML 片段，原样进沙箱渲染
 *   ```js live     JavaScript，console 输出显示在预览下方面板
 *   ```css live    样式预览：预置一组示例骨架（标题/段落/按钮/列表），用户 CSS 叠加其上
 *
 * 安全模型：iframe sandbox="allow-scripts allow-forms allow-modals allow-popups"
 * （刻意不带 allow-same-origin），脚本运行在 opaque origin，无法访问父页面
 * DOM / localStorage / cookie；srcdoc 通过属性赋值（非字符串拼接进文档）。
 *
 * 交互：默认不自动执行（避免未知脚本惊扰与首屏卡顿），点击「运行」后
 * 构建沙箱；「重置」销毁沙箱回到源码态。支持首行注释声明高度：
 *   <!-- height: 480 -->  （html/css）
 *   // height: 480        （js）
 *
 * 由 markdown.js 渲染管线在文档渲染后调用 render()（与 csvtable 同链）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const LANG_ALIASES = { html: 'html', js: 'js', javascript: 'js', css: 'css' };
  const DEFAULT_HEIGHT = { html: 320, js: 240, css: 320 };
  const MAX_SRC = 256 * 1024;

  // 解析 fence 信息串："html live" → { lang: 'html', live: true }
  function parseInfo(rawLang) {
    const parts = String(rawLang || '').toLowerCase().trim().split(/\s+/);
    return {
      lang: LANG_ALIASES[parts[0]] || null,
      live: parts.includes('live')
    };
  }

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function icon(name, size) {
    return `<svg width="${size || 14}" height="${size || 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#${name}"/></svg>`;
  }

  // 首行注释里的 height: N（允许分号 / 空格；N 限制在 120~2000）
  function parseHeight(src, lang) {
    const first = src.split('\n', 1)[0] || '';
    const m = first.match(/height\s*[:=]\s*(\d{3,4})/i);
    if (!m) return DEFAULT_HEIGHT[lang];
    return Math.min(2000, Math.max(120, parseInt(m[1], 10)));
  }

  function stripHeightComment(src, lang) {
    const lines = src.split('\n');
    if (/height\s*[:=]\s*\d{3,4}/i.test(lines[0] || '')) lines.shift();
    return lines.join('\n');
  }

  // ============== 沙箱文档构建 ==============

  function consoleCaptureScript() {
    return `<script>
(function(){
  var out = document.getElementById('__out');
  function fmt(args){
    return Array.prototype.map.call(args, function(v){
      try { return (v && typeof v === 'object') ? JSON.stringify(v, null, 2) : String(v); }
      catch (e) { return String(v); }
    }).join(' ');
  }
  ['log','info','warn','error'].forEach(function(k){
    var orig = console[k];
    console[k] = function(){
      var line = document.createElement('div');
      line.className = '__line __' + k;
      line.textContent = fmt(arguments);
      out.appendChild(line);
      if (orig) orig.apply(console, arguments);
    };
  });
  window.addEventListener('error', function(e){
    var line = document.createElement('div');
    line.className = '__line __error';
    line.textContent = 'Uncaught ' + (e.message || 'error');
    out.appendChild(line);
  });
})();
<\/script>`;
  }

  function buildJsDoc(userCode) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 10px 14px; font: 13px/1.6 ui-monospace, Consolas, monospace; background: transparent; color: #1f2328; }
  #__out:empty::after { content: '${t('sandbox.consoleEmpty', '没有 console 输出。用 console.log() 试试')}'; opacity: .55; }
  .__line { white-space: pre-wrap; word-break: break-word; padding: 1px 0; }
  .__line.__warn { color: #9a6700; }
  .__line.__error { color: #cf222e; }
  .__line.__info { color: #0550ae; }
  @media (prefers-color-scheme: dark) {
    body { color: #e6edf3; }
    .__line.__warn { color: #d29922; }
    .__line.__error { color: #f85149; }
    .__line.__info { color: #58a6ff; }
  }
</style>
${consoleCaptureScript()}
</head><body><div id="__out"></div>
<script>
try {
(function(){
${userCode}
})();
} catch (err) { console.error((err && err.message) || String(err)); }
<\/script></body></html>`;
  }

  function buildHtmlDoc(userHtml) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin: 12px; font-family: system-ui, sans-serif; }</style>
</head><body>
${userHtml}
</body></html>`;
  }

  function buildCssDoc(userCss) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { margin: 12px; font-family: system-ui, sans-serif; color: #1f2328; }
  .__box { width: 120px; height: 72px; margin-top: 10px; background: #ececec; border-radius: 6px; }
</style>
</head><body>
<main>
  <h1>Heading 1</h1>
  <h2>Heading 2</h2>
  <p>${t('sandbox.cssSampleText', '这是一段示例文本，包含 ')}<a href="#">${t('sandbox.cssSampleLink', '链接')}</a>、<strong>${t('sandbox.cssSampleBold', '加粗')}</strong> 与 <code>code</code>。</p>
  <button type="button">${t('sandbox.cssSampleButton', '按钮')}</button>
  <ul><li>${t('sandbox.cssSampleList', '列表项一')}</li><li>${t('sandbox.cssSampleList2', '列表项二')}</li></ul>
  <div class="__box"></div>
</main>
<style>${userCss}</style>
</body></html>`;
  }

  // ============== 组件 ==============

  function buildWidget(pre, lang) {
    const code = pre.querySelector('code');
    const raw = stripHeightComment(code ? code.textContent : '', lang);
    const height = parseHeight(code ? code.textContent : '', lang);

    const widget = document.createElement('div');
    widget.className = 'sandbox-widget';
    widget.dataset.lang = lang;

    const toolbar = document.createElement('div');
    toolbar.className = 'sandbox-toolbar';
    toolbar.innerHTML = `
      <span class="sandbox-lang">${lang.toUpperCase()}</span>
      <span class="sandbox-hint">${t('sandbox.hint', '脚本在隔离沙箱中运行')}</span>
      <span class="sandbox-actions">
        <button type="button" class="sandbox-btn sandbox-run">${icon('i-play', 13)}<span>${t('sandbox.run', '运行')}</span></button>
        <button type="button" class="sandbox-btn sandbox-reset" hidden>${icon('i-refresh', 13)}<span>${t('sandbox.reset', '重置')}</span></button>
      </span>
    `;

    const stage = document.createElement('div');
    stage.className = 'sandbox-stage';
    stage.style.height = height + 'px';

    const placeholder = document.createElement('div');
    placeholder.className = 'sandbox-placeholder';
    placeholder.innerHTML = `<button type="button" class="sandbox-big-run">${icon('i-play', 22)}<span>${t('sandbox.runPreview', '点击运行预览')}</span></button>`;
    stage.appendChild(placeholder);

    // 源码折叠区：保留原代码块（复制按钮等原能力不变）。
    // 注意：pre 在 replaceChild 之后才挂入 details（widget 不能先包含 pre
    // 再去替换 pre 自己，会触发 HierarchyRequestError）
    const details = document.createElement('details');
    details.className = 'sandbox-source';
    const summary = document.createElement('summary');
    summary.textContent = t('sandbox.source', '源码');
    details.appendChild(summary);

    toolbar.addEventListener('click', (e) => {
      const runBtn = e.target.closest('.sandbox-run, .sandbox-big-run');
      const resetBtn = e.target.closest('.sandbox-reset');
      if (runBtn) {
        const doc = lang === 'js' ? buildJsDoc(raw)
          : lang === 'css' ? buildCssDoc(raw)
          : buildHtmlDoc(raw);
        const frame = document.createElement('iframe');
        frame.className = 'sandbox-frame';
        frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
        frame.setAttribute('title', t('sandbox.frameTitle', '代码运行预览'));
        frame.srcdoc = doc;
        stage.innerHTML = '';
        stage.appendChild(frame);
        stage.classList.add('running');
        toolbar.querySelector('.sandbox-run').hidden = true;
        const reset = toolbar.querySelector('.sandbox-reset');
        reset.hidden = false;
      } else if (resetBtn) {
        stage.innerHTML = '';
        stage.appendChild(placeholder);
        stage.classList.remove('running');
        toolbar.querySelector('.sandbox-run').hidden = false;
        toolbar.querySelector('.sandbox-reset').hidden = true;
      }
    });

    widget.appendChild(toolbar);
    widget.appendChild(stage);
    widget.appendChild(details);
    return widget;
  }

  // ============== 入口：替换带 live 标记的 html/js/css 代码块 ==============
  function render(root) {
    const scope = root || document;
    const blocks = scope.querySelectorAll('.markdown-body pre.code-block[data-lang]');
    blocks.forEach(pre => {
      if (pre.dataset.sandboxDone) return;
      const info = parseInfo(pre.dataset.lang);
      if (!info.lang || !info.live) return;
      const code = pre.querySelector('code');
      if (!code || !code.textContent.trim() || code.textContent.length > MAX_SRC) return;
      pre.dataset.sandboxDone = '1';
      const widget = buildWidget(pre, info.lang);
      pre.parentNode.replaceChild(widget, pre);
      // pre 已脱离 DOM，此时挂入 widget 内的源码折叠区（避免容器嵌套自身）
      widget.querySelector('.sandbox-source').appendChild(pre);
    });
  }

  window.MarkdownPreview.renderers.sandbox = { render };
})();
