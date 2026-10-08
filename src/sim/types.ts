export interface Input {
  mx: number;
  my: number;
  ax: number;
  ay: number;
  draw: boolean;
  dodge: boolean;
  deadeye: boolean;
}
export interface Body {
  active: boolean;
  x: number;
  y: number;
}
export interface Enemy extends Body {
  id: number;
  kind: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  damage: number;
  xp: number;
  elite: number;
  boss: number;
  phase: number;
  angle: number;
  clock: number;
  state: number;
  tx: number;
  ty: number;
  flash: number;
  age: number;
  fade: number;
  burn: number;
  bleed: number;
  poison: number;
  slow: number;
  freeze: number;
  root: number;
  mark: boolean;
  lastHit: number;
  statusClock: number;
  deadmark: boolean;
  dummy: boolean;
}
export interface Arrow extends Body {
  vx: number;
  vy: number;
  life: number;
  damage: number;
  pierce: number;
  perfect: boolean;
  full: boolean;
  crit: boolean;
  r: number;
  source: string;
  travel: number;
  hit: Uint32Array;
  hitCount: number;
}
export interface Particle extends Body {
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: number;
}
export interface Pickup extends Body {
  value: number;
  kind: number;
}
export interface Threat extends Body {
  kind: number;
  r: number;
  angle: number;
  length: number;
  clock: number;
  duration: number;
  damage: number;
  vx: number;
  vy: number;
  owner: number;
}
export interface Ghost extends Body {
  life: number;
}
export interface Player {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  aim: number;
  draw: number;
  focus: number;
  dodge: number;
  cooldown: number;
  /** Dodge charges ready, and post-roll sprint seconds left. */
  charges: number;
  sprint: number;
  dx: number;
  dy: number;
  invuln: number;
  evade: number;
  wind: number;
  streak: number;
  predator: number;
  apex: number;
}
export interface SimEvent {
  id: string;
  x: number;
  y: number;
  value: number;
}
export interface RunRecord {
  time: number;
  kills: number;
  perfects: number;
  shots: number;
  outcome: string;
  bow: string;
  currency: number;
  fingerprint: number[];
  evolutions: string[];
  seed: number;
}
export interface Profile {
  version: number;
  currency: number;
  runs: RunRecord[];
  kills: number;
  perfects: number;
  sweetKills: number;
  maxStreak: number;
  bosses: string[];
  unlocked: string[];
  deeds: string[];
  boons: Record<string, number>;
  onboarded: boolean;
  wins: number;
  phase: number;
  seen: string[];
  discovered: string[];
  challenges: string[];
}
