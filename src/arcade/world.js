import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Water} from 'three/addons/objects/Water.js';
import {createFoliageKit,WIND,dustTexture} from '../chase/foliage.js';
import {createSky,createCanopy} from '../chase/atmosphere.js';
import {createPost} from '../chase/post.js';
import {DRIVE,BRACHIO,ROTUNDA} from './rules.js';
import {terrainGeometry,groundMaterial,loadRocks,rootGeometry,mergeStill,scatter} from './ground.js';
import {StageLight,RouteCanopy,installArcadeFog,addRim} from './light.js';
import {CircuitAir,PUSH,GUST,PLANT_PUSH} from './air.js';
import {Gate,GATE_Z} from './gate.js';
import {Sparks} from './sparks.js';
import {RiverSurface,LEVEL} from './water.js';
import {Spray} from './spray.js';
import {BOW} from './boat.js';
import {Fault} from './fault.js';
import {Promenade} from './promenade.js';
import {Glass} from './glass.js';
import {createVisitorCenter} from '../chase/visitor-center.js';
import {Rotunda} from './rotunda.js';
import {ArcadeRain} from './rain.js';
// A14: the finale drives to Pursuit's Visitor Center. Its root (Pursuit frame: building toward -z)
// is turned to face the vehicle at PLAZA; street buildings stop short of it.
// A14: past the plaza the finale's route runs straight along the Visitor Center's axis, up its steps
// (STEPS: bottom and top along the axis, in metres, and the rise) and through its doors (DOOR m along the
// axis) into the rotunda; the Jeep stops ROTUNDA (rules) 6 m inside. PLAZA is solved so that holds.
const X0=z=>Math.sin(z*.009)*14+Math.sin(z*.0035)*13,DX0=z=>.126*Math.cos(z*.009)+.0455*Math.cos(z*.0035),Y0=z=>Math.sin(z*.009)*1.6+Math.sin(z*.024)*.35;
export const DOOR=67.2,STEPS=[56.7,63.8,2.09];
export const PLAZA=(()=>{let p=ROTUNDA-DOOR-6;for(let i=0;i<8;i++)p=ROTUNDA-(DOOR+6)/Math.hypot(1,DX0(p));return p;})();
/** Metres along the Visitor Center's axis from the plaza (finale only). */
export const plazaAxis=z=>(z-PLAZA)*Math.hypot(1,DX0(PLAZA));

const TAU=Math.PI*2,clamp=T.MathUtils.clamp,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
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
export function routeX(z,id){return id==='manor'?Math.sin(z*.004)*3:id==='visitor'&&z>PLAZA?X0(PLAZA)+(z-PLAZA)*DX0(PLAZA):X0(z);}
export function routeY(z,id){return ['manor','river','lagoon'].includes(id)?0:id==='visitor'&&z>PLAZA?Y0(PLAZA)+STEPS[2]*clamp((plazaAxis(z)-STEPS[0])/(STEPS[1]-STEPS[0]),0,1):Y0(z);}
export function routeHeading(z,id){return Math.atan2((routeX(z+1,id)-routeX(z-1,id))/2,1);}
// Open ground: the bank rise and roll, with hummocks off the track. Creatures, trees and rocks stand on it.
export function landY(off,z,id){const ax=Math.abs(off),edge=Math.max(0,ax-6),y=routeY(z,id);if(id==='visitor'&&z>PLAZA)return y;if(['manor','hybrid','visitor'].includes(id))return y+edge*.018;return y+edge*.07+Math.sin(z*.12+off*.16)*Math.min(3,edge*.05)+Math.sin(z*.53+off*.71)*Math.sin(z*.31-off*.47)*.24*clamp((ax-5.5)/4,0,1);}
// Swimmers and flyers on the water stages keep their original reference height.
export function groundAt(x,z,id){const off=x-routeX(z,id);return ['river','lagoon'].includes(id)?routeY(z,id)+Math.max(0,Math.abs(off)-6)*.06:landY(off,z,id);}
// The terrain itself: land cut by the river channel and the bridge gorge, and raised into the canyon walls.
// A9: where the brachiosaur crosses, the river runs over a gravel ford about half a metre deep.
export const FORD=2.1;
export function fordAt(z,id){return id==='river'?1-smooth(22,40,Math.abs(z-BRACHIO.z)):0;}
export function terrainY(off,z,id,{river,bridge,canyon}={}){const ax=Math.abs(off);let y=landY(off,z,id);if(river)y-=(3-FORD*fordAt(z,id))*(1-smooth(23,30,ax));if(bridge)y-=14*(1-smooth(17.5,22,ax));if(canyon)y+=clamp((ax-12)/18,0,1)*(27+Math.sin(z*.07)*3)+Math.sin(z*.41+ax*.3)*.8*clamp((ax-12)/6,0,1);return y;}

function labelTexture(text,sub='ISLAND TRANSIT AUTHORITY'){
 const c=document.createElement('canvas');c.width=1024;c.height=256;const x=c.getContext('2d');x.fillStyle='#132d29';x.fillRect(0,0,1024,256);x.strokeStyle='#bcb078';x.lineWidth=10;x.strokeRect(15,15,994,226);x.textAlign='center';x.fillStyle='#eee1b7';x.font='bold 76px Georgia';x.fillText(text,512,121);x.font='20px Arial';x.fillText(sub,512,191);return new T.CanvasTexture(c);
}
/** The fence's enamel plate: DANGER band, a bolt and the voltage, weathered at the edges. */
function voltTexture(){
 const c=document.createElement('canvas');c.width=256;c.height=180;const x=c.getContext('2d');x.fillStyle='#e2b81f';x.fillRect(0,0,256,180);x.fillStyle='#16130e';x.fillRect(0,0,256,52);x.lineWidth=7;x.strokeStyle='#16130e';x.strokeRect(4,4,248,172);
 x.textAlign='center';x.fillStyle='#e2b81f';x.font='bold 40px Arial';x.fillText('DANGER',128,41);x.fillStyle='#16130e';x.beginPath();for(const [px,py]of [[48,62],[30,112],[44,112],[34,160],[66,98],[51,98],[62,62]])x.lineTo(px,py);x.fill();
 x.font='bold 30px Arial';x.fillText('10,000',156,104);x.fillText('VOLTS',156,140);x.font='bold 13px Arial';x.fillText('ELECTRIFIED FENCE',156,166);
 for(let i=0;i<260;i++){const n=noise(i*3.3),edge=n<.5;x.fillStyle=`rgba(${edge?'92,58,24':'40,30,18'},${.08+noise(i+7)*.25})`;const px=edge?(noise(i+1)<.5?noise(i+2)*18:238+noise(i+2)*18):noise(i+1)*256,py=noise(i+4)*180;x.fillRect(px,py,2+noise(i+5)*6,1+noise(i+6)*4);}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function marbleTexture(){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#777e79';x.fillRect(0,0,512,512);for(let i=0;i<6000;i++){const n=noise(i);x.fillStyle=`rgba(${n>.5?'221,228,212':'37,49,46'},.06)`;x.fillRect(noise(i+1)*512,noise(i+2)*512,2+noise(i+3)*16,1);}for(let i=0;i<25;i++){x.strokeStyle=`rgba(36,52,47,${.05+noise(i)*.14})`;x.lineWidth=1+noise(i)*2;x.beginPath();x.moveTo(noise(i)*512,0);x.bezierCurveTo(noise(i+1)*512,120,noise(i+2)*512,360,noise(i+3)*512,512);x.stroke();}x.strokeStyle='#263a35';x.lineWidth=4;x.strokeRect(1,1,510,510);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;}

/**
 * Phone pass 2: every chunk's instanced meshes (trees, cover, rocks, decals, fences) draw through one shared
 * InstancedMesh per geometry/material/shadow combination instead of one per chunk (about 24 draw calls a chunk,
 * nine chunks). Chunks keep their own instanced meshes off the scene graph as data; the batches are refilled
 * when chunks stream in or out, rocks swap LOD, or ground cover toggles (all at chunk boundaries, not per frame).
 */
class ChunkBatches {
 constructor(scene){this.scene=scene;this.batches=new Map();this.dirty=false;this.m=new T.Matrix4();}
 /** Take a fresh chunk's instanced meshes off the scene graph; they become data for the batches. */
 adopt(chunk){const held=[];for(const o of [...chunk.children])if(o.isInstancedMesh){chunk.remove(o);held.push(o);}chunk.userData.batched=held;this.dirty=true;}
 meshes(){return [...this.batches.values()];}
 rebuild(chunks){
  this.dirty=false;const groups=new Map(),m=this.m;
  for(const c of chunks)for(const h of c.userData.batched||[]){if(!h.visible||!h.count)continue;const key=`${h.geometry.uuid}|${h.material.uuid}|${h.castShadow}|${h.receiveShadow}|${!!h.userData.noReflect}`;let g=groups.get(key);if(!g)groups.set(key,g={sample:h,parts:[]});g.parts.push([c,h]);}
  for(const [key,b] of this.batches)if(!groups.has(key)){this.scene.remove(b);b.dispose();this.batches.delete(key);}
  for(const [key,{sample,parts}] of groups){
   const total=parts.reduce((n,[,h])=>n+h.count,0);let b=this.batches.get(key);
   if(!b||b.instanceMatrix.count<total){if(b){this.scene.remove(b);b.dispose();}
    b=new T.InstancedMesh(sample.geometry,sample.material,Math.ceil(total*1.4)+8);b.name='Chunk batch';b.castShadow=sample.castShadow;b.receiveShadow=sample.receiveShadow;b.userData.noReflect=!!sample.userData.noReflect;b.frustumCulled=false;this.scene.add(b);this.batches.set(key,b);}
   const colors=parts.some(([,h])=>h.instanceColor);if(colors&&!b.instanceColor)b.instanceColor=new T.InstancedBufferAttribute(new Float32Array(b.instanceMatrix.count*3).fill(1),3);
   let n=0;for(const [c,h] of parts){const src=h.instanceMatrix.array,p=c.position;
    for(let i=0;i<h.count;i++){m.fromArray(src,i*16);m.elements[12]+=p.x;m.elements[13]+=p.y;m.elements[14]+=p.z;m.toArray(b.instanceMatrix.array,(n+i)*16);}
    if(b.instanceColor){const out=b.instanceColor.array;if(h.instanceColor)out.set(h.instanceColor.array.subarray(0,h.count*3),n*3);else out.fill(1,n*3,(n+h.count)*3);}
    n+=h.count;}
   b.count=n;b.instanceMatrix.needsUpdate=true;if(b.instanceColor)b.instanceColor.needsUpdate=true;}
 }
}

export class CircuitWorld {
 constructor(canvas){
  installArcadeFog();
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.16;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(62,1,.08,300);
  this.hemi=new T.HemisphereLight(0xd5e9dd,0x34382a,2.5);this.scene.add(this.hemi);
  this.sun=new T.DirectionalLight(0xffe5be,3.1);this.sun.castShadow=true;this.sun.shadow.mapSize.setScalar(innerWidth>700?2048:1536);this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.08;this.scene.add(this.sun,this.sun.target);
  this.chunks=[];this.batches=new ChunkBatches(this.scene);this.id='';this.distance=0;this.time=0;this.ready=false;this.materials={};
  this.dummy=new T.Object3D();this.color=new T.Color();this.look=new T.Vector3();
  this.sky=createSky(this.scene);this.post=createPost(this.renderer);this.post.configure({scale:1,msaa:2,bloomLevels:4,volumetric:false,ao:false,grain:.015,motionBlur:.65});
  this.renderer.info.autoReset=false;this.post.final.contrast.value=.10;this.post.final.vignette.value=.18;this.post.final.aberration.value=.0004;this.post.final.exposure.value=1.24;
  this.post.final.volStrength.value=.42;this.post.volume.density.value=.006;
  this.practicalLights=Array.from({length:4},(_,i)=>{const light=new T.PointLight(i%2?0x87c8dd:0xffc47c,0,19,2);this.scene.add(light);return light;});
 }
 async load(){
  const loader=new T.TextureLoader();const [soil,rock,rockNormal,branch,verge,vergeNormal,floor,floorNormal,track,trackNormal,gateDiffuse,gateNormal]=await Promise.all(['ravine/gravel-diff.jpg','ravine/sandstone-diff.jpg','ravine/sandstone-nor_gl.jpg','jungle-branch.png','arcade/verge-diff.jpg','arcade/verge-nor.jpg','arcade/forest-floor-diff.jpg','arcade/forest-floor-nor.jpg','arcade/track-diff.jpg','arcade/track-nor.jpg','arcade/gate-planks-diff.jpg','arcade/gate-planks-nor.jpg'].map(p=>loader.loadAsync(`./textures/${p}`)));
  for(const t of [soil,rock,rockNormal,verge,vergeNormal,floor,floorNormal,track,trackNormal]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;}soil.colorSpace=rock.colorSpace=branch.colorSpace=verge.colorSpace=floor.colorSpace=track.colorSpace=T.SRGBColorSpace;
  this.kit=createFoliageKit(branch);
  // The shared foliage kit normally lives in a stationary Jeep frame. Here the
  // camera travels, so distance fading must be relative to the moving camera.
  // Leaves lying flat on the ground are found by height; Pursuit's road sits at y=0, the arcade's rolls, so use height above the plant's own root.
  for(const mat of Object.values(this.kit.materials)){const compile=mat.onBeforeCompile;mat.onBeforeCompile=shader=>{compile(shader);shader.vertexShader=shader.vertexShader.replaceAll('vPlantWorld.z)', '(vPlantWorld.z-cameraPosition.z))').replace('abs(anchor.z-6.)','abs(anchor.z-cameraPosition.z-6.)').replace('varying float vFade;','varying float vFade;varying float vLift;').replace('bend=h*h;','bend=h*h;vLift=position.y-base;').replace('uniform float uWindTime,uWindGust,uGrassDensity;','uniform float uWindTime,uWindGust,uGrassDensity;uniform vec4 uPush[8],uGust;').replace('*amp*bend*(1.+(uWindGust-1.)*.45);','*amp*bend*(1.+(uWindGust-1.)*.45);'+PLANT_PUSH);shader.uniforms.uPush=PUSH;shader.uniforms.uGust=GUST;shader.fragmentShader=shader.fragmentShader.replace('varying float vFade;','varying float vFade;varying float vLift;').replace('smoothstep(.12,.4,vPlantWorld.y)','smoothstep(.12,.4,vLift)');};const key=mat.customProgramCacheKey.bind(mat);mat.customProgramCacheKey=()=>key()+'-arcade-world-a5';}
  this.materials.ground=groundMaterial(this.kit,{rock,rockNormal,gravel:soil,verge,vergeNormal,floor,floorNormal,track,trackNormal});
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
  this.geometry={trunk:new T.CylinderGeometry(.22,.48,1,7,2),leaf:new T.PlaneGeometry(1,1),crown:new T.SphereGeometry(1,9,6),box:new T.BoxGeometry(1,1,1),pole:new T.CylinderGeometry(.09,.12,1,8),insulator:new T.CylinderGeometry(.045,.065,.22,8).rotateZ(Math.PI/2),plate:new T.PlaneGeometry(.62,.44)};
  this.rocks=await loadRocks();this.geometry.thrown=this.rocks.thrown;this.geometry.blob=this.rocks.blobGeometry;this.geometry.roots=[3,8,13].map(rootGeometry);
  // Track pebbles keep the kit's scrubbed stone without its moss, which assumes Pursuit's road at x=0.
  this.materials.pebble=new T.MeshStandardMaterial({map:this.kit.textures.ground.dirt,normalMap:this.kit.textures.ground.dirtNormal,normalScale:new T.Vector2(1.6,1.6),color:0x6f6a60,roughness:.88});
  const scan=await new GLTFLoader().loadAsync('./models/ravine-outcrop.glb');scan.scene.updateMatrixWorld(true);const source=scan.scene.getObjectByName('Ravine_Outcrop_LOD');this.geometry.outcrop=source.geometry.clone().applyMatrix4(source.matrixWorld);this.geometry.outcrop.computeBoundingBox();const box=this.geometry.outcrop.boundingBox,center=box.getCenter(new T.Vector3());this.geometry.outcrop.translate(-center.x,-box.min.y,-center.z);this.materials.outcrop=source.material;this.materials.outcrop.color.set(0xc5b89e);this.materials.outcrop.side=T.DoubleSide;this.materials.outcrop.roughness=.93;
  this.canopy=createCanopy(this.scene,this.sun,{width:90,height:19});this.routeCanopy=new RouteCanopy(this.canopy,{routeX,routeY});this.light=new StageLight(this,{routeX,routeY});this.light.load(this.renderer);this.air=new CircuitAir(this,{routeX,routeY,routeHeading});this.pushers=[];this.post.configure({ao:innerWidth>700?{samples:4,steps:4}:false,aoAmount:.65,volumetric:{steps:10,resolution:.4}});
  const normals=new Uint8Array(256*256*4);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const u=x/256*Math.PI*2,v=y/256*Math.PI*2,dx=Math.cos(u*7+Math.sin(v*3))*.23+Math.cos(u*19+v*11)*.1,dy=Math.cos(v*9+u*3)*.22+Math.cos(v*21-u*7)*.1,n=new T.Vector3(-dx,-dy,1).normalize(),i=(y*256+x)*4;normals.set([128+n.x*127,128+n.y*127,128+n.z*127,255],i);}const normalTexture=new T.DataTexture(normals,256,256);normalTexture.wrapS=normalTexture.wrapT=T.RepeatWrapping;normalTexture.magFilter=normalTexture.minFilter=T.LinearFilter;normalTexture.needsUpdate=true;
  this.water=new Water(new T.PlaneGeometry(250,500),{textureWidth:innerWidth>700?1024:512,textureHeight:innerWidth>700?1024:512,waterNormals:normalTexture,sunDirection:new T.Vector3(-.5,.8,-.4).normalize(),sunColor:0xfff0c9,waterColor:0x236e75,distortionScale:.85,fog:true});this.water.rotation.x=-Math.PI/2;this.water.visible=false;this.scene.add(this.water);this.river=new RiverSurface(this.water,{routeX});this.bowAt=new T.Vector3();this.fill=new T.Color();
  // The mirror pass skips small ground clutter (grass, pebbles, contact shadows, litter) and the
  // motes, leaves and insects in the air; they barely read in the reflection.
  const reflect=this.water.onBeforeRender;this.water.onBeforeRender=(...a)=>{const hidden=[];for(const o of [...this.chunks.flatMap(c=>c.children),...this.batches.meshes(),this.air.motes,this.air.leaves,this.air.insectFrame])if(o.userData.noReflect&&o.visible){o.visible=false;hidden.push(o);}reflect.apply(this.water,a);for(const o of hidden)o.visible=true;};
  this.spray=new Spray(this.scene);this.sunLit=new T.Color();
  this.signs={gates:labelTexture('JURASSIC PARK','ISLA NUBLAR • NORTH GATE'),river:labelTexture('RIVER OF GIANTS'),fault:labelTexture('SERVICE CROSSING','UNSTABLE GROUND • DO NOT STOP'),hybrid:labelTexture('INNOVATION VALLEY'),lagoon:labelTexture('LAGOON OBSERVATORY'),manor:labelTexture('THE CONSERVATORY'),visitor:labelTexture('VISITOR CENTER','WHEN GIANTS RULED THE EARTH')};
  this.materials.porcelain=new T.MeshStandardMaterial({color:0xcdbf9f,roughness:.2});this.materials.voltSign=new T.MeshStandardMaterial({map:voltTexture(),roughness:.55,metalness:.25});this.sparks=new Sparks(this.scene);
  this.fault=new Fault(this.scene,{rock:this.materials.rock,diffuse:gateDiffuse,normal:gateNormal,routeX,routeY,routeHeading,terrain:(off,z)=>terrainY(off,z,'fault',{canyon:true,bridge:z>=288&&z<640})});this.gate=new Gate(this.scene,{stone:this.materials.stone,sign:this.signs.gates,light:this.practicalLights[0],diffuse:gateDiffuse,normal:gateNormal,routeX,routeY,routeHeading,groundAt});
  this.promenade=new Promenade(this.scene,{routeX,routeY,routeHeading});this.glass=new Glass(this.scene);this.glass.floor=(x,z)=>groundAt(x,z,this.id);
  this.visitorCenter=createVisitorCenter(this.scene);this.rotunda=new Rotunda(this.scene);this.rain=new ArcadeRain(this.scene);
  // Pursuit's own ground, road and court planes would fight the arcade terrain; the building, steps, pond and planting stay.
  for(const o of [...this.visitorCenter.root.children])if(o.isMesh&&o.geometry.type==='PlaneGeometry')o.visible=false;
  this.ready=true;
 }
 instances(parent,geo,mat,items,shadow=true){
  if(!items.length)return;const mesh=new T.InstancedMesh(geo,mat,items.length);mesh.castShadow=shadow;mesh.receiveShadow=true;
  items.forEach((item,i)=>{const [x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,tint]=item;this.dummy.position.set(x,y,z);this.dummy.rotation.set(rx,ry,rz);this.dummy.scale.set(sx,sy,sz);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);if(tint!==undefined){if(Array.isArray(tint))this.color.setRGB(...tint);else this.color.setScalar(tint);mesh.setColorAt(i,this.color);}});mesh.computeBoundingSphere();parent.add(mesh);return mesh;
 }
 makeChunk(index){
  const id=this.id,m=this.materials,start=index*32,mid=start+16,g=new T.Group();g.position.z=mid;g.userData.index=index;this.scene.add(g);
  const river=id==='river'||id==='lagoon',canyon=id==='fault',interior=id==='manor',urban=['hybrid','visitor'].includes(id),bridge=canyon&&mid>280&&mid<640,cave=canyon&&mid<280;
  const flags={river,canyon,cave,bridge,urban},hAt=(off,z)=>terrainY(off,z,id,flags),baseColor=new T.Color(palettes[id].ground);
  if(!interior){const terrain=new T.Mesh(terrainGeometry(index,id,flags,{routeX,height:hAt}),m.ground);terrain.receiveShadow=true;g.add(terrain);}
  else{const geo=new T.BufferGeometry(),v=[],uv=[],colors=[],indices=[],cols=42,rows=8;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const z=start+j*4,off=(i/cols-.5)*180,edge=Math.max(0,Math.abs(off)-6),height=routeY(z,id)+(interior||urban?edge*.018:edge*.07+Math.sin(z*.12+off*.16)*Math.min(3,edge*.05));
   let y=height;if(river&&Math.abs(off)<27)y-=3;if(bridge&&Math.abs(off)<21)y-=14;if(canyon)y+=clamp((Math.abs(off)-12)/18,0,1)*(27+Math.sin(z*.07)*3);
   v.push(routeX(z,id)+off,y,z-mid);uv.push(off*.14,z*.14);const c=baseColor.clone().multiplyScalar(.86+noise(i*13+j*11+index*99)*.2);if(Math.abs(off)>6&&!canyon&&!interior&&!urban)c.lerp(new T.Color(0x536e3b),.75);if(Math.abs(off)<5.7)c.multiplyScalar(1.19);colors.push(c.r,c.g,c.b);
   if(j<rows&&i<cols){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}
  }
  geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();const terrain=new T.Mesh(geo,m.floor);terrain.receiveShadow=true;g.add(terrain);}
  // The conservatory's floor runs as a separate marble track; outdoors the ground material paints the track.
  if(interior){const pos=[],tex=[],col=[],idx=[];for(let j=0;j<=16;j++)for(let k=0;k<=8;k++){const z=start+j*2,off=(k/8-.5)*11,yy=routeY(z,id)+.08+(interior||urban?0:Math.sin(k*1.7)*.018);pos.push(routeX(z,id)+off,yy,z-mid);tex.push(off*.23,z*.2);const c=baseColor.clone().multiplyScalar(k===2||k===6?.53:interior?1.12:.84);col.push(c.r,c.g,c.b);if(j<16&&k<8){const a=j*9+k;idx.push(a,a+9,a+1,a+1,a+9,a+10);}}
   const road=new T.BufferGeometry();road.setAttribute('position',new T.Float32BufferAttribute(pos,3));road.setAttribute('uv',new T.Float32BufferAttribute(tex,2));road.setAttribute('color',new T.Float32BufferAttribute(col,3));road.setIndex(idx);road.computeVertexNormals();const mesh=new T.Mesh(road,m.floor);mesh.receiveShadow=true;g.add(mesh);
  }
  const trunks=[],leaves=[],wood=[],posts=[],stone=[],metal=[],lamps=[],insulators=[],plates=[],glass=[],palms=[],ferns=[],bushes=[],grass=[],outcrops=[],treeFerns=[],lava=[],facades=[];
  const add=(arr,off,y,z,sx,sy,sz,rx=0,ry=0,rz=0,tint)=>arr.push([routeX(z,id)+off,routeY(z,id)+y,z-mid,sx,sy,sz,rx,ry,rz,tint]);
  if(bridge){const points=[],faces=[];for(let j=0;j<=16;j++)for(let i=0;i<=24;i++){const z=start+j*2;points.push(routeX(z,id)+(i/24-.5)*50,routeY(z,id)-10,z-mid);if(j<16&&i<24){const k=j*25+i;faces.push(k,k+25,k+1,k+1,k+25,k+26);}}const waterGeometry=new T.BufferGeometry();waterGeometry.setAttribute('position',new T.Float32BufferAttribute(points,3));waterGeometry.setIndex(faces);waterGeometry.computeVertexNormals();g.add(new T.Mesh(waterGeometry,m.water));}
  // The lava tube and the rope bridge (fault.js).
  if(cave)this.fault.cave(g,start,mid,id,hAt);
  if(bridge)this.fault.bridge(g,start,mid,id);
  if(id==='hybrid')this.promenade.chunk(g,start,mid,id,index);
  // Rocks, clumped planting and track clutter (ground.js); rock buckets are keyed by their scan.
  const rockBuckets=new Map(),blobs=[],pebbles=[],stillItems={bark:[],shrub:[],palm:[],fern:[]},kit=this.kit,C=kit.clutter,matrix=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),sv=new T.Vector3(),pv=new T.Vector3();
  const buckets={grass,fern:ferns,bush:bushes,treeFern:treeFerns,blob:blobs,pebble:pebbles};
  // The Visitor Center's forecourt and building stay clear of forest; it frames them from the sides.
  const plaza=(off,z)=>id==='visitor'&&z>PLAZA-16&&Math.abs(off)<36;
  const put=(bucket,off,y,z,sx,sy,sz,rx=0,ry=0,rz=0,tint)=>{if(plaza(off,z))return;let arr=buckets[bucket];if(!arr){if(!rockBuckets.has(bucket))rockBuckets.set(bucket,[]);arr=rockBuckets.get(bucket);}arr.push([routeX(z,id)+off,y,z-mid,sx,sy,sz,rx,ry,rz,tint]);};
  const still=(kind,off,y,z,yaw,scale,tone)=>{if(plaza(off,z))return;matrix.compose(pv.set(routeX(z,id)+off,y,z-mid),q.setFromEuler(e.set(0,yaw,0)),sv.setScalar(scale));const m2=matrix.clone();
   if(kind==='limb'){const limb=C.limbs[stillItems.bark.length%2];stillItems.bark.push({geometry:limb.wood,matrix:m2});stillItems.shrub.push({geometry:limb.leaves,matrix:m2,tone});}
   else if(kind==='root')stillItems.bark.push({geometry:this.geometry.roots[Math.floor(noise(z*3.1+off)*3)],matrix:matrix.compose(pv.set(routeX(z,id)+off,y,z-mid),q.setFromEuler(e.set(0,yaw,0)),sv.set(scale*.9,scale*.9,scale*3.2)).clone(),tone});
   else if(kind==='branch')stillItems.bark.push({geometry:C.branches[Math.floor(noise(z*7.3+off)*3)],matrix:m2,tone});
   else stillItems[kind==='fernFrond'?'fern':'palm'].push({geometry:kind==='fernFrond'?C.fernFronds[0]:C.palmFronds[Math.floor(noise(z*5.7+off)*2)],matrix:m2,tone});};
  if(!interior){
   // Trees have tapered trunks, crowns and layered branch cards; understory hides entrances.
   const count=cave?0:canyon?3:urban?6:15;
   for(let i=0;i<count;i++){const seed=index*73+i*19,z=start+noise(seed)*32,side=i%2?1:-1,off=side*((river?29:urban?(plaza(12,z)?37:12):8)+noise(seed+1)*(canyon?35:29)),height=9+noise(seed+2)*12;
    const ground=Math.min(hAt(off,z),hAt(off+.6,z),hAt(off-.6,z)),base=ground-routeY(z,id);
    add(i%3===0?palms:trunks,off,base,z,height,height,height,0,seed,side*.015,.85+noise(seed+3)*.3);
    // Surface roots fan out from the giants' buttresses and dive into the litter.
    if(i%3!==0&&!urban)for(let k=0,n=3+Math.floor(noise(seed+5)*3);k<n;k++){const a=seed+k*TAU/n+noise(seed+k)*.8;still('root',off+Math.sin(a)*.35,ground-.04,z+Math.cos(a)*.35,a,.8+height*.04+noise(seed+k+9)*.5,[.85,.82,.75]);}
   }
   g.userData.wet=[];scatter(index,id,flags,{height:hAt,put,still,rocks:this.rocks.kinds,wet:(off,z,r)=>g.userData.wet.push([routeX(z,id)+off,z,r])});
   if(canyon)for(const side of [-1,1])for(let i=0;i<3;i++){const z=start+i*12,scale=2.1+noise(index*3+i)*.3;add(outcrops,side*19,-2,z,scale,scale*1.3,scale,0,-side*Math.PI/2);}
  }
  if((interior||urban||id==='lagoon')&&!(id==='visitor'&&start>=PLAZA-16)){
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
  // The gates stage has its own timber gate (gate.js) and no fence outside it.
  if(index===1&&id!=='gates'){const z=mid;for(const side of [-1,1])add(stone,side*7,5,z,1.8,10,2);add(wood,0,9,z,15,1.35,1.2);const sign=new T.Mesh(new T.PlaneGeometry(11,2.75),new T.MeshStandardMaterial({map:this.signs[id],roughness:.8}));sign.position.set(routeX(z,id),routeY(z,id)+8.4,z-mid-1.02);sign.rotation.y=Math.PI;g.add(sign);}
  // Electric fence: wires strung post to post on ceramic insulators, a DANGER plate on every
  // other post. Past the gate some spans are cut: both halves hang from their posts to the
  // ground and the live ends spark (sparks.js).
  if(id==='gates'||id==='hybrid'){
   const sparks=[],cutSide=noise(index*7.3)<.5?-1:1,cutAt=id==='gates'&&start>GATE_Z+20&&noise(index*3.1+.5)>.66?start+8*Math.floor(noise(index*5.7)*4):null;
   for(const side of [-1,1])for(let z=start;z<start+32;z+=8){if(id==='gates'&&z<GATE_Z+12)continue;const wx=side*6.2;
    add(posts,side*6.4,1.7,z,1,3.4,1);add(lamps,side*6.4,3.2,z,.15,.08,.15);
    if((z/8+(side>0?1:0))%2===0)add(plates,side*6.26,1.85,z,1,1,1,0,routeHeading(z,id)-side*Math.PI/2);
    for(let y=.6;y<3.2;y+=1){add(insulators,side*6.3,y,z,1,1,1,0,routeHeading(z,id));
     if(side!==cutSide||z!==cutAt){add(metal,wx,y,z+4,.026,.026,8,0,routeHeading(z+4,id));continue;}
     // Each half whips loose from its post and lies across the verge, its live end on the road edge.
     // Box axis along d = (dx,dy,dz): ry = asin(dx), rx = atan2(-dy,dz) for Three's XYZ order.
     for(const [z0,dir,reach,inward]of [[z,1,1.1+y*.55,.5+y*.4],[z+8,-1,1.5+y*.4,.7+y*.3]]){const drop=y-.04,dx=-side*inward,dz=dir*reach,len=Math.hypot(dx,drop,dz),x1=wx+dx;
      add(metal,wx+dx/2,y-drop/2,z0+dz/2,.026,.026,len,Math.atan2(drop/len,dz/len),Math.asin(dx/len)+routeHeading(z0,id));
      if(y>1)sparks.push(new T.Vector3(routeX(z0+dz,id)+x1,routeY(z0+dz,id)+.06,z0+dz));}
    }}
   g.userData.sparks=sparks;
  }
  if((id==='lagoon'||id==='hybrid')&&index===5){const z=mid;for(const side of [-1,1])add(stone,side*31,6.5,z,1.4,13,3);add(metal,0,13,z,65,.75,2);add(stone,-6,15,z,13,2.5,3);add(glass,-6,15.3,z-1.55,11,1.1,.04);add(lamps,-6,13.8,z-1.6,13,.09,.09);}
  // Crowns and fronds cast the shade on the track; on the open lagoon it would only fall on water.
  const giant=kit.giants[Math.abs(index)%kit.giants.length],palm=kit.palms[Math.abs(index)%kit.palms.length],shade=id!=='lagoon';
  this.instances(g,giant.wood,kit.materials.bark,trunks);this.instances(g,giant.leaves,kit.materials.canopy,trunks,shade);this.instances(g,palm.wood,kit.materials.bark,palms);this.instances(g,palm.fronds,kit.materials.palm,palms,shade);
  this.instances(g,kit.ferns[Math.abs(index)%3],kit.materials.fern,ferns,false);// Kit bushes are single leaf-card geometries (no wood); the 3.5 m one, scaled per clump.
  this.instances(g,kit.bushes[0],kit.materials.shrub,bushes,false);const tufts=this.instances(g,kit.grass[Math.abs(index)%2],kit.materials.grass,grass,false);if(tufts)tufts.userData.noReflect=true;
  const treeFern=kit.treeFerns[Math.abs(index)%2];this.instances(g,treeFern.wood,kit.materials.bark,treeFerns);this.instances(g,treeFern.fronds,kit.materials.fern,treeFerns,shade);this.instances(g,this.geometry.outcrop,m.outcrop,outcrops);
  this.instances(g,this.geometry.leaf,m.leaf,leaves,false);
  for(const [kind,items]of rockBuckets){const mesh=this.instances(g,kind.near,kind.material,items);mesh.userData.lod=kind;}
  for(const mesh of [this.instances(g,this.geometry.blob,this.rocks.blob,blobs,false),this.instances(g,C.pebbles[Math.abs(index)%3],m.pebble,pebbles)])if(mesh)mesh.userData.noReflect=true;
  for(const [name,items]of Object.entries(stillItems)){const geometry=mergeStill(items);if(!geometry)continue;const mesh=new T.Mesh(geometry,kit.materials[name]);mesh.castShadow=name==='bark';mesh.receiveShadow=true;mesh.userData.noReflect=true;g.add(mesh);}this.instances(g,this.geometry.box,m.wood,wood);this.instances(g,this.geometry.pole,m.metal,posts);this.instances(g,this.geometry.box,m.stone,stone);this.instances(g,this.geometry.box,m.metal,metal);this.instances(g,this.geometry.box,m.lamp,lamps,false);this.instances(g,this.geometry.insulator,m.porcelain,insulators,false);this.instances(g,this.geometry.plate,m.voltSign,plates,false);this.instances(g,this.geometry.box,m.glass,glass,false);this.instances(g,this.geometry.box,m.lava,lava,false);
  this.instances(g,this.geometry.leaf,interior?m.manorFacade:id==='visitor'?m.visitorFacade:m.modernFacade,facades);
  // Ground cover (grass, ferns, shrubs and their litter) drops out of far chunks on the lower tiers (coverDistance).
  const small=[kit.materials.grass,kit.materials.fern,kit.materials.shrub];g.userData.cover=g.children.filter(o=>o.isMesh&&small.includes(o.material));
  return g;
 }
 disposeChunk(g){this.scene.remove(g);for(const h of g.userData.batched||[])h.dispose();g.userData.batched=[];this.batches.dirty=true;const shared=new Set([...Object.values(this.materials),...Object.values(this.kit.materials)]);g.traverse(o=>{if(o.isInstancedMesh){o.dispose();return;}if(o.isLineSegments){o.geometry.dispose();o.material.dispose();return;}if(o.isMesh&&!Object.values(this.geometry).includes(o.geometry))o.geometry.dispose();if(o.isMesh&&!shared.has(o.material)&&!o.material.userData.shared)o.material.dispose();});}
 setStage(id){if(this.id===id)return;
  this.rain.reset();{const r=this.rotunda;r.root.visible=false;r.reset();this.doorBroken=false;if(id==='visitor'){const k=Math.hypot(1,DX0(PLAZA)),zd=PLAZA+DOOR/k;r.place(new T.Vector3(routeX(zd,id),Y0(PLAZA)+STEPS[2],zd),Math.atan(DX0(PLAZA)));}}
  {const v=this.visitorCenter,on=id==='visitor';v.root.visible=on;if(on){const h=routeHeading(PLAZA,id);v.root.position.set(routeX(PLAZA,id),routeY(PLAZA,id),PLAZA);v.root.rotation.set(0,Math.PI+h,0);}}this.spray.reset();for(const g of this.chunks)this.disposeChunk(g);this.chunks=[];this.id=id;const p=palettes[id];this.light.setStage(id);this.air.setStage(id);this.materials.ground.setStage(id);this.rocks.setStage(id);this.materials.leaf.color.set(p.leaf).multiplyScalar(1.45);this.materials.canopy.color.set(p.leaf).multiplyScalar(.77);this.materials.water.color.set(p.water);}
 sync(game,{reduced=false,time=0,shake=0}={}){
  if(!this.ready)return;const id=game?.stage.id||'gates';this.setStage(id);this.distance=game?.travel??time*4;const before=this.time;this.time=game?.time??time;const dt=clamp(this.time-before,0,.1);this.wave.value=this.time;
  const first=Math.floor(this.distance/32)-1;for(const g of this.chunks.filter(g=>g.userData.index<first||g.userData.index>first+8)){this.disposeChunk(g);this.chunks.splice(this.chunks.indexOf(g),1);}for(let i=first;i<=first+8;i++)if(!this.chunks.some(g=>g.userData.index===i)){const c=this.makeChunk(i);this.batches.adopt(c);this.chunks.push(c);}
  // Scanned rocks drop to their far LOD beyond 70 m.
  for(const chunk of this.chunks){const ahead=chunk.position.z-this.distance,cover=ahead<(this.coverDistance??Infinity);if(chunk.userData.coverOn!==cover){chunk.userData.coverOn=cover;for(const o of chunk.userData.cover||[])o.visible=cover;this.batches.dirty=true;}const far=ahead>70;if(chunk.userData.far!==far){chunk.userData.far=far;for(const o of [...chunk.children,...(chunk.userData.batched||[])])if(o.userData.lod)o.geometry=far?o.userData.lod.far:o.userData.lod.near;this.batches.dirty=true;}}
  if(this.batches.dirty)this.batches.rebuild(this.chunks);
  const z=this.distance,move=reduced?0:1,rough=id==='fault'?1.7:1,roll=Math.sin(z*.071)*.007*move;
  // Anchor the leap to the actual gap, so Overdrive cannot land us in midair.
  const leap=id==='fault'&&game?.bridgeBroken?(z-game.bridgeOrigin+30)/60:-1;
  const drop=leap>0&&leap<1?-Math.sin(leap*Math.PI)*2.3*move:0,nose=leap>0&&leap<1?Math.cos(leap*Math.PI)*1.5*move:0;
  if(leap>=1&&this.leapWas>0&&this.leapWas<1&&game.phase!=='clear'){this.vehicle?.land(1);this.fault.cue({type:'land'});}this.leapWas=leap;
  // After a Rex goes down the camera cranes up off the vehicle, so her fall reads
  // from above instead of foreshortened behind her own head.
  if(id==='visitor')this.rotunda.update(dt,game);
  const crane=game?.phase==='clear'&&DRIVE[game.stage.boss]?T.MathUtils.smootherstep(game.phaseTime,.2,2.6)*move:0;
  // A14 closing shot: after the last king falls the crane keeps rising and looks up at the rotunda's banner.
  const closing=id==='visitor'&&game?.phase==='clear'?T.MathUtils.smootherstep(game.phaseTime,2.1,4.9)*move:0;
  // The vehicle (vehicle.js) rides under the route eye point; its spring rig tilts the camera with it.
  // A14: up the Visitor Center's steps the Jeep thumps over each tread (0.51 m apart).
  const along=id==='visitor'?plazaAxis(z):0,treads=along>STEPS[0]&&along<STEPS[1]?(1-Math.abs(Math.sin((along-STEPS[0])/.508*Math.PI)))*.09*move:0;
  const eye=(this.eye??=new T.Vector3()).set(routeX(z,id)+Math.sin(z*.11)*.10*move,routeY(z,id)+2.65-drop-treads,z);
  this.look.set(routeX(z+24,id),routeY(z+24,id)+2.25-drop+nose-crane*3.3,z+24);const rig=game&&this.vehicle?this.vehicle.ride(dt,eye,this.look,{id,rough,move,hp:game.hp}):null;
  this.camera.position.copy(eye);this.camera.position.y+=crane*3.6+closing*4.5+Math.sin(this.time*64)*shake*.12*move+(rig?rig.heave:Math.sin(z*1.2)*.025*rough*move);
  if(closing>0){(this.closingAt??=new T.Vector3()).copy(this.rotunda.centre);this.camera.lookAt(this.closingAt.lerp(this.look,1-closing));}else this.camera.lookAt(this.look);this.camera.rotateZ(roll);if(rig){this.camera.rotateY(rig.yaw);this.camera.rotateX(rig.pitch);this.camera.rotateZ(rig.roll);}this.camera.updateMatrixWorld();
  this.lit=this.light.update(game,{z,camera:this.camera,time:this.time});this.gate.update(id,this.camera,this.time,{height:this.renderer.domElement.height});
  const live=[];if(id==='gates')for(const chunk of this.chunks)for(const s of chunk.userData.sparks||[])if(s.z>z-6&&s.z<z+70)live.push(s);this.sparks.update(dt,live,this.camera,this.renderer.domElement.height);
  // The canopy's dapple is pinned to the ground; open stages light the air from the shadow map alone.
  this.shafts=this.routeCanopy.update(z,id,this.light.key,{enabled:['gates','river','hybrid'].includes(id)});this.sky.mesh.visible=id!=='manor';
  this.air.update(game,{z,camera:this.camera,dt,time:this.time,key:this.light.key,canopy:this.shafts,pushers:this.pushers});
  this.water.visible=['river','lagoon'].includes(id);if(this.water.visible){this.water.position.set(routeX(z,id),LEVEL,z+80);this.water.material.uniforms.time.value=this.time;
   // The bow wave rides the launch's stem; rocks that break the surface come from the chunks.
   const boat=this.vehicle?.boat.root,speed=game?.speed??0;let bow=null;if(boat?.visible){boat.localToWorld(this.bowAt.set(0,0,BOW));const h=Math.atan2(this.look.x-this.eye.x,this.look.z-this.eye.z);bow={x:this.bowAt.x,z:this.bowAt.z,dirX:Math.sin(h),dirZ:Math.cos(h),speed};}
   this.river.update({camera:this.camera,id,dt,time:this.time,bow,ford:id==='river'?[BRACHIO.z,FORD]:null,rocks:this.chunks.flatMap(c=>c.userData.wet||[]),fill:this.fill});this.water.material.uniforms.waterColor.value.set(palettes[id].water).multiplyScalar(.48);}
  // Thrown water: the bow sheets on the water stages, splashes anywhere (spray.js).
  if(this.water.visible&&this.vehicle)this.spray.bow(dt,this.vehicle.boat.root,game?.speed??0,this.vehicle.slap,this.vehicle.effects);
  this.fill.copy(this.hemi.color).lerp(this.hemi.groundColor,.35).multiplyScalar(this.hemi.intensity*.16);this.sunLit.copy(this.sun.color).multiplyScalar(this.sun.intensity/Math.PI);if(dt>0){this.camVel??=new T.Vector3();if(this.lastCam)this.camVel.subVectors(this.camera.position,this.lastCam).divideScalar(dt);(this.lastCam??=new T.Vector3()).copy(this.camera.position);}
  this.spray.update(dt,{dir:this.light.key,sun:this.sunLit,fill:this.fill},this.camVel);
  if(id==='fault'){this.fault.haze=this.scene.fog?.color;this.fault.reduced=reduced;this.fault.update(game,this.chunks,{camera:this.camera,time:this.time,dt,effects:this.vehicle?.effects});}else if(this.fault.plume.visible){this.fault.plume.visible=false;for(const b of this.fault.bombs){b.live=false;b.mesh.visible=b.flame.visible=false;}}
  if(id==='hybrid')this.promenade.update(game,this.camera);else this.promenade.hide();
  // A14: the exterior gives way to the rotunda set as the camera passes the doors, which the Jeep smashes through.
  if(id==='visitor'){const along=plazaAxis(z),inside=along>DOOR-.3;this.visitorCenter.root.visible=!inside;this.rotunda.root.visible=inside;
   if(!this.doorBroken&&along>DOOR-3.4&&along<DOOR+2){this.doorBroken=true;const at=this.rotunda.toWorld(0,2.4,-.3),fwd=this.rotunda.toWorld(0,0,1).sub(this.rotunda.root.position);this.glass.burst(at,{count:90,dir:fwd.multiplyScalar(1.5),speed:3});this.vehicle?.hit(at,.8);}
   if(along<DOOR-12)this.doorBroken=false;}
  this.glass.update(dt);if(this.visitorCenter.root.visible)this.visitorCenter.update(this.time);
  WIND.value=this.time;this.sky.update(this.camera,this.time);this.post.settings.motionBlur=reduced?0:.65;
 }
 // Creatures (and only creatures) take a rim of the stage's key light.
 /** A14: the kings' heads (world x, z) break the rotunda's glass curtain as they come through it. */
 breach(heads){if(this.id!=='visitor'||!this.rotunda.root.visible)return;const back=this.rotunda.toWorld(0,0,-1).sub(this.rotunda.root.position).multiplyScalar(2.5);for(const at of this.rotunda.breach(heads)){this.glass.burst(at,{count:55,dir:back,speed:3.5});}}
 rimCreatures(root){root.traverse(o=>{if(o.isSkinnedMesh||o.userData.creature)for(const m of [].concat(o.material))addRim(m);});}
 resize(w,h){this.camera.aspect=w/h;this.camera.fov=w<h?76:62;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
 render(){if(this.ready){this.renderer.info.reset();if(this.post.supported)this.post.render(this.scene,this.camera,{time:this.time,sun:this.sun,canopy:this.shafts,overlay:this.overlay});else this.renderer.render(this.scene,this.camera);}}
}
