"""
Turns the GPT image batches in art-source/gpt/ into game-ready art in public/art/gpt/.
Run: python3 tools/art/gpt.py   (needs Pillow, numpy, scipy)

- ground/*      -> seamless 1024 tiles (half-offset cross-blend), slightly darkened
- decals/*      -> 3x3 grids sliced, trimmed, packed into one atlas + manifest
- landmarks/*   -> grey background keyed out, recoloured toward the palette, ink outline
- forest/*      -> nine-up transparent sheets split by connected alpha, trimmed, packed into one atlas
                   + manifest with each sprite's foot (trunk base) for anchoring
- camp/*        -> camp station props, keyed and recoloured like the landmarks
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

def pack(items, out_name, width=2048, extra=None):
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
    manifest = {'image': f'{out_name}.webp', 'size': list(atlas.size), 'frames': frames, **(extra or {})}
    json.dump(manifest, open(f'{OUT}/{out_name}.json', 'w'), indent=1)
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

# ---------- forest: real alpha; split by connected shape rather than a grid (cells drift) ----------
def pieces(img, count=9):
    a = np.asarray(img.getchannel('A')) > 24
    # Close small gaps so a branch or a fern frond stays with its tree; close less (then fall
    # back to the grid) when neighbours touch.
    for grow in (6, 3, 1):
        labels, n = ndimage.label(ndimage.binary_dilation(a, iterations=grow))
        sizes = ndimage.sum(a, labels, range(1, n + 1))
        keep = (np.argsort(-sizes)[:count] + 1).tolist()
        if len(keep) == count and sizes[keep[-1] - 1] > sizes[keep[0] - 1] * 0.12:
            break
    else:
        return [c for c in cells(img)]
    boxes = ndimage.find_objects(labels)
    found = []
    for lab in keep:
        ys, xs = boxes[lab - 1]
        mask = (labels[ys, xs] == lab)
        crop = np.asarray(img)[ys, xs].copy()
        crop[..., 3] = np.where(mask, crop[..., 3], 0)
        found.append((ys.start, xs.start, Image.fromarray(crop)))
    # Reading order: rows by centre height, then left to right.
    found.sort(key=lambda f: (round((f[0] + f[2].height / 2) / (img.height / 3)), f[1]))
    return [f[2] for f in found]

def foot(im):
    """Fraction down the sprite where its base sits: lowest solid row under the middle third."""
    a = np.asarray(im.getchannel('A'))[:, im.width // 3: 2 * im.width // 3] > 128
    rows = np.nonzero(a.any(1))[0]
    return round(float(rows[-1] + 1) / im.height, 3) if len(rows) else 0.95

forest, feet = [], {}
for n in names('forest'):
    kind = n.replace('forest-', '')
    for i, im in enumerate(pieces(src(f'{SRC}/forest/{n}').convert('RGBA'))):
        im = trim(im, 2)
        if im is None:
            continue
        im.thumbnail((300, 340), Image.LANCZOS)
        im = grade(im, 0.15, (0.95, 0.97, 1.0), 0.9)
        forest.append((f'{kind}-{i}', im))
        feet[f'{kind}-{i}'] = foot(im)
if forest:
    pack(forest, 'forest', 2048, {'feet': feet})

# ---------- camp stations: keyed like the landmarks, wood kept a little warmer ----------
for n in names('camp'):
    im = key_background(src(f'{SRC}/camp/{n}'))
    im = trim(im, 12)
    im.thumbnail((420, 420), Image.LANCZOS)
    im = grade(im, 0.7, (0.7, 0.8, 1.0), 0.8)
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
    # U8: the items added after round 2 (picked up as soon as the sheet lands).
    'U8': ['moonpull', 'moonblades', 'totem', 'frostward', 'horn', None, None, None, None],
    'E1': ['barrage', 'worldpiercer', 'deadshot', 'hellfire', 'frostbite', 'thunderstorm', 'phantom-hunt', 'red-harvest', 'apex-hunter'],
}
NAVY = np.array([7, 11, 22], np.float32)

def icon_cells(img, ids, size=128, pad=0.1):
    """
    Each icon's painted shape, wherever it sits: GPT rarely centres icons in their grid cells and
    some cross the cell lines. Bright shapes are found over the whole sheet, each is given to the
    cell its centre falls in, and every icon is re-framed centred on navy with even padding.
    """
    rgba = np.asarray(img.convert('RGBA'), np.float32)
    a = rgba[..., 3:] / 255
    rgb = rgba[..., :3] * a + NAVY * (1 - a)  # transparent sheets (U6) sit on the same navy
    h, w, _ = rgb.shape
    lum = (rgb - NAVY).max(-1)
    solid = ndimage.binary_opening(lum > 40, iterations=2)
    labels, n = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    if not n:
        return []
    centres = ndimage.center_of_mass(solid, labels, range(1, n + 1))
    sizes = ndimage.sum(solid, labels, range(1, n + 1))
    owner = np.zeros(n + 1, int) - 1
    for k, ((cy, cx), sz) in enumerate(zip(centres, sizes), start=1):
        if sz > 40:
            owner[k] = min(2, int(cy / h * 3)) * 3 + min(2, int(cx / w * 3))
    out = []
    for cell, id_ in enumerate(ids):
        if not id_:
            continue
        mine = np.isin(labels, np.nonzero(owner == cell)[0])
        if not mine.any():
            continue
        # Keep the soft glow around the shape, and nothing from the neighbours.
        keep = ndimage.binary_dilation(mine, iterations=14)
        ys, xs = np.nonzero(keep)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        soft = np.asarray(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), np.float32)[..., None] / 255
        crop = (rgb * soft + NAVY * (1 - soft))[y0:y1, x0:x1]
        tile = Image.fromarray(crop.clip(0, 255).astype(np.uint8))
        inner = int(size * (1 - 2 * pad))
        tile.thumbnail((inner, inner), Image.LANCZOS)
        frame = Image.new('RGBA', (size, size), tuple(int(v) for v in NAVY) + (255,))
        frame.paste(tile, ((size - tile.width) // 2, (size - tile.height) // 2))
        out.append((id_, frame))
    return out

icons = []
for sheet, ids in ICON_SHEETS.items():
    path = f'{SRC}/icons/{sheet}'
    if not any(os.path.exists(path + e) for e in ('.png', '.webp')):
        continue
    icons += icon_cells(src(path), ids)
pack(icons, 'icons', 1024)

# ---------- backgrounds ----------
for n in names('backgrounds'):
    src(f'{SRC}/backgrounds/{n}').convert('RGB').save(f'{OUT}/{n}.webp', quality=84)
print('done')
