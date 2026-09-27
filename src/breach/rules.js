// Simulation-only contract: a stopped Jeep, three escalating waves, then a
// closing Rex while the service exit opens. No wall clocks or render state.
export const BREACH={duration:120,reveal:94,breach:99,gateAt:106,escape:4,magazine:80,reload:2.6,fireInterval:.085,grenadeCooldown:11,trapCooldown:18,staggerHits:14};
export const waveAt=t=>t<3?0:t<37?1:t<40?0:t<72?2:t<75?0:t<94?3:4;
// Existing attackers keep moving through the short reload breaks and finale.
export const PRESSURE={
 1:{interval:2.25,limit:4,approach:4.8},
 2:{interval:1.45,limit:6,approach:4.2},
 3:{interval:1.05,limit:8,approach:3.6},
 4:{interval:2.4,limit:5,approach:4.3}
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class BreachRound{
 constructor(){this.reset();}
 reset(){Object.assign(this,{cheated:false,infiniteAmmo:false,time:0,phase:'hold',result:null,jeep:100,ammo:80,reload:0,heat:0,shotTimer:0,grenade:0,trap:0,kills:0,shots:0,hits:0,trapKills:0,saves:0,staggers:0,score:0,rexDistance:43,rexCharge:0,rexRecoil:0,escapeTime:0,events:[],_revealed:false,_broken:false,_opening:false});}
 get wave(){return waveAt(this.time);}
 get gate(){return clamp((this.time-BREACH.gateAt)/(BREACH.duration-BREACH.gateAt),0,1);}
 get remaining(){return Math.max(0,BREACH.duration-this.time);}
 tick(dt){
  if(this.result||dt<=0)return;
  if(this.phase==='escape'){this.escapeTime+=dt;if(this.escapeTime>=BREACH.escape){this.result='won';this.score+=1000+Math.round(this.jeep)*10;this.events.push({type:'won'});}return;}
  const previous=this.time;this.time=Math.min(BREACH.duration,this.time+dt);
  for(const k of ['shotTimer','grenade','trap','rexRecoil'])this[k]=Math.max(0,this[k]-dt);
  this.heat=Math.max(0,this.heat-dt*.21);
  if(this.reload>0){this.reload=Math.max(0,this.reload-dt);if(this.reload===0){this.ammo=BREACH.magazine;this.events.push({type:'loaded'});}}
  if(!this._revealed&&this.time>=BREACH.reveal){this._revealed=true;this.events.push({type:'reveal'});}
  if(!this._broken&&this.time>=BREACH.breach){this._broken=true;this.events.push({type:'breach'});}
  if(!this._opening&&this.time>=BREACH.gateAt){this._opening=true;this.events.push({type:'gate'});}
  if(this._broken){const step=this.time-Math.max(previous,BREACH.breach);this.rexDistance-=Math.max(0,step)*(this.rexRecoil>0?1.7:2.08);if(this.rexDistance<=7)this.damage(100,'rex');}
  if(!this.result&&this.time>=BREACH.duration){this.phase='escape';this.events.push({type:'escape'});}
 }
 shoot(){if(this.result||this.phase!=='hold'||this.shotTimer>0||this.reload>0||(!this.ammo&&!this.infiniteAmmo)||(this.heat>=.98&&!this.infiniteAmmo))return false;if(this.infiniteAmmo)this.heat=0;else{this.ammo--;this.heat=Math.min(1,this.heat+.027);}this.shots++;this.shotTimer=BREACH.fireInterval;if(!this.ammo&&!this.infiniteAmmo)this.startReload();return true;}
 startReload(){if(this.infiniteAmmo||this.result||this.phase!=='hold'||this.reload>0||this.ammo===BREACH.magazine)return false;this.reload=BREACH.reload;this.events.push({type:'reload'});return true;}
 launchGrenade(){if(this.result||this.phase!=='hold'||this.grenade>0)return false;this.grenade=BREACH.grenadeCooldown;return true;}
 discharge(){if(this.result||this.phase!=='hold'||this.trap>0)return false;this.trap=BREACH.trapCooldown;this.events.push({type:'trap'});return true;}
 damage(amount,source='raptor'){if(this.result||this.phase!=='hold')return;this.jeep=Math.max(0,this.jeep-amount);this.events.push({type:'damage',source,amount});if(!this.jeep){this.result='lost';this.events.push({type:'lost',source});}}
 killed({trap=false,onJeep=false,heavy=false}={}){if(this.result||this.phase!=='hold')return;this.kills++;this.trapKills+=Number(trap);this.saves+=Number(onJeep);this.score+=(heavy?180:100)+(trap?50:0)+(onJeep?50:0);}
 hitRex(power=1){if(this.result||this.phase!=='hold'||!this._broken)return false;this.hits++;this.rexCharge+=power;
  if(this.rexCharge>=BREACH.staggerHits){this.rexCharge=0;this.staggers++;
   // The charge gathers ground even under perfect fire, but a stagger never
   // moves her forward. This keeps the last seconds close and still survivable.
   const limit=43-Math.max(0,this.time-BREACH.breach)*1.4;
   this.rexDistance+=Math.max(0,Math.min(4.2,limit-this.rexDistance));this.rexRecoil=1.25;this.score+=150;this.events.push({type:'stagger'});return true;}return false;
 }
 drain(){return this.events.splice(0);}
}
