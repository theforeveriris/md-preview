#!/usr/bin/env node

/**
 * 中文文案排版 lint
 *
 * 参考《中文文案排版指北》对仓库内 Markdown 做中文排版校验。
 *
 * 可自动修复的规则（error 级）：
 *   1. spacing        CJK 与拉丁字母 / 数字之间缺少空格
 *   2. unit           数字与单位之间缺少空格（10 Gbps、20 TB；% / ° 例外）
 *   3. punct          CJK 紧邻半角标点（应使用全角标点）
 *   4. punct-space    全角标点与其他字符之间多加了空格
 *   5. dup-punct      重复使用标点符号
 *   6. fullwidth-digit 数字使用了全角字符
 *   7. line-start     行首禁则（行首出现收尾类标点）
 *
 * 仅提示、不可自动修复的规则（warn 级）：
 *   8. quote          中文内容使用直引号（建议「」或“”）
 *
 * 默认只报告；`--fix` 自动修复 error 级问题。
 * 含代码 / 行内代码 / 链接 / URL / HTML 的片段只报告不修复，避免破坏代码。
 * 跳过围栏代码块、frontmatter、HTML 注释。
 *
 * 使用：
 *   node iris/scripts/lint-cjk.js [--fix] [--quiet] [--base <ref>] [--files-from <list>] [路径]
 *
 *   --base <ref>     仅检查相对 <ref> 的改动文件（增量模式）
 *   --files-from <f> 从文件读取待检查的文件列表（每行一个路径）
 *
 * 退出码：存在未修复的 error 级问题时返回 1。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const args = process.argv.slice(2);
const FIX = args.includes('--fix');
const QUIET = args.includes('--quiet');
const BASE = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;
const FILES_FROM = args.includes('--files-from') ? args[args.indexOf('--files-from') + 1] : null;
const explicit = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--base' && args[i - 1] !== '--files-from');

const CJK = '\\u4e00-\\u9fff\\u3400-\\u4dbf';
const FULLWIDTH_MAP = { ',': '，', '.': '。', '!': '！', '?': '？', ';': '；', ':': '：' };
const LINE_START_FORBIDDEN = '，。！？、）：；」』”’》〉·…';
// 数字与单位之间需要空格（不含 CSS 单位 px / em / rem，避免误伤技术文档）
const UNITS = ['Gbps', 'Mbps', 'Kbps', 'Tbps', 'GB', 'MB', 'KB', 'TB', 'PB', 'ms', 'kg', 'km', 'cm', 'mm'];

// 由脚本生成的内容，不做排版校验
const GENERATED = ['docs/changelog.md'];

const MASK = '\u0001';

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function allTrackedMarkdown() {
  try {
    const out = git(['ls-files', '*.md']);
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    const out = [];
    (function walk(dir) {
      let items = [];
      try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const it of items) {
        if (it.name === 'node_modules' || it.name === '.git' || it.name === 'dist') continue;
        const full = path.join(dir, it.name);
        if (it.isDirectory()) walk(full);
        else if (it.name.endsWith('.md')) out.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    })(ROOT);
    return out;
  }
}

function changedFilesSince(ref) {
  const files = new Set();
  const add = (text) => text.split('\n').forEach((f) => { f = f.trim(); if (f) files.add(f); });
  try { add(git(['diff', '--name-only', '--diff-filter=ACMR', `${ref}..HEAD`], true)); } catch (e) { /* ignore */ }
  try { add(git(['diff', '--name-only', '--diff-filter=ACMR'], true)); } catch (e) { /* ignore */ }
  try { add(git(['ls-files', '--others', '--exclude-standard'], true)); } catch (e) { /* ignore */ }
  return [...files];
}

function listFiles() {
  if (FILES_FROM) {
    let raw = '';
    try { raw = fs.readFileSync(FILES_FROM, 'utf-8'); } catch (e) { raw = ''; }
    return raw.split('\n').map((s) => s.trim()).filter(Boolean).filter((f) => f.endsWith('.md'))
      .map((f) => path.resolve(ROOT, f));
  }
  if (explicit.length) {
    return explicit.map((p) => path.resolve(ROOT, p)).filter((p) => fs.existsSync(p));
  }
  if (BASE) {
    return changedFilesSince(BASE).filter((f) => f.endsWith('.md')).map((f) => path.resolve(ROOT, f));
  }
  const tracked = allTrackedMarkdown();
  if (tracked.length) return tracked.map((f) => path.resolve(ROOT, f));
  const out = [];
  (function walk(dir) {
    let items = [];
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const it of items) {
      if (it.name === 'node_modules' || it.name === '.git') continue;
      const full = path.join(dir, it.name);
      if (it.isDirectory()) walk(full);
      else if (it.name.endsWith('.md')) out.push(full);
    }
  })(ROOT);
  return out;
}

// 用等长占位符遮蔽不应参与检查的片段（保留换行，保证行号对齐）
function maskKeepLength(text) {
  return text.replace(/[^\n]/g, MASK);
}

// 整篇遮蔽：HTML 注释、HTML 标签（可跨行）、行内代码、链接、图片、URL、自定义指令属性、日期、时间
function maskContent(content) {
  let out = content;
  const masks = [
    /<!--[\s\S]*?-->/g,
    /<[^>]*>/g,
    /`[^`\n]*`/g,
    /!\[[^\]]*\]\([^)]*\)/g,
    /\[[^\]]*\]\([^)]*\)/g,
    /https?:\/\/\S+/g,
    /\[[^\]\n]*="[^"\n]*"\]/g,
    // 日期（2024年5月20日）不做中英间距校验
    /\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日/g,
    // 时间（10:30、10:30:00）
    /\b\d{1,2}:\d{2}(:\d{2})?\b/g,
  ];
  for (const re of masks) {
    out = out.replace(re, (m) => maskKeepLength(m));
  }
  return out;
}

const UNIT_RE = new RegExp(`\\d(?=(?:${UNITS.join('|')})(?![A-Za-z]))`, 'g');
const FULLWIDTH_DIGIT_RE = /[\uff10-\uff19]/g;

function lintLine(line, lineNo, file, issues) {
  const clean = line;

  // 1) CJK 与拉丁字母 / 数字缺空格
  const spacingRe = new RegExp(`([${CJK}])([A-Za-z0-9])|([A-Za-z0-9])([${CJK}])`, 'g');
  let m;
  while ((m = spacingRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'spacing', level: 'error', msg: '中英文 / 数字之间应加空格' });
  }

  // 2) 数字与单位缺空格（% 与 ° 例外，不在 UNITS 列表内）
  while ((m = UNIT_RE.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'unit', level: 'error', msg: '数字与单位之间应加空格' });
  }

  // 3) CJK 紧邻半角标点
  const halfRe = new RegExp(`[${CJK}]([,.;:!?])(?=\\s|$|[${CJK}])`, 'g');
  while ((m = halfRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'punct', level: 'error', msg: `中文后应使用全角标点「${FULLWIDTH_MAP[m[1]] || m[1]}」` });
  }

  // 4) 全角标点与其他字符之间多了空格
  const spaceBeforeFullRe = /[ \t]+([，。！？；：、）」』】》])/g;
  while ((m = spaceBeforeFullRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'punct-space', level: 'error', msg: '全角标点前不应加空格' });
  }

  // 5) 重复使用标点符号
  const dupRe = /([，。！？；：])\1+/g;
  while ((m = dupRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'dup-punct', level: 'error', msg: '不应重复使用标点符号' });
  }
  const tripleRe = /[？！]{3,}/g;
  while ((m = tripleRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'dup-punct', level: 'error', msg: '不应重复使用标点符号' });
  }

  // 6) 数字使用全角字符
  while ((m = FULLWIDTH_DIGIT_RE.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'fullwidth-digit', level: 'error', msg: '数字应使用半角字符' });
  }

  // 7) 行首禁则
  const lead = clean.replace(/^\s*(?:>|[-*+]|\d+\.)\s*/, '');
  if (lead && LINE_START_FORBIDDEN.indexOf(lead[0]) !== -1) {
    issues.push({ file, line: lineNo, col: 1, rule: 'line-start', level: 'error', msg: `行首不应出现「${lead[0]}」` });
  }

  // 8) 中文旁直引号（仅提示）
  const quoteRe = new RegExp(`[${CJK}]"|"[${CJK}]`, 'g');
  while ((m = quoteRe.exec(clean)) !== null) {
    issues.push({ file, line: lineNo, col: m.index + 1, rule: 'quote', level: 'warn', msg: '中文内容不应使用直引号，建议使用「」或“”' });
  }
}

function fixLine(line) {
  let out = line;
  // 数字与单位加空格
  out = out.replace(UNIT_RE, (mm) => `${mm} `);
  // 插空格（双向）
  out = out.replace(new RegExp(`([${CJK}])([A-Za-z0-9])`, 'g'), '$1 $2');
  out = out.replace(new RegExp(`([A-Za-z0-9])([${CJK}])`, 'g'), '$1 $2');
  // 半角标点 → 全角（仅 CJK 之后）
  out = out.replace(new RegExp(`([${CJK}])([,.;:!?])(?=\\s|$|[${CJK}])`, 'g'),
    (mm, c, p) => c + (FULLWIDTH_MAP[p] || p));
  // 全角标点前的多余空格
  out = out.replace(/[ \t]+([，。！？；：、）」』】》])/g, '$1');
  // 重复标点
  out = out.replace(/([，。！？；：])\1+/g, '$1');
  out = out.replace(/[？！]{3,}/g, '？！');
  // 全角数字 → 半角
  out = out.replace(FULLWIDTH_DIGIT_RE, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  return out;
}

/**
 * 只修复「安全片段」：把行按被遮蔽的位置切成若干段，
 * 逐段做修复，代码 / 链接 / URL / HTML 所在片段原样保留。
 */
function fixMaskedLine(rawLine, maskedLine) {
  if (maskedLine.indexOf(MASK) === -1) return fixLine(rawLine);
  const chars = [...maskedLine];
  const rawChars = [...rawLine];
  if (chars.length !== rawChars.length) return fixLine(rawLine);

  let out = '';
  let segment = '';
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === MASK) {
      if (segment) { out += fixLine(segment); segment = ''; }
      out += rawChars[i];
    } else {
      segment += rawChars[i];
    }
  }
  if (segment) out += fixLine(segment);
  return out;
}

function lintFile(file, applyFix) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (GENERATED.includes(rel)) return { issues: [], fixed: false, skipped: true };

  let content;
  try { content = fs.readFileSync(file, 'utf-8'); } catch (e) { return { issues: [], fixed: false }; }
  const rawLines = content.split('\n');
  const maskedLines = maskContent(content).split('\n');
  const issues = [];
  let fence = null;
  let inFrontmatter = false;
  let frontmatterDone = false;
  let changed = false;
  const outLines = [];

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const eol = raw.endsWith('\r') ? '\r' : '';
    const rawLine = raw.replace(/\r$/, '');
    const maskedLine = (maskedLines[i] || '').replace(/\r$/, '');
    const push = (text) => outLines.push(text + eol);

    if (!frontmatterDone && i === 0 && rawLine.trim() === '---') { inFrontmatter = true; push(rawLine); continue; }
    if (inFrontmatter) {
      if (rawLine.trim() === '---') { inFrontmatter = false; frontmatterDone = true; }
      push(rawLine);
      continue;
    }

    const fm = rawLine.match(/^\s*(`{3,}|~{3,})/);
    if (fm) {
      const marker = fm[1];
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length && rawLine.trim() === marker) fence = null;
      push(rawLine);
      continue;
    }
    if (fence) { push(rawLine); continue; }

    lintLine(maskedLine, i + 1, rel, issues);

    if (applyFix) {
      const fixed = fixMaskedLine(rawLine, maskedLine);
      if (fixed !== rawLine) { changed = true; push(fixed); continue; }
    }
    push(rawLine);
  }

  if (applyFix && changed) fs.writeFileSync(file, outLines.join('\n'), 'utf-8');
  return { issues, fixed: changed };
}

function main() {
  const files = listFiles();
  const fixedFiles = [];

  // 先执行修复
  if (FIX) {
    for (const file of files) {
      const { fixed } = lintFile(file, true);
      if (fixed) {
        fixedFiles.push(path.relative(ROOT, file));
        if (!QUIET) console.log(`✏️ 已修复：${path.relative(ROOT, file)}`);
      }
    }
  }

  // 再基于当前文件内容做一次完整检查
  let errors = 0;
  let warns = 0;
  let filesWithIssues = 0;

  for (const file of files) {
    const { issues } = lintFile(file, false);
    const fileErrors = issues.filter((is) => is.level === 'error');
    const fileWarns = issues.filter((is) => is.level !== 'error');
    errors += fileErrors.length;
    warns += fileWarns.length;
    if (issues.length) {
      filesWithIssues++;
      if (!QUIET) {
        issues.slice(0, 100).forEach((is) => {
          console.log(`${is.file}:${is.line}:${is.col}  [${is.level === 'error' ? 'error' : 'warn '}] ${is.rule}: ${is.msg}`);
        });
        if (issues.length > 100) console.log(`  （其余 ${issues.length - 100} 条省略）`);
      }
    }
  }

  const mode = BASE ? '增量' : '全量';
  console.log(`\n中文排版 lint（${mode}）：检查 ${files.length} 个文件，${errors} 处错误 / ${warns} 处提示（${filesWithIssues} 个文件有问题）`);
  if (FIX) console.log(`已自动修复 ${fixedFiles.length} 个文件`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
