(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // 渲染服务列表：按顺序尝试，前一个加载失败自动切换到下一个。
  // 可通过 iris/config.json 的 "plantumlServers" 覆盖，例如指向自建服务：
  //   "plantumlServers": [
  //     { "type": "plantuml", "base": "https://your-self-hosted/plantuml" },
  //     { "type": "kroki",    "base": "https://kroki.io/plantuml" }
  //   ]
  const DEFAULT_SERVERS = [
    { type: 'plantuml', base: 'https://www.plantuml.com/plantuml' },
    { type: 'kroki', base: 'https://kroki.io/plantuml' }
  ];

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') {
      return i18n.t(key);
    }
    return fallback;
  }

  function encode64(data) {
    let r = '';
    for (let i = 0; i < data.length; i += 3) {
      if (i + 2 === data.length) {
        r += append3bytes(data[i], data[i + 1], 0);
      } else if (i + 1 === data.length) {
        r += append3bytes(data[i], 0, 0);
      } else {
        r += append3bytes(data[i], data[i + 1], data[i + 2]);
      }
    }
    return r;
  }

  function append3bytes(b1, b2, b3) {
    const c1 = b1 >> 2;
    const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
    const c4 = b3 & 0x3F;
    return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) + encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F);
  }

  function encode6bit(b) {
    if (b < 10) {
      return String.fromCharCode(48 + b);
    }
    b -= 10;
    if (b < 26) {
      return String.fromCharCode(65 + b);
    }
    b -= 26;
    if (b < 26) {
      return String.fromCharCode(97 + b);
    }
    b -= 26;
    if (b === 0) {
      return '-';
    }
    if (b === 1) {
      return '_';
    }
    return '?';
  }

  function deflate(source) {
    const encoder = new TextEncoder();
    const utf8 = encoder.encode(source);
    return pako.deflateRaw(utf8);
  }

  // PlantUML 官方服务使用的自定义 base64-like 编码
  function encodePlantUML(source) {
    return encode64(deflate(source));
  }

  // Kroki 服务使用标准 base64url 编码
  function encodeKroki(source) {
    const compressed = deflate(source);
    let bin = '';
    compressed.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function getServerList() {
    const cfg = window.MarkdownPreview.CONFIG || {};
    if (Array.isArray(cfg.plantumlServers) && cfg.plantumlServers.length > 0) {
      return cfg.plantumlServers;
    }
    return DEFAULT_SERVERS;
  }

  function buildImageUrl(server, encoded) {
    if (server.type === 'kroki') {
      return server.base.replace(/\/$/, '') + '/svg/' + encoded;
    }
    return server.base.replace(/\/$/, '') + '/svg/' + encoded;
  }

  // 所有服务器都失败时的降级展示：保留源码 + 提供在线编辑器链接。
  // anchor 是当前仍在 DOM 中的节点（服务器轮试阶段为占位容器，编码失败时为原 pre）
  function buildFallback(anchor, source, encoded, reason) {
    const box = document.createElement('div');
    box.className = 'plantuml-fallback';

    const note = document.createElement('div');
    note.className = 'plantuml-fallback-note';
    note.textContent = t('plantuml.renderFailed', 'PlantUML 渲染服务均不可用，已回退为源码展示');
    if (reason) {
      note.title = reason;
    }

    const actions = document.createElement('div');
    actions.className = 'plantuml-fallback-actions';
    const openLink = document.createElement('a');
    openLink.href = 'https://www.plantuml.com/plantuml/uml/' + encoded;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = t('plantuml.openInEditor', '在 PlantUML 在线编辑器中打开');
    actions.appendChild(openLink);

    const codePre = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.className = 'language-plantuml';
    codeEl.textContent = source;
    codePre.appendChild(codeEl);

    box.append(note, actions, codePre);
    anchor.replaceWith(box);
  }

  async function render() {
    // 没有 plantuml 代码块时直接跳过，避免无谓加载 pako
    if (!document.querySelector('.markdown-body pre code.language-plantuml')) {
      return;
    }

    if (typeof pako === 'undefined') {
      await window.MarkdownPreview.loadScript('iris/vendor/pako.min.js');
    }
    if (typeof pako === 'undefined') {
      console.error('Pako library failed to load');
      return;
    }

    const allPres = document.querySelectorAll('.markdown-body pre');

    for (let i = 0; i < allPres.length; i++) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');

      if (!codeElement) continue;

      const classList = codeElement.className;
      if (!classList || !classList.includes('language-plantuml')) continue;

      const plantumlCode = codeElement.textContent.trim();

      try {
        const encoded = encodePlantUML(plantumlCode);
        const servers = getServerList();
        const container = document.createElement('div');
        container.className = 'plantuml-diagram';

        const img = document.createElement('img');
        img.alt = 'PlantUML';
        img.loading = 'lazy';
        container.appendChild(img);
        pre.replaceWith(container);

        // 依序尝试各服务器：img 加载失败（onerror）时切换下一个；
        // 全部失败时回退为源码展示
        let index = 0;
        const tryNext = (reason) => {
          if (index >= servers.length) {
            buildFallback(container, plantumlCode, encoded, reason);
            return;
          }
          const server = servers[index++];
          let url;
          try {
            url = buildImageUrl(server, server.type === 'kroki' ? encodeKroki(plantumlCode) : encoded);
          } catch (e) {
            tryNext();
            return;
          }
          const attempt = img;
          attempt.onerror = () => {
            console.warn(`PlantUML server failed, trying next: ${url}`);
            tryNext(url);
          };
          attempt.src = url;
        };
        tryNext();
      } catch (error) {
        console.error('PlantUML encoding error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'plantuml-fallback';
        errorDiv.textContent = t('plantuml.renderError', 'PlantUML 渲染错误') + ': ' + error.message;
        pre.replaceWith(errorDiv);
      }
    }
  }

  window.MarkdownPreview.renderers.plantuml = {
    render
  };
})();
