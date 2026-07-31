#!/usr/bin/env node
/**
 * 自动生成 Service Worker 预缓存清单
 *
 * 扫描 iris/ 目录下的静态资源，按规则过滤后输出到
 *   iris/data/precache-manifest.json
 *
 * sw.js 在 install 时 fetch 该 JSON 获取完整列表，避免在 sw.js 中硬编码。
 *
 * 包含规则：
 *   - 扩展名：.js .css .json .svg .png .jpg .jpeg .ico .xml .woff .woff2 .ttf
 *   - iris/css/**, iris/js/**, iris/icons/**, iris/data/{file-tree,search-index,feed,pkt/icons.svg}
 *   - iris/vendor 下：marked.js, marked-footnote.min.js, flexsearch.bundle.js,
 *     file-tree/prod.js, codemirror/, cytoscape/, highlight.js/highlight.min.js,
 *     highlight.js/styles/github.css
 *   - iris/{styles.css, app.js, config.json}
 *   - 根目录：./, ./index.html, ./manifest.json
 *
 * 排除规则（不预缓存，按需加载）：
 *   - iris/scripts/         构建脚本
 *   - iris/data/ensp/       ENSP 大文件
 *   - iris/data/pkt/raw/    PKT 原始文件
 *   - iris/data/pkt/xml/    PKT XML 中间产物
 *   - iris/plugins/         插件（按需）
 *   - iris/vendor 下的：apexcharts.min.js, mermaid.min.js, pako.min.js,
 *     katex/（含字体）, leaflet/, diff2html/, highlight.js/styles/*（除 github.css）
 *   - package.json, package-lock.json
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const IRIS_DIR = path.join(ROOT, 'iris');
const OUTPUT_FILE = path.join(IRIS_DIR, 'data', 'precache-manifest.json');

// 允许的扩展名
const ALLOWED_EXTS = new Set([
  '.js', '.css', '.json', '.svg', '.png', '.jpg', '.jpeg', '.ico', '.xml',
  '.woff', '.woff2', '.ttf'
]);

// 排除前缀（iris/ 下以该前缀开头的路径整体排除）
// 注意：必须用前缀而非 includes('/xxx/')，否则会误伤 js/xxx/ 等同名子目录
const EXCLUDE_PREFIXES = [
  'scripts/',  // iris/scripts/ 下的构建脚本
  'plugins/',  // iris/plugins/ 下的下载型插件，按需加载
];

// 排除路径片段（任意位置包含即排除，主要用于 vendor/data 下的子目录）
// 注：data/ 和 vendor/ 已有白名单约束，这里仅作为冗余防护
const EXCLUDE_PATH_FRAGMENTS = [
  '/data/ensp/',
  '/data/pkt/raw/',
  '/data/pkt/xml/',
  '/vendor/katex/',
  '/vendor/leaflet/',
  '/vendor/diff2html/',
];

// 排除的特定文件名
const EXCLUDE_FILES = new Set([
  'package.json',
  'package-lock.json',
  'mermaid.min.js',
  'apexcharts.min.js',
  'pako.min.js',
]);

// vendor 下只允许以下子目录/文件
const VENDOR_ALLOWED = [
  'marked.js',
  'marked-footnote.min.js',
  'flexsearch.bundle.js',
  'codemirror/codemirror.min.js',
  'cytoscape/cytoscape.min.js',
  'highlight.js/highlight.min.js',
  'highlight.js/styles/github.css',
  'file-tree/prod.js',
  'file-tree/prod.css',
];

// data 下只允许以下文件
const DATA_ALLOWED = [
  'file-tree.json',
  'search-index.json',
  'feed.xml',
  'pkt/icons.svg',
];

function isExcluded(relPath) {
  // 排除前缀（顶层目录整体排除）
  for (const prefix of EXCLUDE_PREFIXES) {
    if (relPath.startsWith(prefix)) return true;
  }
  // 排除路径片段
  for (const frag of EXCLUDE_PATH_FRAGMENTS) {
    if (relPath.includes(frag)) return true;
  }
  // 排除特定文件
  const basename = path.basename(relPath);
  if (EXCLUDE_FILES.has(basename)) return true;
  // vendor 子规则
  if (relPath.startsWith('vendor/')) {
    const sub = relPath.slice('vendor/'.length);
    const ok = VENDOR_ALLOWED.some(allowed => sub === allowed || sub.startsWith(allowed));
    if (!ok) return true;
  }
  // data 子规则
  if (relPath.startsWith('data/')) {
    const sub = relPath.slice('data/'.length);
    const ok = DATA_ALLOWED.some(allowed => sub === allowed);
    if (!ok) return true;
  }
  return false;
}

function scanDir(dir, base = '') {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn('⚠️  无法读取目录:', dir, e.message);
    return results;
  }
  for (const ent of entries) {
    const fullPath = path.join(dir, ent.name);
    const relPath = base ? `${base}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      results.push(...scanDir(fullPath, relPath));
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      if (isExcluded(relPath)) continue;
      results.push(relPath);
    }
  }
  return results;
}

function buildManifest() {
  const irisFiles = scanDir(IRIS_DIR);
  // 转换为站点相对 URL（./iris/...）
  const urls = irisFiles.map(p => './iris/' + p);

  // 根目录核心 URL（必须预缓存）
  const rootUrls = [
    './',
    './index.html',
    './manifest.json',
  ];

  // 去重 + 排序
  const allUrls = Array.from(new Set([...rootUrls, ...urls])).sort();

  return {
    generatedAt: new Date().toISOString(),
    version: 1,
    count: allUrls.length,
    urls: allUrls,
  };
}

function main() {
  console.log('🔍 开始扫描静态资源...');

  const manifest = buildManifest();

  // 写入文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`✅ 已生成 ${path.relative(ROOT, OUTPUT_FILE)}`);
  console.log(`   共 ${manifest.count} 个资源`);
  console.log(`   根 URL: 3 | iris/: ${manifest.count - 3}`);

  // 输出前 10 个预览
  console.log('   预览（前 10）:');
  manifest.urls.slice(0, 10).forEach(u => console.log('     ' + u));
  if (manifest.urls.length > 10) console.log(`     ... 还有 ${manifest.urls.length - 10} 个`);
}

// 导出供测试使用
module.exports = {
  ALLOWED_EXTS,
  EXCLUDE_PATH_FRAGMENTS,
  EXCLUDE_PREFIXES,
  EXCLUDE_FILES,
  VENDOR_ALLOWED,
  DATA_ALLOWED,
  isExcluded,
  scanDir,
  buildManifest,
  IRIS_DIR,
  OUTPUT_FILE,
};

// 直接运行时自动执行 main
if (require.main === module) {
  main();
}
