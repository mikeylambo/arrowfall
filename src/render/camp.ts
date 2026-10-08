/**
 * The Hunter's Camp: one prop per station (so each reads at a glance without its label), a
 * campfire at the heart of the clearing, and tents at the edge. Baked once to canvas textures
 * in the landmark style: dark body, rim light, ink outline, soft ground shadow.
 */
import { CanvasSource, Container, Sprite, Texture } from 'pixi.js';
import { STATIONS } from '../data/world';
import { BOONS } from '../sim/profile';
import type { Profile } from '../sim/types';

type Ctx = CanvasRenderingContext2D;
const INK = '#050912',
  BODY = '#14233a',
  WOOD = '#2a2230',
  WOOD_RIM = '#5e5068',
  RIM = '#4a6384',
  MOON = '#c4d4ff',
  FOCUS = '#aba4ff',
  EMBER = '#ffb36b';

function canvas(w: number, h: number, draw: (c: Ctx) => void, resolution = 1) {
  const el = document.createElement('canvas');
  el.width = w * resolution;
  el.height = h * resolution;
  const c = el.getContext('2d')!;
  c.scale(resolution, resolution);
  c.translate(w / 2, h / 2);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  return new Texture({ source: new CanvasSource({ resource: el, resolution }) });
}
function shadow(c: Ctx, w: number, h: number, dy = 0) {
  c.save();
  c.fillStyle = 'rgba(2,4,9,0.55)';
  c.filter = 'blur(6px)';
  c.beginPath();
  c.ellipse(6, dy, w, h, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}
/** Inked shape: path from `trace`, filled, outlined in ink, then rim-lit. */
function ink(c: Ctx, trace: () => void, fill: string, rim = RIM, width = 2) {
  c.beginPath();
  trace();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = width + 2.5;
  c.stroke();
  c.strokeStyle = rim;
  c.lineWidth = width;
  c.stroke();
}
function line(c: Ctx, pts: number[], color: string, width: number) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.strokeStyle = INK;
  c.lineWidth = width + 2.5;
  c.stroke();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function rect(c: Ctx, x: number, y: number, w: number, h: number) {
  return () => c.rect(x, y, w, h);
}

/** A bow standing on its rack, centred at (x, y), in its own finish. */
function bow(c: Ctx, x: number, y: number, id: string) {
  c.beginPath();
  c.arc(x, y, 30, -1.1, 1.1);
  c.strokeStyle = INK;
  c.lineWidth = 5;
  c.stroke();
  c.strokeStyle = BOW_FINISH[id] ?? '#8fa6c4';
  c.lineWidth = 2.5;
  c.stroke();
  line(
    c,
    [
      x + Math.cos(-1.1) * 30,
      y + Math.sin(-1.1) * 30,
      x + Math.cos(1.1) * 30,
      y + Math.sin(1.1) * 30,
    ],
    '#dfe8f5',
    0.8,
  );
}
/** A trophy hung at (x, y): the first hunt's husk mask, or a felled boss's keepsake. */
function trophy(c: Ctx, id: string, x: number, y: number) {
  c.save();
  c.translate(x, y);
  if (id === 'husk') {
    // A red-eyed husk mask.
    ink(c, () => c.ellipse(0, 0, 7, 8, 0, 0, Math.PI * 2), '#3a1820', '#7a2434', 1.2);
    c.fillStyle = '#ff5a6e';
    c.fillRect(-3, -2, 2.2, 2.2);
    c.fillRect(2, -2, 2.2, 2.2);
  } else if (id === 'shuck') {
    // The Black Shuck: a great black skull with green-lit sockets.
    ink(c, () => c.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2), '#151820', '#4a5468', 1.4);
    ink(c, () => c.ellipse(-10, 4, 6, 4, 0, 0, Math.PI * 2), '#151820', '#4a5468', 1);
    c.fillStyle = '#8ff0e0';
    c.fillRect(-4, -3, 3, 3);
    c.fillRect(3, -3, 3, 3);
  } else if (id === 'bramble') {
    // The Bramble King: his thorn crown.
    ink(c, rect(c, -11, 3, 22, 6), '#2a1418', '#7a3a34', 1.2);
    for (let i = 0; i < 4; i++) line(c, [-9 + i * 6, 3, -8 + i * 6, -9], '#d2403c', 1.6);
  } else if (id === 'hag') {
    // The Night Hag: her lantern, still lit.
    line(c, [0, -8, 0, 0], '#5a5068', 1.2);
    ink(c, rect(c, -6, 0, 12, 14), '#2a2440', '#8a6cff', 1.2);
    c.fillStyle = '#d6c8ff';
    c.fillRect(-3, 3, 6, 8);
  } else if (id === 'huntmaster')
    // The Huntmaster: his antler crown.
    for (const side of [-1, 1]) {
      line(c, [0, 0, side * 18, -14, side * 30, -22, side * 38, -18], '#e9dfbf', 2.5);
      line(c, [side * 18, -14, side * 16, -26], '#e9dfbf', 2);
      line(c, [side * 30, -22, side * 34, -30], '#e9dfbf', 2);
    }
  c.restore();
}
/** The Altar's twelve stars over its bowl at (0, -58): each brightens with its boon's rank. */
function stars(c: Ctx, p?: Profile) {
  const lit: number[][] = [];
  ALTAR_STARS.forEach(([x, y], i) => {
    const [, cap] = BOONS[i],
      rank = p?.boons[BOONS[i][0]] ?? 0,
      k = rank / cap;
    if (rank) lit.push([x, y]);
    c.fillStyle = rank ? FOCUS : 'rgba(120,130,170,0.35)';
    c.beginPath();
    c.arc(x, y, rank ? 2.4 + k * 2.2 : 1.6, 0, Math.PI * 2);
    c.fill();
    if (rank) {
      c.fillStyle = `rgba(171,164,255,${0.1 + k * 0.15})`;
      c.beginPath();
      c.arc(x, y, 4 + k * 3, 0, Math.PI * 2);
      c.fill();
    }
  });
  if (lit.length > 1) line(c, lit.flat(), 'rgba(171,164,255,0.45)', 1);
}
/** A stack of filled pages that grows with every hunt written in the log. */
function pages(c: Ctx, x: number, y: number, runs: number) {
  const n = Math.min(12, Math.ceil(runs / 2));
  for (let i = 0; i < n; i++) ink(c, rect(c, x, y - i * 3.2, 22, 3), '#d9d2bf', '#f5efe0', 0.6);
}

/** Camp prop textures, keyed by station id plus fire, flame and tent. Anchor: feet at (0.5, 0.8). */
export function campArt(p?: Profile): Record<string, Texture> {
  const bows = p?.unlocked ?? ['recurve'],
    bosses = p?.bosses ?? [],
    runs = p?.runs.length ?? 0,
    moon = p?.phase ?? 0;
  return {
    // The Trail: a signpost pointing out of camp into the moor.
    trail: canvas(140, 150, (c) => {
      c.translate(0, 30);
      shadow(c, 34, 9, 20);
      line(c, [0, 22, 0, -78], WOOD_RIM, 6);
      ink(
        c,
        () => {
          c.moveTo(-8, -72);
          c.lineTo(40, -72);
          c.lineTo(52, -62);
          c.lineTo(40, -52);
          c.lineTo(-8, -52);
          c.closePath();
        },
        WOOD,
        WOOD_RIM,
      );
      ink(
        c,
        () => {
          c.moveTo(8, -46);
          c.lineTo(-38, -46);
          c.lineTo(-48, -37);
          c.lineTo(-38, -28);
          c.lineTo(8, -28);
          c.closePath();
        },
        WOOD,
        WOOD_RIM,
      );
      // A pennant on the post for each Moon Phase opened: silver, gold, red.
      ['#c4d4ff', '#e8c66a', '#d2403c'].slice(0, moon).forEach((color, i) => {
        ink(
          c,
          () => {
            c.moveTo(-3, -18 + i * 12 - 30);
            c.lineTo(-24, -12 + i * 12 - 30);
            c.lineTo(-3, -8 + i * 12 - 30);
            c.closePath();
          },
          color,
          INK,
          0.8,
        );
      });
      // A moon carved in the upper sign.
      c.fillStyle = MOON;
      c.beginPath();
      c.arc(20, -62, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = WOOD;
      c.beginPath();
      c.arc(23, -64, 5, 0, Math.PI * 2);
      c.fill();
    }),
    // The Fletcher: a workbench with a rack of bows and a quiver.
    fletcher: canvas(170, 150, (c) => {
      c.translate(0, 30);
      shadow(c, 62, 12, 18);
      line(c, [-48, 20, -48, -8], WOOD_RIM, 4);
      line(c, [48, 20, 48, -8], WOOD_RIM, 4);
      ink(c, rect(c, -58, -16, 116, 12), WOOD, WOOD_RIM);
      // Bow rack behind the bench.
      line(c, [-40, -16, -40, -82], WOOD_RIM, 3);
      line(c, [40, -16, 40, -82], WOOD_RIM, 3);
      line(c, [-44, -76, 44, -76], WOOD_RIM, 3);
      // One bow on the rack per bow unlocked, in that bow's own finish.
      const spacing = bows.length > 3 ? 13 : 22;
      bows.slice(0, 6).forEach((id, i) => {
        const x = (i - (Math.min(6, bows.length) - 1) / 2) * spacing + 12;
        bow(c, x - 12, -46, id);
      });
      // Arrows and a feather on the bench.
      line(c, [-30, -22, 18, -26], '#9fb3cc', 1.5);
      line(c, [-26, -20, 26, -22], '#9fb3cc', 1.5);
      c.fillStyle = FOCUS;
      c.beginPath();
      c.ellipse(34, -22, 8, 3, -0.3, 0, Math.PI * 2);
      c.fill();
    }),
    // The Range: a straw target on a stand.
    range: canvas(140, 160, (c) => {
      c.translate(0, 36);
      shadow(c, 38, 10, 18);
      line(c, [-22, 22, 0, -40], WOOD_RIM, 4);
      line(c, [22, 22, 0, -40], WOOD_RIM, 4);
      line(c, [0, 22, 0, -50], WOOD_RIM, 3);
      const rings = ['#d8cba4', '#7a2434', '#d8cba4', '#7a2434', MOON];
      ink(c, () => c.ellipse(0, -62, 36, 38, 0, 0, Math.PI * 2), rings[0], '#e9dfbf');
      rings.slice(1).forEach((color, i) => {
        c.fillStyle = color;
        c.beginPath();
        c.ellipse(0, -62, 28 - i * 7, 30 - i * 7.4, 0, 0, Math.PI * 2);
        c.fill();
      });
      // Two arrows stuck in the target.
      line(c, [6, -66, 30, -84], '#9fb3cc', 1.6);
      line(c, [-10, -54, -32, -66], '#9fb3cc', 1.6);
    }),
    // Silver Altar: a stone plinth under a small constellation.
    altar: canvas(170, 190, (c) => {
      c.translate(0, 40);
      shadow(c, 46, 12, 16);
      ink(c, rect(c, -42, 0, 84, 16), BODY, RIM);
      ink(c, rect(c, -28, -44, 56, 46), BODY, RIM);
      ink(c, rect(c, -36, -54, 72, 12), BODY, RIM);
      // A silver bowl of moonlight.
      ink(c, () => c.ellipse(0, -58, 20, 7, 0, 0, Math.PI * 2), '#c9d6ea', MOON);
      stars(c, p);
    }),
    // Trophy Wall: a timber frame hung with antlers and a hound skull.
    trophies: canvas(170, 190, (c) => {
      c.translate(0, 14);
      c.translate(0, 34);
      shadow(c, 60, 11, 18);
      line(c, [-56, 20, -56, -86], WOOD_RIM, 5);
      line(c, [56, 20, 56, -86], WOOD_RIM, 5);
      ink(c, rect(c, -60, -90, 120, 10), WOOD, WOOD_RIM);
      ink(c, rect(c, -50, -78, 100, 62), '#1a1726', WOOD_RIM, 1.5);
      // A red-eyed husk mask hangs from the first hunt; each boss felled adds its trophy.
      trophy(c, 'husk', -36, -30);
      // Empty hooks wait for the rest.
      c.fillStyle = WOOD_RIM;
      for (const [x, y] of [
        [-14, -62],
        [14, -62],
        [0, -40],
        [30, -34],
      ])
        c.fillRect(x - 1.5, y - 14, 3, 4);
      if (bosses.includes('shuck')) trophy(c, 'shuck', -14, -56);
      if (bosses.includes('bramble')) trophy(c, 'bramble', 15, -57);
      if (bosses.includes('hag')) trophy(c, 'hag', 0, -46);
      if (bosses.includes('huntmaster')) trophy(c, 'huntmaster', 0, -84);
    }),
    // Hunter's Log: a lectern with an open book and a candle.
    log: canvas(150, 150, (c) => {
      c.translate(0, 32);
      shadow(c, 30, 9, 18);
      line(c, [0, 20, 0, -30], WOOD_RIM, 6);
      line(c, [-16, 22, 16, 22], WOOD_RIM, 5);
      ink(
        c,
        () => {
          c.moveTo(-34, -30);
          c.lineTo(34, -30);
          c.lineTo(28, -44);
          c.lineTo(-28, -44);
          c.closePath();
        },
        WOOD,
        WOOD_RIM,
      );
      ink(
        c,
        () => {
          c.moveTo(-28, -42);
          c.quadraticCurveTo(-14, -52, 0, -44);
          c.quadraticCurveTo(14, -52, 28, -42);
          c.lineTo(26, -36);
          c.lineTo(-26, -36);
          c.closePath();
        },
        '#e3dcc8',
        '#f5efe0',
        1.2,
      );
      line(c, [-20, -41, -6, -42], '#8a8070', 0.8);
      line(c, [6, -42, 20, -41], '#8a8070', 0.8);
      // A stack of filled pages beside the book grows with every hunt written in it.
      pages(c, -46, 18, runs);
      // Candle.
      ink(c, rect(c, 34, -58, 6, 16), '#d9d2bf', '#f5efe0', 1);
      c.fillStyle = EMBER;
      c.beginPath();
      c.ellipse(37, -63, 2.5, 5, 0, 0, Math.PI * 2);
      c.fill();
    }),
    // Campfire base: a ring of stones around crossed logs and embers.
    fire: canvas(150, 110, (c) => {
      shadow(c, 54, 18, 6);
      c.fillStyle = 'rgba(255,140,70,0.18)';
      c.beginPath();
      c.ellipse(0, 0, 40, 16, 0, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        ink(
          c,
          () => c.ellipse(Math.cos(a) * 42, Math.sin(a) * 18, 9, 6, a, 0, Math.PI * 2),
          BODY,
          RIM,
          1.5,
        );
      }
      line(c, [-24, 8, 22, -8], WOOD_RIM, 7);
      line(c, [-22, -8, 24, 8], WOOD_RIM, 7);
      c.fillStyle = EMBER;
      for (const [x, y] of [
        [-6, 2],
        [8, -2],
        [2, 6],
        [-12, -4],
      ]) {
        c.beginPath();
        c.arc(x, y, 2.2, 0, Math.PI * 2);
        c.fill();
      }
    }),
    // Flame: drawn white-hot to amber; the renderer flickers its scale and tint.
    flame: canvas(60, 90, (c) => {
      c.translate(0, 30);
      const grad = c.createLinearGradient(0, 0, 0, -70);
      grad.addColorStop(0, '#ffefc8');
      grad.addColorStop(0.45, EMBER);
      grad.addColorStop(1, 'rgba(255,90,60,0)');
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(-18, 0);
      c.quadraticCurveTo(-22, -30, -4, -64);
      c.quadraticCurveTo(0, -40, 6, -50);
      c.quadraticCurveTo(22, -26, 18, 0);
      c.closePath();
      c.fill();
    }),
    // A hunter's tent at the camp's edge.
    tent: canvas(160, 130, (c) => {
      c.translate(0, 26);
      shadow(c, 62, 14, 18);
      ink(
        c,
        () => {
          c.moveTo(-62, 20);
          c.lineTo(0, -72);
          c.lineTo(62, 20);
          c.closePath();
        },
        '#1b2a40',
        '#5a7397',
      );
      ink(
        c,
        () => {
          c.moveTo(-16, 20);
          c.lineTo(0, -40);
          c.lineTo(16, 20);
          c.closePath();
        },
        '#070c16',
        '#2c3d55',
        1.2,
      );
      line(c, [0, -72, -8, -88], WOOD_RIM, 2.5);
      line(c, [0, -72, 8, -88], WOOD_RIM, 2.5);
    }),
  };
}

/** Where the camp's non-station props stand (camp space; the clearing spans ~100..1050). */
const TENTS = [
  { x: 150, y: 780, flip: false },
  { x: 1000, y: 760, flip: true },
  { x: 1060, y: 120, flip: true },
];
/** Each bow's finish on the Fletcher's rack. */
const BOW_FINISH: Record<string, string> = {
  recurve: '#8fa6c4',
  sparrow: '#9fd0b0',
  nightreach: '#6a7fd8',
  letoff: '#d8cba4',
  oathbreaker: '#c4504c',
  moonbow: MOON,
};
/** The Altar's twelve stars (one per boon, in BOONS order), laid out as a loose crown. */
const ALTAR_STARS = [
  [-52, -98],
  [-40, -116],
  [-22, -128],
  [0, -134],
  [22, -128],
  [40, -116],
  [52, -98],
  [-26, -104],
  [0, -112],
  [26, -104],
  [-12, -90],
  [12, -90],
];
export const CAMPFIRE = { x: 600, y: 400 };

/** Painted prop per station (GPT batch 7), its on-screen width, and its foot (0..1 down). */
const PAINTED_STATION: Record<string, string> = {
  trail: 'signpost',
  fletcher: 'fletcher',
  range: 'target',
  altar: 'altar',
  trophies: 'trophies',
  log: 'log',
};
const PAINTED_WIDTH: Record<string, number> = {
  trail: 104,
  fletcher: 172,
  range: 100,
  altar: 140,
  trophies: 150,
  log: 108,
};
/** Where the Trophy Wall's keepsakes hang, as fractions of the painted wall. */
const TROPHY_HOOKS: Record<string, [number, number]> = {
  husk: [0.27, 0.35],
  shuck: [0.48, 0.37],
  bramble: [0.67, 0.33],
  hag: [0.4, 0.53],
  huntmaster: [0.5, 0.15],
};
/**
 * A painted station: the prop itself, then what the hunter has earned drawn on top (bows on
 * the Fletcher's pegs, keepsakes on the Trophy Wall, the Altar's stars, the Log's pages, a hunt
 * banner by the Trail for each Moon Phase opened).
 */
function paintedStation(
  layer: Container,
  station: (typeof STATIONS)[number],
  tex: Texture,
  stations: Record<string, Texture>,
  profile: Profile,
) {
  const k = PAINTED_WIDTH[station.id] / tex.width,
    x0 = station.x,
    y0 = station.y + 14,
    foot = 0.95,
    // A point on the painted prop, from fractions of its width and height, in camp space.
    at = (fx: number, fy: number) => [
      x0 + (fx - 0.5) * tex.width * k,
      y0 + (fy - foot) * tex.height * k,
    ],
    add = (t: Texture, x: number, y: number, ax = 0.5, ay = 0.5) => {
      const s = new Sprite(t);
      s.anchor.set(ax, ay);
      s.position.set(x, y);
      layer.addChild(s);
      extras.push(t);
      return s;
    },
    overlay = (w: number, h: number, draw: (c: Ctx) => void) => canvas(w, h, draw, 2);
  if (station.id === 'trail') {
    // One banner per Moon Phase opened: silver, gold, blood red; planted behind the signpost.
    const banner = stations.banner;
    if (banner)
      [0xc4d4ff, 0xe8c66a, 0xd2403c].slice(0, profile.phase).forEach((color, i) => {
        const b = new Sprite(banner),
          kb = 112 / banner.height;
        b.anchor.set(0.5, foot);
        b.position.set(x0 + 30 + i * 26, y0 - 10 - i * 6);
        b.scale.set(i % 2 ? -kb : kb, kb);
        b.tint = color;
        layer.addChild(b);
      });
  }
  const prop = new Sprite(tex);
  prop.anchor.set(0.5, foot);
  prop.position.set(x0, y0);
  prop.scale.set(k);
  layer.addChild(prop);
  if (station.id === 'fletcher') {
    // Six pegs along the sloping rack rail; each unlocked bow hangs from one.
    const bows = profile.unlocked.slice(0, 6);
    bows.forEach((id, i) => {
      const t = i / 5,
        [px, py] = at(0.3 + t * 0.46, 0.13 + t * 0.08);
      add(
        overlay(30, 70, (c) => {
          c.scale(0.7, 0.7);
          bow(c, -22, 0, id);
        }),
        px,
        py,
        0.5,
        0.22,
      );
    });
  } else if (station.id === 'trophies') {
    const hung = ['husk', ...profile.bosses.filter((b) => b in TROPHY_HOOKS)];
    for (const id of hung) {
      const [fx, fy] = TROPHY_HOOKS[id],
        [px, py] = at(fx, fy);
      add(
        overlay(90, 50, (c) => trophy(c, id, 0, id === 'huntmaster' ? 10 : 0)),
        px,
        py,
      );
    }
  } else if (station.id === 'altar') {
    // The constellation gathers over the silver bowl.
    const [px, py] = at(0.5, 0.12);
    add(
      overlay(140, 110, (c) => {
        c.translate(0, 58 + 40);
        stars(c, profile);
      }),
      px,
      py,
      0.5,
      0.9,
    );
  } else if (station.id === 'log') {
    const [px, py] = at(0.02, foot);
    add(
      overlay(40, 60, (c) => pages(c, -11, 18, profile.runs.length)),
      px,
      py,
      0.5,
      0.8,
    );
  }
}
/** Overlay textures from the last camp visit (destroyed on the next). */
let extras: Texture[] = [];

/** Builds the camp props into a container; returns the flame sprite for the renderer to animate. */
let baked: Record<string, Texture> = {};
export function buildCamp(
  layer: Container,
  art: Record<string, Texture>,
  profile: Profile,
  painted?: { tent: Texture; fire: Texture; stations?: Record<string, Texture> },
) {
  // The station props show the hunter's progress, so they are re-baked on every camp visit.
  for (const t of [...Object.values(baked), ...extras]) t.destroy(true);
  extras = [];
  baked = campArt(profile);
  art = { ...art, ...baked, tent: painted?.tent ?? baked.tent, fire: painted?.fire ?? baked.fire };
  const put = (tex: Texture, x: number, y: number, scale = 1, flip = false) => {
    const s = new Sprite(tex);
    s.anchor.set(0.5, 0.78);
    s.position.set(x, y);
    s.scale.set(flip ? -scale : scale, scale);
    layer.addChild(s);
    return s;
  };
  // Painted props (render/gptArt.ts) arrive large; fit them to the camp's scale.
  const fit = (tex: Texture, width: number) => (tex.width > 300 ? width / tex.width : 1);
  for (const t of TENTS) put(art.tent, t.x, t.y, fit(art.tent, 170), t.flip);
  const stations = painted?.stations;
  for (const s of STATIONS) {
    const tex = stations?.[PAINTED_STATION[s.id]];
    if (tex && stations) paintedStation(layer, s, tex, stations, profile);
    else if (art[s.id]) put(art[s.id], s.x, s.y + 14);
  }
  // The campfire burns bigger the more hunts the hunter has come home from.
  const fire = 0.85 + Math.min(0.35, profile.runs.length * 0.02);
  const paintedFire = art.fire.width > 300,
    scale = paintedFire ? fit(art.fire, 260) : 0.9 * fire;
  const base = put(art.fire, CAMPFIRE.x, CAMPFIRE.y, scale);
  base.anchor.set(0.5, 0.5);
  // The painted campfire has its fire left of centre (the bedroll and log sit to the right).
  const fx = paintedFire ? CAMPFIRE.x - 0.2 * art.fire.width * scale : CAMPFIRE.x,
    fy = paintedFire ? CAMPFIRE.y + 0.08 * art.fire.height * scale : CAMPFIRE.y + 4;
  const flame = put(art.flame, fx, fy);
  flame.anchor.set(0.5, 0.95);
  flame.blendMode = 'add';
  // Over the painted fire the flame is a soft extra flicker, not a second fire.
  if (paintedFire) flame.alpha = 0.55;
  flame.scale.set(paintedFire ? 0.7 * fire : fire);
  return { flame, size: paintedFire ? 0.7 * fire : fire };
}
