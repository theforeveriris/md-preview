/**
 * sync-features.js — 根据 iris/config.json 的 features 块同步渲染器/插件文件
 *
 * 工作机制：
 *   1. 读取 iris/config.json 的 features 块（每项 { "enabled": bool, "description": "..." }）
 *   2. 读取 iris/scripts/renderer-manifest.json 获取全部渲染器/插件的文件路径、类型与顺序
 *   3. 文件管理：
 *        enabled:false → 文件移入同目录 .disabled/ 备份
 *        enabled:true  → 从 .disabled/ 恢复（如有）
 *   4. index.html：
 *        在 <!-- BEGIN RENDERER SCRIPTS --> 与 <!-- END RENDERER SCRIPTS -->
 *        标记之间，按清单顺序整块重建所有「已启用且文件存在」的渲染器
 *        <script> 标签。整块重建是确定性的，不会破坏 steps→mermaid、
 *        color-utils→graph 这类加载顺序依赖。
 *   5. 插件：按 enabled 增删 plugins/directory.json 中的条目。
 *
 * 用法：
 *   node iris/scripts/sync-features.js            # 同步
 *   node iris/scripts/sync-features.js --dry-run  # 只报告不执行
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const IRIS_DIR = path.join(ROOT, 'iris');
const CONFIG_PATH = path.join(IRIS_DIR, 'config.json');
const MANIFEST_PATH = path.join(IRIS_DIR, 'scripts', 'renderer-manifest.json');
const INDEX_HTML_PATH = path.join(ROOT, 'index.html');
const PLUGIN_DIR_PATH = path.join(IRIS_DIR, 'plugins', 'directory.json');

const BEGIN_MARK = '<!-- BEGIN RENDERER SCRIPTS';
const END_MARK = '<!-- END RENDERER SCRIPTS -->';

const DRY_RUN = process.argv.includes('--dry-run');

function readJSON(p) {
  const raw = fs.readFileSync(p, 'utf8');
  // 容忍 // 与 /* */ 注释（config.json 里可能用注释写说明）
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return JSON.parse(stripped);
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function backupPath(filePath) {
  // iris/js/renderers/mermaid.js → iris/js/renderers/.disabled/mermaid.js
  return path.join(path.dirname(filePath), '.disabled', path.basename(filePath));
}

function buildRendererBlock(manifest, isEnabled, fileExists) {
  const lines = [];
  for (const item of manifest.items) {
    if (item.type === 'plugin') continue;
    if (!isEnabled(item.id)) continue;
    if (!fileExists(item.file)) continue;
    if (item.note) lines.push(`  <!-- ${item.note} -->`);
    lines.push(`  <script defer src="${item.file}"></script>`);
  }
  return lines.join('\n');
}

function extractBlock(html) {
  const bIdx = html.indexOf(BEGIN_MARK);
  const eIdx = html.indexOf(END_MARK);
  if (bIdx === -1 || eIdx === -1 || eIdx < bIdx) return null;
  const contentStart = html.indexOf('\n', bIdx) + 1;
  return { contentStart, eIdx, content: html.slice(contentStart, eIdx) };
}

function replaceBlock(html, block) {
  const cur = extractBlock(html);
  if (!cur) return null;
  return html.slice(0, cur.contentStart) + block + '\n  ' + html.slice(cur.eIdx);
}

function main() {
  const config = readJSON(CONFIG_PATH);
  const manifest = readJSON(MANIFEST_PATH);
  const features = config.features || {};

  const isEnabled = (id) => {
    const f = features[id];
    return f ? f.enabled !== false : true; // 未在 features 中出现 → 默认启用
  };
  const fileExists = (rel) => fs.existsSync(path.join(ROOT, rel));

  const changes = [];
  const warnings = [];

  // ── 1. 文件管理（渲染器 + 插件）──
  for (const item of manifest.items) {
    const enabled = isEnabled(item.id);
    const filePath = path.join(ROOT, item.file);
    const bakPath = backupPath(filePath);
    const hasFile = fs.existsSync(filePath);
    const hasBackup = fs.existsSync(bakPath);

    if (!enabled) {
      if (hasFile) {
        if (DRY_RUN) {
          changes.push(`[禁用] ${item.id}: 将移动 ${item.file} → .disabled/`);
        } else {
          ensureDir(path.dirname(bakPath));
          fs.renameSync(filePath, bakPath);
          changes.push(`[禁用] ${item.id}: 已移动 ${item.file} → .disabled/`);
        }
      }
    } else if (!hasFile && hasBackup) {
      if (DRY_RUN) {
        changes.push(`[启用] ${item.id}: 将恢复 .disabled/ → ${item.file}`);
      } else {
        fs.renameSync(bakPath, filePath);
        changes.push(`[启用] ${item.id}: 已恢复 ${item.file}`);
      }
    } else if (!hasFile && !hasBackup) {
      warnings.push(`[启用] ${item.id}: 文件不存在且无备份 — ${item.file}`);
    }
  }

  // ── 2. index.html 渲染器块整块重建 ──
  {
    const html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const cur = extractBlock(html);
    if (!cur) {
      warnings.push('index.html 缺少 BEGIN/END RENDERER SCRIPTS 标记，跳过脚本块重建');
    } else {
      // 文件移动可能刚发生：重新用实际存在性判断
      const block = buildRendererBlock(manifest, isEnabled, fileExists);
      const curNormalized = cur.content.replace(/\r\n/g, '\n').trim();
      if (curNormalized !== block.trim()) {
        if (DRY_RUN) {
          changes.push('[索引] 将重建 index.html 渲染器脚本块');
        } else {
          const newHtml = replaceBlock(html, block);
          fs.writeFileSync(INDEX_HTML_PATH, newHtml, 'utf8');
          changes.push('[索引] 已重建 index.html 渲染器脚本块');
        }
      }
    }
  }

  // ── 3. 插件清单 directory.json ──
  {
    const dirJson = readJSON(PLUGIN_DIR_PATH);
    if (!Array.isArray(dirJson.files)) dirJson.files = [];

    const original = dirJson.files.slice();
    const managed = manifest.items.filter(i => i.type === 'plugin');
    const managedNames = new Set(managed.map(i => path.basename(i.file)));

    // 目标列表：保留原有顺序中仍启用且存在的项；再把漏掉的已启用插件按清单顺序补上
    const target = [];
    for (const f of original) {
      if (!managedNames.has(f)) { target.push(f); continue; }
      const item = managed.find(i => path.basename(i.file) === f);
      if (item && isEnabled(item.id) && fileExists(item.file)) target.push(f);
    }
    for (const item of managed) {
      const name = path.basename(item.file);
      if (isEnabled(item.id) && fileExists(item.file) && !target.includes(name)) {
        target.push(name);
      }
    }

    const changed = JSON.stringify(target) !== JSON.stringify(original);
    if (changed) {
      if (DRY_RUN) {
        changes.push('[插件] 将更新 plugins/directory.json');
      } else {
        dirJson.files = target;
        writeJSON(PLUGIN_DIR_PATH, dirJson);
        changes.push('[插件] 已更新 plugins/directory.json');
      }
    }
  }

  // ── 摘要 ──
  const enabledCount = manifest.items.filter(i => isEnabled(i.id)).length;
  console.log('\n═══════════════════════════════════════════');
  console.log('  sync-features — 功能同步摘要');
  console.log('═══════════════════════════════════════════');
  if (DRY_RUN) console.log('  模式：DRY RUN（不执行变更）\n');
  console.log(`  配置：${CONFIG_PATH}`);
  console.log(`  清单：${MANIFEST_PATH}`);
  console.log(`  功能总数：${manifest.items.length}`);
  console.log(`  启用：${enabledCount}  禁用：${manifest.items.length - enabledCount}`);
  console.log('');

  if (changes.length > 0) {
    console.log('  变更：');
    for (const c of changes) console.log('    ' + c);
  } else {
    console.log('  ✓ 无变更 — 文件状态与 config.json 一致');
  }

  if (warnings.length > 0) {
    console.log('');
    console.log('  警告：');
    for (const w of warnings) console.log('    ' + w);
  }
  console.log('═══════════════════════════════════════════\n');
}

main();
