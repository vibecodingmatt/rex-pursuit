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
  const paneMat=new T.MeshStandardMaterial({color:0x8fb0c2,emissive:0x060d14,roughness:.08,metalness:.3,envMapIntensity:.7,transparent:true,opacity:.2,depthWrite:false,side:T.DoubleSide});
  this.frames=new T.InstancedMesh(new T.BoxGeometry(1,1,1),metal,n*2+n+1);this.frames.castShadow=true;root.add(this.frames);
  const o=new T.Object3D(),put=(i,a,y,sx,sy,sz)=>{o.position.set(Math.sin(a)*(R+.4),y,R+Math.cos(a)*(R+.4));o.rotation.set(0,a,0);o.scale.set(sx,sy,sz);o.updateMatrix();this.frames.setMatrixAt(i,o.matrix);return o.matrix.clone();};
  for(let i=0;i<=n;i++)put(i,-g+i*step,G/2,.16,G,.24);
  for(let i=0;i<n;i++){const a=-g+(i+.5)*step,pane=add(new T.BoxGeometry(chord-.14,G-.2,.04),paneMat,[Math.sin(a)*(R+.4),G/2,R+Math.cos(a)*(R+.4)],[0,a,0],false);pane.renderOrder=2;
   this.panes.push({mesh:pane,a,broken:false,transoms:[[n+1+i*2,put(n+1+i*2,a,3.2,chord,.12,.18)],[n+2+i*2,put(n+2+i*2,a,6.4,chord,.12,.18)]]});}
  this.inside=false;this.local=new T.Vector3();this.world=new T.Vector3();this.zero=new T.Matrix4().makeScale(0,0,0);
 }
 /** Stand the hall at the doors' floor point, facing along the route's heading. */
 place(origin,heading){this.root.position.copy(origin);this.root.rotation.set(0,heading,0);this.root.updateMatrixWorld(true);}
 /** A hall-frame point in world space. */
 toWorld(x,y,z,out=new T.Vector3()){return out.set(x,y,z).applyMatrix4(this.root.matrixWorld);}
 reset(){for(const p of this.panes){p.broken=false;p.mesh.visible=true;for(const [k,m] of p.transoms)this.frames.setMatrixAt(k,m);}this.frames.instanceMatrix.needsUpdate=true;}
 /** Break any pane a king's head (world x, z) reaches from outside; returns the burst points for glass.js. */
 breach(heads){
  const bursts=[],inv=this.inverse??=new T.Matrix4();inv.copy(this.root.matrixWorld).invert();
  for(const h of heads){const l=this.local.set(h.x,0,h.z).applyMatrix4(inv),wall=R+Math.sqrt(Math.max(0,(R+.4)**2-l.x*l.x));if(l.z>wall+1||l.z<wall-6)continue;
   for(const p of this.panes){if(p.broken||Math.abs(Math.sin(p.a)*(R+.4)-l.x)>2.6)continue;p.broken=true;p.mesh.visible=false;for(const [k] of p.transoms)this.frames.setMatrixAt(k,this.zero);this.frames.instanceMatrix.needsUpdate=true;
    bursts.push(this.toWorld(Math.sin(p.a)*(R+.4),HALL.gallery*.6,R+Math.cos(p.a)*(R+.4)));}}
  return bursts;
 }
}
