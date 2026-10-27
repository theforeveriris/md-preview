(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};
  
  async function render(root) {
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;

    // 没有 diff 代码块时直接跳过，避免无谓加载 diff2html（~1MB）
    if (!markdownBody.querySelector('pre code.language-diff')) {
      return;
    }

    (window.MarkdownPreview.debug?.debugLog || (() => {}))('Checking diff2html libraries...');
    (window.MarkdownPreview.debug?.debugLog || (() => {}))('  - Diff2Html:', typeof Diff2Html !== 'undefined' ? 'loaded' : 'not loaded');
    (window.MarkdownPreview.debug?.debugLog || (() => {}))('  - Diff2HtmlUI:', typeof Diff2HtmlUI !== 'undefined' ? 'loaded' : 'not loaded');

    // 按需加载 diff2html JS + CSS
    await Promise.all([
      window.MarkdownPreview.loadStyle('iris/vendor/diff2html/css/diff2html.min.css'),
      window.MarkdownPreview.loadScript('iris/vendor/diff2html/js/diff2html.min.js'),
      window.MarkdownPreview.loadScript('iris/vendor/diff2html/js/diff2html-ui.min.js'),
    ]);

    const allPres = Array.from(markdownBody.querySelectorAll('pre'));

    // 反向遍历，避免 DOM 修改影响索引
    for (let i = allPres.length - 1; i >= 0; i--) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');
      
      if (!codeElement) continue;
      
      const classList = codeElement.className;
      if (!classList || !classList.includes('language-diff')) continue;
      
      const diffCode = codeElement.textContent.trim();
      // container 必须在 try 之前创建：catch 里要往里放错误框，
      // 若在 try 内声明，创建前的异常会让 catch 自己抛 ReferenceError
      const container = document.createElement('div');
      try {
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

          // 只 parse 一次：parse + html 各一次就够（旧实现 Diff2HtmlUI 内部
          // 会对同一段 diff 再 parse 一遍，大 diff 纯浪费）
          const diffJson = Diff2Html.parse(diffCode);
          const diffHtml = Diff2Html.html(diffJson, configuration);
          // 插入 HTML。diff 内容的转义完全依赖 diff2html 自身（该库历史上
          // 出过 XSS），升级此依赖时留意其安全公告
          diffTarget.innerHTML = diffHtml;
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
        // 统一回退约定：错误提示 + 可折叠源码（不丢源码）；错误框写进本次
        // 渲染的 container（旧实现 append 到 pre.parentNode，pre 已被替换，
        // 错误框会落到文档末尾）
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.padding = '10px';
        errorDiv.textContent = 'Diff 渲染错误: ' + error.message;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = '查看源码';
        const srcPre = document.createElement('pre');
        srcPre.style.cssText = 'margin-top:8px;white-space:pre-wrap';
        srcPre.textContent = typeof diffCode === 'string' ? diffCode : '';
        details.appendChild(summary);
        details.appendChild(srcPre);
        errorDiv.appendChild(details);
        container.appendChild(errorDiv);
      }
    }
  }
  
  window.MarkdownPreview.renderers.diff = {
    render
  };
})();
