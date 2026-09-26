import * as T from 'three';
import {box,cylinder,tube,mergeStatic,canvasDecal} from '../chase/vehicle-geometry.js';
import {BREACH} from './rules.js';
const smooth=(a,b,v)=>T.MathUtils.smoothstep(v,a,b);
export function createCompound(scene,branchMap){
 const root=new T.Group();root.name='Maintenance compound';scene.add(root);
 const fixed=new T.Group();root.add(fixed);
 const mat=(color,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const concrete=mat(0x63665e,.88),metal=mat(0x44504d,.4,.6),dark=mat(0x192728,.56,.5),yellow=mat(0xb19a48,.68),red=mat(0x7d352b,.67),white=mat(0xbab79f,.6),rubber=mat(0x111815,.92);
 const blue=new T.MeshStandardMaterial({color:0x45d8dc,emissive:0x31cfef,emissiveIntensity:3,roughness:.3});
 const amber=new T.MeshStandardMaterial({color:0xffad41,emissive:0xff7425,emissiveIntensity:3});
 const lampMat=new T.MeshStandardMaterial({color:0xe4eadf,emissive:0xcfedff,emissiveIntensity:5});
 // Concrete variation is fixed in world metres, so the yard does not look tiled.
 const floor=mat(0x3b4542,.53,.04);
 floor.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vYard;').replace('#include <begin_vertex>','#include <begin_vertex>\nvYard=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vYard;').replace('#include <color_fragment>',`#include <color_fragment>
 vec3 h=fract(vec3(floor(vYard.xz*11.).xyx)*.1031);h+=dot(h,h.yzx+33.33);float n=fract((h.x+h.y)*h.z);
 float slabs=step(.03,fract(vYard.x*.24))*step(.03,fract(vYard.z*.24));
 float wear=.5+.25*sin(vYard.x*1.17+sin(vYard.z*.72))+.25*cos(vYard.z*1.3);
 diffuseColor.rgb*=mix(.72,1.05,n)*mix(.55,1.,slabs)*mix(.68,1.,wear);`);};floor.customProgramCacheKey=()=> 'breach-concrete-v1';
 const ground=new T.Mesh(new T.PlaneGeometry(180,230),floor);ground.rotation.x=-Math.PI/2;ground.position.set(0,-.025,22);ground.receiveShadow=true;root.add(ground);
 function sign(text,sub,size,p,bg='#243738',fg='#d3dfd7'){
  return canvasDecal(root,1024,256,(c,w,h)=>{c.fillStyle=bg;c.fillRect(0,0,w,h);c.strokeStyle='#869783';c.lineWidth=9;c.strokeRect(10,10,w-20,h-20);c.fillStyle=fg;c.textAlign='center';c.font='bold 88px sans-serif';c.fillText(text,w/2,119);c.font='35px sans-serif';c.fillStyle='#b5c6bd';c.fillText(sub,w/2,191);},size,p,[0,Math.PI,0]);
 }
 const wireCanvas=document.createElement('canvas');wireCanvas.width=wireCanvas.height=128;const wc=wireCanvas.getContext('2d');wc.strokeStyle='#a1afaa';wc.lineWidth=4;
 for(let i=-128;i<256;i+=32){wc.beginPath();wc.moveTo(i,0);wc.lineTo(i+128,128);wc.stroke();wc.beginPath();wc.moveTo(i,0);wc.lineTo(i-128,128);wc.stroke();}
 const wire=new T.CanvasTexture(wireCanvas);wire.colorSpace=T.SRGBColorSpace;wire.wrapS=wire.wrapT=T.RepeatWrapping;wire.repeat.set(4,2);
 const meshMat=new T.MeshStandardMaterial({map:wire,alphaTest:.35,side:T.DoubleSide,color:0x708783,roughness:.6,metalness:.6});
 function panel(parent,x,z,width=7,height=5.8,yaw=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=yaw;parent.add(g);
  for(const s of [-1,1]){box(g,metal,[.16,height+.6,.16],[s*width/2,(height+.6)/2,0]);tube(g,metal,[s*width/2,height,0],[s*width/2,height+.6,-.5],.035);}
  for(const y of [.4,height])box(g,metal,[width,.11,.12],[0,y,0]);
  const face=new T.Mesh(new T.PlaneGeometry(width,height-.5),meshMat);face.position.y=height/2+.15;g.add(face);
  for(const y of [height+.2,height+.5])tube(g,metal,[-width/2,y,-.3],[width/2,y,-.3],.012);
  mergeStatic(g);return g;
 }
 for(const side of [-1,1]){
  for(let z=0;z<=35;z+=7)panel(fixed,side*16,z,7,5.8,Math.PI/2);
  panel(fixed,side*11,35,12,7.5);box(fixed,concrete,[1.1,8.3,1.3],[side*5.6,4.15,35]);
  // Floodlight masts and real pools of light on the yard.
  for(const z of [9,28]){box(fixed,metal,[.22,8.6,.22],[side*10,4.3,z]);box(fixed,dark,[1.5,.55,.35],[side*10,8.4,z],[.28,0,0]);box(fixed,lampMat,[1.32,.36,.05],[side*10,8.39,z-.21],[.28,0,0]);}
  // Jersey barriers frame two flanking approaches without covering targets.
  for(const z of [16,24]){box(fixed,concrete,[3.8,1,.8],[side*7.5,.5,z],[0,side*.15,0]);box(fixed,yellow,[3.5,.13,.84],[side*7.5,.79,z],[0,side*.15,0]);}
  for(const z of [4,12,20,28])box(fixed,yellow,[.12,.012,3.5],[side*3.8,.001,z]);
  const plinth=box(fixed,concrete,[1.35,.3,1.4],[side*3.2,.15,12]);
  box(fixed,dark,[.95,1.6,.75],[side*3.2,1.02,12]);box(fixed,metal,[1.12,.14,.88],[side*3.2,1.89,12]);
  cylinder(fixed,metal,.12,.12,.55,[side*3.2,2.2,12],[0,0,0],10);
  for(let i=0;i<4;i++)cylinder(fixed,rubber,.23,.23,.07,[side*3.2,2.0+i*.11,12],[0,0,0],10);
  for(let i=0;i<5;i++)box(fixed,metal,[.68,.035,.05],[side*3.2,.7+i*.13,11.60]);
  sign('GRID '+(side<0?'A':'B'),'SHOOT TO DISCHARGE',[1.8,.45],[side*3.2,2.85,11.57],'#16343b','#76f4f0');
  tube(fixed,dark,[side*3.2,.04,12],[side*7,.04,12],.04);tube(fixed,dark,[side*7,.04,12],[side*7,.04,26],.04);
  void plinth;
 }
 const switches=[-1,1].map(side=>{const sw=box(root,blue,[.63,.43,.11],[side*3.2,1.48,11.55]);sw.name='Electrical discharge switch';return sw;});
 const mainGate=[panel(root,-2.7,35,5.4,7.5),panel(root,2.7,35,5.4,7.5)];
 box(fixed,dark,[13.3,.8,1.1],[0,8.25,35]);sign('PADDOCK 07','DANGER  /  HIGH VOLTAGE',[10.6,2.1],[0,7.7,34.39],'#303c36','#e3c477');
 sign('RESTRICTED','MAINTENANCE ACCESS',[3.3,.8],[-10,2.3,23.7]);
 // Security booth, stairs, service shed and stacked utility crates.
 box(fixed,concrete,[4.7,3.8,5],[-12,1.9,18]);box(fixed,dark,[5.2,.22,5.5],[-12,3.9,18]);
 const glass=new T.MeshStandardMaterial({color:0x345964,roughness:.14,metalness:.5});
 for(const x of [-13.2,-11]){box(fixed,glass,[1.6,1.25,.04],[x,2.65,15.47]);box(fixed,metal,[1.85,.1,.14],[x,1.96,15.42]);}
 box(fixed,metal,[1.1,2.25,.05],[-12,.0+1.125,15.4]);sign('SECURITY','NO UNAUTHORISED ENTRY',[3.4,.8],[-12,3.6,15.38]);
 box(fixed,red,[4.4,3.7,8],[12,1.85,24]);box(fixed,dark,[4.6,.2,8.2],[12,3.8,24]);
 for(let z=20.2;z<28;z+=.4)box(fixed,metal,[.055,3.5,.1],[9.77,1.8,z]);
 for(const [x,z]of [[-11,7],[11,8],[10,15],[-10,29]]){box(fixed,metal,[2.1,1.4,1.7],[x,.7,z]);for(const y of [.15,1.25])box(fixed,dark,[2.2,.08,1.8],[x,y,z]);}
 for(const s of [-1,1]){box(fixed,concrete,[.8,5,.8],[s*4.7,2.5,-9]);box(fixed,amber,[.18,.27,.18],[s*4.7,5.2,-9]);}
 const exit=[panel(root,-2.3,-9,4.6,4),panel(root,2.3,-9,4.6,4)];
 const escapeSign=sign('SERVICE EXIT','AUTOMATIC GATE  /  STAND CLEAR',[7.4,1.1],[0,5.1,-9.2]);escapeSign.rotation.y=0;
 box(fixed,dark,[10,.4,.6],[0,5,-9]);
 // Static forest silhouettes use the existing leaf atlas, with bounded instancing.
 const trunkMat=mat(0x25302a,.95),leafMat=new T.MeshStandardMaterial({map:branchMap,alphaTest:.43,side:T.DoubleSide,color:0x223b2e,roughness:.94});
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.19,.48,18,7),trunkMat,76),leaves=new T.InstancedMesh(new T.PlaneGeometry(9,8),leafMat,304),dummy=new T.Object3D();let seed=7791;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<76;i++){const x=i<42?(i%2?-1:1)*(19+random()*27):(random()-.5)*90,z=i<42?-15+random()*90:47+random()*35,h=.75+random()*.85;
  dummy.position.set(x,9*h,z);dummy.rotation.set(0,random()*6.28,(random()-.5)*.11);dummy.scale.set(1,h,1);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);
  for(let j=0;j<4;j++){dummy.position.set(x+(random()-.5)*8,14*h+random()*5,z+(random()-.5)*8);dummy.rotation.set(-.2-random()*1.2,random()*6.28,random()*.5);dummy.scale.setScalar(.8+random()*.7);dummy.updateMatrix();leaves.setMatrixAt(i*4+j,dummy.matrix);}}
 root.add(trunks,leaves);mergeStatic(fixed);
 const floodlights=[-1,1].map(side=>{const l=new T.SpotLight(side<0?0xc9e2e8:0xd9dfbd,1500,58,.63,.62,1.4);l.position.set(side*10,8.5,23);l.target.position.set(side*1.8,0,10);root.add(l,l.target);return l;});
 const beacons=[-1,1].map(side=>{const l=new T.PointLight(0xff531d,16,14,1.7);l.position.set(side*5.6,6.7,34);root.add(l);box(fixed,amber,[.28,.4,.28],[side*5.6,6.7,34]);return l;});
 const dischargeLight=new T.PointLight(0x7eeaff,0,23,1);dischargeLight.position.set(0,2,13);root.add(dischargeLight);
 const arcPositions=new Float32Array(288*3),arcGeo=new T.BufferGeometry();arcGeo.setAttribute('position',new T.BufferAttribute(arcPositions,3));
 const arcMat=new T.LineBasicMaterial({color:new T.Color(2,5,7),transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});const arcs=new T.LineSegments(arcGeo,arcMat);arcs.frustumCulled=false;arcs.visible=false;root.add(arcs);
 let arcTime=0,quality=1;
 return {root,switches,floodlights,mainGate,exit,
  setQuality(t){quality=t.detail?1:.5;leaves.count=Math.round(304*Math.min(1,t.flora??1));},
  reset(){root.position.z=0;arcTime=0;arcs.visible=false;mainGate.forEach(g=>g.rotation.x=0);exit.forEach((g,i)=>g.position.x=(i?1:-1)*2.3);},
  discharge(){arcTime=.7;},
  update(dt,round,reduced=false){
   arcTime=Math.max(0,arcTime-dt);const t=round.time,blackout=t>=BREACH.reveal&&t<BREACH.reveal+2.5;
   const emergency=t>=BREACH.reveal;floodlights.forEach(l=>l.intensity=blackout?0:emergency?110:230);lampMat.emissiveIntensity=blackout?.1:emergency?1.2:2.6;
   beacons.forEach((l,i)=>l.intensity=emergency?10+8*(.5+.5*Math.sin(t*3+i*Math.PI)):3);amber.emissiveIntensity=emergency?3:1;
   blue.emissiveIntensity=round.trap>0?.15:2.6+.4*Math.sin(t*2);blue.color.setHex(round.trap>0?0x336b6d:0x45d8dc);
   mainGate.forEach((g,i)=>{const fall=smooth(BREACH.breach,BREACH.breach+1.35,t);g.rotation.x=fall*(i?-1.34:-1.48);});
   exit.forEach((g,i)=>g.position.x=(i?1:-1)*(2.3+round.gate*4.8));
   arcs.visible=arcTime>0;dischargeLight.intensity=arcTime>0?(reduced?25:90)*Math.min(1,arcTime*4):0;
   if(arcTime>0&&dt>0){let at=0;for(let strand=0;strand<6;strand++){let prior=new T.Vector3(-7,1+(strand%3)*.7,9+Math.floor(strand/3)*8);
     for(let j=1;j<=24;j++){const next=new T.Vector3(-7+j*14/24,1+(strand%3)*.7+(random()-.5)*.7,9+Math.floor(strand/3)*8+(random()-.5)*.55);prior.toArray(arcPositions,at);next.toArray(arcPositions,at+3);at+=6;prior=next;}}
    arcGeo.attributes.position.needsUpdate=true;arcGeo.setDrawRange(0,Math.round(288*quality));arcMat.opacity=Math.min(1,arcTime*4);}
  }
 };
}
