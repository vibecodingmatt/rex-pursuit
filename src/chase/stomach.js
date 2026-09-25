import * as T from 'three';
import {DEFEAT,INTERIOR} from './defeat.js';
import {TISSUE} from './tissue.js';
import {tube,sphere,cylinder} from './vehicle-geometry.js';

// The stomach: a cavern of thick, meandering rugae that slowly churn, slick
// with mucus, stained with bile and pitted with ulcers down toward the acid.
// The acid is turbid bile-green gastric fluid with froth, fat sheen and popping
// bubbles, fuming; half-digested prey floats in it. Standard materials in here
// (the guest, the debris) sink into the acid through absorb().

const CENTER=new T.Vector3(.4,-3,INTERIOR.chamberZ),RADII=new T.Vector3(4.6,3.4,5);
const ACID=INTERIOR.acid;

const NOISE=`
 float sh3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float sn3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(sh3(i),sh3(i+vec3(1,0,0)),f.x),mix(sh3(i+vec3(0,1,0)),sh3(i+vec3(1,1,0)),f.x),f.y),mix(mix(sh3(i+vec3(0,0,1)),sh3(i+vec3(1,0,1)),f.x),mix(sh3(i+vec3(0,1,1)),sh3(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float sf3(vec3 p){return sn3(p)*.5+sn3(p*2.03+3.1)*.3+sn3(p*4.11+7.7)*.2;}`;
const RUGAE=`
 uniform float time,churn;
 // Rugae: ridges of noise stretched along the stomach, heaving in slow waves.
 float rugae(vec3 p){
  vec3 q=p*vec3(2.1,2.1,.8)+vec3(0.,0.,-time*.06);
  float r=1.-abs(sn3(q)*2.-1.),r2=1.-abs(sn3(q*1.9+4.)*2.-1.);
  float wave=.6+.4*sin(p.z*1.6-time*1.7*churn);
  return (pow(r,2.6)*.8+pow(r2,3.)*.35)*wave;
 }
 vec3 chamber(vec3 unit){return ${'vec3('+[CENTER.x,CENTER.y,CENTER.z].map(v=>v.toFixed(3))+')'}+unit*${'vec3('+[RADII.x,RADII.y,RADII.z].map(v=>v.toFixed(3))+')'}*(1.-.12*rugae(unit*2.)-.012*sin(time*1.3+unit.z*3.)*churn);}`;

/** Acid absorption for standard materials: below the surface, colour drowns in
 *  green murk with depth. Composes with an existing onBeforeCompile. */
export function absorb(material,reveal){
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=(shader,renderer)=>{
  previous?.call(material,shader,renderer);
  shader.uniforms.acidLevel={value:ACID};shader.uniforms.acidReveal=reveal;
  shader.vertexShader='varying float acidY;\n'+shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nacidY=(modelMatrix*vec4(transformed,1.)).y;');
  shader.fragmentShader='varying float acidY;uniform float acidLevel;uniform float acidReveal;\n'+shader.fragmentShader.replace('#include <tonemapping_fragment>',`
   float acidDepth=max(0.,acidLevel-acidY),acidWet=smoothstep(0.,.02,acidDepth);
   vec3 drowned=mix(gl_FragColor.rgb*vec3(.62,.78,.28),vec3(.02,.026,.006)*acidReveal,1.-exp(-acidDepth*5.));
   // A scum line where the acid meets anything poking out of it.
   float scum=smoothstep(.05,0.,abs(acidY-acidLevel-.012));gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.3,.29,.14)*acidReveal,scum*.7);
   gl_FragColor.rgb=mix(gl_FragColor.rgb,drowned,acidWet);
   #include <tonemapping_fragment>`);
 };
 const key=material.customProgramCacheKey?.bind(material);
 material.customProgramCacheKey=()=>`acid-absorb-v2-${key?key():''}`;
 return material;
}

export function createStomach(scene,shared){
 const root=new T.Group();root.name='stomach';root.visible=false;scene.add(root);
 const uniforms={...shared,time:shared.time,churn:{value:1},reveal:{value:0},acid:{value:ACID},acidGlow:{value:new T.Color(.3,.34,.07)}};
 let seed=4815;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};

 // ---- Chamber wall -----------------------------------------------------------
 const wallGeo=new T.SphereGeometry(1,160,112);
 const wall=new T.Mesh(wallGeo,new T.ShaderMaterial({uniforms,side:T.BackSide,vertexShader:`
  ${NOISE}${RUGAE}
  varying vec3 surface,surfaceNormal,unitV;varying float fold;
  void main(){
   vec3 u=normalize(position);unitV=u;surface=chamber(u);fold=rugae(u*2.);
   vec3 t1=normalize(cross(u,abs(u.y)<.95?vec3(0.,1.,0.):vec3(1.,0.,0.))),t2=cross(u,t1);
   vec3 a=chamber(normalize(u+t1*.004))-chamber(normalize(u-t1*.004)),b=chamber(normalize(u+t2*.004))-chamber(normalize(u-t2*.004));
   surfaceNormal=normalize(cross(a,b));if(dot(surfaceNormal,u)>0.)surfaceNormal=-surfaceNormal;
   gl_Position=projectionMatrix*modelViewMatrix*vec4(surface,1.);
  }`,fragmentShader:`
  uniform float time,reveal,acid,light;uniform vec3 eye,outside,acidGlow;
  varying vec3 surface,surfaceNormal,unitV;varying float fold;
  ${NOISE}
  ${TISSUE}
  void main(){
   vec3 p=unitV*4.;float mid=sn3(p*3.),fine=sn3(p*22.),big=sf3(p*.8);
   // Gastric lining: maroon in the furrows, raw red on the crests of the folds.
   vec3 albedo=mix(vec3(.09,.01,.014),vec3(.5,.1,.085),smoothstep(.12,.8,fold))*(.8+.35*mid);
   // Ulcers: dark craters with angry rims, thickest near the acid.
   float above=surface.y-acid,low=1.-smoothstep(.2,2.4,above);
   float ulcer=smoothstep(.72,.8,sn3(p*1.7+11.))*(.4+.6*low),ulcerRim=smoothstep(.64,.72,sn3(p*1.7+11.))-ulcer;
   albedo=mix(albedo,vec3(.62,.07,.05),ulcerRim*.7);albedo=mix(albedo,vec3(.06,.01,.01),ulcer);
   // Bile stains and a scum line where the acid has sloshed.
   float stain=low*smoothstep(.35,.75,big);albedo=mix(albedo,vec3(.3,.28,.05)*(.7+.5*mid),stain*.7);
   float line=smoothstep(.12,0.,abs(above-.06-.04*sin(p.x*3.+time)))*.8;albedo=mix(albedo,vec3(.42,.4,.2),line);
   // Mucus runs down the walls in glistening sheets.
   float runs=smoothstep(.62,.82,sn3(vec3(p.x*9.,p.y*1.6+time*.12,p.z*9.)))*smoothstep(.3,.7,fold);
   albedo=mix(albedo,vec3(.5,.44,.3),runs*.15);
   vec3 n=bumpNormal(surface,normalize(surfaceNormal),fine*.5+mid*.5-ulcer*1.2+runs*.3,.06);
   // Light: the lamp at the eye, the acid's sickly bounce from below, and faint
   // daylight through the thinnest folds.
   vec3 bounce=acidGlow*max(0.,-n.y)*exp(-max(0.,above)*.7)*reveal;
   vec3 glow=outside*.12*(1.-fold)*(.6+.4*big)+bounce*albedo*2.2;
   vec3 color=wetLight(albedo,n,surface,eye,.55+.4*runs,.4+runs,glow)*(.35+.65*smoothstep(0.,.5,fold));
   // Below the waterline the wall drowns in the murk.
   color=mix(color,vec3(.02,.026,.006),1.-exp(-max(0.,-above)*5.));
   gl_FragColor=vec4(color*light*reveal,1.);
  }`}));
 wall.frustumCulled=false;root.add(wall);

 // ---- The acid ----------------------------------------------------------------
 const poolGeo=new T.PlaneGeometry(11,12,180,180);poolGeo.rotateX(-Math.PI/2);
 const froth=[];for(let i=0;i<8;i++)froth.push(new T.Vector4(0,0,0,0));
 const poolUniforms={...uniforms,froth:{value:froth}};
 const pool=new T.Mesh(poolGeo,new T.ShaderMaterial({uniforms:poolUniforms,transparent:true,depthWrite:false,vertexShader:`
  uniform float time,churn;varying vec3 surface;varying vec2 flat_;varying float swell;
  void main(){vec3 p=position;flat_=p.xz;
   swell=sin(p.x*1.3+time*1.1)*.5+sin(p.z*1.7-time*.9*churn)*.4+sin((p.x+p.z)*3.1+time*2.3)*.12;
   p.y+=swell*.035;surface=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(surface,1.);}`,fragmentShader:`
  uniform float time,reveal,light;uniform vec3 eye;uniform vec4 froth[8];
  varying vec3 surface;varying vec2 flat_;varying float swell;
  ${NOISE}
  void main(){
   vec2 q=surface.xz;float t=time;
   vec3 v=normalize(eye-surface);
   // Ripples from the churn and the rising bubbles.
   vec2 grad=vec2(cos(q.x*1.3+t*1.1)*1.3*.5+cos((q.x+q.y)*3.1+t*2.3)*3.1*.12,cos(q.y*1.7-t*.9)*1.7*.4+cos((q.x+q.y)*3.1+t*2.3)*3.1*.12)*.035;
   grad+=(vec2(sn3(vec3(q*7.,t*.8)),sn3(vec3(q*7.+5.,t*.8)))-.5)*.05;
   vec3 n=normalize(vec3(-grad.x,1.,-grad.y));
   // Turbid gastric fluid: bile-green, cloudy, flecked with half-dissolved matter.
   float cloud=sf3(vec3(q*1.4,t*.1)),fleck=smoothstep(.8,.9,sn3(vec3(q*18.,t*.3)));
   vec3 body=mix(vec3(.03,.035,.008),vec3(.13,.14,.03),cloud)+vec3(.09,.05,.02)*fleck;
   // Froth: dirty foam clings around whatever floats in it and along the wall.
   float foam=0.;for(int i=0;i<8;i++){float d=length(q-froth[i].xy);foam+=froth[i].w*smoothstep(froth[i].z,froth[i].z*.3,d);}
   float bubbly=sn3(vec3(q*26.,t*.6)),cells=smoothstep(.3,.55,bubbly);
   foam=clamp(foam*(.4+.8*sf3(vec3(q*3.,t*.2)))-.15,0.,1.)*(.55+.45*cells);
   // Fat and oil float on it in rainbow slicks.
   float oil=smoothstep(.6,.8,sf3(vec3(q*.9+7.,t*.05)));vec3 sheen=.5+.5*cos(6.283*(sf3(vec3(q*3.,t*.1))*2.+vec3(0.,.33,.67)));
   vec3 l=normalize(eye+vec3(-.25,.35,-.3)-surface);float d=length(eye-surface),fall=1./(1.+d*d*.12);
   float spec=pow(max(0.,dot(n,normalize(l+v))),260.)*1.4+pow(max(0.,dot(n,normalize(l+v))),30.)*.1;
   float fres=.04+.96*pow(1.-max(0.,dot(n,v)),5.);
   vec3 walls=vec3(.16,.03,.025);
   vec3 color=body*(.35+.65*fall)+mix(vec3(0.),walls,fres)+vec3(1.,.95,.7)*min(spec*fall,.18);
   color=mix(color,vec3(.3,.29,.15)*(.4+.6*fall)*(.8+.4*bubbly),foam*.75);
   color+=sheen*oil*fres*.35*fall;
   // Tiny bubbles fizzing up everywhere.
   float fizz=smoothstep(.93,.99,sn3(vec3(q*55.,t*3.)));color+=vec3(.55,.55,.3)*fizz*.25*fall;
   gl_FragColor=vec4(color*light*reveal,mix(.9,1.,foam));
  }`}));
 pool.position.y=ACID;pool.position.z=CENTER.z;pool.position.x=CENTER.x;pool.frustumCulled=false;root.add(pool);

 // Bubbles swelling and bursting, each leaving a ring.
 const bubbleMat=new T.MeshStandardMaterial({color:0x9c9a4c,roughness:.22,metalness:.05,transparent:true,opacity:.75});
 const bubbles=new T.InstancedMesh(new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),bubbleMat,40);bubbles.frustumCulled=false;root.add(bubbles);
 const rings=new T.InstancedMesh(new T.TorusGeometry(1,.05,6,48),new T.MeshBasicMaterial({color:0x9a9a60,transparent:true,opacity:.18,depthWrite:false}),20);rings.frustumCulled=false;root.add(rings);
 const bubbleData=Array.from({length:40},(_,i)=>({x:CENTER.x+(rand()-.5)*6,z:CENTER.z-2.2+rand()*5,phase:rand(),radius:.02+rand()*.07*(i<8?2:1),rate:.25+rand()*.5}));

 // Fumes: vapour lifting off the surface and curling in the chamber's air.
 const fumeGeo=new T.InstancedBufferGeometry();{const q=new T.PlaneGeometry(1,1);fumeGeo.index=q.index;fumeGeo.setAttribute('position',q.attributes.position);fumeGeo.setAttribute('uv',q.attributes.uv);}
 const fumeData=new T.InstancedBufferAttribute(new Float32Array(26*4),4);fumeGeo.setAttribute('fume',fumeData);fumeGeo.instanceCount=26;
 for(let i=0;i<26;i++)fumeData.setXYZW(i,CENTER.x+(rand()-.5)*6.5,CENTER.z-2.5+rand()*5.5,rand(),.6+rand()*.9);
 const fumes=new T.Mesh(fumeGeo,new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`
  uniform float time,acid;attribute vec4 fume;varying vec2 vUv;varying float age,seed;
  void main(){seed=fume.z;age=fract(time*.16*fume.w+fume.z);vec3 c=vec3(fume.x+sin(time*.4+seed*9.)*.3*age,acid+.1+age*2.2,fume.y+cos(time*.3+seed*7.)*.3*age);
   float size=.4+age*1.2;vec4 mv=viewMatrix*vec4(c,1.);mv.xy+=position.xy*size;vUv=uv;gl_Position=projectionMatrix*mv;}`,fragmentShader:`
  uniform float reveal,light;varying vec2 vUv;varying float age,seed;
  ${NOISE}
  void main(){vec2 p=vUv-.5;float r=length(p)*2.;float n=sf3(vec3(vUv*3.+seed*5.,age*2.));float a=smoothstep(1.,.2,r+(n-.5)*.6)*sin(3.1416*age)*.035;
   gl_FragColor=vec4(vec3(.36,.38,.18)*light*reveal,a*reveal);}`}));
 fumes.frustumCulled=false;fumes.renderOrder=3;root.add(fumes);

 // ---- What she ate before: half-digested prey ---------------------------------
 const reveal=uniforms.reveal;
 const mat=(color,extra={})=>absorb(new T.MeshStandardMaterial({color,roughness:.55,...extra}),reveal);
 const bone=mat(0xd8c9a2,{roughness:.62}),boneStained=mat(0x9a8a58,{roughness:.5}),meat=mat(0x7a2a24,{roughness:.32}),fat=mat(0xc9b27a,{roughness:.35}),hoof=mat(0x2a2320,{roughness:.4}),leather=mat(0x2b241c,{roughness:.45}),hide=mat(0x5b4f45,{roughness:.8});
 // A goat's hind leg: stripped bone, rags of meat still on it, the hoof.
 const goat=new T.Group();goat.position.set(CENTER.x-1.6,ACID-.08,CENTER.z-.4);goat.rotation.set(.35,.8,-.25);root.add(goat);
 tube(goat,bone,[0,0,0],[0,.62,.05],.045);sphere(goat,bone,.075,[0,.66,.05],[1,.8,1]);sphere(goat,bone,.068,[0,0,0],[1.1,.8,1]);
 tube(goat,boneStained,[0,0,0],[.03,-.5,.1],.036);tube(goat,hide,[.03,-.5,.1],[.04,-.66,.12],.05);sphere(goat,hoof,.06,[.045,-.72,.13],[.9,1.2,1.3]);
 for(let i=0;i<5;i++){const y=.08+i*.1;sphere(goat,i%2?meat:fat,.05+rand()*.03,[(rand()-.5)*.06,y,.05+(rand()-.5)*.04],[1.1,1.6,.7]);}
 // Ribs arching out of the acid like a wreck.
 const ribs=new T.Group();ribs.position.set(CENTER.x+2.2,ACID-.15,CENTER.z-1.6);ribs.rotation.y=-.6;root.add(ribs);
 for(let i=0;i<5;i++){const curve=new T.QuadraticBezierCurve3(new T.Vector3(0,0,i*.16),new T.Vector3(.35,.55-i*.04,i*.16+.05),new T.Vector3(.7,-.05,i*.16));const m=new T.Mesh(new T.TubeGeometry(curve,20,.02-i*.0015,6,false),i%2?boneStained:bone);ribs.add(m);}
 tube(ribs,boneStained,[0,0,-.05],[0,0,.7],.035);sphere(ribs,meat,.07,[.12,.12,.3],[1.3,.6,1]);
 // His shoe, and rags of his shirt, floating.
 const shoe=new T.Group();shoe.position.set(CENTER.x-.2,ACID+.02,CENTER.z-1.4);shoe.rotation.set(.1,2.2,.35);root.add(shoe);
 sphere(shoe,leather,.1,[0,0,0],[.8,.45,1.6]);cylinder(shoe,hide,.05,.055,.1,[0,.05,-.06],[0,0,0]);
 const rag=new T.PlaneGeometry(.5,.36,12,8),rp=rag.attributes.position;for(let i=0;i<rp.count;i++)rp.setZ(i,Math.sin(rp.getX(i)*9)*.02+Math.cos(rp.getY(i)*11)*.015);rag.computeVertexNormals();
 const cloth=mat(0xa7a792,{side:T.DoubleSide,roughness:.7});
 for(const [x,z,r]of [[-.9,-2.,.5],[1.3,.6,2.1]]){const m=new T.Mesh(rag,cloth);m.position.set(CENTER.x+x,ACID+.01,CENTER.z+z);m.rotation.set(-Math.PI/2+.1,0,r);root.add(m);}
 const floaters=[goat,ribs,shoe];

 // ---- Light for the standard materials in here --------------------------------
 const key=new T.PointLight(0xffd8c0,0,9,1.6);root.add(key);
 const acidLight=new T.PointLight(0x9fb43c,0,8,1.6);acidLight.position.set(CENTER.x+.5,ACID+1.4,CENTER.z+.8);root.add(acidLight);
 const rim=new T.PointLight(0xff3a22,0,8,2);rim.position.set(CENTER.x+2.8,ACID+2.2,CENTER.z+2.4);root.add(rim);
 const ambient=new T.AmbientLight(0x6a3a30,0);root.add(ambient);

 const dummy=new T.Object3D();
 function reset(){root.visible=false;uniforms.reveal.value=0;key.intensity=acidLight.intensity=rim.intensity=ambient.intensity=0;}
 return{root,pool,acidLevel:ACID,center:CENTER,uniforms,floaters,absorb:m=>absorb(m,reveal),froth,
  reset,
  update(t,camera,reveal_,reducedMotion){
   // The chamber lights up once, as she comes out of the cardia; it stays lit
   // (by her lamp and the acid's glow) until the acid closes over her.
   const r=T.MathUtils.smoothstep(t,DEFEAT.bellyAt-.8,DEFEAT.bellyAt+.35);
   uniforms.reveal.value=r;root.visible=r>0;if(!root.visible)return;
   const motion=reducedMotion?.3:1;uniforms.churn.value=motion;
   key.position.copy(camera.position).add(new T.Vector3(.9,.8,.1));key.intensity=3.8*r;acidLight.intensity=1.4*r;rim.intensity=5*r;ambient.intensity=.25*r;
   const clock=t-DEFEAT.slideAt;
   floaters.forEach((f,i)=>{f.position.y+=(Math.sin(clock*1.3+i*2.1)*.02*motion-(f.userData.bob??0));f.userData.bob=Math.sin(clock*1.3+i*2.1)*.02*motion;f.rotation.z+=Math.sin(clock*.9+i)*.0008*motion;});
   froth[0].set(CENTER.x-1.6,CENTER.z-.4,.9,.8);froth[1].set(CENTER.x+2.2,CENTER.z-1.3,1.1,.7);froth[2].set(CENTER.x-.2,CENTER.z-1.4,.5,.6);
   for(let i=0;i<bubbleData.length;i++){
    const b=bubbleData[i],u=(clock*(reducedMotion?.12:b.rate)+b.phase)%1,size=b.radius*Math.sin(Math.PI*Math.min(1,u*1.15));
    dummy.position.set(b.x,ACID-.01,b.z);dummy.rotation.set(0,0,0);dummy.scale.set(size,size*.8,size);dummy.updateMatrix();bubbles.setMatrixAt(i,dummy.matrix);
    if(i<20){const pop=Math.max(0,u*1.15-1)/.15;dummy.position.y=ACID+.015;dummy.rotation.x=Math.PI/2;dummy.scale.setScalar(b.radius*(1+pop*5));dummy.scale.z=1-pop;dummy.updateMatrix();rings.setMatrixAt(i,dummy.matrix);}
   }
   bubbles.instanceMatrix.needsUpdate=rings.instanceMatrix.needsUpdate=true;bubbleMat.opacity=.75*r;rings.material.opacity=.18*r;
  }};
}
