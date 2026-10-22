// 验证 index.html 脚本引用顺序：md-render.js 必须先于所有顶层引用 mdRender 的模块
const fs = require('fs');
const s = fs.readFileSync('index.html', 'utf8');
const refs = [...s.matchAll(/defer src="([^"]+)"/g)].map(m => m[1]);
const missing = refs.filter(r => r.startsWith('iris/') && !fs.existsSync(r));
console.log('missing files:', missing.length ? missing : 'none');
const iMdRender = refs.indexOf('iris/js/md-render.js');
const consumers = [
  'iris/js/search.js', 'iris/js/tags.js', 'iris/js/markdown.js',
  'iris/js/hover-preview.js', 'iris/js/selection-tools.js', 'iris/js/split-view.js',
  'iris/js/settings.js', 'iris/js/editor.js',
];
const bad = consumers.filter(c => refs.indexOf(c) < iMdRender && refs.indexOf(c) !== -1);
console.log('loaded before md-render.js:', bad.length ? bad : 'none');
// 渲染器脚本必须在 md-render 之后（它们顶层引用 mdRender/注册表）
const renderers = refs.filter(r => r.includes('/renderers/'));
const badR = renderers.filter(r => refs.indexOf(r) < iMdRender);
console.log('renderers before md-render.js:', badR.length ? badR : 'none');
