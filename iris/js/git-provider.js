/**
 * git-provider - Git 托管平台适配层（非 GitHub 托管支持）
 *
 * 把 file-tree 回退 / git 历史 / 编辑此页链接解耦出 GitHub API：
 * config.json 写 `provider: "github" | "gitee" | "gitlab"` 即切换，
 * 自托管 GitLab 再配 `gitlabUrl`（默认 gitlab.com）与 `projectId`
 * （数字 ID 或 URL 编码的完整路径，如 `group%2Frepo`）。
 *
 * 统一出口（消费者不感知平台差异）：
 *   listFiles(branch)            → { tree: [{ path, type: 'blob'|'tree' }] }
 *   commits(path, limit)         → [{ sha, commit: { message, author: { name, date } } }]
 *   headContent(path, ref)       → 文本内容
 *   editUrl(path)                → Web 端编辑链接
 *
 * Gitee API v5 与 GitHub v3 形态几乎一致；GitLab v4 形态不同，在适配层归一。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  function cfg() {
    const c = window.MarkdownPreview.CONFIG || {};
    return {
      owner: c.owner,
      repo: c.repo,
      provider: (c.provider || 'github').toLowerCase(),
      branch: c.branch || 'main',
      gitlabUrl: (c.gitlabUrl || 'https://gitlab.com').replace(/\/+$/, ''),
      projectId: c.projectId || ''
    };
  }

  // Token：沿用站内 GitHub Token 的 sessionStorage 惯例，按平台分键
  function token() {
    const p = cfg().provider;
    // 只读本平台的 key：GitHub PAT 对 Gitee/GitLab 无意义，
    // 跨服务回退只会造成凭据泄露（CodeRabbit review fix）
    const keys = p === 'gitee' ? ['md-preview-gitee-token']
      : p === 'gitlab' ? ['md-preview-gitlab-token']
      : ['md-preview-github-token'];
    for (const k of keys) {
      try {
        const v = sessionStorage.getItem(k);
        if (v) return v;
      } catch (e) { /* ignore */ }
    }
    return null;
  }

  function apiHeaders() {
    const headers = {};
    const tk = token();
    const p = cfg().provider;
    if (tk) {
      if (p === 'gitlab') headers['PRIVATE-TOKEN'] = tk;
      else headers.Authorization = 'Bearer ' + tk;
    }
    return headers;
  }

  // Gitee 的 token 只认 query 参数，调用前拼进 URL
  function withQueryAuth(url) {
    if (cfg().provider !== 'gitee') return url;
    const tk = token();
    if (!tk) return url;
    return url + (url.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(tk);
  }

  async function api(url) {
    const resp = await fetch(url, { headers: apiHeaders() });
    if (!resp.ok) {
      const err = new Error('HTTP ' + resp.status);
      err.status = resp.status;
      throw err;
    }
    return resp.json();
  }

  // ============== listFiles ==============

  async function listFiles(branch) {
    const { provider, owner, repo, gitlabUrl, projectId } = cfg();
    const ref = branch || cfg().branch;

    if (provider === 'gitee') {
      const url = withQueryAuth(`https://gitee.com/api/v5/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
      const data = await api(url);
      return { tree: (data && data.tree) || [] };
    }

    if (provider === 'gitlab') {
      if (!projectId) throw new Error('gitlab provider requires config.projectId');
      const out = [];
      let page = 1;
      // 分页拉全：空页或不足一页即结束；安全上限只防接口异常死循环
      //（CodeRabbit review fix：固定 30 页会静默截断大树）
      const MAX_PAGES = 100;
      for (; page <= MAX_PAGES; page++) {
        const url = `${gitlabUrl}/api/v4/projects/${projectId}/repository/tree?recursive=true&per_page=100&page=${page}&ref=${encodeURIComponent(ref)}`;
        const data = await api(url);
        if (!Array.isArray(data) || data.length === 0) break;
        data.forEach(item => {
          out.push({ path: item.path, type: item.type === 'tree' ? 'tree' : 'blob' });
        });
        if (data.length < 100) break;
      }
      if (page > MAX_PAGES) {
        // 触顶抛错而不是静默返回残缺树：调用方（挂载流程）会 toast 提示
        throw new Error('gitlab tree exceeds ' + MAX_PAGES + ' pages (over 10000 entries)');
      }
      return { tree: out };
    }

    // github（默认）
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const data = await api(url);
    return { tree: (data && data.tree) || [] };
  }

  // ============== commits（归一为 GitHub 形态） ==============

  async function commits(path, limit) {
    const { provider, owner, repo, gitlabUrl, projectId } = cfg();
    const perPage = limit || 20;
    const encPath = path.split('/').map(encodeURIComponent).join('/');

    if (provider === 'gitee') {
      const url = withQueryAuth(`https://gitee.com/api/v5/repos/${owner}/${repo}/commits?path=${encPath}&per_page=${perPage}`);
      return api(url);
    }

    if (provider === 'gitlab') {
      if (!projectId) return [];
      const url = `${gitlabUrl}/api/v4/projects/${projectId}/repository/commits?path=${encPath}&ref_name=${encodeURIComponent(cfg().branch)}&per_page=${perPage}`;
      const data = await api(url);
      return (Array.isArray(data) ? data : []).map(c => ({
        sha: c.id || '',
        commit: {
          message: c.message || c.title || '',
          author: { name: c.author_name || '', date: c.committed_date || c.created_at || '' }
        }
      }));
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encPath}&per_page=${perPage}`;
    return api(url);
  }

  // ============== headContent（归一为 { content: base64 } 处理） ==============

  async function headContent(path, ref) {
    const { provider, owner, repo, gitlabUrl, projectId } = cfg();
    const encPath = path.split('/').map(encodeURIComponent).join('/');

    if (provider === 'gitlab') {
      if (!projectId) throw new Error('gitlab provider requires config.projectId');
      const url = `${gitlabUrl}/api/v4/projects/${projectId}/repository/files/${encPath}?ref=${encodeURIComponent(ref || cfg().branch)}`;
      const data = await api(url);
      return decodeBase64Utf8(data.content || '');
    }

    const base = provider === 'gitee'
      ? `https://gitee.com/api/v5/repos/${owner}/${repo}/contents/${encPath}`
      : `https://api.github.com/repos/${owner}/${repo}/contents/${encPath}`;
    const url = withQueryAuth(`${base}?ref=${encodeURIComponent(ref || cfg().branch)}`);
    const data = await api(url);
    return decodeBase64Utf8((data && data.content) || '');
  }

  function decodeBase64Utf8(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  // ============== editUrl ==============

  function editUrl(path) {
    const { provider, owner, repo, gitlabUrl, projectId } = cfg();
    const encPath = path.split('/').map(encodeURIComponent).join('/');
    if (provider === 'gitee') {
      return `https://gitee.com/${owner}/${repo}/edit/${cfg().branch}/${encPath}`;
    }
    if (provider === 'gitlab') {
      // projectId 为 URL 编码路径时可直接当 web 路径；纯数字 ID 无法拼 web 链接，
      // 退化为仓库根
      const webPath = decodeURIComponent(projectId);
      return `${gitlabUrl}/${webPath}/-/edit/${cfg().branch}/${encPath}`;
    }
    return `https://github.com/${owner}/${repo}/edit/${cfg().branch}/${encPath}`;
  }

  /// 提交详情（非 GitHub）：归一为 GitHub { commit, files } 形态，
  /// 供 git-history 的 showCommit 直接渲染
  async function commitDetail(sha) {
    const { provider, owner, repo, gitlabUrl, projectId } = cfg();

    if (provider === 'gitee') {
      // gitee v5 与 GitHub v3 形态一致（含 files[].patch）
      const url = withQueryAuth(`https://gitee.com/api/v5/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`);
      return api(url);
    }

    if (provider === 'gitlab') {
      if (!projectId) return null;
      const base = `${gitlabUrl}/api/v4/projects/${projectId}/repository/commits/${encodeURIComponent(sha)}`;
      const meta = await api(base);
      const diffs = await api(base + '/diff').catch(() => []);
      const files = (Array.isArray(diffs) ? diffs : []).map(d => {
        const patch = d.diff || '';
        const lines = patch.split('\n');
        return {
          filename: d.new_path || d.old_path || '',
          patch,
          additions: lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length,
          deletions: lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length
        };
      });
      return {
        sha: meta.id || sha,
        commit: {
          message: meta.message || '',
          author: { name: meta.author_name || '', date: meta.committed_date || meta.created_at || '' }
        },
        files
      };
    }

    return null;
  }

  window.MarkdownPreview.gitProvider = { listFiles, commits, commitDetail, headContent, editUrl, cfg, token };
})();
