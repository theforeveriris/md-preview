/**
 * desktop-kb - 桌面端本地文件夹挂载为知识库
 *
 * 仅在 Tauri 外壳内激活（window.__TAURI_INTERNALS__）：选一个本地目录 →
 * Rust 侧遍历目录树 + 读取文件（src-tauri/src/main.rs 的 pick_folder /
 * read_kb_tree / read_kb_file），前端补齐 frontmatter 标题/标签/词数后
 * 挂进侧边栏文件树——本机个人 wiki 浏览器。
 *
 * 路径约定：知识库文档统一挂 `kb/<相对路径>` 命名空间，与站点文档共用
 * 侧边栏 / 路由 / 上一篇下一篇 / 搜索 / 反链 / 图谱的全套逻辑：
 *   - markdown.loadMarkdownFile 见 `kb/` 前缀时经本模块读取
 *   - search.injectDocuments 用挂载时构建的轻量索引替换站内索引
 *   - backlinks / graph 的 loadLinks 改读本模块扫描出的链接关系
 *   - export-bundle.fetchAllDocs 优先取知识库文档（批量导出复用）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const KB_PREFIX = 'kb/';
  const MAX_DOCS = 2000;        // 与 Rust 侧 KB_MAX_FILES 对齐
  const READ_CONCURRENCY = 12;

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function invoke(cmd, args) {
    const tauri = window.__TAURI__;
    const fn = (tauri && tauri.core && tauri.core.invoke) ||
      (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke);
    if (typeof fn !== 'function') return Promise.reject(new Error('not in tauri'));
    return fn(cmd, args);
  }

  function isDesktop() {
    return !!window.__TAURI_INTERNALS__;
  }

  function isActive() {
    const st = window.MarkdownPreview.state;
    return !!(st && st.desktopKb);
  }

  // ============== 轻量提示（复用收藏反馈的 mini-toast 样式） ==============

  let toastEl = null;
  let toastTimer = null;
  function notify(text, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'mini-toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('open');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('open'), ms || 2200);
  }

  // ============== frontmatter / 元数据 ==============

  function parseFrontmatter(markdown) {
    const fn = window.MarkdownPreview.markdown && window.MarkdownPreview.markdown.parseFrontmatter;
    if (fn) return fn(markdown);
    return { frontmatter: {}, content: markdown };
  }

  function countWords(text) {
    const english = (text.match(/[a-zA-Z]+/g) || []).length;
    const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    return english + cjk;
  }

  // 解析 frontmatter 里的数组值：tags: [a, b] / tags: a,b
  function parseTags(raw) {
    if (!raw) return [];
    let s = String(raw).trim();
    if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
    return s.split(/[,，]/).map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  }

  // ============== 站内链接扫描（反链 / 图谱数据） ==============

  function scanLinks(relPath, text, allSet) {
    const out = {};
    const dir = relPath.split('/').slice(0, -1).join('/');
    const re = /\[[^\]]*\]\(([^)\s]+\.md)(#[^)]*)?\)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      let target = m[1];
      if (/^(https?:)?\/\//i.test(target)) continue;
      let resolved;
      if (target.startsWith('/')) {
        resolved = target.slice(1);
      } else {
        const simplify = window.MarkdownPreview.markdown.simplifyPath ||
          (p => p.replace(/(^|\/)\.\//g, '$1'));
        resolved = simplify((dir ? dir + '/' : '') + target);
      }
      resolved = resolved.replace(/\.md$/i, '.md');
      if (!allSet.has(resolved)) continue;
      out[resolved] = (out[resolved] || 0) + 1;
    }
    return out;
  }

  // ============== 挂载 ==============

  let mounting = false;

  async function readAllDocs(root, treeJson) {
    const files = [];
    (function walk(nodes) {
      (nodes || []).forEach(n => {
        if (n.type === 'folder') walk(n.children);
        else if (n.path) files.push(n);
      });
    })(JSON.parse(treeJson));

    const docs = new Map(); // relPath -> { text, title, tags, words, modified }
    let next = 0;
    async function worker() {
      while (next < files.length) {
        const f = files[next++];
        try {
          const text = await invoke('read_kb_file', { root, path: f.path });
          const { frontmatter, content } = parseFrontmatter(text);
          docs.set(f.path, {
            text,
            title: frontmatter.title || f.name.replace(/\.md$/i, ''),
            tags: parseTags(frontmatter.tags),
            words: countWords(content),
            modified: f.modified || 0
          });
        } catch (e) { /* 单文件失败不阻断挂载 */ }
      }
    }
    await Promise.all(Array.from({ length: Math.min(READ_CONCURRENCY, files.length) }, worker));
    return docs;
  }

  // 把 docs 元数据合并进 Rust 目录树，路径统一加 kb/ 前缀
  function enrichTree(nodes, docs) {
    return nodes.map(node => {
      if (node.type === 'folder') {
        return {
          name: node.name,
          type: 'folder',
          path: KB_PREFIX + node.path,
          children: enrichTree(node.children || [], docs)
        };
      }
      const meta = docs.get(node.path) || {};
      return {
        name: node.name,
        type: 'file',
        path: KB_PREFIX + node.path,
        title: meta.title,
        tags: meta.tags,
        wordCount: meta.words,
        modified: meta.modified
      };
    });
  }

  async function mount() {
    if (!isDesktop()) return;
    if (mounting) return;
    mounting = true;
    try {
      const root = await invoke('pick_folder');
      if (!root) return; // 用户取消
      notify(t('kb.scanning', '正在扫描本地知识库…'));
      const treeJson = await invoke('read_kb_tree', { root });
      const docs = await readAllDocs(root, treeJson);
      if (docs.size === 0) {
        notify(t('kb.empty', '该文件夹下没有找到 Markdown 文档'));
        return;
      }

      const st = window.MarkdownPreview.state;
      st.desktopKb = { root };

      const enriched = enrichTree(JSON.parse(treeJson), docs);
      st.fileTreeData = enriched;
      st.fileTreeSource = 'desktop-kb';
      window.MarkdownPreview.fileTree.renderFileTree(enriched);
      window.dispatchEvent(new CustomEvent('filetreeloaded'));

      // 轻量搜索索引 + 站内链接关系（图谱 / 反链）
      const allSet = new Set(docs.keys());
      const links = {};
      const searchDocs = [];
      docs.forEach((meta, rel) => {
        links[rel] = scanLinks(rel, meta.text, allSet);
        searchDocs.push({
          path: KB_PREFIX + rel,
          title: meta.title,
          preview: meta.text.replace(/```[\s\S]*?```/g, ' ').replace(/[#*`>\[\]!()]/g, ' ').replace(/\s+/g, ' ').slice(0, 160),
          tags: meta.tags
        });
      });
      st.desktopKbDocs = docs;
      st.desktopKbLinks = { generatedAt: new Date().toISOString(), links };

      const search = window.MarkdownPreview.search;
      if (search && search.injectDocuments) search.injectDocuments(searchDocs);

      // 侧边栏展开到第一个文档
      window.MarkdownPreview.fileTree.setSidebarCollapsed(false);
      notify(t('kb.mounted', '本地知识库已挂载：{n} 篇文档').replace('{n}', docs.size));
      updateMenuLabel();
    } catch (e) {
      console.error('[DesktopKB] mount failed:', e);
      notify(t('kb.mountFailed', '挂载失败：{m}').replace('{m}', e.message || e));
    } finally {
      mounting = false;
    }
  }

  async function unmount() {
    const st = window.MarkdownPreview.state;
    if (!st || !st.desktopKb) return;
    delete st.desktopKb;
    delete st.desktopKbDocs;
    delete st.desktopKbLinks;
    // 恢复站内文件树与索引
    try {
      const resp = await fetch('iris/data/file-tree.json');
      if (resp.ok) {
        st.fileTreeData = await resp.json();
        st.fileTreeSource = 'prebuilt';
        window.MarkdownPreview.fileTree.renderFileTree(st.fileTreeData);
        window.dispatchEvent(new CustomEvent('filetreeloaded'));
      }
    } catch (e) { /* 忽略 */ }
    const search = window.MarkdownPreview.search;
    if (search && search.useBuiltinIndex) {
      search.useBuiltinIndex();
      search.buildIndex().catch(() => {});
    }
    notify(t('kb.unmounted', '已卸载本地知识库，恢复站点文档'));
    updateMenuLabel();
  }

  // ============== 读取管线（markdown.js 调用） ==============

  async function readFile(kbPath) {
    const st = window.MarkdownPreview.state;
    if (!st || !st.desktopKb) throw new Error('kb not mounted');
    const rel = kbPath.slice(KB_PREFIX.length);
    const doc = st.desktopKbDocs && st.desktopKbDocs.get(rel);
    if (doc) return doc.text;
    return invoke('read_kb_file', { root: st.desktopKb.root, path: rel });
  }

  function getLinksData() {
    const st = window.MarkdownPreview.state;
    return (st && st.desktopKbLinks) || null;
  }

  // 批量导出用：{path, text}，路径不带 kb/ 前缀以保持目录结构
  function getDocsForExport() {
    const st = window.MarkdownPreview.state;
    if (!st || !st.desktopKbDocs) return [];
    const out = [];
    st.desktopKbDocs.forEach((meta, rel) => {
      out.push({ path: rel, text: meta.text });
    });
    return out;
  }

  // ============== 悬浮球菜单 + 命令面板 ==============

  function updateMenuLabel() {
    const btn = document.getElementById('kbMountBtn');
    if (!btn) return;
    const label = btn.querySelector('.menu-item-label');
    const mounted = isActive();
    if (label) label.textContent = mounted
      ? t('kb.switch', '切换知识库')
      : t('kb.mount', '本地知识库');
    btn.title = mounted ? t('kb.switch', '切换知识库') : t('kb.mount', '本地知识库');
  }

  function setupMenu() {
    const btn = document.getElementById('kbMountBtn');
    if (!btn || btn.dataset.kbInit) return;
    btn.dataset.kbInit = '1';
    btn.style.display = ''; // 仅桌面端显示（index.html 里默认 display:none）
    btn.addEventListener('click', () => {
      if (isActive()) {
        mount(); // 已挂载：重新选择目录即切换
      } else {
        mount();
      }
    });
    updateMenuLabel();
    window.addEventListener('langchange', updateMenuLabel);
  }

  function setupPaletteActions() {
    const palette = window.MarkdownPreview.palette;
    if (!palette || !palette.extraActions) return;
    palette.extraActions.push(
      {
        id: 'kb-mount',
        icon: 'i-list',
        label: t('kb.mount', '本地知识库'),
        group: t('kb.group', '桌面端'),
        run: () => mount()
      },
      {
        id: 'kb-unmount',
        icon: 'i-ban',
        label: t('kb.unmount', '卸载本地知识库'),
        group: t('kb.group', '桌面端'),
        run: () => unmount()
      }
    );
  }

  function init() {
    if (!isDesktop()) return;
    setupMenu();
    setupPaletteActions();
  }

  window.MarkdownPreview.desktopKb = {
    isDesktop,
    isActive,
    mount,
    unmount,
    readFile,
    getLinksData,
    getDocsForExport,
    init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
