import * as T from 'three';
import {PRESSURE} from './rules.js';
const smooth=t=>t*t*(3-2*t),active=a=>a.c.on&&a.c.state!=='dead';
/** Overlapping packs, two independent landing slots, and a heavy ground ram.
 * Attack warnings buy reaction time; they do not stop the rest of the pack. */
export function createBreachDirector(critters,round,{onCue=()=>{},onLand=()=>{},onHit=()=>{},random=Math.random}={}){
 let next=3,serial=0,previousWave=0;const actors=[],last=new T.Vector3();
 const stats={spawned:0,peak:0,raptors:0,rams:0};
 function prune(){for(let i=actors.length-1;i>=0;i--)if(!actors[i].c.on)actors.splice(i,1);}
 function change(a,phase){a.phase=phase;a.age=0;a.from.copy(a.c.p);if(['windup','leap','charge'].includes(phase))onCue(phase,a);}
 function spawn(lane=serial%3,species='raptor'){
  prune();
  const heavy=species==='pachycephalosaurus',side=lane===0?-1:lane===2?1:(serial%2?-1:1);
  const c=critters.huntSpawn(species,side,32);if(!c)return null;serial++;
  const pressure=PRESSURE[round.wave]||PRESSURE[1];
  c.p.set(lane===1?side*1.1:side*5.1,0,34+random()*2);c.scale=(heavy?4.3:2.9)+random()*.2;c.yaw=Math.PI;c.state='flee';c.hp=heavy?10:5;c.stride=0;c.flinch=0;c.curl=0;c.v.set(0,0,0);c.roll=0;c.peck=0;c.fade=0;c.phase=random();c.tint.setRGB(.94+random()*.1,1,.94);c.vigor=.95+random()*.1;c.cadence=.95+random()*.1;
  const a={c,lane,side,heavy,phase:'approach',age:0,life:0,duration:pressure.approach+(heavy?.8:random()*.35),from:c.p.clone(),windup:new T.Vector3(side*(heavy?2.7:lane===1?.7:1.85),0,heavy?13:7.7+random()*.8),landing:new T.Vector3(side*(heavy?1.9:.65),heavy?0:1.08,heavy?4.15:3.05),retreat:new T.Vector3(side*(heavy?5:3.7),0,heavy?19:11),bites:0,counted:false};
  actors.push(a);stats.spawned++;stats[heavy?'rams':'raptors']++;stats.peak=Math.max(stats.peak,actors.filter(active).length);onCue('spawn',a);return a;
 }
 function kill(a,trap=false){if(a.counted)return;a.counted=true;round.killed({trap,onJeep:a.phase==='board',heavy:a.heavy});onCue('killed',a);}
 function update(dt,{spawnEnabled=true,speed=0}={}){
  if(dt<=0){critters.updateDirected(0);return;}prune();
  if(round.phase==='hold'&&!round.result&&spawnEnabled){
   const wave=round.wave,p=PRESSURE[wave];
   if(wave!==previousWave){previousWave=wave;if(wave>0&&wave<4)onCue('wave',wave);}
   if(p&&round.time>=next&&actors.filter(active).length<p.limit){
    const heavy=round.time>19&&serial%6===4&&!actors.some(a=>active(a)&&a.heavy);
    if(spawn(serial%3,heavy?'pachycephalosaurus':'raptor'))next=round.time+p.interval*(.87+random()*.26);else next=round.time+.3;
   }
  }
  for(const a of actors){const c=a.c;if(!c.on)continue;if(c.state==='dead'){kill(a);continue;}
   if(round.result||round.phase==='escape'){c.p.z+=speed*dt;c.stride=.15;continue;}
   a.age+=dt;a.life+=dt;c.fade=Math.min(1,a.life/.65);last.copy(c.p);c.curl=0;c.peck=0;c.roll=0;
   if(a.phase==='approach'){
    const u=Math.min(1,a.age/a.duration);c.p.lerpVectors(a.from,a.windup,smooth(u));c.p.x+=Math.sin(u*Math.PI)*a.side*.45;c.stride=Math.min(1,.6+Math.sin(u*Math.PI)*.4);
    if(u>=1)change(a,'windup');
   }else if(a.phase==='windup'){
    c.stride=.12;c.peck=a.heavy?.38:.24;
    const occupied=!a.heavy&&actors.some(o=>o!==a&&active(o)&&!o.heavy&&o.side===a.side&&['leap','board'].includes(o.phase));
    if(a.age>(a.heavy?1.35:.95)&&!occupied)change(a,a.heavy?'charge':'leap');
   }else if(a.phase==='charge'){
    const u=Math.min(1,a.age/1.05);c.p.lerpVectors(a.from,a.landing,u*u);c.stride=1;c.peck=.4;
    if(u>=1){round.damage(20,'pachycephalosaurus');onLand(c.p,.9);onCue('ram',a);change(a,'recover');}
   }else if(a.phase==='recover'){
    c.stride=.08;c.peck=.32*(1-Math.min(1,a.age/.6));if(a.age>.65)change(a,'retreat');
   }else if(a.phase==='leap'){
    const u=Math.min(1,a.age/.76);c.p.lerpVectors(a.from,a.landing,u);c.p.y+=Math.sin(u*Math.PI)*1.4;c.curl=-Math.sin(Math.PI*u)*.85;c.stride=.1;c.peck=-.08;c.phase=.25;
    if(u>=1){change(a,'board');onLand(c.p,.4);}
   }else if(a.phase==='board'){
    c.stride=.08;c.peck=.05+Math.max(0,Math.sin((a.age-.6)*5))*.16;c.p.y=a.landing.y+Math.sin(a.age*5)*.012;
    if(a.age>=1.05+a.bites*1.25){a.bites++;round.damage(10,'raptor');onCue('bite',a);}
    if(a.bites>=3)change(a,'retreat');
   }else if(a.phase==='retreat'){
    const u=Math.min(1,a.age/(a.heavy?2:1.1));c.p.lerpVectors(a.from,a.retreat,smooth(u));if(!a.heavy)c.p.y+=Math.sin(u*Math.PI)*.7;c.stride=.85;
    if(u>=1){a.bites=0;a.duration=a.heavy?2.4:2;change(a,'approach');}
   }
   c.v.subVectors(c.p,last).divideScalar(dt);
   const facing=a.phase==='retreat'?Math.atan2(a.retreat.x-a.from.x,a.retreat.z-a.from.z):Math.atan2(-c.p.x*.35,Math.min(-.1,1.2-c.p.z));
   const turn=Math.atan2(Math.sin(facing-c.yaw),Math.cos(facing-c.yaw));c.yaw+=T.MathUtils.clamp(turn,-dt*9,dt*9);
   c.phase=(c.phase+dt*(a.phase==='approach'||a.phase==='charge'||a.phase==='retreat'?1.9:.35)*c.cadence)%1;
  }
  critters.updateDirected(dt,{speed});
 }
 return {actors,stats,spawn,update,
  reset(){critters.reset({empty:true});actors.length=0;next=3;serial=0;previousWave=0;for(const k in stats)stats[k]=0;},
  hit(ray,far=Infinity){return critters.hit(ray,far,0);},
  strike(hit,dir,damage=1){const c=hit.critter,a=actors.find(a=>a.c===c&&active(a));if(!a)return false;const dead=critters.strike(c,dir,1,damage);onHit(hit.point,dir,{dead,heavy:a.heavy});if(dead){c.v.x+=a.side*3.4;kill(a);}return dead;},
  blast(at,radius=5.5){let killed=0;for(const a of actors){if(!active(a))continue;const c=a.c,centre=c.p.clone();centre.y+=c.kind.centre*c.scale;const d=centre.distanceTo(at);if(d>radius+1)continue;
   const dir=centre.clone().sub(at).setY(.3).normalize(),damage=d<radius?12:5,dead=critters.strike(c,dir,2.6,damage);onHit(centre,dir,{dead,explosive:true,heavy:a.heavy});if(dead){c.v.addScaledVector(dir,5);c.vy+=2;kill(a);killed++;}}return killed;},
  discharge(){let n=0;for(const a of actors){const c=a.c;if(!active(a)||c.p.z<6||c.p.z>27||Math.abs(c.p.x)>8)continue;if(critters.kill(c,new T.Vector3(a.side,.25,.3),1.5)){kill(a,true);n++;}}return n;},
  get warning(){return actors.filter(a=>active(a)&&['windup','leap','board','charge'].includes(a.phase)).sort((a,b)=>({board:0,charge:1,leap:2,windup:3}[a.phase]-{board:0,charge:1,leap:2,windup:3}[b.phase])||b.age-a.age)[0]||null;},
  get live(){return actors.filter(active);}
 };
}
