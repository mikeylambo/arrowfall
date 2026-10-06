/**
 * Captures the readability evidence screenshots into evidence/.
 * Usage: npm run evidence   (CHROME_BIN may point at a Chromium binary)
 *
 * Each scene is driven through the dev API with a fixed seed and a scripted
 * autoplay, so the shots are reproducible rather than hand-timed.
 */
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const OUT = 'evidence';
fs.mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { port: 5199, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

async function fresh() {
  await page.goto('http://127.0.0.1:5199/?dev=1');
  await page.waitForFunction(() => window.__ARROWFALL__);
  await page.evaluate(() => {
    const api = window.__ARROWFALL__;
    api.setSeed(2026);
    api.startRun();
    const g = api.sim();
    g.profile.onboarded = true;
    g.god = true;
  });
}
/** Autoplay: aim at the nearest threat, draw into the perfect window, release, repeat. */
async function play(steps, opts = {}) {
  await page.evaluate(
    ({ steps, opts }) => {
      const api = window.__ARROWFALL__,
        g = api.sim();
      const input = { mx: 0, my: 0, ax: 0, ay: 0, draw: false, dodge: false, deadeye: false };
      for (let i = 0; i < steps; i++) {
        if (opts.fill) g.stressFill();
        let best = null,
          bestD = Infinity;
        for (const e of g.enemies.items)
          if (e.active) {
            const d = Math.hypot(e.x - g.player.x, e.y - g.player.y);
            if (d < bestD) {
              bestD = d;
              best = e;
            }
          }
        input.ax = best ? best.x : g.player.x + 300;
        input.ay = best ? best.y : g.player.y;
        input.mx = Math.sin(i / 90) * 0.6;
        input.my = Math.cos(i / 120) * 0.4;
        input.draw = g.player.draw < g.bow.draw + g.bow.window * 0.5;
        g.step(1 / 60, input);
        g.events.length = 0;
        if (g.offers.length) {
          g.choiceGuard = 0;
          g.choose(0);
        }
      }
      // Hold the frame: no further sim steps (and no level-up cards) while the shot settles.
      g.pendingLevels = 0;
      g.hitstop = 999;
      return api.state.enemies;
    },
    { steps, opts },
  );
  await page.waitForTimeout(900);
}
/** Park the sim mid-draw so the shot shows the bowstring tension. */
async function holdDraw(fraction) {
  await page.evaluate((fraction) => {
    const g = window.__ARROWFALL__.sim();
    g.player.draw = g.bow.draw * fraction;
    g.wasDraw = true;
  }, fraction);
  await page.waitForTimeout(700);
}
async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', `${OUT}/${name}.png`);
}

// Hunt: minute four, mixed roster, perfect-window draw on the string.
await fresh();
await page.evaluate(() => window.__ARROWFALL__.timeSkip(240));
await play(900);
await holdDraw(1.02);
await shot('hunt');

// Grayscale: the same hunt without hue.
await page.evaluate(() => window.__ARROWFALL__.grayscale(true));
await page.waitForTimeout(600);
await shot('grayscale');
await page.evaluate(() => window.__ARROWFALL__.grayscale(false));

// Deadeye: full Focus, enter, paint the nearest targets, capture mid-mark.
await page.evaluate(() => {
  const api = window.__ARROWFALL__,
    g = api.sim();
  g.hitstop = 0;
  g.player.draw = 0;
  g.player.focus = 100;
  const input = { mx: 0, my: 0, ax: 0, ay: 0, draw: false, dodge: false, deadeye: true };
  g.step(1 / 60, input);
  input.deadeye = false;
  const targets = g.enemies.items
    .filter((e) => e.active)
    .sort(
      (a, b) =>
        Math.hypot(a.x - g.player.x, a.y - g.player.y) -
        Math.hypot(b.x - g.player.x, b.y - g.player.y),
    )
    .slice(0, g.bow.marks);
  for (const t of targets)
    for (let k = 0; k < 4; k++) {
      input.ax = t.x;
      input.ay = t.y;
      g.step(1 / 60, input);
    }
  g.events.length = 0;
});
await page.waitForTimeout(900);
await shot('deadeye');

// Crowd: 350 enemies and 600 arrows after two seconds of pressure.
await fresh();
await page.evaluate(() => window.__ARROWFALL__.timeSkip(700));
await play(120, { fill: true });
const crowd = await page.evaluate(() => window.__ARROWFALL__.state);
await shot('crowd-350');
console.log('crowd', crowd.enemies, 'enemies', crowd.arrows, 'arrows');

// Bosses: each boss with its weak point.
for (let i = 0; i < 4; i++) {
  await fresh();
  await page.evaluate((i) => {
    const api = window.__ARROWFALL__,
      g = api.sim();
    g.freezeSpawns = true;
    g.eventX = g.player.x;
    g.eventY = g.player.y;
    api.boss(i);
  }, i);
  await play(150);
  await shot(`boss-${i}`);
}

await browser.close();
await server.close();
if (errors.length) {
  console.error('page errors:', errors);
  process.exit(1);
}
