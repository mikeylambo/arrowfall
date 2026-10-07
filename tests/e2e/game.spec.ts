import { test, expect, type Page } from '@playwright/test';
async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?dev=1');
  await expect(page.getByRole('button', { name: 'Begin the Hunt', exact: true })).toBeVisible();
  return errors;
}
async function command(page: Page, code: string) {
  return page.evaluate(code);
}
test('boot, real shots, pause, cards, results, camp and save', async ({ page }) => {
  const errors = await boot(page);
  await page.screenshot({ path: 'test-results/title.png' });
  await page.getByRole('button', { name: 'Begin the Hunt', exact: true }).click();
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.scene')).toBe('hunt');
  await command(page, 'window.__ARROWFALL__.god()');
  await page.mouse.move(1070, 450);
  await page.mouse.down();
  await page.waitForTimeout(1400);
  await page.mouse.up();
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.shots')).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/hunt.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await command(page, 'window.__ARROWFALL__.xp(12)');
  // Cards follow the level-up surge (a short slow-motion beat), so allow for slow CI frames.
  await expect(page.getByText('Moonlight Answers')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/levelup.png' });
  await page.locator('[data-choice-id="pick:0"]').click();
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.offers.length')).toBe(0);
  await command(page, 'window.__ARROWFALL__.finish()');
  await expect(page.getByRole('button', { name: 'Hunt Again', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/results.png' });
  await page.getByRole('button', { name: 'Return to Camp', exact: true }).click();
  await expect(page.getByText('Hunter’s Camp', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/camp.png' });
  await page.getByRole('button', { name: 'The Range', exact: true }).click();
  await page.getByRole('button', { name: 'Free Practice', exact: true }).click();
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.scene')).toBe('range');
  await page.screenshot({ path: 'test-results/range.png' });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Return to the Hollowmoor' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('deadeye paints and releases a real volley', async ({ page }) => {
  const errors = await boot(page);
  await command(page, 'window.__ARROWFALL__.startRun({range:true})');
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.scene')).toBe('range');
  await command(page, 'window.__ARROWFALL__.focus()');
  await page.keyboard.press('e');
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.deadeye')).toBeGreaterThan(0);
  const target = await command(
    page,
    '(()=>{const api=window.__ARROWFALL__,g=api.sim(),s=api.state;return {x:s.width/2+(g.player.x+360-s.camera.x)*s.zoom,y:s.height/2+(g.player.y-s.camera.y)*s.zoom}})()',
  );
  await page.mouse.move(target.x, target.y);
  await page.waitForTimeout(250);
  await expect
    .poll(
      async () => {
        const s = await command(
          page,
          '(()=>{const a=window.__ARROWFALL__,g=a.sim(),s=a.state;return {...s,target:{x:s.width/2+(g.player.x+360-s.camera.x)*s.zoom,y:s.height/2+(g.player.y-s.camera.y)*s.zoom}}})()',
        );
        await page.mouse.move(s.target.x, s.target.y);
        return s.marks;
      },
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/deadeye.png' });
  await page.keyboard.press('e');
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.deadeye')).toBe(0);
  expect(errors).toEqual([]);
});
test('all four bosses spawn, take damage, change phase and die', async ({ page }) => {
  const errors = await boot(page);
  await command(page, 'window.__ARROWFALL__.startRun()');
  await command(page, 'window.__ARROWFALL__.god()');
  for (let i = 0; i < 4; i++) {
    await command(
      page,
      `window.__ARROWFALL__.timeSkip(${[300, 600, 900, 1140][i]});window.__ARROWFALL__.boss(${i})`,
    );
    await expect
      .poll(() => command(page, 'window.__ARROWFALL__.state.boss?.hp'))
      .toBeGreaterThan(0);
    await command(page, 'window.__ARROWFALL__.damageBoss()');
    await expect.poll(() => command(page, 'window.__ARROWFALL__.state.boss?.phase')).toBe(2);
    await page.screenshot({ path: `test-results/boss-${i}.png` });
    await command(page, 'window.__ARROWFALL__.killBoss()');
    await expect.poll(() => command(page, 'window.__ARROWFALL__.state.boss')).toBeNull();
    await command(page, 'window.__ARROWFALL__.choose(0)');
  }
  await expect(page.getByText('Hunt Complete', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('evolutions are selectable and emit damage/effect evidence', async ({ page }) => {
  const errors = await boot(page);
  await command(page, 'window.__ARROWFALL__.startRun({range:true})');
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.scene')).toBe('range');
  await command(
    page,
    `(()=>{const g=window.__ARROWFALL__.sim();g.unlockedAll=true;['fletcher-s-craft','quick-nock','piercer','longshaft','draw-strength','eagle-eye','broadhead','far-sight','ember-arrow','rupture','frost-arrow','storm-arrow','phantom-step','evasive-shot','windstep','barbed-arrow','blood-trail','executioner','hunter-s-mark','predator','chain-kill'].forEach(x=>g.grant(x));['barrage','worldpiercer','deadshot','hellfire','frostbite','thunderstorm','phantom-hunt','red-harvest','apex-hunter','heaven-s-volley'].forEach(x=>g.grant('evo:'+x));})()`,
  );
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.evolutions.length')).toBe(10);
  await page.mouse.move(1080, 450);
  await page.mouse.down();
  await page.waitForTimeout(2400);
  await page.mouse.up();
  // Let the release land on its own frame; a dodge in the same frame cancels the draw.
  await expect.poll(() => command(page, 'window.__ARROWFALL__.state.shots')).toBeGreaterThan(0);
  await page.keyboard.press('Space');
  await expect
    .poll(() => command(page, 'window.__ARROWFALL__.sim().player.cooldown'))
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/evolutions.png' });
  expect(errors).toEqual([]);
});
