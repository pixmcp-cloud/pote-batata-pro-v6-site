#!/usr/bin/env python3
"""Recreate all raster brand assets from the authoritative SVGs for each build."""
from pathlib import Path
import io
import subprocess
import shutil

def render_brand(directory):
    from PIL import Image
    directory = Path(directory)
    import cairosvg
    for size in (64, 180, 192, 512):
        data = cairosvg.svg2png(url=str(directory / "pdv-icon.svg"), output_width=size, output_height=size)
        (directory / f"pdv-{size}.png").write_bytes(data)
    data = cairosvg.svg2png(url=str(directory / "pdv-share.svg"), output_width=1200, output_height=630)
    with Image.open(io.BytesIO(data)) as img:
        img.convert("RGB").save(directory / "pdv-share.jpg", "JPEG", quality=87, optimize=True)

if __name__ == "__main__":
    import sys
    render_brand(sys.argv[1])
