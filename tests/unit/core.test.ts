import { describe, it, expect } from 'vitest';
import { BOWS } from '../../src/data/bows';
import { classifyDraw, drawProfile, drawDamage } from '../../src/sim/bow';
import { Hunt } from '../../src/sim/game';
import { freshProfile, loadProfile, saveProfile } from '../../src/sim/profile';
import { EVOLUTIONS } from '../../src/data/evolutions';
import { EntityPool, SpatialHash } from '@slu/web-shell';
import { Pool } from '../../src/sim/pool';
import { Grid } from '../../src/sim/grid';
const input = { mx: 0, my: 0, ax: 7900, ay: 4250, draw: false, dodge: false, deadeye: false };
describe('exact bow windows', () => {
  for (const b of BOWS)
    it(b.name, () => {
      const p = drawProfile(b);
      expect(classifyDraw(p.full - 0.001, p.full, p.window)).toBe('drawn');
      expect(classifyDraw(p.full, p.full, p.window)).toBe('perfect');
      expect(classifyDraw(p.full + p.window, p.full, p.window)).toBe('perfect');
      expect(classifyDraw(p.full + p.window + 0.001, p.full, p.window)).toBe('overdraw');
      expect(drawDamage(0, p.full)).toBe(0.4);
      expect(drawDamage(p.full, p.full)).toBe(1);
    });
});
it('seed and input replay deterministically', () => {
  const a = new Hunt(313, freshProfile()),
    b = new Hunt(313, freshProfile());
  for (let i = 0; i < 240; i++) {
    const x = { ...input, mx: 1, draw: i % 60 < 40 };
    a.step(1 / 60, x);
    b.step(1 / 60, x);
  }
  expect(a.player).toEqual(b.player);
  expect(a.enemies.items).toEqual(b.enemies.items);
  expect(a.world.obstacles).toEqual(b.world.obstacles);
});
it('dodge cancels a committed draw and travels 140 px', () => {
  const g = new Hunt(1, freshProfile());
  g.player.draw = 0.4;
  const x = g.player.x;
  g.step(1 / 60, { ...input, mx: 1, dodge: true });
  for (let i = 0; i < 10; i++) g.step(1 / 60, input);
  expect(g.player.draw).toBe(0);
  expect(g.player.invuln).toBeGreaterThan(0);
  expect(g.player.x - x).toBeCloseTo(140, 1);
});
it('perfect shot gains focus; hold auto-looses without claiming perfection', () => {
  const g = new Hunt(1, freshProfile());
  g.freezeSpawns = true;
  for (let i = 0; i < 37; i++) g.step(1 / 60, { ...input, draw: true });
  g.step(1 / 60, input);
  expect(g.perfects).toBe(1);
  expect(g.player.focus).toBe(12);
  const h = new Hunt(1, freshProfile());
  h.freezeSpawns = true;
  for (let i = 0; i < 120; i++) h.step(1 / 60, { ...input, draw: true });
  expect(h.shots).toBeGreaterThan(0);
  expect(h.perfects).toBe(0);
});
it('evolutions are offered and only selected evolutions apply', () => {
  const g = new Hunt(2, freshProfile());
  for (const e of EVOLUTIONS) {
    for (const id of e.ingredients) g.grant(id);
    expect(g.eligible().map((e) => e.id)).toContain(e.id);
  }
  g.offer();
  expect(g.offers.some((id) => id.startsWith('evo:'))).toBe(true);
  expect(g.evolutions.size).toBe(0);
  g.grant('evo:barrage');
  expect(g.evolutions.has('barrage')).toBe(true);
});
it('corrupt saves fall back and a valid save round-trips', () => {
  let value = 'garbage';
  const storage = {
    getItem: () => value,
    setItem: (_key: string, v: string) => {
      value = v;
    },
  };
  expect(loadProfile(storage)).toEqual(freshProfile());
  const p = freshProfile();
  p.kills = 312;
  p.currency = 500;
  expect(saveProfile(p, storage)).toBe(true);
  expect(loadProfile(storage)).toEqual(p);
});
it('pool reuses slots and hash finds local targets', () => {
  const pool = new EntityPool(2, () => ({ active: false, x: 0, y: 0 }));
  const a = pool.acquire()!;
  expect(pool.acquire()).toBeDefined();
  expect(pool.acquire()).toBeUndefined();
  a.active = false;
  expect(pool.acquire()).toBe(a);
  const hash = new SpatialHash(10);
  hash.insert(a);
  let found = 0;
  hash.query(0, 0, 2, () => found++);
  expect(found).toBe(1);
});
it('game pool resumes after the last slot and grid queries need no callbacks', () => {
  const pool = new Pool(3, () => ({ active: false, x: 0, y: 0 }));
  const a = pool.acquire()!,
    b = pool.acquire()!;
  a.active = false;
  expect(pool.acquire()).not.toBe(a);
  expect(pool.acquire()).toBe(a);
  expect(pool.acquire()).toBeUndefined();
  b.x = 205;
  b.y = 95;
  const grid = new Grid<{ active: boolean; x: number; y: number }>(1000, 1000, 50, 3);
  grid.rebuild(pool.items, (item) => item.x > 100);
  const out: { x: number; y: number }[] = [];
  expect(grid.query(200, 100, 10, out)).toBe(1);
  expect(out[0]).toBe(b);
  expect(grid.query(-500, -500, 10, out)).toBe(0);
});
it('director spawns outside the visible rectangle', () => {
  const g = new Hunt(3, freshProfile());
  for (let i = 0; i < 50; i++) {
    const e = g.spawn(0)!;
    expect(
      Math.abs(e.x - g.player.x) > g.viewport.width / 2 ||
        Math.abs(e.y - g.player.y) > g.viewport.height / 2,
    ).toBe(true);
  }
});
