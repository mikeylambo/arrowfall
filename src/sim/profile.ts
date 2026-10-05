import {EconomyManager} from '@slu/web-shell';
import type {Profile,RunRecord} from './types';
export const freshProfile=():Profile=>({version:2,currency:0,runs:[],kills:0,perfects:0,sweetKills:0,maxStreak:0,bosses:[],unlocked:['recurve'],deeds:[],boons:{},onboarded:false,wins:0,phase:0,seen:[],discovered:[],challenges:[]});
export function loadProfile(storage:Pick<Storage,'getItem'>):Profile {try{const raw=storage.getItem('arrowfall.v2');if(!raw)return freshProfile();const p=JSON.parse(raw);if(p.version!==2)return freshProfile();return {...freshProfile(),...p};}catch{return freshProfile();}}
export function saveProfile(p:Profile,storage:Pick<Storage,'setItem'>){try{storage.setItem('arrowfall.v2',JSON.stringify(p));return true;}catch{return false;}}
export const BOONS=[['Might',5,'+4% damage'],['Vigor',5,'+10 HP'],['Swiftness',3,'+4% speed'],['Keen Eye',3,'+3% crit'],['Greed',5,'+8% silver'],['Growth',5,'+5% XP'],['Magnet',3,'+20% pickup radius'],['Reroll',3,'+1 reroll'],['Banish',3,'+1 banish'],['Skip',3,'+1 skip'],['Fourth Card',1,'4 upgrade offers'],['Second Wind',1,'Survive one lethal hit']] as const;
export function boonCost(rank:number){return 50+rank*75;}
export function bankRun(p:Profile,r:RunRecord,streak:number,sweet:number){
 const economy=new EconomyManager();economy.set('moonsilver',p.currency);economy.credit('moonsilver',r.currency);p.currency=economy.balance('moonsilver');p.runs.unshift(r);p.runs=p.runs.slice(0,50);p.kills+=r.kills;p.perfects+=r.perfects;p.sweetKills+=sweet;p.maxStreak=Math.max(streak,p.maxStreak);p.onboarded=true;
 if(r.outcome==='Hunt Complete'){p.wins++;p.phase=Math.min(3,p.phase+1);}else if(r.outcome==='Survived Until Dawn')p.phase=Math.max(1,p.phase);
 const unlock=(id:string,condition:boolean)=>{if(condition&&!p.unlocked.includes(id))p.unlocked.push(id);};
 unlock('sparrow',p.perfects>=300);unlock('nightreach',p.sweetKills>=500);unlock('letoff',p.maxStreak>=10);unlock('oathbreaker',p.bosses.includes('bramble'));unlock('moonbow',p.wins>0);
 for(const e of r.evolutions)if(!p.discovered.includes(e))p.discovered.push(e);
}
export function deedProgress(p:Profile,metric:string):number {if(metric.startsWith('boss:'))return Number(p.bosses.includes(metric.slice(5)));if(metric.startsWith('evolution:'))return Number(p.discovered.includes(metric.slice(10)));if(metric.startsWith('challenge:'))return Number(p.challenges.includes(metric.slice(10)));if(metric==='runs')return p.runs.length;if(metric==='seen')return p.seen.length;return Number((p as unknown as Record<string,unknown>)[metric]||0);}
