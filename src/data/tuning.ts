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
  /** Dodge charges held at once; each recharges over dodgeCooldown. */
  dodgeCharges: 2,
  /** After a roll the hunter sprints: seconds and speed bonus. */
  sprintTime: 0.6,
  sprintBoost: 0.3,
  /** Hit knockback (px) for quick, full-draw and perfect arrows; bosses are immovable. */
  knockback: [4, 10, 18] as number[],
  /** Perfect-streak tiers: streak lengths and the perfect-damage bonus each tier adds. */
  streakTiers: [5, 10, 20] as number[],
  streakBonus: 0.05,
  /** Pacing: every cycle (s) ends with a lull then a swarm (s), scaling the enemy cap. */
  paceCycle: 150,
  lull: 18,
  swarm: 14,
  lullScale: 0.45,
  swarmScale: 1.6,
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
  /** Freeze on Deadeye release, before the marked volley flies (s). */
  hitstopDeadeye: 0.12,
  /** Level-up surge: real seconds of slow motion before the cards, and the time scale. */
  levelSurge: 0.55,
  /** Boss arrival and fall cinematics: real seconds and the time scale while they play. */
  bossIntro: 2.4,
  bossIntroScale: 0.1,
  bossFall: 1.8,
  bossFallScale: 0.2,
  levelSurgeScale: 0.2,
  /** Level-up shockwave: radius (px) and how far it shoves enemies outward (px). */
  levelNova: 300,
  levelNovaPush: 140,
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
