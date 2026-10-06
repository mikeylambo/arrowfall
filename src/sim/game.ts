import { DeterministicRng } from '@slu/web-shell';
import { Pool } from './pool';
import { Grid } from './grid';
import { BOWS, type Bow } from '../data/bows';
import { T, clamp, distance, xpNeeded, len } from '../data/tuning';
import { UPGRADES } from '../data/upgrades';
import { EVOLUTIONS } from '../data/evolutions';
import { TOOLS } from '../data/tools';
import { BOSSES } from '../data/bosses';
import { ENEMIES, ELITES } from '../data/enemies';
import { EVENTS, FORMATIONS } from '../data/events';
import { makeWorld, blockedMove } from './world';
import { drawProfile, classifyDraw } from './bow';
import { updateEnemies, updateThreats, updateBoss } from './enemies';
import { loose, updateArrows, damageEnemy, applyEvolutionRules } from './combat';
import type {
  Input,
  Enemy,
  Arrow,
  Particle,
  Pickup,
  Threat,
  Player,
  Profile,
  Ghost,
  SimEvent,
} from './types';
const isActive = (item: { active: boolean }) => item.active;
const near: Enemy[] = [];
export class Hunt {
  readonly rng: DeterministicRng;
  readonly cardRng: DeterministicRng;
  readonly directorRng: DeterministicRng;
  readonly world: ReturnType<typeof makeWorld>;
  readonly bow: Bow;
  readonly enemies = new Pool<Enemy>(500, () => ({
    active: false,
    x: 0,
    y: 0,
    id: 0,
    kind: 0,
    hp: 0,
    maxHp: 0,
    r: 0,
    speed: 0,
    damage: 0,
    xp: 0,
    elite: -1,
    boss: -1,
    phase: 1,
    angle: 0,
    clock: 0,
    state: 0,
    tx: 0,
    ty: 0,
    flash: 0,
    age: 0,
    fade: 0,
    burn: 0,
    bleed: 0,
    poison: 0,
    slow: 0,
    freeze: 0,
    root: 0,
    mark: false,
    lastHit: 0,
    statusClock: 0,
    deadmark: false,
    dummy: false,
  }));
  readonly arrows = new Pool<Arrow>(1400, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    damage: 0,
    pierce: 0,
    perfect: false,
    full: false,
    crit: false,
    r: 3,
    source: 'bow',
    travel: 0,
    hit: new Uint32Array(500),
    hitCount: 0,
  }));
  readonly particles = new Pool<Particle>(2000, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 0,
    size: 0,
    color: 0,
  }));
  readonly pickups = new Pool<Pickup>(1600, () => ({
    active: false,
    x: 0,
    y: 0,
    value: 0,
    kind: 0,
  }));
  readonly threats = new Pool<Threat>(300, () => ({
    active: false,
    x: 0,
    y: 0,
    kind: 0,
    r: 0,
    angle: 0,
    length: 0,
    clock: 0,
    duration: 0,
    damage: 0,
    vx: 0,
    vy: 0,
    owner: -1,
  }));
  readonly ghosts = new Pool<Ghost>(3, () => ({ active: false, x: 0, y: 0, life: 0 }));
  /** Active enemies, re-indexed once per step. */
  readonly hash = new Grid<Enemy>(T.worldWidth, T.worldHeight, 96, 500);
  readonly ranks: Record<string, number> = {};
  readonly evolutions = new Set<string>();
  readonly banished = new Set<string>();
  readonly player: Player;
  /** Consumers drain this and truncate it (`events.length = 0`); event objects are recycled. */
  readonly events: SimEvent[] = [];
  private readonly eventPool: SimEvent[] = [];
  /** Active enemy count, refreshed at the start of each step. */
  crowd = 0;
  readonly timeline: string[] = [];
  readonly damageSources: Record<string, number> = {};
  challenge = '';
  challengeStart = 0;
  challengePerfect = 0;
  rangeSweet = 0;
  rangeDeadeye = 0;
  rangeInterrupt = 0;
  moving = false;
  rangeWon = false;
  enemyDeadeye = 0;
  bufferDodge = false;
  bufferDeadeye = false;
  tutorialMask = 0;
  scene = 'hunt';
  time = 0;
  realTime = 0;
  kills = 0;
  shots = 0;
  perfects = 0;
  sweetKills = 0;
  maxStreak = 0;
  level = 1;
  xp = 0;
  focusMarks = 0;
  deadeye = 0;
  wasDraw = false;
  pendingLevels = 0;
  offers: string[] = [];
  choiceGuard = 0;
  outcome = '';
  earned = 0;
  boss: Enemy | null = null;
  spawnClock = 0;
  enemyId = 1;
  bossMask = 0;
  formationClock = 150;
  eventClock = 360;
  event = -1;
  eventTimer = 0;
  eventX = 0;
  eventY = 0;
  groveRest = 0;
  markClock = 0;
  toolClock = 0;
  snareClock = 0;
  snareHeld = 0;
  banner = '';
  bannerTime = 0;
  shake = 0;
  flash = 0;
  hitstop = 0;
  /** Player assist option: loose automatically the moment the draw is full (always perfect). */
  assistLoose = false;
  god = false;
  freezeSpawns = false;
  slowMotion = false;
  secondWind = false;
  unlockedAll = false;
  rerolls = 0;
  banishes = 0;
  skips = 0;
  lastLoose = -100;
  fan = 0;
  chain = 0;
  chainTime = 0;
  lastCell = -1;
  viewport = { width: 1400, height: 850 };
  aim = { x: 0, y: 0 };
  toolTarget = { x: 0, y: 0 };
  path = { x: 0, y: 0 };
  constructor(
    readonly seed: number,
    readonly profile: Profile,
    bowId = 'recurve',
    readonly phase = 0,
    practice = false,
  ) {
    this.rng = new DeterministicRng(seed);
    this.cardRng = new DeterministicRng(seed ^ 0x63ad125);
    this.directorRng = new DeterministicRng(seed ^ 0x7385ac);
    const worldRng = new DeterministicRng(seed);
    this.world = makeWorld(() => worldRng.next());
    this.bow = BOWS.find((b) => b.id === bowId) ?? BOWS[0];
    const hp = T.hp + 10 * (profile.boons.Vigor || 0);
    this.player = {
      x: 7500,
      y: 4250,
      hp,
      maxHp: hp,
      aim: 0,
      draw: 0,
      focus: 0,
      dodge: 0,
      cooldown: 0,
      dx: 0,
      dy: 0,
      invuln: 0,
      evade: 0,
      wind: 0,
      streak: 0,
      predator: 0,
      apex: 0,
    };
    this.rerolls = profile.boons.Reroll || 0;
    this.banishes = profile.boons.Banish || 0;
    this.skips = profile.boons.Skip || 0;
    if (practice) {
      this.scene = 'range';
      this.god = true;
      this.freezeSpawns = true;
      for (let i = 0; i < 12; i++)
        this.spawn(
          0,
          7500 + Math.cos((i / 12) * Math.PI * 2) * 360,
          4250 + Math.sin((i / 12) * Math.PI * 2) * 360,
          true,
        );
    }
  }
  /** Rebuild the enemy spatial index and crowd count from the live pool. */
  reindex() {
    this.hash.rebuild(this.enemies.items, isActive);
    let crowd = 0;
    for (const e of this.enemies.items) if (e.active) crowd++;
    this.crowd = crowd;
  }
  rank(id: string) {
    return this.ranks[id] || 0;
  }
  emit(id: string, x = this.player.x, y = this.player.y, value = 0) {
    const i = this.events.length;
    if (i >= 4096) return;
    let event = this.eventPool[i];
    if (event) {
      event.id = id;
      event.x = x;
      event.y = y;
      event.value = value;
    } else event = this.eventPool[i] = { id, x, y, value };
    this.events.push(event);
  }
  announce(text: string) {
    this.banner = text;
    this.bannerTime = 3;
    this.timeline.push(`${Math.floor(this.time)} ${text}`);
    this.emit('world.event');
  }
  /** Particle spray. color: 0 silver, 1 threat red, 2 focus violet, 3 elite. */
  burst(x: number, y: number, n = 12, color = 0) {
    const density = this.crowd > 150 ? 0.55 : 1;
    for (let i = 0; i < n * density; i++) {
      const q = this.particles.acquire();
      if (!q) break;
      const angle = this.rng.next() * Math.PI * 2,
        speed = 30 + this.rng.next() * 150;
      q.x = x;
      q.y = y;
      q.vx = Math.cos(angle) * speed;
      q.vy = Math.sin(angle) * speed;
      q.life = 0.25 + this.rng.next() * 0.5;
      q.max = 0.75;
      q.size = 1 + this.rng.next() * 3;
      q.color = color;
    }
  }
  spawn(kind: number, x?: number, y?: number, dummy = false, elite = -1): Enemy | undefined {
    const e = this.enemies.acquire();
    if (!e) return;
    const d = ENEMIES[kind];
    const angle = this.directorRng.next() * Math.PI * 2;
    const radius = len(this.viewport.width, this.viewport.height) * 0.6 + 150;
    const ex = x ?? this.player.x + Math.cos(angle) * radius,
      ey = y ?? this.player.y + Math.sin(angle) * radius;
    const scale = 1 + (0.12 * this.time) / 60,
      mult = this.phase >= 1 ? 1.25 : 1;
    e.x = clamp(ex, 80, T.worldWidth - 80);
    e.y = clamp(ey, 80, T.worldHeight - 80);
    e.id = this.enemyId++;
    e.kind = kind;
    e.hp = d.hp * scale * mult * (elite >= 0 ? 2.5 : 1);
    e.maxHp = d.hp * scale * mult * (elite >= 0 ? 2.5 : 1);
    e.r = d.radius;
    e.speed = d.speed * (this.phase === 3 ? 1.15 : 1) * (elite === 0 ? 1.45 : 1);
    e.damage = d.damage * (1 + (0.05 * this.time) / 60);
    e.xp = d.xp * (elite >= 0 ? 10 : 1);
    e.elite = elite;
    e.boss = -1;
    e.phase = 1;
    e.angle = angle;
    e.clock = 1 + this.directorRng.next();
    e.state = 0;
    e.tx = 0;
    e.ty = 0;
    e.flash = 0;
    e.age = 0;
    e.fade = 0;
    e.burn = 0;
    e.bleed = 0;
    e.poison = 0;
    e.slow = 0;
    e.freeze = 0;
    e.root = 0;
    e.mark = false;
    e.lastHit = 0;
    e.statusClock = 0;
    e.deadmark = false;
    e.dummy = dummy;
    if (!this.profile.seen.includes(d.id)) this.profile.seen.push(d.id);
    return e;
  }
  spawnBoss(index: number) {
    if (this.boss?.active) return;
    const e = this.spawn(0, this.player.x + 500, this.player.y);
    if (!e) return;
    const b = BOSSES[index];
    e.boss = index;
    e.hp = b.hp * (this.phase >= 1 ? 1.25 : 1);
    e.maxHp = b.hp * (this.phase >= 1 ? 1.25 : 1);
    e.r = b.radius;
    e.speed = 75;
    e.damage = 25;
    e.clock = 2;
    this.boss = e;
    this.bossMask |= 1 << index;
    this.announce(b.name);
    this.emit('boss.intro');
  }
  cap() {
    if (this.boss) return [20, 30, 40, 0][this.boss.boss];
    const t = this.time;
    return (
      Math.round(
        t < 120
          ? 8 + (t / 120) * 7
          : t < 300
            ? 15 + ((t - 120) / 180) * 45
            : t < 600
              ? 60 + ((t - 300) / 300) * 90
              : t < 900
                ? 150 + ((t - 600) / 300) * 150
                : 300 + ((t - 900) / 240) * 50,
      ) * (this.phase >= 1 ? 1.15 : 1)
    );
  }
  formation(id = Math.floor(this.rng.next() * 6)) {
    const angle = this.rng.next() * Math.PI * 2,
      radius = len(this.viewport.width, this.viewport.height) * 0.65 + 300,
      n = id === 3 ? 12 : 9;
    for (let i = 0; i < n; i++) {
      let a = angle,
        x = 0,
        y = 0;
      if (id === 3) {
        a = (i / n) * Math.PI * 2;
        x = Math.cos(a) * radius;
        y = Math.sin(a) * radius;
      } else {
        const across = (i - (n - 1) / 2) * 65,
          depth = id === 1 ? Math.abs(across) : id === 2 ? i * 70 : 0;
        a += id === 0 ? (i / n - 0.5) * 1.4 : 0;
        x = Math.cos(a) * (radius + depth) - Math.sin(a) * across;
        y = Math.sin(a) * (radius + depth) + Math.cos(a) * across;
        if (id === 4 && i % 2) {
          x = -x;
          y = -y;
        }
      }
      this.spawn(id === 4 ? 3 : id === 5 ? 1 : 0, this.player.x + x, this.player.y + y);
    }
    this.announce(FORMATIONS[id]);
    this.emit('formation.arrival');
  }
  startEvent(id = Math.floor(this.rng.next() * 4)) {
    if (this.phase === 3 && id === 2) id = 3;
    this.event = id;
    this.eventTimer = EVENTS[id].duration;
    this.eventX = this.player.x + 160;
    this.eventY = this.player.y + 80;
    this.groveRest = 0;
    this.announce(`${EVENTS[id].name} · ${EVENTS[id].hint}`);
    if (id === 0)
      for (let i = 0; i < 12; i++) {
        const e = this.spawn(4, this.player.x - 1000, this.player.y + (i - 6) * 90);
        if (e) {
          e.state = 2;
          e.angle = 0;
          e.clock = 6;
        }
      }
    if (id === 1)
      for (let i = 0; i < 4; i++)
        this.spawn(3, undefined, undefined, false, Math.floor(this.rng.next() * ELITES.length));
  }
  step(realDt: number, input: Input) {
    if (this.outcome || this.offers.length) return;
    this.bufferDodge = this.bufferDodge || input.dodge;
    this.bufferDeadeye = this.bufferDeadeye || input.deadeye;
    this.realTime += realDt;
    this.choiceGuard = Math.max(0, this.choiceGuard - realDt);
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      return;
    }
    const dodgeRequest = this.bufferDodge,
      deadeyeRequest = this.bufferDeadeye;
    this.bufferDodge = false;
    this.bufferDeadeye = false;
    const dt =
      realDt *
      (this.deadeye > 0 ? T.deadeyeScale : this.enemyDeadeye > 0 ? 0.35 : 1) *
      (this.slowMotion ? 0.25 : 1);
    const p = this.player;
    if (this.scene === 'hunt' || this.scene === 'range') this.time += dt;
    this.moving = len(input.mx, input.my) > 0.1;
    this.enemyDeadeye = Math.max(0, this.enemyDeadeye - realDt);
    this.bannerTime = Math.max(0, this.bannerTime - realDt);
    this.shake = Math.max(0, this.shake - realDt * T.shakeDecay);
    this.flash = Math.max(0, this.flash - realDt * 3);
    this.aim.x = input.ax;
    this.aim.y = input.ay;
    p.aim = Math.atan2(input.ay - p.y, input.ax - p.x);
    for (const key of ['cooldown', 'invuln', 'evade', 'wind', 'predator', 'apex'] as const)
      p[key] = Math.max(0, p[key] - dt);
    this.chainTime -= dt;
    if (this.chainTime <= 0) this.chain = 0;
    const profile = drawProfile(
      this.bow,
      this.rank('quick-nock'),
      this.rank('steady-hand'),
      this.rank('heavy-bow'),
      this.rank('swift-bow'),
    );
    if (dodgeRequest && p.cooldown <= 0) {
      const l = len(input.mx, input.my);
      p.dx = l ? input.mx / l : Math.cos(p.aim);
      p.dy = l ? input.my / l : Math.sin(p.aim);
      p.dodge = T.dodgeTime;
      p.cooldown = T.dodgeCooldown;
      p.invuln = T.dodgeTime;
      p.draw = 0;
      p.evade = 0.5;
      this.wasDraw = false;
      this.emit('player.dodge');
      this.burst(p.x, p.y, 15);
      if (this.rank('backstep'))
        for (let i = 0; i < 5; i++)
          loose(this, true, p.aim + Math.PI + (i - 2) * 0.22, 'phantom', 0.6, false);
      if (this.rank('phantom-step')) {
        const ghost = this.ghosts.acquire();
        if (ghost) {
          ghost.x = p.x;
          ghost.y = p.y;
          ghost.life = this.evolutions.has('phantom-hunt') ? 4 : 0.7;
        }
      }
    }
    if (p.dodge > 0) {
      const dodgeDt = Math.min(dt, p.dodge);
      p.x += ((p.dx * T.dodgeDistance) / T.dodgeTime) * dodgeDt;
      p.y += ((p.dy * T.dodgeDistance) / T.dodgeTime) * dodgeDt;
      p.dodge -= dt;
    } else {
      const l = len(input.mx, input.my) || 1;
      const drawMove = p.draw > 0 ? this.bow.mobility : 1;
      let speed =
        T.speed *
        (1 + 0.08 * this.rank('lightfoot') + 0.04 * (this.profile.boons.Swiftness || 0)) *
        (p.wind > 0 ? 1.2 : 1) *
        (p.predator > 0 ? 1 + 0.03 * this.rank('predator') * 5 : 1) *
        drawMove;
      const mire = this.world.landmarks[5];
      if (distance(p, mire) < 300) speed *= 0.75;
      p.x += (input.mx / l) * speed * dt;
      p.y += (input.my / l) * speed * dt;
    }
    blockedMove(p, 16, this.world.hash);
    for (const wall of this.threats.items)
      if (wall.active && wall.kind === 4) {
        const dx = p.x - wall.x,
          dy = p.y - wall.y,
          along = dx * Math.cos(wall.angle) + dy * Math.sin(wall.angle),
          across = -dx * Math.sin(wall.angle) + dy * Math.cos(wall.angle);
        if (along > 0 && along < wall.length && Math.abs(across) < wall.r + 16) {
          const push = (across >= 0 ? 1 : -1) * (wall.r + 16) - across;
          p.x -= Math.sin(wall.angle) * push;
          p.y += Math.cos(wall.angle) * push;
        }
      }
    if (this.boss) {
      const arena = 1050,
        dx = p.x - this.eventX,
        dy = p.y - this.eventY,
        d = len(dx, dy);
      if (d > arena) {
        p.x = this.eventX + (dx / d) * arena;
        p.y = this.eventY + (dy / d) * arena;
      }
    }
    if (p.dodge <= 0 && this.deadeye <= 0) {
      if (input.draw) {
        const before = p.draw;
        p.draw += dt;
        if (before < profile.full && p.draw >= profile.full) {
          this.emit('bow.window');
          this.burst(p.x, p.y, 8, 2);
        }
        const auto = this.assistLoose ? profile.full : profile.auto;
        if (p.draw >= auto && (this.assistLoose || (T.autoLoose && this.bow.id !== 'letoff'))) {
          loose(this, this.assistLoose, p.aim);
          p.draw = 0;
        }
      } else if (this.wasDraw && p.draw > 0) {
        loose(
          this,
          classifyDraw(p.draw, profile.full, profile.window) === 'perfect' ||
            !!(this.rank('evasive-shot') && p.evade > 0),
          p.aim,
        );
        p.draw = 0;
      }
    }
    this.wasDraw = input.draw;
    if (deadeyeRequest) {
      if (this.deadeye > 0) this.releaseDeadeye();
      else if (p.focus >= 100) {
        p.focus = 0;
        this.deadeye = T.deadeyeTime;
        this.focusMarks = 0;
        this.emit('deadeye.enter');
        this.announce('Deadeye');
      }
    }
    if (this.deadeye > 0) {
      this.deadeye -= realDt;
      const n = this.hash.query(input.ax, input.ay, 60, near);
      for (let i = 0; i < n; i++) {
        const e = near[i];
        if (
          e.active &&
          !e.deadmark &&
          distance(e, this.aim) < 60 &&
          this.focusMarks < this.bow.marks
        ) {
          e.deadmark = true;
          this.focusMarks++;
          this.emit('deadeye.mark', e.x, e.y, this.focusMarks);
        }
      }
      if (this.deadeye <= 0) this.releaseDeadeye();
    }
    const cell = Math.floor(p.y / 100) * 150 + Math.floor(p.x / 100);
    if (cell !== this.lastCell) {
      this.world.flow.rebuild(p.x, p.y);
      this.lastCell = cell;
    }
    this.reindex();
    updateEnemies(this, dt);
    updateArrows(this, dt);
    updateThreats(this, dt);
    if (this.boss?.active) updateBoss(this, this.boss, dt);
    this.updateTools(dt);
    this.updatePickups(dt);
    for (const q of this.particles.items)
      if (q.active) {
        q.life -= dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        if (q.life <= 0) q.active = false;
      }
    for (const g of this.ghosts.items)
      if (g.active) {
        g.life -= dt;
        if (g.life <= 0) g.active = false;
      }
    this.markClock -= dt;
    if (this.rank('hunter-s-mark') && this.markClock <= 0) {
      this.markClock = 4;
      let target: Enemy | null = null;
      for (const e of this.enemies.items)
        if (e.active && (!target || e.hp > target.hp) && distance(e, p) < 1000) target = e;
      if (target) target.mark = true;
    }
    if (this.scene === 'hunt') this.director(dt);
    if (this.scene === 'range' && this.challenge && !this.rangeWon) {
      const done =
        this.challenge === 'steady'
          ? this.perfects - this.challengePerfect >= 5 && this.time - this.challengeStart <= 10
          : this.challenge === 'sweet'
            ? this.rangeSweet >= 20
            : this.challenge === 'deadeye'
              ? this.rangeDeadeye >= 8
              : this.rangeInterrupt >= 3;
      if (done) {
        this.rangeWon = true;
        const first = !this.profile.challenges.includes(this.challenge);
        this.profile.currency += first ? 20 : 2;
        if (first) this.profile.challenges.push(this.challenge);
        this.announce('Challenge complete · ' + (first ? 20 : 2) + ' Moonsilver');
      }
      if (this.challenge === 'steady' && this.time - this.challengeStart > 10 && !done) {
        this.challengeStart = this.time;
        this.challengePerfect = this.perfects;
      }
    }
    if (p.hp <= 0 && !this.god) {
      if (this.profile.boons['Second Wind'] && !this.secondWind) {
        this.secondWind = true;
        p.hp = 1;
        p.invuln = 3;
        this.announce('Second Wind');
      } else this.finish('The Hunter Falls');
    }
    if (this.pendingLevels > 0 && this.deadeye <= 0) {
      this.pendingLevels--;
      this.offer();
    }
  }
  director(dt: number) {
    if (!this.profile.onboarded) {
      const stages = [4, 10, 25, 40];
      for (let stage = 0; stage < 4; stage++)
        if (this.time >= stages[stage] && !(this.tutorialMask & (1 << stage))) {
          this.tutorialMask |= 1 << stage;
          for (let i = 0; i < (stage === 0 ? 3 : 5); i++) {
            const e = this.spawn(
              0,
              this.player.x + 320 + (stage === 2 && i % 2 ? -640 : 0),
              this.player.y + (i - 2) * 60,
            );
            if (e && stage === 0) e.root = 4;
          }
        }
    }

    for (let i = 0; i < BOSSES.length; i++)
      if (this.time >= BOSSES[i].time && !(this.bossMask & (1 << i)) && !this.boss) {
        this.eventX = this.player.x;
        this.eventY = this.player.y;
        this.spawnBoss(i);
        if (i === 1) this.emit('world.midnight');
      }
    if (this.time >= 1200) {
      this.finish('Survived Until Dawn');
      return;
    }
    if (this.freezeSpawns || this.time >= 1140) return;
    this.spawnClock -= dt;
    if (this.spawnClock <= 0 && this.enemies.count < this.cap() && this.event !== 2) {
      this.spawnClock = Math.max(0.035, 0.7 - this.time / 1600);
      const available = ENEMIES.filter((e) => e.first <= this.time);
      const kind =
        this.directorRng.next() < 0.4 ? 0 : Math.floor(this.directorRng.next() * available.length);
      let elite = -1;
      const chance =
        this.time < 240
          ? 0
          : Math.min(0.08, 0.02 + ((this.time - 240) / 660) * 0.06) * (this.phase >= 2 ? 2 : 1);
      if (this.directorRng.next() < chance) elite = Math.floor(this.directorRng.next() * 6);
      this.spawn(kind, undefined, undefined, false, elite);
    }
    this.formationClock -= dt;
    if (this.formationClock <= 0 && !this.boss) {
      this.formationClock = this.time >= 600 ? 30 : 60;
      this.formation();
    }
    this.eventClock -= dt;
    if (this.eventClock <= 0 && !this.boss) {
      this.eventClock = 90;
      this.startEvent();
    }
    if (this.eventTimer > 0) {
      this.eventTimer -= dt;
      if (this.event === 2 && len(this.player.x - this.eventX, this.player.y - this.eventY) < 85) {
        this.groveRest += dt;
        if (this.groveRest >= 3) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
          this.groveRest = -100;
          this.emit('pickup.heal');
        }
      }
      if (this.eventTimer <= 0) this.event = -1;
    }
  }
  hurt(amount: number) {
    const p = this.player;
    if (this.god || p.invuln > 0 || p.dodge > 0) return;
    p.hp -= amount;
    p.invuln = T.invulnerability;
    this.shake = T.maxShake;
    this.emit('player.hurt');
    this.burst(p.x, p.y, 16, 1);
  }
  kill(e: Enemy) {
    if (!e.active) return;
    e.active = false;
    this.kills++;
    this.chain = Math.min(10, this.chain + 1);
    this.chainTime = this.evolutions.has('apex-hunter') ? 3.5 : 1.5;
    this.player.predator = 3;
    this.burst(e.x, e.y, e.boss >= 0 ? 80 : 12, e.elite >= 0 ? 3 : 1);
    this.emit('enemy.kill.' + ENEMIES[e.kind].id, e.x, e.y);
    const drop = this.pickups.acquire();
    if (drop) {
      drop.x = e.x;
      drop.y = e.y;
      drop.value = e.xp;
      drop.kind = e.elite >= 0 ? 1 : 0;
    }
    if (this.rng.next() < 0.025) {
      const berry = this.pickups.acquire();
      if (berry) {
        berry.x = e.x + 12;
        berry.y = e.y;
        berry.value = 20;
        berry.kind = 2;
      }
    }
    if (this.kills % 10 === 0) this.earned++;
    if (e.elite >= 0) {
      this.earned += 5;
      this.player.focus = Math.min(100, this.player.focus + T.focusElite);
      this.emit('enemy.elite.kill');
      this.hitstop = T.hitstopElite;
    }
    if (e.boss >= 0) {
      this.earned += 50;
      const id = BOSSES[e.boss].id;
      if (!this.profile.bosses.includes(id)) this.profile.bosses.push(id);
      this.boss = null;
      this.emit('relic.open');
      if (e.boss === 3) {
        this.finish('Hunt Complete');
        return;
      }
      this.offer(true);
    }
    if (distance(e, this.player) >= this.bow.near && distance(e, this.player) <= this.bow.far)
      this.sweetKills++;
    applyEvolutionRules(this, 'kill', e, undefined, 0);
  }
  gainXp(value: number) {
    this.xp += value * (1 + 0.05 * (this.profile.boons.Growth || 0));
    while (this.xp >= xpNeeded(this.level)) {
      this.xp -= xpNeeded(this.level);
      this.level++;
      this.pendingLevels++;
      this.emit('level.up');
    }
  }
  updatePickups(dt: number) {
    const p = this.player,
      r = 90 * (1 + 0.2 * (this.profile.boons.Magnet || 0));
    for (const q of this.pickups.items)
      if (q.active) {
        const dx = q.x - p.x,
          dy = q.y - p.y,
          d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          q.x += (p.x - q.x) * dt * 10;
          q.y += (p.y - q.y) * dt * 10;
          if (d2 < 400) {
            q.active = false;
            if (q.kind === 2) {
              p.hp = Math.min(p.maxHp, p.hp + q.value);
              this.emit('pickup.heal');
            } else {
              this.gainXp(q.value);
              this.emit('pickup.xp', q.x, q.y);
            }
          }
        }
      }
  }
  updateTools(dt: number) {
    const p = this.player;
    this.toolClock -= dt;
    this.snareClock -= dt;
    const raven = this.rank('moonraven');
    if (raven && this.toolClock <= 0) {
      this.toolClock = 2.5 - 0.3 * (raven - 1);
      let nearest: Enemy | null = null;
      for (const e of this.enemies.items)
        if (e.active && (!nearest || distance(e, p) < distance(nearest, p))) nearest = e;
      if (nearest) {
        this.toolTarget.x = nearest.x;
        this.toolTarget.y = nearest.y;
        damageEnemy(this, nearest, 30 * (1 + 0.15 * (raven - 1)), undefined, 'moonraven');
        this.emit('tool.moonraven');
        this.burst(nearest.x, nearest.y, 15);
        if (raven === 5)
          for (const q of this.pickups.items)
            if (q.active && distance(q, p) < 300) {
              q.x = p.x;
              q.y = p.y;
            }
      }
    }
    const snare = this.rank('thornsnare');
    if (snare && this.snareClock <= 0 && this.snareHeld < snare) {
      this.snareClock = 5 - 0.5 * (snare - 1);
      const t = this.threats.acquire();
      if (t) {
        t.kind = 5;
        t.x = p.x;
        t.y = p.y;
        t.r = 35;
        t.clock = 0;
        t.duration = 25;
        t.damage = 20;
        t.owner = -1;
        t.vx = 0;
        t.vy = 0;
        t.length = 0;
        t.angle = 0;
        this.snareHeld++;
        this.emit('tool.snare.place');
      }
    }
    const lantern = this.rank('lantern');
    if (lantern) {
      const r = 140 + 20 * (lantern - 1);
      const n = this.hash.query(p.x, p.y, r, near);
      for (let i = 0; i < n; i++) {
        const e = near[i];
        if (e.active && distance(e, p) < r) {
          e.fade = 0;
          damageEnemy(this, e, (6 + 3 * (lantern - 1)) * dt, undefined, 'lantern');
        }
      }
    }
  }
  /** Perf gate scene: tops the field up to `enemies` crowd members and `arrows` live arrows. */
  stressFill(enemies = 350, arrows = 600) {
    const p = this.player;
    this.freezeSpawns = true;
    this.god = true;
    let alive = 0,
      flying = 0;
    for (const e of this.enemies.items) if (e.active) alive++;
    for (const a of this.arrows.items) if (a.active) flying++;
    for (let i = alive; i < enemies; i++) {
      const slot = (this.enemyId * 7) % enemies;
      this.spawn(
        slot % 8,
        p.x + ((slot % 25) - 12) * 42,
        p.y + (Math.floor(slot / 25) - 7) * 45 + (slot % 2) * 12,
      );
    }
    for (let i = flying; i < arrows; i++) {
      const a = this.arrows.acquire();
      if (!a) break;
      const angle = (i * 2.399963) % (Math.PI * 2),
        speed = T.arrowSpeed;
      a.x = p.x + Math.cos(angle) * 24;
      a.y = p.y + Math.sin(angle) * 24;
      a.vx = Math.cos(angle) * speed;
      a.vy = Math.sin(angle) * speed;
      a.life = T.arrowRange / speed;
      a.damage = 4;
      a.pierce = 3;
      a.perfect = false;
      a.full = true;
      a.crit = false;
      a.r = 3;
      a.source = 'bow';
      a.travel = 0;
      a.hitCount = 0;
    }
  }
  releaseDeadeye() {
    this.deadeye = 0;
    for (const e of this.enemies.items)
      if (e.active && e.deadmark) {
        e.deadmark = false;
        loose(
          this,
          true,
          Math.atan2(e.y - this.player.y, e.x - this.player.x),
          'deadeye',
          T.deadeyeDamage * (this.bow.id === 'sparrow' ? 0.8 : 1),
          false,
        );
      }
    this.shake = T.maxShake;
    this.emit('deadeye.release');
  }
  eligible() {
    return EVOLUTIONS.filter(
      (e) => !this.evolutions.has(e.id) && e.ingredients.every((i) => this.rank(i) > 0),
    );
  }
  offer(relic = false) {
    if (this.outcome) return;
    const count = relic ? 3 : this.profile.boons['Fourth Card'] ? 4 : 3;
    this.offers = [];
    const eligible = this.eligible();
    if (eligible.length)
      this.offers.push('evo:' + eligible[Math.floor(this.cardRng.next() * eligible.length)].id);
    const pool = UPGRADES.filter(
      (u) =>
        this.rank(u.id) < u.cap &&
        !this.banished.has(u.id) &&
        (!u.locked || this.unlockedAll || this.profile.wins > 0 || this.profile.kills >= 1000),
    );
    const choices = [
      ...pool.map((u) => u.id),
      ...TOOLS.filter((t) => this.rank(t.id) < 5).map((t) => t.id),
    ];
    while (this.offers.length < count && choices.length) {
      const groups = ['Common', 'Uncommon', 'Rare']
        .map((rarity) => ({
          rarity,
          ids: choices.filter(
            (id) => (UPGRADES.find((u) => u.id === id)?.rarity ?? 'Common') === rarity,
          ),
        }))
        .filter((group) => group.ids.length);
      const group = this.cardRng.weighted(
        groups,
        groups.map((group) =>
          group.rarity === 'Rare' ? 10 : group.rarity === 'Uncommon' ? 30 : 60,
        ),
      );
      const id = this.cardRng.pick(group.ids);
      this.offers.push(id);
      choices.splice(choices.indexOf(id), 1);
    }
    if (!this.offers.length) this.offers = ['heal', 'silver'];
    this.choiceGuard = 0.4;
  }
  startChallenge(id: string) {
    this.challenge = id;
    this.challengeStart = this.time;
    this.challengePerfect = this.perfects;
    this.rangeSweet = 0;
    this.rangeDeadeye = 0;
    this.rangeInterrupt = 0;
    this.rangeWon = false;
    this.player.focus = id === 'deadeye' ? 100 : 0;
    if (id === 'duel') {
      for (const e of this.enemies.items) if (e.active && e.dummy) e.kind = 3;
    }
    this.announce(
      id === 'steady'
        ? '5 perfect looses in 10 seconds'
        : id === 'sweet'
          ? '20 sweet-spot hits while moving'
          : id === 'deadeye'
            ? 'Mark and hit 8 targets in one Deadeye'
            : 'Interrupt 3 Poachers mid-draw',
    );
  }
  choose(index: number) {
    if (this.choiceGuard > 0) return;
    const id = this.offers[index];
    if (!id) return;
    this.grant(id);
    this.offers = [];
    this.wasDraw = false;
    this.player.draw = 0;
  }
  grant(id: string) {
    if (id.startsWith('evo:')) {
      const evo = id.slice(4);
      this.evolutions.add(evo);
      this.emit('evolution.unlocked');
      this.announce(EVOLUTIONS.find((e) => e.id === evo)?.name ?? evo);
    } else if (id === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
    else if (id === 'silver') this.earned += 15;
    else this.ranks[id] = Math.min(UPGRADES.find((u) => u.id === id)?.cap ?? 5, this.rank(id) + 1);
    this.emit('ui.select');
  }
  reroll() {
    if (this.rerolls > 0) {
      this.rerolls--;
      this.offer();
    }
  }
  banish(index: number) {
    if (this.banishes > 0 && this.offers[index] && !this.offers[index].startsWith('evo:')) {
      this.banishes--;
      this.banished.add(this.offers[index]);
      this.offer();
    }
  }
  skip() {
    if (this.skips > 0) {
      this.skips--;
      this.offers = [];
    }
  }
  finish(outcome: string) {
    if (this.outcome) return;
    this.outcome = outcome;
    this.offers = [];
    this.earned = Math.floor(
      (this.earned + Math.floor(this.time / 60) * 5) *
        (outcome === 'Hunt Complete' ? 1.5 : 1) *
        (1 + 0.08 * (this.profile.boons.Greed || 0)),
    );
    this.emit(outcome === 'The Hunter Falls' ? 'player.death' : 'world.dawn');
  }
}
