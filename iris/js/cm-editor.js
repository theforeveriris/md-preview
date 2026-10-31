/**
 * CodeMirror 6 编辑器适配层
 * 封装 CM6 EditorView，提供与 textarea 兼容的 API
 * 使 editor.js 中的 textarea 操作代码可以最小化改动迁移到 CM6
 */
(function() {
  'use strict';

  const CM = window.CodeMirror;
  if (!CM) {
    console.error('[cm-editor] CodeMirror 6 bundle 未加载，请检查 iris/vendor/codemirror/codemirror.min.js');
    return;
  }

  const { EditorState, EditorView, EditorSelection, Compartment, Annotation, Transaction } = CM;

  // 用于标记程序化更新（不触发 input 回调）
  const programmaticUpdate = Annotation.define();

  /**
   * CodeMirrorEditor - textarea 的 drop-in replacement
   * 兼容属性：value, selectionStart, selectionEnd, scrollTop(只读), dataset
   * 兼容事件：input, focus, blur, scroll, keydown, keyup, click, select, mouseup
   */
  class CodeMirrorEditor {
    constructor(parentEl, options) {
      options = options || {};
      this._listeners = {};
      this.dataset = {};
      this._placeholder = options.placeholder || '';
      this._onInput = options.onInput;
      this._onFocus = options.onFocus;
      this._onBlur = options.onBlur;
      this._onScroll = options.onScroll;
      this._onSelectionChange = options.onSelectionChange;
      this._onKeyDown = options.onKeyDown;
      this._onKeyUp = options.onKeyUp;
      this._onClick = options.onClick;

      // 用 Compartment 支持运行时切换主题/字号/占位文本
      this._themeCompartment = new Compartment();
      this._fontSizeCompartment = new Compartment();
      this._placeholderCompartment = new Compartment();
      this._placeholderText = options.placeholder || '';

      const extensions = [
        CM.lineNumbers(),
        CM.history(),
        CM.drawSelection(),
        CM.highlightActiveLine(),
        CM.highlightActiveLineGutter(),
        CM.highlightSpecialChars(),
        CM.bracketMatching(),
        CM.closeBrackets(),
        CM.indentOnInput(),
        CM.indentUnit.of('  '),
        CM.syntaxHighlighting(CM.defaultHighlightStyle, { fallback: true }),
        CM.highlightSelectionMatches(),
        this._placeholderCompartment.of(CM.placeholder(this._placeholderText)),
        CM.EditorState.allowMultipleSelections.of(true),
        // Markdown 语法高亮
        CM.markdown({ base: CM.markdownLanguage }),
        // keymap
        CM.keymap.of([
          ...CM.closeBracketsKeymap,
          ...CM.defaultKeymap,
          ...CM.searchKeymap,
          ...CM.historyKeymap,
          ...CM.foldKeymap,
          ...CM.completionKeymap,
          CM.indentWithTab,
        ]),
        // 主题
        this._themeCompartment.of(this._getTheme(options.dark)),
        // 字号
        this._fontSizeCompartment.of(EditorView.theme({})),
        // update listener：统一处理 input/scroll/selection 事件
        EditorView.updateListener.of((update) => {
          // 检查是否为程序化更新（setValue），如果是则不触发 input 事件
          const isProgrammatic = update.transactions.some(t => t.annotation(programmaticUpdate));
          if (update.docChanged && !isProgrammatic) {
            this._dispatchEvent('input', { target: this });
            if (this._onInput) this._onInput({ target: this });
          }
          if (update.selectionSet) {
            this._dispatchEvent('select', { target: this });
            if (this._onSelectionChange) this._onSelectionChange({ target: this });
          }
          if (update.viewportChanged || update.scrolledRange) {
            this._dispatchEvent('scroll', { target: this });
            if (this._onScroll) this._onScroll({ target: this });
          }
          if (update.focusChanged) {
            if (update.view.hasFocus) {
              this._dispatchEvent('focus', { target: this });
              if (this._onFocus) this._onFocus({ target: this });
            } else {
              this._dispatchEvent('blur', { target: this });
              if (this._onBlur) this._onBlur({ target: this });
            }
          }
        }),
        // DOM 事件：keyup / click / mouseup
        // 注意：事件需要把 target 设为编辑器包装对象，
        // 否则 editor.js 通过 e.target.dataset.cellId 定位 cell 会拿到 CM6 的 .cm-content 节点而失效。
        // keydown 不走 domEventHandlers：本构建的 CM 内部 input handler 会对
        // keydown 短路 runHandlers，这里永远收不到（补全导航/回车应用/
        // Ctrl+Enter 因此全数失效）——改由下方捕获阶段监听接管。
        EditorView.domEventHandlers({
          keyup: (event) => {
            if (this._onKeyUp) this._onKeyUp(event);
            this._dispatchEvent('keyup', this._wrapKeyEvent(event));
            return false;
          },
          click: (event) => {
            if (this._onClick) this._onClick(event);
            this._dispatchEvent('click', { target: this });
            return false;
          },
          mouseup: (event) => {
            this._dispatchEvent('mouseup', { target: this });
            return false;
          },
        }),
      ];

      this.view = new EditorView({
        state: EditorState.create({
          doc: options.value || '',
          extensions,
        }),
        parent: parentEl,
      });

      this._parentEl = parentEl;
      // keydown 捕获监听（宿主元素上，先于 CM 在 contentDOM 的处理器执行）：
      // editor.js 的补全导航 / 快捷键调用 preventDefault 后，这里以
      // stopPropagation 拦下事件，CM 不再处理（否则 Enter 会先插换行、
      // 破坏补全上下文）
      this._captureKeydown = (event) => {
        if (this._onKeyDown) this._onKeyDown(event);
        this._dispatchEvent('keydown', this._wrapKeyEvent(event));
        if (event.defaultPrevented) event.stopPropagation();
      };
      parentEl.addEventListener('keydown', this._captureKeydown, true);

      // CM6 的 contentDOM 相当于 textarea
      this._contentDOM = this.view.contentDOM;
    }

    // ============== textarea 兼容属性 ==============

    get value() {
      return this.view.state.doc.toString();
    }

    set value(v) {
      this.setValue(v);
    }

    get selectionStart() {
      const sel = this.view.state.selection.main;
      return sel.from;
    }

    get selectionEnd() {
      const sel = this.view.state.selection.main;
      return sel.to;
    }

    set selectionStart(v) {
      this.setSelectionRange(v, this.selectionEnd);
    }

    set selectionEnd(v) {
      this.setSelectionRange(this.selectionStart, v);
    }

    // scrollTop 只读（写入走 CM6 自身滚动管理；文件头注释不再宣称可写）
    get scrollTop() {
      return this.view.scrollDOM.scrollTop;
    }

    /**
     * 占位文本 setter（运行时通过 Compartment 切换，无需重建编辑器）
     */
    set placeholder(text) {
      this._placeholderText = text;
      this.view.dispatch({
        effects: this._placeholderCompartment.reconfigure(CM.placeholder(text))
      });
    }

    get placeholder() {
      return this._placeholderText;
    }

    // ============== textarea 兼容方法 ==============

    focus() {
      this.view.focus();
    }

    blur() {
      if (this.view.hasFocus) this.view.contentDOM.blur();
    }

    setSelectionRange(start, end) {
      this.view.dispatch({
        selection: EditorSelection.single(start, end),
        scrollIntoView: true,
      });
    }

    select() {
      this.view.dispatch({
        selection: EditorSelection.single(0, this.view.state.doc.length),
      });
    }

    getBoundingClientRect() {
      return this.view.dom.getBoundingClientRect();
    }

    addEventListener(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    }

    removeEventListener(event, handler) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(h => h !== handler);
    }

    _dispatchEvent(event, payload) {
      if (!this._listeners[event]) return;
      for (const h of this._listeners[event]) {
        h(payload);
      }
    }

    /**
     * 将原始键盘 DOM 事件包装成 target=this 的兼容事件对象，
     * 保留 editor.js 快捷键处理所需的属性，并把 preventDefault/stopPropagation 委托回真实事件。
     */
    _wrapKeyEvent(event) {
      return {
        target: this,
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        isComposing: event.isComposing,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      };
    }

    // ============== 扩展 API ==============

    /**
     * 设置编辑器内容（程序化，不触发 undo 栈）
     */
    setValue(v) {
      const current = this.view.state.doc.toString();
      if (current === v) return;
      this.view.dispatch({
        changes: { from: 0, to: current.length, insert: v },
        annotations: [
          programmaticUpdate.of(true),
          // CM6 history 只认 addToHistory.of(false)：自定义注解压不住撤销栈，
          // 旧实现每次 setValue 产生一条独立历史，无法一次性撤销
          Transaction.addToHistory.of(false),
        ],
      });
    }

    /**
     * 在光标处插入文本
     */
    insertText(text) {
      const sel = this.view.state.selection.main;
      this.view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: EditorSelection.cursor(sel.from + text.length),
        scrollIntoView: true,
      });
    }

    /**
     * 替换指定范围
     */
    replaceRange(from, to, text) {
      this.view.dispatch({
        changes: { from, to, insert: text },
        selection: EditorSelection.cursor(from + text.length),
        scrollIntoView: true,
      });
    }

    /**
     * 在行首插入文本（用于格式化快捷键）
     * 注意：使用 EditorSelection.range 保持原选区位置（cursor() 的第二参数是 assoc 而非选区终点）
     */
    insertAtLineStart(prefix) {
      const state = this.view.state;
      const sel = state.selection.main;
      const lineStart = state.doc.lineAt(sel.from).from;
      const from = sel.from + prefix.length;
      const to = sel.to + prefix.length;
      this.view.dispatch({
        changes: { from: lineStart, to: lineStart, insert: prefix },
        selection: EditorSelection.range(from, to),
        scrollIntoView: true,
      });
    }

    /**
     * 包裹选中文本（用于 bold/italic/code 等）
     */
    wrapSelection(before, after) {
      after = after || before;
      const state = this.view.state;
      const sel = state.selection.main;
      const selected = state.sliceDoc(sel.from, sel.to);
      const newText = before + selected + after;
      this.view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: newText },
        // EditorSelection.range 保持包裹后的选区；cursor() 的第二参数是
        // assoc 而非选区终点（旧 Bug：加粗/斜体后选区丢失）
        selection: EditorSelection.range(sel.from + before.length, sel.from + before.length + selected.length),
        scrollIntoView: true,
      });
    }

    /**
     * 撤销
     */
    undo() { CM.undo(this.view); }

    /**
     * 重做
     */
    redo() { CM.redo(this.view); }

    /**
     * 设置字号
     */
    setFontSize(px) {
      this.view.dispatch({
        effects: this._fontSizeCompartment.reconfigure(
          EditorView.theme({
            '.cm-content': { fontSize: px + 'px' },
            '.cm-gutters': { fontSize: px + 'px' },
          })
        )
      });
    }

    /**
     * 切换暗色主题
     */
    setDarkMode(dark) {
      this.view.dispatch({
        effects: this._themeCompartment.reconfigure(this._getTheme(dark))
      });
    }

    /**
     * 编辑区主题：颜色全部走站点主题 CSS 变量（var()），主题切换时画布
     * 自动跟随，不再出现「站点暗色主题 + 编辑器亮色画布」的深底白卡。
     * dark 参数只影响 CM6 内部的明暗态样式选择（如默认高亮风格回退），
     * 由 editor.js 按站点 data-mode 同步（见 editor-dark-mode 联动）。
     */
    _getTheme(dark) {
      return EditorView.theme({
        '&': {
          // 画布用 --color-bg（cell 是 surface，编辑区取页面底色形成微色差内嵌感，
          // 与 editor.css .cell-editor-wrap 一致）
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
        },
        '.cm-content': { caretColor: 'var(--color-text)' },
        '.cm-gutters': {
          backgroundColor: 'color-mix(in srgb, var(--color-text) 3%, var(--color-bg))',
          color: 'var(--color-text-muted)',
          border: 'none',
        },
        '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-text) 4%, transparent)' },
        '.cm-activeLineGutter': { backgroundColor: 'color-mix(in srgb, var(--color-text) 5%, transparent)' },
        '.cm-selectionBackground, ::selection': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent-purple) 25%, transparent)',
        },
        '.cm-cursor': { borderLeftColor: 'var(--color-text)' },
        '.cm-matchingBracket': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent-purple) 20%, transparent)',
        },
      }, { dark: !!dark });
    }

    /**
     * 获取光标所在的行内容（用于自动补全触发判断）
     */
    getLineBeforeCursor() {
      const state = this.view.state;
      const pos = state.selection.main.head;
      const line = state.doc.lineAt(pos);
      return line.text.substring(0, pos - line.from);
    }

    /**
     * 获取光标所在行的起始位置
     */
    getLineStart() {
      const state = this.view.state;
      return state.doc.lineAt(state.selection.main.head).from;
    }

    /**
     * 替换行首的指定长度文本（用于自动补全）
     * @param {number} replaceLength - 替换前缀长度
     * @param {string} newText - 插入文本
     * @param {string} [swallowCloser] - 若插入点紧邻该配对闭符则一并删除
     *   （closeBrackets 自动补出的 `]` 等会残留在补全结果之后）
     */
    replaceAtLineStart(replaceLength, newText, swallowCloser) {
      const state = this.view.state;
      const lineStart = state.doc.lineAt(state.selection.main.head).from;
      const prefixEnd = lineStart + replaceLength;
      const changes = [{ from: lineStart, to: prefixEnd, insert: newText }];
      if (swallowCloser && state.doc.sliceString(prefixEnd, prefixEnd + 1) === swallowCloser) {
        changes.push({ from: prefixEnd, to: prefixEnd + 1, insert: '' });
      }
      this.view.dispatch({
        changes,
        selection: EditorSelection.cursor(lineStart + newText.length),
        scrollIntoView: true,
      });
    }

    /**
     * 获取当前光标行列位置
     */
    getCursorPos() {
      const state = this.view.state;
      const pos = state.selection.main.head;
      const line = state.doc.lineAt(pos);
      return {
        line: line.number,
        col: pos - line.from + 1,
      };
    }

    /**
     * 销毁编辑器
     */
    destroy() {
      if (this._parentEl && this._captureKeydown) {
        this._parentEl.removeEventListener('keydown', this._captureKeydown, true);
      }
      this.view.destroy();
      this._listeners = {};
    }
  }

  window.CodeMirrorEditor = CodeMirrorEditor;
})();
