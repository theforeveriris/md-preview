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

    const embedLanguages = ['embed', 'geojson', 'topojson', 'twitter', 'x', 'pkt', 'ensp', 'pptx'];

    // 提前检测：文档不含任何嵌入语言标记时直接返回
    const embedSelector = embedLanguages.map(l => `pre code.language-${l}`).join(',');
    if (!targetEl.querySelector(embedSelector)) {
      return;
    }

    // 逐 pre 节点处理并原地替换，绝不整容器 innerHTML 重写——
    // 旧实现把全文档读出再写回，会摧毁此前渲染器已挂载的 Leaflet 地图、
    // KaTeX 结果、code-tabs 监听器等活性 DOM。
    const pres = Array.from(targetEl.querySelectorAll('pre'));

    pres.forEach(preEl => {
      const codeEl = preEl.querySelector('code');
      if (!codeEl) return;
      const classAttr = codeEl.getAttribute('class') || '';
      const isEmbed = embedLanguages.some(lang => classAttr.includes(`language-${lang}`));
      if (!isEmbed) return;

      let codeText = codeEl.textContent.trim();
      const embedMatch = extractEmbedSyntax(codeText);
      if (!embedMatch) return; // 保留原 pre

      const { service, url, fullMatch } = embedMatch;

      // 嵌入统一挂载工厂：@[service](url) → 直接创建挂载 div 替换 pre →
      // DOM 就绪后调用对应渲染器的 loadAndRender / renderGeoData
      const mountEmbed = (opts) => {
        const id = opts.prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const el = document.createElement('div');
        el.id = id;
        el.className = opts.className;
        if (opts.style) el.style.cssText = opts.style;
        preEl.replaceWith(el);

        setTimeout(() => {
          if (!el.isConnected) return;
          try {
            const p = opts.mount(el, url, service);
            if (p && typeof p.catch === 'function') p.catch(e => console.error('[embedded] ' + service + ' render failed:', e));
          } catch (e) {
            console.error('[embedded] ' + service + ' render failed:', e);
          }
        }, opts.delay || 50);
      };

      if (service === 'geojson' || service === 'topojson') {
        mountEmbed({
          prefix: 'map',
          className: 'geo-map',
          style: 'height:400px;border-radius:8px;overflow:hidden',
          delay: 10,
          mount: (el, embedUrl) =>
            window.MarkdownPreview.renderers.geo.renderGeoData(service, embedUrl, fullMatch, el.id)
        });
      } else if (service === 'pkt' || service === 'ensp') {
        mountEmbed({
          prefix: 'pkt',
          className: 'pkt-container',
          mount: (el, embedUrl) => {
            if (window.MarkdownPreview.pkt) {
              window.MarkdownPreview.pkt.loadAndRender(el, embedUrl, service);
            }
          }
        });
      } else if (service === 'pptx') {
        // PPTX 嵌入：与 pkt 完全同风格：@[pptx](slug) → 挂载 div → pptx.loadAndRender
        mountEmbed({
          prefix: 'pptx',
          className: 'pptx-embed',
          mount: (el, embedUrl) => {
            if (window.MarkdownPreview.pptx) {
              return window.MarkdownPreview.pptx.loadAndRender(el, embedUrl, 'pptx');
            }
          }
        });
      } else if (service === 'twitter' || service === 'x') {
        const twitterCode = renderTwitterEmbed(service, url, fullMatch);
        // template 内不执行脚本，与旧 innerHTML 行为一致
        const tpl = document.createElement('template');
        tpl.innerHTML = twitterCode;
        preEl.replaceWith(tpl.content);
      } else {
        const iframe = createEmbedIframe(service, url);
        if (iframe) {
          const tpl = document.createElement('template');
          tpl.innerHTML = iframe;
          preEl.replaceWith(tpl.content);
        }
        // iframe 为 null（服务不支持 / URL 校验不通过）时保留原 pre，
        // 让读者至少能看到嵌入语法原文
      }
    });
  }

  const TWITTER_HOSTS = ['twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'x.com', 'www.x.com'];

  function renderTwitterEmbed(service, url, originalMatch) {
    try {
      let embedCode = '';

      // 先按 URL 语义校验协议与主机：escAttr 只转义 HTML 字符，
      // 挡不住 `javascript:...//twitter.com/x/status/1` 这类「子串能匹配、
      // 协议却是脚本」的链接（净化发生在嵌入渲染之前，清不掉这个新链接）。
      const parsed = safeHttpUrl(url, TWITTER_HOSTS);
      if (!parsed) return originalMatch;

      // 归一化后的 URL 再转义（属性值仍要转义，双重防护）
      const safeUrl = escAttr(parsed.href);
      const pathname = parsed.pathname;
      const host = parsed.hostname;

      if (host === 'twitter.com' || host === 'x.com' || host === 'www.twitter.com' || host === 'www.x.com') {
        if (/^\/[A-Za-z0-9_]{1,15}\/status\/\d+/.test(pathname)) {
          embedCode = '<blockquote class="twitter-tweet"><a href="' + safeUrl + '">Loading tweet...</a></blockquote>';
        } else if (/\/(likes|with_replies|media)\b/.test(pathname)) {
          embedCode = '<a class="twitter-timeline" href="' + safeUrl + '">Loading Twitter timeline...</a>';
        } else {
          const handle = pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1];
          if (handle) {
            const safeHandle = escAttr(handle);
            embedCode = '<a class="twitter-timeline" href="https://twitter.com/' + safeHandle + '?ref_src=twsrc%5Etfw">Tweets by @' + safeHandle + '</a>';
          }
        }
      }
      
      if (embedCode) {
        // widgets.js 按需注入：只有文档真的含 twitter 嵌入才加载第三方脚本
        setTimeout(() => {
          if (typeof twttr === 'undefined') {
            window.MarkdownPreview.loadScript('https://platform.twitter.com/widgets.js')
              .then(() => { if (typeof twttr !== 'undefined' && twttr.widgets) twttr.widgets.load(); })
              .catch(e => console.error('[embedded] twitter widgets.js load failed:', e));
            return;
          }
          if (twttr.widgets) {
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
        src = gmUrl.href; // 原样赋给 src，末尾统一转义一次（避免 & 二次转义）
        height = '300';
        break;
      }

      case 'openstreetmap': {
        const osmUrl = safeHttpUrl(url, ['www.openstreetmap.org', 'openstreetmap.org']);
        if (!osmUrl) return null;
        src = osmUrl.href; // 原样赋给 src，末尾统一转义一次（避免 & 二次转义）
        height = '300';
        break;
      }

      case 'googledocs': {
        const gdUrl = safeHttpUrl(url, ['docs.google.com']);
        if (!gdUrl) return null;
        src = gdUrl.href; // 原样赋给 src，末尾统一转义一次（避免 & 二次转义）
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
