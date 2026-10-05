(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};
  
  async function render() {
    // 没有 diff 代码块时直接跳过，避免无谓加载 diff2html（~1MB）
    if (!document.querySelector('.markdown-body pre code.language-diff')) {
      return;
    }

    console.log('Checking diff2html libraries...');
    console.log('  - Diff2Html:', typeof Diff2Html !== 'undefined' ? 'loaded' : 'not loaded');
    console.log('  - Diff2HtmlUI:', typeof Diff2HtmlUI !== 'undefined' ? 'loaded' : 'not loaded');

    // 按需加载 diff2html JS + CSS
    await Promise.all([
      window.MarkdownPreview.loadStyle('iris/vendor/diff2html/css/diff2html.min.css'),
      window.MarkdownPreview.loadScript('iris/vendor/diff2html/js/diff2html.min.js'),
      window.MarkdownPreview.loadScript('iris/vendor/diff2html/js/diff2html-ui.min.js'),
    ]);

    const allPres = Array.from(document.querySelectorAll('.markdown-body pre'));

    // 反向遍历，避免 DOM 修改影响索引
    for (let i = allPres.length - 1; i >= 0; i--) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');
      
      if (!codeElement) continue;
      
      const classList = codeElement.className;
      if (!classList || !classList.includes('language-diff')) continue;
      
      try {
        const diffCode = codeElement.textContent.trim();
        const container = document.createElement('div');
        container.className = 'diff-container';
        container.style.margin = '1.5em 0';
        
        // 创建 diff 渲染的目标元素
        const diffTarget = document.createElement('div');
        diffTarget.id = 'diff-' + Date.now() + '-' + i;
        container.appendChild(diffTarget);
        
        pre.parentNode.replaceChild(container, pre);
        
        // 使用 diff2html 渲染
        if (typeof Diff2Html !== 'undefined' && typeof Diff2HtmlUI !== 'undefined') {
          const configuration = {
            drawFileList: true,
            fileListToggle: true,
            outputFormat: 'line-by-line',
            matching: 'lines',
            synchronisedScroll: true,
            highlight: true
          };
          
          // 先解析 diff
          const diffJson = Diff2Html.parse(diffCode);
          // 生成 HTML
          const diffHtml = Diff2Html.html(diffJson, configuration);
          // 插入 HTML
          diffTarget.innerHTML = diffHtml;
          
          // 初始化 UI
          const diff2htmlUi = new Diff2HtmlUI(diffTarget, diffCode, configuration);
          diff2htmlUi.highlightCode();
        } else {
          console.error('Diff2Html or Diff2HtmlUI library is not loaded');
          const errorDiv = document.createElement('div');
          errorDiv.style.color = '#ff6b6b';
          errorDiv.style.padding = '10px';
          errorDiv.textContent = 'Diff2Html 库未加载';
          container.appendChild(errorDiv);
        }
      } catch (error) {
        console.error('Diff rendering error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.padding = '10px';
        errorDiv.textContent = 'Diff 渲染错误: ' + error.message;
        pre.parentNode.appendChild(errorDiv);
      }
    }
  }
  
  window.MarkdownPreview.renderers.diff = {
    render
  };
})();
