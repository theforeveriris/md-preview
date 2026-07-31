(function() {
  window.MarkdownPreview = window.MarkdownPreview || {};
  window.MarkdownPreview.renderers = window.MarkdownPreview.renderers || {};
  
  function encode64(data) {
    let r = '';
    for (let i = 0; i < data.length; i += 3) {
      if (i + 2 === data.length) {
        r += append3bytes(data[i], data[i + 1], 0);
      } else if (i + 1 === data.length) {
        r += append3bytes(data[i], 0, 0);
      } else {
        r += append3bytes(data[i], data[i + 1], data[i + 2]);
      }
    }
    return r;
  }
  
  function append3bytes(b1, b2, b3) {
    const c1 = b1 >> 2;
    const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
    const c3 = ((b2 & 0xF) << 2) | (b3 >> 6);
    const c4 = b3 & 0x3F;
    return encode6bit(c1 & 0x3F) + encode6bit(c2 & 0x3F) + encode6bit(c3 & 0x3F) + encode6bit(c4 & 0x3F);
  }
  
  function encode6bit(b) {
    if (b < 10) {
      return String.fromCharCode(48 + b);
    }
    b -= 10;
    if (b < 26) {
      return String.fromCharCode(65 + b);
    }
    b -= 26;
    if (b < 26) {
      return String.fromCharCode(97 + b);
    }
    b -= 26;
    if (b === 0) {
      return '-';
    }
    if (b === 1) {
      return '_';
    }
    return '?';
  }
  
  function encodePlantUML(source) {
    const encoder = new TextEncoder();
    const utf8 = encoder.encode(source);
    const compressed = pako.deflateRaw(utf8);
    return encode64(compressed);
  }
  
  async function render() {
    // 没有 plantuml 代码块时直接跳过，避免无谓加载 pako
    if (!document.querySelector('.markdown-body pre code.language-plantuml')) {
      return;
    }

    if (typeof pako === 'undefined') {
      await window.MarkdownPreview.loadScript('iris/vendor/pako.min.js');
    }
    if (typeof pako === 'undefined') {
      console.error('Pako library failed to load');
      return;
    }

    const allPres = document.querySelectorAll('.markdown-body pre');
    
    for (let i = 0; i < allPres.length; i++) {
      const pre = allPres[i];
      const codeElement = pre.querySelector('code');
      
      if (!codeElement) continue;
      
      const classList = codeElement.className;
      if (!classList || !classList.includes('language-plantuml')) continue;
      
      const plantumlCode = codeElement.textContent.trim();
      
      try {
        const encoded = encodePlantUML(plantumlCode);
        const container = document.createElement('div');
        container.className = 'plantuml-diagram';
        container.innerHTML = `<img src="https://www.plantuml.com/plantuml/svg/${encoded}" alt="PlantUML 图" loading="lazy">`;
        pre.replaceWith(container);
      } catch (error) {
        console.error('PlantUML encoding error:', error);
        const errorDiv = document.createElement('div');
        errorDiv.style.color = '#ff6b6b';
        errorDiv.style.padding = '10px';
        errorDiv.style.border = '1px solid #ff6b6b';
        errorDiv.style.borderRadius = '4px';
        errorDiv.textContent = 'PlantUML 渲染错误: ' + error.message;
        pre.replaceWith(errorDiv);
      }
    }
  }
  
  window.MarkdownPreview.renderers.plantuml = {
    render
  };
})();
