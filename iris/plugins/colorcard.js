// Color Card Plugin
// 颜色卡片插件，演示：
//   - 多种输入格式解析（JSON 数组、CSV、行分隔）
//   - 自定义 test 函数支持多语言别名
//   - 事件监听器 + registerResource 资源清理
//   - 异步剪贴板 API（async render）
//   - 主题色变量适配

export default {
  name: 'colorcard',
  description: '颜色卡片墙，点击复制色值',
  priority: 5,

  // 自定义 test：支持多个语言别名
  test(code, language) {
    return language === 'colorcard' || language === 'colors' || language === 'palette';
  },

  init(config) {
    this._config = {
      columns: 4,             // 默认列数
      copyFormat: 'hex',      // 'hex' | 'rgb' | 'hsl' | 'auto'
      showLabels: true,       // 是否显示色名
      enableCopy: true,       // 是否启用点击复制
      ...config
    };
    this._cleanupFns = [];
  },

  beforeRender(code, container) {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.35s ease';
  },

  async render(code, container, context) {
    const colors = parseColors(code);
    if (colors.length === 0) {
      renderError(container, '未识别到任何颜色，请使用 JSON 数组、CSV 或行分隔的十六进制色值');
      return;
    }

    const cfg = this._config;
    const columns = clamp(parseInt(cfg.columns, 10) || 4, 1, 12);

    container.className = 'colorcard-container';
    container.style.cssText = [
      'margin: 1.5em 0',
      'display: grid',
      `grid-template-columns: repeat(${columns}, 1fr)`,
      'gap: 8px',
      'font-family: system-ui, -apple-system, sans-serif'
    ].join(';');

    // 为每个颜色生成卡片
    for (const color of colors) {
      const card = createCard(color, cfg);
      container.appendChild(card);

      if (cfg.enableCopy) {
        const onCopy = async (e) => {
          e.preventDefault();
          const text = formatColor(color, cfg.copyFormat);
          try {
            await navigator.clipboard.writeText(text);
            showToast(card, `已复制 ${text}`);
          } catch (err) {
            // 剪贴板权限失败时回退到 execCommand
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
              document.execCommand('copy');
              showToast(card, `已复制 ${text}`);
            } catch (e2) {
              showToast(card, '复制失败', true);
            }
            document.body.removeChild(ta);
          }
        };
        card.addEventListener('click', onCopy);
        card.style.cursor = 'pointer';

        // 注册清理函数
        const cleanup = () => card.removeEventListener('click', onCopy);
        this._cleanupFns.push(cleanup);

        if (context && typeof context.registerResource === 'function') {
          context.registerResource({ destroy: cleanup });
        }
      }
    }

    // 淡入动画
    requestAnimationFrame(() => {
      container.style.opacity = '1';
    });
  },

  afterRender(container) {
    // 可在此处挂钩全局事件、埋点等
  },

  destroy() {
    // 兜底清理：所有未移除的事件监听器
    if (this._cleanupFns) {
      this._cleanupFns.forEach(fn => {
        try { fn(); } catch (e) { /* ignore */ }
      });
      this._cleanupFns.length = 0;
    }
    this._config = null;
  }
};

// ===== 颜色解析 =====

function parseColors(code) {
  const raw = code.trim();
  if (!raw) return [];

  // 1. JSON 数组 / 对象
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data.colors || data.palette || []);
      return list
        .map(item => normalizeColor(typeof item === 'string' ? item : item.color, typeof item === 'object' ? item.name : null))
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  // 2. CSV / 行分隔 / 空格分隔
  const tokens = raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);

  return tokens
    .map(tok => {
      // 支持 "name: #hex" / "name = #hex" / "name #hex" 形式
      const m = tok.match(/^(.+?)[\s:=]+(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgb\([^)]+\)|hsl\([^)]+\))$/);
      if (m) {
        const c = normalizeColor(m[2]);
        return c ? { ...c, name: m[1].trim() } : null;
      }
      return normalizeColor(tok);
    })
    .filter(Boolean);
}

function normalizeColor(input, name) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  // 测试容器（只用于解析，不挂到 DOM）
  const probe = document.createElement('div');
  probe.style.color = '';
  probe.style.color = value;

  // 浏览器无法识别时，style.color 不会被设置，仍为空字符串
  if (!probe.style.color) return null;

  // 计算 RGB 分量用于显示与复制
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);

  const rgb = parseRgbString(computed);
  if (!rgb) return null;

  return {
    raw: value,
    hex: rgbToHex(rgb),
    rgb: computed,
    hsl: rgbToHsl(rgb),
    name: name || null,
    luminance: relativeLuminance(rgb)
  };
}

function parseRgbString(str) {
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function relativeLuminance({ r, g, b }) {
  const f = v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function formatColor(color, format) {
  if (format === 'rgb') return color.rgb;
  if (format === 'hsl') return color.hsl;
  return color.hex;
}

// ===== 渲染辅助 =====

function createCard(color, cfg) {
  const card = document.createElement('div');
  card.className = 'colorcard-card';
  card.style.cssText = [
    'position: relative',
    'border-radius: 10px',
    'overflow: hidden',
    `background: ${color.raw}`,
    'min-height: 96px',
    'display: flex',
    'flex-direction: column',
    'justify-content: flex-end',
    'box-shadow: 0 1px 3px rgba(0,0,0,0.08)',
    'transition: transform 0.15s ease, box-shadow 0.15s ease'
  ].join(';');

  // 鼠标悬停效果
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-2px)';
    card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
  });

  // 文字色根据亮度自适应
  const textColor = color.luminance > 0.5 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
  const subColor = color.luminance > 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)';

  // 信息层
  const info = document.createElement('div');
  info.style.cssText = [
    'padding: 8px 10px',
    `color: ${textColor}`,
    'backdrop-filter: blur(8px)',
    'background: rgba(255,255,255,0.08)'
  ].join(';');

  if (cfg.showLabels && color.name) {
    const nameEl = document.createElement('div');
    nameEl.textContent = color.name;
    nameEl.style.cssText = `font-size:0.8em;font-weight:600;color:${subColor};margin-bottom:2px`;
    info.appendChild(nameEl);
  }

  const hexEl = document.createElement('div');
  hexEl.textContent = color.hex;
  hexEl.style.cssText = 'font-size:0.85em;font-weight:600;font-variant-numeric:tabular-nums';
  info.appendChild(hexEl);

  const rawEl = document.createElement('div');
  rawEl.textContent = color.rgb;
  rawEl.style.cssText = `font-size:0.7em;color:${subColor};margin-top:2px;font-variant-numeric:tabular-nums`;
  info.appendChild(rawEl);

  card.appendChild(info);

  // 复制提示
  if (cfg.enableCopy) {
    const hint = document.createElement('div');
    hint.textContent = '点击复制';
    hint.style.cssText = [
      'position: absolute',
      'top: 6px',
      'right: 6px',
      `color: ${subColor}`,
      'font-size: 0.65em',
      'opacity: 0',
      'transition: opacity 0.15s ease',
      'pointer-events: none'
    ].join(';');
    card.addEventListener('mouseenter', () => hint.style.opacity = '1');
    card.addEventListener('mouseleave', () => hint.style.opacity = '0');
    card.appendChild(hint);
  }

  return card;
}

function showToast(card, message, isError) {
  // 移除已有 toast
  const existing = card.querySelector('.colorcard-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'colorcard-toast';
  toast.textContent = message;
  toast.style.cssText = [
    'position: absolute',
    'inset: 0',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    `background: ${isError ? 'rgba(220, 38, 38, 0.92)' : 'rgba(0, 0, 0, 0.72)'}`,
    'color: #fff',
    'font-size: 0.85em',
    'font-weight: 600',
    'border-radius: 10px',
    'opacity: 0',
    'transition: opacity 0.2s ease',
    'pointer-events: none'
  ].join(';');
  card.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 1200);
}

function renderError(container, message) {
  container.className = 'colorcard-container colorcard-error';
  container.style.cssText = 'padding:12px 16px;border:1px solid #ff6b6b;border-radius:8px;background:#fff0f0;color:#cc0000;font-size:14px';
  container.innerHTML = '<strong>颜色卡片渲染错误：</strong> ' + message;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
