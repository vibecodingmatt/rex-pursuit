import * as T from 'three';
import {routeX,groundAt} from './world.js';

// A8: the gates boss as the Safari Triceratops at hero scale. She is one directed animal
// in the actors' Safari pool (same sculpt, hide, hits and physical death fall), driven
// here through the rules' boss cycle while the Jeep backs away (rules DRIVE):
//  - age 0-2.6: she breaks out of the verge, crosses to the road and bellows;
//  - cycle 0-1.6: she squares up (or, after a lock, backs off tossing her head);
//  - 1.6-4.0 (weak window opens): she stalks in, swaying, from 17 m to 12 m;
//  - 4.0-4.5: she gathers, paws the dirt and snorts; 4.5-6.4: the charge;
//  - the rules' attack lands at 6.4: her horns lock on the bumper and she shoves the
//    Jeep sideways (vehicle.shove) for 1.3 s; nine head hits in the window stagger her
//    and skip the charge. Distances are from her nose to the gunner's eye.
const CYCLE=6.4,SCALE=11.5,SAFARI=7.8,START_GAP=30,CONTACT=4.8,LOCK=1.3,SHOVE=2.3;
const clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp,up=new T.Vector3(0,1,0);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export class BossTrike {
 constructor(world,actors){this.world=world;this.actors=actors;this.slot=null;this.cues=[];this.stage='';this.lastTime=0;this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.lastHit=null;this.v=new T.Vector3();this.w=new T.Vector3();}
 get critters(){return this.actors.critters;}
 release(){const s=this.slot;if(s?.c&&!s.dead)s.c.on=false;this.slot=null;this.lastHit=null;}
 reset(){this.release();this.stage='';this.lastTime=0;this.cues=[];}
 handles(e){const s=this.slot;return !!(e?.boss&&e.kind==='trike'&&s&&s.id===e.id&&s.c);}
 drain(){return this.cues.splice(0);}
 /** Rules events carry the boss id: the charge lands (horn lock), or nine head hits broke it. */
 event(e){
  const s=this.slot;if(!s||!s.c||e.id!==s.id||s.dead)return;
  if(e.type==='attack'){s.lock=0;s.jolts=0;s.pushDir=s.x>this.world.camera.position.x?-1:1;if(s.rounds++%2)s.pushDir*=-1;this.cues.push({type:'lock',at:this.nose(s)});this.world.vehicle?.hit(this.nose(s),1.6);}
  if(e.type==='stagger'){s.stagger=0;s.lock=-1;this.cues.push({type:'pain',at:this.head(s)});}
 }
 /** Her front: the furthest hit sphere ahead of the hips, at hero scale. */
 get front(){const sp=this.slot?.c?.kind.spheres;return sp?Math.max(...sp.map(x=>x.p.z+x.r))*SCALE:4.2;}
 head(s,out=new T.Vector3()){const c=s.c,sp=c.kind.spheres;return out.copy(sp?.[1]?.p||this.v.set(0,c.kind.centre+.1,.3)).multiplyScalar(SCALE).applyAxisAngle(up,c.yaw).add(c.p);}
 nose(s){const c=s.c;return new T.Vector3(Math.sin(c.yaw),0,Math.cos(c.yaw)).multiplyScalar(this.front).add(c.p).setY(c.p.y+1.2);}
 sync(game){
  const id=game?.stage.id||'';
  if(id!==this.stage){this.stage=id;this.release();}
  if(!game){this.lastTime=0;return;}
  if(game.time<this.lastTime)this.lastTime=game.time;
  const dt=clamp(game.time-this.lastTime,0,.05);this.lastTime=game.time;
  const e=game.entities.find(x=>x.boss&&x.kind==='trike');
  if(e&&(!this.slot||this.slot.id!==e.id)&&!e.dead){this.release();this.slot={id:e.id,entity:e,c:null,started:false,dead:false};}
  const s=this.slot;if(!s)return;if(e&&e.id===s.id)s.entity=e;
  // Overdrive slows threats: she charges and shoves in slow motion too.
  this.update(s,dt*(game.focusTime>0?.52:1),game,!e||e.id!==s.id);
 }
 start(s,game){
  const e=s.entity,cam=this.world.camera.position,id=game.stage.id,c=this.critters.huntSpawn('triceratops',1,30);if(!c)return false;
  Object.assign(c,{scale:SCALE,fade:1,on:true,state:'flee',look:0,tailYaw:0,crouch:0,peck:0,flinch:0,roll:0,curl:0});
  Object.assign(s,{c,started:true,side:e.seed>Math.PI?1:-1,lateral:-(e.lane-.5)*6,speed:0,phase:0,lock:-1,stagger:-1,charging:false,rounds:0,pushDir:1,jolts:0,peck:0,bellowed:false,pawT:0,lastPhase:0,flinch:0,seed:e.seed});
  s.z=cam.z+this.front+START_GAP;s.x=routeX(s.z,id)+s.side*15;s.lastX=s.x;s.yaw=Math.atan2(-s.side,-.6);
  return true;
 }
 update(s,dt,game,removed){
  const e=s.entity,id=game.stage.id,cam=this.world.camera.position,front=this.front;
  if(!s.started){if(e.age<0||!this.start(s,game))return;}
  const c=s.c;
  if((e.dead||removed)&&!s.dead){
   s.dead=true;s.lock=-1;const dir=this.v.set(s.x-cam.x,0,s.z-cam.z).normalize().setY(.12);
   this.critters.strike(c,dir.clone(),1.25,999);this.cues.push({type:'fall',at:this.head(s)});return;
  }
  if(s.dead||dt<=0)return;
  const age=Math.max(0,e.age),cycle=age%CYCLE,first=age<CYCLE,back=Math.max(0,-game.speed),gap=s.z-front-cam.z,t=game.time+s.seed;
  if(s.lock>=0)s.lock+=dt;if(s.lock>LOCK){s.lock=-1;this.cues.push({type:'bellow',at:this.head(s),loud:false});}
  if(s.stagger>=0)s.stagger+=dt;if(s.stagger>1.6)s.stagger=-1;
  const charge=e.attack>0&&s.stagger<0&&s.lock<0,gather=s.lock<0&&s.stagger<0?smooth(cycle,3.9,4.2)*(1-smooth(cycle,4.5,4.7)):0;
  if(charge&&!s.charging){s.chargeFrom=Math.max(gap,CONTACT+4);this.cues.push({type:'bellow',at:this.head(s),loud:true});}s.charging=charge;
  if(!s.bellowed&&age>.5){s.bellowed=true;this.cues.push({type:'bellow',at:this.head(s),loud:true});}
  if(gather>.5&&(s.pawT-=dt)<=0){s.pawT=.24;this.cues.push({type:'paw',at:this.foot(s,1)});if(!s.snorted){s.snorted=true;this.cues.push({type:'snort',at:this.head(s)});}}
  if(cycle<3)s.snorted=false;
  // How far her nose wants to be from the gunner, and how hard she closes on it.
  let want=null,gain=1.5,top=9;
  if(s.lock>=0){want=CONTACT;gain=12;top=20;}
  else if(age<.9)want=null;
  else if(charge){want=lerp(s.chargeFrom,CONTACT,Math.pow(e.attack,1.5));gain=7;top=17;}
  else if(cycle<1.6)want=first?18:19;
  else want=lerp(17,12,clamp((cycle-1.6)/2.4,0,1));
  let desired=want===null?Math.min(back,2):clamp(back+(gap-want)*gain,-2.2,top);
  if(s.stagger>=0)desired=s.stagger<1?-3*(1-s.stagger):0;
  if(gather>0)desired=Math.min(desired,back);
  s.speed+=clamp(desired-s.speed,-30*dt,22*dt);s.z-=s.speed*dt;
  // Never through the vehicle; glued to the bumper while the horns are locked.
  s.z=s.lock>=0?cam.z+front+CONTACT:Math.max(s.z,cam.z+front+CONTACT);
  // Across the road from the verge, a slow sway while she stalks, then dead on the Jeep.
  const enter=smooth(age,.2,2.6),aim=charge?smooth(e.attack,0,.55):0,camLat=cam.x-routeX(cam.z,id);
  let lat=lerp(s.side*15,s.lateral,enter)+Math.sin(t*.5)*1.4*smooth(age,2.5,4)*(1-aim);lat=lerp(lat,camLat,aim);
  s.x=s.lock>=0?cam.x-s.pushDir*.35:routeX(s.z,id)+lat;
  const vx=(s.x-s.lastX)/dt;s.lastX=s.x;
  // Face where she goes while crossing, otherwise the gunner; twist into the shove.
  const face=Math.atan2(cam.x-s.x,cam.z-s.z),travel=Math.hypot(vx,s.speed)>2&&age<2.6?Math.atan2(vx,-Math.max(s.speed,1.5)):face;
  const shove=s.lock>=0?smooth(s.lock,.12,.5)*(1-smooth(s.lock,LOCK-.25,LOCK)):0,target=travel+s.pushDir*.24*shove;
  const turn=clamp(wrap(target-s.yaw),-3.2*dt,3.2*dt);s.yaw+=turn;const rate=turn/dt;
  // The shove: the Jeep is driven sideways in two heaves, each with a jolt.
  if(s.lock>=0){this.world.vehicle?.shove(s.pushDir*SHOVE*smooth(s.lock,.15,1.15)+s.pushDir*.18*Math.sin(s.lock*15)*shove);
   for(const [k,at]of [[1,.45],[2,.85]])if(s.jolts<k&&s.lock>=at){s.jolts=k;this.cues.push({type:'shove',at:this.nose(s)});this.world.vehicle?.hit(this.nose(s),.55);}}
  // Gait: the Safari stride (a + b x speed m per cycle) at hero scale; she walks backwards when backing off.
  const len=(2.6+.2*Math.abs(s.speed))*SCALE/SAFARI,step=s.lock>=0?back+3:s.speed;
  s.phase=(s.phase+step*dt/len+1)%1;
  if(Math.abs(step)>1.5&&Math.floor(s.phase*2)!==Math.floor(s.lastPhase*2))this.cues.push({type:'step',at:this.foot(s,Math.floor(s.phase*2)?1:-1),speed:Math.abs(step)});s.lastPhase=s.phase;
  const toss=!first&&cycle<1.6&&s.lock<0?Math.sin(cycle*7.5)*(1-cycle/1.6):0,reel=s.stagger>=0?Math.sin(Math.min(1,s.stagger/1.2)*Math.PI):0;
  s.flinch=Math.max(0,s.flinch-dt*3);
  Object.assign(c,{on:true,fade:1,scale:SCALE,yaw:s.yaw,phase:s.phase,stride:clamp(Math.abs(step)/4,0,1)*.95+gather*.3,poseTime:age,curl:0});
  c.p.set(s.x,groundAt(s.x,s.z,id),s.z);c.v.set(Math.sin(s.yaw)*s.speed,0,Math.cos(s.yaw)*s.speed);c.body.set(0,0,0);
  // Head: up to bellow, low behind the horns to charge and push, tossing after a lock, jerked up when hit.
  const bellow=age<2.2?smooth(age,.4,.8)*(1-smooth(age,1.6,2.2)):0;
  // The charge's head-down carries straight into the lock (the rules' attack resets at the wrap).
  const hold=s.lock>=0?1-smooth(s.lock,LOCK-.3,LOCK):0,low=Math.max(.55*gather,charge?.6*smooth(e.attack,0,.3):0,.6*hold);
  s.peck+=(-.45*bellow+low+.15*shove+.5*toss-.6*reel-s.peck)*Math.min(1,dt*9);c.peck=s.peck-s.flinch*.5;
  c.crouch=.7*gather+.45*shove+.5*reel;c.roll=clamp(-rate*.05,-.25,.25)+s.pushDir*.1*shove+(s.side*.12*reel);
  const lookTo=clamp(wrap(face-s.yaw),-.6,.6);c.look=lookTo*(1-shove)+.35*toss+s.flinch*.3*(s.flinchSide||1);c.tailYaw=clamp(rate*.15,-.4,.4)+Math.sin(t*1.3)*.15;
 }
 foot(s,side){const c=s.c,k=SCALE/SAFARI;return this.w.set(side*.9*k,0,1.4*k).applyAxisAngle(up,c.yaw).add(c.p).clone();}
 /** A round that hit her: she flinches away from it. */
 wound(e){
  const h=this.lastHit;if(!h||h.id!==e.id)return null;this.lastHit=null;const s=this.slot;
  s.flinch=1;s.flinchSide=Math.sign(h.direction.x*Math.cos(s.c.yaw)-h.direction.z*Math.sin(s.c.yaw))||1;
  return{point:h.point,direction:h.direction};
 }
 /** Screen placement of her body and head, plus a ray test against her hit spheres. */
 project(e,aspect){
  if(!this.handles(e))return null;const s=this.slot,c=s.c,cam=this.world.camera;
  const head=this.head(s),body=this.w.copy(c.p).add(this.v.set(0,c.kind.centre*SCALE,0));
  const dh=Math.max(1,head.distanceTo(cam.position)),db=Math.max(1,body.distanceTo(cam.position)),span=Math.tan(cam.fov*Math.PI/360)*2;
  const h=Math.min(2.4,9/(db*span)),hr=(c.kind.spheres?.[1]?.r||.25)*SCALE/(dh*span);
  const p=body.clone().project(cam),q=head.clone().project(cam);
  return{x:p.x*.5+.5,y:.5-p.y*.5,w:h/aspect*1.4,h,hx:q.x*.5+.5,hy:.5-q.y*.5,hr,visible:q.z<1&&Math.abs(q.x)<1.2&&Math.abs(q.y)<1.3,depth:dh,test:(x,y)=>this.test(s,x,y)};
 }
 test(s,x,y){
  if(s.dead)return null;const cam=this.world.camera;this.ray.setFromCamera(this.ndc.set(x*2-1,1-y*2),cam);
  const hit=this.critters.hit(this.ray.ray,200);if(!hit||hit.critter!==s.c)return null;
  const head=this.head(s),r=(s.c.kind.spheres?.[1]?.r||.25)*SCALE;
  this.lastHit={id:s.id,point:hit.point.clone(),direction:this.ray.ray.direction.clone()};
  return this.ray.ray.distanceSqToPoint(head)<r*r?'head':'body';
 }
 pusher(){const s=this.slot;return s?.c&&!s.dead?{x:s.x,z:s.z,r:4.5,s:1.3}:null;}
 diagnostics(){const s=this.slot;if(!s?.c)return s?{id:s.id,started:false}:null;const n=this.nose(s);return{id:s.id,dead:s.dead,root:s.c.p.toArray().map(v=>+v.toFixed(2)),yaw:+s.yaw.toFixed(2),speed:+s.speed.toFixed(2),gap:+(s.z-this.front-this.world.camera.position.z).toFixed(2),nose:n.toArray().map(v=>+v.toFixed(2)),lock:+s.lock.toFixed(2),stagger:+s.stagger.toFixed(2),front:+this.front.toFixed(2)};}
}
