import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createFoliageKit,dustTexture,seeded,WIND,GRASS_DENSITY} from './foliage.js';
import {SUN_DIRECTION} from './atmosphere.js';
import {WET,RAIN,RAIN_TIME,WIND_GUST,NIGHT} from './weather-state.js';
import {WATER,FORD,WET_MAP,riverHeight,riverCarve,riverCentre,riverHalf} from './river.js';
// Scrolling rainforest road. Twelve 28 m chunks recycle along +Z; six unique
// layouts are shared by chunk pairs 168 m apart. Every layout is merged per
// material (a handful of draw calls per chunk) and optional planting is ordered
// randomly so a draw range can thin it for lighter quality tiers without
// touching the concealing understory the midpoint feint depends on.

const CHUNK=28,COUNT=12,START=-122,UNIQUE=6,TAU=Math.PI*2;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Road stays flat for the rig; banks rise gently beyond the understory. Periodic over one chunk. */
export function groundHeight(x,z){
 const ax=Math.abs(x),side=x>0?1:-1;
 const wave=Math.sin(z*TAU/CHUNK+side*1.3+ax*.13)*.5+Math.sin(z*TAU*2/CHUNK+ax*.29)*.3+Math.sin(z*TAU*3/CHUNK-ax*.41)*.2;
 return smooth(16,40,ax)*(1.05+wave*.55)+smooth(28,62,ax)*2.4;
}

/** Ground in the ford chunk: the same terrain with the river channel cut through it. */
export function fordHeight(x,z){return riverHeight(x,z,groundHeight(x,z));}

function groundGeometry(height=groundHeight){
 const xs=[];for(let x=-70;x<-30;x+=5)xs.push(x);for(let x=-30;x<-12;x+=2)xs.push(x);for(let x=-12;x<12;x+=.5)xs.push(x);for(let x=12;x<30;x+=2)xs.push(x);for(let x=30;x<=70;x+=5)xs.push(x);
 const rows=57,P=[],U=[],I=[];
 for(let r=0;r<rows;r++){const z=-CHUNK/2+r*CHUNK/(rows-1);for(const x of xs){P.push(x,height(x,z),z);U.push(x/3.5,z/3.5);}}
 const cols=xs.length;for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+cols;I.push(a,b,a+1,a+1,b,b+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();return g;
}
function groundMaterial(kit,{ford=false}={}){
 const t=kit.textures.ground,m=new T.MeshStandardMaterial({map:t.dirt,normalMap:t.dirtNormal,normalScale:new T.Vector2(1.1,1.1),roughness:.85});
 m.onBeforeCompile=s=>{
  s.uniforms.tLitter={value:t.litter};s.uniforms.tLitterNormal={value:t.litterNormal};s.uniforms.uWet=WET;s.uniforms.uRain=RAIN;s.uniforms.uRainTime=RAIN_TIME;
  s.uniforms.tFordWet=FORD.map;s.uniforms.uFord=FORD.state;s.uniforms.uFordTime=FORD.time;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGround,vGroundW;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=position;vGroundW=(modelMatrix*vec4(position,1.)).xyz;');
  if(ford)s.fragmentShader='#define FORD\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vGround,vGroundW;uniform sampler2D tLitter,tLitterNormal,tFordWet;uniform float uWet,uRain,uRainTime,uFordTime;uniform vec4 uFord;
   float gh(vec2 p){p=fract(p*vec2(233.34,851.73));p+=dot(p,p+23.45);return fract(p.x*p.y);}
   // Value noise whose lattice wraps in z; 28*k must be a whole number so
   // every chunk boundary meets its neighbour without a seam.
   float gn(vec2 p,float P){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float y0=mod(i.y,P),y1=mod(i.y+1.,P);
    return mix(mix(gh(vec2(i.x,y0)),gh(vec2(i.x+1.,y0)),f.x),mix(gh(vec2(i.x,y1)),gh(vec2(i.x+1.,y1)),f.x),f.y);}
   float gp(vec2 p,float k){return gn(p*k,floor(28.*k+.5));}
   // Raindrop rings on standing water: one drop per 0.4 m cell on its own clock.
   // Cells wrap every chunk (70 per 28 m) so neighbouring chunks meet cleanly.
   vec2 rainRipples(vec2 uv,float t){
    vec2 g=vec2(0.),cell=floor(uv);
    for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
     vec2 c=cell+vec2(i,j),k=vec2(c.x,mod(c.y,70.));
     float h=gh(k+.37),period=.7+.5*gh(k+5.1),age=fract(t/period+h);
     vec2 d=uv-(c+.2+.6*vec2(gh(k+2.3),gh(k+8.9)));float r=length(d),x=(r-age*1.1)*9.;
     g+=d/max(r,1e-3)*cos(x*3.1416)*smoothstep(1.,0.,abs(x))*pow(1.-age,2.)*step(gh(k+11.7),.85);
    }
    return g;
   }
   float mRoad,mRut,mHump,mVerge,mForest,mPuddle,mDetail,mTread,treadSlope,mFordWet,mFordSub,wLocal;
   // Sunlight focused by the ripples onto a shallow bed. Every rate is a multiple of .1
   // and the clock wraps every 20*PI seconds, so the pattern stays seamless and bounded.
   float fordCaustic(vec2 p,float t){
    vec2 q=p*1.7;float c=0.;
    for(int i=0;i<2;i++){q+=vec2(sin(q.y*1.3+t),cos(q.x*1.1-t*1.2))*.55;c+=pow(abs(sin(q.x)+sin(q.y))*.5,4.);q=q*1.6+2.3;}
    return c;
   }`)
  .replace('#include <map_fragment>',`
   {
    vec2 p=vGround.xz;float ax=abs(p.x);
    float n1=gp(p,10./28.),n2=gp(p,35./28.),n3=gp(p,2./28.);
    float wob=(gp(vec2(p.x>0.?12.:36.,p.y),.25)-.5)*1.3;
    mRoad=1.-smoothstep(3.8+wob,4.9+wob,ax);
    // Ruts sink deep where the ground stayed soft and fade over firm patches; an older,
    // wandering pair from another vehicle drifts in and out of them.
    float rutDepth=.45+.55*smoothstep(.2,.65,gp(vec2(p.x>0.?5.:17.,p.y),6./28.)),rutOffset=ax-1.02-wob*.06;
    mRut=(1.-smoothstep(.1,.38,abs(rutOffset)))*mRoad*rutDepth;
    float oldRut=ax-1.02-.42*sin(p.y*.224399+(p.x>0.?.9:2.4))-.08*sin(p.y*.897598);
    mRut=max(mRut,(1.-smoothstep(.05,.2,abs(oldRut)))*mRoad*.55*smoothstep(.35,.6,gp(vec2(p.x>0.?23.:41.,p.y),4./28.)));
    // Chevron tread lugs pressed into the fresh ruts; 232 per chunk keeps them seamless.
    float lug=fract(p.y*8.285714+abs(rutOffset)*2.6);
    mTread=(1.-smoothstep(.08,.17,abs(rutOffset)))*mRoad*rutDepth*smoothstep(.55,.8,rutDepth);treadSlope=sin(lug*6.2832)*mTread;
    mTread*=smoothstep(.1,.22,lug)*(1.-smoothstep(.42,.55,lug));
    mHump=(1.-smoothstep(.1,.55,ax))*mRoad;
    mVerge=smoothstep(3.9+wob,5.4+wob,ax)*(1.-smoothstep(8.,13.,ax+wob*2.5));
    mForest=smoothstep(8.,13.5,ax+wob*2.5+n3*3.);
    mPuddle=smoothstep(.72-.08*uWet,.8-.06*uWet,gp(p+vec2(3.,0.),12./28.)*(.45+mRut*.7)+n2*.08)*mRoad;
    mDetail=texture2D(map,vMapUv).r;
    vec3 mud=vec3(.07,.047,.03),dirt=vec3(.19,.135,.087),dry=vec3(.3,.23,.155);
    vec3 road=mix(dirt,dry,smoothstep(.3,.85,n1)*.75)*(.6+.8*mDetail);
    road=mix(road,mud*(.75+.5*mDetail),max(mRut*.9,mHump*.15));road*=1.-mTread*.35;
    vec3 litter=texture2D(tLitter,vMapUv*.5).rgb;
    vec3 moss=vec3(.05,.08,.022)*(.7+.6*n2),grassy=vec3(.07,.092,.032)*(.8+.4*mDetail);
    vec3 verge=mix(mix(litter*.55,grassy,.55),moss,.35+.3*n1);
    vec3 forest=mix(litter*.62,moss,smoothstep(.5,.8,n2)*.55)*(.75+.4*n1);
    vec3 col=mix(road,verge,mVerge);col=mix(col,forest,mForest);
    col=mix(col,col*.68,mPuddle);
    // Water left by the river crossing (river.js): spray landing on the banks and verge,
    // drips, and the tyres' wet tracks, painted into a map that rides with the road.
    mFordWet=0.;mFordSub=0.;
    if(uFord.x>.5){
     vec2 q=vec2((vGroundW.x-(${WET_MAP.x0.toFixed(1)}))/${(WET_MAP.x1-WET_MAP.x0).toFixed(1)},(vGroundW.z-uFord.y-(${WET_MAP.z0.toFixed(1)}))/${(WET_MAP.z1-WET_MAP.z0).toFixed(1)});
     if(q.x>0.&&q.x<1.&&q.y>0.&&q.y<1.){
      vec2 wm=texture2D(tFordWet,q).rg;
      // Splashed water soaks in unevenly, so the map's soft blobs break up against the soil's grain.
      mFordWet=smoothstep(.12,.5,wm.r*(1.+(n2-.5)*.9+(mDetail-.5)*.6));
      // Tyre tracks: two tread-wide bands printed with the lug pattern.
      float tyre=1.-smoothstep(.1,.2,abs(ax-1.));
      mFordWet=max(mFordWet,wm.g*tyre*(.7+.3*smoothstep(.1,.3,fract(p.y*8.285714+abs(ax-1.)*2.6))));
     }
    }
    #ifdef FORD
    {
     // The channel: silt and gravel under the water, and a saturated band along the waterline
     // that the Jeep's wake (uFord.z) pushes further up the banks for a while.
     float dh=vGround.y-(${WATER.toFixed(2)}),surge=uFord.z*exp(-p.x*p.x/220.);
     mFordSub=smoothstep(.03,-.05,dh);
     float band=1.-smoothstep(.05+.32*surge,.3+.45*surge,dh+(n2-.5)*.1+(mDetail-.5)*.06);
     vec3 silt=vec3(.07,.058,.038)*(.6+.8*n2),gravel=mix(vec3(.16,.14,.11),vec3(.09,.085,.07),n1)*(.55+.9*mDetail);
     vec3 bed=mix(silt,gravel,smoothstep(.4,.7,mDetail+n1*.3))*mix(1.,.8,smoothstep(-.2,-.7,dh));
     // An olive algae film where the current is slow, off the gravel riffle.
     bed=mix(bed,bed*vec3(.8,1.05,.62),smoothstep(.55,.8,n3)*smoothstep(4.,9.,ax));
     col=mix(col,bed,mFordSub);
     // Mud churned up by traffic in and out of the water.
     col=mix(col,vec3(.06,.045,.03)*(.7+.6*mDetail),band*mRoad*(1.-mFordSub)*.7);
     mFordWet=max(mFordWet,band);
    }
    #endif
    wLocal=max(uWet,mFordWet);
    // Rain darkens porous ground; standing water turns muddy brown.
    col*=1.-wLocal*(.42-.12*mForest);col=mix(col,col*vec3(.55,.5,.45),mPuddle*uWet);
    diffuseColor.rgb*=col*1.05;
   }`)
  .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(.94,.86,mRoad);roughnessFactor=mix(roughnessFactor,.6,mRut*.8);roughnessFactor=mix(roughnessFactor,.96,mForest);
   roughnessFactor=mix(roughnessFactor,.72,mPuddle);
   // Wet litter on the verge and forest floor stays mostly matte; only the track and its puddles mirror the sky.
   roughnessFactor=mix(roughnessFactor,mix(mix(.46,.74,mVerge),.82,mForest),wLocal);roughnessFactor=mix(roughnessFactor,.07,mPuddle*uWet);
   // Freshly splashed soil holds a film of water: glossier than rain-soaked ground.
   roughnessFactor=mix(roughnessFactor,mix(.5,.72,mForest),mFordWet*(1.-uWet*.5));`)
  .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   #ifdef FORD
   // Caustics on the shallow bed where the sun reaches it (directDiffuse carries the shadow).
   {float depth=${WATER.toFixed(2)}-vGround.y,shallow=smoothstep(0.,.06,depth)*(1.-smoothstep(.25,.7,depth));
    reflectedLight.directDiffuse*=1.+fordCaustic(vGround.xz,uFordTime)*shallow*1.6*(1.-uWet*.7);}
   #endif`)
  .replace('#include <normal_fragment_maps>',`
   {
    vec3 dn=texture2D(normalMap,vNormalMapUv).xyz*2.-1.,ln=texture2D(tLitterNormal,vNormalMapUv*.5).xyz*2.-1.;
    vec3 mapN=normalize(mix(dn*vec3(1.2,1.2,1.),ln*vec3(1.4,1.4,1.),mForest));
    mapN.xy*=normalScale*(1.+mRut*.5)*(1.-mPuddle*.3)*(1.-mPuddle*uWet*.94);
    mapN.y+=treadSlope*.45*(1.-mPuddle*uWet);
    if(uRain>.01&&mPuddle*uWet>.01)mapN.xy+=rainRipples(vGround.xz*2.5,uRainTime)*.55*uRain*mPuddle;
    normal=normalize(tbn*mapN);
   }`);
 };
 m.customProgramCacheKey=()=>ford?'rex-jungle-ground-ford-v1':'rex-jungle-ground-v5';return m;
}

export function createJungle(root,{canopy}={}){
 const branchMap=new T.TextureLoader().load('./textures/jungle-branch.png');branchMap.colorSpace=T.SRGBColorSpace;branchMap.anisotropy=8;
 const kit=createFoliageKit(branchMap),M=kit.materials;
 const ground=groundGeometry(),groundMat=groundMaterial(kit);
 const obj=new T.Object3D(),matrix=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),s=new T.Vector3();
 // A plain waterlogged trunk for the ford: a lumpy tapered cylinder, 1 m long and 1 m in radius before scaling.
 const logGeometry=(()=>{const g=new T.CylinderGeometry(1,.82,1,14,12,false);g.translate(0,.5,0);const p=g.attributes.position,u=g.attributes.uv,c=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),k=1+.12*Math.sin(a*3+y*9)+.06*Math.sin(a*7-y*23);p.setXYZ(i,x*k,y,z*k);u.setXY(i,u.getX(i)*3,u.getY(i)*7);const m=.78+.22*Math.sin(y*17+a*2);c.set([m,m*.97,m*.9],i*3);}
  g.setAttribute('color',new T.BufferAttribute(c,3));g.computeVertexNormals();return g;})();
 // Planting follows the ground being laid out: the ford layout's H is the carved channel.
 let H=groundHeight;
 const at=(x,z,y=0,rotY=0,scale=1,tilt=[0,0])=>matrix.compose(v.set(x,H(x,z)+y,z),q.setFromEuler(e.set(tilt[0],rotY,tilt[1],'YXZ')),typeof scale==='number'?s.setScalar(scale):s.set(...scale));
 const recolor=(g,rgb)=>{const c=g.attributes.color;for(let i=0;i<c.count;i++)c.setXYZ(i,c.getX(i)*rgb[0],c.getY(i)*rgb[1],c.getZ(i)*rgb[2]);return g;};

 // Build six unique layouts. Each entry: {material, required geometries[], optional geometries[]}.
 function layout(seed,river=false){
  H=river?fordHeight:groundHeight;
  // In the ford layout nothing takes root in the water unless placed there on purpose.
  let allowWet=false;const dryAt=(x,z,margin)=>!river||H(x,z)>WATER+margin;
  const rand=seeded(seed),buckets=new Map(),add=(material,geometry,optional=false)=>{if(!buckets.has(material))buckets.set(material,{required:[],optional:[],clutter:[]});buckets.get(material)[optional==='clutter'?'clutter':optional?'optional':'required'].push(geometry);};
  // Every piece records its plant's root and height for the wind: consecutive pieces
  // placed with the same matrix (a trunk, then its crown) share the first one's height,
  // so they bend together. Still pieces (fallen wood, litter) get a negative height.
  let lastM=null,lastH=1;
  const put=(material,source,m,optional,tone,still=optional==='clutter')=>{if(!allowWet&&!dryAt(m.elements[12],m.elements[14],.12))return null;const g=source.clone().applyMatrix4(m);if(tone)recolor(g,tone);
   const e=m.elements;if(!lastM||lastM.some((v,i)=>v!==e[i])){if(!source.boundingBox)source.computeBoundingBox();lastH=Math.max(.3,source.boundingBox.max.y*Math.hypot(e[4],e[5],e[6]));lastM=e.slice();}
   const n=g.attributes.position.count,w=new Float32Array(n*4);for(let i=0;i<n;i++){w[i*4]=e[12];w[i*4+1]=e[14];w[i*4+2]=e[13];w[i*4+3]=still?-lastH:lastH;}g.setAttribute('plant',new T.BufferAttribute(w,4));
   add(material,g,optional);return g;};
  const side=()=>rand()<.5?-1:1,zz=()=>(rand()-.5)*CHUNK;
  // Rainforest giants: a few frame the verge, most stand back in the haze.
  for(let i=0;i<8;i++){const sd=i%2?1:-1,x=sd*(i<2?12.5+rand()*3:16+Math.pow(rand(),.7)*28),z=zz(),h=17+rand()*15,t=kit.giants[Math.floor(rand()*kit.giants.length)],m=at(x,z,-.3,rand()*TAU,[h*(.85+rand()*.3),h,h*(.85+rand()*.3)]),tone=[.85+rand()*.25,.85+rand()*.2,.8+rand()*.2];put(M.bark,t.wood,m,false,tone);put(M.canopy,t.leaves,m,false,[.8+rand()*.3,.85+rand()*.25,.75+rand()*.25]);}
  // Leaning edge trees close a canopy tunnel over the road at 10-17 m. Their trunks carry
  // the roosts (road side, below the crown) where Dimorphodon cling (flyers.js).
  const roosts=[];
  for(let i=0;i<4;i++){const sd=i%2?1:-1,x=sd*(10.5+rand()*3.5),z=zz(),h=15+rand()*6,t=kit.leaners[Math.floor(rand()*kit.leaners.length)],m=at(x,z,-.2,(sd>0?Math.PI:0)+(rand()-.5)*.5,[h,h,h]);const trunk=put(M.bark,t.wood,m,false,[.85+rand()*.2,.85+rand()*.2,.8+rand()*.2]);
   if(trunk)roosts.push(t.roosts.map(r=>{const p=r.p.clone().applyMatrix4(m),n=r.n.clone().transformDirection(m);return{x:p.x,y:p.y,z:p.z,nx:n.x,ny:n.y,nz:n.z};}));put(M.canopy,t.leaves,m,false,[.75+rand()*.3,.82+rand()*.25,.7+rand()*.25]);}
  // Palms lean toward the light over the road edge; tree ferns fill the mid layer.
  for(let i=0;i<5;i++){const sd=side(),x=sd*(7+rand()*13),z=zz(),h=9+rand()*6,t=kit.palms[Math.floor(rand()*kit.palms.length)],m=at(x,z,-.1,sd>0?Math.PI+(rand()-.5)*.8:(rand()-.5)*.8,h);put(M.bark,t.wood,m,false);put(M.palm,t.fronds,m,false,[.9+rand()*.2,.9+rand()*.2,.85+rand()*.2]);}
  for(let i=0;i<5;i++){const x=side()*(8.8+rand()*9),z=zz(),h=2.6+rand()*2.6,t=kit.treeFerns[Math.floor(rand()*kit.treeFerns.length)],m=at(x,z,0,rand()*TAU,h);put(M.bark,t.wood,m,true);put(M.fern,t.fronds,m,true,[.95,1,.95]);}
  // Concealing understory belt: dense, layered and never thinned.
  for(const sd of [-1,1])for(const [x0,n,size]of [[15,7,0],[19.5,8,1],[23.5,9,2],[27,7,2]])for(let k=0;k<n;k++){const z=k*CHUNK/n-CHUNK/2+rand()*2,x=sd*(x0+rand()*2.4),b=kit.bushes[size],m=at(x,z,-.2,rand()*TAU,size?1.25+rand()*.35:1+rand()*.3);put(M.shrub,b,m,false,[.85+rand()*.3,.9+rand()*.2,.8+rand()*.25]);if(rand()<.6){const e2=kit.elephant[Math.floor(rand()*2)],m2=at(x+(rand()-.5)*3,z+(rand()-.5)*3,0,rand()*TAU,2.2+rand()*1.4);put(M.broad,e2,m2,false);}}
  // Verge planting stays low and open: ferns, broad leaves, rocks.
  for(let i=0;i<16;i++){const x=side()*(5.4+Math.pow(rand(),.8)*9),z=zz(),m=at(x,z,0,rand()*TAU,.8+rand()*.9);put(M.fern,kit.ferns[Math.floor(rand()*3)],m,true,[.85+rand()*.3,.9+rand()*.2,.8+rand()*.25]);}
  for(let i=0;i<9;i++){const x=side()*(6.6+rand()*8.5),z=zz(),banana=rand()<.3,m=at(x,z,0,rand()*TAU,banana?1.4+rand()*.8:1+rand()*1.1);put(M.broad,banana?kit.banana[0]:kit.elephant[Math.floor(rand()*2)],m,true,[.9+rand()*.2,.95+rand()*.15,.85+rand()*.2]);}
  // Rocks big enough to bask on become lizard perches (their highest point near the middle).
  const perches=[];
  for(let i=0;i<10;i++){const sd=side(),x=sd*(5.2+rand()*10),z=zz(),big=rand()<.2,sc=big?.8+rand()*.8:.16+rand()*.42,m=at(x,z,-sc*.15,rand()*TAU,[sc*(1+rand()*.4),sc,sc*(1+rand()*.4)]);const g=put(M.rock,kit.rocks[Math.floor(rand()*3)],m,!big,[.85+rand()*.2,.85+rand()*.2,.82+rand()*.2]);
   if(g&&sc>.36){const p=g.attributes.position;let top=null;for(let k=0;k<p.count;k++){if(Math.hypot(p.getX(k)-x,p.getZ(k)-z)<sc*.35&&(!top||p.getY(k)>top.y))top={x:p.getX(k),y:p.getY(k),z:p.getZ(k)};}if(top)perches.push({...top,big});}}
  // Mossy fallen log.
  if(rand()<.7){const x=side()*(9+rand()*8),z=zz(),m=at(x,z,.25,rand()*TAU,[.55,6+rand()*4,.55],[Math.PI/2,0]);put(M.bark,kit.giants[0].wood,m,false,[.8,.85,.75],true);}
  // Track clutter, so no stretch of road repeats the last. Wheels throw pebbles onto
  // the crown and shoulders and keep the ruts clear; the storm has dropped snapped
  // branches, torn leafy limbs and dead fronds along the edges. Wood near the ruts
  // lies along the track, as if pushed aside by the last vehicle through.
  // Clutter draws from its own random stream, so the planting and grass above keep their layout.
  const C=kit.clutter,cr=seeded(seed*7+3),cside=()=>cr()<.5?-1:1,czz=()=>(cr()-.5)*CHUNK;
  for(let d=0;d<7;d++){const r=cr(),cx=r<.25?(cr()-.5)*.6:cside()*(1.5+cr()*3.4),cz=czz(),n=5+Math.floor(cr()*9),spread=.35+cr()*.9;
   for(let i=0;i<n;i++){const a=cr()*TAU,rr=Math.sqrt(cr())*spread,x=cx+Math.cos(a)*rr,z=Math.max(-13.9,Math.min(13.9,cz+Math.sin(a)*rr*1.6));if(Math.abs(Math.abs(x)-1.02)<.3)continue;
    const sc=.035+Math.pow(cr(),1.5)*.1*(1-rr/spread*.5),m=at(x,z,-sc*.3,cr()*TAU,[sc*(1+cr()*.6),sc*(.7+cr()*.4),sc*(1+cr()*.6)]),l=.75+cr()*.5;
    put(M.rock,C.pebbles[Math.floor(cr()*3)],m,'clutter',[l*(1.02+cr()*.1),l,l*(.9+cr()*.1)]);}}
  for(let i=0;i<7;i++){const x=cside()*(1.6+cr()*4.6),z=czz(),sc=.12+cr()*.14;if(Math.abs(Math.abs(x)-1.02)<.4)continue;const m=at(x,z,-sc*.25,cr()*TAU,[sc*(1+cr()*.5),sc*(.6+cr()*.3),sc*(1+cr()*.5)]),l=.8+cr()*.4;put(M.rock,C.pebbles[Math.floor(cr()*3)],m,'clutter',[l,l,l*.95]);}
  for(let i=0;i<4;i++){const sd=cside(),x=sd*(2.9+cr()*5.5),z=czz(),near=Math.abs(x)<5,m=at(x,z,0,near?(cr()<.5?0:Math.PI)+(cr()-.5)*.7:cr()*TAU,.8+cr()*.45);put(M.bark,C.branches[Math.floor(cr()*3)],m,'clutter',[.95+cr()*.2,.9+cr()*.15,.85+cr()*.15]);}
  for(let i=0;i<2;i++){const sd=cside(),x=sd*(3.6+cr()*4),z=czz(),limb=C.limbs[Math.floor(cr()*2)],m=at(x,z,0,Math.abs(x)<5?(cr()<.5?0:Math.PI)+(cr()-.5)*.6:cr()*TAU,.85+cr()*.35);put(M.bark,limb.wood,m,'clutter');put(M.shrub,limb.leaves,m,'clutter',[.9+cr()*.2,.95+cr()*.1,.8+cr()*.2]);}
  for(let i=0;i<9;i++){const sd=cside(),x=sd*(2.7+Math.pow(cr(),1.3)*5),z=czz(),fern=cr()<.3,m=at(x,z,0,Math.abs(x)<4.8?sd*Math.PI/2+(cr()-.5)*1.4:cr()*TAU,.9+cr()*.45);
   // Dead fronds brown and bleach from the tip; some are still half green.
   const dry=cr();put(fern?M.fern:M.palm,fern?C.fernFronds[0]:C.palmFronds[Math.floor(cr()*2)],m,'clutter',[1.15+dry*.5,.8+(1-dry)*.25,.45+(1-dry)*.35]);}
  // The ford: boulders splitting the current, a drowned log, driftwood and gravel at the
  // waterline, riverside ferns and palms leaning out over the water. Rocks that break the
  // surface are recorded for the water's foam (stones), the big ones as lizard perches.
  const stones=[],reeds=[];
  if(river){
   const rr=seeded(seed*5+11),rs=()=>rr()<.5?-1:1;
   // Where the bank climbs out of the water on one side of the channel at x.
   const shore=(x,side)=>{const c=riverCentre(x),h=riverHalf(x);for(let s=h;s<h+5;s+=.08)if(H(x,c+side*s)>WATER+.015)return c+side*s;return c+side*(h+5);};
   allowWet=true;
   for(let i=0;i<11;i++){
    // Boulders stand clear of the current: the rock's crown is flattened, so it is scaled
    // up in height to rise 0.2-0.6 m out of the water whatever the depth.
    const x=rs()*(5.8+Math.pow(rr(),.8)*32),z=riverCentre(x)+(rr()*2-1)*riverHalf(x)*.9,depth=Math.max(0,WATER-H(x,z)),sc=.55+rr()*.6,sy=(depth+.2+rr()*.4)/.6+sc*.2;
    const g=put(M.rock,kit.rocks[Math.floor(rr()*3)],at(x,z,-sc*.05,rr()*TAU,[sc*(1+rr()*.4),sy,sc*(1+rr()*.4)]),false,[.62+rr()*.1,.64+rr()*.1,.6+rr()*.1]);
    const p=g.attributes.position;let top=null;for(let k=0;k<p.count;k++)if(!top||p.getY(k)>top.y)top={x:p.getX(k),y:p.getY(k),z:p.getZ(k)};
    if(top.y>WATER+.04){stones.push({x,z,r:sc*1.05});if(top.y>WATER+.3)perches.push({...top,big:true});}
   }
   // A drowned trunk from the left bank, lying across most of the channel just awash.
   {const x=-(19+rr()*7),yaw=(rr()-.5)*.35,len=riverHalf(x)*2+2.5,z0=riverCentre(x)-riverHalf(x)-2.2;
    matrix.compose(v.set(x,WATER-.12,z0),q.setFromEuler(e.set(Math.PI/2,yaw,0,'YXZ')),s.set(.3,len,.3));put(M.bark,logGeometry,matrix,false,[.62,.6,.5],true);
    for(let d=1.5;d<len;d+=1.1){const z=z0+Math.cos(yaw)*d,xx=x+Math.sin(yaw)*d;if(H(xx,z)<WATER-.05)stones.push({x:xx,z,r:.55});}}
   // Driftwood stranded along the waterline, and gravel bars where the current drops it.
   for(let i=0;i<8;i++){const sd=rs(),x=rs()*(4.8+rr()*22),z=shore(x,sd)+sd*(rr()-.6)*.8;put(M.bark,C.branches[Math.floor(rr()*3)],at(x,z,0,rr()*TAU,.8+rr()*.5),false,[.75+rr()*.2,.72+rr()*.15,.62+rr()*.15],true);}
   for(let d=0;d<6;d++){const sd=rs(),cx=rs()*(2.5+rr()*12),cz=shore(cx,sd);
    for(let i=0,n=10+Math.floor(rr()*12);i<n;i++){const x=cx+(rr()-.5)*2.6,z=cz+sd*(rr()-.55)*1.3,sc=.04+Math.pow(rr(),1.5)*.12,l=.7+rr()*.4;if(Math.abs(Math.abs(x)-1.02)<.3)continue;
     put(M.rock,C.pebbles[Math.floor(rr()*3)],at(x,z,-sc*.3,rr()*TAU,[sc*(1+rr()*.6),sc*(.7+rr()*.4),sc*(1+rr()*.6)]),false,[l*1.02,l,l*.92],true);}}
   allowWet=false;
   // Ferns and elephant ears crowd the banks just above the water; palms lean out over it.
   for(let i=0;i<22;i++){const sd=rs(),x=rs()*(4.9+Math.pow(rr(),.7)*30),z=shore(x,sd)+sd*(.3+rr()*2.4),big=rr()<.4;
    put(big?M.broad:M.fern,big?kit.elephant[Math.floor(rr()*2)]:kit.ferns[Math.floor(rr()*3)],at(x,z,0,rr()*TAU,big?1.3+rr()*1.2:.9+rr()*.9),true,[.85+rr()*.3,.92+rr()*.2,.8+rr()*.25]);}
   for(let i=0;i<3;i++){const sd=rs(),x=rs()*(7+rr()*14),z=shore(x,sd)+sd*(.6+rr()*1.2),h=8+rr()*5,t=kit.palms[Math.floor(rr()*kit.palms.length)];
    const m=at(x,z,-.1,sd>0?Math.PI/2+(rr()-.5)*.6:-Math.PI/2+(rr()-.5)*.6,h);put(M.bark,t.wood,m,false);put(M.palm,t.fronds,m,false,[.9+rr()*.2,.95+rr()*.15,.85+rr()*.2]);}
   // Reeds and sedge in clumps along the waterline, off the road; some stand in the shallows.
   for(let c=0;c<64;c++){const sd=rs(),cx=rs()*(4.8+Math.pow(rr(),.9)*40),cz=shore(cx,sd)+sd*(rr()-.45)*1.1;
    for(let i=0,n=4+Math.floor(rr()*7);i<n;i++){const a=rr()*TAU,d=Math.sqrt(rr())*.7,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d*.6;if(Math.abs(x)<4.4||H(x,z)<WATER-.3)continue;
     const w=.7+rr()*.35;reeds.push(at(x,z,-.02,rr()*TAU,[w,2+rr()*1.4,w]).clone());}}
  }
  const meshes=[];
  for(const [material,{required,optional:planted,clutter}]of buckets){
   for(let i=planted.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[planted[i],planted[j]]=[planted[j],planted[i]];}
   for(let i=clutter.length-1;i>0;i--){const j=Math.floor(cr()*(i+1));[clutter[i],clutter[j]]=[clutter[j],clutter[i]];}
   // Spread the clutter evenly through the planting order, so thinning drops both alike.
   const optional=[];for(let i=0,j=0;i<planted.length||j<clutter.length;)optional.push(j>=clutter.length||(i<planted.length&&cr()*(planted.length-i+clutter.length-j)<planted.length-i)?planted[i++]:clutter[j++]);
   const all=[...required,...optional],geometry=mergeGeometries(all);if(!geometry)continue;
   // Index offsets let a draw range drop a fraction of the optional plants.
   let offset=0;const marks=[];for(const g of all){offset+=g.index?g.index.count:g.attributes.position.count;marks.push(offset);}
   meshes.push({material,geometry,requiredEnd:required.length?marks[required.length-1]:0,marks:marks.slice(required.length),total:offset});
   all.forEach(g=>g.dispose());
  }
  // Grass: instanced tufts with distance thinning; dense at the road edge, a
  // sparse strip on the crown between the ruts, none in the wheel tracks.
  const tufts=[];for(let c=0;c<110;c++){const crown=rand()<.1,cx=crown?(rand()-.5)*.5:side()*(4.2+Math.pow(rand(),1.35)*9),cz=zz(),n=crown?5:6+Math.floor(rand()*12),spread=crown?.5:.5+rand()*1.3;for(let i=0;i<n;i++){const a=rand()*TAU,d=Math.sqrt(rand())*spread,x=cx+Math.cos(a)*d*(crown?.35:1),z=Math.max(-13.9,Math.min(13.9,cz+Math.sin(a)*d)),sc=(.55+rand()*.75)*(1-d/spread*.35);if(Math.abs(Math.abs(x)-1.02)<.35||!dryAt(x,z,.06))continue;tufts.push(at(x,z,0,rand()*TAU,crown?sc*.6:sc).clone());}}
  // Reeds join the grass (the same tuft, drawn tall), so they thin and fade with it.
  tufts.push(...reeds);
  for(let i=tufts.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[tufts[i],tufts[j]]=[tufts[j],tufts[i]];}
  H=groundHeight;
  return{meshes,tufts,perches,stones,roosts};
 }
 const layouts=Array.from({length:UNIQUE},(_,i)=>layout(9001+i*37));
 const tuftGeometry=mergeGeometries([kit.grass[0]]);
 // Each layout's tufts carry their shuffled rank, so the shader can fade them by the same order the draw count cuts.
 const tuftsFor=tufts=>{const g=new T.BufferGeometry();g.index=tuftGeometry.index;for(const [k,a]of Object.entries(tuftGeometry.attributes))g.setAttribute(k,a);g.setAttribute('tuftRank',new T.InstancedBufferAttribute(Float32Array.from(tufts,(_,i)=>i/tufts.length),1));return g;};
 const tuftGeometries=layouts.map(({tufts})=>tuftsFor(tufts));
 function buildChunk(data,floorGeometry,floorMaterial,tufts){
  const group=new T.Group();root.add(group);
  const floor=new T.Mesh(floorGeometry,floorMaterial);floor.receiveShadow=true;floor.name='Jungle ground';group.add(floor);
  const parts=data.meshes.map(d=>{const mesh=new T.Mesh(d.geometry,d.material);mesh.castShadow=d.material===M.bark||d.material===M.rock;mesh.receiveShadow=true;group.add(mesh);return{mesh,data:d};});
  const grass=new T.InstancedMesh(tufts,M.grass,data.tufts.length);data.tufts.forEach((m,i)=>grass.setMatrixAt(i,m));grass.receiveShadow=true;grass.computeBoundingSphere();group.add(grass);
  return{group,parts,grass,perches:data.perches,roosts:data.roosts};
 }
 const chunks=[];
 for(let k=0;k<COUNT;k++){const c=buildChunk(layouts[k%UNIQUE],ground,groundMat,tuftGeometries[k%UNIQUE]);c.group.position.z=k*CHUNK+START;c.home=c.perches;c.homeRoosts=c.roosts;chunks.push(c);}
 // The river ford: a seventh layout that stands in for one chunk slot while it is live.
 const fordData=layout(9001+UNIQUE*37,true),fordChunk=buildChunk(fordData,groundGeometry(fordHeight),groundMaterial(kit,{ford:true}),tuftsFor(fordData.tufts));
 fordChunk.group.visible=false;fordChunk.stones=fordData.stones;fordChunk.group.name='River ford';
 let fordSlot=null;
 const inFord=z=>fordSlot&&Math.abs(z-fordSlot.group.position.z)<CHUNK/2;
 function releaseFord(){if(!fordSlot)return;fordSlot.perches=fordSlot.home;fordSlot.roosts=fordSlot.homeRoosts;fordSlot=null;fordChunk.group.visible=false;FORD.state.value.x=0;}

 // ---- Air: sunbeam motes and falling leaves -------------------------------
 const moteCount=900,moteSeeds=new Float32Array(moteCount*4),rnd=seeded(606);for(let i=0;i<moteCount*4;i++)moteSeeds[i]=rnd();
 const moteGeo=new T.BufferGeometry();moteGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(moteCount*3),3));moteGeo.setAttribute('seed',new T.BufferAttribute(moteSeeds,4));
 const moteUniforms={time:{value:0},scroll:{value:0},tCanopy:{value:canopy?.texture||null},canopyHeight:{value:canopy?.height||17},canopyScale:{value:canopy?.scale||72},canopyScroll:{value:0},canopyOffset:{value:canopy?.offset||new T.Vector2()},sunDir:{value:SUN_DIRECTION.clone()},pixel:{value:1},strength:{value:1}};
 const motes=new T.Points(moteGeo,new T.ShaderMaterial({uniforms:moteUniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,
  vertexShader:`attribute vec4 seed;uniform float time,scroll,canopyHeight,canopyScale,canopyScroll,pixel;uniform vec3 sunDir;uniform vec2 canopyOffset;uniform sampler2D tCanopy;varying float vLight;
   void main(){
    vec3 box=vec3(30.,11.,54.);
    vec3 p=vec3(seed.x*box.x-box.x*.5+sin(time*.21+seed.w*20.)*.6,.3+mod(seed.y*box.y+time*(.05+seed.w*.08),box.y),mod(seed.z*box.z+scroll*.98+sin(time*.3+seed.x*9.)*.4,box.z)-6.);
    vec2 q=p.xz+sunDir.xz*(canopyHeight-p.y)/sunDir.y-canopyOffset;
    float lit=texture2D(tCanopy,vec2(q.x/canopyScale+.5,(q.y-canopyScroll)/canopyScale)).r;
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    float d=-mv.z;vLight=lit*smoothstep(1.5,5.,d)*(1.-smoothstep(28.,46.,d))*(.35+.65*seed.w);
    gl_PointSize=pixel*(1.4+seed.w*2.4)*18./max(d,1.);
   }`,
  fragmentShader:`uniform float strength;varying float vLight;void main(){vec2 c=gl_PointCoord-.5;float a=exp(-dot(c,c)*18.);gl_FragColor=vec4(vec3(1.,.88,.64)*a*vLight*.9*strength,1.);}`}));
 motes.frustumCulled=false;motes.name='Sunbeam motes';root.add(motes);

 const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=64;{const x=leafCanvas.getContext('2d');x.translate(32,32);x.rotate(.6);const g=x.createLinearGradient(-20,0,20,0);g.addColorStop(0,'#6d4a22');g.addColorStop(1,'#a07a3a');x.fillStyle=g;x.beginPath();x.ellipse(0,0,24,10,0,0,7);x.fill();x.strokeStyle='#4a3218';x.lineWidth=1.5;x.beginPath();x.moveTo(-24,0);x.lineTo(24,0);x.stroke();}
 const leafTex=new T.CanvasTexture(leafCanvas);leafTex.colorSpace=T.SRGBColorSpace;
 const fallingCount=70,falling=new T.InstancedMesh(new T.PlaneGeometry(.16,.16),new T.MeshStandardMaterial({map:leafTex,alphaTest:.4,side:T.DoubleSide,roughness:.8}),fallingCount);
 const leafState=Array.from({length:fallingCount},()=>({p:new T.Vector3((rnd()-.5)*24,rnd()*14,rnd()*50-4),spin:new T.Vector3(rnd()*3,rnd()*3,rnd()*3),phase:rnd()*TAU,fall:.35+rnd()*.5}));
 falling.frustumCulled=false;falling.name='Falling leaves';root.add(falling);

 // Low tier: faint painted shafts stand in for the ray-marched scattering.
 const shaftMat=new T.MeshBasicMaterial({color:0xffe2a3,transparent:true,opacity:.02,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,fog:false});
 const shafts=new T.Group();for(let i=0;i<7;i++){const shaft=new T.Mesh(new T.CylinderGeometry(.25,2,32,12,1,true),shaftMat);shaft.position.set(-4+i*2.5,13,24+i*14);shaft.rotation.z=.55;shaft.rotation.x=-.42;shafts.add(shaft);}shafts.visible=false;root.add(shafts);

 const dustMap=dustTexture();
 let grassFactor=1,floraFactor=1,particleFactor=1,windClock=0;
 function thin(){for(const c of [...chunks,fordChunk])for(const {mesh,data}of c.parts){const n=Math.floor(data.marks.length*floraFactor);mesh.geometry.setDrawRange(0,n?data.marks[n-1]:data.requiredEnd||0);if(!n&&!data.requiredEnd)mesh.geometry.setDrawRange(0,0);}}
 // Distance thinning: full density near the camera, a sparse carpet far away. Draw
 // enough for the chunk's nearest edge; the shader fades each tuft by its rank.
 function thinGrass(c,z){const d=Math.max(0,Math.abs(z-6)-CHUNK/2),lod=Math.max(.12,1-Math.max(0,d-18)/70);c.grass.count=Math.min(c.grass.instanceMatrix.count,Math.ceil(c.grass.instanceMatrix.count*Math.min(1,grassFactor)*lod*1.08));}
 function positionChunks(){chunks.forEach((c,k)=>c.group.position.z=k*CHUNK+START);}
 return{
  kit,chunks,motes,dustMap,
  /** Ground height under a point in the scene's (Jeep) frame; every chunk shares one phase. */
  groundAt(x,z){if(inFord(z))return fordHeight(x,z-fordSlot.group.position.z);return groundHeight(x,z-chunks[0].group.position.z);},
  /** How far the river channel lowers the ground below the ordinary terrain there (0 elsewhere): what the rig and the Jeep follow. */
  fordDip(x,z){if(!inFord(z))return 0;const lz=z-fordSlot.group.position.z;return fordHeight(x,lz)-groundHeight(x,lz);},
  /** Depth of river water over the ground at a scene point; 0 when dry or when no ford is live. */
  waterDepth(x,z){return inFord(z)?Math.max(0,WATER-fordHeight(x,z-fordSlot.group.position.z)):0;},
  ford:{chunk:fordChunk,get active(){return !!fordSlot;},get z(){return fordSlot?fordSlot.group.position.z:null;},
   /** Swap a chunk slot for the river: by default the farthest one ahead, still hidden beyond the fog; or the slot nearest scene z. */
   place(z=null){releaseFord();const c=chunks.reduce((b,c)=>(z===null?c.group.position.z<b.group.position.z:Math.abs(c.group.position.z-z)<Math.abs(b.group.position.z-z))?c:b);
    fordSlot=c;c.perches=fordChunk.perches;c.roosts=fordChunk.roosts;fordChunk.group.position.z=c.group.position.z;FORD.state.value.set(1,c.group.position.z,0,0);return c.group.position.z;},
   release:releaseFord},
  setQuality(t){grassFactor=t.grass;GRASS_DENSITY.value=Math.min(1,t.grass);floraFactor=t.flora;particleFactor=t.particles;shafts.visible=!!t.beams;motes.visible=!t.beams;moteGeo.setDrawRange(0,Math.floor(moteCount*particleFactor));falling.count=Math.floor(fallingCount*particleFactor);thin();},
  reset(){positionChunks();releaseFord();},
  update(dt,speed,time,camera){
   // Storm gusts quicken the sway; in still air the clock tracks game time exactly.
   windClock+=dt*(1+(WIND_GUST.value-1)*.15);WIND.value=windClock;
   for(const c of chunks){
    c.group.position.z+=speed*dt;if(c.group.position.z>200){c.group.position.z-=COUNT*CHUNK;if(c===fordSlot)releaseFord();}
    // Beyond ~140 m ahead the fog is opaque; far behind is only seen during the defeat spin.
    c.group.visible=c!==fordSlot&&c.group.position.z<150&&c.group.position.z>-96;
    thinGrass(c,c.group.position.z);
   }
   if(fordSlot){const z=fordSlot.group.position.z;fordChunk.group.position.z=z;fordChunk.group.visible=z<150&&z>-96;FORD.state.value.y=z;thinGrass(fordChunk,z);}
   moteUniforms.time.value=time;moteUniforms.strength.value=(1-WET.value)*(1-NIGHT.value);shaftMat.opacity=.02*(1-WET.value)*(1-NIGHT.value);motes.visible=moteUniforms.strength.value>.01&&!shafts.visible;moteUniforms.scroll.value=(moteUniforms.scroll.value+speed*dt)%54;moteUniforms.pixel.value=Math.min(2,devicePixelRatio);
   if(canopy){moteUniforms.canopyScroll.value=canopy.scroll%canopy.scale;}
   for(let i=0;i<falling.count;i++){
    const l=leafState[i];l.p.y-=l.fall*dt;l.p.z+=speed*dt*.97;l.p.x+=Math.sin(time*1.3+l.phase)*dt*.6;
    if(l.p.y<.05||l.p.z>48){l.p.set((rnd()-.5)*24,9+rnd()*6,rnd()*40-4);}
    obj.position.copy(l.p);obj.rotation.set(time*l.spin.x+l.phase,time*l.spin.y,time*l.spin.z);obj.updateMatrix();falling.setMatrixAt(i,obj.matrix);
   }
   falling.instanceMatrix.needsUpdate=true;
  }
 };
}
