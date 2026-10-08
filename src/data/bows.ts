export interface Bow {
  id: string;
  name: string;
  draw: number;
  window: number;
  near: number;
  far: number;
  mobility: number;
  marks: number;
  signature: string;
  deed: string;
}
export const BOWS: Bow[] = [
  {
    id: 'recurve',
    name: 'Hunter’s Recurve',
    draw: 0.6,
    window: 0.11,
    near: 260,
    far: 460,
    mobility: 0.65,
    marks: 8,
    // The baseline bow: nothing to announce.
    signature: '',
    deed: '',
  },
  {
    id: 'sparrow',
    name: 'Sparrow',
    draw: 0.35,
    window: 0.14,
    near: 140,
    far: 300,
    mobility: 0.85,
    marks: 14,
    signature: 'Three perfects loose a free arrow',
    deed: '300 lifetime perfect looses',
  },
  {
    id: 'nightreach',
    name: 'Nightreach',
    draw: 0.85,
    window: 0.11,
    near: 420,
    far: 680,
    mobility: 0.45,
    marks: 5,
    signature: 'Pierce; +20% damage per 300 px',
    deed: '500 sweet-spot kills',
  },
  {
    id: 'letoff',
    name: 'Let-Off',
    draw: 0.6,
    window: 0.06,
    near: 260,
    far: 460,
    mobility: 0.6,
    marks: 8,
    signature: 'Hold forever; perfect crits ×3',
    deed: '10 perfect looses in a row',
  },
  {
    id: 'oathbreaker',
    name: 'Oathbreaker',
    draw: 1,
    window: 0.11,
    near: 220,
    far: 420,
    mobility: 0.35,
    marks: 4,
    signature: 'Armor-breaking stagger',
    deed: 'Defeat the Bramble King',
  },
  {
    id: 'moonbow',
    name: 'Moonbow',
    draw: 0.6,
    window: 0.11,
    near: 260,
    far: 460,
    mobility: 0.7,
    marks: 10,
    signature: 'Curving silver arrows; Focus on hit',
    deed: 'Kill the Huntmaster',
  },
];
