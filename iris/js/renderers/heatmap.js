/**
 * heatmap - 日历热图块渲染器
 *
 * Markdown 语法：```heatmap，正文 `YYYY-MM-DD,数值` 每行一条（可带注释
 * 行与空行）。渲染 GitHub 贡献图样式的日历热图：列为周、行为星期，
 * 强度按最大值分 5 档（0 为空格色），悬停显示日期与数值——
 * 巡检记录、值班统计、健身打卡之类自带数据的一图流。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function parseData(text) {
    const out = [];
    String(text || '').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return;
      const m = /^(\d{4})-(\d{2})-(\d{2})\s*[,\t]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(trimmed);
      if (!m) return;
      const date = new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00');
      if (isNaN(date)) return;
      out.push({ date, value: parseFloat(m[4]) });
    });
    return out;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      if (lang !== 'heatmap') return;
      const data = parseData(pre.querySelector('code')?.textContent ?? '');
      if (data.length === 0) return;

      const max = Math.max(...data.map(d => d.value), 1);
      const byDay = new Map(data.map(d => [d.date.toISOString().slice(0, 10), d.value]));

      // 日历网格：从最早日期所在周的周日起排
      const first = data.reduce((a, b) => (a.date < b.date ? a : b));
      const last = data.reduce((a, b) => (a.date > b.date ? a : b));
      const start = new Date(first.date);
      start.setDate(start.getDate() - start.getDay()); // 回到周日
      const end = new Date(last.date);
      end.setDate(end.getDate() + (6 - end.getDay()));

      const weeks = [];
      const cursor = new Date(start);
      while (cursor <= end) {
        const week = [];
        for (let i = 0; i < 7; i++) {
          const iso = cursor.toISOString().slice(0, 10);
          week.push({
            iso,
            day: cursor.getDate(),
            month: cursor.getMonth(),
            inRange: cursor >= first.date && cursor <= last.date,
            value: byDay.get(iso)
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
      }

      function levelOf(v) {
        if (v == null || v <= 0) return 0;
        const ratio = v / max;
        if (ratio <= 0.25) return 1;
        if (ratio <= 0.5) return 2;
        if (ratio <= 0.75) return 3;
        return 4;
      }

      const monthLabels = [];
      let lastMonth = -1;
      weeks.forEach((week, wi) => {
        const firstDay = week.find(d => d.inRange) || week[0];
        if (firstDay.month !== lastMonth) {
          lastMonth = firstDay.month;
          monthLabels.push(`<span class="hm-month" style="grid-column:${wi + 1}">${firstDay.month + 1}</span>`);
        }
      });

      const cells = weeks.map(week => `<div class="hm-week">${week.map(d => {
        const lv = levelOf(d.value);
        const tip = d.value != null ? `${d.iso} · ${d.value}` : d.iso;
        return `<span class="hm-cell hm-l${lv}" title="${esc(tip)}"></span>`;
      }).join('')}</div>`).join('');

      const weekdayLabels = [t('hm.sun', '日'), t('hm.mon', '一'), t('hm.wed', '三'), t('hm.fri', '五')]
        .map((l, i) => `<span class="hm-wday" style="grid-row:${[1, 2, 4, 6][i]}">${esc(l)}</span>`).join('');

      const widget = document.createElement('div');
      widget.className = 'hm-widget';
      widget.innerHTML = `
        <div class="hm-head">
          <span class="hm-title">${esc(t('hm.title', '日历热图'))}</span>
          <span class="hm-legend">${esc(t('hm.legendLess', '少'))}
            <span class="hm-cell hm-l0"></span><span class="hm-cell hm-l1"></span><span class="hm-cell hm-l2"></span><span class="hm-cell hm-l3"></span><span class="hm-cell hm-l4"></span>
            ${esc(t('hm.legendMore', '多'))}
          </span>
        </div>
        <div class="hm-scroll">
          <div class="hm-grid-wrap">
            <div class="hm-months">${monthLabels.join('')}</div>
            <div class="hm-canvas">
              <div class="hm-weekdays">${weekdayLabels}</div>
              <div class="hm-weeks">${cells}</div>
            </div>
          </div>
        </div>`;

      pre.parentNode.replaceChild(widget, pre);
    });
  }

  window.MarkdownPreview.renderers.heatmap = { render };
})();
