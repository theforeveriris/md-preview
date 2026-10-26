/**
 * frontmatter 解析共享库（构建脚本侧，仿 lib/md-links.js 抽库先例）
 *
 * 此前 build-file-tree / build-search-index / build-feed 各自手写正则且
 * 口径已漂移（最典型：search-index 的标题正则在块内无 title: 时会匹配到
 * 正文/代码块里的 title:，与 file-tree 不一致）。统一收敛到本库：
 *
 *   splitFrontmatter(content) -> { meta, body }   块剥离（含 \r\n 容错）
 *   parseFrontmatter(content) -> { frontmatter, content }   key:value 行级解析
 *   extractTitle(content)     -> string   frontmatter.title 优先，正文首个 # 兜底
 *   extractTags(content)      -> string[] tags 行（内联数组 / 逗号分隔），≤20 个
 *
 * 口径约定（与运行时 markdown.js#parseFrontmatter 语义一致）：
 *   - frontmatter 只取首块 `---\n...\n---`，值只支持标量（文档站点约定）；
 *   - 标题：title 字段 > 正文第一个 `# ` 标题 > ''（调用方再做文件名兜底）；
 *   - 标签：去引号、去空、中英文逗号均可分隔，上限 20。
 */
'use strict';

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*/;

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.substring(1, value.length - 1);
  }
  return value;
}

function splitFrontmatter(content) {
  const fm = String(content || '').match(FRONTMATTER_RE);
  if (!fm) return { meta: '', body: String(content || '') };
  return { meta: fm[1], body: content.slice(fm[0].length) };
}

function parseFrontmatter(content) {
  const { meta, body } = splitFrontmatter(content);
  const fm = {};
  for (const line of meta.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon > 0) {
      const key = trimmed.substring(0, colon).trim();
      fm[key] = stripQuotes(trimmed.substring(colon + 1).trim());
    }
  }
  return { frontmatter: fm, content: body };
}

function extractTitle(content) {
  const { frontmatter, content: body } = parseFrontmatter(content);
  if (frontmatter.title) return frontmatter.title;
  const h1 = body.match(/^#\s+(.+?)\s*$/m);
  return h1 ? h1[1].trim() : '';
}

function extractTags(content) {
  const { frontmatter } = parseFrontmatter(content);
  const raw = frontmatter.tags;
  if (!raw) return [];
  let list;
  if (raw.startsWith('[')) {
    list = raw.replace(/^\[/, '').replace(/\]$/, '').split(',');
  } else {
    list = raw.split(/[,，]/);
  }
  return list
    .map(s => stripQuotes(s.trim()))
    .filter(Boolean)
    .slice(0, 20);
}

module.exports = {
  FRONTMATTER_RE,
  splitFrontmatter,
  parseFrontmatter,
  extractTitle,
  extractTags
};
