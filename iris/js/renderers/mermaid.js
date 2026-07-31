(function() {
  console.log('[Mermaid] Renderer module loading...');
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // mermaid 是否已完成 initialize（懒加载后才执行）
  let mermaidInitialized = false;

  // DOM 中是否存在 mermaid 代码块（用于决定是否值得加载 3.5MB 的 mermaid.min.js）
  function hasMermaidBlocks() {
    return !!document.querySelector('.markdown-body pre code.language-mermaid');
  }

  // 按需加载 mermaid 并初始化配置
  async function ensureMermaid() {
    if (typeof mermaid !== 'undefined' && mermaidInitialized) return;
    if (typeof mermaid === 'undefined') {
      console.log('[Mermaid] Library not loaded yet, lazy-loading mermaid.min.js');
      await window.MarkdownPreview.loadScript('iris/vendor/mermaid.min.js');
    }
    if (typeof mermaid === 'undefined') {
      console.error('[Mermaid] Library load failed');
      return false;
    }
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          primaryColor: '#d4a5c9',
          primaryTextColor: '#333333',
          primaryBorderColor: '#d4a5c9',
          lineColor: '#888888',
          secondaryColor: '#f2c4ce',
          tertiaryColor: '#f8f8f8',
          background: '#ffffff',
          mainBkg: '#ffffff',
          nodeBorder: '#d4a5c9',
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
      console.log('[Mermaid] Initialized');
    }
    return true;
  }

  async function render() {
    console.log('[Mermaid] render() called');

    // 没有任何 mermaid 代码块时直接跳过，避免无谓加载
    if (!hasMermaidBlocks()) {
      console.log('[Mermaid] No mermaid blocks found, skipping load');
      return;
    }

    const ok = await ensureMermaid();
    if (!ok) return;

    let foundMermaid = true;
    let iteration = 0;

    // 持续查找直到找不到 mermaid 代码块，或者最多 50 次防止死循环
    while (foundMermaid && iteration < 50) {
      foundMermaid = false;
      iteration++;

      const pres = document.querySelectorAll('.markdown-body pre');

      for (const pre of pres) {
        const codeElement = pre.querySelector('code');
        if (!codeElement) continue;

        const classList = codeElement.className;
        if (!classList || !classList.includes('language-mermaid')) continue;

        foundMermaid = true;

        console.log('[Mermaid] Found mermaid code block, iteration', iteration);

        const mermaidCode = codeElement.textContent.trim();
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

          if (pre.parentNode && document.body.contains(pre)) {
            console.log('[Mermaid] Replacing pre with container');
            pre.parentNode.replaceChild(container, pre);
            console.log('[Mermaid] ✅ Successfully replaced pre with SVG container');
          }
        } catch (error) {
          console.error('[Mermaid] Rendering error:', error);

          const errorDiv = document.createElement('div');
          errorDiv.style.color = '#ff6b6b';
          errorDiv.style.padding = '10px';
          errorDiv.style.border = '1px solid #ff6b6b';
          errorDiv.style.borderRadius = '4px';
          errorDiv.textContent = 'Mermaid 渲染错误: ' + error.message;

          if (pre.parentNode && document.body.contains(pre)) {
            pre.parentNode.replaceChild(errorDiv, pre);
          }
        }

        // 找到一个并替换后，重新开始循环，因为 DOM 已经变化了
        break;
      }
    }

    console.log('[Mermaid] render() complete, iterations:', iteration);
  }

  window.MarkdownPreview.renderers.mermaid = {
    render
  };

  console.log('[Mermaid] Renderer module loaded and registered');
})();
