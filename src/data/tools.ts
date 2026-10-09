/**
 * Tools: up to 5 ranks each. Per-rank numbers live here, read by both the simulation and the
 * level-up cards, so what a card promises is exactly what the tool does.
 */
export const TOOL_STATS = {
  moonraven: (rank: number) => ({
    damage: 30 * (1 + 0.15 * (rank - 1)),
    every: 2.5 - 0.3 * (rank - 1),
  }),
  thornsnare: (rank: number) => ({ traps: rank, every: 5 - 0.5 * (rank - 1) }),
  lantern: (rank: number) => ({ radius: 140 + 20 * (rank - 1), dps: 6 + 3 * (rank - 1) }),
};
export type ToolId = keyof typeof TOOL_STATS;
export const TOOLS: { id: ToolId; name: string; effect: string }[] = [
  { id: 'moonraven', name: 'Moonraven', effect: 'A familiar dives for 30 damage every 2.5 s' },
  { id: 'thornsnare', name: 'Thornsnare', effect: 'Lay traps: root for 2 s and deal 20 damage' },
  { id: 'lantern', name: 'Hunter’s Lantern', effect: 'Silver aura damages nearby threats' },
];
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
/**
 * A tool card's effect at `rank` (the rank the card grants), with what it was before:
 * returns text parts where [was, now] pairs mark the numbers that change.
 */
export function toolEffect(id: ToolId, rank: number): (string | [string, string])[] {
  const now = TOOL_STATS[id](rank) as Record<string, number>,
    was = rank > 1 ? (TOOL_STATS[id](rank - 1) as Record<string, number>) : null,
    v = (key: string, unit = ''): string | [string, string] =>
      was && was[key] !== now[key] ? [n(was[key]) + unit, n(now[key]) + unit] : n(now[key]) + unit;
  if (id === 'moonraven')
    return [
      'A familiar dives for ',
      v('damage'),
      ' damage every ',
      v('every', ' s'),
      ...(rank === 5 ? ['; it also gathers Moonlight around you'] : []),
    ];
  if (id === 'thornsnare')
    return [
      'Lays a trap every ',
      v('every', ' s'),
      ', up to ',
      v('traps'),
      ' at once: roots for 2 s and deals 20 damage',
    ];
  return ['Silver aura deals ', v('dps'), ' damage per second within ', v('radius'), ' px'];
}
/** Plain-text form ("30 → 34.5"), for menus and screen readers. */
export function toolEffectText(id: ToolId, rank: number) {
  return toolEffect(id, rank)
    .map((p) => (typeof p === 'string' ? p : `${p[0]} → ${p[1]}`))
    .join('');
}
