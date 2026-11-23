/**
 * editor/live-preview - 单文档「所见即所得」实时预览
 *
 * 编辑器不再按 Cell 分块运行：整篇 Markdown 只有一条源码、一个 CodeMirror
 * 实例。本模块为该实例提供 Typora / Obsidian 式的块级实时预览：
 *
 *   - 文档按空行切成顶层块（围栏代码、$$ 数学块、::: 容器内部的空行不算
 *     分隔符）；
 *   - 光标所在块保持 Markdown 源码，可直接编辑；
 *   - 其余块用站点同一条渲染管线（md-render）渲染成 HTML 就地展示；
 *   - 点击任意渲染块，光标落到对应源码块起始处，块立刻展开为源码。
 *
 * 渲染块是 CM6 的 block replace decoration，纯展示、不进选区；光标只要
 * 移进（或点击）某个渲染块，该块立刻恢复为源码，因此不会出现光标
 * 落在「看不见的位置」的盲区。
 *
 * 只依赖 CM6 的 StateField / Decoration / WidgetType，扩展本身不做任何
 * 业务渲染——渲染函数由 editor.js 注入（复用画廊、代码高亮、表格样式、
 * 各渲染器的完整管线）。
 */
(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  const CM = window.CodeMirror;
  if (!CM || !CM.StateField || !CM.StateEffect || !CM.Decoration || !CM.WidgetType || !CM.RangeSetBuilder) {
    console.error('[live-preview] CodeMirror 6 bundle 缺少 StateField/StateEffect/Decoration/WidgetType/RangeSetBuilder');
    return;
  }

  const { StateField, StateEffect, Decoration, WidgetType, EditorView, RangeSetBuilder } = CM;

  // 这些块的源码始终直接展示，不做替换：
  // frontmatter 是文档元信息，注释/脚本块渲染后为空会让用户以为内容丢了。
  const RAW_BLOCK = /^\s*(<!--|<\?|<script\b|<style\b|<template\b)/i;

  function isFenceOpen(text) {
    const m = /^\s*(`{3,}|~{3,})(.*)$/.exec(text);
    if (!m) return null;
    // 围栏开头行可带语言标记；单独一行的 ``` 也算正常开围栏
    return { char: m[1][0], len: m[1].length };
  }

  function isFenceClose(text, fence) {
    const m = /^\s*(`{3,}|~{3,})\s*$/.exec(text);
    return !!(m && m[1][0] === fence.char && m[1].length >= fence.len);
  }

  function isMathLine(text) {
    return /^\s*\$\$\s*$/.test(text);
  }

  function isContainerOpen(text) {
    return /^\s*:::\s*\S/.test(text);
  }

  function isContainerClose(text) {
    return /^\s*:::\s*$/.test(text);
  }

  /**
   * 扫出顶层块。返回 [{from,to,startLine,endLine,text,kind}]。
   *
   * 与「按空行 split」的区别：围栏代码 / $$ 数学块 / ::: 容器内部的空行
   * 不结束当前块，避免把一个多行图块拆成多个渲染块。
   */
  function computeBlocks(state) {
    const doc = state.doc;
    const blocks = [];
    let cur = null;

    function finish(endLine) {
      if (!cur) return;
      const first = doc.line(cur.startLine);
      const last = doc.line(endLine);
      const text = state.sliceDoc(first.from, last.to);
      blocks.push({
        from: first.from,
        to: last.to,
        startLine: cur.startLine,
        endLine: endLine,
        text,
        kind: cur.kind || 'text'
      });
      cur = null;
    }

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const text = line.text;
      const trimmed = text.trim();

      if (!cur) {
        if (!trimmed) continue;
        cur = { startLine: i, kind: 'text' };
        // 文档首行 --- 视为 frontmatter 起始（始终显示源码）
        if (i === 1 && /^---\s*$/.test(trimmed)) {
          cur.kind = 'frontmatter';
          cur.inFrontmatter = true;
          continue;
        }
      }

      if (cur.inFrontmatter) {
        if (i > cur.startLine && /^(---|\.\.\.)\s*$/.test(trimmed)) {
          finish(i);
        }
        continue;
      }

      // 连续列表行也属于同一个块；遇到下一个顶层标题时分开
      // （标题与正文未留空行时仍显示为单个 Markdown 块）。
      if (i > cur.startLine && !cur.fence && !cur.math && !cur.container &&
          /^#{1,6}\s/.test(text) && cur.kind !== 'frontmatter') {
        finish(i - 1);
        cur = { startLine: i, kind: 'text' };
      }

      if (cur.fence) {
        if (isFenceClose(text, cur.fence)) cur.fence = null;
        continue;
      }

      if (cur.math) {
        if (isMathLine(text)) cur.math = false;
        continue;
      }

      if (cur.container > 0) {
        if (isFenceOpen(text)) {
          cur.fence = isFenceOpen(text);
          if (!cur.kind || cur.kind === 'text') cur.kind = 'container';
          continue;
        }
        if (isContainerOpen(text)) { cur.container++; continue; }
        if (isContainerClose(text)) { cur.container--; continue; }
        continue;
      }

      if (!trimmed) {
        finish(i - 1);
        continue;
      }

      const fence = isFenceOpen(text);
      if (fence) {
        cur.fence = fence;
        cur.kind = 'fence';
        continue;
      }
      if (isMathLine(text)) {
        cur.math = true;
        cur.kind = 'math';
        continue;
      }
      if (isContainerOpen(text)) {
        cur.container = 1;
        cur.kind = 'container';
        continue;
      }
      // 表格块：连续的 | 行作为整体渲染，避免逐行断表
      if (/^\s*\|/.test(text)) {
        if (cur.kind === 'text') cur.kind = 'table';
        continue;
      }
    }
    finish(doc.lines);
    return blocks;
  }

  function shouldRenderBlock(block) {
    if (!block.text.trim()) return false;
    if (block.kind === 'frontmatter') return false;
    if (RAW_BLOCK.test(block.text)) return false;
    return true;
  }

  function blockIndexAt(blocks, pos) {
    let lo = 0, hi = blocks.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const b = blocks[mid];
      if (pos < b.from) hi = mid - 1;
      else if (pos > b.to) lo = mid + 1;
      else return mid;
    }
    return -1;
  }

  /**
   * 创建实时预览扩展。
   *
   * @param {Object} opts
   * @param {(el: HTMLElement, markdown: string) => void} opts.renderBlock
   *        把一个 Markdown 块渲染进给定容器（editor.js 注入）
   * @returns {import('@codemirror/state').Extension}
   */
  function createLivePreview(opts) {
    const renderBlock = opts && typeof opts.renderBlock === 'function'
      ? opts.renderBlock
      : function(el, markdown) { el.textContent = markdown; };

    class MarkdownBlockWidget extends WidgetType {
      constructor(text, kind) {
        super();
        this.text = text;
        this.kind = kind;
      }

      // 内容与类型一致即复用 DOM：编辑上方文本导致位置整体平移时，
      // 不重建图片 / 图表 / 代码高亮，避免闪烁和重复加载。
      eq(other) {
        return other.text === this.text && other.kind === this.kind;
      }

      get estimatedHeight() {
        const lines = this.text.split('\n').length;
        return Math.min(480, 26 + lines * 24);
      }

      toDOM(view) {
        const wrap = document.createElement('div');
        wrap.className = 'lp-block';
        wrap.dataset.lpKind = this.kind;
        wrap.setAttribute('contenteditable', 'false');
        wrap.setAttribute('spellcheck', 'false');

        // 渲染内容放在内层容器里：部分渲染器会把工具条插到「表格的父节点」，
        // 若表格直接挂在 widget 根节点上，插入点会跑出 widget、落到
        // CodeMirror 的 .cm-content 里并被当成用户输入回写文档。多一层
        // 容器后所有 DOM 改动都留在 widget 内部，CM 会忽略。
        const body = document.createElement('div');
        body.className = 'lp-block-body markdown-body';
        wrap.appendChild(body);

        try {
          renderBlock(body, this.text);
        } catch (e) {
          console.warn('[live-preview] 块渲染失败，回退为源码:', e);
          body.textContent = this.text;
        }

        // 渲染结果为空（纯 HTML 注释、空指令等）时回退显示源码，
        // 否则用户会看到「内容消失」。
        const hasVisual = body.textContent.trim() ||
          body.querySelector('img,svg,canvas,video,iframe,table,hr,input,button,.katex');
        if (!hasVisual) {
          wrap.classList.add('lp-block-fallback');
          body.textContent = this.text;
        }

        // 点击 → 光标落到该块源码，块自动展开（position 从 DOM 反查，
        // 因此 widget 复用后位置变化也总是准确的）。
        const enterSource = (e) => {
          if (e.type === 'mousedown' && e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          let pos = 0;
          try { pos = view.posAtDOM(wrap, 0); } catch (err) { pos = 0; }
          view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
          view.focus();
        };
        wrap.addEventListener('mousedown', enterSource);
        return wrap;
      }

      // 事件全部由上面的 mousedown 处理，避免 CM6 再把光标映射到
      // 替换区间内部（看不见的位置）。
      ignoreEvent() { return true; }

      destroy(dom) {
        // 插件按渲染根容器追踪定时器：内容渲染在内层 body 上，两者都清理。
        try {
          const plugins = window.MarkdownPreview.plugins;
          if (plugins && typeof plugins.dispose === 'function') {
            const body = dom.querySelector ? dom.querySelector('.lp-block-body') : null;
            if (body) plugins.dispose(body);
            plugins.dispose(dom);
          }
        } catch (e) { /* ignore */ }
      }
    }

    function build(state, cachedBlocks) {
      const focused = !!state.field(focusField, false);
      if (!state.doc.length) {
        return { blocks: [], focused, decorations: Decoration.none };
      }
      const blocks = cachedBlocks || computeBlocks(state);

      // 光标 / 选区所在的块保持源码：区块被替换后仍能在块内正常编辑。
      // 编辑器未聚焦时整篇按渲染结果展示（打开文档先看到成品，点哪块
      // 编辑哪块），避免一进来第一段就露出生涩的 Markdown 标记。
      const active = new Set();
      if (focused) {
        for (const range of state.selection.ranges) {
          const idx = blockIndexAt(blocks, range.from);
          if (idx < 0) continue;
          if (range.empty) {
            active.add(idx);
            continue;
          }
          // 跨块选区：把覆盖到的块全部展开，保证选中的内容可见
          for (let i = idx; i < blocks.length && blocks[i].from <= range.to; i++) {
            active.add(i);
          }
        }
      }

      const decoBuilder = new RangeSetBuilder();
      blocks.forEach((block, idx) => {
        if (active.has(idx)) return;
        if (!shouldRenderBlock(block)) return;
        decoBuilder.add(block.from, block.to, Decoration.replace({
          widget: new MarkdownBlockWidget(block.text, block.kind),
          block: true
        }));
      });

      return {
        blocks,
        focused,
        decorations: decoBuilder.finish()
      };
    }

    // 焦点状态：未聚焦时整篇渲染；聚焦后才展开光标所在块。
    const focusEffect = StateEffect.define();
    const focusField = StateField.define({
      create: () => false,
      update(value, tr) {
        for (const effect of tr.effects) {
          if (effect.is(focusEffect)) return !!effect.value;
        }
        return value;
      }
    });
    const focusTracker = EditorView.focusChangeEffect.of((view, focusing) =>
      focusEffect.of(!!focusing));

    // 方向键跨块导航：block widget 对光标是原子的，默认的 ↑/↓ 会把光标
    // 停在块之间的空行上（正文不可见）。这里在块边界直接落到相邻块的
    // 源码起始处，块内仍是逐行移动；空行上则跳到相邻块。
    function moveAcrossBlocks(view, dir) {
      const value = view.state.field(liveField, false);
      if (!value || !value.blocks.length || !view.state.selection.main.empty) return false;
      const blocks = value.blocks;
      const sel = view.state.selection.main;
      const line = view.state.doc.lineAt(sel.head);
      const idx = blockIndexAt(blocks, sel.head);
      let target = null;
      if (idx >= 0) {
        const b = blocks[idx];
        const atEdge = dir > 0 ? line.number >= b.endLine : line.number <= b.startLine;
        if (atEdge) target = dir > 0 ? blocks[idx + 1] : blocks[idx - 1];
      } else if (dir > 0) {
        target = blocks.find(b => b.from >= sel.head) || null;
      } else {
        for (let i = blocks.length - 1; i >= 0; i--) {
          if (blocks[i].to <= sel.head) { target = blocks[i]; break; }
        }
      }
      if (!target) return false;
      view.dispatch({ selection: { anchor: target.from }, scrollIntoView: true });
      return true;
    }

    const blockKeymap = CM.Prec.high(CM.keymap.of([
      { key: 'ArrowDown', run: view => moveAcrossBlocks(view, 1) },
      { key: 'ArrowUp', run: view => moveAcrossBlocks(view, -1) }
    ]));

    const liveField = StateField.define({
      create: (state) => build(state),
      update(value, tr) {
        const focused = !!tr.state.field(focusField, false);
        if (!tr.docChanged && !tr.selection && focused === value.focused) return value;
        // 光标移动只重算「哪个块展开」，文档没变时复用块切分结果
        return build(tr.state, tr.docChanged ? null : value.blocks);
      },
      provide: field => [
        EditorView.decorations.from(field, value => value.decorations)
      ]
    });

    // 顺序重要：focusField 必须先于 liveField 初始化，build 才能读到焦点
    return [focusField, focusTracker, blockKeymap, liveField];
  }

  window.MarkdownPreview.editorLivePreview = { create: createLivePreview };
})();
