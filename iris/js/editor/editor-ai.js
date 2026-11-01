/**
 * editor-ai - 编辑器 AI 助手（用户自带 Key，浏览器直连）
 *
 * 配置：设置面板「编辑器」分组：
 *   - API Base URL（OpenAI 兼容，默认 https://api.openai.com/v1）
 *   - API Key（仅存本机 localStorage，随设置导出时**不带走**）
 *   - 模型名（默认 gpt-4o-mini）
 * Key 缺失时点 AI 按钮给出配置指引，不报错。
 *
 * 动作（编辑器选中工具栏 / 右键菜单入口）：
 *   - 润色 / 翻译为英文 / 翻译为中文 / 解释 / 生成 Mermaid / 自定义指令（prompt 弹窗）
 * 输出策略：
 *   - 润色/翻译：原位替换选区（可 Ctrl+Z 撤销——走 CM 正常事务）
 *   - 解释：选区后插入引用块
 *   - 生成 Mermaid：选区后插入 ```mermaid 围栏
 *   - 全部动作以「选区 + 前后文片段」作为输入，请求带 30s 超时与中止
 *
 * 隐私：选中内容只发往用户自己填写的 endpoint；站点作者不设任何代理。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.editorModules = window.MarkdownPreview.editorModules || {};

  const KEY_BASE = 'md-preview-ai-base';
  const KEY_KEY = 'md-preview-ai-key';
  const KEY_MODEL = 'md-preview-ai-model';

  function t(key, fallback) {
    const i18n = window.MarkdownPreview.i18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, fallback);
    return fallback;
  }

  // ============== 配置存取 ==============

  function getConfig() {
    let base = '', key = '', model = '';
    try {
      base = localStorage.getItem(KEY_BASE) || '';
      key = localStorage.getItem(KEY_KEY) || '';
      model = localStorage.getItem(KEY_MODEL) || '';
    } catch (e) { /* ignore */ }
    // 桌面端持久化桥：有则优先读（独立窗口共享配置）
    const bridge = window.desktopAIConfig;
    if (bridge) {
      if (bridge.getBase) base = bridge.getBase() || base;
      if (bridge.getKey) key = bridge.getKey() || key;
      if (bridge.getModel) model = bridge.getModel() || model;
    }
    return {
      base: (base || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      key,
      model: model || 'gpt-4o-mini'
    };
  }

  function setConfig(base, key, model) {
    try {
      if (base != null) localStorage.setItem(KEY_BASE, base.trim());
      if (key != null) localStorage.setItem(KEY_KEY, key.trim());
      if (model != null) localStorage.setItem(KEY_MODEL, model.trim());
    } catch (e) { /* ignore */ }
    const bridge = window.desktopAIConfig;
    if (bridge && bridge.set) bridge.set(base, key, model);
  }

  // ============== OpenAI 兼容补全 ==============

  let inflight = null; // AbortController：连续点击时取消上一个

  async function chat(messages, opts) {
    const cfg = getConfig();
    if (!cfg.key) {
      const err = new Error('no-key');
      err.code = 'no-key';
      throw err;
    }
    if (inflight) inflight.abort();
    inflight = new AbortController();
    const timer = setTimeout(() => inflight.abort(), 60000);

    try {
      const resp = await fetch(cfg.base + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: opts && typeof opts.temperature === 'number' ? opts.temperature : 0.4
        }),
        signal: inflight.signal
      });
      if (!resp.ok) {
        let detail = 'HTTP ' + resp.status;
        if (resp.status === 401) detail = t('ai.errAuth', '鉴权失败（401）——检查 API Key');
        else if (resp.status === 429) detail = t('ai.errRate', '触发限流（429）——稍后重试');
        else {
          try {
            const body = await resp.json();
            if (body && body.error && body.error.message) detail += ': ' + body.error.message;
          } catch (e) { /* ignore */ }
        }
        throw new Error(detail);
      }
      const data = await resp.json();
      const text = data && data.choices && data.choices[0] && data.choices[0].message
        ? String(data.choices[0].message.content || '').trim() : '';
      if (!text) throw new Error(t('ai.errEmpty', '模型返回为空'));
      return text;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(t('ai.errAbort', '请求已取消或超时'));
      throw e;
    } finally {
      clearTimeout(timer);
      inflight = null;
    }
  }

  // ============== 提示词 ==============

  function buildMessages(action, selected, before, after, customPrompt) {
    const contextNote = (before || after)
      ? '\n\n' + t('ai.ctxNote', '（供参考的上下文，不必输出）：') +
        (before ? `\n…${before}` : '') + `[${selected}]` + (after ? `${after}…` : '')
      : '';
    switch (action) {
      case 'polish':
        return [
          { role: 'system', content: t('ai.sysPolish', '你是中文技术文档编辑。润色用户给出的文字：保持原意与技术准确性，让表达更流畅专业；保持 Markdown 行内格式；只输出润色结果，不要解释。') },
          { role: 'user', content: selected + contextNote }
        ];
      case 'translate-en':
        return [
          { role: 'system', content: t('ai.sysTransEn', 'Translate the user text to natural technical English. Keep inline Markdown formatting. Output only the translation.') },
          { role: 'user', content: selected + contextNote }
        ];
      case 'translate-zh':
        return [
          { role: 'system', content: t('ai.sysTransZh', '你是技术翻译。把用户给出的文字翻译成流畅的简体中文，术语准确；保持 Markdown 行内格式；只输出译文。') },
          { role: 'user', content: selected + contextNote }
        ];
      case 'explain':
        return [
          { role: 'system', content: t('ai.sysExplain', '你是技术讲解者。用简体中文解释用户给出的文字/配置/命令：一句话结论 + 分点说明关键点，控制在 120 字内；输出纯 Markdown 引用内容（每行以 > 开头），不要重复原文。') },
          { role: 'user', content: selected + contextNote }
        ];
      case 'mermaid':
        return [
          { role: 'system', content: t('ai.sysMermaid', '你是图表助手。把用户描述的内容转成一个 mermaid 图代码：根据语义选 flowchart / sequenceDiagram / stateDiagram-v2 等；节点文字简洁；只输出一个完整的 ```mermaid 代码块，不要解释。') },
          { role: 'user', content: selected + contextNote }
        ];
      default: // custom
        return [
          { role: 'system', content: t('ai.sysCustom', '你是写作助手，直接按用户指令处理给定的文字。只输出处理结果本身，不要解释。') },
          { role: 'user', content: (customPrompt || '') + '\n\n---\n\n' + selected + contextNote }
        ];
    }
  }

  // ============== 轻量 UI（toast / prompt 复用编辑器全局件） ==============

  function toast(msg) {
    let el = document.querySelector('.mini-toast[data-owner="ai"]');
    if (!el) {
      el = document.createElement('div');
      el.className = 'mini-toast';
      el.dataset.owner = 'ai';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('open');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('open'), 3000);
  }

  function aiToast() {
    let el = document.getElementById('aiWorkingToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aiWorkingToast';
      el.className = 'mini-toast ai-working';
      el.setAttribute('role', 'status');
      el.innerHTML = '<span class="ai-spinner" aria-hidden="true"></span><span class="ai-working-text"></span>';
      document.body.appendChild(el);
    }
    return el;
  }

  function promptCustom() {
    return new Promise(resolve => {
      const existing = document.getElementById('aiPromptOverlay');
      if (existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.id = 'aiPromptOverlay';
      overlay.className = 'ai-prompt-overlay';
      overlay.innerHTML = `
        <div class="ai-prompt-card" role="dialog" aria-modal="true" aria-label="${esc(t('ai.customTitle', '自定义 AI 指令'))}">
          <div class="ai-prompt-title">${esc(t('ai.customTitle', '自定义 AI 指令'))}</div>
          <textarea class="ai-prompt-input" rows="3" placeholder="${esc(t('ai.customPlaceholder', '例如：改写成表格；拆成三个小节；补充一个配置示例…'))}"></textarea>
          <div class="ai-prompt-actions">
            <button type="button" class="ai-prompt-cancel">${esc(t('common.cancel', '取消'))}</button>
            <button type="button" class="ai-prompt-ok">${esc(t('ai.run', '执行'))}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('.ai-prompt-input');
      const close = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector('.ai-prompt-ok').addEventListener('click', () => close(input.value.trim()));
      overlay.querySelector('.ai-prompt-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close(null);
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) close(input.value.trim());
      });
      requestAnimationFrame(() => input.focus());
    });
  }

  // ============== 核心执行 ==============

  function runAIAction(ctx, action) {
    const { getCells, getActiveCellId, showToast } = ctx;
    const cells = getCells();
    const cell = cells.find(c => c.id === getActiveCellId()) || cells[0];
    if (!cell) return;
    const editor = cell.textarea; // CodeMirrorEditor 兼容层
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end).trim();
    if (!selected) {
      showToast(t('ai.needSelection', '先选中一段文字再使用 AI 动作'));
      return;
    }

    const begin = async () => {
      // 自定义动作先问指令
      let customPrompt = null;
      if (action === 'custom') {
        customPrompt = await promptCustom();
        if (!customPrompt) return;
      }

      const working = aiToast();
      working.querySelector('.ai-working-text').textContent =
        t('ai.working', 'AI 正在处理…');
      working.classList.add('open');

      try {
        const value = editor.value;
        const before = value.slice(Math.max(0, start - 400), start);
        const after = value.slice(end, end + 200);
        const text = await chat(buildMessages(action, selected, before, after, customPrompt));

        // 就地写入（CM 正常事务 → 可 Ctrl+Z）
        let clean = text;
        // mermaid 动作：剥掉模型可能带上的围栏，统一以裸代码插入
        if (action === 'mermaid') {
          clean = text.replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '').trim();
        }
        // 引用动作（explain）逐行挂 >
        let insert;
        if (action === 'explain') {
          insert = clean.split('\n').map(l => '> ' + l).join('\n') + '\n';
        } else if (action === 'mermaid') {
          insert = '\n```mermaid\n' + clean + '\n```\n';
        } else {
          insert = clean;
        }

        editor.dispatch({
          changes: action === 'explain' || action === 'mermaid'
            ? { from: end, to: end, insert }
            : { from: start, to: end, insert },
          selection: action === 'explain' || action === 'mermaid'
            ? { anchor: end + insert.length }
            : { anchor: start + insert.length }
        });
        // 触发 modified 标记（编辑器把 onInput 挂在 view 上；直接派发不触发
        // textarea 的 input 兼容层时手动补）
        if (typeof editor._notifyInput === 'function') editor._notifyInput();
        else if (cell && typeof window.MarkdownPreview.editorMarkModified === 'function') {
          window.MarkdownPreview.editorMarkModified(cell);
        }
      } catch (e) {
        if (e.code === 'no-key') {
          showToast(t('ai.needKey', '请先在设置面板填写 AI API Key'));
          // 顺手打开设置（若可达）
          if (window.MarkdownPreview.settings && window.MarkdownPreview.settings.open) {
            window.MarkdownPreview.settings.open();
          }
        } else {
          showToast(t('ai.failed', 'AI 请求失败：') + (e.message || e));
        }
      } finally {
        working.classList.remove('open');
      }
    };
    begin();
  }

  // ============== 设置面板区块 ==============

  function ensureSettingsSection() {
    const anchor = document.getElementById('editorSettingsAnchor');
    if (!anchor || document.getElementById('aiSettingsBlock')) return;
    const block = document.createElement('div');
    block.id = 'aiSettingsBlock';
    block.innerHTML = `
      <div class="settings-group-title">${esc(t('ai.settingsTitle', 'AI 助手（自带 Key）'))}</div>
      <div class="settings-group-body">
        <div class="setting-item-vertical">
          <label for="aiBaseUrlInput">${esc(t('ai.baseUrl', 'API Base URL（OpenAI 兼容）'))}</label>
          <input type="text" id="aiBaseUrlInput" class="setting-input" placeholder="https://api.openai.com/v1" autocomplete="off">
        </div>
        <div class="setting-item-vertical">
          <label for="aiKeyInput">${esc(t('ai.apiKey', 'API Key'))}</label>
          <input type="password" id="aiKeyInput" class="setting-input" placeholder="sk-…" autocomplete="off">
          <div class="setting-hint">${esc(t('ai.keyHint', '仅保存在本机浏览器，不随设置备份导出，不发送到站点作者。'))}</div>
        </div>
        <div class="setting-item-vertical">
          <label for="aiModelInput">${esc(t('ai.model', '模型名'))}</label>
          <input type="text" id="aiModelInput" class="setting-input" placeholder="gpt-4o-mini" autocomplete="off">
        </div>
      </div>`;
    anchor.parentNode.insertBefore(block, anchor);

    const cfg = getConfig();
    block.querySelector('#aiBaseUrlInput').value = cfg.base;
    block.querySelector('#aiKeyInput').value = cfg.key;
    block.querySelector('#aiModelInput').value = cfg.model;
    const save = () => setConfig(
      block.querySelector('#aiBaseUrlInput').value,
      block.querySelector('#aiKeyInput').value,
      block.querySelector('#aiModelInput').value
    );
    ['aiBaseUrlInput', 'aiKeyInput', 'aiModelInput'].forEach(id => {
      block.getElementByIdSafe = null;
      const el = document.getElementById(id);
      el.addEventListener('change', save);
      el.addEventListener('blur', save);
    });
  }

  // ============== 工具栏按钮装配（编辑器模板注入后调用） ==============

  function ensureToolbarButtons() {
    const bar = document.getElementById('selectionToolbar');
    if (!bar || bar.querySelector('.sel-btn[data-format^="ai-"]')) return;
    const div = document.createElement('span');
    div.className = 'sel-divider';
    const mk = (action, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sel-btn';
      b.dataset.format = 'ai-' + action;
      b.title = label;
      b.textContent = label;
      return b;
    };
    const items = [
      mk('polish', t('ai.actPolish', '润色')),
      mk('translate-en', t('ai.actTransEn', '译英')),
      mk('translate-zh', t('ai.actTransZh', '译中')),
      mk('explain', t('ai.actExplain', '解释')),
      mk('mermaid', t('ai.actMermaid', 'Mermaid')),
      mk('custom', t('ai.actCustom', 'AI✦'))
    ];
    const frag = document.createDocumentFragment();
    frag.appendChild(div);
    items.forEach(b => frag.appendChild(b));
    bar.appendChild(frag);

    // 事件接管：sel-btn 的统一委托按 applyFormat 处理，ai-* 拦截
    bar.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('.sel-btn[data-format^="ai-"]');
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation(); // 阻断 editor.js 的统一 applyFormat 委托
      const mod = window.MarkdownPreview.editorAI;
      if (mod && mod._ctx) mod.run(btn.dataset.format.slice(3));
    }, true);
  }

  // ============== 模块入口（editor.js 的 editorModules 体系） ==============

  window.MarkdownPreview.editorModules.editorAI = {
    init: function(ctx) {
      this._ctx = ctx;
      ensureToolbarButtons();
      // 设置面板区块：设置面板是常驻 DOM，锚点在则直接装配
      ensureSettingsSection();
      window.MarkdownPreview.editorAI = {
        run: (action) => runAIAction(ctx, action),
        getConfig,
        setConfig,
        chat
      };
      // 设置面板晚于编辑器打开时也要补区块（懒模板注入时锚点才存在）
      setTimeout(() => ensureSettingsSection(), 800);
    },
    run: function(action) { if (this._ctx) runAIAction(this._ctx, action); }
  };
})();
