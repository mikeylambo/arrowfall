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
