import * as T from 'three';
import {WET,RAIN,RAIN_TIME,NIGHT} from './weather-state.js';
import {WATER,FORD,WET_MAP,riverCentre,riverReach} from './river.js';
import {fordHeight} from './environment.js';
// The river ford: the water itself, everything the Jeep and the Rex throw out of it,
// and the wet ground they leave behind. Physics first (principle 1):
// - A body moving through water at road speed pierces the surface and turns the water
//   it meets outward and up. The Jeep's front wheels peel it off as two steady side
//   sheets ("wings") that stream back along the doors; the rear tyres fling it off
//   their trailing face as rooster tails. Both are drawn as the steady-state surface
//   of the spray (every point is a parcel launched from the wheel t seconds ago), torn
//   into ligaments as it flies, plus loose drops and a lingering mist.
// - The Rex's feet plunge (a crown and a radial sheet) and her swinging legs plough
//   forward through the surface, throwing water ahead of each stride.
// - The water answers with a V wake (shallow-water waves travel at sqrt(g*h), about
//   2 m/s here, so at road speed the wake is a narrow V), churned foam in the tracks
//   and rings round each footfall, all drifting downstream.
// - Water that lands on the banks and road darkens it, tyres print wet tracks for a
//   few tens of metres and her feet leave wet prints; all of it is painted into a map
//   that rides with the road (river.js WET_MAP) and dries slowly.
// Everything lives in the Jeep's frame (the road and the air move at +speed along z).

const DROPS=2600,RINGS=12,STONES=16,GRAVITY=9.8,TAU=Math.PI*2;
const SPAWN_AFTER=45; // metres of pursuit before the ford is laid out ahead (~13 s later the Jeep reaches it)
let seed=5077;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};

// ---- Water surface --------------------------------------------------------

/** Tileable ripple field: normal xy in RG, a foam/bubble texture in B. */
function rippleTexture(){
 const N=128,h=new Float32Array(N*N),f=new Float32Array(N*N);
 const waves=[...Array(16)].map(()=>{let kx=0,ky=0;while(!kx&&!ky){kx=Math.round((rnd()-.5)*14);ky=Math.round((rnd()-.5)*10);}return{kx,ky,a:(.4+rnd())/Math.hypot(kx,ky),ph:rnd()*TAU};});
 const bubbles=[...Array(22)].map(()=>{let kx=0,ky=0;while(!kx&&!ky){kx=Math.round((rnd()-.5)*40);ky=Math.round((rnd()-.5)*40);}return{kx,ky,ph:rnd()*TAU};});
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){let v=0,b=0;for(const w of waves)v+=w.a*Math.sin(TAU*(w.kx*x+w.ky*y)/N+w.ph);for(const w of bubbles)b+=Math.sin(TAU*(w.kx*x+w.ky*y)/N+w.ph);h[y*N+x]=v;f[y*N+x]=b;}
 let fmin=Infinity,fmax=-Infinity;for(const v of f){fmin=Math.min(fmin,v);fmax=Math.max(fmax,v);}
 const out=new Uint8Array(N*N*4);
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,dx=h[y*N+(x+1)%N]-h[y*N+(x+N-1)%N],dy=h[((y+1)%N)*N+x]-h[((y+N-1)%N)*N+x];
  out[i*4]=Math.max(0,Math.min(255,128-dx*40));out[i*4+1]=Math.max(0,Math.min(255,128-dy*40));out[i*4+2]=(f[i]-fmin)/(fmax-fmin)*255;out[i*4+3]=255;}
 const t=new T.DataTexture(out,N,N,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}

/** The river surface over the carved channel, with the bed height baked per vertex. */
function waterGeometry(){
 const xs=[];for(let x=-64;x<-14;x+=2.5)xs.push(x);for(let x=-14;x<14;x+=.4)xs.push(x);for(let x=14;x<=64;x+=2.5)xs.push(x);
 const rows=48,P=[],N=[],B=[],I=[];
 for(const x of xs){const c=riverCentre(x),w=riverReach(x);for(let r=0;r<rows;r++){const z=Math.max(-13.95,Math.min(13.95,c+(r/(rows-1)*2-1)*w));P.push(x,WATER,z);N.push(0,1,0);B.push(fordHeight(x,z));}}
 for(let i=0;i<xs.length-1;i++)for(let r=0;r<rows-1;r++){const a=i*rows+r,b=a+rows,c=a+1,d=b+1;I.push(a,c,b,b,c,d);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('bed',new T.Float32BufferAttribute(B,1));g.setIndex(I);g.computeBoundingSphere();return g;
}

// The disturbance of the surface at a chunk-local point: wakes behind each mover
// (the Jeep, the Rex), rings round footfalls and splashes, collars and trailing foam
// at stones. Returns height; writes the height gradient and foam. Shared by the
// vertex (displacement) and fragment (normal, foam) stages.
const WAVES_GLSL=`
 uniform vec4 uMover[2],uMoverB[2],uRing[${RINGS}],uStone[${STONES}];uniform int uRingN,uStoneN;uniform float uFlow;
 float riverWaves(vec2 p,out vec2 grad,out float foam,out float churn){
  float h=0.;grad=vec2(0.);foam=0.;churn=0.;
  for(int i=0;i<2;i++){
   // Mover: x lane, y its z now (it travels toward -z), w strength; B: x half-width, y speed.
   vec4 m=uMover[i],b=uMoverB[i];if(m.w<=0.)continue;
   float tau=(p.y-m.y)/b.y,lat=p.x-m.x-uFlow*max(tau,0.),d=abs(lat),side=lat<0.?-1.:1.;
   if(tau<-.3)continue;
   if(tau<0.){
    // Bow wave: water heaped ahead of the body.
    float k=smoothstep(-.3,0.,tau)*m.w,e=exp(-d*d/(b.x*b.x)*1.4);h+=.1*k*e;grad.x-=.1*k*e*2.8*d/(b.x*b.x)*side;continue;
   }
   // Crests break up along their length (a real wake is lumpy, not ruled lines).
   float env=m.w*exp(-tau*.45)*(.55+.45*sin(p.y*1.7+d*2.3+float(i)*2.)*sin(p.y*.63+1.3)),r=b.x+2.*tau,x=d-r,k=5./(1.+tau),g=exp(-x*x*k);
   // The leading crest of the V, a smaller one inside it, and the trough the body dug.
   h+=.085*env*g*cos(x*4.);float dh=.085*env*g*(-2.*x*k*cos(x*4.)-4.*sin(x*4.));
   float x2=d-r*.68,g2=exp(-x2*x2*8.);h+=.035*env*g2*cos(x2*7.);dh+=.035*env*g2*(-16.*x2*cos(x2*7.)-7.*sin(x2*7.));
   float s2=b.x*b.x*1.6,tr=exp(-d*d/s2)*exp(-tau*1.3)*m.w;h-=.09*tr;dh+=.09*tr*2.*d/s2;
   grad.x+=dh*side;
   // Churned water in the tracks, whitest just behind the body, and white along the crest.
   float c=m.w*exp(-tau*.28)*smoothstep(b.x+.5+.7*tau,b.x*.2,d);churn+=c;foam+=c*exp(-tau*1.8)*.8+g*env*exp(-tau*.8)*.35;
  }
  for(int i=0;i<${RINGS};i++){
   if(i>=uRingN)break;vec4 r=uRing[i];vec2 dv=p-r.xy;float d=length(dv)+1e-4,age=r.z,R=.25+2.1*age,x=d-R,e=r.w*exp(-age*1.25),g=exp(-x*x*7.);
   h+=.07*e*g*cos(x*6.);grad+=.07*e*g*(-14.*x*cos(x*6.)-6.*sin(x*6.))*dv/d;
   float w=r.w*exp(-age*2.2);foam+=w*(smoothstep(R*.8+.3,R*.1,d)*.8+g*.3);churn+=r.w*exp(-age*.6)*smoothstep(R+.6,0.,d)*.7;
  }
  for(int i=0;i<${STONES};i++){
   if(i>=uStoneN)break;vec4 s=uStone[i];vec2 dv=p-s.xy;float d=length(dv),dx=dv.x;
   // A white collar where the current piles against the stone, and a trailing seam of foam in its lee.
   foam+=smoothstep(s.z*.8+.3,s.z*.8,d)*.8+step(0.,dx)*exp(-dx/(1.6+s.z*2.))*smoothstep(s.z*(.7+dx*.12)+.15,s.z*.15,abs(dv.y))*.6;
  }
  return h;
 }`;

function waterMaterial({canopy}){
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.05,metalness:0,transparent:true,envMapIntensity:1.15});
 const uniforms={
  uMover:{value:[new T.Vector4(),new T.Vector4()]},uMoverB:{value:[new T.Vector4(1,10,0,0),new T.Vector4(1,10,0,0)]},
  uRing:{value:Array.from({length:RINGS},()=>new T.Vector4())},uRingN:{value:0},uStone:{value:Array.from({length:STONES},()=>new T.Vector4())},uStoneN:{value:0},
  uFlow:{value:.75},uFlowPhase:{value:new T.Vector3(0,.5,1)},tRipple:{value:rippleTexture()},
  uWet:WET,uRain:RAIN,uRainT:RAIN_TIME,
  uRexBody:{value:new T.Vector4()},uRexLeg:{value:[new T.Vector4(),new T.Vector4()]},
  tCanopyW:{value:canopy?.texture||null},uCanopyW:{value:new T.Vector4(canopy?.height||17,canopy?.scale||72,0,canopy?1:0)},uCanopyOff:{value:canopy?.offset||new T.Vector2()}
 };
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,uniforms);
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   attribute float bed;varying float vBed;varying vec3 vWaterL,vWaterW;${WAVES_GLSL}`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
   {vec2 g;float f,c;float h=riverWaves(position.xz,g,f,c);transformed.y+=h;vWaterL=transformed;vBed=bed;vWaterW=(modelMatrix*vec4(transformed,1.)).xyz;}`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying float vBed;varying vec3 vWaterL,vWaterW;uniform vec3 uFlowPhase;uniform sampler2D tRipple,tCanopyW;uniform float uWet,uRain,uRainT;uniform vec4 uCanopyW,uRexBody,uRexLeg[2];uniform vec2 uCanopyOff;
   ${WAVES_GLSL}
   float wFoam,wChurn,wDepth;vec3 wNormal;
   float wHash(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
   // Raindrop rings on the river, one drop per 0.4 m cell on its own clock (as on the road's puddles).
   vec2 wRain(vec2 uv,float t){
    vec2 g=vec2(0.),cell=floor(uv);
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
     vec2 c=cell+vec2(i,j),k=vec2(c.x,mod(c.y,70.));float h=wHash(k+.37),period=.6+.4*wHash(k+5.1),age=fract(t/period+h);
     vec2 d=uv-(c+.2+.6*vec2(wHash(k+2.3),wHash(k+8.9)));float r=length(d),x=(r-age*1.1)*9.;
     g+=d/max(r,1e-3)*cos(x*3.1416)*smoothstep(1.,0.,abs(x))*pow(1.-age,2.);
    }
    return g;
   }`)
  .replace('#include <map_fragment>',`
   {
    vec2 p=vWaterL.xz,grad;float h=riverWaves(p,grad,wFoam,wChurn);
    wDepth=${WATER.toFixed(2)}+h-vBed;
    // Current: two copies of the ripple tile slide downstream (+x) half a cycle apart and
    // cross-fade, so the flow never needs an ever-growing offset.
    vec2 fa=vec2(uFlowPhase.x*4.,0.),fb=vec2(uFlowPhase.y*4.,0.);
    vec4 ra=texture2D(tRipple,(p-fa)*.21),rb=texture2D(tRipple,(p-fb)*.21),rc=texture2D(tRipple,(p-fa*1.7)*.53+.37);
    vec4 rip=mix(ra,rb,uFlowPhase.z),rd=texture2D(tRipple,(p-fb*2.3)*1.37+.71);
    // Smooth, glassy water in the deep pools; choppier over the gravel riffle and in the wakes.
    float chop=.35+.45*smoothstep(.55,.3,wDepth)+min(1.,wChurn)*.8;
    grad+=((rip.xy*2.-1.)*.09+(rc.xy*2.-1.)*.05+(rd.xy*2.-1.)*.03)*chop;
    if(uRain>.01)grad+=wRain(p*2.5,uRainT)*.05*uRain;
    wNormal=normalize(vec3(-grad.x,1.,-grad.y));
    // Foam: broken up by the bubble texture, a scum line at the water's edge, and a few
    // streaks carried down from the rapids upstream.
    float bub=mix(rip.z,rc.z,.5);
    float shore=smoothstep(.07,0.,wDepth)*smoothstep(.45,.7,bub);
    float drift=smoothstep(.82,.95,bub)*smoothstep(.62,.8,texture2D(tRipple,(p-fa*.6)*vec2(.05,.16)).z)*.5;
    wFoam=clamp(wFoam*smoothstep(.15,.65,bub+wFoam*.35)+shore+drift,0.,1.);
    // Silty jungle water: dark olive-brown; where the crossing stirred up the bed, a cloud
    // of paler, warmer silt that drifts and settles.
    float silt=clamp(wChurn*(.55+.5*bub),0.,1.);
    vec3 body=mix(vec3(.03,.032,.019),vec3(.062,.047,.03),silt);
    float murk=1.-exp(-max(wDepth,0.)*(6.5+silt*10.));
    diffuseColor.rgb=mix(body,vec3(.56,.54,.47),wFoam);
    diffuseColor.a=clamp(max(murk,wFoam*smoothstep(-.02,.02,wDepth)),0.,1.)*smoothstep(-.03,.01,wDepth);
    if(diffuseColor.a<.004)discard;
   }`)
  .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(.05,.6,wFoam)+uRain*.05;`)
  .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   normal=normalize((viewMatrix*vec4(wNormal,0.)).xyz);`)
  .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   {
    // What the river mirrors. The environment map is open sky, so trace the reflected ray
    // against the jungle instead: tree walls line the road ~10 m out and the river banks
    // further along x, the canopy closes overhead at ~17 m (read through the same gap
    // mask that dapples the road), and the Rex herself stands in the water.
    vec3 P=vWaterW,V=normalize(P-cameraPosition),r=reflect(V,wNormal);float gap=0.;vec3 seen=vec3(1.1);
    if(r.y>.005){
     float lz=vWaterL.z,wallX=(r.x>0.?10.:9.)+1.6*sin(lz*.23+(r.x>0.?1.:4.))+4.*step(.7,abs(r.x)/length(r.xz));
     float tx=abs(r.x)>.001?(sign(r.x)*wallX-P.x)/r.x:1e4,tc=(uCanopyW.x-P.y)/r.y;
     if(tx>0.&&tx<tc){float y=P.y+r.y*tx;gap=smoothstep(7.,16.,y)*.35*(.6+.4*sin(lz*1.7+y*.9));}
     else if(uCanopyW.w>.5){vec2 q=P.xz+r.xz*tc-uCanopyOff;gap=texture2D(tCanopyW,vec2(q.x/uCanopyW.y+.5,(q.y-uCanopyW.z)/uCanopyW.y)).r;}
     gap*=smoothstep(.005,.08,r.y);
    }
    seen=mix(vec3(.13,.18,.09),vec3(1.1),gap);
    // Her body (an ellipsoid) and legs (vertical columns) block the sky in the reflection.
    if(uRexBody.w>.5&&r.y>0.){
     vec3 e=vec3(1.35,1.5,3.6),o=(P-uRexBody.xyz)/e,dd=r/e;float b=dot(o,dd),c=dot(o,o)-1.,h=b*b-dot(dd,dd)*c;
     float hit=h>0.&&(-b-sqrt(h))>0.?1.:0.;
     for(int i=0;i<2;i++){vec4 L=uRexLeg[i];vec2 rel=L.xy-P.xz,rh=r.xz;float t=dot(rel,rh)/max(dot(rh,rh),1e-4);float yy=P.y+r.y*t;
      hit=max(hit,step(0.,t)*step(length(P.xz+rh*t-L.xy),L.z)*step(yy,L.w));}
     seen=mix(seen,vec3(.05,.028,.018),hit);
    }
    reflectedLight.indirectSpecular*=seen*(1.-wFoam*.7);
    // Sun glitter: bright, but broken into sparks rather than one blown-out disc.
    reflectedLight.directSpecular=min(reflectedLight.directSpecular*.5,vec3(1.6));
   }`)
  .replace('#include <opaque_fragment>',`
   // Reflection belongs to the surface, not to the murk: keep it where the water is clear
   // and let the scattered (diffuse) light fade with depth.
   {float a=diffuseColor.a,sl=clamp(max(totalSpecular.r,max(totalSpecular.g,totalSpecular.b)),0.,1.),o=clamp(a+(1.-a)*sl,0.,1.);
    gl_FragColor=vec4((totalDiffuse*a+totalSpecular+totalEmissiveRadiance)/max(o,1e-3),o);}`);
 };
 m.customProgramCacheKey=()=> 'rex-river-water-v1';
 return{material:m,uniforms};
}

// ---- Spray: drops, torn sheet fragments and spindrift ----------------------

function sprayMesh(capacity){
 const g=new T.InstancedBufferGeometry();
 g.setAttribute('corner',new T.Float32BufferAttribute([-1,0,1,0,-1,1,1,1],2));g.setIndex([0,2,1,1,2,3]);
 const attr=k=>{const a=new T.InstancedBufferAttribute(new Float32Array(capacity*4),4);a.setUsage(T.DynamicDrawUsage);g.setAttribute(k,a);return a;};
 const a0=attr('a0'),a1=attr('a1'),a2=attr('a2');a0.array.fill(-1e4);g.instanceCount=capacity;
 const uniforms={time:{value:0},viewport:{value:new T.Vector2(1,1)},minPx:{value:1},air:{value:new T.Vector3()},tint:{value:new T.Color()},sunTint:{value:new T.Color()},
  beamPos:{value:new T.Vector3()},beamDir:{value:new T.Vector3(0,0,1)},beamCos:{value:.95},beamTint:{value:new T.Color(0,0,0)}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:false,toneMapped:false,side:T.DoubleSide,
  vertexShader:`attribute vec2 corner;attribute vec4 a0,a1,a2;uniform float time,minPx,beamCos;uniform vec2 viewport;uniform vec3 air,beamPos,beamDir;
   varying vec2 vUv;varying float vAlpha,vKind,vGlint,vBeam,vSeed;
   // a0: launch point, launch time; a1: velocity, size; a2: floor height, kind (0 drop, 1 sheet shred, 2 spindrift), drag, seed.
   vec3 at(float t){float k=a2.z;if(k<.01)return a0.xyz+a1.xyz*t+vec3(0.,-${(GRAVITY/2).toFixed(2)}*t*t,0.);
    vec3 vi=air+vec3(0.,-${GRAVITY.toFixed(1)}/k,0.);return a0.xyz+vi*t+(a1.xyz-vi)*(1.-exp(-k*t))/k;}
   void main(){
    float t=time-a0.w,kind=a2.y,life=kind>1.5?1.3:kind>.5?.7:2.4;vUv=corner;vKind=kind;vSeed=a2.w;
    vec3 p=at(t),q=at(max(0.,t-.03));
    vec4 h=projectionMatrix*viewMatrix*vec4(p,1.),e=projectionMatrix*viewMatrix*vec4(q,1.);
    if(t<0.||t>life||p.y<a2.x||h.w<.25||e.w<.25){gl_Position=vec4(2.,2.,2.,1.);vAlpha=0.;return;}
    // Shreds of sheet start wide and thin out into drops; spindrift hangs in the air.
    float size=a1.w*(kind>.5&&kind<1.5?(1.+t*4.)*(1.-smoothstep(.25,.7,t)*.7):1.);
    vec2 d=(h.xy/h.w-e.xy/e.w)*viewport;float len=length(d);vec2 dir=len>1e-3?d/len:vec2(0.,1.);
    float cap=min(1.,viewport.y*.12/max(len,1e-3));e=mix(h,e,cap);
    float px=size*projectionMatrix[1][1]*viewport.y*.5/h.w,drawn=max(px,minPx);
    vec4 c=mix(h,e,corner.y);c.xy+=vec2(-dir.y,dir.x)*corner.x*drawn/viewport*c.w;
    c.y+=corner.y*(len*cap<drawn?drawn/viewport.y*c.w:0.);
    gl_Position=c;
    float fade=1.-smoothstep(life*.55,life,t);
    vAlpha=fade*mix(.4,1.,min(1.,px/minPx))*(kind>1.5?.28:kind>.5?.5*(1.-smoothstep(.2,.7,t)):.9)*smoothstep(.3,1.2,h.w);
    // Tumbling drops flash the sun now and then.
    vGlint=step(.86,fract(a2.w*91.7+floor(t*14.)*.618))*(kind<.5?1.:.4);
    vec3 bl=p-beamPos;float bd=max(length(bl),.01);vBeam=smoothstep(beamCos,mix(beamCos,1.,.45),dot(bl/bd,beamDir))/(1.+bd*bd*.012);
   }`,
  fragmentShader:`uniform vec3 tint,sunTint,beamTint;varying vec2 vUv;varying float vAlpha,vKind,vGlint,vBeam,vSeed;
   float fh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
   float fn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(fh(i),fh(i+vec2(1,0)),f.x),mix(fh(i+vec2(0,1)),fh(i+1.),f.x),f.y);}
   void main(){
    float a=(1.-vUv.x*vUv.x)*mix(1.,.45,vUv.y)*vAlpha;
    // A shred of sheet is a ragged, holed film with soft ends, not a card.
    if(vKind>.5&&vKind<1.5){vec2 q=vec2(vUv.x,vUv.y*2.-1.);float n=fn(q*vec2(1.7,2.1)+vSeed*57.)*.7+fn(q*vec2(4.,5.)+vSeed*91.)*.3;
     a=smoothstep(1.,.3,length(q)+(n-.5)*.8)*smoothstep(.18,.42,n)*vAlpha;}
    if(a<.006)discard;
    vec3 c=tint*mix(1.05,1.3,step(.5,vKind))+sunTint*vGlint+beamTint*vBeam;
    gl_FragColor=vec4(c,min(1.,a*(1.+vBeam*length(beamTint))));
   }`});
 const mesh=new T.Mesh(g,material);mesh.frustumCulled=false;mesh.renderOrder=6;mesh.name='River spray';
 return{mesh,uniforms,a0,a1,a2};
}

// A steady sheet of spray off a wheel: every point is a water parcel launched from the
// wheel t seconds ago, so the surface is the envelope of their arcs. Across the sheet (a)
// the launch direction and speed blend from one edge to the other; along it (t) the
// film thins and tears into ligaments, and the tears ride with the parcels.
const SHEET_PERIOD=8;
function sheetMesh(name){
 const geometry=new T.PlaneGeometry(1,1,16,22);
 const uniforms={...T.UniformsUtils.clone(T.UniformsLib.fog),origin:{value:new T.Vector3()},dirA:{value:new T.Vector3()},dirB:{value:new T.Vector3()},speed:{value:new T.Vector2(6,8)},
  span:{value:new T.Vector2(0,0)},width:{value:.3},drag:{value:.35},air:{value:new T.Vector3()},clock:{value:0},strength:{value:0},seed:{value:rnd()*40},
  tint:{value:new T.Color()},sunTint:{value:new T.Color()},sunDir:{value:new T.Vector3(0,1,0)},beamPos:{value:new T.Vector3()},beamDir:{value:new T.Vector3(0,0,1)},beamCos:{value:.95},beamTint:{value:new T.Color(0,0,0)}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:true,toneMapped:false,side:T.DoubleSide,
  vertexShader:`uniform vec3 origin,dirA,dirB,air,beamPos,beamDir;uniform vec2 speed,span;uniform float width,drag,strength,beamCos;
   varying float vA,vT,vFacing,vBeam;
   #include <fog_pars_vertex>
   vec3 arc(float a,float t){vec3 v0=normalize(mix(dirA,dirB,a))*mix(speed.x,speed.y,a)*strength;vec3 o=origin+(normalize(mix(dirA,dirB,a))*vec3(1.,0.,1.))*width*(a-.5);
    vec3 vi=air+vec3(0.,-${GRAVITY.toFixed(1)}/drag,0.);return o+vi*t+(v0-vi)*(1.-exp(-drag*t))/drag;}
   void main(){
    float a=position.x+.5,t=mix(span.x,span.y,position.y+.5);vA=a;vT=t;
    vec3 p=arc(a,t),pa=arc(min(1.,a+.05),t),pt=arc(a,t+.03);
    vec3 n=normalize(cross(pa-p,pt-p)+1e-5);
    vec4 mvPosition=viewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
    vFacing=abs(dot(normalize((viewMatrix*vec4(n,0.)).xyz),normalize(-mvPosition.xyz)));
    vec3 bl=p-beamPos;float bd=max(length(bl),.01);vBeam=smoothstep(beamCos,mix(beamCos,1.,.45),dot(bl/bd,beamDir))/(1.+bd*bd*.012);
    #include <fog_vertex>
   }`,
  fragmentShader:`uniform vec3 tint,sunTint,beamTint;uniform vec2 span;uniform float clock,strength,seed;varying float vA,vT,vFacing,vBeam;
   #include <fog_pars_fragment>
   float sh(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
   // Value noise that wraps every P cells in y, where y is the parcel's launch time.
   float sn(vec2 p,float P){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float y0=mod(i.y,P),y1=mod(i.y+1.,P);
    return mix(mix(sh(vec2(i.x,y0)),sh(vec2(i.x+1.,y0)),f.x),mix(sh(vec2(i.x,y1)),sh(vec2(i.x+1.,y1)),f.x),f.y);}
   void main(){
    // The parcel's launch time (wrapped): tears are carried with the water, not painted on the sheet.
    float launch=mod(clock-vT+${SHEET_PERIOD}.,${SHEET_PERIOD}.);
    float n=sn(vec2(vA*26.+seed,launch*14.),${SHEET_PERIOD*14}.)*.6+sn(vec2(vA*61.+seed*3.,launch*31.),${SHEET_PERIOD*31}.)*.4;
    float age=vT/max(span.y,.05),torn=smoothstep(.04,.55,vT);
    float lig=smoothstep(torn*.78,torn*.78+.16,n);
    float edge=smoothstep(0.,.14,vA)*smoothstep(1.,.78,vA);
    float a=edge*lig*(1.-smoothstep(.6,1.,age))*mix(.7,.38,torn)*min(1.,strength*1.5);
    if(a<.01)discard;
    // A thin film: brighter seen edge-on, sun catching the ligaments.
    vec3 c=tint*(1.1+.6*(1.-vFacing))+sunTint*pow(n,5.)*.9+beamTint*vBeam;
    gl_FragColor=vec4(c,a);
    #include <fog_fragment>
   }`});
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=6;mesh.visible=false;mesh.name=name;
 return{mesh,uniforms,start:-1,stop:-1,tMax:1};
}

// ---- The ford controller --------------------------------------------------

export function createFord(scene,{jungle,effects,mud,canopy}){
 const chunk=jungle.ford.chunk,stones=chunk.stones.slice(0,STONES);
 const water=waterMaterial({canopy});
 const surface=new T.Mesh(waterGeometry(),water.material);surface.name='River water';surface.receiveShadow=true;surface.renderOrder=2;chunk.group.add(surface);
 const W=water.uniforms;stones.forEach((s,i)=>W.uStone.value[i].set(s.x,s.z,s.r,0));W.uStoneN.value=stones.length;
 const spray=sprayMesh(DROPS);scene.add(spray.mesh);
 const sheets={wingL:sheetMesh('Jeep spray wing L'),wingR:sheetMesh('Jeep spray wing R'),tailL:sheetMesh('Jeep rooster tail L'),tailR:sheetMesh('Jeep rooster tail R')};
 for(const s of Object.values(sheets))scene.add(s.mesh);

 // Wet-ground map (river.js): R spray and drips, G tyre tracks; floats here, bytes on the GPU.
 const MW=WET_MAP.width,MH=WET_MAP.height,wet=new Float32Array(MW*MH*2),bytes=new Uint8Array(MW*MH*2);
 const wetTexture=new T.DataTexture(bytes,MW,MH,T.RGFormat,T.UnsignedByteType);wetTexture.magFilter=wetTexture.minFilter=T.LinearFilter;wetTexture.needsUpdate=true;FORD.map.value=wetTexture;
 let wetDirty=false,wetUpload=0,wetDecay=0;
 function stamp(x,z,radius,amount,channel=0){
  // x, z in ford-local metres.
  const cx=(x-WET_MAP.x0)/(WET_MAP.x1-WET_MAP.x0)*MW,cz=(z-WET_MAP.z0)/(WET_MAP.z1-WET_MAP.z0)*MH,rx=radius/(WET_MAP.x1-WET_MAP.x0)*MW,rz=radius/(WET_MAP.z1-WET_MAP.z0)*MH;
  const x0=Math.max(0,Math.floor(cx-rx-1)),x1=Math.min(MW-1,Math.ceil(cx+rx+1)),z0=Math.max(0,Math.floor(cz-rz-1)),z1=Math.min(MH-1,Math.ceil(cz+rz+1));
  for(let j=z0;j<=z1;j++)for(let i=x0;i<=x1;i++){const u=(i+.5-cx)/Math.max(rx,.5),v=(j+.5-cz)/Math.max(rz,.5),f=Math.exp(-(u*u+v*v)*2);if(f<.02)continue;const k=(j*MW+i)*2+channel;wet[k]=Math.min(1,wet[k]+amount*f);}
  wetDirty=true;
 }
 function clearWet(){wet.fill(0);bytes.fill(0);wetTexture.needsUpdate=true;wetDirty=false;}
 const pending=[];// scheduled landings on dry ground: {t, x, z (ford-local), amount}

 let time=0,clock=0,flowClock=0,scale=1,speedNow=10,armed=true,travel=0,fordZ=0;
 const air=new T.Vector3();
 const ringState=[];// {x,z,age,strength} in ford-local coordinates
 function ring(x,z,strength){if(ringState.length>=RINGS)ringState.shift();ringState.push({x,z,age:0,strength});}

 // Drops: launch from a scene point with a scene velocity. The floor is the water surface
 // or the ground where the drop will come down; dry landings wet the map when they arrive.
 let cursor=0;const v3=new T.Vector3();
 function landing(x,y,z,vx,vy,vz,k,floor){
  // Time to fall to `floor` (drag-aware bisection over the analytic path).
  const yAt=t=>{if(k<.01)return y+vy*t-GRAVITY/2*t*t;const vi=-GRAVITY/k;return y+vi*t+(vy-vi)*(1-Math.exp(-k*t))/k;};
  let lo=0,hi=3;if(yAt(hi)>floor)return hi;const apex=Math.max(0,vy/GRAVITY);lo=apex;if(yAt(lo)<floor)return 0;
  for(let i=0;i<14;i++){const m=(lo+hi)/2;if(yAt(m)>floor)lo=m;else hi=m;}return (lo+hi)/2;
 }
 function horiz(x,vx,k,t,ax){if(k<.01)return x+vx*t;return x+ax*t+(vx-ax)*(1-Math.exp(-k*t))/k;}
 function drop(x,y,z,vx,vy,vz,size,kind=0,k=kind===2?2.5:kind===1?.9:.12){
  const i=cursor++%DROPS;stats.drops++;
  // Where will it come down? Water in the channel, else the ground that will be under it then.
  let t=landing(x,y,z,vx,vy,vz,k,WATER-.02),lx=horiz(x,vx,k,t,0),lz=horiz(z,vz,k,t,speedNow),floor=WATER-.02;
  const ground=jungle.groundAt(lx,lz-speedNow*t);
  if(ground>WATER){floor=ground;t=landing(x,y,z,vx,vy,vz,k,floor);lx=horiz(x,vx,k,t,0);lz=horiz(z,vz,k,t,speedNow);
   if(kind!==2&&jungle.ford.active){const fz=lz-(jungle.ford.z+speedNow*t);pending.push({t:time+t,x:lx,z:fz,amount:size*9});}}
  spray.a0.setXYZW(i,x,y,z,time);spray.a1.setXYZW(i,vx,vy,vz,size);spray.a2.setXYZW(i,floor,kind,k,rnd());dirty=true;
 }
 let dirty=false;const stats={drops:0,waterSteps:0};
 function flush(){if(!dirty)return;spray.a0.needsUpdate=spray.a1.needsUpdate=spray.a2.needsUpdate=true;dirty=false;}
 // Spindrift left hanging in the air; velocities are relative to the ground (the air is still).
 const mist=(p,v,o={})=>effects.spume(p,v,o);

 // ---- The Jeep ----
 const wheels=[{x:-1,z:-1.16,front:true},{x:1,z:-1.16,front:true},{x:-1,z:1.16},{x:1,z:1.16}].map(w=>({...w,depth:0,wet:0,drip:0,p:new T.Vector3()}));
 const jeepState={inWater:false,entered:false,exited:false,since:0,age:0,dist:0,wet:0};
 function jeepSplashes(dt,jeep){
  const yaw=jeep.root.rotation.y,cy=Math.cos(yaw),sy=Math.sin(yaw);let any=0,front=0,rear=0;
  for(const w of wheels){w.p.set(jeep.root.position.x+w.x*cy+w.z*sy,0,jeep.root.position.z-w.x*sy+w.z*cy);w.depth=jungle.waterDepth(w.p.x,w.p.z);any=Math.max(any,w.depth);if(w.front)front=Math.max(front,w.depth);else rear=Math.max(rear,w.depth);}
  const v=speedNow,fz=jungle.ford.active?jungle.ford.z:0;
  if(jeepState.entered)jeepState.age+=dt;
  if(any>.03&&!jeepState.inWater){
   jeepState.inWater=true;jeepState.since=0;
   if(!jeepState.entered){jeepState.entered=true;jeepState.age=0;// The nose meets the water: a burst thrown forward and out over the bonnet.
    for(let i=0;i<Math.floor(220*scale);i++){const s=rnd()<.5?-1:1,a=rnd();drop(s*(.2+a*.9),WATER+.05,-2+rnd()*.4,s*(1+a*5)*(.5+rnd()),2+rnd()*4.5,v*(.2+rnd()*.6),.006+rnd()*.012,rnd()<.25?1:0);}
    for(let i=0;i<5;i++)mist(new T.Vector3((rnd()-.5)*3,WATER+.4,-1.5+rnd()),new T.Vector3((rnd()-.5)*3,.6,-1.5),{life:1.6,size:.7,growth:3,opacity:.16});
    ring(0,-2-fz,1.2);api.onSplash?.('enter',new T.Vector3(0,.3,-2),1);
   }
  }
  if(any<.02&&jeepState.inWater){jeepState.inWater=false;jeepState.exited=true;jeepState.dist=0;jeepState.wet=1;for(const w of wheels)w.wet=1;api.onSplash?.('exit',new T.Vector3(0,.3,1),.6);}
  // Sheets: wings off the front tyres, rooster tails off the rear ones.
  const t=time;
  const drive=(s,depth,cfg)=>{
   const on=depth>.04;
   if(on&&(s.start<0||s.stop>=0)){s.start=t;s.stop=-1;}if(!on&&s.start>=0&&s.stop<0)s.stop=t;
   const u=s.uniforms,k=Math.min(1,depth/.3);u.strength.value+=((on?.45+.55*k:u.strength.value)-u.strength.value)*Math.min(1,dt*6);
   u.origin.value.copy(cfg.origin);u.dirA.value.copy(cfg.a).normalize();u.dirB.value.copy(cfg.b).normalize();u.speed.value.set(cfg.speed[0],cfg.speed[1]);u.width.value=cfg.width;u.drag.value=cfg.drag;u.air.value.copy(air);
   s.tMax=cfg.tMax;const lo=s.stop>=0?Math.max(0,t-s.stop):0,hi=s.start>=0?Math.min(s.tMax,t-s.start):0;u.span.value.set(lo,hi);s.mesh.visible=s.start>=0&&hi>lo+.01;
   if(s.stop>=0&&t-s.stop>s.tMax){s.start=s.stop=-1;s.mesh.visible=false;}
  };
  const jy=jeep.root.position.y,jx=jeep.root.position.x,jz=jeep.root.position.z;
  for(const side of [-1,1]){
   const fw=wheels[side<0?0:1],rw=wheels[side<0?2:3];
   drive(side<0?sheets.wingL:sheets.wingR,fw.depth,{origin:v3.set(jx+side*1.12,WATER+.02,jz-1.35),a:new T.Vector3(side*.35,.45,.85),b:new T.Vector3(side*.8,.9,.3),speed:[v*.85,v*.7],width:.35,drag:.35,tMax:1.2});
   drive(side<0?sheets.tailL:sheets.tailR,rw.depth,{origin:v3.set(jx+side*1.02,WATER+.08,jz+1.62),a:new T.Vector3(side*.1,.2,1),b:new T.Vector3(side*.22,.95,.55),speed:[v*.95,v*.8],width:.28,drag:.3,tMax:1.35});
   // Loose drops and shredded sheet torn off the same places, and the mist they leave.
   const nf=fw.depth>.04?Math.floor((26+60*Math.min(1,fw.depth/.3))*dt*60*scale*.25):0;
   for(let i=0;i<nf;i++){const a=rnd(),sheet=rnd()<.35,dir=new T.Vector3(side*(.3+.55*a),.4+.5*a+rnd()*.2,(.9-.6*a)).normalize(),sp=v*(.5+.4*rnd());drop(jx+side*(.95+rnd()*.3),WATER+.04,jz-1.7+rnd()*.7,dir.x*sp,dir.y*sp,dir.z*sp+rnd()*1.5,sheet?.025+rnd()*.03:.006+rnd()*.012,sheet?1:0);}
   const nr=rw.depth>.04?Math.floor((30+70*Math.min(1,rw.depth/.3))*dt*60*scale*.25):0;
   for(let i=0;i<nr;i++){const a=rnd(),sheet=rnd()<.35,dir=new T.Vector3(side*(.06+.22*rnd()),.18+.75*a,1-.45*a).normalize(),sp=v*(.55+.4*rnd());drop(jx+side*(.85+rnd()*.3),WATER+.1+rnd()*.25,jz+1.5+rnd()*.25,dir.x*sp,dir.y*sp,dir.z*sp,sheet?.025+rnd()*.03:.006+rnd()*.013,sheet?1:rnd()<.2?2:0);}
   if(rw.depth>.04&&rnd()<dt*12)mist(new T.Vector3(jx+side*1,WATER+.3,jz+1.8),new T.Vector3(side*.4,4.5+rnd()*2.5,-.5-rnd()*2),{life:1,size:.4,growth:1.5,opacity:.3,drag:.5,rise:-8.5});
   if(rw.depth>.04&&rnd()<dt*9)mist(new T.Vector3(jx+side*1.1,WATER+.9+rnd()*.8,jz+3+rnd()*2),new T.Vector3(side*.5,.5,-2.5),{life:1.8+rnd(),size:.6,growth:2.8,opacity:.12+.08*Math.min(1,rw.depth/.3)});
   if(fw.depth>.04&&rnd()<dt*5)mist(new T.Vector3(jx+side*2,WATER+.5,jz+1+rnd()*2),new T.Vector3(side*1.4,.3,-3),{life:1.4,size:.5,growth:2.4,opacity:.1});
  }
  // The Jeep's own wake.
  const m=W.uMover.value[0];m.set(jx,jz-fz,0,jeepState.entered?1:0);W.uMoverB.value[0].set(1.25,Math.max(1,v),0,0);
  // Climbing out: tyres and sills stream water, then print wet tracks that fade over ~25 m.
  if(jeepState.exited){
   jeepState.dist+=v*dt;jeepState.since+=dt;
   for(const w of wheels){
    w.wet=Math.exp(-jeepState.dist/22);
    if(!w.front&&w.wet>.03&&jungle.ford.active){stamp(w.p.x,w.p.z-fz,.28,w.wet*dt*14,1);}
    if(w.wet>.05&&rnd()<w.wet*dt*40*scale){drop(w.p.x+(rnd()-.5)*.3,.3+rnd()*.25,w.p.z+(rnd()-.5)*.5,(rnd()-.5)*.4,-.2,v*.98,.004+rnd()*.006,0,.05);}
   }
   // Water pouring off the sills and bumpers for a few seconds.
   const pour=Math.exp(-jeepState.since/2.2);
   if(pour>.04)for(let i=0,n=Math.floor(pour*dt*90*scale);i<n;i++)drop(jx+(rnd()<.5?-1:1)*(.8+rnd()*.15),.45+rnd()*.15,jz+(rnd()*2-1)*1.9,(rnd()-.5)*.3,0,v,.004+rnd()*.005,0,.05);
  }
  FORD.jeepWet.value=Math.max(FORD.jeepWet.value*Math.exp(-dt/(WET.value>.5?400:45)),jeepState.inWater?1:0);
 }

 // ---- The Rex ----
 const legPrev=[new T.Vector3(),new T.Vector3()];let legInit=false;
 const rexState={soaked:0,inWater:false,entered:false,stepsSince:99};
 function rexSplashes(dt,rex){
  if(!rex?.actor.visible||!jungle.ford.active){legInit=false;W.uRexBody.value.w=0;return;}
  const fz=jungle.ford.z,a=rex.actor.position;
  W.uMover.value[1].set(a.x,a.z-fz,0,rexState.entered?1:0);W.uMoverB.value[1].set(.95,Math.max(1,speedNow),0,0);
  // Reflection proxies: her body, and her legs from the water up to the hips.
  W.uRexBody.value.set(a.x,a.y+2.55,a.z+.4,1);rex.gait.legs.forEach((leg,i)=>W.uRexLeg.value[i].set(leg.contact.x,leg.contact.z,.42,a.y+2.2));
  // Swinging legs plough forward through the surface: water thrown ahead of the stride.
  let wading=0;
  rex.gait.legs.forEach((leg,i)=>{
   const c=leg.contact,prev=legPrev[i];
   if(legInit&&dt>0){
    const depth=WATER-c.y+.25,wd=jungle.waterDepth(c.x,c.z);wading=Math.max(wading,wd);
    if(wd>.05&&depth>0){
     const vx=(c.x-prev.x)/dt,vz=(c.z-prev.z)/dt-speedNow,rel=Math.hypot(vx,vz);
     if(rel>3){
      const n=Math.floor(Math.min(1,depth/.5)*rel*rel*.06*dt*60*scale);const hx=vx/rel,hz=vz/rel;
      for(let k=0;k<n;k++){const sp=rel*(.35+.5*rnd()),up=2.5+rnd()*5,side=(rnd()-.5)*1.6,sheet=rnd()<.4;
       drop(c.x+(rnd()-.5)*.6,WATER+.05+rnd()*.2,c.z+(rnd()-.5)*.6,(hx+side*-hz)*sp,up,(hz+side*hx)*sp+speedNow,sheet?.025+rnd()*.03:.008+rnd()*.014,sheet?1:rnd()<.12?2:0);}
      if(rnd()<dt*16)mist(pv.set(c.x,WATER+.3,c.z),new T.Vector3(hx*3.5,3.5+rnd()*3,hz*3.5),{life:.8,size:.4,growth:1.4,opacity:.34,drag:.7,rise:-8.5});
     }
    }
   }
   prev.copy(c);
  });
  legInit=true;
  if(wading>.05){rexState.inWater=true;rexState.entered=true;rexState.soaked=1;rexState.stepsSince=0;}
  else if(rexState.inWater){rexState.inWater=false;api.onRexExit?.();}
 }
 const pv=new T.Vector3();
 const api={
  surface,spray:spray.mesh,sheets,chunk,stats,
  /** Total wetness painted into the wet-ground map (for checks). */
  wetSum(){let t=0;for(let i=0;i<wet.length;i++)t+=wet[i];return t;},
  get active(){return jungle.ford.active;},get jeep(){return jeepState;},get rexWet(){return rexState;},
  set enabled(v){armed=!!v;},get enabled(){return armed;},
  onSplash:null,onRexExit:null,
  setQuality(t){scale=Math.min(1,t.particles);},
  /** Lay the river out now under scene z (for reviews); by default the chase schedules it. */
  stage(z){travel=Infinity;const at=jungle.ford.place(z);clearWet();Object.assign(jeepState,{inWater:false,entered:false,exited:false,since:0,age:0,dist:0,wet:0});return at;},
  /** Depth of river water at a scene point. */
  depth(p){return jungle.waterDepth(p.x,p.z);},
  /** A Rex footfall: 'water' when it landed in the river (the caller skips dust and prints),
   *  else how wet the foot still is (0..1) for the first dozen strides out of it. */
  footfall(p,speed,side){
   if(!jungle.ford.active)return 0;const d=jungle.waterDepth(p.x,p.z);
   if(d<.04){
    // Fresh out of the river: wet feet print and spatter the bank.
    if(rexState.stepsSince<14){rexState.stepsSince++;const w=Math.pow(.84,rexState.stepsSince);stamp(p.x,p.z-jungle.ford.z,.55,.9*w);return w;}
    return 0;
   }
   const s=T.MathUtils.clamp(speed/10,.6,1.3)*Math.min(1,d/.25+.3),fz=jungle.ford.z,y=WATER+.02;
   // A two-tonne foot slamming into knee-deep water: a tall crown, a radial sheet that
   // tears into shreds and drops, the cavity's jet, and a cloud of aerated spray.
   mud.waterCrown(pv.set(p.x,y,p.z),2.1*s);mud.waterCrown(pv.set(p.x+(rnd()-.5)*.3,y,p.z+(rnd()-.5)*.3),1.4*s);
   for(let i=0,n=Math.floor(190*s*scale);i<n;i++){const a=rnd()*TAU,sheet=rnd()<.4,el=sheet?.95+rnd()*.45:.5+rnd()*.8,sp=(sheet?3+rnd()*3:3+rnd()*5.5)*s,r=.3+rnd()*.4;
    drop(p.x+Math.cos(a)*r,y,p.z+Math.sin(a)*r,Math.cos(a)*Math.cos(el)*sp,Math.sin(el)*sp,Math.sin(a)*Math.cos(el)*sp+speed,sheet?.03+rnd()*.035:.008+rnd()*.014,sheet?1:0);}
   for(let i=0,n=Math.floor(36*s*scale);i<n;i++)drop(p.x+(rnd()-.5)*.3,y,p.z+(rnd()-.5)*.3,(rnd()-.5)*1.2,4.5+rnd()*3.5*s,speed+(rnd()-.5)*1.2,.01+rnd()*.016,rnd()<.4?1:0,.12);
   // Water driven ahead of the plunging foot: a plume thrown forward and up, toward the Jeep.
   for(let i=0,n=Math.floor(70*s*scale);i<n;i++){const a=(rnd()-.5)*1.3,el=.7+rnd()*.6,sp=(4+rnd()*4)*s;
    drop(p.x+(rnd()-.5)*.5,y,p.z-.3+(rnd()-.5)*.4,Math.sin(a)*Math.cos(el)*sp,Math.sin(el)*sp,-Math.cos(a)*Math.cos(el)*sp+speed,rnd()<.5?.035+rnd()*.04:.008+rnd()*.012,rnd()<.5?1:0);}
   // The aerated body of the splash: white water heaved up past her knees that falls back
   // (soft puffs on ballistic arcs), and a little spindrift left hanging.
   for(let i=0;i<6;i++){const a=rnd()*TAU,up=4+rnd()*3.5*s,out=.6+rnd()*1.6;pv.set(p.x+Math.cos(a)*.35,y+.2,p.z+Math.sin(a)*.35);
    mist(pv,new T.Vector3(Math.cos(a)*out,up,Math.sin(a)*out-1.5-rnd()*2.5),{life:.9+rnd()*.35,size:.45+rnd()*.3,growth:1.6,opacity:.42*s,drag:.6,rise:-8.5});}
   mist(pv.set(p.x,y+.8,p.z),new T.Vector3(0,.6,-.8),{life:1.4,size:.7,growth:2,opacity:.1*s,drag:2.2});
   ring(p.x,p.z-fz,1.1*s);stats.waterSteps++;api.onSplash?.('step',pv,s);return 'water';
  },
  /** A round or a grenade striking the river. */
  impact(p,explosive=false){
   if(!jungle.ford.active||jungle.waterDepth(p.x,p.z)<.03)return false;const y=WATER+.02,fz=jungle.ford.z;
   if(explosive){
    // A column of water heaved up by the blast, collapsing into a base surge of spray.
    for(let i=0,n=Math.floor(420*scale);i<n;i++){const a=rnd()*TAU,el=1.05+rnd()*.45,sp=4+rnd()*9,r=rnd()*.8;drop(p.x+Math.cos(a)*r,y,p.z+Math.sin(a)*r,Math.cos(a)*Math.cos(el)*sp,Math.sin(el)*sp,Math.sin(a)*Math.cos(el)*sp+speedNow,.01+rnd()*.03,rnd()<.35?1:0);}
    for(let i=0;i<8;i++){const a=rnd()*TAU;mist(new T.Vector3(p.x+Math.cos(a),y+.5+rnd()*2,p.z+Math.sin(a)),new T.Vector3(Math.cos(a)*2.5,1+rnd()*2,Math.sin(a)*2.5),{life:2.4,size:1.2,growth:4.5,opacity:.2});}
    mud.waterCrown(pv.set(p.x,y,p.z),2.4);ring(p.x,p.z-fz,1.6);
   }else{
    // A round cuts a thin, tall spout; a few drops and a small ring.
    for(let i=0,n=Math.floor(26*scale);i<n;i++)drop(p.x+(rnd()-.5)*.08,y,p.z+(rnd()-.5)*.08,(rnd()-.5)*1.2,3+rnd()*4.5,speedNow+(rnd()-.5)*1.2,.005+rnd()*.008,rnd()<.2?1:0,.1);
    ring(p.x,p.z-fz,.35);
   }
   return true;
  },
  /** Water shed from her lower body as she climbs out: a few drops a frame from hips, belly, tail and feet. */
  drip(points,amount){if(amount<.02)return;for(const p of points)if(rnd()<amount*scale)drop(p.x+(rnd()-.5)*.4,p.y,p.z+(rnd()-.5)*.4,(rnd()-.5)*.3,-.3,speedNow*.97,.004+rnd()*.007,0,.05);},
  reset(){
   jungle.ford.release();travel=0;clearWet();pending.length=0;ringState.length=0;W.uRingN.value=0;
   Object.assign(jeepState,{inWater:false,entered:false,exited:false,since:0,age:0,dist:0,wet:0});Object.assign(rexState,{soaked:0,inWater:false,entered:false,stepsSince:99});W.uRexBody.value.w=0;
   for(const w of wheels)w.wet=0;for(const s of Object.values(sheets)){s.start=s.stop=-1;s.mesh.visible=false;s.uniforms.strength.value=0;}
   spray.a0.array.fill(-1e4);spray.a0.needsUpdate=true;stats.drops=stats.waterSteps=0;FORD.jeepWet.value=0;FORD.state.value.z=0;legInit=false;
  },
  /** ctx: {speed, pursuit, state, jeep, rex, weather, sun, camera, renderer, visible} */
  update(dt,{speed,pursuit=false,state=null,jeep,rex,tint,sun,beam,renderer,visible=true}){
   time+=dt;speedNow=speed;air.set(0,0,speed);
   // Schedule the ford once per chase: a little way into the pursuit, never over the jungle detour.
   if(armed&&!jungle.ford.active&&travel<SPAWN_AFTER&&pursuit){travel+=speed*dt;if(travel>=SPAWN_AFTER&&!['flank'].includes(state?.phase)&&!state?.ambushDue){jungle.ford.place();clearWet();}}
   const live=jungle.ford.active;
   spray.mesh.visible=visible;
   // Clocks: the sheet noise and flow wrap, so no ever-growing value reaches a shader.
   clock=(clock+dt)%SHEET_PERIOD;flowClock=(flowClock+dt)%5.333;
   FORD.time.value=(FORD.time.value+dt)%(Math.PI*20);
   const ph=flowClock/5.333;W.uFlowPhase.value.set(ph,(ph+.5)%1,Math.abs(1-2*ph));
   if(canopy){W.uCanopyW.value.z=canopy.scroll%canopy.scale;}
   spray.uniforms.time.value=time;spray.uniforms.air.value.copy(air);
   renderer.getDrawingBufferSize(spray.uniforms.viewport.value);spray.uniforms.minPx.value=Math.max(1,renderer.getPixelRatio()*.9);
   if(tint){spray.uniforms.tint.value.copy(tint);for(const s of Object.values(sheets))s.uniforms.tint.value.copy(tint);}
   if(sun){const k=(1-NIGHT.value)*(1-WET.value*.85)*sun.intensity*.55;spray.uniforms.sunTint.value.copy(sun.color).multiplyScalar(k);for(const s of Object.values(sheets))s.uniforms.sunTint.value.copy(sun.color).multiplyScalar(k*.7);}
   if(beam){for(const u of [spray.uniforms,...Object.values(sheets).map(s=>s.uniforms)]){u.beamPos.value.copy(beam.beamPos.value);u.beamDir.value.copy(beam.beamDir.value);u.beamCos.value=beam.beamCos.value;u.beamTint.value.copy(beam.beamTint.value);}}
   for(const s of Object.values(sheets))s.uniforms.clock.value=clock;
   if(!live||!visible){for(const s of Object.values(sheets))s.mesh.visible=false;if(!live){W.uMover.value[0].w=W.uMover.value[1].w=0;}return;}
   const fz=jungle.ford.z;fordZ=fz;
   if(jeep)jeepSplashes(dt,jeep);
   rexSplashes(dt,rex);
   // The wake reaches the banks a second after the Jeep and washes up them, then drains away.
   if(jeepState.entered)FORD.state.value.z=Math.max(FORD.state.value.z*Math.exp(-dt/14),T.MathUtils.smoothstep(jeepState.age,.8,1.8)*(1-T.MathUtils.smoothstep(jeepState.age,2.2,3)));
   // Rings drift downstream and age.
   for(let i=ringState.length-1;i>=0;i--){const r=ringState[i];r.age+=dt;r.x+=W.uFlow.value*dt;if(r.age>4)ringState.splice(i,1);}
   ringState.forEach((r,i)=>W.uRing.value[i].set(r.x,r.z,r.age,r.strength));W.uRingN.value=ringState.length;
   // Spray landing on dry ground wets it when it gets there.
   for(let i=pending.length-1;i>=0;i--){const p=pending[i];if(time>=p.t){stamp(p.x,p.z,.35,Math.min(.5,p.amount));pending.splice(i,1);}}
   // The ground dries: slowly in the open, not at all while it rains.
   wetDecay+=dt;if(wetDecay>.25){const k=Math.exp(-wetDecay/(WET.value>.5?600:70));for(let i=0;i<wet.length;i++)if(wet[i]>0)wet[i]=wet[i]*k<.004?0:wet[i]*k;wetDecay=0;wetDirty=true;}
   flush();
   wetUpload+=dt;if(wetDirty&&wetUpload>.05){for(let i=0;i<wet.length;i++)bytes[i]=wet[i]*255;wetTexture.needsUpdate=true;wetDirty=false;wetUpload=0;}
  }
 };
 return api;
}
