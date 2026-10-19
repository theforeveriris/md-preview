#!/usr/bin/env node
/**
 * 生成拼音首字母表（构建期数据，生成一次后提交入库）
 *
 * 产物：iris/scripts/data/pinyin-initials.json —— { "微": "w", "信": "x", … }
 * 用途：build-search-index.js 用它为文档**标题与标签**生成拼音首字母检索 token，
 *      于是输入 wx 就能命中「微信」。（运行时零开销：浏览器不加载任何拼音库）
 *
 * 字表来源（并集，兼顾当前覆盖与后续新增文档）：
 *   1) 仓库内全部 .md 出现过的汉字 —— 保证现有内容 100% 覆盖
 *   2) iris/vendor/opencc/opencc.min.js 内置简繁字典中的汉字 —— 覆盖常用字
 *
 * 依赖：pinyin-pro（仅本脚本需要，不进 CI；CI 只读取已提交的产物表）
 *   cd iris && npm install --no-save pinyin-pro
 *   node iris/scripts/gen-pinyin-table.js
 *
 * 多音字取 pinyin-pro 的常用读音，首字母可能有歧义（如「重」→ z），可接受。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_FILE = path.join(__dirname, 'data', 'pinyin-initials.json');
const OPENCC_FILE = path.join(ROOT, 'iris', 'vendor', 'opencc', 'opencc.min.js');
const CJK_RE = /[\u4e00-\u9fff]/g;
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'vendor', '.github', 'dist', 'src-tauri']);

let pinyin;
try {
  ({ pinyin } = require('pinyin-pro'));
} catch (e) {
  console.error('缺少依赖 pinyin-pro，先运行：cd iris && npm install --no-save pinyin-pro');
  process.exit(1);
}

function collectDocChars(dir, out) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (EXCLUDED_DIRS.has(item.name)) continue;
      collectDocChars(path.join(dir, item.name), out);
    } else if (item.isFile() && item.name.endsWith('.md')) {
      const text = fs.readFileSync(path.join(dir, item.name), 'utf-8');
      (text.match(CJK_RE) || []).forEach(c => out.add(c));
    }
  }
  return out;
}

function main() {
  const chars = new Set();
  collectDocChars(ROOT, chars);
  const docCount = chars.size;

  try {
    const dict = fs.readFileSync(OPENCC_FILE, 'utf-8');
    (dict.match(CJK_RE) || []).forEach(c => chars.add(c));
  } catch (e) {
    console.warn('读取 opencc 字典失败（仅使用文档字表）:', e.message);
  }

  const table = {};
  let skipped = 0;
  for (const ch of chars) {
    let first = '';
    try {
      const arr = pinyin(ch, { pattern: 'first', toneType: 'none', type: 'array' });
      first = (arr && arr[0] ? String(arr[0]) : '').toLowerCase();
    } catch (e) {
      first = '';
    }
    if (first) table[ch] = first;
    else skipped++;
  }

  // minified 单行输出：紧凑的 build 期产物（约 114KB），不进浏览器
  const keys = Object.keys(table).sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
  const ordered = {};
  keys.forEach(k => { ordered[k] = table[k]; });
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(ordered) + '\n', 'utf-8');

  const bytes = fs.statSync(OUT_FILE).size;
  console.log(`✅ 拼音首字母表已生成：${keys.length} 个汉字（跳过 ${skipped} 个无拼音字符）`);
  console.log(`   文档字表 ${docCount} 字 + opencc 字典补齐`);
  console.log(`   输出：${path.relative(ROOT, OUT_FILE)}（${(bytes / 1024).toFixed(0)} KB）`);
  console.log('   样例：' + keys.slice(0, 8).map(k => `${k}→${table[k]}`).join(' '));
}

main();
