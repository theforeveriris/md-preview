/**
 * 设置备份导入 / 导出（settings.js 拆分）
 *
 * 带走外观与阅读相关的全部 localStorage 键：设置、主题（含自动配对、
 * 自定义 CSS / hljs）与界面语言。导入采用「写回后刷新」，保证主题、
 * 字体、i18n 等按启动流程重新应用，避免逐项手工同步遗漏。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  // 带走外观与阅读相关的全部 localStorage 键：设置、主题（含自动配对、
  // 自定义 CSS / hljs）与界面语言。导入采用「写回后刷新」，保证主题、
  // 字体、i18n 等按启动流程重新应用，避免逐项手工同步遗漏。

  const BACKUP_KEYS = {
    settings: 'md-preview-settings',
    theme: 'md-preview-theme',
    themeLight: 'md-preview-theme-light',
    themeDark: 'md-preview-theme-dark',
    customCss: 'md-preview-custom-css',
    customHljs: 'md-preview-custom-hljs',
    lang: 'md-preview-lang'
  };

  // 与 theme-manager.js 的 VALID_THEMES 保持一致（'auto' 另计）
  const VALID_THEMES = ['default', 'iris', 'github-light', 'github-dark', 'notion', 'arc', 'dracula', 'nord', 'print', 'blueprint', 'newsprint', 'swiss', 'terminal', 'neon', 'sepia', 'watercolor', 'graphite', 'notebook', 'museum', 'editorial', 'aurora', 'typewriter', 'blackboard', 'parcel', 'aaa'];

  function validBackupLang(v) {
    return v === 'auto' || v === 'zh' || v === 'en';
  }

  function exportSettings() {
    const data = {};
    Object.keys(BACKUP_KEYS).forEach(name => {
      try {
        const val = localStorage.getItem(BACKUP_KEYS[name]);
        if (val != null) data[name] = val;
      } catch (e) { /* 隐私模式等场景跳过 */ }
    });
    const payload = {
      app: 'md-preview',
      type: 'settings-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'md-preview-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function validBackupLang(v) {
    return v === 'auto' || v === 'zh' || v === 'en';
  }

  async function importSettings(file, t) {
    const T = t || ((k, fb) => fb);
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (e) {
      alert(T('settings.backup.invalid', '导入失败：不是有效的设置备份文件'));
      return;
    }
    if (!payload || payload.app !== 'md-preview' || payload.type !== 'settings-backup' ||
        !payload.data || typeof payload.data !== 'object') {
      alert(T('settings.backup.invalid', '导入失败：不是有效的设置备份文件'));
      return;
    }
    const data = payload.data;
    try {
      // 备份文件来自外部，逐项校验：
      //   - 所有键值必须是字符串（曾直接把任意值 String() 后写进 localStorage）
      //   - settings 非空时必须能解析成「非数组对象」
      Object.keys(BACKUP_KEYS).forEach(name => {
        const val = data[name];
        if (val == null) return;
        if (typeof val !== 'string') throw new Error('bad value type: ' + name);
      });
      if (typeof data.settings === 'string' && data.settings.trim()) {
        const parsedSettings = JSON.parse(data.settings);
        if (!parsedSettings || typeof parsedSettings !== 'object' || Array.isArray(parsedSettings)) {
          throw new Error('bad settings');
        }
      }
      if (data.theme != null && data.theme !== '') {
        if (!VALID_THEMES.includes(data.theme) && data.theme !== 'auto') throw new Error('bad theme');
      }
      if (data.lang != null && !validBackupLang(data.lang)) throw new Error('bad lang');
      Object.keys(BACKUP_KEYS).forEach(name => {
        const val = data[name];
        if (val == null) return;
        localStorage.setItem(BACKUP_KEYS[name], String(val));
      });
    } catch (e) {
      alert(T('settings.backup.invalid', '导入失败：不是有效的设置备份文件'));
      return;
    }
    location.reload();
  }

  window.MarkdownPreview.settingsBackup = {
    BACKUP_KEYS,
    exportSettings,
    importSettings,
    // settings.js initSettingsPanel 调用：注入按钮与文案函数
    wire: function(els) {
      const { backupExportBtn, backupImportBtn, backupImportInput, t } = els;
      const T = (key, fallback) => (t || ((k, fb) => fb))(key, fallback);
      backupExportBtn?.addEventListener('click', exportSettings);
      backupImportBtn?.addEventListener('click', () => backupImportInput?.click());
      backupImportInput?.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) await importSettings(file, T);
        e.target.value = '';
      });
    }
  };
})();
