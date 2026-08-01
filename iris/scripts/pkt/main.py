"""Packet Tracer .pkt → JSON 预处理脚本主入口

功能：
1. 扫描 iris/data/pkt/raw/ 下的所有 .pkt 文件
2. 对比 mtime 实现增量处理
3. 解密 → 解压 → XML 解析 → JSON 输出
4. 解密后的 XML 存到 iris/data/pkt/xml/
5. 解析后的 JSON 存到 iris/data/pkt/json/
6. 失败时生成错误 JSON

用法：
    python iris/scripts/pkt/main.py              # 增量处理
    python iris/scripts/pkt/main.py --force      # 强制全量重建
    python iris/scripts/pkt/main.py --verbose    # 详细输出
"""

import argparse
import os
import sys
import time
from pathlib import Path

# 将当前目录加入 path 以便导入同目录模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from decrypt import decrypt_pkt, detect_format
from decompress import decompress_pkt
from parse import parse_xml
from output import build_topology_json, build_error_json, write_json, write_xml


# ============== 路径配置 ==============

# 项目根目录（scripts/pkt/ 的上三级）
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent  # iris/scripts/pkt → iris → 项目根

RAW_DIR = PROJECT_ROOT / 'iris' / 'data' / 'pkt' / 'raw'
XML_DIR = PROJECT_ROOT / 'iris' / 'data' / 'pkt' / 'xml'
JSON_DIR = PROJECT_ROOT / 'iris' / 'data' / 'pkt' / 'json'


# ============== PT 版本检测 ==============

def detect_pt_version(decrypted_data: bytes) -> str:
    """从解密后的数据检测 PT 版本"""
    # 尝试在 XML 中查找版本信息
    try:
        text = decrypted_data.decode('utf-8', errors='ignore')
        # 常见版本标记
        if '8.0' in text or '8.1' in text or '8.2' in text:
            return 'PT 8.x'
        if '7.3' in text or '7.4' in text:
            return 'PT 7.3+'
        if '7.0' in text or '7.1' in text or '7.2' in text:
            return 'PT 7.x'
        if '6.' in text:
            return 'PT 6.x'
        if '5.' in text:
            return 'PT 5.x'
    except Exception:
        pass
    return 'unknown'


# ============== 增量检查 ==============

def needs_rebuild(pkt_path: Path, json_path: Path, force: bool = False) -> bool:
    """判断是否需要重新处理

    增量策略：文件 mtime 对比
    - force=True：强制重建
    - JSON 不存在：需要处理
    - .pkt mtime > JSON mtime：需要处理
    """
    if force:
        return True
    if not json_path.exists():
        return True
    return pkt_path.stat().st_mtime > json_path.stat().st_mtime


# ============== 单文件处理 ==============

def process_pkt(pkt_path: Path, verbose: bool = False) -> dict:
    """处理单个 .pkt 文件

    返回处理结果摘要
    """
    filename = pkt_path.name
    stem = pkt_path.stem
    xml_path = XML_DIR / f'{stem}.xml'
    json_path = JSON_DIR / f'{stem}.json'

    result = {
        'file': filename,
        'status': 'success',
        'deviceCount': 0,
        'linkCount': 0,
        'duration': 0,
        'error': None,
    }

    start_time = time.time()

    try:
        # 1. 读取原始文件
        with open(pkt_path, 'rb') as f:
            raw_data = f.read()

        if verbose:
            fmt = detect_format(raw_data)
            print(f'  [{filename}] 格式: {fmt}, 大小: {len(raw_data)} bytes')

        # 2. 解密
        decrypted = decrypt_pkt(raw_data)

        # 3. 解压
        decompressed = decompress_pkt(decrypted)

        # 4. 解码 XML 文本
        try:
            xml_text = decompressed.decode('utf-8')
        except UnicodeDecodeError:
            xml_text = decompressed.decode('latin-1')

        # 5. 保存解密后的 XML（中间产物）
        write_xml(xml_text, str(xml_path))

        if verbose:
            print(f'  [{filename}] XML 已保存: {xml_path.name} ({len(xml_text)} chars)')

        # 6. 检测 PT 版本
        pt_version = detect_pt_version(decompressed)

        # 7. 解析 XML
        parsed = parse_xml(xml_text)

        # 8. 构造 JSON
        topology = build_topology_json(filename, parsed, pt_version)

        # 9. 保存 JSON
        write_json(topology, str(json_path))

        result['deviceCount'] = topology['meta']['deviceCount']
        result['linkCount'] = topology['meta']['linkCount']
        result['duration'] = round(time.time() - start_time, 2)

        if verbose:
            print(f'  [{filename}] JSON 已保存: 设备 {result["deviceCount"]} / 链路 {result["linkCount"]} / 用时 {result["duration"]}s')

    except Exception as e:
        # 生成错误 JSON
        error_code = type(e).__name__
        error_message = str(e)
        error_json = build_error_json(filename, error_code, error_message)
        write_json(error_json, str(json_path))

        result['status'] = 'error'
        result['error'] = error_message
        result['duration'] = round(time.time() - start_time, 2)

        if verbose:
            print(f'  [{filename}] 解析失败: {error_code}: {error_message}')

    return result


# ============== 主流程 ==============

def main():
    parser = argparse.ArgumentParser(description='Packet Tracer .pkt → JSON 预处理脚本')
    parser.add_argument('--force', action='store_true', help='强制全量重建')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')
    parser.add_argument('--file', type=str, help='仅处理指定文件（相对 raw/ 的路径）')
    args = parser.parse_args()

    print('=' * 60)
    print('Packet Tracer .pkt → JSON 预处理脚本')
    print('=' * 60)

    # 确保目录存在
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    XML_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)

    # 收集 .pkt 文件
    if args.file:
        pkt_files = [RAW_DIR / args.file]
        if not pkt_files[0].exists():
            print(f'文件不存在: {pkt_files[0]}')
            sys.exit(1)
    else:
        pkt_files = sorted(RAW_DIR.glob('*.pkt'))

    if not pkt_files:
        print(f'未找到 .pkt 文件，请将文件放入 {RAW_DIR}')
        # 生成空的 manifest
        print('提示：目录已创建，可放入 .pkt 文件后重新运行。')
        return

    # 增量过滤
    to_process = []
    skipped = 0
    for pkt_path in pkt_files:
        stem = pkt_path.stem
        json_path = JSON_DIR / f'{stem}.json'
        if needs_rebuild(pkt_path, json_path, args.force):
            to_process.append(pkt_path)
        else:
            skipped += 1

    print(f'发现 {len(pkt_files)} 个 .pkt 文件，需处理 {len(to_process)} 个，跳过 {skipped} 个')
    print('-' * 60)

    if not to_process:
        print('所有文件均为最新，无需处理。')
        return

    # 逐个处理
    results = []
    for pkt_path in to_process:
        if args.verbose:
            print(f'处理: {pkt_path.name}')
        result = process_pkt(pkt_path, args.verbose)
        results.append(result)

    # 输出汇总
    print('-' * 60)
    success = sum(1 for r in results if r['status'] == 'success')
    failed = sum(1 for r in results if r['status'] == 'error')
    total_devices = sum(r['deviceCount'] for r in results)
    total_links = sum(r['linkCount'] for r in results)
    total_time = sum(r['duration'] for r in results)

    print(f'处理完成: 成功 {success} / 失败 {failed}')
    print(f'设备总数: {total_devices} / 链路总数: {total_links}')
    print(f'总用时: {total_time}s')
    print(f'XML 输出: {XML_DIR}')
    print(f'JSON 输出: {JSON_DIR}')

    if failed > 0:
        print('\n失败文件:')
        for r in results:
            if r['status'] == 'error':
                print(f'  {r["file"]}: {r["error"]}')

    # 非 0 退出码表示有失败
    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
