import { SpatialHash, GridFlowField } from '@slu/web-shell';
import { T } from '../data/tuning';
import { LANDMARKS } from '../data/world';
export interface Cover {
  x: number;
  y: number;
  r: number;
  kind: number;
}
export function makeWorld(random: () => number) {
  const obstacles: Cover[] = [];
  const hash = new SpatialHash<Cover>(160);
  const flow = new GridFlowField(150, 85, 100);
  for (let y = 200; y < T.worldHeight; y += 400)
    for (let x = 200; x < T.worldWidth; x += 400) {
      const ox = x + (random() - 0.5) * 220,
        oy = y + (random() - 0.5) * 220;
      if (Math.hypot(ox - 7500, oy - 4250) < 380) continue;
      const o = { x: ox, y: oy, r: 25 + random() * 20, kind: random() > 0.8 ? 1 : 0 };
      obstacles.push(o);
      hash.insert(o);
      const cx = Math.floor(ox / 100),
        cy = Math.floor(oy / 100);
      flow.blocked[cy * 150 + cx] = 1;
    }
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
  return { obstacles, hash, flow, landmarks };
}
export function blockedMove(
  body: { x: number; y: number },
  radius: number,
  hash: SpatialHash<Cover>,
) {
  hash.query(body.x, body.y, radius + 50, (o) => {
    const dx = body.x - o.x,
      dy = body.y - o.y,
      d = Math.hypot(dx, dy),
      r = radius + o.r;
    if (d < r) {
      body.x = o.x + (dx / (d || 1)) * r;
      body.y = o.y + (dy / (d || 1)) * r;
    }
  });
  body.x = Math.max(radius, Math.min(T.worldWidth - radius, body.x));
  body.y = Math.max(radius, Math.min(T.worldHeight - radius, body.y));
}
