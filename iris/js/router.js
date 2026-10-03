(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  
  let isUpdating = false;
  let pendingHash = null;
  
  function initRouter() {
    window.addEventListener('hashchange', handleHashChange);
    if (window.location.hash && window.location.hash.length > 2) {
      pendingHash = window.location.hash;
    }
  }
  
  function onFileTreeLoaded() {
    const { markdown, fileTree } = window.MarkdownPreview;
    if (pendingHash) {
      loadFromHash(pendingHash);
      pendingHash = null;
    } else {
      loadFromHash();
    }
  }
  
  function loadFromHash(hash = null) {
    const targetHash = hash || window.location.hash;
    if (!targetHash || targetHash.length < 2) return;

    let path = decodeURIComponent(targetHash.substring(1));
    if (path.startsWith('/')) {
      path = path.substring(1);
    }

    // 支持 #/docs/file.md#heading-id 形式的锚点直达链接
    let anchor = '';
    const mdIndex = path.indexOf('.md');
    if (mdIndex !== -1) {
      const afterMd = path.substring(mdIndex + 3);
      if (afterMd.startsWith('#')) {
        anchor = afterMd.substring(1);
        path = path.substring(0, mdIndex + 3);
      }
    }

    if (path && path.endsWith('.md')) {
      const { markdown, fileTree } = window.MarkdownPreview;
      isUpdating = true;
      markdown.loadMarkdownFile(path).then(() => {
        if (anchor) {
          // 文档加载完成后滚动到对应标题
          setTimeout(() => {
            const target = document.getElementById(anchor);
            if (target) {
              target.scrollIntoView({ behavior: 'instant', block: 'start' });
              if (window.MarkdownPreview.markdown && window.MarkdownPreview.markdown.setActiveIndexById) {
                window.MarkdownPreview.markdown.setActiveIndexById(anchor);
              }
            }
          }, 200);
        }
      }).catch(() => {
        console.warn('Failed to load document from URL');
      });
      fileTree.highlightFileInSidebar(path);
      setTimeout(() => isUpdating = false, 100);
    }
  }
  
  function handleHashChange() {
    if (isUpdating) return;
    loadFromHash();
  }
  
  function updateHash(path) {
    if (!path || isUpdating) return;
    const hash = '#/' + path;
    if (window.location.hash !== hash) {
      isUpdating = true;
      window.history.replaceState(null, '', hash);
      setTimeout(() => isUpdating = false, 100);
    }
  }
  
  window.MarkdownPreview.router = {
    init: initRouter,
    updateHash,
    onFileTreeLoaded
  };
})();
