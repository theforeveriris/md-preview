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
  
  function render(container) {
    // 支持传入外部容器（如编辑器 cell 的 outputElement），不传则默认操作主文档
    const targetEl = container || dom.markdownContent;
    const content = targetEl.innerHTML;
    let processedContent = content;

    const embedLanguages = ['embed', 'geojson', 'topojson', 'twitter', 'x', 'pkt', 'ensp', 'pptx'];
    const preTags = processedContent.match(/<pre[^>]*>[\s\S]*?<\/pre>/gi) || [];
    const prePlaceholders = [];

    preTags.forEach((pre, idx) => {
      const placeholder = `__PRE_PLACEHOLDER_${idx}__`;
      prePlaceholders.push({ placeholder, content: pre });
      processedContent = processedContent.replace(pre, placeholder);
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

            if (service === 'geojson' || service === 'topojson') {
              const mapId = 'map-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
              const mapContainer = `<div id="${mapId}" class="geo-map" style="height:400px;border-radius:8px;overflow:hidden"></div>`;

              setTimeout(() => {
                const p = window.MarkdownPreview.renderers.geo.renderGeoData(service, url, fullMatch, mapId);
                if (p && typeof p.catch === 'function') p.catch(e => console.error('[embedded] geo render failed:', e));
              }, 10);

              processedContent = processedContent.replace(placeholder, mapContainer);
            } else if (service === 'pkt') {
              const pktId = 'pkt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
              const pktContainer = `<div id="${pktId}" class="pkt-container"></div>`;

              setTimeout(() => {
                const el = document.getElementById(pktId);
                if (el && window.MarkdownPreview.pkt) {
                  window.MarkdownPreview.pkt.loadAndRender(el, url, 'pkt');
                }
              }, 50);

              processedContent = processedContent.replace(placeholder, pktContainer);
            } else if (service === 'ensp') {
              const pktId = 'pkt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
              const pktContainer = `<div id="${pktId}" class="pkt-container"></div>`;

              setTimeout(() => {
                const el = document.getElementById(pktId);
                if (el && window.MarkdownPreview.pkt) {
                  window.MarkdownPreview.pkt.loadAndRender(el, url, 'ensp');
                }
              }, 50);

              processedContent = processedContent.replace(placeholder, pktContainer);
            } else if (service === 'pptx') {
              // PPTX 嵌入：与 pkt 完全同风格：@[pptx](slug) → 占位 div → pptx.loadAndRender
              const pptxId = 'pptx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
              const pptxContainer = `<div id="${pptxId}" class="pptx-embed"></div>`;

              setTimeout(() => {
                const el = document.getElementById(pptxId);
                if (el && window.MarkdownPreview.pptx) {
                  const p = window.MarkdownPreview.pptx.loadAndRender(el, url, 'pptx');
                  if (p && typeof p.catch === 'function') p.catch(e => console.error('[embedded] pptx render failed:', e));
                }
              }, 50);

              processedContent = processedContent.replace(placeholder, pptxContainer);
            } else if (service === 'twitter' || service === 'x') {
              const twitterCode = renderTwitterEmbed(service, url, fullMatch);
              processedContent = processedContent.replace(placeholder, twitterCode);
            } else {
              const iframe = createEmbedIframe(service, url);
              if (iframe) {
                processedContent = processedContent.replace(placeholder, iframe);
              } else {
                processedContent = processedContent.replace(placeholder, content);
              }
            }
          } else {
            processedContent = processedContent.replace(placeholder, content);
          }
        } else {
          processedContent = processedContent.replace(placeholder, content);
        }
      } else {
        processedContent = processedContent.replace(placeholder, content);
      }
    });

    targetEl.innerHTML = processedContent;
  }
  
  function renderTwitterEmbed(service, url, originalMatch) {
    try {
      let embedCode = '';
      
      const tweetMatch = url.match(/twitter\.com\/\w+\/status\/(\d+)/);
      if (tweetMatch) {
        embedCode = '<blockquote class="twitter-tweet"><a href="' + url + '">Loading tweet...</a></blockquote>';
      } else if (url.includes('twitter.com') && (url.includes('/likes') || url.includes('/with_replies') || url.includes('/media'))) {
        embedCode = '<a class="twitter-timeline" href="' + url + '">Loading Twitter timeline...</a>';
      } else if (url.includes('twitter.com')) {
        const handle = url.match(/twitter\.com\/([^\/?]+)/)?.[1];
        if (handle && !url.includes('/status/')) {
          embedCode = '<a class="twitter-timeline" href="https://twitter.com/' + handle + '?ref_src=twsrc%5Etfw">Tweets by @' + handle + '</a>';
        }
      } else if (url.includes('x.com')) {
        embedCode = '<blockquote class="twitter-tweet"><a href="' + url + '">Loading tweet...</a></blockquote>';
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
  
  function createEmbedIframe(service, url) {
    const iframeBase = '<iframe src="{src}" width="100%" height="{height}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>';
    
    let src = '';
    let height = '400';
    
    switch (service) {
      case 'youtube':
        const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1] || url;
        src = 'https://www.youtube.com/embed/' + videoId;
        height = '315';
        break;
        
      case 'bilibili':
        const bvid = url.match(/BV[\w]+/)?.[0] || url;
        src = 'https://player.bilibili.com/player.html?bvid=' + bvid + '&page=1';
        height = '315';
        break;
        
      case 'vimeo':
        const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1] || url;
        src = 'https://player.vimeo.com/video/' + vimeoId;
        height = '315';
        break;
        
      case 'figma':
        const figmaId = url.match(/figma\.com\/file\/([^\/?]+)/)?.[1] || url;
        src = 'https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/' + figmaId;
        height = '400';
        break;
        
      case 'codepen':
        const codepenMatch = url.match(/codepen\.io\/([^\/]+)\/pen\/([^\/?]+)/);
        if (codepenMatch) {
          src = 'https://codepen.io/' + codepenMatch[1] + '/embed/' + codepenMatch[2];
        } else {
          src = url + '/embed';
        }
        height = '300';
        break;
        
      case 'jsfiddle':
        const fiddleId = url.match(/jsfiddle\.net\/([^\/?]+)/)?.[1] || url;
        src = 'https://jsfiddle.net/' + fiddleId + '/embedded/';
        height = '300';
        break;
        
      case 'stackblitz':
        src = url + '/embed';
        height = '500';
        break;
        
      case 'replit':
        const replitMatch = url.match(/replit\.com\/@([^\/]+)\/([^\/?]+)/);
        if (replitMatch) {
          src = 'https://replit.com/embed/' + replitMatch[1] + '/' + replitMatch[2];
        } else {
          src = url + '/embed';
        }
        height = '400';
        break;
        
      case 'googlemaps':
        src = url;
        height = '300';
        break;
        
      case 'openstreetmap':
        src = url;
        height = '300';
        break;
        
      case 'googledocs':
        src = url;
        height = '400';
        break;
        
      case 'gist':
        const gistMatch = url.match(/gist\.github\.com\/([^\/]+)\/([^\/?]+)/);
        if (gistMatch) {
          src = 'https://gist.github.com/' + gistMatch[1] + '/' + gistMatch[2] + '.js';
          return '<script src="' + src + '"></script>';
        }
        return null;
        
      default:
        console.warn('Unsupported embed service:', service);
        return null;
    }
    
    return iframeBase.replace('{src}', src).replace('{height}', height);
  }
  
  window.MarkdownPreview.renderers.embedded = {
    render,
    renderTwitterEmbed,
    createEmbedIframe
  };
})();
