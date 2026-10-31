(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};
  
  // 渲染失败统一回退：错误提示 + 可折叠源码（源码不丢，与 plantuml 范本一致）。
  // message 可能含用户输入（JSON 原文），一律走 textContent 防注入。
  function renderFailure(container, message, sourceHtml) {
    container.innerHTML = '';
    const errBox = document.createElement('div');
    errBox.style.cssText = 'padding:10px;border:1px solid #ff6b6b;border-radius:4px;color:#ff6b6b';
    errBox.textContent = 'ApexCharts 渲染失败: ' + message;
    container.appendChild(errBox);
    if (typeof sourceHtml === 'string' && sourceHtml) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = '查看源码';
      details.appendChild(summary);
      const pre = document.createElement('pre');
      pre.style.cssText = 'margin-top:8px;white-space:pre-wrap';
      pre.innerHTML = sourceHtml; // marked/highlight 输出的已转义内容
      details.appendChild(pre);
      container.appendChild(details);
    }
  }

  // ApexCharts 自带明/暗两套坐标轴、图例、tooltip 配色，也有自己的
  // svg 背景色（默认白）。暗色主题下不切换就会在深色页面里贴一张白卡。
  function isDarkTheme() {
    const CU = window.MarkdownPreview.ColorUtils;
    const bg = CU.getThemeVar('--color-bg', '#ffffff');
    return CU.luminance(CU.resolveColor(bg, '#ffffff')) < 0.4;
  }

  function themeVarColors() {
    const CU = window.MarkdownPreview.ColorUtils;
    return {
      accent: CU.getThemeVar('--color-accent-purple', '#8B5CF6'),
      pink: CU.getThemeVar('--color-accent-pink', '#D946EF'),
      link: CU.getThemeVar('--color-link', '#3B82F6'),
      success: CU.getThemeVar('--color-success', '#10B981'),
      warning: CU.getThemeVar('--color-warning', '#F59E0B'),
      border: CU.getThemeVar('--color-border', '#e5e7eb')
    };
  }

  function themedConfig(chartConfig, chartId) {
    const mode = isDarkTheme() ? 'dark' : 'light';
    const c = themeVarColors();
    const userTheme = chartConfig.theme || {};
    return {
      ...chartConfig,
      chart: {
        ...chartConfig.chart,
        id: chartId || chartConfig.chart && chartConfig.chart.id,
        toolbar: { show: true, ...(chartConfig.chart && chartConfig.chart.toolbar) },
        // 卡片的底色由 .apex-chart 容器（--color-surface）提供，
        // 图表自身背景透明才不会盖出一块白底
        background: 'transparent'
      },
      colors: chartConfig.colors || [c.accent, c.pink, c.link, c.success, c.warning],
      theme: { ...userTheme, mode: userTheme.mode || mode },
      // 网格线用主题边框色：ApexCharts 暗色主题默认的浅灰在深底上偏刺眼
      grid: { borderColor: c.border, ...(chartConfig.grid || {}) },
      tooltip: { theme: mode, ...(chartConfig.tooltip || {}) }
    };
  }

  // 已挂载的图表：主题切换后需要重建，否则会一直留在旧配色上
  const mounted = [];
  let themeListenerBound = false;
  function bindThemeChange() {
    if (themeListenerBound) return;
    themeListenerBound = true;
    window.addEventListener('themechange', () => {
      if (typeof ApexCharts === 'undefined') return;
      mounted.forEach((item) => {
        if (!item.el.isConnected) return;
        try { item.chart.destroy(); } catch (e) { /* 已销毁 */ }
        try {
          const next = new ApexCharts(item.el, themedConfig(item.config, item.id));
          next.render();
          item.chart = next;
        } catch (e) { console.warn('[ApexCharts] 主题切换重建失败:', e && e.message); }
      });
    });
  }

  async function render(root) {
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;

    // 没有 apexcharts 代码块时直接跳过，避免无谓加载 ApexCharts（621KB）
    if (!markdownBody.querySelector('pre code.language-apexcharts')) {
      return;
    }

    if (typeof ApexCharts === 'undefined') {
      await window.MarkdownPreview.loadScript('iris/vendor/apexcharts.min.js');
    }
    if (typeof ApexCharts === 'undefined') {
      console.error('ApexCharts library failed to load');
      return;
    }
    bindThemeChange();

    const allPres = Array.from(markdownBody.querySelectorAll('pre'));

    for (let i = 0; i < allPres.length; i++) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');

      if (!codeElement) continue;

      const classList = codeElement.className;
      if (!classList || !classList.includes('language-apexcharts')) continue;

      const sourceHtml = pre.innerHTML;

      try {
        const chartConfig = JSON.parse(codeElement.textContent.trim());
        const chartId = 'apexchart-' + Date.now() + '-' + i;

        const container = document.createElement('div');
        container.id = chartId;
        container.className = 'apex-chart';
        container.style.minHeight = '400px';

        const mergedConfig = themedConfig(chartConfig, chartId);

        pre.parentNode.replaceChild(container, pre);

        setTimeout(() => {
          const chartElement = document.getElementById(chartId);
          if (!chartElement) return;
          try {
            const chart = new ApexCharts(chartElement, mergedConfig);
            chart.render();
            mounted.push({ el: chartElement, chart, config: chartConfig, id: chartId });
          } catch (e) {
            console.error('ApexCharts initialization error:', e);
            renderFailure(chartElement, e.message, sourceHtml);
          }
        }, 50);
      } catch (error) {
        console.error('ApexCharts parsing error:', error);
        const errorDiv = document.createElement('div');
        if (pre.parentNode) {
          pre.parentNode.replaceChild(errorDiv, pre);
        }
        renderFailure(errorDiv, error.message, sourceHtml);
      }
    }
  }
  
  window.MarkdownPreview.renderers.apexcharts = {
    render
  };
})();
