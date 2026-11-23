/**
 * 渲染管线端到端回归测试（jsdom）
 *
 * 背景：split-view 的隐藏面板带 .markdown-body class 且在 DOM 中先于主文档，
 * 曾导致所有用 document.querySelector('.markdown-body') 的渲染器命中空面板
 * 整体短路（KaTeX 公式失效）。本测试锁定：
 *   1. 主文档渲染后 KaTeX 块/行内公式真正渲染出 .katex 节点
 *   2. katex 按需加载真的发生（loadScript 被调用）
 *   3. 渲染器执行顺序 + 调度器行为（test-run-renderers.js 的姊妹篇）
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const require2 = createRequire(path.join(__dirname, 'smoke-test.js'));
const { JSDOM } = require2('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost:8931/index.html', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
window.scrollTo = () => {};
window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
window.navigator.serviceWorker = { addEventListener() {}, register: () => Promise.resolve({}) };

const scriptSrcs = [...html.matchAll(/<script defer src="([^"]+)"/g)].map(m => m[1]);
const loadErrors = [];
for (const src of scriptSrcs) {
  if (src.includes('file-tree/prod')) continue; // jsdom 无 CSSOM
  try { window.eval(fs.readFileSync(path.join(ROOT, src), 'utf8')); }
  catch (e) { loadErrors.push(src + ' => ' + e.message); }
}

// stub 按需加载：直接在 jsdom 里 eval 本地 vendor 文件（无网络环境）
const loadedScripts = [];
window.MarkdownPreview.loadScript = async (src) => {
  loadedScripts.push(src);
  window.eval(fs.readFileSync(path.join(ROOT, src), 'utf8'));
};
window.MarkdownPreview.loadStyle = async () => {};

(async () => {
  await new Promise(r => setTimeout(r, 300));

  // 渲染一篇含块级 + 行内公式的文档
  const md = [
    '# 测试文档',
    '',
    '块级公式：',
    '',
    '$$a^2 + b^2 = c^2$$',
    '',
    '行内公式 $e^{i\\pi} + 1 = 0$ 结束。',
  ].join('\n');
  window.MarkdownPreview.markdown.renderMarkdownDirect(md, 'test.md');
  await new Promise(r => setTimeout(r, 1500));

  const doc = window.document;
  const blocks = doc.querySelectorAll('.katex-block');
  const renderedBlocks = doc.querySelectorAll('.katex-block .katex');
  const inlines = doc.querySelectorAll('.katex-inline');
  const renderedInline = doc.querySelectorAll('.katex-inline .katex');
  const katexLoaded = loadedScripts.some(s => s.includes('katex.min.js'));
  const autoRenderLoaded = loadedScripts.some(s => s.includes('auto-render.min.js'));

  console.log('script load errors:', loadErrors.length ? loadErrors : 'none');
  console.log('katex vendor loaded:', katexLoaded ? 'PASS' : 'FAIL');
  console.log('auto-render loaded:', autoRenderLoaded ? 'PASS' : 'FAIL');
  console.log('.katex-block:', blocks.length, '| rendered:', renderedBlocks.length,
    renderedBlocks.length > 0 ? 'PASS' : 'FAIL');
  console.log('.katex-inline:', inlines.length, '| rendered:', renderedInline.length,
    renderedInline.length > 0 ? 'PASS' : 'FAIL');

  // 关键场景：split-view 面板在 DOM 中先于主文档（复刻线上结构），确保 katex 没渲染进面板
  const splitPane = doc.querySelector('.split-pane-body');
  const paneRendered = splitPane ? splitPane.querySelectorAll('.katex').length : 0;
  console.log('split-pane 不含误渲染:', paneRendered === 0 ? 'PASS' : 'FAIL (' + paneRendered + ')');

  // 回归：行内代码里的 ``` 不能被当成围栏，四反引号 ACL/route-table 块必须正常交给渲染器
  const fence = '````';
  const fenceMd = [
    '# 围栏回归',
    '',
    '` ```acl ` 是行内代码，不应开启代码围栏。',
    '',
    fence + 'acl ios',
    '10 permit tcp 10.1.1.0 0.0.0.255 any eq 443',
    '20 deny ip any any',
    fence,
    '',
    fence + 'route-table',
    'C    10.1.1.0/24 is directly connected, GigabitEthernet0/0',
    'S*   0.0.0.0/0 [1/0] via 10.1.1.254',
    fence,
  ].join('\n');
  window.MarkdownPreview.markdown.renderMarkdownDirect(fenceMd, 'test-fence.md');
  await new Promise(r => setTimeout(r, 1500));

  const fenceRoot = doc.querySelector('#markdownContent');
  const leakedPlaceholder = /SPOILERCODEBLOCK|LATEXCODESEG|RUBYCODESEG/.test(fenceRoot.innerHTML);
  const aclWidget = fenceRoot.querySelector('.acl-widget');
  const routeWidget = fenceRoot.querySelector('.rt-widget');
  console.log('多反引号围栏占位符泄漏:', leakedPlaceholder ? 'FAIL' : 'PASS');
  console.log('ACL 渲染器接管四反引号块:', aclWidget ? 'PASS' : 'FAIL');
  console.log('route-table 未被吞进 ACL:', routeWidget ? 'PASS' : 'FAIL');

  const pass = katexLoaded && renderedBlocks.length > 0 && renderedInline.length > 0 && paneRendered === 0 &&
    !leakedPlaceholder && !!aclWidget && !!routeWidget;
  console.log(pass ? '\nALL PASS' : '\nFAILED');
  process.exit(pass ? 0 : 1);
})();
