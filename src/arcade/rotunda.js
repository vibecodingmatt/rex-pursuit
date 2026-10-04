import * as T from 'three';

// A14: the Visitor Center's rotunda, the finale's last room. The Jeep smashes through the front doors and
// holds 6 m inside (rules ROTUNDA); raptors come out among the displays, then the two kings smash in
// through the glass curtain at the back. Built in a hall frame: origin at the doors on the floor, +z into
// the hall, centre R metres in. Pursuit's Visitor Center is solid, so world.js swaps the exterior for this
// set as the camera passes the doors; the hall is larger inside than the building is out.
export const HALL={R:17,wall:13,door:2.6,glass:.5,gallery:9.4,panes:8};
const R=HALL.R,TAU=Math.PI*2;

function canvasTexture(w,h,draw,repeat=null){
 const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;if(repeat){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);}return t;
}
const speckle=(x,w,h,n,a)=>{for(let i=0;i<n;i++){const v=100+Math.random()*70|0;x.fillStyle=`rgba(${v},${v-8},${v-20},${a})`;x.fillRect(Math.random()*w,Math.random()*h,1+Math.random()*3,1+Math.random()*3);}};
/** Polished stone with dark inlaid rings, radial joints and a brass compass star at the centre. */
function floorTexture(){return canvasTexture(1024,1024,(x,w)=>{
 x.fillStyle='#8d8373';x.fillRect(0,0,w,w);speckle(x,w,w,14000,.22);x.translate(w/2,w/2);
 const ring=(r0,r1,col)=>{x.beginPath();x.arc(0,0,r1,0,TAU);x.arc(0,0,r0,0,TAU,true);x.fillStyle=col;x.fill();};
 ring(478,512,'#3f3731');ring(300,322,'#4e4237');ring(126,140,'#3f3731');ring(140,148,'#a88d58');
 x.strokeStyle='rgba(38,30,24,.5)';x.lineWidth=2;for(const r of [190,250,380,430]){x.beginPath();x.arc(0,0,r,0,TAU);x.stroke();}
 for(let i=0;i<48;i++){const a=i/48*TAU;x.beginPath();x.moveTo(Math.cos(a)*148,Math.sin(a)*148);x.lineTo(Math.cos(a)*478,Math.sin(a)*478);x.stroke();}
 for(let i=0;i<16;i++){const a=i/16*TAU,l=i%4?i%2?58:84:118;x.fillStyle=i%2?'#8c7044':'#b9985e';x.beginPath();x.moveTo(Math.cos(a)*l,Math.sin(a)*l);x.lineTo(Math.cos(a+.2)*18,Math.sin(a+.2)*18);x.lineTo(Math.cos(a-.2)*18,Math.sin(a-.2)*18);x.fill();}
});}
/** Coursed ashlar: 0.6 m courses with staggered joints (one tile is 4 m square). */
function wallTexture(len){return canvasTexture(512,512,(x,w,h)=>{
 x.fillStyle='#aaa394';x.fillRect(0,0,w,h);speckle(x,w,h,6000,.14);x.fillStyle='rgba(60,52,44,.22)';
 const course=h/6.6;for(let r=0;r<7;r++){const y=Math.round(r*course);x.fillRect(0,y,w,3);const off=r%2?w/6:0;for(let k=0;k<3;k++)x.fillRect((off+k*w/3)%w,y,3,course);}
 const g=x.createLinearGradient(0,h*.85,0,h);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(30,22,16,.35)');x.fillStyle=g;x.fillRect(0,0,w,h);
},[len/4,HALL.wall/4]);}
/** Plaster coffers and ribs for the dome's underside; the canvas top half maps to the hemisphere. */
function domeTexture(){return canvasTexture(1024,512,(x,w,h)=>{
 x.fillStyle='#3a332b';x.fillRect(0,0,w,h);speckle(x,w,h/2,5000,.12);x.fillStyle='rgba(18,14,10,.6)';
 for(let i=0;i<24;i++)x.fillRect(i*w/24-3,0,6,h/2);for(const v of [.12,.24,.34,.42])x.fillRect(0,v*h,w,5);
});}

// ---- The displays: a T. rex and a sauropod mounted on plinths, as instanced primitives (rods with a knob at
// each joint, blocks, rib arcs) so each bone can fall on its own when they collapse.
const X=new T.Vector3(1,0,0),UP=new T.Vector3(0,1,0);
function displays(){
 const pieces=[],M=new T.Matrix4(),Q=new T.Quaternion(),S=new T.Vector3(),place=new T.Matrix4();let group=0;
 const push=(type,m)=>pieces.push({type,m:new T.Matrix4().multiplyMatrices(place,m),group});
 const v=a=>new T.Vector3(...a);
 const rod=(a,b,r,type='rod')=>{const A=v(a),B=v(b),d=B.clone().sub(A),L=d.length();push(type,M.compose(A.clone().add(B).multiplyScalar(.5),Q.setFromUnitVectors(UP,d.normalize()),S.set(r*2,L,r*2)));if(type==='rod')push('knob',M.compose(B,Q.identity(),S.setScalar(r*2.5)));};
 const block=(p,size,rz=0)=>push('block',M.compose(v(p),Q.setFromAxisAngle(new T.Vector3(0,0,1),rz),S.set(...size)));
 const both=f=>{for(const s of [-1,1])f(s);};
 // Vertebrae along the spine curve (neural spines on the trunk, chevrons under the tail), ribs hanging from the trunk.
 function spine(points,count,size,{spines=[.25,.7],ribs=[.5,.7],ribR=[.5,1],ribN=10,tail=.3}){
  const curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(x,y,0))),len=curve.getLength()/count,t=new T.Vector3(),p=new T.Vector3();
  for(let i=0;i<count;i++){const u=(i+.5)/count;curve.getPointAt(u,p);curve.getTangentAt(u,t);const k=.45+.55*Math.sin(Math.min(1,u*1.3)*Math.PI*.5);Q.setFromUnitVectors(X,t);
   push('block',M.compose(p,Q,S.set(len*.78,size*k,size*.85*k)));
   const up=new T.Vector3(0,1,0).applyQuaternion(Q);
   if(u>spines[0]&&u<spines[1])push('block',M.compose(p.clone().addScaledVector(up,size*k*1.3),Q,S.set(len*.3,size*k*2.2*(1-Math.abs(u-(spines[0]+spines[1])/2)),size*.18)));
   if(u<tail&&i%2)push('block',M.compose(p.clone().addScaledVector(up,-size*k*.9),Q,S.set(len*.25,size*k*1.1,size*.15)));}
  for(let i=0;i<ribN;i++){const u=ribs[0]+(ribs[1]-ribs[0])*i/(ribN-1),r=ribR[0]+(ribR[1]-ribR[0])*Math.sin(i/(ribN-1)*Math.PI);curve.getPointAt(u,p);
   both(s=>{const basis=new T.Matrix4().makeBasis(new T.Vector3(0,0,s),new T.Vector3(0,1,0),new T.Vector3(-s,0,0));
    push('rib',new T.Matrix4().makeTranslation(p.x-.15*r,p.y-r,0).multiply(basis).multiply(new T.Matrix4().makeRotationZ(-Math.PI*.45)).multiply(new T.Matrix4().makeScale(r,r,r)));});}
 }
 // T. rex (x forward): skull, tiny arms, pelvis and digitigrade legs.
 place.compose(new T.Vector3(-10.2,.5,16.5),new T.Quaternion().setFromAxisAngle(UP,.985),new T.Vector3(1,1,1));group=0;
 spine([[-7.6,.9],[-5.2,1.9],[-2.6,3],[0,3.45],[1.5,3.4],[2.7,3.1],[3.6,3.45],[4.3,3.95]],44,.3,{spines:[.25,.72],ribs:[.6,.8],ribR:[.55,1],ribN:11,tail:.34});
 block([4.85,3.98,0],[1.25,.85,.55],-.15);block([5.85,3.78,0],[1.1,.55,.4],-.2);block([5.3,3.32,0],[1.9,.18,.42],.12);block([4.55,3.25,0],[.3,.5,.4],.3);
 both(s=>{block([0,3.35,s*.3],[1.7,.55,.12]);rod([.2,3,s*.22],[.75,1.7,s*.12],.07);
  rod([.1,3.1,s*.55],[.85,1.95,s*.62],.13);rod([.85,1.95,s*.62],[.15,.75,s*.62],.1);rod([.15,.75,s*.62],[.55,.12,s*.62],.07);for(const t of [-.14,0,.14])rod([.55,.12,s*.62],[1.05,.05,s*.62+t],.035);
  rod([2.6,2.6,s*.4],[2.85,2.05,s*.45],.05);rod([2.85,2.05,s*.45],[3.15,2,s*.45],.035);});
 rod([0,.25,0],[0,3.3,0],.04,'steel');rod([2.4,.25,0],[2.4,2.95,0],.04,'steel');rod([-4,.25,0],[-4,1.6,0],.04,'steel');
 // Sauropod: neck rising to the gallery, pillar legs.
 place.compose(new T.Vector3(10.4,.5,20),new T.Quaternion().setFromAxisAngle(UP,1.823),new T.Vector3(1,1,1));group=1;
 spine([[-9.5,1.2],[-6.5,2.8],[-3,4.2],[0,4.6],[2.2,5],[4,5.4],[5.2,6.6],[6.1,8.3],[6.8,9.9],[7.3,11]],54,.42,{spines:[.3,.62],ribs:[.42,.6],ribR:[1,1.65],ribN:13,tail:.3});
 block([7.75,11.1,0],[.9,.45,.4],-.3);block([8.3,10.92,0],[.6,.3,.3],-.3);
 both(s=>{block([0,4.5,s*.5],[2.2,.8,.15]);
  rod([0,4.3,s*.8],[.4,2.4,s*.85],.22);rod([.4,2.4,s*.85],[.1,.35,s*.85],.18);block([.3,.15,s*.85],[.7,.3,.5]);
  rod([4,4.8,s*.9],[4.3,2.8,s*.95],.2);rod([4.3,2.8,s*.95],[4.15,.35,s*.95],.17);block([4.3,.15,s*.95],[.6,.3,.45]);});
 rod([0,.25,0],[0,4.2,0],.05,'steel');rod([4,.25,0],[4,4.9,0],.05,'steel');rod([5.8,.25,0],[5.8,7.2,0],.05,'steel');rod([-5,.25,0],[-5,2.6,0],.05,'steel');
 return pieces;
}
/** The banner's face: deep red with a gold border and the legend in two lines. */
function bannerTexture(){return canvasTexture(1024,320,(x,w,h)=>{
 x.fillStyle='#6e1a12';x.fillRect(0,0,w,h);const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,190,120,.12)');g.addColorStop(1,'rgba(0,0,0,.3)');x.fillStyle=g;x.fillRect(0,0,w,h);
 x.strokeStyle='#c9a050';x.lineWidth=10;x.strokeRect(18,18,w-36,h-36);x.lineWidth=3;x.strokeRect(34,34,w-68,h-68);
 x.fillStyle='#f0e0b4';x.textAlign='center';x.font='bold 92px Georgia';x.fillText('WHEN DINOSAURS',w/2,148);x.fillText('RULED THE EARTH',w/2,258);
});}

export class Rotunda {
 constructor(scene){
  const root=this.root=new T.Group();root.name='Rotunda';root.visible=false;scene.add(root);
  const add=(geo,mat,pos=[0,0,0],rot=[0,0,0],shadow=true)=>{const m=new T.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=shadow;m.receiveShadow=true;root.add(m);return m;};
  const d=Math.asin(HALL.door/R),g=HALL.glass,H=HALL.wall,G=HALL.gallery;
  const arc=(Math.PI-d-g)*(R+.6),stone=new T.MeshStandardMaterial({map:wallTexture(arc),color:0xc9c6bc,roughness:.9,side:T.BackSide});
  const trim=new T.MeshStandardMaterial({color:0xc4b597,roughness:.7}),metal=new T.MeshStandardMaterial({color:0x2c4a44,roughness:.45,metalness:.6});
  // Floor, walls either side of the doors (front, theta = pi) and the glass curtain (back, theta = 0).
  add(new T.CircleGeometry(R+.6,96),new T.MeshStandardMaterial({map:floorTexture(),roughness:.3,metalness:.05,envMapIntensity:.45}),[0,.03,R],[-Math.PI/2,0,0],false);
  for(const start of [g,Math.PI+d])add(new T.CylinderGeometry(R+.6,R+.6,H,64,1,true,start,Math.PI-d-g),stone,[0,H/2,R]);
  const upper=stone.clone();upper.map=stone.map.clone();upper.map.repeat.set(HALL.door*2/4,(H-5.4)/4);upper.map.needsUpdate=true;
  add(new T.CylinderGeometry(R+.6,R+.6,H-5.4,12,1,true,Math.PI-d,2*d),upper,[0,5.4+(H-5.4)/2,R]);
  add(new T.CylinderGeometry(R+.6,R+.6,H-G,24,1,true,-g,2*g),stone,[0,G+(H-G)/2,R]);
  // The doorway the Jeep came through: jambs and a lintel, and a moonlit forecourt glimpsed beyond.
  for(const s of [-1,1])add(new T.BoxGeometry(.7,5.4,1.6),trim,[s*(HALL.door+.35),2.7,.1]);
  add(new T.BoxGeometry(HALL.door*2+1.4,.8,1.6),trim,[0,5.8,.1]);
  // Column ring, skipping the doors and the glass.
  const posts=[];for(let i=0;i<20;i++){const a=i/20*TAU;if(Math.abs(Math.atan2(Math.sin(a-Math.PI),Math.cos(a-Math.PI)))<.3||Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<g+.12)continue;posts.push(a);}
  const column=(geo,mat,y)=>{const m=new T.InstancedMesh(geo,mat,posts.length),o=new T.Object3D();posts.forEach((a,i)=>{o.position.set(Math.sin(a)*(R-1.3),y,R+Math.cos(a)*(R-1.3));o.rotation.y=a;o.updateMatrix();m.setMatrixAt(i,o.matrix);});m.castShadow=m.receiveShadow=true;root.add(m);};
  column(new T.CylinderGeometry(.42,.5,G-.9,20),trim,(G-.9)/2+.45);column(new T.BoxGeometry(1.2,.45,1.2),trim,.22);column(new T.BoxGeometry(1.25,.5,1.25),trim,G-.5);
  // The gallery: a ring floor on the columns, its fascia and a turquoise balustrade.
  add(new T.RingGeometry(R-2.9,R+.6,96),new T.MeshStandardMaterial({color:0x4a3a2c,roughness:.8,side:T.DoubleSide}),[0,G,R],[-Math.PI/2,0,0]);
  add(new T.CylinderGeometry(R-2.9,R-2.9,.6,96,1,true),new T.MeshStandardMaterial({color:0xb3a385,roughness:.75,side:T.DoubleSide}),[0,G-.3,R]);
  add(new T.TorusGeometry(R-3,.07,6,160),metal,[0,G+1.05,R],[Math.PI/2,0,0]);
  {const n=96,m=new T.InstancedMesh(new T.BoxGeometry(.06,1.05,.06),metal,n),o=new T.Object3D();for(let i=0;i<n;i++){const a=i/n*TAU;o.position.set(Math.sin(a)*(R-3),G+.52,R+Math.cos(a)*(R-3));o.updateMatrix();m.setMatrixAt(i,o.matrix);}root.add(m);}
  // Clerestory: tall moonlit windows around the upper wall, and the dome with its oculus.
  {const n=26,m=new T.InstancedMesh(new T.PlaneGeometry(1.1,2.4),new T.MeshBasicMaterial({color:0x4c6688,fog:true}),n),o=new T.Object3D();let k=0;
   for(let i=0;i<n;i++){const a=i/n*TAU;o.position.set(Math.sin(a)*(R+.45),G+2.1,R+Math.cos(a)*(R+.45));o.rotation.y=a+Math.PI;o.updateMatrix();m.setMatrixAt(k++,o.matrix);}m.count=k;root.add(m);}
  const dome=add(new T.SphereGeometry(R+.6,64,20,0,TAU,0,Math.PI/2),new T.MeshStandardMaterial({map:domeTexture(),roughness:.95,side:T.BackSide}),[0,H,R]);dome.scale.y=.52;
  add(new T.CircleGeometry(2.6,48),new T.MeshBasicMaterial({color:0x8aa3c4,fog:true}),[0,H+(R+.6)*.52-.08,R],[Math.PI/2,0,0],false);
  // The glass curtain: tall panes between mullions, each breakable on its own; transoms go with their pane.
  const n=HALL.panes,step=2*g/n,chord=2*(R+.4)*Math.sin(step/2);this.panes=[];
  const paneMat=new T.MeshStandardMaterial({color:0x8fb0c2,emissive:0x060d14,roughness:.3,metalness:.1,envMapIntensity:.7,transparent:true,opacity:.2,depthWrite:false,side:T.DoubleSide});
  this.frames=new T.InstancedMesh(new T.BoxGeometry(1,1,1),metal,n*2+n+1);this.frames.castShadow=true;root.add(this.frames);
  const o=new T.Object3D(),put=(i,a,y,sx,sy,sz)=>{o.position.set(Math.sin(a)*(R+.4),y,R+Math.cos(a)*(R+.4));o.rotation.set(0,a,0);o.scale.set(sx,sy,sz);o.updateMatrix();this.frames.setMatrixAt(i,o.matrix);return o.matrix.clone();};
  for(let i=0;i<=n;i++)put(i,-g+i*step,G/2,.16,G,.24);
  for(let i=0;i<n;i++){const a=-g+(i+.5)*step,pane=add(new T.BoxGeometry(chord-.14,G-.2,.04),paneMat,[Math.sin(a)*(R+.4),G/2,R+Math.cos(a)*(R+.4)],[0,a,0],false);pane.renderOrder=2;
   this.panes.push({mesh:pane,a,broken:false,transoms:[[n+1+i*2,put(n+1+i*2,a,3.2,chord,.12,.18)],[n+2+i*2,put(n+2+i*2,a,6.4,chord,.12,.18)]]});}
  // The displays: plinths, then every bone an instance so it can fall on its own.
  const plinth=new T.MeshStandardMaterial({color:0x5a5148,roughness:.6});
  for(const [x,z,yaw,len,wid] of [[-10.2,16.5,.985,10.5,2.6],[10.4,20,1.823,15,3.2]]){const p=add(new T.BoxGeometry(len,.5,wid),plinth,[x,.25,z],[0,yaw,0]);p.translateX(len>12?-1:-1.5);}
  const geos={rod:new T.CylinderGeometry(.5,.5,1,8),knob:new T.SphereGeometry(.5,8,6),block:new T.BoxGeometry(1,1,1),rib:new T.TorusGeometry(1,.045,5,14,Math.PI*.95),steel:new T.CylinderGeometry(.5,.5,1,6)};
  const bone=new T.MeshStandardMaterial({color:0xd8c9a6,roughness:.72}),steel=new T.MeshStandardMaterial({color:0x2a2a2a,roughness:.4,metalness:.8});
  const all=displays();this.bones=[];this.boneMeshes={};
  for(const type of Object.keys(geos)){const list=all.filter(p=>p.type===type),m=new T.InstancedMesh(geos[type],type==='steel'?steel:bone,list.length);m.castShadow=m.receiveShadow=true;root.add(m);this.boneMeshes[type]=m;
   list.forEach((p,i)=>{m.setMatrixAt(i,p.m);const b={mesh:m,i,group:p.group,rest:p.m,p:new T.Vector3(),q:new T.Quaternion(),s:new T.Vector3(),v:new T.Vector3(),w:new T.Vector3(),delay:0,bounces:0};p.m.decompose(b.p,b.q,b.s);b.p0=b.p.clone();b.q0=b.q.clone();this.bones.push(b);});}
  // The banner hangs from a rod over the glass; its vertices are moved on the CPU when it falls.
  const bw=11,bh=3.4,bannerGeo=new T.PlaneGeometry(bw,bh,22,8);this.banner=add(bannerGeo,(()=>{const map=bannerTexture();return new T.MeshStandardMaterial({map,emissiveMap:map,emissive:0xffffff,emissiveIntensity:.32,roughness:.85,side:T.DoubleSide});})(),[0,12.5-bh/2,32.4],[0,Math.PI,0]);
  this.bannerRest=Float32Array.from(bannerGeo.attributes.position.array);this.bannerSize=[bw,bh];
  add(new T.CylinderGeometry(.06,.06,bw+.6,8),steel,[0,12.55,32.4],[0,0,Math.PI/2]);
  this.collapse=[-1,-1];this.fall=-1;this.cues=[];this.centre=new T.Vector3();
  this.inside=false;this.local=new T.Vector3();this.world=new T.Vector3();this.zero=new T.Matrix4().makeScale(0,0,0);
 }
 drain(){return this.cues.splice(0);}
 /** Bones and banner back on display. */
 rehang(){
  for(const b of this.bones){b.p.copy(b.p0);b.q.copy(b.q0);b.v.set(0,0,0);b.w.set(0,0,0);b.bounces=0;b.mesh.setMatrixAt(b.i,b.rest);}
  for(const m of Object.values(this.boneMeshes))m.instanceMatrix.needsUpdate=true;
  const pos=this.banner.geometry.attributes.position;pos.array.set(this.bannerRest);pos.needsUpdate=true;this.banner.geometry.computeVertexNormals();this.collapse=[-1,-1];this.fall=-1;
 }
 /** Topple display `g` (0 T. rex, 1 sauropod): every bone falls with a little outward push, staggered. */
 topple(g){
  if(this.collapse[g]>=0)return;this.collapse[g]=0;let cx=0,cz=0,n=0;for(const b of this.bones)if(b.group===g){cx+=b.p.x;cz+=b.p.z;n++;}cx/=n;cz/=n;
  for(const b of this.bones){if(b.group!==g)continue;const out=new T.Vector3(b.p.x-cx,0,b.p.z-cz).normalize();
   b.v.set(out.x*(.6+Math.random()*1.4)+(Math.random()-.5),Math.random()*1.2,out.z*(.6+Math.random()*1.4)+(Math.random()-.5));b.w.set((Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*5);
   b.delay=Math.random()*.35+(b.p.y>4?0:.15);b.bounces=0;}
  this.cues.push({type:'collapse',at:this.toWorld(cx,2,cz),big:g===1});
 }
 /** The finale's clear: the displays come down as the kings fall, then the banner tears loose and drops. */
 update(dt,game){
  if(!this.root.visible||dt<=0)return;
  const clear=game?.phase==='clear',t=clear?game.phaseTime:-1;
  if(!clear&&(this.fall>=0||this.collapse[0]>=0||this.collapse[1]>=0))this.rehang();
  if(clear){if(t>.35)this.topple(0);if(t>.8)this.topple(1);if(t>1.3&&this.fall<0){this.fall=0;this.cues.push({type:'banner',at:this.toWorld(0,11,32)});}}
  const dq=new T.Quaternion(),axis=new T.Vector3(),m=new T.Matrix4();let moved=false;
  for(const b of this.bones){if(this.collapse[b.group]<0||b.bounces>2)continue;if(this.collapse[b.group]<b.delay)continue;moved=true;
   b.v.y-=9.8*dt;b.p.addScaledVector(b.v,dt);const spin=b.w.length();if(spin>0){dq.setFromAxisAngle(axis.copy(b.w).divideScalar(spin),spin*dt);b.q.premultiply(dq);}
   const rest=.03+Math.min(b.s.x,b.s.y,b.s.z)*.5;if(b.p.y<rest){b.p.y=rest;b.bounces++;b.v.set(b.v.x*.45,Math.abs(b.v.y)*.22,b.v.z*.45);b.w.multiplyScalar(.45);if(b.bounces>2){b.v.set(0,0,0);b.w.set(0,0,0);}}
   b.mesh.setMatrixAt(b.i,m.compose(b.p,b.q,b.s));}
  for(const g of [0,1])if(this.collapse[g]>=0)this.collapse[g]+=dt;
  if(moved)for(const mesh of Object.values(this.boneMeshes))mesh.instanceMatrix.needsUpdate=true;
  // The banner: the left rope goes first, it swings and flutters down, and piles on the floor toward the Jeep.
  if(this.fall>=0){this.fall+=dt;const f=this.fall,[bw,bh]=this.bannerSize,pos=this.banner.geometry.attributes.position,r=this.bannerRest,top=12.5-bh/2;let cy=0;
   for(let i=0;i<pos.count;i++){const x=r[i*3],y=r[i*3+1],tv=Math.max(0,f-.5*(x/bw+.5)),drop=Math.min(14,3*tv*tv+.4*tv),k=Math.min(1,tv*2);
    let wy=top+y-drop,wz=Math.sin(x*.9+f*7+y*1.4)*.35*k*Math.max(0,1-tv/3);if(wy<.06){wz+=(.06-wy)*.9;wy=.06+Math.sin(x*1.7+y*3)*.04;}
    pos.setXYZ(i,x-.5*k,wy-top,wz);cy+=wy;}
   pos.needsUpdate=true;this.banner.geometry.computeVertexNormals();this.toWorld(0,cy/pos.count,32,this.centre);}
  else this.toWorld(0,10.8,32.4,this.centre);
 }
 /** Stand the hall at the doors' floor point, facing along the route's heading. */
 place(origin,heading){this.root.position.copy(origin);this.root.rotation.set(0,heading,0);this.root.updateMatrixWorld(true);}
 /** A hall-frame point in world space. */
 toWorld(x,y,z,out=new T.Vector3()){return out.set(x,y,z).applyMatrix4(this.root.matrixWorld);}
 reset(){for(const p of this.panes){p.broken=false;p.mesh.visible=true;for(const [k,m] of p.transoms)this.frames.setMatrixAt(k,m);}this.frames.instanceMatrix.needsUpdate=true;this.rehang();this.cues=[];}
 /** Break any pane a king's head (world x, z) reaches from outside; returns the burst points for glass.js. */
 breach(heads){
  const bursts=[],inv=this.inverse??=new T.Matrix4();inv.copy(this.root.matrixWorld).invert();
  for(const h of heads){const l=this.local.set(h.x,0,h.z).applyMatrix4(inv),wall=R+Math.sqrt(Math.max(0,(R+.4)**2-l.x*l.x));if(l.z>wall+1||l.z<wall-6)continue;
   for(const p of this.panes){if(p.broken||Math.abs(Math.sin(p.a)*(R+.4)-l.x)>2.6)continue;p.broken=true;p.mesh.visible=false;for(const [k] of p.transoms)this.frames.setMatrixAt(k,this.zero);this.frames.instanceMatrix.needsUpdate=true;
    bursts.push(this.toWorld(Math.sin(p.a)*(R+.4),HALL.gallery*.6,R+Math.cos(p.a)*(R+.4)));}}
  return bursts;
 }
}
