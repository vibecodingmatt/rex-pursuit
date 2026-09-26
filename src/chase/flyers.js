import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WET} from './weather-state.js';
import {SPECIES} from './safari-rules.js';
// Pterosaurs, for the gunner to shoot. Dimorphodon cling to the road side of the leaning
// edge trees (roosts recorded per chunk in environment.js), belly to the bark and wings
// folded. A round close by, a big noise, one of them being shot, the Jeep passing underneath
// or the Rex striding past (right in front of the gunner) flushes them, and they flap out across the road corridor and up over the
// canopy. Pteranodon pass high over the corridor in twos and threes, gliding along with the
// chase and flapping now and then: most fly down the open corridor over the road from far
// behind the Rex, pass overhead and are gone over the Jeep; some cross it. A hit crumples the wings and the animal tumbles out of
// the air to the ground, where the road carries it away.
//
// Positions are in the Jeep's frame, where the ground slides past at +speed along z. Each
// species is one instanced draw; the vertex shader sweeps, folds and flaps the wings from a
// per-instance pose aFly = (flap phase 0..1, flap amplitude, fold 0..1, dead 0..1).

const TAU=Math.PI*2;
let seed=8081;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>a+rnd()*(b-a);

// ------------------------------------------------------------------ geometry --
/** Colour from the normal: back colour on top, belly colour beneath (linear RGB). */
function tint(g,{back,belly=back}){
 const p=g.attributes.position,n=g.attributes.normal,c=new Float32Array(p.count*3),a=new T.Color(),b=new T.Color(...back),l=new T.Color(...belly);
 for(let i=0;i<p.count;i++){a.copy(l).lerp(b,T.MathUtils.smoothstep(n.getY(i),-.4,.3));c.set([a.r,a.g,a.b],i*3);}
 g.setAttribute('color',new T.BufferAttribute(c,3));return g;
}
/** A body piece: an ellipsoid placed by at/scale/rot, or a cylinder or cone from→to (top radius at `to`). */
function piece(g,{at=[0,0,0],scale=[1,1,1],rot=[0,0,0],from,to,...paint}){
 g=g.toNonIndexed();g.deleteAttribute('uv');
 if(from){const a=new T.Vector3(...from),d=new T.Vector3(...to).sub(a),len=d.length();g.scale(1,len,1);g.translate(0,len/2,0);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...from);}
 else{g.scale(...scale);g.rotateX(rot[0]);g.rotateY(rot[1]);g.translate(...at);}
 tint(g,paint);g.setAttribute('wing',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));return g;
}
/** One wing membrane as a strip between a leading edge and a trailing edge (keys for the
 *  right wing, mirrored for the left). `wing` carries (span 0..1, side) for the shader. */
function membrane(sd,lead,trail,{edge,inner},segs=10){
 const tipX=lead[lead.length-1][0],along=(keys,u)=>{const f=u*(keys.length-1),i=Math.min(keys.length-2,Math.floor(f)),t=f-i,a=keys[i],b=keys[i+1];return [sd*(a[0]+(b[0]-a[0])*t),a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];};
 const P=[],C=[],W=[],e=new T.Color(...edge),n=new T.Color(...inner),c=new T.Color();
 const put=(v,back)=>{P.push(...v);c.copy(e).lerp(n,back);C.push(c.r,c.g,c.b);W.push(Math.abs(v[0])/tipX,sd);};
 for(let i=0;i<segs;i++){const u0=i/segs,u1=(i+1)/segs,L0=along(lead,u0),L1=along(lead,u1),T0=along(trail,u0),T1=along(trail,u1);
  put(L0,0);put(L1,0);put(T1,1);put(L0,0);put(T1,1);put(T0,1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('wing',new T.Float32BufferAttribute(W,2));g.computeVertexNormals();return g;
}
const S=(w,h)=>new T.SphereGeometry(1,w,h),Cy=(t,b,r=7)=>new T.CylinderGeometry(t,b,1,r);
/** Pteranodon at life size: about 6 m across the wings, a long toothless beak and a long crest swept back. */
function pteranodonGeometry(){
 const hide={back:[.2,.17,.13],belly:[.44,.39,.31]},bill={back:[.46,.38,.24]},crest={back:[.42,.1,.05]},parts=[];
 parts.push(piece(S(12,9),{at:[0,0,0],scale:[.16,.17,.46],...hide}));
 parts.push(piece(Cy(.05,.075),{from:[0,.05,.34],to:[0,.17,.64],...hide}));
 parts.push(piece(S(10,8),{at:[0,.2,.72],scale:[.07,.09,.15],...hide}));
 parts.push(piece(Cy(.008,.07),{from:[0,.2,.8],to:[0,.1,1.62],...bill}));
 parts.push(piece(Cy(.008,.065),{from:[0,.25,.7],to:[0,.4,.02],...crest}));
 for(const s of [-1,1])parts.push(piece(Cy(.012,.03,5),{from:[s*.09,-.06,-.32],to:[s*.2,-.12,-.86],...hide}));
 for(const s of [-1,1])parts.push(membrane(s,[[.12,.08,.25],[.9,.11,.3],[1.55,.12,.2],[2.4,.09,-.02],[3.1,.04,-.3]],[[.1,-.02,-.46],[.95,0,-.42],[1.8,.02,-.34],[2.5,.03,-.3],[3.1,.04,-.3]],{edge:[.14,.1,.07],inner:[.32,.21,.14]}));
 return mergeGeometries(parts);
}
/** Dimorphodon: about 1.4 m across, a big deep puffin-like head, a long stiff tail with a vane. */
function dimorphodonGeometry(){
 const hide={back:[.3,.22,.1],belly:[.52,.44,.3]},face={back:[.8,.46,.1],belly:[.62,.36,.1]},dark={back:[.06,.05,.04]},parts=[];
 parts.push(piece(S(10,8),{at:[0,0,0],scale:[.052,.058,.13],...hide}));
 parts.push(piece(Cy(.028,.034),{from:[0,.03,.1],to:[0,.07,.16],...hide}));
 parts.push(piece(S(10,8),{at:[0,.085,.22],scale:[.045,.062,.085],rot:[.25,0],...face}));
 parts.push(piece(S(8,6),{at:[0,.06,.3],scale:[.028,.038,.06],rot:[.3,0],...face}));
 for(const s of [-1,1])parts.push(piece(S(6,4),{at:[s*.036,.11,.23],scale:[.012,.012,.012],...dark}));
 parts.push(piece(Cy(.004,.014,5),{from:[0,0,-.12],to:[0,-.02,-.55],...hide}));
 parts.push(piece(S(6,4),{at:[0,-.02,-.56],scale:[.006,.04,.035],...dark}));
 for(const s of [-1,1])parts.push(piece(Cy(.006,.012,5),{from:[s*.03,-.03,-.08],to:[s*.05,-.1,-.15],...hide}));
 for(const s of [-1,1])parts.push(membrane(s,[[.04,.03,.06],[.22,.035,.08],[.38,.04,.04],[.55,.03,-.02],[.72,.01,-.09]],[[.035,-.01,-.1],[.25,0,-.1],[.45,0,-.08],[.6,.005,-.08],[.72,.01,-.09]],{edge:[.07,.04,.03],inner:[.2,.11,.07]},8));
 return mergeGeometries(parts);
}

/** Giant azhdarchid: long stiff neck, spear bill, broad root and narrow wingtips. */
function quetzalcoatlusGeometry(){
 const hide={back:[.31,.23,.13],belly:[.58,.47,.31]},bill={back:[.5,.29,.085]},parts=[];
 parts.push(piece(S(16,12),{at:[0,0,0],scale:[.24,.28,.72],...hide}));
 parts.push(piece(Cy(.085,.15,12),{from:[0,.14,.5],to:[0,.54,1.72],...hide}));
 parts.push(piece(S(14,10),{at:[0,.56,1.85],scale:[.14,.18,.3],...hide}));
 parts.push(piece(Cy(.004,.125,12),{from:[0,.57,2],to:[0,.38,3.65],...bill}));
 parts.push(piece(S(10,8),{at:[0,.77,1.7],scale:[.038,.3,.29],rot:[.5,0,0],back:[.43,.13,.045]}));
 for(const side of [-1,1]){
  parts.push(piece(S(8,6),{at:[side*.12,.62,1.95],scale:[.03,.034,.038],back:[.012,.008,.003]}));
  parts.push(piece(Cy(.018,.048,8),{from:[side*.12,-.06,-.52],to:[side*.36,-.18,-1.55],...hide}));
  parts.push(membrane(side,[[.2,.12,.4],[1.4,.17,.54],[2.7,.2,.25],[4,.13,-.18],[5.4,.04,-.65]],[[.16,-.02,-.72],[1.45,.0,-.7],[2.9,.03,-.67],[4.3,.03,-.64],[5.4,.04,-.65]],{edge:[.17,.11,.065],inner:[.46,.29,.17]},20));
 }
 return mergeGeometries(parts);
}

// -------------------------------------------------------------------- shader --
// Wings turn about the shoulder: folding sweeps them back and shortens them, the flap
// rolls them about the body axis with the tip lagging the root, and dead crumples one
// wing up and the other down.
const WING=`
 attribute vec2 wing;attribute vec4 aFly;uniform vec3 uShoulder;
 float wingAngle(){float span=wing.x;return (aFly.y*sin(6.2832*aFly.x-span*1.1)*(.55+.45*span)+.08-aFly.z*.8)*wing.y+aFly.w*.6;}
 vec3 wingTurn(vec3 v,float a){float sw=sin(aFly.z*1.2*wing.y),cw=cos(aFly.z*1.2*wing.y);v.xz=vec2(cw*v.x+sw*v.z,-sw*v.x+cw*v.z);float ca=cos(a),sa=sin(a);v.xy=vec2(ca*v.x-sa*v.y,sa*v.x+ca*v.y);return v;}`;
function flyerMaterial(key,shoulder){
 const uniforms={uShoulder:{value:new T.Vector3(...shoulder)}};
 const vertex=(s,normals)=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>'+WING)
  .replace('#include <begin_vertex>',`#include <begin_vertex>
   if(wing.x>0.){vec3 sh=vec3(wing.y*uShoulder.x,uShoulder.y,uShoulder.z);transformed=sh+wingTurn(transformed-sh,wingAngle())*(1.-aFly.z*.45);}`);
  if(normals)s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(wing.x>0.)objectNormal=wingTurn(objectNormal,wingAngle());');};
 const m=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.78});
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms,{uWet:WET});vertex(s,true);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uWet;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.-uWet*.25;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=1.-uWet*.45;');};
 m.customProgramCacheKey=()=>`rex-flyer-${key}-v1`;
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});depth.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);vertex(s,false);};depth.customProgramCacheKey=()=>`rex-flyer-depth-${key}-v1`;
 return{material:m,depth};
}

// --------------------------------------------------------------------- system --
export function createFlyers(scene,{jungle,camera=null}){
 // Per species: body and wing hit spheres (m, before scale), how far the wing spheres sit
 // out when spread, the dead body's resting clearance, and the flap rate in Hz.
 const species={
  ptero:{name:'pteranodon',label:'Pteranodon',geometry:pteranodonGeometry(),max:8,...flyerMaterial('ptero',[.12,.08,.25]),hitR:.5,wingR:.6,wingAt:1.5,rest:.16,flapHz:1.25},
  dimorph:{name:'dimorphodon',label:'Dimorphodon',geometry:dimorphodonGeometry(),max:24,...flyerMaterial('dimorph',[.04,.03,.06]),hitR:.14,wingR:.13,wingAt:.36,rest:.06,flapHz:5.5},
  quetz:{name:'quetzalcoatlus',label:'Quetzalcoatlus',geometry:quetzalcoatlusGeometry(),max:2,...flyerMaterial('quetz',[.2,.12,.4]),hitR:.7,wingR:.9,wingAt:2.6,rest:.3,flapHz:.75},
 };
 for(const k of Object.values(species)){
  k.pose=new T.InstancedBufferAttribute(new Float32Array(k.max*4),4);k.pose.setUsage(T.DynamicDrawUsage);k.geometry.setAttribute('aFly',k.pose);
  k.mesh=new T.InstancedMesh(k.geometry,k.material,k.max);k.mesh.customDepthMaterial=k.depth;k.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  k.mesh.frustumCulled=false;k.mesh.count=0;k.mesh.name=k.label;k.mesh.castShadow=k===species.dimorph;k.mesh.receiveShadow=true;
  k.mesh.setColorAt(0,new T.Color(1,1,1));scene.add(k.mesh);
  k.pool=Array.from({length:k.max},()=>({on:false,kind:k,state:'perch',p:new T.Vector3(),v:new T.Vector3(),q:new T.Quaternion(),spin:new T.Vector3(),n:new T.Vector3(),
   phase:0,amp:0,fold:1,dead:0,scale:1,fade:1,tint:new T.Color(),t:0,flushAt:-1,flap:0,wobble:0,bank:0,grounded:false,landed:false,age:0,flick:0}));
 }
 const P=species.ptero,D=species.dimorph,ALL=Object.values(species);
 const m4=new T.Matrix4(),s=new T.Vector3(),x=new T.Vector3(),y=new T.Vector3(),z=new T.Vector3(),up=new T.Vector3(0,1,0),o=new T.Vector3(),
  turn=new T.Quaternion(),bankQ=new T.Quaternion(),settle=new T.Quaternion(),axis=new T.Vector3(),c3=new T.Vector3(),w3=new T.Vector3(),pos=new T.Vector3(),e=new T.Euler(0,0,0,'YXZ');
 let now=0,travel=0,nextPass=150,density=1,chunkZ=[],api;const tally={kills:0};
 const free=k=>{const c=k.pool.find(c=>!c.on);if(c)c.hp=1;return c;};
 function huntSpawn(name,side){
  if(name==='dimorphodon'){
   // Only ever on a real trunk: a free roost on a visible edge tree in front of the gun, preferring
   // this side. Most take off from it a moment later. With no roost in reach one flies in across
   // the road from behind the understory instead.
   const r=freeRoost(side)||freeRoost(-side);
   if(r){const c=perch(r.x,r.y,r.z,r.nx,r.nz,r.chunk);if(c&&rnd()<.7)flush(c,range(.5,1.4));return c;}
   const c=free(D);if(!c)return null;
   Object.assign(c,{on:true,state:'fly',phase:rnd(),amp:1,fold:0,dead:0,scale:range(1.5,1.8),fade:1,t:1,flushAt:-1,flick:0,grounded:false,landed:false,age:0,home:null,wobble:rnd()*TAU});
   c.p.set(side*17,range(6,8),range(20,30));c.v.set(-side*5.5,.5,range(-2,0));c.n.set(-side,0,0);c.tint.setRGB(1,1,1);orient(c,0);return c;
  }
  const k=ALL.find(k=>k.name===name),c=k&&free(k);if(!c)return null;
  const giant=name==='quetzalcoatlus';
  Object.assign(c,{on:true,state:'glide',hp:SPECIES[name].hp,phase:rnd(),amp:.12,fold:0,dead:0,scale:range(.95,1.05),fade:1,t:0,flap:range(.4,1),wobble:rnd()*TAU,bank:0,grounded:false,landed:false,age:0});
  // Out of the haze down the road corridor, as in the chase, not materialising in open sky.
  c.p.set(side*range(1,3),giant?9:range(6,8.5),giant?92:range(72,82));c.v.set(-side*.3,0,giant?-23:-16);c.tint.setRGB(1,1,1);orient(c,0);api.onCall?.(c.p);return c;
 }
 function strike(c,dir,power=1,damage=1){if(!c?.on||c.state==='dead')return false;c.hp=(c.hp??1)-damage;if(c.hp>0){c.flap=-.7;c.bank+=(rnd()<.5?-1:1)*.55;c.v.y-=.8;return false;}return kill(c,dir,power);}

 /** A Dimorphodon clinging to a trunk at (x,y,z), belly to the bark, back to the road (n points out). */
 function perch(x0,y0,z0,nx,nz,chunk=null){
  const c=free(D);if(!c)return null;
  Object.assign(c,{on:true,state:'perch',phase:rnd(),amp:0,fold:.55,dead:0,scale:range(1.5,1.8),fade:1,t:range(0,4),flushAt:-1,flick:0,grounded:false,landed:false,age:0});
  c.n.set(nx,0,nz).normalize();c.p.set(x0,y0,z0).addScaledVector(c.n,.06*c.scale);c.v.set(0,0,0);
  // Tied to its tree: if the chunk wraps round, resets or gives its slot to the river ford, the tree
  // it clings to is gone and so is it (see step).
  c.home=chunk?{chunk,roosts:chunk.roosts,dz:c.p.z-chunk.group.position.z}:null;
  // Head up the trunk, back to the road.
  z.set(0,1,0);y.copy(c.n);x.crossVectors(y,z).normalize();c.q.setFromRotationMatrix(m4.makeBasis(x,y,z));
  c.tint.setRGB(range(.85,1.15),range(.85,1.1),range(.8,1.05));return c;
 }
 function populate(chunk,chance){for(const tree of chunk.roosts||[])if(rnd()<chance){const a=Math.floor(rnd()*3),b=(a+1+Math.floor(rnd()*2))%3;
  for(const r of rnd()<.35?[tree[a],tree[b]]:[tree[a]])perch(r.x,r.y,r.z+chunk.group.position.z,r.nx,r.nz,chunk);}}
 /** A free roost (scene position and outward normal) on a visible edge tree on `side`, 14-40 m back from the gun. */
 function freeRoost(side){let best=null,score=Infinity;
  for(const chunk of jungle.chunks){const cz=chunk.group.position.z;if(cz<-20||cz>70)continue;
   for(const tree of chunk.roosts||[])for(const r of tree){const z=r.z+cz;if(z<14||z>40||Math.sign(r.x)!==side)continue;
    if(D.pool.some(o=>o.on&&o.state==='perch'&&Math.hypot(o.p.x-r.x,o.p.y-r.y,o.p.z-z)<1.5))continue;
    const sc=Math.abs(z-24)+rnd()*8;if(sc<score){score=sc;best={x:r.x,y:r.y,z,nx:r.nx,nz:r.nz,chunk};}}}
  return best;}
 /** Take off from the trunk: out over the road, then across and up. */
 function flush(c,delay=0){if(c.state==='perch'&&c.flushAt<0)c.flushAt=now+delay;}
 function launch(c){
  c.state='fly';c.t=0;c.flushAt=-1;const side=Math.sign(c.p.x)||1;
  c.v.copy(c.n).multiplyScalar(range(4,5.5)).add(o.set(-side*range(1,2.5),-.6,range(-2.5,2.5)));c.wobble=rnd()*TAU;
  api.onFlush?.(pos.copy(c.p));
 }
 /**
  * A flock of Pteranodon. `along`: down the corridor over the road from far behind the Rex,
  * overtaking the chase at about 6 m/s, so they grow for ten seconds and pass overhead (the
  * canopy leaves the sky open only over the road). Otherwise across the corridor from `side`.
  */
 function pass(side=rnd()<.5?-1:1,count=1+Math.floor(rnd()*3),along=rnd()<.7){
  const x0=along?range(-3,3):side*range(13,16),y0=along?range(12,15):range(13,16),z0=along?range(75,90):range(24,40),vx=along?range(-.6,.6):-side*range(3.5,4.5),vz=along?-range(15.5,17):-range(9,10);let first=null;
  for(let i=0;i<count;i++){const c=free(P);if(!c)break;first=first||c;
   Object.assign(c,{on:true,state:'glide',phase:rnd(),amp:.05,fold:0,dead:0,scale:range(.85,1.1),fade:1,t:0,flap:range(.5,2.5),wobble:rnd()*TAU,bank:0,grounded:false,landed:false,age:0});
   c.p.set(x0+(along?range(-3,3):side*i*range(3,5)),y0+range(-1,1.5),z0+i*range(3,6));c.v.set(vx+range(-.4,.4),0,vz+range(-.3,.3));c.tint.setRGB(range(.9,1.1),range(.9,1.08),range(.88,1.05));}
  if(first)api.onCall?.(pos.copy(first.p));
  return !!first;
 }
 /** Face the air velocity (ground frame), banked into the turn. */
 function orient(c,bank){z.copy(c.v);if(z.lengthSq()<1e-4)return;z.normalize();x.crossVectors(up,z).normalize();y.crossVectors(z,x);c.q.setFromRotationMatrix(m4.makeBasis(x,y,z));bankQ.setFromAxisAngle(z,bank);c.q.premultiply(bankQ);}
 function kill(c,dir,power=1){
  if(!c.on||c.state==='dead')return false;const k=c.kind,h=Math.hypot(dir.x,dir.z)||1;
  if(c.state==='perch'){c.v.set(0,0,0);for(const o2 of D.pool)if(o2.on&&o2!==c&&o2.p.distanceToSquared(c.p)<36)flush(o2,range(.05,.3));}
  c.v.addScaledVector(o.set(dir.x/h,0,dir.z/h),(k===P?1.5:3)*power);c.v.y=Math.max(c.v.y,0)+(k===P?.5:1.5)*power;
  c.spin.set(range(-1,1),range(-1,1),range(-1,1)).normalize().multiplyScalar((k===P?2.5:9)*(.7+rnd()*.6));
  Object.assign(c,{state:'dead',dead:1,fold:.5,amp:1.2,age:0,grounded:false,landed:false,flushAt:-1});
  tally.kills++;api.onKill?.(pos.copy(c.p),k.name);return true;
 }
 function step(k,c,dt,speed,rex){
  c.t+=dt;
  if(c.state==='perch'){
   c.p.z+=speed*dt;
   const h=c.home;if(h&&(h.chunk.roosts!==h.roosts||Math.abs(c.p.z-h.chunk.group.position.z-h.dz)>.5)){c.on=false;return;}
   // Now and then a wing flicks open and shut.
   c.t>6&&(c.t=0,c.flick=.45);c.flick=Math.max(0,c.flick-dt);const f=c.flick>0?Math.sin(c.flick/.45*Math.PI):0;
   // Perched with the wings half open against the bark (mantled), which also reads from the road.
   c.fold=.55-.35*f;c.amp=.35*f;c.phase=(c.phase+dt*3)%1;
   // The Jeep passing underneath flushes some; the Rex striding past flushes more, and those
   // burst off the trunk in front of the gunner. Past her, the rest recede into the haze.
   const was=c.p.z-speed*dt;
   if(c.p.z>-1.5&&was<=-1.5&&rnd()<.3)flush(c,range(.1,.6));
   if(rex&&c.p.z>rex.z-2&&was<=rex.z-2&&Math.abs(c.p.x-rex.x)<17&&rnd()<.55)flush(c,range(0,.35));
   if(c.flushAt>=0&&now>=c.flushAt)launch(c);
  }else if(c.state==='fly'){
   // Strong wingbeats; out over the road, then across it and up and away, weaving.
   const side=Math.sign(c.p.x)||1;c.v.y+=(3.2-c.v.y)*Math.min(1,dt*1.6);c.v.x+=(-side*5.5-c.v.x)*Math.min(1,dt*.7)*(c.t>.5?1:0);c.v.x+=Math.sin(now*3+c.wobble)*dt*4;
   c.fold=Math.max(0,c.fold-dt*4);c.amp=1;c.phase=(c.phase+dt*k.flapHz)%1;
   c.p.x+=c.v.x*dt;c.p.y+=c.v.y*dt;c.p.z+=(c.v.z+speed)*dt;c.bank+=(-Math.sin(now*3+c.wobble)*.5-c.bank)*Math.min(1,dt*4);orient(c,c.bank);
   if(Math.abs(c.p.x)>36||c.p.y>34||c.p.z>95||c.p.z<-40)c.on=false;
  }else if(c.state==='glide'){
   // Long glides with the chase, a few slow wingbeats now and then, a gentle weave and bank.
   c.flap-=dt;if(c.flap<-1.4)c.flap=range(2,4);const beating=c.flap<0;c.amp+=((beating?.75:.05)-c.amp)*Math.min(1,dt*3);c.phase=(c.phase+dt*(beating?k.flapHz:.25))%1;
   // Down the corridor they hold the middle of the gap.
   const weave=Math.sin(now*.45+c.wobble);c.v.x+=weave*dt*.5-(Math.abs(c.v.z)>12?c.p.x*.25*dt:0);c.v.y+=((beating?.7:-.35)-c.v.y)*Math.min(1,dt*.8);
   c.p.x+=c.v.x*dt;c.p.y+=c.v.y*dt;c.p.z+=(c.v.z+speed)*dt;c.bank+=(-weave*.35-c.bank)*Math.min(1,dt*2);orient(c,c.bank);
   if(Math.abs(c.p.x)>34||c.p.z>120||c.p.z<-30)c.on=false;
  }else{
   c.age+=dt;const ground=jungle.groundAt(c.p.x,c.p.z),rest=k.rest*c.scale;
   if(!c.grounded){
    // Tumbling down, wings flailing; air drag bleeds off the forward speed.
    c.v.y-=9.8*dt;const drag=Math.max(0,1-dt*(k===P?.6:.3));c.v.x*=drag;c.v.z*=drag;
    c.p.x+=c.v.x*dt;c.p.y+=c.v.y*dt;c.p.z+=(c.v.z+speed)*dt;
    const w=c.spin.length();if(w>1e-4){turn.setFromAxisAngle(axis.copy(c.spin).divideScalar(w),w*dt);c.q.premultiply(turn).normalize();}
    c.phase=(c.phase+dt*k.flapHz*.8)%1;c.amp=Math.max(.15,c.amp-dt*.4);
    if(c.p.y-ground<rest&&c.v.y<0){c.p.y=ground+rest;if(!c.landed){c.landed=true;api.onLand?.(pos.copy(c.p).setY(ground),k===P?1:.25);}
     if(c.v.y<-2.5){c.v.y*=-.22;c.v.x*=.5;c.v.z*=.5;c.spin.multiplyScalar(.4);}else{c.v.y=0;c.grounded=true;}}
   }else{
    // Down: it slides to a stop, settles belly down with the wings half spread, and rides the road away.
    const f=Math.max(0,1-dt*5);c.v.x*=f;c.v.z*=f;c.p.x+=c.v.x*dt;c.p.z+=(c.v.z+speed)*dt;c.p.y=ground+rest;
    w3.set(0,0,1).applyQuaternion(c.q);e.set(0,Math.atan2(w3.x,w3.z),0);settle.setFromEuler(e);c.q.slerp(settle,1-Math.exp(-dt*6));
    c.amp=Math.max(0,c.amp-dt);c.fold=Math.max(.25,c.fold-dt*.5);c.dead=Math.max(.3,c.dead-dt);
   }
   if(c.age>14){c.fade-=dt*2;if(c.fade<=0)c.on=false;}
   if(c.p.z>85||c.p.z<-60||Math.abs(c.p.x)>40)c.on=false;
  }
 }
 function write(k){
  let n=0;const A=k.pose.array;
  for(const c of k.pool){if(!c.on)continue;
   m4.compose(c.p,c.q,s.setScalar(c.scale*Math.max(0,Math.min(1,c.fade))));k.mesh.setMatrixAt(n,m4);k.mesh.setColorAt(n,c.tint);
   A[n*4]=c.phase;A[n*4+1]=c.amp;A[n*4+2]=c.fold;A[n*4+3]=c.dead;n++;}
  k.mesh.count=n;if(n){k.mesh.instanceMatrix.needsUpdate=true;k.mesh.instanceColor.needsUpdate=true;k.pose.needsUpdate=true;}
 }
 /** Distance along a unit ray to a sphere, or -1. */
 function sphereAlong(ray,centre,r){w3.subVectors(centre,ray.origin);const t=w3.dot(ray.direction);if(t<=0)return -1;const d2=w3.lengthSq()-t*t;return d2>r*r?-1:t-Math.sqrt(r*r-d2);}

 api={
  meshes:ALL.map(k=>k.mesh),huntSpawn,strike,onKill:null,onLand:null,onFlush:null,onCall:null,
  setQuality(t){density=Math.min(1,t.fauna??t.particles);D.mesh.castShadow=!!t.detail;},
  reset({empty=false}={}){for(const k of ALL){for(const c of k.pool)c.on=false;k.mesh.count=0;}now=0;travel=0;nextPass=range(120,220);chunkZ=[];tally.kills=0;if(empty)return;
   for(const chunk of jungle.chunks){const cz=chunk.group.position.z;if(cz>-70&&cz<70)populate(chunk,.5);}},
  perch,pass,kill,
  /**
   * The nearest live pterosaur on a world-space ray, or null: a sphere on the body and, when
   * the wings are spread, one on each wing, none smaller than `minAngle` radians as seen from the gun.
   */
  hit(ray,far=Infinity,minAngle=0){
   let best=null;
   for(const k of ALL)for(const c of k.pool){if(!c.on||c.state==='dead'||c.fade<.6)continue;
    const d=c.p.distanceTo(ray.origin),r=Math.max(k.hitR*c.scale,d*minAngle);let t=sphereAlong(ray,c.p,r);
    if(c.fold<.5)for(const sd of [-1,1]){c3.set(sd*k.wingAt*(1-c.fold),0,-.05).applyQuaternion(c.q).multiplyScalar(c.scale).add(c.p);const tw=sphereAlong(ray,c3,Math.max(k.wingR*c.scale,d*minAngle*.8));if(tw>=0&&(t<0||tw<t))t=tw;}
    if(t<0||t>far||best&&t>=best.distance)continue;
    best={target:c,kind:k.name,distance:t,point:ray.at(t,new T.Vector3())};
   }
   return best;
  },
  /** A round passing close to perched Dimorphodon (before it strikes, `far` along the ray) startles them into the air. */
  nearMiss(ray,far=Infinity,radius=3){for(const c of D.pool)if(c.on&&c.state==='perch'&&c.flushAt<0){const t=w3.subVectors(c.p,ray.origin).dot(ray.direction);if(t>0&&t<far+radius&&ray.distanceSqToPoint(c.p)<radius*radius)flush(c,range(.05,.35));}},
  /** A big noise (a roar, a crash, a blast) flushes every perched one within r. */
  alarm(p,r=20){for(const c of D.pool)if(c.on&&c.state==='perch'&&c.p.distanceToSquared(p)<r*r)flush(c,range(.1,.8));},
  /** A blast kills every pterosaur within radius and flushes the rest near it. */
  blast(p,radius=5){const out=[];for(const k of ALL)for(const c of k.pool){if(!c.on||c.state==='dead')continue;const d=c.p.distanceTo(p);if(d<radius+k.hitR*c.scale){if(strike(c,o.subVectors(c.p,p).normalize(),1.5,4))out.push(k.name);}else if(d<radius*3)flush(c,range(.05,.3));}return out;},
  stats(){const count=(k,st)=>k.pool.filter(c=>c.on&&(!st||c.state===st)).length;return{pteranodon:count(P),dimorphodon:count(D),perched:count(D,'perch'),flying:count(D,'fly')+count(P,'glide'),dead:count(P,'dead')+count(D,'dead'),kills:tally.kills};},
  /** Live pterosaurs of a species (for aiming checks). */
  live(name){const k=ALL.find(k=>k.name===name);return k.pool.filter(c=>c.on&&c.state!=='dead').map(c=>({x:c.p.x,y:c.p.y,z:c.p.z,hp:c.hp,state:c.state}));},
  /**
   * @param spawn allow roosting Dimorphodon and passing Pteranodon (not in the opening or after the chase)
   * @param rex {x,z} of her body in the Jeep frame, or null
   */
  update(dt,{speed=0,visible=true,spawn=true,rex=null}={}){
   now+=dt;for(const k of ALL)k.mesh.visible=visible;if(!visible||dt<=0)return;
   if(spawn){
    travel+=speed*dt;
    if(speed>4&&travel>=nextPass){pass();nextPass=travel+range(220,340);}
    // Dimorphodon settle on the edge trees of each chunk as it comes up the road.
    jungle.chunks.forEach((chunk,i)=>{const cz=chunk.group.position.z,was=chunkZ[i];if(was!==undefined&&was<-52&&cz>=-52)populate(chunk,.5*Math.max(.6,density));chunkZ[i]=cz;});
   }
   for(const k of ALL)for(const c of k.pool)if(c.on)step(k,c,dt,speed,rex);
   for(const k of ALL)write(k);
  }
 };
 api.reset();return api;
}
