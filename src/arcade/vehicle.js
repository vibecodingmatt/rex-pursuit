import * as T from 'three';
import {createJeep} from '../chase/jeep.js';

// Pursuit's park Jeep, driven forward along the route with the warden at the wheel, and
// the spring-damper rig that carries the camera: braking dives, launch squat, cornering
// roll, terrain bumps, and hits that knock the camera away from where they land. The
// camera rides the Jeep rigidly, so the hood holds still in view while the world tilts.
// Water stages keep the old platform until the boat (A9).

/** The gunner's eye in Jeep coordinates (Jeep forward is -Z), standing in the rear tub. */
const EYE=new T.Vector3(0,2.7,.85);
class Spring{
 constructor(k,c){this.k=k;this.c=c;this.x=0;this.v=0;}
 step(target,dt){this.v+=(-this.k*(this.x-target)-this.c*this.v)*dt;this.x+=this.v*dt;return this.x;}
 reset(){this.x=this.v=0;}
}
const q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),offset=new T.Vector3();
export const WATER_STAGES=new Set(['river','lagoon']);

export class CircuitVehicle{
 constructor(world){
  this.world=world;this.jeep=createJeep(world.scene,{foldWindshield:true});const j=this.jeep;
  // The arcade aims its own gun from the camera; the Jeep's turret and gunner stay hidden.
  j.yaw.visible=false;j.gunner.visible=false;j.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  this.pitch=new Spring(55,8.5);this.roll=new Spring(65,9);this.heave=new Spring(110,13);this.yaw=new Spring(90,11);
  this.rig={pitch:0,roll:0,heave:0,yaw:0};this.lastSpeed=null;this.lastHeading=null;this.bump=0;this.visible=true;
 }
 /** A blow from world point `from` (or straight ahead): the camera is knocked away from it. */
 hit(from,strength=1){
  const cam=this.world.camera;let side=0,front=1;
  if(from){offset.subVectors(from,cam.position).applyQuaternion(q.copy(cam.quaternion).invert());const l=Math.hypot(offset.x,offset.z)||1;side=offset.x/l;front=-offset.z/l;}
  strength*=this.move??1;this.roll.v+=side*2.4*strength;this.yaw.v-=side*1.6*strength;this.pitch.v+=(.4+front*1.0)*strength;this.heave.v-=.9*strength;
 }
 reset(){for(const s of [this.pitch,this.roll,this.heave,this.yaw])s.reset();this.lastSpeed=this.lastHeading=null;}
 /**
  * Place the Jeep under the eye and step the rig. `eye` is the route camera point (no
  * crane or shake), `look` its aim point. Returns the rig offsets for the camera.
  */
 ride(dt,eye,look,{id,rough=1,move=1}){
  const water=WATER_STAGES.has(id);this.visible=!water;this.jeep.root.visible=!water;this.move=move;
  const heading=Math.atan2(look.x-eye.x,look.z-eye.z);
  if(dt>0){
   const speed=this.lastEye?Math.hypot(eye.x-this.lastEye.x,eye.z-this.lastEye.z)/dt:0,accel=this.lastSpeed===null?0:T.MathUtils.clamp((speed-this.lastSpeed)/dt,-30,30);
   const turn=this.lastHeading===null?0:Math.atan2(Math.sin(heading-this.lastHeading),Math.cos(heading-this.lastHeading))/dt;
   this.lastSpeed=speed;this.lastHeading=heading;
   // Washboard and potholes scale with the stage's roughness and with speed.
   this.bump+=dt*Math.min(1,speed/14);const b=this.bump,shake=rough*Math.min(1,speed/20)*move;
   const ground=(Math.sin(b*23)*.6+Math.sin(b*37+1.3)*.3+Math.max(0,Math.sin(b*3.1))**12*2.4)*.018*shake;
   // Braking dives the nose (camera tips down), launching squats it; the body rolls out of turns.
   this.rig.pitch=this.pitch.step(T.MathUtils.clamp(accel*.0035,-.06,.06)*move+Math.sin(b*17.3)*.004*shake,dt);
   this.rig.roll=this.roll.step(T.MathUtils.clamp(speed*turn*.006,-.05,.05)*move+Math.sin(b*13.1+.7)*.005*shake,dt);
   this.rig.heave=this.heave.step(ground,dt);this.rig.yaw=this.yaw.step(0,dt);
  }
  this.lastEye=(this.lastEye||new T.Vector3()).copy(eye);
  // Jeep forward is -Z: face it down the route, tilted with the rig, its eye on the camera point.
  const j=this.jeep.root;e.set(this.rig.pitch,heading+Math.PI+this.rig.yaw,this.rig.roll);j.quaternion.setFromEuler(e);
  j.position.copy(eye).sub(offset.copy(EYE).applyQuaternion(j.quaternion));j.position.y+=this.rig.heave;j.updateMatrixWorld(true);
  this.jeep.driver.update(dt,this.world.time,this.lastSpeed||0,true);
  return this.rig;
 }
}
