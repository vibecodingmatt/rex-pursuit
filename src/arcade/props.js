import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shootable props as objects rather than primitives: a bevelled plank supply crate with a
// stencilled medical cross, a rolled-hoop steel drum with a hazard band, and a glossy,
// stretching spit blob with a trail of droplets. Textures are painted once on canvases;
// geometry and materials are shared (actors.js disposes only unshared ones).

function canvas(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
function rng(seed){return()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};}

function crateTexture(){return canvas(512,512,(x,w,h)=>{const r=rng(7);
 // Painted planks: olive-teal paint worn back to grey wood at the edges and knots.
 for(let i=0;i<5;i++){const y=i*h/5;x.fillStyle=`hsl(${160+r()*8},${26+r()*8}%,${33+r()*6}%)`;x.fillRect(0,y,w,h/5);
  for(let g=0;g<26;g++){x.strokeStyle=`rgba(20,30,25,${.08+r()*.1})`;x.lineWidth=1+r()*1.5;x.beginPath();const gy=y+r()*h/5;x.moveTo(0,gy);x.bezierCurveTo(w*.3,gy+r()*6-3,w*.7,gy+r()*6-3,w,gy+r()*4-2);x.stroke();}
  x.fillStyle='rgba(12,14,10,.75)';x.fillRect(0,y,w,3);}
 for(let i=0;i<70;i++){x.fillStyle=`rgba(150,140,118,${.25+r()*.35})`;const px=r()*w,py=r()*h;x.beginPath();x.ellipse(px,py,3+r()*16,1+r()*4,0,0,Math.PI*2);x.fill();}
 // Frame boards and nails.
 x.fillStyle='rgba(30,40,32,.55)';x.fillRect(0,0,w,26);x.fillRect(0,h-26,w,26);x.fillRect(0,0,26,h);x.fillRect(w-26,0,26,h);
 x.fillStyle='#2a2a26';for(const [nx,ny]of [[13,13],[w-13,13],[13,h-13],[w-13,h-13],[w/2,13],[w/2,h-13]]){x.beginPath();x.arc(nx,ny,4,0,7);x.fill();}
 // Stencilled cross and lettering, slightly worn.
 x.fillStyle='rgba(232,236,226,.92)';x.fillRect(w/2-34,h/2-112,68,224);x.fillRect(w/2-112,h/2-34,224,68);
 x.font='bold 40px sans-serif';x.textAlign='center';x.fillText('MEDICAL',w/2,h-52);
 x.globalCompositeOperation='destination-out';for(let i=0;i<260;i++){x.fillStyle=`rgba(0,0,0,${r()*.3})`;x.fillRect(r()*w,r()*h,1+r()*5,1+r()*2);}
 x.globalCompositeOperation='destination-over';x.fillStyle='#4b5248';x.fillRect(0,0,w,h);
});}
function barrelTexture(){return canvas(512,256,(x,w,h)=>{const r=rng(11);
 x.fillStyle='#b4441c';x.fillRect(0,0,w,h);
 for(let i=0;i<900;i++){x.fillStyle=`rgba(${60+r()*40},${20+r()*20},10,${r()*.08})`;x.fillRect(r()*w,r()*h,2+r()*20,1+r()*3);}
 // Hazard band with a flame diamond on two sides.
 const band=[h*.4,h*.6];x.fillStyle='#e8b81c';x.fillRect(0,band[0],w,band[1]-band[0]);x.fillStyle='#151310';
 for(let s=-h;s<w+h;s+=34){x.beginPath();x.moveTo(s,band[1]);x.lineTo(s+17,band[1]);x.lineTo(s+17+(band[1]-band[0]),band[0]);x.lineTo(s+(band[1]-band[0]),band[0]);x.fill();}
 for(const cx of [w*.25,w*.75]){x.save();x.translate(cx,h*.5);x.rotate(Math.PI/4);x.fillStyle='#f1ede2';x.fillRect(-34,-34,68,68);x.strokeStyle='#c11';x.lineWidth=6;x.strokeRect(-30,-30,60,60);x.restore();
  x.fillStyle='#111';x.beginPath();x.moveTo(cx,h*.5-22);x.quadraticCurveTo(cx+18,h*.5,cx+10,h*.5+16);x.lineTo(cx-10,h*.5+16);x.quadraticCurveTo(cx-18,h*.5,cx,h*.5-22);x.fill();}
 // Scrapes to bare steel, rust runs from the hoops.
 for(let i=0;i<60;i++){x.strokeStyle=`rgba(175,170,160,${.3+r()*.4})`;x.lineWidth=1+r()*2;x.beginPath();const sx=r()*w,sy=r()*h;x.moveTo(sx,sy);x.lineTo(sx+r()*30-15,sy+r()*8-4);x.stroke();}
 for(let i=0;i<40;i++){const g=x.createLinearGradient(0,0,0,40);const sx=r()*w,sy=[h*.12,h*.88][i%2];g.addColorStop(0,'rgba(80,35,12,.55)');g.addColorStop(1,'rgba(80,35,12,0)');x.fillStyle=g;x.save();x.translate(sx,sy);x.fillRect(0,0,3+r()*5,20+r()*30);x.restore();}
});}
/** A 55-gallon drum: rolled rims and two rolling hoops, closed lids with a recessed centre. */
function barrelGeometry(){const R=.62,H=.8,pts=[[0,-H+.04],[R*.92,-H+.04],[R*.97,-H-.0],[R+.03,-H+.03],[R,-H+.08],[R,-.36],[R+.035,-.33],[R,-.3],[R,.3],[R+.035,.33],[R,.36],[R,H-.08],[R+.03,H-.03],[R*.97,H],[R*.92,H-.04],[0,H-.04]];
 const g=new T.LatheGeometry(pts.map(([a,b])=>new T.Vector2(a,b)),40);g.computeVertexNormals();return g;}

let kit=null;
function shared(){if(kit)return kit;
 const crate=new RoundedBoxGeometry(1.5,1.1,1.1,3,.07),barrel=barrelGeometry(),drop=new T.SphereGeometry(1,16,12);
 const crateMat=new T.MeshStandardMaterial({map:crateTexture(),roughness:.86}),barrelMat=new T.MeshStandardMaterial({map:barrelTexture(),roughness:.5,metalness:.45});
 const spitMat=new T.MeshPhysicalMaterial({color:0x94c43a,emissive:0x1a2a06,roughness:.12,clearcoat:1,clearcoatRoughness:.05,sheen:.6,sheenColor:new T.Color(0xd8ff8a)});
 // The glob wobbles like jelly: three travelling waves push the surface along its normal.
 spitMat.userData.time={value:0};spitMat.onBeforeCompile=s=>{s.uniforms.uTime=spitMat.userData.time;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*(sin(position.x*4.+uTime*13.)+sin(position.y*5.-uTime*11.)+sin(position.z*3.+uTime*9.))*.09;');};spitMat.customProgramCacheKey=()=>'arcade-spit-v1';
 for(const o of [crate,barrel,drop,crateMat,barrelMat,spitMat])o.userData.shared=true;
 return kit={crate,barrel,drop,crateMat,barrelMat,spitMat};}

/** Advance the spit wobble (one clock for every glob). */
export function tickProps(time){if(kit)kit.spitMat.userData.time.value=time%100;}
export function makeProp(kind){const k=shared(),group=new T.Group();
 if(kind==='supply')group.add(new T.Mesh(k.crate,k.crateMat));
 else if(kind==='barrel')group.add(new T.Mesh(k.barrel,k.barrelMat));
 else if(kind==='spit'){
  // The blob leads; droplets trail it, smaller and further back.
  const blob=new T.Mesh(k.drop,k.spitMat);blob.scale.setScalar(.38);blob.name='blob';group.add(blob);
  for(let i=1;i<=4;i++){const d=new T.Mesh(k.drop,k.spitMat);d.scale.setScalar(.2/i**.6);d.position.z=-.35-i*.32;d.name='drip';group.add(d);}
 }else return null;
 group.traverse(o=>{if(o.isMesh)o.castShadow=true;});return group;}
