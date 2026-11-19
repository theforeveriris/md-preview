#!/usr/bin/env node
'use strict';

global.window = {};
const assert = require('assert');
const { wrap } = require('../js/renderers/tikz.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log('  PASS  ' + name); passed++; }
  catch (e) { console.error('  FAIL  ' + name); console.error('        ' + e.message); failed++; }
}

console.log('[tikz]');

test('裸绘图命令自动包 tikzpicture', () => {
  const out = wrap('\\draw (0,0) -- (1,1);');
  assert(out.includes('\\documentclass[tikz,border=6pt]{standalone}'));
  assert(out.includes('\\begin{tikzpicture}'));
  assert(out.includes('\\draw (0,0) -- (1,1);'));
  assert(out.trim().endsWith('\\end{document}'));
});

test('已有 tikzpicture 只补文档', () => {
  const out = wrap('\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}');
  assert.strictEqual((out.match(/\\begin\{tikzpicture\}/g) || []).length, 1);
  assert(out.includes('\\begin{document}'));
});

test('完整文档原样返回', () => {
  const src = '\\documentclass{standalone}\\begin{document}x\\end{document}';
  assert.strictEqual(wrap(src), src);
});

test('多行 tikzset 进入导言区', () => {
  const out = wrap('\\tikzset{\n  box/.style={draw}\n}\n\\begin{tikzpicture}\\node[box]{A};\\end{tikzpicture}');
  assert(out.indexOf('\\tikzset') < out.indexOf('\\begin{document}'));
  assert(out.indexOf('box/.style') < out.indexOf('\\begin{document}'));
});

test('usetikzlibrary 进入导言区', () => {
  const out = wrap('\\usetikzlibrary{positioning}\n\\begin{tikzpicture}\\node{A};\\end{tikzpicture}');
  assert(out.indexOf('\\usetikzlibrary') < out.indexOf('\\begin{document}'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
