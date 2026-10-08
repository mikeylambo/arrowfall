/**
 * The Hollowmoor's places (GDD 11): baked landmark art, worn paths between landmarks, name
 * plates that fade in nearby, and the light sources that sit in the world (moonwell, shrine).
 * Everything here is static per hunt except the plates; it is built once in attach().
 */
import { Container, Graphics, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import { softDisc, type GptArt } from './gptArt';
import type { Hunt } from '../sim/game';

type Ctx = CanvasRenderingContext2D;
const INK = '#050912',
  BODY = '#101c2d',
  RIM = '#3a4f6a',
  MOON = '#c4d4ff';

function canvas(w: number, h: number, draw: (c: Ctx) => void) {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const c = el.getContext('2d')!;
  c.translate(w / 2, h / 2);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  return Texture.from(el);
}
function blob(c: Ctx, pts: number[], fill: string, rim = RIM, width = 2) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = width + 2;
  c.stroke();
  c.strokeStyle = rim;
  c.lineWidth = width;
  c.stroke();
}
function shadow(c: Ctx, w: number, h: number, dx = 10, dy = 12) {
  c.save();
  c.fillStyle = 'rgba(2,4,9,0.55)';
  c.filter = 'blur(8px)';
  c.beginPath();
  c.ellipse(dx, dy, w, h, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Landmark and cover textures. */
export function landmarkArt() {
  return {
    well: canvas(160, 160, (c) => {
      shadow(c, 58, 50);
      // Ring of stones around a pool of moonlight.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        c.save();
        c.translate(Math.cos(a) * 46, Math.sin(a) * 40);
        c.rotate(a);
        blob(c, [-10, -9, 9, -10, 11, 8, -9, 10], BODY);
        c.restore();
      }
      const g = c.createRadialGradient(0, 0, 4, 0, 0, 38);
      g.addColorStop(0, '#e8eeff');
      g.addColorStop(0.4, '#8fa8e0');
      g.addColorStop(1, '#1b2a48');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, 36, 31, 0, 0, Math.PI * 2);
      c.fill();
    }),
    dead: canvas(128, 128, (c) => {
      shadow(c, 34, 22);
      // A bare, twisted dead tree seen from above: trunk knot and reaching branches.
      c.strokeStyle = INK;
      c.lineWidth = 9;
      const branches = [
        [0, 0, -38, -30, -52, -18],
        [0, 0, 34, -36, 50, -44],
        [0, 0, 40, 18, 54, 34],
        [0, 0, -30, 34, -44, 52],
        [0, 0, 6, -50, -4, -58],
      ];
      for (const [x0, y0, cx, cy, x1, y1] of branches) {
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(cx, cy, x1, y1);
        c.stroke();
      }
      c.strokeStyle = '#1d2a3c';
      c.lineWidth = 5;
      for (const [x0, y0, cx, cy, x1, y1] of branches) {
        c.beginPath();
        c.moveTo(x0, y0);
        c.quadraticCurveTo(cx, cy, x1, y1);
        c.stroke();
      }
      c.strokeStyle = RIM;
      c.lineWidth = 1.5;
      for (const [x0, y0, cx, cy, x1, y1] of branches.slice(0, 2)) {
        c.beginPath();
        c.moveTo(x0 - 2, y0 - 2);
        c.quadraticCurveTo(cx - 2, cy - 2, x1 - 2, y1 - 2);
        c.stroke();
      }
      blob(c, [-12, -10, 11, -12, 13, 9, -10, 12], '#141f30');
    }),
    menhir: canvas(96, 96, (c) => {
      shadow(c, 30, 22, 8, 10);
      // A weathered standing stone from above: lumpy top, chipped edge, a faint moon rune.
      // Rounded, uneven outline (smoothed through jittered points) so it reads as rock.
      const r = [27, 24, 29, 22, 26, 28, 21, 25, 28, 23, 26, 24];
      c.beginPath();
      for (let i = 0; i <= r.length; i++) {
        const a0 = (i / r.length) * Math.PI * 2,
          a1 = ((i + 0.5) / r.length) * Math.PI * 2,
          x0 = Math.cos(a0) * r[i % r.length],
          y0 = Math.sin(a0) * r[i % r.length] * 0.9,
          x1 = Math.cos(a1) * r[(i + 1) % r.length],
          y1 = Math.sin(a1) * r[(i + 1) % r.length] * 0.9;
        if (i === 0) c.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
        else c.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      }
      c.closePath();
      c.fillStyle = '#121e30';
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4.5;
      c.stroke();
      c.strokeStyle = '#4a5e78';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#18263b';
      c.beginPath();
      c.ellipse(-4, -6, 15, 12, -0.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(196,212,255,0.28)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(2, 2, 7, Math.PI * 0.4, Math.PI * 1.6);
      c.stroke();
      c.strokeStyle = '#24344a';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(12, -18);
      c.lineTo(17, -4);
      c.moveTo(-18, 10);
      c.lineTo(-9, 18);
      c.stroke();
    }),
    wall: canvas(64, 64, (c) => {
      shadow(c, 22, 14, 6, 8);
      blob(c, [-22, -14, 20, -16, 22, 12, -20, 15], BODY, '#46596f');
      c.strokeStyle = '#26364c';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-20, -1);
      c.lineTo(21, -2);
      c.moveTo(-2, -15);
      c.lineTo(-1, -1);
      c.moveTo(8, -1);
      c.lineTo(9, 13);
      c.stroke();
    }),
    tower: canvas(176, 176, (c) => {
      shadow(c, 70, 60, 14, 16);
      // Octagonal stone base with a broken parapet ring.
      const pts: number[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        pts.push(Math.cos(a) * 62, Math.sin(a) * 62);
      }
      blob(c, pts, BODY, '#4b6079', 3);
      c.strokeStyle = '#26364c';
      c.lineWidth = 6;
      c.beginPath();
      c.arc(0, 0, 44, 0.3, Math.PI * 1.6);
      c.stroke();
      c.fillStyle = '#070c16';
      c.beginPath();
      c.arc(0, 0, 30, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(196,212,255,0.08)';
      c.beginPath();
      c.arc(-6, -6, 22, 0, Math.PI * 2);
      c.fill();
    }),
    mound: canvas(200, 170, (c) => {
      shadow(c, 80, 60, 12, 14);
      const g = c.createRadialGradient(-20, -24, 6, 0, 0, 80);
      g.addColorStop(0, '#1d2d44');
      g.addColorStop(1, '#0b1424');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, 76, 62, -0.2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 4;
      c.stroke();
      c.strokeStyle = '#33465f';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(0, 0, 76, 62, -0.2, Math.PI * 1.0, Math.PI * 1.55);
      c.stroke();
      // A dark barrow mouth and a red-eyed nothing inside.
      blob(c, [10, 22, 34, 18, 38, 40, 14, 44], '#04070d', '#2a3a52');
    }),
    shrine: canvas(128, 128, (c) => {
      shadow(c, 40, 30);
      blob(c, [-34, 16, 34, 16, 30, 30, -30, 30], BODY, '#4b6079');
      blob(c, [-20, -34, 20, -34, 24, 18, -24, 18], '#132136', '#5a7090');
      // The Silver Order's crescent, carved and faintly lit.
      c.strokeStyle = MOON;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, -8, 12, Math.PI * 0.35, Math.PI * 1.65);
      c.stroke();
    }),
    mire: canvas(640, 420, (c) => {
      // Shallow black water with a moon sheen and reed tufts at the edge.
      const g = c.createRadialGradient(-60, -50, 20, 0, 0, 300);
      g.addColorStop(0, 'rgba(62,86,130,0.75)');
      g.addColorStop(0.5, 'rgba(18,30,54,0.85)');
      g.addColorStop(1, 'rgba(6,10,20,0)');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0, 0, 300, 190, 0.15, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(196,212,255,0.12)';
      c.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.ellipse(-80 + i * 22, -40 + (i % 3) * 30, 40 + i * 4, 6, 0.15, 0, Math.PI);
        c.stroke();
      }
      c.strokeStyle = '#1a2a40';
      c.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2,
          x = Math.cos(a) * 270,
          y = Math.sin(a) * 170;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a + 1.2) * 10, y - 16);
        c.stroke();
      }
    }),
    floor: canvas(420, 320, (c) => {
      // The lodge's old floorboards, broken and overgrown.
      c.fillStyle = 'rgba(20,30,46,0.55)';
      c.fillRect(-190, -140, 380, 280);
      c.strokeStyle = 'rgba(58,79,106,0.35)';
      c.lineWidth = 2;
      for (let x = -190; x <= 190; x += 30) {
        c.beginPath();
        c.moveTo(x, -140 + ((x * 7) % 40));
        c.lineTo(x, 140 - ((x * 11) % 50));
        c.stroke();
      }
      c.fillStyle = 'rgba(6,10,20,0.6)';
      c.beginPath();
      c.ellipse(40, 20, 70, 44, 0.4, 0, Math.PI * 2);
      c.fill();
    }),
  };
}

const PLATE = {
  fontFamily: 'Georgia',
  fontSize: 22,
  fill: 0xdbeaff,
  letterSpacing: 2,
  stroke: { color: 0x05080f, width: 4 },
};

export class WorldDressing {
  /** Below cover: paths, the Mire's water, the lodge floor. */
  readonly ground = new Container();
  /** Above actors: name plates. */
  readonly plates = new Container();
  private readonly plateText: Text[] = [];
  /** Painted ground tiles (render/gptArt.ts); null keeps the procedural paths and floors. */
  painted: GptArt | null = null;
  constructor(private readonly art: Record<string, Texture>) {}
  /** A patch of a painted tile around a landmark, fading into the moor at its edge. */
  private region(tile: Texture, x: number, y: number, r: number) {
    const patch = new TilingSprite({ texture: tile, width: r * 2, height: r * 2 });
    patch.tileScale.set(0.5);
    patch.position.set(x - r, y - r);
    // Tile in world space so neighbouring patches and the moor line up.
    patch.tilePosition.set(-(x - r), -(y - r));
    const mask = new Sprite(softDisc());
    mask.position.set(x - r, y - r);
    mask.width = mask.height = r * 2;
    patch.mask = mask;
    this.ground.addChild(patch, mask);
  }
  clear() {
    this.ground.removeChildren().forEach((c) => c.destroy());
    this.plates.removeChildren().forEach((c) => c.destroy());
    this.plateText.length = 0;
  }
  build(g: Hunt) {
    this.clear();
    const L = g.world.landmarks;
    // Worn paths: a ring through the landmarks from the Moonwell, gently curved.
    const order = [0];
    while (order.length < L.length) {
      const last = L[order[order.length - 1]];
      let best = -1,
        bestD = Infinity;
      for (let i = 0; i < L.length; i++)
        if (!order.includes(i)) {
          const d = Math.hypot(L[i].x - last.x, L[i].y - last.y);
          if (d < bestD) {
            best = i;
            bestD = d;
          }
        }
      order.push(best);
    }
    const P = this.painted?.ground;
    // Each landmark's ground: moss under the Dead Grove, bog under the Mire, stony burial
    // ground under the Barrows, trampled earth inside the Lodge.
    if (P) {
      this.region(P.moss, L[3].x, L[3].y, 560);
      this.region(P.mire, L[5].x, L[5].y, 380);
      this.region(P.mire, L[5].x, L[5].y, 300);
      this.region(P.barrow, L[6].x, L[6].y, 480);
      this.region(P.camp, L[2].x, L[2].y, 300);
    }
    const paths = new Graphics();
    for (const [w, color, alpha] of (P
      ? [[96, 0x0d1626, 0.5]]
      : [
          [86, 0x0d1626, 0.55],
          [54, 0x18263b, 0.45],
        ]) as [number, number, number][]) {
      for (let k = 0; k < order.length; k++) {
        const a = L[order[k]],
          b = L[order[(k + 1) % order.length]],
          mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.15,
          my = (a.y + b.y) / 2 - (b.x - a.x) * 0.15;
        paths.moveTo(a.x, a.y).quadraticCurveTo(mx, my, b.x, b.y);
      }
      paths.stroke({ color, width: w, alpha, cap: 'round' });
    }
    if (P)
      for (let k = 0; k < order.length; k++) {
        const a = L[order[k]],
          b = L[order[(k + 1) % order.length]],
          mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.15,
          my = (a.y + b.y) / 2 - (b.x - a.x) * 0.15;
        paths.moveTo(a.x, a.y).quadraticCurveTo(mx, my, b.x, b.y);
        // The painted footpath, laid in world space so it runs on without seams.
        paths.stroke({
          texture: P.path,
          textureSpace: 'global',
          width: 64,
          alpha: 0.85,
          cap: 'round',
        });
      }
    this.ground.addChild(paths);
    const mire = new Sprite(this.art.mire);
    if (P) mire.alpha = 0.55;
    mire.anchor.set(0.5);
    mire.position.set(L[5].x, L[5].y);
    const floor = new Sprite(this.art.floor);
    floor.anchor.set(0.5);
    floor.position.set(L[2].x, L[2].y);
    this.ground.addChild(mire, floor);
    for (const l of L) {
      const t = new Text({ text: l.name.toUpperCase(), style: PLATE });
      t.anchor.set(0.5);
      t.position.set(l.x, l.y - 250);
      t.alpha = 0;
      this.plates.addChild(t);
      this.plateText.push(t);
    }
  }
  /** Name plates fade in as the hunter approaches each landmark. */
  update(g: Hunt) {
    const p = g.player,
      L = g.world.landmarks;
    for (let i = 0; i < this.plateText.length; i++) {
      const d = Math.hypot(L[i].x - p.x, L[i].y - p.y);
      this.plateText[i].alpha = Math.max(0, Math.min(0.85, (900 - d) / 400));
      this.plateText[i].visible = this.plateText[i].alpha > 0;
    }
  }
}
