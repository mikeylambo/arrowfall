export const T = {
  tick: 1 / 60,
  hp: 100,
  speed: 240,
  drawMove: 0.65,
  damage: 30,
  arrowSpeed: 800,
  arrowRange: 850,
  dodgeDistance: 140,
  dodgeTime: 0.18,
  dodgeCooldown: 1.2,
  invulnerability: 0.5,
  deadeyeTime: 3,
  deadeyeScale: 0.2,
  deadeyeDamage: 1.5,
  focusPerfect: 12,
  focusHit: 3,
  focusElite: 8,
  worldWidth: 15000,
  worldHeight: 8500,
  coverCell: 400,
  hitstopPerfect: 0.04,
  hitstopElite: 0.06,
  maxShake: 6,
};
export const xpNeeded = (level: number) => 5 + 4 * Math.pow(level, 1.35);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
