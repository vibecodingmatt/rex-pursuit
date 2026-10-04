import * as T from 'three';

// A9: the river (and lagoon) surface. three's Water keeps its mirror pass; this replaces its
// shading with a living river:
// - The water flows toward the boat: two layers of ripples, long across the current and short
//   along it, are carried downstream, so reflections break into vertical streaks.
// - Depth comes from the channel itself (the same bank profile as terrainY), so the shallows
//   show the silt bed through the water and the channel darkens to deep green-brown.
// - Fresnel at water's real value (2% straight down): the far river mirrors the forest, the
//   water by the boat is something you look into.
// - Foam: lines lapping at the banks, collars and downstream trails at rocks and wading legs,
//   the bow wave peeling off the launch, rings that spread from splashes, and flecks drifting
//   in the current. The canopy's shade falls on all of it.
// Every pattern reads bounded coordinates: x, and z relative to a base snapped every 64 m;
// the route offset and the bank noise phases come in as uniforms for that base.

export const LEVEL=-.35;
const ROUTE=49,STEP=8,OBST=18,RINGS=12;
const FLOW={river:1.7,lagoon:0};

const vertexShader=`
uniform mat4 textureMatrix;uniform float uZ0;
varying vec4 mirrorCoord;varying vec4 worldPosition;varying vec2 vLocal;
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main(){
 mirrorCoord=modelMatrix*vec4(position,1.);worldPosition=mirrorCoord.xyzw;vLocal=vec2(worldPosition.x,worldPosition.z-uZ0);
 mirrorCoord=textureMatrix*mirrorCoord;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
 #include <beginnormal_vertex>
 #include <defaultnormal_vertex>
 #include <logdepthbuf_vertex>
 #include <fog_vertex>
 #include <shadowmap_vertex>
}`;

const fragmentShader=`
uniform sampler2D mirrorSampler;uniform float alpha;uniform float time;uniform float distortionScale;uniform sampler2D normalSampler;
uniform vec3 sunColor;uniform vec3 sunDirection;uniform vec3 eye;uniform vec3 waterColor;
uniform float uRoute[${ROUTE}];uniform vec3 uPhase;uniform vec4 uFlow;uniform vec2 uFord;uniform float uLevel;uniform vec3 uShallow;uniform vec3 uFill;
uniform vec4 uObst[${OBST}];uniform vec4 uObstDir[${OBST}];uniform vec4 uRing[${RINGS}];uniform vec4 uBow;uniform vec2 uBowDir;
varying vec4 mirrorCoord;varying vec4 worldPosition;varying vec2 vLocal;
#include <common>
#include <packing>
#include <bsdfs>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
float routeAt(float zl){float f=clamp(zl/${STEP}.,0.,${ROUTE-1}.-.001);int i=int(f);return mix(uRoute[i],uRoute[i+1],f-float(i));}
// The carved channel floor (terrainY for a river chunk) at a bounded point (x, z - uZ0).
float bedAt(vec2 p){
 float off=p.x-routeAt(p.y),ax=abs(off),edge=max(0.,ax-6.);
 float y=edge*.07+sin(p.y*.12+uPhase.x+off*.16)*min(3.,edge*.05)+sin(p.y*.53+uPhase.y+off*.71)*sin(p.y*.31+uPhase.z-off*.47)*.24*clamp((ax-5.5)/4.,0.,1.);
 return y-(3.-uFord.y*(1.-smoothstep(22.,40.,abs(p.y-uFord.x))))*(1.-smoothstep(23.,30.,ax));
}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
// Foam texture: clumped bubbles torn into streaks along the current.
float foamTex(vec2 p){float n=vnoise(p*vec2(1.6,.55))*.55+vnoise(p*vec2(4.1,1.5)+7.)*.3+vnoise(p*9.+3.)*.15;return n;}
void main(){
 #include <logdepthbuf_fragment>
 vec2 p=vLocal;float run=uFlow.z;
 // Ripples: long across the current, short along it, carried downstream (toward -z).
 vec2 q0=vec2(p.x/16.,(p.y+uFlow.x)/8.),q1=vec2(p.x/6.4+.37,(p.y+uFlow.y)/4.),q2=vec2(p.x/32.+uFlow.w*.007,(p.y+uFlow.y*.5)/16.),q3=vec2(p.x/2.+.13,(p.y+uFlow.x*1.25)/2.);
 vec3 rip=(texture2D(normalSampler,q0).xyz*2.-1.)+(texture2D(normalSampler,q1).xyz*2.-1.)*.75+(texture2D(normalSampler,q2).xyz*2.-1.)*.9+(texture2D(normalSampler,q3).xyz*2.-1.)*.45;
 vec2 slope=rip.xy*vec2(.7,1.)*(.27+.17*run);
 float foam=0.,churn=0.;
 // Depth from the channel; foam laps at the waterline and gathers in a broken line off the bank.
 float bed=bedAt(p),depth=uLevel-bed;
 vec2 fp=vec2(p.x,p.y+uFlow.x);
 float streak=foamTex(fp*vec2(.9,.35)),fine=foamTex(fp*2.3+11.);
 // Horizontal distance to the shore: the bank is steep, so depth alone gives a hairline.
 float grad=length(vec2(bedAt(p+vec2(.6,0.))-bed,bedAt(p+vec2(0.,.6))-bed))/.6,shore=max(0.,depth)/max(grad,.04);
 float lap=1.-smoothstep(0.,1.1+.45*sin(uFlow.w*1.3+p.y*.4+p.x*.3),shore);
 float line=exp(-pow((shore-2.4-streak*1.8)/.8,2.))*smoothstep(.3,.65,streak);
 foam+=lap*smoothstep(.2,.55,fine)*.95+line*.6;
 // Riffles: the current breaks white over the shallows of the ford.
 foam+=smoothstep(.9,.35,depth)*smoothstep(.5,.8,streak+fine*.3)*.6*run;
 // Drifting flecks mid-river.
 foam+=smoothstep(.72,.9,foamTex(fp*vec2(.5,.16)+31.))*smoothstep(.45,.75,fine)*.35*run;
 // Rocks and wading legs: a collar where the current piles against them, a trail downstream.
 for(int i=0;i<${OBST};i++){vec4 o=uObst[i];if(o.w<=0.)continue;vec2 r=p-o.xy;float d=length(r);vec4 od=uObstDir[i];if(d>o.z*3.+od.z*1.5+2.)continue;
  float along=dot(r,od.xy),across=dot(r,vec2(-od.y,od.x));
  float collar=exp(-pow((d-o.z*1.02)/(o.z*.22+.12),2.))*(.55+.45*smoothstep(.2,-o.z,along));
  float wide=o.z*(.75+max(0.,along)*.18),trail=step(0.,along)*exp(-pow(across/wide,2.))*exp(-max(0.,along)/max(.1,od.z));
  float k=o.w*(collar+trail*smoothstep(.3,.75,streak+fine*.4));foam+=k;churn+=o.w*(collar+trail)*.6;
  slope+=normalize(r+1e-4)*collar*o.w*.5;}
 // Splash rings: a churned spot and a spreading swell that fades as it grows.
 for(int i=0;i<${RINGS};i++){vec4 g=uRing[i];if(g.w<=0.)continue;vec2 r=p-g.xy;float d=length(r),age=g.z,rad=age*(1.4+g.w*1.6),wid=.3+age*.35;if(d>rad+wid*3.)continue;
  float x=(d-rad)/wid,env=exp(-x*x)*g.w*exp(-age*.75);slope+=normalize(r+1e-4)*(-2.*x*env)*.9;
  foam+=env*.45*smoothstep(.3,.7,fine)+g.w*exp(-age*1.1)*smoothstep(rad*.8+.4,0.,d)*smoothstep(.15,.6,fine+streak*.5);churn+=env;}
 // The launch's bow wave: foam hugging the hull, a crest peeling off each side, a cushion at the stem.
 if(uBow.w>0.){vec2 r=p-uBow.xy;float a=-dot(r,uBowDir),b=dot(r,vec2(uBowDir.y,-uBowDir.x)),ab=abs(b);
  if(a>-1.&&a<26.){float hw=1.68*sqrt(clamp(a/5.4,0.,1.)),wake=uBow.w;
   float hug=step(0.,a)*exp(-pow((ab-hw-.12)/(.18+a*.04),2.));
   float crest=.25+a*(.5+1.1*wake),cw=.3+a*.12,c=step(0.,a)*exp(-pow((ab-hw-crest)/cw,2.))*exp(-a/9.);
   // Aerated white water between the hull and the crest, torn up by the chop.
   float white=step(0.,a)*smoothstep(hw+crest+cw*.5,hw,ab)*exp(-a/4.)*smoothstep(.35,.8,fine+streak*.5);
   float stem=exp(-dot(r,r)*3.);
   foam+=wake*(hug*.95+c*smoothstep(.15,.6,fine+streak*.4)*1.1+white*.85+stem*.7);churn+=wake*(hug+c+white);
   slope+=vec2(uBowDir.y,-uBowDir.x)*sign(b)*wake*(-2.*(ab-hw-crest)/(cw*cw))*c*.08;}}
 foam=clamp(foam,0.,1.);
 vec3 n=normalize(vec3(slope.x*1.3,1.,slope.y*1.3)+vec3(0.,churn*.0,0.));
 vec3 toEye=eye-worldPosition.xyz;float dist=length(toEye);vec3 v=toEye/dist;
 float shadow=getShadowMask();
 // Reflection with distortion, sharper far away; real water Fresnel.
 vec2 distortion=n.xz*(.002+1.4/dist)*distortionScale;
 vec3 refl=texture2D(mirrorSampler,mirrorCoord.xy/mirrorCoord.w+distortion).rgb;
 float cosT=clamp(dot(v,n),0.,1.),F=.02+.98*pow(1.-cosT,5.);
 // The body: light scattered inside the water, from the key (shaded by the canopy) and the sky.
 float sunUp=max(sunDirection.y,0.);vec3 lit=uFill+sunColor*sunUp*.55*shadow;
 vec3 body=waterColor*lit;
 // Looking through the shallows: the path length through the water sets how much bed shows.
 float path=max(0.,depth)/max(.2,abs(v.y)),T=exp(-path*1.15);
 vec3 shallowTint=uShallow*lit*.5;
 vec3 rgb=refl*F+(1.-F)*(1.-T)*body+(1.-F)*T*shallowTint*(1.-T)*2.;float a=1.-(1.-F)*T;
 // Sun glints on the ripples.
 vec3 h=normalize(sunDirection+v);rgb+=sunColor*pow(max(dot(n,h),0.),220.)*2.2*shadow*(1.-foam);
 vec3 foamCol=vec3(.86,.9,.88)*(uFill*1.25+sunColor*max(dot(sunDirection,vec3(0,1,0)),0.)*.7*shadow);
 rgb=rgb*(1.-foam)+foamCol*foam;a=a*(1.-foam)+foam;
 gl_FragColor=vec4(rgb,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 // The arcade's haze (light.js), premultiplied so the bed seen through the shallows isn't fogged twice.
 #ifdef USE_FOG
  #ifdef FOG_EXP2
   float fogFactor=1.-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
  #else
   float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
  #endif
  vec3 fogRay=vFogWorld-cameraPosition;float fogLength=max(length(fogRay),1e-4);
  fogFactor*=mix(fogShape.y,1.,exp(-max(vFogWorld.y-fogShape.z,0.)*fogShape.x));
  vec3 fogTint=fogColor+fogGlow*pow(max(dot(fogRay/fogLength,fogSun),0.),6.);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,fogTint*gl_FragColor.a,fogFactor);
 #endif
}`;

/**
 * Ripple normals: a tileable fBm heightfield (periodic gradient noise, five octaves) turned
 * into a normal map. Irregular, unlike a sum of cosines, which reads as corrugated sheet.
 */
export function rippleNormals(S=256){
 const h=new Float32Array(S*S),grad=(ix,iy,p,seed)=>{ix=((ix%p)+p)%p;iy=((iy%p)+p)%p;let s=(ix*374761393+iy*668265263+seed*2147483647)|0;s=(s^(s>>>13))*1274126177|0;const a=((s^(s>>>16))>>>0)/4294967296*Math.PI*2;return[Math.cos(a),Math.sin(a)];};
 for(let o=0;o<5;o++){const p=4<<o,cell=S/p,amp=1/(1.7**o);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const fx=x/cell,fy=y/cell,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy,ux=tx*tx*(3-2*tx),uy=ty*ty*(3-2*ty);
   const d=(gx,gy)=>{const g=grad(ix+gx,iy+gy,p,o+1);return g[0]*(tx-gx)+g[1]*(ty-gy);};
   h[y*S+x]+=amp*((d(0,0)*(1-ux)+d(1,0)*ux)*(1-uy)+(d(0,1)*(1-ux)+d(1,1)*ux)*uy);}}
 const data=new Uint8Array(S*S*4);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){const at=(i,j)=>h[((j+S)%S)*S+((i+S)%S)],dx=(at(x+1,y)-at(x-1,y))*S*.09,dy=(at(x,y+1)-at(x,y-1))*S*.09,l=Math.hypot(dx,dy,1),i=(y*S+x)*4;data[i]=128-dx/l*127;data[i+1]=128-dy/l*127;data[i+2]=128+127/l;data[i+3]=255;}
 const t=new T.DataTexture(data,S,S);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}

/**
 * Takes over a three `Water`'s shading. `routeX(z, id)` is the world route. The caller feeds
 * `update()` every frame with the camera, the stage, the boat's bow and the live obstacles.
 */
export class RiverSurface{
 constructor(water,{routeX}){
  this.water=water;this.routeX=routeX;const m=water.material,u=m.uniforms;
  Object.assign(u,{uZ0:{value:0},uFord:{value:new T.Vector2()},uRoute:{value:new Float32Array(ROUTE)},uPhase:{value:new T.Vector3()},uFlow:{value:new T.Vector4()},uLevel:{value:LEVEL},
   uShallow:{value:new T.Color(0x8a7a52)},uFill:{value:new T.Color(.32,.36,.34)},
   uObst:{value:Array.from({length:OBST},()=>new T.Vector4())},uObstDir:{value:Array.from({length:OBST},()=>new T.Vector4())},
   uRing:{value:Array.from({length:RINGS},()=>new T.Vector4())},uBow:{value:new T.Vector4()},uBowDir:{value:new T.Vector2(0,1)}});
  m.vertexShader=vertexShader;m.fragmentShader=fragmentShader;u.normalSampler.value=rippleNormals();
  // Premultiplied: the bed shows through the shallows; the water draws before other see-through things.
  m.transparent=true;m.blending=T.CustomBlending;m.blendSrc=T.OneFactor;m.blendDst=T.OneMinusSrcAlphaFactor;m.depthWrite=true;m.needsUpdate=true;
  water.renderOrder=-5;water.receiveShadow=true;
  this.flow=[0,0];this.rings=[];this.movers=[];this.time=0;this.stage=null;
 }
 /** A splash at world (x, z): a churned spot and a ring that spreads. strength ~0.3-1.5. */
 ring(x,z,strength=1){this.rings.push({x,z,t:this.time,s:strength});if(this.rings.length>RINGS)this.rings.shift();}
 /** A wading leg or swimmer this frame: world (x, z), radius, velocity (vx, vz). */
 mover(x,z,r,vx=0,vz=0,strength=1){if(this.movers.length<8)this.movers.push([x,z,r,vx,vz,strength]);}
 reset(){this.rings.length=0;this.movers.length=0;}
 /**
  * camera: the world camera; id: stage; dt: simulation step; time: simulation clock.
  * bow: {x, z, dirX, dirZ, speed} or null; rocks: [[x, z, r], ...] in world space.
  */
 update({camera,id,dt,time,bow,rocks=[],fill,ford=null}){
  const u=this.water.material.uniforms,cz=camera.position.z,z0=Math.floor((cz-20)/64)*64,TAU=Math.PI*2;this.time=time;
  if(this.stage!==id){this.stage=id;this.reset();}
  u.uZ0.value=z0;if(ford)u.uFord.value.set(ford[0]-z0,ford[1]);else u.uFord.value.set(0,0);for(let i=0;i<ROUTE;i++)u.uRoute.value[i]=this.routeX(z0+i*STEP,id);
  u.uPhase.value.set((z0*.12)%TAU,(z0*.53)%TAU,(z0*.31)%TAU);
  const speed=FLOW[id]??0;this.flow[0]=(this.flow[0]+dt*speed)%32;this.flow[1]=(this.flow[1]+dt*speed*.6)%32;
  u.uFlow.value.set(this.flow[0],this.flow[1],speed?1:0,time%600);
  if(fill)u.uFill.value.copy(fill);
  // Rocks nearest the camera first, then the movers, each with its downstream direction.
  let k=0;const near=rocks.filter(r=>r[1]>cz-6&&r[1]<cz+150).sort((a,b)=>a[1]-b[1]);
  const put=(x,z,r,dx,dz,len,s)=>{if(k>=OBST)return;u.uObst.value[k].set(x,z-z0,r,s);const l=Math.hypot(dx,dz)||1;u.uObstDir.value[k].set(dx/l,dz/l,len,0);k++;};
  for(const [x,z,r,vx,vz,s]of this.movers){const rx=-vx,rz=-speed-vz,rel=Math.hypot(rx,rz);put(x,z,r,rx,rz,1.5+rel*.45,s*Math.min(1,.35+rel*.2));}
  for(const [x,z,r]of near.slice(0,OBST-this.movers.length))put(x,z,r,0,-1,speed?2.5+r*2:.01,speed?.85:.5);
  for(;k<OBST;k++)u.uObst.value[k].w=0;this.movers.length=0;
  // Rings drift downstream as they spread.
  this.rings=this.rings.filter(g=>time-g.t<4.5&&time>=g.t);
  for(let i=0;i<RINGS;i++){const g=this.rings[i],v=u.uRing.value[i];if(!g){v.w=0;continue;}const age=time-g.t;v.set(g.x,g.z-z0-age*speed,age,g.s);}
  if(bow&&bow.speed>.5){u.uBow.value.set(bow.x,bow.z-z0,0,Math.min(1,bow.speed/22));u.uBowDir.value.set(bow.dirX,bow.dirZ);}else u.uBow.value.w=0;
 }
}
