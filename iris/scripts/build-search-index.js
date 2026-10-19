const fs = require('fs');
const path = require('path');

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

function extractTitle(content) {
  const frontmatterMatch = content.match(/^---[\s\S]*?title:\s*['"]?(.+?)['"]?\s*(?:\n|---)/i);
  if (frontmatterMatch) return frontmatterMatch[1].trim();
  
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  
  return null;
}

function extractPreview(content) {
  let text = content;
  
  text = text.replace(/^---[\s\S]*?---\s*/, '');
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/^#+\s*/gm, '');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');
  text = text.replace(/[*_~`]/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  
  return text.substring(0, 200);
}

function extractTags(content) {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return [];
  const tagsLine = frontmatterMatch[1].split('\n').find(l => l.trim().startsWith('tags:'));
  if (!tagsLine) return [];
  const raw = tagsLine.trim().replace(/^tags:\s*/, '').trim();

  let list = [];
  if (raw.startsWith('[')) {
    list = raw.replace(/^\[/, '').replace(/\]$/, '').split(',');
  } else {
    list = raw.split(/[,，]/);
  }
  return list.map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean).slice(0, 20);
}

function collectFiles(dir, basePath = '') {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stats = fs.statSync(fullPath);
    
    if (stats.isDirectory()) {
      files.push(...collectFiles(fullPath, basePath ? `${basePath}/${item}` : item));
    } else if (item.endsWith('.md')) {
      // 存储相对于仓库根目录的完整路径（含 docs/ 前缀），
      // 供前端直接使用，避免硬编码拼接前缀
      files.push({
        path: 'docs/' + (basePath ? `${basePath}/${item}` : item),
        fullPath: fullPath
      });
    }
  }
  
  return files;
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
