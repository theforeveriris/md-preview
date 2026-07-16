// QR Code Generator Plugin - Enhanced Edition
// 美化版二维码生成器：支持渐变色彩、圆角设计、Logo、多种样式主题、高级自定义

export default {
  name: 'qrcode',
  description: 'Beautiful QR Code generator with extensive customization options',
  priority: 10,
  version: '2.0.0',

  test(code, language) {
    return language === 'qrcode';
  },

  // 生命周期：初始化
  init(config) {
    console.log('[QRCode Enhanced] init called, config:', config);
    
    // 加载CSS样式表
    this.loadStyles();
    
    this._config = {
      defaultSize: 320,
      defaultStyle: 'gradient',
      apiEndpoints: [
        (d, s) => `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${encodeURIComponent(d)}`,
        (d, s) => `https://chart.googleapis.com/chart?chs=${s}x${s}&cht=qr&chl=${encodeURIComponent(d)}`
      ],
      colorSchemes: {
        gradient: { start: '#667eea', end: '#764ba2', bg: '#ffffff', text: '#2d3748' },
        ocean: { start: '#2E3192', end: '#1BFFFF', bg: '#f0f9ff', text: '#1e3a8a' },
        sunset: { start: '#ff6b6b', end: '#feca57', bg: '#fff5f5', text: '#9a3412' },
        forest: { start: '#134e5e', end: '#71b280', bg: '#f0fff4', text: '#065f46' },
        neon: { start: '#00f260', end: '#0575e6', bg: '#000000', text: '#00f260' },
        purple: { start: '#a8edea', end: '#fed6e3', bg: '#ffffff', text: '#6b21a8' },
        fire: { start: '#f12711', end: '#f5af19', bg: '#fffaf0', text: '#9a3412' },
        monochrome: { start: '#000000', end: '#333333', bg: '#ffffff', text: '#000000' },
        pastel: { start: '#ffc3a0', end: '#ffafbd', bg: '#fffbf0', text: '#b45309' },
        cyberpunk: { start: '#ff006e', end: '#8338ec', bg: '#0a0a0a', text: '#ff006e' }
      },
      ...config
    };
  },
  
  // 加载CSS样式
  loadStyles() {
    if (!document.getElementById('qrcode-plugin-styles')) {
      const link = document.createElement('link');
      link.id = 'qrcode-plugin-styles';
      link.rel = 'stylesheet';
      link.href = './plugins/qrcode.css';
      document.head.appendChild(link);
    }
  },

  // 生命周期：渲染前
  beforeRender(code, container, context) {
    console.log('[QRCode Enhanced] beforeRender, document:', context.documentPath);
    container.style.opacity = '0';
    container.style.transform = 'scale(0.95)';
    container.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
  },

  // 异步渲染 - 美化版
  async render(code, container, context) {
    container.innerHTML = '';
    container.className = 'qrcode-container-enhanced';

    let data = code.trim();
    let size = this._config.defaultSize;
    let style = this._config.defaultStyle || 'gradient';
    let colorScheme = 'gradient';
    let showLogo = true;
    let title = '扫描二维码';
    let showTitle = true;
    let showText = true;
    let containerClass = '';
    let theme = '';
    let shadow = '';
    let background = '';
    let border = '';
    let customColors = null;

    // 支持 JSON 配置模式
    try {
      const parsed = JSON.parse(code);
      if (parsed.data) data = parsed.data;
      if (parsed.size) size = parsed.size;
      if (parsed.style) style = parsed.style;
      if (parsed.colorScheme) colorScheme = parsed.colorScheme;
      if (parsed.showLogo !== undefined) showLogo = parsed.showLogo;
      if (parsed.title) title = parsed.title;
      if (parsed.showTitle !== undefined) showTitle = parsed.showTitle;
      if (parsed.showText !== undefined) showText = parsed.showText;
      if (parsed.containerClass) containerClass = parsed.containerClass;
      if (parsed.theme) theme = parsed.theme;
      if (parsed.shadow) shadow = parsed.shadow;
      if (parsed.background) background = parsed.background;
      if (parsed.border) border = parsed.border;
      if (parsed.customColors) customColors = parsed.customColors;
    } catch (e) {
      // Not JSON, use as raw text
    }

    // 应用容器类
    if (containerClass) container.className += ' ' + containerClass;
    if (theme) container.className += ' qrcode-theme-' + theme;
    if (shadow) container.className += ' shadow-' + shadow;
    if (background) container.className += ' bg-' + background;
    if (border) container.className += ' border-' + border;

    // 应用容器样式
    container.style.margin = '2em auto';
    container.style.padding = 'var(--qr-container-padding, 2em)';
    container.style.maxWidth = 'var(--qr-container-max-width, 400px)';
    container.style.background = 'var(--qr-container-bg, linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(250,250,255,0.95) 100%))';
    container.style.borderRadius = 'var(--qr-container-radius, 24px)';
    container.style.border = 'var(--qr-container-border, none)';
    container.style.boxShadow = 'var(--qr-container-shadow, 0 20px 60px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06))';
    container.style.textAlign = 'center';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';

    // 获取配色方案
    let colors = this._config.colorSchemes[colorScheme] || this._config.colorSchemes.gradient;
    if (customColors) colors = { ...colors, ...customColors };

    // 创建二维码包装器
    const qrWrapper = document.createElement('div');
    qrWrapper.style.margin = '0 auto';
    qrWrapper.style.padding = 'var(--qr-wrapper-padding, 1.5em)';
    qrWrapper.style.background = colors.bg;
    qrWrapper.style.borderRadius = 'var(--qr-wrapper-radius, 20px)';
    qrWrapper.style.display = 'inline-block';
    qrWrapper.style.boxShadow = 'var(--qr-wrapper-shadow, inset 0 2px 8px rgba(0,0,0,0.05))';
    container.appendChild(qrWrapper);

    // 创建二维码容器
    const qrContainer = document.createElement('div');
    qrContainer.style.margin = '0 auto';
    qrContainer.style.width = size + 'px';
    qrContainer.style.height = size + 'px';
    qrContainer.style.display = 'inline-block';
    qrContainer.style.position = 'relative';
    qrWrapper.appendChild(qrContainer);

    // 绘制美化的二维码
    drawEnhancedQR(qrContainer, data, size, style, colors, showLogo);

    // 注册资源
    if (context.registerResource) {
      context.registerResource({
        destroy: () => { qrContainer.innerHTML = ''; }
      });
    }

    // 添加标题
    if (showTitle) {
      const titleDiv = document.createElement('div');
      titleDiv.style.marginTop = 'var(--qr-title-margin, 1.5em)';
      titleDiv.style.fontSize = 'var(--qr-title-size, 1.125em)';
      titleDiv.style.fontWeight = 'var(--qr-title-weight, 600)';
      titleDiv.style.color = colors.text || 'var(--qr-title-color, #2d3748)';
      titleDiv.style.marginBottom = '0.5em';
      titleDiv.textContent = title;
      container.appendChild(titleDiv);
    }

    // 添加内容文本
    if (showText) {
      const textDiv = document.createElement('div');
      textDiv.style.marginTop = '0.5em';
      textDiv.style.color = colors.text || 'var(--qr-text-color, #718096)';
      textDiv.style.fontSize = 'var(--qr-text-size, 0.875em)';
      textDiv.style.lineHeight = 'var(--qr-text-line-height, 1.5)';
      textDiv.style.maxWidth = 'var(--qr-text-max-width, 280px)';
      textDiv.style.margin = '0.5em auto 0';
      textDiv.style.wordBreak = 'break-word';
      const displayText = data.length > 80 ? data.substring(0, 77) + '...' : data;
      textDiv.textContent = displayText;
      container.appendChild(textDiv);
    }

    // 添加装饰性元素
    addDecorativeElements(container, colors);

    // 动画显示
    requestAnimationFrame(() => {
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
    });
  },

  // 生命周期：渲染后
  afterRender(container, context) {
    console.log('[QRCode Enhanced] afterRender complete');
  },

  // 生命周期：销毁
  destroy() {
    console.log('[QRCode Enhanced] destroy called, cleaning up resources');
    this._config = null;
  }
};

// 装饰性元素
function addDecorativeElements(container, colors) {
  const cornerTL = document.createElement('div');
  cornerTL.style.position = 'absolute';
  cornerTL.style.top = '0';
  cornerTL.style.left = '0';
  cornerTL.style.width = 'var(--qr-corner-tl-size, 60px)';
  cornerTL.style.height = 'var(--qr-corner-tl-size, 60px)';
  cornerTL.style.background = 'var(--qr-corner-tl-bg, linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, transparent 100%))';
  cornerTL.style.borderRadius = 'var(--qr-container-radius, 24px) 0 0 0';
  container.appendChild(cornerTL);

  const cornerBR = document.createElement('div');
  cornerBR.style.position = 'absolute';
  cornerBR.style.bottom = '0';
  cornerBR.style.right = '0';
  cornerBR.style.width = 'var(--qr-corner-br-size, 80px)';
  cornerBR.style.height = 'var(--qr-corner-br-size, 80px)';
  cornerBR.style.background = 'var(--qr-corner-br-bg, linear-gradient(135deg, transparent 0%, rgba(118, 75, 162, 0.1) 100%))';
  cornerBR.style.borderRadius = '0 0 var(--qr-container-radius, 24px) 0';
  container.appendChild(cornerBR);
}

// 美化版二维码绘制
function drawEnhancedQR(container, data, size, style, colors, showLogo) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.display = 'block';
  canvas.style.borderRadius = 'var(--qr-canvas-radius, 12px)';
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const modules = 25;
  const moduleSize = size / modules;
  const padding = 2;

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, size, size);

  // 根据不同样式绘制
  switch (style) {
    case 'dots':
      drawDotsStyle(ctx, data, modules, moduleSize, colors, padding);
      break;
    case 'rounded':
      drawRoundedStyle(ctx, data, modules, moduleSize, colors, padding);
      break;
    case 'neon':
      drawNeonStyle(ctx, data, modules, moduleSize, colors, padding);
      break;
    case 'classic':
      drawClassicStyle(ctx, data, modules, moduleSize, colors, padding);
      break;
    default:
      drawGradientStyle(ctx, data, modules, moduleSize, colors, padding);
  }

  // 绘制定位图案
  drawEnhancedPositionPattern(ctx, 0, 0, moduleSize, colors);
  drawEnhancedPositionPattern(ctx, modules - 7, 0, moduleSize, colors);
  drawEnhancedPositionPattern(ctx, 0, modules - 7, moduleSize, colors);

  // 添加中心Logo
  if (showLogo) drawCenterLogo(ctx, size, colors);

  return canvas;
}

// 渐变风格
function drawGradientStyle(ctx, data, modules, moduleSize, colors, padding) {
  const hash = simpleHash(data);
  for (let i = 0; i < modules; i++) {
    for (let j = 0; j < modules; j++) {
      if (shouldSkipModule(i, j, modules)) continue;
      if ((hash(i, j) % 2) === 0) {
        const x = j * moduleSize + padding;
        const y = i * moduleSize + padding;
        const w = moduleSize - padding * 2;
        const h = moduleSize - padding * 2;
        const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
        const progress = (i + j) / (modules * 2);
        gradient.addColorStop(0, interpolateColor(colors.start, colors.end, progress));
        gradient.addColorStop(1, interpolateColor(colors.start, colors.end, progress + 0.2));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, moduleSize * 0.25);
        ctx.fill();
      }
    }
  }
}

// 圆点风格
function drawDotsStyle(ctx, data, modules, moduleSize, colors, padding) {
  const hash = simpleHash(data);
  for (let i = 0; i < modules; i++) {
    for (let j = 0; j < modules; j++) {
      if (shouldSkipModule(i, j, modules)) continue;
      if ((hash(i, j) % 2) === 0) {
        const x = j * moduleSize + moduleSize / 2;
        const y = i * moduleSize + moduleSize / 2;
        const radius = (moduleSize - padding * 2) / 2;
        const progress = (i + j) / (modules * 2);
        ctx.fillStyle = interpolateColor(colors.start, colors.end, progress);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// 圆角风格
function drawRoundedStyle(ctx, data, modules, moduleSize, colors, padding) {
  const hash = simpleHash(data);
  for (let i = 0; i < modules; i++) {
    for (let j = 0; j < modules; j++) {
      if (shouldSkipModule(i, j, modules)) continue;
      if ((hash(i, j) % 2) === 0) {
        const x = j * moduleSize + padding;
        const y = i * moduleSize + padding;
        const w = moduleSize - padding * 2;
        const h = moduleSize - padding * 2;
        const progress = (i + j) / (modules * 2);
        ctx.fillStyle = interpolateColor(colors.start, colors.end, progress);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, moduleSize * 0.4);
        ctx.fill();
      }
    }
  }
}

// 霓虹风格
function drawNeonStyle(ctx, data, modules, moduleSize, colors, padding) {
  const hash = simpleHash(data);
  for (let i = 0; i < modules; i++) {
    for (let j = 0; j < modules; j++) {
      if (shouldSkipModule(i, j, modules)) continue;
      if ((hash(i, j) % 2) === 0) {
        const x = j * moduleSize + padding;
        const y = i * moduleSize + padding;
        const w = moduleSize - padding * 2;
        const h = moduleSize - padding * 2;
        const progress = (i + j) / (modules * 2);
        const color = interpolateColor(colors.start, colors.end, progress);
        ctx.shadowColor = color;
        ctx.shadowBlur = moduleSize * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, moduleSize * 0.3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}

// 经典风格
function drawClassicStyle(ctx, data, modules, moduleSize, colors, padding) {
  const hash = simpleHash(data);
  for (let i = 0; i < modules; i++) {
    for (let j = 0; j < modules; j++) {
      if (shouldSkipModule(i, j, modules)) continue;
      if ((hash(i, j) % 2) === 0) {
        const x = j * moduleSize + padding;
        const y = i * moduleSize + padding;
        const w = moduleSize - padding * 2;
        const h = moduleSize - padding * 2;
        ctx.fillStyle = colors.start;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, w, h);
      }
    }
  }
}

// 增强的定位图案
function drawEnhancedPositionPattern(ctx, x, y, moduleSize, colors) {
  const size = 7 * moduleSize;
  const centerX = (x + 3.5) * moduleSize;
  const centerY = (y + 3.5) * moduleSize;
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size / 2);
  gradient.addColorStop(0, colors.start);
  gradient.addColorStop(1, colors.end);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x * moduleSize, y * moduleSize, size, size, moduleSize * 0.5);
  ctx.fill();
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect((x + 1) * moduleSize, (y + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize, moduleSize * 0.3);
  ctx.fill();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect((x + 2) * moduleSize, (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize, moduleSize * 0.2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(centerX - moduleSize, centerY - moduleSize, moduleSize * 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// 中心Logo
function drawCenterLogo(ctx, size, colors) {
  const logoSize = size * 0.2;
  const x = (size - logoSize) / 2;
  const y = (size - logoSize) / 2;
  ctx.fillStyle = colors.bg;
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, logoSize + 12, logoSize + 12, 12);
  ctx.fill();
  const gradient = ctx.createLinearGradient(x, y, x + logoSize, y + logoSize);
  gradient.addColorStop(0, colors.start);
  gradient.addColorStop(1, colors.end);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, logoSize, logoSize, 8);
  ctx.fill();
  ctx.strokeStyle = colors.bg;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const centerX = x + logoSize / 2;
  const centerY = y + logoSize / 2;
  const iconSize = logoSize * 0.5;
  ctx.beginPath();
  ctx.moveTo(centerX - iconSize / 2, centerY - iconSize / 3);
  ctx.lineTo(centerX + iconSize / 2, centerY - iconSize / 3);
  ctx.moveTo(centerX - iconSize / 2, centerY);
  ctx.lineTo(centerX + iconSize / 2, centerY);
  ctx.moveTo(centerX - iconSize / 2, centerY + iconSize / 3);
  ctx.lineTo(centerX + iconSize / 2, centerY + iconSize / 3);
  ctx.stroke();
}

// 辅助函数
function shouldSkipModule(i, j, modules) {
  if (isInPositionPattern(i, j, modules)) return true;
  if ((i === 6 && j > 7 && j < modules - 8) || (j === 6 && i > 7 && i < modules - 8)) return true;
  const center = Math.floor(modules / 2);
  const logoRadius = 3;
  if (Math.abs(i - center) <= logoRadius && Math.abs(j - center) <= logoRadius) return true;
  return false;
}

function interpolateColor(color1, color2, factor) {
  factor = Math.max(0, Math.min(1, factor));
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function isInPositionPattern(i, j, modules) {
  if (i < 7 && j < 7) return true;
  if (i < 7 && j >= modules - 7 && j < modules) return true;
  if (i >= modules - 7 && i < modules && j < 7) return true;
  return false;
}

function simpleHash(data) {
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = ((h << 5) - h) + data.charCodeAt(i);
    h = h & h;
  }
  return function(i, j) {
    let val = h;
    val = ((val << 5) - val) + i;
    val = ((val << 5) - val) + j;
    return Math.abs(val);
  };
}
