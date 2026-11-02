/**
 * terminal-replay - 终端回放块渲染器
 *
 * Markdown 语法：```terminal，正文逐行写会话——
 *   以 `$ ` / `# ` / `> ` 开头的行是命令（逐字打字动画），
 *   其余行是输出（逐行闪现）。
 *
 * 渲染为深色终端窗口：播放 / 重播 / 倍速控制；跟随 prefers-reduced-motion
 * 直接呈现最终状态。教学演示利器，比贴截图生动、比录屏轻量。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const CMD_RE = /^[$#>]\s/;

  function parseSession(text) {
    const lines = String(text || '').split('\n').map(l => l.replace(/\r/g, ''));
    // 去掉首尾空行
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.map(line => ({ line, isCmd: CMD_RE.test(line) }));
  }

  function widgetFor(pre) {
    const steps = parseSession(pre.querySelector('code')?.textContent ?? '');
    if (steps.length === 0) return false;

    const widget = document.createElement('div');
    widget.className = 'term-replay';
    widget.innerHTML = `
      <div class="term-head">
        <span class="term-dots"><i></i><i></i><i></i></span>
        <span class="term-title">${esc(t('term.title', '终端回放'))}</span>
        <span class="term-controls">
          <select class="term-speed" aria-label="${esc(t('term.speed', '回放速度'))}">
            <option value="1">1×</option>
            <option value="2" selected>2×</option>
            <option value="4">4×</option>
          </select>
          <button type="button" class="term-play">${esc(t('term.play', '▶ 播放'))}</button>
          <button type="button" class="term-end">${esc(t('term.showEnd', '直接看结果'))}</button>
        </span>
      </div>
      <div class="term-body"><code class="term-screen"></code></div>`;

    const screen = widget.querySelector('.term-screen');
    const playBtn = widget.querySelector('.term-play');
    const endBtn = widget.querySelector('.term-end');
    const speedSel = widget.querySelector('.term-speed');

    let timer = null;
    let playing = false;

    function stopTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
      playing = false;
      playBtn.textContent = t('term.replay', '↻ 重播');
    }

    function renderFinal() {
      stopTimer();
      screen.innerHTML = steps.map(s =>
        `<span class="${s.isCmd ? 'term-cmd' : 'term-out'}">${esc(s.line)}</span>`
      ).join('\n') + '\n';
    }

    function play() {
      stopTimer();
      screen.innerHTML = '';
      playing = true;
      playBtn.textContent = t('term.playing', '● 播放中');
      const speed = parseFloat(speedSel.value) || 1;
      let i = 0;
      let charIdx = 0;
      let currentSpan = null;

      const nextChar = () => {
        if (i >= steps.length) { stopTimer(); return; }
        const step = steps[i];
        if (step.isCmd) {
          if (charIdx === 0) {
            currentSpan = document.createElement('span');
            currentSpan.className = 'term-cmd';
            screen.appendChild(currentSpan);
            screen.appendChild(document.createTextNode('\n'));
          }
          currentSpan.textContent += step.line[charIdx];
          charIdx++;
          if (charIdx >= step.line.length) {
            // 命令打完：停顿后输出结果
            i++; charIdx = 0;
            timer = setTimeout(nextStep, 420 / speed);
            return;
          }
          timer = setTimeout(nextChar, 26 / speed);
        } else {
          // 输出行：整行闪现
          currentSpan = document.createElement('span');
          currentSpan.className = 'term-out';
          currentSpan.textContent = step.line;
          screen.appendChild(currentSpan);
          screen.appendChild(document.createTextNode('\n'));
          i++; charIdx = 0;
          timer = setTimeout(nextStep, 90 / speed);
        }
        screen.parentElement.scrollTop = screen.parentElement.scrollHeight;
      };

      const nextStep = () => nextChar();
      nextChar();
    }

    playBtn.addEventListener('click', play);
    endBtn.addEventListener('click', renderFinal);

    // prefers-reduced-motion：不打字，直接出结果
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      renderFinal();
    } else {
      screen.innerHTML = `<span class="term-idle">${esc(t('term.idle', '点击「播放」逐字回放；嫌慢可点「直接看结果」或调 4×。'))}</span>`;
    }

    // 离场清理：组件脱离 DOM 后停掉打字定时器
    const checkGone = setInterval(() => {
      if (!widget.isConnected) { stopTimer(); clearInterval(checkGone); }
    }, 2000);

    pre.parentNode.replaceChild(widget, pre);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block[data-lang]').forEach(pre => {
      const lang = String(pre.dataset.lang || '').trim();
      if (lang !== 'terminal' && lang !== 'term') return;
      try { widgetFor(pre); } catch (e) { /* 保留源码 */ }
    });
  }

  window.MarkdownPreview.renderers.terminal = { render };
})();
