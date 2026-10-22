#!/usr/bin/env node
/**
 * Markdown 链接解析公共库（构建期，纯函数）
 *
 * 从 link-check.js 抽出，供以下脚本共用，避免多份副本漂移：
 *   - iris/scripts/link-check.js   死链检查（CI 门禁）
 *   - iris/scripts/build-links.js  图谱 / 反向链接数据产物
 *
 * 只包含解析原语；文件系统读写、抽样与探测等带副作用的部分留在各自脚本内。
 * 其中 slugify / headingSourceToText 与运行时 iris/js/markdown.js 的标题 id 规则
 * 保持逐字一致（markdown.js 以渲染后 DOM 文本生成 id）。
 */
'use strict';

const path = require('path');

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

// 标题行 → 运行时 heading.textContent 的近似（markdown.js 以渲染后 DOM 文本生成 id）
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

// 与 markdown.js 的 slug 规则逐字一致
function slugify(text) {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
}

// 给定 Markdown 文本，返回全部标题 id（供锚点校验 / 图谱按标题建边）
function extractHeadingIds(md) {
  const ids = new Set();
  const re = /^(#{1,6})[ \t]+(.+?)[ \t]*$/gm;
  let m;
  while ((m = re.exec(stripForHeadings(md))) !== null) {
    ids.add(slugify(headingSourceToText(m[2])));
  }
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
  const refs = []; // { kind, target, line, embedType? }
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
    const label = m[1];
    // 脚注定义 [^id]: 文本 长得像引用定义，但它是 marked-footnote 的语法，不是链接
    if (label.charAt(0) === '^') continue;
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

// 去掉 query / hash，得到纯路径部分（`#anchor` 单独返回）
function splitTargetUrl(raw) {
  let target = String(raw == null ? '' : raw).trim();
  let anchor = '';
  const hashIdx = target.indexOf('#');
  if (hashIdx >= 0) { anchor = target.slice(hashIdx + 1); target = target.slice(0, hashIdx); }
  const qIdx = target.indexOf('?');
  if (qIdx >= 0) target = target.slice(0, qIdx);
  return { target, anchor };
}

// 与运行时 interceptLinks 同语义：相对当前文档目录解析，`/` 开头为站点根；
// targetExists 由调用方注入（决定「仓库内是否存在该路径」的口径）
function resolveInternal(fromMd, raw, targetExists) {
  const { target, anchor } = splitTargetUrl(raw);
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

// 判断是否为外链（返回规范化 URL 或 null）
function externalUrlOf(target) {
  const t = String(target == null ? '' : target).trim();
  if (/^(https?:)?\/\//.test(t)) {
    if (/^\/\//.test(t)) return 'https:' + t; // 协议相对，按 https 处理
    return t;
  }
  return null;
}

// ============== 图表锚点（FIGURES-1） ==============
// 运行时由 iris/js/figures.js 生成两类锚点，死链检查必须认得，否则交叉引用会被误判死链：
//   1. 别名锚点 `#fig:topology` / `#tbl:qos` —— 来自紧邻上一行的 HTML 注释 `<!-- #fig:xxx -->`
//   2. 数字锚点 `#fig-3` / `#tbl-2`   —— 按文档顺序连续编号
// 这里是**源码级镜像**（运行时的 classify 在 DOM 上做）：只统计三类候选，
// 与 figures.js 的规则保持一致。规则若变动，两处需同步。
const FIGURE_FENCE_LANGS = { mermaid: 1, plantuml: 1, apexcharts: 1 };
// 别名写在紧邻上一行的 HTML 注释里：<!-- #fig:topology 可选标题 -->
const FIGURE_ALIAS_RE = /<!--\s*#(fig|tbl):([A-Za-z0-9_\-.]+)(?:\s[^>]*)?-->/;

function extractFigureAnchors(md) {
  const anchors = new Set();
  const counts = { fig: 0, tbl: 0 };
  const { masked, fences } = prepareScan(md);

  // 1) 围栏图表（mermaid / plantuml / apexcharts）
  const fenceLangs = new Map();
  for (const f of fences) {
    fenceLangs.set(f.offset, f.lang);
    if (FIGURE_FENCE_LANGS[f.lang]) counts.fig++;
  }

  // 2) 表格：连续 `|` 开头的行块（GFM 表格；表头 + 分隔行 + 若干数据行）
  const lines = masked.split('\n');
  let inTable = false;
  for (const line of lines) {
    const isRow = /^\s{0,3}\|/.test(line);
    if (isRow && !inTable) { counts.tbl++; inTable = true; }
    else if (!isRow) inTable = false;
  }

  // 3) 独立成段的图片：段落仅含一张图片、且无其它文字
  masked.split(/\n{2,}/).forEach(block => {
    const trimmed = block.trim();
    if (!trimmed) return;
    const imgs = trimmed.match(/!\[[^\]]*\]\([^)]*\)/g) || [];
    if (imgs.length !== 1) return;
    const rest = trimmed.replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
    if (!rest) counts.fig++;
  });

  // 4) 别名注释：扫描原文（prepareScan 已把注释掩掉，这里看原始文本）
  md.split('\n').forEach(line => {
    const m = line.match(FIGURE_ALIAS_RE);
    if (!m) return;
    anchors.add(`${m[1]}:${m[2]}`);
  });

  for (let i = 1; i <= counts.fig; i++) anchors.add(`fig-${i}`);
  for (let i = 1; i <= counts.tbl; i++) anchors.add(`tbl-${i}`);
  return anchors;
}

// 是否为图表锚点命名空间：仅接受源码镜像能证明存在的两种形态
//   - 别名：fig:xxx / tbl:xxx（必须能在 extractFigureAnchors 中命中）
//   - 数字：fig-N / tbl-N（N 必须落在该文档实际编号范围内）
function isFigureAnchor(anchor, knownAnchors) {
  const a = String(anchor || '');
  if (!/^(fig|tbl)(:|-\d+$)/.test(a)) return false;
  if (knownAnchors && knownAnchors.has(a)) return true;
  return false;
}

module.exports = {
  FRONTMATTER_RE,
  HTML_COMMENT_RE,
  MD_FILE_RE,
  TOP_FENCE_RE,
  IGNORE_DIRECTIVE_AT_END_RE,
  prepareScan,
  stripForHeadings,
  headingSourceToText,
  slugify,
  extractHeadingIds,
  extractRefs,
  simplifyPath,
  splitTargetUrl,
  resolveInternal,
  externalUrlOf,
  extractFigureAnchors,
  isFigureAnchor,
  EMBED_TYPES,
  EMBED_RE,
};
