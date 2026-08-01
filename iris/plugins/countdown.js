// Countdown Plugin
// 实时倒计时/正计时插件，演示：
//   - init(config) 合并 config.json 配置
//   - setInterval + registerResource 进行可清理的资源追踪
//   - destroy() 生命周期钩子释放定时器
//   - 多种输入格式（ISO 日期、相对时长、JSON 配置）

export default {
  name: 'countdown',
  description: '实时倒计时 / 正计时卡片',
  priority: 10,

  // 不声明 test，使用默认精确匹配 language === name（即 ```countdown）

  init(config) {
    // 合并 config.json 中 plugins.countdown 的配置
    this._config = {
      updateIntervalMs: 1000, // 刷新间隔
      labelFinished: '已结束', // 到期文案
      labelCountingUp: '已过去', // 正计时文案
      locale: 'zh-CN', // 数字 / 时间格式化区域
      ...config
    };
    // 全局定时器句柄（用于 destroy 时兜底清理）
    this._timers = new Set();
  },

  beforeRender(code, container, context) {
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.4s ease';
  },

  render(code, container, context) {
    const parsed = parseInput(code);
    if (!parsed) {
      renderError(container, '无法解析倒计时目标，请使用 ISO 日期、相对时长或 JSON 配置');
      return;
    }

    const cfg = this._config;
    const target = parsed.target instanceof Date ? parsed.target : new Date(parsed.target);
    if (isNaN(target.getTime())) {
      renderError(container, '无效的日期：' + parsed.target);
      return;
    }

    const direction = parsed.direction || (target.getTime() > Date.now() ? 'down' : 'up');

    // 外层卡片
    container.className = 'countdown-container';
    container.style.cssText = [
      'margin: 1.5em 0',
      'padding: 1.5em 1.75em',
      'background: var(--color-surface, #fff)',
      'border: 1px solid var(--color-border, #eee)',
      'border-radius: 12px',
      'font-family: system-ui, -apple-system, sans-serif'
    ].join(';');

    // 标题行
    const title = document.createElement('div');
    title.textContent = parsed.title || (direction === 'down' ? '距离目标' : '自目标起');
    title.style.cssText = 'font-size:0.875em;color:var(--color-text-muted, #999);margin-bottom:0.5em;letter-spacing:0.04em';
    container.appendChild(title);

    // 时间数字
    const digits = document.createElement('div');
    digits.style.cssText = 'display:flex;gap:0.5em;align-items:baseline;flex-wrap:wrap';
    const units = [
      { key: 'days', label: '天' },
      { key: 'hours', label: '时' },
      { key: 'minutes', label: '分' },
      { key: 'seconds', label: '秒' }
    ];
    const cells = {};
    units.forEach(u => {
      const cell = document.createElement('div');
      cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;min-width:48px';
      const num = document.createElement('span');
      num.style.cssText = 'font-size:1.75rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--color-text, #2d2d2d);line-height:1';
      num.textContent = '00';
      const lab = document.createElement('span');
      lab.style.cssText = 'font-size:0.7em;color:var(--color-text-muted, #999);margin-top:0.25em;text-transform:uppercase';
      lab.textContent = u.label;
      cell.appendChild(num);
      cell.appendChild(lab);
      digits.appendChild(cell);
      cells[u.key] = num;
    });
    container.appendChild(digits);

    // 目标时间显示
    const targetLine = document.createElement('div');
    targetLine.style.cssText = 'margin-top:0.75em;font-size:0.8em;color:var(--color-text-muted, #999)';
    targetLine.textContent = '目标：' + target.toLocaleString(cfg.locale);
    container.appendChild(targetLine);

    // 渲染一次后再淡入
    requestAnimationFrame(() => {
      container.style.opacity = '1';
    });

    // 计算并绘制
    const tick = () => {
      const now = Date.now();
      const diff = direction === 'down' ? target.getTime() - now : now - target.getTime();
      if (diff <= 0 && direction === 'down') {
        setDigits(cells, 0, 0, 0, 0);
        title.textContent = cfg.labelFinished;
        title.style.color = 'var(--color-accent-pink, #f2c4ce)';
        stop();
        return;
      }
      const secs = Math.floor(diff / 1000);
      setDigits(cells,
        Math.floor(secs / 86400),
        Math.floor((secs % 86400) / 3600),
        Math.floor((secs % 3600) / 60),
        secs % 60
      );
      if (direction === 'up') {
        title.textContent = cfg.labelCountingUp;
      }
    };

    const timerId = setInterval(tick, cfg.updateIntervalMs);
    this._timers.add(timerId);
    tick();

    // 注册资源以便 loader 在注销时统一清理
    if (context && typeof context.registerResource === 'function') {
      context.registerResource({
        destroy: () => stop()
      });
    }

    function stop() {
      if (timerId !== null) {
        clearInterval(timerId);
      }
    }
  },

  destroy() {
    // 兜底清理：所有未释放的定时器
    if (this._timers) {
      this._timers.forEach(id => clearInterval(id));
      this._timers.clear();
    }
    this._config = null;
  }
};

// ===== 输入解析 =====

function parseInput(code) {
  const raw = code.trim();
  if (!raw) return null;

  // 1. JSON 配置
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) {
        // [{target, ...}, ...] 取第一个
        if (obj.length === 0) return null;
        return normalizeConfig(obj[0]);
      }
      return normalizeConfig(obj);
    } catch (e) {
      return null;
    }
  }

  // 2. 相对时长：1d2h3m / 30m / 1h 等
  const relMatch = raw.match(/^(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/i);
  if (relMatch && (relMatch[1] || relMatch[2] || relMatch[3] || relMatch[4])) {
    const days = parseInt(relMatch[1] || '0', 10);
    const hours = parseInt(relMatch[2] || '0', 10);
    const minutes = parseInt(relMatch[3] || '0', 10);
    const seconds = parseInt(relMatch[4] || '0', 10);
    const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
    return { target: new Date(Date.now() + ms), direction: 'down' };
  }

  // 3. ISO 日期 / 任意 Date.parse 支持的格式
  const t = Date.parse(raw);
  if (!isNaN(t)) {
    return { target: new Date(t), direction: 'down' };
  }

  return null;
}

function normalizeConfig(obj) {
  const result = { ...obj };
  if (obj.target) {
    // 支持 target 为 ISO 字符串或时间戳
    result.target = obj.target instanceof Date ? obj.target : new Date(obj.target);
  } else if (obj.duration) {
    // duration: "1d2h" 形式
    const m = String(obj.duration).match(/^(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/i);
    if (m) {
      const days = parseInt(m[1] || '0', 10);
      const hours = parseInt(m[2] || '0', 10);
      const minutes = parseInt(m[3] || '0', 10);
      const seconds = parseInt(m[4] || '0', 10);
      const ms = ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
      result.target = new Date(Date.now() + ms);
      result.direction = result.direction || 'down';
    }
  }
  return result;
}

function setDigits(cells, d, h, m, s) {
  if (cells.days) cells.days.textContent = String(d).padStart(2, '0');
  if (cells.hours) cells.hours.textContent = String(h).padStart(2, '0');
  if (cells.minutes) cells.minutes.textContent = String(m).padStart(2, '0');
  if (cells.seconds) cells.seconds.textContent = String(s).padStart(2, '0');
}

function renderError(container, message) {
  container.className = 'countdown-container countdown-error';
  container.style.cssText = 'padding:12px 16px;border:1px solid #ff6b6b;border-radius:8px;background:#fff0f0;color:#cc0000;font-size:14px';
  container.innerHTML = '<strong>倒计时渲染错误：</strong> ' + message;
}
