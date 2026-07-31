(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};

  const { dom, state, CONFIG } = window.MarkdownPreview;
  // 共享渲染模块：Alerts / LaTeX / Renderer / 画廊分组 / 轮播 / 代码高亮
  const mdRender = window.MarkdownPreview.mdRender;

  // ============== 注册 marked-footnote 扩展 ==============
  // 支持 [^id] 引用 与 [^id]: 定义 语法，渲染为带回链的脚注区
  if (typeof marked !== 'undefined' && typeof markedFootnote !== 'undefined') {
    try {
      marked.use(markedFootnote({
        prefixId: 'fn-',
        description: '脚注',
        refMarkers: false,
        footnoteDivider: true,
        sectionClass: 'footnotes',
        headingClass: 'footnotes-heading',
        backRefLabel: '返回引用 {0}'
      }));
    } catch (e) {
      console.warn('[markdown] markedFootnote 注册失败:', e);
    }
  }

  async function loadMarkdownFile(path) {
    try {
      // 立即更新 URL，提供即时反馈
      const { router } = window.MarkdownPreview;
      if (router && router.updateHash) {
        router.updateHash(path);
      }

      window.MarkdownPreview.ui.updateProgress(30);
      const response = await fetch(path, { cache: 'no-store' });

      if (window.MarkdownPreview.debug && window.MarkdownPreview.debug.incrementApiCalls) {
        window.MarkdownPreview.debug.incrementApiCalls();
      }

      if (!response.ok) {
        throw new Error('Failed to load markdown file');
      }
      window.MarkdownPreview.ui.updateProgress(60);
      const markdown = await response.text();
      window.MarkdownPreview.ui.updateProgress(100);
      state.currentFilePath = path;
      renderMarkdown(markdown, path);
      extractAndRenderIndex(markdown);
      updateEditButton(path);
      updateBreadcrumbs(path);
      setupHeadingNavigation();
    } catch (error) {
      console.error('Error loading markdown:', error);
      dom.markdownContent.innerHTML = '<div class="welcome-state"><p class="welcome-text">无法加载文件</p></div>';
      setTimeout(() => window.MarkdownPreview.ui.updateProgress(0), 300);
    }
  }

  function parseFrontmatter(markdown) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*/;
    const match = markdown.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, content: markdown };
    }

    const frontmatterStr = match[1];
    const content = markdown.substring(match[0].length);

    const frontmatter = {};
    const lines = frontmatterStr.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }

        frontmatter[key] = value;
      }
    }

    return { frontmatter, content };
  }

  function calculateReadingTime(text) {
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    const englishCount = englishWords.reduce((sum, word) => sum + word.length, 0);
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const chineseCount = chineseChars.length;

    const englishMinutes = englishCount / 200;
    const chineseMinutes = chineseCount / 400;

    return Math.ceil(englishMinutes + chineseMinutes);
  }

  // ============== GitHub Alerts / LaTeX 保护 ==============
  // 已迁移至共享模块 md-render.js，这里保留薄封装以兼容内部调用。
  // markdown.js 使用默认 emoji 版 Alert 图标（与编辑器 SVG 版区分）。
  const processGitHubAlerts = (text) => mdRender.processGitHubAlerts(text);
  const protectLaTeXBlocks = (text) => mdRender.protectLaTeXBlocks(text);

  function resolveImageSrc(src, currentPath) {
    if (!src) return src;
    
    // 已经是绝对 URL 或 data URL，不需要处理
    if (src.startsWith('http://') || src.startsWith('https://') || 
        src.startsWith('data:') || src.startsWith('//')) {
      return src;
    }
    
    // 没有当前路径，无法解析相对路径
    if (!currentPath) return src;
    
    // 获取当前文档所在目录
    const currentDir = currentPath.split('/').slice(0, -1).join('/');
    
    // 解析相对路径
    let resolvedPath;
    if (src.startsWith('/')) {
      // 绝对路径（相对于仓库根目录）
      resolvedPath = src.substring(1);
    } else {
      // 相对路径
      const parts = (currentDir ? currentDir + '/' : '') + src;
      resolvedPath = simplifyPath(parts);
    }
    
    return resolvedPath;
  }
  
  function processImages(container, currentPath = '') {
    const images = container.querySelectorAll('img');

    images.forEach(img => {
      img.setAttribute('loading', 'lazy');

      const originalSrc = img.getAttribute('src') || '';

      // 解析相对路径为相对于仓库根目录的路径
      if (currentPath && originalSrc &&
          !originalSrc.startsWith('http://') &&
          !originalSrc.startsWith('https://') &&
          !originalSrc.startsWith('data:') &&
          !originalSrc.startsWith('//')) {
        const resolvedSrc = resolveImageSrc(originalSrc, currentPath);
        img.setAttribute('src', resolvedSrc);
        img.setAttribute('data-original-src', originalSrc);
      }

      const src = img.getAttribute('src') || '';
      const filename = src.split('/').pop() || 'image';
      const alt = img.getAttribute('alt') || filename;

      img.onerror = function() {
        this.onerror = null;
        this.style.display = 'none';

        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.innerHTML = `
          <div class="placeholder-icon">🖼️</div>
          <div class="placeholder-text">${alt}</div>
          <div class="placeholder-filename">${filename}</div>
        `;

        this.parentNode.insertBefore(placeholder, this);
      };
    });

    // 画廊分组（@style 标记 + 相邻图片段落合并）已迁移至共享模块
    mdRender.groupGalleries(container);
  }

  // 幻灯片自动轮播：已迁移至共享模块 mdRender.initSliders
  const initSliders = (container) => mdRender.initSliders(container);

  function wrapTables(container) {
    const tables = container.querySelectorAll('table');
    tables.forEach(table => {
      if (table.parentElement.classList.contains('table-wrapper')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function renderMarkdown(markdown, currentPath = '') {
    const renderStartTime = performance.now();
    const { frontmatter, content } = parseFrontmatter(markdown);

    if (frontmatter.title) {
      document.title = frontmatter.title + ' | ' + (CONFIG.repo || 'Markdown Preview');
    } else {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        document.title = titleMatch[1] + ' | ' + (CONFIG.repo || 'Markdown Preview');
      } else {
        document.title = CONFIG.repo || 'Markdown Preview';
      }
    }

    state.currentFrontmatter = frontmatter;

    // Markdown → HTML（LaTeX 保护 + Alerts + 自定义 Renderer）已迁移至共享模块
    const { html } = mdRender.parseMarkdown(content);

    const plainText = content.replace(/[#*`\[\]()_{}]/g, '').replace(/\n+/g, ' ').trim();
    const readingTime = calculateReadingTime(plainText);
    const readingTimeHtml = `<div class="reading-time">预计阅读 ${readingTime} 分钟</div>`;

    const headingMatch = html.match(/<h1[^>]*>/);
    let finalHtml;
    if (headingMatch) {
      const insertIndex = headingMatch.index + headingMatch[0].length;
      finalHtml = html.slice(0, insertIndex) + readingTimeHtml + html.slice(insertIndex);
    } else {
      finalHtml = readingTimeHtml + html;
    }

    dom.markdownContent.innerHTML = finalHtml;

    // 调试面板用：记录当前文档渲染信息
    state.lastDocStats = {
      path: currentPath,
      sourceLength: markdown.length,
      htmlLength: finalHtml.length,
      renderMs: Math.round(performance.now() - renderStartTime)
    };

    document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6').forEach(heading => {
      const text = heading.textContent;
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
      heading.id = id;
    });

    setupClickDelegate();
    mdRender.highlightCodeBlocks(dom.markdownContent);

    interceptLinks(currentPath);

    processImages(dom.markdownContent, currentPath);

    initSliders(dom.markdownContent);

    wrapTables(dom.markdownContent);

    mdRender.initCodeTabs(dom.markdownContent);

    setTimeout(async () => {
      console.log('[Markdown] Starting render cycle');
      const plugins = window.MarkdownPreview.plugins;
      if (plugins && typeof plugins.render === 'function') {
        await plugins.render({ documentPath: currentPath });
      } else {
        await renderWithPluginsLegacy();
      }
      console.log('[Markdown] Plugins rendered, calling other renderers');
      // 渲染器现在按需懒加载 vendor 库（async），逐个 await 并隔离错误，
      // 避免某一个库加载/渲染失败导致后续渲染器不执行
      const safeRun = async (label, fn) => {
        try { await fn(); }
        catch (e) { console.error('[Markdown] ' + label + ' renderer failed:', e); }
      };
      await safeRun('apexcharts', () => window.MarkdownPreview.renderers.apexcharts.render());
      await safeRun('diff', () => window.MarkdownPreview.renderers.diff.render());
      await safeRun('mermaid', () => window.MarkdownPreview.renderers.mermaid.render());
      await safeRun('plantuml', () => window.MarkdownPreview.renderers.plantuml.render());
      await safeRun('embedded', () => window.MarkdownPreview.renderers.embedded.render());
      await safeRun('katex', () => window.MarkdownPreview.renderers.katex.render());
      await safeRun('pulse', () => window.MarkdownPreview.renderers.pulse.render());
      console.log('[Markdown] Render cycle complete');
    }, 100);

    renderDocNavigation(currentPath);
  }

  function renderDocNavigation(currentPath) {
    if (!currentPath || !state.fileTreeData) return;

    const { prev, next } = window.MarkdownPreview.fileTree.getAdjacentFiles(currentPath);
    if (!prev && !next) return;

    const existingNav = dom.markdownContent.querySelector('.doc-navigation');
    if (existingNav) existingNav.remove();

    const navHtml = `
      <div class="doc-navigation">
        ${prev ? `<a href="#/${prev.path}" data-path="${prev.path}" class="nav-link">← ${prev.name}</a>` : ''}
        ${next ? `<a href="#/${next.path}" data-path="${next.path}" class="nav-link">${next.name} →</a>` : ''}
      </div>
    `;

    dom.markdownContent.insertAdjacentHTML('beforeend', navHtml);

    dom.markdownContent.querySelectorAll('.doc-navigation .nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = link.dataset.path;
        loadMarkdownFile(path);
        window.MarkdownPreview.fileTree.highlightFileInSidebar(path);
      });
    });
  }

  async function renderWithPluginsLegacy() {
    console.log('[Plugins] renderWithPlugins called');
    const plugins = window.MarkdownPreview.plugins;
    if (!plugins || typeof plugins.find !== 'function') {
      console.log('[Plugins] Plugins not available');
      return;
    }

    const allPres = document.querySelectorAll('.markdown-body pre');
    console.log('[Plugins] Found pre elements:', allPres.length);

    // 从后往前遍历，防止替换前面的元素后导致索引失效
    for (let i = allPres.length - 1; i >= 0; i--) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');
      if (!codeElement) continue;

      const classList = codeElement.className;
      const languageMatch = classList ? classList.match(/language-(\S+)/) : null;
      const language = languageMatch ? languageMatch[1] : '';
      const code = codeElement.textContent.trim();

      console.log('[Plugins] Checking code block, language:', language);

      const plugin = plugins.find(code, language);
      if (plugin) {
        console.log('[Plugins] Found plugin for language:', language, 'plugin:', plugin.name);
        try {
          const container = document.createElement('div');
          container.className = `plugin-rendered plugin-${plugin.name}`;
          pre.parentNode.replaceChild(container, pre);
          plugin.render(code, container);
          console.log('[Plugins] Successfully rendered plugin:', plugin.name);
        } catch (error) {
          console.error(`Plugin ${plugin.name} render error:`, error);
        }
      }
    }
  }

  function interceptLinks(currentPath) {
    document.querySelectorAll('.markdown-body a').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        if (href.endsWith('.md')) {
          e.preventDefault();

          let targetPath = href;
          if (!href.startsWith('/') && currentPath) {
            const currentDir = currentPath.split('/').slice(0, -1).join('/');
            targetPath = currentDir ? `${currentDir}/${href}` : href;
            targetPath = simplifyPath(targetPath);
          }

          if (targetPath.startsWith('/')) {
            targetPath = targetPath.substring(1);
          }

          loadMarkdownFile(targetPath);
          window.MarkdownPreview.fileTree.highlightFileInSidebar(targetPath);
        }
      });
    });
  }

  function simplifyPath(path) {
    const parts = path.split('/');
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === '..') {
        result.pop();
      } else if (part !== '.' && part !== '') {
        result.push(part);
      }
    }
    return result.join('/');
  }

  function extractAndRenderIndex(markdown) {
    state.currentHeadings = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = headingRegex.exec(markdown)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
      state.currentHeadings.push({ level, text, id });
    }

    renderIndex();
  }

  function renderIndex() {
    dom.indexTree.innerHTML = '';

    if (state.currentHeadings.length === 0) {
      dom.indexTree.innerHTML = '<div class="index-item" style="color: var(--color-text-muted);">当前文件无目录</div>';
      return;
    }

    state.currentHeadings.forEach((heading, index) => {
      const item = document.createElement('a');
      item.className = 'index-item';
      item.href = '#' + heading.id;
      item.textContent = heading.text;
      item.style.paddingLeft = (20 + (heading.level - 1) * 16) + 'px';
      item.dataset.id = heading.id;

      // 目录对齐线：与文件树栏一致的虚线竖向缩进引导线
      if (heading.level > 1) {
        var guideLine = 'repeating-linear-gradient(to bottom, var(--index-guide-color) 0 1px, transparent 1px 4px)';
        var positions = [];
        for (var k = 1; k < heading.level; k++) {
          positions.push((20 + (k - 1) * 16) + 'px 0');
        }
        item.style.backgroundImage = positions.map(function () { return guideLine; }).join(', ');
        item.style.backgroundPosition = positions.join(', ');
        item.style.backgroundSize = '1px 4px';
        item.style.backgroundRepeat = 'repeat-y';
      }

      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(heading.id);
        if (target) {
          window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 10, behavior: 'instant' });
        }
        setActiveIndexItem(item);
      });

      dom.indexTree.appendChild(item);
    });
  }

  function setActiveIndexItem(item) {
    document.querySelectorAll('.index-item.active').forEach(el => {
      el.classList.remove('active');
    });
    item.classList.add('active');
  }

  // 根据标题 id 高亮对应的目录项（供路由锚点直达调用）
  function setActiveIndexById(id) {
    const indexItems = dom.indexTree.querySelectorAll('.index-item');
    let matched = false;
    indexItems.forEach(item => {
      if (item.dataset.id === id) {
        item.classList.add('active');
        matched = true;
      } else {
        item.classList.remove('active');
      }
    });
    return matched;
  }

  function updateEditButton(path) {
    if (!dom.editPageBtn || !dom.pageHeader) return;

    if (!path) {
      dom.pageHeader.style.display = 'none';
      dom.editPageBtn.style.display = 'none';
      return;
    }

    dom.pageHeader.style.display = 'flex';
    dom.editPageBtn.style.display = 'flex';

    const editUrl = `https://github.com/${CONFIG.owner}/${CONFIG.repo}/edit/main/${path}`;
    dom.editPageBtn.href = editUrl;
  }

  function updateBreadcrumbs(path) {
    if (!dom.pageBreadcrumbs) return;

    dom.pageBreadcrumbs.innerHTML = '';

    if (!path) return;

    const parts = path.split('/');

    const rootCrumb = document.createElement('span');
    rootCrumb.className = 'breadcrumb-item';
    rootCrumb.textContent = CONFIG.repo || 'Docs';
    rootCrumb.style.cursor = 'pointer';
    rootCrumb.style.color = 'var(--color-accent-purple-deep)';
    rootCrumb.addEventListener('click', () => {
      dom.markdownContent.innerHTML = '<div class="welcome-state"><p class="welcome-text">选择一个文件开始阅读</p></div>';
      state.currentFilePath = '';
      window.history.replaceState(null, '', window.location.pathname);
      dom.pageHeader.style.display = 'none';
    });
    dom.pageBreadcrumbs.appendChild(rootCrumb);

    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      const separator = document.createElement('span');
      separator.textContent = '/';
      separator.style.margin = '0 4px';
      separator.style.color = 'var(--color-text-muted)';
      dom.pageBreadcrumbs.appendChild(separator);

      currentPath = currentPath ? currentPath + '/' + part : part;

      const crumb = document.createElement('span');
      crumb.className = 'breadcrumb-item';

      if (i === parts.length - 1) {
        crumb.textContent = part.replace('.md', '');
        crumb.style.color = 'var(--color-text)';
        crumb.style.fontWeight = '500';
      } else {
        crumb.textContent = part;
        crumb.style.color = 'var(--color-accent-purple-deep)';
        crumb.style.cursor = 'pointer';
      }

      dom.pageBreadcrumbs.appendChild(crumb);
    }
  }

  function setupHeadingNavigation() {
    if (!dom.markdownContent) return;

    const oldHeadings = dom.markdownContent.querySelectorAll('.heading-clickable');
    oldHeadings.forEach(h => {
      h.classList.remove('heading-clickable');
      h.style.cursor = '';
      const oldAnchor = h.querySelector('.heading-anchor');
      if (oldAnchor) oldAnchor.remove();
    });

    const headings = dom.markdownContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      heading.classList.add('heading-clickable');
      heading.style.cursor = 'pointer';
      heading.style.position = 'relative';

      // 锚点分享按钮：仅 H1（文档主标题）显示，点击复制由事件委托处理
      if (heading.tagName === 'H1' && heading.id && !heading.querySelector('.heading-anchor')) {
        const anchorBtn = document.createElement('span');
        anchorBtn.className = 'heading-anchor';
        anchorBtn.title = '复制此标题的直达链接';
        anchorBtn.setAttribute('aria-label', '复制此标题的直达链接');
        anchorBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        heading.appendChild(anchorBtn);
      }

      heading.addEventListener('mouseenter', () => {
        heading.style.borderLeft = '3px solid var(--color-accent-purple)';
        heading.style.paddingLeft = '8px';
        heading.style.marginLeft = '-11px';
      });

      heading.addEventListener('mouseleave', () => {
        heading.style.borderLeft = '';
        heading.style.paddingLeft = '';
        heading.style.marginLeft = '';
      });

      heading.addEventListener('click', (e) => {
        // 点击锚点按钮时不触发的标题滚动逻辑
        if (e.target.closest('.heading-anchor')) return;
        const id = heading.id;
        if (id) {
          // 平滑滚动到标题，不覆盖文档路由 hash
          heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setActiveIndexById(id);
        }
      });
    });
  }

  // 事件委托：在 markdownContent 上统一处理 copy-btn 和 heading-anchor 的点击
  // 避免 renderWithPlugins 替换 DOM 后事件丢失
  let clickDelegateInitialized = false;
  function setupClickDelegate() {
    if (clickDelegateInitialized) return;
    clickDelegateInitialized = true;
    dom.markdownContent.addEventListener('click', (e) => {
      // 代码块复制按钮
      const copyBtn = e.target.closest('.copy-btn');
      if (copyBtn) {
        e.preventDefault();
        e.stopPropagation();
        const pre = copyBtn.closest('pre');
        const code = pre && pre.querySelector('code');
        if (code) {
          console.log('[copy] copy-btn clicked');
          copyToClipboard(code.textContent).then(ok => {
            if (ok) {
              copyBtn.classList.add('copied');
              setTimeout(() => copyBtn.classList.remove('copied'), 1500);
            }
          });
        }
        return;
      }
      // 标题锚点按钮（仅 H1）
      const anchorBtn = e.target.closest('.heading-anchor');
      if (anchorBtn) {
        e.stopPropagation();
        e.preventDefault();
        const heading = anchorBtn.closest('h1');
        if (heading && heading.id) {
          console.log('[copy] heading-anchor clicked');
          copyHeadingLink(heading.id, anchorBtn);
        }
        return;
      }
      // 图片灯箱（链接内的图片不拦截，保留默认跳转）
      const img = e.target.closest('img');
      if (img && !img.closest('a')) {
        e.preventDefault();
        openLightbox(img);
        return;
      }
    });
    console.log('[copy] click delegate initialized');
    initLightbox();
  }

  // 通用复制函数：返回 Promise<boolean>
  function copyToClipboard(text) {
    // 优先 Clipboard API（安全上下文下最可靠）
    if (window.isSecureContext && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => {
        console.log('[copy] clipboard API 成功');
        return true;
      }).catch((err) => {
        console.warn('[copy] clipboard API 失败，降级 execCommand:', err);
        return legacyCopy(text);
      });
    }
    return Promise.resolve(legacyCopy(text));
  }

  // 降级复制：用可见的临时容器 + Selection API
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '50%';
    ta.style.left = '50%';
    ta.style.fontSize = '16px';
    document.body.appendChild(ta);

    const previouslyFocused = document.activeElement;
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);

    let ok = false;
    try {
      ok = document.execCommand('copy');
      console.log('[copy] execCommand 返回:', ok);
    } catch (e) {
      console.warn('[copy] execCommand 异常:', e);
    }

    document.body.removeChild(ta);
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus();
    }
    return ok;
  }

  // 复制标题直达链接到剪贴板
  function copyHeadingLink(headingId, btn) {
    const { state } = window.MarkdownPreview;
    const docPath = state.currentFilePath;
    if (!docPath) {
      console.warn('复制失败：未找到当前文档路径');
      return;
    }
    const base = window.location.origin + window.location.pathname;
    const link = `${base}#/${docPath}#${headingId}`;
    copyToClipboard(link).then(ok => flashButton(btn, ok));
  }

  // 按钮视觉反馈：成功显示对勾，失败显示提示
  function flashButton(btn, success) {
    const originalHTML = btn.getAttribute('data-original-html');
    if (originalHTML === null) {
      btn.setAttribute('data-original-html', btn.innerHTML);
    }
    const savedOriginal = btn.getAttribute('data-original-html');
    const savedTitle = btn.getAttribute('data-original-title');
    if (savedTitle === null) {
      btn.setAttribute('data-original-title', btn.title);
    }
    const origTitle = btn.getAttribute('data-original-title');

    btn.classList.add('copied');
    if (success) {
      btn.title = '已复制链接！';
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    } else {
      btn.title = '复制失败，请手动复制';
    }
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.title = origTitle;
      btn.innerHTML = savedOriginal;
    }, 1500);
  }

  // 高亮 dom.markdownContent 内的代码块（共享实现）
  function highlightCodeBlocks() {
    mdRender.highlightCodeBlocks(dom.markdownContent);
  }

  // 代码块复制已由 setupClickDelegate 事件委托处理，无需单独绑定
  function setupCopyButtons() {}

  /* ============ 图片灯箱 ============ */
  let lightboxInitialized = false;
  const lightboxState = { images: [], index: 0, scale: 1 };

  function initLightbox() {
    if (lightboxInitialized) return;
    lightboxInitialized = true;

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.id = 'lightboxOverlay';
    overlay.innerHTML = `
      <button class="lightbox-close" aria-label="关闭">&times;</button>
      <button class="lightbox-nav lightbox-prev" aria-label="上一张">&#8249;</button>
      <button class="lightbox-nav lightbox-next" aria-label="下一张">&#8250;</button>
      <div class="lightbox-stage">
        <img class="lightbox-image" alt="">
      </div>
      <div class="lightbox-toolbar">
        <button class="lightbox-tool" data-action="zoom-out" aria-label="缩小">&minus;</button>
        <span class="lightbox-zoom-label">100%</span>
        <button class="lightbox-tool" data-action="zoom-in" aria-label="放大">+</button>
        <button class="lightbox-tool" data-action="reset" aria-label="重置缩放">&#8634;</button>
      </div>
      <div class="lightbox-counter"></div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('lightbox-stage')) {
        closeLightbox();
      }
    });
    overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    overlay.querySelector('.lightbox-prev').addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(-1); });
    overlay.querySelector('.lightbox-next').addEventListener('click', (e) => { e.stopPropagation(); navigateLightbox(1); });
    overlay.querySelector('[data-action="zoom-in"]').addEventListener('click', (e) => { e.stopPropagation(); zoomLightbox(0.25); });
    overlay.querySelector('[data-action="zoom-out"]').addEventListener('click', (e) => { e.stopPropagation(); zoomLightbox(-0.25); });
    overlay.querySelector('[data-action="reset"]').addEventListener('click', (e) => { e.stopPropagation(); resetLightboxZoom(); });

    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') navigateLightbox(-1);
      else if (e.key === 'ArrowRight') navigateLightbox(1);
      else if (e.key === '+' || e.key === '=') zoomLightbox(0.25);
      else if (e.key === '-') zoomLightbox(-0.25);
      else if (e.key === '0') resetLightboxZoom();
    });
  }

  function openLightbox(img) {
    initLightbox();
    const overlay = document.getElementById('lightboxOverlay');
    // 收集当前文档内所有可查看图片（不含链接内图片）
    const allImgs = Array.from(dom.markdownContent.querySelectorAll('img')).filter(i => !i.closest('a'));
    lightboxState.images = allImgs;
    lightboxState.index = Math.max(0, allImgs.indexOf(img));
    lightboxState.scale = 1;
    renderLightboxImage();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function renderLightboxImage() {
    const overlay = document.getElementById('lightboxOverlay');
    const imgEl = overlay.querySelector('.lightbox-image');
    const counter = overlay.querySelector('.lightbox-counter');
    const zoomLabel = overlay.querySelector('.lightbox-zoom-label');
    const src = lightboxState.images[lightboxState.index];
    if (!src) return;
    imgEl.src = src.src;
    imgEl.alt = src.alt || '';
    lightboxState.scale = 1;
    imgEl.style.transform = 'scale(1)';
    zoomLabel.textContent = '100%';
    const multi = lightboxState.images.length > 1;
    counter.textContent = multi ? `${lightboxState.index + 1} / ${lightboxState.images.length}` : '';
    overlay.querySelector('.lightbox-prev').style.display = multi ? '' : 'none';
    overlay.querySelector('.lightbox-next').style.display = multi ? '' : 'none';
  }

  function closeLightbox() {
    const overlay = document.getElementById('lightboxOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function navigateLightbox(dir) {
    const n = lightboxState.images.length;
    if (n === 0) return;
    lightboxState.index = (lightboxState.index + dir + n) % n;
    renderLightboxImage();
  }

  function zoomLightbox(delta) {
    const overlay = document.getElementById('lightboxOverlay');
    const imgEl = overlay.querySelector('.lightbox-image');
    lightboxState.scale = Math.min(4, Math.max(0.25, lightboxState.scale + delta));
    imgEl.style.transform = `scale(${lightboxState.scale})`;
    overlay.querySelector('.lightbox-zoom-label').textContent = Math.round(lightboxState.scale * 100) + '%';
  }

  function resetLightboxZoom() {
    const overlay = document.getElementById('lightboxOverlay');
    const imgEl = overlay.querySelector('.lightbox-image');
    lightboxState.scale = 1;
    imgEl.style.transform = 'scale(1)';
    overlay.querySelector('.lightbox-zoom-label').textContent = '100%';
  }

  window.MarkdownPreview.markdown = {
    loadMarkdownFile,
    renderMarkdown,
    // 直接渲染内容字符串（用于本地 MD 文件，不经过 fetch 和 URL）
    renderMarkdownDirect: function(content, fileName) {
      // 清空 URL hash，避免刷新后仍尝试加载原路径
      if (window.location.hash) {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      // 更新面包屑为文件名
      if (fileName) {
        const bc = document.getElementById('pageBreadcrumbs');
        const header = document.getElementById('pageHeader');
        if (bc) bc.textContent = fileName;
        if (header) header.style.display = 'flex';
      }
      renderMarkdown(content, '');
    },
    interceptLinks,
    simplifyPath,
    extractAndRenderIndex,
    renderIndex,
    setActiveIndexItem,
    setActiveIndexById,
    updateEditButton,
    parseFrontmatter,
    updateBreadcrumbs,
    setupHeadingNavigation,
    calculateReadingTime,
    highlightCodeBlocks
  };
})();
