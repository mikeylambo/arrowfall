import { test, expect } from '@playwright/test';
test('playtest kit records a run with notes and exports a report', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?dev=1&playtest=Test%20Rig');
  await expect(page.getByRole('button', { name: 'Begin the Hunt', exact: true })).toBeVisible();
  await expect(page.locator('#playtest-note')).toBeVisible();
  await page.evaluate(() => {
    const api = (window as any).__ARROWFALL__;
    api.patchProfile({ onboarded: true });
    api.startRun();
  });
  await expect.poll(() => page.evaluate('window.__ARROWFALL__.state.scene')).toBe('hunt');
  await page.evaluate('window.__ARROWFALL__.god()');
  await page.waitForTimeout(1500);
  // A typed note: the hunt pauses while the box is open, and keys never reach the game.
  await page.keyboard.press('KeyN');
  const box = page.locator('.playtest-note input');
  await expect(box).toBeFocused();
  const before = await page.evaluate('window.__ARROWFALL__.sim().time');
  await box.fill('wasd typed here should not move');
  await page.waitForTimeout(300);
  expect(await page.evaluate('window.__ARROWFALL__.sim().time')).toBe(before);
  await box.press('Enter');
  await expect(box).toHaveCount(0);
  // A tapped marker from the on-screen button, cancelled with Escape: nothing saved.
  await page.locator('#playtest-note').click();
  await page.locator('.playtest-note input').press('Escape');
  await page.evaluate('window.__ARROWFALL__.finish()');
  await expect(page.getByRole('button', { name: 'Hunt Again', exact: true })).toBeVisible();
  const run = await page.evaluate(() =>
    (window as any).__ARROWFALL__.playtest().session.runs.at(-1),
  );
  expect(run.partial).toBeUndefined();
  expect(run.notes.map((n: { text: string }) => n.text)).toEqual([
    'wasd typed here should not move',
  ]);
  // Software WebGL in CI renders only a few frames a second.
  expect(run.frames.count).toBeGreaterThan(0);
  expect(run.frames.p50).toBeGreaterThan(0);
  expect(Object.keys(run.input)).toContain('keyboard');
  // The report screen, from results; copy puts summary and JSON on the clipboard.
  await page.getByRole('button', { name: /Playtest Report/ }).click();
  await expect(page.getByText('Test Rig · 1 runs · 1 notes', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Copy Report/ }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('# Arrowfall playtest — Test Rig');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('wasd typed here should not move');
  expect(text).toContain('```json');
  // Back returns to the results screen.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Hunt Again', exact: true })).toBeVisible();
  // The session survives a reload; ?playtest=0 turns the kit off.
  await page.goto('/?dev=1');
  await page.waitForFunction(() => (window as any).__ARROWFALL__);
  expect(
    await page.evaluate(() => (window as any).__ARROWFALL__.playtest()?.session.runs.length),
  ).toBe(1);
  await page.goto('/?dev=1&playtest=0');
  await expect(page.getByRole('button', { name: /Hollowmoor|Begin/ })).toBeVisible();
  await expect(page.locator('#playtest-note')).toBeHidden();
  expect(errors).toEqual([]);
});
test.describe('on a phone', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('the note button takes a note by touch during a hunt', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?dev=1&playtest=Phone');
    await page.waitForFunction(() => (window as any).__ARROWFALL__);
    await page.evaluate(() => {
      const api = (window as any).__ARROWFALL__;
      api.patchProfile({ onboarded: true });
      api.startRun();
    });
    await expect.poll(() => page.evaluate('window.__ARROWFALL__.state.scene')).toBe('hunt');
    await page.locator('#playtest-note').tap();
    await page.locator('.playtest-note input').fill('boss too fast on phone');
    await page.locator('.playtest-note input').press('Enter');
    const notes = await page.evaluate(() => (window as any).__ARROWFALL__.playtest().run.notes);
    expect(notes[0].text).toBe('boss too fast on phone');
    expect(notes[0].device).toBe('touch');
    expect(errors).toEqual([]);
  });
});
test('the gamepad Back button drops a marker', async ({ page }) => {
  // A stand-in pad: button 8 (Back / View) follows window.__back.
  await page.addInitScript(() => {
    const w = window as any;
    w.__back = false;
    const buttons = () =>
      Array.from({ length: 17 }, (_, i) => ({ pressed: i === 8 && w.__back, value: 0 }));
    Object.defineProperty(navigator, 'getGamepads', {
      value: () => [{ id: 'Test Pad', axes: [0, 0, 0, 0], buttons: buttons(), connected: true }],
    });
  });
  await page.goto('/?dev=1&playtest=Pad');
  await page.waitForFunction(() => (window as any).__ARROWFALL__);
  await page.evaluate(() => {
    const api = (window as any).__ARROWFALL__;
    api.patchProfile({ onboarded: true });
    api.startRun();
  });
  await expect.poll(() => page.evaluate('window.__ARROWFALL__.state.scene')).toBe('hunt');
  await page.evaluate(() => ((window as any).__back = true));
  await expect
    .poll(() => page.evaluate(() => (window as any).__ARROWFALL__.playtest().run.notes.length))
    .toBe(1);
  await page.evaluate(() => ((window as any).__back = false));
  const note = await page.evaluate(() => (window as any).__ARROWFALL__.playtest().run.notes[0]);
  expect(note.text).toBe('(marker)');
});
