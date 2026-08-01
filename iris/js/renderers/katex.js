(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // 判断当前文档是否真的需要 KaTeX：
  //   1) 存在 .katex-block（$$...$$ 块级公式，由 md-render 预处理生成）
  //   2) 排除 pre/code/script/style 后的文本中仍含 $（行内 $...$ 公式）
  // 这样可以避免含 shell 变量 $HOME 之类的技术文档无谓加载 katex（275KB）
  function needsKatex(markdownBody) {
    if (markdownBody.querySelector('.katex-block')) return true;
    const clone = markdownBody.cloneNode(true);
    clone.querySelectorAll('pre,code,script,style').forEach(el => el.remove());
    return clone.textContent.includes('$');
  }

  async function render() {
    const markdownBody = document.querySelector('.markdown-body');
    if (!markdownBody) return;

    // 文档不含任何数学公式时直接跳过，避免无谓加载
    if (!needsKatex(markdownBody)) {
      return;
    }

    // 按需加载 katex + auto-render + CSS
    if (typeof katex === 'undefined' || typeof renderMathInElement === 'undefined') {
      await Promise.all([
        window.MarkdownPreview.loadStyle('iris/vendor/katex/katex.min.css'),
        window.MarkdownPreview.loadScript('iris/vendor/katex/katex.min.js'),
        window.MarkdownPreview.loadScript('iris/vendor/katex/auto-render.min.js'),
      ]);
    }
    if (typeof katex === 'undefined' || typeof renderMathInElement === 'undefined') {
      console.error('KaTeX library failed to load');
      return;
    }

    // 先处理所有 katex-block div 中的纯文本 LaTeX
    const katexBlocks = markdownBody.querySelectorAll('.katex-block');
    katexBlocks.forEach(block => {
      const latex = block.textContent.trim();
      if (latex) {
        try {
          // 清空 block 然后用 katex.render 重新渲染
          block.textContent = '';
          katex.render(latex, block, {
            displayMode: true,
            throwOnError: false,
            trust: true,
            strict: false
          });
        } catch (e) {
          console.error('KaTeX block rendering error:', e);
        }
      }
    });

    // 然后用 renderMathInElement 处理剩余的行内公式
    try {
      renderMathInElement(markdownBody, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ],
        ignoredTags: ['pre', 'code', 'script', 'style'],
        throwOnError: false,
        trust: true,
        strict: false
      });
    } catch (error) {
      console.error('KaTeX rendering error:', error);
    }
  }

  window.MarkdownPreview.renderers.katex = {
    render
  };
})();
