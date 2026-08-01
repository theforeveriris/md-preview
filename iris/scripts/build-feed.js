#!/usr/bin/env node

/**
 * 生成 RSS 2.0 feed.xml
 *
 * 扫描 docs/ 目录下的所有 Markdown 文档，解析 frontmatter（可选），
 * 结合 git 提交时间生成 RSS 条目，输出到 iris/data/feed.xml。
 *
 * 使用：
 *   node iris/scripts/build-feed.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 站点信息（与 index.html / config.json 保持一致）
const SITE_TITLE = 'Markdown Preview';
const SITE_URL = 'https://theforeveriris.github.io/md-preview/';
const SITE_DESCRIPTION = '一个简洁优雅的 Markdown 文档预览站点，支持多种渲染功能';
const SITE_LANG = 'zh-CN';

const DOCS_DIR = path.join(__dirname, '../../docs');
const OUTPUT_FILE = path.join(__dirname, '../data/feed.xml');

// ============== 解析工具 ==============

/**
 * 解析 frontmatter，返回 { frontmatter, content }
 * 仅支持简单的 key: value 形式，与 markdown.js 中 parseFrontmatter 保持一致
 */
function parseFrontmatter(markdown) {
  const fmRegex = /^---\s*\n([\s\S]*?)\n---\s*/;
  const match = markdown.match(fmRegex);
  if (!match) return { frontmatter: {}, content: markdown };

  const fm = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon > 0) {
      const key = trimmed.substring(0, colon).trim();
      let value = trimmed.substring(colon + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      fm[key] = value;
    }
  }
  return { frontmatter: fm, content: markdown.substring(match[0].length) };
}

function extractTitle(content, fallbackName) {
  // 1. frontmatter.title 由调用方优先判断
  // 2. 第一个 # 标题
  const heading = content.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  // 3. 文件名兜底
  return fallbackName.replace(/\.md$/i, '');
}

function extractDescription(content) {
  let text = content;
  // 去掉代码块
  text = text.replace(/```[\s\S]*?```/g, '');
  // 去掉行内代码
  text = text.replace(/`[^`]*`/g, '');
  // 去掉标题行
  text = text.replace(/^#+\s.*$/gm, '');
  // 去掉图片
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // 链接保留文本
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  // 去 markdown 符号
  text = text.replace(/[*_~]/g, '');
  // 压缩空白
  text = text.replace(/\s+/g, ' ').trim();
  return text.substring(0, 200);
}

/**
 * 用 git log 获取文件最后一次提交时间，失败回退到文件 mtime
 */
function getPublishDate(fullPath) {
  try {
    const out = execSync(
      `git log -1 --format=%aI -- "${fullPath}"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    if (out) {
      const d = new Date(out);
      if (!isNaN(d.getTime())) return d;
    }
  } catch (e) {
    // git 不可用或文件未跟踪
  }
  try {
    return fs.statSync(fullPath).mtime;
  } catch (e) {
    return new Date();
  }
}

// RSS pubDate 使用 RFC 822 格式
function toRFC822(date) {
  return date.toUTCString();
}

// ============== XML 转义 ==============
function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============== 文件收集 ==============
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
      // 相对仓库根的路径（含 docs/ 前缀），用于 URL
      const repoRelativePath = 'docs/' + relPath;
      files.push({
        repoRelativePath,
        fullPath,
        fileName: item.name
      });
    }
  }
  return files;
}

// ============== 主流程 ==============
function buildFeed() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.warn(`Docs directory not found: ${DOCS_DIR}`);
    writeFeed([]);
    return;
  }

  const files = collectFiles(DOCS_DIR);
  console.log(`Found ${files.length} markdown files in docs/`);

  const items = files.map(file => {
    let content;
    try {
      content = fs.readFileSync(file.fullPath, 'utf-8');
    } catch (e) {
      console.warn(`Failed to read ${file.fullPath}: ${e.message}`);
      return null;
    }

    const { frontmatter, content: body } = parseFrontmatter(content);
    const title = frontmatter.title || extractTitle(content, file.fileName);
    const description = frontmatter.description || extractDescription(body);
    const pubDate = frontmatter.date ? new Date(frontmatter.date) : getPublishDate(file.fullPath);

    // hash 路由 URL：https://.../md-preview/#/docs/foo.md
    const itemUrl = `${SITE_URL}#/${file.repoRelativePath}`;

    return {
      title,
      link: itemUrl,
      guid: itemUrl,
      description,
      pubDate
    };
  }).filter(Boolean);

  // 按发布时间倒序
  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  writeFeed(items);
}

function writeFeed(items) {
  const now = new Date();
  const lastBuildDate = toRFC822(now);

  const itemsXml = items.map(item => {
    const pubDate = toRFC822(item.pubDate);
    return [
      '    <item>',
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.link)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>`,
      `      <pubDate>${pubDate}</pubDate>`,
      `      <description>${escapeXml(item.description)}</description>`,
      '    </item>'
    ].join('\n');
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>${SITE_LANG}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(SITE_URL)}iris/data/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>
`;

  // 确保输出目录存在
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(OUTPUT_FILE, xml, 'utf-8');
  console.log(`✅ Feed generated: ${OUTPUT_FILE}`);
  console.log(`   ${items.length} items, lastBuildDate: ${lastBuildDate}`);
}

buildFeed();
