import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { PALETTE, DIEGETIC, tint } from '../data/art';
import { drawProfile, classifyDraw } from '../sim/bow';
import { T } from '../data/tuning';
import type { Hunt } from '../sim/game';

const VIOLET = tint(PALETTE.focus),
  VIOLET_LIGHT = tint(PALETTE.focusLight),
  SILVER = tint(PALETTE.silver);

/**
 * In-world readouts on the hunter: bowstring tension (the draw window lives on the string),
 * a nocked arrow, Focus as moonlight gathering on the body, and a dodge-recovery pip.
 */
export class Diegetic {
  readonly under = new Container();
  readonly over = new Container();
  private readonly string = new Graphics();
  private readonly nocked: Sprite;
  private readonly halo: Sprite;
  private readonly motes: Sprite[] = [];
  private readonly pip = new Graphics();
  reducedMotion = false;
  /** A rendered sprite sheet draws its own bow; the overlay string and nocked arrow step aside. */
  sheetBow = false;
  constructor(art: Record<string, Texture>) {
    this.halo = new Sprite(art.bloom);
    this.halo.anchor.set(0.5);
    this.halo.tint = VIOLET;
    this.under.addChild(this.halo, this.pip);
    for (let i = 0; i < DIEGETIC.motes; i++) {
      const m = new Sprite(art.bloom);
      m.anchor.set(0.5);
      m.tint = VIOLET_LIGHT;
      this.under.addChild(m);
      this.motes.push(m);
    }
    this.nocked = new Sprite(art.arrow);
    this.nocked.anchor.set(0.5);
    this.over.addChild(this.nocked, this.string);
  }
  update(g: Hunt, scale: number) {
    const p = g.player,
      cos = Math.cos(p.aim),
      sin = Math.sin(p.aim),
      local = (x: number, y: number, out: number[]) => {
        out[0] = p.x + (x * cos - y * sin) * scale;
        out[1] = p.y + (x * sin + y * cos) * scale;
      };
    // Bowstring: tips on the baked bow, nock pulled back by draw progress.
    const profile = drawProfile(
      g.bow,
      g.rank('quick-nock'),
      g.rank('steady-hand'),
      g.rank('heavy-bow'),
      g.rank('swift-bow'),
    );
    const state = p.draw > 0 ? classifyDraw(p.draw, profile.full, profile.window) : 'idle',
      progress = Math.min(1, p.draw / profile.full),
      perfect = state === 'perfect',
      over = state === 'overdraw',
      tremble =
        over && !this.reducedMotion
          ? Math.sin(g.realTime * 70) * Math.min(3, (p.draw - profile.full - profile.window) * 6)
          : 0;
    const pull = DIEGETIC.restX - progress * DIEGETIC.pull;
    local(DIEGETIC.tipX, -DIEGETIC.tipY, A);
    local(pull, tremble, N);
    local(DIEGETIC.tipX, DIEGETIC.tipY, B);
    const s = this.string;
    s.clear();
    if (g.scene !== 'camp' && !this.sheetBow) {
      const glow = perfect ? VIOLET : SILVER,
        glowAlpha = perfect ? 0.85 : over ? 0.12 : 0.1 + progress * 0.35;
      s.moveTo(A[0], A[1])
        .lineTo(N[0], N[1])
        .lineTo(B[0], B[1])
        .stroke({ color: glow, width: perfect ? 7 : 3 + progress * 3, alpha: glowAlpha });
      s.moveTo(A[0], A[1])
        .lineTo(N[0], N[1])
        .lineTo(B[0], B[1])
        .stroke({
          color: perfect ? VIOLET_LIGHT : 0xffffff,
          width: 1.4,
          alpha: over ? 0.55 : 0.95,
        });
    }
    // Nocked arrow rides the string while drawing.
    this.nocked.visible = p.draw > 0 && !this.sheetBow;
    if (this.nocked.visible) {
      local(pull + 26, tremble, N);
      this.nocked.position.set(N[0], N[1]);
      this.nocked.rotation = p.aim;
      this.nocked.scale.set(0.55 * (scale / 0.7));
      this.nocked.tint = perfect ? VIOLET_LIGHT : 0xffffff;
      this.nocked.alpha = 0.5 + 0.5 * progress;
    }
    // Focus: moonlight motes spiral in; at full Focus they settle into a steady halo.
    const focus = p.focus / 100,
      lit = Math.ceil(focus * this.motes.length),
      t = this.reducedMotion ? 0 : g.realTime;
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.visible = i < lit && focus < 1;
      if (!m.visible) continue;
      const phase = (t * 0.35 + i / this.motes.length) % 1,
        r = DIEGETIC.moteFar - (DIEGETIC.moteFar - DIEGETIC.moteNear) * phase,
        a = i * 2.39996 + t * 1.4;
      m.position.set(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
      m.scale.set(0.06 + 0.05 * phase);
      m.alpha = (0.25 + 0.6 * phase) * (0.4 + 0.6 * focus);
    }
    this.halo.position.set(p.x, p.y);
    this.halo.visible = focus > 0.05;
    const pulse = focus >= 1 && !this.reducedMotion ? 0.08 * Math.sin(g.realTime * 4) : 0;
    this.halo.scale.set(0.45 + 0.3 * focus + (focus >= 1 ? 0.15 : 0) + pulse);
    this.halo.alpha = focus >= 1 ? 0.85 : focus * 0.3;
    this.pip.clear();
    if (g.scene === 'camp') return;
    // Perfect window: a ring closes on the hunter as the bow draws; it locks violet while the
    // window is open and greys out once it has passed.
    if (p.draw > 0) {
      const target = 30,
        r = target + (1 - progress) * 46;
      this.pip.circle(p.x, p.y, target).stroke({
        color: perfect ? VIOLET_LIGHT : SILVER,
        width: perfect ? 3 : 1,
        alpha: perfect ? 1 : 0.35,
      });
      if (!perfect && !over)
        this.pip
          .circle(p.x, p.y, r)
          .stroke({ color: SILVER, width: 2, alpha: 0.25 + progress * 0.6 });
      if (perfect) this.pip.circle(p.x, p.y, target).fill({ color: VIOLET, alpha: 0.18 });
      if (over)
        this.pip.circle(p.x, p.y, target + 4).stroke({ color: 0x6f829c, width: 1, alpha: 0.5 });
    }
    // Dodge charges: one pip per charge at the hunter's feet; a recharging pip fills as an arc.
    for (let i = 0; i < T.dodgeCharges; i++) {
      const x = p.x + (i - (T.dodgeCharges - 1) / 2) * 12,
        y = p.y + 20;
      if (i < p.charges) this.pip.circle(x, y, 3.2).fill({ color: SILVER, alpha: 0.9 });
      else {
        this.pip.circle(x, y, 3.2).stroke({ color: SILVER, width: 1, alpha: 0.35 });
        if (i === p.charges && p.cooldown > 0) {
          const left = 1 - p.cooldown / T.dodgeCooldown;
          this.pip
            .arc(x, y, 3.2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left)
            .stroke({ color: SILVER, width: 1.6, alpha: 0.8 });
        }
      }
    }
  }
}
const A = [0, 0],
  B = [0, 0],
  N = [0, 0];
