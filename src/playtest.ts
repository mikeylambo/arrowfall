/**
 * Playtest kit: turn on with ?playtest=1 (or ?playtest=<device name>), off with ?playtest=0.
 * Stays on for the device until turned off. Records each hunt's results, frame timing and hitches,
 * input devices used, boss kill times, and timestamped notes; everything is kept in local storage
 * and exported as a report (Markdown summary + JSON) from Options or the results screen.
 * Nothing here touches gameplay.
 */
const KEY = 'arrowfall.playtest';
const MAX_RUNS = 40;

export interface PlaytestNote {
  /** Hunt clock (s) when the note was taken; -1 outside a hunt. */
  t: number;
  scene: string;
  text: string;
  fps: number;
  enemies: number;
  hp: number;
  level: number;
  boss: string;
  device: string;
}
export interface PlaytestRun {
  started: string;
  scene: string;
  seed: number;
  bow: string;
  phase: number;
  curses: string[];
  outcome: string;
  killedBy: string;
  time: number;
  level: number;
  kills: number;
  shots: number;
  perfects: number;
  hurt: number;
  dodges: number;
  evolutions: string[];
  build: [string, number][];
  /** Boss name -> seconds from intro to fall (null = not felled). */
  bosses: Record<string, number | null>;
  /** Seconds of play per input device. */
  input: Record<string, number>;
  frames: {
    count: number;
    p50: number;
    p95: number;
    p99: number;
    worst: number;
    over33: number;
    over50: number;
    /** Average fps and peak enemies per 30 s of hunt clock. */
    segments: { t: number; fps: number; enemies: number }[];
    hitches: { t: number; ms: number; enemies: number; arrows: number; particles: number }[];
  };
  peakEnemies: number;
  notes: PlaytestNote[];
  /** True while the hunt is still going (saved on tab close). */
  partial?: boolean;
}
export interface PlaytestSession {
  id: string;
  label: string;
  build: string;
  started: string;
  device: {
    userAgent: string;
    platform: string;
    screen: string;
    viewport: string;
    dpr: number;
    touch: boolean;
    cores: number;
    memory: number;
    gpu: string;
    pads: string[];
  };
  runs: PlaytestRun[];
  notes: PlaytestNote[];
}

/** Is the kit on for this device? Reads and stores the ?playtest= switch. */
export function playtestEnabled(): string | null {
  try {
    const flag = new URLSearchParams(location.search).get('playtest');
    if (flag === '0' || flag === 'off') localStorage.removeItem(KEY + '.on');
    else if (flag) localStorage.setItem(KEY + '.on', flag === '1' ? guessDevice() : flag);
    return localStorage.getItem(KEY + '.on');
  } catch {
    return null;
  }
}
function guessDevice() {
  const ua = navigator.userAgent,
    os = /iPhone/.test(ua)
      ? 'iPhone'
      : /iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
        ? 'iPad'
        : /Android/.test(ua)
          ? 'Android'
          : /Steam|SteamDeck/.test(ua)
            ? 'Steam Deck'
            : /Windows/.test(ua)
              ? 'Windows'
              : /Mac/.test(ua)
                ? 'Mac'
                : /Linux/.test(ua)
                  ? 'Linux'
                  : 'Device',
    browser = /Edg\//.test(ua)
      ? 'Edge'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  return `${os} ${browser}`;
}
function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Live state the recorder samples each frame (read from the game, never written). */
export interface PlaytestFrame {
  scene: string;
  playing: boolean;
  t: number;
  device: string;
  enemies: number;
  arrows: number;
  particles: number;
}
interface HuntLike {
  seed: number;
  time: number;
  level: number;
  kills: number;
  shots: number;
  perfects: number;
  outcome: string;
  killedBy?: string;
  phase: number;
  curses: Set<string>;
  evolutions: Set<string>;
  ranks: Record<string, number>;
}

export class Playtest {
  session: PlaytestSession;
  run: PlaytestRun | null = null;
  private histogram = new Uint32Array(251);
  private segment = { t: 0, frames: 0, ms: 0, enemies: 0 };
  private bossStart: Record<string, number> = {};

  constructor(
    label: string,
    build: string,
    private readonly bossNames: string[],
  ) {
    let saved: PlaytestSession | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {}
    this.session =
      saved && saved.build === build && saved.label === label
        ? saved
        : {
            id: Math.random().toString(36).slice(2, 8),
            label,
            build,
            started: new Date().toISOString(),
            device: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              screen: `${screen.width}x${screen.height}`,
              viewport: `${innerWidth}x${innerHeight}`,
              dpr: devicePixelRatio,
              touch: navigator.maxTouchPoints > 0,
              cores: navigator.hardwareConcurrency || 0,
              memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0,
              gpu: gpuName(),
              pads: [],
            },
            runs: [],
            notes: [],
          };
    // A run cut short by a closed tab is kept as partial.
    addEventListener('pagehide', () => this.save(true));
    addEventListener('visibilitychange', () => document.hidden && this.save(true));
    addEventListener('gamepadconnected', (e) => {
      const id = (e as GamepadEvent).gamepad.id;
      if (!this.session.device.pads.includes(id)) this.session.device.pads.push(id);
    });
  }

  begin(scene: string, g: HuntLike, bow: string) {
    if (this.run?.partial) this.finish(g);
    this.histogram.fill(0);
    this.segment = { t: 0, frames: 0, ms: 0, enemies: 0 };
    this.bossStart = {};
    this.run = {
      started: new Date().toISOString(),
      scene,
      seed: g.seed,
      bow,
      phase: g.phase,
      curses: [...g.curses],
      outcome: '',
      killedBy: '',
      time: 0,
      level: 1,
      kills: 0,
      shots: 0,
      perfects: 0,
      hurt: 0,
      dodges: 0,
      evolutions: [],
      build: [],
      bosses: {},
      input: {},
      frames: {
        count: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        worst: 0,
        over33: 0,
        over50: 0,
        segments: [],
        hitches: [],
      },
      peakEnemies: 0,
      notes: [],
      partial: true,
    };
  }

  /** One rendered frame; `ms` is the raw frame time (unclamped). */
  frame(ms: number, f: PlaytestFrame) {
    const r = this.run;
    if (!r || !f.playing || f.scene !== r.scene || document.hidden) return;
    r.input[f.device] = (r.input[f.device] ?? 0) + ms / 1000;
    r.peakEnemies = Math.max(r.peakEnemies, f.enemies);
    // Ignore absurd gaps (tab switches, debugger) rather than counting them as hitches.
    if (ms > 1000) return;
    const fr = r.frames;
    fr.count++;
    this.histogram[Math.min(250, Math.round(ms))]++;
    fr.worst = Math.max(fr.worst, ms);
    if (ms > 33.4) fr.over33++;
    if (ms > 50) {
      fr.over50++;
      fr.hitches.push({
        t: Math.round(f.t),
        ms: Math.round(ms),
        enemies: f.enemies,
        arrows: f.arrows,
        particles: f.particles,
      });
      fr.hitches.sort((a, b) => b.ms - a.ms);
      fr.hitches.length = Math.min(fr.hitches.length, 10);
    }
    const s = this.segment;
    if (f.t >= s.t + 30) {
      if (s.frames)
        fr.segments.push({
          t: s.t,
          fps: Math.round((1000 * s.frames) / s.ms),
          enemies: s.enemies,
        });
      this.segment = { t: Math.floor(f.t / 30) * 30, frames: 0, ms: 0, enemies: 0 };
    }
    this.segment.frames++;
    this.segment.ms += ms;
    this.segment.enemies = Math.max(this.segment.enemies, f.enemies);
  }

  /** Gameplay events of interest (ids as the sim emits them). */
  event(id: string, value: number, t: number) {
    const r = this.run;
    if (!r) return;
    if (id === 'player.hurt') r.hurt++;
    else if (id === 'player.dodge') r.dodges++;
    else if (id === 'boss.intro') {
      const name = this.bossNames[value] ?? String(value);
      this.bossStart[name] = t;
      r.bosses[name] ??= null;
    } else if (id === 'boss.fall') {
      const name = this.bossNames[value] ?? String(value);
      if (this.bossStart[name] !== undefined) r.bosses[name] = Math.round(t - this.bossStart[name]);
    }
  }

  note(text: string, n: Omit<PlaytestNote, 'text'>) {
    const note = { ...n, text: text.trim() || '(marker)' };
    (this.run && n.scene === this.run.scene ? this.run.notes : this.session.notes).push(note);
    this.save(true);
  }

  finish(g: HuntLike) {
    const r = this.run;
    if (!r) return;
    Object.assign(r, {
      outcome: g.outcome || r.outcome || 'Left the hunt',
      killedBy: g.killedBy ?? '',
      time: Math.round(g.time),
      level: g.level,
      kills: g.kills,
      shots: g.shots,
      perfects: g.perfects,
      evolutions: [...g.evolutions],
      build: Object.entries(g.ranks)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    });
    this.summariseFrames();
    delete r.partial;
    this.store(r);
    this.run = null;
    this.save(false);
  }

  private summariseFrames() {
    const fr = this.run!.frames,
      total = fr.count;
    const at = (q: number) => {
      let seen = 0;
      for (let i = 0; i < this.histogram.length; i++)
        if ((seen += this.histogram[i]) >= total * q) return i;
      return 250;
    };
    if (total) Object.assign(fr, { p50: at(0.5), p95: at(0.95), p99: at(0.99) });
    fr.worst = Math.round(fr.worst);
  }

  private store(r: PlaytestRun) {
    const runs = this.session.runs,
      i = runs.findIndex((x) => x.started === r.started);
    if (i >= 0) runs[i] = structuredClone(r);
    else runs.push(structuredClone(r));
    if (runs.length > MAX_RUNS) runs.splice(0, runs.length - MAX_RUNS);
  }

  save(withPartial: boolean) {
    if (withPartial && this.run) {
      this.summariseFrames();
      this.store(this.run);
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(this.session));
    } catch {}
  }

  clear() {
    this.session.runs = [];
    this.session.notes = [];
    this.session.started = new Date().toISOString();
    this.save(false);
  }

  /** Human-readable summary for pasting into chat. */
  markdown() {
    const s = this.session,
      d = s.device,
      // Percentiles come from a 1 ms histogram that tops out at 250 ms.
      ms = (v: number) => (v >= 250 ? '250+ ms' : `${v} ms`),
      fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`,
      lines = [
        `# Arrowfall playtest — ${s.label}`,
        '',
        `Build ${s.build} · session ${s.id} · started ${s.started.slice(0, 16).replace('T', ' ')}`,
        `${d.screen} screen, ${d.viewport} window @${d.dpr}x · ${d.cores} cores${d.memory ? ` · ${d.memory} GB` : ''} · GPU ${d.gpu}`,
        d.pads.length ? `Gamepads: ${d.pads.join('; ')}` : 'No gamepad connected',
        '',
      ];
    s.runs.forEach((r, i) => {
      const input = Object.entries(r.input)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${fmt(v)}`)
        .join(', ');
      lines.push(
        `## Run ${i + 1} · ${r.scene}${r.partial ? ' (unfinished)' : ''}`,
        `${r.outcome || '—'}${r.killedBy ? ` (${r.killedBy})` : ''} at ${fmt(r.time)} · level ${r.level} · ${r.kills} kills · ${Math.round((100 * r.perfects) / Math.max(1, r.shots))}% perfect (${r.shots} shots) · hit ${r.hurt}× · ${r.dodges} dodges`,
        `Bow ${r.bow} · moon phase ${r.phase}${r.curses.length ? ` · curses ${r.curses.join(', ')}` : ''} · seed ${r.seed}`,
        `Input: ${input || '—'}`,
        `Frames: p50 ${ms(r.frames.p50)} · p95 ${ms(r.frames.p95)} · p99 ${ms(r.frames.p99)} · worst ${r.frames.worst} ms · ${r.frames.over33} over 33 ms · ${r.frames.over50} over 50 ms · peak ${r.peakEnemies} enemies`,
      );
      if (Object.keys(r.bosses).length)
        lines.push(
          'Bosses: ' +
            Object.entries(r.bosses)
              .map(([b, t]) => `${b} ${t === null ? 'not felled' : t + ' s'}`)
              .join(', '),
        );
      if (r.frames.hitches.length)
        lines.push(
          'Worst hitches: ' +
            r.frames.hitches
              .slice(0, 5)
              .map((h) => `${h.ms} ms at ${fmt(h.t)} (${h.enemies} enemies)`)
              .join(', '),
        );
      if (r.evolutions.length) lines.push(`Evolutions: ${r.evolutions.join(', ')}`);
      for (const n of r.notes)
        lines.push(
          `- **${fmt(n.t)}** ${n.text} _(${n.fps} fps, ${n.enemies} enemies, ${n.hp} hp, ${n.device}${n.boss ? ', ' + n.boss : ''})_`,
        );
      lines.push('');
    });
    if (s.notes.length) {
      lines.push('## Notes outside a hunt');
      for (const n of s.notes) lines.push(`- (${n.scene}) ${n.text}`);
      lines.push('');
    }
    if (!s.runs.length && !s.notes.length) lines.push('_No runs recorded yet._');
    return lines.join('\n');
  }

  json() {
    return JSON.stringify(this.session, null, 1);
  }

  fileName() {
    const safe = this.session.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return `arrowfall-playtest-${safe}-${this.session.started.slice(0, 10)}.json`;
  }
}

/**
 * The note box: a small text field over the game. Enter saves, Escape cancels. Keys typed into
 * it never reach the game (the caller pauses input while it is open).
 */
export function openNoteBox(onDone: (text: string | null) => void) {
  const box = document.createElement('form'),
    input = document.createElement('input');
  box.className = 'playtest-note';
  input.type = 'text';
  input.placeholder = 'Note (Enter to save, Esc to cancel)';
  input.maxLength = 280;
  input.autocomplete = 'off';
  box.append(input);
  document.body.append(box);
  let closed = false;
  // Removing the box blurs the field, which would close it a second time.
  const close = (text: string | null) => {
    if (closed) return;
    closed = true;
    box.remove();
    onDone(text);
  };
  box.onsubmit = (e) => {
    e.preventDefault();
    close(input.value);
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close(null);
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('blur', () => close(input.value || null));
  setTimeout(() => input.focus(), 0);
}
