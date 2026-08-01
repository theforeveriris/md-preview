/**
 * storage.js 模块验证测试（jsdom 无 IndexedDB，测试注册与兜底逻辑）
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
  url: 'https://example.com/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.localStorage = window.localStorage;

// jsdom 默认无 indexedDB，storage.js 应正确降级

// 加载 storage.js
const storageCode = fs.readFileSync(path.join(ROOT, 'iris/js/storage.js'), 'utf8');
window.eval(storageCode);

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.error(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

async function run() {
  console.log('=== storage 模块注册 ===');
  const storage = window.MarkdownPreview.storage;
  assert('storage 模块已注册', !!storage);
  assert('AUTOSAVE_KEY 常量', storage.AUTOSAVE_KEY === 'autosave');
  assert('isAvailable 方法', typeof storage.isAvailable === 'function');
  assert('saveNotebook 方法', typeof storage.saveNotebook === 'function');
  assert('loadNotebook 方法', typeof storage.loadNotebook === 'function');
  assert('deleteNotebook 方法', typeof storage.deleteNotebook === 'function');
  assert('listNotebooks 方法', typeof storage.listNotebooks === 'function');
  assert('getMeta 方法', typeof storage.getMeta === 'function');
  assert('setMeta 方法', typeof storage.setMeta === 'function');
  assert('migrateFromLocalStorage 方法', typeof storage.migrateFromLocalStorage === 'function');
  assert('IndexedDB 不可用时 isAvailable 返回 false', storage.isAvailable() === false);

  console.log('\n=== migrateFromLocalStorage 无数据 ===');
  const migrated = await storage.migrateFromLocalStorage('nonexistent_key_xyz', 'test');
  assert('无数据时 migrate 返回 null', migrated === null);

  console.log('\n=== saveNotebook 在无 IndexedDB 时抛错（供 editor.js 兜底） ===');
  let threw = false;
  try {
    await storage.saveNotebook({ id: 'x', cells: [] });
  } catch (e) {
    threw = true;
  }
  assert('saveNotebook 无 DB 时 reject', threw === true);

  console.log('\n=== migrateFromLocalStorage 有 localStorage 数据但无 IDB ===');
  // 放入 localStorage 数据，但 IDB 不可用 → migrate 应返回 null（无法写入 IDB）
  window.localStorage.setItem('test_ls_key', JSON.stringify({
    id: 'test',
    version: 2,
    cells: [{ id: 1, type: 'markdown', content: 'hello', output_html: '' }]
  }));
  const migrated2 = await storage.migrateFromLocalStorage('test_ls_key', 'test');
  assert('IDB 不可用时 migrate 返回 null（但不抛错）', migrated2 === null);
  // localStorage 数据应保留（因为迁移失败）
  assert('迁移失败时 localStorage 数据保留', window.localStorage.getItem('test_ls_key') !== null);

  console.log(`\n============================`);
  console.log(`测试结果: ${pass} 通过, ${fail} 失败`);
  console.log(`============================`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
