import { it, expect } from 'vitest';
import { Hunt } from '../../src/sim/game';
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
