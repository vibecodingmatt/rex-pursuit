import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createCritters} from './chase/critters.js';
import {createFlyers} from './chase/flyers.js';
import {createBirds} from './chase/birds.js';
import {createInsects,INSECT_KINDS} from './chase/insects.js';
import {createBrachio} from './chase/brachio.js';
import {createRex} from './chase/creature.js';
import {SPECIES} from './chase/safari-rules.js';
import {stepFrill} from './chase/safari-motion.js';

const $=id=>document.getElementById(id),jungle={chunks:[],groundAt:()=>0};
const catalogue=[
 {id:'rex',name:'Tyrannosaurus rex',family:'Apex predator',description:'The chase Rex, with its game skin, skeleton, breathing and running animation.'},
 ...Object.entries(SPECIES).map(([id,s])=>({id,name:s.name,family:['bird','pteranodon','dimorphodon','quetzalcoatlus'].includes(id)?'Flying wildlife':'Safari ground wildlife',description:({ghostRaptor:'The rare pale variant of the raptor, sharing its sculpt and animation.',goldenCompy:'The golden compy variant, with its game coloration.',dilophosaurus:'An independently timed neck display. Inspect its folded, opening and fully spread frill.'})[id]||'The same creature geometry, material and pose shader used in Safari Run.'})),
 {id:'brachiosaurus',name:'Brachiosaurus',family:'Jungle giant',description:'The browsing sauropod, with its articulated neck, breathing and skin detail.'},
 ...['butterfly','moth','dragonfly'].map(id=>({id,name:id[0].toUpperCase()+id.slice(1),family:'Ambient insects',description:'Enlarged for inspection. Uses the game’s wing geometry, markings and flight shader.'})),
];
const scene=new T.Scene();scene.background=new T.Color('#343e43');scene.fog=new T.Fog('#343e43',15,35);
const renderer=new T.WebGLRenderer({canvas:$('scene'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.3;room.dispose();pmrem.dispose();
const camera=new T.PerspectiveCamera(36,1,.01,100),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.2;controls.maxDistance=30;controls.maxPolarAngle=Math.PI*.94;controls.autoRotateSpeed=.65;
scene.add(new T.HemisphereLight(0xc9e0ef,0x545044,1.15));
const key=new T.DirectionalLight(0xffe5cb,3);key.position.set(4,7,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});key.shadow.bias=-.0001;key.shadow.normalBias=.007;scene.add(key);
const fill=new T.DirectionalLight(0xb8d0e6,.8);fill.position.set(-4,3,3);scene.add(fill);const rim=new T.DirectionalLight(0xe1e8db,1.5);rim.position.set(-2,4,-6);scene.add(rim);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x454c4d,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const stage=new T.Group();scene.add(stage);
const group=()=>{const g=new T.Group();g.visible=false;stage.add(g);return g;};
const groundGroup=group(),flyGroup=group(),birdGroup=group(),insectGroup=group(),rexGroup=group(),brachioGroup=group();
// The Rex IK works in game-world metres. Solve outside the fitted presentation
// group, then display that pose; scaling the IK's parent corrupts leg lengths.
const rexRig=new T.Group();rexGroup.rotation.y=Math.PI;
const critters=createCritters(groundGroup,{jungle}),flyers=createFlyers(flyGroup,{jungle}),birds=createBirds(birdGroup,{count:1}),insects=createInsects(insectGroup,{});
critters.reset({empty:true});critters.meshes.forEach(m=>m.position.z=-20);flyers.reset({empty:true});insects.setQuality({fauna:0});
let rexPromise,brachio,brachioTier,active=null,selected='',serial=0,time=0,paused=false,viewName='three';
const matrix=new T.Matrix4(),focus=new T.Vector3(),size=new T.Vector3(),box=new T.Box3();let radius=2;
function instance(mesh,color=0xffffff){mesh.visible=true;mesh.count=1;mesh.setMatrixAt(0,matrix.identity());mesh.instanceMatrix.needsUpdate=true;mesh.setColorAt(0,new T.Color(color));mesh.instanceColor.needsUpdate=true;}
function poseAttribute(mesh,name,values){const a=mesh.geometry.getAttribute(name);a.array.set(values);a.needsUpdate=true;}
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
async function until(condition){const end=performance.now()+25000;while(!condition()){if(performance.now()>end)throw Error('The model did not finish loading. Reload to try again.');await nextFrame();}}
function stats(){if(!active)return;let triangles=0;active.object.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3;});$('model-stats').textContent=`${Math.round(triangles).toLocaleString()} triangles · ${active.tiers?'two mesh quality levels':'shared mesh across quality levels'}`;}
function surface(){stage.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])m.wireframe=$('surface').value==='wire';});}
function cameraView(name='three'){
 viewName=name;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===name));
 const target=focus.clone();let distance=radius/Math.sin(T.MathUtils.degToRad(camera.fov/2))/Math.min(1,camera.aspect)*1.13;
 const directions={three:[1.25,.5,1.3],side:[1,.13,0],front:[0,.15,1],head:[.9,.3,1]};
 if(name==='head'&&active?.head){target.copy(active.head()).applyMatrix4(stage.matrixWorld);distance*=.3;}
 else if(name==='head')distance*=.6;
 camera.position.copy(target).add(new T.Vector3(...directions[name]).normalize().multiplyScalar(distance));controls.target.copy(target);controls.update();
}
function fit(){
 stage.scale.setScalar(1);stage.position.set(0,0,0);stage.updateMatrixWorld(true);
 if(active.object.isInstancedMesh)active.object.computeBoundingBox();
 box.setFromObject(active.object,true);box.getSize(size);if(!Number.isFinite(size.length())||size.length()<.0001)throw Error('The selected creature has no visible geometry.');
 const scale=4/Math.max(size.x,size.y,size.z);stage.scale.setScalar(scale);stage.position.y=-box.min.y*scale;stage.updateMatrixWorld(true);
 box.getCenter(focus).multiplyScalar(scale).add(stage.position);radius=size.length()*scale*.5;
 cameraView(viewName);stats();
}
async function select(id){
 const entry=catalogue.find(s=>s.id===id)||catalogue[0],token=++serial;selected=entry.id;active=null;
 stage.children.forEach(g=>g.visible=false);$('species').value=selected;$('name').textContent=entry.name;$('category').textContent=entry.family;$('description').textContent=entry.description;
 $('counter').textContent=`SPECIMEN ${String(catalogue.indexOf(entry)+1).padStart(2,'0')} / ${catalogue.length}`;$('status').textContent='Loading model…';$('frill-controls').hidden=selected!=='dilophosaurus';
 document.querySelectorAll('[data-species]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.species===selected));
 history.replaceState(null,'',`#${selected}`);const detail=$('tier').value==='high',quality={fauna:1,detail};let adapter;
 try{
  if(selected==='rex'){
   rexPromise??=createRex(rexRig);const rex=await rexPromise;rex.reset();
   adapter={object:rex.actor,group:rexGroup,head:()=>stage.worldToLocal(rex.headPosition()),update(dt,rest){rexRig.add(rex.actor);rexRig.updateMatrixWorld(true);rex.update(dt,{phase:'pursuit',phaseTime:0,distance:0,time},time,rest?0:10);rexGroup.add(rex.actor);rex.actor.updateMatrixWorld(true);}};
  }else if(selected==='brachiosaurus'){
   brachio??=createBrachio(brachioGroup,{jungle});const previous=brachio.mesh.geometry,changed=brachioTier!==$('tier').value;brachioTier=$('tier').value;brachio.setQuality(quality);
   await until(()=>brachio.ready&&(!changed||brachio.mesh.geometry!==previous));brachio.show(0,0,0);brachio.mesh.scale.setScalar(1);
   adapter={object:brachio.mesh,group:brachioGroup,tiers:true,head:()=>stage.worldToLocal(brachio.headPosition()),update(dt){brachio.update(dt,{speed:0});}};
  }else if(entry.family==='Ambient insects'){
   insects.butterflies.visible=insects.dragonflies.visible=false;const mesh=selected==='dragonfly'?insects.dragonflies:insects.butterflies,K=INSECT_KINDS[selected];instance(mesh);mesh.setColorAt(0,new T.Color(...K.colors[0]));mesh.instanceColor.needsUpdate=true;
   adapter={object:mesh,group:insectGroup,update(dt,rest){poseAttribute(mesh,'aFly',[rest?0:time*K.flap[0]%1,rest?0:K.amp,K.mean,K.under]);}};
  }else if(selected==='bird'){
   instance(birds.mesh);adapter={object:birds.mesh,group:birdGroup,update(dt,rest){birds.update(0,rest?0:time,0);}};
  }else if(entry.family==='Flying wildlife'){
   flyers.reset({empty:true});flyers.setQuality(quality);const c=flyers.huntSpawn(selected,1),mesh=c.kind.mesh;instance(mesh);
   adapter={object:mesh,group:flyGroup,update(dt,rest){poseAttribute(mesh,'aFly',[rest?0:time*c.kind.flapHz%1,rest?0:.8,0,0]);}};
  }else{
   await critters.ready();if(token!==serial)return;critters.reset({empty:true});critters.setQuality(quality);
   const c=critters.huntSpawn(selected,1,20);c.scale=1;c.cadence=c.vigor=1;
   adapter={object:c.kind.mesh,group:groundGroup,tiers:!!c.kind.motion,critter:c,head:()=>new T.Vector3().copy(c.kind.spheres?.[2]?.p||new T.Vector3(0,c.kind.centre*1.6,.3)),update(dt,rest){
    c.state='wary';c.timer=0;c.p.set(0,0,20);c.yaw=c.roll=c.peck=0;c.phase=rest?.25:time*.9%1;c.v.set(0,0,rest?0:c.kind.fullRun);
    if(selected==='dilophosaurus'){
     if($('frill-mode').value==='auto')stepFrill(c,dt);
    }
    critters.update(.000001,{speed:0,spawn:false});
    if(selected==='dilophosaurus'){
     if($('frill-mode').value==='manual'){c.frill=Number($('frill').value);c.kind.frill.array[0]=c.frill;c.kind.frill.needsUpdate=true;}
     $('frill-value').value=`${Math.round(c.frill*100)}%`;if($('frill-mode').value==='auto')$('frill').value=c.frill;
    }
   }};
  }
  if(token!==serial)return;active=adapter;active.group.visible=true;active.update(0,$('motion').value==='rest');surface();fit();$('status').textContent='';
 }catch(error){if(token===serial){$('status').textContent=error.message;console.error(error);}}
}
catalogue.forEach(s=>{const option=document.createElement('option');option.value=s.id;option.textContent=s.name;$('species').append(option);const b=document.createElement('button');b.dataset.species=s.id;b.textContent=s.name;b.setAttribute('aria-pressed','false');b.onclick=()=>select(s.id);$('roster').append(b);});$('total').textContent=`${catalogue.length} MODELS`;
$('species').onchange=()=>select($('species').value);$('tier').onchange=()=>select(selected);
function cycle(delta){select(catalogue[(catalogue.findIndex(s=>s.id===selected)+delta+catalogue.length)%catalogue.length].id);}
$('previous').onclick=()=>cycle(-1);$('next').onclick=()=>cycle(1);
$('pause').onclick=()=>{paused=!paused;$('pause').setAttribute('aria-pressed',paused);$('pause').textContent=paused?'Resume animation':'Pause animation';};
$('speed').oninput=()=>$('speed-value').value=`${$('speed').value}×`;
$('motion').onchange=()=>{active?.update(0,$('motion').value==='rest');};
$('frill-mode').onchange=()=>{const auto=$('frill-mode').value==='auto';$('frill').disabled=auto;
 if(auto&&active?.critter){const c=active.critter;c.frillFrom=c.frill;c.frillTarget=0;c.frillTime=0;c.frillDuration=.95;c.frillWait=2.2+Math.random()*3.8;}
 active?.update(0,$('motion').value==='rest');};
$('frill').oninput=()=>active?.update(0,$('motion').value==='rest');$('surface').onchange=surface;
$('rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',controls.autoRotate);};
$('reset-view').onclick=()=>cameraView('three');document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>cameraView(b.dataset.view));
const resize=new ResizeObserver(()=>{const {width,height}=$('scene').getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();if(active)cameraView(viewName);});resize.observe($('scene'));
let last=performance.now();renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-last)/1000);last=now;if(active&&!paused){const step=dt*Number($('speed').value);time+=step;active.update(step,$('motion').value==='rest');}controls.update();renderer.render(scene,camera);});
// Deliberately confined to this noindex test page, for repeatable visual reviews.
window.creatureLab={catalogue,select,view:cameraView,renderer,scene,critters,get active(){return active;},get selected(){return selected;},get paused(){return paused;}};
select(location.hash.slice(1)||'raptor');
