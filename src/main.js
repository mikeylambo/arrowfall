import "./../styles.css";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const titleScreen = document.querySelector("#title-screen");
const hud = document.querySelector("#hud");
const levelup = document.querySelector("#levelup");
const results = document.querySelector("#results");
const upgradeCards = document.querySelector("#upgrade-cards");

const TAU = Math.PI * 2;
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
  {id:"barbed",name:"BARBED ARROW",desc:"Arrows cause bleed.",apply:p=>p.bleed=true},
  {id:"wind",name:"WINDSTEP",desc:"Firing boosts movement briefly.",apply:p=>p.windstep=true},
  {id:"multi",name:"FLETCHER'S CRAFT",desc:"+1 arrow per shot.",apply:p=>p.multi+=1},
  {id:"ember",name:"EMBER ARROW",desc:"Arrows ignite targets.",apply:p=>p.ember=true},
  {id:"frost",name:"FROST ARROW",desc:"Arrows slow targets.",apply:p=>p.frost=true},
  {id:"storm",name:"STORM ARROW",desc:"Hits can chain lightning.",apply:p=>p.storm=true},
  {id:"venom",name:"VENOM ARROW",desc:"Hits poison targets.",apply:p=>p.venom=true},
  {id:"broad",name:"BROADShaft",desc:"+40% arrow hitbox.",apply:p=>p.arrowSize*=1.4},
  {id:"executioner",name:"EXECUTIONER",desc:"+50% damage to enemies below 20% health.",apply:p=>p.executioner=true},
  {id:"predator",name:"PREDATOR",desc:"Kills briefly increase movement speed.",apply:p=>p.predator=true},
  {id:"chain",name:"CHAIN KILL",desc:"Consecutive kills build damage.",apply:p=>p.chain=true},
  {id:"mark",name:"HUNTER'S MARK",desc:"Marked enemies take +30% damage.",apply:p=>p.mark=true},
  {id:"phantom",name:"PHANTOM STEP",desc:"Dash creates a spectral arrow.",apply:p=>p.phantom=true},
  {id:"heaven",name:"HEAVEN'S CALL",desc:"Perfect Draws rain arrows.",apply:p=>p.heaven=true}
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
  mouse.down=false;
  keys.clear();
  state="playing";
  titleScreen.classList.remove("active"); titleScreen.classList.add("hidden");
  results.classList.add("hidden"); levelup.classList.add("hidden"); hud.classList.remove("hidden");
  world = {
    time:0, kills:0, arrows:[], arrowCount:0, crits:0, xp:0, level:1, nextXp:10, paused:false,
    shake:0, flash:0, spawnClock:0, enemyId:0,
    player:{x:innerWidth/2,y:innerHeight/2,r:15,speed:235,aim:0,hp:100,fireRate:3.1,shotClock:0,draw:0,drawDamage:30,
       pierce:0,critChance:.05,range:620,bleed:false,windstep:false,multi:0,ember:false,frost:false,storm:false,venom:false,arrowSize:1,executioner:false,predator:false,chain:false,mark:false,phantom:false,heaven:false,chainCount:0,windTimer:0,dash:0,dashCooldown:0,dashX:0,dashY:0},
    enemies:[], enemyArrows:[], particles:[], rings:[], trails:[], boss:null, bossSpawned:false
  };
  last=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
}

function applyArrowElement(e){
  const p=world.player;
  if(p.mark && Math.random()<.18)e.marked=3;
  if(p.storm && Math.random()<.22){
    const targets=world.enemies.filter(t=>t!==e&&Math.hypot(t.x-e.x,t.y-e.y)<150).slice(0,2);
    for(const t of targets){t.hp-=12;burst(t.x,t.y,7,1.4);}
  }
}
function spawnEnemy(){
  const angle=Math.random()*TAU;
  const radius=Math.max(innerWidth,innerHeight)*.62+Math.random()*220;
  const x=world.player.x+Math.cos(angle)*radius, y=world.player.y+Math.sin(angle)*radius;
  const roll=Math.random();
  const enemy = roll<.14
    ? {type:"wolf",r:10,hp:30,maxHp:30,speed:115,damage:10}
    : roll<.22
    ? {type:"brute",r:17,hp:90,maxHp:90,speed:45,damage:18}
    : {type:"crawler",r:11,hp:24,maxHp:24,speed:62,damage:8};
  enemy.x=x; enemy.y=y; enemy.id=world.enemyId++;
  world.enemies.push(enemy);
}

function fireArrow(){
  const p=world.player, charge=clamp(p.draw,0,1);
  const perfect=charge>.88;
  const crit=perfect || Math.random()<p.critChance;
  const speed=perfect?920:720+charge*180;
  const damage=p.drawDamage*(.72+charge*.65)*(crit?2.15:1);
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
  p.draw=0;
}

function rainArrows(x,y,n=4){
  for(let i=0;i<n;i++) setTimeout(()=>{if(!world||state!=="playing")return; const ox=x+(Math.random()-.5)*180,oy=y+(Math.random()-.5)*180; world.arrows.push({x:ox,y:oy-280,vx:0,vy:520,life:.65,damage:world.player.drawDamage*1.4,pierce:1,hit:new Set(),crit:true,angle:Math.PI/2,r:4}); burst(ox,oy,5,1.1);},i*70);
}
function dash(){
  const p=world.player;
  if(p.dashCooldown>0) return;
  const dx=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
  const dy=(keys.has("KeyS")?1:0)-(keys.has("KeyW")?1:0);
  const len=Math.hypot(dx,dy)||1;
  p.dashX=dx/len || Math.cos(p.aim); p.dashY=dy/len || Math.sin(p.aim);
  p.dash=.14; p.dashCooldown=1.15;
  burst(p.x,p.y,14,1.1);
}

function burst(x,y,n,power=1){
  for(let i=0;i<n;i++){const a=Math.random()*TAU,s=(30+Math.random()*100)*power;
    world.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.35,max:.7,r:1+Math.random()*2});}
}

function gainXp(n){
  world.xp+=n;
  if(world.xp>=world.nextXp){
    world.xp-=world.nextXp; world.level++; world.nextXp=Math.floor(world.nextXp*1.22+3);
    openLevelUp();
  }
}

function openLevelUp(){
  state="levelup"; levelup.classList.remove("hidden");
  upgradeCards.innerHTML="";
  const choices=[...upgrades].sort(()=>Math.random()-.5).slice(0,3);
  for(const u of choices){
    const el=document.createElement("button"); el.className="card";
    el.innerHTML=`<b>${u.name}</b><span>${u.desc}</span>`;
    el.onclick=()=>{u.apply(world.player); levelup.classList.add("hidden"); state="playing";};
    upgradeCards.appendChild(el);
  }
}

function update(dt){
  const w=world,p=w.player;
  w.time+=dt; p.aim=Math.atan2(mouse.y-p.y,mouse.x-p.x);
  p.shotClock=Math.max(0,p.shotClock-dt); p.dashCooldown=Math.max(0,p.dashCooldown-dt);
  if(p.windTimer) p.windTimer=Math.max(0,p.windTimer-dt);
  let mx=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
  let my=(keys.has("KeyS")?1:0)-(keys.has("KeyW")?1:0);
  const len=Math.hypot(mx,my)||1;
  if(p.dash>0){p.dash-=dt; p.x+=p.dashX*720*dt; p.y+=p.dashY*720*dt;}
  else {
    let sp=p.speed*(p.windTimer>0?1.35:1);
    p.x+=mx/len*sp*dt; p.y+=my/len*sp*dt;
  }
  p.x=clamp(p.x,30,innerWidth-30); p.y=clamp(p.y,30,innerHeight-30);

  if(mouse.down && p.shotClock<=0){
    p.draw=clamp(p.draw+dt/0.72,0,1);
    if(p.draw>=1) p.shotClock=0;
  }
  if(!mouse.down && p.draw>0){ fireArrow(); }
  w.spawnClock-=dt;
  if(w.time>=1140 && !w.bossSpawned){ spawnBoss(); w.bossSpawned=true; }
  const targetRate=Math.max(.055,.52-w.time*.012);
  if(w.spawnClock<=0){spawnEnemy(); if(w.time>25&&Math.random()<.15) spawnEnemy(); w.spawnClock=targetRate;}

  for(const a of w.arrows){
    a.r = a.r ?? 2;
    a.x+=a.vx*dt;a.y+=a.vy*dt;a.life-=dt;
    for(const e of w.enemies){
      if(a.hit.has(e.id)) continue;
      if(Math.hypot(a.x-e.x,a.y-e.y)<a.r+e.r+4){
        a.hit.add(e.id);
        let mult=1;
        if(e.hp/e.maxHp<.2 && p.executioner) mult*=1.5;
        if(e.marked) mult*=1.3;
        e.hp-=a.damage*mult;e.hitFlash=.08;
        if(p.ember)e.burn=1.2;
        if(p.frost)e.slow=1.4;
        if(p.venom)e.poison=2.2;
        if(p.bleed)e.bleed=.9; applyArrowElement(e);
        burst(e.x,e.y,a.crit?8:4,a.crit?1.5:.7);
        w.shake=Math.max(w.shake,a.crit?5:2);
        if(e.hp<=0){w.kills++;p.chainCount=p.chain?Math.min(20,p.chainCount+1):0;if(p.predator)p.speed=Math.min(380,p.speed+5);gainXp(e.type==="brute"?3:1); burst(e.x,e.y,12,1.4);}
        else if(a.pierce<=0){a.life=0;} else a.pierce--;
      }
    }
  }
  w.arrows=w.arrows.filter(a=>a.life>0 && a.x>-80&&a.x<innerWidth+80&&a.y>-80&&a.y<innerHeight+80);
  for(const b of w.enemyArrows){
    b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
    if(Math.hypot(b.x-p.x,b.y-p.y)<b.r+p.r){ p.hp-=18; b.life=0; w.flash=Math.max(w.flash,.22); burst(p.x,p.y,8,1.2); }
  }
  w.enemyArrows=w.enemyArrows.filter(b=>b.life>0 && b.x>-80&&b.x<innerWidth+80&&b.y>-80&&b.y<innerHeight+80);
  if(w.boss){
    const b=w.boss, a=Math.atan2(p.y-b.y,p.x-b.x);
    b.x+=Math.cos(a)*b.speed*dt; b.y+=Math.sin(a)*b.speed*dt;
    b.shotClock-=dt; if(b.shotClock<=0){fireBossArrow(); b.shotClock=Math.max(.48,1.2-w.time/1600);}
    if(b.hitFlash)b.hitFlash-=dt;
    if(Math.hypot(b.x-p.x,b.y-p.y)<b.r+p.r+4){p.hp-=24*dt;w.flash=Math.max(w.flash,.18);}
  }
  if(w.boss){
    for(const a of w.arrows){
      if(Math.hypot(a.x-w.boss.x,a.y-w.boss.y)<a.r+w.boss.r){
        w.boss.hp-=a.damage; w.boss.hitFlash=.08; a.life=0;
        burst(w.boss.x,w.boss.y,a.crit?8:4,a.crit?1.4:.7); w.shake=Math.max(w.shake,a.crit?5:2);
      }
    }
  }
  for(const e of w.enemies){
    const a=Math.atan2(p.y-e.y,p.x-e.x);
    const sp=e.speed*(e.type==="wolf"?1.12:1)*(e.slow?0.55:1);
    e.x+=Math.cos(a)*sp*dt;e.y+=Math.sin(a)*sp*dt;
    if(e.bleed){e.bleed-=dt;e.hp-=7*dt;}
    if(e.burn){e.burn-=dt;e.hp-=11*dt;}
    if(e.poison){e.poison-=dt;e.hp-=8*dt;}
    if(e.slow)e.slow=Math.max(0,e.slow-dt);
    if(e.marked)e.marked=Math.max(0,e.marked-dt);

    if(e.hitFlash)e.hitFlash-=dt;
    if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+p.r){
      p.hp-=e.damage*dt; w.flash=Math.max(w.flash,.18);
    }
  }
  w.enemies=w.enemies.filter(e=>e.hp>0);
  for(const r of w.rings){r.life-=dt;r.r+=120*dt;} w.rings=w.rings.filter(r=>r.life>0);
  for(const q of w.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.96;q.vy*=.96;q.life-=dt;}
  w.particles=w.particles.filter(q=>q.life>0);
  w.shake=Math.max(0,w.shake-dt*18); w.flash=Math.max(0,w.flash-dt);
  if(p.hp<=0) finish(false);
  if(w.boss && w.boss.hp<=0) finish(true);
  if(w.time>=1230) finish(false);
  hudUpdate();
}

function spawnBoss(){
  const side=Math.floor(Math.random()*4), pad=120;
  const x=side===0?pad:side===1?innerWidth-pad:Math.random()*innerWidth;
  const y=side===2?pad:side===3?innerHeight-pad:Math.random()*innerHeight;
  world.boss={type:"huntmaster",x,y,r:34,hp:1250,maxHp:1250,speed:58,shotClock:1.2,phase:1,hitFlash:0};
  world.rings.push({x:innerWidth/2,y:innerHeight/2,r:40,life:1.8,max:1.8,boss:true});
}

function fireBossArrow(){
  const b=world.boss,p=world.player;
  const a=Math.atan2(p.y-b.y,p.x-b.x);
  for(let i=-1;i<=1;i++){
    const aa=a+i*.12;
    world.enemyArrows.push({x:b.x,y:b.y,vx:Math.cos(aa)*360,vy:Math.sin(aa)*360,life:3,r:6});
  }
}

function finish(win){
  state="results"; results.classList.remove("hidden");
  document.querySelector("#result-title").textContent=win?"HUNT COMPLETE":"THE HUNTER FALLS";
  document.querySelector("#result-time").textContent=fmt(world.time);
  document.querySelector("#result-kills").textContent=world.kills;
  document.querySelector("#result-crits").textContent=world.crits;
  document.querySelector("#result-arrows").textContent=world.arrowCount;
}
function hudUpdate(){
  const w=world,p=w.player;
  document.querySelector("#timer").textContent=fmt(w.time);
  document.querySelector("#kill-count").textContent=`${w.kills} HUNTED`;
  document.querySelector("#draw-meter i").style.width=(p.draw*100)+"%";
  document.querySelector("#shot-state").textContent=p.draw>.88?"PERFECT DRAW":p.draw>0?"DRAWN SHOT":"QUICK SHOT";
  document.querySelector("#level").textContent=w.level;
  document.querySelector("#xp-text").textContent=`${Math.floor(w.xp)} / ${w.nextXp}`;
  document.querySelector("#xp-fill").style.width=(w.xp/w.nextXp*100)+"%";
  document.querySelector("#dash-ready").textContent=p.dashCooldown<=0?"DASH READY":`DASH ${p.dashCooldown.toFixed(1)}`;
}

function draw(){
  if (!world || !world.player) return;
  const w=world,p=w.player;
  ctx.save();
  const sx=(Math.random()-.5)*w.shake,sy=(Math.random()-.5)*w.shake;ctx.translate(sx,sy);
  const g=ctx.createRadialGradient(p.x,p.y,20,p.x,p.y,Math.max(innerWidth,innerHeight)*.75);
  g.addColorStop(0,"#14281d");g.addColorStop(.48,"#0a1710");g.addColorStop(1,"#030706");ctx.fillStyle=g;ctx.fillRect(-20,-20,innerWidth+40,innerHeight+40);
  drawForest();
  for(const r of w.rings){ctx.globalAlpha=clamp(r.life/r.max,0,1);ctx.strokeStyle=r.boss?"#ff806f":"#9dffbd";ctx.lineWidth=2;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,TAU);ctx.stroke();}ctx.globalAlpha=1;
  for(const e of w.enemies) drawEnemy(e);
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
  ctx.globalAlpha=.25;ctx.strokeStyle="#4a7955";ctx.lineWidth=1;
  for(let x=-cell;x<innerWidth+cell;x+=cell)for(let y=-cell;y<innerHeight+cell;y+=cell){
    const n=(x*13+y*7)%29; if(n<10){ctx.beginPath();ctx.arc(x+30,y+42,18+(n%7),0,TAU);ctx.stroke();}
  }
  ctx.globalAlpha=.18;ctx.fillStyle="#3d704c";
  for(let i=0;i<35;i++){const x=(i*173)%innerWidth,y=(i*97)%innerHeight,r=10+(i%5)*5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
}
function drawPlayer(p){
  const a=p.aim;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);
  ctx.fillStyle=p.dash>0?"#d9ffe5":"#a8efbe";ctx.shadowBlur=18;ctx.shadowColor="#67ff9b";
  ctx.beginPath();ctx.arc(0,0,p.r,0,TAU);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle="#e7fff0";ctx.lineWidth=3;ctx.beginPath();ctx.arc(4,0,17,-.95,.95);ctx.stroke();
  ctx.strokeStyle="#79c98f";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(4,-16);ctx.lineTo(4,16);ctx.stroke();
  ctx.restore();
}
function drawArrow(a){
  const glow=a.crit?"#fff1a8":a.elemental?"#9de9ff":"#d5ffe2";
  ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle);ctx.strokeStyle=glow;ctx.shadowBlur=a.crit?20:10;ctx.shadowColor=glow;ctx.lineWidth=a.crit?3:2;
  ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(14,0);ctx.stroke();ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(8,-4);ctx.moveTo(14,0);ctx.lineTo(8,4);ctx.stroke();ctx.restore();
}
function drawEnemyArrow(b){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));ctx.strokeStyle="#ffb0a8";ctx.shadowBlur=14;ctx.shadowColor="#ff6d62";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(10,0);ctx.stroke();ctx.restore();
}
function drawBoss(b){
  ctx.save();ctx.translate(b.x,b.y);ctx.fillStyle=b.hitFlash?"#fff5f0":"#6d3e4d";ctx.shadowBlur=28;ctx.shadowColor="#ff725f";ctx.beginPath();ctx.arc(0,0,b.r,0,TAU);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle="#ffd2c8";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,b.r+7,0,TAU);ctx.stroke();
  ctx.fillStyle="rgba(0,0,0,.6)";ctx.fillRect(-45,-52,90,5);ctx.fillStyle="#ff8578";ctx.fillRect(-45,-52,90*(b.hp/b.maxHp),5);ctx.restore();
}
function drawEnemy(e){
  ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle=e.hitFlash?"#effff3":e.type==="brute"?"#5e8d65":e.type==="wolf"?"#719d7b":"#426b4c";
  ctx.shadowBlur=8;ctx.shadowColor="#3fff82";ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);ctx.fill();ctx.shadowBlur=0;
  if(e.hp<e.maxHp){ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(-e.r,-e.r-7,e.r*2,2);ctx.fillStyle="#baffcf";ctx.fillRect(-e.r,-e.r-7,e.r*2*(e.hp/e.maxHp),2);}
  ctx.restore();
}

function loop(t){
  if (!world || (state !== "playing" && state !== "levelup")) return;
  const dt=Math.min(.033,(t-last)/1000);last=t;
  if(state==="playing") update(dt);
  if(state==="playing"||state==="levelup") draw();
  if(state==="playing"||state==="levelup") raf=requestAnimationFrame(loop);
}
function toWorldEvent(e){
  const r=canvas.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;
}
addEventListener("mousemove",toWorldEvent);
addEventListener("mousedown",e=>{if(e.button===0)mouse.down=true;});
addEventListener("mouseup",e=>{if(e.button===0)mouse.down=false;});
addEventListener("keydown",e=>{keys.add(e.code);if(e.code==="Space"){e.preventDefault();if(state==="playing")dash();}});
addEventListener("keyup",e=>keys.delete(e.code));
document.querySelector("#play-button").onclick=start;
document.querySelector("#restart-button").onclick=start;
