/**
 * Procedural silhouette, drawn top-down facing +x. Lengths are in units of the
 * collision radius, so art scales with the hitbox and never misrepresents it.
 */
export interface Silhouette {
  /** Body archetype painter (render/silhouettes.ts). */
  form: 'shambler' | 'wolf' | 'wisp' | 'archer' | 'antlered' | 'brute' | 'serpent' | 'hag';
  /** Extent along the facing direction, in radii. */
  length: number;
  /** Extent across the facing direction, in radii. */
  width: number;
}
export interface EnemyDef {
  id: string;
  name: string;
  first: number;
  hp: number;
  speed: number;
  damage: number;
  xp: number;
  radius: number;
  telegraph: number;
  silhouette: Silhouette;
}
export const ENEMIES: EnemyDef[] = [
  {
    id: 'husk',
    name: 'Husk',
    first: 0,
    hp: 20,
    speed: 55,
    damage: 8,
    xp: 1,
    radius: 15,
    telegraph: 0.6,
    silhouette: { form: 'shambler', length: 1.15, width: 1.05 },
  },
  {
    id: 'hound',
    name: 'Moonhound',
    first: 90,
    hp: 26,
    speed: 120,
    damage: 10,
    xp: 1,
    radius: 16,
    telegraph: 0.5,
    silhouette: { form: 'wolf', length: 2.1, width: 0.7 },
  },
  {
    id: 'wisp',
    name: 'Wisp',
    first: 180,
    hp: 18,
    speed: 80,
    damage: 8,
    xp: 2,
    radius: 13,
    telegraph: 0.6,
    silhouette: { form: 'wisp', length: 1.6, width: 0.95 },
  },
  {
    id: 'poacher',
    name: 'Poacher',
    first: 240,
    hp: 40,
    speed: 60,
    damage: 14,
    xp: 3,
    radius: 16,
    telegraph: 0.8,
    silhouette: { form: 'archer', length: 1, width: 1.25 },
  },
  {
    id: 'stag',
    name: 'Hollow Stag',
    first: 360,
    hp: 120,
    speed: 50,
    damage: 20,
    xp: 4,
    radius: 25,
    telegraph: 0.9,
    silhouette: { form: 'antlered', length: 1.5, width: 1.7 },
  },
  {
    id: 'knight',
    name: 'Barrow Knight',
    first: 420,
    hp: 90,
    speed: 55,
    damage: 14,
    xp: 4,
    radius: 21,
    telegraph: 0.6,
    silhouette: { form: 'brute', length: 0.95, width: 1.5 },
  },
  {
    id: 'worm',
    name: 'Barrow Worm',
    first: 540,
    hp: 60,
    speed: 140,
    damage: 22,
    xp: 3,
    radius: 19,
    telegraph: 0.8,
    silhouette: { form: 'serpent', length: 2.3, width: 0.75 },
  },
  {
    id: 'changeling',
    name: 'Changeling',
    first: 660,
    hp: 50,
    speed: 200,
    damage: 16,
    xp: 5,
    radius: 17,
    telegraph: 0.6,
    silhouette: { form: 'hag', length: 1.35, width: 1.45 },
  },
];
export const ELITES = [
  'Frenzied',
  'Armored',
  'Regenerating',
  'Vampiric',
  'Explosive',
  'Moonwarded',
];
