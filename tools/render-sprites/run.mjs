/**
 * Renders character sprite sheets from art-source/sprites.json into public/art/sprites/.
 * Usage: node tools/render-sprites/run.mjs [characterId ...]   (CHROME_BIN selects Chromium)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const config = JSON.parse(fs.readFileSync('art-source/sprites.json', 'utf8'));
const only = process.argv.slice(2);
const OUT = 'public/art/sprites';
fs.mkdirSync(OUT, { recursive: true });
const server = await createServer({
  root: process.cwd(),
  server: { port: 5198, host: '127.0.0.1' },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
await page.goto('http://127.0.0.1:5198/tools/render-sprites/index.html');
await page.waitForFunction(() => window.renderJob);
try {
  // Variants (e.g. elites) re-render the same character with a different ink and brightness.
  const jobs = config.characters.flatMap((c) => [
    c,
    ...(c.variants ?? []).map((v) => ({
      ...c,
      ...v,
      id: `${c.id}-${v.suffix}`,
      variants: undefined,
    })),
  ]);
  for (const job of jobs) {
    if (only.length && !only.some((id) => job.id === id || job.id.startsWith(id + '-'))) continue;
    const t = Date.now();
    const result = await page.evaluate((job) => window.renderJob(job), {
      page: config.page,
      ...job,
    });
    result.pages.forEach((dataUrl, i) => {
      fs.writeFileSync(
        path.join(OUT, `${job.id}-${i}.png`),
        Buffer.from(dataUrl.split(',')[1], 'base64'),
      );
    });
    fs.writeFileSync(path.join(OUT, `${job.id}.json`), JSON.stringify(result.manifest, null, 2));
    const frames = Object.values(result.manifest.clips).reduce(
      (n, c) => n + c.frames * job.directions.length,
      0,
    );
    console.log(
      `${job.id}: ${frames} frames, ${result.pages.length} page(s), ${Date.now() - t} ms`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
