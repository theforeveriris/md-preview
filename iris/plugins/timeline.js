// 时间线组件（TIMELINE-1）
//
// 语法：
//   ```timeline
//   2026-03-01 | 割接开始 | 核心交换机升级 | doing
//   2026-03-02 02:00 | 业务验证 | 全量巡检通过 | done
//   2026-03-05 | 回退窗口关闭 | 观察期结束 | risk
//   ```
//
// 每行：时间 | 事件 | 备注（可选） | 状态（可选，最后一段）
//   - 分隔符宽容：优先 |，其次全角 ：，最后半角 :（自动避开时间里的 HH:MM 冒号）
//   - 状态：done | doing | risk（也认「完成 / 进行中 / 风险 / 阻塞 / 延期」），不写为中性色
//   - 时间可解析时，若计划区间涵盖今天，自动插入一条「今天」标记线
//   - 以 # 开头的行视为注释跳过
//
// 纯功能插件：无依赖、无网络、无定时器，随文档渲染生成静态 DOM。
export default {
  name: 'timeline',
  description: '时间线：割接计划 / 事故复盘',
  priority: 5,

  render(code, container) {
    const t = window.MarkdownPreview.t;
    const esc = window.MarkdownPreview.mdRender.escapeHtml;
    const items = parseTimeline(String(code || ''));
    container.className = 'devtool devtool-timeline';

    if (!items.length) {
      container.innerHTML = `<div class="devtool-error">${esc(
        t('timeline.empty', '时间线为空：每行写「时间 | 事件 | 备注 | 状态」'))}</div>`;
      return;
    }

    const rows = withTodayMarker(items).map(it => it.today
      ? `<li class="timeline-today"><span class="timeline-today-label">${esc(t('timeline.today', '今天'))}</span></li>`
      : renderItem(it, esc));

    container.innerHTML = `<ul class="timeline-list">${rows.join('')}</ul>`;
  }
};

const STATUS = {
  done: 'done', '完成': 'done', '已完成': 'done', '已完': 'done',
  doing: 'doing', '进行中': 'doing', '进行': 'doing',
  risk: 'risk', '风险': 'risk', '阻塞': 'risk', '延期': 'risk'
};

// 分隔符宽容：| 优先，其次全角 ：，最后半角 :（避免切坏 HH:MM）
function splitFields(line) {
  if (line.indexOf('|') !== -1) return line.split('|');
  if (line.indexOf('：') !== -1) return line.split('：');
  if (line.indexOf(':') !== -1) {
    const parts = line.split(/(?<!\d):(?!\d)/);
    if (parts.length > 1) return parts;
  }
  return [line];
}

// 解析时间段首部的日期：YYYY-MM-DD / YYYY/MM/DD / MM-DD（当年）
function parseDate(text) {
  const s = String(text || '').trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const mo = Number(m[1]);
    const day = Number(m[2]);
    if (mo < 1 || mo > 12 || day < 1 || day > 31) return null;
    const d = new Date(new Date().getFullYear(), mo - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseTimeline(code) {
  const items = [];
  code.replace(/\r\n?/g, '\n').split('\n').forEach(line => {
    const raw = line.trim();
    if (!raw || raw.charAt(0) === '#') return;

    const fields = splitFields(raw).map(s => s.trim());
    let status = '';
    const last = fields[fields.length - 1];
    if (fields.length > 1 && STATUS[last]) {
      status = STATUS[last];
      fields.pop();
    }

    const time = fields.length > 1 ? fields[0] : '';
    const title = fields.length > 1 ? fields[1] : fields[0];
    const note = fields.slice(2).filter(Boolean).join(' · ');

    items.push({ time, title, note, status, date: parseDate(time) });
  });
  return items;
}

// 计划区间涵盖今天时，在「今天」应处的位置插入标记线
function withTodayMarker(items) {
  const dated = items.map(it => it.date).filter(Boolean);
  if (!dated.length) return items;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const times = dated.map(d => d.getTime());
  if (today.getTime() < Math.min(...times) || today.getTime() > Math.max(...times)) return items;

  const out = [];
  let inserted = false;
  items.forEach(it => {
    if (!inserted && it.date && it.date.getTime() > today.getTime()) {
      out.push({ today: true });
      inserted = true;
    }
    out.push(it);
  });
  if (!inserted) out.push({ today: true });
  return out;
}

function renderItem(it, esc) {
  const cls = 'timeline-item' + (it.status ? ' is-' + it.status : '');
  const head = [
    it.time ? `<span class="timeline-date">${esc(it.time)}</span>` : '',
    `<span class="timeline-title">${esc(it.title)}</span>`
  ].join('');
  const note = it.note ? `<div class="timeline-note">${esc(it.note)}</div>` : '';
  return `<li class="${cls}">
      <span class="timeline-dot" aria-hidden="true"></span>
      <div class="timeline-content">
        <div class="timeline-row">${head}</div>
        ${note}
      </div>
    </li>`;
}
