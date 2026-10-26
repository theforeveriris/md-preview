#!/usr/bin/env node

/**
 * CI 冒烟测试（smoke test）
 *
 * 快速验证「站点是完整可启动的」，不做渲染级 UI 测试：
 *
 *   1. 语法检查：全部第一方 JS（iris/js/**、iris/app.js、iris/scripts/*.js、
 *      sw.js）用 vm.Script 解析，任何语法错误直接失败（不执行代码）
 *   2. 首页完整性：index.html 用 jsdom 解析（不执行脚本），校验
 *      - 关键骨架节点存在（设置面板、文件树、正文、本地文件面板、
 *        拖拽遮罩、存储管理区块等）
 *      - 每个 <script src> / 本地 <link href> 在磁盘上真实存在
 *        （引用 404 是运行时白屏的头号来源）
 *   3. i18n 完整性：在隔离沙箱加载 iris/js/i18n.js，index.html 里所有
 *      data-i18n* 标记的 key 都必须在 zh 语言包中有翻译
 *   4. 数据产物：file-tree.json / search-index.json / precache-manifest.json
 *      可解析且 precache 引用的文件存在；feed.xml / sitemap.xml 根元素正确
 *
 * 用法：
 *   node iris/scripts/smoke-test.js
 * 依赖：jsdom（iris/package.json devDependencies，CI 内安装）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');

let failures = 0;
function fail(msg) {
  failures++;
  console.error(`  ✗ ${msg}`);
}
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

// ============== 1. 第一方 JS 语法检查 ==============
function collectFirstPartyJs() {
  const files = [];
  const jsDir = path.join(ROOT, 'iris', 'js');
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  })(jsDir);
  files.push(path.join(ROOT, 'iris', 'app.js'));
  files.push(path.join(ROOT, 'sw.js'));
  // scripts/ 顶层脚本（cm6-bundle 等产物子目录不在冒烟范围）
  for (const entry of fs.readdirSync(path.join(ROOT, 'iris', 'scripts'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path.join(ROOT, 'iris', 'scripts', entry.name));
    }
  }
  return files.sort();
}

function checkSyntax() {
  console.log('\n[1/5] 语法检查（第一方 JS）');
  let checked = 0;
  for (const file of collectFirstPartyJs()) {
    const rel = path.relative(ROOT, file);
    let code;
    try {
      code = fs.readFileSync(file, 'utf-8');
    } catch (e) {
      fail(`${rel} 读取失败: ${e.message}`);
      continue;
    }
    try {
      new vm.Script(code, { filename: rel });
      checked++;
    } catch (e) {
      fail(`${rel} 语法错误: ${e.message}`);
    }
  }
  pass(`${checked} 个文件语法 OK`);
}

// ============== 2/3. index.html 解析（jsdom） ==============
function loadIndexDom() {
  // createRequire 从 iris/package.json 解析：不硬编码 node_modules 物理路径
  const { createRequire } = require('module');
  const requireFromIris = createRequire(path.join(ROOT, 'iris', 'package.json'));
  const { JSDOM } = requireFromIris('jsdom');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  return new JSDOM(html, { url: 'https://example.invalid/', runScripts: 'outside-only' });
}

const REQUIRED_IDS = [
  // 页面骨架
  'sidebar', 'fileTree', 'markdownContent', 'readingProgress',
  // 设置面板 + 本次新增区块
  'settingsOverlay', 'mobileGesturesToggle', 'sectionCollapseToggle',
  'settingsSearch',
  // 图谱入口已收敛到命令面板，DOM 里不再有 #openGraphBtn
  'settingsExportBtn', 'settingsImportBtn', 'settingsImportInput',
  'storageUsageFill', 'storageUsageText',
  'storageNotebookList', 'storageNotebooksDesc', 'storageNotebooksClearBtn',
  'storageDataList',
  'downloadEpubBtn', 'downloadSiteEpubBtn', 'downloadSiteMdBtn',
  // 本地文件 / 拖拽
  'localPickOverlay', 'localMdInput', 'localMdFolderInput', 'dropOverlay',
  // 文章内查找条
  'findBar', 'findBarInput', 'findBarCount', 'findBarPrev', 'findBarNext', 'findBarClose',
  // 双栏对照阅读
  'splitViewOverlay', 'splitSyncScrollToggle',
  'splitPaneLeftTitle', 'splitPaneLeftBody',
  'splitPaneRightTitle', 'splitPaneRightBody', 'splitPaneChangeBtn',
  'splitPicker', 'splitPickerInput', 'splitPickerList', 'splitPickerCloseBtn'
];

const LOCAL_HREF_PREFIXES = ['iris/', '/iris/'];

function checkIndexHtml() {
  console.log('\n[2/5] index.html 结构与资源引用');

  let dom;
  try {
    dom = loadIndexDom();
  } catch (e) {
    fail(`无法加载 jsdom（CI 需在 iris/ 下安装依赖）: ${e.message}`);
    return null;
  }
  const doc = dom.window.document;

  for (const id of REQUIRED_IDS) {
    if (doc.getElementById(id)) pass(`#${id} 存在`);
    else fail(`缺少 #${id}`);
  }

  // 所有脚本引用必须真实存在（相对仓库根）
  let scriptCount = 0;
  for (const script of doc.querySelectorAll('script[src]')) {
    const src = script.getAttribute('src');
    if (/^(https?:)?\/\//.test(src)) continue;
    scriptCount++;
    if (fs.existsSync(path.join(ROOT, src))) continue;
    fail(`<script src="${src}"> 文件不存在`);
  }
  pass(`${scriptCount} 个本地脚本引用全部存在`);

  // 本地样式表引用必须真实存在
  let linkCount = 0;
  for (const link of doc.querySelectorAll('link[href]')) {
    const href = link.getAttribute('href') || '';
    if (!LOCAL_HREF_PREFIXES.some(p => href.startsWith(p))) continue;
    linkCount++;
    if (fs.existsSync(path.join(ROOT, href))) continue;
    fail(`<link href="${href}"> 文件不存在`);
  }
  pass(`${linkCount} 个本地样式引用全部存在`);

  return dom;
}

function checkI18nKeys(dom) {
  console.log('\n[3/5] i18n 语言包完整性');

  const doc = dom.window.document;
  const keys = new Set();
  for (const attr of ['data-i18n', 'data-i18n-title', 'data-i18n-aria', 'data-i18n-placeholder']) {
    doc.querySelectorAll(`[${attr}]`).forEach(el => keys.add(el.getAttribute(attr)));
  }

  // 隔离沙箱加载 i18n.js（不执行 DOM 初始化），t(key) 未命中时返回 key 本身，
  // 以此判断 key 是否在语言包中登记
  const sandbox = {
    navigator: { language: 'zh-CN', languages: ['zh-CN'] },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { readyState: 'loading', addEventListener() {}, documentElement: { lang: '' } },
  };
  sandbox.window = { MarkdownPreview: {}, addEventListener() {}, dispatchEvent() {} };
  vm.createContext(sandbox);
  try {
    const code = fs.readFileSync(path.join(ROOT, 'iris', 'js', 'i18n.js'), 'utf-8');
    vm.runInContext(code, sandbox, { filename: 'iris/js/i18n.js' });
  } catch (e) {
    fail(`i18n.js 沙箱加载失败: ${e.message}`);
    return;
  }
  const i18n = sandbox.window.MarkdownPreview.i18n;
  if (!i18n || typeof i18n.t !== 'function') {
    fail('i18n.js 未暴露 window.MarkdownPreview.i18n.t');
    return;
  }

  let missing = [];
  for (const key of keys) {
    if (i18n.t(key) === key) missing.push(key);
  }
  if (missing.length > 0) {
    fail(`index.html 中 ${missing.length} 个 data-i18n key 缺少 zh 翻译: ${missing.join(', ')}`);
  } else {
    pass(`${keys.size} 个 data-i18n key 全部有 zh 翻译`);
  }

  // en 语言包（按需加载的 i18n-en.js）：data-i18n key 全覆盖 + 与 zh 键集一致
  //（.coderabbit.yaml 把「双语齐备」定为必须项，此前无自动检查）
  try {
    const enCode = fs.readFileSync(path.join(ROOT, 'iris', 'js', 'i18n-en.js'), 'utf-8');
    vm.runInContext(enCode, sandbox, { filename: 'iris/js/i18n-en.js' });
  } catch (e) {
    fail(`i18n-en.js 沙箱加载失败: ${e.message}`);
    return;
  }
  const enDict = sandbox.window.MarkdownPreview.I18N_EN;
  if (!enDict || typeof enDict !== 'object') {
    fail('i18n-en.js 未暴露 window.MarkdownPreview.I18N_EN');
    return;
  }
  const zhDict = i18n.getDict ? i18n.getDict('zh') : null;
  const enMissing = [...keys].filter(k => enDict[k] == null);
  if (enMissing.length > 0) {
    fail(`index.html 中 ${enMissing.length} 个 data-i18n key 缺少 en 翻译: ${enMissing.join(', ')}`);
  } else {
    pass(`${keys.size} 个 data-i18n key 全部有 en 翻译`);
  }
  // zh/en 键集差异（反向漂移：en 有而 zh 没有的键）
  if (zhDict) {
    const diff = Object.keys(zhDict).filter(k => enDict[k] == null);
    if (diff.length > 0) fail(`zh 有而 en 缺失 ${diff.length} 个键: ${diff.slice(0, 8).join(', ')}`);
    else pass('zh/en 语言包键集一致');
  }
}

// ============== 4. 数据产物 ==============
function checkDataFiles() {
  console.log('\n[4/5] 数据产物');

  for (const name of ['file-tree.json', 'search-index.json', 'precache-manifest.json']) {
    const file = path.join(ROOT, 'iris', 'data', name);
    try {
      JSON.parse(fs.readFileSync(file, 'utf-8'));
      pass(`${name} 可解析`);
    } catch (e) {
      fail(`${name} JSON 解析失败: ${e.message}`);
    }
  }

  // search-index 检索增强产物内容断言（此前只查「可解析」，拼音/繁体
  // token 是否真的生成无校验）
  try {
    const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'iris', 'data', 'search-index.json'), 'utf-8'));
    if (!Array.isArray(index) || index.length === 0) {
      fail('search-index.json 为空');
    } else {
      const cjkRe = /[一-鿿]/;
      const entries = index.filter(e => e && e.searchText && cjkRe.test(e.title || ''));
      // 拼音首字母 token：标题含中文的条目，searchText 尾部应出现纯小写
      // 拉丁字母 token（且不是标题/预览原文里的英文单词）
      let pinyinCount = 0;
      for (const e of entries) {
        const head = ((e.title || '') + (e.preview || '') + (e.path || '')).toLowerCase();
        const tokens = String(e.searchText).split(/\s+/);
        if (tokens.some(t => /^[a-z]{2,}$/.test(t) && !head.includes(t))) pinyinCount++;
      }
      const expect = Math.max(1, Math.floor(entries.length * 0.6));
      if (entries.length > 0 && pinyinCount < expect) {
        fail(`拼音首字母 token 覆盖不足: ${pinyinCount}/${entries.length}（预期 ≥${expect}）`);
      } else {
        pass(`拼音首字母 token 覆盖 ${pinyinCount}/${entries.length} 条中文标题文档`);
      }
      // 繁体 token（opencc）：任一含「变/图/设」等简体标题的条目应带对应繁体
      const s2t = { '变': '變', '图': '圖', '设': '設', '历': '歷', '记': '記' };
      let tCount = 0;
      for (const e of entries) {
        for (const [simp, trad] of Object.entries(s2t)) {
          if ((e.title || '').includes(simp) && String(e.searchText).includes(trad)) { tCount++; break; }
        }
      }
      if (tCount === 0) fail('繁体 token 未检出（opencc 增强可能失效）');
      else pass(`繁体 token 覆盖 ${tCount} 条文档`);
    }
  } catch (e) {
    fail(`search-index.json 内容校验失败: ${e.message}`);
  }

  // precache 清单引用的文件必须存在
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'iris', 'data', 'precache-manifest.json'), 'utf-8'));
    const urls = (manifest && manifest.urls) || [];
    let missing = 0;
    for (const url of urls) {
      const rel = url.replace(/^\.\//, '');
      if (rel === '' || rel.endsWith('/')) continue; // 目录入口
      if (!fs.existsSync(path.join(ROOT, rel))) {
        fail(`precache 引用不存在: ${url}`);
        missing++;
      }
    }
    if (missing === 0) pass(`precache-manifest ${urls.length} 个引用全部存在`);
  } catch (e) {
    fail(`precache-manifest.json 校验失败: ${e.message}`);
  }

  // feed.xml / sitemap.xml 根元素与关键标记
  const feedFile = path.join(ROOT, 'iris', 'data', 'feed.xml');
  if (fs.existsSync(feedFile)) {
    const xml = fs.readFileSync(feedFile, 'utf-8');
    if (!/<rss[^>]*version="2\.0"/.test(xml)) fail('feed.xml 缺少 <rss version="2.0"> 根元素');
    else if (!xml.includes('<content:encoded>')) fail('feed.xml 缺少 <content:encoded>（全文 RSS）');
    else pass('feed.xml 为全文 RSS（含 content:encoded）');
  } else {
    fail('iris/data/feed.xml 不存在（先运行 build-feed.js）');
  }

  const sitemapFile = path.join(ROOT, 'iris', 'data', 'sitemap.xml');
  if (fs.existsSync(sitemapFile)) {
    const xml = fs.readFileSync(sitemapFile, 'utf-8');
    if (!/<urlset[\s\S]*<\/urlset>/.test(xml)) fail('sitemap.xml 缺少 <urlset> 根元素');
    else if (!xml.includes('<loc>')) fail('sitemap.xml 缺少 <loc> 条目');
    else pass('sitemap.xml 结构正确');
  } else {
    fail('iris/data/sitemap.xml 不存在（先运行 build-sitemap.js）');
  }

  // robots.txt 指向 sitemap
  const robotsFile = path.join(ROOT, 'robots.txt');
  if (fs.existsSync(robotsFile)) {
    if (!fs.readFileSync(robotsFile, 'utf-8').includes('Sitemap:')) fail('robots.txt 缺少 Sitemap 声明');
    else pass('robots.txt 已声明 Sitemap');
  } else {
    fail('robots.txt 不存在');
  }
}

// ============== 5. 文件树自然排序 ==============
// 回归保护：vendor 组件用纯字典序排序，数字开头的文件名会排错位
// （10.0 排到 2.0 前面）。本项目用 applyNaturalOrder 兜底，这里跑回归测试。
function checkFileTreeSort() {
  console.log('\n[5/5] 文件树自然排序');

  const testFile = path.join(ROOT, 'iris', 'scripts', 'test-file-tree-sort.js');
  if (!fs.existsSync(testFile)) {
    fail('iris/scripts/test-file-tree-sort.js 不存在');
    return;
  }
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync(process.execPath, [testFile], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = out.split('\n').filter((l) => l.includes('✓'));
    if (lines.length > 0) {
      pass(`文件树自然排序回归测试通过（${lines.length} 项）`);
    } else {
      fail('文件树自然排序回归测试没有产生通过项');
    }
  } catch (e) {
    const detail = (e.stdout || '') + (e.stderr || '');
    fail(`文件树自然排序回归测试失败:\n${detail.split('\n').map((l) => '      ' + l).join('\n')}`);
  }
}

// ============== 主流程 ==============
function main() {
  console.log('Markdown Preview 冒烟测试');
  checkSyntax();
  const dom = checkIndexHtml();
  if (dom) {
    checkI18nKeys(dom);
  } else {
    console.log('\n[3/5] i18n 语言包完整性 — 跳过（依赖 index.html 解析）');
  }
  checkDataFiles();
  checkFileTreeSort();

  console.log('');
  if (failures > 0) {
    console.error(`✗ 冒烟测试失败：${failures} 项未通过`);
    process.exit(1);
  }
  console.log('✓ 冒烟测试全部通过');
}

main();
