// QR Code Generator Plugin
// 演示新插件 API：生命周期钩子、异步渲染、上下文配置、资源追踪

export default {
  name: 'qrcode',
  description: 'QR Code generator with external API fallback',
  priority: 10, // 优先级：数值越大越优先匹配

  // test 现在可选：如果不声明，默认匹配 language === plugin.name
  test(code, language) {
    return language === 'qrcode';
  },

  // 生命周期：初始化 — 接收来自 config.json 的插件配置
  init(config) {
    console.log('[QRCode] init called, config:', config);
    // 合并默认配置与用户配置
    this._config = {
      defaultSize: 256,
      apiEndpoints: [
        (d, s) => `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${encodeURIComponent(d)}`,
        (d, s) => `https://chart.googleapis.com/chart?chs=${s}x${s}&cht=qr&chl=${encodeURIComponent(d)}`
      ],
      ...config
    };
  },

  // 生命周期：渲染前
  beforeRender(code, container, context) {
    console.log('[QRCode] beforeRender, document:', context.documentPath);
    container.style.opacity = '0.6';
    container.style.transition = 'opacity 0.3s ease';
  },

  // 异步渲染
  async render(code, container, context) {
    container.innerHTML = '';
    container.className = 'qrcode-container';
    container.style.margin = '1.5em 0';
    container.style.padding = '1.5em';
    container.style.background = 'var(--color-surface)';
    container.style.borderRadius = '12px';
    container.style.border = '1px solid var(--color-border)';
    container.style.textAlign = 'center';

    let data = code.trim();
    let size = this._config.defaultSize;

    // 支持 JSON 配置模式
    try {
      const parsed = JSON.parse(code);
      if (parsed.data) data = parsed.data;
      if (parsed.size) size = parsed.size;
    } catch (e) {
      // Not JSON, use as raw text
    }

    // 创建二维码容器
    const qrContainer = document.createElement('div');
    qrContainer.style.margin = '0 auto';
    qrContainer.style.width = size + 'px';
    qrContainer.style.height = size + 'px';
    qrContainer.style.display = 'inline-block';
    container.appendChild(qrContainer);

    // 先显示 fallback
    const fallbackCanvas = drawFallbackQR(qrContainer, data, size);

    // 注册资源以便后续清理
    if (context.registerResource) {
      context.registerResource({
        destroy: () => {
          qrContainer.innerHTML = '';
        }
      });
    }

    // 尝试外部 API（异步加载）
    const endpoints = this._config.apiEndpoints;
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const img = await loadImage(endpoints[i](data, size));
        img.style.width = size + 'px';
        img.style.height = size + 'px';
        img.style.display = 'block';
        qrContainer.innerHTML = '';
        qrContainer.appendChild(img);
        break; // 成功则停止尝试
      } catch (err) {
        console.warn(`[QRCode] API ${i + 1} failed:`, err.message);
        // 继续尝试下一个
      }
    }

    // 添加内容文本
    const textDiv = document.createElement('div');
    textDiv.style.marginTop = '1em';
    textDiv.style.color = 'var(--color-text-secondary)';
    textDiv.style.fontSize = '0.875em';
    textDiv.textContent = data.length > 100 ? data.substring(0, 97) + '...' : data;
    container.appendChild(textDiv);

    // 动画显示
    requestAnimationFrame(() => {
      container.style.opacity = '1';
    });
  },

  // 生命周期：渲染后
  afterRender(container, context) {
    console.log('[QRCode] afterRender complete');
  },

  // 生命周期：销毁 — 清理资源
  destroy() {
    console.log('[QRCode] destroy called, cleaning up resources');
    this._config = null;
  }
};

// 辅助函数：异步加载图片
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image: ' + src));
    img.src = src;
  });
}

// Fallback QR 绘制（同步）
function drawFallbackQR(container, data, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.style.display = 'block';
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const modules = 25;
  const moduleSize = size / modules;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Draw 3 position patterns
  drawPositionPattern(ctx, 0, 0, moduleSize);
  drawPositionPattern(ctx, modules - 7, 0, moduleSize);
  drawPositionPattern(ctx, 0, modules - 7, moduleSize);

  // Draw timing patterns
  for (let i = 8; i < modules - 8; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(i * moduleSize, 6 * moduleSize, moduleSize, moduleSize);
      ctx.fillRect(6 * moduleSize, i * moduleSize, moduleSize, moduleSize);
    }
  }

  // Fill with consistent pseudo-random data
  ctx.fillStyle = '#000000';
  const hash = simpleHash(data);
  for (let i = 0; i < modules; i++) {
    for (let j = 0; j < modules; j++) {
      if (isInPositionPattern(i, j, modules) ||
          (i === 6 && j > 7 && j < modules - 8) ||
          (j === 6 && i > 7 && i < modules - 8)) {
        continue;
      }
      if ((hash(i, j) % 2) === 0) {
        ctx.fillRect(j * moduleSize, i * moduleSize, moduleSize, moduleSize);
      }
    }
  }

  return canvas;
}

function drawPositionPattern(ctx, x, y, moduleSize) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(x * moduleSize, y * moduleSize, 7 * moduleSize, 7 * moduleSize);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((x + 1) * moduleSize, (y + 1) * moduleSize, 5 * moduleSize, 5 * moduleSize);
  ctx.fillStyle = '#000000';
  ctx.fillRect((x + 2) * moduleSize, (y + 2) * moduleSize, 3 * moduleSize, 3 * moduleSize);
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
