"""Packet Tracer .pkt 解压模块

解密后的数据通常是 zlib 压缩流，解压后得到 XML 文本。
"""

import struct
import zlib


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
                decompressed = zlib.decompress(data[4:])
                if len(decompressed) == potential_size:
                    return decompressed
                return decompressed
            except zlib.error:
                pass

    # 尝试方式 2：前 4 字节是未压缩大小（小端序，旧版格式），后面是 zlib 数据
    if len(data) > 4:
        potential_size = struct.unpack('<I', data[:4])[0]
        if 1024 <= potential_size <= 50 * 1024 * 1024:
            try:
                decompressed = zlib.decompress(data[4:])
                if len(decompressed) == potential_size:
                    return decompressed
                return decompressed
            except zlib.error:
                pass

    # 尝试方式 3：直接是 zlib 压缩流（无大小前缀）
    try:
        return zlib.decompress(data)
    except zlib.error:
        pass

    # 尝试方式 4：raw deflate（无 zlib 头）
    try:
        return zlib.decompress(data, -15)
    except zlib.error:
        pass

    # 尝试方式 5：gzip 格式
    try:
        return zlib.decompress(data, 31)
    except zlib.error:
        pass

    # 解压失败，可能数据已经是未压缩的 XML
    # 检测是否以 <?xml 或 <NETWORK 开头
    head = data[:64].lstrip()
    if head.startswith(b'<?xml') or head.startswith(b'<NETWORK') or head.startswith(b'<network'):
        return data

    raise ValueError("无法识别的压缩格式，解压失败")
