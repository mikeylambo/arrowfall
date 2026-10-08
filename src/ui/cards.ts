/**
 * Rich presentation for the level-up cards and the results screen. The shell renders plain
 * buttons; these helpers rebuild their insides after it renders, keeping each button's
 * data-choice-id (and so its keyboard, pad and click handling) untouched.
 */
import type { Hunt } from '../sim/game';
import { UPGRADES } from '../data/upgrades';
import { EVOLUTIONS } from '../data/evolutions';
import { TOOLS } from '../data/tools';

type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export interface Card {
  name: string;
  rarity: Rarity;
  kind: string;
  /** Rank this card takes you to, and the cap (0 when the card has no ranks). */
  rank: number;
  cap: number;
  effect: string;
  icon: keyof typeof ICONS;
}

/** Single-weight line icons (24 px grid, currentColor), one per upgrade family. */
const ICONS = {
  Arrowcraft:
    '<path d="M4 20 18 6"/><path d="M14 5h5v5"/><path d="M4 20l1-4M4 20l4-1M7 17l-1-4M7 17l4-1"/>',
  Bowcraft:
    '<path d="M7 3c7 4 7 14 0 18"/><path d="M7 3v18"/><path d="M7 12h12"/><path d="m16 9 3 3-3 3"/>',
  Precision:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  Elemental: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-6 0 2 1 3 2 3 0-3 0-5 1-8Z"/>',
  Hunting:
    '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  Mobility: '<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14Z"/><path d="M5 19 13 11"/>',
  Evolution:
    '<path d="M16 4a8 8 0 1 0 4 12 7 7 0 0 1-4-12Z"/><path d="m9 9 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z"/>',
  Tool: '<path d="M9 4h6M10 4v2M14 4v2"/><rect x="7" y="6" width="10" height="13" rx="2"/><path d="M12 10v5M10 12h4"/>',
  Heal: '<circle cx="9" cy="14" r="4"/><circle cx="15.5" cy="12.5" r="3.5"/><path d="M12 9c0-3 2-5 5-6"/>',
  Silver: '<circle cx="12" cy="12" r="8"/><path d="M14 8a4 4 0 1 0 0 8 5 5 0 0 1 0-8Z"/>',
};

export function cardFor(g: Hunt, id: string): Card {
  const evo = EVOLUTIONS.find((e) => 'evo:' + e.id === id);
  if (evo)
    return {
      name: evo.name,
      rarity: 'legendary',
      kind: 'Evolution',
      rank: 0,
      cap: 0,
      effect: evo.effect,
      icon: 'Evolution',
    };
  const u = UPGRADES.find((u) => u.id === id);
  if (u)
    return {
      name: u.name,
      rarity: u.rarity.toLowerCase() as Rarity,
      kind: u.family,
      rank: g.rank(id) + 1,
      cap: u.cap,
      effect: u.effect,
      icon: u.family as keyof typeof ICONS,
    };
  const t = TOOLS.find((t) => t.id === id);
  if (t)
    return {
      name: t.name,
      rarity: 'uncommon',
      kind: 'Tool',
      rank: g.rank(id) + 1,
      cap: 5,
      effect: t.effect,
      icon: 'Tool',
    };
  return id === 'heal'
    ? {
        name: 'Moonberry',
        rarity: 'common',
        kind: 'Provision',
        rank: 0,
        cap: 0,
        effect: 'Heal 30 HP',
        icon: 'Heal',
      }
    : {
        name: 'Moonsilver',
        rarity: 'common',
        kind: 'Provision',
        rank: 0,
        cap: 0,
        effect: '+15 Moonsilver',
        icon: 'Silver',
      };
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/**
 * Effect text with its progression: per-rank numbers ("+8% draw speed") show the total you
 * have now and the total this card takes you to ("+8% → +16% draw speed").
 */
function progression(card: Card) {
  const text = escape(card.effect);
  if (card.rank <= 1 || !/^(\+|Sweet-spot)/.test(card.effect)) return text;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return text.replace(
    /([+\u2212]?)(\d+(?:\.\d+)?)(%?)/g,
    (_, sign: string, n: string, pct: string) => {
      const v = Number(n);
      return `<span class="was">${sign}${fmt(v * (card.rank - 1))}${pct}</span> → <b>${sign}${fmt(v * card.rank)}${pct}</b>`;
    },
  );
}
/**
 * Evolution path for an upgrade card: the evolution it feeds that you are closest to, with
 * each ingredient ticked when owned (this card counts as owned).
 */
function evolutionHint(g: Hunt, id: string) {
  const paths = EVOLUTIONS.filter((e) => e.ingredients.includes(id) && !g.evolutions.has(e.id));
  if (!paths.length) return '';
  const have = (i: string) => i === id || g.rank(i) > 0,
    best = paths.sort(
      (a, b) =>
        b.ingredients.filter(have).length / b.ingredients.length -
        a.ingredients.filter(have).length / a.ingredients.length,
    )[0];
  const name = (i: string) => UPGRADES.find((u) => u.id === i)?.name ?? i.replace(/-/g, ' ');
  const ready = best.ingredients.every(have);
  return `<span class="card-evo${ready ? ' ready' : ''}"><b>${ready ? 'Unlocks' : 'Toward'} ${escape(best.name)}</b>${best.ingredients
    .map((i) => `<i class="${have(i) ? 'on' : ''}">${escape(name(i))}</i>`)
    .join('')}</span>`;
}
/**
 * Painted icons (GPT batch 4, public/art/gpt/icons.*): one per upgrade, tool, evolution and boon,
 * keyed by id. Ids without a painted icon keep their family's line icon.
 */
let paintedIcons: Record<string, [number, number, number, number]> = {},
  atlas = [1, 1];
void fetch('/art/gpt/icons.json')
  .then((r) => r.json())
  .then((m: { size: [number, number]; frames: typeof paintedIcons }) => {
    paintedIcons = m.frames;
    atlas = m.size;
  })
  .catch(() => {});
export function paintedIcon(id: string, fallback = '') {
  const f = paintedIcons[id.replace(/^evo:/, '')];
  if (!f) return fallback;
  const [x, y, w, h] = f,
    [aw, ah] = atlas;
  return `<i class="gicon" style="background-size:${(aw / w) * 100}% ${(ah / h) * 100}%;background-position:${(x / (aw - w)) * 100}% ${(y / (ah - h)) * 100}%"></i>`;
}
const icon = (name: keyof typeof ICONS) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/** Rebuild the level-up screen's pick buttons as cards, and the extras as a small action row. */
export function decorateLevelUp(root: HTMLElement, g: Hunt, reducedMotion: boolean) {
  const screen = root.querySelector<HTMLElement>('[data-screen-id="levelup"]');
  if (!screen) return;
  screen.classList.toggle('calm', reducedMotion);
  const choices = screen.querySelector('.slu-choices')!;
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  screen.querySelectorAll<HTMLButtonElement>('.slu-choice').forEach((button, i) => {
    const id = button.dataset.choiceId ?? '';
    if (!id.startsWith('pick:')) {
      actions.append(button);
      return;
    }
    const card = cardFor(g, g.offers[Number(id.slice(5))]);
    button.dataset.rarity = card.rarity;
    button.style.setProperty('--deal', String(i));
    const pips =
      card.cap > 0
        ? `<span class="card-pips" aria-label="Rank ${card.rank} of ${card.cap}">${Array.from(
            { length: card.cap },
            (_, k) =>
              `<i class="${k < card.rank - 1 ? 'had' : k === card.rank - 1 ? 'next' : ''}"></i>`,
          ).join('')}</span>`
        : '';
    const ribbon =
      card.rarity === 'legendary' ? 'Evolution' : card.rank === 1 && card.cap > 0 ? 'New' : '';
    button.innerHTML = `
      <span class="card-top"><kbd>${Number(id.slice(5)) + 1}</kbd>${ribbon ? `<span class="card-ribbon">${ribbon}</span>` : ''}</span>
      <span class="card-icon">${paintedIcon(g.offers[Number(id.slice(5))], icon(card.icon))}</span>
      <span class="slu-choice-label card-name">${escape(card.name)}</span>
      <span class="card-kind">${escape(card.kind)}</span>
      ${pips}
      <span class="slu-choice-desc card-effect">${progression(card)}</span>
      ${evolutionHint(g, g.offers[Number(id.slice(5))])}
      <span class="card-rarity">${card.rarity}</span>`;
  });
  if (actions.children.length) choices.after(actions);
  // The build so far, as quiet chips under the cards.
  const owned = Object.entries(g.ranks).filter(([, r]) => r > 0);
  if (owned.length) {
    const build = document.createElement('div');
    build.className = 'card-build';
    build.innerHTML = owned
      .map(([id, r]) => {
        const name =
          UPGRADES.find((u) => u.id === id)?.name ??
          TOOLS.find((t) => t.id === id)?.name ??
          id.replace(/-/g, ' ');
        return `<span>${escape(name)} <b>${r}</b></span>`;
      })
      .join('');
    (actions.children.length ? actions : choices).after(build);
  }
}

/** Results: stat tiles, evolution chips and the fingerprint beside them. */
export function decorateResults(
  root: HTMLElement,
  stats: { label: string; value: string }[],
  evolutions: string[],
  fingerprint: HTMLCanvasElement,
  recap?: Recap,
  unlocks: string[] = [],
) {
  const screen = root.querySelector<HTMLElement>('[data-screen-id="results"]');
  if (!screen) return;
  const header = screen.querySelector('.slu-header')!;
  if (unlocks.length) {
    const strip = document.createElement('div');
    strip.className = 'results-unlocks';
    strip.innerHTML = unlocks.map((u) => `<span>${escape(u)}</span>`).join('');
    header.after(strip);
  }
  if (recap) header.after(recapPanel(recap));
  header.querySelector('p')?.remove();
  const body = document.createElement('div');
  body.className = 'results-body';
  body.innerHTML = `
    <div class="results-stats">
      ${stats.map((s) => `<div class="stat"><b>${escape(s.value)}</b><span>${escape(s.label)}</span></div>`).join('')}
      <div class="results-evos">${
        evolutions.length
          ? evolutions.map((e) => `<span>${escape(e)}</span>`).join('')
          : '<em>No evolutions this hunt</em>'
      }</div>
    </div>`;
  fingerprint.className = 'fingerprint';
  body.append(fingerprint);
  header.after(body);
}

export interface Recap {
  killedBy: string;
  time: number;
  hits: { time: number; source: string; amount: number; hp: number }[];
  sources: [string, number][];
  tip: string;
  /** "You were 0:17 from The Black Shuck", "New personal best", ... */
  nudge: string;
}
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/** Death recap: the fatal blow, the last hits, who hurt most, one tip and a reason to go again. */
function recapPanel(r: Recap) {
  const el = document.createElement('div');
  el.className = 'recap';
  const top = Math.max(1, ...r.sources.map(([, d]) => d));
  el.innerHTML = `
    <p class="recap-killer">Slain by <b>${escape(r.killedBy)}</b> at ${clock(r.time)}</p>
    <div class="recap-grid">
      <div>
        <h3>Final blows</h3>
        <ol class="recap-hits">${r.hits
          .slice(-4)
          .map(
            (h) =>
              `<li><time>${clock(h.time)}</time><span>${escape(h.source)}</span><b>−${Math.round(h.amount)}</b><i style="width:${Math.max(2, h.hp)}%"></i></li>`,
          )
          .join('')}</ol>
      </div>
      <div>
        <h3>Hurt most by</h3>
        <ul class="recap-sources">${r.sources
          .slice(0, 3)
          .map(
            ([name, d]) =>
              `<li><span>${escape(name)}</span><b>${Math.round(d)}</b><i style="width:${(d / top) * 100}%"></i></li>`,
          )
          .join('')}</ul>
      </div>
    </div>
    <p class="recap-tip"><b>Hunter's note</b> ${escape(r.tip)}</p>
    <p class="recap-nudge">${escape(r.nudge)}</p>`;
  return el;
}

/** Pause: the run's build at a glance (bow, upgrades with ranks, evolutions owned and near). */
export function buildPanel(g: Hunt) {
  const el = document.createElement('div');
  el.className = 'build-panel';
  const owned = Object.entries(g.ranks).filter(([, r]) => r > 0);
  const near = EVOLUTIONS.filter(
    (e) => !g.evolutions.has(e.id) && e.ingredients.some((i) => g.rank(i) > 0),
  )
    .map((e) => ({ e, have: e.ingredients.filter((i) => g.rank(i) > 0).length }))
    .sort((a, b) => b.have / b.e.ingredients.length - a.have / a.e.ingredients.length)
    .slice(0, 4);
  const name = (id: string) =>
    UPGRADES.find((u) => u.id === id)?.name ?? TOOLS.find((t) => t.id === id)?.name ?? id;
  const cap = (id: string) => UPGRADES.find((u) => u.id === id)?.cap ?? 5;
  el.innerHTML = `
    <h3>${escape(g.bow.name)} <small>${escape(g.bow.signature)}</small></h3>
    <div class="build-upgrades">${
      owned.length
        ? owned
            .map(([id, r]) => {
              const u = UPGRADES.find((x) => x.id === id);
              return `<span class="build-chip" data-rarity="${(u?.rarity ?? 'Uncommon').toLowerCase()}">${paintedIcon(id, icon((u?.family ?? 'Tool') as keyof typeof ICONS))}<b>${escape(name(id))}</b><i>${r}/${cap(id)}</i></span>`;
            })
            .join('')
        : '<em>No upgrades yet</em>'
    }</div>
    ${
      g.evolutions.size
        ? `<h4>Evolutions</h4><div class="build-evos">${[...g.evolutions]
            .map(
              (id) =>
                `<span>${paintedIcon(id)}${escape(EVOLUTIONS.find((e) => e.id === id)?.name ?? id)}</span>`,
            )
            .join('')}</div>`
        : ''
    }
    ${
      near.length
        ? `<h4>Within reach</h4><ul class="build-near">${near
            .map(
              ({ e }) =>
                `<li><b>${escape(e.name)}</b>${e.ingredients
                  .map((i) => `<i class="${g.rank(i) > 0 ? 'on' : ''}">${escape(name(i))}</i>`)
                  .join('')}</li>`,
            )
            .join('')}</ul>`
        : ''
    }`;
  return el;
}
