#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 文件名自然排序（与运行时 iris/js/name-sort.js 同一实现）：
// 数字段按数值比较，1.0 < 2.0 < 9.0 < 10.0
const { compareNames } = require('../js/name-sort.js');
// 文档的首次添加 / 最后修改时间（git 提交时间），供侧边栏按时间排序
const { collectMarkdownTimesWithCreated } = require('./lib/git-times.js');

const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'file-tree.json');

/** 文档的首次添加 / 最后修改时间：path -> { created, modified }（Unix 秒） */
let gitTimes = new Map();

console.log('🔍 开始扫描 Markdown 文件...');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function countWords(content) {
  const text = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s.*$/gm, '')
    .replace(/^[-*+]\s.*$/gm, '')
    .replace(/^>\s.*$/gm, '')
    .replace(/[#*_~`]/g, '')
    .replace(/\s+/g, ' ');
  
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = text.replace(/[\u4e00-\u9fa5]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && /[a-zA-Z]/.test(w))
    .length;
  
  return chineseChars + englishWords;
}

// 提取标题/标签：统一走 lib/frontmatter.js（此前与本仓其他构建脚本各自
// 手写正则且口径漂移，现收敛到共享库）
const { extractTitle, extractTags } = require('./lib/frontmatter.js');

/**
 * 汇总一组条目的时间：最早创建 / 最晚修改。
 * 文件夹本身没有 git 提交记录，故用其下文件的极值代表。
 */
function aggregateTimes(entries) {
  let created = 0;
  let modified = 0;
  for (const e of entries) {
    const c = Number(e.created) || 0;
    const m = Number(e.modified) || 0;
    if (c && (created === 0 || c < created)) created = c;
    if (m > modified) modified = m;
  }
  return { created, modified };
}

function buildTreeFromDirectory(dir, basePath = '') {
  const result = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  const folders = [];
  const files = [];

  // 排除依赖 / 版本库 / 构建产物目录（与 readme-dev 的声明一致；
  // 本地开发装了 iris/node_modules 时会把依赖文档混进站点目录树）
  // 'zw' = docs/zw/ 中文排版 lint 故意写错样例，不进公开目录树
  const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'vendor', '.github', 'dist', 'src-tauri', 'zw']);

  items.forEach(item => {
    if (item.isDirectory() && EXCLUDED_DIRS.has(item.name)) return;
    const itemPath = basePath ? `${basePath}/${item.name}` : item.name;
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      folders.push({ name: item.name, path: itemPath, fullPath });
    } else if (item.isFile() && item.name.endsWith('.md')) {
      files.push({ name: item.name, path: itemPath, fullPath });
    }
  });

  let totalWords = 0;

  folders.sort((a, b) => compareNames(a.name, b.name));
  folders.forEach(folder => {
    const { children, wordCount } = buildTreeFromDirectory(folder.fullPath, folder.path);
    if (children.length > 0) {
      // 文件夹的时间 = 其下所有条目（含子文件夹）的最早创建 / 最晚修改
      const agg = aggregateTimes(children);
      result.push({
        name: folder.name,
        type: 'folder',
        children,
        wordCount,
        created: agg.created,
        modified: agg.modified
      });
      totalWords += wordCount;
    }
  });

  files.sort((a, b) => compareNames(a.name, b.name));
  files.forEach(file => {
    const content = fs.readFileSync(file.fullPath, 'utf-8');
    const wordCount = countWords(content);
    const title = extractTitle(content);
    const tags = extractTags(content);
    const t = gitTimes.get(file.path) || { created: 0, modified: 0 };
    const entry = {
      name: file.name,
      type: 'file',
      path: file.path,
      wordCount,
      // 首次添加 / 最后修改的提交时间（Unix 秒），供侧边栏按时间排序
      created: t.created,
      modified: t.modified
    };
    if (title) entry.title = title;
    if (tags.length > 0) entry.tags = tags;
    result.push(entry);
    totalWords += wordCount;
  });

  return { children: result, wordCount: totalWords };
}

try {
  const rootDir = path.join(__dirname, '../..');
  // 采集文档的首次添加 / 最后修改时间（非 git 环境下为空表，排序回退名称序）
  gitTimes = collectMarkdownTimesWithCreated(rootDir);
function countFiles(tree) {
  let count = 0;
  tree.forEach(item => {
    if (item.type === 'file') {
      count++;
    } else if (item.type === 'folder' && item.children) {
      count += countFiles(item.children);
    }
  });
  return count;
}

  const { children: fileTreeData } = buildTreeFromDirectory(rootDir);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fileTreeData, null, 2));

  console.log(`✅ 文件树构建成功！`);
  console.log(`📍 输出文件: ${OUTPUT_FILE}`);
  console.log(`📁 共找到 ${countFiles(fileTreeData)} 个 Markdown 文件`);
  console.log(`🕒 采集到 ${gitTimes.size} 个文档的提交时间`);

} catch (error) {
  console.error('❌ 构建文件树时出错:', error);
  process.exit(1);
}

