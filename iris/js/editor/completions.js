/**
 * 编辑器自动补全条目库（editor.js 拆分第一批：纯静态数据外移）
 *
 * 每个条目：{ trigger: 触发前缀, label, desc, insert, replaceLength: 替换前缀长度 }
 * 由 iris/js/editor.js 在 initEditor 时读取（window.MarkdownPreview.editorCompletions）。
 * lazy-modules.js 保证本文件先于 editor.js 加载。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  window.MarkdownPreview.editorCompletions = [
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
    // 注：@[service] 嵌入语法必须包裹在 ```embed 代码块中，统一在 ``` 触发补全中提供
    // @tab 代码选项卡分隔符
    { trigger: '@', label: '@tab 名称', desc: 'code-tabs 选项卡分隔', insert: '@tab ', replaceLength: 1 },
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
    { trigger: '```', label: '```pptx', desc: '嵌入 PPTX 演示', insert: '```pptx\n@[pptx](example)\n```', replaceLength: 3 },
    { trigger: '```', label: '```pkt', desc: '嵌入 PT 拓扑', insert: '```pkt\n@[pkt](example)\n```', replaceLength: 3 },
    { trigger: '```', label: '```pkt (ensp)', desc: '嵌入 eNSP 拓扑', insert: '```pkt\n@[ensp](example)\n```', replaceLength: 3 },
    { trigger: '```', label: '```embed', desc: '外部内容嵌入', insert: '```embed\n@[youtube](dQw4w9WgXcQ)\n```', replaceLength: 3 },
    { trigger: '```', label: '```diff', desc: 'Diff 差异', insert: '```diff\n+ 新增\n- 删除\n```', replaceLength: 3 },
    { trigger: '```', label: '```geo', desc: '坐标地图', insert: '```geo\n{"lat":39.9042,"lng":116.4074,"zoom":12}\n```', replaceLength: 3 },
    { trigger: '```', label: '```geojson', desc: 'GeoJSON 地图', insert: '```geojson\n{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"点"},"geometry":{"type":"Point","coordinates":[116.4,39.9]}}]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```topojson', desc: 'TopoJSON 地图', insert: '```topojson\n{"type":"Topology","objects":{},"arcs":[]}\n```', replaceLength: 3 },
    { trigger: '```', label: '```qrcode', desc: '二维码', insert: '```qrcode\nhttps://github.com\n```', replaceLength: 3 },
    { trigger: '```', label: '```colorcard', desc: '颜色卡片', insert: '```colorcard\n#FF6B6B\n#4ECDC4\n#45B7D1\n```', replaceLength: 3 },
    { trigger: '```', label: '```countdown', desc: '倒计时', insert: '```countdown\n2025-12-31T23:59:59\n```', replaceLength: 3 },
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
    // > 普通引用触发
    { trigger: '>', label: '> 引用', desc: 'Blockquote', insert: '> ', replaceLength: 1 },
    // ::: 容器（code-tabs / columns）
    { trigger: ':::', label: '::: code-tabs', desc: '代码选项卡', insert: '::: code-tabs\n@tab 选项卡 A\n\n内容 A\n\n@tab 选项卡 B\n\n内容 B\n\n:::\n', replaceLength: 3 },
    { trigger: ':::', label: '::: columns', desc: '多列布局', insert: '::: columns\n\n::: column 标题一\n\n第一栏内容\n\n::: column 标题二\n\n第二栏内容\n\n:::\n', replaceLength: 3 },
    // || 剧透
    { trigger: '||', label: '||剧透||', desc: '剧透/遮罩', insert: '||剧透内容||', replaceLength: 2 },
    // [pulse DG-LAB 波形
    { trigger: '[pulse', label: '[pulse]...[/pulse]', desc: 'DG-LAB 波形', insert: '[pulse title="标题"]\nDungeonlab+pulse:0,1,16=10,10,10,1,0/50-1,50-1,50-1,50-1\n[/pulse]', replaceLength: 6 },
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
})();
