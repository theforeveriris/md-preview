const CACHE_NAME = 'md-preview-v8.50';
// 运行时缓存版本必须随发布递增：旧版曾长期停留在 v8.19，导致
// index.html / JS / CSS 这类静态资源被「缓存优先」永久钉在旧版本
// （用户看到的是上一版脚本，后台更新完也不会生效）。
const RUNTIME_CACHE = 'md-preview-runtime-v8.20';
const PRECACHE_MANIFEST_URL = './iris/data/precache-manifest.json';

// 最小化兜底清单：当 manifest 拉取失败时使用，仅保证核心骨架可离线
const PRECACHE_FALLBACK_URLS = [
  './',
  './index.html',
  './manifest.json',
  './iris/styles.css',
  './iris/css/base.css',
  './iris/css/layout.css',
  './iris/css/markdown.css',
  './iris/css/components.css',
  './iris/css/editor.css',
  './iris/css/themes/themes.css',
  './iris/app.js',
  './iris/js/config.js',
  './iris/js/dom.js',
  './iris/js/markdown.js',
  './iris/js/md-render.js',
  './iris/js/cjk.js',
  './iris/js/prefetch.js',
  './iris/js/git-history.js',
  './iris/js/backlinks.js',
  './iris/js/figures.js',
  './iris/js/renderers/graph.js',
  './iris/js/renderers/sql-erd.js',
  './iris/js/renderers/http-request.js',
  './iris/js/renderers/glossary.js',
  './iris/js/renderers/openapi.js',
  './iris/js/editor.js',
  './iris/js/storage.js',
  './iris/vendor/marked.js',
  './iris/vendor/codemirror/codemirror.min.js',
  './iris/vendor/highlight.js/highlight.min.js'
];

// 拉取自动生成�?precache-manifest.json，失败时回退到最小清�?
async function loadPrecacheUrls() {
  try {
    const resp = await fetch(PRECACHE_MANIFEST_URL, { cache: 'no-store' });
    if (!resp.ok) throw new Error('manifest HTTP ' + resp.status);
    const data = await resp.json();
    if (!data || !Array.isArray(data.urls) || data.urls.length === 0) {
      throw new Error('manifest empty or invalid');
    }
    // manifest 自身也加入缓存，便于后续 activate 时校�?
    const urls = data.urls.slice();
    if (!urls.includes(PRECACHE_MANIFEST_URL)) urls.push(PRECACHE_MANIFEST_URL);
    console.log('[SW] Loaded precache manifest:', data.count, 'urls (v' + (data.version || '?') + ')');
    return urls;
  } catch (err) {
    console.warn('[SW] Manifest fetch failed, using fallback:', err.message);
    const urls = PRECACHE_FALLBACK_URLS.slice();
    if (!urls.includes(PRECACHE_MANIFEST_URL)) urls.push(PRECACHE_MANIFEST_URL);
    return urls;
  }
}

async function precache() {
  const urls = await loadPrecacheUrls();
  const cache = await caches.open(CACHE_NAME);
  let successCount = 0;
  let failCount = 0;

  await Promise.all(
    urls.map(async (url) => {
      // 网络优先：install 时总是重新拉取，确保发布新版本后预缓存立即刷新�?
      // 而不是命中旧缓存直接跳过（旧逻辑导致预缓存从未更新）�?
      // 仅当网络失败时才回退旧缓存，避免更新失败导致离线不可用�?
      const cached = await cache.match(url);
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          successCount++;
        } else {
          if (cached) successCount++; else failCount++;
        }
      } catch (err) {
        if (cached) successCount++; else failCount++;
      }
    })
  );

  console.log('[SW] Precache done:', successCount, 'success,', failCount, 'failed');
}

self.addEventListener('install', event => {
  console.log('[SW] Installing v7.3...');
  event.waitUntil(
    precache()
      .then(() => self.skipWaiting())
      .catch(err => {
        console.error('[SW] Precache error:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating v7.3...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// 资源类型分流策略
// 代码与入口类资源：必须「网络优先」，否则会把用户钉在旧版本上。
// 覆盖首页、JS、CSS、JSON 数据（file-tree / search-index / links 等）。
function isCodeAsset(url) {
  return /\.(js|css|json)(\?|$)/.test(url.pathname) ||
         url.pathname.endsWith('/') ||
         url.pathname.endsWith('index.html');
}

// 变化不频繁的媒体资源（图片 / 字体 / 图标）：沿用缓存优先，换一点速度
function isMediaAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?|$)/.test(url.pathname);
}

function isMarkdownDoc(url) {
  return url.pathname.endsWith('.md');
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 代码 / 入口 / 数据：网络优先（强制绕过 HTTP 缓存校验），失败回退缓存。
  // 这是防止「用户长期停留在旧版脚本」的关键：stale-while-revalidate 会让
  // 每次访问都先执行上一版 JS，而后台更新要到下一次访问才生效。
  if (isCodeAsset(url)) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || new Response(
          '离线模式下无法加载该资源', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          })))
    );
    return;
  }

  // 媒体资源：缓存优先 + 后台更新
  if (isMediaAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Markdown 文档：网络优先，强制 no-cache 绕过 stale runtime 响应；离线降级到缓存
  if (isMarkdownDoc(url)) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then(cached => {
            return cached || new Response('离线模式下无法加载此文档', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        })
    );
    return;
  }

  // 其他请求：缓存优�?
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // 清空文档缓存（设置面板「清除文档缓存」）：仅�?.md 条目，保留静态资�?
  if (event.data?.type === 'CLEAR_DOC_CACHE') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE).then(cache =>
        cache.keys().then(keys =>
          Promise.all(keys.filter(req => new URL(req.url).pathname.endsWith('.md'))
            .map(req => cache.delete(req)))
        )
      )
    );
  }
});
