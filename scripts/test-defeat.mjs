import assert from 'node:assert/strict';
import {DEFEAT,defeatPose,swallowPose} from '../src/chase/defeat.js';
for(const fps of [30,60,144])for(const start of [{x:0,z:19,heading:Math.PI,speed:10},{x:1,z:10,heading:3.3,speed:1}]){
 let last=defeatPose(0,start),wideJawTime=0,peakLungeSpeed=0;
 for(let frame=1;frame<=Math.ceil(DEFEAT.duration*fps);frame++){
  const t=frame/fps,p=defeatPose(t,start);assert.ok(Object.values(p).every(Number.isFinite));
  assert.ok(p.jeepYaw>=last.jeepYaw&&p.jeepYaw<=Math.PI*2,'Spin proceeds forward exactly once');
  assert.ok(Math.hypot(p.x-last.x,p.z-last.z)<24/fps,'Rex never teleports');
  if(t>=DEFEAT.spinEnd){assert.equal(p.jeepYaw,Math.PI*2);assert.equal(p.speed,0);}
  if(t>=DEFEAT.walkAt&&t<DEFEAT.lookAt){
   const dx=p.x-last.x,dz=p.z-last.z,speed=Math.hypot(dx,dz)*fps;
   assert.ok(speed<3.5,'Final approach is a walking pace');
   if(speed>.05)assert.ok((dx*Math.sin(p.heading)+dz*Math.cos(p.heading))/Math.hypot(dx,dz)>.995,'Body faces the curved walking path instead of crossing sideways over planted feet');
  }
  if(t<DEFEAT.openAt)assert.equal(p.jaw,0,'She approaches and looks with her jaw relaxed');
  if(t>=DEFEAT.lookAt&&t<DEFEAT.openAt){assert.ok(Math.abs(p.x+1.45)<1e-9);assert.equal(p.z,9.9);}
  if(p.jaw>.85)wideJawTime+=1/fps;
  if(t>=DEFEAT.lungeAt&&t<DEFEAT.contact)peakLungeSpeed=Math.max(peakLungeSpeed,(last.z-p.z)*fps);
  if(t<DEFEAT.contact-.045)assert.equal(p.blood,0);
  if(t>=DEFEAT.contact+.42)assert.equal(p.blood,0,'Impact red clears so the throat remains visible');
  assert.ok(p.swallow>=last.swallow&&p.swallow<=1,'Swallow moves forward continuously');
  if(t<DEFEAT.slideAt)assert.equal(p.swallow,0,'Player stays in the mouth until the head lift triggers the slide');
  if(t<DEFEAT.headLiftAt)assert.equal(p.headLift,0,'A still beat separates contact from the swallowing head lift');
  assert.ok((p.swallow-last.swallow)*fps*10.5<5,'Descent stays below five scene metres per second');
  if(t<DEFEAT.bellyAt-.15)assert.equal(p.black,0,'Darkness follows the interior slide');
  if(t>=DEFEAT.black)assert.equal(p.black,1);last=p;
 }
 assert.ok(wideJawTime<.55,'The mouth is held wide for less than half a second');assert.ok(peakLungeSpeed>10,'The gulp is a distinct fast lunge');assert.ok(defeatPose(DEFEAT.lungeAt,start).rear>.95,'The head draws back before lunging');
}
assert.ok(DEFEAT.ram<DEFEAT.spinEnd&&DEFEAT.spinEnd<DEFEAT.walkAt&&DEFEAT.walkAt<DEFEAT.contact&&DEFEAT.black<DEFEAT.duration);
assert.ok(DEFEAT.headLiftAt-DEFEAT.contact>.6&&DEFEAT.slideAt-DEFEAT.contact>1.2,'Mouth hold precedes the slide by more than a second');
assert.ok(swallowPose(DEFEAT.slideAt).lift>.75,'The head is mostly lifted before gravity takes over');
assert.ok(DEFEAT.bellyAt-DEFEAT.slideAt>=3.2,'Throat descent lasts at least 3.2 seconds');
console.log('Defeat timeline passed at 30/60/144 Hz: ram/spin, walk, gape/gulp, still mouth hold, head lift before a slower descent, and held blackout.');
