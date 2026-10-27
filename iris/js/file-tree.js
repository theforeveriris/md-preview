(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  
  // 解析期不取全局（隐式加载顺序契约改为显式绑定）：公开入口首个调用前绑定
  let dom, state, CONFIG, search;
  function bindGlobals() {
    ({ dom, state, CONFIG, search } = window.MarkdownPreview);
  }


  // 自然排序比较器与 DOM 重排（与构建期 iris/js/name-sort.js 同一实现）
  // 注意：兜底的 compareNames 必须与 name-sort.js 的选项一致
  // （numeric + caseFirst:'upper'），否则 name-sort.js 加载失败时
  // 排序会静默退回旧行为（大写不再优先）。
  const nameSort = window.MarkdownPreview.nameSort || {};
  const compareNames = nameSort.compareNames ||
    ((a, b) => String(a == null ? '' : a).localeCompare(
      String(b == null ? '' : b), undefined, { numeric: true, caseFirst: 'upper' }));
  const applyNaturalOrder = nameSort.applyNaturalOrder ||
    function () { /* name-sort.js 未加载时不做重排，退回 vendor 行为 */ };
  const DEFAULT_SORT_MODE = nameSort.DEFAULT_SORT_MODE || 'smart';

  /** 当前排序策略（由设置面板写入 settings.treeSort） */
  function currentSortMode() {
    try {
      const s = window.MarkdownPreview.settings && window.MarkdownPreview.settings.load
        ? window.MarkdownPreview.settings.load() : {};
      const mode = s && s.treeSort;
      // name-sort.js 未加载时无法校验策略，退回默认（智能顺序）
      if (!mode) return DEFAULT_SORT_MODE;
      if (!nameSort.isValidSortMode) return mode;
      return nameSort.isValidSortMode(mode) ? mode : DEFAULT_SORT_MODE;
    } catch (e) {
      return DEFAULT_SORT_MODE;
    }
  }

  /**
   * 文档的首次添加 / 最后修改时间（Unix 秒）
   * key = 对应的 li 元素；数据来自构建期 build-file-tree.js 采集的 git 提交时间。
   * 用 WeakMap 存 li 引用，避免渲染后从 DOM 反推路径（此时文件名已换成显示标题）。
   */
  let liTimeMap = new WeakMap();
  
  async function loadFileTree() {
    bindGlobals();
    try {
      const prebuiltUrl = 'iris/data/file-tree.json';
      let response = await fetch(prebuiltUrl);
      
      if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.incrementApiCalls) {
        window.MarkdownPreview.debug.incrementApiCalls();
      }
      
      if (response.ok) {
        (window.MarkdownPreview.debug?.debugLog || (() => {}))('✅ 使用预构建的文件树');
        if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.incrementCacheHits) {
          window.MarkdownPreview.debug.incrementCacheHits();
        }
        state.fileTreeData = await response.json();
        state.fileTreeSource = 'prebuilt';
        renderFileTree(state.fileTreeData);
        onFilesLoaded();
        return;
      } else {
        (window.MarkdownPreview.debug?.debugLog || (() => {}))('⚠️ 预构建文件不存在，使用 GitHub API');
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
    bindGlobals();
    try {
      // 非 GitHub 托管：git-provider 适配层按 config.provider 切换平台
      // （gitee/gitlab 亦归一为 { tree: [{path, type}] } 形态）
      const gp = window.MarkdownPreview.gitProvider;
      let data;
      if (gp) {
        data = await gp.listFiles(CONFIG.branch || 'main');
      } else {
        const apiUrl = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/git/trees/main?recursive=1`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file tree from GitHub API: ${response.status} ${response.statusText}`);
        }
        data = await response.json();
      }

      if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.incrementApiCalls) {
        window.MarkdownPreview.debug.incrementApiCalls();
      }

      state.fileTreeData = buildTreeFromFlatList(data.tree);
      renderFileTree(state.fileTreeData);
      onFilesLoaded();
    } catch (error) {
      console.error('Error loading file tree:', error);
      dom.fileTree.innerHTML = `<div class="tree-error" style="color: var(--color-text-muted); padding: 16px;">${window.MarkdownPreview.i18n ? window.MarkdownPreview.i18n.t('tree.loadFailed') : '无法加载文件列表，请检查网络或手动配置'}</div>`;
    }
  }
  
  function buildTreeFromFlatList(tree) {
    bindGlobals();
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
        // 自然排序：数字段按数值比较（1.0 < 2.0 < 9.0 < 10.0），
        // 避免纯字典序把 10.x 排到 2.x 前面
        return compareNames(a.name, b.name);
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
  
  // 全站共享（local-docs.js 曾有逐字副本，单位走 i18n）
  window.MarkdownPreview.formatWordCount = function(count) {
    if (!count && count !== 0) return '';
    if (count >= 10000) {
      return (count / 10000).toFixed(1).replace(/\.0$/, '') + window.MarkdownPreview.t('wordCount.unit', 'w');
    }
    return count + window.MarkdownPreview.t('wordCount.unit2', ' words');
  };
  const formatWordCount = window.MarkdownPreview.formatWordCount;

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
  }

  function getDecodedPath(li) {
    const segments = [];
    let current = li;
    while (current && current.tagName === 'LI') {
      const btn = current.querySelector('button');
      if (btn) {
        // 注意：渲染后文件名文本会被包进 span.file-name（内容是显示用标题，
        // 不是文件名），故此处只认裸文本节点 —— 必须在替换文本前调用。
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
    bindGlobals();
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

    // 重建 li -> 时间戳 的映射（每次渲染重置）
    liTimeMap = new WeakMap();

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

    // 记录每个 li 对应的时间戳（渲染后按钮文本会变成显示用标题，
    // 届时已无法从 DOM 反推原始路径，故在渲染时按顺序对应）
    // vendor 的 DOM 结构：根 ul > li（文件夹 / 文件），文件夹 li > ul > li …
    (function recordTimes(parentUl, items) {
      const lis = Array.prototype.slice.call(parentUl.children);
      // vendor 的顺序与 addItems 的追加顺序可能不同（它会自行重排），
      // 故按「同层同类型 + 名称」匹配，而不是按下标对应。
      const byName = new Map();
      lis.forEach((li) => {
        const btn = li.querySelector('button');
        let n = '';
        if (btn) for (const node of btn.childNodes) if (node.nodeType === 3) n += node.textContent;
        byName.set(safeDecode(n.trim()), li);
      });
      items.forEach((item) => {
        const li = byName.get(item.name);
        if (!li) return;
        if (item.created || item.modified) {
          liTimeMap.set(li, { created: item.created || 0, modified: item.modified || 0 });
        }
        if (item.type === 'folder' && item.children) {
          const subUl = li.querySelector('ul');
          if (subUl) recordTimes(subUl, item.children);
        }
      });
    })(tree.list, files);

    // vendor 组件在每次 append() 后都按纯字典序（name.localeCompare(name)）重排
    // DOM，数字开头的文件名会排错位（10.0 排到 2.0 前面）。这里按所选排序策略
    // 重新排列一次：文件夹在前、文件在后，组内按策略排序。
    // 上游尚未修复该问题，故在本地兜底。
    //
    // 策略（设置项「侧边栏排序」）：
    //   smart       智能顺序：名称自然序（数字段按数值、大写优先）
    //   createdAsc/Desc  最初创建时间 正序 / 倒序
    //   modifiedAsc/Desc 最后修改时间 正序 / 倒序
    applyNaturalOrder(tree.shadowRoot, {
      mode: currentSortMode(),
      resolveMeta: (li) => {
        const meta = liTimeMap.get(li);
        return meta || { created: 0, modified: 0 };
      }
    });

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
        ':host(.tinted-icons) li.folder.opened>ul{border-inline-start:1px solid rgb(from currentColor r g b / .12)}',
        // 收藏 / 最近阅读提示（history.js 切换 li 的 .fav / .recent 类）：
        // 收藏 = 文件图标用强调色（md 文档是 li.text，其他文件是 li.file）；
        // 最近 = 文件名淡化（active 选中态优先）
        ':host(.tinted-icons) li.file.fav::before,:host(.tinted-icons) li.text.fav::before{background:var(--color-accent-purple)}',
        ':host li.file.recent>button,:host li.text.recent>button{color:color-mix(in srgb, var(--color-text) 55%, transparent)}',
        ':host li.file.recent.active>button{color:var(--color-accent-purple-deep)}',
        ':host li.file.recent.active>button>.file-name{font-weight:500}'
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

      // 展开所有文件夹（受设置 expandFolders 控制，默认展开；关闭时保持全部折叠）
      var expandSettings = window.MarkdownPreview.settings && window.MarkdownPreview.settings.load ? window.MarkdownPreview.settings.load() : {};
      if (expandSettings.expandFolders !== false) {
        sh.querySelectorAll('li.folder').forEach(folder => {
          folder.classList.add('opened');
        });
      }

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

      // 树重建后刷新收藏/最近阅读提示（history.js）
      if (window.MarkdownPreview.history && window.MarkdownPreview.history.syncTreeHints) {
        window.MarkdownPreview.history.syncTreeHints();
      }
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
    bindGlobals();
    var tree = dom.fileTree.querySelector('file-tree');
    if (tree) {
      tree.classList.toggle('show-word-count', visible);
    }
  }

  function setTruncateNames(truncate) {
    bindGlobals();
    var tree = dom.fileTree.querySelector('file-tree');
    if (tree) {
      tree.classList.toggle('truncate-names', truncate !== false);
    }
  }

  // 设置切换「文件夹默认展开」后即时生效：在已渲染的 Shadow DOM 内就地
  // toggle（重建整树会重新 fetch + 丢滚动位置，setSortMode 已示范就地改）
  function setExpandFolders(expand) {
    bindGlobals();
    var tree = dom.fileTree.querySelector('file-tree');
    if (!tree || !tree.shadowRoot) return;
    tree.shadowRoot.querySelectorAll('li.folder').forEach(folder => {
      folder.classList.toggle('opened', expand !== false);
    });
  }

  /**
   * 设置切换「侧边栏排序」后即时重排当前已渲染的文件树。
   * 不重建整棵树（重建会丢失滚动位置与展开状态），只在 Shadow DOM 内重排同级节点。
   */
  function setSortMode() {
    bindGlobals();
    var tree = dom.fileTree.querySelector('file-tree');
    if (!tree || !tree.shadowRoot) return;
    applyNaturalOrder(tree.shadowRoot, {
      mode: currentSortMode(),
      resolveMeta: function (li) {
        var meta = liTimeMap.get(li);
        return meta || { created: 0, modified: 0 };
      }
    });
    // 顺序变了，已选中项的高亮与滚动位置需要重新对齐
    if (state.currentFilePath) {
      setActiveFile(state.currentFilePath);
    }
  }
  
  function setActiveFile(path) {
    bindGlobals();
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
    bindGlobals();
    setActiveFile(path);
  }
  
  function toggleSidebar() {
    bindGlobals();
    if (window.innerWidth > 768) {
      toggleSidebarCollapsed();
      return;
    }
    dom.sidebar.classList.toggle('open');
    dom.sidebarOverlay.classList.toggle('active');
  }

  function toggleSidebarCollapsed() {
    bindGlobals();
    setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  }

  // 桌面端折叠状态：写在 body.sidebar-collapsed，样式见 layout.css；
  // 持久化到设置的 sidebarOpen（默认收起，用户展开后刷新仍保持）
  function setSidebarCollapsed(collapsed) {
    bindGlobals();
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
    bindGlobals();
    dom.sidebar.classList.remove('open');
    dom.sidebarOverlay.classList.remove('active');
    // 桌面端：Esc / overlay 关闭语义 = 展开已折叠的侧边栏
    if (window.innerWidth > 768 && document.body.classList.contains('sidebar-collapsed')) {
      setSidebarCollapsed(false);
    }
  }
  
  function closeSidebarOnMobile() {
    bindGlobals();
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  }
  
  function onFilesLoaded() {
    bindGlobals();
    // 搜索索引首建已延迟到首次使用（search.js init 挂 focus/paletteopen），
    // 此处不再 500ms 后重复 buildIndex（会把已建好的索引推倒重建）
    setTimeout(() => {
      if (window.MarkdownPreview.router && window.MarkdownPreview.router.onFileTreeLoaded) {
        window.MarkdownPreview.router.onFileTreeLoaded();
      }
    }, 100);
    // 通知其他模块（标签面板等）：树数据已就绪
    window.dispatchEvent(new CustomEvent('filetreeloaded'));
  }
  
  function getAllFilesInDFSOrder(files = state.fileTreeData) {
    bindGlobals();
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
    bindGlobals();
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
    setExpandFolders,
    setSortMode,
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
