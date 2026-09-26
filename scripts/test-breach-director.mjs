import assert from 'node:assert/strict';
import * as T from 'three';
import {BreachRound,PRESSURE} from '../src/breach/rules.js';
import {createBreachDirector} from '../src/breach/director.js';
const seeded=n=>()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
// The director uses the production rules and Vector3 paths. Only the rendering
// pool is replaced; browser checks separately exercise the real hit proxies.
function fixture(seed=1,spawnEnabled=true){
 const pool=[],round=new BreachRound(),cues=[];
 const critters={
  huntSpawn(species){let c=pool.find(c=>!c.on&&c.species===species);if(!c){if(pool.filter(c=>c.species===species).length>=(species==='raptor'?14:4))return null;c={species,p:new T.Vector3(),v:new T.Vector3(),tint:new T.Color(),kind:{centre:.37},vy:0};pool.push(c);}c.on=true;return c;},
  updateDirected(dt){for(const c of pool)if(c.on&&c.state==='dead'){c.deadAge+=dt;if(c.deadAge>4)c.on=false;}},
  reset(){pool.forEach(c=>c.on=false);},
  strike(c,dir,power,damage){c.hp-=damage;return c.hp<=0?this.kill(c):false;},
  kill(c){if(c.state==='dead')return false;c.state='dead';c.deadAge=0;return true;}
 };
 const director=createBreachDirector(critters,round,{random:seeded(seed),onCue:(type,a)=>cues.push({type,time:round.time,heavy:a?.heavy})});
 const step=(dt=1/60)=>{round.tick(dt);director.update(dt,{spawnEnabled});};
 return {round,director,critters,cues,step};
}
const forward=new T.Vector3(0,0,1);
for(const hz of [30,60,120]){
 const {round:r,director:d,step}=fixture();let overlap=false;
 while(!r.result&&r.time<35){step(1/hz);const boards=d.live.filter(a=>['board','leap'].includes(a.phase));overlap||=boards.length===2;assert.ok(boards.length<=2);assert.equal(new Set(boards.map(a=>a.side)).size,boards.length,'Landing slots never overlap');}
 assert.equal(r.result,'lost');assert.ok(r.time<25,'Ignoring the pack must lose quickly');assert.ok(overlap,'Opposite sides attack at the same time');
}
{
 const {round:r,director:d,step,cues}=fixture(1,false);r.time=20;const a=d.spawn(0,'pachycephalosaurus');
 while(a.phase!=='charge')step();assert.equal(r.jeep,100,'Windup/approach cannot damage the Jeep');assert.ok(cues.some(c=>c.type==='windup'&&c.heavy));
 while(a.phase==='charge')step();assert.equal(r.jeep,80,'One contact is exactly one heavy ram');
 for(let i=0;i<20;i++)step();assert.equal(r.jeep,80,'Ram damage is not applied every frame');
 d.blast(a.c.p.clone());assert.equal(a.c.state,'dead','A direct rocket stops a heavy attacker');assert.equal(r.kills,1);d.update(1/60);assert.equal(r.kills,1,'Kills counted once');
}
{
 const {round:r,director:d,step}=fixture();r.time=80;
 const board=d.spawn(0),yard=d.spawn(2);board.phase='board';board.c.p.copy(board.landing);yard.c.p.set(2,0,16);
 assert.equal(d.discharge(),1);assert.notEqual(board.c.state,'dead','Grid cannot clear the deck');assert.equal(yard.c.state,'dead');
 const state=JSON.stringify([board.c.p,board.age,r.time]);d.update(0);assert.equal(JSON.stringify([board.c.p,board.age,r.time]),state,'Zero dt freezes authored motion');
 d.reset();assert.equal(d.actors.length,0);assert.equal(d.stats.spawned,0);step();assert.equal(d.live.length,1,'Pool reuse starts exactly one new actor');
}
// Seeded targeting profiles put real shot/heat/reload and utility cooldowns
// under pressure. These are tuning bounds, not an estimate of human win rates.
function run(seed,{accuracy,reaction,utilities}){
 const {round:r,director:d,step}=fixture(seed),random=seeded(seed+500);let target=null,settle=0;
 while(!r.result&&r.time<120.01){
  if(r.phase==='escape'){step();continue;}
  const a=d.warning||d.live[0];
  const rex=r.time>=99&&r.rexDistance<27&&(!a||!['board','charge'].includes(a.phase));
  const want=rex?'rex':a;
  if(want!==target){target=want;settle=reaction;}
  settle-=1/60;
  if(utilities&&r.trap===0&&(d.live.filter(a=>a.c.p.z>=6&&a.c.p.z<=27).length>=3||r.time>=99&&r.rexDistance<24)){
   if(r.discharge()){d.discharge();if(r.time>=99&&r.rexDistance<25)r.hitRex(14);}
  }
  if(settle<=0){
   if(rex){if(r.shoot()&&random()<accuracy)r.hitRex(2);if(utilities&&r.launchGrenade())r.hitRex(10);}
   else if(a){
    if(r.shoot()&&random()<accuracy)d.strike({critter:a.c,point:a.c.p.clone()},forward);
    if(utilities&&(a.heavy||d.live.length>=3||r.reload>0)&&r.launchGrenade())d.blast(a.c.p.clone());
   }else if(r.ammo<60)r.startReload();
  }step();
 }
 while(!r.result&&r.phase==='escape')step();
 return {result:r.result,health:r.jeep,time:r.time,spawned:d.stats.spawned,peak:d.stats.peak,rams:d.stats.rams,kills:r.kills};
}
const profiles={focused:{accuracy:.82,reaction:.22,utilities:true},casual:{accuracy:.5,reaction:.5,utilities:true},gunOnly:{accuracy:.82,reaction:.22,utilities:false}};
const report={};for(const [name,p]of Object.entries(profiles))report[name]=Array.from({length:12},(_,i)=>run(i+1,p));
assert.ok(report.focused.filter(r=>r.result==='won').length>=9,'Accurate play with utilities stays viable across seeds');
assert.ok(report.focused.every(r=>r.spawned>=55&&r.rams>=5),'Every competent run faces sustained mixed pressure');
assert.ok(report.gunOnly.some(r=>r.result==='lost'||r.health<70),'Ignoring crowd tools carries a cost');
console.log('Breach director passed: simultaneous attacks, fair warnings, heavy ram, blast/grid, pause, reuse and seeded pressure.');
for(const [name,runs]of Object.entries(report))console.log(name,JSON.stringify({wins:runs.filter(r=>r.result==='won').length,outOf:runs.length,health:runs.map(r=>r.health),spawned:[Math.min(...runs.map(r=>r.spawned)),Math.max(...runs.map(r=>r.spawned))]}));
