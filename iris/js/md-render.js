/**
 * Markdown 渲染共享逻辑
 *
 * editor.js 与 markdown.js 中重复的渲染辅助函数统一在此导出：
 *   - GitHub Alerts 处理
 *   - LaTeX 块保护
 *   - marked 自定义 Renderer（代码块、画廊样式标记）
 *   - 图片画廊分组
 *   - 幻灯片自动轮播
 *   - 代码块语法高亮
 *
 * 设计原则：
 *   1. 纯函数，不依赖任何外部状态
 *   2. 容器/参数由调用方传入，不耦合 dom.markdownContent / cell.output
 *   3. 已注册的画廊样式列表作为常量导出，避免两处维护
 */
(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 已注册的画廊样式 ==============
  const KNOWN_STYLES = [
    'grid', 'cardstack', 'filmstrip', 'polaroid', 'stack', 'mosaic',
    'scattered', 'hexagon', 'coverflow', 'tape', 'duotone', 'frame',
    'arch', 'masonry', 'slider', 'ticket', 'panorama'
  ];

  // ============== 默认 Alert 类型（emoji 版） ==============
  const DEFAULT_ALERT_TYPES = {
    NOTE:     { icon: 'ℹ️',    title: 'Note' },
    IMPORTANT:{ icon: '💡',    title: 'Important' },
    WARNING:  { icon: '⚠️',    title: 'Warning' },
    TIP:      { icon: '💡',    title: 'Tip' },
    CAUTION:  { icon: '⚠️',    title: 'Caution' }
  };

  /**
   * 处理 GitHub Alerts（> [!TYPE] 语法）
   * @param {string} text - Markdown 文本
   * @param {Object} [opts]
   * @param {Object} [opts.alertTypes] - 自定义类型映射 { TYPE: { icon, title } }
   * @returns {string} 处理后的 HTML 字符串（仍含未消费的 Markdown）
   */
  function processGitHubAlerts(text, opts) {
    opts = opts || {};
    const alertTypes = opts.alertTypes || DEFAULT_ALERT_TYPES;
    const lines = text.split('\n');
    let result = '';
    let i = 0;
    while (i < lines.length) {
      const m = lines[i].match(/^> \[!([A-Z]+)\](.*)$/);
      if (m && alertTypes[m[1]]) {
        const cfg = alertTypes[m[1]];
        const icon = cfg.icon;
        const title = cfg.title || (m[1].charAt(0) + m[1].slice(1).toLowerCase());
        const contentLines = [];
        i++;
        while (i < lines.length && (lines[i].startsWith('> ') || lines[i].trim() === '')) {
          contentLines.push(lines[i].trim() === '' ? '' : lines[i].substring(2));
          i++;
        }
        const parsedContent = marked.parse(contentLines.join('\n').trim(), { breaks: true, gfm: true });
        const cls = `alert-${m[1].toLowerCase()}`;
        result += `<div class="alert ${cls}"><div class="alert-header"><span class="alert-icon">${icon}</span><span class="alert-title">${title}</span></div><div class="alert-content">${parsedContent}</div></div>\n`;
      } else {
        result += lines[i] + '\n';
        i++;
      }
    }
    return result;
  }

  /**
   * 保护 $$...$$ LaTeX 块，避免被 marked 误处理
   * @param {string} text
   * @returns {{ processed: string, blocks: string[] }}
   */
  function protectLaTeXBlocks(text) {
    const blocks = [];
    const processed = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
      const idx = blocks.length;
      const cleaned = match.split('\n').map((l, i, a) => {
        if (i === 0) return l.replace(/^\$\$\s*/, '');
        if (i === a.length - 1) return l.replace(/\s*\$\$$/, '');
        return l.replace(/^    /, '');
      }).join('\n').trim();
      blocks.push(cleaned);
      return `LATEXPROTECT_${idx}_`;
    });
    return { processed, blocks };
  }

  /**
   * 还原 LaTeX 占位符为 katex-block div
   * @param {string} html
   * @param {string[]} blocks
   * @returns {string}
   */
  function restoreLaTeXBlocks(html, blocks) {
    return html.replace(/LATEXPROTECT_(\d+)_/g, (m, idx) => {
      return `<div class="katex-block">${blocks[parseInt(idx)]}</div>`;
    });
  }

  /**
   * 创建 marked 自定义 Renderer
   * - code：渲染带复制按钮与语言标签的代码块
   * - paragraph：识别 @style 标记转为隐藏的画廊样式标记节点
   * @param {Object} [opts]
   * @param {string[]} [opts.knownStyles] - 已注册的画廊样式（默认 KNOWN_STYLES）
   * @returns {marked.Renderer}
   */
  function createMdRenderer(opts) {
    opts = opts || {};
    const knownStyles = opts.knownStyles || KNOWN_STYLES;
    const renderer = new marked.Renderer();
    renderer.code = function({ text, lang }) {
      const language = lang || '';
      const languageClass = language ? ` class="language-${language}"` : '';
      const langLabel = language ? `<span class="code-lang-label">${language}</span>` : '';
      return `<pre class="code-block"${language ? ` data-lang="${language}"` : ''}><button class="copy-btn" aria-label="复制代码"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>${langLabel}<code${languageClass}>${text}</code></pre>`;
    };
    renderer.paragraph = function(token) {
      const trimmed = (token && token.text ? token.text : '').trim();
      const markerMatch = trimmed.match(/^@([a-zA-Z][\w-]*)(\s.*)?$/);
      if (markerMatch && knownStyles.includes(markerMatch[1].toLowerCase())) {
        return `<p class="gallery-style-marker" data-style="${markerMatch[1].toLowerCase()}"></p>`;
      }
      return `<p>${this.parser.parseInline(token.tokens)}</p>`;
    };
    return renderer;
  }

  /**
   * 处理代码选项卡语法 ::: code-tabs ... :::
   * 内部用 @tab 名称 分隔每个标签页
   * @param {string} text - Markdown 文本
   * @returns {string} 处理后的 HTML 字符串
   */
  function processCodeTabs(text) {
    const codeTabRegex = /^:::\s*code-tabs\s*\n([\s\S]*?)^:::\s*$/gm;
    return text.replace(codeTabRegex, (match, content) => {
      const tabRegex = /^@tab\s+(.+)$/gm;
      const tabs = [];
      let lastIndex = 0;
      let m;
      const matches = [];
      while ((m = tabRegex.exec(content)) !== null) {
        matches.push({ name: m[1].trim(), index: m.index, length: m[0].length });
      }
      if (matches.length === 0) return match;
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i].length;
        const end = i < matches.length - 1 ? matches[i + 1].index : content.length;
        const tabContent = content.substring(start, end).trim();
        tabs.push({ name: matches[i].name, content: tabContent });
      }
      const tabId = 'codetabs-' + Math.random().toString(36).substring(2, 9);
      let tabHeaders = tabs.map((tab, i) =>
        `<button class="code-tab-btn ${i === 0 ? 'active' : ''}" data-tab="${tabId}-${i}" data-group="${tabId}">${tab.name}</button>`
      ).join('');
      let tabPanels = tabs.map((tab, i) =>
        `<div class="code-tab-panel ${i === 0 ? 'active' : ''}" id="${tabId}-${i}" data-group="${tabId}">\n${tab.content}\n</div>`
      ).join('\n');
      return `<div class="code-tabs" data-tabs-group="${tabId}">\n<div class="code-tab-header">\n${tabHeaders}\n</div>\n<div class="code-tab-content">\n${tabPanels}\n</div>\n</div>\n`;
    });
  }

  /**
   * 处理分栏布局语法 ::: columns ... :::
   * 内部用 ::: column 标题 分隔每个栏
   * @param {string} text - Markdown 文本
   * @returns {string} 处理后的 HTML 字符串
   */
  function processColumns(text) {
    const columnRegex = /^:::\s*columns\s*\n([\s\S]*?)^:::\s*$/gm;
    return text.replace(columnRegex, (match, content) => {
      const colRegex = /^:::\s*column(?:\s+(.+))?$/gm;
      const columns = [];
      const matches = [];
      let m;
      while ((m = colRegex.exec(content)) !== null) {
        matches.push({ title: m[1] ? m[1].trim() : '', index: m.index, length: m[0].length });
      }
      if (matches.length === 0) return match;
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i].length;
        const end = i < matches.length - 1 ? matches[i + 1].index : content.lastIndexOf(':::');
        let colContent = content.substring(start, end).trim();
        if (colContent.endsWith(':::')) {
          colContent = colContent.slice(0, -3).trim();
        }
        columns.push({ title: matches[i].title, content: colContent });
      }
      const colHtml = columns.map(col => {
        const titleHtml = col.title ? `<div class="column-title">${col.title}</div>\n` : '';
        return `<div class="column-item">\n${titleHtml}<div class="column-body">\n${col.content}\n</div>\n</div>`;
      }).join('\n');
      return `<div class="columns-container">\n${colHtml}\n</div>\n`;
    });
  }

  /**
   * 处理遮罩/剧透语法 ||内容||
   * 鼠标悬停或点击（移动端）时显示内容
   * @param {string} text - Markdown 文本
   * @returns {string} 处理后的文本
   */
  function processSpoilers(text) {
    const codeBlocks = [];
    let protectedText = text;

    protectedText = protectedText.replace(/```[\s\S]*?```/g, function(match) {
      const idx = codeBlocks.length;
      codeBlocks.push(match);
      return `SPOILERCODEBLOCK_${idx}_`;
    });

    protectedText = protectedText.replace(/`[^`\n]+`/g, function(match) {
      const idx = codeBlocks.length;
      codeBlocks.push(match);
      return `SPOILERINLINECODE_${idx}_`;
    });

    protectedText = protectedText.replace(/\|\|([^\|\n]+?)\|\|/g, function(match, content) {
      return '<span class="spoiler" tabindex="0">' + content + '</span>';
    });

    protectedText = protectedText.replace(/SPOILERCODEBLOCK_(\d+)_/g, function(m, idx) {
      return codeBlocks[parseInt(idx)];
    });
    protectedText = protectedText.replace(/SPOILERINLINECODE_(\d+)_/g, function(m, idx) {
      return codeBlocks[parseInt(idx)];
    });

    return protectedText;
  }

  /**
   * 解析 Markdown 为 HTML（含 LaTeX 保护、Alert 处理、自定义 Renderer）
   * @param {string} content - Markdown 原文（已剥离 frontmatter）
   * @param {Object} [opts] - 透传给 processGitHubAlerts / createMdRenderer
   * @returns {{ html: string, blocks: string[] }}
   */
  function parseMarkdown(content, opts) {
    const { processed, blocks } = protectLaTeXBlocks(content);
    const alertProcessed = processGitHubAlerts(processed, opts);
    const codeTabProcessed = processCodeTabs(alertProcessed);
    const columnProcessed = processColumns(codeTabProcessed);
    const spoilerProcessed = processSpoilers(columnProcessed);
    const renderer = createMdRenderer(opts);
    let html = marked.parse(spoilerProcessed, { breaks: true, gfm: true, renderer });
    html = restoreLaTeXBlocks(html, blocks);
    return { html, blocks };
  }

  /**
   * 图片画廊分组：将相邻的图片段落（≥2 张）合并为 .image-gallery 容器
   * 支持 @style 标记指定画廊样式
   * @param {HTMLElement} container
   */
  function groupGalleries(container) {
    const images = container.querySelectorAll('img');
    if (images.length < 2) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = container.innerHTML;
    const allElements = Array.from(tempDiv.childNodes);
    const galleryGroups = [];
    let currentGroup = [];
    let pendingStyle = null;
    const markersToRemove = [];

    allElements.forEach((node, index) => {
      if (node.nodeName === 'P') {
        if (node.classList && node.classList.contains('gallery-style-marker')) {
          if (currentGroup.length >= 2) galleryGroups.push({ imgs: [...currentGroup], style: pendingStyle });
          currentGroup = [];
          pendingStyle = node.getAttribute('data-style') || null;
          markersToRemove.push(node);
          return;
        }
        const imgs = node.querySelectorAll('img');
        if (imgs.length > 0 && node.textContent.trim() === '') {
          currentGroup.push(...Array.from(imgs));
          const nextNode = allElements[index + 1];
          if (!nextNode || nextNode.nodeName !== 'P' || nextNode.querySelectorAll('img').length === 0) {
            if (currentGroup.length >= 2) galleryGroups.push({ imgs: [...currentGroup], style: pendingStyle });
            currentGroup = [];
            pendingStyle = null;
          }
        } else {
          if (currentGroup.length >= 2) galleryGroups.push({ imgs: [...currentGroup], style: pendingStyle });
          currentGroup = [];
          pendingStyle = null;
        }
      } else {
        if (currentGroup.length >= 2) galleryGroups.push({ imgs: [...currentGroup], style: pendingStyle });
        currentGroup = [];
        pendingStyle = null;
      }
    });

    if (currentGroup.length >= 2) galleryGroups.push({ imgs: [...currentGroup], style: pendingStyle });
    markersToRemove.forEach(n => n.remove());

    galleryGroups.forEach(group => {
      if (group.imgs.length < 2) return;
      const firstImg = group.imgs[0];
      const parentP = firstImg.closest('p');
      if (!parentP) return;
      const galleryDiv = document.createElement('div');
      galleryDiv.className = 'image-gallery';
      if (group.style) galleryDiv.classList.add(`image-gallery--${group.style}`);
      group.imgs.forEach(img => galleryDiv.appendChild(img.cloneNode(true)));
      parentP.replaceWith(galleryDiv);
    });

    container.innerHTML = tempDiv.innerHTML;
  }

  /**
   * 幻灯片自动轮播：为 .image-gallery--slider 创建 track + 指示点
   * @param {HTMLElement} container
   */
  function initSliders(container) {
    container.querySelectorAll('.image-gallery--slider').forEach(slider => {
      const imgs = Array.from(slider.querySelectorAll('img'));
      if (imgs.length < 2) return;
      const track = document.createElement('div');
      track.className = 'slider-track';
      imgs.forEach(img => track.appendChild(img));
      slider.appendChild(track);
      const dots = document.createElement('div');
      dots.className = 'slider-dots';
      imgs.forEach((_, i) => {
        const dot = document.createElement('span');
        if (i === 0) dot.classList.add('active');
        dots.appendChild(dot);
      });
      slider.appendChild(dots);
      const count = imgs.length;
      let index = 0;
      let timer = null;
      function go(i) {
        index = ((i % count) + count) % count;
        track.style.transform = `translateX(-${index * 100}%)`;
        dots.querySelectorAll('span').forEach((d, di) => d.classList.toggle('active', di === index));
      }
      function start() { stop(); timer = setInterval(() => go(index + 1), 4000); }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }
      slider.addEventListener('mouseenter', stop);
      slider.addEventListener('mouseleave', start);
      start();
    });
  }

  /**
   * 代码块语法高亮
   * @param {HTMLElement} container
   */
  function highlightCodeBlocks(container) {
    if (typeof hljs === 'undefined') return;
    const blocks = container.querySelectorAll('pre code');
    blocks.forEach(block => {
      try { hljs.highlightElement(block); } catch (e) { /* 忽略单块高亮失败 */ }
    });
  }

  /**
   * 初始化代码选项卡点击切换
   * @param {HTMLElement} container
   */
  function initCodeTabs(container) {
    const tabBtns = container.querySelectorAll('.code-tab-btn');
    if (tabBtns.length === 0) return;
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        const tabId = btn.dataset.tab;
        container.querySelectorAll(`.code-tab-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
        container.querySelectorAll(`.code-tab-panel[data-group="${group}"]`).forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById(tabId);
        if (panel) panel.classList.add('active');
      });
    });
  }

  window.MarkdownPreview.mdRender = {
    KNOWN_STYLES,
    DEFAULT_ALERT_TYPES,
    processGitHubAlerts,
    processSpoilers,
    processCodeTabs,
    processColumns,
    protectLaTeXBlocks,
    restoreLaTeXBlocks,
    createMdRenderer,
    parseMarkdown,
    groupGalleries,
    initSliders,
    highlightCodeBlocks,
    initCodeTabs,
  };
})();
