/**
 * Curses: optional modifiers chosen at the Trail, stacked on top of the Moon Phase. Each
 * active curse adds +20% Moonsilver to the hunt's payout. Unlocked after the third hunt.
 */
export const CURSES = [
  { id: 'haste', name: 'Curse of Haste', effect: 'Every enemy moves 20% faster' },
  { id: 'glass', name: 'Curse of Glass', effect: 'You take 50% more damage' },
  { id: 'pack', name: 'Curse of the Pack', effect: 'Moonhound packs run two larger' },
  { id: 'famine', name: 'Curse of Famine', effect: 'No Moonberries; shrines do not heal' },
  { id: 'champions', name: 'Curse of Champions', effect: 'Elites appear twice as often' },
];
export const CURSE_BONUS = 0.2;
export const CURSES_UNLOCK_RUNS = 3;
