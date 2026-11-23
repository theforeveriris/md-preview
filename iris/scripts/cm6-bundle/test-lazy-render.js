/**
 * 懒渲染兜底行为验证（jsdom，独立于 smoke-test.js）
 *
 * 回归背景：
 *   `content-visibility: auto` 子树内的元素在 Chrome 里可能永远拿不到
 *   intersecting 回调。早期实现用「IO 是否回调过」判断是否需要兜底，
 *   而 IO 的首次回调会带上全部 observe 目标（未进入视口时 isIntersecting
 *   为 false），因此布尔量立刻为 true，1.8s 兜底永不触发 —— 屏外图表会
 *   永久停在源码状态（症状：mermaid 显示源码、没渲染）。
 *
 * 本测试构造「IO 只回调一次且全部不相交」的场景，验证：
 *   1. 视口内的块立即渲染（首屏不为空）
 *   2. 屏外块保持懒渲染（不提前初始化）
 *   3. 滚动到该块附近后能被补渲染（兜底 A）
 *   4. IO 完全不回调时，1.8s 后统一补齐（兜底 B）
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const ONLY_LAZY = ['mermaid'];
// 允许指向别的实现做对照（默认工作树版本）
const MD_RENDER_PATH = process.env.MD_RENDER_PATH || path.join(ROOT, 'js', 'md-render.js');

function makeDom() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <article id="markdownContent" class="markdown-body">
      <pre class="code-block" data-lang="mermaid"><code class="language-mermaid">graph TD; A-->B</code></pre>
      <div style="height:3000px"></div>
      <pre class="code-block" data-lang="mermaid"><code class="language-mermaid">graph TD; C-->D</code></pre>
    </article>
  </body></html>`, { pretendToBeVisual: true, runScripts: 'outside-only' });

  const { window } = dom;
  global.window = window;
  global.document = window.document;
  Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
  Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });

  const pres = [...window.document.querySelectorAll('pre')];
  pres[0].getBoundingClientRect = () => ({ top: 100, bottom: 200, left: 0, right: 500, width: 500, height: 100, x: 0, y: 100 });
  // 第 2 块默认远在下方；测试中可切换为「已滚到附近」
  const state = { far: true };
  pres[1].getBoundingClientRect = () => state.far
    ? { top: 3200, bottom: 3300, left: 0, right: 500, width: 500, height: 100, x: 0, y: 3200 }
    : { top: 300, bottom: 400, left: 0, right: 500, width: 500, height: 100, x: 0, y: 300 };

  window.MarkdownPreview = { state: {} };
  window.eval(fs.readFileSync(MD_RENDER_PATH, 'utf8'));

  // 假渲染器：命中即标记 rendered（模拟真实渲染器替换容器）
  window.MarkdownPreview.renderers = {
    mermaid: {
      render(root) {
        const scope = root || window.document.getElementById('markdownContent');
        scope.querySelectorAll('pre').forEach(pre => {
          if (!pre.querySelector('code.language-mermaid')) return;
          pre.dataset.rendered = '1';
        });
      }
    }
  };

  return { window, pres, state };
}

function installIO(window, mode) {
  // mode: 'once-no-intersect' = 只回调一次且全部不相交；'never' = 永不回调
  let callbacks = 0;
  window.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; this.targets = []; }
    observe(el) {
      this.targets.push(el);
      if (mode === 'once-no-intersect' && callbacks === 0) {
        callbacks++;
        setTimeout(() => this.cb(this.targets.map(t => ({ target: t, isIntersecting: false })), this), 10);
      }
    }
    unobserve() {}
    disconnect() {}
  };
  global.IntersectionObserver = window.IntersectionObserver;
  window.requestAnimationFrame = (fn) => { setTimeout(fn, 0); return 1; };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
let fails = 0;
function check(name, cond, extra) {
  console.log('  ' + (cond ? 'PASS' : 'FAIL') + '  ' + name + (!cond && extra ? ' -> ' + extra : ''));
  if (!cond) fails++;
}

(async () => {
  console.log('\n=== 场景 1：IO 回调一次但全部不相交（content-visibility 子树） ===');
  {
    const { window, pres, state } = makeDom();
    installIO(window, 'once-no-intersect');
    await window.MarkdownPreview.mdRender.runRenderers(null, { lazy: true, only: ONLY_LAZY });

    check('视口内块立即渲染', pres[0].dataset.rendered === '1');
    check('屏外块此时不渲染（保持懒加载）', !pres[1].dataset.rendered);

    await wait(60); // 等首次 IO 回调（全部 isIntersecting=false）

    // 滚动到该块：位置变近 + 派发 scroll
    state.far = false;
    window.dispatchEvent(new window.Event('scroll'));
    await wait(80);

    check('滚动后屏外块被补渲染（兜底 A）', pres[1].dataset.rendered === '1');
    await window.MarkdownPreview.mdRender.runRenderers(null, { only: [] }).catch(() => {});
    window.MarkdownPreview.mdRender.clearLazy();
  }

  console.log('\n=== 场景 2：IO 完全不回调（个别环境） ===');
  {
    const { window, pres } = makeDom();
    installIO(window, 'never');
    await window.MarkdownPreview.mdRender.runRenderers(null, { lazy: true, only: ONLY_LAZY });

    check('视口内块立即渲染', pres[0].dataset.rendered === '1');
    check('屏外块暂不渲染', !pres[1].dataset.rendered);

    await wait(2000); // 越过 1.8s 兜底阈值

    check('1.8s 后统一补齐（兜底 B）', pres[1].dataset.rendered === '1');
    window.MarkdownPreview.mdRender.clearLazy();
  }

  console.log(fails ? `\n失败 ${fails} 项` : '\n全部通过');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('TEST RUNNER ERROR:', e); process.exit(1); });
