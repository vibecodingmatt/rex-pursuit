import assert from 'node:assert/strict';
import {RavineRound,RAVINE} from '../src/ravine/rules.js';
import {gateZ,ROAD_SPEED} from '../src/ravine/route.js';
import {RaptorFall,ravineRide} from '../src/ravine/motion.js';
import {campaignProgress,completeChapter,ravineAvailable,RAVINE_PLAYTEST_OPEN} from '../src/chase/campaign.js';
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
assert.equal(campaignProgress(storage).ravine,false);
assert.equal(ravineAvailable(storage),RAVINE_PLAYTEST_OPEN,'fresh play-test entry requires no Rex win');
assert.equal(campaignProgress(storage).ravine,false,'opening play-test access does not invent a Rex win');
assert.equal(completeChapter(2,storage).completed,RAVINE_PLAYTEST_OPEN,'an available chapter records its own completion');
assert.equal(campaignProgress(storage).ravine,false,'finishing the ravine does not invent a Rex win');
assert.equal(completeChapter(1,storage).ravine,true);assert.equal(campaignProgress(storage).ravine,true);
assert.equal(completeChapter(2,storage).completed,true);
assert.equal(completeChapter(1,{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}).saved,false,'storage denial is recoverable');
const fresh=new RavineRound();assert.equal(fresh.shoot(),true);assert.equal(fresh.shoot(),false);assert.equal(fresh.ammo,79);fresh.tick(.09);fresh.startReload();fresh.tick(RAVINE.reload+.01);assert.equal(fresh.ammo,80);
assert.equal(fresh.launchGrenade(),true);assert.equal(fresh.launchGrenade(),false);fresh.tick(11.01);assert.equal(fresh.launchGrenade(),true);
function run(fps,defend){const r=new RavineRound();let max=0;for(let n=0;n<fps*110&&!r.result;n++){r.tick(1/fps);max=Math.max(max,r.live.length);if(defend){const target=r.live.filter(a=>!['emerge','retreat'].includes(a.phase)).sort((a,b)=>a.z-b.z)[0];if(target&&r.shoot())r.hit(target.id,{head:true});}assert.ok(r.attackers.length<=RAVINE.maxActors,'bounded bodies and live actors');}return{r,max};}
for(const fps of [30,60,120]){const {r,max}=run(fps,false);assert.equal(r.result,'lost','ignoring the pack loses');assert.equal(r.jeep,0);assert.ok(r.time<32,'unopposed pack poses an early threat');assert.ok(max>=4&&max<=8);const won=run(fps,true);assert.equal(won.r.result,'won','ordinary aimed bullets can complete the route');assert.ok(won.r.kills>=38,'sustained overlapping groups across the route');assert.ok(won.max>=3&&won.max<=8);}
const r=new RavineRound();r.tick(3.1);const a=r.live[0];assert.ok(a);assert.equal(r.hit(a.id,{explosive:true}),true);assert.equal(r.hit(a.id,{explosive:true}),false);assert.equal(r.kills,1,'each kill counted once');
r.reset();assert.equal(r.attackers.length,0);assert.equal(r.time,0);assert.equal(r.ammo,80);r.tick(3.1);r.infiniteAmmo=true;for(let n=0;n<180;n++){r.shoot();r.tick(.09);}assert.equal(r.ammo,80);assert.equal(r.heat,0);
const airborne=new RavineRound();airborne.spawn();const leaper=airborne.live[0];Object.assign(leaper,{phase:'leap',age:.16});airborne.hit(leaper.id,{explosive:true});const flyingFall=new RaptorFall({side:1,seed:1,...leaper.death});flyingFall.step(.02);assert.ok(flyingFall.y>0&&flyingFall.vy>0,'an airborne kill retains upward momentum');
const direct=new RavineRound();direct.spawn();const blasted=direct.live[0];assert.equal(direct.hit(blasted.id,{explosive:true,direct:true}),true);assert.equal(blasted.phase,'shattered');assert.equal(direct.live.length,0);assert.equal(direct.hit(blasted.id,{explosive:true,direct:true}),false,'direct hits count once');
const exit=new RavineRound();exit.spawn();const departing=exit.live[0];Object.assign(departing,{x:1.55,z:3.5});exit.nextSpawn=Infinity;exit.retreat(departing);exit.tick(6);assert.equal(departing.phase,'withdrawn','elapsed time alone cannot despawn a visible animal');departing.hidden=true;exit.tick(.02);assert.ok(!exit.attackers.includes(departing),'retire only after the render rig verifies concealment');
const escrow=new RavineRound();escrow.time=RAVINE.duration-.01;escrow.tick(.02);assert.equal(escrow.phase,'escape');escrow.damage(200);assert.equal(escrow.jeep,100,'attacks stop beyond the gate');escrow.tick(RAVINE.escape);assert.equal(escrow.result,'won');
for(const fps of [30,60,120]){
 const r=new RavineRound();r.spawn();const a=r.live[0];Object.assign(a,{phase:'leap',age:.3,x:1.55,z:4,motionSpeed:15});r.time=RAVINE.duration-.01;
 for(let n=0;n<fps*5;n++){r.tick(1/fps);assert.ok(a.z>=gateZ(r.escapeTime)+4.59,'last-second leaper stays outside the moving barrier');assert.ok((a.airY??0)>=0);}
 assert.equal(a.phase,'gate-hold');assert.equal(a.motionSpeed,0);assert.equal(a.airY,0);const before=a.z;r.tick(.1);assert.ok(Math.abs(a.z-before-ROAD_SPEED*.1)<1e-6,'stopped survivors recede with the road');
 const fall=new RaptorFall({side:1,seed:3});for(let n=0;n<fps*3;n++)fall.step(1/fps);assert.ok(Math.abs(fall.rollV)<.01&&Math.abs(fall.pitchV)<.02,'fall settles without perpetual rolling');
}
const rides=Array.from({length:1000},(_,i)=>ravineRide(i*.1));assert.ok(rides.every(r=>Math.abs(r.heave)<.009&&Math.abs(r.pitch)<.005&&Math.abs(r.roll)<.005),'small suspension displacement');assert.ok(Object.values(ravineRide(100,0)).every(v=>v===0));assert.ok(rides.some((r,i)=>i<900&&Math.abs(r.heave-rides[i+100].heave)>.002),'road motion does not repeat every ten metres');
console.log('Ravine rules passed: earned progress; gun/reload; demanding bounded pack and fair wins/losses at 30/60/120 Hz; restart/cheats; leaper landing and braking outside gate; settling falls; restrained irregular ride.');
