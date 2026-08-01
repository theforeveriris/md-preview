/**
 * CM6 适配层验证测试（jsdom）
 * 运行：node test-cm-editor.js
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

// 1. 构造 jsdom 环境
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="host"></div></body></html>`, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const { window } = dom;

// 暴露给被测脚本
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.Element = window.Element;

// 2. 加载 CM6 bundle
const cmBundlePath = path.join(ROOT, 'iris/vendor/codemirror/codemirror.min.js');
const cmBundleCode = fs.readFileSync(cmBundlePath, 'utf8');
window.eval(cmBundleCode);
if (!window.CodeMirror) {
  console.error('❌ CodeMirror bundle 未加载');
  process.exit(1);
}
console.log('✅ CodeMirror bundle 已加载');

// 3. 加载 cm-editor.js
const cmEditorPath = path.join(ROOT, 'iris/js/cm-editor.js');
const cmEditorCode = fs.readFileSync(cmEditorPath, 'utf8');
window.eval(cmEditorCode);
if (!window.CodeMirrorEditor) {
  console.error('❌ CodeMirrorEditor 类未注册');
  process.exit(1);
}
console.log('✅ CodeMirrorEditor 类已注册');

// 4. 测试套件
const host = window.document.getElementById('host');
let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.error(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

console.log('\n=== 构造与基础 API ===');
const editor = new window.CodeMirrorEditor(host, {
  value: 'hello world',
  placeholder: '请输入...',
});
assert('初始 value 正确', editor.value === 'hello world', editor.value);
assert('selectionStart 为 0', editor.selectionStart === 0);
assert('selectionEnd 为 0', editor.selectionEnd === 0);
assert('dataset 可写', (editor.dataset.cellId = '1', editor.dataset.cellId === '1'));

console.log('\n=== setValue（程序化，不应触发 input） ===');
let inputCount = 0;
editor.addEventListener('input', () => inputCount++);
editor.setValue('new content');
assert('setValue 后 value 更新', editor.value === 'new content', editor.value);
assert('setValue 不触发 input 事件', inputCount === 0, 'inputCount=' + inputCount);

console.log('\n=== 用户输入（应触发 input） ===');
// 模拟用户键入：直接 dispatch 文档变更（不带 programmatic annotation）
editor.view.dispatch({ changes: { from: 0, to: 0, insert: 'X' } });
assert('用户输入触发 input 事件', inputCount === 1, 'inputCount=' + inputCount);
assert('文档内容已更新', editor.value === 'Xnew content', editor.value);

console.log('\n=== insertText ===');
editor.view.dispatch({ selection: { anchor: 1 } }); // 光标放在位置 1
editor.insertText('-INSERTED-');
assert('insertText 插入成功', editor.value === 'X-INSERTED-new content', editor.value);

console.log('\n=== replaceRange ===');
editor.replaceRange(0, 1, 'Y');
assert('replaceRange 替换成功', editor.value.startsWith('Y'), editor.value.slice(0, 5));

console.log('\n=== wrapSelection ===');
editor.setSelectionRange(0, 5);
editor.wrapSelection('**', '**');
assert('wrapSelection 包裹成功', editor.value.startsWith('**Y'), editor.value.slice(0, 10));

console.log('\n=== insertAtLineStart ===');
editor.setValue('line1\nline2');
editor.view.dispatch({ selection: { anchor: 7 } }); // 第二行中间
editor.insertAtLineStart('> ');
assert('insertAtLineStart 在第二行首插入', editor.value === 'line1\n> line2', editor.value);

console.log('\n=== getLineBeforeCursor / getLineStart ===');
editor.setValue('abc\ndef');
// 位置 5：'d'(4) 与 'e'(5) 之间，光标在 'd' 之后
editor.view.dispatch({ selection: { anchor: 5 } });
assert('getLineBeforeCursor 返回 "d"', editor.getLineBeforeCursor() === 'd', editor.getLineBeforeCursor());
assert('getLineStart 返回 4', editor.getLineStart() === 4, editor.getLineStart());

console.log('\n=== getCursorPos ===');
editor.setValue('line1\nline2\nline3');
// 位置 12：'\n'(11) 之后、'l'(12) 之前，即第三行行首
editor.view.dispatch({ selection: { anchor: 12 } });
const pos = editor.getCursorPos();
assert('getCursorPos().line === 3', pos.line === 3, 'line=' + pos.line);
assert('getCursorPos().col === 1', pos.col === 1, 'col=' + pos.col);

console.log('\n=== replaceAtLineStart ===');
editor.setValue('@trigger text');
editor.view.dispatch({ selection: { anchor: 9 } });
// replaceLength=1 只替换 '@' 字符，'trigger text' 保留
editor.replaceAtLineStart(1, '@grid\n');
assert('replaceAtLineStart 替换前缀', editor.value === '@grid\ntrigger text', editor.value);

console.log('\n=== setSelectionRange ===');
editor.setValue('abcdefgh');
editor.setSelectionRange(2, 5);
assert('selectionStart 为 2', editor.selectionStart === 2);
assert('selectionEnd 为 5', editor.selectionEnd === 5);

console.log('\n=== placeholder setter（运行时切换） ===');
let placeholderOk = true;
try {
  editor.placeholder = '新的占位文本';
} catch (e) {
  placeholderOk = false;
}
assert('placeholder setter 不抛异常', placeholderOk);
assert('placeholder getter 返回新值', editor.placeholder === '新的占位文本', editor.placeholder);
// 再次切换验证多次调用稳定
let placeholderTwice = true;
try {
  editor.placeholder = '再次切换';
  editor.placeholder = '';
} catch (e) {
  placeholderTwice = false;
}
assert('placeholder 多次切换稳定', placeholderTwice && editor.placeholder === '');

console.log('\n=== setFontSize ===');
let fontSizeOk = true;
try {
  editor.setFontSize(18);
} catch (e) {
  fontSizeOk = false;
}
assert('setFontSize 不抛异常', fontSizeOk);

console.log('\n=== setDarkMode ===');
let darkModeOk = true;
try {
  editor.setDarkMode(true);
  editor.setDarkMode(false);
} catch (e) {
  darkModeOk = false;
}
assert('setDarkMode 切换不抛异常', darkModeOk);

console.log('\n=== undo / redo ===');
let undoOk = true;
try {
  editor.setValue('initial');
  editor.view.dispatch({ changes: { from: 0, to: 0, insert: 'A' } });
  editor.undo();
  editor.redo();
} catch (e) {
  undoOk = false;
}
assert('undo/redo 不抛异常', undoOk);

console.log('\n=== focus / blur / destroy ===');
let focusOk = true;
try {
  editor.focus();
  editor.blur();
} catch (e) {
  focusOk = false;
}
assert('focus/blur 不抛异常', focusOk);

let destroyOk = true;
try {
  editor.destroy();
} catch (e) {
  destroyOk = false;
}
assert('destroy 不抛异常', destroyOk);

console.log(`\n============================`);
console.log(`测试结果: ${pass} 通过, ${fail} 失败`);
console.log(`============================`);
process.exit(fail > 0 ? 1 : 0);
