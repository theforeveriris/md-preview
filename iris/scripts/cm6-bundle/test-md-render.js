/**
 * md-render.js 共享渲染模块验证测试
 *
 * 验证：
 *   1. 模块注册与 API 完整性
 *   2. processGitHubAlerts 默认 emoji 与自定义 SVG 都生效
 *   3. protectLaTeXBlocks / restoreLaTeXBlocks 配对正确
 *   4. createMdRenderer 的 code/paragraph 渲染
 *   5. parseMarkdown 端到端
 *   6. groupGalleries 画廊分组
 *   7. editor.js 与 markdown.js 已切换为调用共享模块（无重复实现）
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

const HTML = `<!DOCTYPE html><html><body>
  <div id="markdownContent" class="markdown-body"></div>
</body></html>`;

const dom = new JSDOM(HTML, {
  url: 'https://example.com/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.localStorage = window.localStorage;
global.performance = window.performance;
global.Node = window.Node;
global.HTMLElement = window.HTMLElement;

// marked stub（最小实现，足以让 md-render.js 跑通）
window.marked = {
  parse: function(text, opts) {
    // 极简：直接返回文本，加上段落包裹
    return text.split('\n').map(l => l.trim() ? `<p>${l}</p>` : '').join('\n');
  },
  Renderer: function() {
    const r = { code: () => '', paragraph: () => '' };
    // paragraph 调用 this.parser.parseInline(token.tokens)，需提供 parser stub
    r.parser = { parseInline: (toks) => (toks || []).map(t => t.text || t.raw || '').join('') };
    return r;
  }
};
global.marked = window.marked;

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.error(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

function run() {
  // 加载 md-render.js
  const mdRenderCode = fs.readFileSync(path.join(ROOT, 'iris/js/md-render.js'), 'utf8');
  window.eval(mdRenderCode);
  const mdRender = window.MarkdownPreview.mdRender;

  console.log('=== 模块注册 ===');
  assert('mdRender 已注册', !!mdRender);
  assert('KNOWN_STYLES 常量', Array.isArray(mdRender.KNOWN_STYLES) && mdRender.KNOWN_STYLES.length === 17);
  assert('DEFAULT_ALERT_TYPES', typeof mdRender.DEFAULT_ALERT_TYPES === 'object');
  assert('processGitHubAlerts 函数', typeof mdRender.processGitHubAlerts === 'function');
  assert('protectLaTeXBlocks 函数', typeof mdRender.protectLaTeXBlocks === 'function');
  assert('restoreLaTeXBlocks 函数', typeof mdRender.restoreLaTeXBlocks === 'function');
  assert('createMdRenderer 函数', typeof mdRender.createMdRenderer === 'function');
  assert('parseMarkdown 函数', typeof mdRender.parseMarkdown === 'function');
  assert('groupGalleries 函数', typeof mdRender.groupGalleries === 'function');
  assert('initSliders 函数', typeof mdRender.initSliders === 'function');
  assert('highlightCodeBlocks 函数', typeof mdRender.highlightCodeBlocks === 'function');

  console.log('=== KNOWN_STYLES 内容 ===');
  ['grid','cardstack','filmstrip','polaroid','stack','mosaic','scattered',
   'hexagon','coverflow','tape','duotone','frame','arch','masonry','slider','ticket','panorama']
    .forEach(s => assert(`包含 ${s}`, mdRender.KNOWN_STYLES.includes(s)));

  console.log('=== processGitHubAlerts 默认 emoji ===');
  const alertText = '> [!NOTE]\n> 这是一个 note';
  const result = mdRender.processGitHubAlerts(alertText);
  assert('NOTE alert 被识别', result.includes('alert-note'));
  assert('默认 emoji 图标 ℹ️', result.includes('ℹ️'));
  assert('默认标题 Note', result.includes('Note'));

  console.log('=== processGitHubAlerts 自定义 SVG ===');
  const svgAlert = (p) => `<svg>${p}</svg>`;
  const customTypes = {
    NOTE: { icon: svgAlert('<circle/>'), title: 'CustomNote' }
  };
  const result2 = mdRender.processGitHubAlerts(alertText, { alertTypes: customTypes });
  assert('NOTE alert 被识别', result2.includes('alert-note'));
  assert('自定义 SVG 图标', result2.includes('<svg><circle/></svg>'));
  assert('自定义标题', result2.includes('CustomNote'));

  console.log('=== protectLaTeXBlocks / restoreLaTeXBlocks ===');
  const texText = '正文\n$$\nx^2 + y^2 = z^2\n$$\n后续';
  const { processed, blocks } = mdRender.protectLaTeXBlocks(texText);
  assert('占位符替换', processed.includes('LATEXPROTECT_0_'));
  assert('原 $$ 被移除', !processed.includes('$$'));
  assert('blocks 数组长度', blocks.length === 1);
  assert('blocks 内容正确', blocks[0].includes('x^2 + y^2 = z^2'));
  const restored = mdRender.restoreLaTeXBlocks(processed, blocks);
  assert('还原后含 katex-block', restored.includes('<div class="katex-block">'));
  assert('还原后含 LaTeX 内容', restored.includes('x^2 + y^2 = z^2'));

  console.log('=== createMdRenderer ===');
  const renderer = mdRender.createMdRenderer();
  // marked.parse 在真实调用时会自动设置 renderer.parser，测试中手动设置
  renderer.parser = { parseInline: (toks) => (toks || []).map(t => t.text || t.raw || '').join('') };
  assert('renderer 对象', typeof renderer === 'object');
  assert('renderer.code 函数', typeof renderer.code === 'function');
  assert('renderer.paragraph 函数', typeof renderer.paragraph === 'function');
  // code 渲染
  const codeHtml = renderer.code({ text: 'console.log(1)', lang: 'js' });
  assert('code 生成 pre.code-block', codeHtml.includes('<pre class="code-block"'));
  assert('code 含 language-js class', codeHtml.includes('class="language-js"'));
  assert('code 含复制按钮', codeHtml.includes('class="copy-btn"'));
  assert('code 含 lang 标签', codeHtml.includes('code-lang-label'));
  // paragraph：识别 @style 标记
  const paraMarker = renderer.paragraph({ text: '@cardstack', tokens: [] });
  assert('@style 转为 marker', paraMarker.includes('gallery-style-marker'));
  assert('marker data-style 正确', paraMarker.includes('data-style="cardstack"'));
  // paragraph：未知 @style 不转换
  const paraUnknown = renderer.paragraph({ text: '@unknownstyle', tokens: [] });
  assert('未知 @style 不转换', !paraUnknown.includes('gallery-style-marker'));

  console.log('=== parseMarkdown 端到端 ===');
  const md = '# 标题\n\n正文段落';
  const r = mdRender.parseMarkdown(md);
  assert('返回 html 字符串', typeof r.html === 'string');
  assert('返回 blocks 数组', Array.isArray(r.blocks));
  assert('html 非空', r.html.length > 0);

  console.log('=== groupGalleries 画廊分组 ===');
  // 构造容器：3 张相邻图片 + @polaroid 标记（紧凑 HTML，模拟 marked.parse 输出）
  const container = window.document.createElement('div');
  container.innerHTML = '<p class="gallery-style-marker" data-style="polaroid"></p><p><img src="a.jpg" alt="A"></p><p><img src="b.jpg" alt="B"></p><p><img src="c.jpg" alt="C"></p><p>非图片段落</p>';
  mdRender.groupGalleries(container);
  const galleries = container.querySelectorAll('.image-gallery');
  assert('生成 1 个画廊', galleries.length === 1);
  assert('画廊含 polaroid 样式类', galleries[0].classList.contains('image-gallery--polaroid'));
  assert('画廊含 3 张图', galleries[0].querySelectorAll('img').length === 3);
  assert('marker 节点被移除', container.querySelectorAll('.gallery-style-marker').length === 0);

  console.log('=== groupGalleries 单张图片不分组 ===');
  const c2 = window.document.createElement('div');
  c2.innerHTML = `<p><img src="only.jpg" alt="X"></p>`;
  mdRender.groupGalleries(c2);
  assert('单图不生成画廊', c2.querySelectorAll('.image-gallery').length === 0);

  console.log('=== highlightCodeBlocks（无 hljs 时安全跳过） ===');
  const c3 = window.document.createElement('div');
  c3.innerHTML = `<pre><code class="language-js">var x = 1;</code></pre>`;
  // 无 hljs 全局变量，应静默跳过不报错
  let noThrow = true;
  try { mdRender.highlightCodeBlocks(c3); } catch (e) { noThrow = false; }
  assert('无 hljs 时不抛错', noThrow);

  console.log('=== initSliders（无图片时安全跳过） ===');
  const c4 = window.document.createElement('div');
  let noThrow2 = true;
  try { mdRender.initSliders(c4); } catch (e) { noThrow2 = false; }
  assert('空容器不抛错', noThrow2);

  console.log('=== editor.js 已切换为共享模块 ===');
  const editorCode = fs.readFileSync(path.join(ROOT, 'iris/js/editor.js'), 'utf8');
  assert('editor.js 引用 mdRender', editorCode.includes('window.MarkdownPreview.mdRender'));
  assert('editor.js 调用 mdRender.parseMarkdown', editorCode.includes('mdRender.parseMarkdown'));
  assert('editor.js 调用 mdRender.groupGalleries', editorCode.includes('mdRender.groupGalleries'));
  assert('editor.js 调用 mdRender.initSliders', editorCode.includes('mdRender.initSliders'));
  assert('editor.js 调用 mdRender.highlightCodeBlocks', editorCode.includes('mdRender.highlightCodeBlocks'));
  assert('editor.js 保留 SVG alertTypes', editorCode.includes('EDITOR_ALERT_TYPES'));
  // 确认旧的内部实现已删除
  assert('editor.js 无重复的 processGitHubAlerts 函数定义', !/function processGitHubAlerts\s*\(/.test(editorCode));
  assert('editor.js 无重复的 protectLaTeXBlocks 函数定义', !/function protectLaTeXBlocks\s*\(/.test(editorCode));
  assert('editor.js 无重复的 createRenderer 函数定义', !/function createRenderer\s*\(/.test(editorCode));
  assert('editor.js 无重复的 processImages 函数定义', !/function processImages\s*\(/.test(editorCode));
  assert('editor.js 无重复的 initSliders 函数定义', !/function initSliders\s*\(/.test(editorCode));

  console.log('=== markdown.js 已切换为共享模块 ===');
  const mdCode = fs.readFileSync(path.join(ROOT, 'iris/js/markdown.js'), 'utf8');
  assert('markdown.js 引用 mdRender', mdCode.includes('window.MarkdownPreview.mdRender'));
  assert('markdown.js 调用 mdRender.parseMarkdown', mdCode.includes('mdRender.parseMarkdown'));
  assert('markdown.js 调用 mdRender.groupGalleries', mdCode.includes('mdRender.groupGalleries'));
  assert('markdown.js 调用 mdRender.initSliders', mdCode.includes('mdRender.initSliders'));
  assert('markdown.js 调用 mdRender.highlightCodeBlocks', mdCode.includes('mdRender.highlightCodeBlocks'));
  assert('markdown.js 调用 mdRender.protectLaTeXBlocks', mdCode.includes('mdRender.protectLaTeXBlocks'));
  assert('markdown.js 调用 mdRender.processGitHubAlerts', mdCode.includes('mdRender.processGitHubAlerts'));
  // 确认旧的内部实现已删除
  assert('markdown.js 无重复的 processGitHubAlerts 函数定义', !/function processGitHubAlerts\s*\(/.test(mdCode));
  assert('markdown.js 无重复的 protectLaTeXBlocks 函数定义', !/function protectLaTeXBlocks\s*\(/.test(mdCode));
  assert('markdown.js 无重复的 initSliders 函数定义', !/function initSliders\s*\(/.test(mdCode));
  // processImages 保留（markdown.js 特有的图片路径解析）
  assert('markdown.js 保留 processImages（路径解析特有）', /function processImages\s*\(/.test(mdCode));

  console.log('=== HTML / SW 已注册 md-render.js ===');
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert('index.html 引入 md-render.js', indexHtml.includes('iris/js/md-render.js'));
  // md-render.js 必须在 markdown.js 之前（因为 markdown.js 依赖它）
  const mdRenderPos = indexHtml.indexOf('iris/js/md-render.js');
  const markdownPos = indexHtml.indexOf('iris/js/markdown.js');
  assert('md-render.js 在 markdown.js 之前', mdRenderPos > 0 && mdRenderPos < markdownPos);

  const swCode = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert('sw.js 预缓存 md-render.js', swCode.includes('./iris/js/md-render.js'));

  console.log('=== 代码量减少（去重后） ===');
  const editorLines = editorCode.split('\n').length;
  const mdLines = mdCode.split('\n').length;
  const sharedLines = fs.readFileSync(path.join(ROOT, 'iris/js/md-render.js'), 'utf8').split('\n').length;
  console.log(`  编辑器: ${editorLines} 行 | markdown.js: ${mdLines} 行 | md-render.js: ${sharedLines} 行（共享）`);
  assert('md-render.js 行数合理', sharedLines > 200 && sharedLines < 350);

  console.log('');
  console.log(`============================`);
  console.log(`测试结果: ${pass} 通过, ${fail} 失败`);
  console.log(`============================`);
  process.exit(fail > 0 ? 1 : 0);
}

try {
  run();
} catch (e) {
  console.error('测试运行异常:', e);
  process.exit(1);
}
