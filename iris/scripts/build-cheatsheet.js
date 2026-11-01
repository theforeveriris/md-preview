#!/usr/bin/env node

/**
 * 生成全站速查索引（CHEATSHEET-1）
 *
 * 扫描 docs/ 全部 .md 中的 ```ios / ```vrp / ```bash / ```sh / ```console /
 * ```powershell / ```cisco / ```huawei 代码块，抽取命令行片段聚合为
 * iris/data/cheatsheet.json —— 站点 #/cheatsheet/<语言> 虚拟页消费。
 *
 * 每条片段带源文档路径 + 标题 + 命中行号，聚合页可直达原文上下文。
 * 输出紧凑 JSON（与其他 data 产物一致）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const DOCS_DIR = path.join(ROOT, 'docs');
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'cheatsheet.json');

// 与 build-file-tree.js 的 EXCLUDED_DIRS 保持一致
const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'vendor', '.github', 'dist', 'src-tauri', 'zw']);

// 参与速查聚合的语言 → 展示分组（keepLine 谓词过滤非命令行）
const LANGS = {
  ios: { group: 'cisco', label: 'Cisco IOS' },
  cisco: { group: 'cisco', label: 'Cisco IOS' },
  vrp: { group: 'huawei', label: 'Huawei VRP' },
  huawei: { group: 'huawei', label: 'Huawei VRP' },
  bash: { group: 'shell', label: 'Shell' },
  sh: { group: 'shell', label: 'Shell' },
  shell: { group: 'shell', label: 'Shell' },
  console: { group: 'shell', label: 'Shell' },
  powershell: { group: 'shell', label: 'PowerShell' }
};

// 非 prompt 行的启发式：注释/空行/表头说明不收
function isCommandLike(line) {
  const s = line.trim();
  if (!s) return false;
  if (/^[!#]/.test(s)) return false;           // shell 注释 / !历史
  if (/^(\/\/|#|;)/.test(s)) return false;
  if (/^(Note|说明|输出|示例|Usage)[:：]/i.test(s)) return false;
  return true;
}

// 从行里剥掉 prompt 前缀（Router# / <Huawei> / $ / PS C:\>）
function stripPrompt(line) {
  return line
    .replace(/^[A-Za-z][\w.-]*[#>]\s+/, '')     // Router# / Router>
    .replace(/^[<\[][\w-]+[>\]]\s*/, '')        // <Huawei> / [Quidway]
    .replace(/^\$\s+/, '')
    .replace(/^PS\s[^>]*>\s*/, '')
    .trimEnd();
}

function collectDocs(dir, base = '', out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (EXCLUDED_DIRS.has(item.name)) continue;
      collectDocs(path.join(dir, item.name), base ? `${base}/${item.name}` : item.name, out);
    } else if (item.isFile() && /\.md$/i.test(item.name)) {
      out.push(base ? `${base}/${item.name}` : item.name);
    }
  }
  return out;
}

function extractTitle(content, fallback) {
  const fmTitle = /^title:\s*(.+)$/m.exec(content);
  if (fmTitle) return fmTitle[1].trim().replace(/^["']|["']$/g, '');
  const h1 = /^#\s+(.+)$/m.exec(content);
  return h1 ? h1[1].trim() : fallback;
}

function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.warn('docs/ not found');
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), groups: [] }));
    return;
  }

  const files = collectDocs(DOCS_DIR);
  // group → lang → snippets[]
  const buckets = new Map();

  for (const rel of files) {
    const full = path.join(DOCS_DIR, rel);
    let content;
    try {
      content = fs.readFileSync(full, 'utf-8');
    } catch (e) {
      continue;
    }
    const title = extractTitle(content, path.basename(rel, '.md'));
    const lines = content.split('\n');
    let inFence = false;
    let fenceLang = '';
    let fenceStart = 0;
    let buffer = [];

    const flush = () => {
      const meta = LANGS[fenceLang];
      if (meta && buffer.length) {
        const cmds = buffer.map(stripPrompt).filter(isCommandLike).slice(0, 40); // 单块封顶
        if (cmds.length) {
          if (!buckets.has(meta.group)) buckets.set(meta.group, new Map());
          const byLang = buckets.get(meta.group);
          if (!byLang.has(fenceLang)) byLang.set(fenceLang, []);
          byLang.get(fenceLang).push({
            doc: rel,
            title,
            line: fenceStart + 1,
            cmds
          });
        }
      }
      buffer = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const fm = lines[i].match(/^\s*(`{3,}|~{3,})\s*(\S*)/);
      if (fm) {
        if (!inFence) {
          inFence = true;
          fenceLang = (fm[2] || '').toLowerCase();
          fenceStart = i + 1;
          buffer = [];
        } else {
          // 容许无语言围栏直接闭合
          if (fm[2]) fenceLang = (fm[2] || '').toLowerCase();
          inFence = false;
          flush();
        }
        continue;
      }
      if (inFence && LANGS[fenceLang]) buffer.push(lines[i]);
    }
    if (inFence) flush(); // 未闭合围栏兜底
  }

  const groups = Array.from(buckets.entries()).map(([group, byLang]) => ({
    group,
    label: (byLang.values().next().value && LANGS[Array.from(byLang.keys())[0]]) ? LANGS[Array.from(byLang.keys())[0]].label : group,
    langs: Array.from(byLang.entries()).map(([lang, snippets]) => ({
      lang,
      label: LANGS[lang] ? LANGS[lang].label : lang,
      count: snippets.reduce((a, s) => a + s.cmds.length, 0),
      snippets
    }))
  })).sort((a, b) => b.langs.reduce((x, l) => x + l.count, 0) - a.langs.reduce((x, l) => x + l.count, 0));

  const total = groups.reduce((a, g) => a + g.langs.reduce((x, l) => x + l.count, 0), 0);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    total,
    groups
  }));
  console.log(`cheatsheet.json 构建成功：${groups.length} 个分组，${total} 条命令片段`);
  console.log(`   输出：${OUTPUT_FILE}`);
}

main();
