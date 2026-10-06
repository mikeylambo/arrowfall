import { it, expect } from 'vitest';
import { Hunt } from '../../src/sim/game';
import { freshProfile } from '../../src/sim/profile';
import { loose, damageEnemy, applyEvolutionRules, updateArrows } from '../../src/sim/combat';
import { BOSSES } from '../../src/data/bosses';
import { EVOLUTIONS } from '../../src/data/evolutions';
function fixture(id: string) {
  const g = new Hunt(313, freshProfile());
  g.freezeSpawns = true;
  const evo = EVOLUTIONS.find((e) => e.id === id)!;
  for (const ingredient of evo.ingredients) g.grant(ingredient);
  g.grant('evo:' + id);
  g.player.draw = 1;
  const e = g.spawn(0, 7880, 4250)!;
  e.hp = e.maxHp = 10000;
  const t = g.spawn(0, 7930, 4260)!;
  t.hp = t.maxHp = 10000;
  g.reindex();
  loose(g, true, 0);
  return { g, e, t, a: g.arrows.items.find((a) => a.active)! };
}
it('Barrage accumulates fan arrows across consecutive looses', () => {
  const { g } = fixture('barrage');
  const before = g.arrows.count;
  g.player.draw = 1;
  loose(g, true, 0);
  expect(g.arrows.count - before).toBe(3);
});
it('Worldpiercer grants infinite penetration to full arrows', () => {
  expect(fixture('worldpiercer').a.pierce).toBe(999);
});
it('Deadshot detonates a sweet-spot perfect hit', () => {
  const { g, e, t, a } = fixture('deadshot');
  damageEnemy(g, e, 100, a);
  expect(t.hp).toBeLessThan(10000);
});
it('Hellfire crit blasts apply burning status to nearby enemies', () => {
  const { g, e, t, a } = fixture('hellfire');
  damageEnemy(g, e, 100, a);
  expect(t.burn).toBe(2);
  expect(t.hp).toBeLessThan(10000);
});
it('Frostbite freezes full hits beyond the band', () => {
  const { g, e, a } = fixture('frostbite');
  e.x = 8500;
  damageEnemy(g, e, 100, a);
  expect(e.freeze).toBe(1.5);
});
it('Thunderstorm always chains and records secondary damage', () => {
  const { g, e, t, a } = fixture('thunderstorm');
  damageEnemy(g, e, 100, a);
  expect(t.hp).toBeLessThan(10000);
  expect(g.damageSources.thunderstorm).toBeGreaterThan(0);
});
it('Phantom Hunt dodge creates a four-second mirroring ghost', () => {
  const { g } = fixture('phantom-hunt');
  g.step(1 / 60, { mx: 1, my: 0, ax: 7900, ay: 4250, draw: false, dodge: true, deadeye: false });
  for (let i = 0; i < 4; i++)
    g.step(1 / 60, { mx: 0, my: 0, ax: 7900, ay: 4250, draw: false, dodge: false, deadeye: false });
  expect(g.ghosts.count).toBe(1);
  expect(g.ghosts.items[0].life).toBeGreaterThan(3.8);
});
it('Red Harvest infects neighbors when bleeding victims die', () => {
  const { g, e, t } = fixture('red-harvest');
  e.bleed = 3;
  applyEvolutionRules(g, 'kill', e, undefined, 0);
  expect(t.bleed).toBe(3);
});
it('Apex Hunter passes the Mark and grants its temporary bonus', () => {
  const { g, e, t } = fixture('apex-hunter');
  e.mark = true;
  e.active = false;
  applyEvolutionRules(g, 'kill', e, undefined, 0);
  expect(t.mark).toBe(true);
  expect(g.player.apex).toBe(5);
});
it('Heaven’s Volley perfect emits thirty-six rain arrows', () => {
  const { g } = fixture('heaven-s-volley');
  expect(g.arrows.items.filter((a) => a.active && a.source === 'rain')).toHaveLength(36);
});
it('Bramble King takes full damage only through its crown', () => {
  const hit = (dy: number) => {
    const g = new Hunt(313, freshProfile());
    g.freezeSpawns = true;
    g.spawnBoss(1);
    const boss = g.boss!;
    boss.root = 999;
    const before = boss.hp;
    const a = g.arrows.acquire()!;
    Object.assign(a, {
      x: boss.x - 120,
      y: boss.y + dy,
      vx: 800,
      vy: 0,
      life: 1,
      damage: 100,
      pierce: 0,
      perfect: false,
      full: false,
      crit: false,
      r: 3,
      source: 'bow',
      travel: 0,
      hitCount: 0,
    });
    g.reindex();
    for (let i = 0; i < 12 && a.active; i++) updateArrows(g, 1 / 60);
    return before - boss.hp;
  };
  const crown = hit(BOSSES[1].crown!.dy),
    body = hit(30);
  expect(crown).toBeGreaterThan(0);
  expect(body).toBeCloseTo(crown * 0.25, 0);
});
