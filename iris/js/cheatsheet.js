/**
 * cheatsheet - 全站速查聚合页（#/cheatsheet · #/cheatsheet/<lang>）
 *
 * 数据来自构建期产物 iris/data/cheatsheet.json（build-cheatsheet.js）：
 * 全站 ```ios / ```vrp / ```bash / ```powershell 等代码块的命令行片段，
 * 按语言分组，每条带源文档锚点直达上下文。
 *
 * 页面能力：
 *   - 顶部分组切换（cisco / huawei / shell …）
 *   - 命令搜索框（子串匹配，即时过滤）
 *   - 片段行：命令 + 来源文档（点击跳 #/docs/x.md 并滚动到源行）
 *   - 每条片段一键复制
 *   - 虚拟路由页（走 renderVirtualDoc 管线：可分享/可收藏/返回键正常）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  let dataCache = null;
  let dataPromise = null;

  function loadData() {
    if (dataCache) return Promise.resolve(dataCache);
    if (dataPromise) return dataPromise;
    dataPromise = fetch('iris/data/cheatsheet.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { dataCache = d; return d; })
      .catch(() => null);
    return dataPromise;
  }

  function virtualRender(lines, title) {
    const markdown = window.MarkdownPreview.markdown;
    if (markdown && markdown.renderVirtualDoc) markdown.renderVirtualDoc(lines.join('\n'), title);
  }

  // ============== 主渲染（虚拟文档内挂交互容器） ==============
  function renderPage(langFilter) {
    loadData().then(data => {
      const title = t('cheat.title', '全站速查');
      if (!data || !data.groups || data.groups.length === 0) {
        virtualRender([
          `# ${title}`,
          '',
          `*${t('cheat.empty', '构建产物 cheatsheet.json 为空——仓库 docs/ 下还没有可聚合的 ios/vrp/bash 代码块，或尚未运行 iris/scripts/build-cheatsheet.js。')}*`
        ], title);
        return;
      }

      const lines = [
        `# ${title}`,
        '',
        `> ${t('cheat.stats', '共 {n} 条命令片段 · {g} 个语言分组 · 构建于 {date}')}`,
        '',
        t('cheat.nav', '分组：') + data.groups.map(g => `[${esc(g.label)}](#/cheatsheet/${g.group})`).join(' · ')
      ];
      virtualRender(lines, title);

      // 虚拟文档渲染完成后挂交互区（等一拍 DOM 就绪）
      setTimeout(() => {
        const host = document.getElementById('markdownContent');
        if (!host || !host.querySelector('.markdown-body')) return;
        let mount = document.getElementById('cheatsheetMount');
        if (!mount) {
          mount = document.createElement('div');
          mount.id = 'cheatsheetMount';
          host.querySelector('.markdown-body').appendChild(mount);
        }
        mount.innerHTML = '';

        const groups = langFilter
          ? data.groups.filter(g => g.group === langFilter)
          : data.groups;
        if (langFilter && groups.length === 0) {
          mount.innerHTML = `<div class="cheat-empty">${esc(t('cheat.unknownGroup', '未知分组'))}：${esc(langFilter)}</div>`;
          return;
        }

        groups.forEach(g => {
          const sec = document.createElement('section');
          sec.className = 'cheat-group';
          const total = g.langs.reduce((a, l) => a + l.count, 0);
          sec.innerHTML = `
            <h2 class="cheat-group-title">${esc(g.label)} <span class="cheat-group-count">${total}</span></h2>
            <div class="cheat-list"></div>
          `;
          const list = sec.querySelector('.cheat-list');
          g.langs.forEach(l => {
            l.snippets.forEach(sn => {
              sn.cmds.forEach(cmd => {
                const row = document.createElement('div');
                row.className = 'cheat-row';
                row.innerHTML = `
                  <code class="cheat-cmd">${esc(cmd)}</code>
                  <button type="button" class="cheat-copy" title="${esc(t('cheat.copy', '复制'))}" aria-label="${esc(t('cheat.copy', '复制'))}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
                  <a class="cheat-src" href="#/${encodeURI(sn.doc)}" title="${esc(sn.title)}">${esc(sn.title)} <span class="cheat-src-line">:${sn.line}</span></a>
                `;
                row.querySelector('.cheat-copy').addEventListener('click', () => {
                  const copy = window.MarkdownPreview.interactions && window.MarkdownPreview.interactions.copyText;
                  const btn = row.querySelector('.cheat-copy');
                  if (copy) copy(cmd).then(() => {
                    btn.classList.add('copied');
                    setTimeout(() => btn.classList.remove('copied'), 1200);
                  });
                });
                list.appendChild(row);
              });
            });
          });
          mount.appendChild(sec);
        });

        // 搜索过滤（整条命令子串匹配，隐藏不命中的行）
        const input = document.createElement('input');
        input.type = 'search';
        input.className = 'cheat-search';
        input.placeholder = t('cheat.searchPlaceholder', '过滤命令…');
        input.setAttribute('aria-label', t('cheat.searchPlaceholder', '过滤命令'));
        let timer = null;
        input.addEventListener('input', () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            const q = input.value.trim().toLowerCase();
            mount.querySelectorAll('.cheat-row').forEach(row => {
              row.hidden = !!q && !row.querySelector('.cheat-cmd').textContent.toLowerCase().includes(q);
            });
          }, 200);
        });
        mount.insertBefore(input, mount.firstChild);
      }, 300);
    });
  }

  // 供 router.js 的虚拟路由分发调用
  function openPage(query) {
    renderPage(query || '');
  }

  window.addEventListener('langchange', () => {
    // 语言切换后重渲染当前页（若正开着）
    const hash = window.location.hash || '';
    const m = /^#\/cheatsheet(?:\/([\w-]+))?/.exec(hash);
    if (m) renderPage(m[1] || '');
  });

  window.MarkdownPreview.cheatsheet = { openPage };
})();
