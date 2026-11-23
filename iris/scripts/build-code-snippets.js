#!/usr/bin/env node
// build-code-snippets.js —— 源码嵌入（A1）构建期快照
//
// 扫描 docs/**/*.md，提取 `@[code](path#Lx-Ly?lang=xx)` / `@[file](path)`，
// 读取对应仓库文件并按行范围切片，输出 iris/data/code-snippets.json。
//
// 运行时优先读这份快照（离线可用），缺失时回退同源 fetch。
//
// 安全：路径必须限制在仓库根内；拒绝 `..`、绝对路径、协议 URL。
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..');
const DOCS_DIR = path.join(ROOT, 'docs');
const OUT = path.join(ROOT, 'iris', 'data', 'code-snippets.json');

// 与 renderCodeEmbed 的解析保持一致：path#Lx-Ly?lang=xx
// 注意 [^)]+ 允许空格，` lang=js` 参数才能被捕获
const SYNTAX = /@\[(?:code|file)\]\(([^)]+)\)/g;
const ALLOWED = /^[A-Za-z0-9_./-]+(\.\w+)?$/;

function safePath(raw) {
  if (!raw) return null;
  if (raw.includes('..')) return null;
  if (raw.startsWith('/') || raw.startsWith('\\')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;
  if (!ALLOWED.test(raw)) return null;
  return raw.replace(/^\.\//, '').replace(/\/{2,}/g, '/');
}

function parse(url) {
  // 与运行时 parseCodeUrl 一致：path#Lx-Ly、path?lang=js、path#Lx-Ly lang=js 均可
  const params = {};
  let rest = url.replace(/[?&]([A-Za-z][\w-]*)=([^&#\s]*)/g, (_, k, v) => {
    if (k === 'lang') params.lang = decodeURIComponent(v || '');
    return '';
  });
  let range = null;
  const rm = /#L(\d+)(?:-L?(\d+))?/.exec(rest);
  if (rm) {
    range = { start: parseInt(rm[1], 10), end: rm[2] ? parseInt(rm[2], 10) : null };
    rest = rest.slice(0, rm.index);
  }
  return { path: safePath(rest.trim()), range, lang: params.lang || '' };
}

function keyOf(pathname, range) {
  if (!range) return pathname;
  return pathname + '#L' + range.start + (range.end ? '-L' + range.end : '');
}

function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(full, out);
    } else if (/\.md$/i.test(ent.name)) {
      out.push(full);
    }
  }
}

function main() {
  const files = [];
  walk(DOCS_DIR, files);
  const snippets = {};
  const warnings = [];
  let refs = 0;

  // 只统计 ```code / ```file 围栏里的引用（运行时只有那里会渲染），
  // 行内代码与普通围栏（含 ````markdown 源码演示）中的语法示例不算真实引用。
  // 围栏开合按 CommonMark 规则：闭合行的反引号串须与 opening 等长或更长。
  function extractRefs(text) {
    const found = [];
    const lines = text.split(/\r?\n/);
    let fence = null; // null | { lang, marker }
    for (const line of lines) {
      const fm = /^\s*(`{3,}|~{3,})\s*([^`\s]*).*$/.exec(line);
      if (fm) {
        const marker = fm[1];
        if (!fence) {
          fence = { lang: fm[2], marker };
        } else if (marker[0] === fence.marker[0] && marker.length >= fence.marker.length && !fm[2]) {
          fence = null;
        }
        continue;
      }
      if (!fence || (fence.lang !== 'code' && fence.lang !== 'file')) continue;
      let m;
      SYNTAX.lastIndex = 0;
      while ((m = SYNTAX.exec(line))) found.push(m[1]);
    }
    return found;
  }

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const url of extractRefs(text)) {
      const parsed = parse(url);
      if (!parsed.path) { warnings.push(`${path.relative(ROOT, file)}: 路径非法 → ${url}`); continue; }
      refs++;
      const key = keyOf(parsed.path, parsed.range);
      if (snippets[key]) continue;
      const abs = path.join(ROOT, parsed.path);
      if (!abs.startsWith(ROOT + path.sep)) { warnings.push(`${path.relative(ROOT, file)}: 越界 → ${url}`); continue; }
      let content;
      try {
        content = fs.readFileSync(abs, 'utf8');
      } catch (e) {
        warnings.push(`${path.relative(ROOT, file)}: 文件不存在 → ${url}`);
        continue;
      }
      const allLines = content.split(/\r?\n/);
      let slice;
      if (parsed.range) {
        const start = Math.max(1, parsed.range.start);
        const end = Math.min(allLines.length, parsed.range.end || allLines.length);
        slice = allLines.slice(start - 1, end).join('\n');
      } else {
        slice = content;
      }
      snippets[key] = {
        path: parsed.path,
        range: parsed.range,
        lang: parsed.lang || (/\.([a-zA-Z0-9]+)$/.exec(parsed.path) || [, ''])[1].toLowerCase(),
        content: slice,
        hash: hash(slice)
      };
    }
  }

  const out = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'build-code-snippets.js',
    refs,
    count: Object.keys(snippets).length,
    warnings,
    snippets
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`[build-code-snippets] refs=${refs} snippets=${out.count} warnings=${warnings.length}`);
  if (warnings.length) warnings.slice(0, 20).forEach(w => console.log('  ! ' + w));
}

if (require.main === module) main();
module.exports = { parse, keyOf, safePath };
