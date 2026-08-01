(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};
  
  async function render() {
    // 没有 apexcharts 代码块时直接跳过，避免无谓加载 ApexCharts（621KB）
    if (!document.querySelector('.markdown-body pre code.language-apexcharts')) {
      return;
    }

    if (typeof ApexCharts === 'undefined') {
      await window.MarkdownPreview.loadScript('iris/vendor/apexcharts.min.js');
    }
    if (typeof ApexCharts === 'undefined') {
      console.error('ApexCharts library failed to load');
      return;
    }

    const allPres = Array.from(document.querySelectorAll('.markdown-body pre'));
    
    for (let i = 0; i < allPres.length; i++) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');
      
      if (!codeElement) continue;
      
      const classList = codeElement.className;
      if (!classList || !classList.includes('language-apexcharts')) continue;
      
      const chartConfigStr = codeElement.textContent.trim();
      
      try {
        const chartConfig = JSON.parse(chartConfigStr);
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
          if (chartElement) {
            try {
              const chart = new ApexCharts(chartElement, mergedConfig);
              chart.render();
            } catch (e) {
              console.error('ApexCharts initialization error:', e);
              chartElement.innerHTML = '<div style="padding: 20px; color: #ff6b6b;">图表渲染失败: ' + e.message + '</div>';
            }
          }
        }, 50);
      } catch (error) {
        console.error('ApexCharts parsing error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.padding = '10px';
        errorDiv.style.border = '1px solid #ff6b6b';
        errorDiv.style.borderRadius = '4px';
        errorDiv.textContent = 'ApexCharts 错误: ' + error.message;
        if (pre.parentNode) {
          pre.parentNode.replaceChild(errorDiv, pre);
        }
      }
    }
  }
  
  window.MarkdownPreview.renderers.apexcharts = {
    render
  };
})();
