#!/usr/bin/env node

/**
 * 生成变更日志页（GIT-2）
 *
 * 从 git 历史（docs/ 目录相关提交）自动生成 docs/changelog.md：
 * 按日期倒序分组，列出提交短哈希、摘要与作者。
 *
 * 使用：
 *   node iris/scripts/build-changelog.js
 *
 * 环境变量：
 *   CHANGELOG_LIMIT  最多收录的提交数（默认 200）
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const OUTPUT_FILE = path.join(ROOT, 'docs', 'changelog.md');
const LIMIT = Number(process.env.CHANGELOG_LIMIT || 200);

const FIELD = '\x1f';

function getCommits() {
  try {
    const out = execFileSync(
      'git',
      ['log', '-n', String(LIMIT), '--date=short', `--pretty=format:%h${FIELD}%cs${FIELD}%an${FIELD}%s`, '--', 'docs'],
      { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    ).trim();
    if (!out) return [];
    return out.split('\n').map(line => {
      const [hash, date, author, subject] = line.split(FIELD);
      return { hash, date, author, subject };
    }).filter(c => c.hash && c.date);
  } catch (e) {
    return [];
  }
}

function build() {
  const commits = getCommits();

  const lines = [];
  lines.push('---');
  lines.push('title: 变更日志');
  lines.push('tags: [规划]');
  lines.push('---');
  lines.push('');
  lines.push('# 变更日志');
  lines.push('');
  lines.push('> 本页由 `iris/scripts/build-changelog.js` 从 git 历史自动生成，请勿手动编辑。');
  lines.push('');

  if (commits.length === 0) {
    lines.push('*暂无提交记录（git 不可用或历史为空）。*');
    lines.push('');
  } else {
    let currentDate = '';
    for (const c of commits) {
      if (c.date !== currentDate) {
        currentDate = c.date;
        lines.push(`## ${c.date}`);
        lines.push('');
      }
      const safeSubject = String(c.subject).replace(/\|/g, '\\|');
      lines.push(`- \`${c.hash}\` ${safeSubject} — ${c.author}`);
    }
    lines.push('');
    lines.push(`> 共 ${commits.length} 条（最多展示 ${LIMIT} 条）。`);
    lines.push('');
  }

  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  console.log(`✅ Changelog generated: ${OUTPUT_FILE}`);
  console.log(`   ${commits.length} commits`);
}

build();
