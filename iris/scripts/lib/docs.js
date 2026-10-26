/**
 * Markdown 文档目录遍历共享库（构建脚本侧）
 *
 * 此前 gen-pinyin-table / build-search-index / build-file-tree / build-links /
 * build-feed / link-check 共 6 处各自手写目录遍历 + 排除清单，口径互相漂移
 * （link-check 未排除 vendor/ 等）。统一提供：
 *
 *   collectMarkdownFiles(rootDir, opts) -> [{ path, name, rel }]
 *
 * opts.skip：目录名 Set（默认跳过 .git / node_modules / vendor / dist /
 * src-tauri / .github）；遍历顺序为 readdir 序（与各脚本原实现一致，输出
 * 顺序敏感的调用方自行 sort）。脚本的特有排除规则仍可在 opts.skip 扩展。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_SKIP = new Set([
  '.git', 'node_modules', 'vendor', 'dist', 'src-tauri', '.github'
]);

function collectMarkdownFiles(rootDir, opts) {
  const o = opts || {};
  const skip = o.skip || DEFAULT_SKIP;
  // 相对路径前缀排除（如 ['zw']）：docs/zw/ 是中文排版 lint 的故意写错样例，
  // 不进公开站点的目录树 / 搜索索引 / RSS（见 readme-dev.md「测试夹具目录」）
  const skipRel = o.skipRel || null;
  const base = o.relBase || rootDir;
  const out = [];

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch (e) {
    return out; // 目录不存在 / 无权限：返回空
  }

  for (const entry of entries) {
    if (skip.has(entry.name)) continue;
    const full = path.join(rootDir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (skipRel && skipRel.some(prefix => rel === prefix || rel.startsWith(prefix + '/'))) continue;
    if (entry.isDirectory()) {
      out.push(...collectMarkdownFiles(full, { skip, relBase: base }));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      out.push({ path: full, name: entry.name, rel });
    }
  }
  return out;
}

module.exports = { collectMarkdownFiles, DEFAULT_SKIP };
