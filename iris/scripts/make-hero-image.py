"""生成 README 顶部的横幅介绍图。

输入: iris/icons/hero.svg   输出: iris/icons/hero.png (1280×440)

用法: python iris/scripts/make-hero-image.py
"""
from __future__ import annotations

import os
import cairosvg
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ICON_DIR = os.path.join(ROOT, "iris", "icons")
SRC = os.path.join(ICON_DIR, "hero.svg")
OUT = os.path.join(ICON_DIR, "hero.png")

W, H = 1280, 440


def main() -> None:
    cairosvg.svg2png(url=SRC, write_to=OUT, output_width=W, output_height=H)
    img = Image.open(OUT)
    assert img.size == (W, H), img.size
    print("saved:", OUT, img.size)


if __name__ == "__main__":
    main()
