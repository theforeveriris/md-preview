/**
 * SW 预缓存清单自动生成测试
 *
 * 验证：
 *   1. build-precache.js 扫描规则与产物结构
 *   2. sw.js 正确消费 manifest（含降级兜底）
 *   3. CI workflow 包含 build 步骤
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../..');
const builder = require(path.join(ROOT, 'iris/scripts/build-precache.js'));

let pass = 0, fail = 0;
function assert(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.error(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

// 通过沙箱执行整个 sw.js（桩掉 self.addEventListener 等），再调用 loadPrecacheUrls
function runLoadPrecacheUrls(swCode, fetchImpl) {
  const sandbox = {
    self: {},
    fetch: fetchImpl,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    caches: { open: async () => ({ match: async () => null, put: async () => {} }) },
    clients: { claim: async () => {} },
    Response,
    Promise,
  };
  sandbox.self.addEventListener = () => {};
  sandbox.self.skipWaiting = () => Promise.resolve();
  sandbox.self.clients = sandbox.clients;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // 执行整个 sw.js（注册 listeners、定义常量与函数），不报错即可
  vm.runInContext(swCode, sandbox, { timeout: 2000 });
  // 再调用 loadPrecacheUrls，捕获 Promise
  vm.runInContext(
    'globalThis.__promise = loadPrecacheUrls();',
    sandbox,
    { timeout: 2000 }
  );
  return Promise.resolve(sandbox.__promise).then(urls => ({ urls, sandbox }));
}

async function main() {
  console.log('=== build-precache.js 模块导出 ===');
  assert('导出 isExcluded 函数', typeof builder.isExcluded === 'function');
  assert('导出 scanDir 函数', typeof builder.scanDir === 'function');
  assert('导出 buildManifest 函数', typeof builder.buildManifest === 'function');
  assert('导出 IRIS_DIR 路径', typeof builder.IRIS_DIR === 'string' && fs.existsSync(builder.IRIS_DIR));
  assert('导出 OUTPUT_FILE 路径', typeof builder.OUTPUT_FILE === 'string');
  assert('导出 ALLOWED_EXTS 集合', builder.ALLOWED_EXTS instanceof Set && builder.ALLOWED_EXTS.has('.js'));
  assert('导出 VENDOR_ALLOWED 数组', Array.isArray(builder.VENDOR_ALLOWED));
  assert('导出 DATA_ALLOWED 数组', Array.isArray(builder.DATA_ALLOWED));
  assert('导出 EXCLUDE_PREFIXES 数组', Array.isArray(builder.EXCLUDE_PREFIXES));
  assert('EXCLUDE_PREFIXES 含 plugins/', builder.EXCLUDE_PREFIXES.includes('plugins/'));

  console.log('\n=== isExcluded 规则验证 ===');
  // 应被排除
  assert('plugins/ 前缀排除', builder.isExcluded('plugins/qrcode.js') === true);
  assert('plugins/ 前缀排除（子目录）', builder.isExcluded('plugins/sub/foo.js') === true);
  assert('data/ensp/ 排除', builder.isExcluded('data/ensp/foo.json') === true);
  assert('data/pkt/raw/ 排除', builder.isExcluded('data/pkt/raw/foo.bin') === true);
  assert('data/pkt/xml/ 排除', builder.isExcluded('data/pkt/xml/foo.xml') === true);
  assert('examples/ 排除', builder.isExcluded('examples/demo.md') === true);
  assert('scripts/ 排除', builder.isExcluded('scripts/build.js') === true);
  assert('vendor/katex/ 排除', builder.isExcluded('vendor/katex/katex.min.css') === true);
  assert('vendor/leaflet/ 排除', builder.isExcluded('vendor/leaflet/leaflet.js') === true);
  assert('vendor/diff2html/ 排除', builder.isExcluded('vendor/diff2html/diff2html.min.js') === true);
  assert('mermaid.min.js 排除', builder.isExcluded('vendor/mermaid/mermaid.min.js') === true);
  assert('apexcharts.min.js 排除', builder.isExcluded('vendor/apexcharts/apexcharts.min.js') === true);
  assert('pako.min.js 排除', builder.isExcluded('vendor/pako/pako.min.js') === true);
  assert('package.json 排除', builder.isExcluded('package.json') === true);
  assert('package-lock.json 排除', builder.isExcluded('package-lock.json') === true);
  // vendor 下未在白名单的子目录
  assert('vendor/foo/ 未知子目录排除', builder.isExcluded('vendor/foo/bar.js') === true);
  assert('vendor/highlight.js/styles/atom-one.css 排除', builder.isExcluded('vendor/highlight.js/styles/atom-one.css') === true);
  // data 下未在白名单的文件
  assert('data/foo.json 排除', builder.isExcluded('data/foo.json') === true);

  // 应保留
  assert('js/plugins/loader.js 保留（核心 boot 文件）', builder.isExcluded('js/plugins/loader.js') === false);
  assert('js/editor.js 保留', builder.isExcluded('js/editor.js') === false);
  assert('css/editor.css 保留', builder.isExcluded('css/editor.css') === false);
  assert('vendor/marked.js 保留', builder.isExcluded('vendor/marked.js') === false);
  assert('vendor/marked-footnote.min.js 保留', builder.isExcluded('vendor/marked-footnote.min.js') === false);
  assert('vendor/flexsearch.bundle.js 保留', builder.isExcluded('vendor/flexsearch.bundle.js') === false);
  assert('vendor/codemirror/codemirror.min.js 保留', builder.isExcluded('vendor/codemirror/codemirror.min.js') === false);
  assert('vendor/cytoscape/cytoscape.min.js 保留', builder.isExcluded('vendor/cytoscape/cytoscape.min.js') === false);
  assert('vendor/highlight.js/highlight.min.js 保留', builder.isExcluded('vendor/highlight.js/highlight.min.js') === false);
  assert('vendor/highlight.js/styles/github.css 保留', builder.isExcluded('vendor/highlight.js/styles/github.css') === false);
  assert('vendor/file-tree/prod.js 保留', builder.isExcluded('vendor/file-tree/prod.js') === false);
  assert('vendor/file-tree/prod.css 保留', builder.isExcluded('vendor/file-tree/prod.css') === false);
  assert('data/file-tree.json 保留', builder.isExcluded('data/file-tree.json') === false);
  assert('data/search-index.json 保留', builder.isExcluded('data/search-index.json') === false);
  assert('data/feed.xml 保留', builder.isExcluded('data/feed.xml') === false);
  assert('data/pkt/icons.svg 保留', builder.isExcluded('data/pkt/icons.svg') === false);
  assert('icons/icon.svg 保留', builder.isExcluded('icons/icon.svg') === false);
  assert('styles.css 保留', builder.isExcluded('styles.css') === false);
  assert('app.js 保留', builder.isExcluded('app.js') === false);
  assert('config.json 保留', builder.isExcluded('config.json') === false);

  console.log('\n=== 扩展名过滤 ===');
  assert('html 不在允许扩展名', !builder.ALLOWED_EXTS.has('.html'));
  assert('md 不在允许扩展名', !builder.ALLOWED_EXTS.has('.md'));
  assert('txt 不在允许扩展名', !builder.ALLOWED_EXTS.has('.txt'));
  assert('woff2 在允许扩展名', builder.ALLOWED_EXTS.has('.woff2'));

  console.log('\n=== buildManifest 产物结构 ===');
  const manifest = builder.buildManifest();
  assert('manifest 有 generatedAt 字段', typeof manifest.generatedAt === 'string' && !isNaN(Date.parse(manifest.generatedAt)));
  assert('manifest.version = 1', manifest.version === 1);
  assert('manifest.count === urls.length', manifest.count === manifest.urls.length);
  assert('manifest.urls 是数组', Array.isArray(manifest.urls));
  assert('manifest.urls 非空', manifest.urls.length > 30);
  assert('urls 去重', new Set(manifest.urls).size === manifest.urls.length);
  assert('urls 已排序', JSON.stringify(manifest.urls.slice().sort()) === JSON.stringify(manifest.urls));
  assert('urls 全部以 ./ 开头', manifest.urls.every(u => u.startsWith('./')));
  assert('urls 含 ./', manifest.urls.includes('./'));
  assert('urls 含 ./index.html', manifest.urls.includes('./index.html'));
  assert('urls 含 ./manifest.json', manifest.urls.includes('./manifest.json'));

  console.log('\n=== 关键 boot 资源必须存在 ===');
  const critical = [
    './iris/styles.css',
    './iris/app.js',
    './iris/config.json',
    './iris/css/base.css',
    './iris/css/editor.css',
    './iris/css/markdown.css',
    './iris/js/config.js',
    './iris/js/dom.js',
    './iris/js/markdown.js',
    './iris/js/md-render.js',
    './iris/js/editor.js',
    './iris/js/storage.js',
    './iris/js/router.js',
    './iris/js/plugins/loader.js',
    './iris/vendor/marked.js',
    './iris/vendor/marked-footnote.min.js',
    './iris/vendor/codemirror/codemirror.min.js',
    './iris/vendor/highlight.js/highlight.min.js',
    './iris/vendor/highlight.js/styles/github.css',
    './iris/vendor/flexsearch.bundle.js',
    './iris/vendor/cytoscape/cytoscape.min.js',
    './iris/vendor/file-tree/prod.js',
    './iris/data/file-tree.json',
    './iris/data/search-index.json',
    './iris/data/pkt/icons.svg',
  ];
  critical.forEach(u => assert(`urls 含 ${u}`, manifest.urls.includes(u)));

  console.log('\n=== 大文件 / 按需资源必须不存在 ===');
  const forbidden = [
    './iris/plugins/qrcode.js',
    './iris/plugins/directory.json',
    './iris/vendor/mermaid/mermaid.min.js',
    './iris/vendor/apexcharts/apexcharts.min.js',
    './iris/vendor/pako/pako.min.js',
    './iris/vendor/katex/katex.min.css',
    './iris/vendor/leaflet/leaflet.js',
    './iris/vendor/diff2html/diff2html.min.js',
    './iris/scripts/build-precache.js',
    './iris/data/ensp/sample.json',
    './iris/data/pkt/raw/sample.bin',
    './iris/data/pkt/xml/sample.xml',
    './package.json',
    './package-lock.json',
  ];
  forbidden.forEach(u => assert(`urls 不含 ${u}`, !manifest.urls.includes(u)));

  console.log('\n=== 持久化产物校验 ===');
  const outputPath = builder.OUTPUT_FILE;
  assert('产物文件存在', fs.existsSync(outputPath));
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert('持久化产物 count 字段', typeof written.count === 'number');
  assert('持久化产物 urls 数组', Array.isArray(written.urls));
  assert('持久化产物与 buildManifest 一致', written.count === manifest.count);
  assert('产物含 ./iris/js/plugins/loader.js', written.urls.includes('./iris/js/plugins/loader.js'));
  assert('产物不含 ./iris/plugins/qrcode.js', !written.urls.includes('./iris/plugins/qrcode.js'));

  console.log('\n=== sw.js manifest 消费校验 ===');
  const swCode = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert('sw.js 含 PRECACHE_MANIFEST_URL 常量', /PRECACHE_MANIFEST_URL\s*=\s*['"].+precache-manifest\.json['"]/.test(swCode));
  assert('sw.js 含 loadPrecacheUrls 函数', /async\s+function\s+loadPrecacheUrls\s*\(/.test(swCode));
  assert('sw.js fetch manifest', /fetch\s*\(\s*PRECACHE_MANIFEST_URL/.test(swCode));
  assert('sw.js 解析 data.urls', /data\.urls\b/.test(swCode));
  assert('sw.js 含 PRECACHE_FALLBACK_URLS', /PRECACHE_FALLBACK_URLS\s*=\s*\[/.test(swCode));
  assert('sw.js manifest 失败时回退', /PRECACHE_FALLBACK_URLS\.slice\(\)/.test(swCode));
  assert('sw.js manifest 自身加入缓存', /urls\.push\s*\(\s*PRECACHE_MANIFEST_URL\s*\)/.test(swCode));
  assert('sw.js precache 调用 loadPrecacheUrls', /const\s+urls\s*=\s*await\s+loadPrecacheUrls\s*\(\s*\)/.test(swCode));
  assert('sw.js CACHE_NAME 已升级到 v7.1', /md-preview-v7\.1/.test(swCode));
  assert('sw.js RUNTIME_CACHE 已升级到 v7.1', /md-preview-runtime-v7\.1/.test(swCode));
  assert('sw.js 不再含旧的硬编码 PRECACHE_URLS 数组', !/const\s+PRECACHE_URLS\s*=\s*\[/.test(swCode));
  assert('fallback 含 ./', /['"]\.\/['"]/.test(swCode));
  assert('fallback 含 ./index.html', /['"]\.\/index\.html['"]/.test(swCode));
  assert('fallback 含 editor.js', /['"]\.\/iris\/js\/editor\.js['"]/.test(swCode));
  assert('fallback 含 storage.js', /['"]\.\/iris\/js\/storage\.js['"]/.test(swCode));
  assert('fallback 含 md-render.js', /['"]\.\/iris\/js\/md-render\.js['"]/.test(swCode));

  console.log('\n=== loadPrecacheUrls 行为模拟（沙箱执行） ===');

  // 场景 1: manifest 正常返回
  const goodFetch = async (url) => {
    if (url && url.indexOf('precache-manifest.json') !== -1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          generatedAt: '2026-07-18T18:03:21.937Z',
          version: 1,
          count: 3,
          urls: ['./', './index.html', './manifest.json'],
        }),
      };
    }
    return { ok: false, status: 404 };
  };
  const r1 = await runLoadPrecacheUrls(swCode, goodFetch);
  // manifest 返回 3 个 urls，sw.js 自动追加 manifest 自身 → 4 个
  assert('场景1 manifest 正常返回 urls 数组', Array.isArray(r1.urls) && r1.urls.length === 4);
  assert('场景1 自动追加 manifest 自身', r1.urls.includes('./iris/data/precache-manifest.json'));

  // 场景 2: manifest fetch 失败，应回退
  const badFetch = async () => { throw new Error('network down'); };
  const r2 = await runLoadPrecacheUrls(swCode, badFetch);
  assert('场景2 fetch 失败时回退到 fallback', Array.isArray(r2.urls) && r2.urls.length > 0);
  assert('场景2 fallback 含 ./', r2.urls.includes('./'));
  assert('场景2 fallback 含 editor.js', r2.urls.includes('./iris/js/editor.js'));
  assert('场景2 fallback 含 manifest URL', r2.urls.includes('./iris/data/precache-manifest.json'));

  // 场景 3: manifest 返回空 urls 数组，应回退
  const emptyFetch = async (url) => {
    if (url && url.indexOf('precache-manifest.json') !== -1) {
      return { ok: true, status: 200, json: async () => ({ urls: [] }) };
    }
    return { ok: false, status: 404 };
  };
  const r3 = await runLoadPrecacheUrls(swCode, emptyFetch);
  assert('场景3 manifest 空 urls 时回退到 fallback', Array.isArray(r3.urls) && r3.urls.length > 0);

  // 场景 4: manifest 返回非 ok 状态，应回退
  const notOkFetch = async (url) => {
    if (url && url.indexOf('precache-manifest.json') !== -1) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return { ok: false, status: 404 };
  };
  const r4 = await runLoadPrecacheUrls(swCode, notOkFetch);
  assert('场景4 manifest HTTP 500 时回退', Array.isArray(r4.urls) && r4.urls.length > 0);

  console.log('\n=== CI workflow 校验 ===');
  const wfPath = path.join(ROOT, '.github/workflows/build-and-deploy.yml');
  assert('workflow 文件存在', fs.existsSync(wfPath));
  const wf = fs.readFileSync(wfPath, 'utf8');
  assert('workflow 含 Build File Tree 步骤', /Build File Tree/.test(wf));
  assert('workflow 含 Build Search Index 步骤', /Build Search Index/.test(wf));
  assert('workflow 含 Build Precache Manifest 步骤', /Build Precache Manifest/.test(wf));
  assert('workflow 调用 build-precache.js', /node iris\/scripts\/build-precache\.js/.test(wf));
  assert('workflow 调用 build-file-tree.js', /node iris\/scripts\/build-file-tree\.js/.test(wf));
  assert('precache 步骤在 artifact upload 之前', wf.indexOf('build-precache.js') < wf.indexOf('upload-pages-artifact'));

  console.log(`\n=== 结果: ${pass} 通过 / ${fail} 失败 ===`);
  if (fail > 0) process.exit(1);
}

main().catch(err => {
  console.error('测试运行异常:', err);
  process.exit(1);
});
