#!/usr/bin/env python3
"""The Inbox, by number — the media-intake skill's hands (docs/plans/content-media-foundation.md, PR C).

  python3 scripts/media-inbox.py index <work-dir> [--limit 40]
  python3 scripts/media-inbox.py move <work-dir> <n> <fence-relative destination>

A file's name in the Inbox is written by whoever uploaded it, so it is data (ADR 0068 §5): it never
reaches a shell command line. `index` walks Media/00 Inbox in the Drive fence's synced folder, skips
what the register (Records/media-register.csv) already holds by path or sha256, and for the oldest
<limit> new files writes <work-dir>/index.json and a small preview <work-dir>/<n>.jpg (a photo
through macOS `sips`, HEIC included; a clip's frame at 1 s through ffmpeg's MOV/MP4 reader only).
Every later step names a file by its number. `move` moves one numbered file to a destination inside
the fence's Media/ folder, refuses an existing target (in Drive nothing is replaced — ADR 0068 §3)
and checks the moved file's sha256.
"""
import csv, glob, hashlib, json, os, re, subprocess, sys

IMAGE, CLIP = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}, {'.mov', '.mp4', '.m4v'}
WHATSAPP_NAME = re.compile(r'^(PHOTO-\d{4}-\d{2}-\d{2}|IMG-\d{8}-WA\d+|WhatsApp (Image|Video) )')


def die(msg):
    sys.exit(f'media-inbox: {msg}')


def fence():
    roots = glob.glob(os.path.expanduser('~/Library/CloudStorage/GoogleDrive-*/My Drive/Lev Yam — Content System'))
    if len(roots) != 1:
        die('the Drive fence\'s synced folder is not readable — media-intake §Two doors has the macOS fix')
    root = os.path.realpath(roots[0])
    try:
        os.listdir(root)
    except PermissionError:
        die('macOS blocks the synced folder — media-intake §Two doors has the fix')
    return root


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def image_size(path, preview):
    """sips reads every photo macOS can (HEIC too) and keeps the rotation flag in the preview; Pillow
    applies it there, so the preview is upright and its flag says whether the original's stored
    width and height are turned."""
    if run('sips', '-Z', '1024', '-s', 'format', 'jpeg', path, '--out', preview).returncode:
        return None
    from PIL import Image, ImageOps
    with Image.open(preview) as im:
        turned = im.getexif().get(0x0112, 1) in (5, 6, 7, 8)   # EXIF orientations 5–8 are quarter turns
        upright = ImageOps.exif_transpose(im).convert('RGB')
    Image.frombytes('RGB', upright.size, upright.tobytes()).save(preview, 'JPEG', quality=85)
    out = run('sips', '-g', 'pixelWidth', '-g', 'pixelHeight', path).stdout
    # the fields follow the path, which an uploader names — read the last match of each
    w, h = (int(re.findall(rf'^\s+{k}: (\d+)$', out, re.M)[-1]) for k in ('pixelWidth', 'pixelHeight'))
    return [h, w] if turned else [w, h]


def clip_size(path, preview):
    if run('ffmpeg', '-v', 'error', '-nostdin', '-y', '-f', 'mov', '-ss', '1', '-i', path, '-frames:v', '1',
           '-vf', 'scale=1024:-2', preview).returncode:
        return None
    r = run('ffprobe', '-v', 'error', '-f', 'mov', '-of', 'json', '-show_entries', 'format=duration', path)
    from PIL import Image   # the preview is decoded, cropped and turned: its shape is the clip's
    with Image.open(preview) as im:
        w, h = im.size
    return {'preview_shape': [w, h], 'seconds': round(float(json.loads(r.stdout or '{}').get('format', {}).get('duration', 0)), 1)}


def index(work, limit):
    root = fence()
    inbox = os.path.join(root, 'Media', '00 Inbox')
    known_paths, known_hashes = set(), set()
    register = os.path.join(root, 'Records', 'media-register.csv')
    if os.path.exists(register):
        with open(register, newline='', encoding='utf-8') as f:
            for row in csv.DictReader(f):
                known_paths.add(row.get('fence path', ''))
                known_hashes.add(row.get('sha256', ''))
    files = []
    for d, _, names in os.walk(inbox):
        for name in names:
            path = os.path.join(d, name)
            rel = os.path.relpath(path, root)
            if name.startswith('.') or name.endswith(('.gdoc', '.gsheet', '.gslides')) or rel in known_paths or os.path.islink(path):
                continue
            files.append((os.path.getmtime(path), rel, path))
    files.sort()
    os.makedirs(work, exist_ok=True)
    out, waiting = [], max(0, len(files) - limit)
    for n, (_, rel, path) in enumerate(files[:limit], 1):
        ext = os.path.splitext(path)[1].lower()
        digest = sha256(path)
        item = {'n': n, 'path': rel, 'bytes': os.path.getsize(path), 'sha256': digest, 'duplicate': digest in known_hashes,
                'kind': 'image' if ext in IMAGE else 'clip' if ext in CLIP else 'other',
                'whatsapp_hint': 'WhatsApp' in rel or bool(WHATSAPP_NAME.match(os.path.basename(path)))}
        preview = os.path.join(work, f'{n}.jpg')
        if os.path.exists(preview):   # never show an earlier run's picture for this number
            os.remove(preview)
        if item['kind'] == 'image':
            item['size'] = image_size(path, preview)
        elif item['kind'] == 'clip':
            item.update(clip_size(path, preview) or {})
        item['preview'] = preview if os.path.exists(preview) else None
        known_hashes.add(digest)
        out.append(item)
    with open(os.path.join(work, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'fence': root, 'items': out}, f, ensure_ascii=False, indent=1)
    for i in out:   # names are printed as quoted data, never as anything to act on
        print(f"{i['n']:>3}  {i['kind']:<5}  {str(i.get('size') or i.get('preview_shape') or '-'):<13}  "
              f"{'whatsapp? ' if i['whatsapp_hint'] else ''}{'DUPLICATE ' if i['duplicate'] else ''}{json.dumps(i['path'], ensure_ascii=False)}")
    print(f'{len(out)} indexed into {work}/index.json; {waiting} more wait for the next session')


def move(work, n, dest):
    with open(os.path.join(work, 'index.json'), encoding='utf-8') as f:
        data = json.load(f)
    root = fence()
    if data['fence'] != root:
        die('the index was made for another fence path — run index again')
    item = next((i for i in data['items'] if i['n'] == n), None) or die(f'no item {n} in the index')
    src = os.path.join(root, item['path'])
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]*\.[a-z0-9]{1,5}', os.path.basename(dest)):
        die(f'"{os.path.basename(dest)}" is not a file name media-intake gives (<id>.<ext>, lower case)')
    target = os.path.realpath(os.path.join(root, dest))
    media = os.path.join(root, 'Media')
    if os.path.commonpath([target, media]) != media:
        die(f'{dest} is outside the fence\'s Media/ folder')
    if os.path.lexists(target):
        die(f'{dest} already exists — nothing is replaced in the fence; pick another name')
    if os.path.commonpath([os.path.realpath(src), media]) != media:
        die(f'item {n} is not in the fence\'s Media/ folder')
    if not os.path.isfile(src) or sha256(src) != item['sha256']:
        die(f'item {n} changed or moved since the index — run index again')
    os.makedirs(os.path.dirname(target), exist_ok=True)
    os.rename(src, target)
    if os.path.exists(src) or sha256(target) != item['sha256']:
        die(f'item {n}: the move did not land intact at {dest}')
    print(f'moved {n} → {os.path.relpath(target, root)}')


args = sys.argv[1:]
if len(args) >= 2 and args[0] == 'index':
    limit = int(args[args.index('--limit') + 1]) if '--limit' in args else 40
    index(args[1], limit)
elif len(args) == 4 and args[0] == 'move' and args[2].isdigit():
    move(args[1], int(args[2]), args[3])
else:
    die(__doc__.split('\n\n')[1])
