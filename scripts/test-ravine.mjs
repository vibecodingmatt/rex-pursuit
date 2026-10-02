import assert from 'node:assert/strict';
import {RavineRound,RAVINE} from '../src/ravine/rules.js';
import {campaignProgress,completeChapter} from '../src/chase/campaign.js';
const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
assert.equal(campaignProgress(storage).ravine,false);
assert.equal(completeChapter(2,storage).completed,false,'cannot complete an unavailable chapter');
assert.equal(completeChapter(1,storage).ravine,true);assert.equal(campaignProgress(storage).ravine,true);
assert.equal(completeChapter(2,storage).completed,true);
assert.equal(completeChapter(1,{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}).saved,false,'storage denial is recoverable');
const fresh=new RavineRound();assert.equal(fresh.shoot(),true);assert.equal(fresh.shoot(),false);assert.equal(fresh.ammo,79);fresh.tick(.09);fresh.startReload();fresh.tick(RAVINE.reload+.01);assert.equal(fresh.ammo,80);
assert.equal(fresh.launchGrenade(),true);assert.equal(fresh.launchGrenade(),false);fresh.tick(11.01);assert.equal(fresh.launchGrenade(),true);
function run(fps,defend){const r=new RavineRound();let max=0;for(let n=0;n<fps*110&&!r.result;n++){r.tick(1/fps);max=Math.max(max,r.live.length);if(defend){const target=r.live.sort((a,b)=>a.z-b.z)[0];if(target&&r.shoot())r.hit(target.id,{head:true});}assert.ok(r.attackers.length<=8,'bounded bodies and live actors');}return{r,max};}
for(const fps of [30,60,120]){const {r,max}=run(fps,false);assert.equal(r.result,'lost','ignoring the pack loses');assert.equal(r.jeep,0);assert.ok(max<=4);const won=run(fps,true);assert.equal(won.r.result,'won','ordinary aimed bullets can complete the route');assert.ok(won.r.kills>10);assert.ok(won.max<=4);}
const r=new RavineRound();r.tick(3.1);const a=r.live[0];assert.ok(a);assert.equal(r.hit(a.id,{explosive:true}),true);assert.equal(r.hit(a.id,{explosive:true}),false);assert.equal(r.kills,1,'each kill counted once');
r.reset();assert.equal(r.attackers.length,0);assert.equal(r.time,0);assert.equal(r.ammo,80);r.tick(3.1);r.infiniteAmmo=true;for(let n=0;n<180;n++){r.shoot();r.tick(.09);}assert.equal(r.ammo,80);assert.equal(r.heat,0);
const escrow=new RavineRound();escrow.time=RAVINE.duration-.01;escrow.tick(.02);assert.equal(escrow.phase,'escape');escrow.damage(200);assert.equal(escrow.jeep,100,'attacks stop beyond the gate');escrow.tick(RAVINE.escape);assert.equal(escrow.result,'won');
console.log('Ravine rules passed: unlock persistence/failure, cooldowns/reload, fair wins and losses at 30/60/120 Hz, bounded pack, exactly-once kills, restart, cheats and safe extraction.');
