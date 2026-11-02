/**
 * contributors - 贡献者徽标
 *
 * 构建期 git-times 已扫提交历史（build-file-tree 采集 contributors 字段），
 * 文档头显示贡献者头像栈：已登记公开 GitHub 登录名时显示头像，否则回退为
 * 站点品牌鸢尾图标。产物与请求均不含邮箱（CWE-359）。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function findDoc(path) {
    let found = null;
    (function walk(items) {
      (items || []).forEach(item => {
        if (found) return;
        if (item.type === 'folder') walk(item.children);
        else if (item.path === path) found = item;
      });
    })(window.MarkdownPreview.state?.fileTreeData);
    return found;
  }

  function onDocRendered(currentPath) {
    const container = window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent;
    if (!container) return;
    container.querySelectorAll('.contributors-bar').forEach(el => el.remove());
    if (!currentPath) return;
    const doc = findDoc(currentPath);
    const list = (doc && Array.isArray(doc.contributors)) ? doc.contributors : [];
    if (list.length === 0) return;

    const bar = document.createElement('div');
    bar.className = 'contributors-bar';
    // 隐私：产物不含邮箱（CWE-359）；只对显式登记的公开 GitHub 登录名取头像，
    // 没有登记或头像请求失败时统一回退为站点品牌鸢尾图标，避免用显示名误配账号。
    const GITHUB_LOGINS = Object.freeze({
      theforeveriris: 'theforeveriris',
      agelaia521: 'agelaia521',
      'omajili-manbu': 'omajili-manbu',
    });
    const avatarFor = (name) => {
      const login = GITHUB_LOGINS[name];
      if (!login || !/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(login)) return '';
      return `https://github.com/${encodeURIComponent(login)}.png?size=52`;
    };
    const chips = list.map((a, i) => {
      const title = `${a.name} · ${t('contributors.commits', '{n} 次提交').replace('{n}', a.count)}`;
      const avatar = avatarFor(a.name);
      const avatarImg = avatar
        ? `<img class="contributor-avatar" src="${esc(avatar)}" alt="" width="26" height="26" decoding="async" referrerpolicy="no-referrer">`
        : '';
      return `<span class="contributor-chip" title="${esc(title)}" data-order="${i}">
        ${avatarImg}<span class="contributor-fallback" aria-hidden="true"><img class="contributor-brand" src="iris/icons/icon.svg" alt=""></span>
      </span>`;
    }).join('');
    bar.innerHTML = `<span class="contributors-label"><svg class="ico ico-xs" aria-hidden="true"><use href="#i-users"/></svg>${esc(t('contributors.label', '贡献者'))}</span><span class="contributors-stack">${chips}</span>`;

    // 头像 404 / 网络失败时移除图片，露出底下的品牌图标
    bar.querySelectorAll('.contributor-avatar').forEach(img => {
      img.addEventListener('error', () => img.remove(), { once: true });
    });

    const anchor = container.querySelector('.reading-time');
    if (anchor) anchor.parentNode.insertBefore(bar, anchor);
    else container.insertBefore(bar, container.firstChild);
  }

  window.MarkdownPreview.contributors = { onDocRendered };
})();
