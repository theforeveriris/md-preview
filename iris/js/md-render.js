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
   * HTML 转义。用于任何会被拼进 innerHTML 的文档内容（代码块 lang、
   * LaTeX 原文、剧透内容、标签/栏标题等），防止存储型 XSS。
   */
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
   * 保护 LaTeX 公式，避免被 marked 误处理：
   *   1) $$...$$ 块级公式（原有逻辑）
   *   2) $...$ 行内公式（Pandoc 规则：$ 后不能是空白，闭合 $ 前不能是空白）；
   *      下划线/反斜杠等字符会被 marked 转义或解析成强调，必须先占位保护
   *   3) 代码围栏与行内代码先占位，公式提取只作用于非代码文本；
   *      提取完成后立即还原为原始 Markdown——后续 alerts/codeTabs/columns
   *      与 marked 本身都需要看到真实的围栏语法，若拖到 marked 之后才还原，
   *      还原进最终 HTML 的是未解析的原文，代码块会整体失效
   * @param {string} text
   * @returns {{ processed: string, blocks: string[], inline: string[] }}
   */
  function protectLaTeXBlocks(text) {
    const blocks = [];
    const inline = [];
    // 先占位代码段（围栏/行内代码），公式提取只作用于非代码文本
    const codeSegments = [];
    const codeSafe = text.replace(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g, (m) => {
      const idx = codeSegments.length;
      codeSegments.push(m);
      return `LATEXCODESEG_${idx}_HOLD`;
    });

    const extracted = codeSafe
      // $$...$$ 块
      .replace(/\$\$[\s\S]*?\$\$/g, (match) => {
        const idx = blocks.length;
        const cleaned = match.split('\n').map((l, i, a) => {
          // 单行 $$..$$ 时首行即末行，两个替换都要执行（用顺序链而非互斥分支，
          // 否则首行 return 会跳过尾部剥离，块级公式带残留 $$
          let out = l;
          if (i === 0) out = out.replace(/^\$\$\s*/, '');
          if (i === a.length - 1) out = out.replace(/\s*\$\$$/, '');
          return out.replace(/^    /, '');
        }).join('\n').trim();
        blocks.push(cleaned);
        return `LATEXPROTECT_${idx}_`;
      })
      // $...$ 行内（占位符的下划线位于单词内部，marked 不会解析成强调）
      .replace(/(?<!\\)\$(?!\s)([^$\n]+?)(?<=\S)\$/g, (m, latex) => {
        const idx = inline.length;
        inline.push(latex);
        return `LATEXINLINE_${idx}_`;
      });

    // 公式提取完毕，代码段立即还原为原始 Markdown（单趟替换，还原内容不会被重扫）
    const processed = extracted.replace(/LATEXCODESEG_(\d+)_HOLD/g, (m, idx) => codeSegments[parseInt(idx)] ?? m);
    return { processed, blocks, inline };
  }

  /**
   * 还原占位符：LaTeX 块/行内公式转回节点。
   * 公式原文同时写入 data-latex，供右键「复制 LaTeX 公式」使用。
   * （代码段占位符已在 protectLaTeXBlocks 内还原，此处不再处理）
   * @param {string} html
   * @param {string[]} blocks
   * @param {string[]} [inline]
   * @returns {string}
   */
  function restoreLaTeXBlocks(html, blocks, inline) {
    inline = inline || [];
    html = html.replace(/LATEXPROTECT_(\d+)_/g, (m, idx) => {
      const latex = blocks[parseInt(idx)] ?? '';
      // 转义后再放回：katex 渲染器读取的是 block.textContent，转义不影响公式解析
      return `<div class="katex-block" data-latex="${escapeHtml(latex)}">${escapeHtml(latex)}</div>`;
    });
    html = html.replace(/LATEXINLINE_(\d+)_/g, (m, idx) => {
      const latex = inline[parseInt(idx)];
      if (latex == null) return m;
      return `<span class="katex-inline" data-latex="${escapeHtml(latex)}">${escapeHtml(latex)}</span>`;
    });
    return html;
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
      // lang 来自文档内容，必须先转义再拼进 HTML（marked 默认渲染器会转义，自定义 renderer 需要自己处理）
      const escapedLang = escapeHtml(language);
      const languageClass = escapedLang ? ` class="language-${escapedLang}"` : '';
      const langLabel = escapedLang ? `<span class="code-lang-label">${escapedLang}</span>` : '';
      const escapedText = String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      return `<pre class="code-block"${escapedLang ? ` data-lang="${escapedLang}"` : ''}><button class="copy-btn" aria-label="复制代码"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>${langLabel}<code${languageClass}>${escapedText}</code></pre>`;
    };
    renderer.paragraph = function(token) {
      const trimmed = (token && token.text ? token.text : '').trim();
      // 仅当整段恰好是 "@样式名" 时才视为画廊样式标记；
      // 否则 "@stack 本周完成 3 个任务" 这类正常段落会被误删。
      const markerMatch = trimmed.match(/^@([a-zA-Z][\w-]*)$/);
      if (markerMatch && knownStyles.includes(markerMatch[1].toLowerCase())) {
        return `<p class="gallery-style-marker" data-style="${escapeHtml(markerMatch[1].toLowerCase())}"></p>`;
      }
      return `<p>${this.parser.parseInline(token.tokens)}</p>`;
    };
    return renderer;
  }

  /**
   * 处理代码选项卡语法 ::: code-tabs ... :::
   * 内部用 @tab 名称 分隔每个标签页
   * @param {string} text - Markdown 文本
   * @param {Object} [opts]
   * @param {marked.Renderer} [opts.renderer] - 自定义 renderer
   * @returns {{ processed: string, codeTabBlocks: string[] }}
   */
  function processCodeTabs(text, opts) {
    opts = opts || {};
    const lines = text.split('\n');
    const result = [];
    const codeTabBlocks = [];
    let i = 0;
    let inFencedCode = false;
    let fenceChar = '';
    let fenceLen = 0;
    const parseOpts = { breaks: true, gfm: true };
    if (opts.renderer) parseOpts.renderer = opts.renderer;

    function isFence(line) {
      const m = line.match(/^(\s*)(`{3,}|~{3,})/);
      return m ? { char: m[2][0], len: m[2].length } : null;
    }

    while (i < lines.length) {
      const line = lines[i];

      const fence = isFence(line);
      if (fence) {
        if (!inFencedCode) {
          inFencedCode = true;
          fenceChar = fence.char;
          fenceLen = fence.len;
        } else if (fence.char === fenceChar && fence.len >= fenceLen) {
          inFencedCode = false;
        }
        result.push(line);
        i++;
        continue;
      }
      if (inFencedCode) {
        result.push(line);
        i++;
        continue;
      }

      const startMatch = line.match(/^:::\s*code-tabs\s*$/);
      if (!startMatch) {
        result.push(line);
        i++;
        continue;
      }
      i++;
      const tabs = [];
      let currentTab = null;
      let tabContentLines = [];
      let localInCode = false;
      let localFenceChar = '';
      let localFenceLen = 0;
      let foundEnd = false;
      while (i < lines.length) {
        const l = lines[i];
        const lfence = isFence(l);
        if (lfence) {
          if (!localInCode) {
            localInCode = true;
            localFenceChar = lfence.char;
            localFenceLen = lfence.len;
          } else if (lfence.char === localFenceChar && lfence.len >= localFenceLen) {
            localInCode = false;
          }
          tabContentLines.push(l);
          i++;
          continue;
        }
        if (localInCode) {
          tabContentLines.push(l);
          i++;
          continue;
        }
        const endMatch = l.match(/^:::\s*$/);
        if (endMatch) {
          if (currentTab) {
            tabs.push({ name: currentTab, content: tabContentLines.join('\n').trim() });
          }
          foundEnd = true;
          i++;
          break;
        }
        const tabMatch = l.match(/^@tab\s+(.+)$/);
        if (tabMatch) {
          if (currentTab) {
            tabs.push({ name: currentTab, content: tabContentLines.join('\n').trim() });
          }
          currentTab = tabMatch[1].trim();
          tabContentLines = [];
          i++;
          continue;
        }
        tabContentLines.push(l);
        i++;
      }
      if (!foundEnd || tabs.length === 0) {
        result.push(line);
        continue;
      }
      const tabId = 'codetabs-' + Math.random().toString(36).substring(2, 9);
      const tabHeaders = tabs.map((tab, idx) =>
        `<button class="code-tab-btn ${idx === 0 ? 'active' : ''}" data-tab="${tabId}-${idx}" data-group="${tabId}">${escapeHtml(tab.name)}</button>`
      ).join('');
      const tabPanels = tabs.map((tab, idx) => {
        const rendered = marked.parse(tab.content, parseOpts);
        return `<div class="code-tab-panel ${idx === 0 ? 'active' : ''}" id="${tabId}-${idx}" data-group="${tabId}">${rendered}</div>`;
      }).join('');
      const html = `<div class="code-tabs" data-tabs-group="${tabId}"><div class="code-tab-header">${tabHeaders}</div><div class="code-tab-content">${tabPanels}</div></div>`;
      const idx = codeTabBlocks.length;
      codeTabBlocks.push(html);
      result.push(`CODETABBLOCK_${idx}_`);
    }
    return { processed: result.join('\n'), codeTabBlocks };
  }

  /**
   * 还原代码选项卡占位符为完整 HTML
   * @param {string} html
   * @param {string[]} codeTabBlocks
   * @returns {string}
   */
  function restoreCodeTabBlocks(html, codeTabBlocks) {
    return html.replace(/CODETABBLOCK_(\d+)_/g, function(m, idx) {
      return codeTabBlocks[parseInt(idx)];
    });
  }

  /**
   * 处理分栏布局语法 ::: columns ... :::
   * 内部用 ::: column 标题 分隔每个栏
   * @param {string} text - Markdown 文本
   * @param {Object} [opts]
   * @param {marked.Renderer} [opts.renderer] - 自定义 renderer
   * @returns {string} 处理后的 HTML 字符串
   */
  function processColumns(text, opts) {
    opts = opts || {};
    const lines = text.split('\n');
    const result = [];
    let i = 0;
    let inFencedCode = false;
    let fenceChar = '';
    let fenceLen = 0;
    const parseOpts = { breaks: true, gfm: true };
    if (opts.renderer) parseOpts.renderer = opts.renderer;

    function isFence(line) {
      const m = line.match(/^(\s*)(`{3,}|~{3,})/);
      return m ? { char: m[2][0], len: m[2].length } : null;
    }

    while (i < lines.length) {
      const line = lines[i];

      const fence = isFence(line);
      if (fence) {
        if (!inFencedCode) {
          inFencedCode = true;
          fenceChar = fence.char;
          fenceLen = fence.len;
        } else if (fence.char === fenceChar && fence.len >= fenceLen) {
          inFencedCode = false;
        }
        result.push(line);
        i++;
        continue;
      }
      if (inFencedCode) {
        result.push(line);
        i++;
        continue;
      }

      const startMatch = line.match(/^:::\s*columns\s*$/);
      if (!startMatch) {
        result.push(line);
        i++;
        continue;
      }
      i++;
      const columns = [];
      let currentTitle = null;
      let colContentLines = [];
      let inColumn = false;
      let foundEnd = false;
      let localInCode = false;
      let localFenceChar = '';
      let localFenceLen = 0;

      while (i < lines.length) {
        const l = lines[i];
        const lfence = isFence(l);
        if (lfence) {
          if (!localInCode) {
            localInCode = true;
            localFenceChar = lfence.char;
            localFenceLen = lfence.len;
          } else if (lfence.char === localFenceChar && lfence.len >= localFenceLen) {
            localInCode = false;
          }
          if (inColumn) colContentLines.push(l);
          i++;
          continue;
        }
        if (localInCode) {
          if (inColumn) colContentLines.push(l);
          i++;
          continue;
        }

        const colMatch = l.match(/^:::\s*column(?:\s+(.+))?\s*$/);
        const endMatch = l.match(/^:::\s*$/);

        if (colMatch) {
          if (inColumn) {
            columns.push({ title: currentTitle, content: colContentLines.join('\n').trim() });
          }
          currentTitle = colMatch[1] ? colMatch[1].trim() : '';
          colContentLines = [];
          inColumn = true;
          i++;
          continue;
        }

        if (endMatch) {
          if (inColumn) {
            columns.push({ title: currentTitle, content: colContentLines.join('\n').trim() });
            inColumn = false;
            i++;
            continue;
          } else {
            foundEnd = true;
            i++;
            break;
          }
        }

        if (inColumn) {
          colContentLines.push(l);
        }
        i++;
      }

      if (!foundEnd || columns.length === 0) {
        result.push(line);
        continue;
      }

      const colHtml = columns.map(col => {
        const rendered = marked.parse(col.content, parseOpts);
        const titleHtml = col.title ? `<div class="column-title">${escapeHtml(col.title)}</div>` : '';
        return `<div class="column-item">${titleHtml}<div class="column-body">${rendered}</div></div>`;
      }).join('');
      result.push(`<div class="columns-container">${colHtml}</div>`);
    }
    return result.join('\n');
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
      // 内容在 marked 解析前就插入了 <span> 原始 HTML，必须转义防止注入
      return '<span class="spoiler" tabindex="0">' + escapeHtml(content) + '</span>';
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
   * 拼音注音（CJK-2）：作者语法 `{汉字|hàn zì}` → `<ruby>汉字<rt>hàn zì</rt></ruby>`
   * 代码围栏与行内代码先占位，避免误伤；base / 注音均转义后拼入。
   * @param {string} text
   * @returns {string}
   */
  function processRuby(text) {
    const codeSegments = [];
    const protectedText = text.replace(/(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`)/g, (m) => {
      const idx = codeSegments.length;
      codeSegments.push(m);
      return `RUBYCODESEG_${idx}_HOLD`;
    });
    const replaced = protectedText.replace(/\\?\{([^{}|\n]{1,60})\|([^{}|\n]{1,120})\}/g, (match, base, rt) => {
      if (match.charAt(0) === '\\') return match.slice(1); // \{ 转义为字面 {
      return `<ruby>${escapeHtml(base)}<rt>${escapeHtml(rt)}</rt></ruby>`;
    });
    return replaced.replace(/RUBYCODESEG_(\d+)_HOLD/g, (m, idx) => codeSegments[parseInt(idx)] ?? m);
  }

  /**
   * 解析 Markdown 为 HTML（含 LaTeX 保护、Alert 处理、自定义 Renderer）
   * @param {string} content - Markdown 原文（已剥离 frontmatter）
   * @param {Object} [opts] - 透传给 processGitHubAlerts / createMdRenderer
   * @returns {{ html: string, blocks: string[] }}
   */
  function parseMarkdown(content, opts) {
    const { processed, blocks, inline } = protectLaTeXBlocks(content);
    const alertProcessed = processGitHubAlerts(processed, opts);
    const spoilerProcessed = processSpoilers(alertProcessed);
    const rubyProcessed = processRuby(spoilerProcessed);
    const renderer = createMdRenderer(opts);
    const { processed: codeTabProcessed, codeTabBlocks } = processCodeTabs(rubyProcessed, { renderer });
    const columnProcessed = processColumns(codeTabProcessed, { renderer });
    let html = marked.parse(columnProcessed, { breaks: true, gfm: true, renderer });
    html = restoreCodeTabBlocks(html, codeTabBlocks);
    html = restoreLaTeXBlocks(html, blocks, inline);
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
  // 追踪所有轮播定时器：每次新的渲染周期都会先清掉上一轮遗留的 interval，
  // 防止文档切换后旧轮播（DOM 已脱离）继续空转累积。
  const sliderTimers = new Set();

  function initSliders(container) {
    // 上一渲染周期的轮播元素已脱离 DOM，先统一停止其定时器
    sliderTimers.forEach(id => clearInterval(id));
    sliderTimers.clear();

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
      function start() { stop(); timer = setInterval(() => go(index + 1), 4000); sliderTimers.add(timer); }
      function stop() { if (timer) { clearInterval(timer); sliderTimers.delete(timer); timer = null; } }
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
   * 渐进式代码高亮（PERF-3）：先高亮首屏前 immediate 个代码块，其余在空闲时
   * 分批补齐，避免长文档一次性高亮成百上千个代码块阻塞主线程。
   * @param {HTMLElement} container
   * @param {number} [immediate]
   */
  function highlightCodeBlocksProgressive(container, immediate) {
    if (typeof hljs === 'undefined' || !container) return;
    immediate = immediate || 8;
    const blocks = Array.from(container.querySelectorAll('pre code'));
    if (!blocks.length) return;
    const run = (el) => { try { hljs.highlightElement(el); } catch (e) { /* ignore */ } };
    blocks.slice(0, immediate).forEach(run);
    const rest = blocks.slice(immediate);
    if (!rest.length) return;
    let i = 0;
    const schedule = (window.requestIdleCallback)
      ? (fn) => window.requestIdleCallback(fn, { timeout: 1000 })
      : (fn) => setTimeout(fn, 60);
    const chunk = () => {
      const end = Math.min(i + 6, rest.length);
      for (; i < end; i++) run(rest[i]);
      if (i < rest.length) schedule(chunk);
    };
    schedule(chunk);
  }

  /**
   * 初始化代码选项卡点击切换（事件委托方式）
   * @param {HTMLElement} container
   */
  function initCodeTabs(container) {
    if (container.dataset.codeTabsInit) return;
    container.dataset.codeTabsInit = 'true';
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.code-tab-btn');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const group = btn.dataset.group;
      const tabId = btn.dataset.tab;
      container.querySelectorAll(`.code-tab-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
      container.querySelectorAll(`.code-tab-panel[data-group="${group}"]`).forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById(tabId);
      if (panel) panel.classList.add('active');
    });
  }

  /**
   * 渲染根容器权威解析。
   *
   * 历史教训：split-view 的隐藏面板也带 .markdown-body class，且在 DOM 中排在
   * 主文档之前——渲染器里直接 document.querySelector('.markdown-body') 会命中
   * 空面板导致整体短路跳过（KaTeX 公式失效即此因）。因此：
   *   1. 调用方显式传入的 root 最优先（编辑器 cell / 对照阅读栏）；
   *   2. 默认回退到 #markdownContent（ID 选择器，不受 DOM 顺序影响）；
   *   3. 兜底第一个 .markdown-body（测试环境等无 #markdownContent 场景）。
   *
   * @param {HTMLElement} [root]
   * @returns {HTMLElement|null}
   */
  function resolveRoot(root) {
    if (root) return root;
    return document.getElementById('markdownContent')
      || document.querySelector('.markdown-body');
  }

  // ---- 延迟渲染（PERF-1）：重型渲染器滚到附近才初始化 ----
  const lazyObservers = [];

  function findLazyBlocks(id, scope) {
    const pres = Array.from(scope.querySelectorAll('pre'));
    switch (id) {
      case 'mermaid': return pres.filter(p => p.querySelector('code.language-mermaid'));
      case 'plantuml': return pres.filter(p => p.querySelector('code.language-plantuml'));
      case 'apexcharts': return pres.filter(p => p.querySelector('code.language-apexcharts'));
      case 'diff': return pres.filter(p => p.querySelector('code.language-diff'));
      case 'csvtable': return pres.filter(p => p.dataset.lang === 'csv' || p.dataset.lang === 'tsv');
      case 'jsontree': return pres.filter(p => p.dataset.lang === 'json');
      default: return [];
    }
  }

  // 把单个块临时包进作用域容器，渲染器只处理这一块；随后还原层级
  function renderScoped(id, renderer, block) {
    const parent = block.parentNode;
    if (!parent) return;
    const wrap = document.createElement('div');
    wrap.className = 'lazy-render-scope';
    parent.insertBefore(wrap, block);
    wrap.appendChild(block);
    Promise.resolve()
      .then(() => renderer.render(wrap))
      .catch(e => { console.error('[Renderers] ' + id + ' lazy render failed:', e); })
      .then(() => {
        while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap);
        parent.removeChild(wrap);
      });
  }

  // 去重的延迟渲染：每个块只渲染一次
  function renderOnce(id, renderer, block) {
    if (!block || !block.parentNode) return;
    if (block.dataset.lazyDone) return;
    block.dataset.lazyDone = '1';
    renderScoped(id, renderer, block);
  }

  function clearLazy() {
    lazyObservers.forEach(io => { try { io.disconnect(); } catch (e) { /* ignore */ } });
    lazyObservers.length = 0;
  }

  // 元素是否已进入（或接近）视口
  function nearViewport(block, margin) {
    if (typeof block.getBoundingClientRect !== 'function') return false;
    const r = block.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;
    const vw = window.innerWidth || document.documentElement.clientWidth || 1200;
    return r.bottom > -margin && r.top < vh + margin && r.right > -margin && r.left < vw + margin;
  }

  function scheduleLazy(id, renderer, root) {
    const scope = resolveRoot(root);
    if (!scope) return;
    const blocks = findLazyBlocks(id, scope);
    if (!blocks.length) return;
    const margin = 400;

    // 1) 当前已在视口附近的块立即渲染（首屏不为空）
    const pending = [];
    blocks.forEach(b => {
      if (nearViewport(b, margin)) renderOnce(id, renderer, b);
      else pending.push(b);
    });
    if (!pending.length) return;

    // 2) 无 IntersectionObserver 时直接全部渲染（降级）
    if (typeof IntersectionObserver !== 'function') {
      pending.forEach(b => renderOnce(id, renderer, b));
      return;
    }

    let ioFired = false;
    // 逐块记录待渲染集合：IO 的首次回调会带上全部 observe 目标（未进入视口时
    // isIntersecting 为 false），所以不能用「是否回调过」判断是否需要兜底。
    const remaining = new Set(pending);
    const flush = (b) => {
      if (!remaining.has(b)) return;
      remaining.delete(b);
      renderOnce(id, renderer, b);
    };

    const io = new IntersectionObserver((entries, obs) => {
      ioFired = true;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        obs.unobserve(entry.target);
        flush(entry.target);
      });
    }, { rootMargin: margin + 'px 0px' });
    pending.forEach(b => io.observe(b));
    lazyObservers.push(io);

    // 3) 兜底 A：滚动 / 尺寸变化时按位置补渲染。
    //    content-visibility: auto 子树内的元素可能始终拿不到 intersecting 回调，
    //    只依赖 IO 会让图表永久停在源码状态（表现为「mermaid 没渲染」）。
    let ticking = false;
    const onScroll = () => {
      if (ticking || !remaining.size) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        remaining.forEach(b => {
          if (!document.body.contains(b)) { remaining.delete(b); return; }
          if (nearViewport(b, margin)) { io.unobserve(b); flush(b); }
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    lazyObservers.push({
      disconnect() {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    });

    // 4) 兜底 B：IO 完全未派发回调时（个别环境），统一补齐，保证内容不丢失
    setTimeout(() => {
      if (ioFired) return;
      pending.forEach(b => { io.unobserve(b); flush(b); });
    }, 1800);
  }

  // 延迟渲染白名单（仅当调用方传 opts.lazy 时启用；编辑器 / 对照阅读不传，保持即时渲染）
  const DEFAULT_LAZY = ['mermaid', 'plantuml', 'apexcharts', 'diff', 'csvtable', 'jsontree'];

  /**
   * 渲染器统一调度器
   *
   * 遍历 window.MarkdownPreview.renderers 注册表，逐个执行并隔离错误。
   * 所有内置渲染器遵循同一约定：
   *   - render(root?)：root 为本次渲染的根容器（文档站传 null 表示全局 .markdown-body）；
   *   - render() 返回 Promise 或 undefined，调度器统一等待与捕获；
   *   - 各渲染器自行短路（查询 DOM 无命中直接 return，避免无谓加载 vendor 库）。
   *
   * 顺序：先顺序 await 全部「即时」渲染器（部分会整体重写容器 innerHTML，
   * 如 embedded，必须串行）；待其完成后再为 opts.lazy 命中的重型渲染器
   * 注册 IntersectionObserver，滚到附近才渲染（PERF-1）。
   *
   * @param {HTMLElement} [root] - 渲染根容器（编辑器 cell / 对照阅读栏传自身容器）
   * @param {Object} [opts]
   * @param {Function} [opts.before] - 全部渲染器执行前的钩子（文档站用于清理 pkt 画布）
   * @param {string[]} [opts.only] - 仅执行指定渲染器（id 与注册表键一致）
   * @param {boolean|string[]} [opts.lazy] - true 用默认白名单 / 显式白名单（延迟渲染）
   */
  function runRenderers(root, opts) {
    opts = opts || {};
    const registry = window.MarkdownPreview && window.MarkdownPreview.renderers;
    if (!registry) return Promise.resolve();

    const filter = Array.isArray(opts.only) && opts.only.length ? new Set(opts.only) : null;
    const lazySet = opts.lazy === true ? new Set(DEFAULT_LAZY)
      : (Array.isArray(opts.lazy) ? new Set(opts.lazy) : null);

    const ids = Object.keys(registry).filter(id => !filter || filter.has(id));
    const isRunnable = id => registry[id] && typeof registry[id].render === 'function';
    const eagerIds = ids.filter(id => isRunnable(id) && !(lazySet && lazySet.has(id)));
    const lazyIds = lazySet ? ids.filter(id => isRunnable(id) && lazySet.has(id)) : [];

    const chain = eagerIds.reduce((c, id) => c.then(() => Promise.resolve()
      .then(() => registry[id].render(root || undefined))
      .catch(e => { console.error('[Renderers] ' + id + ' renderer failed:', e); })),
      Promise.resolve(typeof opts.before === 'function' ? opts.before() : undefined));

    return chain.then(() => {
      lazyIds.forEach(id => scheduleLazy(id, registry[id], root));
    });
  }

  /**
   * 标题锚点 slug 规则（全站唯一权威实现）：
   * textContent 小写化、非 \w/中文连续字符替换为 -，去首尾 -
   * 消费方：markdown.js 标题锚点、split-view.js 跟读高亮；
   * link-check.js（Node 侧）保留逐字一致的副本并有注释指向此处。
   */
  function slugify(text) {
    return String(text == null ? '' : text)
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  window.MarkdownPreview.mdRender = {
    KNOWN_STYLES,
    DEFAULT_ALERT_TYPES,
    escapeHtml,
    slugify,
    processGitHubAlerts,
    processSpoilers,
    processRuby,
    processCodeTabs,
    processColumns,
    protectLaTeXBlocks,
    restoreLaTeXBlocks,
    createMdRenderer,
    parseMarkdown,
    groupGalleries,
    initSliders,
    highlightCodeBlocks,
    highlightCodeBlocksProgressive,
    initCodeTabs,
    runRenderers,
    clearLazy,
    DEFAULT_LAZY,
    resolveRoot,
  };
})();
