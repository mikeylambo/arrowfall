import type { Silhouette } from '../data/enemies';
import type { BossArt } from '../data/bosses';
import type { Tone } from './art';

type Ctx = CanvasRenderingContext2D;

/** Pixels per collision radius in a regular 128 px enemy cell. Sprite scale = radius / UNIT. */
export const UNIT = 24;

const ellipse = (c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
};
const poly = (c: Ctx, pts: number[]) => {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
};
/** Fill with the body colour, then rim. */
const solid = (c: Ctx, t: Tone, fill = t.body) => {
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = t.rim;
  c.lineWidth = t.width;
  c.lineJoin = 'round';
  c.stroke();
};
const line = (c: Ctx, t: Tone, pts: number[], width = t.width) => {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = t.rim;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.stroke();
};
const eyes = (c: Ctx, t: Tone, x: number, spread: number, size: number) => {
  c.fillStyle = t.eye;
  for (const s of [-1, 1]) {
    ellipse(c, x, s * spread, size, size * 0.7);
    c.fill();
  }
};

/**
 * Regular enemy painters. Each reads differently at a glance and in grayscale:
 * shambler round/hunched, wolf low/long, wisp a trailing flame, archer narrow with a bow,
 * antlered wide with branching crown, brute broad with a front shield, serpent a long chain,
 * hag tall/hunched with spindly reaching claws.
 */
export const FORMS: Record<Silhouette['form'], (c: Ctx, t: Tone, L: number, W: number) => void> = {
  shambler(c, t, L, W) {
    const u = UNIT;
    // Reaching arms, then the hunched body over them.
    for (const s of [-1, 1]) line(c, t, [0, s * W * u * 0.55, L * u * 0.95, s * W * u * 0.4]);
    ellipse(c, -u * 0.12, 0, L * u * 0.72, W * u * 0.78);
    solid(c, t);
    ellipse(c, -u * 0.38, 0, L * u * 0.38, W * u * 0.5);
    c.fillStyle = t.shade;
    c.fill();
    ellipse(c, L * u * 0.45, 0, u * 0.36, u * 0.34);
    solid(c, t);
    eyes(c, t, L * u * 0.58, u * 0.13, u * 0.07);
  },
  wolf(c, t, L, W) {
    const u = UNIT;
    // Legs splayed low, long body, wedge snout, tapering tail.
    for (const [x, s] of [
      [0.55, 1],
      [0.55, -1],
      [-0.55, 1],
      [-0.55, -1],
    ])
      line(c, t, [x * L * u * 0.5, 0, x * L * u * 0.5 + x * u * 0.25, s * W * u * 0.95]);
    poly(c, [
      L * u * 0.95,
      0,
      L * u * 0.62,
      -W * u * 0.32,
      L * u * 0.5,
      -W * u * 0.62,
      L * u * 0.35,
      -W * u * 0.42,
      -L * u * 0.35,
      -W * u * 0.5,
      -L * u * 0.62,
      -W * u * 0.18,
      -L * u * 1.0,
      -W * u * 0.06,
      -L * u * 1.0,
      W * u * 0.06,
      -L * u * 0.62,
      W * u * 0.18,
      -L * u * 0.35,
      W * u * 0.5,
      L * u * 0.35,
      W * u * 0.42,
      L * u * 0.5,
      W * u * 0.62,
      L * u * 0.62,
      W * u * 0.32,
    ]);
    solid(c, t);
    ellipse(c, -L * u * 0.05, 0, L * u * 0.3, W * u * 0.22);
    c.fillStyle = t.shade;
    c.fill();
    eyes(c, t, L * u * 0.7, W * u * 0.16, u * 0.06);
  },
  wisp(c, t, L, W) {
    const u = UNIT;
    // Flame head forward, tongues trailing behind, hollow bright core.
    poly(c, [
      L * u * 0.6,
      0,
      L * u * 0.35,
      -W * u * 0.75,
      -L * u * 0.2,
      -W * u * 0.6,
      -L * u * 0.55,
      -W * u * 0.85,
      -L * u * 0.5,
      -W * u * 0.3,
      -L * u * 1.0,
      -W * u * 0.15,
      -L * u * 0.62,
      0,
      -L * u * 1.0,
      W * u * 0.25,
      -L * u * 0.48,
      W * u * 0.35,
      -L * u * 0.6,
      W * u * 0.85,
      -L * u * 0.15,
      W * u * 0.62,
      L * u * 0.35,
      W * u * 0.75,
    ]);
    solid(c, t);
    ellipse(c, L * u * 0.12, 0, u * 0.32, u * 0.42);
    c.fillStyle = t.shade;
    c.fill();
    ellipse(c, L * u * 0.16, 0, u * 0.13, u * 0.2);
    c.fillStyle = t.eye;
    c.fill();
  },
  archer(c, t, L, W) {
    const u = UNIT;
    // Narrow shoulders, hood point, a drawn bow across the front.
    ellipse(c, -u * 0.1, 0, L * u * 0.45, W * u * 0.62);
    solid(c, t);
    poly(c, [L * u * 0.5, 0, u * 0.05, -u * 0.32, -u * 0.35, 0, u * 0.05, u * 0.32]);
    solid(c, t, t.shade);
    c.beginPath();
    c.moveTo(L * u * 0.62, -W * u * 0.85);
    c.quadraticCurveTo(L * u * 1.12, 0, L * u * 0.62, W * u * 0.85);
    c.strokeStyle = t.rim;
    c.lineWidth = t.width + 0.5;
    c.stroke();
    line(c, t, [L * u * 0.62, -W * u * 0.85, -u * 0.05, 0, L * u * 0.62, W * u * 0.85], 1);
    line(c, t, [-u * 0.05, 0, L * u * 1.05, 0], 1.5);
  },
  antlered(c, t, L, W) {
    const u = UNIT;
    // Heavy body behind, head forward, antlers branching wide.
    for (const s of [-1, 1]) {
      line(c, t, [
        L * u * 0.5,
        s * u * 0.2,
        L * u * 0.35,
        s * W * u * 0.62,
        L * u * 0.55,
        s * W * u * 0.98,
      ]);
      line(c, t, [L * u * 0.38, s * W * u * 0.5, L * u * 0.85, s * W * u * 0.62]);
      line(c, t, [L * u * 0.42, s * W * u * 0.78, L * u * 0.1, s * W * u * 0.92]);
    }
    ellipse(c, -L * u * 0.25, 0, L * u * 0.62, W * u * 0.4);
    solid(c, t);
    ellipse(c, -L * u * 0.35, 0, L * u * 0.3, W * u * 0.18);
    c.fillStyle = t.shade;
    c.fill();
    poly(c, [
      L * u * 0.82,
      0,
      L * u * 0.48,
      -u * 0.32,
      L * u * 0.18,
      -u * 0.22,
      L * u * 0.18,
      u * 0.22,
      L * u * 0.48,
      u * 0.32,
    ]);
    solid(c, t);
    eyes(c, t, L * u * 0.55, u * 0.14, u * 0.05);
  },
  brute(c, t, L, W) {
    const u = UNIT;
    // Wide pauldrons, armoured back, and a curved shield plate on the front.
    poly(c, [
      L * u * 0.3,
      -W * u * 0.92,
      -L * u * 0.4,
      -W * u * 0.98,
      -L * u * 0.8,
      -W * u * 0.55,
      -L * u * 0.8,
      W * u * 0.55,
      -L * u * 0.4,
      W * u * 0.98,
      L * u * 0.3,
      W * u * 0.92,
    ]);
    solid(c, t, t.shade);
    ellipse(c, -L * u * 0.1, 0, L * u * 0.42, W * u * 0.38);
    solid(c, t);
    c.beginPath();
    c.moveTo(L * u * 0.45, -W * u * 0.95);
    c.quadraticCurveTo(L * u * 1.2, 0, L * u * 0.45, W * u * 0.95);
    c.lineTo(L * u * 0.3, W * u * 0.8);
    c.quadraticCurveTo(L * u * 0.92, 0, L * u * 0.3, -W * u * 0.8);
    c.closePath();
    solid(c, t);
    c.fillStyle = t.eye;
    c.fillRect(L * u * 0.08, -u * 0.12, u * 0.12, u * 0.24);
  },
  serpent(c, t, L, W) {
    const u = UNIT;
    // A chain of shrinking segments on a sine, head and fangs forward.
    for (let i = 6; i >= 1; i--) {
      const x = L * u * (0.55 - i * 0.26),
        y = Math.sin(i * 1.1) * W * u * 0.45,
        r = W * u * (0.62 - i * 0.06);
      ellipse(c, x, y, r * 0.95, r);
      solid(c, t, i % 2 ? t.shade : t.body);
    }
    poly(c, [
      L * u * 0.98,
      0,
      L * u * 0.6,
      -W * u * 0.62,
      L * u * 0.3,
      -W * u * 0.5,
      L * u * 0.3,
      W * u * 0.5,
      L * u * 0.6,
      W * u * 0.62,
    ]);
    solid(c, t);
    for (const s of [-1, 1])
      line(c, t, [L * u * 0.85, s * W * u * 0.2, L * u * 1.05, s * W * u * 0.32], 1.5);
    eyes(c, t, L * u * 0.62, W * u * 0.28, u * 0.06);
  },
  hag(c, t, L, W) {
    const u = UNIT;
    // Spindly reaching claws, a tall hunched back hump, spiked hair.
    for (const s of [-1, 1]) {
      line(c, t, [
        0,
        s * W * u * 0.4,
        L * u * 0.5,
        s * W * u * 0.92,
        L * u * 0.98,
        s * W * u * 0.62,
      ]);
      line(c, t, [L * u * 0.98, s * W * u * 0.62, L * u * 1.0, s * W * u * 0.4], 1.5);
      line(c, t, [L * u * 0.98, s * W * u * 0.62, L * u * 0.82, s * W * u * 0.36], 1.5);
    }
    poly(c, [
      L * u * 0.3,
      0,
      L * u * 0.05,
      -W * u * 0.42,
      -L * u * 0.5,
      -W * u * 0.5,
      -L * u * 0.95,
      -W * u * 0.22,
      -L * u * 0.82,
      0,
      -L * u * 0.95,
      W * u * 0.22,
      -L * u * 0.5,
      W * u * 0.5,
      L * u * 0.05,
      W * u * 0.42,
    ]);
    solid(c, t);
    ellipse(c, -L * u * 0.38, 0, L * u * 0.3, W * u * 0.24);
    c.fillStyle = t.shade;
    c.fill();
    for (let i = -2; i <= 2; i++)
      line(c, t, [L * u * 0.15, i * u * 0.1, -L * u * 0.18, i * u * 0.26], 1.5);
    eyes(c, t, L * u * 0.28, u * 0.1, u * 0.06);
  },
};

/** Boss painters draw into a 256 px cell; `h` is half the figure's longest dimension. */
export const BOSS_FORMS: Record<BossArt['form'], (c: Ctx, t: Tone, h: number) => void> = {
  shuck(c, t, h) {
    // A great black hound: broad shoulders, spiked mane over the neck, burning eyes at the head.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.62 + i * 0.125);
      line(c, t, [h * 0.3, 0, h * 0.3 + Math.cos(a) * h * 0.5, Math.sin(a) * h * 0.42], 4);
    }
    FORMS.wolf(c, t, (h / UNIT) * 1.0, (h / UNIT) * 0.58);
  },
  bramble(c, t, h) {
    // A thorn mass with no facing; bright seam marks the vulnerable centre line.
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2,
        r = h * (i % 2 ? 0.98 : 0.78);
      line(
        c,
        t,
        [Math.cos(a) * h * 0.45, Math.sin(a) * h * 0.45, Math.cos(a) * r, Math.sin(a) * r],
        4,
      );
    }
    ellipse(c, 0, 0, h * 0.62, h * 0.56);
    solid(c, t);
    for (let i = 0; i < 7; i++) {
      ellipse(c, Math.cos(i * 2.3) * h * 0.32, Math.sin(i * 2.3) * h * 0.3, h * 0.16, h * 0.12, i);
      c.fillStyle = t.shade;
      c.fill();
    }
    c.fillStyle = t.eye;
    c.fillRect(-h * 0.56, -2, h * 1.12, 4);
  },
  hag(c, t, h) {
    // Tall hunched crone in a tattered cloak, claws forward.
    FORMS.hag(c, t, (h / UNIT) * 0.95, (h / UNIT) * 0.9);
    c.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 0.55 + (i / 14) * Math.PI * 0.9,
        r = h * (i % 2 ? 0.95 : 0.78);
      const x = Math.cos(a) * r * 0.85 - h * 0.1,
        y = Math.sin(a) * r * 0.75;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    solid(c, t, t.shade);
  },
  huntmaster(c, t, h) {
    // A cloaked archer under an antler crown with a great longbow.
    FORMS.archer(c, t, (h / UNIT) * 0.85, (h / UNIT) * 0.9);
    for (const s of [-1, 1]) {
      line(c, t, [h * 0.15, s * h * 0.12, h * 0.02, s * h * 0.42, h * 0.2, s * h * 0.62], 3);
      line(c, t, [h * 0.06, s * h * 0.3, h * 0.32, s * h * 0.36], 3);
      line(c, t, [h * 0.1, s * h * 0.5, -h * 0.12, s * h * 0.58], 3);
    }
  },
};
