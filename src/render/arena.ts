/**
 * Boss arenas (GDD 10): the moonlight ring each boss fights inside, dressed in that boss's
 * own markers. As a boss arrives, the ring closes in from wide and its markers rise around it
 * one after another; when the boss falls, the ring fades. The arena geometry itself stays in
 * the sim (radius 1050 around eventX/eventY); this is presentation only.
 */
import { Container, Graphics } from 'pixi.js';
import type { Hunt } from '../sim/game';

const RADIUS = 1050,
  FORM = 1.1;

interface Style {
  ring: number;
  glow: number;
  count: number;
  marker: (g: Graphics, i: number) => void;
}
/** Each boss's markers, drawn at the origin, pointing up (outward is -y once rotated). */
const STYLES: Style[] = [
  // The Black Shuck: grave-candle wisps on stakes, cold green-blue.
  {
    ring: 0x9fe0d8,
    glow: 0x6fd6c8,
    count: 28,
    marker: (g) => {
      g.rect(-2, -34, 4, 34).fill(0x1a2a33);
      g.ellipse(0, -44, 7, 12).fill({ color: 0x8ff0e0, alpha: 0.85 });
      g.ellipse(0, -42, 3, 6).fill(0xeafffb);
    },
  },
  // The Bramble King: thorn clusters bursting from the ground, blood-brown with red tips.
  {
    ring: 0xc46a5a,
    glow: 0x9c2c2c,
    count: 40,
    marker: (g, i) => {
      const lean = ((i * 37) % 7) / 10 - 0.3;
      for (const [x, h, w] of [
        [-10, 46, 7],
        [0, 64, 9],
        [11, 40, 6],
      ] as const) {
        g.poly([x - w, 0, x + lean * h, -h, x + w, 0]).fill(0x2a1418);
        g.poly([
          x + lean * h * 0.85 - 2,
          -h * 0.85,
          x + lean * h,
          -h,
          x + lean * h * 0.85 + 2,
          -h * 0.85,
        ]).fill(0xd2403c);
      }
    },
  },
  // The Night Hag: hovering moon-shadow sigils, violet.
  {
    ring: 0xb39cff,
    glow: 0x8a6cff,
    count: 18,
    marker: (g) => {
      g.circle(0, -30, 16).stroke({ color: 0xc7b6ff, width: 2, alpha: 0.9 });
      g.circle(0, -30, 9).stroke({ color: 0xc7b6ff, width: 1.2, alpha: 0.7 });
      g.moveTo(-14, -30)
        .lineTo(14, -30)
        .moveTo(0, -44)
        .lineTo(0, -16)
        .stroke({ color: 0xc7b6ff, width: 1.2, alpha: 0.7 });
      g.ellipse(0, 4, 14, 4).fill({ color: 0x050310, alpha: 0.7 });
    },
  },
  // The Huntmaster: hunt banners on antler-crowned poles, red cloth.
  {
    ring: 0xe8a0a0,
    glow: 0xc0303a,
    count: 16,
    marker: (g) => {
      g.rect(-2.5, -78, 5, 78).fill(0x2a2230);
      g.poly([2, -74, 30, -68, 24, -54, 30, -40, 2, -46]).fill(0x8c1f2a);
      g.moveTo(0, -78)
        .lineTo(-10, -92)
        .lineTo(-16, -90)
        .moveTo(0, -78)
        .lineTo(10, -92)
        .lineTo(16, -90)
        .stroke({ color: 0xd8cba4, width: 2.5 });
    },
  },
];

export class Arena {
  readonly layer = new Container();
  private readonly ring = new Graphics();
  private readonly markers: Graphics[] = [];
  private boss = -1;
  private age = 0;
  private fading = 0;
  private x = 0;
  private y = 0;
  constructor() {
    this.layer.addChild(this.ring);
  }
  clear() {
    for (const m of this.markers) m.destroy();
    this.markers.length = 0;
    this.ring.clear();
    this.boss = -1;
    this.fading = 0;
  }
  private build(boss: number, x: number, y: number) {
    this.clear();
    this.boss = boss;
    this.x = x;
    this.y = y;
    this.age = 0;
    const style = STYLES[boss] ?? STYLES[0];
    for (let i = 0; i < style.count; i++) {
      const a = (i / style.count) * Math.PI * 2,
        m = new Graphics();
      style.marker(m, i);
      m.position.set(x + Math.cos(a) * RADIUS, y + Math.sin(a) * RADIUS);
      // Markers stand upright (the camera is 3/4, so "up" is up), outer ones a little larger.
      m.scale.set(0);
      this.layer.addChild(m);
      this.markers.push(m);
    }
  }
  update(g: Hunt, dt: number, reduced: boolean) {
    const b = g.boss;
    if (b?.active && b.boss !== this.boss) this.build(b.boss, g.eventX, g.eventY);
    if (this.boss < 0) return;
    if (!b?.active) {
      this.fading += dt;
      if (this.fading > 1.2) return this.clear();
    }
    this.age += dt;
    const style = STYLES[this.boss] ?? STYLES[0],
      form = reduced ? 1 : Math.min(1, this.age / FORM),
      ease = 1 - (1 - form) ** 3,
      fade = Math.max(0, 1 - this.fading / 1.2),
      radius = RADIUS + (1 - ease) * 700,
      pulse = reduced ? 0 : Math.sin(g.realTime * 2) * 0.08;
    this.ring
      .clear()
      .circle(this.x, this.y, radius)
      .stroke({ color: style.glow, width: 26, alpha: (0.12 + pulse * 0.5) * ease * fade })
      .circle(this.x, this.y, radius)
      .stroke({ color: style.ring, width: 5, alpha: 0.75 * ease * fade });
    // Markers rise one after another around the ring, starting from the side facing the hunter.
    const start = Math.atan2(g.player.y - this.y, g.player.x - this.x);
    this.markers.forEach((m, i) => {
      const a = (i / this.markers.length) * Math.PI * 2,
        turn = ((a - start + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2),
        delay = reduced ? 0 : 0.15 + turn * 1.0,
        rise = Math.min(1, Math.max(0, (this.age - delay) / 0.35)),
        pop = rise < 1 ? rise * (1.25 - 0.25 * rise) : 1;
      m.position.set(this.x + Math.cos(a) * radius, this.y + Math.sin(a) * radius);
      // Markers are drawn at 2x so they still read in the wide arena shot.
      m.scale.set(2 * pop * (1 + 0.04 * Math.sin(g.realTime * 3 + i)), 2 * pop);
      m.alpha = fade;
    });
  }
}
