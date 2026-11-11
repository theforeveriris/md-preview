/**
 * cli-lab - 交互式 CLI 演练块
 *
 * Markdown 语法：```cli 演练```，正文是一段「命令 → 期望输出」的对话剧本：
 *   Router> show ip interface brief
 *   Interface              IP-Address      OK? Method Status                Protocol
 *   GigabitEthernet0/0     10.1.1.1        YES manual up                    up
 *   Router# configure terminal
 *   Enter configuration commands, one per line.
 * 规则：
 *   - 提示符行（Router> / Router# / <Huawei> / $ / C:\>）为「可输入命令」；
 *   - 紧随其后的非提示符行为该命令的期望输出（按原样回放）；
 *   - 读者在终端输入框里敲命令：命中（去空白比对，忽略大小写差异的
 *     提示符部分）回放剧本输出；未命中提示「命令不在本节剧本中」；
 *   - `?` 单独回车：列出本节全部待练命令（教学场景的漏题选项）。
 *
 * 目标：教学文档可在浏览器里练手，不需要真设备。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  // 提示符识别：词 + (>|#) / <词> / $ / PS ...>
  const PROMPT_RE = /^([A-Za-z][\w .-]{0,24}[>#]|\[[\w-]+\][#>]?\s|<[\w-]+>\s?|\$\s|PS\s[^>]{0,40}>\s?)(.*)$/;

  // 剧本扩展：提示符行内的 `命令 => 新提示符` 声明执行后的模式切换——
  // 例如 `configure terminal => Router(config)#`、
  // `interface g0/0 => Router(config-if)#`，让演练像真的
  function parseScript(text) {
    const steps = []; // { prompt, cmd, output: [], nextPrompt? }
    const lines = text.split('\n');
    let current = null;
    for (const line of lines) {
      const m = PROMPT_RE.exec(line);
      if (m && m[2].trim()) {
        if (current) steps.push(current);
        let cmd = m[2].trim();
        let nextPrompt = null;
        const arrow = /\s*=>\s*(\S.*)$/.exec(cmd);
        if (arrow) {
          nextPrompt = arrow[1].trim();
          cmd = cmd.slice(0, arrow.index).trim();
        }
        current = { prompt: m[1].trim(), cmd, output: [], nextPrompt };
      } else if (current && line.trim()) {
        current.output.push(line);
      }
    }
    if (current) steps.push(current);
    return steps;
  }

  const norm = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // 命令树前缀匹配（IOS 肌肉记忆：sh ver / conf t / int g0/0）：
  // 逐 token 检查 typed 是否为 expected 对应 token 的非空前缀；
  // expected 全 token 匹配完即视为命中（typed 可以更长？不允许——多余词不算命中）
  function cmdPrefixMatch(expected, typed) {
    const e = norm(expected).split(' ');
    const t = norm(typed).split(' ').filter(Boolean);
    if (!t.length || t.length > e.length) return false;
    return t.every((tok, i) => e[i].startsWith(tok));
  }

  function buildWidget(pre) {
    const code = pre.querySelector('code');
    const text = code ? code.textContent : pre.textContent;
    const steps = parseScript(text);
    if (steps.length === 0) return; // 解析不出剧本：保留源码不动

    const done = new Set();
    let cursor = 0; // 下一个待执行的步骤（鼓励按序，但不强制）

    const widget = document.createElement('div');
    widget.className = 'cli-lab';
    widget.innerHTML = `
      <div class="cli-lab-head">
        <span class="cli-lab-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="cli-lab-title">${esc(t('clilab.title', 'CLI 演练'))}</span>
        <span class="cli-lab-progress" role="status"></span>
        <button type="button" class="cli-lab-reset" title="${esc(t('clilab.reset', '重来'))}">⟲</button>
      </div>
      <div class="cli-lab-screen">
        <div class="cli-lab-log" aria-live="polite"></div>
        <div class="cli-lab-input-row">
          <span class="cli-lab-prompt"></span>
          <input class="cli-lab-input" type="text" autocomplete="off" autocapitalize="off"
                 spellcheck="false" aria-label="${esc(t('clilab.inputLabel', '输入命令'))}"
                 placeholder="${esc(t('clilab.inputHint', '输入命令后回车；单独输入 ? 查看本节待练命令'))}">
        </div>
      </div>
      <div class="cli-lab-hint">${esc(t('clilab.hint', '灰字提示符后的命令是本节要练的内容，敲进去试试。'))}</div>
    `;

    const log = widget.querySelector('.cli-lab-log');
    const promptEl = widget.querySelector('.cli-lab-prompt');
    const input = widget.querySelector('.cli-lab-input');
    const progress = widget.querySelector('.cli-lab-progress');
    const screen = widget.querySelector('.cli-lab-screen');

    function appendLine(html, cls) {
      const div = document.createElement('div');
      div.className = 'cli-lab-line' + (cls ? ' ' + cls : '');
      div.innerHTML = html;
      log.appendChild(div);
      screen.scrollTop = screen.scrollHeight;
    }

    function updateProgress() {
      progress.textContent = t('clilab.progress', '{done}/{total}')
        .replace('{done}', done.size).replace('{total}', steps.length);
    }

    function nextPrompt() {
      const step = steps.find(s => !done.has(s));
      promptEl.textContent = step ? step.prompt : steps[0].prompt;
    }

    function replay(step) {
      appendLine(`<span class="cli-lab-echo-prompt">${esc(step.prompt)}</span> <span class="cli-lab-echo-cmd">${esc(step.cmd)}</span>`, 'cli-lab-echo');
      step.output.forEach(l => appendLine(esc(l), 'cli-lab-out'));
      // 剧本声明的新提示符：模式状态（configure terminal → (config)#）
      if (step.nextPrompt) currentPrompt = step.nextPrompt;
    }

    // 当前提示符（随剧本模式切换，nextPrompt 未声明时沿用下一待练步的 prompt）
    let currentPrompt = null;

    function handleSubmit() {
      const raw = input.value;
      input.value = '';
      if (!raw.trim()) return;

      // 上下文 ?：`show ?` 只列该前缀下本节的可用命令（不是全部漏题）
      const qm = /^(\S[\s\S]*)\s*\?$/.exec(raw.trim());
      if (qm) {
        appendLine(`<span class="cli-lab-echo-prompt">${esc(promptEl.textContent)}</span> ${esc(raw)}`, 'cli-lab-echo');
        const prefix = norm(qm[1]);
        const hits = steps.filter(s => !done.has(s) && norm(s.cmd).startsWith(prefix));
        if (hits.length) hits.forEach(s => appendLine(esc(s.cmd), 'cli-lab-help'));
        else appendLine(esc(t('clilab.noHelp', '% 该前缀下没有本节可练的命令')), 'cli-lab-err');
        return;
      }

      appendLine(`<span class="cli-lab-echo-prompt">${esc(promptEl.textContent)}</span> <span class="cli-lab-echo-cmd">${esc(raw)}</span>`, 'cli-lab-echo');
      // 命令历史（上/下键翻阅）
      if (history[history.length - 1] !== raw) history.push(raw);
      historyIdx = history.length;

      const typed = norm(raw);
      // 先从游标处就近匹配（按序练习），找不到再全局匹配——
      // 支持命令缩写（sh ver / conf t / int g0/0）
      const order = steps.map((s, i) => i)
        .sort((a, b) => Math.abs(a - cursor) - Math.abs(b - cursor));
      const idx = order.find(i => !done.has(steps[i]) && cmdPrefixMatch(steps[i].cmd, typed));

      if (idx === undefined) {
        appendLine(esc(t('clilab.miss', '% 未在本节剧本中——输入 ? 查看待练命令')), 'cli-lab-err');
        return;
      }
      const step = steps[idx];
      done.add(step);
      cursor = idx + 1;
      replay(step);
      updateProgress();

      if (done.size === steps.length) {
        appendLine(esc(t('clilab.complete', '✓ 本节演练完成！')), 'cli-lab-ok');
      } else {
        // 剧本声明的新提示符优先，否则用下一待练步的提示符
        promptEl.textContent = currentPrompt || steps.find(s => !done.has(s)).prompt;
      }
    }

    function reset() {
      done.clear();
      cursor = 0;
      currentPrompt = null;
      log.innerHTML = '';
      updateProgress();
      nextPrompt();
      appendLine(esc(t('clilab.welcome', '演练开始——在下方输入命令')), 'cli-lab-muted');
      input.focus();
    }

    // 命令历史：上下键翻阅
    const history = [];
    let historyIdx = 0;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        if (history.length) {
          e.preventDefault();
          historyIdx = Math.max(0, historyIdx - 1);
          input.value = history[historyIdx] || '';
          input.setSelectionRange(input.value.length, input.value.length);
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        historyIdx = Math.min(history.length, historyIdx + 1);
        input.value = history[historyIdx] || '';
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }
      // Tab 补全：补到本节命令的最长公共前缀；唯一候选直接补全整命令
      if (e.key === 'Tab') {
        e.preventDefault();
        const prefix = norm(input.value);
        const candidates = steps.filter(s => !done.has(s) && norm(s.cmd).startsWith(prefix));
        if (!candidates.length) return;
        if (candidates.length === 1) {
          input.value = candidates[0].cmd;
          return;
        }
        const cmds = candidates.map(s => s.cmd);
        let lcp = cmds[0];
        for (let i = 1; i < cmds.length; i++) {
          while (lcp && !norm(cmds[i]).startsWith(norm(lcp))) {
            lcp = lcp.slice(0, -1);
          }
        }
        if (lcp.length > prefix.length) input.value = lcp;
        else {
          // 已是最长公共前缀：列出候选供选择
          appendLine(`<span class="cli-lab-echo-prompt">${esc(promptEl.textContent)}</span> ${esc(input.value)}`, 'cli-lab-echo');
          candidates.forEach(s => appendLine(esc(s.cmd), 'cli-lab-help'));
        }
        return;
      }
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    });
    widget.querySelector('.cli-lab-reset').addEventListener('click', reset);
    screen.addEventListener('click', () => input.focus());

    pre.parentNode.replaceChild(widget, pre);
    reset();
  }

  function render(root) {
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;
    const pres = Array.from(markdownBody.querySelectorAll('pre.code-block[data-lang="cli"]'));
    if (!pres.length) return;
    pres.forEach(pre => {
      if (pre.dataset.cliLabDone === '1') return;
      pre.dataset.cliLabDone = '1';
      try { buildWidget(pre); } catch (e) { console.error('[cli-lab] render failed:', e); }
    });
  }

  window.MarkdownPreview.renderers.clilab = { render };
})();
