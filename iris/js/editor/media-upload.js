/**
 * 编辑器图片上传子系统（editor.js 拆分第一批）
 *
 * 从 editor.js 外移：图床配置读写、base64/host 上传、粘贴与拖拽入口的
 * insertImageToCell、上传设置弹出层接线。与编辑器主体通过 init(ctx)
 * 注入的协作对象解耦。
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.editorModules = window.MarkdownPreview.editorModules || {};

  window.MarkdownPreview.editorModules.mediaUpload = {
    init: function(ctx) {
      const editorT = ctx.editorT;
      const showToast = ctx.showToast;
      const markUnsaved = ctx.markUnsaved;
      const insertAtCursor = ctx.insertAtCursor;
      const imageUploadBtn = ctx.imageUploadBtn;
      const imageUploadPopover = ctx.imageUploadPopover;

  const IMAGE_UPLOAD_KEY = 'mdnb_image_upload';

  function getImageUploadConfig() {
    try {
      const raw = localStorage.getItem(IMAGE_UPLOAD_KEY);
      if (!raw) return { mode: 'base64', url: '', headers: '' };
      const cfg = JSON.parse(raw);
      return {
        mode: cfg.mode === 'host' ? 'host' : 'base64',
        url: cfg.url || '',
        headers: cfg.headers || '',
      };
    } catch (e) {
      return { mode: 'base64', url: '', headers: '' };
    }
  }

  function setImageUploadConfig(cfg) {
    try {
      localStorage.setItem(IMAGE_UPLOAD_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImageToHost(file, config) {
    const formData = new FormData();
    formData.append('file', file, file.name || 'image.png');
    const headers = {};
    if (config.headers) {
      try {
        Object.assign(headers, JSON.parse(config.headers));
      } catch (e) {
        throw new Error('自定义请求头 JSON 格式错误');
      }
    }
    const resp = await fetch(config.url, {
      method: 'POST',
      body: formData,
      headers,
    });
    if (!resp.ok) throw new Error('图床返回错误：HTTP ' + resp.status);
    const text = await resp.text();
    // 尝试解析 JSON，支持 { url } / { data: { url } } / { link } 等常见格式
    let data;
    try { data = JSON.parse(text); } catch (e) {
      // 非 JSON 响应，若看起来像 URL 直接使用
      const trimmed = text.trim();
      if (/^https?:\/\//.test(trimmed)) return trimmed;
      throw new Error('图床响应无法解析：' + text.slice(0, 100));
    }
    const url = data.url || data.link || (data.data && (data.data.url || data.data.link)) || data.image;
    if (!url || typeof url !== 'string') throw new Error('图床响应缺少 url 字段');
    return url;
  }

  // 正在处理的图片标记，避免同一文件重复插入（以 file 为 key，
  // 这样同一次粘贴/拖拽多张图片可以并发插入，而不会被 cellData 粒度拦截）
  const _imageProcessing = new WeakSet();

  // base64 图片体积上限：超大图会撑爆自动保存序列化并必然超 localStorage
  // 配额（自动保存失败 = 数据丢失面）。图床上传路径不受此限。
  const MAX_BASE64_IMAGE_BYTES = 2 * 1024 * 1024;

  async function insertImageToCell(cellData, file) {
    if (!cellData || !file) return;
    if (_imageProcessing.has(file)) return;
    const config = getImageUploadConfig();
    const fileName = (file.name || 'image').replace(/[`\[\]()]/g, '').replace(/\.[^.]+$/, '') || 'image';
    ctx.setActiveCellId(cellData.id);
    cellData.textarea.focus();

    if (config.mode === 'host' && config.url) {
      showToast(editorT('editor.uploadingImage', '正在上传图片到图床…'));
      _imageProcessing.add(file);
      try {
        const url = await uploadImageToHost(file, config);
        const md = `![${fileName}](${url})`;
        insertAtCursor(cellData.textarea, md, 0);
        showToast(editorT('editor.imageUploadOk', '图片上传成功'));
        markUnsaved();
      } catch (e) {
        // 上传失败时回退到 base64（超大图无法回退，直接失败）
        if (file.size > MAX_BASE64_IMAGE_BYTES) {
          showToast(editorT('editor.uploadFailNoFallback', '图床上传失败：{m}；图片超过 2MB，无法回退 base64').replace('{m}', e.message));
          return;
        }
        showToast(editorT('editor.uploadFailFallback', '图床上传失败：{m}，回退到 base64').replace('{m}', e.message));
        try {
          const dataUrl = await fileToBase64(file);
          const md = `![${fileName}](${dataUrl})`;
          insertAtCursor(cellData.textarea, md, 0);
          markUnsaved();
        } catch (e2) {
          showToast(editorT('editor.imageInsertFail', '图片插入失败：{m}').replace('{m}', e2.message));
        }
      } finally {
        _imageProcessing.delete(file);
      }
    } else {
      // base64 模式
      if (file.size > MAX_BASE64_IMAGE_BYTES) {
        showToast(editorT('editor.imageTooLarge', '图片 {m}MB 超过 base64 模式 2MB 上限，已拒绝；可配置图床后重试').replace('{m}', (file.size / 1024 / 1024).toFixed(1)));
        return;
      }
      _imageProcessing.add(file);
      try {
        const dataUrl = await fileToBase64(file);
        const md = `![${fileName}](${dataUrl})`;
        insertAtCursor(cellData.textarea, md, 0);
        showToast(editorT('editor.imageInsertedBase64', '图片已插入（base64）'));
        markUnsaved();
      } catch (e) {
        showToast(editorT('editor.imageInsertFail', '图片插入失败：{m}').replace('{m}', e.message));
      } finally {
        _imageProcessing.delete(file);
      }
    }
  }

      // ============== 上传设置弹出层 ==============

  if (imageUploadBtn && imageUploadPopover) {
    imageUploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = imageUploadBtn.getBoundingClientRect();
      imageUploadPopover.style.top = (rect.bottom + 4) + 'px';
      imageUploadPopover.style.right = (window.innerWidth - rect.right) + 'px';
      imageUploadPopover.style.left = 'auto';
      // 加载当前配置到 UI
      const cfg = getImageUploadConfig();
      const radioBase = imageUploadPopover.querySelector('input[value="base64"]');
      const radioHost = imageUploadPopover.querySelector('input[value="host"]');
      const urlInput = document.getElementById('imageUploadUrl');
      const headersInput = document.getElementById('imageUploadHeaders');
      const hostConfig = document.getElementById('imageHostConfig');
      if (cfg.mode === 'host') {
        radioHost.checked = true;
        hostConfig.style.display = '';
      } else {
        radioBase.checked = true;
        hostConfig.style.display = 'none';
      }
      if (urlInput) urlInput.value = cfg.url;
      if (headersInput) headersInput.value = cfg.headers;
      imageUploadPopover.classList.toggle('visible');
    });

    // 模式切换
    imageUploadPopover.querySelectorAll('input[name="imgMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const hostConfig = document.getElementById('imageHostConfig');
        hostConfig.style.display = radio.value === 'host' ? '' : 'none';
      });
    });

    // 保存
    document.getElementById('imageUploadSave')?.addEventListener('click', () => {
      const mode = imageUploadPopover.querySelector('input[name="imgMode"]:checked').value;
      const url = document.getElementById('imageUploadUrl').value.trim();
      const headers = document.getElementById('imageUploadHeaders').value.trim();
      if (mode === 'host' && !url) {
        showToast(editorT('editor.needHostUrl', '请填写图床上传端点 URL'));
        return;
      }
      if (headers) {
        try { JSON.parse(headers); } catch (e) {
          showToast(editorT('editor.badHeadersJson', '自定义请求头不是有效的 JSON'));
          return;
        }
      }
      setImageUploadConfig({ mode, url, headers });
      showToast(mode === 'host' ? editorT('editor.hostConfigSaved', '图床配置已保存') : editorT('editor.base64Mode', '已切换为 base64 模式'));
      imageUploadPopover.classList.remove('visible');
    });

    // 清除
    document.getElementById('imageUploadClear')?.addEventListener('click', () => {
      setImageUploadConfig({ mode: 'base64', url: '', headers: '' });
      const radioBase = imageUploadPopover.querySelector('input[value="base64"]');
      if (radioBase) radioBase.checked = true;
      document.getElementById('imageHostConfig').style.display = 'none';
      const urlInput = document.getElementById('imageUploadUrl');
      const headersInput = document.getElementById('imageUploadHeaders');
      if (urlInput) urlInput.value = '';
      if (headersInput) headersInput.value = '';
      showToast(editorT('editor.hostConfigCleared', '图片上传配置已清除'));
    });

    // 点击外部关闭
    document.addEventListener('click', (e) => {
      if (!imageUploadPopover.contains(e.target) && e.target !== imageUploadBtn) {
        imageUploadPopover.classList.remove('visible');
      }
    });
  }
    }
  };
})();
