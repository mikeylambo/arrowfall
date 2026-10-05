import type { Bow } from '../data/bows';
export function drawProfile(bow:Bow,quick=0,steady=0,heavy=0,swift=0) {
  return {full:bow.draw/(1+.08*quick-.1*heavy+.2*swift),window:bow.window*(1+.25*steady),auto:bow.draw/(1+.08*quick-.1*heavy+.2*swift)+bow.window*(1+.25*steady)+.35};
}
export function classifyDraw(elapsed:number,full:number,window:number):'quick'|'drawn'|'perfect'|'overdraw' {
  if(elapsed<full*.5)return 'quick'; if(elapsed<full)return 'drawn'; if(elapsed<=full+window+1e-9)return 'perfect';return 'overdraw';
}
export function drawDamage(elapsed:number,full:number){return elapsed<full*.5?.4:.4+.6*Math.min(1,elapsed/full);}
