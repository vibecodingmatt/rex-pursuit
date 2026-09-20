import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function createJungle(scene){
 let seed=7481;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const c=canvas.getContext('2d');c.fillStyle='#6e5940';c.fillRect(0,0,1024,1024);
 for(let i=0;i<125000;i++){const b=45+rand()*88;c.fillStyle=`rgba(${b*1.18},${b*.92},${b*.63},${.12+rand()*.4})`;c.fillRect(rand()*1024,rand()*1024,rand()*4+1,rand()*3+1);}
 for(const x of [388,636]){const g=c.createLinearGradient(x-76,0,x+76,0);g.addColorStop(0,'#00000000');g.addColorStop(.35,'#211a1270');g.addColorStop(.6,'#34281990');g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(x-76,0,152,1024);for(let y=0;y<1024;y+=14){c.fillStyle='#211b1328';c.fillRect(x-27,y,54,4);}}
 for(let i=0;i<2600;i++){const x=rand()*1024,y=rand()*1024,r=rand()*3+.4;c.fillStyle=rand()>.5?'#95856a70':'#231e1670';c.beginPath();c.ellipse(x,y,r,r*.5,0,0,7);c.fill();}
 const soil=new T.CanvasTexture(canvas);soil.colorSpace=T.SRGBColorSpace;soil.wrapS=soil.wrapT=T.RepeatWrapping;soil.repeat.set(1,24);soil.anisotropy=8;
 const road=new T.Mesh(new T.PlaneGeometry(10,480,1,1),new T.MeshStandardMaterial({map:soil,bumpMap:soil,bumpScale:.095,roughness:.94,color:0xa79575}));road.rotation.x=-Math.PI/2;road.position.set(0,-.025,60);road.receiveShadow=true;scene.add(road);
 const ground=new T.Mesh(new T.PlaneGeometry(220,480),new T.MeshStandardMaterial({color:0x343c24,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.06,60);ground.receiveShadow=true;scene.add(ground);
 const barkCanvas=document.createElement('canvas');barkCanvas.width=128;barkCanvas.height=512;const bc=barkCanvas.getContext('2d');bc.fillStyle='#696b51';bc.fillRect(0,0,128,512);for(let i=0;i<1100;i++){const l=25+rand()*65;bc.strokeStyle=`rgba(${l},${l*1.03},${l*.8},.6)`;bc.lineWidth=rand()*2;bc.beginPath();const x=rand()*128,y=rand()*512;bc.moveTo(x,y);bc.lineTo(x+rand()*8-4,y+rand()*120);bc.stroke();}
 const bark=new T.CanvasTexture(barkCanvas);bark.colorSpace=T.SRGBColorSpace;bark.wrapS=bark.wrapT=T.RepeatWrapping;
 const trunkMat=new T.MeshStandardMaterial({map:bark,bumpMap:bark,bumpScale:.09,roughness:1,color:0x9a9772});
 const foliage=new T.TextureLoader().load('./textures/jungle-branch.png');foliage.colorSpace=T.SRGBColorSpace;foliage.anisotropy=4;
 const leafMat=new T.MeshStandardMaterial({map:foliage,alphaTest:.46,side:T.DoubleSide,roughness:.86,color:0xa8c98d});
 const shrubMat=leafMat.clone();shrubMat.color.setHex(0x829d5d);
 const trunkGeo=new T.CylinderGeometry(.34,.56,1,14,4),leafGeo=new T.PlaneGeometry(1,1);
 const fernVertices=[];
 for(let f=0;f<9;f++){const angle=f*Math.PI*2/9;for(let i=1;i<15;i++){const u=i/15,rad=u*1.45,y=.12+Math.sin(u*Math.PI*.88)*.85;for(const side of [-1,1]){const start=new T.Vector3(Math.sin(angle)*rad,y,Math.cos(angle)*rad),dir=new T.Vector3(Math.sin(angle+side*.94),-.25,Math.cos(angle+side*.94));const length=(1-u)*.45+.045;const tip=start.clone().addScaledVector(dir,length),mid=start.clone().lerp(tip,.48);mid.y+=.025;const width=new T.Vector3(Math.cos(angle+side*.94),0,-Math.sin(angle+side*.94)).multiplyScalar(length*.105);const a=mid.clone().add(width),b=mid.clone().sub(width);for(const v of [start,a,mid,a,tip,mid,tip,b,mid,b,start,mid])fernVertices.push(v.x,v.y,v.z);}}}
 const fernGeo=new T.BufferGeometry();fernGeo.setAttribute('position',new T.Float32BufferAttribute(fernVertices,3));fernGeo.computeVertexNormals();const fernMat=new T.MeshStandardMaterial({color:0x436936,roughness:.82,side:T.DoubleSide});
 const rockGeo=new T.DodecahedronGeometry(1,0),rockMat=new T.MeshStandardMaterial({color:0x747465,roughness:.97});
 const chunks=[],obj=new T.Object3D(),color=new T.Color();
 // Scenery extends ahead as well as behind for the complete first-person spin.
 const chunkCount=12,chunkStart=-122;
 for(let k=0;k<chunkCount;k++){
  const group=new T.Group();group.position.z=k*28+chunkStart;group.scale.x=.72;scene.add(group);chunks.push(group);
  const trunks=new T.InstancedMesh(trunkGeo,trunkMat,28),leaves=new T.InstancedMesh(leafGeo,leafMat,336),shrubs=new T.InstancedMesh(leafGeo,shrubMat,60),ferns=new T.InstancedMesh(fernGeo,fernMat,20),rocks=new T.InstancedMesh(rockGeo,rockMat,24);group.add(trunks,leaves,shrubs,ferns,rocks);trunks.castShadow=true;rocks.castShadow=true;rocks.receiveShadow=true;
  for(let i=0;i<28;i++){
   const side=i%2?1:-1,x=side*(i%7===0?12+rand()*6:16+Math.sqrt(rand())*30),z=(rand()-.5)*28,h=12+rand()*17,r=.65+rand()*.8;
   obj.position.set(x,h/2-.8,z);obj.rotation.set((rand()-.5)*.1,rand()*6.28,(rand()-.5)*.08);obj.scale.set(r,h,r);obj.updateMatrix();trunks.setMatrixAt(i,obj.matrix);
   for(let j=0;j<12;j++){const a=rand()*6.28,spread=rand()*4.4;obj.position.set(x+Math.sin(a)*spread,h-2+rand()*5,z+Math.cos(a)*spread);obj.rotation.set(-.35+rand()*1.2,rand()*6.28,rand()*6.28);obj.scale.setScalar(3.8+rand()*3.8);obj.updateMatrix();leaves.setMatrixAt(i*12+j,obj.matrix);color.setHSL(.22+rand()*.06,.28+rand()*.15,.35+rand()*.2);leaves.setColorAt(i*12+j,color);}
  }
  for(let i=0;i<60;i++){const near=i<12,size=near?.7+rand()*.9:1.7+rand()*2.4;obj.position.set((i%2?1:-1)*(near?9.5+rand()*5:17+rand()*22),size*.37,rand()*28-14);obj.rotation.set(rand()*.55-.25,rand()*6.28,rand()*1.6-.8);obj.scale.setScalar(size);obj.updateMatrix();shrubs.setMatrixAt(i,obj.matrix);}
  // Open verge, scattered bushes, then progressively denser deep understory.
  const layers=[{x:16,n:4,h:2,size:3.5},{x:21,n:6,h:3,size:5.2},{x:26,n:8,h:3,size:6.8}];
  const thicket=new T.InstancedMesh(leafGeo,shrubMat,100);group.add(thicket);let leafIndex=0;
  for(const side of [-1,1])for(const layer of layers)for(let z=0;z<layer.n;z++)for(let h=0;h<layer.h;h++){
   obj.position.set(side*(layer.x+rand()*1.4),1.7+h*2.6,z*28/layer.n-12+rand()*.8);
   obj.rotation.set((rand()-.5)*.24,Math.PI/2+(rand()-.5)*1.2,(rand()-.5)*.25);
   obj.scale.set(layer.size+rand(),layer.size*.78+rand()*.6,1);obj.updateMatrix();thicket.setMatrixAt(leafIndex++,obj.matrix);
  }
  for(let i=0;i<20;i++){obj.position.set((i%2?1:-1)*(7.6+rand()*8),0,rand()*28-14);obj.rotation.set(0,rand()*6.28,0);obj.scale.setScalar(.45+rand()*.55);obj.updateMatrix();ferns.setMatrixAt(i,obj.matrix);}
  for(let i=0;i<24;i++){obj.position.set((i%2?1:-1)*(5.6+rand()*10),rand()*.12,rand()*28-14);obj.rotation.set(rand(),rand(),rand());obj.scale.set(.2+rand()*.9,.1+rand()*.45,.2+rand()*.7);obj.updateMatrix();rocks.setMatrixAt(i,obj.matrix);}
 }
 const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=64;const dc=dustCanvas.getContext('2d'),grad=dc.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(217,190,139,.5)');grad.addColorStop(.3,'rgba(210,186,141,.2)');grad.addColorStop(1,'rgba(210,186,141,0)');dc.fillStyle=grad;dc.fillRect(0,0,64,64);const dustMap=new T.CanvasTexture(dustCanvas);
 const positions=new Float32Array(110*3),dustLife=[];for(let i=0;i<110;i++){dustLife.push(rand());positions[i*3]=(rand()-.5)*6;positions[i*3+1]=rand()*2;positions[i*3+2]=rand()*45;}
 const dustGeo=new T.BufferGeometry();dustGeo.setAttribute('position',new T.BufferAttribute(positions,3));const dust=new T.Points(dustGeo,new T.PointsMaterial({map:dustMap,color:0xc7b694,size:3.2,transparent:true,opacity:.17,depthWrite:false,sizeAttenuation:true}));scene.add(dust);
 // Tall, faint shafts make the canopy light readable without covering the animal.
 const shaftMat=new T.MeshBasicMaterial({color:0xffe2a3,transparent:true,opacity:.022,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});for(let i=0;i<7;i++){const shaft=new T.Mesh(new T.CylinderGeometry(.25,2,32,12,1,true),shaftMat);shaft.position.set(10-i*3,13,30+i*15);shaft.rotation.z=-.37;scene.add(shaft);}
 return {reset(){soil.offset.y=0;chunks.forEach((chunk,k)=>chunk.position.z=k*28+chunkStart);},update(dt,speed,time){soil.offset.y=(soil.offset.y+speed*dt/20)%1;for(const chunk of chunks){chunk.position.z+=speed*dt;if(chunk.position.z>200)chunk.position.z-=chunkCount*28;}
  for(let i=0;i<110;i++){const n=i*3;positions[n+2]+=speed*dt*.7;positions[n]+=Math.sin(time*.5+i)*dt*.12;positions[n+1]+=dt*.13;if(positions[n+2]>50){positions[n]=(rand()-.5)*3;positions[n+1]=rand()*.5;positions[n+2]=2;}}
  dustGeo.attributes.position.needsUpdate=true;
 },dustMap};
}
