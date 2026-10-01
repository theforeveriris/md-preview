/**
 * 链接悬浮预览
 *
 * 鼠标悬停正文中的站内链接（hash 路由的 .md 文档链接）时，
 * 延迟约 300ms 弹出目标文档的摘要卡片（Obsidian / 维基百科同款）：
 * 不用离开当前页就能确认要不要跳。
 *
 * 卡片内容（纯文本，不渲染 Markdown，避免 XSS 面）：
 *   - 标题：frontmatter.title > 正文首个 H1 > 文件名
 *   - 摘要：frontmatter.description > 正文摘要（复用 OGP 的提炼逻辑）
 *   - 元信息：预计阅读时长
 *
 * 交互：
 *   - 点击卡片跳转目标文档；Esc / 移出链接与卡片 / 滚动 / 窗口缩放关闭
 *   - 触屏设备无 hover，不启用
 *   - 同一文档的摘要按路径做内存级缓存，避免悬停风暴重复 fetch
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const HOVER_DELAY_MS = 300;
  const EXCERPT_MAX = 140;
  const dataCache = new Map(); // path -> { title, excerpt, readingTime } | null（null=加载失败）

  let cardEl = null;
  let hoverTimer = null;
  let currentPath = null;
  let pinnedForLink = null; // 当前卡片对应的链接元素

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key);
    return fallback;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 从链接 href 提取目标文档路径：#/docs/x.md#anchor → docs/x.md
  function pathFromHref(href) {
    if (!href || !href.startsWith('#/')) return null;
    let path = href.substring(2);
    const mdIndex = path.indexOf('.md');
    if (mdIndex === -1) return null;
    path = path.substring(0, mdIndex + 3);
    try { path = decodeURIComponent(path); } catch (e) { /* 保留原样 */ }
    return path;
  }

  // ============== 数据加载（带缓存） ==============
  async function loadDocData(path) {
    if (dataCache.has(path)) return dataCache.get(path);
    const md = window.MarkdownPreview.markdown;
    let result = null;
    try {
      const resp = await fetch(path, { cache: 'no-cache' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const raw = await resp.text();
      const { frontmatter, content } = md.parseFrontmatter(raw);
      const h1 = (content.match(/^#\s+(.+)$/m) || [])[1];
      const title = frontmatter.title || (h1 && h1.trim()) ||
        decodeURIComponent(path.split('/').pop() || '').replace(/\.md$/i, '');
      const excerpt = frontmatter.description ||
        md.extractExcerpt(content, EXCERPT_MAX) || '';
      const readingTime = md.calculateReadingTime(
        content.replace(/[#*`\[\]()_{}]/g, '').replace(/\n+/g, ' ').trim());
      result = { title, excerpt, readingTime };
    } catch (e) {
      result = null;
    }
    dataCache.set(path, result);
    return result;
  }

  // ============== 卡片 ==============
  function ensureCard() {
    if (cardEl) return cardEl;
    cardEl = document.createElement('div');
    cardEl.className = 'hover-preview-card';
    cardEl.setAttribute('role', 'tooltip');
    document.body.appendChild(cardEl);
    cardEl.addEventListener('click', () => {
      if (currentPath) {
        hideCard();
        window.MarkdownPreview.markdown.loadMarkdownFile(currentPath);
        window.MarkdownPreview.fileTree.highlightFileInSidebar(currentPath);
      }
    });
    return cardEl;
  }

  function hideCard() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (cardEl) cardEl.classList.remove('open');
    pinnedForLink = null;
  }

  function showCard(path, linkEl) {
    const card = ensureCard();
    currentPath = path;
    pinnedForLink = linkEl;
    card.innerHTML = `<div class="hover-preview-loading">${esc(t('preview.loading', '加载中…'))}</div>`;
    // 先按链接位置定位（加载完成后高度变化无妨，位置仍正确）
    positionCard(linkEl);
    card.classList.add('open');

    loadDocData(path).then(data => {
      if (pinnedForLink !== linkEl) return; // 已移到别的链接
      if (!data) { hideCard(); return; }
      card.innerHTML = `
        <div class="hover-preview-title"></div>
        <div class="hover-preview-excerpt"></div>
        <div class="hover-preview-meta"></div>
      `;
      card.querySelector('.hover-preview-title').textContent = data.title;
      card.querySelector('.hover-preview-excerpt').textContent = data.excerpt ||
        t('preview.noExcerpt', '（暂无摘要）');
      card.querySelector('.hover-preview-meta').textContent =
        t('md.readingTime', '预计阅读 {n} 分钟').replace('{n}', data.readingTime);
      positionCard(linkEl);
    });
  }

  function positionCard(linkEl) {
    if (!cardEl || !linkEl) return;
    const rect = linkEl.getBoundingClientRect();
    cardEl.style.left = '0px';
    cardEl.style.top = '0px';
    const w = cardEl.offsetWidth;
    const h = cardEl.offsetHeight;
    let x = rect.left;
    let y = rect.bottom + 8;
    if (x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
    if (y + h > window.innerHeight - 8) y = rect.top - h - 8;
    cardEl.style.left = Math.max(8, x) + 'px';
    cardEl.style.top = Math.max(8, y) + 'px';
  }

  // ============== 初始化 ==============
  function init() {
    // 触屏设备无 hover，不启用
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    const content = document.getElementById('markdownContent');
    if (!content) return;

    content.addEventListener('mouseover', (e) => {
      const link = e.target.closest && e.target.closest('.markdown-body a[href^="#/"]');
      if (!link || link === pinnedForLink) return;
      const href = link.getAttribute('href');
      const path = pathFromHref(href);
      if (!path) return;
      // 与当前文档相同则不预览
      if (path === window.MarkdownPreview.state.currentFilePath) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => showCard(path, link), HOVER_DELAY_MS);
    });

    content.addEventListener('mouseout', (e) => {
      const link = e.target.closest && e.target.closest('.markdown-body a[href^="#/"]');
      if (link && link === pinnedForLink) {
        // 移向卡片本身时保持显示（卡片在 body 上，不在 content 内）
        setTimeout(() => {
          if (cardEl && cardEl.matches(':hover')) return;
          hideCard();
        }, 120);
      }
    });

    window.addEventListener('scroll', hideCard, true);
    window.addEventListener('resize', hideCard);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideCard();
    }, true);
  }

  window.MarkdownPreview.hoverPreview = { init };
})();
