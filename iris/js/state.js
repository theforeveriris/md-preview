(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  window.MarkdownPreview.state = {
    fileTreeData: [],
    fileLiMap: null,
    currentMode: 'files',
    currentFilePath: '',
    currentHeadings: [],
    currentFrontmatter: {},
    // 调试面板用：文件树加载来源
    fileTreeSource: null,        // 'prebuilt' | 'api' | null
    // 调试面板用：搜索索引状态
    searchIndexStats: null,      // { source: 'prebuilt'|'runtime', entries: number }
    // 调试面板用：当前文档渲染信息
    lastDocStats: null           // { sourceLength, htmlLength, path, renderMs }
  };
})();
