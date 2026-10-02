export const RAVINE={duration:86,escape:6,magazine:80,reload:2.6,fireInterval:.085,grenadeCooldown:11};
export const sectionAt=t=>t<27?0:t<57?1:2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Deterministic, bounded pack simulation. Graphics never decide damage or wins.
export class RavineRound{
 constructor(){this.reset();}
 reset(){Object.assign(this,{time:0,phase:'chase',result:null,jeep:100,ammo:80,reload:0,heat:0,shotTimer:0,grenade:0,kills:0,shots:0,hits:0,escapeTime:0,nextSpawn:3,serial:0,attackers:[],events:[],cheated:false,infiniteAmmo:false,infiniteRockets:false});}
 get remaining(){return Math.max(0,RAVINE.duration-this.time);}
 get live(){return this.attackers.filter(a=>a.phase!=='dead'&&a.phase!=='gone');}
 tick(dt){
  if(dt<=0||this.result)return;
  // Substeps preserve attack windows and exactly-once damage under slow frames.
  let left=dt;while(left>1e-8&&!this.result){const h=Math.min(left,1/60);this.advance(h);left-=h;}
 }
 advance(dt){
  if(this.phase==='escape'){this.escapeTime+=dt;for(const a of this.attackers){a.z+=dt*12;a.age+=dt;}if(this.escapeTime>=RAVINE.escape){this.result='won';this.events.push({type:'won'});}return;}
  const before=sectionAt(this.time);this.time=Math.min(RAVINE.duration,this.time+dt);if(sectionAt(this.time)!==before)this.events.push({type:'section',section:sectionAt(this.time)});
  for(const k of ['shotTimer','grenade'])this[k]=Math.max(0,this[k]-dt);
  this.heat=Math.max(0,this.heat-dt*.21);
  if(this.reload>0){this.reload=Math.max(0,this.reload-dt);if(!this.reload){this.ammo=RAVINE.magazine;this.events.push({type:'loaded'});}}
  if(this.time>=RAVINE.duration){this.phase='escape';this.events.push({type:'escape'});return;}
  const section=sectionAt(this.time),limit=section===2?4:3;
  if(this.time>=this.nextSpawn&&this.time<81&&this.live.length<limit){this.spawn();this.nextSpawn=this.time+[4.6,3.8,3.1][section];}
  for(const a of this.attackers){
   a.age+=dt;a.flash=Math.max(0,a.flash-dt);
   if(a.phase==='dead'){a.z+=dt*8.5;if(a.age>4.2)a.phase='gone';continue;}
   if(a.phase==='gone')continue;
   if(a.phase==='run'){
    a.z=Math.max(9,a.z-dt*(3.6+section*.55));a.x+=(a.lane-a.x)*(1-Math.exp(-dt*.9));
    if(a.z<=9){a.phase='warn';a.age=0;this.events.push({type:'warn',id:a.id});}
   }else if(a.phase==='warn'){
    a.z=9;a.x+=(a.lane-a.x)*(1-Math.exp(-dt*3));
    if(a.age>=1.85){a.phase='leap';a.age=0;a.fromX=a.x;this.events.push({type:'leap',id:a.id});}
   }else if(a.phase==='leap'){
    const u=clamp(a.age/.8,0,1),smooth=u*u*(3-2*u);a.z=9-5.5*smooth;a.x=a.fromX+(Math.sign(a.lane||a.side)*1.55-a.fromX)*smooth;
    if(u===1){this.damage(17);a.phase='retreat';a.age=0;this.events.push({type:'strike',id:a.id});}
   }else if(a.phase==='retreat'){
    a.x+=a.side*dt*2.4;a.z+=dt*6;if(a.age>2.5)a.phase='gone';
   }
  }
  this.attackers=this.attackers.filter(a=>a.phase!=='gone');
 }
 spawn(){
  const id=++this.serial,side=id%2?1:-1,lanes=[-3.5,0,3.5],lane=lanes[(id*2+sectionAt(this.time))%3];
  // Never spawn on an occupied lane within the rear 20 m.
  const choices=[lane,...lanes.filter(x=>x!==lane)],free=choices.find(x=>!this.live.some(a=>Math.abs(a.lane-x)<1&&a.z>19));if(free===undefined)return;
  this.attackers.push({id,side,lane:free,x:side*6.4,z:35+id%3*2,hp:150,phase:'run',age:0,flash:0,seed:id*.71});this.events.push({type:'spawn',id});
 }
 shoot(){if(this.result||this.phase!=='chase'||this.shotTimer>0||this.reload>0||(!this.ammo&&!this.infiniteAmmo)||(this.heat>=.98&&!this.infiniteAmmo))return false;this.shotTimer=RAVINE.fireInterval;this.shots++;if(this.infiniteAmmo)this.heat=0;else{this.ammo--;this.heat=Math.min(1,this.heat+.027);}if(!this.ammo&&!this.infiniteAmmo)this.startReload();return true;}
 startReload(){if(this.result||this.phase!=='chase'||this.infiniteAmmo||this.reload>0||this.ammo===80)return false;this.reload=RAVINE.reload;this.events.push({type:'reload'});return true;}
 launchGrenade(){if(this.result||this.phase!=='chase'||this.grenade>0&&!this.infiniteRockets)return false;this.grenade=this.infiniteRockets?0:RAVINE.grenadeCooldown;return true;}
 hit(id,{head=false,explosive=false}={}){const a=this.attackers.find(a=>a.id===id);if(this.result||this.phase!=='chase'||!a||['dead','gone'].includes(a.phase))return false;this.hits++;a.hp=Math.max(0,a.hp-(explosive?230:head?32:20));a.flash=.11;if(a.hp===0){a.phase='dead';a.age=0;this.kills++;this.events.push({type:'kill',id});return true;}return false;}
 damage(n){if(this.result||this.phase!=='chase')return;this.jeep=Math.max(0,this.jeep-n);this.events.push({type:'damage'});if(!this.jeep){this.result='lost';this.events.push({type:'lost'});}}
 drain(){return this.events.splice(0);}
}
