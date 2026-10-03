/**
 * export-bundle - 整站打包导出（MD 合订 ZIP / EPUB 电子书）
 *
 * 三个出口（设置面板「工具与导出 → 导出」区块，settings.js 接线）：
 *   - exportSiteMdZip()  全部 .md 按仓库目录结构打包为 ZIP
 *   - exportEpub('doc')  当前文档导出为单篇 EPUB
 *   - exportEpub('site') 全部文档导出为整站 EPUB 合订本
 *
 * 依赖：zip.js（存储型 ZIP 写入器）、file-tree（DFS 文件清单）、
 *       md-render（parseMarkdown，与站点渲染管线同源）。
 *
 * EPUB 3 结构：mimetype（首条目 STORE）+ META-INF/container.xml +
 * OEBPS/(content.opf, nav.xhtml, style.css, text/chap-N.xhtml, assets/*)。
 * 本地相对路径图片随文打包（并发受限、总量封顶，失败即跳过并回退原相对地址）；
 * 远端图片不打包。章节 XHTML 由 parseMarkdown 输出做 XML 兼容修正
 * （void 元素自闭合、裸 & 转义），阅读器按 EPUB3 HTML 语法宽容解析。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const FETCH_CONCURRENCY = 4;
  const MAX_ASSET_TOTAL = 100 * 1024 * 1024; // 本地图片打包总量上限
  const MAX_ASSET_SINGLE = 20 * 1024 * 1024;

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  // ============== 公共工具 ==============

  function toast(msg) { alert(msg); }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  function slugifyName(s) {
    return String(s || '').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'export';
  }

  // frontmatter 剥离 + 标题提取（与 build-file-tree.js 的提取规则一致）
  function stripFrontmatter(md) {
    const m = md.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
    return m ? md.slice(m[0].length) : md;
  }

  function extractTitle(md, fallback) {
    const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (fm) {
      const line = fm[1].split('\n').find(l => l.trim().startsWith('title:'));
      if (line) {
        const v = line.trim().replace(/^title:\s*/, '').trim().replace(/^["']|["']$/g, '');
        if (v) return v;
      }
    }
    const body = stripFrontmatter(md);
    const h1 = body.match(/^#\s+(.+?)\s*$/m);
    return h1 ? h1[1].trim() : fallback;
  }

  // 并发拉取全部文档文本
  async function fetchAllDocs(onProgress) {
    const offline = window.MarkdownPreview.offline;
    const paths = offline ? offline.docPaths() : [];
    if (paths.length === 0) return [];
    const results = new Array(paths.length);
    let next = 0, done = 0;
    async function worker() {
      while (next < paths.length) {
        // 先固化索引再 await：并发下 next 会被其他 worker 推进，
        // 事后用 next-1 回写会错位覆盖、丢失文档
        const idx = next++;
        const path = paths[idx];
        try {
          const resp = await fetch(path, { cache: 'no-cache' });
          results[idx] = resp.ok ? await resp.text() : null;
        } catch (e) { results[idx] = null; }
        done++;
        if (onProgress) onProgress(done, paths.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, worker));
    return paths.map((p, i) => results[i] == null ? null : { path: p, text: results[i] }).filter(Boolean);
  }

  // ============== 整站 MD 打包 ==============

  async function exportSiteMdZip(onProgress) {
    const docs = await fetchAllDocs(onProgress);
    if (docs.length === 0) { toast(t('export.noDocs', '没有可打包的文档（文件树未加载或为空）')); return; }
    const zip = window.MarkdownPreview.zip;
    const blob = zip.createZip(docs.map(d => ({ name: d.path, data: d.text })));
    downloadBlob(blob, `md-preview-docs-${dateStamp()}.zip`);
  }

  // ============== EPUB ==============

  const IMAGE_EXT_TYPES = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp'
  };

  // parseMarkdown 输出 → XML 兼容：void 元素自闭合 + 裸 & 转义
  function htmlToXhtml(html) {
    return html
      .replace(/<(br|hr|img|input|meta|link|source|col|area|base|embed|track|wbr)((?:[^>"']|"[^"]*"|'[^']*')*?)\s*\/?>/gi, '<$1$2/>')
      .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#x[0-9a-fA-F]+);)/g, '&amp;');
  }

  function escapeXml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  const EPUB_STYLE = `body { font-family: serif; line-height: 1.7; margin: 1em; }
h1, h2, h3 { line-height: 1.3; }
img { max-width: 100%; height: auto; }
pre { overflow-x: auto; padding: 0.6em; background: #f6f6f8; font-size: 0.85em; }
code { font-family: monospace; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #bbb; margin: 0.8em 0; padding: 0.1em 1em; color: #555; }
table { border-collapse: collapse; margin: 0.8em 0; }
th, td { border: 1px solid #bbb; padding: 4px 8px; }
figure { margin: 1em 0; text-align: center; }`;

  /**
   * 收集章节内引用的本地相对图片，fetch 后作为 EPUB 内嵌资源。
   * @returns {Promise<Map<string,{href:string,media:string,data:Uint8Array}>>} src → 资源
   */
  async function collectImages(chapters, onProgress) {
    const wanted = new Map(); // 解析后的站点路径 → 原始 src 列表
    for (const chap of chapters) {
      const re = /<img\b[^>]*?\bsrc\s*=\s*"([^"]+)"/gi;
      let m;
      while ((m = re.exec(chap.html)) !== null) {
        const src = m[1];
        if (/^(https?:|data:|#|\/)/i.test(src)) continue;
        const dir = chap.path.includes('/') ? chap.path.slice(0, chap.path.lastIndexOf('/') + 1) : '';
        const parts = [];
        for (const seg of (dir + src).split('/')) {
          if (seg === '..') parts.pop();
          else if (seg !== '.' && seg !== '') parts.push(seg);
        }
        const sitePath = decodeURIComponent(parts.join('/'));
        if (!wanted.has(sitePath)) wanted.set(sitePath, []);
        wanted.get(sitePath).push({ chap, src });
      }
    }

    const assets = new Map();
    let total = 0;
    const list = [...wanted.keys()];
    let done = 0;
    for (const sitePath of list) {
      try {
        const resp = await fetch(encodeURI(sitePath), { cache: 'no-cache' });
        const buf = new Uint8Array(await resp.arrayBuffer());
        const ext = (sitePath.split('.').pop() || '').toLowerCase();
        const media = IMAGE_EXT_TYPES[ext];
        if (!resp.ok || !media || buf.length > MAX_ASSET_SINGLE || total + buf.length > MAX_ASSET_TOTAL) {
          throw new Error('skip');
        }
        total += buf.length;
        const name = 'img-' + (assets.size + 1) + '-' + sitePath.split('/').pop().replace(/[^\w.-]/g, '_');
        assets.set(sitePath, { href: 'assets/' + name, media, data: buf });
      } catch (e) { /* 拉不到就保留原相对地址 */ }
      done++;
      if (onProgress) onProgress(done, list.length);
    }
    // 回写章节内的 src
    for (const [sitePath, asset] of assets) {
      for (const { chap, src } of wanted.get(sitePath)) {
        chap.html = chap.html.split(`src="${src}"`).join(`src="../${asset.href}"`);
      }
    }
    return assets;
  }

  async function buildEpub({ title, chapters, onProgress }) {
    const zip = window.MarkdownPreview.zip;
    const lang = document.documentElement.getAttribute('lang') || 'zh-CN';
    const bookId = 'urn:uuid:' + uuid();
    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

    // 渲染正文：与站点同源的 parseMarkdown；本地图片随文打包
    for (const chap of chapters) {
      const md = stripFrontmatter(chap.text);
      const { html } = window.MarkdownPreview.mdRender.parseMarkdown(md);
      chap.html = html;
      chap.title = extractTitle(chap.text, chap.fallbackTitle);
    }
    const assets = await collectImages(chapters, onProgress);

    const chapterFiles = chapters.map((chap, i) => {
      const hasH1 = /<h1[\s>]/i.test(chap.html);
      const body = (hasH1 ? '' : `<h1>${escapeXml(chap.title)}</h1>`) + chap.html;
      const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="utf-8"/><title>${escapeXml(chap.title)}</title><link rel="stylesheet" type="text/css" href="../style.css"/></head>
<body>
${htmlToXhtml(body)}
</body>
</html>`;
      return { name: `text/chap-${String(i + 1).padStart(3, '0')}.xhtml`, data: xhtml, title: chap.title };
    });

    const navItems = chapterFiles.map((c, i) =>
      `<li><a href="text/chap-${String(i + 1).padStart(3, '0')}.xhtml">${escapeXml(c.title)}</a></li>`).join('\n');
    const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head><meta charset="utf-8"/><title>${escapeXml(title)}</title></head>
<body>
<nav epub:type="toc" id="toc"><h1>${escapeXml(t('export.epub.toc', '目录'))}</h1>
<ol>
${navItems}
</ol></nav>
</body>
</html>`;

    const manifestItems = chapterFiles.map((c, i) =>
      `    <item id="c${i + 1}" href="${c.name}" media-type="application/xhtml+xml"/>`).join('\n');
    const assetItems = [...assets.values()].map(a =>
      `    <item id="a-${a.href.replace(/[^a-z0-9]/gi, '-')}" href="${a.href}" media-type="${a.media}"/>`).join('\n');
    const spineRefs = chapterFiles.map((c, i) => `    <itemref idref="c${i + 1}"/>`).join('\n');

    const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${bookId}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${lang}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
${manifestItems}
${assetItems}
  </manifest>
  <spine>
${spineRefs}
  </spine>
</package>`;

    const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

    const entries = [
      { name: 'mimetype', data: 'application/epub+zip' },
      { name: 'META-INF/container.xml', data: container },
      { name: 'OEBPS/content.opf', data: opf },
      { name: 'OEBPS/nav.xhtml', data: navXhtml },
      { name: 'OEBPS/style.css', data: EPUB_STYLE },
      ...chapterFiles.map(c => ({ name: 'OEBPS/' + c.name, data: c.data })),
      ...[...assets.values()].map(a => ({ name: 'OEBPS/' + a.href, data: a.data }))
    ];
    return zip.createZip(entries);
  }

  /**
   * 导出 EPUB
   * @param {'doc'|'site'} scope
   * @param {Function} [onProgress] (done, total, label)
   */
  async function exportEpub(scope, onProgress) {
    const { state } = window.MarkdownPreview;
    let chapters, title;

    if (scope === 'doc') {
      let text, fallback, path;
      if (state && state.localDoc && state.localDoc.content) {
        text = state.localDoc.content;
        fallback = (state.localDoc.name || 'document.md').replace(/\.md$/i, '');
        path = fallback + '.md';
      } else if (state && state.currentFilePath) {
        path = state.currentFilePath;
        const resp = await fetch(path, { cache: 'no-cache' });
        if (!resp.ok) { toast(t('export.fetchFailed', '文档获取失败，请重试')); return; }
        text = await resp.text();
        fallback = path.split('/').pop().replace(/\.md$/i, '');
      } else {
        toast(t('export.needDoc', '请先打开一个文档'));
        return;
      }
      chapters = [{ path, text, fallbackTitle: fallback }];
      title = extractTitle(text, fallback);
    } else {
      const repo = (window.MarkdownPreview.config && window.MarkdownPreview.config.repo) || 'Markdown Preview';
      title = repo;
      const docs = await fetchAllDocs((done, total) => onProgress && onProgress(done, total, 'docs'));
      if (docs.length === 0) { toast(t('export.noDocs', '没有可打包的文档（文件树未加载或为空）')); return; }
      chapters = docs.map(d => ({ path: d.path, text: d.text, fallbackTitle: d.path.replace(/\.md$/i, '').split('/').pop() }));
    }

    const blob = await buildEpub({
      title,
      chapters,
      onProgress: (done, total) => onProgress && onProgress(done, total, 'assets')
    });
    const name = scope === 'doc'
      ? `${slugifyName(title)}-${dateStamp()}.epub`
      : `${slugifyName(title)}-docs-${dateStamp()}.epub`;
    downloadBlob(blob, name);
  }

  window.MarkdownPreview.exportBundle = { exportSiteMdZip, exportEpub };
})();
