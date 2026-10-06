import {
  Application,
  Container,
  Sprite,
  Graphics,
  Texture,
  Assets,
  Text,
  ColorMatrixFilter,
} from 'pixi.js';
import { Vfx } from './vfx';
import { Diegetic } from './diegetic';
import { Atmosphere } from './ground';

import { UNIT } from './silhouettes';
import { BOSSES } from '../data/bosses';
import { T } from '../data/tuning';
import { ART_PATHS } from '../data/artPaths';
import { bakeArt, BOSS_HALF } from './art';
import type { Hunt } from '../sim/game';
import { ENEMIES } from '../data/enemies';
import { STATIONS } from '../data/world';
import { PALETTE, JUICE, tint } from '../data/art';

/** Palette as Pixi tints. */
const C = {
  silver: tint(PALETTE.silver),
  focus: tint(PALETTE.focus),
  focusLight: tint(PALETTE.focusLight),
  threat: tint(PALETTE.threat.telegraph),
  threatBase: tint(PALETTE.threat.base),
  elite: tint(PALETTE.elite.rim),
  colorblind: tint(PALETTE.colorblindThreat),
  heal: tint(PALETTE.heal),
  phantom: 0x9fc4ff,
};
export class View {
  readonly app = new Application();
  readonly root = new Container();
  atmosphere!: Atmosphere;
  vfx!: Vfx;
  diegetic!: Diegetic;
  trailSprites: Sprite[] = [];
  markGlows: Sprite[] = [];
  readonly deadeyeFilter = new ColorMatrixFilter();
  /** Accessibility: no shake, no scale pulses, no fog drift, dimmed flashes. */
  reducedMotion = false;
  readonly cover = new Container();
  readonly effects = new Container();
  readonly actors = new Container();
  readonly arrows = new Container();
  readonly threatLayer = new Container();
  /** The hunter draws above every threat so it is never lost in a crowd. */
  readonly hero = new Container();
  readonly cutout = new Sprite();
  readonly overlay = new Graphics();
  readonly worldLines = new Graphics();
  /** Static world marks (landmarks), tessellated once per attach. */
  readonly landmarks = new Graphics();
  readonly threatGraphics = new Graphics();
  numbers = false;
  numberSlots: { text: Text; life: number }[] = [];
  art: Record<string, Texture> = {};
  enemySprites: Sprite[] = [];
  arrowSprites: Sprite[] = [];
  pickupSprites: Sprite[] = [];
  particleSprites: Sprite[] = [];
  coverSprites: Sprite[] = [];
  hunter = new Sprite();
  weakPoint = new Sprite();
  raven = new Sprite();
  ghostSprites: Sprite[] = [];
  camera = { x: 7500, y: 4250 };
  zoom = 1;
  width = 1400;
  height = 850;
  camp = false;
  aimScreen = { x: 900, y: 430 };
  shake = 1;
  colorblind = false;
  showBands = true;
  fps = 60;
  last = 0;
  frames: number[] = [];
  /** Smoothed per-frame CPU cost (ms): simulation, scene build, and GPU submit. */
  timing = { sim: 0, scene: 0, submit: 0, atmosphere: 0 };
  async init(canvas: HTMLCanvasElement) {
    await this.app.init({
      canvas,
      resizeTo: window,
      background: PALETTE.background,
      antialias: false,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    this.art = bakeArt();
    for (const [id, path] of Object.entries(ART_PATHS))
      this.art[id] = await Assets.load<Texture>(path);
    this.atmosphere = new Atmosphere(this.art, T.worldWidth, T.worldHeight);
    this.app.stage.addChild(this.root);
    this.root.addChild(
      this.atmosphere.ground,
      this.atmosphere.decals,
      this.atmosphere.mistLow,
      this.cover,
      this.landmarks,
      this.worldLines,
      this.effects,
      this.arrows,
      this.actors,
      this.threatLayer,
    );
    this.threatLayer.addChild(this.threatGraphics);
    this.weakPoint.texture = this.art.ring;
    this.weakPoint.anchor.set(0.5);
    this.weakPoint.tint = tint(PALETTE.weak);
    this.weakPoint.visible = false;
    this.threatLayer.addChild(this.weakPoint);
    this.root.addChild(this.hero, this.atmosphere.mistHigh);
    this.app.stage.addChild(this.atmosphere.vignette, this.overlay);
    this.hunter.texture = this.art.hunter;
    this.hunter.anchor.set(0.5);
    this.hunter.scale.set(0.7);
    this.diegetic = new Diegetic(this.art);
    this.cutout.texture = this.art.bloom;
    this.cutout.anchor.set(0.5);
    this.cutout.tint = tint(PALETTE.background);
    this.cutout.alpha = 0.75;
    this.hero.addChild(this.cutout, this.diegetic.under, this.hunter, this.diegetic.over);
    this.raven.texture = this.art.raven;
    this.raven.anchor.set(0.5);
    this.raven.scale.set(0.45);
    this.effects.addChild(this.raven);
    for (let i = 0; i < 3; i++) {
      const s = this.sprite(this.art.hunter, this.actors);
      s.tint = C.phantom;
      s.alpha = 0.25;
      s.scale.set(0.7);
      this.ghostSprites.push(s);
    }
    this.enemySprites = this.pool(500, this.art.husk, this.threatLayer);
    this.trailSprites = this.pool(1400, this.art.trail, this.arrows);
    for (const t of this.trailSprites) t.anchor.set(1, 0.5);
    this.arrowSprites = this.pool(1400, this.art.arrow, this.arrows);
    this.markGlows = this.pool(40, this.art.bloom, this.effects);
    for (const m of this.markGlows) m.tint = C.focus;
    this.vfx = new Vfx(this.art);
    this.root.addChildAt(this.vfx.layer, this.root.getChildIndex(this.threatLayer));
    this.deadeyeFilter.saturate(-JUICE.deadeyeDesaturate);
    this.root.filterArea = this.app.screen;
    this.pickupSprites = this.pool(1600, this.art.xp, this.effects);
    this.particleSprites = this.pool(2000, this.art.particle, this.effects);
    this.threatLayer.addChild(this.threatGraphics);
    for (let i = 0; i < 60; i++) {
      const text = new Text({
        text: '',
        style: { fontFamily: 'Georgia', fontSize: 18, fill: C.silver },
      });
      text.anchor.set(0.5);
      text.visible = false;
      this.threatLayer.addChild(text);
      this.numberSlots.push({ text, life: 0 });
    }
  }
  sprite(texture: Texture, parent: Container) {
    const s = new Sprite(texture);
    s.anchor.set(0.5);
    s.visible = false;
    parent.addChild(s);
    return s;
  }
  pool(n: number, t: Texture, p: Container) {
    return Array.from({ length: n }, () => this.sprite(t, p));
  }
  attach(g: Hunt, camp = false) {
    this.camp = camp;
    this.camera.x = g.player.x;
    this.camera.y = g.player.y;
    this.cover.removeChildren().forEach((c) => c.destroy());
    this.coverSprites = [];
    for (const o of g.world.obstacles) {
      const s = this.sprite(this.art[o.kind ? 'stone' : 'tree'], this.cover);
      s.position.set(o.x, o.y);
      s.scale.set(o.kind ? o.r / 24 : o.r / 22);
      this.coverSprites.push(s);
    }
    this.landmarks.clear();
    for (const l of g.world.landmarks) {
      this.landmarks.circle(l.x, l.y, l.name === 'Moonwell Clearing' ? 260 : 130).stroke({
        color: 0x6685a5,
        alpha: 0.14,
        width: 2,
      });
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        this.landmarks
          .moveTo(l.x + Math.cos(a) * 120, l.y + Math.sin(a) * 120)
          .lineTo(l.x + Math.cos(a) * 145, l.y + Math.sin(a) * 145)
          .stroke({ color: 0x879bbb, alpha: 0.2, width: 2 });
      }
    }
  }
  screenToWorld(x: number, y: number) {
    return {
      x: (x - this.width / 2) / this.zoom + this.camera.x,
      y: (y - this.height / 2) / this.zoom + this.camera.y,
    };
  }
  render(g: Hunt, realDt: number) {
    const sceneStart = performance.now();
    this.width = innerWidth;
    this.height = innerHeight;
    const p = g.player;
    const targetZoom = g.boss || g.deadeye > 0 ? 0.9 : 1;
    this.zoom += (targetZoom - this.zoom) * Math.min(1, realDt * 4);
    const look = this.camp ? 0 : Math.min(this.width * 0.18, 120);
    const targetX = p.x + Math.cos(p.aim) * look,
      targetY = p.y + Math.sin(p.aim) * look;
    this.camera.x += (targetX - this.camera.x) * Math.min(1, realDt * 8);
    this.camera.y += (targetY - this.camera.y) * Math.min(1, realDt * 8);
    const shake = this.reducedMotion ? 0 : Math.min(g.shake, T.maxShake) * this.shake,
      sx = Math.sin(g.realTime * 89) * shake,
      sy = Math.cos(g.realTime * 113) * shake;
    this.root.scale.set(this.zoom);
    this.root.position.set(
      this.width / 2 - this.camera.x * this.zoom + sx,
      this.height / 2 - this.camera.y * this.zoom + sy,
    );
    const atmosphereStart = performance.now();
    this.atmosphere.update(this, this.reducedMotion ? 0 : g.realTime);
    this.timing.atmosphere += (performance.now() - atmosphereStart - this.timing.atmosphere) * 0.1;
    for (let i = 0; i < this.coverSprites.length; i++) {
      const s = this.coverSprites[i];
      s.visible =
        Math.abs(s.x - this.camera.x) < this.width / 2 / this.zoom + 150 &&
        Math.abs(s.y - this.camera.y) < this.height / 2 / this.zoom + 150;
    }
    const dim = g.crowd > 150 ? 0.7 : 1;
    for (let i = 0; i < g.enemies.items.length; i++) {
      const e = g.enemies.items[i],
        s = this.enemySprites[i];
      s.visible = e.active;
      if (!e.active) continue;
      s.position.set(e.x, e.y);
      if (e.boss >= 0) {
        const art = BOSSES[e.boss].art;
        s.texture = this.art['boss.' + BOSSES[e.boss].id];
        s.rotation = art.faces ? e.angle : 0;
        s.scale.set(art.size / (BOSS_HALF * 2));
      } else {
        s.texture = this.art[e.elite >= 0 ? ENEMIES[e.kind].id + '.elite' : ENEMIES[e.kind].id];
        s.rotation = e.angle;
        s.scale.set((e.r / UNIT) * (this.reducedMotion ? 1 : 1 + e.flash * JUICE.hitPunch));
      }
      s.alpha = e.fade > 0 ? 0.17 : e.kind === 6 && e.state === 0 ? 0.5 : Math.min(1, e.age / 0.4);
      if (
        g.event === 3 &&
        Math.hypot(e.x - p.x, e.y - p.y) > 250 &&
        !e.deadmark &&
        !g.rank('lantern')
      )
        s.alpha *= 0.22;
    }
    // Boss weak point: a slow pulse ring over the baked white-hot core.
    const boss = g.boss?.active ? g.boss : null;
    this.weakPoint.visible = !!boss;
    if (boss) {
      const art = BOSSES[boss.boss].art,
        k = art.size / (BOSS_HALF * 2),
        rot = art.faces ? boss.angle : 0,
        wx = art.weak.x * BOSS_HALF * k,
        wy = art.weak.y * BOSS_HALF * k,
        pulse = 0.5 + 0.5 * Math.sin(g.realTime * 5);
      this.weakPoint.position.set(
        boss.x + wx * Math.cos(rot) - wy * Math.sin(rot),
        boss.y + wx * Math.sin(rot) + wy * Math.cos(rot),
      );
      this.weakPoint.scale.set(((art.weak.r * BOSS_HALF * k) / 40) * (1.1 + 0.35 * pulse));
      this.weakPoint.alpha = 0.35 + 0.45 * (1 - pulse);
    }
    for (let i = 0; i < g.arrows.items.length; i++) {
      const a = g.arrows.items[i],
        s = this.arrowSprites[i],
        trail = this.trailSprites[i];
      s.visible = trail.visible = a.active;
      if (a.active) {
        const angle = Math.atan2(a.vy, a.vx),
          speed = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
        s.position.set(a.x, a.y);
        s.rotation = angle;
        s.scale.set(a.perfect ? 0.8 : 0.6);
        s.alpha = dim;
        s.tint = a.source === 'phantom' ? C.phantom : 0xffffff;
        // Short trail behind the shaft, longer for faster arrows, fading as the arrow ages.
        trail.position.set(a.x - Math.cos(angle) * 18, a.y - Math.sin(angle) * 18);
        trail.rotation = angle;
        trail.scale.set(
          (JUICE.trailLength / 128) *
            Math.min(1.6, speed / T.arrowSpeed) *
            Math.min(1, a.travel / 60),
          a.perfect ? 1.4 : 1,
        );
        trail.alpha = JUICE.trailAlpha * dim;
        trail.tint = a.perfect ? C.focus : a.source === 'phantom' ? C.phantom : C.silver;
      }
    }
    // Deadeye marks glow violet under their targets.
    let glows = 0;
    if (g.deadeye > 0 || g.focusMarks > 0)
      for (const e of g.enemies.items)
        if (e.active && e.deadmark && glows < this.markGlows.length) {
          const m = this.markGlows[glows++];
          m.visible = true;
          m.position.set(e.x, e.y);
          m.scale.set((e.r / 40) * (this.reducedMotion ? 1 : 1 + 0.12 * Math.sin(g.realTime * 8)));
          m.alpha = 0.75;
        }
    for (let i = glows; i < this.markGlows.length; i++) this.markGlows[i].visible = false;
    this.diegetic.reducedMotion = this.reducedMotion;
    this.diegetic.update(g, this.hunter.scale.x);
    this.vfx.reducedMotion = this.reducedMotion;
    this.vfx.handle(g);
    this.vfx.update(realDt);
    // Deadeye: slight desaturation of the world and a violet wash.
    const deadeye = g.deadeye > 0;
    if (deadeye !== (this.root.filters?.length === 1))
      this.root.filters = deadeye ? [this.deadeyeFilter] : [];
    for (let i = 0; i < g.pickups.items.length; i++) {
      const q = g.pickups.items[i],
        s = this.pickupSprites[i];
      s.visible = q.active;
      if (q.active) {
        s.texture = this.art[q.kind === 2 ? 'berry' : 'xp'];
        s.position.set(q.x, q.y);
        s.scale.set(0.55 + 0.04 * Math.sin(g.realTime * 3 + i));
        s.tint = q.kind === 2 ? 0xffffff : q.kind === 1 ? C.elite : C.silver;
      }
    }
    for (let i = 0; i < g.particles.items.length; i++) {
      const q = g.particles.items[i],
        s = this.particleSprites[i];
      s.visible = q.active;
      if (q.active) {
        s.position.set(q.x, q.y);
        s.scale.set(q.size * 0.2);
        s.alpha = (q.life / q.max) * (q.color === 1 ? 1 : dim);
        s.tint =
          q.color === 1
            ? C.threatBase
            : q.color === 2
              ? C.focus
              : q.color === 3
                ? C.elite
                : C.silver;
      }
    }
    this.hunter.position.set(p.x, p.y);
    this.cutout.position.set(p.x, p.y);
    this.cutout.scale.set(g.crowd > 40 ? 0.95 : 0.7);
    this.hunter.rotation = p.aim;
    this.hunter.alpha = p.invuln > 0 ? 0.55 + 0.45 * Math.sin(g.realTime * 30) : 1;
    for (let i = 0; i < 3; i++) {
      const q = g.ghosts.items[i],
        s = this.ghostSprites[i];
      s.visible = q.active;
      if (q.active) {
        s.position.set(q.x, q.y);
        s.rotation = p.aim;
      }
    }
    this.raven.visible = g.rank('moonraven') > 0;
    if (this.raven.visible) {
      this.raven.position.set(p.x + Math.cos(g.time * 2) * 90, p.y + Math.sin(g.time * 2) * 90);
      this.raven.rotation = g.time * 2 + Math.PI / 2;
    }
    for (const slot of this.numberSlots) {
      slot.life -= realDt;
      slot.text.visible = slot.life > 0;
      if (slot.life > 0) {
        slot.text.y -= realDt * 25;
        slot.text.alpha = Math.min(1, slot.life * 2);
      }
    }
    for (const event of g.events)
      if (event.id === 'number.crit' || (this.numbers && event.id.startsWith('enemy.hit.'))) {
        const slot = this.numberSlots.find((slot) => slot.life <= 0);
        if (slot) {
          slot.life = 0.75;
          slot.text.text = String(Math.round(event.value));
          slot.text.position.set(event.x, event.y - 28);
          slot.text.visible = true;
        }
      }
    this.lines(g);
    this.reticle(g);
    const submitStart = performance.now();
    this.timing.scene += (submitStart - sceneStart - this.timing.scene) * 0.1;
    this.app.render();
    this.timing.submit += (performance.now() - submitStart - this.timing.submit) * 0.1;
  }
  lines(g: Hunt) {
    const p = g.player,
      w = this.worldLines,
      tg = this.threatGraphics;
    w.clear();
    tg.clear();
    const red = this.colorblind ? C.colorblind : C.threat,
      crowded = g.crowd > 150;
    if (this.showBands && !this.camp) {
      w.circle(p.x, p.y, g.bow.near).stroke({ color: 0x98c7e6, alpha: 0.06, width: 1 });
      w.circle(p.x, p.y, g.bow.far).stroke({ color: 0x98c7e6, alpha: 0.11, width: 1 });
    }
    if (this.camp) {
      for (const s of STATIONS) {
        w.circle(s.x, s.y, 45).stroke({
          color: 0x8aaccc,
          alpha: 0.5,
          width: 2,
        });
        w.poly([s.x, s.y - 32, s.x + 20, s.y, s.x, s.y + 32, s.x - 20, s.y])
          .fill({ color: 0x213248, alpha: 0.8 })
          .stroke({ color: 0xb5d4eb, alpha: 0.4, width: 2 });
      }
      w.circle(600, 430, 45)
        .fill({ color: 0xaba4ff, alpha: 0.07 })
        .stroke({ color: 0xaba4ff, alpha: 0.4, width: 2 });
    }
    if (g.rank('lantern'))
      w.circle(p.x, p.y, 140 + 20 * (g.rank('lantern') - 1))
        .fill({ color: 0xdceeff, alpha: 0.02 })
        .stroke({ color: 0xdceeff, alpha: 0.2, width: 1 });
    if (g.event === 2)
      w.circle(g.eventX, g.eventY, 85)
        .fill({ color: 0xdceeff, alpha: 0.08 })
        .stroke({ color: 0xdceeff, alpha: 0.7, width: 2 });
    if (g.boss?.boss === 2)
      w.ellipse(g.boss.x + 15, g.boss.y + 35, 50, 16).fill({ color: 0x03060d, alpha: 0.9 });
    if (g.boss)
      w.circle(g.eventX, g.eventY, 1050).stroke({ color: 0xb5d2ed, alpha: 0.5, width: 6 });
    for (const e of g.enemies.items)
      if (e.active) {
        if (e.elite === 5)
          tg.circle(e.x, e.y, e.r + 9).stroke({ color: C.silver, width: 2, alpha: 0.8 });
        if (e.deadmark || e.mark) {
          tg.circle(e.x, e.y, e.r + 16).stroke({
            color: e.deadmark ? C.focus : C.silver,
            width: 2,
            alpha: 1,
          });
          tg.moveTo(e.x - 7, e.y - e.r - 23)
            .lineTo(e.x, e.y - e.r - 17)
            .lineTo(e.x + 7, e.y - e.r - 23)
            .stroke({ color: 0xdaefff, width: 2 });
        }
        if (e.kind === 6 && e.state === 0)
          tg.moveTo(e.x - Math.cos(e.angle) * 42, e.y - Math.sin(e.angle) * 42)
            .lineTo(e.x, e.y)
            .stroke({ color: red, alpha: 0.4, width: 5 });
        if (e.slow > 0 || e.freeze > 0)
          tg.poly([e.x, e.y - 24, e.x + 24, e.y, e.x, e.y + 24, e.x - 24, e.y]).stroke({
            color: 0xdaefff,
            alpha: 0.6,
            width: 1,
          });
      }
    for (const t of g.threats.items)
      if (t.active) {
        if (t.kind === 3) tg.circle(t.x, t.y, t.r).fill(red);
        else if (t.kind === 2)
          tg.circle(t.x, t.y, t.r * (0.85 + (0.15 * t.clock) / t.duration))
            .fill({ color: red, alpha: 0.04 })
            .stroke({ color: red, alpha: 0.8, width: 2 });
        else if (t.kind === 4) {
          w.moveTo(t.x, t.y)
            .lineTo(t.x + Math.cos(t.angle) * t.length, t.y + Math.sin(t.angle) * t.length)
            .stroke({ color: 0x50293b, width: t.r * 2, alpha: 0.95 });
          tg.moveTo(t.x, t.y)
            .lineTo(t.x + Math.cos(t.angle) * t.length, t.y + Math.sin(t.angle) * t.length)
            .stroke({ color: red, width: 3, alpha: 0.65 });
        } else if (t.kind === 5)
          w.circle(t.x, t.y, t.r).stroke({ color: C.silver, width: 2, alpha: 0.7 });
        else {
          const endX = t.x + Math.cos(t.angle) * t.length,
            endY = t.y + Math.sin(t.angle) * t.length;
          // Charge lanes get a translucent body; aim lines are a single stroke that thins in a crowd.
          if (t.kind === 1)
            tg.moveTo(t.x, t.y)
              .lineTo(endX, endY)
              .stroke({ color: red, width: t.r * 2, alpha: 0.12 });
          tg.moveTo(t.x, t.y)
            .lineTo(endX, endY)
            .stroke({
              color: red,
              width: t.kind === 1 ? 2 : 1.5,
              alpha: t.kind === 1 ? 0.85 : crowded ? 0.3 : 0.7,
            });
          if (this.colorblind)
            for (let i = 0; i < 10; i++) {
              const x = t.x + ((endX - t.x) * i) / 10,
                y = t.y + ((endY - t.y) * i) / 10;
              tg.circle(x, y, 4).fill(red);
            }
        }
      }
  }
  reticle(g: Hunt) {
    const o = this.overlay;
    o.clear();
    if (this.camp) return;
    const p = g.player,
      x = this.aimScreen.x,
      y = this.aimScreen.y,
      full =
        g.bow.draw /
        (1 + 0.08 * g.rank('quick-nock') - 0.1 * g.rank('heavy-bow') + 0.2 * g.rank('swift-bow')),
      win = g.bow.window * (1 + 0.25 * g.rank('steady-hand'));
    const perfect = p.draw >= full && p.draw <= full + win;
    const r = 27 - Math.min(1, p.draw / full) * 13;
    o.circle(x, y, r).stroke({
      color: perfect ? C.focus : 0xaecbe0,
      width: perfect ? 3 : 1.5,
      alpha: perfect ? 1 : 0.65,
    });
    o.circle(x, y, 2).fill(0xdaefff);
    o.moveTo(x - r - 8, y)
      .lineTo(x - r - 3, y)
      .moveTo(x + r + 3, y)
      .lineTo(x + r + 8, y)
      .stroke({ color: 0xdaefff, width: 1, alpha: 0.7 });
    if (g.deadeye > 0)
      o.circle(x, y, 60 * this.zoom).stroke({ color: C.focus, width: 1, alpha: 0.5 });
    if (g.deadeye > 0)
      o.rect(0, 0, this.width, this.height).fill({ color: C.focus, alpha: JUICE.deadeyeTint });
    // Chime flash on a perfect release.
    if (g.flash > 0)
      o.rect(0, 0, this.width, this.height).fill({
        color: C.focusLight,
        alpha: g.flash * JUICE.chimeFlash * (this.reducedMotion ? JUICE.reducedFlash : 1),
      });
  }
}
