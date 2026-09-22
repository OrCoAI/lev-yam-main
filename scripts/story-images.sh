#!/usr/bin/env bash
# Produce the three optimized images a story page needs from one original.
#
#   scripts/story-images.sh <source-photo> <slug> [--focus top|center|bottom]
#
# Writes img/stories/<slug>/card.jpg (1200×630), hero-1600.jpg (1600×800) and
# hero-800.jpg (800×400) — the sizes stories/_template*.html and the hub expect
# (table in media/README.md). Pillow does the work: applies the EXIF orientation
# (phone portraits are stored sideways with a rotate flag — ignoring it ships
# rotated heroes), converts an embedded colour profile (iPhone Display P3) to
# sRGB so colours do not shift when the profile is dropped, resamples to cover
# the target, crops the excess, and writes a JPEG FROM PIXELS ONLY — no EXIF,
# GPS, XMP, IPTC, ICC or comment blocks survive, because these files go into a
# public repo and onto the site. Each output is written once, directly to its
# final path, so an aborted run never leaves an un-stripped file in the tree.
# HEIC sources are converted first with macOS `sips` when Pillow cannot open
# them. The source is never modified; originals live in the gitignored media/.
# --focus picks which band of a tall photo survives the crop (default: center).
# A source smaller than 1600×800 (after orientation) is refused: the hero is the
# page's LCP image and an upscaled one ships blur to every visitor.
set -euo pipefail

usage="usage: story-images.sh <source-photo> <slug> [--focus top|center|bottom]"
src=${1:?$usage}; slug=${2:?$usage}; focus=center
if [[ $# -gt 2 ]]; then
  [[ $# -eq 4 && $3 == --focus ]] || { echo "$usage" >&2; exit 1; }
  focus=$4
fi
case $focus in top|center|bottom) ;; *) echo "--focus must be top, center or bottom (got: $focus)" >&2; exit 1 ;; esac
[[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "slug must be english kebab-case: $slug" >&2; exit 1; }
[[ -f "$src" ]] || { echo "no such file: $src" >&2; exit 1; }
python3 -c 'import PIL' 2>/dev/null || { echo "Pillow is required: python3 -m pip install pillow" >&2; exit 1; }

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/img/stories/$slug"; mkdir -p "$out"

# Pillow cannot read HEIC; sips (macOS) can, and keeps the EXIF orientation tag for Pillow to apply.
tmp=""
if ! python3 -c 'import sys; from PIL import Image; Image.open(sys.argv[1])' "$src" 2>/dev/null; then
  command -v sips >/dev/null || { echo "Pillow cannot open $src and sips is not available to convert it" >&2; exit 1; }
  tmpd=$(mktemp -d -t story-src); trap 'rm -rf "$tmpd"' EXIT
  sips -s format jpeg -s formatOptions 100 "$src" --out "$tmpd/src.jpg" >/dev/null || { echo "sips cannot read $src" >&2; exit 1; }
  src=$tmpd/src.jpg
fi

python3 - "$src" "$out" "$focus" <<'PY'
import sys
from PIL import Image, ImageCms, ImageOps

src, out, focus = sys.argv[1], sys.argv[2], sys.argv[3]
SIZES = [('card.jpg', 1200, 630), ('hero-1600.jpg', 1600, 800), ('hero-800.jpg', 800, 400)]

im = ImageOps.exif_transpose(Image.open(src))
icc = im.info.get('icc_profile')
if icc:
    from io import BytesIO
    try:
        im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(BytesIO(icc)), ImageCms.createProfile('sRGB'), outputMode='RGB')
    except (ImageCms.PyCMSError, OSError) as e:
        sys.exit(f"{src}: the embedded colour profile could not be converted ({e}) — re-export the photo as sRGB JPEG")
im = im.convert('RGB')  # transparency (a PNG) becomes black: this script is for photos
sw, sh = im.size
if sw < 1600 or sh < 800:
    sys.exit(f"source is {sw}×{sh} after orientation; the hero needs at least 1600×800 — pick a larger photo")

for name, w, h in SIZES:
    scale = max(w / sw, h / sh)
    rw, rh = max(w, round(sw * scale)), max(h, round(sh * scale))
    resized = im.resize((rw, rh), Image.LANCZOS)
    x0 = (rw - w) // 2
    y0 = {'top': 0, 'center': (rh - h) // 2, 'bottom': rh - h}[focus]
    crop = resized.crop((x0, y0, x0 + w, y0 + h))
    assert crop.size == (w, h)
    path = f"{out}/{name}"
    Image.frombytes('RGB', crop.size, crop.tobytes()).save(path, 'JPEG', quality=82, optimize=True, progressive=True)
    check = Image.open(path)
    if check.size != (w, h) or check.getexif() or any(k in check.info for k in ('icc_profile', 'exif', 'xmp', 'comment', 'photoshop')):
        sys.exit(f"{path}: unexpected size or metadata after save")
    print(f"wrote img/stories/{out.rsplit('/', 1)[1]}/{name} ({check.size[0]}×{check.size[1]})")
PY
