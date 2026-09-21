import * as T from 'three';
import {box,cylinder as cyl,tube,sphere,mergeStatic} from './vehicle-geometry.js';
import {addParkLivery} from './park-livery.js';
import {createMountedGun} from './mounted-gun.js';
import {createParkDriver} from './park-driver.js';
import {defeatPose} from './defeat.js';
import {victoryPose} from './victory.js';
export function createJeep(scene){
 const jeep=new T.Group(),body=new T.Group();jeep.add(body);scene.add(jeep);
 const paint=new T.MeshStandardMaterial({color:0xc7b88e,metalness:.23,roughness:.58});
 const edge=new T.MeshStandardMaterial({color:0x788070,metalness:.65,roughness:.4});
 const black=new T.MeshStandardMaterial({color:0x161b19,metalness:.2,roughness:.62});
 const rubber=new T.MeshStandardMaterial({color:0x191b18,roughness:.97});
 const steel=new T.MeshStandardMaterial({color:0x37403e,metalness:.85,roughness:.34});
 const fabric=new T.MeshStandardMaterial({color:0x4a4c35,roughness:1});
 const accent=new T.MeshStandardMaterial({color:0xb42b21,metalness:.25,roughness:.46});
 const metalCanvas=document.createElement('canvas');metalCanvas.width=metalCanvas.height=512;const mc=metalCanvas.getContext('2d');mc.fillStyle='#deded6';mc.fillRect(0,0,512,512);let seed=781;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};for(let i=0;i<30000;i++){const n=155+rnd()*80;mc.fillStyle=`rgba(${n},${n},${n},.22)`;mc.fillRect(rnd()*512,rnd()*512,rnd()*2+.3,rnd()*2+.3);}for(let i=0;i<130;i++){mc.strokeStyle=`rgba(40,40,40,${rnd()*.2})`;mc.lineWidth=.5;mc.beginPath();const x=rnd()*512,y=rnd()*512;mc.moveTo(x,y);mc.lineTo(x+rnd()*23,y+rnd()*3);mc.stroke();}const metalMap=new T.CanvasTexture(metalCanvas);metalMap.colorSpace=T.SRGBColorSpace;metalMap.anisotropy=4;for(const mat of [paint,black,steel,edge]){mat.map=metalMap;mat.bumpMap=metalMap;mat.bumpScale=.0015;mat.roughnessMap=metalMap;}
 const glass=new T.MeshPhysicalMaterial({color:0xabc8ba,metalness:0,roughness:.14,transparent:true,opacity:.23,side:T.DoubleSide});
 const red=new T.MeshStandardMaterial({color:0x8e241b,emissive:0xff361c,emissiveIntensity:.9,roughness:.22});
 // Open Wrangler body, rear tub, wheel arches, bumpers and cage.
 box(body,black,[1.78,.2,3.85],[0,.54,0]);box(body,paint,[1.81,.22,3.5],[0,.78,.05]);
 for(const s of [-1,1]){box(body,paint,[.14,.61,2.68],[s*.88,1.06,.54]);box(body,edge,[.17,.055,2.7],[s*.88,1.38,.54]);box(body,paint,[.12,.57,.95],[s*.88,1.15,-1.31]);box(body,black,[.23,.08,1.7],[s*1.02,.65,-.06]);box(body,paint,[.38,.09,1.12],[s*.94,1.0,-1.12]);box(body,paint,[.36,.1,1.13],[s*.95,1.1,1.15]);box(body,black,[.24,.12,.82],[s*1.01,.97,1.16]);
  tube(body,black,[s*.78,1.24,1.32],[s*.78,2.44,.70],.061);tube(body,black,[s*.78,2.44,.70],[s*.78,2.43,-.60],.061);tube(body,black,[s*.78,2.43,-.60],[s*.83,1.35,-1.00],.053);tube(body,black,[s*.78,2.43,.70],[s*.80,1.32,-.35],.048);
  for(let z=-.9;z<1.65;z+=.32)cyl(body,steel,.022,.022,.02,[s*.965,1.31,z],[0,0,Math.PI/2],6);
  box(body,red,[.19,.23,.08],[s*.68,1.11,1.86]);box(body,black,[.25,.3,.07],[s*.68,1.11,1.80]);
 }
 const rearCrossbar=new T.Group();body.add(rearCrossbar);tube(rearCrossbar,black,[-.78,2.44,.70],[.78,2.44,.70],.065);tube(body,black,[-.78,2.43,-.60],[.78,2.43,-.60],.055);
 box(body,paint,[1.75,.51,.14],[0,1.03,1.78]);box(body,black,[2.08,.19,.18],[0,.67,1.99]);box(body,steel,[.42,.14,.12],[0,.56,2.0]);
 for(const s of [-1,1]){tube(body,steel,[s*.73,.64,2.08],[s*.73,.50,2.11],.035);tube(body,steel,[s*.73,.50,2.11],[s*.61,.5,2.11],.035);}
 box(body,paint,[1.71,.18,1.12],[0,1.30,-1.31]);box(body,paint,[1.72,.56,.16],[0,1.0,-1.89]);box(body,black,[2.0,.16,.25],[0,.66,-2.04]);
 for(let i=-3;i<=3;i++)box(body,black,[.105,.39,.02],[i*.158,1.06,-1.98]);
 const lens=new T.MeshStandardMaterial({color:0xe9e3c9,emissive:0xe6bf7c,emissiveIntensity:.22,metalness:.18,roughness:.22});
 for(const s of [-1,1]){box(body,black,[.34,.28,.07],[s*.655,1.12,-1.985]);box(body,edge,[.30,.247,.03],[s*.655,1.12,-2.029]);box(body,lens,[.263,.208,.026],[s*.655,1.12,-2.048]);for(let i=-4;i<=4;i++)box(body,edge,[.004,.197,.004],[s*.655+i*.025,1.12,-2.063]);}
 box(body,glass,[1.59,.74,.018],[0,1.89,-.96],[.18,0,0]);tube(body,paint,[-.85,1.45,-1.03],[-.80,2.28,-.87],.04);tube(body,paint,[.85,1.45,-1.03],[.80,2.28,-.87],.04);tube(body,paint,[-.80,2.28,-.87],[.80,2.28,-.87],.04);
 // Seats with separate cushions, straps, dashboard and steering wheel.
 for(const s of [-1,1]){box(body,fabric,[.62,.15,.56],[s*.43,1.02,-.43]);box(body,fabric,[.64,.64,.16],[s*.43,1.36,-.14],[.10,0,0]);box(body,black,[.035,.58,.035],[s*.43+.13,1.4,-.04]);box(body,fabric,[.37,.22,.13],[s*.43,1.78,-.10]);}
 box(body,black,[1.63,.3,.23],[0,1.4,-.95]);
 box(body,paint,[.42,.55,.24],[-.59,1.1,1.57]);box(body,black,[.43,.05,.25],[-.59,1.30,1.57]);tube(body,edge,[-.7,1.43,1.57],[-.46,1.43,1.57],.026);
 const wheels=[];
 function wheel(parent,x,y,z,spare=false){const group=new T.Group();group.position.set(x,y,z);if(spare)group.rotation.y=Math.PI/2;parent.add(group);cyl(group,rubber,.43,.43,.32,[0,0,0],[0,0,Math.PI/2],32);cyl(group,accent,.27,.27,.335,[0,0,0],[0,0,Math.PI/2],24);cyl(group,black,.12,.12,.36,[0,0,0],[0,0,Math.PI/2]);for(let i=0;i<30;i++){const a=i/30*Math.PI*2;for(const r of [-1,1])box(group,rubber,[.16,.065,.12],[r*.085,Math.sin(a)*.43,Math.cos(a)*.43],[a,0,r*.13]);}for(let i=0;i<8;i++){const a=i*Math.PI/4;for(const side of [-1,1])cyl(group,black,.042,.042,.006,[side*.17,Math.sin(a)*.205,Math.cos(a)*.205],[0,0,Math.PI/2],10);}for(let i=0;i<5;i++){const a=i*6.28/5;cyl(group,edge,.028,.028,.35,[0,Math.sin(a)*.15,Math.cos(a)*.15],[0,0,Math.PI/2],6);}mergeStatic(group);return group;}
 for(const x of [-1,1])for(const z of [-1.16,1.16])wheels.push(wheel(jeep,x,.49,z));wheel(body,0,1.17,1.98,true);
 const mats={paint,accent,edge,black,rubber,steel,fabric,glass};addParkLivery(body,mats);
 const driver=createParkDriver(body,mats);
 const weapon=createMountedGun(body,scene,mats),{gun,yaw,muzzle,flash}=weapon;
 // A clothed gunner gives the external camera a clear human scale.
 const gunner=new T.Group();body.add(gunner);box(gunner,fabric,[.45,.58,.26],[0,1.75,-.21]);box(gunner,black,[.43,.39,.12],[0,1.78,-.04]);sphere(gunner,new T.MeshStandardMaterial({color:0x96775a,roughness:.9}),.16,[0,2.19,-.17],[.83,1.15,.85]);sphere(gunner,paint,.19,[0,2.28,-.17],[1,.75,1]);for(const s of [-1,1]){tube(gunner,fabric,[s*.16,1.48,-.2],[s*.22,.93,-.07],.095);box(gunner,black,[.14,.12,.26],[s*.22,.85,.01]);}
 gunner.position.z=.88;
 mergeStatic(body);mergeStatic(gunner);
 function reset(){jeep.position.set(0,0,0);jeep.rotation.set(0,0,0);body.position.set(0,0,0);body.rotation.set(0,0,0);weapon.reset();}
 function pose(time,speed,state){
  const fatal=state.result==='lost'&&state.defeat?defeatPose(state.defeat.time,state.defeat):null;
  const arrival=state.result==='won'&&state.victory?victoryPose(state.victory.time,state.distance):null,travel=arrival||fatal;
  jeep.position.set(travel?.jeepX||0,0,travel?.jeepZ||0);jeep.rotation.set(0,travel?.jeepYaw||0,0);
  const bounce=Math.min(1,speed/5);body.position.y=(Math.sin(time*18)*.013+Math.sin(time*29)*.007)*bounce;body.rotation.z=Math.sin(time*7)*.006*bounce+(fatal?.jeepRoll||0);body.rotation.x=Math.sin(time*11)*.004*bounce+(fatal?.jeepPitch||0);jeep.updateMatrixWorld(true);
 }
 return{root:jeep,body,muzzle,gun,yaw,gunner,driver,flash,weapon,pose,shoot:weapon.shoot,reset,update(dt,time,speed,aim,third,state){
  rearCrossbar.visible=third;
  pose(time,speed,state);
  for(const w of wheels)w.rotation.x+=speed*dt/.43;
  gunner.visible=third;driver.update(dt,time,speed,third);weapon.update(dt,time,speed,aim,third,state);
 }};
}
