import * as T from 'three';
import {box,cylinder,tube,sphere,canvasDecal,mergeStatic} from './vehicle-geometry.js';

const UP=new T.Vector3(0,1,0);

/** Seated park warden. Vehicle forward is -Z, so its left seat is -X. */
export function createParkDriver(body,mats){
 const {black,steel}=mats;
 const shirt=new T.MeshStandardMaterial({color:0xb6ad90,roughness:.95});
 const vest=new T.MeshStandardMaterial({color:0x827958,roughness:.97,side:T.DoubleSide});
 const seam=new T.MeshStandardMaterial({color:0x736b52,roughness:.94});
 const skin=new T.MeshStandardMaterial({color:0xa7785e,roughness:.88});
 const shade=new T.MeshStandardMaterial({color:0x916953,roughness:.92});
 const hair=new T.MeshStandardMaterial({color:0x504639,roughness:1});
 const leather=new T.MeshStandardMaterial({color:0x342e22,roughness:.85});
 const buckle=new T.MeshStandardMaterial({color:0x9e8c58,metalness:.65,roughness:.42});
 const eyes=new T.MeshStandardMaterial({color:0x302f25,roughness:.53});
 const eyeWhite=new T.MeshStandardMaterial({color:0xafa88f,roughness:.68});
 const root=new T.Group();root.name='park-warden-driver';root.position.set(-.43,0,-.30);body.add(root);
 const upper=new T.Group();upper.position.y=1.20;root.add(upper);
 // Elliptical torso rings give the shoulders, waist and vest a human silhouette.
 const profile=[[0,.16,.115],[.12,.18,.125],[.33,.215,.14],[.47,.215,.12],[.53,.145,.09]],verts=[],indices=[],segments=24;
 for(const [y,w,d]of profile)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;verts.push(Math.cos(a)*w,y,Math.sin(a)*d);}
 for(let row=0;row<profile.length-1;row++)for(let i=0;i<segments;i++){const a=row*segments+i,b=row*segments+(i+1)%segments,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}
 const torsoGeo=new T.BufferGeometry();torsoGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));torsoGeo.setAttribute('uv',new T.Float32BufferAttribute(verts.flatMap((_,i)=>i%3===0?[((i/3)%segments)/segments,Math.floor(i/3/segments)/(profile.length-1)]:[]),2));torsoGeo.setIndex(indices);torsoGeo.computeVertexNormals();
 const torso=new T.Mesh(torsoGeo,shirt);torso.castShadow=true;upper.add(torso);
 for(const side of [-1,1]){
  box(upper,vest,[.132,.38,.052],[side*.122,.27,-.116],[0,side*-.09,side*.08]);
  box(upper,vest,[.115,.13,.060],[side*.127,.165,-.155]);box(upper,seam,[.116,.028,.064],[side*.127,.227,-.158]);
  box(upper,vest,[.064,.17,.043],[side*.174,.443,-.063],[0,0,side*-.42]);
  box(upper,shirt,[.080,.107,.025],[side*.057,.464,-.107],[0,side*.12,side*.35]);
  box(upper,seam,[.09,.022,.041],[side*.162,.492,-.019],[0,0,side*.16]);
  sphere(upper,buckle,.006,[side*.137,.495,-.043]);
 }
 tube(upper,shade,[0,.39,-.102],[0,.515,-.076],.014);
 box(upper,leather,[.342,.052,.255],[0,.027,0]);box(upper,buckle,[.061,.038,.016],[0,.027,-.139]);box(upper,leather,[.041,.021,.02],[0,.027,-.149]);
 tube(upper,leather,[-.175,.474,-.163],[.145,.015,-.159],.016);
 canvasDecal(upper,256,384,(c,w,h)=>{c.fillStyle='#d9d6b8';c.fillRect(0,0,w,h);c.fillStyle='#831e16';c.fillRect(0,0,w,76);c.fillStyle='#ebe5c7';c.font='bold 27px Arial';c.fillText('JURASSIC PARK',12,48);c.fillStyle='#7b806b';c.fillRect(22,105,90,115);c.fillStyle='#161e19';c.font='bold 27px monospace';c.fillText('MULDOON',20,268);c.font='23px monospace';c.fillText('GAME WARDEN',20,311);},[.048,.071],[-.112,.334,-.151],[0,Math.PI,0]);

 const head=new T.Group();head.position.set(0,.585,-.018);upper.add(head);
 cylinder(head,skin,.055,.067,.13,[0,-.018,.014],[0,0,0]);
 // Shape the nose, cheeks and jaw into one surface so the face doesn't read
 // as separate balls when the external camera catches it through the glass.
 const faceGeo=new T.SphereGeometry(.13,40,28),facePoints=faceGeo.attributes.position;
 for(let i=0;i<facePoints.count;i++){
  let x=facePoints.getX(i)*.85,y=facePoints.getY(i)*1.18,z=facePoints.getZ(i)*.84;
  const jaw=Math.exp(-Math.pow((y+.087)/.042,2));x*=1+jaw*.10;z*=1+jaw*.09;
  if(z<0){const front=Math.pow(-z/Math.max(.001,Math.hypot(x,z)),4);
   const nose=.037*Math.exp(-Math.pow(x/.023,2)-Math.pow((y+.030)/.045,2));
   const cheek=.008*Math.exp(-Math.pow((Math.abs(x)-.059)/.032,2)-Math.pow((y+.060)/.033,2));
   const socket=.007*Math.exp(-Math.pow((Math.abs(x)-.046)/.023,2)-Math.pow(y/.018,2));
   z-=(nose+cheek-socket)*front;
  }
  facePoints.setXYZ(i,x,y,z);
 }
 faceGeo.computeVertexNormals();const face=new T.Mesh(faceGeo,skin);face.position.y=.111;face.castShadow=true;head.add(face);
 for(const side of [-1,1]){
  sphere(head,skin,.040,[side*.107,.10,.008],[.40,1,.72]);sphere(head,shade,.023,[side*.119,.10,-.002],[.19,.73,.64]);
  sphere(head,shade,.023,[side*.046,.113,-.095],[1.1,.58,.45]);
  sphere(head,eyeWhite,.014,[side*.046,.110,-.105],[1,.40,.35]);
  sphere(head,eyes,.007,[side*.046,.110,-.112],[.65,1,.35]);
  tube(head,hair,[side*.021,.132,-.100],[side*.070,.139,-.088],.006);
  sphere(head,hair,.058,[side*.084,.174,.029],[.48,1,.84]);
  for(let i=0;i<3;i++)tube(head,seam,[side*.103,.154+i*.011,.01],[side*.096,.174+i*.01,.03],.002);
 }
 for(const side of [-1,1])sphere(head,shade,.005,[side*.010,.064,-.137],[.65,.40,.65]);
 tube(head,shade,[-.028,.012,-.092],[0,.014,-.099],.0022);tube(head,shade,[0,.014,-.099],[.028,.012,-.092],.0022);
 // An Australian-style bush hat: asymmetric curled brim, tapered crown and band.
 const hat=new T.Group();head.add(hat);const brimVerts=[],brimIndices=[],hatSegments=48;
 for(let ring=0;ring<3;ring++)for(let i=0;i<hatSegments;i++){const a=i/hatSegments*Math.PI*2,r=.115+ring*.053;const curl=Math.pow(Math.abs(Math.cos(a)),6)*.037*(ring/2);brimVerts.push(Math.cos(a)*r,.248+curl,Math.sin(a)*r*1.13);}
 for(let row=0;row<2;row++)for(let i=0;i<hatSegments;i++){const a=row*hatSegments+i,b=row*hatSegments+(i+1)%hatSegments,c=a+hatSegments,d=b+hatSegments;brimIndices.push(a,b,c,b,d,c);}
 const brimGeo=new T.BufferGeometry();brimGeo.setAttribute('position',new T.Float32BufferAttribute(brimVerts,3));brimGeo.setAttribute('uv',new T.Float32BufferAttribute(brimVerts.flatMap((_,i)=>i%3===0?[brimVerts[i]/.5+.5,brimVerts[i+2]/.5+.5]:[]),2));brimGeo.setIndex(brimIndices);brimGeo.computeVertexNormals();const brim=new T.Mesh(brimGeo,vest);brim.castShadow=true;hat.add(brim);
 const crown=cylinder(hat,vest,.108,.133,.126,[0,.304,0],[0,0,0],32);crown.scale.set(1,1,1.14);
 const band=cylinder(hat,leather,.132,.135,.025,[0,.253,0],[0,0,0],32);band.scale.z=1.14;
 const top=sphere(hat,vest,.108,[0,.365,0],[1,.10,1.14]);
 tube(hat,seam,[0,.376,-.07],[0,.376,.055],.008);
 for(const s of [-1,1])for(const z of [-.033,.029]){sphere(hat,buckle,.008,[s*.125,.294,z],[.20,1,1]);sphere(hat,black,.004,[s*.127,.294,z],[.2,1,1]);}
 // Shorts, bare knees, long socks and boots fitted into the front footwell.
 for(const s of [-1,1]){
  tube(root,shirt,[s*.105,1.17,0],[s*.145,1.165,-.25],.093);sphere(root,skin,.074,[s*.145,1.146,-.31]);
  tube(root,skin,[s*.145,1.146,-.31],[s*.149,1.081,-.42],.056);tube(root,seam,[s*.149,1.081,-.42],[s*.15,.99,-.58],.058);
  box(root,leather,[.135,.14,.29],[s*.15,.956,-.605]);box(root,black,[.14,.025,.30],[s*.15,.894,-.607]);
  for(let i=0;i<3;i++)tube(root,seam,[s*.15-.035,1.023,-.51-i*.034],[s*.15+.035,1.023,-.51-i*.034],.003);
 }
 // Separate steering column and wheel, on the vehicle's LEFT (-X) side.
 const steering=new T.Group();steering.name='left-hand-steering';steering.position.set(-.43,1.49,-.68);steering.rotation.x=-.38;body.add(steering);
 const wheel=new T.Group();steering.add(wheel);
 const rim=new T.Mesh(new T.TorusGeometry(.212,.020,10,40),black);rim.castShadow=true;wheel.add(rim);
 cylinder(wheel,leather,.067,.067,.038,[0,0,0]);
 for(const a of [-Math.PI/6,Math.PI*7/6,Math.PI/2])tube(wheel,steel,[Math.cos(a)*.05,Math.sin(a)*.05,0],[Math.cos(a)*.201,Math.sin(a)*.201,0],.011);
 cylinder(wheel,black,.048,.048,.042,[0,0,.01]);
 tube(body,black,[-.43,1.49,-.68],[-.43,1.22,-.94],.033);
 const grips=[-1,1].map(s=>{const p=new T.Object3D();p.position.set(s*.174,.121,0);wheel.add(p);return p;});
 const armRig=new T.Group();root.add(armRig);
 function limb(mat,radius){const m=new T.Mesh(new T.CylinderGeometry(radius*.91,radius,1,14),mat);m.castShadow=true;armRig.add(m);return m;}
 const arms=[-1,1].map((s,i)=>{
  const hand=new T.Group();armRig.add(hand);sphere(hand,skin,.040,[0,0,0],[.72,1.12,.70]);
  for(let n=0;n<4;n++)tube(hand,skin,[-.019+n*.012,.018,-.024],[-.019+n*.012,-.008,-.025],.008);
  sphere(hand,skin,.014,[s*-.029,-.002,.001],[1,1.6,1]);mergeStatic(hand);
  return{s,hand,grip:grips[i],upper:limb(skin,.048),sleeve:limb(shirt,.071),cuff:limb(seam,.073),fore:limb(skin,.041)};
 });
 const v=new T.Vector3(),q=new T.Quaternion();
 function segment(mesh,a,b){mesh.position.copy(a).add(b).multiplyScalar(.5);v.copy(b).sub(a);mesh.scale.y=v.length();mesh.quaternion.setFromUnitVectors(UP,v.normalize());}
 for(const g of [root,upper,head,hat,wheel])mergeStatic(g);
 function update(dt,time,speed,visible){
  root.visible=visible;wheel.rotation.z=(Math.sin(time*.82)*.055+Math.sin(time*1.53)*.018)*Math.min(1,speed/3);
  upper.rotation.x=Math.sin(time*11)*-.003;upper.rotation.z=Math.sin(time*7)*-.004;head.rotation.y=Math.sin(time*.47)*.035;head.rotation.x=Math.sin(time*9)*.007;
  root.updateWorldMatrix(true,true);steering.updateWorldMatrix(true,true);
  for(const a of arms){const shoulder=new T.Vector3(a.s*.194,.438,-.002);upper.localToWorld(shoulder);root.worldToLocal(shoulder);
   const hand=root.worldToLocal(a.grip.getWorldPosition(new T.Vector3()));const elbow=new T.Vector3(a.s*.243,1.408,-.13);
   const cuffEnd=shoulder.clone().lerp(elbow,.52),cuffStart=shoulder.clone().lerp(elbow,.40);
   segment(a.upper,shoulder,elbow);segment(a.sleeve,shoulder,cuffEnd);segment(a.cuff,cuffStart,cuffEnd);segment(a.fore,elbow,hand);
   a.hand.position.copy(hand);a.grip.getWorldQuaternion(q);a.hand.quaternion.copy(root.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));
  }
 }
 update(0,0,0,false);
 return{root,upper,head,steering,wheel,arms,update};
}
