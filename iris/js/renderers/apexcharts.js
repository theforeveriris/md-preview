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

        const mergedConfig = {
          ...chartConfig,
          chart: {
            ...chartConfig.chart,
            id: chartId,
            toolbar: { show: true }
          },
          colors: chartConfig.colors || ['#8B5CF6', '#D946EF', '#3B82F6', '#10B981', '#F59E0B'],
          theme: { mode: 'light' }
        };

        pre.parentNode.replaceChild(container, pre);

        setTimeout(() => {
          const chartElement = document.getElementById(chartId);
          if (!chartElement) return;
          try {
            const chart = new ApexCharts(chartElement, mergedConfig);
            chart.render();
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
