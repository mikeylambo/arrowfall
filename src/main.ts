import './ui/style.css';
import {
  createGameApp,
  createSurvivorAssembly,
  PixiAdapter,
  ResultsManager,
  SaveManager,
  BrowserStorage,
  stableHashString,
  type UIChoice,
} from '@slu/web-shell';
import { View } from './render/renderer';
import { Synth } from './audio/synth';
import { Controls } from './ui/input';
import { Hunt, type HuntSave } from './sim/game';
import { BOWS } from './data/bows';
import { BOSSES } from './data/bosses';
import { UPGRADES } from './data/upgrades';
import { PALETTE } from './data/art';
import { EVOLUTIONS } from './data/evolutions';
import { ENEMIES } from './data/enemies';
import { DEEDS } from './data/meta';
import { deedProgress } from './sim/profile';
import { STATIONS } from './data/world';
import { T, xpNeeded } from './data/tuning';
import { loadProfile, saveProfile, bankRun, boonCost } from './sim/profile';
import { fmt, bowChoices, offerChoices, altarChoices, logChoices, fingerprint } from './ui/screens';
import { buildPanel, decorateLevelUp, decorateResults, type Recap } from './ui/cards';
import { Coach } from './ui/coach';
import { decorateMenus } from './ui/menus';
import { TOOLS } from './data/tools';
import { CURSES, CURSE_BONUS, CURSES_UNLOCK_RUNS } from './data/curses';
import type { Profile, RunRecord } from './sim/types';
import { Playtest, openNoteBox, playtestEnabled } from './playtest';
const $ = (id: string) => document.getElementById(id)!;
const profileStore = new SaveManager<Profile>(new BrowserStorage('arrowfall'), 'hunter-profile', 2);
const recovered = await profileStore.loadWithRecovery();
const profile = recovered.data ?? loadProfile(localStorage),
  view = new View(),
  audio = new Synth(),
  controls = new Controls();
let game: Hunt | null = null,
  scene = 'title',
  selected = 'recurve',
  phase = 0,
  nightly = false,
  accumulator = 0,
  last = performance.now(),
  savedRun = false,
  showPerf = false,
  uiScreen = 'title',
  pauseDeferred = false,
  seedOverride: number | null = null;
const touchDevice = matchMedia('(pointer: coarse)').matches;
/** Seconds of the death beat before results (the death clip, a slow push-in). */
const DEATH_BEAT = 1.8;
/** Playtest kit (?playtest=1): records runs, frame timing and notes; see src/playtest.ts. */
const playtestLabel = playtestEnabled();
const playtest = playtestLabel
  ? new Playtest(
      playtestLabel,
      __BUILD__,
      BOSSES.map((b) => b.name),
    )
  : null;
if (playtest) document.documentElement.classList.add('playtesting');
$('playtest-note').onclick = () => playtestNote(true);
let noteOpen = false,
  padNotePrevious = false;
/** How close the hunter must stand to use a camp station (its label sits just below it). */
const STATION_REACH = 140;
let deathClock = 0;
/** Gamepad rebinding in progress: actions still to bind, and last frame's buttons. */
let padRebind: ('draw' | 'dodge' | 'deadeye')[] = [];
let padPrevious: boolean[] = [];
let options = {
  version: 3,
  autoLoose: false,
  // Hold to fire is the default (GDD 3: holding is a steady stream, the window is the skill).
  holdFire: true,
  /** Performance mode: fewer effects and lower resolution; on by default for phones. */
  lowPower: touchDevice,
  /** Captions for important sounds (growls, horns, bells, drums). */
  captions: false,
  /** Phone vibration and gamepad rumble. */
  haptics: true,
  /** Last preset applied (Comfort / Standard / Challenge). */
  preset: 'Standard',
  colorblind: false,
  bands: true,
  numbers: true,
  toggle: false,
  uiScale: 1,
  assist: 0.3,
  bindings: controls.bindings,
  padBindings: controls.padBindings,
  music: 0.25,
  sfx: 0.7,
  shake: 1,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
};
try {
  const saved = JSON.parse(localStorage.getItem('arrowfall.options') || '{}');
  // v2: damage numbers on every hit became the default; older saves had it off.
  if ((saved.version ?? 1) < 2) delete saved.numbers;
  // v3: Hold to Fire became the default everywhere.
  if ((saved.version ?? 1) < 3) delete saved.holdFire;
  options = { ...options, ...saved, version: 3 };
} catch {}
controls.toggle = options.toggle;
controls.bindings = options.bindings;
controls.assist = options.assist;
controls.haptics = options.haptics;
controls.padBindings = { ...controls.padBindings, ...options.padBindings };
view.lowPower = options.lowPower;
view.colorblind = options.colorblind;
view.showBands = options.bands;
view.numbers = options.numbers;
view.shake = options.shake;
view.reducedMotion = options.reducedMotion;
await view.init($('game-canvas') as HTMLCanvasElement);
// Installable and playable offline (production builds only; dev keeps hot reload clean).
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  void navigator.serviceWorker.register('/sw.js').catch(() => {});
/** Painted backdrops (GPT batch 5) behind the menus that have a place of their own. */
const BACKDROPS: Record<string, string> = {
  trail: 'bg-trail',
  phase: 'bg-trail',
  curses: 'bg-trail',
  nightly: 'bg-trail',
  altar: 'bg-altar',
  fletcher: 'bg-camp',
  trophies: 'bg-camp',
  log: 'bg-camp',
  'range-setup': 'bg-camp',
};
decorateMenus($('ui'), (screen, section) => {
  const backdrop =
    screen === 'results'
      ? game?.outcome === 'The Hunter Falls'
        ? 'bg-fallen'
        : 'bg-trail'
      : screen === 'options' && scene === 'camp'
        ? 'bg-camp'
        : BACKDROPS[screen];
  if (backdrop) {
    section.classList.add('painted-bg');
    section.style.setProperty('--bg', `url('/art/gpt/${backdrop}.webp')`);
  }
  // Pause shows the run's build beside the menu.
  if (screen === 'pause' && game && scene === 'hunt') {
    section.classList.add('with-build');
    section.querySelector('.slu-panel')?.append(buildPanel(game));
  }
});
/** First-hunt lessons; created before any scene can begin. */
const coach = new Coach(
  () => audio.playSfx('coach.step'),
  () => {
    profile.onboarded = true;
    persist();
  },
);

const adapter = new PixiAdapter({
  loadLevel(id) {
    begin(id === 'range' ? 'range' : id === 'camp' ? 'camp' : 'hunt');
  },
  unloadLevel() {
    begin('camp');
  },
  suspend() {
    controls.clear();
  },
  resume() {
    controls.clear();
  },
  resize() {},
  screenshot() {
    return new Promise((resolve) => ($('game-canvas') as HTMLCanvasElement).toBlob(resolve));
  },
});
const app = await createGameApp({
  gameId: 'arrowfall',
  gameName: 'Arrowfall',
  version: '2.0.0-dev',
  renderer: adapter,
  root: $('ui'),
  assemblies: [(shell) => createSurvivorAssembly({ shell })],
  audio,
  pwa: false,
  mobileViewport: false,
});
const oldActivate = app.flow.onActivate.bind(app.flow),
  oldBack = app.flow.onBack.bind(app.flow);
function show(id: string, title: string, choices: UIChoice[], subtitle?: string, back?: string) {
  uiScreen = id;
  app.ui.register([{ id, title, choices, subtitle, backTarget: back }]);
  app.ui.show(id);
  document
    .querySelectorAll<HTMLElement>('.slu-panel')
    .forEach((el) => (el.style.zoom = String(options.uiScale)));
  controls.clear();
}
function hideUI() {
  uiScreen = 'gameplay-placeholder';
  app.ui.show('gameplay-placeholder');
}
let saveQueue = Promise.resolve();
function persist() {
  saveProfile(profile, localStorage);
  saveQueue = saveQueue
    .then(() => profileStore.save(profile))
    .catch((error) => {
      app.shell.studio.diagnostics.capture(error, { scope: 'profile.save' });
    });
}
function saveOptions() {
  try {
    localStorage.setItem('arrowfall.options', JSON.stringify(options));
  } catch {}
  view.colorblind = options.colorblind;
  view.shake = options.shake;
  view.reducedMotion = options.reducedMotion;
  view.showBands = options.bands;
  view.numbers = options.numbers;
  controls.toggle = options.toggle;
  controls.assist = options.assist;
  controls.haptics = options.haptics;
  view.setLowPower(options.lowPower);
  options.bindings = controls.bindings;
  options.padBindings = controls.padBindings;
  document
    .querySelectorAll<HTMLElement>('.slu-panel')
    .forEach((el) => (el.style.zoom = String(options.uiScale)));
  if (game) {
    game.assistLoose = options.autoLoose;
    game.holdFire = options.holdFire;
  }
  document.documentElement.style.fontSize = 16 * options.uiScale + 'px';
}
/** Mid-run save: kept on pause, when the tab hides, and every 30 seconds of a hunt. */
const RUN_KEY = 'arrowfall.run';
let resumeSave: (HuntSave & { nightly?: boolean }) | null = null,
  saveClock = 0;
function loadRunSave(): (HuntSave & { nightly?: boolean }) | null {
  try {
    return JSON.parse(localStorage.getItem(RUN_KEY) || 'null');
  } catch {
    return null;
  }
}
function saveRun() {
  // A boss alive at save time is fought again on resume (its bit in bossMask is still clear).
  if (!game || scene !== 'hunt' || game.outcome || coach.active) return;
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({ ...game.toSave(), nightly }));
  } catch {}
}
function clearRunSave() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {}
}
addEventListener('visibilitychange', () => {
  if (document.hidden) saveRun();
});
addEventListener('pagehide', saveRun);
function begin(next: string) {
  // A hunt left before its end (quit, restart) is still reported.
  if (playtest?.run && game) playtest.finish(game);
  scene = next;
  const resuming = next === 'hunt' ? resumeSave : null;
  resumeSave = null;
  if (resuming) {
    seedOverride = resuming.seed;
    selected = resuming.bow;
    phase = resuming.phase;
    nightly = !!resuming.nightly;
  } else if (next === 'hunt') clearRunSave();
  savedRun = false;
  controls.clear();
  const seed =
    seedOverride ??
    (nightly
      ? stableHashString(new Date().toISOString().slice(0, 10))
      : Math.floor(Math.random() * 4294967296));
  game = new Hunt(seed, profile, selected, phase, next === 'range');
  game.assistLoose = options.autoLoose;
  game.holdFire = options.holdFire;
  if (resuming) {
    seedOverride = null;
    game.restore(resuming);
  }
  saveClock = 0;
  if (next === 'camp') {
    game.scene = 'camp';
    game.freezeSpawns = true;
    game.god = true;
    // The hunter starts just south of the campfire.
    game.player.x = 600;
    game.player.y = 540;
    view.camera.x = 600;
    view.camera.y = 480;
  }
  view.attach(game, next === 'camp');
  deathClock = 0;
  if (next === 'hunt') resetDeeds();
  // A resumed hunt has already announced the deeds its progress met.
  if (resuming) checkDeeds(game, 0, true);
  // Each bow announces what makes it different as the hunt begins.
  if (resuming) game.announce(`The hunt resumes · ${fmt(game.time)}`);
  else if (next === 'hunt') {
    const line = [
      game.phase ? ['', 'Half Moon', 'Full Moon', 'Blood Moon'][game.phase] : '',
      game.bow.signature ? `${game.bow.name} · ${game.bow.signature}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (line) game.announce(line);
  }
  if (next === 'hunt' && !profile.onboarded && !resuming) coach.begin(game);
  else coach.finish();
  $('hud').classList.toggle('visible', next !== 'camp');
  $('camp-title').style.display = next === 'camp' ? 'block' : 'none';
  $('camp-menu').style.display = next === 'camp' ? 'block' : 'none';
  $('stations').innerHTML =
    next === 'camp'
      ? STATIONS.map(
          (s) =>
            `<button class="station" data-station="${s.id}" id="station-${s.id}">${s.name}</button>`,
        ).join('')
      : '';
  document
    .querySelectorAll<HTMLButtonElement>('[data-station]')
    .forEach((b) => (b.onclick = () => station(b.dataset.station!)));
  $('silver').textContent = profile.currency + ' Moonsilver';
  app.shell.session.setPhase('playing');
  hideUI();
  accumulator = 0;
  if (playtest && next !== 'camp') playtest.begin(next, game, selected);
}
async function launch(next = 'hunt') {
  audio.unlock();
  await app.shell.loadLevel(next);
  hideUI();
}
function trail() {
  show(
    'trail',
    'The Trail',
    [
      {
        id: 'fletcher',
        label: 'Choose Bow',
        description: BOWS.find((b) => b.id === selected)!.name,
      },
      {
        id: 'phase',
        label: 'Moon Phase',
        description: ['Crescent', 'Half Moon', 'Full Moon', 'Blood Moon'][phase],
      },
      {
        id: 'curses',
        label: `Curses · ${profile.curses.length ? '+' + Math.round(profile.curses.length * CURSE_BONUS * 100) + '% Moonsilver' : 'None'}`,
        description:
          profile.runs.length >= CURSES_UNLOCK_RUNS
            ? profile.curses.map((c) => CURSES.find((x) => x.id === c)?.name).join(' · ') ||
              'Make the night harder for more Moonsilver'
            : `Unlocks after ${CURSES_UNLOCK_RUNS} hunts`,
        disabled: profile.runs.length < CURSES_UNLOCK_RUNS,
      },
      {
        id: 'nightly',
        label: nightly ? 'Nightly Hunt · On' : 'Nightly Hunt · Off',
        description: (() => {
          const best = profile.runs
            .filter((r) => r.nightly === today())
            .sort((a, b) => b.time - a.time || b.kills - a.kills)[0];
          return best
            ? `Tonight's best: ${fmt(best.time)} · ${best.kills} hunted`
            : 'A daily seeded forest and card sequence, the same for everyone';
        })(),
      },
      { id: 'begin', label: 'Begin the Hunt' },
    ],
    undefined,
    'camp',
  );
}
function curses() {
  show(
    'curses',
    'Curses',
    CURSES.map((c) => ({
      id: 'curse:' + c.id,
      label: `${c.name} · ${profile.curses.includes(c.id) ? 'On' : 'Off'}`,
      description: `${c.effect} · +${Math.round(CURSE_BONUS * 100)}% Moonsilver`,
    })),
    'Stack as many as you dare',
    'trail',
  );
}
function station(id: string) {
  audio.unlock();
  if (id === 'trail') {
    trail();
    return;
  }
  if (id === 'fletcher') {
    show('fletcher', 'The Fletcher', bowChoices(profile, selected), undefined, 'camp');
    return;
  }
  if (id === 'range') {
    show(
      'range-setup',
      'The Range',
      [
        { id: 'practice', label: 'Free Practice' },
        ...['steady', 'sweet', 'deadeye', 'duel'].map((id, i) => ({
          id: 'challenge:' + id,
          label: ['Steady', 'Sweet Spot', 'Deadeye Drill', 'Poacher’s Duel'][i],
        })),
      ],
      undefined,
      'camp',
    );
    return;
  }
  if (id === 'altar') {
    show('altar', 'Silver Altar', altarChoices(profile), `${profile.currency} Moonsilver`, 'camp');
    return;
  }
  if (id === 'log') {
    show(
      'log',
      'Hunter’s Log',
      logChoices(profile),
      `${profile.runs.length} recorded hunts`,
      'camp',
    );
    // Each recent hunt carries a thumbnail of its build fingerprint (after the menu decorates).
    requestAnimationFrame(() =>
      document.querySelectorAll<HTMLElement>('#ui [data-choice-id^="run:"]').forEach((row) => {
        const r = profile.runs[Number(row.dataset.choiceId!.slice(4))];
        if (!r) return;
        const print = fingerprint(r);
        print.className = 'run-print';
        row.querySelector('.menu-icon')?.replaceWith(print);
      }),
    );
    return;
  }
  if (id === 'trophies') {
    show(
      'trophies',
      'Trophy Wall',
      DEEDS.map((d) => ({
        id: 'deed:' + d.id,
        label: d.name,
        description: Math.min(d.target, deedProgress(profile, d.metric)) + '/' + d.target,
        disabled: true,
      })),
      `${DEEDS.filter((d) => deedProgress(profile, d.metric) >= d.target).length} / 60 Deeds`,
      'camp',
    );
  }
}
function settings() {
  show(
    'options',
    'Options',
    [
      ...(playtest
        ? [
            {
              id: 'option:playtest',
              label: 'Playtest Report',
              description: `${playtest.session.runs.length} runs recorded on ${playtest.session.label}`,
            },
          ]
        : []),
      {
        id: 'option:preset',
        label: `Preset · ${options.preset}`,
        description:
          'Comfort: Hold to Fire, strong aim assist, calm motion · Standard · Challenge: release by hand, no assist or bands',
      },
      {
        id: 'option:holdFire',
        label: `Fire Mode · ${options.holdFire ? 'Hold to Fire' : 'Release to Fire'}`,
        description: options.holdFire
          ? 'Hold to keep shooting; let go in the window for a perfect'
          : 'Each arrow is drawn and released by hand',
      },
      {
        id: 'option:autoLoose',
        label: `Auto-Loose · ${options.autoLoose ? 'On' : 'Off'}`,
        description: 'Release at full draw',
      },
      { id: 'option:toggle', label: `Toggle Draw · ${options.toggle ? 'On' : 'Off'}` },
      {
        id: 'option:colorblind',
        label: `High Contrast Threats · ${options.colorblind ? 'On' : 'Off'}`,
      },
      {
        id: 'option:numbers',
        label: `Damage Numbers · ${options.numbers ? 'All Hits' : 'Criticals Only'}`,
      },
      { id: 'option:assist', label: `Aim Assist · ${Math.round(options.assist * 100)}%` },
      { id: 'option:uiScale', label: `UI Scale · ${Math.round(options.uiScale * 100)}%` },
      { id: 'option:bands', label: `Range Bands · ${options.bands ? 'On' : 'Off'}` },
      { id: 'option:shake', label: `Screen Shake · ${Math.round(options.shake * 100)}%` },
      {
        id: 'option:reducedMotion',
        label: `Reduced Motion · ${options.reducedMotion ? 'On' : 'Off'}`,
        description: 'No shake, pulses or drift; softer flashes',
      },
      { id: 'option:music', label: `Music · ${Math.round(options.music * 100)}%` },
      { id: 'option:sfx', label: `SFX · ${Math.round(options.sfx * 100)}%` },
      {
        id: 'option:captions',
        label: `Captions · ${options.captions ? 'On' : 'Off'}`,
        description: 'Text for important sounds: growls, horns, bells, war drums',
      },
      {
        id: 'option:haptics',
        label: `Haptics · ${options.haptics ? 'On' : 'Off'}`,
        description: 'Phone vibration and gamepad rumble',
      },
      {
        id: 'option:lowPower',
        label: `Performance Mode · ${options.lowPower ? 'On' : 'Off'}`,
        description: 'Fewer effects and lights, lower resolution (on by default on phones)',
      },
      { id: 'option:fullscreen', label: 'Fullscreen' },
      {
        id: 'option:tutorial',
        label: 'Replay Tutorial',
        description: 'The next hunt starts with the guided first-hunt lessons',
      },
      {
        id: 'option:rebind',
        label: 'Rebind Movement',
        description: 'Press a key for Up, Down, Left, Right in order',
      },
      {
        id: 'option:padRebind',
        label: 'Rebind Gamepad',
        description: 'Press a pad button for Draw, Dodge, then Deadeye',
      },
    ],
    undefined,
    scene === 'camp' ? 'camp' : 'pause',
  );
}
function levelUp() {
  if (!game) return;
  const choices: UIChoice[] = offerChoices(game);
  if (game.rerolls) choices.push({ id: 'reroll', label: `Reroll · ${game.rerolls}` });
  if (game.skips) choices.push({ id: 'skip', label: `Skip · ${game.skips}` });
  if (game.banishes) choices.push({ id: 'banish', label: `Banish First Card · ${game.banishes}` });
  show('levelup', 'Moonlight Answers', choices, `Level ${game.level} · choose one`);
  decorateLevelUp($('ui'), game, view.reducedMotion);
}
let showResults = () => {};
function endRun() {
  if (!game || savedRun) return;
  savedRun = true;
  clearRunSave();
  const g = game;
  // Each active curse adds to the Moonsilver payout.
  g.earned = Math.round(g.earned * (1 + CURSE_BONUS * g.curses.size));
  const axes = [
    g.damageSources.bow || 0,
    g.damageSources.deadshot || 0,
    g.evolutions.has('worldpiercer') ? g.damageSources.bow || 0 : 0,
    g.damageSources.hellfire || g.damageSources.status || 0,
    g.damageSources.thunderstorm || 0,
    g.damageSources.phantom || 0,
  ];
  const record: RunRecord = {
    time: g.time,
    kills: g.kills,
    shots: g.shots,
    perfects: g.perfects,
    outcome: g.outcome,
    bow: selected,
    currency: g.earned,
    fingerprint: axes,
    evolutions: [...g.evolutions],
    seed: g.seed,
    build: Object.entries(g.ranks)
      .filter(([, r]) => r > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
    nightly: nightly ? today() : undefined,
  };
  const unlocks = bankRun(profile, record, g.maxStreak, g.sweetKills);
  persist();
  playtest?.finish(g);
  const results = new ResultsManager().build(
    { kills: g.kills, perfects: g.perfects, shots: g.shots },
    { timeMs: g.time * 1000, metadata: { outcome: g.outcome } },
  );
  app.shell.studio.telemetry.record('run.result', { kills: results.stats.kills });
  app.flow.showResults();
  // Kept so the results can be shown again (coming back from the playtest report).
  showResults = () => {
    show(
      'results',
      g.outcome,
      [
        { id: 'retry', label: 'Hunt Again' },
        { id: 'camp', label: 'Return to Camp' },
        { id: 'fingerprint', label: 'Share Fingerprint' },
        ...(playtest ? [{ id: 'playtest', label: 'Playtest Report' }] : []),
      ],
      `${fmt(g.time)} survived · ${g.kills} hunted · ${Math.round((g.perfects / Math.max(1, g.shots)) * 100)}% perfect`,
    );
    decorateResults(
      $('ui'),
      [
        { label: 'Survived', value: fmt(g.time) },
        { label: 'Hunted', value: String(g.kills) },
        { label: 'Perfect', value: Math.round((g.perfects / Math.max(1, g.shots)) * 100) + '%' },
        { label: 'Level', value: String(g.level) },
        { label: 'Best streak', value: String(g.maxStreak) },
        { label: 'Moonsilver', value: '+' + g.earned },
      ],
      record.evolutions.map((id) => EVOLUTIONS.find((e) => e.id === id)?.name ?? id),
      fingerprint(record),
      g.outcome === 'The Hunter Falls' ? recapFor(g) : undefined,
      unlocks,
    );
  };
  showResults();
}
const today = () => new Date().toISOString().slice(0, 10);
/** Death recap: what killed the hunter, one targeted tip, and how close the next goal was. */
function recapFor(g: Hunt): Recap {
  const killer = g.killedBy || 'The Hollowmoor',
    perfect = g.perfects / Math.max(1, g.shots),
    dodgeKey = controls.touching ? 'tap Dodge' : controls.usingPad ? 'press A' : 'press Space';
  const tip = /charge/.test(killer)
    ? `Charges draw a red line first. Step off it, or ${dodgeKey} to roll straight through.`
    : /bolt/.test(killer)
      ? 'Bolts fly where you stand when they are loosed: keep moving sideways, or dodge as they fire.'
      : /slam|eruption/.test(killer)
        ? 'Red circles are ground strikes. Step out before the ring fills; a Barrow Worm erupts beneath you.'
        : perfect < 0.15
          ? 'Release at the chime: perfect arrows hit harder and fill Focus for Deadeye.'
          : g.kills > 0 && g.player.focus >= 100
            ? 'You died with Deadeye ready. Spend Focus early: it clears a crowd and buys space.'
            : 'Keep them at range: arrows in the sweet-spot band hit harder, so most foes fall before they reach you.';
  const previous = profile.runs.slice(1).reduce((best, r) => Math.max(best, r.time), 0),
    next = BOSSES.find((b) => b.time > g.time);
  const nudge =
    g.time > previous && previous > 0
      ? `New personal best · ${fmt(g.time)} (was ${fmt(previous)})`
      : next && next.time - g.time < 90
        ? `${next.name} was ${fmt(next.time - g.time)} away.`
        : previous > 0
          ? `Your best is ${fmt(previous)} · ${fmt(previous - g.time)} to beat it.`
          : next
            ? `${next.name} arrives at ${fmt(next.time)}.`
            : 'One more hunt.';
  return {
    killedBy: killer,
    time: g.time,
    hits: g.recentHits.slice(),
    sources: Object.entries(g.damageTaken).sort((a, b) => b[1] - a[1]),
    tip,
    nudge,
  };
}
let reportFrom = 'options';
/** The playtest report screen: copy or save the session, or start a fresh one. */
function playtestReport(from: string) {
  if (!playtest) return;
  reportFrom = from;
  const s = playtest.session,
    notes = s.runs.reduce((n, r) => n + r.notes.length, s.notes.length);
  const canShare = !!navigator.canShare?.({
    files: [new File(['{}'], 'x.json', { type: 'application/json' })],
  });
  show(
    'playtest',
    'Playtest Report',
    [
      { id: 'copy', label: 'Copy Report', description: 'Summary and full data, ready to paste' },
      canShare
        ? { id: 'share', label: 'Share Report File', description: playtest.fileName() }
        : { id: 'download', label: 'Download Report File', description: playtest.fileName() },
      {
        id: 'clear',
        label: 'Start a New Session',
        description: 'Clears the recorded runs on this device',
      },
    ],
    `${s.label} · ${s.runs.length} runs · ${notes} notes · build ${s.build}`,
    from === 'results' ? 'results' : 'options',
  );
}
async function playtestAction(id: string) {
  if (!playtest) return;
  const report = playtest.markdown() + '\n\n```json\n' + playtest.json() + '\n```\n',
    file = new File([playtest.json()], playtest.fileName(), { type: 'application/json' });
  let done = '';
  try {
    if (id === 'copy') {
      await navigator.clipboard.writeText(report);
      done = 'Report copied';
    } else if (id === 'share') {
      await navigator.share({ files: [file], title: 'Arrowfall playtest' });
      done = 'Report shared';
    } else if (id === 'download') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      done = 'Report saved';
    } else if (id === 'clear') {
      playtest.clear();
      done = 'New session started';
    }
  } catch {
    done = id === 'copy' ? 'Copy blocked: use Download instead' : '';
  }
  if (done) toast('Playtest', done);
  playtestReport(reportFrom);
}
/** Stamp a playtest note at this moment; `ask` opens the text box (keyboard and touch). */
function playtestNote(ask: boolean) {
  if (!playtest || noteOpen) return;
  const g = game,
    stamp = {
      t: g && scene !== 'camp' ? Math.round(g.time) : -1,
      scene,
      fps: Math.round(view.fps),
      enemies: g?.enemies.count ?? 0,
      hp: Math.round(g?.player.hp ?? 0),
      level: g?.level ?? 0,
      boss: g?.boss ? (BOSSES[g.boss.boss]?.name ?? '') : '',
      device: controls.device,
    };
  if (!ask) {
    playtest.note('', stamp);
    toast('Playtest', 'Marker saved');
    return;
  }
  noteOpen = true;
  controls.clear();
  openNoteBox((text) => {
    noteOpen = false;
    controls.clear();
    if (text !== null) {
      playtest.note(text, stamp);
      toast('Playtest', 'Note saved');
    }
  });
}
app.flow.onActivate = (screen, id) => {
  audio.unlock();
  audio.playSfx('ui.confirm');
  if (screen === 'title') {
    if (id === 'continue') {
      resumeSave = loadRunSave();
      void launch('hunt');
      return;
    }
    if (!profile.onboarded) {
      void launch();
    } else {
      void launch('camp');
    }
    return;
  }
  if (screen === 'main-menu') {
    void launch('camp');
    return;
  }
  if (screen === 'pause') {
    if (id === 'resume') {
      app.shell.resume();
      hideUI();
    } else if (id === 'restart') void launch(scene === 'range' ? 'range' : 'hunt');
    else if (id === 'settings') settings();
    else if (id === 'quit') {
      clearRunSave();
      void launch('camp');
    }
    return;
  }
  if (screen === 'trail') {
    if (id === 'fletcher') station('fletcher');
    if (id === 'phase')
      show(
        'phase',
        'Moon Phase',
        ['Crescent', 'Half Moon', 'Full Moon', 'Blood Moon'].map((label, i) => ({
          id: 'phase:' + i,
          label,
          disabled: i > profile.phase,
        })),
        undefined,
        'trail',
      );
    if (id === 'nightly') {
      nightly = !nightly;
      trail();
    }
    if (id === 'curses') curses();
    if (id === 'begin') void launch();
    return;
  }
  if (screen === 'curses' && id.startsWith('curse:')) {
    const c = id.slice(6);
    profile.curses = profile.curses.includes(c)
      ? profile.curses.filter((x) => x !== c)
      : [...profile.curses, c];
    persist();
    curses();
    return;
  }
  if (screen === 'fletcher' && id.startsWith('bow:')) {
    selected = id.slice(4);
    station('fletcher');
    return;
  }
  if (screen === 'range-setup') {
    void launch('range').then(() => {
      if (id.startsWith('challenge:')) game?.startChallenge(id.slice(10));
    });
    return;
  }
  if (screen === 'phase') {
    phase = Number(id.slice(6));
    trail();
    return;
  }
  if (screen === 'altar') {
    const name = id.slice(5),
      rank = profile.boons[name] || 0,
      cost = boonCost(rank);
    if (profile.currency >= cost) {
      profile.currency -= cost;
      profile.boons[name] = rank + 1;
      persist();
      station('altar');
    }
    return;
  }
  if (screen === 'levelup' && game) {
    if (game.choiceGuard > 0) return;
    if (id === 'reroll') {
      game.reroll();
      levelUp();
    } else if (id === 'skip') {
      game.skip();
      hideUI();
    } else if (id === 'banish') {
      game.banish(0);
      levelUp();
    } else {
      game.choose(Number(id.slice(5)));
      if (!game.offers.length) hideUI();
    }
    return;
  }
  if (screen === 'results') {
    if (id === 'retry') void launch();
    if (id === 'camp') void launch('camp');
    if (id === 'playtest') {
      playtestReport('results');
      return;
    }
    if (id === 'fingerprint') {
      const c = fingerprint(profile.runs[0]),
        a = document.createElement('a');
      a.download = `arrowfall-${game?.seed}.png`;
      a.href = c.toDataURL();
      a.click();
    }
    return;
  }
  if (screen === 'playtest') {
    void playtestAction(id);
    return;
  }
  if (screen === 'options' && id === 'option:playtest') {
    playtestReport('options');
    return;
  }
  if (screen === 'options') {
    const key = id.slice(7);
    if (
      [
        'autoLoose',
        'holdFire',
        'toggle',
        'colorblind',
        'bands',
        'numbers',
        'reducedMotion',
        'captions',
        'haptics',
        'lowPower',
      ].includes(key)
    ) {
      const k = key as 'autoLoose';
      options[k] = !options[k];
    }
    if (key === 'assist')
      options.assist = options.assist >= 1 ? 0 : Math.min(1, options.assist + 0.1);
    if (key === 'uiScale') options.uiScale = options.uiScale >= 1.5 ? 0.75 : options.uiScale + 0.25;
    if (key === 'shake') options.shake = options.shake <= 0 ? 1 : Math.max(0, options.shake - 0.25);
    if (key === 'music' || key === 'sfx') {
      options[key] = options[key] <= 0 ? 1 : Math.max(0, options[key] - 0.1);
      app.audioMixer?.setVolume(key, options[key]);
    }
    if (key === 'preset') {
      const order = ['Comfort', 'Standard', 'Challenge'],
        next = order[(order.indexOf(options.preset) + 1) % order.length];
      options.preset = next;
      Object.assign(
        options,
        next === 'Comfort'
          ? {
              holdFire: true,
              assist: 0.6,
              reducedMotion: true,
              shake: 0.5,
              bands: true,
              numbers: true,
            }
          : next === 'Challenge'
            ? {
                holdFire: false,
                assist: 0,
                reducedMotion: false,
                shake: 1,
                bands: false,
                numbers: false,
              }
            : {
                holdFire: true,
                assist: 0.3,
                reducedMotion: false,
                shake: 1,
                bands: true,
                numbers: true,
              },
      );
    }
    if (key === 'padRebind') {
      padRebind = ['draw', 'dodge', 'deadeye'];
      padPrevious = [];
      $('hint').textContent = 'Press a gamepad button for Draw';
    }
    if (key === 'tutorial') {
      profile.onboarded = false;
      persist();
    }
    if (key === 'fullscreen') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    }
    if (key === 'rebind') {
      let i = 0;
      const names = ['up', 'down', 'left', 'right'] as const;
      $('hint').textContent = 'Press a key for Up';
      const handler = (e: KeyboardEvent) => {
        e.preventDefault();
        controls.bindings[names[i++]] = e.code;
        if (i >= 4) {
          removeEventListener('keydown', handler, true);
          $('hint').textContent = '';
          saveOptions();
        } else $('hint').textContent = 'Press a key for ' + names[i];
      };
      addEventListener('keydown', handler, true);
    }
    saveOptions();
    settings();
    return;
  }
  oldActivate(screen, id);
};
app.flow.onBack = (screen) => {
  if (
    screen === 'range-setup' ||
    screen === 'trail' ||
    screen === 'fletcher' ||
    screen === 'altar' ||
    screen === 'trophies' ||
    screen === 'log'
  ) {
    hideUI();
    return;
  }
  if (screen === 'phase' || screen === 'curses') {
    trail();
    return;
  }
  if (screen === 'playtest') {
    if (reportFrom === 'results') showResults();
    else settings();
    return;
  }
  if (screen === 'options') {
    if (scene === 'camp') hideUI();
    else {
      app.flow.showPause();
      uiScreen = 'pause';
    }
    return;
  }
  oldBack(screen);
};
show(
  'title',
  'ARROWFALL',
  [
    ...(loadRunSave()
      ? [
          {
            id: 'continue',
            label: 'Continue Hunt',
            description: `${fmt(loadRunSave()!.time)} survived · level ${loadRunSave()!.level}`,
          },
        ]
      : []),
    { id: 'start', label: profile.onboarded ? 'Return to the Hollowmoor' : 'Begin the Hunt' },
  ],
  '20 Minutes. One Hunter. Endless Arrows.',
);
const menuBackdrop = new Hunt(4421, profile);
view.attach(menuBackdrop);
menuBackdrop.freezeSpawns = true;
$('camp-menu').onclick = settings;
// Camp has no hunt to pause: Escape / Start only closes a station menu (the shell would
// otherwise show the hunt's Pause screen right after the pause event).
const shellPause = app.flow.showPause.bind(app.flow);
app.flow.showPause = () => {
  if (scene !== 'camp') return shellPause();
  app.shell.resume();
  hideUI();
};
app.shell.events.on('game:pause', () => {
  uiScreen = 'pause';
  saveRun();
  if (game?.deadeye) {
    pauseDeferred = true;
    app.shell.resume();
    hideUI();
  }
});
app.shell.studio.dev.registerPanel('Arrowfall', { read: () => snapshot() });
app.shell.studio.dev.register('arrowfall.focus', {
  description: 'Fill Focus',
  run: () => {
    if (game) game.player.focus = 100;
  },
});
function snapshot() {
  return {
    camera: { ...view.camera },
    zoom: view.zoom,
    width: view.width,
    height: view.height,
    scene,
    time: game?.time || 0,
    hp: game?.player.hp || 0,
    level: game?.level || 1,
    enemies: game?.enemies.count || 0,
    arrows: game?.arrows.count || 0,
    particles: game?.particles.count || 0,
    shots: game?.shots || 0,
    perfects: game?.perfects || 0,
    focus: game?.player.focus || 0,
    deadeye: game?.deadeye || 0,
    marks: game?.focusMarks || 0,
    offers: game?.offers.slice() || [],
    evolutions: game ? [...game.evolutions] : [],
    boss: game?.boss
      ? { id: BOSSES[game.boss.boss].id, hp: game.boss.hp, phase: game.boss.phase }
      : null,
    outcome: game?.outcome || '',
    fps: view.fps,
    timing: { ...view.timing },
    seed: game?.seed,
    damage: game ? { ...game.damageSources } : {},
  };
}
const devMode = import.meta.env.DEV;
if (devMode) {
  (window as any).__ARROWFALL__ = {
    get state() {
      return snapshot();
    },
    startRun: (config: any = {}) => {
      seedOverride = config.seed ?? 1313;
      selected = config.bow ?? 'recurve';
      if (config.phase !== undefined) phase = config.phase;
      void launch(config.range ? 'range' : 'hunt');
    },
    /** Test hook: read or patch the profile (camp progression, unlocks). */
    patchProfile: (patch: object = {}) => Object.assign(profile, patch),
    skipTutorial: () => {
      coach.finish();
      profile.onboarded = true;
    },
    setSeed: (seed: number) => {
      seedOverride = seed;
    },
    timeSkip: (t: number) => {
      if (game) {
        game.time = t;
        game.boss = null;
        for (const e of game.enemies.items) if (e.boss >= 0) e.active = false;
        game.bossMask = (1 << BOSSES.filter((b) => b.time < t).length) - 1;
      }
    },
    grant: (id: string) => game?.grant(id),
    focus: () => {
      if (game) game.player.focus = 100;
    },
    spawn: (id: string, elite = -1) => {
      if (game) {
        const kind = ENEMIES.findIndex((e) => e.id === id);
        return game.spawn(Math.max(0, kind), game.player.x + 330, game.player.y, false, elite)?.id;
      }
    },
    boss: (i: number) => game?.spawnBoss(i),
    god: (value = true) => {
      if (game) game.god = value;
    },
    finish: () => {
      // Straight to results: the dev command skips the death beat.
      deathClock = DEATH_BEAT;
      game?.finish('The Hunter Falls');
    },
    xp: (amount: number) => game?.gainXp(amount),
    choose: (i: number) => {
      if (game) {
        game.choiceGuard = 0;
        game.choose(i);
        // Never hide the results screen: a finished hunt has nothing to choose.
        if (!game.outcome) hideUI();
      }
    },
    damageBoss: (fraction = 0.35) => {
      if (game?.boss) game.boss.hp -= game.boss.maxHp * fraction;
    },
    killBoss: () => {
      if (game?.boss) game.kill(game.boss);
    },
    stress: () => game?.stressFill(),
    grayscale: (on = true) => document.documentElement.classList.toggle('grayscale', on),
    atmosphere: (on = true) => {
      view.atmosphere.enabled = on;
    },
    event: (i: number) => game?.startEvent(i),
    formation: (i: number) => game?.formation(i),
    profile: () => structuredClone(profile),
    timeline: () => game?.timeline.slice(),
    sim: () => game,
    view: () => view,
    playtest: () => playtest,
  };
}
$('dev').innerHTML =
  `<b>ARROWFALL</b><br><button data-dev="focus">Fill Focus</button><button data-dev="god">God Mode</button><button data-dev="stress">350 Enemies</button><button data-dev="grayscale">Grayscale</button><br>${BOSSES.map((b, i) => `<button data-boss="${i}">${fmt(b.time)} ${b.name}</button>`).join('')}<select id="dev-grant">${[...UPGRADES.map((u) => ({ id: u.id, name: u.name })), ...EVOLUTIONS.map((e) => ({ id: 'evo:' + e.id, name: e.name }))].map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select><button data-dev="grant">Grant</button>`;
$('dev').onclick = (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || !game) return;
  const d = (b as HTMLElement).dataset;
  if (d.boss) {
    game.time = BOSSES[Number(d.boss)].time;
    game.spawnBoss(Number(d.boss));
  }
  if (d.dev === 'focus') game.player.focus = 100;
  if (d.dev === 'god') game.god = !game.god;
  if (d.dev === 'stress') (window as any).__ARROWFALL__.stress();
  if (d.dev === 'grayscale') document.documentElement.classList.toggle('grayscale');
  if (d.dev === 'grant') game.grant(($('dev-grant') as HTMLSelectElement).value);
};
addEventListener('keydown', (e) => {
  if (e.code === 'KeyN' && playtest && !e.repeat) {
    e.preventDefault();
    playtestNote(true);
  }
  if (e.code === 'F3' && devMode) {
    e.preventDefault();
    document.documentElement.classList.toggle('grayscale');
  }
  if (e.code === 'F1' && devMode) {
    e.preventDefault();
    $('dev').classList.toggle('visible');
  }
  if (e.code === 'F2' && devMode) {
    e.preventDefault();
    showPerf = !showPerf;
  }
  if (e.code === 'KeyF' && scene === 'camp' && game && uiScreen === 'gameplay-placeholder') {
    const nearest = STATIONS.find(
      (s) => Math.hypot(s.x - game!.player.x, s.y - game!.player.y) < STATION_REACH,
    );
    if (nearest) station(nearest.id);
  }
  if (uiScreen === 'levelup' && /^Digit[1-4]$/.test(e.code))
    app.flow.onActivate('levelup', 'pick:' + (Number(e.code.slice(5)) - 1));
});
function hud(g: Hunt) {
  const p = g.player;
  $('hp').textContent = String(Math.max(0, Math.ceil(p.hp)));
  $('hp-fill').style.width = (p.hp / p.maxHp) * 100 + '%';
  $('hp-fill').parentElement!.classList.toggle('low', p.hp / p.maxHp < 0.3);
  // Perfect streak: appears at 3, escalates in tiers (5 / 10 / 20).
  const streakEl = $('streak'),
    tier = T.streakTiers.filter((n) => p.streak >= n).length;
  streakEl.textContent = p.streak >= 3 ? `Perfect ×${p.streak}` : '';
  streakEl.dataset.tier = String(tier);
  const ready = p.focus >= 100;
  $('focus-fill').style.width = Math.min(100, p.focus) + '%';
  $('focus').classList.toggle('ready', ready);
  $('focus-ready').textContent = ready
    ? `Deadeye ready · ${controls.touching ? 'tap Deadeye' : controls.usingPad ? 'RB' : 'E / right-click'}`
    : '';
  $('time').textContent = fmt(g.time);
  $('night').textContent =
    g.time >= 1140
      ? 'THE FINAL HUNT'
      : g.time >= 900
        ? 'FALSE DAWN'
        : g.time >= 600
          ? 'WITCHING HOURS'
          : g.time >= 300
            ? 'DEEP NIGHT'
            : g.time >= 120
              ? 'FIRST HOWL'
              : 'MOONRISE';
  $('moon').style.color = g.time >= 600 || phase === 3 ? PALETTE.threat.rim : PALETTE.silver;
  // Draw window, Focus and dodge recovery are shown on the hunter (render/diegetic.ts).
  $('stats').innerHTML = `<b class="lv">${g.level}</b><span>Level</span><em>${g.kills} hunted</em>`;
  $('controls').classList.toggle('faded', scene === 'hunt' && g.time > 20);
  if (shownDevice !== controls.device) {
    shownDevice = controls.device;
    $('controls').innerHTML = CONTROL_HINTS[controls.device];
  }
  $('xp-fill').style.width = (g.xp / xpNeeded(g.level)) * 100 + '%';
  $('inventory').innerHTML = `${TOOLS.filter((t) => g.rank(t.id) > 0)
    .map((t) => t.name + ' ' + g.rank(t.id))
    .join(
      ' · ',
    )}<br><b>${[...g.evolutions].map((id) => EVOLUTIONS.find((e) => e.id === id)?.name).join(' · ')}</b>`;
  $('banner').textContent = g.bannerTime > 0 && g.cinematic <= 0 ? g.banner : '';
  $('boss').innerHTML = g.boss
    ? `${BOSSES[g.boss.boss].name} · ${['I', 'II', 'III'][g.boss.phase - 1]}<div class="bar"><i style="width:${(g.boss.hp / g.boss.maxHp) * 100}%"></i></div>`
    : '';
  if (scene === 'range') {
    $('hint').textContent = g.challenge
      ? g.rangeWon
        ? 'Challenge complete'
        : g.challenge === 'steady'
          ? `${g.perfects - g.challengePerfect}/5 perfects · ${Math.max(0, 10 - g.time + g.challengeStart).toFixed(1)} seconds`
          : g.challenge === 'sweet'
            ? `${g.rangeSweet}/20 moving sweet-spot hits`
            : g.challenge === 'deadeye'
              ? `${g.rangeDeadeye}/8 Deadeye hits`
              : `${g.rangeInterrupt}/3 interrupts`
      : 'The Range · Hold to draw · Release at the chime · Esc to leave';
    if (g.rangeWon) persist();
  } else $('hint').textContent = '';
}
/** Deed toasts: completions (and near-completions) announced mid-hunt, top right. */
const toasts = document.createElement('div');
toasts.id = 'toasts';
document.body.append(toasts);
let deedsDone = new Set<string>(),
  deedsNear = new Set<string>(),
  deedClock = 0;
function toast(kind: string, text: string) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind === 'Deed complete' ? 'done' : '');
  el.innerHTML = `<small>${kind}</small><b></b>`;
  el.querySelector('b')!.textContent = text;
  toasts.append(el);
  setTimeout(() => el.remove(), 4200);
}
function resetDeeds() {
  deedsDone = new Set(
    DEEDS.filter((d) => deedProgress(profile, d.metric) >= d.target).map((d) => d.id),
  );
  deedsNear = new Set();
}
function checkDeeds(g: Hunt, dt: number, silent = false) {
  deedClock -= dt;
  if (deedClock > 0 && !silent) return;
  deedClock = 0.5;
  const live = {
    ...profile,
    kills: profile.kills + g.kills,
    perfects: profile.perfects + g.perfects,
    sweetKills: profile.sweetKills + g.sweetKills,
    maxStreak: Math.max(profile.maxStreak, g.maxStreak),
  };
  for (const d of DEEDS) {
    if (deedsDone.has(d.id)) continue;
    const progress = deedProgress(live, d.metric);
    if (progress >= d.target) {
      deedsDone.add(d.id);
      if (silent) continue;
      toast('Deed complete', d.name);
      audio.playSfx('coach.step');
    } else if (d.target >= 20 && progress / d.target >= 0.9 && !deedsNear.has(d.id)) {
      deedsNear.add(d.id);
      if (!silent) toast('Almost there', `${d.name} · ${progress}/${d.target}`);
    }
  }
}
/** Level-up surge: a full-screen moonlight flash and a big level numeral over the hunt. */
const surge = document.createElement('div');
surge.id = 'surge';
surge.innerHTML =
  '<div class="surge-flash"></div><div class="surge-text"><small>Level</small><b></b></div>';
document.body.append(surge);
/** Boss cinematics: letterbox bars and a title card (arrival) or a Vanquished card (fall). */
const cine = document.createElement('div');
cine.id = 'cine';
cine.innerHTML =
  '<i class="bar top"></i><i class="bar bottom"></i><div class="cine-card"><small></small><h2></h2><p></p></div>';
document.body.append(cine);
function bossCard(index: number, kind: 'intro' | 'fall') {
  const b = BOSSES[index];
  cine.querySelector('small')!.textContent = kind === 'intro' ? b.epithet : 'Vanquished';
  cine.querySelector('h2')!.textContent = b.name;
  cine.querySelector('p')!.textContent =
    kind === 'intro' ? b.hint : '+50 Moonsilver · a relic awaits';
  cine.className = '';
  void cine.offsetWidth;
  cine.className = 'play ' + kind;
}
function surgeBanner(level: number) {
  surge.querySelector('b')!.textContent = String(level);
  surge.classList.remove('play');
  void surge.offsetWidth;
  surge.classList.add('play');
}
/** Captions for sounds that carry information (option: Captions). */
const CAPTIONS: Record<string, string> = {
  'enemy.hound.crouch': '[Pack growls]',
  'enemy.telegraph': '[Attack winding up]',
  'enemy.loose': '[Bowstring, enemy archer]',
  'formation.arrival': '[Distant horn]',
  'pace.swarm': '[Hunting horn — the swarm comes]',
  'pace.lull': '[A hush falls]',
  'world.midnight': '[Midnight bell tolls]',
  'world.event': '[Something stirs in the moor]',
  'world.discover': '[A landmark chimes]',
  'boss.intro': '[War drums]',
  'boss.phase': '[The beast roars]',
  'boss.fullmoon': '[The full moon answers]',
  'boss.fall': '[A great beast falls]',
  'boss.bramble.wall': '[Roots tear the earth]',
  'boss.hag.threefold': '[The Hag laughs, threefold]',
  'tool.snare.trigger': '[Snare snaps]',
  'player.hurt': '[Hit]',
};
/** Haptic weight per event: [strength 0..1, milliseconds]. */
const RUMBLE: Record<string, [number, number]> = {
  'player.hurt': [0.8, 140],
  'player.death': [1, 400],
  'player.dodge': [0.25, 50],
  'bow.perfect': [0.35, 45],
  'number.crit': [0.2, 30],
  'deadeye.release': [0.7, 160],
  'boss.intro': [0.6, 500],
  'boss.fall': [1, 600],
  'level.up': [0.4, 120],
};
let captionTimer = 0;
function caption(text: string) {
  const el = $('caption');
  if (el.textContent === text && captionTimer) return;
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => {
    el.classList.remove('on');
    captionTimer = 0;
  }, 2200);
}
/** On-screen control hints follow the device in hand. */
const CONTROL_HINTS = {
  keyboard:
    'WASD move · Hold / release to loose<br />Space dodge · E / right-click Deadeye · Esc pause',
  pad: 'Left stick move · Right stick aim · RT draw<br />A dodge · RB Deadeye · Start pause',
  touch:
    'Left thumb move · Right thumb aim and draw<br />Tap Dodge · Tap Deadeye when Focus is full',
};
let shownDevice = '';
function tick(now: number) {
  const rawMs = now - last,
    dt = Math.min(0.1, rawMs / 1000);
  last = now;
  view.fps += (1 / Math.max(0.001, dt) - view.fps) * 0.04;
  const g = game ?? menuBackdrop;
  if (game && app.shell.session.phase === 'playing') {
    if (uiScreen === 'gameplay-placeholder' && !noteOpen) {
      const input = controls.sample(view, g.player, g.enemies.items);
      if (scene === 'camp') {
        if (input.dodge) {
          const nearest = STATIONS.find(
            (s) => Math.hypot(s.x - g.player.x, s.y - g.player.y) < STATION_REACH,
          );
          if (nearest) station(nearest.id);
        }
        // Camp walking faces where the hunter goes (the bow is lowered here) and plays the run.
        g.moving = Math.hypot(input.mx, input.my) > 0.1;
        g.player.aim = g.moving
          ? Math.atan2(input.my, input.mx)
          : Math.atan2(input.ay - g.player.y, input.ax - g.player.x);
        g.player.x += input.mx * 240 * dt;
        g.player.y += input.my * 240 * dt;
        g.realTime += dt;
        g.player.x = Math.max(100, Math.min(1050, g.player.x));
        g.player.y = Math.max(100, Math.min(760, g.player.y));
      } else {
        accumulator += dt;
        const simStart = performance.now();
        let steps = 0;
        while (accumulator >= 1 / 60 && steps++ < 6) {
          g.viewport.width = view.width / view.zoom;
          g.viewport.height = view.height / view.zoom;
          g.step(1 / 60, input);
          input.dodge = false;
          input.deadeye = false;
          accumulator -= 1 / 60;
          if (g.offers.length) break;
        }
        view.timing.sim += (performance.now() - simStart - view.timing.sim) * 0.1;
        if (g.offers.length) levelUp();
        if ((saveClock += dt) >= 30) {
          saveClock = 0;
          saveRun();
        }
        // A fallen hunter gets a moment: the death plays out before the results arrive.
        if (g.outcome === 'The Hunter Falls' && deathClock < DEATH_BEAT) deathClock += dt;
        else if (g.outcome) endRun();
        if (pauseDeferred && g.deadeye <= 0) {
          pauseDeferred = false;
          app.flow.showPause();
          uiScreen = 'pause';
        }
      }
    } else if (uiScreen === 'levelup') g.choiceGuard = Math.max(0, g.choiceGuard - dt);
  }
  if (scene === 'camp' && game) {
    for (const s of STATIONS) {
      const el = $('station-' + s.id);
      if (!el) continue;
      el.style.left = view.width / 2 + (s.x - view.camera.x) * view.zoom + 'px';
      el.style.top = view.height / 2 + (s.y - view.camera.y) * view.zoom + 62 + 'px';
      el.classList.toggle(
        'near',
        Math.hypot(s.x - game.player.x, s.y - game.player.y) < STATION_REACH,
      );
    }
    if (uiScreen === 'gameplay-placeholder')
      $('hint').textContent = controls.touching
        ? 'Drag on the left to walk · tap a station'
        : controls.usingPad
          ? 'Left stick to walk · A at a station'
          : 'WASD to walk · F or Space at a station';
    else $('hint').textContent = '';
  }
  if (game && scene !== 'camp') hud(g);
  if (game && scene === 'hunt' && uiScreen === 'gameplay-placeholder') checkDeeds(g, dt);
  controls.touch.setActive(
    controls.touching && !!game && uiScreen === 'gameplay-placeholder',
    !!game && game.player.focus >= 100,
  );
  if (game && scene === 'hunt' && coach.active) {
    // The Deadeye lesson hands over a full Focus bar so it can be tried right away.
    if (coach.step === 5 && !coach.deadeyed && g.player.focus < 100) g.player.focus = 100;
    // The dodge lesson sends a real Hollow Stag charge to roll through.
    if (coach.step === 3 && !coach.charged) {
      coach.charged = true;
      coach.dodged = false;
      const a = g.player.aim + Math.PI * 0.5,
        stag = g.spawn(4, g.player.x + Math.cos(a) * 520, g.player.y + Math.sin(a) * 520);
      if (stag) stag.clock = 0;
    }
    coach.update(
      g,
      dt,
      controls.touching ? 'touch' : controls.usingPad ? 'pad' : 'mouse',
      options.holdFire,
      uiScreen === 'gameplay-placeholder' && g.cinematic <= 0,
    );
  }
  view.render(g, dt);
  if (playtest && game) {
    playtest.frame(rawMs, {
      scene,
      playing: app.shell.session.phase === 'playing' && uiScreen === 'gameplay-placeholder',
      t: game.time,
      device: controls.device,
      enemies: game.enemies.count,
      arrows: game.arrows.count,
      particles: game.particles.count,
    });
    for (const event of game.events) playtest.event(event.id, event.value, game.time);
    // Pad Back / View button drops a marker (no typing on a pad).
    const back = !!Array.from(navigator.getGamepads?.() ?? []).find(Boolean)?.buttons[8]?.pressed;
    if (back && !padNotePrevious) playtestNote(false);
    padNotePrevious = back;
  }
  for (const event of g.events) {
    if (event.id === 'number.crit' || event.id === 'number.deadeye') audio.playSfx('hit.crit');
    else if (!event.id.startsWith('number.')) audio.playSfx(event.id);
    if (event.id === 'level.up' && scene === 'hunt') surgeBanner(event.value);
    if (event.id === 'boss.intro' && scene === 'hunt') bossCard(event.value, 'intro');
    if (event.id === 'boss.fall' && scene === 'hunt') bossCard(event.value, 'fall');
    const buzz = RUMBLE[event.id];
    if (buzz && scene !== 'camp') controls.rumble(buzz[0], buzz[1]);
    if (options.captions && CAPTIONS[event.id]) caption(CAPTIONS[event.id]);
  }
  // Pad rebinding: the next three fresh presses become Draw, Dodge, Deadeye.
  if (padRebind.length) {
    const pressed = controls.padPress(padPrevious);
    if (pressed >= 0) {
      controls.padBindings[padRebind.shift()!] = pressed;
      $('hint').textContent = padRebind.length
        ? 'Press a gamepad button for ' + padRebind[0][0].toUpperCase() + padRebind[0].slice(1)
        : '';
      if (!padRebind.length) saveOptions();
    }
  }
  // Draw tension: a faint pad hum while the window is open.
  if (
    game &&
    scene === 'hunt' &&
    g.player.draw >= g.drawFull - g.drawWindow &&
    g.player.draw < g.drawFull + 0.05
  )
    controls.rumble(0.08, 40);
  g.events.length = 0;
  if (app.shell.session.phase === 'playing')
    audio.tick(g.time, g.player.draw, uiScreen !== 'gameplay-placeholder', !!g.boss);
  $('perf').textContent = showPerf
    ? `${view.fps.toFixed(1)} FPS · ${(1000 / view.fps).toFixed(2)} ms\n${g.enemies.count} enemies · ${g.arrows.count} arrows\n${g.threats.count} threats · ${g.particles.count} particles\nPerfect ${g.perfects}/${g.shots} · cap ${g.cap()}\n${Object.entries(
        g.damageSources,
      )
        .map(([id, d]) => id + ': ' + Math.floor(d / Math.max(1, g.time)) + ' DPS')
        .join('\n')}`
    : '';
  requestAnimationFrame(tick);
}
app.audioMixer?.setVolume('music', options.music);
app.audioMixer?.setVolume('sfx', options.sfx);
app.audioMixer?.setVolume('master', 0.65);
requestAnimationFrame(tick);
