/**
 * marked-footnote 扩展验证测试
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;

// 加载 marked + marked-footnote
window.eval(fs.readFileSync(path.join(ROOT, 'iris/vendor/marked.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(ROOT, 'iris/vendor/marked-footnote.min.js'), 'utf8'));

if (typeof window.marked === 'undefined') { console.error('❌ marked 未加载'); process.exit(1); }
if (typeof window.markedFootnote === 'undefined') { console.error('❌ markedFootnote 未加载'); process.exit(1); }
console.log('✅ marked 与 markedFootnote 已加载');

// 注册扩展
window.marked.use(window.markedFootnote({
  prefixId: 'fn-',
  description: '脚注',
  footnoteDivider: true,
}));

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.error(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

console.log('\n=== 基础脚注渲染 ===');
const md1 = `这是一段文字[^1]，还有另一个[^note]。

[^1]: 第一个脚注内容
[^note]: 第二个脚注内容`;
const html1 = window.marked.parse(md1, { breaks: true, gfm: true });
assert('渲染不抛异常', typeof html1 === 'string');
assert('包含脚注引用上标 1', html1.includes('href="#fn-1"') || html1.includes('id="fnref-'), html1.slice(0, 200));
assert('包含脚注引用上标 note', html1.includes('href="#fn-note"') || html1.includes('fn-note'), html1.slice(0, 300));
assert('包含脚注定义区 section', html1.includes('data-footnotes') || html1.includes('class="footnotes"'), html1.slice(-300));
assert('包含脚注内容文本', html1.includes('第一个脚注内容'), html1.slice(-300));
assert('包含回链', html1.includes('href="#fnref-') || html1.includes('data-fnbackref') || html1.includes('backref'), html1.slice(-300));

console.log('\n=== 无脚注时不应输出 section ===');
const md2 = `这段没有脚注。\n\n普通段落。`;
const html2 = window.marked.parse(md2, { breaks: true, gfm: true });
assert('无脚注时无 section', !html2.includes('data-footnotes') && !html2.includes('class="footnotes"'));

console.log('\n=== 多次解析状态隔离 ===');
const html3a = window.marked.parse(`文本[^a]\n\n[^a]: 内容A`, { breaks: true, gfm: true });
const html3b = window.marked.parse(`文本[^b]\n\n[^b]: 内容B`, { breaks: true, gfm: true });
assert('第二次解析包含 B', html3b.includes('内容B'));
assert('第二次解析不串入 A', !html3b.includes('内容A'), html3b.slice(-200));
assert('第一次解析包含 A', html3a.includes('内容A'));

console.log(`\n============================`);
console.log(`测试结果: ${pass} 通过, ${fail} 失败`);
console.log(`============================`);
process.exit(fail > 0 ? 1 : 0);
