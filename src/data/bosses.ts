/** Boss art: silhouette form, on-screen length (px, 3-4x a regular enemy) and weak point. */
export interface BossArt {
  form: 'shuck' | 'bramble' | 'hag' | 'huntmaster';
  /** Largest on-screen dimension in px. The collision radius is unchanged. */
  size: number;
  /** Weak point in sprite space (-1..1 of the half-size, facing +x) and its glow radius. */
  weak: { x: number; y: number; r: number };
  /** Whether the sprite turns to face the hunter. */
  faces: boolean;
}
export const BOSSES = [
  {
    id: 'shuck',
    name: 'The Black Shuck',
    time: 300,
    hp: 1800,
    radius: 48,
    telegraph: 0.7,
    // Perfect hits to the front deal x1.5: the head is the weak point.
    art: { form: 'shuck', size: 176, weak: { x: 0.72, y: 0, r: 0.13 }, faces: true } as BossArt,
  },
  {
    id: 'bramble',
    name: 'The Bramble King',
    time: 600,
    hp: 4500,
    radius: 58,
    telegraph: 1,
    // Only the glowing crown takes full damage (GDD 10); the thorn body takes 25%.
    // The crown sits above the body on screen and never rotates.
    crown: { dy: -42, r: 24 },
    art: { form: 'bramble', size: 196, weak: { x: 0, y: -0.43, r: 0.2 }, faces: false } as BossArt,
  },
  {
    id: 'hag',
    name: 'The Night Hag',
    time: 900,
    hp: 8500,
    radius: 42,
    telegraph: 0.8,
    // Striking the true Hag breaks the threefold illusion: her lantern heart.
    art: { form: 'hag', size: 168, weak: { x: 0.1, y: 0, r: 0.13 }, faces: true } as BossArt,
  },
  {
    id: 'huntmaster',
    name: 'The Huntmaster',
    time: 1140,
    hp: 16000,
    radius: 40,
    telegraph: 0.8,
    // Hits while he draws stagger him: the antler crown marks his head.
    art: {
      form: 'huntmaster',
      size: 160,
      weak: { x: 0.18, y: 0, r: 0.12 },
      faces: true,
    } as BossArt,
  },
];
