import * as T from 'three';
const lerp=T.MathUtils.lerp,smooth=t=>t*t*(3-2*t);
/** Three authored lanes keep every attack within the mounted gun's arc. The
 * warning, leap and first bite are separate states, with time to react on touch. */
export function createBreachDirector(critters,round,{onCue=()=>{},onLand=()=>{},random=Math.random}={}){
 let next=7,serial=0,previousWave=0;const actors=[],last=new T.Vector3();
 function change(a,phase){a.phase=phase;a.age=0;a.from.copy(a.c.p);if(phase==='windup')onCue('windup',a);if(phase==='leap')onCue('leap',a);}
 function spawn(lane=serial++%3){
  const c=critters.huntSpawn('raptor',lane===0?-1:1,29);if(!c)return null;
  const side=lane===0?-1:lane===2?1:(random()<.5?-1:1),x=lane===1?side*.9:side*6.6,z=lane===1?31:28;
  c.p.set(x,0,z);c.scale=2.9+random()*.2;c.yaw=Math.PI;c.state='flee';c.hp=5;c.stride=0;c.flinch=0;c.curl=0;c.v.set(0,0,0);c.roll=0;c.peck=0;c.fade=1;c.phase=random();c.tint.setRGB(.94+random()*.1,1,.94);c.vigor=1;c.cadence=.95+random()*.1;
  const a={c,lane,side,phase:'approach',age:0,duration:round.wave===3?4.6:round.wave===2?5.4:6.2,from:c.p.clone(),windup:new T.Vector3(side*(lane===1?.6:1.65),0,7.6+random()*.7),landing:new T.Vector3(side*.58,1.08,3.05),bites:0,lastBite:0,counted:false};actors.push(a);onCue('spawn',a);return a;
 }
 function kill(a,trap=false){if(a.counted)return;a.counted=true;round.killed({trap,onJeep:a.phase==='board'});onCue('killed',a);}
 function update(dt,{spawnEnabled=true,speed=0}={}){
  if(dt<=0){critters.updateDirected(0);return;}
  // Remove expired references before reusing their pooled creature objects.
  for(let i=actors.length-1;i>=0;i--)if(!actors[i].c.on)actors.splice(i,1);
  if(round.phase==='hold'&&!round.result&&spawnEnabled){
   const wave=round.wave;
   if(wave!==previousWave){previousWave=wave;if(wave>0&&wave<4)onCue('wave',wave);}
   const live=actors.filter(a=>a.c.on&&a.c.state!=='dead').length,limit=wave===1?2:3;
   if(wave>0&&wave<4&&round.time>=next&&live<limit){if(spawn())next=round.time+(wave===3?3.5:wave===2?4.5:6.1)+random()*1.1;else next=round.time+.5;}
  }
  for(let i=actors.length-1;i>=0;i--){const a=actors[i],c=a.c;if(!c.on){actors.splice(i,1);continue;}if(c.state==='dead'){kill(a);continue;}
   if(round.result||round.phase==='escape'){c.p.z+=speed*dt;c.stride=.15;continue;}
   a.age+=dt;last.copy(c.p);c.curl=0;c.peck=0;c.roll=0;
   if(a.phase==='approach'){
    const u=Math.min(1,a.age/a.duration),t=smooth(u);c.p.lerpVectors(a.from,a.windup,t);c.p.x+=Math.sin(u*Math.PI)*a.side*.45;
    c.stride=Math.min(1,.55+Math.sin(u*Math.PI)*.45);
    if(u>=1)change(a,'windup');
   }else if(a.phase==='windup'){
    c.stride=.12;c.peck=.22;const occupied=actors.some(o=>o!==a&&o.c.on&&o.c.state!=='dead'&&['leap','board'].includes(o.phase));
    if(a.age>1.25&&!occupied)change(a,'leap');
   }else if(a.phase==='leap'){
    const u=Math.min(1,a.age/.83);c.p.lerpVectors(a.from,a.landing,u);c.p.y+=Math.sin(u*Math.PI)*1.4;c.curl=-Math.sin(Math.PI*u)*.85;c.stride=.1;c.peck=-.08;c.phase=.25;
    if(u>=1){change(a,'board');a.lastBite=0;onLand(c.p,1);}
   }else if(a.phase==='board'){
    c.stride=.08;c.peck=.05+Math.max(0,Math.sin((a.age-.8)*5))*.16;c.p.y=a.landing.y+Math.sin(a.age*5)*.012;
    // A landed attacker stares down the barrel before its first strike.
    if(a.age>=1.4+a.bites*1.6){a.bites++;round.damage(14,'raptor');onCue('bite',a);}
    if(a.bites>=3)change(a,'retreat');
   }else if(a.phase==='retreat'){
    const u=Math.min(1,a.age/1.1);c.p.lerpVectors(a.from,new T.Vector3(a.side*3,0,10),u);c.p.y+=Math.sin(u*Math.PI)*.7;c.stride=.8;
    if(u>=1){a.bites=0;a.windup.set(a.side*1.65,0,7.8);a.duration=3.2;change(a,'approach');}
   }
   c.v.subVectors(c.p,last).divideScalar(dt);c.yaw=Math.atan2(-c.p.x,Math.min(-.1,1.2-c.p.z));c.phase=(c.phase+dt*(a.phase==='approach'?1.7:.35)*c.cadence)%1;
  }
  critters.updateDirected(dt,{speed});
 }
 return {actors,spawn,update,
  reset(){critters.reset({empty:true});actors.length=0;next=7;serial=0;previousWave=0;},
  hit(ray,far=Infinity){return critters.hit(ray,far,0);},
  strike(hit,dir,damage=1){const c=hit.critter,a=actors.find(a=>a.c===c);if(!a)return false;const dead=critters.strike(c,dir,1,damage);if(dead){c.v.x+=a.side*3.4;kill(a);}return dead;},
  blast(at,radius=5){let killed=0;for(const a of actors){if(!a.c.on||a.c.state==='dead')continue;const c=a.c,d=c.p.distanceTo(at);if(d>radius+1)continue;const dir=new T.Vector3(a.side,.2,1).normalize();if(critters.strike(c,dir,1.8,5)){kill(a);killed++;}}return killed;},
  discharge(){let n=0;for(const a of actors){const c=a.c;if(!c.on||c.state==='dead'||c.p.z<6||c.p.z>23||Math.abs(c.p.x)>8)continue;if(critters.kill(c,new T.Vector3(a.side,.25,.3),1.5)){kill(a,true);n++;}}return n;},
  get warning(){return actors.filter(a=>a.c.on&&a.c.state!=='dead'&&['windup','leap','board'].includes(a.phase)).sort((a,b)=>({board:0,leap:1,windup:2}[a.phase]-{board:0,leap:1,windup:2}[b.phase]))[0]||null;},
  get live(){return actors.filter(a=>a.c.on&&a.c.state!=='dead');}
 };
}
