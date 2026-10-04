import * as T from 'three';
import {rainMesh,RAIN_BOX} from '../chase/weather.js';
import {RAIN,WET,RAIN_TIME} from '../chase/weather-state.js';

// The finale's street in the rain: Pursuit's camera-relative streaks (weather.js), driven here without its
// storm lighting, which would fight the arcade's own stage light. `target` 0..1 fades it (0 under the
// rotunda's roof); drops run down the lens while it rains, and the gun's torch lights the streaks it crosses.
export class ArcadeRain {
 constructor(scene){
  const r=this.rain=rainMesh();r.mesh.visible=false;r.mesh.name='Arcade rain';scene.add(r.mesh);
  this.level=0;this.offset=new T.Vector3();this.forward=new T.Vector3();this.viewport=new T.Vector2();this.tint=new T.Color(.5,.58,.68);
 }
 reset(){this.level=0;this.rain.mesh.visible=false;RAIN.value=0;WET.value=0;}
 update(dt,{camera,renderer,post,speed=0,target=0,beam=null}){
  if(dt<=0)return;this.level+=(target-this.level)*Math.min(1,dt*1.5);if(this.level<.002&&!target)this.level=0;
  const w=this.level,r=this.rain,u=r.uniforms,on=w>.01;
  // Under a roof (target 0) the streaks stop at once; the drops on the lens fade with the level.
  RAIN.value=w;WET.value=w;RAIN_TIME.value=(RAIN_TIME.value+dt)%600;r.mesh.visible=on&&target>0;
  if(post){post.final.lensRain.value=w*.7;post.final.lensTime.value+=dt;}
  if(!on||!target)return;
  const fall=8.6,o=this.offset;u.vel.value.set(-.6,fall,speed);
  o.x=(o.x+u.vel.value.x*dt)%RAIN_BOX.x;o.y=(o.y-fall*dt)%(RAIN_BOX.y*600);o.z=(o.z+u.vel.value.z*dt)%RAIN_BOX.z;u.offset.value.copy(o);
  const f=this.forward;camera.getWorldDirection(f);f.y=0;if(f.lengthSq()<1e-4)f.set(0,0,1);f.normalize();
  u.boxMin.value.copy(camera.position).addScaledVector(f,RAIN_BOX.z*.5-4.5).sub(RAIN_BOX.clone().multiplyScalar(.5));u.boxMin.value.y=camera.position.y-RAIN_BOX.y*.42;
  renderer.getDrawingBufferSize(this.viewport);u.viewport.value.copy(this.viewport);u.minPx.value=Math.max(1,renderer.getPixelRatio()*.85);
  u.density.value=Math.min(1,w*1.15);u.tint.value.copy(this.tint);
  if(beam){u.beamPos.value.copy(beam.pos);u.beamDir.value.copy(beam.dir);u.beamCos.value=.955;u.beamTint.value.setRGB(1.6,1.45,1.2);}else u.beamTint.value.setRGB(0,0,0);
 }
}
