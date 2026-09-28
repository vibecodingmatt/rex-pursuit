import * as T from 'three';
import {createCompound} from '../breach/world.js';
import {createCompoundPatrol} from '../breach/patrol.js';

// One cached compound in the existing WebGL context. Gameplay keeps its own
// entry/rules; selecting a menu card never constructs a second renderer or rig.
export function createBreachPreview({scene,camera,critters,rex,jeep,weather,sky,night,lights,post,quality}){
 const world=createCompound(scene,quality.branchMap);world.root.visible=false;
 const keep=new Set([rex.actor,jeep.root,sky.mesh,weather.rain,weather.splashes,weather.bolt,...critters.meshes,night.fireflies.parent,...Object.values(lights)]);
 const saved=new Map(),look=new T.Vector3(),aim=new T.Vector3(2.3,1.7,12),round={time:0,trap:0,gate:0};
 const patrol=createCompoundPatrol(critters);
 let active=false,ready=false,conditions,clock=0;
 function enter(){
  if(active)return;active=true;ready=false;clock=0;conditions=weather.kind;
  for(const object of scene.children){if(object===world.root)continue;saved.set(object,object.visible);if(!keep.has(object)&&!object.isLight)object.visible=false;}
  world.root.visible=true;world.reset();world.setQuality(quality.tier());
  patrol.reset();
  rex.actor.visible=jeep.root.visible=true;weather.set('night-storm',{instant:true,persist:false});update(0);
 }
 function update(dt){
  clock=(clock+dt)%600;const portrait=camera.aspect<.8;
  camera.position.set(portrait?3.2:-4,portrait?5.8:3.8,-3+Math.sin(clock*.12)*.25);look.set(portrait?0:2,portrait?-4:2.7,20);camera.fov=portrait?64:52;camera.lookAt(look);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  patrol.update(dt);
  rex.update(0,{phase:'pursuit',phaseTime:0,distance:43,time:clock},clock,0,{});rex.drainMotionEvents();rex.gaze.update(dt,camera.position);
  jeep.update(dt,clock,0,aim,true,{phase:'pursuit',phaseTime:0,reload:0,ammo:80,time:clock});
  weather.update(dt,0,camera);weather.apply({...lights,post});night.update(dt,{time:clock,speed:0,camera,rex});world.update(dt,round,true);
  lights.hemi.intensity=Math.max(lights.hemi.intensity,.3);lights.fill.intensity=Math.max(lights.fill.intensity,.55);scene.environmentIntensity=Math.max(scene.environmentIntensity,.17);night.tail.intensity*=.18;
  sky.update(camera,clock);post.settings.motionBlur=0;post.final.lensRain.value=weather.value;post.final.lensTime.value+=dt;
 }
 async function prepare(){
  // compileAsync traverses hidden scenery too; compile only this preview's
  // visible drawables so the hidden jungle does not gain compound-light variants.
  const visible=new T.Group();scene.traverseVisible(o=>{if(o.isMesh||o.isPoints||o.isLine)visible.children.push(o);});
  await post.prepare(visible,camera,scene);if(active)ready=true;
 }
 function leave(){
  if(!active)return;active=ready=false;world.root.visible=false;
  for(const [object,visible]of saved)object.visible=visible;saved.clear();
  weather.set(conditions,{instant:true,persist:false});weather.update(0,0,camera);weather.apply({...lights,post});night.update(0,{camera,rex});
  critters.reset();rex.reset();jeep.reset();
 }
 return {world,patrol,enter,leave,prepare,update,get active(){return active;},get ready(){return ready;},setQuality(t){world.setQuality(t);}};
}
