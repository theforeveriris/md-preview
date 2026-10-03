/**
 * IndexedDB 存储层
 * 替代 localStorage 自动保存，突破 5MB 容量限制，支持多笔记本（多标签页）
 *
 * 数据库结构：
 *   db: mdnb-db
 *   store: notebooks  — 笔记本数据（key = notebookId, value = { id, title, cells, saved, version }）
 *   store: meta       — 元信息（key = 'activeTab' / 'tabOrder' 等）
 *
 * 兼容：首次加载时若 IndexedDB 无数据但 localStorage 有旧数据，自动迁移
 */
(function() {
  'use strict';

  window.MarkdownPreview = window.MarkdownPreview || {};

  const DB_NAME = 'mdnb-db';
  const DB_VERSION = 1;
  const STORE_NOTEBOOKS = 'notebooks';
  const STORE_META = 'meta';
  const AUTOSAVE_KEY = 'autosave'; // 单笔记本模式下的默认 key

  let _db = null;
  let _initPromise = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    if (_initPromise) return _initPromise;
    _initPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB 不可用'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
          db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };
      req.onerror = (e) => {
        reject(e.target.error || new Error('IndexedDB 打开失败'));
      };
    });
    return _initPromise;
  }

  function tx(storeName, mode) {
    return openDB().then(db => {
      const transaction = db.transaction(storeName, mode);
      return transaction.objectStore(storeName);
    });
  }

  function reqToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ============== 笔记本 CRUD ==============

  /**
   * 保存笔记本数据
   * @param {Object} data — { id, title, cells, saved, version, ... }
   */
  async function saveNotebook(data) {
    const store = await tx(STORE_NOTEBOOKS, 'readwrite');
    await reqToPromise(store.put(data));
  }

  /**
   * 读取笔记本数据
   * @param {string} id — 笔记本 ID，默认 'autosave'
   */
  async function loadNotebook(id) {
    id = id || AUTOSAVE_KEY;
    const store = await tx(STORE_NOTEBOOKS, 'readonly');
    return await reqToPromise(store.get(id));
  }

  /**
   * 删除笔记本
   */
  async function deleteNotebook(id) {
    const store = await tx(STORE_NOTEBOOKS, 'readwrite');
    await reqToPromise(store.delete(id));
  }

  /**
   * 列出所有笔记本（用于多标签页）
   */
  async function listNotebooks() {
    const store = await tx(STORE_NOTEBOOKS, 'readonly');
    return await reqToPromise(store.getAll());
  }

  // ============== 元信息 ==============

  async function getMeta(key) {
    const store = await tx(STORE_META, 'readonly');
    return await reqToPromise(store.get(key));
  }

  async function setMeta(key, value) {
    const store = await tx(STORE_META, 'readwrite');
    await reqToPromise(store.put(value, key));
  }

  // ============== 迁移 ==============

  /**
   * 从 localStorage 迁移旧数据到 IndexedDB
   * @param {string} lsKey — localStorage 键名
   * @param {string} notebookId — 迁移到 IndexedDB 的笔记本 ID
   * @returns {Object|null} 迁移成功则返回数据，否则 null
   */
  async function migrateFromLocalStorage(lsKey, notebookId) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.cells) || data.cells.length === 0) return null;
      // 确保有 id 字段
      if (!data.id) data.id = notebookId || AUTOSAVE_KEY;
      await saveNotebook(data);
      // 迁移成功后清除 localStorage（释放空间）
      localStorage.removeItem(lsKey);
      return data;
    } catch (e) {
      console.warn('[storage] localStorage 迁移失败:', e);
      return null;
    }
  }

  /**
   * 检测 IndexedDB 是否可用
   */
  function isAvailable() {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch (e) {
      return false;
    }
  }

  window.MarkdownPreview.storage = {
    AUTOSAVE_KEY,
    saveNotebook,
    loadNotebook,
    deleteNotebook,
    listNotebooks,
    getMeta,
    setMeta,
    migrateFromLocalStorage,
    isAvailable,
  };
})();
