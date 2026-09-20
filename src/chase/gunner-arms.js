import * as T from 'three';
import {box,sphere,mergeStatic} from './vehicle-geometry.js';
const UP=new T.Vector3(0,1,0),smooth=T.MathUtils.smoothstep;
const pulse=(p,a,b,c,d)=>smooth(p,a,b)*(1-smooth(p,c,d));
const q=(x,y,z)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
const path=[
 [0,.225,-.06,-.46],[.10,.10,.20,-.22],[.25,.15,.45,.03],
 [.34,.59,-.15,-.14],[.46,.69,-.74,-.29],[.61,.59,-.15,-.14],
 [.70,.34,.18,.04],[.77,.07,.28,-.15],[.87,.07,.20,-.23],[1,.225,-.06,-.46],
];
function handPath(p){for(let i=1;i<path.length;i++)if(p<=path[i][0]){const a=path[i-1],b=path[i];return new T.Vector3(...a.slice(1)).lerp(new T.Vector3(...b.slice(1)),smooth(p,a[0],b[0]));}return new T.Vector3(...path.at(-1).slice(1));}

export function createGunnerArms(gun,body,mats){
 const root=new T.Group();gun.add(root);
 const glove=new T.MeshStandardMaterial({color:0x665f4c,roughness:.95,map:mats.fabric.map});
 const palm=new T.MeshStandardMaterial({color:0x363c31,roughness:.92});
 const seam=new T.MeshStandardMaterial({color:0x8c8570,roughness:1});
 const sleeve=new T.MeshStandardMaterial({color:0x4b5441,roughness:1,map:mats.paint.map,bumpMap:mats.paint.bumpMap,bumpScale:.0007});
 function limb(radius,mat){
  const geometry=new T.CylinderGeometry(radius*.78,radius,1,16,16),p=geometry.attributes.position;
  if(mat===sleeve)for(let i=0;i<p.count;i++){const y=p.getY(i),angle=Math.atan2(p.getZ(i),p.getX(i)),fold=1+.035*Math.sin((y+.5)*Math.PI*9+angle*.4)+.018*Math.sin(angle*5);p.setX(i,p.getX(i)*fold);p.setZ(i,p.getZ(i)*fold);}geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,mat);mesh.castShadow=true;root.add(mesh);return mesh;
 }
 function makeHand(s){
  const hand=new T.Group();root.add(hand);
  sphere(hand,glove,1,[0,0,0],[.047,.055,.025]);
  box(hand,palm,[.073,.066,.013],[0,-.002,.024]);
  box(hand,glove,[.080,.063,.013],[0,.002,-.023]);
  for(const x of [-.032,.032])box(hand,seam,[.002,.050,.002],[x,.004,-.031]);
  box(hand,palm,[.073,.023,.053],[0,-.058,0]);box(hand,glove,[.045,.015,.009],[.006,-.058,-.029]);
  const fingers=[];
  for(let f=0;f<4;f++){
   const lengths=[.034,.025,.020].map(n=>n*[.91,1,.94,.75][f]);
   let parent=hand;const joints=[];
   for(let j=0;j<3;j++){
    const joint=new T.Group();joint.position.set(j?0:(f-1.5)*.024,j?lengths[j-1]:.037,0);parent.add(joint);
    sphere(joint,j===2?palm:glove,1,[0,lengths[j]*.46,0],[.012,lengths[j]*.65,.012]);
    if(j===0)box(joint,palm,[.017,.013,.007],[0,.011,-.012]);
    mergeStatic(joint);joints.push(joint);parent=joint;
   }
   joints[0].rotation.z=(1.5-f)*.07;fingers.push(joints);
  }
  const thumb=new T.Group();thumb.position.set(-s*.040,-.018,.004);thumb.rotation.z=s*.82;hand.add(thumb);
  const thumbTip=new T.Group();thumbTip.position.y=.039;thumb.add(thumbTip);
  sphere(thumb,glove,1,[0,.019,0],[.015,.026,.015]);sphere(thumbTip,palm,1,[0,.012,0],[.014,.023,.014]);
  mergeStatic(thumb);mergeStatic(thumbTip);mergeStatic(hand);
  return{hand,fingers,thumb,thumbTip};
 }
 const arms=[1,-1].map(s=>({s,...makeHand(s),upper:limb(.078,sleeve),fore:limb(.065,sleeve),cuff:limb(.055,palm),elbow:sphere(root,sleeve,.068,[0,0,0]),shoulder:new T.Vector3(),wrist:new T.Vector3(),bend:new T.Vector3(),upperLength:.37,foreLength:.35,contact:'grip'}));
 function segment(mesh,a,b){const d=b.clone().sub(a);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.y=d.length();mesh.quaternion.setFromUnitVectors(UP,d.normalize());}
 function solve(arm,shoulder,wrist){
  const delta=wrist.clone().sub(shoulder),length=delta.length(),dir=delta.normalize(),reach=arm.upperLength+arm.foreLength-.006;
  // Reach with the shoulder/torso, never stretch the forearm to the ammo can.
  if(length>reach)shoulder.addScaledVector(dir,length-reach);
  const d=Math.max(.06,wrist.distanceTo(shoulder)),along=(arm.upperLength**2-arm.foreLength**2+d*d)/(2*d),height=Math.sqrt(Math.max(0,arm.upperLength**2-along*along));
  const pole=new T.Vector3(arm.s*.7,-.65,-.25);pole.addScaledVector(dir,-pole.dot(dir)).normalize();
  const elbow=shoulder.clone().addScaledVector(dir,along).addScaledVector(pole,height);
  segment(arm.upper,shoulder,elbow);segment(arm.fore,elbow,wrist);segment(arm.cuff,wrist.clone().lerp(elbow,.16),wrist);arm.elbow.position.copy(elbow);
  arm.shoulder.copy(shoulder);arm.wrist.copy(wrist);arm.bend.copy(elbow);
 }
 function update(p,reloading,third,cover,can,charging,recoil=0){
  for(const a of arms){
   let target=new T.Vector3(a.s*.225,-.06,-.46+recoil),orientation=q(.05,a.s*.08,a.s*.10),curl=.94;a.contact='grip';
   if(reloading&&a.s===1){
    target=handPath(p);const lift=Math.max(pulse(p,.025,.09,.25,.31),pulse(p,.71,.77,.85,.93)),hold=pulse(p,.285,.35,.60,.66),feed=pulse(p,.625,.68,.715,.76);
    const handle=new T.Vector3(.055,.075,-.53);cover.localToWorld(handle);gun.worldToLocal(handle);
    target.lerp(handle,lift);orientation.slerp(q(cover.rotation.x+1.35,0,-.16),lift);
    const canHandle=new T.Vector3(0,.043,-.187).applyEuler(can.rotation).add(can.position);target.lerp(canHandle,hold);orientation.slerp(q(.10,0,can.rotation.z-.15),hold);
    orientation.slerp(q(1.42,.15,-.38),feed);curl=T.MathUtils.lerp(.35,.90,Math.max(lift,hold,feed));a.contact=lift>.8?'cover':hold>.8?'can':feed>.7?'belt':'reach';
   }
   if(reloading&&a.s===-1){const charge=pulse(p,.84,.89,.965,1);target.lerp(new T.Vector3(-.255,.015,charging.position.z-.025),charge);orientation.slerp(q(.06,-.18,.20),charge);a.contact=charge>.8?'charging':'grip';}
   a.hand.position.copy(target);a.hand.quaternion.copy(orientation);
   for(let f=0;f<4;f++)for(let j=0;j<3;j++)a.fingers[f][j].rotation.x=curl*[1.05,1.24,.80][j]+(f===3?.08:0);
   a.thumb.rotation.x=.45+curl*.52;a.thumb.rotation.y=-a.s*(.25+curl*.36);a.thumbTip.rotation.x=curl*.78;
   const lean=reloading?pulse(p,.02,.16,.84,1):0;
   let shoulder=new T.Vector3(a.s*.34,-.30,-.79+lean*.20);
   if(third){shoulder.set(a.s*.225,1.97,.72+lean*.16);body.localToWorld(shoulder);gun.worldToLocal(shoulder);}
   const wrist=new T.Vector3(0,-.059,0).applyQuaternion(orientation).add(target);solve(a,shoulder,wrist);
  }
 }
 return{root,arms,update};
}
