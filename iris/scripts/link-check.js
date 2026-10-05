#!/usr/bin/env node

/**
 * CI 死链检查（link check）
 *
 * 与 smoke-test.js 同构的快速静态检查，不做真实渲染：
 *
 *   1. 内链全量：扫描仓库全部 .md（git ls-files，本地并入未跟踪文件）中的
 *      链接引用，逐一对照仓库文件集校验存在性（大小写敏感，与 Linux 部署
 *      一致）。覆盖 `[](...)` 图片 / 链接、引用式定义、HTML <a href>/<img src>
 *      与 `<http://...>` 自动链接；`.md#锚点` 按运行时同款 slug 规则校验
 *      （markdown.js 把标题 textContent 小写化、非 \w/中文连续字符替换为 `-`）；
 *      `@[pkt|ensp|pptx](slug)` 嵌入（正文裸写与顶层围栏内两种用法）按
 *      iris/data/<type>/json/<slug>.json 校验，slug 与运行时同款 decodeURIComponent
 *      解码；演示性死链可在围栏前一行写 `<!-- link-check-ignore -->` 豁免。
 *      围栏内的链接 / 行内代码 / HTML 注释中的内容不参与检查。
 *   2. 外链抽查：全仓库外链去重后按种子做确定性抽样（默认按日轮换 12 个，
 *      `--all-external` 全量）。HEAD 失败回退 GET，超时默认 8s，瞬时错误
 *      重试一次。默认仅告警不失败（第三方服务波动不打红 CI），
 *      `--strict-external` 升级为致命。
 *
 * 跳过：mailto / javascript / data 协议、本站自身部署地址（由
 * iris/config.json 的 owner/repo 推导）、localhost 与示例域。
 *
 * 用法：
 *   node iris/scripts/link-check.js
 *   node iris/scripts/link-check.js --no-external
 *   node iris/scripts/link-check.js --external-limit=30 --strict-external
 * 依赖：Node 18+（原生 fetch），无第三方依赖
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

// ============== CLI 参数 ==============
const USAGE = `用法：node iris/scripts/link-check.js [选项]

选项：
  --no-external         跳过外链抽查（只查内链）
  --external-limit=N    外链抽样数量（默认 12，0 表示全量）
  --external-timeout=MS 单请求超时（默认 8000）
  --all-external        等价于 --external-limit=0，外链全量检查
  --strict-external     外链失败升级为致命（默认仅告警）
  --seed=STR            抽样种子（默认当天 UTC 日期，按日轮换）
  -h, --help            显示本帮助`;

const opt = {
  external: true,
  externalLimit: 12,
  timeout: 8000,
  strictExternal: false,
  seed: new Date().toISOString().slice(0, 10),
  allExternal: false,
};
for (const a of process.argv.slice(2)) {
  if (a === '-h' || a === '--help') { console.log(USAGE); process.exit(0); }
  else if (a === '--no-external') opt.external = false;
  else if (a === '--strict-external') opt.strictExternal = true;
  else if (a === '--all-external') opt.allExternal = true;
  else if (a.startsWith('--external-limit=')) opt.externalLimit = parseInt(a.slice(17), 10) || 0;
  else if (a.startsWith('--external-timeout=')) opt.timeout = parseInt(a.slice(19), 10) || 8000;
  else if (a.startsWith('--seed=')) opt.seed = a.slice(7);
  else { console.error(`未知参数：${a}\n${USAGE}`); process.exit(2); }
}

let failures = 0;
function fail(msg) { failures++; console.error(`  ✗ ${msg}`); }
function pass(msg) { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.error(`  ⚠ ${msg}`); }

// ============== 仓库文件集 ==============
// git ls-files 为准（大小写与 Linux 部署一致），本地开发时并入未跟踪文件，
// 避免「链接指向刚写好还没 add 的文档」这类本地误报。
const FILES = new Set();
const DIRS = new Set();

function addPath(rel) {
  rel = rel.split(path.sep).join('/');
  if (!rel || rel === '.') return;
  FILES.add(rel);
  let dir = path.posix.dirname(rel);
  while (dir && dir !== '.') {
    DIRS.add(dir);
    dir = path.posix.dirname(dir);
  }
}

function walkFs(dir, relBase, out) {
  let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      DIRS.add(rel);
      walkFs(path.join(dir, entry.name), rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
}

function collectUniverse() {
  let gitList = null;
  try {
    const buf = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    gitList = buf.toString('utf-8').split('\0').filter(Boolean);
  } catch { /* git 不可用时退回文件系统遍历 */ }
  const fromGit = new Set();
  if (gitList) {
    for (const rel of gitList) { addPath(rel); fromGit.add(rel); }
  }
  const local = [];
  walkFs(ROOT, '', local);
  for (const rel of local) {
    if (!fromGit.has(rel)) addPath(rel); // git 集合优先（大小写准确），仅补充未跟踪文件
  }
}

function targetExists(rel) {
  if (!rel) return false;
  return FILES.has(rel) || DIRS.has(rel);
}

// ============== Markdown 预处理 ==============
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const MD_FILE_RE = /\.markdown$|\.md$/i;

// 顶层围栏：闭合符与开启符同字符同长度（反向引用），```` 围栏内的 ``` 文本属于其
// 正文而非独立围栏（与 marked 分词一致）。标记、info 串、正文分别捕获。
const TOP_FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\n]*)\r?\n([\s\S]*?)^ {0,3}\1[ \t\r]*$/gm;
// 围栏开启前最近一行为本指令时，该围栏内的嵌入校验豁免（用于演示性死链）
const IGNORE_DIRECTIVE_AT_END_RE = /(?:^|\n)[ \t]*<!--\s*link-check-ignore\s*-->\s*$/;

// 链接提取准备：frontmatter / 顶层围栏 / 行内代码 / HTML 注释全部掩成等长空格
// （提取索引与原文一一对应，行号才准确），同时收集顶层围栏的语言与正文供嵌入校验
function prepareScan(md) {
  const fences = [];
  const mask = (m) => m.replace(/[^\n]/g, ' ');
  let out = md.replace(FRONTMATTER_RE, mask);
  let prevEnd = 0;
  out = out.replace(TOP_FENCE_RE, (m, marker, info, body, offset) => {
    fences.push({
      lang: info.trim().split(/\s+/)[0] || '',
      body,
      offset,
      offsetInMatch: m.indexOf(body),
      ignored: IGNORE_DIRECTIVE_AT_END_RE.test(md.slice(prevEnd, offset)),
    });
    prevEnd = offset + m.length;
    return mask(m);
  });
  out = out.replace(/`[^`\n]+`/g, mask).replace(HTML_COMMENT_RE, mask);
  return { masked: out, fences };
}

// 标题提取用：行内代码保留其内容（运行时 heading.textContent 含代码文字）
function stripForHeadings(md) {
  let out = md.replace(FRONTMATTER_RE, '');
  out = out.replace(TOP_FENCE_RE, '');
  return out.replace(/`([^`\n]+)`/g, '$1').replace(HTML_COMMENT_RE, '');
}

// 标题行 → 运行时 heading.textContent 的近似（markdown.js:352 以渲染后 DOM 文本生成 id）
function headingSourceToText(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')                   // 图片 → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')                    // 链接 → 链接文字
    .replace(/<[^>]+>/g, '')                                    // 原生 HTML 标签
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1')               // **strong**
    .replace(/(?<![\w\\])_(?=\S)([^_]*\S)_(?!\w)/g, '$1')       // _em_（词内下划线不是强调）
    .replace(/\*(?=\S)([^*]*\S)\*/g, '$1')                      // *em*
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')                   // ~~del~~
    .replace(/`([^`]*)`/g, '$1');                               // `code`
}

// 与 markdown.js 的 slug 规则逐字一致（markdown.js:354）
function slugify(text) {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
}

const headingIdCache = new Map();
function getHeadingIds(relPath) {
  if (headingIdCache.has(relPath)) return headingIdCache.get(relPath);
  const ids = new Set();
  try {
    const md = fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
    const re = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm;
    let m;
    while ((m = re.exec(stripForHeadings(md))) !== null) {
      ids.add(slugify(headingSourceToText(m[2])));
    }
  } catch { /* 读不到就当作无锚点，文件缺失已另行上报 */ }
  headingIdCache.set(relPath, ids);
  return ids;
}

// ============== 链接提取 ==============
const INLINE_LINK_RE = /(!?)\[([^\]]*)\]\(\s*(?:<([^<>]*)>|([^)\s]*)(?:\s+"[^"]*")?)\s*\)/g;
const REF_DEF_RE = /^[ \t]{0,3}\[([^\]]+)\]:[ \t]*(?:<([^<>]*)>|(\S+))(?:[ \t]+"[^"]*")?[ \t]*$/gm;
const AUTOLINK_RE = /<(https?:\/\/[^<>\s]+)>/g;

// type → 产物 json 路径（见 readme-dev「产物存放约定」）
const EMBED_TYPES = { pkt: 'pkt', ensp: 'ensp', pptx: 'pptx' };
const EMBED_RE = /@\[(\w+)\]\(([^)\s]+)\)/g;

function extractRefs(md) {
  const refs = []; // { kind, target, line }
  const lineAt = (idx) => md.slice(0, idx).split('\n').length;
  const { masked, fences } = prepareScan(md);
  const pushEmbed = (embedType, target, line) => {
    if (EMBED_TYPES[embedType]) refs.push({ kind: '嵌入', embedType, target, line });
  };

  for (const m of masked.matchAll(INLINE_LINK_RE)) {
    const target = m[3] != null ? m[3] : m[4];
    // @[pkt](slug) 嵌入指令不是链接（由嵌入校验单独处理）
    if (m.index > 0 && masked[m.index - 1] === '@' && m[1] !== '!') continue;
    refs.push({ kind: m[1] === '!' ? '图片' : '链接', target, line: lineAt(m.index) });
  }
  for (const m of masked.matchAll(REF_DEF_RE)) {
    const target = m[2] != null ? m[2] : m[3];
    refs.push({ kind: '引用定义', target, line: lineAt(m.index) });
  }
  for (const m of masked.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    refs.push({ kind: 'HTML 链接', target: m[1] ?? m[2], line: lineAt(m.index) });
  }
  for (const m of masked.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    refs.push({ kind: 'HTML 图片', target: m[1] ?? m[2], line: lineAt(m.index) });
  }
  for (const m of masked.matchAll(AUTOLINK_RE)) {
    refs.push({ kind: '自动链接', target: m[1], line: lineAt(m.index) });
  }
  // 嵌入指令两种用法都渲染：正文裸写，或顶层 pptx/pkt/ensp 围栏内。
  // ````markdown 示例围栏里的语法演示不是顶层渲染围栏，不校验。
  for (const m of masked.matchAll(EMBED_RE)) {
    pushEmbed(m[1], m[2], lineAt(m.index));
  }
  for (const f of fences) {
    if (f.ignored || !EMBED_TYPES[f.lang]) continue;
    const bodyStart = f.offset + f.offsetInMatch;
    for (const m of f.body.matchAll(EMBED_RE)) {
      pushEmbed(m[1], m[2], lineAt(bodyStart + m.index));
    }
  }
  return refs;
}

// ============== 内链解析 ==============
function simplifyPath(p) {
  const result = [];
  for (const part of p.split('/')) {
    if (part === '..') result.pop();
    else if (part !== '.' && part !== '') result.push(part);
  }
  return result.join('/');
}

// 与运行时 interceptLinks 同语义：相对当前文档目录解析，`/` 开头为站点根
function resolveInternal(fromMd, raw) {
  let target = raw.trim();
  let anchor = '';
  const hashIdx = target.indexOf('#');
  if (hashIdx >= 0) { anchor = target.slice(hashIdx + 1); target = target.slice(0, hashIdx); }
  const qIdx = target.indexOf('?');
  if (qIdx >= 0) target = target.slice(0, qIdx);
  if (!target) return { file: '', anchor };

  const dir = path.posix.dirname(fromMd);
  const resolveOne = (t) => simplifyPath(
    t.startsWith('/') ? t.replace(/^\/+/, '') : (dir === '.' ? t : `${dir}/${t}`)
  );

  const resolved = resolveOne(target);
  // 解码前后任一变体命中即视为存在（仓库内中文文件名在链接里有编码与不编码两种写法）
  const variants = new Set([target]);
  try { variants.add(decodeURIComponent(target)); } catch { /* 非法转义序列则保留原样 */ }
  for (const v of variants) {
    const f = resolveOne(v);
    if (targetExists(f)) return { file: f, anchor, exists: true };
  }
  return { file: resolved, anchor, exists: false };
}

// ============== 外链 ==============
const UA = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'iris', 'config.json'), 'utf-8'));
    if (cfg.owner && cfg.repo) return `md-preview-link-check/1.0 (+https://github.com/${cfg.owner}/${cfg.repo})`;
  } catch { /* ignore */ }
  return 'md-preview-link-check/1.0';
})();

// 本站部署地址不做外链检查（检查的是仓库内源文件，部署产物滞后于被测分支）
const SITE_URL_PREFIX = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'iris', 'config.json'), 'utf-8'));
    if (cfg.owner && cfg.repo) return `https://${cfg.owner}.github.io/${cfg.repo}`;
  } catch { /* ignore */ }
  return null;
})();

function isOwnSite(url) {
  if (!SITE_URL_PREFIX) return false;
  return url === SITE_URL_PREFIX
    || url.startsWith(SITE_URL_PREFIX + '/')
    || url.startsWith(SITE_URL_PREFIX + '#')
    || url.startsWith(SITE_URL_PREFIX + '?');
}

const EXTERNAL_SKIP_RE = /^https?:\/\/([^/]*\.)?(localhost[:/]|127\.0\.0\.1[:/]|\[::1\]|example\.(com|org|net)|invalid\b)/i;

function isExternal(target) {
  const t = target.trim();
  if (/^(https?:)?\/\//.test(t)) {
    if (/^\/\//.test(t)) return 'https:' + t; // 协议相对，按 https 处理
    return t;
  }
  return null;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSample(urls, limit, seedStr) {
  if (!limit || urls.length <= limit) return urls;
  const rng = mulberry32(hashStr(seedStr));
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };
  // 按站点分桶后轮询抽取：避免抽样被同一图床的大量变体 URL（如 ?film1/?film2）占满
  const buckets = new Map();
  for (const u of urls) {
    let origin = '(other)';
    try { origin = new URL(u).origin; } catch { /* 非法 URL 已在提取侧兜底 */ }
    if (!buckets.has(origin)) buckets.set(origin, []);
    buckets.get(origin).push(u);
  }
  const groups = [...buckets.values()];
  for (const g of groups) shuffle(g);
  shuffle(groups);
  const out = [];
  while (out.length < limit && groups.length > 0) {
    for (let i = groups.length - 1; i >= 0 && out.length < limit; i--) {
      out.push(groups[i].shift());
      if (groups[i].length === 0) groups.splice(i, 1);
    }
  }
  return out.sort();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function probeOnce(method, url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), opt.timeout);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: '*/*', ...(method === 'GET' ? { range: 'bytes=0-0' } : {}) },
    });
    try { if (res.body && typeof res.body.cancel === 'function') { Promise.resolve(res.body.cancel()).catch(() => {}); } } catch { /* ignore */ }
    return res.status < 400 ? { ok: true, status: res.status } : { ok: false, status: res.status };
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? `超时（${opt.timeout}ms）` : (e.cause && e.cause.code) || e.message;
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// HEAD 优先；403/405/501/429/5xx/网络错误回退 GET；瞬时错误各重试一次
async function probeUrl(url) {
  const transient = (r) => !r.ok && (!r.status || r.status >= 500 || r.status === 429);
  const headBlocked = (r) => !r.ok && r.status && [403, 405, 501, 429].includes(r.status);
  async function attempt(method) {
    let r = await probeOnce(method, url);
    if (r.ok) return r;
    if (transient(r)) { await sleep(700); r = await probeOnce(method, url); }
    return r;
  }
  let r = await attempt('HEAD');
  if (r.ok) return r;
  if (headBlocked(r) || transient(r)) return attempt('GET');
  return r;
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function lane() {
    while (i < items.length) { const idx = i++; results[idx] = await worker(items[idx], idx); }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, lane));
  return results;
}

// ============== 主流程 ==============
async function main() {
  console.log('Markdown Preview 死链检查');
  collectUniverse();

  const mdFiles = [...FILES].filter(f => MD_FILE_RE.test(f) && !f.startsWith('.github/')).sort();
  console.log(`\n[1/3] 收集文档：${mdFiles.length} 个 .md，仓库文件 ${FILES.size} 个${opt.external ? '' : '（外链抽查已关闭）'}`);
  if (mdFiles.length === 0) { fail('未找到任何 .md 文件'); process.exit(1); }

  // ---- 内链全量 ----
  console.log('\n[2/3] 内链全量校验');
  let internalRefs = 0, internalOk = 0, anchorRefs = 0, embedRefs = 0;
  const broken = new Map(); // key → { file, line, kind, target, reason }（同文件同目标只报一次）
  const externalMap = new Map(); // url → [来源]

  for (const file of mdFiles) {
    let md;
    try { md = fs.readFileSync(path.join(ROOT, file), 'utf-8'); }
    catch (e) { fail(`${file} 读取失败：${e.message}`); continue; }

    for (const ref of extractRefs(md)) {
      const raw = (ref.target || '').trim();
      if (!raw) continue;
      if (/^(mailto:|javascript:|data:|tel:)/i.test(raw)) continue;

      const ext = isExternal(raw);
      if (ext) {
        if (!EXTERNAL_SKIP_RE.test(ext) && !isOwnSite(ext)) {
          if (!externalMap.has(ext)) externalMap.set(ext, []);
          externalMap.get(ext).push(`${file}:${ref.line}`);
        }
        continue;
      }

      internalRefs++;
      const loc = `${file}:${ref.line}`;

      if (raw.startsWith('#')) { // 同文件锚点
        if (!raw.slice(1)) continue; // `#` 空锚点：回到顶部
        anchorRefs++;
        const ids = getHeadingIds(file);
        if (ids.has(raw.slice(1))) { internalOk++; continue; }
        broken.set(`${file}#${raw}`, { file, line: ref.line, kind: ref.kind, target: raw, reason: '同文件锚点未命中任何标题' });
        continue;
      }

      if (ref.kind === '嵌入') {
        embedRefs++;
        // 运行时渲染器对 slug 做 decodeURIComponent（pptx.js / pkt-renderer.js），保持同语义
        const variants = new Set([ref.target]);
        try { variants.add(decodeURIComponent(ref.target)); } catch { /* 保留原样 */ }
        const found = [...variants].some(v =>
          targetExists(`iris/data/${EMBED_TYPES[ref.embedType]}/json/${v}.json`));
        if (found) { internalOk++; continue; }
        broken.set(`${file}:${ref.kind}:${ref.target}`, { file, line: ref.line, kind: ref.kind, target: `@[${ref.embedType}](${ref.target})`, reason: '嵌入产物不存在' });
        continue;
      }

      const r = resolveInternal(file, raw);
      if (r.exists) {
        internalOk++;
        if (r.anchor && MD_FILE_RE.test(r.file)) {
          anchorRefs++;
          const ids = getHeadingIds(r.file);
          if (!ids.has(r.anchor)) {
            broken.set(`${file}:${raw}`, { file, line: ref.line, kind: ref.kind, target: raw, reason: `锚点 #${r.anchor} 在 ${r.file} 中未命中任何标题` });
          }
        }
        continue;
      }
      broken.set(`${file}:${raw}`, { file, line: ref.line, kind: ref.kind, target: raw, reason: `目标不存在（解析为 ${r.file || '空'}）` });
    }
  }

  for (const { file, line, kind, target, reason } of broken.values()) {
    fail(`${file}:${line} ${kind}失效 → ${target}（${reason}）`);
  }
  if (broken.size === 0) {
    pass(`内链 ${internalRefs} 个引用全部有效` +
      (anchorRefs ? `（含 ${anchorRefs} 个锚点）` : '') +
      (embedRefs ? `（含 ${embedRefs} 个嵌入产物）` : ''));
  } else {
    console.log(`  共 ${internalRefs} 个内链引用，失效 ${broken.size} 处`);
  }

  // ---- 外链抽查 ----
  let externalFail = 0;
  if (opt.external) {
    console.log('\n[3/3] 外链抽查');
    const allUrls = [...externalMap.keys()].sort();
    const limit = opt.allExternal ? 0 : opt.externalLimit;
    const sample = pickSample(allUrls, limit, opt.seed);
    console.log(`  共 ${allUrls.length} 个外链，本次检查 ${sample.length} 个（seed=${opt.seed}${allUrls.length > sample.length ? '，按日轮换' : '，全量'}）`);

    const results = await runPool(sample, 4, async (url) => ({ url, r: await probeUrl(url) }));
    for (const { url, r } of results) {
      if (r.ok) { console.log(`  ✓ ${url} (${r.status})`); continue; }
      const detail = r.error ? r.error : `HTTP ${r.status}`;
      const where = (externalMap.get(url) || []).slice(0, 3).join(', ');
      if (opt.strictExternal) {
        fail(`${url}（${detail}；来源：${where}）`);
      } else {
        warn(`${url}（${detail}；来源：${where}）——仅告警，--strict-external 可升级为失败`);
      }
      externalFail++;
    }
    if (externalFail === 0) pass(`抽查的 ${sample.length} 个外链全部可达`);
  }

  // ---- 汇总 ----
  console.log('');
  const externalFatal = opt.strictExternal ? externalFail : 0;
  if (failures > 0 || externalFatal > 0) {
    const parts = [];
    if (broken.size) parts.push(`内链 ${broken.size} 个失效`);
    if (externalFail) parts.push(`外链 ${externalFail} 个失败${opt.strictExternal ? '' : '（仅告警）'}`);
    console.error(`✗ 死链检查未通过：${parts.join('，')}`);
    process.exit(1);
  }
  console.log('✓ 死链检查通过');
}

main().catch(e => { console.error('死链检查异常退出：', e); process.exit(1); });
