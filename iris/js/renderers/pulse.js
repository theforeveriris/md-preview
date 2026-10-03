/**
 * Pulse 波形渲染器（DG-LAB 郊狼官方格式）
 *
 * 解析 Dungeonlab+pulse 格式的郊狼波形文件，渲染为逐帧动态波形演示。
 * 基于 DG-LAB 3.4.4 版本波形文件导出规范。
 *
 * 语法：[pulse title="标题"]Dungeonlab+pulse:...[/pulse]
 *
 * 格式总览：
 *   Dungeonlab+pulse:<全局参数>=<小节1>+section+<小节2>+section+...
 *   全局参数： 休息时长(0-99), 速度倍率(1/2/4), 未知参数(默认16)
 *   小节参数： 频率A(0-83), 频率B(0-83), 小节时长(0-99), 频率模式(1-4), 小节开关(0-1)
 *   数据点：   强度(0-100)-类型(0=普通脉冲/1=锚点脉冲), 每点=0.1s竖条
 *   分隔符：   +section+ 分隔小节，/ 分隔小节参数与数据，= 分隔全局与首小节
 *
 * 特殊格式：
 *   某些导出文件省略 = 分隔符，首小节参数紧跟在 Dungeonlab+pulse: 之后。
 */
(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  var STYLE_ID = 'pulse-renderer-styles';
  var animations = [];

  // ============== 映射表 ==============

  var FREQ_SLIDER_MAP = [
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
    30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
    50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78,
    80, 85, 90, 95,
    100, 110, 120, 130, 140, 150, 160, 170, 180, 190,
    200, 233, 266, 300, 333, 366,
    400, 450, 500, 550,
    600, 700, 800, 900, 1000
  ];

  var SECTION_TIME_MAP = (function() {
    var m = [];
    var i;
    for (i = 0; i <= 39; i++) m.push(+(0.1 + i * 0.1).toFixed(1));
    for (i = 40; i <= 44; i++) m.push(+(5.0 + (i - 40) * 0.2).toFixed(1));
    for (i = 45; i <= 49; i++) m.push(+(6.0 + (i - 45) * 0.2).toFixed(1));
    for (i = 50; i <= 54; i++) m.push(+(7.0 + (i - 50) * 0.2).toFixed(1));
    m.push(8.0, 8.5, 9.0, 9.5);
    m.push(10.0);
    for (i = 60; i <= 69; i++) m.push(10 + (i - 59));
    m.push(23.4, 26.6, 30.0, 33.4, 36.6);
    m.push(40.0, 45.0, 50.0, 55.0);
    m.push(60.0, 70.0, 80.0, 90.0);
    m.push(100.0, 120.0, 140.0, 160.0, 180.0);
    m.push(200.0, 250.0, 300.0);
    while (m.length < 100) m.push(300.0);
    return m;
  })();

  var FREQ_MODE_NAMES = ['', '固定', '节内渐变', '元内渐变', '元间渐变'];

  // ============== 注入样式 ==============
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.pulse-widget {',
      '  margin: 1.8em auto;',
      '  max-width: 710px;',
      '  border: 1px solid var(--color-border);',
      '  border-radius: 12px;',
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
      '  padding: 7px 11px;',
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
      '.pulse-style-toggle {',
      '  flex-shrink: 0;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  padding: 6px 12px;',
      '  font-size: 12px;',
      '  font-weight: 500;',
      '  color: var(--color-text-muted);',
      '  background: transparent;',
      '  border: 1px solid var(--color-border);',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  transition: all 0.2s ease;',
      '  user-select: none;',
      '  margin-right: 8px;',
      '}',
      '.pulse-style-toggle:hover {',
      '  color: var(--color-accent-purple-deep);',
      '  border-color: var(--color-accent-purple);',
      '}',
      '.pulse-style-toggle:active { transform: scale(0.96); }',
      '.pulse-source-btn {',
      '  flex-shrink: 0;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  padding: 6px 12px;',
      '  font-size: 12px;',
      '  font-weight: 500;',
      '  color: var(--color-text-muted);',
      '  background: transparent;',
      '  border: 1px solid var(--color-border);',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  transition: all 0.2s ease;',
      '  user-select: none;',
      '  margin-right: 8px;',
      '}',
      '.pulse-source-btn:hover {',
      '  color: var(--color-accent-purple-deep);',
      '  border-color: var(--color-accent-purple);',
      '}',
      '.pulse-source-btn:active { transform: scale(0.96); }',
      '.pulse-source-btn.active {',
      '  color: var(--color-accent-purple-deep);',
      '  border-color: var(--color-accent-purple);',
      '  background: color-mix(in srgb, var(--color-accent-purple) 10%, transparent);',
      '}',
      '.pulse-source-panel {',
      '  display: none;',
      '  border-top: 1px solid var(--color-border);',
      '  background: var(--color-code-bg, #f6f8fa);',
      '  padding: 7px 11px;',
      '  max-height: 230px;',
      '  overflow: auto;',
      '}',
      '.pulse-source-panel.open { display: block; }',
      '.pulse-source-panel pre {',
      '  margin: 0;',
      '  padding: 0;',
      '  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;',
      '  font-size: 11.5px;',
      '  line-height: 1.6;',
      '  color: var(--color-text, #2d2d2d);',
      '  white-space: pre-wrap;',
      '  word-break: break-all;',
      '  background: transparent;',
      '}',
      '.pulse-header-right { display: flex; align-items: center; }',
      '.pulse-canvas-wrap {',
      '  position: relative;',
      '  width: 100%;',
      '  padding: 9px 11px 5px;',
      '  box-sizing: border-box;',
      '}',
      '.pulse-canvas {',
      '  display: block;',
      '  width: 100%;',
      '  height: 210px;',
      '  border-radius: 8px;',
      '}',
      '.pulse-info {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  padding: 0 11px 7px;',
      '  font-size: 11px;',
      '  color: var(--color-text-muted);',
      '  font-variant-numeric: tabular-nums;',
      '  flex-wrap: wrap;',
      '  gap: 6px;',
      '}',
      '.pulse-info-left { display: flex; gap: 14px; flex-wrap: wrap; }',
      '.pulse-info-right { display: flex; gap: 14px; flex-wrap: wrap; }',
      '.pulse-info-badge {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '}',
      '.pulse-section-legend {',
      '  display: flex;',
      '  flex-wrap: wrap;',
      '  gap: 6px 12px;',
      '  padding: 0 11px 7px;',
      '  font-size: 11px;',
      '  color: var(--color-text-muted);',
      '}',
      '.pulse-section-tag {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '  padding: 2px 8px;',
      '  border-radius: 10px;',
      '  background: color-mix(in srgb, var(--color-accent-purple) 12%, transparent);',
      '  color: var(--color-accent-purple-deep);',
      '  font-size: 10px;',
      '  font-weight: 500;',
      '}',
      '.pulse-section-tag.disabled {',
      '  background: var(--color-border);',
      '  color: var(--color-text-muted);',
      '  text-decoration: line-through;',
      '}',
      '.pulse-section-tag .dot {',
      '  width: 6px;',
      '  height: 6px;',
      '  border-radius: 50%;',
      '  background: currentColor;',
      '}',
      '.pulse-error {',
      '  padding: 16px;',
      '  color: var(--color-error, #f44336);',
      '  font-size: 13px;',
      '  text-align: center;',
      '}',
      '@media (max-width: 600px) {',
      '  .pulse-widget { margin: 1.2em auto; border-radius: 12px; }',
      '  .pulse-header { padding: 10px 12px; }',
      '  .pulse-title { font-size: 14px; }',
      '  .pulse-title-icon svg { width: 16px; height: 16px; }',
      '  .pulse-style-toggle, .pulse-source-btn {',
      '    padding: 6px 8px;',
      '    margin-right: 6px;',
      '  }',
      '  .pulse-style-toggle span, .pulse-source-btn span { display: none; }',
      '  .pulse-download-btn {',
      '    padding: 6px 10px;',
      '    font-size: 11px;',
      '  }',
      '  .pulse-download-btn span { display: none; }',
      '  .pulse-canvas-wrap { padding: 10px 12px 8px; }',
      '  .pulse-canvas { height: 180px; }',
      '  .pulse-section-legend { padding: 0 12px 10px; font-size: 10px; gap: 4px 8px; }',
      '  .pulse-section-tag { padding: 2px 6px; font-size: 9px; }',
      '  .pulse-info { padding: 0 12px 10px; font-size: 10px; gap: 4px; }',
      '  .pulse-info-left, .pulse-info-right { gap: 10px; }',
      '  .pulse-source-panel { padding: 10px 12px; max-height: 200px; }',
      '  .pulse-source-panel pre { font-size: 10.5px; line-height: 1.5; }',
      '}',
      '@media (max-width: 400px) {',
      '  .pulse-canvas { height: 160px; }',
      '  .pulse-title { font-size: 13px; }',
      '  .pulse-header { padding: 8px 10px; }',
      '  .pulse-style-toggle, .pulse-source-btn { padding: 5px 7px; margin-right: 5px; }',
      '  .pulse-download-btn { padding: 5px 8px; }',
      '}',
      '.pulse-mini-widget {',
      '  display: inline-block;',
      '  vertical-align: middle;',
      '  width: 220px;',
      '  margin: 0.5em;',
      '  border: 1px solid var(--color-border);',
      '  border-radius: 8px;',
      '  overflow: hidden;',
      '  background: var(--color-surface);',
      '  transition: border-color 0.2s;',
      '}',
      '.pulse-mini-widget:hover {',
      '  border-color: var(--color-accent-purple);',
      '}',
      '.pulse-mini-header {',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  padding: 5px 8px 5px 10px;',
      '  border-bottom: 1px solid var(--color-border);',
      '}',
      '.pulse-mini-title {',
      '  font-size: 11px;',
      '  font-weight: 600;',
      '  color: var(--color-text);',
      '  white-space: nowrap;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  flex: 1;',
      '  margin-right: 6px;',
      '}',
      '.pulse-mini-actions {',
      '  display: flex;',
      '  gap: 1px;',
      '  flex-shrink: 0;',
      '}',
      '.pulse-mini-btn {',
      '  padding: 4px 5px;',
      '  border: none;',
      '  border-radius: 4px;',
      '  background: transparent;',
      '  color: var(--color-text-muted);',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transition: all 0.15s;',
      '}',
      '.pulse-mini-btn:hover {',
      '  background: var(--color-bg);',
      '  color: var(--color-accent-purple);',
      '}',
      '.pulse-mini-canvas-wrap {',
      '  padding: 6px;',
      '}',
      '.pulse-mini-canvas {',
      '  display: block;',
      '  width: 100%;',
      '  height: 70px;',
      '  border-radius: 5px;',
      '  background: var(--color-bg);',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ============== 工具函数 ==============

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

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function decodeEntities(str) {
    var txt = document.createElement('textarea');
    txt.innerHTML = str;
    return txt.value;
  }

  function freqSliderToMs(val) {
    var idx = Math.max(0, Math.min(83, Math.round(val)));
    return FREQ_SLIDER_MAP[idx] || 10;
  }

  function sectionSliderToSec(val) {
    var idx = Math.max(0, Math.min(99, Math.round(val)));
    return SECTION_TIME_MAP[idx] || 0.1;
  }

  // ============== 解析器 ==============

  function parsePulseData(raw) {
    var data = raw.trim();
    var prefix = 'Dungeonlab+pulse:';
    if (data.indexOf(prefix) !== 0) return null;

    data = data.substring(prefix.length).trim();
    if (!data) return null;

    var globalStr, sectionsStr;
    var eqIdx = data.indexOf('=');

    if (eqIdx === -1) {
      globalStr = '0,1,16';
      sectionsStr = data;
    } else {
      globalStr = data.substring(0, eqIdx);
      sectionsStr = data.substring(eqIdx + 1);
    }

    var globalParams = globalStr.split(',').map(function(s) {
      return parseInt(s.trim(), 10);
    });
    if (globalParams.length < 3) {
      while (globalParams.length < 3) globalParams.push(16);
    }
    if (globalParams.some(isNaN)) return null;

    var restSlider = globalParams[0];
    var speedMultiplier = globalParams[1];
    var unknownParam = globalParams[2];

    if (speedMultiplier !== 1 && speedMultiplier !== 2 && speedMultiplier !== 4) {
      speedMultiplier = 1;
    }

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
        return parseInt(s.trim(), 10);
      });
      if (params.length < 5) {
        while (params.length < 5) params.push(0);
      }
      if (params.some(isNaN)) return null;

      var freqA = params[0];
      var freqB = params[1];
      var durationSlider = params[2];
      var freqMode = params[3];
      var enabled = params[4] === 1;

      if (freqMode < 1 || freqMode > 4) freqMode = 1;

      var pointStrs = dataStr.split(',');
      var points = [];
      for (var pi = 0; pi < pointStrs.length; pi++) {
        var pt = pointStrs[pi].trim();
        if (!pt) continue;
        var dashIdx = pt.lastIndexOf('-');
        if (dashIdx <= 0) continue;
        var value = parseFloat(pt.substring(0, dashIdx));
        var type = parseInt(pt.substring(dashIdx + 1), 10);
        if (isNaN(value) || isNaN(type)) continue;
        if (value < 0) value = 0;
        if (value > 100) value = 100;
        points.push({ value: value, anchor: type === 1 });
      }

      if (points.length < 2) return null;

      var pulseMetaSec = points.length * 0.1;
      var sectionSec = sectionSliderToSec(durationSlider);

      sections.push({
        index: si,
        freqA: freqA,
        freqB: freqB,
        durationSlider: durationSlider,
        durationSec: sectionSec,
        freqMode: freqMode,
        enabled: enabled,
        points: points,
        pulseMetaSec: pulseMetaSec
      });
    }

    if (sections.length === 0) return null;

    var restSec = restSlider * 0.1;
    var enabledSections = sections.filter(function(s) { return s.enabled; });
    var totalPlaySec = 0;
    enabledSections.forEach(function(s) {
      totalPlaySec += s.durationSec;
    });
    var totalCycleSec = (totalPlaySec + restSec) / speedMultiplier;

    return {
      restSlider: restSlider,
      restSec: restSec,
      speedMultiplier: speedMultiplier,
      unknownParam: unknownParam,
      sections: sections,
      totalPlaySec: totalPlaySec,
      totalCycleSec: totalCycleSec,
      enabledCount: enabledSections.length
    };
  }

  // ============== 波形展开 ==============

  function expandWaveform(parsed) {
    var values = [];
    var anchors = [];
    var sectionMarks = [];
    var sectionIndices = [];
    var restStartIdx = -1;

    for (var si = 0; si < parsed.sections.length; si++) {
      var sec = parsed.sections[si];
      if (!sec.enabled) continue;

      sectionMarks.push(values.length);
      sectionIndices.push(sec.index);

      var totalPoints = Math.max(2, Math.round(sec.durationSec / 0.1));
      var metaLen = sec.points.length;
      var filled = 0;

      while (filled < totalPoints) {
        var remaining = totalPoints - filled;
        var take = Math.min(metaLen, remaining);
        for (var pi = 0; pi < take; pi++) {
          values.push(sec.points[pi].value);
          anchors.push(sec.points[pi].anchor);
        }
        filled += take;
      }
    }

    if (parsed.restSec > 0 && values.length > 0) {
      restStartIdx = values.length;
      var restPoints = Math.round(parsed.restSec / 0.1);
      for (var ri = 0; ri < restPoints; ri++) {
        values.push(0);
        anchors.push(false);
      }
    }

    return {
      values: values,
      anchors: anchors,
      sectionMarks: sectionMarks,
      sectionIndices: sectionIndices,
      restStartIdx: restStartIdx,
      totalPoints: values.length,
      totalSec: values.length * 0.1
    };
  }

  // ============== 波形绘制 ==============

  function drawWaveform(canvas, wave, progress, colors, style, viewMode) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth;
    var cssH = canvas.clientHeight;

    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var padX = 12;
    var padY = 18;
    var w = cssW - padX * 2;
    var h = cssH - padY * 2;
    var n = wave.totalPoints;
    if (n < 2) return;

    function valueToY(v) {
      return padY + h - (v / 100) * h;
    }

    var playheadIdx = progress * (n - 1);

    if (viewMode === 'scroll') {
      // ====== 滚动模式 ======
      var scrollStepX = w * 0.015;
      var playheadFixedX = padX + w * 0.5;
      var pointsVisible = Math.floor(w / scrollStepX);
      var centerIdx = playheadIdx;
      var startIdx = centerIdx - Math.floor(pointsVisible * 0.5);
      var endIdx = startIdx + pointsVisible;

      function idxToScrollX(idx) {
        return playheadFixedX + (idx - centerIdx) * scrollStepX;
      }

      // 左右渐隐遮罩
      var fadeW = 30;
      var leftFade = ctx.createLinearGradient(padX, 0, padX + fadeW, 0);
      leftFade.addColorStop(0, colors.surface);
      leftFade.addColorStop(1, 'transparent');
      var rightFade = ctx.createLinearGradient(padX + w - fadeW, 0, padX + w, 0);
      rightFade.addColorStop(0, 'transparent');
      rightFade.addColorStop(1, colors.surface);

      if (style === 'bars') {
        var barW = Math.max(1, scrollStepX * 0.6);
        for (var bi = Math.floor(startIdx); bi <= Math.ceil(endIdx); bi++) {
          if (bi < 0 || bi >= n) continue;
          var bx = idxToScrollX(bi);
          if (bx < padX - barW || bx > padX + w + barW) continue;
          var by = valueToY(wave.values[bi]);
          var bh = padY + h - by;
          if (bh <= 0) continue;
          var isPlayed = bi <= playheadIdx;
          if (isPlayed) {
            var barGrad = ctx.createLinearGradient(0, by, 0, padY + h);
            barGrad.addColorStop(0, colors.accentDeep);
            barGrad.addColorStop(1, hexToRgba(colors.accent, 0.35));
            ctx.fillStyle = barGrad;
          } else {
            ctx.fillStyle = hexToRgba(colors.accent, 0.18);
          }
          ctx.fillRect(bx - barW / 2, by, barW, bh);
          if (wave.anchors[bi] && wave.values[bi] > 0) {
            ctx.fillStyle = colors.accentPink;
            ctx.fillRect(bx - barW / 2 - 1, by - 2, barW + 2, 2);
          }
        }
      } else {
        // 曲线模式
        ctx.strokeStyle = colors.accent;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        var firstPt = true;
        for (var ci = Math.floor(startIdx); ci <= Math.ceil(endIdx); ci++) {
          if (ci < 0 || ci >= n) continue;
          var cx = idxToScrollX(ci);
          if (cx < padX - 5 || cx > padX + w + 5) continue;
          var cy = valueToY(wave.values[ci]);
          if (firstPt) { ctx.moveTo(cx, cy); firstPt = false; }
          else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // 已播放部分填充
        var playInt2 = Math.floor(playheadIdx);
        var playFrac2 = playheadIdx - playInt2;
        if (playInt2 >= startIdx) {
          ctx.beginPath();
          ctx.moveTo(playheadFixedX, padY + h);
          for (var k = Math.floor(startIdx); k <= playInt2 && k < n; k++) {
            if (k < 0) continue;
            var kx = idxToScrollX(k);
            if (kx < padX - 5) continue;
            ctx.lineTo(kx, valueToY(wave.values[k]));
          }
          if (playInt2 < n - 1) {
            var interpVal = wave.values[playInt2] + (wave.values[playInt2 + 1] - wave.values[playInt2]) * playFrac2;
            ctx.lineTo(playheadFixedX, valueToY(interpVal));
          }
          ctx.closePath();
          var grad = ctx.createLinearGradient(0, padY, 0, padY + h);
          grad.addColorStop(0, hexToRgba(colors.accent, 0.45));
          grad.addColorStop(1, hexToRgba(colors.accent, 0.05));
          ctx.fillStyle = grad;
          ctx.fill();

          // 已播放描边
          ctx.strokeStyle = colors.accentDeep;
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.beginPath();
          firstPt = true;
          for (var k2 = Math.floor(startIdx); k2 <= playInt2 && k2 < n; k2++) {
            if (k2 < 0) continue;
            var k2x = idxToScrollX(k2);
            if (k2x < padX - 5) continue;
            var k2y = valueToY(wave.values[k2]);
            if (firstPt) { ctx.moveTo(k2x, k2y); firstPt = false; }
            else ctx.lineTo(k2x, k2y);
          }
          if (playInt2 < n - 1) {
            var interpVal2 = wave.values[playInt2] + (wave.values[playInt2 + 1] - wave.values[playInt2]) * playFrac2;
            ctx.lineTo(playheadFixedX, valueToY(interpVal2));
          }
          ctx.stroke();

          // 锚点
          for (var ai = Math.floor(startIdx); ai <= playInt2 && ai < n; ai++) {
            if (ai < 0) continue;
            if (wave.anchors[ai] && wave.values[ai] > 0) {
              var ax = idxToScrollX(ai);
              if (ax < padX - 5 || ax > padX + w + 5) continue;
              var ay = valueToY(wave.values[ai]);
              ctx.fillStyle = colors.accentPink;
              ctx.beginPath();
              ctx.arc(ax, ay, 3, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = colors.surface;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }

      // 渐隐遮罩
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      var leftGrad = ctx.createLinearGradient(padX, 0, padX + fadeW, 0);
      leftGrad.addColorStop(0, 'rgba(0,0,0,1)');
      leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(padX, padY, fadeW, h);
      var rightGrad = ctx.createLinearGradient(padX + w - fadeW, 0, padX + w, 0);
      rightGrad.addColorStop(0, 'rgba(0,0,0,0)');
      rightGrad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = rightGrad;
      ctx.fillRect(padX + w - fadeW, padY, fadeW, h);
      ctx.restore();

      // 中心播放头
      var cursorVal;
      var playInt = Math.floor(playheadIdx);
      var playFrac = playheadIdx - playInt;
      if (playInt < n - 1) {
        cursorVal = wave.values[playInt] + (wave.values[playInt + 1] - wave.values[playInt]) * playFrac;
      } else {
        cursorVal = wave.values[n - 1];
      }
      var cursorY = valueToY(cursorVal);
      ctx.strokeStyle = colors.accentDeep;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadFixedX, padY);
      ctx.lineTo(playheadFixedX, padY + h);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.accentDeep;
      ctx.beginPath();
      ctx.arc(playheadFixedX, cursorY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.surface;
      ctx.beginPath();
      ctx.arc(playheadFixedX, cursorY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      return;
    }

    var stepX = w / (n - 1);

    // ---- 休息段背景（淡色） ----
    if (wave.restStartIdx > 0 && wave.restStartIdx < n) {
      var restX = padX + wave.restStartIdx * stepX;
      ctx.fillStyle = hexToRgba(colors.textMuted, 0.06);
      ctx.fillRect(restX, padY, padX + w - restX, h);
      ctx.strokeStyle = colors.textMuted;
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(restX, padY);
      ctx.lineTo(restX, padY + h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.textMuted;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('休息', padX + w - 4, padY + 12);
    }

    var playheadIdx = progress * (n - 1);

    if (style === 'bars') {
      // ====== 竖线模式（官方样式） ======
      var barW = Math.max(1, stepX * 0.6);

      // 背景竖线（淡色）
      for (var bi = 0; bi < n; bi++) {
        var bx = padX + bi * stepX;
        var by = valueToY(wave.values[bi]);
        var bh = padY + h - by;
        if (bh <= 0) continue;
        ctx.fillStyle = hexToRgba(colors.accent, 0.18);
        ctx.fillRect(bx - barW / 2, by, barW, bh);
      }

      // 已播放竖线（亮色）
      var playInt = Math.floor(playheadIdx);
      for (var pi = 0; pi <= playInt && pi < n; pi++) {
        var px = padX + pi * stepX;
        var py = valueToY(wave.values[pi]);
        var ph = padY + h - py;
        if (ph <= 0) continue;
        var barGrad = ctx.createLinearGradient(0, py, 0, padY + h);
        barGrad.addColorStop(0, colors.accentDeep);
        barGrad.addColorStop(1, hexToRgba(colors.accent, 0.35));
        ctx.fillStyle = barGrad;
        ctx.fillRect(px - barW / 2, py, barW, ph);
        // 锚点顶部标记
        if (wave.anchors[pi] && wave.values[pi] > 0) {
          ctx.fillStyle = colors.accentPink;
          ctx.fillRect(px - barW / 2 - 1, py - 2, barW + 2, 2);
        }
      }

      // 小节分隔线
      for (var mi = 0; mi < wave.sectionMarks.length; mi++) {
        var markIdx = wave.sectionMarks[mi];
        if (markIdx === 0) continue;
        var mx = padX + markIdx * stepX;
        ctx.strokeStyle = colors.accentPink;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(mx, padY);
        ctx.lineTo(mx, padY + h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.textMuted;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        var secNum = wave.sectionIndices[mi] + 1;
        ctx.fillText('S' + secNum, mx, padY + h - 2);
      }

      // 播放头
      var playFrac = playheadIdx - playInt;
      var cursorValue;
      if (playInt < n - 1) {
        cursorValue = wave.values[playInt] + (wave.values[playInt + 1] - wave.values[playInt]) * playFrac;
      } else {
        cursorValue = wave.values[n - 1];
      }
      var cursorX = padX + playheadIdx * stepX;
      var cursorY = valueToY(cursorValue);
      ctx.strokeStyle = colors.accentDeep;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cursorX, padY);
      ctx.lineTo(cursorX, padY + h);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.accentDeep;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.surface;
      ctx.beginPath();
      ctx.arc(cursorX, cursorY, 2.5, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // ====== 曲线模式（默认） ======
      // 背景网格
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(padX, padY + h / 2);
      ctx.lineTo(padX + w, padY + h / 2);
      ctx.stroke();
      [0.25, 0.75].forEach(function(frac) {
        ctx.beginPath();
        ctx.moveTo(padX, padY + h * frac);
        ctx.lineTo(padX + w, padY + h * frac);
        ctx.globalAlpha = 0.25;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // 小节分隔线
      for (var mi2 = 0; mi2 < wave.sectionMarks.length; mi2++) {
        var markIdx2 = wave.sectionMarks[mi2];
        if (markIdx2 === 0) continue;
        var mx2 = padX + markIdx2 * stepX;
        ctx.strokeStyle = colors.accentPink;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(mx2, padY);
        ctx.lineTo(mx2, padY + h);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.textMuted;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        var secNum2 = wave.sectionIndices[mi2] + 1;
        ctx.fillText('S' + secNum2, mx2, padY + h - 2);
      }

      // 完整波形（淡色背景）
      ctx.strokeStyle = colors.accent;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var x = padX + i * stepX;
        var y = valueToY(wave.values[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 已播放部分
      var playInt2 = Math.floor(playheadIdx);
      var playFrac2 = playheadIdx - playInt2;

      if (playInt2 >= 0) {
        ctx.beginPath();
        ctx.moveTo(padX, padY + h);
        for (var j = 0; j <= playInt2 && j < n; j++) {
          ctx.lineTo(padX + j * stepX, valueToY(wave.values[j]));
        }
        var interpValue, interpX;
        if (playInt2 < n - 1) {
          interpValue = wave.values[playInt2] + (wave.values[playInt2 + 1] - wave.values[playInt2]) * playFrac2;
          interpX = padX + (playInt2 + playFrac2) * stepX;
          ctx.lineTo(interpX, valueToY(interpValue));
          ctx.lineTo(interpX, padY + h);
        } else {
          ctx.lineTo(padX + w, padY + h);
        }
        ctx.closePath();

        var grad = ctx.createLinearGradient(0, padY, 0, padY + h);
        grad.addColorStop(0, hexToRgba(colors.accent, 0.45));
        grad.addColorStop(1, hexToRgba(colors.accent, 0.05));
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = colors.accentDeep;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (var k = 0; k <= playInt2 && k < n; k++) {
          var kx = padX + k * stepX;
          var ky = valueToY(wave.values[k]);
          if (k === 0) ctx.moveTo(kx, ky);
          else ctx.lineTo(kx, ky);
        }
        if (playInt2 < n - 1) {
          ctx.lineTo(interpX, valueToY(interpValue));
        }
        ctx.stroke();

        for (var ai = 0; ai <= playInt2 && ai < n; ai++) {
          if (wave.anchors[ai] && wave.values[ai] > 0) {
            var ax = padX + ai * stepX;
            var ay = valueToY(wave.values[ai]);
            ctx.fillStyle = colors.accentPink;
            ctx.beginPath();
            ctx.arc(ax, ay, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = colors.surface;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // 播放头
      var cursorValue2;
      if (playInt2 < n - 1) {
        cursorValue2 = wave.values[playInt2] + (wave.values[playInt2 + 1] - wave.values[playInt2]) * playFrac2;
      } else {
        cursorValue2 = wave.values[n - 1];
      }
      var cursorX2 = padX + playheadIdx * stepX;
      var cursorY2 = valueToY(cursorValue2);

      ctx.strokeStyle = colors.accentDeep;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cursorX2, padY);
      ctx.lineTo(cursorX2, padY + h);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = colors.accentDeep;
      ctx.beginPath();
      ctx.arc(cursorX2, cursorY2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.surface;
      ctx.beginPath();
      ctx.arc(cursorX2, cursorY2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ============== 动画 ==============

  function startAnimation(canvas, wave, parsed, infoLeftEl, styleRef, viewModeRef) {
    var colors = getThemeColors();
    var totalSec = wave.totalSec / parsed.speedMultiplier;
    var duration = Math.max(3000, totalSec * 500);
    var startTime = null;
    var rafId = null;
    var running = true;

    function frame(timestamp) {
      if (!running) return;
      if (startTime === null) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = (elapsed % duration) / duration;

      drawWaveform(canvas, wave, progress, colors, styleRef.style, viewModeRef.view);

      if (infoLeftEl) {
        var currentIdx = Math.floor(progress * (wave.totalPoints - 1));
        var currentSec = (progress * wave.totalSec).toFixed(1);
        var pct = Math.round(progress * 100);
        infoLeftEl.textContent =
          pct + '% · ' + currentSec + 's / ' + wave.totalSec.toFixed(1) + 's · 帧 ' +
          (currentIdx + 1) + '/' + wave.totalPoints;
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);

    function onThemeChange() {
      colors = getThemeColors();
    }
    window.addEventListener('themechange', onThemeChange);

    return {
      stop: function() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('themechange', onThemeChange);
      }
    };
  }

  // ============== 下载 ==============

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

  // ============== 创建部件 ==============

  function createPulseWidget(title, rawData) {
    var parsed = parsePulseData(rawData);

    if (!parsed) {
      var errDiv = document.createElement('div');
      errDiv.className = 'pulse-widget';
      errDiv.innerHTML = '<div class="pulse-error">Pulse 数据解析失败：格式不符合 Dungeonlab+pulse 规范</div>';
      return errDiv;
    }

    var wave = expandWaveform(parsed);

    var widget = document.createElement('div');
    widget.className = 'pulse-widget';

    var header = document.createElement('div');
    header.className = 'pulse-header';

    var titleEl = document.createElement('div');
    titleEl.className = 'pulse-title';
    titleEl.innerHTML =
      '<span class="pulse-title-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></span>' +
      '<span>' + escapeHtml(title || 'Pulse 波形') + '</span>';

    var headerRight = document.createElement('div');
    headerRight.className = 'pulse-header-right';

    var styleRef = { style: 'bars' };
    var viewModeRef = { view: 'full' };

    var viewToggle = document.createElement('button');
    viewToggle.className = 'pulse-style-toggle';
    viewToggle.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18"/></svg>' +
      '<span>全局</span>';
    viewToggle.addEventListener('click', function() {
      if (viewModeRef.view === 'full') {
        viewModeRef.view = 'scroll';
        viewToggle.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M10 5l-4 7 4 7"/><path d="M14 5l4 7-4 7"/></svg>' +
          '<span>滚动</span>';
      } else {
        viewModeRef.view = 'full';
        viewToggle.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 12h18"/></svg>' +
          '<span>全局</span>';
      }
    });

    var styleToggle = document.createElement('button');
    styleToggle.className = 'pulse-style-toggle';
    styleToggle.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="2" height="9"/><rect x="8" y="6" width="2" height="15"/><rect x="13" y="9" width="2" height="12"/><rect x="18" y="3" width="2" height="18"/></svg>' +
      '<span>竖线</span>';
    styleToggle.addEventListener('click', function() {
      if (styleRef.style === 'bars') {
        styleRef.style = 'curve';
        styleToggle.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/></svg>' +
          '<span>曲线</span>';
      } else {
        styleRef.style = 'bars';
        styleToggle.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="2" height="9"/><rect x="8" y="6" width="2" height="15"/><rect x="13" y="9" width="2" height="12"/><rect x="18" y="3" width="2" height="18"/></svg>' +
          '<span>竖线</span>';
      }
    });

    var dlBtn = document.createElement('button');
    dlBtn.className = 'pulse-download-btn';
    dlBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
      '<span>下载 .pulse</span>';
    dlBtn.addEventListener('click', function() {
      downloadPulse(rawData, title);
    });

    var sourceBtn = document.createElement('button');
    sourceBtn.className = 'pulse-source-btn';
    sourceBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' +
      '<span>源码</span>';
    var sourcePanel = document.createElement('div');
    sourcePanel.className = 'pulse-source-panel';
    var sourcePre = document.createElement('pre');
    sourcePre.textContent = '[pulse' + (title ? ' title="' + title + '"' : '') + ']' + rawData + '[/pulse]';
    sourcePanel.appendChild(sourcePre);
    sourceBtn.addEventListener('click', function() {
      if (sourcePanel.classList.contains('open')) {
        sourcePanel.classList.remove('open');
        sourceBtn.classList.remove('active');
      } else {
        sourcePanel.classList.add('open');
        sourceBtn.classList.add('active');
      }
    });

    headerRight.appendChild(viewToggle);
    headerRight.appendChild(styleToggle);
    headerRight.appendChild(sourceBtn);
    headerRight.appendChild(dlBtn);

    header.appendChild(titleEl);
    header.appendChild(headerRight);

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'pulse-canvas-wrap';
    var canvas = document.createElement('canvas');
    canvas.className = 'pulse-canvas';
    canvasWrap.appendChild(canvas);

    var legend = document.createElement('div');
    legend.className = 'pulse-section-legend';
    for (var si = 0; si < parsed.sections.length; si++) {
      var sec = parsed.sections[si];
      var tag = document.createElement('span');
      tag.className = 'pulse-section-tag' + (sec.enabled ? '' : ' disabled');
      var freqMsA = freqSliderToMs(sec.freqA);
      var freqMsB = freqSliderToMs(sec.freqB);
      var freqHzA = (1000 / freqMsA).toFixed(1);
      var freqHzB = (1000 / freqMsB).toFixed(1);
      var modeName = FREQ_MODE_NAMES[sec.freqMode] || '固定';
      var freqText = sec.freqMode === 1
        ? (freqHzA + 'Hz')
        : (freqHzA + '→' + freqHzB + 'Hz');
      tag.innerHTML = '<span class="dot"></span>S' + (si + 1) +
        ' ' + sec.durationSec.toFixed(1) + 's · ' + freqText +
        ' · ' + modeName;
      tag.title = '频率A:' + sec.freqA + '(' + freqMsA + 'ms) · 频率B:' + sec.freqB + '(' + freqMsB + 'ms)\n' +
        '时长滑块:' + sec.durationSlider + ' · 模式:' + modeName + '\n' +
        '脉冲元:' + sec.points.length + '点 (' + sec.pulseMetaSec.toFixed(1) + 's) · ' +
        (sec.enabled ? '启用' : '禁用');
      legend.appendChild(tag);
    }

    var info = document.createElement('div');
    info.className = 'pulse-info';
    var infoLeft = document.createElement('div');
    infoLeft.className = 'pulse-info-left';
    var infoRight = document.createElement('div');
    infoRight.className = 'pulse-info-right';

    var cycleTime = parsed.totalCycleSec.toFixed(1);
    infoRight.innerHTML =
      '<span>' + parsed.enabledCount + '/' + parsed.sections.length + ' 段</span>' +
      '<span>' + parsed.speedMultiplier + 'x 速度</span>' +
      '<span>休息 ' + parsed.restSec.toFixed(1) + 's</span>' +
      '<span>周期 ' + cycleTime + 's</span>';

    info.appendChild(infoLeft);
    info.appendChild(infoRight);

    widget.appendChild(header);
    widget.appendChild(canvasWrap);
    widget.appendChild(legend);
    widget.appendChild(info);
    widget.appendChild(sourcePanel);

    requestAnimationFrame(function() {
      var anim = startAnimation(canvas, wave, parsed, infoLeft, styleRef, viewModeRef);
      animations.push(anim);
    });

    return widget;
  }

  function createPulseMiniWidget(title, rawData) {
    var parsed = parsePulseData(rawData);

    if (!parsed) {
      var errDiv = document.createElement('div');
      errDiv.className = 'pulse-mini-widget';
      errDiv.innerHTML = '<div class="pulse-error">解析失败</div>';
      return errDiv;
    }

    var wave = expandWaveform(parsed);

    var widget = document.createElement('div');
    widget.className = 'pulse-mini-widget';

    var header = document.createElement('div');
    header.className = 'pulse-mini-header';

    var titleEl = document.createElement('div');
    titleEl.className = 'pulse-mini-title';
    titleEl.textContent = title || 'Pulse';

    var actions = document.createElement('div');
    actions.className = 'pulse-mini-actions';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'pulse-mini-btn';
    copyBtn.title = '复制源码';
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      navigator.clipboard.writeText('[pulsemini' + (title ? ' title="' + title + '"' : '') + ']' + rawData + '[/pulsemini]');
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(function() {
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 1500);
    });

    var dlBtn = document.createElement('button');
    dlBtn.className = 'pulse-mini-btn';
    dlBtn.title = '下载 .pulse';
    dlBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
    dlBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      downloadPulse(rawData, title);
    });

    actions.appendChild(copyBtn);
    actions.appendChild(dlBtn);
    header.appendChild(titleEl);
    header.appendChild(actions);
    widget.appendChild(header);

    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'pulse-mini-canvas-wrap';
    var canvas = document.createElement('canvas');
    canvas.className = 'pulse-mini-canvas';
    canvasWrap.appendChild(canvas);
    widget.appendChild(canvasWrap);

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var playheadIdx = 0;
    var lastTime = null;
    var stopped = false;
    var canvasH = 70;

    var points = [];
    for (var i = 0; i < wave.values.length; i++) {
      points.push({ value: wave.values[i], isKey: wave.anchors[i] });
    }

    function draw(time) {
      if (stopped) return;

      var cssW = canvas.clientWidth || canvasWrap.clientWidth;
      if (cssW < 10) {
        requestAnimationFrame(draw);
        return;
      }
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(canvasH * dpr)) {
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(canvasH * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!lastTime) lastTime = time;
      var delta = time - lastTime;
      lastTime = time;

      var w = cssW;
      var h = canvasH;
      var padX = 4;
      var padY = 6;
      var graphW = w - padX * 2;
      var graphH = h - padY * 2;

      if (graphW < 10 || points.length === 0) {
        requestAnimationFrame(draw);
        return;
      }

      playheadIdx += delta * 0.025;
      if (playheadIdx >= points.length) playheadIdx = 0;

      var computedStyle = getComputedStyle(document.documentElement);
      var accentColor = computedStyle.getPropertyValue('--color-accent-purple').trim() || '#d4a5c9';
      var accentPink = computedStyle.getPropertyValue('--color-accent-pink').trim() || '#f2c4ce';
      var borderColor = computedStyle.getPropertyValue('--color-border').trim() || '#f0f0f0';
      var bgColor = computedStyle.getPropertyValue('--color-surface').trim() || '#ffffff';

      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.5;
      for (var i = 0; i <= 4; i++) {
        var y = padY + (graphH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padX, y);
        ctx.lineTo(w - padX, y);
        ctx.stroke();
      }

      var scrollStepX = graphW * 0.015;
      var barWidth = Math.max(1, scrollStepX * 0.6);
      var playheadFixedX = padX + graphW * 0.5;
      var pointsVisible = Math.floor(graphW / scrollStepX);
      var centerIdx = Math.floor(playheadIdx);
      var startIdx = centerIdx - Math.floor(pointsVisible * 0.5);
      var endIdx = startIdx + pointsVisible;

      var gradient = ctx.createLinearGradient(padX, 0, w - padX, 0);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.15, accentColor);
      gradient.addColorStop(0.85, accentColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;

      for (var j = startIdx; j < endIdx; j++) {
        var idx = ((j % points.length) + points.length) % points.length;
        var x = padX + (j - startIdx) * scrollStepX;
        var barHeight = graphH * (points[idx].value / 100);
        var y = padY + graphH - barHeight;
        ctx.fillRect(x - barWidth / 2, y, barWidth, barHeight);
      }

      ctx.strokeStyle = accentPink;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadFixedX, padY);
      ctx.lineTo(playheadFixedX, h - padY);
      ctx.stroke();

      requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);

    var onResize = function() {
      lastTime = null;
    };
    window.addEventListener('resize', onResize);

    animations.push({
      stop: function() {
        stopped = true;
        window.removeEventListener('resize', onResize);
      }
    });

    return widget;
  }

  // ============== 主渲染入口 ==============

  function render(container) {
    animations.forEach(function(a) { a.stop(); });
    animations = [];

    injectStyles();

    var targetEl = container || (window.MarkdownPreview.dom && window.MarkdownPreview.dom.markdownContent);
    if (!targetEl) return;

    var pulseRegex = /\[pulse(?:\s+title\s*=\s*(?:"([^"]*)"|'([^']*)'))?\]([\s\S]*?)\[\/pulse\]/gi;
    var pulseminiRegex = /\[pulsemini(?:\s+title\s*=\s*(?:"([^"]*)"|'([^']*)'))?\]([\s\S]*?)\[\/pulsemini\]/gi;

    var html = targetEl.innerHTML;
    var match;
    var replacements = [];

    function isInsideCode(htmlStr, index) {
      var before = htmlStr.substring(0, index);
      var codeOpen = before.match(/<code[^>]*>/gi);
      var codeClose = before.match(/<\/code>/gi);
      var openCount = codeOpen ? codeOpen.length : 0;
      var closeCount = codeClose ? codeClose.length : 0;
      if (openCount > closeCount) return true;
      var preOpen = before.match(/<pre[^>]*>/gi);
      var preClose = before.match(/<\/pre>/gi);
      var preOpenCount = preOpen ? preOpen.length : 0;
      var preCloseCount = preClose ? preClose.length : 0;
      if (preOpenCount > preCloseCount) return true;
      return false;
    }

    while ((match = pulseRegex.exec(html)) !== null) {
      if (isInsideCode(html, match.index)) continue;
      var title = match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : '');
      var rawData = decodeEntities(match[3].trim());
      replacements.push({ matchStr: match[0], title: title, rawData: rawData, index: match.index, type: 'full' });
    }

    while ((match = pulseminiRegex.exec(html)) !== null) {
      if (isInsideCode(html, match.index)) continue;
      var miniTitle = match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : '');
      var miniRawData = decodeEntities(match[3].trim());
      replacements.push({ matchStr: match[0], title: miniTitle, rawData: miniRawData, index: match.index, type: 'mini' });
    }

    if (replacements.length === 0) return;

    var sorted = replacements.slice().sort(function(a, b) { return b.index - a.index; });
    for (var i = 0; i < sorted.length; i++) {
      var rep = sorted[i];
      var repIdx = replacements.indexOf(rep);
      var placeholder = '<div data-pulse-placeholder="' + repIdx + '"></div>';
      html = html.substring(0, rep.index) + placeholder + html.substring(rep.index + rep.matchStr.length);
    }

    targetEl.innerHTML = html;

    var placeholders = targetEl.querySelectorAll('[data-pulse-placeholder]');
    var miniParents = new Set();
    placeholders.forEach(function(ph) {
      var repIdx = parseInt(ph.getAttribute('data-pulse-placeholder'), 10);
      var rep = replacements[repIdx];
      if (rep) {
        var widget = rep.type === 'mini'
          ? createPulseMiniWidget(rep.title, rep.rawData)
          : createPulseWidget(rep.title, rep.rawData);
        var parentP = ph.closest('p');
        if (parentP && parentP.textContent.trim() === '') {
          parentP.parentNode.replaceChild(widget, parentP);
        } else {
          if (rep.type === 'mini' && parentP) {
            miniParents.add(parentP);
          }
          ph.parentNode.replaceChild(widget, ph);
        }
      }
    });

    miniParents.forEach(function(p) {
      var hasOnlyMini = true;
      var children = p.childNodes;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType === 1) {
          if (!child.classList || !child.classList.contains('pulse-mini-widget')) {
            hasOnlyMini = false;
            break;
          }
        } else if (child.nodeType === 3) {
          if (child.textContent.trim() !== '') {
            hasOnlyMini = false;
            break;
          }
        }
      }
      if (hasOnlyMini) {
        p.style.textAlign = 'center';
      }
    });
  }

  // ============== 注册 ==============

  window.MarkdownPreview.renderers.pulse = {
    render: render,
    parsePulseData: parsePulseData,
    expandWaveform: expandWaveform,
    freqSliderToMs: freqSliderToMs,
    sectionSliderToSec: sectionSliderToSec,
    FREQ_SLIDER_MAP: FREQ_SLIDER_MAP,
    SECTION_TIME_MAP: SECTION_TIME_MAP
  };

  console.log('[Pulse] Renderer module loaded (DG-LAB format)');
})();
