/**
 * TikZ / PGF 渲染器
 *
 * Markdown 语法：
 *   ```tikz
 *   \draw[thick] (0,0) -- (2,0) -- (2,2) -- cycle;
 *   \node at (1,1) {TikZ};
 *   ```
 *
 * 支持两种写法：
 *   1. 只写 tikzpicture 内容，渲染器自动补全 standalone 文档；
 *   2. 写完整的 \documentclass ... \end{document}，原样交给 Kroki。
 *
 * 渲染由 Kroki 的 tikz 服务完成（外部服务）。Kroki 的 LaTeX 环境不含
 * CJK 宏包，TikZ 图里的文字请使用英文或数学公式。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const PREAMBLE_RE = /^\s*\\(usetikzlibrary|usepackage|definecolor|colorlet|tikzset|pgfplotsset)\b/;

  function braceBalance(text) {
    let depth = 0;
    let quote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\\') { i++; continue; }
      if (ch === '%' && !quote) break;
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    return depth;
  }

  // 把 \usetikzlibrary / \tikzset{...} 等多行导言区命令与正文分开
  function splitPreamble(text) {
    const lines = text.split(/\r?\n/);
    const pre = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (!PREAMBLE_RE.test(line)) break;
      let chunk = line;
      let depth = braceBalance(line);
      i++;
      while (depth > 0 && i < lines.length) {
        chunk += '\n' + lines[i];
        depth += braceBalance(lines[i]);
        i++;
      }
      pre.push(chunk);
    }
    return { preamble: pre.join('\n'), body: lines.slice(i).join('\n').trim() };
  }

  // 把简短片段包成 Kroki 能接受的完整 LaTeX 文档
  function wrap(source) {
    const raw = String(source || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return raw;
    if (/\\documentclass\b/.test(raw)) return raw;

    const parsed = splitPreamble(raw);
    const preamble = parsed.preamble;
    let body = parsed.body;

    if (/\\begin\{document\}/.test(body)) {
      return '\\documentclass[tikz,border=6pt]{standalone}\n' +
        preamble + (preamble ? '\n' : '') +
        body;
    }
    if (!/\\begin\{tikzpicture\}/.test(body)) {
      body = '\\begin{tikzpicture}\n' + body + '\n\\end{tikzpicture}';
    }
    return '\\documentclass[tikz,border=6pt]{standalone}\n' +
      preamble + (preamble ? '\n' : '') +
      '\\begin{document}\n' + body + '\n\\end{document}';
  }

  function client() {
    return window.MarkdownPreview.krokiClient;
  }

  async function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang^="tikz"], pre.code-block[data-lang^="pgf"]');
    for (const pre of blocks) {
      if (pre.dataset.krokiDone) continue;
      pre.dataset.krokiDone = '1';
      const c = client();
      if (!c) continue;
      try {
        await c.renderBlock(pre, 'tikz', {
          containerClass: 'tikz-diagram',
          alt: 'TikZ diagram',
          transform: wrap
        });
      } catch (e) {
        console.warn('[tikz] render failed:', e);
      }
    }
  }

  window.MarkdownPreview.renderers.tikz = {
    render: render,
    wrap: wrap
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { wrap: wrap };
  }
})();
