import * as T from 'three';
import {createCritters} from '../chase/critters.js';
import {createFlyers} from '../chase/flyers.js';
import {createBrachio} from '../chase/brachio.js';
import {routeX,routeY,groundAt,routeHeading,noise} from './world.js';
import {project as bossProject,TYPES} from './rules.js';
import {loadIchthy,createIchthy} from './ichthy.js';
import {makeProp as buildProp,tickProps} from './props.js';
import {BrachioCrossing} from './brachio-crossing.js';

const species={raptor:'raptor',dilo:'dilophosaurus',galli:'gallimimus',trike:'triceratops'};
const sizes={raptor:4.5,dilo:5.8,galli:6.4,trike:8.8};
const v=new T.Vector3(),head=new T.Vector3(),p=new T.Vector3(),up=new T.Vector3(0,1,0),dummy=new T.Object3D();
const clamp=T.MathUtils.clamp;
// How far the Jeep's hood sits below the gunner's eye.
const HOOD_DROP=1.6;
function disposeProp(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>{if(!g.userData.shared)g.dispose();});materials.forEach(m=>{if(!m.userData.shared)m.dispose();});root.traverse(o=>o.customDepthMaterial?.dispose());root.removeFromParent();}
// The ichthyosaur breaches twice: a long leap, a short dive, then a lunge at the vehicle.
// Returns height above the water reference and its rate of change.
function leap(age,life){for(const [a0,a1,H]of [[.03,.58,3],[.62,1.02,2.1]]){const t0=a0*life,t1=a1*life;if(age<t1){const u=clamp((age-t0)/(t1-t0),0,1);return[-1.1+(H+1.1)*Math.sin(Math.PI*u),age<t0?0:(H+1.1)*Math.PI*Math.cos(Math.PI*u)/(t1-t0)];}}return[-1.1,0];}

export class CircuitActors {
 constructor(world){
  this.world=world;this.scene=world.scene;this.actors=new Map();this.lastTime=0;this.stage='';
  const jungle={chunks:[],groundAt:(x,z)=>groundAt(x,z,this.world.id)};
  this.critters=createCritters(this.scene,{jungle,capacities:{compy:1,lizard:1,galli:26,raptor:10,dilophosaurus:6,triceratops:5,parasaurolophus:1,pachycephalosaurus:1,stegosaurus:1}});
  this.flyers=createFlyers(this.scene,{jungle});this.critters.reset({empty:true});this.flyers.reset({empty:true});
  this.brachio=createBrachio(this.scene,{jungle});this.crossing=new BrachioCrossing(this.brachio,world);
  this.basis=new T.Matrix4();this.roll=new T.Quaternion();this.shadowTexture=this.makeShadow();this.shadows=[];this.corpses=[];this.walls=new Map();
  // Soft contact shade under grounded animals; the sun's shadow map casts the real shadow.
  const mat=new T.MeshBasicMaterial({map:this.shadowTexture,transparent:true,opacity:.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(let i=0;i<20;i++){const mesh=new T.Mesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),mat);mesh.visible=false;this.scene.add(mesh);this.shadows.push(mesh);}
 }
 async load(){await this.critters.ready();this.ichthy=await loadIchthy().catch(e=>{console.warn('Ichthyosaur unavailable:',e.message);return null;});}
 // Ground animals push the planting aside as they run through it (world.js reads these).
 /** A graphics tier (graphics.js TIERS): shared animal models and the ichthyosaur's mesh. */
 setQuality(t){this.critters.setQuality(t);this.flyers.setQuality?.(t);this.brachio.setQuality?.(t);loadIchthy(t.detail?'ichthy.bin':'ichthy-low.bin').then(m=>{this.ichthy=m;}).catch(()=>{});}
 pushers(){const out=[];for(const a of this.actors.values()){const k=a.e.kind;if(a.dead||!a.c||k==='ptero')continue;out.push({x:a.position.x,z:a.position.z,r:k==='trike'?3.6:k==='galli'?1.8:2.3,s:1});}return out;}
 makeShadow(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,4,32,32,32);g.addColorStop(0,'#000b');g.addColorStop(1,'#0000');x.fillStyle=g;x.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
 reset(){for(const [id,w]of this.walls)this.dropWall(id,w);for(const a of this.actors.values())if(a.mesh)disposeProp(a.mesh);this.actors.clear();this.corpses=[];this.critters.reset({empty:true});this.flyers.reset({empty:true});for(const s of this.shadows)s.visible=false;}
 /** A power crate (explosive rounds) is the supply crate in hazard orange with a glowing band. */
 paintPower(mesh,e){if(!e.power||!mesh)return mesh;mesh.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.userData.shared=false;o.material.color?.set(0xff8a1e);if(o.material.emissive)o.material.emissive.set(0x5a2000);}});return mesh;}
 makeProp(kind,stage){
  if(kind==='rock'&&stage==='fault'&&this.world.fault){const m=this.world.fault.meteor();this.scene.add(m);return m;}
  if(kind==='ichthy'&&this.ichthy){const mesh=createIchthy(this.ichthy);mesh.scale.setScalar(1.15);this.scene.add(mesh);return mesh;}
  const built=buildProp(kind);if(built){this.scene.add(built);return built;}
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
  const dt=clamp(game.time-this.lastTime,0,.05);this.lastTime=game.time;tickProps(game.time);
  const live=new Set(game.entities.filter(e=>!e.boss).map(e=>e.id));
  // A fallen animal outlives its rules entity so the tumble and skid play out (a few at a time).
  for(const [id,a]of this.actors)if(!live.has(id)){if(a.c&&a.dead&&species[a.e.kind])this.corpses.push({c:a.c,t:0});else if(a.c)a.c.on=false;if(a.mesh)disposeProp(a.mesh);this.actors.delete(id);}
  const camZ=this.world.camera.position.z;for(const k of this.corpses){k.t+=dt;if(k.t>4||k.c.p.z<camZ-6||this.corpses.length>3&&k===this.corpses[0])k.c.on=false;}this.corpses=this.corpses.filter(k=>k.c.on);
  let shadow=0;
  for(const e of game.entities){
   if(e.boss||e.age<0){if(e.ambush&&!e.boss&&!e.dead)this.brushWall(e,game);continue;}let a=this.actors.get(e.id);
   if(!a){const kind=species[e.kind],c=kind?this.critters.huntSpawn(kind,Math.sign(e.lane-.5),30):e.kind==='ptero'?this.flyers.huntSpawn('pteranodon',Math.sign(e.lane-.5)):null;a={e,c,mesh:c?null:this.paintPower(this.makeProp(e.kind,game.stage.id),e),position:new T.Vector3(),head:new T.Vector3(),yaw:0,dead:false,burst:!!e.ambush};this.actors.set(e.id,a);if(c&&kind)c.scale=sizes[e.kind];}
   const age=Math.max(0,e.age),life=e.life,side=e.lane<.5?-1:1,id=game.stage.id,cruise=id==='manor'?14:id==='fault'?27:24;
   const animal=!!species[e.kind],windup=e.leaper?e.leapAt-.65:life-.9,charge=clamp((age-windup)/.9,0,1),parallel=40-age*2.5;
   // Crates and barrels stand still beside the track; everything else closes on the vehicle.
   const fixed=e.kind==='supply'||e.kind==='barrel',relative=animal?T.MathUtils.lerp((e.ambush?17:40)-Math.min(age,windup)*2.5,3,charge):fixed?cruise*(life-age)+5:(cruise+6)*(life-age)+5;
   const z=e.spawnTravel+cruise*age+relative;
   // Pace the vehicle out of roadside cover, then turn into a short, committed
   // charge. Ground-relative stride uses the derivative of this actual path.
   const enter=T.MathUtils.smoothstep(age,0,windup),cross=e.kind==='galli';
   const width=(e.ambush?8:id==='manor'?7.5:animal?32:16)*Math.min(1,this.world.camera.aspect*1.25),span=cross?width*1.75:width-1.6;
   const off=fixed?side*(2.4+e.seed%1*1.8):side*(width-span*enter)+Math.sin(age*2+e.seed)*.28;
   const lateral=-side*span*6*clamp(age/windup,0,1)*(1-clamp(age/windup,0,1))/windup;
   const forward=animal?(age<windup?cruise-2.5:cruise-(40-windup*2.5-3)/.9):-6;
   const x=routeX(z,id)+off,y=groundAt(x,z,id);a.yaw=Math.atan2(lateral,forward)+routeHeading(z,id);
   if(animal){const from=Math.atan2(lateral,cruise-2.5),to=Math.atan2(-side*.1,Math.min(-3,cruise-(40-windup*2.5-3)/.9)),turn=T.MathUtils.smoothstep(age,windup-.3,windup+.2);a.yaw=from+Math.atan2(Math.sin(to-from),Math.cos(to-from))*turn+routeHeading(z,id);}
   if(fixed)a.yaw=routeHeading(z,id)+e.seed*.3-.9;
   a.position.set(x,y,z);let lift=0;a.onHood=false;
   if(e.leaper&&age>=e.leapAt&&!e.dead)this.hood(a,e,age);
   // An ambusher bursts out of the planting: leaves, twigs and dust where it breaks cover.
   if(a.burst)this.breakWall(e.id);
   if(a.burst&&this.effects){a.burst=false;for(let i=0;i<34;i++)this.effects.speck(v.set(x,y+.6+Math.random()*1.4,z),p.set((Math.random()-.5)*5,1+Math.random()*3,(Math.random()-.5)*5),i%3?[.08,.2,.04]:[.16,.11,.05],.03+Math.random()*.04,.7+Math.random()*.5);this.effects.groundDust(v.set(x,y+.2,z),p.set(0,1,0),{size:.9,growth:3,opacity:.45,life:1.4});}
   // Pteranodons cruise high, then dive to eye level at the vehicle.
   if(e.kind==='ptero')lift=T.MathUtils.lerp(6.2+Math.sin(age*1.3+e.seed)*1.2,this.world.camera.position.y-groundAt(x,z,id)+.3,T.MathUtils.smoothstep(age,life-1.35,life-.35))-(a.flinch||0)**2*.6;
   if(e.kind==='ichthy')lift=a.mesh?.userData.swim?leap(age,life)[0]:-.65+Math.sin(clamp(age/life,0,1)*Math.PI)*3.5;
   if(e.kind==='rock')lift=1+Math.max(0,3-age)*2;
   if(e.kind==='spit')lift=2.4;
   if(id==='manor'&&e.kind==='raptor')lift=Math.max(0,1-age/.8)**2*11;
   if(e.kind==='barrel'||e.kind==='supply')lift=e.kind==='barrel'?.8:.55;
   a.position.y+=lift;
   // A13: in the conservatory they come through the glass roof.
   if(id==='manor'&&e.kind==='raptor'&&!a.crashed&&age<.3){a.crashed=true;this.world.glass?.burst(new T.Vector3(a.position.x,a.position.y-lift+9.4,a.position.z),{count:55});}
   if(e.dead){if(!a.dead){a.dead=true;a.deathPosition=a.position.clone();
    // A shot crate tumbles away from the gun; a barrel goes up with its blast.
    if(a.mesh&&fixed){const blast=e.kind==='barrel',r=Math.random;v.subVectors(a.position,this.world.camera.position).setY(0).normalize();a.tumble={v:new T.Vector3(v.x*(blast?5:3.5)+(r()-.5)*2,blast?9:4.5,v.z*(blast?5:3.5)),spin:new T.Vector3(r()-.5,r()-.5,r()-.5).normalize().multiplyScalar(blast?14:8),r:blast?.75:.55};}if(a.c&&species[e.kind]){Object.assign(a.c,{look:0,tailYaw:0,crouch:0,pant:0});a.c.hp=1;
     // The killing round carries the body on along the line of fire; a head shot hits harder.
     const push=new T.Vector3().subVectors(a.position,this.world.camera.position).setY(0).normalize().setY(.12);this.critters.strike(a.c,push,a.hitHead?1.5:1.15,999);}else if(a.c){a.c.on=false;}}if(a.tumble)this.tumble(a,e,dt,id);else if(a.mesh){a.mesh.position.copy(a.deathPosition);a.mesh.position.y-=e.fade*2;a.mesh.rotation.z+=dt*1.8;a.mesh.scale.setScalar(Math.max(0,1-e.fade));}continue;}
   if(a.c){const c=a.c;c.p.copy(a.position);c.fade=1;c.on=true;
    if(e.kind==='ptero')this.fly(a,c,e,age,life,dt);
    else{this.animate(a,c,e,age,life,windup,lateral,forward,dt);if(a.onHood)this.hoodPose(a,c,e,age);}
   }else if(a.mesh.userData.swim)this.swim(a,e,age,life,dt,y);
   else if(e.kind!=='ichthy')this.prop(a,e,age,dt,y);
   else{a.mesh.position.copy(a.position);a.mesh.rotation.set(e.kind==='ichthy'?Math.sin(age*2)*.3:e.kind==='rock'?age*.7:0,a.yaw,e.kind==='rock'?age:.0);}
   if(lift<1.5&&e.kind!=='ichthy'&&!a.onHood){const s=this.shadows[shadow++];if(s){s.visible=true;s.position.set(x,y+.11,z);s.rotation.y=a.yaw;s.scale.set(e.kind==='trike'?4.2:2.8,1,e.kind==='trike'?6.2:4.2);}}
  }
  this.tickWalls(dt,live);this.critters.updateDirected(dt,{cull:false});this.flyers.updateDirected();for(let i=shadow;i<this.shadows.length;i++)this.shadows[i].visible=false;
  // A9: the river's brachiosaur wades across the ford and the launch passes under her.
  this.crossing.update(game,dt);
  for(const a of this.actors.values()){
   if(a.c?.rig){a.head.copy(a.c.rig.head);a.position.copy(a.c.rig.body);}
   else if(a.c&&species[a.e.kind]){const c=a.c,spheres=c.kind.spheres;head.copy(spheres?.[1]?.p||v.set(0,c.kind.centre+.1,.3)).multiplyScalar(c.scale).applyAxisAngle(up,c.yaw).add(c.p);a.head.copy(head);a.position.copy(c.p).add(v.set(0,c.kind.centre*c.scale,0));}
   else a.head.copy(a.position);
  }
 }
 // A leaper pounces from its charge onto the hood, balances there snarling, then lunges
 // at the gunner at the end of its life unless it is shot off first.
 hood(a,e,age){
  const cam=this.world.camera,fwd=cam.getWorldDirection(v).setY(0).normalize();if(!a.leapFrom)a.leapFrom=a.position.clone();
  const u=clamp((age-e.leapAt)/.55,0,1),bite=clamp((age-(e.life-.3))/.3,0,1),k=u*u*(3-2*u);
  p.copy(cam.position).addScaledVector(fwd,4.9-bite*1.7);p.y=cam.position.y-HOOD_DROP;
  a.position.lerpVectors(a.leapFrom,p,k);a.position.y+=Math.sin(Math.PI*u)*2.4;
  a.yaw=Math.atan2(cam.position.x-a.position.x,cam.position.z-a.position.z);a.onHood=true;a.leapU=u;a.bite=bite;
 }
 hoodPose(a,c,e,age){
  const t=age-e.leapAt,u=a.leapU;c.v.set(0,0,0);c.stride=0;c.yaw=a.yaw;
  c.crouch=u<.25?.9-u*3.6:u<1?0:.75+.15*Math.sin(t*9)-.4*a.bite;c.roll=Math.sin(t*5.3)*.12;
  c.look=Math.sin(t*3.1)*.25*(1-a.bite);c.tailYaw=Math.sin(t*4.2)*.45;if(c.rig)c.pant=1-a.bite;else c.peck=a.bite*1.2-.4;
 }
 // An ambusher's cover: fern and shrub clumps between it and the road that shiver harder
 // through the 0.9 s before it breaks out, then fly apart toward the vehicle.
 brushWall(e,game){
  let w=this.walls.get(e.id);const id=game.stage.id,kit=this.world.kit;
  if(!w&&kit?.ferns){const side=e.lane<.5?-1:1,z=e.spawnTravel+17,x0=routeX(z,id)+side*8*Math.min(1,this.world.camera.aspect*1.25),group=new T.Group(),items=[];
   const ferns=new T.InstancedMesh(kit.ferns[0],kit.materials.fern,4),bush=new T.InstancedMesh(kit.bushes[0],kit.materials.shrub,2);
   for(const m of [ferns,bush]){m.castShadow=m.receiveShadow=true;m.frustumCulled=false;group.add(m);}
   for(let i=0;i<6;i++){const pos=new T.Vector3(x0-side*(.7+(i%2)*.8),0,z+(i-2.5)*.85);pos.y=groundAt(pos.x,pos.z,id)-.1;
    items.push({mesh:i<4?ferns:bush,slot:i<4?i:i-4,pos,rot:new T.Euler(0,Math.random()*6.28,0),scale:i<4?1.7+Math.random()*.6:.95+Math.random()*.3,vel:new T.Vector3(),spin:new T.Vector3(),phase:Math.random()*6.28});}
   this.scene.add(group);w={group,items,side,t:0,burst:false,rustle:0};this.walls.set(e.id,w);}
  if(w)w.rustle=clamp(1+e.age/.9,0,1);
 }
 breakWall(id){const w=this.walls.get(id);if(!w||w.burst)return;w.burst=true;const cam=this.world.camera.position,r=Math.random;for(const it of w.items){it.vel.set(-w.side*(3+r()*4),3+r()*3.5,(cam.z-it.pos.z)*.12+(r()-.5)*3);it.spin.set((r()-.5)*8,0,w.side*(2+r()*5));}}
 dropWall(id,w){w.group.removeFromParent();for(const m of w.group.children)m.dispose();this.walls.delete(id);}
 tickWalls(dt,live){
  for(const [id,w]of this.walls){
   if(!w.burst&&!live.has(id)){this.dropWall(id,w);continue;}
   if(w.burst&&(w.t+=dt)>1.8){this.dropWall(id,w);continue;}
   for(const it of w.items){
    if(w.burst){it.vel.y-=9.8*dt;it.pos.addScaledVector(it.vel,dt);it.rot.x+=it.spin.x*dt;it.rot.z+=it.spin.z*dt;}
    const shiver=w.burst?0:w.rustle**2*.24*Math.sin(this.lastTime*29+it.phase);
    dummy.position.copy(it.pos);dummy.rotation.set(it.rot.x+shiver,it.rot.y,it.rot.z+shiver*.7);dummy.scale.setScalar(it.scale*(w.burst?clamp(1-(w.t-.9)/.9,0,1):1));dummy.updateMatrix();it.mesh.setMatrixAt(it.slot,dummy.matrix);}
   for(const m of w.group.children)m.instanceMatrix.needsUpdate=true;
  }
 }
 // The directed path writes yaw and stride directly, bypassing Safari's steering, so this
 // gives back what steering gave (lean and tail swing from the turn rate) and adds the
 // authored beats: a 0.3 s gathered crouch that telegraphs the charge, a head that tracks
 // the vehicle, panting while pacing, flinches that follow the round, stumbles and a limp.
 animate(a,c,e,age,life,windup,lateral,forward,dt){
  const kind=e.kind,cam=this.world.camera.position,ease=k=>Math.min(1,dt*k),step=T.MathUtils.smoothstep;
  const turn=a.lastYaw===undefined||dt<=0?0:clamp(Math.atan2(Math.sin(a.yaw-a.lastYaw),Math.cos(a.yaw-a.lastYaw))/dt,-6,6);a.lastYaw=a.yaw;
  a.bank=(a.bank||0)+(clamp(-turn*.06,-.35,.35)-(a.bank||0))*ease(8);a.tail=(a.tail||0)+(clamp(turn*.16,-.45,.45)-(a.tail||0))*ease(5);
  const gather=kind==='galli'?0:step(age,windup-.45,windup-.15)*(1-step(age,windup,windup+.2)),charging=kind==='galli'?0:step(age,windup,windup+.25);
  a.flinch=Math.max(0,(a.flinch||0)-dt*4);a.heavy=Math.max(0,(a.heavy||0)-dt*1.8);
  const stumble=a.heavy>0?a.heavyAmp*Math.sin(Math.PI*(1-a.heavy)):0,limp=clamp((1-e.hp/(TYPES[kind]?.hp||1)-.25)*1.6,0,1);
  const len=c.kind.strideLength?c.kind.strideLength*c.scale:4.7,dAge=Math.max(0,age-(a.lastAge??age-.016));a.lastAge=age;
  a.stridePhase=((a.stridePhase||0)+dAge*Math.hypot(lateral,forward)/len*(1-.45*stumble))%1;
  // A limp shortens one stance and dips the body onto the bad leg once per stride.
  const wave=Math.sin(a.stridePhase*Math.PI*2),side=a.side||1;
  c.phase=(a.stridePhase+limp*.06*wave+1)%1;c.stride=.95*(1-.55*gather)*(1-.3*stumble);
  c.yaw=a.yaw;c.v.set(lateral,0,forward);c.poseTime=age;c.body.set(0,0,0);c.curl=0;
  c.roll=a.bank+limp*.07*wave+side*.14*stumble;c.crouch=gather+.8*stumble+limp*.35*Math.max(0,wave)**2;
  // Head toward the vehicle (model +X positive), lowered while gathering.
  const dx=cam.x-c.p.x,dz=cam.z-c.p.z,cy=Math.cos(a.yaw),sy=Math.sin(a.yaw),look=clamp(Math.atan2(dx*cy-dz*sy,dx*sy+dz*cy),-.65,.65)*(1-.6*gather);
  a.look=(a.look||0)+(look-(a.look||0))*ease(5);
  const snap=a.hitHead?a.flinch:0;c.look=a.look+snap*.45*side;c.tailYaw=a.tail;c.flinch=a.hitHead?a.flinch*.4:a.flinch;c.flinchSide=side;
  if(c.rig){c.pant=(1-step(age,windup-.7,windup-.35))*(1-.5*limp);c.recoil=a.hitHead?3.5:2.8;c.hitHead=!!a.hitHead;}
  else c.peck=(kind==='trike'?.5*Math.max(gather,.6*charging):kind==='dilo'?-.25*gather:0)-snap*.7;
  if(kind==='dilo')c.frill=clamp((age/life-.23)*3.8,0,1);
 }
 // Pteranodons fly on flyers.js's terms: they face their real velocity, bank into the
 // turn, glide between bursts of wingbeats, tuck into a dive at the vehicle and flare
 // at the last moment. A hit kicks them into a sideways lurch.
 fly(a,c,e,age,life,dt){
  const ease=k=>Math.min(1,dt*k),step=T.MathUtils.smoothstep,pos=a.position;
  if(a.lastPos&&dt>0)p.subVectors(pos,a.lastPos).divideScalar(dt);else p.set(Math.sin(a.yaw),0,Math.cos(a.yaw)).multiplyScalar(6);
  (a.lastPos||(a.lastPos=new T.Vector3())).copy(pos);
  const heading=Math.atan2(p.x,p.z),rate=a.lastHeading===undefined||dt<=0?0:Math.atan2(Math.sin(heading-a.lastHeading),Math.cos(heading-a.lastHeading))/dt;a.lastHeading=heading;
  a.flinch=Math.max(0,(a.flinch||0)-dt*2.5);
  a.bank=(a.bank||0)+(clamp(-Math.atan2(Math.hypot(p.x,p.z)*rate,9.8),-.9,.9)-(a.bank||0))*ease(4);
  const dive=step(age,life-1.35,life-.5),flare=step(age,life-.45,life-.2),beating=flare>0||a.flinch>.3||dive<.05&&Math.sin(age*1.15+e.seed*3)>.15;
  c.amp+=((beating?.8:.06)*(1-dive*(1-flare))-c.amp)*ease(4);c.phase=(c.phase+dt*(beating?1.7:.25))%1;c.fold=.55*dive*(1-flare);c.scale=2;
  // Face the velocity (diving pitches the nose down), then roll about it.
  v.copy(p).normalize();if(v.lengthSq()<.5)v.set(Math.sin(a.yaw),0,Math.cos(a.yaw));head.crossVectors(up,v).normalize();
  c.q.setFromRotationMatrix(this.basis.makeBasis(head,p.crossVectors(v,head),v));
  c.q.premultiply(this.roll.setFromAxisAngle(v,a.bank+Math.sin(age*.9+e.seed)*.08+(a.side||1)*.7*Math.sin(Math.min(1,a.flinch)*Math.PI)));
 }
 // Swim and leap: the spine wave slows in the air and thrashes when hit; the body pitches
 // along its arc and twists in flight; crossing the surface throws spray (main.js).
 swim(a,e,age,life,dt,water){
  const [h,rise]=leap(age,life),air=clamp((h+.2)/.6,0,1),TAU=Math.PI*2;a.flinch=Math.max(0,(a.flinch||0)-dt*2.5);
  const rate=7-3.5*air+a.flinch*9;a.swimPhase=((a.swimPhase||0)+dt*rate)%TAU;a.stroke=((a.stroke||0)+dt*rate*.5)%TAU;
  a.mesh.userData.swim(a.swimPhase,.13-.06*air+.16*a.flinch,a.stroke);a.mesh.position.copy(a.position);
  a.mesh.rotation.set(-Math.atan2(rise,6),a.yaw+(a.side||1)*.4*a.flinch,.22*Math.sin(age*1.7+e.seed)*air);
  if(a.lastLift!==undefined&&(a.lastLift<0)!==(h<0))this.onSplash?.(v.set(a.position.x,water,a.position.z),Math.min(1.3,.5+Math.abs(rise)*.12));a.lastLift=h;
  // A9: swimming just under the surface, it pushes a wake through the river (water.js).
  if(dt>0&&a.wakeAt){const vx=(a.position.x-a.wakeAt.x)/dt,vz=(a.position.z-a.wakeAt.z)/dt;if(h>-.9&&h<.2)this.world.river?.mover(a.position.x,a.position.z,.55,vx,vz,.9);}(a.wakeAt??=new T.Vector3()).copy(a.position);
 }
 prop(a,e,age,dt,ground){
  const m=a.mesh,k=e.kind;a.flinch=Math.max(0,(a.flinch||0)-dt*3);m.position.copy(a.position);
  if(k==='rock'){m.rotation.set(age*.7,a.yaw,age);
   // Dust streams off a thrown rock and billows where it skips along the ground.
   // A10: on the fault it is a flaming bomb that trails embers and dark smoke instead.
   if(m.userData.meteor){if(this.effects&&(a.dustT=(a.dustT||0)-dt)<=0){a.dustT=.04;this.effects.haze(v.copy(a.position),p.set(0,.8,0),{life:1.6,size:1.3,growth:3,opacity:.5,color:0x241d1a,drag:1.2,rise:.5});this.effects.speck(v.copy(a.position),p.set(Math.random()-.5,1+Math.random()*1.5,Math.random()-.5),0xff8a30,.08,.9);}}
   else if(this.effects&&(a.dustT=(a.dustT||0)-dt)<=0){a.dustT=.06;const low=a.position.y-ground<1.6;this.effects.groundDust(v.copy(a.position),p.set(0,low?1.2:.3,0),{size:low?1.1:.55,opacity:low?.42:.22,life:low?1.6:.9});}
  }else if(k==='spit'){
   // A wobbling, stretching blob leads its droplets.
   const w=Math.sin(age*15+e.seed);m.rotation.set(0,a.yaw,age*2);m.children[0].scale.set(.38*(1-.12*w),.38*(1+.1*w),.38*(1.4+.25*w));
   m.children.forEach((d,i)=>{if(i)d.position.x=Math.sin(age*9+i*1.7)*.05*i;});
  }else{
   // A hit rocks it on its base, away from the shot.
   const rock=Math.sin(Math.min(1,a.flinch)*Math.PI)*(a.side||1)*.22;m.rotation.set(0,a.yaw,rock);m.position.y+=Math.abs(rock)*.4;
  }
 }
 tumble(a,e,dt,id){
  const t=a.tumble,m=a.mesh,at=a.deathPosition;t.v.y-=9.8*dt;at.addScaledVector(t.v,dt);const g=groundAt(at.x,at.z,id)+t.r;
  if(at.y<g){at.y=g;if(t.v.y<-1.5){t.v.y*=-.35;t.v.x*=.6;t.v.z*=.6;t.spin.multiplyScalar(.55);}else{t.v.set(t.v.x*.9,0,t.v.z*.9);t.spin.multiplyScalar(.9);}}
  const w=t.spin.length();if(w>1e-3)m.quaternion.premultiply(this.roll.setFromAxisAngle(v.copy(t.spin).divideScalar(w),w*dt));
  m.position.copy(at);m.scale.setScalar(Math.max(0,1-Math.max(0,e.fade-.85)/.25));
 }
 /** A round that hit actor `id` at screen x: twist about where it landed. */
 hit(id,precise,x){
  const a=this.actors.get(id);if(!a||a.dead)return;const cam=this.world.camera,pr=this.project(a.e,cam.aspect);
  // Torque about up from a push along the view, applied off the body's centre line.
  v.setFromMatrixColumn(cam.matrixWorld,0);p.setFromMatrixColumn(cam.matrixWorld,2).negate();const off=pr.visible===false?0:x-pr.x;
  a.side=Math.sign((v.z*p.x-v.x*p.z)*off||Math.sin(a.yaw)*p.z-Math.cos(a.yaw)*p.x)||1;
  if(!a.c||a.e.kind==='ptero'){a.flinch=1;return;}
  const amp=precise?1:a.e.kind==='trike'?.6:.4;a.heavyAmp=a.heavy>0?Math.max(a.heavyAmp,amp):amp;a.heavy=1;a.flinch=1;a.hitHead=precise;
 }
 project(e,aspect){
  if(e.boss)return bossProject(e,aspect);const a=this.actors.get(e.id);if(!a||e.age<0)return{visible:false};const cam=this.world.camera;const d=a.position.distanceTo(cam.position),size=e.kind==='trike'?5:e.kind==='raptor'?2.7:e.kind==='galli'?3.6:e.kind==='dilo'?3.4:e.kind==='ptero'?5:e.kind==='ichthy'?3:1.7;
  p.copy(a.position).project(cam);head.copy(a.head).project(cam);const h=size/(Math.max(1,d)*Math.tan(cam.fov*Math.PI/360)*2);
  return{x:p.x*.5+.5,y:.5-p.y*.5,h,w:h/aspect,hx:head.x*.5+.5,hy:.5-head.y*.5,visible:p.z<1&&p.z>-1&&Math.abs(p.x)<1.12&&Math.abs(p.y)<1.12,depth:d};
 }
 diagnostics(){return [...this.actors.values()].map(a=>({id:a.e.id,kind:a.e.kind,position:a.position.toArray(),head:a.head.toArray(),yaw:a.yaw,rigged:!!a.c?.rig,dead:a.e.dead}));}
}
