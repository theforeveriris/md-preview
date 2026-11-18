(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  // 主题化错误提示（复用 plantuml-fallback 的 CSS 变量着色样式）
  function geoErrorNote(error) {
    const box = document.createElement('div');
    box.className = 'plantuml-fallback';
    const note = document.createElement('div');
    note.className = 'plantuml-fallback-note';
    note.textContent = t('geo.parseFailed', 'GeoJSON/TopoJSON 解析失败');
    if (error && error.message) note.title = error.message;
    box.appendChild(note);
    return box;
  }

  // Leaflet 必须按 window.L 取：页面里可能有别的脚本声明了全局 L（词法
  // 绑定会遮住 window.L），裸 `L` 会指向无关对象，导致 L.map is not a function
  async function ensureLeaflet() {
    const ready = () => window.L && typeof window.L.map === 'function';
    if (ready()) return true;
    try {
      await Promise.all([
        window.MarkdownPreview.loadStyle('iris/vendor/leaflet/leaflet.css'),
        window.MarkdownPreview.loadScript('iris/vendor/leaflet/leaflet.js'),
      ]);
    } catch (e) {
      console.warn('[geo] Leaflet load failed:', e);
    }
    return ready();
  }

  function showGeoError(mapId, error) {
    const box = mapId ? document.getElementById(mapId) : null;
    if (!box) return;
    box.innerHTML = '';
    box.style.height = 'auto';
    box.appendChild(geoErrorNote(error));
  }

  async function renderGeoData(type, dataStr, originalMatch, mapId) {
    if (!(await ensureLeaflet())) {
      showGeoError(mapId, new Error(t('geo.leafletFailed', '地图库 Leaflet 加载失败')));
      return;
    }

    try {
      const geoData = JSON.parse(dataStr);

      setTimeout(() => {
        // 当前所有调用方（embedded.js 嵌入工厂 / 围栏渲染）都传 mapId；
        // 旧的「无 mapId 时整页 innerHTML 重写」路径已删除（死代码且含
        // String.replace $ 序列与注入风险）
        if (!mapId) {
          console.warn('[geo] renderGeoData called without mapId, skipped');
          return;
        }
        const mapContainer = document.getElementById(mapId);
        if (!mapContainer) return;

        try {
          const L = window.L;
          const map = L.map(mapId).setView([35.8617, 104.1954], 5);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          if (type === 'geojson') {
            const layer = L.geoJSON(geoData, {
              onEachFeature: function(feature, lay) {
                if (feature.properties && feature.properties.name) {
                  // 弹窗内容以文本节点传入：properties.name 来自 GeoJSON 数据
                  // （可能为非受信来源），字符串形式会被 Leaflet 按 HTML 解析
                  lay.bindPopup(document.createTextNode(feature.properties.name));
                }
              }
            }).addTo(map);
            if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [12, 12] });
          } else if (type === 'topojson') {
            const geojsonData = topojsonToGeoJson(geoData);
            const layer = L.geoJSON(geojsonData, {
              onEachFeature: function(feature, lay) {
                if (feature.properties && feature.properties.name) {
                  lay.bindPopup(document.createTextNode(feature.properties.name));
                }
              }
            }).addTo(map);
            if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [12, 12] });
          }
        } catch (error) {
          console.error('[geo] map init failed:', error);
          showGeoError(mapId, error);
        }
      }, 10);
    } catch (error) {
      console.error('Geo data parsing error:', error);
      // 嵌入路径容器已建好：就地渲染主题化错误提示，不留空白 400px 盒子
      showGeoError(mapId, error);
    }
  }

  /**
   * 标准渲染器入口：支持 ```geojson / ```topojson 围栏，围栏内直接写 GeoJSON/
   * TopoJSON 数据（或与嵌入同款的 @[geojson](...) 语法）。无命中时直接返回，
   * 不加载 Leaflet。
   */
  async function render(root) {
    // 容器解析走 mdRender.resolveRoot（split-view 隐藏面板同样带 .markdown-body，
    // 全局查询会命中空面板——见 md-render.js resolveRoot 注释）
    const markdownBody = window.MarkdownPreview.mdRender.resolveRoot(root);
    if (!markdownBody) return;
    // 以 data-lang 为准：高亮/代码阅读器可能改写 <code> 的 class
    const blocks = markdownBody.querySelectorAll(
      'pre.code-block[data-lang="geojson"], pre.code-block[data-lang="topojson"]'
    );
    if (!blocks.length) return;

    let idx = 0;
    for (const pre of blocks) {
      if (pre.dataset.geoDone) continue;
      const lang = String(pre.dataset.lang || '');
      const type = lang.indexOf('topojson') !== -1 ? 'topojson' : 'geojson';
      const code = pre.querySelector('code');
      let data = (code ? code.textContent : pre.textContent).trim();
      if (!data) continue;

      // 围栏里的 @[geojson](...) 嵌入语法交给 embedded.js，避免当 JSON 解析
      if (/^@\[(?:geojson|topojson)\]\(/.test(data)) continue;

      pre.dataset.geoDone = '1';
      // 先验证 JSON 再替换 pre：解析失败保留源码块 + 主题化提示。
      // 旧实现先换容器后解析，失败后只剩空白 400px 盒子且源码丢失
      try {
        JSON.parse(data);
      } catch (error) {
        console.error('[geo] fence JSON parse failed:', error);
        pre.parentNode.insertBefore(geoErrorNote(error), pre);
        continue;
      }

      const mapId = 'map-' + Date.now() + '-' + (idx++);
      const container = document.createElement('div');
      container.id = mapId;
      container.className = 'geo-map';
      container.style.cssText = 'height:400px;border-radius:8px;overflow:hidden';
      pre.parentNode.replaceChild(container, pre);

      try {
        await renderGeoData(type, data, '', mapId);
      } catch (e) {
        console.error('[geo] fence render failed:', e);
      }
    }
  }

  function topojsonToGeoJson(topology) {
    const result = {
      type: 'FeatureCollection',
      features: []
    };
    const scale = (topology.transform && topology.transform.scale) || [1, 1];
    const translate = (topology.transform && topology.transform.translate) || [0, 0];
    const arcs = Array.isArray(topology.arcs) ? topology.arcs : [];

    const project = (x, y) => [x * scale[0] + translate[0], y * scale[1] + translate[1]];

    // TopoJSON 弧段是增量编码，负下标表示反向引用（~index）
    function decodeArc(arcIndex) {
      const reversed = arcIndex < 0;
      const idx = reversed ? ~arcIndex : arcIndex;
      const arc = arcs[idx];
      if (!Array.isArray(arc)) return [];
      const points = [];
      let x = 0;
      let y = 0;
      for (let i = 0; i < arc.length; i++) {
        x += arc[i][0];
        y += arc[i][1];
        points.push(project(x, y));
      }
      return reversed ? points.reverse() : points;
    }

    function lineFromArcs(list) {
      const out = [];
      (list || []).forEach(arcIndex => {
        const pts = decodeArc(arcIndex);
        pts.forEach((p, i) => {
          // 相邻弧段首尾重复时不重复追加
          if (i === 0 && out.length) {
            const last = out[out.length - 1];
            if (last[0] === p[0] && last[1] === p[1]) return;
          }
          out.push(p);
        });
      });
      return out;
    }

    function transformGeometry(geometry) {
      if (!geometry || !geometry.type) return null;
      switch (geometry.type) {
        case 'Point':
          return { type: 'Point', coordinates: project(geometry.coordinates[0], geometry.coordinates[1]) };
        case 'MultiPoint':
          return { type: 'MultiPoint', coordinates: geometry.coordinates.map(c => project(c[0], c[1])) };
        case 'LineString':
          return { type: 'LineString', coordinates: lineFromArcs(geometry.arcs) };
        case 'MultiLineString':
          return { type: 'MultiLineString', coordinates: (geometry.arcs || []).map(lineFromArcs) };
        case 'Polygon':
          return { type: 'Polygon', coordinates: (geometry.arcs || []).map(lineFromArcs) };
        case 'MultiPolygon':
          return { type: 'MultiPolygon', coordinates: (geometry.arcs || []).map(polygon => polygon.map(lineFromArcs)) };
        case 'GeometryCollection':
          return {
            type: 'GeometryCollection',
            geometries: (geometry.geometries || []).map(transformGeometry).filter(Boolean)
          };
        default:
          return null;
      }
    }

    for (const key in topology.objects) {
      const obj = topology.objects[key];
      const geoms = obj.type === 'GeometryCollection' ? (obj.geometries || []) : [obj];
      geoms.forEach(geom => {
        const g = transformGeometry(geom);
        if (!g) return;
        result.features.push({
          type: 'Feature',
          id: geom.id != null ? geom.id : obj.id,
          geometry: g,
          properties: geom.properties || obj.properties || {}
        });
      });
    }

    return result;
  }
  
  window.MarkdownPreview.renderers.geo = {
    render,
    renderGeoData
  };
})();
