#!/usr/bin/env node

/**
 * 生成 sitemap.xml
 *
 * 收录两类 URL：
 *   - 站点首页（index.html，含 PWA 入口与文档路由壳）
 *   - docs/ 目录下的全部 Markdown 文档（与 RSS / 搜索索引同源，
 *     hash 路由的 SPA 页面不单独收录——搜索引擎抓不到渲染结果，
 *     收录原始 .md 与 RSS 的取径一致）
 *
 * lastmod 取 git 最后一次提交时间（失败回退文件 mtime），与 build-feed 同口径。
 * 输出到 iris/data/sitemap.xml；robots.txt 指向该文件。
 *
 * 使用：
 *   node iris/scripts/build-sitemap.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const SITE_URL = 'https://theforeveriris.github.io/md-preview/';
const DOCS_DIR = path.join(__dirname, '../../docs');
const OUTPUT_FILE = path.join(__dirname, '../data/sitemap.xml');
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * git 最后一次提交时间（ISO 8601），失败回退文件 mtime
 */
// 批量预取全部 .md 的最后提交时间（lib/git-times.js 单遍 git log 扫全仓，
// 此前对每个文件 execSync 一次 git log，N 篇文档 = N 个子进程）
const { collectMarkdownTimes } = require('./lib/git-times.js');
const commitTimes = collectMarkdownTimes();

function getLastmod(fullPath) {
  const rel = path.relative(REPO_ROOT, fullPath).split(path.sep).join('/');
  const ts = commitTimes.get(rel);
  if (ts !== undefined && ts.modified) {
    return new Date(ts.modified * 1000).toISOString();
  }
  // 非 .md（如 index.html）或 git 不可用：单文件查询 / mtime 兜底
  try {
    const out = execFileSync(
      'git', ['log', '-1', '--format=%cI', '--', fullPath],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    if (out) {
      const d = new Date(out);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  } catch (e) {
    // git 不可用或文件未跟踪
  }
  try {
    return fs.statSync(fullPath).mtime.toISOString();
  } catch (e) {
    return new Date().toISOString();
  }
}

function collectFiles(dir, basePath = '') {
  const files = [];
  let items = [];
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return files;
  }

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    const relPath = basePath ? `${basePath}/${item.name}` : item.name;
    if (item.isDirectory()) {
      files.push(...collectFiles(fullPath, relPath));
    } else if (item.isFile() && item.name.endsWith('.md')) {
      files.push({
        repoRelativePath: 'docs/' + relPath,
        fullPath
      });
    }
  }
  return files;
}

function buildSitemap() {
  const urls = [];

  // 首页
  urls.push({
    loc: SITE_URL,
    lastmod: getLastmod(path.join(__dirname, '../../index.html'))
  });

  // 文档页
  if (fs.existsSync(DOCS_DIR)) {
    const files = collectFiles(DOCS_DIR);
    for (const file of files) {
      const pathUrl = file.repoRelativePath.split('/').map(encodeURIComponent).join('/');
      urls.push({
        loc: SITE_URL + pathUrl,
        lastmod: getLastmod(file.fullPath)
      });
    }
  } else {
    console.warn(`Docs directory not found: ${DOCS_DIR}`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>
`;

  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, xml, 'utf-8');
  console.log(`✅ Sitemap generated: ${OUTPUT_FILE}`);
  console.log(`   ${urls.length} URLs`);
}

buildSitemap();
