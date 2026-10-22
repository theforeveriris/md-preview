/**
 * 图谱样式与配色解析验证（jsdom + headless cytoscape，独立于 smoke-test.js）
 *
 * 为什么需要这个测试：图谱渲染到 canvas 上，节点文字、颜色、透明度在 DOM 里
 * 都查不到 —— 只能直接调用 graph.js 导出的 graphStyle / buildColorLadder /
 * parseColor 来断言。
 *
 * 验证点：
 *   1. 节点默认不显示 label（label: ''），只有 node.labeled 才解析成 data(label)
 *   2. node.labeled 的 text-opacity 要盖过 .dimmed（规则顺序不能反）
 *   3. 每个标签都能匹配到自己的主色（属性选择器按标签名生效）
 *   4. 配色阶梯：同一色相、越靠前越深、条数正确
 *   5. parseColor 能吃 hex / rgb() / rgba() / color(srgb …)
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const cytoscape = require(path.join(ROOT, 'vendor', 'cytoscape', 'cytoscape.min.js'));

// graph.js 在加载期就要用 mdRender.escapeHtml 与 t()
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://example.com/' });
global.window = dom.window;
global.document = dom.window.document;
global.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

dom.window.MarkdownPreview = {
  state: {},
  mdRender: { escapeHtml: (s) => String(s == null ? '' : s) },
  t: (key, fallback) => fallback || key,
};
dom.window.eval(fs.readFileSync(path.join(ROOT, 'js', 'renderers', 'graph.js'), 'utf8'));

const { graphStyle } = dom.window.MarkdownPreview.renderers.graph;
const { buildColorLadder, parseColor } = dom.window.MarkdownPreview.graph;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// cytoscape 序列化颜色时不带空格，比较前统一去掉空白
const norm = (v) => String(v).replace(/\s+/g, '');

let fails = 0;
function check(name, got, want) {
  const ok = norm(got) === norm(want);
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + '  ->  [' + String(got) + ']' +
    (ok ? '' : '  期望 [' + want + ']'));
  if (!ok) fails++;
}

(async () => {
  // ---------- 1~3：样式 ----------
  console.log('\n=== 样式：标签只在 labeled 时显示 ===');
  const tags = [
    { name: '图表', count: 7 },
    { name: '插件', count: 6 },
  ];
  const colors = ['rgb(123, 96, 117)', 'rgb(135, 105, 128)'];
  const style = graphStyle(tags, colors);

  const cy = cytoscape({
    headless: true,
    // headless 默认不解析样式，必须显式打开
    styleEnabled: true,
    elements: [
      { data: { id: 'a.md', label: '文档甲', mainTag: '图表', isolated: false, size: 24 } },
      { data: { id: 'b.md', label: '文档乙', mainTag: '插件', isolated: false, size: 24 } },
      { data: { id: 'c.md', label: '孤立丙', mainTag: '图表', isolated: true, size: 24 } },
    ],
    style,
  });

  const a = cy.$('#a.md');
  const b = cy.$('#b.md');

  check('默认节点无文字', a.style('label'), '');
  a.addClass('labeled');
  check('labeled 后解析出标题', a.style('label'), '文档甲');
  check('未加类的节点仍无文字', b.style('label'), '');

  a.addClass('dimmed');
  check('labeled + dimmed：text-opacity 不被 .dimmed 盖掉', a.style('text-opacity'), '1');
  // opacity 带 0.15s 过渡，等它跑完再断言，否则读到的是起点的 1
  await sleep(300);
  check('labeled + dimmed：整体仍被淡化', Number(a.style('opacity')).toFixed(2), '0.11');

  a.removeClass('labeled');
  check('移除 labeled 后回到无文字', a.style('label'), '');

  console.log('\n=== 样式：按主标签上色 ===');
  check('图表系节点用第 1 档色', a.style('background-color'), colors[0]);
  check('插件系节点用第 2 档色', b.style('background-color'), colors[1]);
  check('孤立节点虚线边框', cy.$('#c.md').style('border-style'), 'dashed');

  // ---------- 4：配色阶梯 ----------
  console.log('\n=== 配色阶梯 ===');
  // jsdom 的 getComputedStyle 不完全解析颜色，这里走 fallback 分支拿到固定 accent
  const ladder = buildColorLadder(5);
  check('档位数 = 标签数', ladder.length, 5);
  check('全部输出 rgb() 形式', ladder.every(c => /^rgb\(\d+, \d+, \d+\)$/.test(c)), 'true');
  const nums = ladder.map(c => c.match(/\d+/g).map(Number));
  check('同色相：R>G 且 G<B 逐档一致', nums.every(([r, g, bl]) => r > g && g < bl), 'true');
  check('越靠前越深（R 递减）', nums.every((cur, i) => i === 0 || cur[0] > nums[i - 1][0]), 'true');

  // ---------- 5：颜色解析 ----------
  console.log('\n=== parseColor ===');
  check('hex 六位', parseColor('#d4a5c9'), '212,165,201');
  check('hex 三位', parseColor('#fff'), '255,255,255');
  check('rgb()', parseColor('rgb(10, 20, 30)'), '10,20,30');
  check('rgba()', parseColor('rgba(10, 20, 30, 0.5)'), '10,20,30');
  check('color(srgb …) 取整', parseColor('color(srgb 0.5 0.25 1)'), '128,64,255');
  check('非法值返回 null', parseColor('oklab(0.5 0 0)'), 'null');

  console.log(fails ? '\n失败 ' + fails + ' 项' : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('TEST RUNNER ERROR:', e);
  process.exit(1);
});
