import * as T from 'three';
import {box,tube} from '../chase/vehicle-geometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// A9: the park's river tour launch, which carries the gun on the water stages. A lofted
// hard-chine hull in the Jeep's sand and red livery, an oiled teak foredeck with a king
// plank and margin boards, a stainless bow pulpit, cleats, a locker hatch, nav lights
// and a rope coil. Boat coordinates match the Jeep's: forward is -Z, y up, the waterline
// at y=0. The gunner stands in the forward cockpit; only the foredeck, the pulpit and
// the flare of the topsides ever enter the view.

/** The gunner's eye in boat coordinates: 3 m above the water, in the forward cockpit. */
export const BOAT_EYE=new T.Vector3(0,3,0);
/** Stem tip and transom (z), the cockpit's forward bulkhead, and the cockpit floor. */
export const BOW=-6.7,STERN=4.6,DECK_AFT=-2.7,FLOOR=1.08;
const L=STERN-BOW,smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Sheer height, half-beam at the sheer, and keel height at station z. */
export function sheer(z){const t=(z-BOW)/L;return 1.22+.32*(1-t)**2.4;}
export function halfBeam(z){const t=Math.min(1,Math.max(0,(z-BOW)/L));return 1.72*Math.sin(Math.min(1,t/.5)*Math.PI/2)**.72*(1-.07*smooth(.7,1,t))+.012;}
function keel(z){const t=(z-BOW)/L;return -.62+2.15*(1-smooth(0,.4,t))**2;}
function chine(z){const k=keel(z),s=sheer(z);return[halfBeam(z)*.8,k+(s-k)*.3];}

function canvas(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);return c;}
function rng(seed){return()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};}
/**
 * Oiled teak, laid fore and aft: 9 cm planks with black caulking, a king plank down the
 * centre and darker grain. u runs across the boat (2 m per tile), v along it (4 m).
 * The second canvas is the roughness, stretched over the foredeck: wet and glossy toward
 * the bow where the spray lands.
 */
function teakTextures(){
 const W=512,H=1024,r=rng(7);
 const color=canvas(W,H,(x,w,h)=>{
  for(let i=0;i<w;i+=23){const tone=r();x.fillStyle=`rgb(${104+tone*30|0},${78+tone*20|0},${54+tone*14|0})`;x.fillRect(i,0,23,h);
   for(let k=0;k<26;k++){x.strokeStyle=`rgba(${60+r()*30|0},${36+r()*15|0},18,${.12+r()*.2})`;x.lineWidth=.6+r()*1.4;const gx=i+2+r()*19;x.beginPath();x.moveTo(gx,0);for(let y=0;y<=h;y+=64)x.lineTo(gx+Math.sin(y*.01+k)*1.6,y);x.stroke();}
   // Butt joints, staggered plank to plank.
   for(let y=r()*300;y<h;y+=280+r()*200){x.fillStyle='#16110c';x.fillRect(i,y,23,2.2);}}
  for(let i=0;i<=w;i+=23){x.fillStyle='#120e0a';x.fillRect(i-1.5,0,3,h);}
  // Salt bloom and foot wear.
  for(let k=0;k<900;k++){x.fillStyle=`rgba(${r()<.5?220:40},${r()<.5?205:30},${r()<.5?180:20},${r()*.05})`;const s=4+r()*30;x.fillRect(r()*w,r()*h,s,s*.4);}
 });
 const rough=canvas(64,256,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgb(70,70,70)');g.addColorStop(.55,'rgb(150,150,150)');g.addColorStop(1,'rgb(190,190,190)');x.fillStyle=g;x.fillRect(0,0,w,h);
  for(let k=0;k<140;k++){x.fillStyle=`rgba(40,40,40,${r()*.35})`;x.beginPath();x.ellipse(r()*w,r()*h*.6,2+r()*8,4+r()*16,0,0,7);x.fill();}});
 const mk=(c,srgb)=>{const t=new T.CanvasTexture(c);if(srgb)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;};
 // The deck's v runs .675 (cockpit bulkhead) to 1.825 (stem); clamp the wet gradient to it.
 const roughnessMap=mk(rough,false);roughnessMap.wrapT=T.ClampToEdgeWrapping;roughnessMap.repeat.y=1/1.15;roughnessMap.offset.y=-.675/1.15;
 return{map:mk(color,true),roughnessMap};
}
/** A grid surface from (i,j) in [0,1]^2; `uv` gives its texture coordinates. */
function surface(nu,nv,at,uv){
 const p=[],t=[],idx=[],v=new T.Vector3();
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){at(i/nu,j/nv,v);p.push(v.x,v.y,v.z);const [a,b]=uv?uv(i/nu,j/nv,v):[i/nu,j/nv];t.push(a,b);if(i<nu&&j<nv){const k=j*(nu+1)+i;idx.push(k,k+nu+1,k+1,k+1,k+nu+1,k+nu+2);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(t,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const flip=g=>{const i=g.index.array;for(let k=0;k<i.length;k+=3){const a=i[k];i[k]=i[k+1];i[k+1]=a;}g.computeVertexNormals();return g;};
/** Wind the surface so its normals face `hint` on average. */
const orient=(g,hint)=>{const n=g.attributes.normal;let s=0;for(let i=0;i<n.count;i++)s+=n.getX(i)*hint[0]+n.getY(i)*hint[1]+n.getZ(i)*hint[2];return s<0?flip(g):g;};
const mirrorX=g=>{const m=g.clone();m.scale(-1,1,1);return flip(m);};
/** One mesh per material for everything under `root` (transforms baked in), so the launch costs
 *  a dozen draws in each of the main and mirror passes instead of fifty. `skip` keeps a subtree. */
function mergeByMaterial(root,skip=()=>false){
 root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert(),sets=new Map(),drop=[],m4=new T.Matrix4();
 root.traverse(o=>{if(!o.isMesh||skip(o))return;let g=o.geometry.clone().applyMatrix4(m4.multiplyMatrices(inv,o.matrixWorld));if(g.index)g=g.toNonIndexed();
  for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);
  if(!sets.has(o.material))sets.set(o.material,[]);sets.get(o.material).push([g,o.castShadow]);drop.push(o);});
 for(const o of drop){o.parent.remove(o);o.geometry.dispose();}
 for(const [material,list]of sets){const mesh=new T.Mesh(mergeGeometries(list.map(x=>x[0])),material);mesh.castShadow=list.some(x=>x[1]);mesh.receiveShadow=true;root.add(mesh);list.forEach(x=>x[0].dispose());}
}

export function createBoat(scene){
 const root=new T.Group();root.name='TourBoat';scene.add(root);
 const paint=new T.MeshPhysicalMaterial({color:0xc2b388,metalness:.08,roughness:.42,clearcoat:.6,clearcoatRoughness:.25});
 const red=new T.MeshPhysicalMaterial({color:0xb42b21,roughness:.4,clearcoat:.5,clearcoatRoughness:.3});
 const bottom=new T.MeshStandardMaterial({color:0x22352d,roughness:.8});
 const rubber=new T.MeshStandardMaterial({color:0x1d2120,roughness:.65});
 const steel=new T.MeshStandardMaterial({color:0xc9cfd0,metalness:1,roughness:.18});
 const teak=teakTextures(),deckMat=new T.MeshStandardMaterial({...teak,roughness:1,metalness:0});
 const floorMat=new T.MeshStandardMaterial({color:0x8d8a7c,roughness:.85});
 const parts=[];const add=(g,m,shadow=true,hint=[0,1,0])=>{orient(g,hint);const mesh=new T.Mesh(g,m);mesh.castShadow=shadow;mesh.receiveShadow=true;root.add(mesh);parts.push(mesh);return mesh;};
 const NV=40,zAt=v=>BOW+.02+v*(L-.02);
 // Hull: the bottom (keel to chine, antifouling below the boot top) and the flared topsides.
 const bottomG=orient(surface(6,NV,(u,v,o)=>{const z=zAt(v),[cx,cy]=chine(z),k=keel(z);o.set(cx*u**.9,k+(cy-k)*u**1.6,z);}),[1,-1,0]);
 const topG=orient(surface(8,NV,(u,v,o)=>{const z=zAt(v),[cx,cy]=chine(z),s=sheer(z);o.set(cx+(halfBeam(z)-cx)*u**.65,cy+(s-cy)*u,z);}),[1,0,0]);
 for(const g of [bottomG,mirrorX(bottomG)])add(g,bottom,false,[0,0,0]);
 for(const g of [topG,mirrorX(topG)])add(g,paint,false,[0,0,0]);
 // The red boot stripe just under the sheer, and a rubber rubbing strake along it.
 const stripe=orient(surface(1,NV,(u,v,o)=>{const z=zAt(v),[cx,cy]=chine(z),s=sheer(z),a=.78+u*.13;o.set((cx+(halfBeam(z)-cx)*a**.65)+.006,cy+(s-cy)*a,z);}),[1,0,0]);
 for(const g of [stripe,mirrorX(stripe)])add(g,red,false,[0,0,0]);
 for(const side of [-1,1]){const pts=[];for(let k=0;k<=30;k++){const z=zAt(k/30);pts.push(new T.Vector3(side*(halfBeam(z)+.02),sheer(z)-.03,z));}
  add(new T.TubeGeometry(new T.CatmullRomCurve3(pts),60,.045,6,false),rubber,false);}
 // Transom.
 add(surface(8,1,(u,v,o)=>{const z=STERN,[cx,cy]=chine(z),k=keel(z),x=(u*2-1)*cx;o.set(x,v?sheer(z):k+(cy-k)*Math.abs(x/cx)**1.6,z);}),paint,false,[0,0,1]);
 // Foredeck: cambered teak from the cockpit bulkhead to the stem, inside the strake.
 const deckY=(x,z)=>{const hb=halfBeam(z)-.03,s=x/Math.max(.05,hb);return sheer(z)+.07*(1-s*s)*Math.min(1,hb/1.2);};
 const deck=add(surface(16,30,(u,v,o)=>{const z=DECK_AFT+(BOW+.03-DECK_AFT)*v,x=(u*2-1)*(halfBeam(z)-.03);o.set(x,deckY(x,z),z);},(u,v,o)=>[o.x*.5+.5,-o.z*.25]),deckMat);deck.castShadow=false;
 // Margin boards follow the deck edge; a king plank runs down the centre.
 const trim=new T.MeshStandardMaterial({color:0x6e4524,roughness:.5});
 for(const side of [-1,1])add(surface(1,30,(u,v,o)=>{const z=DECK_AFT+(BOW+.05-DECK_AFT)*v,hb=halfBeam(z)-.03,x=side*(hb-u*Math.min(.11,hb*.45));o.set(x,deckY(x,z)+.004,z);}),trim,false);
 add(surface(1,30,(u,v,o)=>{const z=DECK_AFT+(BOW+.4-DECK_AFT)*v,x=(u-.5)*.13;o.set(x,deckY(x,z)+.005,z);}),trim,false);
 // Cockpit: side decks, the sole and the forward bulkhead the gunner braces against.
 for(const side of [-1,1])add(surface(1,12,(u,v,o)=>{const z=DECK_AFT+(STERN-.2-DECK_AFT)*v,x=side*(halfBeam(z)-.03-u*.34);o.set(x,sheer(z)+.01,z);},(u,v,o)=>[o.x*.5+.5,-o.z*.25]),deckMat);
 add(surface(6,8,(u,v,o)=>{const z=DECK_AFT+(STERN-.2-DECK_AFT)*v,x=(u*2-1)*(halfBeam(z)-.36);o.set(x,FLOOR,z);}),floorMat,false);
 add(surface(8,1,(u,v,o)=>{const z=DECK_AFT,x=(u*2-1)*(halfBeam(z)-.03);o.set(x,v?deckY(x,z):FLOOR,z+.001);}),paint,true,[0,0,1]);
 for(const side of [-1,1])add(surface(1,12,(u,v,o)=>{const z=DECK_AFT+(STERN-.2-DECK_AFT)*v,x=side*(halfBeam(z)-.37);o.set(x,FLOOR+(sheer(z)-FLOOR)*u,z);}),paint,false,[-side,0,0]);
 // Bow pulpit: one rail from the cockpit round the stem and back, on stanchions.
 const railH=.62,rail=[];for(let k=0;k<=24;k++){const a=k/24,side=a<.5?-1:1,f=1-Math.abs(a*2-1),z=DECK_AFT+.15+(BOW+.55-DECK_AFT-.15)*Math.sin(f*Math.PI/2)**1.6,hb=halfBeam(z)-.1,x=side*hb*Math.min(1,(1-f)*6+.0001)**.5;rail.push(new T.Vector3(x,deckY(x,z)+railH,z));}
 const railCurve=new T.CatmullRomCurve3(rail);const pulpit=new T.Group();root.add(pulpit);
 const railMesh=new T.Mesh(new T.TubeGeometry(railCurve,120,.022,8,false),steel);railMesh.castShadow=true;pulpit.add(railMesh);
 for(let k=1;k<12;k++){if(k===6)continue;const p=railCurve.getPoint(k/12);tube(pulpit,steel,[p.x,deckY(p.x,p.z),p.z],[p.x,p.y,p.z],.016);}
 const tip=railCurve.getPoint(.5);tube(pulpit,steel,[tip.x,deckY(0,tip.z),tip.z],[tip.x,tip.y,tip.z],.02);
 // Stem fitting, nav lights on the pulpit, cleats, the locker hatch and a coiled line.
 box(root,steel,[.09,.05,.5],[0,deckY(0,BOW+.3)+.03,BOW+.32]);
 for(const [side,color]of [[-1,0xff2010],[1,0x10ff40]]){const lamp=new T.Mesh(new T.BoxGeometry(.07,.06,.1),new T.MeshStandardMaterial({color:0x111111,emissive:color,emissiveIntensity:2.4,toneMapped:false}));lamp.position.set(tip.x+side*.06,tip.y+.02,tip.z+.08);pulpit.add(lamp);}
 const cleat=(x,z,yaw)=>{const y=deckY(x,z);const g=new T.Group();g.position.set(x,y,z);g.rotation.y=yaw;box(g,steel,[.05,.05,.06],[0,.025,-.06]);box(g,steel,[.05,.05,.06],[0,.025,.06]);box(g,steel,[.06,.03,.3],[0,.065,0]);root.add(g);};
 for(const side of [-1,1]){cleat(side*.95,BOW+3.1,side*.25);cleat(side*1.38,DECK_AFT-.35,0);}
 const hatchZ=BOW+2.5,hatch=new T.Group();hatch.position.set(0,deckY(0,hatchZ)+.012,hatchZ);root.add(hatch);
 box(hatch,trim,[.86,.03,.74],[0,0,0]);box(hatch,paint,[.78,.035,.66],[0,.012,0]);
 const label=canvas(512,512,(x,w,h)=>{x.fillStyle='#c2b388';x.fillRect(0,0,w,h);x.fillStyle='#a42a22';x.textAlign='center';x.textBaseline='middle';x.font='bold 250px Impact, Arial Black, sans-serif';x.fillText('07',w/2,h*.46);x.font='bold 54px Arial';x.fillStyle='#2a2a22';x.fillText('RIVER TOUR',w/2,h*.83);});
 const lt=new T.CanvasTexture(label);lt.colorSpace=T.SRGBColorSpace;lt.anisotropy=8;const plate=new T.Mesh(new T.PlaneGeometry(.66,.6),new T.MeshStandardMaterial({map:lt,roughness:.45}));plate.rotation.x=-Math.PI/2;plate.position.y=.032;hatch.add(plate);
 for(const side of [-1,1])box(hatch,steel,[.05,.02,.12],[side*.3,.03,.36]);
 const rope=new T.MeshStandardMaterial({color:0xb9ab86,roughness:.9});const coil=new T.Group();coil.position.set(.6,deckY(.6,BOW+3.6),BOW+3.6);root.add(coil);
 for(let k=0;k<5;k++){const ring=new T.Mesh(new T.TorusGeometry(.2-k*.012,.022,6,24),rope);ring.rotation.x=Math.PI/2;ring.position.set(Math.sin(k)*.01,.02+k*.03,Math.cos(k)*.01);ring.castShadow=true;coil.add(ring);}
 // Gun pedestal on the cockpit sole under the mount.
 const ped=new T.Mesh(new T.CylinderGeometry(.19,.26,.12,20),rubber);ped.position.set(0,FLOOR+.06,-1.5);root.add(ped);
 const underPulpit=o=>{for(let p=o;p;p=p.parent)if(p===pulpit)return true;return false;};
 mergeByMaterial(root,underPulpit);mergeByMaterial(pulpit);
 return{root,pulpit,hatch,deckY,materials:{paint,red,deck:deckMat,steel}};
}
