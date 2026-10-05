---
title: GeoJSON / TopoJSON 示例
tags: [地图, 数据]
---

# GeoJSON / TopoJSON 示例

本页面展示地理数据可视化功能，支持 GeoJSON 和 TopoJSON 格式的嵌入渲染。

---

## 1. GeoJSON 点数据

### 单个点

**源码：**

```markdown
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[116.4074,39.9042]},"properties":{"name":"北京"}}]})
```

**渲染效果：**

```geojson
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[116.4074,39.9042]},"properties":{"name":"北京"}}]})
```

---

### 多个城市点

**源码：**

```markdown
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[116.4074,39.9042]},"properties":{"name":"北京"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[121.4737,31.2304]},"properties":{"name":"上海"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[113.2644,23.1291]},"properties":{"name":"广州"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[104.0668,30.5728]},"properties":{"name":"成都"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[120.1552,30.2741]},"properties":{"name":"杭州"}}]})
```

**渲染效果：**

```geojson
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[116.4074,39.9042]},"properties":{"name":"北京"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[121.4737,31.2304]},"properties":{"name":"上海"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[113.2644,23.1291]},"properties":{"name":"广州"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[104.0668,30.5728]},"properties":{"name":"成都"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[120.1552,30.2741]},"properties":{"name":"杭州"}}]})
```

---

## 2. GeoJSON 线数据

### 简单线段

**源码：**

```markdown
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[121.4737,31.2304]]},"properties":{"name":"京沪线"}}]})
```

**渲染效果：**

```geojson
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[121.4737,31.2304]]},"properties":{"name":"京沪线"}}]})
```

---

### 多段线路

**源码：**

```markdown
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[113.2644,23.1291]]},"properties":{"name":"京广线"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[121.4737,31.2304],[104.0668,30.5728]]},"properties":{"name":"沪蓉线"}}]})
```

**渲染效果：**

```geojson
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[113.2644,23.1291]]},"properties":{"name":"京广线"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[121.4737,31.2304],[104.0668,30.5728]]},"properties":{"name":"沪蓉线"}}]})
```

---

## 3. GeoJSON 多边形数据

### 简单多边形

**源码：**

```markdown
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[116.2,39.8],[116.6,39.8],[116.6,40.0],[116.2,40.0],[116.2,39.8]]]},"properties":{"name":"北京市中心区域"}}]})
```

**渲染效果：**

```geojson
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[116.2,39.8],[116.6,39.8],[116.6,40.0],[116.2,40.0],[116.2,39.8]]]},"properties":{"name":"北京市中心区域"}}]})
```

---

### 带孔多边形

**源码：**

```markdown
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[116.0,39.5],[117.0,39.5],[117.0,40.5],[116.0,40.5],[116.0,39.5]],[[116.3,39.8],[116.7,39.8],[116.7,40.2],[116.3,40.2],[116.3,39.8]]]},"properties":{"name":"环形区域"}}]})
```

**渲染效果：**

```geojson
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[116.0,39.5],[117.0,39.5],[117.0,40.5],[116.0,40.5],[116.0,39.5]],[[116.3,39.8],[116.7,39.8],[116.7,40.2],[116.3,40.2],[116.3,39.8]]]},"properties":{"name":"环形区域"}}]})
```

---

## 4. TopoJSON 数据

### TopoJSON 点数据

**源码：**

```markdown
@[topojson]({"type":"Topology","objects":{"cities":{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[116.4074,39.9042],"properties":{"name":"北京"}},{"type":"Point","coordinates":[121.4737,31.2304],"properties":{"name":"上海"}}]},"arcs":[],"transform":{"scale":[1,1],"translate":[0,0]}}})
```

**渲染效果：**

```topojson
@[topojson]({"type":"Topology","objects":{"cities":{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[116.4074,39.9042],"properties":{"name":"北京"}},{"type":"Point","coordinates":[121.4737,31.2304],"properties":{"name":"上海"}}]},"arcs":[],"transform":{"scale":[1,1],"translate":[0,0]}}})
```

---

## 5. 综合示例

### 城市与交通网络

**源码：**

```markdown
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[116.4074,39.9042]},"properties":{"name":"北京"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[121.4737,31.2304]},"properties":{"name":"上海"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[113.2644,23.1291]},"properties":{"name":"广州"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[121.4737,31.2304]]},"properties":{"name":"京沪高速"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[113.2644,23.1291]]},"properties":{"name":"京广高速"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[121.4737,31.2304],[113.2644,23.1291]]},"properties":{"name":"沪昆高速"}}]})
```

**渲染效果：**

```geojson
@[geojson]({"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[116.4074,39.9042]},"properties":{"name":"北京"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[121.4737,31.2304]},"properties":{"name":"上海"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[113.2644,23.1291]},"properties":{"name":"广州"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[121.4737,31.2304]]},"properties":{"name":"京沪高速"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[116.4074,39.9042],[113.2644,23.1291]]},"properties":{"name":"京广高速"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[121.4737,31.2304],[113.2644,23.1291]]},"properties":{"name":"沪昆高速"}}]})
```