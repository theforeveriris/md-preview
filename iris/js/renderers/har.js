/**
 * HAR 瀑布图（C3）
 *
 * Markdown 语法：
 *   ```har   —— 直接内联 HAR JSON
 *   @[har](path.har)  —— 嵌入同源 HAR 文件
 *
 * 渲染：
 *   - 顶部汇总：请求数 / 总大小 / 总耗时 / 失败数
 *   - 每请求一行：方法、URL、状态、类型、大小、总耗时
 *   - 瀑布条按 blocked/dns/connect/ssl/send/wait/receive 分段着色
 *   - 点击行展开 headers / timings / 请求体
 *   - 搜索 + 域名/类型/状态过滤 + 导出 CSV
 *
 * 失败回退：无法解析时显示错误卡片，并保留原始 JSON 树（json-tree）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  // 共享图标构造（dom.js 提供）
  const icon = window.MarkdownPreview.icon || ((name, size) =>
    '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#' + name + '"/></svg>');

  const SEGMENTS = [
    { key: 'blocked', label: 'blocked', color: 'var(--har-blocked)' },
    { key: 'dns', label: 'DNS', color: 'var(--har-dns)' },
    { key: 'connect', label: 'TCP', color: 'var(--har-connect)' },
    { key: 'ssl', label: 'SSL', color: 'var(--har-ssl)' },
    { key: 'send', label: 'Request', color: 'var(--har-send)' },
    { key: 'wait', label: 'Wait', color: 'var(--har-wait)' },
    { key: 'receive', label: 'Download', color: 'var(--har-receive)' }
  ];

  const MAX_ROWS = 1500;

  function parseHar(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return null; }
    const entries = data && data.log && data.log.entries;
    if (!Array.isArray(entries)) return null;
    return entries.slice(0, MAX_ROWS);
  }

  function hostOf(url) {
    try { return new URL(url).host; } catch (e) { return ''; }
  }
  function shortUrl(url) {
    try { const u = new URL(url); return (u.host + u.pathname).slice(0, 90); } catch (e) { return url.slice(0, 90); }
  }
  function fmtSize(bytes) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }
  function fmtMs(ms) {
    if (!ms && ms !== 0) return '—';
    if (ms < 1000) return ms + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }

  function statusClass(status) {
    if (status >= 500) return 'har-status-5xx';
    if (status >= 400) return 'har-status-4xx';
    if (status >= 300) return 'har-status-3xx';
    if (status >= 200) return 'har-status-2xx';
    return 'har-status-err';
  }

  function renderWaterfall(entries) {
    const widget = document.createElement('div');
    widget.className = 'har-view';

    const start = entries.reduce((m, e) => Math.min(m, Date.parse(e.startedDateTime || '') || 0), Infinity);
    let maxTotal = 0;
    entries.forEach(e => { maxTotal = Math.max(maxTotal, e.time || 0); });
    const duration = Math.max(maxTotal, 1);

    const totalSize = entries.reduce((s, e) => s + (e.response && e.response.content && e.response.content.size || 0), 0);
    const totalTime = entries.reduce((s, e) => s + (e.time || 0), 0);
    const failures = entries.filter(e => e.response && e.response.status >= 400).length;

    const summary = document.createElement('div');
    summary.className = 'har-summary';
    summary.innerHTML =
      '<span class="har-sum-item"><b>' + entries.length + '</b> ' + esc(t('har.requests', '请求')) + '</span>' +
      '<span class="har-sum-item"><b>' + fmtSize(totalSize) + '</b> ' + esc(t('har.size', '总大小')) + '</span>' +
      '<span class="har-sum-item"><b>' + fmtMs(totalTime) + '</b> ' + esc(t('har.time', '总耗时')) + '</span>' +
      '<span class="har-sum-item har-sum-fail"><b>' + failures + '</b> ' + esc(t('har.failures', '失败')) + '</span>';
    widget.appendChild(summary);

    const toolbar = document.createElement('div');
    toolbar.className = 'har-toolbar';
    const exportLabel = t('har.export', '导出 CSV');
    toolbar.innerHTML =
      '<label class="har-search"><input type="search" class="har-search-input" placeholder="' + esc(t('har.search', '搜索 URL…')) + '" aria-label="' + esc(t('har.search', '搜索 URL')) + '"></label>' +
      '<select class="har-filter-type" aria-label="' + esc(t('har.filterType', '类型')) + '"><option value="">' + esc(t('har.filterType', '类型')) + '</option></select>' +
      '<select class="har-filter-domain" aria-label="' + esc(t('har.filterDomain', '域名')) + '"><option value="">' + esc(t('har.filterDomain', '域名')) + '</option></select>' +
      '<span class="har-count" aria-live="polite"></span>' +
      '<button type="button" class="icon-btn har-export" data-tip="' + esc(exportLabel) + '" title="' + esc(exportLabel) + '" aria-label="' + esc(exportLabel) + '">' +
        icon('i-download', 15) + '<span class="icon-btn-label">' + esc(exportLabel) + '</span></button>';
    widget.appendChild(toolbar);

    const body = document.createElement('div');
    body.className = 'har-body';

    entries.forEach((entry, i) => {
      const req = entry.request || {};
      const res = entry.response || {};
      const row = document.createElement('div');
      row.className = 'har-row';
      row.dataset.index = String(i);
      const timings = entry.timings || {};
      const segments = SEGMENTS
        .map(s => {
          const v = timings[s.key] != null ? timings[s.key] : 0;
          return { ...s, value: v, pct: duration ? (v / duration) * 100 : 0 };
        })
        .filter(s => s.value > 0);

      row.innerHTML =
        '<span class="har-method">' + esc(req.method || '?') + '</span>' +
        '<span class="har-url" title="' + esc(req.url || '') + '">' + esc(shortUrl(req.url || '')) + '</span>' +
        '<span class="har-status ' + statusClass(res.status || 0) + '">' + esc(res.status || '—') + '</span>' +
        '<span class="har-type">' + esc(entry._resourceType || req.resourceType || '') + '</span>' +
        '<span class="har-size">' + esc(fmtSize(res.content && res.content.size)) + '</span>' +
        '<span class="har-time">' + esc(fmtMs(entry.time)) + '</span>' +
        '<span class="har-bar" title="' + esc(t('har.waterfall', '请求瀑布')) + '"></span>';
      const bar = row.querySelector('.har-bar');
      segments.forEach(s => {
        const seg = document.createElement('span');
        seg.className = 'har-seg har-seg-' + s.key;
        seg.style.flexBasis = s.pct + '%';
        seg.title = s.label + ': ' + s.value + 'ms';
        bar.appendChild(seg);
      });
      if (!segments.length) bar.style.visibility = 'hidden';

      const detail = document.createElement('div');
      detail.className = 'har-detail';
      detail.innerHTML =
        '<div class="har-detail-section"><h5>' + esc(t('har.requestHeaders', '请求头')) + '</h5><pre class="har-pre"></pre></div>' +
        '<div class="har-detail-section"><h5>' + esc(t('har.responseHeaders', '响应头')) + '</h5><pre class="har-pre"></pre></div>' +
        '<div class="har-detail-section"><h5>' + esc(t('har.timings', '分段计时')) + '</h5><pre class="har-pre"></pre></div>';
      const reqH = req.headers ? req.headers.map(h => h.name + ': ' + h.value).join('\n') : '';
      const resH = res.headers ? res.headers.map(h => h.name + ': ' + h.value).join('\n') : '';
      detail.querySelectorAll('.har-pre')[0].textContent = reqH || '—';
      detail.querySelectorAll('.har-pre')[1].textContent = resH || '—';
      const segLines = SEGMENTS.map(s => {
        const v = timings[s.key] != null ? timings[s.key] : 0;
        return s.label + ': ' + v + 'ms';
      }).join('\n');
      detail.querySelectorAll('.har-pre')[2].textContent = segLines;
      detail.hidden = true;
      row.appendChild(detail);

      row.addEventListener('click', (e) => {
        if (e.target.closest('.har-bar')) return;
        detail.hidden = !detail.hidden;
      });
      body.appendChild(row);
    });
    widget.appendChild(body);
    return { widget, entries };
  }

  function applyFilters(widget, entries) {
    const search = widget.querySelector('.har-search-input');
    const typeSel = widget.querySelector('.har-filter-type');
    const domainSel = widget.querySelector('.har-filter-domain');
    const countEl = widget.querySelector('.har-count');
    const rows = Array.from(widget.querySelectorAll('.har-row'));

    const types = Array.from(new Set(entries.map(e => e._resourceType || e.request?.resourceType || '').filter(Boolean)));
    types.forEach(tp => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = tp;
      typeSel.appendChild(opt);
    });
    const domains = Array.from(new Set(entries.map(e => hostOf(e.request && e.request.url)).filter(Boolean)));
    domains.forEach(d => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = d;
      domainSel.appendChild(opt);
    });

    function update() {
      const q = search.value.trim().toLowerCase();
      const tF = typeSel.value;
      const dF = domainSel.value;
      let visible = 0;
      rows.forEach(row => {
        const idx = Number(row.dataset.index);
        const e = entries[idx];
        const url = (e.request && e.request.url || '').toLowerCase();
        const ok = (!q || url.includes(q)) &&
          (!tF || (e._resourceType || '') === tF) &&
          (!dF || hostOf(e.request && e.request.url) === dF);
        row.hidden = !ok;
        if (ok) visible++;
      });
      countEl.textContent = visible === entries.length
        ? t('har.all', '{n} 条').replace('{n}', visible)
        : t('har.filtered', '{m} / {n} 条').replace('{m}', visible).replace('{n}', entries.length);
    }
    search.addEventListener('input', update);
    typeSel.addEventListener('change', update);
    domainSel.addEventListener('change', update);
    widget.querySelector('.har-export').addEventListener('click', () => {
      const out = rows.filter(r => !r.hidden).map(r => {
        const e = entries[Number(r.dataset.index)];
        return [e.request.method, e.request.url, e.response.status, e._resourceType || '', fmtSize(e.response.content && e.response.content.size), String(e.time || 0)];
      });
      const csv = out.map(r => r.map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\r\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'har.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    });
    update();
  }

  function renderFence(pre) {
    const text = pre.querySelector('code')?.textContent || '';
    const entries = parseHar(text);
    if (!entries) return;
    const { widget } = renderWaterfall(entries);
    pre.replaceWith(widget);
    applyFilters(widget, entries);
  }

  async function renderEmbed(el, url) {
    let text;
    try {
      const resp = await fetch('/' + url.replace(/^\//, ''));
      if (!resp.ok) { el.replaceWith(harFallback(url)); return; }
      text = await resp.text();
    } catch (e) { el.replaceWith(harFallback(url)); return; }
    const entries = parseHar(text);
    if (!entries) { el.replaceWith(harFallback(url)); return; }
    const { widget } = renderWaterfall(entries);
    el.replaceWith(widget);
    applyFilters(widget, entries);
  }

  function harFallback(url) {
    const d = document.createElement('div');
    d.className = 'har-view har-fallback';
    d.innerHTML = '<div class="har-error">' + esc(t('har.fail', '无法解析 HAR 文件')) + '</div>' +
      '<a href="/' + esc(url.replace(/^\//, '')) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>';
    return d;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang="har"]').forEach(pre => {
      if (pre.dataset.harDone) return;
      pre.dataset.harDone = '1';
      renderFence(pre);
    });
  }

  window.MarkdownPreview.renderers.har = { render, renderEmbed };
})();
