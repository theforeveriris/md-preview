(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  
  const { dom, state } = window.MarkdownPreview;
  
  function updateProgress(percent) {
    dom.progressBar.style.width = percent + '%';
    if (percent === 100) {
      setTimeout(() => {
        dom.progressBar.style.width = '0%';
      }, 300);
    }
  }
  
  function setupScrollProgress() {
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      dom.readingProgressBar.style.width = scrollPercent + '%';
      dom.progressBar.style.width = scrollPercent + '%';
      
      updateActiveHeading();
    });
  }
  
  function updateActiveHeading() {
    const headings = document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6');
    const indexItems = dom.indexTree.querySelectorAll('.index-item');
    
    let activeIndex = -1;
    
    for (let i = headings.length - 1; i >= 0; i--) {
      const heading = headings[i];
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 150) {
        activeIndex = i;
        break;
      }
    }
    
    // 找到对应的索引项并高亮
    if (activeIndex >= 0 && headings[activeIndex]) {
      const activeId = headings[activeIndex].id;
      indexItems.forEach((item, idx) => {
        if (item.dataset.id === activeId) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  }
  
  // ---------- 快捷键辅助 ----------

  function isEditableTarget(e) {
    const inEditable = (el) => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable="true"]'));
    // 同时检查事件目标与当前焦点元素：真实按键 target 即焦点元素，
    // 但程序化派发的事件 target 可能是 document，此时以 activeElement 为准
    return inEditable(e.target) || inEditable(document.activeElement);
  }

  function isEditorMode() {
    return document.body.classList.contains('editor-mode');
  }

  function isSettingsOpen() {
    const overlay = document.getElementById('settingsOverlay');
    return !!(overlay && overlay.classList.contains('open'));
  }

  // 灯箱 / PPTX 放映打开时，普通按键不抢（它们的翻页键由各自 handler 处理）
  function isMediaOverlayOpen() {
    const lightbox = document.getElementById('lightboxOverlay');
    const pptx = document.getElementById('pptx-slideshow-overlay');
    return !!(lightbox && lightbox.classList.contains('open')) ||
           !!(pptx && pptx.classList.contains('is-open'));
  }

  // ---------- 搜索命令面板（Ctrl/⌘+K）----------

  function isSearchPaletteOpen() {
    return !!(dom.paletteOverlay && dom.paletteOverlay.classList.contains('active'));
  }

  function openSearchPalette() {
    if (!dom.paletteOverlay) return;
    // 移动端：先收抽屉，避免双层浮层
    if (window.innerWidth <= 768) {
      window.MarkdownPreview.fileTree.closeSidebar();
    }
    dom.paletteOverlay.classList.add('active');
    dom.paletteOverlay.setAttribute('aria-hidden', 'false');
    window.MarkdownPreview.search.reset();
    if (dom.paletteClear) dom.paletteClear.hidden = true;
    dom.searchInput.focus();
  }

  function closeSearchPalette() {
    if (!dom.paletteOverlay) return;
    dom.paletteOverlay.classList.remove('active');
    dom.paletteOverlay.setAttribute('aria-hidden', 'true');
    window.MarkdownPreview.search.reset();
    if (dom.paletteClear) dom.paletteClear.hidden = true;
  }

  // Ctrl/⌘ + K：打开搜索命令面板（对齐 GitHub / Slack 惯例键位）；
  // 面板已打开时重新聚焦输入框
  function toggleSearchPalette() {
    if (isSearchPaletteOpen()) {
      dom.searchInput.focus();
      dom.searchInput.select();
    } else {
      openSearchPalette();
    }
  }

  // [ / ]：上一篇 / 下一篇（与悬浮球按钮同逻辑，但静默不弹 alert）
  function navigateDocShortcut(direction) {
    const { state, fileTree, markdown } = window.MarkdownPreview;
    if (!state.currentFilePath) return;
    const { prev, next } = fileTree.getAdjacentFiles(state.currentFilePath);
    const target = direction === 'prev' ? prev : next;
    if (target) {
      markdown.loadMarkdownFile(target.path);
      fileTree.highlightFileInSidebar(target.path);
    }
  }

  function setupEventListeners() {
    initSearchTriggerKbd();
    dom.mobileMenuBtn.addEventListener('click', window.MarkdownPreview.fileTree.toggleSidebar);
    dom.sidebarToggle.addEventListener('click', window.MarkdownPreview.fileTree.toggleSidebar);
    dom.sidebarOverlay.addEventListener('click', window.MarkdownPreview.fileTree.closeSidebar);

    // 搜索命令面板
    dom.searchTrigger?.addEventListener('click', openSearchPalette);
    dom.paletteOverlay?.addEventListener('click', (e) => {
      if (e.target === dom.paletteOverlay) closeSearchPalette();
    });
    // 清空按钮：有输入时出现，替代原生 ❌
    const syncClearBtn = () => {
      if (dom.paletteClear) dom.paletteClear.hidden = !dom.searchInput.value;
    };
    dom.searchInput?.addEventListener('input', syncClearBtn);
    dom.paletteClear?.addEventListener('click', () => {
      dom.searchInput.value = '';
      // 触发 input 让 search.js 清空结果回到空态提示
      dom.searchInput.dispatchEvent(new Event('input'));
      dom.searchInput.focus();
      syncClearBtn();
    });

    dom.modeFiles.addEventListener('click', () => switchMode('files'));
    dom.modeIndex.addEventListener('click', () => switchMode('index'));

    // 全局快捷键。完整清单见 docs/shortcuts.md。
    // 守卫优先级：Esc（关设置/侧边栏）→ 编辑器模式 / 输入态 → 各键位。
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const alt = e.altKey;
      const shift = e.shiftKey;
      const key = String(e.key);

      if (e.key === 'Escape') {
        // 设置面板打开时 Esc 只关设置面板
        if (isSettingsOpen()) {
          window.MarkdownPreview.settings.close();
          return;
        }
        // 搜索面板是最上层浮层，Esc 优先关闭
        if (isSearchPaletteOpen()) {
          closeSearchPalette();
          return;
        }
        // 右键浮动菜单（LaTeX 复制 / 表格操作）打开时先关菜单
        if (window.MarkdownPreview.interactions?.isMenuOpen?.()) {
          window.MarkdownPreview.interactions.hideMenu();
          return;
        }
        // 编辑器 / 灯箱 / PPTX 放映有自己的 Esc 处理，不抢
        if (isEditorMode()) return;
        if (isMediaOverlayOpen()) return;
        window.MarkdownPreview.fileTree.closeSidebar();
        return;
      }

      // 编辑器模式有独立键位（Ctrl+B=粗体、Ctrl+K=链接等），全部不抢占
      if (isEditorMode()) return;
      // 输入控件内不抢占
      if (isEditableTarget(e)) return;

      // Ctrl/⌘ + , ：设置面板开关（面板打开时也可用）
      if (mod && !alt && key === ',') {
        e.preventDefault();
        window.MarkdownPreview.settings.toggle();
        return;
      }

      // Ctrl/⌘ + Alt + = / + / - / 0 / F ：内容区宽度（面板打开时也可用，便于看数值）
      if (mod && alt && (key === '=' || key === '+' || key === '-' || key === '0' ||
          key.toLowerCase() === 'f')) {
        e.preventDefault();
        if (key === '=') window.MarkdownPreview.settings.nudgeContentWidth(20);
        else if (key === '+') window.MarkdownPreview.settings.nudgeContentWidth(20);
        else if (key === '-') window.MarkdownPreview.settings.nudgeContentWidth(-20);
        else if (key === '0') window.MarkdownPreview.settings.resetContentWidth();
        else window.MarkdownPreview.settings.toggleContentFullWidth();
        return;
      }

      // 以下键位在设置面板打开时不动作
      if (isSettingsOpen()) return;

      // Ctrl/⌘ + B ：折叠/展开侧边栏（对齐 VS Code 习惯键位）
      if (mod && !alt && !shift && key.toLowerCase() === 'b') {
        e.preventDefault();
        window.MarkdownPreview.fileTree.toggleSidebar();
        return;
      }

      // Ctrl/⌘ + K ：搜索命令面板（对齐 GitHub / Slack 惯例键位）
      if (mod && !alt && !shift && key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleSearchPalette();
        return;
      }

      // [ / ] ：上一篇 / 下一篇（对齐 GitHub 代码评审翻页键位）
      if (!mod && !alt && !shift && (key === '[' || key === ']')) {
        if (isMediaOverlayOpen()) return;
        navigateDocShortcut(key === '[' ? 'prev' : 'next');
      }
    });
  }
  
  function switchMode(mode) {
    state.currentMode = mode;

    dom.modeFiles.classList.toggle('active', mode === 'files');
    dom.modeIndex.classList.toggle('active', mode === 'index');
    dom.fileTree.classList.toggle('hidden', mode !== 'files');
    dom.indexTree.classList.toggle('hidden', mode !== 'index');
    // 本地文件面板归属 Files 区
    const localFilesPanel = document.getElementById('localFilesPanel');
    if (localFilesPanel) localFilesPanel.hidden = mode !== 'files' || state.localFiles.length === 0;
  }
  
  function copyCodeToClipboard(pre) {
    const code = pre.querySelector('code');
    if (code) {
      navigator.clipboard.writeText(code.textContent).then(() => {
        const originalText = code.textContent;
        code.textContent = 'Copied!';
        setTimeout(() => {
          code.textContent = originalText;
        }, 1500);
      });
    }
  }

  // 触发行快捷键提示按平台显示（Mac 用 ⌘K，其余用 Ctrl K）
  function initSearchTriggerKbd() {
    if (!dom.searchTriggerKbd) return;
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    dom.searchTriggerKbd.textContent = isApple ? '⌘K' : 'Ctrl K';
  }

  window.MarkdownPreview.ui = {
    updateProgress,
    setupScrollProgress,
    setupEventListeners,
    switchMode,
    copyCodeToClipboard,
    updateActiveHeading,
    openSearchPalette,
    closeSearchPalette,
    isSearchPaletteOpen,
    initSearchTriggerKbd
  };
})();
