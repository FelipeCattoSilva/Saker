"""Generate native desktop icons from the original Saker falcon SVG mark.
Requires Pillow; no existing Orca UI or animations are changed.
"""
from pathlib import Path
import re
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SVG = (ROOT / "resources" / "saker-mark.svg").read_text(encoding="utf-8")
paths = re.findall(r'<path[^>]*d="([^"]+)"', SVG)
assert len(paths) == 2, "Expected one off-white and one blue vector layer"
shapes = [[[(int(x), int(y)) for x, y in re.findall(r'([0-9]+),([0-9]+)', section)]
           for section in re.findall(r'M[^Z]+Z', path)] for path in paths]
assert len(shapes[0]) >= 4 and len(shapes[1]) >= 1, "Unexpected mark structure"
SCALE = 4
SIDE = 512 * SCALE
bg = Image.new("RGBA", (SIDE, SIDE), (0, 0, 0, 0))
d = ImageDraw.Draw(bg)
d.rounded_rectangle((0, 0, SIDE - 1, SIDE - 1), radius=94 * SCALE, fill="#111217")

def poly(points, color):
    d.polygon([(x * SCALE, y * SCALE) for x, y in points], fill=color)

# The first path contains a small eye highlight, the body and two dark cut-outs.
poly(shapes[0][1], "#F4F2F2")
for hole in shapes[0][2:]:
    poly(hole, "#111217")
poly(shapes[0][0], "#F4F2F2")
for part in shapes[1]:
    poly(part, "#6695FF")

out = bg.resize((1024, 1024), Image.Resampling.LANCZOS)
build = ROOT / "resources" / "build"
build.mkdir(parents=True, exist_ok=True)
out.save(build / "icon.png", optimize=True)
out.save(build / "icon.ico", format="ICO", sizes=[
    (256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)
])
try:
    out.save(build / "icon.icns", format="ICNS")
    print("ICNS generated")
except Exception as exc:
    print(f"ICNS unchanged: {exc}")
print("Saker icons generated:", build / "icon.png", build / "icon.ico")
