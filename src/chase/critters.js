import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WET} from './weather-state.js';
// Small ground life that reacts to the chase. Compies forage in loose packs on the
// track and verges; lizards bask on verge rocks. Positions are in the Jeep's frame,
// where the ground slides past at +speed along z, so a creature standing still rides
// the road away toward the Rex. Each kind is one instanced draw: the CPU steers and
// writes a per-instance pose (gait phase, stride, head peck), and the vertex shader
// swings legs about the hips, lifts the swinging foot, sways tail and spine.
//
// Threats are the Jeep (at the origin, driving toward -z), the Rex, and alarms (her
// footfalls, bullet strikes, blasts). Prey never try to outrun either along the road;
// they dart sideways, jinking. A pack flushed by the Jeep only clears the track: it
// stops in the verge ferns, heads up. When she comes on, the far bigger threat flushes
// it again and it splits: some bolt deeper into the forest, some panic back across
// the track in front of her — the scatter the gunner (facing back) actually sees.

const TAU=Math.PI*2,MAX_COMPIES=28,MAX_LIZARDS=18;
let seed=4242;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>a+rnd()*(b-a);

// ------------------------------------------------------------------ geometry --
// Every vertex carries rig=(part, weight along the limb, side, lead) and the pivot
// its part turns about. Parts: 0 body, 1 neck and head, 2 tail, 3 leg.
function part(g,{at=[0,0,0],from,to,scale=[1,1,1],rot=[0,0,0],part:id=0,side=0,lead=1,pivot=[0,0,0],weight}){
 g=g.toNonIndexed();g.deleteAttribute('uv');
 if(from){const a=new T.Vector3(...from),b=new T.Vector3(...to),dir=b.clone().sub(a),len=dir.length();g.scale(scale[0],len,scale[2]);g.translate(0,len/2,0);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));g.translate(...from);}
 else{g.scale(...scale);g.rotateX(rot[0]);g.rotateY(rot[1]);g.translate(...at);}
 const p=g.attributes.position,n=p.count,rig=new Float32Array(n*4),piv=new Float32Array(n*3),P=new T.Vector3(...pivot);
 for(let i=0;i<n;i++){const v=new T.Vector3().fromBufferAttribute(p,i);rig.set([id,weight?weight(v,P):0,side,lead],i*4);piv.set(pivot,i*3);}
 g.setAttribute('rig',new T.BufferAttribute(rig,4));g.setAttribute('pivot',new T.BufferAttribute(piv,3));return g;
}
/** Dorsal colour on top, pale belly below, dark bands across the back and tail, dark eyes.
 *  Colours are linear. */
function paint(g,{back,belly,band=0,bands=10,speckle=0,eyes=[]}){
 const p=g.attributes.position,nn=g.attributes.normal,c=new Float32Array(p.count*3),col=new T.Color(),b=new T.Color(...back),l=new T.Color(...belly);
 for(let i=0;i<p.count;i++){const up=nn.getY(i),z=p.getZ(i),h=Math.sin(p.getX(i)*91+z*57+p.getY(i)*33)*43758.5;
  col.copy(l).lerp(b,T.MathUtils.smoothstep(up,-.35,.25));
  if(up>0)col.multiplyScalar(1-band*T.MathUtils.smoothstep(Math.sin(z*bands*TAU),.35,.8)*up);
  col.multiplyScalar(1+speckle*((h-Math.floor(h))-.5));
  for(const [ex,ey,ez,er]of eyes)if(Math.hypot(Math.abs(p.getX(i))-ex,p.getY(i)-ey,z-ez)<er)col.setRGB(.01,.008,.006);
  c.set([col.r,col.g,col.b],i*3);}
 g.setAttribute('color',new T.BufferAttribute(c,3));return g;
}
function compyGeometry(){
 const S=(w,h)=>new T.SphereGeometry(1,w,h),C=(t,b,r=7,hs=1)=>new T.CylinderGeometry(t,b,1,r,hs),parts=[];
 const neck=[0,.33,.1],hipY=.29,along=(a,len)=>(v,P)=>Math.min(1,v.distanceTo(P)/len);
 parts.push(part(S(12,10),{at:[0,.3,-.01],scale:[.074,.086,.17],rot:[-.12,0]}));
 parts.push(part(S(10,8),{at:[0,.325,.1],scale:[.058,.068,.085],rot:[-.4,0]}));
 parts.push(part(C(.028,.046,8),{from:[0,.33,.1],to:[0,.43,.22],part:1,pivot:neck,weight:along(0,.2)}));
 parts.push(part(S(10,8),{at:[0,.452,.265],scale:[.034,.038,.062],rot:[.2,0],part:1,pivot:neck,weight:()=>1}));
 parts.push(part(C(.013,.026,7),{from:[0,.447,.3],to:[0,.43,.365],part:1,pivot:neck,weight:()=>1}));
 parts.push(part(C(.004,.058,8,8),{from:[0,.305,-.12],to:[0,.235,-.68],part:2,pivot:[0,.3,-.1],weight:along(0,.58)}));
 for(const s of [-1,1]){
  const hip=[s*.05,hipY,.02],knee=[s*.06,.175,.075],ankle=[s*.058,.06,-.005],toe=[s*.058,.006,.055],w=v=>Math.min(1,(hipY-v.y)/hipY);
  // Drumstick thigh, slim shin, long foot.
  parts.push(part(C(.024,.044,8),{from:hip,to:knee,part:3,side:s,pivot:hip,weight:w}));
  parts.push(part(C(.013,.021,6),{from:knee,to:ankle,part:3,side:s,pivot:hip,weight:w}));
  parts.push(part(C(.009,.013,5),{from:ankle,to:toe,part:3,side:s,pivot:hip,weight:w}));
  parts.push(part(C(.006,.009,4),{from:[s*.035,.3,.11],to:[s*.045,.25,.15]}));
 }
 return paint(mergeGeometries(parts),{back:[.1,.085,.042],belly:[.36,.31,.2],band:.55,bands:8,speckle:.25,eyes:[[.03,.462,.275,.012]]});
}
function lizardGeometry(){
 const S=(w,h)=>new T.SphereGeometry(1,w,h),C=(t,b,r=6,hs=1)=>new T.CylinderGeometry(t,b,1,r,hs),parts=[];
 parts.push(part(S(10,6),{at:[0,.05,0],scale:[.04,.025,.105]}));
 parts.push(part(S(8,6),{at:[0,.056,.135],scale:[.024,.018,.048],part:1,pivot:[0,.05,.09],weight:()=>1}));
 parts.push(part(C(.003,.026,6,6),{from:[0,.047,-.09],to:[0,.018,-.43],part:2,pivot:[0,.047,-.08],weight:(v,P)=>Math.min(1,v.distanceTo(P)/.35)}));
 for(const s of [-1,1])for(const [z,lead]of [[.065,1],[-.07,-1]]){
  const root=[s*.028,.046,z],elbow=[s*.078,.042,z+.012*lead],foot=[s*.09,.004,z+.03*lead],w=(v,P)=>Math.min(1,v.distanceTo(P)/.1);
  parts.push(part(C(.008,.011,5),{from:root,to:elbow,part:3,side:s,lead,pivot:root,weight:w}));
  parts.push(part(C(.005,.008,5),{from:elbow,to:foot,part:3,side:s,lead,pivot:root,weight:w}));
 }
 return paint(mergeGeometries(parts),{back:[.07,.06,.032],belly:[.3,.27,.17],band:.35,bands:14,speckle:.6,eyes:[[.02,.063,.15,.008]]});
}

// -------------------------------------------------------------------- shader --
// aPose: x gait phase (0..1, wrapped on the CPU), y stride 0..1, z head peck (compy)
// or push-up display (lizard), w unused. Every input stays small for mobile GPUs.
const GAIT=lizard=>`
 {
  float part=rig.x,w=rig.y,side=rig.z,lead=rig.w,th=aPose.x*6.2832,amp=aPose.y;
  vec3 q=transformed-pivot;
  float ph=th+(side*lead>0.?0.:3.1416);
  ${lizard?`
  // Sprawling legs sweep fore and aft about the shoulder, diagonal pairs together;
  // the spine throws a travelling S-bend that grows down the tail.
  if(part>2.5){float a=-side*amp*sin(ph)*.85;q.xz=vec2(cos(a)*q.x-sin(a)*q.z,sin(a)*q.x+cos(a)*q.z);q.y+=max(0.,cos(ph))*w*amp*.03;}
  if(part>.5&&part<1.5){float a=aPose.z*.35;q.zy=vec2(cos(a)*q.z-sin(a)*q.y,sin(a)*q.z+cos(a)*q.y);}
  transformed=pivot+q;
  float zz=part>2.5?pivot.z:transformed.z;
  transformed.x+=amp*sin(th*2.-zz*11.)*(.012+max(0.,-zz)*.09);
  transformed.y+=aPose.z*.012*(1.+zz*6.);`:`
  // Bird-like legs swing about the hip in antiphase, lifting the foot on the forward swing.
  if(part>2.5){float a=amp*sin(ph)*.72;q.zy=vec2(cos(a)*q.z-sin(a)*q.y,sin(a)*q.z+cos(a)*q.y);q.y+=max(0.,cos(ph))*w*w*amp*.07;}
  // Neck and head dip to peck and nod with each stride; the tail counter-sways.
  if(part>.5&&part<1.5){float a=-aPose.z*1.05-amp*.07*sin(th*2.);q.zy=vec2(cos(a)*q.z-sin(a)*q.y,sin(a)*q.z+cos(a)*q.y);}
  if(part>1.5&&part<2.5){float a=amp*.22*w*sin(th);q.xz=vec2(cos(a)*q.x-sin(a)*q.z,sin(a)*q.x+cos(a)*q.z);q.y+=w*w*amp*.03*cos(th*2.);}
  transformed=pivot+q;
  if(part<2.5)transformed.y+=amp*.018*cos(th*2.);`}
 }`;
function critterMaterial(lizard){
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:lizard?.55:.7});
 const vertex=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 rig;attribute vec3 pivot;attribute vec4 aPose;').replace('#include <begin_vertex>','#include <begin_vertex>'+GAIT(lizard));};
 m.onBeforeCompile=s=>{s.uniforms.uWet=WET;vertex(s);
  // Rain darkens the hide a little and gives it a wet sheen.
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uWet;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.-uWet*.25;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=1.-uWet*.5;');};
 m.customProgramCacheKey=()=>`rex-critter-${lizard?'lizard':'compy'}-v1`;
 // Shadows step with the legs too.
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});depth.onBeforeCompile=vertex;depth.customProgramCacheKey=()=>`rex-critter-depth-${lizard?'lizard':'compy'}-v1`;
 return{material:m,depth};
}

// --------------------------------------------------------------------- system --
export function createCritters(scene,{jungle}){
 const kinds={compy:{geometry:compyGeometry(),max:MAX_COMPIES,...critterMaterial(false)},lizard:{geometry:lizardGeometry(),max:MAX_LIZARDS,...critterMaterial(true)}};
 for(const [name,k]of Object.entries(kinds)){
  k.pose=new T.InstancedBufferAttribute(new Float32Array(k.max*4),4);k.pose.setUsage(T.DynamicDrawUsage);k.geometry.setAttribute('aPose',k.pose);
  k.mesh=new T.InstancedMesh(k.geometry,k.material,k.max);k.mesh.customDepthMaterial=k.depth;k.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  k.mesh.castShadow=true;k.mesh.receiveShadow=true;k.mesh.frustumCulled=false;k.mesh.count=0;k.mesh.name=name==='compy'?'Compy pack':'Basking lizards';
  k.mesh.setColorAt(0,new T.Color(1,1,1));scene.add(k.mesh);
  k.pool=Array.from({length:k.max},()=>({on:false,p:new T.Vector3(),v:new T.Vector3(),want:new T.Vector3(),yaw:0,roll:0,phase:0,peck:0,peckTime:0,state:'idle',timer:0,run:6,cover:10,startle:9,dir:1,jink:0,scale:1,fade:1,tint:new T.Color(),pack:0,alarmAt:-1,perchY:0,onRock:false,hop:0}));
 }
 const C=kinds.compy,L=kinds.lizard,alarms=[],m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),s=new T.Vector3(),pos=new T.Vector3();
 let travel=0,nextPack=40,packId=0,density=1,now=0,chunkZ=[],api;

 function free(k){return k.pool.find(c=>!c.on);}
 function spawnPack(x,z,n=5,{flee=false,cross=false,verge=Math.abs(x)>4.3}={}){
  const id=++packId,base=range(3,8),out=[];
  for(let i=0;i<n;i++){const c=free(C);if(!c)break;
   Object.assign(c,{on:true,state:'idle',timer:range(.1,1.5),run:range(5.5,8.5),cover:range(8.5,13),startle:verge?range(2,4):base+range(-1.5,1.5),dir:1,jink:0,scale:range(.9,1.25),fade:1,pack:id,alarmAt:-1,peck:0,peckTime:0,phase:rnd(),yaw:rnd()*TAU,roll:0,onRock:false,hop:0,verge,cross:cross||rnd()<.3});
   c.p.set(x+range(-1,1)*(1+n*.12),0,z+range(-1,1)*(1+n*.15));c.v.set(0,0,0);c.tint.setRGB(range(.85,1.12),range(.88,1.1),range(.8,1.05));out.push(c);
   if(flee)c.alarmAt=now+i*.06;
  }
  return out.length;
 }
 function spawnLizard(x,y,z){
  const c=free(L);if(!c)return false;
  Object.assign(c,{on:true,state:'idle',timer:range(.5,3),run:range(3.5,5),cover:Math.abs(x)+range(2.5,5),startle:range(5,9),dir:Math.sign(x)||1,jink:0,scale:range(1,1.35),fade:1,pack:0,alarmAt:-1,peck:0,peckTime:0,phase:rnd(),yaw:rnd()*TAU,roll:0,onRock:y>.05,perchY:y,hop:0});
  c.p.set(x,y,z);c.v.set(0,0,0);
  // Green anoles and brown skinks.
  const g=rnd()<.4;c.tint.setRGB(g?.7:range(.95,1.2),g?1.35:range(.9,1.05),g?.6:range(.8,.95));return true;
 }
 function populatePerches(chunk,chance){for(const pr of chunk.perches||[])if(rnd()<chance)spawnLizard(pr.x,pr.y,pr.z+chunk.group.position.z);}

 function flee(c,k,tx,tz,from){
  if(c.state==='flee'||c.state==='hide')return;
  const second=c.state==='wary',out=Math.sign(c.p.x)||1;
  let dir=Math.abs(c.p.x-tx)<.3?(rnd()<.5?-1:1):Math.sign(c.p.x-tx);
  // Some cut across the track instead of taking the near verge.
  if(from==='jeep'&&c.cross&&Math.abs(c.p.x)<2.8)dir=-out;
  if(k===L)dir=out;
  // Flushed from the track, a compy only makes the near verge and watches from there.
  c.stopAt=k===C&&!second&&(from==='jeep'||from==='pack')?range(5,6.8):0;
  if(second){dir=rnd()<.55?-out:out;c.cover=dir===out?Math.abs(c.p.x)+range(2.5,4):range(7,11);c.run*=1.1;}
  c.state='flee';c.dir=dir;c.timer=0;c.alarmAt=-1;c.jink=range(.12,.3);c.away=Math.sign(c.p.z-tz)||-1;
  if(k===L&&c.onRock){c.hop=.18;}
  // Alarm spreads through the pack a beat later.
  if(k===C)for(const o of C.pool)if(o.on&&o.pack===c.pack&&(o.state==='idle'||o.state==='wary')&&o.alarmAt<0)o.alarmAt=now+range(.06,.3);
  if(k===C&&api.onScatter&&now-(api.lastCall||-9)>1.4){api.lastCall=now;api.onScatter(pos.set(c.p.x,.3,c.p.z));}
 }
 function step(k,c,dt,speed,rex){
  // ---- sense
  if(c.state==='idle'||c.state==='wary'){
   if(c.alarmAt>=0&&now>=c.alarmAt)flee(c,k,0,-1,'pack');
   const ahead=-c.p.z,lateral=Math.abs(c.p.x);
   if(c.state==='idle'){if(k===C){if(ahead>-.5&&ahead<c.startle&&lateral<(c.verge?4.8:5.8))flee(c,k,0,0,'jeep');}
   else if(ahead>-3&&ahead<c.startle*.6&&lateral<7.5)flee(c,k,0,0,'jeep');}
   // A charging Rex spooks them from farther off than a walking one.
   if(rex){const dx=c.p.x-rex.x,dz=c.p.z-rex.z,r=(k===C?6:7)+speed*.5;if(dx*dx+dz*dz<r*r)flee(c,k,rex.x,rex.z,'rex');}
   for(const a of alarms){const dx=c.p.x-a.x,dz=c.p.z-a.z;if(dx*dx+dz*dz<a.r*a.r){flee(c,k,a.x,a.z,'alarm');break;}}
  }
  // ---- decide (ground frame)
  if(c.state==='wary'){c.want.set(0,0,0);c.peck=Math.max(0,c.peck-dt*6);c.timer+=dt;if(c.timer>7){c.state='hide';c.timer=0;}}
  else if(c.state==='idle'){
   c.timer-=dt;
   if(c.timer<=0){const r=rnd();
    if(k===C){if(r<.45){c.peckTime=.34;c.want.set(0,0,0);}else if(r<.85){const a=c.yaw+range(-1.4,1.4),sp=range(.35,.9);c.want.set(Math.sin(a)*sp,0,Math.cos(a)*sp);}else c.want.set(0,0,0);c.timer=range(.35,1.4);}
    else{if(r<.3)c.peckTime=.9;c.want.set(0,0,0);if(r>.85)c.yaw+=range(-.8,.8);c.timer=range(1,3.5);}
   }
   if(c.peckTime>0){c.peckTime-=dt;const u=1-c.peckTime/(k===C?.34:.9);c.peck=k===C?Math.sin(Math.min(1,u)*Math.PI):Math.max(0,Math.sin(u*TAU*2))*(u<1?1:0);}else c.peck=Math.max(0,c.peck-dt*6);
  }else{
   c.timer+=dt;c.jink-=dt;c.peck=Math.max(0,c.peck-dt*8);
   if(c.jink<=0){c.jink=range(.18,.45);c.swerve=k===C?range(-.55,.55):range(-.25,.25);}
   const lat=c.dir,fwd=c.away*.3;let ax=lat*Math.cos(c.swerve||0)-fwd*Math.sin(c.swerve||0),az=lat*Math.sin(c.swerve||0)+fwd*Math.cos(c.swerve||0);const l=Math.hypot(ax,az)||1;
   c.want.set(ax/l*c.run,0,az/l*c.run);
   if(c.state==='flee'&&(Math.abs(c.p.x)>(c.stopAt||c.cover)||c.timer>(k===C?3.2:1.6))){c.state=c.stopAt?'wary':'hide';c.timer=0;c.stopAt=0;}
   if(c.state==='hide'){c.fade-=dt*5;if(c.fade<=0){c.on=false;return;}}
  }
  // ---- move: quick acceleration toward the wanted ground velocity; the road carries it
  const accel=c.state==='idle'?6:c.state==='wary'?14:k===C?28:22;
  c.v.x+=T.MathUtils.clamp(c.want.x-c.v.x,-accel*dt,accel*dt);c.v.z+=T.MathUtils.clamp(c.want.z-c.v.z,-accel*dt,accel*dt);
  if(c.hop>0){c.hop-=dt;if(c.hop<=0)c.onRock=false;}
  c.p.x+=c.v.x*dt;c.p.z+=(c.v.z+speed)*dt;
  // Nothing passes through the Jeep: a late runner squeezes past outside the wheels.
  if(Math.abs(c.p.x)<1.3&&c.p.z>-2.5&&c.p.z<2.5)c.p.x=(c.dir||Math.sign(c.p.x)||1)*1.3;
  const ground=jungle.groundAt(c.p.x,c.p.z),gs=Math.hypot(c.v.x,c.v.z);
  c.p.y=c.onRock?(c.hop>0?T.MathUtils.lerp(ground,c.perchY,c.hop/.18)+Math.sin(c.hop/.18*Math.PI)*.08:c.perchY):ground;
  if(gs>.15){const target=Math.atan2(c.v.x,c.v.z);let d=target-c.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));const turn=T.MathUtils.clamp(d,-14*dt,14*dt);c.yaw+=turn;c.roll+=(T.MathUtils.clamp(-turn/dt*.035,-.35,.35)-c.roll)*Math.min(1,dt*10);}
  c.yaw=Math.atan2(Math.sin(c.yaw),Math.cos(c.yaw));
  // Stride lengthens with speed, so cadence rises more slowly than pace.
  const stride=k===C?.42+gs*.13:.16+gs*.07;c.phase=(c.phase+dt*gs/stride)%1;
  c.stride=Math.min(1,.28*Math.min(1,gs/.5)+.72*Math.min(1,gs/(k===C?7:4.5)));
  if(c.p.z>80||c.p.z<-140||Math.abs(c.p.x)>30)c.on=false;
 }
 function write(k){
  let n=0;const P=k.pose.array;
  for(const c of k.pool){if(!c.on)continue;
   e.set(-(c.stride||0)*(k===C?.1:0),c.yaw,c.roll);q.setFromEuler(e);const sc=c.scale*Math.max(0,Math.min(1,c.fade));
   m.compose(pos.set(c.p.x,c.p.y,c.p.z),q,s.setScalar(sc));k.mesh.setMatrixAt(n,m);k.mesh.setColorAt(n,c.tint);
   P[n*4]=c.phase;P[n*4+1]=c.stride||0;P[n*4+2]=c.peck;P[n*4+3]=0;n++;}
  k.mesh.count=n;if(n){k.mesh.instanceMatrix.needsUpdate=true;k.mesh.instanceColor.needsUpdate=true;k.pose.needsUpdate=true;}
 }

 api={
  compies:C.mesh,lizards:L.mesh,onScatter:null,
  setQuality(t){density=Math.min(1,t.fauna??t.particles);for(const k of [C,L])k.mesh.castShadow=!!t.detail;},
  /** The world is already alive when a scene begins: lizards on nearby rocks and a pack foraging in view. */
  reset({intro=false}={}){for(const k of [C,L]){for(const c of k.pool)c.on=false;k.mesh.count=0;}travel=0;nextPack=range(20,45);alarms.length=0;chunkZ=[];
   for(const chunk of jungle.chunks){const z=chunk.group.position.z;if(z>-70&&z<70)populatePerches(chunk,.45*density);}
   // In the opening, a pack pecks on the shoulder in view until her roar scatters it.
   if(intro)spawnPack(-2,9,Math.max(3,Math.round(5*density)));else spawnPack(2.4,4,4);},
  /** Startle anything within radius of a point (footfalls, bullet strikes, blasts). */
  alarm(p,r=8){if(alarms.length<16)alarms.push({x:p.x,z:p.z,r});},
  spawnPack,spawnLizardNear(x,z){const c=jungle.chunks.flatMap(ch=>(ch.perches||[]).map(p=>({x:p.x,y:p.y,z:p.z+ch.group.position.z}))).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];return c?spawnLizard(c.x,c.y,c.z):false;},
  stats(){return{compies:C.mesh.count,lizards:L.mesh.count};},
  /**
   * @param spawn allow new packs and basking lizards (not during the opening or after the chase)
   * @param rex {x,z} of her body in the Jeep frame, or null
   */
  update(dt,{speed=0,rex=null,visible=true,spawn=true}={}){
   now+=dt;for(const k of [C,L])k.mesh.visible=visible;
   if(!visible||dt<=0){alarms.length=0;return;}
   if(spawn){
    // Packs turn up per distance travelled, just beyond the bumper's view ahead.
    travel+=speed*dt;
    if(travel>=nextPack){const road=rnd()<.62,x=road?range(-3.2,3.2):(rnd()<.5?-1:1)*range(4.6,7),z=speed>4?-range(46,60):-range(9,14);spawnPack(x,z,Math.max(2,Math.round(range(3,7)*density)),{verge:!road});nextPack=travel+(speed>4?range(40,95):range(14,30))/Math.max(.35,density);}
    // Lizards settle on the rocks of each chunk as it comes up the road.
    jungle.chunks.forEach((chunk,i)=>{const z=chunk.group.position.z,was=chunkZ[i];if(was!==undefined&&was<-52&&z>=-52)populatePerches(chunk,.45*density);chunkZ[i]=z;});
   }
   for(const k of [C,L])for(const c of k.pool)if(c.on)step(k,c,dt,speed,rex);
   alarms.length=0;write(C);write(L);
  }
 };
 api.reset();
 return api;
}
