"""PPT/PPTX -> 缩略图图片 + JSON 元数据 预处理脚本主入口

（参考 pkt/main.py 与 ensp/main.py 的目录 / 增量 / 错误处理约定）

功能：
1. 扫描 iris/data/pptx/raw/ 下所有 .ppt 与 .pptx 文件
2. 对比 mtime 实现增量处理（json 不存在或更旧则重建）
3. 使用 LibreOffice headless 把每页导出为 PNG：
     - LibreOffice 导出的文件名为 {Stem}.png / {Stem}-1.png / {Stem}-2.png ...
     - 重命名并移动到 iris/data/pptx/images/{slug}-N.png
4. 组装 iris/data/pptx/json/{slug}.json = {title, pages, ext:"png", width?, height?}
5. 失败时生成错误 JSON 并在 verbose 模式打印原因
6. python-pptx 兜底：LibreOffice 无法读取页数时用它来读取 slides 数量

用法：
    python iris/scripts/pptx/main.py                # 增量处理
    python iris/scripts/pptx/main.py --force        # 强制全量重建
    python iris/scripts/pptx/main.py --verbose      # 详细输出
    python iris/scripts/pptx/main.py --file dc3983.pptx
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path


# ============== 路径（参考 pkt/main.py） ==============
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent   # iris/scripts/pptx -> iris -> 仓库根

RAW_DIR    = PROJECT_ROOT / 'iris' / 'data' / 'pptx' / 'raw'
JSON_DIR   = PROJECT_ROOT / 'iris' / 'data' / 'pptx' / 'json'
IMAGES_DIR = PROJECT_ROOT / 'iris' / 'data' / 'pptx' / 'images'

SUPPORTED_EXTS = {'.ppt', '.pptx'}
IMAGE_EXT = 'png'
EXPORT_DPI = 150  # LibreOffice --convert-to png: 可通过过滤器参数控制 DPI


# ============== 增量检查（同 pkt/main.py） ==============

def needs_rebuild(raw_path: Path, json_path: Path, force: bool = False) -> bool:
    if force:
        return True
    if not json_path.exists():
        return True
    return raw_path.stat().st_mtime > json_path.stat().st_mtime


# ============== 页数检测（双策略：先 python-pptx，失败再 LibreOffice） ==============

def detect_pages_with_pptx(raw_path: Path) -> int | None:
    """python-pptx 只支持 .pptx；对 .ppt 返回 None。读取失败也返回 None"""
    if raw_path.suffix.lower() != '.pptx':
        return None
    try:
        from pptx import Presentation
        prs = Presentation(str(raw_path))
        return len(prs.slides)
    except Exception:
        return None


def try_pull_title_from_pptx(raw_path: Path) -> str | None:
    if raw_path.suffix.lower() != '.pptx':
        return None
    try:
        from pptx import Presentation
        prs = Presentation(str(raw_path))
        if not prs.slides:
            return None
        s0 = prs.slides[0]
        # 优先级 1：第一页的 title placeholder
        if s0.shapes.title is not None:
            t = (s0.shapes.title.text or '').strip()
            if t and 1 <= len(t) <= 120:
                return t
        # 优先级 2：收集第一页所有非空段落，挑选「最像标题」的一段
        #   规则：
        #     - 过滤掉极短的品牌/日期/站点标注（≤ 12 字符且含 .com/.cn/www/@/http/月份名等）
        #     - 过滤明显的模板占位符（含 "Insert the", "Your name", "or Company",
        #       "Click to add", "subtitle of your", "placeholder", "Lorem ipsum" 等提示）
        #     - 剩余候选中选最长的单行（封面标题通常是文字最多的醒目单行）
        candidates: list[tuple[int, str]] = []
        footer_patterns = ('.com', '.cn', 'www.', '@', 'http', '://',
                           'January', 'February', 'March', 'April', 'June', 'July',
                           'August', 'September', 'October', 'November', 'December')
        placeholder_patterns = ('insert the', 'your name', 'or company', 'click to add',
                                'subtitle of your', 'placeholder', 'lorem ipsum',
                                'your title', 'your subtitle', 'your logo',
                                'your department', 'presentation title')
        for shape in s0.shapes:
            if not shape.has_text_frame:
                continue
            for para in shape.text_frame.paragraphs:
                t = (para.text or '').strip()
                if not t or len(t) > 120:
                    continue
                tl = t.lower()
                if (len(t) <= 12) and any(p.lower() in tl for p in footer_patterns):
                    continue
                if any(p in tl for p in placeholder_patterns):
                    continue
                candidates.append((len(t), t))
        if not candidates:
            # 过滤后为空：退而求其次，只排除日期/域名类，允许模板提示
            for shape in s0.shapes:
                if not shape.has_text_frame:
                    continue
                for para in shape.text_frame.paragraphs:
                    t = (para.text or '').strip()
                    if not t or len(t) > 120:
                        continue
                    if (len(t) <= 12) and any(p.lower() in t.lower() for p in footer_patterns):
                        continue
                    candidates.append((len(t), t))
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]
    except Exception:
        return None


# ============== LibreOffice headless 转换 ==============

def find_soffice() -> str | None:
    for name in ('libreoffice', 'soffice'):
        p = shutil.which(name)
        if p:
            return p
    # 常见位置兜底
    for candidate in ('/usr/bin/libreoffice', '/usr/bin/soffice',
                      '/usr/local/bin/libreoffice'):
        if os.path.isfile(candidate):
            return candidate
    return None


def convert_using_libreoffice(raw_path: Path, out_dir: Path, verbose: bool = False) -> list[Path]:
    """把 ppt/pptx 每页转成 png，返回生成的图片文件列表（按页码升序）

    方案（LibreOffice headless --convert-to png 只导出第一页）：
      1. 先把 ppt/pptx 导出为 PDF
      2. 用 poppler 的 pdftoppm 把 PDF 每页渲染成 PNG（多页稳定）
      3. 重命名为 {slug}-N.png 并写入 out_dir
    """
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError('未找到 libreoffice/soffice，无法把 ppt(x) 转成图片')
    pdftoppm = shutil.which('pdftoppm')
    if not pdftoppm:
        raise RuntimeError('未找到 pdftoppm（需要 poppler-utils），请先安装')

    tmpdir = Path(tempfile.mkdtemp(prefix='pptx-convert-'))
    try:
        stem = raw_path.stem
        pdf_path = tmpdir / f'{stem}.pdf'

        # 步骤 1：PPT -> PDF
        cmd_pdf = [
            soffice,
            '--headless',
            '--nologo',
            '--nodefault',
            '--norestore',
            '--nolockcheck',
            '--convert-to', 'pdf',
            '--outdir', str(tmpdir),
            str(raw_path),
        ]
        if verbose:
            print(f'  [{raw_path.name}] 导出 PDF: {" ".join(cmd_pdf)}')
        r = subprocess.run(cmd_pdf, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
        if r.returncode != 0 or not pdf_path.exists():
            stderr = r.stderr.decode('utf-8', errors='replace').strip()
            raise RuntimeError(
                f'LibreOffice 导出 PDF 失败 (exit {r.returncode}):\n{stderr[-2000:]}'
            )

        # 步骤 2：PDF -> 每页 PNG（输出名为 {prefix}-01.png / {prefix}-02.png...）
        pp_prefix = tmpdir / 'page'
        cmd_ppm = [
            pdftoppm,
            '-png',
            '-r', str(EXPORT_DPI),
            str(pdf_path),
            str(pp_prefix),
        ]
        if verbose:
            print(f'  [{raw_path.name}] 渲染 PNG: {" ".join(cmd_ppm)}')
        r2 = subprocess.run(cmd_ppm, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
        if r2.returncode != 0:
            stderr = r2.stderr.decode('utf-8', errors='replace').strip()
            raise RuntimeError(
                f'pdftoppm 渲染 PNG 失败 (exit {r2.returncode}):\n{stderr[-2000:]}'
            )

        generated = sorted(tmpdir.glob('page-*.png'))
        if not generated:
            raise RuntimeError('pdftoppm 未生成任何 PNG 输出')

        # 步骤 3：复制并按 1..N 重命名为 {stem}-N.png
        out_dir.mkdir(parents=True, exist_ok=True)
        copied: list[Path] = []
        for idx, src in enumerate(generated, start=1):
            dst = out_dir / f'{stem}-{idx}.png'
            if dst.exists():
                dst.unlink()
            shutil.copy2(src, dst)
            copied.append(dst)
        return copied
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ============== 单文件处理 ==============

def process_pptx(raw_path: Path, verbose: bool = False) -> dict:
    filename = raw_path.name
    stem = raw_path.stem
    json_path = JSON_DIR / f'{stem}.json'

    result = {
        'file': filename,
        'status': 'success',
        'pages': 0,
        'title': '',
        'duration': 0.0,
        'error': None,
    }
    start = time.time()

    try:
        # 0. 预先尝试读取页数与标题（不影响失败时继续走 LibreOffice）
        guessed_pages = detect_pages_with_pptx(raw_path)
        guessed_title = try_pull_title_from_pptx(raw_path) or stem

        # 1. 清空旧图片（避免上一次有 20 页、这次 15 页还残留 16-20）
        for old in IMAGES_DIR.glob(f'{stem}-*.{IMAGE_EXT}'):
            try:
                old.unlink()
            except Exception:
                pass

        # 2. 转换
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        images = convert_using_libreoffice(raw_path, IMAGES_DIR, verbose=verbose)
        pages = len(images)
        if pages == 0:
            raise RuntimeError('转换后没有任何图片页')

        title = guessed_title or stem
        width = height = None
        # 尝试取第一张图的尺寸作为元数据（可选）
        try:
            from PIL import Image
            with Image.open(str(images[0])) as im:
                width, height = im.size
        except Exception:
            pass

        # 3. 写 JSON
        meta = {
            'title': title,
            'pages': pages,
            'ext': IMAGE_EXT,
            'sourceFile': filename,
        }
        if width and height:
            meta['width'] = width
            meta['height'] = height
        JSON_DIR.mkdir(parents=True, exist_ok=True)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        result['pages'] = pages
        result['title'] = title
        result['duration'] = round(time.time() - start, 2)
        if verbose:
            print(f'  [{filename}] OK: {pages} 页, 标题="{title}", 用时 {result["duration"]}s')

    except Exception as e:
        # 错误 JSON 也写入 json，前端会展示错误卡片
        error_json = {
            'title': f'(解析失败) {stem}',
            'pages': 0,
            'ext': IMAGE_EXT,
            'sourceFile': filename,
            'error': type(e).__name__ + ': ' + str(e),
        }
        JSON_DIR.mkdir(parents=True, exist_ok=True)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(error_json, f, ensure_ascii=False, indent=2)

        result['status'] = 'error'
        result['error'] = str(e)
        result['duration'] = round(time.time() - start, 2)
        if verbose:
            print(f'  [{filename}] 失败: {type(e).__name__}: {e}')

    return result


# ============== 主流程 ==============

def main():
    parser = argparse.ArgumentParser(description='PPT/PPTX -> 图片 + JSON 预处理脚本')
    parser.add_argument('--force', action='store_true', help='强制全量重建')
    parser.add_argument('--verbose', '-v', action='store_true', help='详细输出')
    parser.add_argument('--file', type=str, help='仅处理指定文件（相对 raw/ 的文件名）')
    args = parser.parse_args()

    print('=' * 60)
    print('PPT / PPTX -> 图片 + JSON 预处理脚本')
    print('=' * 60)

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    if args.file:
        raw_files = [RAW_DIR / args.file]
        if not raw_files[0].exists():
            print(f'[错误] 文件不存在: {raw_files[0]}')
            sys.exit(1)
    else:
        raw_files = sorted(
            p for p in RAW_DIR.iterdir()
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS
        )

    if not raw_files:
        print(f'未找到 PPT/PPTX 文件，请放入: {RAW_DIR}')
        return

    # 增量过滤
    to_process = []
    skipped = 0
    for rf in raw_files:
        json_path = JSON_DIR / f'{rf.stem}.json'
        if needs_rebuild(rf, json_path, args.force):
            to_process.append(rf)
        else:
            skipped += 1

    print(f'发现 {len(raw_files)} 个 ppt/pptx 文件，需处理 {len(to_process)} 个，跳过 {skipped} 个')
    soffice = find_soffice()
    print(f'LibreOffice 路径: {soffice or "(未找到，将失败)"}')
    print('-' * 60)

    if not to_process:
        print('所有文件均为最新，无需处理。')
        return

    if not soffice:
        print('[错误] 未检测到 libreoffice/soffice，无法转换。请先安装 LibreOffice：')
        print('       Ubuntu/Debian:  apt-get install -y libreoffice-impress libreoffice-java-common')
        print('       macOS:          brew install --cask libreoffice')
        print('       GitHub Actions: 使用 setup-libreoffice action 或 apt-get')
        sys.exit(2)

    results = [process_pptx(rf, args.verbose) for rf in to_process]

    # 汇总
    print('-' * 60)
    success = sum(1 for r in results if r['status'] == 'success')
    failed = sum(1 for r in results if r['status'] == 'error')
    total_pages = sum(r['pages'] for r in results)
    total_time = sum(r['duration'] for r in results)
    print(f'处理完成: 成功 {success} / 失败 {failed}')
    print(f'总页数: {total_pages} / 总用时: {total_time:.2f}s')
    print(f'JSON 输出: {JSON_DIR}')
    print(f'图片输出: {IMAGES_DIR}')

    if failed:
        print('\n失败文件:')
        for r in results:
            if r['status'] == 'error':
                print(f'  {r["file"]}: {r["error"]}')
        sys.exit(1)


if __name__ == '__main__':
    main()
