/**
 * stats - 站点统计页（#/stats）
 *
 * 数据全部现成：file-tree.json（文档数/词数/modified 时间/tags）。
 * 内容：
 *   - 总览卡：文档数 / 总字数 / 标签数 / 目录数
 *   - 更新热力图：近一年按 modified 时间聚合（GitHub contributions 风格）
 *   - 标签分布 TOP10（条形）
 *   - 最近更新列表（最近 15 篇，直链文档）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  function walkFiles(items, out) {
    (items || []).forEach(item => {
      if (item.type === 'folder' && item.children) {
        walkFiles(item.children, out);
        out.folders++;
      } else if (item.type === 'file' && /\.(md|txt)$/i.test(item.path)) {
        out.files.push(item);
      }
    });
    return out;
  }

  function virtualRender(lines, title) {
    const markdown = window.MarkdownPreview.markdown;
    if (markdown && markdown.renderVirtualDoc) markdown.renderVirtualDoc(lines.join('\n'), title);
  }

  function openPage() {
    const title = t('stats.title', '站点统计');
    const files = window.MarkdownPreview.state?.fileTreeData;
    const agg = walkFiles(files, { files: [], folders: 0 });

    if (agg.files.length === 0) {
      virtualRender([`# ${title}`, '', `*${t('stats.empty', '文件树尚未加载完成，稍后再试。')}*`], title);
      return;
    }

    const totalWords = agg.files.reduce((a, f) => a + (f.wordCount || 0), 0);
    const tagCount = new Set();
    agg.files.forEach(f => (f.tags || []).forEach(tag => tagCount.add(tag)));

    // 热力图：近 53 周
    const dayMap = new Map();
    agg.files.forEach(f => {
      if (!f.modified) return;
      const d = new Date(f.modified * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) || 0) + 1);
    });
    const today = new Date();
    const cells = [];
    let maxDay = 1;
    for (let i = 52 * 7 + today.getDay(); i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const n = dayMap.get(key) || 0;
      if (n > maxDay) maxDay = n;
      cells.push({ key, n });
    }
    const level = n => (n === 0 ? 0 : n <= Math.ceil(maxDay * 0.25) ? 1 : n <= Math.ceil(maxDay * 0.5) ? 2 : n <= Math.ceil(maxDay * 0.75) ? 3 : 4);

    // 标签分布
    const tagCounts = new Map();
    agg.files.forEach(f => (f.tags || []).forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }));
    const topTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxTag = topTags.length ? topTags[0][1] : 1;

    // 最近更新
    const recent = agg.files.filter(f => f.modified).sort((a, b) => b.modified - a.modified).slice(0, 15);

    virtualRender([`# ${title}`, '', '<div id="statsMount"></div>'], title);

    setTimeout(() => {
      const host = document.getElementById('statsMount');
      if (!host) return;

      const cards = `
        <div class="stats-grid">
          <div class="stats-card"><b>${agg.files.length}</b><span>${esc(t('stats.docs', '文档'))}</span></div>
          <div class="stats-card"><b>${totalWords.toLocaleString()}</b><span>${esc(t('stats.words', '总字数'))}</span></div>
          <div class="stats-card"><b>${tagCount.size}</b><span>${esc(t('stats.tags', '标签'))}</span></div>
          <div class="stats-card"><b>${agg.folders}</b><span>${esc(t('stats.folders', '目录'))}</span></div>
        </div>`;

      const heatmap = `
        <h2 class="stats-sec-title">${esc(t('stats.heatmapTitle', '更新热力图（近一年）'))}</h2>
        <div class="stats-heatmap" role="img" aria-label="${esc(t('stats.heatmapTitle', '更新热力图'))}">
          ${cells.map(c => `<span class="stats-cell" data-level="${level(c.n)}" title="${c.key} · ${c.n}"></span>`).join('')}
        </div>`;

      const tags = topTags.length ? `
        <h2 class="stats-sec-title">${esc(t('stats.topTags', '标签分布'))}</h2>
        ${topTags.map(([tag, n]) => `
          <div class="cheat-row" style="padding:5px 8px">
            <span class="cheat-cmd" style="flex:0 0 130px">${esc(tag)}</span>
            <span class="tr-hop-bar" style="flex:1"><span class="tr-bar-fill" style="width:${Math.max(3, (n / maxTag) * 100)}%"></span></span>
            <span class="cheat-src">${n}</span>
          </div>`).join('')}` : '';

      const recentList = recent.length ? `
        <h2 class="stats-sec-title">${esc(t('stats.recent', '最近更新'))}</h2>
        <ul class="stats-recent-list">
          ${recent.map(f => {
            const d = new Date(f.modified * 1000);
            return `<li><span class="stats-recent-date">${d.toISOString().slice(0, 10)}</span><a href="#/${encodeURI(f.path)}">${esc(f.title || f.path)}</a></li>`;
          }).join('')}
        </ul>` : '';

      // 生成式封面陈列：无图文档的封面由路径哈希确定性生成（gen-cover.js）
      let coverWall = '';
      const gc = window.MarkdownPreview.genCover;
      if (gc && recent.length) {
        coverWall = `
          <h2 class="stats-sec-title">${esc(t('stats.covers', '生成式封面'))}</h2>
          <div class="stats-cover-wall" id="statsCoverWall"></div>`;
      }

      host.innerHTML = cards + heatmap + tags + recentList + coverWall;

      const wall = document.getElementById('statsCoverWall');
      if (wall && gc) {
        recent.slice(0, 8).forEach(f => {
          const card = document.createElement('a');
          card.className = 'stats-cover-card';
          card.href = '#/' + encodeURI(f.path);
          card.title = f.title || f.path;
          card.appendChild(gc.getCoverElement(f.path, 220, 124));
          const cap = document.createElement('span');
          cap.className = 'stats-cover-cap';
          cap.textContent = (f.title || f.path).slice(0, 26);
          card.appendChild(cap);
          wall.appendChild(card);
        });
      }
    }, 300);
  }

  window.addEventListener('langchange', () => {
    if ((window.location.hash || '') === '#/stats') openPage();
  });

  window.MarkdownPreview.stats = { openPage };
})();
