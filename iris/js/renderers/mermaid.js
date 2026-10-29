(function() {
  (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Renderer module loading...');
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  // mermaid 是否已完成 initialize（懒加载后才执行）
  let mermaidInitialized = false;

  // DOM 中是否存在 mermaid 代码块（用于决定是否值得加载 3.5MB 的 mermaid.min.js）
  function hasMermaidBlocks() {
    const root = window.MarkdownPreview.mdRender.resolveRoot();
    return !!(root && root.querySelector('pre code.language-mermaid'));
  }

  // ---------------------------------------------------------------
  // 主题配置：mermaid 的各类图表用各自的 themeVariables 分区取色，
  // 只设 primaryColor/mainBkg 那几项时，时序图便签、甘特图底纹、ER 属性行、
  // C4 盒子、XY 图表绘图区仍会沿用 base 主题里的浅色默认值——暗色主题下
  // 就是一块块白底（C4 甚至出现文字与底色同色看不见）。这里按图表家族
  // 逐项覆盖，并在暗色下改用 mermaid 自带的 dark 作为兜底基线。
  function buildConfig() {
    const CU = window.MarkdownPreview.ColorUtils;
    const cv = (name, fallback) => CU.getThemeVar(name, fallback);
    const bg = cv('--color-bg', '#fafafa');
    const surface = cv('--color-surface', '#ffffff');
    const text = cv('--color-text', '#333333');
    const border = cv('--color-border', '#f0f0f0');
    const muted = cv('--color-text-muted', '#888888');
    const accent = cv('--color-accent-purple', '#d4a5c9');
    const accentPink = cv('--color-accent-pink', '#f2c4ce');
    const success = cv('--color-success', '#4caf50');
    const warning = cv('--color-warning', '#ff9800');
    const error = cv('--color-error', '#f44336');

    const isDark = CU.luminance(CU.resolveColor(bg, '#ffffff')) < 0.4;
    // a、b 按 t 混合：用于把强调色压到与底色同一明度区间，避免大面积荧光块
    const mix = (a, b, t) => {
      const x = CU.parseRgb(a) || [128, 128, 128];
      const y = CU.parseRgb(b) || [128, 128, 128];
      return CU.rgbToCss(x.map((v, i) => Math.round(v + (y[i] - v) * t)));
    };
    // 数据系列色：以强调色为基准做色环旋转。
    // 不能直接用 --color-accent-pink 当第二色——好几个主题里它和
    // --color-accent-purple 同值，饼图/甘特图会出现两块完全同色的扇区。
    const series = (function () {
      const rgb = CU.parseRgb(accent) || [139, 92, 246];
      const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      const l = (max + min) / 2;
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      return [0, 48, 100, 160, 215, 300].map(off =>
        CU.rgbToCss(CU.hslToRgb((h + off) % 360, isDark ? 0.5 : 0.45, isDark ? 0.62 : 0.46))
      );
    })();
    const seriesFill = (i) => (isDark ? mix(series[i % 6], surface, 0.18) : mix(series[i % 6], bg, 0.5));
    // 彩色块上的文字：在主题前景色与底色里挑对比度更高的那个。
    // 深浅主题的强调色明度不同（浅色主题的强调色很淡），不能写死黑或白。
    const bestOn = (fillColor) => {
      const f = CU.parseRgb(fillColor) || [128, 128, 128];
      const onText = CU.contrast(f, CU.parseRgb(text));
      const onBg = CU.contrast(f, CU.parseRgb(bg));
      return onText >= onBg ? text : bg;
    };

    const vars = {
      darkMode: isDark,
      fontFamily: 'inherit',
      background: surface,
      primaryColor: surface,
      primaryTextColor: text,
      primaryBorderColor: accent,
      secondaryColor: isDark ? mix(surface, accent, 0.12) : mix(surface, accentPink, 0.35),
      tertiaryColor: bg,
      secondaryBkg: mix(surface, bg, 0.5),
      tertiaryBkg: bg,
      mainBkg: surface,
      nodeBorder: accent,
      nodeTextColor: text,
      textColor: text,
      titleColor: text,
      lineColor: isDark ? mix(muted, surface, 0.2) : muted,
      defaultLinkColor: muted,
      edgeLabelBackground: surface,
      clusterBkg: bg,
      clusterBorder: border,

      // 时序图
      actorBkg: surface,
      actorBorder: accent,
      actorTextColor: text,
      actorLineColor: border,
      signalColor: text,
      signalTextColor: text,
      labelBoxBkgColor: surface,
      labelBoxBorderColor: accent,
      labelTextColor: text,
      loopTextColor: text,
      noteBkgColor: mix(surface, warning, isDark ? 0.18 : 0.14),
      noteTextColor: text,
      noteBorderColor: border,
      activationBkgColor: accent,
      activationBorderColor: accent,
      sequenceNumberColor: bestOn(accent),

      // 类图 / 状态图
      classText: text,

      // ER 图属性行
      attributeBackgroundColorOdd: surface,
      attributeBackgroundColorEven: bg,

      // 甘特图
      sectionBkgColor: mix(bg, surface, 0.6),
      altSectionBkgColor: surface,
      sectionBkgColor2: mix(surface, accent, 0.08),
      taskBkgColor: accent,
      taskBorderColor: accent,
      taskTextColor: bestOn(accent),
      taskTextLightColor: text,
      taskTextOutsideColor: text,
      taskTextDarkColor: bg,
      taskTextClickableColor: accent,
      activeTaskBkgColor: accentPink,
      activeTaskBorderColor: accentPink,
      doneTaskBkgColor: mix(surface, success, 0.25),
      doneTaskBorderColor: success,
      critBkgColor: error,
      critBorderColor: error,
      todayLineColor: error,
      gridColor: border,
      // 周末/排除区间底纹：mermaid dark 主题给的是灰绿色块，暗底上很扎眼
      excludeBkgColor: mix(surface, warning, 0.10),

      // 饼图
      pieTitleTextColor: text,
      pieSectionTextColor: bestOn(seriesFill(0)),
      pieLegendTextColor: text,
      pieStrokeColor: surface,
      pieOuterStrokeColor: border,
      pieOpacity: '0.92',

      // 用户旅程图
      fillType0: seriesFill(0),
      fillType1: seriesFill(1),
      fillType2: seriesFill(2),
      fillType3: seriesFill(3),
      fillType4: seriesFill(4),
      fillType5: seriesFill(5),
      fillType6: seriesFill(0),
      fillType7: seriesFill(1),

      // 时间线图
      cScale0: seriesFill(0),
      cScale1: seriesFill(1),
      cScale2: seriesFill(2),
      cScale3: seriesFill(3),
      cScale4: seriesFill(4),
      cScale5: seriesFill(5),
      cScale6: seriesFill(0),
      cScale7: seriesFill(1),
      cScale8: seriesFill(2),
      cScale9: seriesFill(3),
      cScale10: seriesFill(4),
      cScale11: seriesFill(5),
      cScaleLabel0: text,
      cScaleLabel1: text,
      cScaleLabel2: text,
      cScaleLabel3: text,
      cScaleLabel4: text,
      cScaleLabel5: text,
      cScaleLabel6: text,
      cScaleLabel7: text,

      // 四象限图
      quadrant1Fill: mix(surface, accent, 0.10),
      quadrant2Fill: mix(surface, accentPink, 0.10),
      quadrant3Fill: mix(surface, success, 0.10),
      quadrant4Fill: mix(surface, warning, 0.12),
      quadrant1TextFill: text,
      quadrant2TextFill: text,
      quadrant3TextFill: text,
      quadrant4TextFill: text,
      quadrantPointFill: accent,
      quadrantPointTextFill: text,
      quadrantXAxisTextFill: text,
      quadrantYAxisTextFill: text,
      quadrantInternalBorderStrokeFill: border,
      quadrantExternalBorderStrokeFill: border,
      quadrantTitleFill: text,

      // Git 分支图
      commitLabelColor: text,
      commitLabelBackground: surface,
      tagLabelColor: bg,
      tagLabelBackground: accent,
      git0: series[0],
      git1: series[1],
      git2: series[2],
      git3: series[3],
      git4: series[4],
      git5: series[5],
      git6: series[0],
      git7: series[1],
      gitBranchLabel0: bestOn(series[0]),
      gitBranchLabel1: bestOn(series[1]),
      gitBranchLabel2: bestOn(series[2]),
      gitBranchLabel3: bestOn(series[3]),
      gitBranchLabel4: bestOn(series[4]),
      gitBranchLabel5: bestOn(series[5]),
      gitBranchLabel6: bestOn(series[0]),
      gitBranchLabel7: bestOn(series[1]),
      gitInv0: bg,
      gitInv1: bg,
      gitInv2: bg,
      gitInv3: bg,
      gitInv4: bg,
      gitInv5: bg,
      gitInv6: bg,
      gitInv7: bg,

      // C4 架构图
      personBkg: surface,
      personBorder: accent,
      systemBkg: surface,
      systemBorder: accent,
      containerBkg: surface,
      containerBorder: border,
      componentBkg: surface,
      componentBorder: border,
      externalPersonBkg: bg,
      externalSystemBkg: bg,
      externalContainerBkg: bg,
      externalComponentBkg: bg,

      // XY 图表
      xyChart: {
        backgroundColor: 'transparent',
        titleColor: text,
        xAxisLabelColor: text,
        xAxisTitleColor: text,
        xAxisTickColor: border,
        xAxisLineColor: border,
        yAxisLabelColor: text,
        yAxisTitleColor: text,
        yAxisTickColor: border,
        yAxisLineColor: border,
        // mermaid 按逗号切分调色板，这里必须给不含逗号的 #hex
        plotColorPalette: series
          .map(c => (CU.parseColor(isDark ? mix(c, surface, 0.15) : c) || {}).hex)
          .filter(Boolean)
          .join(',')
      }
    };

    // 甘特图/饼图等按序号取色的家族：把 12 档配色补齐
    series.forEach((c, i) => {
      vars['pie' + (i + 1)] = isDark ? mix(c, surface, 0.18) : mix(c, bg, 0.45);
    });

    return {
      startOnLoad: false,
      // 显式固化消毒边界：不依赖打包的 mermaid 版本默认值
      securityLevel: 'strict',
      theme: isDark ? 'dark' : 'base',
      themeVariables: vars,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      sequence: {
        useMaxWidth: true,
        diagramMarginX: 20,
        diagramMarginY: 20
      }
    };
  }

  // 按需加载 mermaid 并初始化配置
  async function ensureMermaid() {
    if (typeof mermaid !== 'undefined' && mermaidInitialized) return true;
    if (typeof mermaid === 'undefined') {
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Library not loaded yet, lazy-loading mermaid.min.js');
      try {
        await window.MarkdownPreview.loadScript('iris/vendor/mermaid.min.js');
      } catch (err) {
        // 3.5MB 的大文件在弱网 / 缓存损坏时可能首次加载失败。
        // 换一个带参数 URL 重试一次，绕过可能损坏的缓存条目。
        console.warn('[Mermaid] 首次加载失败，重试一次:', err && err.message);
        try {
          await window.MarkdownPreview.loadScript('iris/vendor/mermaid.min.js?retry=1');
        } catch (err2) {
          console.error('[Mermaid] Library load failed after retry:', err2);
        }
      }
    }
    if (typeof mermaid === 'undefined') {
      console.error('[Mermaid] Library load failed');
      return false;
    }
    if (!mermaidInitialized) {
      mermaid.initialize(buildConfig());
      mermaidInitialized = true;
      bindThemeChange();
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Initialized');
    }
    return true;
  }

  // 主题切换后重渲染已有图表：mermaid.initialize 只生效一次，
  // 不重渲染的话旧图会一直停在切换前的配色上。
  let themeListenerBound = false;
  function bindThemeChange() {
    if (themeListenerBound) return;
    themeListenerBound = true;
    window.addEventListener('themechange', () => {
      if (typeof mermaid === 'undefined') return;
      mermaidInitialized = false;
      // 重新初始化以便下一次 render 使用新配色
      ensureMermaid().catch(() => {});
      rerenderExisting();
    });
  }

  function rerenderExisting() {
    const nodes = document.querySelectorAll('.mermaid-diagram[data-src]');
    nodes.forEach((node) => {
      const src = node.getAttribute('data-src');
      if (!src) return;
      const id = 'mermaid-re-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      Promise.resolve(mermaid.render(id, src))
        .then(({ svg }) => {
          if (svg && node.isConnected) node.innerHTML = svg;
        })
        .catch(() => { /* 单个图表失败不影响其他 */ });
    });
  }

  async function render(root) {
    (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] render() called');

    // 没有任何 mermaid 代码块时直接跳过，避免无谓加载
    if (!hasMermaidBlocks()) {
      (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] No mermaid blocks found, skipping load');
      return;
    }

    const ok = await ensureMermaid();
    if (!ok) return;

    // 容器解析走 mdRender.resolveRoot（split-view 隐藏面板同样带 .markdown-body，
    // 全局查询会命中空面板——见 md-render.js resolveRoot 注释）
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;

    // 先一次性收集所有 mermaid 候选（旧实现每替换一个就重扫全部 pre，
    // O(n²) 且上限 50 个），再顺序替换
    const candidates = [];
    markdownBody.querySelectorAll('pre').forEach(pre => {
      const codeElement = pre.querySelector('code');
      if (!codeElement) return;
      const classList = codeElement.className;
      if (!classList || !classList.includes('language-mermaid')) return;
      candidates.push({ pre, code: codeElement.textContent.trim() });
    });

    let done = 0;
    for (const item of candidates) {
      const { pre, code: mermaidCode } = item;
      if (!document.body.contains(pre)) continue; // 可能已被前置渲染器处理
      const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      try {
        const { svg } = await mermaid.render(id, mermaidCode);

        if (!svg || svg.length === 0) {
          console.error('[Mermaid] SVG is empty!');
          continue;
        }

        const container = document.createElement('div');
        container.className = 'mermaid-diagram';
        container.innerHTML = svg;
        // 源码标记：供悬浮工具条「复制源码」使用（interactions.js）
        container.dataset.src = mermaidCode;

        if (pre.parentNode) {
          pre.parentNode.replaceChild(container, pre);
          done++;
        }
      } catch (error) {
        console.error('[Mermaid] Rendering error:', error);

        // 统一回退约定：错误提示 + 可折叠源码（不丢源码，与 plantuml 一致）
        const errorBox = document.createElement('div');
        errorBox.style.cssText = 'color:#ff6b6b;padding:10px;border:1px solid #ff6b6b;border-radius:4px';
        const msg = document.createElement('div');
        msg.textContent = 'Mermaid 渲染错误: ' + error.message;
        errorBox.appendChild(msg);
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = '查看源码';
        const srcPre = document.createElement('pre');
        srcPre.style.cssText = 'margin-top:8px;white-space:pre-wrap';
        srcPre.textContent = mermaidCode;
        details.appendChild(summary);
        details.appendChild(srcPre);
        errorBox.appendChild(details);

        if (pre.parentNode) {
          pre.parentNode.replaceChild(errorBox, pre);
        }
      }
    }

    (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] render() complete, replaced:', done);
  }

  window.MarkdownPreview.renderers.mermaid = {
    render,
    ensureMermaid // 编辑器 mermaid 画中画（mermaid-pip.js）复用同一份库加载与主题配置
  };

  (window.MarkdownPreview.debug?.debugLog || (() => {}))('[Mermaid] Renderer module loaded and registered');
})();
