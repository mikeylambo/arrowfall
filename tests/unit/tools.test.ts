import { it, expect } from 'vitest';
import { Hunt } from '../../src/sim/game';
import { freshProfile } from '../../src/sim/profile';
import { TOOLS, TOOL_STATS, toolEffectText } from '../../src/data/tools';
const input = { mx: 0, my: 0, ax: 7900, ay: 4250, draw: false, dodge: false, deadeye: false };

/** A quiet hunt with one enemy parked `dx` px to the hunter's right. */
function withEnemy(dx: number) {
  const g = new Hunt(7, freshProfile());
  g.freezeSpawns = true;
  g.god = true;
  for (const e of g.enemies.items) e.active = false;
  const e = g.spawn(0, g.player.x + dx, g.player.y)!;
  e.hp = e.maxHp = 1e6;
  e.speed = 0;
  return { g, e };
}

it('every tool card describes each of its five ranks', () => {
  for (const t of TOOLS) for (let r = 1; r <= 5; r++) expect(toolEffectText(t.id, r)).toMatch(/\d/);
  expect(toolEffectText('moonraven', 2)).toContain('→');
});

it('moonblades orbit the hunter and cut what they touch', () => {
  const { g, e } = withEnemy(TOOL_STATS.moonblades(1).orbit);
  g.grant('moonblades');
  for (let i = 0; i < 180; i++) g.step(1 / 60, input);
  expect(g.blades.length).toBe(TOOL_STATS.moonblades(1).blades);
  expect(e.hp).toBeLessThan(1e6);
  expect(g.damageSources.moonblades).toBeGreaterThan(0);
});

it('a volley totem is planted and shoots the nearest threat', () => {
  const { g } = withEnemy(300);
  g.grant('totem');
  for (let i = 0; i < 240; i++) g.step(1 / 60, input);
  expect(g.totems.length).toBe(1);
  expect(g.damageSources.totem).toBeGreaterThan(0);
});

it('frost ward slows and the horn throws enemies back', () => {
  const ward = withEnemy(100);
  ward.g.grant('frostward');
  ward.g.step(1 / 60, input);
  expect(ward.e.slow).toBeGreaterThan(0);
  const horn = withEnemy(100);
  horn.g.grant('horn');
  horn.g.step(1 / 60, input);
  expect(horn.e.x - horn.g.player.x).toBeGreaterThan(130);
});

it('a moon cache gives a card choice, a reroll or Moonsilver', () => {
  const outcomes = new Set<string>();
  for (let seed = 1; seed < 40; seed++) {
    const g = new Hunt(seed, freshProfile()),
      rerolls = g.rerolls,
      earned = g.earned;
    g.openCache();
    outcomes.add(
      g.offers.length
        ? 'cards'
        : g.rerolls > rerolls
          ? 'reroll'
          : g.earned > earned
            ? 'silver'
            : '?',
    );
  }
  expect([...outcomes].sort()).toEqual(['cards', 'reroll', 'silver']);
});
