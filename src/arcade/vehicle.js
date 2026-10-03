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
const q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),offset=new T.Vector3(),up=new T.Vector3();
function texture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
function rng(seed){return()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};}
/** Three raking claw gouges: bright steel in the groove, dark torn paint at the lips. */
function clawTexture(seed){return texture(256,256,(x,w,h)=>{const r=rng(seed);
 for(let i=0;i<3;i++){const x0=60+i*52+r()*14,bend=r()*40-20;
  for(const [width,color]of [[13,'rgba(28,20,12,.75)'],[7,'rgba(92,86,76,.95)'],[3,'rgba(205,205,196,.95)']]){x.strokeStyle=color;x.lineWidth=width;x.lineCap='round';x.beginPath();x.moveTo(x0,24+r()*20);x.quadraticCurveTo(x0+bend,h/2,x0+bend*.4+10,h-30-r()*30);x.stroke();}
  for(let k=0;k<14;k++){x.fillStyle='rgba(194,179,136,.9)';x.fillRect(x0+r()*24-12,30+r()*(h-60),2+r()*4,1+r()*3);}}
});}
/** Impact stars with radiating and ring cracks on the windshield. */
function crackTexture(){return texture(512,256,(x,w,h)=>{const r=rng(5);x.lineCap='round';
 for(const [cx,cy,n]of [[150,110,15],[370,150,11],[260,60,7]]){x.fillStyle='rgba(235,240,236,.85)';x.beginPath();x.arc(cx,cy,5,0,7);x.fill();
  for(let i=0;i<n;i++){let a=i/n*Math.PI*2+r()*.3,px=cx,py=cy;x.strokeStyle=`rgba(240,244,240,${.7+r()*.3})`;x.lineWidth=2+r()*2.2;x.beginPath();x.moveTo(px,py);
   for(let s=0;s<6;s++){a+=r()*.5-.25;const l=12+r()*30;px+=Math.cos(a)*l;py+=Math.sin(a)*l;x.lineTo(px,py);}x.stroke();}
  for(const rad of [18,34,55]){x.strokeStyle='rgba(240,244,240,.6)';x.lineWidth=1.6;x.beginPath();const a0=r()*6;x.arc(cx,cy,rad+r()*6,a0,a0+2+r()*3);x.stroke();}}
});}
function decal(map,size){const m=new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,roughness:.45,metalness:.3,opacity:0});const mesh=new T.Mesh(new T.PlaneGeometry(...size),m);mesh.visible=false;return mesh;}
export const WATER_STAGES=new Set(['river','lagoon']);

export class CircuitVehicle{
 constructor(world){
  this.world=world;this.jeep=createJeep(world.scene,{foldWindshield:true});const j=this.jeep;
  // The arcade aims its own gun from the camera; the Jeep's turret and gunner stay hidden.
  j.yaw.visible=false;j.gunner.visible=false;
  // The road wheels never enter the gunner's view; only the merged body panels cast shadows.
  for(const o of j.root.children)if(o!==j.body)o.visible=false;
  j.root.traverse(o=>{if(o.isMesh){o.castShadow=o.parent===j.body;o.receiveShadow=true;}});
  this.pitch=new Spring(55,8.5);this.roll=new Spring(65,9);this.heave=new Spring(110,13);this.yaw=new Spring(90,11);
  // A8: a sideways shove (the Triceratops' horn lock) slides the whole Jeep and camera.
  this.slide=new Spring(60,13);this.push=0;
  this.rig={pitch:0,roll:0,heave:0,yaw:0,slide:0};this.lastSpeed=null;this.lastHeading=null;this.bump=0;this.visible=true;this.smokeWait=0;
  // Damage shows on the Jeep: claw scrapes on the hood as integrity falls, the folded
  // windshield cracks below 50%, and the engine smokes below 25%.
  this.scrapes=[[.42,-1.42,.4,85],[-.5,-1.62,-.5,70],[.08,-1.25,.25,55]].map(([x,z,turn,below],i)=>{const d=decal(clawTexture(11+i*7),[.55,.55]);d.position.set(x,1.395,z);d.rotation.set(-Math.PI/2,0,turn);d.userData.below=below;j.body.add(d);return d;});
  const hinge=this.hinge=new T.Group();hinge.position.set(0,1.45,-1.03);hinge.rotation.x=-1.6;j.body.add(hinge);
  this.crack=decal(crackTexture(),[1.55,.7]);this.crack.position.set(0,.44,.07);this.crack.rotation.x=.18;this.crack.translateZ(.012);this.crack.material.side=T.DoubleSide;hinge.add(this.crack);
 }
 /** Integrity (0-100) to visible damage; hood smoke needs `this.effects` (renderer). */
 damage(hp,dt){
  for(const d of this.scrapes){const o=T.MathUtils.clamp((d.userData.below-hp)/8,0,1);d.visible=o>0;d.material.opacity=o;}
  const c=T.MathUtils.clamp((50-hp)/22,0,1);this.crack.visible=c>0;this.crack.material.opacity=c;
  // A heavy blow has knocked the folded windshield frame askew (the arcade's dent).
  const bent=T.MathUtils.clamp((65-hp)/30,0,1);this.dent=(this.dent??0)+(bent-(this.dent??0))*Math.min(1,dt*6);this.hinge.rotation.set(-1.6+this.dent*.05,this.dent*.07,-this.dent*.06);this.crackFrame?.rotation.copy(this.hinge.rotation);
  if(hp<25&&this.effects&&this.visible&&dt>0&&(this.smokeWait-=dt)<=0){const heavy=1-hp/25;this.smokeWait=.07-.035*heavy;
   const j=this.jeep.body;j.localToWorld(offset.set((Math.random()-.5)*.7,1.55,-1.7));up.set(0,0,-1).transformDirection(j.matrixWorld).multiplyScalar(this.lastSpeed||0);up.y+=2.2+heavy;
   this.effects.haze(offset,up,{life:1.6+heavy,size:.8,growth:3.5,opacity:.28+.24*heavy,color:heavy>.6?0x2a2724:0x5a5550,drag:.25,rise:.8});}
 }
 /** A blow from world point `from` (or straight ahead): the camera is knocked away from it. */
 hit(from,strength=1){
  const cam=this.world.camera;let side=0,front=1;
  if(from){offset.subVectors(from,cam.position).applyQuaternion(q.copy(cam.quaternion).invert());const l=Math.hypot(offset.x,offset.z)||1;side=offset.x/l;front=-offset.z/l;}
  strength*=this.move??1;this.roll.v+=side*2.4*strength;this.yaw.v-=side*1.6*strength;this.pitch.v+=(.4+front*1.0)*strength;this.heave.v-=.9*strength;
 }
 /** Sideways shove target in metres (+ is the camera's right); a pusher sets it every frame it pushes. */
 shove(x){this.push=x;}
 reset(){for(const s of [this.pitch,this.roll,this.heave,this.yaw,this.slide])s.reset();this.push=0;this.rig.slide=0;this.lastSpeed=this.lastHeading=null;}
 /**
  * Place the Jeep under the eye and step the rig. `eye` is the route camera point (no
  * crane or shake), `look` its aim point. Returns the rig offsets for the camera.
  */
 ride(dt,eye,look,{id,rough=1,move=1,hp=100}){
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
   // A shove slides the Jeep and swings its nose with the push.
   this.rig.heave=this.heave.step(ground,dt);this.rig.yaw=this.yaw.step(-this.push*.055*move,dt);this.rig.slide=this.slide.step(this.push*move,dt);this.push=0;
  }
  this.lastEye=(this.lastEye||new T.Vector3()).copy(eye);
  if(this.rig.slide){const dx=-Math.cos(heading)*this.rig.slide,dz=Math.sin(heading)*this.rig.slide;eye.x+=dx;eye.z+=dz;look.x+=dx;look.z+=dz;}
  // Jeep forward is -Z: face it down the route, tilted with the rig, its eye on the camera point.
  const j=this.jeep.root;e.set(this.rig.pitch,heading+Math.PI+this.rig.yaw,this.rig.roll);j.quaternion.setFromEuler(e);
  j.position.copy(eye).sub(offset.copy(EYE).applyQuaternion(j.quaternion));j.position.y+=this.rig.heave;j.updateMatrixWorld(true);
  this.jeep.driver.update(dt,this.world.time,this.lastSpeed||0,true);this.damage(hp,dt);
  return this.rig;
 }
}
