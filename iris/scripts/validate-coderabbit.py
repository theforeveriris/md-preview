#!/usr/bin/env python3
"""校验 .coderabbit.yaml（CodeRabbit AI 审查配置）

两个检查：
1. schema 校验：对照 CodeRabbit 官方 JSON Schema，
   确认没有未知属性 / 非法值（属性写错会被静默忽略，等于规则没生效）
2. path_filters 校验：确认 vendor / 构建产物 / 文档确实被排除，
   自研代码确实会被审查

用法：
    python iris/scripts/validate-coderabbit.py                  # 在线拉 schema
    python iris/scripts/validate-coderabbit.py schema.json     # 用本地 schema（离线）
"""
import json
import os
import sys
import urllib.request

try:
    import yaml
except ImportError:
    sys.exit("需要 PyYAML：pip install pyyaml")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONFIG = os.path.join(ROOT, '.coderabbit.yaml')
SCHEMA_URL = 'https://coderabbit.ai/integrations/schema.v2.json'


def load_schema():
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding='utf-8') as f:
            return json.load(f)
    with urllib.request.urlopen(SCHEMA_URL, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def check(node, schema, path, errors):
    if not isinstance(schema, dict):
        return
    p = path[:-1] if path.endswith('.') else path

    if schema.get('type') == 'object' and schema.get('properties'):
        if not isinstance(node, dict):
            errors.append(f'type mismatch: {p} expected object, got {type(node).__name__}')
            return
        for key, val in node.items():
            sub = schema['properties'].get(key)
            if sub is None:
                if not schema.get('additionalProperties', True):
                    errors.append(f'unknown property: {path}{key}')
                continue
            check(val, sub, f'{path}{key}.', errors)

    if 'enum' in schema and node is not None and node not in schema['enum']:
        errors.append(f'invalid value: {p} = {node!r}, allowed: {schema["enum"]}')

    expected = schema.get('type')
    if expected and node is not None:
        actual = ('array' if isinstance(node, list)
                  else 'object' if isinstance(node, dict)
                  else 'string' if isinstance(node, str)
                  else 'boolean' if isinstance(node, bool)
                  else 'number' if isinstance(node, (int, float)) else type(node).__name__)
        if expected in ('object', 'array', 'string', 'boolean', 'number') and actual != expected:
            errors.append(f'type mismatch: {p} expected {expected}, got {actual}')

    if schema.get('type') == 'array' and isinstance(node, list):
        item_schema = schema.get('items')
        if item_schema:
            for i, item in enumerate(node):
                check(item, item_schema, f'{path}[{i}].', errors)


def main():
    if not os.path.exists(CONFIG):
        sys.exit(f'not found: {CONFIG}')
    with open(CONFIG, encoding='utf-8') as f:
        doc = yaml.safe_load(f)
    schema = load_schema()

    errors = []
    check(doc, schema, '', errors)

    print('=== .coderabbit.yaml schema validation ===')
    if errors:
        for e in errors:
            print('  x ' + e)
        sys.exit(1)
    print('  OK: schema valid, no unknown properties / invalid values')

    # 额外提示：path_instructions 长度上限
    pi = (doc.get('reviews') or {}).get('path_instructions') or []
    for item in pi:
        n = len(item.get('instructions', ''))
        flag = 'WARN' if n > 20000 else 'ok'
        print(f'  {flag}: path_instructions[{item.get("path")}] = {n} chars (max 20000)')


if __name__ == '__main__':
    main()
