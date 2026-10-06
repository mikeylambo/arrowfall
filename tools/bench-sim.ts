/**
 * Headless simulation benchmark for the 350-enemy / 600-arrow stress scene.
 * Usage: npx vite-node tools/bench-sim.ts [frames]
 */
import { Hunt } from '../src/sim/game';
import { freshProfile } from '../src/sim/profile';

const frames = Number(process.argv[2] ?? 1200);
const g = new Hunt(2026, freshProfile());
g.unlockedAll = true;
for (const id of ['fletcher-s-craft', 'piercer', 'ember-arrow', 'barbed-arrow', 'storm-arrow'])
  g.grant(id);
g.stressFill();
const input = {
  mx: 1,
  my: 0,
  ax: g.player.x + 500,
  ay: g.player.y,
  draw: true,
  dodge: false,
  deadeye: false,
};
const times: number[] = [];
let enemies = 0,
  arrows = 0;
for (let i = 0; i < frames + 120; i++) {
  g.stressFill();
  input.ax = g.player.x + 500;
  input.ay = g.player.y;
  const t = performance.now();
  g.step(1 / 60, input);
  const dt = performance.now() - t;
  g.events.length = 0; // the frame loop drains events every frame
  if (g.offers.length) {
    g.choiceGuard = 0;
    g.choose(0);
  }
  if (i < 120) continue; // warm-up (JIT)
  times.push(dt);
  enemies += g.enemies.items.filter((e) => e.active).length;
  arrows += g.arrows.items.filter((a) => a.active).length;
}
times.sort((a, b) => a - b);
const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(times.length * q))];
console.log(
  JSON.stringify({
    frames,
    meanMs: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(3),
    p50Ms: +pct(0.5).toFixed(3),
    p99Ms: +pct(0.99).toFixed(3),
    maxMs: +pct(1).toFixed(3),
    avgEnemiesAfterStep: Math.round(enemies / frames),
    avgArrowsAfterStep: Math.round(arrows / frames),
  }),
);
