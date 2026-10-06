import type { Hunt } from './game';
import type { Enemy, Arrow } from './types';
import { T, distance } from '../data/tuning';
import { drawProfile, drawDamage } from './bow';
export function loose(
  g: Hunt,
  perfect: boolean,
  angle: number,
  source = 'bow',
  multiplier = 1,
  countShot = true,
) {
  const p = g.player,
    profile = drawProfile(
      g.bow,
      g.rank('quick-nock'),
      g.rank('steady-hand'),
      g.rank('heavy-bow'),
      g.rank('swift-bow'),
    );
  const full = p.draw >= profile.full || source !== 'bow',
    crit =
      perfect ||
      g.rng.next() < 0.05 + 0.05 * g.rank('eagle-eye') + 0.03 * (g.profile.boons['Keen Eye'] || 0);
  let damage =
    T.damage *
    (countShot ? drawDamage(p.draw, profile.full) : 1) *
    (1 +
      0.12 * g.rank('draw-strength') +
      0.04 * (g.profile.boons.Might || 0) +
      0.25 * g.rank('heavy-bow'));
  damage *= crit ? (perfect && g.bow.id === 'letoff' ? 3 : 2) + 0.2 * g.rank('broadhead') : 1;
  damage *= 1 + 0.04 * g.chain + (p.apex > 0 ? 0.15 : 0);
  damage *= multiplier;
  if (g.rank('last-arrow') && (g.shots + 1) % 10 === 0) damage *= 3;
  if (countShot) {
    g.shots++;
    if (perfect) {
      g.perfects++;
      p.streak++;
      g.maxStreak = Math.max(g.maxStreak, p.streak);
      p.focus = Math.min(100, p.focus + 12 * (1 + 0.25 * g.rank('moonwell')));
      g.emit('bow.perfect');
      g.hitstop = 0.04;
      g.burst(p.x, p.y, 18);
      g.flash = 0.15;
    } else {
      p.streak = 0;
      g.emit(full ? 'bow.full' : 'bow.quick');
    }
    if (g.rank('windstep')) p.wind = 1;
  }
  if (g.evolutions.has('barrage')) {
    g.fan = g.time - g.lastLoose <= 1 ? Math.min(6, g.fan + 1) : 0;
  }
  g.lastLoose = g.time;
  let count = 1 + g.rank('fletcher-s-craft') + (g.evolutions.has('barrage') ? g.fan : 0);
  if (source === 'rain') count = 1;
  const spawn = (x: number, y: number, a: number, origin = source) => {
    const arrow = g.arrows.acquire();
    if (!arrow) return;
    const speed = T.arrowSpeed * (1 + 0.15 * g.rank('taut-string')) * (perfect ? 1.25 : 1);
    const sway =
      source === 'bow' && p.draw > profile.full + profile.window && g.bow.id !== 'letoff'
        ? Math.sin(g.time * 30) * Math.min(0.18, (p.draw - profile.full - profile.window) * 0.5)
        : 0;
    a += sway;
    Object.assign(arrow, {
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: (T.arrowRange * (1 + 0.2 * g.rank('longshaft'))) / speed,
      damage,
      pierce: g.rank('piercer') + (perfect ? 1 : 0) + (g.bow.id === 'nightreach' ? 1 : 0),
      perfect,
      full,
      crit,
      r: 3 * (1 + 0.25 * g.rank('broadshaft')),
      source: origin,
      travel: 0,
      hitCount: 0,
    });
    if (
      (g.evolutions.has('worldpiercer') && full) ||
      (g.rank('last-arrow') && g.shots % 10 === 0)
    ) {
      arrow.pierce = 999;
      arrow.life = 4;
    }
  };
  for (let i = 0; i < count; i++) {
    const a = angle + (i - (count - 1) / 2) * 0.095;
    spawn(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, a);
  }
  if (countShot)
    for (const ghost of g.ghosts.items)
      if (ghost.active)
        for (let i = 0; i < count; i++)
          spawn(ghost.x, ghost.y, angle + (i - (count - 1) / 2) * 0.095, 'phantom');
  if (countShot && g.bow.id === 'sparrow' && perfect && p.streak % 3 === 0) spawn(p.x, p.y, angle);
  if (countShot && full && g.evolutions.has('heaven-s-volley')) {
    const n = perfect ? 36 : 12;
    for (let i = 0; i < n; i++) {
      const x = g.aim.x + (g.rng.next() - 0.5) * (perfect ? 380 : 180),
        y = g.aim.y + (g.rng.next() - 0.5) * 180;
      const before = g.arrows.items.find((a) => !a.active);
      if (!before) break;
      spawn(x, y - 300, Math.PI / 2, 'rain');
      before.life = 0.65;
      before.damage *= 0.45;
    }
  }
}
export function updateArrows(g: Hunt, dt: number) {
  for (const a of g.arrows.items)
    if (a.active) {
      a.life -= dt;
      if (a.life <= 0) {
        a.active = false;
        continue;
      }
      if (g.bow.id === 'moonbow' && a.source !== 'rain') {
        const angle = Math.atan2(g.aim.y - a.y, g.aim.x - a.x),
          speed = Math.hypot(a.vx, a.vy);
        a.vx += (Math.cos(angle) * speed - a.vx) * dt * 1.5;
        a.vy += (Math.sin(angle) * speed - a.vy) * dt * 1.5;
      }
      const ox = a.x,
        oy = a.y;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.travel += Math.hypot(a.vx, a.vy) * dt;
      if (!(g.evolutions.has('worldpiercer') && a.full))
        g.world.hash.query(a.x, a.y, 55, (o) => {
          if (distance(a, o) < o.r) a.active = false;
        });
      for (const wall of g.threats.items)
        if (wall.active && wall.kind === 4 && !(g.evolutions.has('worldpiercer') && a.full)) {
          const dx = a.x - wall.x,
            dy = a.y - wall.y,
            along = dx * Math.cos(wall.angle) + dy * Math.sin(wall.angle),
            across = Math.abs(-dx * Math.sin(wall.angle) + dy * Math.cos(wall.angle));
          if (along > 0 && along < wall.length && across < wall.r) a.active = false;
        }
      if (!a.active) continue;
      const step = Math.hypot(a.x - ox, a.y - oy);
      g.hash.query(a.x, a.y, step + 65, (e) => {
        if (!a.active || !e.active || e.fade > 0 || e.freeze < 0) return;
        for (let i = 0; i < a.hitCount; i++) if (a.hit[i] === e.id) return;
        const dx = a.x - ox,
          dy = a.y - oy,
          t = Math.max(
            0,
            Math.min(1, ((e.x - ox) * dx + (e.y - oy) * dy) / (dx * dx + dy * dy || 1)),
          );
        if (Math.hypot(e.x - (ox + t * dx), e.y - (oy + t * dy)) > e.r + a.r) return;
        if (e.kind === 5 && g.bow.id !== 'oathbreaker' && a.pierce === 0 && a.source !== 'rain') {
          const incoming = Math.atan2(-a.vy, -a.vx),
            diff = Math.atan2(Math.sin(incoming - e.angle), Math.cos(incoming - e.angle));
          if (Math.abs(diff) < Math.PI / 3) {
            a.active = false;
            g.emit('enemy.hit.armor', e.x, e.y);
            return;
          }
        }
        a.hit[a.hitCount++] = e.id;
        const d = distance(e, g.player),
          widen = 0.15 * g.rank('far-sight');
        const near = g.bow.near * (1 - widen),
          far = g.bow.far * (1 + widen);
        let multiplier =
          d < 180 ? 0.8 : d >= near && d <= far ? 1.15 + 0.1 * g.rank('far-sight') : 1;
        if (g.bow.id === 'nightreach') multiplier *= 1 + (0.2 * a.travel) / 300;
        if (g.evolutions.has('worldpiercer') && a.full) multiplier *= 1 + 0.1 * (a.hitCount - 1);
        if (e.boss === 0 && a.perfect) {
          const front = Math.atan2(g.player.y - e.y, g.player.x - e.x);
          if (
            Math.abs(Math.atan2(Math.sin(front - e.angle), Math.cos(front - e.angle))) <
            Math.PI / 3
          )
            multiplier *= 1.5;
        }
        if (e.boss === 1 && a.source !== 'rain' && Math.abs(e.y - a.y) > 15) multiplier *= 0.25;
        if (e.boss === 2 && e.state === 4) {
          e.state = 0;
          g.burst(e.x, e.y, 20);
        }
        if (g.scene === 'range') {
          if (d >= near && d <= far && g.moving) g.rangeSweet++;
          if (a.source === 'deadeye') g.rangeDeadeye++;
          if (e.kind === 3 && e.state === 1) {
            g.rangeInterrupt++;
            e.state = 0;
            e.clock = 2;
          }
        }
        damageEnemy(g, e, a.damage * multiplier, a, a.source);
        if (a.full) {
          g.player.focus = Math.min(100, g.player.focus + 3 * (1 + 0.25 * g.rank('moonwell')));
        }
        if (g.bow.id === 'moonbow') g.player.focus = Math.min(100, g.player.focus + 1);
        if (g.bow.id === 'oathbreaker') {
          e.x += Math.cos(Math.atan2(a.vy, a.vx)) * 25;
          e.y += Math.sin(Math.atan2(a.vy, a.vx)) * 25;
          if (a.perfect) e.root = 0.6;
        }
        a.pierce--;
        if (a.pierce < 0) a.active = false;
      });
    }
}
export function damageEnemy(
  g: Hunt,
  e: Enemy,
  damage: number,
  a?: Arrow,
  source = 'bow',
  secondary = false,
) {
  if (!e.active) return;
  if (e.elite === 5 && !a?.perfect) return;
  if (e.elite === 1 && !a?.perfect && g.bow.id !== 'oathbreaker') damage *= 0.7;
  if (e.freeze > 0) damage *= 2;
  if (e.mark) damage *= 1.3;
  if (e.bleed > 0 && g.rank('blood-trail')) damage *= 1.25;
  if (e.hp / e.maxHp < 0.2 && g.rank('executioner')) damage *= 1.5;
  if (g.rank('rupture') && [e.bleed, e.burn, e.poison, e.slow].filter((n) => n > 0).length >= 2)
    damage *= 1.4;
  e.hp -= damage;
  e.lastHit = g.time;
  e.flash = 0.1;
  g.damageSources[source] = (g.damageSources[source] || 0) + damage;
  if (a || secondary) {
    if (g.rank('ember-arrow')) e.burn = 2;
    if (g.rank('barbed-arrow')) e.bleed = 3;
    if (g.rank('frost-arrow')) e.slow = 1.5;
    if (g.rank('venom-arrow')) e.poison = Math.min(5, e.poison + 1);
  }
  if (a) {
    if (a.crit) g.emit('number.crit', e.x, e.y, damage);
    g.burst(e.x, e.y, 4);
    g.emit(
      'enemy.hit.' +
        (e.kind === 5 ? 'armor' : e.kind === 2 ? 'spectral' : e.kind === 4 ? 'bone' : 'flesh'),
      e.x,
      e.y,
      damage,
    );
    applyEvolutionRules(g, 'hit', e, a, damage);
    if (e.boss === 3 && e.phase === 1 && e.state === 1) {
      e.state = 0;
      e.clock = 1.2;
      g.emit('boss.stagger');
    }
  }
  if (e.hp <= 0) {
    if (e.dummy) {
      e.hp = e.maxHp;
      g.burst(e.x, e.y, 12);
      g.emit('range.hit');
    } else g.kill(e);
  }
}
function area(g: Hunt, e: Enemy, r: number, damage: number, source: string) {
  g.hash.query(e.x, e.y, r, (t) => {
    if (t !== e && t.active && distance(t, e) < r)
      damageEnemy(g, t, damage, undefined, source, true);
  });
  g.burst(e.x, e.y, 24, 2);
}
/** Rules respond to semantic hooks; secondary hits apply status without recursively emitting hook effects. */
export function applyEvolutionRules(
  g: Hunt,
  hook: 'hit' | 'kill',
  e: Enemy,
  a: Arrow | undefined,
  damage: number,
) {
  if (hook === 'hit' && a) {
    if (g.evolutions.has('deadshot') && a.perfect && distance(e, g.player) >= g.bow.near)
      area(g, e, 80, damage * 0.6, 'deadshot');
    if (g.evolutions.has('hellfire') && a.crit) {
      e.burn = 2;
      area(g, e, 85, damage * 0.5, 'hellfire');
    }
    if (g.evolutions.has('frostbite') && a.full && distance(e, g.player) > g.bow.far)
      e.freeze = 1.5;
    if (g.rank('storm-arrow') && (g.evolutions.has('thunderstorm') || g.rng.next() < 0.2)) {
      let prev = e;
      const visited = new Set<number>([e.id]),
        n = g.evolutions.has('thunderstorm') ? 6 : 2;
      for (let i = 0; i < n; i++) {
        let next: Enemy | undefined;
        g.hash.query(prev.x, prev.y, 180, (t) => {
          if (
            t.active &&
            !visited.has(t.id) &&
            distance(t, prev) < 180 &&
            (!next || distance(t, prev) < distance(next, prev))
          )
            next = t;
        });
        if (!next) break;
        visited.add(next.id);
        damageEnemy(g, next, damage * 0.3 * (1 + 0.15 * i), undefined, 'thunderstorm', true);
        g.emit('status.storm', next.x, next.y);
        g.burst(next.x, next.y, 10);
        prev = next;
      }
    }
  }
  if (hook === 'kill') {
    if (g.evolutions.has('hellfire') && e.burn > 0)
      g.hash.query(e.x, e.y, 120, (t) => {
        if (t.active && distance(t, e) < 120) t.burn = 2;
      });
    if (g.evolutions.has('red-harvest') && e.bleed > 0) {
      let n = 0;
      g.hash.query(e.x, e.y, 200, (t) => {
        if (t.active && n++ < 3) t.bleed = 3;
      });
    }
    if (g.evolutions.has('apex-hunter') && e.mark) {
      let next: Enemy | undefined;
      for (const t of g.enemies.items)
        if (t.active && (!next || distance(t, e) < distance(next, e))) next = t;
      if (next) next.mark = true;
      g.player.apex = 5;
    }
    if (e.elite === 4) {
      const t = g.threats.acquire();
      if (t)
        Object.assign(t, {
          x: e.x,
          y: e.y,
          kind: 2,
          r: 100,
          clock: 0,
          duration: 0.6,
          damage: 25,
          vx: 0,
          vy: 0,
          owner: e.id,
          angle: 0,
          length: 0,
        });
    }
  }
}
