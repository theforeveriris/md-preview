(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  
  async function init() {
    if (window.MarkdownPreview.configLoadPromise) {
      await window.MarkdownPreview.configLoadPromise;
    }
    
    window.MarkdownPreview.fileTree.loadFileTree();
    window.MarkdownPreview.ui.setupEventListeners();
    window.MarkdownPreview.ui.setupScrollProgress();
    if (window.MarkdownPreview.interactions && window.MarkdownPreview.interactions.init) {
      window.MarkdownPreview.interactions.init();
    }
    if (window.MarkdownPreview.search && window.MarkdownPreview.search.init) {
      window.MarkdownPreview.search.init();
    }
    if (window.MarkdownPreview.router && window.MarkdownPreview.router.init) {
      window.MarkdownPreview.router.init();
    }
    if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.init) {
      window.MarkdownPreview.debug.init();
    }
    // 阅读位置续读 / 历史收藏 / 演示模式 / 选中工具栏
    if (window.MarkdownPreview.readingPos && window.MarkdownPreview.readingPos.init) {
      window.MarkdownPreview.readingPos.init();
    }
    if (window.MarkdownPreview.history && window.MarkdownPreview.history.init) {
      window.MarkdownPreview.history.init();
    }
    if (window.MarkdownPreview.slides && window.MarkdownPreview.slides.init) {
      window.MarkdownPreview.slides.init();
    }
    if (window.MarkdownPreview.selectionTools && window.MarkdownPreview.selectionTools.init) {
      window.MarkdownPreview.selectionTools.init();
    }
    if (window.MarkdownPreview.plugins && window.MarkdownPreview.plugins.autoLoad) {
      await window.MarkdownPreview.plugins.autoLoad();
    }
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
