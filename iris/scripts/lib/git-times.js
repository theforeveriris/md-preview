#!/usr/bin/env node

/**
 * Git 提交时间采集（构建期）
 *
 * 为文件树提供「最初创建时间」与「最后修改时间」，供侧边栏按时间排序使用。
 *
 * 口径：
 *   - created  = 文件**首次被添加**（diff-filter=A）的那次提交时间
 *   - modified = 文件**最后一次被改动**的提交时间
 *   - 均为 Unix 秒级时间戳（number），缺失时为 0
 *
 * 实现：一次 `git log --name-only` 遍历所有 .md 的提交历史，单遍扫描同时
 * 得出两个时间戳（O(提交数) 而非 O(提交数 × 文件数) 次 git 调用）。
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * 统一的 git log 调用参数
 * -c core.quotePath=false：非 ASCII 文件名（如中文名）不转义，直接输出原名
 */
function gitLog(args, root) {
  return execFileSync(
    'git',
    ['-c', 'core.quotePath=false', 'log', ...args],
    { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }
  );
}

/**
 * 采集仓库内所有 .md 文件的创建 / 修改时间
 * @param {string} [root] 仓库根目录
 * @returns {Map<string, {created: number, modified: number}>} path -> 时间戳
 */
function collectMarkdownTimes(root = ROOT) {
  const times = new Map();

  let out = '';
  try {
    out = gitLog(
      ['--format=%x00%ct', '--name-only', '--no-renames', '--diff-filter=AM', '--', ':(glob)**/*.md'],
      root
    );
  } catch (e) {
    // 非 git 仓库或 git 不可用：返回空表（排序时回退到名称序）
    return times;
  }

  // git log 输出格式（--name-only）：
  //   \0<commitTime>\n
  //   \n
  //   file1\n
  //   file2\n
  //   \0<nextCommitTime>\n ...
  // 按 NUL 切分，每段 = 一个提交的「时间行 + 空行 + 文件列表」
  const chunks = out.split('\x00').slice(1);
  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    if (!lines.length) continue;
    const ts = parseInt(String(lines[0]).trim(), 10);
    if (!Number.isFinite(ts) || ts <= 0) continue;

    // 余下非空行是本次提交涉及的文件
    for (let i = 1; i < lines.length; i++) {
      const file = lines[i].trim();
      if (!file) continue;
      const rel = file.split(path.sep).join('/');

      // git log 按时间倒序：第一次遇到即该文件的最后一次修改
      const cur = times.get(rel);
      if (!cur) {
        times.set(rel, { created: ts, modified: ts });
      } else if (ts > cur.modified) {
        cur.modified = ts;
      }
    }
  }

  return times;
}

/**
 * 采集「所有提交」的创建时间（含新增与后续修改）
 *
 * 上面的 --diff-filter=AM 只覆盖新增/修改；为拿到准确的 created，
 * 另跑一遍 --diff-filter=A 专门取首次添加时间。
 *
 * @param {string} [root]
 * @returns {Map<string, {created: number, modified: number}>}
 */
function collectMarkdownTimesWithCreated(root = ROOT) {
  const times = collectMarkdownTimes(root);

  let out = '';
  try {
    out = gitLog(
      ['--format=%x00%ct', '--name-only', '--no-renames', '--diff-filter=A', '--', ':(glob)**/*.md'],
      root
    );
  } catch (e) {
    return times;
  }

  const chunks = out.split('\x00').slice(1);
  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    if (!lines.length) continue;
    const ts = parseInt(String(lines[0]).trim(), 10);
    if (!Number.isFinite(ts) || ts <= 0) continue;
    for (let i = 1; i < lines.length; i++) {
      const file = lines[i].trim();
      if (!file) continue;
      const rel = file.split(path.sep).join('/');
      const cur = times.get(rel);
      if (cur) {
        // 首次添加的提交更早，取较小者
        cur.created = Math.min(cur.created, ts);
      } else {
        times.set(rel, { created: ts, modified: ts });
      }
    }
  }

  return times;
}

// 只导出带 created 的版本：collectMarkdownTimes 是它的内部实现
module.exports = { collectMarkdownTimesWithCreated, ROOT };
