#!/usr/bin/env node

/**
 * 中文排版 lint（BUILD-1）
 *
 * 检查 docs/ 下 Markdown 的中文排版规范：
 *   1. CJK 与拉丁字母 / 数字之间缺少空格
 *   2. CJK 紧邻半角标点（建议全角）
 *   3. 行首禁则（行首出现收尾类标点）
 *   4. 中文内容使用直引号 " "（建议 “ ”）
 *
 * 默认只报告；`--fix` 自动修复（含代码 / 行内代码 / 链接 / URL / HTML 的行只报告不修复，
 * 避免破坏代码）。跳过围栏代码块、frontmatter、HTML 注释。
 *
 * 使用：
 *   node iris/scripts/lint-cjk.js [--fix] [--quiet] [路径]
 *
 * 退出码：发现未修复问题时返回 1（便于 CI 卡门禁；当前 CI 以告警方式运行）。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const QUIET = args.includes('--quiet');
const explicit = args.filter(a => !a.startsWith('--'));

const CJK = '\\u4e00-\\u9fff\\u3400-\\u4dbf';
const FULLWIDTH_MAP = { ',': '，', '.': '。', '!': '！', '?': '？', ';': '；', ':': '：' };
const LINE_START_FORBIDDEN = '，。！？、）：；」』”’》〉·…';

function listFiles() {
  if (explicit.length) {
    return explicit.map(p => path.resolve(ROOT, p));
  }
  try {
    const out = execFileSync('git', ['ls-files', 'docs/**/*.md', 'docs/*.md'], { cwd: ROOT, encoding: 'utf-8' });
    const files = out.split('\n').map(s => s.trim()).filter(Boolean).map(p => path.join(ROOT, p));
    if (files.length) return files;
  } catch (e) { /* 回退目录扫描 */ }
  const out = [];
  (function walk(dir) {
    let items = [];
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) walk(full);
      else if (it.name.endsWith('.md')) out.push(full);
    }
  })(path.join(ROOT, 'docs'));
  return out;
}

// 去掉文档中不应参与检查的片段
function stripUnsafe(line) {
  return line
    .replace(/`[^`]*`/g, m => ' '.repeat(m.length))
    .replace(/\]\([^)]*\)/g, m => ' '.repeat(m.length))
    .replace(/https?:\/\/\S+/g, m => ' '.repeat(m.length))
    .replace(/<!--[\s\S]*?-->/g, m => ' '.repeat(m.length))
    .replace(/<[^>]+>/g, m => ' '.repeat(m.length));
}

function hasProtectedSyntax(line) {
  return /`/.test(line) || /\]\(/.test(line) || /https?:\/\//.test(line) || /<[^>]+>/.test(line);
}

function lintLine(line, lineNo, file, issues) {
  const clean = stripUnsafe(line);

  // 1) CJK ↔ 拉丁 / 数字 缺空格
  const spacingRe = new RegExp(`([${CJK}])([A-Za-z0-9])|([A-Za-z0-9])([${CJK}])`, 'g');
  let m;
  while ((m = spacingRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'spacing', msg: '中英文/数字之间建议加空格' });
  }

  // 2) CJK 紧邻半角标点
  const halfRe = new RegExp(`[${CJK}]([,.;:!?])(?=\\s|$|[${CJK}])`, 'g');
  while ((m = halfRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'punct', msg: `中文后建议使用全角标点「${FULLWIDTH_MAP[m[1]] || m[1]}」` });
  }

  // 3) 行首禁则
  const lead = clean.replace(/^\s*(?:>|[-*+]|\d+\.)\s*/, '');
  if (lead && LINE_START_FORBIDDEN.indexOf(lead[0]) !== -1) {
    issues.push({ file, line: lineNo, col: 1, rule: 'line-start', msg: `行首不应出现「${lead[0]}」` });
  }

  // 4) 中文旁直引号
  const quoteRe = new RegExp(`[${CJK}]"|"[${CJK}]`, 'g');
  while ((m = quoteRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'quote', msg: '中文内容建议使用弯引号 “ ”' });
  }
}

function fixLine(line) {
  if (hasProtectedSyntax(line)) return line; // 含代码/链接/URL/HTML：不自动修复
  let out = line;
  // 插空格（双向）
  out = out.replace(new RegExp(`([${CJK}])([A-Za-z0-9])`, 'g'), '$1 $2');
  out = out.replace(new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g'), '$1 $2');
  // 半角标点 → 全角（仅 CJK 之后）
  out = out.replace(new RegExp(`([${CJK}])([,.;:!?])(?=\\s|$|[${CJK}])`, 'g'),
    (mm, c, p) => c + (FULLWIDTH_MAP[p] || p));
  return out;
}

function lintFile(file) {
  let content;
  try { content = fs.readFileSync(file, 'utf-8'); } catch (e) { return { issues: [], fixed: false }; }
  const lines = content.split('\n');
  const issues = [];
  let fence = null;
  let inFrontmatter = false;
  let frontmatterDone = false;
  let changed = false;
  const outLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!frontmatterDone && i === 0 && line.trim() === '---') { inFrontmatter = true; outLines.push(line); continue; }
    if (inFrontmatter) {
      if (line.trim() === '---') { inFrontmatter = false; frontmatterDone = true; }
      outLines.push(line);
      continue;
    }

    const fm = line.match(/^\s*(`{3,}|~{3,})/);
    if (fm) {
      if (!fence) fence = fm[1][0];
      else if (fm[1][0] === fence) fence = null;
      outLines.push(line);
      continue;
    }
    if (fence) { outLines.push(line); continue; }

    lintLine(line, i + 1, path.relative(ROOT, file), issues);

    if (FIX) {
      const fixed = fixLine(line);
      if (fixed !== line) { changed = true; line = fixed; }
    }
    outLines.push(line);
  }

  if (FIX && changed) fs.writeFileSync(file, outLines.join('\n'), 'utf-8');
  return { issues, fixed: changed };
}

function main() {
  const files = listFiles();
  let total = 0;
  let filesWithIssues = 0;
  for (const file of files) {
    const { issues, fixed } = lintFile(file);
    if (issues.length) {
      filesWithIssues++;
      total += issues.length;
      if (!QUIET) {
        issues.slice(0, 50).forEach(is => {
          console.log(`${is.file}:${is.line}:${is.col}  [${is.rule}] ${is.msg}`);
        });
        if (issues.length > 50) console.log(`  … 其余 ${issues.length - 50} 条省略`);
      }
    }
    if (FIX && fixed && !QUIET) console.log(`✏️ 已修复：${path.relative(ROOT, file)}`);
  }
  console.log(`\n中文排版 lint：${files.length} 个文件，${total} 处问题（${filesWithIssues} 个文件）${FIX ? '（--fix 已应用，可再次运行复核）' : ''}`);
  process.exit(total > 0 && !FIX ? 1 : 0);
}

main();
