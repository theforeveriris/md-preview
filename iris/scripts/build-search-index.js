const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../../docs');
const outputFile = path.join(__dirname, '../data/search-index.json');

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
      
      index.push({
        path: file.path,
        title: title,
        preview: preview
      });
      
      console.log(`Indexed: ${file.path}`);
    } catch (e) {
      console.warn(`Failed to index: ${file.path}`, e.message);
    }
  }
  
  fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
  console.log(`\nIndexed ${index.length} files. Output written to: ${outputFile}`);
}

buildIndex();
