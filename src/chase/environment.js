import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createFoliageKit,dustTexture,seeded,WIND} from './foliage.js';
import {SUN_DIRECTION} from './atmosphere.js';
import {WET,RAIN,RAIN_TIME,WIND_GUST} from './weather-state.js';
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

function groundGeometry(){
 const xs=[];for(let x=-70;x<-30;x+=5)xs.push(x);for(let x=-30;x<-12;x+=2)xs.push(x);for(let x=-12;x<12;x+=.5)xs.push(x);for(let x=12;x<30;x+=2)xs.push(x);for(let x=30;x<=70;x+=5)xs.push(x);
 const rows=57,P=[],U=[],I=[];
 for(let r=0;r<rows;r++){const z=-CHUNK/2+r*CHUNK/(rows-1);for(const x of xs){P.push(x,groundHeight(x,z),z);U.push(x/3.5,z/3.5);}}
 const cols=xs.length;for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+cols;I.push(a,b,a+1,a+1,b,b+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();return g;
}
function groundMaterial(kit){
 const t=kit.textures.ground,m=new T.MeshStandardMaterial({map:t.dirt,normalMap:t.dirtNormal,normalScale:new T.Vector2(1.1,1.1),roughness:.85});
 m.onBeforeCompile=s=>{
  s.uniforms.tLitter={value:t.litter};s.uniforms.tLitterNormal={value:t.litterNormal};s.uniforms.uWet=WET;s.uniforms.uRain=RAIN;s.uniforms.uRainTime=RAIN_TIME;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGround;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGround=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vGround;uniform sampler2D tLitter,tLitterNormal;uniform float uWet,uRain,uRainTime;
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
   float mRoad,mRut,mHump,mVerge,mForest,mPuddle,mDetail;`)
  .replace('#include <map_fragment>',`
   {
    vec2 p=vGround.xz;float ax=abs(p.x);
    float n1=gp(p,10./28.),n2=gp(p,35./28.),n3=gp(p,2./28.);
    float wob=(gp(vec2(p.x>0.?12.:36.,p.y),.25)-.5)*1.3;
    mRoad=1.-smoothstep(3.8+wob,4.9+wob,ax);
    mRut=(1.-smoothstep(.1,.38,abs(ax-1.02-wob*.06)))*mRoad;
    mHump=(1.-smoothstep(.1,.55,ax))*mRoad;
    mVerge=smoothstep(3.9+wob,5.4+wob,ax)*(1.-smoothstep(8.,13.,ax+wob*2.5));
    mForest=smoothstep(8.,13.5,ax+wob*2.5+n3*3.);
    mPuddle=smoothstep(.72-.08*uWet,.8-.06*uWet,gp(p+vec2(3.,0.),12./28.)*(.45+mRut*.7)+n2*.08)*mRoad;
    mDetail=texture2D(map,vMapUv).r;
    vec3 mud=vec3(.07,.047,.03),dirt=vec3(.19,.135,.087),dry=vec3(.3,.23,.155);
    vec3 road=mix(dirt,dry,smoothstep(.3,.85,n1)*.75)*(.6+.8*mDetail);
    road=mix(road,mud*(.75+.5*mDetail),max(mRut*.9,mHump*.15));
    vec3 litter=texture2D(tLitter,vMapUv*.5).rgb;
    vec3 moss=vec3(.05,.08,.022)*(.7+.6*n2),grassy=vec3(.07,.092,.032)*(.8+.4*mDetail);
    vec3 verge=mix(mix(litter*.55,grassy,.55),moss,.35+.3*n1);
    vec3 forest=mix(litter*.62,moss,smoothstep(.5,.8,n2)*.55)*(.75+.4*n1);
    vec3 col=mix(road,verge,mVerge);col=mix(col,forest,mForest);
    col=mix(col,col*.68,mPuddle);
    // Rain darkens porous ground; standing water turns muddy brown.
    col*=1.-uWet*(.42-.12*mForest);col=mix(col,col*vec3(.55,.5,.45),mPuddle*uWet);
    diffuseColor.rgb*=col*1.05;
   }`)
  .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(.94,.86,mRoad);roughnessFactor=mix(roughnessFactor,.6,mRut*.8);roughnessFactor=mix(roughnessFactor,.96,mForest);
   roughnessFactor=mix(roughnessFactor,.72,mPuddle);
   roughnessFactor=mix(roughnessFactor,mix(mix(.46,.56,mVerge),.66,mForest),uWet);roughnessFactor=mix(roughnessFactor,.07,mPuddle*uWet);`)
  .replace('#include <normal_fragment_maps>',`
   {
    vec3 dn=texture2D(normalMap,vNormalMapUv).xyz*2.-1.,ln=texture2D(tLitterNormal,vNormalMapUv*.5).xyz*2.-1.;
    vec3 mapN=normalize(mix(dn*vec3(1.2,1.2,1.),ln*vec3(1.4,1.4,1.),mForest));
    mapN.xy*=normalScale*(1.+mRut*.5)*(1.-mPuddle*.3)*(1.-mPuddle*uWet*.94);
    if(uRain>.01&&mPuddle*uWet>.01)mapN.xy+=rainRipples(vGround.xz*2.5,uRainTime)*.55*uRain*mPuddle;
    normal=normalize(tbn*mapN);
   }`);
 };
 m.customProgramCacheKey=()=> 'rex-jungle-ground-v2';return m;
}

export function createJungle(root,{canopy}={}){
 const branchMap=new T.TextureLoader().load('./textures/jungle-branch.png');branchMap.colorSpace=T.SRGBColorSpace;branchMap.anisotropy=8;
 const kit=createFoliageKit(branchMap),M=kit.materials;
 const ground=groundGeometry(),groundMat=groundMaterial(kit);
 const obj=new T.Object3D(),matrix=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),v=new T.Vector3(),s=new T.Vector3();
 const at=(x,z,y=0,rotY=0,scale=1,tilt=[0,0])=>matrix.compose(v.set(x,groundHeight(x,z)+y,z),q.setFromEuler(e.set(tilt[0],rotY,tilt[1],'YXZ')),typeof scale==='number'?s.setScalar(scale):s.set(...scale));
 const recolor=(g,rgb)=>{const c=g.attributes.color;for(let i=0;i<c.count;i++)c.setXYZ(i,c.getX(i)*rgb[0],c.getY(i)*rgb[1],c.getZ(i)*rgb[2]);return g;};

 // Build six unique layouts. Each entry: {material, required geometries[], optional geometries[]}.
 function layout(seed){
  const rand=seeded(seed),buckets=new Map(),add=(material,geometry,optional=false)=>{if(!buckets.has(material))buckets.set(material,{required:[],optional:[]});buckets.get(material)[optional?'optional':'required'].push(geometry);};
  const put=(material,source,m,optional,tone)=>{const g=source.clone().applyMatrix4(m);if(tone)recolor(g,tone);add(material,g,optional);};
  const side=()=>rand()<.5?-1:1,zz=()=>(rand()-.5)*CHUNK;
  // Rainforest giants: a few frame the verge, most stand back in the haze.
  for(let i=0;i<8;i++){const sd=i%2?1:-1,x=sd*(i<2?12.5+rand()*3:16+Math.pow(rand(),.7)*28),z=zz(),h=17+rand()*15,t=kit.giants[Math.floor(rand()*kit.giants.length)],m=at(x,z,-.3,rand()*TAU,[h*(.85+rand()*.3),h,h*(.85+rand()*.3)]),tone=[.85+rand()*.25,.85+rand()*.2,.8+rand()*.2];put(M.bark,t.wood,m,false,tone);put(M.canopy,t.leaves,m,false,[.8+rand()*.3,.85+rand()*.25,.75+rand()*.25]);}
  // Leaning edge trees close a canopy tunnel over the road at 10-17 m.
  for(let i=0;i<4;i++){const sd=i%2?1:-1,x=sd*(10.5+rand()*3.5),z=zz(),h=15+rand()*6,t=kit.leaners[Math.floor(rand()*kit.leaners.length)],m=at(x,z,-.2,(sd>0?Math.PI:0)+(rand()-.5)*.5,[h,h,h]);put(M.bark,t.wood,m,false,[.85+rand()*.2,.85+rand()*.2,.8+rand()*.2]);put(M.canopy,t.leaves,m,false,[.75+rand()*.3,.82+rand()*.25,.7+rand()*.25]);}
  // Palms lean toward the light over the road edge; tree ferns fill the mid layer.
  for(let i=0;i<5;i++){const sd=side(),x=sd*(7+rand()*13),z=zz(),h=9+rand()*6,t=kit.palms[Math.floor(rand()*kit.palms.length)],m=at(x,z,-.1,sd>0?Math.PI+(rand()-.5)*.8:(rand()-.5)*.8,h);put(M.bark,t.wood,m,false);put(M.palm,t.fronds,m,false,[.9+rand()*.2,.9+rand()*.2,.85+rand()*.2]);}
  for(let i=0;i<5;i++){const x=side()*(8.8+rand()*9),z=zz(),h=2.6+rand()*2.6,t=kit.treeFerns[Math.floor(rand()*kit.treeFerns.length)],m=at(x,z,0,rand()*TAU,h);put(M.bark,t.wood,m,true);put(M.fern,t.fronds,m,true,[.95,1,.95]);}
  // Concealing understory belt: dense, layered and never thinned.
  for(const sd of [-1,1])for(const [x0,n,size]of [[15,7,0],[19.5,8,1],[23.5,9,2],[27,7,2]])for(let k=0;k<n;k++){const z=k*CHUNK/n-CHUNK/2+rand()*2,x=sd*(x0+rand()*2.4),b=kit.bushes[size],m=at(x,z,-.2,rand()*TAU,size?1.25+rand()*.35:1+rand()*.3);put(M.shrub,b,m,false,[.85+rand()*.3,.9+rand()*.2,.8+rand()*.25]);if(rand()<.6){const e2=kit.elephant[Math.floor(rand()*2)],m2=at(x+(rand()-.5)*3,z+(rand()-.5)*3,0,rand()*TAU,2.2+rand()*1.4);put(M.broad,e2,m2,false);}}
  // Verge planting stays low and open: ferns, broad leaves, rocks.
  for(let i=0;i<16;i++){const x=side()*(5.4+Math.pow(rand(),.8)*9),z=zz(),m=at(x,z,0,rand()*TAU,.8+rand()*.9);put(M.fern,kit.ferns[Math.floor(rand()*3)],m,true,[.85+rand()*.3,.9+rand()*.2,.8+rand()*.25]);}
  for(let i=0;i<9;i++){const x=side()*(6.6+rand()*8.5),z=zz(),banana=rand()<.3,m=at(x,z,0,rand()*TAU,banana?1.4+rand()*.8:1+rand()*1.1);put(M.broad,banana?kit.banana[0]:kit.elephant[Math.floor(rand()*2)],m,true,[.9+rand()*.2,.95+rand()*.15,.85+rand()*.2]);}
  for(let i=0;i<10;i++){const sd=side(),x=sd*(5.2+rand()*10),z=zz(),big=rand()<.2,sc=big?.8+rand()*.8:.16+rand()*.42,m=at(x,z,-sc*.15,rand()*TAU,[sc*(1+rand()*.4),sc,sc*(1+rand()*.4)]);put(M.rock,kit.rocks[Math.floor(rand()*3)],m,!big,[.85+rand()*.2,.85+rand()*.2,.82+rand()*.2]);}
  // Mossy fallen log.
  if(rand()<.7){const x=side()*(9+rand()*8),z=zz(),m=at(x,z,.25,rand()*TAU,[.55,6+rand()*4,.55],[Math.PI/2,0]);put(M.bark,kit.giants[0].wood,m,false,[.8,.85,.75]);}
  const meshes=[];
  for(const [material,{required,optional}]of buckets){
   for(let i=optional.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[optional[i],optional[j]]=[optional[j],optional[i]];}
   const all=[...required,...optional],geometry=mergeGeometries(all);if(!geometry)continue;
   // Index offsets let a draw range drop a fraction of the optional plants.
   let offset=0;const marks=[];for(const g of all){offset+=g.index?g.index.count:g.attributes.position.count;marks.push(offset);}
   meshes.push({material,geometry,requiredEnd:required.length?marks[required.length-1]:0,marks:marks.slice(required.length),total:offset});
   all.forEach(g=>g.dispose());
  }
  // Grass: instanced tufts with distance thinning; dense at the road edge, a
  // sparse strip on the crown between the ruts, none in the wheel tracks.
  const tufts=[];for(let c=0;c<110;c++){const crown=rand()<.1,cx=crown?(rand()-.5)*.5:side()*(4.2+Math.pow(rand(),1.35)*9),cz=zz(),n=crown?5:6+Math.floor(rand()*12),spread=crown?.5:.5+rand()*1.3;for(let i=0;i<n;i++){const a=rand()*TAU,d=Math.sqrt(rand())*spread,x=cx+Math.cos(a)*d*(crown?.35:1),z=Math.max(-13.9,Math.min(13.9,cz+Math.sin(a)*d)),sc=(.55+rand()*.75)*(1-d/spread*.35);if(Math.abs(Math.abs(x)-1.02)<.35)continue;tufts.push(at(x,z,0,rand()*TAU,crown?sc*.6:sc).clone());}}
  for(let i=tufts.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[tufts[i],tufts[j]]=[tufts[j],tufts[i]];}
  return{meshes,tufts};
 }
 const layouts=Array.from({length:UNIQUE},(_,i)=>layout(9001+i*37));
 const tuftGeometry=mergeGeometries([kit.grass[0]]);
 const chunks=[];
 for(let k=0;k<COUNT;k++){
  const group=new T.Group(),data=layouts[k%UNIQUE];group.position.z=k*CHUNK+START;root.add(group);
  const floor=new T.Mesh(ground,groundMat);floor.receiveShadow=true;floor.name='Jungle ground';group.add(floor);
  const parts=data.meshes.map(d=>{const mesh=new T.Mesh(d.geometry,d.material);mesh.castShadow=d.material===M.bark||d.material===M.rock;mesh.receiveShadow=true;group.add(mesh);return{mesh,data:d};});
  const grass=new T.InstancedMesh(tuftGeometry,M.grass,data.tufts.length);data.tufts.forEach((m,i)=>grass.setMatrixAt(i,m));grass.receiveShadow=true;grass.computeBoundingSphere();group.add(grass);
  chunks.push({group,parts,grass});
 }

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
 function thin(){for(const c of chunks)for(const {mesh,data}of c.parts){const n=Math.floor(data.marks.length*floraFactor);mesh.geometry.setDrawRange(0,n?data.marks[n-1]:data.requiredEnd||0);if(!n&&!data.requiredEnd)mesh.geometry.setDrawRange(0,0);}}
 function positionChunks(){chunks.forEach((c,k)=>c.group.position.z=k*CHUNK+START);}
 return{
  kit,chunks,motes,dustMap,
  setQuality(t){grassFactor=t.grass;floraFactor=t.flora;particleFactor=t.particles;shafts.visible=!!t.beams;motes.visible=!t.beams;moteGeo.setDrawRange(0,Math.floor(moteCount*particleFactor));falling.count=Math.floor(fallingCount*particleFactor);thin();},
  reset(){positionChunks();},
  update(dt,speed,time,camera){
   // Storm gusts quicken the sway; in still air the clock tracks game time exactly.
   windClock+=dt*(1+(WIND_GUST.value-1)*.3);WIND.value=windClock;
   for(const c of chunks){
    c.group.position.z+=speed*dt;if(c.group.position.z>200)c.group.position.z-=COUNT*CHUNK;
    // Beyond ~140 m ahead the fog is opaque; far behind is only seen during the defeat spin.
    c.group.visible=c.group.position.z<150&&c.group.position.z>-96;
    // Distance thinning: full density near the camera, a sparse carpet far away.
    const d=Math.abs(c.group.position.z-6),lod=Math.max(.12,1-Math.max(0,d-18)/70);
    c.grass.count=Math.floor(c.grass.instanceMatrix.count*Math.min(1,grassFactor)*lod);
   }
   moteUniforms.time.value=time;moteUniforms.strength.value=1-WET.value;shaftMat.opacity=.02*(1-WET.value);motes.visible=moteUniforms.strength.value>.01&&!shafts.visible;moteUniforms.scroll.value=(moteUniforms.scroll.value+speed*dt)%54;moteUniforms.pixel.value=Math.min(2,devicePixelRatio);
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
