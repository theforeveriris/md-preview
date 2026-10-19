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
 *
 * 同卡片复用：脚注悬浮预览（FOOTNOTE-1）
 *   - 悬停 / 键盘聚焦正文里的脚注角标（href="#footnote-x"）时，浮出脚注原文卡片
 *   - 卡片内容同样为纯文本；超长内容由 CSS 截断到 4 行
 *   - 点击卡片跳转到脚注所在位置
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
  let cardMode = 'doc';     // 'doc' = 文档摘要卡片，'footnote' = 脚注预览卡片
  let footnoteTarget = null; // 脚注模式下的目标节点（<li id="footnote-x">）

  // i18n 文案统一走 i18n.js 的权威实现（MarkdownPreview.t，全站唯一，避免多处包装漂移）
  const t = window.MarkdownPreview.t;

  // HTML 转义统一走 md-render.js 的权威实现（全站唯一，避免多处副本漂移）
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

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
      // 脚注卡片：点击跳到脚注原文所在位置
      if (cardMode === 'footnote') {
        const target = footnoteTarget;
        hideCard();
        if (target && target.scrollIntoView) {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        return;
      }
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
    if (cardEl) {
      cardEl.classList.remove('open');
      cardEl.classList.remove('is-footnote');
    }
    pinnedForLink = null;
    footnoteTarget = null;
  }

  function showCard(path, linkEl) {
    const card = ensureCard();
    cardMode = 'doc';
    footnoteTarget = null;
    currentPath = path;
    pinnedForLink = linkEl;
    card.classList.remove('is-footnote');
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

  // ============== 脚注悬浮预览（FOOTNOTE-1） ==============
  // 复用同一张卡片。脚注角标与目标由 marked-footnote 生成，前缀来自 markdown.js 的
  // prefixId（当前为 `fn-`），因此不硬编码前缀：判定标准是「href 指向 .footnotes 里的 li」。
  function footnoteTargetOf(href) {
    if (typeof href !== 'string' || href.charAt(0) !== '#' || href.length < 2) return null;
    const id = href.slice(1);
    let el = document.getElementById(id);
    if (!el) {
      try { el = document.getElementById(decodeURIComponent(id)); } catch (e) { /* 保留 null */ }
    }
    if (!el) return null;
    const section = el.closest && el.closest('.footnotes, [data-footnotes]');
    if (!section || el.tagName !== 'LI') return null;
    return { el, label: footnoteLabelOf(el) };
  }

  // 角标序号：取 li 的 id 尾段（fn-tz → tz），纯数字时直接用
  function footnoteLabelOf(li) {
    const id = li.id || '';
    const dash = id.lastIndexOf('-');
    return dash >= 0 ? id.slice(dash + 1) : id;
  }

  // 脚注正文：克隆目标 <li> 后剥掉回链（↩ 返回引用），只保留纯文本
  function footnoteText(targetEl) {
    if (!targetEl) return '';
    const clone = targetEl.cloneNode(true);
    clone.querySelectorAll('a[data-footnote-backref], a[href^="#fn-ref-"], a[href*="-ref-"]').forEach(a => a.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function showFootnoteCard(linkEl, targetEl, label) {
    const text = footnoteText(targetEl);
    if (!text) { hideCard(); return; }
    const card = ensureCard();
    cardMode = 'footnote';
    currentPath = null;
    footnoteTarget = targetEl;
    pinnedForLink = linkEl;
    card.innerHTML = `
      <div class="hover-preview-title"></div>
      <div class="hover-preview-excerpt"></div>
      <div class="hover-preview-meta"></div>
    `;
    card.querySelector('.hover-preview-title').textContent =
      t('footnote.cardTitle', '脚注') + (label ? ' ' + label : '');
    card.querySelector('.hover-preview-excerpt').textContent = text;
    card.querySelector('.hover-preview-meta').textContent = t('footnote.jump', '跳转到脚注');
    card.classList.add('is-footnote');   // 超长内容由 CSS 截断到 4 行
    positionCard(linkEl);
    card.classList.add('open');
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
      const el = e.target;
      if (!el || !el.closest) return;

      // 脚注角标：浮出脚注原文卡片
      const fnLink = el.closest('.markdown-body a[href^="#"]');
      const fnTarget = fnLink ? footnoteTargetOf(fnLink.getAttribute('href')) : null;
      if (fnTarget) {
        if (fnLink === pinnedForLink) return;
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => showFootnoteCard(fnLink, fnTarget.el, fnTarget.label), HOVER_DELAY_MS);
        return;
      }

      const link = el.closest('.markdown-body a[href^="#/"]');
      if (!link || link === pinnedForLink) return;
      const href = link.getAttribute('href');
      const path = pathFromHref(href);
      if (!path) return;
      // 与当前文档相同则不预览
      if (path === window.MarkdownPreview.state.currentFilePath) return;
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => showCard(path, link), HOVER_DELAY_MS);
    });

    // 键盘可达：Tab 聚焦到脚注角标即刻浮出（不等延迟）
    content.addEventListener('focusin', (e) => {
      const fnLink = e.target.closest && e.target.closest('.markdown-body a[href^="#"]');
      const fnTarget = fnLink ? footnoteTargetOf(fnLink.getAttribute('href')) : null;
      if (!fnTarget) return;
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      showFootnoteCard(fnLink, fnTarget.el, fnTarget.label);
    });

    content.addEventListener('mouseout', (e) => {
      const el = e.target;
      if (!el || !el.closest) return;
      const link = el.closest('.markdown-body a[href^="#/"], .markdown-body a[href^="#"]');
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
