// QR Code Generator Plugin
// 演示新插件 API：生命周期钩子、异步渲染、上下文配置、资源追踪
//
// 隐私说明：二维码内容完全本地生成（iris/js/qr-encoder.js 按需懒加载），
// 不再把用户内容明文发给第三方二维码 API；旧版「哈希画的伪二维码」
// fallback 已移除——生成失败时给出明确错误而不是不可扫描的误导图。

export default {
  name: 'qrcode',
  description: 'QR Code generator (local generation, no third-party API)',
  priority: 10, // 优先级：数值越大越优先匹配

  // test 现在可选：如果不声明，默认匹配 language === plugin.name
  test(code, language) {
    return language === 'qrcode';
  },

  // 生命周期：初始化 — 接收来自 config.json 的插件配置
  init(config) {
    // 合并默认配置与用户配置
    this._config = {
      defaultSize: 256,
      ecl: 'M', // 纠错等级 L/M/Q/H
      ...config
    };
  },

  // 生命周期：渲染前
  beforeRender(code, container, context) {
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
      if (parsed.ecl) this._config.ecl = parsed.ecl;
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

    // 注册资源以便后续清理
    if (context.registerResource) {
      context.registerResource({
        destroy: () => {
          qrContainer.innerHTML = '';
        }
      });
    }

    // 本地生成（首次调用会懒加载编码器脚本）
    try {
      if (!window.MarkdownPreview.QREncoder) {
        await window.MarkdownPreview.loadScript('iris/js/qr-encoder.js');
      }
      const enc = window.MarkdownPreview.QREncoder;
      const svg = enc.toSVG(data, { ecl: this._config.ecl, margin: 2 });
      if (!svg) throw new Error('too-long');
      qrContainer.innerHTML = svg;
      const svgEl = qrContainer.firstElementChild;
      svgEl.style.width = size + 'px';
      svgEl.style.height = size + 'px';
      svgEl.style.display = 'block';
    } catch (err) {
      qrContainer.innerHTML = '';
      const errBox = document.createElement('div');
      errBox.style.cssText = 'padding:12px 16px;border:1px solid #ff6b6b;border-radius:8px;background:#fff0f0;color:#cc0000;font-size:14px';
      if (err && err.message === 'too-long') {
        errBox.textContent = '二维码内容过长（上限约 ' + window.MarkdownPreview.QREncoder.capacity(this._config.ecl) + ' 字节），请缩短内容或降低纠错等级（L）';
      } else {
        errBox.textContent = '二维码生成失败：编码器加载失败';
      }
      qrContainer.appendChild(errBox);
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
    // noop
  },

  // 生命周期：销毁 — 清理资源
  destroy() {
    this._config = null;
  }
};
