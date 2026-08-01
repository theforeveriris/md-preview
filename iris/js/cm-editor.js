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

  const { EditorState, EditorView, EditorSelection, Compartment, Annotation } = CM;

  // 用于标记程序化更新（不触发 input 回调）
  const programmaticUpdate = Annotation.define();

  /**
   * CodeMirrorEditor - textarea 的 drop-in replacement
   * 兼容属性：value, selectionStart, selectionEnd, scrollTop, dataset
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
        // DOM 事件：keydown / keyup / click / mouseup
        EditorView.domEventHandlers({
          keydown: (event) => {
            if (this._onKeyDown) this._onKeyDown(event);
            this._dispatchEvent('keydown', event);
            return false; // 不阻止默认行为，让 CM6 keymap 优先处理
          },
          keyup: (event) => {
            if (this._onKeyUp) this._onKeyUp(event);
            this._dispatchEvent('keyup', event);
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

    // ============== 扩展 API ==============

    /**
     * 设置编辑器内容（程序化，不触发 undo 栈）
     */
    setValue(v) {
      const current = this.view.state.doc.toString();
      if (current === v) return;
      this.view.dispatch({
        changes: { from: 0, to: current.length, insert: v },
        annotations: programmaticUpdate.of(true),
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
     */
    insertAtLineStart(prefix) {
      const state = this.view.state;
      const sel = state.selection.main;
      const lineStart = state.doc.lineAt(sel.from).from;
      this.view.dispatch({
        changes: { from: lineStart, to: lineStart, insert: prefix },
        selection: EditorSelection.cursor(sel.from + prefix.length, sel.to + prefix.length),
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
        selection: EditorSelection.cursor(sel.from + before.length, sel.from + before.length + selected.length),
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

    _getTheme(dark) {
      if (dark) {
        return EditorView.theme({
          '&': { backgroundColor: '#1e1e2e', color: '#e0e0e8' },
          '.cm-content': { caretColor: '#e0e0e8' },
          '.cm-gutters': { backgroundColor: '#181828', color: '#6c6c80', border: 'none' },
          '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
          '.cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.06)', color: '#e0e0e8' },
          '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(108,108,160,0.3)' },
          '.cm-cursor': { borderLeftColor: '#e0e0e8' },
          '.cm-matchingBracket': { backgroundColor: 'rgba(108,108,160,0.25)' },
        }, { dark: true });
      }
      return EditorView.theme({
        '&': { backgroundColor: '#ffffff', color: '#333' },
        '.cm-content': { caretColor: '#333' },
        '.cm-gutters': { backgroundColor: '#fafafa', color: '#aaa', border: 'none' },
        '.cm-activeLine': { backgroundColor: 'rgba(0,0,0,0.03)' },
        '.cm-activeLineGutter': { backgroundColor: 'rgba(0,0,0,0.05)', color: '#333' },
        '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(100,150,255,0.2)' },
        '.cm-cursor': { borderLeftColor: '#333' },
        '.cm-matchingBracket': { backgroundColor: 'rgba(100,150,255,0.15)' },
      });
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
     */
    replaceAtLineStart(replaceLength, newText) {
      const lineStart = this.getLineStart();
      this.view.dispatch({
        changes: { from: lineStart, to: lineStart + replaceLength, insert: newText },
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
      this.view.destroy();
      this._listeners = {};
    }
  }

  window.CodeMirrorEditor = CodeMirrorEditor;
})();
