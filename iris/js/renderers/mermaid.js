(function() {
  (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Renderer module loading...');
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // mermaid 是否已完成 initialize（懒加载后才执行）
  let mermaidInitialized = false;

  // DOM 中是否存在 mermaid 代码块（用于决定是否值得加载 3.5MB 的 mermaid.min.js）
  function hasMermaidBlocks() {
    const root = window.MarkdownPreview.mdRender.resolveRoot();
    return !!(root && root.querySelector('pre code.language-mermaid'));
  }

  // 按需加载 mermaid 并初始化配置
  async function ensureMermaid() {
    if (typeof mermaid !== 'undefined' && mermaidInitialized) return true;
    if (typeof mermaid === 'undefined') {
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Library not loaded yet, lazy-loading mermaid.min.js');
      try {
        await window.MarkdownPreview.loadScript('iris/vendor/mermaid.min.js');
      } catch (err) {
        // 3.5MB 的大文件在弱网 / 缓存损坏时可能首次加载失败。
        // 换一个带参数 URL 重试一次，绕过可能损坏的缓存条目。
        console.warn('[Mermaid] 首次加载失败，重试一次:', err && err.message);
        try {
          await window.MarkdownPreview.loadScript('iris/vendor/mermaid.min.js?retry=1');
        } catch (err2) {
          console.error('[Mermaid] Library load failed after retry:', err2);
        }
      }
    }
    if (typeof mermaid === 'undefined') {
      console.error('[Mermaid] Library load failed');
      return false;
    }
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        // 显式固化消毒边界：不依赖打包的 mermaid 版本默认值
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: {
          primaryColor: '#8B5CF6',
          primaryTextColor: '#333333',
          primaryBorderColor: '#8B5CF6',
          lineColor: '#888888',
          secondaryColor: '#f2c4ce',
          tertiaryColor: '#f8f8f8',
          background: '#ffffff',
          mainBkg: '#ffffff',
          nodeBorder: '#8B5CF6',
          clusterBkg: '#f8f8f8',
          titleColor: '#333333',
          edgeLabelBackground: '#ffffff'
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        },
        sequence: {
          useMaxWidth: true,
          diagramMarginX: 20,
          diagramMarginY: 20
        }
      });
      mermaidInitialized = true;
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Initialized');
    }
    return true;
  }

  async function render(root) {
    (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] render() called');

    // 没有任何 mermaid 代码块时直接跳过，避免无谓加载
    if (!hasMermaidBlocks()) {
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] No mermaid blocks found, skipping load');
      return;
    }

    const ok = await ensureMermaid();
    if (!ok) return;

    // 容器解析走 mdRender.resolveRoot（split-view 隐藏面板同样带 .markdown-body，
    // 全局查询会命中空面板——见 md-render.js resolveRoot 注释）
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;

    // 先一次性收集所有 mermaid 候选（旧实现每替换一个就重扫全部 pre，
    // O(n²) 且上限 50 个），再顺序替换
    const candidates = [];
    markdownBody.querySelectorAll('pre').forEach(pre => {
      const codeElement = pre.querySelector('code');
      if (!codeElement) return;
      const classList = codeElement.className;
      if (!classList || !classList.includes('language-mermaid')) return;
      candidates.push({ pre, code: codeElement.textContent.trim() });
    });

    let done = 0;
    for (const item of candidates) {
      const { pre, code: mermaidCode } = item;
      if (!document.body.contains(pre)) continue; // 可能已被前置渲染器处理
      const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      try {
        const { svg } = await mermaid.render(id, mermaidCode);

        if (!svg || svg.length === 0) {
          console.error('[Mermaid] SVG is empty!');
          continue;
        }

        const container = document.createElement('div');
        container.className = 'mermaid-diagram';
        container.innerHTML = svg;
        // 源码标记：供悬浮工具条「复制源码」使用（interactions.js）
        container.dataset.src = mermaidCode;

        if (pre.parentNode) {
          pre.parentNode.replaceChild(container, pre);
          done++;
        }
      } catch (error) {
        console.error('[Mermaid] Rendering error:', error);

        // 统一回退约定：错误提示 + 可折叠源码（不丢源码，与 plantuml 一致）
        const errorBox = document.createElement('div');
        errorBox.style.cssText = 'color:#ff6b6b;padding:10px;border:1px solid #ff6b6b;border-radius:4px';
        const msg = document.createElement('div');
        msg.textContent = 'Mermaid 渲染错误: ' + error.message;
        errorBox.appendChild(msg);
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = '查看源码';
        const srcPre = document.createElement('pre');
        srcPre.style.cssText = 'margin-top:8px;white-space:pre-wrap';
        srcPre.textContent = mermaidCode;
        details.appendChild(summary);
        details.appendChild(srcPre);
        errorBox.appendChild(details);

        if (pre.parentNode) {
          pre.parentNode.replaceChild(errorBox, pre);
        }
      }
    }

    (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] render() complete, replaced:', done);
  }

  window.MarkdownPreview.renderers.mermaid = {
    render
  };

  (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Renderer module loaded and registered');
})();
