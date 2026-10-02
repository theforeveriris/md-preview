/**
 * split-view - 双栏对照阅读
 *
 * 同屏左右两篇文档对照阅读（原文 + 译文 / 配置 + 说明），支持两栏比例
 * 同步滚动。悬浮球菜单「对照阅读」或 Ctrl/⌘+\ 进入，Esc 退出；
 * Ctrl/⌘+Alt+S 随时开关本次会话的同步滚动（默认值取设置面板
 * 「对照阅读默认同步滚动」，settings.splitSyncScroll）。
 * 左栏为当前文档，右栏通过内置选择器挑一篇站点文档（也支持右栏点站内
 * 链接跟读）。本地文件会话文档暂不参与对照。
 *
 * 沉浸式：无顶部工具条，状态反馈走 mini-toast。
 *
 * 渲染：与编辑器 Cell 同管线——mdRender.parseMarkdown + 画廊/轮播/代码
 * 高亮/代码 Tabs + 各渲染器（全局扫描、已处理元素幂等跳过）。
 * 不走主渲染管线（不写 dom.markdownContent、不更新路由/历史/阅读位置）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  let overlay = null;
  let leftBody = null, rightBody = null, leftTitle = null, rightTitle = null;
  let picker = null, pickerInput = null, pickerList = null;
  let rightPath = '';
  let syncing = false;
  let syncEnabled = true;
  let toastEl = null, toastTimer = 0;

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

  function isOpen() { return !!(overlay && overlay.classList.contains('open')); }

  // mini-toast 反馈（同 history.js 模式，样式见 enhancements.css）
  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'mini-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('open');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('open'), 1800);
  }

  // 与 markdown.js interceptLinks / simplifyPath 同语义的相对路径解析
  function resolvePath(fromDoc, rel) {
    const dir = fromDoc.includes('/') ? fromDoc.slice(0, fromDoc.lastIndexOf('/') + 1) : '';
    const parts = [];
    for (const seg of (dir + rel).split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.' && seg !== '') parts.push(seg);
    }
    return parts.join('/');
  }

  // frontmatter / 首个 H1 提取标题（与 build-file-tree.js 规则一致）
  function extractTitle(md, fallback) {
    const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (fm) {
      const line = fm[1].split('\n').find(l => l.trim().startsWith('title:'));
      if (line) {
        const v = line.trim().replace(/^title:\s*/, '').trim().replace(/^["']|["']$/g, '');
        if (v) return v;
      }
    }
    const body = fm ? md.slice(fm[0].length) : md;
    const h1 = body.match(/^#\s+(.+?)\s*$/m);
    return h1 ? h1[1].trim() : fallback;
  }

  function slugify(text) {
    return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
  }

  // 正文内图片相对路径 → 站点根路径（与主渲染管线 processImages 同语义）
  function fixImagePaths(container, docPath) {
    container.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (/^(https?:|data:|#|\/)/i.test(src)) return;
      let resolved = resolvePath(docPath, src);
      try { resolved = encodeURI(decodeURIComponent(resolved)); } catch (e) { /* 保留原样 */ }
      img.setAttribute('src', resolved);
    });
  }

  // 站内 .md 链接在本栏内跟读；同文档锚点在栏内滚动；外链新标签
  function interceptLinks(container, docPath, load) {
    container.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        return;
      }
      if (href.startsWith('#')) {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          const target = container.querySelector(':scope > #' + CSS.escape(href.slice(1)) + ', [id="' + CSS.escape(href.slice(1)) + '"]');
          if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
        });
        return;
      }
      const mdMatch = href.match(/^([^#]*\.md)(#.*)?$/);
      if (!mdMatch) return;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        load(resolvePath(docPath, mdMatch[1]));
      });
    });
  }

  // 与 editor.js renderCellMarkdown 相同的渲染器编排（全局扫描，幂等）
  function runRenderers(container) {
    setTimeout(() => {
      const renderers = window.MarkdownPreview && window.MarkdownPreview.renderers;
      const run = (fn) => {
        if (!fn) return;
        try {
          const p = fn();
          if (p && typeof p.catch === 'function') p.catch(() => { /* 渲染器自容错 */ });
        } catch (e) { /* 同上 */ }
      };
      if (renderers) {
        run(renderers.mermaid && renderers.mermaid.render);
        run(renderers.apexcharts && renderers.apexcharts.render);
        run(renderers.diff && renderers.diff.render);
        run(renderers.katex && renderers.katex.render);
        run(renderers.plantuml && renderers.plantuml.render);
        run(() => renderers.embedded && renderers.embedded.render(container));
      }
    }, 150);
  }

  async function renderInto(bodyEl, titleEl, path) {
    const resp = await fetch(path, { cache: 'no-cache' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const md = await resp.text();

    const fm = md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const body = fm ? md.slice(fm[0].length) : md;
    titleEl.textContent = extractTitle(md, path.replace(/\.md$/i, '').split('/').pop());
    titleEl.title = path;

    const mdRender = window.MarkdownPreview.mdRender;
    const { html } = mdRender.parseMarkdown(body);
    bodyEl.innerHTML = html;
    mdRender.groupGalleries(bodyEl);
    mdRender.initSliders(bodyEl);
    mdRender.highlightCodeBlocks(bodyEl);
    mdRender.initCodeTabs(bodyEl);

    // 标题 id（与 markdown.js:354 同规则），供锚点链接跳转
    bodyEl.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      h.id = slugify(h.textContent);
    });

    fixImagePaths(bodyEl, path);
    interceptLinks(bodyEl, path, (target) => renderInto(bodyEl, titleEl, target).catch(showLoadError));
    runRenderers(bodyEl);
  }

  function showLoadError(e) {
    console.warn('[split-view] 文档加载失败:', e);
    const mdRender = window.MarkdownPreview.mdRender;
    rightBody.innerHTML = `<p style="color:var(--color-text-muted)">${esc(t('split.loadFailed', '文档加载失败，请重试'))}</p>`;
    if (mdRender) mdRender.highlightCodeBlocks(rightBody);
  }

  // ============== 右栏文档选择器 ==============

  function openPicker() {
    if (!picker) return;
    const fileTree = window.MarkdownPreview.fileTree;
    const files = (fileTree && fileTree.getAllFilesInDFSOrder) ? fileTree.getAllFilesInDFSOrder() : [];
    renderPickerList(files, '');
    pickerInput.value = '';
    picker.classList.add('open');
    pickerInput.focus();
  }

  function closePicker() {
    if (picker) picker.classList.remove('open');
  }

  function renderPickerList(files, keyword) {
    const kw = keyword.trim().toLowerCase();
    const filtered = files.filter(f => !kw || f.path.toLowerCase().includes(kw) || f.name.toLowerCase().includes(kw));
    const docIcon = '<svg class="split-picker-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
    pickerList.innerHTML = filtered.slice(0, 300).map(f => {
      // 单行布局：文档名居左，所属目录居右（根目录文档不显示目录段）
      const dir = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '';
      return `<li><button type="button" data-path="${esc(f.path)}">${docIcon}` +
        `<span class="split-picker-name">${esc(f.name)}</span>` +
        (dir ? `<span class="split-picker-path">${esc(dir)}</span>` : '') +
        `</button></li>`;
    }).join('') || `<li class="split-picker-empty">${esc(t('split.pickerEmpty', '没有匹配的文档'))}</li>`;
  }

  // ============== 开关 ==============

  function open() {
    const { state, settings } = window.MarkdownPreview;
    const currentPath = state.currentFilePath;
    if (!currentPath) {
      // 本地文件会话没有站点路径，暂不支持对照
      if (state.localDoc) { alert(t('split.localUnsupported', '对照阅读暂不支持本地文件会话，请先打开站点文档')); return; }
      alert(t('split.needDoc', '请先打开一个文档'));
      return;
    }
    // 本次会话的同步开关取设置默认值
    if (settings && settings.load) syncEnabled = settings.load().splitSyncScroll !== false;
    ensure();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('split-view-mode');

    renderInto(leftBody, leftTitle, currentPath).catch(showLoadError);
    if (rightPath) {
      renderInto(rightBody, rightTitle, rightPath).catch(showLoadError);
    } else {
      rightTitle.textContent = t('split.rightEmpty', '右栏未选择');
      rightBody.innerHTML = `
        <div class="split-pane-empty">
          <button type="button" id="splitPaneEmptyPick">${esc(t('split.pickDoc', '选择右栏文档'))}</button>
        </div>`;
      rightBody.querySelector('#splitPaneEmptyPick').addEventListener('click', openPicker);
    }
    // 左栏滚动时右栏跟随（反之亦然）
  }

  function close() {
    if (!overlay || !isOpen()) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('split-view-mode');
    leftBody.innerHTML = '';
    rightBody.innerHTML = '';
    closePicker();
    // 右栏渲染产生的拓扑实例随 DOM 移除成为孤儿，统一清理
    if (window.MarkdownPreview.pkt && window.MarkdownPreview.pkt.destroyOrphaned) {
      window.MarkdownPreview.pkt.destroyOrphaned();
    }
  }

  function bindSyncScroll() {
    const bind = (src, dst) => {
      src.addEventListener('scroll', () => {
        if (syncing || !syncEnabled) return;
        syncing = true;
        const maxSrc = src.scrollHeight - src.clientHeight;
        const maxDst = dst.scrollHeight - dst.clientHeight;
        if (maxSrc > 0 && maxDst > 0) dst.scrollTop = (src.scrollTop / maxSrc) * maxDst;
        // 不用 rAF：后台标签页 rAF 不触发会永久卡住同步守卫
        setTimeout(() => { syncing = false; }, 50);
      });
    };
    bind(leftBody, rightBody);
    bind(rightBody, leftBody);
  }

  function ensure() {
    if (overlay) return;
    overlay = document.getElementById('splitViewOverlay');
    if (!overlay) return;
    leftBody = document.getElementById('splitPaneLeftBody');
    rightBody = document.getElementById('splitPaneRightBody');
    leftTitle = document.getElementById('splitPaneLeftTitle');
    rightTitle = document.getElementById('splitPaneRightTitle');
    picker = document.getElementById('splitPicker');
    pickerInput = document.getElementById('splitPickerInput');
    pickerList = document.getElementById('splitPickerList');

    document.getElementById('splitPaneChangeBtn').addEventListener('click', openPicker);
    document.getElementById('splitPickerCloseBtn').addEventListener('click', closePicker);
    picker.addEventListener('click', (e) => { if (e.target === picker) closePicker(); });
    pickerInput.addEventListener('input', () => {
      const fileTree = window.MarkdownPreview.fileTree;
      const files = (fileTree && fileTree.getAllFilesInDFSOrder) ? fileTree.getAllFilesInDFSOrder() : [];
      renderPickerList(files, pickerInput.value);
    });
    pickerList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-path]');
      if (!btn) return;
      closePicker();
      rightPath = btn.dataset.path;
      renderInto(rightBody, rightTitle, rightPath).catch(showLoadError);
    });

    bindSyncScroll();

    // 悬浮球菜单入口（与 backToTopBtn 同款收回方式：直接移除展开类）
    const menuBtn = document.getElementById('splitViewBtn');
    menuBtn && menuBtn.addEventListener('click', () => {
      const menuItems = document.querySelector('.menu-items');
      const menuTrigger = document.getElementById('menuTrigger');
      menuItems && menuItems.classList.remove('open');
      menuTrigger && menuTrigger.classList.remove('active');
      open();
    });
  }

  // 同步滚动开关（Ctrl/⌘+Alt+S）：只影响本次会话，默认值来自设置面板
  function toggleSync() {
    if (!isOpen()) return;
    setSyncEnabled(!syncEnabled);
  }

  function setSyncEnabled(v) {
    syncEnabled = !!v;
    showToast(syncEnabled ? t('split.syncOn', '同步滚动：开') : t('split.syncOff', '同步滚动：关'));
  }

  function isSyncEnabled() { return syncEnabled; }

  function init() {
    ensure();
  }

  window.MarkdownPreview.splitView = { open, close, toggle: open, isOpen, init, toggleSync, setSyncEnabled, isSyncEnabled };
})();
