import * as T from 'three';
import {createRex} from '../chase/creature.js';
import {RULES} from '../chase/combat.js';
import {routeX,routeY} from './world.js';
import {LEVEL} from './water.js';
import {PROPORTIONS,makeIndominus} from './indominus.js';

// Pursuit's hero Rex as the arcade's Rex boss. The shared gait and death fall
// work in the chase's frame: an identity parent, a floor at y=0 and the road
// sliding +z under her at roadSpeed. Each Rex here lives in her own sandbox.
// While her rig updates, the sandbox sits at the origin; afterwards it is
// translated to her place on the route for rendering, aim and sound. She moves
// through the world at her own ground speed, which is exactly the roadSpeed the
// gait is given, so planted feet stay put along the route. When the sandbox
// slides sideways, the gait's world anchors shift back so feet stay put in x too.
// Wading depth keeps her head above the boat's gunner; a carcass settles at the waterline.
const CYCLE=6.4,REACH=7,BITE_GAP=4.6,START_GAP=24,WADE=-.85,FLOAT=-.5;
const clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp;

export class BossRex {
 constructor(world){this.world=world;this.slots=[];this.ready=false;this.cues=[];this.voice=null;this.stage='';this.lastTime=0;this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.a=new T.Vector3();this.b=new T.Vector3();this.lastHit=null;}
 /** Loads one Rex per finale king, in the background; the 2D boss covers until then. */
 async load(count=2){
  for(let i=0;i<count;i++)await this.add('rex');
  this.ready=true;
  // A11: the hybrid stage's Indominus is a third, re-proportioned and reskinned Rex.
  await this.add('indominus');
 }
 async add(kind){
  const indo=kind==='indominus',rex=await createRex(this.world.scene,null,indo?{proportions:PROPORTIONS}:{}),frame=new T.Group();
  frame.add(rex.actor);this.world.scene.add(frame);rex.actor.position.set(0,0,0);this.world.rimCreatures(rex.actor);
  const slot={rex,frame,kind,index:this.slots.length,id:null,indo:indo?makeIndominus(rex):null};this.release(slot);this.slots.push(slot);
  this.prewarm(slot);
 }
 // Compile her hide, shadow and post variants now, on the hidden scene canvas,
 // so the first boss arrival does not stall on shader compilation.
 prewarm(slot){
  const cam=this.world.camera;slot.frame.position.copy(cam.position).add(this.a.set(0,0,40).applyQuaternion(cam.quaternion)).setY(cam.position.y-2.6);slot.frame.visible=true;slot.frame.updateMatrixWorld(true);
  try{this.world.render();}catch{/* A later frame compiles instead. */}slot.frame.visible=false;
 }
 release(slot){slot.id=null;slot.entity=null;slot.started=false;slot.dead=false;slot.frame.visible=false;slot.lastX=null;slot.bite=-1;slot.stagger=-1;slot.lunging=false;slot.roared=false;slot.speed=0;slot.fall=0;}
 reset(){for(const s of this.slots){this.release(s);s.rex.reset();}this.stage='';this.lastTime=0;this.cues=[];this.lastHit=null;}
 slotFor(e){return e?.boss&&(e.kind==='rex'||e.kind==='indominus')?this.slots.find(s=>s.id===e.id&&s.started)||null:null;}
 handles(e){return !!this.slotFor(e);}
 drain(){return this.cues.splice(0);}
 /** Rules events carry the boss id: the bite lands, or nine head hits broke the attack. */
 event(e){
  const s=this.slots.find(s=>s.id!==null&&s.id===e.id&&s.started);if(!s)return;
  if(e.type==='attack')this.cues.push({type:'bite',slot:s.index});
  if(e.type==='stagger'){s.stagger=0;s.bite=-1;this.cues.push({type:'pain',slot:s.index});}
 }
 sync(game){
  if(!this.ready)return;
  const id=game?.stage.id||'';
  if(id!==this.stage){this.stage=id;for(const s of this.slots){this.release(s);s.rex.reset();}}
  if(!game){this.lastTime=0;return;}
  if(game.time<this.lastTime)this.lastTime=game.time;
  const dt=clamp(game.time-this.lastTime,0,.05);this.lastTime=game.time;
  for(const e of game.entities)if(e.boss&&(e.kind==='rex'||e.kind==='indominus')&&!e.dead&&!this.slots.some(s=>s.id===e.id)){const s=this.slots.find(s=>s.id===null&&s.kind===e.kind);if(s){this.release(s);s.id=e.id;s.entity=e;s.rex.reset();}}
  // Overdrive slows threats: she runs, bites and falls in slow motion too.
  const paced=dt*(game.focusTime>0?.52:1);
  for(const s of this.slots){if(s.id===null)continue;const e=game.entities.find(x=>x.id===s.id);if(e)s.entity=e;this.update(s,paced,game,!e);}
 }
 update(s,dt,game,removed){
  const e=s.entity,rex=s.rex,id=game.stage.id,camZ=game.travel;
  if(!s.started){if(e.age<0)return;s.started=true;s.z=camZ+REACH+START_GAP;s.speed=0;s.lateral=-(e.lane-.5)*15*Math.min(1,this.world.camera.aspect*1.6);s.offset=s.index*2.3;s.biteCycle=-1;s.x=routeX(camZ,id)+s.lateral;s.y=id==='river'?WADE:routeY(s.z,id)+.05;}
  if((e.dead||removed)&&!s.dead){s.dead=true;s.fall=0;rex.gait.speed=Math.min(rex.gait.speed,8.5);this.cues.push({type:'fall',slot:s.index});}
  if(dt>0&&!s.dead){
   const age=Math.max(0,e.age),cycle=age%CYCLE,first=age<CYCLE,back=Math.max(0,-game.speed),gap=s.z-camZ-REACH;
   // The jaws open as the weak window closes and snap shut as the rules land the bite.
   const round=Math.floor(age/CYCLE);if(s.bite<0&&s.stagger<0&&cycle>=5.8&&s.biteCycle!==round){s.bite=0;s.biteCycle=round;}
   if(s.bite>=0)s.bite+=dt;if(s.bite>1.15)s.bite=-1;
   if(s.stagger>=0)s.stagger+=dt;if(s.stagger>1.6)s.stagger=-1;
   if(!s.roared&&age>.3){s.roared=true;this.cues.push({type:'roar',opening:true,slot:s.index});}
   const lunge=e.attack>0;if(lunge&&!s.lunging){s.lungeFrom=Math.max(gap,BITE_GAP+3);this.cues.push({type:'roar',opening:false,slot:s.index});}s.lunging=lunge;
   // Distance (head to camera) she wants: stand and roar, charge in, stalk
   // through the weak window, then a committed lunge that ends at the bumper.
   let want=null,gain=1.5;
   if(s.bite>=0&&s.bite<.8){want=BITE_GAP;gain=7;}
   else if(first&&age<1.35)want=null;
   else if(lunge){want=lerp(s.lungeFrom,BITE_GAP,Math.pow(e.attack,1.6));gain=7;}
   else if(first&&cycle<1.6)want=14;
   else if(cycle<1.6)want=17;
   else want=lerp(16,11,clamp((cycle-1.6)/2.9,0,1));
   let desired=want===null?0:clamp(back+(gap-want)*gain,0,19);
   if(s.stagger>=0&&s.stagger<1)desired=0;
   s.speed+=clamp(desired-s.speed,-34*dt,24*dt);s.z-=s.speed*dt;
   // Never through the vehicle, whatever the rules or a slow frame ask.
   s.z=Math.max(s.z,camZ+REACH+3);
   s.x=routeX(camZ,id)+s.lateral+Math.sin((game.time+s.offset)*.45)*1.1*smooth(age,1.5,3.5);
   s.y=id==='river'?WADE:routeY(s.z,id)+.05;
  }
  if(s.dead){s.fall+=dt;if(id==='river')s.y=lerp(WADE,FLOAT,smooth(s.fall,.1,.9));}
  if(dt>0){
   // Keep planted feet fixed in the world when the sandbox slides sideways.
   if(s.lastX!==null&&!s.dead){const dx=s.x-s.lastX;if(dx)for(const leg of rex.gait.legs)for(const v of [leg.anchor,leg.swingFrom,leg.contact,leg.landing])v.x-=dx;}s.lastX=s.x;
   s.frame.position.set(0,0,0);s.frame.updateMatrixWorld(true);
   // Recorded calls drive her jaw; without audio (muted context, blocked autoplay)
   // the entrance roar is posed from its timing instead. A bite is also a roar:
   // the head stays up and the open jaws face the gunner, not the deck.
   const voice=this.voice?.active&&this.voiceSlot===s.index?this.voice:null,age=Math.max(0,e.age),lungeJaw=s.bite<0&&e.attack>0?smooth(e.attack,.25,.85)*.9:0;
   const posedRoar=!voice&&age<CYCLE?smooth(age,.3,.75)*(1-smooth(age,1.8,2.5)):0,biteRoar=s.bite>=0&&s.bite<.85?Math.sin(Math.min(1,s.bite/.85)*Math.PI)*.85:0;
   const state=s.dead?{result:'won'}:{phase:s.bite>=0&&s.bite<.85?'bite':s.stagger>=0?'stunned':'pursuit',phaseTime:s.bite>=0?s.bite:Math.max(0,s.stagger),distance:0,time:game.time,health:RULES.health*clamp(e.hp/e.maxHp,.06,1)};
   rex.update(dt,state,game.time+s.offset,s.dead?0:s.speed,{jaw:Math.max(voice?.jaw||0,lungeJaw,posedRoar*.85),roar:Math.max(voice?.roar||0,posedRoar,biteRoar)});
   s.frame.position.set(s.x,s.y,s.z);s.frame.updateMatrixWorld(true);
   if(!s.dead)rex.gaze.update(dt,this.world.camera.position);
   for(const ev of rex.drainMotionEvents()){
    const at=ev.position.clone().add(s.frame.position);
    if(ev.type==='footstep')this.cues.push({type:'step',at,speed:ev.speed,water:id==='river',slot:s.index});
    if(ev.type==='body-impact')this.cues.push({type:'impact',at,strength:ev.strength,water:id==='river',slot:s.index});
   }
   if(id==='river'&&!s.dead)this.wade(s,dt);
   // The rules hide her through the approach of each cycle; dead, she stays seen.
   s.indo?.update(dt,!s.dead&&e.alpha<1,game.time);
  }
  if(s.lastX!==null)s.frame.visible=true;
 }
 /**
  * A9: her legs plough the river. Where each shin cuts the surface the water piles into a
  * collar and trails away behind (water.js), and a sheet of spray flies ahead and out of it
  * (spray.js), harder the faster the leg moves.
  */
 wade(s,dt){
  const w=this.world;if(!w.river||dt<=0)return;
  // She walks on her toes: the water line crosses the foot between the ankle and the middle toe.
  s.wade??=['L','R'].map(k=>({shin:s.rex.bones.find(b=>b.name.startsWith(`foot_02_01_${k}_`)),foot:s.rex.bones.find(b=>b.name.startsWith(`foot_02_03_${k}_`)),a:new T.Vector3(),b:new T.Vector3(),p:new T.Vector3(),last:null}));
  for(const leg of s.wade){if(!leg.shin||!leg.foot)continue;leg.shin.getWorldPosition(leg.a);leg.foot.getWorldPosition(leg.b);
   if(leg.b.y>LEVEL+.05){leg.last=null;continue;}
   const t=leg.a.y>LEVEL?(leg.a.y-LEVEL)/Math.max(1e-3,leg.a.y-leg.b.y):0;leg.p.lerpVectors(leg.a,leg.b,t);
   if(leg.last){const vx=(leg.p.x-leg.last.x)/dt,vz=(leg.p.z-leg.last.z)/dt,speed=Math.hypot(vx,vz);w.river.mover(leg.p.x,leg.p.z,.6,vx,vz,1);
    if(speed>1.5){const k=1/speed,out={x:vx*.45+vz*k*1.6*(leg===s.wade[0]?1:-1),z:vz*.45-vx*k*1.6*(leg===s.wade[0]?1:-1)};w.spray.sheet(leg.p,vx,vz,out,2.6+Math.min(5,speed*.32),Math.min(320,speed*26),dt,.15);}}
   (leg.last??=new T.Vector3()).copy(leg.p);}
 }
 /** Screen-space placement of her real body and head, plus a ray test against her rig. */
 project(e,aspect){
  const s=this.slotFor(e);if(!s)return null;
  const cam=this.world.camera,head=s.rex.headPosition(),body=s.rex.bones.find(b=>b.name.startsWith('back_02_')).getWorldPosition(this.b);
  const dh=Math.max(1,head.distanceTo(cam.position)),db=Math.max(1,body.distanceTo(cam.position)),span=Math.tan(cam.fov*Math.PI/360)*2;
  const h=Math.min(2.4,9/(db*span)),hr=1.15/(dh*span);
  const p=body.clone().project(cam),q=head.clone().project(cam);
  return{x:p.x*.5+.5,y:.5-p.y*.5,w:h/aspect*1.4,h,hx:q.x*.5+.5,hy:.5-q.y*.5,hr,visible:q.z<1&&Math.abs(q.x)<1.2&&Math.abs(q.y)<1.3,depth:dh,
   test:(x,y)=>this.test(s,x,y)};
 }
 test(s,x,y){
  if(s.dead)return null;const cam=this.world.camera;this.ray.setFromCamera(this.ndc.set(x*2-1,1-y*2),cam);
  const head=s.rex.headPosition(),hit=s.rex.aimHit(this.ray.ray,this.a);if(!hit)return null;
  const precise=this.ray.ray.distanceSqToPoint(head)<1.25*1.25&&head.distanceTo(cam.position)<=hit.distanceTo(cam.position)+1.6;
  this.lastHit={id:s.id,point:hit.clone(),direction:this.ray.ray.direction.clone(),slot:s};
  return precise?'head':'body';
 }
 /** Wounds land where the round met her hide (an exact skinned-mesh ray, only on a confirmed hit). */
 wound(e){
  const h=this.lastHit;if(!h||h.id!==e.id)return null;this.lastHit=null;
  const s=h.slot;s.rex.hit();s.indo?.hit();this.ray.ray.origin.copy(this.world.camera.position);this.ray.ray.direction.copy(h.point).sub(this.world.camera.position).normalize();this.ray.far=200;
  const exact=this.ray.intersectObject(s.rex.skin,false)[0];if(exact)s.rex.damage.add(exact,false);
  return{point:exact?.point||h.point,direction:h.direction,slot:s.index};
 }
 headOf(index){const s=this.slots[index];return s?.started?s.rex.headPosition():null;}
 diagnostics(){return this.slots.map(s=>({id:s.id,started:!!s.started,dead:!!s.dead,visible:s.frame.visible,root:s.frame.position.toArray(),head:s.started?s.rex.headPosition().toArray():null,spine:s.started?['back_02_','back_04_','tail_05_','leg_01_L_'].map(n=>s.rex.bones.find(b=>b.name.startsWith(n))?.getWorldPosition(new T.Vector3()).toArray().map(v=>+v.toFixed(2))):null,speed:s.speed,bite:s.bite,stagger:s.stagger}));}
}
