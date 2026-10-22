/**
 * OpenAPI / Swagger 交互文档（TOOL-1）
 *
 * Markdown 语法（```openapi 或 ```swagger，内容为 JSON 或 YAML）：
 *   ```openapi
 *   openapi: 3.0.0
 *   info: { title: Demo API, version: "1.0" }
 *   servers: [{ url: https://httpbin.org }]
 *   paths:
 *     /get:
 *       get:
 *         summary: 测试 GET
 *         parameters:
 *           - { name: foo, in: query, schema: { type: string } }
 *         responses: { "200": { description: OK } }
 *   ```
 *
 * 渲染信息头 + 按路径/方法分组的接口卡片，每个接口带「试一下」表单：
 * 填参后点击发送，展示状态码、耗时与响应体。YAML 解析依赖按需加载的 js-yaml。
 * 跨域（CORS）由目标服务决定，失败时给出可读提示。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function resolveRoot(root) {
    return window.MarkdownPreview.mdRender.resolveRoot(root);
  }

  async function parseSpec(text) {
    const trimmed = String(text || '').trim();
    try { return JSON.parse(trimmed); } catch (e) { /* 尝试 YAML */ }
    try {
      if (typeof window.jsyaml === 'undefined') {
        await window.MarkdownPreview.loadScript('iris/vendor/js-yaml/js-yaml.min.js');
      }
      if (typeof window.jsyaml !== 'undefined') return window.jsyaml.load(trimmed);
    } catch (e) { /* ignore */ }
    return null;
  }

  function serverBase(spec) {
    if (Array.isArray(spec.servers) && spec.servers[0] && spec.servers[0].url) return spec.servers[0].url;
    if (spec.host) {
      const scheme = (spec.schemes && spec.schemes[0]) || 'https';
      return scheme + '://' + spec.host + (spec.basePath || '');
    }
    return '';
  }

  function exampleFromSchema(schema, defs) {
    if (!schema) return undefined;
    if (schema.example !== undefined) return schema.example;
    if (schema.$ref) {
      const name = schema.$ref.split('/').pop();
      return exampleFromSchema(defs && defs[name], defs);
    }
    switch (schema.type) {
      case 'object': {
        const out = {};
        Object.keys(schema.properties || {}).forEach(k => { out[k] = exampleFromSchema(schema.properties[k], defs); });
        return out;
      }
      case 'array': return [exampleFromSchema(schema.items, defs)];
      case 'integer': case 'number': return 0;
      case 'boolean': return false;
      default: return '';
    }
  }

  function renderOperation(op, method, path, base, defs) {
    const id = 'op-' + Math.random().toString(36).slice(2, 9);
    const summary = op.summary || op.description || '';
    const params = (op.parameters || []).concat([]);
    const rows = params.map(p => `
      <tr>
        <td><code>${esc(p.name)}</code></td>
        <td>${esc(p.in || '')}</td>
        <td>${esc((p.schema && p.schema.type) || p.type || '')}</td>
        <td>${p.required ? '✔' : ''}</td>
        <td>${esc(p.description || '')}</td>
      </tr>`).join('');

    // 请求体示例
    let bodyExample = '';
    if (op.requestBody && op.requestBody.content) {
      const ct = Object.keys(op.requestBody.content)[0];
      const media = op.requestBody.content[ct];
      const ex = (media.example !== undefined) ? media.example : exampleFromSchema(media.schema, defs);
      if (ex !== undefined) bodyExample = JSON.stringify(ex, null, 2);
    }

    // 试一下表单
    const inputs = params.map(p => {
      const label = esc(p.in) + ' · ' + esc(p.name) + (p.required ? ' *' : '');
      return `<label class="openapi-field"><span>${label}</span>
        <input type="text" class="devtool-input" data-in="${esc(p.in || '')}" data-name="${esc(p.name)}" data-param="1"></label>`;
    }).join('');

    const responses = Object.keys(op.responses || {}).map(code =>
      `<li><code>${esc(code)}</code> ${esc((op.responses[code] || {}).description || '')}</li>`
    ).join('');

    return `
      <div class="openapi-op" id="${id}">
        <div class="openapi-op-head">
          <span class="openapi-method openapi-method-${esc(method)}">${esc(method.toUpperCase())}</span>
          <code class="openapi-path">${esc(path)}</code>
          <span class="openapi-summary">${esc(summary)}</span>
          <button type="button" class="download-btn openapi-try-toggle">${esc(t('openapi.try', '试一下'))}</button>
        </div>
        ${rows ? `<table class="openapi-params"><thead><tr><th>名称</th><th>位置</th><th>类型</th><th>必填</th><th>说明</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
        <details class="openapi-try" hidden>
          <div class="openapi-try-form">${inputs}</div>
          ${bodyExample ? `<textarea class="devtool-input openapi-body" rows="4" placeholder="请求体 (JSON)">${esc(bodyExample)}</textarea>` : ''}
          <button type="button" class="download-btn openapi-send">${esc(t('http.send', '发送'))}</button>
          <span class="openapi-status" role="status"></span>
          <div class="openapi-response" hidden></div>
        </details>
        ${responses ? `<details class="openapi-responses"><summary>${esc(t('openapi.responses', '响应'))}</summary><ul>${responses}</ul></details>` : ''}
      </div>`;
  }

  function wireOperation(scope, base) {
    scope.querySelectorAll('.openapi-op').forEach(opEl => {
      const methodEl = opEl.querySelector('.openapi-method');
      const pathEl = opEl.querySelector('.openapi-path');
      if (!methodEl || !pathEl) return;
      const method = methodEl.textContent.trim().toUpperCase();
      const path = pathEl.textContent.trim();
      const tryBox = opEl.querySelector('.openapi-try');
      const toggle = opEl.querySelector('.openapi-try-toggle');
      const send = opEl.querySelector('.openapi-send');
      const statusEl = opEl.querySelector('.openapi-status');
      const respEl = opEl.querySelector('.openapi-response');

      toggle?.addEventListener('click', () => { if (tryBox) tryBox.hidden = !tryBox.hidden; });
      send?.addEventListener('click', async () => {
        let url = (base || '') + path;
        const headers = {};
        opEl.querySelectorAll('[data-param]').forEach(inp => {
          const val = inp.value.trim();
          if (!val) return;
          const where = inp.dataset.in;
          const name = inp.dataset.name;
          if (where === 'path') url = url.replace('{' + name + '}', encodeURIComponent(val));
          else if (where === 'query') url += (url.indexOf('?') >= 0 ? '&' : '?') + encodeURIComponent(name) + '=' + encodeURIComponent(val);
          else if (where === 'header') headers[name] = val;
        });
        const bodyEl = opEl.querySelector('.openapi-body');
        const opts = { method, headers };
        if (['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(method) >= 0 && bodyEl && bodyEl.value.trim()) {
          opts.body = bodyEl.value.trim();
          if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
        }
        statusEl.textContent = t('http.sending', '请求中…');
        respEl.hidden = false;
        respEl.innerHTML = '';
        const t0 = performance.now();
        try {
          const resp = await fetch(url, opts);
          const ms = Math.round(performance.now() - t0);
          const text = await resp.text();
          statusEl.textContent = `${resp.status} ${resp.statusText} · ${ms}ms`;
          let pretty = text;
          try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { /* keep */ }
          respEl.innerHTML = `<pre class="code-block"><code class="language-json">${esc(pretty)}</code></pre>`;
          const c = respEl.querySelector('code');
          if (c && typeof window.hljs !== 'undefined') { try { window.hljs.highlightElement(c); } catch (e) {} }
        } catch (err) {
          statusEl.textContent = t('http.failed', '请求失败');
          respEl.innerHTML = `<div class="http-error">${esc(t('http.cors', '请求失败（可能是跨域限制或网络问题）'))}: ${esc(err && err.message)}</div>`;
        }
      });
    });
  }

  async function render(root) {
    const scope = resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang="openapi"], pre.code-block[data-lang="swagger"]');
    for (const pre of Array.from(blocks)) {
      if (pre.dataset.openapiDone) continue;
      pre.dataset.openapiDone = '1';
      const code = pre.querySelector('code');
      const spec = await parseSpec(code ? code.textContent : '');
      if (!spec || !spec.paths) continue; // 解析失败：保留原代码块
      const defs = (spec.components && spec.components.schemas) || spec.definitions || {};
      const base = serverBase(spec);
      const info = spec.info || {};
      const holder = document.createElement('div');
      holder.className = 'openapi-doc';
      let opsHtml = '';
      Object.keys(spec.paths).forEach(p => {
        const item = spec.paths[p] || {};
        ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].forEach(m => {
          if (item[m]) opsHtml += renderOperation(item[m], m, p, base, defs);
        });
      });
      holder.innerHTML =
        `<div class="openapi-title">${esc(info.title || 'API')} <span class="openapi-version">${esc(info.version || '')}</span></div>` +
        (base ? `<div class="openapi-base">${esc(base)}</div>` : '') +
        opsHtml;
      pre.parentNode.replaceChild(holder, pre);
      wireOperation(holder, base);
    }
  }

  window.MarkdownPreview.renderers.openapi = { render };
})();
