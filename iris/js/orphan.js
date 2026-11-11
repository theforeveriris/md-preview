/**
 * orphan - 孤立文档检测页（#/orphan）
 *
 * 知识库巡检：无反链 / 无标签 / 超短（<100 词）/ 长期未更新（>1 年）四类
 * 「空洞文档」清单，数据全部现成——links.json（图谱关系）+ file-tree.json
 * （tags / wordCount / modified），运行时纯前端计算。
 *
 * 进入方式：命令面板「孤立文档检测」或 hash 直达 #/orphan。
 * 数据缺失（运行时回退路径无 links.json / 无 wordCount）时对应维度自动跳过。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const LINKS_URL = 'iris/data/links.json';
  const SHORT_WORDS = 100;
  const STALE_DAYS = 365;

  let linksCache = null;
  function loadLinks() {
    if (linksCache) return Promise.resolve(linksCache);
    return fetch(LINKS_URL, { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { linksCache = d; return d; })
      .catch(() => null);
  }

  function walkFiles(items, out) {
    (items || []).forEach(item => {
      if (item.type === 'folder' && item.children) walkFiles(item.children, out);
      else if (item.type === 'file' && item.path && item.path.endsWith('.md')) out.push(item);
    });
    return out;
  }

  // links.json.links: { 源路径: { 目标路径: 次数 } } → 反演入链数
  function buildInbound(links) {
    const inbound = new Map();
    if (!links) return inbound;
    Object.entries(links).forEach(([src, targets]) => {
      Object.keys(targets || {}).forEach(dst => {
        inbound.set(dst, (inbound.get(dst) || 0) + 1);
      });
    });
    return inbound;
  }

  // 标题图标走内置 SVG sprite，避免在 Markdown 里堆 emoji
  const headingIcon = (id) => `<svg class="ico orphan-heading-icon" aria-hidden="true"><use href="#${id}"/></svg>`;

  function section(lines, title, docs, emptyText, note) {
    lines.push(`## ${title} (${docs.length})`);
    lines.push('');
    if (note) { lines.push(`> ${note}`); lines.push(''); }
    if (docs.length === 0) {
      lines.push(`*${emptyText}*`);
      lines.push('');
      return;
    }
    docs.forEach(doc => {
      lines.push(`- [${doc.title}](#/${encodeURI(doc.path)})`);
      const meta = [];
      if (doc.path) meta.push(`\`${doc.path}\``);
      if (doc.meta) meta.push(doc.meta);
      lines.push('  ' + meta.join(' · '));
    });
    lines.push('');
  }

  function daysSince(modifiedSec) {
    if (!modifiedSec) return null;
    return Math.floor((Date.now() - modifiedSec * 1000) / 86400000);
  }

  function openOrphanPage() {
    const st = window.MarkdownPreview.state;
    if (!st || !Array.isArray(st.fileTreeData)) return;
    const files = walkFiles(st.fileTreeData, []);

    loadLinks().then(links => {
      const inbound = buildInbound(links && links.links);
      const hasLinks = !!(links && links.links);

      const noBacklink = [];
      const noTags = [];
      const tooShort = [];
      const stale = [];

      files.forEach(f => {
        const title = f.title || String(f.name || '').replace(/\.md$/i, '');
        const days = daysSince(f.modified);
        if (hasLinks && !(inbound.get(f.path) > 0)) {
          noBacklink.push({ path: f.path, title, meta: days != null ? t('orphan.lastUpdated', '更新于 {n} 天前').replace('{n}', days) : '' });
        }
        if (!Array.isArray(f.tags) || f.tags.length === 0) {
          noTags.push({ path: f.path, title });
        }
        if (typeof f.wordCount === 'number' && f.wordCount < SHORT_WORDS) {
          tooShort.push({ path: f.path, title, meta: t('orphan.words', '{n} 词').replace('{n}', f.wordCount) });
        }
        if (days != null && days > STALE_DAYS) {
          stale.push({ path: f.path, title, meta: t('orphan.lastUpdated', '更新于 {n} 天前').replace('{n}', days) });
        }
      });

      const lines = [];
      lines.push(`# ${t('orphan.pageTitle', '孤立文档检测')}`);
      lines.push('');
      lines.push(`> ${t('orphan.intro', '四类「空洞文档」巡检：无反链 / 无标签 / 超短 / 长期未更新。补上链接、标签或内容，让知识库没有孤岛。')}`);
      lines.push('');
      section(lines,
        `${headingIcon('i-link')} ${t('orphan.noBacklink', '无反向链接')}`,
        noBacklink,
        t('orphan.noBacklinkEmpty', '每篇文档都有人引用，很健康'),
        t('orphan.noBacklinkNote', '这些文档没有被站内任何一篇引用——新读者顺链接浏览时永远不会遇到它们'));
      section(lines,
        `${headingIcon('i-tag')} ${t('orphan.noTags', '无标签')}`,
        noTags,
        t('orphan.noTagsEmpty', '全部文档都有标签'));
      section(lines,
        `${headingIcon('i-scissors')} ${t('orphan.tooShort', '超短文档（<100 词）')}`,
        tooShort,
        t('orphan.tooShortEmpty', '没有超短文档'),
        t('orphan.tooShortNote', '可能是占位文件或没写完，考虑扩充或合并'));
      section(lines,
        `${headingIcon('i-clock')} ${t('orphan.stale', '长期未更新（>1 年）')}`,
        stale,
        t('orphan.staleEmpty', '最近一年内全部文档都有更新'),
        t('orphan.staleNote', '内容可能已过时，适合复查一轮'));

      const { markdown } = window.MarkdownPreview;
      if (markdown && markdown.renderVirtualDoc) {
        markdown.renderVirtualDoc(lines.join('\n'), t('orphan.pageTitle', '孤立文档检测'));
      }
    });
  }

  window.MarkdownPreview.orphan = { openOrphanPage };
})();
