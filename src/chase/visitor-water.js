import * as T from 'three';
import {Water} from 'three/addons/objects/Water.js';
import {seededRandom,canvasTexture} from './visitor-materials.js';

export function createVisitorPond(root,m){
 const random=seededRandom(1486);
 const outline=[[-7,-48],[-14,-53],[-31,-54],[-42,-46],[-44,-29],[-36,-13],[-23,-10],[-12,-19],[-7,-32]];
 const curve=new T.CatmullRomCurve3(outline.map(([x,z])=>new T.Vector3(x,0,z)),true,'catmullrom',.35),points=curve.getPoints(160),shape=new T.Shape();
 points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();
 const reflectionSize=matchMedia('(pointer:coarse)').matches?384:768;
 const water=new Water(new T.ShapeGeometry(shape),{textureWidth:reflectionSize,textureHeight:reflectionSize,waterNormals:m.waterNormals,sunDirection:new T.Vector3(-.45,.8,.35).normalize(),sunColor:0xd5ddc5,waterColor:0x293e2f,distortionScale:.23,fog:true});
 water.name='Visitor reflecting lily pond';water.rotation.x=-Math.PI/2;water.position.y=.035;water.material.uniforms.size.value=5;root.add(water);
 // Uneven earthen shore, with a narrow wet margin and grass beyond it.
 const bankPositions=[],bankColors=[],bankUV=[],center=new T.Vector3(-25,0,-33),rings=[0,.32,.72,1.25];
 for(let r=0;r<rings.length;r++)for(let i=0;i<points.length;i++){
  const p=points[i],dir=p.clone().sub(center).normalize(),q=p.clone().addScaledVector(dir,rings[r]);bankPositions.push(q.x,[.02,.08,.15,-.02][r],q.z);bankUV.push(i/points.length,r/3);const color=new T.Color([0x3c4230,0x565441,0x68644e,0x4b5a35][r]);bankColors.push(color.r,color.g,color.b);
 }
 const indices=[];for(let r=0;r<3;r++)for(let i=0;i<points.length-1;i++){const a=r*points.length+i,b=a+points.length;indices.push(a,b,a+1,a+1,b,b+1);}
 const bankGeo=new T.BufferGeometry();bankGeo.setAttribute('position',new T.Float32BufferAttribute(bankPositions,3));bankGeo.setAttribute('color',new T.Float32BufferAttribute(bankColors,3));bankGeo.setAttribute('uv',new T.Float32BufferAttribute(bankUV,2));bankGeo.setIndex(indices);bankGeo.computeVertexNormals();root.add(new T.Mesh(bankGeo,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1})));
 const lilyMap=canvasTexture(256,(c,s)=>{
  const g=c.createRadialGradient(128,128,4,128,128,128);g.addColorStop(0,'#69834b');g.addColorStop(.65,'#44683d');g.addColorStop(1,'#29492e');c.fillStyle=g;c.fillRect(0,0,s,s);
  for(let i=0;i<26;i++){const a=i*Math.PI*2/26;c.strokeStyle='#abc47748';c.lineWidth=i%2?.7:1.2;c.beginPath();c.moveTo(128,128);c.quadraticCurveTo(128+Math.sin(a+.10)*60,128+Math.cos(a+.10)*60,128+Math.sin(a)*128,128+Math.cos(a)*128);c.stroke();}
 });
 const leafPositions=[0,.012,0],uv=[.5,.5],leafIndices=[];
 for(let i=0;i<=36;i++){const a=.16+i/36*(Math.PI*2-.32),r=1+.025*Math.sin(i*3);leafPositions.push(Math.sin(a)*r,.015*Math.sin(a*3),Math.cos(a)*r);uv.push(.5+Math.sin(a)*.5,.5+Math.cos(a)*.5);if(i)leafIndices.push(0,i+1,i);}
 const lilyGeo=new T.BufferGeometry();lilyGeo.setAttribute('position',new T.Float32BufferAttribute(leafPositions,3));lilyGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));lilyGeo.setIndex(leafIndices);lilyGeo.computeVertexNormals();
 const lilies=new T.InstancedMesh(lilyGeo,new T.MeshStandardMaterial({map:lilyMap,roughness:.46,side:T.DoubleSide}),210),dummy=new T.Object3D();
 for(let i=0;i<210;i++){
  const a=random()*Math.PI*2,r=.3+Math.sqrt(random())*.65,x=-25+Math.sin(a)*r*14,z=-33+Math.cos(a)*r*19;
  dummy.position.set(x,.07+random()*.014,z);dummy.rotation.set(0,random()*Math.PI*2,0);const s=.17+random()*.4;dummy.scale.set(s,1,s*(.85+random()*.2));dummy.updateMatrix();lilies.setMatrixAt(i,dummy.matrix);
 }lilies.name='Notched and veined water lily leaves';root.add(lilies);
 const petals=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshStandardMaterial({color:0xe9d2d3,roughness:.67}),180);
 for(let f=0;f<15;f++){
  const a=f*2.4,x=-25+Math.sin(a)*8,z=-33+Math.cos(a)*13;
  for(let p=0;p<12;p++){const theta=p*Math.PI/6;dummy.position.set(x+Math.sin(theta)*.09,.16,z+Math.cos(theta)*.09);dummy.rotation.set(Math.cos(theta)*.65,theta,Math.sin(theta)*-.65);dummy.scale.set(.037,.12,.07);dummy.updateMatrix();petals.setMatrixAt(f*12+p,dummy.matrix);}
 }root.add(petals);
 const stones=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),m.rock,52);
 for(let i=0;i<52;i++){const p=curve.getPoint(i/52);dummy.position.set(p.x,.10,p.z);dummy.rotation.set(random(),random()*6,random());dummy.scale.set(.18+random()*.32,.10+random()*.15,.18+random()*.3);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);}stones.castShadow=stones.receiveShadow=true;root.add(stones);
 return {water,reflectionSize,update(time){water.material.uniforms.time.value=time*.32;}};
}
