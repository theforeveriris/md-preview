/**
 * Packet Tracer 拓扑渲染器
 *
 * 功能：
 * - 读取预处理好的 JSON，用 Cytoscape.js 渲染网络拓扑
 * - 节点：设备图标 + 名称标签 + 主 IP
 * - 连线：贝塞尔曲线 + 颜色编码线缆类型 + 粗细编码速率
 * - 交互：缩放平移 / 节点拖拽 / hover 高亮 / 点击展开右侧抽屉
 * - 详情抽屉：Tab 分页（接口表/配置/VLAN/ACL/路由）+ IOS 高亮 + 折叠
 * - 搜索：按设备名/IP/类型搜索高亮
 * - 布局切换：PT 坐标 ↔ 力导向
 * - 导出：PNG / JSON / Markdown 表格
 * - 主题：自动跟随 CSS 变量
 * - 移动端：触摸优化 + 底部抽屉
 */

(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  // ============== 设备类型 → SVG 图标映射 ==============
  const DEVICE_ICONS = {
    'router': 'pkt-router',
    'switch': 'pkt-switch',
    'pc': 'pkt-pc',
    'server': 'pkt-server',
    'laptop': 'pkt-laptop',
    'firewall': 'pkt-firewall',
    'phone': 'pkt-phone',
    'access-point': 'pkt-access-point',
    'cloud': 'pkt-cloud',
    'hub': 'pkt-hub',
    'tv': 'pkt-tv',
    'tablet': 'pkt-tablet',
    'unknown': 'pkt-unknown',
  };

  // ============== 线缆类型颜色 ==============
  // pkt 用 straight/crossover，ensp 用 copper/crossover，二者都是双绞线，统一映射为蓝色系
  const CABLE_COLORS = {
    'straight': '#3498db',
    'copper': '#3498db',      // eNSP 的 Copper 双绞线，等价于 PT 的 straight
    'crossover': '#e74c3c',
    'fiber': '#9b59b6',
    'serial': '#f39c12',
    'serial-dce': '#e67e22',
    'serial-dte': '#d35400',
    'console': '#27ae60',
    'coaxial': '#7f8c8d',
    'wireless': '#1abc9c',
    'unknown': '#bdc3c7',
  };

  // ============== IOS 语法高亮 ==============

  const IOS_KEYWORDS = [
    'interface', 'router', 'ip', 'no', 'shutdown', 'exit',
    'description', 'bandwidth', 'duplex', 'speed', 'vlan',
    'access-list', 'route', 'network', 'area', 'switchport',
    'access', 'trunk', 'encapsulation', 'channel-group',
    'standby', 'priority', 'preempt', 'track', 'ppp',
    'clock', 'rate',
  ];

  function highlightIOS(text) {
    if (!text) return '';
    // 转义 HTML
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 注释（! 开头的行）
    html = html.replace(/^!.*$/gm, m => `<span class="ios-comment">${m}</span>`);

    // interface 行
    html = html.replace(/^(\s*)(interface\s+\S+)/gm, (m, indent, iface) =>
      `${indent}<span class="ios-interface">${iface}</span>`);

    // shutdown
    html = html.replace(/^(\s*)(shutdown)$/gm, (m, indent, s) =>
      `${indent}<span class="ios-shutdown">${s}</span>`);

    // PC 专有：ip default-gateway / ip name-server 命令高亮
    html = html.replace(/^(\s*)(ip\s+(?:default-gateway|name-server))(?=\s)/gm, (m, indent, cmd) =>
      `${indent}<span class="ios-gateway">${cmd}</span>`);

    // IP 地址
    html = html.replace(/(\d+\.\d+\.\d+\.\d+)/g, '<span class="ios-ip">$1</span>');

    // 数字
    html = html.replace(/\b(\d+)\b/g, '<span class="ios-number">$1</span>');

    // 关键字
    const kwPattern = new RegExp(`\\b(${IOS_KEYWORDS.join('|')})\\b`, 'g');
    html = html.replace(kwPattern, '<span class="ios-keyword">$1</span>');

    return html;
  }

  // ============== 渲染单个拓扑 ==============

  function renderTopology(container, jsonData, options) {
    options = options || {};
    const sourceFile = jsonData.meta?.source || 'unknown.pkt';

    // 错误处理
    if (jsonData.error) {
      container.innerHTML = `
        <div class="pkt-topology-container">
          <div class="pkt-error-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <div class="pkt-error-title">解析失败：${sourceFile}</div>
            <div class="pkt-error-message">${jsonData.error.message || '未知错误'}</div>
            <div class="pkt-error-detail">${jsonData.error.detail || jsonData.error.message || ''}</div>
          </div>
        </div>
      `;
      return null;
    }

    // 构建 DOM 结构
    const wrapper = document.createElement('div');
    wrapper.className = 'pkt-topology-container';
    wrapper.innerHTML = `
      <div class="pkt-toolbar">
        <div class="pkt-toolbar-left">
          <span class="pkt-toolbar-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="6" cy="6" r="2"/>
              <circle cx="18" cy="6" r="2"/>
              <circle cx="6" cy="18" r="2"/>
              <circle cx="18" cy="18" r="2"/>
              <path d="M8 6h8M6 8v8M18 8v8M8 18h8"/>
            </svg>
            <span class="pkt-toolbar-title-text">${sourceFile}</span>
          </span>
        </div>
        <div class="pkt-toolbar-right">
          <input type="search" class="pkt-search-input" placeholder="搜索设备..." />
          <button class="pkt-btn active" data-action="layout-pt" title="使用 PT 原始坐标布局">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/></svg>
            <span class="pkt-btn-label">PT 坐标</span>
          </button>
          <button class="pkt-btn" data-action="layout-force" title="力导向自动布局">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M8 6h8M6 8l4 8M18 8l-4 8"/></svg>
            <span class="pkt-btn-label">力导向</span>
          </button>
          <button class="pkt-btn" data-action="toggle-grid" title="切换网格背景">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
            <span class="pkt-btn-label">网格</span>
          </button>
          <button class="pkt-btn active" data-action="toggle-iface" title="显示/隐藏接口名">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h10M4 17h7"/></svg>
            <span class="pkt-btn-label">接口名</span>
          </button>
          <button class="pkt-btn active" data-action="toggle-subnet" title="显示/隐藏网段">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>
            <span class="pkt-btn-label">网段</span>
          </button>
          <button class="pkt-btn" data-action="fit" title="适应屏幕">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/></svg>
            <span class="pkt-btn-label">复位</span>
          </button>
          <button class="pkt-btn" data-action="export" title="导出">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            <span class="pkt-btn-label">导出</span>
          </button>
        </div>
      </div>
      <div class="pkt-canvas-wrapper">
        <div class="pkt-canvas"></div>
      </div>
      <div class="pkt-statusbar">
        <div class="pkt-statusbar-left">
          <span class="pkt-statusbar-item">设备 <strong>${jsonData.meta.deviceCount}</strong></span>
          <span class="pkt-statusbar-item">链路 <strong>${jsonData.meta.linkCount}</strong></span>
          <span class="pkt-statusbar-item">配置 <strong>${jsonData.meta.configCount}</strong></span>
          <span class="pkt-statusbar-item">${jsonData.meta.ptVersion || ''}</span>
        </div>
        <div class="pkt-statusbar-right">
          <span class="pkt-zoom-display">100%</span>
        </div>
      </div>
    `;
    container.appendChild(wrapper);

    const canvasEl = wrapper.querySelector('.pkt-canvas');
    const canvasWrapper = wrapper.querySelector('.pkt-canvas-wrapper');

    // 构建 Cytoscape 元素
    const elements = [];

    // 设备节点
    (jsonData.devices || []).forEach(dev => {
      elements.push({
        group: 'nodes',
        data: {
          id: dev.id,
          label: dev.name,
          deviceType: dev.type,
          type: dev.type,  // 兼容 CSS 选择器 node[type="..."]
          primaryIp: dev.primaryIp || '',
          model: dev.model || '',
          rawType: dev.rawType || '',
          // 新增字段（旧 JSON 没有时为空字符串，向后兼容）
          gateway: dev.gateway || '',
          dns: dev.dns || '',
          mac: dev.mac || '',
        },
        position: { x: dev.x || 0, y: dev.y || 0 },
      });
    });

    // 链路边
    (jsonData.links || []).forEach(link => {
      if (link.source && link.target) {
        const srcIf = link.sourceInterface || '';
        const dstIf = link.targetInterface || '';
        const subnet = link.subnet || '';
        elements.push({
          group: 'edges',
          data: {
            id: link.id || `e-${link.source}-${link.target}`,
            source: link.source,
            target: link.target,
            cableType: link.cableType,
            cableRawType: link.cableRawType || '',
            sourceInterface: srcIf,
            targetInterface: dstIf,
            // 简化后的接口名，用于常驻标注（source-label / target-label）
            'source-text': shortIfName(srcIf),
            'target-text': shortIfName(dstIf),
            bandwidth: link.bandwidth,
            // 新增字段（旧 JSON 没有时为空，向后兼容）
            subnet: subnet,
            srcIp: link.srcIp || '',
            dstIp: link.dstIp || '',
            // 中间网段标签：用 label 字段，空时不显示
            label: subnet,
          },
        });
      }
    });

    // 初始化 Cytoscape
    const cy = cytoscape({
      container: canvasEl,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'width': 40,
            'height': 40,
            'shape': 'rectangle',
            // 节点底色完全透明，只显示 background-image（SVG 图标本身透明）
            'background-color': 'transparent',
            'background-opacity': 0,
            'background-image-opacity': 1,
            'label': 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'font-size': '11px',
            'font-weight': 500,
            'color': getCSSVar('--color-text', '#333'),
            'overlay-padding': '6px',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'node[type="router"]',
          style: { 'background-image': getIconDataURI('router'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="switch"]',
          style: { 'background-image': getIconDataURI('switch'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="pc"]',
          style: { 'background-image': getIconDataURI('pc'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="server"]',
          style: { 'background-image': getIconDataURI('server'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="firewall"]',
          style: { 'background-image': getIconDataURI('firewall'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="laptop"]',
          style: { 'background-image': getIconDataURI('laptop'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="phone"]',
          style: { 'background-image': getIconDataURI('phone'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="access-point"]',
          style: { 'background-image': getIconDataURI('access-point'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="cloud"]',
          style: { 'background-image': getIconDataURI('cloud'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="hub"]',
          style: { 'background-image': getIconDataURI('hub'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="tv"]',
          style: { 'background-image': getIconDataURI('tv'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="tablet"]',
          style: { 'background-image': getIconDataURI('tablet'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[type="unknown"]',
          style: { 'background-image': getIconDataURI('unknown'), 'background-fit': 'contain' },
        },
        {
          selector: 'node[?primaryIp]',
          style: { 'text-wrap': 'wrap', 'text-max-width': '80px' },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'curve-style': 'bezier',
            'line-color': getCSSVar('--color-border', '#ccc'),
            'target-arrow-color': getCSSVar('--color-border', '#ccc'),
            'target-arrow-shape': 'none',
            'arrow-scale': 0.8,
            'opacity': 0.7,
            // 中间网段标签（如 172.16.1.0/24）
            // 注意：不能用 'data(label)' 数据绑定形式，否则后续 edge.style('label', ...) 静态赋值会被忽略
            // 这里留空，由 applyEdgeLabels() 在初始化和切换时统一设置
            'label': '',
            'font-size': '9px',
            'color': '#666',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-background-color': 'rgba(255,255,255,0.8)',
            'text-background-opacity': 1,
            'text-background-padding': '2px',
            'text-background-shape': 'round-rectangle',
            // 源端接口名常驻标注（简化后，如 Fa0/0）
            'source-label': '',
            'source-text-offset': 20,
            'source-text-margin-y': 8,
            // 目的端接口名常驻标注
            'target-label': '',
            'target-text-offset': 20,
            'target-text-margin-y': 8,
          },
        },
        {
          selector: 'edge[cableType="straight"]',
          style: { 'line-color': CABLE_COLORS.straight, 'width': 2 },
        },
        {
          selector: 'edge[cableType="copper"]',
          style: { 'line-color': CABLE_COLORS.copper, 'width': 2 },
        },
        {
          selector: 'edge[cableType="crossover"]',
          style: { 'line-color': CABLE_COLORS.crossover, 'width': 2 },
        },
        {
          selector: 'edge[cableType="fiber"]',
          style: { 'line-color': CABLE_COLORS.fiber, 'width': 3 },
        },
        {
          selector: 'edge[cableType="serial"]',
          style: { 'line-color': CABLE_COLORS.serial, 'width': 2 },
        },
        {
          selector: 'edge[cableType="console"]',
          style: { 'line-color': CABLE_COLORS.console, 'width': 1, 'line-style': 'dashed' },
        },
        {
          selector: 'edge[cableType="wireless"]',
          style: { 'line-color': CABLE_COLORS.wireless, 'width': 2, 'line-style': 'dotted' },
        },
        {
          selector: '.highlighted',
          style: { 'opacity': 1, 'border-width': 3, 'border-color': getCSSVar('--color-accent-purple', '#9b59b6') },
        },
        {
          selector: '.faded',
          style: { 'opacity': 0.2 },
        },
        {
          selector: ':selected',
          style: { 'border-width': 3, 'border-color': getCSSVar('--color-accent-purple', '#9b59b6') },
        },
      ],
      layout: { name: 'preset', fit: false, padding: 40 },
      wheelSensitivity: 0.2,
      minZoom: 0.3,
      maxZoom: 3,
    });

    // 设置节点 type 属性（用于样式选择器）
    cy.nodes().forEach(node => {
      const devType = node.data('deviceType') || 'unknown';
      node.addClass(`type-${devType}`);
      // 直接设置 background-image（兼容 CSS 选择器失效的场景）
      // 注意：不要设置 background-opacity > 0，否则 Cytoscape 会先画一层不透明底色
      const iconURI = getIconDataURI(devType);
      if (iconURI) {
        node.style('background-image', iconURI);
        node.style('background-fit', 'contain');
        node.style('background-image-opacity', 1);
        node.style('background-color', 'transparent');
        node.style('background-opacity', 0);
      }
    });

    // 保存初始位置（PT 原始坐标），用于 layout-pt 按钮恢复
    const originalPositions = {};
    cy.nodes().forEach(node => {
      const pos = node.position();
      originalPositions[node.id()] = { x: pos.x, y: pos.y };
    });

    // 适应屏幕（排除离群点，避免正常设备被缩成不可见的小点）
    // 策略：只对参与链路的节点 + 坐标在合理范围内的节点做 fit
    const fitEls = computeFitElements(cy, jsonData);
    cy.fit(fitEls.length ? fitEls : cy.elements(), 40);

    // 更新缩放显示
    const zoomDisplay = wrapper.querySelector('.pkt-zoom-display');
    const updateZoom = () => {
      if (zoomDisplay) zoomDisplay.textContent = Math.round(cy.zoom() * 100) + '%';
    };
    cy.on('zoom', updateZoom);
    updateZoom();

    // hover 高亮链路
    cy.edges().on('mouseover', evt => {
      const edge = evt.target;
      edge.style('width', parseFloat(edge.style('width')) + 2);
      edge.style('opacity', 1);
      // 显示 tooltip（含接口 IP 和网段）
      const cableType = edge.data('cableType') || 'unknown';
      const srcIf = edge.data('sourceInterface');
      const dstIf = edge.data('targetInterface');
      const srcIp = edge.data('srcIp');
      const dstIp = edge.data('dstIp');
      const subnet = edge.data('subnet');
      const bw = edge.data('bandwidth');
      let tooltip = `${cableType}`;
      // 接口行：带 IP 显示，如 "Fa0/0 (172.16.1.1) ↔ Fa0/0 (172.16.1.2)"
      const srcPart = srcIf ? (srcIp ? `${srcIf} (${srcIp})` : srcIf) : '?';
      const dstPart = dstIf ? (dstIp ? `${dstIf} (${dstIp})` : dstIf) : '?';
      tooltip += `\n${srcPart} ↔ ${dstPart}`;
      if (subnet) tooltip += `\n网段: ${subnet}`;
      if (bw) tooltip += `\n带宽: ${bw} Kbps`;
      showTooltip(evt.originalEvent, tooltip);
    });

    cy.edges().on('mouseout', evt => {
      const edge = evt.target;
      const cableType = edge.data('cableType');
      const width = cableType === 'fiber' ? 3 : 2;
      edge.style('width', width);
      edge.style('opacity', 0.7);
      hideTooltip();
    });

    // 点击设备节点 → 打开详情抽屉
    cy.nodes().on('tap', evt => {
      const node = evt.target;
      openDrawer(node, jsonData);
    });

    // ============== 工具栏按钮 ==============

    wrapper.querySelector('[data-action="layout-pt"]').addEventListener('click', () => {
      // PT 坐标布局：先把节点位置恢复成初始坐标，再跑 preset，再 fit 到非离群元素
      cy.nodes().forEach(node => {
        const orig = originalPositions[node.id()];
        if (orig) {
          node.position({ x: orig.x, y: orig.y });
        }
      });
      cy.layout({ name: 'preset', fit: false, padding: 40 }).run();
      const fitEls = computeFitElements(cy, jsonData);
      cy.fit(fitEls.length ? fitEls : cy.elements(), 40);
      setActiveBtn(wrapper, 'layout-pt');
    });

    wrapper.querySelector('[data-action="layout-force"]').addEventListener('click', () => {
      cy.layout({
        name: 'cose',
        animate: true,
        animationDuration: 500,
        nodeRepulsion: 8000,
        idealEdgeLength: 100,
        padding: 40,
        fit: true,
      }).run();
      setActiveBtn(wrapper, 'layout-force');
    });

    wrapper.querySelector('[data-action="toggle-grid"]').addEventListener('click', () => {
      canvasWrapper.classList.toggle('grid');
      // 确保 canvas 背景透明，让 wrapper 的网格能透出来
      const canvasChild = canvasEl.querySelector('canvas');
      if (canvasChild) {
        canvasChild.style.background = 'transparent';
      }
      wrapper.querySelector('[data-action="toggle-grid"]').classList.toggle('active');
    });

    // ============== 接口名 / 网段 显示开关 ==============
    // 状态保存在 wrapper 上，便于在多次切换间持久化
    const labelState = { showIface: true, showSubnet: true };

    function applyEdgeLabels() {
      cy.edges().forEach(edge => {
        const srcIf = edge.data('sourceInterface') || '';
        const dstIf = edge.data('targetInterface') || '';
        const subnet = edge.data('subnet') || '';
        // 接口名开关
        edge.style('source-label', labelState.showIface ? shortIfName(srcIf) : '');
        edge.style('target-label', labelState.showIface ? shortIfName(dstIf) : '');
        // 网段开关
        edge.style('label', labelState.showSubnet ? subnet : '');
      });
    }

    wrapper.querySelector('[data-action="toggle-iface"]').addEventListener('click', () => {
      labelState.showIface = !labelState.showIface;
      const btn = wrapper.querySelector('[data-action="toggle-iface"]');
      btn.classList.toggle('active', labelState.showIface);
      applyEdgeLabels();
    });

    wrapper.querySelector('[data-action="toggle-subnet"]').addEventListener('click', () => {
      labelState.showSubnet = !labelState.showSubnet;
      const btn = wrapper.querySelector('[data-action="toggle-subnet"]');
      btn.classList.toggle('active', labelState.showSubnet);
      applyEdgeLabels();
    });

    // 初始默认显示接口名和网段（因为上面样式里留空了，需要主动调一次填充）
    applyEdgeLabels();

    wrapper.querySelector('[data-action="fit"]').addEventListener('click', () => {
      const fitEls = computeFitElements(cy, jsonData);
      cy.fit(fitEls.length ? fitEls : cy.elements(), 40);
    });

    wrapper.querySelector('[data-action="export"]').addEventListener('click', (e) => {
      showExportMenu(e, cy, jsonData, sourceFile);
    });

    // 搜索
    const searchInput = wrapper.querySelector('.pkt-search-input');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        cy.elements().removeClass('faded highlighted');
        return;
      }
      cy.elements().removeClass('highlighted').addClass('faded');
      const matched = cy.nodes().filter(node => {
        const name = (node.data('label') || '').toLowerCase();
        const ip = (node.data('primaryIp') || '').toLowerCase();
        const type = (node.data('deviceType') || '').toLowerCase();
        return name.includes(query) || ip.includes(query) || type.includes(query);
      });
      matched.removeClass('faded').addClass('highlighted');
      matched.connectedEdges().removeClass('faded');
    });

    // 触摸优化（移动端双指缩放由 Cytoscape 默认支持）

    return cy;
  }

  // ============== 辅助函数 ==============

  function getCSSVar(name, fallback) {
    const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return val || fallback;
  }

  // 接口名简化：FastEthernet0/0 → Fa0/0, GigabitEthernet0/0 → Gi0/0
  // 支持 FastEthernet, GigabitEthernet, Serial, Ethernet, Vlan, Loopback
  // 旧数据或未识别类型原样返回
  const IF_NAME_ABBR = [
    [/^FastEthernet/i, 'Fa'],
    [/^GigabitEthernet/i, 'Gi'],
    [/^TenGigabitEthernet/i, 'Ten'],
    [/^Serial/i, 'Se'],
    [/^Ethernet/i, 'Eth'],
    [/^Vlan/i, 'Vl'],
    [/^Loopback/i, 'Lo'],
    [/^Port-channel/i, 'Po'],
  ];

  function shortIfName(name) {
    if (!name) return '';
    let result = name;
    for (const [re, abbr] of IF_NAME_ABBR) {
      if (re.test(result)) {
        result = result.replace(re, abbr);
        break;
      }
    }
    return result;
  }

  // 计算 fit 时应包含的元素：排除坐标离群点
  // 策略：先按链路找出参与连接的节点；再用这些节点的坐标中位数作为基准，
  //       剔除距离中位数过远（>2.5 倍中位绝对偏差）的离群节点
  function computeFitElements(cy, jsonData) {
    const linkedIds = new Set();
    (jsonData.links || []).forEach(l => {
      if (l.source) linkedIds.add(String(l.source));
      if (l.target) linkedIds.add(String(l.target));
    });

    // 参与链路的节点（孤立节点不参与 fit，避免把画布撑大）
    const linkedNodes = cy.nodes().filter(n => linkedIds.has(String(n.data('id'))));
    if (linkedNodes.length === 0) return cy.elements();

    // 统计这些节点的坐标，计算中位数
    const xs = linkedNodes.map(n => n.position().x).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    const ys = linkedNodes.map(n => n.position().y).filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (xs.length === 0 || ys.length === 0) return cy.elements();

    const median = arr => arr.length % 2 === 0
      ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
      : arr[Math.floor(arr.length / 2)];
    const mx = median(xs), my = median(ys);

    // 计算到中位数的距离，用 MAD（中位绝对偏差）作为离群判定
    const dists = linkedNodes.map(n => Math.hypot(n.position().x - mx, n.position().y - my));
    const sortedDists = [...dists].sort((a, b) => a - b);
    const medDist = median(sortedDists);
    const mad = median(sortedDists.map(d => Math.abs(d - medDist)));
    // 阈值：距离中位数 > medDist + 3 * mad + 500 也视为离群
    // （加 500 是为了在所有节点都很近时也能容忍正常布局间距）
    const threshold = medDist + 3 * Math.max(mad, 1) + 500;

    const fitNodes = linkedNodes.filter(n => {
      const p = n.position();
      return Math.hypot(p.x - mx, p.y - my) <= threshold;
    });

    // 返回节点 + 它们的连接边
    return fitNodes.union(fitNodes.connectedEdges());
  }

  function getIconDataURI(deviceType) {
    const symbolId = DEVICE_ICONS[deviceType] || DEVICE_ICONS['unknown'];
    const symbol = document.querySelector(`#${symbolId}`);
    if (!symbol) return '';
    // 读取 symbol 自身的 viewBox（Clarity 36x36 / Tabler 24x24），并通过 color 注入主题色，
    // 使 symbol 内 <g fill="currentColor">/<g stroke="currentColor"> 正确着色。
    const viewBox = symbol.getAttribute('viewBox') || '0 0 36 36';
    // 显式声明透明背景，避免某些渲染路径（canvas/data-URI）填充默认黑/白底
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="36" height="36" style="background:transparent;color:${getCSSVar('--color-text', '#333')}">${symbol.innerHTML}</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function setActiveBtn(wrapper, action) {
    // 只在布局类按钮之间互斥切换，不影响 toggle-iface / toggle-subnet 等开关按钮的 active 状态
    const layoutBtns = wrapper.querySelectorAll('.pkt-btn[data-action^="layout-"]');
    layoutBtns.forEach(btn => btn.classList.remove('active'));
    const btn = wrapper.querySelector(`[data-action="${action}"]`);
    if (btn) btn.classList.add('active');
  }

  // ============== Tooltip ==============

  let tooltipEl = null;

  function showTooltip(event, text) {
    hideTooltip();
    tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = `
      position: fixed;
      z-index: 9999;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      border-radius: 4px;
      pointer-events: none;
      white-space: pre;
      line-height: 1.5;
      max-width: 300px;
    `;
    tooltipEl.textContent = text;
    document.body.appendChild(tooltipEl);
    tooltipEl.style.left = (event.clientX + 12) + 'px';
    tooltipEl.style.top = (event.clientY + 12) + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  }

  // ============== 右侧抽屉 ==============

  let drawerEl = null;
  let drawerOverlayEl = null;

  function openDrawer(node, jsonData) {
    closeDrawer();

    const devId = node.data('id');
    const devName = node.data('label');
    const devType = node.data('deviceType') || 'unknown';
    const primaryIp = node.data('primaryIp') || '';
    const model = node.data('model') || '';
    const rawType = node.data('rawType') || '';
    // 新增字段（旧 JSON 没有时为空字符串，向后兼容）
    const devMac = node.data('mac') || '';
    const devGateway = node.data('gateway') || '';
    const devDns = node.data('dns') || '';

    const config = (jsonData.configs || []).find(c => c.deviceId === devId);
    const interfaces = jsonData.interfaces?.[devId] || [];
    const vlans = jsonData.vlans?.[devId] || [];
    const acls = jsonData.acls?.[devId] || [];
    const routes = jsonData.routes?.[devId] || [];

    const iconId = DEVICE_ICONS[devType] || DEVICE_ICONS['unknown'];

    // 构建元数据项（条件显示：MAC/DNS 仅在有值时显示，网关仅 PC 显示）
    const metaItems = [
      { label: '类型', value: devType },
      { label: '型号', value: model || rawType || '-' },
      { label: '主 IP', value: primaryIp || '-' },
    ];
    if (devMac) metaItems.push({ label: 'MAC', value: devMac });
    if (devType === 'pc') metaItems.push({ label: '网关', value: devGateway || '-' });
    if (devDns) metaItems.push({ label: 'DNS', value: devDns });

    const metaHtml = metaItems.map(m => `
      <div class="pkt-meta-item">
        <span class="pkt-meta-label">${m.label}</span>
        <span class="pkt-meta-value">${m.value}</span>
      </div>
    `).join('');

    // 创建遮罩
    drawerOverlayEl = document.createElement('div');
    drawerOverlayEl.className = 'pkt-drawer-overlay';
    drawerOverlayEl.addEventListener('click', closeDrawer);
    document.body.appendChild(drawerOverlayEl);

    // 创建抽屉
    drawerEl = document.createElement('div');
    drawerEl.className = 'pkt-drawer';
    drawerEl.innerHTML = `
      <div class="pkt-drawer-header">
        <div class="pkt-drawer-title">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6">
            <use href="#${iconId}"/>
          </svg>
          ${devName}
        </div>
        <button class="pkt-drawer-close" title="关闭">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="pkt-drawer-meta">${metaHtml}</div>
      <div class="pkt-drawer-tabs">
        <button class="pkt-tab active" data-tab="interfaces">接口 (${interfaces.length})</button>
        <button class="pkt-tab" data-tab="config">配置</button>
        <button class="pkt-tab" data-tab="vlans">VLAN (${vlans.length})</button>
        <button class="pkt-tab" data-tab="acls">ACL (${acls.length})</button>
        <button class="pkt-tab" data-tab="routes">路由 (${routes.length})</button>
        <button class="pkt-tab" data-tab="process">可能的配置过程</button>
      </div>
      <div class="pkt-drawer-body">
        ${renderInterfacesTab(interfaces)}
        ${renderConfigTab(config?.config || '')}
        ${renderVlansTab(vlans)}
        ${renderAclsTab(acls)}
        ${renderRoutesTab(routes)}
        ${renderConfigProcessTab(config?.config || '', devName, devType, jsonData.meta?.ptVersion || '')}
      </div>
    `;
    document.body.appendChild(drawerEl);

    // 触发动画
    requestAnimationFrame(() => {
      drawerOverlayEl.classList.add('visible');
      drawerEl.classList.add('visible');
    });

    // 关闭按钮
    drawerEl.querySelector('.pkt-drawer-close').addEventListener('click', closeDrawer);

    // Tab 切换
    drawerEl.querySelectorAll('.pkt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        drawerEl.querySelectorAll('.pkt-tab').forEach(t => t.classList.remove('active'));
        drawerEl.querySelectorAll('.pkt-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        drawerEl.querySelector(`.pkt-tab-content[data-tab="${tab.dataset.tab}"]`).classList.add('active');
      });
    });

    // 配置折叠
    drawerEl.querySelectorAll('.pkt-config-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });
  }

  function closeDrawer() {
    if (drawerEl) {
      drawerEl.classList.remove('visible');
      drawerOverlayEl?.classList.remove('visible');
      setTimeout(() => {
        drawerEl?.remove();
        drawerOverlayEl?.remove();
        drawerEl = null;
        drawerOverlayEl = null;
      }, 250);
    }
  }

  // ============== Tab 内容渲染 ==============

  function renderInterfacesTab(interfaces) {
    if (!interfaces.length) {
      return `<div class="pkt-tab-content active" data-tab="interfaces"><p style="color:var(--color-text-muted,#888);font-size:13px;text-align:center;padding:20px;">无接口信息</p></div>`;
    }
    const rows = interfaces.map(iface => `
      <tr>
        <td>${iface.name}</td>
        <td>${iface.ip || '-'}</td>
        <td>${iface.mask || '-'}</td>
        <td><span class="pkt-status-badge ${iface.status}">${iface.status}</span></td>
        <td>${iface.duplex || '-'}</td>
        <td>${iface.speed || '-'}</td>
        <td>${iface.description || '-'}</td>
        <td>${iface.mac || '-'}</td>
        <td>${iface.gateway || '-'}</td>
        <td>${iface.dhcp === true ? '是' : (iface.dhcp === false ? '否' : '-')}</td>
      </tr>
    `).join('');
    return `
      <div class="pkt-tab-content active" data-tab="interfaces">
        <div class="pkt-table-scroll">
          <table class="pkt-interface-table">
            <thead>
              <tr>
                <th>接口</th><th>IP</th><th>掩码</th><th>状态</th><th>双工</th><th>速率</th><th>描述</th><th>MAC</th><th>网关</th><th>DHCP</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderConfigTab(configText) {
    if (!configText) {
      return `<div class="pkt-tab-content" data-tab="config"><p style="color:var(--color-text-muted,#888);font-size:13px;text-align:center;padding:20px;">无配置信息</p></div>`;
    }
    // 按 interface 分块
    const blocks = configText.split(/^(interface\s+\S+)/m);
    const htmlBlocks = [];

    // 第一块（interface 之前的内容）
    if (blocks[0] && blocks[0].trim()) {
      htmlBlocks.push(renderConfigBlock('全局配置', blocks[0]));
    }

    // 后续每两块一组（interface 名 + 内容）
    for (let i = 1; i < blocks.length; i += 2) {
      const name = blocks[i];
      const body = blocks[i + 1] || '';
      htmlBlocks.push(renderConfigBlock(name, body));
    }

    return `
      <div class="pkt-tab-content" data-tab="config">
        ${htmlBlocks.join('')}
      </div>
    `;
  }

  function renderConfigBlock(name, body) {
    const highlighted = highlightIOS(body);
    return `
      <div class="pkt-config-block">
        <div class="pkt-config-header">
          <span>${name}</span>
          <span class="pkt-config-toggle">▼</span>
        </div>
        <pre class="pkt-config-body">${highlighted}</pre>
      </div>
    `;
  }

  function renderVlansTab(vlans) {
    if (!vlans.length) {
      return `<div class="pkt-tab-content" data-tab="vlans"><p style="color:var(--color-text-muted,#888);font-size:13px;text-align:center;padding:20px;">无 VLAN 信息</p></div>`;
    }
    const items = vlans.map(v => `
      <div class="pkt-vlan-item">
        <span class="pkt-vlan-id">${v.id}</span>
        <span class="pkt-vlan-name">${v.name}</span>
      </div>
    `).join('');
    return `<div class="pkt-tab-content" data-tab="vlans"><div class="pkt-vlan-list">${items}</div></div>`;
  }

  function renderAclsTab(acls) {
    if (!acls.length) {
      return `<div class="pkt-tab-content" data-tab="acls"><p style="color:var(--color-text-muted,#888);font-size:13px;text-align:center;padding:20px;">无 ACL 信息</p></div>`;
    }
    const items = acls.map(acl => {
      const rules = acl.rules.map(r => {
        const cls = r.includes('permit') ? 'acl-permit' : (r.includes('deny') ? 'acl-deny' : '');
        return `<div class="${cls}">${r}</div>`;
      }).join('');
      return `
        <div class="pkt-acl-item">
          <div class="pkt-acl-header">${acl.name} (${acl.type})</div>
          <div class="pkt-acl-rules">${rules}</div>
        </div>
      `;
    }).join('');
    return `<div class="pkt-tab-content" data-tab="acls">${items}</div>`;
  }

  function renderRoutesTab(routes) {
    if (!routes.length) {
      return `<div class="pkt-tab-content" data-tab="routes"><p style="color:var(--color-text-muted,#888);font-size:13px;text-align:center;padding:20px;">无路由信息</p></div>`;
    }
    const rows = routes.map(r => {
      // 构建 CIDR 网段，如 172.16.1.0/24；无 cidr 时只显示 network
      let subnet = r.network || '-';
      if (r.cidr !== undefined && r.cidr !== null && r.cidr !== '') {
        subnet = `${r.network}/${r.cidr}`;
      }
      // 下一跳：BGP 显示 AS 号和邻居信息
      let nextHopHtml = r.nextHop || '-';
      if (r.type === 'bgp') {
        const parts = [];
        if (r.processId) parts.push(`AS ${r.processId}`);
        if (Array.isArray(r.neighbors) && r.neighbors.length) {
          const nbStr = r.neighbors.map(n => `${n.ip || '?'}(AS${n.remoteAs || '?'})`).join(', ');
          parts.push(`邻居: ${nbStr}`);
        }
        if (parts.length) {
          nextHopHtml = `${r.nextHop || 'BGP'}<br><span class="pkt-route-nbr">${parts.join(' · ')}</span>`;
        }
      }
      // 默认路由行特殊高亮
      const rowCls = r.type === 'default' ? ' class="pkt-route-row-default"' : '';
      return `
        <tr${rowCls}>
          <td><span class="pkt-route-type ${r.type}">${r.type}</span></td>
          <td>${r.network}</td>
          <td>${r.mask}</td>
          <td>${subnet}</td>
          <td>${nextHopHtml}</td>
          <td>${r.interface || '-'}</td>
        </tr>
      `;
    }).join('');
    return `
      <div class="pkt-tab-content" data-tab="routes">
        <div class="pkt-table-scroll">
          <table class="pkt-route-table">
            <thead>
              <tr><th>类型</th><th>网络</th><th>掩码</th><th>网段</th><th>下一跳</th><th>接口</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ============== "可能的配置过程" Tab ==============
  // 根据解析出来的配置记录，按真实工程师的操作顺序，重新组织成可逐步执行的 CLI 命令序列。
  // 自动识别 Cisco IOS / Huawei VRP 语法，生成对应的进入配置模式、设主机名、配接口、
  // 配路由协议、配 ACL、保存等步骤。

  function renderConfigProcessTab(configText, devName, devType, ptVersion) {
    if (!configText || !configText.trim()) {
      return `<div class="pkt-tab-content" data-tab="process"><p style="color:var(--color-text-muted,#888);font-size:13px;text-align:center;padding:20px;">无配置信息，无法推算配置过程</p></div>`;
    }

    const vendor = detectVendor(configText, ptVersion);
    const steps = vendor === 'huawei'
      ? generateHuaweiSteps(configText, devName, devType)
      : generateCiscoSteps(configText, devName, devType);

    if (!steps.length) {
      return `<div class="pkt-tab-content" data-tab="process"><p style="color:var(--color-text-muted,#888);font-size:13px;text-align:center;padding:20px;">未能从配置中提取出可识别的配置步骤</p></div>`;
    }

    const vendorLabel = vendor === 'huawei' ? 'Huawei VRP' : 'Cisco IOS';
    const stepsHtml = steps.map((step, idx) => {
      const cmdsHtml = step.commands.map(cmd => {
        // 高亮：以 < 开头是用户视图提示符，[ 开头是系统/子视图提示符，纯命令着色
        let cls = 'pkt-cp-cmd';
        if (/^[<[]/.test(cmd)) cls = 'pkt-cp-prompt';
        return `<div class="${cls}">${escapeHtml(cmd)}</div>`;
      }).join('');
      return `
        <div class="pkt-cp-step">
          <div class="pkt-cp-step-head">
            <span class="pkt-cp-step-no">${idx + 1}</span>
            <span class="pkt-cp-step-title">${escapeHtml(step.title)}</span>
          </div>
          ${step.desc ? `<div class="pkt-cp-step-desc">${escapeHtml(step.desc)}</div>` : ''}
          <pre class="pkt-cp-cmds">${cmdsHtml}</pre>
        </div>
      `;
    }).join('');

    return `
      <div class="pkt-tab-content" data-tab="process">
        <div class="pkt-cp-banner">
          <span class="pkt-cp-vendor">${vendorLabel}</span>
          <span class="pkt-cp-hint">根据已解析的配置记录逆向推算，按典型操作顺序排列。仅包含核心业务配置，省略系统默认项。</span>
        </div>
        ${stepsHtml}
      </div>
    `;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ============== 厂商语法识别 ==============
  function detectVendor(configText, ptVersion) {
    const text = configText || '';
    // 1. ptVersion 强信号
    if (ptVersion && /ensp/i.test(ptVersion)) return 'huawei';
    if (ptVersion && /pt\s*\d/i.test(ptVersion)) return 'cisco';
    // 2. Huawei VRP 强信号
    if (/^\[v\d+r\d+/im.test(text)) return 'huawei';
    if (/^\s*sysname\s+\S+/m.test(text)) return 'huawei';
    if (/^\s*user-interface\s+con\s+/m.test(text)) return 'huawei';
    if (/^\s*ip\s+route-static\s+/m.test(text)) return 'huawei';
    if (/^\s*board\s+add\s+/m.test(text)) return 'huawei';
    // 3. Cisco IOS 强信号（放在 3 段接口名检查之前，避免 Catalyst 交换机被误判为华为）
    if (/^\s*hostname\s+\S+/m.test(text)) return 'cisco';
    if (/^\s*router\s+(?:ospf|bgp|rip|eigrp)\s+/m.test(text)) return 'cisco';
    if (/^\s*no\s+shutdown\s*$/m.test(text)) return 'cisco';
    if (/^version\s+\d+/m.test(text)) return 'cisco';
    if (/^end\s*$/m.test(text)) return 'cisco';
    // 4. 中等强度 Huawei 信号
    if (/^\s*(?:ospf|isis|bgp|rip)\s+\d+/m.test(text)) return 'huawei';
    if (/^\s*undo\s+/m.test(text)) return 'huawei';
    // 5. 弱信号：3 段接口名倾向华为，2 段倾向思科（最后才用，容易被 Catalyst 干扰）
    if (/interface\s+(?:gigabitethernet|ethernet|serial)\d+\/\d+\/\d+/i.test(text)) return 'huawei';
    if (/interface\s+(?:gigabitethernet|fastethernet)\d+\/\d+/i.test(text)) return 'cisco';
    // 6. 默认按 # 分段 → 华为，! 分段 → 思科
    const hashCount = (text.match(/^#/gm) || []).length;
    const bangCount = (text.match(/^!/gm) || []).length;
    if (hashCount > bangCount) return 'huawei';
    if (bangCount > hashCount) return 'cisco';
    return 'cisco';
  }

  // ============== 通用分段工具 ==============
  // 命令缩写归一化：对行首的常见缩写做保守展开，避免误伤 body 中的参数
  // 每行最多应用一条规则，避免链式替换；只处理最安全、最高频的缩写
  function normalizeAbbreviations(text) {
    // 规则按"行首(去缩进后)"匹配；[indent, content] 分离后只对 content 应用
    const rules = [
      [/^int(\s)/, 'interface$1'],
      [/^osp(\s)/, 'ospf$1'],
      [/^bg(\s)/, 'bgp$1'],
      [/^rou(\s)/, 'router$1'],
      // 两段缩写：router osp / router bg / router eig
      [/^router\s+osp(\s)/, 'router ospf$1'],
      [/^router\s+bg(\s)/, 'router bgp$1'],
      [/^router\s+eig(\s)/, 'router eigrp$1'],
      // ip add → ip address（注意 address 不会被误匹配，因为 add 后要求 \s）
      [/^ip\s+add(\s)/, 'ip address$1'],
      // no sh → no shutdown（no show 不是合法配置命令，安全）
      [/^no\s+sh(\s|$)/, 'no shutdown$1'],
    ];
    return text.split(/\r?\n/).map(line => {
      const indent = line.match(/^(\s*)/)[1];
      const content = line.slice(indent.length);
      for (const [re, rep] of rules) {
        const newContent = content.replace(re, rep);
        if (newContent !== content) {
          return indent + newContent;
        }
      }
      return line;
    }).join('\n');
  }

  // 将配置文本按段分隔符切成 [header, bodyLines[]] 列表
  // 若分隔符出现频率过低（如直接粘贴 display current-configuration 部分输出），fallback 到基于缩进的切分
  function splitConfigSections(configText, delimiter) {
    const sections = [];
    const allLines = configText.split(/\r?\n/);
    const delimRe = new RegExp('^' + delimiter + '\\s*$');
    const delimCount = allLines.filter(l => delimRe.test(l)).length;
    const nonEmptyCount = allLines.filter(l => l.trim() !== '').length;
    // 至少 3 个分隔符且占非空行 >= 10%，才认为是分隔格式
    const useDelim = nonEmptyCount > 0 && delimCount >= 3 && (delimCount / nonEmptyCount >= 0.1);

    let rawSections;
    if (useDelim) {
      rawSections = configText.split(new RegExp('^' + delimiter + '\\s*$', 'm'));
    } else {
      // fallback：基于缩进切分。未缩进的非空行作为新 section 的 header，缩进行作为上一个 section 的 body
      rawSections = [];
      let current = [];
      for (const line of allLines) {
        if (line.trim() === '') continue;
        const isIndented = /^\s/.test(line);
        if (!isIndented && current.length > 0) {
          rawSections.push(current.join('\n'));
          current = [];
        }
        current.push(line);
      }
      if (current.length > 0) rawSections.push(current.join('\n'));
    }

    for (const raw of rawSections) {
      const lines = raw.split(/\r?\n/).map(l => l).filter(l => l.trim() !== '');
      if (!lines.length) continue;
      const header = lines[0].trim();
      const body = lines.slice(1).map(l => l.trim());
      sections.push({ header, body, raw: lines.map(l => l.trim()) });
    }
    return sections;
  }

  // ============== Huawei VRP 配置过程生成 ==============
  function generateHuaweiSteps(configText, devName, devType) {
    const steps = [];
    // 命令缩写归一化（int→interface / osp→ospf / bg→bgp 等），避免缩写导致漏识别
    configText = normalizeAbbreviations(configText);
    // 提取 sysname 作为提示符中的设备名
    const sysnameMatch = configText.match(/^\s*sysname\s+(\S+)/m);
    const host = sysnameMatch ? sysnameMatch[1] : (devName || 'Huawei');
    const defaultName = 'Huawei';

    // ---- 步骤 1：进入系统视图 ----
    steps.push({
      title: '进入系统视图',
      desc: '从用户视图切换到系统视图，准备进行全局配置',
      commands: [
        `<${defaultName}>system-view`,
        `[${defaultName}]sysname ${host}`,
        `[${host}]`,
      ],
    });

    const sections = splitConfigSections(configText, '#');

    // ---- 收集各模块 ----
    const vlans = [];
    const interfaces = [];
    const ospfBlocks = [];
    const isisBlocks = [];
    const bgpBlocks = [];
    const ripBlocks = [];
    const staticRoutes = [];
    const acls = [];

    for (const sec of sections) {
      const h = sec.header;
      // VLAN：vlan 10 / vlan batch 10 20
      const vlanM = h.match(/^vlan\s+(.+)$/i);
      if (vlanM) {
        const body = sec.body.join('\n');
        const nameM = body.match(/^\s*name\s+(.+)$/m);
        // vlan batch 10 20 → 拆成多个
        const ids = vlanM[1].startsWith('batch')
          ? vlanM[1].replace(/^batch\s+/i, '').split(/\s+/)
          : [vlanM[1]];
        for (const id of ids) {
          if (id.includes('-')) {
            // 范围 vlan batch 10-20
            const [s, e] = id.split('-').map(Number);
            for (let i = s; i <= e; i++) vlans.push({ id: String(i), name: nameM ? nameM[1] : '' });
          } else {
            vlans.push({ id, name: nameM ? nameM[1] : '' });
          }
        }
        continue;
      }
      // 接口
      const ifM = h.match(/^interface\s+(.+)$/i);
      if (ifM) {
        const ifName = ifM[1].trim();
        const body = sec.body.join('\n');
        const ipM = body.match(/^\s*ip\s+address\s+(\S+)\s+(\S+)/m);
        const descM = body.match(/^\s*description\s+(.+)$/m);
        const shutM = /shutdown/.test(body) && !/undo\s+shutdown/.test(body);
        const linkProtoM = body.match(/^\s*link-protocol\s+(\S+)/m);
        const isisEnM = body.match(/^\s*isis\s+enable\s+(\S+)/m);
        const ospfEnM = body.match(/^\s*ospf\s+enable\s+(\S+)/m);
        const portTypeM = body.match(/^\s*port\s+link-type\s+(\S+)/m);
        const portAccM = body.match(/^\s*port\s+default\s+vlan\s+(\S+)/m);
        const trunkAllowM = body.match(/^\s*port\s+trunk\s+allow-pass\s+vlan\s+(.+)$/m);
        // VRRP：vrrp vrid N virtual-ip X.X.X.X / vrrp vrid N priority N / preempt-mode
        const vrrpLines = body.split('\n')
          .map(l => l.trim())
          .filter(l => /^vrrp\s+vrid\s+\d+/i.test(l));
        // Eth-Trunk：eth-trunk N（接口加入 eth-trunk）
        const ethTrunkM = body.match(/^\s*eth-trunk\s+(\S+)/m);
        // DHCP：dhcp select interface/relay/global + dhcp relay server-ip X
        const dhcpSelM = body.match(/^\s*dhcp\s+select\s+(\S+)/m);
        const dhcpRelayM = body.match(/^\s*dhcp\s+relay\s+server-ip\s+(\S+)/m);
        // ACL 应用：traffic-filter N inbound/outbound（华为）或 ip access-group N in/out（兼容思科）
        const trafficFilterM = body.match(/^\s*traffic-filter\s+(\S+)\s+(\S+)/m);
        const aclGroupM = body.match(/^\s*ip\s+access-group\s+(\S+)\s+(\S+)/m);
        // MTU
        const mtuM = body.match(/^\s*mtu\s+(\S+)/m);
        // IPv6
        const ipv6EnM = body.match(/^\s*ipv6\s+enable/m);
        const ipv6AddrM = body.match(/^\s*ipv6\s+address\s+(\S+)(?:\s+(\S+))?/m);
        // NAT：nat outbound N / nat server protocol tcp global X.X.X.X PORT inside Y.Y.Y.Y PORT
        const natOutM = body.match(/^\s*nat\s+outbound\s+(\S+)(?:\s+(\S+))?/m);
        const natSrvLines = body.split('\n')
          .map(l => l.trim())
          .filter(l => /^nat\s+server\s+/i.test(l));
        // Hybrid 端口
        const hybridPvidM = body.match(/^\s*port\s+hybrid\s+pvid\s+vlan\s+(\S+)/m);
        const hybridUntagM = body.match(/^\s*port\s+hybrid\s+untagged\s+vlan\s+(.+)$/m);
        const hybridTagM = body.match(/^\s*port\s+hybrid\s+tagged\s+vlan\s+(.+)$/m);
        // 子接口：dot1q termination vid N + arp broadcast enable
        const dot1qM = body.match(/^\s*dot1q\s+termination\s+vid\s+(\S+)/m);
        const arpBcastM = /arp\s+broadcast\s+enable/i.test(body);
        interfaces.push({
          name: ifName,
          ip: ipM ? ipM[1] : '',
          mask: ipM ? ipM[2] : '',
          desc: descM ? descM[1].trim() : '',
          shutdown: shutM,
          linkProtocol: linkProtoM ? linkProtoM[1] : '',
          isisEnable: isisEnM ? isisEnM[1] : '',
          ospfEnable: ospfEnM ? ospfEnM[1] : '',
          portType: portTypeM ? portTypeM[1] : '',
          portAccessVlan: portAccM ? portAccM[1] : '',
          trunkAllow: trunkAllowM ? trunkAllowM[1] : '',
          vrrp: vrrpLines,
          ethTrunk: ethTrunkM ? ethTrunkM[1] : '',
          dhcpSelect: dhcpSelM ? dhcpSelM[1] : '',
          dhcpRelay: dhcpRelayM ? dhcpRelayM[1] : '',
          trafficFilter: trafficFilterM ? { acl: trafficFilterM[1], dir: trafficFilterM[2] } : null,
          aclGroup: aclGroupM ? { acl: aclGroupM[1], dir: aclGroupM[2] } : null,
          mtu: mtuM ? mtuM[1] : '',
          ipv6Enable: !!ipv6EnM,
          ipv6Addr: ipv6AddrM ? ipv6AddrM[1] : '',
          ipv6Mask: ipv6AddrM ? (ipv6AddrM[2] || '') : '',
          natOutbound: natOutM ? { acl: natOutM[1], pool: natOutM[2] || '' } : null,
          natServers: natSrvLines,
          hybridPvid: hybridPvidM ? hybridPvidM[1] : '',
          hybridUntag: hybridUntagM ? hybridUntagM[1] : '',
          hybridTag: hybridTagM ? hybridTagM[1] : '',
          dot1qVid: dot1qM ? dot1qM[1] : '',
          arpBroadcast: arpBcastM,
          rawBody: body,
        });
        continue;
      }
      // OSPF（支持 vpn-instance NAME）
      const ospfM = h.match(/^ospf\s+(\d+)(?:\s+vpn-instance\s+(\S+))?(?:\s+router-id\s+(\S+))?/i);
      if (ospfM) {
        ospfBlocks.push({
          processId: ospfM[1],
          vpnInstance: ospfM[2] || '',
          routerId: ospfM[3] || '',
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // ISIS
      const isisM = h.match(/^isis\s+(\d+)/i);
      if (isisM) {
        isisBlocks.push({
          processId: isisM[1],
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // BGP
      const bgpM = h.match(/^bgp\s+(\d+)/i);
      if (bgpM) {
        bgpBlocks.push({
          asNumber: bgpM[1],
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // RIP
      const ripM = h.match(/^rip\s+(\d+)/i);
      if (ripM) {
        ripBlocks.push({
          processId: ripM[1],
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // ACL：acl number N / acl N / acl name FOO [advance|basic]
      const aclM = h.match(/^acl\s+(?:number\s+)?(\S+)(?:\s+(advance|basic))?/i);
      if (aclM) {
        const aclName = aclM[1];
        // name FOO：aclM[1] 是 "name"，aclM[2] 是 advance/basic，实际名字在 body 第一行
        if (/^name$/i.test(aclName)) {
          // acl name FOO 形式：重新匹配
          const namedM = h.match(/^acl\s+name\s+(\S+)(?:\s+(advance|basic))?/i);
          if (namedM) {
            acls.push({ name: namedM[1], kind: namedM[2] || '', body: sec.body, isNamed: true });
          }
        } else {
          // acl N / acl number N 形式
          acls.push({ name: aclName, kind: aclM[2] || '', body: sec.body, isNamed: false });
        }
        continue;
      }
      // 静态路由（可能不在独立段内，单独扫描）
      // 其他系统配置块收集在下面统一处理
    }

    // 静态路由：扫描全文 ip route-static
    const routeStaticRe = /^\s*ip\s+route-static\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gm;
    let rsm;
    while ((rsm = routeStaticRe.exec(configText)) !== null) {
      staticRoutes.push({
        network: rsm[1],
        mask: rsm[2],
        nextHop: rsm[3],
        extra: rsm[4] || '',
      });
    }

    // IPv6 静态路由：ipv6 route-static X::X/N nextHop
    const ipv6Routes = [];
    const ipv6RouteRe = /^\s*ipv6\s+route-static\s+(\S+)\s+(\S+)(?:\s+(\S+)(?:\s+(.+))?)?$/gm;
    let ipv6Rm;
    while ((ipv6Rm = ipv6RouteRe.exec(configText)) !== null) {
      ipv6Routes.push({
        prefix: ipv6Rm[1],
        mask: ipv6Rm[2] || '',
        nextHop: ipv6Rm[3] || '',
        extra: ipv6Rm[4] || '',
      });
    }

    // NAT 地址组：nat address-group N X X（在全局视图，但段头不是 interface）
    const natAddrGroups = [];
    const natGroupRe = /^\s*nat\s+address-group\s+(\S+)\s+(\S+)(?:\s+(\S+))?/gm;
    let natGm;
    while ((natGm = natGroupRe.exec(configText)) !== null) {
      natAddrGroups.push({
        id: natGm[1],
        start: natGm[2],
        end: natGm[3] || natGm[2],
      });
    }

    // DHCP 地址池：ip pool NAME
    const dhcpPools = [];
    const lines = configText.split(/\r?\n/);
    let curPool = null;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const poolM = t.match(/^ip\s+pool\s+(\S+)/i);
      if (poolM) {
        curPool = { name: poolM[1], body: [] };
        dhcpPools.push(curPool);
        continue;
      }
      if (curPool && /^(network|gateway-list|dns-list|lease-day|lease-hour|lease-minute|excluded-ip-address|static-bind|mask)/i.test(t)) {
        curPool.body.push(t);
      }
      if (curPool && /^#/.test(t)) {
        curPool = null;
      }
    }

    // NTP：ntp-service unicast-server X
    const ntpServers = [];
    const ntpRe = /^\s*ntp-service\s+unicast-server\s+(\S+)/gm;
    let ntpM;
    while ((ntpM = ntpRe.exec(configText)) !== null) ntpServers.push(ntpM[1]);

    // SNMP：snmp-agent community / sys-info version
    const snmpCommunities = [];
    const snmpCommRe = /^\s*snmp-agent\s+community\s+(read|write)\s+(\S+)/gm;
    let snmpM;
    while ((snmpM = snmpCommRe.exec(configText)) !== null) {
      snmpCommunities.push({ access: snmpM[1], name: snmpM[2] });
    }
    const snmpVerM = configText.match(/^\s*snmp-agent\s+sys-info\s+version\s+(.+)$/m);
    const snmpLocationM = configText.match(/^\s*snmp-agent\s+sys-info\s+location\s+(.+)$/m);
    const snmpContactM = configText.match(/^\s*snmp-agent\s+sys-info\s+contact\s+(.+)$/m);

    // STP：stp mode / stp priority / stp region-configuration
    const stpModeM = configText.match(/^\s*stp\s+mode\s+(\S+)/m);
    const stpPriM = configText.match(/^\s*stp\s+priority\s+(\S+)/m);
    const stpEnableM = /stp\s+enable/i.test(configText);

    // 路由策略 route-policy NAME permit node N
    const routePolicies = [];
    const rpRe = /^route-policy\s+(\S+)\s+(permit|deny)\s+node\s+(\d+)/gmi;
    let rpM;
    while ((rpM = rpRe.exec(configText)) !== null) {
      routePolicies.push({ name: rpM[1], action: rpM[2], node: rpM[3] });
    }

    // IP 前缀列表：ip ip-prefix NAME index N permit/deny X/Y
    const ipPrefixes = [];
    const ippRe = /^ip\s+ip-prefix\s+(\S+)\s+index\s+(\d+)\s+(permit|deny)\s+(\S+)\s+(\S+)/gmi;
    let ippM;
    while ((ippM = ippRe.exec(configText)) !== null) {
      ipPrefixes.push({ name: ippM[1], index: ippM[2], action: ippM[3], ip: ippM[4], mask: ippM[5] });
    }

    // AAA / 本地用户：local-user X password cipher Y / service-type telnet ssh / privilege level N
    const localUsers = [];
    let curUser = null;
    for (const line of lines) {
      const t = line.trim();
      const luM = t.match(/^local-user\s+(\S+)\s+password\s+(cipher|simple)\s+(\S+)/i);
      if (luM) {
        curUser = { name: luM[1], password: luM[3], cipher: luM[2] === 'cipher', services: [], level: '' };
        localUsers.push(curUser);
        continue;
      }
      const svcM = t.match(/^local-user\s+(\S+)\s+service-type\s+(.+)/i);
      if (svcM && curUser && svcM[1] === curUser.name) {
        curUser.services = svcM[2].trim().split(/\s+/);
        continue;
      }
      const lvlM = t.match(/^local-user\s+(\S+)\s+privilege\s+level\s+(\d+)/i);
      if (lvlM && curUser && lvlM[1] === curUser.name) {
        curUser.level = lvlM[2];
        continue;
      }
    }
    // aaa authentication-scheme / domain
    const aaaAuthM = configText.match(/^\s*aaa\b/im);
    const aaaDomainM = configText.match(/^\s*authentication-scheme\s+(default|\S+)/m);

    // VTY/Console：user-interface vty 0 4 / authentication-mode aaa / protocol inbound ssh
    const vtyLines = [];
    let inVty = false;
    for (const line of lines) {
      const t = line.trim();
      if (/^user-interface\s+(vty|console)\s+/i.test(t)) {
        inVty = true;
        vtyLines.push({ header: t, body: [] });
        continue;
      }
      if (inVty) {
        if (/^#/.test(t) || /^(interface|ospf|bgp|rip|isis|acl|vlan|ip\s+pool)/i.test(t)) {
          inVty = false;
        } else {
          vtyLines[vtyLines.length - 1].body.push(t);
        }
      }
    }

    // SSH 服务器配置：stelnet server enable / ssh user X authentication-type password / ssh user X service-type stelnet
    const sshEnabled = /stelnet\s+server\s+enable/i.test(configText);
    const sshUsers = [];
    const sshUserRe = /^ssh\s+user\s+(\S+)\s+(authentication-type\s+\S+|service-type\s+\S+)/gm;
    let sshM;
    while ((sshM = sshUserRe.exec(configText)) !== null) {
      sshUsers.push({ name: sshM[1], attr: sshM[2] });
    }

    // ---- 步骤 2：创建 VLAN ----
    if (vlans.length) {
      const cmds = [];
      for (const v of vlans) {
        cmds.push(`[${host}]vlan ${v.id}`);
        if (v.name) {
          cmds.push(`[${host}-vlan-${v.id}]name ${v.name}`);
        }
        cmds.push(`[${host}-vlan-${v.id}]quit`);
      }
      steps.push({
        title: '创建 VLAN',
        desc: '在交换机上创建 VLAN 并命名（仅交换机/三层交换机需要）',
        commands: cmds,
      });
    }

    // ---- 步骤 3：配置接口 ----
    if (interfaces.length) {
      const cmds = [];
      for (const iface of interfaces) {
        // 跳过 NULL0 等无配置接口
        if (!iface.ip && !iface.desc && !iface.linkProtocol && !iface.isisEnable &&
            !iface.ospfEnable && !iface.portType && !iface.trunkAllow &&
            iface.name.toUpperCase() !== 'NULL0' && iface.rawBody.trim() === '') {
          continue;
        }
        // 跳过明显的空接口
        if (iface.name.toUpperCase() === 'NULL0' && !iface.ip) continue;

        cmds.push(`[${host}]interface ${iface.name}`);
        const ifPrompt = `[${host}-${iface.name}]`;
        if (iface.desc) cmds.push(`${ifPrompt}description ${iface.desc}`);
        if (iface.linkProtocol) cmds.push(`${ifPrompt}link-protocol ${iface.linkProtocol}`);
        if (iface.ip && iface.mask) cmds.push(`${ifPrompt}ip address ${iface.ip} ${iface.mask}`);
        // IPv6
        if (iface.ipv6Enable) cmds.push(`${ifPrompt}ipv6 enable`);
        if (iface.ipv6Addr) {
          cmds.push(`${ifPrompt}ipv6 address ${iface.ipv6Addr}` + (iface.ipv6Mask ? ` ${iface.ipv6Mask}` : ''));
        }
        // MTU
        if (iface.mtu) cmds.push(`${ifPrompt}mtu ${iface.mtu}`);
        // 二层接口配置
        if (iface.portType) cmds.push(`${ifPrompt}port link-type ${iface.portType}`);
        if (iface.portAccessVlan) cmds.push(`${ifPrompt}port default vlan ${iface.portAccessVlan}`);
        if (iface.trunkAllow) cmds.push(`${ifPrompt}port trunk allow-pass vlan ${iface.trunkAllow}`);
        // Hybrid 端口
        if (iface.hybridPvid) cmds.push(`${ifPrompt}port hybrid pvid vlan ${iface.hybridPvid}`);
        if (iface.hybridUntag) cmds.push(`${ifPrompt}port hybrid untagged vlan ${iface.hybridUntag}`);
        if (iface.hybridTag) cmds.push(`${ifPrompt}port hybrid tagged vlan ${iface.hybridTag}`);
        // 子接口 dot1q
        if (iface.dot1qVid) cmds.push(`${ifPrompt}dot1q termination vid ${iface.dot1qVid}`);
        if (iface.arpBroadcast) cmds.push(`${ifPrompt}arp broadcast enable`);
        // Eth-Trunk 成员
        if (iface.ethTrunk) cmds.push(`${ifPrompt}eth-trunk ${iface.ethTrunk}`);
        // DHCP 中继/客户端
        if (iface.dhcpSelect) cmds.push(`${ifPrompt}dhcp select ${iface.dhcpSelect}`);
        if (iface.dhcpRelay) cmds.push(`${ifPrompt}dhcp relay server-ip ${iface.dhcpRelay}`);
        // ACL 应用
        if (iface.trafficFilter) cmds.push(`${ifPrompt}traffic-filter ${iface.trafficFilter.acl} ${iface.trafficFilter.dir}`);
        if (iface.aclGroup) cmds.push(`${ifPrompt}ip access-group ${iface.aclGroup.acl} ${iface.aclGroup.dir}`);
        // NAT
        if (iface.natOutbound) {
          cmds.push(`${ifPrompt}nat outbound ${iface.natOutbound.acl}` + (iface.natOutbound.pool ? ` address-group ${iface.natOutbound.pool}` : ''));
        }
        for (const ns of iface.natServers) cmds.push(`${ifPrompt}${ns}`);
        // 路由协议使能
        if (iface.isisEnable) cmds.push(`${ifPrompt}isis enable ${iface.isisEnable}`);
        if (iface.ospfEnable) cmds.push(`${ifPrompt}ospf enable ${iface.ospfEnable}`);
        // VRRP
        for (const v of iface.vrrp) cmds.push(`${ifPrompt}${v}`);
        // 接口使能
        if (iface.shutdown) {
          cmds.push(`${ifPrompt}shutdown`);
        } else if (iface.ip || iface.linkProtocol || iface.ipv6Addr || iface.portType) {
          cmds.push(`${ifPrompt}undo shutdown`);
        }
        cmds.push(`${ifPrompt}quit`);
      }
      if (cmds.length) {
        steps.push({
          title: '配置接口',
          desc: '为每个接口配置 IP 地址、描述、链路协议并使能',
          commands: cmds,
        });
      }
    }

    // ---- 步骤 4：配置 ISIS ----
    for (const isis of isisBlocks) {
      const cmds = [];
      cmds.push(`[${host}]isis ${isis.processId}`);
      const prompt = `[${host}-isis-${isis.processId}]`;
      const body = isis.rawBody;
      // 逐行解析，保证多 import-route / filter-policy 都被识别
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const levelM = trimmed.match(/^is-level\s+(\S+)/);
        if (levelM) { cmds.push(`${prompt}is-level ${levelM[1]}`); continue; }
        const netM = trimmed.match(/^network-entity\s+(\S+)/);
        if (netM) { cmds.push(`${prompt}network-entity ${netM[1]}`); continue; }
        const costStyleM = trimmed.match(/^cost-style\s+(.+)/);
        if (costStyleM) { cmds.push(`${prompt}cost-style ${costStyleM[1].trim()}`); continue; }
        const importM = trimmed.match(/^import-route\s+(.+)/);
        if (importM) { cmds.push(`${prompt}import-route ${importM[1].trim()}`); continue; }
        const filterM = trimmed.match(/^filter-policy\s+(.+)/);
        if (filterM) { cmds.push(`${prompt}filter-policy ${filterM[1].trim()}`); continue; }
        const prefM = trimmed.match(/^preference\s+(.+)/);
        if (prefM) { cmds.push(`${prompt}preference ${prefM[1].trim()}`); continue; }
        const flashM = trimmed.match(/^flash-flood\s+(.+)/);
        if (flashM) { cmds.push(`${prompt}flash-flood ${flashM[1].trim()}`); continue; }
        const silentM = trimmed.match(/^silent-interface\s+(.+)/);
        if (silentM) { cmds.push(`${prompt}silent-interface ${silentM[1].trim()}`); continue; }
      }
      cmds.push(`${prompt}quit`);
      steps.push({
        title: `配置 IS-IS 进程 ${isis.processId}`,
        desc: '创建 IS-IS 进程，设置级别和网络实体标题',
        commands: cmds,
      });
    }

    // ---- 步骤 5：配置 OSPF ----
    for (const ospf of ospfBlocks) {
      const cmds = [];
      cmds.push(`[${host}]ospf ${ospf.processId}` + (ospf.vpnInstance ? ` vpn-instance ${ospf.vpnInstance}` : '') + (ospf.routerId ? ` router-id ${ospf.routerId}` : ''));
      const prompt = `[${host}-ospf-${ospf.processId}]`;
      const body = ospf.rawBody;
      // 解析 area 块。area 子命令：network / authentication-mode / vlink-peer / stub / nssa /
      //   default-cost / abr-summary / range
      // 进程级命令：import-route / filter-policy / default-route-advertise / preference /
      //   silent-interface / bandwidth-reference / spf-delay / asbr-summary
      // 遇到进程级命令时退出 area 上下文，避免后续进程级命令被丢
      const areaLines = body.split('\n');
      let currentArea = '';
      let areaPrompt = '';
      const exitArea = () => { currentArea = ''; areaPrompt = ''; };
      for (const line of areaLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const areaM = trimmed.match(/^area\s+(\S+)/);
        if (areaM) {
          currentArea = areaM[1];
          areaPrompt = `[${host}-ospf-${ospf.processId}-area-${currentArea}]`;
          cmds.push(`${prompt}area ${currentArea}`);
          continue;
        }
        // area 子命令
        const netM = trimmed.match(/^network\s+(\S+)\s+(\S+)/);
        if (netM && currentArea) {
          cmds.push(`${areaPrompt}network ${netM[1]} ${netM[2]}`);
          continue;
        }
        const authM = trimmed.match(/^authentication-mode\s+(.+)/);
        if (authM && currentArea) {
          cmds.push(`${areaPrompt}authentication-mode ${authM[1].trim()}`);
          continue;
        }
        const vlinkM = trimmed.match(/^vlink-peer\s+(\S+)/);
        if (vlinkM && currentArea) {
          cmds.push(`${areaPrompt}vlink-peer ${vlinkM[1]}`);
          continue;
        }
        const stubM = trimmed.match(/^(stub|nssa)(\s+.*)?$/);
        if (stubM && currentArea) {
          cmds.push(`${areaPrompt}${stubM[1]}` + (stubM[2] ? stubM[2] : ''));
          continue;
        }
        const defaultCostM = trimmed.match(/^default-cost\s+(\S+)/);
        if (defaultCostM && currentArea) {
          cmds.push(`${areaPrompt}default-cost ${defaultCostM[1]}`);
          continue;
        }
        // 区域聚合路由：abr-summary X mask [advertise|not-advertise]
        const abrSumM = trimmed.match(/^abr-summary\s+(\S+)\s+(\S+)(.*)/);
        if (abrSumM && currentArea) {
          cmds.push(`${areaPrompt}abr-summary ${abrSumM[1]} ${abrSumM[2]}${abrSumM[3]}`);
          continue;
        }
        // ASBR 聚合：asbr-summary X mask
        const asbrSumM = trimmed.match(/^asbr-summary\s+(\S+)\s+(\S+)(.*)/);
        if (asbrSumM && currentArea) {
          cmds.push(`${areaPrompt}asbr-summary ${asbrSumM[1]} ${asbrSumM[2]}${asbrSumM[3]}`);
          continue;
        }
        // 进程级命令：遇到这些命令说明已退出 area 上下文
        const importM = trimmed.match(/^import-route\s+(.+)/);
        if (importM) {
          exitArea();
          cmds.push(`${prompt}import-route ${importM[1].trim()}`);
          continue;
        }
        const filterM = trimmed.match(/^filter-policy\s+(.+)/);
        if (filterM) {
          exitArea();
          cmds.push(`${prompt}filter-policy ${filterM[1].trim()}`);
          continue;
        }
        const defRouteM = trimmed.match(/^default-route-advertise\s*(.*)/);
        if (defRouteM) {
          exitArea();
          cmds.push(`${prompt}default-route-advertise${defRouteM[1] ? ' ' + defRouteM[1].trim() : ''}`);
          continue;
        }
        const silentM = trimmed.match(/^silent-interface\s+(.+)/);
        if (silentM) {
          exitArea();
          cmds.push(`${prompt}silent-interface ${silentM[1].trim()}`);
          continue;
        }
        const prefM = trimmed.match(/^preference\s+(.+)/);
        if (prefM) {
          exitArea();
          cmds.push(`${prompt}preference ${prefM[1].trim()}`);
          continue;
        }
        const spfM = trimmed.match(/^spf-delay(?:-intelligent)?\s+(.+)/);
        if (spfM) {
          exitArea();
          cmds.push(`${prompt}${trimmed}`);
          continue;
        }
        const bandwidthM = trimmed.match(/^bandwidth-reference\s+(.+)/);
        if (bandwidthM) {
          exitArea();
          cmds.push(`${prompt}${trimmed}`);
          continue;
        }
        const enableM = trimmed.match(/^enable\s+(.+)/);
        if (enableM) {
          exitArea();
          cmds.push(`${prompt}${trimmed}`);
          continue;
        }
      }
      cmds.push(`${prompt}quit`);
      steps.push({
        title: `配置 OSPF 进程 ${ospf.processId}` + (ospf.vpnInstance ? ` (VPN-instance: ${ospf.vpnInstance})` : ''),
        desc: '创建 OSPF 进程，设置 Router-ID，划分区域并宣告网段',
        commands: cmds,
      });
    }

    // ---- 步骤 6：配置 BGP ----
    for (const bgp of bgpBlocks) {
      const cmds = [];
      cmds.push(`[${host}]bgp ${bgp.asNumber}`);
      const prompt = `[${host}-bgp]`;
      const body = bgp.rawBody;
      const lines = body.split('\n');
      // 地址族子视图提示符管理：afPrompt 跟随当前所在视图（主视图 or ipv4/ipv6/vpnv4/vrf 地址族）
      let afPrompt = prompt;
      let currentAf = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // 地址族切换：ipv4-family unicast / vpnv4 / vpn-instance NAME
        const af4M = trimmed.match(/^ipv4-family\s+(unicast|vpnv4|vpn-instance\s+(\S+))/i);
        if (af4M) {
          if (currentAf) cmds.push(`${afPrompt}quit`);
          const kind = af4M[1].toLowerCase();
          if (kind === 'unicast') {
            currentAf = 'ipv4';
            afPrompt = `[${host}-bgp-af]`;
          } else if (kind === 'vpnv4') {
            currentAf = 'vpnv4';
            afPrompt = `[${host}-bgp-af-vpnv4]`;
          } else if (af4M[2]) {
            currentAf = `vrf-${af4M[2]}`;
            afPrompt = `[${host}-bgp-af-${af4M[2]}]`;
          }
          cmds.push(`${prompt}${trimmed}`);
          continue;
        }
        // ipv6-family unicast / vpnv6
        const af6M = trimmed.match(/^ipv6-family\s+(unicast|vpnv6)/i);
        if (af6M) {
          if (currentAf) cmds.push(`${afPrompt}quit`);
          currentAf = 'ipv6';
          afPrompt = `[${host}-bgp-af-ipv6]`;
          cmds.push(`${prompt}${trimmed}`);
          continue;
        }
        // peer X as-number Y (必须先于通用 peer X.* 匹配)
        const nbrM = trimmed.match(/^peer\s+(\S+)\s+as-number\s+(\S+)/);
        if (nbrM) { cmds.push(`${afPrompt}peer ${nbrM[1]} as-number ${nbrM[2]}`); continue; }
        // peer X 其它属性：reflect-client / next-hop-local / route-policy / description / password / keepalive / route-limit
        const peerAttrM = trimmed.match(/^peer\s+(\S+)\s+(reflect-client|next-hop-local|next-hop-remote|route-policy\s+\S+\s+\S+|description\s+.+|password\s+.+|keepalive\s+\S+\s+\S+|route-limit\s+\S+|connect-interface\s+\S+|preferred-value\s+\S+|allow-as-loop)/);
        if (peerAttrM) { cmds.push(`${afPrompt}peer ${peerAttrM[1]} ${peerAttrM[2]}`); continue; }
        // 通用 peer X ... 其它（如 peer X enable / peer X group）
        const peerOtherM = trimmed.match(/^peer\s+(\S+)\s+(.+)/);
        if (peerOtherM) { cmds.push(`${afPrompt}peer ${peerOtherM[1]} ${peerOtherM[2]}`); continue; }
        // network X [mask Y] [route-map Z]
        const netM = trimmed.match(/^network\s+(\S+)(?:\s+mask\s+(\S+))?(?:\s+(.+))?/);
        if (netM) {
          let cmd = `${afPrompt}network ${netM[1]}`;
          if (netM[2]) cmd += ` mask ${netM[2]}`;
          if (netM[3]) cmd += ` ${netM[3]}`;
          cmds.push(cmd);
          continue;
        }
        // aggregate X mask [detail] [as-set]
        const aggM = trimmed.match(/^aggregate\s+(\S+)\s+(\S+)(.*)/);
        if (aggM) { cmds.push(`${afPrompt}aggregate ${aggM[1]} ${aggM[2]}${aggM[3]}`); continue; }
        // import-route direct/static/ospf/isis [route-policy X]
        const importM = trimmed.match(/^import-route\s+(.+)/);
        if (importM) { cmds.push(`${afPrompt}import-route ${importM[1].trim()}`); continue; }
        // preferred-value / default local-preference
        const prefM = trimmed.match(/^(preferred-value|default\s+local-preference)\s+(.+)/);
        if (prefM) { cmds.push(`${afPrompt}${prefM[1]} ${prefM[2].trim()}`); continue; }
        // filter-policy X export/import
        const filterM = trimmed.match(/^filter-policy\s+(.+)/);
        if (filterM) { cmds.push(`${afPrompt}filter-policy ${filterM[1].trim()}`); continue; }
        // confederation / reflector cluster-id
        const confedM = trimmed.match(/^confederation\s+(.+)/);
        if (confedM) { cmds.push(`${afPrompt}confederation ${confedM[1].trim()}`); continue; }
        const reflectorM = trimmed.match(/^reflector\s+cluster-id\s+(.+)/);
        if (reflectorM) { cmds.push(`${afPrompt}reflector cluster-id ${reflectorM[1].trim()}`); continue; }
      }
      // 退出地址族（如果还在），再退出 BGP
      if (currentAf) cmds.push(`${afPrompt}quit`);
      cmds.push(`${prompt}quit`);
      steps.push({
        title: `配置 BGP AS ${bgp.asNumber}`,
        desc: '建立 BGP 进程，指定邻居 AS 并宣告网段',
        commands: cmds,
      });
    }

    // ---- 步骤 7：配置 RIP ----
    for (const rip of ripBlocks) {
      const cmds = [];
      cmds.push(`[${host}]rip ${rip.processId}`);
      const prompt = `[${host}-rip-${rip.processId}]`;
      const body = rip.rawBody;
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const netM = trimmed.match(/^network\s+(\S+)/);
        if (netM) { cmds.push(`${prompt}network ${netM[1]}`); continue; }
        const verM = trimmed.match(/^version\s+(\S+)/);
        if (verM) { cmds.push(`${prompt}version ${verM[1]}`); continue; }
        const sumM = trimmed.match(/^undo\s+summary/);
        if (sumM) { cmds.push(`${prompt}undo summary`); continue; }
        const peerM = trimmed.match(/^peer\s+(\S+)/);
        if (peerM) { cmds.push(`${prompt}peer ${peerM[1]}`); continue; }
        const silentM = trimmed.match(/^silent-interface\s+(\S+)/);
        if (silentM) { cmds.push(`${prompt}silent-interface ${silentM[1]}`); continue; }
        const defaultM = trimmed.match(/^default-route\s+originate/);
        if (defaultM) { cmds.push(`${prompt}default-route originate`); continue; }
        const importM = trimmed.match(/^import-route\s+(.+)/);
        if (importM) { cmds.push(`${prompt}import-route ${importM[1].trim()}`); continue; }
        const filterM = trimmed.match(/^filter-policy\s+(.+)/);
        if (filterM) { cmds.push(`${prompt}filter-policy ${filterM[1].trim()}`); continue; }
        const prefM = trimmed.match(/^preference\s+(.+)/);
        if (prefM) { cmds.push(`${prompt}preference ${prefM[1].trim()}`); continue; }
        const maxM = trimmed.match(/^maximum\s+(.+)/);
        if (maxM) { cmds.push(`${prompt}maximum ${maxM[1].trim()}`); continue; }
        const timersM = trimmed.match(/^timers\s+(.+)/);
        if (timersM) { cmds.push(`${prompt}timers ${timersM[1].trim()}`); continue; }
      }
      cmds.push(`${prompt}quit`);
      steps.push({
        title: `配置 RIP 进程 ${rip.processId}`,
        desc: '创建 RIP 进程，设置版本并宣告网段',
        commands: cmds,
      });
    }

    // ---- 步骤 8：配置静态路由 ----
    if (staticRoutes.length) {
      const cmds = [];
      for (const r of staticRoutes) {
        let cmd = `[${host}]ip route-static ${r.network} ${r.mask} ${r.nextHop}`;
        if (r.extra) cmd += ` ${r.extra}`;
        cmds.push(cmd);
      }
      steps.push({
        title: '配置静态路由',
        desc: '为非直连网段配置静态路由（含默认路由）',
        commands: cmds,
      });
    }

    // ---- 步骤 9：配置 ACL ----
    for (const acl of acls) {
      const cmds = [];
      // 入口命令：acl N / acl number N / acl name FOO [advance|basic]
      let aclPrompt;
      if (acl.isNamed) {
        // 命名 ACL：acl name FOO advance/basic
        const kind = acl.kind || 'advance';
        cmds.push(`[${host}]acl name ${acl.name} ${kind}`);
        aclPrompt = kind === 'basic'
          ? `[${host}-acl-basic-${acl.name}]`
          : `[${host}-acl-adv-${acl.name}]`;
      } else {
        cmds.push(`[${host}]acl ${acl.name}`);
        // 推断 ACL 提示符：数字 2000-2999 是 basic，3000-3999 是 advanced
        const numMatch = String(acl.name).match(/^(\d+)/);
        aclPrompt = `[${host}-acl-adv-${acl.name}]`;
        if (numMatch) {
          const num = parseInt(numMatch[1], 10);
          if (num >= 2000 && num <= 2999) aclPrompt = `[${host}-acl-basic-${acl.name}]`;
        }
      }
      for (const rule of acl.body) {
        const trimmed = rule.trim();
        if (trimmed.startsWith('rule')) cmds.push(`${aclPrompt}${trimmed}`);
      }
      cmds.push(`${aclPrompt}quit`);
      steps.push({
        title: `配置 ACL ${acl.name}`,
        desc: '创建访问控制列表并添加规则',
        commands: cmds,
      });
    }

    // ---- 步骤 10：配置 IPv6 静态路由 ----
    if (ipv6Routes.length) {
      const cmds = [];
      for (const r of ipv6Routes) {
        let cmd = `[${host}]ipv6 route-static ${r.prefix} ${r.mask}`;
        if (r.nextHop) cmd += ` ${r.nextHop}`;
        if (r.extra) cmd += ` ${r.extra}`;
        cmds.push(cmd);
      }
      steps.push({
        title: '配置 IPv6 静态路由',
        desc: '为 IPv6 网段配置静态路由',
        commands: cmds,
      });
    }

    // ---- 步骤 11：配置 NAT 地址组 ----
    if (natAddrGroups.length) {
      const cmds = [];
      for (const g of natAddrGroups) {
        cmds.push(`[${host}]nat address-group ${g.id} ${g.start} ${g.end}`);
      }
      steps.push({
        title: '配置 NAT 地址组',
        desc: '为 NAT Outbound 创建公网地址池',
        commands: cmds,
      });
    }

    // ---- 步骤 12：配置 DHCP 服务器地址池 ----
    if (dhcpPools.length) {
      const cmds = [];
      cmds.push(`[${host}]dhcp enable`);
      for (const pool of dhcpPools) {
        cmds.push(`[${host}]ip pool ${pool.name}`);
        const poolPrompt = `[${host}-ip-pool-${pool.name}]`;
        for (const line of pool.body) {
          cmds.push(`${poolPrompt}${line}`);
        }
        cmds.push(`${poolPrompt}quit`);
      }
      steps.push({
        title: '配置 DHCP 服务器地址池',
        desc: '启用 DHCP 服务并为各网段配置地址池（网关、DNS、租期）',
        commands: cmds,
      });
    }

    // ---- 步骤 13：配置 IP 前缀列表 ----
    if (ipPrefixes.length) {
      const cmds = [];
      for (const p of ipPrefixes) {
        cmds.push(`[${host}]ip ip-prefix ${p.name} index ${p.index} ${p.action} ${p.ip} ${p.mask}`);
      }
      steps.push({
        title: '配置 IP 前缀列表',
        desc: '用于路由过滤和策略匹配的精确前缀列表',
        commands: cmds,
      });
    }

    // ---- 步骤 14：配置路由策略 ----
    if (routePolicies.length) {
      const cmds = [];
      for (const rp of routePolicies) {
        cmds.push(`[${host}]route-policy ${rp.name} ${rp.action} node ${rp.node}`);
        cmds.push(`[${host}-route-policy-${rp.name}-${rp.node}]quit`);
      }
      steps.push({
        title: '配置路由策略',
        desc: 'route-policy 用于路由引入和过滤的策略控制',
        commands: cmds,
      });
    }

    // ---- 步骤 15：配置 STP ----
    if (stpModeM || stpPriM || stpEnableM) {
      const cmds = [];
      if (stpModeM) cmds.push(`[${host}]stp mode ${stpModeM[1]}`);
      if (stpPriM) cmds.push(`[${host}]stp priority ${stpPriM[1]}`);
      cmds.push(`[${host}]stp enable`);
      steps.push({
        title: '配置生成树协议',
        desc: '设置 STP 模式、优先级并使能，防止二层环路',
        commands: cmds,
      });
    }

    // ---- 步骤 16：配置 NTP ----
    if (ntpServers.length) {
      const cmds = [];
      for (const s of ntpServers) {
        cmds.push(`[${host}]ntp-service unicast-server ${s}`);
      }
      steps.push({
        title: '配置 NTP 时间同步',
        desc: '与上游 NTP 服务器同步系统时间',
        commands: cmds,
      });
    }

    // ---- 步骤 17：配置 SNMP ----
    if (snmpCommunities.length || snmpVerM) {
      const cmds = [];
      if (snmpVerM) cmds.push(`[${host}]snmp-agent sys-info version ${snmpVerM[1].trim()}`);
      if (snmpContactM) cmds.push(`[${host}]snmp-agent sys-info contact ${snmpContactM[1].trim()}`);
      if (snmpLocationM) cmds.push(`[${host}]snmp-agent sys-info location ${snmpLocationM[1].trim()}`);
      for (const c of snmpCommunities) {
        cmds.push(`[${host}]snmp-agent community ${c.access} ${c.name}`);
      }
      steps.push({
        title: '配置 SNMP',
        desc: '配置 SNMP 版本、联系人和只读/读写团体字',
        commands: cmds,
      });
    }

    // ---- 步骤 18：配置 AAA 与本地用户 ----
    if (localUsers.length || aaaDomainM) {
      const cmds = [];
      cmds.push(`[${host}]aaa`);
      const aaaPrompt = `[${host}-aaa]`;
      if (aaaDomainM) cmds.push(`${aaaPrompt}authentication-scheme ${aaaDomainM[1]}`);
      for (const u of localUsers) {
        cmds.push(`${aaaPrompt}local-user ${u.name} password ${u.cipher ? 'cipher' : 'simple'} ${u.password}`);
        if (u.services.length) cmds.push(`${aaaPrompt}local-user ${u.name} service-type ${u.services.join(' ')}`);
        if (u.level) cmds.push(`${aaaPrompt}local-user ${u.name} privilege level ${u.level}`);
      }
      cmds.push(`${aaaPrompt}quit`);
      steps.push({
        title: '配置 AAA 与本地用户',
        desc: '启用 AAA 认证，创建本地用户并分配服务类型与权限级别',
        commands: cmds,
      });
    }

    // ---- 步骤 19：配置 SSH/VTY ----
    if (sshEnabled || sshUsers.length || vtyLines.length) {
      const cmds = [];
      if (sshEnabled) cmds.push(`[${host}]stelnet server enable`);
      // 生成本地密钥（如果配了 ssh 通常需要）
      if (sshEnabled) {
        cmds.push(`[${host}]rsa local-key-pair create`);
        cmds.push(`# 按提示输入密钥长度（如 2048）`);
      }
      for (const su of sshUsers) {
        cmds.push(`[${host}]ssh user ${su.name} ${su.attr}`);
      }
      for (const v of vtyLines) {
        cmds.push(`[${host}]${v.header}`);
        const vtyPrompt = `[${host}-ui-${v.header.match(/vty|console/i)[0]}]`;
        for (const line of v.body) cmds.push(`${vtyPrompt}${line}`);
        cmds.push(`${vtyPrompt}quit`);
      }
      steps.push({
        title: '配置 SSH 与 VTY',
        desc: '使能 SSH 服务器、创建 SSH 用户并配置 VTY 用户界面认证方式',
        commands: cmds,
      });
    }

    // ---- 步骤 10：保存配置 ----
    steps.push({
      title: '退出并保存配置',
      desc: '返回用户视图并保存配置到设备',
      commands: [
        `[${host}]quit`,
        `<${host}>save`,
        `# 提示后输入 Y 确认保存`,
      ],
    });

    return steps;
  }

  // ============== Cisco IOS 配置过程生成 ==============
  function generateCiscoSteps(configText, devName, devType) {
    const steps = [];
    // 命令缩写归一化（int→interface / rou→router / ip add→ip address 等），避免缩写导致漏识别
    configText = normalizeAbbreviations(configText);
    // 提取 hostname
    const hostM = configText.match(/^\s*hostname\s+(\S+)/m);
    const host = hostM ? hostM[1] : (devName || 'Router');
    const defaultName = 'Router';

    // ---- 步骤 1：进入特权模式与全局配置模式 ----
    steps.push({
      title: '进入特权与全局配置模式',
      desc: '从用户 EXEC 模式进入特权 EXEC，再进入全局配置模式',
      commands: [
        `${defaultName}>enable`,
        `${defaultName}#configure terminal`,
        `Enter configuration commands, one per line. End with CNTL/Z.`,
        `${defaultName}(config)#hostname ${host}`,
        `${host}(config)#`,
      ],
    });

    const sections = splitConfigSections(configText, '!');

    const vlans = [];
    const interfaces = [];
    const ospfBlocks = [];
    const eigrpBlocks = [];
    const bgpBlocks = [];
    const ripBlocks = [];
    const staticRoutes = [];
    const acls = [];

    for (const sec of sections) {
      const h = sec.header;
      // VLAN：vlan 10 / vlan 20
      const vlanM = h.match(/^vlan\s+(\d+)/i);
      if (vlanM) {
        const body = sec.body.join('\n');
        const nameM = body.match(/^\s*name\s+(.+)$/m);
        vlans.push({ id: vlanM[1], name: nameM ? nameM[1].trim() : '' });
        continue;
      }
      // 接口
      const ifM = h.match(/^interface\s+(.+)$/i);
      if (ifM) {
        const ifName = ifM[1].trim();
        const body = sec.body.join('\n');
        const ipM = body.match(/^\s*ip\s+address\s+(\S+)\s+(\S+)/m);
        const descM = body.match(/^\s*description\s+(.+)$/m);
        const shutM = /shutdown/.test(body) && !/no\s+shutdown/.test(body);
        const duplexM = body.match(/^\s*duplex\s+(\S+)/m);
        const speedM = body.match(/^\s*speed\s+(\S+)/m);
        const swAccM = body.match(/^\s*switchport\s+access\s+vlan\s+(\S+)/m);
        const swModeM = body.match(/^\s*switchport\s+mode\s+(\S+)/m);
        const swTrunkM = body.match(/^\s*switchport\s+trunk\s+(?:allowed\s+)?vlan\s+(.+)$/m);
        // HSRP：standby N ip X.X.X.X / standby N priority N / standby N preempt / standby N track X
        const hsrpLines = body.split('\n')
          .map(l => l.trim())
          .filter(l => /^standby\s+\d+/i.test(l));
        // channel-group N mode active/passive/desirable/auto/on
        const channelM = body.match(/^\s*channel-group\s+(\S+)\s+mode\s+(\S+)/m);
        // DHCP relay / helper
        const helperM = body.match(/^\s*ip\s+helper-address\s+(\S+)/m);
        // ACL 应用
        const aclGroupM = body.match(/^\s*ip\s+access-group\s+(\S+)\s+(\S+)/m);
        // MTU
        const mtuM = body.match(/^\s*mtu\s+(\S+)/m);
        // IPv6
        const ipv6EnM = body.match(/^\s*ipv6\s+enable/m);
        const ipv6AddrM = body.match(/^\s*ipv6\s+address\s+(\S+)(?:\s+(\S+))?/m);
        // NAT inside/outside
        const natInM = /ip\s+nat\s+inside/i.test(body);
        const natOutM = /ip\s+nat\s+outside/i.test(body);
        // 子接口 encapsulation dot1Q N
        const dot1qM = body.match(/^\s*encapsulation\s+dot1[qQ]\s+(\S+)/m);
        // DHCP 客户端
        const dhcpClientM = body.match(/^\s*ip\s+address\s+dhcp/m);
        interfaces.push({
          name: ifName,
          ip: ipM ? ipM[1] : '',
          mask: ipM ? ipM[2] : '',
          desc: descM ? descM[1].trim() : '',
          shutdown: shutM,
          duplex: duplexM ? duplexM[1] : '',
          speed: speedM ? speedM[1] : '',
          swAccessVlan: swAccM ? swAccM[1] : '',
          swMode: swModeM ? swModeM[1] : '',
          swTrunkVlan: swTrunkM ? swTrunkM[1] : '',
          hsrp: hsrpLines,
          channelGroup: channelM ? { group: channelM[1], mode: channelM[2] } : null,
          helper: helperM ? helperM[1] : '',
          aclGroup: aclGroupM ? { acl: aclGroupM[1], dir: aclGroupM[2] } : null,
          mtu: mtuM ? mtuM[1] : '',
          ipv6Enable: !!ipv6EnM,
          ipv6Addr: ipv6AddrM ? ipv6AddrM[1] : '',
          ipv6Mask: ipv6AddrM ? (ipv6AddrM[2] || '') : '',
          natInside: natInM,
          natOutside: natOutM,
          dot1qVlan: dot1qM ? dot1qM[1] : '',
          dhcpClient: !!dhcpClientM,
          rawBody: body,
        });
        continue;
      }
      // OSPF（支持 vrf NAME）
      const ospfM = h.match(/^router\s+ospf\s+(\d+)(?:\s+vrf\s+(\S+))?/i);
      if (ospfM) {
        ospfBlocks.push({
          processId: ospfM[1],
          vrf: ospfM[2] || '',
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // EIGRP
      const eigrpM = h.match(/^router\s+eigrp\s+(\d+)/i);
      if (eigrpM) {
        eigrpBlocks.push({
          asNumber: eigrpM[1],
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // BGP
      const bgpM = h.match(/^router\s+bgp\s+(\d+)/i);
      if (bgpM) {
        bgpBlocks.push({
          asNumber: bgpM[1],
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // RIP
      const ripM = h.match(/^router\s+rip\b/i);
      if (ripM) {
        ripBlocks.push({
          body: sec.body,
          rawBody: sec.body.join('\n'),
        });
        continue;
      }
      // ACL：命名 ACL（ip access-list standard|extended NAME）— 整段 body 都是该 ACL 的规则
      const aclNamedM = h.match(/^ip\s+access-list\s+(standard|extended)\s+(\S+)/i);
      if (aclNamedM) {
        acls.push({ name: aclNamedM[2], kind: aclNamedM[1], body: sec.body, isNamed: true });
        continue;
      }
      // 编号 ACL（access-list N permit/deny ...）不在这里处理，下面用全局正则扫描并按编号分组
      // （否则同一 ! 段内多条 access-list N 只会命中第一条，其余被丢）
      // 静态路由也改用全局正则扫描，避免 ip route 跟在 ip classless 等命令后时漏掉
    }

    // 全局扫描编号 ACL：access-list N permit/deny ...，按编号分组
    const aclNumRe = /^\s*access-list\s+(\d+)\s+(.+)$/gm;
    const numberedAcls = {};
    let aclNumM;
    while ((aclNumM = aclNumRe.exec(configText)) !== null) {
      const num = aclNumM[1];
      if (!numberedAcls[num]) numberedAcls[num] = [];
      numberedAcls[num].push(aclNumM[2].trim());
    }
    for (const num of Object.keys(numberedAcls)) {
      acls.push({ name: num, body: numberedAcls[num], isNamed: false });
    }

    // 全局扫描静态路由：ip route N M nextHop [extra]
    const routeRe = /^\s*ip\s+route\s+(\S+)\s+(\S+)\s+(\S+)(?:\s+(.+))?$/gm;
    let routeM;
    while ((routeM = routeRe.exec(configText)) !== null) {
      staticRoutes.push({
        network: routeM[1],
        mask: routeM[2],
        nextHop: routeM[3],
        extra: routeM[4] || '',
      });
    }

    // IPv6 静态路由：ipv6 route X::X/N nextHop
    const ipv6Routes = [];
    const ipv6RouteRe = /^\s*ipv6\s+route\s+(\S+)\s+(\S+)(?:\s+(\S+)(?:\s+(.+))?)?$/gm;
    let ipv6Rm;
    while ((ipv6Rm = ipv6RouteRe.exec(configText)) !== null) {
      ipv6Routes.push({
        prefix: ipv6Rm[1],
        mask: ipv6Rm[2] || '',
        nextHop: ipv6Rm[3] || '',
        extra: ipv6Rm[4] || '',
      });
    }

    // NAT 地址池：ip nat pool NAME START END netmask M [type rotary]
    const natPools = [];
    const natPoolRe = /^\s*ip\s+nat\s+pool\s+(\S+)\s+(\S+)\s+(\S+)\s+netmask\s+(\S+)/gm;
    let natPoolM;
    while ((natPoolM = natPoolRe.exec(configText)) !== null) {
      natPools.push({ name: natPoolM[1], start: natPoolM[2], end: natPoolM[3], mask: natPoolM[4] });
    }
    // NAT 规则：ip nat inside source list N pool NAME [overload] / ip nat inside source static X X
    const natRules = [];
    const natRuleRe = /^\s*ip\s+nat\s+inside\s+source\s+(list\s+(\S+)\s+pool\s+(\S+)(\s+overload)?|static\s+(\S+)\s+(\S+))/gm;
    let natRuleM;
    while ((natRuleM = natRuleRe.exec(configText)) !== null) {
      if (natRuleM[2]) {
        natRules.push({ type: 'dynamic', acl: natRuleM[2], pool: natRuleM[3], overload: !!natRuleM[4] });
      } else {
        natRules.push({ type: 'static', inside: natRuleM[5], outside: natRuleM[6] });
      }
    }

    // DHCP 地址池：ip dhcp pool NAME
    const dhcpPools = [];
    const lines = configText.split(/\r?\n/);
    let curPool = null;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const poolM = t.match(/^ip\s+dhcp\s+pool\s+(\S+)/i);
      if (poolM) {
        curPool = { name: poolM[1], body: [] };
        dhcpPools.push(curPool);
        continue;
      }
      if (curPool && /^(network|default-router|dns-server|lease|domain-name|netbios-name-server|next-server|hardware-address|host)/i.test(t)) {
        curPool.body.push(t);
      }
      if (curPool && /^!/.test(t)) {
        curPool = null;
      }
    }
    // DHCP 排除地址：ip dhcp excluded-address X [Y]
    const dhcpExcluded = [];
    const dhcpExRe = /^\s*ip\s+dhcp\s+excluded-address\s+(\S+)(?:\s+(\S+))?/gm;
    let dhcpExM;
    while ((dhcpExM = dhcpExRe.exec(configText)) !== null) {
      dhcpExcluded.push({ start: dhcpExM[1], end: dhcpExM[2] || dhcpExM[1] });
    }

    // NTP：ntp server X
    const ntpServers = [];
    const ntpRe = /^\s*ntp\s+server\s+(\S+)/gm;
    let ntpM;
    while ((ntpM = ntpRe.exec(configText)) !== null) ntpServers.push(ntpM[1]);

    // SNMP
    const snmpCommunities = [];
    const snmpCommRe = /^\s*snmp-server\s+community\s+(\S+)\s+(RO|RW)/gm;
    let snmpM;
    while ((snmpM = snmpCommRe.exec(configText)) !== null) {
      snmpCommunities.push({ name: snmpM[1], access: snmpM[2] });
    }
    const snmpLocationM = configText.match(/^\s*snmp-server\s+location\s+(.+)$/m);
    const snmpContactM = configText.match(/^\s*snmp-server\s+contact\s+(.+)$/m);

    // STP
    const stpModeM = configText.match(/^\s*spanning-tree\s+mode\s+(\S+)/m);
    const stpPriM = configText.match(/^\s*spanning-tree\s+vlan\s+\S+\s+priority\s+(\S+)/m);
    const stpPriAllM = configText.match(/^\s*spanning-tree\s+priority\s+(\S+)/m);

    // 路由映射：route-map NAME permit/deny N
    const routeMaps = [];
    const rmRe = /^route-map\s+(\S+)\s+(permit|deny)\s+(\d+)/gmi;
    let rmM;
    while ((rmM = rmRe.exec(configText)) !== null) {
      routeMaps.push({ name: rmM[1], action: rmM[2], node: rmM[3] });
    }

    // 前缀列表：ip prefix-list NAME seq N permit/deny X/Y
    const prefixLists = [];
    const plRe = /^ip\s+prefix-list\s+(\S+)\s+seq\s+(\d+)\s+(permit|deny)\s+(\S+)(?:\s+(\S+))?/gmi;
    let plM;
    while ((plM = plRe.exec(configText)) !== null) {
      prefixLists.push({ name: plM[1], seq: plM[2], action: plM[3], prefix: plM[4], mask: plM[5] || '' });
    }

    // AAA + 本地用户
    const aaaEnabled = /aaa\s+new-model/i.test(configText);
    const aaaAuthM = configText.match(/^\s*aaa\s+authentication\s+(\S+)\s+(\S+)\s+(.+)/m);
    const aaaAuthenM = configText.match(/^\s*aaa\s+authentication\s+login\s+(default|\S+)\s+(.+)/m);
    const aaaAuthorM = configText.match(/^\s*aaa\s+authorization\s+exec\s+(default|\S+)\s+(.+)/m);
    const localUsers = [];
    const userMap = {};
    for (const line of lines) {
      const t = line.trim();
      // username NAME [privilege N] (password|secret) [TYPE] PASS
      // 例如：username admin secret 0 AdminPass
      //      username admin privilege 15 secret 0 AdminPass
      //      username admin password AdminPass
      const luM = t.match(/^username\s+(\S+)\s+(?:(privilege)\s+(\d+)\s+)?(password|secret)(?:\s+(\d+))?\s+(\S+)/i);
      if (luM) {
        const name = luM[1];
        const hasInlinePriv = luM[2] === 'privilege';
        const inlineLevel = luM[3] || '';
        const secretType = luM[4]; // password 或 secret
        const encType = luM[5] || ''; // 0/5/7 等
        const password = luM[6];
        if (!userMap[name]) {
          userMap[name] = { name, type: secretType, encType, password, level: '' };
          localUsers.push(userMap[name]);
        } else {
          userMap[name].type = secretType;
          userMap[name].encType = encType;
          userMap[name].password = password;
        }
        if (hasInlinePriv) userMap[name].level = inlineLevel;
        continue;
      }
      // 单独的 username NAME privilege N（不和 password 在同一行）
      const luPrivOnlyM = t.match(/^username\s+(\S+)\s+privilege\s+(\d+)/i);
      if (luPrivOnlyM) {
        const name = luPrivOnlyM[1];
        if (!userMap[name]) {
          userMap[name] = { name, type: '', encType: '', password: '', level: luPrivOnlyM[2] };
          localUsers.push(userMap[name]);
        } else {
          userMap[name].level = luPrivOnlyM[2];
        }
      }
    }

    // VTY/Console：line vty 0 4 / login local / transport input ssh / password X
    const vtyLines = [];
    let inLine = false;
    for (const line of lines) {
      const t = line.trim();
      if (/^line\s+(vty|con|aux)\s+/i.test(t)) {
        inLine = true;
        vtyLines.push({ header: t, body: [] });
        continue;
      }
      if (inLine) {
        if (/^!/.test(t) || /^(interface|router|ip\s+dhcp|access-list|ip\s+nat)/i.test(t)) {
          inLine = false;
        } else {
          vtyLines[vtyLines.length - 1].body.push(t);
        }
      }
    }

    // SSH：ip ssh / crypto key generate rsa
    const sshEnabled = /ip\s+ssh\s+(server-enable|version|timeout|authentication)/i.test(configText)
      || /crypto\s+key\s+generate\s+rsa/i.test(configText);
    const sshVersionM = configText.match(/^\s*ip\s+ssh\s+version\s+(\S+)/m);
    const sshTimeoutM = configText.match(/^\s*ip\s+ssh\s+time-out\s+(\S+)/m);

    // ---- 步骤 2：创建 VLAN ----
    if (vlans.length) {
      const cmds = [];
      for (const v of vlans) {
        cmds.push(`${host}(config)#vlan ${v.id}`);
        if (v.name) cmds.push(`${host}(config-vlan)#name ${v.name}`);
        cmds.push(`${host}(config-vlan)#exit`);
      }
      steps.push({
        title: '创建 VLAN',
        desc: '在交换机上创建 VLAN 并命名',
        commands: cmds,
      });
    }

    // ---- 步骤 3：配置接口 ----
    if (interfaces.length) {
      const cmds = [];
      for (const iface of interfaces) {
        // 跳过 Vlan1 等无配置接口
        if (!iface.ip && !iface.desc && !iface.swAccessVlan && !iface.swMode &&
            !iface.swTrunkVlan && iface.rawBody.trim() === '') continue;
        if (/^vlan\d+$/i.test(iface.name) && !iface.ip) continue;

        cmds.push(`${host}(config)#interface ${iface.name}`);
        const ifPrompt = `${host}(config-if)#`;
        if (iface.desc) cmds.push(`${ifPrompt}description ${iface.desc}`);
        // 子接口封装 dot1Q
        if (iface.dot1qVlan) cmds.push(`${ifPrompt}encapsulation dot1Q ${iface.dot1qVlan}`);
        // IP / DHCP 客户端
        if (iface.dhcpClient) {
          cmds.push(`${ifPrompt}ip address dhcp`);
        } else if (iface.ip && iface.mask) {
          cmds.push(`${ifPrompt}ip address ${iface.ip} ${iface.mask}`);
        }
        // IPv6
        if (iface.ipv6Enable) cmds.push(`${ifPrompt}ipv6 enable`);
        if (iface.ipv6Addr) {
          cmds.push(`${ifPrompt}ipv6 address ${iface.ipv6Addr}` + (iface.ipv6Mask ? ` ${iface.ipv6Mask}` : ''));
        }
        // MTU
        if (iface.mtu) cmds.push(`${ifPrompt}mtu ${iface.mtu}`);
        if (iface.duplex) cmds.push(`${ifPrompt}duplex ${iface.duplex}`);
        if (iface.speed) cmds.push(`${ifPrompt}speed ${iface.speed}`);
        // 二层接口配置
        if (iface.swMode) cmds.push(`${ifPrompt}switchport mode ${iface.swMode}`);
        if (iface.swAccessVlan) cmds.push(`${ifPrompt}switchport access vlan ${iface.swAccessVlan}`);
        if (iface.swTrunkVlan) cmds.push(`${ifPrompt}switchport trunk allowed vlan ${iface.swTrunkVlan}`);
        // channel-group
        if (iface.channelGroup) cmds.push(`${ifPrompt}channel-group ${iface.channelGroup.group} mode ${iface.channelGroup.mode}`);
        // DHCP 中继
        if (iface.helper) cmds.push(`${ifPrompt}ip helper-address ${iface.helper}`);
        // ACL 应用
        if (iface.aclGroup) cmds.push(`${ifPrompt}ip access-group ${iface.aclGroup.acl} ${iface.aclGroup.dir}`);
        // NAT inside/outside
        if (iface.natInside) cmds.push(`${ifPrompt}ip nat inside`);
        if (iface.natOutside) cmds.push(`${ifPrompt}ip nat outside`);
        // HSRP
        for (const h of iface.hsrp) cmds.push(`${ifPrompt}${h}`);
        // 接口使能
        if (iface.shutdown) {
          cmds.push(`${ifPrompt}shutdown`);
        } else if (iface.ip || iface.swAccessVlan || iface.swMode) {
          cmds.push(`${ifPrompt}no shutdown`);
        }
        cmds.push(`${ifPrompt}exit`);
      }
      if (cmds.length) {
        steps.push({
          title: '配置接口',
          desc: '为每个接口配置 IP 地址、描述、双工/速率并使能',
          commands: cmds,
        });
      }
    }

    // ---- 步骤 4：配置 OSPF ----
    for (const ospf of ospfBlocks) {
      const cmds = [];
      cmds.push(`${host}(config)#router ospf ${ospf.processId}` + (ospf.vrf ? ` vrf ${ospf.vrf}` : ''));
      const prompt = `${host}(config-router)#`;
      const body = ospf.rawBody;
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // network X wildcard area Y
        const netM = trimmed.match(/^network\s+(\S+)\s+(\S+)\s+area\s+(\S+)/);
        if (netM) { cmds.push(`${prompt}network ${netM[1]} ${netM[2]} area ${netM[3]}`); continue; }
        // area N stub / area N nssa / area N range X Y
        const areaStubM = trimmed.match(/^area\s+(\S+)\s+(stub|nssa)(\s+no-summary)?/);
        if (areaStubM) {
          cmds.push(`${prompt}area ${areaStubM[1]} ${areaStubM[2]}` + (areaStubM[3] ? areaStubM[3] : ''));
          continue;
        }
        const areaRangeM = trimmed.match(/^area\s+(\S+)\s+range\s+(\S+)\s+(\S+)/);
        if (areaRangeM) { cmds.push(`${prompt}area ${areaRangeM[1]} range ${areaRangeM[2]} ${areaRangeM[3]}`); continue; }
        // area N virtual-link RID
        const vlinkM = trimmed.match(/^area\s+(\S+)\s+virtual-link\s+(\S+)/);
        if (vlinkM) { cmds.push(`${prompt}area ${vlinkM[1]} virtual-link ${vlinkM[2]}`); continue; }
        // area N authentication
        const areaAuthM = trimmed.match(/^area\s+(\S+)\s+authentication(\s+\S+)?/);
        if (areaAuthM) { cmds.push(`${prompt}area ${areaAuthM[1]} authentication` + (areaAuthM[2] || '')); continue; }
        // 进程级命令：redistribute / passive-interface / default-information / router-id / auto-cost
        const redistM = trimmed.match(/^redistribute\s+(.+)/);
        if (redistM) { cmds.push(`${prompt}redistribute ${redistM[1].trim()}`); continue; }
        const passiveM = trimmed.match(/^passive-interface\s+(.+)/);
        if (passiveM) { cmds.push(`${prompt}passive-interface ${passiveM[1].trim()}`); continue; }
        const defInfoM = trimmed.match(/^default-information\s+originate(\s+.+)?/);
        if (defInfoM) { cmds.push(`${prompt}default-information originate` + (defInfoM[1] || '')); continue; }
        const ridM = trimmed.match(/^router-id\s+(\S+)/);
        if (ridM) { cmds.push(`${prompt}router-id ${ridM[1]}`); continue; }
        const autoCostM = trimmed.match(/^auto-cost\s+reference-bandwidth\s+(\S+)/);
        if (autoCostM) { cmds.push(`${prompt}auto-cost reference-bandwidth ${autoCostM[1]}`); continue; }
        const logM = trimmed.match(/^log-adjacency-changes(\s+detail)?/);
        if (logM) { cmds.push(`${prompt}log-adjacency-changes` + (logM[1] || '')); continue; }
        const defaultM = trimmed.match(/^default-metric\s+(\S+)/);
        if (defaultM) { cmds.push(`${prompt}default-metric ${defaultM[1]}`); continue; }
        const distanceM = trimmed.match(/^distance\s+ospf\s+(.+)/);
        if (distanceM) { cmds.push(`${prompt}distance ospf ${distanceM[1].trim()}`); continue; }
        const maxM = trimmed.match(/^maximum-paths\s+(\S+)/);
        if (maxM) { cmds.push(`${prompt}maximum-paths ${maxM[1]}`); continue; }
      }
      cmds.push(`${prompt}exit`);
      steps.push({
        title: `配置 OSPF 进程 ${ospf.processId}` + (ospf.vrf ? ` (VRF: ${ospf.vrf})` : ''),
        desc: '创建 OSPF 进程并宣告网段到对应区域',
        commands: cmds,
      });
    }

    // ---- 步骤 4.5：配置 EIGRP ----
    for (const eigrp of eigrpBlocks) {
      const cmds = [];
      cmds.push(`${host}(config)#router eigrp ${eigrp.asNumber}`);
      const prompt = `${host}(config-router)#`;
      const body = eigrp.rawBody;
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const netM = trimmed.match(/^network\s+(\S+)(?:\s+(\S+))?/);
        if (netM) { cmds.push(`${prompt}network ${netM[1]}` + (netM[2] ? ` ${netM[2]}` : '')); continue; }
        const redistM = trimmed.match(/^redistribute\s+(.+)/);
        if (redistM) { cmds.push(`${prompt}redistribute ${redistM[1].trim()}`); continue; }
        const passiveM = trimmed.match(/^passive-interface\s+(.+)/);
        if (passiveM) { cmds.push(`${prompt}passive-interface ${passiveM[1].trim()}`); continue; }
        const noAutoM = trimmed.match(/^no\s+auto-summary/);
        if (noAutoM) { cmds.push(`${prompt}no auto-summary`); continue; }
        const autoM = trimmed.match(/^auto-summary/);
        if (autoM) { cmds.push(`${prompt}auto-summary`); continue; }
        const ridM = trimmed.match(/^eigrp\s+router-id\s+(\S+)/);
        if (ridM) { cmds.push(`${prompt}eigrp router-id ${ridM[1]}`); continue; }
        const metricM = trimmed.match(/^metric\s+weights\s+(.+)/);
        if (metricM) { cmds.push(`${prompt}metric weights ${metricM[1].trim()}`); continue; }
        const defInfoM = trimmed.match(/^redistribute\s+static/);
        if (defInfoM) { cmds.push(`${prompt}redistribute static`); continue; }
      }
      cmds.push(`${prompt}exit`);
      steps.push({
        title: `配置 EIGRP AS ${eigrp.asNumber}`,
        desc: '创建 EIGRP 进程并宣告网段',
        commands: cmds,
      });
    }

    // ---- 步骤 5：配置 BGP ----
    for (const bgp of bgpBlocks) {
      const cmds = [];
      cmds.push(`${host}(config)#router bgp ${bgp.asNumber}`);
      const prompt = `${host}(config-router)#`;
      const body = bgp.rawBody;
      const lines = body.split('\n');
      // 地址族子视图提示符管理：afPrompt 跟随当前所在视图
      let afPrompt = prompt;
      let currentAf = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // address-family ipv4/ipv6/vpnv4/vpnv6 [vrf NAME] [unicast]
        const afM = trimmed.match(/^address-family\s+(ipv4|ipv6|vpnv4|vpnv6)(?:\s+vrf\s+(\S+))?(?:\s+(unicast|multicast))?/i);
        if (afM) {
          if (currentAf) cmds.push(`${afPrompt}exit-address-family`);
          currentAf = afM[2] ? `vrf-${afM[2]}` : (afM[3] || afM[1]);
          afPrompt = `${host}(config-router-af)#`;
          cmds.push(`${prompt}${trimmed}`);
          continue;
        }
        // exit-address-family 退出地址族
        const exitAfM = trimmed.match(/^exit-address-family/i);
        if (exitAfM) {
          if (currentAf) { cmds.push(`${afPrompt}exit-address-family`); currentAf = ''; afPrompt = prompt; }
          continue;
        }
        // neighbor X remote-as Y（先于通用 neighbor X.* 匹配）
        const nbrM = trimmed.match(/^neighbor\s+(\S+)\s+remote-as\s+(\S+)/);
        if (nbrM) { cmds.push(`${afPrompt}neighbor ${nbrM[1]} remote-as ${nbrM[2]}`); continue; }
        // neighbor X 其它属性
        const nbrAttrM = trimmed.match(/^neighbor\s+(\S+)\s+(next-hop-self|route-reflector-client|send-community|soft-reconfiguration\s+inbound|update-source\s+\S+|description\s+.+|password\s+.+|timers\s+\S+\s+\S+|distribute-list\s+\S+\s+\S+|route-map\s+\S+\s+\S+|prefix-list\s+\S+\s+\S+|maximum-prefix\s+\S+|shutdown|activate)/);
        if (nbrAttrM) { cmds.push(`${afPrompt}neighbor ${nbrAttrM[1]} ${nbrAttrM[2]}`); continue; }
        // network X [mask Y] [route-map Z]
        const netM = trimmed.match(/^network\s+(\S+)(?:\s+mask\s+(\S+))?(?:\s+(.+))?/);
        if (netM) {
          let cmd = `${afPrompt}network ${netM[1]}`;
          if (netM[2]) cmd += ` mask ${netM[2]}`;
          if (netM[3]) cmd += ` ${netM[3]}`;
          cmds.push(cmd);
          continue;
        }
        // aggregate-address X Y [summary-only] [as-set]
        const aggM = trimmed.match(/^aggregate-address\s+(\S+)\s+(\S+)(.*)/);
        if (aggM) { cmds.push(`${afPrompt}aggregate-address ${aggM[1]} ${aggM[2]}${aggM[3]}`); continue; }
        // redistribute direct/connected/static/ospf/eigrp/rip
        const redistM = trimmed.match(/^redistribute\s+(.+)/);
        if (redistM) { cmds.push(`${afPrompt}redistribute ${redistM[1].trim()}`); continue; }
        const noSyncM = trimmed.match(/^no\s+synchronization/);
        if (noSyncM) { cmds.push(`${afPrompt}no synchronization`); continue; }
        const noAutoM = trimmed.match(/^no\s+auto-summary/);
        if (noAutoM) { cmds.push(`${afPrompt}no auto-summary`); continue; }
        const logM = trimmed.match(/^bgp\s+log-neighbor-changes/);
        if (logM) { cmds.push(`${afPrompt}bgp log-neighbor-changes`); continue; }
        const defInfoM = trimmed.match(/^default-information\s+originate/);
        if (defInfoM) { cmds.push(`${afPrompt}default-information originate`); continue; }
        const defaultM = trimmed.match(/^default-metric\s+(\S+)/);
        if (defaultM) { cmds.push(`${afPrompt}default-metric ${defaultM[1]}`); continue; }
        const maxPathM = trimmed.match(/^maximum-paths\s+(\S+)/);
        if (maxPathM) { cmds.push(`${afPrompt}maximum-paths ${maxPathM[1]}`); continue; }
      }
      // 退出地址族（如果还在），再退出 BGP
      if (currentAf) cmds.push(`${afPrompt}exit-address-family`);
      cmds.push(`${prompt}exit`);
      steps.push({
        title: `配置 BGP AS ${bgp.asNumber}`,
        desc: '建立 BGP 进程，指定邻居 AS 并宣告网段',
        commands: cmds,
      });
    }

    // ---- 步骤 6：配置 RIP ----
    for (const rip of ripBlocks) {
      const cmds = [];
      cmds.push(`${host}(config)#router rip`);
      const prompt = `${host}(config-router)#`;
      const body = rip.rawBody;
      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const netM = trimmed.match(/^network\s+(\S+)/);
        if (netM) { cmds.push(`${prompt}network ${netM[1]}`); continue; }
        const verM = trimmed.match(/^version\s+(\S+)/);
        if (verM) { cmds.push(`${prompt}version ${verM[1]}`); continue; }
        const noAutoM = trimmed.match(/^no\s+auto-summary/);
        if (noAutoM) { cmds.push(`${prompt}no auto-summary`); continue; }
        const passiveM = trimmed.match(/^passive-interface\s+(.+)/);
        if (passiveM) { cmds.push(`${prompt}passive-interface ${passiveM[1].trim()}`); continue; }
        const redistM = trimmed.match(/^redistribute\s+(.+)/);
        if (redistM) { cmds.push(`${prompt}redistribute ${redistM[1].trim()}`); continue; }
        const defInfoM = trimmed.match(/^default-information\s+originate/);
        if (defInfoM) { cmds.push(`${prompt}default-information originate`); continue; }
        const nbrM = trimmed.match(/^neighbor\s+(\S+)/);
        if (nbrM) { cmds.push(`${prompt}neighbor ${nbrM[1]}`); continue; }
        const defMetricM = trimmed.match(/^default-metric\s+(\S+)/);
        if (defMetricM) { cmds.push(`${prompt}default-metric ${defMetricM[1]}`); continue; }
        const timersM = trimmed.match(/^timers\s+basic\s+(.+)/);
        if (timersM) { cmds.push(`${prompt}timers basic ${timersM[1].trim()}`); continue; }
        const maxPathM = trimmed.match(/^maximum-paths\s+(\S+)/);
        if (maxPathM) { cmds.push(`${prompt}maximum-paths ${maxPathM[1]}`); continue; }
      }
      cmds.push(`${prompt}exit`);
      steps.push({
        title: '配置 RIP',
        desc: '创建 RIP 进程并宣告网段',
        commands: cmds,
      });
    }

    // ---- 步骤 7：配置静态路由 ----
    if (staticRoutes.length) {
      const cmds = [];
      for (const r of staticRoutes) {
        let cmd = `${host}(config)#ip route ${r.network} ${r.mask} ${r.nextHop}`;
        if (r.extra) cmd += ` ${r.extra}`;
        cmds.push(cmd);
      }
      steps.push({
        title: '配置静态路由',
        desc: '为非直连网段配置静态路由（含默认路由）',
        commands: cmds,
      });
    }

    // ---- 步骤 8：配置 ACL ----
    for (const acl of acls) {
      const cmds = [];
      // 命名 ACL（isNamed === true）进入子模式；编号 ACL（isNamed === false）直接全局配置
      const isNamed = acl.isNamed !== false;
      // 推断命名 ACL 的 standard/extended
      let aclType = 'extended';
      if (isNamed) {
        // 命名 ACL 的 kind 字段可能在解析时已记录
        if (acl.kind === 'standard') aclType = 'standard';
        // 否则用编号范围推断：编号 ACL 1-99/1300-1999 是 standard，100-199/2000-2699 是 extended
        const numStr = String(acl.name).match(/^(\d+)/);
        if (numStr) {
          const n = parseInt(numStr[1], 10);
          if ((n >= 1 && n <= 99) || (n >= 1300 && n <= 1999)) aclType = 'standard';
        }
      } else {
        // 编号 ACL 提示符不变
      }
      if (isNamed) {
        cmds.push(`${host}(config)#ip access-list ${aclType} ${acl.name}`);
      }
      const prompt = isNamed
        ? (aclType === 'standard' ? `${host}(config-std-nacl)#` : `${host}(config-ext-nacl)#`)
        : `${host}(config)#`;
      for (const rule of acl.body) {
        const trimmed = rule.trim();
        if (!trimmed) continue;
        if (isNamed) {
          cmds.push(`${prompt}${trimmed}`);
        } else {
          cmds.push(`${prompt}access-list ${acl.name} ${trimmed}`);
        }
      }
      if (isNamed) cmds.push(`${prompt}exit`);
      steps.push({
        title: `配置 ACL ${acl.name}`,
        desc: '创建访问控制列表并添加规则',
        commands: cmds,
      });
    }

    // ---- 步骤 9：配置 IPv6 静态路由 ----
    if (ipv6Routes.length) {
      const cmds = [];
      for (const r of ipv6Routes) {
        let cmd = `${host}(config)#ipv6 route ${r.prefix} ${r.mask}`;
        if (r.nextHop) cmd += ` ${r.nextHop}`;
        if (r.extra) cmd += ` ${r.extra}`;
        cmds.push(cmd);
      }
      steps.push({
        title: '配置 IPv6 静态路由',
        desc: '为 IPv6 网段配置静态路由',
        commands: cmds,
      });
    }

    // ---- 步骤 10：配置 NAT ----
    if (natPools.length || natRules.length) {
      const cmds = [];
      // 先定义 NAT 池
      for (const p of natPools) {
        cmds.push(`${host}(config)#ip nat pool ${p.name} ${p.start} ${p.end} netmask ${p.mask}`);
      }
      // 再定义 NAT 规则
      for (const r of natRules) {
        if (r.type === 'dynamic') {
          cmds.push(`${host}(config)#ip nat inside source list ${r.acl} pool ${r.pool}` + (r.overload ? ' overload' : ''));
        } else {
          cmds.push(`${host}(config)#ip nat inside source static ${r.inside} ${r.outside}`);
        }
      }
      cmds.push(`# 注意：接口视图下还需用 ip nat inside / ip nat outside 指明内外侧接口`);
      steps.push({
        title: '配置 NAT',
        desc: '定义 NAT 地址池和动态/静态映射规则',
        commands: cmds,
      });
    }

    // ---- 步骤 11：配置 DHCP 服务器 ----
    if (dhcpPools.length || dhcpExcluded.length) {
      const cmds = [];
      // service dhcp（一般默认开启，明确写出来）
      cmds.push(`${host}(config)#service dhcp`);
      for (const ex of dhcpExcluded) {
        cmds.push(`${host}(config)#ip dhcp excluded-address ${ex.start}` + (ex.end !== ex.start ? ` ${ex.end}` : ''));
      }
      for (const pool of dhcpPools) {
        cmds.push(`${host}(config)#ip dhcp pool ${pool.name}`);
        const poolPrompt = `${host}(dhcp-config)#`;
        for (const line of pool.body) {
          cmds.push(`${poolPrompt}${line}`);
        }
        cmds.push(`${poolPrompt}exit`);
      }
      steps.push({
        title: '配置 DHCP 服务器',
        desc: '为各网段配置 DHCP 地址池（网段、默认网关、DNS、租期）并排除保留地址',
        commands: cmds,
      });
    }

    // ---- 步骤 12：配置前缀列表 ----
    if (prefixLists.length) {
      const cmds = [];
      for (const p of prefixLists) {
        cmds.push(`${host}(config)#ip prefix-list ${p.name} seq ${p.seq} ${p.action} ${p.prefix}` + (p.mask ? ` ${p.mask}` : ''));
      }
      steps.push({
        title: '配置前缀列表',
        desc: '用于路由过滤和策略匹配的精确前缀列表',
        commands: cmds,
      });
    }

    // ---- 步骤 13：配置路由映射 ----
    if (routeMaps.length) {
      const cmds = [];
      for (const rm of routeMaps) {
        cmds.push(`${host}(config)#route-map ${rm.name} ${rm.action} ${rm.node}`);
        cmds.push(`${host}(config-route-map)#exit`);
      }
      steps.push({
        title: '配置路由映射',
        desc: 'route-map 用于路由引入、过滤和策略路由',
        commands: cmds,
      });
    }

    // ---- 步骤 14：配置生成树 ----
    if (stpModeM || stpPriM || stpPriAllM) {
      const cmds = [];
      if (stpModeM) cmds.push(`${host}(config)#spanning-tree mode ${stpModeM[1]}`);
      if (stpPriM) cmds.push(`${host}(config)#spanning-tree vlan <N> priority ${stpPriM[1]}`);
      if (stpPriAllM) cmds.push(`${host}(config)#spanning-tree priority ${stpPriAllM[1]}`);
      steps.push({
        title: '配置生成树协议',
        desc: '设置 STP 模式和优先级，防止二层环路',
        commands: cmds,
      });
    }

    // ---- 步骤 15：配置 NTP ----
    if (ntpServers.length) {
      const cmds = [];
      for (const s of ntpServers) {
        cmds.push(`${host}(config)#ntp server ${s}`);
      }
      steps.push({
        title: '配置 NTP 时间同步',
        desc: '与上游 NTP 服务器同步系统时间',
        commands: cmds,
      });
    }

    // ---- 步骤 16：配置 SNMP ----
    if (snmpCommunities.length || snmpLocationM || snmpContactM) {
      const cmds = [];
      if (snmpContactM) cmds.push(`${host}(config)#snmp-server contact ${snmpContactM[1].trim()}`);
      if (snmpLocationM) cmds.push(`${host}(config)#snmp-server location ${snmpLocationM[1].trim()}`);
      for (const c of snmpCommunities) {
        cmds.push(`${host}(config)#snmp-server community ${c.name} ${c.access}`);
      }
      steps.push({
        title: '配置 SNMP',
        desc: '配置 SNMP 联系人、位置和只读/读写团体字',
        commands: cmds,
      });
    }

    // ---- 步骤 17：配置 AAA 与本地用户 ----
    if (aaaEnabled || localUsers.length) {
      const cmds = [];
      if (aaaEnabled) cmds.push(`${host}(config)#aaa new-model`);
      if (aaaAuthenM) cmds.push(`${host}(config)#aaa authentication login ${aaaAuthenM[1]} ${aaaAuthenM[2].trim()}`);
      if (aaaAuthorM) cmds.push(`${host}(config)#aaa authorization exec ${aaaAuthorM[1]} ${aaaAuthorM[2].trim()}`);
      for (const u of localUsers) {
        // 还原：username NAME [privilege N] (password|secret) [TYPE] PASS
        let cmd = `${host}(config)#username ${u.name}`;
        if (u.level) cmd += ` privilege ${u.level}`;
        if (u.type) {
          cmd += ` ${u.type}`;
          if (u.encType) cmd += ` ${u.encType}`;
          if (u.password) cmd += ` ${u.password}`;
        }
        cmds.push(cmd);
      }
      steps.push({
        title: '配置 AAA 与本地用户',
        desc: '启用 AAA 认证授权，创建本地用户名和密码',
        commands: cmds,
      });
    }

    // ---- 步骤 18：配置 SSH 与 VTY ----
    if (sshEnabled || vtyLines.length) {
      const cmds = [];
      if (sshEnabled) {
        cmds.push(`${host}(config)#crypto key generate rsa`);
        cmds.push(`# 按提示输入密钥长度（如 1024 或 2048）`);
        if (sshVersionM) cmds.push(`${host}(config)#ip ssh version ${sshVersionM[1]}`);
        if (sshTimeoutM) cmds.push(`${host}(config)#ip ssh time-out ${sshTimeoutM[1]}`);
      }
      for (const v of vtyLines) {
        cmds.push(`${host}(config)#${v.header}`);
        const linePrompt = `${host}(config-line)#`;
        for (const line of v.body) cmds.push(`${linePrompt}${line}`);
        cmds.push(`${linePrompt}exit`);
      }
      steps.push({
        title: '配置 SSH 与 VTY/Console',
        desc: '生成本地 RSA 密钥使能 SSH 服务，并配置 VTY/Console 线路认证',
        commands: cmds,
      });
    }

    // ---- 步骤 9：保存配置 ----
    steps.push({
      title: '退出并保存配置',
      desc: '返回特权 EXEC 模式并保存配置到 NVRAM',
      commands: [
        `${host}(config)#end`,
        `${host}#`,
        `${host}#write memory`,
        `Building configuration...`,
        `[OK]`,
      ],
    });

    return steps;
  }

  // ============== 导出菜单 ==============

  function showExportMenu(event, cy, jsonData, filename) {
    // 移除已有菜单
    document.querySelector('.pkt-export-menu')?.remove();

    const menu = document.createElement('div');
    menu.className = 'pkt-export-menu';
    menu.style.cssText = `
      position: fixed;
      z-index: 9999;
      padding: 4px 0;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e0e0e0);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      font-size: 13px;
      min-width: 160px;
    `;

    const addOption = (label, action) => {
      const item = document.createElement('button');
      item.textContent = label;
      item.style.cssText = `
        display: block;
        width: 100%;
        padding: 7px 14px;
        border: none;
        background: none;
        color: var(--color-text, #333);
        text-align: left;
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
      `;
      item.onmouseenter = () => item.style.background = 'rgba(212, 165, 201, 0.12)';
      item.onmouseleave = () => item.style.background = 'none';
      item.addEventListener('click', () => {
        action();
        menu.remove();
      });
      menu.appendChild(item);
    };

    addOption('导出 PNG 图片', () => {
      const png = cy.png({ scale: 2, full: true, bg: getCSSVar('--color-surface', '#fff') });
      const a = document.createElement('a');
      a.href = png;
      a.download = filename.replace(/\.\w+$/, '') + '.png';
      a.click();
    });

    addOption('导出 JSON 数据', () => {
      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/\.\w+$/, '') + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    addOption('导出 Markdown 表格', () => {
      const md = exportMarkdown(jsonData);
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/\.\w+$/, '') + '.md';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.body.appendChild(menu);
    const x = Math.min(event.clientX, window.innerWidth - 180);
    const y = Math.min(event.clientY, window.innerHeight - 120);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // 点击外部关闭
    setTimeout(() => {
      document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', close);
        }
      });
    }, 0);
  }

  function exportMarkdown(jsonData) {
    let md = `# 拓扑：${jsonData.meta.source}\n\n`;
    md += `> 设备 ${jsonData.meta.deviceCount} / 链路 ${jsonData.meta.linkCount} / 版本 ${jsonData.meta.ptVersion}\n\n`;

    md += `## 设备列表\n\n`;
    md += `| 名称 | 类型 | 主 IP | 型号 |\n`;
    md += `|------|------|-------|------|\n`;
    (jsonData.devices || []).forEach(dev => {
      md += `| ${dev.name} | ${dev.type} | ${dev.primaryIp || '-'} | ${dev.model || '-'} |\n`;
    });

    md += `\n## 链路列表\n\n`;
    md += `| 源设备 | 源接口 | 目标设备 | 目标接口 | 线缆类型 |\n`;
    md += `|--------|--------|----------|----------|----------|\n`;
    (jsonData.links || []).forEach(link => {
      md += `| ${link.source} | ${link.sourceInterface || '-'} | ${link.target} | ${link.targetInterface || '-'} | ${link.cableType} |\n`;
    });

    return md;
  }

  // ============== 加载 JSON 并渲染 ==============

  async function loadAndRender(container, jsonPath, options) {
    container.innerHTML = `
      <div class="pkt-topology-container">
        <div class="pkt-loading">
          <div class="pkt-loading-spinner"></div>
          <div>正在加载拓扑数据...</div>
        </div>
      </div>
    `;

    try {
      // 按需加载 cytoscape（366KB，仅在渲染 pkt/ensp 拓扑时才需要）
      if (typeof cytoscape === 'undefined') {
        await window.MarkdownPreview.loadScript('iris/vendor/cytoscape/cytoscape.min.js');
      }
      if (typeof cytoscape === 'undefined') {
        throw new Error('Cytoscape library failed to load');
      }

      const base = getBasePath();
      let safePath = jsonPath;
      if (!jsonPath.startsWith('http') && !jsonPath.startsWith('/')) {
        try {
          safePath = decodeURIComponent(jsonPath);
        } catch (e) { /* 已是原始字符串，decode 失败则原样使用 */ }
        safePath = encodeURIComponent(safePath);
      }

      let dataPath = 'pkt';
      if (options && typeof options === 'string') {
        if (options === 'ensp') dataPath = 'ensp';
      } else if (options && options.format) {
        if (options.format === 'ensp') dataPath = 'ensp';
      }

      const url = jsonPath.startsWith('http') || jsonPath.startsWith('/')
        ? jsonPath
        : `${base}iris/data/${dataPath}/json/${safePath}.json`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      container.innerHTML = '';
      return renderTopology(container, data, options);
    } catch (err) {
      container.innerHTML = `
        <div class="pkt-topology-container">
          <div class="pkt-error-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
            <div class="pkt-error-title">加载失败</div>
            <div class="pkt-error-message">${err.message}</div>
            <div class="pkt-error-detail">路径: ${jsonPath}</div>
          </div>
        </div>
      `;
      return null;
    }
  }

  function getBasePath() {
    // GitHub Pages 子路径适配
    const path = window.location.pathname;
    if (path.includes('/md-preview/')) return '/md-preview/';
    return '/';
  }

  // ============== 暴露 API ==============

  window.MarkdownPreview.pkt = {
    renderTopology,
    loadAndRender,
    highlightIOS,
  };

  // ============== 自动加载设备 SVG 图标 sprite ==============

  let iconsLoaded = false;
  function loadIconsSprite() {
    if (iconsLoaded) return;
    iconsLoaded = true;
    // 检查是否已存在
    if (document.querySelector('#pkt-router')) return;
    const base = getBasePath();
    fetch(`${base}iris/data/pkt/icons.svg`)
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(svgText => {
        const div = document.createElement('div');
        div.innerHTML = svgText;
        const svg = div.querySelector('svg');
        if (svg) {
          svg.setAttribute('aria-hidden', 'true');
          svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
          document.body.insertBefore(svg, document.body.firstChild);
        }
      })
      .catch(err => console.warn('[PKT] 图标 sprite 加载失败:', err));
  }

  // DOMContentLoaded 后加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIconsSprite);
  } else {
    loadIconsSprite();
  }
})();
