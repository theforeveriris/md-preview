(function() {
  'use strict';
  console.log('[PluginLoader] Loading...');
  window.MarkdownPreview = window.MarkdownPreview || {};

  const pluginRegistry = new Map();
  const pluginInstances = new Map(); // 存储已初始化的插件实例
  const pluginResources = new WeakMap(); // 插件资源追踪（用于清理）
  console.log('[PluginLoader] Plugin system initialized');

  // ===== 配置与工具 =====

  function getPluginConfig(name) {
    try {
      const config = window.MarkdownPreview.CONFIG || {};
      return (config.plugins && config.plugins[name]) || {};
    } catch (e) {
      return {};
    }
  }

  function emitHook(plugin, hookName, ...args) {
    if (typeof plugin[hookName] === 'function') {
      try {
        return plugin[hookName](...args);
      } catch (e) {
        console.error(`[PluginLoader] Plugin "${plugin.name}" ${hookName} error:`, e);
      }
    }
  }

  // ===== 核心注册/注销 =====

  function registerPlugin(plugin) {
    console.log('[PluginLoader] registerPlugin called, plugin:', plugin?.name);
    if (!plugin || typeof plugin !== 'object') {
      console.error('[PluginLoader] Plugin must be an object');
      return false;
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      console.error('[PluginLoader] Plugin must have a name property');
      return false;
    }

    // test 现在可选：如果插件不声明 test，默认精确匹配 language === plugin.name
    if (plugin.test !== undefined && typeof plugin.test !== 'function') {
      console.error(`[PluginLoader] Plugin "${plugin.name}" test must be a function`);
      return false;
    }

    // render 现在可以是同步或异步函数
    if (typeof plugin.render !== 'function') {
      console.error(`[PluginLoader] Plugin "${plugin.name}" must have a render function`);
      return false;
    }

    // 默认优先级：0，数值越大越优先
    const normalizedPlugin = {
      ...plugin,
      priority: typeof plugin.priority === 'number' ? plugin.priority : 0
    };

    // 如果插件已存在，先注销旧的
    if (pluginRegistry.has(plugin.name)) {
      console.warn(`[PluginLoader] Plugin "${plugin.name}" already registered, re-registering`);
      unregisterPlugin(plugin.name);
    }

    pluginRegistry.set(plugin.name, normalizedPlugin);
    console.log(`[PluginLoader] Plugin registered: ${plugin.name} (priority=${normalizedPlugin.priority})`);

    // 调用 init 生命周期钩子（如果存在）
    const config = getPluginConfig(plugin.name);
    emitHook(normalizedPlugin, 'init', config);

    console.log('[PluginLoader] Current registry:', Array.from(pluginRegistry.keys()));
    return true;
  }

  function unregisterPlugin(name) {
    const plugin = pluginRegistry.get(name);
    if (!plugin) return false;

    // 调用 destroy 生命周期钩子（如果存在）
    emitHook(plugin, 'destroy');

    // 清理插件实例追踪的资源
    const instances = pluginInstances.get(name);
    if (instances) {
      instances.forEach(res => {
        if (res && typeof res.destroy === 'function') {
          try { res.destroy(); } catch (e) { /* ignore */ }
        }
      });
      pluginInstances.delete(name);
    }

    pluginRegistry.delete(name);
    console.log(`[PluginLoader] Plugin unregistered: ${name}`);
    return true;
  }

  function getPlugin(name) {
    return pluginRegistry.get(name);
  }

  function getAllPlugins() {
    // 按优先级降序返回
    return Array.from(pluginRegistry.values()).sort((a, b) => b.priority - a.priority);
  }

  function isPluginRegistered(name) {
    return pluginRegistry.has(name);
  }

  // ===== 插件查找 =====

  function findPlugin(code, language) {
    // 按优先级排序后查找
    const sorted = getAllPlugins();
    for (const plugin of sorted) {
      try {
        // 如果插件没有自定义 test，使用默认精确匹配
        const testFn = plugin.test || function(_, lang) { return lang === plugin.name; };
        if (testFn(code, language)) {
          return plugin;
        }
      } catch (e) {
        console.error(`[PluginLoader] Plugin "${plugin.name}" test error:`, e);
      }
    }
    return null;
  }

  function findAllPlugins(code, language) {
    // 返回所有匹配的插件（用于链式处理等高级场景）
    const sorted = getAllPlugins();
    return sorted.filter(plugin => {
      try {
        const testFn = plugin.test || function(_, lang) { return lang === plugin.name; };
        return testFn(code, language);
      } catch (e) {
        console.error(`[PluginLoader] Plugin "${plugin.name}" test error:`, e);
        return false;
      }
    });
  }

  // ===== 插件加载 =====

  async function loadPlugin(url) {
    console.log(`[PluginLoader] Loading plugin from: ${url}`);
    try {
      // 浏览器 import() 需要绝对 URL 或以 / ./ ../ 开头的路径
      // 将 bare specifier 解析为相对于 baseURI 的绝对 URL
      const resolvedUrl = new URL(url, document.baseURI).href;
      const module = await import(/* @vite-ignore */ resolvedUrl);
      const plugin = module.default || module;

      if (!plugin || typeof plugin !== 'object') {
        throw new Error(`Module at ${url} does not export a valid plugin object`);
      }

      // 支持无 name 的匿名插件：从 URL 推断
      if (!plugin.name) {
        const urlName = url.split('/').pop()?.replace(/\.js$/, '');
        if (urlName) {
          plugin.name = urlName;
          console.warn(`[PluginLoader] Plugin from ${url} has no name, using filename: ${urlName}`);
        }
      }

      const ok = registerPlugin(plugin);
      return ok ? plugin : null;
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin from ${url}:`, error);
      return null;
    }
  }

  async function loadPlugins(urls) {
    const results = await Promise.allSettled(urls.map(url => loadPlugin(url)));
    const loaded = [];
    results.forEach((res, i) => {
      if (res.status === 'fulfilled' && res.value) {
        loaded.push(res.value);
      } else if (res.status === 'rejected') {
        console.error(`[PluginLoader] Failed to load ${urls[i]}:`, res.reason);
      }
    });
    return loaded;
  }

  // ===== 自动加载 =====

  async function autoLoadPlugins() {
    console.log('[Plugins] Starting auto-load');

    // 策略 1：如果 config.json 中定义了 plugins.manifest，按 manifest 加载
    try {
      const config = window.MarkdownPreview.CONFIG || {};
      if (config.plugins && Array.isArray(config.plugins.manifest)) {
        console.log('[Plugins] Loading from manifest:', config.plugins.manifest);
        const loaded = await loadPlugins(config.plugins.manifest);
        console.log(`[Plugins] Loaded ${loaded.length} plugins from manifest`);
        return loaded;
      }
    } catch (e) {
      console.warn('[Plugins] Manifest loading error:', e);
    }

    // 策略 2：如果定义了 plugins.directory，按目录扫描加载
    const pluginDir = (window.MarkdownPreview.CONFIG?.plugins?.directory) || 'iris/plugins/';

    // 策略 2a：尝试获取 directory.json（预构建的插件索引）
    try {
      const indexUrl = pluginDir.replace(/\/?$/, '/') + 'directory.json';
      const response = await fetch(indexUrl);
      if (response.ok) {
        const manifest = await response.json();
        if (Array.isArray(manifest.files)) {
          const urls = manifest.files.map(f => pluginDir.replace(/\/?$/, '/') + f);
          const loaded = await loadPlugins(urls);
          console.log(`[Plugins] Loaded ${loaded.length} plugins from directory.json`);
          return loaded;
        }
      }
    } catch (e) {
      // 静默失败，继续尝试目录扫描
    }

    // 策略 2b：回退到目录 HTML 扫描（原行为，但会警告）
    try {
      const response = await fetch(pluginDir);
      if (!response.ok) {
        console.warn('[Plugins] Directory fetch failed:', response.status);
        return [];
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('a[href$=".js"]');

      console.log('[Plugins] Found plugin files via directory scan:', links.length);
      if (links.length === 0) {
        console.warn('[Plugins] No .js files found in directory listing. Consider using a manifest (directory.json or config.plugins.manifest) for reliable plugin auto-loading.');
      }

      const urls = [];
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href) {
          urls.push(pluginDir.replace(/\/?$/, '/') + href);
        }
      });

      const loaded = await loadPlugins(urls);
      console.log(`[Plugins] Loaded ${loaded.length} plugins from directory scan`);
      return loaded;
    } catch (error) {
      console.warn('[Plugins] Auto plugin loading skipped:', error.message);
      return [];
    }
  }

  // ===== 渲染（支持异步） =====

  async function renderWithPlugins(context) {
    console.log('[Plugins] renderWithPlugins called');
    const plugins = window.MarkdownPreview.plugins;
    if (!plugins || typeof plugins.find !== 'function') {
      console.log('[Plugins] Plugin system not available');
      return;
    }

    const allPres = document.querySelectorAll('.markdown-body pre');
    console.log('[Plugins] Found pre elements:', allPres.length);

    // 收集需要渲染的任务
    const renderTasks = [];

    for (let i = allPres.length - 1; i >= 0; i--) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');
      if (!codeElement) continue;

      const classList = codeElement.className;
      const languageMatch = classList ? classList.match(/language-(\S+)/) : null;
      const language = languageMatch ? languageMatch[1] : '';
      const code = codeElement.textContent.trim();

      const plugin = plugins.find(code, language);
      if (plugin) {
        renderTasks.push({ pre, plugin, code, language, index: i });
      }
    }

    // 执行渲染（支持异步，保持 DOM 替换顺序从后往前）
    for (const task of renderTasks) {
      const { pre, plugin, code, language } = task;
      console.log('[Plugins] Rendering with plugin:', plugin.name, 'language:', language);

      const container = document.createElement('div');
      container.className = `plugin-rendered plugin-${plugin.name}`;

      // 构建上下文
      const ctx = {
        language,
        pluginName: plugin.name,
        documentPath: context?.documentPath || window.MarkdownPreview.state?.currentFilePath || '',
        config: getPluginConfig(plugin.name),
        // 注册资源以便后续清理
        registerResource: (res) => {
          if (!pluginInstances.has(plugin.name)) {
            pluginInstances.set(plugin.name, []);
          }
          pluginInstances.get(plugin.name).push(res);
        }
      };

      // 调用 beforeRender 钩子
      emitHook(plugin, 'beforeRender', code, container, ctx);

      try {
        const result = plugin.render(code, container, ctx);

        // 支持异步 render
        if (result && typeof result.then === 'function') {
          await result;
        }

        if (pre.parentNode) {
          pre.parentNode.replaceChild(container, pre);
        }

        // 调用 afterRender 钩子
        emitHook(plugin, 'afterRender', container, ctx);

        console.log('[Plugins] Successfully rendered plugin:', plugin.name);
      } catch (error) {
        console.error(`[Plugins] Plugin "${plugin.name}" render error:`, error);

        // 渲染错误时显示友好的错误边界
        container.innerHTML = `
          <div class="plugin-error" style="
            padding: 12px 16px;
            border: 1px solid #ff6b6b;
            border-radius: 8px;
            background: #fff0f0;
            color: #cc0000;
            font-family: system-ui, sans-serif;
            font-size: 14px;
          ">
            <div style="font-weight: 600; margin-bottom: 4px;">❌ 插件渲染错误</div>
            <div style="opacity: 0.8;">插件: <code>${plugin.name}</code></div>
            <div style="opacity: 0.8; font-size: 12px; margin-top: 4px;">${error.message || error}</div>
          </div>
        `;
        if (pre.parentNode) {
          pre.parentNode.replaceChild(container, pre);
        }
      }
    }
  }

  // ===== 导出 =====

  window.MarkdownPreview.plugins = {
    // 核心 API
    register: registerPlugin,
    unregister: unregisterPlugin,
    get: getPlugin,
    getAll: getAllPlugins,
    isRegistered: isPluginRegistered,

    // 查找 API
    find: findPlugin,
    findAll: findAllPlugins,

    // 加载 API
    load: loadPlugin,
    loadMultiple: loadPlugins,
    autoLoad: autoLoadPlugins,

    // 渲染 API
    render: renderWithPlugins,

    // 内部（调试用）
    _registry: pluginRegistry,
    _instances: pluginInstances
  };
})();
