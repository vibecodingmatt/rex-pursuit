import * as T from 'three';
import {groundAt} from './world.js';
import {createScreenBlood} from '../chase/screen-blood.js';
import {createSpitSmear} from './smear.js';

// Every shot lands in the world. An HDR tracer leaves the real muzzle; the round's path is
// marched to what it struck, and the strike matches the material: dirt kicks and pebbles on
// the track, sparks and chips on rock and concrete, a spout on water, hide flecks and blood
// mist on animals, sparks on a drum, splinters off a crate. Kills burst in the world, and a
// close one splatters the lens. Pursuit's effects run in the world frame here (road speed 0).

const GROUND={gates:'dirt',river:'water',fault:'rock',hybrid:'concrete',lagoon:'water',manor:'tile',visitor:'concrete'};
const SCALE={raptor:1.4,dilo:1.6,galli:1.6,trike:2.3,ptero:1.8,ichthy:2};
const rnd=Math.random,ray=new T.Raycaster(),dir=new T.Vector3(),hit=new T.Vector3(),v=new T.Vector3(),tmp=new T.Vector3(),ndc=new T.Vector2();

export class CircuitImpacts{
 constructor(renderer,{reducedMotion=false}={}){this.r=renderer;this.blood=createScreenBlood(renderer.world.camera,{reducedMotion});this.smear=createSpitSmear({reducedMotion});}
 get fx(){return this.r.effects;}
 /** The camera ray through screen point (x, y in 0-1). */
 aim(x,y){const cam=this.r.world.camera;ndc.set(x*2-1,1-y*2);ray.setFromCamera(ndc,cam);return ray.ray;}
 /** March a ray to the land or water surface; returns the distance or -1. */
 surface(r,id,max=140){
  let prev=0;for(let t=1.2;t<max;t+=.5+t*.035){r.at(t,hit);if(hit.y<=groundAt(hit.x,hit.z,id)){let a=prev,b=t;for(let i=0;i<7;i++){const m=(a+b)/2;r.at(m,hit);if(hit.y<=groundAt(hit.x,hit.z,id))b=m;else a=m;}return b;}prev=t;}
  return -1;
 }
 shot(e){
  const fx=this.fx,game=this.r.game;if(!fx||!game)return;const id=game.stage.id,r=this.aim(e.x,e.y),shot=this.r.weapon?.shot;dir.copy(r.direction);
  let end=-1,kind=null,actor=e.hit&&e.id?this.r.actors?.actors.get(e.id):null;
  if(actor){
   // The point on the round's path nearest the body, just short of its centre.
   kind=actor.e.kind;end=Math.max(1,tmp.copy(actor.position).sub(r.origin).dot(dir)-(kind==='trike'?.9:.35));
  }else if(e.hit&&this.r.lastWound){end=this.r.lastWound.point.distanceTo(r.origin);kind='boss';}
  else end=this.surface(r,id);
  const at=r.at(end>0?end:90,hit).clone();
  if(shot)fx.trace(shot.origin,at);
  if(end<0)return;
  // Explosive rounds (the power crate): every round that lands bursts in orange sparks and a puff of smoke.
  if(game.power>0){for(let i=0;i<7;i++)fx.speck(at,tmp.set(Math.random()-.5,Math.random()*.8+.2,Math.random()-.5).normalize().multiplyScalar(3+Math.random()*3),0xff9a3c,.06,.5);fx.haze(at,tmp.set(0,.8,0),{life:.7,size:.5,growth:2.4,opacity:.35,color:0x3a2a20});}
  // Spread pellets land in a blue-white spit of sparks.
  if(e.pellet)for(let i=0;i<6;i++)fx.speck(at,tmp.set(Math.random()-.5,Math.random()*.7+.2,Math.random()-.5).normalize().multiplyScalar(2.5+Math.random()*3),0x7adcff,.05,.4);
  if(kind==='boss')return;// boss-rex.js already wounds her and throws flecks
  if(kind)return this.strike(kind,at,e.precise);
  this.ground(GROUND[id]||'dirt',at);
 }
 strike(kind,p,precise){
  const fx=this.fx;
  if(kind==='barrel'){this.sparks(p,10);return;}
  if(kind==='supply'){this.chips(p,[.32,.24,.13],10,2.4);fx.haze(p,v.set(0,.6,0),{life:.6,size:.25,growth:1.4,opacity:.3,color:0x8c7a5c});return;}
  if(kind==='rock'){this.chips(p,[.2,.18,.15],8,2.2);fx.groundDust(p,v.set(0,.8,0),{size:.4,growth:2,opacity:.4,life:.8});return;}
  if(kind==='spit'){for(let i=0;i<12;i++)fx.speck(p,tmp.set(rnd()-.5,rnd()*.8,rnd()-.5).normalize().multiplyScalar(1.5+rnd()*3),[.25,.62,.08],.02+rnd()*.03,.4+rnd()*.3);return;}
  // Hide: flecks and mist thrown back along the round; a head shot sprays harder.
  fx.critter(p,v.copy(dir).negate(),(SCALE[kind]||1.5)*(precise?1.4:1));
 }
 ground(material,p){
  const fx=this.fx;
  if(material==='water'){
   for(let i=0;i<5;i++)fx.spume(tmp.copy(p).setY(p.y+.05),v.set((rnd()-.5)*.8,2.6+rnd()*2.6,(rnd()-.5)*.8),{life:.7+rnd()*.3,size:.18,growth:1.5,opacity:.32});
   for(let i=0;i<10;i++)fx.speck(p,v.set((rnd()-.5)*2,2+rnd()*3.5,(rnd()-.5)*2),[.75,.85,.9],.018+rnd()*.02,.45+rnd()*.3);return;
  }
  // Ricochet cone: the shot's direction mirrored off the ground.
  const back=tmp.set(-dir.x,Math.abs(dir.y)+.6,-dir.z).normalize();
  if(material==='dirt'){
   fx.groundDust(p,v.copy(back).multiplyScalar(1.1),{size:.32,growth:2.4,opacity:.5,life:1});
   for(let i=0;i<7;i++)fx.speck(p,v.copy(back).add(tmp.set(rnd()-.5,rnd()*.5,rnd()-.5)).normalize().multiplyScalar(2+rnd()*3),[.17,.12,.07],.025+rnd()*.03,.5+rnd()*.3);
   return;
  }
  // Rock, concrete and tile: sparks, chips and a pale dust puff.
  this.sparks(p,material==='rock'?7:5);this.chips(p,material==='rock'?[.2,.17,.14]:[.42,.4,.36],6,2.6);
  fx.groundDust(p,v.copy(back).multiplyScalar(.8),{size:.28,growth:2,opacity:.38,life:.8,color:material==='rock'?0x8a8178:0xb8b2a6});
 }
 sparks(p,n){for(let i=0;i<n;i++)this.fx.speck(p,tmp.set(rnd()-.5,rnd()*.9+.2,rnd()-.5).normalize().multiplyScalar(3+rnd()*5),[6+rnd()*3,2.6+rnd()*1.4,.5],.012+rnd()*.012,.18+rnd()*.18);}
 chips(p,color,n,speed){for(let i=0;i<n;i++)this.fx.speck(p,tmp.set(rnd()-.5,rnd()*.9+.3,rnd()-.5).normalize().multiplyScalar(speed*(.6+rnd()*.8)),color,.03+rnd()*.03,.45+rnd()*.35);}
 /** A kill at world point p: blood for animals, a fireball for a barrel; close ones hit the lens. */
 kill(e,p){
  const fx=this.fx;if(!fx||!p)return;
  if(e.kind==='barrel'){fx.burst(p,false,true);return;}
  if(e.kind==='supply'){this.chips(p,[.32,.24,.13],18,3.5);for(let i=0;i<10;i++)fx.speck(p,tmp.set(rnd()-.5,rnd()+.4,rnd()-.5).normalize().multiplyScalar(2+rnd()*2),[.6,3,1.6],.02,.5);return;}
  if(e.kind==='rock'||e.kind==='spit'){this.strike(e.kind,p,false);return;}
  fx.burst(p,true);const d=p.distanceTo(this.r.world.camera.position);
  if(d<9)this.blood.splash(p,{closeContact:d<5,amount:e.boss?1.4:1});
 }
 /** Spit that got through lands on the glass where the glob was heading. */
 splat(e,p){const cam=this.r.world.camera;let x=e.x,y=e.y;if(p){v.copy(p).project(cam);if(v.z<1){x=(v.x+1)/2;y=(1-v.y)/2;}}this.smear.splat(x,y);}
 update(dt){this.blood.update(dt);this.smear.update(dt);}
 setQuality(t){this.blood.setQuality(t);this.smear.setQuality(t);}
 reset(){this.blood.reset();this.smear.reset();}
}
