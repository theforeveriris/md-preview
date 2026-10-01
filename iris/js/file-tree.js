(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  
  const { dom, state, CONFIG, search } = window.MarkdownPreview;
  
  async function loadFileTree() {
    try {
      const prebuiltUrl = 'iris/data/file-tree.json';
      let response = await fetch(prebuiltUrl);
      
      if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.incrementApiCalls) {
        window.MarkdownPreview.debug.incrementApiCalls();
      }
      
      if (response.ok) {
        console.log('✅ 使用预构建的文件树');
        if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.incrementCacheHits) {
          window.MarkdownPreview.debug.incrementCacheHits();
        }
        state.fileTreeData = await response.json();
        state.fileTreeSource = 'prebuilt';
        renderFileTree(state.fileTreeData);
        onFilesLoaded();
        return;
      } else {
        console.log('⚠️ 预构建文件不存在，使用 GitHub API');
        state.fileTreeSource = 'api';
        await loadFileTreeFromGitHubAPI();
      }
    } catch (error) {
      console.error('⚠️ 加载预构建文件树失败，使用 GitHub API:', error);
      state.fileTreeSource = 'api';
      await loadFileTreeFromGitHubAPI();
    }
  }
  
  async function loadFileTreeFromGitHubAPI() {
    try {
      const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/git/trees/main?recursive=1`;
      const response = await fetch(apiUrl);
      
      if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.incrementApiCalls) {
        window.MarkdownPreview.debug.incrementApiCalls();
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file tree from GitHub API: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      state.fileTreeData = buildTreeFromFlatList(data.tree);
      renderFileTree(state.fileTreeData);
      onFilesLoaded();
    } catch (error) {
      console.error('Error loading file tree:', error);
      dom.fileTree.innerHTML = `<div class="tree-error" style="color: var(--color-text-muted); padding: 16px;">${window.MarkdownPreview.i18n ? window.MarkdownPreview.i18n.t('tree.loadFailed') : '无法加载文件列表，请检查网络或手动配置'}</div>`;
    }
  }
  
  function buildTreeFromFlatList(tree) {
    const root = [];
    const map = {};
    
    tree.forEach(item => {
      if (item.type === 'blob' && item.path.endsWith('.md')) {
        const parts = item.path.split('/');
        let currentLevel = root;
        let pathSoFar = '';
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (i === parts.length - 1) {
            currentLevel.push({
              name: part,
              type: 'file',
              path: item.path
            });
          } else {
            pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
            let existingFolder = map[pathSoFar];
            if (!existingFolder) {
              existingFolder = {
                name: part,
                type: 'folder',
                children: []
              };
              map[pathSoFar] = existingFolder;
              currentLevel.push(existingFolder);
            }
            currentLevel = existingFolder.children;
          }
        }
      }
    });
    
    function sortTree(items) {
      items.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      items.forEach(item => {
        if (item.type === 'folder' && item.children) {
          sortTree(item.children);
        }
      });
    }
    sortTree(root);
    return root;
  }
  
  function formatWordCount(count) {
    if (!count && count !== 0) return '';
    if (count >= 10000) {
      return (count / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
    }
    return count + ' words';
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
  }

  function getDecodedPath(li) {
    const segments = [];
    let current = li;
    while (current && current.tagName === 'LI') {
      const btn = current.querySelector('button');
      if (btn) {
        let name = '';
        for (const node of btn.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            name += node.textContent;
          }
        }
        segments.unshift(safeDecode(name.trim()));
      }
      current = current.parentElement?.closest('li');
    }
    return segments.join('/');
  }

  function renderFileTree(files) {
    if (!dom.fileTree) return;
    dom.fileTree.innerHTML = '';

    const { Tree, Folder, File } = window.MarkdownPreview.FileTree || {};
    if (!Tree || !Folder || !File) {
      console.error('FileTree component not loaded');
      dom.fileTree.innerHTML = `<div style="color: var(--color-text-muted); padding: 16px;">${window.MarkdownPreview.i18n ? window.MarkdownPreview.i18n.t('tree.componentFailed') : '文件树组件加载失败'}</div>`;
      return;
    }

    const tree = new Tree();
    // 图标着色样式依赖该类提高优先级（:host(.tinted-icons)），
    // 因为组件自带的 constructable stylesheet 在层叠顺序上晚于注入的 <style>
    tree.classList.add('tinted-icons');

    // 构建词数映射表：解码后的完整路径 -> 词数
    const wordCountMap = new Map();
    function buildWordCountMap(items, parentPath) {
      parentPath = parentPath || '';
      items.forEach(function(item) {
        var currentPath = parentPath ? parentPath + '/' + item.name : item.name;
        if (item.type === 'file' && item.wordCount) {
          wordCountMap.set(currentPath, item.wordCount);
        } else if (item.type === 'folder' && item.children) {
          buildWordCountMap(item.children, currentPath);
        }
      });
    }
    buildWordCountMap(files);

    // 构建标题映射表：解码后的完整路径 -> 文档标题（frontmatter title / 正文首个 # 标题）
    const titleMap = new Map();
    function buildTitleMap(items, parentPath) {
      parentPath = parentPath || '';
      items.forEach(function(item) {
        var currentPath = parentPath ? parentPath + '/' + item.name : item.name;
        if (item.type === 'file' && item.title) {
          titleMap.set(currentPath, item.title);
        } else if (item.type === 'folder' && item.children) {
          buildTitleMap(item.children, currentPath);
        }
      });
    }
    buildTitleMap(files);

    function addItems(parent, items) {
      items.forEach(item => {
        if (item.type === 'folder') {
          const folder = new Folder(item.name);
          if (item.children && item.children.length > 0) {
            addItems(folder, item.children);
          }
          parent.append(folder);
        } else if (item.type === 'file' && item.name.endsWith('.md')) {
          const file = new File([], item.name);
          file._path = item.path;
          parent.append(file);
        }
      });
    }

    addItems(tree, files);

    // 向 Shadow DOM 注入自定义样式（词数显示 + 选中高亮）
    var shadow = tree.shadowRoot;
    if (shadow) {
      var styleEl = document.createElement('style');
      styleEl.textContent = [
        ':host(.show-word-count) .word-count{opacity:1}',
        '.word-count{color:rgb(from currentColor r g b / .4);font-size:x-small;opacity:0;transition:opacity .2s;white-space:nowrap;margin-left:auto;padding-left:12px;flex-shrink:0}',
        'li.file,li.text{display:flex;align-items:center}',
        'li.file>button,li.text>button{display:flex;align-items:center;flex:1}',
        'li.file>button::after,li.text>button::after{display:none}',
        'li.file>button>.file-name,li.text>button>.file-name{white-space:nowrap}',
        'li.file.active>button,li.text.active>button{color:var(--color-accent-purple-deep);font-weight:500}',
        ':host(.truncate-names) li.file>button,:host(.truncate-names) li.text>button{overflow:hidden}',
        ':host(.truncate-names) li.file>button>.file-name,:host(.truncate-names) li.text>button>.file-name{overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}',
        ':host(.truncate-names) li.folder>ul{overflow:hidden}',
        ':host(:not(.truncate-names)) li.file,:host(:not(.truncate-names)) li.text{min-width:max-content}',
        ':host(:not(.truncate-names)) li.folder>ul{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-ms-overflow-style:none}',
        ':host(:not(.truncate-names)) li.folder>ul::-webkit-scrollbar{display:none;height:0;width:0}',
        // 图标着色：vendor 把 stroke="currentColor" 的 SVG 当 background-image 用，
        // data-URI 图片内无法继承页面颜色，深色主题下图标始终是黑色。
        // 改用 mask + background-color:currentColor，让图标跟随文字颜色；
        // :host(.tinted-icons) 用于压过 vendor 样式表里的 background-image
        ':host(.tinted-icons) li.file::before{background:currentColor;-webkit-mask:var(--svg-file) center/contain no-repeat;mask:var(--svg-file) center/contain no-repeat}',
        ':host(.tinted-icons) li.text::before{background:currentColor;-webkit-mask:var(--svg-text) center/contain no-repeat;mask:var(--svg-text) center/contain no-repeat}',
        ':host(.tinted-icons) li.folder::before{background:currentColor;-webkit-mask:var(--svg-folder) center/contain no-repeat;mask:var(--svg-folder) center/contain no-repeat}',
        ':host(.tinted-icons) li.folder>button::before{background:currentColor;-webkit-mask:var(--svg-closed) center/contain no-repeat;mask:var(--svg-closed) center/contain no-repeat}',
        ':host(.tinted-icons) li.folder.opened>button::before{background-image:none;-webkit-mask-image:var(--svg-opened);mask-image:var(--svg-opened)}',
        // 导航线：vendor 的 1px dotted 换成更淡的 1px 实线，颜色仍跟随文字色
        ':host(.tinted-icons) li.folder.opened>ul{border-inline-start:1px solid rgb(from currentColor r g b / .12)}'
      ].join('\n');
      shadow.appendChild(styleEl);
    }

    // Handle file clicks
    tree.addEventListener('click', (event) => {
      const { action, folder, target, path } = event.detail;
      if (action === 'click' && !folder) {
        const filePath = target._path || findFilePath(target.name, state.fileTreeData);
        if (filePath) {
          window.MarkdownPreview.markdown.loadMarkdownFile(filePath);
          highlightFileInSidebar(filePath);
          closeSidebarOnMobile();
        }
      }
    });

    dom.fileTree.appendChild(tree);

    // 渲染后：展开文件夹、注入词数、建立路径映射
    requestAnimationFrame(() => {
      var sh = tree.shadowRoot;
      if (!sh) return;

      // 展开所有文件夹
      sh.querySelectorAll('li.folder').forEach(folder => {
        folder.classList.add('opened');
      });

      // 建立路径 -> li 映射，并注入词数
      state.fileLiMap = new Map();

      sh.querySelectorAll('li.file, li.text').forEach(li => {
        var button = li.querySelector('button');
        if (!button) return;

        // 移除 data-bytes 属性，隐藏组件自带的 "0 bytes" 显示
        button.removeAttribute('data-bytes');

        var decodedPath = getDecodedPath(li);
        state.fileLiMap.set(decodedPath, li);

        // 侧边栏显示名：优先文档标题，其次解码后的文件名（去掉 .md 后缀）。
        // vendor 组件渲染时对文件名做了 encodeURIComponent，中文会显示成 %XX，这里统一换成可读文本。
        // 注意 decodedPath 需在替换文本前计算（getDecodedPath 依赖按钮内的原始文本节点）
        var displayName = titleMap.get(decodedPath);
        if (!displayName) {
          var baseName = decodedPath.split('/').pop() || '';
          displayName = safeDecode(baseName).replace(/\.md$/i, '');
        }

        // 将文件名文本节点包裹在 span 中，实现截断
        var textNode = null;
        for (var i = 0; i < button.childNodes.length; i++) {
          if (button.childNodes[i].nodeType === Node.TEXT_NODE) {
            textNode = button.childNodes[i];
            break;
          }
        }
        if (textNode) {
          var nameSpan = document.createElement('span');
          nameSpan.className = 'file-name';
          nameSpan.textContent = displayName;
          button.replaceChild(nameSpan, textNode);
        }

        var wc = wordCountMap.get(decodedPath);
        if (wc) {
          var span = document.createElement('span');
          span.className = 'word-count';
          span.textContent = formatWordCount(wc);
          button.appendChild(span);
        }
      });

      // 应用当前词数显示设置
      var settings = window.MarkdownPreview.settings && window.MarkdownPreview.settings.load ? window.MarkdownPreview.settings.load() : {};
      setWordCountVisibility(settings.showWordCount === true);
      setTruncateNames(settings.truncateFileNames !== false);
    });
  }
  
  function findFilePath(fileName, files, parentPath = '') {
    for (const item of files) {
      if (item.type === 'file' && item.name === fileName) {
        return item.path;
      } else if (item.type === 'folder' && item.children) {
        const result = findFilePath(fileName, item.children, parentPath + item.name + '/');
        if (result) return result;
      }
    }
    return null;
  }
  
  function setWordCountVisibility(visible) {
    var tree = dom.fileTree.querySelector('file-tree');
    if (tree) {
      tree.classList.toggle('show-word-count', visible);
    }
  }

  function setTruncateNames(truncate) {
    var tree = dom.fileTree.querySelector('file-tree');
    if (tree) {
      tree.classList.toggle('truncate-names', truncate !== false);
    }
  }
  
  function setActiveFile(path) {
    var tree = dom.fileTree.querySelector('file-tree');
    if (!tree || !tree.shadowRoot) return;

    var sh = tree.shadowRoot;

    // 移除所有 active 状态
    sh.querySelectorAll('li.active').forEach(function(li) {
      li.classList.remove('active');
    });

    // 通过路径映射找到对应 li 并高亮
    if (state.fileLiMap && state.fileLiMap.has(path)) {
      state.fileLiMap.get(path).classList.add('active');
    }
  }
  
  function highlightFileInSidebar(path) {
    setActiveFile(path);
  }
  
  function toggleSidebar() {
    if (window.innerWidth > 768) {
      toggleSidebarCollapsed();
      return;
    }
    dom.sidebar.classList.toggle('open');
    dom.sidebarOverlay.classList.toggle('active');
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  }

  // 桌面端折叠状态：写在 body.sidebar-collapsed，样式见 layout.css；
  // 持久化到设置的 sidebarOpen（默认收起，用户展开后刷新仍保持）
  function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle('sidebar-collapsed', collapsed === true);
    try {
      var settings = window.MarkdownPreview.settings;
      if (settings && settings.load && settings.save) {
        var s = settings.load();
        s.sidebarOpen = collapsed !== true;
        settings.save(s);
      }
    } catch (e) { /* settings 未就绪时仅切换类名 */ }
  }

  function closeSidebar() {
    dom.sidebar.classList.remove('open');
    dom.sidebarOverlay.classList.remove('active');
    // 桌面端：Esc / overlay 关闭语义 = 展开已折叠的侧边栏
    if (window.innerWidth > 768 && document.body.classList.contains('sidebar-collapsed')) {
      setSidebarCollapsed(false);
    }
  }
  
  function closeSidebarOnMobile() {
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  }
  
  function onFilesLoaded() {
    setTimeout(() => {
      if (search && search.buildIndex) search.buildIndex();
    }, 500);
    setTimeout(() => {
      if (window.MarkdownPreview.router && window.MarkdownPreview.router.onFileTreeLoaded) {
        window.MarkdownPreview.router.onFileTreeLoaded();
      }
    }, 100);
  }
  
  function getAllFilesInDFSOrder(files = state.fileTreeData) {
    const result = [];
    
    function traverse(items) {
      for (const item of items) {
        if (item.type === 'file' && item.name.endsWith('.md')) {
          result.push({ name: item.name.replace('.md', ''), path: item.path });
        } else if (item.type === 'folder' && item.children) {
          traverse(item.children);
        }
      }
    }
    
    traverse(files);
    return result;
  }
  
  function getAdjacentFiles(currentPath) {
    const allFiles = getAllFilesInDFSOrder();
    const currentIndex = allFiles.findIndex(f => f.path === currentPath);
    
    if (currentIndex === -1) {
      return { prev: null, next: null };
    }
    
    return {
      prev: currentIndex > 0 ? allFiles[currentIndex - 1] : null,
      next: currentIndex < allFiles.length - 1 ? allFiles[currentIndex + 1] : null
    };
  }

  window.MarkdownPreview.fileTree = {
    loadFileTree,
    loadFileTreeFromGitHubAPI,
    buildTreeFromFlatList,
    renderFileTree,
    setActiveFile,
    highlightFileInSidebar,
    toggleSidebar,
    closeSidebar,
    closeSidebarOnMobile,
    toggleSidebarCollapsed,
    setSidebarCollapsed,
    onFilesLoaded,
    getAllFilesInDFSOrder,
    getAdjacentFiles,
    setWordCountVisibility,
    setTruncateNames
  };
})();
