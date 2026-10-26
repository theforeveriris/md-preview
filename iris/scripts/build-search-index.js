const fs = require('fs');
const path = require('path');

// 只扫 docs/：与 build-file-tree.js 扫仓库根是有意差异——侧边栏展示仓库全部
// .md（含 README/示例），公开搜索索引只收录 docs/ 站内文档
const docsDir = path.join(__dirname, '../../docs');
const outputFile = path.join(__dirname, '../data/search-index.json');

// ===== 检索增强数据（构建期完成，运行时零新增体积）=====
// 拼音首字母表：iris/scripts/gen-pinyin-table.js 一次性生成后提交
let PINYIN = {};
try {
  PINYIN = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'pinyin-initials.json'), 'utf-8'));
} catch (e) {
  console.warn('未找到拼音首字母表，跳过拼音 token（生成：node iris/scripts/gen-pinyin-table.js）');
}

// 繁简互通：opencc 为 UMD，Node 下可直接 require，零新依赖
let toTW = null;
try {
  toTW = require(path.join(__dirname, '..', 'vendor', 'opencc', 'opencc.min.js'))
    .Converter({ from: 'cn', to: 'tw' });
} catch (e) {
  console.warn('opencc 加载失败，跳过繁体 token:', e.message);
}

function toTraditional(text) {
  if (!toTW || !text) return '';
  try { return toTW(text); } catch (e) { return ''; }
}

// 汉字串 → 拼音首字母串（「微信服务」→ wxfw）；表中没有的字跳过
function pinyinInitials(text) {
  let out = '';
  for (const ch of String(text || '')) {
    const c = PINYIN[ch];
    if (c) out += c;
  }
  return out;
}

// 标题/标签/frontmatter 剥离：统一走 lib/frontmatter.js
const { extractTitle, extractTags, splitFrontmatter } = require('./lib/frontmatter.js');

function extractPreview(content) {
  const { body } = splitFrontmatter(content);
  const text = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ').trim();

  return text.substring(0, 200);
}

// 目录遍历统一走 lib/docs.js（rel 相对仓库根：docs/xxx.md）
const { collectMarkdownFiles } = require('./lib/docs.js');

function collectFiles(dir) {
  return collectMarkdownFiles(dir, { skipRel: ['zw'] }).map(f => ({
    path: f.rel,
    fullPath: f.path
  }));
}

async function buildIndex() {
  const index = [];
  
  if (!fs.existsSync(docsDir)) {
    console.log(`Docs directory not found: ${docsDir}`);
    fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
    return;
  }
  
  const files = collectFiles(docsDir);
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.fullPath, 'utf-8');
      const title = extractTitle(content) || file.path.replace('.md', '');
      const preview = extractPreview(content);
      
      const tags = extractTags(content);

      // 检索文本（一次成型，运行时直接整串建索引）：
      //   原文标题 / 标签 / 摘要 / 路径
      //   + 标题与标签的繁体形态（繁简互通：查「網絡」命中「网络」）
      //   + 标题与标签的拼音首字母（查 wx 命中「微信」）
      const head = [title].concat(tags).join(' ');
      // 拼音首字母按字段拆成独立 token：forward 分词只索引 token 前缀，
      // 合并成一长串会让「标签首字母」（如 nrzq）搜不到
      const initialTokens = [title].concat(tags).map(pinyinInitials).filter(Boolean);
      const searchText = [
        title,
        tags.join(' '),
        preview,
        file.path,
        toTraditional(head),
      ].concat(initialTokens).filter(Boolean).join(' ');

      const entry = {
        path: file.path,
        title: title,
        preview: preview,
        searchText: searchText
      };
      if (tags.length > 0) entry.tags = tags;
      index.push(entry);
      
      console.log(`Indexed: ${file.path}`);
    } catch (e) {
      console.warn(`Failed to index: ${file.path}`, e.message);
    }
  }
  
  fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
  console.log(`\nIndexed ${index.length} files. Output written to: ${outputFile}`);
}

buildIndex();
