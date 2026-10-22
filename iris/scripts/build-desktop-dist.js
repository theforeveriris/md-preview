#!/usr/bin/env node
/**
 * 构建桌面端（Tauri）用的静态站点目录 dist/
 *
 * 站点本身没有打包步骤（纯静态、运行时零第三方依赖），所以这里只做一件事：
 * 把**运行时要用的文件**挑出来放进 dist/，交给 Tauri 的 frontendDist。
 *
 * 收录范围：
 *   - 仓库根文件（index.html / manifest.json / robots.txt / sw.js / *.md / LICENSE …）
 *   - docs/  整目录
 *   - iris/  整目录，但剔除 node_modules（jsdom 测试依赖）与 scripts（构建期工具）
 *
 * 注意：不能直接 fs.cpSync(仓库根, dist)，Node 会以「不能拷进自己的子目录」拒绝，
 * 所以按「根文件 + 各目录」分组拷贝。
 *
 * 桌面端专属的两处加工：
 *   1. 注入 iris/desktop-bridge.js —— 外链交给系统浏览器，否则 WebView 会把应用导航走
 *   2. 报告各顶层目录体积，防止哪天误把大文件塞进安装包
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const BRIDGE_SRC = path.join(ROOT, 'src-tauri', 'bridge', 'desktop-bridge.js');
const BRIDGE_REL = 'iris/desktop-bridge.js';

// 仓库根文件里不进包的两项：桌面端自身的 npm 元数据
const ROOT_FILE_SKIP = new Set(['package.json', 'package-lock.json']);
// 开发者向文档，不进安装包
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
  if (!fs.existsSync(BRIDGE_SRC)) {
    console.error('[desktop-dist] 找不到桥接脚本:', relOf(BRIDGE_SRC));
    process.exit(1);
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 1) 仓库根文件（跳过隐藏文件与桌面端 npm 元数据）
  const rootFiles = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith('.') &&
      !ROOT_FILE_SKIP.has(e.name) && !ROOT_FILE_SKIP_EXTRA.includes(e.name))
    .map((e) => e.name);
  for (const name of rootFiles) {
    fs.copyFileSync(path.join(ROOT, name), path.join(DIST, name));
  }

  // 2) docs/ 与 iris/（iris 下剔除 node_modules、scripts）
  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(DIST, dir), {
      recursive: true,
      filter: (s) => {
        if (dir !== 'iris') return true;
        const top = path.relative(src, s).replace(/\\/g, '/').split('/')[0];
        return !IRIS_SKIP.has(top);
      },
    });
  }

  // 3) 桌面端桥接脚本 + 注入
  fs.mkdirSync(path.join(DIST, 'iris'), { recursive: true });
  fs.copyFileSync(BRIDGE_SRC, path.join(DIST, BRIDGE_REL));

  const idxPath = path.join(DIST, 'index.html');
  const tag = '<script defer src="iris/desktop-bridge.js"></script>';
  let html = fs.readFileSync(idxPath, 'utf8');
  if (!html.includes(tag)) {
    html = html.replace(/<\/body>/i, '  ' + tag + '\n</body>');
    fs.writeFileSync(idxPath, html, 'utf8');
    console.log('[desktop-dist] 已注入 desktop-bridge.js');
  }

  console.log('[desktop-dist] 根文件 ' + rootFiles.length + ' 个');
  console.log('[desktop-dist] 输出:', relOf(DIST));
  for (const dir of COPY_DIRS) {
    const p = path.join(DIST, dir);
    if (fs.existsSync(p)) console.log('  ' + dir.padEnd(6), dirSizeMB(p).toFixed(1) + ' MB');
  }
  console.log('  总计  ', dirSizeMB(DIST).toFixed(1) + ' MB');
}

main();
