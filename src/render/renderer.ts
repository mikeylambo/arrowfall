import {
  Application,
  Container,
  Sprite,
  Graphics,
  Texture,
  Assets,
  BitmapFont,
  BitmapText,
  ColorMatrixFilter,
} from 'pixi.js';
import { Vfx } from './vfx';
import { Diegetic } from './diegetic';
import { loadSheet, type Sheet } from './sheets';
import { Atmosphere } from './ground';
import { landmarkArt, WorldDressing } from './landmarks';
import { buildCamp, campArt, CAMPFIRE } from './camp';
import { Arena } from './arena';
import { loadGptArt, type GptArt } from './gptArt';

import { UNIT } from './silhouettes';
import { BOSSES } from '../data/bosses';
import { T } from '../data/tuning';
import { ART_PATHS } from '../data/artPaths';
import { bakeArt, BOSS_HALF } from './art';
import type { Hunt } from '../sim/game';
import { COVER } from '../sim/world';
import type { Enemy } from '../sim/types';
import { ENEMIES } from '../data/enemies';
import { STATIONS } from '../data/world';
import { PALETTE, JUICE, SHEETS, tint } from '../data/art';

/**
 * How far an enemy is through its attack wind-up (0..1), or null when it isn't winding up.
 * Poachers draw for their telegraph time, Changelings pounce after 0.6 s, melee enemies
 * slam after their 0.6 s ring.
 */
function attackProgress(e: Enemy, telegraph: number): number | null {
  if (e.kind === 3) return e.state === 1 ? 1 - Math.max(0, e.clock) / telegraph : null;
  if (e.kind === 7) return e.state === 1 ? 1 - Math.max(0, e.clock) / 0.6 : null;
  // Barrow Worm: rears up through its 0.8 s red ring, stays up while it strikes.
  if (e.kind === 6)
    return e.state === 1 ? 1 - Math.max(0, e.clock) / 0.8 : e.state === 2 ? 1 : null;
  // Moonhound crouches through its telegraph and holds the spring through the lunge; the Hollow
  // Stag rears through its 0.9 s telegraph and keeps its antlers down for the charge.
  if (e.kind === 1 || e.kind === 4)
    return e.state === 1
      ? 1 - Math.max(0, e.clock) / (e.kind === 4 ? 0.9 : telegraph)
      : e.state === 2
        ? 1
        : null;
  return e.state === 3 ? 1 - Math.max(0, e.clock) / 0.6 : null;
}
/**
 * Damage numbers as bitmap fonts (cheap at hundreds of hits a second): ordinary hits are small
 * and quiet; crits are big, bright and outlined.
 */
BitmapFont.install({
  name: 'HitNumbers',
  style: {
    fontFamily: 'Georgia',
    fontSize: 16,
    fill: 0xb7c5da,
    stroke: { color: 0x060a16, width: 3 },
  },
  chars: [['0', '9']],
});
BitmapFont.install({
  name: 'DeadeyeNumbers',
  style: {
    fontFamily: 'Georgia',
    fontSize: 34,
    fontWeight: '700',
    fill: 0xf1e8ff,
    stroke: { color: 0x2a1450, width: 6 },
    dropShadow: { color: 0x9b6bff, blur: 10, distance: 0, alpha: 1 },
  },
  chars: [['0', '9'], '!'],
});
BitmapFont.install({
  name: 'CritNumbers',
  style: {
    fontFamily: 'Georgia',
    fontSize: 26,
    fontWeight: '700',
    fill: 0xffffff,
    stroke: { color: 0x1b2233, width: 5 },
    dropShadow: { color: 0xc4d4ff, blur: 6, distance: 0, alpha: 0.9 },
  },
  chars: [['0', '9'], '!'],
});
const HUNTER_SCALE = 0.4,
  /** Enemy death collapse (s). */
  CORPSE_TIME = 0.45,
  /** Moonraven dive length (s): out to the target and back. */
  RAVEN_DIVE = 0.36;
/** Palette as Pixi tints. */
const C = {
  silver: tint(PALETTE.silver),
  focus: tint(PALETTE.focus),
  focusLight: tint(PALETTE.focusLight),
  threat: tint(PALETTE.threat.telegraph),
  threatBase: tint(PALETTE.threat.base),
  elite: tint(PALETTE.elite.rim),
  colorblind: tint(PALETTE.colorblindThreat),
  heal: tint(PALETTE.heal),
  phantom: 0x9fc4ff,
};
export class View {
  readonly app = new Application();
  readonly root = new Container();
  atmosphere!: Atmosphere;
  vfx!: Vfx;
  diegetic!: Diegetic;
  trailSprites: Sprite[] = [];
  markGlows: Sprite[] = [];
  readonly deadeyeFilter = new ColorMatrixFilter();
  /** Accessibility: no shake, no scale pulses, no fog drift, dimmed flashes. */
  reducedMotion = false;
  /** The boss arena ring and its markers. */
  readonly arena = new Arena();
  /** The camp's campfire flame (flickered each frame), when the camp is shown. */
  private campFlame: Sprite | null = null;
  private campFire = 1;
  /** Performance mode: native resolution 1, fewer lights, no high mist, half the particles. */
  lowPower = false;
  setLowPower(on: boolean) {
    this.lowPower = on;
    if (this.app.renderer) this.app.renderer.resolution = on ? 1 : Math.min(devicePixelRatio, 2);
  }
  readonly cover = new Container();
  readonly effects = new Container();
  readonly actors = new Container();
  readonly arrows = new Container();
  readonly threatLayer = new Container();
  /** The hunter draws above every threat so it is never lost in a crowd. */
  readonly hero = new Container();
  readonly cutout = new Sprite();
  readonly overlay = new Graphics();
  readonly worldLines = new Graphics();
  /** Static world marks (landmarks), tessellated once per attach. */
  readonly landmarks = new Graphics();
  readonly threatGraphics = new Graphics();
  numbers = false;
  ravenDive = { t: 0, x: 0, y: 0, hit: false };
  deathTime = 0;
  corpses: { sprite: Sprite; life: number; tip: number; sx: number; sy: number; y: number }[] = [];
  corpseCursor = 0;
  recoil = 0;
  facing = 0;
  heldFacing = 0;
  numberSlots: { text: BitmapText; life: number; kind: number }[] = [];
  art: Record<string, Texture> = {};
  enemySprites: Sprite[] = [];
  arrowSprites: Sprite[] = [];
  pickupSprites: Sprite[] = [];
  particleSprites: Sprite[] = [];
  coverSprites: Sprite[] = [];
  /** Tall forest props (trees) draw above actors and fade when the hunter is behind them. */
  readonly canopy = new Container();
  private canopySprites: Sprite[] = [];
  /** Rendered forest prop sheets (art-source/kaykit, CC0); ?forest=classic keeps the baked art. */
  private propSheets: Record<string, Sheet | null> = {};
  /** Painted world art (GPT batches); ?ground=classic keeps the procedural ground and landmarks. */
  private painted: GptArt | null = null;
  hunter = new Sprite();
  /** 3/4 sprite sheet for the hunter, when one is rendered (dev preview: ?sprites=<sheet id>). */
  hunterSheet: Sheet | null = null;
  /** Enemy sheets by sheet id (normal and '-elite'). */
  enemySheets: Record<string, Sheet> = {};
  bossSheets: Record<string, Sheet> = {};
  readonly footShadow = new Sprite();
  weakPoint = new Sprite();
  raven = new Sprite();
  ghostSprites: Sprite[] = [];
  world!: WorldDressing;
  /** Additive light on the ground: the hunter's moonlight, glowing arrows, lantern, well, shrine. */
  readonly lights = new Container();
  private lightSprites: Sprite[] = [];
  camera = { x: 7500, y: 4250 };
  zoom = 1;
  width = 1400;
  height = 850;
  camp = false;
  aimScreen = { x: 900, y: 430 };
  shake = 1;
  colorblind = false;
  showBands = true;
  fps = 60;
  last = 0;
  frames: number[] = [];
  /** Smoothed per-frame CPU cost (ms): simulation, scene build, and GPU submit. */
  timing = { sim: 0, scene: 0, submit: 0, atmosphere: 0 };
  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      resizeTo: window,
      background: PALETTE.background,
      antialias: false,
      resolution: this.lowPower ? 1 : Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    this.art = { ...bakeArt(), ...landmarkArt(), ...campArt() };
    this.world = new WorldDressing(this.art);
    for (const [id, path] of Object.entries(ART_PATHS))
      this.art[id] = await Assets.load<Texture>(path);
    this.atmosphere = new Atmosphere(this.art, T.worldWidth, T.worldHeight);
    this.app.stage.addChild(this.root);
    this.root.addChild(
      this.atmosphere.ground,
      this.atmosphere.decals,
      this.world.ground,
      this.lights,
      this.atmosphere.mistLow,
      this.cover,
      this.landmarks,
      this.arena.layer,
      this.worldLines,
      this.effects,
      this.arrows,
      this.actors,
      this.threatLayer,
    );
    this.threatLayer.addChild(this.threatGraphics);
    this.weakPoint.texture = this.art.ring;
    this.weakPoint.anchor.set(0.5);
    this.weakPoint.tint = tint(PALETTE.weak);
    this.weakPoint.visible = false;
    this.threatLayer.addChild(this.weakPoint);
    this.root.addChild(this.hero, this.canopy, this.world.plates, this.atmosphere.mistHigh);
    this.app.stage.addChild(this.atmosphere.rain, this.atmosphere.vignette, this.overlay);
    this.hunter.texture = this.art.hunter;
    this.hunter.anchor.set(0.5);
    this.hunter.scale.set(0.7);
    this.diegetic = new Diegetic(this.art);
    this.cutout.texture = this.art.bloom;
    this.cutout.anchor.set(0.5);
    this.cutout.tint = tint(PALETTE.background);
    this.cutout.alpha = 0.75;
    this.footShadow.texture = this.art.bloom;
    this.footShadow.anchor.set(0.5);
    this.footShadow.tint = tint(PALETTE.background);
    this.footShadow.visible = false;
    this.hero.addChild(
      this.cutout,
      this.footShadow,
      this.diegetic.under,
      this.hunter,
      this.diegetic.over,
    );
    // ?sprites=off shows the baked stand-in; ?sprites=<id> previews another sheet.
    const override = new URLSearchParams(location.search).get('sprites');
    if (override !== 'off') this.hunterSheet = await loadSheet(override ?? SHEETS.hunter);
    this.diegetic.sheetBow = !!this.hunterSheet;
    if (new URLSearchParams(location.search).get('ground') !== 'classic') {
      this.painted = await loadGptArt();
      if (this.painted) {
        this.atmosphere.usePainted(this.painted);
        this.world.painted = this.painted;
      }
    }
    if (new URLSearchParams(location.search).get('forest') !== 'classic')
      for (const id of ['props-trees', 'props-rocks']) this.propSheets[id] = await loadSheet(id);
    // Enemy and boss sheets (most of the ~19 MB) stream in behind the menu; each character
    // shows its baked stand-in until its own sheet arrives.
    if (override !== 'off') {
      for (const id of Object.values(SHEETS.enemies))
        for (const sheetId of [id, id + '-elite'])
          void loadSheet(sheetId).then((sheet) => {
            if (sheet) this.enemySheets[sheetId] = sheet;
          });
      for (const [boss, id] of Object.entries(SHEETS.bosses))
        void loadSheet(id).then((sheet) => {
          if (sheet) this.bossSheets[boss] = sheet;
        });
    }
    this.raven.texture = this.art.raven;
    this.raven.anchor.set(0.5);
    this.raven.scale.set(0.45);
    this.effects.addChild(this.raven);
    for (let i = 0; i < 3; i++) {
      const s = this.sprite(this.art.hunter, this.actors);
      s.tint = C.phantom;
      s.alpha = 0.25;
      s.scale.set(0.7);
      this.ghostSprites.push(s);
    }
    // Corpses draw beneath the living.
    this.corpses = this.pool(60, this.art.husk, this.threatLayer).map((sprite) => ({
      sprite,
      life: 0,
      tip: 1,
      sx: 1,
      sy: 1,
      y: 0,
    }));
    this.enemySprites = this.pool(500, this.art.husk, this.threatLayer);
    // The boss weak point draws over the bodies (a sheet boss wears it on its head).
    this.threatLayer.addChild(this.weakPoint);
    this.trailSprites = this.pool(1400, this.art.trail, this.arrows);
    for (const t of this.trailSprites) t.anchor.set(1, 0.5);
    this.arrowSprites = this.pool(1400, this.art.arrow, this.arrows);
    this.markGlows = this.pool(40, this.art.bloom, this.effects);
    for (const m of this.markGlows) m.tint = C.focus;
    this.vfx = new Vfx(this.art);
    this.root.addChildAt(this.vfx.layer, this.root.getChildIndex(this.threatLayer));
    this.deadeyeFilter.saturate(-JUICE.deadeyeDesaturate);
    this.root.filterArea = this.app.screen;
    this.pickupSprites = this.pool(1600, this.art.xp, this.effects);
    this.particleSprites = this.pool(2000, this.art.particle, this.effects);
    this.threatLayer.addChild(this.threatGraphics);
    for (let i = 0; i < 170; i++) {
      // Slots by kind: 0 plain hits, 1 crits, 2 Deadeye strikes.
      const kind = i < 20 ? 2 : i < 50 ? 1 : 0,
        font = ['HitNumbers', 'CritNumbers', 'DeadeyeNumbers'][kind],
        text = new BitmapText({
          text: '',
          style: { fontFamily: font, fontSize: [16, 26, 34][kind] },
        });
      text.anchor.set(0.5);
      text.visible = false;
      this.threatLayer.addChild(text);
      this.numberSlots.push({ text, life: 0, kind });
    }
  }
  sprite(texture: Texture, parent: Container) {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.visible = false;
    parent.addChild(s);
    return s;
  }
  pool(n: number, t: Texture, p: Container) {
    return Array.from({ length: n }, () => this.sprite(t, p));
  }
  attach(g: Hunt, camp = false) {
    this.camp = camp;
    this.atmosphere.bloodMoon = !camp && g.phase === 3;
    this.atmosphere.setGround(camp ? 'camp' : 'moor');
    this.arena.clear();
    this.camera.x = g.player.x;
    this.camera.y = g.player.y;
    this.cover.removeChildren().forEach((c) => c.destroy());
    this.coverSprites = [];
    // Cover art by kind (sim/world.ts COVER); scaled so the art sits on the collision circle.
    const COVER_ART: [string, number][] = [
      ['tree', 22],
      ['menhir', 27],
      ['mound', 64],
      ['dead', 26],
      ['wall', 22],
      ['tower', 56],
      ['shrine', 30],
      ['well', 34],
    ];
    this.canopy.removeChildren().forEach((c) => c.destroy());
    this.canopySprites = [];
    const trees = this.propSheets['props-trees'],
      rocks = this.propSheets['props-rocks'],
      shadows = new Graphics();
    this.cover.addChild(shadows);
    for (const o of g.world.obstacles) {
      // The camp clearing keeps only its own props (camp movement ignores cover anyway).
      if (camp && o.x < 1300 && o.y < 1000) continue;
      // Forest props: living trees (one in five a boulder) and dead trees from rendered sheets.
      const hash = Math.abs(Math.floor(o.x * 7 + o.y * 13)),
        flip = hash & 1 ? -1 : 1;
      // Painted forest (GPT batch 6): pine and oak stands in broad patches, boulders and stumps
      // among them, stumps and fallen logs in the Dead Grove, standing stones in the circle.
      const forest = this.painted?.forest;
      if (
        forest?.pines &&
        (o.kind === COVER.tree || o.kind === COVER.dead || o.kind === COVER.stone)
      ) {
        const nearLandmark = g.world.landmarks.some((l) => Math.hypot(o.x - l.x, o.y - l.y) < 300),
          roll = hash % 10;
        let kind: string, size: number, tall: boolean;
        if (o.kind === COVER.stone) {
          // Rocks 1 and 5 are the tall standing stones; the rest are boulders and slabs.
          kind = 'rocks';
          tall = nearLandmark;
          size = tall ? 3.4 : 2.7;
        } else if (o.kind === COVER.dead) {
          [kind, size, tall] = roll < 3 ? ['stumps', 2.9, false] : ['dead', 6.6, true];
        } else if (roll < 2) [kind, size, tall] = ['rocks', 2.7, false];
        else if (roll === 2) [kind, size, tall] = ['stumps', 2.9, false];
        else {
          const pinewood = Math.sin(o.x * 0.0009 + Math.cos(o.y * 0.0011) * 2) > -0.15;
          [kind, size, tall] = pinewood ? ['pines', 8.6, true] : ['oaks', 7.4, true];
        }
        const set = forest[kind],
          pick =
            kind === 'rocks'
              ? tall
                ? [1, 5][hash % 2]
                : [0, 2, 3, 4, 6, 7, 8][hash % 7]
              : Math.floor(hash / 10) % set.length,
          { texture, foot } = set[Math.min(pick, set.length - 1)],
          // Trees are sized by height (a pine stands about three hunters tall), low props by width.
          k =
            tall && kind !== 'rocks' ? (o.r * size) / texture.height : (o.r * size) / texture.width,
          s = new Sprite(texture);
        s.anchor.set(0.5, foot);
        s.position.set(o.x, o.y + o.r * 0.45);
        s.scale.set(k * flip, k);
        shadows.ellipse(o.x + 6, o.y + o.r * 0.45, o.r * (tall ? 1.1 : 1.35), o.r * 0.42);
        (tall ? this.canopy : this.cover).addChild(s);
        if (tall) this.canopySprites.push(s);
        this.coverSprites.push(s);
        continue;
      }
      if (trees && rocks && (o.kind === 0 || o.kind === 3)) {
        const rock = o.kind === 0 && hash % 5 === 0,
          name = rock
            ? ['rock_b', 'rock_c', 'rock_d', 'rock_e'][hash % 4]
            : o.kind === 3
              ? ['dead_large', 'dead_medium', 'dead_small'][hash % 3]
              : ['pine_large', 'pine_medium', 'oak_a', 'oak_b'][hash % 4],
          sheet = rock ? rocks : trees,
          s = new Sprite(sheet.frame(name, Math.PI / 2, 0).texture),
          k = rock ? 0.5 * (o.r / 22) : o.kind === 3 ? 0.62 * (o.r / 26) : 0.66 * (o.r / 22);
        s.anchor.set(sheet.manifest.pivot[0], sheet.manifest.pivot[1]);
        s.position.set(o.x, o.y + o.r * 0.45);
        s.scale.set(k * flip, k);
        // A soft contact shadow grounds each prop (one shared Graphics, below the cover).
        shadows.ellipse(o.x + 6, o.y + o.r * 0.45, o.r * (rock ? 1.3 : 1.1), o.r * 0.4);
        (rock ? this.cover : this.canopy).addChild(s);
        if (!rock) this.canopySprites.push(s);
        this.coverSprites.push(s);
        continue;
      }
      // Painted landmarks: the Moonwell, the Shrine, the Watchtower and the Barrow mounds.
      const lm = this.painted?.landmark,
        paint: [Texture | undefined, number, number, boolean] | null = !lm
          ? null
          : o.kind === COVER.well
            ? [lm.moonwell, 300, 0.62, false]
            : o.kind === COVER.shrine
              ? [lm.shrine, 190, 0.86, true]
              : o.kind === COVER.tower
                ? [lm.tower, 250, 0.84, true]
                : o.kind === COVER.mound
                  ? [lm.barrow, 300, 0.7, false]
                  : null;
      if (paint?.[0]) {
        const [texture, width, foot, tall] = paint,
          s = new Sprite(texture),
          k = width / texture.width;
        s.anchor.set(0.5, foot);
        s.position.set(o.x, o.y + o.r * 0.3);
        s.scale.set(o.kind === COVER.mound && hash & 1 ? -k : k, k);
        shadows.ellipse(o.x + 8, o.y + o.r * 0.35, width * 0.42, width * 0.14);
        (tall ? this.canopy : this.cover).addChild(s);
        if (tall) this.canopySprites.push(s);
        this.coverSprites.push(s);
        continue;
      }
      const [tex, base] = COVER_ART[o.kind] ?? COVER_ART[0];
      const s = this.sprite(this.art[tex], this.cover);
      s.position.set(o.x, o.y);
      s.scale.set(o.r / base);
      if (o.kind === 3 || o.kind === 4) s.rotation = ((o.x * 13 + o.y * 7) % 628) / 100;
      this.coverSprites.push(s);
    }
    shadows.fill({ color: 0x02040a, alpha: 0.45 });
    this.campFlame = null;
    if (camp) {
      this.world.clear();
      const camp = buildCamp(
        this.cover,
        this.art,
        g.profile,
        this.painted
          ? {
              tent: this.painted.landmark.tent,
              fire: this.painted.landmark.campfire,
              stations: this.painted.camp,
            }
          : undefined,
      );
      this.campFlame = camp.flame;
      this.campFire = camp.size;
    } else this.world.build(g);
    // The Hollow's edge: a dense treeline over a dark band, so the world boundary reads as
    // forest you cannot enter instead of an invisible wall.
    if (!camp) {
      const edge = new Graphics(),
        W = T.worldWidth,
        H = T.worldHeight,
        band = 900;
      edge
        .rect(-band, -band, W + band * 2, band)
        .rect(-band, H, W + band * 2, band)
        .rect(-band, 0, band, H)
        .rect(W, 0, band, H)
        .fill({ color: tint(PALETTE.background), alpha: 0.92 });
      this.cover.addChild(edge);
      const jitter = (i: number) => {
        const v = Math.sin(i * 127.1 + 311.7) * 43758.5453;
        return v - Math.floor(v);
      };
      let i = 0;
      const edgeSprites: Sprite[] = [],
        edgeTrees = this.painted?.forest.pines
          ? [...this.painted.forest.pines, ...(this.painted.forest.oaks ?? [])]
          : null;
      const tree = (x: number, y: number, scale: number) => {
        const px = x + (jitter(i++) - 0.5) * 50,
          py = y + (jitter(i++) - 0.5) * 50,
          size = 0.85 + jitter(i++) * 0.35,
          turn = jitter(i++);
        if (edgeTrees) {
          // Painted pines and oaks, upright, about one and a half times a moor tree.
          const { texture, foot } = edgeTrees[Math.floor(turn * edgeTrees.length)],
            k = (scale * size * 105) / texture.height,
            s = new Sprite(texture);
          s.anchor.set(0.5, foot);
          s.position.set(px, py + 40);
          s.scale.set(turn > 0.5 ? -k : k, k);
          edgeSprites.push(s);
          this.coverSprites.push(s);
          return;
        }
        const s = this.sprite(this.art.tree, this.cover);
        s.position.set(px, py);
        s.scale.set(scale * size);
        s.rotation = turn * Math.PI * 2;
        this.coverSprites.push(s);
      };
      for (let row = 0; row < 2; row++) {
        const out = 30 + row * 120,
          scale = 2.6 + row * 0.6;
        for (let x = -out; x <= W + out; x += 140) {
          tree(x, -out, scale);
          tree(x, H + out, scale);
        }
        for (let y = 140 - out; y <= H + out - 140; y += 140) {
          tree(-out, y, scale);
          tree(W + out, y, scale);
        }
      }
      // Painted trees overlap, so draw them back to front.
      for (const t of edgeSprites.sort((a, b) => a.y - b.y)) this.cover.addChild(t);
    }
    // Painted canopies overlap: back to front.
    for (const c of this.canopy.children) c.zIndex = c.y;
    this.canopy.sortChildren();
    this.landmarks.clear();
  }
  /**
   * Elite modifiers read at a glance (GDD 9), each with its own mark at the feet:
   * Frenzied speed streaks, Armored plate ring, Regenerating mending pulse, Vampiric orbiting
   * blood, Explosive warning rings that quicken as it weakens, Moonwarded silver ward that
   * cracks as it takes damage.
   */
  eliteMark(tg: Graphics, e: Enemy, t: number) {
    const r = e.r + 9,
      x = e.x,
      y = e.y;
    switch (e.elite) {
      case 0:
        for (let i = -1; i <= 1; i++) {
          const a = e.angle + Math.PI + i * 0.35,
            k = (t * 4 + i * 0.3) % 1;
          tg.moveTo(x + Math.cos(a) * (r + k * 10), y + Math.sin(a) * (r + k * 10))
            .lineTo(x + Math.cos(a) * (r + 18 + k * 10), y + Math.sin(a) * (r + 18 + k * 10))
            .stroke({ color: C.threat, width: 2, alpha: 0.8 * (1 - k) });
        }
        break;
      case 1: {
        const pts: number[] = [];
        for (let i = 0; i < 6; i++)
          pts.push(x + Math.cos((i * Math.PI) / 3) * r, y + Math.sin((i * Math.PI) / 3) * r);
        tg.poly(pts)
          .stroke({ color: 0x8a2a32, width: 4, alpha: 0.9 })
          .stroke({ color: C.elite, width: 1.5, alpha: 0.8 });
        break;
      }
      case 2: {
        const mending = t - e.lastHit > 2 && e.hp < e.maxHp,
          k = (t * (mending ? 1.6 : 0.6)) % 1;
        tg.circle(x, y, r - 4 + k * 10).stroke({
          color: C.elite,
          width: 2,
          alpha: (mending ? 0.9 : 0.35) * (1 - k),
        });
        break;
      }
      case 3:
        for (let i = 0; i < 3; i++) {
          const a = t * 2.2 + (i * Math.PI * 2) / 3;
          tg.circle(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 3.2).fill({
            color: C.threat,
            alpha: 0.95,
          });
        }
        break;
      case 4: {
        const rate = 1.2 + 4 * (1 - e.hp / e.maxHp),
          k = (t * rate) % 1;
        tg.circle(x, y, r).stroke({ color: C.threat, width: 2, alpha: 0.8 });
        tg.circle(x, y, r + k * 14).stroke({ color: C.threat, width: 1.5, alpha: 0.7 * (1 - k) });
        break;
      }
      case 5: {
        // Moonward: silver arcs; a segment breaks away for every sixth of health lost.
        const intact = Math.ceil((e.hp / e.maxHp) * 6);
        for (let i = 0; i < 6; i++)
          if (i < intact) {
            const a = (i * Math.PI) / 3 + t * 0.4;
            tg.arc(x, y, r, a + 0.08, a + Math.PI / 3 - 0.08).stroke({
              color: C.silver,
              width: 2.2,
              alpha: 0.85,
            });
          }
        break;
      }
    }
  }
  /**
   * Enemy deaths: the body that was standing there tips over, darkens, sinks and fades
   * (presentation only; the sim has already removed the enemy).
   */
  updateCorpses(g: Hunt, dt: number) {
    for (const ev of g.events) {
      if (!ev.id.startsWith('enemy.kill.')) continue;
      let best = -1,
        bestD = 30;
      for (let i = 0; i < this.enemySprites.length; i++) {
        const s = this.enemySprites[i];
        if (!s.visible || g.enemies.items[i].active) continue;
        const d = Math.abs(s.x - ev.x) + Math.abs(s.y - ev.y);
        if (d < bestD) {
          best = i;
          bestD = d;
        }
      }
      if (best < 0) continue;
      const from = this.enemySprites[best],
        c = this.corpses[this.corpseCursor++ % this.corpses.length];
      c.sprite.texture = from.texture;
      c.sprite.anchor.copyFrom(from.anchor);
      c.sprite.position.copyFrom(from.position);
      c.sprite.rotation = from.rotation;
      c.sx = from.scale.x;
      c.sy = from.scale.y;
      c.y = from.y;
      c.tip = from.scale.x < 0 ? -1 : 1;
      c.life = CORPSE_TIME;
      c.sprite.visible = true;
      from.visible = false;
    }
    for (const c of this.corpses) {
      if (c.life <= 0) continue;
      c.life -= dt;
      if (c.life <= 0) {
        c.sprite.visible = false;
        continue;
      }
      const t = 1 - c.life / CORPSE_TIME,
        ease = 1 - (1 - t) * (1 - t);
      c.sprite.scale.set(c.sx * (1 + 0.1 * ease), c.sy * (1 - 0.55 * ease));
      c.sprite.rotation = this.reducedMotion ? 0 : c.tip * 0.5 * ease;
      c.sprite.y = c.y + 6 * ease;
      c.sprite.tint = t < 0.15 ? 0xffffff : 0x5a1018;
      c.sprite.alpha = 1 - t * t;
    }
  }
  /** Place this frame's lights (pooled additive blooms; budgeted so crowds stay cheap). */
  updateLights(g: Hunt) {
    if (!this.lightSprites.length)
      for (let i = 0; i < 56; i++) {
        const l = new Sprite(this.art.bloom);
        l.anchor.set(0.5);
        l.blendMode = 'add';
        l.visible = false;
        this.lights.addChild(l);
        this.lightSprites.push(l);
      }
    let n = 0;
    const budget = this.lowPower ? 10 : this.lightSprites.length;
    const put = (x: number, y: number, scale: number, color: number, alpha: number) => {
      if (n >= budget) return;
      const l = this.lightSprites[n++];
      l.visible = true;
      l.position.set(x, y);
      l.scale.set(scale);
      l.tint = color;
      l.alpha = alpha;
    };
    const p = g.player;
    if (this.camp) {
      const flicker = this.reducedMotion
        ? 1
        : 0.85 + 0.1 * Math.sin(g.realTime * 9) + 0.05 * Math.sin(g.realTime * 23);
      const fx = this.campFlame?.x ?? CAMPFIRE.x,
        fy = (this.campFlame?.y ?? CAMPFIRE.y) - 14;
      put(fx, fy, 5.2 * flicker, 0xffa060, 0.22 * flicker);
      put(fx, fy, 2.2, 0xffd9a0, 0.25);
      put(p.x, p.y, 2.2, C.silver, 0.1);
    }
    if (!this.camp) {
      put(p.x, p.y, 2.6, g.phase === 3 ? 0xff8a90 : C.silver, 0.13);
      const lantern = g.rank('lantern');
      if (lantern) put(p.x, p.y, (140 + 20 * (lantern - 1)) / 45, 0xdceeff, 0.12);
      const L = g.world.landmarks,
        pulse = 0.85 + 0.15 * Math.sin(g.realTime * 1.7);
      put(L[0].x, L[0].y - 170, 3.2, 0xc4d4ff, 0.3 * pulse);
      put(L[7].x, L[7].y - 40, 2.4, 0xc4d4ff, 0.2 * pulse);
      for (const a of g.arrows.items) {
        if (n >= budget) break;
        if (a.active && (a.perfect || a.source === 'deadeye'))
          put(a.x, a.y, 1.1, C.focus, a.source === 'deadeye' ? 0.45 : 0.3);
      }
    }
    for (let i = n; i < this.lightSprites.length; i++) this.lightSprites[i].visible = false;
  }
  screenToWorld(x: number, y: number) {
    return {
      x: (x - this.width / 2) / this.zoom + this.camera.x,
      y: (y - this.height / 2) / this.zoom + this.camera.y,
    };
  }
  render(g: Hunt, realDt: number) {
    const sceneStart = performance.now();
    this.width = innerWidth;
    this.height = innerHeight;
    const p = g.player;
    // Boss cinematics frame the boss (pushed in on arrival), otherwise the camera leads the aim.
    const fallen = g.outcome === 'The Hunter Falls';
    this.deathTime = fallen ? this.deathTime + realDt : 0;
    const cine = g.cinematic > 0 || fallen,
      // A boss intro opens wide on the arena forming (render/arena.ts), then pushes in.
      arenaShot =
        !fallen &&
        g.cinematic > 0 &&
        g.cinematicKind === 'intro' &&
        T.bossIntro - g.cinematic < T.bossArenaShot,
      targetZoom = fallen
        ? 1.3
        : arenaShot
          ? Math.min(this.width, this.height) / 2 / 1250
          : cine
            ? g.cinematicKind === 'intro'
              ? 1.2
              : 1.08
            : g.boss || g.deadeye > 0
              ? 0.9
              : 1;
    this.zoom += (targetZoom - this.zoom) * Math.min(1, realDt * (cine ? 2.5 : 4));
    const look = this.camp ? 0 : Math.min(this.width * 0.18, 120);
    const targetX = fallen
        ? p.x
        : arenaShot
          ? g.eventX
          : cine
            ? p.x + (g.cinematicX - p.x) * 0.8
            : p.x + Math.cos(p.aim) * look,
      targetY = fallen
        ? p.y - 30
        : arenaShot
          ? g.eventY
          : cine
            ? p.y + (g.cinematicY - 70 - p.y) * 0.8
            : p.y + Math.sin(p.aim) * look,
      follow = Math.min(1, realDt * (cine ? 3 : 8));
    this.camera.x += (targetX - this.camera.x) * follow;
    this.camera.y += (targetY - this.camera.y) * follow;
    const shake = this.reducedMotion ? 0 : Math.min(g.shake, T.maxShake) * this.shake,
      sx = Math.sin(g.realTime * 89) * shake,
      sy = Math.cos(g.realTime * 113) * shake;
    this.root.scale.set(this.zoom);
    this.root.position.set(
      this.width / 2 - this.camera.x * this.zoom + sx,
      this.height / 2 - this.camera.y * this.zoom + sy,
    );
    if (!this.camp) this.world.update(g);
    const atmosphereStart = performance.now();
    this.atmosphere.update(this, this.reducedMotion ? 0 : g.realTime);
    this.atmosphere.night(this.camp ? 0 : g.time, g.realTime, realDt, this.reducedMotion);
    this.updateLights(g);
    this.arena.update(g, realDt, this.reducedMotion);
    if (this.campFlame && !this.reducedMotion) {
      const t = g.realTime;
      this.campFlame.scale.set(
        this.campFire * (0.9 + 0.08 * Math.sin(t * 11)),
        this.campFire * (0.85 + 0.15 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 19)),
      );
      this.campFlame.skew.x = 0.08 * Math.sin(t * 3.1);
    }
    if (this.lowPower) this.atmosphere.mistHigh.visible = false;
    this.timing.atmosphere += (performance.now() - atmosphereStart - this.timing.atmosphere) * 0.1;
    for (let i = 0; i < this.coverSprites.length; i++) {
      const s = this.coverSprites[i];
      s.visible =
        Math.abs(s.x - this.camera.x) < this.width / 2 / this.zoom + 150 &&
        Math.abs(s.y - this.camera.y) < this.height / 2 / this.zoom + 150;
    }
    // Trees the hunter stands behind turn see-through, so the hunter is never lost.
    for (const s of this.canopySprites) {
      if (!s.visible) continue;
      const w = Math.abs(s.width) * 0.38,
        behind = Math.abs(p.x - s.x) < w && p.y < s.y && p.y > s.y - s.height * 0.95;
      s.alpha += ((behind ? 0.35 : 1) - s.alpha) * Math.min(1, realDt * 10);
    }
    const dim = g.crowd > 150 ? 0.7 : 1;
    this.updateCorpses(g, realDt);
    for (let i = 0; i < g.enemies.items.length; i++) {
      const e = g.enemies.items[i],
        s = this.enemySprites[i];
      s.visible = e.active;
      if (!e.active) continue;
      s.position.set(e.x, e.y);
      const bossSheet = e.boss >= 0 ? this.bossSheets[BOSSES[e.boss].id] : undefined;
      if (bossSheet) {
        // Boss on a 3/4 sheet: its draw follows the telegraph, sized to the boss art height.
        // The Shuck crouches through its 0.7 s lunge telegraph and holds the spring while charging.
        const art = BOSSES[e.boss].art,
          windup =
            e.boss === 3 && e.state === 1
              ? 1 - Math.max(0, e.clock) / (e.phase === 1 ? 0.8 : 1.2)
              : e.boss === 0 && e.state > 0
                ? e.state === 1
                  ? 1 - Math.max(0, e.clock) / 0.7
                  : 1
                : // The Bramble King rears and slams through its 1 s volley telegraph; the Hag
                  // lifts and flings as each 3 s ring of bolts leaves her.
                  e.boss === 1 && e.clock > 2
                  ? 3 - e.clock
                  : e.boss === 2 && e.clock > 2.4
                    ? (3 - e.clock) / 0.6
                    : null,
          // The Bramble King never turns: it always faces the camera.
          facing = e.boss === 1 ? Math.PI / 2 : e.boss === 0 && e.state > 0 ? e.tx : e.angle,
          frame =
            windup !== null && bossSheet.has('attack')
              ? bossSheet.frame('attack', facing, 0, windup)
              : bossSheet.frame('move', facing, g.realTime),
          k = art.size / (bossSheet.manifest.heightPx ?? art.size);
        s.texture = frame.texture;
        s.anchor.set(bossSheet.manifest.pivot[0], bossSheet.manifest.pivot[1]);
        s.rotation = 0;
        s.scale.set(frame.mirror ? -k : k, k);
      } else if (e.boss >= 0) {
        const art = BOSSES[e.boss].art;
        s.texture = this.art['boss.' + BOSSES[e.boss].id];
        s.anchor.set(0.5);
        s.rotation = art.faces ? e.angle : 0;
        s.scale.set(art.size / (BOSS_HALF * 2));
      } else {
        const def = ENEMIES[e.kind],
          sheetId = SHEETS.enemies[def.id],
          sheet = sheetId
            ? this.enemySheets[e.elite >= 0 ? sheetId + '-elite' : sheetId]
            : undefined,
          punch = this.reducedMotion ? 1 : 1 + e.flash * JUICE.hitPunch,
          // The Night Hag's threefold illusions (1 HP, no XP) wear her own sheet.
          illusion =
            e.kind === 2 && e.xp === 0 && e.maxHp === 1 && g.boss?.active && g.boss.boss === 2
              ? this.bossSheets.hag
              : undefined;
        if (e.kind === 7 && e.state === 0) {
          // Changeling, disguised: almost an XP shard. A touch larger, slower to bob, and
          // every few seconds a red glint betrays it (GDD 9).
          const glint = Math.sin(g.realTime * 1.3 + e.id) > 0.97;
          s.texture = this.art.xp;
          s.anchor.set(0.5);
          s.rotation = 0;
          s.scale.set(0.62 + 0.03 * Math.sin(g.realTime * 2.2 + e.id));
          s.tint = glint ? C.threat : C.silver;
          s.alpha = 1;
          continue;
        }
        if (illusion) {
          const frame = illusion.frame(
              'move',
              Math.atan2(p.y - e.y, p.x - e.x),
              g.realTime + e.id * 0.53,
            ),
            k = (BOSSES[2].art.size / (illusion.manifest.heightPx ?? BOSSES[2].art.size)) * punch;
          s.texture = frame.texture;
          s.anchor.set(illusion.manifest.pivot[0], illusion.manifest.pivot[1]);
          s.scale.set(frame.mirror ? -k : k, k);
          s.rotation = 0;
        } else if (sheet) {
          // 3/4 sheet: upright on its feet, own animation phase, attack follows the telegraph.
          const windup = attackProgress(e, def.telegraph),
            standing = e.kind === 3 && Math.hypot(p.x - e.x, p.y - e.y) < 430,
            frame =
              windup !== null && sheet.has('attack')
                ? sheet.frame('attack', e.angle, 0, windup)
                : standing && sheet.has('attack')
                  ? sheet.frame('attack', e.angle, 0, 0)
                  : sheet.frame('move', e.angle, g.realTime + e.id * 0.37);
          s.texture = frame.texture;
          s.anchor.set(sheet.manifest.pivot[0], sheet.manifest.pivot[1]);
          const k = 0.5 * (e.r / def.radius) * punch;
          s.scale.set(frame.mirror ? -k : k, k);
          s.rotation = 0;
        } else {
          s.texture = this.art[e.elite >= 0 ? def.id + '.elite' : def.id];
          s.anchor.set(0.5);
          s.rotation = e.angle;
          s.scale.set((e.r / UNIT) * punch);
        }
      }
      s.alpha =
        e.fade > 0
          ? 0.17
          : e.kind === 6 && e.state === 0
            ? 0.5
            : e.boss >= 0
              ? 1
              : Math.min(1, e.age / 0.4);
      if (
        g.event === 3 &&
        Math.hypot(e.x - p.x, e.y - p.y) > 250 &&
        !e.deadmark &&
        !g.rank('lantern')
      )
        s.alpha *= 0.22;
    }
    // Boss weak point: a slow pulse ring over the baked white-hot core.
    const boss = g.boss?.active ? g.boss : null;
    this.weakPoint.visible = !!boss;
    if (boss) {
      const art = BOSSES[boss.boss].art,
        sheet = this.bossSheets[BOSSES[boss.boss].id],
        k = art.size / (BOSS_HALF * 2),
        rot = art.faces ? boss.angle : 0,
        wx = art.weak.x * BOSS_HALF * k,
        wy = art.weak.y * BOSS_HALF * k,
        pulse = 0.5 + 0.5 * Math.sin(g.realTime * 5);
      // Sheet bosses: the Shuck's weak point is its head, at the front; others wear a crown.
      if (sheet && boss.boss === 0)
        this.weakPoint.position.set(
          boss.x + Math.cos(boss.angle) * art.size * 0.42,
          boss.y + Math.sin(boss.angle) * art.size * 0.12 - art.size * 0.66,
        );
      // The Bramble crown is a sim target (BOSSES[1].crown): the ring marks exactly that circle.
      else if (boss.boss === 1) this.weakPoint.position.set(boss.x, boss.y + BOSSES[1].crown!.dy);
      else if (sheet && boss.boss === 2)
        this.weakPoint.position.set(boss.x, boss.y - art.size * 0.45);
      else if (sheet) this.weakPoint.position.set(boss.x, boss.y - art.size * 0.97);
      else
        this.weakPoint.position.set(
          boss.x + wx * Math.cos(rot) - wy * Math.sin(rot),
          boss.y + wx * Math.sin(rot) + wy * Math.cos(rot),
        );
      const radius = boss.boss === 1 ? BOSSES[1].crown!.r : art.weak.r * BOSS_HALF * k;
      this.weakPoint.scale.set((radius / 40) * (1.1 + 0.35 * pulse));
      this.weakPoint.alpha = 0.35 + 0.45 * (1 - pulse);
    }
    for (let i = 0; i < g.arrows.items.length; i++) {
      const a = g.arrows.items[i],
        s = this.arrowSprites[i],
        trail = this.trailSprites[i];
      s.visible = trail.visible = a.active;
      if (a.active) {
        const angle = Math.atan2(a.vy, a.vx),
          speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        s.position.set(a.x, a.y);
        s.rotation = angle;
        const deadeye = a.source === 'deadeye';
        s.scale.set(deadeye ? 1.1 : a.perfect ? 0.8 : 0.6);
        s.alpha = deadeye ? 1 : dim;
        s.tint = a.source === 'phantom' ? C.phantom : deadeye ? C.focusLight : 0xffffff;
        // Short trail behind the shaft, longer for faster arrows, fading as the arrow ages.
        trail.position.set(a.x - Math.cos(angle) * 18, a.y - Math.sin(angle) * 18);
        trail.rotation = angle;
        trail.scale.set(
          (JUICE.trailLength / 128) *
            Math.min(1.6, speed / T.arrowSpeed) *
            Math.min(1, a.travel / 60),
          deadeye ? 2.4 : a.perfect ? 1.4 : 1,
        );
        trail.alpha = deadeye ? 1 : JUICE.trailAlpha * dim;
        trail.tint = a.perfect ? C.focus : a.source === 'phantom' ? C.phantom : C.silver;
      }
    }
    // Deadeye marks glow violet under their targets.
    let glows = 0;
    if (g.deadeye > 0 || g.focusMarks > 0)
      for (const e of g.enemies.items)
        if (e.active && e.deadmark && glows < this.markGlows.length) {
          const m = this.markGlows[glows++];
          m.visible = true;
          m.position.set(e.x, e.y);
          m.scale.set((e.r / 40) * (this.reducedMotion ? 1 : 1 + 0.12 * Math.sin(g.realTime * 8)));
          m.alpha = 0.75;
        }
    for (let i = glows; i < this.markGlows.length; i++) this.markGlows[i].visible = false;
    this.diegetic.reducedMotion = this.reducedMotion;
    this.diegetic.update(g, this.hunter.scale.x);
    this.vfx.reducedMotion = this.reducedMotion;
    this.vfx.handle(g);
    this.vfx.update(realDt);
    // Deadeye: slight desaturation of the world and a violet wash.
    const deadeye = g.deadeye > 0;
    if (deadeye !== (this.root.filters?.length === 1))
      this.root.filters = deadeye ? [this.deadeyeFilter] : [];
    for (let i = 0; i < g.pickups.items.length; i++) {
      const q = g.pickups.items[i],
        s = this.pickupSprites[i];
      s.visible = q.active && !(this.lowPower && i & 1);
      if (q.active) {
        s.texture = this.art[q.kind === 2 ? 'berry' : 'xp'];
        s.position.set(q.x, q.y);
        s.scale.set(0.55 + 0.04 * Math.sin(g.realTime * 3 + i));
        s.tint = q.kind === 2 ? 0xffffff : q.kind === 1 ? C.elite : C.silver;
      }
    }
    for (let i = 0; i < g.particles.items.length; i++) {
      const q = g.particles.items[i],
        s = this.particleSprites[i];
      s.visible = q.active;
      if (q.active) {
        s.position.set(q.x, q.y);
        s.scale.set(q.size * 0.2);
        s.alpha = (q.life / q.max) * (q.color === 1 ? 1 : dim);
        s.tint =
          q.color === 1
            ? C.threatBase
            : q.color === 2
              ? C.focus
              : q.color === 3
                ? C.elite
                : C.silver;
      }
    }
    this.hunter.position.set(p.x, p.y);
    this.cutout.position.set(p.x, p.y);
    this.cutout.scale.set(g.crowd > 40 ? 0.95 : 0.7);
    if (this.hunterSheet) {
      // 3/4 sprite: pick the clip from state, the direction from aim; feet sit on the entity.
      // Clip from gameplay state: dodge and hurt follow their own timers, drawing holds its aim
      // pose while standing and walks with the bow up while moving.
      const sheet = this.hunterSheet;
      // Facing eases toward the aim and holds near a direction's edge, so the sprite doesn't
      // flicker between two directions while aiming along the boundary.
      const turn = Math.atan2(Math.sin(p.aim - this.facing), Math.cos(p.aim - this.facing));
      this.facing += turn * Math.min(1, realDt * 16);
      const step = Math.PI / 4,
        current = Math.round(this.heldFacing / step) * step,
        off = Math.atan2(Math.sin(this.facing - current), Math.cos(this.facing - current));
      if (Math.abs(off) > step * 0.62) this.heldFacing = this.facing;
      const face = Math.round(this.heldFacing / step) * step;
      let frame;
      if (g.outcome === 'The Hunter Falls' && sheet.has('death'))
        frame = sheet.frame('death', face, 0, Math.min(1, this.deathTime / 1.4));
      else if (p.dodge > 0 && sheet.has('dodge'))
        frame = sheet.frame('dodge', face, 0, 1 - p.dodge / T.dodgeTime);
      else if (p.invuln > 0 && sheet.has('hurt'))
        frame = sheet.frame('hurt', face, 0, 1 - p.invuln / T.invulnerability);
      else if (p.draw > 0 && sheet.has('draw'))
        frame = g.moving ? sheet.frame('draw', face, g.realTime) : sheet.frame('draw', face, 0, 0);
      else frame = sheet.frame(g.moving && sheet.has('run') ? 'run' : 'idle', face, g.realTime);
      this.hunter.texture = frame.texture;
      this.hunter.anchor.set(sheet.manifest.pivot[0], sheet.manifest.pivot[1]);
      // ~69 px tall on screen (art bible: 72 px), so bosses and crowds keep their scale.
      // Release recoil: a quick punch back along the aim on every loose.
      for (const e of g.events)
        if (e.id === 'bow.perfect' || e.id === 'bow.full' || e.id === 'bow.quick')
          this.recoil = e.id === 'bow.perfect' ? 1 : 0.7;
      this.recoil = Math.max(0, this.recoil - realDt * 9);
      const kick = this.reducedMotion ? 0 : this.recoil;
      this.hunter.position.set(p.x - Math.cos(p.aim) * 4 * kick, p.y - Math.sin(p.aim) * 4 * kick);
      const k = HUNTER_SCALE * (1 + 0.05 * kick);
      this.hunter.scale.set(frame.mirror ? -k : k, k);
      this.hunter.rotation = 0;
      this.footShadow.visible = true;
      this.footShadow.position.set(p.x + 3, p.y + 2);
      this.footShadow.scale.set(0.29, 0.11);
      this.footShadow.alpha = 0.7;
    } else this.hunter.rotation = p.aim;
    this.hunter.alpha = p.invuln > 0 ? 0.55 + 0.45 * Math.sin(g.realTime * 30) : 1;
    for (let i = 0; i < 3; i++) {
      const q = g.ghosts.items[i],
        s = this.ghostSprites[i];
      s.visible = q.active;
      if (q.active) {
        s.position.set(q.x, q.y);
        s.rotation = p.aim;
      }
    }
    this.raven.visible = g.rank('moonraven') > 0;
    if (this.raven.visible) {
      const ox = p.x + Math.cos(g.time * 2) * 90,
        oy = p.y + Math.sin(g.time * 2) * 90,
        dive = this.ravenDive;
      for (const e of g.events)
        if (e.id === 'tool.moonraven') {
          dive.t = RAVEN_DIVE;
          dive.x = e.x;
          dive.y = e.y;
          dive.hit = false;
        }
      if (dive.t > 0) {
        // Dive: swoop from the orbit onto the target, strike at the midpoint, wheel back.
        dive.t = Math.max(0, dive.t - realDt);
        const k = 1 - dive.t / RAVEN_DIVE,
          out = k < 0.5 ? k / 0.5 : 1 - (k - 0.5) / 0.5,
          ease = out * out * (3 - 2 * out),
          x = ox + (dive.x - ox) * ease,
          y = oy + (dive.y - oy) * ease;
        this.raven.rotation = Math.atan2(y - this.raven.y, x - this.raven.x) + Math.PI / 2;
        this.raven.position.set(x, y);
        this.raven.scale.set(0.45 + 0.3 * ease);
        this.vfx.trail(x, y);
        if (k >= 0.5 && !dive.hit) {
          dive.hit = true;
          this.vfx.ravenStrike(dive.x, dive.y);
        }
      } else {
        this.raven.position.set(ox, oy);
        this.raven.rotation = g.time * 2 + Math.PI / 2;
        this.raven.scale.set(0.45);
      }
    }
    for (const slot of this.numberSlots) {
      slot.life -= realDt;
      slot.text.visible = slot.life > 0;
      if (slot.life > 0) {
        slot.text.y -= realDt * 25;
        slot.text.alpha = Math.min(1, slot.life * 2);
      }
    }
    for (const slot of this.numberSlots)
      if (slot.life > 0 && slot.kind > 0) {
        // Crits pop: punch in from 1.7x, settle to 1.15x, then rise and fade.
        const age = 0.9 - slot.life,
          pop = this.reducedMotion ? 1.15 : age < 0.1 ? 1.7 - age * 5.5 : 1.15;
        slot.text.scale.set(pop);
      }
    const events = g.events;
    for (let i = 0; i < events.length; i++) {
      const event = events[i],
        kind =
          event.id === 'number.deadeye'
            ? 2
            : event.id === 'number.crit' || event.id === 'tool.moonraven'
              ? 1
              : 0,
        crit = kind > 0;
      // A crit emits its number then its hit: the hit's plain number is skipped.
      const hit =
        this.numbers &&
        event.value > 0 &&
        event.id.startsWith('enemy.hit.') &&
        !(i > 0 && events[i - 1].id.startsWith('number.'));
      if (crit || hit) {
        const slot = this.numberSlots.find((slot) => slot.life <= 0 && slot.kind === kind);
        if (slot) {
          slot.life = kind === 2 ? 1.1 : crit ? 0.9 : 0.55;
          slot.text.text = crit ? Math.round(event.value) + '!' : String(Math.round(event.value));
          slot.text.scale.set(1);
          slot.text.position.set(event.x + (event.value % 7) * 3 - 9, event.y - 30);
          slot.text.visible = true;
        }
      }
    }
    this.lines(g);
    this.reticle(g);
    const submitStart = performance.now();
    this.timing.scene += (submitStart - sceneStart - this.timing.scene) * 0.1;
    this.app.render();
    this.timing.submit += (performance.now() - submitStart - this.timing.submit) * 0.1;
  }
  lines(g: Hunt) {
    const p = g.player,
      w = this.worldLines,
      tg = this.threatGraphics;
    w.clear();
    tg.clear();
    const red = this.colorblind ? C.colorblind : C.threat,
      crowded = g.crowd > 150;
    if (this.showBands && !this.camp) {
      w.circle(p.x, p.y, g.bow.near).stroke({ color: 0x98c7e6, alpha: 0.06, width: 1 });
      w.circle(p.x, p.y, g.bow.far).stroke({ color: 0x98c7e6, alpha: 0.11, width: 1 });
    }
    if (this.camp) {
      // Each station is its prop (render/camp.ts); the one in reach gets a moonlit ground ring.
      for (const s of STATIONS) {
        const near = Math.hypot(s.x - p.x, s.y - p.y) < 140;
        w.ellipse(s.x, s.y + 30, 64, 24).stroke({
          color: near ? 0xc4d4ff : 0x8aaccc,
          alpha: near ? 0.55 : 0.14,
          width: near ? 2 : 1.5,
        });
      }
    }
    if (g.rank('lantern'))
      w.circle(p.x, p.y, 140 + 20 * (g.rank('lantern') - 1))
        .fill({ color: 0xdceeff, alpha: 0.02 })
        .stroke({ color: 0xdceeff, alpha: 0.2, width: 1 });
    if (g.event === 2)
      w.circle(g.eventX, g.eventY, 85)
        .fill({ color: 0xdceeff, alpha: 0.08 })
        .stroke({ color: 0xdceeff, alpha: 0.7, width: 2 });
    if (g.boss?.boss === 2)
      w.ellipse(g.boss.x + 15, g.boss.y + 35, 50, 16).fill({ color: 0x03060d, alpha: 0.9 });

    for (const e of g.enemies.items)
      if (e.active) {
        if (e.elite >= 0) this.eliteMark(tg, e, g.realTime);
        if (e.deadmark || e.mark) {
          tg.circle(e.x, e.y, e.r + 16).stroke({
            color: e.deadmark ? C.focus : C.silver,
            width: 2,
            alpha: 1,
          });
          tg.moveTo(e.x - 7, e.y - e.r - 23)
            .lineTo(e.x, e.y - e.r - 17)
            .lineTo(e.x + 7, e.y - e.r - 23)
            .stroke({ color: 0xdaefff, width: 2 });
        }
        if (e.kind === 6 && e.state === 0)
          tg.moveTo(e.x - Math.cos(e.angle) * 42, e.y - Math.sin(e.angle) * 42)
            .lineTo(e.x, e.y)
            .stroke({ color: red, alpha: 0.4, width: 5 });
        if (e.slow > 0 || e.freeze > 0)
          tg.poly([e.x, e.y - 24, e.x + 24, e.y, e.x, e.y + 24, e.x - 24, e.y]).stroke({
            color: 0xdaefff,
            alpha: 0.6,
            width: 1,
          });
      }
    for (const t of g.threats.items)
      if (t.active) {
        if (t.kind === 3) tg.circle(t.x, t.y, t.r).fill(red);
        else if (t.kind === 2)
          tg.circle(t.x, t.y, t.r * (0.85 + (0.15 * t.clock) / t.duration))
            .fill({ color: red, alpha: 0.04 })
            .stroke({ color: red, alpha: 0.8, width: 2 });
        else if (t.kind === 4) {
          w.moveTo(t.x, t.y)
            .lineTo(t.x + Math.cos(t.angle) * t.length, t.y + Math.sin(t.angle) * t.length)
            .stroke({ color: 0x50293b, width: t.r * 2, alpha: 0.95 });
          tg.moveTo(t.x, t.y)
            .lineTo(t.x + Math.cos(t.angle) * t.length, t.y + Math.sin(t.angle) * t.length)
            .stroke({ color: red, width: 3, alpha: 0.65 });
        } else if (t.kind === 5)
          w.circle(t.x, t.y, t.r).stroke({ color: C.silver, width: 2, alpha: 0.7 });
        else {
          const endX = t.x + Math.cos(t.angle) * t.length,
            endY = t.y + Math.sin(t.angle) * t.length;
          // Charge lanes get a translucent body; aim lines are a single stroke that thins in a crowd.
          if (t.kind === 1)
            tg.moveTo(t.x, t.y)
              .lineTo(endX, endY)
              .stroke({ color: red, width: t.r * 2, alpha: 0.12 });
          tg.moveTo(t.x, t.y)
            .lineTo(endX, endY)
            .stroke({
              color: red,
              width: t.kind === 1 ? 2 : 1.5,
              alpha: t.kind === 1 ? 0.85 : crowded ? 0.3 : 0.7,
            });
          if (this.colorblind)
            for (let i = 0; i < 10; i++) {
              const x = t.x + ((endX - t.x) * i) / 10,
                y = t.y + ((endY - t.y) * i) / 10;
              tg.circle(x, y, 4).fill(red);
            }
        }
      }
  }
  reticle(g: Hunt) {
    const o = this.overlay;
    o.clear();
    if (this.camp) return;
    const p = g.player,
      x = this.aimScreen.x,
      y = this.aimScreen.y,
      full =
        g.bow.draw /
        (1 + 0.08 * g.rank('quick-nock') - 0.1 * g.rank('heavy-bow') + 0.2 * g.rank('swift-bow')),
      win = g.bow.window * (1 + 0.25 * g.rank('steady-hand'));
    const perfect = p.draw >= full && p.draw <= full + win;
    const r = 27 - Math.min(1, p.draw / full) * 13;
    o.circle(x, y, r).stroke({
      color: perfect ? C.focus : 0xaecbe0,
      width: perfect ? 3 : 1.5,
      alpha: perfect ? 1 : 0.65,
    });
    o.circle(x, y, 2).fill(0xdaefff);
    o.moveTo(x - r - 8, y)
      .lineTo(x - r - 3, y)
      .moveTo(x + r + 3, y)
      .lineTo(x + r + 8, y)
      .stroke({ color: 0xdaefff, width: 1, alpha: 0.7 });
    if (g.deadeye > 0)
      o.circle(x, y, 60 * this.zoom).stroke({ color: C.focus, width: 1, alpha: 0.5 });
    if (g.deadeye > 0)
      o.rect(0, 0, this.width, this.height).fill({ color: C.focus, alpha: JUICE.deadeyeTint });
    // Chime flash on a perfect release.
    if (g.flash > 0)
      o.rect(0, 0, this.width, this.height).fill({
        color: C.focusLight,
        alpha: g.flash * JUICE.chimeFlash * (this.reducedMotion ? JUICE.reducedFlash : 1),
      });
  }
}
