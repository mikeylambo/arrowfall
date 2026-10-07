import type { Enemy, Input } from '../sim/types';
import type { View } from '../render/renderer';
export class Controls {
  assist = 0.3;
  keys = new Set<string>();
  mouse = { x: innerWidth * 0.65, y: innerHeight * 0.5, down: false };
  dodge = false;
  deadeye = false;
  usingPad = false;
  padAim = 0;
  previousButtons: boolean[] = [];
  bindings = {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    dodge: 'Space',
    deadeye: 'KeyE',
  };
  toggle = false;
  toggleDown = false;
  touch: TouchPad;
  /** True once a touch has been seen: the on-screen sticks drive the hunter. */
  touching = false;
  constructor() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === this.bindings.dodge) {
        this.dodge = true;
        e.preventDefault();
      }
      if (e.code === this.bindings.deadeye) this.deadeye = true;
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.usingPad = false;
    });
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if ((e.target as HTMLElement).closest('button,input,.slu-ui-panel')) return;
      if (e.button === 0) {
        this.mouse.down = true;
        this.toggleDown = !this.toggleDown;
      }
      if (e.button === 2) this.deadeye = true;
    });
    addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button === 0) this.mouse.down = false;
    });
    this.touch = new TouchPad(this);
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('blur', () => this.clear());
  }
  clear() {
    this.keys.clear();
    this.mouse.down = false;
    this.toggleDown = false;
    this.dodge = false;
    this.deadeye = false;
  }
  /** Pull an aim angle toward the closest target within a narrow cone (gamepad and touch). */
  assistAim(
    aim: number,
    player: { x: number; y: number },
    targets: readonly Enemy[],
    strength: number,
    cone = 0.22,
  ) {
    let best: Enemy | undefined,
      bestAngle = cone;
    for (const e of targets)
      if (e.active && !e.deadmark) {
        const angle = Math.atan2(e.y - player.y, e.x - player.x),
          delta = Math.abs(Math.atan2(Math.sin(angle - aim), Math.cos(angle - aim)));
        if (delta < bestAngle && Math.hypot(e.x - player.x, e.y - player.y) < 800) {
          best = e;
          bestAngle = delta;
        }
      }
    if (!best || strength <= 0) return aim;
    const angle = Math.atan2(best.y - player.y, best.x - player.x);
    return aim + Math.atan2(Math.sin(angle - aim), Math.cos(angle - aim)) * strength;
  }
  sample(view: View, player: { x: number; y: number }, targets: readonly Enemy[] = []): Input {
    let mx = Number(this.keys.has(this.bindings.right)) - Number(this.keys.has(this.bindings.left)),
      my = Number(this.keys.has(this.bindings.down)) - Number(this.keys.has(this.bindings.up));
    let aim = view.screenToWorld(this.mouse.x, this.mouse.y);
    let draw = this.toggle ? this.toggleDown : this.mouse.down;
    const pad = Array.from(navigator.getGamepads?.() ?? []).find(Boolean);
    if (pad) {
      const pressed = pad.buttons.map((b) => b.pressed),
        edge = (i: number) => pressed[i] && !this.previousButtons[i];
      const lx = pad.axes[0] || 0,
        ly = pad.axes[1] || 0,
        rx = pad.axes[2] || 0,
        ry = pad.axes[3] || 0;
      if (Math.hypot(lx, ly) > 0.15) {
        mx = lx;
        my = ly;
        this.usingPad = true;
      }
      if (Math.hypot(rx, ry) > 0.2) {
        this.padAim = Math.atan2(ry, rx);
        this.usingPad = true;
      }
      if (this.usingPad) {
        this.padAim = this.assistAim(this.padAim, player, targets, this.assist);
        aim = {
          x: player.x + Math.cos(this.padAim) * 400,
          y: player.y + Math.sin(this.padAim) * 400,
        };
        this.mouse.x = view.width / 2 + (aim.x - view.camera.x) * view.zoom;
        this.mouse.y = view.height / 2 + (aim.y - view.camera.y) * view.zoom;
      }
      draw = draw || pressed[7];
      this.dodge = this.dodge || edge(0) || edge(6);
      this.deadeye = this.deadeye || edge(5);
      this.previousButtons = pressed;
    }
    if (this.touching) {
      const t = this.touch;
      if (t.move.id !== null) {
        mx = t.move.x;
        my = t.move.y;
      }
      // Right thumb: drag to aim (pulled onto the nearest target in that direction); a
      // still thumb aims at the nearest threat. Holding draws, lifting looses.
      let angle = t.aim.id !== null && t.aim.length > 0.2 ? t.aim.angle : null;
      if (angle === null) {
        let best: Enemy | undefined,
          bestDistance = 900;
        for (const e of targets)
          if (e.active && !e.deadmark) {
            const d = Math.hypot(e.x - player.x, e.y - player.y);
            if (d < bestDistance) {
              best = e;
              bestDistance = d;
            }
          }
        angle = best ? Math.atan2(best.y - player.y, best.x - player.x) : this.padAim;
      } else angle = this.assistAim(angle, player, targets, Math.max(0.5, this.assist));
      this.padAim = angle;
      aim = { x: player.x + Math.cos(angle) * 400, y: player.y + Math.sin(angle) * 400 };
      this.mouse.x = view.width / 2 + (aim.x - view.camera.x) * view.zoom;
      this.mouse.y = view.height / 2 + (aim.y - view.camera.y) * view.zoom;
      draw = t.aim.id !== null;
      this.dodge = this.dodge || t.takeDodge();
      this.deadeye = this.deadeye || t.takeDeadeye();
    }
    view.aimScreen.x = this.mouse.x;
    view.aimScreen.y = this.mouse.y;
    const input = { mx, my, ax: aim.x, ay: aim.y, draw, dodge: this.dodge, deadeye: this.deadeye };
    this.dodge = false;
    this.deadeye = false;
    return input;
  }
}

/** One on-screen stick: follows the thumb that started it, reports a -1..1 vector. */
class Stick {
  id: number | null = null;
  ox = 0;
  oy = 0;
  x = 0;
  y = 0;
  readonly base = document.createElement('div');
  readonly knob = document.createElement('div');
  constructor(
    parent: HTMLElement,
    side: string,
    readonly radius = 56,
  ) {
    this.base.className = 'stick ' + side;
    this.knob.className = 'knob';
    this.base.append(this.knob);
    parent.append(this.base);
  }
  get length() {
    return Math.hypot(this.x, this.y);
  }
  get angle() {
    return Math.atan2(this.y, this.x);
  }
  start(e: PointerEvent) {
    this.id = e.pointerId;
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.x = this.y = 0;
    this.base.style.left = this.ox + 'px';
    this.base.style.top = this.oy + 'px';
    this.base.classList.add('held');
    this.knob.style.transform = '';
  }
  update(e: PointerEvent) {
    let dx = (e.clientX - this.ox) / this.radius,
      dy = (e.clientY - this.oy) / this.radius;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    this.x = dx;
    this.y = dy;
    this.knob.style.transform = `translate(${dx * this.radius}px, ${dy * this.radius}px)`;
  }
  end() {
    this.id = null;
    this.x = this.y = 0;
    this.base.classList.remove('held');
  }
}

/**
 * Twin-stick touch layout: the left half of the screen is a floating move stick, the right
 * half a floating aim-and-draw stick (hold to draw, lift to loose), plus Dodge and Deadeye.
 */
export class TouchPad {
  readonly root = document.createElement('div');
  readonly move: Stick;
  readonly aim: Stick;
  readonly deadeyeButton = document.createElement('button');
  private dodgeQueued = false;
  private deadeyeQueued = false;
  constructor(controls: Controls) {
    this.root.id = 'touch';
    this.move = new Stick(this.root, 'left');
    this.aim = new Stick(this.root, 'right', 44);
    const dodge = document.createElement('button');
    dodge.className = 'touch-button dodge';
    dodge.textContent = 'Dodge';
    this.deadeyeButton.className = 'touch-button deadeye';
    this.deadeyeButton.textContent = 'Deadeye';
    for (const [button, fire] of [
      [dodge, () => (this.dodgeQueued = true)],
      [this.deadeyeButton, () => (this.deadeyeQueued = true)],
    ] as const)
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fire();
      });
    this.root.append(dodge, this.deadeyeButton);
    document.body.append(this.root);
    addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType !== 'touch') return;
        if (!controls.touching) {
          controls.touching = true;
          document.documentElement.classList.add('touch');
        }
        // Menus own their touches; anything on the playfield starts a stick (including the
        // very first touch, before the layout switches on).
        if ((e.target as HTMLElement).closest('button,input,a,select,.slu-ui-panel,#ui *')) return;
        const stick = e.clientX < innerWidth / 2 ? this.move : this.aim;
        if (stick.id === null) stick.start(e);
      },
      { passive: true },
    );
    addEventListener('pointermove', (e) => {
      if (e.pointerId === this.move.id) this.move.update(e);
      if (e.pointerId === this.aim.id) this.aim.update(e);
    });
    const lift = (e: PointerEvent) => {
      if (e.pointerId === this.move.id) this.move.end();
      if (e.pointerId === this.aim.id) this.aim.end();
    };
    addEventListener('pointerup', lift);
    addEventListener('pointercancel', lift);
  }
  /** Shown only while the hunt or camp is being played (not over menus). */
  setActive(active: boolean, focusReady: boolean) {
    this.root.classList.toggle('active', active);
    this.deadeyeButton.classList.toggle('ready', focusReady);
    if (!active) {
      this.move.end();
      this.aim.end();
    }
  }
  takeDodge() {
    const v = this.dodgeQueued;
    this.dodgeQueued = false;
    return v;
  }
  takeDeadeye() {
    const v = this.deadeyeQueued;
    this.deadeyeQueued = false;
    return v;
  }
}
