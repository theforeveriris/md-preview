/**
 * runRenderers 调度器行为验证（jsdom，独立于 smoke-test.js）
 *
 * 验证点：
 *   1. 按注册表插入序执行
 *   2. root 参数正确透传
 *   3. 单个渲染器抛错不影响其余渲染器
 *   4. opts.only 过滤生效
 *   5. opts.before 钩子先于全部渲染器执行
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://example.com/' });
global.window = dom.window;
global.document = dom.window.document;

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'md-render.js'), 'utf8');
dom.window.eval(src);

const mdRender = dom.window.MarkdownPreview.mdRender;
const calls = [];
const root = document.createElement('div');

// 注册模拟渲染器（插入序即调用序）
const registry = dom.window.MarkdownPreview.renderers = {};
registry.aaa = { render: (r) => { calls.push(['aaa', r === root]); } };
registry.bbb = { render: () => { throw new Error('boom'); } };
registry.ccc = { render: async (r) => { calls.push(['ccc', r === root]); } };
registry.norender = { parse: () => {} };
registry.ddd = { render: (r) => { calls.push(['ddd', r === root]); } };

(async () => {
  // 1+2+3：顺序、root 透传、错误隔离；且严格顺序 await（前一个 resolve 后才跑下一个）
  await mdRender.runRenderers(root);
  console.log('order + root + error-isolation:',
    JSON.stringify(calls) === JSON.stringify([['aaa', true], ['ccc', true], ['ddd', true]]) ? 'PASS' : 'FAIL -> ' + JSON.stringify(calls));

  // 1b：顺序 await 验证 —— ccc 是 async，ddd 必须在 ccc resolve 之后才开始
  calls.length = 0;
  const timeline = [];
  registry.ccc.render = async () => { await new Promise(r => setTimeout(r, 30)); timeline.push('ccc-done'); };
  registry.ddd.render = () => { timeline.push('ddd-start'); };
  await mdRender.runRenderers(root, { only: ['ccc', 'ddd'] });
  console.log('sequential-await:',
    timeline.join(',') === 'ccc-done,ddd-start' ? 'PASS' : 'FAIL -> ' + timeline.join(','));

  // 4：only 过滤
  calls.length = 0;
  registry.ccc.render = async (r) => { calls.push(['ccc', r === root]); };
  registry.ddd.render = (r) => { calls.push(['ddd', r === root]); };
  await mdRender.runRenderers(root, { only: ['ddd', 'aaa'] });
  console.log('only-filter:',
    JSON.stringify(calls) === JSON.stringify([['aaa', true], ['ddd', true]]) ? 'PASS' : 'FAIL -> ' + JSON.stringify(calls));

  // 5：before 钩子先行
  let order = [];
  registry.eee = { render: () => { order.push('render'); } };
  await mdRender.runRenderers(root, { before: () => { order.push('before'); }, only: ['eee'] });
  console.log('before-hook:', order.join(',') === 'before,render' ? 'PASS' : 'FAIL -> ' + order.join(','));

  // 6：root 缺省时渲染器收到 undefined（自行回退全局容器）
  let gotUndefined = 'unset';
  registry.fff = { render: (r) => { gotUndefined = r === undefined; } };
  await mdRender.runRenderers(null, { only: ['fff'] });
  console.log('null-root->undefined:', gotUndefined === true ? 'PASS' : 'FAIL');

  // 7：Promise 拒绝同样被隔离
  registry.ggg = { render: () => Promise.reject(new Error('async boom')) };
  await mdRender.runRenderers(root, { only: ['ggg'] });
  console.log('rejection-isolated: PASS');
})().catch(e => { console.error('TEST RUNNER ERROR:', e); process.exit(1); });
