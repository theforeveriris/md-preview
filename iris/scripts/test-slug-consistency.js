#!/usr/bin/env node

/**
 * slug 一致性回归测试
 *
 * 锁死 build 侧（iris/scripts/lib/md-links.js#slugify）与运行时
 * （iris/js/md-render.js#slugify）的标题锚点规则一致——两者是逐字镜像，
 * 此前只靠注释「改动需同步」人肉维护，漂移会让 CI 死链检查与运行时锚点
 * 对不上。jsdom 加载运行时实现，逐用例比对。
 *
 * 运行：node iris/scripts/test-slug-consistency.js（smoke-test.js 也会调用）
 */
const fs = require('fs');
const path = require('path');

function createRequireJsdom() {
  try {
    // 优先从 iris/node_modules 解析（CI 安装位置）
    const requireFromIris = require('module').createRequire(
      path.join(__dirname, '..', 'package.json')
    );
    return requireFromIris('jsdom').JSDOM;
  } catch (e) {
    console.error('[test-slug-consistency] jsdom 不可用，跳过（npm install 后重试）');
    return null;
  }
}

function main() {
  const JSDOM = createRequireJsdom();
  if (!JSDOM) process.exit(0);

  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.marked = { Renderer: function() {}, parse: () => '' };

  // 加载运行时实现（IIFE 自执行，把 slugify 挂到 MarkdownPreview.mdRender）
  const mdRenderSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'md-render.js'), 'utf8');
  // md-render.js 顶层只引用 window/document/marked，用全局求值即可
  global.window.MarkdownPreview = global.window.MarkdownPreview || {};
  eval(mdRenderSrc);

  const runtimeSlugify = global.window.MarkdownPreview.mdRender.slugify;
  if (typeof runtimeSlugify !== 'function') {
    console.error('[test-slug-consistency] 运行时 slugify 未找到');
    process.exit(1);
  }

  // build 侧实现
  const { slugify: buildSlugify } = require(path.join(__dirname, 'lib', 'md-links.js'));

  // 覆盖各类「易漂移」输入：中英混排、标点、emoji、空格连写、空值、null
  const cases = [
    'Hello World',
    '中文标题',
    'Mixed 中英文 Title 123',
    '标点： special!! chars??',
    '  leading and trailing  ',
    'multi   spaces    inside',
    'C++ 与 C# 的对比',
    'foo/bar\\baz',
    'emoji 🎉 title',
    'UPPER lower MiXeD',
    'a-b_c.d~e',
    '数字 2024 年版 v1.2.3',
    '',
    '   ',
    '---',
    42,
    null,
    undefined
  ];

  let failed = 0;
  for (const c of cases) {
    const a = runtimeSlugify(c);
    const b = buildSlugify(c);
    if (a !== b) {
      console.error(`[test-slug-consistency] MISMATCH for ${JSON.stringify(c)}: runtime=${JSON.stringify(a)} build=${JSON.stringify(b)}`);
      failed++;
    }
  }

  if (failed) {
    console.error(`[test-slug-consistency] ${failed} 个用例不一致——两份 slugify 已漂移，请同步后重试`);
    process.exit(1);
  }
  console.log('[test-slug-consistency] OK:', cases.length, 'cases identical');
}

main();
