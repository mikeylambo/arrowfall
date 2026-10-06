/** Core gameplay tuning. One constant per line; units noted per key. */
export const T = {
  /** Fixed simulation step (s). */
  tick: 1 / 60,
  /** Base player health before Vigor boons. */
  hp: 100,
  /** Base player move speed (px/s). */
  speed: 240,
  /** Move-speed multiplier while drawing (default bow mobility). */
  drawMove: 0.65,
  /** Base arrow damage before draw, crit and upgrade multipliers. */
  damage: 30,
  /** Arrow flight speed (px/s); perfect looses fly 25% faster. */
  arrowSpeed: 800,
  /** Arrow travel distance before despawn (px). */
  arrowRange: 850,
  /** Exact dodge travel (px). */
  dodgeDistance: 140,
  /** Dodge duration (s). */
  dodgeTime: 0.18,
  /** Time between dodges (s). */
  dodgeCooldown: 1.2,
  /** Invulnerability after taking a hit (s). */
  invulnerability: 0.5,
  /** Deadeye duration (s). */
  deadeyeTime: 3,
  /** World time scale during Deadeye. */
  deadeyeScale: 0.2,
  /** Damage multiplier for Deadeye volley arrows. */
  deadeyeDamage: 1.5,
  /** Focus gained per perfect loose (of 100). */
  focusPerfect: 12,
  /** Focus gained per arrow hit. */
  focusHit: 3,
  /** Focus gained per elite kill. */
  focusElite: 8,
  /** Hunt world width (px). */
  worldWidth: 15000,
  /** Hunt world height (px). */
  worldHeight: 8500,
  /** Spatial-hash cell size for cover obstacles (px). */
  coverCell: 400,
  /** Freeze-frame on a perfect loose (s). */
  hitstopPerfect: 0.04,
  /** Freeze-frame on an elite or boss kill (s). */
  hitstopElite: 0.06,
  /** Freeze-frame when a boss changes phase (s). */
  hitstopPhase: 0.15,
  /** Peak screen shake amplitude (px); hurt and Deadeye release kick to this. */
  maxShake: 6,
  /** Screen shake decay (px/s). */
  shakeDecay: 20,
  /** Overdraw auto-release. false: the draw holds at overdraw until the player lets go. */
  autoLoose: false as boolean,
};
export const xpNeeded = (level: number) => 5 + 4 * Math.pow(level, 1.35);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Vector length. Math.sqrt rather than Math.hypot: hypot boxes its result in V8 hot loops. */
export const len = (x: number, y: number) => Math.sqrt(x * x + y * y);
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  len(a.x - b.x, a.y - b.y);
