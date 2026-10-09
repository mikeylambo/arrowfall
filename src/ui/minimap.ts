/**
 * Corner map of the Hollowmoor: the hunter (with facing), the view, landmarks once discovered,
 * the boss (red triangle) and an active event (pulsing ring). Shapes differ as well as colours.
 * Redrawn ~10 times a second; it never touches gameplay.
 */
import { T } from '../data/tuning';
import type { Hunt } from '../sim/game';

export class Minimap {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;
  private clock = 0;
  constructor(parent: HTMLElement) {
    this.canvas.className = 'minimap';
    this.canvas.setAttribute('aria-hidden', 'true');
    parent.append(this.canvas);
  }
  set visible(on: boolean) {
    this.canvas.style.display = on ? '' : 'none';
  }
  update(g: Hunt, dt: number, view: { x: number; y: number; w: number; h: number }, time: number) {
    if ((this.clock -= dt) > 0) return;
    this.clock = 0.1;
    const el = this.canvas,
      dpr = Math.min(2, devicePixelRatio || 1),
      w = el.clientWidth,
      h = el.clientHeight;
    if (!w || !h) return;
    if (el.width !== Math.round(w * dpr)) {
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
    }
    const c = this.ctx,
      sx = w / T.worldWidth,
      sy = h / T.worldHeight,
      X = (x: number) => x * sx,
      Y = (y: number) => y * sy;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    // What the screen shows.
    c.strokeStyle = 'rgba(196,212,255,0.35)';
    c.lineWidth = 1;
    c.strokeRect(X(view.x - view.w / 2), Y(view.y - view.h / 2), view.w * sx, view.h * sy);
    // Landmarks, once found: silver diamonds.
    g.world.landmarks.forEach((l, i) => {
      if (!(g.discovered & (1 << i))) return;
      const x = X(l.x),
        y = Y(l.y);
      c.fillStyle = '#c4d4ff';
      c.beginPath();
      c.moveTo(x, y - 4);
      c.lineTo(x + 4, y);
      c.lineTo(x, y + 4);
      c.lineTo(x - 4, y);
      c.closePath();
      c.fill();
    });
    // An active event: a pulsing violet ring.
    if (g.event >= 0) {
      const r = 5 + 2 * Math.sin(time * 5);
      c.strokeStyle = '#aba4ff';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(X(g.eventX), Y(g.eventY), r, 0, Math.PI * 2);
      c.stroke();
    }
    // The boss: a red triangle.
    if (g.boss) {
      const x = X(g.boss.x),
        y = Y(g.boss.y);
      c.fillStyle = '#ff3c48';
      c.strokeStyle = '#05080f';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, y - 6);
      c.lineTo(x + 5.5, y + 4);
      c.lineTo(x - 5.5, y + 4);
      c.closePath();
      c.stroke();
      c.fill();
    }
    // The hunter: a white dot with a facing tick.
    const p = g.player,
      x = X(p.x),
      y = Y(p.y);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(p.aim) * 8, y + Math.sin(p.aim) * 8);
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(x, y, 3, 0, Math.PI * 2);
    c.fill();
  }
}
