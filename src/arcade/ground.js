import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {seeded} from '../chase/foliage.js';

// Lost Circuit's ground (A4): one blended terrain material, scanned rocks, and
// track clutter and clumped planting ported from Pursuit's road (chase/environment.js).
// Pursuit's chunks ride a fixed Jeep frame; here the camera travels ~900 m, so
// the shader reads route-space coordinates: lateral offset from the route and
// z wrapped every WRAP metres at a chunk seam. Every noise period and stripe
// divides WRAP, so the wrap is seamless and shader inputs stay small on phones.
export const WRAP=256;
const TAU=Math.PI*2,clamp=T.MathUtils.clamp;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// Per-stage ground. style: paved, canyon, shore (wet band at the waterline), puddles.
const STYLES={
 gates:{dirt:[.085,.06,.04],dry:[.13,.1,.068],mud:[.042,.03,.02],grass:[.05,.068,.022],moss:[.035,.056,.016],floor:[.42,.44,.5],verge:[.22,.3,.26],rock:[.45,.43,.38],style:[0,0,0,1],moss2:.55,rockTint:0xe6ddcb},
 river:{dirt:[.075,.056,.036],dry:[.11,.085,.058],mud:[.036,.027,.019],grass:[.045,.066,.022],moss:[.03,.055,.017],floor:[.38,.42,.5],verge:[.2,.29,.26],rock:[.4,.4,.35],style:[0,0,1,1],moss2:.8,rockTint:0xd2d0bd},
 fault:{dirt:[.075,.058,.047],dry:[.11,.085,.065],mud:[.035,.028,.024],grass:[.05,.047,.03],moss:[.04,.035,.024],floor:[.45,.4,.4],verge:[.25,.22,.22],rock:[.5,.37,.29],style:[0,1,0,0],moss2:0,rockTint:0xc99a7c},
 hybrid:{dirt:[.085,.083,.078],dry:[.11,.105,.095],mud:[.04,.038,.035],grass:[.045,.07,.025],moss:[.035,.06,.02],floor:[.4,.42,.45],verge:[.2,.3,.25],rock:[.45,.46,.43],style:[1,0,0,.6],moss2:.35,rockTint:0xbfc2b8},
 lagoon:{dirt:[.09,.077,.06],dry:[.13,.11,.085],mud:[.035,.03,.025],grass:[.045,.065,.028],moss:[.032,.052,.02],floor:[.4,.43,.5],verge:[.22,.29,.27],rock:[.42,.44,.42],style:[0,0,1,.3],moss2:.6,rockTint:0xb4b8b2},
 manor:{dirt:[.09,.09,.09],dry:[.11,.11,.11],mud:[.04,.04,.04],grass:[.045,.065,.025],moss:[.035,.055,.02],floor:[.4,.42,.45],verge:[.2,.3,.25],rock:[.45,.45,.45],style:[1,0,0,0],moss2:.3,rockTint:0xb0b0aa},
 visitor:{dirt:[.095,.088,.075],dry:[.125,.113,.092],mud:[.04,.036,.03],grass:[.05,.07,.026],moss:[.035,.055,.02],floor:[.42,.43,.46],verge:[.22,.3,.25],rock:[.46,.45,.41],style:[1,0,0,.4],moss2:.4,rockTint:0xc4c0b2}
};

/** The terrain chunk: dense near the route, with route-space coordinates and analytic normals, so chunks meet without seams. */
export function terrainGeometry(index,id,flags,{routeX,height}){
 const start=index*32,mid=start+16,wrap=(((index%8)+8)%8)*32,half=[];
 for(let x=0;x<16;x+=1)half.push(x);for(let x=16;x<44;x+=2)half.push(x);for(let x=44;x<=90.01;x+=9.2)half.push(x);
 const offs=[...half.slice(1).map(x=>-x).reverse(),...half],cols=offs.length,rows=17,P=[],U=[],R=[],N=[],I=[],e=.5;
 for(let j=0;j<rows;j++){const z=start+j*2,rx=routeX(z,id),slope=(routeX(z+e,id)-routeX(z-e,id))/(2*e);
  for(const off of offs){const y=height(off,z,flags),dOff=(height(off+e,z,flags)-height(off-e,z,flags))/(2*e),dZ=(height(off,z+e,flags)-height(off,z-e,flags))/(2*e);
   // The mesh is sheared along the route: at fixed world x, off changes by -route slope.
   const n=new T.Vector3(-dOff,1,-(dZ-dOff*slope)).normalize();
   P.push(rx+off,y,z-mid);N.push(n.x,n.y,n.z);U.push(off*.25,(wrap+j*2)*.25);R.push(off,wrap+j*2,y);}}
 for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){const a=j*cols+i,b=a+cols;I.push(a,b,a+1,a+1,b,b+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setAttribute('route',new T.Float32BufferAttribute(R,3));g.setIndex(I);return g;
}

/** Packed dirt with ruts and puddles on the track, grass and moss on the verge, litter and damp soil under the trees, rock on slopes, a wet band at the waterline. */
export function groundMaterial(kit,maps){
 const t=kit.textures.ground,U={tFloor:{value:maps.floor},tFloorNormal:{value:maps.floorNormal},tVerge:{value:maps.verge},tVergeNormal:{value:maps.vergeNormal},tRock:{value:maps.rock},tRockNormal:{value:maps.rockNormal},tGravel:{value:maps.gravel},
  uDirt:{value:new T.Color()},uDry:{value:new T.Color()},uMud:{value:new T.Color()},uGrass:{value:new T.Color()},uMoss:{value:new T.Color()},uFloorTint:{value:new T.Color()},uVergeTint:{value:new T.Color()},uRockTint:{value:new T.Color()},uStyle:{value:new T.Vector4()},uWater:{value:-.35}};
 const m=new T.MeshStandardMaterial({map:maps.track,normalMap:maps.trackNormal,normalScale:new T.Vector2(1.1,1.1),roughness:.9});
 m.onBeforeCompile=s=>{
  Object.assign(s.uniforms,U);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 route;varying vec3 vRoute;varying float vUpY;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRoute=route;vUpY=normal.y;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vRoute;varying float vUpY;uniform sampler2D tFloor,tFloorNormal,tVerge,tVergeNormal,tRock,tRockNormal,tGravel;uniform vec3 uDirt,uDry,uMud,uGrass,uMoss,uFloorTint,uVergeTint,uRockTint;uniform vec4 uStyle;uniform float uWater;
   // Sin-free hash and value noise whose lattice wraps in z every ${WRAP} m (see WRAP).
   float gh(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
   float gn(vec2 p,float P){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float y0=mod(i.y,P),y1=mod(i.y+1.,P);
    return mix(mix(gh(vec2(i.x,y0)),gh(vec2(i.x+1.,y0)),f.x),mix(gh(vec2(i.x,y1)),gh(vec2(i.x+1.,y1)),f.x),f.y);}
   float gp(vec2 p,float k){return gn(p*k,floor(${WRAP}.*k+.5));}
   float mRoad,mRut,mVerge,mForest,mPuddle,mRim,mRock,mShore,mSub;vec2 rockSide;`)
  .replace('#include <map_fragment>',`
   {
    vec2 p=vRoute.xy;float ax=abs(p.x),hy=vRoute.z,sd=p.x>0.?1.:0.,paved=uStyle.x,canyon=uStyle.y;
    float n1=gp(p,1./8.),n2=gp(p,5./4.),n3=gp(p,1./16.),macro=gp(p+vec2(37.,0.),1./32.)*.6+gp(p+vec2(91.,0.),1./64.)*.4;
    float wob=(gp(vec2(sd*24.+12.,p.y),1./4.)-.5)*1.3*(1.-paved);
    mRoad=1.-smoothstep(3.5+wob,4.4+wob,ax);
    // Ruts sink deep where the ground stayed soft and fade over firm patches; an older,
    // wandering pair from another vehicle drifts in and out of them (chase/environment.js).
    float rutDepth=(.6+.4*smoothstep(.2,.65,gp(vec2(sd*17.+5.,p.y),3./16.)))*(1.-paved),rutOffset=ax-1.05-wob*.06;
    mRut=(1.-smoothstep(.07,.3,abs(rutOffset)))*mRoad*rutDepth;
    float oldRut=ax-1.05-.42*sin(p.y*.2454369+sd*1.5)-.08*sin(p.y*.8835729);
    mRut=max(mRut,(1.-smoothstep(.05,.2,abs(oldRut)))*mRoad*.55*(1.-paved)*smoothstep(.35,.6,gp(vec2(sd*19.+23.,p.y),1./8.)));
    float hump=(1.-smoothstep(.1,.55,ax))*mRoad;
    mVerge=smoothstep(3.6+wob,5.2+wob,ax)*(1.-smoothstep(8.,13.,ax+wob*2.5));
    mForest=smoothstep(8.,13.5,ax+wob*2.5+n3*3.);
    // Puddles: standing water a metre or two across, gathering in the ruts and spilling over the crown,
    // with a dark wet rim. uStyle.w sets how wet the stage is.
    float pool=gp(p+vec2(3.,0.),3./8.)*.75+gp(p+vec2(29.,0.),5./4.)*.12+.32*(1.-smoothstep(.15,1.1,abs(rutOffset)))*(1.-paved),edge=.95-.1*uStyle.w;
    mPuddle=smoothstep(edge,edge+.035,pool)*mRoad*step(.01,uStyle.w);mRim=(smoothstep(edge-.09,edge,pool)-mPuddle)*mRoad*step(.01,uStyle.w);
    // The track's grain is a scanned compact soil (Poly Haven forest_ground_05), normalised by its mean so the stage palette sets the colour.
    vec3 grain=mix(texture2D(map,vMapUv*2.).rgb,texture2D(map,vMapUv.yx*2.+.37).rgb,.3)/vec3(.098,.055,.024);float mDetail=clamp(dot(grain,vec3(.3,.59,.11))*.5,0.,1.);
    vec3 road=mix(uDirt,uDry,smoothstep(.3,.85,n1)*.75)*pow(grain,vec3(1.25));
    road=mix(road,uMud*(1.1+.6*mDetail),max(mRut*.6,hump*.15*(1.-paved)));
    if(paved>.5){
     // Park service road: concrete slabs with dark joints every 8 m and a worn edge line.
     float joint=1.-smoothstep(.02,.07,abs(fract(p.y*.125+.5)-.5)*8.),line=1.-smoothstep(.06,.1,abs(ax-3.75));
     vec3 grit=texture2D(tGravel,vMapUv*.5).rgb;
     road=uDirt*(.72+.5*mDetail)*(.85+.3*n1)*mix(vec3(1.),grit*1.6,.35);
     // Repaired patches, oil and tyre polish down the lanes, hairline cracks.
     road=mix(road,road*.72,smoothstep(.62,.7,gp(p+vec2(7.,0.),1./4.))*.8);road*=1.-.18*(1.-smoothstep(.2,.7,abs(ax-1.05)))*smoothstep(.3,.7,n3);
     float crack=1.-smoothstep(.0,.012,abs(gp(p+vec2(11.,0.),5./8.)-.5));road=mix(road,road*.7,crack*smoothstep(.55,.8,n1));
     road=mix(road,road*.5,joint*(1.-smoothstep(3.6,3.9,ax)));road=mix(road,vec3(.2,.19,.155)*(.8+.3*mDetail),line*.75*smoothstep(.3,.55,n2+.2));
     road=mix(road,texture2D(tFloor,vMapUv*3.).rgb*uFloorTint,smoothstep(2.9,3.7,ax+(n2-.5)*.6)*.75);
    }
    // Scanned ground (Poly Haven, CC0): soil, grass and twigs on the verge; mud, leaf litter and moss under the
    // trees. The floor is sampled twice, the second time axis-swapped, and blended by noise so its tiles don't repeat.
    vec3 vergeTex=texture2D(tVerge,vMapUv*2.).rgb*uVergeTint,floorTex=mix(texture2D(tFloor,vMapUv*3.).rgb,texture2D(tFloor,vMapUv.yx*3.+.37).rgb,smoothstep(.35,.65,gp(p+vec2(71.,0.),1./8.)))*uFloorTint;
    float vLum=dot(vergeTex,vec3(.3,.59,.11));
    vec3 moss=uMoss*(.7+.6*n2),grassy=mix(vergeTex,uGrass*(.6+5.*vLum),.3+.4*paved);
    vec3 verge=mix(grassy,moss*(.6+5.*vLum),smoothstep(.55,.8,n2+n1*.3)*.45*(1.-paved));
    vec3 forest=mix(floorTex,vergeTex,smoothstep(.62,.85,n3)*.45)*(.8+.35*n1);
    // Dark, damp soil in the shade under the trees: big soft patches deeper in.
    forest*=(1.-.38*smoothstep(.45,.75,n3)*smoothstep(10.,18.,ax))*mix(1.,.72,smoothstep(16.,44.,ax));
    vec3 col=mix(road,verge,mVerge);col=mix(col,forest,mForest*(1.-paved*.5));
    // Bare rock on slopes, projected from the side so walls don't smear.
    float slope=1.-vUpY;rockSide=vec2(p.y*.125,hy*.125);
    vec3 rockTop=texture2D(tRock,p*.125).rgb,rockWall=texture2D(tRock,rockSide).rgb;
    vec3 rock=mix(rockTop,rockWall,smoothstep(.3,.6,slope))*uRockTint*(.75+.5*n1);
    if(canyon>.5){
     // Ash and scree off the track, rock where it steepens.
     vec3 scree=texture2D(tGravel,vMapUv*.75).rgb*uRockTint*.42*(.8+.4*n2);
     col=mix(road,mix(scree,rock*.8,smoothstep(.45,.75,n3)*.6),smoothstep(3.6+wob,5.5+wob,ax));
    }
    mRock=smoothstep(.24,.44,slope+(n2-.5)*.16+(n1-.5)*.14+canyon*.06);col=mix(col,rock,mRock);
    // The waterline: a wet, glossy band of mud and silt under the surface.
    float dh=hy-uWater+(n2-.5)*.25+(mDetail-.5)*.12;
    mShore=uStyle.z*(1.-smoothstep(.1,.85,dh));mSub=uStyle.z*smoothstep(.05,-.15,dh);
    col=mix(col,col*.5,mShore);col=mix(col,uMud*(.6+.8*n2),mSub);
    col=mix(col,col*.62,mRim);col=mix(col,uMud*.6,mPuddle);
    // Large-scale variation hides tiling: brightness drift and warm, sun-baked patches.
    col*=mix(.8,1.16,macro);col=mix(col,col*vec3(1.08,.97,.84),smoothstep(.55,.85,gp(p+vec2(53.,0.),1./16.))*.5*(1.-mForest));
    diffuseColor.rgb*=col*1.05;
   }`)
  .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(.95,.86,mRoad);roughnessFactor=mix(roughnessFactor,.66,mRut*.8);roughnessFactor=mix(roughnessFactor,.97,mForest);
   roughnessFactor=mix(roughnessFactor,.88,mRock);roughnessFactor=mix(roughnessFactor,.34,mShore);roughnessFactor=mix(roughnessFactor,.45,mRim);roughnessFactor=mix(roughnessFactor,.03,mPuddle);`)
  .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   // Standing water mirrors the sky, strongest at the grazing angles a driver sees it from.
   {float f=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),3.);reflectedLight.indirectSpecular*=1.+mPuddle*(1.5+6.*f);reflectedLight.indirectDiffuse*=1.-mPuddle*.5;}`)
  .replace('#include <normal_fragment_maps>',`
   {
    vec3 dn=texture2D(normalMap,vNormalMapUv*2.).xyz*2.-1.,vn=texture2D(tVergeNormal,vNormalMapUv*2.).xyz*2.-1.,fn=texture2D(tFloorNormal,vNormalMapUv*3.).xyz*2.-1.,rn=texture2D(tRockNormal,rockSide).xyz*2.-1.;
    vec3 mapN=normalize(mix(dn*vec3(1.2,1.2,1.),vn,mVerge*(1.-uStyle.y)));mapN=normalize(mix(mapN,fn*vec3(1.2,1.2,1.),mForest*(1.-uStyle.y)));
    mapN=normalize(mix(mapN,rn*vec3(1.4,1.4,1.),mRock));
    mapN.xy*=normalScale*(1.+mRut*.5)*(1.-mPuddle*.97)*(1.-mShore*.5)*(1.-mRim*.4);
    normal=normalize(tbn*mapN);
   }`);
 };
 m.customProgramCacheKey=()=>'arcade-ground-v5';
 m.setStage=id=>{const p=STYLES[id]||STYLES.gates;for(const [k,u]of [['dirt','uDirt'],['dry','uDry'],['mud','uMud'],['grass','uGrass'],['moss','uMoss'],['floor','uFloorTint'],['verge','uVergeTint'],['rock','uRockTint']])U[u].value.setRGB(...p[k]);U.uStyle.value.set(...p.style);};
 return m;
}

/** CC0 Poly Haven scans (art/prepare_arcade_rocks.py): mossy roadside boulders and stones, and a bare crag. */
export async function loadRocks(){
 const gltf=await new GLTFLoader().loadAsync('./models/arcade-rocks.glb');const kinds={boulder:[],stone:[],crag:[]},materials=new Set();
 const moss={value:.5},mossColor={value:new T.Color(.05,.085,.025)};
 for(const prefix of ['Boulder','Stone','Crag'])for(let i=0;;i++){
  const near=gltf.scene.getObjectByName(`${prefix}_${i}`),far=gltf.scene.getObjectByName(`${prefix}_${i}_LOD`);if(!near||!far)break;
  const [a,b]=[near,far].map(o=>{const g=o.geometry;g.computeBoundingBox();const top=g.boundingBox.max.y,p=g.attributes.position,h=new Float32Array(p.count);for(let k=0;k<p.count;k++)h[k]=p.getY(k)/top;g.setAttribute('rockH',new T.BufferAttribute(h,1));g.userData.shared=true;return g;});
  const box=a.boundingBox;kinds[prefix.toLowerCase()].push({near:a,far:b,material:near.material,height:box.max.y,radius:Math.max(box.max.x-box.min.x,box.max.z-box.min.z)/2});materials.add(near.material);
 }
 for(const m of materials){
  m.userData.shared=true;m.envMapIntensity=.45;for(const map of [m.map,m.normalMap,m.roughnessMap])if(map)map.anisotropy=8;
  m.onBeforeCompile=s=>{
   s.uniforms.uMoss=moss;s.uniforms.uMossColor=mossColor;
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float rockH;varying float vRockH;varying vec3 vRockUp;')
    .replace('#include <begin_vertex>',`#include <begin_vertex>
     vRockH=rockH;
     #ifdef USE_INSTANCING
      vRockUp=normalize(mat3(modelMatrix*instanceMatrix)*objectNormal);
     #else
      vRockUp=normalize(mat3(modelMatrix)*objectNormal);
     #endif`);
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uMoss;uniform vec3 uMossColor;varying float vRockH;varying vec3 vRockUp;')
    .replace('#include <color_fragment>',`#include <color_fragment>
     {
      // Moss settles on the upward faces, broken up by the scan's own grain; the buried
      // base sits in damp soil, dark where it meets the ground.
      float lum=dot(diffuseColor.rgb,vec3(.3,.59,.11)),m=smoothstep(.5,.85,vRockUp.y+(lum-.25)*1.1+(1.-vRockH)*.1)*uMoss;
      diffuseColor.rgb=mix(diffuseColor.rgb,uMossColor*(.55+1.6*lum),m);
      diffuseColor.rgb*=mix(.62,1.,smoothstep(.12,.42,vRockH));
     }`);
  };
  m.customProgramCacheKey=()=>'arcade-rock-v1';
 }
 const blobCanvas=document.createElement('canvas');blobCanvas.width=blobCanvas.height=64;const x=blobCanvas.getContext('2d'),grad=x.createRadialGradient(32,32,4,32,32,32);grad.addColorStop(0,'#fff');grad.addColorStop(.55,'#9a9a9a');grad.addColorStop(1,'#000');x.fillStyle=grad;x.fillRect(0,0,64,64);
 const blob=new T.MeshBasicMaterial({color:0x060504,alphaMap:new T.CanvasTexture(blobCanvas),transparent:true,opacity:.62,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const crag=kinds.crag[0],thrown=crag.near.clone().translate(0,-crag.height/2,0);thrown.userData.shared=true;
 return{kinds,moss,mossColor,blob,blobGeometry:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),thrown,thrownMaterial:crag.material,
  setStage(id){const p=STYLES[id]||STYLES.gates;moss.value=p.moss2;for(const k of ['boulder','stone'])kinds[k][0].material.color.set(p.rockTint);crag.material.color.set(p.rockTint).lerp(new T.Color(0xffffff),.25);}};
}

/** Surface roots: a tapering, wandering tube 1 m long along +z that dips into the soil. */
export function rootGeometry(seed){
 const r=seeded(seed),pts=[];for(let i=0;i<=6;i++){const v=i/6;pts.push(new T.Vector3(Math.sin(v*3.1+seed)*.07+(r()-.5)*.04*v,.1*Math.pow(1-v,1.4)-.03*v,v));}
 const curve=new T.CatmullRomCurve3(pts),radial=6,rings=10,g=new T.TubeGeometry(curve,rings,1,radial,false),p=g.attributes.position,c=new Float32Array(p.count*3),centre=new T.Vector3(),q=new T.Vector3();
 for(let i=0;i<p.count;i++){const ring=Math.floor(i/(radial+1)),v=ring/rings;curve.getPointAt(v,centre);q.fromBufferAttribute(p,i).sub(centre).multiplyScalar(.1*(1-v*.8));p.setXYZ(i,centre.x+q.x,centre.y+q.y*.75,centre.z+q.z);const l=.72+.12*Math.sin(v*17+seed);c.set([l,l*.95,l*.85],i*3);}
 g.setAttribute('color',new T.BufferAttribute(c,3));g.computeVertexNormals();return g;
}

/** Merge still scenery (fallen wood, roots, litter) into one mesh per material, tagged for the plant shader as lying still. */
export function mergeStill(items){
 if(!items.length)return null;const parts=items.map(({geometry,matrix,tone})=>{const g=geometry.clone().applyMatrix4(matrix);const keep=['position','normal','uv','color'];for(const k of Object.keys(g.attributes))if(!keep.includes(k))g.deleteAttribute(k);
  if(!g.attributes.color){const c=new Float32Array(g.attributes.position.count*3).fill(1);g.setAttribute('color',new T.BufferAttribute(c,3));}
  if(tone){const c=g.attributes.color;for(let i=0;i<c.count;i++)c.setXYZ(i,c.getX(i)*tone[0],c.getY(i)*tone[1],c.getZ(i)*tone[2]);}
  const n=g.attributes.position.count,w=new Float32Array(n*4),e=matrix.elements;for(let i=0;i<n;i++)w.set([e[12],e[14],e[13],-1],i*4);g.setAttribute('plant',new T.BufferAttribute(w,4));return g;});
 // Every source (kit clutter, roots) is indexed, as mergeGeometries requires of all or none.
 const merged=mergeGeometries(parts);parts.forEach(g=>g.dispose());return merged;
}

/**
 * Ground cover, clutter and rocks for one chunk. `put(bucket, off, y, z, sx, sy, sz, rx, ry, rz, tint)` takes an
 * absolute height and a bucket name or rock scan; `still(kind, off, y, z, yaw, scale, tone)` queues merged still pieces.
 */
export function scatter(index,id,flags,{height,put,still,rocks}){
 const start=index*32,rand=seeded(index*7919+id.length*104729+11),side=()=>rand()<.5?-1:1,zz=()=>start+rand()*32;
 const {river,canyon,cave,bridge,urban}=flags,water=river?-.2:-Infinity;
 const dry=(off,z)=>height(off,z)>water;
 // Lowest ground under a footprint, so rocks and plants never hang over a dip.
 const floorAt=(off,z,r)=>Math.min(height(off,z),height(off+r,z),height(off-r,z),height(off,z+r),height(off,z-r));
 // Each chunk shows two boulder and two stone scans; neighbours pick others.
 const pick=(list,k)=>list[(((index*(k+3)+k*5+Math.floor(rand()*list.length))%list.length)+list.length)%list.length];
 const boulders=[pick(rocks.boulder,0),pick(rocks.boulder,1)],stones=[pick(rocks.stone,2),pick(rocks.stone,3)];
 const rock=(kind,off,z,scale,bury)=>{const r=kind.radius*scale,y=floorAt(off,z,r*.7)-kind.height*scale*bury,yaw=rand()*TAU;
  put(kind,off,y,z,scale*(.9+rand()*.25),scale*(.8+rand()*.35),scale*(.9+rand()*.25),(rand()-.5)*.22,yaw,(rand()-.5)*.22,.82+rand()*.3);
  if(Math.abs(height(off+r,z)-height(off-r,z))<r*.7)put('blob',off,floorAt(off,z,r*.5)+.03,z,r*2.7,1,r*2.7,0,yaw,0);return r;};
 const plantsOk=!canyon&&!cave&&!bridge;
 // Ferns, tufts and pebbles at the base of a rock or in a clump's skirt.
 const skirt=(cx,cz,radius,n,scale=1)=>{for(let i=0;i<n;i++){const a=rand()*TAU,d=radius*(.75+Math.sqrt(rand())*.7),x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d*.8;if(Math.abs(x)<4.6||!dry(x,z))continue;const s=(.55+rand()*.8)*scale*(1.15-d/radius*.3);put('grass',x,height(x,z)+.03,z,s,s*(.8+rand()*.6),s,0,rand()*TAU,0);}};
 if(canyon){
  // Talus at the foot of the walls, and fallen blocks on the cave floor clear of the lava.
  if(!bridge)for(let i=0;i<(cave?6:11);i++){const s=side(),off=s*(cave?10.2+rand()*2.2:9.5+Math.pow(rand(),.8)*5.5),z=zz(),big=rand()<.4;
   const kind=big?rocks.crag[0]:rand()<.5?boulders[i%2]:stones[i%2],scale=big?1.2+rand()*1.6:.55+rand()*.6;rock(kind,off,z,scale,.18+rand()*.15);
   for(let k=0;k<3;k++){const o=off+(rand()-.5)*3.5,zk=z+(rand()-.5)*4;if(Math.abs(o)>5)rock(stones[k%2],o,zk,.25+rand()*.3,.2);}}
 }else{
  const inner=river?24:urban?6.8:5.4,outer=river?40:urban?11.4:38;
  // Rock groups: one boulder settled into the verge, a stone or two beside it, planting at its foot.
  const groups=urban?2:river?6:6;
  for(let i=0;i<groups;i++){const s=i%2?1:-1,z=zz();let off=s*(river?22:inner+.8+Math.pow(rand(),1.5)*(urban?3.5:12));
   // On the water stages the group straddles the waterline: half in the shallows, half on the bank.
   if(river){const edge=-.3-rand()*.35;for(let k=0;k<40&&height(off,z)<edge;k++)off+=s*.3;}
   const r=rock(boulders[i%2],off,z,urban?.45+rand()*.25:river?.8+rand()*.6:.65+rand()*.7,.18+rand()*.14);
   for(let k=0,n=1+Math.floor(rand()*3);k<n;k++){const a=rand()*TAU,d=r*(1+rand()*.8),o=off+Math.cos(a)*d,zk=z+Math.sin(a)*d;if(Math.abs(o)>4.8)rock(stones[k%2],o,zk,.35+rand()*.5,.15+rand()*.2);}
   if(plantsOk){for(let k=0;k<2+Math.floor(rand()*3);k++){const a=rand()*TAU,d=r*(.9+rand()*.6),o=off+Math.cos(a)*d,zk=z+Math.sin(a)*d;if(Math.abs(o)>4.8&&dry(o,zk)){const sc=.6+rand()*.6;put('fern',o,height(o,zk),zk,sc,sc,sc,0,rand()*TAU,0);}}skirt(off,z,r*1.3,10+Math.floor(rand()*10));}
  }
  // Lone rocks further back, half sunk in the litter.
  if(!urban)for(let i=0;i<(river?3:5);i++){const s=side(),off=s*(river?30+rand()*10:14+rand()*24),z=zz();if(dry(off,z))rock(rand()<.5?boulders[i%2]:stones[i%2],off,z,.8+rand()*1.1,.28+rand()*.15);}
  // Clumps: planting gathers into beds of ferns, shrubs and tree ferns with grass skirts, not an even sprinkle.
  if(plantsOk)for(let c=0;c<(urban?9:river?24:34);c++){
   const s=c%2?1:-1,z=zz(),off=s*(inner+.4+Math.pow(rand(),1.25)*(outer-inner)),kind=rand(),radius=.9+rand()*1.9;if(!dry(off,z))continue;
   const at=(o,zk,bucket,sc,lift=0)=>{if(Math.abs(o)<4.6||!dry(o,zk))return;put(bucket,o,height(o,zk)+lift,zk,sc,sc,sc,0,rand()*TAU,0);};
   if(kind<.3){for(let i=0,n=4+Math.floor(rand()*5);i<n;i++){const a=rand()*TAU,d=Math.sqrt(rand())*radius;at(off+Math.cos(a)*d,z+Math.sin(a)*d,'fern',(1.45-d/radius*.6)*(.75+rand()*.45));}}
   else if(kind<.6){at(off,z,'bush',.75+rand()*.5,-.1);if(rand()<.4)at(off+(rand()-.5)*radius*2,z+(rand()-.5)*radius*2,'bush',.6+rand()*.4,-.1);for(let i=0;i<3;i++){const a=rand()*TAU;at(off+Math.cos(a)*radius,z+Math.sin(a)*radius,'fern',.7+rand()*.4);}}
   else if(kind<.74&&!urban){at(off,z,'treeFern',2.6+rand()*1.4);for(let i=0;i<3;i++){const a=rand()*TAU,d=.8+rand()*radius;at(off+Math.cos(a)*d,z+Math.sin(a)*d,'fern',.8+rand()*.5);}}
   skirt(off,z,radius,kind>=.74?18+Math.floor(rand()*16):8+Math.floor(rand()*10),kind>=.74?1.15:1);
  }
  // Undergrowth on the far slopes, so the backdrop reads as jungle rather than bare hills.
  if(plantsOk&&!urban)for(let i=0;i<24;i++){const s=i%2?1:-1,z=zz(),off=s*(outer-6+rand()*44);if(!dry(off,z))continue;const big=rand()<.75,sc=big?1.3+rand()*1.1:2.8+rand()*1.6;put(big?'bush':'treeFern',off,height(off,z)-.2,z,sc,sc*(.8+rand()*.4),sc,0,rand()*TAU,0);}
  // The track's own fringe: tufts in small clusters along both edges, a sparse strip on the crown.
  if(!river)for(let c=0;c<(urban?10:22);c++){const crown=!urban&&rand()<.12,cx=crown?(rand()-.5)*.4:side()*(4.3+rand()*1.6+(urban?2.3:0)),cz=zz(),n=crown?4:5+Math.floor(rand()*9),spread=crown?.5:.4+rand()*1.2;
   for(let i=0;i<n;i++){const a=rand()*TAU,d=Math.sqrt(rand())*spread,x=cx+Math.cos(a)*d*(crown?.3:1),z=cz+Math.sin(a)*d*1.4;if(Math.abs(Math.abs(x)-1.05)<.4||(!crown&&Math.abs(x)<3.9))continue;const sc=(.5+rand()*.7)*(1-d/spread*.35)*(crown?.6:1);put('grass',x,height(x,z)+.02,z,sc,sc,sc,0,rand()*TAU,0);}}
 }
 // Track clutter: wheels throw pebbles onto the crown and shoulders and keep the ruts clear; storm-snapped
 // branches, torn limbs and dead fronds lie along the edges, the ones near the ruts pushed along the track.
 const track=!river&&!bridge&&!urban;
 if(track){
  for(let d=0;d<(canyon?9:7);d++){const cx=rand()<.25?(rand()-.5)*.6:side()*(1.5+rand()*(canyon?4.8:3.4)),cz=zz(),n=5+Math.floor(rand()*9),spread=.35+rand()*.9;
   for(let i=0;i<n;i++){const a=rand()*TAU,rr=Math.sqrt(rand())*spread,x=cx+Math.cos(a)*rr,z=cz+Math.sin(a)*rr*1.6;if(Math.abs(Math.abs(x)-1.05)<.3)continue;
    const sc=.03+Math.pow(rand(),1.8)*.08*(1-rr/spread*.5),l=.45+rand()*.4;put('pebble',x,height(x,z)-sc*.12,z,sc*(1+rand()*.5),sc*(1.1+rand()*.6),sc*(1+rand()*.5),(rand()-.5)*.6,rand()*TAU,(rand()-.5)*.6,[l*1.04,l,l*.9]);}}
  for(let i=0;i<7;i++){const x=side()*(1.6+rand()*4.6),z=zz(),sc=.1+rand()*.12;if(Math.abs(Math.abs(x)-1.05)<.4)continue;const l=.5+rand()*.35;put('pebble',x,height(x,z)-sc*.15,z,sc*(1+rand()*.5),sc*(.9+rand()*.5),sc*(1+rand()*.5),(rand()-.5)*.5,rand()*TAU,(rand()-.5)*.5,[l,l*.97,l*.9]);}
  if(!canyon){
   for(let i=0;i<4;i++){const s=side(),x=s*(2.9+rand()*5.5),z=zz(),near=Math.abs(x)<5;still('branch',x,height(x,z),z,near?(rand()<.5?0:Math.PI)+(rand()-.5)*.7:rand()*TAU,.8+rand()*.45,[.95+rand()*.2,.9+rand()*.15,.85+rand()*.15]);}
   for(let i=0;i<2;i++){const s=side(),x=s*(3.6+rand()*4),z=zz();still('limb',x,height(x,z),z,Math.abs(x)<5?(rand()<.5?0:Math.PI)+(rand()-.5)*.6:rand()*TAU,.85+rand()*.35,[.9+rand()*.2,.95+rand()*.1,.8+rand()*.2]);}
   // Dead fronds brown and bleach from the tip; some are still half green.
   for(let i=0;i<9;i++){const s=side(),x=s*(2.7+Math.pow(rand(),1.3)*5),z=zz(),fern=rand()<.3,dryness=rand();still(fern?'fernFrond':'palmFrond',x,height(x,z),z,Math.abs(x)<4.8?s*Math.PI/2+(rand()-.5)*1.4:rand()*TAU,.9+rand()*.45,[(1.15+dryness*.5)*.6,(.8+(1-dryness)*.25)*.6,(.45+(1-dryness)*.35)*.6]);}
  }
 }
 // Litter on the forest floor between clumps: fallen fronds and twigs.
 if(plantsOk&&!urban)for(let i=0;i<10;i++){const s=side(),x=s*((river?27:9)+rand()*16),z=zz();if(!dry(x,z))continue;const fern=rand()<.4,dryness=.4+rand()*.6;
  still(rand()<.3?'branch':fern?'fernFrond':'palmFrond',x,height(x,z),z,rand()*TAU,.8+rand()*.5,[(1.1+dryness*.4)*.6,(.8+(1-dryness)*.2)*.6,(.45+(1-dryness)*.3)*.6]);}
}
