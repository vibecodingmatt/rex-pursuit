import * as T from 'three';
import {FallFollowThrough} from './fall-follow-through.js';

const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const ease=T.MathUtils.smoothstep;

/** Authored momentum fall with a skinned support cloud against the road. */
export class DeathMotion {
 constructor(actor,meshes,bones,rest,gait,pose){
  Object.assign(this,{actor,meshes,bones,rest,gait,pose});
  this.followThrough=new FallFollowThrough(bones);
  const directions=[new T.Vector3(1,0,0),new T.Vector3(-1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,-1,0),new T.Vector3(0,0,1),new T.Vector3(0,0,-1),new T.Vector3(1,1,0),new T.Vector3(-1,1,0),new T.Vector3(1,-1,0),new T.Vector3(-1,-1,0)];
  this.support=meshes.filter(m=>m.isSkinnedMesh).map(mesh=>{
   const {position,skinIndex,skinWeight}=mesh.geometry.attributes,groups=new Map();
   for(let i=0;i<position.count;i++){
    let joint=0,best=-1;for(let k=0;k<4;k++){const weight=skinWeight.getComponent(i,k);if(weight>best){best=weight;joint=skinIndex.getComponent(i,k);}}
    if(!groups.has(joint))groups.set(joint,directions.map(()=>({score:-Infinity,index:0})));
    const p=new T.Vector3().fromBufferAttribute(position,i);
    directions.forEach((d,k)=>{const score=p.dot(d),slot=groups.get(joint)[k];if(score>slot.score){slot.score=score;slot.index=i;}});
   }
   const points=[];for(const [joint,slots]of groups){const name=mesh.skeleton.bones[joint]?.name||'',body=/back_|neck_|head_|ribCage/.test(name),head=/head_|jaw_/.test(name);for(const index of new Set(slots.map(s=>s.index)))points.push({index,body,head});}
   return{mesh,points};
  });
  this.reset();
 }

 reset(){this.active=false;this.complete=false;this.time=0;this.events=[];this.firstImpact=false;this.secondImpact=false;this.settleImpact=false;this.slideDust=0;this.minY=0;this.headMinY=0;this.startPose=null;this.followThrough.reset();}

 begin(){
  this.active=true;this.time=0;this.startPose=new Map(this.bones.map(b=>[b,b.quaternion.clone()]));
  this.startRotation=this.actor.quaternion.clone();
  this.pivotLocal=new T.Vector3(0,3.25,1.4);
  this.pivot=this.actor.localToWorld(this.pivotLocal.clone());this.startPivot=this.pivot.clone();
  this.forwardSpeed=this.gait.speed;
  this.supportSide=this.gait.legs.find(l=>l.stance)?.side||'L';
  // Build a single relaxed pose; no running oscillator is evaluated after death.
  for(const [b,r]of this.rest){b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}
  this.pose('neck_01_',-.10);this.pose('neck_03_',-.08);this.pose('head_',-.10);this.pose('jaw_01_',-.16);
  this.pose('arm_01_L_',.12);this.pose('arm_01_R_',.18);
  this.actor.updateMatrixWorld(true);
  const orientation=this.actor.getWorldQuaternion(new T.Quaternion());
  this.gait.legs.forEach((leg,i)=>{
   const target=this.actor.localToWorld(new T.Vector3(i?-.46:.46,i?2.05:2.35,i?1.25:.25));
   const footQ=orientation.clone().multiply(leg.restQ);
   this.gait.solveLeg(leg,target,footQ,orientation);
  });
  this.limpPose=new Map(this.bones.map(b=>[b,b.quaternion.clone()]));
  for(const [b,q]of this.startPose)b.quaternion.copy(q);
  this.gait.drainFootfalls();
 }

 update(dt,roadSpeed){
  if(!this.active)this.begin();
  this.time+=dt;const t=this.time;
  this.forwardSpeed=Math.max(0,this.forwardSpeed-dt*(t<.8?9.5:6.5));
  this.pivot.z+=(roadSpeed-this.forwardSpeed)*dt;
  this.pivot.x=this.startPivot.x+.88*ease(t,.15,2.4);
  const roll=-2.34*ease(t,.12,1.72)+.88*ease(t,1.72,2.8)-.14*ease(t,2.8,3.6);
  const pitch=.29*ease(t,0,.8)-.24*ease(t,.9,2.6);
  const yaw=.30*ease(t,.35,2.9);
  this.actor.quaternion.copy(this.startRotation)
   .multiply(new T.Quaternion().setFromAxisAngle(Z,-roll))
   .premultiply(new T.Quaternion().setFromAxisAngle(Y,yaw))
   .premultiply(new T.Quaternion().setFromAxisAngle(X,-pitch));
  const fall=T.MathUtils.clamp(t-.12,0,2);
  this.pivot.y=this.startPivot.y-.5*9.8*fall*fall;
  this.actor.position.copy(this.pivot).sub(this.pivotLocal.clone().applyQuaternion(this.actor.quaternion));
  for(const [bone,r]of this.rest){
   bone.position.copy(r.p);bone.scale.copy(r.s);
   const leg=/leg_|foot_/.test(bone.name),support=bone.name.includes(`_${this.supportSide}_`);
   const start=leg?(support?.02:.20):.08,end=leg?(support?.85:1.42):1.65;
   bone.quaternion.copy(this.startPose.get(bone)).slerp(this.limpPose.get(bone),ease(t,start,end));
  }
  // Distributed joint responses let the pelvis, chest, neck, limbs and tail
  // arrive at each impact at different times instead of rolling as one plank.
  this.followThrough.update(dt,t);
  // Release the neck's sideways bend as the torso settles so the skull rests
  // beside the ribcage instead of staying suspended in the running silhouette.
  const sag=ease(t,1.85,3.35);
  this.pose('neck_01_',-.13*sag,Z);this.pose('neck_03_',-.085*sag,Z);
  this.actor.updateMatrixWorld(true);
  for(const mesh of this.meshes)if(mesh.isSkinnedMesh)mesh.skeleton.update();
  let min=Infinity,bodyMin=Infinity,headMin=Infinity;const point=new T.Vector3(),groundPoint=new T.Vector3(),bodyPoint=new T.Vector3();
  for(const {mesh,points}of this.support)for(const p of points){
   mesh.getVertexPosition(p.index,point);point.applyMatrix4(mesh.matrixWorld);
   if(point.y<min){min=point.y;groundPoint.copy(point);}
   if(p.body&&point.y<bodyMin){bodyMin=point.y;bodyPoint.copy(point);}
   if(p.head)headMin=Math.min(headMin,point.y);
  }
  const correction=Math.max(0,.025-min);
  this.actor.position.y+=correction;bodyPoint.y+=correction;groundPoint.y+=correction;
  this.minY=min+correction;
  this.headMinY=headMin+correction;
  if(!this.firstImpact&&t>.5&&(bodyMin+correction<.15||t>.95)){
   this.firstImpact=true;this.events.push({type:'body-impact',position:bodyPoint.clone().setY(.08),strength:1});
  }
  if(!this.secondImpact&&t>=1.8){this.secondImpact=true;this.events.push({type:'body-impact',position:groundPoint.clone().setY(.08),strength:.7});}
  if(!this.settleImpact&&t>=2.85){this.settleImpact=true;this.events.push({type:'body-impact',position:groundPoint.clone().setY(.05),strength:.35});}
  if(this.firstImpact&&t<3.7){this.slideDust+=dt;if(this.slideDust>.14){this.slideDust=0;this.events.push({type:'body-slide',position:groundPoint.clone().setY(.04),strength:Math.max(.15,this.forwardSpeed/10)});}}
  this.complete=t>=5.2;
  this.actor.updateMatrixWorld(true);
 }

 drainEvents(){return this.events.splice(0);}
}
