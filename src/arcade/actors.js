import * as T from 'three';
import {createCritters} from '../chase/critters.js';
import {createFlyers} from '../chase/flyers.js';
import {createBrachio} from '../chase/brachio.js';
import {routeX,routeY,groundAt,routeHeading,noise} from './world.js';
import {project as bossProject} from './rules.js';

const species={raptor:'raptor',dilo:'dilophosaurus',galli:'gallimimus',trike:'triceratops'};
const sizes={raptor:4.5,dilo:5.8,galli:6.4,trike:8.8};
const v=new T.Vector3(),head=new T.Vector3(),p=new T.Vector3(),up=new T.Vector3(0,1,0);
const clamp=T.MathUtils.clamp;
function disposeProp(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>{if(!g.userData.shared)g.dispose();});materials.forEach(m=>{if(!m.userData.shared)m.dispose();});root.removeFromParent();}

export class CircuitActors {
 constructor(world){
  this.world=world;this.scene=world.scene;this.actors=new Map();this.lastTime=0;this.stage='';
  const jungle={chunks:[],groundAt:(x,z)=>groundAt(x,z,this.world.id)};
  this.critters=createCritters(this.scene,{jungle,capacities:{compy:1,lizard:1,galli:7,raptor:8,dilophosaurus:6,triceratops:5,parasaurolophus:1,pachycephalosaurus:1,stegosaurus:1}});
  this.flyers=createFlyers(this.scene,{jungle});this.critters.reset({empty:true});this.flyers.reset({empty:true});
  this.brachio=createBrachio(this.scene,{jungle});
  this.shadowTexture=this.makeShadow();this.shadows=[];
  const mat=new T.MeshBasicMaterial({map:this.shadowTexture,transparent:true,opacity:.52,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(let i=0;i<20;i++){const mesh=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),mat);mesh.visible=false;this.scene.add(mesh);this.shadows.push(mesh);}
 }
 async load(){await this.critters.ready();}
 makeShadow(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,'#000b');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
 reset(){for(const a of this.actors.values())if(a.mesh)disposeProp(a.mesh);this.actors.clear();this.critters.reset({empty:true});this.flyers.reset({empty:true});for(const s of this.shadows)s.visible=false;}
 makeProp(kind){
  const group=new T.Group(),material=new T.MeshStandardMaterial({color:kind==='supply'?0x5ac4a8:kind==='barrel'?0xc67230:kind==='spit'?0xaadc67:0x99917d,metalness:kind==='barrel'?.5:0,roughness:.8});
  if(kind==='ichthy'){
   material.color.set(0x3e8291);material.roughness=.33;const body=new T.Mesh(new T.SphereGeometry(1,20,12),material);body.scale.set(.5,.6,2.4);group.add(body);
   const snout=new T.Mesh(new T.ConeGeometry(.27,1.6,16),material);snout.rotation.x=Math.PI/2;snout.position.z=2.6;group.add(snout);
   for(const side of [-1,1]){const fin=new T.Mesh(new T.ConeGeometry(.6,2,3),material);fin.scale.z=.14;fin.rotation.z=-side*1.05;fin.position.set(side*.85,-.22,.4);group.add(fin);const tail=fin.clone();tail.position.set(0,side*.6,-2.1);tail.rotation.z=side<0?Math.PI:0;tail.rotation.y=Math.PI/2;group.add(tail);const eye=new T.Mesh(new T.SphereGeometry(.095,10,8),new T.MeshStandardMaterial({color:0x0b1111,roughness:.1}));eye.position.set(side*.38,.23,1.4);group.add(eye);}
  }else{
   const geo=kind==='rock'?this.world.geometry.thrown:kind==='spit'?new T.SphereGeometry(.38,12,8):kind==='barrel'?new T.CylinderGeometry(.65,.65,1.6,20):new T.BoxGeometry(1.5,1.1,1.1);// Thrown rocks are the scanned crag (shared with the canyon talus), about 2.7 m long.
   const mesh=new T.Mesh(geo,kind==='rock'?this.world.rocks.thrownMaterial:material);if(kind==='rock'){mesh.scale.setScalar(1.5);material.dispose();}group.add(mesh);
   if(kind==='supply'){const white=new T.MeshBasicMaterial({color:0xcbffe4});for(const [x,y]of [[.8,.18],[.18,.8]]){const cross=new T.Mesh(new T.BoxGeometry(x,y,.03),white);cross.position.z=-.57;group.add(cross);}}
   if(kind==='barrel'){const metal=new T.MeshStandardMaterial({color:0x343c36,metalness:.65,roughness:.5});for(const y of [-.55,.55]){const band=new T.Mesh(new T.TorusGeometry(.66,.06,6,24),metal);band.rotation.x=Math.PI/2;band.position.y=y;group.add(band);}}
  }
  group.traverse(o=>{if(o.isMesh)o.castShadow=true;});this.scene.add(group);return group;
 }
 sync(game){
  if(!game)return;if(this.stage!==game.stage.id){this.reset();this.stage=game.stage.id;}
  const dt=clamp(game.time-this.lastTime,0,.05);this.lastTime=game.time;
  const live=new Set(game.entities.filter(e=>!e.boss).map(e=>e.id));
  for(const [id,a]of this.actors)if(!live.has(id)){if(a.c)a.c.on=false;if(a.mesh)disposeProp(a.mesh);this.actors.delete(id);}
  let shadow=0;
  for(const e of game.entities){
   if(e.boss||e.age<0)continue;let a=this.actors.get(e.id);
   if(!a){const kind=species[e.kind],c=kind?this.critters.huntSpawn(kind,Math.sign(e.lane-.5),30):e.kind==='ptero'?this.flyers.huntSpawn('pteranodon',Math.sign(e.lane-.5)):null;a={e,c,mesh:c?null:this.makeProp(e.kind),position:new T.Vector3(),head:new T.Vector3(),yaw:0,dead:false};this.actors.set(e.id,a);if(c&&kind)c.scale=sizes[e.kind];}
   const age=Math.max(0,e.age),life=e.life,side=e.lane<.5?-1:1,id=game.stage.id,cruise=id==='manor'?14:id==='fault'?27:24;
   const animal=!!species[e.kind],windup=life-.9,charge=clamp((age-windup)/.9,0,1),parallel=40-age*2.5;
   const relative=animal?T.MathUtils.lerp(40-Math.min(age,windup)*2.5,3,charge):(cruise+6)*(life-age)+5;
   const z=e.spawnTravel+cruise*age+relative;
   // Pace the vehicle out of roadside cover, then turn into a short, committed
   // charge. Ground-relative stride uses the derivative of this actual path.
   const enter=T.MathUtils.smoothstep(age,0,windup),cross=e.kind==='galli';
   const width=(id==='manor'?7.5:animal?32:16)*Math.min(1,this.world.camera.aspect*1.25),span=cross?width*1.75:width-1.6;
   const off=side*(width-span*enter)+Math.sin(age*2+e.seed)*.28;
   const lateral=-side*span*6*clamp(age/windup,0,1)*(1-clamp(age/windup,0,1))/windup;
   const forward=animal?(age<windup?cruise-2.5:cruise-(40-windup*2.5-3)/.9):-6;
   const x=routeX(z,id)+off,y=groundAt(x,z,id);a.yaw=Math.atan2(lateral,forward)+routeHeading(z,id);
   if(animal){const from=Math.atan2(lateral,cruise-2.5),to=Math.atan2(-side*.1,Math.min(-3,cruise-(40-windup*2.5-3)/.9)),turn=T.MathUtils.smoothstep(age,windup-.3,windup+.2);a.yaw=from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*turn+routeHeading(z,id);}
   a.position.set(x,y,z);let lift=0;
   if(e.kind==='ptero')lift=5.5+Math.sin(age*2+e.seed)*1.6;
   if(e.kind==='ichthy')lift=-.65+Math.sin(clamp(age/life,0,1)*Math.PI)*3.5;
   if(e.kind==='rock')lift=1+Math.max(0,3-age)*2;
   if(e.kind==='spit')lift=2.4;
   if(id==='manor'&&e.kind==='raptor')lift=Math.max(0,1-age/.8)**2*11;
   if(e.kind==='barrel'||e.kind==='supply')lift=e.kind==='barrel'?.8:.55;
   a.position.y+=lift;
   if(e.dead){if(!a.dead){a.dead=true;a.deathPosition=a.position.clone();if(a.c&&species[e.kind]){a.c.hp=1;this.critters.strike(a.c,new T.Vector3(0,.1,1),1,999);}else if(a.c){a.c.on=false;}}if(a.mesh){a.mesh.position.copy(a.deathPosition);a.mesh.position.y-=e.fade*2;a.mesh.rotation.z+=dt*1.8;a.mesh.scale.setScalar(Math.max(0,1-e.fade));}continue;}
   if(a.c){const c=a.c;c.p.copy(a.position);c.fade=1;c.on=true;c.flinch=e.hit>0?.7:0;
    if(e.kind==='ptero'){c.q.setFromEuler(new T.Euler(-.08,a.yaw,Math.sin(age*2)*.2));c.phase=(age*1.4)%1;c.amp=.8;c.fold=.03;c.scale=2;}
    else{c.yaw=a.yaw;c.v.set(lateral,0,forward);const strideDt=Math.max(0,age-(a.lastAge??age-.016));a.lastAge=age;a.stridePhase=((a.stridePhase||0)+strideDt*Math.hypot(lateral,forward)/(c.kind.strideLength?c.kind.strideLength*c.scale:4.7))%1;c.phase=a.stridePhase;c.stride=.95;c.poseTime=age;c.body.set(0,0,0);c.roll=0;c.curl=0;if(e.kind==='dilo')c.frill=clamp((age/life-.23)*3.8,0,1);}
   }else{a.mesh.position.copy(a.position);a.mesh.rotation.set(e.kind==='ichthy'?Math.sin(age*2)*.3:e.kind==='rock'?age*.7:0,a.yaw,e.kind==='rock'?age:.0);}
   const s=this.shadows[shadow++];if(s){s.visible=true;s.position.set(x,y+.11,z);s.scale.set(e.kind==='trike'?5:3.6,1,e.kind==='trike'?7:5);}
  }
  this.critters.updateDirected(dt);this.flyers.updateDirected();for(let i=shadow;i<this.shadows.length;i++)this.shadows[i].visible=false;
  if(game.stage.id==='river'&&game.stageTime>5&&game.stageTime<28){const z=500;this.brachio.show(routeX(z,'river')-10,z,Math.PI/2);this.brachio.mesh.position.y=routeY(z,'river')-1.3;this.brachio.mesh.scale.setScalar(1.45);this.brachio.rearAt(Math.max(0,game.stageTime-19));this.brachio.mesh.visible=true;}else this.brachio.mesh.visible=false;
  for(const a of this.actors.values()){
   if(a.c?.rig){a.head.copy(a.c.rig.head);a.position.copy(a.c.rig.body);}
   else if(a.c&&species[a.e.kind]){const c=a.c,spheres=c.kind.spheres;head.copy(spheres?.[1]?.p||v.set(0,c.kind.centre+.1,.3)).multiplyScalar(c.scale).applyAxisAngle(up,c.yaw).add(c.p);a.head.copy(head);a.position.copy(c.p).add(v.set(0,c.kind.centre*c.scale,0));}
   else a.head.copy(a.position);
  }
 }
 project(e,aspect){
  if(e.boss)return bossProject(e,aspect);const a=this.actors.get(e.id);if(!a||e.age<0)return{visible:false};const cam=this.world.camera;const d=a.position.distanceTo(cam.position),size=e.kind==='trike'?5:e.kind==='raptor'?2.7:e.kind==='galli'?3.6:e.kind==='dilo'?3.4:e.kind==='ptero'?5:e.kind==='ichthy'?3:1.7;
  p.copy(a.position).project(cam);head.copy(a.head).project(cam);const h=size/(Math.max(1,d)*Math.tan(cam.fov*Math.PI/360)*2);
  return{x:p.x*.5+.5,y:.5-p.y*.5,h,w:h/aspect,hx:head.x*.5+.5,hy:.5-head.y*.5,visible:p.z<1&&p.z>-1&&Math.abs(p.x)<1.12&&Math.abs(p.y)<1.12,depth:d};
 }
 diagnostics(){return [...this.actors.values()].map(a=>({id:a.e.id,kind:a.e.kind,position:a.position.toArray(),head:a.head.toArray(),yaw:a.yaw,rigged:!!a.c?.rig,dead:a.e.dead}));}
}
