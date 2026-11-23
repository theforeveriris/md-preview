/**
 * 图片热点标注（E1）
 *
 * Markdown 语法：
 *   ```hotspot
 *   {
 *     "image": "docs/image/foo.png",
 *     "hotspots": [
 *       { "x": 20, "y": 30, "w": 12, "h": 8, "label": "入口" },
 *       { "x": 60, "y": 55, "label": "出口" }
 *     ]
 *   }
 *   ```
 *
 * x/y/w/h 为百分比（相对图片宽高）；w/h 缺省时按标签长度自适应。
 * 渲染：图片 + 可点击/悬停热点，悬停显示标签，点击固定并高亮。
 * 失败回退：图片加载失败或 JSON 非法时显示错误卡片 + 原始 JSON。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  const t = window.MarkdownPreview.t || ((k, f) => f || k);
  const esc = window.MarkdownPreview.mdRender.escapeHtml;

  function renderFence(pre) {
    const text = pre.querySelector('code')?.textContent || '';
    let spec;
    try { spec = JSON.parse(text); } catch (e) { return false; }
    if (!spec || typeof spec !== 'object') return false;
    const src = spec.image;
    if (!src) return false;

    const widget = document.createElement('div');
    widget.className = 'hotspot-view';

    // 图片与热点层必须放在同一个定位容器里：
    // 热点坐标是相对图片宽高的百分比，若热点层铺满整个视图
    // （视图底部还有图例），百分比就会落到图例区域上，位置全偏。
    const stage = document.createElement('div');
    stage.className = 'hotspot-stage';

    const img = document.createElement('img');
    img.className = 'hotspot-image';
    img.src = src.startsWith('/') ? src : '/' + String(src).replace(/^\.\//, '');
    img.alt = spec.title || src;
    img.loading = 'lazy';
    stage.appendChild(img);

    const layer = document.createElement('div');
    layer.className = 'hotspot-layer';
    const legend = document.createElement('ol');
    legend.className = 'hotspot-legend';
    const pins = [];
    (spec.hotspots || []).forEach((h, i) => {
      if (!h || (h.x == null || h.y == null)) return;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'hotspot-pin';
      el.style.left = h.x + '%';
      el.style.top = h.y + '%';
      el.style.width = (h.w || 0) + '%';
      el.style.height = (h.h || 0) + '%';
      el.setAttribute('aria-label', h.label || ('热点 ' + (i + 1)));
      const badge = document.createElement('span');
      badge.className = 'hotspot-num';
      badge.textContent = String(pins.length + 1);
      el.appendChild(badge);
      const tip = document.createElement('span');
      tip.className = 'hotspot-tip';
      tip.textContent = h.label || '';
      el.appendChild(tip);
      const setActive = (on) => {
        el.classList.toggle('hotspot-hover', on);
        legend.querySelectorAll('.hotspot-legend-item').forEach(li => {
          if (li.dataset.pin === el.dataset.pin) li.classList.toggle('hotspot-legend-on', on);
        });
      };
      el.addEventListener('mouseenter', () => setActive(true));
      el.addEventListener('mouseleave', () => setActive(false));
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOn = el.classList.contains('hotspot-active');
        layer.querySelectorAll('.hotspot-pin.hotspot-active').forEach(p => {
          p.classList.remove('hotspot-active');
          const li = legend.querySelector(`.hotspot-legend-item[data-pin="${p.dataset.pin}"]`);
          if (li) li.classList.remove('hotspot-legend-on');
        });
        if (!wasOn) {
          el.classList.add('hotspot-active');
          const li = legend.querySelector(`.hotspot-legend-item[data-pin="${el.dataset.pin}"]`);
          if (li) li.classList.add('hotspot-legend-on');
        }
      });
      el.dataset.pin = String(pins.length + 1);
      layer.appendChild(el);
      pins.push(el);

      const li = document.createElement('li');
      li.className = 'hotspot-legend-item';
      li.dataset.pin = el.dataset.pin;
      const num = document.createElement('span');
      num.className = 'hotspot-legend-num';
      num.textContent = el.dataset.pin;
      li.appendChild(num);
      li.appendChild(document.createTextNode(h.label || ('热点 ' + el.dataset.pin)));
      li.addEventListener('mouseenter', () => setActive(true));
      li.addEventListener('mouseleave', () => setActive(false));
      li.addEventListener('click', () => el.click());
      legend.appendChild(li);
    });
    stage.appendChild(layer);
    widget.appendChild(stage);
    if (legend.children.length) widget.appendChild(legend);

    const loaded = new Promise(res => { img.addEventListener('load', res, { once: true }); });
    loaded.then(() => {
      // 图片加载后才能正确叠加百分比定位
      layer.style.display = 'block';
      widget.querySelectorAll('.hotspot-pin').forEach(p => {
        if ((p.style.width === '0%' || !p.style.width)) {
          p.style.width = 'auto';
          p.style.minWidth = '2.2em';
          p.style.height = 'auto';
          p.style.minHeight = '2.2em';
        }
      });
    });
    layer.style.display = 'none';

    pre.replaceWith(widget);
    return true;
  }

  function render(root) {
    const scope = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!scope) return;
    scope.querySelectorAll('pre.code-block').forEach(pre => {
      if (pre.dataset.hotspotDone) return;
      const lang = String(pre.dataset.lang || '').trim().split(/\s+/)[0];
      if (lang === 'hotspot') {
        pre.dataset.hotspotDone = '1';
        renderFence(pre);
      }
    });
  }

  window.MarkdownPreview.renderers.hotspot = { render };
})();
