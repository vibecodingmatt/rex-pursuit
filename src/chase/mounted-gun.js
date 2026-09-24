import * as T from 'three';
import {box, cylinder as cyl, tube, mergeStatic, canvasDecal} from './vehicle-geometry.js';
import {RULES} from './combat.js';
import {DEFEAT} from './defeat.js';
import {createGunnerArms} from './gunner-arms.js';

const PITCH=.034, CAPACITY=22;
const smooth=(x,a,b)=>T.MathUtils.smoothstep(x,a,b);
const pulse=(x,a,b,c,d)=>smooth(x,a,b)*(1-smooth(x,c,d));

// The belt and the two ejecta streams are driven by accepted game shots.
// No time-based scrolling: releasing the trigger leaves the belt in its new position.
export function createMountedGun(body,scene,mats,character){
 const {black,steel}=mats;
 const finish=new T.MeshStandardMaterial({color:0x202724,metalness:.52,roughness:.59,map:steel.map,bumpMap:steel.bumpMap,bumpScale:.001});
 const worn=new T.MeshStandardMaterial({color:0x525950,metalness:.7,roughness:.47});
 const brass=new T.MeshStandardMaterial({color:0xb39857,metalness:.78,roughness:.32});
 const copper=new T.MeshStandardMaterial({color:0x87634a,metalness:.76,roughness:.37});
 const canPaint=new T.MeshStandardMaterial({color:0x697057,metalness:.28,roughness:.68});
 cyl(body,steel,.065,.11,1.15,[0,1.29,1.43],[0,0,0]);cyl(body,black,.22,.22,.09,[0,.79,1.43],[0,0,0]);
 const yaw=new T.Group();yaw.position.set(0,1.93,1.43);body.add(yaw);
 const gun=new T.Group();yaw.add(gun);
 const receiver=new T.Group();gun.add(receiver);
 box(gun,finish,[.35,.075,.3],[0,-.185,.10]);
 for(const s of [-1,1]){box(gun,finish,[.038,.21,.21],[s*.162,-.085,.11]);cyl(gun,worn,.055,.055,.02,[s*.185,-.012,.11],[0,0,Math.PI/2]);}
 box(receiver,finish,[.25,.235,.73],[0,0,.06]);
 box(receiver,black,[.256,.025,.68],[0,-.124,.06]);
 for(const s of [-1,1]){
  box(receiver,finish,[.014,.16,.62],[s*.134,.006,.06]);
  for(const z of [-.21,.01,.28])cyl(receiver,worn,.013,.013,.008,[s*.145,.055,z],[0,0,Math.PI/2],6);
  tube(receiver,finish,[s*.11,-.025,-.31],[s*.225,-.02,-.46],.026);
  cyl(receiver,black,.036,.036,.19,[s*.225,-.05,-.46],[0,0,0]);
  cyl(receiver,worn,.037,.037,.013,[s*.225,.05,-.46],[0,0,0]);
 }
 // Open feed tray and a separate hinged cover, rather than a solid receiver block.
 box(receiver,black,[.24,.008,.47],[0,.122,.035]);
 for(const s of [-1,1])box(receiver,worn,[.015,.025,.47],[s*.106,.133,.035]);
 for(let i=0;i<5;i++)cyl(receiver,worn,.018,.018,.20,[0,.138,-.13+i*.071],[0,0,Math.PI/2]);
 const cover=new T.Group();cover.position.set(0,.14,.35);receiver.add(cover);
 box(cover,finish,[.28,.039,.63],[0,.025,-.315]);box(cover,black,[.21,.017,.46],[0,-.006,-.31]);
 box(cover,worn,[.09,.021,.034],[0,.05,-.61]);cyl(cover,worn,.025,.025,.29,[0,0,0],[0,0,Math.PI/2]);
 for(const s of [-1,1])box(cover,finish,[.015,.066,.025],[s*.038,.077,-.39]);
 box(cover,finish,[.091,.016,.026],[0,.114,-.39]);box(cover,black,[.074,.014,.032],[0,.049,-.39]);
 const aperture=new T.Mesh(new T.TorusGeometry(.012,.003,7,16),finish);aperture.position.set(0,.079,-.39);cover.add(aperture);
 const coverFinish=canvasDecal(cover,512,1024,(c,w,h)=>{
  c.fillStyle='#313a35';c.fillRect(0,0,w,h);let n=142;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  for(let i=0;i<12000;i++){c.fillStyle=rand()>.5?'#3d453c':'#262c28';c.globalAlpha=.35;c.fillRect(rand()*w,rand()*h,rand()*3+1,rand()*3+1);}c.globalAlpha=1;
  c.strokeStyle='#5b6458';c.lineWidth=3;c.strokeRect(9,10,w-18,h-20);c.strokeStyle='#151d18';c.lineWidth=6;c.strokeRect(30,250,w-60,480);
  c.fillStyle='#a2a592';c.textAlign='center';c.font='bold 35px monospace';c.fillText('CAL .50',w/2,535);c.font='23px monospace';c.fillText('JP • FIELD 18',w/2,581);c.font='18px monospace';c.fillText('ISLA NUBLAR',w/2,620);
  for(const x of [47,w-47])for(const y of [44,h-44]){c.fillStyle='#141b16';c.beginPath();c.arc(x,y,13,0,7);c.fill();c.strokeStyle='#687060';c.lineWidth=3;c.beginPath();c.moveTo(x-7,y);c.lineTo(x+7,y);c.stroke();}
 },[.255,.602],[0,.048,-.315],[-Math.PI/2,0,Math.PI]);coverFinish.material.roughness=.76;coverFinish.material.metalness=.22;
 for(const s of [-1,1])box(cover,finish,[.013,.009,.36],[s*.103,.049,-.29]);
 // Jacket slots are inset between raised rails, with a continuous inner barrel.
 const barrel=new T.Group();receiver.add(barrel);
 cyl(barrel,black,.046,.056,1.72,[0,.008,1.17]);
 cyl(barrel,finish,.077,.082,.12,[0,.008,.46]);
 for(let i=0;i<8;i++){
  cyl(barrel,finish,.068,.071,.038,[0,.008,.55+i*.076]);
  for(let a=0;a<6;a++){const angle=a*Math.PI/3;box(barrel,finish,[.018,.018,.074],[Math.sin(angle)*.061,.008+Math.cos(angle)*.061,.585+i*.076],[0,0,-angle]);}
 }
 cyl(barrel,finish,.039,.046,.89,[0,.008,1.535]);
 cyl(barrel,worn,.043,.043,.028,[0,.008,1.981]);
 cyl(barrel,black,.027,.027,.009,[0,.008,2.002]);
 box(barrel,finish,[.083,.14,.038],[0,.10,1.83]);box(barrel,black,[.026,.025,.04],[0,.17,1.83]);
 const charging=new T.Group();charging.position.set(-.166,.014,-.13);receiver.add(charging);
 box(charging,worn,[.015,.045,.22],[0,0,.035]);tube(charging,finish,[0,0,-.025],[-.073,0,-.025],.019);cyl(charging,black,.027,.027,.074,[-.087,0,-.025],[0,0,0]);
 box(receiver,black,[.018,.043,.30],[-.147,.014,-.04]);
 // Ammo can on the viewer's left (+X while looking aft), with an open mouth.
 const can=new T.Group();can.position.set(.59,-.20,.04);gun.add(can);
 box(can,canPaint,[.35,.29,.31],[0,-.015,0]);box(can,black,[.29,.011,.254],[0,.136,0]);
 for(const s of [-1,1]){box(can,worn,[.016,.027,.32],[s*.172,.145,0]);box(can,canPaint,[.012,.22,.20],[s*.18,-.01,0]);}
 for(const z of [-.15,.15])box(can,canPaint,[.35,.03,.018],[0,.146,z]);
 tube(can,finish,[-.1,.0,-.18],[.1,.0,-.18],.013);for(const s of [-1,1])tube(can,finish,[s*.1,0,-.18],[s*.1,.075,-.16],.012);
 box(can,worn,[.055,.095,.018],[0,.04,-.167]);
 canvasDecal(can,512,256,c=>{c.fillStyle='#c8c2a0';c.font='bold 42px monospace';c.textAlign='center';c.fillText('CAL .50',256,77);c.font='25px monospace';c.fillText('80 ROUNDS • LINKED',256,127);c.font='23px monospace';c.fillText('JP / FIELD SUPPLY',256,173);},[.275,.137],[0,0,-.166],[0,Math.PI,0]);
 box(gun,finish,[.47,.035,.35],[.47,-.37,.04]);box(gun,finish,[.025,.18,.28],[.275,-.275,.04]);

 const beltPath=new T.CatmullRomCurve3([new T.Vector3(.60,-.17,.04),new T.Vector3(.59,-.035,.04),new T.Vector3(.51,.135,.05),new T.Vector3(.34,.145,.05),new T.Vector3(.105,.093,.05)]);
 const beltLength=beltPath.getLength();
 const cartridge=new T.Group();
 cyl(cartridge,brass,.0105,.0118,.108,[0,0,-.008]);cyl(cartridge,brass,.0118,.0118,.009,[0,0,-.064]);
 cyl(cartridge,brass,.0077,.0105,.019,[0,0,.055]);cyl(cartridge,copper,.0015,.0077,.035,[0,0,.082]);
 cyl(cartridge,copper,.0045,.0045,.001,[0,0,-.069]);
 box(cartridge,finish,[.026,.020,.019],[0,0,-.025]);box(cartridge,finish,[.038,.007,.010],[.008,-.01,-.034]);
 mergeStatic(cartridge);
 const beltParts=cartridge.children.map(m=>{const inst=new T.InstancedMesh(m.geometry,m.material,CAPACITY);inst.instanceMatrix.setUsage(T.DynamicDrawUsage);inst.frustumCulled=false;inst.castShadow=true;gun.add(inst);return inst;});
 // Reuse real shell/link silhouettes for the pooled ejection, not glowing dots.
 const shellShape=new T.Group();cyl(shellShape,brass,.0105,.0118,.108,[0,0,-.008]);cyl(shellShape,brass,.0118,.0118,.009,[0,0,-.064]);cyl(shellShape,brass,.0078,.0105,.019,[0,0,.055]);cyl(shellShape,black,.0069,.0069,.001,[0,0,.065]);mergeStatic(shellShape);
 const linkGeo=new T.TorusGeometry(.012,.003,5,9,Math.PI*1.65);linkGeo.rotateY(Math.PI/2);
 const dummy=new T.Object3D(), hidden=new T.Matrix4().makeScale(0,0,0);
 function pool(templates,count){const meshes=templates.map(m=>{const mesh=new T.InstancedMesh(m.geometry,m.material,count);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=true;scene.add(mesh);return mesh;});return{meshes,items:Array.from({length:count},()=>({age:-1,p:new T.Vector3(),v:new T.Vector3(),q:new T.Quaternion(),spin:new T.Vector3(),bounces:0})),cursor:0};}
 const cases=pool(shellShape.children,48),links=pool([{geometry:linkGeo,material:finish}],48);
 const casePort=new T.Object3D();casePort.position.set(-.07,-.135,-.10);receiver.add(casePort);
 const linkPort=new T.Object3D();linkPort.position.set(-.148,.09,.05);receiver.add(linkPort);
 const stats={shots:0,cases:0,links:0,feedDistance:0};
 let seed=419;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 function eject(stream,port,isCase){const p=stream.items[stream.cursor++%stream.items.length];port.getWorldPosition(p.p);port.getWorldQuaternion(p.q);p.v.set(isCase?-.65-random()*.6:-1.2-random()*.7,isCase?-.55: .35+random()*.4,random()*.6-.3).applyQuaternion(p.q);p.spin.set((random()-.5)*20,(random()-.5)*25,(random()-.5)*15);p.age=0;p.bounces=0;stats[isCase?'cases':'links']++;}
 function updatePool(stream,dt){for(let i=0;i<stream.items.length;i++){const p=stream.items[i];if(p.age<0){for(const m of stream.meshes)m.setMatrixAt(i,hidden);continue;}p.age+=dt;if(p.age>2.4){p.age=-1;for(const m of stream.meshes)m.setMatrixAt(i,hidden);continue;}p.v.y-=9.81*dt;p.v.z+=dt*2.6;p.p.addScaledVector(p.v,dt);const inTub=Math.abs(p.p.x)<.82&&p.p.z>-.02&&p.p.z<1.76;const floor=inTub?.91:.025;if(p.p.y<floor&&p.v.y<0){p.p.y=floor;p.v.y*=-.24;p.v.x*=.7;p.v.z*=.65;p.spin.multiplyScalar(.55);p.bounces++;}dummy.position.copy(p.p);dummy.quaternion.copy(p.q);dummy.rotateX(p.spin.x*dt);dummy.rotateY(p.spin.y*dt);dummy.rotateZ(p.spin.z*dt);p.q.copy(dummy.quaternion);dummy.scale.setScalar(1);dummy.updateMatrix();for(const m of stream.meshes)m.setMatrixAt(i,dummy.matrix);}for(const m of stream.meshes)m.instanceMatrix.needsUpdate=true;}

 const armRig=createGunnerArms(gun,body,mats,character),hands=armRig.root;
 const muzzle=new T.Object3D();muzzle.position.set(0,.008,2.025);barrel.add(muzzle);
 const flash=new T.Group();muzzle.add(flash);const glow=new T.MeshBasicMaterial({color:0xffce76,transparent:true,opacity:.72,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});glow.color.setRGB(7,4.2,1.6);
 for(let i=0;i<3;i++){const m=new T.Mesh(new T.ConeGeometry(.095,.43,5),glow);m.rotation.x=Math.PI/2;m.rotation.z=i*2.1;m.position.z=.15;flash.add(m);}flash.visible=false;
 const light=new T.PointLight(0xffb566,0,9,2);muzzle.add(light);
 for(const g of [receiver,barrel,cover,charging,can,gun])mergeStatic(g);
 let shotAge=10,feed=0,feedFrom=0,feedTarget=0,reloading=false,reloadProgress=0,beltVisibility=1,beltJiggle=0;
 const pending=[];
 const flight={velocity:new T.Vector3(),spin:new T.Vector3(),age:0,landed:false};let detached=false;
 function detach(){
  gun.updateWorldMatrix(true,true);scene.attach(yaw);detached=true;flight.age=0;flight.landed=false;
  flight.velocity.set(-4.8,6.2,2.5);flight.spin.set(3.8,2.0,-4.6);hands.visible=false;flash.visible=false;light.intensity=0;pending.length=0;
 }
 function tumble(dt,speed){
  flight.age+=dt;flight.velocity.y-=9.81*dt;yaw.position.addScaledVector(flight.velocity,dt);yaw.position.z+=speed*dt*.45;
  yaw.rotateX(flight.spin.x*dt);yaw.rotateY(flight.spin.y*dt);yaw.rotateZ(flight.spin.z*dt);
  if(yaw.position.y<.34&&flight.velocity.y<0){yaw.position.y=.34;flight.velocity.y*=-.19;flight.velocity.x*=.48;flight.velocity.z*=.48;flight.spin.multiplyScalar(.38);flight.landed=true;}
  if(flight.landed){flight.velocity.x*=Math.exp(-dt*3);flight.velocity.z*=Math.exp(-dt*3);flight.spin.multiplyScalar(Math.exp(-dt*4));}
 }
 function shoot(){feedFrom=feed;feedTarget+=PITCH;shotAge=0;beltJiggle=1;pending.push(.023);stats.shots++;flash.rotation.z=random()*Math.PI*2;}
 function reset(){body.add(yaw);yaw.position.set(0,1.93,1.43);yaw.rotation.set(0,0,0);gun.rotation.set(0,0,0);hands.visible=true;detached=false;flight.age=0;flight.landed=false;shotAge=10;feed=feedFrom=feedTarget=0;reloading=false;reloadProgress=0;beltVisibility=1;beltJiggle=0;pending.length=0;cover.rotation.x=0;can.position.set(.59,-.20,.04);can.rotation.set(0,0,0);charging.position.z=-.13;receiver.position.z=0;barrel.position.z=0;flash.visible=false;light.intensity=0;for(const k of Object.keys(stats))stats[k]=0;for(const p of [cases,links]){p.cursor=0;for(const item of p.items)item.age=-1;updatePool(p,0);}}
 function update(dt,time,speed,aim,third,state){
  if(state.result==='lost'&&state.defeat?.time>=DEFEAT.ram&&!detached)detach();
  if(detached){tumble(dt,speed);updatePool(cases,dt);updatePool(links,dt);return;}
  const activeReload=state.reload>0&&!state.result;
  if(reloading&&!activeReload){feed=feedFrom=feedTarget=0;beltVisibility=1;}
  reloading=activeReload;reloadProgress=reloading?1-state.reload/RULES.reload:0;
  const p=reloadProgress;
  cover.rotation.x=1.30*pulse(p,.05,.26,.75,.85);
  const canLift=pulse(p,.29,.44,.48,.64);can.position.set(.59+canLift*.10,-.20-canLift*.59,.04-canLift*.14);can.rotation.z=-canLift*.22;
  beltVisibility=reloading?1-pulse(p,.22,.36,.62,.77):1;
  charging.position.z=-.13-.15*pulse(p,.88,.92,.94,.97);
  shotAge+=dt;feed=T.MathUtils.lerp(feedFrom,feedTarget,smooth(shotAge,0,.071));stats.feedDistance=feed;
  beltJiggle*=Math.exp(-dt*12);
  const kick=shotAge<.12?Math.sin(Math.min(1,shotAge/.025)*Math.PI/2)*Math.exp(-Math.max(0,shotAge-.025)*36):0;
  receiver.position.z=-kick*.033;barrel.position.z=-kick*.017;
  flash.visible=shotAge<.027;light.intensity=flash.visible?11*(light.userData.boost||1):0;
  const local=body.worldToLocal(aim.clone()).sub(yaw.position);
  const reloadCenter=third&&reloading?pulse(p,0,.12,.86,1):0;
  yaw.rotation.y=T.MathUtils.damp(yaw.rotation.y,T.MathUtils.clamp(Math.atan2(local.x,local.z),-.68,.68)*(1-reloadCenter),26,dt);
  const pitch=-Math.atan2(local.y,Math.hypot(local.x,local.z));gun.rotation.x=T.MathUtils.damp(gun.rotation.x,(T.MathUtils.clamp(pitch,-.42,.32)+(reloading?.10:0))*(1-reloadCenter),26,dt);
  gun.updateWorldMatrix(true,true);
  for(let i=pending.length-1;i>=0;i--){pending[i]-=dt;if(pending[i]<=0){eject(cases,casePort,true);eject(links,linkPort,false);pending.splice(i,1);}}
  const visibleAmmo=reloading&&p>.60?RULES.magazine:(state.ammo??RULES.magazine);
  for(let i=0;i<CAPACITY;i++){
   // Slot 0 is the round nearest the receiver. The last few rounds visibly clear the can.
   const distance=beltLength-i*PITCH+feed%PITCH-(1-beltVisibility)*beltLength;
   if(distance>beltLength||distance<0||visibleAmmo===0||i>=visibleAmmo+1||beltVisibility<.01){for(const m of beltParts)m.setMatrixAt(i,hidden);continue;}
   const u=T.MathUtils.clamp(distance/beltLength,0,1),pos=beltPath.getPointAt(u),tangent=beltPath.getTangentAt(u);
   pos.y+=Math.sin(u*Math.PI)*(.004*Math.sin(time*12)+beltJiggle*.007*Math.sin(u*11-shotAge*24));
   dummy.position.copy(pos);dummy.rotation.set(0,0,Math.atan2(tangent.y,tangent.x));dummy.scale.setScalar(1);dummy.updateMatrix();for(const m of beltParts)m.setMatrixAt(i,dummy.matrix);
  }
  for(const m of beltParts)m.instanceMatrix.needsUpdate=true;
  armRig.update(p,reloading,third,cover,can,charging,receiver.position.z);
  updatePool(cases,dt);updatePool(links,dt);
 }
 reset();
 return{gun,yaw,muzzle,flash,light,barrel,hands,armRig,cover,can,barrel,receiver,charging,beltParts,cases,links,stats,flight,get detached(){return detached;},get reloadProgress(){return reloadProgress;},shoot,reset,update};
}
