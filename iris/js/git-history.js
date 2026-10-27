/**
 * Git 信息前台化（GIT-1 单篇历史 / blame，GIT-3 文档变更订阅）
 *
 * 通过 GitHub REST API 拉取当前文档的提交历史，展示「谁在何时改了什么」并内嵌 diff。
 * 另提供「关注文档」：记住上次看到的提交，文档有新提交时在正文顶部提示。
 *
 * - owner / repo 来自 iris/config.json（MarkdownPreview.CONFIG）
 * - 可选 Token：sessionStorage('md-preview-github-token')，用于提高限流额度 / 访问私有仓库
 *   （不再存 localStorage：明文 Token 对任何同源脚本全程可读，缩短为标签页生命周期）
 * - API 走 ETag 条件请求（If-None-Match → 304 复用），节省匿名限额
 * - 结果按「路径」「sha」做内存缓存；离线或 API 失败时静默降级
 *
 * 入口：悬浮球「历史与变更」按钮（index.html #historyBtn）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  // 惰性转发：解析期直接取全局依赖 index.html 加载顺序（曾按隐式契约）
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);
  const WATCH_KEY = 'md-preview-watched-docs';
  const TOKEN_KEY = 'md-preview-github-token';

  const commitsCache = new Map(); // path -> array
  const detailCache = new Map();  // sha -> detail

  function cfg() {
    const c = window.MarkdownPreview.CONFIG || {};
    return { owner: c.owner, repo: c.repo };
  }

  // Token 只存 sessionStorage（标签页生命周期）。旧版本曾存 localStorage，
  // 首次读取时迁移过来并清除旧键，避免明文长期驻留
  function getToken() {
    try {
      let token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) {
        const legacy = localStorage.getItem(TOKEN_KEY);
        if (legacy) {
          sessionStorage.setItem(TOKEN_KEY, legacy);
          localStorage.removeItem(TOKEN_KEY);
          token = legacy;
        }
      }
      return token;
    } catch (e) { return null; }
  }

  function apiHeaders() {
    const headers = { Accept: 'application/vnd.github+json' };
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    return headers;
  }

  // ETag 条件请求缓存（sessionStorage 持久化，跨刷新仍可 304 命中省配额）
  function etagGet(url) {
    try {
      const raw = sessionStorage.getItem('md-preview-etag:' + url);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function etagSet(url, etag, data) {
    try {
      const payload = JSON.stringify({ etag, data });
      if (payload.length < 256 * 1024) sessionStorage.setItem('md-preview-etag:' + url, payload);
    } catch (e) { /* 存储满则放弃 */ }
  }

  async function api(url) {
    const headers = apiHeaders();
    const cached = etagGet(url);
    if (cached && cached.etag) headers['If-None-Match'] = cached.etag;
    const resp = await fetch(url, { headers });
    if (resp.status === 304 && cached) return cached.data;
    if (!resp.ok) {
      const err = new Error('HTTP ' + resp.status);
      err.status = resp.status;
      // 读限流响应头：只有 Remaining=0 才是真正限流，并给出重置时间
      const remaining = resp.headers.get('X-RateLimit-Remaining');
      const reset = resp.headers.get('X-RateLimit-Reset');
      if (remaining === '0') {
        err.rateLimited = true;
        if (reset && Number.isFinite(parseInt(reset, 10))) {
          err.resetAt = new Date(parseInt(reset, 10) * 1000);
        }
      }
      throw err;
    }
    const etag = resp.headers.get('ETag');
    const data = await resp.json();
    if (etag) etagSet(url, etag, data);
    return data;
  }

  async function getCommits(path, limit) {
    if (commitsCache.has(path)) return commitsCache.get(path);
    const { owner, repo } = cfg();
    if (!owner || !repo) return [];
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&per_page=${limit || 20}`;
    const data = await api(url);
    commitsCache.set(path, data);
    return data;
  }

  async function getCommitDetail(sha) {
    if (detailCache.has(sha)) return detailCache.get(sha);
    const { owner, repo } = cfg();
    if (!owner || !repo) return null;
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
    const data = await api(url);
    detailCache.set(sha, data);
    return data;
  }

  function loadWatched() {
    try { return JSON.parse(localStorage.getItem(WATCH_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveWatched(obj) {
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(obj)); } catch (e) { /* ignore */ }
  }
  function isWatched(path) { return !!loadWatched()[path]; }
  function toggleWatch(path, sha) {
    const w = loadWatched();
    if (w[path]) delete w[path];
    else w[path] = sha || '';
    saveWatched(w);
    return !!w[path];
  }

  // ---------- 弹窗 ----------
  let overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'git-history-overlay';
    overlay.innerHTML = `
      <div class="git-history-card" role="dialog" aria-modal="true">
        <div class="git-history-head">
          <span class="git-history-title"></span>
          <span class="git-history-actions">
            <button type="button" class="download-btn git-watch-btn"></button>
            <button type="button" class="find-bar-btn git-history-close" aria-label="${esc(t('common.close', '关闭'))}">✕</button>
          </span>
        </div>
        <div class="git-history-body"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHistory(); });
    overlay.querySelector('.git-history-close').addEventListener('click', closeHistory);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) closeHistory();
    });
    return overlay;
  }

  function openHistory(path) {
    if (!path) return;
    const ov = ensureOverlay();
    // 捕获打开时的路径：弹窗开着切换文档后，「返回列表」仍应回到原文档
    ov.dataset.currentPath = path;
    ov.querySelector('.git-history-title').textContent = path;
    const body = ov.querySelector('.git-history-body');
    body.innerHTML = `<div class="git-history-loading">${esc(t('history.loading', '加载中…'))}</div>`;
    ov.classList.add('open');

    const watchBtn = ov.querySelector('.git-watch-btn');
    watchBtn.textContent = isWatched(path) ? t('history.unwatch', '取消关注') : t('history.watch', '关注此文档');
    watchBtn.onclick = () => {
      toggleWatch(path, '');
      watchBtn.textContent = isWatched(path) ? t('history.unwatch', '取消关注') : t('history.watch', '关注此文档');
    };

    getCommits(path).then(list => {
      if (!list.length) {
        body.innerHTML = `<div class="git-history-empty">${esc(t('history.empty', '暂无提交记录（或仓库不可访问）'))}</div>`;
        return;
      }
      // 关注时顺便记录最新 sha
      if (isWatched(path)) { const w = loadWatched(); w[path] = list[0].sha; saveWatched(w); }
      body.innerHTML = `<ul class="git-commit-list">${list.map(c => {
        const msg = (c.commit && c.commit.message || '').split('\n')[0];
        const author = (c.commit && c.commit.author && c.commit.author.name) || '';
        const date = (c.commit && c.commit.author && c.commit.author.date) || '';
        return `<li><button type="button" class="git-commit-item" data-sha="${esc(c.sha)}">
          <span class="git-commit-msg">${esc(msg)}</span>
          <span class="git-commit-meta">${esc(c.sha.slice(0, 7))} · ${esc(author)} · ${esc(formatDate(date))}</span>
        </button></li>`;
      }).join('')}</ul>`;
      body.querySelectorAll('.git-commit-item').forEach(btn => {
        btn.addEventListener('click', () => showCommit(body, btn.dataset.sha));
      });
    }).catch(err => {
      body.innerHTML = `<div class="git-history-empty">${esc(errorText(err))}</div>`;
    });
  }

  function errorText(err) {
    if (err && err.rateLimited) {
      let text = t('history.rateLimited', 'GitHub API 限流（未登录 60 次/时）。请稍后再试或配置 Token。');
      if (err.resetAt) {
        try {
          text += ' ' + t('history.resetAt', '限额重置：') + err.resetAt.toLocaleTimeString('zh-CN', { hour12: false });
        } catch (e) { /* ignore */ }
      }
      return text;
    }
    if (err && err.status === 403) return t('history.forbidden', 'GitHub 拒绝了请求（403，非限流）。');
    if (err && err.status === 404) return t('history.notFound', '未找到该文档的提交（可能是新文件或私有仓库）。');
    return t('history.failed', '加载失败：') + (err && err.message ? err.message : '');
  }

  function formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('zh-CN', { hour12: false }); } catch (e) { return iso; }
  }

  async function showCommit(body, sha) {
    body.innerHTML = `<div class="git-history-loading">${esc(t('history.loading', '加载中…'))}</div>`;
    try {
      const detail = await getCommitDetail(sha);
      const files = (detail && detail.files) || [];
      body.innerHTML =
        `<button type="button" class="download-btn git-back">← ${esc(t('history.back', '返回列表'))}</button>` +
        `<div class="git-commit-detail-msg">${esc((detail.commit && detail.commit.message || '').trim())}</div>` +
        files.map(f => `
          <div class="git-file">
            <div class="git-file-head">${esc(f.filename)} <span class="git-file-stat">+${f.additions} −${f.deletions}</span></div>
            ${f.patch ? `<pre class="git-patch"><code class="language-diff">${esc(f.patch)}</code></pre>` : `<div class="git-file-note">${esc(t('history.binary', '（无文本 diff）'))}</div>`}
          </div>`).join('');
      body.querySelector('.git-back').addEventListener('click', () => {
        openHistory(overlay.dataset.currentPath || window.MarkdownPreview.state.currentFilePath);
      });
      const codes = body.querySelectorAll('code.language-diff');
      if (codes.length && typeof window.hljs !== 'undefined') {
        codes.forEach(c => { try { window.hljs.highlightElement(c); } catch (e) { /* ignore */ } });
      }
    } catch (err) {
      body.innerHTML = `<div class="git-history-empty">${esc(errorText(err))}</div>`;
    }
  }

  function closeHistory() {
    if (overlay) overlay.classList.remove('open');
  }

  // ---------- 与 git HEAD 对比（编辑器打开的仓库文档） ----------
  //
  // 拉 HEAD 版本内容与编辑器当前文本做行级 diff，生成统一格式 patch
  // 后走与 showCommit 相同的 hljs language-diff 渲染管线。

  function b64ToUtf8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  async function getHeadContent(path, sha) {
    const { owner, repo } = cfg();
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`;
    const data = await api(url);
    if (!data || data.encoding !== 'base64' || typeof data.content !== 'string') {
      throw new Error('unexpected contents API response');
    }
    return b64ToUtf8(data.content);
  }

  async function openWorkingDiff(path, localText) {
    if (!path) return;
    const ov = ensureOverlay();
    ov.dataset.currentPath = path;
    ov.querySelector('.git-history-title').textContent = `${path} — ${t('history.diffVsHead', '与上次提交对比')}`;
    const body = ov.querySelector('.git-history-body');
    ov.querySelector('.git-watch-btn').style.display = 'none';
    body.innerHTML = `<div class="git-history-loading">${esc(t('history.loading', '加载中…'))}</div>`;
    ov.classList.add('open');

    try {
      const list = await getCommits(path, 1);
      if (!list.length) throw new Error(t('history.notFound', '未找到该文档的提交（可能是新文件或私有仓库）。'));
      const headText = await getHeadContent(path, list[0].sha);
      const ops = window.MarkdownPreview.mdRender.diffLines(headText, String(localText == null ? '' : localText));
      const patchLines = [`--- a/${path}`, `+++ b/${path}`];
      ops.forEach(op => {
        const sign = op.type === 'del' ? '-' : op.type === 'add' ? '+' : op.type === 'note' ? '#' : ' ';
        (op.text || '').split('\n').forEach(l => patchLines.push(sign + l));
      });
      body.innerHTML =
        `<button type="button" class="download-btn git-back">← ${esc(t('history.back', '返回列表'))}</button>` +
        `<div class="git-commit-detail-msg">${esc(t('history.diffLegend', 'HEAD {{sha}} → 当前编辑器内容；- 为 HEAD 独有，+ 为编辑器新增').replace('{sha}', list[0].sha.slice(0, 7)))}</div>` +
        `<div class="git-file"><pre class="git-patch"><code class="language-diff">${esc(patchLines.join('\n'))}</code></pre></div>`;
      body.querySelector('.git-back').addEventListener('click', () => {
        ov.querySelector('.git-watch-btn').style.display = '';
        openHistory(ov.dataset.currentPath || window.MarkdownPreview.state.currentFilePath);
      });
      const code = body.querySelector('code.language-diff');
      if (code && typeof window.hljs !== 'undefined') {
        try { window.hljs.highlightElement(code); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      body.innerHTML = `<div class="git-history-empty">${esc(errorText(err))}</div>`;
    }
  }

  // ---------- 变更订阅：文档打开时检查关注项 ----------
  // 限频：同一文档 10 分钟内不重复请求（匿名 60 次/时，每次渲染都查太费）
  const lastWatchCheck = new Map(); // path -> ts
  const WATCH_CHECK_INTERVAL = 10 * 60 * 1000;

  async function afterRender(path) {
    if (!path) return;
    const watch = loadWatched();
    if (!watch[path]) return;
    const last = lastWatchCheck.get(path) || 0;
    if (Date.now() - last < WATCH_CHECK_INTERVAL) return;
    lastWatchCheck.set(path, Date.now());
    // 先移除旧提示
    const old = document.querySelector('.doc-update-banner');
    if (old) old.remove();
    let list;
    try { list = await getCommits(path, 1); } catch (e) { return; }
    if (!list.length) return;
    const latest = list[0].sha;
    const seen = watch[path];
    if (!seen) { watch[path] = latest; saveWatched(watch); return; }
    if (seen === latest) return;

    const banner = document.createElement('div');
    banner.className = 'doc-update-banner';
    banner.innerHTML = `<span>${esc(t('history.updated', '此文档有更新'))}</span>
      <button type="button" class="download-btn doc-update-view">${esc(t('history.viewChanges', '查看变更'))}</button>
      <button type="button" class="doc-update-dismiss" aria-label="${esc(t('history.markRead', '标记已读'))}">✕</button>`;
    banner.querySelector('.doc-update-view').addEventListener('click', () => openHistory(path));
    banner.querySelector('.doc-update-dismiss').addEventListener('click', () => {
      const w = loadWatched(); w[path] = latest; saveWatched(w); banner.remove();
    });
    const content = document.getElementById('markdownContent');
    if (content && content.firstChild) content.insertBefore(banner, content.firstChild);
  }

  function init() {
    const btn = document.getElementById('historyBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const path = window.MarkdownPreview.state && window.MarkdownPreview.state.currentFilePath;
        if (!path) return;
        openHistory(path);
      });
    }
  }

  window.MarkdownPreview.gitHistory = { openHistory, openWorkingDiff, toggleWatch, isWatched, afterRender };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
