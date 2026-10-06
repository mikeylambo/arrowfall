import { Assets, Rectangle, Texture, type TextureSource } from 'pixi.js';

/** Manifest written by tools/render-sprites (one per character). */
export interface SheetManifest {
  id: string;
  cell: number;
  pivot: [number, number];
  /** Unique rendered directions; 0 = screen-right, stepping 45 degrees clockwise. */
  directions: number[];
  fps: number;
  clips: Record<
    string,
    { frames: number; loop: boolean; cells: { page: number; x: number; y: number }[][] }
  >;
  pages: number;
}

/** A loaded character sheet: textures per clip, per unique direction, per frame. */
export class Sheet {
  private readonly textures: Record<string, Texture[][]> = {};
  constructor(
    readonly manifest: SheetManifest,
    sources: TextureSource[],
  ) {
    const size = manifest.cell;
    for (const [name, clip] of Object.entries(manifest.clips))
      this.textures[name] = clip.cells.map((row) =>
        row.map(
          (c) =>
            new Texture({ source: sources[c.page], frame: new Rectangle(c.x, c.y, size, size) }),
        ),
      );
  }
  has(clip: string) {
    return clip in this.textures;
  }
  /**
   * Frame for a screen-space aim angle (radians, y down). Returns the texture and whether the
   * sprite must be mirrored (left-facing directions reuse their right-facing twins).
   */
  frame(clip: string, angle: number, time: number) {
    const set = this.textures[clip] ?? this.textures[Object.keys(this.textures)[0]];
    const meta = this.manifest.clips[clip] ?? Object.values(this.manifest.clips)[0];
    let dir = Math.round(angle / (Math.PI / 4)) % 8;
    if (dir < 0) dir += 8;
    const mirror = dir >= 3 && dir <= 5;
    const source = mirror ? (dir === 3 ? 1 : dir === 4 ? 0 : 7) : dir;
    const row = Math.max(0, this.manifest.directions.indexOf(source));
    const n = meta.frames,
      f = Math.floor(time * this.manifest.fps);
    const index = meta.loop ? f % n : Math.min(n - 1, f);
    return { texture: set[row][index], mirror };
  }
}

/** Load a sheet rendered into public/art/sprites/, or null when it is not there. */
export async function loadSheet(id: string): Promise<Sheet | null> {
  try {
    const response = await fetch(`/art/sprites/${id}.json`);
    if (!response.ok) return null;
    const manifest = (await response.json()) as SheetManifest;
    const pages = await Promise.all(
      Array.from({ length: manifest.pages }, (_, i) =>
        Assets.load<Texture>(`/art/sprites/${id}-${i}.png`),
      ),
    );
    return new Sheet(
      manifest,
      pages.map((p) => p.source),
    );
  } catch {
    return null;
  }
}
