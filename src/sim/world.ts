import { GridFlowField } from '@slu/web-shell';
import { Grid } from './grid';
import { T, len } from '../data/tuning';
import { LANDMARKS } from '../data/world';
export interface Cover {
  x: number;
  y: number;
  r: number;
  kind: number;
}
/**
 * Cover kinds: 0 tree, 1 standing stone, 2 barrow mound, 3 dead tree, 4 ruined wall,
 * 5 watchtower base, 6 shrine, 7 moonwell. All block movement and arrows.
 */
export const COVER = {
  tree: 0,
  stone: 1,
  mound: 2,
  dead: 3,
  wall: 4,
  tower: 5,
  shrine: 6,
  well: 7,
};
export function makeWorld(random: () => number) {
  const obstacles: Cover[] = [];
  const flow = new GridFlowField(150, 85, 100);
  const block = (o: Cover) => {
    obstacles.push(o);
    // Block every flow cell the cover overlaps, so paths route around big pieces too.
    for (let y = Math.floor((o.y - o.r) / 100); y <= Math.floor((o.y + o.r) / 100); y++)
      for (let x = Math.floor((o.x - o.r) / 100); x <= Math.floor((o.x + o.r) / 100); x++)
        if (
          x >= 0 &&
          y >= 0 &&
          x < 150 &&
          y < 85 &&
          len(x * 100 + 50 - o.x, y * 100 + 50 - o.y) < o.r + 30
        )
          flow.blocked[y * 150 + x] = 1;
  };
  // Landmarks first (GDD 11): fixed set, shuffled into authored slots per seed.
  const slots = [
    { x: 7500, y: 4250 },
    { x: 5300, y: 2800 },
    { x: 9100, y: 2500 },
    { x: 4100, y: 4700 },
    { x: 10500, y: 5200 },
    { x: 6400, y: 6500 },
    { x: 9400, y: 7000 },
    { x: 7200, y: 1600 },
  ];
  for (let i = slots.length - 1; i > 1; i--) {
    const j = 1 + Math.floor(random() * i);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const landmarks = LANDMARKS.map((name, i) => ({ ...slots[i], name }));
  const [well, stones, lodge, grove, tower, , mounds, shrine] = landmarks;
  block({ x: well.x, y: well.y - 170, r: 34, kind: COVER.well });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    block({
      x: stones.x + Math.cos(a) * 220,
      y: stones.y + Math.sin(a) * 220,
      r: 26 + random() * 8,
      kind: COVER.stone,
    });
  }
  // Old Lodge: four broken walls (a doorway in each) around a 380 x 280 floor.
  const W = 190,
    H = 140;
  for (const [x0, y0, x1, y1] of [
    [-W, -H, W, -H],
    [W, -H, W, H],
    [W, H, -W, H],
    [-W, H, -W, -H],
  ]) {
    const n = Math.round(len(x1 - x0, y1 - y0) / 38);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (t > 0.38 && t < 0.62) continue;
      if (random() < 0.18) continue;
      block({
        x: lodge.x + x0 + (x1 - x0) * t,
        y: lodge.y + y0 + (y1 - y0) * t,
        r: 22,
        kind: COVER.wall,
      });
    }
  }
  for (let i = 0, tries = 0; i < 16 && tries < 200; tries++) {
    const a = random() * Math.PI * 2,
      r = 60 + random() * 300,
      o = {
        x: grove.x + Math.cos(a) * r,
        y: grove.y + Math.sin(a) * r,
        r: 20 + random() * 10,
        kind: COVER.dead,
      };
    if (obstacles.some((q) => len(q.x - o.x, q.y - o.y) < q.r + o.r + 38)) continue;
    block(o);
    i++;
  }
  block({ x: tower.x, y: tower.y, r: 56, kind: COVER.tower });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + random();
    block({
      x: mounds.x + Math.cos(a) * 190,
      y: mounds.y + Math.sin(a) * 150,
      r: 64,
      kind: COVER.mound,
    });
  }
  block({ x: shrine.x, y: shrine.y - 40, r: 30, kind: COVER.shrine });
  // Groves of trees and stones elsewhere, with the landmarks left clear.
  for (let y = 200; y < T.worldHeight; y += 400)
    for (let x = 200; x < T.worldWidth; x += 400) {
      const ox = x + (random() - 0.5) * 220,
        oy = y + (random() - 0.5) * 220,
        r = 25 + random() * 20,
        kind = random() > 0.8 ? COVER.stone : COVER.tree;
      if (landmarks.some((l) => len(ox - l.x, oy - l.y) < 430)) continue;
      block({ x: ox, y: oy, r, kind });
    }
  const hash = new Grid<Cover>(T.worldWidth, T.worldHeight, 160, obstacles.length);
  hash.rebuild(obstacles);
  return { obstacles, hash, flow, landmarks };
}
const nearCover: Cover[] = [];
export function blockedMove(body: { x: number; y: number }, radius: number, hash: Grid<Cover>) {
  const n = hash.query(body.x, body.y, radius + 80, nearCover);
  for (let i = 0; i < n; i++) {
    const o = nearCover[i],
      dx = body.x - o.x,
      dy = body.y - o.y,
      d = len(dx, dy),
      r = radius + o.r;
    if (d < r) {
      body.x = o.x + (dx / (d || 1)) * r;
      body.y = o.y + (dy / (d || 1)) * r;
    }
  }
  body.x = Math.max(radius, Math.min(T.worldWidth - radius, body.x));
  body.y = Math.max(radius, Math.min(T.worldHeight - radius, body.y));
}
