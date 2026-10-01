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
  console.log('\n[1/4] 语法检查（第一方 JS）');
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
  const { JSDOM } = require(path.join(ROOT, 'iris', 'node_modules', 'jsdom'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
  return new JSDOM(html, { url: 'https://example.invalid/', runScripts: 'outside-only' });
}

const REQUIRED_IDS = [
  // 页面骨架
  'sidebar', 'fileTree', 'markdownContent', 'readingProgress',
  // 设置面板 + 本次新增区块
  'settingsOverlay', 'mobileGesturesToggle', 'sectionCollapseToggle',
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
  'splitViewOverlay', 'splitViewCloseBtn', 'splitSyncToggle',
  'splitPaneLeftTitle', 'splitPaneLeftBody',
  'splitPaneRightTitle', 'splitPaneRightBody', 'splitPaneChangeBtn',
  'splitPicker', 'splitPickerInput', 'splitPickerList', 'splitPickerCloseBtn'
];

const LOCAL_HREF_PREFIXES = ['iris/', '/iris/'];

function checkIndexHtml() {
  console.log('\n[2/4] index.html 结构与资源引用');

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
  console.log('\n[3/4] i18n 语言包完整性');

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
}

// ============== 4. 数据产物 ==============
function checkDataFiles() {
  console.log('\n[4/4] 数据产物');

  for (const name of ['file-tree.json', 'search-index.json', 'precache-manifest.json']) {
    const file = path.join(ROOT, 'iris', 'data', name);
    try {
      JSON.parse(fs.readFileSync(file, 'utf-8'));
      pass(`${name} 可解析`);
    } catch (e) {
      fail(`${name} JSON 解析失败: ${e.message}`);
    }
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

// ============== 主流程 ==============
function main() {
  console.log('Markdown Preview 冒烟测试');
  checkSyntax();
  const dom = checkIndexHtml();
  if (dom) {
    checkI18nKeys(dom);
  } else {
    console.log('\n[3/4] i18n 语言包完整性 — 跳过（依赖 index.html 解析）');
  }
  checkDataFiles();

  console.log('');
  if (failures > 0) {
    console.error(`✗ 冒烟测试失败：${failures} 项未通过`);
    process.exit(1);
  }
  console.log('✓ 冒烟测试全部通过');
}

main();
