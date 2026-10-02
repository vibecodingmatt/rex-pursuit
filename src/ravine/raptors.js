import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const UP=new T.Vector3(0,1,0),X=new T.Vector3(1,0,0),Z=new T.Vector3(0,0,1);
const smooth=T.MathUtils.smoothstep;
// The CC0 source has a real weighted skeleton. Keep the authored hide/UVs;
// articulate that skeleton, with ground-relative feet and a counterbalancing tail.
export async function createRaptors(scene){
 const gltf=await new GLTFLoader().loadAsync('./models/raptor-ravine.glb');
 const template=gltf.scene;template.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(template),scale=5.8/(bounds.max.z-bounds.min.z),floor=-bounds.min.y*scale;
 template.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false;o.material.roughness=o.name==='Eye'?.23:.8;o.material.envMapIntensity=.3;if(o.material.map)o.material.map.anisotropy=8;if(o.material.normalMap){o.material.normalMap.anisotropy=8;o.material.normalScale.set(.65,.65);}if(o.name==='Dromaeosaur')o.material.color.setRGB(.79,.83,.7);}});
 const pool=[];const q=new T.Quaternion(),pq=new T.Quaternion(),v1=new T.Vector3(),v2=new T.Vector3(),p0=new T.Vector3(),p1=new T.Vector3(),p2=new T.Vector3();
 function make(){
  const root=new T.Group(),model=clone(template);root.add(model);scene.add(root);model.scale.setScalar(scale);model.position.set(0,floor,.84*scale);root.updateMatrixWorld(true);
  const bones={},rest={},meshes=[];model.traverse(o=>{if(o.isBone){bones[o.name]=o;rest[o.name]={q:o.quaternion.clone(),p:o.position.clone()};}if(o.isMesh)meshes.push(o);});
  // GLTFLoader sanitizes periods from Blender bone names.
  const legs=[['Bone.022','Bone.023','Bone.040'],['Bone.041','Bone.042','Bone.043']].map(names=>names.map(n=>bones[n]||bones[n.replaceAll('.','')]));
  const footRest=legs.map(l=>root.worldToLocal(l[2].getWorldPosition(new T.Vector3())));
  const footRotation=legs.map(l=>l[2].getWorldQuaternion(new T.Quaternion()));
  const a={root,model,bones,rest,meshes,legs,footRest,footRotation,id:0,phase:0,deathPose:null,footSide:[false,false],head:new T.Vector3(),body:new T.Vector3()};root.visible=false;pool.push(a);return a;
 }
 // Fixed pool includes settling bodies, never grows during play.
 for(let i=0;i<8;i++)make();
 function bone(a,n){return a.bones[n]||a.bones[n.replaceAll('.','')];}
 function turn(a,n,axis,angle){const b=bone(a,n);if(b)b.quaternion.multiply(q.setFromAxisAngle(axis,angle));}
 function aimBone(b,child,target){
  b.getWorldPosition(p0);child.getWorldPosition(p1);v1.subVectors(p1,p0).normalize();v2.subVectors(target,p0).normalize();q.setFromUnitVectors(v1,v2);b.getWorldQuaternion(pq);pq.premultiply(q);b.parent.getWorldQuaternion(q).invert();b.quaternion.copy(q.multiply(pq));b.updateWorldMatrix(false,true);
 }
 function leg(a,index,target){
  const [hip,knee,ankle]=a.legs[index];hip.getWorldPosition(p0);knee.getWorldPosition(p1);ankle.getWorldPosition(p2);const origin=p0.clone(),upper=p0.distanceTo(p1),lower=p1.distanceTo(p2),direction=target.clone().sub(origin),distance=T.MathUtils.clamp(direction.length(),.12,upper+lower-.015);direction.normalize();
  const forward=new T.Vector3(0,0,-1).transformDirection(a.root.matrixWorld);forward.addScaledVector(direction,-forward.dot(direction)).normalize();
  const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(.001,upper*upper-along*along));
  const bend=origin.clone().addScaledVector(direction,along).addScaledVector(forward,height),end=origin.clone().addScaledVector(direction,distance);
  aimBone(hip,knee,bend);aimBone(knee,ankle,end);
 }
 function pose(a,data,dt,speed){
  const dead=data.phase==='dead',idle=data.phase==='idle';a.root.visible=true;a.root.position.set(data.x,0,data.z);a.root.rotation.set(0,idle?data.yaw||0:data.phase==='retreat'?-data.side*.48:Math.sin(data.seed+data.age*.5)*.04,0);
  const gaitSpeed=speed+(data.phase==='run'&&speed>4?3.6:data.phase==='retreat'?-6:0);
  if(!dead){a.deathPose=null;a.phase=(a.phase+dt*Math.max(0,gaitSpeed)/(speed<4?2.4:4.706))%1;for(const [n,r]of Object.entries(a.rest)){a.bones[n].quaternion.copy(r.q);a.bones[n].position.copy(r.p);}}
  else if(!a.deathPose)a.deathPose=Object.fromEntries(Object.entries(a.bones).map(([n,b])=>[n,b.quaternion.clone()]));
  if(dead){
   for(const [n,r]of Object.entries(a.deathPose))a.bones[n].quaternion.copy(r);
   const fall=smooth(data.age,0,.65);a.root.rotation.z=data.side*1.48*fall;a.root.rotation.x=-.22*Math.sin(fall*Math.PI);a.root.position.y=.42*fall;a.root.position.x+=data.side*.65*fall;
   turn(a,'Bone.014',X,-.18*fall);turn(a,'Bone.017',X,.22*fall);
  }else{
   const leap=data.phase==='leap'?Math.sin(Math.PI*Math.min(1,data.age/.8)):0,warn=data.phase==='warn'?smooth(data.age,.9,1.8):0;
   const breath=Math.sin(data.age*1.45);
   a.model.position.y=floor-(speed>4?.24:0)+(idle?breath*.009:.045*Math.cos(a.phase*Math.PI*4))-warn*.06;
   turn(a,'Bone.010',X,idle?-.12:-.1-warn*.07);turn(a,'Bone.014',X,idle?-.17+breath*.008:.07+warn*.12);turn(a,'Bone.016',Z,idle?Math.sin(data.age*.23)*.035:Math.sin(data.seed+data.age*1.1)*.035);
   turn(a,'Bone.016',UP,idle?.12+Math.sin(data.age*.17)*.045:0);
   turn(a,'Bone.017',X,idle?-.37:-.25+warn*.32+leap*.32);
   for(let i=0;i<10;i++)turn(a,['Bone','Bone.004','Bone.003','Bone.002','Bone.006','Bone.005','Bone.001','Bone.008','Bone.007','Bone.009'][i],Z,Math.sin((idle?data.age*.35:a.phase*Math.PI*2)-i*.36)*(idle?.008:.045));
   turn(a,'Bone.024',X,-.45+leap*.7);turn(a,'Bone.025',X,-.45+leap*.7);turn(a,'Bone.026',X,-.65);turn(a,'Bone.027',X,-.65);
   a.root.updateMatrixWorld(true);
   for(let i=0;i<2;i++){
    const t=(a.phase+i*.5)%1,duty=speed<4?.58:.34,stance=idle||t<duty,amplitude=speed<4?.3:.8;const z=idle?(i===0?-.15:.16):(stance?-1+t/duty*2:1-((t-duty)/(1-duty))*2)*amplitude,lift=stance?0:.4*Math.sin((t-duty)/(1-duty)*Math.PI);
    const target=a.footRest[i].clone();target.z+=z;target.y+=lift+leap*.55;leg(a,i,a.root.localToWorld(target));
    const ankle=a.legs[i][2];a.root.getWorldQuaternion(pq).multiply(a.footRotation[i]);ankle.parent.getWorldQuaternion(q).invert();ankle.quaternion.copy(q.multiply(pq));
    if(!stance)ankle.quaternion.multiply(q.setFromAxisAngle(X,.35*Math.sin((t-duty)/(1-duty)*Math.PI)));
    if(stance&&!a.footSide[i]&&dt>0&&!leap){const contact=target.clone();contact.y=.03;api.onFoot?.(contact,speed);}a.footSide[i]=stance;
   }
   a.root.position.y+=leap*1.3;
  }
  a.root.updateMatrixWorld(true);bone(a,'Bone.016').getWorldPosition(a.head);bone(a,'Bone.012').getWorldPosition(a.body);
 }
 const api={pool,onFoot:null,update(dt,round,speed=8.5){
  const ids=new Set(round.attackers.map(a=>a.id));for(const a of pool)if(!ids.has(a.id)){a.id=0;a.root.visible=false;}
  for(const data of round.attackers){let a=pool.find(a=>a.id===data.id);if(!a){a=pool.find(a=>a.id===0);if(!a)continue;a.id=data.id;a.phase=data.seed%1;a.deathPose=null;a.footSide=[false,false];a.model.position.y=floor;}a.data=data;pose(a,data,dt,speed);}
 },reset(){for(const a of pool){a.id=0;a.root.visible=false;a.deathPose=null;}},hit(ray){
  let best=null;for(const a of pool){if(!a.root.visible||a.data.phase==='dead')continue;for(const [point,radius,head]of [[a.head,.57,true],[a.body,.76,false]]){const hit=ray.intersectSphere(new T.Sphere(point,radius),new T.Vector3());if(hit){const distance=hit.distanceTo(ray.origin);if(!best||distance<best.distance)best={actor:a,id:a.id,point:hit,distance,head};}}}return best;
 },get(id){return pool.find(a=>a.id===id);},get meshes(){return pool.flatMap(a=>a.meshes);}};return api;
}
