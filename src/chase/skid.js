import * as T from 'three';
import {WET} from './weather-state.js';
// Where the dying Rex meets the road. The fall (death-motion.js) reports each
// ground contact every frame (snout, jaw, chest, belly, dragged feet, tail) with
// its speed over the ground; this module turns them into what that contact does
// to soil. Physics first:
// - A sliding contact is a plough. Soil heaps against its leading face and peels
//   off both sides as a bow wave: clods and grit thrown forward and outward at a
//   fraction of the slip speed, with a low rolling dust cloud in the dry; in the
//   wet the same wave is muddy water sheets and drops.
// - It leaves a gouge: a rounded trough with crumbling berms (snout, tail), a
//   broad polished smear (belly), or three claw rakes (feet); lit as relief,
//   and in the rain the trough holds water.
// - A body slamming flat squeezes the air (or water) out from under itself: a
//   radial ground surge.
// - The snout pushes a mound of soil ahead of it and stops against it.
// Everything is placed in the road's frame and rides away with it.

const TRACKS=14,POINTS=96,SPACING=.14;
const KIND={chin:1,jaw:1,chest:0,belly:0,'foot-L':2,'foot-R':2,tail:1,'tail-tip':1};
const DEPTH={chin:.1,jaw:.08,chest:.05,belly:.045,'foot-L':.05,'foot-R':.05,tail:.06,'tail-tip':.035};
let seed=6011;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};

const FURROW_GLSL=`
 // GLSL pow() is undefined for a negative base: square explicitly.
 float fSq(float x){return x*x;}
 float fHash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
 float fNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fHash(i),fHash(i+vec2(1,0)),f.x),mix(fHash(i+vec2(0,1)),fHash(i+1.),f.x),f.y);}
 // Relief (m) across (u: trough |u|<1, berms to 1.4) and along (v, metres) a gouge.
 float furrowH(vec2 q,float depth,float kind,float seed,out float bed,out float berm){
  float u=q.x,v=q.y,au=abs(u);
  float lump=fNoise(vec2(v*2.3+seed*7.,u*1.9+seed*3.))-.5,crumb=fNoise(vec2(v*7.+seed,u*6.))-.5;
  float streak=fNoise(vec2(u*11.+seed*5.,v*.3))*.7+fNoise(vec2(u*27.+seed,v*.8))*.3;
  if(kind<.5){
   // Belly smear: broad, shallow and polished, raked by scale ridges, with soft
   // rolls of pushed dirt either side.
   bed=1.-smoothstep(.55,1.,au);berm=exp(-fSq((au-1.13)/.19))*(.65+1.1*max(0.,lump+.35));
   return -depth*bed*(.75+.5*streak)+depth*.9*berm+crumb*.012*berm;
  }
  if(kind<1.5){
   // Ploughed furrow: rounded trough, heaped and crumbling berms.
   bed=pow(max(0.,1.-au*au),1.3);berm=exp(-fSq((au-1.1)/.17))*(.55+1.3*max(0.,lump+.3));
   return -depth*bed*(.85+.3*streak)+depth*berm+crumb*.02*berm;
  }
  // Claw rake: three grooves, dirt thrown up between and beside them.
  float g=0.;for(int k=-1;k<=1;k++)g+=exp(-fSq((u-float(k)*.62)/.15));
  bed=clamp(g,0.,1.);berm=exp(-fSq((au-1.05)/.22))*(.6+lump);
  return -depth*g*(.65+.6*streak)+depth*.35*berm;
 }`;

function furrowMesh(){
 const n=TRACKS*POINTS*2,geometry=new T.BufferGeometry();
 const attr=(name,size)=>{const a=new T.BufferAttribute(new Float32Array(n*size),size);a.setUsage(T.DynamicDrawUsage);geometry.setAttribute(name,a);return a;};
 const position=attr('position',3),a0=attr('furrow',4),a1=attr('furrowB',4),a2=attr('furrowDir',2);
 // Lit as ground: every vertex faces up (a missing normal attribute reads as zero and lights as NaN).
 const up=new Float32Array(n*3);for(let i=0;i<n;i++)up[i*3+1]=1;geometry.setAttribute('normal',new T.BufferAttribute(up,3));
 const index=[];for(let t=0;t<TRACKS;t++)for(let i=0;i<POINTS-1;i++){const k=(t*POINTS+i)*2;index.push(k,k+2,k+1,k+1,k+2,k+3);}
 geometry.setIndex(index);geometry.boundingSphere=new T.Sphere(new T.Vector3(),1e4);
 const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.9,envMapIntensity:.3,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const uniforms={uWet:WET};
 material.onBeforeCompile=s=>{
  s.uniforms.uWet=uniforms.uWet;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 furrow,furrowB;attribute vec2 furrowDir;varying vec4 vFurrow,vFurrowB;varying vec3 vAlong,vAcross;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvFurrow=furrow;vFurrowB=furrowB;vec2 fd=dot(furrowDir,furrowDir)>1e-6?normalize(furrowDir):vec2(1.,0.);vAlong=normalize((modelViewMatrix*vec4(fd.x,0.,fd.y,0.)).xyz);vAcross=normalize((modelViewMatrix*vec4(-fd.y,0.,fd.x,0.)).xyz);');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   uniform float uWet;varying vec4 vFurrow,vFurrowB;varying vec3 vAlong,vAcross;float fBed,fBerm,fDeep,fWater;
   ${FURROW_GLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
   {
    // furrow: u, v, depth, kind; furrowB: metres to the track's head, seed, half-width, age.
    vec2 q=vFurrow.xy;float depth=vFurrow.z,kind=vFurrow.w,seed=vFurrowB.y;
    float h=furrowH(q,depth,kind,seed,fBed,fBerm);
    fDeep=smoothstep(0.,-depth*.6,h);
    // Rain collects in the bottom of the gouge as it ages.
    fWater=uWet*smoothstep(-depth*.35,-depth*.8,h)*smoothstep(.1,1.2,vFurrowB.w)*(kind>1.5?.6:1.);
    float grain=fNoise(q*vec2(9.,3.)+seed*11.),clod=smoothstep(.62,.8,fNoise(q*vec2(5.,2.2)+seed*3.));
    vec3 dry=vec3(.27,.205,.14)*(.9+.2*grain);
    dry=mix(dry,vec3(.105,.072,.047)*(.8+.4*grain),fDeep);                      // damp subsoil in the trough
    dry=mix(dry,vec3(.33,.26,.18)*(.8+.4*grain),smoothstep(.15,.7,fBerm)*.85);     // loose crumbs on the berms
    dry=mix(dry,vec3(.1,.07,.045),clod*fBerm*.6);
    vec3 wet=mix(vec3(.085,.062,.042),vec3(.058,.041,.028),fDeep)*(.85+.3*grain);
    wet=mix(wet,vec3(.03,.028,.024),fWater);
    diffuseColor.rgb=mix(dry,wet,uWet);
    float au=abs(q.x),edge=1.-smoothstep(1.18,1.4,au+(grain-.5)*.12);
    float taper=smoothstep(0.,.35,q.y)*smoothstep(0.,.25,vFurrowB.x);
    diffuseColor.a=edge*taper*max(.35,min(1.,fBed*1.4+fBerm))*.96;
    if(diffuseColor.a<.01)discard;
   }`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(1.,.86,fDeep*(1.-step(.5,vFurrow.w))),mix(.36,.2,fDeep),uWet);roughnessFactor=mix(roughnessFactor,.05,fWater);')
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   {
    // Relief normal: N - dh/dacross * A - dh/dalong * L; pooled water lies flat.
    vec2 q=vFurrow.xy;float b,m,w=max(.05,vFurrowB.z);
    float du=(furrowH(q+vec2(.03,0.),vFurrow.z,vFurrow.w,vFurrowB.y,b,m)-furrowH(q-vec2(.03,0.),vFurrow.z,vFurrow.w,vFurrowB.y,b,m))/(.06*w);
    float dv=(furrowH(q+vec2(0.,.04),vFurrow.z,vFurrow.w,vFurrowB.y,b,m)-furrowH(q-vec2(0.,.04),vFurrow.z,vFurrow.w,vFurrowB.y,b,m))/.08;
    // Slopes are clamped and the normal kept facing the camera: a normal turned
    // away from the view divides the specular term by zero, and that infinity
    // blooms into black-cored white blocks.
    vec2 slope=vec2(du,dv)*1.4;float sl=length(slope);if(sl>1.1)slope*=1.1/sl;
    normal=normalize(normal-(vAcross*slope.x+vAlong*slope.y)*(1.-fWater));
    vec3 toEye=normalize(vViewPosition);float nv=dot(normal,toEye);if(nv<.15)normal=normalize(normal+toEye*(.15-nv));
   }`);
 };
 material.customProgramCacheKey=()=> 'rex-fall-furrow-v1';
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.receiveShadow=true;mesh.renderOrder=1;mesh.name='Fall furrows';
 return{mesh,position,a0,a1,a2};
}

// The heap of soil the snout shoves ahead of it: a crescent that wraps the
// front of the jaw, lumpy with clods, built once and scaled as it grows.
function moundMesh(){
 const g=new T.PlaneGeometry(2.8,2.4,42,36);g.rotateX(-Math.PI/2);
 const p=g.attributes.position,colors=new Float32Array(p.count*3),hash=(x,z)=>{const s=Math.sin(x*12.9898+z*78.233)*43758.5453;return s-Math.floor(s);};
 const noise=(x,z)=>{const i=Math.floor(x),j=Math.floor(z),fx=x-i,fz=z-j,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);return (hash(i,j)*(1-u)+hash(i+1,j)*u)*(1-v)+(hash(i,j+1)*(1-u)+hash(i+1,j+1)*u)*v;};
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z*1.15),a=Math.atan2(x,z);
  const front=1-T.MathUtils.smoothstep(Math.abs(a),1.1,2.3),ridge=Math.exp(-(((r-.62)/.36)**2));
  const lumps=noise(x*4.3,z*4.3)-.5,clods=Math.max(0,noise(x*9+3,z*9)-.62);
  const h=Math.max(0,(ridge*front*(1+.35*lumps)+clods*.8*ridge)*(1-T.MathUtils.smoothstep(r,1.05,1.35)));
  p.setY(i,h);const shade=.78+.4*noise(x*6,z*6)-clods*.9;colors.set([shade,shade*.97,shade*.93],i*3);
 }
 g.setAttribute('color',new T.BufferAttribute(colors,3));g.computeVertexNormals();
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.95});
 const mesh=new T.Mesh(g,material);mesh.castShadow=mesh.receiveShadow=true;mesh.visible=false;mesh.name='Ploughed mound';
 return mesh;
}

export function createSkid(scene,{effects,mud}){
 const furrows=furrowMesh(),mound=moundMesh();scene.add(furrows.mesh,mound);
 const tracks=Array.from({length:TRACKS},(_,i)=>({slot:i,kind:null,points:[],live:false,seen:-1,seed:rnd(),budget:0,dust:0}));
 let coat={value:new T.Vector4()};const coatTarget=new T.Vector4();
 let road=0,time=0,scale=1,dirty=false,heading=new T.Vector3(0,0,-1);
 const moundState={grow:0,p:new T.Vector3(),dir:new T.Vector3(0,0,-1),active:false};
 const v=new T.Vector3(),dir=new T.Vector3(),p=new T.Vector3(),front=new T.Vector3(),flat=new T.Vector3();

 function trackFor(kind){
  let t=tracks.find(t=>t.live&&t.kind===kind);
  if(t&&time-t.seen>.15){t.live=false;t=null;}
  if(!t){t=tracks.reduce((a,b)=>!b.kind?b:!a.kind?a:(a.born<b.born?a:b));Object.assign(t,{kind,points:[],live:true,born:time,seed:rnd()});}
  return t;
 }
 function addPoint(t,c){
  const z=c.position.z-road,last=t.points[t.points.length-1],depth=DEPTH[c.kind]*(1+.5*WET.value)*(.6+.4*Math.min(1,c.load));
  const w=c.width*.5*(.75+.25*Math.min(1,c.load));
  if(last&&Math.hypot(c.position.x-last.x,z-last.z)<SPACING){last.x=c.position.x;last.z=z;last.w=Math.max(last.w,w);last.d=Math.max(last.d,depth);return;}
  if(t.points.length>=POINTS){t.points.shift();}
  t.points.push({x:c.position.x,z,w,d:depth,born:time});
 }
 function rebuild(){
  const {position,a0,a1,a2}=furrows;
  for(const t of tracks){
   const pts=t.points,base=t.slot*POINTS*2;let length=0;
   for(let i=0;i<pts.length;i++)if(i)length+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);
   let along=0;
   for(let i=0;i<POINTS;i++){
    const k=base+i*2;
    // Unused vertices collapse onto the track's head (zero-area triangles) with a
    // valid direction: a NaN here would bloom into black blocks across the screen.
    if(i>=pts.length||pts.length<2){const e=pts[pts.length-1];for(const j of [k,k+1]){position.setXYZ(j,e?e.x:0,e?.012:-50,e?e.z:0);a0.setXYZW(j,9,0,.01,1);a1.setXYZW(j,0,0,.1,0);a2.setXY(j,1,0);}continue;}
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],q=pts[i];
    if(i)along+=Math.hypot(q.x-pts[i-1].x,q.z-pts[i-1].z);
    let dx=b.x-a.x,dz=b.z-a.z;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
    const nx=-dz,nz=dx,reach=q.w*1.4,kind=KIND[t.kind];
    position.setXYZ(k,q.x+nx*reach,.012,q.z+nz*reach);position.setXYZ(k+1,q.x-nx*reach,.012,q.z-nz*reach);
    for(const [j,u]of [[k,1.4],[k+1,-1.4]]){a0.setXYZW(j,u,along,q.d,kind);a1.setXYZW(j,length-along,t.seed,q.w,time-q.born);a2.setXY(j,dx,dz);}
   }
  }
  position.needsUpdate=a0.needsUpdate=a1.needsUpdate=a2.needsUpdate=true;dirty=false;
 }
 /** Launch velocity (Jeep frame) for soil thrown off a plough: forward and out. */
 function throwVelocity(out,d,slip,side,spread,lift,roadSpeed){
  const a=side*spread,c=Math.cos(a),s=Math.sin(a);
  return out.set((d.x*c-d.z*s)*slip,lift,(d.x*s+d.z*c)*slip+roadSpeed);
 }
 function plough(c,t,dt,roadSpeed){
  const slip=c.slip;if(slip<.35)return;
  dir.set(c.velocity.x,0,c.velocity.z).normalize();
  const w=WET.value,dry=1-w,load=Math.min(1,c.load),kind=KIND[c.kind],foot=kind===2;
  front.copy(c.position).addScaledVector(dir,foot?.1:c.kind==='chin'?.45:c.width*.35);front.y=.06;
  // Soil moved per second grows with the swept width and the speed.
  t.budget+=dt*slip*c.width*load*(foot?4:c.kind.startsWith('tail')?5:9)*scale;
  while(t.budget>=1){
   t.budget-=1;const side=rnd()<.5?-1:1,lift=slip*(.25+rnd()*.5)*(.6+.4*load);
   throwVelocity(v,dir,slip*(.25+rnd()*.6),side,.3+rnd()*1.1,lift,roadSpeed);
   const at=p.copy(front).addScaledVector(flat.copy(v).setZ(v.z-roadSpeed).setY(0).normalize(),rnd()*c.width*.4);at.y=.06;
   if(rnd()<.65)effects.debris(rnd()<.62?'clod':rnd()<.8?'pebble':'leaf',at,v,foot?.8:1.1+rnd()*.7);
   for(let i=0;i<3;i++){throwVelocity(v,dir,slip*(.3+rnd()*.8),side,.2+rnd()*1.3,slip*(.2+rnd()*.7),roadSpeed);effects.speck(at,v,w>.5?[.05,.036,.025]:[.2+rnd()*.06,.15+rnd()*.04,.1],.02+rnd()*.03,.4+rnd()*.4);}
  }
  // Dry: a low dust cloud rolls off the bow wave and hangs; ground-relative.
  if(dry>.1){
   t.dust+=dt*slip*c.width*load*(foot?.5:1.6)*dry*scale;
   while(t.dust>=1){t.dust-=1;const side=rnd()<.5?-1:1,a=side*(.5+rnd()*1.1),c2=Math.cos(a),s2=Math.sin(a);
    v.set((dir.x*c2-dir.z*s2)*slip*.35,.25+rnd()*.5,(dir.x*s2+dir.z*c2)*slip*.35);
    effects.groundDust(p.copy(front).setY(.25+rnd()*.3),v,{life:1.6+rnd()*1.4,size:.5+c.width*.3,growth:2.4+rnd()*2.4,opacity:(.28+.2*rnd())*dry,drag:1.4,rise:.12,color:rnd()<.5?0xa58f6b:0x927c5c});}
  }
  // Wet: the bow wave is muddy water, with a fine haze off the sheets.
  if(w>.05){
   mud.plough(front,dir,slip,load*(foot?.4:c.kind==='chin'?1.3:1),roadSpeed,c.width);
   if(rnd()<dt*slip*1.2*w*scale&&!foot)effects.haze(p.copy(front).setY(.35),v.set(dir.x*slip*.3,.3,dir.z*slip*.3),{life:.8+rnd()*.5,size:.4,growth:1.6,opacity:.06*w});
  }
 }
 return{
  mesh:furrows.mesh,mound,get coat(){return coat;},
  /** Share the hide's fall-mud uniform (x chin, y body, z tail, w wetness). */
  attachCoat(uniform){coat=uniform;},
  get tracks(){return tracks.filter(t=>t.points.length>1).length;},
  setQuality(t){scale=t.particles;},
  /** Show the furrow and mound while shaders precompile, so the fall never waits on one. */
  prepare(on){furrows.mesh.visible=on;mound.visible=on;},
  /** One frame of ground contacts from the fall. */
  contacts(list,dt,roadSpeed,facing){
   if(facing)heading.copy(facing);
   for(const c of list){
    const t=trackFor(c.kind);t.seen=time;
    if(c.slip>.05||t.points.length<2){addPoint(t,c);dirty=true;}
    plough(c,t,dt,roadSpeed);
    // The snout shoves a heap of soil ahead of it and ends against it.
    if(c.kind==='chin'&&c.slip>.3){
     moundState.active=true;moundState.grow=Math.min(1,moundState.grow+dt*c.slip*.11);
     moundState.dir.lerp(dir.set(c.velocity.x,0,c.velocity.z).normalize(),.2).normalize();
     moundState.p.set(c.position.x,0,c.position.z-road).addScaledVector(moundState.dir,.1);
    }
   }
  },
  /** A body part landing: chin, chest, hips or tail. */
  impact(e,roadSpeed){
   const w=WET.value,dry=1-w,s=e.strength,part=e.part,at=e.position.clone().setY(.08);
   const count=Math.round((part==='chin'?10:part==='tail'?6:16)*s*scale);
   // Along the tail the slam is a line, not a point.
   const points=part==='tail'?[0,1.3,2.6,3.9].map(k=>at.clone().addScaledVector(heading,-k)):[at];
   for(const q of points){
    for(let i=0;i<count/points.length;i++){const a=rnd()*6.283,sp=2+rnd()*4*s;v.set(Math.cos(a)*sp,2+rnd()*4*s,Math.sin(a)*sp+roadSpeed);if(part==='chin')v.addScaledVector(heading,3*s);effects.debris(rnd()<.7?'clod':'pebble',q,v,1.2+rnd());}
    for(let i=0;i<14*s*scale/points.length;i++){const a=rnd()*6.283,sp=1.5+rnd()*4;effects.speck(q,v.set(Math.cos(a)*sp,1+rnd()*3.5,Math.sin(a)*sp+roadSpeed),w>.5?[.05,.036,.025]:[.2,.15,.1],.025+rnd()*.03,.5+rnd()*.4);}
    // The air (or water) squeezed from under the body races out along the ground.
    if(dry>.1){
     const ring=Math.round((part==='chin'?6:part==='tail'?3:11)*scale*dry);
     for(let i=0;i<ring;i++){const a=i/ring*6.283+rnd()*.4,sp=(part==='chin'?3:5)+rnd()*3;v.set(Math.cos(a)*sp,.2+rnd()*.3,Math.sin(a)*sp);effects.groundDust(q.clone().add(new T.Vector3(Math.cos(a)*.6,.3,Math.sin(a)*.6)),v,{life:2+rnd()*1.5,size:.7,growth:3.5+rnd()*2.5*s,opacity:(.35+.2*rnd())*dry,drag:2.4,rise:.08,color:rnd()<.5?0xa58f6b:0x8f7a5c});}
     for(let i=0;i<(part==='tail'?1:3)*dry;i++)effects.groundDust(q.clone().setY(.5+rnd()*.5),v.set((rnd()-.5)*.8,.6+rnd()*.6,(rnd()-.5)*.8),{life:3+rnd()*1.5,size:.9,growth:3+rnd()*2,opacity:.3*dry,drag:1.2,rise:.25});
    }
    if(w>.05){mud.burst(q,Math.min(1.4,s*(part==='chin'?.9:1.2)),roadSpeed);if(part!=='chin')mud.squeeze(q,s,roadSpeed);effects.haze(q.clone().setY(.4),v.set(0,.4,0),{life:1.1,size:.6,growth:2.4,opacity:.08*w});}
   }
   // Mud and dust stick where she hits.
   if(part==='chin')coatTarget.x=1;else if(part==='tail')coatTarget.z=1;else coatTarget.y=1;
  },
  /** Her last breath, blown across the ground in front of her nostrils. */
  exhale(e){
   const w=WET.value,dir=e.direction.clone().setY(0).normalize(),at=e.position.clone();at.y=Math.max(.15,at.y*.5);
   for(let i=0;i<4*(1-w);i++)effects.groundDust(at.clone().addScaledVector(dir,.3+i*.2),v.set(dir.x*(.8+rnd()*.6)+(rnd()-.5)*.3,.12+rnd()*.15,dir.z*(.8+rnd()*.6)+(rnd()-.5)*.3),{life:1.8+rnd(),size:.25,growth:1.4+rnd(),opacity:.22*(1-w),drag:1.8,rise:.05});
   for(let i=0;i<3;i++)effects.haze(e.position.clone().addScaledVector(dir,.2),v.set(dir.x*1.2,.25+rnd()*.2,dir.z*1.2),{life:1.4+rnd()*.6,size:.2,growth:1.2,opacity:.035+.05*w,drag:1.6,rise:.15});
  },
  update(dt,roadSpeed,show=true){
   time+=dt;road+=roadSpeed*dt;
   furrows.mesh.position.z=road;furrows.mesh.visible=show&&tracks.some(t=>t.points.length>1);
   if(dirty)rebuild();
   // Mud builds on the hide over a few tenths of a second after each contact.
   coat.value.x+=(coatTarget.x-coat.value.x)*(1-Math.exp(-dt*5));coat.value.y+=(coatTarget.y-coat.value.y)*(1-Math.exp(-dt*3));coat.value.z+=(coatTarget.z-coat.value.z)*(1-Math.exp(-dt*4));coat.value.w=WET.value;
   mound.visible=show&&moundState.active&&moundState.grow>.02;
   if(mound.visible){
    const g=moundState.grow,w=WET.value;
    mound.position.set(moundState.p.x,0,moundState.p.z+road);mound.rotation.y=Math.atan2(moundState.dir.x,moundState.dir.z);
    mound.scale.set(.55+.45*g,.34*Math.sqrt(g)*(1+.3*w),.55+.45*g);
    mound.material.color.setRGB(T.MathUtils.lerp(.29,.075,w),T.MathUtils.lerp(.22,.054,w),T.MathUtils.lerp(.15,.036,w));mound.material.roughness=T.MathUtils.lerp(.95,.32,w);
   }
  },
  reset(){for(const t of tracks){t.kind=null;t.points=[];t.live=false;t.budget=t.dust=0;}moundState.active=false;moundState.grow=0;mound.visible=false;coat.value.set(0,0,0,0);coatTarget.set(0,0,0,0);road=0;dirty=true;rebuild();furrows.mesh.visible=false;}
 };
}
