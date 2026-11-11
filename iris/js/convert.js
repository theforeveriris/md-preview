/**
 * 导入 / 导出转换工具（G1 HTML→MD、G2 干净 CommonMark、G3 Obsidian 导入）
 *
 * 悬浮球菜单新增「转换」按钮，打开模态框：
 *   - HTML → Markdown：粘贴 HTML 或选择 .html 文件，转换为可读 Markdown
 *   - Obsidian → Markdown：选择 .md 文件，转换 wiki link / callout / 标签 / 高亮
 *   - 导出当前文档：生成干净 CommonMark/GFM 并复制 / 下载
 *
 * 所有转换结果都提供「复制」「下载」「复制结果」按钮。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  let modal = null;

  function openModal() {
    if (modal) { modal.classList.add('convert-open'); return; }
    modal = document.createElement('div');
    modal.className = 'convert-modal';
    modal.innerHTML = `
      <div class="convert-panel" role="dialog" aria-modal="true" aria-label="转换工具">
        <div class="convert-head">
          <strong>${esc(t('convert.title', '转换工具'))}</strong>
          <button type="button" class="convert-close" aria-label="关闭">×</button>
        </div>
        <div class="convert-tabs">
          <button type="button" class="convert-tab is-active" data-tab="html">${esc(t('convert.tabHtml', 'HTML 导入'))}</button>
          <button type="button" class="convert-tab" data-tab="obsidian">${esc(t('convert.tabObsidian', 'Obsidian 导入'))}</button>
          <button type="button" class="convert-tab" data-tab="export">${esc(t('convert.tabExport', '导出 Markdown'))}</button>
        </div>

        <div class="convert-pane" data-pane="html">
          <div class="convert-row">
            <button type="button" class="convert-filebtn" data-pick="html">${esc(t('convert.pickFile', '选择 HTML 文件'))}</button>
            <input type="file" accept=".html,.htm,text/html" class="convert-file" hidden>
          </div>
          <textarea class="convert-input" placeholder="${esc(t('convert.htmlPlaceholder', '粘贴 HTML…'))}" aria-label="${esc(t('convert.htmlLabel', 'HTML 输入'))}"></textarea>
          <div class="convert-actions">
            <button type="button" class="convert-run" data-run="html">${esc(t('convert.run', '转换'))}</button>
            <button type="button" class="convert-copyout" data-copy="html">${esc(t('convert.copy', '复制结果'))}</button>
            <button type="button" class="convert-download" data-download="html">${esc(t('convert.download', '下载'))}</button>
          </div>
          <textarea class="convert-output" readonly placeholder="${esc(t('convert.resultPlaceholder', '转换结果…'))}" aria-label="${esc(t('convert.resultLabel', '结果'))}"></textarea>
        </div>

        <div class="convert-pane" data-pane="obsidian" hidden>
          <div class="convert-row">
            <button type="button" class="convert-filebtn" data-pick="md">${esc(t('convert.pickMd', '选择 .md 文件'))}</button>
            <input type="file" accept=".md,.markdown" multiple class="convert-file" hidden>
          </div>
          <textarea class="convert-input" placeholder="${esc(t('convert.obsidianPlaceholder', '粘贴 Obsidian Markdown…'))}" aria-label="${esc(t('convert.htmlLabel', '输入'))}"></textarea>
          <div class="convert-actions">
            <button type="button" class="convert-run" data-run="obsidian">${esc(t('convert.run', '转换'))}</button>
            <button type="button" class="convert-copyout" data-copy="obsidian">${esc(t('convert.copy', '复制结果'))}</button>
            <button type="button" class="convert-download" data-download="obsidian">${esc(t('convert.download', '下载'))}</button>
          </div>
          <textarea class="convert-output" readonly placeholder="${esc(t('convert.resultPlaceholder', '转换结果…'))}" aria-label="${esc(t('convert.resultLabel', '结果'))}"></textarea>
        </div>

        <div class="convert-pane" data-pane="export" hidden>
          <p class="convert-hint">${esc(t('convert.exportHint', '将当前文档导出为干净 CommonMark/GFM（去除站点私有注释）。'))}</p>
          <div class="convert-actions">
            <button type="button" class="convert-run" data-run="export">${esc(t('convert.exportRun', '生成并复制'))}</button>
            <button type="button" class="convert-download" data-download="export">${esc(t('convert.download', '下载'))}</button>
          </div>
          <textarea class="convert-output" readonly placeholder="${esc(t('convert.resultPlaceholder', '导出结果…'))}" aria-label="${esc(t('convert.resultLabel', '结果'))}"></textarea>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.classList.add('convert-open');
    bindModal();
  }

  function closeModal() {
    if (modal) modal.classList.remove('convert-open');
  }

  function bindModal() {
    modal.querySelector('.convert-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.querySelectorAll('.convert-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.convert-tab').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        modal.querySelectorAll('.convert-pane').forEach(p => { p.hidden = p.dataset.pane !== btn.dataset.tab; });
      });
    });
    modal.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = modal.querySelector('.convert-file');
        input.dataset.kind = btn.dataset.pick;
        input.value = '';
        input.click();
      });
    });
    modal.querySelector('.convert-file').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const kind = e.target.dataset.kind;
        const pane = kind === 'md' ? modal.querySelector('[data-pane="obsidian"]') : modal.querySelector('[data-pane="html"]');
        const ta = pane.querySelector('textarea.convert-input') || pane;
        ta.value = String(reader.result || '');
      };
      reader.readAsText(file);
    });
    modal.querySelectorAll('[data-run]').forEach(btn => {
      btn.addEventListener('click', () => run(btn.dataset.run));
    });
    modal.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => copyOut(btn.dataset.copy));
    });
    modal.querySelectorAll('[data-download]').forEach(btn => {
      btn.addEventListener('click', () => downloadOut(btn.dataset.download));
    });
  }

  function out(tab) {
    const pane = modal.querySelector('[data-pane="' + tab + '"]');
    return pane.querySelector('textarea.convert-output');
  }

  function run(tab) {
    try {
      if (tab === 'html') {
        const html = modal.querySelector('[data-pane="html"] textarea.convert-input').value;
        out('html').value = htmlToMarkdown(html);
      } else if (tab === 'obsidian') {
        const md = modal.querySelector('[data-pane="obsidian"] textarea.convert-input').value ||
          (modal.__obsidianFiles ? modal.__obsidianFiles.map(f => f.text).join('\n\n') : '');
        out('obsidian').value = md ? obsidianToMarkdown(md) : '';
      } else if (tab === 'export') {
        const md = window.MarkdownPreview.state?.currentMarkdown || '';
        out('export').value = toCommonMark(md);
      }
    } catch (e) {
      out(tab).value = t('convert.error', '转换失败') + ': ' + (e && e.message || e);
    }
  }

  function copyOut(tab) {
    const text = out(tab).value;
    if (!text) return;
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  }

  function downloadOut(tab) {
    const text = out(tab).value;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (window.MarkdownPreview.state?.currentFilePath || tab) + '.md';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  // ============== G1 HTML → Markdown ==============
  function htmlToMarkdown(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll('script, style, noscript').forEach(n => n.remove());
    const block = document.createElement('div');
    block.appendChild(doc.body.cloneNode(true));
    return nodesToMarkdown(block.childNodes, 0).replace(/\n{3,}/g, '\n\n').trim();
  }

  function nodesToMarkdown(nodes, depth) {
    let out = '';
    Array.from(nodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) { out += node.textContent; return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName.toLowerCase();
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      switch (tag) {
        case 'h1': out += '\n# ' + text + '\n\n'; break;
        case 'h2': out += '\n## ' + text + '\n\n'; break;
        case 'h3': out += '\n### ' + text + '\n\n'; break;
        case 'h4': out += '\n#### ' + text + '\n\n'; break;
        case 'h5': out += '\n##### ' + text + '\n\n'; break;
        case 'h6': out += '\n###### ' + text + '\n\n'; break;
        case 'hr': out += '\n---\n\n'; break;
        case 'p': out += '\n\n' + inlineToMarkdown(node) + '\n\n'; break;
        case 'br': out += '\n'; break;
        case 'strong': case 'b': out += '**' + inlineToMarkdown(node) + '**'; break;
        case 'em': case 'i': out += '*' + inlineToMarkdown(node) + '*'; break;
        case 'del': case 's': out += '~~' + inlineToMarkdown(node) + '~~'; break;
        case 'mark': out += '==' + inlineToMarkdown(node) + '=='; break;
        case 'code': out += '`' + node.textContent + '`'; break;
        case 'pre': out += '\n\n```\n' + node.textContent.replace(/\n+$/, '') + '\n```\n\n'; break;
        case 'blockquote': out += '\n> ' + nodesToMarkdown(node.childNodes, depth).replace(/\n/g, '\n> ').trim() + '\n\n'; break;
        case 'a': {
          const href = node.getAttribute('href') || '';
          out += href ? '[' + inlineToMarkdown(node) + '](' + href + ')' : inlineToMarkdown(node);
          break;
        }
        case 'img': {
          const src = node.getAttribute('src') || '';
          const alt = node.getAttribute('alt') || '';
          out += src ? '![' + alt + '](' + src + ')' : alt;
          break;
        }
        case 'ul': out += '\n' + listToMarkdown(node, '-', depth); break;
        case 'ol': out += '\n' + listToMarkdown(node, null, depth); break;
        case 'li': out += '- ' + inlineToMarkdown(node) + '\n'; break;
        case 'table': out += '\n' + tableToMarkdown(node) + '\n'; break;
        default: out += nodesToMarkdown(node.childNodes, depth);
      }
    });
    return out;
  }

  function inlineToMarkdown(node) {
    let out = '';
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) { out += child.textContent; return; }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const tag = child.tagName.toLowerCase();
      const inner = inlineToMarkdown(child);
      if (tag === 'strong' || tag === 'b') out += '**' + inner + '**';
      else if (tag === 'em' || tag === 'i') out += '*' + inner + '*';
      else if (tag === 'del' || tag === 's') out += '~~' + inner + '~~';
      else if (tag === 'mark') out += '==' + inner + '==';
      else if (tag === 'code') out += '`' + child.textContent + '`';
      else if (tag === 'a') {
        const href = child.getAttribute('href') || '';
        out += href ? '[' + inner + '](' + href + ')' : inner;
      } else if (tag === 'img') {
        out += '![' + (child.getAttribute('alt') || '') + '](' + (child.getAttribute('src') || '') + ')';
      } else if (tag === 'br') out += '  \n';
      else out += inner;
    });
    return out;
  }

  function listToMarkdown(list, bullet, depth) {
    const items = Array.from(list.children).filter(el => el.tagName === 'LI');
    return items.map((li, i) => {
      const marker = bullet ? bullet : (i + 1) + '.';
      const pad = '  '.repeat(depth);
      return pad + marker + ' ' + inlineToMarkdown(li).replace(/\n/g, '\n' + pad + '  ');
    }).join('\n');
  }

  function tableToMarkdown(table) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return '';
    const cells = row => Array.from(row.children).filter(el => /^(TH|TD)$/i.test(el.tagName)).map(c => c.textContent.replace(/\s+/g, ' ').trim());
    const header = cells(rows[0]);
    const body = rows.slice(1).map(cells);
    const line = (arr) => '| ' + arr.join(' | ') + ' |';
    let out = line(header) + '\n| ' + header.map(() => '---').join(' | ') + ' |';
    body.forEach(r => { out += '\n' + line(r); });
    return out;
  }

  // ============== G3 Obsidian → Markdown ==============
  function obsidianToMarkdown(text) {
    let md = String(text || '');
    // callout: > [!note] Title\n> body → > **note · Title**\n> body
    md = md.replace(/^> \[!(note|tip|warning|danger|info|quote|success|question)\]\s*([^\n]*)\n((?:>.*\n?)*)/gmi,
      (m, kind, title, body) => {
        const t = (title || '').trim();
        const lines = body.split('\n').map(l => l.replace(/^>\s?/, '')).join('\n');
        return '> **' + kind + (t ? ' · ' + t : '') + '**\n>\n> ' + lines.replace(/\n/g, '\n> ');
      });
    // embed ![[file|alt]] → ![[file]] keep but convert to image if image ext
    md = md.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, name, alt) => {
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (/^(png|jpe?g|gif|webp|svg|bmp)$/.test(ext)) return '![' + (alt || '') + '](' + name + ')';
      return '[[' + name + (alt ? '|' + alt : '') + ']]';
    });
    // wiki link [[name|alias]] → [alias](name.md)；[[name]] → [name](name.md)
    md = md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, name, alias) =>
      '[' + (alias || name) + '](' + name + '.md)');
    // 行内标签 #tag → 保留；frontmatter tags 由文档自身处理
    // ==高亮== 保留（md-preview 支持）
    return md;
  }

  // ============== G2 干净 CommonMark 导出 ==============
  function toCommonMark(md) {
    return String(md || '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/<!--\s*table-style:[^>]*-->\s*\n?/g, '')
      .replace(/\s+$/gm, '')
      .trim() + '\n';
  }

  function init() {
    const btn = document.getElementById('convertBtn');
    if (!btn) return;
    btn.addEventListener('click', openModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('convert-open')) closeModal();
    });
  }

  window.MarkdownPreview.convert = {
    htmlToMarkdown, obsidianToMarkdown, toCommonMark, openModal, closeModal
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
