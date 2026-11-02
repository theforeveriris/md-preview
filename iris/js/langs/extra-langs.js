/**
 * 配置语言高亮补充（A3）
 *
 * highlight.js 官方 bundle 未内置的常见配置语言，注册到已有语法上，
 * 避免 `toml` / `dockerfile` / `nginx` 等围栏出现「no-highlight」回退：
 *   toml / properties / apache / nginx / ini  → ini
 *   dockerfile / ssh / http / nmap            → bash
 *   rst                                       → markdown
 * 目标语言缺失时跳过；未登记的未知语言保持原样（hljs 自动 no-highlight）。
 */
(function() {
  'use strict';
  if (typeof hljs === 'undefined' || typeof hljs.registerLanguage !== 'function') return;
  const map = {
    toml: 'ini',
    properties: 'ini',
    apache: 'ini',
    nginx: 'ini',
    rst: 'markdown',
    dockerfile: 'bash',
    ssh: 'bash',
    http: 'bash',
    nmap: 'bash',
    // 渲染器自有围栏：无对应语法，映射到 bash 避免 no-highlight 告警与注册错误
    hotspot: 'bash',
    clihelp: 'bash',
    registry: 'bash',
    kroki: 'bash',
    'vega-lite': 'bash',
    har: 'bash',
    trace: 'bash',
    lldp: 'bash',
    cdp: 'bash',
    dig: 'bash',
    nslookup: 'bash',
    bgp: 'bash',
    log: 'bash',
    clitable: 'bash',
    github: 'bash',
    issue: 'bash',
    pr: 'bash',
    release: 'bash'
  };
  Object.keys(map).forEach(key => {
    if (hljs.getLanguage(key)) return;
    try {
      // 官方别名 API：把 key 挂到目标语言上（可能一次注册多个别名）
      if (typeof hljs.registerAliases === 'function') {
        const aliases = Object.keys(map).filter(k => map[k] === map[key] && !hljs.getLanguage(k));
        if (aliases.length && aliases[0] === key) {
          hljs.registerAliases(aliases, { languageName: map[key] });
        }
      } else {
        const target = hljs.getLanguage(map[key]);
        if (target) hljs.registerLanguage(key, target);
      }
    } catch (e) { /* 注册失败保持原样 */ }
  });
})();
