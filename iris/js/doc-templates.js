/**
 * doc-templates - 文档模板脚手架
 *
 * 命令面板「从模板新建」/ 编辑器「导入」菜单：会议记录 / 割接计划 /
 * 故障复盘 / 学习笔记 / 周报，frontmatter 齐备（正好配 timeline 块、
 * checklist 勾选记忆、prerequisites 学习路径）。
 * 模板内容以行数组维护，避免反引号嵌套地狱。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;
  const esc = (...a) => window.MarkdownPreview.mdRender.escapeHtml(...a);

  const TEMPLATES = [
    {
      id: 'meeting',
      name: '会议记录',
      desc: '议程 / 结论表 / 行动项清单',
      icon: 'i-list',
      markdown: [
        '---',
        'title: 会议记录',
        'tags: [会议]',
        'checklist: true',
        '---',
        '',
        '# 会议记录',
        '',
        '## 基本信息',
        '',
        '- **时间**：',
        '- **地点 / 线上**：',
        '- **参会人**：',
        '- **记录人**：',
        '',
        '## 议程',
        '',
        '1. ',
        '',
        '## 讨论要点',
        '',
        '| 议题 | 结论 | 负责人 |',
        '|------|------|--------|',
        '|      |      |        |',
        '',
        '## 行动项',
        '',
        '- [ ] ',
        '- [ ] ',
        '',
        '## 遗留问题',
        '',
        '- '
      ].join('\n')
    },
    {
      id: 'cutover',
      name: '割接计划',
      desc: '时间线块 + 勾选清单 + 回退预案',
      icon: 'i-flag',
      markdown: [
        '---',
        'title: 割接计划',
        'tags: [割接]',
        'checklist: true',
        '---',
        '',
        '# 割接计划',
        '',
        '## 割接窗口',
        '',
        '- **时间**：',
        '- **割接负责人**：',
        '- **回退决策人**：',
        '',
        '## 时间线',
        '',
        '```timeline',
        'T-7d | 方案评审 | 割接方案、回退方案评审通过 | 完成',
        'T-1d | 变更审批 | 变更单获批、干系人周知 | 完成',
        'T-0  | 停止写入 | 确认无残留会话与定时任务 | 进行中',
        'T+1h | 配置切换 | 按清单逐台执行并双人复核 |',
        'T+2h | 业务验证 | 核心链路拨测通过 |',
        'T+4h | 观察结束 | 指标平稳，宣布割接完成 | 风险',
        '```',
        '',
        '## 执行清单',
        '',
        '- [ ] 备份当前配置并离线留存',
        '- [ ] 通知干系人割接窗口',
        '- [ ] 准备回退脚本并演练',
        '',
        '## 回退预案',
        '',
        '触发条件：',
        '',
        '回退步骤：'
      ].join('\n')
    },
    {
      id: 'postmortem',
      name: '故障复盘',
      desc: '时间线 + 五问分析 + 改进项',
      icon: 'i-zap',
      markdown: [
        '---',
        'title: 故障复盘',
        'tags: [复盘]',
        '---',
        '',
        '# 故障复盘',
        '',
        '## 故障概要',
        '',
        '- **级别**：',
        '- **影响范围**：',
        '- **持续时间**：',
        '- **根因（一句话）**：',
        '',
        '## 时间线',
        '',
        '```timeline',
        '发生   | 告警触发 | 监控发现异常 | 完成',
        '响应   | 值班响应 | 定位到疑似模块 | 进行中',
        '恢复   | 处置生效 | 服务恢复 |',
        '关闭   | 复盘完成 | 改进项落地 | 风险',
        '```',
        '',
        '## 原因分析',
        '',
        '### 直接原因',
        '',
        '### 根本原因',
        '',
        '### 为什么没有更早发现',
        '',
        '## 改进项',
        '',
        '| 改进项 | 负责人 | 截止 | 状态 |',
        '|--------|--------|------|------|',
        '|        |        |      |      |'
      ].join('\n')
    },
    {
      id: 'study',
      name: '学习笔记',
      desc: '前置阅读（学习路径）+ 要点 + 自测',
      icon: 'i-star',
      markdown: [
        '---',
        'title: 学习笔记',
        'tags: [学习]',
        'prerequisites: []',
        '---',
        '',
        '# 学习笔记',
        '',
        '## 本篇要回答的问题',
        '',
        '1. ',
        '',
        '## 要点',
        '',
        '## 关键命令 / 配置',
        '',
        '```ios',
        '!',
        '```',
        '',
        '## 自测',
        '',
        '- [ ] 能向别人讲清楚这篇的核心概念',
        '- [ ] 完成一次动手实验',
        '',
        '## 参考资料',
        '',
        '- '
      ].join('\n')
    },
    {
      id: 'weekly',
      name: '周报',
      desc: '本周完成 / 下周计划 / 风险求助',
      icon: 'i-check',
      markdown: [
        '---',
        'title: 周报',
        'tags: [周报]',
        '---',
        '',
        '# 周报',
        '',
        '## 本周完成',
        '',
        '- ',
        '',
        '## 数据 / 指标',
        '',
        '| 指标 | 本周 | 上周 | 趋势 |',
        '|------|------|------|------|',
        '|      |      |      |      |',
        '',
        '## 下周计划',
        '',
        '- ',
        '',
        '## 风险与求助',
        '',
        '- '
      ].join('\n')
    }
  ];

  // ============== 模板选择弹窗 ==============

  function ensureOverlay() {
    let overlay = document.getElementById('docTemplatesOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'docTemplatesOverlay';
      overlay.className = 'templates-overlay';
      overlay.innerHTML = `
        <div class="templates-card" role="dialog" aria-modal="true">
          <div class="templates-head">
            <span class="templates-title">${esc(t('templates.title', '从模板新建'))}</span>
            <button type="button" class="find-bar-btn templates-close" aria-label="${esc(t('common.close', '关闭'))}">✕</button>
          </div>
          <div class="templates-grid"></div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closePicker(); });
      overlay.querySelector('.templates-close').addEventListener('click', closePicker);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closePicker();
      });
    }
    return overlay;
  }

  function closePicker() {
    const overlay = document.getElementById('docTemplatesOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  function openPicker() {
    const overlay = ensureOverlay();
    const grid = overlay.querySelector('.templates-grid');
    grid.innerHTML = TEMPLATES.map(tpl => `
      <button type="button" class="templates-item" data-tpl="${tpl.id}">
        <span class="templates-item-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><use href="#${tpl.icon}"/></svg></span>
        <span class="templates-item-body">
          <span class="templates-item-name">${esc(tpl.name)}</span>
          <span class="templates-item-desc">${esc(tpl.desc)}</span>
        </span>
      </button>`).join('');
    grid.querySelectorAll('.templates-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = TEMPLATES.find(x => x.id === btn.dataset.tpl);
        closePicker();
        if (tpl) enterEditorWithTemplate(tpl);
      });
    });
    overlay.classList.add('open');
  }

  // 进入编辑器并新建模板笔记本：模板先挂待取件箱，编辑器就绪后消费
  function enterEditorWithTemplate(tpl) {
    window.MarkdownPreview.docTemplatesPending = tpl;
    if (window.MarkdownPreview.editorCreateTab) {
      // 编辑器已加载：直接建
      consumePending();
    } else if (window.MarkdownPreview.enterEditorMode) {
      window.MarkdownPreview.enterEditorMode();
    }
  }

  // editor.js 初始化完成后调用（取走待建模板）
  function consumePending() {
    const tpl = window.MarkdownPreview.docTemplatesPending;
    if (!tpl) return;
    window.MarkdownPreview.docTemplatesPending = null;
    if (window.MarkdownPreview.editorCreateTab) {
      window.MarkdownPreview.editorCreateTab(
        { cells: [{ type: 'markdown', content: tpl.markdown }] },
        tpl.name
      );
    }
  }

  window.MarkdownPreview.docTemplates = { openPicker, consumePending, list: () => TEMPLATES };
})();
