/**
 * log / clitable 渲染器（C1）
 *
 * Markdown 语法：
 *   ```log        日志输出（syslog / nginx / JSON / 通用文本）
 *   ```clitable  CLI 结构化输出（show 系列、对齐列、key: value）
 *
 * log：
 *   - 按行解析时间戳 / 级别 / 主机 / 进程 / 消息；无法识别的行归为 info
 *   - 工具条：级别筛选（全部/错误/警告/信息/调试）、关键字过滤、导出
 *   - 级别配色走 CSS 变量，暗色/打印自适应
 *
 * clitable：
 *   - 表头 + 分隔行 → 表格
 *   - `key: value` 连续行 → 键值表
 *   - 对齐列（2+ 空格分列）→ 表格
 *   - 解析失败回退为等宽代码块，不阻塞其他块
 *
 * 表格交互复用 tables 渲染器（B1）。
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

  const LEVELS = ['error', 'warn', 'info', 'debug'];
  const LEVEL_LABEL = { error: '错误', warn: '警告', info: '信息', debug: '调试' };

  function guessLevel(text) {
    const up = text.toUpperCase();
    if (/\b(EMERG|PANIC|FATAL|CRIT)\b/.test(up) || /\bERR(OR)?\b/.test(up)) return 'error';
    if (/\b(WARN(ING)?)\b/.test(up)) return 'warn';
    if (/\b(DEBUG|TRACE)\b/.test(up)) return 'debug';
    if (/\b(INFO|NOTICE)\b/.test(up)) return 'info';
    return 'info';
  }

  function splitSyslog(line) {
    // 形如：Mar  1 12:00:01 host proc[123]: message
    const m = /^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)$/.exec(line);
    if (m) return { ts: m[1], host: m[2], proc: m[3], pid: m[4], msg: m[5] };
    return null;
  }

  function splitTimestamp(line) {
    const patterns = [
      // ISO：2026-11-02T12:00:00.000Z 或 2026-11-02 12:00:00
      /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(.*)$/,
      // [2026-11-02 12:00:00] message
      /^(\[\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\])\s+(.*)$/,
      // HH:MM:SS message
      /^(\d{2}:\d{2}:\d{2})\s+(.*)$/
    ];
    for (const re of patterns) {
      const m = re.exec(line);
      if (m) return { ts: m[1], rest: m[2] };
    }
    return null;
  }

  function parseLog(text) {
    const lines = String(text || '').split(/\r?\n/).filter(l => l.trim() !== '');
    const entries = [];
    for (const line of lines) {
      let entry = { raw: line, ts: '', host: '', proc: '', level: 'info', msg: line };
      let obj = null;
      if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
        try { obj = JSON.parse(line); } catch (e) { obj = null; }
      }
      if (obj) {
        entry.ts = obj.timestamp || obj.time || obj.ts || '';
        entry.level = guessLevel(String(obj.level || obj.lvl || obj.severity || ''));
        entry.msg = String(obj.message || obj.msg || obj.log || JSON.stringify(obj));
        entry.host = obj.host || obj.hostname || '';
        entry.proc = obj.logger || obj.process || '';
        entry.raw = line;
      } else {
        const sl = splitSyslog(line);
        let rest = line;
        if (sl) {
          entry.ts = sl.ts; entry.host = sl.host; entry.proc = sl.proc; entry.msg = sl.msg;
          rest = sl.msg;
        } else {
          const ts = splitTimestamp(line);
          if (ts) { entry.ts = ts.ts; rest = ts.rest; }
          // ISO 时间戳后仍可能跟 host proc[pid]: message
          const hm = /^([^\s\[\]:]+)\s+([^\s:\[\]]+)(?:\[(\d+)\])?:\s*(.*)$/.exec(rest);
          if (hm && !/^\d/.test(hm[1])) {
            entry.host = hm[1];
            entry.proc = hm[2] + (hm[3] ? '[' + hm[3] + ']' : '');
            rest = hm[4];
          }
        }
        // 前缀 [LEVEL] / LEVEL: / 裸 LEVEL 词（级别词归级别，其余词归进程）
        const bm = /^\[([A-Za-z]+)\]\s*/.exec(rest);
        if (bm) { entry.level = guessLevel(bm[1]); rest = rest.slice(bm[0].length); }
        const lvl = /^\s*([A-Za-z]{3,8})\s*[:|]\s*/.exec(rest);
        if (lvl) {
          if (/(ERROR|ERR|WARN|INFO|DEBUG|TRACE|NOTICE|FATAL|CRIT|EMERG)/i.test(lvl[1])) {
            entry.level = guessLevel(lvl[1]);
          } else {
            entry.proc = lvl[1];
          }
          rest = rest.slice(lvl[0].length);
        } else {
          const bare = /^\s*(EMERG|ALERT|CRIT|FATAL|ERROR|ERR|WARN(?:ING)?|NOTICE|INFO|DEBUG|TRACE)\s+(.*)$/i.exec(rest);
          if (bare) { entry.level = guessLevel(bare[1]); rest = bare[2]; }
        }
        entry.msg = rest;
        if (entry.level === 'info') entry.level = guessLevel(rest);
      }
      entries.push(entry);
    }
    return entries;
  }

  function renderLog(pre) {
    const text = pre.querySelector('code')?.textContent || '';
    const entries = parseLog(text);
    const widget = document.createElement('div');
    widget.className = 'log-view';

    const toolbar = document.createElement('div');
    toolbar.className = 'log-toolbar';
    const exportLabel = t('log.export', '导出');
    toolbar.innerHTML =
      '<div class="log-levels" role="group" aria-label="' + esc(t('log.levels', '级别筛选')) + '">' +
        LEVELS.map(lv => `<button type="button" class="log-chip" data-level="${lv}" aria-pressed="true">${esc(LEVEL_LABEL[lv])}</button>`).join('') +
      '</div>' +
      '<label class="log-search">' +
        '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
        '<input type="search" class="log-search-input" placeholder="' + esc(t('log.search', '搜索日志…')) + '" aria-label="' + esc(t('log.search', '搜索日志')) + '">' +
      '</label>' +
      '<span class="log-count" aria-live="polite"></span>' +
      '<button type="button" class="icon-btn log-export" data-tip="' + esc(exportLabel) + '" title="' + esc(exportLabel) + '" aria-label="' + esc(exportLabel) + '">' +
        icon('i-download', 15) + '<span class="icon-btn-label">' + esc(exportLabel) + '</span></button>';

    const list = document.createElement('div');
    list.className = 'log-list';
    list.setAttribute('role', 'log');

    entries.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'log-row log-level-' + e.level;
      row.dataset.level = e.level;
      row.dataset.index = String(i);
      row.innerHTML =
        '<span class="log-level">' + esc(LEVEL_LABEL[e.level]) + '</span>' +
        '<span class="log-ts">' + esc(e.ts || '—') + '</span>' +
        '<span class="log-host">' + esc(e.host || '') + '</span>' +
        '<span class="log-proc">' + esc(e.proc || '') + '</span>' +
        '<span class="log-msg"></span>';
      row.querySelector('.log-msg').textContent = e.msg;
      list.appendChild(row);
    });

    widget.appendChild(toolbar);
    widget.appendChild(list);
    pre.replaceWith(widget);

    const enabled = new Set(LEVELS);
    const countEl = toolbar.querySelector('.log-count');
    const searchInput = toolbar.querySelector('.log-search-input');

    function apply() {
      const q = searchInput.value.trim().toLowerCase();
      let visible = 0;
      Array.from(list.children).forEach(row => {
        const okLevel = enabled.has(row.dataset.level);
        const okText = !q || row.textContent.toLowerCase().includes(q);
        row.hidden = !(okLevel && okText);
        if (okLevel && okText) visible++;
      });
      countEl.textContent = visible === entries.length
        ? t('log.all', '{n} 条').replace('{n}', visible)
        : t('log.filtered', '{m} / {n} 条').replace('{m}', visible).replace('{n}', entries.length);
    }

    toolbar.querySelectorAll('.log-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const lv = chip.dataset.level;
        if (enabled.has(lv)) {
          if (enabled.size === 1) return; // 至少保留一个
          enabled.delete(lv);
          chip.setAttribute('aria-pressed', 'false');
        } else {
          enabled.add(lv);
          chip.setAttribute('aria-pressed', 'true');
        }
        apply();
      });
    });
    searchInput.addEventListener('input', apply);
    toolbar.querySelector('.log-export').addEventListener('click', () => {
      const rows = Array.from(list.children).filter(r => !r.hidden).map(r =>
        Array.from(r.children).map(c => c.textContent).join(' | '));
      downloadCsv(rows);
    });
    apply();
  }

  function downloadCsv(rows) {
    const text = rows.map(r => r.map(c => /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'log.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ============== clitable ==============
  function splitColumns(line) {
    if (line.includes('|')) return line.split('|').map(s => s.trim()).filter((s, i, a) => i < a.length - 1 || s);
    return line.trim().split(/\s{2,}/).map(s => s.trim());
  }

  function looksLikeSeparator(line) {
    return /^[\s|:\-—]+$/.test(line) && /[-—]/.test(line) && /[|]/.test(line) || /^[\s\-]+$/.test(line) && line.includes('-');
  }

  function parseClitable(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\r/g, ''));
    // 去掉首尾空行
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) return null;

    // 1) 表头 + 分隔行
    for (let i = 0; i < lines.length; i++) {
      if (looksLikeSeparator(lines[i]) && i > 0) {
        const header = splitColumns(lines[i - 1]);
        const body = lines.slice(i + 1).filter(l => l.trim() !== '');
        if (header.length >= 2 && body.length) {
          return { type: 'table', header, rows: body.map(splitColumns) };
        }
      }
    }

    // 2) key: value 连续块
    const kv = lines.filter(l => /^[\w.\- ]+:\s+\S/.test(l));
    if (kv.length >= 2 && kv.length >= lines.length * 0.6) {
      return {
        type: 'kv',
        header: ['键', '值'],
        rows: kv.map(l => {
          const idx = l.indexOf(':');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
        })
      };
    }

    // 3) 对齐列：至少两行，分列数一致
    const cols = lines.map(splitColumns).filter(a => a.length >= 2);
    if (cols.length >= 2) {
      const n = cols[0].length;
      if (cols.every(a => a.length === n)) {
        return { type: 'table', header: cols[0], rows: cols.slice(1) };
      }
    }
    return null;
  }

  function renderClitable(pre) {
    const text = pre.querySelector('code')?.textContent || '';
    const parsed = parseClitable(text);
    if (!parsed) return false; // 回退源码

    const widget = document.createElement('div');
    widget.className = 'clitable-view';

    const head = document.createElement('div');
    head.className = 'clitable-head';
    head.innerHTML = '<span class="clitable-title">' + esc(t('clitable.title', 'CLI 输出')) + '</span>' +
      '<span class="clitable-count">' + esc(t('clitable.rows', '{n} 行').replace('{n}', parsed.rows.length)) + '</span>';
    widget.appendChild(head);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    parsed.header.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    parsed.rows.forEach(r => {
      const row = document.createElement('tr');
      parsed.header.forEach((_, i) => {
        const td = document.createElement('td');
        td.textContent = r[i] != null ? r[i] : '';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    widget.appendChild(table);

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper mdt-wrapper';
    wrapper.appendChild(table);
    widget.appendChild(wrapper);

    pre.replaceWith(widget);
    // 复用 B1 表格工具条
    if (window.MarkdownPreview.renderers.tables) {
      window.MarkdownPreview.renderers.tables.render(widget);
    }
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block').forEach(pre => {
      if (pre.dataset.logDone) return;
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      if (lang === 'log') {
        pre.dataset.logDone = '1';
        renderLog(pre);
      } else if (lang === 'clitable') {
        pre.dataset.logDone = '1';
        renderClitable(pre);
      }
    });
  }

  window.MarkdownPreview.renderers.log = { render };
  window.MarkdownPreview.renderers.clitable = { render };
})();
