/**
 * SQL DDL / DBML → ER 图渲染器（TOOL-3）
 *
 * Markdown 语法：
 *   ```sql ddl      （或 ```ddl / ```erd）
 *   CREATE TABLE users (
 *     id INT PRIMARY KEY,
 *     name VARCHAR(50) NOT NULL
 *   );
 *   ```
 *   ```dbml
 *   Table users {
 *     id int [pk]
 *     name varchar
 *   }
 *   Ref: posts.user_id > users.id
 *   ```
 *
 * 解析 CREATE TABLE 的列、主键与外键（或 DBML 的 Table / Ref），生成
 * Mermaid erDiagram 源码，再交给 mermaid 渲染器出图（本渲染器注册在
 * mermaid 之前，转换后的 mermaid 代码块会被随后的 mermaid 渲染器接管）。
 * 解析不出任何表时保留原代码块（降级为普通高亮）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // 目标语言标记（```sql ddl → data-lang="sql ddl"）
  const TARGET_LANGS = ['erd', 'ddl', 'sql ddl', 'dbml'];

  // 深度感知地按顶层逗号切分（忽略括号内与引号内的逗号）
  function splitTopLevel(body) {
    const parts = [];
    let depth = 0;
    let cur = '';
    let quote = null;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (quote) {
        cur += ch;
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts.map(s => s.trim()).filter(Boolean);
  }

  function cleanIdent(s) {
    return String(s || '').trim().replace(/^["`\[]/, '').replace(/["`\]]$/, '');
  }

  // Mermaid 实体 / 属性名需为标识符：非字母数字下划线统一替换
  function ident(s) {
    const v = cleanIdent(s).split('.').pop();
    return v.replace(/[^\w]/g, '_') || 'T';
  }

  // 类型归一为单个标识符（decimal(10,2) → decimal）
  function typeToken(t) {
    const m = String(t || '').match(/[A-Za-z_][\w]*/);
    return m ? m[0].toLowerCase() : 'text';
  }

  function stripConstraintPrefix(part) {
    // 去掉 "CONSTRAINT name" 前缀，便于识别 PK / FK / UNIQUE
    return part.replace(/^constraint\s+["`\[]?[\w$]+["`\]]?\s+/i, '');
  }

  function parseDdl(sql) {
    const tables = [];
    const rels = [];
    // 匹配 CREATE TABLE 名称与开括号，再用括号配对扫描出表体
    // （不能用单个正则取表体：DECIMAL(10,2) 之类嵌套括号会让非贪婪匹配提前截断）
    const createRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?["`\[]?([\w$.]+)["`\]]?\s*\(/gi;
    let m;
    while ((m = createRe.exec(sql)) !== null) {
      const parenStart = createRe.lastIndex - 1; // '(' 的下标
      let depth = 0;
      let quote = null;
      let end = -1;
      for (let i = parenStart; i < sql.length; i++) {
        const ch = sql[i];
        if (quote) { if (ch === quote) quote = null; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end < 0) continue;
      const body = sql.slice(parenStart + 1, end);
      createRe.lastIndex = end + 1;

      const tname = ident(m[1]);
      const cols = [];
      const pkCols = new Set();
      splitTopLevel(body).forEach(rawPart => {
        const part = stripConstraintPrefix(rawPart);
        let mm;
        if ((mm = part.match(/^primary\s+key\s*\(([^)]*)\)/i))) {
          mm[1].split(',').forEach(c => pkCols.add(cleanIdent(c)));
          return;
        }
        if (/^unique\s*(?:key)?\s*\(/i.test(part)) return; // 唯一约束忽略
        if ((mm = part.match(/^foreign\s+key\s*\(([^)]*)\)\s*references\s+["`\[]?([\w$.]+)["`\]]?\s*\(([^)]*)\)/i))) {
          const fromCol = cleanIdent(mm[1].split(',')[0]);
          const refTable = ident(mm[2]);
          const refCol = cleanIdent((mm[3] || '').split(',')[0]);
          rels.push({ from: tname, to: refTable, fromCol, refCol });
          return;
        }
        // 普通列定义：name TYPE ...
        if ((mm = part.match(/^["`\[]?([\w$]+)["`\]]?\s+([A-Za-z][\w]*(?:\s*\([^)]*\))?)([\s\S]*)$/))) {
          const name = cleanIdent(mm[1]);
          const type = typeToken(mm[2]);
          const rest = (mm[3] || '');
          const isPk = /primary\s+key/i.test(rest) || /primary\s+key/i.test(part);
          cols.push({ name, type, pk: isPk });
        }
      });
      // 汇总主键
      cols.forEach(c => { if (pkCols.has(c.name)) c.pk = true; });
      tables.push({ name: tname, cols });
    }
    if (tables.length === 0) return null;
    return { tables, rels };
  }

  // ============== DBML ==============

  // 去掉 // 行注释与 /* */ 块注释（保留字符串里的内容）
  function stripDbmlComments(src) {
    let out = '';
    let quote = null;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const nx = src[i + 1];
      if (quote) {
        out += ch;
        if (ch === quote && src[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
      if (ch === '/' && nx === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        out += '\n';
        continue;
      }
      if (ch === '/' && nx === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 1;
        continue;
      }
      out += ch;
    }
    return out;
  }

  // 从 openIdx（'{' 的下标）起找配对的 '}'，跳过字符串内的括号
  function matchBrace(src, openIdx) {
    let depth = 0;
    let quote = null;
    for (let i = openIdx; i < src.length; i++) {
      const ch = src[i];
      if (quote) { if (ch === quote && src[i - 1] !== '\\') quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function unquoteDbml(s) {
    const v = String(s || '').trim();
    return v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }

  // 按 . 切分限定名，忽略引号内的点
  function splitQualified(raw) {
    const parts = [];
    let cur = '';
    let quote = null;
    const src = String(raw || '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        cur += ch;
        if (ch === quote && src[i - 1] !== '\\') quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '.') { parts.push(unquoteDbml(cur)); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) parts.push(unquoteDbml(cur));
    return parts.map(p => p.trim()).filter(Boolean);
  }

  function refTargetOf(raw) {
    const parts = splitQualified(raw);
    if (parts.length < 2) return null;
    return { table: parts[parts.length - 2], col: parts[parts.length - 1] };
  }

  // 解析 [pk, ref: > users.id, note: '...'] 设置串
  function dbmlSettings(settings) {
    const out = { pk: false, refs: [] };
    if (!settings) return out;
    const body = settings.replace(/^\[/, '').replace(/\]$/, '');
    const parts = splitTopLevel(body);
    parts.forEach(part => {
      const p = part.trim();
      if (/^(pk|primary\s+key)$/i.test(p)) out.pk = true;
      const m = /^ref\s*:\s*(<>|>|<|-)\s*(.+)$/i.exec(p);
      if (m) out.refs.push({ kind: m[1], target: m[2].trim() });
    });
    return out;
  }

  const QID = '(?:"(?:[^"\\\\]|\\\\.)*"|[\\w$]+)';
  const FULL_NAME = QID + '(?:\\s*\\.\\s*' + QID + ')*';

  function parseDbml(text) {
    const src = stripDbmlComments(String(text || ''));
    const tables = [];
    const rels = [];
    const aliasMap = new Map();

    const tableRe = new RegExp('\\bTable\\s+(' + FULL_NAME + ')(?:\\s+as\\s+([\\w$]+))?\\s*\\{', 'g');
    let m;
    while ((m = tableRe.exec(src)) !== null) {
      const parts = splitQualified(m[1]);
      const name = ident(parts[parts.length - 1] || '');
      const open = tableRe.lastIndex - 1;
      const close = matchBrace(src, open);
      if (close < 0) break;
      tableRe.lastIndex = close + 1;
      if (m[2]) aliasMap.set(m[2], name);

      const body = src.slice(open + 1, close);
      const cols = [];
      let inIndexes = 0;
      const lines = body.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (/^indexes\s*\{/i.test(line)) { inIndexes++; continue; }
        if (inIndexes) {
          if (line.indexOf('{') !== -1) inIndexes++;
          if (line.indexOf('}') !== -1) inIndexes--;
          continue;
        }
        if (/^(Note|TableGroup|Project)\b/i.test(line)) continue;
        if (/^\}/.test(line)) continue;

        const mm = /^("(?:[^"\\]|\\.)*"|[\w$]+)\s+("(?:[^"\\]|\\.)*"|[\w$]+(?:\([^)]*\))?(?:\[\])?)\s*(\[[\s\S]*\])?$/.exec(line);
        if (!mm) continue;
        const colName = unquoteDbml(mm[1]);
        const type = typeToken(unquoteDbml(mm[2]));
        const settings = dbmlSettings(mm[3]);
        cols.push({ name: colName, type, pk: settings.pk });
        settings.refs.forEach(r => {
          const target = refTargetOf(r.target);
          if (!target) return;
          rels.push({
            from: name,
            to: aliasMap.get(target.table) || ident(target.table),
            fromCol: colName,
            refCol: target.col,
            kind: r.kind
          });
        });
      }
      if (cols.length) tables.push({ name, cols });
    }

    // 顶层 Ref 声明：Ref [name]: A.x > B.y
    const refRe = new RegExp('\\bRef(?:\\s+[^:\\n]+)?\\s*:\\s*(' + FULL_NAME + ')\\s*(<>|>|<|-)\\s*(' + FULL_NAME + ')', 'g');
    let rm;
    while ((rm = refRe.exec(src)) !== null) {
      const left = refTargetOf(rm[1]);
      const right = refTargetOf(rm[3]);
      if (!left || !right) continue;
      rels.push({
        from: aliasMap.get(left.table) || ident(left.table),
        to: aliasMap.get(right.table) || ident(right.table),
        fromCol: left.col,
        refCol: right.col,
        kind: rm[2]
      });
    }

    if (!tables.length) return null;
    const known = new Set(tables.map(t => t.name));
    return {
      tables,
      rels: rels.filter(r => known.has(r.from) && known.has(r.to))
    };
  }

  // DBML 关系方向 → Mermaid 基数
  function relLine(r) {
    const label = String(r.fromCol || 'rel').replace(/"/g, '');
    switch (r.kind) {
      case '<': return '    ' + r.from + ' ||--o{ ' + r.to + ' : "' + label + '"';
      case '-': return '    ' + r.from + ' ||--|| ' + r.to + ' : "' + label + '"';
      case '<>': return '    ' + r.from + ' }o--o{ ' + r.to + ' : "' + label + '"';
      default: return '    ' + r.to + ' ||--o{ ' + r.from + ' : "' + label + '"';
    }
  }

  function buildMermaid(model) {
    const lines = ['erDiagram'];
    model.tables.forEach(t => {
      if (!t.cols.length) return;
      lines.push('    ' + t.name + ' {');
      t.cols.forEach(c => {
        const key = c.pk ? ' PK' : '';
        lines.push('        ' + c.type + ' ' + ident(c.name) + key);
      });
      lines.push('    }');
    });
    model.rels.forEach(r => {
      lines.push(relLine(r));
    });
    return lines.join('\n');
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const selector = TARGET_LANGS.map(l => 'pre.code-block[data-lang="' + l + '"]').join(', ');
    const blocks = scope.querySelectorAll(selector);
    blocks.forEach(pre => {
      if (pre.dataset.erdDone) return;
      pre.dataset.erdDone = '1';
      const code = pre.querySelector('code');
      if (!code) return;
      const lang = String(pre.dataset.lang || '').toLowerCase();
      const model = lang.indexOf('dbml') !== -1
        ? parseDbml(code.textContent || '')
        : parseDdl(code.textContent || '');
      if (!model) return; // 解析失败：保留原代码块
      const diagram = buildMermaid(model);

      const mermaidPre = document.createElement('pre');
      mermaidPre.className = 'code-block';
      mermaidPre.dataset.lang = 'mermaid';
      const mermaidCode = document.createElement('code');
      mermaidCode.className = 'language-mermaid';
      mermaidCode.textContent = diagram;
      mermaidPre.appendChild(mermaidCode);

      if (pre.parentNode) pre.parentNode.replaceChild(mermaidPre, pre);
    });
  }

  window.MarkdownPreview.renderers.sqlerd = { render };

  // 供 Node 冒烟测试直接验证解析逻辑
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseDdl, parseDbml, buildMermaid, splitTopLevel };
  }
})();
