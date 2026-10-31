/**
 * SQL DDL → ER 图渲染器（TOOL-3）
 *
 * Markdown 语法：
 *   ```sql ddl      （或 ```ddl / ```erd）
 *   CREATE TABLE users (
 *     id INT PRIMARY KEY,
 *     name VARCHAR(50) NOT NULL
 *   );
 *   CREATE TABLE orders (
 *     id INT PRIMARY KEY,
 *     user_id INT,
 *     FOREIGN KEY (user_id) REFERENCES users(id)
 *   );
 *   ```
 *
 * 解析 CREATE TABLE 的列、主键与外键，生成 Mermaid erDiagram 源码，
 * 再交给 mermaid 渲染器出图（本渲染器注册在 mermaid 之前，转换后的
 * mermaid 代码块会被随后的 mermaid 渲染器接管）。
 * 解析不出任何表时保留原代码块（降级为普通 SQL 高亮）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // 目标语言标记（```sql ddl → data-lang="sql ddl"）
  const TARGET_LANGS = ['erd', 'ddl', 'sql ddl'];

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
      const label = (r.fromCol || 'fk').replace(/"/g, '');
      lines.push('    ' + r.to + ' ||--o{ ' + r.from + ' : "' + label + '"');
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
      const model = parseDdl(code.textContent || '');
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
    module.exports = { parseDdl, buildMermaid, splitTopLevel };
  }
})();
