/**
 * snapshot - 无部署快照分享（链接即文档）
 *
 * 把 Markdown 文本 deflate（pako，PlantUML 已引入）+ base64url 编码进
 * hash：#/s?z=<data>，接收方打开链接即解压渲染为临时文档——
 * 不需要部署站点、不需要建仓库，零后端传一篇笔记。
 *
 * 入口：悬浮球「快照分享」（settings.js 接线），对当前文档生效
 * （站点文档取原文，本地文件会话取会话内容）。
 * 接收：router.js 识别 #/s?z= 转入 handleRoute()，解压后走既有渲染管线，
 * 并在正文顶部挂提示条（内容仅存于链接与本机，不会被上传或索引）。
 *
 * 注意：浏览器对 URL 长度有实际限制（约 64KB 起步，因浏览器而异），
 * 超过约 30KB 时提示降级为导出 .md 文件。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  // base64url 安全阈值：超过后部分环境可能截断
  const URL_SAFE_LIMIT = 30 * 1024;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  // ============== 编解码 ==============

  function bytesToBase64url(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64urlToBytes(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function ensurePako() {
    if (typeof pako !== 'undefined') return true;
    if (window.MarkdownPreview.loadScript) {
      await window.MarkdownPreview.loadScript('iris/vendor/pako.min.js');
    }
    return typeof pako !== 'undefined';
  }

  async function encodePayload(title, content) {
    if (!(await ensurePako())) return null;
    const json = JSON.stringify({ _v: 1, t: title || '', c: content });
    const bytes = pako.deflate(new TextEncoder().encode(json));
    return bytesToBase64url(bytes);
  }

  async function decodePayload(z) {
    if (!(await ensurePako())) return null;
    try {
      const json = pako.inflate(base64urlToBytes(z), { to: 'string' });
      const data = JSON.parse(json);
      if (!data || typeof data.c !== 'string') return null;
      return { title: data.t || '', content: data.c };
    } catch (e) {
      return null;
    }
  }

  // ============== 生成入口（悬浮球菜单调用） ==============

  async function buildShareUrlForCurrentDoc() {
    const st = window.MarkdownPreview.state || {};
    const markdown = window.MarkdownPreview.markdown;
    let title = st.docTitle || '';
    let content = '';

    if (st.localDoc && typeof st.localDoc.content === 'string') {
      // 本地文件会话 / 虚拟文档：内容就在内存里
      content = st.localDoc.content;
    } else if (st.currentFilePath) {
      try {
        const resp = await fetch(st.currentFilePath, { cache: 'no-store' });
        if (!resp.ok) throw new Error('fetch ' + resp.status);
        content = await resp.text();
      } catch (e) {
        return { ok: false, reason: t('snap.loadFailed', '文档内容获取失败') };
      }
    } else {
      return { ok: false, reason: t('snap.noDoc', '当前没有可分享的文档') };
    }

    if (!content.trim()) {
      return { ok: false, reason: t('snap.noDoc', '当前没有可分享的文档') };
    }

    const z = await encodePayload(title, content);
    if (!z) {
      return { ok: false, reason: t('snap.compressFailed', '压缩组件加载失败') };
    }

    const url = `${location.origin}${location.pathname}#/s?z=${z}`;
    return {
      ok: true,
      url,
      oversize: url.length > URL_SAFE_LIMIT,
      content
    };
  }

  // ============== 接收（router 虚拟路由） ==============

  function parseHash() {
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex === -1) return null;
    const params = new URLSearchParams(hash.slice(qIndex + 1));
    const z = params.get('z');
    return z ? { z } : null;
  }

  async function handleRoute() {
    const parsed = parseHash();
    const markdown = window.MarkdownPreview.markdown;
    if (!parsed) {
      if (markdown) {
        markdown.renderVirtualDoc(`# ${t('snap.badLinkTitle', '快照链接无效')}\n\n${t('snap.badLinkBody', '链接中的快照数据缺失或已损坏。')}`, t('snap.name', '快照'));
      }
      return;
    }

    const data = await decodePayload(parsed.z);
    if (!data) {
      if (markdown) {
        markdown.renderVirtualDoc(`# ${t('snap.badLinkTitle', '快照链接无效')}\n\n${t('snap.badLinkBody', '链接中的快照数据缺失或已损坏。')}`, t('snap.name', '快照'));
      }
      return;
    }

    const title = data.title || t('snap.name', '快照');
    if (markdown) markdown.renderVirtualDoc(data.content, title);
    mountBanner(data.content, title);
  }

  function mountBanner(content, title) {
    const dom = window.MarkdownPreview.dom;
    const container = (dom && dom.markdownContent) || document.getElementById('markdownContent');
    if (!container) return;
    const old = container.querySelector('.snapshot-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.className = 'snapshot-banner';
    banner.innerHTML = `
      <div class="snapshot-banner-text">
        <strong>${t('snap.bannerTitle', '这是一份快照分享')}</strong>
        <span>${t('snap.bannerBody', '内容仅存在于链接与本机，不会被上传或收录')}</span>
      </div>
      <div class="snapshot-banner-actions">
        <button type="button" data-act="save">${t('snap.saveSession', '存入本地会话')}</button>
        <button type="button" data-act="dismiss">${t('common.close', '关闭')}</button>
      </div>
    `;
    banner.querySelector('[data-act="dismiss"]').addEventListener('click', () => banner.remove());
    banner.querySelector('[data-act="save"]').addEventListener('click', () => {
      const localDocs = window.MarkdownPreview.localDocs;
      if (localDocs && localDocs.addTextDoc) {
        localDocs.addTextDoc(title || t('snap.name', '快照'), content);
        banner.remove();
      }
    });
    container.insertBefore(banner, container.firstChild);
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'snapshot-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2400);
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    ta.remove();
  }

  // 悬浮球菜单入口
  function init() {
    const btn = document.getElementById('snapshotShareBtn');
    btn?.addEventListener('click', async () => {
      // 收起悬浮菜单
      document.querySelector('.menu-items')?.classList.remove('open');
      document.getElementById('menuTrigger')?.classList.remove('active');

      toast(t('snap.working', '正在生成快照链接…'));
      const result = await buildShareUrlForCurrentDoc();
      if (!result.ok) {
        toast(result.reason);
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(result.url).catch(() => legacyCopy(result.url));
      } else {
        legacyCopy(result.url);
      }
      toast(result.oversize
        ? t('snap.copiedOversize', '已复制快照链接（内容较大，部分环境可能打不开）')
        : t('snap.copied', '已复制快照链接，发给对方即可打开'));
    });
  }

  window.MarkdownPreview.snapshot = { handleRoute, buildShareUrlForCurrentDoc, init };
})();
