/**
 * GitHub issue / PR / release / repo 卡片（H1）
 *
 * Markdown 语法：
 *   @[github](owner/repo)          —— 仓库卡片
 *   @[issue](https://github.com/o/r/issues/123)
 *   @[pr](https://github.com/o/r/pull/45)
 *   @[release](https://github.com/o/r/releases/tag/v1.0.0)
 *
 * 渲染：标题、状态（open/closed/merged）、作者、标签、更新时间；
 * release 显示版本 / 日期 / 摘要。
 * 数据走 GitHub REST API（匿名，构建期可缓存）；失败/限流回退纯链接。
 * 安全：只允许 github.com 主机；内容转义，不执行 API 返回 HTML。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  const STATE_LABEL = { open: '开放', closed: '已关闭', merged: '已合并' };

  function safeGithubUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname !== 'github.com') return null;
      return u;
    } catch (e) { return null; }
  }

  function repoFromPath(path) {
    const m = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/.exec(String(path || ''));
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  function repoFromUrl(url) {
    const u = safeGithubUrl(url);
    if (!u) return null;
    const m = /^\/([^/]+)\/([^/]+)(?:\.git)?\/?$/.exec(u.pathname);
    return m ? { owner: m[1], repo: m[2] } : null;
  }

  async function apiGet(url) {
    const resp = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }

  function card(spec) {
    const el = document.createElement('div');
    el.className = 'gh-card';
    const head = document.createElement('div');
    head.className = 'gh-card-head';
    head.innerHTML =
      '<span class="gh-card-kind">' + esc(spec.kind) + '</span>' +
      '<span class="gh-card-title">' + esc(spec.title || '') + '</span>';
    el.appendChild(head);
    const body = document.createElement('div');
    body.className = 'gh-card-body';
    spec.fields.forEach(f => {
      if (!f.value) return;
      const row = document.createElement('div');
      row.className = 'gh-card-field';
      row.innerHTML = '<span class="gh-card-label">' + esc(f.label) + '</span>' +
        '<span class="gh-card-value">' + esc(f.value) + '</span>';
      body.appendChild(row);
    });
    if (spec.labels && spec.labels.length) {
      const labels = document.createElement('div');
      labels.className = 'gh-card-labels';
      spec.labels.forEach(l => {
        const chip = document.createElement('span');
        chip.className = 'gh-card-label-chip';
        chip.textContent = l;
        labels.appendChild(chip);
      });
      body.appendChild(labels);
    }
    if (spec.link) {
      const a = document.createElement('a');
      a.className = 'gh-card-link';
      a.href = spec.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = t('gh.view', '查看');
      el.appendChild(a);
    }
    el.appendChild(body);
    return el;
  }

  function fallback(url, label) {
    const el = document.createElement('div');
    el.className = 'gh-card gh-card-fallback';
    el.innerHTML =
      '<div class="gh-card-head"><span class="gh-card-kind">' + esc(label) + '</span>' +
      '<span class="gh-card-title">' + esc(url) + '</span></div>' +
      '<div class="gh-card-body"><a class="gh-card-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(t('gh.view', '查看')) + '</a></div>';
    return el;
  }

  async function renderGithubRepo(el, owner, repo) {
    try {
      const data = await apiGet('https://api.github.com/repos/' + owner + '/' + repo);
      el.replaceWith(card({
        kind: 'Repository',
        title: owner + '/' + repo,
        fields: [
          { label: t('gh.language', '语言'), value: data.language || '' },
          { label: 'Stars', value: data.stargazers_count != null ? data.stargazers_count : '' },
          { label: 'Forks', value: data.forks_count != null ? data.forks_count : '' },
          { label: t('gh.updated', '更新'), value: data.updated_at ? new Date(data.updated_at).toISOString().slice(0, 10) : '' }
        ],
        link: data.html_url || 'https://github.com/' + owner + '/' + repo
      }));
    } catch (e) {
      el.replaceWith(fallback('https://github.com/' + owner + '/' + repo, 'Repository'));
    }
  }

  async function renderIssue(el, url, kind) {
    const u = safeGithubUrl(url);
    if (!u) { el.replaceWith(fallback(url, kind)); return; }
    const m = new URL(url);
    const num = Number((m.pathname.match(/\/(?:issues|pull)\/(\d+)/) || [])[1]);
    let repo;
    // owner/repo 从路径前两段取
    const segs = m.pathname.split('/').filter(Boolean);
    if (segs.length >= 2) repo = { owner: segs[0], repo: segs[1] };
    if (!repo || !num) { el.replaceWith(fallback(url, kind)); return; }
    try {
      const data = await apiGet('https://api.github.com/repos/' + repo.owner + '/' + repo.repo + '/' + kind + 's/' + num);
      const state = data.state === 'closed' && data.pull_request && data.merged_at ? 'merged' : data.state;
      const labels = (data.labels || []).map(l => l.name);
      el.replaceWith(card({
        kind: kind === 'pr' ? 'Pull Request' : 'Issue',
        title: data.title || '#' + num,
        fields: [
          { label: t('gh.state', '状态'), value: STATE_LABEL[state] || state },
          { label: t('gh.author', '作者'), value: data.user && data.user.login },
          { label: t('gh.updated', '更新'), value: data.updated_at ? new Date(data.updated_at).toISOString().slice(0, 10) : '' }
        ],
        labels,
        link: data.html_url || url
      }));
    } catch (e) {
      el.replaceWith(fallback(url, kind === 'pr' ? 'Pull Request' : 'Issue'));
    }
  }

  async function renderRelease(el, url) {
    const u = safeGithubUrl(url);
    if (!u) { el.replaceWith(fallback(url, 'Release')); return; }
    const segs = u.pathname.split('/').filter(Boolean);
    const tagIdx = segs.indexOf('tag');
    let repo = null;
    if (tagIdx > 1) repo = { owner: segs[0], repo: segs[1] };
    const tag = tagIdx >= 0 ? segs[tagIdx + 1] : null;
    if (!repo || !tag) { el.replaceWith(fallback(url, 'Release')); return; }
    try {
      const data = await apiGet('https://api.github.com/repos/' + repo.owner + '/' + repo.repo + '/releases/tags/' + encodeURIComponent(tag));
      el.replaceWith(card({
        kind: 'Release',
        title: data.tag_name || tag,
        fields: [
          { label: t('gh.published', '发布'), value: data.published_at ? new Date(data.published_at).toISOString().slice(0, 10) : '' },
          { label: t('gh.prerelease', '预发布'), value: data.prerelease ? '是' : '' }
        ],
        link: data.html_url || url
      }));
    } catch (e) {
      el.replaceWith(fallback(url, 'Release'));
    }
  }

  async function renderEmbed(el, url, service) {
    if (service === 'github') {
      const r = repoFromPath(url);
      if (r) await renderGithubRepo(el, r.owner, r.repo);
      else el.replaceWith(fallback(url, 'Repository'));
    } else if (service === 'issue') {
      await renderIssue(el, url, 'issue');
    } else if (service === 'pr') {
      await renderIssue(el, url, 'pr');
    } else if (service === 'release') {
      await renderRelease(el, url);
    } else {
      el.replaceWith(fallback(url, service));
    }
  }

  window.MarkdownPreview.renderers.github = { renderEmbed };
})();
