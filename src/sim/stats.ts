/**
 * The hunter's derived numbers, one formula each. Combat and movement read these, and so does
 * the pause screen's stats panel, so what the panel shows is what the game uses.
 */
import { T } from '../data/tuning';
import { drawProfile } from './bow';
import type { Hunt } from './game';

type Source = Pick<Hunt, 'rank' | 'profile' | 'bow'>;
const boon = (g: Source, name: string) => g.profile.boons[name] || 0;

export const critChance = (g: Source) =>
  0.05 + 0.05 * g.rank('eagle-eye') + 0.03 * boon(g, 'Keen Eye');
/** Multiplier on every arrow's base damage. */
export const damageMultiplier = (g: Source) =>
  1 + 0.12 * g.rank('draw-strength') + 0.04 * boon(g, 'Might') + 0.25 * g.rank('heavy-bow');
/** Crit multiplier; a perfect release from the Let-Off bow hits harder still. */
export const critMultiplier = (g: Source, perfect = false) =>
  (perfect && g.bow.id === 'letoff' ? 3 : 2) + 0.2 * g.rank('broadhead');
export const arrowSpeed = (g: Source) => T.arrowSpeed * (1 + 0.15 * g.rank('taut-string'));
/** Enemies an ordinary arrow passes through (a perfect arrow pierces one more). */
export const pierce = (g: Source) => g.rank('piercer') + (g.bow.id === 'nightreach' ? 1 : 0);
export const moveMultiplier = (g: Source) =>
  1 + 0.08 * g.rank('lightfoot') + 0.04 * boon(g, 'Swiftness');
export const pickupRadius = (g: Source) =>
  90 * (1 + 0.2 * boon(g, 'Magnet') + 0.3 * g.rank('moonpull'));
export const bowDraw = (g: Source) =>
  drawProfile(
    g.bow,
    g.rank('quick-nock'),
    g.rank('steady-hand'),
    g.rank('heavy-bow'),
    g.rank('swift-bow'),
  );
