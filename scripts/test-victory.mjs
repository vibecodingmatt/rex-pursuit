import assert from 'node:assert/strict';
import {VICTORY,victoryPose} from '../src/chase/victory.js';
for(const fps of [30,60,144])for(const distance of [10,19,24]){
 let previous=victoryPose(0,distance);
 for(let frame=1;frame<=Math.ceil((VICTORY.duration+1)*fps);frame++){
  const t=frame/fps,p=victoryPose(t,distance);
  assert.ok(Object.values(p).every(v=>typeof v==='boolean'||Number.isFinite(v)));
  assert.ok(p.black>=0&&p.black<=1&&p.caption>=0&&p.caption<=1&&p.speed>=0);
  if(t<VICTORY.arrival){assert.equal(p.arrival,false);assert.equal(p.jeepZ,0);}
  else{assert.ok(p.jeepZ<=previous.jeepZ,'Jeep keeps moving toward the entrance');assert.ok(Math.abs(p.jeepZ-previous.jeepZ)<.4,'Arrival path is continuous');assert.ok(Math.abs(p.jeepYaw-previous.jeepYaw)<.035,'Steering stays continuous');}
  if(t>=VICTORY.parked){assert.equal(p.jeepZ,-53);assert.ok(Math.abs(p.jeepX)<1e-6);assert.equal(p.speed,0);}
  if(t>=VICTORY.reveal&&t<=VICTORY.fade)assert.equal(p.black,0,'Drive and arrival remain visible');
  if(t>=VICTORY.black)assert.equal(p.black,1);
  if(p.complete)assert.ok(p.black===1&&p.speed===0&&p.arrival);
  previous=p;
 }
}
assert.equal(victoryPose(VICTORY.arrival-.001).black,1);
assert.equal(victoryPose(VICTORY.arrival).black,1,'Location edit happens under full black');
console.log('Victory timeline passed at 30/60/144 Hz: continuous drive/steering, visible arrival, stopped Jeep and blackout before results.');
