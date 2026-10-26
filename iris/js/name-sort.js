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
      // numeric: 数字段按数值比较（1.0 < 2.0 < 9.0 < 10.0）
      // caseFirst: 'upper' —— ASCII 大写优先（A.md 排在 a.md 前面）
      //   注意不能用 sensitivity: 'base'：那会让 A.md 与 a.md 比较结果为 0，
      //   最终顺序取决于文件系统 readdir 的原始返回顺序，跨平台不确定。
      //   caseFirst 在 Chrome 24+ / Firefox 55+ / Safari 11+ / Node 0.12+ 均可用。
      collator = new Intl.Collator(undefined, { numeric: true, caseFirst: 'upper' });
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

  // ===== 排序策略 =====

  /** 排序策略 id（设置项 settings.treeSort 的取值） */
  const SORT_MODES = {
    smart: 'smart',                 // 智能顺序：名称自然序（默认）
    createdDesc: 'createdDesc',     // 最初创建时间：新 → 旧
    createdAsc: 'createdAsc',       // 最初创建时间：旧 → 新
    modifiedDesc: 'modifiedDesc',   // 最后修改时间：新 → 旧
    modifiedAsc: 'modifiedAsc',     // 最后修改时间：旧 → 新
  };

  const DEFAULT_SORT_MODE = SORT_MODES.smart;

  function isValidSortMode(mode) {
    return Object.prototype.hasOwnProperty.call(SORT_MODES, mode);
  }

  /**
   * 取排序策略对应的时间字段名；智能顺序返回 null。
   * @param {string} mode
   * @returns {'created'|'modified'|null}
   */
  function timeFieldOf(mode) {
    switch (mode) {
      case SORT_MODES.createdDesc:
      case SORT_MODES.createdAsc:
        return 'created';
      case SORT_MODES.modifiedDesc:
      case SORT_MODES.modifiedAsc:
        return 'modified';
      default:
        return null;
    }
  }

  /**
   * 按指定策略比较两个条目（文件夹 / 文件通用）。
   *
   * - 智能顺序：名称自然序（大写优先 + 数字段按数值）
   * - 时间策略：按时间字段比较；时间相同或缺失时回退到名称自然序，保证顺序稳定确定
   *
   * @param {{name: string, created?: number, modified?: number}} a
   * @param {{name: string, created?: number, modified?: number}} b
   * @param {string} mode 排序策略 id
   * @returns {number} 负数表示 a 排在前面
   */
  function compareEntries(a, b, mode) {
    const field = timeFieldOf(mode);
    if (field) {
      const ta = Number(a && a[field]) || 0;
      const tb = Number(b && b[field]) || 0;
      if (ta !== tb) {
        // createdAsc / modifiedAsc 为正序（旧的在前），其余为倒序
        const ascending = mode === SORT_MODES.createdAsc || mode === SORT_MODES.modifiedAsc;
        return ascending ? ta - tb : tb - ta;
      }
      // 时间相同（含都缺失）→ 回退到名称自然序，避免顺序不确定
    }
    return compareNames(a && a.name, b && b.name);
  }

  /**
   * 按指定策略排序条目（不修改入参）。
   * 文件夹与文件请分组后分别调用，以保持「文件夹在前」的既有约定。
   *
   * @template {{name: string}} T
   * @param {T[]} items
   * @param {string} mode 排序策略 id
   * @returns {T[]}
   */
  function sortEntries(items, mode) {
    const list = items.slice();
    const effective = isValidSortMode(mode) ? mode : DEFAULT_SORT_MODE;
    return list.sort((a, b) => compareEntries(a, b, effective));
  }

  /**
   * 按指定策略重排 Shadow DOM 中的每一级列表。
   *
   * vendor 组件（@webreflection/file-tree）在每次 append() 后用纯字典序
   * （name.localeCompare(name)）重排同级节点，数字开头的文件名会排错位：
   * 1.0 1.1 10.0 11.0 2.0 …。上游尚未修复，故在此兜底重排。
   *
   * 规则与 vendor 保持一致：文件夹在前、文件在后；组内按所选策略排序
   * （智能顺序 = 名称自然序；时间策略按对应时间字段，缺失时回退名称序）。
   *
   * @param {ShadowRoot|Document|null} root 传入 ShadowRoot 或 Document
   * @param {object} [opts]
   * @param {string} [opts.mode] 排序策略 id，默认 smart（名称自然序）
   * @param {(li: Element) => {created?: number, modified?: number}} [opts.resolveMeta]
   *        按 li 取时间元数据的回调（时间排序需要）
   */
  function applyNaturalOrder(root, opts) {
    if (!root) return;
    const options = opts || {};
    const mode = isValidSortMode(options.mode) ? options.mode : DEFAULT_SORT_MODE;
    const resolveMeta = typeof options.resolveMeta === 'function' ? options.resolveMeta : null;

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
        const meta = resolveMeta ? (resolveMeta(li) || {}) : {};
        return { li, name: safeDecode(name.trim()), isFolder, created: meta.created, modified: meta.modified };
      });

      // 稳定排序：文件夹在前，文件在后，组内按所选策略
      const sorted = decorated
        .map((d, i) => ({ d, i }))
        .sort((x, y) => {
          if (x.d.isFolder !== y.d.isFolder) return x.d.isFolder ? -1 : 1;
          const byStrategy = compareEntries(x.d, y.d, mode);
          return byStrategy !== 0 ? byStrategy : x.i - y.i;
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

  const api = {
    compareNames,
    sortByName,
    sortPaths,
    directButton,
    applyNaturalOrder,
    SORT_MODES,
    DEFAULT_SORT_MODE,
    isValidSortMode,
    timeFieldOf,
    compareEntries,
    sortEntries,
  };

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
