import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {RAVINE} from './rules.js';
import {RaptorFall} from './motion.js';
import {RaptorDynamics} from './death-dynamics.js';
import {shoulderHeight} from './route.js';
import {createRaptorWounds} from './wounds.js';
const UP=new T.Vector3(0,1,0),X=new T.Vector3(1,0,0),Z=new T.Vector3(0,0,1);
const smooth=T.MathUtils.smoothstep;
// The CC0 source has a real weighted skeleton. Keep the authored hide/UVs;
// articulate that skeleton, with ground-relative feet and a counterbalancing tail.
export async function createRaptors(scene,{capacity=RAVINE.maxActors,trackDynamics=true}={}){
 const gltf=await new GLTFLoader().loadAsync('./models/raptor-ravine.glb');
 const template=gltf.scene;template.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(template),scale=5.8/(bounds.max.z-bounds.min.z),floor=-bounds.min.y*scale;
 template.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false;o.material.roughness=o.name==='Eye'?.23:.8;o.material.envMapIntensity=.3;if(o.material.map)o.material.map.anisotropy=8;if(o.material.normalMap){o.material.normalMap.anisotropy=8;o.material.normalScale.set(.65,.65);}if(o.name==='Dromaeosaur')o.material.color.setRGB(.79,.83,.7);}});
 const pool=[],supportCache=new Map(),surfaceRay=new T.Raycaster();const q=new T.Quaternion(),pq=new T.Quaternion(),v1=new T.Vector3(),v2=new T.Vector3(),p0=new T.Vector3(),p1=new T.Vector3(),p2=new T.Vector3();
 function support(mesh){
  const g=mesh.geometry;if(supportCache.has(g))return supportCache.get(g);const groups=new Map(),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  for(let i=0;i<p.count;i++){let best=0;for(let k=1;k<4;k++)if(sw.getComponent(i,k)>sw.getComponent(i,best))best=k;const joint=si.getComponent(i,best);if(!groups.has(joint))groups.set(joint,Array.from({length:6},()=>({score:-Infinity,index:0})));const slots=groups.get(joint);for(let k=0;k<6;k++){const score=p.getComponent(i,Math.floor(k/2))*(k%2?-1:1);if(score>slots[k].score)slots[k]={score,index:i};}}
  const samples=[];for(const [joint,slots]of groups){const n=Number(mesh.skeleton.bones[joint].name.replace('Bone','')),body=n>=10&&n<=17,torso=n>=10&&n<=12,arm=n===24||n===26||n>=28&&n<=33?1:n===25||n===27||n>=34&&n<=39?2:0,leg=[22,23,40,18,45,46,48,49,51].includes(n)?1:n>=41&&!arm?2:0;for(const index of new Set(slots.map(s=>s.index)))samples.push({index,body,torso,arm,leg,joint:n});}supportCache.set(g,samples);return samples;
 }
 function make(){
  const root=new T.Group(),model=clone(template);root.add(model);scene.add(root);model.scale.setScalar(scale);model.position.set(0,floor,.84*scale);root.updateMatrixWorld(true);
  const bones={},rest={},meshes=[];model.traverse(o=>{if(o.isBone){bones[o.name]=o;rest[o.name]={q:o.quaternion.clone(),p:o.position.clone()};}if(o.isMesh)meshes.push(o);});
  // GLTFLoader sanitizes periods from Blender bone names.
  const legs=[['Bone.022','Bone.023','Bone.040'],['Bone.041','Bone.042','Bone.043']].map(names=>names.map(n=>bones[n]||bones[n.replaceAll('.','')]));
  const footRest=legs.map(l=>root.worldToLocal(l[2].getWorldPosition(new T.Vector3())));
  const footRotation=legs.map(l=>l[2].getWorldQuaternion(new T.Quaternion()));
  const skin=meshes.find(m=>m.name==='Dromaeosaur'),wounds=createRaptorWounds(skin),contacts=meshes.filter(m=>['Dromaeosaur','Claws'].includes(m.name)).map(mesh=>({mesh,points:support(mesh)}));
  const a={root,model,bones,rest,meshes,legs,footRest,footRotation,skin,wounds,contacts,id:0,phase:0,fall:null,deathPose:null,footSide:[false,false],head:new T.Vector3(),body:new T.Vector3()};root.visible=false;pool.push(a);return a;
 }
 // Fixed pool includes settling bodies, never grows during play.
 for(let i=0;i<capacity;i++)make();
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
  const dead=data.phase==='dead',idle=['idle','gate-hold','withdrawn'].includes(data.phase);a.root.visible=data.phase!=='shattered';if(data.phase==='shattered')return;
  if(dead){
   if(!a.fall){a.deathPose=Object.fromEntries(Object.entries(a.bones).map(([n,b])=>[n,b.quaternion.clone()]));a.fall=new RaptorFall({side:data.death.direction[0]||data.side,seed:data.seed,...data.death});a.dynamics=new RaptorDynamics(a);a.fallBase=a.root.quaternion.clone();a.fallGround=a.root.position.y;a.pivot=a.root.worldToLocal(bone(a,'Bone.010').getWorldPosition(new T.Vector3()));}
   for(const [n,r]of Object.entries(a.sleepPose||a.deathPose))a.bones[n].quaternion.copy(r);
   a.fall.step(dt);
   q.setFromEuler(new T.Euler(a.fall.pitch,0,a.fall.roll,'YXZ'));a.root.quaternion.copy(a.fallBase).multiply(q);v1.copy(a.pivot).applyQuaternion(a.root.quaternion);v2.copy(a.pivot).applyQuaternion(a.fallBase);
   a.root.position.set(data.x+v2.x-v1.x,a.fallGround+a.fall.y+v2.y-v1.y,data.z+v2.z-v1.z);a.root.updateMatrixWorld(true);
   let correction=0,bodyLow=Infinity;
   for(const {mesh,points}of a.contacts)for(const s of points)if(s.torso){mesh.getVertexPosition(s.index,p0);p0.applyMatrix4(mesh.matrixWorld);const height=p0.y-shoulderHeight(p0.x);correction=Math.max(correction,.028-height);bodyLow=Math.min(bodyLow,height);}
   // Shoulder sockets are part of the torso hull. A free arm cannot rotate
   // its fixed attachment out of the ground after a head-first fall.
   for(const n of ['Bone024','Bone025']){a.bones[n].getWorldPosition(p0);const height=p0.y-shoulderHeight(p0.x)-.085;correction=Math.max(correction,.018-height);bodyLow=Math.min(bodyLow,height);}
   if(correction>0){a.root.position.y+=correction;if(a.fall.contact(correction,bodyLow<.1)){a.root.updateMatrixWorld(true);api.onImpact?.(bone(a,'Bone.012').getWorldPosition(new T.Vector3()),data.death);}}
   a.root.updateMatrixWorld(true);
   if(!a.sleepPose){a.dynamics.update(dt);
   for(let pass=0;pass<6;pass++)for(const [kind,side,upper,child,tip]of [['arm',1,'Bone024','Bone026','Bone030'],['arm',2,'Bone025','Bone027','Bone036'],['leg',1,'Bone022','Bone023','Bone040'],['leg',2,'Bone041','Bone042','Bone043']]){
    let low=Infinity;for(const {mesh,points}of a.contacts)for(const s of points)if(s[kind]===side){mesh.getVertexPosition(s.index,p0);p0.applyMatrix4(mesh.matrixWorld);low=Math.min(low,p0.y-shoulderHeight(p0.x));}
    if(low<.018){const b=a.bones[pass%2?tip:child],target=b.getWorldPosition(new T.Vector3());target.y+=(.018-low)*1.7;aimBone(a.bones[pass%2?child:upper],b,target);}
   }
   // Individual fingers fold at their own joints when the hand lands. Raising
   // the entire shoulder to clear one long claw would hold the carcass rigid.
   for(let pass=0;pass<3;pass++)for(const n of [28,30,32,34,36,38]){
    let low=Infinity;for(const {mesh,points}of a.contacts)for(const s of points)if(s.joint===n||s.joint===n+1){mesh.getVertexPosition(s.index,p0);p0.applyMatrix4(mesh.matrixWorld);low=Math.min(low,p0.y-shoulderHeight(p0.x));}
    if(low<.018){const finger=a.bones[`Bone0${n}`],tip=a.bones[`Bone0${n+1}`],target=tip.getWorldPosition(new T.Vector3());target.y+=(.018-low)*1.5;aimBone(finger,tip,target);}
   }
   if(data.age>3.5)a.sleepPose=Object.fromEntries(Object.entries(a.bones).map(([n,b])=>[n,b.quaternion.clone()]));}
  }else{
   a.fall=null;a.sleepPose=null;a.deathPose=null;a.root.position.set(data.x,data.groundY||0,data.z);a.root.rotation.set(0,data.yaw||0,0);
   const gaitSpeed=idle?0:(data.motionSpeed??speed);a.phase=data.posePhase??(a.phase+dt*gaitSpeed/4.706)%1;for(const [n,r]of Object.entries(a.rest)){a.bones[n].quaternion.copy(r.q);a.bones[n].position.copy(r.p);}
   const leap=data.leapAmount??(data.phase==='leap'?Math.sin(Math.PI*Math.min(1,data.age/.68)):0),warn=data.phase==='warn'?smooth(data.age,data.warning*.45,data.warning):data.crouch||0;
   const breath=Math.sin(data.age*1.45),settle=idle?1:data.phase==='gate-brake'?smooth(data.age,.15,.72):data.phase==='retreat'?smooth(data.age,3.05,3.8):0;
   a.model.position.y=floor-.24*(1-settle)+breath*.009*settle+.05*Math.cos(a.phase*Math.PI*4)*(1-settle)-warn*.19;
   turn(a,'Bone.010',X,-.1-.02*settle-warn*.07);turn(a,'Bone.014',X,.07-.24*settle*(1-(data.alert||0))+.5*(data.alert||0)+breath*.008*settle+warn*.12);turn(a,'Bone.016',Z,Math.sin(data.seed+data.age*(idle?.23:1.1))*.035);
   turn(a,'Bone.016',UP,(.12+Math.sin(data.age*.17)*.045)*settle);
   // The pelvis banks into a turn while the head and tail counterbalance.
   // Chase gaze follows the Jeep without rotating the planted feet. A caller
   // in another frame (the arcade) can pass the head turn as `look` instead.
   const bank=data.bank||0,look=data.look!=null,focus=look?T.MathUtils.clamp(data.look,-.7,.7):idle||data.focus===false?0:T.MathUtils.clamp(Math.atan2(data.x,Math.max(5,data.z))-(data.yaw||0),-.34,.34);
   turn(a,'Bone.010',Z,bank);turn(a,'Bone.014',Z,-bank*.65);if(look){turn(a,'Bone.014',Z,-focus*.45);turn(a,'Bone.016',Z,-focus*.55);}else turn(a,'Bone.016',UP,focus*.5);
   // Optional `recoil` scales the flinch; `hitHead` snaps the head instead of twisting the chest.
   if(data.flash>0){const recoil=Math.sin((.16-data.flash)/.16*Math.PI)*.065*(data.recoil??1);if(data.hitHead){turn(a,'Bone.016',X,-recoil*1.6);turn(a,'Bone.016',UP,recoil*data.side*1.4);}else{turn(a,'Bone.012',Z,recoil*data.side);turn(a,'Bone.016',X,-recoil);}}
   turn(a,'Bone.017',X,-.25-.12*settle+warn*.32+leap*.32+(data.pant||0)*(.09+.07*Math.sin(data.age*10)));
   for(let i=0;i<10;i++)turn(a,['Bone','Bone.004','Bone.003','Bone.002','Bone.006','Bone.005','Bone.001','Bone.008','Bone.007','Bone.009'][i],Z,Math.sin((idle?data.age*.35:a.phase*Math.PI*2)-i*.36)*(idle?.008:.045)-bank*.22);
   const reach=data.reach??leap;
   turn(a,'Bone.024',X,-.45+reach*.88-warn*.2);turn(a,'Bone.025',X,-.45+reach*.7-warn*.15);turn(a,'Bone.026',X,-.65+reach*.34);turn(a,'Bone.027',X,-.65+reach*.28);
   a.root.updateMatrixWorld(true);
   for(let i=0;i<2;i++){
    const t=(a.phase+i*.5)%1,duty=.34,stance=idle||t<duty,amplitude=.8*(1-settle);const z=(stance?-1+t/duty*2:1-((t-duty)/(1-duty))*2)*amplitude+(i===0?-.15:.16)*settle,lift=stance?0:.4*Math.sin((t-duty)/(1-duty)*Math.PI)*(1-settle);
    const target=a.footRest[i].clone();target.z+=z;target.y+=lift+leap*.55;leg(a,i,a.root.localToWorld(target));
    const ankle=a.legs[i][2];a.root.getWorldQuaternion(pq).multiply(a.footRotation[i]);ankle.parent.getWorldQuaternion(q).invert();ankle.quaternion.copy(q.multiply(pq));
    if(!stance)ankle.quaternion.multiply(q.setFromAxisAngle(X,.35*Math.sin((t-duty)/(1-duty)*Math.PI)));
    if(stance&&!a.footSide[i]&&dt>0&&!leap){const contact=target.clone();contact.y=.03;api.onFoot?.(contact,speed);}a.footSide[i]=stance;
   }
   a.root.position.y+=(data.airLift??leap*1.3)+(data.airY||0);
  }
  a.root.updateMatrixWorld(true);bone(a,'Bone.016').getWorldPosition(a.head);bone(a,'Bone.012').getWorldPosition(a.body);
  if(trackDynamics&&!dead&&dt>0){a.previousJoints=a.joints;a.joints=Object.fromEntries(Object.entries(a.bones).map(([n,b])=>[n,b.getWorldPosition(new T.Vector3())]));a.poseDelta=dt;}
 }
 const api={pool,onFoot:null,onImpact:null,pose(a,data){a.data=data;pose(a,data,0,0);},update(dt,round,speed=8.5){
  const ids=new Set(round.attackers.map(a=>a.id));for(const a of pool)if(!ids.has(a.id)){a.id=0;a.root.visible=false;}
  for(const data of round.attackers){let a=pool.find(a=>a.id===data.id);if(!a){a=pool.find(a=>a.id===0);if(!a)continue;a.id=data.id;a.phase=data.seed%1;a.fall=null;a.sleepPose=null;a.joints=a.previousJoints=null;a.wounds.reset();a.deathPose=null;a.footSide=[false,false];a.model.position.y=floor;}a.data=data;pose(a,data,dt,speed);}
 },retireHidden(world){
  scene.updateMatrixWorld(true);for(const a of pool)if(a.root.visible&&a.data.phase==='withdrawn'&&a.data.age>=(a.data.visibilityCheck||0)){
   a.data.visibilityCheck=a.data.age+.2;const points=[a.head,a.body,...['Bone009','Bone031','Bone037','Bone048','Bone057'].map(n=>a.bones[n].getWorldPosition(new T.Vector3()))];
   for(const side of [-1,1])points.push(a.head.clone().add(new T.Vector3(side*.45,.25,0)),a.body.clone().add(new T.Vector3(side*.6,.25,0)));
   a.data.hidden=[new T.Vector3(.06,2.4,-.45),new T.Vector3(-7,4.4,-8.8),new T.Vector3(-5.8,4.4,-8.8)].every(origin=>points.every(p=>world.coverHit(new T.Ray(origin,p.clone().sub(origin).normalize()),p.distanceTo(origin))));
  }
 },wound(hit,explosive=false){const a=hit.actor;a.wounds.add(hit.point,bone(a,hit.head?'Bone.016':'Bone.012'),scale,explosive);},reset(){for(const a of pool){a.id=0;a.root.visible=false;a.deathPose=null;a.sleepPose=null;a.fall=null;a.wounds.reset();}},hit(ray,fullSurface=false){
  // Grenades contact the entire posed hide, including a limb or tail outside
  // the bullet aim-assist spheres. Refresh the animated mesh bound first.
  if(fullSurface){let best=null;surfaceRay.ray.copy(ray);for(const a of pool){if(!a.root.visible||a.data.phase==='dead')continue;a.skin.computeBoundingSphere();const hit=surfaceRay.intersectObject(a.skin,false)[0];if(hit&&(!best||hit.distance<best.distance))best={actor:a,id:a.id,point:hit.point,distance:hit.distance,head:hit.point.distanceTo(a.head)<.57,surface:true};}return best;}
  let best=null;for(const a of pool){if(!a.root.visible||a.data.phase==='dead')continue;for(const [point,radius,head]of [[a.head,.57,true],[a.body,.76,false]]){const hit=ray.intersectSphere(new T.Sphere(point,radius),new T.Vector3());if(hit){const distance=hit.distanceTo(ray.origin);if(!best||distance<best.distance)best={actor:a,id:a.id,point:hit,distance,head};}}}
  if(best){surfaceRay.ray.copy(ray);const hit=surfaceRay.intersectObject(best.actor.skin,false)[0];best.surface=!!hit;if(hit){best.point.copy(hit.point);best.distance=hit.distance;}}
  return best;
 },get(id){return pool.find(a=>a.id===id);},get meshes(){return pool.flatMap(a=>a.meshes);}};return api;
}
