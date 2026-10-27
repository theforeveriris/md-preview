/**
 * checklist - 任务清单勾选状态记忆
 *
 * frontmatter 写 `checklist: true` 后，正文 GFM 任务列表（- [ ] / - [x]）
 * 的勾选状态按「文档路径 + 序号」记忆在 localStorage，重开文档自动恢复——
 * 教程 / 割接步骤清单刚需。
 *
 * 设计：
 *   - marked 的 GFM 任务列表输出 <li class="task-list-item"><input type="checkbox"
 *     disabled>，默认禁点；本模块在启用的文档里摘掉 disabled，改为可交互
 *   - 序号 = .markdown-body 内全部任务复选框的文档顺序（querySelectorAll 序），
 *     与「路径+序号」的键位约定一致；文档增删条目后后续序号会错位，属可接受
 *     代价（与主流静态站 checkbox 记忆同策略）
 *   - 虚拟文档 / 本地文件（path 为空）不记忆，避免无意义写存储
 *   - 存储上限淘汰策略与 section-collapse 一致（超出按文档键整体淘汰一半）
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const STORE_KEY = 'md-preview-checklist';
  const MAX_CHECKLIST_DOCS = 500;

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function writeStore(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
    catch (e) { /* 隐私模式等场景跳过 */ }
  }

  function getDocStates(docPath) {
    return readStore()[docPath] || {};
  }

  function setChecked(docPath, index, checked) {
    const all = readStore();
    if (!all[docPath]) all[docPath] = {};
    if (checked) all[docPath][index] = 1;
    else delete all[docPath][index];
    // 最近写入的文档挪到末尾，淘汰时优先删旧键（与 section-collapse 相同）
    const entry = all[docPath];
    delete all[docPath];
    all[docPath] = entry;
    const keys = Object.keys(all);
    if (keys.length > MAX_CHECKLIST_DOCS) {
      keys.slice(0, keys.length - Math.floor(MAX_CHECKLIST_DOCS / 2)).forEach(k => delete all[k]);
    }
    writeStore(all);
  }

  // markdown.js 渲染完成后调用；frontmatter.checklist 为字符串（parseFrontmatter 不做类型转换）
  function onDocRendered(currentPath, frontmatter) {
    if (!currentPath) return; // 虚拟文档 / 本地文件不记忆
    const fm = frontmatter || window.MarkdownPreview.state?.currentFrontmatter || {};
    if (fm.checklist !== true && fm.checklist !== 'true') return;

    const container = window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent;
    if (!container) return;

    const saved = getDocStates(currentPath);
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    boxes.forEach((box, index) => {
      box.disabled = false;
      box.dataset.checklistIndex = String(index);
      box.closest('li')?.classList.add('task-list-interactive');
      if (saved[index]) {
        box.checked = true;
        box.closest('li')?.classList.add('task-list-done');
      }
      box.addEventListener('change', () => {
        box.closest('li')?.classList.toggle('task-list-done', box.checked);
        setChecked(currentPath, index, box.checked);
      });
    });
  }

  window.MarkdownPreview.checklist = { onDocRendered };
})();
