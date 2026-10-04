// Innovation Valley (hybrid stage, A11): the park's monorail on an elevated guideway over the
// promenade, a train that passes overhead twice, the aviary as a steel geodesic lattice the road
// runs through, and banners on the lamp posts. world.js calls chunk() while it builds a hybrid
// chunk and update() every frame on that stage. The train is a function of the rules' clock, so
// seeking and Overdrive stay in step.
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** The guideway: lateral offset of its centre (screen left) and the height of its top above the road. */
export const RAIL={x:8.2,top:6.6,depth:1.4,width:1.25};
// Each pass: the stage time its nose is 260 m ahead of the vehicle, and its speed toward the vehicle.
const PASSES=[[5.5,30],[18,34]],CAR=11.4,CARS=3,AHEAD=260,CRUISE=24;
export const AVIARY={index:10,radius:38,squash:.72};

function bannerTexture(){
 const c=document.createElement('canvas');c.width=64;c.height=192;const x=c.getContext('2d');
 x.fillStyle='#8a8a8a';x.fillRect(0,0,64,192);
 // Two park colours down a pale cloth (the instance colour tints the field); a white roundel and a hem.
 x.fillStyle='#fff';x.fillRect(0,150,64,42);x.fillStyle='#1b1b1b';x.fillRect(0,0,64,6);
 x.strokeStyle='#fff';x.lineWidth=5;x.beginPath();x.arc(32,64,19,0,7);x.stroke();x.beginPath();x.moveTo(20,72);x.quadraticCurveTo(32,44,46,58);x.stroke();
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

export class Promenade {
 constructor(scene,{routeX,routeY,routeHeading}){
  Object.assign(this,{scene,routeX,routeY,routeHeading});this.dummy=new T.Object3D();this.v=new T.Vector3();
  const shared=m=>{m.userData.shared=true;return m;};
  this.concrete=shared(new T.MeshStandardMaterial({color:0xbdb9b0,roughness:.86}));
  this.steel=shared(new T.MeshStandardMaterial({color:0x6d7775,roughness:.42,metalness:.65}));
  this.banner=shared(new T.MeshStandardMaterial({map:bannerTexture(),side:T.DoubleSide,roughness:.9}));
  this.geometry={box:new T.BoxGeometry(1,1,1),strut:new T.CylinderGeometry(1,1,1,6,1,true),banner:new T.PlaneGeometry(1,1).translate(0,-.5,0)};
  for(const g of Object.values(this.geometry))g.userData.shared=true;
  this.train=this.buildTrain();this.train.visible=false;scene.add(this.train);
 }
 // ---- The train ---------------------------------------------------------------------------
 buildTrain(){
  const white=new T.MeshStandardMaterial({color:0xe9ece8,roughness:.32,metalness:.15}),glass=new T.MeshStandardMaterial({color:0x0d1519,roughness:.08,metalness:.7}),
   teal=new T.MeshStandardMaterial({color:0x1d8a8c,roughness:.4}),grey=new T.MeshStandardMaterial({color:0x45494a,roughness:.7,metalness:.3});
  const box=(w,h,d,x,y,z)=>new T.BoxGeometry(w,h,d).translate(x,y,z),sets=new Map([[white,[]],[glass,[]],[teal,[]],[grey,[]]]);
  // Built nose first toward -z (the vehicle): the train runs toward it on the far side of the street.
  for(let c=0;c<CARS;c++){const z=c*(CAR+.5);
   // Body straddles the beam: the skirt wraps its top, the cabin rides above.
   sets.get(white).push(box(2.7,1.5,CAR,0,.95,z),box(2.4,.45,CAR-.3,0,2.85,z));
   sets.get(glass).push(box(2.62,.95,CAR-.6,0,2.15,z));
   sets.get(teal).push(box(2.74,.16,CAR+.02,0,1.62,z),box(2.74,.08,CAR+.02,0,.3,z));
   sets.get(grey).push(box(1.9,.6,CAR-1.2,0,-.1,z),box(2.3,.4,.5,0,1.9,z+CAR/2+.25));}
  // The lead car's rounded nose and its wrap-around windscreen.
  const nose=new T.SphereGeometry(1.35,18,12,0,Math.PI*2,0,Math.PI).scale(1,1.15,1.7).translate(0,1.55,-CAR/2);
  sets.get(white).push(nose);sets.get(glass).push(new T.SphereGeometry(1.37,18,8,0,Math.PI*2,Math.PI*.22,Math.PI*.2).scale(1,1.15,1.7).translate(0,1.55,-CAR/2));
  const g=new T.Group();g.name='Monorail';
  for(const [m,list]of sets){const mesh=new T.Mesh(mergeGeometries(list.map(x=>x.index?x.toNonIndexed():x)),m);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);}
  return g;
 }
 // ---- Chunk set dressing -------------------------------------------------------------------
 chunk(g,start,mid,id,index){
  const {routeX:rx,routeY:ry,routeHeading:rh}=this,beams=[],steel=[],banners=[];
  const at=(off,y,z)=>[rx(z,id)+off*Math.cos(rh(z,id)),ry(z,id)+y,z-mid];
  // Guideway: a concrete box beam in 4 m segments that follow the curve, a steel power rail on
  // its side, and one T-pylon per chunk.
  for(let z=start+2;z<start+32;z+=4){const [x,y,lz]=at(RAIL.x,RAIL.top-RAIL.depth/2,z);beams.push([x,y,lz,RAIL.width,RAIL.depth,4.06,rh(z,id)]);
   const [sx,sy,sz]=at(RAIL.x-RAIL.width/2-.06,RAIL.top-.35,z);steel.push([sx,sy,sz,.08,.16,4.06,rh(z,id)]);}
  const pz=start+12,[px,py,pzl]=at(RAIL.x,0,pz),h=RAIL.top-RAIL.depth;beams.push([px,py+h/2,pzl,1.1,h,1.1,rh(pz,id)]);const [cx,cy,cz]=at(RAIL.x,h-.35,pz);beams.push([cx,cy,cz,2.6,.7,1.5,rh(pz,id)]);
  // Banners on the lamp posts (world.js stands one every 8 m at 11.55 m out), teal and orange.
  for(const side of [-1,1])for(let z=start;z<start+32;z+=8){if(Math.round(z/8)%2)continue;const [bx,by,bz]=at(side*11.25,4.95,z);banners.push([bx,by,bz,.95,2.5,1,rh(z,id),Math.round(z/16)%2?[.06,.42,.44]:[.85,.36,.08]]);}
  this.place(g,this.geometry.box,this.concrete,beams);this.place(g,this.geometry.box,this.steel,steel,false);this.place(g,this.geometry.banner,this.banner,banners,false);
  if(index===AVIARY.index)this.aviary(g,mid,id);
 }
 place(g,geo,mat,items,shadow=true){
  if(!items.length)return;const mesh=new T.InstancedMesh(geo,mat,items.length),c=new T.Color();mesh.castShadow=shadow;mesh.receiveShadow=true;
  items.forEach(([x,y,z,sx,sy,sz,ry,tint],i)=>{this.dummy.position.set(x,y,z);this.dummy.rotation.set(0,ry,0);this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);if(tint)mesh.setColorAt(i,c.setRGB(...tint));});
  mesh.computeBoundingSphere();g.add(mesh);
 }
 /** The aviary: a squashed geodesic hemisphere of steel struts over the road, open where the road runs in and out. */
 aviary(g,mid,id){
  const R=AVIARY.radius,ico=new T.EdgesGeometry(new T.IcosahedronGeometry(R,3),1),p=ico.attributes.position,a=new T.Vector3(),b=new T.Vector3(),d=new T.Vector3(),up=new T.Vector3(0,1,0),q=new T.Quaternion();
  const cx=this.routeX(mid,id),cy=this.routeY(mid,id),items=[];
  for(let i=0;i<p.count;i+=2){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);if(a.y<-.5||b.y<-.5)continue;a.y*=AVIARY.squash;b.y*=AVIARY.squash;
   // The road's way in and out: no strut lower than 8 m within 8 m of the road.
   if(Math.min(a.y,b.y)<8&&Math.min(Math.abs(a.x),Math.abs(b.x))<8&&Math.abs(a.z)>R*.6)continue;
   items.push([a.clone(),b.clone()]);}
  const mesh=new T.InstancedMesh(this.geometry.strut,this.steel,items.length);mesh.castShadow=true;mesh.receiveShadow=true;
  items.forEach(([s,e],i)=>{d.subVectors(e,s);const len=d.length();this.dummy.position.addVectors(s,e).multiplyScalar(.5).add(this.v.set(cx,cy,0));this.dummy.quaternion.copy(q.setFromUnitVectors(up,d.divideScalar(len)));this.dummy.scale.set(.22,len,.22);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);});
  mesh.computeBoundingSphere();g.add(mesh);ico.dispose();
 }
 // ---- Every frame ----------------------------------------------------------------------------
 update(game,camera){
  const t=game?.stageTime??0,camZ=camera.position.z,id='hybrid';let front=null;
  for(const [t0,speed]of PASSES)if(t>=t0&&t<t0+9){front=CRUISE*t0+AHEAD-speed*(t-t0);break;}
  this.train.visible=front!==null&&front>camZ-CARS*(CAR+.5)-10;if(!this.train.visible)return;
  // The train rides the beam: each car takes the route's place and heading at its own middle.
  const z=front+CAR/2,h=this.routeHeading(z,id);this.train.position.set(this.routeX(z,id)+RAIL.x*Math.cos(h),this.routeY(z,id)+RAIL.top+.1,z);this.train.rotation.set(0,h,0);
 }
 hide(){this.train.visible=false;}
}
