(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};
  
  const { dom } = window.MarkdownPreview;
  
  async function renderGeoData(type, dataStr, originalMatch, mapId) {
    // 按需加载 leaflet JS + CSS（~150KB，仅在出现 geojson/topojson 嵌入时才需要）
    if (typeof L === 'undefined') {
      await Promise.all([
        window.MarkdownPreview.loadStyle('iris/vendor/leaflet/leaflet.css'),
        window.MarkdownPreview.loadScript('iris/vendor/leaflet/leaflet.js'),
      ]);
    }
    if (typeof L === 'undefined') {
      console.error('Leaflet library failed to load');
      return;
    }

    try {
      const geoData = JSON.parse(dataStr);
      
      setTimeout(() => {
        let containerId = mapId;
        
        if (!containerId) {
          containerId = 'map-' + Date.now();
          const container = document.createElement('div');
          container.id = containerId;
          container.className = 'geo-map';
          container.style.height = '400px';
          container.style.borderRadius = '8px';
          container.style.overflow = 'hidden';
          
          const content = dom.markdownContent.innerHTML;
          dom.markdownContent.innerHTML = content.replace(originalMatch, container.outerHTML);
        }
        
        const mapContainer = document.getElementById(containerId);
        if (!mapContainer) return;
        
        const map = L.map(containerId).setView([35.8617, 104.1954], 5);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        if (type === 'geojson') {
          L.geoJSON(geoData, {
            onEachFeature: function(feature, layer) {
              if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
              }
            }
          }).addTo(map);
        } else if (type === 'topojson') {
          const geojsonData = topojsonToGeoJson(geoData);
          L.geoJSON(geojsonData, {
            onEachFeature: function(feature, layer) {
              if (feature.properties && feature.properties.name) {
                layer.bindPopup(feature.properties.name);
              }
            }
          }).addTo(map);
        }
        
        const bounds = map.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds);
        }
      }, 10);
    } catch (error) {
      console.error('Geo data parsing error:', error);
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
    const blocks = markdownBody.querySelectorAll('pre code.language-geojson, pre code.language-topojson');
    if (!blocks.length) return;

    let idx = 0;
    for (const code of blocks) {
      const pre = code.closest('pre');
      if (!pre || pre.dataset.geoDone) continue;
      const type = code.className.includes('language-topojson') ? 'topojson' : 'geojson';
      let data = code.textContent.trim();
      if (!data) continue;

      // 兼容嵌入语法：```geojson 围栏内写 @[geojson](...) 时提取数据部分
      const embedMatch = data.match(/@\[geojson\]\(([\s\S]*)\)\s*$/);
      if (embedMatch) data = embedMatch[1];

      pre.dataset.geoDone = '1';
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
    
    function decodeArc(arcIndex) {
      const arc = topology.arcs[arcIndex];
      const result = [];
      let x = 0, y = 0;
      for (let i = 0; i < arc.length; i++) {
        x += arc[i][0];
        y += arc[i][1];
        result.push([x, y]);
      }
      return result;
    }
    
    function transformGeometry(geometry) {
      const result = {
        type: geometry.type,
        coordinates: []
      };
      
      switch (geometry.type) {
        case 'Point':
          result.coordinates = geometry.coordinates;
          break;
        case 'LineString':
          result.coordinates = geometry.arcs.flatMap(arcIdx => decodeArc(arcIdx));
          break;
        case 'Polygon':
          result.coordinates = geometry.arcs.map(ring => ring.flatMap(arcIdx => decodeArc(arcIdx)));
          break;
        case 'MultiPoint':
          result.coordinates = geometry.coordinates;
          break;
        case 'MultiLineString':
          result.coordinates = geometry.arcs.map(line => line.flatMap(arcIdx => decodeArc(arcIdx)));
          break;
        case 'MultiPolygon':
          result.coordinates = geometry.arcs.map(polygon => polygon.map(ring => ring.flatMap(arcIdx => decodeArc(arcIdx))));
          break;
        case 'GeometryCollection':
          result.geometries = geometry.geometries.map(transformGeometry);
          delete result.coordinates;
          break;
      }
      
      return result;
    }
    
    for (const key in topology.objects) {
      const obj = topology.objects[key];
      if (obj.type === 'GeometryCollection') {
        obj.geometries.forEach(geom => {
          result.features.push({
            type: 'Feature',
            geometry: transformGeometry(geom),
            properties: {}
          });
        });
      } else if (obj.type === 'Polygon' || obj.type === 'LineString' || obj.type === 'Point') {
        result.features.push({
          type: 'Feature',
          geometry: transformGeometry(obj),
          properties: {}
        });
      }
    }
    
    return result;
  }
  
  window.MarkdownPreview.renderers.geo = {
    render,
    renderGeoData
  };
})();
