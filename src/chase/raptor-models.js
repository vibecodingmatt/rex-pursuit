import * as T from 'three';
import {createRaptors} from '../ravine/raptors.js';

// Keep the encounter's positions, health and body physics; render them with the
// same authored hide and skeleton as Ravine. Safari's forward axis is +Z.
const UNITS=4.4,flip=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
export async function loadRaptorModels(scene,kind){
 const pack=await createRaptors(scene,{capacity:kind.max,trackDynamics:false});
 const local=new T.Vector3(),q=new T.Quaternion();let detail=true;
 kind.pool.forEach((c,i)=>{c.rig=pack.pool[i];c.rig.root.name='Ravine raptor';c.rig.baseColors=c.rig.meshes.map(m=>{m.material=m.material.clone();return m.material.color.clone();});});
 const sample=kind.pool[0];sample.scale=UNITS;sample.phase=0;sample.stride=0;sample.p.set(0,0,0);sample.yaw=0;
 render(sample,true);
 kind.centre=sample.rig.body.y/UNITS;
 kind.hull=sample.rig.contacts.flatMap(({mesh,points})=>points.map(({index})=>{
  mesh.getVertexPosition(index,local);local.applyMatrix4(mesh.matrixWorld).divideScalar(UNITS);local.y-=kind.centre;return local.clone();
 }));
 kind.hitR=.76/UNITS;
 kind.strideLength=4.706/UNITS;
 // Existing sphere consumers (blast size, diagnostics) retain model units.
 kind.spheres=[{p:new T.Vector3(0,kind.centre,0),r:kind.hitR}];
 kind.collisionHull=[[0,.16,0,.145],...[[12,.16],[14,.11],[16,.13],[0,.11],[3,.09],[6,.07],[1,.05],[9,.035]].map(([n,r])=>{
  sample.rig.bones[n?`Bone${String(n).padStart(3,'0')}`:'Bone'].getWorldPosition(local).divideScalar(UNITS);return [...local.toArray(),r];
 })];
 sample.rig.root.visible=false;
 function refresh(a){a.root.updateMatrixWorld(true);a.bones.Bone016.getWorldPosition(a.head);a.bones.Bone012.getWorldPosition(a.body);}
 function render(c,force=false){
  const a=c.rig;a.root.visible=force||c.on&&kind.visible!==false;if(!a.root.visible)return;
  a.root.scale.setScalar(c.scale/UNITS*Math.max(0,c.fade));
  if(c.state==='dead'){
   // Freeze the articulated impact pose; the established body physics owns
   // translation and rotation, avoiding a rest-pose snap on the lethal frame.
   a.root.quaternion.copy(c.q).multiply(flip);
   a.root.position.copy(c.p).sub(local.set(0,kind.centre*c.scale*Math.max(0,c.fade),0).applyQuaternion(c.q));
  }else{
   const boarded=c.poseState==='board',alert=boarded?T.MathUtils.smoothstep(c.poseAge,0,.3):0;
   pack.pose(a,{x:c.p.x,z:c.p.z,groundY:c.p.y,yaw:c.yaw+Math.PI,phase:(c.stride||0)<.2?'idle':'run',age:c.poseTime??c.timer??0,seed:0,posePhase:c.phase,leapAmount:Math.max(0,-c.curl),airLift:0,focus:false,alert,reach:boarded?.5*alert:undefined,bank:c.roll,flash:c.flinch*.16,side:c.flinchSide,crouch:c.crouch,look:c.look,pant:c.pant,recoil:c.recoil,hitHead:c.hitHead});
   a.root.visible=force||c.on&&kind.visible!==false;
  }
  a.meshes.forEach((m,i)=>{m.castShadow=detail;m.material.color.copy(a.baseColors[i]);if(c.species==='ghostRaptor'&&m.name==='Dromaeosaur')m.material.color.setRGB(1.9,2.5,3.2);});
  refresh(a);
 }
 return {pack,render,reset(){for(const a of pack.pool)a.root.visible=false;},setQuality(t){detail=!!t.detail;},
  captureHull(c){const a=c.rig;q.copy(c.q).invert();c.deathHull=a.contacts.flatMap(({mesh,points})=>points.map(({index})=>{mesh.getVertexPosition(index,local);return local.applyMatrix4(mesh.matrixWorld).sub(c.p).applyQuaternion(q).divideScalar(c.scale).clone();}));},
  hit(c,ray,far,minAngle){let best=null;const a=c.rig;for(const [p,r]of [[a.body,.76],[a.head,.57]]){const along=local.subVectors(p,ray.origin).dot(ray.direction),radius=Math.max(r*c.scale/UNITS,along*minAngle),d2=ray.distanceSqToPoint(p);if(along<=0||d2>radius*radius)continue;const distance=along-Math.sqrt(radius*radius-d2);if(distance>far||best&&distance>=best.distance)continue;best={critter:c,kind:c.species,distance,point:ray.at(distance,new T.Vector3())};}return best;}
 };
}
