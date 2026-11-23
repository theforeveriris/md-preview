(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  window.MarkdownPreview.state = {
    fileTreeData: [],
    fileLiMap: null,
    currentMode: 'files',
    currentFilePath: '',
    // 「打开本地 MD」加载的文档：{ name, content }，供导出 MD/PDF 使用；加载仓库内文档时置回 null
    localDoc: null,
    // 本地文件会话列表（多选）：[{ id, name, content }]，纯内存，刷新即清空；由 local-docs.js 管理
    localFiles: [],
    activeLocalFileId: '',
    // 本地文件夹模式（打开整个目录）：{ name: 根目录名 }；null 为普通多选模式
    localFolder: null,
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
