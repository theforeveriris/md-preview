/**
 * page-shot - 整页长图导出（当前文档 → 一张竖版 PNG）
 *
 * 与分享卡片（selection-tools，画布重绘）不同的路线：直接把已渲染好的
 * .markdown-body 序列化为 SVG foreignObject，经 <img> 光栅化到 canvas——
 * 排版与屏幕一致（含代码高亮/表格/图表，图片需同源或 CORS 可读）。
 * 导出前把主题变量固化为内联样式，暗色主题下产出同样成立。
 *
 * 入口：命令面板「整页长图」+ 设置「导出」分组按钮。
 * 限制（渐进降级）：图片跨域不可读时降级为占位；foreignObject 光栅化
 * 失败（Safari 旧版等）时回退 window.print() 提示。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  const t = window.MarkdownPreview.t;

  function toast(msg, sticky) {
    let el = document.querySelector('.mini-toast[data-owner="pageshot"]');
    if (!el) {
      el = document.createElement('div');
      el.className = 'mini-toast';
      el.dataset.owner = 'pageshot';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('open');
    clearTimeout(el._timer);
    if (!sticky) el._timer = setTimeout(() => el.classList.remove('open'), 2600);
    return el;
  }

  // 克隆正文并把主题 CSS 变量固化为内联 style（SVG 里没有层叠上下文）
  function snapshotBody(sourceBody, width) {
    const clone = sourceBody.cloneNode(true);
    // 剔除交互附属物
    clone.querySelectorAll('.doc-figure .copy-link-btn, .heading-anchor, .copy-btn').forEach(el => el.remove());

    const rootStyle = getComputedStyle(document.documentElement);
    const vars = ['--color-bg', '--color-surface', '--color-border', '--color-text', '--color-text-muted',
      '--color-accent-purple', '--color-accent-pink', '--color-accent-purple-deep',
      '--font-body', '--font-display', '--font-mono', '--font-size-md'];
    let inline = '';
    vars.forEach(v => {
      const val = rootStyle.getPropertyValue(v).trim();
      if (val) inline += `${v}:${val};`;
    });
    clone.setAttribute('style', `${inline}width:${width}px;margin:0;padding:40px 48px;box-sizing:border-box;background:var(--color-bg);`);

    // 图片转 data URL（同源直读；跨域 CORS 可读也读，否则占位）
    const imgs = clone.querySelectorAll('img');
    const jobs = Array.from(imgs).map(async img => {
      const src = img.getAttribute('src') || '';
      if (/^data:/i.test(src)) return;
      try {
        const resp = await fetch(src, { mode: 'cors', cache: 'force-cache' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const blob = await resp.blob();
        if (blob.size > 4 * 1024 * 1024) throw new Error('too large');
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        img.setAttribute('src', dataUrl);
      } catch (e) {
        // 跨域不可读：中性占位
        img.setAttribute('src', 'data:image/svg+xml;utf8,' + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width || 400}" height="${img.height || 220}"><rect width="100%" height="100%" fill="rgba(128,128,128,0.15)"/><text x="50%" y="50%" text-anchor="middle" fill="rgba(128,128,128,0.6)" font-family="sans-serif" font-size="14">image</text></svg>`));
      }
    });
    return Promise.all(jobs).then(() => ({ clone, inline }));
  }

  function exportPageShot() {
    const body = document.querySelector('#markdownContent .markdown-body') ||
      document.getElementById('markdownContent');
    if (!body || !body.innerHTML) {
      toast(t('shot.needDoc', '请先打开一个文档'));
      return;
    }
    const busy = toast(t('shot.rendering', '正在生成长图…'), true);
    const width = Math.min(760, body.getBoundingClientRect().width || 760);

    snapshotBody(body, width).then(({ clone }) => {
      // 外链样式表无法进 SVG：注入一份最小排版规则（对齐站点视觉基调）
      const fontStyle = getComputedStyle(body);
      const css = `
        * { box-sizing: border-box; }
        body, div, p, li, td, th { font-family: ${fontStyle.fontFamily}; }
        img { max-width: 100%; }
        table { border-collapse: collapse; }
        pre { white-space: pre-wrap; word-break: break-word; background: rgba(127,127,127,0.08); padding: 12px; border-radius: 8px; }
        code { font-family: ui-monospace, Consolas, monospace; }
        blockquote { border-left: 3px solid var(--color-accent-purple); margin-left: 0; padding-left: 12px; color: var(--color-text-muted); }
        a { color: var(--color-accent-purple-deep); text-decoration: none; }
        h1,h2,h3,h4 { color: var(--color-text); }
        hr { border: none; border-top: 1px solid var(--color-border); }
      `;

      // XMLSerializer 输出带 XHTML 命名空间的合法 XML——outerHTML 的
      // <br>/<img ...>/&nbsp; 实体在 SVG data URL 的 XML 解析里全是
      // 格式错误，真实文档几乎必然光栅化失败
      const xhtmlWrap = document.createElement('div');
      xhtmlWrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      xhtmlWrap.appendChild(clone);
      const serializer = new XMLSerializer();
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${body.scrollHeight + 120}">
        <foreignObject width="100%" height="100%">
          <style>${css.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</style>
          ${serializer.serializeToString(xhtmlWrap)}
        </foreignObject>
      </svg>`;
      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

      const img = new Image();
      img.onload = () => {
        const dpr = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * dpr;
        canvas.height = (body.scrollHeight + 120) * dpr;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        ctx.drawImage(img, 0, 0, width, body.scrollHeight + 120);

        canvas.toBlob(blob => {
          busy.classList.remove('open');
          if (!blob) { toast(t('shot.failed', '长图生成失败')); return; }
          const slug = (document.title || 'page').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${slug}-full.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
          toast(t('shot.done', '长图已导出'));
        }, 'image/png');
      };
      img.onerror = () => {
        busy.classList.remove('open');
        toast(t('shot.failed', '长图生成失败'));
      };
      img.src = svgUrl;
    });
  }

  // ============== 入口装配 ==============

  function init() {
    // 命令面板动作
    const palette = window.MarkdownPreview.palette;
    if (palette && palette.registerActions) {
      palette.registerActions([{
        id: 'page-shot',
        icon: 'i-image',
        label: t('shot.paletteLabel', '整页长图导出'),
        run: exportPageShot
      }]);
    }
    // 设置面板导出分组按钮（有锚点才装配；编辑器等场景没有）
    const anchor = document.getElementById('pageShotSettingsAnchor');
    if (anchor && !anchor.querySelector('button')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'download-btn';
      btn.textContent = t('shot.button', '导出整页长图（PNG）');
      btn.addEventListener('click', exportPageShot);
      anchor.appendChild(btn);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.MarkdownPreview.pageShot = { exportPageShot };
})();
