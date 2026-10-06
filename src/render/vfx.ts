import { Container, Sprite, type Texture } from 'pixi.js';
import { PALETTE, JUICE, tint } from '../data/art';
import type { Hunt } from '../sim/game';

const VIOLET = tint(PALETTE.focus),
  RED = tint(PALETTE.threat.base),
  HOT = tint(PALETTE.threat.rim),
  ELITE = tint(PALETTE.elite.rim),
  SILVER = tint(PALETTE.silver);

interface Fx {
  sprite: Sprite;
  life: number;
  max: number;
  vx: number;
  vy: number;
  from: number;
  to: number;
  alpha: number;
  stretch: boolean;
}

/**
 * Presentation-only effects (sparks, rings, blooms) driven by sim events.
 * Never feeds back into the simulation; uses its own random stream so effects
 * don't perturb the deterministic sim RNG.
 */
export class Vfx {
  readonly layer = new Container();
  private readonly pool: Fx[] = [];
  private cursor = 0;
  private seed = 1;
  /** Effects still allowed this frame; crowds degrade to fewer sparks, not slower frames. */
  private budget = 0;
  reducedMotion = false;
  constructor(private readonly art: Record<string, Texture>) {
    for (let i = 0; i < JUICE.pool; i++) {
      const sprite = new Sprite(art.spark);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.layer.addChild(sprite);
      this.pool.push({
        sprite,
        life: 0,
        max: 1,
        vx: 0,
        vy: 0,
        from: 1,
        to: 1,
        alpha: 1,
        stretch: false,
      });
    }
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) | 0;
    return (this.seed >>> 0) / 4294967296;
  }
  /** Next slot in rotation: slots are handed out in order, so the next one is the oldest. */
  private take(): Fx {
    const fx = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return fx;
  }
  private emit(
    texture: string,
    x: number,
    y: number,
    color: number,
    life: number,
    from: number,
    to: number,
    alpha: number,
    vx = 0,
    vy = 0,
  ) {
    if (this.budget <= 0) return;
    this.budget--;
    const fx = this.take();
    fx.sprite.texture = this.art[texture];
    fx.sprite.position.set(x, y);
    fx.sprite.tint = color;
    fx.sprite.visible = true;
    fx.sprite.rotation = vx || vy ? Math.atan2(vy, vx) : 0;
    fx.life = fx.max = life;
    fx.from = from;
    fx.to = this.reducedMotion ? from : to;
    fx.alpha = alpha;
    fx.vx = vx;
    fx.vy = vy;
    fx.stretch = texture === 'spark';
  }
  sparks(x: number, y: number, n: number, color: number, speed: number, life: number) {
    if (this.reducedMotion) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = this.random() * Math.PI * 2,
        v = speed * (0.5 + this.random() * 0.8);
      this.emit(
        'spark',
        x,
        y,
        color,
        life * (0.7 + this.random() * 0.6),
        0.9,
        0.3,
        1,
        Math.cos(a) * v,
        Math.sin(a) * v,
      );
    }
  }
  ring(x: number, y: number, color: number, life: number, from: number, to: number, alpha = 0.9) {
    this.emit('ring', x, y, color, life, from, to, alpha);
  }
  bloom(x: number, y: number, color: number, life: number, from: number, to: number, alpha = 0.9) {
    this.emit('bloom', x, y, color, life, from, to, alpha);
  }
  /** Translate this frame's sim events into effects. */
  handle(g: Hunt) {
    const p = g.player;
    this.budget = JUICE.perFrame;
    for (const e of g.events) {
      const id = e.id;
      if (id.startsWith('enemy.hit.')) {
        const armor = id === 'enemy.hit.armor';
        this.sparks(e.x, e.y, armor ? 5 : 3, armor ? SILVER : HOT, armor ? 260 : 200, 0.16);
      } else if (id.startsWith('enemy.kill.')) {
        this.bloom(e.x, e.y, RED, JUICE.deathFlash, 0.5, 1.1, 0.85);
        this.ring(e.x, e.y, RED, 0.28, 0.25, 0.9, 0.8);
        this.sparks(e.x, e.y, 6, RED, 240, 0.26);
      } else if (id === 'enemy.elite.kill') {
        this.ring(e.x, e.y, ELITE, 0.4, 0.4, 1.6, 0.9);
      } else if (id === 'bow.perfect') {
        const bx = p.x + Math.cos(p.aim) * 22,
          by = p.y + Math.sin(p.aim) * 22;
        this.bloom(bx, by, VIOLET, JUICE.perfectBloom, 0.35, 1.5, 1);
        this.ring(bx, by, VIOLET, JUICE.perfectBloom, 0.15, 0.7, 1);
      } else if (id === 'bow.window') {
        this.ring(
          p.x + Math.cos(p.aim) * 22,
          p.y + Math.sin(p.aim) * 22,
          VIOLET,
          0.18,
          0.1,
          0.35,
          0.8,
        );
      } else if (id === 'deadeye.mark') {
        this.ring(e.x, e.y, VIOLET, 0.3, 0.9, 0.45, 1);
      } else if (id === 'deadeye.release' || id === 'deadeye.enter') {
        this.ring(p.x, p.y, VIOLET, 0.45, 0.3, 2.6, 0.7);
      } else if (id === 'player.hurt') {
        this.bloom(p.x, p.y, RED, 0.2, 0.6, 1.2, 0.7);
      }
    }
  }
  update(dt: number) {
    for (const fx of this.pool) {
      if (fx.life <= 0) continue;
      fx.life -= dt;
      if (fx.life <= 0) {
        fx.sprite.visible = false;
        continue;
      }
      const t = 1 - fx.life / fx.max,
        s = fx.from + (fx.to - fx.from) * t;
      fx.sprite.x += fx.vx * dt;
      fx.sprite.y += fx.vy * dt;
      fx.vx *= 0.9;
      fx.vy *= 0.9;
      if (fx.stretch) fx.sprite.scale.set(s, 1);
      else fx.sprite.scale.set(s);
      fx.sprite.alpha = fx.alpha * (1 - t) * (1 - t * 0.3);
    }
  }
}
