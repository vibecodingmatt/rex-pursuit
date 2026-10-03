import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Water} from 'three/addons/objects/Water.js';
import {createFoliageKit,WIND,dustTexture} from '../chase/foliage.js';
import {createSky,createEnvironmentMap,createCanopy,installAtmosphericFog} from '../chase/atmosphere.js';
import {createPost} from '../chase/post.js';
import {DRIVE} from './rules.js';

const clamp=T.MathUtils.clamp;
export const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const palettes={
 gates:{sky:0x85b3bf,fog:0x91ada0,sun:0xffedba,ground:0x888774,leaf:0x567d40,water:0x436e69},
 river:{sky:0xaac4b6,fog:0x95bcb0,sun:0xffebc5,ground:0x777353,leaf:0x567645,water:0x548f89},
 fault:{sky:0x876c61,fog:0x9b7862,sun:0xffb66c,ground:0x756557,leaf:0x555a37,water:0x586f68},
 hybrid:{sky:0x577b86,fog:0x536f73,sun:0xc3e8ee,ground:0x5e7172,leaf:0x3d6251,water:0x2a7684},
 lagoon:{sky:0x526f85,fog:0x567984,sun:0xa9e9f7,ground:0x5d797d,leaf:0x3d665a,water:0x237387},
 manor:{sky:0x182e3c,fog:0x243e46,sun:0x93b5dc,ground:0x7a7970,leaf:0x365348,water:0x275361},
 visitor:{sky:0x527475,fog:0x5f8081,sun:0xffdea7,ground:0x818070,leaf:0x48634b,water:0x356b70}
};

// The route is a real world-space spline. Every prop, foot and camera samples
// the same height/centre; no screen-space scenery moves toward a vanishing point.
export function routeX(z,id){return id==='manor'?Math.sin(z*.004)*3:Math.sin(z*.009)*14+Math.sin(z*.0035)*13;}
export function routeY(z,id){return ['manor','river','lagoon'].includes(id)?0:Math.sin(z*.009)*1.6+Math.sin(z*.024)*.35;}
export function routeHeading(z,id){return Math.atan2((routeX(z+1,id)-routeX(z-1,id))/2,1);}
export function groundAt(x,z,id){const off=Math.abs(x-routeX(z,id));return routeY(z,id)+Math.max(0,off-6)*.06;}

function labelTexture(text,sub='ISLAND TRANSIT AUTHORITY'){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d');x.fillStyle='#132d29';x.fillRect(0,0,1024,256);x.strokeStyle='#bcb078';x.lineWidth=10;x.strokeRect(15,15,994,226);x.textAlign='center';x.fillStyle='#eee1b7';x.font='bold 76px Georgia';x.fillText(text,512,121);x.font='20px Arial';x.fillText(sub,512,191);return new T.CanvasTexture(c);
}
function marbleTexture(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#777e79';x.fillRect(0,0,512,512);for(let i=0;i<6000;i++){const n=noise(i);x.fillStyle=`rgba(${n>.5?'221,228,212':'37,49,46'},.06)`;x.fillRect(noise(i+1)*512,noise(i+2)*512,2+noise(i+3)*16,1);}for(let i=0;i<25;i++){x.strokeStyle=`rgba(36,52,47,${.05+noise(i)*.14})`;x.lineWidth=1+noise(i)*2;x.beginPath();x.moveTo(noise(i)*512,0);x.bezierCurveTo(noise(i+1)*512,120,noise(i+2)*512,360,noise(i+3)*512,512);x.stroke();}x.strokeStyle='#263a35';x.lineWidth=4;x.strokeRect(1,1,510,510);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;}

export class CircuitWorld {
 constructor(canvas){
  installAtmosphericFog();
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.16;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(62,1,.08,300);
  this.hemi=new T.HemisphereLight(0xd5e9dd,0x34382a,2.5);this.scene.add(this.hemi);
  this.sun=new T.DirectionalLight(0xffe5be,3.1);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);Object.assign(this.sun.shadow.camera,{left:-38,right:38,top:50,bottom:-38,near:1,far:160});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.08;this.scene.add(this.sun,this.sun.target);
  this.chunks=[];this.id='';this.distance=0;this.time=0;this.ready=false;this.materials={};
  this.dummy=new T.Object3D();this.color=new T.Color();this.look=new T.Vector3();
  this.sky=createSky(this.scene);this.post=createPost(this.renderer);this.post.configure({scale:1,msaa:2,bloomLevels:4,volumetric:false,ao:false,grain:.015,motionBlur:.65});
  this.renderer.info.autoReset=false;this.post.final.contrast.value=.10;this.post.final.vignette.value=.18;this.post.final.aberration.value=.0004;this.post.final.exposure.value=1.24;
  this.post.final.volStrength.value=.42;this.post.volume.density.value=.006;
  this.practicalLights=Array.from({length:4},(_,i)=>{const light=new T.PointLight(i%2?0x87c8dd:0xffc47c,0,19,2);this.scene.add(light);return light;});
 }
 async load(){
  const loader=new T.TextureLoader();const [soil,normal,rock,rockNormal,branch]=await Promise.all(['ravine/gravel-diff.jpg','ravine/gravel-nor_gl.jpg','ravine/sandstone-diff.jpg','ravine/sandstone-nor_gl.jpg','jungle-branch.png'].map(p=>loader.loadAsync(`./textures/${p}`)));
  for(const t of [soil,normal,rock,rockNormal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;}soil.colorSpace=rock.colorSpace=branch.colorSpace=T.SRGBColorSpace;
  this.kit=createFoliageKit(branch);this.scene.environment=createEnvironmentMap(this.renderer);this.scene.environmentIntensity=.55;
  // The shared foliage kit normally lives in a stationary Jeep frame. Here the
  // camera travels, so distance fading must be relative to the moving camera.
  for(const mat of Object.values(this.kit.materials)){const compile=mat.onBeforeCompile;mat.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replaceAll('vPlantWorld.z)', '(vPlantWorld.z-cameraPosition.z))').replace('abs(anchor.z-6.)','abs(anchor.z-cameraPosition.z-6.)');};const key=mat.customProgramCacheKey.bind(mat);mat.customProgramCacheKey=()=>key()+'-arcade-world';}
  this.materials.ground=new T.MeshStandardMaterial({map:soil,normalMap:normal,normalScale:new T.Vector2(.55,.55),roughness:.92,vertexColors:true});
  this.materials.rock=new T.MeshStandardMaterial({map:rock,normalMap:rockNormal,normalScale:new T.Vector2(.75,.75),color:0x899080,roughness:.94});
  this.materials.bark=new T.MeshStandardMaterial({map:rock,normalMap:rockNormal,color:0x665b43,roughness:.97});
  this.materials.leaf=new T.MeshStandardMaterial({map:branch,alphaTest:.38,side:T.DoubleSide,color:0x688a44,roughness:.86});
  this.materials.canopy=new T.MeshStandardMaterial({color:0x345331,roughness:1});
  this.materials.wood=new T.MeshStandardMaterial({map:rock,color:0x6c5740,roughness:.93});
  this.materials.metal=new T.MeshStandardMaterial({color:0x78867d,metalness:.65,roughness:.37});
  this.materials.stone=new T.MeshStandardMaterial({map:rock,color:0xc2b99b,roughness:.85});
  this.materials.floor=new T.MeshStandardMaterial({map:marbleTexture(),color:0xa0ada8,roughness:.31,metalness:.2});
  const atlas=await loader.loadAsync('./arcade/architecture-v2.png');
  const architecture=[];for(let i=0;i<4;i++){const canvas=document.createElement('canvas');canvas.width=atlas.image.width/2;canvas.height=atlas.image.height/2;canvas.getContext('2d').drawImage(atlas.image,(i%2)*canvas.width,Math.floor(i/2)*canvas.height,canvas.width,canvas.height,0,0,canvas.width,canvas.height);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;map.wrapS=map.wrapT=T.RepeatWrapping;if(i===3)map.repeat.set(12,2);architecture.push(new T.MeshStandardMaterial({map,bumpMap:map,bumpScale:i===3?.16:.035,roughness:i===1?.48:.8,metalness:i===1?.15:0}));}atlas.dispose();[this.materials.visitorFacade,this.materials.modernFacade,this.materials.manorFacade,this.materials.thatch]=architecture;
  this.materials.glass=new T.MeshStandardMaterial({color:0x8baab2,metalness:.35,roughness:.2,transparent:true,opacity:.19,depthWrite:false,side:T.DoubleSide});
  this.materials.lamp=new T.MeshBasicMaterial({color:0xffd496,toneMapped:false});
  this.materials.lava=new T.MeshStandardMaterial({color:0x531b12,emissive:0xff4a0c,emissiveIntensity:2,roughness:.5});
  this.materials.water=new T.MeshStandardMaterial({color:0x518d86,metalness:.45,roughness:.25,transparent:true,opacity:.91});
  this.wave={value:0};this.materials.water.envMapIntensity=1.3;this.materials.water.onBeforeCompile=s=>{s.uniforms.uRideTime=this.wave;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uRideTime;').replace('#include <begin_vertex>','#include <begin_vertex>\nvec3 wavePos=(modelMatrix*vec4(position,1.)).xyz; transformed.y+=sin(wavePos.x*.7+uRideTime*1.3)*.10+sin(wavePos.z*.55-uRideTime*2.)*.13;').replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nvec3 normalPos=(modelMatrix*vec4(position,1.)).xyz; objectNormal=normalize(vec3(-cos(normalPos.x*.7+uRideTime*1.3)*.07,1.,-cos(normalPos.z*.55-uRideTime*2.)*.0715));');};
  this.geometry={trunk:new T.CylinderGeometry(.22,.48,1,7,2),leaf:new T.PlaneGeometry(1,1),rock:new T.IcosahedronGeometry(1,1),crown:new T.SphereGeometry(1,9,6),box:new T.BoxGeometry(1,1,1),pole:new T.CylinderGeometry(.09,.12,1,8)};
  const scan=await new GLTFLoader().loadAsync('./models/ravine-outcrop.glb');scan.scene.updateMatrixWorld(true);const source=scan.scene.getObjectByName('Ravine_Outcrop_LOD');this.geometry.outcrop=source.geometry.clone().applyMatrix4(source.matrixWorld);this.geometry.outcrop.computeBoundingBox();const box=this.geometry.outcrop.boundingBox,center=box.getCenter(new T.Vector3());this.geometry.outcrop.translate(-center.x,-box.min.y,-center.z);this.materials.outcrop=source.material;this.materials.outcrop.color.set(0xc5b89e);this.materials.outcrop.side=T.DoubleSide;this.materials.outcrop.roughness=.93;
  this.canopy=createCanopy(this.scene,this.sun,{width:90,height:19});this.post.configure({ao:innerWidth>700?{samples:4,steps:4}:false,aoAmount:.65,volumetric:{steps:10,resolution:.4}});
  const normals=new Uint8Array(256*256*4);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const u=x/256*Math.PI*2,v=y/256*Math.PI*2,dx=Math.cos(u*7+Math.sin(v*3))*.23+Math.cos(u*19+v*11)*.1,dy=Math.cos(v*9+u*3)*.22+Math.cos(v*21-u*7)*.1,n=new T.Vector3(-dx,-dy,1).normalize(),i=(y*256+x)*4;normals.set([128+n.x*127,128+n.y*127,128+n.z*127,255],i);}const normalTexture=new T.DataTexture(normals,256,256);normalTexture.wrapS=normalTexture.wrapT=T.RepeatWrapping;normalTexture.magFilter=normalTexture.minFilter=T.LinearFilter;normalTexture.needsUpdate=true;
  this.water=new Water(new T.PlaneGeometry(250,500),{textureWidth:innerWidth>700?1024:512,textureHeight:innerWidth>700?1024:512,waterNormals:normalTexture,sunDirection:new T.Vector3(-.5,.8,-.4).normalize(),sunColor:0xfff0c9,waterColor:0x236e75,distortionScale:.85,fog:true});this.water.rotation.x=-Math.PI/2;this.water.visible=false;this.scene.add(this.water);
  const sprayGeometry=new T.BufferGeometry();sprayGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(180*3),3));this.spray=new T.Points(sprayGeometry,new T.PointsMaterial({map:dustTexture(),size:.38,color:0xdaf8ef,transparent:true,opacity:.6,depthWrite:false}));this.spray.frustumCulled=false;this.scene.add(this.spray);
  this.signs={gates:labelTexture('JURASSIC PARK','ISLA NUBLAR • NORTH GATE'),river:labelTexture('RIVER OF GIANTS'),fault:labelTexture('SERVICE CROSSING','UNSTABLE GROUND • DO NOT STOP'),hybrid:labelTexture('INNOVATION VALLEY'),lagoon:labelTexture('LAGOON OBSERVATORY'),manor:labelTexture('THE CONSERVATORY'),visitor:labelTexture('VISITOR CENTER','WHEN GIANTS RULED THE EARTH')};
  this.ready=true;
 }
 instances(parent,geo,mat,items,shadow=true){
  if(!items.length)return;const mesh=new T.InstancedMesh(geo,mat,items.length);mesh.castShadow=shadow;mesh.receiveShadow=true;
  items.forEach((item,i)=>{const [x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,tint]=item;this.dummy.position.set(x,y,z);this.dummy.rotation.set(rx,ry,rz);this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);if(tint!==undefined){this.color.setScalar(tint);mesh.setColorAt(i,this.color);}});mesh.computeBoundingSphere();parent.add(mesh);return mesh;
 }
 makeChunk(index){
  const id=this.id,m=this.materials,start=index*32,mid=start+16,g=new T.Group();g.position.z=mid;g.userData.index=index;this.scene.add(g);
  const river=id==='river'||id==='lagoon',canyon=id==='fault',interior=id==='manor',urban=['hybrid','visitor'].includes(id),bridge=canyon&&mid>280&&mid<640,cave=canyon&&mid<280;
  const geo=new T.BufferGeometry(),v=[],uv=[],colors=[],indices=[],cols=42,rows=8,baseColor=new T.Color(palettes[id].ground);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const z=start+j*4,off=(i/cols-.5)*180,edge=Math.max(0,Math.abs(off)-6),height=routeY(z,id)+(interior||urban?edge*.018:edge*.07+Math.sin(z*.12+off*.16)*Math.min(3,edge*.05));
   let y=height;if(river&&Math.abs(off)<27)y-=3;if(bridge&&Math.abs(off)<21)y-=14;if(canyon)y+=clamp((Math.abs(off)-12)/18,0,1)*(27+Math.sin(z*.07)*3);
   v.push(routeX(z,id)+off,y,z-mid);uv.push(off*.14,z*.14);const c=baseColor.clone().multiplyScalar(.86+noise(i*13+j*11+index*99)*.2);if(Math.abs(off)>6&&!canyon&&!interior&&!urban)c.lerp(new T.Color(0x536e3b),.75);if(Math.abs(off)<5.7)c.multiplyScalar(1.19);colors.push(c.r,c.g,c.b);
   if(j<rows&&i<cols){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
  }
  geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const terrain=new T.Mesh(geo,interior?m.floor:m.ground);terrain.receiveShadow=true;g.add(terrain);
  // Separate continuous track: ruts in the jungle, submerged channel on water routes.
  if(!river&&!bridge){const pos=[],tex=[],col=[],idx=[];for(let j=0;j<=16;j++)for(let k=0;k<=8;k++){const z=start+j*2,off=(k/8-.5)*11,yy=routeY(z,id)+.08+(interior||urban?0:Math.sin(k*1.7)*.018);pos.push(routeX(z,id)+off,yy,z-mid);tex.push(off*.23,z*.2);const c=baseColor.clone().multiplyScalar(k===2||k===6?.53:interior?1.12:.84);col.push(c.r,c.g,c.b);if(j<16&&k<8){const a=j*9+k;idx.push(a,a+9,a+1,a+1,a+9,a+10);}}
   const road=new T.BufferGeometry();road.setAttribute('position',new T.Float32BufferAttribute(pos,3));road.setAttribute('uv',new T.Float32BufferAttribute(tex,2));road.setAttribute('color',new T.Float32BufferAttribute(col,3));road.setIndex(idx);road.computeVertexNormals();const mesh=new T.Mesh(road,interior?m.floor:m.ground);mesh.receiveShadow=true;g.add(mesh);
  }
  const trunks=[],leaves=[],rocks=[],wood=[],posts=[],stone=[],metal=[],lamps=[],glass=[],palms=[],ferns=[],bushes=[],grass=[],outcrops=[],treeFerns=[],lava=[],facades=[];
  const add=(arr,off,y,z,sx,sy,sz,rx=0,ry=0,rz=0,tint)=>arr.push([routeX(z,id)+off,routeY(z,id)+y,z-mid,sx,sy,sz,rx,ry,rz,tint]);
  if(bridge){const points=[],faces=[];for(let j=0;j<=16;j++)for(let i=0;i<=24;i++){const z=start+j*2;points.push(routeX(z,id)+(i/24-.5)*50,routeY(z,id)-10,z-mid);if(j<16&&i<24){const k=j*25+i;faces.push(k,k+25,k+1,k+1,k+25,k+26);}}const waterGeometry=new T.BufferGeometry();waterGeometry.setAttribute('position',new T.Float32BufferAttribute(points,3));waterGeometry.setIndex(faces);waterGeometry.computeVertexNormals();g.add(new T.Mesh(waterGeometry,m.water));}
  if(cave){
   const points=[],uvs=[],faces=[];for(let j=0;j<=8;j++)for(let i=0;i<=24;i++){const z=start+j*4,a=i/24*Math.PI,x=Math.cos(a)*14,y=Math.sin(a)*10+3+Math.sin(z*.08+a*4)*.4;points.push(routeX(z,id)+x,routeY(z,id)+y,z-mid);uvs.push(a*4,z*.18);if(i<24&&j<8){const k=j*25+i;faces.push(k,k+1,k+25,k+1,k+26,k+25);}}
   const vault=new T.BufferGeometry();vault.setAttribute('position',new T.Float32BufferAttribute(points,3));vault.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));vault.setIndex(faces);vault.computeVertexNormals();const mat=m.rock.clone();mat.color.set(0x64584b);mat.side=T.DoubleSide;const ceiling=new T.Mesh(vault,mat);ceiling.castShadow=ceiling.receiveShadow=true;g.add(ceiling);
   for(const side of [-1,1])for(let z=start;z<start+32;z+=2)add(lava,side*(8.3+Math.sin(z*.23)),.05,z,1.2+noise(z)*1.5,.03,2.2,0,routeHeading(z,id));
  }
  if(bridge){for(let z=start;z<start+32;z+=.72)add(wood,0,-.12,z,10.6,.25,.64,0,routeHeading(z,id));for(const side of [-1,1])for(let z=start;z<start+32;z+=4){add(posts,side*5.35,1.05,z,.8,2.5,.8);add(metal,side*5.35,1.8,z,.07,.07,4.1,0,routeHeading(z,id));}}
  if(!interior){
   // Trees have tapered trunks, crowns and layered branch cards; understory hides entrances.
   const count=cave?0:canyon?3:urban?6:15;
   for(let i=0;i<count;i++){const seed=index*73+i*19,z=start+noise(seed)*32,side=i%2?1:-1,off=side*((river?29:urban?12:8)+noise(seed+1)*(canyon?35:29)),height=9+noise(seed+2)*12;
    const base=groundAt(routeX(z,id)+off,z,id)-routeY(z,id);
    add(i%3===0?palms:trunks,off,base,z,height,height,height,0,seed,side*.015,.85+noise(seed+3)*.3);
   }
   for(let i=0;i<(canyon?36:130);i++){const seed=index*101+i*23,z=start+noise(seed)*32,side=i%2?1:-1,off=side*((river?28:6.7)+noise(seed+1)**2*20),s=.9+noise(seed+2)*2.5;
    if(i%4===0||canyon)add(rocks,off,s*.25,z,s,s*.65,s*.75,noise(seed),seed,0,.65+noise(seed+1)*.5);
    const base=groundAt(routeX(z,id)+off,z,id)-routeY(z,id);
    if(!canyon){if(i%9===0)add(treeFerns,off,base,z,3.4,3.4,3.4,0,seed);else if(i%2===0)add(bushes,off,base,z,.95,.95,.95,0,seed);else add(ferns,off,base,z,s,s,s,0,seed);}
   }
   if(!canyon)for(let i=0;i<170;i++){const seed=index*173+i*17,z=start+noise(seed)*32,off=(i%2?1:-1)*((river?28:5.8)+noise(seed+1)*7),s=.8+noise(seed+2)*1.5;add(grass,off,groundAt(routeX(z,id)+off,z,id)-routeY(z,id)+.05,z,s,s,s,0,seed);}
   if(canyon)for(const side of [-1,1])for(let i=0;i<3;i++){const z=start+i*12,scale=2.1+noise(index*3+i)*.3;add(outcrops,side*19,-2,z,scale,scale*1.3,scale,0,-side*Math.PI/2);}
  }
  if(interior||urban||id==='lagoon'){
   for(const side of [-1,1])for(let z=start;z<start+32;z+=8){
    const bank=id==='lagoon'?30:interior?9:12;
    add(stone,side*bank,2.7,z,.8,5.4,.8);add(stone,side*bank,.35,z,1.4,.7,1.4);add(stone,side*bank,5.45,z,1.3,.3,1.3);
    add(lamps,side*(bank-.45),3.4,z,.13,.65,.45);
    if(interior){
     add(stone,side*8,.38,z+3,1.6,.76,3);add(ferns,side*8,.78,z+3,2,2,2,0,z);add(glass,side*9.5,2.9,z,.05,5.4,7.8);add(metal,side*9.5,5.7,z,.15,.18,8.1);
     add(facades,side*9.4,3,z,8,6,1,0,-side*Math.PI/2);
     if(side===1)for(let j=0;j<10;j++){const x=-8.55+j*1.9,yy=5.8+Math.sqrt(Math.max(0,1-(x/9.5)**2))*3.8,angle=-Math.atan((x/9.5)/Math.sqrt(Math.max(.02,1-(x/9.5)**2))*.4),width=1.92/Math.cos(angle);add(glass,x,yy,z,width,.035,7.9,0,0,angle);add(metal,x,yy-.06,z,width,.09,.12,0,0,angle);add(metal,x,yy,z,.075,.1,8.1);}
    }
    else if(id!=='lagoon'){add(stone,side*22,4,z,11,8,7);add(facades,side*16.4,4,z,7,8,1,0,-side*Math.PI/2);add(metal,side*22,8.3,z,13,.6,8);add(lamps,side*16.2,6.6,z,.12,.13,6);}
    if(id==='lagoon'){add(metal,side*29,1,z,.11,.12,8,0,routeHeading(z,id));for(let tier=0;tier<6;tier++)add(stone,side*(33+tier*2),tier*1.05,z,2,.5,8);}
   }
   if(interior)for(let z=start;z<start+32;z+=8)for(const side of [-1,1]){add(wood,side*6.8,.55,z+1,1.2,.12,2.5);add(metal,side*7.3,1,z+1,.12,.95,2.5);for(const k of [-1,1])add(metal,side*6.8,.25,z+1+k*.8,1,.5,.12);}
  }
  // One landmark gateway per sector, plus passing hazard markers and fence wire.
  if(index===1){const z=mid;for(const side of [-1,1])add(stone,side*7,5,z,1.8,10,2);add(wood,0,9,z,15,1.35,1.2);const sign=new T.Mesh(new T.PlaneGeometry(11,2.75),new T.MeshStandardMaterial({map:this.signs[id],roughness:.8}));sign.position.set(routeX(z,id),routeY(z,id)+8.4,z-mid-1.02);sign.rotation.y=Math.PI;g.add(sign);}
  if(id==='gates'||id==='hybrid')for(const side of [-1,1])for(let z=start;z<start+32;z+=8){add(posts,side*6.4,1.7,z,1,3.4,1);for(let y=.6;y<3.2;y+=1)add(metal,side*6.4,y,z,.026,.026,8.1,0,routeHeading(z,id));add(lamps,side*6.4,3.2,z,.15,.08,.15);}
  if((id==='lagoon'||id==='hybrid')&&index===5){const z=mid;for(const side of [-1,1])add(stone,side*31,6.5,z,1.4,13,3);add(metal,0,13,z,65,.75,2);add(stone,-6,15,z,13,2.5,3);add(glass,-6,15.3,z-1.55,11,1.1,.04);add(lamps,-6,13.8,z-1.6,13,.09,.09);}
  if(id==='hybrid'&&index===10){const domeGeo=new T.SphereGeometry(38,32,14,0,Math.PI*2,0,Math.PI/2),dome=new T.Mesh(domeGeo,m.glass);dome.scale.y=.72;dome.position.set(routeX(mid,id),routeY(mid,id),0);g.add(dome);const ribs=new T.LineSegments(new T.WireframeGeometry(domeGeo),new T.LineBasicMaterial({color:0x466c70,transparent:true,opacity:.65}));ribs.position.copy(dome.position);ribs.scale.copy(dome.scale);g.add(ribs);}
  if(id==='visitor'&&index===25){
   const root=new T.Group();root.position.set(routeX(mid,id),routeY(mid,id),0);g.add(root);
   for(let tier=0;tier<3;tier++){const roof=new T.Mesh(new T.CylinderGeometry(8-tier*3,29-tier*7,5.5,64,1,true),m.thatch);roof.position.y=13+tier*4;roof.castShadow=roof.receiveShadow=true;root.add(roof);}
   for(let i=0;i<16;i++){const angle=i/16*Math.PI*2,x=Math.sin(angle)*24,z=Math.cos(angle)*24;if(Math.abs(x)<7)continue;const column=new T.Mesh(new T.CylinderGeometry(.65,.85,11,16),m.stone);column.position.set(x,5.5,z);column.castShadow=true;root.add(column);const wall=new T.Mesh(new T.PlaneGeometry(9,9),m.visitorFacade);wall.position.set(Math.sin(angle)*27,4.5,Math.cos(angle)*27);wall.rotation.y=angle+Math.PI;root.add(wall);}
   const banner=new T.Mesh(new T.PlaneGeometry(17,4),new T.MeshStandardMaterial({map:labelTexture('VISITOR CENTER','WHEN GIANTS RULED THE EARTH'),roughness:.8}));banner.position.set(0,9,-23.5);banner.rotation.y=Math.PI;root.add(banner);
  }
  const kit=this.kit,giant=kit.giants[Math.abs(index)%kit.giants.length],palm=kit.palms[Math.abs(index)%kit.palms.length];
  this.instances(g,giant.wood,kit.materials.bark,trunks);this.instances(g,giant.leaves,kit.materials.canopy,trunks,false);this.instances(g,palm.wood,kit.materials.bark,palms);this.instances(g,palm.fronds,kit.materials.palm,palms,false);
  this.instances(g,kit.ferns[Math.abs(index)%3],kit.materials.fern,ferns,false);const bush=kit.bushes[Math.abs(index)%3];this.instances(g,bush.wood,kit.materials.bark,bushes);this.instances(g,bush.leaves,kit.materials.shrub,bushes,false);this.instances(g,kit.grass[Math.abs(index)%2],kit.materials.grass,grass,false);
  const treeFern=kit.treeFerns[Math.abs(index)%2];this.instances(g,treeFern.wood,kit.materials.bark,treeFerns);this.instances(g,treeFern.fronds,kit.materials.fern,treeFerns,false);this.instances(g,this.geometry.outcrop,m.outcrop,outcrops);
  this.instances(g,this.geometry.leaf,m.leaf,leaves,false);this.instances(g,this.geometry.rock,m.rock,rocks);const deck=this.instances(g,this.geometry.box,m.wood,wood);if(bridge){g.userData.deck=deck;g.userData.planks=wood;}this.instances(g,this.geometry.pole,m.metal,posts);this.instances(g,this.geometry.box,m.stone,stone);this.instances(g,this.geometry.box,m.metal,metal);this.instances(g,this.geometry.box,m.lamp,lamps,false);this.instances(g,this.geometry.box,m.glass,glass,false);this.instances(g,this.geometry.box,m.lava,lava,false);
  this.instances(g,this.geometry.leaf,interior?m.manorFacade:id==='visitor'?m.visitorFacade:m.modernFacade,facades);
  return g;
 }
 disposeChunk(g){this.scene.remove(g);g.traverse(o=>{if(o.isInstancedMesh){o.dispose();return;}if(o.isLineSegments){o.geometry.dispose();o.material.dispose();return;}if(o.isMesh&&!Object.values(this.geometry).includes(o.geometry))o.geometry.dispose();if(o.isMesh&&!Object.values(this.materials).includes(o.material))o.material.dispose();});}
 setStage(id){if(this.id===id)return;for(const g of this.chunks)this.disposeChunk(g);this.chunks=[];this.id=id;const p=palettes[id];this.scene.background=new T.Color(p.sky);this.scene.fog=new T.Fog(p.fog,id==='manor'?28:55,id==='manor'?155:210);this.sun.color.set(p.sun);this.sun.intensity=id==='manor'?1.6:3.1;this.hemi.intensity=id==='manor'?1.7:2.5;this.hemi.color.set(p.sky).lerp(new T.Color(0xffffff),.5);this.materials.leaf.color.set(p.leaf).multiplyScalar(1.45);this.materials.canopy.color.set(p.leaf).multiplyScalar(.77);this.materials.water.color.set(p.water);}
 sync(game,{reduced=false,time=0,shake=0}={}){
  if(!this.ready)return;const id=game?.stage.id||'gates';this.setStage(id);this.distance=game?.travel??time*4;this.time=game?.time??time;this.wave.value=this.time;
  const first=Math.floor(this.distance/32)-1;for(const g of this.chunks.filter(g=>g.userData.index<first||g.userData.index>first+8)){this.disposeChunk(g);this.chunks.splice(this.chunks.indexOf(g),1);}for(let i=first;i<=first+8;i++)if(!this.chunks.some(g=>g.userData.index===i))this.chunks.push(this.makeChunk(i));
  const z=this.distance,move=reduced?0:1,rough=id==='fault'?1.7:1,roll=Math.sin(z*.071)*.007*move;
  // Anchor the leap to the actual gap, so Overdrive cannot land us in midair.
  const leap=id==='fault'&&game?.bridgeBroken?(z-game.bridgeOrigin+30)/60:-1;
  const drop=leap>0&&leap<1?-Math.sin(leap*Math.PI)*2.3*move:0;
  // After a Rex goes down the camera cranes up off the vehicle, so her fall reads
  // from above instead of foreshortened behind her own head.
  const crane=game?.phase==='clear'&&DRIVE[game.stage.boss]?T.MathUtils.smootherstep(game.phaseTime,.2,2.6)*move:0;
  this.camera.position.set(routeX(z,id)+Math.sin(z*.11)*.10*move,routeY(z,id)+2.65+crane*3.6+Math.sin(z*1.2)*.025*rough*move+Math.sin(this.time*64)*shake*.12*move-drop,z);
  this.look.set(routeX(z+24,id),routeY(z+24,id)+2.25-drop-crane*3.3,z+24);this.camera.lookAt(this.look);this.camera.rotateZ(roll);this.camera.updateMatrixWorld();
  this.sun.position.set(this.camera.position.x-35,this.camera.position.y+55,z+35);this.sun.target.position.set(this.camera.position.x,routeY(z,id),z+35);this.sun.target.updateMatrixWorld();
  const forest=['gates','river','hybrid'].includes(id);this.canopy.enabled=forest;this.canopy.height=routeY(z,id)+19;this.canopy.offset.set(this.camera.position.x-12,z);this.canopy.caster.position.set(this.canopy.offset.x,this.canopy.height,z+12);this.sky.mesh.visible=id!=='manor';
  this.water.visible=this.spray.visible=['river','lagoon'].includes(id);if(this.water.visible){this.water.position.set(routeX(z,id),-.35,z+80);this.water.material.uniforms.time.value=this.time;this.water.material.uniforms.waterColor.value.set(palettes[id].water).multiplyScalar(.48);const positions=this.spray.geometry.attributes.position;for(let i=0;i<positions.count;i++){const age=(this.time*1.7+noise(i))%1,side=i%2?1:-1,zz=z+7-age*12;positions.setXYZ(i,routeX(zz,id)+side*(1.7+age*3)+noise(i+8)*.5,-.25+Math.sin(age*Math.PI)*(.4+noise(i+2)),zz);}positions.needsUpdate=true;}
  this.practicalLights.forEach((l,i)=>{const zz=z+8+i*14;l.position.set(routeX(zz,id)+(i%2?1:-1)*7.8,routeY(zz,id)+(id==='fault'?1:3.4),zz);l.color.set(id==='fault'?0xff6327:i%2?0x87c8dd:0xffc47c);l.intensity=id==='fault'&&z<280?95:id==='manor'?85:['hybrid','visitor','lagoon'].includes(id)?40:0;});
  if(id==='fault')for(const chunk of this.chunks){const {deck,planks}=chunk.userData;if(!deck)continue;planks.forEach((a,i)=>{const worldZ=chunk.position.z+a[2],origin=game.bridgeOrigin??Infinity,elapsed=(game.stageTime-19)-(worldZ-origin)/32,fall=worldZ>origin-18&&worldZ<origin+18?clamp(elapsed,0,2):0;this.dummy.position.set(a[0],a[1]-fall*fall*4,a[2]);this.dummy.rotation.set(fall*.4,a[7]||0,Math.sin(i*3)*fall*.6);this.dummy.scale.set(a[3],a[4],a[5]);this.dummy.updateMatrix();deck.setMatrixAt(i,this.dummy.matrix);});deck.instanceMatrix.needsUpdate=true;deck.computeBoundingSphere();}
  WIND.value=this.time;this.sky.update(this.camera,this.time);this.sky.uniforms.zenith.value.set(palettes[id].sky);this.sky.uniforms.horizon.value.set(palettes[id].fog);this.sky.uniforms.night.value=id==='manor'?.85:id==='visitor'?.55:0;this.sky.uniforms.storm.value=id==='fault'?.65:0;this.post.settings.motionBlur=reduced?0:.65;
 }
 resize(w,h){this.camera.aspect=w/h;this.camera.fov=w<h?76:62;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
 render(){if(this.ready){this.renderer.info.reset();if(this.post.supported)this.post.render(this.scene,this.camera,{time:this.time,sun:this.sun,canopy:this.canopy.caster.visible?this.canopy:null,overlay:this.overlay});else this.renderer.render(this.scene,this.camera);}}
}
