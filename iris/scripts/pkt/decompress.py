"""Packet Tracer .pkt 解压模块

解密后的数据通常是 zlib 压缩流，解压后得到 XML 文本。
"""

import struct
import zlib

# 解压输出上限（与文件头声明的未压缩大小上限一致），防 zip 炸弹
MAX_DECOMPRESSED_SIZE = 50 * 1024 * 1024


def _decompress_limited(data: bytes, wbits: int = zlib.MAX_WBITS, limit: int = MAX_DECOMPRESSED_SIZE) -> bytes:
    """受限解压：最多解出 limit 字节，超出则拒绝（防 zip 炸弹）

    zlib.decompress 没有输出上限参数，改用 decompressobj 的 max_length 分片解压；
    预算耗尽仍有余量时抛出 ValueError。
    """
    d = zlib.decompressobj(wbits)
    out = d.decompress(data, limit)
    while d.unconsumed_tail:
        if len(out) >= limit:
            raise ValueError(f'解压数据超过大小上限 {limit} bytes')
        chunk = d.decompress(d.unconsumed_tail, limit - len(out))
        out += chunk
    out += d.flush()
    if len(out) > limit:
        raise ValueError(f'解压数据超过大小上限 {limit} bytes')
    return out


def decompress_pkt(data: bytes) -> bytes:
    """解压解密后的 .pkt 数据

    数据格式（新版 PT 7.3+，Qt 格式）：
        [4 字节未压缩大小（大端序）] [zlib 压缩数据]

    数据格式（旧版）：
        [4 字节未压缩大小（小端序）] [zlib 压缩数据]

    数据格式（部分情况）：
        直接是 zlib 压缩流，无大小前缀

    返回：解压后的字节流（通常是 XML 文本）
    """
    if not data:
        raise ValueError("解压数据为空")

    # 尝试方式 1：前 4 字节是未压缩大小（大端序，新版 Qt 格式），后面是 zlib 数据
    if len(data) > 4:
        potential_size = struct.unpack('>I', data[:4])[0]
        if 1024 <= potential_size <= 50 * 1024 * 1024:
            try:
                decompressed = _decompress_limited(data[4:], limit=potential_size)
                if len(decompressed) == potential_size:
                    return decompressed
                return decompressed
            except (zlib.error, ValueError):
                pass

    # 尝试方式 2：前 4 字节是未压缩大小（小端序，旧版格式），后面是 zlib 数据
    if len(data) > 4:
        potential_size = struct.unpack('<I', data[:4])[0]
        if 1024 <= potential_size <= 50 * 1024 * 1024:
            try:
                decompressed = _decompress_limited(data[4:], limit=potential_size)
                if len(decompressed) == potential_size:
                    return decompressed
                return decompressed
            except (zlib.error, ValueError):
                pass

    # 尝试方式 3：直接是 zlib 压缩流（无大小前缀）
    try:
        return _decompress_limited(data)
    except (zlib.error, ValueError):
        pass

    # 尝试方式 4：raw deflate（无 zlib 头）
    try:
        return _decompress_limited(data, wbits=-15)
    except (zlib.error, ValueError):
        pass

    # 尝试方式 5：gzip 格式
    try:
        return _decompress_limited(data, wbits=31)
    except (zlib.error, ValueError):
        pass

    # 解压失败，可能数据已经是未压缩的 XML
    # 检测是否以 <?xml 或 <NETWORK 开头
    head = data[:64].lstrip()
    if head.startswith(b'<?xml') or head.startswith(b'<NETWORK') or head.startswith(b'<network'):
        return data

    raise ValueError("无法识别的压缩格式，解压失败")
