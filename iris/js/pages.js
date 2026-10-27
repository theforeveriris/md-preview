/**
 * pages - 文档站聚合页集合（#/blog · #/history · #/tags · #/index）
 *
 * 数据全部现成：file-tree.json（modified/title/tags）、
 * md-preview-history（浏览足迹）、tags 索引。统一以虚拟文档渲染。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  // Markdown 链接文本安全化：HTML 转义 + 方括号转义——标题里的标记
  // 字符/HTML 不破坏链接结构也不直通渲染（CodeRabbit review fix）
  const mdText = (raw) => esc(String(raw == null ? '' : raw))
    .replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');

  function walkFiles(items, out) {
    (items || []).forEach(item => {
      if (item.type === 'folder' && item.children) walkFiles(item.children, out);
      else if (item.type === 'file' && item.path && item.path.endsWith('.md')) out.push(item);
    });
    return out;
  }

  function allFiles() {
    return walkFiles(window.MarkdownPreview.state?.fileTreeData, []);
  }

  function fmtDate(sec) {
    if (!sec) return '';
    const d = new Date(sec * 1000);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  }

  function renderVirtual(lines, name) {
    const markdown = window.MarkdownPreview.markdown;
    if (markdown && markdown.renderVirtualDoc) markdown.renderVirtualDoc(lines.join('\n'), name);
  }

  // ============== 博客流 #/blog（?p= 分页） ==============

  const BLOG_PAGE_SIZE = 10;

  function openBlogPage(query) {
    const params = new URLSearchParams(query || '');
    const page = Math.max(1, parseInt(params.get('p'), 10) || 1);
    const files = allFiles()
      .filter(f => f.modified)
      .sort((a, b) => b.modified - a.modified);
    if (files.length === 0) {
      renderVirtual([`# ${t('blog.title', '博客')}`, '', `*${t('blog.empty', '暂无文章')}*`], t('blog.title', '博客'));
      return;
    }
    const totalPages = Math.ceil(files.length / BLOG_PAGE_SIZE);
    const slice = files.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE);

    const lines = [`# ${t('blog.title', '博客')}`, ''];
    lines.push(`> ${t('blog.total', '共 {n} 篇 · 第 {p} / {total} 页')
      .replace('{n}', files.length).replace('{p}', page).replace('{total}', totalPages)}`);
    lines.push('');
    slice.forEach(f => {
      const title = mdText(f.title || String(f.name || '').replace(/\.md$/i, ''));
      const date = fmtDate(f.modified);
      lines.push(`- [${title}](#/${encodeURI(f.path)})`);
      lines.push('  ' + [date, f.path ? `\`${f.path}\`` : ''].filter(Boolean).join(' · '));
    });
    // 上一页 / 下一页（原生 hash 链接，router 接管）
    const nav = [];
    if (page > 1) nav.push(`[${t('blog.prev', '← 上一页')}](#/blog?p=${page - 1})`);
    if (page < totalPages) nav.push(`[${t('blog.next', '下一页 →')}](#/blog?p=${page + 1})`);
    if (nav.length) { lines.push(''); lines.push(nav.join(' · ')); }

    renderVirtual(lines, t('blog.title', '博客'));
  }

  // ============== 全局历史页 #/history ==============

  function openHistoryPage() {
    const hist = (window.MarkdownPreview.history && window.MarkdownPreview.history.getHistory) || (() => []);
    const entries = hist();
    const lines = [`# ${t('globalHistory.title', '浏览足迹')}`, ''];
    lines.push(`> ${t('globalHistory.count', '最近 {n} 次阅读').replace('{n}', entries.length)}`);
    lines.push('');
    entries.forEach(item => {
      const when = new Date(item.ts || Date.now());
      const dateStr = isNaN(when) ? '' : when.toISOString().slice(0, 10);
      lines.push(`- [${mdText(item.title || item.path)}](#/${encodeURI(item.path)})`);
      lines.push('  ' + [dateStr, `\`${item.path}\``].filter(Boolean).join(' · '));
    });
    if (entries.length === 0) {
      lines.push(`*${t('globalHistory.empty', '还没有浏览记录，去挑一篇读读吧')}*`);
    }
    renderVirtual(lines, t('globalHistory.title', '浏览足迹'));
  }

  // ============== 标签云页 #/tags ==============

  function openTagsCloudPage() {
    const getIndex = window.MarkdownPreview.tags && window.MarkdownPreview.tags.getIndex;
    const index = getIndex ? getIndex() : null;
    const lines = [`# ${t('tagsCloud.title', '标签云')}`, ''];
    if (!index || index.size === 0) {
      lines.push(`*${t('tagsCloud.empty', '站点还没有标签数据')}*`);
      renderVirtual(lines, t('tagsCloud.title', '标签云'));
      return;
    }
    const max = Math.max(...[...index.values()].map(v => v.length));
    const min = Math.min(...[...index.values()].map(v => v.length));
    const span = Math.max(1, max - min);
    const tags = [...index.entries()]
      .map(([name, docs]) => ({ name, count: docs.length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    lines.push('<div class="tags-cloud-page">');
    tags.forEach(tag => {
      // 字号按文档数缩放（12px ~ 26px）
      const size = Math.round(12 + ((tag.count - min) / span) * 14);
      lines.push(`<a class="tags-cloud-item" href="#/tag/${encodeURIComponent(tag.name)}" style="font-size:${size}px" title="${tag.count}">${esc(tag.name)} <sup>${tag.count}</sup></a>`);
    });
    lines.push('</div>');
    renderVirtual(lines, t('tagsCloud.title', '标签云'));
  }

  // ============== 全站目录页 #/index（打印友好） ==============

  function openIndexPage() {
    const files = allFiles();
    const lines = [`# ${t('siteIndex.title', '全站目录')}`, ''];
    lines.push(`> ${t('siteIndex.count', '共 {n} 篇文档').replace('{n}', files.length)}`);
    lines.push('');

    // 按目录分组、目录内按 modified 倒序
    const groups = new Map();
    files.forEach(f => {
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '/';
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir).push(f);
    });
    [...groups.keys()].sort().forEach(dir => {
      const list = groups.get(dir).sort((a, b) => (b.modified || 0) - (a.modified || 0));
      lines.push(`## ${dir === '/' ? t('siteIndex.root', '（根目录）') : dir}`);
      lines.push('');
      list.forEach(f => {
        const title = f.title || String(f.name || '').replace(/\.md$/i, '');
        const date = fmtDate(f.modified);
        lines.push(`- [${title}](#/${encodeURI(f.path)})${date ? ' — ' + date : ''}`);
      });
      lines.push('');
    });

    renderVirtual(lines, t('siteIndex.title', '全站目录'));
  }

  // ============== 可定制首页（config.homepage） ==============

  // config.homepage:
  //   "docs/xxx.md" → 启动/回首页时打开该文档
  //   { mode: 'portal', title, subtitle, featured: [paths], links: [{text, href}] }
  //   → Docusaurus 风格门户页（hero + 精选文档卡片网格）
  function openHomepage() {
    const cfgHome = window.MarkdownPreview.CONFIG && window.MarkdownPreview.CONFIG.homepage;
    if (!cfgHome) return false;

    if (typeof cfgHome === 'string' && cfgHome.endsWith('.md')) {
      const markdown = window.MarkdownPreview.markdown;
      if (markdown) markdown.loadMarkdownFile(cfgHome.replace(/^\/+/, ''));
      return true;
    }
    if (cfgHome && typeof cfgHome === 'object' && cfgHome.mode === 'portal') {
      renderPortal(cfgHome);
      return true;
    }
    return false;
  }

  function renderPortal(cfg) {
    const featured = (cfg.featured || [])
      .map(p => allFiles().find(f => f.path === p))
      .filter(Boolean);
    const lines = [];
    lines.push(`<div class="portal-hero">
  <h1 class="portal-title">${esc(cfg.title || (window.MarkdownPreview.CONFIG.repo) || 'Docs')}</h1>
  ${cfg.subtitle ? `<p class="portal-subtitle">${esc(cfg.subtitle)}</p>` : ''}
</div>`);
    if (featured.length > 0) {
      lines.push(`<div class="portal-cards">`);
      featured.forEach(f => {
        const title = mdText(f.title || String(f.name || '').replace(/\.md$/i, ''));
        const tags = Array.isArray(f.tags) ? f.tags.slice(0, 3) : [];
        lines.push(`<a class="portal-card" href="#/${encodeURI(f.path)}">
  <span class="portal-card-title">${esc(title)}</span>
  ${f.wordCount ? `<span class="portal-card-meta">${esc(t('portal.words', '{n} 词').replace('{n}', f.wordCount))}</span>` : ''}
  ${tags.length ? `<span class="portal-card-tags">${tags.map(x => `<span class="portal-card-tag">${esc(x)}</span>`).join('')}</span>` : ''}
</a>`);
      });
      lines.push('</div>');
    }
    if (Array.isArray(cfg.links) && cfg.links.length > 0) {
      lines.push('');
      lines.push('<div class="portal-links">');
      cfg.links.forEach(l => {
        const href = String(l.href || '#');
        const external = /^https?:\/\//.test(href);
        lines.push(`<a class="portal-link" href="${esc(external ? href : '#/' + href.replace(/^\/+/, ''))}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(l.text || l.href)}${external ? ' ↗' : ''}</a>`);
      });
      lines.push('</div>');
    }
    renderVirtual(lines, cfg.title || 'Home');
  }

  window.MarkdownPreview.pages = { openBlogPage, openHistoryPage, openTagsCloudPage, openIndexPage, openHomepage };
})();
