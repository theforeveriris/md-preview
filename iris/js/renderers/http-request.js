/**
 * HTTP 实时请求块（TOOL-2）
 *
 * Markdown 语法（```http 代码块）：
 *   ```http
 *   GET https://httpbin.org/json
 *   Accept: application/json
 *
 *   （可选请求体，用于 POST/PUT/PATCH）
 *   {"hello":"world"}
 *   ```
 *
 * 渲染为请求卡片：方法 + URL + 「发送」按钮。点击后才发请求（不自动执行），
 * 展示状态码、耗时、响应头与响应体（JSON 自动格式化并高亮）。
 * 浏览器跨域（CORS）限制由目标服务决定，失败时给出可读提示。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;
  const ALLOWED = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

  function parseRequest(code) {
    const lines = String(code || '').replace(/\r\n?/g, '\n').split('\n');
    const first = (lines[0] || '').trim();
    const m = first.match(/^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\s+(\S+)/i);
    if (!m) return null;
    const method = m[1].toUpperCase();
    if (ALLOWED.indexOf(method) === -1) return null;
    const url = m[2];
    const headers = {};
    let i = 1;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) { i++; break; }
      const c = line.indexOf(':');
      if (c > 0) headers[line.slice(0, c).trim()] = line.slice(c + 1).trim();
    }
    const body = lines.slice(i).join('\n').trim();
    return { method, url, headers, body };
  }

  function prettyBody(text) {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch (e) { return text; }
  }

  function buildWidget(pre, spec) {
    const widget = document.createElement('div');
    widget.className = 'http-request';
    widget.innerHTML = `
      <div class="http-request-bar">
        <span class="http-method http-method-${esc(spec.method.toLowerCase())}">${esc(spec.method)}</span>
        <span class="http-url" title="${esc(spec.url)}">${esc(spec.url)}</span>
        <span class="http-status" role="status"></span>
        <button type="button" class="download-btn http-send">${esc(t('http.send', '发送'))}</button>
      </div>
      <div class="http-response" hidden></div>
    `;

    const statusEl = widget.querySelector('.http-status');
    const respEl = widget.querySelector('.http-response');
    const sendBtn = widget.querySelector('.http-send');

    sendBtn.addEventListener('click', async () => {
      sendBtn.disabled = true;
      statusEl.textContent = t('http.sending', '请求中…');
      respEl.hidden = false;
      respEl.innerHTML = '';
      const t0 = performance.now();
      try {
        const opts = { method: spec.method, headers: spec.headers };
        if (spec.method !== 'GET' && spec.method !== 'HEAD' && spec.body) opts.body = spec.body;
        const resp = await fetch(spec.url, opts);
        const ms = Math.round(performance.now() - t0);
        const text = await resp.text();
        statusEl.textContent = `${resp.status} ${resp.statusText} · ${ms}ms`;
        statusEl.classList.toggle('is-ok', resp.ok);
        statusEl.classList.toggle('is-bad', !resp.ok);

        const hdrs = [];
        resp.headers.forEach((v, k) => hdrs.push(`${k}: ${v}`));
        const body = prettyBody(text);
        respEl.innerHTML = `
          <div class="http-resp-headers" title="${esc(hdrs.join('\n'))}">${esc(hdrs.join('\n'))}</div>
          <pre class="code-block"><code class="language-json">${esc(body)}</code></pre>
        `;
        const codeEl = respEl.querySelector('code');
        if (codeEl && typeof window.hljs !== 'undefined') {
          try { window.hljs.highlightElement(codeEl); } catch (e) { /* ignore */ }
        }
      } catch (err) {
        statusEl.textContent = t('http.failed', '请求失败');
        statusEl.classList.add('is-bad');
        respEl.innerHTML = `<div class="http-error">${esc(t('http.cors', '请求失败（可能是跨域限制或网络问题）'))}: ${esc(err && err.message)}</div>`;
      } finally {
        sendBtn.disabled = false;
      }
    });

    return widget;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    const blocks = scope.querySelectorAll('pre.code-block[data-lang="http"]');
    blocks.forEach(pre => {
      if (pre.dataset.httpDone) return;
      pre.dataset.httpDone = '1';
      const code = pre.querySelector('code');
      const spec = parseRequest(code ? code.textContent : '');
      if (!spec) return; // 解析失败：保留原代码块
      pre.parentNode.replaceChild(buildWidget(pre, spec), pre);
    });
  }

  window.MarkdownPreview.renderers.httprequest = { render };
})();
