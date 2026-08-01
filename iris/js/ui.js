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
  
  function setupEventListeners() {
    dom.mobileMenuBtn.addEventListener('click', window.MarkdownPreview.fileTree.toggleSidebar);
    dom.sidebarOverlay.addEventListener('click', window.MarkdownPreview.fileTree.closeSidebar);
    
    dom.modeFiles.addEventListener('click', () => switchMode('files'));
    dom.modeIndex.addEventListener('click', () => switchMode('index'));
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.MarkdownPreview.fileTree.closeSidebar();
      }
    });
  }
  
  function switchMode(mode) {
    state.currentMode = mode;
    
    dom.modeFiles.classList.toggle('active', mode === 'files');
    dom.modeIndex.classList.toggle('active', mode === 'index');
    dom.fileTree.classList.toggle('hidden', mode !== 'files');
    dom.indexTree.classList.toggle('hidden', mode !== 'index');
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
  
  window.MarkdownPreview.ui = {
    updateProgress,
    setupScrollProgress,
    setupEventListeners,
    switchMode,
    copyCodeToClipboard,
    updateActiveHeading
  };
})();
