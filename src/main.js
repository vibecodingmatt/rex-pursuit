import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { prepareModel } from './prepare-model.js';
import { finishTongue } from './creature-materials.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const authoring=new URLSearchParams(location.search).has('author');
const canvas=$('#scene'), renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
const scene=new THREE.Scene();scene.background=new THREE.Color('#101b1e');scene.fog=new THREE.FogExp2('#101b1e',.027);
const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.05,180);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.065;controls.minDistance=2;controls.maxDistance=34;controls.maxPolarAngle=Math.PI*.51;controls.enablePan=true;
const envScene=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(envScene,.04).texture;scene.environmentIntensity=.32;envScene.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xc9ddd8,0x302719,1.25));
function areaLight(color,intensity,pos){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);scene.add(light);return light;}
const key=areaLight(0xffdeae,3.6,[-8,12,9]);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.1,far:60});key.shadow.bias=-.0001;key.shadow.normalBias=.025;
const rim=areaLight(0xb3c8d0,2,[7,8,-8]);const fill=areaLight(0xffe2bf,1.8,[5,4,10]);

let seed=431;function rand(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const floorCanvas=document.createElement('canvas');floorCanvas.width=floorCanvas.height=512;const ctx=floorCanvas.getContext('2d');ctx.fillStyle='#81847d';ctx.fillRect(0,0,512,512);
for(let i=0;i<22000;i++){const n=90+rand()*100;ctx.fillStyle=`rgba(${n},${n},${n},${rand()*.24})`;const r=rand()*2+.2;ctx.fillRect(rand()*512,rand()*512,r,r);}
const floorMap=new THREE.CanvasTexture(floorCanvas);floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(20,20);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0x2f3b38,map:floorMap,bumpMap:floorMap,bumpScale:.03,roughness:.3,metalness:.18}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const ring=new THREE.Mesh(new THREE.RingGeometry(7.6,7.615,192),new THREE.MeshBasicMaterial({color:0x809080,transparent:true,opacity:.27,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.012;scene.add(ring);
const marks=new THREE.Group();scene.add(marks);
for(let i=-8;i<=8;i++){const mark=new THREE.Mesh(new THREE.PlaneGeometry(i%5===0?.08:.035,i%5===0?.5:.21),new THREE.MeshBasicMaterial({color:0x8e987c,transparent:true,opacity:.4}));mark.rotation.x=-Math.PI/2;mark.position.set(i,.015,4.7);marks.add(mark);}
for(const x of [-7,7]){const m=new THREE.Mesh(new THREE.BoxGeometry(.035,.025,2.2),new THREE.MeshStandardMaterial({color:0xd7a055,emissive:0xd7a055,emissiveIntensity:2}));m.position.set(x,.025,-2);scene.add(m);}
// A 1.75 m figure provides a real-world scale reference.
const human=new THREE.Group();const humanMat=new THREE.MeshStandardMaterial({color:0x889a90,roughness:.7,metalness:.25});
function capsule(radius,length,position){const m=new THREE.Mesh(new THREE.CapsuleGeometry(radius,length,5,8),humanMat);m.position.set(...position);m.castShadow=true;human.add(m);return m;}
capsule(.105,.1,[0,1.6,0]);capsule(.17,.38,[0,1.2,0]);capsule(.065,.69,[-.11,.45,0]);capsule(.065,.69,[.11,.45,.02]);capsule(.055,.48,[-.22,1.12,0]).rotation.z=-.1;capsule(.055,.48,[.22,1.12,0]).rotation.z=.1;human.position.set(4.1,0,1.5);scene.add(human);
const particleGeo=new THREE.BufferGeometry();const dust=new Float32Array(400*3);for(let i=0;i<dust.length;i+=3){dust[i]=(rand()-.5)*35;dust[i+1]=rand()*11;dust[i+2]=(rand()-.5)*30;}
particleGeo.setAttribute('position',new THREE.BufferAttribute(dust,3));const motes=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x9aac9d,size:.018,transparent:true,opacity:.22,depthWrite:false}));scene.add(motes);

const actor=new THREE.Group();scene.add(actor);let rex,mixer,sourceClip,bones=[],bodyMesh,rest=new Map(),clipTime=13,paused=false,elapsed=0,action='idle',actionTime=0,damage=0,lightMode=false,currentView='portrait',cameraMove=null;
const targetPos=new THREE.Vector3(),tmpQ=new THREE.Quaternion();const axisX=new THREE.Vector3(1,0,0),axisY=new THREE.Vector3(0,1,0),axisZ=new THREE.Vector3(0,0,1);
const views={portrait:{pos:[11.0,4.6,14],target:[-1.8,1.8,1]},encounter:{pos:[0,1.75,11.2],target:[0,4.3,1.8]},detail:{pos:[4.5,5.4,10.2],target:[0,4.4,5.5]},side:{pos:[20,4.2,.4],target:[0,2.7,-.8]}};
function setView(name,instant=false){currentView=name;document.body.dataset.view=name;const v=views[name];const p=new THREE.Vector3(...v.pos),t=new THREE.Vector3(...v.target);if(innerWidth<640&&name==='portrait'){p.set(7,5,24);t.set(0,1.6,2.5);if(innerHeight<740){p.set(8,5.5,27);t.y=.55;}}if(instant){camera.position.copy(p);controls.target.copy(t);controls.update();}else cameraMove={from:camera.position.clone(),to:p,fromT:controls.target.clone(),toT:t,t:0};$$('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===name));human.visible=name==='portrait'||name==='side';$('#hint').textContent=name==='encounter'?(innerWidth<640?'DRAG TO LOOK · PINCH TO EXPLORE':'A / D TO STRAFE · SPACE TO DODGE · DRAG TO LOOK'):'DRAG TO ORBIT · SCROLL TO EXPLORE';}
setView('portrait',true);controls.addEventListener('start',()=>cameraMove=null);

const damageUniform={value:0};
function installDamage(material,geometry){
 geometry.computeBoundingBox();const bb=geometry.boundingBox;const span=bb.getSize(new THREE.Vector3());
 material.onBeforeCompile=shader=>{
  shader.uniforms.uDamage=damageUniform;shader.uniforms.uGrade={value:authoring?1:0};shader.uniforms.uRestMin={value:bb.min};shader.uniforms.uRestSize={value:span};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRexRest; uniform vec3 uRestMin; uniform vec3 uRestSize;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRexRest=(position-uRestMin)/uRestSize;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform float uDamage; uniform float uGrade; varying vec3 vRexRest;
float scratch(vec2 p,vec2 a,vec2 b,float width){vec2 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return 1.-smoothstep(width*.4,width,length(pa-ba*h));}
float scars(vec2 p){float s=0.;
 s=max(s,scratch(p,vec2(.63,.76),vec2(.77,.66),.007));
 s=max(s,scratch(p,vec2(.64,.79),vec2(.80,.69),.006));
 s=max(s,scratch(p,vec2(.66,.82),vec2(.82,.72),.0045));
 s=max(s,scratch(p,vec2(.36,.47),vec2(.47,.31),.006));
 s=max(s,scratch(p,vec2(.4,.47),vec2(.51,.31),.004));return s;}
float hashR(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`).replace('#include <color_fragment>',`#include <color_fragment>
float rexLuma=dot(diffuseColor.rgb,vec3(.299,.587,.114));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(rexLuma*1.04,rexLuma*.66,rexLuma*.40),.95*uGrade);
float oralMask=smoothstep(.23,.46,rexLuma)*smoothstep(.81,.87,vRexRest.z)*(1.-smoothstep(.81,.86,vRexRest.y));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.025,.028),oralMask*.9);
// Rest-space coordinates keep wounds attached as the skeleton deforms.
vec2 woundUV=vec2(vRexRest.z,vRexRest.y);
float scar=scars(woundUV);
float fresh=smoothstep(.9,2.1,uDamage);
float reveal=smoothstep(0.,.8,uDamage);
float bloodPatch=exp(-dot((woundUV-vec2(.73,.74))*vec2(12.,18.),(woundUV-vec2(.73,.74))*vec2(12.,18.)));
bloodPatch+=.6*exp(-dot((woundUV-vec2(.46,.38))*vec2(18.,14.),(woundUV-vec2(.46,.38))*vec2(18.,14.)));
float noiseR=hashR(floor(woundUV*200.));
float blood=clamp((scar*.92+bloodPatch*(.3+noiseR*.6))*fresh,0.,.94);
float drip=(1.-smoothstep(.0,.007,abs(woundUV.x-.716-sin(woundUV.y*38.)*.003)))*smoothstep(.47,.65,woundUV.y)*(1.-smoothstep(.7,.73,woundUV.y))*smoothstep(2.,3.,uDamage);
vec3 scarColor=mix(vec3(.30,.16,.095),vec3(.16,.012,.006),fresh);
diffuseColor.rgb=mix(diffuseColor.rgb,scarColor,scar*reveal*.84);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.003,.002),clamp(blood+drip*.9,0.,.95));
`).replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(max(.48,roughnessFactor),.32,clamp(blood+drip,0.,1.));');
 };
 material.customProgramCacheKey=()=> 'rex-damage-v1';
}

function pose(name,angle,axis=axisX){const b=bones.find(x=>x.name===name||x.name.startsWith(name));if(b){b.quaternion.multiply(tmpQ.setFromAxisAngle(axis,angle));}}
function restorePose(){for(const [b,r] of rest){b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}}
function smoothPulse(t,a,b,c,d){const s=THREE.MathUtils.smoothstep;return s(t,a,b)*(1-s(t,c,d));}
function animateCreature(dt){
 if(!rex||paused)return;elapsed+=dt;actionTime+=dt;restorePose();
 const phase=elapsed*Math.PI/4,breath=Math.sin(phase*2),scan=Math.sin(phase)*.06+Math.sin(phase*2)*.014;
 pose('back_02_',breath*.006);pose('back_04_',breath*.011);pose('neck_01_',breath*.006);pose('head_',scan,axisY);pose('jaw_01_',-.025-breath*.012);
 for(let i=1;i<=11;i++)pose(`tail_${String(i).padStart(2,'0')}_`,Math.sin(phase-i*.35)*.017,axisZ);
 pose('arm_01_L_',Math.sin(phase*2+.3)*.016);pose('arm_01_R_',Math.sin(phase*2)*.014);
 const t=actionTime;let duration=0,impact=0;
 if(action==='roar'){duration=4.8;const rise=smoothPulse(t,.2,1.4,3.1,4.7),jaw=smoothPulse(t,.65,1.45,3.2,4.3);pose('neck_01_',.10*rise);pose('neck_03_',.08*rise);pose('head_',.07*rise+Math.sin(t*17)*.006*jaw);pose('jaw_01_',-.68*jaw);pose('back_04_',.02*rise);pose('jaw_02_',.025*jaw);impact=jaw;}
 if(action==='bite'){duration=2.8;const wind=smoothPulse(t,0,.6,.65,1.05),strike=smoothPulse(t,.65,.95,1.12,2.6),jaw=smoothPulse(t,.2,.65,.92,1.12);pose('neck_01_',.10*wind-.22*strike);pose('neck_03_',.08*wind-.15*strike);pose('head_',.08*strike);pose('jaw_01_',-.62*jaw);pose('back_04_',-.05*strike);actor.position.z=strike*.8;impact=smoothPulse(t,.9,1,1.1,1.35);}
 if(action==='recoil'){duration=2.7;const hit=smoothPulse(t,0,.18,.35,2.7);pose('head_',.12*hit);pose('head_',.12*hit,axisZ);pose('neck_01_',.10*hit);pose('jaw_01_',-.22*hit);pose('back_04_',.04*hit);}
 if(action==='tail'){duration=3.6;const wind=smoothPulse(t,0,.75,.8,1.25),sweep=smoothPulse(t,.8,1.2,1.6,3.6);for(let i=1;i<=11;i++)pose(`tail_${String(i).padStart(2,'0')}_`,(.09*wind-.18*sweep)*(1-i*.025),axisZ);pose('back_01_',.1*wind-.14*sweep,axisZ);pose('head_',-.2*sweep,axisY);}
 if(action!=='bite')actor.position.z=THREE.MathUtils.damp(actor.position.z,0,5,dt);
 if(duration&&t>duration)trigger('idle');
 if(currentView==='encounter'&&impact>.1){camera.position.x+=Math.sin(elapsed*53)*impact*.004;camera.position.y+=Math.cos(elapsed*61)*impact*.003;}
 rex.updateMatrixWorld(true);
}
function trigger(name){paused=false;$('#pause').innerHTML='Ⅱ <span>Pause</span>';action=name;actionTime=0;$$('[data-action]').forEach(b=>b.classList.toggle('selected',b.dataset.action===name));$('#behavior-state').textContent={idle:'BREATHING',roar:'THREAT DISPLAY',bite:'WINDUP → STRIKE',recoil:'HIT REACTION',tail:'AREA ATTACK'}[name];if(name!=='idle')playSound(name);}

const draco=new DRACOLoader().setDecoderPath(`${import.meta.env?.BASE_URL||'/'}draco/`);const loader=new GLTFLoader().setDRACOLoader(draco);
loader.load(`${import.meta.env?.BASE_URL||'/'}models/${authoring?'rex.glb':'rex-hero.glb'}`,gltf=>{
 rex=gltf.scene;actor.add(rex);sourceClip=gltf.animations.find(a=>a.name==='Idle')||gltf.animations[0];mixer=new THREE.AnimationMixer(rex);
 let box,scale=1;
 if(authoring){
 const baseAction=mixer.clipAction(sourceClip);baseAction.play();mixer.setTime(13);
 const planted=new Map();rex.getObjectByName('leg_01_L_047').traverse(b=>{if(b.isBone)planted.set(b.name,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()});});mixer.setTime(0);
 for(const [name,r] of planted){const l=rex.getObjectByName(name);l.position.copy(r.p);l.quaternion.copy(r.q);l.scale.copy(r.s);const prefix=name.slice(0,name.indexOf('_L_'))+'_R_';let right;rex.traverse(b=>{if(b.isBone&&b.name.startsWith(prefix))right=b;});if(right){right.position.set(-r.p.x,r.p.y,r.p.z);right.quaternion.set(r.q.x,-r.q.y,-r.q.z,r.q.w);right.scale.copy(r.s);}}
 rex.updateMatrixWorld(true);
 rex.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 box=new THREE.Box3().setFromObject(rex,true);const size=box.getSize(new THREE.Vector3());scale=13.5/Math.max(size.x,size.z);rex.scale.multiplyScalar(scale);rex.updateMatrixWorld(true);
 box=new THREE.Box3().setFromObject(rex,true);const center=box.getCenter(new THREE.Vector3());rex.position.add(new THREE.Vector3(-center.x,-box.min.y,-center.z));rex.updateMatrixWorld(true);
 const authored=prepareModel(rex);actor.remove(rex);rex=authored;actor.add(rex);
 }
 rex.updateMatrixWorld(true);rex.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});box=new THREE.Box3().setFromObject(rex,true);
 $('.scale-note div').firstChild.textContent=(box.max.z-box.min.z).toFixed(1)+' ';
 rex.traverse(o=>{
  if(o.isBone){bones.push(o);rest.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});}
  if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m.name==='BlackMat')o.visible=false;m.envMapIntensity=.42;if(m.map)m.map.anisotropy=8;if(m.normalMap)m.normalMap.anisotropy=8;if(m.name==='BodyMat'){m.color.setRGB(1,1,1);m.roughness=1;m.normalScale.set(1.08,1.08);bodyMesh=o;installDamage(m,o.geometry);}if(o.name==='Object_150'){m.color.setRGB(.5,.085,.11);m.roughness=.4;}if(m.name==='EyesMat'){m.color.setRGB(1,.56,.18);m.roughness=.24;}if(m.name==='GlassMat'){m.transparent=true;m.opacity=.12;m.roughness=.08;}}}
 });
 rex.traverse(o=>{if(o.isMesh)finishTongue(o);});
 $('#loading').hidden=true;draco.dispose();
 const report={scale,bounds:{min:box.min.toArray(),max:box.max.toArray()},normalizedBounds:new THREE.Box3().setFromObject(rex,true),clip:{name:sourceClip.name,duration:sourceClip.duration},bones:bones.map(b=>({name:b.name,p:b.getWorldPosition(new THREE.Vector3()).toArray(),q:b.quaternion.toArray()})),meshes:[]};
 rex.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();report.meshes.push({name:o.name,material:o.material.name,vertices:o.geometry.attributes.position.count,bounds:o.geometry.boundingBox});}});
 if(location.hostname==='127.0.0.1'&&!import.meta.env?.PROD)fetch('/__review',{method:'POST',body:JSON.stringify(report)}).catch(()=>{});
 window.rexStudy={scene,rex,actor,camera,renderer,bones,sourceClip,mixer,rest,trigger,setView,setDamage:v=>{damage=v;damageUniform.value=v;$('#damage').value=v;},poseAt(name,t){paused=false;action=name;actionTime=t;elapsed=name==='idle'?t:0;animateCreature(0);paused=true;},exportAsset:async()=>{
  const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');const clips=[];const saved={paused,action,actionTime,elapsed};
  for(const [name,duration] of Object.entries({Idle:8,Roar:4.8,Bite:2.8,Recoil:2.7,Tail:3.6})){
   const steps=Math.round(duration*30),times=[],values=new Map(bones.map(b=>[b,[]])),roots=[];
   for(let f=0;f<=steps;f++){const t=f*duration/steps;paused=false;action=name.toLowerCase();actionTime=t;elapsed=name==='Idle'?t:0;animateCreature(0);times.push(t);roots.push(0,0,actor.position.z);for(const b of bones)values.get(b).push(...b.quaternion.toArray());}
   const tracks=bones.map(b=>new THREE.QuaternionKeyframeTrack(b.name+'.quaternion',times,values.get(b)));tracks.push(new THREE.VectorKeyframeTrack(rex.name+'.position',times,roots));clips.push(new THREE.AnimationClip(name,duration,tracks).optimize());
  }
  restorePose();rex.updateMatrixWorld(true);const result=await new GLTFExporter().parseAsync(rex,{binary:true,animations:clips,onlyVisible:true,maxTextureSize:4096});await fetch('/__asset',{method:'POST',body:result});paused=saved.paused;action=saved.action;actionTime=saved.actionTime;elapsed=saved.elapsed;return {bytes:result.byteLength,clips:clips.map(c=>({name:c.name,duration:c.duration,tracks:c.tracks.length}))};
 }};
 window.rexStudy.clips=gltf.animations;
 window.rexStudy.setClipAt=(name,t)=>{paused=true;restorePose();actor.position.z=0;mixer.stopAllAction();const a=mixer.clipAction(gltf.animations.find(c=>c.name===name));a.reset().play();mixer.setTime(t);rex.updateMatrixWorld(true);};
},xhr=>{if(xhr.total)$('#loading-text').textContent=`Preparing the encounter · ${Math.round(xhr.loaded/xhr.total*100)}%`;},error=>{console.error(error);$('#loading-text').textContent='The model could not load. Refresh to try again.';$('.loader-ring').hidden=true;});

$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$$('[data-action]').forEach(b=>b.onclick=()=>trigger(b.dataset.action));
$('#damage').oninput=e=>{damage=Number(e.target.value);damageUniform.value=damage;$('#damage-label').textContent=['UNMARKED','SCARRED','WOUNDED','BLOODIED'][Math.round(damage)];};
$('#light-mode').onclick=()=>{lightMode=!lightMode;key.intensity=lightMode?4.4:3.6;fill.intensity=lightMode?2.6:.85;scene.environmentIntensity=lightMode?.62:.32;scene.background.set(lightMode?'#283432':'#101b1e');scene.fog.color.copy(scene.background);$('#light-mode span').textContent=lightMode?'Cinematic light':'Studio light';};
$('#pause').onclick=()=>{paused=!paused;$('#pause').innerHTML=paused?'▶ <span>Resume</span>':'Ⅱ <span>Pause</span>';};
$('#hide-ui').onclick=()=>{document.body.classList.add('clean');$('#show-ui').hidden=false;};$('#show-ui').onclick=()=>{document.body.classList.remove('clean');$('#show-ui').hidden=true;};
$('#credits-open').onclick=()=>$('#credits').showModal();$('#credits-close').onclick=()=>$('#credits').close();
let audioCtx,soundEnabled=false;$('#sound').onclick=()=>{soundEnabled=!soundEnabled;if(soundEnabled)audioCtx ||= new AudioContext();$('#sound span').textContent=soundEnabled?'Sound on':'Sound off';};
function playSound(type){if(!soundEnabled)return;audioCtx.resume();const duration=type==='roar'?3:1.1,buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*duration,audioCtx.sampleRate),data=buffer.getChannelData(0);let low=0;for(let i=0;i<data.length;i++){low=low*.97+(Math.random()*2-1)*.03;data[i]=low*3+Math.sin(i/audioCtx.sampleRate*2*Math.PI*(type==='roar'?38:29))*.17;}
 const source=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),gain=audioCtx.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=type==='roar'?650:180;gain.gain.setValueAtTime(0,audioCtx.currentTime);gain.gain.linearRampToValueAtTime(.24,audioCtx.currentTime+.3);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);source.connect(filter).connect(gain).connect(audioCtx.destination);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
const keys=new Set();let dodge=0;addEventListener('keydown',e=>{if(e.target.matches('input,button')||$('#credits').open)return;keys.add(e.code);if(e.code==='Space'&&currentView==='encounter'){e.preventDefault();dodge=.3;}});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
addEventListener('resize',resize);resize();let last=performance.now();
renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.05);last=now;if(cameraMove){cameraMove.t=Math.min(1,cameraMove.t+dt/1.25);const k=THREE.MathUtils.smootherstep(cameraMove.t,0,1);camera.position.lerpVectors(cameraMove.from,cameraMove.to,k);controls.target.lerpVectors(cameraMove.fromT,cameraMove.toT,k);if(cameraMove.t===1)cameraMove=null;}
 if(currentView==='encounter'&&!cameraMove){const dir=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);const move=dir*dt*(dodge>0?12:3.8);if(Math.abs(camera.position.x+move)<6){camera.position.x+=move;controls.target.x+=move*.3;}dodge=Math.max(0,dodge-dt);}
 animateCreature(dt);motes.rotation.y+=dt*.003;controls.update();renderer.render(scene,camera);});
document.addEventListener('visibilitychange',()=>{last=performance.now();});
