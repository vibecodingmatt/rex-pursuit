import assert from 'node:assert/strict';
import {RavineArcade,rankFor} from '../src/ravine/arcade.js';
import {RavineRound} from '../src/ravine/rules.js';
const a=new RavineArcade();
assert.equal(a.activate(),false);
assert.equal(a.kill({head:true}).points,250);
assert.equal(a.kill({air:true}).points,350);
assert.equal(a.kill().multiplier,2);assert.equal(a.score,900);
a.tick(5.49);assert.equal(a.chain,3);a.tick(.02);assert.equal(a.chain,0);
a.kill({head:true});assert.equal(a.charge,100);assert.equal(a.activate(),true);assert.equal(a.activate(),false);
a.kill({air:true});assert.equal(a.charge,0,'kills cannot recharge an active Turbo');
a.tick(6);assert.equal(a.turbo,0);a.kill();assert.equal(a.charge,20);a.damage();assert.equal(a.multiplier,1);assert.equal(a.chain,0);
a.quarry();assert.equal(a.quarries,1);assert.equal(a.total(true,100),a.score+2000);assert.equal(rankFor(26000),'S');
for(const fps of [30,60,120]){
 const r=new RavineRound();r.arcade.charge=100;r.reload=2;r.ammo=0;r.heat=1;
 assert.equal(r.activateTurbo(),true);assert.equal(r.reload,0);assert.equal(r.ammo,80);assert.equal(r.heat,0);
 let shots=0;for(let i=0;i<fps*5;i++){r.tick(1/fps);if(r.shoot())shots++;}assert.ok(shots>=70);assert.equal(r.ammo,80);assert.equal(r.heat,0);assert.equal(r.cheated,false,'earned power is fair play');
 r.tick(1.1);assert.equal(r.arcade.turbo,0);r.shoot();assert.equal(r.ammo,79);assert.ok(r.heat>0);r.reset();assert.equal(r.arcade.score,0);assert.equal(r.arcade.charge,0);assert.equal(r.arcade.turbo,0);
}
const r=new RavineRound();r.spawn();const target=r.live[0];Object.assign(target,{phase:'leap',age:.2});r.hit(target.id,{head:true,explosive:true});const s=r.arcade.score;assert.equal(r.arcade.airStops,1);assert.equal(r.hit(target.id,{explosive:true}),false);assert.equal(r.arcade.score,s,'a corpse cannot score twice');
console.log('Ravine arcade: skill awards, combo expiry, damage break, earned Turbo at 30/60/120 Hz, normal weapon restoration, fair eligibility, reset and exactly-once scoring passed.');
