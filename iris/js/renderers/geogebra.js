/**
 * GeoGebra 嵌入与命令渲染
 *
 * 两种用法：
 *   1) 嵌入公开材料
 *      @[geogebra](https://www.geogebra.org/m/xxxxxxx)
 *      @[geogebra](xxxxxxx)
 *
 *   2) 用命令直接画图
 *      ```geogebra
 *      app: graphing
 *      height: 420
 *      showAlgebraInput: true
 *      commands:
 *        - f(x) = sin(x)
 *        - (1, 2)
 *        - g(x) = f'(x)
 *      ```
 *
 * 命令模式依赖 geogebra.org 的 deployggb.js 与 GeoGebra Apps（外部服务）。
 * 默认点击占位卡后才加载，避免文档页一次初始化多个 applet。
 * GeoGebra 采用非商业许可；商用需另行取得授权。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const APPS = ['graphing', 'geometry', 'classic', '3d', 'spreadsheet', 'probability', 'cas'];
  const DEFAULT_SCRIPT = 'https://www.geogebra.org/apps/deployggb.js';

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

  function parseBool(value, fallback) {
    const v = String(value || '').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].indexOf(v) !== -1) return true;
    if (['false', '0', 'no', 'off'].indexOf(v) !== -1) return false;
    return fallback;
  }

  function unquote(value) {
    const v = String(value || '').trim();
    if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) {
      return v.slice(1, -1);
    }
    return v;
  }

  // 解析轻量 YAML 头 + 命令列表；没有头时整段都按命令处理
  function parseSpec(source) {
    const spec = {
      app: 'graphing',
      width: null,
      height: 420,
      showMenuBar: false,
      showAlgebraInput: false,
      showToolBar: false,
      showResetIcon: true,
      showFullscreenButton: true,
      language: 'zh',
      auto: false,
      title: '',
      base64: '',
      commands: []
    };
    const lines = String(source || '').split(/\r?\n/);
    let inCommands = false;
    let sawHeader = false;
    const known = {
      app: 1, width: 1, height: 1, showmenubar: 1, showalgebrainput: 1,
      showtoolbar: 1, showreseticon: 1, showfullscreenbutton: 1,
      language: 1, auto: 1, title: 1, base64: 1, commands: 1
    };

    lines.forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
      if (!inCommands && m && known[m[1].toLowerCase()]) {
        sawHeader = true;
        const key = m[1].toLowerCase();
        const value = unquote(m[2]);
        if (key === 'commands') {
          inCommands = true;
          if (value) spec.commands.push(value);
        } else if (key === 'app') {
          spec.app = value.toLowerCase();
        } else if (key === 'width') {
          spec.width = parseInt(value, 10) || null;
        } else if (key === 'height') {
          spec.height = parseInt(value, 10) || 420;
        } else if (key === 'showmenubar') {
          spec.showMenuBar = parseBool(value, false);
        } else if (key === 'showalgebrainput') {
          spec.showAlgebraInput = parseBool(value, false);
        } else if (key === 'showtoolbar') {
          spec.showToolBar = parseBool(value, false);
        } else if (key === 'showreseticon') {
          spec.showResetIcon = parseBool(value, true);
        } else if (key === 'showfullscreenbutton') {
          spec.showFullscreenButton = parseBool(value, true);
        } else if (key === 'language') {
          spec.language = value || 'zh';
        } else if (key === 'auto') {
          spec.auto = parseBool(value, false);
        } else if (key === 'title') {
          spec.title = value;
        } else if (key === 'base64') {
          spec.base64 = value;
        }
        return;
      }

      if (inCommands) {
        spec.commands.push(line.replace(/^-\s+/, ''));
        return;
      }

      // 没有 YAML 头：整段都是命令；有头但出现非命令行时也按命令处理
      spec.commands.push(line.replace(/^-\s+/, ''));
    });

    if (APPS.indexOf(spec.app) === -1) spec.app = 'graphing';
    if (spec.height < 240) spec.height = 240;
    if (spec.height > 900) spec.height = 900;
    if (spec.width) spec.width = Math.max(320, Math.min(1600, spec.width));
    return spec;
  }

  function scriptUrl() {
    const cfg = window.MarkdownPreview.CONFIG || {};
    return cfg.geogebraScript || DEFAULT_SCRIPT;
  }

  function ensureScript() {
    if (window.GGBApplet) return Promise.resolve();
    return Promise.resolve(window.MarkdownPreview.loadScript(scriptUrl())).then(() => {
      if (!window.GGBApplet) throw new Error('GGBApplet not available');
    });
  }

  function commandList(spec) {
    return spec.commands.filter(c => c && c.trim());
  }

  function openLink(app) {
    const map = {
      graphing: 'graphing',
      geometry: 'geometry',
      classic: 'classic',
      '3d': '3d',
      spreadsheet: 'spreadsheet',
      probability: 'probability',
      cas: 'cas'
    };
    return 'https://www.geogebra.org/' + (map[app] || 'classic');
  }

  function materialId(value) {
    const s = String(value || '').trim();
    const m = /geogebra\.org\/m\/([A-Za-z0-9_-]+)/i.exec(s);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{6,}$/.test(s)) return s;
    return null;
  }

  // ---------- 材料嵌入 ----------

  function renderEmbed(el, value) {
    const id = materialId(value);
    if (!id) {
      el.innerHTML = '<div class="geogebra-fallback"><div class="geogebra-fallback-note">' +
        esc(t('geogebra.invalid', '无法识别 GeoGebra 材料 ID 或链接')) + '</div></div>';
      return;
    }
    el.classList.add('geogebra-card', 'geogebra-embed');
    el.innerHTML =
      '<div class="geogebra-head">' +
        '<span class="geogebra-badge">GeoGebra</span>' +
        '<span class="geogebra-title">' + esc(t('geogebra.embed', 'GeoGebra 材料') + ' · ' + id) + '</span>' +
        '<a class="geogebra-open" href="https://www.geogebra.org/m/' + esc(id) +
          '" target="_blank" rel="noopener noreferrer">' + esc(t('geogebra.open', '在新窗口打开')) + '</a>' +
      '</div>' +
      '<div class="geogebra-stage">' +
        '<div class="geogebra-placeholder">' +
          '<button type="button" class="geogebra-load">' + icon('i-play', 16) +
            '<span>' + esc(t('geogebra.load', '加载交互图')) + '</span></button>' +
          '<p class="geogebra-hint">' + esc(t('geogebra.hint', '交互图由 geogebra.org 提供；点击后才会加载。')) + '</p>' +
        '</div>' +
      '</div>';

    const stage = el.querySelector('.geogebra-stage');
    const button = el.querySelector('.geogebra-load');
    let loaded = false;
    const loadMaterial = () => {
      if (loaded) return;
      loaded = true;
      stage.innerHTML = '<div class="geogebra-loading">' + esc(t('geogebra.loading', '正在加载 GeoGebra…')) + '</div>';
      ensureScript()
        .then(() => {
          stage.innerHTML = '';
          mountApplet(stage, {
            app: 'graphing',
            width: null,
            height: 420,
            showMenuBar: false,
            showAlgebraInput: false,
            showToolBar: false,
            showResetIcon: true,
            showFullscreenButton: true,
            language: 'zh',
            commands: [],
            materialId: id
          }, 'https://www.geogebra.org/m/' + id);
        })
        .catch(e => {
          console.warn('[geogebra] material load failed:', e);
          stage.innerHTML =
            '<div class="geogebra-fallback">' +
              '<div class="geogebra-fallback-note">' + esc(t('geogebra.failed', 'GeoGebra 加载失败，已回退源码')) + '</div>' +
              '<div class="geogebra-fallback-actions"><a href="https://www.geogebra.org/m/' + esc(id) +
                '" target="_blank" rel="noopener noreferrer">' + esc(t('geogebra.open', '在新窗口打开')) + '</a></div>' +
            '</div>';
        });
    };
    button.addEventListener('click', loadMaterial);
  }

  // ---------- 命令 applet ----------

  function fallback(box, source, spec) {
    box.innerHTML =
      '<div class="geogebra-fallback">' +
        '<div class="geogebra-fallback-note">' +
          esc(t('geogebra.failed', 'GeoGebra 加载失败，已回退源码')) +
        '</div>' +
        '<div class="geogebra-fallback-actions">' +
          '<a href="' + esc(openLink(spec.app)) + '" target="_blank" rel="noopener noreferrer">' +
            esc(t('geogebra.openClassic', '在 GeoGebra 打开')) + '</a>' +
        '</div>' +
        '<pre class="code-block"><code class="language-geogebra">' + esc(source) + '</code></pre>' +
      '</div>';
  }

  function commandWarn(box, failed) {
    const old = box.querySelector('.geogebra-command-warn');
    if (old) old.remove();
    if (!failed.length) return;
    const note = document.createElement('div');
    note.className = 'geogebra-command-warn';
    note.textContent = t('geogebra.commandFailed', '部分命令未执行：') + failed.slice(0, 5).join('；') +
      (failed.length > 5 ? ' …' : '');
    box.appendChild(note);
  }

  function mountApplet(box, spec, source) {
    const host = document.createElement('div');
    host.className = 'geogebra-canvas';
    host.id = 'ggb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    box.innerHTML = '';
    box.appendChild(host);

    const width = spec.width || Math.max(320, Math.min(1200, box.clientWidth || 720));
    const failed = [];
    const params = {
      width: width,
      height: spec.height,
      showMenuBar: spec.showMenuBar,
      showAlgebraInput: spec.showAlgebraInput,
      showToolBar: spec.showToolBar,
      showResetIcon: spec.showResetIcon,
      showFullscreenButton: spec.showFullscreenButton,
      enableLabelDrags: false,
      enableShiftDragZoom: true,
      enableRightClick: false,
      language: spec.language,
      appletOnLoad: function(api) {
        commandList(spec).forEach(cmd => {
          try {
            if (api.evalCommand && api.evalCommand(cmd) === false) failed.push(cmd);
          } catch (e) {
            failed.push(cmd);
          }
        });
        box.classList.add('is-ready');
        commandWarn(box, failed);
      }
    };
    if (spec.materialId) {
      params.material_id = spec.materialId;
    } else {
      params.appName = spec.app;
    }
    if (spec.base64) params.ggbBase64 = spec.base64;

    try {
      const applet = new window.GGBApplet(params, true);
      applet.inject(host.id);
    } catch (e) {
      console.warn('[geogebra] applet failed:', e);
      fallback(box, source, spec);
    }
  }

  function buildFence(pre) {
    if (pre.dataset.geogebraDone) return;
    pre.dataset.geogebraDone = '1';
    const code = pre.querySelector('code') || pre;
    const source = code.textContent || '';
    const spec = parseSpec(source);

    const card = document.createElement('div');
    card.className = 'geogebra-card w-has-float';

    const head = document.createElement('div');
    head.className = 'geogebra-head';
    head.innerHTML =
      '<span class="geogebra-badge">GeoGebra</span>' +
      '<span class="geogebra-title">' + esc(spec.title || (spec.app + ' · ' + commandList(spec).length + ' ' +
        t('geogebra.commands', 'commands'))) + '</span>' +
      '<a class="geogebra-open" href="' + esc(openLink(spec.app)) + '" target="_blank" rel="noopener noreferrer">' +
        esc(t('geogebra.open', '在新窗口打开')) + '</a>';
    card.appendChild(head);

    const stage = document.createElement('div');
    stage.className = 'geogebra-stage';
    card.appendChild(stage);

    const placeholder = document.createElement('div');
    placeholder.className = 'geogebra-placeholder';
    placeholder.innerHTML =
      '<button type="button" class="geogebra-load">' + icon('i-play', 16) +
        '<span>' + esc(t('geogebra.load', '加载交互图')) + '</span></button>' +
      '<p class="geogebra-hint">' + esc(t('geogebra.hint', '交互图由 geogebra.org 提供；点击后才会加载。')) + '</p>';
    stage.appendChild(placeholder);

    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      placeholder.remove();
      box = stage;
      stage.innerHTML = '<div class="geogebra-loading">' + esc(t('geogebra.loading', '正在加载 GeoGebra…')) + '</div>';
      ensureScript()
        .then(() => {
          stage.innerHTML = '';
          mountApplet(stage, spec, source);
        })
        .catch(e => {
          console.warn('[geogebra] script failed:', e);
          stage.innerHTML = '';
          fallback(stage, source, spec);
        });
    };
    let box = stage;
    placeholder.querySelector('.geogebra-load').addEventListener('click', load);

    pre.replaceWith(card);
    if (spec.auto) load();
    return card;
  }

  function renderFence(pre) {
    buildFence(pre);
  }

  function render(root) {
    const mdRender = window.MarkdownPreview.mdRender;
    const scope = mdRender && mdRender.resolveRoot
      ? mdRender.resolveRoot(root)
      : (root || document.getElementById('markdownContent'));
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="geogebra"], pre.code-block[data-lang^="ggb"]');
    blocks.forEach(pre => renderFence(pre));
  }

  window.MarkdownPreview.renderers.geogebra = {
    render: render,
    renderEmbed: renderEmbed,
    parseSpec: parseSpec,
    materialId: materialId
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseSpec: parseSpec, materialId: materialId };
  }
})();
