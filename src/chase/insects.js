import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RAIN,NIGHT} from './weather-state.js';
// Flying insects. By day, butterflies flutter along the verges and dragonflies hover
// and dart over the track. Butterflies are clear-daytime only: any rain or dusk
// sends them to shelter under leaves; a few dragonflies keep hawking low in rain. At night moths come out and the
// flashlight draws them. Positions are in the Jeep's frame, where the air slides
// past at road speed: an insect can't keep up with the Jeep, so at speed they stream
// through view (moths flare as they cross the beam); in the menu they linger.
// Each kind is one instanced draw of real lit geometry: the sun, canopy dapple and
// the night lights light them like everything else. Wings flap in the vertex shader.

const TAU=Math.PI*2;
let seed=1789;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>a+rnd()*(b-a);

/** Wing atlas: left half a butterfly/moth wing, right half a dragonfly wing.
 *  R = pigment (tinted), G = pale spots, A = shape. */
function wingAtlas(){
 const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
 // Butterfly: forewing above the root line, rounded hindwing below.
 const fore=new Path2D('M0 60 C18 30 40 8 70 4 C95 1 117 3 122 10 C126 22 118 38 104 48 C84 60 44 62 0 62 Z');
 const hind=new Path2D('M0 66 C30 64 62 70 84 84 C98 94 96 112 80 121 C62 128 36 122 18 104 C8 94 2 80 0 68 Z');
 for(const p of [fore,hind]){x.save();x.clip(p);x.fillStyle='rgb(255,0,0)';x.fillRect(0,0,128,128);
  // Dark margins and veins; pale spots inside the forewing tip and along the hind margin.
  x.strokeStyle='rgb(0,0,0)';x.lineWidth=13;x.stroke(p);x.lineWidth=1.3;x.strokeStyle='rgba(0,0,0,.45)';
  for(let i=0;i<7;i++){x.beginPath();x.moveTo(0,p===fore?60:66);x.quadraticCurveTo(50,p===fore?40-i*4:74+i*6,p===fore?40+i*13:30+i*10,p===fore?6+i*6:124-i*4);x.stroke();}
  x.restore();}
 x.fillStyle='rgb(0,255,0)';for(const [px,py,r]of [[108,14,3],[114,24,2.6],[98,10,2.2],[70,112,2.4],[50,116,2.2],[86,104,2.2]]){x.beginPath();x.arc(px,py,r,0,TAU);x.fill();}
 // Dragonfly: long, narrow, clear wing with a vein mesh and a dark stigma near the tip.
 x.save();const d=new Path2D('M128 62 C150 54 200 52 244 56 C252 58 252 66 244 68 C200 72 150 70 128 66 Z');x.clip(d);
 x.fillStyle='rgb(255,0,0)';x.fillRect(128,0,128,128);x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=1;
 for(let i=0;i<14;i++){x.beginPath();x.moveTo(134+i*8.5,50);x.lineTo(138+i*8.5,74);x.stroke();}x.beginPath();x.moveTo(128,63);x.lineTo(250,61);x.stroke();
 x.fillStyle='rgb(0,0,0)';x.fillRect(230,55,7,6);x.restore();
 const t=new T.CanvasTexture(c);t.colorSpace=T.NoColorSpace;t.anisotropy=4;return t;
}

// Geometry: unit wingspan; vertices carry `wing` (-1 left, +1 right, 0 body) and
// `hind` (1 for dragonfly hind wings, which beat out of phase with the fore pair).
function wingQuad(side,{x0,x1,z0,z1,u0,u1,v0,v1,hind=0}){
 const g=new T.PlaneGeometry(1,1,2,1);g.rotateX(-Math.PI/2);const p=g.attributes.position,uv=g.attributes.uv;
 for(let i=0;i<p.count;i++){const u=p.getX(i)+.5,v=-p.getZ(i)+.5;p.setXYZ(i,side*(x0+(x1-x0)*u),0,z0+(z1-z0)*v);uv.setXY(i,u0+(u1-u0)*u,v0+(v1-v0)*v);}
 g.computeVertexNormals();g.setAttribute('wing',new T.Float32BufferAttribute(new Array(p.count).fill(side),1));g.setAttribute('hind',new T.Float32BufferAttribute(new Array(p.count).fill(hind),1));return g;
}
function bodyPart(g){const n=g.attributes.position.count;g.setAttribute('wing',new T.Float32BufferAttribute(new Array(n).fill(0),1));g.setAttribute('hind',new T.Float32BufferAttribute(new Array(n).fill(0),1));return g;}
function prep(g){return g.index?g.toNonIndexed():g;}
function lepidopteraGeometry(){
 const parts=[-1,1].map(s=>wingQuad(s,{x0:.02,x1:.5,z0:-.5,z1:.5,u0:0,u1:.5,v0:1,v1:0}));
 const body=new T.CylinderGeometry(.022,.03,.42,6);body.rotateX(Math.PI/2);parts.push(bodyPart(body));
 return mergeGeometries(parts.map(prep));
}
function dragonflyGeometry(){
 const parts=[];
 for(const s of [-1,1]){parts.push(wingQuad(s,{x0:.02,x1:.5,z0:.02,z1:.14,u0:.5,u1:1,v0:.42,v1:.58}));parts.push(wingQuad(s,{x0:.02,x1:.47,z0:-.1,z1:.04,u0:.5,u1:1,v0:.42,v1:.58,hind:1}));}
 const abdomen=new T.CylinderGeometry(.018,.03,.62,6,3);abdomen.rotateX(Math.PI/2);abdomen.translate(0,0,-.36);parts.push(bodyPart(abdomen));
 const thorax=new T.SphereGeometry(.05,8,6);thorax.scale(1,1,1.5);parts.push(bodyPart(thorax));
 const head=new T.SphereGeometry(.045,8,6);head.scale(1.3,.9,.9);head.translate(0,.005,.09);parts.push(bodyPart(head));
 return mergeGeometries(parts.map(prep));
}

// aFly: x flap phase 0..1 (wrapped on the CPU), y flap amplitude (rad), z mean wing
// angle (rad), w underside darkening (1 for butterflies, 0 for moths).
function flyerMaterial(atlas,dragonfly){
 const m=new T.MeshStandardMaterial({map:atlas,side:T.DoubleSide,alphaTest:.3,roughness:dragonfly?.35:.72,metalness:0});
 m.onBeforeCompile=s=>{
  // Each wing hinges on the body axis; its normal turns with it so a beat catches the light.
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float wing,hind;attribute vec4 aFly;varying float vWing;varying float vUnder;')
   .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    vWing=abs(wing);vUnder=aFly.w;
    float flapA=aFly.z+aFly.y*sin((aFly.x+hind*.25)*6.2832);
    if(vWing>.5)objectNormal=vec3(-wing*sin(flapA),cos(flapA),0.);`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    if(vWing>.5){float r=abs(transformed.x);transformed.x=wing*r*cos(flapA);transformed.y+=r*sin(flapA);}`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vWing;varying float vUnder;')
   .replace('#include <map_fragment>',`
    vec4 wt=texture2D(map,vMapUv);diffuseColor.a*=vWing>.5?wt.a:1.;`)
   .replace('#include <color_fragment>',`
    #if defined(USE_COLOR)
     vec3 tint=vColor.rgb;
    #else
     vec3 tint=vec3(1.);
    #endif
    if(vWing>.5){
     ${dragonfly?`diffuseColor.rgb=mix(vec3(.06,.05,.04),vec3(.62,.68,.72),wt.r);`:`
     vec3 top=mix(vec3(.025,.02,.018),tint,wt.r)+wt.g*vec3(.85,.82,.72);
     // Butterflies fold to a dull brown underside; moths are the same both ways.
     vec3 under=mix(vec3(.05,.035,.022),vec3(.3,.2,.1)*(.55+.45*wt.r),.85)+wt.g*vec3(.35,.3,.22);
     diffuseColor.rgb=gl_FrontFacing?top:mix(top,under,vUnder);`}
    }else diffuseColor.rgb=${dragonfly?'tint*.55':'vec3(.05,.045,.04)+tint*.04'};`);
 };
 m.customProgramCacheKey=()=>`rex-insect-${dragonfly?'dragonfly':'lepidoptera'}-v1`;return m;
}

const KINDS={
 butterfly:{colors:[[.06,.42,1.35],[.06,.42,1.35],[1.15,.45,.06],[1.05,.88,.14]],span:[.13,.19],flap:[5,8],amp:.95,mean:.35,under:1,speed:[.8,1.8],y:[.7,3.6],x:[.8,7.5],every:17},
 // Big tropical moths, gathering where the lamp and the Rex's path draw them.
 moth:{colors:[[.86,.8,.66],[.7,.64,.52],[.95,.92,.84]],span:[.08,.14],flap:[12,17],amp:.85,mean:.2,under:0,speed:[1.4,3],y:[1.4,4],x:[0,3.2],every:2.4},
 dragonfly:{colors:[[.12,.4,1],[.95,.16,.08],[.25,.7,.3],[.08,.1,.12]],span:[.1,.13],flap:[27,31],amp:.28,mean:.05,under:0,speed:[6,9],y:[.5,2.2],x:[0,4.5],every:21}
};

export function createInsects(scene,{night}){
 const atlas=wingAtlas();
 const make=(geometry,material,max,name)=>{const fly=new T.InstancedBufferAttribute(new Float32Array(max*4),4);fly.setUsage(T.DynamicDrawUsage);geometry.setAttribute('aFly',fly);
  const mesh=new T.InstancedMesh(geometry,material,max);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.count=0;mesh.receiveShadow=true;mesh.name=name;mesh.setColorAt(0,new T.Color(1,1,1));scene.add(mesh);
  return{mesh,fly,max,pool:Array.from({length:max},()=>({on:false,kind:null,life:30,p:new T.Vector3(),v:new T.Vector3(),goal:new T.Vector3(),yaw:0,pitch:0,phase:0,freq:6,span:.1,t:0,mode:0,alt:1,color:new T.Color(),fade:0}))};};
 const lep=make(lepidopteraGeometry(),flyerMaterial(atlas,false),48,'Butterflies and moths'),drag=make(dragonflyGeometry(),flyerMaterial(atlas,true),12,'Dragonflies');
 const m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ'),sc=new T.Vector3(),beamPos=new T.Vector3(),beamDir=new T.Vector3(),toAxis=new T.Vector3(),rel=new T.Vector3();
 const travel={butterfly:0,moth:0,dragonfly:0};let density=1;

 function spawn(kindName,z,{inView=false,x=null,y=null}={}){
  const K=KINDS[kindName],g=kindName==='dragonfly'?drag:lep,b=g.pool.find(i=>!i.on);if(!b)return;
  const side=rnd()<.5?-1:1,c=K.colors[Math.floor(rnd()*K.colors.length)];
  Object.assign(b,{on:true,kind:kindName,life:range(18,40),yaw:rnd()*TAU,pitch:0,phase:rnd(),freq:range(...K.flap),span:range(...K.span),t:range(0,1),mode:0,alt:range(...K.y),fade:inView?1:0});
  b.p.set(x??side*range(...K.x),y??b.alt,z);b.v.set(0,0,0);b.goal.copy(b.p);b.color.setRGB(...c).multiplyScalar(range(.85,1.1));
 }
 function fly(b,dt,speed,beam){
  const K=KINDS[b.kind];b.t-=dt;b.life-=dt;b.fade=Math.min(1,b.fade+dt*2);
  if(b.kind==='dragonfly'){
   // Hover, then dart to a new point nearby; the body stays level and points along the dart.
   if(b.t<=0){if(b.mode===0){b.mode=1;b.t=range(.25,.55);const a=rnd()*TAU,d=range(1.5,4.5);b.goal.set(T.MathUtils.clamp(b.p.x+Math.cos(a)*d,-5,5),range(...K.y),b.p.z+Math.sin(a)*d);}else{b.mode=0;b.t=range(.35,1.4);}}
   const want=b.mode?toAxis.subVectors(b.goal,b.p).setLength(range(...K.speed)):toAxis.set(Math.sin(b.t*9)*.15,Math.sin(b.t*7)*.1,0);
   b.v.lerp(want,Math.min(1,dt*(b.mode?9:5)));
  }else{
   // Fluttering: a wandering heading, bobbing with every wingbeat; moths jitter harder.
   if(b.t<=0){b.t=range(.2,b.kind==='moth'?.5:1.1);b.yaw+=range(-1.3,1.3);b.alt=T.MathUtils.clamp(b.alt+range(-.8,.8),K.y[0],K.y[1]);}
   const sp=range(...K.speed);toAxis.set(Math.sin(b.yaw)*sp,(b.alt-b.p.y)*1.2+Math.sin(b.phase*TAU)*(b.kind==='moth'?.9:.6),Math.cos(b.yaw)*sp);
   // Moths steer for the lamp: toward the beam axis when near it.
   if(b.kind==='moth'&&beam){rel.subVectors(b.p,beamPos);const along=rel.dot(beamDir);if(along>.5&&along<16){rel.addScaledVector(beamDir,-along);const dist=rel.length();if(dist<6)toAxis.addScaledVector(rel,-3.2/Math.max(.4,dist));}}
   b.v.lerp(toAxis,Math.min(1,dt*(b.kind==='moth'?6:3)));
  }
  b.p.x+=b.v.x*dt;b.p.y=Math.max(.25,b.p.y+b.v.y*dt);b.p.z+=(b.v.z+speed)*dt;
  const hs=Math.hypot(b.v.x,b.v.z);if(hs>.2){const target=Math.atan2(b.v.x,b.v.z);let d=target-b.yaw;d=Math.atan2(Math.sin(d),Math.cos(d));b.yaw+=d*Math.min(1,dt*(b.kind==='dragonfly'?14:5));}
  b.phase=(b.phase+dt*b.freq)%1;
  if(b.p.z>70||b.p.z<-80||Math.abs(b.p.x)>14||b.life<0)b.on=false;
 }
 function write(g){
  let n=0;const F=g.fly.array;
  for(const b of g.pool){if(!b.on)continue;const K=KINDS[b.kind];
   e.set(b.kind==='dragonfly'?0:-.25,b.yaw,0);q.setFromEuler(e);m.compose(b.p,q,sc.setScalar(b.span*b.fade));g.mesh.setMatrixAt(n,m);g.mesh.setColorAt(n,b.color);
   // Butterflies glide on still wings now and then.
   const glide=b.kind==='butterfly'&&Math.sin(b.t*5+b.freq)>.85?.25:1;
   F[n*4]=b.phase;F[n*4+1]=K.amp*glide;F[n*4+2]=K.mean;F[n*4+3]=K.under;n++;}
  g.mesh.count=n;if(n){g.mesh.instanceMatrix.needsUpdate=true;g.mesh.instanceColor.needsUpdate=true;g.fly.needsUpdate=true;}
 }
 function activity(kind){const n=NIGHT.value,r=RAIN.value;return kind==='moth'?n*(1-.5*r):kind==='butterfly'?(1-T.MathUtils.smoothstep(n,0,.2))*(1-T.MathUtils.smoothstep(r,0,.2)):(1-n)*(1-.6*r);}
 const api={
  butterflies:lep.mesh,dragonflies:drag.mesh,
  setQuality(t){density=Math.min(1,t.fauna??t.particles);},
  /** Fill the air in view at once (a new scene, or a capture). */
  seedView(){for(const k of Object.keys(KINDS)){const n=Math.round(activity(k)*density*(k==='moth'?16:k==='butterfly'?4:3));for(let i=0;i<n;i++)spawn(k,range(-2,34),{inView:true});}},
  reset(){for(const g of [lep,drag]){for(const b of g.pool)b.on=false;g.mesh.count=0;}for(const k in travel)travel[k]=0;api.seedView();},
  stats(){return{lepidoptera:lep.mesh.count,dragonflies:drag.mesh.count};},
  spawn(kind,x,y,z){spawn(kind,z,{inView:true,x,y});},
  update(dt,{speed=0,visible=true}={}){
   lep.mesh.visible=drag.mesh.visible=visible;if(!visible||dt<=0)return;
   // New insects arrive per distance travelled (a slow trickle in the menu), just out of view ahead.
   for(const k of Object.keys(KINDS)){const rate=activity(k)*density;if(rate<.02)continue;travel[k]+=Math.max(speed,1.2)*dt*rate;
    while(travel[k]>=KINDS[k].every){travel[k]-=KINDS[k].every*range(.6,1.4);spawn(k,speed>4?-range(28,42):range(3,30));}}
   const lit=night?.flashlightOn&&night.active&&night.flashlight.intensity>1;
   if(lit){night.flashlight.getWorldPosition(beamPos);night.flashlight.target.getWorldPosition(beamDir).sub(beamPos).normalize();}
   for(const g of [lep,drag]){for(const b of g.pool)if(b.on){fly(b,dt,speed,lit);
    // Kinds out of season (rain, daylight) settle out of the air.
    if(activity(b.kind)<.05){b.fade-=dt*3;if(b.fade<=0)b.on=false;}}write(g);}
  }
 };
 api.reset();return api;
}
