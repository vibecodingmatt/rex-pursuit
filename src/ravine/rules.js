import {AMBUSH_SITES,ROAD_SPEED,GATE,gateZ,hash,smooth,shoulderHeight} from './route.js';
import {RavineArcade} from './arcade.js';
export const RAVINE={duration:86,escape:6,magazine:80,reload:2.6,fireInterval:.085,grenadeCooldown:11,maxActors:18};
export const sectionAt=t=>t<27?0:t<57?1:2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class RavineRound{
 constructor(){this.arcade=new RavineArcade();this.reset();}
 reset(){this.arcade.reset();Object.assign(this,{time:0,phase:'chase',result:null,jeep:100,ammo:80,reload:0,heat:0,shotTimer:0,grenade:0,kills:0,shots:0,hits:0,escapeTime:0,nextSpawn:2.6,waveLeft:0,serial:0,attackers:[],events:[],cheated:false,infiniteAmmo:false,infiniteRockets:false,coverUsed:new Map()});}
 get remaining(){return Math.max(0,RAVINE.duration-this.time);}
 get live(){return this.attackers.filter(a=>!['dead','gone','shattered','withdrawn'].includes(a.phase));}
 tick(dt){if(dt<=0||this.result)return;let left=dt;while(left>1e-8&&!this.result){const h=Math.min(left,1/60);this.advance(h);left-=h;}}
 deadStep(a,dt){a.age+=dt;a.deadSpeed=Math.max(0,a.deadSpeed-dt*(a.death.explosive?16:11));a.z+=(ROAD_SPEED-a.deadSpeed)*dt;a.x+=a.death.direction[0]*Math.exp(-a.age*2)*dt*(a.death.explosive?3:.7);if(a.age>9||a.z>115)a.phase='gone';}
 extract(dt){
  this.escapeTime+=dt;const barrier=gateZ(this.escapeTime);
  for(const a of this.attackers){
   if(a.phase==='dead'){this.deadStep(a,dt);continue;}if(a.phase==='shattered'){a.age+=dt;if(a.age>7)a.phase='gone';continue;}a.age+=dt;a.flash=0;
   if(a.phase==='retreat'||a.phase==='withdrawn'){const x=a.x,z=a.z;if(a.phase==='retreat')this.withdrawal(a,(RAVINE.duration+this.escapeTime)*ROAD_SPEED);else{a.z+=dt*ROAD_SPEED;if(a.hidden)a.phase='gone';}this.heading(a,x,z,dt);continue;}
   if(a.airY>0||a.airV>0){a.airV-=dt*12;a.airY=Math.max(0,a.airY+a.airV*dt);}
   if(a.phase==='gate-run'&&a.z-barrier<10.3){a.phase='gate-brake';a.age=0;a.brakeSpeed=a.motionSpeed;this.events.push({type:'brake',id:a.id});}
   if(a.phase==='gate-brake'){a.motionSpeed=Math.max(0,a.brakeSpeed*(1-smooth(a.age,0,.72)));if(a.age>=.72){a.phase='gate-hold';a.age=0;a.motionSpeed=0;}}
   a.z+=(ROAD_SPEED-a.motionSpeed)*dt;
   // Nose stays on the far side of the barrier, including a last-second leaper.
   a.z=Math.max(a.z,barrier+4.6);a.groundY=shoulderHeight(a.x);
  }
  this.attackers=this.attackers.filter(a=>a.phase!=='gone');
  if(this.escapeTime-dt<GATE.closeEnd&&this.escapeTime>=GATE.closeEnd)this.events.push({type:'gate-sealed'});
  if(this.escapeTime>=RAVINE.escape){this.result='won';this.events.push({type:'won'});}
 }
 beginEscape(){
  this.phase='escape';
  for(const a of this.live){if(a.phase==='retreat')continue;a.airY=a.phase==='leap'?1.3*Math.sin(Math.PI*clamp(a.age/.68,0,1)):0;a.airV=a.phase==='leap'?1.3*Math.PI/.68*Math.cos(Math.PI*clamp(a.age/.68,0,1)):0;a.phase='gate-run';a.age=0;a.motionSpeed=12;}
  this.events.push({type:'escape'});
 }
 advance(dt){
  this.arcade.tick(dt);
  if(this.phase==='escape'){this.extract(dt);return;}
  const before=sectionAt(this.time);this.time=Math.min(RAVINE.duration,this.time+dt);if(sectionAt(this.time)!==before)this.events.push({type:'section',section:sectionAt(this.time)});
  for(const k of ['shotTimer','grenade'])this[k]=Math.max(0,this[k]-dt);this.heat=Math.max(0,this.heat-dt*.21);
  if(this.reload>0){this.reload=Math.max(0,this.reload-dt);if(!this.reload){this.ammo=RAVINE.magazine;this.events.push({type:'loaded'});}}
  if(this.time>=RAVINE.duration){this.beginEscape();return;}
  const section=sectionAt(this.time),limit=[6,7,8][section];
  if(this.time>=this.nextSpawn&&this.time<82&&this.live.length<limit&&this.attackers.length<RAVINE.maxActors){
   if(!this.waveLeft)this.waveLeft=section===0?2:3;
   if(this.spawn()){this.waveLeft--;this.nextSpawn=this.time+(this.waveLeft ? .4+hash(this.serial)*.2 : [3.7,3.15,2.5][section]);}else this.nextSpawn=this.time+.2;
  }
  for(const a of this.attackers){
   if(a.phase==='dead'){this.deadStep(a,dt);continue;}if(a.phase==='shattered'){a.age+=dt;if(a.age>7)a.phase='gone';continue;}if(a.phase==='gone')continue;
   const oldX=a.x,oldZ=a.z;a.age+=dt;a.flash=Math.max(0,a.flash-dt);
   if(a.phase==='emerge'){
    const u=smooth(a.age,0,1.45);a.x=a.cover.x+a.side*1.3+(a.side*4.8-a.cover.x-a.side*1.3)*u;a.z=a.cover.z+this.time*ROAD_SPEED+7-3*u;
    if(a.age>=1.45){a.phase='run';a.age=0;}
   }else if(a.phase==='run'){
    a.z=Math.max(9,a.z-dt*(8.1+section*.95+hash(a.id)*.9));a.x+=(a.lane+Math.sin(this.time*1.4+a.seed)*.18-a.x)*(1-Math.exp(-dt*1.9));
    if(a.z<=9){a.phase='warn';a.age=0;this.events.push({type:'warn',id:a.id});}
   }else if(a.phase==='warn'){
    a.x+=(a.lane-a.x)*(1-Math.exp(-dt*3));
    if(a.age>=a.warning){a.phase='leap';a.age=0;a.fromX=a.x;this.events.push({type:'leap',id:a.id});}
   }else if(a.phase==='leap'){
    const u=clamp(a.age/.68,0,1),f=u*u*(3-2*u);a.z=9-5.5*f;a.x=a.fromX+(Math.sign(a.lane||a.side)*1.55-a.fromX)*f;
    if(u===1){this.damage(19);this.retreat(a);this.events.push({type:'strike',id:a.id});}
   }else if(a.phase==='retreat')this.withdrawal(a,this.time*ROAD_SPEED);
   else if(a.phase==='withdrawn'){a.z+=dt*ROAD_SPEED;if(a.hidden)a.phase='gone';}
   this.heading(a,oldX,oldZ,dt);
  }
  this.attackers=this.attackers.filter(a=>a.phase!=='gone');
 }
 heading(a,x,z,dt){const vx=(a.x-x)/dt,vz=(a.z-z)/dt-ROAD_SPEED;a.motionSpeed=Math.min(19,Math.hypot(vx,vz));const facing=Math.atan2(-vx,-vz);let bank=0;if(a.motionSpeed>.1){const turn=Math.atan2(Math.sin(facing-a.yaw),Math.cos(facing-a.yaw));a.yaw+=turn*(1-Math.exp(-dt*7));bank=clamp(turn*.3,-.18,.18);}a.bank=(a.bank||0)+(bank-(a.bank||0))*(1-Math.exp(-dt*9));a.groundY=shoulderHeight(a.x);}
 withdrawal(a,travel){const e=a.exit,u=smooth(a.age,0,3.8),cross=smooth(u,.38,.82),pull=smooth(u,0,.55);a.x=e.x+(e.side*5.2-e.x)*pull+(e.cover.x+e.side*1.35-e.side*5.2)*cross;a.z=travel+e.z+(e.cover.z+9-e.z)*pull+3*smooth(u,.7,1);if(a.age>=3.8){a.phase='withdrawn';a.age=0;a.hidden=false;}}
 retreat(a){
  const travel=this.time*ROAD_SPEED,side=Math.sign(a.x)||a.side;
  const cover=AMBUSH_SITES.filter(s=>s.side===side&&s.z>GATE.at-3&&s.z+travel>a.z-17&&s.z+travel<a.z+12).sort((s,t)=>Math.abs(s.z+travel-a.z+5)-Math.abs(t.z+travel-a.z+5))[0]||a.cover;
  a.exit={x:a.x,z:a.z-travel,side,cover};a.phase='retreat';a.age=0;
 }
 spawn(){
  if(this.attackers.length>=RAVINE.maxActors)return false;
  const id=this.serial+1,side=id%2?1:-1,travel=this.time*ROAD_SPEED;
  const cover=AMBUSH_SITES.filter(s=>s.side===side&&s.z+travel>23&&s.z+travel<57&&this.time-(this.coverUsed.get(s.id)??-100)>2.5).sort((a,b)=>Math.abs(a.z+travel-39)-Math.abs(b.z+travel-39))[0];
  if(!cover)return false;this.serial=id;this.coverUsed.set(cover.id,this.time);
  const lanes=[-3.8,-1.9,0,1.9,3.8],rank=lanes.map(lane=>({lane,n:this.live.filter(a=>Math.abs(a.lane-lane)<.8).length+hash(id+lane)*.2})).sort((a,b)=>a.n-b.n),section=sectionAt(this.time);
  const x=cover.x+side*1.3;
  this.attackers.push({id,side,lane:rank[0].lane,x,z:cover.z+travel+7,groundY:shoulderHeight(x),cover,hp:180,maxHp:180,phase:'emerge',age:0,flash:0,seed:id*.71,yaw:0,motionSpeed:0,warning:[1.5,1.28,1.08][section]});this.events.push({type:'spawn',id});return true;
 }
 shoot(){const powered=this.infiniteAmmo||this.arcade.turbo>0;if(this.result||this.phase!=='chase'||this.shotTimer>0||this.reload>0||(!this.ammo&&!powered)||(this.heat>=.98&&!powered))return false;this.shotTimer=this.arcade.turbo>0?.05:RAVINE.fireInterval;this.shots++;if(powered)this.heat=0;else{this.ammo--;this.heat=Math.min(1,this.heat+.027);}if(!this.ammo&&!powered)this.startReload();return true;}
 activateTurbo(){if(this.result||this.phase!=='chase'||!this.arcade.activate())return false;this.ammo=RAVINE.magazine;this.reload=this.heat=this.shotTimer=0;this.events.push({type:'turbo'});return true;}
 startReload(){if(this.result||this.phase!=='chase'||this.infiniteAmmo||this.reload>0||this.ammo===80)return false;this.reload=RAVINE.reload;this.events.push({type:'reload'});return true;}
 launchGrenade(){if(this.result||this.phase!=='chase'||this.grenade>0&&!this.infiniteRockets)return false;this.grenade=this.infiniteRockets?0:RAVINE.grenadeCooldown;return true;}
 hit(id,{head=false,explosive=false,direct=false,direction=[0,0,1]}={}){const a=this.attackers.find(a=>a.id===id);if(this.result||this.phase!=='chase'||!a||['dead','gone','shattered'].includes(a.phase))return false;this.hits++;a.hp=Math.max(0,a.hp-(explosive?230:(head?32:20)*(this.arcade.turbo>0?1.6:1)));a.flash=.16;if(a.hp===0){const award=this.arcade.kill({head,explosive,air:a.phase==='leap'});a.death={head,explosive,direct,direction,airV:a.phase==='leap'?1.3*Math.PI/.68*Math.cos(Math.PI*clamp(a.age/.68,0,1)):0};a.deadSpeed=Math.min(13,a.motionSpeed);a.phase=explosive&&direct?'shattered':'dead';a.age=0;this.kills++;this.events.push({type:'kill',id,award});return true;}return false;}
 damage(n){if(this.result||this.phase!=='chase')return;this.arcade.damage();this.jeep=Math.max(0,this.jeep-n);this.events.push({type:'damage'});if(!this.jeep){this.result='lost';this.events.push({type:'lost'});}}
 drain(){return this.events.splice(0);}
}
