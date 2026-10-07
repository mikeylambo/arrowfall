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
import { Hunt } from './sim/game';
import { BOWS } from './data/bows';
import { BOSSES } from './data/bosses';
import { UPGRADES } from './data/upgrades';
import { PALETTE } from './data/art';
import { EVOLUTIONS } from './data/evolutions';
import { ENEMIES } from './data/enemies';
import { DEEDS } from './data/meta';
import { deedProgress } from './sim/profile';
import { STATIONS } from './data/world';
import { xpNeeded } from './data/tuning';
import { loadProfile, saveProfile, bankRun, boonCost } from './sim/profile';
import { fmt, bowChoices, offerChoices, altarChoices, logChoices, fingerprint } from './ui/screens';
import { decorateLevelUp, decorateResults, type Recap } from './ui/cards';
import { Coach } from './ui/coach';
import { decorateMenus } from './ui/menus';
import { TOOLS } from './data/tools';
import type { Profile, RunRecord } from './sim/types';
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
let options = {
  version: 2,
  autoLoose: false,
  // Touch players hold to fire by default; on PC it is an option (tap/hold-release otherwise).
  holdFire: touchDevice,
  colorblind: false,
  bands: true,
  numbers: true,
  toggle: false,
  uiScale: 1,
  assist: 0.3,
  bindings: controls.bindings,
  music: 0.25,
  sfx: 0.7,
  shake: 1,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
};
try {
  const saved = JSON.parse(localStorage.getItem('arrowfall.options') || '{}');
  // v2: damage numbers on every hit became the default; older saves had it off.
  if ((saved.version ?? 1) < 2) delete saved.numbers;
  options = { ...options, ...saved, version: 2 };
} catch {}
controls.toggle = options.toggle;
controls.bindings = options.bindings;
controls.assist = options.assist;
view.colorblind = options.colorblind;
view.showBands = options.bands;
view.numbers = options.numbers;
view.shake = options.shake;
view.reducedMotion = options.reducedMotion;
await view.init($('game-canvas') as HTMLCanvasElement);
decorateMenus($('ui'));
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
  options.bindings = controls.bindings;
  document
    .querySelectorAll<HTMLElement>('.slu-panel')
    .forEach((el) => (el.style.zoom = String(options.uiScale)));
  if (game) {
    game.assistLoose = options.autoLoose;
    game.holdFire = options.holdFire;
  }
  document.documentElement.style.fontSize = 16 * options.uiScale + 'px';
}
function begin(next: string) {
  scene = next;
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
  if (next === 'camp') {
    game.scene = 'camp';
    game.freezeSpawns = true;
    game.god = true;
    game.player.x = 600;
    game.player.y = 430;
    view.camera.x = 600;
    view.camera.y = 430;
  }
  view.attach(game, next === 'camp');
  if (next === 'hunt' && !profile.onboarded) coach.begin(game);
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
        id: 'nightly',
        label: nightly ? 'Nightly Hunt · On' : 'Nightly Hunt · Off',
        description: 'A daily seeded forest and card sequence',
      },
      { id: 'begin', label: 'Begin the Hunt' },
    ],
    undefined,
    'camp',
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
function endRun() {
  if (!game || savedRun) return;
  savedRun = true;
  const g = game;
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
  };
  bankRun(profile, record, g.maxStreak, g.sweetKills);
  persist();
  const results = new ResultsManager().build(
    { kills: g.kills, perfects: g.perfects, shots: g.shots },
    { timeMs: g.time * 1000, metadata: { outcome: g.outcome } },
  );
  app.shell.studio.telemetry.record('run.result', { kills: results.stats.kills });
  app.flow.showResults();
  show(
    'results',
    g.outcome,
    [
      { id: 'retry', label: 'Hunt Again' },
      { id: 'camp', label: 'Return to Camp' },
      { id: 'fingerprint', label: 'Share Fingerprint' },
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
  );
}
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
app.flow.onActivate = (screen, id) => {
  audio.unlock();
  audio.playSfx('ui.confirm');
  if (screen === 'title') {
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
    else if (id === 'quit') void launch('camp');
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
    if (id === 'begin') void launch();
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
    if (id === 'fingerprint') {
      const c = fingerprint(profile.runs[0]),
        a = document.createElement('a');
      a.download = `arrowfall-${game?.seed}.png`;
      a.href = c.toDataURL();
      a.click();
    }
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
  if (screen === 'phase') {
    trail();
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
  [{ id: 'start', label: profile.onboarded ? 'Return to the Hollowmoor' : 'Begin the Hunt' }],
  '20 Minutes. One Hunter. Endless Arrows.',
);
const menuBackdrop = new Hunt(4421, profile);
view.attach(menuBackdrop);
menuBackdrop.freezeSpawns = true;
$('camp-menu').onclick = settings;
app.shell.events.on('game:pause', () => {
  uiScreen = 'pause';
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
      void launch(config.range ? 'range' : 'hunt');
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
    finish: () => game?.finish('The Hunter Falls'),
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
      (s) => Math.hypot(s.x - game!.player.x, s.y - game!.player.y) < 110,
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
function tick(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  view.fps += (1 / Math.max(0.001, dt) - view.fps) * 0.04;
  const g = game ?? menuBackdrop;
  if (game && app.shell.session.phase === 'playing') {
    if (uiScreen === 'gameplay-placeholder') {
      const input = controls.sample(view, g.player, g.enemies.items);
      if (scene === 'camp') {
        if (input.dodge) {
          const nearest = STATIONS.find(
            (s) => Math.hypot(s.x - g.player.x, s.y - g.player.y) < 110,
          );
          if (nearest) station(nearest.id);
        }
        g.player.aim = Math.atan2(input.ay - g.player.y, input.ax - g.player.x);
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
        if (g.outcome) endRun();
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
      el.classList.toggle('near', Math.hypot(s.x - game.player.x, s.y - game.player.y) < 110);
    }
    if (uiScreen === 'gameplay-placeholder')
      $('hint').textContent = controls.touching
        ? 'Drag on the left to walk · tap a station'
        : 'WASD to walk · F at a station';
    else $('hint').textContent = '';
  }
  if (game && scene !== 'camp') hud(g);
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
  for (const event of g.events) {
    if (event.id === 'number.crit' || event.id === 'number.deadeye') audio.playSfx('hit.crit');
    else if (!event.id.startsWith('number.')) audio.playSfx(event.id);
    if (event.id === 'level.up' && scene === 'hunt') surgeBanner(event.value);
    if (event.id === 'boss.intro' && scene === 'hunt') bossCard(event.value, 'intro');
    if (event.id === 'boss.fall' && scene === 'hunt') bossCard(event.value, 'fall');
  }
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
