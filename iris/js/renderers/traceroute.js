/**
 * traceroute - traceroute / ping 输出渲染器
 *
 * Markdown 语法：```traceroute（或 ```ping），正文粘贴原始命令输出——
 *   - traceroute：` 1  192.168.1.1 (192.168.1.1)  1.2 ms  1.0 ms  0.9 ms`
 *   - ping：`64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=1.23 ms`
 *   - Windows 风格也认：`  1    <1 ms    <1 ms    <1 ms  192.168.1.1`
 *   - `* * *`（超时跳）与 mtr 风格 ` 1.  gw --- 0.0 ms` 尽力识别
 *
 * 渲染：
 *   - 跳数列表 + 每跳 RTT 条形图（按全图最大 RTT 归一化，延迟一眼可见）
 *   - 三次探测取最优/均值/丢包标记；`* * *` 显示「超时」灰色档
 *   - ping 模式：min/avg/max/损失统计卡 + 序列 RTT 迷你条形图
 *   - 每跳 IP 右键复制（复用 interactions 的图片菜单模式不现实，改为点击复制）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const TIMEOUT = -1;

  // ============== 解析 ==============

  // "1.2 ms" / "<1 ms" / "0.9ms" / "*" → 毫秒数或 TIMEOUT
  function parseRtt(token) {
    const s = String(token || '').trim();
    if (!s || s === '*' || s === '* * *') return TIMEOUT;
    const m = /^(<)?\s*([\d.]+)\s*ms$/i.exec(s);
    if (!m) return null; // 非法（交给跳过逻辑）
    const v = parseFloat(m[2]);
    if (!isFinite(v)) return null;
    return m[1] ? Math.min(v, 0.5) : v; // "<1 ms" 按 <1 处理
  }

  // traceroute 一跳：` 2  10.8.0.1 (10.8.0.1)  12.3 ms  12.1 ms  11.8 ms`
  // Windows：`  2    5 ms    4 ms    5 ms  10.8.0.1`
  function parseHopLine(line) {
    const s = line.trim();
    if (!s) return null;
    const m = /^(\d{1,2})[.)]?\s+(.*)$/.exec(s);
    if (!m) return null;
    const no = parseInt(m[1], 10);
    let rest = m[2];

    const host = { ip: '', name: '' };
    // 第一种形态：host (ip) 或 ip (host)
    let pm = /^(\S+)\s+\(([^)]+)\)\s*(.*)$/.exec(rest);
    if (pm) {
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(pm[1]) || pm[1].includes(':')) {
        host.ip = pm[1]; host.name = pm[2];
      } else {
        host.name = pm[1]; host.ip = pm[2];
      }
      rest = pm[3];
    }
    // 收集 RTT：标准输出里 "1.2 ms" 是两个 token，按空白切分会让数值与
    // 单位分家——用正则直接扫整段 rest（数值±单位 / 裸数值 / <数值 ms / *）
    const rtts = [];
    const rttSpans = [];
    const RTT_RE = /(\*|<\s*[\d.]+\s*ms|[\d.]+\s*ms|[\d.]+)/gi;
    let rm;
    while ((rm = RTT_RE.exec(rest)) !== null) {
      if (rm[0] === '*' || /\bms\b/i.test(rm[0])) {
        const v = parseRtt(rm[0]);
        if (v !== null && v !== undefined) {
          rtts.push(v);
          rttSpans.push([rm.index, rm.index + rm[0].length]);
        }
      }
    }
    // RTT 之外的文本（AS 路径、Windows 形态里的地址等）丢进 remark：
    // 把已识别的 RTT 片段从 rest 里挖掉，剩余部分再按空白收集
    let remarkPart = rest;
    for (let i = rttSpans.length - 1; i >= 0; i--) {
      remarkPart = remarkPart.slice(0, rttSpans[i][0]) + ' ' + remarkPart.slice(rttSpans[i][1]);
    }
    const remarkTokens = remarkPart.split(/\s+/).filter(tok =>
      tok && tok !== '*' && !/^(ms|MPI|mpls)$/i.test(tok) &&
      // 裸数字（拆散的 RTT 残片）才丢弃；IPv4 地址含三个点，不是裸数字
      !( /^\d+$/.test(tok) )
    );
    // Windows 形态：rtts 在前、地址在后
    if (!host.ip && !host.name) {
      const ipm = /(\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{2,45})/.exec(remarkTokens.join(' '));
      if (ipm) host.ip = ipm[1];
    }
    if (!host.ip && !host.name && rtts.length === 0) return null;
    if (rtts.length === 0) rtts.push(TIMEOUT, TIMEOUT, TIMEOUT); // 纯 "* * *" 行
    const valid = rtts.filter(v => v >= 0);
    return {
      no,
      ip: host.ip || '',
      name: host.name || '',
      rtts,
      best: valid.length ? Math.min.apply(null, valid) : TIMEOUT,
      avg: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : TIMEOUT,
      lost: rtts.filter(v => v < 0).length,
      remark: remarkTokens.join(' ')
    };
  }

  // ping 统计行：`rtt min/avg/max/mdev = 1.1/1.3/1.8/0.2 ms` 或 Windows 概要
  function parsePingSummary(lines) {
    const out = {};
    const m = /=\s*([\d.]+)\/([\d.]+)\/([\d.]+)(?:\/[\d.]+)?\s*ms/.exec(lines.join('\n'));
    if (m) { out.min = +m[1]; out.avg = +m[2]; out.max = +m[3]; }
    const loss = /(\d+(?:\.\d+)?)%\s*(?:packet\s*)?loss/.exec(lines.join('\n'));
    if (loss) out.loss = parseFloat(loss[1]);
    return out;
  }

  // ping 逐包：`64 bytes from 1.2.3.4: icmp_seq=1 ttl=64 time=1.23 ms`
  function parsePingSeq(lines) {
    const seqs = [];
    lines.forEach(line => {
      const m = /time[=<]\s*([\d.]+)\s*ms/i.exec(line);
      if (m) seqs.push(parseFloat(m[1]));
    });
    return seqs;
  }

  // ============== 渲染 ==============

  function fmtRtt(v) {
    if (v < 0) return t('tr.timeout', '超时');
    return v.toFixed(v < 10 ? 1 : 0) + ' ms';
  }

  // 每跳 RTT 走势 sparkline：Unicode 八档字符（▁▂▃▄▅▆▇█），不占布局
  function sparkline(values, max) {
    const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const valid = values.filter(v => v >= 0);
    if (!valid.length) return '···';
    const peak = Math.max.apply(null, valid.concat([1]));
    return values.map(v => {
      if (v < 0) return '·';
      const lvl = Math.min(7, Math.max(0, Math.round((v / peak) * 7)));
      return bars[lvl];
    }).join('');
  }

  function hopRowsHtml(hops, maxRtt) {
    return hops.map(hop => {
      const pct = hop.best >= 0 ? Math.max(1.5, (hop.avg / maxRtt) * 100) : 0;
      const cls = hop.best < 0 ? 'tr-row-timeout' : (hop.avg > maxRtt * 0.6 ? 'tr-row-slow' : '');
      // 丢包独立列（此前只是 ms 角标，不显眼）
      const lossPct = Math.round((hop.lost / hop.rtts.length) * 100);
      const lossCell = hop.lost
        ? `<span class="tr-loss-cell ${lossPct >= 34 ? 'is-bad' : ''}">${lossPct}%</span>`
        : '<span class="tr-loss-cell">0%</span>';
      return `<div class="tr-hop ${cls}">
        <span class="tr-hop-no">${hop.no}</span>
        <span class="tr-hop-host">${esc(hop.ip || hop.name || '*')}${hop.name && hop.ip ? `<span class="tr-host-name">${esc(hop.name)}</span>` : ''}</span>
        <span class="tr-hop-bar"><span class="tr-bar-fill" style="width:${pct}%"></span></span>
        <span class="tr-hop-rtts" title="${esc(hop.rtts.map(v => v < 0 ? '—' : v.toFixed(1)).join(' / '))}"><span class="tr-sparkline">${sparkline(hop.rtts, maxRtt)}</span></span>
        <span class="tr-hop-ms">${esc(hop.best < 0 ? '—' : fmtRtt(hop.avg))}</span>
        ${lossCell}
      </div>`;
    }).join('');
  }

  function buildWidget(pre, mode) {
    const code = pre.querySelector('code');
    const text = code ? code.textContent : pre.textContent;
    // 中文 Windows / mtr 风格提示行也剔除（中文 tracert 表头、Ping 统计行）
    const lines = text.split('\n').filter(l => l.trim() &&
      !/^(traceroute to|PING |TRACE|跟踪|通过最多|正在|Ping |数据包|往返行程)/.test(l.trim()));

    const widget = document.createElement('div');
    widget.className = 'tr-widget';

    if (mode === 'ping' || (mode !== 'traceroute' && /^\s*\d+[.)]/.test(lines[0] || '') === false)) {
      // ============== ping 视图 ==============
      const seqs = parsePingSeq(lines);
      const summary = parsePingSummary(lines);
      const maxRtt = Math.max.apply(null, seqs.concat(summary.max ? [summary.max] : [1]));
      widget.innerHTML = `
        <div class="tr-head">${esc(t('tr.pingTitle', 'PING 连通性'))}</div>
        <div class="tr-summary">
          ${summary.min != null ? `<span class="tr-stat"><b>${summary.min.toFixed(1)}</b> ${esc(t('tr.min', '最小'))}</span>` : ''}
          ${summary.avg != null ? `<span class="tr-stat"><b>${summary.avg.toFixed(1)}</b> ${esc(t('tr.avg', '平均'))}</span>` : ''}
          ${summary.max != null ? `<span class="tr-stat"><b>${summary.max.toFixed(1)}</b> ${esc(t('tr.max', '最大'))}</span>` : ''}
          ${summary.loss != null ? `<span class="tr-stat tr-stat-loss ${summary.loss > 0 ? 'is-bad' : ''}"><b>${summary.loss}%</b> ${esc(t('tr.loss', '丢包'))}</span>` : ''}
        </div>
        <div class="tr-seq-chart">
          ${seqs.map(v => `<span class="tr-mini-bar" style="height:${Math.round(6 + (v / maxRtt) * 54)}px" title="${esc(v.toFixed(2))} ms"></span>`).join('') || ''}
        </div>
        ${seqs.length === 0 && summary.min == null ? `<div class="tr-empty">${esc(t('tr.parseFail', '没有识别到 RTT 数据，已保留源码'))}</div>` : ''}
      `;
    } else {
      // ============== traceroute 视图 ==============
      const hops = [];
      lines.forEach(line => {
        const hop = parseHopLine(line);
        if (hop) hops.push(hop);
      });
      if (hops.length === 0) {
        widget.innerHTML = `<div class="tr-empty">${esc(t('tr.parseFail', '没有识别到 RTT 数据，已保留源码'))}</div>`;
        pre.parentNode.replaceChild(widget, pre);
        return;
      }
      const valids = hops.filter(h => h.best >= 0).map(h => h.avg);
      const maxRtt = Math.max.apply(null, valids.concat([1]));
      const totalMs = hops.reduce((a, h) => a + (h.best > 0 ? h.best : 0), 0);
      widget.innerHTML = `
        <div class="tr-head">${esc(t('tr.traceTitle', '路径追踪'))}<span class="tr-head-meta">${hops.length} ${esc(t('tr.hops', '跳'))} · ${esc(t('tr.total', '累计'))} ${totalMs.toFixed(1)} ms</span></div>
        ${hopRowsHtml(hops, maxRtt)}
      `;
      // 点击 IP 复制
      widget.querySelectorAll('.tr-hop-host').forEach(el => {
        el.title = t('tr.clickCopy', '点击复制地址');
        el.addEventListener('click', () => {
          const copy = window.MarkdownPreview.interactions && window.MarkdownPreview.interactions.copyText;
          if (copy) copy(el.dataset.addr || el.textContent);
        });
        el.dataset.addr = el.textContent.trim();
      });
    }

    pre.parentNode.replaceChild(widget, pre);
  }

  function render(root) {
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;
    const pres = Array.from(markdownBody.querySelectorAll('pre.code-block[data-lang]')).filter(pre => {
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      return lang === 'traceroute' || lang === 'ping' || lang === 'tracert';
    });
    if (!pres.length) return;
    pres.forEach(pre => {
      if (pre.dataset.trDone === '1') return;
      pre.dataset.trDone = '1';
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      try {
        buildWidget(pre, lang === 'ping' ? 'ping' : 'traceroute');
      } catch (e) {
        console.error('[traceroute] render failed:', e);
      }
    });
  }

  window.MarkdownPreview.renderers.traceroute = { render };
})();
