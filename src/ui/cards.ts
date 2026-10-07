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
      <span class="card-icon">${icon(card.icon)}</span>
      <span class="slu-choice-label card-name">${escape(card.name)}</span>
      <span class="card-kind">${escape(card.kind)}</span>
      ${pips}
      <span class="slu-choice-desc card-effect">${progression(card)}</span>
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
) {
  const screen = root.querySelector<HTMLElement>('[data-screen-id="results"]');
  if (!screen) return;
  const header = screen.querySelector('.slu-header')!;
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
