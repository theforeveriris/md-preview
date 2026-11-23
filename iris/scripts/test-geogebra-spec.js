#!/usr/bin/env node
'use strict';

global.window = {};
const assert = require('assert');
const g = require('../js/renderers/geogebra.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
    passed++;
  } catch (e) {
    console.error('  FAIL  ' + name);
    console.error('        ' + e.message);
    failed++;
  }
}

console.log('[geogebra]');

test('材料 ID 与链接', () => {
  assert.strictEqual(g.materialId('abcdefgh'), 'abcdefgh');
  assert.strictEqual(g.materialId('https://www.geogebra.org/m/abcdefgh'), 'abcdefgh');
  assert.strictEqual(g.materialId('https://www.geogebra.org/m/abcd-123'), 'abcd-123');
  assert.strictEqual(g.materialId('not a material'), null);
});

test('YAML 头 + 命令列表', () => {
  const s = g.parseSpec('app: 3d\nheight: 500\nauto: true\nshowAlgebraInput: true\ncommands:\n  - f(x) = sin(x)\n  - (1, 1)');
  assert.strictEqual(s.app, '3d');
  assert.strictEqual(s.height, 500);
  assert.strictEqual(s.auto, true);
  assert.strictEqual(s.showAlgebraInput, true);
  assert.deepStrictEqual(s.commands, ['f(x) = sin(x)', '(1, 1)']);
});

test('无头命令', () => {
  const s = g.parseSpec('f(x) = x^2\n(1, f(1))\nTangent(1, f)');
  assert.strictEqual(s.app, 'graphing');
  assert.deepStrictEqual(s.commands, ['f(x) = x^2', '(1, f(1))', 'Tangent(1, f)']);
});

test('高度与非法 app 兜底', () => {
  const s = g.parseSpec('app: nonsense\nheight: 9999\ncommands:\n  - 1 + 1');
  assert.strictEqual(s.app, 'graphing');
  assert.strictEqual(s.height, 900);
});

test('commands 缩写列表', () => {
  const s = g.parseSpec('commands:\n- f(x)=x\n- g(x)=2x');
  assert.deepStrictEqual(s.commands, ['f(x)=x', 'g(x)=2x']);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
