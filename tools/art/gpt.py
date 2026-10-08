"""
Turns the GPT image batches in art-source/gpt/ into game-ready art in public/art/gpt/.
Run: python3 tools/art/gpt.py   (needs Pillow, numpy, scipy)

- ground/*      -> seamless 1024 tiles (half-offset cross-blend), slightly darkened
- decals/*      -> 3x3 grids sliced, trimmed, packed into one atlas + manifest
- landmarks/*   -> grey background keyed out, recoloured toward the palette, ink outline
- icons/*       -> 3x3 grids sliced into 128 px icons in one atlas + manifest (id map below)
- backgrounds/* -> WebP for menu screens
Sources are kept as WebP (lossless for alpha sheets) to stay small in git.
"""
import json, os, glob
import numpy as np
from scipy import ndimage
from PIL import Image, ImageFilter

SRC = 'art-source/gpt'
OUT = 'public/art/gpt'
os.makedirs(OUT, exist_ok=True)

def src(path):
    """Prefer the original PNG when present, else the committed WebP."""
    base = os.path.splitext(path)[0]
    for ext in ('.png', '.webp'):
        if os.path.exists(base + ext):
            return Image.open(base + ext)
    raise FileNotFoundError(path)

def names(folder):
    return sorted({os.path.splitext(os.path.basename(p))[0] for p in glob.glob(f'{SRC}/{folder}/*.*')})

# ---------- ground: seamless by cross-blending with a half-offset copy ----------
def seamless(img, size=1024):
    a = np.asarray(img.convert('RGB').resize((size, size), Image.LANCZOS), dtype=np.float32)
    b = np.roll(a, (size // 2, size // 2), axis=(0, 1))
    t = np.linspace(-1, 1, size)
    # Weight 1 in the middle, 0 at the edges: edges come from the rolled copy, whose edges are
    # the original's interior, so the result wraps. A wide falloff hides the blend.
    w1 = np.clip((1 - np.abs(t)) * 2.2, 0, 1)
    w = np.minimum.outer(w1, w1)[..., None]
    out = a * w + b * (1 - w)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))

for n in names('ground'):
    tile = seamless(src(f'{SRC}/ground/{n}'))
    tile.save(f'{OUT}/{n}.webp', quality=88)

# ---------- shared helpers ----------
def cells(img, rows=3, cols=3):
    w, h = img.size
    for r in range(rows):
        for c in range(cols):
            yield img.crop((c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows))

def trim(img, pad=4):
    box = img.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    if not box:
        return None
    x0, y0, x1, y1 = box
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))

def pack(items, out_name, width=2048):
    """Shelf-pack (name, image) pairs into one atlas; returns the manifest."""
    items = sorted(items, key=lambda kv: -kv[1].height)
    x = y = shelf = 0
    frames = {}
    for name, im in items:
        if x + im.width > width:
            x, y, shelf = 0, y + shelf + 2, 0
        frames[name] = [x, y, im.width, im.height]
        x += im.width + 2
        shelf = max(shelf, im.height)
    atlas = Image.new('RGBA', (width, y + shelf))
    for name, im in items:
        fx, fy, _, _ = frames[name]
        atlas.paste(im, (fx, fy))
    atlas.save(f'{OUT}/{out_name}.webp', quality=90, alpha_quality=95, method=6)
    json.dump({'image': f'{out_name}.webp', 'size': list(atlas.size), 'frames': frames}, open(f'{OUT}/{out_name}.json', 'w'), indent=1)
    return frames

def grade(img, desat=0.0, mul=(1, 1, 1), gain=1.0):
    """Pull colours toward the palette: desaturate, cool tint, darken. Alpha untouched."""
    a = np.asarray(img.convert('RGBA'), dtype=np.float32)
    rgb = a[..., :3]
    lum = (rgb * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    rgb = rgb + (lum - rgb) * desat
    rgb = rgb * np.array(mul) * gain
    a[..., :3] = rgb
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))

# ---------- decals ----------
DECAL_GAIN = {'mushrooms': 0.62, 'bones': 0.7, 'puddles': 0.85}
decals = []
for n in names('decals'):
    kind = n.replace('decal-', '')
    for i, cell in enumerate(cells(src(f'{SRC}/decals/{n}').convert('RGBA'))):
        im = trim(cell)
        if im is None:
            continue
        im.thumbnail((150, 150), Image.LANCZOS)
        decals.append((f'{kind}-{i}', grade(im, 0.2, (0.9, 0.95, 1.0), DECAL_GAIN.get(kind, 0.8))))
pack(decals, 'decals')

# ---------- landmarks: key out the flat grey background, then recolour and ink ----------
def key_background(img, tolerance=26):
    a = np.asarray(img.convert('RGB'), dtype=np.int16)
    h, w, _ = a.shape
    # Background colour from the corners; flood fill from the border through similar pixels.
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    similar = (np.abs(a - bg).max(-1) < tolerance)
    # Background = regions of bg-coloured pixels that touch the border, plus enclosed pockets
    # (between pillars, under a pot) that are large and very close to the background colour.
    labels, _ = ndimage.label(similar)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    mask = np.isin(labels, border[border > 0])
    tight = np.abs(a - bg).max(-1) < tolerance * 0.5
    pockets, count = ndimage.label(tight & ~mask)
    if count:
        sizes = ndimage.sum(np.ones_like(pockets), pockets, range(1, count + 1))
        mask |= np.isin(pockets, np.nonzero(sizes > 900)[0] + 1)
    alpha = Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = img.convert('RGBA')
    out.putalpha(alpha)
    return out

def ink(img, width=4, colour=(6, 10, 20)):
    alpha = img.getchannel('A')
    grown = alpha.filter(ImageFilter.MaxFilter(width * 2 + 1))
    base = Image.new('RGBA', img.size, colour + (0,))
    base.putalpha(grown)
    base.alpha_composite(img)
    return base

for n in names('landmarks'):
    im = key_background(src(f'{SRC}/landmarks/{n}'))
    im = trim(im, 12)
    im.thumbnail((640, 640), Image.LANCZOS)
    keep_warm = n in ('landmark-campfire',)
    im = grade(im, 0.55 if keep_warm else 0.82, (0.62, 0.74, 1.0), 0.78)
    ink(im, 3).save(f'{OUT}/{n}.webp', quality=90, alpha_quality=95, method=6)

# ---------- icons ----------
ICON_SHEETS = {
    # U1 (redo) and U7 are picked up as soon as their files land in art-source/gpt/icons/.
    'U1': ['quick-nock', 'draw-strength', 'taut-string', 'steady-hand', 'heavy-bow', 'swift-bow', 'eagle-eye', 'broadhead', 'far-sight'],
    'U7': ['hunter-s-mark', 'fletcher-s-craft', 'heaven-s-volley', None, None, None, None, None, None],
    'U2': ['moonwell', 'executioner', 'piercer', 'longshaft', 'broadshaft', 'barbed-arrow', 'ember-arrow', 'frost-arrow', 'storm-arrow'],
    'U3': ['venom-arrow', 'rupture', 'lightfoot', 'windstep', 'evasive-shot', 'backstep', 'phantom-step', 'blood-trail', 'predator'],
    'U4': ['chain-kill', 'last-arrow', 'ricochet', 'splitshot', 'starfall', 'moonseeker', 'echo-shot', 'still-water', 'briar-shot'],
    'U5': ['lifedraw', 'moonraven', 'thornsnare', 'lantern', 'boon:Might', 'boon:Vigor', 'boon:Swiftness', 'boon:Keen Eye', 'boon:Greed'],
    'U6': ['boon:Growth', 'boon:Magnet', 'boon:Reroll', 'boon:Banish', 'boon:Skip', 'boon:Fourth Card', 'boon:Second Wind', None, None],
    'E1': ['barrage', 'worldpiercer', 'deadshot', 'hellfire', 'frostbite', 'thunderstorm', 'phantom-hunt', 'red-harvest', 'apex-hunter'],
}
icons = []
for sheet, ids in ICON_SHEETS.items():
    path = f'{SRC}/icons/{sheet}'
    if not any(os.path.exists(path + e) for e in ('.png', '.webp')):
        continue
    img = src(path).convert('RGBA')
    for id_, cell in zip(ids, cells(img)):
        if not id_:
            continue
        side = min(cell.size)
        inset = int(side * 0.05)
        cell = cell.crop((inset, inset, cell.width - inset, cell.height - inset)).resize((128, 128), Image.LANCZOS)
        if cell.getchannel('A').getextrema()[0] < 250:
            # Real transparency (U6): sit it on the same navy as the others.
            bg = Image.new('RGBA', cell.size, (7, 11, 22, 255))
            bg.alpha_composite(cell)
            cell = bg
        icons.append((id_, cell))
pack(icons, 'icons', 1024)

# ---------- backgrounds ----------
for n in names('backgrounds'):
    src(f'{SRC}/backgrounds/{n}').convert('RGB').save(f'{OUT}/{n}.webp', quality=84)
print('done')
