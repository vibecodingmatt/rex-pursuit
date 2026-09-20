import * as T from 'three';
import {box,cylinder,tube,canvasDecal} from './vehicle-geometry.js';

function badge(c,w,h){
 c.save();c.scale(w/800,h/600);
 c.fillStyle='#111511';c.beginPath();c.arc(400,283,252,0,Math.PI*2);c.fill();
 c.strokeStyle='#ecd46c';c.lineWidth=15;c.stroke();c.fillStyle='#c33b27';c.beginPath();c.arc(400,280,232,0,Math.PI*2);c.fill();
 // A small original silhouette badge, drawn as vectors for crisp body decals.
 c.fillStyle='#121611';const rex=new Path2D('M152 282 Q235 324 307 287 Q334 238 402 241 L441 193 L436 157 L477 122 L532 125 L578 150 L606 171 L601 195 L556 202 L528 197 L552 218 L585 215 L576 234 L534 239 L496 215 L479 242 L475 285 L458 314 L477 354 L468 383 L493 402 L446 402 L423 379 L434 349 L410 328 L389 347 L374 385 L397 401 L349 401 L344 382 L359 327 L326 315 Q234 341 152 282 Z');c.fill(rex);
 c.strokeStyle='#121611';c.lineWidth=13;c.lineCap='round';c.beginPath();c.moveTo(470,253);c.lineTo(506,272);c.lineTo(518,290);c.moveTo(502,270);c.lineTo(522,273);c.stroke();
 c.fillStyle='#e6c46a';c.beginPath();c.ellipse(541,159,8,5,-.3,0,7);c.fill();
 for(let i=0;i<5;i++){c.beginPath();c.moveTo(546+i*10,197);c.lineTo(551+i*10,206);c.lineTo(555+i*10,198);c.fill();}
 c.fillStyle='#121611';c.fillRect(74,341,652,143);c.strokeStyle='#ecd46c';c.lineWidth=10;c.strokeRect(74,341,652,143);
 c.textAlign='center';c.textBaseline='middle';c.font='bold 81px Impact, Arial Black, sans-serif';c.fillStyle='#f1e6c6';c.fillText('JURASSIC PARK',400,410,616);
 c.font='bold 24px Arial';c.fillStyle='#ecd46c';c.fillText('ISLA NUBLAR',400,520);c.restore();
}
function sidePatch(parent,mat,side,points){
 const shape=new T.Shape();points.forEach(([z,y],i)=>i?shape.lineTo(-side*z,y):shape.moveTo(-side*z,y));shape.closePath();
 const mesh=new T.Mesh(new T.ShapeGeometry(shape),mat);mesh.position.x=side*.953;mesh.rotation.y=side*Math.PI/2;parent.add(mesh);return mesh;
}
export function addParkLivery(body,mats){
 const {accent,black,edge,paint,glass}=mats;
 for(const side of [-1,1]){
  sidePatch(body,accent,side,[[-.90,.80],[-.47,.80],[-1.12,1.44],[-1.54,1.44]]);
  sidePatch(body,accent,side,[[1.46,.78],[1.85,.78],[1.18,1.37],[.74,1.37]]);
  canvasDecal(body,800,600,badge,[.76,.52],[side*.962,1.102,.02],[0,side*Math.PI/2,0]);
  canvasDecal(body,256,200,(c,w,h)=>{c.textAlign='center';c.textBaseline='middle';c.font='bold 175px Impact, Arial Black';c.fillStyle='#a42a22';c.fillText('18',w/2,h/2);},[.35,.28],[side*.949,1.18,-1.50],[0,side*Math.PI/2,0]);
  // Hood latches, half-door hinge blocks, mirrors and a restrained dusty sill.
  box(body,black,[.025,.12,.04],[side*.88,1.32,-1.61]);box(body,edge,[.026,.034,.085],[side*.89,1.38,-1.61]);
  for(const z of [-.66,.46])box(body,edge,[.025,.09,.074],[side*.967,.97,z]);
  box(body,black,[.018,.035,.15],[side*.966,1.295,.28]);
  tube(body,black,[side*.82,1.66,-.90],[side*1.12,1.82,-.95],.018);
  box(body,accent,[.075,.27,.18],[side*1.12,1.86,-.95]);box(body,glass,[.008,.22,.14],[side*1.163,1.86,-.943]);
  canvasDecal(body,1024,128,(c,w,h)=>{let seed=11;for(let i=0;i<2100;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed/4294967296*w;seed=(seed*1664525+1013904223)>>>0;const y=seed/4294967296;const r=1+y*6;c.fillStyle=`rgba(88,65,36,${.08+y*.30})`;c.beginPath();c.ellipse(x,h-y*y*h,r,r*.62,0,0,7);c.fill();}},[2.72,.27],[side*.967,.85,.50],[0,side*Math.PI/2,0]);
 }
 // Red windshield surround is a strong silhouette cue in the external camera.
 box(body,accent,[1.74,.10,.085],[0,1.47,-1.035],[.18,0,0]);
 box(body,accent,[1.70,.075,.08],[0,2.29,-.873],[.18,0,0]);
 for(const side of [-1,1])box(body,accent,[.10,.88,.078],[side*.827,1.90,-.952],[.18,0,side*.035]);
 for(const side of [-1,1])tube(body,black,[side*.05,1.54,-1.085],[side*.61,1.74,-1.047],.012);
 canvasDecal(body,512,512,(c,w,h)=>{c.font='bold 388px Impact, Arial Black';c.fillStyle='#aa2b24';c.textAlign='center';c.textBaseline='middle';c.fillText('18',w/2,h/2);},[.61,.64],[0,1.395,-1.33],[-Math.PI/2,0,Math.PI]);
 canvasDecal(body,1024,128,(c,w,h)=>{c.fillStyle='#ecdcb4';c.textAlign='center';c.textBaseline='middle';c.font='bold 70px Arial';c.fillText('JURASSIC PARK',w/2,h/2);},[1.13,.085],[0,2.295,-.92],[0,Math.PI,0]);
 canvasDecal(body,768,256,(c,w,h)=>{c.fillStyle='#ede8c9';c.fillRect(0,0,w,h);c.fillStyle='#d8ad3f';c.fillRect(w*.65,0,w*.35,h);c.save();c.translate(28,-40);badge(c,430,322);c.restore();c.font='bold 192px Impact, Arial Black';c.fillStyle='#171b15';c.textAlign='center';c.fillText('18',w*.825,h*.79);},[.47,.157],[-.40,.68,-2.195],[0,Math.PI,0]);
 // Winch and cable fairlead, front fog lamps and amber marker lights.
 box(body,black,[.76,.10,.23],[0,.80,-2.07]);
 cylinder(body,edge,.085,.085,.39,[0,.91,-2.08],[0,0,Math.PI/2]);
 cylinder(body,black,.095,.095,.18,[.29,.91,-2.08],[0,0,Math.PI/2]);
 for(let i=0;i<17;i++){const ring=new T.Mesh(new T.TorusGeometry(.07,.008,6,18),edge);ring.rotation.y=Math.PI/2;ring.position.set(-.18+i*.022,.91,-2.08);body.add(ring);}
 box(body,edge,[.38,.09,.055],[0,.87,-2.215]);box(body,black,[.27,.029,.012],[0,.87,-2.246]);
 tube(body,accent,[0,.86,-2.26],[0,.75,-2.26],.018);
 const lamp=new T.MeshStandardMaterial({color:0xe3d9b7,emissive:0xd0bd80,emissiveIntensity:.15,roughness:.24});
 const amber=new T.MeshStandardMaterial({color:0xd76e14,roughness:.29});
 for(const side of [-1,1]){
  cylinder(body,black,.12,.12,.10,[side*.73,.88,-2.11]);cylinder(body,lamp,.097,.097,.015,[side*.73,.88,-2.17]);
  box(body,amber,[.22,.11,.026],[side*.65,.85,-1.987]);
  for(let i=-2;i<=2;i++)box(body,black,[.01,.175,.008],[side*.73+i*.031,.88,-2.185]);
 }
 // Spare cover and service tag make the rear view as recognizable as the hood.
 cylinder(body,black,.34,.34,.028,[0,1.17,2.17]);
 canvasDecal(body,800,600,badge,[.62,.49],[0,1.18,2.187],[0,0,0]);
 canvasDecal(body,512,96,(c,w,h)=>{c.fillStyle='#ded4b1';c.font='bold 51px monospace';c.fillText('JP 18  /  FIELD UNIT',8,65);},[.46,.09],[-.58,1.07,1.856],[0,0,0]);
 const antenna=tube(body,black,[-.78,1.37,1.65],[-.82,2.83,1.62],.008);antenna.name='field-radio-whip';
}
