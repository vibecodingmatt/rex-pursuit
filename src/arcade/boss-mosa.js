import * as T from 'three';
import {loadMosa,createMosa} from './mosa.js';
import {LEVEL} from './water.js';
import {routeX,routeHeading} from './world.js';

// A12, the lagoon boss: the Mosasaurus, directed on the rules' 6.4 s boss cycle. Each round she
// dives and comes back from ahead under the surface (her back and a wake), breaches beside the
// launch with her jaws open, twists and slams down on her side (a wall of spray, the boat
// rocks), resurfaces head-up ahead of the bow, and lunges into the bite as the rules land it.
// Rounds alternate sides. Nine head hits (the rules' stagger) knock her back under. Positions are
// in the camera's route frame (metres ahead, metres to the side), so Overdrive and seeking stay
// in step. Bullets that meet her below the waterline hit water.
const SCALE=3.2,CYCLE=6.4,clamp=T.MathUtils.clamp,smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp;
// Keys: [cycle time, ahead, side (times the round's side), height of her centre above the water,
//  pitch (negative lifts the snout), roll (times side), jaw, arch, swim amplitude].
const KEYS=[
 [0,9.6,4,-2.4,.5,0,0,0,.08],[.5,10,10,-7,.3,0,0,0,.12],[.55,70,16,-7,0,0,0,0,.12],[1,42,12,-1.5,0,0,0,0,.14],[1.5,24,10,-1.3,-.2,0,.1,0,.12],
 [2.3,19,9,2.6,-1.15,0,.75,.25,.05],[2.6,18,8.5,2.2,-1,.6,.6,.2,.05],[3.2,16,7,-1.5,-.05,1.45,.2,-.1,.1],[3.6,15,6,-7,.3,.8,0,0,.1],
 [3.65,15,3.5,-8.5,-1,0,0,0,.08],[4.3,15,3.5,-.9,-.95,0,.5,.1,.06],[4.5,15,3.5,-.8,-.95,0,.3,.1,.06],[5.6,13,2.2,-.4,-.7,0,.7,.05,.07],[6.3,10,.8,0,-.45,0,.85,0,.08],[6.4,9.6,.6,0,-.4,0,.05,0,.08]];
// Teleports happen while she is deep: between these key pairs the place snaps rather than slides.
const SNAP=new Set([.55,3.65]);
function key(c,out){
 let i=0;while(i<KEYS.length-2&&c>=KEYS[i+1][0])i++;const a=KEYS[i],b=KEYS[i+1],u=SNAP.has(b[0])?0:smooth(c,a[0],b[0]);
 for(let k=1;k<a.length;k++)out[k]=lerp(a[k],b[k],u);return out;
}
// Hit spheres along her body in model space: [z, y, radius]; the last is the head.
const BODY=[[-3,0,.12],[-2.4,0,.18],[-1.8,0,.26],[-1.2,0,.34],[-.6,0,.42],[0,0,.48],[.6,0,.43],[1.1,0,.34],[1.55,-.02,.3],[2,-.04,.2]],HEAD=[0,-.02,1.65,.36];

export class BossMosa {
 constructor(world){this.world=world;this.mesh=null;this.slot=null;this.cues=[];this.ready=false;this.p=[];this.ray=new T.Ray();this.inv=new T.Matrix4();this.v=new T.Vector3();this.w=new T.Vector3();this.lastHit=null;this.stage='';this.lastTime=0;this.sphere=new T.Sphere();}
 async load(low=false){
  const model=await loadMosa(low?'mosa-low.bin':'mosa.bin');this.mesh=createMosa(model);this.mesh.scale.setScalar(SCALE);this.mesh.visible=false;this.world.scene.add(this.mesh);this.world.rimCreatures?.(this.mesh);
  // Compile now, on the hidden canvas, so her arrival doesn't stall.
  const cam=this.world.camera;this.mesh.position.copy(cam.position).add(this.v.set(0,0,30).applyQuaternion(cam.quaternion));this.mesh.visible=true;try{this.world.render();}catch{/* compiles later */}this.mesh.visible=false;
  this.ready=true;
 }
 reset(){this.slot=null;this.cues=[];this.stage='';this.lastTime=0;this.lastHit=null;if(this.mesh)this.mesh.visible=false;}
 handles(e){return !!(e?.boss&&e.kind==='mosa'&&this.slot?.id===e.id&&this.ready);}
 drain(){return this.cues.splice(0);}
 event(e){
  const s=this.slot;if(!s||e.id!==s.id||s.dead)return;
  if(e.type==='attack'){this.cues.push({type:'bite',at:this.head()});this.world.vehicle?.hit(this.head(),1.5);}
  if(e.type==='stagger'){s.stagger=0;this.cues.push({type:'pain',at:this.head()});}
 }
 head(out=new T.Vector3()){return out.set(HEAD[0],HEAD[1],HEAD[2]).applyMatrix4(this.mesh.matrixWorld);}
 /** Route-frame place: metres ahead of the camera and to the side, height above the water. */
 place(ahead,side,height,out){const z=this.world.camera.position.z+ahead,h=routeHeading(z,'lagoon');return out.set(routeX(z,'lagoon')+side*Math.cos(h),LEVEL+height,z);}
 sync(game){
  if(!this.ready)return;const id=game?.stage.id||'';
  if(id!==this.stage){this.stage=id;this.slot=null;this.mesh.visible=false;}
  if(!game||id!=='lagoon'){this.lastTime=game?.time??0;return;}
  if(game.time<this.lastTime)this.lastTime=game.time;const dt=clamp(game.time-this.lastTime,0,.05)*(game.focusTime>0?.52:1);this.lastTime=game.time;
  const e=game.entities.find(x=>x.boss&&x.kind==='mosa');
  if(e&&(!this.slot||this.slot.id!==e.id))this.slot={id:e.id,entity:e,dead:false,fall:0,stagger:-1,swim:0,stroke:0,last:null,was:0,round:-1,pose:[]};
  const s=this.slot;if(!s){this.mesh.visible=false;return;}
  if(e)s.entity=e;if((!e||e.dead)&&!s.dead){s.dead=true;s.fall=0;this.cues.push({type:'fall',at:this.head()});}
  this.update(s,dt,game);
 }
 update(s,dt,game){
  const e=s.entity,age=Math.max(0,e.age),c=s.dead?s.frozen??(s.frozen=age%CYCLE):age%CYCLE,round=Math.floor(age/CYCLE),side=(e.lane<.5?1:-1)*(round%2?-1:1),P=key(c,s.pose);
  let [,ahead,lat,height,pitch,roll,jaw,arch,amp]=P;lat*=side;roll*=side;
  // The first round starts from far ahead, under the surface.
  if(round===0&&c<1){const u=smooth(c,0,1);ahead=lerp(80,ahead,u);lat=lerp(side*16,lat,u);height=lerp(-1.6,height,Math.max(u,.7));pitch=0;jaw=0;}
  // Stagger: nine head hits knock her back under for a moment.
  if(s.stagger>=0){s.stagger+=dt;const k=Math.sin(Math.min(1,s.stagger/1.2)*Math.PI);height-=k*5;pitch+=k*.8;jaw*=1-k;if(s.stagger>1.2)s.stagger=-1;}
  // Dead: she rolls belly-up, thrashes once and sinks.
  if(s.dead){s.fall+=dt;const f=s.fall;roll=lerp(roll,side*Math.PI,smooth(f,0,1.4));height=lerp(height,-1.2,smooth(f,0,.8))-Math.max(0,f-2)*1.6;pitch=lerp(pitch,.1,smooth(f,0,1));jaw=.5+.3*Math.sin(f*7)*Math.max(0,1-f/2);amp=.18*Math.max(0,1-f/3);if(f>6)this.mesh.visible=false;}
  const pos=this.place(ahead,lat,height,this.v),cam=this.world.camera.position;
  // Facing: toward the boat once she is close; along the route while she comes in from ahead.
  const toward=Math.atan2(cam.x-pos.x,cam.z-pos.z),yaw=lerp(Math.PI+routeHeading(pos.z,'lagoon'),toward,smooth(ahead,40,20));
  const m=this.mesh;m.visible=!(s.dead&&s.fall>6);m.position.copy(pos);m.rotation.set(pitch,yaw,roll);m.updateMatrixWorld(true);
  s.swim+=dt*(5+amp*30);s.stroke+=dt*2.2;m.userData.pose(s.swim%(Math.PI*200),amp,s.stroke%(Math.PI*200),jaw,arch);
  if(dt>0&&!s.dead||s.dead&&s.fall<2.5)this.water(s,c,dt,height,s.was);s.was=c;
 }
 /** Where she meets the water: her wake, the breach, water off her in the air, the slam, the resurfacing. */
 water(s,c,dt,height,was){
  const w=this.world,m=this.mesh,crossed=t=>was<t&&c>=t,head=this.head(this.w);
  if(height>-2.4&&height<.6&&dt>0){const back=this.v.set(0,.4,-.6).applyMatrix4(m.matrixWorld);if(s.last)w.river?.mover(back.x,back.z,2.2,(back.x-s.last.x)/dt,(back.z-s.last.z)/dt,1);(s.last??=new T.Vector3()).copy(back);}else s.last=null;
  const burst=(p,k,ring=1.4)=>{w.spray?.burst(p.clone().setY(LEVEL),k);w.river?.ring(p.x,p.z,ring);};
  if(crossed(1.55)){const at=this.v.set(0,0,.8).applyMatrix4(m.matrixWorld);burst(at,1.6,2.4);burst(head,1.2);this.cues.push({type:'breach',at:at.clone()});}
  if(c>1.6&&c<3.1&&w.spray){for(let i=0;i<Math.ceil(dt*45);i++){const p=this.v.set((Math.random()-.5)*.6,-.3,-2.5+Math.random()*4.5).applyMatrix4(m.matrixWorld);if(p.y>LEVEL+.3)w.spray.drop(p.x,p.y,p.z,(Math.random()-.5)*.8,-.5-Math.random(),(Math.random()-.5)*.8,.02+Math.random()*.03,2.4,.2,.65);}}
  if(crossed(3.15)){for(const z of [-2.6,-1.2,.2,1.6]){const p=this.v.set(0,0,z).applyMatrix4(m.matrixWorld);burst(p,1.8,2.6);}const at=this.v.set(0,0,0).applyMatrix4(m.matrixWorld).clone();this.cues.push({type:'slam',at});w.vehicle?.hit(at,1.3);}
  if(crossed(4.05)||crossed(.25)){burst(head,1,1.6);this.cues.push({type:'surface',at:head.clone()});}
 }
 /** Rules hits: a ray against her body spheres in model space; anything under the water is water. */
 test(s,x,y){
  if(s.dead||!this.mesh.visible)return null;const cam=this.world.camera,ndc=new T.Vector2(x*2-1,1-y*2);
  const rc=new T.Raycaster();rc.setFromCamera(ndc,cam);this.inv.copy(this.mesh.matrixWorld).invert();this.ray.copy(rc.ray).applyMatrix4(this.inv);
  let best=Infinity,part=null;const hit=this.w;
  for(const [z,yy,r]of BODY){this.sphere.center.set(0,yy,z);this.sphere.radius=r;if(this.ray.intersectSphere(this.sphere,hit)){const d=hit.distanceToSquared(this.ray.origin);if(d<best){best=d;part='body';this.p[0]=hit.clone();}}}
  this.sphere.center.set(HEAD[0],HEAD[1],HEAD[2]);this.sphere.radius=HEAD[3];if(this.ray.intersectSphere(this.sphere,hit)){const d=hit.distanceToSquared(this.ray.origin);if(d<=best+.5){best=d;part='head';this.p[0]=hit.clone();}}
  if(!part)return null;const point=this.p[0].applyMatrix4(this.mesh.matrixWorld);if(point.y<LEVEL-.1)return null;
  this.lastHit={id:s.id,point,direction:rc.ray.direction.clone()};return part;
 }
 wound(e){const h=this.lastHit;if(!h||h.id!==e.id)return null;this.lastHit=null;return{point:h.point,direction:h.direction};}
 /** Screen placement of her body and head for the rules and the weak-point mark. */
 project(e,aspect){
  if(!this.handles(e))return null;const s=this.slot,cam=this.world.camera,head=this.head(new T.Vector3()),body=new T.Vector3(0,0,0).applyMatrix4(this.mesh.matrixWorld);
  const dh=Math.max(1,head.distanceTo(cam.position)),db=Math.max(1,body.distanceTo(cam.position)),span=Math.tan(cam.fov*Math.PI/360)*2;
  const h=Math.min(2.4,14/(db*span)),hr=HEAD[3]*SCALE/(dh*span),p=body.clone().project(cam),q=head.clone().project(cam);
  return{x:p.x*.5+.5,y:.5-p.y*.5,w:h/aspect*1.4,h,hx:q.x*.5+.5,hy:.5-q.y*.5,hr,visible:this.mesh.visible&&head.y>LEVEL+.2&&q.z<1&&Math.abs(q.x)<1.2&&Math.abs(q.y)<1.3,depth:dh,test:(x,y)=>this.test(s,x,y)};
 }
 diagnostics(){const s=this.slot;return s?{id:s.id,dead:s.dead,visible:this.mesh.visible,pos:this.mesh.position.toArray().map(v=>+v.toFixed(1)),head:this.head().toArray().map(v=>+v.toFixed(1))}:null;}
}
