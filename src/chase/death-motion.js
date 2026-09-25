import * as T from 'three';
import {WET} from './weather-state.js';

// Victory fall. She dies mid-stride at running speed and goes down face first.
// Physics first: a planar rigid torso (travel, height, pitch) is carried by legs
// that buckle within a fraction of a second. The dead feet drag and trip her, so
// she pitches nose-down; the chin and chest land, the hips follow, and she skids
// on her belly until ground friction stops her (wet mud is slicker, so the storm
// slide runs longer). The neck and tail are mass chains that whip, slam and drag
// in the dirt; each foot is a point with claw friction, solved into the leg by
// IK, so a planted foot stays put, then trails. Everything integrates at a fixed
// 240 Hz in the ground's frame (the road slides under the Jeep's frame at
// roadSpeed), so every frame rate produces the same fall.

const STEP=1/240,G=9.8,SETTLE=4.3,EXHALE=3.75;
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const smooth=T.MathUtils.smoothstep,clamp=T.MathUtils.clamp;
// Rest-space (actor frame) landmarks: centre of mass just ahead of the hips,
// the neck's root, and the snout (the skull's forward end).
const COM=new T.Vector3(.1,3.15,1.45),NECK_BASE=new T.Vector3(.25,3.3,3.3),SNOUT=new T.Vector3(.17,3.95,6.72),NOSTRIL=new T.Vector3(.2,4.1,6.85);
const INERTIA=2.1*2.1;
// Ground contact per hull point, per unit body mass: a dead, fleshy landing
// with a small rebound and no bounce.
const K_GROUND=1400,C_GROUND=75,FRICTION_LOAD=1.6*G;
const hash=x=>{const s=Math.sin(x*127.1+311.7)*43758.5453;return s-Math.floor(s);};

/** Mass chain: kinematic anchors, inextensible links (position-based), bending
 *  springs toward each segment's rest bend, ground collision by radius and
 *  Coulomb friction against the still ground. Bending is a force, not a
 *  positional constraint: at 240 Hz a positional one would hold the chain rigid
 *  against gravity, and a dead tail must sag. */
class Chain {
 constructor(spec){
  this.nodes=spec.map((s,i)=>({...s,p:new T.Vector3(),q:new T.Vector3(),v:new T.Vector3(),w:s.anchor?0:1/s.mass,touch:false,fall:0,len:i?s.rest.distanceTo(spec[i-1].rest):0}));
  this.a=new T.Vector3();this.b=new T.Vector3();this.c=new T.Vector3();this.r=new T.Quaternion();
 }
 /** Where node i would sit if its segment kept its rest bend relative to its
  *  parent segment (the torso frame for the first): a minimal-twist parent
  *  rotation applied to the rest offset. */
 target(frame,i,out){
  const ns=this.nodes,n=ns[i],p=ns[i-1],{a,b,r}=this;
  out.subVectors(n.rest,p.rest);if(this.droop)out.applyAxisAngle(X,this.droop);frame.rotate(out);
  if(i>1){const g=ns[i-2];frame.rotate(a.subVectors(p.rest,g.rest).normalize());b.subVectors(p.p,g.p).normalize();out.applyQuaternion(r.setFromUnitVectors(a,b));}
  return out.add(p.p);
 }
 start(points,velocity){this.nodes.forEach((n,i)=>{n.p.copy(points[i]);n.q.copy(n.p);n.v.copy(velocity);n.touch=false;n.fall=0;});}
 step(frame,{friction,drag,radius=1,push=null,droop=0,maxBend=1.1}){
  const ns=this.nodes,{a,b,c}=this;this.droop=droop;
  // Bending springs toward the rest bend, with equal and opposite reactions on
  // the parent (one-sided springs pump energy into the chain), and damping of
  // each segment's relative motion.
  for(let i=1;i<ns.length;i++){
   const n=ns[i];if(n.anchor||!n.k)continue;const p=ns[i-1];
   this.target(frame,i,c);a.subVectors(c,n.p).multiplyScalar(n.k*STEP).addScaledVector(b.subVectors(n.v,p.v),-n.damp*n.mass*STEP);
   n.v.addScaledVector(a,1/n.mass);if(!p.anchor)p.v.addScaledVector(a,-1/p.mass);
  }
  for(const [i,n]of ns.entries()){
   n.q.copy(n.p);
   if(n.anchor){frame(n.rest,n.p);continue;}
   if(n.touch){const h=Math.hypot(n.v.x,n.v.z),loss=Math.min(h,friction*n.friction*G*STEP);if(h>1e-6){n.v.x-=n.v.x/h*loss;n.v.z-=n.v.z/h*loss;}}
   n.v.multiplyScalar(Math.exp(-drag*STEP));n.v.y-=G*STEP;if(push)push(i,n);
   n.fall=-n.v.y;n.p.addScaledVector(n.v,STEP);
  }
  for(let k=0;k<4;k++){
   for(let i=1;i<ns.length;i++){
    const p=ns[i-1],n=ns[i],w=p.w+n.w;if(!w)continue;
    a.subVectors(n.p,p.p);const d=a.length()||1e-6,e=(d-n.len)/d/w;
    p.p.addScaledVector(a,e*p.w);n.p.addScaledVector(a,-e*n.w);
   }
   // Joint limits: no segment strays more than maxBend from its rest bend on its
   // parent, so a buckling neck can never fold back through itself.
   for(let i=1;i<ns.length;i++){
    const n=ns[i];if(n.anchor)continue;const p=ns[i-1];
    this.target(frame,i,c);b.subVectors(c,p.p).normalize();
    a.subVectors(n.p,p.p);const len=a.length()||1e-6;a.divideScalar(len);
    const cos=a.dot(b);if(cos<Math.cos(maxBend)){c.crossVectors(b,a);if(c.lengthSq()<1e-10)c.set(1,0,0);c.normalize();a.copy(b).applyAxisAngle(c,maxBend);n.p.copy(p.p).addScaledVector(a,len);}
   }
   for(const n of ns)if(!n.anchor){const h=n.radius*radius;if(n.p.y<h)n.p.y=h;}
  }
  // Constraint corrections become velocity; cap it so a hard stop at the root
  // can never catapult the chain.
  for(const n of ns){n.v.subVectors(n.p,n.q).divideScalar(STEP);if(n.anchor)continue;const sp=n.v.length();if(sp>16)n.v.multiplyScalar(16/sp);n.touch=n.p.y<=n.radius*radius+.004;}
 }
}

export class DeathMotion {
 constructor(actor,meshes,bones,rest,gait,pose){
  Object.assign(this,{actor,meshes,bones,rest,gait,pose});
  const find=prefix=>bones.find(b=>b.name.startsWith(prefix));
  const skin=meshes.find(m=>m.name==='Rex_Skin');this.skin=skin;
  // Skinned support samples: extreme vertices per joint keep the body and head
  // off the road and report the head's lowest point.
  const directions=[new T.Vector3(1,0,0),new T.Vector3(-1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,-1,0),new T.Vector3(0,0,1),new T.Vector3(0,0,-1),new T.Vector3(1,1,0),new T.Vector3(-1,1,0),new T.Vector3(1,-1,0),new T.Vector3(-1,-1,0)];
  this.support=meshes.filter(m=>m.isSkinnedMesh).map(mesh=>{
   const {position,skinIndex,skinWeight}=mesh.geometry.attributes,groups=new Map();
   for(let i=0;i<position.count;i++){
    let joint=0,best=-1;for(let k=0;k<4;k++){const weight=skinWeight.getComponent(i,k);if(weight>best){best=weight;joint=skinIndex.getComponent(i,k);}}
    if(!groups.has(joint))groups.set(joint,directions.map(()=>({score:-Infinity,index:0})));
    const p=new T.Vector3().fromBufferAttribute(position,i);
    directions.forEach((d,k)=>{const score=p.dot(d),slot=groups.get(joint)[k];if(score>slot.score){slot.score=score;slot.index=i;}});
   }
   const points=[];for(const [joint,slots]of groups){const name=mesh.skeleton.bones[joint]?.name||'',body=/back_|neck_|head_|jaw_|ribCage|Bone03/.test(name),head=/head_|jaw_/.test(name);for(const index of new Set(slots.map(s=>s.index)))points.push({index,body,head});}
   return{mesh,points};
  });
  // The rigid body's contacts: the lowest torso vertex in each half-metre slice
  // of the belly, chest and pubis, at the centre and both flanks (rest space).
  const {position,skinIndex,skinWeight}=skin.geometry.attributes,torso=new Set(),cells=new Map(),p=new T.Vector3();
  skin.skeleton.bones.forEach((b,i)=>{if(/^(back_|ribCage|Bone03|leg_01_|Ctrl_breath)/.test(b.name))torso.add(i);});
  for(let i=0;i<position.count;i++){
   let joint=0,best=-1;for(let k=0;k<4;k++){const w=skinWeight.getComponent(i,k);if(w>best){best=w;joint=skinIndex.getComponent(i,k);}}
   if(!torso.has(joint))continue;p.fromBufferAttribute(position,i);if(p.z<-.75||p.z>3.3)continue;
   const key=`${Math.round(p.z*2)}:${p.x<-.35?-1:p.x>.55?1:0}`,cell=cells.get(key);if(!cell||p.y<cell.y)cells.set(key,p.clone());
  }
  this.hull=[...cells.values()].map(r=>({r,chest:r.z>2.1,n:0,speed:0,k:1,mu:1}));
  // Throat and jaw: the neck is a strut that stops her pitching onto her nose.
  // It bends under load, so these contacts are softer, and they plough.
  const front=new Map();skin.skeleton.bones.forEach((b,i)=>{if(/^(neck_|head_|jaw_)/.test(b.name))front.set(i,1);});
  const struts=new Map();
  for(let i=0;i<position.count;i++){
   let joint=0,best=-1;for(let k=0;k<4;k++){const w=skinWeight.getComponent(i,k);if(w>best){best=w;joint=skinIndex.getComponent(i,k);}}
   if(!front.has(joint))continue;p.fromBufferAttribute(position,i);if(p.z<3.6||Math.abs(p.x-.2)>.35)continue;
   const key=Math.round(p.z*1.5),cell=struts.get(key);if(!cell||p.y<cell.y)struts.set(key,p.clone());
  }
  for(const r of struts.values())this.hull.push({r,chest:true,strut:true,n:0,speed:0,k:.3,mu:1.3});
  const bind=bone=>new T.Vector3().setFromMatrixPosition(skin.skeleton.boneInverses[skin.skeleton.bones.indexOf(bone)].clone().invert());
  // Tail: root pair rides the pelvis; the rest hangs, whips and drags.
  const tailNames=['tail_01_','tail_02_','tail_03_','tail_04_','tail_05_','tail_06_','tail_07_','tail_08_','tail_09_','tail_10_','tail_11_','tail_11_end'];
  this.tailBones=tailNames.map(find);
  const tailRadius=[0,0,1,.85,.68,.52,.44,.39,.35,.29,.22,.14],tailMass=[1,1,3,2.5,2,1.6,1.3,1,.8,.6,.45,.3],tailK=[0,0,120,80,52,34,23,16,11,8,5.5,3.5];
  this.tail=new Chain(this.tailBones.map((b,i)=>({rest:bind(b),radius:tailRadius[i],mass:tailMass[i],k:tailK[i],damp:7,anchor:i<2,friction:i<6?1:.8})));
  // Neck and head: a heavy skull on a thick, short neck; the snout is a stiff
  // extension of the head, so the skull keeps its shape.
  this.neckBones=['neck_01_','neck_02_','neck_03_','neck_05_','neck_06_','head_'].map(find);
  this.head=this.neckBones[5];
  this.neck=new Chain([...this.neckBones.map(bind),SNOUT].map((rest,i)=>({rest,radius:[0,.5,.7,.86,.98,1.12,.56][i],mass:[1,1.2,1.2,1.1,1,2.8,1.6][i],k:[0,210,185,160,140,220,1600][i],damp:8,anchor:i===0,friction:i>=5?1.3:.9})));
  const headInverse=skin.skeleton.boneInverses[skin.skeleton.bones.indexOf(this.head)];
  this.snoutLocal=SNOUT.clone().applyMatrix4(headInverse);this.nostrilLocal=NOSTRIL.clone().applyMatrix4(headInverse);
  this.sockets=gait.legs.map(l=>bind(l.hip));
  this.arms=['L','R'].map(side=>({upper:find(`arm_01_${side}_`),lower:find(`arm_02_${side}_`),tips:[find(`finger_02_02_${side}_end`),find(`finger_01_02_${side}_end`)],angle:0,velocity:0,push:0}));
  this.ribs=bones.filter(b=>/^ribCage_(front|back)_01_/.test(b.name));
  this.spine=['back_02_','back_03_','back_04_'].map((n,i)=>({bone:find(n),pitch:0,pv:0,bend:0,bv:0,weight:.7+i*.15}));
  this.jaw=find('jaw_01_');
  // Scratch.
  this.s=Array.from({length:8},()=>new T.Vector3());this.sq=Array.from({length:4},()=>new T.Quaternion());
  this.lateral=new T.Vector3();this.frameFn=this.frame();
  this.reset();
 }

 reset(){
  this.active=false;this.complete=false;this.time=0;this.stepTime=0;this.clock=0;this.asleep=false;this.events=[];this.pending=[];this.contacts=[];this.impacts={};
  this.minY=0;this.headMinY=0;this.forwardSpeed=0;this.slide=0;this.jawOpen=0;this.exhaled=false;
  for(const s of this.spine){s.pitch=s.pv=s.bend=s.bv=0;}for(const a of this.arms){a.angle=a.velocity=a.push=0;}
 }

 /** Maps rest-space points into the ground frame for the current body state. */
 frame(){
  const q=new T.Quaternion(),yaw=new T.Quaternion(),pitch=new T.Quaternion(),roll=new T.Quaternion();
  const fn=(r,out)=>out.copy(r).sub(COM).applyQuaternion(q).add(fn.com);
  fn.com=new T.Vector3();fn.q=q;
  fn.update=()=>{const b=this.body;q.copy(this.startQ).multiply(yaw.setFromAxisAngle(Y,b.yaw)).multiply(pitch.setFromAxisAngle(X,b.theta)).multiply(roll.setFromAxisAngle(Z,b.roll));fn.com.copy(b.com).addScaledVector(this.heading,b.s).setY(b.y);};
  fn.rotate=v=>v.applyQuaternion(q);
  return fn;
 }

 begin(){
  this.active=true;
  const actor=this.actor;actor.updateMatrixWorld(true);
  this.startPose=new Map(this.bones.map(b=>[b,b.quaternion.clone()]));
  this.startQ=actor.quaternion.clone();
  this.heading=new T.Vector3(0,0,1).applyQuaternion(this.startQ).setY(0).normalize();
  // She goes down toward the side of the leg that was carrying her.
  this.side=this.gait.legs.find(l=>l.stance)?.side==='R'?-1:1;
  const com=actor.localToWorld(COM.clone());
  this.body={com,s:0,y:com.y,v:this.gait.speed,vy:0,theta:0,omega:0,yaw:0,roll:0,y0:com.y};
  this.shift=0;this.forwardSpeed=this.body.v;
  // Wet mud is slicker than packed dirt: the storm slide runs further.
  this.mu=T.MathUtils.lerp(.48,.3,WET.value);
  this.frameFn.update();
  const velocity=this.heading.clone().multiplyScalar(this.body.v);
  this.tail.start(this.tailBones.map(b=>b.getWorldPosition(new T.Vector3())),velocity);
  this.neck.start([...this.neckBones.map(b=>b.getWorldPosition(new T.Vector3())),this.snoutLocal.clone().applyMatrix4(this.head.matrixWorld)],velocity);
  // Feet: the ball of each foot is a physics point. The stance foot is planted;
  // the swinging one is still travelling forward and falls.
  this.legs=this.gait.legs.map((leg,i)=>{
   const ankle=leg.ankle.getWorldPosition(new T.Vector3()),ball=leg.ankle.children.find(c=>/^foot_02_02_/.test(c.name)).getWorldPosition(new T.Vector3());
   const startQ=leg.ankle.getWorldQuaternion(new T.Quaternion()),meta=ball.clone().sub(ankle);
   return{leg,socket:this.sockets[i],p:ball,v:leg.stance?new T.Vector3():velocity.clone().addScaledVector(this.heading,3.5).setY(-.4),touch:!!leg.stance,
    metaLocal:meta.clone().applyQuaternion(startQ.clone().invert()),startQ,outward:leg.side==='L'?1:-1,trail:0,load:0,
    reach:(leg.upperLength+leg.lowerLength)*.88,radius:.46,hop:hash(i+this.side)};
  });
 }

 /** Authored heading drift and roll: the snout catches and turns her a little,
  *  and she settles partly onto the flank her head turns toward. */
 attitude(t){
  const b=this.body,side=this.side;
  b.yaw=side*(.03*smooth(t,.2,.7)+.14*smooth(t,.9,3.1));
  b.roll=-side*(.04*smooth(t,.1,.55)+.17*smooth(t,1.8,3.6));
 }

 simulate(t){
  const b=this.body,f=this.frameFn,heading=this.heading,[point,pv,arm,F,tmp,hip]=this.s;
  this.attitude(t);f.update();
  const lateral=this.lateral.copy(X).applyQuaternion(this.startQ).applyAxisAngle(Y,b.yaw);
  const force=tmp.set(0,-G,0);let torque=0;
  const apply=(at,Fv)=>{arm.subVectors(at,f.com);force.add(Fv);torque+=hip.crossVectors(arm,Fv).dot(lateral);};
  const pointVelocity=(at,out)=>{arm.subVectors(at,f.com);return out.copy(lateral).multiplyScalar(b.omega).cross(arm).add(hip.copy(heading).multiplyScalar(b.v).setY(b.vy));};
  // Legs: buckling struts at the planted feet. What load they still carry lifts
  // there, and claw friction drags backward; once momentum carries the hips past
  // the feet, both pitch her nose-down.
  const hold=1-smooth(t,.04,.7),planted=this.legs.filter(l=>l.touch);
  for(const l of this.legs)l.load=0;
  if(hold>0&&planted.length){
   const N=Math.max(0,hold*(G+26*(b.y0-b.y)-5*b.vy))/planted.length;
   for(const l of planted){
    l.load=N;point.copy(l.p).setY(0);pointVelocity(point,pv);const h=Math.hypot(pv.x,pv.z),trip=.7*N*Math.min(1,h/.4);
    F.set(0,N,0);if(h>1e-4){F.x-=pv.x/h*trip;F.z-=pv.z/h*trip;}
    apply(point,F);
   }
  }
  // Belly, chest and pubis on the ground, with regularized Coulomb friction.
  // Soil yields under a heavy landing, so friction saturates with total load:
  // the slam costs some speed, then she skids on.
  let load=0;
  for(const c of this.hull){
   f(c.r,c.at??=new T.Vector3());if(c.at.y>=0){c.n=0;continue;}
   pointVelocity(c.at,c.pv??=new T.Vector3());if(!c.n)c.speed=-c.pv.y;
   c.n=Math.max(1e-6,c.k*(-K_GROUND*c.at.y-C_GROUND*c.pv.y));load+=c.n;
  }
  const yieldScale=load>FRICTION_LOAD?FRICTION_LOAD/load:1;
  for(const c of this.hull){
   if(!c.n)continue;const pv=c.pv,h=Math.hypot(pv.x,pv.z),fr=this.mu*c.mu*c.n*yieldScale*Math.min(1,h/.25);
   F.set(0,c.n,0);if(h>1e-6){F.x-=pv.x/h*fr;F.z-=pv.z/h*fr;}
   c.at.y=0;apply(c.at,F);
  }
  // The head ploughing its furrow drags back through the neck.
  let plough=0;for(const n of this.neck.nodes)if(n.touch)plough+=n.mass;
  if(plough>0&&b.v>0){F.copy(heading).multiplyScalar(-Math.min(b.v*4,this.mu*1.3*G*.08*plough));apply(f(NECK_BASE,point),F);}
  b.v=Math.max(0,b.v+force.dot(heading)*STEP);b.vy+=force.y*STEP;b.omega+=(torque/INERTIA-b.omega*.6)*STEP;
  b.s+=b.v*STEP;b.y+=b.vy*STEP;b.theta+=b.omega*STEP;
  f.update();
  this.stepFeet(t);
  // The snout catches on one side, so the neck buckles sideways instead of
  // folding straight up, and the head comes to rest turned on its cheek.
  const side=this.side,roll=this.headRoll(t);
  this.tail.step(f,{friction:this.mu*1.05,drag:.6,maxBend:1.5});
  // The dead neck's muscles let go at once: each joint sags toward the ground.
  this.neck.step(f,{friction:this.mu*1.2,drag:.8,radius:1-.12*roll,maxBend:.85,droop:.17*smooth(t,.03,.4),push:(i,n)=>{if(i>=5&&n.touch&&b.v>.4)n.v.addScaledVector(lateral,side*(i===6?6:3)*STEP*Math.min(1,b.v/3));}});
 }

 headRoll(t){return this.impacts.chin===undefined?0:smooth(t-this.impacts.chin,.25,1.8);}

 stepFeet(t){
  const f=this.frameFn,[,,,,,,socket,meta]=this.s;
  for(const l of this.legs){
   f(l.socket,socket);
   if(l.touch){
    const h=Math.hypot(l.v.x,l.v.z),loss=Math.min(h,(l.load>0?4:1)*.9*G*STEP);if(h>1e-6){l.v.x-=l.v.x/h*loss;l.v.z-=l.v.z/h*loss;}
    // Dragged claws catch on the ground and skip.
    if(h>1.2&&hash(t*37+l.hop)<.012)l.v.y+=.9+hash(t*53+l.hop)*.8;
   }
   l.v.y-=G*STEP;l.v.multiplyScalar(Math.exp(-.5*STEP));
   const bx=l.p.x,by=l.p.y,bz=l.p.z;l.p.addScaledVector(l.v,STEP);
   // How far the foot trails behind the hip decides how it turns.
   const behind=-((l.p.x-socket.x)*this.heading.x+(l.p.z-socket.z)*this.heading.z);
   l.trail+=(smooth(behind,.9,2)-l.trail)*(1-Math.exp(-STEP*5));
   // Reach: keep the ankle (a metatarsus behind the ball) within the leg's
   // length of the hip socket, and below the hip (the joint cannot swing the
   // leg up over the back). A dragged foot follows the hip; it is not flung.
   this.metatarsus(l,t,meta);
   const d=l.p.clone().sub(meta).sub(socket),inverse=this.sq[1].copy(f.q).invert();d.applyQuaternion(inverse);
   let len=d.length(),limited=false;
   if(len>l.reach){d.multiplyScalar(l.reach/len);len=l.reach;limited=true;}
   if(d.y>-.15*len){const h=Math.hypot(d.x,d.z)||1e-6,y=-.15*len,k=Math.sqrt(Math.max(0,len*len-y*y))/h;d.set(d.x*k,y,d.z*k);limited=true;}
   if(limited)l.p.copy(d.applyQuaternion(f.q)).add(socket).add(meta);
   if(l.p.y<l.radius)l.p.y=l.radius;
   l.v.set((l.p.x-bx)/STEP,(l.p.y-by)/STEP,(l.p.z-bz)/STEP);
   if(limited&&l.last)l.v.lerp(this.s[5].subVectors(socket,l.last).divideScalar(STEP),.25);
   (l.last??=new T.Vector3()).copy(socket);
   l.touch=l.p.y<=l.radius+.01;
  }
 }

 /** The ankle-to-ball vector for this leg's current foot orientation. */
 metatarsus(l,t,out){return out.copy(l.metaLocal).applyQuaternion(this.footQ(l,t,this.sq[3]));}

 /** Foot orientation: from the running pose to a folded foot (metatarsus flat,
  *  toes forward, as a resting bird's), swivelling outward to point backward as
  *  the leg trails behind the hip. */
 footQ(l,t,out){
  const [a,b]=this.sq;
  const rest=this.s[4].copy(l.metaLocal).applyQuaternion(l.startQ).normalize();
  const fold=this.s[3].set(0,-.28,1).normalize().applyAxisAngle(Y,Math.atan2(this.heading.x,this.heading.z)+this.body.yaw);
  a.setFromUnitVectors(rest,fold).multiply(l.startQ);
  b.setFromAxisAngle(Y,l.outward*Math.PI*.9*l.trail).multiply(a);
  return out.copy(l.startQ).slerp(b,smooth(t,.05,.5));
 }

 update(dt,roadSpeed){
  if(!this.active)this.begin();
  this.time+=dt;const t=this.time;this.shift+=roadSpeed*dt;
  // Fixed substeps; the whole state is held once everything is at rest.
  if(!this.asleep){
   this.clock+=dt;
   while(this.clock>=STEP){this.clock-=STEP;this.stepTime+=STEP;this.simulate(this.stepTime);this.detect(this.stepTime);}
   if(this.stepTime>=SETTLE)this.asleep=true;
  }
  this.forwardSpeed=this.asleep?0:this.body.v;this.slide=this.forwardSpeed;
  this.arrange(t,dt);
  this.surface();
  this.complete=t>=5.2;
 }

 /** First touchdown of chin, chest, hips and tail. */
 detect(t){
  const f=this.frameFn,mark=(part,at,speed,scale)=>{if(this.impacts[part]!==undefined)return;this.impacts[part]=t;this.pending.push({part,at:at.clone().setY(.05),strength:clamp(speed/scale,.3,1.2)});};
  const [snout,jaw]=[this.neck.nodes[6],this.neck.nodes[5]];
  if(this.impacts.chin===undefined&&(snout.touch||jaw.touch)){const n=snout.touch?snout:jaw;mark('chin',n.p,n.fall+2,6);}
  for(const c of this.hull){if(!c.n||c.strut)continue;const part=c.chest?'chest':'hips';if(this.impacts[part]===undefined)mark(part,f(c.r,this.s[0]),c.speed+(c.chest?1.5:1),4);}
  for(let i=5;i<this.tail.nodes.length&&this.impacts.tail===undefined;i++){const n=this.tail.nodes[i];if(n.touch&&n.fall>1)mark('tail',n.p,n.fall,6);}
 }

 arrange(t,dt){
  const actor=this.actor,b=this.body,f=this.frameFn,shift=this.shift;
  f.update();
  actor.quaternion.copy(f.q);
  actor.position.copy(COM).applyQuaternion(f.q).negate().add(f.com);actor.position.z+=shift;
  // Everything not driven below relaxes out of the stride.
  const limp=smooth(t,.02,.5);
  for(const [bone,r]of this.rest){bone.position.copy(r.p);bone.scale.copy(r.s);bone.quaternion.copy(this.startPose.get(bone)).slerp(r.q,limp);}
  actor.updateMatrixWorld(true);
  const lateral=new T.Vector3(1,0,0).applyQuaternion(f.q),up=new T.Vector3(0,1,0).applyQuaternion(f.q);
  // Spine: damped flex, kicked by each landing (chest pushed up, then the hips).
  for(const e of this.pending){const k=e.part==='chest'?-.9:e.part==='hips'?.6:e.part==='chin'?-.35:0;for(const s of this.spine){s.pv+=k*e.strength;s.bv+=this.side*k*.5*e.strength;}}
  // Skidding over ruts and clods jolts the carcass: small kicks scaled by speed.
  // Once the fall sleeps, every spring holds exactly where it is.
  // The ground's unevenness passes under her as she slides: offsets that follow
  // the distance travelled, so they are the same at any frame rate.
  const steps=this.asleep?0:Math.max(1,Math.ceil(dt*240)),h=dt/Math.max(1,steps),rough=this.contacts.length?Math.min(1,b.v/2.5):0;
  const ground=(x,k)=>Math.sin(x*1.9+k)*.6+Math.sin(x*4.3+k*2.1)*.4;
  for(const [i,s]of this.spine.entries()){
   const pitchGoal=ground(b.s,i*1.3)*.045*rough,bendGoal=ground(b.s*.8,i*2.7+4)*.035*rough;
   for(let k=0;k<steps;k++){s.pv+=((pitchGoal-s.pitch)*140-s.pv*9)*h;s.pitch+=s.pv*h;s.bv+=((bendGoal-s.bend)*110-s.bv*8)*h;s.bend+=s.bv*h;}
   this.turn(s.bone,lateral,s.pitch*s.weight);this.turn(s.bone,up,s.bend*s.weight);
  }
  // A last breath once she has come to rest: the ribcage sinks and stays down.
  const exhale=smooth(t,EXHALE,EXHALE+.7);for(const rib of this.ribs)rib.quaternion.multiply(this.sq[0].setFromAxisAngle(Z,(rib.name.includes('_L_')?-1:1)*.045*exhale));
  actor.updateMatrixWorld(true);
  // Chains into bones: each joint aims at the next simulated node.
  const tail=this.tail.nodes,neck=this.neck.nodes;
  this.aim(this.tailBones.slice(1,11),this.tailBones.slice(2),tail.slice(2),shift);
  this.aim(this.neckBones,[...this.neckBones.slice(1),null],neck.slice(1),shift);
  const skull=this.snoutLocal.clone().applyMatrix4(this.head.matrixWorld).sub(this.head.getWorldPosition(new T.Vector3())).normalize();
  this.turn(this.head,skull,-this.side*.7*this.headRoll(this.stepTime));
  // Jaw hangs slack; a ploughing chin forces it shut.
  const target=(neck[6].touch&&b.v>.5?.02:.15)*limp;if(!this.asleep)this.jawOpen+=(target-this.jawOpen)*(1-Math.exp(-dt*6));
  this.jaw.quaternion.multiply(this.sq[0].setFromAxisAngle(X,-this.jawOpen));
  this.head.updateMatrixWorld(true);
  // Legs by IK to the simulated feet; folded knees splay outward.
  const headingQ=new T.Quaternion().setFromAxisAngle(Y,Math.atan2(this.heading.x,this.heading.z)+b.yaw);
  for(const l of this.legs){
   const footQ=this.footQ(l,this.stepTime,new T.Quaternion()),ankle=new T.Vector3().copy(l.metaLocal).applyQuaternion(footQ).negate().add(l.p);ankle.z+=shift;
   const fold=1-smooth(ankle.y,.5,1.3),pole=new T.Vector3(l.outward*(.2+.8*fold),-.1-.25*l.trail,1).applyQuaternion(headingQ);
   this.solveLeg(l.leg,ankle,footQ,pole);
  }
  // Arms: limp, swept back by the ground as the chest comes down.
  actor.updateMatrixWorld(true);
  const lowestTip=a=>Math.min(...a.tips.map(b=>b.getWorldPosition(this.s[6]).y));
  for(const a of this.arms){
   a.push=Math.max(a.push,clamp((.2-lowestTip(a))/.6,0,1.6));
   const goal=.25*limp+a.push+ground(b.s*1.3,a.upper.id)*.12*rough;if(!this.asleep){a.velocity+=((goal-a.angle)*120-a.velocity*14)*dt;a.angle+=a.velocity*dt;}
   this.turn(a.upper,lateral,a.angle);this.turn(a.lower,lateral,-.4*a.angle);
   // Still in the dirt: swing further back now, and remember it.
   a.upper.updateMatrixWorld(true);const y=lowestTip(a);if(y<.15){const extra=clamp((.15-y)/.5,0,1.2);this.turn(a.upper,lateral,extra);a.push+=extra;a.angle+=extra;a.upper.updateMatrixWorld(true);}
  }
  actor.updateMatrixWorld(true);
  for(const mesh of this.meshes)if(mesh.isSkinnedMesh)mesh.skeleton.update();
  // Guard: nothing of the body or head below the road.
  let min=Infinity,headMin=Infinity;const point=new T.Vector3();
  for(const {mesh,points}of this.support)for(const p of points){if(!p.body)continue;mesh.getVertexPosition(p.index,point);point.applyMatrix4(mesh.matrixWorld);min=Math.min(min,point.y);if(p.head)headMin=Math.min(headMin,point.y);}
  const correction=Math.max(0,-min);
  if(correction>0){actor.position.y+=correction;actor.updateMatrixWorld(true);}
  this.minY=min+correction;this.headMinY=headMin+correction;
 }

 /** Rotate a bone about a world axis. */
 turn(bone,axis,angle){
  if(!angle)return;const [a,b]=this.sq;bone.parent.getWorldQuaternion(a);
  b.copy(a).multiply(bone.quaternion).premultiply(this.sq[2].setFromAxisAngle(axis,angle));bone.quaternion.copy(a.invert().multiply(b));
 }

 /** Point each bone at its chain node (minimal rotation), root first. A null
  *  child means the skull, whose tip is the snout. */
 aim(bones,children,nodes,shift){
  const target=new T.Vector3(),from=new T.Vector3(),origin=new T.Vector3();
  bones.forEach((bone,i)=>{
   bone.updateWorldMatrix(true,false);bone.getWorldPosition(origin);
   const child=children[i];if(child){child.updateWorldMatrix(false,false);child.getWorldPosition(from);}else from.copy(this.snoutLocal).applyMatrix4(bone.matrixWorld);
   target.copy(nodes[i].p);target.z+=shift;
   this.gait.rotateWorld(bone,from.sub(origin),target.sub(origin));
  });
 }

 solveLeg(leg,target,footQ,pole){
  const {hip,knee,ankle,upperLength:a,lowerLength:b}=leg;
  hip.updateWorldMatrix(true,true);
  const h=hip.getWorldPosition(new T.Vector3()),k=knee.getWorldPosition(new T.Vector3());
  const direction=target.clone().sub(h),distance=clamp(direction.length(),.45,a+b-.025);direction.normalize();
  const along=(a*a-b*b+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,a*a-along*along));
  const bend=pole.clone().addScaledVector(direction,-pole.dot(direction)).normalize();
  const kneeTarget=h.clone().addScaledVector(direction,along).addScaledVector(bend,height);
  // Keep the knee out of the dirt by swinging the bend outward and up.
  if(kneeTarget.y<.35){const up=new T.Vector3(0,1,0);up.addScaledVector(direction,-up.dot(direction)).normalize();bend.lerp(up,clamp((.35-kneeTarget.y)/.6,0,1)).normalize();kneeTarget.copy(h).addScaledVector(direction,along).addScaledVector(bend,height);}
  this.gait.rotateWorld(hip,k.clone().sub(h),kneeTarget.clone().sub(h));
  const actualKnee=knee.getWorldPosition(new T.Vector3()),actualAnkle=ankle.getWorldPosition(new T.Vector3());
  this.gait.rotateWorld(knee,actualAnkle.sub(actualKnee),h.clone().addScaledVector(direction,distance).sub(actualKnee));
  ankle.quaternion.copy(ankle.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(footQ));
  ankle.updateWorldMatrix(false,true);
 }

 /** Ground contacts for the effects, and impact events, in the Jeep's frame. */
 surface(){
  const shift=this.shift,out=[],f=this.frameFn,still=this.asleep;
  const add=(kind,p,v,load,width)=>out.push({kind,position:new T.Vector3(p.x,.02,p.z+shift),velocity:still?new T.Vector3():v.clone(),slip:still?0:Math.hypot(v.x,v.z),load,width});
  const neck=this.neck.nodes;
  if(neck[6].touch)add('chin',neck[6].p,neck[6].v,1,.55);
  if(neck[5].touch)add('jaw',neck[5].p,neck[5].v,1,.85);
  const p=new T.Vector3(),chest=new T.Vector3(),belly=new T.Vector3();let cN=0,bN=0;
  for(const c of this.hull){if(!c.n||c.strut)continue;f(c.r,p);if(c.chest){chest.addScaledVector(p,c.n);cN+=c.n;}else{belly.addScaledVector(p,c.n);bN+=c.n;}}
  const body=this.heading.clone().multiplyScalar(this.body.v);
  if(cN>1e-3)add('chest',chest.divideScalar(cN),body,Math.min(1,cN/G),1.25);
  if(bN>1e-3)add('belly',belly.divideScalar(bN),body,Math.min(1,bN/G),1.5);
  for(const l of this.legs)if(l.touch)add(`foot-${l.leg.side}`,l.p,l.v,.5,.55);
  const tail=this.tail.nodes;
  for(const [kind,from,to,width]of [['tail',2,6,.8],['tail-tip',6,12,.34]])for(let i=from;i<to;i++)if(tail[i].touch){add(kind,tail[i].p,tail[i].v,.6,width);break;}
  this.contacts=out;
  for(const e of this.pending.splice(0)){e.at.z+=shift;this.events.push({type:'body-impact',part:e.part,position:e.at,strength:e.strength});}
  if(!this.exhaled&&this.time>=EXHALE){this.exhaled=true;const nose=this.nostrilLocal.clone().applyMatrix4(this.head.matrixWorld),dir=this.snoutLocal.clone().applyMatrix4(this.head.matrixWorld).sub(this.head.getWorldPosition(new T.Vector3())).normalize();this.events.push({type:'exhale',position:nose,direction:dir});}
 }

 drainEvents(){return this.events.splice(0);}
}
