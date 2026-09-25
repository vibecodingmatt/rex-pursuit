import {targetSequence} from './target-sites.js';
import {AMBUSH,ambushPose} from './ambush.js';
export const RULES={health:5600,magazine:80,reload:2.6,fireInterval:.085,grenadeCooldown:11,intro:9.4,roarAt:3.25,deadline:90,bodyDamage:10,headDamage:14,explosiveDamage:190,warning:1.25,retreat:3.05,debrisFlight:[1.8,1.5,1.25]};
export class Encounter {
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){Object.assign(this,{time:0,fightTime:0,remaining:RULES.deadline,introDuration:RULES.intro,health:RULES.health,jeep:100,ammo:RULES.magazine,reload:0,heat:0,overheated:false,grenade:0,shotTimer:0,phase:'intro',phaseTime:0,distance:18,stagger:0,hits:0,headshots:0,shots:0,interrupts:0,result:null,events:[],attackNumber:0,objective:null,objectivesCleared:0,objectivesMissed:0,challengeNumber:0,attackCommitted:false,lossReason:null,introCues:new Set(),previousOrder:[],debris:null,debrisNumber:0,debrisCleared:0,debrisMissed:0,bag:{},nextDebris:12,ambushPlayed:false,ambush:null,defeat:null,victory:null});}
 get tier(){return Math.min(2,Math.max(Math.floor(this.fightTime/30),this.health<=RULES.health*.35?2:this.health<=RULES.health*.7?1:0));}
 // The gun is live everywhere but the opening and the final overrun, including the
 // detour, when the compies bolting across the road are the targets.
 get weaponsLocked(){return ['intro','execution'].includes(this.phase);}
 /** In the detour she is out of sight behind the understory from the moment contact is lost until she crashes out. */
 get concealed(){return this.phase==='flank'&&this.phaseTime>=AMBUSH.vanish&&this.phaseTime<AMBUSH.crashAt;}
 get ambushDue(){return !this.ambushPlayed&&(this.fightTime>=45||this.health<=RULES.health*.5);}
 beginAmbush(){
  this.ambushPlayed=true;this.ambush={distance:this.distance,x:Math.sin(this.time*.73)*.7,startedAt:this.time,cues:new Set()};
  this.objective=null;this.attackCommitted=false;this.transition('flank');
 }
 transition(phase){this.phase=phase;this.phaseTime=0;this.events.push(phase);if(phase==='charge')this.stagger=0;if(phase==='pursuit'){this.attackCommitted=false;this.objective=null;}}
 beginChallenge(){
  const tier=this.tier,{order,variants}=targetSequence(this.random,4+tier,this.previousOrder);this.previousOrder=order;
  this.challengeNumber++;this.objective={number:this.challengeNumber,tier,order,variants,current:0,hits:0,hitsRequired:tier?2:1,duration:[5.2,4.2,3.4][tier],remaining:[5.2,4.2,3.4][tier],status:'active'};
  this.transition('challenge');
 }
 tick(dt){
  if(this.result)return;const wasIntro=this.phase==='intro';this.time+=dt;this.phaseTime+=dt;
  this.shotTimer=Math.max(0,this.shotTimer-dt);this.grenade=Math.max(0,this.grenade-dt);this.heat=Math.max(0,this.heat-dt*.19);if(this.heat<.33)this.overheated=false;
  if(this.reload>0){this.reload=Math.max(0,this.reload-dt);if(this.reload===0){this.ammo=RULES.magazine;this.events.push('loaded');}}
  if(wasIntro){
   for(const [cue,at]of [['jungle-crash',1.25],['opening-roar',RULES.roarAt],['jeep-launch',this.introDuration-3.2]])if(this.phaseTime>=at&&!this.introCues.has(cue)){this.introCues.add(cue);this.events.push(cue);}
   if(this.phaseTime>=this.introDuration){this.distance=21;this.transition('pursuit');}return;
  }
  if(this.phase==='execution'){
   this.distance+=(9.25-this.distance)*Math.min(1,dt*4.2);
   if(this.phaseTime>=1.45){this.jeep=0;this.result='lost';this.events.push('impact','lost');}return;
  }
  if(this.phase==='flank'){
   const p=ambushPose(this.phaseTime,this.ambush.distance,this.ambush.x);this.distance=p.z;
   if(this.debris){this.debris.branchZ+=10*dt;this.debris.sourceAge+=dt;}
   for(const [cue,at]of [['contact-lost',AMBUSH.vanish],['ambush-rustle',5.85],['ambush-crash',AMBUSH.crashAt]])if(this.phaseTime>=at&&!this.ambush.cues.has(cue)){this.ambush.cues.add(cue);this.events.push(cue);}
   if(this.phaseTime>=AMBUSH.duration){this.distance=9.8;this.nextDebris=Math.max(this.nextDebris,this.fightTime+6);this.transition('warning');}return;
  }
  this.fightTime=Math.min(RULES.deadline,this.fightTime+dt);this.remaining=Math.max(0,RULES.deadline-this.fightTime);
  if(this.remaining<=1e-6){this.remaining=0;this.lossReason='timeout';this.attackCommitted=true;if(this.objective?.status==='active')this.objective.status='failed';if(this.debris)this.debris.status='cancelled';this.transition('execution');return;}
  this.tickDebris(dt);if(this.result)return;
  // Finish any live target sequence/projectile before the detour. No forfeited
  // objectives, surprise damage, or time charged while the Rex is out of sight.
  if(this.ambushDue&&['pursuit','recover','stunned'].includes(this.phase)&&this.phaseTime>.35&&!['attached','active'].includes(this.debris?.status)){this.beginAmbush();return;}
  if(this.phase==='pursuit'){
   this.distance+=(18.7+Math.sin(this.time*.55)*1.2-this.distance)*dt*1.4;
   if(this.phaseTime>(this.challengeNumber===0?4.5:[4,3.3,2.6][this.tier]))this.transition('warning');
  }
  if(this.phase==='warning'&&this.phaseTime>=RULES.warning)this.beginChallenge();
  if(this.phase==='challenge'){
   this.distance+=(12.5-this.distance)*Math.min(1,dt*2.4);
   const o=this.objective;o.remaining=Math.max(0,o.remaining-dt);
   if(o.remaining<=1e-6){o.status='failed';o.remaining=0;this.objectivesMissed++;this.attackCommitted=true;this.events.push('objective-failed');this.transition('charge');}
  }
  if(this.phase==='charge'){this.distance=Math.max(9.8,this.distance-dt*(5.3+this.tier*.55));if(this.distance<=9.9)this.transition(this.attackNumber%2?'ram':'bite');}
  if((this.phase==='bite'||this.phase==='ram')&&this.phaseTime>.78){
   this.jeep=Math.max(0,this.jeep-((this.attackNumber++%2?22:27)+this.tier*5));this.events.push('impact');
   if(this.jeep===0){this.result='lost';this.lossReason='damage';this.events.push('lost');}else this.transition('recover');
  }
  if(this.phase==='recover'||this.phase==='stunned'){this.distance+=Math.min(6,(23-this.distance)*1.2)*dt;if(this.phaseTime>(this.phase==='stunned'?RULES.retreat:2.7))this.transition('pursuit');}
 }
 fire(){if(this.result||this.weaponsLocked||this.shotTimer>0||this.reload>0||this.overheated)return false;if(this.ammo===0){this.startReload();return false;}this.ammo--;this.shots++;this.shotTimer=RULES.fireInterval;this.heat=Math.min(1,this.heat+.029);if(this.heat>=1){this.overheated=true;this.events.push('overheat');}return true;}
 startReload(){if(this.result||this.phase==='execution'||this.reload>0||this.ammo===RULES.magazine)return false;this.reload=RULES.reload;this.events.push('reload');return true;}
 launch(){if(this.result||this.weaponsLocked||this.grenade>0)return false;this.grenade=RULES.grenadeCooldown;return true;}
 damage(amount){if(this.result||this.phase==='execution')return;
  // Rounds that catch her as she breaks off still wound her, but she only goes down on the road, not in the trees.
  this.health=Math.max(this.phase==='flank'&&this.phaseTime<AMBUSH.fireAt?Math.min(1,this.health):0,this.health-amount);if(this.health===0){this.result='won';if(this.objective?.status==='active')this.objective.status='cancelled';if(this.debris)this.debris.status='cancelled';this.events.push('won');}}
 hit(head=false,explosive=false){
  if(this.result||this.phase==='execution'||this.concealed)return 0;const amount=explosive?RULES.explosiveDamage:head?RULES.headDamage:RULES.bodyDamage;this.damage(amount);this.hits++;if(head)this.headshots++;
  // Ordinary headshot staggers still work outside a committed arcade attack.
  if(!this.result&&this.phase==='charge'&&!this.attackCommitted&&(head||explosive)){this.stagger+=explosive?7:1;if(this.stagger>=10){this.interrupts++;this.transition('stunned');}}
  return amount;
 }
 hitTarget(index,explosive=false){
  const o=this.objective;if(this.result||this.phase!=='challenge'||!o||o.status!=='active'||o.order[o.current]!==index)return false;
  o.hits+=explosive?o.hitsRequired:1;this.events.push('target-hit');
  if(o.hits>=o.hitsRequired){o.hits=0;o.current++;this.events.push('target-cleared');}
  if(o.current===o.order.length){o.status='cleared';this.objectivesCleared++;this.interrupts++;this.damage(100+o.tier*30);if(!this.result){this.transition('stunned');this.events.push('objective-cleared');}}
  return true;
 }
 spawnDebris(){
  if(this.result||['intro','execution','flank'].includes(this.phase)||['attached','active'].includes(this.debris?.status))return false;
  const tier=this.tier;this.debris={id:++this.debrisNumber,side:this.random()<.5?-1:1,fromX:0,fromZ:0,branchZ:-4,height:3.65+this.random()*.3,spin:Math.PI/2,age:0,sourceAge:0,brokenAt:null,duration:RULES.debrisFlight[tier],hits:0,hitsRequired:tier?3:2,damage:8+tier*2,status:'attached'};
  this.debris.fromX=this.debris.side*.55;
  this.nextDebris=this.fightTime+[13,10.5,8.5][tier]+this.random()*1.8;this.events.push('branch-approach');return true;
 }
 tickDebris(dt){
  const d=this.debris;
  if(d){d.sourceAge+=dt;d.branchZ+=10*dt;}
  if(d?.status==='attached'){
   if(d.branchZ>=this.distance-6.55){d.status='active';d.fromZ=d.branchZ;d.brokenAt=this.time;d.age=0;this.events.push('branch-break','debris-incoming');}
  }else if(d?.status==='active'){
   d.age=Math.min(d.duration,d.age+dt);
   if(d.age>=d.duration){d.status='impact';this.debrisMissed++;this.jeep=Math.max(0,this.jeep-d.damage);this.events.push('debris-impact','impact');if(this.jeep===0){this.result='lost';this.lossReason='debris';this.events.push('lost');}}
  }else if(!this.ambushDue&&this.fightTime>=this.nextDebris&&['pursuit','warning','challenge','stunned'].includes(this.phase))this.spawnDebris();
 }
 hitDebris(id,explosive=false){
  const d=this.debris;if(this.result||this.phase==='execution'||!d||d.id!==id||d.status!=='active')return false;
  d.hits+=explosive?d.hitsRequired:1;this.events.push('debris-hit');
  if(d.hits>=d.hitsRequired){d.status='cleared';this.debrisCleared++;this.events.push('debris-cleared');}return true;
 }
 /** Wildlife shot down, by species; returns the running total. Nothing here touches the Rex, the clock or the Jeep. */
 bagged(kind){this.bag[kind]=(this.bag[kind]||0)+1;return this.bagTotal;}
 get bagTotal(){return Object.values(this.bag).reduce((n,v)=>n+v,0);}
 drainEvents(){return this.events.splice(0);}
}
