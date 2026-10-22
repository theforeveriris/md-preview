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
    // 阅读位置续读 / 历史收藏 / 悬浮预览 / 扫码续读 / 选中工具栏
    if (window.MarkdownPreview.readingPos && window.MarkdownPreview.readingPos.init) {
      window.MarkdownPreview.readingPos.init();
    }
    if (window.MarkdownPreview.history && window.MarkdownPreview.history.init) {
      window.MarkdownPreview.history.init();
    }
    if (window.MarkdownPreview.hoverPreview && window.MarkdownPreview.hoverPreview.init) {
      window.MarkdownPreview.hoverPreview.init();
    }
    if (window.MarkdownPreview.qrShare && window.MarkdownPreview.qrShare.init) {
      window.MarkdownPreview.qrShare.init();
    }
    if (window.MarkdownPreview.selectionTools && window.MarkdownPreview.selectionTools.init) {
      window.MarkdownPreview.selectionTools.init();
    }
    // 双栏对照阅读（悬浮球菜单入口在此装配）
    if (window.MarkdownPreview.splitView && window.MarkdownPreview.splitView.init) {
      window.MarkdownPreview.splitView.init();
    }
    // 移动端手势（左右滑翻页 / 左缘右滑呼出侧边栏）
    if (window.MarkdownPreview.gestures && window.MarkdownPreview.gestures.init) {
      window.MarkdownPreview.gestures.init();
    }
    // 悬浮侧边栏拖拽调宽/调高（右缘/下缘把手）
    if (window.MarkdownPreview.sidebarResize && window.MarkdownPreview.sidebarResize.init) {
      window.MarkdownPreview.sidebarResize.init();
    }
    // 多标签页状态同步（主题 / 设置 / 界面语言）
    if (window.MarkdownPreview.syncTabs && window.MarkdownPreview.syncTabs.init) {
      window.MarkdownPreview.syncTabs.init();
    }
    // 标签系统（侧边栏标签面板 + #/tag/ 聚合页）
    if (window.MarkdownPreview.tags && window.MarkdownPreview.tags.init) {
      window.MarkdownPreview.tags.init();
    }
    // 反向链接与相关文档（文末区块；语言切换后重渲染）
    if (window.MarkdownPreview.backlinks && window.MarkdownPreview.backlinks.init) {
      window.MarkdownPreview.backlinks.init();
    }
    // 图 / 表编号（语言切换后刷新题注）
    if (window.MarkdownPreview.figures && window.MarkdownPreview.figures.init) {
      window.MarkdownPreview.figures.init();
    }
    // 无部署快照分享（悬浮球入口 + #/s?z= 接收）
    if (window.MarkdownPreview.snapshot && window.MarkdownPreview.snapshot.init) {
      window.MarkdownPreview.snapshot.init();
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
