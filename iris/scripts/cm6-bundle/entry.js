// CodeMirror 6 打包入口
// 重建命令（cm6-bundle 目录下）：
//   npx esbuild entry.js --bundle --minify --format=iife //     --outfile=../../vendor/codemirror/codemirror.min.js
// 导出面 = cm-editor.js 实际使用的最小集合（此前导出了 autocompletion/
// search/foldGutter 等 14 项未用 API，白白增大 vendor 体积）
// 将 CM6 核心模块打包为单一 IIFE bundle，暴露到 window.CodeMirror
import { EditorState, Compartment, Transaction, Annotation, EditorSelection, Prec } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, highlightSpecialChars, placeholder
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo
} from '@codemirror/commands';
import {
  indentOnInput, bracketMatching, foldKeymap, indentUnit,
  syntaxHighlighting, defaultHighlightStyle
} from '@codemirror/language';
import { completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';

const CodeMirrorAPI = {
  // state
  EditorState,
  Compartment,
  Transaction,
  Annotation,
  EditorSelection,
  Prec,
  // view
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  highlightSpecialChars,
  placeholder,
  // commands
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
  // language
  indentOnInput,
  bracketMatching,
  foldKeymap,
  indentUnit,
  syntaxHighlighting,
  defaultHighlightStyle,
  // autocomplete
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  // search
  searchKeymap,
  highlightSelectionMatches,
  // markdown
  markdown,
  markdownLanguage,
};

// 多环境全局赋值
if (typeof globalThis !== 'undefined') globalThis.CodeMirror = CodeMirrorAPI;
if (typeof window !== 'undefined') window.CodeMirror = CodeMirrorAPI;
if (typeof self !== 'undefined') self.CodeMirror = CodeMirrorAPI;
