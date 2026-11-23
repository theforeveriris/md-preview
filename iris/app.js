(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  async function init() {
    if (window.MarkdownPreview.configLoadPromise) {
      await window.MarkdownPreview.configLoadPromise;
    }

    // 逐模块容错：任一 init 抛异常不再中断其后所有模块的初始化
    //（此前 readingPos 一处抛错，history/splitView 等全部不初始化）
    const steps = [
      () => window.MarkdownPreview.fileTree.loadFileTree(),
      () => window.MarkdownPreview.ui.setupEventListeners(),
      () => window.MarkdownPreview.ui.setupScrollProgress(),
      () => window.MarkdownPreview.interactions?.init?.(),
      () => window.MarkdownPreview.search?.init?.(),
      () => window.MarkdownPreview.router?.init?.(),
      () => window.MarkdownPreview.debug?.init?.(),
      // 阅读位置续读 / 历史收藏 / 悬浮预览 / 扫码续读 / 选中工具栏
      () => window.MarkdownPreview.readingPos?.init?.(),
      () => window.MarkdownPreview.history?.init?.(),
      () => window.MarkdownPreview.hoverPreview?.init?.(),
      () => window.MarkdownPreview.qrShare?.init?.(),
      () => window.MarkdownPreview.selectionTools?.init?.(),
      // 双栏对照阅读（悬浮球菜单入口在此装配）
      () => window.MarkdownPreview.splitView?.init?.(),
      // 移动端手势（左右滑翻页 / 左缘右滑呼出侧边栏）
      () => window.MarkdownPreview.gestures?.init?.(),
      // 悬浮侧边栏拖拽调宽/调高（右缘/下缘把手）
      () => window.MarkdownPreview.sidebarResize?.init?.(),
      // 多标签页状态同步（主题 / 设置 / 界面语言）
      () => window.MarkdownPreview.syncTabs?.init?.(),
      // 标签系统（侧边栏标签面板 + #/tag/ 聚合页）
      () => window.MarkdownPreview.tags?.init?.(),
      // 未读更新（侧边栏药丸 + 命令面板动作 + #/unread 聚合视图）
      () => window.MarkdownPreview.unread?.init?.(),
      // 反向链接与相关文档（文末区块；语言切换后重渲染）
      () => window.MarkdownPreview.backlinks?.init?.(),
      // 图 / 表编号（语言切换后刷新题注）
      () => window.MarkdownPreview.figures?.init?.(),
      // 无部署快照分享（悬浮球入口 + #/s?z= 接收）
      () => window.MarkdownPreview.snapshot?.init?.()
    ];
    for (const step of steps) {
      try {
        await step();
      } catch (e) {
        console.error('[init] 模块初始化失败（不影响后续模块）:', e);
      }
    }
    if (window.MarkdownPreview.plugins?.autoLoad) {
      await window.MarkdownPreview.plugins.autoLoad();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
