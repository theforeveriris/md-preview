/**
 * 文件名 / 路径自然排序（运行时 + 构建期共用）
 *
 * 统一「自然排序」口径：把名称里的数字段当作数值比较，
 * 使 `1.0` < `2.0` < `9.0` < `10.0` < `11.0`，而不是字典序的
 * `1.0 < 1.1 < 10.0 < 11.0 < 2.0`。
 *
 * 背景：vendor 的 @webreflection/file-tree 组件用纯字典序
 * （`name.localeCompare(name)`）排序，数字开头的文件名会排错位；
 * 上游（v0.1.5 与当前 main）尚未修复，故本项目自带比较器并在各处统一使用。
 *
 * 本文件同时被浏览器（index.html <script>）与 Node 构建脚本
 * （require('../js/name-sort.js')）使用，保证两侧口径一致。
 */

(function (global) {
  'use strict';

  /** 数字感知的 locale 比较器（缓存，避免每次比较都新建） */
  let collator = null;
  function getCollator() {
    if (!collator) {
      collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    }
    return collator;
  }

  /**
   * 比较两个名称（自然排序）
   * @param {string} a
   * @param {string} b
   * @returns {number} 负数表示 a 排在前面
   */
  function compareNames(a, b) {
    return getCollator().compare(
      String(a == null ? '' : a),
      String(b == null ? '' : b)
    );
  }

  /**
   * 按名称排序（不修改入参）
   * @param {Array<{name: string}>} items
   */
  function sortByName(items) {
    return items.slice().sort((a, b) => compareNames(a.name, b.name));
  }

  /**
   * 按路径排序（不修改入参）
   * @param {string[]} paths
   */
  function sortPaths(paths) {
    return paths.slice().sort((a, b) => compareNames(a, b));
  }

  /**
   * 取 li 的直接子 button（vendor 结构：li > button (+ ul)）
   * 不用 :scope 选择器，避免部分环境在 Shadow DOM 内不支持。
   */
  function directButton(li) {
    for (const el of li.children) {
      if (el.tagName === 'BUTTON') return el;
    }
    return null;
  }

  /**
   * 按自然排序重排 Shadow DOM 中的每一级列表。
   *
   * vendor 组件（@webreflection/file-tree）在每次 append() 后用纯字典序
   * （name.localeCompare(name)）重排同级节点，数字开头的文件名会排错位：
   * 1.0 1.1 10.0 11.0 2.0 …。上游尚未修复，故在此兜底重排。
   *
   * 规则与 vendor 保持一致：文件夹在前、文件在后，各组按名称自然排序。
   *
   * @param {ShadowRoot|Document|null} root 传入 ShadowRoot 或 Document
   */
  function applyNaturalOrder(root) {
    if (!root) return;
    const processList = (ul) => {
      const items = Array.prototype.slice.call(ul.children);
      if (items.length < 2) return;

      const decorated = items.map((li) => {
        const button = directButton(li);
        // vendor 渲染时对文件名做了 encodeURIComponent，比较前先解码
        let name = '';
        if (button) {
          for (const node of button.childNodes) {
            if (node.nodeType === 3 /* Node.TEXT_NODE */) name += node.textContent;
          }
        }
        const isFolder = li.classList.contains('folder');
        return { li, name: safeDecode(name.trim()), isFolder };
      });

      // 稳定排序：文件夹在前，文件在后，组内按自然序
      const sorted = decorated
        .map((d, i) => ({ d, i }))
        .sort((x, y) => {
          if (x.d.isFolder !== y.d.isFolder) return x.d.isFolder ? -1 : 1;
          const byName = compareNames(x.d.name, y.d.name);
          return byName !== 0 ? byName : x.i - y.i;
        })
        .map((x) => x.d.li);

      // 只有顺序确实变了才动 DOM，避免无谓的重排。
      // 注意用「当前实时的 children」定位锚点（不能用排序前的快照）：
      // 逐个 insertBefore 会改变后续元素的位置。
      const live = ul.children;
      for (let i = 0; i < sorted.length; i++) {
        const anchor = live[i];
        if (anchor !== sorted[i]) {
          ul.insertBefore(sorted[i], anchor);
        }
      }
    };

    // 逐层处理：所有层级的 ul
    const allLists = root.querySelectorAll('ul');
    for (const ul of allLists) processList(ul);
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
  }

  const api = { compareNames, sortByName, sortPaths, directButton, applyNaturalOrder };

  // 浏览器：挂到 window.MarkdownPreview.nameSort
  if (global.window && global.window.MarkdownPreview !== undefined) {
    global.window.MarkdownPreview.nameSort = api;
  } else if (global.window) {
    global.window.MarkdownPreview = { nameSort: api };
  }

  // Node：CommonJS 导出（构建脚本共用同一实现）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
