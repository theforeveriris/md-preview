/**
 * Pulse 波形渲染器
 *
 * 解析 Dungeonlab+pulse 格式的郊狼波形文件，渲染为逐帧动态波形演示。
 *
 * 语法：[pulse title="标题"]Dungeonlab+pulse:...[/pulse]
 *
 * Dungeonlab+pulse 格式：
 *   Dungeonlab+pulse:<全局参数>=<段参数1>/<段数据1>+section+<段参数2>/<段数据2>+section+...
 *   全局参数：脉冲编号,模式标志,通道数
 *   段参数：  曲线类型,幅度,步进,重复,方向
 *   段数据：  值-关键帧标志,值-关键帧标志,...  （值 0-100，标志 1=关键帧 0=插值点）
 */
(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  var STYLE_ID = 'pulse-renderer-styles';
  var animations = []; // 活跃的动画句柄

  // ============== 注入样式（仅一次） ==============
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.pulse-widget {',
      '  margin: 1.8em auto;',
      '  max-width: 680px;',
      '  border: 1px solid var(--color-border);',
      '  border-radius: 14px;',
      '  overflow: hidden;',
      '  background: var(--color-surface);',
      '  box-shadow: 0 2px 12px rgba(0,0,0,0.06);',
      '  transition: border-color 0.3s, box-shadow 0.3s;',
      '}',
      '.pulse-widget:hover {',
      '  border-color: var(--color-accent-purple);',
      '  box-shadow: 0 4px 18px rgba(0,0,0,0.1);',
      '}',
      '.pulse-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  padding: 12px 16px;',
      '  border-bottom: 1px solid var(--color-border);',
      '  background: linear-gradient(135deg,',
      '    color-mix(in srgb, var(--color-accent-purple) 8%, transparent),',
      '    color-mix(in srgb, var(--color-accent-pink) 6%, transparent));',
      '}',
      '.pulse-title {',
      '  font-size: 15px;',
      '  font-weight: 600;',
      '  color: var(--color-text);',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.pulse-title-icon {',
      '  flex-shrink: 0;',
      '  color: var(--color-accent-purple-deep);',
      '}',
      '.pulse-download-btn {',
      '  flex-shrink: 0;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  padding: 6px 14px;',
      '  font-size: 12px;',
      '  font-weight: 500;',
      '  color: var(--color-accent-purple-deep);',
      '  background: var(--color-surface);',
      '  border: 1px solid var(--color-accent-purple);',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  transition: all 0.2s ease;',
      '  user-select: none;',
      '}',
      '.pulse-download-btn:hover {',
      '  background: var(--color-accent-purple);',
      '  color: var(--color-surface);',
      '}',
      '.pulse-download-btn:active { transform: scale(0.96); }',
      '.pulse-canvas-wrap {',
      '  position: relative;',
      '  width: 100%;',
      '  padding: 14px 16px 10px;',
      '  box-sizing: border-box;',
      '}',
      '.pulse-canvas {',
      '  display: block;',
      '  width: 100%;',
      '  height: 200px;',
      '  border-radius: 8px;',
      '}',
      '.pulse-info {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  padding: 0 16px 12px;',
      '  font-size: 11px;',
      '  color: var(--color-text-muted);',
      '  font-variant-numeric: tabular-nums;',
      '}',
      '.pulse-info-left { display: flex; gap: 14px; }',
      '.pulse-info-badge {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '}',
      '.pulse-error {',
      '  padding: 16px;',
      '  color: var(--color-error, #f44336);',
      '  font-size: 13px;',
      '  text-align: center;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ============== Dungeonlab+pulse 解析器 ==============

  /**
   * 解析 Dungeonlab+pulse 格式字符串
   * @param {string} raw - 原始数据（可能含前后空白）
   * @returns {Object|null} 解析结果 { globalParams, sections } 或 null
   */
  function parsePulseData(raw) {
    var data = raw.trim();
    var prefix = 'Dungeonlab+pulse:';
    if (data.indexOf(prefix) !== 0) return null;

    data = data.substring(prefix.length).trim();

    var eqIdx = data.indexOf('=');
    if (eqIdx === -1) return null;

    var globalStr = data.substring(0, eqIdx);
    var sectionsStr = data.substring(eqIdx + 1);

    var globalParams = globalStr.split(',').map(function(s) {
      return parseInt(s, 10);
    });
    if (globalParams.length < 3 || globalParams.some(isNaN)) return null;

    var sectionParts = sectionsStr.split('+section+');
    var sections = [];

    for (var si = 0; si < sectionParts.length; si++) {
      var part = sectionParts[si].trim();
      if (!part) continue;

      var slashIdx = part.indexOf('/');
      if (slashIdx === -1) return null;

      var paramStr = part.substring(0, slashIdx);
      var dataStr = part.substring(slashIdx + 1);

      var params = paramStr.split(',').map(function(s) {
        return parseInt(s, 10);
      });
      if (params.length < 5 || params.some(isNaN)) return null;

      var pointStrs = dataStr.split(',');
      var points = [];
      for (var pi = 0; pi < pointStrs.length; pi++) {
        var pt = pointStrs[pi].trim();
        if (!pt) continue;
        var dashIdx = pt.lastIndexOf('-');
        if (dashIdx <= 0) continue;
        var value = parseFloat(pt.substring(0, dashIdx));
        var flag = parseInt(pt.substring(dashIdx + 1), 10);
        if (isNaN(value) || isNaN(flag)) continue;
        points.push({ value: value, keyframe: flag === 1 });
      }

      if (points.length === 0) return null;

      sections.push({
        curveType: params[0],
        amplitude: params[1],
        step: params[2],
        repeat: params[3],
        direction: params[4],
        points: points
      });
    }

    if (sections.length === 0) return null;

    return {
      pulseNumber: globalParams[0],
      modeFlag: globalParams[1],
      channelCount: globalParams[2],
      sections: sections
    };
  }

  // ============== 颜色工具 ==============

  function getThemeColors() {
    var cs = getComputedStyle(document.documentElement);
    function var_(name, fallback) {
      var v = cs.getPropertyValue(name).trim();
      return v || fallback;
    }
    return {
      accent: var_('--color-accent-purple', '#d4a5c9'),
      accentDeep: var_('--color-accent-purple-deep', '#b88aad'),
      accentPink: var_('--color-accent-pink', '#f2c4ce'),
      surface: var_('--color-surface', '#ffffff'),
      text: var_('--color-text', '#2d2d2d'),
      textMuted: var_('--color-text-muted', '#999999'),
      border: var_('--color-border', '#f0f0f0')
    };
  }

  // 将 hex 颜色转为 rgba（支持 #rgb / #rrggbb）
  function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ============== 波形绘制 ==============

  /**
   * 将所有段的数据点展开为一条连续波形（按 repeat 展开）
   * @returns {{ values: number[], keyframes: boolean[], sectionMarks: number[] }}
   */
  function expandWaveform(parsed) {
    var values = [];
    var keyframes = [];
    var sectionMarks = []; // 每段起始索引

    for (var si = 0; si < parsed.sections.length; si++) {
      var sec = parsed.sections[si];
      sectionMarks.push(values.length);

      for (var rep = 0; rep < sec.repeat; rep++) {
        // direction=0 正向，direction=1 反向
        var pts = sec.direction === 1 ? sec.points.slice().reverse() : sec.points;
        for (var pi = 0; pi < pts.length; pi++) {
          values.push(pts[pi].value);
          keyframes.push(pts[pi].keyframe);
        }
      }
    }

    return { values: values, keyframes: keyframes, sectionMarks: sectionMarks };
  }

  function drawWaveform(canvas, wave, progress, colors) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth;
    var cssH = canvas.clientHeight;

    // 高 DPI 适配
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var padX = 8;
    var padY = 16;
    var w = cssW - padX * 2;
    var h = cssH - padY * 2;
    var values = wave.values;
    var n = values.length;
    if (n < 2) return;

    var stepX = w / (n - 1);

    // ---- 背景网格 ----
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    // 水平中线
    ctx.beginPath();
    ctx.moveTo(padX, padY + h / 2);
    ctx.lineTo(padX + w, padY + h / 2);
    ctx.stroke();
    // 水平刻度线 (25%, 75%)
    [0.25, 0.75].forEach(function(frac) {
      ctx.beginPath();
      ctx.moveTo(padX, padY + h * frac);
      ctx.lineTo(padX + w, padY + h * frac);
      ctx.globalAlpha = 0.25;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // ---- 段分隔线 ----
    for (var mi = 0; mi < wave.sectionMarks.length; mi++) {
      var markIdx = wave.sectionMarks[mi];
      if (markIdx === 0) continue;
      var mx = padX + markIdx * stepX;
      ctx.strokeStyle = colors.textMuted;
      ctx.globalAlpha = 0.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(mx, padY);
      ctx.lineTo(mx, padY + h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // ---- 完整波形（淡色背景） ----
    function valueToY(v) {
      return padY + h - (v / 100) * h;
    }

    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var x = padX + i * stepX;
      var y = valueToY(values[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ---- 已播放部分（填充 + 描边） ----
    var playheadIdx = progress * (n - 1);
    var playInt = Math.floor(playheadIdx);
    var playFrac = playheadIdx - playInt;

    // 填充区域
    ctx.beginPath();
    ctx.moveTo(padX, padY + h);
    for (var j = 0; j <= playInt && j < n; j++) {
      ctx.lineTo(padX + j * stepX, valueToY(values[j]));
    }
    // 插值到播放头位置
    if (playInt < n - 1) {
      var interpValue = values[playInt] + (values[playInt + 1] - values[playInt]) * playFrac;
      var interpX = padX + (playInt + playFrac) * stepX;
      ctx.lineTo(interpX, valueToY(interpValue));
    }
    var lastX = padX + Math.min(playInt, n - 1) * stepX;
    if (playInt < n - 1) lastX = interpX;
    ctx.lineTo(lastX, padY + h);
    ctx.closePath();

    var grad = ctx.createLinearGradient(0, padY, 0, padY + h);
    grad.addColorStop(0, hexToRgba(colors.accent, 0.45));
    grad.addColorStop(1, hexToRgba(colors.accent, 0.05));
    ctx.fillStyle = grad;
    ctx.fill();

    // 描边
    ctx.strokeStyle = colors.accentDeep;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var k = 0; k <= playInt && k < n; k++) {
      var kx = padX + k * stepX;
      var ky = valueToY(values[k]);
      if (k === 0) ctx.moveTo(kx, ky);
      else ctx.lineTo(kx, ky);
    }
    if (playInt < n - 1) {
      ctx.lineTo(interpX, valueToY(interpValue));
    }
    ctx.stroke();

    // ---- 关键帧标记 ----
    for (var kf = 0; kf <= playInt && kf < n; kf++) {
      if (wave.keyframes[kf]) {
        var kfx = padX + kf * stepX;
        var kfy = valueToY(values[kf]);
        ctx.fillStyle = colors.accentPink;
        ctx.beginPath();
        ctx.arc(kfx, kfy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ---- 播放头光标 ----
    if (playInt < n - 1) {
      var cursorValue = values[playInt] + (values[playInt + 1] - values[playInt]) * playFrac;
    } else {
      cursorValue = values[n - 1];
    }
    var cursorX = padX + playheadIdx * stepX;
    var cursorY = valueToY(cursorValue);

    // 竖线
    ctx.strokeStyle = colors.accentDeep;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cursorX, padY);
    ctx.lineTo(cursorX, padY + h);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 光标圆点
    ctx.fillStyle = colors.accentDeep;
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.arc(cursorX, cursorY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ============== 动画管理 ==============

  function startAnimation(canvas, wave, infoLeftEl) {
    var colors = getThemeColors();
    var duration = Math.max(2000, wave.values.length * 60); // 总时长
    var startTime = null;
    var rafId = null;
    var running = true;

    function frame(timestamp) {
      if (!running) return;
      if (startTime === null) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = (elapsed % duration) / duration;

      drawWaveform(canvas, wave, progress, colors);

      if (infoLeftEl) {
        var currentIdx = Math.floor(progress * (wave.values.length - 1));
        var pct = Math.round(progress * 100);
        infoLeftEl.textContent = '进度 ' + pct + '% · 帧 ' + (currentIdx + 1) + '/' + wave.values.length;
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    // 主题切换时刷新颜色
    function onThemeChange() {
      colors = getThemeColors();
    }
    window.addEventListener('themechange', onThemeChange);

    return {
      stop: function() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('themechange', onThemeChange);
      },
      refreshColors: function() {
        colors = getThemeColors();
      }
    };
  }

  // ============== 下载功能 ==============

  function downloadPulse(rawData, title) {
    var blob = new Blob([rawData.trim()], { type: 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var safeName = (title || 'pulse').replace(/[^\w\u4e00-\u9fa5-]/g, '_');
    a.download = safeName + '.pulse';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 200);
  }

  // ============== HTML 实体解码 ==============

  function decodeEntities(str) {
    var txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  // ============== 创建单个 pulse 部件 ==============

  function createPulseWidget(title, rawData) {
    var parsed = parsePulseData(rawData);

    if (!parsed) {
      var errDiv = document.createElement('div');
      errDiv.className = 'pulse-widget';
      errDiv.innerHTML = '<div class="pulse-error">Pulse 数据解析失败：格式不符合 Dungeonlab+pulse 规范</div>';
      return errDiv;
    }

    var wave = expandWaveform(parsed);

    // 容器
    var widget = document.createElement('div');
    widget.className = 'pulse-widget';

    // 头部：标题 + 下载按钮
    var header = document.createElement('div');
    header.className = 'pulse-header';

    var titleEl = document.createElement('div');
    titleEl.className = 'pulse-title';
    titleEl.innerHTML =
      '<span class="pulse-title-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>' +
      '<span>' + escapeHtml(title || ('Pulse #' + parsed.pulseNumber)) + '</span>';

    var dlBtn = document.createElement('button');
    dlBtn.className = 'pulse-download-btn';
    dlBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
      '<span>下载</span>';
    dlBtn.addEventListener('click', function() {
      downloadPulse(rawData, title);
    });

    header.appendChild(titleEl);
    header.appendChild(dlBtn);

    // 画布区域
    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'pulse-canvas-wrap';
    var canvas = document.createElement('canvas');
    canvas.className = 'pulse-canvas';
    canvasWrap.appendChild(canvas);

    // 底部信息
    var info = document.createElement('div');
    info.className = 'pulse-info';
    var infoLeft = document.createElement('div');
    infoLeft.className = 'pulse-info-left';
    var infoRight = document.createElement('div');
    var totalPoints = wave.values.length;
    var totalSections = parsed.sections.length;
    infoRight.textContent =
      '通道 ' + parsed.channelCount + ' · ' + totalSections + ' 段 · ' + totalPoints + ' 帧';
    info.appendChild(infoLeft);
    info.appendChild(infoRight);

    widget.appendChild(header);
    widget.appendChild(canvasWrap);
    widget.appendChild(info);

    // 启动动画（下一帧，确保 canvas 已布局）
    requestAnimationFrame(function() {
      var anim = startAnimation(canvas, wave, infoLeft);
      animations.push(anim);
    });

    return widget;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============== 主渲染入口 ==============

  function render(container) {
    // 停止旧动画
    animations.forEach(function(a) { a.stop(); });
    animations = [];

    injectStyles();

    var targetEl = container || (window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent);
    if (!targetEl) return;

    // 匹配 [pulse title="..."]...[/pulse] 标签
    // 标题属性可选，支持单引号或双引号
    var pulseRegex = /\[pulse(?:\s+title\s*=\s*(?:"([^"]*)"|'([^']*)'))?\]([\s\S]*?)\[\/pulse\]/gi;

    var html = targetEl.innerHTML;
    var match;
    var replacements = [];

    while ((match = pulseRegex.exec(html)) !== null) {
      var title = match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : '');
      var rawData = decodeEntities(match[3].trim());
      replacements.push({ matchStr: match[0], title: title, rawData: rawData, index: match.index });
    }

    if (replacements.length === 0) return;

    // 按位置降序排列，从后往前替换避免索引偏移
    var sorted = replacements.slice().sort(function(a, b) { return b.index - a.index; });
    for (var i = 0; i < sorted.length; i++) {
      var rep = sorted[i];
      var repIdx = replacements.indexOf(rep);
      var placeholder = '<div data-pulse-placeholder="' + repIdx + '"></div>';
      html = html.substring(0, rep.index) + placeholder + html.substring(rep.index + rep.matchStr.length);
    }

    targetEl.innerHTML = html;

    // 将占位符替换为实际的 pulse 部件
    var placeholders = targetEl.querySelectorAll('[data-pulse-placeholder]');
    placeholders.forEach(function(ph) {
      var repIdx = parseInt(ph.getAttribute('data-pulse-placeholder'), 10);
      var rep = replacements[repIdx];
      if (rep) {
        var widget = createPulseWidget(rep.title, rep.rawData);
        // 如果占位符在 <p> 内，替换整个 <p>
        var parentP = ph.closest('p');
        if (parentP && parentP.textContent.trim() === '') {
          parentP.parentNode.replaceChild(widget, parentP);
        } else {
          ph.parentNode.replaceChild(widget, ph);
        }
      }
    });
  }

  // ============== 注册 ==============

  window.MarkdownPreview.renderers.pulse = {
    render: render,
    parsePulseData: parsePulseData,
    expandWaveform: expandWaveform
  };

  console.log('[Pulse] Renderer module loaded and registered');
})();
