import assert from 'node:assert/strict';
import {Circuit,project,recordKey,grade} from '../src/arcade/rules.js';
import {readRecord,saveRecord} from '../src/arcade/records.js';
for(const fps of [30,60,120])for(const route of ['classic','extended'])for(const aspect of [16/9,390/844]){
 const g=new Circuit({route});let limit=0,maxLive=0;const stages=new Set();
 while(g.status==='playing'&&limit<900*fps){
  g.update(1/fps);stages.add(g.stage.id);maxLive=Math.max(maxLive,g.entities.length);
  const e=g.entities.find(e=>!e.dead&&e.age>.2);
  if(e){const p=project(e,aspect);assert(p.hx>0&&p.hx<1,'Head target remains on screen');g.shoot(p.hx,p.hy,aspect);}
  if(g.focus>=100)g.activateFocus();g.drain();limit++;
 }
 assert.equal(g.status,'won',`${route} ${fps}Hz ${aspect}: aimed play can finish, HP ${g.hp}, stage ${g.stage.id}`);
 assert.equal(stages.size,route==='classic'?4:7);assert.equal(g.bosses,route==='classic'?4:7);assert(g.score>20000);assert(g.shots>=g.hits);assert(maxLive<20);assert(['S','A','B'].includes(grade(g)));
 console.log(`${route} ${fps}Hz ${aspect.toFixed(2)}: ${g.time.toFixed(1)}s, ${Math.round(g.hp)} HP, ${g.score} pts, ${maxLive} entities max`);
}
const unattended=new Circuit();for(let i=0;i<10000&&unattended.status==='playing';i++)unattended.update(1/60);
assert.equal(unattended.status,'continue');const oldTime=unattended.time;unattended.update(.05);assert.equal(unattended.time,oldTime);assert(unattended.continueRun());assert.equal(unattended.hp,100);assert.equal(unattended.credits,1);
unattended.invulnerable=0;unattended.damage(1000);assert(unattended.continueRun());unattended.invulnerable=0;unattended.damage(1000);assert.equal(unattended.continueRun(),false);
assert.notEqual(recordKey('classic','arcade'),recordKey('extended','arcade'));assert.notEqual(recordKey('classic','tour'),recordKey('classic','arcade'));assert.notEqual(recordKey('classic','arcade',true),recordKey('classic','arcade',false));
const g=new Circuit();g.drain();const boss=g.spawn('rex',{boss:true});boss.age=2;g.pose(boss);const at=project(boss,16/9);for(let i=0;i<9;i++){g.cooldown=0;g.shoot(at.hx,at.hy,16/9);}assert(g.drain().some(e=>e.type==='stagger'));assert.equal(g.hp,100,'Interrupting a boss must not inflict its attack');
const miss=new Circuit();assert(miss.shoot(0,0));assert.equal(miss.hits,0);assert.equal(miss.shoot(0,0),false,'Fire cadence cannot be bypassed');
miss.hp=60;const supply=miss.spawn('supply');supply.age=3;miss.pose(supply);const p=project(supply,16/9);miss.cooldown=0;miss.shoot(p.hx,p.hy);assert.equal(miss.hp,82);
miss.focus=100;assert(miss.activateFocus());assert.equal(miss.activateFocus(),false);assert.equal(miss.focus,0);
console.log('Lost Circuit rules: complete routes, phone targets, frame rates, loss/continues, fire cadence, repairs, boss interrupts and record separation passed.');
const memory=new Map(),storage=()=>({getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)}),round={route:'classic',difficulty:'arcade',continues:0,score:98765};
assert.equal(saveRecord(storage,round).saved,true);assert.equal(readRecord(storage,'classic','arcade'),98765);saveRecord(storage,{...round,score:10});assert.equal(readRecord(storage,'classic','arcade'),98765);saveRecord(storage,{...round,continues:1,score:120000});assert.equal(readRecord(storage,'classic','arcade',true),120000);assert.equal(readRecord(storage,'extended','arcade'),0);
const denied=()=>{throw Error('Storage denied');};assert.equal(readRecord(denied,'classic','arcade'),0);assert.equal(saveRecord(denied,round).saved,false);memory.set(recordKey('classic','tour'),'Infinity');assert.equal(readRecord(storage,'classic','tour'),0);console.log('Records: persistence, best-only updates, continued/category isolation, corrupt values and storage-denied fallback passed.');
