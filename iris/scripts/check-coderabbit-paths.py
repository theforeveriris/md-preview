#!/usr/bin/env python3
"""检查 .coderabbit.yaml 的 path_filters 是否按预期命中 / 排除文件

CodeRabbit 的 path_filters 语义：'!' 前缀 = 排除，其余 = 强制包含。
本脚本按同样语义近似匹配，确认：
  - iris/vendor/（第三方库）、iris/data/（构建产物）、docs/ 与 *.md 被排除
  - iris/js/、iris/scripts/、.github/workflows/ 会被审查

用法：
    python iris/scripts/check-coderabbit-paths.py
"""
import os
import subprocess
import sys

try:
    import yaml
except ImportError:
    sys.exit("需要 PyYAML：pip install pyyaml")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG = os.path.join(ROOT, '.coderabbit.yaml')

# CodeRabbit 的 path_filters 语义：'!' 前缀 = 排除，其余 = 强制包含
# 匹配顺序：先看有无强制包含（无则全部匹配），再用 '!' 规则排除


def load_filters():
    with open(CONFIG, encoding='utf-8') as f:
        doc = yaml.safe_load(f)
    filters = (doc.get('reviews') or {}).get('path_filters') or []
    include = [f for f in filters if not f.startswith('!')]
    exclude = [f[1:] for f in filters if f.startswith('!')]
    return include, exclude


def matches(pattern, path):
    """近似 CodeRabbit 的 glob 匹配：支持 ** 与 *（* 不跨 /，** 跨）"""
    import re
    parts = []
    i = 0
    while i < len(pattern):
        if pattern.startswith('**/', i):
            parts.append('(?:.*/)?')
            i += 3
        elif pattern.startswith('**', i):
            parts.append('.*')
            i += 2
        elif pattern[i] == '*':
            parts.append('[^/]*')
            i += 1
        elif pattern[i] == '?':
            parts.append('[^/]')
            i += 1
        else:
            parts.append(re.escape(pattern[i]))
            i += 1
    return re.fullmatch(''.join(parts), path) is not None


def is_excluded(path, exclude):
    return any(matches(p, path) for p in exclude)


def main():
    include, exclude = load_filters()
    print(f'排除规则 {len(exclude)} 条，强制包含 {len(include)} 条')

    tracked = subprocess.run(
        ['git', 'ls-files'], cwd=ROOT, capture_output=True, text=True, check=True
    ).stdout.split('\n')

    # 期望被排除的（构建产物 / vendor / 文档）
    should_exclude = [
        'iris/vendor/marked.js',
        'iris/vendor/file-tree/prod.js',
        'iris/data/file-tree.json',
        'iris/data/links.json',
        'iris/data/feed.xml',
        'iris/data/sitemap.xml',
        'iris/data/precache-manifest.json',
        'iris/data/search-index.json',
        'iris/data/pkt/icons.svg',
        'README.md',
        'readme-dev.md',
        'docs/requirements.md',
    ]
    # 期望被审查的（自研代码）
    should_review = [
        'iris/js/file-tree.js',
        'iris/js/name-sort.js',
        'iris/js/settings.js',
        'iris/js/renderers/pulse.js',
        'iris/scripts/build-file-tree.js',
        'iris/scripts/lint-cjk.js',
        'iris/scripts/lib/md-links.js',
        '.github/workflows/cjk-typography-lint.yml',
    ]

    errors = []

    print('\n--- 应被排除 ---')
    for p in should_exclude:
        if p not in tracked:
            print(f'  ? {p} (文件不存在，跳过)')
            continue
        ok = is_excluded(p, exclude)
        print(f'  {"ok " if ok else "x  "} {p}')
        if not ok:
            errors.append(f'应排除但未排除: {p}')

    print('\n--- 应被审查 ---')
    for p in should_review:
        if p not in tracked:
            print(f'  ? {p} (文件不存在，跳过)')
            continue
        ok = not is_excluded(p, exclude)
        print(f'  {"ok " if ok else "x  "} {p}')
        if not ok:
            errors.append(f'应审查但被排除: {p}')

    # 统计实际会审的文件数
    reviewed = [p for p in tracked if p.endswith('.js') and not is_excluded(p, exclude)]
    print(f'\n实际会审查的 .js 文件：{len(reviewed)} 个')

    if errors:
        print('\n=== 失败 ===')
        for e in errors:
            print('  x ' + e)
        sys.exit(1)
    print('\n=== 全部符合预期 ===')


if __name__ == '__main__':
    main()
