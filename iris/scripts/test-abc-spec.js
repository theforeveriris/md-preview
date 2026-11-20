#!/usr/bin/env node
'use strict';

global.window = {};
const assert = require('assert');
const { parseSource } = require('../js/renderers/abc.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  PASS  ' + name); passed++; }
  catch (e) { console.error('  FAIL  ' + name); console.error('        ' + e.message); failed++; }
}

console.log('[abc]');

test('普通 ABC 原样返回', () => {
  const src = 'X:1\nT:Scale\nK:C\nC D E F |';
  const r = parseSource(src);
  assert.strictEqual(r.abc, src);
  assert.deepStrictEqual(r.options, {});
});

test('JSON 头 + --- 分离', () => {
  const r = parseSource('{ "visualTranspose": 2, "tablature": [{"instrument":"guitar"}] }\n---\nX:1\nK:C\nC D E F |');
  assert.strictEqual(r.options.visualTranspose, 2);
  assert.strictEqual(r.options.tablature[0].instrument, 'guitar');
  assert(r.abc.startsWith('X:1'));
});

test('未在白名单的选项被忽略', () => {
  const r = parseSource('{ "visualTranspose": 2, "evil": true, "clickListener": 1 }\n---\nX:1\nK:C\nC |');
  assert.strictEqual(r.options.visualTranspose, 2);
  assert.strictEqual(r.options.evil, undefined);
  assert.strictEqual(r.options.clickListener, undefined);
});

test('无效 JSON 头回退为普通 ABC', () => {
  const src = '{ not json }\nX:1\nK:C\nC |';
  const r = parseSource(src);
  assert.strictEqual(r.abc, src);
  assert.deepStrictEqual(r.options, {});
});

test('没有 --- 时不当成头', () => {
  const src = '{ "visualTranspose": 2 }\nX:1\nK:C\nC |';
  const r = parseSource(src);
  assert.strictEqual(r.abc, src);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
