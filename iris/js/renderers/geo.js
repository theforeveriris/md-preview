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
    renderGeoData
  };
})();
