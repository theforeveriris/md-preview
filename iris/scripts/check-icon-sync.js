#!/usr/bin/env node

/**
 * 图标源文件一致性门禁
 *
 * icon.svg 的 6 条鸢尾 path 是 hero.svg 的逐字子集（hero 多出标题与能力
 * 标签的 5 条 path）。历史上两处独立维护、靠人肉同步；SVG 以 <img> 方式
 * 加载（favicon / README 横幅）时外部 <use> 引用不生效，无法用单文件共享，
 * 故以此门禁锁死：hero.svg 修改图形后必须同步 icon.svg（或反之），否则
 * 冒烟测试失败。
 *
 * 独立运行：node iris/scripts/check-icon-sync.js
 */
const fs = require('fs');
const path = require('path');

function main() {
  const iconSrc = fs.readFileSync(path.join(__dirname, '..', 'icons', 'icon.svg'), 'utf-8');
  const heroSrc = fs.readFileSync(path.join(__dirname, '..', 'icons', 'hero.svg'), 'utf-8');
  const pathsOf = (s) => new Set([...s.matchAll(/d="([^"]+)"/g)].map(m => m[1]));

  const iconPaths = pathsOf(iconSrc);
  const heroPaths = pathsOf(heroSrc);

  const missing = [...iconPaths].filter(d => !heroPaths.has(d));
  if (missing.length > 0) {
    console.error(`[check-icon-sync] icon.svg 有 ${missing.length} 条 path 未同步到 hero.svg，鸢尾图形副本已漂移`);
    console.error('  首个差异:', missing[0].slice(0, 80));
    process.exit(1);
  }

  // 品牌色一致性：两文件不得再出现旧粉紫强调色
  for (const [name, src] of [['icon.svg', iconSrc], ['hero.svg', heroSrc]]) {
    if (/#[dD]4[aA]5[cC]9/.test(src)) {
      console.error(`[check-icon-sync] ${name} 仍含旧强调色 #d4a5c9（应统一为 #8B5CF6）`);
      process.exit(1);
    }
  }

  console.log(`[check-icon-sync] OK: icon.svg ${iconPaths.size} 条 path 均与 hero.svg 一致，品牌色一致`);
}

main();
