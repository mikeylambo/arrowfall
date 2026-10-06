import { test, expect } from '@playwright/test';
import fs from 'node:fs';

/** Stress gate: 350 enemies / 600 arrows, simulation p99 must stay under this budget. */
const SIM_P99_BUDGET_MS = 12;
const FRAMES = 600;

test('350-enemy / 600-arrow stress scene stays inside the simulation budget', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?dev=1');
  await page.waitForFunction(() => (window as any).__ARROWFALL__);
  const filled = await page.evaluate(() => {
    const api = (window as any).__ARROWFALL__;
    api.startRun();
    api.stress();
    return { enemies: api.state.enemies, arrows: api.state.arrows };
  });
  expect(filled).toEqual({ enemies: 350, arrows: 600 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/stress.png' });
  // Ground + fog + vignette must stay inside 1 ms of CPU per frame at stress load.
  const frameTiming = await page.evaluate(() => (window as any).__ARROWFALL__.state.timing);
  expect(frameTiming.atmosphere).toBeLessThan(1);
  const metrics = await page.evaluate(
    ({ frames, frameTiming }) => {
      const api = (window as any).__ARROWFALL__,
        g = api.sim();
      for (const id of [
        'fletcher-s-craft',
        'piercer',
        'ember-arrow',
        'barbed-arrow',
        'storm-arrow',
      ])
        g.grant(id);
      const times: number[] = [];
      let enemies = 0,
        arrows = 0;
      const input = { mx: 1, my: 0, ax: 0, ay: 0, draw: true, dodge: false, deadeye: false };
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
        if (i < 120) continue;
        times.push(dt);
        for (const e of g.enemies.items) if (e.active) enemies++;
        for (const a of g.arrows.items) if (a.active) arrows++;
      }
      times.sort((a, b) => a - b);
      return {
        frames,
        avgEnemies: Math.round(enemies / frames),
        avgArrows: Math.round(arrows / frames),
        simulationP99Ms: times[Math.floor(times.length * 0.99)],
        simulationP50Ms: times[Math.floor(times.length * 0.5)],
        simulationMeanMs: times.reduce((a, b) => a + b, 0) / times.length,
        renderer: 'Chromium software WebGL; not target-device certification',
        frameTiming,
      };
    },
    { frames: FRAMES, frameTiming },
  );
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/performance.json', JSON.stringify(metrics, null, 2));
  console.log('stress gate', JSON.stringify(metrics));
  expect(errors).toEqual([]);
  expect(metrics.avgEnemies).toBeGreaterThanOrEqual(330);
  expect(metrics.avgArrows).toBeGreaterThanOrEqual(560);
  expect(metrics.simulationP99Ms).toBeLessThan(SIM_P99_BUDGET_MS);
});
