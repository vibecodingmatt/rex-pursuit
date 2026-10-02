import * as T from 'three';
import {ROAD_SPEED,shoulderHeight} from './route.js';
const STEP=1/120;
const v=new T.Vector3(),w=new T.Vector3(),target=new T.Vector3(),axis=new T.Vector3(),q=new T.Quaternion(),parentQ=new T.Quaternion();
// The torso carries the mass; articulated chains lag behind it, hit the road,
// and lose energy independently. There is no shared pose blend for dead limbs.
class Chain{
 constructor(actor,names,{radii,mass=1,stiffness=12,limit=1.35,tip=null}){
  this.actor=actor;this.stiffness=stiffness;this.limit=limit;this.bones=names.map(n=>actor.bones[n]);
  const points=this.bones.map(b=>b.getWorldPosition(new T.Vector3()));if(tip){this.tipLocal=this.bones.at(-1).worldToLocal(tip.clone());points.push(tip);}
  this.nodes=points.map((p,i)=>({p:p.clone(),before:p.clone(),v:new T.Vector3(),rest:actor.root.worldToLocal(p.clone()),radius:radii[i]??.06,weight:i?1/(typeof mass==='number'?mass:mass[i]):0,length:i?p.distanceTo(points[i-1]):0}));
  for(let i=0;i<this.nodes.length;i++){const n=this.nodes[i],prior=actor.previousJoints?.[names[i]],velocity=prior&&actor.poseDelta>0?n.p.clone().sub(prior).divideScalar(actor.poseDelta):new T.Vector3(0,actor.data.death.airV||0,-actor.data.deadSpeed+ROAD_SPEED);velocity.z-=ROAD_SPEED;velocity.clampLength(0,18);n.v.copy(velocity);}
 }
 target(i,out){const ns=this.nodes,n=ns[i],p=ns[i-1];out.subVectors(n.rest,p.rest).transformDirection(this.actor.root.matrixWorld).multiplyScalar(n.length);
  if(i>1){v.subVectors(p.rest,ns[i-2].rest).transformDirection(this.actor.root.matrixWorld);w.subVectors(p.p,ns[i-2].p).normalize();out.applyQuaternion(q.setFromUnitVectors(v,w));}return out.add(p.p);}
 step(dt,anchor){const ns=this.nodes;
  for(const n of ns){n.p.z+=ROAD_SPEED*dt;n.before.copy(n.p);}
  for(let i=1;i<ns.length;i++){const n=ns[i],p=ns[i-1];this.target(i,target);v.subVectors(target,n.p).multiplyScalar(this.stiffness*dt).addScaledVector(w.subVectors(n.v,p.v),-2.7*dt);n.v.add(v);if(p.weight)p.v.addScaledVector(v,-.35);n.v.y-=12*dt;n.v.multiplyScalar(Math.exp(-dt*(this.actor.data.age>1?4:.35)));n.p.addScaledVector(n.v,dt);}
  ns[0].p.copy(anchor);
  for(let pass=0;pass<7;pass++){
   for(let i=1;i<ns.length;i++){const a=ns[i-1],b=ns[i];v.subVectors(b.p,a.p);const d=v.length()||.001,correction=(d-b.length)/d/(a.weight+b.weight);a.p.addScaledVector(v,correction*a.weight);b.p.addScaledVector(v,-correction*b.weight);}
   for(let i=1;i<ns.length;i++){const n=ns[i],p=ns[i-1];this.target(i,target);v.subVectors(n.p,p.p);const length=v.length();v.normalize();w.subVectors(target,p.p).normalize();if(v.dot(w)<Math.cos(this.limit)){axis.crossVectors(w,v).normalize();v.copy(w).applyAxisAngle(axis,this.limit);n.p.copy(p.p).addScaledVector(v,length);}n.p.y=Math.max(n.p.y,shoulderHeight(n.p.x)+n.radius);}
  }
  for(let i=1;i<ns.length;i++){const n=ns[i];n.v.subVectors(n.p,n.before).divideScalar(dt).clampLength(0,18);if(n.p.y<=shoulderHeight(n.p.x)+n.radius+.015){const loss=Math.exp(-dt*14);n.v.x*=loss;n.v.z*=loss;n.v.y=Math.max(0,n.v.y)*.08;}}
 }
 apply(){for(let i=0;i<this.bones.length&&i<this.nodes.length-1;i++){const bone=this.bones[i],child=this.bones[i+1];bone.getWorldPosition(v);if(child)child.getWorldPosition(w);else bone.localToWorld(w.copy(this.tipLocal));const from=w.sub(v).normalize(),to=target.subVectors(this.nodes[i+1].p,v).normalize();q.setFromUnitVectors(from,to);bone.getWorldQuaternion(parentQ);parentQ.premultiply(q);bone.parent.getWorldQuaternion(q).invert();bone.quaternion.copy(q.multiply(parentQ));bone.updateWorldMatrix(false,true);}}
}
export class RaptorDynamics{
 constructor(actor){this.actor=actor;this.age=0;this.chains=[];const add=(names,opts)=>this.chains.push(new Chain(actor,names,opts)),head=actor.bones.Bone016;
  const muzzle=head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,-.04,-.65).applyQuaternion(actor.root.quaternion));
  add(['Bone013','Bone015','Bone014','Bone016'],{radii:[0,.13,.19,.29,.18],mass:[1,1,1,2.6,1.6],stiffness:28,limit:1.12,tip:muzzle});
  add(['Bone','Bone004','Bone003','Bone002','Bone006','Bone005','Bone001','Bone008','Bone007','Bone009'],{radii:[0,.26,.23,.2,.17,.14,.11,.09,.07,.045],stiffness:9,limit:1.05});
  for(const names of [['Bone022','Bone023','Bone040','Bone046','Bone048'],['Bone041','Bone042','Bone043','Bone055','Bone057']])add(names,{radii:[0,.16,.11,.07,.045],stiffness:5,limit:1.65});
  for(const names of [['Bone024','Bone026','Bone030','Bone031'],['Bone025','Bone027','Bone036','Bone037']])add(names,{radii:[0,.12,.07,.04],stiffness:3,limit:1.75});
  this.anchors=this.chains.map(c=>c.nodes[0].p.clone());
 }
 update(dt){const anchors=this.chains.map(c=>c.bones[0].getWorldPosition(new T.Vector3())),steps=Math.max(1,Math.ceil(dt/STEP));
  for(let i=0;i<steps&&dt>0;i++){for(let j=0;j<this.chains.length;j++){target.lerpVectors(this.anchors[j],anchors[j],(i+1)/steps);this.chains[j].step(dt/steps,target.clone());}this.age+=dt/steps;}
  this.anchors=anchors;for(const chain of this.chains)chain.apply();
  // A loose jaw drops, then rests; the tail/limbs continue dissipating impact.
  const jaw=this.actor.bones.Bone017;jaw.quaternion.multiply(q.setFromAxisAngle(new T.Vector3(1,0,0),.17*(1-Math.exp(-this.age*7))));
 }
}
