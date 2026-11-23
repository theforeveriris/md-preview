#!/usr/bin/env node

/**
 * 文件树自然排序回归测试
 *
 * 背景：vendor 的 @webreflection/file-tree 组件按纯字典序排序，
 * 数字开头的文件名会排错位（1.0 1.1 10.0 11.0 2.0 …）。
 * 本项目在 iris/js/file-tree.js 里用 applyNaturalOrder 兜底重排，
 * 构建期 iris/scripts/build-file-tree.js 也用同一比较器。
 *
 * 覆盖：
 *   1. 纯函数 name-sort.js 的比较器行为
 *   2. vendor 组件原始行为（对照组，说明 bug 来源）
 *   3. applyNaturalOrder 重排后的实际 DOM 顺序
 *   4. 构建期 build-file-tree.js 产出的 file-tree.json 顺序
 *
 * 用法：node iris/scripts/test-file-tree-sort.js
 * 依赖：jsdom（iris/package.json devDependencies）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, '..', 'node_modules', 'jsdom'));

const ROOT = path.resolve(__dirname, '..', '..');

let failures = 0;
function fail(msg) {
  failures++;
  console.error(`  ✗ ${msg}`);
}
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}
function assertEqual(actual, expected, label) {
  if (actual.join('|') === expected.join('|')) {
    pass(label);
  } else {
    fail(`${label}\n      实际: ${actual.join(' ')}\n      期望: ${expected.join(' ')}`);
  }
}

// ============== 1. 纯函数比较器 ==============
console.log('\n[1/5] name-sort.js 比较器');
const nameSort = require(path.join(ROOT, 'iris/js/name-sort.js'));

const NUMERIC_NAMES = [
  '1.0.md', '1.1.md', '2.0.md', '2.1.md', '9.0.md', '9.1.md',
  '10.0.md', '11.0.md', '12.0.md',
];
assertEqual(
  NUMERIC_NAMES.slice().sort(nameSort.compareNames),
  ['1.0.md', '1.1.md', '2.0.md', '2.1.md', '9.0.md', '9.1.md', '10.0.md', '11.0.md', '12.0.md'],
  '数字开头文件名按数值排序（10.0 排在 9.1 之后）'
);

assertEqual(
  ['b.md', 'a.md', 'C.md'].slice().sort(nameSort.compareNames),
  ['a.md', 'b.md', 'C.md'],
  '普通名称仍按 locale 规则排序'
);

// 大写优先：caseFirst:'upper' —— A.md 排在 a.md 前面，且比较结果不为 0
// （早期用 sensitivity:'base' 会让两者比较结果为 0，最终顺序取决于文件系统
//   readdir 的原始返回顺序，跨平台不确定；caseFirst 消除了这个隐患）
assertEqual(
  ['a.md', 'A.md', 'b.md'].slice().sort(nameSort.compareNames),
  ['A.md', 'a.md', 'b.md'],
  '仅大小写不同的名称：大写优先（A.md 在 a.md 之前）'
);
if (nameSort.compareNames('A.md', 'a.md') < 0) {
  pass('compareNames("A.md","a.md") < 0（确定性大写优先，不返回 0）');
} else {
  fail('compareNames("A.md","a.md") 应为负数（确定性大写优先）');
}

// ============== 2. vendor 原始行为（对照组） ==============
console.log('\n[2/5] vendor 组件原始排序（对照组，预期为字典序）');

function loadVendorTree() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  global.window = window;
  global.document = window.document;
  global.Node = window.Node;
  global.CSS = window.CSS || { supports: () => false };
  if (!window.CSS) window.CSS = { supports: () => false };
  if (!window.CSSStyleSheet) window.CSSStyleSheet = class { replaceSync() {} };
  // jsdom 不支持 adoptedStyleSheets，补一个最小实现
  if (!window.ShadowRoot.prototype.adoptedStyleSheets) {
    Object.defineProperty(window.ShadowRoot.prototype, 'adoptedStyleSheets', {
      get() { return this._adopted || (this._adopted = []); },
      set(v) { this._adopted = Array.from(v); },
    });
  }
  const vendorSrc = fs.readFileSync(path.join(ROOT, 'iris/vendor/file-tree/prod.js'), 'utf-8');
  window.eval(vendorSrc);
  return window;
}

const win = loadVendorTree();
const { File, Folder } = win.MarkdownPreview.FileTree;

const vendorFolder = new Folder('docs');
NUMERIC_NAMES.forEach((n) => vendorFolder.append(new File([], n)));
const vendorOrder = Array.from(vendorFolder.list.children)
  .map((li) => li.querySelector('button').textContent.trim());

if (vendorOrder.join('|') === NUMERIC_NAMES.slice().sort((a, b) => a.localeCompare(b)).join('|')) {
  pass('vendor 确认为纯字典序（对照组成立，说明需要本地兜底）');
} else {
  fail('vendor 排序行为与预期不符，测试前提失效');
}

// ============== 3. applyNaturalOrder 重排后的 DOM 顺序 ==============
console.log('\n[3/5] file-tree.js applyNaturalOrder 重排结果');

const appFolder = new Folder('docs');
NUMERIC_NAMES.forEach((n) => appFolder.append(new File([], n)));

// 复刻 iris/js/file-tree.js 的调用方式：直接用 name-sort.js 导出的实现，
// 保证测试覆盖的是运行时真正执行的代码（而非测试里另写一份）
const { applyNaturalOrder, directButton } = nameSort;

// 把文件夹挂到一个 host 上以便拿到 shadowRoot
const host = win.document.createElement('div');
win.document.body.appendChild(host);
const shadow = host.attachShadow({ mode: 'open' });
shadow.appendChild(appFolder.list);
applyNaturalOrder(shadow);

const fixedOrder = Array.from(appFolder.list.children)
  .map((li) => li.querySelector('button').textContent.trim());
assertEqual(
  fixedOrder,
  ['1.0.md', '1.1.md', '2.0.md', '2.1.md', '9.0.md', '9.1.md', '10.0.md', '11.0.md', '12.0.md'],
  'applyNaturalOrder 后数字开头文件名按数值排序'
);

// 文件夹在前、文件在后
const mixed = new Folder('mix');
mixed.append(new File([], '10.md'));
mixed.append(new Folder('b-folder'));
mixed.append(new File([], '2.md'));
mixed.append(new Folder('a-folder'));
const host2 = win.document.createElement('div');
win.document.body.appendChild(host2);
const shadow2 = host2.attachShadow({ mode: 'open' });
shadow2.appendChild(mixed.list);
applyNaturalOrder(shadow2);
const mixedOrder = Array.from(mixed.list.children).map((li) => {
  const button = directButton(li);
  return (li.classList.contains('folder') ? '[D] ' : '[F] ') + (button ? button.textContent.trim() : '?');
});
assertEqual(
  mixedOrder,
  ['[D] a-folder', '[D] b-folder', '[F] 2.md', '[F] 10.md'],
  '文件夹在前、文件在后，各组按自然序'
);

// ============== 4. 排序策略（时间排序） ==============
console.log('\n[4/5] 排序策略（智能 / 创建时间 / 修改时间）');

const { SORT_MODES, compareEntries, sortEntries } = nameSort;

// 构造带时间戳的条目
const TIME_ITEMS = [
  { name: 'a.md', created: 300, modified: 900 },
  { name: 'b.md', created: 100, modified: 700 },
  { name: 'c.md', created: 200, modified: 800 },
];

const namesOf = (items) => items.map((i) => i.name);

assertEqual(
  namesOf(sortEntries(TIME_ITEMS, SORT_MODES.smart)),
  ['a.md', 'b.md', 'c.md'],
  '智能顺序：按名称自然序'
);
assertEqual(
  namesOf(sortEntries(TIME_ITEMS, SORT_MODES.createdDesc)),
  ['a.md', 'c.md', 'b.md'],
  '最初创建时间倒序：新的在前'
);
assertEqual(
  namesOf(sortEntries(TIME_ITEMS, SORT_MODES.createdAsc)),
  ['b.md', 'c.md', 'a.md'],
  '最初创建时间正序：老的在前'
);
assertEqual(
  namesOf(sortEntries(TIME_ITEMS, SORT_MODES.modifiedDesc)),
  ['a.md', 'c.md', 'b.md'],
  '最后修改时间倒序：新的在前'
);
assertEqual(
  namesOf(sortEntries(TIME_ITEMS, SORT_MODES.modifiedAsc)),
  ['b.md', 'c.md', 'a.md'],
  '最后修改时间正序：老的在前'
);

// 时间缺失时回退到名称序（保证顺序确定）
// 说明：有时间戳的条目按时间参与排序（desc 时 100 在最前），
// 时间缺失（视为 0）的条目彼此并列，按名称自然序兜底
const NO_TIME = [
  { name: 'z.md' },
  { name: 'a.md' },
  { name: 'm.md', created: 100, modified: 100 },
];
assertEqual(
  namesOf(sortEntries(NO_TIME, SORT_MODES.createdDesc)),
  ['m.md', 'a.md', 'z.md'],
  '时间缺失时回退到名称自然序，顺序确定'
);

// 全部缺失时间时完全按名称序
const ALL_NO_TIME = [{ name: 'z.md' }, { name: 'a.md' }, { name: 'm.md' }];
assertEqual(
  namesOf(sortEntries(ALL_NO_TIME, SORT_MODES.modifiedDesc)),
  ['a.md', 'm.md', 'z.md'],
  '全部缺失时间时按名称自然序'
);

// 非法策略回退到默认
assertEqual(
  namesOf(sortEntries(TIME_ITEMS, 'not-a-mode')),
  ['a.md', 'b.md', 'c.md'],
  '非法排序策略回退到智能顺序'
);

// DOM 重排：按创建时间倒序
const timeFolder = new Folder('docs');
const timed = [
  { name: 'a.md', created: 300, modified: 900 },
  { name: 'b.md', created: 100, modified: 700 },
  { name: 'c.md', created: 200, modified: 800 },
];
timed.forEach((t) => timeFolder.append(new File([], t.name)));
const host3 = win.document.createElement('div');
win.document.body.appendChild(host3);
const shadow3 = host3.attachShadow({ mode: 'open' });
shadow3.appendChild(timeFolder.list);
// 用 li 的名称反查时间，模拟 file-tree.js 的 resolveMeta
applyNaturalOrder(shadow3, {
  mode: SORT_MODES.createdDesc,
  resolveMeta: (li) => {
    const btn = directButton(li);
    const n = btn ? btn.textContent.trim() : '';
    const hit = timed.find((t) => t.name === n);
    return hit ? { created: hit.created, modified: hit.modified } : { created: 0, modified: 0 };
  }
});
assertEqual(
  Array.from(timeFolder.list.children).map((li) => directButton(li).textContent.trim()),
  ['a.md', 'c.md', 'b.md'],
  'applyNaturalOrder 按创建时间倒序重排 DOM'
);

// ============== 5. 构建期产物顺序 ==============
console.log('\n[5/5] build-file-tree.js 产物顺序');
const treeFile = path.join(ROOT, 'iris/data/file-tree.json');
if (fs.existsSync(treeFile)) {
  const tree = JSON.parse(fs.readFileSync(treeFile, 'utf-8'));
  const children = Array.isArray(tree) ? tree : (tree.children || []);
  // 产物规则：文件夹在前、文件在后，各组按名称自然序
  const folders = children.filter((c) => c.type === 'folder').map((c) => c.name);
  const files = children.filter((c) => c.type === 'file').map((c) => c.name);
  assertEqual(
    folders,
    folders.slice().sort(nameSort.compareNames),
    'file-tree.json 文件夹按自然序排列'
  );
  assertEqual(
    files,
    files.slice().sort(nameSort.compareNames),
    'file-tree.json 文件按自然序排列'
  );

  // 产物需带时间戳（供侧边栏按时间排序）
  const withTime = children.filter((c) => typeof c.created === 'number' && typeof c.modified === 'number');
  if (withTime.length === children.length) {
    pass(`file-tree.json 全部 ${children.length} 个顶层条目带 created / modified 时间戳`);
  } else {
    fail(`file-tree.json 仅 ${withTime.length}/${children.length} 个条目带时间戳`);
  }
} else {
  console.log('  （跳过：iris/data/file-tree.json 不存在，先运行 build-file-tree.js）');
}

console.log(failures === 0 ? '\n✅ 全部通过' : `\n❌ ${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
