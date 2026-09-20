import assert from 'node:assert/strict';
import {DEFEAT,defeatPose} from '../src/chase/defeat.js';
for(const fps of [30,60,144])for(const start of [{x:0,z:19,heading:Math.PI,speed:10},{x:1,z:10,heading:3.3,speed:1}]){
 let last=defeatPose(0,start),wideJawTime=0,peakLungeSpeed=0;
 for(let frame=1;frame<=Math.ceil(DEFEAT.duration*fps);frame++){
  const t=frame/fps,p=defeatPose(t,start);assert.ok(Object.values(p).every(Number.isFinite));
  assert.ok(p.jeepYaw>=last.jeepYaw&&p.jeepYaw<=Math.PI*2,'Spin proceeds forward exactly once');
  assert.ok(Math.hypot(p.x-last.x,p.z-last.z)<24/fps,'Rex never teleports');
  if(t>=DEFEAT.spinEnd){assert.equal(p.jeepYaw,Math.PI*2);assert.equal(p.speed,0);}
  if(t>=DEFEAT.walkAt&&t<DEFEAT.lookAt)assert.ok(Math.hypot(p.x-last.x,p.z-last.z)*fps<3.5,'Final approach is a walking pace');
  if(t<DEFEAT.openAt)assert.equal(p.jaw,0,'She approaches and looks with her jaw relaxed');
  if(t>=DEFEAT.lookAt&&t<DEFEAT.openAt){assert.equal(p.x,-1.4500000000000002);assert.equal(p.z,9.9);}
  if(p.jaw>.85)wideJawTime+=1/fps;
  if(t>=DEFEAT.lungeAt&&t<DEFEAT.contact)peakLungeSpeed=Math.max(peakLungeSpeed,(last.z-p.z)*fps);
  if(t<DEFEAT.contact-.045)assert.equal(p.blood,0);
  if(t>=DEFEAT.black)assert.equal(p.black,1);last=p;
 }
 assert.ok(wideJawTime<.55,'The mouth is held wide for less than half a second');assert.ok(peakLungeSpeed>10,'The gulp is a distinct fast lunge');assert.ok(defeatPose(DEFEAT.lungeAt,start).rear>.95,'The head draws back before lunging');
}
assert.ok(DEFEAT.ram<DEFEAT.spinEnd&&DEFEAT.spinEnd<DEFEAT.walkAt&&DEFEAT.walkAt<DEFEAT.contact&&DEFEAT.black<DEFEAT.duration);
console.log('Defeat timeline passed at 30/60/144 Hz: continuous ram/spin, walking approach, closed-jaw stare, brief gape, head-back windup, fast gulp and held blackout.');
