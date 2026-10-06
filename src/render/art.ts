import { Rectangle, Texture } from 'pixi.js';
import { PALETTE, ENEMY_TONES, BOSS_TONES } from '../data/art';
import { ENEMIES } from '../data/enemies';
import { BOSSES } from '../data/bosses';
import { FORMS, BOSS_FORMS } from './silhouettes';

type Ctx = CanvasRenderingContext2D;
/** Colours handed to a shape painter. */
export interface Tone {
  body: string;
  shade: string;
  rim: string;
  eye: string;
  width: number;
  glow: string;
  blur: number;
}

/** Atlas edge (px). Every baked sprite shares one texture source so the crowd batches together. */
const ATLAS = 2048;
const PAD = 2;
/** Half the longest dimension of a boss figure inside its 256 px cell. */
export const BOSS_HALF = 115;

export const path = (c: Ctx, points: number[], fill: string, stroke = fill, width = 2) => {
  c.beginPath();
  c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = width;
  c.stroke();
};
const glow = (c: Ctx, color: string, blur = 12) => {
  c.shadowColor = color;
  c.shadowBlur = blur;
};

/** Normal enemies: type red with a lighter red rim. Elites: brighter body, pale thick outline. */
export function enemyTone(id: string, elite: boolean): Tone {
  const tone = ENEMY_TONES[id] ?? ENEMY_TONES.husk;
  return elite
    ? {
        body: PALETTE.elite.body,
        shade: tone.body,
        rim: PALETTE.elite.outline,
        eye: '#ffffff',
        width: 4,
        glow: PALETTE.elite.rim,
        blur: 10,
      }
    : {
        body: tone.body,
        shade: tone.shade,
        rim: PALETTE.threat.rim,
        eye: PALETTE.threat.eye,
        width: 2,
        glow: PALETTE.threat.base,
        blur: 6,
      };
}

export function bakeArt() {
  const assets: Record<string, Texture> = {};
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = ATLAS;
  const ctx = atlas.getContext('2d')!;
  const frames: Record<string, Rectangle> = {};
  let cx = 0,
    cy = 0,
    row = 0;
  /** Paint into the next free atlas cell (w x h, origin at its centre). */
  const bake = (name: string, draw: (c: Ctx) => void, size = 128, height = size) => {
    if (cx + size > ATLAS) {
      cx = 0;
      cy += row;
      row = 0;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, size, height);
    ctx.clip();
    ctx.translate(cx + size / 2, cy + height / 2);
    draw(ctx);
    ctx.restore();
    frames[name] = new Rectangle(cx, cy, size, height);
    cx += size + PAD;
    row = Math.max(row, height + PAD);
  };

  bake('hunter', (c) => {
    const p = PALETTE.player;
    glow(c, p.glow, 16);
    path(c, [-20, -17, -39, -4, -27, 17, -8, 21, 3, 12, 5, -11], p.shade, p.rim);
    path(c, [-4, -16, 13, -11, 18, 0, 10, 14, -5, 16, -12, 5], p.body, p.rim);
    c.shadowBlur = 0;
    c.fillStyle = '#2a3446';
    c.beginPath();
    c.ellipse(8, 0, 6, 9, 0, 0, 7);
    c.fill();
    glow(c, p.glow, 10);
    c.strokeStyle = p.bow;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(20, -29);
    c.quadraticCurveTo(43, 0, 20, 29);
    c.stroke();
  });
  for (const def of ENEMIES)
    for (const elite of [false, true])
      bake(elite ? def.id + '.elite' : def.id, (c) => {
        const tone = enemyTone(def.id, elite);
        glow(c, tone.glow, tone.blur);
        FORMS[def.silhouette.form](c, tone, def.silhouette.length, def.silhouette.width);
      });
  for (const boss of BOSSES)
    bake(
      'boss.' + boss.id,
      (c) => {
        const tone = BOSS_TONES[boss.id];
        const t: Tone = {
          body: tone.body,
          shade: tone.shade,
          rim: PALETTE.threat.rim,
          eye: PALETTE.threat.eye,
          width: 3,
          glow: PALETTE.threat.base,
          blur: 14,
        };
        glow(c, t.glow, t.blur);
        BOSS_FORMS[boss.art.form](c, t, BOSS_HALF);
        // Weak point: a white-hot core, the brightest pixel on the boss.
        const w = boss.art.weak,
          x = w.x * BOSS_HALF,
          y = w.y * BOSS_HALF,
          r = w.r * BOSS_HALF;
        c.shadowColor = PALETTE.weak;
        c.shadowBlur = 18;
        const gr = c.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.45, PALETTE.weak);
        gr.addColorStop(1, PALETTE.weak + '00');
        c.fillStyle = gr;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      },
      256,
    );
  bake(
    'ring',
    (c) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 4;
      c.shadowColor = '#ffffff';
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(0, 0, 40, 0, Math.PI * 2);
      c.stroke();
    },
    96,
  );
  bake('tree', (c) => {
    // Moonlit canopy: overlapping crowns, dark core, cool rim on the moon side (top-left).
    const crowns: [number, number, number][] = [
      [0, 0, 34],
      [-22, -14, 24],
      [20, -18, 22],
      [24, 14, 24],
      [-18, 20, 24],
      [-30, 6, 18],
      [6, 28, 18],
    ];
    c.shadowColor = '#020509';
    c.shadowBlur = 16;
    c.shadowOffsetX = 8;
    c.shadowOffsetY = 10;
    c.fillStyle = PALETTE.cover.tree;
    for (const [x, y, r] of crowns) {
      c.beginPath();
      c.arc(x, y, r, 0, 7);
      c.fill();
    }
    c.shadowColor = 'transparent';
    c.strokeStyle = PALETTE.cover.treeRim;
    c.lineWidth = 2;
    for (const [x, y, r] of crowns) {
      c.beginPath();
      c.arc(x, y, r - 1, Math.PI * 0.95, Math.PI * 1.6);
      c.stroke();
    }
    c.fillStyle = '#060a12';
    c.beginPath();
    c.arc(4, 4, 10, 0, 7);
    c.fill();
  });
  bake('stone', (c) => {
    path(
      c,
      [-22, -28, 11, -37, 28, -9, 21, 29, -12, 34, -29, 12],
      PALETTE.cover.stone,
      PALETTE.cover.stoneRim,
    );
    c.strokeStyle = '#50667f';
    c.beginPath();
    c.moveTo(-12, -20);
    c.lineTo(4, -5);
    c.lineTo(-8, 12);
    c.stroke();
  });
  bake(
    'arrow',
    (c) => {
      glow(c, PALETTE.silver, 7);
      c.strokeStyle = PALETTE.silver;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-35, 0);
      c.lineTo(27, 0);
      c.stroke();
      path(c, [29, 0, 16, -5, 16, 5], PALETTE.silver);
      c.globalAlpha = 0.5;
      c.beginPath();
      c.moveTo(-27, 0);
      c.lineTo(-36, -5);
      c.moveTo(-25, 0);
      c.lineTo(-36, 5);
      c.stroke();
    },
    96,
    24,
  );
  bake(
    'xp',
    (c) => {
      glow(c, PALETTE.silver, 15);
      path(c, [0, -13, 7, 0, 0, 14, -7, 0], PALETTE.silver);
    },
    64,
  );
  bake(
    'berry',
    (c) => {
      glow(c, PALETTE.heal, 12);
      c.fillStyle = PALETTE.heal;
      for (const x of [-4, 4]) {
        c.beginPath();
        c.arc(x, 3, 7, 0, 7);
        c.fill();
      }
      c.strokeStyle = PALETTE.silver;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(3, -12);
      c.stroke();
    },
    64,
  );
  bake(
    'particle',
    (c) => {
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, 12);
      gr.addColorStop(0, 'white');
      gr.addColorStop(0.3, '#ffffffaa');
      gr.addColorStop(1, '#ffffff00');
      c.fillStyle = gr;
      c.fillRect(-16, -16, 32, 32);
    },
    32,
  );
  bake(
    'raven',
    (c) => {
      glow(c, PALETTE.silver, 12);
      path(
        c,
        [-5, 3, -40, -18, -25, 5, -12, 13, 0, 5, 12, 13, 25, 5, 40, -18, 5, 3, 0, -7],
        '#8695bc',
        PALETTE.silver,
      );
    },
    96,
  );
  for (const [name, blades] of [
    ['grass1', 5],
    ['grass2', 7],
    ['grass3', 4],
  ] as const)
    bake(
      name,
      (c) => {
        c.strokeStyle = '#2a3d55';
        c.lineWidth = 1.5;
        c.lineCap = 'round';
        for (let i = 0; i < blades; i++) {
          const a = -Math.PI / 2 + (i - (blades - 1) / 2) * 0.32;
          c.beginPath();
          c.moveTo((i - blades / 2) * 2, 10);
          c.quadraticCurveTo(Math.cos(a) * 8, 2, Math.cos(a) * 16, Math.sin(a) * 18 + 6);
          c.stroke();
        }
      },
      48,
    );
  bake(
    'heather',
    (c) => {
      for (let i = 0; i < 9; i++) {
        c.fillStyle = i % 3 ? '#2b2c48' : '#3a3557';
        c.beginPath();
        c.arc(Math.cos(i * 2.4) * (4 + i), Math.sin(i * 2.4) * (3 + i * 0.8), 2.4, 0, 7);
        c.fill();
      }
    },
    48,
  );
  for (const [name, r] of [
    ['pebble1', 7],
    ['pebble2', 5],
  ] as const)
    bake(
      name,
      (c) => {
        path(
          c,
          [-r, -r * 0.4, -r * 0.2, -r, r, -r * 0.5, r * 0.8, r * 0.7, -r * 0.5, r * 0.8],
          '#1a2638',
          '#2c3d54',
          1.2,
        );
      },
      48,
    );
  // Juice: arrow trail (fades toward the tail), impact spark, soft bloom.
  bake(
    'trail',
    (c) => {
      const gr = c.createLinearGradient(-64, 0, 64, 0);
      gr.addColorStop(0, '#ffffff00');
      gr.addColorStop(1, '#ffffffcc');
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(-64, 0);
      c.lineTo(64, -2.5);
      c.lineTo(64, 2.5);
      c.closePath();
      c.fill();
    },
    128,
    8,
  );
  bake(
    'spark',
    (c) => {
      const gr = c.createLinearGradient(-24, 0, 24, 0);
      gr.addColorStop(0, '#ffffff00');
      gr.addColorStop(0.7, '#ffffffee');
      gr.addColorStop(1, '#ffffff');
      c.fillStyle = gr;
      c.fillRect(-24, -2, 48, 4);
    },
    48,
    8,
  );
  bake('bloom', (c) => {
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 62);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.25, '#ffffffaa');
    gr.addColorStop(0.6, '#ffffff33');
    gr.addColorStop(1, '#ffffff00');
    c.fillStyle = gr;
    c.fillRect(-64, -64, 128, 128);
  });
  const source = Texture.from(atlas).source;
  for (const [name, frame] of Object.entries(frames)) assets[name] = new Texture({ source, frame });
  return assets;
}
