const CACHE_NAME = 'md-preview-v7.2';
const RUNTIME_CACHE = 'md-preview-runtime-v7.2';
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
  './iris/js/editor.js',
  './iris/js/storage.js',
  './iris/vendor/marked.js',
  './iris/vendor/codemirror/codemirror.min.js',
  './iris/vendor/highlight.js/highlight.min.js'
];

// 拉取自动生成的 precache-manifest.json，失败时回退到最小清单
async function loadPrecacheUrls() {
  try {
    const resp = await fetch(PRECACHE_MANIFEST_URL, { cache: 'no-store' });
    if (!resp.ok) throw new Error('manifest HTTP ' + resp.status);
    const data = await resp.json();
    if (!data || !Array.isArray(data.urls) || data.urls.length === 0) {
      throw new Error('manifest empty or invalid');
    }
    // manifest 自身也加入缓存，便于后续 activate 时校验
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
      try {
        // 检查是否已缓存，避免重复请求
        const cached = await cache.match(url);
        if (cached) {
          successCount++;
          return;
        }
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    })
  );

  console.log('[SW] Precache done:', successCount, 'success,', failCount, 'failed');
}

self.addEventListener('install', event => {
  console.log('[SW] Installing v7.1...');
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
  console.log('[SW] Activating v7.1...');
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
function isStaticAsset(url) {
  return /\.(css|js|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?|$)/.test(url) ||
         url.pathname.endsWith('/') ||
         url.pathname.endsWith('index.html');
}

function isMarkdownDoc(url) {
  return url.pathname.endsWith('.md');
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // 静态资源：stale-while-revalidate — 先返回缓存（快速），后台更新缓存
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const fetchPromise = fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        // 有缓存就先返回缓存，同时后台更新；无缓存则等待网络
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

  // 其他请求：缓存优先
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
});
