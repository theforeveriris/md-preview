/**
 * editor/mermaid-pip - Mermaid 画中画
 *
 * 光标处于 ```mermaid 围栏内时，编辑器右下角浮出实时图形预览——
 * 双屏模式的延伸：不用跑 Cell，改一行看一笔。
 * 语法错误时在面板内给出错误信息（mermaid-pip 与后续「错误行号」共用此出口）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.editorModules = window.MarkdownPreview.editorModules || {};

  window.MarkdownPreview.editorModules.mermaidPip = {
    init: function(ctx) {
      const editorT = ctx.editorT;
      let panel = null;
      let stage = null;
      let errBox = null;
      let title = null;
      let closeBtn = null;
      let currentKey = '';
      let renderSeq = 0;
      let debounceTimer = null;

      function ensurePanel() {
        if (panel) return panel;
        panel = document.createElement('div');
        panel.className = 'mermaid-pip';
        panel.innerHTML = `
          <div class="mermaid-pip-head">
            <span class="mermaid-pip-title"></span>
            <button type="button" class="mermaid-pip-close" aria-label="关闭">✕</button>
          </div>
          <div class="mermaid-pip-stage"></div>
          <div class="mermaid-pip-error" hidden></div>`;
        document.body.appendChild(panel);
        stage = panel.querySelector('.mermaid-pip-stage');
        errBox = panel.querySelector('.mermaid-pip-error');
        title = panel.querySelector('.mermaid-pip-title');
        closeBtn = panel.querySelector('.mermaid-pip-close');
        title.textContent = editorT('pip.title', 'Mermaid 预览');
        closeBtn.addEventListener('click', () => {
          panel.classList.remove('open');
          currentKey = ''; // 关闭后光标重新进入再弹
        });
        return panel;
      }

      function getCursorOffset(cell) {
        try {
          return cell.editor.view.state.selection.main.head;
        } catch (e) {
          return 0;
        }
      }

      // 定位光标所在的 fenced code 块：返回 { lang, startLine, content } 或 null
      function currentFence(text, offset) {
        const lines = text.split('\n');
        let pos = 0;
        let inFence = null;
        let startLine = -1;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineEnd = pos + line.length;
          const m = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
          if (m) {
            if (!inFence) {
              inFence = { char: m[2][0], len: m[2].length, lang: m[3].trim() };
              startLine = i;
            } else if (m[2][0] === inFence.char && m[2].length >= inFence.len) {
              // 闭合围栏：光标在闭合行及之前 → 块结束
              if (offset <= lineEnd + 1) {
                return { lang: inFence.lang, startLine, content: lines.slice(startLine + 1, i).join('\n') };
              }
              inFence = null;
              startLine = -1;
            }
          }
          if (offset <= lineEnd + 1) {
            // 光标停在这一行（含行尾）
            if (inFence) {
              return { lang: inFence.lang, startLine, content: lines.slice(startLine + 1, i + 1).join('\n') };
            }
            return null;
          }
          pos = lineEnd + 1;
        }
        if (inFence) {
          return { lang: inFence.lang, startLine, content: lines.slice(startLine + 1).join('\n') };
        }
        return null;
      }

      function renderFence(src) {
        const seq = ++renderSeq;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          const reg = window.MarkdownPreview.renderers && window.MarkdownPreview.renderers.mermaid;
          if (!reg || !reg.ensureMermaid) return;
          const ok = await reg.ensureMermaid();
          if (seq !== renderSeq) return; // 期间又编辑了
          if (!ok) {
            stage.innerHTML = '';
            errBox.hidden = false;
            errBox.textContent = editorT('pip.libFailed', 'Mermaid 库加载失败');
            return;
          }
          try {
            const id = 'mermaid-pip-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            const { svg } = await mermaid.render(id, src);
            if (seq !== renderSeq) return;
            stage.dataset.src = src;
            stage.innerHTML = svg;
            errBox.hidden = true;
          } catch (e) {
            if (seq !== renderSeq) return;
            stage.innerHTML = '';
            errBox.hidden = false;
            errBox.textContent = editorT('pip.badSyntax', 'Mermaid 语法有问题：') +
              (e && e.message ? String(e.message).slice(0, 300) : String(e));
          }
        }, 400);
      }

      // editor.js bindCellEvents 在 input / keyup / click / focus 时调用
      function onCellActivity(cell) {
        if (!cell) return;
        const fence = currentFence(cell.textarea.value || '', getCursorOffset(cell));
        if (!fence || !/^mermaid$/i.test(fence.lang)) {
          if (panel && panel.classList.contains('open')) {
            panel.classList.remove('open');
            currentKey = '';
          }
          return;
        }
        ensurePanel();
        const key = cell.id + ':' + fence.startLine;
        const src = fence.content.trim();
        if (key !== currentKey || stage.dataset.src !== src) {
          currentKey = key;
          if (src) renderFence(src);
          else {
            stage.innerHTML = '';
            errBox.hidden = false;
            errBox.textContent = editorT('pip.empty', '在围栏内输入 mermaid 图形语法');
          }
        }
        panel.classList.add('open');
      }

      return { onCellActivity };
    }
  };
})();
