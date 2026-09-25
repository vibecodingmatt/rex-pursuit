import assert from 'node:assert/strict';
import {DEFEAT,INTERIOR,defeatPose,swallowPose,stomachPlunge,interiorPath,defeatVision} from '../src/chase/defeat.js';
for(const fps of [30,60,144])for(const start of [{x:0,z:19,heading:Math.PI,speed:10},{x:1,z:10,heading:3.3,speed:1}]){
 let last=defeatPose(0,start),wideJawTime=0,peakLungeSpeed=0;
 for(let frame=1;frame<=Math.ceil(DEFEAT.duration*fps);frame++){
  const t=frame/fps,p=defeatPose(t,start);assert.ok(Object.values(p).every(Number.isFinite));
  const blur=defeatVision(t);assert.ok(Number.isFinite(blur)&&blur>=0&&blur<=1);
  assert.ok(Math.abs(blur-defeatVision(t-1/fps))<6/fps,'Impact blur ramps in without a one-frame jump');
  if(t<=DEFEAT.ram||t>=DEFEAT.lungeAt-.10)assert.equal(blur,0,'Clear before impact and before the lunge/interior');
  if(t>=DEFEAT.ram+.28+1/fps)assert.ok(blur<=defeatVision(t-1/fps),'Vision steadily recovers after impact without a second blur pulse');
  if(t>=DEFEAT.walkAt&&t<DEFEAT.lungeAt-.10)assert.ok(blur>0,'Recovery continues into the final approach');
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
  assert.ok((p.swallow-last.swallow)*fps*(INTERIOR.esophagus-INTERIOR.start)<8,'Descent stays below eight scene metres per second');
  if(t<=DEFEAT.acidAt)assert.equal(p.black,0,'No blackout until the player hits the acid');
  if(t>=DEFEAT.black)assert.equal(p.black,1);last=p;
 }
 assert.ok(wideJawTime<.55,'The mouth is held wide for less than half a second');assert.ok(peakLungeSpeed>10,'The gulp is a distinct fast lunge');assert.ok(defeatPose(DEFEAT.lungeAt,start).rear>.95,'The head draws back before lunging');
}
assert.ok(DEFEAT.ram<DEFEAT.spinEnd&&DEFEAT.spinEnd<DEFEAT.walkAt&&DEFEAT.walkAt<DEFEAT.contact&&DEFEAT.black<DEFEAT.duration);
assert.ok(DEFEAT.headLiftAt-DEFEAT.contact>.35&&DEFEAT.slideAt-DEFEAT.contact>.75,'A short mouth hold precedes the slide');
assert.ok(swallowPose(DEFEAT.slideAt).lift>.75,'The head is mostly lifted before gravity takes over');
assert.ok(DEFEAT.bellyAt-DEFEAT.slideAt>=1.7&&DEFEAT.bellyAt-DEFEAT.slideAt<=2.2,'The esophagus takes about two seconds');
assert.ok(DEFEAT.plungeAt-DEFEAT.bellyAt>=1,'The stomach is on screen for at least a second before the plunge');
assert.equal(stomachPlunge(DEFEAT.plungeAt).travel,0);
assert.equal(stomachPlunge(DEFEAT.acidAt).travel,1,'The plunge reaches the acid at the splash cue');
for(const fps of [30,60,144]){
 let lastY=null,lastTravel=0;
 for(let t=DEFEAT.plungeAt;t<DEFEAT.black;t+=1/fps){
  const p=stomachPlunge(t),y=interiorPath(t).y;
  assert.ok(Object.values(p).every(Number.isFinite));assert.ok(p.travel>=lastTravel);
  if(lastY!==null){assert.ok(y<lastY,'The camera keeps descending through the chamber without a hover');assert.ok((lastY-y)*fps<5,'The final drop stays continuous at different frame rates');}
  if(t<=DEFEAT.acidAt){assert.equal(defeatPose(t,{x:0,z:19,heading:Math.PI}).black,0,'No fade above the pool');assert.equal(p.immersion,0,'No underwater wash above the acid');}
  else assert.ok(y<INTERIOR.acid,'The camera is submerged when blackout begins');
  lastY=y;lastTravel=p.travel;
 }
}
const epsilon=.0001,leftSpeed=(stomachPlunge(DEFEAT.acidAt).travel-stomachPlunge(DEFEAT.acidAt-epsilon).travel)/epsilon,rightSpeed=(stomachPlunge(DEFEAT.acidAt+epsilon).travel-stomachPlunge(DEFEAT.acidAt).travel)/epsilon;
assert.ok(Math.abs(leftSpeed-rightSpeed)<.002,'Fluid drag takes over without a velocity jump at impact');
assert.equal(defeatVision(DEFEAT.ram+.28),1,'The impact reaches full shock strength');
assert.ok(defeatVision(DEFEAT.spinEnd)<.75&&defeatVision(DEFEAT.spinEnd)>.5,'Noticeable recovery begins during the spin');
assert.ok(defeatVision(DEFEAT.lookAt)<.2,'Most focus has returned as the Rex reaches the player');
assert.ok(defeatVision(DEFEAT.openAt)>.03,'A trace of softness remains at the start of the windup');
assert.ok(defeatVision(DEFEAT.ram+.10)>.25,'Vision blurs immediately after the Jeep is hit');
assert.equal(defeatVision(DEFEAT.lungeAt-.10),0,'Focus resolves one brief beat before the attack');
console.log('Defeat timeline passed at 30/60/144 Hz: ram/spin, vision recovery, gape/gulp, mouth hold and head lift, continuous slide into acid, then held blackout.');
