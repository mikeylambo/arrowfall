import { BOWS } from '../data/bows';
import { UPGRADES } from '../data/upgrades';
import { EVOLUTIONS } from '../data/evolutions';
import { TOOLS } from '../data/tools';
import { ENEMIES } from '../data/enemies';
import type { Hunt } from '../sim/game';
import type { Profile, RunRecord } from '../sim/types';
import { BOONS, boonCost } from '../sim/profile';
import { BESTIARY } from '../data/bestiary';
export const fmt = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export function bowChoices(profile: Profile, selected: string) {
  return BOWS.map((b) => ({
    id: 'bow:' + b.id,
    label: (selected === b.id ? '◆ ' : '') + b.name,
    description: profile.unlocked.includes(b.id)
      ? `${Math.round(b.draw * 1000)} ms draw · ${Math.round(b.window * 1000)} ms perfect · ${b.near}–${b.far} px · ${b.signature}`
      : b.deed,
    disabled: !profile.unlocked.includes(b.id),
  }));
}
export function offerChoices(g: Hunt) {
  return g.offers.map((id, i) => {
    const evo = EVOLUTIONS.find((e) => 'evo:' + e.id === id),
      u = UPGRADES.find((u) => u.id === id),
      t = TOOLS.find((t) => t.id === id);
    return {
      id: 'pick:' + i,
      label: `${i + 1}. ${evo?.name ?? u?.name ?? t?.name ?? (id === 'heal' ? 'Moonberry' : 'Moonsilver')}`,
      description: evo
        ? 'LEGENDARY · ' + evo.effect
        : u
          ? `${u.rarity.toUpperCase()} · ${u.family} · ${g.rank(id) + 1}/${u.cap}\n${u.effect}`
          : t
            ? `TOOL · ${g.rank(id) + 1}/5 · ${t.effect}`
            : id === 'heal'
              ? 'Heal 30 HP'
              : '+15 Moonsilver',
    };
  });
}
export function altarChoices(p: Profile) {
  return BOONS.map(([name, cap, effect]) => {
    const rank = p.boons[name] || 0,
      cost = boonCost(rank);
    return {
      id: 'boon:' + name,
      label: `${name} · ${rank}/${cap}`,
      description: `${effect} · ${rank >= cap ? 'Complete' : cost + ' Moonsilver'}`,
      disabled: rank >= cap || p.currency < cost,
    };
  });
}
/** The Hunter's Log (GDD 12): bestiary, evolution codex, nightly bests, run history. */
export function logChoices(p: Profile) {
  const section = (id: string, label: string) => ({ id: 'section:' + id, label, disabled: true });
  const nightly = new Map<string, RunRecord>();
  for (const r of p.runs)
    if (r.nightly) {
      const best = nightly.get(r.nightly);
      if (!best || r.time > best.time || (r.time === best.time && r.kills > best.kills))
        nightly.set(r.nightly, r);
    }
  const name = (id: string) =>
    UPGRADES.find((u) => u.id === id)?.name ?? TOOLS.find((t) => t.id === id)?.name ?? id;
  return [
    section(
      'bestiary',
      `Bestiary · ${ENEMIES.filter((e) => p.seen.includes(e.id)).length}/${ENEMIES.length}`,
    ),
    ...ENEMIES.map((e) => {
      const seen = p.seen.includes(e.id),
        b = BESTIARY[e.id];
      return {
        id: 'beast:' + e.id,
        label: seen ? e.name : 'Unknown presence',
        description: seen
          ? `${b.behavior} Teaches: ${b.lesson} — ${e.hp} HP · ${e.speed} px/s · ${e.damage} damage. “${b.lore}”`
          : 'Not yet encountered',
        disabled: true,
      };
    }),
    section(
      'codex',
      `Evolutions · ${EVOLUTIONS.filter((e) => p.discovered.includes(e.id)).length}/${EVOLUTIONS.length}`,
    ),
    ...EVOLUTIONS.map((e) => ({
      id: 'entry:' + e.id,
      label: p.discovered.includes(e.id) ? e.name : 'Undiscovered evolution',
      description: p.discovered.includes(e.id)
        ? `${e.effect} — ${e.ingredients.map(name).join(' + ')}`
        : name(e.ingredients[0]) + ' + ???',
      disabled: true,
    })),
    section('nightly', 'Nightly Hunts · your best each night'),
    ...(nightly.size
      ? [...nightly.entries()].slice(0, 7).map(([date, r]) => ({
          id: 'nightly:' + date,
          label: `${date} · ${fmt(r.time)}`,
          description: `${r.outcome} · ${r.kills} hunted · ${Math.round((r.perfects / Math.max(1, r.shots)) * 100)}% perfect`,
          disabled: true,
        }))
      : [
          {
            id: 'nightly:none',
            label: 'No nightly hunts yet',
            description:
              'Turn on Nightly Hunt at the Trail: one seeded forest a day, the same for everyone.',
            disabled: true,
          },
        ]),
    section('runs', 'Recent hunts'),
    ...p.runs.slice(0, 10).map((r, i) => ({
      id: 'run:' + i,
      label: `${r.outcome} · ${fmt(r.time)}`,
      description: `${BOWS.find((b) => b.id === r.bow)?.name ?? r.bow} · ${r.kills} hunted · ${Math.round((r.perfects / Math.max(1, r.shots)) * 100)}% perfect · ${r.currency} Moonsilver${
        r.build?.length ? ' — ' + r.build.map(([id, rank]) => `${name(id)} ${rank}`).join(', ') : ''
      }${r.evolutions.length ? ' · ' + r.evolutions.map((id) => EVOLUTIONS.find((e) => e.id === id)?.name ?? id).join(', ') : ''}`,
      disabled: true,
    })),
  ];
}
export function fingerprint(record: RunRecord) {
  const values = record.fingerprint,
    max = Math.max(1, ...values),
    labels = ['Barrage', 'Marksman', 'Piercer', 'Flame', 'Storm', 'Phantom'];
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 500;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#090f1c';
  ctx.fillRect(0, 0, 600, 500);
  ctx.font = '26px Georgia';
  ctx.fillStyle = '#dbeaff';
  ctx.textAlign = 'center';
  ctx.fillText('ARROWFALL', 300, 45);
  ctx.font = '14px system-ui';
  ctx.fillStyle = '#a2b5cf';
  ctx.fillText(`${record.outcome} · ${fmt(record.time)} · ${record.kills} hunted`, 300, 76);
  const point = (i: number, r: number) => ({
    x: 300 + Math.cos((i * Math.PI) / 3 - Math.PI / 2) * r,
    y: 292 + Math.sin((i * Math.PI) / 3 - Math.PI / 2) * r,
  });
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const p = point(i, ring * 38);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = '#314056';
    ctx.stroke();
  }
  ctx.beginPath();
  values.forEach((v, i) => {
    const p = point(i, 30 + (v / max) * 122);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = '#b48aff33';
  ctx.fill();
  ctx.strokeStyle = '#c6b2ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Labels sit just outside the outer ring, clear of the title block above.
  ctx.textBaseline = 'middle';
  ctx.font = '600 13px system-ui';
  labels.forEach((label, i) => {
    const p = point(i, 176);
    ctx.fillStyle = '#dbeaff';
    ctx.fillText(label, p.x, p.y);
  });
  return c;
}
