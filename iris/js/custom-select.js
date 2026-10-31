/**
 * custom-select - 全站下拉框的自绘替换
 *
 * 为什么不用原生 <select>：原生下拉的弹层由浏览器绘制，
 * 无法跟随站点主题——而本站有 25 套预设主题，各自的底色、
 * 边框、圆角、强调色都不一样，原生下拉在这套主题里始终是
 * 操作系统默认的灰色控件。
 *
 * 做法：原生 <select> 留在 DOM 里（视觉上隐藏）作为「值镜像」，
 * 外面套一层按钮 + 自绘弹层：
 *   - 业务代码照旧读写 select.value、监听 change，
 *     我们在实例上重写 value / selectedIndex 的 setter，
 *     赋值即同步界面；用户点选时写回原生 select 并派发
 *     input + change 事件，现有监听器一行都不用改；
 *   - 键盘与读屏按 combobox + listbox 语义实现；
 *   - 样式全部走主题变量（--color-surface / --color-border /
 *     --color-accent-purple / --radius-control），
 *     所以以后新增主题，这套下拉自动跟随。
 */
(function () {
  'use strict';

  const instances = new WeakMap();
  let openInstance = null;
  let uid = 0;

  function isUpgradable(select) {
    if (!select || select.tagName !== 'SELECT') return false;
    if (select.multiple) return false;
    if (select.size && select.size > 1) return false;
    if (select.dataset && select.dataset.cs === 'off') return false;
    if (select.closest && select.closest('[data-cs="off"]')) return false;
    return true;
  }

  function upgrade(select) {
    if (!isUpgradable(select)) return null;
    if (instances.has(select)) return instances.get(select);

    const wrap = document.createElement('span');
    wrap.className = 'cs';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    // 原生 select 会被 aria-hidden 掉，可访问名要搬到按钮上。
    // 记下「用途标签」（如「图表类型」），读屏时念成「图表类型：折线」，
    // 既说清了字段也说清了当前值。
    let nameLabel = select.getAttribute('aria-label') || '';
    if (!nameLabel && select.id) {
      const lab = document.querySelector('label[for="' + CSS.escape(select.id) + '"]');
      if (lab) nameLabel = lab.textContent.trim();
    }
    if (!nameLabel) {
      // 设置面板里字段名是 .setting-label 的 div，不是 <label for>
      const row = select.closest('.setting-item');
      const lab = row && row.querySelector('.setting-label');
      if (lab) nameLabel = lab.textContent.trim();
    }

    const valueEl = document.createElement('span');
    valueEl.className = 'cs-value';
    const arrow = document.createElement('span');
    arrow.className = 'cs-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    trigger.append(valueEl, arrow);

    // 宽度：把原 select 的宽度语义搬到包裹层上，避免布局塌掉
    const computed = getComputedStyle(select);
    const parentWidth = select.parentElement
      ? select.parentElement.getBoundingClientRect().width
      : 0;
    if (select.style.width) {
      wrap.style.width = select.style.width;
    } else if (computed.width !== 'auto' && parentWidth &&
               Math.abs(parseFloat(computed.width) - parentWidth) < 3) {
      wrap.style.width = '100%';   // 原本就是撑满容器
    }
    if (computed.minWidth && computed.minWidth !== '0px') {
      wrap.style.minWidth = computed.minWidth;
    }
    if (select.style.maxWidth) wrap.style.maxWidth = select.style.maxWidth;

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(trigger);
    wrap.appendChild(select);
    select.classList.add('cs-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    const inst = {
      select,
      wrap,
      trigger,
      valueEl,
      nameLabel,
      menu: null,
      items: [],
      activeIndex: -1,
      typeahead: '',
      typeaheadTimer: 0
    };
    instances.set(select, inst);

    // 值镜像：外部代码给 select.value 赋值时，界面同步更新
    const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (valueDesc) {
      Object.defineProperty(select, 'value', {
        configurable: true,
        get() { return valueDesc.get.call(select); },
        set(v) {
          valueDesc.set.call(select, v);
          syncLabel(inst);
        }
      });
    }
    const indexDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
    if (indexDesc) {
      Object.defineProperty(select, 'selectedIndex', {
        configurable: true,
        get() { return indexDesc.get.call(select); },
        set(v) {
          indexDesc.set.call(select, v);
          syncLabel(inst);
        }
      });
    }
    // 外部用 focus() 时把焦点交给可见的按钮
    const focusFn = select.focus.bind(select);
    select.focus = function () { trigger.focus(); };
    select.blur = function () { trigger.blur(); };
    void focusFn;

    select.addEventListener('change', () => syncLabel(inst));

    trigger.addEventListener('click', () => {
      if (isOpen()) close();
      else open(inst);
    });
    trigger.addEventListener('keydown', (e) => onKeyDown(inst, e));

    if (select.disabled) {
      trigger.disabled = true;
      trigger.setAttribute('aria-disabled', 'true');
    }

    syncLabel(inst);
    return inst;
  }

  function selectedText(select) {
    const opt = select.selectedOptions && select.selectedOptions[0];
    if (opt) return opt.textContent.trim();
    const first = select.options && select.options[0];
    return first ? first.textContent.trim() : '';
  }

  function syncLabel(inst) {
    const text = selectedText(inst.select);
    inst.valueEl.textContent = text;
    if (inst.nameLabel) inst.trigger.setAttribute('aria-label', inst.nameLabel + '：' + text);
    if (inst.menu) buildMenu(inst);
  }

  function isOpen() {
    return openInstance && openInstance.menu && openInstance.menu.style.display !== 'none';
  }

  function buildMenu(inst) {
    const { select, menu } = inst;
    menu.innerHTML = '';
    inst.items = [];
    const frag = document.createDocumentFragment();
    let group = null;
    const opts = Array.from(select.options || []);
    opts.forEach((opt) => {
      const parent = opt.parentElement;
      if (parent && parent.tagName === 'OPTGROUP' && parent !== group) {
        group = parent;
        const label = document.createElement('div');
        label.className = 'cs-group-label';
        label.textContent = group.label || '';
        frag.appendChild(label);
      }
      const el = document.createElement('div');
      el.className = 'cs-option';
      el.id = menu.id + '-opt-' + inst.items.length;
      el.setAttribute('role', 'option');
      const text = opt.textContent.trim();
      el.textContent = text;
      if (opt.disabled) el.setAttribute('aria-disabled', 'true');
      if (opt.value === select.value) el.setAttribute('aria-selected', 'true');
      el.addEventListener('mousedown', (e) => e.preventDefault());  // 别让触发器失焦
      el.addEventListener('click', () => choose(inst, opt.value));
      el.addEventListener('mousemove', () => {
        const idx = inst.items.findIndex((it) => it.el === el);
        if (idx >= 0) setActive(inst, idx);
      });
      inst.items.push({ el, value: opt.value, disabled: !!opt.disabled, text });
      frag.appendChild(el);
    });
    menu.appendChild(frag);

    // 让触发器至少和最宽的一项一样宽（接近原生下拉的观感）
    let widest = 0;
    inst.items.forEach((it) => { widest = Math.max(widest, it.text.length); });
    if (widest) {
      inst.trigger.style.minWidth = '';
      const need = Math.max(inst.trigger.offsetWidth, widest * 8 + 44);
      inst.trigger.style.minWidth = need + 'px';
    }
  }

  function open(inst) {
    if (openInstance && openInstance !== inst) close();
    if (!inst.menu) {
      const menu = document.createElement('div');
      menu.className = 'cs-menu';
      menu.id = 'cs-menu-' + (++uid);
      menu.setAttribute('role', 'listbox');
      menu.style.display = 'none';
      document.body.appendChild(menu);
      inst.menu = menu;
    }
    buildMenu(inst);
    inst.menu.style.display = 'block';
    inst.trigger.setAttribute('aria-expanded', 'true');
    openInstance = inst;

    const selectedIdx = inst.items.findIndex((it) => it.value === inst.select.value);
    setActive(inst, selectedIdx >= 0 ? selectedIdx : firstEnabled(inst));

    position(inst);
    document.addEventListener('pointerdown', onDocPointerDown, true);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
  }

  function firstEnabled(inst) {
    const idx = inst.items.findIndex((it) => !it.disabled);
    return idx >= 0 ? idx : 0;
  }

  function close() {
    const inst = openInstance;
    if (!inst) return;
    openInstance = null;
    if (inst.menu) inst.menu.style.display = 'none';
    inst.trigger.setAttribute('aria-expanded', 'false');
    inst.trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    window.removeEventListener('resize', onReposition);
    window.removeEventListener('scroll', onReposition, true);
  }

  function onDocPointerDown(e) {
    const inst = openInstance;
    if (!inst) return;
    if (inst.wrap.contains(e.target) || (inst.menu && inst.menu.contains(e.target))) return;
    close();
  }

  function onReposition() {
    if (openInstance) position(openInstance);
  }

  function position(inst) {
    const menu = inst.menu;
    const r = inst.trigger.getBoundingClientRect();
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.width = '';
    menu.style.minWidth = Math.round(r.width) + 'px';
    menu.style.maxHeight = '';
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const needed = menu.offsetHeight;
    if (below < needed + 12 && above > below) {
      menu.style.maxHeight = Math.max(140, above - 16) + 'px';
      menu.style.top = Math.max(8, r.top - needed - 4) + 'px';
    } else {
      menu.style.maxHeight = Math.max(140, below - 16) + 'px';
      menu.style.top = (r.bottom + 4) + 'px';
    }
  }

  function setActive(inst, index) {
    if (!inst.items.length) return;
    let i = index;
    if (i < 0) i = 0;
    if (i >= inst.items.length) i = inst.items.length - 1;
    // 跳过禁用项
    let guard = 0;
    while (inst.items[i] && inst.items[i].disabled && guard++ < inst.items.length) {
      i = (i + 1) % inst.items.length;
    }
    inst.activeIndex = i;
    inst.items.forEach((it, idx) => {
      if (idx === i) it.el.setAttribute('data-active', '1');
      else it.el.removeAttribute('data-active');
    });
    const active = inst.items[i];
    if (active) {
      inst.trigger.setAttribute('aria-activedescendant', active.el.id);
      if (active.el.scrollIntoView) active.el.scrollIntoView({ block: 'nearest' });
    }
  }

  function moveActive(inst, delta) {
    if (!inst.items.length) return;
    let i = inst.activeIndex;
    if (i < 0) i = delta > 0 ? -1 : inst.items.length;
    setActive(inst, i + delta);
  }

  function choose(inst, value) {
    inst.select.value = value;
    inst.select.dispatchEvent(new Event('input', { bubbles: true }));
    inst.select.dispatchEvent(new Event('change', { bubbles: true }));
    syncLabel(inst);
    close();
    inst.trigger.focus();
  }

  function commitActive(inst) {
    const item = inst.items[inst.activeIndex];
    if (!item || item.disabled) return;
    choose(inst, item.value);
  }

  function onKeyDown(inst, e) {
    const k = e.key;
    if (!isOpen()) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        open(inst);
        if (k === 'ArrowUp') moveActive(inst, -1);
      }
      return;
    }
    switch (k) {
      case 'ArrowDown': e.preventDefault(); moveActive(inst, 1); break;
      case 'ArrowUp': e.preventDefault(); moveActive(inst, -1); break;
      case 'Home': e.preventDefault(); setActive(inst, 0); break;
      case 'End': e.preventDefault(); setActive(inst, inst.items.length - 1); break;
      case 'Enter':
      case ' ':
      case 'Spacebar': e.preventDefault(); commitActive(inst); break;
      case 'Escape':
      case 'Esc': e.preventDefault(); close(); inst.trigger.focus(); break;
      case 'Tab': close(); break;
      default:
        if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          typeahead(inst, k);
        }
    }
  }

  function typeahead(inst, ch) {
    clearTimeout(inst.typeaheadTimer);
    inst.typeahead += ch.toLowerCase();
    inst.typeaheadTimer = setTimeout(() => { inst.typeahead = ''; }, 600);
    const idx = inst.items.findIndex((it) => !it.disabled && it.text.toLowerCase().startsWith(inst.typeahead));
    if (idx >= 0) setActive(inst, idx);
  }

  function scan(root) {
    const scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('select').forEach(upgrade);
  }

  function init() {
    scan(document);
    // 渲染器/插件会动态插入 <select>，用观察器补挂。
    // 一次渲染可能塞进来成千上万个节点，所以攒到下一帧批量处理，
    // 避免每条 mutation 都去扫一遍子树。
    const pending = new Set();
    let scheduled = false;
    const flush = () => {
      scheduled = false;
      pending.forEach((node) => {
        if (node.nodeType !== 1 || !node.isConnected) return;
        if (node.tagName === 'SELECT') upgrade(node);
        else if (node.querySelectorAll) node.querySelectorAll('select').forEach(upgrade);
      });
      pending.clear();
    };
    const mo = new MutationObserver((records) => {
      records.forEach((rec) => {
        rec.addedNodes.forEach((node) => {
          if (node.nodeType === 1) pending.add(node);
        });
      });
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    });
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true });
    }
    // 切换语言后选项文案会变，重新同步
    window.addEventListener('langchange', () => scan(document));
  }

  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.customSelect = { upgrade, scan, refresh: () => scan(document) };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
