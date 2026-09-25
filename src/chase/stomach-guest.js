import * as T from 'three';
import {box,cylinder,tube,sphere,mergeStatic} from './vehicle-geometry.js';
import {DEFEAT} from './defeat.js';

function painted(draw){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;draw(canvas.getContext('2d'));
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}
function cloth(profile){
 const vertices=[],uv=[],indices=[],segments=32;
 for(let j=0;j<profile.length;j++)for(let i=0;i<=segments;i++){
  const [y,w,d]=profile[j],a=i/segments*Math.PI*2,fold=1+.035*Math.sin(a*9+j*1.7);
  vertices.push(Math.sin(a)*w*fold,y+(j===0?.014*Math.sin(a*13):0),Math.cos(a)*d*fold);uv.push(i/segments,j/(profile.length-1));
 }
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function mesh(parent,geometry,material,position=[0,0,0]){const m=new T.Mesh(geometry,material);m.position.set(...position);parent.add(m);return m;}
function strand(parent,material,points,radius=.007){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,radius,6,false),material);}
function sleeve(parent,material,points){
 const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),g=new T.TubeGeometry(curve,16,.082,16,false),p=g.attributes.position,uv=g.attributes.uv,center=new T.Vector3(),v=new T.Vector3();
 for(let i=0;i<=16;i++){const u=i/16;curve.getPointAt(u,center);for(let j=0;j<=16;j++){const n=i*17+j;v.fromBufferAttribute(p,n).sub(center).multiplyScalar(1-u*.23).add(center);p.setXYZ(n,v.x,v.y,v.z);uv.setXY(n,j/16*.65,u);}}
 g.computeVertexNormals();return mesh(parent,g,material);
}
function exposeSkull(geometry){
 const p=geometry.attributes.position,index=geometry.index.array,skin=[],bone=[],border=[],edgeMap=new Map();
 for(let i=0;i<index.length;i+=3){
  const tri=[index[i],index[i+1],index[i+2]],center=new T.Vector3();for(const n of tri)center.add(new T.Vector3().fromBufferAttribute(p,n));center.multiplyScalar(1/3);
  const x=(center.x+.073)/.088,y=(center.y-.100)/.103,edge=1+.10*Math.sin(center.x*110+center.y*91);
  const exposed=center.z<-.012&&center.y>.036&&x*x+y*y<edge;
  const wornEdge=center.z<-.008&&center.y>.027&&x*x+y*y<edge*1.23;
  (exposed?bone:wornEdge?border:skin).push(...tri);
  if(exposed)for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;if(edgeMap.has(key))edgeMap.delete(key);else edgeMap.set(key,[a,b]);}
 }
 const skull=geometry.clone(),borderGeo=geometry.clone(),bonePositions=skull.attributes.position;borderGeo.setIndex(border);
 for(let i=0;i<bonePositions.count;i++){bonePositions.setXYZ(i,p.getX(i)*.968,p.getY(i)*.968,p.getZ(i)*.968);}
 skull.setIndex(bone);skull.computeVertexNormals();geometry.setIndex(skin);geometry.computeVertexNormals();
 const rim=[];
 for(const [a,b]of edgeMap.values())for(const [n,depth]of [[a,1],[b,1],[a,.968],[b,1],[b,.968],[a,.968]])rim.push(p.getX(n)*depth,p.getY(n)*depth,p.getZ(n)*depth);
 const margin=new T.BufferGeometry();margin.setAttribute('position',new T.Float32BufferAttribute(rim,3));margin.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(rim.length/3*2),2));margin.computeVertexNormals();
 return{skull,margin,border:borderGeo};
}

// Digestion, painted per fragment from the surface's own (group-local)
// position: macerated, marbled skin → blisters → sloughing skin → raw flesh →
// muscle → eaten through. Soaked parts near the acid are furthest gone. Holes
// discard, and the far side of a hole renders as the dark flesh inside, so
// torn cloth and skin open onto the body beneath. `wounds` pins extra damage
// to places (head-local mouth, cheek, eye).
const DIGEST_GLSL=`
 float dh(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float dn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(dh(i),dh(i+vec3(1,0,0)),f.x),mix(dh(i+vec3(0,1,0)),dh(i+vec3(1,1,0)),f.x),f.y),mix(mix(dh(i+vec3(0,0,1)),dh(i+vec3(1,0,1)),f.x),mix(dh(i+vec3(0,1,1)),dh(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float df(vec3 p){return dn(p)*.5+dn(p*2.1+3.)*.3+dn(p*4.3+7.)*.2;}`;
function digest(material,{bias=0,cloth=false,holes=.93,wounds=[],acid}){
 material.side=T.DoubleSide;
 const W=wounds.length,previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey?.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous?.call(material,shader,renderer);
  shader.uniforms.digestAcid=acid;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vDig,vDigWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvDig=position;').replace('#include <project_vertex>','#include <project_vertex>\nvDigWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vDig,vDigWorld;uniform float digestAcid;float digH,digStage;
   ${DIGEST_GLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
   {
    vec3 p=vDig*9.;float n=df(p),grain=dn(p*6.);
    float soak=1.-smoothstep(-.1,.7,vDigWorld.y-digestAcid);
    float d=clamp(n*.95+${bias.toFixed(3)}+soak*.3,0.,1.);
    ${wounds.map(([x,y,z,r,k])=>`d=max(d,${k.toFixed(3)}*(1.-smoothstep(${(r*.4).toFixed(3)},${r.toFixed(3)},length(vDig-vec3(${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}))+(n-.5)*${(r*.9).toFixed(3)}+(dn(p*14.)-.5)*${(r*.35).toFixed(3)})));`).join('\n')}
    digStage=d;
    if(d>${holes.toFixed(3)})discard;
    vec3 c=diffuseColor.rgb;
    ${cloth?`
    // Cloth: bile-stained, bleached thin, then gone, fraying at the edges.
    c=mix(c,c*vec3(.72,.66,.4)+vec3(.05,.04,0.),smoothstep(.2,.55,d));
    c=mix(c,vec3(.36,.33,.2)*(.8+.4*grain),smoothstep(.55,.75,d)*.7);
    c=mix(c,vec3(.18,.12,.05),smoothstep(.84,.92,d));
    digH=-smoothstep(.8,.93,d);`:`
    // Skin: waterlogged grey-green with dark marbling and purple lividity.
    vec3 macerated=mix(vec3(.44,.43,.33),vec3(.33,.36,.26),grain)*(.8+.35*dn(p*1.7));
    float marble=pow(1.-abs(dn(p*2.2)*2.-1.),10.);macerated=mix(macerated,vec3(.14,.2,.12),marble*.7);
    macerated=mix(macerated,vec3(.33,.2,.28),smoothstep(.55,.75,dn(p*.8+4.))*.5);
    // Blisters: taut, yellow, translucent domes.
    float cell=dn(p*4.5+2.),blister=smoothstep(.35,.45,d)*(1.-smoothstep(.5,.56,d))*smoothstep(.55,.72,cell);
    // Sloughing: skin peels in sheets off the raw dermis beneath.
    float slough=smoothstep(.44,.5,d),flesh=smoothstep(.6,.66,d),muscle=smoothstep(.76,.8,d);
    vec3 dermis=vec3(.62,.24,.2),raw=vec3(.42,.05,.045),fiber=mix(vec3(.28,.02,.025),vec3(.46,.07,.06),.5+.5*sin(vDig.y*260.+n*9.));
    c=macerated;c=mix(c,vec3(.78,.68,.36),blister*.85);c=mix(c,dermis,slough);c=mix(c,raw,flesh);c=mix(c,fiber,muscle);
    c=mix(c,vec3(.12,.02,.02),smoothstep(.86,.92,d));
    // A blackened crust rims every hole.
    c=mix(c,vec3(.07,.03,.02),smoothstep(.83,.88,d)*(1.-smoothstep(.9,.93,d))*.8);
    // Peeled edges curl pale.
    c=mix(c,vec3(.8,.76,.64),smoothstep(.02,0.,abs(d-.47))*.8);
    digH=blister*.8+smoothstep(.02,0.,abs(d-.47))*.5-flesh*.4-smoothstep(.84,.93,d)*.8;`}
    // The far side of a hole is the dark flesh inside.
    if(!gl_FrontFacing){c=mix(vec3(.16,.02,.02),vec3(.3,.05,.04),grain);digH=0.;}
    diffuseColor.rgb=c;
   }`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=${cloth?'mix(roughnessFactor,.35,smoothstep(.5,.9,digStage))':'mix(mix(.74,.24,smoothstep(.35,.5,digStage)),.3,smoothstep(.6,.7,digStage))'};`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   {vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
    vec2 g=vec2(dFdx(digH),dFdy(digH))*.012;normal=normalize(abs(det)*normal-sign(det)*(g.x*r1+g.y*r2));}`);
 };
 material.customProgramCacheKey=()=>`digest-v1-${cloth}-${bias}-${holes}-${W}-${wounds.flat().join(',')}-${previousKey?previousKey():''}`;
 return material;
}

/** Gennaro, the lawyer, days into being digested: slumped waist-deep in the
 * acid against the stomach wall. All movement follows defeat time. */
export function createStomachGuest(scene,stomach){
 const root=new T.Group();root.name='stomach-lawyer-reveal';root.visible=false;scene.add(root);
 let seed=19930611;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const stained=painted(c=>{
  c.fillStyle='#6a7b86';c.fillRect(0,0,512,512);
  for(let x=0;x<512;x+=12){c.fillStyle='#c7ceca';c.fillRect(x,0,3,512);c.fillStyle='#3d4e59';c.fillRect(x+5,0,1,512);}
  for(let i=0;i<140;i++){const x=rand()*512,y=rand()*512,r=5+rand()*50,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3?'#51573450':i%2?'#44352e75':'#5a120e70');g.addColorStop(1,'#25291800');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  for(let i=0;i<1800;i++){c.fillStyle=i%2?'#f3e5c212':'#17241618';c.fillRect(rand()*512,rand()*512,1,3);}
 });
 const tieMap=painted(c=>{
  c.fillStyle='#242626';c.fillRect(0,0,512,512);
  for(let y=12;y<512;y+=62)for(let x=12;x<512;x+=75){const px=x+(y%124?28:0);c.strokeStyle='#776b504e';c.lineWidth=4;c.strokeRect(px,y,20,27);c.fillStyle='#92826660';c.fillRect(px+7,y+8,6,10);}
 });
 const acid={value:stomach.acidLevel};
 const absorb=m=>stomach.absorb(m);
 const mat=(color,extra={})=>absorb(new T.MeshStandardMaterial({color,roughness:.67,...extra}));
 // Head wounds, head-local: the lipless mouth, an eaten-through cheek, the
 // empty right socket and the ruined nose.
 const headWounds=[[0,-.035,-.13,.024,1],[-.034,-.099,-.112,.026,1],[0,-.101,-.118,.028,1],[.034,-.099,-.112,.026,1],[-.082,-.088,-.088,.036,1],[.05,.024,-.095,.026,1],[-.05,.024,-.095,.03,.8],[.095,-.1,-.08,.045,.68]];
 const m={
  shirt:digest(mat(0xd5d9d4,{map:stained,bumpMap:stained,bumpScale:.001}),{bias:-.05,cloth:true,holes:.86,acid}),
  cuff:mat(0xaeb9b8),
  skin:digest(mat(0xb8ae92,{roughness:.55}),{bias:.02,holes:.95,acid}),
  face:digest(mat(0xb8ae92,{roughness:.55}),{bias:-.24,holes:.9,wounds:headWounds,acid}),
  shade:mat(0x5d5947),bruise:mat(0x514349),hair:mat(0x37342b),
  shorts:digest(mat(0x4c4d43),{bias:.05,cloth:true,holes:.84,acid}),
  tie:mat(0xffffff,{map:tieMap,roughness:.76,side:T.DoubleSide}),leather:mat(0x302b20),sock:mat(0x484b3c),button:mat(0x969d97),metal:mat(0x817763,{metalness:.5,roughness:.45}),
  slime:mat(0x8a8450,{roughness:.1,transparent:true,opacity:.55}),bone:mat(0xd9cca6,{roughness:.55}),tooth:mat(0xc9b889,{roughness:.4}),toothDark:mat(0x7d6a44,{roughness:.45}),gum:mat(0x5e1712,{roughness:.3}),
  eye:mat(0xa9aa98,{roughness:.32}),iris:mat(0x6e7266,{roughness:.4,transparent:true,opacity:.5}),socket:mat(0x0c0302,{roughness:.95}),flesh:mat(0x5a0f0c,{roughness:.28})
 };

 // Slumped back and sideways into the wall, waist-deep, one arm hooked over a
 // fold of the stomach lining, the other lost in the acid.
 const guest=new T.Group();guest.name='gennaro';root.add(guest);
 const c=stomach.center;guest.position.set(c.x+.95,stomach.acidLevel-.9,c.z-1.2);guest.scale.setScalar(1.35);guest.rotation.y=.6;
 sphere(guest,m.shorts,.20,[0,.55,.015],[1.05,.62,.85]);
 const body=new T.Group();body.position.set(0,.57,0);body.rotation.set(.34,0,-.26);guest.add(body);
 mesh(body,cloth([[0,.18,.13],[.15,.19,.14],[.36,.23,.13],[.49,.21,.12],[.54,.12,.08]]),m.shirt);
 cylinder(body,m.skin,.062,.073,.14,[0,.56,0],[0,0,0]);
 // Right arm (+x) hooked up over a fold, ending in a hand digested to bone;
 // left arm hanging into the acid.
 const arms={1:[[.198,.437,0],[.3,.26,-.14],[.36,.1,-.3],[.4,.02,-.44]],[-1]:[[-.198,.437,0],[-.3,.12,-.08],[-.36,-.14,-.12],[-.38,-.3,-.13]]};
 for(const s of [-1,1]){
  const path=arms[s];sleeve(body,m.shirt,path);const wrist=path[3];
  tube(body,m.cuff,[wrist[0]-.01*s,wrist[1]+.02,wrist[2]],[wrist[0]+.01*s,wrist[1]-.05,wrist[2]-.02],.066);
  if(s>0){
   // Stripped hand: a stump of raw wrist, then metacarpals and finger bones
   // draped over the fold, knuckles and all.
   sphere(body,m.flesh,.045,[wrist[0]+.03,wrist[1]-.01,wrist[2]],[1.2,.8,.9]);
   for(let i=0;i<5;i++){
    const spread=(i-2)*.024,base=[wrist[0]+.05,wrist[1]-.01+spread*.4,wrist[2]+spread],k=[base[0]+.075,base[1]-.03,base[2]+spread*.6];
    tube(body,m.bone,base,k,.006);sphere(body,m.bone,.009,k);
    const tip1=[k[0]+.035,k[1]-.045,k[2]+spread*.2],tip2=[tip1[0]+.01,tip1[1]-.04,tip1[2]];
    if(i){tube(body,m.bone,k,tip1,.0048);sphere(body,m.bone,.007,tip1);tube(body,m.bone,tip1,tip2,.004);}
    else tube(body,m.bone,k,[k[0]+.01,k[1]-.05,k[2]-.03],.005);
   }
   // Rags of tendon still strung between the bones.
   for(let i=0;i<3;i++)strand(body,m.flesh,[[wrist[0]+.04,wrist[1],wrist[2]+(i-1)*.02],[wrist[0]+.09,wrist[1]-.04,wrist[2]+(i-1)*.025],[wrist[0]+.1,wrist[1]-.09,wrist[2]+(i-1)*.02]],.0035);
  }else{
   // A swollen, sloughing hand, mostly under.
   sphere(body,m.skin,.062,[wrist[0],wrist[1]-.07,wrist[2]-.02],[.85,1.2,.7]);
   for(let i=0;i<4;i++)strand(body,m.skin,[[wrist[0]+(i-1.5)*.02,wrist[1]-.1,wrist[2]-.03],[wrist[0]+(i-1.5)*.021,wrist[1]-.17,wrist[2]-.05],[wrist[0]+(i-1.5)*.02,wrist[1]-.2,wrist[2]-.02]],.011);
  }
  // Frayed strips at the cuffs.
  for(let i=0;i<3;i++)box(body,m.cuff,[.01,.05+rand()*.03,.007],[wrist[0]+(i-1)*.03*s,wrist[1]-.04,wrist[2]-.02],[.2,0,s*.3]);
  tube(guest,m.shorts,[s*.12,.59,0],[s*.19,.54,-.24],.112);
  tube(guest,m.skin,[s*.19,.54,-.24],[s*.23,.5,-.43],.083);
  sphere(guest,m.skin,.082,[s*.23,.5,-.43]);
  tube(guest,m.skin,[s*.23,.49,-.43],[s*.25,.18,-.49],.058);
  tube(guest,m.sock,[s*.25,.24,-.49],[s*.255,.055,-.55],.06);
  sphere(guest,m.leather,.11,[s*.255,.05,-.61],[.78,.5,1.55]);
 }
 for(let i=0;i<5;i++)sphere(body,m.button,.007,[0,.11+i*.07,-.146],[1,1,.3]);
 box(body,m.leather,[.34,.04,.26],[0,.018,0]);box(body,m.metal,[.045,.029,.012],[.01,.018,-.142]);
 const tie=new T.Group();tie.position.set(.005,.48,-.17);tie.rotation.z=-.08;body.add(tie);
 sphere(tie,m.tie,.037,[0,0,0],[.65,1,.5]);
 const tieShape=new T.Shape();tieShape.moveTo(-.018,-.025);tieShape.lineTo(-.046,-.47);tieShape.lineTo(.003,-.535);tieShape.lineTo(.050,-.47);tieShape.lineTo(.018,-.025);
 const tieGeo=new T.ShapeGeometry(tieShape),tieUv=tieGeo.attributes.uv,tiePos=tieGeo.attributes.position;
 for(let i=0;i<tieUv.count;i++)tieUv.setXY(i,(tiePos.getX(i)+.05)/.1,(tiePos.getY(i)+.54)/.54);
 mesh(tie,tieGeo,m.tie).rotation.y=Math.PI;

 // The head lolls on his shoulder.
 const head=new T.Group();head.position.set(.008,.68,-.055);head.rotation.set(.32,-.1,-.5);body.add(head);
 const faceGeo=new T.SphereGeometry(.155,64,52),p=faceGeo.attributes.position;
 for(let i=0;i<p.count;i++){
  let x=p.getX(i)*.90,y=p.getY(i)*1.20,z=p.getZ(i)*.85;
  x*=1+.07*Math.exp(-Math.pow((y+.10)/.035,2));
  if(z<0){
   const front=Math.pow(-z/Math.max(.001,Math.hypot(x,z)),4),nose=.018*Math.exp(-Math.pow(x/.022,2)-Math.pow((y+.02)/.045,2)),bridge=.012*Math.exp(-Math.pow(x/.021,2)-Math.pow((y-.026)/.075,2))+.016*Math.exp(-Math.pow((Math.abs(x)-.05)/.04,2)-Math.pow((y-.062)/.014,2));
   const cheek=.02*Math.exp(-Math.pow((Math.abs(x)-.082)/.022,2)-Math.pow((y+.02)/.022,2)),hollow=.048*Math.exp(-Math.pow((Math.abs(x)-.07)/.035,2)-Math.pow((y+.08)/.035,2)),socket=.05*Math.exp(-Math.pow((Math.abs(x)-.05)/.026,2)-Math.pow((y-.024)/.022,2));
   const chin=.017*Math.exp(-Math.pow(x/.060,2)-Math.pow((y+.13)/.031,2)),furrow=.002*Math.sin(y*235)*Math.exp(-Math.pow((y-.104)/.039,2));
   z-=(nose+bridge+cheek+chin-hollow-socket+furrow)*front;
  }
  p.setXYZ(i,x,y,z);
 }
 faceGeo.computeVertexNormals();const exposed=exposeSkull(faceGeo);
 const face=new T.Group();face.position.y=.075;head.add(face);
 mesh(face,faceGeo,m.face);
 const boneMap=painted(c=>{c.fillStyle='#e4d7b6';c.fillRect(0,0,512,512);for(let i=0;i<900;i++){c.fillStyle=i%3?'#887b6030':'#e4dec32a';c.fillRect(rand()*512,rand()*512,1+rand()*4,1+rand()*4);}});
 mesh(face,exposed.skull,absorb(new T.MeshStandardMaterial({color:0xffffff,map:boneMap,bumpMap:boneMap,bumpScale:.0008,roughness:.73})));
 const woundEdge=mat(0x51302a,{side:T.DoubleSide,roughness:.4});
 mesh(face,exposed.margin,woundEdge);mesh(face,exposed.border,woundEdge);
 // Inside the head: the dark cavity, and the teeth that show through the lipless
 // mouth and the hole in the cheek.
 sphere(face,m.socket,.13,[0,0,.01],[.8,1.05,.72]);
 const teeth=(cx,cy,cz,count,span,up)=>{for(let i=0;i<count;i++){if(rand()<.14)continue;const a=(i/(count-1)-.5)*span,x=cx+Math.sin(a)*.068,z=cz+(1-Math.cos(a))*.068,h=.02+rand()*.012;box(face,rand()<.35?m.toothDark:m.tooth,[.011+rand()*.003,h,.01],[x,cy+(up?1:-1)*h*.45,z],[(rand()-.5)*.25,a,(rand()-.5)*.25]);}box(face,m.gum,[.1,.01,.03],[cx,cy+(up?.026:-.026),cz+.02]);};
 teeth(0,-.093,-.104,10,1.5,true);teeth(0,-.109,-.101,10,1.4,false);
 // One eye milky and bulging with rot; the other socket is empty.
 sphere(face,m.eye,.023,[-.05,.022,-.088],[1,.9,.9]);sphere(face,m.iris,.011,[-.047,.02,-.108],[1,1,.35]);
 sphere(face,m.socket,.026,[.05,.024,-.07],[1,1,.8]);
 for(const s of [-1,1]){
  sphere(face,m.face,.042,[s*.137,-.01,.006],[.35,1,.7]);
 }
 // A close scalp, patchy where the hair has sloughed away.
 const hairGeo=new T.PlaneGeometry(1,1,36,10),hp=hairGeo.attributes.position,huv=hairGeo.attributes.uv;
 for(let i=0;i<hp.count;i++){const a=(huv.getX(i)-.5)*4.15,top=.52+Math.pow(Math.abs(a)/2.075,3)*.56,theta=T.MathUtils.lerp(top,1.84,huv.getY(i));hp.setXYZ(i,.141*Math.sin(theta)*Math.sin(a),.188*Math.cos(theta),.134*Math.sin(theta)*Math.cos(a));}
 hairGeo.computeVertexNormals();mesh(face,hairGeo,digest(absorb(new T.MeshStandardMaterial({color:0x302e24,roughness:.9})),{bias:-.28,cloth:true,holes:.82,acid}));
 // Slime threads from the ruined mouth down to the chest.
 strand(face,m.slime,[[.02,-.12,-.11],[.03,-.2,-.12],[.05,-.3,-.09]],.0022);strand(face,m.slime,[[-.03,-.118,-.11],[-.045,-.23,-.1]],.0018);
 for(const group of [guest,body,tie])mergeStatic(group);mergeStatic(face);

 // A skin of froth and fizz where he sits in the acid.
 const fizz=new T.InstancedMesh(new T.SphereGeometry(1,10,6),absorb(new T.MeshStandardMaterial({color:0xb5b27a,roughness:.1,transparent:true,opacity:.8})),60);fizz.frustumCulled=false;root.add(fizz);
 const fizzData=Array.from({length:60},()=>({a:rand()*6.283,r:.28+rand()*.35,phase:rand(),size:.008+rand()*.022}));
 const dummy=new T.Object3D(),focus=new T.Vector3();
 let reveal=0;
 function reset(){root.visible=false;reveal=0;}
 function update(t,camera,reducedMotion){
  reveal=T.MathUtils.smoothstep(t,DEFEAT.bellyAt-.8,DEFEAT.bellyAt+.35)*(1-T.MathUtils.smoothstep(t,DEFEAT.acidAt+.2,DEFEAT.black));
  root.visible=reveal>0;
  const clock=t-DEFEAT.slideAt,motion=reducedMotion?.25:1,churn=Math.sin(clock*1.7)*motion;
  // Rolled by the churn; his head slowly lolls round toward the newcomer.
  guest.position.y=stomach.acidLevel-.9+Math.sin(clock*2.1)*.02*motion;guest.rotation.z=churn*.02;
  body.rotation.z=-.26+churn*.015;
  const turn=T.MathUtils.smoothstep(t,DEFEAT.bellyAt,DEFEAT.plungeAt+.2)*motion;
  head.rotation.set(.32-.12*turn+Math.sin(clock*1.3)*.02*motion,-.1+.35*turn,-.5+.28*turn+Math.sin(clock*1.6-.5)*.03*motion);
  tie.rotation.x=.18+Math.sin(clock*1.9)*.07*motion;
  head.getWorldPosition(focus);
  if(!root.visible)return;
  for(let i=0;i<fizzData.length;i++){const f=fizzData[i],u=(clock*(reducedMotion?.3:1.2)+f.phase)%1,s=f.size*Math.sin(Math.PI*u);
   dummy.position.set(guest.position.x+Math.cos(f.a)*f.r,stomach.acidLevel+.005,guest.position.z+Math.sin(f.a)*f.r*.8);dummy.scale.set(s,s*.7,s);dummy.updateMatrix();fizz.setMatrixAt(i,dummy.matrix);}
  fizz.instanceMatrix.needsUpdate=true;
 }
 // Froth gathers around him on the acid.
 stomach.froth[3].set(guest.position.x,guest.position.z,1.1,1);
 reset();update(DEFEAT.bellyAt,null,false);root.visible=false;
 return{root,guest,head,tie,pool:stomach.pool,update,reset,get reveal(){return reveal;},get focus(){return focus;}};
}
