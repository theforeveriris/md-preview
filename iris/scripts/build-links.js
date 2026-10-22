#!/usr/bin/env node
/**
 * 构建文档链接产物：iris/data/links.json
 *
 * 供两个功能共用（同一份数据，避免两套口径）：
 *   - #/graph 文档图谱（节点 = 文档，边 = 站内链接）
 *   - 文末「被 N 篇引用」反向链接与「相关文档」
 *
 * 口径：
 *   - 节点集合与 file-tree.json 完全一致（仓库根下全部 .md，排除 .git / node_modules /
 *     vendor / .github），保证图谱节点与侧边栏文件树能一一对应；
 *   - 仅保留「指向本文档集合内文档」的链接边：排除图片、@[pkt/ensp/pptx] 嵌入、
 *     外链、同文档锚点、自链接；同一目标多次链接合并为权重。
 *
 * 解析原语复用 iris/scripts/lib/md-links.js（与死链检查同一套实现）。
 *
 * 用法：node iris/scripts/build-links.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  MD_FILE_RE, extractRefs, resolveInternal, externalUrlOf, splitTargetUrl,
} = require('./lib/md-links');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'links.json');

// 与 build-file-tree.js 的 EXCLUDED_DIRS 保持一致（节点集合必须对齐）
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'vendor', '.github', 'dist', 'src-tauri']);

function collectDocs(dir, base = '', out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (EXCLUDED_DIRS.has(item.name)) continue;
      collectDocs(path.join(dir, item.name), base ? `${base}/${item.name}` : item.name, out);
    } else if (item.isFile() && MD_FILE_RE.test(item.name)) {
      out.push(base ? `${base}/${item.name}` : item.name);
    }
  }
  return out;
}

function main() {
  const docs = collectDocs(ROOT).sort();
  const nodeSet = new Set(docs);
  const isDoc = (rel) => nodeSet.has(rel);

  const links = {};
  let edgeCount = 0;

  for (const doc of docs) {
    let content;
    try {
      content = fs.readFileSync(path.join(ROOT, doc), 'utf-8');
    } catch {
      continue;
    }

    const targets = {};
    for (const ref of extractRefs(content)) {
      if (ref.kind === '图片' || ref.kind === 'HTML 图片' || ref.kind === '嵌入') continue;
      let raw = String(ref.target == null ? '' : ref.target).trim();
      if (!raw) continue;
      // 站点 hash 路由写法 #/docs/a.md 归一为站点根相对路径；其余 #... 为同文档锚点
      if (raw.startsWith('#/')) raw = raw.slice(1);
      else if (raw.startsWith('#')) continue;
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;   // mailto: / tel: 等协议链接
      if (externalUrlOf(raw)) continue;                  // 外链

      const { target } = splitTargetUrl(raw);
      if (!target || !MD_FILE_RE.test(target)) continue; // 只留指向文档的链接

      const resolved = resolveInternal(doc, raw, isDoc);
      if (!resolved.exists || resolved.file === doc) continue;

      targets[resolved.file] = (targets[resolved.file] || 0) + 1;
    }

    const keys = Object.keys(targets);
    if (keys.length) links[doc] = targets;
    edgeCount += keys.length;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: { nodes: docs.length, edges: edgeCount },
    nodes: docs,
    links,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log(`✅ links.json 构建成功：${docs.length} 个文档节点，${edgeCount} 条链接关系`);
  console.log(`   输出：${path.relative(ROOT, OUTPUT_FILE)}`);
}

main();
