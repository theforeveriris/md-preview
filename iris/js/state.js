(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  window.MarkdownPreview.state = {
    fileTreeData: [],
    fileLiMap: null,
    currentMode: 'files',
    currentFilePath: '',
    // 「打开本地 MD」加载的文档：{ name, content }，供导出 MD/PDF 使用；加载仓库内文档时置回 null
    localDoc: null,
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
