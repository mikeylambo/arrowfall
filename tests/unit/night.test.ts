import { it, expect } from 'vitest';
import { Hunt } from '../../src/sim/game';
import { BOSSES } from '../../src/data/bosses';
import { freshProfile } from '../../src/sim/profile';
it('an unskipped fixed-tick night reaches dawn with all scheduled bosses', () => {
  const profile = freshProfile();
  profile.onboarded = true;
  const g = new Hunt(444, profile);
  g.god = true;
  const input = { mx: 0, my: 0, ax: 7900, ay: 4250, draw: true, dodge: false, deadeye: false };
  for (let tick = 0; tick < 75000 && !g.outcome; tick++) {
    input.mx = Math.cos(tick / 240);
    input.my = Math.sin(tick / 240);
    g.step(1 / 60, input);
    if (g.offers.length) {
      g.choiceGuard = 0;
      g.choose(0);
    }
    if (g.boss && g.boss.boss < 3 && g.time > g.boss.age + 90) {
      g.kill(g.boss);
      g.choiceGuard = 0;
      g.choose(0);
    }
  }
  expect(g.time).toBeGreaterThanOrEqual(1200);
  expect(g.outcome).toBe('Survived Until Dawn');
  expect(g.bossMask).toBe(15);
  expect(g.timeline.some((s) => s.includes('The Huntmaster'))).toBe(true);
}, 60000);
it('on the Full Moon every boss uses its extra attack; on the Crescent none do', () => {
  for (const phase of [0, 2]) {
    const named: string[] = [];
    for (let boss = 0; boss < 4; boss++) {
      const profile = freshProfile();
      profile.onboarded = true;
      const g = new Hunt(77, profile, 'recurve', phase);
      g.god = true;
      g.freezeSpawns = true;
      g.time = BOSSES[boss].time;
      g.spawnBoss(boss);
      // The Huntmaster's crosshatch lives in his second phase.
      const input = { mx: 1, my: 0, ax: 7900, ay: 4250, draw: false, dodge: false, deadeye: false };
      for (let tick = 0; tick < 60 * 30; tick++) {
        if (boss === 3 && tick === 60 * 15 && g.boss) g.boss.hp = g.boss.maxHp * 0.5;
        input.mx = Math.cos(tick / 90);
        input.my = Math.sin(tick / 90);
        g.step(1 / 60, input);
        g.cinematic = 0;
      }
      named.push(...g.fullMoonSeen);
    }
    if (phase === 0) expect(named).toEqual([]);
    else
      expect(named.sort()).toEqual(
        ['Crosshatch', 'Ghost Pack', 'Moonfall', 'Split Arrow', 'Thorn Bloom'].sort(),
      );
  }
});
