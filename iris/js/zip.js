/**
 * zip - 极简 ZIP 写入器（存储型，不压缩）
 *
 * 用途：整站 MD 打包下载（export-bundle.js）与 EPUB 电子书导出。
 * 纯文本场景体积可控，引入 JSZip / fflate 等完整压缩库得不偿失，
 * 故按 PKWARE APPNOTE 自实现 STORE 方法：本地文件头 + 中央目录 + EOCD。
 *
 * 要点：
 *   - CRC32 查表计算；文件名统一 UTF-8（通用位标志 bit 11，中文路径友好）
 *   - 时间取 DOS 格式（2 秒粒度、本地时区），缺省用当前时间
 *   - 全部条目 STORE 不压缩：文本体积可控，EPUB 规范也要求 mimetype
 *     首条目必须未压缩存储
 *   - 单文件 ≤ 4GB、条目 ≤ 65535，对本站场景绰绰有余
 */
(function() {
  'use strict';
  window.MarkdownPreview = window.MarkdownPreview || {};

  // CRC32 查表（IEEE 802.3 多项式，与 ZIP 规范一致）
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return new TextEncoder().encode(String(data));
  }

  // DOS 日期时间（小端两个字）：年偏移 1980，秒按 2s 粒度
  function dosDateTime(date) {
    const d = date instanceof Date ? date : new Date();
    const year = Math.max(1980, d.getFullYear());
    const time = ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F);
    const day = ((year - 1980) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F);
    return { time: time & 0xFFFF, date: day & 0xFFFF };
  }

  // 小端写入器：集中分配一块内存，避免大量小数组拼接
  function ByteWriter(sizeHint) {
    let buf = new Uint8Array(sizeHint || 64 * 1024);
    let len = 0;
    function ensure(extra) {
      if (len + extra <= buf.length) return;
      let cap = buf.length * 2;
      while (cap < len + extra) cap *= 2;
      const next = new Uint8Array(cap);
      next.set(buf.subarray(0, len));
      buf = next;
    }
    return {
      u8(v) { ensure(1); buf[len++] = v & 0xFF; },
      u16(v) { ensure(2); buf[len++] = v & 0xFF; buf[len++] = (v >>> 8) & 0xFF; },
      u32(v) { ensure(4); for (let i = 0; i < 4; i++) { buf[len++] = v & 0xFF; v >>>= 8; } },
      bytes(arr) { ensure(arr.length); buf.set(arr, len); len += arr.length; },
      get length() { return len; },
      blob() { return buf.subarray(0, len); }
    };
  }

  /**
   * 生成 ZIP Blob
   * @param {Array<{name: string, data: string|Uint8Array|ArrayBuffer, date?: Date}>} entries
   * @returns {Blob} application/zip
   */
  function createZip(entries) {
    const encoder = new TextEncoder();
    const nameBytesList = entries.map(e => encoder.encode(e.name));
    const dataList = entries.map(e => toBytes(e.data));
    const crcList = dataList.map(crc32);
    const timeList = entries.map(e => dosDateTime(e.date));

    // 布局预算：每条目 = 30 局部头 + 名 + 数据；中央目录 46 + 名；EOCD 22
    let hint = 22 + 4;
    for (let i = 0; i < entries.length; i++) hint += 30 + 46 + nameBytesList[i].length * 2 + dataList[i].length;

    const out = ByteWriter(hint);
    const offsets = [];
    for (let i = 0; i < entries.length; i++) {
      offsets[i] = out.length;
      out.u32(0x04034b50);        // local file header signature
      out.u16(20);                // version needed
      out.u16(0x0800);            // flags: UTF-8 文件名
      out.u16(0);                 // method: STORE
      out.u16(timeList[i].time);
      out.u16(timeList[i].date);
      out.u32(crcList[i]);
      out.u32(dataList[i].length);
      out.u32(dataList[i].length);
      out.u16(nameBytesList[i].length);
      out.u16(0);                 // extra len
      out.bytes(nameBytesList[i]);
      out.bytes(dataList[i]);
    }

    const cdStart = out.length;
    for (let i = 0; i < entries.length; i++) {
      out.u32(0x02014b50);        // central directory signature
      out.u16(20);                // version made by
      out.u16(20);                // version needed
      out.u16(0x0800);            // flags
      out.u16(0);                 // method
      out.u16(timeList[i].time);
      out.u16(timeList[i].date);
      out.u32(crcList[i]);
      out.u32(dataList[i].length);
      out.u32(dataList[i].length);
      out.u16(nameBytesList[i].length);
      out.u16(0); out.u16(0); out.u16(0); out.u16(0); // extra / comment / disk / int attr
      out.u32(0);                 // external attr
      out.u32(offsets[i]);
      out.bytes(nameBytesList[i]);
    }
    const cdSize = out.length - cdStart;

    out.u32(0x06054b50);          // EOCD
    out.u16(0); out.u16(0);
    out.u16(entries.length);
    out.u16(entries.length);
    out.u32(cdSize);
    out.u32(cdStart);
    out.u16(0);

    return new Blob([out.blob()], { type: 'application/zip' });
  }

  window.MarkdownPreview.zip = { createZip, crc32 };
})();
