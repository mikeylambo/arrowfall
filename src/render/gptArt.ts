/**
 * Painted world art (art-source/gpt, processed by tools/art/gpt.py into public/art/gpt):
 * seamless ground tiles, a scatter-decal atlas and recoloured landmark sprites. Everything here
 * is optional: if a file is missing the procedural art stays.
 */
import { Assets, Rectangle, Texture } from 'pixi.js';

export interface GptArt {
  /** Ground tiles by name: moor, moss, mire, barrow, path, camp. */
  ground: Record<string, Texture>;
  /** Landmark sprites by name: moonwell, shrine, tower, barrow, lodge, stones, campfire, tent. */
  landmark: Record<string, Texture>;
  /** Decal frames grouped by kind (ferns, leaves, mushrooms, roots, stones, bones, puddles). */
  decals: Record<string, Texture[]>;
}

const BASE = '/art/gpt/';
const GROUND = ['moor', 'moss', 'mire', 'barrow', 'path', 'camp'];
const LANDMARKS = ['moonwell', 'shrine', 'tower', 'barrow', 'lodge', 'stones', 'campfire', 'tent'];

export async function loadGptArt(): Promise<GptArt | null> {
  try {
    const art: GptArt = { ground: {}, landmark: {}, decals: {} };
    await Promise.all([
      ...GROUND.map(async (n) => {
        const t = await Assets.load<Texture>(`${BASE}ground-${n}.webp`);
        // Tiles repeat across the world (TilingSprite and textured path strokes).
        t.source.addressMode = 'repeat';
        art.ground[n] = t;
      }),
      ...LANDMARKS.map(async (n) => {
        art.landmark[n] = await Assets.load<Texture>(`${BASE}landmark-${n}.webp`);
      }),
      (async () => {
        const manifest = (await (await fetch(`${BASE}decals.json`)).json()) as {
          frames: Record<string, [number, number, number, number]>;
        };
        const sheet = await Assets.load<Texture>(`${BASE}decals.webp`);
        for (const [name, [x, y, w, h]] of Object.entries(manifest.frames)) {
          const kind = name.replace(/-\d+$/, '');
          (art.decals[kind] ??= []).push(
            new Texture({ source: sheet.source, frame: new Rectangle(x, y, w, h) }),
          );
        }
      })(),
    ]);
    return art;
  } catch {
    return null;
  }
}

/** A soft-edged white disc for alpha masks (ground regions fading into the moor). */
let disc: Texture | null = null;
export function softDisc() {
  if (disc) return disc;
  const el = document.createElement('canvas');
  el.width = el.height = 256;
  const c = el.getContext('2d')!,
    g = c.createRadialGradient(128, 128, 40, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  return (disc = Texture.from(el));
}
