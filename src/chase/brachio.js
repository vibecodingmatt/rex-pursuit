import * as T from 'three';
import {WET} from './weather-state.js';
// A brachiosaur at the forest edge, now and then, side-on to the track with her neck
// arched out over it to browse the canopy the road opens up. She stands in the ground
// frame, so the Jeep and the Rex pass beneath her head; from the gun she recedes down
// the road corridor in profile, the one gap in the canopy where a sauropod reads, and
// fades into the haze. As she comes level she lifts her head and calls (a real
// recording, placed at her head). Deeper in the forest, or face-on, she would be lost
// among the trunks or read as a pillar.
//
// The body is a sculpted mesh baked by scripts/build-brachio.mjs (public/models/
// brachio.bin; brachio-low.bin, a third the triangles, for the Low tier) with per-vertex occlusion, crease cavity, body region and a spine
// coordinate. The vertex shader bends the neck and tail as joint chains and opens
// the jaw; the fragment shader adds the skin: pebbly scales and folds as a bump
// (triplanar in the rest pose, so it sticks to the skin), countershading, mottling,
// mud on the legs and a wet sheen in rain.
//
// Shot, she rears up on her hind legs as in the film: she trumpets, pitches up about
// her hips with the hind feet planted and the tail lowered as a prop, the forelegs
// hanging and the neck reaching up, holds, then drops back onto her forefeet with a
// thud that shakes the ground (`onStomp`).

let seed=31337;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>a+rnd()*(b-a);

// ---------------------------------------------------------------- skin maps --
/** Tileable relief and tone: R pebbly scales (Worley cells), G folded-hide wrinkles, B mottling. */
function skinMaps(){
 const S=512,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),img=x.createImageData(S,S),D=img.data;
 let s=77;const r=()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};
 // Worley points on a wrapping grid; scale sizes vary so it isn't a regular lattice.
 const G=22,pts=new Float32Array(G*G*3);for(let i=0;i<G*G;i++){pts[i*3]=r();pts[i*3+1]=r();pts[i*3+2]=.75+r()*.5;}
 const lattice=n=>{const v=new Float32Array(n*n);for(let i=0;i<v.length;i++)v[i]=r();return v;};
 const L1=lattice(8),L2=lattice(16),L3=lattice(32),L4=lattice(6);
 const noise=(L,n,u,v)=>{u*=n;v*=n;const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,a=(p,q)=>L[((p%n+n)%n)+((q%n+n)%n)*n],su=fu*fu*(3-2*fu),sv=fv*fv*(3-2*fv);
  return (a(i,j)*(1-su)+a(i+1,j)*su)*(1-sv)+(a(i,j+1)*(1-su)+a(i+1,j+1)*su)*sv;};
 for(let py=0;py<S;py++)for(let px=0;px<S;px++){
  const u=px/S,v=py/S,gx=u*G,gy=v*G,ix=Math.floor(gx),iy=Math.floor(gy);let f1=9,f2=9;
  for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const cx=ix+ox,cy=iy+oy,k=(((cx%G)+G)%G)+(((cy%G)+G)%G)*G,dx=(cx+pts[k*3])-gx,dy=(cy+pts[k*3+1])-gy,d=Math.hypot(dx,dy)/pts[k*3+2];if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}
  const dome=Math.pow(Math.min(1,(f2-f1)*2.2),.55);
  // Wrinkles: ridged noise stretched along v, so side projections fold vertically like hanging hide.
  const w=1-Math.abs(noise(L2,16,u*2,v)*2-1),w2=1-Math.abs(noise(L3,32,u*2,v)*2-1);
  const i=(py*S+px)*4;D[i]=dome*255;D[i+1]=(w*.65+w2*.35)*255;D[i+2]=(noise(L1,8,u,v)*.6+noise(L4,6,u,v)*.4)*255;D[i+3]=255;
 }
 x.putImageData(img,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.NoColorSpace;t.anisotropy=8;return t;
}

// ------------------------------------------------------------------- shader --
// Rearing pivots in the rest pose (only y and z matter): the hip sockets, the forelegs'
// swing point just above the belly line, and the wrists. Shared by the shader and the CPU pose.
const HIP=[0,4.35,-1.6],SHOULDER=[0,3.4,2],WRIST=[0,1.4,1.95];
// Rear-up timeline (seconds) and pose gains. peak is the body pitch in radians (43 degrees);
// the neck joints counter-pitch by neck[j] x pitch, the tail base by tail x pitch.
const REAR={peak:.75,flinch:.3,rise:1.7,hold:1.4,fall:.85,neck:[-.7,-.45,-.3,-.1,-.08],tail:-.55,swing:.5,fold:.5};
REAR.duration=REAR.flinch+REAR.rise+REAR.hold+REAR.fall;
/** Body pitch t seconds after the shot: a start, an eased rise, a hold, then a fall that
 *  speeds up like a drop, landing at full speed on the forefeet. */
export function rearAngle(t){
 const {peak,flinch,rise,hold,fall}=REAR,up=flinch+rise,top=up+hold;
 if(t<0)return 0;
 if(t<flinch)return peak*.04*Math.sin(t/flinch*Math.PI/2);
 if(t<up)return peak*(.04+.96*T.MathUtils.smoothstep(t,flinch,up));
 if(t<top)return peak*(1+.025*Math.sin((t-up)/hold*Math.PI));
 const u=Math.min(1,(t-top)/fall);return peak*(1-u*u);
}
const v3=a=>`vec3(${a.map(x=>x.toFixed(3)).join(',')})`;
const CHAIN=`
 uniform vec4 uNeck[5];uniform vec3 uNeckRot[5];uniform vec4 uTail[4];uniform vec3 uTailRot[4];uniform vec3 uJawHinge;uniform float uJaw,uBreath;
 // Rearing: x body pitch about the hips, y foreleg swing back, z wrist fold.
 uniform vec3 uRear;
 // Pitch (x, up positive) then yaw (y).
 mat3 rotPY(vec3 a){float cp=cos(a.x),sp=sin(a.x),cy=cos(a.y),sy=sin(a.y);return mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy)*mat3(1.,0.,0.,0.,cp,-sp,0.,sp,cp);}
 // Joint chains, distal joint first about rest-pose pivots: each joint's turn blends
 // in over +-0.45 m of spine so the neck curves rather than kinks.
 void brachioPose(inout vec3 p,inout vec3 n,float s,float region,float limb){
  vec3 rest=p;
  if(abs(region-3.)<.5){float c=cos(uJaw),si=sin(uJaw);vec3 q=p-uJawHinge;q.yz=vec2(c*q.y-si*q.z,si*q.y+c*q.z);p=uJawHinge+q;n.yz=vec2(c*n.y-si*n.z,si*n.y+c*n.z);}
  if(region<.5){p.x*=1.+uBreath*.012;p.y=4.3+(p.y-4.3)*(1.+uBreath*.006);}
  for(int j=4;j>=0;j--){float w=smoothstep(uNeck[j].w-.45,uNeck[j].w+.45,s);if(w>.001){mat3 R=rotPY(uNeckRot[j]*w);p=uNeck[j].xyz+R*(p-uNeck[j].xyz);n=R*n;}}
  for(int j=3;j>=0;j--){float w=1.-smoothstep(uTail[j].w-.45,uTail[j].w+.45,s);if(w>.001){mat3 R=rotPY(uTailRot[j]*w);p=uTail[j].xyz+R*(p-uTail[j].xyz);n=R*n;}}
  if(uRear.x>0.){
   // Hind legs stay planted. The weight fades out up the thighs and into the belly, and
   // widens front to back with height, so the groin bends over metres rather than
   // tearing at the limb seam. Near the ground the fore/hind split stays sharp (the far
   // hind foot stands forward of the others).
   float wz=.4+1.2*smoothstep(1.8,3.4,rest.y),hindSide=smoothstep(.8+wz,.8-wz,rest.z);
   float planted=(1.-smoothstep(1.2,4.4,rest.y))*hindSide*smoothstep(-3.4,-2.7,rest.z);
   // The baked limb influence falls to about half around the claws, so the feet count by height too.
   float fore=max(limb,1.-smoothstep(1.7,2.5,rest.y))*(1.-hindSide);
   if(fore>.001){
    mat3 R=rotPY(vec3(-uRear.z*fore*smoothstep(${(WRIST[1]+.45).toFixed(2)},${(WRIST[1]-.45).toFixed(2)},rest.y),0.,0.));p=${v3(WRIST)}+R*(p-${v3(WRIST)});n=R*n;
    R=rotPY(vec3(-uRear.y*fore,0.,0.));p=${v3(SHOULDER)}+R*(p-${v3(SHOULDER)});n=R*n;
   }
   mat3 R=rotPY(vec3(uRear.x*(1.-planted),0.,0.));p=${v3(HIP)}+R*(p-${v3(HIP)});n=R*n;
  }
 }`;

function brachioMaterial(uniforms,skin){
 const m=new T.MeshStandardMaterial({roughness:.82,metalness:0});
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms,{tSkin:{value:skin},uWet:WET});
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   attribute vec4 aux;attribute float spine;varying vec3 vRest;varying vec3 vRestN;varying vec4 vAux;varying float vSpine;${CHAIN}`)
   .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    vec3 posedP=position;vRest=position;vRestN=objectNormal;vAux=aux;vSpine=spine*.001;
    brachioPose(posedP,objectNormal,vSpine,floor(aux.z*255.+.5),aux.w);`)
   .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=posedP;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   uniform sampler2D tSkin;uniform float uWet;uniform vec2 uFold;uniform vec3 uEye[2];uniform float uEyeR;uniform vec3 uNostril[2];uniform float uNostrilR;varying vec3 vRest;varying vec3 vRestN;varying vec4 vAux;varying float vSpine;
   // Triplanar sample in the rest pose, so the pattern stays on the skin as she moves.
   vec4 tri(vec3 p,vec3 n,float scale){vec3 w=pow(abs(n),vec3(4.));w/=w.x+w.y+w.z;
    return texture2D(tSkin,p.zy*scale)*w.x+texture2D(tSkin,p.xz*scale)*w.y+texture2D(tSkin,p.xy*scale)*w.z;}
   float skinH,skinMud,skinRegion,skinEye;`)
   .replace('#include <color_fragment>',`#include <color_fragment>
   {
    float region=floor(vAux.z*255.+.5),ao=vAux.x,cav=vAux.y;skinRegion=region;
    vec4 fine=tri(vRest,vRestN,1.65),coarse=tri(vRest,vRestN,.34),broad=tri(vRest*.5+3.1,vRestN,.11);
    // A continuous baked limb influence avoids a hard wrinkle/normal seam around
    // each shoulder and thigh where the categorical region number changes.
    // Region ids interpolate across triangles: torso (0) to leg (6/7) crosses
    // claw (5). Restrict horn to the feet so that never paints a pale shoulder rim.
    float limb=vAux.w;bool claw=region>4.5&&region<5.5&&vRest.y<.55;
    // Relief: pebbly scales everywhere, folded hide in the creases, folds across the
    // throat side of the lower neck, rings up the legs.
    float neckFront=smoothstep(.1,.6,-vRestN.y*.6+vRestN.z*.8)*smoothstep(uFold.x,uFold.x+1.5,vSpine)*(1.-smoothstep(uFold.y-2.,uFold.y,vSpine));
    float folds=neckFront*pow(.5+.5*sin(vSpine*17.+coarse.g*3.),3.)*.9;
    // Leg wrinkles wander and break up, like an elephant's, rather than stacking into rings.
    float rings=limb*pow(.5+.5*sin(vRest.y*24.+coarse.g*7.+broad.b*9.+vRest.x*3.),3.)*smoothstep(.35,.75,coarse.b+fine.r*.2)*(1.-smoothstep(3.6,4.8,vRest.y));
    // Scales finer than a couple of pixels would only shimmer; they fade out with distance.
    float fineFade=1.-smoothstep(.0025,.009,length(fwidth(vRest)));
    skinH=fine.r*.4*fineFade+coarse.g*(.45+cav*1.4)+folds+rings*.55;
    // Eyes are exact spheres from the model header: glossy and dark, in a ring of lid.
    // The visible eye is the cap of each eye sphere that faces out and a little forward.
    vec3 cap0=uEye[0]+normalize(vec3(sign(uEye[0].x),.08,.3))*uEyeR,cap1=uEye[1]+normalize(vec3(sign(uEye[1].x),.08,.3))*uEyeR;
    float eyeD=min(distance(vRest,cap0),distance(vRest,cap1))/uEyeR;skinEye=1.-smoothstep(.5,.72,eyeD);
    float lid=smoothstep(.62,.8,eyeD)*(1.-smoothstep(.95,1.3,eyeD));skinH=mix(skinH,0.,skinEye)+lid*.6;
    // Colour: dark dorsal slate-green, lighter flanks, pale throat and belly; broad
    // mottling and faint darker saddles; mud caked up the legs; dirt in the creases.
    float up=vRestN.y;
    vec3 back=vec3(.05,.047,.04),flank=vec3(.092,.084,.07),belly=vec3(.19,.165,.125);
    vec3 col=mix(belly,flank,smoothstep(-.7,.05,up));col=mix(col,back,smoothstep(.15,.75,up));
    col*=.72+.56*broad.b;col*=1.-.22*smoothstep(.55,.8,coarse.b)*smoothstep(-.1,.5,up);
    // Faint darker saddles across the back and up the neck, broken by the mottling.
    col*=1.-.2*smoothstep(.55,.95,.5+.5*sin(vSpine*1.9+broad.b*2.5))*smoothstep(-.2,.6,up);
    col*=1.+.24*(fine.r-.5)*fineFade;
    skinMud=(1.-smoothstep(.25,1.6+coarse.b*.8,vRest.y))*(claw?1.:mix(.35,1.,limb));
    col=mix(col,vec3(.05,.036,.022)*(.8+.4*coarse.b),skinMud*.9);
    col*=mix(1.,.45,cav)*mix(.55,1.,ao);
    col=mix(col*(1.-.3*lid),vec3(.018,.011,.006),skinEye);
    float nostril=1.-smoothstep(.55,1.,min(distance(vRest,uNostril[0]),distance(vRest,uNostril[1]))/uNostrilR);col*=1.-.8*nostril;
    if(claw)col=mix(vec3(.13,.11,.085),col,skinMud*.6);
    col*=1.-uWet*(.32-.12*skinMud);
    diffuseColor.rgb=col;
   }`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    roughnessFactor=mix(mix(.78,.9,skinMud),.52+.2*skinMud,uWet);
    roughnessFactor=mix(roughnessFactor,.1,skinEye);`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    {
     // Bump from the procedural relief (screen-space derivatives; the mipmapped maps fade it with distance).
     vec3 dpx=dFdx(-vViewPosition),dpy=dFdy(-vViewPosition);vec2 dh=vec2(dFdx(skinH),dFdy(skinH))*.03;
     vec3 r1=cross(dpy,normal),r2=cross(normal,dpx);float det=dot(dpx,r1)*faceDirection;
     normal=normalize(abs(det)*normal-sign(det)*(dh.x*r1+dh.y*r2));
    }`)
   .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    // Baked occlusion shades the ambient under the belly, between the legs and in folds.
    reflectedLight.indirectDiffuse*=mix(.35,1.,vAux.x);reflectedLight.indirectSpecular*=mix(.2,1.,vAux.x);`);
 };
 m.customProgramCacheKey=()=> 'rex-brachio-v4';
 // Her shadow follows the posed neck and tail.
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
 depth.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>\nattribute vec4 aux;attribute float spine;${CHAIN}`)
   .replace('#include <begin_vertex>','#include <begin_vertex>\n{vec3 n=vec3(0.,1.,0.);brachioPose(transformed,n,spine*.001,floor(aux.z*255.+.5),aux.w);}');};
 depth.customProgramCacheKey=()=> 'rex-brachio-depth-v3';
 return{material:m,depth};
}

/** brachio.bin: u32 header length, JSON header, then position f32x3, normal i8x4, aux u8x4, spine u16 (mm), indices. */
function parse(buffer){
 const n=new Uint32Array(buffer,0,1)[0],header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,n)));let o=4+n;
 const take=(Type,count)=>{const a=new Type(buffer,o,count);o+=a.byteLength;o+=(4-o%4)%4;return a;};
 const V=header.vertices,pos=take(Float32Array,V*3),nrm=take(Int8Array,V*4),aux=take(Uint8Array,V*4),spine=take(Uint16Array,V),index=take(V>65535?Uint32Array:Uint16Array,header.indices);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
 g.setAttribute('normal',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(nrm,4),3,0,true));
 g.setAttribute('aux',new T.BufferAttribute(aux,4,true));g.setAttribute('spine',new T.BufferAttribute(spine,1));g.setIndex(new T.BufferAttribute(index,1));
 g.computeBoundingSphere();g.boundingSphere.radius+=2.5;return{geometry:g,header};
}

export function createBrachio(scene,{jungle}){
 const uniforms={uNeck:{value:[0,1,2,3,4].map(()=>new T.Vector4())},uNeckRot:{value:[0,1,2,3,4].map(()=>new T.Vector3())},uTail:{value:[0,1,2,3].map(()=>new T.Vector4())},uTailRot:{value:[0,1,2,3].map(()=>new T.Vector3())},uJawHinge:{value:new T.Vector3()},uJaw:{value:0},uBreath:{value:0},uRear:{value:new T.Vector3()}};
 uniforms.uFold={value:new T.Vector2()};uniforms.uEye={value:[new T.Vector3(),new T.Vector3()]};uniforms.uEyeR={value:.1};uniforms.uNostril={value:[new T.Vector3(),new T.Vector3()]};uniforms.uNostrilR={value:.07};const {material,depth}=brachioMaterial(uniforms,skinMaps());
 const mesh=new T.Mesh(new T.BufferGeometry(),material);mesh.customDepthMaterial=depth;mesh.receiveShadow=true;mesh.castShadow=true;mesh.visible=false;mesh.name='Brachiosaur';scene.add(mesh);
 let header=null,on=false,travel=0,next=0,clock=0,lift=0,called=false,pending=null,wanted=null,rear=-1,stomped=true,proxies=[],api;
 function load(file){if(file===wanted)return;wanted=file;
  fetch('./models/'+file).then(r=>{if(!r.ok)throw Error(file+' '+r.status);return r.arrayBuffer();}).then(buf=>{
  if(file!==wanted)return;const parsed=parse(buf);header=parsed.header;mesh.geometry.dispose();mesh.geometry=parsed.geometry;
  header.neck.forEach((j,i)=>uniforms.uNeck.value[i].set(...j.p,j.s));header.tail.forEach((j,i)=>uniforms.uTail.value[i].set(...j.p,j.s));uniforms.uJawHinge.value.set(...header.jaw.hinge);uniforms.uFold.value.set(header.neck[0].s-2,header.neck[2].s);header.eyes.centres.forEach((c,i)=>uniforms.uEye.value[i].set(...c));uniforms.uEyeR.value=header.eyes.radius;header.nostrils.centres.forEach((c,i)=>uniforms.uNostril.value[i].set(...c));uniforms.uNostrilR.value=header.nostrils.radius;
  buildProxies();if(pending){place(...pending);pending=null;}
 }).catch(e=>console.warn('Brachiosaur unavailable:',e.message));}
 // The tier picks the model (setQuality runs right after creation); without one, the full model.
 queueMicrotask(()=>{if(!wanted)load('brachio.bin');});
 function place(x,z,yaw){if(!header){pending=[x,z,yaw];return;}on=true;called=false;lift=0;rear=-1;stomped=true;mesh.position.set(x,jungle.groundAt(x,z),z);mesh.rotation.y=yaw;mesh.scale.setScalar(range(.95,1.05));}
 function pose(){
  const t=clock,browse=1-lift;
  // A sauropod browses slowly: the neck holds nearly still (about 5 degrees of drift in
  // all), the head makes small deliberate nods and turns, the stiff tail swings a few
  // degrees. Big joint-by-joint swings read as jelly. Calling, she lifts her head about
  // 20 degrees with the jaw open.
  const drift=Math.sin(t*.13)*.016+Math.sin(t*.29+1)*.006,nod=Math.sin(t*.21+2)*.008;
  // The call eases in and out; a lift that ended by snapping to zero jerked the neck down in one frame.
  const u=1-lift,call=lift>0?T.MathUtils.smoothstep(u,0,.22)*(1-T.MathUtils.smoothstep(u,.62,1)):0;
  const R=uniforms.uNeckRot.value;
  R[0].set(nod+call*.04,drift,0);R[1].set(nod*.8+call*.04,drift,0);R[2].set(call*.05,drift*.8,0);R[3].set(call*.06,drift*.8,0);
  R[4].set((Math.sin(t*.37)*.045-.03)*browse+call*.16,Math.sin(t*.23+.4)*.07*browse,0);
  uniforms.uTailRot.value.forEach((r,i)=>r.set(0,Math.sin(t*.27-i*.15)*(.012+i*.006),0));
  // Rearing: the neck counter-pitches forward so it reaches up rather than leaning back,
  // with a slow nod as she strips the canopy at the top; the tail comes down as a prop.
  const th=rearAngle(rear),top=th/REAR.peak;
  REAR.neck.forEach((k,j)=>R[j].x+=k*th);R[4].x+=Math.sin(Math.max(0,rear)*2.2)*.07*top*top;
  uniforms.uTailRot.value[0].x+=REAR.tail*th;uniforms.uRear.value.set(th,REAR.swing*th,REAR.fold*th);
  uniforms.uJaw.value=lift>0?.3*Math.sin(Math.min(1,u*2.4)*Math.PI):Math.max(0,Math.sin(t*1.6))*.02*browse;
  uniforms.uBreath.value=Math.sin(t*1.05)*.5;
 }
 // A point on the head, posed on the CPU with the same neck chain as the shader (for her call).
 const v=new T.Vector3(),pivot=new T.Vector3(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ');
 function headRest(){return posePoint(v.set(...(header?.head||[0,13.45,7.6])),Infinity,'neck');}
 const ss=T.MathUtils.smoothstep;
 function turnAbout(p,J,r,w){e.set(-r.x*w,r.y*w,0);q.setFromEuler(e);p.sub(pivot.set(J.x,J.y,J.z)).applyQuaternion(q).add(pivot);}
 function pitchAbout(p,[,py,pz],a){const c=Math.cos(a),si=Math.sin(a),y=p.y-py,z=p.z-pz;p.y=py+c*y+si*z;p.z=pz-si*y+c*z;}
 /** CPU copy of the shader pose for a rest-space point on the neck, tail, body or a leg. */
 function posePoint(p,s,kind){
  if(kind==='neck')for(let j=4;j>=0;j--){const J=uniforms.uNeck.value[j],w=ss(s,J.w-.45,J.w+.45);if(w>.001)turnAbout(p,J,uniforms.uNeckRot.value[j],w);}
  if(kind==='tail')for(let j=3;j>=0;j--){const J=uniforms.uTail.value[j],w=1-ss(s,J.w-.45,J.w+.45);if(w>.001)turnAbout(p,J,uniforms.uTailRot.value[j],w);}
  const r=uniforms.uRear.value;
  if(r.x>0){if(kind==='fore'){if(p.y<WRIST[1])pitchAbout(p,WRIST,-r.z);pitchAbout(p,SHOULDER,-r.y);}if(kind!=='hind')pitchAbout(p,HIP,r.x);}
  return p;
 }
 // Hit volumes: capsules (as chains of points with radii) along the tail, body, neck and legs.
 function buildProxies(){
  const N=header.neck,Tl=header.tail,pt=(p,r,s,kind)=>({rest:new T.Vector3(...p),r,s,kind});
  proxies=[
   [pt([0,2.75,-6.9],.15,0,'tail'),pt(Tl[3].p,.3,Tl[3].s,'tail'),pt(Tl[2].p,.4,Tl[2].s,'tail'),pt(Tl[1].p,.5,Tl[1].s,'tail'),pt(Tl[0].p,.75,Tl[0].s,'tail')],
   [pt([0,3.9,-3],1.2,0,'body'),pt([0,4.4,-1.4],1.9,0,'body'),pt([0,4.6,.6],1.9,0,'body'),pt([0,4.8,2.3],1.3,0,'body')],
   [pt([0,5.4,2.7],1.1,N[0].s-1.8,'neck'),...N.map((j,i)=>pt(j.p,[.95,.75,.6,.5,.45][i],j.s,'neck')),pt(header.head,.42,header.spineLength,'neck')],
   ...[-1,1].map(x=>[pt([x*1.1,.25,2.05],.42,0,'fore'),pt([x*1.1,1.4,2],.4,0,'fore'),pt([x*1.1,3,2.1],.55,0,'fore')]),
   ...[-1,1].map(x=>[pt([x*1.12,.25,-1.35],.5,0,'hind'),pt([x*1.12,3.4,-1.6],.7,0,'hind')]),
  ];
 }
 const local=new T.Ray(),inverse=new T.Matrix4(),pa=new T.Vector3(),pb=new T.Vector3(),pc=new T.Vector3(),oc=new T.Vector3();
 /** Distance along a (unit) ray to a sphere's surface, 0 if the origin is inside, -1 for a miss. */
 function sphereT(ray,c,r){oc.subVectors(c,ray.origin);const t=oc.dot(ray.direction),d2=oc.lengthSq()-t*t;if(d2>r*r)return -1;const h=Math.sqrt(r*r-d2);return t-h>=0?t-h:t+h>=0?0:-1;}
 api={
  mesh,onCall:null,onStomp:null,uniforms,
  /** Captures can hold a pose set by hand in uniforms. */
  hold:false,
  get active(){return on;},get ready(){return !!header;},
  /** Place her by the road (x, z in the Jeep frame), side-on with her head toward the track. */
  show(x=-12,z=20,yaw){const side=Math.sign(x)||1;place(x,z,yaw??-side*Math.PI/2+range(-.35,.35));},
  setQuality(t){mesh.castShadow=!!t.detail;load(t.detail?'brachio.bin':'brachio-low.bin');},
  reset({menu=false}={}){on=false;pending=null;mesh.visible=false;travel=0;next=range(320,480);rear=-1;stomped=true;
   // The menu's slow drift gives a long look: she browses over the road beyond the Rex.
   if(menu)api.show(-9.5,40,Math.PI/2-.1);},
  update(dt,{speed=0,visible=true}={}){
   clock+=dt;
   if(!on&&!pending){travel+=speed*dt;if(speed>4&&travel>=next){travel=0;next=range(900,1400);const side=rnd()<.5?-1:1;api.show(side*range(11,14),-80);}}
   mesh.visible=on&&visible;if(!on)return;
   mesh.position.z+=speed*dt;mesh.position.y=jungle.groundAt(mesh.position.x,mesh.position.z);
   // She calls as the chase comes level with her; the menu (silent until Start) only shows her browsing.
   if(!called&&speed>4&&mesh.position.z>12&&mesh.position.z<60){called=true;lift=1;api.onCall?.(api.headPosition());}
   if(rear>=0){rear+=dt;if(!stomped&&rear>=REAR.duration){stomped=true;api.onStomp?.(api.forefeet());}if(rear>=REAR.duration+.5)rear=-1;}
   lift=Math.max(0,lift-dt*.3);if(!api.hold)pose();
   if(mesh.position.z>170)on=false;
  },
  headPosition(){mesh.updateMatrixWorld();return headRest().applyMatrix4(mesh.matrixWorld);},
  /** Where her forefeet meet the ground, in world space. */
  forefeet(){mesh.updateMatrixWorld();return [-1,1].map(x=>mesh.localToWorld(new T.Vector3(x*1.1,0,2.1)));},
  get rearing(){return rear>=0;},
  /** Shot: she trumpets and rears up, unless she is already up. Returns whether she started. */
  startle(){if(!on||!header||rear>=0)return false;rear=0;stomped=false;called=true;lift=1;api.onCall?.(api.headPosition());return true;},
  /** Review stills: hold the rear at time t (seconds since the shot). */
  rearAt(t){rear=t;stomped=true;pose();},
  /** The nearest point where a world-space ray strikes her, or null. */
  hit(ray){
   if(!on||!mesh.visible||!header)return null;
   mesh.updateMatrixWorld();local.copy(ray).applyMatrix4(inverse.copy(mesh.matrixWorld).invert());let best=Infinity;
   for(const chain of proxies)chain.forEach((p,i)=>{posePoint(pb.copy(p.rest),p.s,p.kind);
    if(i){const prev=chain[i-1].r,steps=Math.max(1,Math.ceil(pa.distanceTo(pb)/(Math.min(prev,p.r)*.8)));
     for(let k=0;k<=steps;k++){const t=sphereT(local,pc.lerpVectors(pa,pb,k/steps),prev+(p.r-prev)*k/steps);if(t>=0&&t<best)best=t;}}
    pa.copy(pb);});
   if(best===Infinity)return null;
   const point=local.at(best,new T.Vector3()).applyMatrix4(mesh.matrixWorld);return{point,distance:point.distanceTo(ray.origin)};
  }
 };
 api.reset({menu:true});return api;
}
