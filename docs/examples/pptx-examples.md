---
title: PPTX 演示嵌入示例
---

# PPTX 演示嵌入

本站点支持在 Markdown 文档中嵌入 PPT 与 PPTX 演示文稿（预处理产物方案，与 `pkt` / `ensp` 拓扑嵌入完全同风格）。

## 为什么采用「预处理产物」？

与 PDF/PPTX 在前端动态解码相比，「提前导出每页图片 + 元数据 JSON」有以下优势：

| 方案 | 首屏速度 | 依赖体积 | 兼容性 | 可搜索 |
|---|---|---|---|---|
| 前端实时解码 PPTX | 慢（多 MB 级解码库） | 重 | 复杂效果易错位 | 否 |
| 预处理图片 + JSON | 快（首屏只拉 JSON + 第一页图） | 零依赖 | 所见即所得 | 图片可加入搜索 |

前端渲染器零第三方库，仅 200 余行原生 JS 实现缩略图网格 + 全屏放映模式。

## 目录约定

```
iris/data/pptx/
  ├── raw/
  │   └── my-deck.pptx      ← 原始 ppt/pptx 文件（推送到仓库触发 CI 自动转换）
  ├── json/
  │   └── my-deck.json      ← 元数据：{ title, pages, ext, width?, height?, sourceFile? }
  └── images/
      ├── my-deck-1.png     ← 第 1 页
      ├── my-deck-2.png     ← 第 2 页
      └── ...
```

### 元数据 JSON 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 否 | 演示文稿标题（显示在缩略图网格标题栏） |
| `pages` | number | 是 | 总页数，正整数 |
| `ext`   | string | 否 | 图片扩展名，默认 `png`；支持 `svg/jpg/jpeg/webp` |
| `sourceFile` | string | 否 | 原始文件名（CI 自动写入） |
| `width` / `height` | number | 否 | 原始 PPT 尺寸（仅元信息，暂未用） |

### 两种生成方式

方式 1：CI 自动构建（推荐）。把 `.ppt` 或 `.pptx` 文件放到 `iris/data/pptx/raw/` 目录并提交，GitHub Actions 工作流 `.github/workflows/build-pptx.yml` 会自动：

1. 安装 LibreOffice + Poppler + python-pptx
2. 运行 `python iris/scripts/pptx/main.py --verbose`
3. 增量对比修改时间，只处理新增 / 更新的文件
4. 生成 `iris/data/pptx/json/{slug}.json` 与 `iris/data/pptx/images/{slug}-N.png`
5. 自动 commit 并推送回仓库（commit message 带 `[skip ci]` 避免循环）

方式 2：本地手动构建。

```bash
# 安装依赖（Ubuntu / Debian）
apt-get install -y libreoffice-impress libreoffice-java-common poppler-utils
pip3 install python-pptx Pillow

# 全量 / 增量处理 raw 目录下所有 ppt/pptx
python3 iris/scripts/pptx/main.py --verbose

# 也可只处理单个文件
python3 iris/scripts/pptx/main.py --verbose --file my-deck.pptx
```

脚本还支持 `--force`（忽略 mtime 强制重建）。增量策略：`raw/*.pptx` 的 mtime 新于对应 `json/*.json` 才会重新导出。

## 基本用法

与 `pkt` 完全一致：用 `pptx` 代码块包裹 `@[pptx](slug)`：

````markdown
```pptx
@[pptx](example)
```
````

> 提示：
> - 点击任意缩略图即可从该页开始全屏放映
> - 键盘：左方向键 / 右方向键 或 空格 翻页，ESC 关闭，Home / End 跳到首尾
> - 鼠标：点击屏幕左 / 右半区翻页，点击空白或右上角关闭按钮退出
> - slug 含空格请用 `%20` 编码：`@[pptx](my%20deck)`

## 真实 PPTX 演示：示例工作流产物

下面这份就是把真实 `.pptx` 放入 `raw/dc3983.pptx` 后，由工作流自动导出的 24 页缩略图与放映：

```pptx
@[pptx](dc3983)
```

原始文件名 `dc3983.pptx`，第一页文本将作为标题写入 JSON，最终元数据形如：

```json
{
  "title": "示例标题",
  "pages": 24,
  "ext": "png",
  "sourceFile": "dc3983.pptx",
  "width": 2001,
  "height": 1125
}
```

## 错误引导（演示加载失败时的友好提示）

故意引用一个不存在的 slug：加载失败不会崩溃，而是渲染一张带「如何修复」指引的卡片：

```pptx
@[pptx](this-does-not-exist)
```

（你将看到友好的错误提示与目录结构示例）

## 多个嵌入串联

文档中可同时嵌入多份演示，互不干扰：

- 产品路线图：上面的 `example`
- 真实演示：上面的 `dc3983`
- 技术方案：`@[pptx](tech-design)`（需自行放入 images + json 或在 raw 里放 pptx 触发 CI）

## 自定义图片扩展名

如果导出的是 WebP（体积比 PNG 小 40% 以上），在 JSON 里指定：

```json
{ "title": "技术方案", "pages": 18, "ext": "webp" }
```

缩略图和放映模式会自动请求 `tech-design-1.webp` 到 `tech-design-18.webp`。
