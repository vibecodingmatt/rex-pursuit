import assert from 'node:assert/strict';
import {aimPoint,touchAimOffset} from '../src/chase/pointer-controls.js';
for(const [width,height]of [[320,568],[390,844],[844,390],[768,1024]]){
 const offset=touchAimOffset(width,height);assert.ok(offset>=72&&offset<=96);
 const middle=aimPoint(width/2,height/2,width,height,true);assert.equal(middle.y,height/2-offset);
 for(let x=0;x<=width;x+=4)for(let y=0;y<=height;y+=4){
  const point=aimPoint(x,y,width,height,true);assert.ok(Math.hypot(point.x-x,point.y-y)>=offset*.75-1e-5,'Reticle never falls under the thumb, including at edges');
  assert.ok(point.x>=0&&point.x<=width&&point.y>=0&&point.y<=height,'Aim stays on screen');
 }
 assert.deepEqual(aimPoint(width/2,height/2,width,height,false),{x:width/2,y:height/2});
}
console.log('Touch aim passed: visible thumb clearance across portrait, landscape and tablet screens; direct mouse aim preserved.');
