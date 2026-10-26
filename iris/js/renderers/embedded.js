(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};
  
  const { dom } = window.MarkdownPreview;
  
  function extractEmbedSyntax(text) {
    const atBracketStart = text.indexOf('@[');
    if (atBracketStart === -1) return null;

    const serviceStart = atBracketStart + 2;
    const serviceEnd = text.indexOf(']', serviceStart);
    if (serviceEnd === -1) return null;

    const service = text.substring(serviceStart, serviceEnd);

    const urlStart = serviceEnd + 1;
    if (text[urlStart] !== '(') return null;

    let depth = 1;
    let urlEnd = -1;
    for (let i = urlStart + 1; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') {
        depth--;
        if (depth === 0) {
          urlEnd = i;
          break;
        }
      }
    }

    if (urlEnd === -1) return null;

    const url = text.substring(urlStart + 1, urlEnd);
    const fullMatch = text.substring(atBracketStart, urlEnd + 1);

    return { service, url, fullMatch };
  }

  // 嵌入内容来自文档文本（可能是非受信来源），拼进 HTML 属性前必须转义
  function escAttr(value) {
    return window.MarkdownPreview.mdRender.escapeHtml(value);
  }

  // 仅接受 http(s) 绝对 URL，拒绝 javascript:/data: 等危险协议；
  // restrictHosts 传入时额外校验主机名，返回标准化后的 URL 或 null
  function safeHttpUrl(url, restrictHosts) {
    let u;
    try { u = new URL(url); } catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (restrictHosts && !restrictHosts.includes(u.hostname)) return null;
    return u;
  }
  
  function render(container) {
    // 支持传入外部容器（如编辑器 cell 的 outputElement），不传则默认操作主文档
    const targetEl = container || dom.markdownContent;
    const content = targetEl.innerHTML;

    const embedLanguages = ['embed', 'geojson', 'topojson', 'twitter', 'x', 'pkt', 'ensp', 'pptx'];

    // 提前检测：文档不含任何嵌入语言标记时直接返回，
    // 避免无条件 innerHTML 重建把 ApexCharts/Leaflet 等 JS 实例的 DOM 全部销毁重建。
    if (!embedLanguages.some(lang => content.includes(`language-${lang}`))) {
      return;
    }

    let processedContent = content;

    const preTags = processedContent.match(/<pre[^>]*>[\s\S]*?<\/pre>/gi) || [];
    const prePlaceholders = [];

    preTags.forEach((pre, idx) => {
      const placeholder = `__PRE_PLACEHOLDER_${idx}__`;
      prePlaceholders.push({ placeholder, content: pre });
      processedContent = processedContent.replace(pre, () => placeholder);
    });

    prePlaceholders.forEach(({ placeholder, content }) => {
      let shouldRender = false;

      for (const lang of embedLanguages) {
        if (content.includes(`language-${lang}`)) {
          shouldRender = true;
          break;
        }
      }

      if (shouldRender) {
        const codeTagMatch = content.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
        if (codeTagMatch) {
          let codeText = codeTagMatch[1];

          codeText = codeText.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

          const embedMatch = extractEmbedSyntax(codeText);

          if (embedMatch) {
            const { service, url, fullMatch } = embedMatch;

            // 嵌入统一挂载工厂：@[service](url) → 占位 div（随 innerHTML 写回）→
            // DOM 就绪后调用对应渲染器的 loadAndRender / renderGeoData。
            // 四类嵌入（geojson/pkt/ensp/pptx）原本是四段几乎相同的复制粘贴代码。
            const mountEmbed = (opts) => {
              const id = opts.prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
              const containerHtml = `<div id="${id}" class="${opts.className}"${opts.style ? ` style="${opts.style}"` : ''}></div>`;

              setTimeout(() => {
                const el = document.getElementById(id);
                if (!el) return;
                try {
                  const p = opts.mount(el, url, service);
                  if (p && typeof p.catch === 'function') p.catch(e => console.error('[embedded] ' + service + ' render failed:', e));
                } catch (e) {
                  console.error('[embedded] ' + service + ' render failed:', e);
                }
              }, opts.delay || 50);

              return containerHtml;
            };

            // 以下所有 replace 的第二参一律用函数形式：内容里可能出现
            // $` / $& / $' 等 String.replace 特殊序列，字符串形式会被错误解释
            if (service === 'geojson' || service === 'topojson') {
              processedContent = processedContent.replace(placeholder, () => mountEmbed({
                prefix: 'map',
                className: 'geo-map',
                style: 'height:400px;border-radius:8px;overflow:hidden',
                delay: 10,
                mount: (el, embedUrl) =>
                  window.MarkdownPreview.renderers.geo.renderGeoData(service, embedUrl, fullMatch, el.id)
              }));
            } else if (service === 'pkt' || service === 'ensp') {
              processedContent = processedContent.replace(placeholder, () => mountEmbed({
                prefix: 'pkt',
                className: 'pkt-container',
                mount: (el, embedUrl) => {
                  if (window.MarkdownPreview.pkt) {
                    window.MarkdownPreview.pkt.loadAndRender(el, embedUrl, service);
                  }
                }
              }));
            } else if (service === 'pptx') {
              // PPTX 嵌入：与 pkt 完全同风格：@[pptx](slug) → 占位 div → pptx.loadAndRender
              processedContent = processedContent.replace(placeholder, () => mountEmbed({
                prefix: 'pptx',
                className: 'pptx-embed',
                mount: (el, embedUrl) => {
                  if (window.MarkdownPreview.pptx) {
                    return window.MarkdownPreview.pptx.loadAndRender(el, embedUrl, 'pptx');
                  }
                }
              }));
            } else if (service === 'twitter' || service === 'x') {
              const twitterCode = renderTwitterEmbed(service, url, fullMatch);
              processedContent = processedContent.replace(placeholder, () => twitterCode);
            } else {
              const iframe = createEmbedIframe(service, url);
              if (iframe) {
                processedContent = processedContent.replace(placeholder, () => iframe);
              } else {
                processedContent = processedContent.replace(placeholder, () => content);
              }
            }
          } else {
            processedContent = processedContent.replace(placeholder, () => content);
          }
        } else {
          processedContent = processedContent.replace(placeholder, () => content);
        }
      } else {
        processedContent = processedContent.replace(placeholder, () => content);
      }
    });

    targetEl.innerHTML = processedContent;
  }
  
  function renderTwitterEmbed(service, url, originalMatch) {
    try {
      let embedCode = '';

      // URL 可能含引号/尖括号（非受信内容），拼进 HTML 前一律转义
      const safeUrl = escAttr(url);

      const tweetMatch = url.match(/twitter\.com\/\w+\/status\/(\d+)/);
      if (tweetMatch) {
        embedCode = '<blockquote class="twitter-tweet"><a href="' + safeUrl + '">Loading tweet...</a></blockquote>';
      } else if (url.includes('twitter.com') && (url.includes('/likes') || url.includes('/with_replies') || url.includes('/media'))) {
        embedCode = '<a class="twitter-timeline" href="' + safeUrl + '">Loading Twitter timeline...</a>';
      } else if (url.includes('twitter.com')) {
        const handle = url.match(/twitter\.com\/([A-Za-z0-9_]{1,15})/)?.[1];
        if (handle && !url.includes('/status/')) {
          const safeHandle = escAttr(handle);
          embedCode = '<a class="twitter-timeline" href="https://twitter.com/' + safeHandle + '?ref_src=twsrc%5Etfw">Tweets by @' + safeHandle + '</a>';
        }
      } else if (url.includes('x.com')) {
        embedCode = '<blockquote class="twitter-tweet"><a href="' + safeUrl + '">Loading tweet...</a></blockquote>';
      }
      
      if (embedCode) {
        setTimeout(() => {
          if (typeof twttr !== 'undefined' && twttr.widgets) {
            twttr.widgets.load();
          } else {
            const checkTwitter = setInterval(() => {
              if (typeof twttr !== 'undefined' && twttr.widgets) {
                twttr.widgets.load();
                clearInterval(checkTwitter);
              }
            }, 100);
            setTimeout(() => clearInterval(checkTwitter), 5000);
          }
        }, 50);
      }
      
      return embedCode || originalMatch;
    } catch (error) {
      console.error('Twitter embed error:', error);
      return originalMatch;
    }
  }
  
  // 安全约定：各服务只按正则强提取 ID 后拼官方 embed URL；提取失败一律
  // 返回 null 拒绝渲染（绝不回退原始 URL）。所有拼进属性的值过 escAttr。
  function createEmbedIframe(service, url) {
    const iframeBase = '<iframe src="{src}" width="100%" height="{height}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>';

    let src = '';
    let height = '400';

    switch (service) {
      case 'youtube':
        const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
        if (!videoId) return null;
        src = 'https://www.youtube.com/embed/' + encodeURIComponent(videoId);
        height = '315';
        break;

      case 'bilibili':
        const bvid = url.match(/BV[0-9A-Za-z]+/)?.[0];
        if (!bvid) return null;
        src = 'https://player.bilibili.com/player.html?bvid=' + encodeURIComponent(bvid) + '&page=1';
        height = '315';
        break;

      case 'vimeo':
        const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
        if (!vimeoId) return null;
        src = 'https://player.vimeo.com/video/' + encodeURIComponent(vimeoId);
        height = '315';
        break;

      case 'figma':
        const figmaId = url.match(/figma\.com\/file\/([^\/?"&\s]+)/)?.[1];
        if (!figmaId) return null;
        src = 'https://www.figma.com/embed?embed_host=share&url=' + encodeURIComponent('https://www.figma.com/file/' + figmaId);
        height = '400';
        break;

      case 'codepen':
        const codepenMatch = url.match(/codepen\.io\/([^\/?"&\s]+)\/pen\/([^\/?"&\s]+)/);
        if (!codepenMatch) return null;
        src = 'https://codepen.io/' + encodeURIComponent(codepenMatch[1]) + '/embed/' + encodeURIComponent(codepenMatch[2]);
        height = '300';
        break;

      case 'jsfiddle':
        const fiddleId = url.match(/jsfiddle\.net\/([^\/?"&\s]+)/)?.[1];
        if (!fiddleId) return null;
        src = 'https://jsfiddle.net/' + encodeURIComponent(fiddleId) + '/embedded/';
        height = '300';
        break;

      case 'stackblitz': {
        const sbUrl = safeHttpUrl(url, ['stackblitz.com']);
        if (!sbUrl) return null;
        src = 'https://stackblitz.com' + sbUrl.pathname + '/embed' + sbUrl.search;
        height = '500';
        break;
      }

      case 'replit': {
        const replitMatch = url.match(/replit\.com\/@([^\/?"&\s]+)\/([^\/?"&\s]+)/);
        if (!replitMatch) return null;
        src = 'https://replit.com/embed/' + encodeURIComponent(replitMatch[1]) + '/' + encodeURIComponent(replitMatch[2]);
        height = '400';
        break;
      }

      case 'googlemaps': {
        const gmUrl = safeHttpUrl(url, ['www.google.com', 'google.com', 'maps.google.com']);
        if (!gmUrl) return null;
        src = escAttr(gmUrl.href);
        height = '300';
        break;
      }

      case 'openstreetmap': {
        const osmUrl = safeHttpUrl(url, ['www.openstreetmap.org', 'openstreetmap.org']);
        if (!osmUrl) return null;
        src = escAttr(osmUrl.href);
        height = '300';
        break;
      }

      case 'googledocs': {
        const gdUrl = safeHttpUrl(url, ['docs.google.com']);
        if (!gdUrl) return null;
        src = escAttr(gdUrl.href);
        height = '400';
        break;
      }

      case 'gist':
        const gistMatch = url.match(/gist\.github\.com\/([\w.-]+)\/([\w.-]+)/);
        if (!gistMatch) return null;
        src = 'https://gist.github.com/' + encodeURIComponent(gistMatch[1]) + '/' + encodeURIComponent(gistMatch[2]) + '.js';
        return '<script src="' + src + '"></script>';

      default:
        console.warn('Unsupported embed service:', service);
        return null;
    }

    return iframeBase.replace('{src}', escAttr(src)).replace('{height}', height);
  }
  
  window.MarkdownPreview.renderers.embedded = {
    render,
    renderTwitterEmbed,
    createEmbedIframe
  };
})();
