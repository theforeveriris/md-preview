/**
 * 代码块阅读模式（A2）+ 通用工具条（A4）+ 源码嵌入（A1）
 *
 * 作用对象：正文 / 编辑器 cell 中的 <pre class="code-block">。
 *
 * 为每个代码块提供：
 *   - 浮层控件（与原生代码块同风格）：语言/标题、行数常显；换行、折叠、
 *     纯文本、复制悬停浮现（触屏常显）
 *   - 行号侧栏（不换行模式下与代码行严格对齐；换行时自动隐藏）
 *   - 长块折叠：默认显示前 N 行，剩余内容以渐变遮罩 + 「展开」按钮呈现
 *   - 源码嵌入块提供「查看源码」链接（A4）
 *
 * 源码嵌入（A1）：
 *   embedded.js 识别 ```code 围栏里的 @[code](path#Lx-Ly lang=js)，
 *   调用本模块 renderCodeEmbed：优先读构建期 code-snippets.json，
 *   否则同源 fetch 路径，再渲染成 code-reader 代码块；失败回退卡片。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const FOLD_PREVIEW_ROWS = 24;   // 折叠态可见行数（约 540px）
  const FOLD_AUTO_MIN = FOLD_PREVIEW_ROWS + 6; // 超过该行数的嵌入块自动折叠

  // 控件统一为图标按钮，悬停显示 title 文字提示
  const ICONS = {
    wrap: '<line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" y1="18" x2="13" y2="18"/>',
    fold: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
    raw: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'
  };

  const BTN = (act, label) =>
    `<button type="button" class="cr-btn" data-act="${act}" title="${esc(label)}" aria-label="${esc(label)}">` +
    `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[act]}</svg></button>`;

  function setBtnTip(btn, text) {
    btn.title = text;
    btn.setAttribute('aria-label', text);
  }

  function lineCount(code) {
    const text = code.textContent;
    if (!text) return 0;
    return text.split('\n').length;
  }

  function buildGutter(code, startLine) {
    const lines = code.textContent.split('\n');
    const from = Math.max(1, startLine || 1);
    const g = document.createElement('span');
    g.className = 'cr-gutter';
    g.setAttribute('aria-hidden', 'true');
    g.textContent = lines.map((_, i) => String(from + i)).join('\n');
    return g;
  }

  function buildHead(pre, opts) {
    opts = opts || {};
    const titleText = opts.title || (pre.querySelector('.code-lang-label')?.textContent || 'code');
    const n = lineCount(pre.querySelector('code'));
    const head = document.createElement('div');
    head.className = 'cr-float';
    const title = document.createElement('span');
    title.className = 'cr-title' + (opts.title ? ' cr-title-path' : '');
    title.textContent = titleText;
    const meta = document.createElement('span');
    meta.className = 'cr-meta';
    meta.textContent = t('codeReader.rows', '{n} 行').replace('{n}', n);
    const actions = document.createElement('span');
    actions.className = 'cr-actions';
    actions.innerHTML =
      BTN('wrap', t('codeReader.wrap', '换行')) +
      (opts.foldable === false ? '' : BTN('fold', t('codeReader.fold', '折叠'))) +
      BTN('raw', t('codeReader.raw', '纯文本'));
    head.appendChild(title);
    head.appendChild(meta);
    head.appendChild(actions);
    return head;
  }

  function enhanceCodeBlock(pre, opts) {
    if (!pre || pre.dataset.crReady) return pre;
    opts = opts || {};
    const code = pre.querySelector('code');
    if (!code) return pre;
    // 仅直接位于 .code-reader 内时视为已增强（源码嵌入会先包一层 .code-embed）
    if (pre.parentElement && pre.parentElement.classList.contains('code-reader')) return pre;
    // 不做普通内联代码
    if (!pre.classList.contains('code-block')) return pre;

    const wrapper = document.createElement('div');
    wrapper.className = 'code-reader';
    pre.parentNode.insertBefore(wrapper, pre);

    const langLabel = pre.querySelector('.code-lang-label');
    const copyBtn = pre.querySelector('.copy-btn');
    const head = buildHead(pre, Object.assign({}, opts, { foldable: lineCount(code) > FOLD_AUTO_MIN }));
    if (langLabel) pre.removeChild(langLabel);
    if (copyBtn) {
      copyBtn.classList.add('cr-copy-btn');
      head.querySelector('.cr-actions').appendChild(copyBtn);
    }

    pre.classList.add('cr-pre');
    pre.insertBefore(buildGutter(code, opts.lineStart), code);

    wrapper.appendChild(pre);

    // 浮层与折叠遮罩挂在 wrapper（pre 是横向滚动容器，挂在里面会随内容滚走），
    // 层级：code z1 < gutter z2 < 折叠遮罩 z3 < 浮层 z4
    const overlay = document.createElement('div');
    overlay.className = 'cr-fold-overlay';
    overlay.innerHTML = '<button type="button" class="cr-fold-btn">' +
      esc(t('codeReader.expand', '展开全部')) + '</button>';
    wrapper.appendChild(overlay);
    wrapper.appendChild(head);
    pre.dataset.crReady = '1';

    const state = { raw: false, folded: false };

    // 短块（≤ 折叠阈值）折叠无意义，隐藏折叠按钮与遮罩
    if (lineCount(code) <= FOLD_AUTO_MIN) {
      wrapper.classList.add('cr-no-fold');
    }

    // 折叠高度按实际渲染行高取整行数，避免裁在半行
    function applyFoldHeight() {
      const n = lineCount(code);
      if (!n) return;
      const total = code.getBoundingClientRect().height;
      const per = total / n;
      const cs = getComputedStyle(pre);
      const padV = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      pre.style.maxHeight = Math.floor(per * FOLD_PREVIEW_ROWS + padV) + 'px';
    }
    function clearFoldHeight() {
      pre.style.maxHeight = '';
    }

    // 源码嵌入的长片段默认折叠，避免整文件撑爆版面
    if (opts.autoFold && lineCount(code) > FOLD_AUTO_MIN) {
      state.folded = true;
      wrapper.classList.add('cr-folded');
      const foldToggle = wrapper.querySelector('[data-act="fold"]');
      if (foldToggle) {
        foldToggle.classList.add('is-active');
        setBtnTip(foldToggle, t('codeReader.unfold', '展开'));
      }
    }
    if (state.folded) applyFoldHeight();

    const btns = wrapper.querySelectorAll('.cr-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const act = btn.dataset.act;
        if (act === 'wrap') {
          const on = wrapper.classList.toggle('cr-wrap');
          if (on) wrapper.classList.add('cr-nowrap-off');
          btn.classList.toggle('is-active', on);
          setBtnTip(btn, on ? t('codeReader.noWrap', '不换行') : t('codeReader.wrap', '换行'));
        } else if (act === 'fold') {
          state.folded = !state.folded;
          wrapper.classList.toggle('cr-folded', state.folded);
          btn.classList.toggle('is-active', state.folded);
          setBtnTip(btn, state.folded ? t('codeReader.unfold', '展开') : t('codeReader.fold', '折叠'));
          if (state.folded) applyFoldHeight(); else clearFoldHeight();
        } else if (act === 'raw') {
          if (!state.raw) {
            code.dataset.crOrig = code.innerHTML;
            code.textContent = code.textContent;
          } else {
            code.innerHTML = code.dataset.crOrig;
            delete code.dataset.crOrig;
          }
          state.raw = !state.raw;
          wrapper.classList.toggle('cr-raw', state.raw);
          btn.classList.toggle('is-active', state.raw);
        }
      });
    });

    const foldBtn = overlay.querySelector('.cr-fold-btn');
    foldBtn.addEventListener('click', () => {
      state.folded = false;
      wrapper.classList.remove('cr-folded');
      clearFoldHeight();
      const foldToggle = wrapper.querySelector('[data-act="fold"]');
      if (foldToggle) {
        foldToggle.classList.remove('is-active');
        setBtnTip(foldToggle, t('codeReader.fold', '折叠'));
      }
    });

    // 主题切换后重算行号对齐不需要（纯文本），但换行宽度变化要重测
    return wrapper;
  }

  // ============== A1 源码嵌入 ==============
  const ALLOWED_CODE_PATHS = /^[A-Za-z0-9_./-]+(\.\w+)?$/;

  function safeCodePath(raw) {
    if (!raw) return null;
    if (raw.includes('..')) return null;
    if (raw.startsWith('/') || raw.startsWith('\\')) return null;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;
    if (!ALLOWED_CODE_PATHS.test(raw)) return null;
    return raw.replace(/^\.\//, '').replace(/\/{2,}/g, '/');
  }

  function parseCodeUrl(url) {
    // 同时支持：path#Lx-Ly、path?lang=js、path#Lx-Ly?lang=js、path#Lx-Ly lang=js
    const params = {};
    let rest = url.replace(/[?&]([A-Za-z][\w-]*)=([^&#\s]*)/g, (_, k, v) => {
      params[k] = decodeURIComponent(v || '');
      return '';
    });
    let range = null;
    const rm = /#L(\d+)(?:-L?(\d+))?/.exec(rest);
    if (rm) {
      range = { start: parseInt(rm[1], 10), end: rm[2] ? parseInt(rm[2], 10) : null };
      rest = rest.slice(0, rm.index);
    }
    return { path: safeCodePath(rest.trim()), range, params };
  }

  function snippetExt(path) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(path);
    return m ? m[1].toLowerCase() : '';
  }

  function fallbackCard(service, url) {
    const div = document.createElement('div');
    div.className = 'code-embed code-embed-fallback';
    div.innerHTML =
      '<div class="code-embed-head"><span class="cr-title">' + esc(service) + '</span>' +
      '<a class="cr-source" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' +
      esc(t('codeReader.open', '打开源文件')) + '</a></div>' +
      '<div class="code-embed-error">' + esc(t('codeReader.fail', '无法读取源码（构建期快照缺失或路径不可访问）')) + '</div>' +
      '<pre class="code-block"><code>' + esc(url) + '</code></pre>';
    return div;
  }

  let snippetsPromise = null;
  function loadSnippets() {
    // 构建期快照整页只取一次，多个嵌入块复用
    if (!snippetsPromise) {
      snippetsPromise = fetch('iris/data/code-snippets.json')
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
    }
    return snippetsPromise;
  }

  async function renderCodeEmbed(el, url, service) {
    const parsed = parseCodeUrl(url);
    if (!parsed.path) { el.replaceWith(fallbackCard(service, url)); return; }

    let text = null;
    let fromSnapshot = false;
    // 1) 构建期快照（离线优先，内容已按 range 切好）
    const snippets = await loadSnippets();
    const key = parsed.path + (parsed.range ? '#L' + parsed.range.start + (parsed.range.end ? '-L' + parsed.range.end : '') : '');
    if (snippets && snippets.snippets && snippets.snippets[key]) {
      text = snippets.snippets[key].content;
      fromSnapshot = true;
    }
    // 2) 运行时同源 fetch
    if (!text) {
      const resp = await fetch('/' + parsed.path.replace(/\\/g, '/'));
      if (!resp.ok) { el.replaceWith(fallbackCard(service, url)); return; }
      text = await resp.text();
    }

    // 快照内容已是切片；fetch 到整文件时才需要按行范围切片
    if (parsed.range && !fromSnapshot) {
      const lines = text.split(/\r?\n/);
      const start = Math.max(1, parsed.range.start);
      const end = Math.min(lines.length, parsed.range.end || lines.length);
      text = lines.slice(start - 1, end).join('\n');
    }

    const lang = parsed.params.lang || snippetExt(parsed.path) || 'text';
    const rangeLabel = parsed.range
      ? '#L' + parsed.range.start + (parsed.range.end ? '-L' + parsed.range.end : '')
      : '';
    const pre = document.createElement('pre');
    pre.className = 'code-block';
    pre.setAttribute('data-lang', lang);
    pre.innerHTML =
      '<button class="copy-btn" title="' + esc(t('codeReader.copy', '复制代码')) + '" aria-label="' + esc(t('codeReader.copy', '复制代码')) + '"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
      '<code class="language-' + esc(lang) + '">' + esc(text) + '</code>';

    const wrap = document.createElement('div');
    wrap.className = 'code-embed';
    wrap.appendChild(pre);
    el.replaceWith(wrap);

    enhanceCodeBlock(pre, {
      title: parsed.path + rangeLabel,
      autoFold: true,
      lineStart: parsed.range ? parsed.range.start : 1
    });
    // 代码块是动态生成的，需要再跑一次语法高亮
    window.MarkdownPreview.mdRender.highlightCodeBlocks(wrap);
  }

  // 由其他渲染器消费的围栏语言：代码块阅读模式不应接管，
  // 否则会先包一层 .code-reader 头部，导致该渲染器替换 pre 时头部残留。
  const RENDERER_OWNED = new Set([
    'mermaid', 'plantuml', 'apexcharts', 'diff', 'geo', 'csv', 'tsv', 'json',
    'sandbox', 'http', 'openapi', 'graph', 'glossary', 'ipcalc', 'config-diff',
    'acl', 'route-table', 'pcap', 'traceroute', 'cli-lab', 'terminal', 'log',
    'clitable', 'har', 'trace', 'lldp', 'cdp', 'nmap', 'dig', 'nslookup', 'bgp',
    'registry', 'kroki', 'vega-lite', 'hotspot', 'clihelp', 'code', 'file', 'ruby',
    'github', 'issue', 'pr', 'release',
    'katex', 'pulse', 'secret', 'pptx', 'twitter', 'x', 'embed', 'pkt',
    'ensp', 'geojson', 'topojson', 'toml', 'dockerfile', 'properties',
    'bits', 'heatmap', 'colorcard', 'colors', 'palette',
    'ping', 'tracert', 'cli'
  ]);

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block').forEach(pre => {
      if (pre.dataset.crReady) return;
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      // 源码嵌入围栏由 embedded.js 在拿到文件内容后再增强
      if (lang === 'code' || lang === 'file') return;
      if (RENDERER_OWNED.has(lang)) return;
      enhanceCodeBlock(pre);
    });
  }

  const api = { render, enhanceCodeBlock, renderCodeEmbed };
  window.MarkdownPreview.renderers.codeReader = api;
  window.MarkdownPreview.codeReader = api;
})();
