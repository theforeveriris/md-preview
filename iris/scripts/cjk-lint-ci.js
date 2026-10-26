#!/usr/bin/env node

/**
 * 中文排版 CI 辅助脚本
 *
 * 职责：
 *   1. 决定本次流水线是「全量」还是「增量」检查
 *      - 首次运行（没有基线 tag）→ 全量
 *      - 之后每次运行 → 增量（只检查自基线以来改动的 Markdown 文件）
 *   2. 输出待检查文件清单，供 lint-cjk.js --files-from 使用
 *   3. 在检查完成后推进基线 tag
 *
 * 用法：
 *   node iris/scripts/cjk-lint-ci.js prepare [--force-full] [--out <file>]
 *   node iris/scripts/cjk-lint-ci.js advance
 *
 * 环境变量：
 *   CJK_LINT_BASE_TAG  基线 tag 名称（默认 cjk-lint-baseline）
 *   GITHUB_EVENT_NAME  为 pull_request 时不推进基线（不写回仓库）
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const BASE_TAG = process.env.CJK_LINT_BASE_TAG || 'cjk-lint-baseline';

function git(args, allowFail = false) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (allowFail) return '';
    throw e;
  }
}

function tagCommit() {
  const out = git(['rev-list', '-n', '1', BASE_TAG], true).trim();
  return out || null;
}

function isAncestor(ancestor, descendant) {
  if (!ancestor) return false;
  try {
    git(['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch (e) {
    return false;
  }
}

function changedMarkdown(base) {
  const files = new Set();
  const add = (text) => text.split('\n').forEach((f) => { f = f.trim(); if (f) files.add(f); });

  if (base) {
    add(git(['diff', '--name-only', '--diff-filter=ACMR', `${base}..HEAD`], true));
    add(git(['diff', '--name-only', '--diff-filter=ACMR'], true)); // 未提交改动
  }
  add(git(['ls-files', '--others', '--exclude-standard'], true)); // 新增未跟踪文件
  return [...files].filter((f) => f.endsWith('.md')).sort();
}

function allMarkdown() {
  return git(['ls-files', '*.md'], true).split('\n').map((s) => s.trim()).filter(Boolean).sort();
}

function prepare(argv) {
  const forceFull = argv.includes('--force-full');
  const outIdx = argv.indexOf('--out');
  const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;

  const head = git(['rev-parse', 'HEAD']).trim();
  // PR 场景可用 CJK_LINT_BASE_COMMIT 指定 PR 基线提交
  const override = process.env.CJK_LINT_BASE_COMMIT || null;
  const base = override || tagCommit();
  const full = forceFull || !base || !isAncestor(base, head);

  const files = full ? allMarkdown() : changedMarkdown(base);

  if (outFile) {
    const target = path.isAbsolute(outFile) ? outFile : path.join(ROOT, outFile);
    fs.writeFileSync(target, files.map((f) => f.split(path.sep).join('/')).join('\n') + (files.length ? '\n' : ''), 'utf-8');
  }

  console.log(`mode=${full ? 'full' : 'incremental'}`);
  console.log(`base=${base || '(none)'}`);
  console.log(`files=${files.length}`);
  if (base && !full) console.log(`range=${base}..HEAD`);
}

function advance() {
  // PR 上不推进基线
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
    console.log('skip advancing baseline on pull_request');
    return;
  }
  // 优先指向已推送的远端 main，避免指向未推送的本地提交
  let target = git(['rev-parse', 'HEAD'], true).trim();
  const remote = git(['rev-parse', 'refs/remotes/origin/main'], true).trim();
  if (remote) target = remote;
  if (!target) {
    console.log('skip advancing baseline: no target commit');
    return;
  }
  git(['tag', '-f', BASE_TAG, target]);
  git(['push', '--force', 'origin', `refs/tags/${BASE_TAG}`]);
  console.log(`baseline advanced to ${target}`);
}

const cmd = process.argv[2];
const argv = process.argv.slice(3);
if (cmd === 'prepare') prepare(argv);
else if (cmd === 'advance') advance();
else {
  console.error('用法：node iris/scripts/cjk-lint-ci.js prepare [--force-full] [--out <file>] | advance');
  process.exit(2);
}
