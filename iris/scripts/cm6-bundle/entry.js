// CodeMirror 6 打包入口
// 将 CM6 核心模块打包为单一 IIFE bundle，暴露到 window.CodeMirror
import { EditorState, Compartment, Transaction, Annotation, EditorSelection, Prec } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, highlightSpecialChars, rectangularSelection, crosshairCursor,
  placeholder, ViewPlugin, Decoration, WidgetType
} from '@codemirror/view';
import {
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo,
  selectAll, undoSelection, redoSelection
} from '@codemirror/commands';
import {
  indentOnInput, bracketMatching, foldGutter, foldKeymap, indentUnit,
  LanguageDescription, syntaxHighlighting, defaultHighlightStyle, HighlightStyle
} from '@codemirror/language';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, search, openSearchPanel } from '@codemirror/search';
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
  rectangularSelection,
  crosshairCursor,
  placeholder,
  ViewPlugin,
  Decoration,
  WidgetType,
  // commands
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
  selectAll,
  undoSelection,
  redoSelection,
  // language
  indentOnInput,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentUnit,
  LanguageDescription,
  syntaxHighlighting,
  defaultHighlightStyle,
  HighlightStyle,
  // autocomplete
  autocompletion,
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  // search
  searchKeymap,
  highlightSelectionMatches,
  search,
  openSearchPanel,
  // markdown
  markdown,
  markdownLanguage,
};

// 多环境全局赋值
if (typeof globalThis !== 'undefined') globalThis.CodeMirror = CodeMirrorAPI;
if (typeof window !== 'undefined') window.CodeMirror = CodeMirrorAPI;
if (typeof self !== 'undefined') self.CodeMirror = CodeMirrorAPI;
