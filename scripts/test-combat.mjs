import assert from 'node:assert/strict';
import {Encounter,RULES} from '../src/chase/combat.js';
import {debrisPosition} from '../src/chase/debris.js';
import {TARGET_SITES,SITE_OFFSETS} from '../src/chase/target-sites.js';
const advance=(s,time,dt=1/60)=>{for(let t=0;t<time;t+=dt)s.tick(Math.min(dt,time-t));};
const s=new Encounter();assert.equal(s.fire(),false);advance(s,RULES.intro+.02);assert.equal(s.phase,'pursuit');assert.equal(s.fire(),true);assert.equal(s.fire(),false);assert.equal(s.ammo,79);assert.equal(s.startReload(),true);assert.equal(s.fire(),false);advance(s,2.7);assert.equal(s.ammo,80);assert.equal(s.reload,0);
for(const fps of [30,60,144]){const idle=new Encounter();for(let i=0;i<fps*100&&!idle.result;i++)idle.tick(1/fps);assert.equal(idle.result,'lost');assert.equal(idle.jeep,0);assert.ok(idle.time>30&&idle.time<95);assert.equal(idle.fire(),false);}
const charge=new Encounter();charge.transition('charge');charge.distance=16;for(let i=0;i<9;i++)charge.hit(true);assert.equal(charge.phase,'charge');charge.hit(true);assert.equal(charge.phase,'stunned');assert.equal(charge.interrupts,1);advance(charge,2);assert.equal(charge.jeep,100);assert.ok(charge.distance>20);
const mixed=new Encounter();mixed.transition('charge');for(let i=0;i<3;i++)mixed.hit(true);mixed.hit(false,true);assert.equal(mixed.phase,'stunned');
const ram=new Encounter();ram.attackNumber=1;ram.distance=10;ram.transition('charge');ram.tick(.1);assert.equal(ram.phase,'ram');advance(ram,.8);assert.equal(ram.jeep,78);assert.equal(ram.phase,'recover');
const heat=new Encounter();heat.transition('pursuit');for(let i=0;i<120;i++){heat.fire();heat.tick(.086);if(heat.overheated)break;}assert.equal(heat.overheated,true);assert.equal(heat.fire(),false);advance(heat,4);assert.equal(heat.overheated,false);
const grenade=new Encounter();grenade.transition('pursuit');assert.equal(grenade.launch(),true);assert.equal(grenade.launch(),false);advance(grenade,RULES.grenadeCooldown+.1);assert.equal(grenade.launch(),true);
const winner=new Encounter();winner.transition('pursuit');for(let i=0;i<500&&!winner.result;i++)winner.hit(true);assert.equal(winner.result,'won');assert.equal(winner.health,0);assert.equal(winner.launch(),false);const time=winner.time;winner.tick(100);assert.equal(winner.time,time);
for(const fps of [30,60,144]){
 const intro=new Encounter();advance(intro,RULES.intro-.1,1/fps);assert.equal(intro.fightTime,0);assert.equal(intro.remaining,90);assert.equal(intro.launch(),false);assert.deepEqual(intro.drainEvents(),['jungle-crash','opening-roar','jeep-launch']);advance(intro,.15,1/fps);assert.equal(intro.phase,'pursuit');assert.ok(intro.fightTime<.07);
 const warning=new Encounter();warning.transition('pursuit');warning.phaseTime=7;warning.tick(1/fps);assert.equal(warning.phase,'warning');assert.equal(warning.objective,null);advance(warning,RULES.warning-.1,1/fps);assert.equal(warning.phase,'warning');advance(warning,.15,1/fps);assert.equal(warning.phase,'challenge');
 for(const tier of [0,1,2]){
  const c=new Encounter();c.ambushPlayed=true;c.nextDebris=Infinity;c.fightTime=tier*30;c.beginChallenge();const o=c.objective;assert.equal(o.duration,[5.2,4.2,3.4][tier]);assert.equal(o.hitsRequired,tier?2:1);assert.equal(c.hitTarget(99),false);
  for(const index of o.order)for(let h=0;h<o.hitsRequired;h++){assert.equal(c.hitTarget(index),true);c.tick(1/fps);}
  assert.equal(c.phase,'stunned');assert.equal(c.objectivesCleared,1);assert.equal(c.jeep,100);assert.equal(c.health,RULES.health-100-tier*30);assert.equal(c.hitTarget(o.order[0]),false);advance(c,3.8,1/fps);assert.equal(c.phase,'pursuit');
  const miss=new Encounter();miss.ambushPlayed=true;miss.nextDebris=Infinity;miss.fightTime=tier*30;miss.distance=12.5;miss.beginChallenge();advance(miss,miss.objective.duration+.03,1/fps);assert.equal(miss.objectivesMissed,1);assert.equal(miss.attackCommitted,true);for(let h=0;h<11;h++)miss.hit(true);assert.notEqual(miss.phase,'stunned');advance(miss,1.4,1/fps);assert.equal(miss.jeep,73-tier*5);
 }
 const deadline=new Encounter();deadline.ambushPlayed=true;deadline.nextDebris=Infinity;deadline.transition('pursuit');for(let i=0;i<fps*90;i++){deadline.phase='pursuit';deadline.phaseTime=0;deadline.tick(1/fps);}assert.equal(deadline.remaining,0);assert.equal(deadline.phase,'execution');assert.equal(deadline.fire(),false);assert.equal(deadline.launch(),false);deadline.hit(true,true);assert.equal(deadline.health,RULES.health);advance(deadline,1.5,1/fps);assert.equal(deadline.result,'lost');assert.equal(deadline.lossReason,'timeout');assert.equal(deadline.jeep,0);
 deadline.reset();assert.equal(deadline.remaining,90);assert.equal(deadline.objective,null);assert.equal(deadline.objectivesMissed,0);assert.equal(deadline.introCues.size,0);
}
const he=new Encounter();he.fightTime=60;he.beginChallenge();he.hitTarget(he.objective.order[0],true);assert.equal(he.objective.current,1);
let seed=12345;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),shuffle=new Encounter(random),orders=new Set(),sites=new Set();
for(let i=0;i<120;i++){
 shuffle.fightTime=(i%3)*30;const previous=shuffle.objective?.order.join(',');shuffle.beginChallenge();const o=shuffle.objective;
 assert.equal(o.order.length,4+i%3);assert.equal(new Set(o.order).size,o.order.length);assert.notEqual(o.order.join(','),previous);assert.ok(o.order.some(id=>TARGET_SITES[id].region==='body'));assert.ok(o.order.some(id=>TARGET_SITES[id].region==='head'));
 for(let j=1;j<o.order.length;j++)assert.notEqual(TARGET_SITES[o.order[j]].region,TARGET_SITES[o.order[j-1]].region,'Aim shifts between regions');
 for(const id of o.order){sites.add(id);assert.ok(o.variants[id]>=0&&o.variants[id]<SITE_OFFSETS.length);}orders.add(o.order.join(','));
}
assert.equal(sites.size,TARGET_SITES.length);assert.ok(orders.size>100,'Runs must not recycle a small set of scripts');
for(const fps of [30,60,144]){
 for(const tier of [0,1,2]){
  const d=new Encounter(random);d.ambushPlayed=true;d.transition('pursuit');d.fightTime=tier*30;assert.equal(d.spawnDebris(),true);assert.equal(d.spawnDebris(),false);const health=d.health,first=d.debris;assert.equal(first.status,'attached');assert.equal(d.hitDebris(first.id),false);while(first.status==='attached')d.tick(1/fps);
  assert.equal(first.duration,[1.8,1.5,1.25][tier]);
  const startZ=debrisPosition({...first,age:0}).z,halfSecondZ=debrisPosition({...first,age:.5}).z,oldSpeed=(first.fromZ-2.4)/[3.6,3.3,3][tier];
  assert.ok((startZ-halfSecondZ)/.5>=oldSpeed*1.999,'Branches travel at least twice as fast');
  assert.equal(d.hitDebris(first.id+1),false);advance(d,.4,1/fps);
  while(first.status==='active'){if(d.fire())assert.equal(d.hitDebris(first.id),true);d.tick(1/fps);}
  assert.equal(d.debrisCleared,1,'Normal fire cadence can intercept after a short reaction delay');assert.equal(d.jeep,100);assert.equal(d.health,health,'Intercepting debris must not also damage the Rex');assert.equal(d.hitDebris(first.id),false);
  d.spawnDebris();const second=d.debris;while(second.status==='attached')d.tick(1/fps);d.startReload();assert.equal(d.launch(),true);assert.equal(d.hitDebris(second.id,true),true);assert.equal(d.debrisCleared,2);
  d.spawnDebris();const doomed=d.debris;while(doomed.status==='attached')d.tick(1/fps);d.nextDebris=Infinity;advance(d,doomed.duration+.02,1/fps);assert.equal(d.jeep,100-doomed.damage);assert.equal(d.debrisMissed,1);advance(d,.2,1/fps);assert.equal(d.debrisMissed,1);
  d.spawnDebris();d.health=1;d.hit();assert.equal(d.result,'won');assert.equal(d.debris.status,'cancelled');const hp=d.jeep;d.tick(10);assert.equal(d.jeep,hp);
  d.reset();assert.equal(d.debris,null);assert.equal(d.debrisCleared,0);assert.equal(d.debrisMissed,0);assert.deepEqual(d.previousOrder,[]);
 }
 const lethal=new Encounter();lethal.transition('pursuit');lethal.jeep=1;lethal.spawnDebris();advance(lethal,7,1/fps);assert.equal(lethal.result,'lost');assert.equal(lethal.lossReason,'debris');assert.equal(lethal.jeep,0);
}
// The wildlife bag: a tally by species that never touches the Rex, the clock or the Jeep, and clears on reset.
{const w=new Encounter();w.transition('pursuit');const before={health:w.health,jeep:w.jeep,remaining:w.remaining};
 assert.equal(w.bagged('compy'),1);assert.equal(w.bagged('compy'),2);assert.equal(w.bagged('pteranodon'),3);assert.deepEqual(w.bag,{compy:2,pteranodon:1});
 assert.deepEqual({health:w.health,jeep:w.jeep,remaining:w.remaining},before);w.reset();assert.deepEqual(w.bag,{});assert.equal(w.bagTotal,0);}
console.log('Combat passed: opening cues, fire/reload/heat, ordered objectives, escalating difficulty, committed attacks, deadline, victory, reset and defeat at 30/60/144 Hz, wildlife bag.');
console.log('Pressure passed: randomized mixed targets, all sites sampled, debris interception/HE/failure, lethal impacts and resets.');
