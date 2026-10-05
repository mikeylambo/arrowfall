import './ui/style.css';
import {createGameApp,createSurvivorAssembly,PixiAdapter,ResultsManager,SaveManager,BrowserStorage,stableHashString,type UIChoice} from '@slu/web-shell';
import {View} from './render/renderer';
import {Synth} from './audio/synth';
import {Controls} from './ui/input';
import {Hunt} from './sim/game';
import {BOWS} from './data/bows';
import {BOSSES} from './data/bosses';
import {UPGRADES} from './data/upgrades';
import {EVOLUTIONS} from './data/evolutions';
import {ENEMIES} from './data/enemies';
import {DEEDS} from './data/meta';
import {deedProgress} from './sim/profile';
import {STATIONS} from './data/world';
import {xpNeeded} from './data/tuning';
import {loadProfile,saveProfile,bankRun,boonCost} from './sim/profile';
import {fmt,bowChoices,offerChoices,altarChoices,logChoices,fingerprint} from './ui/screens';
import type {Profile,RunRecord} from './sim/types';
const $=(id:string)=>document.getElementById(id)!;
const profileStore=new SaveManager<Profile>(new BrowserStorage('arrowfall'),'hunter-profile',2);
const recovered=await profileStore.loadWithRecovery();
const profile=recovered.data??loadProfile(localStorage),view=new View(),audio=new Synth(),controls=new Controls();
let game:Hunt|null=null,scene='title',selected='recurve',phase=0,nightly=false,accumulator=0,last=performance.now(),savedRun=false,showPerf=false,uiScreen='title',pauseDeferred=false,seedOverride:number|null=null;
let options={autoLoose:false,colorblind:false,bands:true,numbers:false,toggle:false,uiScale:1,assist:.3,bindings:controls.bindings,music:.25,sfx:.7};
try{options={...options,...JSON.parse(localStorage.getItem('arrowfall.options')||'{}')};}catch{}
controls.toggle=options.toggle;controls.bindings=options.bindings;controls.assist=options.assist;view.colorblind=options.colorblind;view.showBands=options.bands;view.numbers=options.numbers;
await view.init($('game-canvas') as HTMLCanvasElement);
const adapter=new PixiAdapter({loadLevel(id){begin(id==='range'?'range':id==='camp'?'camp':'hunt');},unloadLevel(){begin('camp');},suspend(){controls.clear();},resume(){controls.clear();},resize(){},screenshot(){return new Promise(resolve=>($('game-canvas') as HTMLCanvasElement).toBlob(resolve));}});
const app=await createGameApp({gameId:'arrowfall',gameName:'Arrowfall',version:'2.0.0-dev',renderer:adapter,root:$('ui'),assemblies:[shell=>createSurvivorAssembly({shell})],audio,pwa:false,mobileViewport:false});
const oldActivate=app.flow.onActivate.bind(app.flow),oldBack=app.flow.onBack.bind(app.flow);
function show(id:string,title:string,choices:UIChoice[],subtitle?:string,back?:string){uiScreen=id;app.ui.register([{id,title,choices,subtitle,backTarget:back}]);app.ui.show(id);document.querySelectorAll<HTMLElement>('.slu-panel').forEach(el=>el.style.zoom=String(options.uiScale));controls.clear();}
function hideUI(){uiScreen='gameplay-placeholder';app.ui.show('gameplay-placeholder');}
let saveQueue=Promise.resolve();
function persist(){saveProfile(profile,localStorage);saveQueue=saveQueue.then(()=>profileStore.save(profile)).catch(error=>{app.shell.studio.diagnostics.capture(error,{scope:'profile.save'});});}
function saveOptions(){try{localStorage.setItem('arrowfall.options',JSON.stringify(options));}catch{}view.colorblind=options.colorblind;view.showBands=options.bands;view.numbers=options.numbers;controls.toggle=options.toggle;controls.assist=options.assist;options.bindings=controls.bindings;document.querySelectorAll<HTMLElement>('.slu-panel').forEach(el=>el.style.zoom=String(options.uiScale));if(game)game.autoLoose=options.autoLoose;document.documentElement.style.fontSize=16*options.uiScale+'px';}
function begin(next:string){scene=next;savedRun=false;controls.clear();const seed=seedOverride??(nightly?stableHashString(new Date().toISOString().slice(0,10)):Math.floor(Math.random()*4294967296));game=new Hunt(seed,profile,selected,phase,next==='range');game.autoLoose=options.autoLoose;
 if(next==='camp'){game.scene='camp';game.freezeSpawns=true;game.god=true;game.player.x=600;game.player.y=430;view.camera.x=600;view.camera.y=430;}
 view.attach(game,next==='camp');$('hud').classList.toggle('visible',next!=='camp');$('camp-title').style.display=next==='camp'?'block':'none';$('camp-menu').style.display=next==='camp'?'block':'none';$('stations').innerHTML=next==='camp'?STATIONS.map(s=>`<button class="station" data-station="${s.id}" id="station-${s.id}">${s.name}</button>`).join(''):'';
 document.querySelectorAll<HTMLButtonElement>('[data-station]').forEach(b=>b.onclick=()=>station(b.dataset.station!));$('silver').textContent=profile.currency+' Moonsilver';app.shell.session.setPhase('playing');hideUI();accumulator=0;
}
async function launch(next='hunt'){audio.unlock();await app.shell.loadLevel(next);hideUI();}
function trail(){show('trail','The Trail',[{id:'fletcher',label:'Choose Bow',description:BOWS.find(b=>b.id===selected)!.name},{id:'phase',label:'Moon Phase',description:['Crescent','Half Moon','Full Moon','Blood Moon'][phase]},{id:'nightly',label:nightly?'Nightly Hunt · On':'Nightly Hunt · Off',description:'A daily seeded forest and card sequence'},{id:'begin',label:'Begin the Hunt'}],undefined,'camp');}
function station(id:string){audio.unlock();if(id==='trail'){trail();return;}if(id==='fletcher'){show('fletcher','The Fletcher',bowChoices(profile,selected),undefined,'camp');return;}if(id==='range'){show('range-setup','The Range',[{id:'practice',label:'Free Practice'},...['steady','sweet','deadeye','duel'].map((id,i)=>({id:'challenge:'+id,label:['Steady','Sweet Spot','Deadeye Drill','Poacher’s Duel'][i]}))],undefined,'camp');return;}if(id==='altar'){show('altar','Silver Altar',altarChoices(profile),`${profile.currency} Moonsilver`,'camp');return;}if(id==='log'){show('log','Hunter’s Log',logChoices(profile),`${profile.runs.length} recorded hunts`,'camp');return;}if(id==='trophies'){show('trophies','Trophy Wall',DEEDS.map(d=>({id:'deed:'+d.id,label:d.name,description:Math.min(d.target,deedProgress(profile,d.metric))+'/'+d.target,disabled:true})),`${DEEDS.filter(d=>deedProgress(profile,d.metric)>=d.target).length} / 60 Deeds`, 'camp');}}
function settings(){show('options','Options',[
 {id:'option:autoLoose',label:`Auto-Loose · ${options.autoLoose?'On':'Off'}`,description:'Release at full draw'},
 {id:'option:toggle',label:`Toggle Draw · ${options.toggle?'On':'Off'}`},
 {id:'option:colorblind',label:`High Contrast Threats · ${options.colorblind?'On':'Off'}`},
 {id:'option:numbers',label:`Damage Numbers · ${options.numbers?'All Hits':'Criticals Only'}`},
 {id:'option:assist',label:`Aim Assist · ${Math.round(options.assist*100)}%`},
 {id:'option:uiScale',label:`UI Scale · ${Math.round(options.uiScale*100)}%`},
 {id:'option:bands',label:`Range Bands · ${options.bands?'On':'Off'}`},
 {id:'option:shake',label:`Screen Shake · ${Math.round(view.shake*100)}%`},
 {id:'option:music',label:`Music · ${Math.round(options.music*100)}%`},
 {id:'option:sfx',label:`SFX · ${Math.round(options.sfx*100)}%`},
 {id:'option:fullscreen',label:'Fullscreen'},
 {id:'option:rebind',label:'Rebind Movement',description:'Press a key for Up, Down, Left, Right in order'}],undefined,scene==='camp'?'camp':'pause');}
function levelUp(){if(!game)return;const choices:UIChoice[]=offerChoices(game);if(game.rerolls)choices.push({id:'reroll',label:`Reroll · ${game.rerolls}`});if(game.skips)choices.push({id:'skip',label:`Skip · ${game.skips}`});if(game.banishes)choices.push({id:'banish',label:`Banish First Card · ${game.banishes}`});show('levelup','Moonlight Answers',choices,`Level ${game.level} · ${Object.entries(game.ranks).map(([id,rank])=>(UPGRADES.find(u=>u.id===id)?.name??id)+' '+rank).join(' · ')}`);}
function endRun(){if(!game||savedRun)return;savedRun=true;const g=game;
 const axes=[g.damageSources.bow||0,g.damageSources.deadshot||0,g.evolutions.has('worldpiercer')?(g.damageSources.bow||0):0,g.damageSources.hellfire||g.damageSources.status||0,g.damageSources.thunderstorm||0,g.damageSources.phantom||0];
 const record:RunRecord={time:g.time,kills:g.kills,shots:g.shots,perfects:g.perfects,outcome:g.outcome,bow:selected,currency:g.earned,fingerprint:axes,evolutions:[...g.evolutions],seed:g.seed};
 bankRun(profile,record,g.maxStreak,g.sweetKills);persist();const results=new ResultsManager().build({kills:g.kills,perfects:g.perfects,shots:g.shots},{timeMs:g.time*1000,metadata:{outcome:g.outcome}});app.shell.studio.telemetry.record('run.result',{kills:results.stats.kills});app.flow.showResults();show('results',g.outcome,[{id:'retry',label:'Hunt Again'},{id:'camp',label:'Return to Camp'},{id:'fingerprint',label:'Share Fingerprint'}],`${fmt(g.time)} survived · ${g.kills} hunted · ${Math.round(g.perfects/Math.max(1,g.shots)*100)}% perfect\n${g.earned} Moonsilver · ${record.evolutions.map(id=>EVOLUTIONS.find(e=>e.id===id)?.name).join(' · ')||'No evolutions'}`);
 const canvas=fingerprint(record);canvas.className='fingerprint';document.querySelector('.slu-header')?.append(canvas);
}
app.flow.onActivate=(screen,id)=>{
 audio.unlock();audio.playSfx('ui.confirm');
 if(screen==='title'){if(!profile.onboarded){void launch();}else{void launch('camp');}return;}
 if(screen==='main-menu'){void launch('camp');return;}
 if(screen==='pause'){if(id==='resume'){app.shell.resume();hideUI();}else if(id==='restart')void launch(scene==='range'?'range':'hunt');else if(id==='settings')settings();else if(id==='quit')void launch('camp');return;}
 if(screen==='trail'){if(id==='fletcher')station('fletcher');if(id==='phase')show('phase','Moon Phase',['Crescent','Half Moon','Full Moon','Blood Moon'].map((label,i)=>({id:'phase:'+i,label,disabled:i>profile.phase})),undefined,'trail');if(id==='nightly'){nightly=!nightly;trail();}if(id==='begin')void launch();return;}
 if(screen==='fletcher'&&id.startsWith('bow:')){selected=id.slice(4);station('fletcher');return;}
 if(screen==='range-setup'){void launch('range').then(()=>{if(id.startsWith('challenge:'))game?.startChallenge(id.slice(10));});return;}
 if(screen==='phase'){phase=Number(id.slice(6));trail();return;}
 if(screen==='altar'){const name=id.slice(5),rank=profile.boons[name]||0,cost=boonCost(rank);if(profile.currency>=cost){profile.currency-=cost;profile.boons[name]=rank+1;persist();station('altar');}return;}
 if(screen==='levelup'&&game){if(game.choiceGuard>0)return;if(id==='reroll'){game.reroll();levelUp();}else if(id==='skip'){game.skip();hideUI();}else if(id==='banish'){game.banish(0);levelUp();}else {game.choose(Number(id.slice(5)));if(!game.offers.length)hideUI();}return;}
 if(screen==='results'){if(id==='retry')void launch();if(id==='camp')void launch('camp');if(id==='fingerprint'){const c=fingerprint(profile.runs[0]),a=document.createElement('a');a.download=`arrowfall-${game?.seed}.png`;a.href=c.toDataURL();a.click();}return;}
 if(screen==='options'){
  const key=id.slice(7);if(['autoLoose','toggle','colorblind','bands','numbers'].includes(key)){const k=key as 'autoLoose';options[k]=!options[k];}
  if(key==='assist')options.assist=options.assist>=1?0:Math.min(1,options.assist+.1);if(key==='uiScale')options.uiScale=options.uiScale>=1.5?.75:options.uiScale+.25;
  if(key==='shake')view.shake=view.shake<=0?1:Math.max(0,view.shake-.25);
  if(key==='music'||key==='sfx'){options[key]=options[key]<=0?1:Math.max(0,options[key]-.1);app.audioMixer?.setVolume(key,options[key]);}
  if(key==='fullscreen'){if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen();}
  if(key==='rebind'){let i=0;const names=['up','down','left','right'] as const;$('hint').textContent='Press a key for Up';const handler=(e:KeyboardEvent)=>{e.preventDefault();controls.bindings[names[i++]]=e.code;if(i>=4){removeEventListener('keydown',handler,true);$('hint').textContent='';saveOptions();}else $('hint').textContent='Press a key for '+names[i];};addEventListener('keydown',handler,true);}
  saveOptions();settings();return;
 }
 oldActivate(screen,id);
};
app.flow.onBack=(screen)=>{if(screen==='range-setup'||screen==='trail'||screen==='fletcher'||screen==='altar'||screen==='trophies'||screen==='log'){hideUI();return;}if(screen==='phase'){trail();return;}if(screen==='options'){if(scene==='camp')hideUI();else{app.flow.showPause();uiScreen='pause';}return;}oldBack(screen);};
show('title','ARROWFALL',[{id:'start',label:profile.onboarded?'Return to the Hollowmoor':'Begin the Hunt'}],'20 Minutes. One Hunter. Endless Arrows.');
const menuBackdrop=new Hunt(4421,profile);view.attach(menuBackdrop);menuBackdrop.freezeSpawns=true;
$('camp-menu').onclick=settings;
app.shell.events.on('game:pause',()=>{uiScreen='pause';if(game?.deadeye){pauseDeferred=true;app.shell.resume();hideUI();}});
app.shell.studio.dev.registerPanel('Arrowfall',{read:()=>snapshot()});
app.shell.studio.dev.register('arrowfall.focus',{description:'Fill Focus',run:()=>{if(game)game.player.focus=100;}});
function snapshot(){return {camera:{...view.camera},zoom:view.zoom,width:view.width,height:view.height,scene,time:game?.time||0,hp:game?.player.hp||0,level:game?.level||1,enemies:game?.enemies.count||0,arrows:game?.arrows.count||0,particles:game?.particles.count||0,shots:game?.shots||0,perfects:game?.perfects||0,focus:game?.player.focus||0,deadeye:game?.deadeye||0,marks:game?.focusMarks||0,offers:game?.offers.slice()||[],evolutions:game?[...game.evolutions]:[],boss:game?.boss?{id:BOSSES[game.boss.boss].id,hp:game.boss.hp,phase:game.boss.phase}:null,outcome:game?.outcome||'',fps:view.fps,seed:game?.seed,damage:game?{...game.damageSources}:{}};}
const devMode=import.meta.env.DEV;
if(devMode){(window as any).__ARROWFALL__={get state(){return snapshot();},startRun:(config:any={})=>{seedOverride=config.seed??1313;selected=config.bow??'recurve';void launch(config.range?'range':'hunt');},setSeed:(seed:number)=>{seedOverride=seed;},timeSkip:(t:number)=>{if(game){game.time=t;game.boss=null;for(const e of game.enemies.items)if(e.boss>=0)e.active=false;game.bossMask=(1<<BOSSES.filter(b=>b.time<t).length)-1;}},grant:(id:string)=>game?.grant(id),focus:()=>{if(game)game.player.focus=100;},spawn:(id:string,elite=-1)=>{if(game){const kind=ENEMIES.findIndex(e=>e.id===id);return game.spawn(Math.max(0,kind),game.player.x+330,game.player.y,false,elite)?.id;}},boss:(i:number)=>game?.spawnBoss(i),god:(value=true)=>{if(game)game.god=value;},finish:()=>game?.finish('The Hunter Falls'),xp:(amount:number)=>game?.gainXp(amount),choose:(i:number)=>{if(game){game.choiceGuard=0;game.choose(i);hideUI();}},damageBoss:(fraction=.35)=>{if(game?.boss)game.boss.hp-=game.boss.maxHp*fraction;},killBoss:()=>{if(game?.boss)game.kill(game.boss);},stress:()=>{if(game){game.enemies.clear();game.freezeSpawns=true;game.god=true;for(let i=0;i<350;i++)game.spawn(i%8,game.player.x+(i%25-12)*42,game.player.y+(Math.floor(i/25)-7)*45);}},event:(i:number)=>game?.startEvent(i),formation:(i:number)=>game?.formation(i),profile:()=>structuredClone(profile),timeline:()=>game?.timeline.slice(),sim:()=>game};}
$('dev').innerHTML=`<b>ARROWFALL</b><br><button data-dev="focus">Fill Focus</button><button data-dev="god">God Mode</button><button data-dev="stress">350 Enemies</button><br>${BOSSES.map((b,i)=>`<button data-boss="${i}">${fmt(b.time)} ${b.name}</button>`).join('')}<select id="dev-grant">${[...UPGRADES.map(u=>({id:u.id,name:u.name})),...EVOLUTIONS.map(e=>({id:'evo:'+e.id,name:e.name}))].map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select><button data-dev="grant">Grant</button>`;
$('dev').onclick=e=>{const b=(e.target as HTMLElement).closest('button');if(!b||!game)return;const d=(b as HTMLElement).dataset;if(d.boss){game.time=BOSSES[Number(d.boss)].time;game.spawnBoss(Number(d.boss));}if(d.dev==='focus')game.player.focus=100;if(d.dev==='god')game.god=!game.god;if(d.dev==='stress')(window as any).__ARROWFALL__.stress();if(d.dev==='grant')game.grant(($('dev-grant') as HTMLSelectElement).value);};
addEventListener('keydown',e=>{if(e.code==='F1'&&devMode){e.preventDefault();$('dev').classList.toggle('visible');}if(e.code==='F2'&&devMode){e.preventDefault();showPerf=!showPerf;}if(e.code==='KeyF'&&scene==='camp'&&game&&uiScreen==='gameplay-placeholder'){const nearest=STATIONS.find(s=>Math.hypot(s.x-game!.player.x,s.y-game!.player.y)<110);if(nearest)station(nearest.id);}if(uiScreen==='levelup'&&/^Digit[1-4]$/.test(e.code))app.flow.onActivate('levelup','pick:'+(Number(e.code.slice(5))-1));});
function hud(g:Hunt){const p=g.player;$('hp').textContent=`${Math.max(0,Math.ceil(p.hp))} / ${p.maxHp}`;$('hp-fill').style.width=p.hp/p.maxHp*100+'%';$('time').textContent=fmt(g.time);$('night').textContent=g.time>=1140?'THE FINAL HUNT':g.time>=900?'FALSE DAWN':g.time>=600?'WITCHING HOURS':g.time>=300?'DEEP NIGHT':g.time>=120?'FIRST HOWL':'MOONRISE';$('moon').style.color=g.time>=600||phase===3?'#fb5368':'#dbeaff';$('stats').innerHTML=`<b>LV ${g.level}</b> · ${g.kills} HUNTED<br>${p.cooldown>0?'Dodge '+p.cooldown.toFixed(1)+' s':'Dodge ready'} · ${p.focus>=100?'Deadeye ready':'Focus '+Math.floor(p.focus)}`;$('xp-fill').style.width=g.xp/xpNeeded(g.level)*100+'%';$('inventory').innerHTML=`${g.bow.name}<br>${['moonraven','thornsnare','lantern'].filter(id=>g.rank(id)>0).map(id=>id+' '+g.rank(id)).join(' · ')}<br><b>${[...g.evolutions].map(id=>EVOLUTIONS.find(e=>e.id===id)?.name).join(' · ')}</b>`;$('banner').textContent=g.bannerTime>0?g.banner:'';$('boss').innerHTML=g.boss?`${BOSSES[g.boss.boss].name} · ${['I','II','III'][g.boss.phase-1]}<div class="bar"><i style="width:${g.boss.hp/g.boss.maxHp*100}%"></i></div>`:'';
 if(!profile.onboarded&&scene==='hunt')$('hint').textContent=g.shots===0?'Hold to draw':g.perfects===0?'Release at the chime':g.time<40?'Space to dodge':p.focus>=100?'Deadeye ready: right-click':'';else if(scene==='range'){$('hint').textContent=g.challenge?(g.rangeWon?'Challenge complete':g.challenge==='steady'?`${g.perfects-g.challengePerfect}/5 perfects · ${Math.max(0,10-g.time+g.challengeStart).toFixed(1)} seconds`:g.challenge==='sweet'?`${g.rangeSweet}/20 moving sweet-spot hits`:g.challenge==='deadeye'?`${g.rangeDeadeye}/8 Deadeye hits`:`${g.rangeInterrupt}/3 interrupts`):'The Range · Hold to draw · Release at the chime · Esc to leave';if(g.rangeWon)persist();}else $('hint').textContent='';
}
function tick(now:number){const dt=Math.min(.1,(now-last)/1000);last=now;view.fps+=(1/Math.max(.001,dt)-view.fps)*.04;const g=game??menuBackdrop;
 if(game&&app.shell.session.phase==='playing'){
  if(uiScreen==='gameplay-placeholder'){
   const input=controls.sample(view,g.player,g.enemies.items);if(scene==='camp'){if(input.dodge){const nearest=STATIONS.find(s=>Math.hypot(s.x-g.player.x,s.y-g.player.y)<110);if(nearest)station(nearest.id);}g.player.aim=Math.atan2(input.ay-g.player.y,input.ax-g.player.x);g.player.x+=input.mx*240*dt;g.player.y+=input.my*240*dt;g.realTime+=dt;g.player.x=Math.max(100,Math.min(1050,g.player.x));g.player.y=Math.max(100,Math.min(760,g.player.y));}
   else{accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps++<6){g.viewport.width=view.width/view.zoom;g.viewport.height=view.height/view.zoom;g.step(1/60,input);input.dodge=false;input.deadeye=false;accumulator-=1/60;if(g.offers.length)break;}if(g.offers.length)levelUp();if(g.outcome)endRun();if(pauseDeferred&&g.deadeye<=0){pauseDeferred=false;app.flow.showPause();uiScreen='pause';}}
  }else if(uiScreen==='levelup')g.choiceGuard=Math.max(0,g.choiceGuard-dt);
 }
 if(scene==='camp'&&game){for(const s of STATIONS){const el=$('station-'+s.id);if(!el)continue;el.style.left=(view.width/2+(s.x-view.camera.x)*view.zoom)+'px';el.style.top=(view.height/2+(s.y-view.camera.y)*view.zoom+62)+'px';el.classList.toggle('near',Math.hypot(s.x-game.player.x,s.y-game.player.y)<110);}if(uiScreen==='gameplay-placeholder')$('hint').textContent='WASD to walk · F at a station';else $('hint').textContent='';}
 if(game&&scene!=='camp')hud(g);view.render(g,dt);for(const event of g.events)if(!event.id.startsWith('number.'))audio.playSfx(event.id);g.events.length=0;if(app.shell.session.phase==='playing')audio.tick(g.time,g.player.draw);
 $('perf').textContent=showPerf?`${view.fps.toFixed(1)} FPS · ${(1000/view.fps).toFixed(2)} ms\n${g.enemies.count} enemies · ${g.arrows.count} arrows\n${g.threats.count} threats · ${g.particles.count} particles\nPerfect ${g.perfects}/${g.shots} · cap ${g.cap()}\n${Object.entries(g.damageSources).map(([id,d])=>id+': '+Math.floor(d/Math.max(1,g.time))+' DPS').join('\n')}`:'';
 requestAnimationFrame(tick);
}
app.audioMixer?.setVolume('music',options.music);app.audioMixer?.setVolume('sfx',options.sfx);app.audioMixer?.setVolume('master',.65);requestAnimationFrame(tick);
