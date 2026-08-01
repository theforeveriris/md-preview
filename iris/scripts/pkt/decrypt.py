"""Packet Tracer .pkt 文件解密模块

支持两种加密格式：
1. 旧版（PT 7.3 之前）：XOR 逐字节异或，密钥为文件大小递减序列
2. 新版（PT 7.3+）：四层加密结构（Stage-1 混淆 -> Twofish-128 EAX -> Stage-2 混淆 -> Qt zlib）

新版加密结构（基于 Punkcake21/Unpacket 逆向工程）：
- Stage 1: 字节反序 + 位置 XOR 掩码
- Twofish-128 EAX 认证加密（固定密钥和 IV）
- Stage 2: 递减计数器 XOR
- Qt 压缩格式（4字节大端未压缩大小 + zlib 流）
"""

import struct
import zlib


# ============== 格式检测 ==============

def detect_format(data: bytes) -> str:
    """检测 .pkt 文件使用的加密格式

    返回值：
        'twofish' - 新版 Twofish EAX 加密
        'xor'     - 旧版 XOR 加密
    """
    if len(data) < 8:
        return 'xor'

    # 新版 PT 文件通常以特定 magic 开头
    # 常见 magic：0x43544350 ("PTCP") 或 0x4B505443
    magic_candidates = [
        b'\x50\x54\x43\x4B',  # "PTCK"
        b'\x43\x50\x54\x4B',  # "CPTK"
        b'\x4B\x43\x50\x54',  # "KCPT"
    ]
    for magic in magic_candidates:
        if data[:4] == magic:
            return 'twofish'

    # 新版 Twofish 文件的另一种特征：前 16 字节中包含可识别的 nonce 头
    # 这里用启发式：如果前 4 字节看起来不像合理的 zlib 未压缩大小（>10MB 或为 0），
    # 则可能是新版加密
    potential_size = struct.unpack('<I', data[:4])[0]
    if potential_size == 0 or potential_size > 50 * 1024 * 1024:
        return 'twofish'

    return 'xor'


# ============== 旧版 XOR 解密 ==============

def decrypt_xor(data: bytes) -> bytes:
    """旧版 XOR 解密

    核心算法：decrypted[i] = encrypted[i] ^ ((file_size - i) & 0xFF)

    文件大小是动态递减的，即每个字节用不同的密钥字节异或。
    """
    file_size = len(data)
    result = bytearray(file_size)
    for i in range(file_size):
        key_byte = (file_size - i) & 0xFF
        result[i] = data[i] ^ key_byte
    return bytes(result)


# ============== Twofish 算法纯 Python 实现 ==============

# Q0 查找表（256 字节，来自 FFmpeg twofish.c）
_TWOFISH_Q0 = [
    0xa9, 0x67, 0xb3, 0xe8, 0x04, 0xfd, 0xa3, 0x76, 0x9a, 0x92, 0x80, 0x78, 0xe4, 0xdd, 0xd1, 0x38,
    0x0d, 0xc6, 0x35, 0x98, 0x18, 0xf7, 0xec, 0x6c, 0x43, 0x75, 0x37, 0x26, 0xfa, 0x13, 0x94, 0x48,
    0xf2, 0xd0, 0x8b, 0x30, 0x84, 0x54, 0xdf, 0x23, 0x19, 0x5b, 0x3d, 0x59, 0xf3, 0xae, 0xa2, 0x82,
    0x63, 0x01, 0x83, 0x2e, 0xd9, 0x51, 0x9b, 0x7c, 0xa6, 0xeb, 0xa5, 0xbe, 0x16, 0x0c, 0xe3, 0x61,
    0xc0, 0x8c, 0x3a, 0xf5, 0x73, 0x2c, 0x25, 0x0b, 0xbb, 0x4e, 0x89, 0x6b, 0x53, 0x6a, 0xb4, 0xf1,
    0xe1, 0xe6, 0xbd, 0x45, 0xe2, 0xf4, 0xb6, 0x66, 0xcc, 0x95, 0x03, 0x56, 0xd4, 0x1c, 0x1e, 0xd7,
    0xfb, 0xc3, 0x8e, 0xb5, 0xe9, 0xcf, 0xbf, 0xba, 0xea, 0x77, 0x39, 0xaf, 0x33, 0xc9, 0x62, 0x71,
    0x81, 0x79, 0x09, 0xad, 0x24, 0xcd, 0xf9, 0xd8, 0xe5, 0xc5, 0xb9, 0x4d, 0x44, 0x08, 0x86, 0xe7,
    0xa1, 0x1d, 0xaa, 0xed, 0x06, 0x70, 0xb2, 0xd2, 0x41, 0x7b, 0xa0, 0x11, 0x31, 0xc2, 0x27, 0x90,
    0x20, 0xf6, 0x60, 0xff, 0x96, 0x5c, 0xb1, 0xab, 0x9e, 0x9c, 0x52, 0x1b, 0x5f, 0x93, 0x0a, 0xef,
    0x91, 0x85, 0x49, 0xee, 0x2d, 0x4f, 0x8f, 0x3b, 0x47, 0x87, 0x6d, 0x46, 0xd6, 0x3e, 0x69, 0x64,
    0x2a, 0xce, 0xcb, 0x2f, 0xfc, 0x97, 0x05, 0x7a, 0xac, 0x7f, 0xd5, 0x1a, 0x4b, 0x0e, 0xa7, 0x5a,
    0x28, 0x14, 0x3f, 0x29, 0x88, 0x3c, 0x4c, 0x02, 0xb8, 0xda, 0xb0, 0x17, 0x55, 0x1f, 0x8a, 0x7d,
    0x57, 0xc7, 0x8d, 0x74, 0xb7, 0xc4, 0x9f, 0x72, 0x7e, 0x15, 0x22, 0x12, 0x58, 0x07, 0x99, 0x34,
    0x6e, 0x50, 0xde, 0x68, 0x65, 0xbc, 0xdb, 0xf8, 0xc8, 0xa8, 0x2b, 0x40, 0xdc, 0xfe, 0x32, 0xa4,
    0xca, 0x10, 0x21, 0xf0, 0xd3, 0x5d, 0x0f, 0x00, 0x6f, 0x9d, 0x36, 0x42, 0x4a, 0x5e, 0xc1, 0xe0,
]

# Q1 查找表（256 字节，来自 FFmpeg twofish.c）
_TWOFISH_Q1 = [
    0x75, 0xf3, 0xc6, 0xf4, 0xdb, 0x7b, 0xfb, 0xc8, 0x4a, 0xd3, 0xe6, 0x6b, 0x45, 0x7d, 0xe8, 0x4b,
    0xd6, 0x32, 0xd8, 0xfd, 0x37, 0x71, 0xf1, 0xe1, 0x30, 0x0f, 0xf8, 0x1b, 0x87, 0xfa, 0x06, 0x3f,
    0x5e, 0xba, 0xae, 0x5b, 0x8a, 0x00, 0xbc, 0x9d, 0x6d, 0xc1, 0xb1, 0x0e, 0x80, 0x5d, 0xd2, 0xd5,
    0xa0, 0x84, 0x07, 0x14, 0xb5, 0x90, 0x2c, 0xa3, 0xb2, 0x73, 0x4c, 0x54, 0x92, 0x74, 0x36, 0x51,
    0x38, 0xb0, 0xbd, 0x5a, 0xfc, 0x60, 0x62, 0x96, 0x6c, 0x42, 0xf7, 0x10, 0x7c, 0x28, 0x27, 0x8c,
    0x13, 0x95, 0x9c, 0xc7, 0x24, 0x46, 0x3b, 0x70, 0xca, 0xe3, 0x85, 0xcb, 0x11, 0xd0, 0x93, 0xb8,
    0xa6, 0x83, 0x20, 0xff, 0x9f, 0x77, 0xc3, 0xcc, 0x03, 0x6f, 0x08, 0xbf, 0x40, 0xe7, 0x2b, 0xe2,
    0x79, 0x0c, 0xaa, 0x82, 0x41, 0x3a, 0xea, 0xb9, 0xe4, 0x9a, 0xa4, 0x97, 0x7e, 0xda, 0x7a, 0x17,
    0x66, 0x94, 0xa1, 0x1d, 0x3d, 0xf0, 0xde, 0xb3, 0x0b, 0x72, 0xa7, 0x1c, 0xef, 0xd1, 0x53, 0x3e,
    0x8f, 0x33, 0x26, 0x5f, 0xec, 0x76, 0x2a, 0x49, 0x81, 0x88, 0xee, 0x21, 0xc4, 0x1a, 0xeb, 0xd9,
    0xc5, 0x39, 0x99, 0xcd, 0xad, 0x31, 0x8b, 0x01, 0x18, 0x23, 0xdd, 0x1f, 0x4e, 0x2d, 0xf9, 0x48,
    0x4f, 0xf2, 0x65, 0x8e, 0x78, 0x5c, 0x58, 0x19, 0x8d, 0xe5, 0x98, 0x57, 0x67, 0x7f, 0x05, 0x64,
    0xaf, 0x63, 0xb6, 0xfe, 0xf5, 0xb7, 0x3c, 0xa5, 0xce, 0xe9, 0x68, 0x44, 0xe0, 0x4d, 0x43, 0x69,
    0x29, 0x2e, 0xac, 0x15, 0x59, 0xa8, 0x0a, 0x9e, 0x6e, 0x47, 0xdf, 0x34, 0x35, 0x6a, 0xcf, 0xdc,
    0x22, 0xc9, 0xc0, 0x9b, 0x89, 0xd4, 0xed, 0xab, 0x12, 0xa2, 0x0d, 0x52, 0xbb, 0x02, 0x2f, 0xa9,
    0xd7, 0x61, 0x1e, 0xb4, 0x50, 0x04, 0xf6, 0xc2, 0x16, 0x25, 0x86, 0x56, 0x55, 0x09, 0xbe, 0x91,
]

# MDS 矩阵用的 GF(2^8) 乘法表（来自 FFmpeg twofish.c 的 MD1/MD2）
# MD1[x] = x * 0x01 在 GF(2^8) 中（约化多项式 0x14D，即 x^8 + x^6 + x^3 + x^2 + 1）
# 注意：MD1 实际上就是恒等映射（乘 1），这里保留以便对照
_TWOFISH_MD1 = [
    0x00, 0x5b, 0xb6, 0xed, 0x05, 0x5e, 0xb3, 0xe8, 0x0a, 0x51, 0xbc, 0xe7, 0x0f, 0x54, 0xb9, 0xe2,
    0x14, 0x4f, 0xa2, 0xf9, 0x11, 0x4a, 0xa7, 0xfc, 0x1e, 0x45, 0xa8, 0xf3, 0x1b, 0x40, 0xad, 0xf6,
    0x28, 0x73, 0x9e, 0xc5, 0x2d, 0x76, 0x9b, 0xc0, 0x22, 0x79, 0x94, 0xcf, 0x27, 0x7c, 0x91, 0xca,
    0x3c, 0x67, 0x8a, 0xd1, 0x39, 0x62, 0x8f, 0xd4, 0x36, 0x6d, 0x80, 0xdb, 0x33, 0x68, 0x85, 0xde,
    0x50, 0x0b, 0xe6, 0xbd, 0x55, 0x0e, 0xe3, 0xb8, 0x5a, 0x01, 0xec, 0xb7, 0x5f, 0x04, 0xe9, 0xb2,
    0x44, 0x1f, 0xf2, 0xa9, 0x41, 0x1a, 0xf7, 0xac, 0x4e, 0x15, 0xf8, 0xa3, 0x4b, 0x10, 0xfd, 0xa6,
    0x78, 0x23, 0xce, 0x95, 0x7d, 0x26, 0xcb, 0x90, 0x72, 0x29, 0xc4, 0x9f, 0x77, 0x2c, 0xc1, 0x9a,
    0x6c, 0x37, 0xda, 0x81, 0x69, 0x32, 0xdf, 0x84, 0x66, 0x3d, 0xd0, 0x8b, 0x63, 0x38, 0xd5, 0x8e,
    0xa0, 0xfb, 0x16, 0x4d, 0xa5, 0xfe, 0x13, 0x48, 0xaa, 0xf1, 0x1c, 0x47, 0xaf, 0xf4, 0x19, 0x42,
    0xb4, 0xef, 0x02, 0x59, 0xb1, 0xea, 0x07, 0x5c, 0xbe, 0xe5, 0x08, 0x53, 0xbb, 0xe0, 0x0d, 0x56,
    0x88, 0xd3, 0x3e, 0x65, 0x8d, 0xd6, 0x3b, 0x60, 0x82, 0xd9, 0x34, 0x6f, 0x87, 0xdc, 0x31, 0x6a,
    0x9c, 0xc7, 0x2a, 0x71, 0x99, 0xc2, 0x2f, 0x74, 0x96, 0xcd, 0x20, 0x7b, 0x93, 0xc8, 0x25, 0x7e,
    0xf0, 0xab, 0x46, 0x1d, 0xf5, 0xae, 0x43, 0x18, 0xfa, 0xa1, 0x4c, 0x17, 0xff, 0xa4, 0x49, 0x12,
    0xe4, 0xbf, 0x52, 0x09, 0xe1, 0xba, 0x57, 0x0c, 0xee, 0xb5, 0x58, 0x03, 0xeb, 0xb0, 0x5d, 0x06,
    0xd8, 0x83, 0x6e, 0x35, 0xdd, 0x86, 0x6b, 0x30, 0xd2, 0x89, 0x64, 0x3f, 0xd7, 0x8c, 0x61, 0x3a,
    0xcc, 0x97, 0x7a, 0x21, 0xc9, 0x92, 0x7f, 0x24, 0xc6, 0x9d, 0x70, 0x2b, 0xc3, 0x98, 0x75, 0x2e,
]

_TWOFISH_MD2 = [
    0x00, 0xef, 0xb7, 0x58, 0x07, 0xe8, 0xb0, 0x5f, 0x0e, 0xe1, 0xb9, 0x56, 0x09, 0xe6, 0xbe, 0x51,
    0x1c, 0xf3, 0xab, 0x44, 0x1b, 0xf4, 0xac, 0x43, 0x12, 0xfd, 0xa5, 0x4a, 0x15, 0xfa, 0xa2, 0x4d,
    0x38, 0xd7, 0x8f, 0x60, 0x3f, 0xd0, 0x88, 0x67, 0x36, 0xd9, 0x81, 0x6e, 0x31, 0xde, 0x86, 0x69,
    0x24, 0xcb, 0x93, 0x7c, 0x23, 0xcc, 0x94, 0x7b, 0x2a, 0xc5, 0x9d, 0x72, 0x2d, 0xc2, 0x9a, 0x75,
    0x70, 0x9f, 0xc7, 0x28, 0x77, 0x98, 0xc0, 0x2f, 0x7e, 0x91, 0xc9, 0x26, 0x79, 0x96, 0xce, 0x21,
    0x6c, 0x83, 0xdb, 0x34, 0x6b, 0x84, 0xdc, 0x33, 0x62, 0x8d, 0xd5, 0x3a, 0x65, 0x8a, 0xd2, 0x3d,
    0x48, 0xa7, 0xff, 0x10, 0x4f, 0xa0, 0xf8, 0x17, 0x46, 0xa9, 0xf1, 0x1e, 0x41, 0xae, 0xf6, 0x19,
    0x54, 0xbb, 0xe3, 0x0c, 0x53, 0xbc, 0xe4, 0x0b, 0x5a, 0xb5, 0xed, 0x02, 0x5d, 0xb2, 0xea, 0x05,
    0xe0, 0x0f, 0x57, 0xb8, 0xe7, 0x08, 0x50, 0xbf, 0xee, 0x01, 0x59, 0xb6, 0xe9, 0x06, 0x5e, 0xb1,
    0xfc, 0x13, 0x4b, 0xa4, 0xfb, 0x14, 0x4c, 0xa3, 0xf2, 0x1d, 0x45, 0xaa, 0xf5, 0x1a, 0x42, 0xad,
    0xd8, 0x37, 0x6f, 0x80, 0xdf, 0x30, 0x68, 0x87, 0xd6, 0x39, 0x61, 0x8e, 0xd1, 0x3e, 0x66, 0x89,
    0xc4, 0x2b, 0x73, 0x9c, 0xc3, 0x2c, 0x74, 0x9b, 0xca, 0x25, 0x7d, 0x92, 0xcd, 0x22, 0x7a, 0x95,
    0x90, 0x7f, 0x27, 0xc8, 0x97, 0x78, 0x20, 0xcf, 0x9e, 0x71, 0x29, 0xc6, 0x99, 0x76, 0x2e, 0xc1,
    0x8c, 0x63, 0x3b, 0xd4, 0x8b, 0x64, 0x3c, 0xd3, 0x82, 0x6d, 0x35, 0xda, 0x85, 0x6a, 0x32, 0xdd,
    0xa8, 0x47, 0x1f, 0xf0, 0xaf, 0x40, 0x18, 0xf7, 0xa6, 0x49, 0x11, 0xfe, 0xa1, 0x4e, 0x16, 0xf9,
    0xb4, 0x5b, 0x03, 0xec, 0xb3, 0x5c, 0x04, 0xeb, 0xba, 0x55, 0x0d, 0xe2, 0xbd, 0x52, 0x0a, 0xe5,
]

# RS 矩阵系数（用于生成 S 盒密钥）
_TWOFISH_RS_MATRIX = [
    [0x01, 0xa4, 0x55, 0x87, 0x5a, 0x58, 0xdb, 0x9e],
    [0xa4, 0x56, 0x82, 0xf3, 0x1e, 0xc6, 0x68, 0xe5],
    [0x02, 0xa1, 0xfc, 0xc1, 0x47, 0xae, 0x3d, 0x19],
    [0xa4, 0x55, 0x87, 0x5a, 0x58, 0xdb, 0x9e, 0x03],
]


def _gf_mul(a: int, b: int) -> int:
    """GF(2^8) 乘法，约化多项式 x^8 + x^6 + x^3 + x^2 + 1 (0x14D)"""
    r = 0
    while a and b:
        if a & 1:
            r ^= b
        t = b & 0x80
        b = (b << 1) & 0xFF
        if t:
            b ^= 0x4d
        a >>= 1
    return r & 0xFF


def _tf_rs(k0: int, k1: int) -> int:
    """RS 矩阵乘法：将 8 字节（2 个 32 位字）映射为 4 字节（1 个 32 位字）

    对应 FFmpeg 的 tf_RS 函数，小端序。
    """
    m = bytearray(8)
    struct.pack_into('<I', m, 0, k0)
    struct.pack_into('<I', m, 4, k1)
    s = [0, 0, 0, 0]
    for i in range(4):
        row = _TWOFISH_RS_MATRIX[i]
        val = 0
        for j in range(8):
            val ^= _gf_mul(row[j], m[j])
        s[i] = val
    return struct.unpack('<I', bytes(s))[0]


def _tf_h0(y: list, L: list, k: int):
    """H 函数的 Q 置换部分（不含 MDS 矩阵乘法）

    对应 FFmpeg 的 tf_h0 函数。
    y: 4 字节列表（输入/输出）
    L: 密钥字数组（32 位整数列表）
    k: 密钥字数（2/3/4，对应 128/192/256 位密钥）
    """
    if k == 4:
        l = struct.pack('<I', L[3])
        y[0] = _TWOFISH_Q1[y[0]] ^ l[0]
        y[1] = _TWOFISH_Q0[y[1]] ^ l[1]
        y[2] = _TWOFISH_Q0[y[2]] ^ l[2]
        y[3] = _TWOFISH_Q1[y[3]] ^ l[3]
    if k >= 3:
        l = struct.pack('<I', L[2])
        y[0] = _TWOFISH_Q1[y[0]] ^ l[0]
        y[1] = _TWOFISH_Q1[y[1]] ^ l[1]
        y[2] = _TWOFISH_Q0[y[2]] ^ l[2]
        y[3] = _TWOFISH_Q0[y[3]] ^ l[3]
    l = struct.pack('<I', L[1])
    l0 = L[0] & 0xFF
    l1 = (L[0] >> 8) & 0xFF
    l2 = (L[0] >> 16) & 0xFF
    l3 = (L[0] >> 24) & 0xFF
    y[0] = _TWOFISH_Q1[_TWOFISH_Q0[_TWOFISH_Q0[y[0]] ^ l[0]] ^ l0]
    y[1] = _TWOFISH_Q0[_TWOFISH_Q0[_TWOFISH_Q1[y[1]] ^ l[1]] ^ l1]
    y[2] = _TWOFISH_Q1[_TWOFISH_Q1[_TWOFISH_Q0[y[2]] ^ l[2]] ^ l2]
    y[3] = _TWOFISH_Q0[_TWOFISH_Q1[_TWOFISH_Q1[y[3]] ^ l[3]] ^ l3]


def _tf_h(X: int, L: list, k: int) -> int:
    """完整 H 函数：Q 置换 + MDS 矩阵乘法

    对应 FFmpeg 的 tf_h 函数。
    X: 32 位输入字
    L: 密钥字数组
    k: 密钥字数
    返回: 32 位输出字
    """
    y = list(struct.pack('<I', X))
    _tf_h0(y, L, k)
    l0 = y[0] ^ _TWOFISH_MD2[y[1]] ^ _TWOFISH_MD1[y[2]] ^ _TWOFISH_MD1[y[3]]
    l1 = _TWOFISH_MD1[y[0]] ^ _TWOFISH_MD2[y[1]] ^ _TWOFISH_MD2[y[2]] ^ y[3]
    l2 = _TWOFISH_MD2[y[0]] ^ _TWOFISH_MD1[y[1]] ^ y[2] ^ _TWOFISH_MD2[y[3]]
    l3 = _TWOFISH_MD2[y[0]] ^ y[1] ^ _TWOFISH_MD2[y[2]] ^ _TWOFISH_MD1[y[3]]
    return struct.unpack('<I', bytes([l0, l1, l2, l3]))[0]


def _rotl32(x: int, n: int) -> int:
    """32 位左循环移位"""
    return ((x << n) | (x >> (32 - n))) & 0xFFFFFFFF


def _rotr32(x: int, n: int) -> int:
    """32 位右循环移位"""
    return ((x >> n) | (x << (32 - n))) & 0xFFFFFFFF


class TwofishCipher:
    """Twofish 分组密码（纯 Python 实现，零第三方依赖）

    支持 128/192/256 位密钥，对照 FFmpeg twofish.c 实现。
    """

    def __init__(self, key: bytes):
        assert len(key) in (16, 24, 32), "密钥长度必须为 128/192/256 位"
        self.key = key
        key_bits = len(key) * 8
        if key_bits <= 128:
            self.ksize = 2
        elif key_bits <= 192:
            self.ksize = 3
        else:
            self.ksize = 4

        self._expand_key()

    def _expand_key(self):
        """密钥扩展：生成 S 盒密钥、预计算 MDS 表、40 个轮密钥

        对应 FFmpeg 的 av_twofish_init + precomputeMDS。
        """
        # 填充密钥到 32 字节
        keypad = bytearray(32)
        keypad[:len(self.key)] = self.key

        # 读取 2*ksize 个密钥字（小端序）
        Key = [struct.unpack_from('<I', keypad, 4 * i)[0] for i in range(2 * self.ksize)]

        # Me = 偶数字, Mo = 奇数字
        Me = [0] * self.ksize
        Mo = [0] * self.ksize
        S_list = [0] * self.ksize
        for i in range(self.ksize):
            Me[i] = Key[2 * i]
            Mo[i] = Key[2 * i + 1]
            # S 盒密钥，逆序存放：S[ksize-i-1] = RS(Me[i], Mo[i])
            S_list[self.ksize - i - 1] = _tf_rs(Me[i], Mo[i])

        self.S = S_list

        # 预计算 MDS 表（MDS1~MDS4，每个 256 个 32 位字）
        # 对应 FFmpeg 的 precomputeMDS
        self.MDS1 = [0] * 256
        self.MDS2 = [0] * 256
        self.MDS3 = [0] * 256
        self.MDS4 = [0] * 256
        for i in range(256):
            y = [i, i, i, i]
            _tf_h0(y, self.S, self.ksize)
            # MDS1[i] 对应 S 盒第 0 字节经过 MDS 矩阵后的输出（列 0）
            self.MDS1[i] = (y[0]
                           | (_TWOFISH_MD1[y[0]] << 8)
                           | (_TWOFISH_MD2[y[0]] << 16)
                           | (_TWOFISH_MD2[y[0]] << 24)) & 0xFFFFFFFF
            # MDS2[i] 对应 S 盒第 1 字节经过 MDS 矩阵后的输出（列 1）
            self.MDS2[i] = (_TWOFISH_MD2[y[1]]
                           | (_TWOFISH_MD2[y[1]] << 8)
                           | (_TWOFISH_MD1[y[1]] << 16)
                           | (y[1] << 24)) & 0xFFFFFFFF
            # MDS3[i] 对应 S 盒第 2 字节经过 MDS 矩阵后的输出（列 2）
            self.MDS3[i] = (_TWOFISH_MD1[y[2]]
                           | (_TWOFISH_MD2[y[2]] << 8)
                           | (y[2] << 16)
                           | (_TWOFISH_MD2[y[2]] << 24)) & 0xFFFFFFFF
            # MDS4[i] 对应 S 盒第 3 字节经过 MDS 矩阵后的输出（列 3）
            self.MDS4[i] = (_TWOFISH_MD1[y[3]]
                           | (y[3] << 8)
                           | (_TWOFISH_MD2[y[3]] << 16)
                           | (_TWOFISH_MD1[y[3]] << 24)) & 0xFFFFFFFF

        # 生成 40 个轮密钥 K[0..39]
        rho = 0x01010101
        self.K = [0] * 40
        for i in range(20):
            A = _tf_h((2 * i) * rho, Me, self.ksize)
            B = _tf_h((2 * i + 1) * rho, Mo, self.ksize)
            B = _rotl32(B, 8)
            self.K[2 * i] = (A + B) & 0xFFFFFFFF
            self.K[2 * i + 1] = _rotl32((A + 2 * B) & 0xFFFFFFFF, 9)

    def _g(self, X: int) -> int:
        """g 函数：使用预计算的 MDS 表

        对应 FFmpeg 的 MDS_mul 宏。
        输入 32 位字拆成 4 字节，分别查 MDS1~MDS4 表，再异或。
        """
        return (self.MDS1[X & 0xFF]
                ^ self.MDS2[(X >> 8) & 0xFF]
                ^ self.MDS3[(X >> 16) & 0xFF]
                ^ self.MDS4[(X >> 24) & 0xFF])

    def encrypt_block(self, plaintext: bytes) -> bytes:
        """加密单个 16 字节块（ECB 模式）

        对应 FFmpeg 的 twofish_encrypt。
        """
        assert len(plaintext) == 16
        P = list(struct.unpack('<4I', plaintext))

        # 输入白化
        P[0] ^= self.K[0]
        P[1] ^= self.K[1]
        P[2] ^= self.K[2]
        P[3] ^= self.K[3]

        # 16 轮 Feistel（每 2 轮一组）
        for i in range(0, 16, 2):
            t0 = self._g(P[0])
            t1 = self._g(_rotl32(P[1], 8))
            P[2] = _rotr32(P[2] ^ ((t0 + t1 + self.K[2 * i + 8]) & 0xFFFFFFFF), 1)
            P[3] = _rotl32(P[3], 1) ^ ((t0 + 2 * t1 + self.K[2 * i + 9]) & 0xFFFFFFFF)

            t0 = self._g(P[2])
            t1 = self._g(_rotl32(P[3], 8))
            P[0] = _rotr32(P[0] ^ ((t0 + t1 + self.K[2 * i + 10]) & 0xFFFFFFFF), 1)
            P[1] = _rotl32(P[1], 1) ^ ((t0 + 2 * t1 + self.K[2 * i + 11]) & 0xFFFFFFFF)

        # 输出白化 + 交换
        P[2] ^= self.K[4]
        P[3] ^= self.K[5]
        P[0] ^= self.K[6]
        P[1] ^= self.K[7]

        # 输出顺序：P[2], P[3], P[0], P[1]
        return struct.pack('<4I', P[2], P[3], P[0], P[1])

    def decrypt_block(self, ciphertext: bytes) -> bytes:
        """解密单个 16 字节块（ECB 模式）

        对应 FFmpeg 的 twofish_decrypt（不含 IV 部分）。
        """
        assert len(ciphertext) == 16
        src = list(struct.unpack('<4I', ciphertext))

        # 密文布局（与加密输出对应）：
        #   src[0] = P[2], src[1] = P[3], src[2] = P[0], src[3] = P[1]
        P2 = src[0] ^ self.K[4]
        P3 = src[1] ^ self.K[5]
        P0 = src[2] ^ self.K[6]
        P1 = src[3] ^ self.K[7]

        # 16 轮逆向 Feistel（从最后一轮往前）
        for i in range(15, -1, -2):
            # 第一半轮：用 P2/P3 计算，更新 P0/P1
            t0 = self._g(P2)
            t1 = self._g(_rotl32(P3, 8))
            P0 = _rotl32(P0, 1) ^ ((t0 + t1 + self.K[2 * i + 8]) & 0xFFFFFFFF)
            P1 = _rotr32(P1 ^ ((t0 + 2 * t1 + self.K[2 * i + 9]) & 0xFFFFFFFF), 1)

            # 第二半轮：用 P0/P1 计算，更新 P2/P3
            t0 = self._g(P0)
            t1 = self._g(_rotl32(P1, 8))
            P2 = _rotl32(P2, 1) ^ ((t0 + t1 + self.K[2 * i + 6]) & 0xFFFFFFFF)
            P3 = _rotr32(P3 ^ ((t0 + 2 * t1 + self.K[2 * i + 7]) & 0xFFFFFFFF), 1)

        # 逆向输入白化
        P0 ^= self.K[0]
        P1 ^= self.K[1]
        P2 ^= self.K[2]
        P3 ^= self.K[3]

        return struct.pack('<4I', P0, P1, P2, P3)


# ============== Twofish EAX 模式 ==============

def _cmac_twofish(cipher: TwofishCipher, data: bytes) -> bytes:
    """计算 CMAC（基于 Twofish）"""
    # 生成子密钥
    L = cipher.encrypt_block(b'\x00' * 16)
    K1 = _double(L)
    K2 = _double(K1)

    n = (len(data) + 15) // 16
    if n == 0:
        return cipher.encrypt_block(K2)

    # 最后一块处理
    last_block = data[(n - 1) * 16: n * 16]
    if len(last_block) == 16:
        last_block = bytes(a ^ b for a, b in zip(last_block, K1))
    else:
        last_block = last_block + b'\x80' + b'\x00' * (16 - len(last_block) - 1)
        last_block = bytes(a ^ b for a, b in zip(last_block, K2))

    # CMAC 计算
    T = b'\x00' * 16
    for i in range(n - 1):
        block = data[i * 16: (i + 1) * 16]
        T = cipher.encrypt_block(bytes(a ^ b for a, b in zip(T, block)))
    T = cipher.encrypt_block(bytes(a ^ b for a, b in zip(T, last_block)))
    return T


def _double(block: bytes) -> bytes:
    """GF(2^128) 上的乘 2"""
    val = int.from_bytes(block, 'big')
    result = (val << 1) & ((1 << 128) - 1)
    if val & (1 << 127):
        result ^= 0x87
    return result.to_bytes(16, 'big')


def _ctr_twofish(cipher: TwofishCipher, nonce: bytes, data: bytes) -> bytes:
    """CTR 模式加密/解密"""
    result = bytearray(len(data))
    counter = int.from_bytes(nonce, 'big')
    for i in range(0, len(data), 16):
        block = data[i: i + 16]
        counter_bytes = counter.to_bytes(16, 'big')
        keystream = cipher.encrypt_block(counter_bytes)
        for j in range(len(block)):
            result[i + j] = block[j] ^ keystream[j]
        counter = (counter + 1) & ((1 << 128) - 1)
    return bytes(result)


def decrypt_twofish_eax(data: bytes, key: bytes) -> bytes:
    """Twofish EAX 模式解密

    EAX 模式组合了 CTR（加密）和 OMAC（认证）。
    .pkt 文件结构（新版）：
        [nonce(16字节)] [ciphertext(N字节)] [tag(16字节)]
    """
    if len(data) < 32:
        raise ValueError("Twofish EAX 数据太短")

    nonce = data[:16]
    tag = data[-16:]
    ciphertext = data[16:-16]

    cipher = TwofishCipher(key)

    # 验证认证标签
    # OMAC(nonce) || OMAC(header) || OMAC(ciphertext)
    expected_tag = _cmac_twofish(cipher, nonce)
    ct_mac = _cmac_twofish(cipher, ciphertext)
    final_tag = bytes(a ^ b ^ c for a, b, c in zip(
        _cmac_twofish(cipher, b'\x00' * 16),
        expected_tag,
        ct_mac
    ))

    if final_tag != tag:
        raise ValueError("Twofish EAX 认证失败：标签不匹配")

    # CTR 解密
    return _ctr_twofish(cipher, nonce, ciphertext)


# ============== Packet Tracer 密钥（旧版错误密钥，保留参考） ==============

# 旧版错误密钥（保留以便参考）
_OLD_PT_TWOFISH_KEY = bytes([
    0x6A, 0x39, 0x6F, 0x10, 0x4C, 0x6D, 0x82, 0x4C,
    0x4C, 0x6D, 0x82, 0x4C, 0x4C, 0x6D, 0x82, 0x4C,
    0x4C, 0x6D, 0x82, 0x4C, 0x4C, 0x6D, 0x82, 0x4C,
    0x4C, 0x6D, 0x82, 0x4C, 0x4C, 0x6D, 0x82, 0x4C,
])


# ============== 新版 Packet Tracer 正确加密参数 ==============

# 正确的 Twofish-128 密钥（16 字节 0x89）
# 基于 Punkcake21/Unpacket 项目逆向工程
PT_TWOFISH_KEY = bytes([0x89] * 16)

# 固定的 EAX nonce/IV（16 字节 0x10）
PT_TWOFISH_IV = bytes([0x10] * 16)


# ============== 新版 CMAC / EAX 正确实现 ==============

def _cmac_twofish_new(cipher: TwofishCipher, data: bytes) -> bytes:
    """正确的 CMAC 实现（带左移和子密钥生成）"""
    const_rb = 0x87
    zero = b'\x00' * 16
    L = cipher.encrypt_block(zero)
    
    def left_shift_one(block):
        out = bytearray(16)
        carry = 0
        for i in range(15, -1, -1):
            new = (block[i] << 1) & 0xFF
            out[i] = new | carry
            carry = (block[i] & 0x80) >> 7
        return bytes(out)
    
    K1 = left_shift_one(L)
    if L[0] & 0x80:
        K1 = bytes(a ^ b for a, b in zip(K1, b'\x00' * 15 + bytes([const_rb])))
    
    K2 = left_shift_one(K1)
    if K1[0] & 0x80:
        K2 = bytes(a ^ b for a, b in zip(K2, b'\x00' * 15 + bytes([const_rb])))
    
    if len(data) == 0:
        padded = b'\x80' + b'\x00' * 15
        last = bytes(a ^ b for a, b in zip(padded, K2))
        blocks = []
    else:
        blocks = [data[i:i+16] for i in range(0, len(data), 16)]
        if len(blocks[-1]) == 16:
            last = bytes(a ^ b for a, b in zip(blocks[-1], K1))
            blocks = blocks[:-1]
        else:
            padded = blocks[-1] + b'\x80' + b'\x00' * (16 - len(blocks[-1]) - 1)
            last = bytes(a ^ b for a, b in zip(padded, K2))
            blocks = blocks[:-1]
    
    X = b'\x00' * 16
    for block in blocks:
        X = cipher.encrypt_block(bytes(a ^ b for a, b in zip(X, block)))
    return cipher.encrypt_block(bytes(a ^ b for a, b in zip(X, last)))


def _omac_with_prefix(cipher: TwofishCipher, prefix: int, data: bytes) -> bytes:
    """带前缀的 OMAC（标准 EAX 模式使用）"""
    P = b'\x00' * 15 + bytes([prefix])
    return _cmac_twofish_new(cipher, P + data)


def _inc_counter_be(counter: bytearray):
    """大端序 128 位计数器递增（Crypto++ 风格）"""
    for i in range(15, -1, -1):
        counter[i] = (counter[i] + 1) & 0xFF
        if counter[i] != 0:
            break


def _ctr_twofish_new(cipher: TwofishCipher, initial_counter: bytes, data: bytes) -> bytes:
    """正确的 CTR 模式（从 n_tag 开始，大端计数器递增）"""
    counter = bytearray(initial_counter)
    out = bytearray()
    offset = 0
    while offset < len(data):
        keystream = cipher.encrypt_block(bytes(counter))
        _inc_counter_be(counter)
        block = data[offset:offset + 16]
        ks = keystream[:len(block)]
        out.extend(b ^ k for b, k in zip(block, ks))
        offset += 16
    return bytes(out)


def _eax_decrypt(cipher: TwofishCipher, nonce: bytes, ciphertext: bytes, tag: bytes, aad: bytes = b'') -> bytes:
    """标准 EAX 模式解密"""
    n_tag = _omac_with_prefix(cipher, 0x00, nonce)
    h_tag = _omac_with_prefix(cipher, 0x01, aad)
    c_tag = _omac_with_prefix(cipher, 0x02, ciphertext)
    
    expected_tag = bytes(a ^ b for a, b in zip(
        bytes(a ^ b for a, b in zip(n_tag, h_tag)),
        c_tag
    ))
    
    if expected_tag != tag:
        raise ValueError("EAX 认证失败")
    
    plaintext = _ctr_twofish_new(cipher, n_tag, ciphertext)
    return plaintext


# ============== Stage 1 / Stage 2 混淆层 ==============

def _deobf_stage1(data: bytes) -> bytes:
    """Stage 1 反混淆：字节反序 + 位置 XOR 掩码"""
    L = len(data)
    return bytes(data[L-1-i] ^ (L - i*L & 0xFF) for i in range(L))


def _deobf_stage2(data: bytes) -> bytes:
    """Stage 2 反混淆：递减计数器 XOR"""
    L = len(data)
    return bytes(b ^ (L - i & 0xFF) for i, b in enumerate(data))


def _uncompress_qt(blob: bytes) -> bytes:
    """Qt 格式解压：4 字节大端未压缩大小 + zlib 流"""
    size = struct.unpack(">I", blob[:4])[0]
    return zlib.decompress(blob[4:])[:size]


# ============== 新版 .pkt 解密主函数 ==============

def decrypt_twofish_new(data: bytes) -> bytes:
    """新版 Packet Tracer .pkt 文件解密（PT 7.3+）

    处理前三层（解压留给 decompress_pkt 模块）：
    1. Stage 1 反混淆（反序 + 位置 XOR）
    2. Twofish-128 EAX 认证解密
    3. Stage 2 反混淆（递减计数器 XOR）

    返回 Qt 格式压缩数据（4 字节大端未压缩大小 + zlib 流）。
    """
    # Stage 1: 反混淆
    stage1 = _deobf_stage1(data)

    # 提取密文和 tag
    ciphertext = stage1[:-16]
    tag = stage1[-16:]

    # Twofish EAX 解密
    cipher = TwofishCipher(PT_TWOFISH_KEY)
    decrypted = _eax_decrypt(cipher, PT_TWOFISH_IV, ciphertext, tag)

    # Stage 2: 反混淆
    stage2 = _deobf_stage2(decrypted)

    return stage2


# ============== 统一入口 ==============

def decrypt_pkt(data: bytes) -> bytes:
    """解密 .pkt 文件，返回压缩数据（交给 decompress_pkt 解压）

    自动检测格式并调用对应解密算法。
    """
    # 新版文件没有固定 magic，但可以通过尝试解密来检测
    try:
        return decrypt_twofish_new(data)
    except Exception:
        # 如果新版解密失败，尝试旧版 XOR
        return decrypt_xor(data)
