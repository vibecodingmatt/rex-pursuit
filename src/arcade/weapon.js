import * as T from 'three';
import {createMountedGun} from '../chase/mounted-gun.js';

// A physical mount, with the accepted detailed receiver, moving belt and cases.
// Aim, muzzle flash and every tracer all use this one world-space muzzle.
export class CircuitWeapon {
 constructor(world){
  this.world=world;this.body=new T.Group();world.scene.add(this.body);
  const metal=new T.MeshStandardMaterial({color:0x56615a,metalness:.66,roughness:.51}),black=new T.MeshStandardMaterial({color:0x15201d,roughness:.7}),paint=new T.MeshStandardMaterial({color:0x4e6252,metalness:.35,roughness:.67});
  this.gun=createMountedGun(this.body,world.scene,{steel:metal,black,paint,fabric:paint},null,{mountZ:.25});this.gun.hands.visible=true;
  // The Jeep (land) or the tour boat (water, A9) carries the gun; both live in vehicle.js.
  // A13: a torch strapped under the barrel for the night stages (conservatory, finale): a spot that
  // follows the aim and throws a pool of light wherever the gunner looks. (A beam cone reads as a
  // blown-out ring from the gunner's seat, looking straight down it, so there is none.)
  this.torch=new T.SpotLight(0xffeedb,0,48,.3,.55,1.6);this.torch.position.set(0,-.1,.12);this.torch.target.position.set(0,-.1,20);this.gun.muzzle.add(this.torch,this.torch.target);
  this.target=new T.Vector3();this.muzzle=new T.Vector3();this.pivot=new T.Vector3();this.forward=new T.Vector3();this.screen=new T.Vector3();this.ray=new T.Raycaster();this.lastTime=0;this.shot=null;
 }
 sync(game,aim){
  const cam=this.world.camera,time=game?.time||0,dt=Math.max(0,Math.min(.05,time-this.lastTime));this.lastTime=time;this.body.visible=!!game;if(!game)return;
  this.body.position.set(0,-2.58,-1.25).applyQuaternion(cam.quaternion).add(cam.position);this.body.quaternion.copy(cam.quaternion).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI));this.body.updateMatrixWorld(true);
  this.ray.setFromCamera(new T.Vector2(aim.x*2-1,1-aim.y*2),cam);this.ray.ray.at(70,this.target);
  this.gun.update(dt,time,game.speed,this.target,false,{ammo:100,reload:0,result:null});
  const night=['manor','visitor'].includes(game.stage?.id);this.torch.intensity=night?1400:0;
  // No old +/-39 degree mount clamp: wide displays must reach the full reticle.
  const local=this.body.worldToLocal(this.target.clone()).sub(this.gun.yaw.position);this.gun.yaw.rotation.y=Math.atan2(local.x,local.z);this.gun.gun.rotation.x=-Math.atan2(local.y-.008,Math.hypot(local.x,local.z));this.body.updateMatrixWorld(true);this.gun.muzzle.getWorldPosition(this.muzzle);
 }
 fire(){this.gun.shoot();this.gun.flash.visible=true;this.gun.light.intensity=11;this.gun.muzzle.getWorldPosition(this.muzzle);this.shot={origin:this.muzzle.clone(),target:this.target.clone()};return this.shot;}
 projectedMuzzle(){this.gun.muzzle.getWorldPosition(this.muzzle);this.screen.copy(this.muzzle).project(this.world.camera);return{x:this.screen.x*.5+.5,y:.5-this.screen.y*.5};}
 diagnostics(){this.gun.muzzle.getWorldPosition(this.muzzle);this.gun.muzzle.getWorldQuaternion(new T.Quaternion());this.forward.set(0,0,1).transformDirection(this.gun.muzzle.matrixWorld);return{muzzle:this.muzzle.toArray(),target:this.target.toArray(),direction:this.forward.toArray(),screen:this.projectedMuzzle(),alignment:this.forward.dot(this.target.clone().sub(this.muzzle).normalize())};}
 reset(){this.gun.reset();this.lastTime=0;this.shot=null;}
}
