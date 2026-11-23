/**
 * broken-links - 死链报告页（#/broken-links）
 *
 * 数据来自构建期产物 iris/data/link-report.json（link-check.js --report），
 * CI 全量内链校验的明细。与 #/orphan 巡检页互补：orphan 管内容质量，
 * 本页管链接健康。数据缺失（未生成）时给出自检命令指引。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  let cache = null;
  function loadReport() {
    if (cache) return Promise.resolve(cache);
    return fetch('iris/data/link-report.json', { cache: 'no-cache' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { cache = d; return d; })
      .catch(() => null);
  }

  function virtualRender(lines, title) {
    const markdown = window.MarkdownPreview.markdown;
    if (markdown && markdown.renderVirtualDoc) markdown.renderVirtualDoc(lines.join('\n'), title);
  }

  function openPage() {
    const title = t('bl.title', '死链报告');
    loadReport().then(report => {
      if (!report || typeof report.brokenCount !== 'number') {
        virtualRender([
          `# ${title}`,
          '',
          `*${t('bl.noReport', '还没有报告——在仓库根目录运行：')}*`,
          '',
          '```bash',
          'node iris/scripts/link-check.js --report',
          '```'
        ], title);
        return;
      }

      virtualRender([
        `# ${title}`,
        '',
        `> ${t('bl.generated', '校验于 {date} · 共检查 {refs} 个内链引用')}`,
        '',
        '<div id="blMount"></div>'
      ], title);

      setTimeout(() => {
        const host = document.getElementById('blMount');
        if (!host) return;

        if (report.brokenCount === 0) {
          host.innerHTML = `<div class="bl-ok">✓ ${esc(t('bl.allOk', '全部内链有效，没有死链。'))}</div>`;
          return;
        }

        const summary = `
          <div class="bl-summary">
            <span class="bl-stat is-bad"><b>${report.brokenCount}</b>${esc(t('bl.broken', '处失效'))}</span>
            <span class="bl-stat"><b>${report.files.length}</b>${esc(t('bl.filesAffected', '个文档受影响'))}</span>
          </div>`;
        const sections = report.files.map(f => `
          <div class="bl-file">
            <h3 class="bl-file-title">
              <a href="#/${encodeURI(f.file)}">${esc(f.file)}</a>
              <span class="bl-file-count">${f.count}</span>
            </h3>
            <ul class="bl-list">
              ${f.items.map(item => `
                <li>
                  <span class="bl-kind">${esc(item.kind || '')} · L${item.line}</span>
                  <span class="bl-raw">${esc(item.target)}${item.reason ? ` — ${esc(item.reason)}` : ''}</span>
                </li>`).join('')}
            </ul>
          </div>`).join('');
        host.innerHTML = summary + sections;
      }, 300);
    });
  }

  window.addEventListener('langchange', () => {
    if ((window.location.hash || '') === '#/broken-links') openPage();
  });

  window.MarkdownPreview.brokenLinks = { openPage };
})();
