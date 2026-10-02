import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {mergeStatic} from '../chase/vehicle-geometry.js';
const rand=i=>{const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export async function createRavine(scene){
 const root=new T.Group();scene.add(root);const loader=new GLTFLoader(),gltf=await loader.loadAsync('./models/ravine-cliff.glb');gltf.scene.updateMatrixWorld(true);
 let source;gltf.scene.traverse(o=>{if(o.isMesh)source=o;});
 const scan=source.geometry.clone().applyMatrix4(source.matrixWorld);scan.computeBoundingBox();const box=scan.boundingBox,center=box.getCenter(new T.Vector3());scan.translate(-center.x,-box.min.y,-center.z);
 const stone=source.material;stone.roughness=.92;stone.color.set(0xc9b09a);stone.envMapIntensity=.35;stone.side=T.DoubleSide;for(const t of [stone.map,stone.normalMap,stone.roughnessMap])if(t)t.anisotropy=8;
 const cliffs=new T.InstancedMesh(scan,stone,8);cliffs.castShadow=cliffs.receiveShadow=true;cliffs.frustumCulled=false;root.add(cliffs);
 const dummy=new T.Object3D();let travel=0;
 const textures=await Promise.all(['diff','nor_gl','rough'].map(n=>new T.TextureLoader().loadAsync(`./textures/ravine/gravel-${n}.jpg`)));
 textures.forEach(t=>{t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(52/2.5,92/2.5);t.anisotropy=8;});textures[0].colorSpace=T.SRGBColorSpace;
 const earth=new T.MeshStandardMaterial({color:0xc6b59b,roughness:1,map:textures[0],normalMap:textures[1],roughnessMap:textures[2],normalScale:new T.Vector2(.75,.75)});
 // Chunk-local coordinates keep all grain inputs small on phone GPUs. No
 // ever-growing time or travel value enters a fragment shader.
 earth.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStone;').replace('#include <begin_vertex>','#include <begin_vertex>\nvStone=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 vStone;
float grain(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
float track=1.-smoothstep(.26,.7,abs(abs(vStone.x)-1.03));
float edge=smoothstep(4.,7.,abs(vStone.x));
diffuseColor.rgb*=1.-track*.2;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.69,.72,.63),edge*.6);`);
 };
 const roadGeo=new T.PlaneGeometry(52,92,24,64);roadGeo.rotateX(-Math.PI/2);const pos=roadGeo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,Math.max(0,Math.abs(x)-5.6)*.12+(Math.abs(x)<5.6?0:Math.sin(x*.9+z*.31)*.15));}roadGeo.computeVertexNormals();
 const chunks=[];for(let i=0;i<4;i++){const r=new T.Mesh(roadGeo,earth);r.receiveShadow=true;root.add(r);chunks.push(r);}
 // Pebbles, scrub, timber and old roadside infrastructure anchor the scan scale.
 let rocksGeo=new T.IcosahedronGeometry(1,2);const rp=rocksGeo.attributes.position;for(let i=0;i<rp.count;i++){const k=.83+Math.sin(rp.getX(i)*8+rp.getZ(i)*4)*.12+Math.cos(rp.getY(i)*7)*.07;rp.setXYZ(i,rp.getX(i)*k,rp.getY(i)*k,rp.getZ(i)*k);}rocksGeo.deleteAttribute('normal');rocksGeo.deleteAttribute('uv');rocksGeo=mergeVertices(rocksGeo);rocksGeo.computeVertexNormals();
 const rockMat=new T.MeshStandardMaterial({color:0x615d50,roughness:.98}),rocks=new T.InstancedMesh(rocksGeo,rockMat,280);rocks.castShadow=rocks.receiveShadow=true;root.add(rocks);
 const leafPos=[],leafCol=[],leafIdx=[];
 for(let i=0;i<11;i++){const angle=i*2.4,base=leafPos.length/3,length=.7+rand(i)*.6;for(let j=0;j<=9;j++){const t=j/9,r=t*length,w=.13*Math.sin(Math.PI*t)**.65,h=(Math.sin(t*1.6)*.45+t*.34)*length;for(const side of [-1,0,1]){leafPos.push(Math.sin(angle)*r+Math.cos(angle)*w*side,h+(side===0?.055*Math.sin(t*Math.PI):0),Math.cos(angle)*r-Math.sin(angle)*w*side);const c=side===0?.8:1;leafCol.push(.34*c,.4*c,.29*c);}}for(let j=0;j<9;j++)for(let k=0;k<2;k++){const a=base+j*3+k;leafIdx.push(a,a+3,a+1,a+1,a+3,a+4);}}
 const scrubGeo=new T.BufferGeometry();scrubGeo.setAttribute('position',new T.Float32BufferAttribute(leafPos,3));scrubGeo.setAttribute('color',new T.Float32BufferAttribute(leafCol,3));scrubGeo.setIndex(leafIdx);scrubGeo.computeVertexNormals();const scrub=new T.InstancedMesh(scrubGeo,new T.MeshStandardMaterial({color:0x889376,vertexColors:true,roughness:1,envMapIntensity:.12,side:T.DoubleSide}),240);scrub.castShadow=scrub.receiveShadow=true;root.add(scrub);
 const steel=new T.MeshStandardMaterial({color:0x454846,roughness:.72,metalness:.52}),concrete=new T.MeshStandardMaterial({color:0xa39b88,roughness:.96}),rust=new T.MeshStandardMaterial({color:0x624330,roughness:.9,metalness:.27});
 function block(parent,mat,size,at){const m=new T.Mesh(new T.BoxGeometry(...size),mat);m.position.set(...at);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 function beam(parent,mat,a,b,r=.1){const d=new T.Vector3(...b).sub(new T.Vector3(...a)),m=new T.Mesh(new T.CylinderGeometry(r,r,d.length(),8),mat);m.position.fromArray(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());m.castShadow=true;parent.add(m);return m;}
 const props=new T.Group();root.add(props);
 for(let i=0;i<18;i++){const z=i*18-135;for(const side of [-1,1]){block(props,concrete,[.34,.9,.34],[side*5.6,.45,z]);block(props,rust,[.12,.12,17.7],[side*5.6,.8,z+8.7]);}}
 const viaduct=new T.Group();root.add(viaduct);
 for(const x of [-7.7,7.7]){block(viaduct,concrete,[1.5,12,2.6],[x,6,0]);block(viaduct,concrete,[2.4,1.1,3.8],[x,11.7,0]);}
 block(viaduct,concrete,[37,1.3,4],[0,12.7,0]);block(viaduct,rust,[37,.3,.18],[0,14.2,1.8]);for(let i=0;i<19;i++)block(viaduct,rust,[.09,1.4,.09],[i*2-18,13.6,1.8]);
 const gate=new T.Group();root.add(gate);
 for(const x of [-6.2,6.2]){block(gate,concrete,[1.5,7,2],[x,3.5,0]);block(gate,steel,[1.8,.4,2.3],[x,7.1,0]);}
 block(gate,steel,[14,.55,1],[0,6.65,0]);
 const panels=[];for(const side of [-1,1]){const panel=new T.Group();gate.add(panel);panels.push(panel);block(panel,steel,[5.7,4.7,.2],[0,2.6,0]);for(let j=0;j<7;j++)block(panel,rust,[.1,4.7,.16],[j*.85-2.55,2.6,-.18]);for(const y of [.6,4.6])block(panel,rust,[5.6,.14,.2],[0,y,-.22]);beam(panel,rust,[-2.7,.4,-.3],[2.7,4.9,-.3],.08);panel.userData.side=side;}
 // Authored lettering, painted onto the exit gantry (not an external image).
 const c=document.createElement('canvas');c.width=1024;c.height=128;const cx=c.getContext('2d');cx.fillStyle='#283433';cx.fillRect(0,0,1024,128);cx.strokeStyle='#c3aa79';cx.lineWidth=6;cx.strokeRect(8,8,1008,112);cx.fillStyle='#e4d2a9';cx.font='600 51px sans-serif';cx.textAlign='center';cx.fillText('NORTH PASS  /  EVACUATION',512,80);const signTex=new T.CanvasTexture(c);signTex.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(9,1.12),new T.MeshStandardMaterial({map:signTex,roughness:.8,side:T.DoubleSide}));sign.position.set(0,6.65,-.56);sign.rotation.y=Math.PI;gate.add(sign);
 const beaconMat=new T.MeshStandardMaterial({color:0xff5a14,emissive:0xff3b06,emissiveIntensity:3});for(const x of [-6.2,6.2])block(gate,beaconMat,[.3,.35,.3],[x,7.5,0]);
 mergeStatic(props);mergeStatic(viaduct);for(const panel of panels)mergeStatic(panel);mergeStatic(gate);
 const motesGeo=new T.BufferGeometry(),motesP=new Float32Array(240*3);for(let i=0;i<240;i++){motesP[i*3]=(rand(i+40)-.5)*25;motesP[i*3+1]=rand(i+70)*12;motesP[i*3+2]=rand(i+80)*100-25;}motesGeo.setAttribute('position',new T.BufferAttribute(motesP,3));const motes=new T.Points(motesGeo,new T.PointsMaterial({color:0xf9d4a0,size:.032,transparent:true,opacity:.43,depthWrite:false}));root.add(motes);
 function wrap(n,length=368){return ((n+138)%length+length)%length-138;}
 function update(dt,round,speed){
  travel+=dt*speed;
  const widen=T.MathUtils.smoothstep(round.time,49,66)*3;
 for(let i=0;i<8;i++){const side=i%2?1:-1;dummy.position.set(side*(13.8+widen),-.4,wrap(Math.floor(i/2)*92+travel));dummy.rotation.set(0,-side*Math.PI/2,0);dummy.scale.set(1,1.9+rand(i)*.5,1.05);dummy.updateMatrix();cliffs.setMatrixAt(i,dummy.matrix);}cliffs.instanceMatrix.needsUpdate=true;
  chunks.forEach((r,i)=>r.position.z=wrap(i*92+travel));
  for(let i=0;i<280;i++){const side=i%2?1:-1;dummy.position.set(side*(5.8+rand(i+7)*7),.12,wrap(rand(i+30)*368+travel));dummy.rotation.set(rand(i+55),rand(i)*6,rand(i+80));const k=.07+rand(i+1)**3*1.3;dummy.scale.set(k,k*.7,k*1.5);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.instanceMatrix.needsUpdate=true;
  for(let i=0;i<240;i++){dummy.position.set((i%2?1:-1)*(6.1+rand(i+40)*6),.08,wrap(rand(i+3)*368+travel));dummy.rotation.set(0,rand(i)*6,0);dummy.scale.setScalar(.35+rand(i+90)*1.1);dummy.updateMatrix();scrub.setMatrixAt(i,dummy.matrix);}scrub.instanceMatrix.needsUpdate=true;
  props.position.z=travel%18;viaduct.position.z=travel-270;gate.position.z=travel-86*8.5+4;gate.visible=round.time>67;
  for(const panel of panels)panel.position.x=panel.userData.side*(8.7-5.8*T.MathUtils.smoothstep(round.escapeTime,1,3.8));
  motes.position.z=travel%20;beaconMat.emissiveIntensity=2.2+Math.sin(round.time*6)*.8;
 }
 return {root,cliffs,gate,viaduct,update,reset(){travel=0;update(0,{time:0,escapeTime:0},0);},setQuality(t){scrub.count=t.detail?240:120;rocks.count=t.detail?280:140;motes.visible=t.detail;},get travel(){return travel;}};
}
