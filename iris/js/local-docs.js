/**
 * 本地 Markdown 文档（多文件会话 + 本地文件夹）
 *
 * 「打开本地 MD」支持一次选中多个文件：
 *   - 全部读入内存会话列表（state.localFiles，刷新即清空，
 *     本地文件内容不落 localStorage，避免超出配额）
 *   - 第一个文件立即打开，其余进入侧边栏「本地文件」面板
 *     （位于文件树上方，Files 模式下可见）
 *   - 点击列表项随时切回；× 移除单个；表头按钮清空全部
 *
 * 「打开本地文件夹」整体导入一个目录：
 *   - 优先使用 File System Access API（showDirectoryPicker），
 *     不支持的浏览器回退到 webkitdirectory 隐藏 input
 *   - 递归收集 .md/.markdown（跳过 .git / node_modules 等构建目录），
 *     按相对路径在面板内渲染为目录树，文件夹行可折叠
 *   - 内容懒加载：点开时才读文件并计算字数，大文件夹不必整体读入
 *   - 打开新文件夹会替换当前会话（有未清空文件时先确认）
 *
 * 限制：
 *   - 手动多选最多 20 个文件，单文件 ≤ 10MB，超限跳过并提示
 *   - 文件夹模式最多收集 500 个文件，单文件同样 ≤ 10MB
 *   - 同名文件再次选择视为更新：原位替换内容并打开
 *   - 移除/清空"当前打开中"的文件时，正文保持显示，
 *     但清除 localDoc 与高亮（导出回退为"请先打开一个文档"）
 *
 * 拖拽打开：
 *   - 把 .md 文件或整个文件夹从系统拖入页面任意位置即可打开，
 *     拖入期间全屏显示提示遮罩
 *   - 文件夹通过 DataTransferItem.webkitGetAsEntry 递归展开，
 *     限制与「打开本地文件夹」一致（500 个 / 10MB，跳过构建目录）
 *   - 编辑器模式下不接管拖放（编辑器有自己的文件处理）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const MAX_FILES = 20;
  const MAX_FOLDER_FILES = 500;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  // 文件夹导入时跳过的目录（构建产物 / 版本库 / 依赖）
  const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build']);

  let panelEl = null;
  let listEl = null;
  let clearBtn = null;
  let toggleBtn = null;
  let inputEl = null;
  let folderInputEl = null;
  // 递增 id：文件名可能重名/特殊字符，不用文件名做 key
  let idSeq = 0;
  // 列表折叠状态（会话内记忆，默认展开）
  let collapsed = false;
  // 目录树中各文件夹的展开状态：Map<folderPath, boolean>，默认展开
  const folderOpen = new Map();

  function getState() {
    return window.MarkdownPreview.state;
  }

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function makeId() {
    idSeq += 1;
    return 'local-' + Date.now().toString(36) + '-' + idSeq;
  }

  // 词数统计口径与 markdown.js calculateReadingTime 一致（英文单词 + 中文字符）
  function countWords(text) {
    const en = (text.match(/[a-zA-Z]+/g) || []).length;
    const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    return en + cjk;
  }

  // 格式与 file-tree.js formatWordCount 一致
  function formatWordCount(count) {
    if (!count && count !== 0) return '';
    if (count >= 10000) {
      return (count / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
    }
    return count + t('wordCount.unit', ' words');
  }

  // ============== 面板渲染 ==============
  // 表头（文件夹行样式）在 init 中只构建一次，这里更新计数与列表
  function renderPanel() {
    if (!panelEl) return;
    const state = getState();
    const files = state.localFiles;
    panelEl.hidden = files.length === 0;
    panelEl.classList.toggle('collapsed', collapsed);
    // 与文件树同步的两个显示设置
    const settings = window.MarkdownPreview.settings ? window.MarkdownPreview.settings.load() : {};
    panelEl.classList.toggle('show-word-count', settings.showWordCount === true);
    panelEl.classList.toggle('truncate-names', settings.truncateFileNames !== false);

    // 文件夹模式下表头显示根目录名
    const titleEl = panelEl.querySelector('.local-files-title');
    if (titleEl) {
      titleEl.textContent = state.localFolder ? state.localFolder.name : t('local.title', '本地文件');
    }
    if (toggleBtn) toggleBtn.dataset.count = files.length + ' item' + (files.length === 1 ? '' : 's');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (files.some(f => f.path && f.path.includes('/'))) {
      listEl.appendChild(buildTree(files));
    } else {
      files.forEach(file => listEl.appendChild(buildFileRow(file)));
    }
  }

  // 按相对路径把文件组织为目录树：{ folders: Map, files: [] }
  function buildTreeNodes(files) {
    const root = { folders: new Map(), files: [] };
    files.forEach(file => {
      const segs = (file.path || file.name).split('/');
      let node = root;
      for (let i = 0; i < segs.length - 1; i++) {
        if (!node.folders.has(segs[i])) {
          node.folders.set(segs[i], { folders: new Map(), files: [] });
        }
        node = node.folders.get(segs[i]);
      }
      node.files.push(file);
    });
    return root;
  }

  function buildTree(files) {
    const root = buildTreeNodes(files);
    const ul = document.createElement('ul');
    ul.className = 'local-files-list local-files-tree';
    appendNodes(ul, root, '');
    return ul;
  }

  function appendNodes(ul, node, prefix) {
    // 文件夹在前、文件在后，各自按名称排序（与 vendor 文件树一致）
    const folders = Array.from(node.folders.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const files = node.files.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    folders.forEach(name => {
      const child = node.folders.get(name);
      const fullPath = prefix ? prefix + '/' + name : name;
      const li = document.createElement('li');
      li.className = 'local-folder-item';
      const isOpen = folderOpen.get(fullPath) !== false;
      li.classList.toggle('collapsed', !isOpen);

      const folderBtn = document.createElement('button');
      folderBtn.type = 'button';
      folderBtn.className = 'local-folder-toggle';
      folderBtn.textContent = name;
      folderBtn.setAttribute('aria-expanded', String(isOpen));
      folderBtn.addEventListener('click', () => {
        folderOpen.set(fullPath, !isOpen);
        renderPanel();
      });
      li.appendChild(folderBtn);

      const sub = document.createElement('ul');
      sub.className = 'local-files-subtree';
      if (!isOpen) sub.hidden = true;
      appendNodes(sub, child, fullPath);
      li.appendChild(sub);
      ul.appendChild(li);
    });
    files.forEach(file => ul.appendChild(buildFileRow(file)));
  }

  function buildFileRow(file) {
    const state = getState();
    const li = document.createElement('li');
    li.className = 'local-file-item' + (file.id === state.activeLocalFileId ? ' active' : '');
    li.dataset.id = file.id;

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'local-file-open';
    openBtn.title = file.path || file.name;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = file.name;
    openBtn.appendChild(nameSpan);
    openBtn.addEventListener('click', () => openLocalFile(file.id));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'local-file-remove';
    removeBtn.title = t('local.remove', '从列表移除');
    removeBtn.setAttribute('aria-label', t('local.removeAria', '移除 ') + file.name);
    removeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-x"/></svg>';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeLocalFile(file.id);
    });

    li.append(openBtn);
    if (file.words != null) {
      const wc = document.createElement('span');
      wc.className = 'word-count';
      wc.textContent = formatWordCount(file.words);
      li.appendChild(wc);
    }
    li.appendChild(removeBtn);
    return li;
  }

  // ============== 打开 / 移除 / 清空 ==============
  // 文件夹模式的文件内容懒加载：首次打开时才读取
  async function loadEntryContent(file) {    if (file.content != null) return file.content;
    try {
      let f = file.file;
      if (!f && file.handle) f = await file.handle.getFile();
      if (!f) return null;
      if (f.size > MAX_FILE_BYTES) {
        alert(file.name + t('local.tooLarge', '（超过 10MB，无法打开）'));
        return null;
      }
      file.file = f;
      file.content = await f.text();
      file.words = countWords(file.content);
      return file.content;
    } catch (e) {
      alert(file.name + t('local.readFailed', '（读取失败）'));
      return null;
    }
  }

  // 供其他模块（双栏对照等）按 id 读取本地会话文档内容：
  // 走与主视图相同的懒加载管道，超限 / 读取失败的提示行为一致
  async function getFileContent(id) {
    const state = getState();
    const file = state.localFiles.find(f => f.id === id);
    if (!file) return null;
    return loadEntryContent(file);
  }

  async function openLocalFile(id) {
    const state = getState();
    const file = state.localFiles.find(f => f.id === id);
    if (!file) return;
    const content = await loadEntryContent(file);
    if (content == null) return;
    state.activeLocalFileId = id;
    // 本地文件不写进 URL，刷新后丢失
    state.currentFilePath = '';
    // 清除文件树高亮：当前展示的是本地文档
    window.MarkdownPreview.fileTree?.setActiveFile('');
    window.MarkdownPreview.markdown.renderMarkdownDirect(content, file.name);
    renderPanel();
  }

  function removeLocalFile(id) {
    const state = getState();
    const idx = state.localFiles.findIndex(f => f.id === id);
    if (idx === -1) return;
    state.localFiles.splice(idx, 1);
    if (state.activeLocalFileId === id) {
      // 正在展示的文件被移除：正文保持显示，仅解除本地文档关联
      state.activeLocalFileId = '';
      state.localDoc = null;
    }
    renderPanel();
  }

  // 将文本内容加入本地会话列表并打开（快照分享「存入本地会话」用）
  function addTextDoc(name, content) {
    const state = getState();
    const fileName = /\.md$/i.test(name || '') ? name : `${name || 'snapshot'}.md`;
    const existing = state.localFiles.find(f => f.name === fileName);
    let id;
    if (existing) {
      existing.content = content;
      existing.words = countWords(content);
      id = existing.id;
    } else {
      id = makeId();
      state.localFiles.push({ id, name: fileName, path: fileName, content, words: countWords(content) });
    }
    openLocalFile(id);
    renderPanel();
    if (state.currentMode !== 'files') {
      window.MarkdownPreview.ui?.switchMode('files');
    }
  }

  function clearLocalFiles() {
    const state = getState();
    if (state.localFiles.length === 0) return;
    state.localFiles.length = 0;
    state.localFolder = null;
    if (state.activeLocalFileId) {
      state.activeLocalFileId = '';
      state.localDoc = null;
    }
    renderPanel();
  }

  // 打开仓库内文档时由 markdown.js 调用：列表保留，高亮清除
  function clearActive() {
    const state = getState();
    if (!state.activeLocalFileId) return;
    state.activeLocalFileId = '';
    renderPanel();
  }

  // 显示词数 / 折叠文件名设置变化时由 settings.js 调用
  function refresh() {
    renderPanel();
  }

  // 切换语言后重渲染面板（表头标题、移除按钮 title 等）
  window.addEventListener('langchange', () => renderPanel());

  // ============== 读取选中的文件 ==============
  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsText(file, 'utf-8');
    });
  }

  async function handlePickedFiles(fileList) {
    const state = getState();
    const picked = Array.from(fileList || []);
    if (picked.length === 0) return;

    const skipped = [];
    let firstOpened = false;

    for (const file of picked) {
      if (file.size > MAX_FILE_BYTES) {
        skipped.push(file.name + t('local.tooLarge', '（超过 10MB）'));
        continue;
      }
      if (state.localFiles.length >= MAX_FILES && !state.localFiles.some(f => f.name === file.name)) {
        skipped.push(file.name + t('local.listFull', '（列表已满 ' + MAX_FILES + ' 个）'));
        continue;
      }
      let content;
      try {
        content = await readAsText(file);
      } catch (e) {
        skipped.push(file.name + t('local.readFailed', '（读取失败）'));
        continue;
      }
      // 同名视为更新：原位替换内容，保持列表顺序
      const existing = state.localFiles.find(f => f.name === file.name);
      if (existing) {
        existing.content = content;
        existing.words = countWords(content);
      } else {
        state.localFiles.push({ id: makeId(), name: file.name, path: file.name, content, words: countWords(content) });
      }
      // 第一个处理成功的文件立即打开（沿用单选时代的行为）
      if (!firstOpened) {
        const target = state.localFiles.find(f => f.name === file.name);
        firstOpened = true;
        openLocalFile(target.id);
      }
    }

    renderPanel();
    if (skipped.length > 0) {
      alert(t('local.skippedFiles', '以下文件未加入列表：\n') + skipped.join('\n'));
    }
    // 若侧边栏在 Index 模式，切回 Files 让面板可见
    if (window.MarkdownPreview.state.currentMode !== 'files') {
      window.MarkdownPreview.ui.switchMode('files');
    }
  }

  // ============== 打开本地文件夹 ==============
  async function openLocalFolder() {
    if (typeof window.showDirectoryPicker === 'function') {
      let dirHandle;
      try {
        dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      } catch (e) {
        return; // 用户取消
      }
      await loadFolderFromHandle(dirHandle);
    } else if (folderInputEl) {
      // File System Access API 不可用：回退到 webkitdirectory input
      folderInputEl.click();
    } else {
      alert(t('local.folderUnsupported', '当前浏览器不支持打开文件夹，请使用多选文件的方式'));
    }
  }

  async function loadFolderFromHandle(dirHandle) {
    if (!await confirmFolderReplace()) return;
    const entries = [];
    await walkDirectory(dirHandle, '', entries);

    if (entries.length === 0) {
      alert(t('local.folderEmpty', '该文件夹内没有找到 .md 文件'));
      return;
    }
    applyFolderSession(dirHandle.name, entries);
  }

  // webkitdirectory 回退路径：从 File.webkitRelativePath 还原目录结构
  async function handlePickedFolder(fileList) {
    const picked = Array.from(fileList || []).filter(f => /\.(md|markdown)$/i.test(f.name));
    if (picked.length === 0) {
      alert(t('local.folderEmpty', '该文件夹内没有找到 .md 文件'));
      return;
    }
    if (!await confirmFolderReplace()) return;

    // webkitRelativePath 形如 "rootName/sub/a.md"，首段为根目录名
    const rootName = (picked[0].webkitRelativePath || picked[0].name).split('/')[0];
    const skipped = [];
    const entries = [];
    for (const f of picked) {
      const rel = f.webkitRelativePath || f.name;
      const segs = rel.split('/');
      const path = segs.slice(1).join('/') || f.name;
      if (f.size > MAX_FILE_BYTES) {
        skipped.push(path + t('local.tooLarge', '（超过 10MB）'));
        continue;
      }
      if (entries.length >= MAX_FOLDER_FILES) {
        skipped.push(path + t('local.folderFull', '（超出 ' + MAX_FOLDER_FILES + ' 个文件上限）'));
        continue;
      }
      entries.push({ id: makeId(), name: f.name, path, content: null, words: null, file: f });
    }
    if (entries.length === 0) {
      alert(t('local.skippedFiles', '以下文件未加入列表：\n') + skipped.join('\n'));
      return;
    }
    applyFolderSession(rootName, entries);
    if (skipped.length > 0) {
      alert(t('local.skippedFiles', '以下文件未加入列表：\n') + skipped.join('\n'));
    }
  }

  // 递归收集目录下的 .md 文件（跳过构建目录）
  async function walkDirectory(dirHandle, prefix, out) {
    for await (const entry of dirHandle.values()) {
      if (out.length >= MAX_FOLDER_FILES) return;
      if (entry.kind === 'directory') {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        await walkDirectory(entry, prefix ? prefix + '/' + entry.name : entry.name, out);
      } else if (/\.(md|markdown)$/i.test(entry.name)) {
        if (out.length >= MAX_FOLDER_FILES) return;
        out.push({
          id: makeId(),
          name: entry.name,
          path: prefix ? prefix + '/' + entry.name : entry.name,
          content: null,
          words: null,
          handle: entry
        });
      }
    }
  }

  // 已有会话未清空时，替换前先确认
  async function confirmFolderReplace() {
    const state = getState();
    if (state.localFiles.length === 0) return true;
    return confirm(t('local.folderReplaceConfirm', '打开新文件夹将替换当前本地文件列表，是否继续？'));
  }

  function applyFolderSession(rootName, entries) {
    const state = getState();
    entries.sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name, undefined, { numeric: true }));
    state.localFiles = entries;
    state.localFolder = { name: rootName };
    state.activeLocalFileId = '';
    renderPanel();
    // 打开第一个文件，并确保侧边栏处于 Files 模式
    openLocalFile(entries[0].id);
    if (window.MarkdownPreview.state.currentMode !== 'files') {
      window.MarkdownPreview.ui.switchMode('files');
    }
  }

  // ============== 上一篇 / 下一篇（本地列表内循环） ==============
  function navigateLocal(direction) {
    const state = getState();
    if (state.localFiles.length === 0 || !state.activeLocalFileId) return false;
    const idx = state.localFiles.findIndex(f => f.id === state.activeLocalFileId);
    if (idx === -1) return false;
    const count = state.localFiles.length;
    const next = ((idx + (direction === 'next' ? 1 : -1)) % count + count) % count;
    openLocalFile(state.localFiles[next].id);
    return true;
  }

  // ============== 拖拽打开文件 / 文件夹 ==============

  // DataTransferItem 的 entry 必须在 drop 事件同步阶段取出，
  // 事件循环一旦让出（await）items 即失效
  function collectAsEntries(dataTransfer) {
    const entries = [];
    const items = dataTransfer && dataTransfer.items;
    if (items) {
      for (const item of items) {
        if (item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
    }
    return entries;
  }

  // 递归展开拖入的目录。readEntries 每次最多返回一批（常为 100 条），
  // 需循环读到空为止才能拿全目录
  async function walkDroppedEntry(entry, prefix, out, skipped) {
    if (out.length >= MAX_FOLDER_FILES) return;
    if (entry.isFile) {
      if (!/\.(md|markdown)$/i.test(entry.name)) return;
      let file;
      try {
        file = await new Promise((resolve, reject) => entry.file(resolve, reject));
      } catch (e) {
        skipped.push(entry.name + t('local.readFailed', '（读取失败）'));
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        skipped.push(entry.name + t('local.tooLarge', '（超过 10MB）'));
        return;
      }
      out.push({
        id: makeId(),
        name: entry.name,
        path: prefix ? prefix + '/' + entry.name : entry.name,
        content: null,
        words: null,
        file
      });
    } else if (entry.isDirectory) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) return;
      const childPrefix = prefix ? prefix + '/' + entry.name : entry.name;
      const reader = entry.createReader();
      for (;;) {
        let batch;
        try {
          batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        } catch (e) {
          return;
        }
        if (!batch.length) break;
        for (const child of batch) {
          await walkDroppedEntry(child, childPrefix, out, skipped);
          if (out.length >= MAX_FOLDER_FILES) return;
        }
      }
    }
  }

  async function handleDroppedEntries(entries, dataTransfer) {
    const hasDirectory = entries.some(entry => entry.isDirectory);

    // 纯文件拖入：过滤 .md 后走多选文件同一管线
    if (!hasDirectory) {
      const files = Array.from((dataTransfer && dataTransfer.files) || [])
        .filter(f => /\.(md|markdown)$/i.test(f.name));
      if (files.length === 0) {
        alert(t('local.folderEmpty', '该文件夹内没有找到 .md 文件'));
        return;
      }
      await handlePickedFiles(files);
      return;
    }

    // 含目录：整体导入为文件夹会话
    if (!await confirmFolderReplace()) return;
    const rootName = entries.find(entry => entry.isDirectory).name;
    const skipped = [];
    const out = [];
    for (const entry of entries) {
      await walkDroppedEntry(entry, '', out, skipped);
    }
    if (out.length === 0) {
      alert(t('local.folderEmpty', '该文件夹内没有找到 .md 文件'));
      return;
    }
    applyFolderSession(rootName, out);
    if (skipped.length > 0) {
      alert(t('local.skippedFiles', '以下文件未加入列表：\n') + skipped.join('\n'));
    }
  }

  function isFileDrag(e) {
    const types = e.dataTransfer && Array.from(e.dataTransfer.types || []);
    return types && types.indexOf('Files') !== -1;
  }

  let dragDepth = 0;

  function initDragDrop() {
    const overlay = document.getElementById('dropOverlay');
    const show = () => { if (overlay) overlay.classList.add('open'); };
    const hide = () => {
      dragDepth = 0;
      if (overlay) overlay.classList.remove('open');
    };

    document.addEventListener('dragenter', (e) => {
      // 编辑器模式有自己的拖放处理（图片 / 文件插入），不接管
      if (document.body.classList.contains('editor-mode')) return;
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth += 1;
      show();
    });
    document.addEventListener('dragover', (e) => {
      if (document.body.classList.contains('editor-mode')) return;
      if (!isFileDrag(e)) return;
      // 允许 drop：必须持续阻止默认行为
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', (e) => {
      if (!isFileDrag(e)) return;
      dragDepth -= 1;
      if (dragDepth <= 0) hide();
    });
    document.addEventListener('drop', async (e) => {
      hide();
      if (document.body.classList.contains('editor-mode')) return;
      if (!isFileDrag(e)) return;
      e.preventDefault();
      const entries = collectAsEntries(e.dataTransfer);
      if (entries.length === 0) return;
      try {
        await handleDroppedEntries(entries, e.dataTransfer);
      } catch (err) {
        console.error('[local-docs] 拖拽导入失败:', err);
        alert(t('local.readFailed', '（读取失败）'));
      }
    });
    window.addEventListener('dragend', hide);
    window.addEventListener('blur', hide);
  }

  // ============== 初始化 ==============
  function bindPicker() {
    inputEl = document.getElementById('localMdInput');
    if (inputEl) {
      inputEl.addEventListener('change', async (e) => {
        await handlePickedFiles(e.target.files);
        // 重置 input，允许重复选择同一文件
        e.target.value = '';
      });
    }
    folderInputEl = document.getElementById('localMdFolderInput');
    if (folderInputEl) {
      folderInputEl.addEventListener('change', async (e) => {
        await handlePickedFolder(e.target.files);
        e.target.value = '';
      });
    }
  }

  function init() {
    const state = getState();
    if (!Array.isArray(state.localFiles)) state.localFiles = [];
    if (state.activeLocalFileId == null) state.activeLocalFileId = '';
    if (state.localFolder == null) state.localFolder = null;

    panelEl = document.getElementById('localFilesPanel');
    listEl = document.getElementById('localFilesList');
    toggleBtn = document.getElementById('localFilesToggle');
    clearBtn = document.getElementById('localFilesClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearLocalFiles);

    // 表头文件夹行：点击折叠/展开列表（表头 DOM 只构建一次）
    toggleBtn?.addEventListener('click', () => {
      collapsed = !collapsed;
      renderPanel();
    });

    bindPicker();
    initDragDrop();
    renderPanel();
  }

  window.MarkdownPreview.localDocs = {
    openLocalFile,
    openLocalFolder,
    removeLocalFile,
    clearLocalFiles,
    addTextDoc,
    clearActive,
    navigateLocal,
    getFileContent,
    refresh,
    init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
