import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {RAVINE} from './rules.js';
import {RaptorFall} from './motion.js';
import {shoulderHeight} from './route.js';
import {createRaptorWounds} from './wounds.js';
const UP=new T.Vector3(0,1,0),X=new T.Vector3(1,0,0),Z=new T.Vector3(0,0,1);
const smooth=T.MathUtils.smoothstep;
// The CC0 source has a real weighted skeleton. Keep the authored hide/UVs;
// articulate that skeleton, with ground-relative feet and a counterbalancing tail.
export async function createRaptors(scene){
 const gltf=await new GLTFLoader().loadAsync('./models/raptor-ravine.glb');
 const template=gltf.scene;template.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(template),scale=5.8/(bounds.max.z-bounds.min.z),floor=-bounds.min.y*scale;
 template.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false;o.material.roughness=o.name==='Eye'?.23:.8;o.material.envMapIntensity=.3;if(o.material.map)o.material.map.anisotropy=8;if(o.material.normalMap){o.material.normalMap.anisotropy=8;o.material.normalScale.set(.65,.65);}if(o.name==='Dromaeosaur')o.material.color.setRGB(.79,.83,.7);}});
 const pool=[],supportCache=new Map(),surfaceRay=new T.Raycaster();const q=new T.Quaternion(),pq=new T.Quaternion(),v1=new T.Vector3(),v2=new T.Vector3(),p0=new T.Vector3(),p1=new T.Vector3(),p2=new T.Vector3();
 function support(mesh){
  const g=mesh.geometry;if(supportCache.has(g))return supportCache.get(g);const groups=new Map(),p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
  for(let i=0;i<p.count;i++){let best=0;for(let k=1;k<4;k++)if(sw.getComponent(i,k)>sw.getComponent(i,best))best=k;const joint=si.getComponent(i,best);if(!groups.has(joint))groups.set(joint,Array.from({length:6},()=>({score:-Infinity,index:0})));const slots=groups.get(joint);for(let k=0;k<6;k++){const score=p.getComponent(i,Math.floor(k/2))*(k%2?-1:1);if(score>slots[k].score)slots[k]={score,index:i};}}
  const samples=[];for(const [joint,slots]of groups){const n=Number(mesh.skeleton.bones[joint].name.replace('Bone','')),body=n>=10&&n<=17,arm=n===24||n===26||n>=28&&n<=33?1:n===25||n===27||n>=34&&n<=39?2:0;for(const index of new Set(slots.map(s=>s.index)))samples.push({index,body,arm});}supportCache.set(g,samples);return samples;
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
 for(let i=0;i<RAVINE.maxActors;i++)make();
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
  const dead=data.phase==='dead',idle=data.phase==='idle'||data.phase==='gate-hold';a.root.visible=true;
  if(dead){
   if(!a.fall){a.deathPose=Object.fromEntries(Object.entries(a.bones).map(([n,b])=>[n,b.quaternion.clone()]));a.fall=new RaptorFall({side:data.death.direction[0]||data.side,seed:data.seed,...data.death});a.fallBase=a.root.quaternion.clone();a.fallGround=a.root.position.y;a.pivot=a.root.worldToLocal(bone(a,'Bone.010').getWorldPosition(new T.Vector3()));}
   for(const [n,r]of Object.entries(a.deathPose))a.bones[n].quaternion.copy(r);
   a.fall.step(dt);const collapse=smooth(data.age,.04,.78);
   const relax=(n,axis,angle,w=collapse)=>{const b=bone(a,n);q.copy(a.rest[b.name].q).multiply(pq.setFromAxisAngle(axis,angle));b.quaternion.slerp(q,w);};
   relax('Bone.022',X,-.55);relax('Bone.041',X,-.22);relax('Bone.023',X,1.15);relax('Bone.042',X,.95);relax('Bone.040',X,-.35);relax('Bone.043',X,-.22);
   for(const n of ['Bone.024','Bone.025'])relax(n,X,-.15);for(const n of ['Bone.026','Bone.027'])relax(n,X,-1.05);
   relax('Bone.014',X,.38);relax('Bone.016',X,-.18);relax('Bone.017',X,-.12);
   for(const [i,n]of ['Bone','Bone.004','Bone.003','Bone.002','Bone.006','Bone.005','Bone.001','Bone.008','Bone.007','Bone.009'].entries())turn(a,n,Z,Math.sin(data.age*8-i*.4)*.065*Math.exp(-data.age*1.9)*collapse);
   q.setFromEuler(new T.Euler(a.fall.pitch,0,a.fall.roll,'YXZ'));a.root.quaternion.copy(a.fallBase).multiply(q);v1.copy(a.pivot).applyQuaternion(a.root.quaternion);v2.copy(a.pivot).applyQuaternion(a.fallBase);
   a.root.position.set(data.x+v2.x-v1.x,a.fallGround+a.fall.y+v2.y-v1.y,data.z+v2.z-v1.z);a.root.updateMatrixWorld(true);
   let correction=0,bodyLow=Infinity;
   for(const {mesh,points}of a.contacts)for(const s of points){mesh.getVertexPosition(s.index,p0);p0.applyMatrix4(mesh.matrixWorld);const height=p0.y-shoulderHeight(p0.x);correction=Math.max(correction,.018-height-(s.arm?.65*smooth(data.age,.2,.75):0));if(s.body)bodyLow=Math.min(bodyLow,height);}
   if(correction>0){a.root.position.y+=correction;if(a.fall.contact(correction,bodyLow<.1)){a.root.updateMatrixWorld(true);api.onImpact?.(bone(a,'Bone.012').getWorldPosition(new T.Vector3()),data.death);}}
   // Arms yield against the road instead of rigid fingers propping the torso
   // in mid-air. Rotate the shoulder toward a raised elbow; retain elbow curl.
   a.root.updateMatrixWorld(true);
   for(let pass=0;pass<3;pass++)for(const [arm,upper,elbow]of [[1,'Bone.024','Bone.026'],[2,'Bone.025','Bone.027']]){
    let low=Infinity;for(const {mesh,points}of a.contacts)for(const s of points)if(s.arm===arm){mesh.getVertexPosition(s.index,p0);p0.applyMatrix4(mesh.matrixWorld);low=Math.min(low,p0.y-shoulderHeight(p0.x));}
    if(low<.018){const joint=bone(a,elbow),target=joint.getWorldPosition(new T.Vector3());target.y+=(.018-low)*1.6;aimBone(bone(a,upper),joint,target);}
   }
  }else{
   a.fall=null;a.deathPose=null;a.root.position.set(data.x,data.groundY||0,data.z);a.root.rotation.set(0,data.yaw||0,0);
   const gaitSpeed=idle?0:(data.motionSpeed??speed);a.phase=(a.phase+dt*gaitSpeed/4.706)%1;for(const [n,r]of Object.entries(a.rest)){a.bones[n].quaternion.copy(r.q);a.bones[n].position.copy(r.p);}
   const leap=data.phase==='leap'?Math.sin(Math.PI*Math.min(1,data.age/.68)):0,warn=data.phase==='warn'?smooth(data.age,data.warning*.45,data.warning):0;
   const breath=Math.sin(data.age*1.45),settle=idle?1:data.phase==='gate-brake'?smooth(data.age,.15,.72):0;
   a.model.position.y=floor-.24*(1-settle)+breath*.009*settle+.035*Math.cos(a.phase*Math.PI*4)*(1-settle)-warn*.06;
   turn(a,'Bone.010',X,-.1-.02*settle-warn*.07);turn(a,'Bone.014',X,.07-.24*settle+breath*.008*settle+warn*.12);turn(a,'Bone.016',Z,Math.sin(data.seed+data.age*(idle?.23:1.1))*.035);
   turn(a,'Bone.016',UP,(.12+Math.sin(data.age*.17)*.045)*settle);
   if(data.flash>0){const recoil=Math.sin((.16-data.flash)/.16*Math.PI)*.065;turn(a,'Bone.012',Z,recoil*data.side);turn(a,'Bone.016',X,-recoil);}
   turn(a,'Bone.017',X,-.25-.12*settle+warn*.32+leap*.32);
   for(let i=0;i<10;i++)turn(a,['Bone','Bone.004','Bone.003','Bone.002','Bone.006','Bone.005','Bone.001','Bone.008','Bone.007','Bone.009'][i],Z,Math.sin((idle?data.age*.35:a.phase*Math.PI*2)-i*.36)*(idle?.008:.045));
   turn(a,'Bone.024',X,-.45+leap*.7);turn(a,'Bone.025',X,-.45+leap*.7);turn(a,'Bone.026',X,-.65);turn(a,'Bone.027',X,-.65);
   a.root.updateMatrixWorld(true);
   for(let i=0;i<2;i++){
    const t=(a.phase+i*.5)%1,duty=.34,stance=idle||t<duty,amplitude=.8*(1-settle);const z=(stance?-1+t/duty*2:1-((t-duty)/(1-duty))*2)*amplitude+(i===0?-.15:.16)*settle,lift=stance?0:.4*Math.sin((t-duty)/(1-duty)*Math.PI)*(1-settle);
    const target=a.footRest[i].clone();target.z+=z;target.y+=lift+leap*.55;leg(a,i,a.root.localToWorld(target));
    const ankle=a.legs[i][2];a.root.getWorldQuaternion(pq).multiply(a.footRotation[i]);ankle.parent.getWorldQuaternion(q).invert();ankle.quaternion.copy(q.multiply(pq));
    if(!stance)ankle.quaternion.multiply(q.setFromAxisAngle(X,.35*Math.sin((t-duty)/(1-duty)*Math.PI)));
    if(stance&&!a.footSide[i]&&dt>0&&!leap){const contact=target.clone();contact.y=.03;api.onFoot?.(contact,speed);}a.footSide[i]=stance;
   }
   a.root.position.y+=leap*1.3+(data.airY||0);
  }
  a.root.updateMatrixWorld(true);bone(a,'Bone.016').getWorldPosition(a.head);bone(a,'Bone.012').getWorldPosition(a.body);
 }
 const api={pool,onFoot:null,onImpact:null,update(dt,round,speed=8.5){
  const ids=new Set(round.attackers.map(a=>a.id));for(const a of pool)if(!ids.has(a.id)){a.id=0;a.root.visible=false;}
  for(const data of round.attackers){let a=pool.find(a=>a.id===data.id);if(!a){a=pool.find(a=>a.id===0);if(!a)continue;a.id=data.id;a.phase=data.seed%1;a.fall=null;a.wounds.reset();a.deathPose=null;a.footSide=[false,false];a.model.position.y=floor;}a.data=data;pose(a,data,dt,speed);}
 },wound(hit,explosive=false){const a=hit.actor;a.wounds.add(hit.point,bone(a,hit.head?'Bone.016':'Bone.012'),scale,explosive);},reset(){for(const a of pool){a.id=0;a.root.visible=false;a.deathPose=null;a.fall=null;a.wounds.reset();}},hit(ray){
  let best=null;for(const a of pool){if(!a.root.visible||a.data.phase==='dead')continue;for(const [point,radius,head]of [[a.head,.57,true],[a.body,.76,false]]){const hit=ray.intersectSphere(new T.Sphere(point,radius),new T.Vector3());if(hit){const distance=hit.distanceTo(ray.origin);if(!best||distance<best.distance)best={actor:a,id:a.id,point:hit,distance,head};}}}
  if(best){surfaceRay.ray.copy(ray);const hit=surfaceRay.intersectObject(best.actor.skin,false)[0];if(hit){best.point.copy(hit.point);best.distance=hit.distance;}}
  return best;
 },get(id){return pool.find(a=>a.id===id);},get meshes(){return pool.flatMap(a=>a.meshes);}};return api;
}
