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
const CHAIN=`
 uniform vec4 uNeck[5];uniform vec3 uNeckRot[5];uniform vec4 uTail[4];uniform vec3 uTailRot[4];uniform vec3 uJawHinge;uniform float uJaw,uBreath;
 // Pitch (x, up positive) then yaw (y).
 mat3 rotPY(vec3 a){float cp=cos(a.x),sp=sin(a.x),cy=cos(a.y),sy=sin(a.y);return mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy)*mat3(1.,0.,0.,0.,cp,-sp,0.,sp,cp);}
 // Joint chains, distal joint first about rest-pose pivots: each joint's turn blends
 // in over +-0.45 m of spine so the neck curves rather than kinks.
 void brachioPose(inout vec3 p,inout vec3 n,float s,float region){
  if(abs(region-3.)<.5){float c=cos(uJaw),si=sin(uJaw);vec3 q=p-uJawHinge;q.yz=vec2(c*q.y-si*q.z,si*q.y+c*q.z);p=uJawHinge+q;n.yz=vec2(c*n.y-si*n.z,si*n.y+c*n.z);}
  if(region<.5){p.x*=1.+uBreath*.012;p.y=4.3+(p.y-4.3)*(1.+uBreath*.006);}
  for(int j=4;j>=0;j--){float w=smoothstep(uNeck[j].w-.45,uNeck[j].w+.45,s);if(w>.001){mat3 R=rotPY(uNeckRot[j]*w);p=uNeck[j].xyz+R*(p-uNeck[j].xyz);n=R*n;}}
  for(int j=3;j>=0;j--){float w=1.-smoothstep(uTail[j].w-.45,uTail[j].w+.45,s);if(w>.001){mat3 R=rotPY(uTailRot[j]*w);p=uTail[j].xyz+R*(p-uTail[j].xyz);n=R*n;}}
 }`;

function brachioMaterial(uniforms,skin){
 const m=new T.MeshStandardMaterial({roughness:.82,metalness:0});
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms,{tSkin:{value:skin},uWet:WET});
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   attribute vec4 aux;attribute float spine;varying vec3 vRest;varying vec3 vRestN;varying vec4 vAux;varying float vSpine;${CHAIN}`)
   .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    vec3 posedP=position;vRest=position;vRestN=objectNormal;vAux=aux;vSpine=spine*.001;
    brachioPose(posedP,objectNormal,vSpine,floor(aux.z*255.+.5));`)
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
    bool limb=region>5.5&&region<7.5,claw=region>4.5&&region<5.5;
    // Relief: pebbly scales everywhere, folded hide in the creases, folds across the
    // throat side of the lower neck, rings up the legs.
    float neckFront=smoothstep(.1,.6,-vRestN.y*.6+vRestN.z*.8)*smoothstep(uFold.x,uFold.x+1.5,vSpine)*(1.-smoothstep(uFold.y-2.,uFold.y,vSpine));
    float folds=neckFront*pow(.5+.5*sin(vSpine*17.+coarse.g*3.),3.)*.9;
    // Leg wrinkles wander and break up, like an elephant's, rather than stacking into rings.
    float rings=limb?pow(.5+.5*sin(vRest.y*24.+coarse.g*7.+broad.b*9.+vRest.x*3.),3.)*smoothstep(.35,.75,coarse.b+fine.r*.2)*(1.-smoothstep(3.6,4.8,vRest.y)):0.;
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
    vec3 back=vec3(.036,.042,.036),flank=vec3(.07,.072,.058),belly=vec3(.15,.14,.112);
    vec3 col=mix(belly,flank,smoothstep(-.7,.05,up));col=mix(col,back,smoothstep(.15,.75,up));
    col*=.72+.56*broad.b;col*=1.-.22*smoothstep(.55,.8,coarse.b)*smoothstep(-.1,.5,up);
    // Faint darker saddles across the back and up the neck, broken by the mottling.
    col*=1.-.2*smoothstep(.55,.95,.5+.5*sin(vSpine*1.9+broad.b*2.5))*smoothstep(-.2,.6,up);
    col*=1.+.24*(fine.r-.5)*fineFade;
    skinMud=(1.-smoothstep(.25,1.6+coarse.b*.8,vRest.y))*(limb||claw?1.:.35);
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
 m.customProgramCacheKey=()=> 'rex-brachio-v2';
 // Her shadow follows the posed neck and tail.
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
 depth.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>\nattribute vec4 aux;attribute float spine;${CHAIN}`)
   .replace('#include <begin_vertex>','#include <begin_vertex>\n{vec3 n=vec3(0.,1.,0.);brachioPose(transformed,n,spine*.001,floor(aux.z*255.+.5));}');};
 depth.customProgramCacheKey=()=> 'rex-brachio-depth-v2';
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
 const uniforms={uNeck:{value:[0,1,2,3,4].map(()=>new T.Vector4())},uNeckRot:{value:[0,1,2,3,4].map(()=>new T.Vector3())},uTail:{value:[0,1,2,3].map(()=>new T.Vector4())},uTailRot:{value:[0,1,2,3].map(()=>new T.Vector3())},uJawHinge:{value:new T.Vector3()},uJaw:{value:0},uBreath:{value:0}};
 uniforms.uFold={value:new T.Vector2()};uniforms.uEye={value:[new T.Vector3(),new T.Vector3()]};uniforms.uEyeR={value:.1};uniforms.uNostril={value:[new T.Vector3(),new T.Vector3()]};uniforms.uNostrilR={value:.07};const {material,depth}=brachioMaterial(uniforms,skinMaps());
 const mesh=new T.Mesh(new T.BufferGeometry(),material);mesh.customDepthMaterial=depth;mesh.receiveShadow=true;mesh.castShadow=true;mesh.visible=false;mesh.name='Brachiosaur';scene.add(mesh);
 let header=null,on=false,travel=0,next=0,clock=0,lift=0,called=false,pending=null,wanted=null,api;
 function load(file){if(file===wanted)return;wanted=file;
  fetch('./models/'+file).then(r=>{if(!r.ok)throw Error(file+' '+r.status);return r.arrayBuffer();}).then(buf=>{
  if(file!==wanted)return;const parsed=parse(buf);header=parsed.header;mesh.geometry.dispose();mesh.geometry=parsed.geometry;
  header.neck.forEach((j,i)=>uniforms.uNeck.value[i].set(...j.p,j.s));header.tail.forEach((j,i)=>uniforms.uTail.value[i].set(...j.p,j.s));uniforms.uJawHinge.value.set(...header.jaw.hinge);uniforms.uFold.value.set(header.neck[0].s-2,header.neck[2].s);header.eyes.centres.forEach((c,i)=>uniforms.uEye.value[i].set(...c));uniforms.uEyeR.value=header.eyes.radius;header.nostrils.centres.forEach((c,i)=>uniforms.uNostril.value[i].set(...c));uniforms.uNostrilR.value=header.nostrils.radius;
  if(pending){place(...pending);pending=null;}
 }).catch(e=>console.warn('Brachiosaur unavailable:',e.message));}
 // The tier picks the model (setQuality runs right after creation); without one, the full model.
 queueMicrotask(()=>{if(!wanted)load('brachio.bin');});
 function place(x,z,yaw){if(!header){pending=[x,z,yaw];return;}on=true;called=false;lift=0;mesh.position.set(x,jungle.groundAt(x,z),z);mesh.rotation.y=yaw;mesh.scale.setScalar(range(.95,1.05));}
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
  uniforms.uJaw.value=lift>0?.3*Math.sin(Math.min(1,u*2.4)*Math.PI):Math.max(0,Math.sin(t*1.6))*.02*browse;
  uniforms.uBreath.value=Math.sin(t*1.05)*.5;
 }
 // A point on the head, posed on the CPU with the same neck chain as the shader (for her call).
 const v=new T.Vector3(),pivot=new T.Vector3(),q=new T.Quaternion(),e=new T.Euler(0,0,0,'YXZ');
 function headRest(){
  v.set(...(header?.head||[0,13.45,7.6]));
  for(let j=4;j>=0;j--){const J=uniforms.uNeck.value[j],r=uniforms.uNeckRot.value[j];e.set(-r.x,r.y,0);q.setFromEuler(e);v.sub(pivot.set(J.x,J.y,J.z)).applyQuaternion(q).add(pivot);}
  return v;
 }
 api={
  mesh,onCall:null,uniforms,
  /** Captures can hold a pose set by hand in uniforms. */
  hold:false,
  get active(){return on;},get ready(){return !!header;},
  /** Place her by the road (x, z in the Jeep frame), side-on with her head toward the track. */
  show(x=-12,z=20,yaw){const side=Math.sign(x)||1;place(x,z,yaw??-side*Math.PI/2+range(-.35,.35));},
  setQuality(t){mesh.castShadow=!!t.detail;load(t.detail?'brachio.bin':'brachio-low.bin');},
  reset({menu=false}={}){on=false;pending=null;mesh.visible=false;travel=0;next=range(320,480);
   // The menu's slow drift gives a long look: she browses over the road beyond the Rex.
   if(menu)api.show(-11,34,Math.PI/2-.2);},
  update(dt,{speed=0,visible=true}={}){
   clock+=dt;
   if(!on&&!pending){travel+=speed*dt;if(speed>4&&travel>=next){travel=0;next=range(900,1400);const side=rnd()<.5?-1:1;api.show(side*range(11,14),-80);}}
   mesh.visible=on&&visible;if(!on)return;
   mesh.position.z+=speed*dt;mesh.position.y=jungle.groundAt(mesh.position.x,mesh.position.z);
   // She calls as the chase comes level with her; the menu (silent until Start) only shows her browsing.
   if(!called&&speed>4&&mesh.position.z>12&&mesh.position.z<60){called=true;lift=1;api.onCall?.(api.headPosition());}
   lift=Math.max(0,lift-dt*.3);if(!api.hold)pose();
   if(mesh.position.z>170)on=false;
  },
  headPosition(){mesh.updateMatrixWorld();return headRest().applyMatrix4(mesh.matrixWorld);}
 };
 api.reset({menu:true});return api;
}
