"""Huawei eNSP .topo/.zip → JSON 预处理脚本主入口

功能：
1. 扫描 iris/data/ensp/raw/ 下的所有 .topo 或 .zip 文件
2. 对比 mtime 实现增量处理
3. XML 解析 → JSON 输出（.zip 先解压再解析）
4. 原始 XML 存到 iris/data/ensp/xml/
5. 解析后的 JSON 存到 iris/data/ensp/json/
6. 失败时生成错误 JSON

用法：
    python iris/scripts/ensp/main.py              # 增量处理
    python iris/scripts/ensp/main.py --force      # 强制全量重建
    python iris/scripts/ensp/main.py --verbose    # 详细输出
"""

import argparse
import os
import shutil
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parse import parse_xml
from output import build_topology_json, build_error_json, write_json, write_xml


# ============== 路径配置 ==============

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent

RAW_DIR = PROJECT_ROOT / 'iris' / 'data' / 'ensp' / 'raw'
XML_DIR = PROJECT_ROOT / 'iris' / 'data' / 'ensp' / 'xml'
JSON_DIR = PROJECT_ROOT / 'iris' / 'data' / 'ensp' / 'json'


# ============== 增量检查 ==============

def needs_rebuild(topo_path: Path, json_path: Path, force: bool = False) -> bool:
    """判断是否需要重新处理

    增量策略：文件 mtime 对比
    - force=True：强制重建
    - JSON 不存在：需要处理
    - .topo mtime > JSON mtime：需要处理
    """
    if force:
        return True
    if not json_path.exists():
        return True
    return topo_path.stat().st_mtime > json_path.stat().st_mtime


# ============== 单文件处理 ==============

def process_topo(topo_path: Path, verbose: bool = False) -> dict:
    """处理单个 .topo 或 .zip 文件

    .zip 文件先解压到临时目录，再解析其中的 .topo 文件
    返回处理结果摘要
    """
    filename = topo_path.name
    stem = topo_path.stem
    xml_path = XML_DIR / f'{stem}.xml'
    json_path = JSON_DIR / f'{stem}.json'
    is_zip = topo_path.suffix.lower() == '.zip'

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
        if is_zip:
            # ZIP 文件：解压到临时目录
            extract_dir = XML_DIR / f'{stem}_extracted'
            if extract_dir.exists():
                shutil.rmtree(extract_dir)
            extract_dir.mkdir(parents=True, exist_ok=True)

            with zipfile.ZipFile(topo_path, 'r') as zf:
                zf.extractall(str(extract_dir))

            # 查找解压后的 .topo 文件
            topo_files = list(extract_dir.glob('*.topo'))
            if not topo_files:
                raise ValueError(f'ZIP 中未找到 .topo 文件')
            if len(topo_files) > 1:
                if verbose:
                    print(f'  [{filename}] ZIP 中包含多个 .topo 文件，将处理第一个: {topo_files[0].name}')

            actual_topo = topo_files[0]
            topo_dir = str(actual_topo.parent)

            with open(actual_topo, 'rb') as f:
                raw_data = f.read()

            # 同时把 topo 文件复制到 xml 目录方便查看
            write_xml(raw_data.decode('utf-8', errors='ignore'), str(xml_path))
        else:
            with open(topo_path, 'rb') as f:
                raw_data = f.read()
            topo_dir = str(topo_path.parent)
            write_xml(raw_data.decode('utf-8', errors='ignore'), str(xml_path))

        if verbose:
            print(f'  [{filename}] 大小: {len(raw_data)} bytes')

        try:
            xml_text = raw_data.decode('utf-8')
        except UnicodeDecodeError:
            xml_text = raw_data.decode('gbk')

        if verbose:
            print(f'  [{filename}] XML 已保存: {xml_path.name} ({len(xml_text)} chars)')

        ensp_version = 'eNSP'

        parsed = parse_xml(xml_text, topo_dir)

        topology = build_topology_json(filename, parsed, ensp_version)

        write_json(topology, str(json_path))

        result['deviceCount'] = topology['meta']['deviceCount']
        result['linkCount'] = topology['meta']['linkCount']
        result['duration'] = round(time.time() - start_time, 2)

        if verbose:
            print(f'  [{filename}] JSON 已保存: 设备 {result["deviceCount"]} / 链路 {result["linkCount"]} / 用时 {result["duration"]}s')

    except Exception as e:
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
    parser = argparse.ArgumentParser(description='Huawei eNSP .topo → JSON 预处理脚本')
    parser.add_argument('--force', action='store_true', help='强制全量重建')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')
    parser.add_argument('--file', type=str, help='仅处理指定文件（相对 raw/ 的路径）')
    args = parser.parse_args()

    print('=' * 60)
    print('Huawei eNSP .topo → JSON 预处理脚本')
    print('=' * 60)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    XML_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)

    if args.file:
        topo_files = [RAW_DIR / args.file]
        if not topo_files[0].exists():
            print(f'文件不存在: {topo_files[0]}')
            sys.exit(1)
    else:
        topo_files = sorted(RAW_DIR.glob('*.topo')) + sorted(RAW_DIR.glob('*.zip'))

    if not topo_files:
        print(f'未找到 .topo 或 .zip 文件，请将文件放入 {RAW_DIR}')
        print('提示：目录已创建，可放入 .topo 或 .zip 文件后重新运行。')
        return

    to_process = []
    skipped = 0
    for topo_path in topo_files:
        stem = topo_path.stem
        json_path = JSON_DIR / f'{stem}.json'
        if needs_rebuild(topo_path, json_path, args.force):
            to_process.append(topo_path)
        else:
            skipped += 1

    print(f'发现 {len(topo_files)} 个 .topo 文件，需处理 {len(to_process)} 个，跳过 {skipped} 个')
    print('-' * 60)

    if not to_process:
        print('所有文件均为最新，无需处理。')
        return

    results = []
    for topo_path in to_process:
        if args.verbose:
            print(f'处理: {topo_path.name}')
        result = process_topo(topo_path, args.verbose)
        results.append(result)

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

    if failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
