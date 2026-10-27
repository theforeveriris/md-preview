/**
 * acl-analyzer - ACL 分析块渲染器
 *
 * Markdown 语法（lang 第二 token 可选 ios/vrp，默认 ios）：
 *   ```acl
 *   10 permit tcp 10.1.1.0 0.0.0.255 any eq 443
 *   20 deny ip any any
 *   ```
 *   或命名 ACL 整块粘贴（ip access-list extended ... / rule 5 permit ...）。
 *
 * 渲染：匹配顺序表（序号/动作/协议/源/目的/端口）+ 五元组命中测试——
 * 自上而下模拟 ACL 求值，第一条命中即返回；无命中提示 IOS/VRP 的
 * 隐式 deny。「为什么这条流量被拒」排查神器。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // ============== 解析 ==============

  const PROTOCOLS = new Set(['ip', 'tcp', 'udp', 'icmp', 'igmp', 'gre', 'esp', 'ah']);

  function normalizeIp(ip) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
    if (!m) return null;
    const p = m.slice(1).map(Number);
    if (p.some(n => n > 255)) return null;
    return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
  }

  // 通配符掩码 → 网络（0 位必须连续，宽松处理）
  function applyWildcard(ipInt, wcInt) {
    return (ipInt & (~wcInt >>> 0)) >>> 0;
  }

  // 解析地址对象：any / host A / A B(wildcard) / A/prefix
  // 返回 { match(ipInt) } 或 null
  function parseAddress(tokens) {
    if (tokens.length === 0) return null;
    const first = tokens[0].toLowerCase();
    if (first === 'any') return { label: 'any', match: () => true };
    if (first === 'host' && tokens.length >= 2) {
      const ip = normalizeIp(tokens[1]);
      if (ip === null) return null;
      return { label: `host ${tokens[1]}`, match: x => x === ip };
    }
    const ipInt = normalizeIp(tokens[0]);
    if (ipInt === null) return null;
    if (tokens.length >= 2) {
      const wcInt = normalizeIp(tokens[1]);
      if (wcInt === null) return null;
      const net = applyWildcard(ipInt, wcInt);
      return { label: `${tokens[0]} ${tokens[1]}`, match: x => applyWildcard(x, wcInt) === net };
    }
    // A/prefix
    const cidr = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(tokens[0]);
    if (cidr) {
      const base = normalizeIp(cidr[1]);
      const plen = parseInt(cidr[2], 10);
      if (base === null || plen > 32) return null;
      const mask = plen === 0 ? 0 : (0xFFFFFFFF << (32 - plen)) >>> 0;
      const net = (base & mask) >>> 0;
      return { label: tokens[0], match: x => (x & mask) >>> 0 === net };
    }
    return { label: tokens[0], match: x => x === ipInt };
  }

  // 解析端口段：eq N / range A B / gt N / lt N（缺省 = 任意）
  function parsePort(tokens, offset) {
    const rest = tokens.slice(offset);
    if (rest.length === 0) return { label: '', match: () => true };
    const op = rest[0].toLowerCase();
    const n1 = parseInt(rest[1], 10);
    if (op === 'eq' && Number.isFinite(n1)) return { label: `eq ${n1}`, match: p => p === n1 };
    if (op === 'range' && Number.isFinite(n1) && Number.isFinite(parseInt(rest[2], 10))) {
      const n2 = parseInt(rest[2], 10);
      return { label: `range ${n1} ${n2}`, match: p => p >= n1 && p <= n2 };
    }
    if (op === 'gt' && Number.isFinite(n1)) return { label: `gt ${n1}`, match: p => p > n1 };
    if (op === 'lt' && Number.isFinite(n1)) return { label: `lt ${n1}`, match: p => p < n1 };
    return null;
  }

  // 从一行配置提取规则；无法识别的行返回 null
  function parseRuleLine(line) {
    let toks = line.trim().replace(/\s+/g, ' ').split(' ');
    // 形态归一：去掉命名 ACL 头 / 编号 ACL 前缀 / VRP rule N
    if (/^ip\s+access-list/i.test(line)) return { header: line.trim() };
    if (toks[0].toLowerCase() === 'rule') toks = toks.slice(1); // VRP: rule 5 permit ...
    else if (/^access-list$/i.test(toks[0]) && /^\d+$/.test(toks[1] || '')) toks = toks.slice(2);
    else if (/^\d+$/.test(toks[0])) toks = toks.slice(1); // 命名 ACL 序号
    if (toks.length < 2) return null;
    const action = toks[0].toLowerCase();
    if (action !== 'permit' && action !== 'deny') return null;
    const proto = (toks[1] || '').toLowerCase();
    if (!PROTOCOLS.has(proto)) return null;
    let idx = 2;
    if (toks[idx] && toks[idx].toLowerCase() === 'source') idx += 1; // VRP
    const src = parseAddress(toks.slice(idx));
    if (!src) return null;
    idx += (toks[idx] && toks[idx].toLowerCase() === 'host') ? 2 : (src.label === 'any' ? 1 : (src.label.split(' ').length));
    if (toks[idx] && toks[idx].toLowerCase() === 'destination') idx += 1; // VRP
    const dst = parseAddress(toks.slice(idx));
    if (!dst) return null;
    idx += (toks[idx] && toks[idx].toLowerCase() === 'host') ? 2 : (dst.label === 'any' ? 1 : (dst.label.split(' ').length));
    // 端口：IOS `eq 443` / VRP `destination-port eq 443`
    let port = { label: '', match: () => true };
    if (toks[idx] && toks[idx].toLowerCase() === 'destination-port') idx += 1;
    if (idx < toks.length) {
      const p = parsePort(toks, idx);
      if (p) port = p;
    }
    // ICMP 无端口概念：端口条件只在 tcp/udp 下参与匹配
    const effectivePort = (proto === 'tcp' || proto === 'udp') ? port : { label: '', match: () => true };
    return { action, proto, src, dst, port: effectivePort };
  }

  function parseAcl(text) {
    const rules = [];
    const headers = [];
    String(text || '').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '!' || trimmed.startsWith('!')) return;
      const rule = parseRuleLine(trimmed);
      if (!rule) return;
      if (rule.header) { headers.push(rule.header); return; }
      rules.push(rule);
    });
    return { rules, headers };
  }

  // ============== 命中测试 ==============

  function ruleMatches(rule, flow) {
    if (rule.proto !== 'ip' && flow.proto !== rule.proto) return false;
    if (!rule.src.match(flow.src)) return false;
    if (!rule.dst.match(flow.dst)) return false;
    if (!rule.port.match(flow.port)) return false;
    return true;
  }

  function evaluate(rules, flow) {
    for (let i = 0; i < rules.length; i++) {
      if (ruleMatches(rules[i], flow)) {
        return { index: i, rule: rules[i], implicitDeny: false };
      }
    }
    return { index: -1, rule: null, implicitDeny: true };
  }

  // ============== 渲染 ==============

  function widgetFor(pre, text, flavor) {
    const { rules } = parseAcl(text);
    if (rules.length === 0) return false; // 解析不出规则：保留源码

    const widget = document.createElement('div');
    widget.className = 'acl-widget';
    const rows = rules.map((r, i) => `
      <tr data-idx="${i}">
        <td class="acl-seq">${i + 1}</td>
        <td><span class="acl-action acl-${r.action}">${r.action.toUpperCase()}</span></td>
        <td>${esc(r.proto.toUpperCase())}</td>
        <td><code>${esc(r.src.label)}</code></td>
        <td><code>${esc(r.dst.label)}</code></td>
        <td><code>${esc(r.port.label || t('acl.anyPort', '任意'))}</code></td>
      </tr>`).join('');

    widget.innerHTML = `
      <div class="acl-head">
        <span class="acl-flavor">${esc((flavor || 'ios').toUpperCase())} ACL</span>
        <span class="acl-count">${t('acl.ruleCount', '{n} 条规则').replace('{n}', rules.length)}</span>
      </div>
      <div class="acl-table-wrap"><table>
        <thead><tr>
          <th>#</th><th>${esc(t('acl.action', '动作'))}</th><th>${esc(t('acl.proto', '协议'))}</th>
          <th>${esc(t('acl.source', '源'))}</th><th>${esc(t('acl.dest', '目的'))}</th><th>${esc(t('acl.port', '端口'))}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <div class="acl-test">
        <div class="acl-test-title">${esc(t('acl.testTitle', '五元组命中测试'))}</div>
        <div class="acl-test-form">
          <select class="acl-test-proto"><option value="tcp">TCP</option><option value="udp">UDP</option><option value="icmp">ICMP</option><option value="ip">IP</option></select>
          <input class="acl-test-src" type="text" placeholder="${esc(t('acl.srcPh', '源 IP（10.1.1.8）'))}" value="10.1.1.8">
          <input class="acl-test-dst" type="text" placeholder="${esc(t('acl.dstPh', '目的 IP（8.8.8.8）'))}" value="8.8.8.8">
          <input class="acl-test-port" type="text" placeholder="${esc(t('acl.portPh', '端口（443）'))}" value="443">
          <button type="button" class="download-btn acl-test-btn">${esc(t('acl.testBtn', '测试'))}</button>
        </div>
        <div class="acl-test-result" hidden></div>
      </div>`;

    const resultBox = widget.querySelector('.acl-test-result');
    widget.querySelector('.acl-test-btn').addEventListener('click', () => {
      const proto = widget.querySelector('.acl-test-proto').value;
      const srcIp = normalizeIp(widget.querySelector('.acl-test-src').value.trim());
      const dstIp = normalizeIp(widget.querySelector('.acl-test-dst').value.trim());
      const port = parseInt(widget.querySelector('.acl-test-port').value, 10) || 0;
      if (srcIp === null || dstIp === null) {
        resultBox.hidden = false;
        resultBox.className = 'acl-test-result acl-result-error';
        resultBox.textContent = t('acl.badIp', 'IP 地址格式不对');
        return;
      }
      const flow = { proto, src: srcIp, dst: dstIp, port };
      const outcome = evaluate(rules, flow);
      const rows = widget.querySelectorAll('tbody tr');
      rows.forEach(tr => tr.classList.remove('acl-hit'));
      if (!outcome.implicitDeny) {
        rows[outcome.index]?.classList.add('acl-hit');
        resultBox.hidden = false;
        resultBox.className = 'acl-test-result acl-result-' + outcome.rule.action;
        resultBox.innerHTML = `<strong>${outcome.rule.action.toUpperCase()}</strong> — ${t('acl.hitRule', '命中第 {n} 条规则').replace('{n}', outcome.index + 1)}`;
      } else {
        resultBox.hidden = false;
        resultBox.className = 'acl-test-result acl-result-deny';
        resultBox.innerHTML = `<strong>DENY</strong> — ${t('acl.implicitDeny', '未命中任何规则，落入隐式 deny（每条 ACL 末尾都有不可见的 deny ip any any）')}`;
      }
    });

    pre.parentNode.replaceChild(widget, pre);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      const parts = lang.split(/\s+/);
      if (parts[0] !== 'acl') return;
      const text = pre.querySelector('code')?.textContent ?? '';
      try { widgetFor(pre, text, parts[1]); } catch (e) { /* 解析异常保留源码 */ }
    });
  }

  window.MarkdownPreview.renderers.acl = { render };
})();
