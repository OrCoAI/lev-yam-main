#!/usr/bin/env bash
# The one derivative script (ADR 0069 §6; docs/plans/content-media-foundation.md, PR C).
#
#   scripts/media.sh <media-id> <source> <out-dir> <preset>[=<stem>] … [--focus <where>]
#
# Cuts one original into every size of each named preset in content/channels.json — the one home
# of sizes — and writes them into <out-dir>. <where> is top | center | bottom | left | right or
# "<x>,<y>" in percent (default 50,50): which part of the source survives a crop.
#
# Before any path is touched, the ID is checked against the media grammar, and the record is read
# from content/media.json (add it first — content/README.md §A media record). The record decides:
#   consent   a recognisable person only within the record's scope: a site preset into img/ needs
#             `site`; everything else — social presets, and any cut for the reels — `social`
#             (ADR 0069 §4). Anything but people none / not-recognisable needs a valid scope.
#   whatsapp  a `whatsapp: true` record is refused by a preset with "whatsapp_ok": false (the story
#             hero and card) and goes through a local clean-up pass first — de-blocking, a light
#             spatial denoise, a luminance-only autocontrast; never upscaling, never a service
#             (ADR 0069, amended 2026-10-23)
#   kind      image presets for an image (JPEG / PNG / WebP, HEIC through macOS `sips`), video
#             presets for a clip (MOV / MP4 only — never a playlist that could reach other files)
#
# Where files may come from and go to — the fence is a rule, and this script keeps it for itself
# (ADR 0068 §3, amended 2026-10-24): a source is a file in the Drive fence's synced folder, in the
# gitignored media/ cache, or one of the record's own renditions. Site presets may write under
# img/; any image preset may write into video/public/photos (committed) or video/public/private
# (gitignored) for a reel; every preset may write into the fence or the cache. Files written under
# img/ or video/public/photos join the record's renditions. A file that exists in the fence is
# never replaced.
#
# Every output is written from pixels only — no EXIF, GPS, XMP, IPTC, ICC or comment block survives;
# a clip keeps one video and one audio stream, no metadata, chapters, data or subtitle tracks
# (a phone's data track can carry GPS), converted to BT.709 SDR — then re-read and refused if
# anything slipped through. A source smaller than the preset's min_source (the source pixels that
# reach the output; absent = its largest size) is refused: an upscaled picture ships blur.
set -euo pipefail

python3 -c 'import PIL' 2>/dev/null || { echo "media.sh: Pillow is required: python3 -m pip install pillow" >&2; exit 1; }
root=$(cd "$(dirname "$0")/.." && pwd -P)

python3 - "$root" "$@" <<'PY'
import glob, json, os, re, shutil, subprocess, sys, tempfile
from io import BytesIO
from PIL import Image, ImageCms, ImageOps

ROOT, args = sys.argv[1], sys.argv[2:]
USAGE = 'usage: media.sh <media-id> <source> <out-dir> <preset>[=<stem>] … [--focus top|center|bottom|left|right|<x>,<y>]'
NAMED = {'top': (50, 0), 'center': (50, 50), 'bottom': (50, 100), 'left': (0, 50), 'right': (100, 50)}
MEDIA_ID = re.compile(r'\d{4}-\d{2}-[a-z][a-z0-9-]*-\d{2}')   # content/README.md §IDs
STEM = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
CLEANUP = 'deblock=filter=weak:block=8,hqdn3d=1.5:1.5:0:0'   # the WhatsApp pass: JPEG blocks, then light grain


def die(msg):
    sys.exit(f'media.sh: {msg}')


focus = NAMED['center']
if '--focus' in args:
    i = args.index('--focus')
    value = args[i + 1] if i + 1 < len(args) else die(USAGE)
    del args[i:i + 2]
    m = re.fullmatch(r'(\d{1,3}),(\d{1,3})', value)
    focus = NAMED.get(value) or (m and (int(m[1]), int(m[2])))
    if not focus or max(focus) > 100:
        die(f'--focus must be top, center, bottom, left, right or <x>,<y> in percent (got: {value})')
if len(args) < 4:
    die(USAGE)
mid, src, out, wanted = args[0], args[1], args[2], args[3:]
if not MEDIA_ID.fullmatch(mid):
    die(f'"{mid}" is not a media id (content/README.md §IDs)')

load = lambda rel: json.load(open(os.path.join(ROOT, rel), encoding='utf-8'))
media_doc, channels = load('content/media.json'), load('content/channels.json')
rec = next((r for r in media_doc['media'] if r.get('id') == mid), None)
if rec is None:
    die(f'{mid} has no record in content/media.json — add it first (content/README.md §A media record)')
PRESETS = channels['presets']
SITE = set(next(c for c in channels['channels'] if c['id'] == 'site')['presets'])
QUALITY = channels['quality']
SCOPES = ['none', 'site', 'social', 'ads']
IMAGE_EXT, CLIP_EXT, HEIC_EXT = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}, {'.mov', '.mp4', '.m4v'}, {'.heic', '.heif'}

# ── the paths: the fence's synced folder, the media/ cache, and the repo's committed media folders ──
real = lambda p: os.path.realpath(os.path.expanduser(p))
inside = lambda p, base: os.path.commonpath([p, base]) == base
FENCE = [real(p) for p in glob.glob(os.path.expanduser('~/Library/CloudStorage/GoogleDrive-*/My Drive/Lev Yam — Content System'))]
CACHE, IMG = real(os.path.join(ROOT, 'media')), real(os.path.join(ROOT, 'img'))
PHOTOS, PRIVATE = real(os.path.join(ROOT, 'video/public/photos')), real(os.path.join(ROOT, 'video/public/private'))
RENDITIONS = {real(os.path.join(ROOT, f)) for f in rec.get('renditions', [])}

src_real = real(src)
if not os.path.isfile(src_real):
    die(f'no such file: {src}')
if not (src_real in RENDITIONS or any(inside(src_real, b) for b in [*FENCE, CACHE])):
    die(f'{src} is outside the Drive fence, the media/ cache and {mid}\'s renditions — the fence is the rule (ADR 0068 §3)')
ext = os.path.splitext(src_real)[1].lower()
if ext not in (IMAGE_EXT if rec.get('kind') == 'image' else CLIP_EXT):   # a playlist or a document is not a photo or a clip
    die(f'{src}: a {rec.get("kind")} source must be one of {sorted(IMAGE_EXT if rec.get("kind") == "image" else CLIP_EXT)}')
if rec.get('people') not in ('none', 'not-recognisable') and rec.get('consent') not in SCOPES:
    die(f'{mid}: people "{rec.get("people")}" with consent "{rec.get("consent")}" — the record needs a valid consent scope (content/README.md §A media record)')

out_real = real(out)
in_fence = any(inside(out_real, b) for b in FENCE)
# where the output lands decides the use: img/ is the site; the reels' folders, and every non-site preset, are social
if inside(out_real, IMG):
    dest = 'img/'
elif inside(out_real, PHOTOS) or inside(out_real, PRIVATE):
    dest = 'video/'
elif in_fence or inside(out_real, CACHE):
    dest = 'fence'
else:
    die(f'media.sh writes into img/, video/public/photos|private, the Drive fence or the media/ cache — not {out}')
plan = []   # (preset name, preset, stem)
for w in wanted:
    name, _, stem = w.partition('=')
    p = PRESETS.get(name) or die(f'"{name}" is not a preset in content/channels.json')
    if p.get('made_by'):
        die(f'{name} is made by {p["made_by"]}, not cut by media.sh')
    site = name in SITE
    stem = stem or p.get('stem') or ('' if site else f'{mid}-{name}')
    if not STEM.fullmatch(stem):
        die(f'{name} needs a kebab-case file stem: {name}=<stem>' if not stem else f'"{stem}" is not a kebab-case file stem')
    if dest == 'img/' and not site:
        die(f'{name} is not a site preset — it writes into the Drive fence or the media/ cache, never img/')
    kind = 'clip' if p['kind'] == 'video' else 'image'
    if rec.get('kind') != kind:
        die(f'{name} is a {p["kind"]} preset and {mid} is a {rec.get("kind")}')
    scope = 'site' if dest == 'img/' else 'social'   # anything outside the site's img/ is one step from a social channel
    if rec.get('people') not in ('none', 'not-recognisable') and SCOPES.index(rec.get('consent')) < SCOPES.index(scope):
        die(f'{mid} shows recognisable {rec["people"]} with consent "{rec.get("consent")}" — {name} needs "{scope}" (ADR 0069 §4); ask the owner')
    if rec.get('whatsapp') and p.get('whatsapp_ok') is False:
        die(f'{mid} is a WhatsApp copy and {name} refuses one — use the original (ADR 0069, amended 2026-10-23)')
    plan.append((name, p, stem))

tmpdir = tempfile.mkdtemp(prefix='media-sh-')
written = []


def ffmpeg(*a):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-y', *a], capture_output=True, text=True)
    if r.returncode:
        die(f'ffmpeg failed: {r.stderr.strip()[-400:]}')


def region(sw, sh, w, h):
    """The part of a sw×sh source a w×h frame keeps, placed by --focus: (x0, y0, cw, ch)."""
    cw, ch = (round(sh * w / h), sh) if sw * h > sh * w else (sw, round(sw * h / w))
    return round((sw - cw) * focus[0] / 100), round((sh - ch) * focus[1] / 100), cw, ch


def big_enough(name, p, cw, ch):
    need = p.get('min_source') or max(p['sizes'], key=lambda s: s[0] * s[1])
    if cw < need[0] or ch < need[1]:
        die(f'{name}: {cw}×{ch} source pixels reach the frame, the preset needs at least {need[0]}×{need[1]} — pick a larger photo, never upscale')


def target(stem, suffix, ext):
    return os.path.join(out_real, f'{stem}{suffix}.{ext}')


def rung(p, size):
    """A preset with several sizes names each file by its width (hero-1600, hero-800)."""
    return f'-{size[0]}' if len(p['sizes']) > 1 else ''


# ── images ──
def open_image(path):
    if ext not in HEIC_EXT:
        try:
            im = Image.open(path, formats=['JPEG', 'MPO', 'PNG', 'WEBP'])
            im.load()
        except (OSError, ValueError) as e:
            die(f'{path}: not a readable JPEG, PNG or WebP ({e})')
    else:
        if not shutil.which('sips'):
            die(f'Pillow cannot open {path} and sips is not available to convert it')
        conv = os.path.join(tmpdir, 'src.jpg')   # sips keeps the orientation tag for exif_transpose
        if subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '100', path, '--out', conv], capture_output=True).returncode:
            die(f'sips cannot read {path}')
        im = Image.open(conv, formats=['JPEG'])
        im.load()
    im = ImageOps.exif_transpose(im)
    icc = im.info.get('icc_profile')
    if icc:
        try:
            im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(BytesIO(icc)), ImageCms.createProfile('sRGB'), outputMode='RGB')
        except (ImageCms.PyCMSError, OSError) as e:
            die(f'{path}: the embedded colour profile could not be converted ({e}) — re-export the photo as sRGB')
    return im.convert('RGB')   # transparency becomes black: photos only; save_image strips the rest


def clean_image(im):
    a, b = os.path.join(tmpdir, 'in.png'), os.path.join(tmpdir, 'out.png')
    im.save(a, compress_level=0)
    ffmpeg('-i', a, '-vf', f'format=gbrp,{CLEANUP},format=rgb24', '-frames:v', '1', b)
    with Image.open(b) as c:
        return ImageOps.autocontrast(c.convert('RGB'), cutoff=0.2, preserve_tone=True)


def fresh_target(path):
    if in_fence and os.path.lexists(path):   # in Drive nothing is replaced — ADR 0068 §3
        die(f'{path} exists in the fence — media.sh never replaces a file there; pick another stem or folder')


def save_image(im, path, q):
    fresh_target(path)
    part = path + '.part'
    pixels = Image.frombytes('RGB', im.size, im.tobytes())
    if path.endswith('.jpg'):
        pixels.save(part, 'JPEG', quality=q, optimize=True, progressive=True)
    elif path.endswith('.webp'):
        pixels.save(part, 'WEBP', quality=q, method=6)
    else:
        die(f'{path}: media.sh writes jpg and webp only')
    with Image.open(part) as check:
        if check.size != im.size or check.getexif() or any(k in check.info for k in ('icc_profile', 'exif', 'xmp', 'comment', 'photoshop')):
            os.remove(part)
            die(f'{path}: unexpected size or metadata after save')
    os.replace(part, path)
    written.append((path, im.size))


# ── clips ──
def probe(path, *entries):
    r = subprocess.run(['ffprobe', '-v', 'error', '-of', 'json', *entries, path], capture_output=True, text=True)
    if r.returncode:
        die(f'ffprobe cannot read {path}: {r.stderr.strip()[-300:]}')
    return json.loads(r.stdout)


def clip_size(path):
    """The first frame exactly as ffmpeg decodes it for the cut — a phone's coded size can carry a crop
    that ffprobe does not apply, and the rotation is applied too."""
    first = os.path.join(tmpdir, 'first.png')
    ffmpeg('-f', 'mov', '-i', path, '-map', '0:v:0', '-frames:v', '1', first)
    with Image.open(first) as f:
        return f.size


def to_bt709():
    """A phone clip is Display P3 or HLG (BT.2020); the output is BT.709 SDR. HLG is made to show on SDR
    screens, so its primaries are converted and its curve read as BT.2020's; PQ has no such fallback."""
    s = probe(src_real, '-select_streams', 'v:0', '-show_entries', 'stream=color_primaries,color_transfer,color_space,color_range')['streams'][0]
    prim, trc, space = s.get('color_primaries', 'unknown'), s.get('color_transfer', 'unknown'), s.get('color_space', 'unknown')
    if trc == 'smpte2084':
        die(f'{src}: a PQ (HDR10) clip — export it as SDR or HLG first')
    trc = {'arib-std-b67': 'bt2020-10', 'unknown': 'bt709'}.get(trc, trc)
    space = {'bt2020nc': 'bt2020ncl', 'unknown': 'bt709'}.get(space, space)
    prim = {'unknown': 'bt709'}.get(prim, prim)
    rng = 'pc' if s.get('color_range') == 'pc' else 'tv'
    return f'colorspace=all=bt709:range=tv:format=yuv420p:iprimaries={prim}:itrc={trc}:ispace={space}:irange={rng}'


def save_clip(path, size, crop, fps):
    fresh_target(path)
    part = path + '.part.mp4'
    w, h = size
    x0, y0, cw, ch = crop   # region() of the decoded, rotated frame — the pixels big_enough() measured
    vf = ['sidedata=mode=delete', 'format=yuv420p10le', to_bt709()] + ([CLEANUP] if rec.get('whatsapp') else []) + [f'crop={cw}:{ch}:{x0}:{y0}', f'scale={w}:{h}:flags=lanczos', f'fps={fps}', 'format=yuv420p']
    ffmpeg('-f', 'mov', '-i', src_real, '-map', '0:v:0', '-map', '0:a:0?', '-dn', '-sn',
           '-map_metadata', '-1', '-map_metadata:s:v', '-1', '-map_metadata:s:a', '-1', '-map_chapters', '-1',
           '-metadata:s:v', 'encoder=', '-metadata:s:a', 'encoder=',
           '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact',
           '-vf', ','.join(vf), '-c:v', 'libx264', '-preset', 'slow', '-crf', str(QUALITY['mp4_crf']), '-profile:v', 'high',
           '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
           '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', part)
    info = probe(part, '-show_entries', 'format_tags:stream=codec_type,width,height:stream_tags:stream_side_data')
    streams = info['streams']
    if [(s['width'], s['height']) for s in streams if s['codec_type'] == 'video'] != [(w, h)]:
        os.remove(part)
        die(f'{path}: not one {w}×{h} video stream after encoding')
    format_tags = set(info.get('format', {}).get('tags', {})) - {'major_brand', 'minor_version', 'compatible_brands'}
    stream_tags = {k for s in streams for k in s.get('tags', {})} - {'language', 'handler_name', 'vendor_id'}
    if format_tags or stream_tags or any(s.get('side_data_list') for s in streams) or {s['codec_type'] for s in streams} - {'video', 'audio'}:
        os.remove(part)
        die(f'{path}: metadata survived ({sorted(format_tags | stream_tags)})')
    os.replace(part, path)
    written.append((path, tuple(size)))


try:
    if rec['kind'] == 'image':
        im = open_image(src_real)
        sw, sh = im.size
    else:
        sw, sh = clip_size(src_real)
    for name, p, stem in plan:   # every size and every target is checked before the first file is written
        if 'widths' in p:
            if sw < p['widths'][0]:
                die(f'{name}: the source is {sw}px wide, the preset needs at least {p["widths"][0]}')
            targets = [target(stem, f'-{min(w, sw)}', p['format']) for w in p['widths']] + [target(stem, '', 'jpg')]
        else:
            for size in p['sizes']:
                big_enough(name, p, *region(sw, sh, *size)[2:])
            targets = [target(stem, rung(p, s), 'mp4' if p['kind'] == 'video' else p['format']) for s in p['sizes']]
        for path in targets:
            fresh_target(path)
    os.makedirs(out_real, exist_ok=True)
    if rec['kind'] == 'image':
        if rec.get('whatsapp'):
            im = clean_image(im)
        for name, p, stem in plan:
            q = QUALITY[p['format']]
            if 'widths' in p:   # srcset rungs named by their real width, plus the jpg fallback
                for w in sorted({min(w, sw) for w in p['widths']}):
                    save_image(im.resize((w, round(sh * w / sw)), Image.LANCZOS), target(stem, f'-{w}', p['format']), q)
                k = min(1, p['fallback_long_edge'] / max(sw, sh))
                save_image(im.resize((round(sw * k), round(sh * k)), Image.LANCZOS) if k < 1 else im, target(stem, '', 'jpg'), QUALITY['jpg'])
                continue
            for size in p['sizes']:
                x0, y0, cw, ch = region(sw, sh, *size)
                save_image(im.crop((x0, y0, x0 + cw, y0 + ch)).resize(tuple(size), Image.LANCZOS), target(stem, rung(p, size), p['format']), q)
    else:
        for name, p, stem in plan:
            for size in p['sizes']:
                save_clip(target(stem, rung(p, size), 'mp4'), size, region(sw, sh, *size), p['fps'])
finally:
    shutil.rmtree(tmpdir, ignore_errors=True)

new = [os.path.relpath(path, ROOT) for path, _ in written if inside(path, IMG) or inside(path, PHOTOS)]
for path, (w, h) in written:
    print(f'wrote {os.path.relpath(path, ROOT) if inside(path, real(ROOT)) else path} ({w}×{h})')
if new:   # a site rendition is recorded on its original (content/README.md §A media record)
    rec['renditions'] = rec.get('renditions', []) + [f for f in new if f not in rec.get('renditions', [])]
    with open(os.path.join(ROOT, 'content/media.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps(media_doc, indent=2, ensure_ascii=False) + '\n')
    print(f'recorded on {mid} — now: node scripts/check-content.mjs --write (fills used_in)')
PY
