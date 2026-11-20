/**
 * ABC 乐谱渲染器（abcjs）
 *
 * Markdown 语法：
 *   ```abc
 *   X:1
 *   T:Scale
 *   M:4/4
 *   L:1/4
 *   K:C
 *   C D E F | G A B c |
 *   ```
 *
 * 可选 JSON 头（用于指弹谱 / 移调等），用 --- 与 ABC 正文分隔：
 *   ```abc
 *   { "tablature": [{ "instrument": "guitar" }] }
 *   ---
 *   X:1
 *   ...
 *   ```
 *
 * 使用本地 iris/vendor/abcjs/abcjs-basic-min.js（MIT），按需加载。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const SCRIPT = 'iris/vendor/abcjs/abcjs-basic-min.js';
  const ALLOWED_OPTIONS = new Set([
    'tablature', 'visualTranspose', 'scale', 'staffwidth', 'responsive',
    'jazzchords', 'noTitles', 'oneSvgPerTune', 'wrap', 'foregroundColor',
    'paddingtop', 'paddingbottom', 'paddingleft', 'paddingright'
  ]);

  let loading = null;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  function esc(value) {
    const fn = window.MarkdownPreview.mdRender && window.MarkdownPreview.mdRender.escapeHtml;
    if (fn) return fn(String(value));
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function icon(name, size) {
    const fn = window.MarkdownPreview.icon;
    if (fn) return fn(name, size || 15);
    return '';
  }

  function ensureAbcjs() {
    if (window.ABCJS) return Promise.resolve();
    if (loading) return loading;
    loading = Promise.resolve(window.MarkdownPreview.loadScript(SCRIPT)).then(() => {
      if (!window.ABCJS) throw new Error('ABCJS not available');
    }).catch(e => {
      loading = null;
      throw e;
    });
    return loading;
  }

  // 可选的 JSON 头 + ---
  function parseSource(source) {
    const text = String(source || '').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    if (i < lines.length && lines[i].trim().charAt(0) === '{') {
      let end = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '---') { end = j; break; }
      }
      if (end !== -1) {
        try {
          const raw = JSON.parse(lines.slice(i, end).join('\n'));
          const opts = {};
          if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
            Object.keys(raw).forEach(k => {
              if (ALLOWED_OPTIONS.has(k)) opts[k] = raw[k];
            });
          }
          return { abc: lines.slice(end + 1).join('\n'), options: opts };
        } catch (e) {
          // JSON 头无效时按普通 ABC 处理
        }
      }
    }
    return { abc: text, options: {} };
  }

  function themeColor(widget) {
    const cs = window.getComputedStyle(widget);
    return cs.getPropertyValue('--color-text').trim() || '#2d2d2d';
  }

  function fallback(stage, source, note) {
    stage.innerHTML =
      '<div class="abc-fallback">' +
        '<div class="abc-fallback-note">' + esc(note || t('abc.failed', '乐谱渲染失败，已保留源码')) + '</div>' +
        '<div class="abc-fallback-actions">' +
          '<a href="https://abcjs.net/abcjs-editor.html" target="_blank" rel="noopener noreferrer">' +
            esc(t('abc.openEditor', '在 ABCJS 编辑器打开')) + '</a>' +
        '</div>' +
        '<pre class="code-block"><code class="language-abc">' + esc(source) + '</code></pre>' +
      '</div>';
  }

  function exportSvg(widget, stage) {
    const svgs = Array.from(stage.querySelectorAll('svg'));
    if (!svgs.length) return;
    const color = themeColor(widget);
    const style = '<style>' +
      'svg{background:transparent}' +
      'text{font-family:Georgia,serif}' +
      '.abcjs-note,.abcjs-staff,.abcjs-bar,.abcjs-slur,.abcjs-beam{fill:' + color + ';stroke:' + color + '}' +
      '</style>';

    let out;
    if (svgs.length === 1) {
      const svg = svgs[0].cloneNode(true);
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svg.insertAdjacentHTML('afterbegin', style);
      out = new XMLSerializer().serializeToString(svg);
    } else {
      let width = 0;
      let height = 0;
      const parts = [];
      svgs.forEach(svg => {
        const vb = svg.viewBox && svg.viewBox.baseVal;
        const w = vb && vb.width ? vb.width : 800;
        const h = vb && vb.height ? vb.height : 200;
        width = Math.max(width, w);
        parts.push({ svg: svg, y: height, w: w, h: h });
        height += h;
      });
      let inner = '';
      parts.forEach(p => {
        inner += '<g transform="translate(0,' + p.y + ')">' + p.svg.innerHTML + '</g>';
      });
      out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
        '" viewBox="0 0 ' + width + ' ' + height + '">' + style + inner + '</svg>';
    }

    const blob = new Blob([out], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'score.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildWidget(pre, source) {
    const parsed = parseSource(source);
    const card = document.createElement('div');
    card.className = 'abc-score w-has-float';

    const toolbar = document.createElement('div');
    toolbar.className = 'w-float';
    const exportLabel = t('abc.export', '导出 SVG');
    toolbar.innerHTML = '<button type="button" class="icon-btn abc-btn" data-act="svg" data-tip="' +
      esc(exportLabel) + '" title="' + esc(exportLabel) + '" aria-label="' + esc(exportLabel) + '">' +
      icon('i-download', 15) + '<span class="icon-btn-label">' + esc(exportLabel) + '</span></button>';
    card.appendChild(toolbar);

    const stage = document.createElement('div');
    stage.className = 'abc-stage';
    stage.innerHTML = '<div class="abc-loading">' + esc(t('abc.loading', '正在加载乐谱…')) + '</div>';
    card.appendChild(stage);

    pre.replaceWith(card);

    ensureAbcjs().then(() => {
      stage.innerHTML = '';
      const options = Object.assign({
        responsive: 'resize',
        scale: 1.1,
        add_classes: true,
        oneSvgPerTune: false,
        foregroundColor: themeColor(card)
      }, parsed.options);

      let tunes;
      try {
        tunes = window.ABCJS.renderAbc(stage, parsed.abc, options);
      } catch (e) {
        console.warn('[abc] render failed:', e);
        fallback(stage, source, t('abc.failed', '乐谱渲染失败，已保留源码'));
        return;
      }
      if (!stage.querySelector('svg')) {
        fallback(stage, source, t('abc.failed', '乐谱渲染失败，已保留源码'));
        return;
      }
      card.classList.add('is-ready');

      const warnings = [];
      (tunes || []).forEach(tune => {
        if (tune && Array.isArray(tune.warnings)) tune.warnings.forEach(w => warnings.push(String(w)));
      });
      if (warnings.length) {
        const note = document.createElement('div');
        note.className = 'abc-warn';
        note.textContent = t('abc.warnings', '提示：') + warnings.slice(0, 4).join('；');
        card.appendChild(note);
      }
    }).catch(e => {
      console.warn('[abc] abcjs load failed:', e);
      stage.innerHTML = '';
      fallback(stage, source, t('abc.loadFailed', 'ABCJS 加载失败，已保留源码'));
    });

    toolbar.querySelector('[data-act="svg"]').addEventListener('click', () => exportSvg(card, stage));
    return card;
  }

  function render(root) {
    const mdRender = window.MarkdownPreview.mdRender;
    const scope = mdRender && mdRender.resolveRoot
      ? mdRender.resolveRoot(root)
      : (root || document.getElementById('markdownContent'));
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="abc"], pre.code-block[data-lang^="music"]');
    blocks.forEach(pre => {
      if (pre.dataset.abcDone) return;
      pre.dataset.abcDone = '1';
      buildWidget(pre, (pre.querySelector('code') || pre).textContent || '');
    });
  }

  window.MarkdownPreview.renderers.abc = {
    render: render,
    parseSource: parseSource
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseSource: parseSource };
  }
})();
