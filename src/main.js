import "./../styles.css";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const titleScreen = document.querySelector("#title-screen");
const hud = document.querySelector("#hud");
const levelup = document.querySelector("#levelup");
const results = document.querySelector("#results");
const upgradeCards = document.querySelector("#upgrade-cards");
const buildReadout=document.querySelector("#build-readout");
const menuPanel = document.querySelector("#menu-panel");
const menuPanelTitle = document.querySelector("#menu-panel-title");
const menuPanelBody = document.querySelector("#menu-panel-body");
const pause = document.querySelector("#pause");
const bossHud=document.querySelector("#boss-hud");
const meta = JSON.parse(localStorage.getItem("arrowfall-meta") || '{"runs":0,"wins":0,"kills":0,"bestTime":0,"bestKills":0}');

const TAU = Math.PI * 2;
// Perfect Draw window, in seconds of hold time. Full draw lands at DRAW_TIME.
const DRAW_TIME = .72, PERFECT_START = .66, PERFECT_END = .86;
const DEBUG = import.meta.env?.DEV || new URLSearchParams(location.search).has("debug");
const RUN_LOG_KEY = "arrowfall-runs";
const keys = new Set();
const mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };

let dpr = 1, last = 0, raf = 0;
let state = "menu";
let world;
let upgrades = [
  {id:"quick",name:"QUICK NOCK",desc:"+16% fire rate.",apply:p=>p.fireRate*=1.16},
  {id:"draw",name:"DRAW STRENGTH",desc:"+25% fully-drawn damage.",apply:p=>p.drawDamage*=1.25},
  {id:"fleet",name:"LIGHTFOOT",desc:"+12% movement speed.",apply:p=>p.speed*=1.12},
  {id:"pierce",name:"PIERCER",desc:"+1 arrow penetration.",apply:p=>p.pierce+=1},
  {id:"crit",name:"EAGLE EYE",desc:"+9% critical chance.",apply:p=>p.critChance+=.09},
  {id:"range",name:"LONGSHAFT",desc:"+22% arrow range.",apply:p=>p.range*=1.22},
  {id:"barbed",name:"BARBED ARROW",desc:"Arrows cause bleed.",once:true,apply:p=>p.bleed=true},
  {id:"wind",name:"WINDSTEP",desc:"Firing boosts movement briefly.",once:true,apply:p=>p.windstep=true},
  {id:"multi",name:"FLETCHER'S CRAFT",desc:"+1 arrow per shot.",apply:p=>p.multi+=1},
  {id:"ember",name:"EMBER ARROW",desc:"Arrows ignite targets.",once:true,apply:p=>p.ember=true},
  {id:"frost",name:"FROST ARROW",desc:"Arrows slow targets.",once:true,apply:p=>p.frost=true},
  {id:"storm",name:"STORM ARROW",desc:"Hits can chain lightning.",once:true,apply:p=>p.storm=true},
  {id:"venom",name:"VENOM ARROW",desc:"Hits poison targets.",once:true,apply:p=>p.venom=true},
  {id:"broad",name:"BROADSHAFT",desc:"+40% arrow hitbox.",apply:p=>p.arrowSize*=1.4},
  {id:"executioner",name:"EXECUTIONER",desc:"+50% damage to enemies below 20% health.",once:true,apply:p=>p.executioner=true},
  {id:"predator",name:"PREDATOR",desc:"Kills briefly increase movement speed.",once:true,apply:p=>p.predator=true},
  {id:"chain",name:"CHAIN KILL",desc:"Rapid kills build damage.",once:true,apply:p=>p.chain=true},
  {id:"mark",name:"HUNTER'S MARK",desc:"Marked enemies take +30% damage.",once:true,apply:p=>p.mark=true},
  {id:"phantom",name:"PHANTOM STEP",desc:"Dash creates a spectral arrow.",once:true,apply:p=>p.phantom=true},
  {id:"heaven",name:"HEAVEN'S CALL",desc:"Perfect Draws rain arrows.",once:true,apply:p=>p.heaven=true}
];

const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const fmt = s => { const m=Math.floor(s/60), sec=Math.floor(s%60); return String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0"); };

function resize(){
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.floor(innerWidth*dpr); canvas.height=Math.floor(innerHeight*dpr);
  canvas.style.width=innerWidth+"px"; canvas.style.height=innerHeight+"px";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener("resize", resize); resize();

function start(){
  meta.runs++; saveMeta();
  mouse.down=false;
  keys.clear();
  state="playing";
  titleScreen.classList.remove("active"); titleScreen.classList.add("hidden");
  results.classList.add("hidden"); levelup.classList.add("hidden"); hud.classList.remove("hidden"); bossHud.classList.add("hidden");
  world = {
    time:0, kills:0, arrows:[], arrowCount:0, crits:0, perfects:0, xp:0, level:1, nextXp:10, paused:false,
    shake:0, flash:0, spawnClock:0, formationClock:150+Math.random()*20, enemyId:0, pendingRain:[],
    player:{x:innerWidth/2,y:innerHeight/2,r:15,speed:235,aim:0,hp:100,fireRate:3.1,shotClock:0,draw:0,drawTime:0,drawDamage:30,
       pierce:0,critChance:.05,range:620,bleed:false,windstep:false,multi:0,ember:false,frost:false,storm:false,venom:false,arrowSize:1,executioner:false,predator:false,chain:false,mark:false,phantom:false,heaven:false,chainCount:0,chainTimer:0,predatorTimer:0,invuln:0,windTimer:0,dash:0,dashCooldown:0,dashX:0,dashY:0},
    enemies:[], enemyArrows:[], particles:[], rings:[], trails:[], boss:null, bossSpawned:false, evolutions:new Set(), evolutionLog:[],
    taken:[], lastHitBy:null, snapshots:[], debugUsed:false
  };
  last=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
}

function applyArrowElement(e){
  const p=world.player;
  if(p.mark && Math.random()<.18)e.marked=3;
  if(p.storm && Math.random()<.22){
    const targets=world.enemies.filter(t=>t!==e&&Math.hypot(t.x-e.x,t.y-e.y)<150).slice(0,2);
    for(const t of targets){t.hp-=12*(p.stormPower||1);burst(t.x,t.y,7,1.4);}
  }
}
function spawnEnemy(kind=null,elite=false){
  const angle=Math.random()*TAU;
  const halfW=innerWidth/2+55,halfH=innerHeight/2+55;
  const edge=Math.random()*4;
  let x,y;
  if(edge<1){x=Math.random()*innerWidth;y=-45;}else if(edge<2){x=innerWidth+45;y=Math.random()*innerHeight;}else if(edge<3){x=Math.random()*innerWidth;y=innerHeight+45;}else{x=-45;y=Math.random()*innerHeight;}
  const dx=x-world.player.x,dy=y-world.player.y;
  const scale=Math.max(1,Math.hypot(dx,dy)/Math.hypot(halfW,halfH));
  x=world.player.x+dx/scale;y=world.player.y+dy/scale;
  const type=kind||pick(["crawler","wolf","brute","shield","wisp","hunter","burrower","mimic"]);
  const base={
    crawler:[11,24,62,8,1],wolf:[10,30,115,10,1],brute:[17,90,45,18,3],
    shield:[14,58,52,13,2],wisp:[9,28,76,12,2],hunter:[12,42,48,7,3],
    burrower:[12,48,70,15,2],mimic:[13,54,58,16,3]
  }[type];
  const e={type,r:base[0],hp:base[1],maxHp:base[1],speed:base[2],damage:base[3],xp:base[4],x,y,id:world.enemyId++,elite:false,eliteType:null,hitFlash:0,bleed:0,burn:0,poison:0,slow:0,marked:0,shotClock:1+Math.random(),spawnGrace:.45,spawnX:x,spawnY:y};
  if(elite){
    const mod=pick(["frenzied","armored","regenerating","vampiric","explosive","swift"]);
    e.elite=true;e.eliteType=mod;e.hp*=1.65;e.maxHp=e.hp;
    if(mod==="frenzied"||mod==="swift")e.speed*=1.45;
    if(mod==="armored")e.armor=.28;
    if(mod==="regenerating")e.regen=8;
    if(mod==="vampiric")e.lifeSteal=.06;
    if(mod==="explosive")e.explosive=true;
  }
  world.enemies.push(e);
}
function spawnFormation(kind){
  const n=kind==="ring"?10:kind==="crossfire"?8:7;
  for(let i=0;i<n;i++){
    spawnEnemy(pick(["crawler","wolf","shield","wisp"]));
    const e=world.enemies[world.enemies.length-1],cx=world.player.x,cy=world.player.y;
    if(kind==="ring"){const a=i/n*TAU;e.x=cx+Math.cos(a)*360;e.y=cy+Math.sin(a)*360;}
    if(kind==="crescent"){const a=-1.25+i/(n-1)*2.5;e.x=cx+Math.cos(a)*430;e.y=cy+Math.sin(a)*430;}
    if(kind==="funnel"){e.x=cx+(i-(n-1)/2)*70;e.y=cy-480-Math.abs(i-(n-1)/2)*20;}
    if(kind==="spear"){e.x=cx+(i-(n-1)/2)*45;e.y=cy-500-i*18;}
    if(kind==="crossfire"){e.x=i%2?cx+520:cx-520;e.y=cy+(i-Math.floor(n/2))*75;}
    if(kind==="pursuit"){e.x=cx+(Math.random()-.5)*700;e.y=cy+(Math.random()-.5)*700;}
  }
}

function fireArrow(){
  const p=world.player, charge=clamp(p.draw,0,1);
  const perfect=p.drawTime>=PERFECT_START && p.drawTime<=PERFECT_END;
  const crit=perfect || Math.random()<p.critChance;
  if(perfect){world.perfects++; world.rings.push({x:p.x,y:p.y,r:p.r+6,life:.3,max:.3,perfect:true});}
  const speed=perfect?920:720+charge*180;
  const chainMult=p.chain?1+Math.min(p.chainCount,10)*.04:1;
  const damage=p.drawDamage*(.72+charge*.65)*(crit?(p.critDamage||2.15):1)*chainMult;
  const shots=1+p.multi;
  for(let i=0;i<shots;i++){
    const spread=(i-(shots-1)/2)*.055;
    const aa=p.aim+spread;
    world.arrows.push({x:p.x+Math.cos(aa)*20,y:p.y+Math.sin(aa)*20,
    vx:Math.cos(aa)*speed,vy:Math.sin(aa)*speed,life:p.range/speed,
    damage,pierce:p.pierce,hit:new Set(),crit,angle:aa,r:2*p.arrowSize,elemental:true});
  }
  world.arrowCount++;
  if(crit){world.crits++; world.shake=Math.max(world.shake,4); burst(p.x+Math.cos(p.aim)*26,p.y+Math.sin(p.aim)*26,9,1.8);}
  if(p.windstep){p.dashX=Math.cos(p.aim);p.dashY=Math.sin(p.aim); p.windTimer=.25;}
  p.shotClock=1/p.fireRate;
  if(perfect && p.heaven) rainArrows(p.x+Math.cos(p.aim)*260,p.y+Math.sin(p.aim)*260,4);
  p.draw=0; p.drawTime=0;
}

// Queued on the world (not setTimeout) so the volley respects pause and level-up.
function rainArrows(x,y,n=4){
  for(let i=0;i<n;i++) world.pendingRain.push({x,y,delay:i*.07});
}
function updateRain(dt){
  const w=world;
  for(const r of w.pendingRain){
    r.delay-=dt;
    if(r.delay>0) continue;
    const ox=r.x+(Math.random()-.5)*180,oy=r.y+(Math.random()-.5)*180;
    w.arrows.push({x:ox,y:oy-280,vx:0,vy:520,life:.65,damage:w.player.drawDamage*1.4,pierce:1,hit:new Set(),crit:true,angle:Math.PI/2,r:4});
    burst(ox,oy,5,1.1);
  }
  w.pendingRain=w.pendingRain.filter(r=>r.delay>0);
}
function dash(){
  const p=world.player;
  if(p.dashCooldown>0) return;
  const dx=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
  const dy=(keys.has("KeyS")?1:0)-(keys.has("KeyW")?1:0);
  const len=Math.hypot(dx,dy)||1;
  p.dashX=dx/len || Math.cos(p.aim); p.dashY=dy/len || Math.sin(p.aim);
  p.dash=.14; p.dashCooldown=1.15; p.invuln=Math.max(p.invuln,.24);
  burst(p.x,p.y,14,1.1);
  if(p.phantom){ for(let i=0;i<2+(p.phantomPower?1:0);i++){ const aa=p.aim+(i-1)*.12; world.arrows.push({x:p.x,y:p.y,vx:Math.cos(aa)*820,vy:Math.sin(aa)*820,life:.72,damage:p.drawDamage*.65,pierce:p.pierce,hit:new Set(),crit:false,angle:aa,r:3*p.arrowSize,elemental:true,phantom:true}); } }
}

function burst(x,y,n,power=1){
  for(let i=0;i<n;i++){const a=Math.random()*TAU,s=(30+Math.random()*100)*power;
    world.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.35,max:.7,r:1+Math.random()*2});}
}

function onKill(e){
  if(e.dead) return;
  const w=world,p=w.player;
  e.dead=true; w.kills++;
  if(p.chain){p.chainCount=Math.min(20,p.chainCount+1);p.chainTimer=2.5;}
  if(p.predator) p.predatorTimer=1.6;
  gainXp(e.xp||1); burst(e.x,e.y,12,1.4);
}

function hurtPlayer(amount,source){
  const p=world.player;
  if(p.invuln>0) return false;
  p.hp-=amount; world.lastHitBy=source;
  return true;
}

function gainXp(n){
  world.xp+=n;
  if(world.xp>=world.nextXp && state==="playing"){
    world.xp-=world.nextXp; world.level++; world.nextXp=Math.floor(world.nextXp*1.22+3);
    openLevelUp();
  }
}

function checkEvolutions(){
  const p=world.player;
  const evo=(id,name,fn)=>{if(world.evolutions.has(id))return;world.evolutions.add(id);fn();world.evolutionLog.push(name);world.flash=.35;world.shake=12;burst(p.x,p.y,32,2.5);showEvolution(name);};
  // Thresholds need 2+ deliberate picks each, so evolutions feel earned rather than incidental.
  if(p.multi>=2 && p.fireRate>=4.1) evo("barrage","BARRAGE",()=>{p.multi+=2;p.fireRate*=1.18;});
  if(p.pierce>=2 && p.range>=800 && p.drawDamage>=40) evo("worldpiercer","WORLDPIERCER",()=>{p.pierce=99;p.drawDamage*=1.35;p.range=1100;});
  if(p.critChance>=.32 && p.range>=750) evo("deadshot","DEADSHOT",()=>{p.critChance+=.25;p.critDamage=Math.max(p.critDamage||2.15,2.6);p.drawDamage*=1.2;});
  if(p.ember && p.critChance>=.14) evo("hellfire","HELLFIRE",()=>{p.ember=true;p.critDamage=Math.max(p.critDamage||2.15,3.2);});
  if(p.storm && p.multi>=1) evo("thunderstorm","THUNDERSTORM",()=>{p.storm=true;p.stormPower=2.5;});
  if(p.phantom && p.windstep) evo("phantomhunt","PHANTOM HUNT",()=>{p.multi+=1;p.phantomPower=3;});
}
function openLevelUp(){
  state="levelup"; levelup.classList.remove("hidden");
  upgradeCards.innerHTML="";
  buildReadout.innerHTML=["LEVEL "+world.level,"ARROWS ×"+(1+world.player.multi),"PIERCE "+world.player.pierce,"CRIT "+Math.round(world.player.critChance*100)+"%"].map(x=>"<span>"+x+"</span>").join("")+(world.evolutions.size?Array.from(world.evolutions).map(x=>"<span class=\"evo\">"+x.toUpperCase()+"</span>").join(""):"");
  const available=upgrades.filter(u=>!(u.once && world.taken.includes(u.id)));
  const choices=[...available].sort(()=>Math.random()-.5).slice(0,3);
  for(const u of choices){
    const el=document.createElement("button"); el.className="card";
    el.innerHTML=`<b>${u.name}</b><span>${u.desc}</span>`;
    el.onclick=()=>{
      u.apply(world.player); world.taken.push(u.id);
      levelup.classList.add("hidden"); checkEvolutions(); state="playing";
      gainXp(0); // chain into the next level-up if several were banked at once
    };
    upgradeCards.appendChild(el);
  }
}

function showEvolution(name){
  const t=document.createElement("div"); t.className="evolution-toast";
  t.textContent="EVOLUTION — "+name;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2200);
}

function update(dt){
  const w=world,p=w.player;
  w.time+=dt; p.aim=Math.atan2(mouse.y-p.y,mouse.x-p.x);
  p.shotClock=Math.max(0,p.shotClock-dt); p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  if(p.windTimer) p.windTimer=Math.max(0,p.windTimer-dt);
  p.invuln=Math.max(0,p.invuln-dt);
  if(p.predatorTimer) p.predatorTimer=Math.max(0,p.predatorTimer-dt);
  if(p.chainTimer){p.chainTimer=Math.max(0,p.chainTimer-dt); if(!p.chainTimer)p.chainCount=0;}
  let mx=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
  let my=(keys.has("KeyS")?1:0)-(keys.has("KeyW")?1:0);
  const len=Math.hypot(mx,my)||1;
  if(p.dash>0){p.dash-=dt; p.x+=p.dashX*720*dt; p.y+=p.dashY*720*dt;}
  else {
    let sp=p.speed*(p.windTimer>0?1.35:1)*(p.predatorTimer>0?1.25:1);
    p.x+=mx/len*sp*dt; p.y+=my/len*sp*dt;
  }
  p.x=clamp(p.x,30,innerWidth-30); p.y=clamp(p.y,30,innerHeight-30);

  if(mouse.down && p.shotClock<=0){
    p.drawTime+=dt;
    p.draw=clamp(p.drawTime/DRAW_TIME,0,1);
  }
  if(!mouse.down && p.draw>0){ fireArrow(); }
  updateRain(dt);
  w.spawnClock-=dt; w.formationClock-=dt;
  if(w.time>=1140 && !w.bossSpawned){ spawnBoss(); w.bossSpawned=true; }
  // Spawning is governed by maxActive; the interval floor just smooths refills.
  const targetRate=Math.max(.22,1.65-w.time*.075);
  const maxActive=Math.floor(12+Math.min(168,w.time*0.15));
  if(w.spawnClock<=0){
    const eliteChance=Math.min(.16,Math.max(0,(w.time-150)/900));
    if(w.enemies.length<maxActive) spawnEnemy(null,Math.random()<eliteChance);
    if(w.time>90&&w.enemies.length<maxActive&&Math.random()<.08)spawnEnemy(null,Math.random()<.25);
    w.spawnClock=targetRate;
  }
  // Formations are set pieces on their own clock, and only when there's room for them.
  if(w.formationClock<=0){
    if(w.enemies.length+10<=maxActive+8) spawnFormation(pick(["crescent","funnel","spear","ring","crossfire","pursuit"]));
    w.formationClock=Math.max(14,32-w.time/60)+Math.random()*8;
  }
  if(Math.floor(w.time/60)!==Math.floor((w.time-dt)/60)) w.snapshots.push({t:Math.round(w.time),level:w.level,hp:Math.round(p.hp),kills:w.kills,enemies:w.enemies.length});
  if(Math.floor(w.time/60)!==Math.floor((w.time-dt)/60)&&w.time>180){
    const event=pick(["migration","hunt","bloodmoon","quiet"]);w.event=event;w.eventTimer=event==="quiet"?18:12;
    if(event==="migration")spawnFormation("pursuit");
    if(event==="hunt")spawnEnemy("hunter",true);
    if(event==="bloodmoon")w.bloodMoon=12;
    if(event==="quiet")p.hp=Math.min(100,p.hp+25);
  }
  if(w.eventTimer)w.eventTimer=Math.max(0,w.eventTimer-dt);
  if(w.bloodMoon)w.bloodMoon=Math.max(0,w.bloodMoon-dt);

  for(const a of w.arrows){
    a.r = a.r ?? 2;
    a.x+=a.vx*dt;a.y+=a.vy*dt;a.life-=dt;
    for(const e of w.enemies){
      if(a.life<=0) break;
      if(e.dead || e.burrowing>0 || a.hit.has(e.id)) continue;
      if(Math.hypot(a.x-e.x,a.y-e.y)<a.r+e.r+4){
        a.hit.add(e.id);
        let mult=1;
        if(e.hp/e.maxHp<.2 && p.executioner) mult*=1.5;
        if(e.armor) mult*=1-e.armor;
        if(e.marked) mult*=1.3;
        e.hp-=a.damage*mult;e.hitFlash=.08;
        if(p.ember)e.burn=1.2;
        if(p.frost)e.slow=1.4;
        if(p.venom)e.poison=2.2;
        if(p.bleed)e.bleed=.9; applyArrowElement(e);
        burst(e.x,e.y,a.crit?8:4,a.crit?1.5:.7);
        w.shake=Math.max(w.shake,a.crit?5:2);
        if(e.hp<=0) onKill(e);
        else if(a.pierce<=0){a.life=0;} else a.pierce--;
      }
    }
  }
  w.arrows=w.arrows.filter(a=>a.life>0 && a.x>-80&&a.x<innerWidth+80&&a.y>-80&&a.y<innerHeight+80);
  for(const b of w.enemyArrows){
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(Math.hypot(b.x-p.x,b.y-p.y)<b.r+p.r && hurtPlayer(18,b.source||"arrow")){ b.life=0; p.invuln=.35; w.flash=Math.max(w.flash,.22); burst(p.x,p.y,8,1.2); }
  }
  w.enemyArrows=w.enemyArrows.filter(b=>b.life>0 && b.x>-80&&b.x<innerWidth+80&&b.y>-80&&b.y<innerHeight+80);
  if(w.boss){
    const b=w.boss, a=Math.atan2(p.y-b.y,p.x-b.x);
    b.x+=Math.cos(a)*b.speed*dt; b.y+=Math.sin(a)*b.speed*dt;
    b.phase=b.hp>b.maxHp*.66?1:b.hp>b.maxHp*.33?2:3;
    b.shotClock-=dt;
    if(b.phase===3){b.charge+=dt;if(b.charge>.9){fireBossArrow();b.charge=0;b.shotClock=.72;}}
    else if(b.shotClock<=0){fireBossArrow();b.shotClock=Math.max(.42,(b.phase===2?.82:1.2)-w.time/2200);}
    if(b.hitFlash)b.hitFlash-=dt;
    if(Math.hypot(b.x-p.x,b.y-p.y)<b.r+p.r+4 && hurtPlayer(24*dt,"THE HUNTMASTER")){w.flash=Math.max(w.flash,.18);}
  }
  if(w.boss){
    for(const a of w.arrows){
      if(a.life>0 && Math.hypot(a.x-w.boss.x,a.y-w.boss.y)<a.r+w.boss.r){
        w.boss.hp-=a.damage*(w.boss.phase===3?1.2:1); w.boss.hitFlash=.08; a.life=0;
        burst(w.boss.x,w.boss.y,a.crit?8:4,a.crit?1.4:.7); w.shake=Math.max(w.shake,a.crit?5:2);
      }
    }
  }
  for(const e of w.enemies){
    if(e.burrowing>0){
      // Submerged: untouchable, telegraphed by a ring at the exit point (see drawBurrowWarning).
      e.burrowing-=dt;
      if(e.burrowing<=0){e.x=e.burrowX;e.y=e.burrowY;burst(e.x,e.y,14,1.3);w.shake=Math.max(w.shake,3);}
      continue;
    }
    const a=Math.atan2(p.y-e.y,p.x-e.x);
    const sp=e.speed*(e.type==="wolf"?1.12:1)*(e.slow?0.55:1);
    e.x+=Math.cos(a)*sp*dt;e.y+=Math.sin(a)*sp*dt;
    if(e.spawnGrace>0){e.spawnGrace-=dt; e.x=e.spawnX; e.y=e.spawnY; continue;}
    if(e.bleed){e.bleed-=dt;e.hp-=7*dt;}
    if(e.regen)e.hp=Math.min(e.maxHp,e.hp+e.regen*dt);
    if(e.burn){e.burn-=dt;e.hp-=11*dt;}
    if(e.poison){e.poison-=dt;e.hp-=8*dt;}
    if(e.slow)e.slow=Math.max(0,e.slow-dt);
    if(e.type==="hunter"&&e.shotClock<=0){const aa=Math.atan2(p.y-e.y,p.x-e.x);w.enemyArrows.push({x:e.x,y:e.y,vx:Math.cos(aa)*300,vy:Math.sin(aa)*300,life:3,r:5,source:"HUNTER"});e.shotClock=2.1;}
    if(e.type==="burrower"){
      e.burrowCd=(e.burrowCd??3+Math.random()*3)-dt;
      if(e.burrowCd<=0){
        const ba=Math.random()*TAU,bd=150+Math.random()*80;
        e.burrowX=clamp(p.x+Math.cos(ba)*bd,30,innerWidth-30); e.burrowY=clamp(p.y+Math.sin(ba)*bd,30,innerHeight-30);
        e.burrowing=.9; e.burrowCd=4+Math.random()*3; burst(e.x,e.y,10,1);
        continue;
      }
    }
    e.shotClock-=dt;
    if(e.marked)e.marked=Math.max(0,e.marked-dt);

    if(e.hitFlash)e.hitFlash-=dt;
    if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r && hurtPlayer(e.damage*dt,(e.elite?e.eliteType.toUpperCase()+" ":"")+e.type.toUpperCase())){
      w.flash=Math.max(w.flash,.18);
    }
  }
  // Damage-over-time and chain lightning kills get credited here.
  for(const e of w.enemies) if(e.hp<=0) onKill(e);
  w.enemies=w.enemies.filter(e=>!e.dead);
  for(const r of w.rings){r.life-=dt;r.r+=120*dt;} w.rings=w.rings.filter(r=>r.life>0);
  for(const q of w.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.96;q.vy*=.96;q.life-=dt;}
  w.particles=w.particles.filter(q=>q.life>0);
  w.shake=Math.max(0,w.shake-dt*18); w.flash=Math.max(0,w.flash-dt);
  if(p.hp<=0) finish(false, w.lastHitBy||"unknown");
  else if(w.boss && w.boss.hp<=0) finish(true, null);
  else if(w.time>=1230) finish(false, "time");
  hudUpdate();
}

function spawnBoss(){
  const side=Math.floor(Math.random()*4), pad=120;
  const x=side===0?pad:side===1?innerWidth-pad:Math.random()*innerWidth;
  const y=side===2?pad:side===3?innerHeight-pad:Math.random()*innerHeight;
  world.boss={type:"huntmaster",x,y,r:34,hp:1650,maxHp:1650,speed:58,shotClock:1.2,phase:1,hitFlash:0,charge:0};
  world.rings.push({x:innerWidth/2,y:innerHeight/2,r:40,life:1.8,max:1.8,boss:true});
}

function fireBossArrow(){
  const b=world.boss,p=world.player;
  const a=Math.atan2(p.y-b.y,p.x-b.x);
  for(let i=-1;i<=1;i++){
    const aa=a+i*.12;
    world.enemyArrows.push({x:b.x,y:b.y,vx:Math.cos(aa)*360,vy:Math.sin(aa)*360,life:3,r:6,source:"THE HUNTMASTER"});
  }
}

function saveMeta(){localStorage.setItem("arrowfall-meta",JSON.stringify(meta));}
function finish(win,cause){
  if(state==="results")return;
  meta.kills+=world.kills;if(win)meta.wins++;meta.bestTime=Math.max(meta.bestTime,world.time);meta.bestKills=Math.max(meta.bestKills,world.kills);saveMeta();
  logRun(win?"victory":"death",cause);
  state="results"; results.classList.remove("hidden");
  document.querySelector("#result-title").textContent=win?"HUNT COMPLETE":"THE HUNTER FALLS";
  document.querySelector("#result-cause").textContent=win?"THE HUNTMASTER IS SLAIN":cause==="time"?"THE HUNTMASTER ESCAPED":"FELLED BY "+String(cause).toUpperCase()+" AT "+fmt(world.time);
  document.querySelector("#result-time").textContent=fmt(world.time);
  document.querySelector("#result-kills").textContent=world.kills;
  document.querySelector("#result-crits").textContent=world.perfects;
  document.querySelector("#result-arrows").textContent=world.arrowCount;
}

// Local playtest telemetry: one record per run, exportable from Options.
function loadRuns(){try{return JSON.parse(localStorage.getItem(RUN_LOG_KEY)||"[]");}catch{return [];}}
function logRun(outcome,cause){
  const w=world,p=w.player;
  const runs=loadRuns();
  runs.push({
    date:new Date().toISOString(), outcome, cause, time:Math.round(w.time), level:w.level, kills:w.kills,
    hp:Math.max(0,Math.round(p.hp)), arrows:w.arrowCount, perfects:w.perfects, crits:w.crits,
    picks:w.taken, evolutions:[...w.evolutions], snapshots:w.snapshots, debugUsed:w.debugUsed
  });
  try{localStorage.setItem(RUN_LOG_KEY,JSON.stringify(runs.slice(-100)));}catch{}
}
function exportRuns(){
  const blob=new Blob([JSON.stringify(loadRuns(),null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="arrowfall-playtest-"+new Date().toISOString().slice(0,10)+".json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function hudUpdate(){
  const w=world,p=w.player;
  document.querySelector("#timer").textContent=fmt(w.time);
  document.querySelector("#kill-count").textContent=`${w.kills} HUNTED`;
  const drawState=p.drawTime>PERFECT_END?"over":p.drawTime>=PERFECT_START?"perfect":p.draw>0?"drawing":"";
  const meter=document.querySelector("#draw-meter");
  meter.querySelector("i").style.width=(p.draw*100)+"%";
  meter.className=drawState;
  document.querySelector("#shot-state").textContent={over:"OVERDRAWN",perfect:"PERFECT — RELEASE",drawing:"DRAWING"}[drawState]||"QUICK SHOT";
  document.querySelector("#level").textContent=w.level;
  document.querySelector("#xp-text").textContent=`${Math.floor(w.xp)} / ${w.nextXp}`;
  document.querySelector("#xp-fill").style.width=(w.xp/w.nextXp*100)+"%";
  document.querySelector("#dash-ready").textContent=p.dashCooldown<=0?"DASH READY":`DASH ${p.dashCooldown.toFixed(1)}`;
  document.querySelector("#health-fill").style.width=clamp(p.hp/100,0,1)*100+"%";
  document.querySelector("#health-text").textContent=Math.max(0,Math.ceil(p.hp))+" HP";
  document.querySelector("#event-banner").textContent=w.eventTimer?({"migration":"THE MIGRATION","hunt":"THE HUNT","bloodmoon":"BLOOD MOON","quiet":"QUIET GROVE"}[w.event]||""):"";
  if(DEBUG) document.querySelector("#hint").textContent="DEBUG  ]  +2:00   \\  BOSS   L  LEVEL   H  HEAL";
  if(w.boss){bossHud.classList.remove("hidden");document.querySelector("#boss-fill").style.width=clamp(w.boss.hp/w.boss.maxHp,0,1)*100+"%";document.querySelector("#boss-phase").textContent="PHASE "+(["I","II","III"][w.boss.phase-1]||"I");}else bossHud.classList.add("hidden");
}

function draw(){
  if (!world || !world.player) return;
  const w=world,p=w.player;
  ctx.save();
  const sx=(Math.random()-.5)*w.shake,sy=(Math.random()-.5)*w.shake;ctx.translate(sx,sy);
  const g=ctx.createRadialGradient(p.x,p.y,20,p.x,p.y,Math.max(innerWidth,innerHeight)*.75);
  g.addColorStop(0,"#14281d");g.addColorStop(.48,"#0a1710");g.addColorStop(1,"#030706");ctx.fillStyle=g;ctx.fillRect(-20,-20,innerWidth+40,innerHeight+40);
  drawForest();
  for(const r of w.rings){ctx.globalAlpha=clamp(r.life/r.max,0,1);ctx.strokeStyle=r.boss?"#ff806f":r.perfect?"#fff2a8":"#9dffbd";ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,TAU);ctx.stroke();}ctx.globalAlpha=1;
  for(const e of w.enemies) e.burrowing>0?drawBurrowWarning(e):drawEnemy(e);
  for(const a of w.arrows) drawArrow(a);
  for(const b of w.enemyArrows) drawEnemyArrow(b);
  if(w.boss) drawBoss(w.boss);
  for(const q of w.particles){ctx.globalAlpha=clamp(q.life/q.max,0,1);ctx.fillStyle="#baffcf";ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,TAU);ctx.fill();}ctx.globalAlpha=1;
  drawPlayer(p);
  ctx.restore();
  if(w.flash){ctx.fillStyle=`rgba(255,70,60,${w.flash*.25})`;ctx.fillRect(0,0,innerWidth,innerHeight);}
}

function drawForest(){
  const cell=96;
  ctx.globalAlpha=.16;ctx.strokeStyle="#4a7955";ctx.lineWidth=1;
  for(let x=-cell;x<innerWidth+cell;x+=cell)for(let y=-cell;y<innerHeight+cell;y+=cell){const n=(x*13+y*7)%29;if(n<10){ctx.beginPath();ctx.arc(x+30,y+42,18+(n%7),0,TAU);ctx.stroke();}}
  ctx.globalAlpha=.14;ctx.fillStyle="#3d704c";
  for(let i=0;i<42;i++){const x=(i*173)%innerWidth,y=(i*97)%innerHeight,r=10+(i%5)*5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
  ctx.globalAlpha=.22;ctx.strokeStyle="#79a884";ctx.lineWidth=3;
  const landmarks=[[innerWidth*.18,innerHeight*.24,"SHRINE"],[innerWidth*.78,innerHeight*.25,"TOWER"],[innerWidth*.20,innerHeight*.76,"CAMP"],[innerWidth*.80,innerHeight*.75,"GROVE"],[innerWidth*.50,innerHeight*.50,"CLEARING"]];
  for(const [x,y,label] of landmarks){ctx.beginPath();ctx.arc(x,y,label==="CLEARING"?70:42,0,TAU);ctx.stroke();if(label!=="CLEARING"){ctx.beginPath();ctx.moveTo(x-18,y);ctx.lineTo(x+18,y);ctx.moveTo(x,y-18);ctx.lineTo(x,y+18);ctx.stroke();}ctx.font="700 8px Inter, sans-serif";ctx.textAlign="center";ctx.fillStyle="rgba(180,235,194,.28)";ctx.fillText(label,x,y+58);}
  ctx.globalAlpha=.08;ctx.fillStyle="#b7f3c7";ctx.beginPath();ctx.arc(innerWidth*.5,innerHeight*.5,Math.min(innerWidth,innerHeight)*.43,0,TAU);ctx.fill();ctx.globalAlpha=1;
}



function drawBurrowWarning(e){
  const t=1-clamp(e.burrowing/.9,0,1);
  ctx.save();ctx.translate(e.burrowX,e.burrowY);
  ctx.globalAlpha=.35+.45*t;ctx.strokeStyle="#ff9a6b";ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,e.r+18-14*t,0,TAU);ctx.stroke();
  ctx.globalAlpha=.25*t;ctx.fillStyle="#ff9a6b";ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);ctx.fill();
  ctx.restore();
}

function drawPlayer(p){
  if(p.drawTime>=PERFECT_START && p.drawTime<=PERFECT_END){
    ctx.save();ctx.strokeStyle="#fff2a8";ctx.lineWidth=2;ctx.shadowBlur=16;ctx.shadowColor="#fff2a8";
    ctx.beginPath();ctx.arc(p.x,p.y,p.r+9,0,TAU);ctx.stroke();ctx.restore();
  }
  ctx.save();
  ctx.translate(p.x,p.y);
  if(p.invuln>0) ctx.globalAlpha=.55;
  ctx.rotate(p.aim);
  const moving = keys.has("KeyW")||keys.has("KeyA")||keys.has("KeyS")||keys.has("KeyD");
  ctx.shadowBlur=18; ctx.shadowColor="#9dffbd";
  ctx.fillStyle="#d9f5df";
  ctx.beginPath(); ctx.arc(0,0,p.r,0,TAU); ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle="#183323";
  ctx.beginPath(); ctx.arc(-3,-3,7,0,TAU); ctx.fill();
  ctx.strokeStyle="#baffcf"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(4,-10); ctx.lineTo(4,10); ctx.stroke();
  ctx.strokeStyle="#f1f7e9"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(5,-13); ctx.quadraticCurveTo(18,0,5,13); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6,-12); ctx.lineTo(27,0); ctx.lineTo(6,12); ctx.stroke();
  if(moving){ctx.globalAlpha=.25;ctx.fillStyle="#9dffbd";ctx.beginPath();ctx.arc(-16,0,7,0,TAU);ctx.fill();}
  ctx.restore();
}

function drawArrow(a){
  ctx.save();
  ctx.translate(a.x,a.y); ctx.rotate(a.angle ?? Math.atan2(a.vy,a.vx));
  const glow=a.crit?"#fff2a8":a.phantom?"#c7a8ff":world.player.ember?"#ff9a5c":world.player.storm?"#9ddcff":"#d9f5df";
  ctx.shadowBlur=a.crit?20:10;ctx.shadowColor=glow;
  ctx.strokeStyle=glow;ctx.lineWidth=a.r>3?3:2;
  ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(13,0);ctx.stroke();
  ctx.fillStyle=glow;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(6,-4);ctx.lineTo(6,4);ctx.closePath();ctx.fill();
  ctx.restore();
}

function drawEnemy(e){
  ctx.save(); ctx.translate(e.x,e.y);
  ctx.globalAlpha=e.spawnGrace>0?clamp(1-e.spawnGrace/.45,0,1):1;
  ctx.shadowBlur=e.elite?14:5;ctx.shadowColor=e.elite?"#ffb36b":"#6f9b78";
  const colors={crawler:"#718d73",wolf:"#91a77d",brute:"#9b765b",shield:"#7896a0",wisp:"#9bb8cf",hunter:"#c7a76b",burrower:"#8c705f",mimic:"#b08a68"};
  ctx.fillStyle=colors[e.type]||"#829b86";
  ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);ctx.fill();
  if(e.type==="shield"){ctx.fillStyle="#273c35";ctx.fillRect(-e.r,-e.r*.8,e.r*1.4,e.r*1.6);}
  if(e.type==="wisp"){ctx.globalAlpha*=.8;ctx.strokeStyle="#d2efff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.r+5,0,TAU);ctx.stroke();}
  if(e.type==="hunter"){ctx.strokeStyle="#f0d18a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.stroke();}
  if(e.elite){ctx.globalAlpha=1;ctx.strokeStyle="#ffb36b";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.r+4,0,TAU);ctx.stroke();}
  if(e.hitFlash){ctx.globalAlpha=1;ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(0,0,e.r+2,0,TAU);ctx.fill();}
  ctx.restore();
  if(e.hp<e.maxHp){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2,3);ctx.fillStyle="#baffcf";ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2*clamp(e.hp/e.maxHp,0,1),3);}
}

function drawEnemyArrow(b){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));
  ctx.shadowBlur=12;ctx.shadowColor="#ff7f73";ctx.strokeStyle="#ffb0a7";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.stroke();ctx.restore();
}

function drawBoss(b){
  ctx.save();ctx.translate(b.x,b.y);
  ctx.shadowBlur=30;ctx.shadowColor="#ff806f";
  ctx.fillStyle=b.hitFlash?"#fff":"#3a1d1d";ctx.strokeStyle="#ff9a8f";ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(0,0,b.r,0,TAU);ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle="#ffd2a8";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-16,-18);ctx.lineTo(18,18);ctx.moveTo(-18,18);ctx.lineTo(16,-18);ctx.stroke();
  if(b.phase===3){ctx.globalAlpha=.35+.25*Math.sin(performance.now()/80);ctx.strokeStyle="#ff6f62";ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,b.r+10,0,TAU);ctx.stroke();}
  ctx.restore();
}

function loop(now){
  if(!world || !["playing","levelup"].includes(state)) return;
  const dt=Math.min(.033,(now-last)/1000||0); last=now;
  if(state==="playing") update(dt);
  draw();
  raf=requestAnimationFrame(loop);
}

function togglePause(){
  if(state==="playing"){state="paused";pause.classList.remove("hidden");}
  else if(state==="paused"){state="playing";pause.classList.add("hidden");last=performance.now();raf=requestAnimationFrame(loop);}
}

document.querySelector("#play-button").addEventListener("click",start);
document.querySelector("#restart-button").addEventListener("click",start);
document.querySelector("#resume-button").addEventListener("click",()=>{if(state==="paused")togglePause();});
document.querySelector("#quit-button").addEventListener("click",()=>{
  if(world&&(state==="paused"||state==="playing"||state==="levelup"))logRun("abandoned","quit");
  if(world){state="menu";pause.classList.add("hidden");hud.classList.add("hidden");bossHud.classList.add("hidden");results.classList.add("hidden");}
  titleScreen.classList.remove("hidden");titleScreen.classList.add("active");
});
document.querySelector("#menu-panel-close").addEventListener("click",()=>{
  menuPanel.classList.add("hidden");
});
document.querySelectorAll(".menu-panel-btn").forEach(btn=>btn.addEventListener("click",()=>{
  const panel=btn.dataset.panel;
  menuPanelTitle.textContent=panel==="arsenal"?"ARSENAL":panel==="log"?"HUNTER'S LOG":"OPTIONS";
  if(panel==="arsenal") menuPanelBody.innerHTML="<div class='log-grid'><div><b>THE BOW</b><span>Quick, drawn, and perfect releases.</span></div><div><b>WINDSTEP</b><span>Fire to move with the wind.</span></div><div><b>PHANTOM STEP</b><span>Dash to send spectral arrows.</span></div><div><b>PERFECT DRAW</b><span>Release inside the bright window for a critical shot.</span></div></div>";
  else if(panel==="log") menuPanelBody.innerHTML="<div class='log-grid'>"+["CRAWLER","WOLF","BRUTE","SHIELDBEARER","WISP","HUNTER","BURROWER","MIMIC","THE HUNTMASTER","BARRAGE","WORLDPIERCER","DEADSHOT","HELLFIRE","THUNDERSTORM","PHANTOM HUNT"].map(x=>"<div><b>"+x+"</b><span>ENCOUNTERED</span></div>").join("")+"</div>";
  else menuPanelBody.innerHTML="<div class='log-grid'><div><b>CONTROLS</b><span>WASD move • Mouse aim • Hold/release fire • Space dash • P / Esc pause.</span></div><div><b>HIGH CONTRAST</b><span><button id='contrast-toggle' class='secondary'>TOGGLE</button></span></div><div><b>PROFILE</b><span>"+meta.runs+" hunts • "+meta.wins+" victories • "+meta.kills+" total hunted</span></div><div><b>PLAYTEST LOG</b><span>"+loadRuns().length+" runs recorded <button id='export-runs' class='secondary'>EXPORT</button> <button id='clear-runs' class='secondary'>CLEAR</button></span></div></div>";
  menuPanel.classList.remove("hidden");
  const contrast=document.querySelector("#contrast-toggle");
  const exp=document.querySelector("#export-runs"); if(exp) exp.onclick=exportRuns;
  const clr=document.querySelector("#clear-runs"); if(clr) clr.onclick=()=>{if(confirm("Clear all recorded playtest runs?")){localStorage.removeItem(RUN_LOG_KEY);btn.click();}};
  if(contrast) contrast.onclick=()=>{document.body.classList.toggle("high-contrast");localStorage.setItem("arrowfall-contrast",document.body.classList.contains("high-contrast")?"1":"0");};
}));
if(localStorage.getItem("arrowfall-contrast")==="1")document.body.classList.add("high-contrast");

addEventListener("mousemove",e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
addEventListener("mousedown",e=>{if(e.button===0 && state==="playing")mouse.down=true;});
addEventListener("mouseup",e=>{if(e.button===0){mouse.down=false;if(state==="playing"&&world?.player?.draw>0)fireArrow();}});
addEventListener("keydown",e=>{
  if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;
  if(e.code==="Escape"||e.code==="KeyP"){e.preventDefault();if(state==="playing"||state==="paused")togglePause();return;}
  if(e.code==="Space"){e.preventDefault();if(state==="playing")dash();return;}
  if(DEBUG && state==="playing" && debugKey(e.code)) return;
  keys.add(e.code);
});
addEventListener("keyup",e=>keys.delete(e.code));

// Playtest shortcuts. Active in `npm run dev` or with ?debug in the URL; flagged in the run log.
function debugKey(code){
  const w=world,p=w.player;
  if(code==="BracketRight"){w.time=Math.min(1139,w.time+120);}
  else if(code==="Backslash"){w.time=Math.max(w.time,1137);}
  else if(code==="KeyL"){w.xp=w.nextXp;gainXp(0);}
  else if(code==="KeyH"){p.hp=100;}
  else return false;
  w.debugUsed=true; return true;
}

window.addEventListener("error",e=>{
  console.error("Arrowfall runtime error:",e.error||e.message);
  if(state==="playing"||state==="levelup"){
    state="paused"; pause.classList.remove("hidden");
    document.querySelector("#hint").textContent="A runtime error was caught. Reload to reset the hunt.";
  }
});
if(DEBUG) window.arrowfall={get world(){return world;}};
