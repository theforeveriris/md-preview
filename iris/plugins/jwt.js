// JWT 解析插件（TOOL-4）
// ```jwt
// eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123
// ```
export default {
  name: 'jwt',
  description: 'JWT header / payload 解码',
  priority: 5,

  render(code, container) {
    const esc = window.MarkdownPreview.mdRender.escapeHtml;
    const token = String(code).trim().split(/\s+/)[0];
    const parts = token.split('.');
    container.className = 'devtool devtool-jwt';

    if (parts.length < 2) {
      container.innerHTML = '<div class="devtool-error">不是有效的 JWT（应为 header.payload.signature）</div>';
      return;
    }

    function decode(seg) {
      try {
        let s = seg.replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        const json = decodeURIComponent(escape(atob(s)));
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    }

    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    if (!header && !payload) {
      container.innerHTML = '<div class="devtool-error">无法解码 JWT 内容</div>';
      return;
    }

    const timeKeys = ['exp', 'iat', 'nbf'];
    const annotate = obj => {
      if (!obj) return 'null';
      const clone = {};
      Object.keys(obj).forEach(k => {
        clone[k] = obj[k];
        if (timeKeys.indexOf(k) >= 0 && typeof obj[k] === 'number') {
          clone[k + ' (time)'] = new Date(obj[k] * 1000).toISOString();
        }
      });
      return JSON.stringify(clone, null, 2);
    };

    const expired = payload && typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    container.innerHTML =
      (expired ? '<div class="devtool-jwt-expired">⚠ 该 JWT 已过期（exp 早于当前时间）</div>' : '') +
      `<div class="devtool-jwt-block"><div class="devtool-jwt-label">Header</div><pre class="devtool-json">${esc(annotate(header))}</pre></div>` +
      `<div class="devtool-jwt-block"><div class="devtool-jwt-label">Payload</div><pre class="devtool-json">${esc(annotate(payload))}</pre></div>`;

    const codes = container.querySelectorAll('code');
    codes.forEach(c => { if (typeof window.hljs !== 'undefined') { try { window.hljs.highlightElement(c); } catch (e) {} } });
  }
};
