import { Container, Sprite, Texture, TilingSprite } from 'pixi.js';
import { PALETTE, ATMOSPHERE, tint } from '../data/art';

/** Seamless value noise on a periodic lattice: wraps exactly at `size`. */
function periodicNoise(size: number, cells: number, seed: number) {
  const lattice = new Float32Array(cells * cells);
  let s = seed | 0;
  for (let i = 0; i < lattice.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    lattice[i] = (s >>> 0) / 4294967296;
  }
  const out = new Float32Array(size * size),
    step = size / cells;
  for (let y = 0; y < size; y++) {
    const gy = y / step,
      y0 = Math.floor(gy),
      ty = gy - y0,
      sy = ty * ty * (3 - 2 * ty),
      r0 = (y0 % cells) * cells,
      r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const gx = x / step,
        x0 = Math.floor(gx),
        tx = gx - x0,
        sx = tx * tx * (3 - 2 * tx),
        c0 = x0 % cells,
        c1 = (x0 + 1) % cells;
      const top = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * sx,
        bottom = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * sx;
      out[y * size + x] = top + (bottom - top) * sy;
    }
  }
  return out;
}
/** Sum of octaves, normalised to 0..1. */
function fbm(size: number, octaves: [cells: number, weight: number][], seed: number) {
  const out = new Float32Array(size * size);
  let total = 0;
  octaves.forEach(([cells, weight], i) => {
    const layer = periodicNoise(size, cells, seed + i * 7919);
    for (let k = 0; k < out.length; k++) out[k] += layer[k] * weight;
    total += weight;
  });
  for (let k = 0; k < out.length; k++) out[k] /= total;
  return out;
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function moorTexture(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  const image = c.createImageData(size, size);
  const value = fbm(
    size,
    [
      [4, 0.5],
      [8, 0.3],
      [32, 0.14],
      [128, 0.06],
    ],
    4021,
  );
  const moss = fbm(
    size,
    [
      [3, 0.6],
      [12, 0.4],
    ],
    77,
  );
  const dark = rgb(PALETTE.ground.dark),
    light = rgb(PALETTE.ground.light),
    mossy = rgb(PALETTE.ground.moss);
  for (let k = 0; k < value.length; k++) {
    const v = Math.min(1, Math.max(0, (value[k] - 0.3) * 1.6)),
      m = Math.max(0, (moss[k] - 0.55) * 3);
    for (let ch = 0; ch < 3; ch++) {
      const base = dark[ch] + (light[ch] - dark[ch]) * v;
      image.data[k * 4 + ch] = base + (mossy[ch] - base) * Math.min(0.6, m);
    }
    image.data[k * 4 + 3] = 255;
  }
  c.putImageData(image, 0, 0);
  return Texture.from(canvas);
}

function fogTexture(size: number, seed: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  const image = c.createImageData(size, size);
  const n = fbm(
    size,
    [
      [2, 0.45],
      [4, 0.35],
      [8, 0.2],
    ],
    seed,
  );
  for (let k = 0; k < n.length; k++) {
    const a = Math.max(0, (n[k] - 0.42) * 2.4);
    image.data[k * 4] = image.data[k * 4 + 1] = image.data[k * 4 + 2] = 255;
    image.data[k * 4 + 3] = Math.min(255, a * a * 255);
  }
  c.putImageData(image, 0, 0);
  return Texture.from(canvas);
}

function vignetteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const gr = c.createRadialGradient(128, 128, 60, 128, 128, 182);
  gr.addColorStop(0, '#02040a00');
  gr.addColorStop(0.55, '#02040a55');
  gr.addColorStop(1, '#02040af0');
  c.fillStyle = gr;
  c.fillRect(0, 0, 256, 256);
  return Texture.from(canvas);
}

/** Stable hash of a world cell: decal layout never depends on the run seed. */
function hash2(x: number, y: number, salt: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** What the atmosphere needs from the view: camera centre (world), zoom and screen size. */
export interface Camera {
  camera: { x: number; y: number };
  zoom: number;
  width: number;
  height: number;
}

/**
 * Moor ground, scattered decals, two drifting fog sheets and a screen vignette.
 * Everything is a handful of quads per frame: one tiling ground, visible decal chunks,
 * two tiling fog sheets and one stretched vignette.
 */
export class Atmosphere {
  readonly ground: TilingSprite;
  readonly decals = new Container();
  readonly mistLow: TilingSprite;
  readonly mistHigh: TilingSprite;
  readonly vignette: Sprite;
  private chunks: Container[] = [];
  private chunkCols = 0;
  enabled = true;
  constructor(art: Record<string, Texture>, worldWidth: number, worldHeight: number) {
    this.ground = new TilingSprite({ texture: moorTexture(512), width: 1, height: 1 });
    this.ground.tint = tint(PALETTE.moonlight);
    this.mistLow = new TilingSprite({ texture: fogTexture(512, 911), width: 1, height: 1 });
    this.mistHigh = new TilingSprite({ texture: fogTexture(512, 3301), width: 1, height: 1 });
    for (const [sheet, spec] of [
      [this.mistLow, ATMOSPHERE.mistLow],
      [this.mistHigh, ATMOSPHERE.mistHigh],
    ] as const) {
      sheet.tint = tint(PALETTE.fog);
      sheet.alpha = spec.alpha;
      sheet.tileScale.set(spec.scale);
    }
    this.vignette = new Sprite(vignetteTexture());
    this.vignette.alpha = ATMOSPHERE.vignette;
    const size = ATMOSPHERE.chunk,
      kinds = ATMOSPHERE.decals;
    this.chunkCols = Math.ceil(worldWidth / size);
    const rows = Math.ceil(worldHeight / size),
      cell = ATMOSPHERE.decalSpacing;
    for (let cy = 0; cy < rows; cy++)
      for (let cx = 0; cx < this.chunkCols; cx++) {
        const chunk = new Container();
        chunk.visible = false;
        for (let y = cy * size; y < (cy + 1) * size; y += cell)
          for (let x = cx * size; x < (cx + 1) * size; x += cell) {
            const gx = x / cell,
              gy = y / cell;
            if (hash2(gx, gy, 1) > ATMOSPHERE.decalDensity) continue;
            const kind = kinds[Math.floor(hash2(gx, gy, 2) * kinds.length)];
            const s = new Sprite(art[kind]);
            s.anchor.set(0.5);
            s.position.set(x + hash2(gx, gy, 3) * cell, y + hash2(gx, gy, 4) * cell);
            s.rotation = hash2(gx, gy, 5) * Math.PI * 2;
            s.scale.set(0.5 + hash2(gx, gy, 6) * 0.5);
            s.alpha = 0.35 + hash2(gx, gy, 7) * 0.4;
            chunk.addChild(s);
          }
        this.decals.addChild(chunk);
        this.chunks.push(chunk);
      }
  }
  /** Screen-space rain for the Witching Hours. */
  readonly rain = new TilingSprite({ texture: rainTexture(), width: 1, height: 1 });
  private tintNow = [0.77, 0.83, 1];
  private mistBoost = 1;
  private rainAlpha = 0;
  /**
   * The night's arc (GDD 8): fog thickens through Deep Night, the moon reddens the moor after
   * Midnight with rain in the Witching Hours, and False Dawn pales it toward blue-grey.
   */
  night(gameTime: number, realTime: number, dt: number, reduced: boolean) {
    const t = gameTime;
    const [target, mist, rain] =
      t < 120
        ? [[0.77, 0.83, 1], 1, 0]
        : t < 300
          ? [[0.74, 0.8, 1], 1.4, 0]
          : t < 600
            ? [[0.66, 0.72, 0.95], 1.9, 0]
            : t < 900
              ? [[0.86, 0.62, 0.7], 1.4, 0.2]
              : t < 1140
                ? [[0.8, 0.86, 1], 2.3, 0]
                : [[0.9, 0.55, 0.62], 1.6, 0];
    const k = Math.min(1, dt * 0.5);
    for (let i = 0; i < 3; i++) this.tintNow[i] += (target[i] - this.tintNow[i]) * k;
    this.mistBoost += (mist - this.mistBoost) * k;
    this.rainAlpha += ((reduced ? rain * 0.5 : rain) - this.rainAlpha) * k;
    const [r, g, b] = this.tintNow;
    this.ground.tint =
      (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    this.mistLow.alpha = ATMOSPHERE.mistLow.alpha * this.mistBoost;
    this.mistHigh.alpha = ATMOSPHERE.mistHigh.alpha * this.mistBoost;
    this.rain.visible = this.enabled && this.rainAlpha > 0.01;
    this.rain.alpha = this.rainAlpha;
    if (this.rain.visible) this.rain.tilePosition.set(realTime * -120, realTime * 900);
  }
  /** Fit world-space sheets to the camera; drift fog; cull decal chunks. */
  update(view: Camera, time: number) {
    const visible = this.enabled;
    this.ground.visible = this.decals.visible = visible;
    this.mistLow.visible = this.mistHigh.visible = this.vignette.visible = visible;
    if (!visible) return;
    const halfW = view.width / 2 / view.zoom + 64,
      halfH = view.height / 2 / view.zoom + 64,
      left = view.camera.x - halfW,
      top = view.camera.y - halfH;
    this.ground.position.set(left, top);
    this.ground.width = halfW * 2;
    this.ground.height = halfH * 2;
    this.ground.tilePosition.set(-left, -top);
    for (const [sheet, spec] of [
      [this.mistLow, ATMOSPHERE.mistLow],
      [this.mistHigh, ATMOSPHERE.mistHigh],
    ] as const) {
      sheet.position.set(left, top);
      sheet.width = halfW * 2;
      sheet.height = halfH * 2;
      sheet.tilePosition.set(
        -left - view.camera.x * (spec.parallax - 1) + time * spec.driftX,
        -top - view.camera.y * (spec.parallax - 1) + time * spec.driftY,
      );
    }
    this.vignette.width = view.width;
    this.vignette.height = view.height;
    this.rain.width = view.width;
    this.rain.height = view.height;
    const size = ATMOSPHERE.chunk;
    const x0 = Math.floor(left / size),
      x1 = Math.floor((left + halfW * 2) / size),
      y0 = Math.floor(top / size),
      y1 = Math.floor((top + halfH * 2) / size);
    for (let i = 0; i < this.chunks.length; i++) {
      const cx = i % this.chunkCols,
        cy = Math.floor(i / this.chunkCols);
      this.chunks[i].visible = cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1;
    }
  }
}

/** Rain: thin slanted silver streaks on transparent, tiled across the screen. */
function rainTexture() {
  const size = 256,
    el = document.createElement('canvas');
  el.width = el.height = size;
  const c = el.getContext('2d')!;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  c.strokeStyle = 'rgba(196,212,255,0.55)';
  c.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = rnd() * size,
      y = rnd() * size,
      l = 10 + rnd() * 16;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - l * 0.13, y + l);
    c.stroke();
  }
  return Texture.from(el);
}
