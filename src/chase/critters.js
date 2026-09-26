import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WET} from './weather-state.js';
import {SPECIES} from './safari-rules.js';
import {loadSafariModels} from './safari-models.js';
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
//
// Compies can be shot. A round (or a grenade's blast) throws one along the shot and up;
// it tumbles end over end about its body centre, bounces, slides and settles on its
// side with its legs drawn up, and the road carries it away. When the Rex breaks off
// into the trees, `stream()` flushes a file of them out of the verge on her side and
// across the road behind the Jeep, the gunner's targets while she is out of sight.
// Lizards can be shot too. A Gallimimus herd (`herd()`, once or twice a chase) streams
// across the road behind her at a gallop; a shot one crashes at full speed and rolls.

const TAU=Math.PI*2,MAX_COMPIES=28,MAX_LIZARDS=18,MAX_GALLI=12;
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
/** Gallimimus, built on the compy's rig (hips at 0.3) and scaled up about 5.5 times: a deep
 *  short body, a long S-curved neck with a small beaked head held high, a long level tail and
 *  long running legs. */
function gallimimusGeometry(){
 const S=(w,h)=>new T.SphereGeometry(1,w,h),C=(t,b,r=8,hs=1)=>new T.CylinderGeometry(t,b,1,r,hs),parts=[];
 const neck=[0,.35,.13],hipY=.31,along=len=>(v,P)=>Math.min(1,v.distanceTo(P)/len);
 // Deep body and chest; at a gallop the slender neck reaches forward and up, the head level.
 parts.push(part(S(12,10),{at:[0,.33,-.01],scale:[.075,.088,.155],rot:[-.1,0]}));
 parts.push(part(S(10,8),{at:[0,.34,.1],scale:[.058,.07,.075],rot:[-.3,0]}));
 parts.push(part(C(.02,.034,8),{from:[0,.36,.13],to:[0,.44,.22],part:1,pivot:neck,weight:along(.3)}));
 parts.push(part(C(.015,.02,8),{from:[0,.44,.22],to:[0,.5,.3],part:1,pivot:neck,weight:along(.3)}));
 parts.push(part(S(10,8),{at:[0,.515,.33],scale:[.018,.02,.034],rot:[.15,0],part:1,pivot:neck,weight:()=>1}));
 parts.push(part(C(.004,.011,7),{from:[0,.51,.355],to:[0,.5,.395],part:1,pivot:neck,weight:()=>1}));
 parts.push(part(C(.004,.045,8,8),{from:[0,.32,-.14],to:[0,.31,-.62],part:2,pivot:[0,.32,-.1],weight:along(.5)}));
 for(const s of [-1,1]){
  // Muscular thighs, slim shins, long feet.
  const hip=[s*.05,hipY,.02],knee=[s*.06,.2,.08],ankle=[s*.055,.07,-.02],toe=[s*.055,.005,.05],w=v=>Math.min(1,(hipY-v.y)/hipY);
  parts.push(part(C(.032,.06,8),{from:hip,to:knee,part:3,side:s,pivot:hip,weight:w}));
  parts.push(part(C(.016,.028,6),{from:knee,to:ankle,part:3,side:s,pivot:hip,weight:w}));
  parts.push(part(C(.01,.015,5),{from:ankle,to:toe,part:3,side:s,pivot:hip,weight:w}));
  parts.push(part(C(.005,.009,4),{from:[s*.04,.32,.13],to:[s*.045,.27,.16]}));
 }
 return paint(mergeGeometries(parts),{back:[.15,.105,.06],belly:[.42,.35,.24],band:.4,bands:7,speckle:.18,eyes:[[.016,.52,.34,.006]]});
}

// -------------------------------------------------------------------- shader --
// aPose: x gait phase (0..1, wrapped on the CPU), y stride 0..1, z head peck (compy)
// or push-up display (lizard), w death curl (compy). Every input stays small for mobile GPUs.
const GAIT=lizard=>`
 {
  float part=rig.x,w=rig.y,side=rig.z,lead=rig.w,th=aPose.x*6.2832,amp=aPose.y;
  vec3 q=transformed-pivot;
  float ph=th+(side*lead>0.?0.:3.1416);
  ${lizard?`
  // Sprawling legs sweep fore and aft about the shoulder, diagonal pairs together;
  // the spine throws a travelling S-bend that grows down the tail.
  if(part>2.5){float a=-side*amp*sin(ph)*.85;q.xz=vec2(cos(a)*q.x-sin(a)*q.z,sin(a)*q.x+cos(a)*q.z);q.y+=max(0.,cos(ph))*w*amp*.03+aPose.w*w*.05;}
  if(part>1.5&&part<2.5){float a=aPose.w*.9*w;q.xz=vec2(cos(a)*q.x-sin(a)*q.z,sin(a)*q.x+cos(a)*q.z);}
  if(part>.5&&part<1.5){float a=aPose.z*.35;q.zy=vec2(cos(a)*q.z-sin(a)*q.y,sin(a)*q.z+cos(a)*q.y);}
  transformed=pivot+q;
  float zz=part>2.5?pivot.z:transformed.z;
  transformed.x+=amp*sin(th*2.-zz*11.)*(.012+max(0.,-zz)*.09);
  transformed.y+=aPose.z*.012*(1.+zz*6.);`:`
  // Bird-like legs swing about the hip in antiphase, lifting the foot on the forward swing.
  // Dead (aPose.w), the legs draw up toward the chest, the head falls back and the tail curls.
  float dead=aPose.w;
  if(part>2.5){float a=amp*sin(ph)*.72+dead*(lead<0.?-.7:1.15+side*.2);q.zy=vec2(cos(a)*q.z-sin(a)*q.y,sin(a)*q.z+cos(a)*q.y);q.y+=max(0.,cos(ph))*w*w*amp*.07*(1.-dead);}
  // Neck and head dip to peck and nod with each stride; the tail counter-sways.
  if(part>.5&&part<1.5){float a=-aPose.z*1.05-amp*.07*sin(th*2.)+dead*.75;q.zy=vec2(cos(a)*q.z-sin(a)*q.y,sin(a)*q.z+cos(a)*q.y);}
  if(part>1.5&&part<2.5){float a=amp*.22*w*sin(th)+dead*.45*w;q.xz=vec2(cos(a)*q.x-sin(a)*q.z,sin(a)*q.x+cos(a)*q.z);q.y+=w*w*amp*.03*cos(th*2.);}
  transformed=pivot+q;
  if(part<2.5)transformed.y+=amp*.018*cos(th*2.);`}
 }`;
function critterMaterial(lizard,detail=false){
 const m=new T.MeshStandardMaterial({vertexColors:true,roughness:lizard?.55:.7});
 const vertex=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 rig;attribute vec3 pivot;attribute vec4 aPose;').replace('#include <begin_vertex>','#include <begin_vertex>'+GAIT(lizard)+(detail?'\ntransformed=mix(position,transformed,smoothstep(0.,.24,rig.y));':''));};
 m.onBeforeCompile=s=>{s.uniforms.uWet=WET;vertex(s);
  if(detail){
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHide;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHide=position;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHide;');
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    vec3 cell=fract(vHide*155.);float scaleBump=smoothstep(.15,.48,length(cell-.5));roughnessFactor=clamp(roughnessFactor+scaleBump*.12,.55,.92);`);
   s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 dx=dFdx(vViewPosition),dy=dFdy(vViewPosition);float h=length(fract(vHide*155.)-.5)*.00055;
    vec3 r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);
    normal=normalize(abs(det)*normal-sign(det)*(dFdx(h)*r1+dFdy(h)*r2));`);
  }
  // Rain darkens the hide a little and gives it a wet sheen.
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uWet;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=1.-uWet*.25;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=1.-uWet*.5;');};
 m.customProgramCacheKey=()=>`rex-critter-${lizard?'lizard':'compy'}-${detail}-v4`;
 // Shadows step with the legs too.
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});depth.onBeforeCompile=vertex;depth.customProgramCacheKey=()=>`rex-critter-depth-${lizard?'lizard':'compy'}-${detail}-v4`;
 return{material:m,depth};
}

// --------------------------------------------------------------------- system --
export function createCritters(scene,{jungle}){
 // Per species: body centre height and hit radius (model units, before scale), the hull the
 // dead body rests on, fall gravity, whether it is heavy (keeps its momentum when shot and
 // skids), running lean, stride (m per gait cycle: a + b x speed), full-stride speed,
 // acceleration and jink.
 const hull=a=>a.map(p=>new T.Vector3(...p));
 const kinds={
  compy:{name:'compy',label:'Compy pack',geometry:compyGeometry(),max:MAX_COMPIES,...critterMaterial(false),centre:.3,hitR:.3,gravity:13,heavy:false,lean:.1,stride:[.42,.13],fullRun:7,accel:28,swerve:.55,
   hull:hull([[.06,-.3,.05],[-.06,-.3,.05],[0,-.09,0],[0,.09,0],[0,.15,.36],[0,-.06,-.68],[.075,0,0],[-.075,0,0],[0,.02,.2],[0,0,-.3]])},
  lizard:{name:'lizard',label:'Basking lizards',geometry:lizardGeometry(),max:MAX_LIZARDS,...critterMaterial(true),centre:.045,hitR:.14,gravity:13,heavy:false,lean:0,stride:[.16,.07],fullRun:4.5,accel:22,swerve:.25,
   hull:hull([[0,-.022,0],[0,.02,0],[0,.005,.18],[0,-.03,-.43],[.04,0,0],[-.04,0,0],[.09,-.04,.1],[-.09,-.04,.1],[.09,-.04,-.1],[-.09,-.04,-.1]])},
  galli:{name:'gallimimus',label:'Gallimimus herd',geometry:gallimimusGeometry(),max:MAX_GALLI,...critterMaterial(false),centre:.31,hitR:.21,gravity:11,heavy:true,lean:.08,stride:[2.2,.16],fullRun:12,accel:18,swerve:.12,
   hull:hull([[.055,-.31,.05],[-.055,-.31,.05],[0,-.09,0],[0,.1,0],[0,.215,.33],[0,.2,.395],[0,.01,-.62],[.075,0,0],[-.075,0,0],[0,.14,.22],[.06,-.11,.08],[-.06,-.11,.08]])},
 };
 // Baked Safari sculpts (safari-models.js), on the same rig. Centre, hull and hit spheres come
 // with the models; these are the running characters. Quadrupeds swing their legs less.
 const BAKED={
  raptor:{max:8,stride:[1.5,.15],swerve:.3,accel:22},
  dilophosaurus:{max:4,stride:[1.9,.16],swerve:.14},
  parasaurolophus:{max:4,stride:[2.4,.16],swerve:.1,accel:15},
  pachycephalosaurus:{max:4,stride:[1.8,.15],swerve:.5,accel:20},
  triceratops:{max:3,stride:[2.6,.2],swerve:.05,accel:10,lean:.015,swing:.62,quad:true,fullRun:9},
  stegosaurus:{max:3,stride:[2.4,.2],swerve:.05,accel:9,lean:.01,swing:.56,quad:true,fullRun:8},
 };
 for(const [name,o]of Object.entries(BAKED))kinds[name]={...kinds.galli,name,label:SPECIES[name].name,geometry:new T.BufferGeometry(),...critterMaterial(false,true),hitR:.2,...o,baked:true};
 for(const [name,k]of Object.entries(kinds)){
  k.pose=new T.InstancedBufferAttribute(new Float32Array(k.max*4),4);k.pose.setUsage(T.DynamicDrawUsage);k.geometry.setAttribute('aPose',k.pose);
  k.mesh=new T.InstancedMesh(k.geometry,k.material,k.max);k.mesh.customDepthMaterial=k.depth;k.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  k.mesh.castShadow=true;k.mesh.receiveShadow=true;k.mesh.frustumCulled=false;k.mesh.count=0;k.mesh.name=k.label;
  k.mesh.setColorAt(0,new T.Color(1,1,1));scene.add(k.mesh);
  k.swing??=1;k.pool=Array.from({length:k.max},()=>({on:false,flinch:0,flinchSide:1,p:new T.Vector3(),v:new T.Vector3(),want:new T.Vector3(),yaw:0,roll:0,phase:0,peck:0,peckTime:0,state:'idle',timer:0,run:6,cover:10,startle:9,dir:1,jink:0,scale:1,fade:1,tint:new T.Color(),pack:0,alarmAt:-1,perchY:0,onRock:false,hop:0,
   goal:null,vy:0,q:new T.Quaternion(),spin:new T.Vector3(),curl:0,twitch:0,age:0,grounded:false,landed:false,kind:k}));
 }
 const C=kinds.compy,L=kinds.lizard,G=kinds.galli,ALL=Object.values(kinds),alarms=[],queue=[],m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),s=new T.Vector3(),pos=new T.Vector3();
 const centre=new T.Vector3(),push=new T.Vector3(),turn=new T.Quaternion(),axis=new T.Vector3(),probe=new T.Vector3(),settle=new T.Quaternion(),toCentre=new T.Vector3();
 let travel=0,nextPack=40,nextHerd=300,packId=0,density=1,now=0,chunkZ=[],api;
 const tally={kills:0};
 let modelTier='high',models=null,modelError=null;
 function selectModels(){if(!models)return;for(const name of Object.keys(BAKED)){const k=kinds[name];k.mesh.geometry=models[name][modelTier];k.geometry=k.mesh.geometry;}}
 const modelLoad=loadSafariModels().then(loaded=>{models=loaded.models;for(const name of Object.keys(BAKED)){const k=kinds[name],sp=loaded.species[name];k.geometry.dispose();for(const g of Object.values(models[name]))g.setAttribute('aPose',k.pose);
   k.centre=sp.centre;k.hull=hull(sp.hull);k.spheres=sp.spheres.map(([x,y,z,r])=>({p:new T.Vector3(x,y,z),r}));k.hitR=sp.spheres[0][3];}selectModels();}).catch(e=>{modelError=e;});
 // Safari names that share a kind: the ghost raptor and the golden compy are rare colourings.
 const ALIAS={ghostRaptor:'raptor',goldenCompy:'compy'},SIZE={compy:1.5,goldenCompy:1.35,lizard:2.4,gallimimus:5.5,raptor:3.8,ghostRaptor:4.1,dilophosaurus:5.2,parasaurolophus:7.5,pachycephalosaurus:4.6,triceratops:7.8,stegosaurus:8.5},
  RUN={compy:6,goldenCompy:11.5,lizard:4.3,gallimimus:9.8,raptor:10.3,ghostRaptor:13.5,dilophosaurus:8.8,parasaurolophus:8.4,pachycephalosaurus:9.2,triceratops:7.4,stegosaurus:6.4};

 function free(k){const c=k.pool.find(c=>!c.on);if(c){c.hp=1;c.species=k.name;c.swerveMax=null;c.base=0;c.flinch=0;}return c;}
 function huntSpawn(name,side,z){
  const k=ALL.find(k=>k.name===(ALIAS[name]||name)),c=k&&free(k);if(!c)return null;const run=RUN[name];
  // Big animals slant harder toward the Jeep, so they hold their distance while they cross.
  Object.assign(c,{on:true,species:name,hp:SPECIES[name].hp,state:'flee',timer:0,run,base:run,cover:13,startle:0,dir:-side,jink:.3,swerve:0,swerveMax:name==='goldenCompy'?.8:null,scale:SIZE[name]*range(.94,1.06),fade:1,pack:-3,alarmAt:-1,peck:0,peckTime:0,phase:rnd(),yaw:Math.atan2(-side,-.8),roll:0,onRock:false,hop:0,verge:true,cross:false,stopAt:0,goal:-side*(k.quad?14:12),away:k.quad?-3.4:-2.7,curl:0,stride:1,flinch:0});
  c.p.set(side*(k.quad?9:7.5),0,z);c.v.set(-side*run*.78,0,-run*.63);c.tint.setRGB(1,1,1);
  if(name==='ghostRaptor')c.tint.setRGB(2.8,3.6,4.5);
  if(name==='goldenCompy')c.tint.setRGB(4.2,3.1,.9);
  if(api.onCall)api.onCall(c.p,name);else(k===C||k===L?api.onScatter:api.onHerd)?.(c.p);return c;
 }
 /** A round that does not kill: the animal flinches away from the shot and runs harder. */
 function strike(c,dir,power=1,damage=1){if(!c?.on||c.state==='dead'||c.state==='hide')return false;c.hp=(c.hp??1)-damage;
  if(c.hp>0){c.peckTime=.12;c.flinch=1;c.flinchSide=Math.sign(Math.sin(c.yaw)*dir.z-Math.cos(c.yaw)*dir.x)||1;if(c.base)c.run=Math.min(c.base*1.3,c.run*1.07);return false;}return kill(c,dir,power);}
 function spawnPack(x,z,n=5,{flee=false,cross=false,verge=Math.abs(x)>4.3}={}){
  const id=++packId,base=range(3,8),out=[];
  for(let i=0;i<n;i++){const c=free(C);if(!c)break;
   Object.assign(c,{on:true,state:'idle',timer:range(.1,1.5),run:range(5.5,8.5),cover:range(8.5,13),startle:verge?range(2,4):base+range(-1.5,1.5),dir:1,jink:0,scale:range(.9,1.25),fade:1,pack:id,alarmAt:-1,peck:0,peckTime:0,phase:rnd(),yaw:rnd()*TAU,roll:0,onRock:false,hop:0,verge,cross:cross||rnd()<.3,goal:null,curl:0});
   c.p.set(x+range(-1,1)*(1+n*.12),0,z+range(-1,1)*(1+n*.15));c.v.set(0,0,0);c.tint.setRGB(range(.85,1.12),range(.88,1.1),range(.8,1.05));out.push(c);
   if(flee)c.alarmAt=now+i*.06;
  }
  return out.length;
 }
 function spawnLizard(x,y,z){
  const c=free(L);if(!c)return false;
  Object.assign(c,{on:true,state:'idle',timer:range(.5,3),run:range(3.5,5),cover:Math.abs(x)+range(2.5,5),startle:range(5,9),dir:Math.sign(x)||1,jink:0,scale:range(1,1.35),fade:1,pack:0,alarmAt:-1,peck:0,peckTime:0,phase:rnd(),yaw:rnd()*TAU,roll:0,onRock:y>.05,perchY:y,hop:0,goal:null,curl:0});
  c.p.set(x,y,z);c.v.set(0,0,0);
  // Green anoles and brown skinks.
  const g=rnd()<.4;c.tint.setRGB(g?.7:range(.95,1.2),g?1.35:range(.9,1.05),g?.6:range(.8,.95));return true;
 }
 /** One compy bolting out of the verge on `side` and across the road to the far verge.
  *  It runs slanted toward the Jeep, so the road carries it away more slowly while it crosses. */
 function spawnCrosser(side,z){
  const c=free(C);if(!c)return false;const run=range(8,10);
  Object.assign(c,{on:true,state:'flee',timer:0,run,cover:9,startle:0,dir:-side,jink:range(.08,.2),swerve:0,scale:range(.9,1.25),fade:1,pack:-1,alarmAt:-1,peck:0,peckTime:0,phase:rnd(),yaw:-side*Math.PI/2,roll:0,onRock:false,hop:0,verge:true,cross:false,stopAt:0,goal:-side*range(9,10.5),away:-range(2.5,3.5),curl:0});
  c.p.set(side*range(8.5,10),0,z);c.v.set(-side*run*.7,0,-run*.4);c.tint.setRGB(range(.85,1.12),range(.88,1.1),range(.8,1.05));return c;
 }
 /** One Gallimimus galloping out of the forest on `side`, across the road behind the Rex to the
  *  far side; like the compies it slants toward the Jeep, so it holds its distance while it crosses. */
 function spawnRunner(side,z){
  const c=free(G);if(!c)return null;const run=range(12,15);
  Object.assign(c,{on:true,state:'flee',timer:0,run,cover:30,startle:0,dir:-side,jink:range(.2,.5),swerve:0,scale:range(5.1,6),fade:1,pack:-2,alarmAt:-1,peck:0,peckTime:0,phase:rnd(),yaw:-side*Math.PI/2,roll:0,onRock:false,hop:0,verge:true,cross:false,stopAt:0,goal:-side*range(26,28),away:-range(1.6,2.4),curl:0});
  c.p.set(side*range(23,27),0,z);c.v.set(-side*run*.8,0,-run*.45);c.tint.setRGB(range(.85,1.15),range(.85,1.08),range(.8,1));return c;
 }
 /** Height of the body centre above the ground when resting in orientation `c.q`: the lowest of its hull points. */
 function clearance(c){let low=0;for(const h of c.kind.hull){probe.copy(h).applyQuaternion(c.q);low=Math.min(low,probe.y);}return -low*c.scale;}
 function kill(c,dir,power=1){
  if(!c.on||c.state==='dead')return false;const k=c.kind;
  // Track the body centre from here on; the pose tumbles about it.
  e.set(-(c.stride||0)*k.lean,c.yaw,c.roll);c.q.setFromEuler(e);c.p.y+=k.centre*c.scale;
  const h=Math.hypot(dir.x,dir.z)||1;
  if(k.quad){
   // A heavy quadruped's legs go: it drops, rolls onto its side and ploughs on a little.
   const sp=Math.hypot(c.v.x,c.v.z)||1,fx=c.v.x/sp,fz=c.v.z/sp,side=rnd()<.5?-1:1;
   c.v.set(c.v.x*.7+dir.x/h*.5*power,0,c.v.z*.7+dir.z/h*.5*power);c.vy=.4+rnd()*.35;
   c.spin.set(fx,0,fz).multiplyScalar(side*(1.4+rnd()*.7)).add(axis.set(fz,0,-fx).multiplyScalar(.35));
  }else if(k.heavy){
   // A galloping animal keeps its momentum: it pitches forward onto its chest and rolls
   // head over heels down its own path; the round only nudges it.
   const sp=Math.hypot(c.v.x,c.v.z)||1,fx=c.v.x/sp,fz=c.v.z/sp,nudge=1.2*power;
   c.v.set(c.v.x*.85+dir.x/h*nudge,0,c.v.z*.85+dir.z/h*nudge);c.vy=(1.3+rnd()*.9)*Math.min(1.6,power);
   c.spin.set(fz,0,-fx).multiplyScalar(3.5+rnd()*2.5).add(axis.set(rnd()-.5,rnd()-.5,rnd()-.5).multiplyScalar(1.5));
  }else{
   const kick=(3+rnd()*2)*power;
   c.v.set(c.v.x*.35+dir.x/h*kick,0,c.v.z*.35+dir.z/h*kick);c.vy=(2.6+rnd()*1.8)*Math.min(1.7,power);
   // End over end about the push, with some wobble.
   c.spin.set(dir.z/h,0,-dir.x/h).multiplyScalar((10+rnd()*9)*(rnd()<.5?-1:1)*Math.min(1.5,power)).add(axis.set(rnd()-.5,rnd()-.5,rnd()-.5).multiplyScalar(6));
  }
  Object.assign(c,{state:'dead',age:0,grounded:false,landed:false,curl:0,twitch:1,fade:1,peck:0,peckTime:0,stopAt:0,goal:null,alarmAt:-1,onRock:false,hop:0,flinch:0});
  tally.kills++;api.onKill?.(pos.copy(c.p),c.species||k.name);return true;
 }
 function stepDead(c,dt,speed){
  c.age+=dt;const ground=jungle.groundAt(c.p.x,c.p.z);
  c.curl=Math.min(1,c.curl+dt*3);c.twitch=Math.max(0,c.twitch-dt*.6);
  if(!c.grounded){
   c.vy-=c.kind.gravity*dt;c.p.x+=c.v.x*dt;c.p.y+=c.vy*dt;c.p.z+=(c.v.z+speed)*dt;
   const w=c.spin.length();if(w>1e-4){turn.setFromAxisAngle(axis.copy(c.spin).divideScalar(w),w*dt);c.q.premultiply(turn).normalize();}
   const rest=clearance(c);
   if(c.p.y-ground<rest&&c.vy<0){c.p.y=ground+rest;
    // A heavy body landing throws up dirt (chase.js).
    if(!c.landed){c.landed=true;if(c.kind.heavy)api.onLand?.(pos.copy(c.p).setY(ground),c.scale/5.5);}
    // Bounce while it lands hard; then it stays down.
    if(c.vy<-1.8){c.vy*=-.3;c.v.multiplyScalar(.55);c.spin.multiplyScalar(.5);}else{c.vy=0;c.grounded=true;}}
  }else{
   // Skids to a stop on the ground (which the road then carries away) and rolls onto its side.
   const f=Math.max(0,1-dt*(c.kind.heavy?2.2:6));c.v.multiplyScalar(f);c.p.x+=c.v.x*dt;c.p.z+=(c.v.z+speed)*dt;
   probe.set(0,0,1).applyQuaternion(c.q);const yaw=Math.atan2(probe.x,probe.z);
   probe.set(0,1,0).applyQuaternion(c.q);axis.set(Math.cos(yaw),0,-Math.sin(yaw));
   settle.setFromEuler(e.set(0,yaw,probe.dot(axis)>0?-Math.PI/2:Math.PI/2));c.q.slerp(settle,1-Math.exp(-dt*9));
   c.p.y=ground+clearance(c);
  }
  // A few dying kicks, fading out.
  c.phase=(c.phase+dt*(1.5+5*c.twitch))%1;c.stride=.55*c.twitch*c.twitch;
  if(c.age>12){c.fade-=dt*2;if(c.fade<=0)c.on=false;}
  if(c.p.z>80||c.p.z<-140||Math.abs(c.p.x)>30)c.on=false;
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
  if(c.state==='dead'){stepDead(c,dt,speed);return;}
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
   if(c.jink<=0){c.jink=range(.18,.45);const sw=c.swerveMax??k.swerve;c.swerve=range(-sw,sw);}
   c.flinch=Math.max(0,c.flinch-dt*3.5);
   const lat=c.dir,fwd=c.away*.3;let ax=lat*Math.cos(c.swerve||0)-fwd*Math.sin(c.swerve||0),az=lat*Math.sin(c.swerve||0)+fwd*Math.cos(c.swerve||0);const l=Math.hypot(ax,az)||1;
   c.want.set(ax/l*c.run,0,az/l*c.run);
   // A crosser is done once it reaches the far verge; others once they are clear of the track.
   const clear=c.goal!==null?(c.p.x-c.goal)*c.dir>=0:Math.abs(c.p.x)>(c.stopAt||c.cover);
   if(c.state==='flee'&&(clear||c.timer>(c.goal!==null?k.heavy?7:4.5:k===L?1.6:3.2))){c.state=c.stopAt?'wary':'hide';c.timer=0;c.stopAt=0;}
   if(c.state==='hide'){c.fade-=dt*5;if(c.fade<=0){c.on=false;return;}}
  }
  // ---- move: quick acceleration toward the wanted ground velocity; the road carries it
  const accel=c.state==='idle'?6:c.state==='wary'?14:k.accel;
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
  const stride=k.stride[0]+gs*k.stride[1];c.phase=(c.phase+dt*gs/stride)%1;
  c.stride=Math.min(1,.28*Math.min(1,gs/.5)+.72*Math.min(1,gs/k.fullRun));
  if(c.p.z>80||c.p.z<-140||Math.abs(c.p.x)>30)c.on=false;
 }
 function write(k){
  let n=0;const P=k.pose.array;
  for(const c of k.pool){if(!c.on)continue;
   const sc=c.scale*Math.max(0,Math.min(1,c.fade));
   // A dead one turns about its body centre (c.p), which sits k.centre (scaled) above the mesh origin.
   if(c.state==='dead'){q.copy(c.q);pos.copy(c.p).sub(toCentre.set(0,k.centre*sc,0).applyQuaternion(q));}
   else{const fl=c.flinch*c.flinch;e.set(-(c.stride||0)*k.lean-fl*.08,c.yaw+fl*.22*c.flinchSide,c.roll+fl*.3*c.flinchSide);q.setFromEuler(e);pos.set(c.p.x,c.p.y,c.p.z);}
   m.compose(pos,q,s.setScalar(sc));k.mesh.setMatrixAt(n,m);k.mesh.setColorAt(n,c.tint);
   P[n*4]=c.phase;P[n*4+1]=(c.stride||0)*k.swing;P[n*4+2]=c.peck+c.flinch*.35;P[n*4+3]=c.curl||0;n++;}
  // An empty pool issues no draw (a zero-instance draw still binds its program).
  k.mesh.count=n;k.mesh.visible=k.visible!==false&&n>0;if(n){k.mesh.instanceMatrix.needsUpdate=true;k.mesh.instanceColor.needsUpdate=true;k.pose.needsUpdate=true;}
 }

 api={
  compies:C.mesh,lizards:L.mesh,gallimimus:G.mesh,meshes:ALL.map(k=>k.mesh),huntSpawn,strike,onScatter:null,onKill:null,onLand:null,onHerd:null,
  async ready(){await modelLoad;if(modelError)throw modelError;},
  setQuality(t){density=Math.min(1,t.fauna??t.particles);for(const k of ALL)k.mesh.castShadow=!!t.detail;modelTier=t.detail?'high':'low';selectModels();},
  /** The world is already alive when a scene begins: lizards on nearby rocks and a pack foraging in view. */
  reset({intro=false,empty=false}={}){for(const k of ALL){for(const c of k.pool)c.on=false;k.mesh.count=0;}travel=0;nextPack=range(20,45);nextHerd=range(280,420);alarms.length=0;queue.length=0;chunkZ=[];tally.kills=0;if(empty)return;
   for(const chunk of jungle.chunks){const z=chunk.group.position.z;if(z>-70&&z<70)populatePerches(chunk,.45*density);}
   // In the opening, a pack pecks on the shoulder in view until her roar scatters it.
   if(intro)spawnPack(-2,9,Math.max(3,Math.round(5*density)));else spawnPack(2.4,4,4);},
  /** Startle anything within radius of a point (footfalls, bullet strikes, blasts). */
  alarm(p,r=8){if(alarms.length<16)alarms.push({x:p.x,z:p.z,r});},
  spawnPack,spawnRunner,spawnLizardNear(x,z){const c=jungle.chunks.flatMap(ch=>(ch.perches||[]).map(p=>({x:p.x,y:p.y,z:p.z+ch.group.position.z}))).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0];return c?spawnLizard(c.x,c.y,c.z):false;},
  stats(){return{compies:C.mesh.count,lizards:L.mesh.count,gallimimus:G.mesh.count,big:Object.keys(BAKED).reduce((n,name)=>n+kinds[name].mesh.count,0),dead:ALL.reduce((n,k)=>n+k.pool.filter(c=>c.on&&c.state==='dead').length,0),kills:tally.kills};},
  /** Body centres of the live animals of a species (for aiming checks). */
  /** The biggest live animal crossing in front of the gun (z from 6 to 45 m): its body centre, for the menu gunner to track. */
  showcase(out){let best=null,size=0;for(const k of ALL)for(const c of k.pool)if(c.on&&c.state==='flee'&&c.fade>.8&&c.p.z>6&&c.p.z<45&&Math.abs(c.p.x)<13&&c.scale>size){best=c;size=c.scale;}
   if(!best)return null;return out.set(best.p.x+best.v.x*.25,best.p.y+best.kind.centre*best.scale,best.p.z+best.v.z*.25);},
  live(name='compy'){return ALL.flatMap(k=>k.pool.filter(c=>c.on&&(c.species||k.name)===name&&c.state!=='dead'&&c.state!=='hide'&&c.fade>=.6).map(c=>({x:c.p.x,y:c.p.y+k.centre*c.scale,z:c.p.z,hp:c.hp,crossing:c.goal!==null})));},
  /**
   * The nearest live compy on a ray (world space), or null. Each is a sphere about its
   * body that never shrinks below `minAngle` radians as seen from the gun, so a small
   * runner at 20 m stays a fair target.
   */
  hit(ray,far=Infinity,minAngle=0){
   let best=null;
   for(const k of ALL)for(const c of k.pool){if(!c.on||c.state==='dead'||c.state==='hide'||c.fade<.6)continue;
    if(k.spheres){
     const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw);
     k.spheres.forEach((sp,i)=>{centre.set(c.p.x+(sp.p.x*cy+sp.p.z*sy)*c.scale,c.p.y+sp.p.y*c.scale,c.p.z+(-sp.p.x*sy+sp.p.z*cy)*c.scale);
      const along=push.subVectors(centre,ray.origin).dot(ray.direction);if(along<=0||along>far)return;
      const r=i?sp.r*c.scale:Math.max(sp.r*c.scale,along*minAngle),d2=ray.distanceSqToPoint(centre);if(d2>r*r)return;
      const t=along-Math.sqrt(r*r-d2);if(best&&t>=best.distance)return;best={critter:c,kind:c.species||k.name,distance:t,point:ray.at(t,new T.Vector3())};});
     continue;
    }
    centre.set(c.p.x,c.p.y+k.centre*c.scale,c.p.z);const along=push.subVectors(centre,ray.origin).dot(ray.direction);if(along<=0||along>far)continue;
    const r=Math.max(k.hitR*c.scale,along*minAngle);if(ray.distanceSqToPoint(centre)>r*r||best&&along>=best.distance)continue;
    best={critter:c,kind:c.species||k.name,distance:along,point:centre.clone()};
   }
   return best;
  },
  /** A round (direction `dir`) kills a compy; `power` scales the throw. */
  kill,
  /** A blast kills every compy whose body is within `radius` of it (an airburst high over the road spares them) and throws it outward. */
  blast(p,radius=5){const out=[];for(const k of ALL)for(const c of k.pool){if(!c.on||c.state==='dead'||c.fade<.6)continue;const dx=c.p.x-p.x,dz=c.p.z-p.z,d=Math.hypot(dx,dz);
   // A big sculpt is caught if the blast reaches most of its length (hit spheres run nose to tail).
   const reach=k.spheres?(k.spheres[0].r+.35)*c.scale:k.heavy?1.5:0;
   if(Math.hypot(d,c.p.y+k.centre*c.scale-p.y)>radius+reach)continue;const f=Math.max(0,1-d/radius);if(strike(c,push.set(dx/(d||1),0,dz/(d||1)),1.3+f*1.4,4)){c.vy+=(k.heavy?2:4)*f;out.push(c.species||k.name);}}return out;},
  /** A Gallimimus herd galloping out of the forest on `side` and across the road behind the Rex. */
  herd(side,{count=Math.round(range(6,9)),delay=0,over=1.8,z=[22,32]}={}){for(let i=0;i<count;i++)queue.push({at:now+delay+over*i/Math.max(1,count-1)+range(-.08,.08),side,z:range(z[0],z[1]),call:i===0||i===Math.floor(count/2),kind:'galli'});},
  /** A file of `count` compies flushed out of the verge on `side` (+x or -x), crossing the road
   *  behind the Jeep over `over` seconds, starting `delay` seconds from now. */
  stream(side,{count=6,delay=0,over=1.4,z=[7,11]}={}){for(let i=0;i<count;i++)queue.push({at:now+delay+over*i/Math.max(1,count-1)+range(-.06,.06),side,z:range(z[0],z[1]),call:i===0});},
  /**
   * @param spawn allow new packs and basking lizards (not during the opening or after the chase)
   * @param rex {x,z} of her body in the Jeep frame, or null
   */
  update(dt,{speed=0,rex=null,visible=true,spawn=true,herds=false}={}){
   now+=dt;for(const k of ALL){k.visible=visible;k.mesh.visible=visible&&k.mesh.count>0;}
   if(!visible||dt<=0){alarms.length=0;return;}
   if(spawn){
    // Packs turn up per distance travelled, just beyond the bumper's view ahead.
    travel+=speed*dt;
    if(travel>=nextPack){const road=rnd()<.62,x=road?range(-3.2,3.2):(rnd()<.5?-1:1)*range(4.6,7),z=speed>4?-range(46,60):-range(9,14);spawnPack(x,z,Math.max(2,Math.round(range(3,7)*density)),{verge:!road});nextPack=travel+(speed>4?range(40,95):range(14,30))/Math.max(.35,density);}
    // Lizards settle on the rocks of each chunk as it comes up the road.
    jungle.chunks.forEach((chunk,i)=>{const z=chunk.group.position.z,was=chunkZ[i];if(was!==undefined&&was<-52&&z>=-52)populatePerches(chunk,.45*density);chunkZ[i]=z;});
    // The first of each file gives the alarm call as it breaks cover.
    for(let i=queue.length-1;i>=0;i--)if(now>=queue[i].at){const e=queue[i],c=e.kind==='galli'?spawnRunner(e.side,e.z):spawnCrosser(e.side,e.z);if(c&&e.call)(e.kind==='galli'?api.onHerd:api.onScatter)?.(pos.set(c.p.x,e.kind==='galli'?2:.3,c.p.z));queue.splice(i,1);}
    // Once or twice a chase a herd gallops across behind her (only while the chase allows it).
    if(herds&&travel>=nextHerd){api.herd(rnd()<.5?-1:1);nextHerd=travel+range(550,800);}
   }
   for(const k of ALL)for(const c of k.pool)if(c.on)step(k,c,dt,speed,rex);
   alarms.length=0;for(const k of ALL)write(k);
  }
 };
 api.reset();
 return api;
}
