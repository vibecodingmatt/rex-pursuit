import * as T from 'three';
import {routeX,groundAt} from './world.js';

// A13: the conservatory boss as the Safari Velociraptor at hero scale, black with a gold
// stripe (critters' per-instance pattern), directed on the rules' boss cycle while the Jeep
// creeps down the glasshouse (cruise 14 m/s):
//  - age 0-1.3: she drops through the glass roof ahead and lands in a crouch;
//  - cycle 0-1.6 (hidden): she slinks across to the planters by one wall, low and fast;
//  - 1.6-4.5 (weak window): she stalks along that wall toward the Jeep, head low and swaying,
//    turning to watch the gunner;
//  - 4.5-6.4: she breaks from the wall, sprints in and leaps; the rules' bite at 6.4 lands
//    as she hits the hood. Then she springs back to the other wall.
// Nine head hits stagger her: she reels, shrieks and slinks off. Distances are from her
// snout to the gunner's eye, in the route frame.
const CYCLE=6.4,SCALE=5.4,SAFARI=3.8,WALL=6.6,CONTACT=3.2;
const clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp,up=new T.Vector3(0,1,0);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export class BossIndoraptor {
 constructor(world,actors){this.world=world;this.actors=actors;this.slot=null;this.cues=[];this.stage='';this.lastTime=0;this.ray=new T.Raycaster();this.ndc=new T.Vector2();this.lastHit=null;this.v=new T.Vector3();this.w=new T.Vector3();}
 get critters(){return this.actors.critters;}
 release(){const s=this.slot;if(s?.c){s.c.pattern=0;if(!s.dead)s.c.on=false;}this.slot=null;this.lastHit=null;}
 reset(){this.release();this.stage='';this.lastTime=0;this.cues=[];}
 handles(e){const s=this.slot;return !!(e?.boss&&e.kind==='indoraptor'&&s&&s.id===e.id&&s.c);}
 drain(){return this.cues.splice(0);}
 event(e){
  const s=this.slot;if(!s||!s.c||e.id!==s.id||s.dead)return;
  if(e.type==='attack'){this.cues.push({type:'bite',at:this.head(s)});this.world.vehicle?.hit(this.head(s),1.4);}
  if(e.type==='stagger'){s.stagger=0;this.cues.push({type:'pain',at:this.head(s)});}
 }
 head(s,out=new T.Vector3()){const c=s.c,sp=c.kind.spheres;return out.copy(sp?.[1]?.p||this.v.set(0,.45,.35)).multiplyScalar(SCALE).applyAxisAngle(up,c.yaw).add(c.p);}
 sync(game){
  const id=game?.stage.id||'';
  if(id!==this.stage){this.stage=id;this.release();}
  if(!game){this.lastTime=0;return;}
  if(game.time<this.lastTime)this.lastTime=game.time;
  const dt=clamp(game.time-this.lastTime,0,.05);this.lastTime=game.time;
  const e=game.entities.find(x=>x.boss&&x.kind==='indoraptor');
  if(e&&(!this.slot||this.slot.id!==e.id)&&!e.dead){this.release();this.slot={id:e.id,entity:e,c:null,started:false,dead:false};}
  const s=this.slot;if(!s)return;if(e&&e.id===s.id)s.entity=e;
  this.update(s,dt*(game.focusTime>0?.52:1),game,!e||e.id!==s.id);
 }
 start(s){
  const e=s.entity,cam=this.world.camera.position,c=this.critters.huntSpawn('raptor',1,30);if(!c)return false;
  Object.assign(c,{scale:SCALE,fade:1,on:true,state:'flee',look:0,tailYaw:0,crouch:0,peck:0,flinch:0,roll:0,curl:0,pattern:1});c.tint.setRGB(.15,.14,.13);
  Object.assign(s,{c,started:true,side:e.lane<.5?-1:1,ahead:22,lat:0,speed:0,phase:0,stagger:-1,yaw:Math.PI,seed:e.seed,lastPhase:0,flinch:0,shrieked:false,leapt:-1,round:0});
  s.x=routeX(cam.z+22,'manor');s.z=cam.z+22;s.lastX=s.x;const roof=new T.Vector3(s.x,groundAt(s.x,s.z,'manor')+9.4,s.z);this.world.glass?.burst(roof,{count:110,speed:4});this.cues.push({type:'crash',at:roof});
  return true;
 }
 update(s,dt,game,removed){
  const e=s.entity,id=game.stage.id,cam=this.world.camera.position;
  if(!s.started){if(e.age<0||!this.start(s))return;}
  const c=s.c;
  if((e.dead||removed)&&!s.dead){s.dead=true;const dir=this.v.set(s.x-cam.x,0,s.z-cam.z).normalize().setY(.15);this.critters.strike(c,dir.clone(),1.3,999);this.cues.push({type:'fall',at:this.head(s)});return;}
  if(s.dead||dt<=0)return;
  const age=Math.max(0,e.age),cycle=age%CYCLE,round=Math.floor(age/CYCLE),t=game.time+s.seed;
  if(round!==s.round){s.round=round;s.side*=-1;s.shrieked=false;}
  if(s.stagger>=0)s.stagger+=dt;if(s.stagger>1.6)s.stagger=-1;
  const reel=s.stagger>=0?Math.sin(Math.min(1,s.stagger/1.2)*Math.PI):0;
  // Where she wants to be: [metres ahead of the gunner (snout), metres to the side], and how low she goes.
  let ahead,lat,crouch=0,lift=0,peck=0;
  if(age<1.3){const u=smooth(age,0,1.1);ahead=22;lat=0;lift=(1-u)*(1-u)*9;crouch=smooth(age,.9,1.1)*(1-smooth(age,1.1,1.3))*.9;peck=.3;}
  else if(cycle<1.6){const u=smooth(cycle,0,1.6);ahead=lerp(round?12:22,19,u);lat=lerp(-s.side*WALL*.6,s.side*WALL,u);crouch=.55;peck=.35;}
  else if(cycle<4.5){const u=(cycle-1.6)/2.9;ahead=lerp(19,11,u);lat=s.side*(WALL-.3*Math.sin(t*1.7));crouch=.45+.15*Math.sin(t*2.1);peck=.4;}
  else{const u=(cycle-4.5)/1.9;ahead=lerp(11,CONTACT,u*u);lat=lerp(s.side*WALL,0,smooth(u,0,.6));crouch=u<.6?.3:0;
   // The leap: off the floor at 6.0, onto the hood as the rules' bite lands.
   lift=cycle>5.9?Math.sin(clamp((cycle-5.9)/.5,0,1)*Math.PI)*1.6:0;peck=lerp(.3,-.25,smooth(u,.6,1));
   if(!s.shrieked&&cycle>4.6){s.shrieked=true;this.cues.push({type:'shriek',at:this.head(s)});}}
  if(s.stagger>=0){ahead+=reel*5;lat=lerp(lat,s.side*WALL,reel);crouch=.2;peck=-.3*reel;}
  const camLat=cam.x-routeX(cam.z,id),wantZ=cam.z+ahead,wantX=routeX(wantZ,id)+lat,prevX=s.x,prevZ=s.z;
  // She closes on her mark quickly but not instantly, so the cuts between beats read as motion.
  const k=Math.min(1,dt*(cycle>4.5&&s.stagger<0?9:4.5));s.x+=(wantX-s.x)*k;s.z+=(wantZ-s.z)*k;s.z=Math.max(s.z,cam.z+CONTACT-.3);
  const vx=(s.x-prevX)/dt,vz=(s.z-prevZ)/dt+(game.speed||0),speed=Math.hypot(vx,vz);
  // Face where she runs; once close or stalking, the gunner.
  const face=Math.atan2(cam.x-s.x,cam.z-s.z),travel=speed>3?Math.atan2(vx,vz):face,stalk=age>=1.3&&cycle>=1.6&&cycle<4.5,target=stalk?wrap(face+s.side*.35):cycle>=4.5||age<1.3?face:travel;
  const turn=clamp(wrap(target-s.yaw),-5*dt,5*dt);s.yaw+=turn;const rate=turn/dt;
  const len=(1.5+.13*speed)*SCALE/SAFARI;s.phase=(s.phase+speed*dt/len)%1;
  if(speed>2&&Math.floor(s.phase*2)!==Math.floor(s.lastPhase*2))this.cues.push({type:'step',at:c.p.clone(),speed});s.lastPhase=s.phase;
  if(age>=1.3&&age-dt<1.3)this.cues.push({type:'land',at:c.p.clone()});
  s.flinch=Math.max(0,s.flinch-dt*3);
  Object.assign(c,{on:true,fade:1,scale:SCALE,yaw:s.yaw,phase:s.phase,stride:clamp(speed/9,0,1),poseTime:age,curl:0,pattern:1});
  c.p.set(s.x,groundAt(s.x,s.z,id)+lift,s.z);c.v.set(Math.sin(s.yaw)*speed,0,Math.cos(s.yaw)*speed);c.body.set(0,0,0);
  c.crouch=crouch+.5*reel;c.peck=peck-s.flinch*.5;c.roll=clamp(-rate*.04,-.3,.3);
  c.look=clamp(wrap(face-s.yaw),-.7,.7)+s.flinch*.3*(s.flinchSide||1);c.tailYaw=clamp(rate*.12,-.5,.5)+Math.sin(t*2.2)*.2;
 }
 wound(e){
  const h=this.lastHit;if(!h||h.id!==e.id)return null;this.lastHit=null;const s=this.slot;
  s.flinch=1;s.flinchSide=Math.sign(h.direction.x*Math.cos(s.c.yaw)-h.direction.z*Math.sin(s.c.yaw))||1;return{point:h.point,direction:h.direction};
 }
 /** Screen placement of her body and head, plus a ray test against her hit spheres. */
 project(e,aspect){
  if(!this.handles(e))return null;const s=this.slot,c=s.c,cam=this.world.camera;
  const head=this.head(s),body=this.w.copy(c.p).add(this.v.set(0,(c.kind.centre||.3)*SCALE,0));
  const dh=Math.max(1,head.distanceTo(cam.position)),db=Math.max(1,body.distanceTo(cam.position)),span=Math.tan(cam.fov*Math.PI/360)*2;
  const h=Math.min(2.4,6/(db*span)),hr=(c.kind.spheres?.[1]?.r||.08)*SCALE/(dh*span);
  const p=body.clone().project(cam),q=head.clone().project(cam);
  return{x:p.x*.5+.5,y:.5-p.y*.5,w:h/aspect*1.4,h,hx:q.x*.5+.5,hy:.5-q.y*.5,hr,visible:q.z<1&&Math.abs(q.x)<1.2&&Math.abs(q.y)<1.3,depth:dh,test:(x,y)=>this.test(s,x,y)};
 }
 test(s,x,y){
  if(s.dead)return null;const cam=this.world.camera;this.ray.setFromCamera(this.ndc.set(x*2-1,1-y*2),cam);
  const hit=this.critters.hit(this.ray.ray,200);if(!hit||hit.critter!==s.c)return null;
  const head=this.head(s),r=(s.c.kind.spheres?.[1]?.r||.08)*SCALE;
  this.lastHit={id:s.id,point:hit.point.clone(),direction:this.ray.ray.direction.clone()};
  return this.ray.ray.distanceSqToPoint(head)<r*r*1.4?'head':'body';
 }
 pusher(){const s=this.slot;return s?.c&&!s.dead?{x:s.x,z:s.z,r:2.5,s:1.2}:null;}
 diagnostics(){const s=this.slot;if(!s?.c)return s?{id:s.id,started:false}:null;return{id:s.id,dead:s.dead,root:s.c.p.toArray().map(v=>+v.toFixed(2)),yaw:+s.yaw.toFixed(2),head:this.head(s).toArray().map(v=>+v.toFixed(2))};}
}
