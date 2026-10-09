import type { Hunt } from './game';
import type { Enemy, Arrow, Threat } from './types';
import type { Cover } from './world';
import { BOSSES } from '../data/bosses';
import { T, distance, len } from '../data/tuning';
import { drawDamage } from './bow';
import { arrowSpeed, bowDraw, critChance, critMultiplier, damageMultiplier, pierce } from './stats';
const starTargets: Enemy[] = [];
const seekTargets: Enemy[] = [];
/**
 * A secondary arrow (split shards, echoes, totem shots): flies straight, no pierce, inherits
 * on-hit rules.
 */
export function shard(
  g: Hunt,
  x: number,
  y: number,
  angle: number,
  damage: number,
  source: string,
  skip = -1,
  life = 0.45,
) {
  const arrow = g.arrows.acquire();
  if (!arrow) return;
  const speed = T.arrowSpeed * 0.9;
  arrow.x = x;
  arrow.y = y;
  arrow.vx = Math.cos(angle) * speed;
  arrow.vy = Math.sin(angle) * speed;
  arrow.life = life;
  arrow.damage = damage;
  arrow.pierce = 0;
  arrow.perfect = false;
  arrow.full = false;
  arrow.crit = false;
  arrow.r = 3;
  arrow.source = source;
  arrow.travel = 0;
  arrow.bounces = 0;
  arrow.hitCount = 0;
  if (skip >= 0) arrow.hit[arrow.hitCount++] = skip;
}
/** Nearest active enemy to (x, y) within r, excluding ids the arrow already hit. */
function nearestTo(g: Hunt, x: number, y: number, r: number, a?: Arrow) {
  const n = g.hash.query(x, y, r, seekTargets);
  let best: Enemy | undefined,
    bestD = r;
  for (let i = 0; i < n; i++) {
    const t = seekTargets[i];
    if (!t.active || t.fade > 0) continue;
    if (a) {
      let seen = false;
      for (let k = 0; k < a.hitCount; k++) if (a.hit[k] === t.id) seen = true;
      if (seen) continue;
    }
    const d = len(t.x - x, t.y - y);
    if (d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}
export function loose(
  g: Hunt,
  perfect: boolean,
  angle: number,
  source = 'bow',
  multiplier = 1,
  countShot = true,
) {
  const p = g.player,
    profile = bowDraw(g);
  const full = p.draw >= profile.full || source !== 'bow',
    crit = perfect || g.rng.next() < critChance(g);
  let damage = T.damage * (countShot ? drawDamage(p.draw, profile.full) : 1) * damageMultiplier(g);
  damage *= crit ? critMultiplier(g, perfect) : 1;
  // Perfect streaks escalate: each tier reached adds to perfect damage.
  if (perfect) damage *= 1 + T.streakBonus * T.streakTiers.filter((n) => p.streak >= n).length;
  damage *= 1 + 0.04 * g.chain + (p.apex > 0 ? 0.15 : 0);
  if (g.rank('still-water') && g.stillTime >= 0.8) damage *= 1 + 0.15 * g.rank('still-water');
  damage *= multiplier;
  if (g.rank('last-arrow') && (g.shots + 1) % 10 === 0) damage *= 3;
  if (countShot) {
    g.shots++;
    if (perfect) {
      g.perfects++;
      p.streak++;
      g.maxStreak = Math.max(g.maxStreak, p.streak);
      if (T.streakTiers.includes(p.streak) || (p.streak > 20 && p.streak % 10 === 0))
        g.emit('streak.tier', p.x, p.y, p.streak);
      p.focus = Math.min(100, p.focus + T.focusPerfect * (1 + 0.25 * g.rank('moonwell')));
      g.emit('bow.perfect');
      g.hitstop = T.hitstopPerfect;
      g.burst(p.x, p.y, 18, 2);
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
    const speed = arrowSpeed(g) * (perfect ? 1.25 : 1);
    const sway =
      source === 'bow' && p.draw > profile.full + profile.window && g.bow.id !== 'letoff'
        ? Math.sin(g.time * 30) * Math.min(0.18, (p.draw - profile.full - profile.window) * 0.5)
        : 0;
    a += sway;
    arrow.x = x;
    arrow.y = y;
    arrow.vx = Math.cos(a) * speed;
    arrow.vy = Math.sin(a) * speed;
    arrow.life = (T.arrowRange * (1 + 0.2 * g.rank('longshaft'))) / speed;
    arrow.damage = damage;
    arrow.pierce = pierce(g) + (perfect ? 1 : 0);
    arrow.perfect = perfect;
    arrow.full = full;
    arrow.crit = crit;
    arrow.r = 3 * (1 + 0.25 * g.rank('broadshaft'));
    arrow.source = origin;
    arrow.travel = 0;
    arrow.hitCount = 0;
    arrow.bounces = 0;
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
  if (countShot && perfect && g.rank('starfall') && ++g.starCount % 5 === 0) {
    // Starfall: a star strikes the aim point, 90 px blast at triple base damage.
    const n = g.hash.query(g.aim.x, g.aim.y, 90, starTargets);
    for (let i = 0; i < n; i++) {
      const t = starTargets[i];
      if (t.active && len(t.x - g.aim.x, t.y - g.aim.y) < 90)
        damageEnemy(g, t, T.damage * 3, undefined, 'starfall', true);
    }
    g.emit('upgrade.starfall', g.aim.x, g.aim.y);
  }
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
const arrowCover: Cover[] = [];
const arrowTargets: Enemy[] = [];
const walls: Threat[] = [];
export function updateArrows(g: Hunt, dt: number) {
  let wallCount = 0;
  for (const t of g.threats.items) if (t.active && t.kind === 4) walls[wallCount++] = t;
  const worldpiercer = g.evolutions.has('worldpiercer'),
    moonbow = g.bow.id === 'moonbow',
    widen = 0.15 * g.rank('far-sight'),
    near = g.bow.near * (1 - widen),
    far = g.bow.far * (1 + widen),
    sweetBonus = 1.15 + 0.1 * g.rank('far-sight'),
    focusPerHit = T.focusHit * (1 + 0.25 * g.rank('moonwell'));
  for (const a of g.arrows.items) {
    if (!a.active) continue;
    a.life -= dt;
    if (a.life <= 0) {
      a.active = false;
      continue;
    }
    if (moonbow && a.source !== 'rain') {
      const angle = Math.atan2(g.aim.y - a.y, g.aim.x - a.x),
        speed = len(a.vx, a.vy);
      a.vx += (Math.cos(angle) * speed - a.vx) * dt * 1.5;
      a.vy += (Math.sin(angle) * speed - a.vy) * dt * 1.5;
    }
    const ox = a.x,
      oy = a.y;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.travel += len(a.vx, a.vy) * dt;
    if (
      a.perfect &&
      a.source !== 'rain' &&
      g.rank('moonseeker') &&
      (g.tick + a.hitCount) % 2 === 0
    ) {
      // Moonseeker: perfect arrows bend toward the nearest enemy ahead of them.
      const t = nearestTo(g, a.x, a.y, 260, a);
      if (t) {
        const speed = len(a.vx, a.vy),
          want = Math.atan2(t.y - a.y, t.x - a.x),
          now = Math.atan2(a.vy, a.vx),
          turn = Math.atan2(Math.sin(want - now), Math.cos(want - now)),
          next = now + Math.max(-0.12, Math.min(0.12, turn));
        a.vx = Math.cos(next) * speed;
        a.vy = Math.sin(next) * speed;
      }
    }
    if (!(worldpiercer && a.full)) {
      const n = g.world.hash.query(a.x, a.y, 80, arrowCover);
      for (let i = 0; i < n; i++)
        if (distance(a, arrowCover[i]) < arrowCover[i].r) a.active = false;
      for (let w = 0; w < wallCount; w++) {
        const wall = walls[w],
          dx = a.x - wall.x,
          dy = a.y - wall.y,
          along = dx * Math.cos(wall.angle) + dy * Math.sin(wall.angle),
          across = Math.abs(-dx * Math.sin(wall.angle) + dy * Math.cos(wall.angle));
        if (along > 0 && along < wall.length && across < wall.r) a.active = false;
      }
    }
    if (!a.active) continue;
    const dx = a.x - ox,
      dy = a.y - oy,
      segment = dx * dx + dy * dy || 1,
      step = Math.sqrt(dx * dx + dy * dy);
    // The Bramble King's crown stands high above its feet, so look further while it is up.
    const reach = g.boss?.active && g.boss.boss === 1 ? 65 - BOSSES[1].crown!.dy : 65;
    const n = g.hash.query(a.x, a.y, step + reach, arrowTargets);
    for (let k = 0; k < n && a.active; k++) {
      const e = arrowTargets[k];
      if (!e.active || e.fade > 0 || e.freeze < 0) continue;
      let seen = false;
      for (let i = 0; i < a.hitCount; i++)
        if (a.hit[i] === e.id) {
          seen = true;
          break;
        }
      if (seen) continue;
      const t = Math.max(0, Math.min(1, ((e.x - ox) * dx + (e.y - oy) * dy) / segment));
      if (len(e.x - (ox + t * dx), e.y - (oy + t * dy)) > e.r + a.r) {
        // The crown is a target of its own: an arrow through it hits even above the body.
        if (e.boss !== 1) continue;
        const crown = BOSSES[1].crown!,
          cy = e.y + crown.dy,
          u = Math.max(0, Math.min(1, ((e.x - ox) * dx + (cy - oy) * dy) / segment));
        if (len(e.x - (ox + u * dx), cy - (oy + u * dy)) > crown.r + a.r) continue;
      }
      if (e.kind === 5 && g.bow.id !== 'oathbreaker' && a.pierce === 0 && a.source !== 'rain') {
        const incoming = Math.atan2(-a.vy, -a.vx),
          diff = Math.atan2(Math.sin(incoming - e.angle), Math.cos(incoming - e.angle));
        if (Math.abs(diff) < Math.PI / 3) {
          a.active = false;
          g.emit('enemy.hit.armor', e.x, e.y);
          continue;
        }
      }
      a.hit[a.hitCount++] = e.id;
      const d = distance(e, g.player);
      let multiplier = d < 180 ? 0.8 : d >= near && d <= far ? sweetBonus : 1;
      if (g.bow.id === 'nightreach') multiplier *= 1 + (0.2 * a.travel) / 300;
      if (worldpiercer && a.full) multiplier *= 1 + 0.1 * (a.hitCount - 1);
      if (e.boss === 0 && a.perfect) {
        const front = Math.atan2(g.player.y - e.y, g.player.x - e.x);
        if (
          Math.abs(Math.atan2(Math.sin(front - e.angle), Math.cos(front - e.angle))) <
          Math.PI / 3
        )
          multiplier *= 1.5;
      }
      if (e.boss === 1 && a.source !== 'rain') {
        // Full damage when the arrow's line of flight passes through the crown.
        const crown = BOSSES[1].crown!,
          speed = len(a.vx, a.vy) || 1,
          miss = Math.abs((a.vx * (e.y + crown.dy - a.y) - a.vy * (e.x - a.x)) / speed);
        if (miss > crown.r + a.r) multiplier *= 0.25;
      }
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
      const flight = Math.atan2(a.vy, a.vx);
      if (a.perfect && g.rank('briar-shot') && e.active && e.boss < 0)
        e.root = Math.max(e.root, 0.8);
      if (g.rank('splitshot') && a.source === 'bow' && a.hitCount === 1)
        for (const side of [-0.45, 0.45])
          shard(
            g,
            e.x,
            e.y,
            flight + side,
            a.damage * (0.3 + 0.1 * g.rank('splitshot')),
            'split',
            e.id,
          );
      if (a.crit && g.rank('echo-shot') && a.source !== 'echo') {
        const next = nearestTo(g, e.x, e.y, 320, a);
        if (next)
          shard(g, e.x, e.y, Math.atan2(next.y - e.y, next.x - e.x), a.damage * 0.5, 'echo', e.id);
      }
      if (!e.active && g.rank('ricochet') && a.bounces < g.rank('ricochet')) {
        // Ricochet: the killing arrow turns toward the nearest enemy it has not hit yet.
        const next = nearestTo(g, e.x, e.y, 300, a);
        if (next) {
          const speed = len(a.vx, a.vy),
            to = Math.atan2(next.y - a.y, next.x - a.x);
          a.vx = Math.cos(to) * speed;
          a.vy = Math.sin(to) * speed;
          a.bounces++;
          a.pierce++;
          a.life = Math.max(a.life, 0.5);
          g.emit('upgrade.ricochet', e.x, e.y);
        }
      }
      if (a.full) g.player.focus = Math.min(100, g.player.focus + focusPerHit);
      if (g.bow.id === 'moonbow') g.player.focus = Math.min(100, g.player.focus + 1);
      // Knockback: every hit shoves along the arrow's flight; heavier for full draws and
      // perfects, far heavier for the Oathbreaker. Bosses do not budge.
      if (e.boss < 0) {
        const angle = Math.atan2(a.vy, a.vx),
          push =
            T.knockback[a.perfect ? 2 : a.full ? 1 : 0] *
            (g.bow.id === 'oathbreaker' ? 2.5 : 1) *
            (e.kind === 4 || e.kind === 5 ? 0.4 : 1);
        e.x += Math.cos(angle) * push;
        e.y += Math.sin(angle) * push;
      }
      if (g.bow.id === 'oathbreaker' && a.perfect) e.root = 0.6;
      a.pierce--;
      if (a.pierce < 0) a.active = false;
    }
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
  if (
    g.rank('rupture') &&
    (e.bleed > 0 ? 1 : 0) + (e.burn > 0 ? 1 : 0) + (e.poison > 0 ? 1 : 0) + (e.slow > 0 ? 1 : 0) >=
      2
  )
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
    if (a.source === 'deadeye') g.emit('number.deadeye', e.x, e.y, damage);
    else if (a.crit) g.emit('number.crit', e.x, e.y, damage);
    g.burst(e.x, e.y, 4);
    g.emit(
      e.kind === 5
        ? 'enemy.hit.armor'
        : e.kind === 2
          ? 'enemy.hit.spectral'
          : e.kind === 4
            ? 'enemy.hit.bone'
            : 'enemy.hit.flesh',
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
const areaTargets: Enemy[] = [];
function area(g: Hunt, e: Enemy, r: number, damage: number, source: string) {
  const n = g.hash.query(e.x, e.y, r, areaTargets);
  for (let i = 0; i < n; i++) {
    const t = areaTargets[i];
    if (t !== e && t.active && distance(t, e) < r)
      damageEnemy(g, t, damage, undefined, source, true);
  }
  g.burst(e.x, e.y, 24, 0);
}
const chainTargets: Enemy[] = [];
const chainVisited = new Uint32Array(8);
const killTargets: Enemy[] = [];
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
      const n = g.evolutions.has('thunderstorm') ? 6 : 2;
      chainVisited[0] = e.id;
      let visitedCount = 1;
      for (let i = 0; i < n; i++) {
        let next: Enemy | undefined;
        const found = g.hash.query(prev.x, prev.y, 180, chainTargets);
        for (let k = 0; k < found; k++) {
          const t = chainTargets[k];
          if (!t.active || distance(t, prev) >= 180) continue;
          let visited = false;
          for (let v = 0; v < visitedCount; v++) if (chainVisited[v] === t.id) visited = true;
          if (!visited && (!next || distance(t, prev) < distance(next, prev))) next = t;
        }
        if (!next) break;
        chainVisited[visitedCount++] = next.id;
        damageEnemy(g, next, damage * 0.3 * (1 + 0.15 * i), undefined, 'thunderstorm', true);
        g.emit('status.storm', next.x, next.y);
        g.burst(next.x, next.y, 10);
        prev = next;
      }
    }
  }
  if (hook === 'kill') {
    if (g.evolutions.has('hellfire') && e.burn > 0) {
      const found = g.hash.query(e.x, e.y, 120, killTargets);
      for (let i = 0; i < found; i++) {
        const t = killTargets[i];
        if (t.active && distance(t, e) < 120) t.burn = 2;
      }
    }
    if (g.evolutions.has('red-harvest') && e.bleed > 0) {
      let n = 0;
      const found = g.hash.query(e.x, e.y, 200, killTargets);
      for (let i = 0; i < found; i++)
        if (killTargets[i].active && n++ < 3) killTargets[i].bleed = 3;
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
      if (t) {
        t.x = e.x;
        t.y = e.y;
        t.kind = 2;
        t.r = 100;
        t.clock = 0;
        t.duration = 0.6;
        t.damage = 25;
        t.vx = 0;
        t.vy = 0;
        t.owner = e.id;
        t.angle = 0;
        t.length = 0;
      }
    }
  }
}
