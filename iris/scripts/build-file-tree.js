#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'file-tree.json');

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

// 提取文档标题：frontmatter.title 优先，其次正文第一个 `#` 标题，都没有则返回空串（显示时回退文件名）
function extractTitle(content) {
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---\s*/);
  let meta = '';
  let body = content;
  if (fm) {
    meta = fm[1];
    body = content.slice(fm[0].length);
  }

  let title = '';
  const titleLine = meta.split('\n').find(l => l.trim().startsWith('title:'));
  if (titleLine) {
    title = titleLine.trim().replace(/^title:\s*/, '').trim().replace(/^["']|["']$/g, '');
  }
  if (!title) {
    const h1 = body.match(/^#\s+(.+?)\s*$/m);
    if (h1) title = h1[1].trim();
  }
  return title;
}

function buildTreeFromDirectory(dir, basePath = '') {
  const result = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  const folders = [];
  const files = [];

  // 排除依赖 / 版本库 / 构建产物目录（与 readme-dev 的声明一致；
  // 本地开发装了 iris/node_modules 时会把依赖文档混进站点目录树）
  const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'vendor', '.github']);

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
  
  folders.sort((a, b) => a.name.localeCompare(b.name));
  folders.forEach(folder => {
    const { children, wordCount } = buildTreeFromDirectory(folder.fullPath, folder.path);
    if (children.length > 0) {
      result.push({
        name: folder.name,
        type: 'folder',
        children,
        wordCount
      });
      totalWords += wordCount;
    }
  });
  
  files.sort((a, b) => a.name.localeCompare(b.name));
  files.forEach(file => {
    const content = fs.readFileSync(file.fullPath, 'utf-8');
    const wordCount = countWords(content);
    const title = extractTitle(content);
    const entry = {
      name: file.name,
      type: 'file',
      path: file.path,
      wordCount
    };
    if (title) entry.title = title;
    result.push(entry);
    totalWords += wordCount;
  });
  
  return { children: result, wordCount: totalWords };
}

try {
  const rootDir = path.join(__dirname, '../..');
  const { children: fileTreeData } = buildTreeFromDirectory(rootDir);
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fileTreeData, null, 2));
  
  console.log(`✅ 文件树构建成功！`);
  console.log(`📍 输出文件: ${OUTPUT_FILE}`);
  console.log(`📁 共找到 ${countFiles(fileTreeData)} 个 Markdown 文件`);
  
} catch (error) {
  console.error('❌ 构建文件树时出错:', error);
  process.exit(1);
}

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
