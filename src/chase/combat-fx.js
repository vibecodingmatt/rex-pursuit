import * as T from 'three';
import {createBreakup} from './breakup.js';

// Shared combat pools: wet, lit geometry for liquid and torn tissue, with ground
// contact and persistent splatter. No per-hit meshes or unbounded decal lists.
export function createCombatFX(scene,effects,{surface=(x,z)=>Math.abs(x)<1.02&&z>1.75&&z<3.26?1.075:0,deck=true}={}){
 const breakup=createBreakup(scene,{surface,deck});
 let seed=703,nextDrop=0,nextChunk=0,nextStain=0,budget=1;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const dummy=new T.Object3D(),up=new T.Vector3(0,1,0),axis=new T.Vector3(),turn=new T.Quaternion(),color=new T.Color();
 const stats={hits:0,kills:0,blasts:0,drops:0,chunks:0,stains:0,rockets:0};
 function pool(count,geometry,material){
  const mesh=new T.InstancedMesh(geometry,material,count);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.count=0;scene.add(mesh);
  const entries=Array.from({length:count},()=>({life:0,max:1,p:new T.Vector3(),v:new T.Vector3(),q:new T.Quaternion(),s:new T.Vector3(),spin:new T.Vector3(),landed:false}));
  return {mesh,entries};
 }
 const drops=pool(480,new T.SphereGeometry(1,5,4),new T.MeshStandardMaterial({color:0xffffff,roughness:.4,envMapIntensity:.3,metalness:0}));
 const tissue=new T.IcosahedronGeometry(1,1),v=tissue.attributes.position;
 for(let i=0;i<v.count;i++){
  // Equal positions get equal offsets, so the irregular surface stays closed.
  const x=v.getX(i),y=v.getY(i),z=v.getZ(i),n=.82+.18*Math.sin(x*14+y*9+z*17);v.setXYZ(i,x*n,y*n,z*n);
 }
 // Smooth organic fragments; flat triangle normals make these look like rocks.
 for(let i=0;i<v.count;i++){axis.fromBufferAttribute(v,i).normalize();tissue.attributes.normal.setXYZ(i,axis.x,axis.y,axis.z);}
 const fleshMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.47,envMapIntensity:.4,metalness:0});
 fleshMaterial.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFlesh;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFlesh=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFlesh;').replace('#include <color_fragment>','#include <color_fragment>\nfloat fiber=sin(vFlesh.y*38.+sin(vFlesh.x*11.)*2.+vFlesh.z*7.);diffuseColor.rgb*=.72+.28*smoothstep(-.8,.7,fiber);');};
 fleshMaterial.customProgramCacheKey=()=> 'breach-tissue-1';
 const chunks=pool(112,tissue,fleshMaterial);
 const stainMaterial=new T.MeshStandardMaterial({color:0x690d10,roughness:.3,metalness:0,alphaTest:.12,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const stains=pool(120,new T.PlaneGeometry(1,1),stainMaterial),stainData=new T.InstancedBufferAttribute(new Float32Array(120*2),2);
 stains.mesh.geometry.setAttribute('aStain',stainData);
 stainMaterial.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 aStain;varying vec2 vStain,vBloodUV;').replace('#include <begin_vertex>','#include <begin_vertex>\nvStain=aStain;vBloodUV=position.xy*2.;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vStain,vBloodUV;').replace('#include <color_fragment>',`#include <color_fragment>
   vec2 p=vBloodUV;float a=atan(p.y,p.x),r=length(p);
   float edge=.62+.1*sin(a*7.+vStain.x)+.065*sin(a*13.-vStain.x*2.);
   float body=1.-smoothstep(edge-.13,edge,r);
   float spray=0.;
   for(int i=0;i<7;i++){float f=float(i);vec2 at=vec2(cos(f*2.4+vStain.x),sin(f*2.4+vStain.x))*(.72+.12*sin(f*4.));spray=max(spray,1.-smoothstep(.015,.045+.025*sin(f*3.+1.),length(p-at)));}
   diffuseColor.a*=max(body,spray)*vStain.y;
   diffuseColor.rgb*=.68+.32*body;`);
 };stainMaterial.customProgramCacheKey=()=> 'breach-blood-splatter-1';
 const rocket=new T.Group(),rocketMat=new T.MeshStandardMaterial({color:0x535b49,metalness:.6,roughness:.38});
 const body=new T.Mesh(new T.CylinderGeometry(.055,.055,.5,8),rocketMat);body.rotation.x=Math.PI/2;rocket.add(body);
 const tip=new T.Mesh(new T.ConeGeometry(.056,.18,8),rocketMat);tip.rotation.x=Math.PI/2;tip.position.z=.32;rocket.add(tip);
 const flame=new T.Mesh(new T.ConeGeometry(.085,.5,8),new T.MeshBasicMaterial({color:new T.Color(5,1.9,.3),toneMapped:false}));flame.rotation.x=-Math.PI/2;flame.position.z=-.45;rocket.add(flame);rocket.visible=false;scene.add(rocket);
 const flight={age:0,duration:0,trail:0,from:new T.Vector3(),at:new T.Vector3(),previous:new T.Vector3(),detonate:null,trace:null};
 function stain(p,size=.6,floor=surface(p.x,p.z)){
  const i=nextStain++%stains.entries.length,b=stains.entries[i];b.life=b.max=18+random()*12;b.p.copy(p);b.deck=deck&&floor>0;b.p.y=floor+.008+(i%5)*.0005;b.s.set(size*(.8+random()*.6),size*(.6+random()*.5),1);b.q.setFromEuler(new T.Euler(-Math.PI/2,0,random()*6.28));stainData.setXY(i,random()*6.28,1);stainData.needsUpdate=true;stats.stains++;
 }
 function launch(pool,index,p,velocity,size,flesh=false){
  const b=pool.entries[index%pool.entries.length];b.life=b.max=flesh?4+random()*3:1.3+random()*.65;b.p.copy(p);b.v.copy(velocity);b.s.set(size*(.65+random()*.7),size*(flesh?.4+random()*.6:1.7),size*(flesh?.5+random()*.6:.7));b.q.setFromEuler(new T.Euler(random()*6.28,random()*6.28,random()*6.28));b.spin.set(random()-.5,random()-.5,random()-.5).multiplyScalar(14);b.landed=false;b.deck=false;
  const bone=flesh&&random()<.06;
  color.setRGB(bone?.4:.16+random()*.13,bone?.26:.006+random()*.012,bone?.17:.012+random()*.018);pool.mesh.setColorAt(index%pool.entries.length,color);pool.mesh.instanceColor.needsUpdate=true;
 }
 function hit(p,dir,{dead=false,explosive=false,heavy=false,direct=false,size=1}={}){
  stats.hits++;if(dead)stats.kills++;if(explosive)stats.blasts++;
  const strength=(explosive?2.4:dead?1.55:1)*(heavy?1.18:1),count=Math.round((direct?230:explosive?150:dead?95:45)*budget*Math.min(1,size));
  for(let i=0;i<count;i++){
   // Entry spray comes back toward the gun; the exit jet follows the round.
   const forward=i%4===0?1:-1,vel=dir.clone().multiplyScalar(forward*(2+random()*5)*strength);
   vel.add(new T.Vector3((random()-.5)*4,random()*3,(random()-.5)*4).multiplyScalar(strength));
   launch(drops,nextDrop++,p,vel,(.004+random()*.01)*(dead?1.2:1));stats.drops++;
  }
  const pieces=Math.round((direct?38:explosive?25:dead?12:3)*budget*Math.min(1,size));
  for(let i=0;i<pieces;i++){
   const vel=new T.Vector3(random()-.5,.25+random()*.55,random()-.5).normalize().multiplyScalar((2+random()*4)*strength).addScaledVector(dir,explosive?2:-1);
   launch(chunks,nextChunk++,p,vel,(explosive?.065:dead?.045:.02)+random()*(explosive?.11:.04),true);stats.chunks++;
  }
  // Short, depth-softened dark mist supports the ballistic geometry, never a
  // full-screen wash; nearby explosive kills add separate lens droplets.
  effects.haze(p,dir.clone().multiplyScalar(-1.5),{life:dead?.65:.3,size:dead?.5:.25,growth:dead?2.2:1.2,opacity:.48,color:0x640b13,drag:3,rise:-.25});
  if(dead)stain(p,(explosive?2.4:1.15)*(heavy?1.3:1));
 }
 function write(pool,dt,speed,flesh=false){
  let end=0;for(let i=0;i<pool.entries.length;i++){
   const b=pool.entries[i];if(b.life<=0){dummy.scale.setScalar(0);}else{
    b.life=Math.max(0,b.life-dt);end=i+1;
    if(!b.landed){const previousY=b.p.y;b.v.y-=dt*11;b.v.x*=Math.exp(-dt*.45);b.v.z*=Math.exp(-dt*.45);b.p.addScaledVector(b.v,dt);b.p.z+=speed*dt;
     const ground=surface(b.p.x,b.p.z),floor=deck&&previousY<ground?0:ground;
     if(b.p.y<=floor+(flesh?.04:0)){
      b.p.y=floor+.025;b.landed=true;b.deck=deck&&floor>0;
      // A sampled subset leaves little satellite splats; the bounded pool keeps
      // long bursts from accumulating extra draw calls or filling the yard.
      if(flesh?i%4===0:i%17===0)stain(b.p,flesh?.24+random()*.2:.11+random()*.12,floor);
      if(!flesh)b.life=0;else b.v.set(0,0,0);
     }
     if(flesh){const w=b.spin.length();turn.setFromAxisAngle(axis.copy(b.spin).normalize(),w*dt);b.q.premultiply(turn);}else if(b.v.lengthSq()>.01)b.q.setFromUnitVectors(up,axis.copy(b.v).normalize());
    }else if(!b.deck)b.p.z+=speed*dt;
    dummy.position.copy(b.p);dummy.quaternion.copy(b.q);dummy.scale.copy(b.s).multiplyScalar(Math.min(1,b.life/.6));
    // Drops in the gunner's near plane must not become giant opaque blobs.
    if(!flesh)dummy.scale.multiplyScalar(T.MathUtils.smoothstep(b.p.z,.5,2));
   }dummy.updateMatrix();pool.mesh.setMatrixAt(i,dummy.matrix);
  }pool.mesh.count=end;pool.mesh.instanceMatrix.needsUpdate=true;
 }
 return {stats,drops,chunks,stains,rocket,breakup,
  hit,stain,shatter:breakup.burst,get impact(){return flight.impact;},
  setQuality(t){budget=t.gore??t.particles;breakup.setQuality(t);},
  launch(from,at,detonate,trace=null){flight.from.copy(from);flight.at.copy(at);flight.age=flight.trail=0;flight.impact=null;flight.duration=Math.max(.09,from.distanceTo(at)/70);flight.detonate=detonate;flight.trace=trace;rocket.position.copy(from);rocket.lookAt(at);rocket.visible=true;stats.rockets++;},
  update(dt,speed=0){
   if(dt<=0)return;
   breakup.update(dt,speed);
   write(drops,dt,speed);write(chunks,dt,speed,true);
   let end=0;for(let i=0;i<stains.entries.length;i++){
    const b=stains.entries[i];if(b.life<=0)dummy.scale.setScalar(0);else{b.life=Math.max(0,b.life-dt);if(!b.deck)b.p.z+=speed*dt;end=i+1;dummy.position.copy(b.p);dummy.quaternion.copy(b.q);dummy.scale.copy(b.s);stainData.setY(i,Math.min(1,b.life/3));}dummy.updateMatrix();stains.mesh.setMatrixAt(i,dummy.matrix);
   }stains.mesh.count=end;stains.mesh.instanceMatrix.needsUpdate=true;stainData.needsUpdate=true;
   if(rocket.visible){flight.age+=dt;flight.trail+=dt;flight.previous.copy(rocket.position);rocket.position.lerpVectors(flight.from,flight.at,Math.min(1,flight.age/flight.duration));flame.scale.setScalar(.8+random()*.4);
    const contact=flight.trace?.(flight.previous,rocket.position);if(contact)rocket.position.copy(contact.point);
    if(flight.trail>.035/budget){flight.trail=0;effects.haze(rocket.position,new T.Vector3(0,.12,0),{life:.6,size:.12,growth:.7,opacity:.2,color:0x8b8273});}
    if(contact||flight.age>=flight.duration){rocket.visible=false;flight.impact={type:contact?.type??'splash',point:rocket.position.toArray()};const detonate=flight.detonate;flight.detonate=flight.trace=null;detonate?.(rocket.position.clone(),contact);}
   }
  },
  reset(){for(const p of [drops,chunks,stains]){for(const b of p.entries)b.life=0;p.mesh.count=0;}breakup.reset();rocket.visible=false;flight.detonate=flight.trace=null;nextDrop=nextChunk=nextStain=0;for(const k in stats)stats[k]=0;}
 };
}
