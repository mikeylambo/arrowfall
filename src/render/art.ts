import { Rectangle, Texture } from 'pixi.js';
export const PALETTE = {
  silver: '#daefff',
  red: '#fb5368',
  violet: '#b48aff',
  floor: '#080d19',
  rim: '#24344b',
};
/** Atlas edge (px). Every baked sprite shares one texture source so the crowd batches together. */
const ATLAS = 1024;
const PAD = 2;
export function bakeArt() {
  const assets: Record<string, Texture> = {};
  const atlas = document.createElement('canvas');
  atlas.width = atlas.height = ATLAS;
  const ctx = atlas.getContext('2d')!;
  const frames: Record<string, Rectangle> = {};
  let cx = 0,
    cy = 0,
    row = 0;
  const bake = (name: string, draw: (c: CanvasRenderingContext2D) => void, size = 128) => {
    if (cx + size > ATLAS) {
      cx = 0;
      cy += row;
      row = 0;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, size, size);
    ctx.clip();
    ctx.translate(cx + size / 2, cy + size / 2);
    draw(ctx);
    ctx.restore();
    frames[name] = new Rectangle(cx, cy, size, size);
    cx += size + PAD;
    row = Math.max(row, size + PAD);
  };
  const path = (c: CanvasRenderingContext2D, points: number[], fill: string, stroke = fill) => {
    c.beginPath();
    c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  };
  const glow = (c: CanvasRenderingContext2D, color: string, blur = 12) => {
    c.shadowColor = color;
    c.shadowBlur = blur;
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineWidth = 2;
  };
  bake('hunter', (c) => {
    glow(c, PALETTE.silver, 14);
    path(c, [-20, -17, -39, -4, -27, 17, -8, 21, 3, 12, 5, -11], '#1c2d48', PALETTE.silver);
    path(c, [-4, -16, 13, -11, 18, 0, 10, 14, -5, 16, -12, 5], '#8296b6', PALETTE.silver);
    c.fillStyle = '#090e1d';
    c.beginPath();
    c.ellipse(8, 0, 7, 10, 0, 0, 7);
    c.fill();
    c.fillStyle = PALETTE.silver;
    c.fillRect(9, -5, 3, 10);
    c.beginPath();
    c.moveTo(20, -29);
    c.quadraticCurveTo(43, 0, 20, 29);
    c.stroke();
    c.beginPath();
    c.moveTo(20, -28);
    c.lineTo(29, 0);
    c.lineTo(20, 28);
    c.stroke();
    c.beginPath();
    c.moveTo(20, 0);
    c.lineTo(48, 0);
    c.stroke();
  });
  bake('husk', (c) => {
    glow(c, PALETTE.red);
    path(
      c,
      [-19, 12, -17, -4, -8, -23, 9, -18, 15, -3, 22, 12, 7, 22, -10, 20],
      '#502538',
      PALETTE.red,
    );
    c.fillStyle = PALETTE.red;
    c.fillRect(-5, -8, 5, 3);
    c.fillRect(6, -7, 4, 3);
  });
  bake('hound', (c) => {
    glow(c, PALETTE.red);
    path(
      c,
      [
        -30, -7, -20, -20, -4, -14, 12, -20, 17, -10, 30, -7, 25, 6, 10, 8, 2, 20, -7, 9, -22, 13,
        -29, 4,
      ],
      '#482236',
      PALETTE.red,
    );
    c.fillStyle = PALETTE.red;
    c.fillRect(17, -6, 5, 3);
  });
  bake('wisp', (c) => {
    glow(c, PALETTE.red, 18);
    path(
      c,
      [0, -32, 13, -14, 22, 2, 14, 17, 1, 28, -17, 18, -20, 0, -6, -14],
      '#622940',
      PALETTE.red,
    );
    c.fillStyle = '#ff9ba9';
    c.beginPath();
    c.ellipse(0, 5, 4, 12, 0, 0, 7);
    c.fill();
  });
  bake('poacher', (c) => {
    glow(c, PALETTE.red);
    path(c, [-15, -20, 3, -23, 13, -4, 15, 20, -20, 20, -12, 0], '#482237', PALETTE.red);
    c.beginPath();
    c.moveTo(18, -25);
    c.quadraticCurveTo(38, 0, 18, 25);
    c.stroke();
    c.beginPath();
    c.moveTo(18, -25);
    c.lineTo(28, 0);
    c.lineTo(18, 25);
    c.stroke();
  });
  bake('stag', (c) => {
    glow(c, PALETTE.red);
    path(c, [-28, -8, -10, -19, 16, -14, 30, 0, 13, 18, -14, 14, -31, 8], '#4d2437', PALETTE.red);
    for (const sign of [-1, 1]) {
      c.beginPath();
      c.moveTo(9, sign * 10);
      c.lineTo(17, sign * 27);
      c.lineTo(10, sign * 42);
      c.moveTo(17, sign * 27);
      c.lineTo(28, sign * 40);
      c.moveTo(15, sign * 21);
      c.lineTo(3, sign * 29);
      c.stroke();
    }
  });
  bake('knight', (c) => {
    glow(c, PALETTE.red);
    path(c, [-22, -25, 6, -23, 18, 0, 5, 25, -22, 23], '#351b30', PALETTE.red);
    path(c, [10, -30, 29, -20, 32, 15, 15, 31, 6, 4], '#6e314a', PALETTE.red);
    c.fillStyle = '#ffa7b0';
    c.fillRect(-7, -5, 6, 3);
  });
  bake('worm', (c) => {
    glow(c, PALETTE.red);
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.ellipse((i - 2) * 11, Math.sin(i) * 9, 9, 14, 0, 0, 7);
      c.fillStyle = i === 4 ? '#d7687d' : '#462236';
      c.fill();
      c.stroke();
    }
  });
  bake('changeling', (c) => {
    glow(c, PALETTE.red);
    path(
      c,
      [0, -28, 10, -7, 29, 0, 12, 12, 0, 29, -10, 9, -28, 0, -10, -9],
      '#5e2b42',
      PALETTE.red,
    );
  });
  bake('tree', (c) => {
    c.shadowColor = '#122940';
    c.shadowBlur = 20;
    path(
      c,
      [
        0, -58, 16, -32, 37, -40, 27, -14, 59, 0, 35, 18, 43, 42, 13, 34, 0, 59, -18, 32, -44, 42,
        -33, 11, -59, -3, -29, -19, -34, -43, -12, -30,
      ],
      '#0b1424',
      '#1c2b40',
    );
    c.fillStyle = '#0a0e17';
    c.beginPath();
    c.ellipse(0, 0, 12, 18, 0, 0, 7);
    c.fill();
  });
  bake('stone', (c) => {
    path(c, [-22, -28, 11, -37, 28, -9, 21, 29, -12, 34, -29, 12], '#111d2e', '#35475d');
    c.strokeStyle = '#58708a';
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
      glow(c, PALETTE.violet);
      for (const x of [-4, 4]) {
        c.beginPath();
        c.arc(x, 3, 7, 0, 7);
        c.fill();
      }
      c.strokeStyle = PALETTE.silver;
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
      glow(c, PALETTE.silver);
      path(
        c,
        [-5, 3, -40, -18, -25, 5, -12, 13, 0, 5, 12, 13, 25, 5, 40, -18, 5, 3, 0, -7],
        '#8695bc',
        PALETTE.silver,
      );
    },
    96,
  );
  const source = Texture.from(atlas).source;
  for (const [name, frame] of Object.entries(frames)) assets[name] = new Texture({ source, frame });
  return assets;
}
