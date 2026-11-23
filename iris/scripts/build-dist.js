#!/usr/bin/env node
/**
 * 构建 GitHub Pages 用的静态站点目录 dist/
 *
 * 站点本身没有打包步骤（纯静态、运行时零第三方依赖），这里只做一件事：
 * 把**运行时要用的文件**挑出来放进 dist/，再交给 Pages 上传。
 *
 * 收录范围：
 *   - 仓库根文件（index.html / manifest.json / robots.txt / sw.js / *.md / LICENSE …）
 *   - docs/  整目录
 *   - iris/  整目录，但剔除 node_modules（jsdom 测试依赖）、scripts（构建期工具）
 *     以及功能开关产生的 .disabled/ 备份目录
 *
 * 注意：不能直接 fs.cpSync(仓库根, dist)，Node 会以「不能拷进自己的子目录」拒绝，
 * 所以按「根文件 + 各目录」分组拷贝。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');

// 仓库根文件里不进包的两项：npm 元数据
const ROOT_FILE_SKIP = new Set(['package.json', 'package-lock.json']);
// 开发者向文档，不进产物
const ROOT_FILE_SKIP_EXTRA = ['ARTWORK.md'];
// 要整目录收录的顶层目录
const COPY_DIRS = ['docs', 'iris'];
// iris/ 下不进包的两项
const IRIS_SKIP = new Set(['node_modules', 'scripts']);

function relOf(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

function dirSizeMB(dir) {
  let sum = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else sum += fs.statSync(p).size;
    }
  })(dir);
  return sum / 1024 / 1024;
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 1) 仓库根文件（跳过隐藏文件与 npm 元数据）
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.') &&
      !ROOT_FILE_SKIP.has(e.name) && !ROOT_FILE_SKIP_EXTRA.includes(e.name))
    .map((e) => e.name);
  for (const name of rootFiles) {
    fs.copyFileSync(path.join(ROOT, name), path.join(DIST, name));
  }

  // 2) docs/ 与 iris/（iris 下剔除 node_modules、scripts、.disabled）
  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(DIST, dir), {
      recursive: true,
      filter: (s) => {
        const rel = path.relative(src, s).replace(/\\/g, '/');
        // 功能开关禁用的渲染器/插件备份目录不进产物
        if (rel.split('/').includes('.disabled')) return false;
        if (dir !== 'iris') return true;
        const top = rel.split('/')[0];
        return !IRIS_SKIP.has(top);
      },
    });
  }

  console.log('[dist] 根文件 ' + rootFiles.length + ' 个');
  console.log('[dist] 输出:', relOf(DIST));
  for (const dir of COPY_DIRS) {
    const p = path.join(DIST, dir);
    if (fs.existsSync(p)) console.log('  ' + dir.padEnd(6), dirSizeMB(p).toFixed(1) + ' MB');
  }
  console.log('  总计  ', dirSizeMB(DIST).toFixed(1) + ' MB');
}

main();
