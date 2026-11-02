"""用鸢尾花图标替换站点全套图标资源。

产出（均在 iris/icons/ 下）:
  icon.svg                  矢量图标（透明底，纯紫鸢尾）
  icon-512.png              512x512 PNG
  icon-192.png              192x192 PNG
  favicon-32.png            32x32 PNG
  apple-touch-icon.png      180x180 PNG（不透明白底）
  icon-maskable.svg         maskable 矢量（紫底 + 白鸢尾）
  icon-maskable-512.png     maskable 512 PNG（紫底 + 白鸢尾）

用法: python iris/scripts/make-iris-icon.py
"""
from __future__ import annotations

import math
import os
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICON_DIR = os.path.join(ROOT, "iris", "icons")
SRC = os.path.join(ICON_DIR, "iris-icon-src2.png")

PURPLE = (139, 92, 246)  # #8B5CF6 明亮鸢尾紫
SVG_VIEWBOX = 512
# maskable 安全区：内容须落在中心 80% 圆内
MASKABLE_SCALE = 0.62


def chroma_key(img: Image.Image, feather: float = 0.8) -> Image.Image:
    """背景洋红 (R≈B, G 低)，主体紫 (R 与 B 差大)，用 |R-B| 区分。"""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            diff = abs(r - b)
            if diff <= 45:
                a = 0
            elif diff >= 70:
                a = 255
            else:
                a = int((diff - 45) / 25 * 255)
            mp[x, y] = a
    return mask.filter(ImageFilter.GaussianBlur(feather))


def normalize_mask(mask: Image.Image, size: int = 1024, pad_ratio: float = 0.08) -> Image.Image:
    bbox = mask.getbbox()
    if bbox:
        mask = mask.crop(bbox)
    pad = int(max(mask.size) * pad_ratio)
    scale = (size - pad * 2) / max(mask.size)
    new_size = (max(1, int(mask.width * scale)), max(1, int(mask.height * scale)))
    mask = mask.resize(new_size, Image.LANCZOS)
    canvas = Image.new("L", (size, size), 0)
    canvas.paste(mask, ((size - new_size[0]) // 2, (size - new_size[1]) // 2))
    return canvas


def trace_blobs(mask: Image.Image, threshold: int = 128):
    """把二值遮罩切成若干色块（每片花瓣一个）。"""
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    blobs = []
    for y in range(h):
        for x in range(w):
            if px[x, y] < threshold or seen[y * w + x]:
                continue
            stack = [(x, y)]
            seen[y * w + x] = 1
            cells = []
            while stack:
                cx, cy = stack.pop()
                cells.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] >= threshold:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(cells) > 200:
                blobs.append(cells)
    return blobs


def blob_outline(cells):
    """Moore 邻域跟踪色块外轮廓，得到有序闭合边界。"""
    cells_set = set(cells)
    start = min(cells, key=lambda p: (p[1], p[0]))
    nbrs = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]

    backtrack = (start[0] - 1, start[1])
    dir_idx = 0
    for i, (dx, dy) in enumerate(nbrs):
        if backtrack == (start[0] + dx, start[1] + dy):
            dir_idx = i
            break
    cur = start
    contour = [start]
    for _ in range(len(cells) * 4):
        found = False
        for i in range(1, 9):
            d = (dir_idx + i) % 8
            dx, dy = nbrs[d]
            nxt = (cur[0] + dx, cur[1] + dy)
            if nxt in cells_set:
                dir_idx = (d + 5) % 8
                cur = nxt
                contour.append(cur)
                found = True
                break
        if not found:
            break
        if cur == start and len(contour) > 2:
            break
    return contour


def simplify(points, eps: float = 1.2):
    """Douglas-Peucker 简化。"""
    if len(points) < 3:
        return list(points)

    def rdp(pts):
        if len(pts) < 3:
            return pts
        x1, y1 = pts[0]
        x2, y2 = pts[-1]
        dx, dy = x2 - x1, y2 - y1
        norm = (dx * dx + dy * dy) ** 0.5
        max_d, index = 0, 0
        for i in range(1, len(pts) - 1):
            x, y = pts[i]
            if norm == 0:
                d = ((x - x1) ** 2 + (y - y1) ** 2) ** 0.5
            else:
                d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
            if d > max_d:
                max_d, index = d, i
        if max_d > eps:
            left = rdp(pts[: index + 1])
            right = rdp(pts[index:])
            return left[:-1] + right
        return [pts[0], pts[-1]]

    return rdp(list(points))


def build_svg(alpha: Image.Image, fill: str = "#8B5CF6", scale_to: float = 1.0) -> str:
    """由遮罩生成 SVG；scale_to < 1 用于 maskable 安全区。"""
    size = alpha.size[0]
    view = SVG_VIEWBOX
    scale = view / size
    paths = []
    for cells in trace_blobs(alpha):
        outline = simplify(blob_outline(cells))
        if len(outline) < 3:
            continue
        pts = []
        for x, y in outline:
            # 以画布中心为原点做缩放，便于整体缩到安全区内
            nx = (x - size / 2) * scale * scale_to
            ny = (y - size / 2) * scale * scale_to
            pts.append((nx + view / 2, ny + view / 2))
        d = "M" + " L".join(f"{px:.2f},{py:.2f}" for px, py in pts) + " Z"
        paths.append(f'  <path d="{d}"/>')
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">\n'
        '  <g fill="%s">\n%s\n  </g>\n</svg>\n'
        % (view, view, view, view, fill, "\n".join(paths))
    )


def save_svg(path: str, content: str) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("saved:", path)


def save_png(img: Image.Image, path: str) -> None:
    img.save(path)
    print("saved:", path)


def main() -> None:
    src = Image.open(SRC)
    mask = normalize_mask(chroma_key(src))

    # 1) 透明底纯紫主图标
    solid = Image.new("RGBA", (1024, 1024), PURPLE + (0,))
    solid.putalpha(mask)
    save_png(solid, os.path.join(ICON_DIR, "icon.png"))
    save_png(solid.resize((512, 512), Image.LANCZOS), os.path.join(ICON_DIR, "icon-512.png"))
    save_png(solid.resize((192, 192), Image.LANCZOS), os.path.join(ICON_DIR, "icon-192.png"))
    save_png(solid.resize((32, 32), Image.LANCZOS), os.path.join(ICON_DIR, "favicon-32.png"))

    # 2) apple-touch-icon：iOS 不支持透明，铺白底
    apple = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
    icon = solid.resize((180, 180), Image.LANCZOS)
    apple.alpha_composite(icon)
    save_png(apple.convert("RGB"), os.path.join(ICON_DIR, "apple-touch-icon.png"))

    # 3) 矢量
    save_svg(os.path.join(ICON_DIR, "icon.svg"), build_svg(mask))

    # 4) maskable：紫底 + 白鸢尾，图形缩进安全区
    #    注意：putalpha 会替换整张图的 alpha 通道，不能用它来"挖"出白鸢尾——
    #    那样会把紫底一并变透明。正确做法是铺不透明紫底，再用白色鸢尾按遮罩合成。
    inner = int(512 * MASKABLE_SCALE)
    scaled = mask.resize((inner, inner), Image.LANCZOS)
    white_mask = Image.new("L", (512, 512), 0)
    white_mask.paste(scaled, ((512 - inner) // 2, (512 - inner) // 2))

    maskable = Image.new("RGBA", (512, 512), PURPLE + (255,))
    white_iris = Image.new("RGBA", (512, 512), (255, 255, 255, 0))
    white_iris.putalpha(white_mask)
    maskable.alpha_composite(white_iris)
    save_png(maskable, os.path.join(ICON_DIR, "icon-maskable-512.png"))

    # maskable 矢量：紫底矩形 + 白色鸢尾（带安全区内缩）
    svg = build_svg(mask, fill="#FFFFFF", scale_to=MASKABLE_SCALE)
    svg = svg.replace(
        '  <g fill="#FFFFFF">',
        '  <rect width="512" height="512" fill="#8B5CF6"/>\n  <g fill="#FFFFFF">',
    )
    save_svg(os.path.join(ICON_DIR, "icon-maskable.svg"), svg)

    print("done")


if __name__ == "__main__":
    main()
