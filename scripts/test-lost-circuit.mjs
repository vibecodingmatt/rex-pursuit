import assert from 'node:assert/strict';
import {Circuit,project,recordKey,grade,BEATS,STAGES} from '../src/arcade/rules.js';
import {readRecord,saveRecord} from '../src/arcade/records.js';
for(const st of STAGES){assert.equal(BEATS[st.id]?.length,3,`${st.id}: three beat sheets`);for(const sheet of BEATS[st.id])sheet.forEach((b,i)=>assert(i===0||b[0]>sheet[i-1][0],`${st.id}: beats in order`));}
{const run=seed=>{const g=new Circuit({route:'classic',seed});const beats=[];for(let i=0;i<60*40&&g.stageIndex===0;i++){g.update(1/60);for(const e of g.drain())if(e.type==='beat')beats.push(e.pattern);}return{variant:g.variant,beats};};
 const a=run(94),b=run(94);assert.equal(a.variant,b.variant,'A seed replays the same beat sheet');assert.deepEqual(a.beats,b.beats);assert(a.beats.length>=3,'The gates stage plays its beats');
 assert(new Set([94,1234,98765,5551,31337,2024,777,4242,123456].map(s=>run(s).variant)).size>1,'Seeds vary the beat sheet');}
for(const fps of [30,60,120])for(const route of ['classic','extended'])for(const aspect of [16/9,390/844]){
 const g=new Circuit({route});let limit=0,maxLive=0;const stages=new Set();
 while(g.status==='playing'&&limit<900*fps){
  g.update(1/fps);stages.add(g.stage.id);maxLive=Math.max(maxLive,g.entities.filter(e=>e.kind!=='galli').length);
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
{const g=new Circuit();g.phase='ride';g.drain();const s=g.spawn('spit');s.age=s.life-.01;g.update(.02);const ev=g.drain();assert(ev.some(e=>e.type==='splat'&&e.id===s.id),'Unshot spit splats the windshield');assert(ev.some(e=>e.type==='damage'),'and it still hurts');}
{const g=new Circuit();g.phase='ride';g.beat('flank','raptor',2);const l=g.entities.find(e=>e.leaper);assert(l&&g.entities.filter(e=>e.leaper).length===1,'A flank sends one leaper');g.drain();l.age=l.leapAt-.01;g.update(.02);assert(g.drain().some(e=>e.type==='leap'&&e.id===l.id),'The leap is announced');l.age=l.life-.01;const hp=g.hp;g.update(.02);assert.equal(hp-g.hp,16,'An unshot leaper bites');}
const miss=new Circuit();assert(miss.shoot(0,0));assert.equal(miss.hits,0);assert.equal(miss.shoot(0,0),false,'Fire cadence cannot be bypassed');
for(const slowed of [false,true]){
 const ride=new Circuit({route:'classic'});ride.stageIndex=2;ride.phase='ride';ride.stageTime=18.8;ride.travel=400;ride.focusTime=slowed?5:0;ride.drain();
 while(!ride.bridgeBroken)ride.update(1/60);
 assert(Math.abs(ride.bridgeOrigin-ride.travel-30)<.001,'Bridge collapse stays ahead of the vehicle, including during Overdrive');
 const origin=ride.bridgeOrigin;for(let i=0;i<60;i++)ride.update(1/60);
 assert.equal(ride.bridgeOrigin,origin,'Gap remains anchored to the terrain');assert.equal(ride.drain().filter(e=>e.type==='bridge').length,1,'Collapse fires once');
 assert(ride.entities.filter(e=>!['rock','supply','barrel'].includes(e.kind)).every(e=>e.kind==='ptero'),'Air threats replace ground charges over the broken bridge');
}
miss.hp=60;const supply=miss.spawn('supply');supply.age=3;miss.pose(supply);const p=project(supply,16/9);miss.cooldown=0;miss.shoot(p.hx,p.hy);assert.equal(miss.hp,82);
miss.focus=100;assert(miss.activateFocus());assert.equal(miss.activateFocus(),false);assert.equal(miss.focus,0);
console.log('Lost Circuit rules: complete routes, phone targets, frame rates, loss/continues, fire cadence, repairs, boss interrupts and record separation passed.');
const memory=new Map(),storage=()=>({getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)}),round={route:'classic',difficulty:'arcade',continues:0,score:98765};
assert.equal(saveRecord(storage,round).saved,true);assert.equal(readRecord(storage,'classic','arcade'),98765);saveRecord(storage,{...round,score:10});assert.equal(readRecord(storage,'classic','arcade'),98765);saveRecord(storage,{...round,continues:1,score:120000});assert.equal(readRecord(storage,'classic','arcade',true),120000);assert.equal(readRecord(storage,'extended','arcade'),0);
const denied=()=>{throw Error('Storage denied');};assert.equal(readRecord(denied,'classic','arcade'),0);assert.equal(saveRecord(denied,round).saved,false);memory.set(recordKey('classic','tour'),'Infinity');assert.equal(readRecord(storage,'classic','tour'),0);console.log('Records: persistence, best-only updates, continued/category isolation, corrupt values and storage-denied fallback passed.');
