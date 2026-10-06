import { BOWS } from '../data/bows';
import { UPGRADES } from '../data/upgrades';
import { EVOLUTIONS } from '../data/evolutions';
import { TOOLS } from '../data/tools';
import { ENEMIES } from '../data/enemies';
import type { Hunt } from '../sim/game';
import type { Profile, RunRecord } from '../sim/types';
import { BOONS, boonCost } from '../sim/profile';
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
export function logChoices(p: Profile) {
  return [
    ...ENEMIES.map((e) => ({
      id: 'entry:' + e.id,
      label: p.seen.includes(e.id) ? e.name : 'Unknown presence',
      description: p.seen.includes(e.id)
        ? `${e.hp} HP · ${e.speed} px/s · ${e.damage} damage`
        : 'Not yet encountered',
      disabled: true,
    })),
    ...EVOLUTIONS.map((e) => ({
      id: 'entry:' + e.id,
      label: p.discovered.includes(e.id) ? e.name : 'Undiscovered evolution',
      description: p.discovered.includes(e.id) ? e.effect : e.ingredients[0] + ' + ???',
      disabled: true,
    })),
    ...p.runs.slice(0, 8).map((r, i) => ({
      id: 'run:' + i,
      label: `${r.outcome} · ${fmt(r.time)}`,
      description: `${r.kills} kills · ${Math.round((r.perfects / Math.max(1, r.shots)) * 100)}% perfect · ${r.currency} Moonsilver`,
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
    y: 270 + Math.sin((i * Math.PI) / 3 - Math.PI / 2) * r,
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
  labels.forEach((label, i) => {
    const p = point(i, 190);
    ctx.fillStyle = '#dbeaff';
    ctx.fillText(label, p.x, p.y);
  });
  return c;
}
