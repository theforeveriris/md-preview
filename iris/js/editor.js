(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 编辑器模式切换 ==============
  const editorOverlay = document.getElementById('editorOverlay');
  let editorInitialized = false;

  function enterEditorMode() {
    if (!editorOverlay) return;
    // 必须用 flex 而非 block，否则 .editor-overlay 的 flex 布局失效，
    // .editor-main 无法获得剩余高度，导致无法滚动
    editorOverlay.style.display = 'flex';
    document.body.classList.add('editor-mode');
    // 更新 URL（保留 hash）
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'editor');
    window.history.replaceState({}, '', url.toString());
    if (!editorInitialized) {
      editorInitialized = true;
      initEditor();
    }
  }

  function exitEditorMode() {
    if (!editorOverlay) return;
    editorOverlay.style.display = 'none';
    document.body.classList.remove('editor-mode');
    const url = new URL(window.location.href);
    url.searchParams.delete('mode');
    window.history.replaceState({}, '', url.toString());
  }

  // 暴露给外部调用
  window.MarkdownPreview.enterEditorMode = enterEditorMode;
  window.MarkdownPreview.exitEditorMode = exitEditorMode;

  // 根据 URL 参数自动进入编辑器模式
  function checkEditorMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'editor') {
      enterEditorMode();
    }
  }

  // 退出按钮
  document.getElementById('exitEditorBtn')?.addEventListener('click', exitEditorMode);

  function initEditor() {

  // ============== 状态 ==============
  let cells = [];
  let cellCounter = 0;
  let activeCellId = null;
  let contextMenuCellId = null;
  let globalAddBtn = null;

  // ============== 画廊样式注册（来自共享渲染模块） ==============
  const mdRender = window.MarkdownPreview.mdRender;
  const knownStyles = mdRender.KNOWN_STYLES;
  // editor.js 使用 SVG 版本的 Alert 图标
  const svgWrap = (path) => `<svg class="alert-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const EDITOR_ALERT_TYPES = {
    NOTE:     { icon: svgWrap('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'), title: 'Note' },
    IMPORTANT:{ icon: svgWrap('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>'), title: 'Important' },
    WARNING:  { icon: svgWrap('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>'), title: 'Warning' },
    TIP:      { icon: svgWrap('<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3v1h6v-1c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>'), title: 'Tip' },
    CAUTION:  { icon: svgWrap('<circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>'), title: 'Caution' }
  };

  // ============== 自动补全：多触发器条目库 ==============
  // 每个条目：{ trigger: 触发前缀, label, desc, insert, replaceLength: 替换前缀长度 }
  const autocompleteItems = [
    // @ 画廊样式 + 嵌入服务（@ 前缀双义）
    { trigger: '@', label: '@grid', desc: '画廊·默认网格', insert: '@grid\n', replaceLength: 1 },
    { trigger: '@', label: '@cardstack', desc: '画廊·扑克牌堆', insert: '@cardstack\n', replaceLength: 1 },
    { trigger: '@', label: '@filmstrip', desc: '画廊·胶片条', insert: '@filmstrip\n', replaceLength: 1 },
    { trigger: '@', label: '@polaroid', desc: '画廊·拍立得墙', insert: '@polaroid\n', replaceLength: 1 },
    { trigger: '@', label: '@stack', desc: '画廊·堆叠覆盖', insert: '@stack\n', replaceLength: 1 },
    { trigger: '@', label: '@mosaic', desc: '画廊·马赛克', insert: '@mosaic\n', replaceLength: 1 },
    { trigger: '@', label: '@scattered', desc: '画廊·散落明信片', insert: '@scattered\n', replaceLength: 1 },
    { trigger: '@', label: '@hexagon', desc: '画廊·蜂巢六边形', insert: '@hexagon\n', replaceLength: 1 },
    { trigger: '@', label: '@coverflow', desc: '画廊·Cover Flow', insert: '@coverflow\n', replaceLength: 1 },
    { trigger: '@', label: '@tape', desc: '画廊·软木板留言墙', insert: '@tape\n', replaceLength: 1 },
    { trigger: '@', label: '@duotone', desc: '画廊·双色调', insert: '@duotone\n', replaceLength: 1 },
    { trigger: '@', label: '@frame', desc: '画廊·画框装裱', insert: '@frame\n', replaceLength: 1 },
    { trigger: '@', label: '@arch', desc: '画廊·拱形画廊', insert: '@arch\n', replaceLength: 1 },
    { trigger: '@', label: '@masonry', desc: '画廊·瀑布流', insert: '@masonry\n', replaceLength: 1 },
    { trigger: '@', label: '@slider', desc: '画廊·幻灯片', insert: '@slider\n', replaceLength: 1 },
    { trigger: '@', label: '@ticket', desc: '画廊·票根', insert: '@ticket\n', replaceLength: 1 },
    { trigger: '@', label: '@panorama', desc: '画廊·全景横幅', insert: '@panorama\n', replaceLength: 1 },
    // @ 外部嵌入
    { trigger: '@', label: '@[youtube](ID)', desc: '嵌入·YouTube', insert: '@[youtube](dQw4w9WgXcQ)', replaceLength: 1 },
    { trigger: '@', label: '@[bilibili](BV)', desc: '嵌入·Bilibili', insert: '@[bilibili](BV1xx411c7mD)', replaceLength: 1 },
    { trigger: '@', label: '@[vimeo](ID)', desc: '嵌入·Vimeo', insert: '@[vimeo](76979871)', replaceLength: 1 },
    { trigger: '@', label: '@[twitter](URL)', desc: '嵌入·Twitter/X', insert: '@[twitter](https://twitter.com/user/status/123)', replaceLength: 1 },
    { trigger: '@', label: '@[gist](URL)', desc: '嵌入·GitHub Gist', insert: '@[gist](https://gist.github.com/user/id)', replaceLength: 1 },
    { trigger: '@', label: '@[codepen](URL)', desc: '嵌入·CodePen', insert: '@[codepen](https://codepen.io/user/pen/abc)', replaceLength: 1 },
    { trigger: '@', label: '@[jsfiddle](URL)', desc: '嵌入·JSFiddle', insert: '@[jsfiddle](https://jsfiddle.net/user/abc/)', replaceLength: 1 },
    { trigger: '@', label: '@[stackblitz](URL)', desc: '嵌入·StackBlitz', insert: '@[stackblitz](https://stackblitz.com/edit/user-project)', replaceLength: 1 },
    { trigger: '@', label: '@[replit](URL)', desc: '嵌入·Replit', insert: '@[replit](https://replit.com/@user/project)', replaceLength: 1 },
    { trigger: '@', label: '@[figma](URL)', desc: '嵌入·Figma', insert: '@[figma](https://www.figma.com/file/abc/Design)', replaceLength: 1 },
    { trigger: '@', label: '@[googlemaps](URL)', desc: '嵌入·Google Maps', insert: '@[googlemaps](https://www.google.com/maps/place/Beijing)', replaceLength: 1 },
    { trigger: '@', label: '@[openstreetmap](URL)', desc: '嵌入·OpenStreetMap', insert: '@[openstreetmap](https://www.openstreetmap.org/?mlat=39.9&mlon=116.4#map=12)', replaceLength: 1 },
    { trigger: '@', label: '@[googledocs](URL)', desc: '嵌入·Google Docs', insert: '@[googledocs](https://docs.google.com/document/d/abc/edit)', replaceLength: 1 },
    { trigger: '@', label: '@[pkt](name)', desc: '嵌入·PT 拓扑', insert: '@[pkt](example)', replaceLength: 1 },
    // ``` 代码块语言
    { trigger: '```', label: '```mermaid', desc: 'Mermaid 流程图', insert: '```mermaid\nflowchart TD\n    A --> B\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 时序图', desc: 'sequenceDiagram', insert: '```mermaid\nsequenceDiagram\n    Alice->>Bob: Hello\n    Bob-->>Alice: Hi\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 类图', desc: 'classDiagram', insert: '```mermaid\nclassDiagram\n    class Animal {\n        +String name\n        +makeSound()\n    }\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 状态图', desc: 'stateDiagram-v2', insert: '```mermaid\nstateDiagram-v2\n    [*] --> 待机\n    待机 --> [*]\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid ER 图', desc: 'erDiagram', insert: '```mermaid\nerDiagram\n    A ||--o{ B : has\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 甘特图', desc: 'gantt', insert: '```mermaid\ngantt\n    title 计划\n    dateFormat YYYY-MM-DD\n    section 阶段\n    任务1 :2024-01-01, 7d\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 饼图', desc: 'pie', insert: '```mermaid\npie title 占比\n    "A" : 40\n    "B" : 60\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 用户旅程', desc: 'journey', insert: '```mermaid\njourney\n    title 旅程\n    section 阶段\n    步骤: 5: 用户\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 思维导图', desc: 'mindmap', insert: '```mermaid\nmindmap\n  root((主题))\n    分支A\n    分支B\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 时间线', desc: 'timeline', insert: '```mermaid\ntimeline\n    title 时间线\n    2024-01 : 启动\n    2024-12 : 发布\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid 四象限', desc: 'quadrantChart', insert: '```mermaid\nquadrantChart\n    title 四象限\n    x-axis 低 --> 高\n    y-axis 低 --> 高\n    quadrant-1 Q1\n    quadrant-2 Q2\n    quadrant-3 Q3\n    quadrant-4 Q4\n```', replaceLength: 3 },
    { trigger: '```', label: '```mermaid Git 图', desc: 'gitGraph', insert: '```mermaid\ngitGraph\n    commit id: "init"\n    branch develop\n    checkout develop\n    commit id: "feat"\n    checkout main\n    merge develop\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml', desc: 'PlantUML 时序图', insert: '```plantuml\n@startuml\nAlice -> Bob: Hello\nBob --> Alice: Hi\n@enduml\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml 类图', desc: 'PlantUML class', insert: '```plantuml\n@startuml\nclass Animal\nAnimal : + String name\nAnimal <|-- Dog\n@enduml\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml 用例图', desc: 'PlantUML usecase', insert: '```plantuml\n@startuml\nleft to right direction\nactor 用户\nusecase 登录\n用户 --> 登录\n@enduml\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml 活动图', desc: 'PlantUML activity', insert: '```plantuml\n@startuml\nstart\n:开始;\nif (条件?) then (是)\n  :执行;\nelse (否)\n  :跳过;\nendif\nstop\n@enduml\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml 组件图', desc: 'PlantUML component', insert: '```plantuml\n@startuml\npackage 应用 {\n  [Web UI] as ui\n  [API] as api\n}\nui --> api\n@enduml\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml 部署图', desc: 'PlantUML deployment', insert: '```plantuml\n@startuml\nnode 客户端 {\n  [浏览器]\n}\nnode 服务器 {\n  [服务]\n}\n@enduml\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml 思维导图', desc: 'PlantUML mindmap', insert: '```plantuml\n@startmindmap\n* 主题\n** 分支A\n** 分支B\n@endmindmap\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml WBS', desc: 'PlantUML WBS', insert: '```plantuml\n@startwbs\n* 项目\n** 阶段1\n** 阶段2\n@endwbs\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml ER 图', desc: 'PlantUML entity', insert: '```plantuml\n@startuml\nentity 用户 {\n  * id : bigint <<PK>>\n  --\n  名称 : string\n}\n@enduml\n```', replaceLength: 3 },
    { trigger: '```', label: '```plantuml 线框图', desc: 'PlantUML salt', insert: '```plantuml\n@startsalt\n{\n  登录\n  用户: [          ]\n  [确定]\n}\n@endsalt\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 折线图', desc: 'ApexCharts line', insert: '```apexcharts\n{"chart":{"type":"line"},"series":[{"name":"A","data":[10,20,15,30]}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 柱状图', desc: 'ApexCharts bar', insert: '```apexcharts\n{"chart":{"type":"bar"},"series":[{"data":[30,40,35]}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 面积图', desc: 'ApexCharts area', insert: '```apexcharts\n{"chart":{"type":"area"},"series":[{"data":[10,20,15,30]}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 饼图', desc: 'ApexCharts pie', insert: '```apexcharts\n{"chart":{"type":"pie"},"series":[30,40,30],"labels":["A","B","C"]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 环形图', desc: 'ApexCharts donut', insert: '```apexcharts\n{"chart":{"type":"donut"},"series":[44,55,13],"labels":["A","B","C"]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 雷达图', desc: 'ApexCharts radar', insert: '```apexcharts\n{"chart":{"type":"radar"},"series":[{"data":[80,50,90,70,60]}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 散点图', desc: 'ApexCharts scatter', insert: '```apexcharts\n{"chart":{"type":"scatter"},"series":[{"data":[[10,30],[20,40]]}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 气泡图', desc: 'ApexCharts bubble', insert: '```apexcharts\n{"chart":{"type":"bubble"},"series":[{"data":[[1,30,10],[2,40,15]]}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```apexcharts 极坐标', desc: 'ApexCharts polarArea', insert: '```apexcharts\n{"chart":{"type":"polarArea"},"series":[14,23,21,17]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```diff', desc: 'Diff 差异', insert: '```diff\n+ 新增\n- 删除\n```', replaceLength: 3 },
    { trigger: '```', label: '```geo', desc: '坐标地图', insert: '```geo\n{"lat":39.9042,"lng":116.4074,"zoom":12}\n```', replaceLength: 3 },
    { trigger: '```', label: '```geojson', desc: 'GeoJSON 地图', insert: '```geojson\n{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"点"},"geometry":{"type":"Point","coordinates":[116.4,39.9]}}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```topojson', desc: 'TopoJSON 地图', insert: '```topojson\n{"type":"Topology","objects":{},"arcs":[]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```qrcode', desc: '二维码', insert: '```qrcode\nhttps://github.com\n```', replaceLength: 3 },
    { trigger: '```', label: '```abc', desc: 'ABC 乐谱', insert: '```abc\nX:1\nT:曲名\nM:4/4\nL:1/4\nK:C\nC D E F|G A B c|\n```', replaceLength: 3 },
    { trigger: '```', label: '```javascript', desc: 'JavaScript', insert: '```javascript\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```python', desc: 'Python', insert: '```python\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```bash', desc: 'Shell', insert: '```bash\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```json', desc: 'JSON', insert: '```json\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```html', desc: 'HTML', insert: '```html\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```css', desc: 'CSS', insert: '```css\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```sql', desc: 'SQL', insert: '```sql\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```yaml', desc: 'YAML', insert: '```yaml\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```typescript', desc: 'TypeScript', insert: '```typescript\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```go', desc: 'Go', insert: '```go\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```rust', desc: 'Rust', insert: '```rust\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```java', desc: 'Java', insert: '```java\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```c', desc: 'C', insert: '```c\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```cpp', desc: 'C++', insert: '```cpp\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```ruby', desc: 'Ruby', insert: '```ruby\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```php', desc: 'PHP', insert: '```php\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```swift', desc: 'Swift', insert: '```swift\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```kotlin', desc: 'Kotlin', insert: '```kotlin\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```dockerfile', desc: 'Dockerfile', insert: '```dockerfile\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```nginx', desc: 'Nginx', insert: '```nginx\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```ini', desc: 'INI', insert: '```ini\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```xml', desc: 'XML', insert: '```xml\n\n```', replaceLength: 3 },
    { trigger: '```', label: '```markdown', desc: 'Markdown', insert: '```markdown\n\n```', replaceLength: 3 },
    // > [! GitHub Alert
    { trigger: '> [!', label: '> [!NOTE]', desc: '提示', insert: '> [!NOTE]\n> ', replaceLength: 4 },
    { trigger: '> [!', label: '> [!IMPORTANT]', desc: '重要', insert: '> [!IMPORTANT]\n> ', replaceLength: 4 },
    { trigger: '> [!', label: '> [!WARNING]', desc: '警告', insert: '> [!WARNING]\n> ', replaceLength: 4 },
    { trigger: '> [!', label: '> [!TIP]', desc: '建议', insert: '> [!TIP]\n> ', replaceLength: 4 },
    { trigger: '> [!', label: '> [!CAUTION]', desc: '谨慎', insert: '> [!CAUTION]\n> ', replaceLength: 4 },
    // # 标题
    { trigger: '#', label: '# 一级标题', desc: 'H1', insert: '# ', replaceLength: 1 },
    { trigger: '#', label: '## 二级标题', desc: 'H2', insert: '## ', replaceLength: 1 },
    { trigger: '#', label: '### 三级标题', desc: 'H3', insert: '### ', replaceLength: 1 },
    { trigger: '#', label: '#### 四级标题', desc: 'H4', insert: '#### ', replaceLength: 1 },
    { trigger: '#', label: '##### 五级标题', desc: 'H5', insert: '##### ', replaceLength: 1 },
    { trigger: '#', label: '###### 六级标题', desc: 'H6', insert: '###### ', replaceLength: 1 },
    // - 列表
    { trigger: '-', label: '- 无序列表', desc: 'Bullet list', insert: '- ', replaceLength: 1 },
    { trigger: '-', label: '- [ ] 任务列表', desc: 'Task list', insert: '- [ ] ', replaceLength: 1 },
    // | 表格
    { trigger: '|', label: '| 表格 (2 列)', desc: '2 列表格', insert: '| 列1 | 列2 |\n| --- | --- |\n|  |  |\n', replaceLength: 1 },
    { trigger: '|', label: '| 表格 (3 列)', desc: '3 列表格', insert: '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|  |  |  |\n', replaceLength: 1 },
    { trigger: '|', label: '| 表格 (4 列)', desc: '4 列表格', insert: '| 列1 | 列2 | 列3 | 列4 |\n| --- | --- | --- | --- |\n|  |  |  |  |\n', replaceLength: 1 },
    // --- 水平线 / Frontmatter
    { trigger: '---', label: '--- 水平分割线', desc: 'Horizontal rule', insert: '---\n', replaceLength: 3 },
    { trigger: '---', label: '--- Frontmatter', desc: 'YAML 文档头', insert: '---\ntitle: \ndate: \n---\n', replaceLength: 3 },
    // > 普通引用
    { trigger: '>', label: '> 引用', desc: 'Blockquote', insert: '> ', replaceLength: 1 },
    // $$ KaTeX 公式块
    { trigger: '$$', label: '$$ 公式块', desc: 'KaTeX block', insert: '$$\n\n$$', replaceLength: 2 },
    // ![ 图片
    { trigger: '![', label: '![alt](url) 图片', desc: '图片', insert: '![](https://)', replaceLength: 2 },
    { trigger: '![', label: '![alt](url "标题") 带标题图片', desc: '带标题', insert: '![](https:// "标题")', replaceLength: 2 },
    // [ 链接
    { trigger: '[', label: '[text](url) 链接', desc: '超链接', insert: '[](https://)', replaceLength: 1 },
    { trigger: '[', label: '[text](url "标题") 带标题链接', desc: '带标题', insert: '[](https:// "标题")', replaceLength: 1 },
    { trigger: '[', label: '[ref]: url 引用链接', desc: '引用式', insert: '[1]: https://', replaceLength: 1 },
  ];

  // ============== DOM 引用 ==============
  const editorMain = document.getElementById('editorMain');
  const runCurrentBtn = document.getElementById('runCurrentBtn');
  const runAllBtn = document.getElementById('runAllBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const autocompleteList = document.getElementById('autocompleteList');
  const selectionToolbar = document.getElementById('selectionToolbar');
  const contextMenu = document.getElementById('contextMenu');
  const cellCountBadge = document.getElementById('cellCountBadge');
  const statusCellCount = document.getElementById('statusCellCount');
  const statusWords = document.getElementById('statusWords');
  const statusLines = document.getElementById('statusLines');
  const statusCursor = document.getElementById('statusCursor');
  const statusActive = document.getElementById('statusActive');
  const statusRunStats = document.getElementById('statusRunStats');
  const statusCurCellWords = document.getElementById('statusCurCellWords');
  const statusSave = document.getElementById('statusSave');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('searchInput');
  const replaceInput = document.getElementById('replaceInput');
  const searchInfo = document.getElementById('searchInfo');
  const fontSizeMenu = document.getElementById('fontSizeMenu');
  const fontSizeBtn = document.getElementById('fontSizeBtn');
  const searchBtn = document.getElementById('searchBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const fileInput = document.getElementById('fileInput');
  const imageUploadBtn = document.getElementById('imageUploadBtn');
  const imageUploadPopover = document.getElementById('imageUploadPopover');

  // ============== Cell 管理 ==============

  function createCell(afterCellId, initialContent, opts) {
    opts = opts || {};
    cellCounter++;
    const id = cellCounter;
    const cellType = opts.type || 'markdown'; // 'markdown' | 'plaintext'

    const cellDiv = document.createElement('div');
    cellDiv.className = 'cell cell-type-' + cellType;
    cellDiv.dataset.cellId = id;
    cellDiv.dataset.cellType = cellType;

    cellDiv.innerHTML = `
      <div class="cell-header">
        <div class="cell-header-left">
          <span class="cell-number">
            <span class="cell-status-dot"></span>
            Cell [<span class="cell-num">${id}</span>]
          </span>
          <span class="cell-type-badge">${cellType === 'plaintext' ? 'TXT' : 'MD'}</span>
          <span class="cell-meta cell-lines">0 行</span>
        </div>
        <div class="cell-header-right">
          <button class="cell-action-btn cell-run-btn" data-cell-id="${id}" title="运行 (Ctrl+Enter)"><svg class="ico ico-sm"><use href="#i-play"/></svg></button>
          <button class="cell-action-btn cell-collapse-btn" data-cell-id="${id}" title="折叠/展开"><svg class="ico ico-sm"><use href="#i-chevron-right"/></svg></button>
          <button class="cell-action-btn cell-up-btn" data-cell-id="${id}" title="上移"><svg class="ico ico-sm"><use href="#i-arrow-up"/></svg></button>
          <button class="cell-action-btn cell-down-btn" data-cell-id="${id}" title="下移"><svg class="ico ico-sm"><use href="#i-arrow-down"/></svg></button>
          <button class="cell-action-btn cell-duplicate-btn" data-cell-id="${id}" title="复制"><svg class="ico ico-sm"><use href="#i-copy"/></svg></button>
          <button class="cell-action-btn cell-delete-btn" data-cell-id="${id}" title="删除"><svg class="ico ico-sm"><use href="#i-x"/></svg></button>
        </div>
      </div>
      <div class="cell-editor-wrap">
        <div class="cell-cm-host" data-cell-id="${id}"></div>
      </div>
      <div class="cell-output markdown-body" data-cell-id="${id}"></div>
      <div class="cell-output-toolbar" data-cell-id="${id}">
        <button class="cell-output-toolbar-btn" data-out-action="copy-html">复制 HTML</button>
        <button class="cell-output-toolbar-btn" data-out-action="clear">清空输出</button>
        <button class="cell-output-toolbar-btn" data-out-action="collapse">折叠输出</button>
        <button class="cell-output-toolbar-btn" data-out-action="export">导出此 Cell</button>
      </div>
    `;

    // 创建 CodeMirror 6 编辑器实例（替代 textarea）
    const cmHost = cellDiv.querySelector('.cell-cm-host');
    const isDark = document.body.classList.contains('editor-dark-mode');
    const editor = new window.CodeMirrorEditor(cmHost, {
      value: initialContent || '',
      placeholder: cellType === 'plaintext' ? '输入纯文本（不渲染）...' : '输入 Markdown...',
      dark: isDark,
    });
    editor.dataset.cellId = String(id);

    const cellData = {
      id,
      div: cellDiv,
      editor,
      textarea: editor, // 兼容别名：大量现有代码通过 cell.textarea.value 访问
      output: cellDiv.querySelector('.cell-output'),
      outputToolbar: cellDiv.querySelector('.cell-output-toolbar'),
      statusDot: cellDiv.querySelector('.cell-status-dot'),
      linesLabel: cellDiv.querySelector('.cell-lines'),
      typeBadge: cellDiv.querySelector('.cell-type-badge'),
      collapseBtn: cellDiv.querySelector('.cell-collapse-btn'),
      type: cellType,
      lastRunContent: ''
    };
    cells.push(cellData);

    // 插入到 DOM：在全局 addBtn 之前插入
    if (afterCellId) {
      const afterCell = getCell(afterCellId);
      if (afterCell) {
        afterCell.div.after(cellDiv);
      } else {
        editorMain.insertBefore(cellDiv, globalAddBtn);
      }
    } else {
      editorMain.insertBefore(cellDiv, globalAddBtn);
    }

    // 恢复字号（CM6 实例需要单独设置）
    try {
      const savedSize = parseInt(localStorage.getItem('mdnb_fontsize'));
      if (savedSize) editor.setFontSize(savedSize);
    } catch (e) {}

    // 事件绑定
    bindCellEvents(cellData);

    activeCellId = id;
    renumberCells();
    updateStatusbar();
    editor.focus();

    return cellData;
  }

  function bindCellEvents(cellData) {
    const { id, textarea, div, outputToolbar, collapseBtn } = cellData;

    textarea.addEventListener('focus', () => {
      activeCellId = id;
      document.querySelectorAll('.cell.cell-active').forEach(c => c.classList.remove('cell-active'));
      div.classList.add('cell-active');
      updateStatusbar();
    });

    textarea.addEventListener('input', () => {
      onTextareaInput({ target: textarea });
      updateCellMeta(cellData);
      markModified(cellData);
      markUnsaved();
      updateStatusbar();
    });

    textarea.addEventListener('keydown', onTextareaKeydown);
    textarea.addEventListener('keyup', () => updateStatusbar());
    textarea.addEventListener('click', () => updateStatusbar());
    textarea.addEventListener('select', () => updateSelectionToolbar({ target: textarea }));
    textarea.addEventListener('mouseup', () => updateSelectionToolbar({ target: textarea }));
    textarea.addEventListener('blur', () => {
      setTimeout(hideSelectionToolbar, 150);
      setTimeout(hideAutocomplete, 150);
    });

    div.querySelector('.cell-run-btn').addEventListener('click', () => runCell(id));
    div.querySelector('.cell-delete-btn').addEventListener('click', () => deleteCell(id));
    div.querySelector('.cell-up-btn').addEventListener('click', () => moveCell(id, -1));
    div.querySelector('.cell-down-btn').addEventListener('click', () => moveCell(id, 1));
    div.querySelector('.cell-duplicate-btn').addEventListener('click', () => duplicateCell(id));
    collapseBtn.addEventListener('click', () => toggleCellCollapse(cellData));

    // 输出工具栏
    outputToolbar.querySelectorAll('.cell-output-toolbar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.outAction;
        if (action === 'copy-html') copyOutputHtml(cellData);
        else if (action === 'clear') clearOutput(cellData);
        else if (action === 'collapse') cellData.div.classList.toggle('cell-output-collapsed');
        else if (action === 'export') exportCellStandalone(cellData);
      });
    });

    // 右键菜单
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenuCellId = id;
      showContextMenu(e.clientX, e.clientY);
    });

    // 图片粘贴：检测剪贴板中的图片文件
    div.addEventListener('paste', (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const imageFiles = [];
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length === 0) return;
      e.preventDefault();
      imageFiles.forEach(file => insertImageToCell(cellData, file));
    });

    // 图片拖拽：dragover 阻止默认以允许 drop
    div.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        div.classList.add('drag-over');
      }
    });
    div.addEventListener('dragleave', (e) => {
      if (!div.contains(e.relatedTarget)) div.classList.remove('drag-over');
    });
    div.addEventListener('drop', (e) => {
      div.classList.remove('drag-over');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || files.length === 0) return;
      const imageFiles = Array.from(files).filter(f => f.type && f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      e.preventDefault();
      activeCellId = id;
      imageFiles.forEach(file => insertImageToCell(cellData, file));
    });
  }

  // ============== 行号 ==============
  // CM6 自带行号（lineNumbers 扩展），此处保留空函数以兼容旧调用

  function updateLineNumbers(cellData) {
    // CM6 原生管理行号，无需手动更新
  }

  // ============== Cell 输出操作 ==============

  function copyOutputHtml(cellData) {
    const html = cellData.output.innerHTML;
    if (!html.trim()) { showToast('请先运行此 Cell'); return; }
    navigator.clipboard.writeText(html).then(() => {
      showToast('已复制 HTML');
    }).catch(() => {
      // 兜底
      const ta = document.createElement('textarea');
      ta.value = html;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('已复制 HTML');
    });
  }

  function clearOutput(cellData) {
    cellData.output.innerHTML = '';
    cellData.output.classList.remove('visible');
    cellData.statusDot.classList.remove('run');
    updateStatusbar();
  }

  function exportCellStandalone(cellData) {
    const idx = cells.findIndex(c => c.id === cellData.id) + 1;
    const html = cellData.output.innerHTML;
    if (!html.trim()) { showToast('请先运行此 Cell'); return; }
    const fullHtml = buildStandaloneHtml(html, `Cell ${idx}`);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `cell-${idx}.html`);
  }

  // ============== Toast 提示 ==============

  let toastTimer = null;
  function showToast(msg) {
    let toast = document.getElementById('editorToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'editorToast';
      toast.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);padding:8px 16px;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px;font-size:13px;z-index:9999;opacity:0;transition:opacity 0.2s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 1500);
  }

  // ============== Cell 折叠 ==============

  function toggleCellCollapse(cellData) {
    cellData.div.classList.toggle('cell-collapsed');
    cellData.collapseBtn.innerHTML = cellData.div.classList.contains('cell-collapsed')
      ? '<svg class="ico ico-sm"><use href="#i-chevron-down"/></svg>'
      : '<svg class="ico ico-sm"><use href="#i-chevron-right"/></svg>';
  }

  function collapseAllCells() {
    cells.forEach(c => {
      c.div.classList.add('cell-collapsed');
      if (c.collapseBtn) c.collapseBtn.innerHTML = '<svg class="ico ico-sm"><use href="#i-chevron-down"/></svg>';
    });
  }

  function expandAllCells() {
    cells.forEach(c => {
      c.div.classList.remove('cell-collapsed');
      if (c.collapseBtn) c.collapseBtn.innerHTML = '<svg class="ico ico-sm"><use href="#i-chevron-right"/></svg>';
    });
  }

  // ============== Cell 类型切换 ==============

  function toggleCellType(cellData) {
    cellData.type = cellData.type === 'markdown' ? 'plaintext' : 'markdown';
    cellData.div.dataset.cellType = cellData.type;
    cellData.div.classList.remove('cell-type-markdown', 'cell-type-plaintext');
    cellData.div.classList.add('cell-type-' + cellData.type);
    if (cellData.typeBadge) cellData.typeBadge.textContent = cellData.type === 'plaintext' ? 'TXT' : 'MD';
    cellData.textarea.placeholder = cellData.type === 'plaintext' ? '输入纯文本（不渲染）...' : '输入 Markdown...';
    updateStatusbar();
  }

  // ============== Cell 拖拽 ==============

  function getCell(id) {
    return cells.find(c => c.id === id);
  }

  function getActiveCell() {
    return getCell(activeCellId);
  }

  function deleteCell(id) {
    if (cells.length <= 1) return;
    const idx = cells.findIndex(c => c.id === id);
    if (idx === -1) return;
    const cell = cells[idx];
    // 销毁 CM6 实例，避免内存泄漏（cell.textarea 是 CodeMirrorEditor 的兼容别名）
    if (cell.textarea && typeof cell.textarea.destroy === 'function') {
      cell.textarea.destroy();
    }
    cell.div.remove();
    cells.splice(idx, 1);
    if (activeCellId === id) {
      const newIdx = Math.min(idx, cells.length - 1);
      activeCellId = cells[newIdx].id;
      cells[newIdx].textarea.focus();
    }
    renumberCells();
    updateStatusbar();
  }

  function moveCell(id, direction) {
    const idx = cells.findIndex(c => c.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= cells.length) return;

    const cell = cells[idx];
    const other = cells[newIdx];

    // 交换 cells 数组顺序
    cells[idx] = other;
    cells[newIdx] = cell;

    // 重新排序 DOM：按 cells 数组顺序重建
    rebuildCellDOMOrder();

    renumberCells();
    cell.textarea.focus();
  }

  function rebuildCellDOMOrder() {
    // 增量移动 DOM 节点（而非 innerHTML='' 重建），保留 CM6 编辑器状态和 undo 栈
    cells.forEach(cell => {
      if (cell.div.parentNode !== editorMain || cell.div.nextSibling !== (cells[cells.indexOf(cell) + 1]?.div || globalAddBtn)) {
        editorMain.appendChild(cell.div);
      }
    });
    editorMain.appendChild(globalAddBtn);
  }

  function duplicateCell(id) {
    const cell = getCell(id);
    if (!cell) return;
    createCell(id, cell.textarea.value, { type: cell.type });
  }

  function renumberCells() {
    cells.forEach((c, i) => {
      c.div.querySelector('.cell-num').textContent = i + 1;
    });
  }

  function updateCellMeta(cellData) {
    const lines = cellData.textarea.value.split('\n').length;
    cellData.linesLabel.textContent = `${lines} 行`;
  }

  function markModified(cellData) {
    if (cellData.lastRunContent !== '' && cellData.textarea.value !== cellData.lastRunContent) {
      cellData.statusDot.classList.remove('run');
      cellData.statusDot.classList.add('modified');
    }
  }

  function markRun(cellData) {
    cellData.statusDot.classList.remove('modified');
    cellData.statusDot.classList.add('run');
    cellData.lastRunContent = cellData.textarea.value;
  }

  // ============== Markdown 渲染（共享渲染逻辑） ==============
  //
  // processGitHubAlerts / protectLaTeXBlocks / createMdRenderer / 画廊分组 / 轮播 / 代码高亮
  // 这些函数已在 iris/js/md-render.js 中统一实现，这里仅保留 cell 级编排。
  // editor.js 传入 SVG 版 Alert 图标，与文档站的 emoji 版本区分。

  function renderCellMarkdown(content, outputElement) {
    const { html } = mdRender.parseMarkdown(content, { alertTypes: EDITOR_ALERT_TYPES });
    outputElement.innerHTML = html;
    mdRender.groupGalleries(outputElement);
    mdRender.initSliders(outputElement);
    mdRender.highlightCodeBlocks(outputElement);

    setTimeout(() => {
      try {
        const renderers = window.MarkdownPreview?.renderers;
        // 渲染器现在按需懒加载 vendor 库（返回 Promise），统一 catch 避免未捕获 rejection
        const run = (fn) => {
          if (!fn) return;
          try {
            const p = fn();
            if (p && typeof p.catch === 'function') p.catch(e => console.warn('[Editor] renderer failed:', e));
          } catch (e) { console.warn('[Editor] renderer sync error:', e); }
        };
        if (renderers) {
          run(renderers.mermaid?.render);
          run(renderers.apexcharts?.render);
          run(renderers.diff?.render);
          run(renderers.katex?.render);
          run(renderers.plantuml?.render);
          // 传入 outputElement 让 embedded 渲染器在 cell 容器内处理 pkt/geo 等嵌入
          run(() => renderers.embedded?.render && renderers.embedded.render(outputElement));
        }
      } catch (e) { console.warn('[Editor] Plugin render error:', e); }
    }, 200);

    outputElement.classList.add('visible');
  }

  // ============== 运行 Cell ==============

  function runCell(id) {
    const cell = getCell(id);
    if (!cell) return;
    const content = cell.textarea.value;
    if (!content.trim()) return;

    cell.div.classList.add('cell-running');
    setTimeout(() => cell.div.classList.remove('cell-running'), 600);

    // 纯文本 Cell：直接显示文本不渲染
    if (cell.type === 'plaintext') {
      cell.output.innerHTML = '';
      const pre = document.createElement('pre');
      pre.textContent = content;
      cell.output.appendChild(pre);
      cell.output.classList.add('visible');
    } else {
      renderCellMarkdown(content, cell.output);
    }

    markRun(cell);
    activeCellId = id;
    // 显示输出工具栏
    if (cell.outputToolbar) cell.outputToolbar.classList.add('visible');
    // 滚动到输出
    setTimeout(() => {
      cell.output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    updateStatusbar();
  }

  function runAllCells() {
    cells.forEach(c => runCell(c.id));
  }

  function runCellAndBelow(id) {
    const idx = cells.findIndex(c => c.id === id);
    if (idx === -1) return;
    for (let i = idx; i < cells.length; i++) {
      runCell(cells[i].id);
    }
  }

  // ============== 工具栏快速插入 ==============

  function insertAtCursor(editor, text, cursorOffset) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.replaceRange(start, end, text);
    if (cursorOffset) {
      const newPos = start + text.length + cursorOffset;
      editor.setSelectionRange(newPos, newPos);
    }
    editor.focus();
    updateCellMeta(getCell(parseInt(editor.dataset.cellId)));
    updateStatusbar();
  }

  // ============== 下拉菜单管理 ==============

  function closeAllDropdowns() {
    document.querySelectorAll('.toolbar-dropdown').forEach(d => d.classList.remove('open'));
  }

  document.querySelectorAll('.toolbar-dropdown').forEach(dropdown => {
    const btn = dropdown.querySelector('.toolbar-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains('open');
      closeAllDropdowns();
      if (!wasOpen) dropdown.classList.add('open');
    });
  });

  document.addEventListener('click', closeAllDropdowns);

  // 快速插入按钮点击
  document.querySelectorAll('.dropdown-item[data-insert]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const cell = getActiveCell();
      if (!cell) return;
      const text = item.dataset.insert.replace(/\\n/g, '\n');
      const cursorOffset = item.dataset.cursor ? parseInt(item.dataset.cursor) : 0;
      insertAtCursor(cell.textarea, text, cursorOffset);
      closeAllDropdowns();
    });
  });

  // 下载 / 动态插入按钮点击
  document.querySelectorAll('.dropdown-item[data-action]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      if (action === 'download-md') downloadCurrentMd();
      else if (action === 'download-html') downloadCurrentHtml();
      else if (action === 'download-html-inline') downloadCurrentHtmlInline();
      else if (action === 'download-pdf') downloadCurrentPdf();
      else if (action === 'download-notebook') downloadNotebook();
      else if (action === 'download-all-md') downloadAllMd();
      else if (action === 'import-mdnb') triggerImport('import-mdnb');
      else if (action === 'import-md-cells') triggerImport('import-md-cells');
      else if (action === 'import-md-current') triggerImport('import-md-current');
      else if (action.startsWith('insert-')) handleDynamicInsert(action);
      closeAllDropdowns();
    });
  });

  // ============== 动态内容插入 ==============

  function pad2(n) { return String(n).padStart(2, '0'); }

  function handleDynamicInsert(action) {
    const cell = getActiveCell();
    if (!cell) return;
    const now = new Date();
    let text = '';

    if (action === 'insert-date') {
      text = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    } else if (action === 'insert-time') {
      text = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    } else if (action === 'insert-datetime') {
      text = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    } else if (action === 'insert-timestamp') {
      text = String(Math.floor(now.getTime() / 1000));
    } else if (action.startsWith('insert-placeholder')) {
      const sizes = {
        'insert-placeholder-300': '300/200',
        'insert-placeholder-600': '600/400',
        'insert-placeholder-1200': '1200/600',
        'insert-placeholder-square': '500/500',
      };
      const size = sizes[action] || '300/200';
      text = `![占位图](https://placehold.co/${size})`;
    }

    if (text) insertAtCursor(cell.textarea, text, 0);
  }

  // ============== 选中文字浮动工具栏 ==============

  function updateSelectionToolbar(e) {
    const editor = e.target;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;

    if (start === end) {
      hideSelectionToolbar();
      return;
    }

    // 使用 CM6 的坐标 API 获取选区位置
    const view = editor.view;
    const sel = view.state.selection.main;
    const coords = view.coordsAtPos(sel.head);
    if (!coords) return;

    selectionToolbar.style.top = (coords.top - 44) + 'px';
    selectionToolbar.style.left = (coords.left) + 'px';
    selectionToolbar.classList.add('visible');
  }

  function hideSelectionToolbar() {
    selectionToolbar.classList.remove('visible');
  }

  // 浮动工具栏按钮点击
  selectionToolbar.querySelectorAll('.sel-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // 防止 textarea 失焦
      const format = btn.dataset.format;
      const cell = getActiveCell();
      if (!cell) return;
      applyFormat(cell.textarea, format);
      hideSelectionToolbar();
    });
  });

  function applyFormat(editor, format) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end);

    if (!selected && format !== 'h1' && format !== 'h2' && format !== 'h3' && format !== 'ul' && format !== 'quote') {
      return;
    }

    switch (format) {
      case 'bold':
        editor.wrapSelection('**');
        break;
      case 'italic':
        editor.wrapSelection('*');
        break;
      case 'strike':
        editor.wrapSelection('~~');
        break;
      case 'code':
        editor.wrapSelection('`');
        break;
      case 'link': {
        const url = prompt('输入链接 URL:', 'https://');
        if (!url) return;
        const text = selected || '链接文字';
        editor.replaceRange(start, end, `[${text}](${url})`);
        break;
      }
      case 'h1':
        editor.insertAtLineStart('# ');
        break;
      case 'h2':
        editor.insertAtLineStart('## ');
        break;
      case 'h3':
        editor.insertAtLineStart('### ');
        break;
      case 'quote':
        editor.insertAtLineStart('> ');
        break;
      case 'ul':
        editor.insertAtLineStart('- ');
        break;
    }

    editor.focus();
    updateCellMeta(getCell(parseInt(editor.dataset.cellId)));
    markModified(getCell(parseInt(editor.dataset.cellId)));
    updateStatusbar();
  }

  // ============== Cell 右键上下文菜单 ==============

  function showContextMenu(x, y) {
    // 先显示以获取尺寸
    contextMenu.style.left = '0px';
    contextMenu.style.top = '0px';
    contextMenu.classList.add('visible');
    const rect = contextMenu.getBoundingClientRect();
    const menuW = rect.width;
    const menuH = rect.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // 水平定位：优先在点击点右侧，超出则左侧，再不行贴边
    let left = x;
    if (left + menuW > vw - margin) left = x - menuW;
    if (left < margin) left = Math.min(x, vw - menuW - margin);
    left = Math.max(margin, left);

    // 垂直定位：优先在点击点下方，超出则上方，再不行贴边
    let top = y;
    if (top + menuH > vh - margin) top = y - menuH;
    if (top < margin) top = Math.min(y, vh - menuH - margin);
    top = Math.max(margin, top);

    contextMenu.style.left = left + 'px';
    contextMenu.style.top = top + 'px';

    // 禁用/启用菜单项
    const idx = cells.findIndex(c => c.id === contextMenuCellId);
    const moveUpItem = contextMenu.querySelector('[data-action="ctx-move-up"]');
    const moveDownItem = contextMenu.querySelector('[data-action="ctx-move-down"]');
    if (moveUpItem) moveUpItem.classList.toggle('context-menu-item-disabled', idx <= 0);
    if (moveDownItem) moveDownItem.classList.toggle('context-menu-item-disabled', idx >= cells.length - 1);
  }

  function hideContextMenu() {
    contextMenu.classList.remove('visible');
  }

  contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (item.classList.contains('context-menu-item-disabled')) return;
      const action = item.dataset.action;
      const id = contextMenuCellId;
      if (!id) return;

      switch (action) {
        case 'ctx-run': runCell(id); break;
        case 'ctx-run-below': runCellAndBelow(id); break;
        case 'ctx-insert-above': {
          const idx = cells.findIndex(c => c.id === id);
          const newCell = createCell(idx > 0 ? cells[idx - 1].id : null);
          // 如果是第一个，createCell 把新 cell 加到了末尾，需要移动到最前面
          if (idx === 0) {
            editorMain.insertBefore(newCell.div, cells[1].div);
          }
          renumberCells();
          break;
        }
        case 'ctx-insert-below': createCell(id); break;
        case 'ctx-move-up': moveCell(id, -1); break;
        case 'ctx-move-down': moveCell(id, 1); break;
        case 'ctx-duplicate': duplicateCell(id); break;
        case 'ctx-toggle-type': {
          const cell = getCell(id);
          if (cell) toggleCellType(cell);
          break;
        }
        case 'ctx-collapse-editor': {
          const cell = getCell(id);
          if (cell) cell.div.classList.toggle('cell-editor-collapsed');
          break;
        }
        case 'ctx-collapse-output': {
          const cell = getCell(id);
          if (cell) cell.div.classList.toggle('cell-output-collapsed');
          break;
        }
        case 'ctx-copy-html': {
          const cell = getCell(id);
          if (cell) copyOutputHtml(cell);
          break;
        }
        case 'ctx-export-cell': {
          const cell = getCell(id);
          if (cell) exportCellStandalone(cell);
          break;
        }
        case 'ctx-collapse-all': collapseAllCells(); break;
        case 'ctx-expand-all': expandAllCells(); break;
        case 'ctx-clear-output': {
          const cell = getCell(id);
          if (cell) clearOutput(cell);
          break;
        }
        case 'ctx-clear-content': {
          const cell = getCell(id);
          if (cell) {
            cell.textarea.setValue('');
            cell.output.innerHTML = '';
            cell.output.classList.remove('visible');
            cell.statusDot.classList.remove('run', 'modified');
            updateCellMeta(cell);
            cell.textarea.focus();
          }
          break;
        }
        case 'ctx-delete': deleteCell(id); break;
      }
      hideContextMenu();
    });
  });

  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) hideContextMenu();
  });
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('.cell')) hideContextMenu();
  });

  // ============== 自动补全 ==============

  let acIndex = -1;
  let acVisible = false;
  let acTextarea = null;
  let acLineStart = 0;
  let acReplaceLength = 0;

  function showAutocomplete(textarea, filter, trigger, lineStart, replaceLength) {
    // 1. 按 trigger 类别筛选
    let candidates = autocompleteItems.filter(it => it.trigger === trigger);
    // 2. 按 filter 字符串筛选（label 包含 filter，忽略大小写）
    if (filter) {
      const f = filter.toLowerCase();
      candidates = candidates.filter(it => it.label.toLowerCase().includes(f));
    }
    if (candidates.length === 0) { hideAutocomplete(); return; }

    // 记录上下文供键盘导航使用
    acTextarea = textarea;
    acLineStart = lineStart;
    acReplaceLength = replaceLength;

    autocompleteList.innerHTML = '';
    candidates.forEach((it, i) => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item' + (i === 0 ? ' active' : '');
      div.innerHTML = `<span class="autocomplete-item-label">${it.label}</span><span class="autocomplete-item-desc">${it.desc}</span>`;
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        applyAutocomplete(textarea, it, lineStart, replaceLength);
      });
      autocompleteList.appendChild(div);
    });

    // 使用 CM6 坐标 API 定位补全列表
    const view = textarea.view;
    const pos = view.state.selection.main.head;
    const coords = view.coordsAtPos(pos);
    if (coords) {
      autocompleteList.style.top = (coords.bottom + 4) + 'px';
      autocompleteList.style.left = (coords.left) + 'px';
    }
    autocompleteList.classList.add('visible');
    acIndex = 0;
    acVisible = true;
  }

  function hideAutocomplete() {
    autocompleteList.classList.remove('visible');
    acVisible = false;
    acIndex = -1;
    acTextarea = null;
  }

  function applyAutocomplete(editor, item, lineStart, replaceLength) {
    editor.replaceAtLineStart(replaceLength, item.insert);
    hideAutocomplete();
    editor.focus();
    updateCellMeta(getCell(parseInt(editor.dataset.cellId)));
    updateStatusbar();
  }

  function onTextareaInput(e) {
    const editor = e.target;
    const lineBeforeCursor = editor.getLineBeforeCursor();
    const lineStart = editor.getLineStart();

    // ``` 代码块语言触发（先检查多字符前缀）
    if (lineBeforeCursor.match(/^```[\w-]*$/)) {
      const filter = lineBeforeCursor.substring(3);
      showAutocomplete(textarea, filter, '```', lineStart, 3);
    }
    // > [! GitHub Alert 触发（比 > 更具体，先检查）
    else if (lineBeforeCursor.match(/^> \[!?[\w]*$/)) {
      const m = lineBeforeCursor.match(/^> \[!?([\w]*)$/);
      const filter = m ? m[1] : '';
      showAutocomplete(textarea, filter, '> [!', lineStart, lineBeforeCursor.length);
    }
    // > 普通引用触发（仅 > 或 > 后跟空格，且不是 > [）
    else if (lineBeforeCursor.match(/^>\s?$/) && !lineBeforeCursor.includes('[')) {
      showAutocomplete(textarea, '', '>', lineStart, lineBeforeCursor.length);
    }
    // --- 水平线 / Frontmatter 触发（3 个以上 -）
    else if (lineBeforeCursor.match(/^-{3,}$/)) {
      showAutocomplete(textarea, '', '---', lineStart, lineBeforeCursor.length);
    }
    // - 列表触发（单个 - 或 - 后跟空格）
    else if (lineBeforeCursor.match(/^-\s?$/)) {
      showAutocomplete(textarea, '', '-', lineStart, lineBeforeCursor.length);
    }
    // # 标题触发（1-6 个 #）
    else if (lineBeforeCursor.match(/^#{1,6}$/)) {
      showAutocomplete(textarea, lineBeforeCursor, '#', lineStart, lineBeforeCursor.length);
    }
    // | 表格触发（单个 |）
    else if (lineBeforeCursor.match(/^\|$/)) {
      showAutocomplete(textarea, '', '|', lineStart, 1);
    }
    // $$ KaTeX 公式块触发
    else if (lineBeforeCursor.match(/^\$\$$/)) {
      showAutocomplete(textarea, '', '$$', lineStart, 2);
    }
    // ![ 图片触发
    else if (lineBeforeCursor.match(/^!\[?$/)) {
      showAutocomplete(textarea, '', '![', lineStart, lineBeforeCursor.length);
    }
    // [ 链接触发（单个 [）
    else if (lineBeforeCursor.match(/^\[$/)) {
      showAutocomplete(textarea, '', '[', lineStart, 1);
    }
    // @ 画廊样式触发
    else if (lineBeforeCursor.match(/^@\w*$/)) {
      const filter = lineBeforeCursor.substring(1);
      showAutocomplete(textarea, filter, '@', lineStart, 1);
    }
    else {
      hideAutocomplete();
    }
  }

  // ============== 键盘快捷键 ==============

  function onTextareaKeydown(e) {
    const editor = e.target;

    // 自动补全导航
    if (acVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        items[acIndex]?.classList.remove('active');
        acIndex = (acIndex + 1) % items.length;
        items[acIndex]?.classList.add('active');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        items[acIndex]?.classList.remove('active');
        acIndex = (acIndex - 1 + items.length) % items.length;
        items[acIndex]?.classList.add('active');
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const items = autocompleteList.querySelectorAll('.autocomplete-item');
        if (items[acIndex]) {
          const label = items[acIndex].querySelector('.autocomplete-item-label').textContent;
          const item = autocompleteItems.find(it => it.label === label);
          if (item) applyAutocomplete(editor, item, acLineStart, acReplaceLength);
        }
        return;
      }
      if (e.key === 'Escape') {
        hideAutocomplete();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
        hideAutocomplete();
      }
    }

    // Ctrl/Cmd + Enter: 运行当前 cell
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const cellId = parseInt(editor.dataset.cellId);
      runCell(cellId);
      return;
    }

    // Ctrl/Cmd + Shift + Enter: 运行全部
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      runAllCells();
      return;
    }

    // Ctrl/Cmd + Shift + N: 下方新建 Cell
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      const cellId = parseInt(editor.dataset.cellId);
      createCell(cellId);
      return;
    }

    // Ctrl/Cmd + F: 全局搜索（仅在编辑器内）
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      openSearchPanel();
      return;
    }

    // Ctrl/Cmd + H: 替换
    if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      openSearchPanel();
      setTimeout(() => replaceInput.focus(), 50);
      return;
    }

    // 格式快捷键
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        applyFormat(editor, 'bold');
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        applyFormat(editor, 'italic');
        return;
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        applyFormat(editor, 'link');
        return;
      }
      if (e.key === '`') {
        e.preventDefault();
        applyFormat(editor, 'code');
        return;
      }
    }

    // Tab 缩进由 CM6 原生 indentWithTab 处理，无需手写
  }

  // ============== 状态栏 ==============

  function countWords(text) {
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
    const englishWords = text.match(/[a-zA-Z]+/g) || [];
    return chineseChars.length + englishWords.length;
  }

  function updateStatusbar() {
    // Cell 数量
    statusCellCount.textContent = `${cells.length} Cell`;
    cellCountBadge.textContent = `${cells.length} Cell`;

    // 活跃 Cell
    if (activeCellId) {
      const idx = cells.findIndex(c => c.id === activeCellId);
      statusActive.textContent = `活跃: Cell ${idx + 1}`;
    } else {
      statusActive.textContent = '无活跃 Cell';
    }

    // 运行统计：已运行 / 总数
    const runCount = cells.filter(c => c.output.classList.contains('visible')).length;
    if (statusRunStats) statusRunStats.textContent = `运行 ${runCount}/${cells.length}`;

    // 字数与行数（全部 Cell 汇总）
    let totalWords = 0;
    let totalLines = 0;
    cells.forEach(c => {
      const val = c.textarea.value;
      totalLines += val.split('\n').length;
      totalWords += countWords(val);
    });
    statusWords.textContent = `${totalWords} 字`;
    statusLines.textContent = `${totalLines} 行`;

    // 当前 Cell 字数
    const activeCell = getActiveCell();
    if (activeCell && statusCurCellWords) {
      statusCurCellWords.textContent = `当前 ${countWords(activeCell.textarea.value)} 字`;
    } else if (statusCurCellWords) {
      statusCurCellWords.textContent = '当前 0 字';
    }

    // 光标位置（使用 CM6 原生行列 API）
    const cell = getActiveCell();
    if (cell) {
      const cursor = cell.editor.getCursorPos();
      statusCursor.textContent = `行 ${cursor.line}, 列 ${cursor.col}`;
    }
  }

  // ============== 下载功能 ==============

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadCurrentMd() {
    const cell = getActiveCell();
    if (!cell) return;
    const content = cell.textarea.value;
    if (!content.trim()) { showToast('当前 Cell 为空'); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `cell-${idx}.md`);
  }

  function downloadCurrentHtml() {
    const cell = getActiveCell();
    if (!cell) return;
    const html = cell.output.innerHTML;
    if (!html.trim()) { showToast('请先运行当前 Cell'); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    const fullHtml = buildStandaloneHtml(html, `Cell ${idx}`, false);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `cell-${idx}.html`);
  }

  function downloadCurrentHtmlInline() {
    const cell = getActiveCell();
    if (!cell) return;
    const html = cell.output.innerHTML;
    if (!html.trim()) { showToast('请先运行当前 Cell'); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    const fullHtml = buildStandaloneHtml(html, `Cell ${idx}`, true);
    downloadBlob(new Blob([fullHtml], { type: 'text/html;charset=utf-8' }), `cell-${idx}-offline.html`);
  }

  // 构建独立 HTML（离线可用时内联 CSS）
  function buildStandaloneHtml(bodyHtml, title, inlineCss) {
    const styleHrefs = [
      'iris/styles.css',
      'iris/css/galleries.css',
      'iris/vendor/highlight.js/styles/github.css',
      'iris/vendor/katex/katex.min.css'
    ];
    let headExtra = '';
    if (inlineCss) {
      // 尝试内联当前页面已加载的样式表
      const collected = [];
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.getAttribute('href');
        if (!href) return;
        // 仅内联 iris/ 开头的本地样式（避免抓取跨域 CDN）
        if (!href.startsWith('iris/') && !href.startsWith('/iris/')) return;
        const cssText = tryReadLoadedStylesheet(link);
        if (cssText) collected.push(cssText);
      });
      // 编辑器暗色模式
      if (document.body.classList.contains('editor-dark-mode')) {
        collected.push('body{background:#1e1e2e;color:#e0e0e8;}');
      }
      headExtra = `<style>\n${collected.join('\n')}\n</style>`;
    } else {
      headExtra = styleHrefs.map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
    }
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title>${headExtra}</head><body><article class="markdown-body" style="max-width:800px;margin:40px auto;padding:0 20px;">${bodyHtml}</article></body></html>`;
  }

  function tryReadLoadedStylesheet(linkEl) {
    // 尝试从已加载的 StyleSheet.cssRules 提取文本
    try {
      const sheets = Array.from(document.styleSheets);
      const href = linkEl.href;
      const sheet = sheets.find(s => s.href === href);
      if (!sheet) return '';
      let css = '';
      for (const rule of sheet.cssRules) css += rule.cssText + '\n';
      return css;
    } catch (e) {
      // 跨域样式表会抛错，这里直接返回空
      return '';
    }
  }

  function downloadCurrentPdf() {
    const cell = getActiveCell();
    if (!cell) return;
    const html = cell.output.innerHTML;
    if (!html.trim()) { showToast('请先运行当前 Cell'); return; }
    const idx = cells.findIndex(c => c.id === activeCellId) + 1;
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cell ${idx}</title><link rel="stylesheet" href="iris/styles.css"><link rel="stylesheet" href="iris/css/galleries.css"><link rel="stylesheet" href="iris/vendor/highlight.js/styles/github.css"><link rel="stylesheet" href="iris/vendor/katex/katex.min.css"><style>@media print{body{margin:0;}}</style></head><body><article class="markdown-body" style="max-width:800px;margin:20px auto;padding:0 20px;">${html}</article></body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  }

  function downloadNotebook() {
    const data = {
      version: 2,
      type: 'mdnb',
      created: new Date().toISOString(),
      cells: cells.map(c => ({
        id: c.id,
        type: c.type || 'markdown',
        content: c.textarea.value,
        output_html: c.output.classList.contains('visible') ? c.output.innerHTML : ''
      }))
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), 'notebook.mdnb');
  }

  function downloadAllMd() {
    const content = cells.map(c => {
      const typeTag = c.type === 'plaintext' ? '<!-- cell: plaintext -->\n' : '';
      return typeTag + c.textarea.value;
    }).join('\n\n---\n\n');
    downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), 'all-cells.md');
  }

  // ============== 导入功能 ==============

  function triggerImport(mode) {
    if (!fileInput) return;
    fileInput.dataset.mode = mode;
    fileInput.value = '';
    fileInput.click();
  }

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const mode = fileInput.dataset.mode || 'import-md-current';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target.result || '');
      if (mode === 'import-mdnb') importMdnb(text);
      else if (mode === 'import-md-cells') importMdCells(text);
      else if (mode === 'import-md-current') importMdCurrent(text);
      markUnsaved();
    };
    reader.readAsText(file);
  });

  function importMdnb(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { showToast('无效的 .mdnb 文件'); return; }
    if (!data || !Array.isArray(data.cells)) { showToast('文件格式不正确'); return; }
    // 确认清空现有
    if (cells.length > 0 && cells.some(c => c.textarea.value.trim())) {
      if (!confirm('导入将替换当前所有 Cell，是否继续？')) return;
    }
    // 清空现有 Cell
    cells.slice().forEach(c => { c.div.remove(); });
    cells.length = 0;
    cellCounter = 0;
    // 创建新 Cell
    data.cells.forEach(s => {
      const newCell = createCell(null, s.content || '', { type: s.type === 'plaintext' ? 'plaintext' : 'markdown' });
      if (s.output_html) {
        newCell.output.innerHTML = s.output_html;
        newCell.output.classList.add('visible');
        if (newCell.outputToolbar) newCell.outputToolbar.classList.add('visible');
        markRun(newCell);
      }
      updateLineNumbers(newCell);
    });
    if (cells.length === 0) createCell();
    renumberCells();
    updateStatusbar();
    showToast('已导入 ' + data.cells.length + ' 个 Cell');
  }

  function importMdCells(text) {
    // 按 --- 分隔符切分为多个 Cell
    const parts = text.split(/\n\s*---\s*\n/);
    if (cells.some(c => c.textarea.value.trim())) {
      if (!confirm('导入将替换当前所有 Cell，是否继续？')) return;
    }
    cells.slice().forEach(c => { c.div.remove(); });
    cells.length = 0;
    cellCounter = 0;
    parts.forEach(part => {
      const trimmed = part.trim();
      if (!trimmed) return;
      // 检测纯文本标记
      const isPlaintext = trimmed.startsWith('<!-- cell: plaintext -->');
      const content = isPlaintext ? trimmed.replace(/^<!-- cell: plaintext -->\n?/, '') : trimmed;
      const newCell = createCell(null, content, { type: isPlaintext ? 'plaintext' : 'markdown' });
      updateLineNumbers(newCell);
    });
    if (cells.length === 0) createCell();
    renumberCells();
    updateStatusbar();
    showToast('已导入 ' + cells.length + ' 个 Cell');
  }

  function importMdCurrent(text) {
    const cell = getActiveCell();
    if (!cell) { showToast('没有活跃 Cell'); return; }
    cell.textarea.setValue(text);
    updateCellMeta(cell);
    markModified(cell);
    markUnsaved();
    updateStatusbar();
    showToast('已导入到当前 Cell');
  }

  // ============== 清空所有 Cell ==============

  clearAllBtn?.addEventListener('click', () => {
    if (!confirm('确定清空所有 Cell 内容吗？此操作不可撤销。')) return;
    cells.forEach(c => {
      c.textarea.setValue('');
      c.output.innerHTML = '';
      c.output.classList.remove('visible');
      if (c.outputToolbar) c.outputToolbar.classList.remove('visible');
      c.statusDot.classList.remove('run', 'modified');
      c.lastRunContent = '';
      updateCellMeta(c);
    });
    updateStatusbar();
    markUnsaved();
    cells[0]?.textarea.focus();
  });

  // ============== 事件绑定 ==============

  runCurrentBtn.addEventListener('click', () => {
    if (activeCellId) runCell(activeCellId);
  });

  runAllBtn.addEventListener('click', runAllCells);

  // 全局键盘快捷键
  document.addEventListener('keydown', (e) => {
    // 焦点在 CM6 编辑器内时跳过（由 cell 级 keydown 处理，避免重复运行）
    const inCellEditor = e.target.classList && (e.target.classList.contains('cm-content') || e.target.closest && e.target.closest('.cell-cm-host'));
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.shiftKey && !inCellEditor) {
      e.preventDefault();
      if (activeCellId) runCell(activeCellId);
    }
    // 全局 F3 / Shift+F3 搜索导航
    if (e.key === 'F3' && searchPanel && searchPanel.classList.contains('visible')) {
      e.preventDefault();
      if (e.shiftKey) searchNavigate(-1);
      else searchNavigate(1);
    }
    if (e.key === 'Escape') {
      hideContextMenu();
      hideAutocomplete();
      hideSelectionToolbar();
      if (searchPanel && searchPanel.classList.contains('visible')) closeSearchPanel();
    }
  });

  // 滚动时隐藏浮动工具栏（位置会错位）
  window.addEventListener('scroll', hideSelectionToolbar, true);

  // ============== 图片上传 ==============

  const IMAGE_UPLOAD_KEY = 'mdnb_image_upload';

  function getImageUploadConfig() {
    try {
      const raw = localStorage.getItem(IMAGE_UPLOAD_KEY);
      if (!raw) return { mode: 'base64', url: '', headers: '' };
      const cfg = JSON.parse(raw);
      return {
        mode: cfg.mode === 'host' ? 'host' : 'base64',
        url: cfg.url || '',
        headers: cfg.headers || '',
      };
    } catch (e) {
      return { mode: 'base64', url: '', headers: '' };
    }
  }

  function setImageUploadConfig(cfg) {
    try {
      localStorage.setItem(IMAGE_UPLOAD_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageToHost(file, config) {
    const formData = new FormData();
    formData.append('file', file, file.name || 'image.png');
    const headers = {};
    if (config.headers) {
      try {
        Object.assign(headers, JSON.parse(config.headers));
      } catch (e) {
        throw new Error('自定义请求头 JSON 格式错误');
      }
    }
    const resp = await fetch(config.url, {
      method: 'POST',
      body: formData,
      headers,
    });
    if (!resp.ok) throw new Error('图床返回错误：HTTP ' + resp.status);
    const text = await resp.text();
    // 尝试解析 JSON，支持 { url } / { data: { url } } / { link } 等常见格式
    let data;
    try { data = JSON.parse(text); } catch (e) {
      // 非 JSON 响应，若看起来像 URL 直接使用
      const trimmed = text.trim();
      if (/^https?:\/\//.test(trimmed)) return trimmed;
      throw new Error('图床响应无法解析：' + text.slice(0, 100));
    }
    const url = data.url || data.link || (data.data && (data.data.url || data.data.link)) || data.image;
    if (!url || typeof url !== 'string') throw new Error('图床响应缺少 url 字段');
    return url;
  }

  // 正在处理的图片标记，避免重复插入
  const _imageProcessing = new WeakSet();

  async function insertImageToCell(cellData, file) {
    if (!cellData || !file) return;
    if (_imageProcessing.has(cellData)) return;
    const config = getImageUploadConfig();
    const fileName = (file.name || 'image').replace(/[`\[\]()]/g, '').replace(/\.[^.]+$/, '') || 'image';
    activeCellId = cellData.id;
    cellData.textarea.focus();

    if (config.mode === 'host' && config.url) {
      showToast('正在上传图片到图床…');
      _imageProcessing.add(cellData);
      try {
        const url = await uploadImageToHost(file, config);
        const md = `![${fileName}](${url})`;
        insertAtCursor(cellData.textarea, md, 0);
        showToast('图片上传成功');
        markUnsaved();
      } catch (e) {
        // 上传失败时回退到 base64
        showToast('图床上传失败：' + e.message + '，回退到 base64');
        try {
          const dataUrl = await fileToBase64(file);
          const md = `![${fileName}](${dataUrl})`;
          insertAtCursor(cellData.textarea, md, 0);
          markUnsaved();
        } catch (e2) {
          showToast('图片插入失败：' + e2.message);
        }
      } finally {
        _imageProcessing.delete(cellData);
      }
    } else {
      // base64 模式
      _imageProcessing.add(cellData);
      try {
        const dataUrl = await fileToBase64(file);
        const md = `![${fileName}](${dataUrl})`;
        insertAtCursor(cellData.textarea, md, 0);
        showToast('图片已插入（base64）');
        markUnsaved();
      } catch (e) {
        showToast('图片插入失败：' + e.message);
      } finally {
        _imageProcessing.delete(cellData);
      }
    }
  }

  // ============== 图片上传设置弹出层 ==============

  if (imageUploadBtn && imageUploadPopover) {
    imageUploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = imageUploadBtn.getBoundingClientRect();
      imageUploadPopover.style.top = (rect.bottom + 4) + 'px';
      imageUploadPopover.style.right = (window.innerWidth - rect.right) + 'px';
      imageUploadPopover.style.left = 'auto';
      // 加载当前配置到 UI
      const cfg = getImageUploadConfig();
      const radioBase = imageUploadPopover.querySelector('input[value="base64"]');
      const radioHost = imageUploadPopover.querySelector('input[value="host"]');
      const urlInput = document.getElementById('imageUploadUrl');
      const headersInput = document.getElementById('imageUploadHeaders');
      const hostConfig = document.getElementById('imageHostConfig');
      if (cfg.mode === 'host') {
        radioHost.checked = true;
        hostConfig.style.display = '';
      } else {
        radioBase.checked = true;
        hostConfig.style.display = 'none';
      }
      if (urlInput) urlInput.value = cfg.url;
      if (headersInput) headersInput.value = cfg.headers;
      imageUploadPopover.classList.toggle('visible');
    });

    // 模式切换
    imageUploadPopover.querySelectorAll('input[name="imgMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const hostConfig = document.getElementById('imageHostConfig');
        hostConfig.style.display = radio.value === 'host' ? '' : 'none';
      });
    });

    // 保存
    document.getElementById('imageUploadSave')?.addEventListener('click', () => {
      const mode = imageUploadPopover.querySelector('input[name="imgMode"]:checked').value;
      const url = document.getElementById('imageUploadUrl').value.trim();
      const headers = document.getElementById('imageUploadHeaders').value.trim();
      if (mode === 'host' && !url) {
        showToast('请填写图床上传端点 URL');
        return;
      }
      if (headers) {
        try { JSON.parse(headers); } catch (e) {
          showToast('自定义请求头不是有效的 JSON');
          return;
        }
      }
      setImageUploadConfig({ mode, url, headers });
      showToast(mode === 'host' ? '图床配置已保存' : '已切换为 base64 模式');
      imageUploadPopover.classList.remove('visible');
    });

    // 清除
    document.getElementById('imageUploadClear')?.addEventListener('click', () => {
      setImageUploadConfig({ mode: 'base64', url: '', headers: '' });
      const radioBase = imageUploadPopover.querySelector('input[value="base64"]');
      if (radioBase) radioBase.checked = true;
      document.getElementById('imageHostConfig').style.display = 'none';
      const urlInput = document.getElementById('imageUploadUrl');
      const headersInput = document.getElementById('imageUploadHeaders');
      if (urlInput) urlInput.value = '';
      if (headersInput) headersInput.value = '';
      showToast('图片上传配置已清除');
    });

    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (!imageUploadPopover.contains(e.target) && e.target !== imageUploadBtn) {
        imageUploadPopover.classList.remove('visible');
      }
    });
  }

  // ============== 自动保存（IndexedDB，localStorage 兜底） ==============

  const STORAGE_KEY = 'mdnb_autosave_v2'; // 兼容旧 localStorage key，仅用于迁移
  let NOTEBOOK_ID = 'autosave';           // 当前激活笔记本 ID（IndexedDB key）
  const storage = window.MarkdownPreview.storage;
  let saveTimer = null;
  let isUnsaved = false;
  let useIndexedDB = storage && storage.isAvailable();

  // ============== 多标签页 ==============
  //
  // 每个 tab 对应一个独立笔记本：
  //   { id, title, unsaved, savedAt }
  // tabs 数组保序；activeTabId 指向当前激活的笔记本
  // 切换时：序列化当前 → 恢复目标；新建时：先保存当前再开新空白；
  // 关闭时：从列表与 IndexedDB 中移除，无 tab 则自动建一个空白

  const tabBar = document.getElementById('tabBar');
  const tabList = document.getElementById('tabList');
  const tabNewBtn = document.getElementById('tabNewBtn');

  let tabs = [];            // [{ id, title, unsaved }]
  let activeTabId = null;
  let tabCounter = 0;
  let isSwitching = false;  // 切换中禁止 autosave 重入

  function genTabId() {
    tabCounter++;
    return 'nb-' + Date.now().toString(36) + '-' + tabCounter;
  }

  function defaultTabTitle(index) {
    return '笔记本 ' + index;
  }

  function deriveTitleFromCells() {
    // 取第一个非空 Cell 的第一行作为标题
    for (const c of cells) {
      const v = (c.textarea.value || '').trim();
      if (v) {
        const firstLine = v.split(/\r?\n/)[0].replace(/^#+\s*/, '').trim();
        if (firstLine) return firstLine.slice(0, 30);
      }
    }
    return null;
  }

  function getTabById(id) {
    return tabs.find(t => t.id === id);
  }

  function renderTabs() {
    if (!tabList) return;
    tabList.innerHTML = '';
    tabs.forEach((t, idx) => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (t.id === activeTabId ? ' active' : '') + (t.unsaved ? ' unsaved' : '');
      item.dataset.tabId = t.id;
      item.title = t.title + (t.unsaved ? ' (未保存)' : '');
      const titleEl = document.createElement('span');
      titleEl.className = 'tab-title';
      titleEl.textContent = t.title || defaultTabTitle(idx + 1);
      const dot = document.createElement('span');
      dot.className = 'tab-unsaved-dot';
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.title = '关闭';
      close.innerHTML = '<svg><use href="#i-x"/></svg>';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(t.id);
      });
      item.addEventListener('click', () => switchTab(t.id));
      item.appendChild(titleEl);
      item.appendChild(dot);
      item.appendChild(close);
      tabList.appendChild(item);
    });
    // 滚动到激活 tab
    const active = tabList.querySelector('.tab-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function updateActiveTabState() {
    const t = getTabById(activeTabId);
    if (!t) return;
    const derived = deriveTitleFromCells();
    if (derived) t.title = derived;
    t.unsaved = isUnsaved;
    renderTabs();
  }

  function persistTabMeta() {
    if (!useIndexedDB || !storage) return;
    try {
      storage.setMeta('tabOrder', tabs.map(t => ({ id: t.id, title: t.title })));
      storage.setMeta('activeTab', activeTabId);
    } catch (e) { /* 忽略元信息写入失败 */ }
  }

  async function createTab(opts) {
    opts = opts || {};
    // 先保存当前 tab 数据
    if (!opts.skipSaveCurrent && activeTabId && tabs.length > 0) {
      try { await saveCurrentTabToStorage(); } catch (e) {}
    }
    const id = opts.id || genTabId();
    const idx = tabs.length + 1;
    const tab = { id, title: opts.title || defaultTabTitle(idx), unsaved: false };
    tabs.push(tab);
    if (!opts.skipSwitch) {
      await activateTab(tab.id, { initData: opts.initData || null });
    }
    persistTabMeta();
    return tab;
  }

  async function saveCurrentTabToStorage() {
    if (!useIndexedDB) return;
    const data = serializeNotebook();
    try { await storage.saveNotebook(data); } catch (e) {}
  }

  async function activateTab(id, opts) {
    opts = opts || {};
    const tab = getTabById(id);
    if (!tab) return;
    if (isSwitching) return;
    isSwitching = true;
    try {
      // 1) 保存当前 notebook 数据（先序列化，不动 DOM）
      if (activeTabId && activeTabId !== id) {
        try { await saveCurrentTabToStorage(); } catch (e) {}
      }
      // 2) 切换 NOTEBOOK_ID
      NOTEBOOK_ID = id;
      activeTabId = id;
      // 3) 加载目标 notebook
      let restored = false;
      if (opts.initData) {
        restored = restoreFromData(opts.initData);
      } else if (useIndexedDB) {
        try {
          const data = await storage.loadNotebook(id);
          if (data) restored = restoreFromData(data);
        } catch (e) { console.warn('[tabs] 加载笔记本失败:', e); }
      }
      if (!restored) {
        // 空白笔记本
        restoreFromData({ cells: [] });
      }
      // 4) 更新 UI 状态
      isUnsaved = false;
      markSaved();
      renderTabs();
      persistTabMeta();
    } finally {
      isSwitching = false;
    }
  }

  async function switchTab(id) {
    if (id === activeTabId) return;
    await activateTab(id);
  }

  async function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tab = tabs[idx];
    // 未保存则提示
    if (tab.unsaved && !confirm('笔记本「' + tab.title + '」尚未保存，关闭后将丢失未保存内容。确定关闭吗？')) {
      return;
    }
    tabs.splice(idx, 1);
    // 从 IndexedDB 删除
    if (useIndexedDB) {
      try { await storage.deleteNotebook(id); } catch (e) {}
    }
    if (tabs.length === 0) {
      // 自动创建空白笔记本
      await createTab({ skipSaveCurrent: true });
    } else if (activeTabId === id) {
      // 切到相邻 tab
      const next = tabs[Math.min(idx, tabs.length - 1)];
      await activateTab(next.id);
    } else {
      renderTabs();
    }
    persistTabMeta();
    showToast('已关闭「' + tab.title + '」');
  }

  // 新建按钮
  tabNewBtn?.addEventListener('click', () => createTab());

  // Ctrl+T 新建标签
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey && !e.altKey) {
      // 避免与浏览器新建标签冲突：使用 Ctrl+Alt+T
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      createTab();
    }
    // Ctrl+Tab / Ctrl+Shift+Tab 切换标签
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault();
      if (tabs.length < 2) return;
      const idx = tabs.findIndex(t => t.id === activeTabId);
      if (idx === -1) return;
      const nextIdx = e.shiftKey
        ? (idx - 1 + tabs.length) % tabs.length
        : (idx + 1) % tabs.length;
      switchTab(tabs[nextIdx].id);
    }
  });

  function markUnsaved() {
    isUnsaved = true;
    if (statusSave) {
      statusSave.textContent = '未保存 *';
      statusSave.style.color = '#f39c12';
    }
    // 同步 tab 状态
    const t = getTabById(activeTabId);
    if (t && !t.unsaved) {
      t.unsaved = true;
      const derived = deriveTitleFromCells();
      if (derived) t.title = derived;
      renderTabs();
    }
    scheduleAutosave();
  }

  function markSaved() {
    isUnsaved = false;
    if (statusSave) {
      statusSave.textContent = '已保存 ✓';
      statusSave.style.color = '#27ae60';
    }
    // 同步 tab 状态
    const t = getTabById(activeTabId);
    if (t && t.unsaved) {
      t.unsaved = false;
      renderTabs();
    }
  }

  function scheduleAutosave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(autosave, 1500);
  }

  function serializeNotebook() {
    return {
      id: NOTEBOOK_ID,
      version: 2,
      type: 'mdnb-autosave',
      saved: new Date().toISOString(),
      cells: cells.map(c => ({
        id: c.id,
        type: c.type || 'markdown',
        content: c.textarea.value,
        output_html: c.output.classList.contains('visible') ? c.output.innerHTML : ''
      }))
    };
  }

  // 兜底：IndexedDB 不可用时回退到 localStorage
  function autosaveLocalStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  async function autosave() {
    const data = serializeNotebook();
    if (useIndexedDB) {
      try {
        await storage.saveNotebook(data);
        markSaved();
      } catch (e) {
        // IndexedDB 写入失败，回退 localStorage
        if (autosaveLocalStorage(data)) {
          markSaved();
          showToast('IndexedDB 写入失败，已回退到 localStorage');
        } else {
          if (statusSave) {
            statusSave.textContent = '保存失败';
            statusSave.style.color = '#e74c3c';
          }
          showToast('自动保存失败：存储空间可能已满');
        }
      }
    } else {
      if (autosaveLocalStorage(data)) {
        markSaved();
      } else {
        if (statusSave) {
          statusSave.textContent = '保存失败';
          statusSave.style.color = '#e74c3c';
        }
        showToast('自动保存失败：存储空间可能已满');
      }
    }
  }

  function restoreFromData(data) {
    const cellList = (data && Array.isArray(data.cells)) ? data.cells : [];
    // 清空现有
    cells.slice().forEach(c => {
      if (c.textarea && typeof c.textarea.destroy === 'function') c.textarea.destroy();
      c.div.remove();
    });
    cells.length = 0;
    cellCounter = 0;
    cellList.forEach(s => {
      const newCell = createCell(null, s.content || '', { type: s.type === 'plaintext' ? 'plaintext' : 'markdown' });
      if (s.output_html) {
        newCell.output.innerHTML = s.output_html;
        newCell.output.classList.add('visible');
        if (newCell.outputToolbar) newCell.outputToolbar.classList.add('visible');
        markRun(newCell);
      }
    });
    if (cells.length === 0) createCell();
    renumberCells();
    updateStatusbar();
    return cellList.length > 0;
  }

  async function loadAutosave() {
    // 多标签页模式：从 meta 读取 tab 列表，逐个加载笔记本
    if (useIndexedDB) {
      try {
        let tabOrder = await storage.getMeta('tabOrder');
        let savedActive = await storage.getMeta('activeTab');
        // 兼容旧版本：无 tabOrder 但有 autosave 笔记本
        if (!tabOrder || !Array.isArray(tabOrder) || tabOrder.length === 0) {
          let legacyData = await storage.loadNotebook('autosave');
          if (!legacyData) {
            legacyData = await storage.migrateFromLocalStorage(STORAGE_KEY, 'autosave');
          }
          // 创建单个 tab 承载旧数据
          const legacyId = (legacyData && legacyData.id) || 'autosave';
          tabs = [{ id: legacyId, title: deriveTabTitleFromData(legacyData) || defaultTabTitle(1), unsaved: false }];
          activeTabId = legacyId;
          NOTEBOOK_ID = legacyId;
          renderTabs();
          if (legacyData) {
            restoreFromData(legacyData);
            return true;
          }
          return false;
        }
        // 多 tab 模式
        tabs = tabOrder.map(t => ({ id: t.id, title: t.title || defaultTabTitle(1), unsaved: false }));
        // 验证每个 tab 在 IndexedDB 中确实有数据；过滤掉没有数据的（可能是被外部清理）
        const validTabs = [];
        for (const t of tabs) {
          const data = await storage.loadNotebook(t.id);
          if (data) {
            validTabs.push(t);
          }
        }
        if (validTabs.length === 0) {
          // 数据全丢失：清空 meta，建空白笔记本
          tabs = [];
          await createTab({ skipSaveCurrent: true });
          return false;
        }
        tabs = validTabs;
        // 选择激活 tab
        let target = savedActive && tabs.find(t => t.id === savedActive) ? savedActive : tabs[0].id;
        activeTabId = null; // 强制 activateTab 走完整加载流程
        await activateTab(target);
        return true;
      } catch (e) {
        console.warn('[autosave] IndexedDB 读取失败，回退 localStorage:', e);
        useIndexedDB = false;
        // 回退到 localStorage（单 tab 模式）
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const data = JSON.parse(raw);
            tabs = [{ id: 'autosave', title: deriveTabTitleFromData(data) || defaultTabTitle(1), unsaved: false }];
            activeTabId = 'autosave';
            NOTEBOOK_ID = 'autosave';
            renderTabs();
            restoreFromData(data);
            return true;
          }
        } catch (e2) {}
        return false;
      }
    }
    // localStorage 兜底（单 tab）
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      tabs = [{ id: 'autosave', title: deriveTabTitleFromData(data) || defaultTabTitle(1), unsaved: false }];
      activeTabId = 'autosave';
      NOTEBOOK_ID = 'autosave';
      renderTabs();
      restoreFromData(data);
      return true;
    } catch (e) {
      showToast('恢复自动保存失败：数据可能已损坏');
      return false;
    }
  }

  function deriveTabTitleFromData(data) {
    if (!data || !Array.isArray(data.cells)) return null;
    for (const c of data.cells) {
      const v = (c.content || '').trim();
      if (v) {
        const firstLine = v.split(/\r?\n/)[0].replace(/^#+\s*/, '').trim();
        if (firstLine) return firstLine.slice(0, 30);
      }
    }
    return null;
  }

  // 页面卸载前尽力保存（IndexedDB 异步，无法保证完成，但 1.5s 防抖通常已保存）
  window.addEventListener('beforeunload', () => {
    if (isUnsaved) {
      const data = serializeNotebook();
      if (useIndexedDB) {
        // fire-and-forget，浏览器会在卸载前尽量完成
        try { storage.saveNotebook(data); } catch (e) {}
        try { storage.setMeta('tabOrder', tabs.map(t => ({ id: t.id, title: t.title }))); } catch (e) {}
        try { storage.setMeta('activeTab', activeTabId); } catch (e) {}
      }
      // 同时写 localStorage 作为兜底（同步，确保完成）
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    }
  });

  // ============== 搜索/替换 ==============

  let searchMatches = []; // [{cellId, start, end}]
  let searchIdx = -1;

  function openSearchPanel() {
    if (!searchPanel) return;
    searchPanel.classList.add('visible');
    setTimeout(() => searchInput.focus(), 50);
  }

  function closeSearchPanel() {
    if (!searchPanel) return;
    searchPanel.classList.remove('visible');
    searchMatches = [];
    searchIdx = -1;
    if (searchInfo) searchInfo.textContent = '未搜索';
    // 清除高亮（textarea 无法真正高亮，仅清除选中）
    const cell = getActiveCell();
    if (cell) cell.textarea.blur();
  }

  function doSearch() {
    const query = searchInput.value;
    searchMatches = [];
    searchIdx = -1;
    if (!query) {
      if (searchInfo) searchInfo.textContent = '请输入查找内容';
      return;
    }
    const lowerQuery = query.toLowerCase();
    cells.forEach(c => {
      const val = c.textarea.value.toLowerCase();
      let pos = 0;
      while (true) {
        const idx = val.indexOf(lowerQuery, pos);
        if (idx === -1) break;
        searchMatches.push({ cellId: c.id, start: idx, end: idx + query.length });
        pos = idx + 1;
      }
    });
    if (searchMatches.length === 0) {
      if (searchInfo) searchInfo.textContent = '未找到匹配';
    } else {
      searchIdx = 0;
      highlightMatch(searchMatches[0]);
      if (searchInfo) searchInfo.textContent = `1 / ${searchMatches.length} 个匹配`;
    }
  }

  function highlightMatch(m) {
    const cell = getCell(m.cellId);
    if (!cell) return;
    activeCellId = m.cellId;
    cell.textarea.focus();
    cell.textarea.setSelectionRange(m.start, m.end);
    // CM6 的 scrollIntoView 在 setSelectionRange 中已处理
  }

  function searchNavigate(dir) {
    if (searchMatches.length === 0) return;
    searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;
    highlightMatch(searchMatches[searchIdx]);
    if (searchInfo) searchInfo.textContent = `${searchIdx + 1} / ${searchMatches.length} 个匹配`;
  }

  function replaceOne() {
    if (searchIdx < 0 || searchIdx >= searchMatches.length) return;
    const m = searchMatches[searchIdx];
    const cell = getCell(m.cellId);
    if (!cell) return;
    const replaceText = replaceInput.value;
    cell.textarea.replaceRange(m.start, m.end, replaceText);
    updateCellMeta(cell);
    markModified(cell);
    markUnsaved();
    doSearch();
  }

  function replaceAll() {
    if (!searchInput.value) return;
    const replaceText = replaceInput.value;
    let count = 0;
    cells.forEach(c => {
      const val = c.textarea.value;
      if (val.toLowerCase().indexOf(searchInput.value.toLowerCase()) !== -1) {
        const regex = new RegExp(escapeRegExp(searchInput.value), 'gi');
        const newVal = val.replace(regex, () => { count++; return replaceText; });
        if (newVal !== val) {
          c.textarea.setValue(newVal);
          updateCellMeta(c);
          markModified(c);
        }
      }
    });
    markUnsaved();
    if (searchInfo) searchInfo.textContent = `已替换 ${count} 处`;
    searchMatches = [];
    searchIdx = -1;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 搜索面板事件
  if (searchBtn) searchBtn.addEventListener('click', () => {
    if (searchPanel.classList.contains('visible')) closeSearchPanel();
    else openSearchPanel();
  });
  if (searchInput) {
    searchInput.addEventListener('input', doSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? searchNavigate(-1) : searchNavigate(1); }
    });
  }
  document.getElementById('searchPrevBtn')?.addEventListener('click', () => searchNavigate(-1));
  document.getElementById('searchNextBtn')?.addEventListener('click', () => searchNavigate(1));
  document.getElementById('replaceOneBtn')?.addEventListener('click', replaceOne);
  document.getElementById('replaceAllBtn')?.addEventListener('click', replaceAll);
  document.getElementById('searchCloseBtn')?.addEventListener('click', closeSearchPanel);

  // ============== 字号调节 ==============

  function applyFontSize(size) {
    // CM6 编辑器实例通过 setFontSize 设置字号
    cells.forEach(c => c.editor.setFontSize(size));
    try { localStorage.setItem('mdnb_fontsize', String(size)); } catch (e) {}
    document.querySelectorAll('.font-size-item').forEach(it => {
      it.classList.toggle('active', parseInt(it.dataset.size) === size);
    });
  }

  fontSizeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = fontSizeBtn.getBoundingClientRect();
    fontSizeMenu.style.top = (rect.bottom + 4) + 'px';
    fontSizeMenu.style.left = rect.left + 'px';
    fontSizeMenu.classList.toggle('visible');
  });

  document.querySelectorAll('.font-size-item').forEach(item => {
    item.addEventListener('click', () => {
      applyFontSize(parseInt(item.dataset.size));
      fontSizeMenu.classList.remove('visible');
    });
  });

  document.addEventListener('click', (e) => {
    if (fontSizeMenu && !fontSizeMenu.contains(e.target) && e.target !== fontSizeBtn) {
      fontSizeMenu.classList.remove('visible');
    }
  });

  // ============== 主题切换 ==============

  themeToggleBtn?.addEventListener('click', () => {
    document.body.classList.toggle('editor-dark-mode');
    const isDark = document.body.classList.contains('editor-dark-mode');
    // 同步切换所有 CM6 编辑器实例的主题
    cells.forEach(c => c.editor.setDarkMode(isDark));
    themeToggleBtn.innerHTML = isDark
      ? '<svg class="ico"><use href="#i-sun"/></svg>'
      : '<svg class="ico"><use href="#i-moon"/></svg>';
    try { localStorage.setItem('mdnb_theme', isDark ? 'dark' : 'light'); } catch (e) {}
  });

  function loadTheme() {
    try {
      const t = localStorage.getItem('mdnb_theme');
      if (t === 'dark') {
        document.body.classList.add('editor-dark-mode');
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<svg class="ico"><use href="#i-sun"/></svg>';
      }
    } catch (e) {}
  }

  // ============== 初始化 ==============

  // 创建全局"新建 Cell"按钮（始终在最后一个 cell 下方）
  globalAddBtn = document.createElement('button');
  globalAddBtn.className = 'add-cell-btn';
  globalAddBtn.textContent = '+ 新建 Cell';
  globalAddBtn.addEventListener('click', () => {
    // 在最后一个 cell 后方新建
    const lastCell = cells[cells.length - 1];
    createCell(lastCell ? lastCell.id : null);
  });
  editorMain.appendChild(globalAddBtn);

  loadTheme();

  // 恢复字号
  try {
    const savedSize = parseInt(localStorage.getItem('mdnb_fontsize'));
    if (savedSize) applyFontSize(savedSize);
  } catch (e) {}

  // 尝试恢复自动保存（IndexedDB 异步读取）
  createCell(); // 先创建默认 Cell，避免界面空白
  markSaved();
  loadAutosave().then(restored => {
    if (restored) {
      showToast('已恢复上次会话');
    } else if (tabs.length === 0) {
      // 无历史数据，初始化第一个空白 tab
      return createTab({ skipSaveCurrent: true });
    }
  }).catch(e => {
    console.warn('[autosave] 恢复失败:', e);
    if (tabs.length === 0) {
      createTab({ skipSaveCurrent: true }).catch(() => {});
    }
  });

  } // end initEditor()

  // 页面加载后检查是否需要进入编辑器模式
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkEditorMode);
  } else {
    checkEditorMode();
  }

})();
