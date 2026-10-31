/**
 * 网络设备配置语法包（Cisco IOS / 华为 VRP）
 *
 * 在 highlight.js 之后加载（index.html 中紧跟 vendor/highlight.js），
 * 通过 hljs.registerLanguage 注册两个自定义语言：
 *   - ```ios / ```cisco  → Cisco IOS / IOS-XE 配置
 *   - ```vrp / ```huawei → 华为 VRP 配置
 *
 * 语法层次：行注释（IOS 的 `!` / VRP 的 `#`）、字符串（banner 等）、
 * 数字（含 IP 地址片断）、配置关键字、常见厂商协议名（built_in）。
 * 仅依赖 hljs class 体系，与内置 10 套代码高亮主题自动兼容。
 */
(function() {
  'use strict';
  if (typeof hljs === 'undefined') {
    console.warn('[net-config] highlight.js 未加载，跳过 IOS/VRP 语法注册');
    return;
  }

  // ============== Cisco IOS ==============
  hljs.registerLanguage('ios', function(hljs) {
    var KEYWORDS = [
      'aaa', 'access-class', 'access-list', 'address-family', 'aggregate',
      'authentication', 'banner', 'bgp', 'boot', 'bandwidth', 'cdp', 'class-map',
      'clock', 'crypto', 'default', 'description', 'deny', 'dhcp', 'distance',
      'domain', 'dot1q', 'duplex', 'enable', 'encapsulation', 'end', 'exit',
      'extended', 'hostname', 'interface', 'ip', 'ipv6', 'line', 'link',
      'logging', 'login', 'logout', 'match', 'mtu', 'name', 'network', 'no',
      'ntp', 'passive-interface', 'password', 'permit', 'policy-map', 'pool',
      'port-channel', 'prefix-list', 'privilege', 'range', 'return', 'route',
      'route-map', 'router', 'secondary', 'security', 'service', 'service-policy',
      'session', 'set', 'shutdown', 'snmp-server', 'speed', 'spanning-tree',
      'standby', 'standard', 'static', 'switch', 'switchport', 'telnet', 'track',
      'trunk', 'trusted', 'username', 'version', 'vlan', 'vrf', 'write'
    ];
    var PROTOCOLS = [
      'bgp', 'eigrp', 'hsrp', 'ospf', 'rip', 'ssh', 'acl', 'nat', 'dhcp',
      'tcp', 'udp', 'icmp', 'gre', 'ipsec', 'l2tp', 'stp', 'pvst', 'vtp',
      'dot1q', 'lacp', 'pagp', 'glbp', 'vrrp', 'isis', 'mpls', 'ldp', 'qinq'
    ];
    return {
      name: 'Cisco IOS',
      aliases: ['cisco', 'cisco-ios', 'ios-xe'],
      case_insensitive: true,
      keywords: {
        $pattern: '[a-zA-Z][a-zA-Z0-9_-]*',
        keyword: KEYWORDS,
        built_in: PROTOCOLS
      },
      contains: [
        // 注释行：以 ! 开头（show running-config 的分段注释）
        hljs.COMMENT(/^[ \t]*!/, /$/),
        // banner / description 等中的字符串
        hljs.QUOTE_STRING_MODE,
        hljs.APOS_STRING_MODE,
        // IPv4 / IPv4 掩码 / 普通数字
        {
          className: 'number',
          begin: /\b\d{1,3}(\.\d{1,3}){3}\b(\/\d{1,2})?|\b\d+\b/
        }
      ]
    };
  });

  // ============== 华为 VRP ==============
  hljs.registerLanguage('vrp', function(hljs) {
    var KEYWORDS = [
      'acl', 'aaa', 'area', 'authentication-mode', 'bgp', 'binding', 'bfd',
      'capability', 'capture', 'clear', 'commit', 'controller',
      'current-configuration', 'default', 'description', 'dhcp', 'dhcpv4',
      'display', 'dot1x', 'duplex', 'dual-active', 'echo', 'eth-trunk',
      'firewall', 'flush', 'ftp', 'gateway', 'group', 'hwtacacs', 'igmp',
      'interface', 'ip', 'ipv6', 'isis', 'lacp', 'link-aggregation', 'lldp',
      'local-user', 'local-preference', 'lock', 'loopback', 'mac-address',
      'mad', 'master', 'mirror', 'mode', 'mpls', 'mtrace', 'multicast',
      'nat', 'ndo', 'netconf', 'network', 'next-hop', 'ntp', 'ospf', 'pim',
      'ping', 'port', 'port-group', 'preference', 'protocol', 'qos', 'quit',
      'radius', 'rate-limit', 'return', 'rip', 'route-policy', 'route-static',
      'router', 'save', 'screen', 'security', 'set', 'sflow', 'snmp-agent',
      'ssh', 'stp', 'stelnet', 'super', 'sysname', 'tcp', 'telnet', 'test',
      'tftp', 'trace', 'tracert', 'traffic', 'trunkport', 'undo', 'user-interface',
      'vlan', 'vlan-batch', 'vrrp', 'vty', 'x25'
    ];
    var ACTIONS = [
      'permit', 'deny', 'allow', 'block', 'pass', 'discard', 'forward',
      'enable', 'disable', 'shutdown', 'undo', 'add', 'delete', 'port'
    ];
    return {
      name: 'Huawei VRP',
      aliases: ['huawei', 'vrp8'],
      case_insensitive: true,
      keywords: {
        $pattern: '[a-zA-Z][a-zA-Z0-9_-]*',
        keyword: KEYWORDS,
        built_in: ACTIONS
      },
      contains: [
        // 注释 / 配置分段行：以 # 开头
        hljs.COMMENT(/^[ \t]*#/, /$/),
        hljs.QUOTE_STRING_MODE,
        hljs.APOS_STRING_MODE,
        {
          className: 'number',
          begin: /\b\d{1,3}(\.\d{1,3}){3}\b(\/\d{1,2})?|\b\d+\b/
        }
      ]
    };
  });

  console.log('[net-config] IOS / VRP 语法已注册');
})();
