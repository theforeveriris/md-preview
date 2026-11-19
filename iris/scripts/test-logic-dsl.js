#!/usr/bin/env node
/**
 * 数字逻辑电路 DSL 单元测试
 */
'use strict';

global.window = {};
const assert = require('assert');
const core = require('../js/logic-core.js');

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

function rowsOf(src) {
  const model = core.build(src);
  assert.deepStrictEqual(model.errors, [], 'unexpected errors: ' + JSON.stringify(model.errors));
  const tt = core.truthTable(model);
  assert(tt && !tt.tooLarge, 'truth table expected');
  return { model, tt };
}

console.log('[logic-core]');

test('全加器解析与真值表', () => {
  const { model, tt } = rowsOf(`
input A, B, Cin
output S, Cout
xor x1 = A, B
xor S = x1, Cin
and a1 = A, B
and a2 = x1, Cin
or Cout = a1, a2
`);
  assert.strictEqual(model.nodes.filter(n => n.kind === 'gate').length, 5);
  assert.deepStrictEqual(tt.columns.map(c => c.name), ['A', 'B', 'Cin', 'S', 'Cout']);
  assert.strictEqual(tt.rows.length, 8);
  // 0+0+0 -> 0,0；1+1+1 -> 1,1
  assert.deepStrictEqual(tt.rows[0], [0, 0, 0, 0, 0]);
  assert.deepStrictEqual(tt.rows[7], [1, 1, 1, 1, 1]);
});

test('2:1 多路选择器', () => {
  const { tt } = rowsOf(`
input A, B, S
output Y
mux2 m1 (A, B, S) -> Y
`);
  assert.deepStrictEqual(tt.rows, [
    [0, 0, 0, 0],
    [1, 0, 0, 1],
    [0, 1, 0, 0],
    [1, 1, 0, 1],
    [0, 0, 1, 0],
    [1, 0, 1, 0],
    [0, 1, 1, 1],
    [1, 1, 1, 1]
  ]);
});

test('2-4 译码器', () => {
  const { tt } = rowsOf(`
input A[1:0], EN
output Y[3:0]
decoder d1[2] (A[1:0], EN) -> Y[3:0]
`);
  // 最后一行 A=1,EN=1 -> Y[1]=1
  assert.deepStrictEqual(tt.rows[7], [1, 1, 1, 1, 0, 0, 0]);
});

test('D 触发器被识别为时序', () => {
  const model = core.build(`
clock CLK
input D
output Q, Qn
dff ff1 (D, CLK) -> Q, Qn
`);
  assert.deepStrictEqual(model.errors, []);
  assert.strictEqual(model.hasSequential, true);
  assert.strictEqual(core.truthTable(model), null);
});

test('SR 锁存器识别反馈边', () => {
  const model = core.build(`
input S, R
output Q, Qn
nor Q = R, Qn
nor Qn = S, Q
`);
  assert.deepStrictEqual(model.errors, []);
  assert.strictEqual(model.feedbackEdges.length, 1);
  assert.strictEqual(core.truthTable(model), null);
});

test('总线位选与 connect', () => {
  const { tt } = rowsOf(`
input D[3:0]
output Q0
connect D[0] -> Q0
`);
  assert.deepStrictEqual(tt.columns.map(c => c.name), ['D[3]', 'D[2]', 'D[1]', 'D[0]', 'Q0']);
  assert.strictEqual(tt.rows.length, 16);
  tt.rows.forEach((row, i) => {
    assert.strictEqual(row[4], i & 1, 'Q0 should follow D[0] at row ' + i);
  });
});

test('位宽不匹配会报错', () => {
  const model = core.build(`
input D[3:0]
output Y
and g1 = D, Y
`);
  assert(model.errors.some(e => e.msg.includes('位宽') || e.msg.includes('需要')), 'width error expected');
});

test('未定义网络会报错', () => {
  const model = core.build(`
input A
output Y
and g1 = A, X
`);
  assert(model.errors.some(e => e.msg.includes('未定义网络 X')));
});

test('寄存器 / 计数器块解析', () => {
  const reg = core.build(`
clock CLK
input D[3:0], EN, CLR
output Q[3:0]
register r0[4] (D[3:0], CLK, EN, CLR) -> Q[3:0]
`);
  assert.deepStrictEqual(reg.errors, []);
  assert.strictEqual(reg.hasSequential, true);
  const cnt = core.build(`
clock CLK
input EN, CLR
output Q[3:0], CO
counter c0[4] (CLK, EN, CLR) -> Q[3:0], CO
`);
  assert.deepStrictEqual(cnt.errors, []);
  assert.strictEqual(cnt.hasSequential, true);
});

test('布局产出非零尺寸与引脚坐标', () => {
  const model = core.build(`
input A, B
output Y
and g1 = A, B
connect g1 -> Y
`);
  assert(model.layout.width > 200);
  assert(model.layout.height > 100);
  model.nodes.forEach(n => {
    n.pins.in.concat(n.pins.out).forEach(p => {
      assert.strictEqual(typeof p.x, 'number');
      assert.strictEqual(typeof p.y, 'number');
    });
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
