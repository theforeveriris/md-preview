/**
 * marked-footnote 扩展打包入口
 * 暴露为 window.markedFootnote，供 markdown.js 通过 marked.use() 注册
 */
import markedFootnote from 'marked-footnote';

if (typeof globalThis !== 'undefined') globalThis.markedFootnote = markedFootnote;
if (typeof window !== 'undefined') window.markedFootnote = markedFootnote;
if (typeof self !== 'undefined') self.markedFootnote = markedFootnote;

export default markedFootnote;
