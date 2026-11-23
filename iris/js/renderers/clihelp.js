/**
 * CLI --help 渲染器（A5）
 *
 * Markdown 语法：
 *   ```clihelp
 *   Usage: iris [options] [command]
 *
 *   Options:
 *     -V, --version      输出版本号
 *     -h, --help         显示帮助
 *     --config <path>    配置文件路径
 *   ```
 *
 * 解析常见 `--help` 输出：Usage、选项（短/长/参数/描述）、子命令、示例。
 * 渲染为结构化帮助卡片；无法识别时回退为代码块。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function parseHelp(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s+$/, ''));
    let usage = '';
    const options = [];
    const commands = [];
    const examples = [];
    let section = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) { continue; }
      const usageM = /^(?:Usage|用法)\s*[:：]\s*(.+)$/i.exec(line);
      if (usageM) { usage = usageM[1].trim(); section = 'options'; continue; }
      const sectionM = /^(Options|Commands|Arguments|Examples|选项|子命令|参数|示例)\s*[:：]?$/i.exec(line);
      if (sectionM) {
        const s = sectionM[1].toLowerCase();
        section = (s === 'options' || s === '选项' || s === 'arguments' || s === '参数') ? 'options'
          : (s === 'commands' || s === '子命令') ? 'commands' : 'examples';
        continue;
      }
      // 选项行：-V, --long <arg>  desc / --long <arg>  desc / -x  desc
      // 参数列兼容 <path>、[n]、=value、以及「与说明间隔 ≥2 空格的裸词」
      const optM = /^\s*(-[a-zA-Z]\s*,\s*)?(--[a-zA-Z0-9-]+|-[a-zA-Z])\s*(<[^>]+>|\[[^\]]+\]|=[^ ]+|\S+)?\s{2,}(.+)$/.exec(line);
      if (optM && section !== 'commands' && section !== 'examples') {
        const flagPart = optM[2];
        const short = (optM[1] ? optM[1].replace(/[,\s]+$/, '') : '') || (flagPart.startsWith('-') && !flagPart.startsWith('--') ? flagPart : '');
        const long = flagPart.startsWith('--') ? flagPart : '';
        options.push({ short, long, args: optM[3] || '', desc: optM[4].trim() });
        continue;
      }
      // 续行：深度缩进的描述并入上一条选项
      const contM = /^\s{6,}(\S.*)$/.exec(line);
      if (contM && section === 'options' && options.length && !/^(-|--)/.test(contM[1])) {
        options[options.length - 1].desc += ' ' + contM[1].trim();
        continue;
      }
      if (section === 'commands') {
        const cm = /^\s*([a-zA-Z][\w:-]*)\s*(?:\s{2,}(.+))?$/.exec(line);
        if (cm) commands.push({ name: cm[1], desc: (cm[2] || '').trim() });
        continue;
      }
      if (section === 'examples') {
        examples.push(line.trim());
        continue;
      }
      if (!usage && /^(?:Usage|用法)/i.test(line)) { usage = line; }
    }
    return { usage, options, commands, examples };
  }

  function renderFence(pre) {
    const parsed = parseHelp(pre.querySelector('code')?.textContent || '');
    if (!parsed.usage && !parsed.options.length && !parsed.commands.length) return false;
    const widget = document.createElement('div');
    widget.className = 'clihelp-view';

    if (parsed.usage) {
      const u = document.createElement('div');
      u.className = 'clihelp-usage';
      u.textContent = parsed.usage;
      widget.appendChild(u);
    }
    if (parsed.options.length) {
      const sec = document.createElement('section');
      sec.className = 'clihelp-section';
      sec.innerHTML = '<h4>' + esc(t('clihelp.options', '选项')) + '</h4>';
      const table = document.createElement('table');
      table.innerHTML = '<thead><tr><th>' + esc(t('clihelp.colOption', '选项')) + '</th><th>' +
        esc(t('clihelp.colArg', '参数')) + '</th><th>' + esc(t('clihelp.colDesc', '说明')) + '</th></tr></thead>';
      const tbody = document.createElement('tbody');
      parsed.options.forEach(o => {
        const tr = document.createElement('tr');
        const flags = [o.short, o.long].filter(Boolean)
          .map(f => '<code>' + esc(f) + '</code>').join(' ');
        tr.innerHTML =
          '<td>' + (flags || '—') + '</td>' +
          '<td>' + (o.args ? '<code>' + esc(o.args) + '</code>' : '') + '</td>' +
          '<td>' + esc(o.desc) + '</td>';
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      sec.appendChild(table);
      widget.appendChild(sec);
    }
    if (parsed.commands.length) {
      const sec = document.createElement('section');
      sec.className = 'clihelp-section';
      sec.innerHTML = '<h4>' + esc(t('clihelp.commands', '子命令')) + '</h4>';
      const list = document.createElement('ul');
      list.className = 'clihelp-commands';
      parsed.commands.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = '<code>' + esc(c.name) + '</code>' + (c.desc ? '<span>' + esc(c.desc) + '</span>' : '');
        list.appendChild(li);
      });
      sec.appendChild(list);
      widget.appendChild(sec);
    }
    if (parsed.examples.length) {
      const sec = document.createElement('section');
      sec.className = 'clihelp-section';
      sec.innerHTML = '<h4>' + esc(t('clihelp.examples', '示例')) + '</h4>';
      const pre2 = document.createElement('pre');
      pre2.className = 'code-block';
      const code = document.createElement('code');
      code.textContent = parsed.examples.join('\n');
      pre2.appendChild(code);
      sec.appendChild(pre2);
      widget.appendChild(sec);
    }

    pre.replaceWith(widget);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block').forEach(pre => {
      if (pre.dataset.clihelpDone) return;
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      if (lang === 'clihelp') {
        pre.dataset.clihelpDone = '1';
        renderFence(pre);
      }
    });
  }

  window.MarkdownPreview.renderers.clihelp = { render };
})();
