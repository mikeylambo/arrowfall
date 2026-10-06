export const ART_MANIFEST = [
  {
    id: 'hunter',
    path: '/art/hunter.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle', 'run', 'draw', 'dodge'],
  },
  {
    id: 'shuck',
    path: '/art/shuck.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle'],
  },
  {
    id: 'bramble',
    path: '/art/bramble.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle'],
  },
  {
    id: 'hag',
    path: '/art/hag.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle'],
  },
  {
    id: 'huntmaster',
    path: '/art/huntmaster.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle'],
  },
  {
    id: 'raven',
    path: '/art/raven.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle'],
  },
  {
    id: 'camp',
    path: '/art/camp.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle'],
  },
  {
    id: 'title',
    path: '/art/title.png',
    width: 128,
    height: 128,
    pivot: [0.5, 0.5],
    frames: ['idle'],
  },
];

/**
 * Readability palette. Every gameplay colour is chosen here.
 * Value hierarchy (grayscale-safe): player brightest, threats mid-value with lighter rims,
 * world darkest. Violet is reserved for the perfect window, Deadeye and Focus.
 */
export const PALETTE = {
  /** Deep navy clear colour behind everything. */
  background: '#060a16',
  /** Moor ground: procedural noise shades from dark to light. */
  ground: { dark: '#070c18', base: '#0b1323', light: '#121d31', moss: '#14233a' },
  /** Cool moonlight multiplied over ground and fog. */
  moonlight: '#c4d4ff',
  fog: '#a9bddf',
  /** Player: silver/white body with a soft white rim glow. */
  player: { body: '#e6ecf5', shade: '#9eabc0', rim: '#ffffff', glow: '#dbe8ff', bow: '#f4f7fb' },
  /** Threat family. Base #c8323c; each enemy type uses a darker variant (see ENEMY_TONES). */
  threat: { base: '#c8323c', rim: '#ff6670', eye: '#ffd9dc', telegraph: '#ff3c48' },
  /** Elites: brighter body and a pale outline. */
  elite: { body: '#ff4d58', rim: '#ffe6e8', outline: '#fff2f3' },
  /** Perfect window, Deadeye and Focus. Never used for anything else. */
  focus: '#9b6bff',
  focusLight: '#cdb6ff',
  /** Boss weak points: white-hot gold, brighter than any other boss pixel. */
  weak: '#ffe7a8',
  /** Neutral world and pickups. */
  silver: '#dbe8f7',
  heal: '#ffe3c2',
  cover: { tree: '#0a1322', treeRim: '#1b2a40', stone: '#101c2d', stoneRim: '#34465c' },
  /** Colourblind assist swaps telegraph lines to amber. */
  colorblindThreat: '#ffbe76',
};

/** Per-type red variants, darkest for the heaviest threats. */
export const ENEMY_TONES: Record<string, { body: string; shade: string }> = {
  husk: { body: '#c8323c', shade: '#6e1a22' },
  hound: { body: '#b82e37', shade: '#621820' },
  wisp: { body: '#c23a4a', shade: '#6a1d2a' },
  poacher: { body: '#a92a32', shade: '#5a161c' },
  stag: { body: '#9c262e', shade: '#51131a' },
  knight: { body: '#8c2229', shade: '#481116' },
  worm: { body: '#b0303a', shade: '#5d171f' },
  changeling: { body: '#be2f3a', shade: '#661821' },
};

/** Boss tones: same red family, darker body so the weak point reads first. */
export const BOSS_TONES: Record<string, { body: string; shade: string }> = {
  shuck: { body: '#8e2028', shade: '#3e0c12' },
  bramble: { body: '#86222a', shade: '#3b0d13' },
  hag: { body: '#9a2634', shade: '#430f18' },
  huntmaster: { body: '#a0262f', shade: '#460f15' },
};

/** Pixi tint from a palette hex string. */
export const tint = (hex: string) => parseInt(hex.slice(1, 7), 16);

/** Ground and atmosphere layers (render/ground.ts). */
export const ATMOSPHERE = {
  /** Fog below the actors: near-world parallax, slow drift. */
  mistLow: { alpha: 0.1, parallax: 1.06, driftX: 9, driftY: 3, scale: 2.2 },
  /** Fog above everything: stronger parallax, fainter. */
  mistHigh: { alpha: 0.05, parallax: 1.3, driftX: -14, driftY: 5, scale: 3 },
  /** Screen-edge darkening (0..1). */
  vignette: 0.85,
  /** Decal chunk edge (px); chunks are culled whole. */
  chunk: 1024,
  /** Decal grid spacing (px) and the chance a grid cell holds one. */
  decalSpacing: 120,
  decalDensity: 0.45,
  /** Atlas frames scattered across the moor. */
  decals: ['grass1', 'grass2', 'grass3', 'heather', 'pebble1', 'pebble2'],
};

/** Juice (render/vfx.ts and renderer). Presentation only; never read by the sim. */
export const JUICE = {
  /** Effect sprite pool size. */
  pool: 500,
  /** Most effect sprites started per frame. */
  perFrame: 90,
  /** Arrow trail length at base arrow speed (px) and opacity. */
  trailLength: 70,
  trailAlpha: 0.45,
  /** Red death flash duration (s). */
  deathFlash: 0.12,
  /** Violet bloom pulse on the bow after a perfect release (s). */
  perfectBloom: 0.26,
  /** Full-screen chime flash opacity per unit of sim flash. */
  chimeFlash: 0.55,
  /** Deadeye: violet screen tint opacity and desaturation (0..1). */
  deadeyeTint: 0.09,
  deadeyeDesaturate: 0.35,
  /** Hit punch: extra sprite scale per second of enemy hit flash. */
  hitPunch: 1.4,
  /** Reduced motion keeps this fraction of flash intensity. */
  reducedFlash: 0.3,
};

/** In-world readouts on the hunter (render/diegetic.ts). Bow coordinates are hunter-texture px. */
export const DIEGETIC = {
  /** Bow tips and the string's rest position (texture px, facing +x). */
  tipX: 20,
  tipY: 29,
  restX: 20,
  /** How far a full draw pulls the nock back (texture px). */
  pull: 16,
  /** Focus motes: count, spawn ring and settle ring (world px). */
  motes: 14,
  moteFar: 78,
  moteNear: 20,
};

/** Rendered 3/4 sprite sheets (public/art/sprites/<id>) per character. Missing sheets fall back to baked art. */
export const SHEETS: {
  hunter: string;
  enemies: Record<string, string>;
  bosses: Record<string, string>;
} = {
  hunter: 'hunter',
  /** Enemy id -> sheet id; elites use '<sheet>-elite'. */
  enemies: {
    husk: 'husk',
    poacher: 'poacher',
    knight: 'knight',
    changeling: 'changeling',
    wisp: 'wisp',
    worm: 'worm',
    hound: 'hound',
    stag: 'stag',
  },
  /** Boss id -> sheet id. Huntmaster reuses the Poacher model, the Shuck the Moonhound (art-source/sprites.json). */
  bosses: { shuck: 'shuck', huntmaster: 'huntmaster' },
};
