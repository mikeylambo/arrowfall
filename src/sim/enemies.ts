import type { Hunt } from './game';
import type { Enemy } from './types';
import { ENEMIES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { distance, len } from '../data/tuning';
import { blockedMove, type Cover } from './world';
import { damageEnemy } from './combat';
const harvestTargets: Enemy[] = [];
const threatCover: Cover[] = [];
const snareTargets: Enemy[] = [];
const snareArea: Enemy[] = [];
function telegraph(
  g: Hunt,
  e: Enemy,
  kind: number,
  duration: number,
  r = 20,
  length = 650,
  angle = e.angle,
) {
  const t = g.threats.acquire();
  if (t) {
    t.x = e.x;
    t.y = e.y;
    t.kind = kind;
    t.r = r;
    t.length = length;
    t.angle = angle;
    t.clock = 0;
    t.duration = duration;
    t.damage = e.damage;
    t.vx = 0;
    t.vy = 0;
    t.owner = e.id;
  }
  g.emit('enemy.telegraph', e.x, e.y);
  return t;
}
function projectile(g: Hunt, e: Enemy, angle: number, speed = 380) {
  const t = g.threats.acquire();
  if (t) {
    t.x = e.x;
    t.y = e.y;
    t.kind = 3;
    t.r = 7;
    t.length = 0;
    t.angle = angle;
    t.clock = 0;
    t.duration = 5;
    t.damage = e.damage;
    t.vx = Math.cos(angle) * speed;
    t.vy = Math.sin(angle) * speed;
    t.owner = e.id;
  }
  g.emit('enemy.loose', e.x, e.y);
}
export function updateEnemies(g: Hunt, dt: number) {
  const p = g.player;
  for (const e of g.enemies.items)
    if (e.active) {
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.root = Math.max(0, e.root - dt);
      e.freeze = Math.max(0, e.freeze - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.burn = Math.max(0, e.burn - dt);
      e.bleed = Math.max(0, e.bleed - dt);
      e.clock -= dt;
      e.statusClock -= dt;
      if (e.burn > 0 || e.bleed > 0 || e.poison > 0) {
        damageEnemy(
          g,
          e,
          dt * (e.burn > 0 ? 8 : 0) + dt * (e.bleed > 0 ? 6 : 0) + dt * e.poison * 2,
          undefined,
          'status',
        );
        if (!e.active) continue;
      }
      if (g.evolutions.has('red-harvest') && e.bleed > 0 && e.statusClock <= 0) {
        e.statusClock = 1;
        let n = 0;
        const found = g.hash.query(e.x, e.y, 180, harvestTargets);
        for (let i = 0; i < found; i++) {
          const t = harvestTargets[i];
          if (t !== e && t.active && n++ < 2) {
            damageEnemy(g, t, 12, undefined, 'red-harvest', true);
            g.burst(t.x, t.y, 7, 1);
          }
        }
      }
      if (e.elite === 2 && g.time - e.lastHit > 2)
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * dt);
      if (e.boss >= 0 || (e.dummy && e.kind !== 3) || e.freeze > 0 || e.root > 0) continue;
      const dx = p.x - e.x,
        dy = p.y - e.y,
        d = len(dx, dy),
        aim = Math.atan2(dy, dx),
        def = ENEMIES[e.kind];
      let speed = e.speed * (e.slow > 0 ? 0.7 : 1),
        move = true;
      if (e.kind === 5) {
        const diff = Math.atan2(Math.sin(aim - e.angle), Math.cos(aim - e.angle));
        e.angle += Math.max((-Math.PI / 2) * dt, Math.min((Math.PI / 2) * dt, diff));
      } else if (e.state !== 2) e.angle = aim;
      if (e.kind === 2) {
        const phase = e.age % 4;
        if (phase > 2.5) {
          e.fade = 1;
          move = false;
        } else {
          e.fade = 0;
          e.angle += Math.sin(e.age * 3) * 0.6;
        }
        if (g.rank('lantern') && d < 140 + 20 * (g.rank('lantern') - 1)) {
          e.fade = 0;
          move = true;
        }
      }
      if (e.kind === 7 && e.state === 0) {
        move = false;
        if (d < 80) {
          e.state = 1;
          e.clock = 0.6;
          telegraph(g, e, 2, 0.6, 80);
        }
      } else if (e.kind === 7 && e.state === 1) {
        move = false;
        if (e.clock <= 0) e.state = 2;
      }
      if (e.kind === 1) {
        if (e.state === 0 && d < 340) {
          e.state = 1;
          e.clock = def.telegraph;
          e.tx = p.x;
          e.ty = p.y;
          telegraph(g, e, 0, def.telegraph, 12, 300);
        }
        if (e.state === 1) {
          move = false;
          if (e.clock <= 0) {
            e.state = 2;
            e.angle = Math.atan2(e.ty - e.y, e.tx - e.x);
            e.clock = 0.65;
          }
        } else if (e.state === 2) {
          speed = 320;
          if (e.clock <= 0) {
            e.state = 0;
            e.clock = 2;
          }
        }
      }
      if (e.kind === 3) {
        if (d < 430) move = false;
        if (e.clock <= 0) {
          if (e.state === 0) {
            e.state = 1;
            e.clock = 0.8;
            telegraph(g, e, 0, 0.8, 8, 650);
          } else {
            projectile(g, e, e.angle);
            e.state = 0;
            e.clock = 2.5;
          }
        }
      }
      if (e.kind === 4) {
        if (e.state === 0 && e.clock <= 0 && d < 800) {
          e.state = 1;
          e.clock = 0.9;
          e.tx = p.x;
          e.ty = p.y;
          telegraph(g, e, 0, 0.9, 30, 900);
        }
        if (e.state === 1) {
          move = false;
          if (e.clock <= 0) {
            e.state = 2;
            e.clock = 1.3;
            e.angle = Math.atan2(e.ty - e.y, e.tx - e.x);
          }
        } else if (e.state === 2) {
          speed = 420;
          if (e.clock <= 0) {
            e.state = 0;
            e.clock = 3;
          }
        }
      }
      if (e.kind === 6) {
        if (e.state === 0 && d < 40) {
          e.state = 1;
          e.clock = 0.8;
          telegraph(g, e, 2, 0.8, 70);
        }
        if (e.state === 1) {
          move = false;
          if (e.clock <= 0) {
            e.state = 2;
            e.clock = 1.1;
            g.burst(e.x, e.y, 20, 1);
            if (d < 80) g.hurt(e.damage);
          }
        } else if (e.state === 2) {
          move = false;
          if (e.clock <= 0) {
            e.state = 0;
            e.clock = 2;
          }
        }
      }
      if (move) {
        if (e.state === 2 && (e.kind === 1 || e.kind === 4)) {
          e.x += Math.cos(e.angle) * speed * dt;
          e.y += Math.sin(e.angle) * speed * dt;
        } else {
          g.world.flow.direction(e.x, e.y, g.path);
          const direct =
            d < 180 ||
            g.world.flow.costs[Math.floor(e.y / 100) * 150 + Math.floor(e.x / 100)] > 2000;
          let vx = direct ? dx : g.path.x,
            vy = direct ? dy : g.path.y;
          const length = len(vx, vy) || 1;
          vx /= length;
          vy /= length;
          e.x += vx * speed * dt;
          e.y += vy * speed * dt;
        }
        blockedMove(e, e.r * 0.7, g.world.hash);
      }
      if (d < e.r + 16 && e.kind !== 6 && e.fade === 0) {
        if (e.state !== 3 && e.kind !== 1 && e.kind !== 4 && e.kind !== 7) {
          e.state = 3;
          e.clock = 0.6;
          telegraph(g, e, 2, 0.6, e.r + 22);
        } else if ((e.state === 3 && e.clock <= 0) || e.state === 2) {
          g.hurt(e.damage);
          if (e.elite === 3) e.hp = Math.min(e.maxHp, e.hp + e.damage * 0.25);
          e.state = 0;
          e.clock = 1;
        }
      }
    }
}
export function updateThreats(g: Hunt, dt: number) {
  for (const t of g.threats.items)
    if (t.active) {
      t.clock += dt;
      if (t.kind === 3) {
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (distance(t, g.player) < t.r + 16) {
          g.hurt(t.damage);
          t.active = false;
        }
        const found = g.world.hash.query(t.x, t.y, 50, threatCover);
        for (let i = 0; i < found; i++)
          if (distance(t, threatCover[i]) < threatCover[i].r) t.active = false;
      }
      if (t.kind === 5) {
        let triggered = false;
        const found = g.hash.query(t.x, t.y, 45, snareTargets);
        for (let i = 0; i < found; i++) {
          const e = snareTargets[i];
          if (e.active && distance(e, t) < 45) {
            e.root = 2;
            damageEnemy(g, e, t.damage, undefined, 'thornsnare');
            triggered = true;
            if (g.rank('thornsnare') === 5) {
              const caught = g.hash.query(t.x, t.y, 90, snareArea);
              for (let k = 0; k < caught; k++)
                if (distance(snareArea[k], t) < 90) snareArea[k].root = 2;
            }
          }
        }
        if (triggered) {
          g.snareHeld--;
          g.emit('tool.snare.trigger', t.x, t.y);
          g.burst(t.x, t.y, 20);
          t.active = false;
        }
      }
      if (t.kind === 6 && t.clock >= t.duration) {
        t.kind = 4;
        t.clock = 0;
        t.duration = 8;
        g.emit('boss.bramble.wall');
      }
      if (t.clock >= t.duration) {
        if (t.kind === 2) {
          if (distance(t, g.player) < t.r + 16) g.hurt(t.damage);
          g.burst(t.x, t.y, 20, 1);
        }
        if (t.kind === 1) {
          const dx = g.player.x - t.x,
            dy = g.player.y - t.y,
            along = dx * Math.cos(t.angle) + dy * Math.sin(t.angle),
            across = Math.abs(-dx * Math.sin(t.angle) + dy * Math.cos(t.angle));
          if (along >= 0 && along < t.length && across < t.r + 16) g.hurt(t.damage);
          g.burst(
            t.x + Math.cos(t.angle) * t.length * 0.5,
            t.y + Math.sin(t.angle) * t.length * 0.5,
            30,
            1,
          );
        }
        if (t.kind === 5) g.snareHeld--;
        t.active = false;
      }
    }
}
export function updateBoss(g: Hunt, e: Enemy, dt: number) {
  const p = g.player,
    dx = p.x - e.x,
    dy = p.y - e.y,
    d = len(dx, dy),
    aim = Math.atan2(dy, dx);
  const before = e.phase;
  e.phase = e.hp / e.maxHp > 0.66 ? 1 : e.hp / e.maxHp > 0.33 ? 2 : 3;
  if (e.phase !== before) {
    g.hitstop = 0.15;
    g.announce(`${BOSSES[e.boss].name} · Phase ${e.phase}`);
    g.emit('boss.phase');
  }
  e.angle = aim;
  if (e.root > 0) return;
  if (e.boss === 0) {
    if (e.state === 2) {
      e.x += Math.cos(e.tx) * 420 * dt;
      e.y += Math.sin(e.tx) * 420 * dt;
      if (e.clock <= 0) {
        e.state = 0;
        e.clock = 2;
      }
    } else if (e.clock <= 0) {
      if (e.state === 0) {
        e.state = 1;
        e.clock = 0.7;
        e.tx = aim;
        telegraph(g, e, 0, 0.7, 35, 700);
      } else {
        e.state = 2;
        e.clock = 1;
      }
    } else if (e.state === 0) {
      e.x += ((dx / (d || 1)) * 0.4 - Math.sin(aim)) * 75 * dt;
      e.y += ((dy / (d || 1)) * 0.4 + Math.cos(aim)) * 75 * dt;
    }
    if (Math.floor(e.age / 12) > Math.floor((e.age - dt) / 12))
      for (let i = 0; i < 4; i++) g.spawn(1);
  }
  if (e.boss === 1) {
    if (e.clock <= 0) {
      e.clock = 3;
      const a = telegraph(g, e, 1, 1, 24, 900);
      if (a) a.angle = aim;
      for (let i = 0; i < 3 + Number(g.phase >= 2); i++) {
        const t = telegraph(g, e, 6, 1, 15, 350, aim + (i - 1) * 0.9);
        if (t) {
          t.x = p.x + Math.cos(i * 2) * 220;
          t.y = p.y + Math.sin(i * 2) * 220;
        }
      }
    }
    e.x += (dx / (d || 1)) * 30 * dt;
    e.y += (dy / (d || 1)) * 30 * dt;
  }
  if (e.boss === 2) {
    e.x += Math.cos(e.age * 0.7) * 65 * dt;
    e.y += Math.sin(e.age * 0.8) * 65 * dt;
    if (e.clock <= 0) {
      e.clock = 3;
      for (let i = 0; i < 8 + Number(g.phase >= 2) * 4; i++)
        projectile(g, e, e.age + (i * Math.PI) / 4, 170);
      if (e.phase >= 2) {
        telegraph(g, e, 1, 0.8, 32, 800, aim);
        g.emit('boss.hag.threefold');
        e.state = 4;
        for (let i = 0; i < 2; i++) {
          const illusion = g.spawn(2, e.x + (i ? 220 : -220), e.y - 100);
          if (illusion) {
            illusion.hp = illusion.maxHp = 1;
            illusion.xp = 0;
            illusion.r = 42;
            illusion.root = 3;
          }
        }
      }
    }
  }
  if (e.boss === 3) {
    if (e.clock <= 0) {
      if (e.state === 0) {
        e.state = 1;
        e.clock = e.phase === 1 ? 0.8 : 1.2;
        if (e.phase === 1) telegraph(g, e, 0, 0.8, 10, 1100, aim);
        if (e.phase === 2)
          for (let i = -2; i <= 2; i++) {
            const t = telegraph(g, e, 1, 1.2, 26, 1600, 0);
            if (t) {
              t.x = p.x - 800;
              t.y = p.y + i * 150;
            }
          }
        if (e.phase === 3) {
          g.enemyDeadeye = 1.2;
          g.emit('boss.deadeye');
        }
        if (e.phase === 3)
          for (let i = 0; i < 6; i++) {
            const t = telegraph(g, e, 2, 1.2, 65);
            if (t) {
              t.x = p.x + ((i % 3) - 1) * 120;
              t.y = p.y + (Math.floor(i / 3) - 0.5) * 180;
            }
          }
      } else {
        e.state = 0;
        e.clock = e.phase === 3 ? 4 : 2.2;
        if (e.phase === 1) projectile(g, e, aim, 600);
        if (e.phase === 3) {
          p.focus = 100;
          g.announce('His guard breaks · Deadeye ready');
        }
      }
    }
    if (e.state === 0) {
      e.x += (dx / (d || 1)) * (d > 450 ? 70 : -40) * dt;
      e.y += (dy / (d || 1)) * (d > 450 ? 70 : -40) * dt;
    }
  }
  if (d < e.r + 16 && e.state === 2) g.hurt(e.damage);
}
