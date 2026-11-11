/**
 * OpenTelemetry / Jaeger / Zipkin trace 瀑布（C5）
 *
 * Markdown 语法：
 *   ```trace   —— 内联 trace JSON
 *   @[trace](trace.json) —— 嵌入同源 JSON
 *
 * 识别 OTLP（数组 / {resourceSpans}）、Jaeger、Zipkin 三种格式：
 *   - span 瀑布：服务/操作、开始、时长、父子层级、错误红
 *   - 顶部总耗时 / span 数 / 关键路径
 *   - 点击 span 展开 attributes / events / status
 *   - 服务过滤 / 导出 CSV
 *
 * 失败回退 JSON 树 / 源码。
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

  const MAX_SPANS = 1200;

  function toMs(value, unit) {
    if (value == null) return 0;
    // unit: ns / us / ms / s
    switch (unit) {
      case 'ns': return Number(value) / 1e6;
      case 'us': return Number(value) / 1e3;
      case 's': return Number(value) * 1000;
      default: return Number(value);
    }
  }

  function parseTrace(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return null; }

    const spans = [];
    const serviceOf = new Map();

    // ---- OTLP（数组元素须带 startTimeUnixNano，避免误吞 Zipkin 数组）----
    if (Array.isArray(data) && data.some(s => s && s.startTimeUnixNano != null)) {
      data.slice(0, MAX_SPANS).forEach(s => {
        if (!s || s.traceId == null) return;
        const start = toMs(s.startTimeUnixNano, 'ns');
        const end = toMs(s.endTimeUnixNano, 'ns');
        spans.push({
          id: String(s.spanId), parentId: s.parentSpanId != null ? String(s.parentSpanId) : null,
          traceId: String(s.traceId), name: s.name || 'span', service: (s.resource && s.resource.attributes || []).find(a => a.key === 'service.name')?.value?.stringValue || 'service',
          start, duration: Math.max(0, end - start),
          status: s.status && s.status.code, attributes: s.attributes || [], kind: s.kind
        });
      });
    } else if (data && Array.isArray(data.resourceSpans)) {
      data.resourceSpans.forEach(rs => {
        const svc = (rs.resource && rs.resource.attributes || []).find(a => a.key === 'service.name')?.value?.stringValue || 'service';
        (rs.instrumentationLibrarySpans || []).forEach(ils => {
          (ils.spans || []).slice(0, MAX_SPANS).forEach(s => {
            spans.push({
              id: String(s.spanId), parentId: s.parentSpanId != null ? String(s.parentSpanId) : null,
              traceId: String(s.traceId), name: s.name || 'span', service: svc,
              start: toMs(s.startTimeUnixNano, 'ns'), duration: Math.max(0, toMs(s.endTimeUnixNano, 'ns') - toMs(s.startTimeUnixNano, 'ns')),
              status: s.status && s.status.code, attributes: s.attributes || [], kind: s.kind
            });
          });
        });
      });
    } else if (data && Array.isArray(data.data)) {
      // ---- Jaeger ----
      data.data.forEach(trace => {
        const procs = trace.processes || {};
        (trace.spans || []).slice(0, MAX_SPANS).forEach(s => {
          const ref = (s.references || []).find(r => r.refType === 'CHILD') || (s.references && s.references[0]);
          const proc = procs[s.processID] || {};
          spans.push({
            id: String(s.spanID), parentId: ref ? String(ref.spanID) : null,
            traceId: String(trace.traceID), name: s.operationName || 'span',
            service: proc.serviceName || 'service',
            start: toMs(s.startTime, 'us'), duration: toMs(s.duration, 'us'),
            attributes: s.tags || []
          });
        });
      });
    } else if (Array.isArray(data) && data[0] && data[0].traceId !== undefined) {
      // ---- Zipkin ----
      data.slice(0, MAX_SPANS).forEach(s => {
        const tags = (() => { const rt = s.tags || {}; return Array.isArray(rt) ? rt.map(g => ({ key: g.key, value: String(g.value) })) : Object.entries(rt).map(([k, v]) => ({ key: k, value: String(v) })); })();
        spans.push({
          id: String(s.id), parentId: s.parentId != null ? String(s.parentId) : null,
          traceId: String(s.traceId), name: s.name || 'span',
          service: s.localEndpoint ? s.localEndpoint.serviceName : 'service',
          start: toMs(s.timestamp, 'us'), duration: toMs(s.duration, 'us'),
          attributes: tags
        });
      });
    } else {
      return null;
    }

    if (!spans.length) return null;
    return spans;
  }

  function fmtMs(ms) {
    if (ms < 1) return (ms * 1000).toFixed(0) + ' µs';
    if (ms < 1000) return ms.toFixed(ms < 10 ? 2 : 0) + ' ms';
    return (ms / 1000).toFixed(2) + ' s';
  }

  function renderTrace(spans) {
    const minStart = Math.min(...spans.map(s => s.start));
    const maxEnd = Math.max(...spans.map(s => s.start + s.duration));
    const total = Math.max(1, maxEnd - minStart);

    const byId = new Map(spans.map(s => [s.id, s]));
    const children = new Map();
    const roots = [];
    spans.forEach(s => {
      if (s.parentId && byId.has(s.parentId)) {
        if (!children.has(s.parentId)) children.set(s.parentId, []);
        children.get(s.parentId).push(s);
      } else {
        roots.push(s);
      }
    });

    // 关键路径：自底向上取最大子树
    function compute(s) {
      let own = s.duration;
      let best = null;
      (children.get(s.id) || []).forEach(c => {
        const v = compute(c);
        if (v > own) { own = v; best = c; }
      });
      s._total = own;
      s._criticalChild = best;
      return own;
    }
    roots.forEach(s => compute(s));

    // 标记关键路径（从每个根沿最大子节点）
    const critical = new Set();
    function mark(s) {
      critical.add(s.id);
      if (s._criticalChild) mark(s._criticalChild);
    }
    roots.forEach(mark);

    // 预计算缩进深度
    const depth = new Map();
    spans.forEach(s => {
      let d = 0;
      let cur = s;
      while (cur.parentId && byId.has(cur.parentId)) { d++; cur = byId.get(cur.parentId); }
      depth.set(s.id, d);
    });

    const widget = document.createElement('div');
    widget.className = 'trace-view';

    const services = Array.from(new Set(spans.map(s => s.service)));
    const sum = spans.reduce((a, s) => a + s.duration, 0);
    const errors = spans.filter(s => s.status === 2 || s.status === 'ERROR').length;

    widget.innerHTML =
      '<div class="trace-summary">' +
        '<span><b>' + spans.length + '</b> ' + esc(t('trace.spans', 'Span')) + '</span>' +
        '<span><b>' + fmtMs(sum) + '</b> ' + esc(t('trace.duration', '总耗时')) + '</span>' +
        '<span><b>' + errors + '</b> ' + esc(t('trace.errors', '错误')) + '</span>' +
        '<span><b>' + esc(services.join(' · ')) + '</b></span>' +
      '</div>' +
      '<div class="trace-toolbar">' +
        '<select class="trace-filter-service" aria-label="' + esc(t('trace.service', '服务')) + '"><option value="">' + esc(t('trace.service', '服务')) + '</option></select>' +
        '<input type="search" class="trace-search" placeholder="' + esc(t('trace.search', '搜索操作…')) + '" aria-label="' + esc(t('trace.search', '搜索操作')) + '">' +
        '<span class="trace-count" aria-live="polite"></span>' +
        '<button type="button" class="icon-btn trace-export" data-tip="' + esc(t('trace.export', '导出 CSV')) + '" title="' + esc(t('trace.export', '导出 CSV')) + '" aria-label="' + esc(t('trace.export', '导出 CSV')) + '">' +
          icon('i-download', 15) + '<span class="icon-btn-label">' + esc(t('trace.export', '导出 CSV')) + '</span></button>' +
      '</div>';

    const select = widget.querySelector('.trace-filter-service');
    services.forEach(s => { const o = document.createElement('option'); o.value = o.textContent = s; select.appendChild(o); });

    const body = document.createElement('div');
    body.className = 'trace-body';
    widget.appendChild(body);

    const rows = spans.map((s, i) => {
      const row = document.createElement('div');
      row.className = 'trace-row' + (critical.has(s.id) ? ' trace-critical' : '');
      row.dataset.service = s.service;
      row.dataset.name = s.name.toLowerCase();
      row.dataset.i = String(i);
      const pct = (s.duration / total) * 100;
      const offset = ((s.start - minStart) / total) * 100;
      const d = depth.get(s.id) || 0;
      row.innerHTML =
        '<span class="trace-name" style="padding-left:' + (d * 14) + 'px">' + esc(s.name) + '</span>' +
        '<span class="trace-service">' + esc(s.service) + '</span>' +
        '<span class="trace-start">' + esc(fmtMs(s.start - minStart)) + '</span>' +
        '<span class="trace-dur">' + esc(fmtMs(s.duration)) + '</span>' +
        '<span class="trace-track"><span class="trace-bar" style="left:' + offset.toFixed(2) + '%;width:' + Math.max(pct, 0.3).toFixed(2) + '%"></span></span>';
      // OTLP 的 value 可能是 {stringValue} 包装；无属性/状态时不渲染详情
      const attrText = (s.attributes || []).map(a => {
        let v = a.value;
        if (v && typeof v === 'object' && !Array.isArray(v)) v = v.stringValue != null ? v.stringValue : JSON.stringify(v);
        return (a.key || 'key') + ': ' + v;
      }).join('\n');
      if (!attrText && s.status == null) return row; // 无详情也可点（无操作）
      const detail = document.createElement('div');
      detail.className = 'trace-detail';
      detail.hidden = true;
      detail.innerHTML =
        (attrText ? '<div class="trace-detail-section"><h5>' + esc(t('trace.attributes', '属性')) + '</h5><pre>' + esc(attrText) + '</pre></div>' : '') +
        (s.status != null ? '<div class="trace-detail-section"><h5>' + esc(t('trace.status', '状态')) + '</h5><pre>' + esc(String(s.status)) + '</pre></div>' : '');
      row.appendChild(detail);
      row.addEventListener('click', () => { detail.hidden = !detail.hidden; });
      return row;
    });

    rows.forEach(r => { if (r) body.appendChild(r); });

    const countEl = widget.querySelector('.trace-count');
    function update() {
      const q = widget.querySelector('.trace-search').value.trim().toLowerCase();
      const svc = select.value;
      let visible = 0;
      rows.forEach(r => {
        const ok = (!q || r.dataset.name.includes(q)) && (!svc || r.dataset.service === svc);
        r.hidden = !ok;
        if (ok) visible++;
      });
      countEl.textContent = visible === spans.length
        ? t('trace.all', '{n} 条').replace('{n}', visible)
        : t('trace.filtered', '{m} / {n} 条').replace('{m}', visible).replace('{n}', spans.length);
    }
    widget.querySelector('.trace-search').addEventListener('input', update);
    select.addEventListener('change', update);
    widget.querySelector('.trace-export').addEventListener('click', () => {
      const csv = rows.filter(r => !r.hidden).map(r => {
        const span = spans[Number(r.dataset.i)];
        return [span.service, span.name, fmtMs(span.duration), String(span.status != null ? span.status : '')].join(',');
      }).join('\r\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'trace.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    });
    update();
    return widget;
  }

  function renderFence(pre) {
    const spans = parseTrace(pre.querySelector('code')?.textContent || '');
    if (!spans) return;
    pre.replaceWith(renderTrace(spans));
  }

  async function renderEmbed(el, url) {
    let text;
    try {
      const resp = await fetch('/' + url.replace(/^\//, ''));
      if (!resp.ok) { el.replaceWith(traceFallback(url)); return; }
      text = await resp.text();
    } catch (e) { el.replaceWith(traceFallback(url)); return; }
    const spans = parseTrace(text);
    if (!spans) { el.replaceWith(traceFallback(url)); return; }
    el.replaceWith(renderTrace(spans));
  }

  function traceFallback(url) {
    const d = document.createElement('div');
    d.className = 'trace-view trace-fallback';
    d.innerHTML = '<div class="har-error">' + esc(t('trace.fail', '无法解析 trace')) + '</div>' +
      '<a href="/' + esc(url.replace(/^\//, '')) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>';
    return d;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang="trace"]').forEach(pre => {
      if (pre.dataset.traceDone) return;
      pre.dataset.traceDone = '1';
      renderFence(pre);
    });
  }

  window.MarkdownPreview.renderers.trace = { render, renderEmbed, parseTrace, renderTrace };
})();
