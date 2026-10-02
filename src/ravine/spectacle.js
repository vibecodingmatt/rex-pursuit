import * as T from 'three';
import {mergeStatic} from '../chase/vehicle-geometry.js';
import {ROAD_SPEED,hash,shoulderHeight} from './route.js';

// All scenery is attached to the road. The bridge fails after the Jeep clears
// it; fragments fall on the shoulders, leaving the hunter lanes unobstructed.
export function createSpectacle(root,viaduct,stone,effects){
 const steel=new T.MeshStandardMaterial({color:0x514c40,roughness:.72,metalness:.58});
 const yellow=new T.MeshStandardMaterial({color:0xd7a235,roughness:.68,metalness:.25});
 const dark=new T.MeshStandardMaterial({color:0x252d2c,roughness:.75,metalness:.35});
 const hot=new T.MeshStandardMaterial({color:0xff9e26,emissive:0xff7b16,emissiveIntensity:2,roughness:.4});
 const halves=[],targets=[],shards=[],dummy=new T.Object3D(),hitPoint=new T.Vector3();let tier=1,lastTime=0,bridgeFired=false,rumble=0,onEvent=()=>{};
 function box(group,mat,size,xyz,angle=0){const g=new T.BoxGeometry(...size);if(mat===stone){const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;for(let i=0;i<p.count;i++)u.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))*.38,(Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i))*.38);}const m=new T.Mesh(g,mat);m.position.set(...xyz);m.rotation.z=angle;m.castShadow=m.receiveShadow=true;group.add(m);return m;}
 function rod(group,mat,a,b,r=.055){const start=new T.Vector3(...a),end=new T.Vector3(...b),d=end.sub(start),m=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),7),mat);m.position.copy(start).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());group.add(m);return m;}
 for(const side of [-1,1]){
  const pivot=new T.Group();pivot.position.set(side*18.5,12.7,0);viaduct.add(pivot);halves.push({pivot,side});
  box(pivot,stone,[18.6,1.15,4],[-side*9.25,0,0]);
  for(const z of [-1.8,1.8]){
   box(pivot,steel,[18.5,.18,.17],[-side*9.25,1.25,z]);box(pivot,steel,[18.5,.3,.3],[-side*9.25,-1.2,z]);
   for(let j=0;j<10;j++){const x=-side*(j*1.85+.2);box(pivot,steel,[.1,1.2,.1],[x,.65,z]);rod(pivot,steel,[x,-.65,z],[x-side*1.75,-1.2,z],.07);}
  }
  for(let j=0;j<7;j++)box(pivot,dark,[.045,1.18,4.02],[-side*(j*2.5+.8),0,0],side*.025);
  for(let j=0;j<5;j++)rod(pivot,steel,[-side*(18.4+j*.11),-.45,-1.5+j*.65],[-side*(18.85+j*.08),-.65,-1.5+j*.65],.026);
  mergeStatic(pivot);
 }
 // Buttresses, rusted X-bracing and hazard paint give the original simple
 // columns a construction scale and readable load-bearing structure.
 for(const x of [-7.7,7.7]){
  box(viaduct,stone,[2.2,1.5,3.3],[x,.65,0]);
  for(const z of [-1.4,1.4]){box(viaduct,steel,[.22,11,.2],[x-.6,6,z]);box(viaduct,steel,[.22,11,.2],[x+.6,6,z]);for(let j=0;j<4;j++){rod(viaduct,steel,[x-.6,1.6+j*2.4,z],[x+.6,4+j*2.4,z],.045);rod(viaduct,steel,[x+.6,1.6+j*2.4,z],[x-.6,4+j*2.4,z],.045);}}
  for(let j=0;j<4;j++)box(viaduct,j%2?dark:yellow,[1.56,.25,.03],[x,.5+j*.25,-1.32]);
 }
 const fragments=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),stone,56);fragments.castShadow=fragments.receiveShadow=true;fragments.frustumCulled=false;root.add(fragments);fragments.count=0;
 const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=256;const c=labelCanvas.getContext('2d');c.fillStyle='#212928';c.fillRect(0,0,512,256);c.strokeStyle='#ffc75a';c.lineWidth=14;c.strokeRect(9,9,494,238);c.fillStyle='#ffc75a';c.textAlign='center';c.font='bold 40px Arial';c.fillText('QUARRY CHARGE',256,66);c.font='bold 74px Arial';c.fillText('SHOOT',256,155);c.font='20px monospace';c.fillText('PACK CLEARANCE',256,208);
 const label=new T.CanvasTexture(labelCanvas);label.colorSpace=T.SRGBColorSpace;
 for(const [i,seconds]of [15,43,69].entries()){
  const side=i%2?-1:1,group=new T.Group();root.add(group);
  box(group,dark,[1.4,1.35,.8],[0,.9,0]);box(group,yellow,[1.5,.12,.9],[0,.22,0]);
  for(const x of [-.48,0,.48]){const drum=new T.Mesh(new T.CylinderGeometry(.18,.18,.78,10),yellow);drum.position.set(x,.94,-.44);group.add(drum);}
  for(const x of [-.68,.68])box(group,steel,[.08,2.5,.08],[x,1.25,0]);
  const sign=new T.Mesh(new T.PlaneGeometry(2.8,1.4),new T.MeshStandardMaterial({map:label,roughness:.7,emissive:0xffffff,emissiveMap:label,emissiveIntensity:.3,side:T.DoubleSide}));sign.rotation.y=Math.PI;sign.position.set(0,2.25,-.1);group.add(sign);
  const lamp=new T.Mesh(new T.SphereGeometry(.13,8,6),hot);lamp.position.set(0,3.05,0);group.add(lamp);
  // Ring marks a real shootable detonator, with a generous phone aim sphere.
  const ring=new T.Mesh(new T.TorusGeometry(.42,.045,6,28),hot);ring.position.set(0,1.1,-.51);group.add(ring);
  mergeStatic(group);const wreck=new T.Group();root.add(wreck);box(wreck,dark,[1.5,.16,.9],[0,.12,0]);box(wreck,dark,[.7,.5,.6],[-.3,.3,0],.3);rod(wreck,steel,[.68,.1,0],[.98,.8,.2],.04);mergeStatic(wreck);wreck.visible=false;targets.push({id:i,group,wreck,x:side*4.5,z:22-seconds*ROAD_SPEED,used:false,announced:false,center:new T.Vector3()});
 }
 function rubble(at,amount=18){
  for(let i=0;i<Math.ceil(amount*tier);i++){if(shards.length>=56)shards.shift();const k=i+Math.round(at.z);shards.push({x:at.x+(hash(k+4)-.5)*3,y:at.y+hash(k+1)*2,z:at.z,vx:(hash(k+2)-.5)*3,vy:1+hash(k+5)*3,vz:(hash(k+3)-.5)*3,age:0,spin:hash(k+8)*6,scale:.14+hash(k+9)*.52,bounced:false});}
 }
 // An explicit setter keeps the callback's mutation visible to bundlers across
 // the async world factory. A nullable property was folded away in production.
 const api={targets,halves,fragments,setEventHandler(callback){onEvent=callback;},
  hit(ray,far=100){let best=null;for(const t of targets){if(t.used||t.center.z<5||t.center.z>72)continue;const p=ray.intersectSphere(new T.Sphere(t.center,1.1),hitPoint);if(p){const distance=p.distanceTo(ray.origin);if(distance<far&&(!best||distance<best.distance))best={quarry:t,point:p.clone(),distance};}}return best;},
  detonate(target){if(target.used)return false;target.used=true;target.group.visible=false;const at=target.center.clone();effects.burst(at,false,true);for(let i=0;i<3;i++)effects.groundDust(at.clone().setY(.15),new T.Vector3((i-1)*2,1,.4),{size:1,growth:4,opacity:.35,life:3,color:0xb29a77});rubble(at.clone().setY(4),24);rumble=1;onEvent({type:'quarry',at,id:target.id});return true;},
  update(dt,round,travel){
   const t=round.time;for(const target of targets){target.group.position.set(target.x,0,target.z+travel);target.wreck.position.copy(target.group.position);target.wreck.visible=target.used&&target.group.position.z<220;target.center.set(target.x,1.3,target.z+travel);target.group.visible=!target.used&&target.center.z>-18&&target.center.z<220;if(!target.announced&&target.center.z>=8&&t>1){target.announced=true;onEvent({type:'quarry-ready',target});}}
   if(t>=32.7&&!bridgeFired){bridgeFired=true;onEvent({type:'bridge-warning'});}
   const collapse=Math.max(0,t-34.1);
   for(const {pivot,side}of halves){const u=Math.max(0,collapse-(side>0?.18:0)),angle=u?(.34*(1-Math.exp(-u*3))+Math.sin(u*7)*Math.exp(-u*1.7)*.045):0;pivot.rotation.z=side*angle;}
   if(lastTime<34.1&&t>=34.1){rumble=1;for(const side of [-1,1]){const at=new T.Vector3(side*8.2,9,travel-270);rubble(at,28);effects.groundDust(at,new T.Vector3(side,.3,0),{size:1.3,growth:4,opacity:.25,life:3,color:0xbaaa8d});}onEvent({type:'bridge-collapse'});}
   let count=0;for(let i=shards.length-1;i>=0;i--){const s=shards[i];s.age+=dt;if(s.age>7){shards.splice(i,1);continue;}s.vy-=dt*12;s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=(s.vz+ROAD_SPEED)*dt;const floor=shoulderHeight(s.x)+s.scale*.6;if(s.y<floor){s.y=floor;s.vy=Math.abs(s.vy)*.18;s.vx*=Math.exp(-dt*7);s.vz*=Math.exp(-dt*7);if(!s.bounced){s.bounced=true;effects.groundDust(new T.Vector3(s.x,floor,s.z),new T.Vector3(s.vx*.2,.2,s.vz*.2),{size:.4,growth:1.8,life:1.6,opacity:.22,color:0xb6a07e});}}
    dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(s.bounced?s.spin:s.spin+s.age*2,s.spin,s.bounced?s.spin:s.age);dummy.scale.setScalar(s.scale*Math.min(1,(7-s.age)/1.2));dummy.updateMatrix();fragments.setMatrixAt(count++,dummy.matrix);
   }fragments.count=count;fragments.instanceMatrix.needsUpdate=true;hot.emissiveIntensity=1.4+Math.sin(t*5)*.6;rumble=Math.max(0,rumble-dt*2);lastTime=t;
  },
  get rumble(){return rumble;},
  reset(){lastTime=0;bridgeFired=false;rumble=0;shards.length=0;fragments.count=0;for(const t of targets){t.used=t.announced=false;t.group.visible=true;t.wreck.visible=false;}for(const h of halves)h.pivot.rotation.z=0;},
  setQuality(t){tier=t.ravine?.debris??(t.detail?1:.4);}
 };return api;
}
