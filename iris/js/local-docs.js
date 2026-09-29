/**
 * 本地 Markdown 文档（多文件会话）
 *
 * 「打开本地 MD」支持一次选中多个文件：
 *   - 全部读入内存会话列表（state.localFiles，刷新即清空，
 *     本地文件内容不落 localStorage，避免超出配额）
 *   - 第一个文件立即打开，其余进入侧边栏「本地文件」面板
 *     （位于文件树上方，Files 模式下可见）
 *   - 点击列表项随时切回；× 移除单个；表头按钮清空全部
 *
 * 限制：
 *   - 最多 20 个文件，单文件 ≤ 10MB，超限跳过并提示
 *   - 同名文件再次选择视为更新：原位替换内容并打开
 *   - 移除/清空"当前打开中"的文件时，正文保持显示，
 *     但清除 localDoc 与高亮（导出回退为"请先打开一个文档"）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const MAX_FILES = 20;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;

  let panelEl = null;
  let listEl = null;
  let countEl = null;
  let clearBtn = null;
  let inputEl = null;
  // 递增 id：文件名可能重名/特殊字符，不用文件名做 key
  let idSeq = 0;

  function getState() {
    return window.MarkdownPreview.state;
  }

  function makeId() {
    idSeq += 1;
    return 'local-' + Date.now().toString(36) + '-' + idSeq;
  }

  // ============== 面板渲染 ==============
  function renderPanel() {
    if (!panelEl) return;
    const files = getState().localFiles;
    panelEl.hidden = files.length === 0;
    if (countEl) countEl.textContent = String(files.length);
    if (!listEl) return;
    listEl.innerHTML = '';
    files.forEach(file => {
      const li = document.createElement('li');
      li.className = 'local-file-item' + (file.id === getState().activeLocalFileId ? ' active' : '');
      li.dataset.id = file.id;

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'local-file-open';
      openBtn.title = file.name;
      openBtn.textContent = file.name;
      openBtn.addEventListener('click', () => openLocalFile(file.id));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'local-file-remove';
      removeBtn.title = '从列表移除';
      removeBtn.setAttribute('aria-label', '移除 ' + file.name);
      removeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-x"/></svg>';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeLocalFile(file.id);
      });

      li.append(openBtn, removeBtn);
      listEl.appendChild(li);
    });
  }

  // ============== 打开 / 移除 / 清空 ==============
  function openLocalFile(id) {
    const state = getState();
    const file = state.localFiles.find(f => f.id === id);
    if (!file) return;
    state.activeLocalFileId = id;
    // 本地文件不写进 URL，刷新后丢失
    state.currentFilePath = '';
    // 清除文件树高亮：当前展示的是本地文档
    window.MarkdownPreview.fileTree?.setActiveFile('');
    window.MarkdownPreview.markdown.renderMarkdownDirect(file.content, file.name);
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

  function clearLocalFiles() {
    const state = getState();
    if (state.localFiles.length === 0) return;
    state.localFiles.length = 0;
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
        skipped.push(file.name + '（超过 10MB）');
        continue;
      }
      if (state.localFiles.length >= MAX_FILES && !state.localFiles.some(f => f.name === file.name)) {
        skipped.push(file.name + '（列表已满 ' + MAX_FILES + ' 个）');
        continue;
      }
      let content;
      try {
        content = await readAsText(file);
      } catch (e) {
        skipped.push(file.name + '（读取失败）');
        continue;
      }
      // 同名视为更新：原位替换内容，保持列表顺序
      const existing = state.localFiles.find(f => f.name === file.name);
      if (existing) {
        existing.content = content;
      } else {
        state.localFiles.push({ id: makeId(), name: file.name, content });
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
      alert('以下文件未加入列表：\n' + skipped.join('\n'));
    }
    // 若侧边栏在 Index 模式，切回 Files 让面板可见
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

  // ============== 初始化 ==============
  function bindPicker() {
    inputEl = document.getElementById('localMdInput');
    if (!inputEl) return;
    inputEl.addEventListener('change', async (e) => {
      await handlePickedFiles(e.target.files);
      // 重置 input，允许重复选择同一文件
      e.target.value = '';
    });
  }

  function init() {
    const state = getState();
    if (!Array.isArray(state.localFiles)) state.localFiles = [];
    if (state.activeLocalFileId == null) state.activeLocalFileId = '';

    panelEl = document.getElementById('localFilesPanel');
    listEl = document.getElementById('localFilesList');
    countEl = document.getElementById('localFilesCount');
    clearBtn = document.getElementById('localFilesClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearLocalFiles);
    bindPicker();
    renderPanel();
  }

  window.MarkdownPreview.localDocs = {
    openLocalFile,
    removeLocalFile,
    clearLocalFiles,
    clearActive,
    navigateLocal,
    init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
