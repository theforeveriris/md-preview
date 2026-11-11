"""生成社交分享卡片 iris/icons/og-image.png（1200×630）。

配色沿用鸢尾紫主题：浅紫渐变底 + 鸢尾花图形 + 文字。

用法: python iris/scripts/make-og-image.py
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICON_DIR = os.path.join(ROOT, "iris", "icons")
OUT = os.path.join(ICON_DIR, "og-image.png")

W, H = 1200, 630
PURPLE = (139, 92, 246)
DEEP = (91, 52, 191)
LIGHT = (237, 233, 254)
WHITE = (255, 255, 255)

CJK = "C:/Windows/Fonts/msyh.ttc"
CJK_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
SERIF = "C:/Windows/Fonts/NotoSerifSC-VF.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def main() -> None:
    # 背景：淡紫渐变
    bg = Image.new("RGB", (W, H), LIGHT)
    px = bg.load()
    for y in range(H):
        for x in range(W):
            t = (x / W * 0.5 + y / H * 0.5)
            px[x, y] = (
                int(250 - 40 * t),
                int(247 - 36 * t),
                int(254 - 8 * t),
            )

    # 右上角鸢尾花图形（淡紫水印）
    icon = Image.open(os.path.join(ICON_DIR, "icon.png")).convert("RGBA")
    icon = icon.resize((420, 420), Image.LANCZOS)
    tint = Image.new("RGBA", icon.size, PURPLE + (46,))
    tint.putalpha(icon.getchannel("A").point(lambda v: int(v * 46 / 255)))
    bg.paste(tint, (W - 330, -110), tint)

    draw = ImageDraw.Draw(bg)

    # 边框
    draw.rectangle([24, 24, W - 25, H - 25], outline=(214, 205, 245), width=2)

    # 主标题
    draw.text((90, 200), "Markdown Preview", font=font(SERIF, 78), fill=(43, 30, 74))

    # 标题下的紫色短线
    draw.rectangle([92, 320, 512, 326], fill=PURPLE)

    # 副标题
    draw.text((90, 358), "一个简洁优雅的 Markdown 文档预览站点", font=font(CJK, 34), fill=(78, 66, 112))
    draw.text(
        (90, 418),
        "支持 LaTeX · 代码高亮 · 图表 · 画廊 · 拓扑渲染",
        font=font(CJK, 30),
        fill=(120, 108, 150),
    )

    # 底部链接
    draw.text(
        (90, 520),
        "theforeveriris.github.io/md-preview",
        font=font(CJK, 26),
        fill=(150, 140, 175),
    )

    # 左上角小鸢尾标记
    mark = Image.open(os.path.join(ICON_DIR, "icon.png")).convert("RGBA").resize((64, 64), Image.LANCZOS)
    bg.paste(mark, (92, 96), mark)

    bg.save(OUT)
    print("saved:", OUT)


if __name__ == "__main__":
    main()
