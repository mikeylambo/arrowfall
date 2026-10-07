/**
 * First-hunt coach: one objective at a time, worded for the device in hand (keyboard and
 * mouse, gamepad or touch), each ticked off with a chime before the next appears.
 */
import type { Hunt } from '../sim/game';

type Device = 'mouse' | 'pad' | 'touch';
interface Step {
  title: string;
  text: (device: Device, hold: boolean) => string;
  done: (g: Hunt, c: Coach) => boolean;
}

const key = (k: string) => `<kbd>${k}</kbd>`;
const STEPS: Step[] = [
  {
    title: 'Move',
    text: (d) =>
      d === 'touch'
        ? 'Drag on the <b>left</b> side of the screen to walk.'
        : d === 'pad'
          ? 'Walk with the <b>left stick</b>.'
          : `Walk with ${key('W')}${key('A')}${key('S')}${key('D')}.`,
    done: (_, c) => c.walked > 200,
  },
  {
    title: 'Loose an arrow',
    text: (d, hold) =>
      d === 'touch'
        ? 'Press and hold on the <b>right</b> side to draw (drag to aim), lift to loose.'
        : d === 'pad'
          ? `Aim with the <b>right stick</b>, hold ${key('RT')} to draw, release to loose.`
          : hold
            ? 'Aim with the mouse and <b>hold</b> the left button: the hunter keeps shooting.'
            : 'Aim with the mouse, <b>hold</b> the left button to draw, <b>release</b> to loose.',
    done: (g) => g.shots >= 3,
  },
  {
    title: 'Perfect release',
    text: () =>
      'Let go the moment the bow <b class="v">chimes and flashes violet</b>. Perfect arrows hit harder and fill Focus.',
    done: (g) => g.perfects >= 2,
  },
  {
    title: 'Dodge',
    text: (d) =>
      `A <b>Hollow Stag</b> is charging. Watch its <b class="r">red line</b>, then ${
        d === 'touch'
          ? 'tap <b>Dodge</b>'
          : d === 'pad'
            ? `press ${key('A')}`
            : `press ${key('Space')}`
      } to roll through it. You cannot be hit mid-roll.`,
    done: (_, c) => c.dodged,
  },
  {
    title: 'Grow stronger',
    text: () =>
      'Fallen monsters drop <b>moonlight shards</b>. Walk over them to fill the bar and level up.',
    done: (g) => g.level >= 2,
  },
  {
    title: 'Deadeye',
    text: (d) =>
      `When Focus is full, ${
        d === 'touch'
          ? 'tap <b>Deadeye</b>'
          : d === 'pad'
            ? `press ${key('RB')}`
            : `press ${key('E')} or right-click`
      }: time slows, sweep over enemies to mark them, then everything marked is struck at once.`,
    done: (_, c) => c.deadeyed,
  },
];

export class Coach {
  readonly root = document.createElement('div');
  step = 0;
  walked = 0;
  dodged = false;
  deadeyed = false;
  /** The dodge lesson's charging stag has been sent. */
  charged = false;
  private lastX = 0;
  private lastY = 0;
  private doneTimer = 0;
  private finished = false;
  constructor(
    private readonly onChime: () => void,
    private readonly onSkip: () => void,
  ) {
    this.root.id = 'coach';
    document.body.append(this.root);
    this.root.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-skip]')) {
        this.finish();
        this.onSkip();
      }
    });
  }
  /** Start (or restart) the coach for a new first hunt. */
  begin(g: Hunt) {
    this.step = 0;
    this.walked = 0;
    this.dodged = this.deadeyed = this.charged = false;
    this.lastX = g.player.x;
    this.lastY = g.player.y;
    this.doneTimer = 0;
    this.finished = false;
    this.root.className = 'show';
  }
  finish() {
    this.finished = true;
    this.root.className = '';
  }
  get active() {
    return !this.finished && this.root.classList.contains('show');
  }
  update(g: Hunt, dt: number, device: Device, hold: boolean, visible: boolean) {
    if (this.finished) return;
    this.root.classList.toggle('hidden', !visible);
    const p = g.player;
    this.walked += Math.hypot(p.x - this.lastX, p.y - this.lastY);
    this.lastX = p.x;
    this.lastY = p.y;
    for (const e of g.events) {
      if (e.id === 'player.dodge') this.dodged = true;
      if (e.id === 'deadeye.enter') this.deadeyed = true;
    }
    if (this.doneTimer > 0) {
      this.doneTimer -= dt;
      if (this.doneTimer <= 0) {
        this.step++;
        if (this.step >= STEPS.length) {
          this.root.innerHTML = `<div class="coach-card ready"><b>You're ready.</b><span>Survive until dawn.</span></div>`;
          setTimeout(() => this.finish(), 2600);
          this.finished = true;
          return;
        }
      } else return;
    }
    const s = STEPS[this.step];
    if (s.done(g, this)) {
      this.doneTimer = 0.9;
      this.root.querySelector('.coach-card')?.classList.add('done');
      this.onChime();
      return;
    }
    const html = `<div class="coach-card" data-step="${this.step}">
      <header><span class="coach-count">${this.step + 1} / ${STEPS.length}</span><b>${s.title}</b><button data-skip>Skip tutorial</button></header>
      <p>${s.text(device, hold)}</p>
      <div class="coach-dots">${STEPS.map((_, i) => `<i class="${i < this.step ? 'on' : i === this.step ? 'now' : ''}"></i>`).join('')}</div>
    </div>`;
    if (this.root.dataset.html !== html) {
      this.root.dataset.html = html;
      this.root.innerHTML = html;
    }
  }
}
