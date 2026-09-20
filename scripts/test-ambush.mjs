import assert from 'node:assert/strict';
import {Encounter,RULES} from '../src/chase/combat.js';
import {AMBUSH,ambushPose} from '../src/chase/ambush.js';
const step=(s,t,fps)=>{for(let i=0;i<Math.ceil(t*fps);i++)s.tick(1/fps);};
let previousPose=ambushPose(0);
for(let t=1/60;t<AMBUSH.duration;t+=1/60){const p=ambushPose(t);assert.equal(p.visible,true);assert.ok(p.x>=0);assert.ok(Math.hypot(p.x-previousPose.x,p.z-previousPose.z)<.3,'The concealed route must remain continuous');previousPose=p;}
for(const fps of [30,60,144]){
 for(const trigger of ['time','health']){
  const s=new Encounter();s.transition('pursuit');s.phaseTime=1;s.nextDebris=Infinity;s.ammo=17;
  if(trigger==='time')s.fightTime=45;else s.health=RULES.health*.5;
  s.tick(1/fps);assert.equal(s.phase,'flank');assert.equal(s.ambushPlayed,true);
  const clock=s.fightTime,health=s.health,jeep=s.jeep;
  assert.equal(s.fire(),false);assert.equal(s.launch(),false);assert.equal(s.startReload(),true);
  step(s,4,fps);assert.equal(s.phase,'flank');assert.equal(ambushPose(s.phaseTime).occluded,true);assert.equal(s.ammo,80);assert.equal(s.fightTime,clock);
  while(s.phase==='flank'&&s.phaseTime<AMBUSH.fireAt)s.tick(1/fps);
  assert.equal(s.fire(),true);assert.equal(s.health,health);assert.equal(s.jeep,jeep);
  while(s.phase==='flank')s.tick(1/fps);
  assert.equal(s.phase,'warning');assert.equal(s.distance,9.8);assert.equal(s.fightTime,clock);
  const events=s.drainEvents();for(const cue of ['flank','contact-lost','ambush-rustle','ambush-crash'])assert.equal(events.filter(e=>e===cue).length,1);
  step(s,RULES.warning+.05,fps);assert.equal(s.phase,'challenge');assert.equal(s.objective.current,0);assert.ok(s.objective.remaining>s.objective.duration-.1);
  s.transition('pursuit');s.phaseTime=1;s.tick(1/fps);assert.equal(s.phase,'pursuit','The cinematic happens only once');
  s.reset();assert.equal(s.ambushPlayed,false);assert.equal(s.ambush,null);
 }
 const queued=new Encounter();queued.nextDebris=Infinity;queued.fightTime=45;queued.beginChallenge();step(queued,.5,fps);assert.equal(queued.phase,'challenge');
 for(const id of queued.objective.order)queued.hitTarget(id,true);
 step(queued,.5,fps);assert.equal(queued.phase,'flank','Waits until the target sequence is finished');
 const branch=new Encounter();branch.transition('pursuit');branch.distance=20;branch.spawnDebris();branch.fightTime=45;
 assert.equal(branch.debris.status,'attached');assert.equal(branch.hitDebris(branch.debris.id,true),false);
 while(branch.debris.status==='attached')branch.tick(1/fps);
 assert.equal(branch.phase,'pursuit');assert.ok(Math.abs(branch.debris.branchZ-(branch.distance-6.55))<.3);
 assert.equal(branch.debris.age,0,'The shooting window begins at the physical break');
 const e=branch.drainEvents();assert.ok(e.indexOf('branch-break')<e.indexOf('debris-incoming'));
 branch.hitDebris(branch.debris.id,true);branch.tick(1/fps);assert.equal(branch.phase,'flank','A projectile is never abandoned in midair');
}
console.log('Cinematic rules passed at 30/60/144 Hz: both midpoint triggers, deferred objectives/debris, reload, held clock, single return, full attack window, reset and physical branch contact.');
