import * as T from 'three';
import {TYPES,project} from './rules.js';
import {drawPuppet} from './puppet.js';
import {CircuitWorld} from './world.js';
import {CircuitActors} from './actors.js';
import {CircuitWeapon} from './weapon.js';
import {CircuitVehicle} from './vehicle.js';
import {CircuitImpacts} from './impacts.js';
import {BossRex} from './boss-rex.js';
import {BossTrike} from './boss-trike.js';
import {createEffects} from '../chase/effects.js';
import {dustTexture} from '../chase/foliage.js';
// Individual cell padding avoids the generated atlas's occasional boundary overlap.
const CUTS=[[0,0,.247,.471],[.249,0,.249,.482],[.507,0,.233,.48],[.738,0,.262,.445],[0,.489,.25,.511],[.252,.493,.249,.507],[.498,.478,.26,.522],[.754,.485,.246,.515]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Score numeral colours by chain multiplier (x1 to x5).
const CHAIN=['#f4ecd2','#9ff8c0','#7fe3ff','#ffc46b','#ff6a4d'];
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
export class RideRenderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.terrain=document.createElement('canvas');this.terrain.id='terrain';this.terrain.setAttribute('aria-hidden','true');canvas.before(this.terrain);this.world=new CircuitWorld(this.terrain);this.images={};this.particles=[];this.labels=[];this.tracers=[];this.shake=0;this.flash=0;this.recoil=0;this.hitMark=0;this.heat=0;this.lift=new T.Vector3();this.age=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.resize();}
 async load(onProgress){let n=0;await Promise.all([this.world.load(),...['worlds','predators','wildlife','landmarks'].map(async key=>{const im=new Image();im.src=new URL(`./arcade/${key}.png`,document.baseURI).href;await im.decode();this.images[key]=im;onProgress(++n/6);})]);this.actors=new CircuitActors(this.world);await this.actors.load();this.bossTrike=new BossTrike(this.world,this.actors);this.world.rimCreatures(this.world.scene);onProgress(5/6);this.weapon=new CircuitWeapon(this.world);this.vehicle=this.world.vehicle=new CircuitVehicle(this.world);this.effects=createEffects(this.world.scene,dustTexture());this.vehicle.effects=this.effects;this.impacts=new CircuitImpacts(this,{reducedMotion:this.reduced});this.world.overlay=this.effects.soft.render;this.bossRex=new BossRex(this.world);this.sync(null,{x:.5,y:.5});onProgress(1);}
 /** The hero Rex streams in after the menu is usable; until then the 2D boss stands in. */
 loadBosses(){this.bossLoad??=this.bossRex.load().catch(e=>{console.warn('Hero Rex unavailable; using the 2D boss.',e.message);});return this.bossLoad;}
 resize(){this.w=innerWidth;this.h=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.6);this.canvas.width=Math.round(this.w*dpr);this.canvas.height=Math.round(this.h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.world.resize(this.w,this.h);}
 reset(){this.particles=[];this.labels=[];this.tracers=[];this.shake=0;this.flash=0;this.recoil=0;this.hitMark=0;this.heat=0;this.impacts?.reset();this.actors?.reset();this.weapon?.reset();this.bossRex?.reset();this.bossTrike?.reset();this.effects?.reset();}
 sync(game,aim){if(!this.weapon)return;this.game=game;this.world.sync(game,{reduced:this.reduced,shake:this.shake});this.bossTrike?.sync(game);this.actors.sync(game);this.bossRex.sync(game);this.weapon.sync(game,aim);
  // Bosses and running animals push the planting aside on the next frame.
  this.world.pushers=[...this.bossRex.slots.filter(s=>s.id!==null&&s.frame.visible).map(s=>({x:s.frame.position.x,z:s.frame.position.z,r:6,s:1.3})),...[this.bossTrike?.pusher()].filter(Boolean),...this.actors.pushers()].slice(0,6);}
 project(e,aspect=this.w/this.h){return this.bossRex?.project(e,aspect)||this.bossTrike?.project(e,aspect)||this.actors?.project(e,aspect)||project(e,aspect);}
 burst(x,y,color,count=20,power=1){for(let i=0;i<count;i++){const a=hash(i+this.age*71)*Math.PI*2,v=(50+hash(i*9+this.age)*180)*power;this.particles.push({x:x*this.w,y:y*this.h,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+hash(i*3)*.6,max:1,color,size:1+hash(i*11)*4});}if(this.particles.length>200)this.particles.splice(0,this.particles.length-200);}
 event(e){
  this.bossRex?.event(e);this.bossTrike?.event(e);
  if(e.id){const boss=this.bossRex?.slots.find(s=>s.id===e.id&&s.started),trike=!boss&&this.bossTrike?.slot?.id===e.id&&this.bossTrike.handles(this.bossTrike.slot.entity),actor=this.actors?.actors.get(e.id),p=boss?this.bossRex.project(boss.entity,this.w/this.h):trike?this.bossTrike.project(this.bossTrike.slot.entity,this.w/this.h):actor&&this.project(actor.e);if(p?.visible&&e.type!=='shot')e={...e,x:boss||trike?p.hx:p.x,y:boss||trike?p.hy:p.y};}
  // Rounds that meet her hide leave a wound and throw flecks and mist back toward the gun.
  if(e.type==='shot'&&e.hit&&e.id){const wound=this.bossRex?.wound(e)||this.bossTrike?.wound(e);if(wound){this.effects.burst(wound.point,true);this.lastWound=wound;}}
  if(e.type==='shot'){this.recoil=1;this.heat=Math.min(1,this.heat+.13);this.weapon?.fire();this.impacts?.shot(e);if(e.hit){this.hitMark=.11;this.confirm={x:e.x,y:e.y,precise:e.precise,life:.22};}}
  if(e.type==='kill'){const a=this.actors?.actors.get(e.id),trike=this.bossTrike?.slot?.id===e.id&&this.bossTrike.slot.c,at=a?a.position.clone():trike?this.bossTrike.head(this.bossTrike.slot):null;if(at)this.impacts?.kill(e,at);else this.burst(e.x,e.y,e.boss?'#f5cf88':'#d4af6f',e.boss?50:20,1);
    const chain=Math.min(5,1+Math.floor((this.game?.combo||0)/5));this.labels.push({x:e.x*this.w,y:e.y*this.h,at:at?.add(this.lift.set(0,e.kind==='trike'?2.6:1.6,0)),text:`+${e.points.toLocaleString()}`,tag:e.precise?'PRECISION':chain>1?`CHAIN ×${chain}`:'',life:1.15,max:1.15,color:CHAIN[chain-1],size:Math.min(34,18+Math.log10(Math.max(10,e.points))*3)});if(e.boss)this.shake=.5;}
  if(e.type==='damage'||e.type==='attack'){this.shake=.7;this.flash=.5;}
  if(e.type==='blast'){this.world.air?.startle(this.world.distance+30);this.shake=.7;}
  if(e.type==='stagger'){this.shake=.3;this.labels.push({x:e.x*this.w,y:e.y*this.h,text:'ATTACK BROKEN',life:1.3,color:'#9ff8e0'});}
  if(e.type==='supply'){const a=this.actors?.actors.get(e.id);if(a)this.impacts?.kill({kind:'supply'},a.position.clone());else this.burst(e.x,e.y,'#a8ffcb');this.labels.push({x:e.x*this.w,y:e.y*this.h,text:'REPAIR +22',life:1.2,color:'#a8ffcb'});}
  if(e.type==='bridge')this.shake=1.2;
  if(e.type==='splat'){this.impacts?.splat(e,this.actors?.actors.get(e.id)?.position);this.shake=Math.max(this.shake,.35);}
 }
 update(dt){this.age+=dt;this.effects?.update(dt,0);this.impacts?.update(dt);this.heat=Math.max(0,this.heat-dt*1.7);if(this.confirm&&(this.confirm.life-=dt)<=0)this.confirm=null;this.shake=Math.max(0,this.shake-dt);this.flash=Math.max(0,this.flash-dt);this.recoil=Math.max(0,this.recoil-dt*9);this.hitMark=Math.max(0,this.hitMark-dt);
  for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=150*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);
  for(const p of this.labels){if(p.at)p.at.y+=dt*.8;else p.y-=dt*35;p.life-=dt;}this.labels=this.labels.filter(p=>p.life>0);
  for(const p of this.tracers)p.life-=dt;this.tracers=this.tracers.filter(p=>p.life>0);
 }
 background(index,time,aim,game){
  const c=this.ctx,w=this.w,h=this.h,im=this.images[index>=4?'landmarks':'worlds'];if(!im){c.fillStyle='#101c17';c.fillRect(0,0,w,h);return;}index%=4;
  const cw=im.width/2,ch=im.height/2,sx=(index%2)*cw,sy=Math.floor(index/2)*ch;
  const move=this.reduced?0:1,travel=game?clamp(game.stageTime/game.stage.duration,0,1)*.34*move:0,scale=Math.max(w/cw,h/ch)*(1.065+travel),iw=cw*scale,ih=ch*scale;
  const ox=(w-iw)/2+(aim.x-.5)*-15*move+Math.sin(time*.15)*w*.012*move;
  const drop=game?.stage.id==='fault'&&game.stageTime>19&&game.stageTime<23?Math.sin((game.stageTime-19)/4*Math.PI)*h*.09*move:0;
  const oy=(h-ih)/2+Math.sin(time*6.3)*1.8*move+drop+(this.shake?Math.sin(time*70)*this.shake*8*move:0);
  c.drawImage(im,sx,sy,cw,ch,ox,oy,iw,ih);
  // Ground-level mist, dust, rain and embers create moving layers across the depth field.
  c.save();
  for(let i=0;i<55;i++){
   const z=(hash(i*3)+time*(index===1?.07:.04))%1,p=z*z;
   const x=w*(.5+(hash(i*11)-.5)*(p*2.2+.2)),y=h*(.4+p*.65);
   c.globalAlpha=(1-z)*.24;
   if(index===1){c.fillStyle='#ffc478';c.beginPath();c.ellipse(x,h-y+h*.4,1+p*2,2+p*4,.4,0,7);c.fill();}
   else if(index>1){c.strokeStyle='#c5e5e5';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y+8+p*18);c.stroke();}
   else{c.fillStyle='#e5d6a7';c.beginPath();c.arc(x,y,1+p*2,0,7);c.fill();}
  }c.restore();
  // Near-camera vegetation passes independently of the distant scenery.
  if(index<2)for(let i=0;i<12;i++){
   const p=(i/12+time*.06)%1,side=i%2?1:-1,x=w*.5+side*w*(.32+p*p*.44),y=h*(.5+p*p*.57);
   c.save();c.translate(x,y);c.scale(side,1);c.globalAlpha=clamp(p*2,0,1);c.strokeStyle=index===1?'#352a19':'#182b1a';c.fillStyle=index===1?'#3d3620':'#24412b';
   const s=15+p*p*160;c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-s*.5,-s*.9,-s,-s);c.stroke();
   for(let j=1;j<8;j++){const q=j/8,l=s*.25*Math.sin(q*Math.PI);c.beginPath();c.moveTo(-s*q,-s*q);c.quadraticCurveTo(-s*q-l,-s*q-l*.1,-s*q-l*.5,-s*q-l);c.quadraticCurveTo(-s*q,-s*q-l*.6,-s*q,-s*q);c.fill();}c.restore();
  }
 }
 sprite(kind,x,y,size,{flip=false,alpha=1,age=0,hit=false,fall=0,menu=false}={}){
  const c=this.ctx,def=TYPES[kind],im=this.images[def?.atlas||'predators'];if(!im||def?.cell===undefined)return;
  const cols=def.atlas?2:4,cut=def.atlas?[def.cell%cols/cols,Math.floor(def.cell/cols)/2,1/cols,.5]:CUTS[def.cell];
  const [sx,sy,cw,ch]=[cut[0]*im.width,cut[1]*im.height,cut[2]*im.width,cut[3]*im.height];
  c.save();c.translate(x,y);c.scale(flip?-1:1,1);c.globalAlpha=alpha;
  const rotate=fall?fall*.65:Math.sin(age*5)*.012;c.rotate(rotate);
  if(hit)c.filter='brightness(1.75) saturate(.7)';
  // Larger foreground animals use an articulated image mesh; distant wildlife
  // uses the cheaper strip deformation. Neither path allocates a texture per frame.
  if(!def.atlas&&size>this.h*.27&&!menu){drawPuppet(c,im,[sx,sy,cw,ch],size,kind,age,this.reduced);c.restore();return;}
  const bands=menu?28:20;
  for(let i=0;i<bands;i++){
   const p=i/bands,dx=(kind==='ptero'?Math.sin(age*10+p*5)*size*.021:Math.sin(age*4+p*4)*size*.008)*(this.reduced?.2:1);
   const stretch=1+Math.sin(age*3+p*4)*.008;
   c.drawImage(im,sx,sy+p*ch,cw,ch/bands,-size*.5+dx,-size*.5+p*size,size*stretch,size/bands+.9);
  }c.restore();
 }
 entity(e,time,game){
  if(e.age<0)return;const c=this.ctx,w=this.w,h=this.h;
  // A modeled boss is part of the lit 3D scene; only its weak-point mark is drawn here.
  const hero=this.bossRex?.handles(e)?this.bossRex:this.bossTrike?.handles(e)?this.bossTrike:null;
  if(hero){const p=hero.project(e,w/h);if(!e.dead&&e.weak&&p.visible)this.weakMark(e,p.hx*w,p.hy*h,Math.max(24,p.hr*h*1.25));return;}
  const p=project(e,w/h),size=p.h*h;
  if(!['ptero','ichthy','mosa','spit'].includes(e.kind)){
   c.save();c.globalAlpha=e.alpha*.45;c.fillStyle='#030905';c.beginPath();c.ellipse(p.x*w,(p.y+p.h*.43)*h,size*.39,size*.045,0,0,7);c.fill();c.restore();
  }
  if(TYPES[e.kind].cell!==undefined)this.sprite(e.kind,p.x*w,p.y*h,size,{age:e.age,alpha:e.alpha,hit:e.hit>0,fall:e.dead?e.fade:0});else this.prop(e,p,time);
  if(e.dead)return;
  if(e.boss&&e.weak)this.weakMark(e,p.hx*w,p.hy*h,Math.max(21,size*.115));
  else if(!e.boss&&e.age/e.life>.67&&!['supply','barrel','galli'].includes(e.kind)){
   c.save();c.strokeStyle='#ffb777';c.globalAlpha=.7;c.lineWidth=2;c.beginPath();c.arc(p.x*w,(p.y-p.h*.48)*h,12,-Math.PI/2,-Math.PI/2+7*(1-e.age/e.life));c.stroke();c.restore();
  }
 }
 weakMark(e,x,y,r){
  const c=this.ctx,danger=e.attack>0;
  c.save();c.strokeStyle=danger?'#ff895e':'#ffd68b';c.lineWidth=2;c.shadowColor=c.strokeStyle;c.shadowBlur=9;c.setLineDash([6,5]);c.beginPath();c.arc(x,y,r,0,7);c.stroke();c.setLineDash([]);c.shadowBlur=0;
  c.lineWidth=4;c.beginPath();c.arc(x,y,r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-e.attack));c.stroke();c.fillStyle='#fff1d1';c.font='bold 8px Arial';c.textAlign='center';c.fillText(danger?'STOP THE ATTACK':'WEAK POINT',x,y-r-14);c.restore();
 }
 render(game,aim,{menu=false,time=0}={}){
  const c=this.ctx,w=this.w,h=this.h;let index=menu?0:game?.stage.bg||0;c.clearRect(0,0,w,h);
  if(game?.stage.id==='fault'&&game.stageTime<10)index=5;
  if(game?.stage.id==='hybrid'&&game.stageTime<12)index=7;
  this.terrain.style.visibility=menu?'hidden':'visible';
  if(menu)this.background(index,time,aim,null);
  else{this.sync(game,aim);this.world.render();}
  if(menu){const portrait=w<h;this.sprite('rex',w*(portrait?.72:.73),h*(portrait?.29:.47),Math.min(h*.89,w*(portrait?1:.72)),{age:time*.3,menu:true});}
  else{
   for(const e of game.entities.filter(e=>e.boss).sort((a,b)=>a.size-b.size))this.entity(e,time,game);
   for(const e of game.entities.filter(e=>!e.boss&&!e.dead&&e.age/e.life>.62)){
    const p=this.project(e);if(!p?.visible||['supply','barrel','galli'].includes(e.kind))continue;c.save();c.strokeStyle='#ffcb87';c.globalAlpha=.85;c.lineWidth=2;c.beginPath();c.arc(p.hx*w,p.hy*h,Math.max(13,p.h*h*.27),-Math.PI/2,-Math.PI/2+Math.PI*2*(1-e.age/e.life));c.stroke();c.restore();
   }
   for(const p of this.particles){c.globalAlpha=clamp(p.life*2,0,1);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size);}c.globalAlpha=1;
   // Score numerals ride the spot where the animal fell; they pop in, then rise and fade.
   for(const p of this.labels){let x=p.x,y=p.y;if(p.at){this.lift.copy(p.at).project(this.world.camera);if(this.lift.z>1)continue;x=(this.lift.x*.5+.5)*w;y=(.5-this.lift.y*.5)*h;}
    const pop=p.size?1+.45*Math.max(0,1-(p.max-p.life)/.12):1;c.save();c.globalAlpha=Math.min(1,p.life*3);c.translate(x,y);c.scale(pop,pop);c.textAlign='center';c.lineJoin='round';
    if(p.size){c.font=`italic 900 ${p.size}px "Arial Black",Impact,sans-serif`;c.lineWidth=5;c.strokeStyle='#07110dcc';c.strokeText(p.text,0,0);c.fillStyle=p.color;c.shadowColor=p.color;c.shadowBlur=10;c.fillText(p.text,0,0);
     if(p.tag){c.shadowBlur=0;c.font='900 10px "Arial Black",sans-serif';c.lineWidth=3;c.strokeText(p.tag,0,-p.size*.95);c.fillText(p.tag,0,-p.size*.95);}}
    else{c.fillStyle=p.color;c.shadowColor='#07110d';c.shadowBlur=7;c.font='bold 13px Arial';c.fillText(p.text,0,0);}c.restore();}
  }
  const vignette=c.createRadialGradient(w*.5,h*.48,h*.25,w*.5,h*.48,Math.max(w,h)*.8);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,menu?'#020c0ac9':'#020c0a55');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  if(!menu){
   const fade=game.phase==='clear'?clamp((game.phaseTime-(game.clearHold??3.5)+.8)/.8,0,1):game.phase==='intro'?clamp(1-game.phaseTime/.6,0,1):0;
   if(fade){c.fillStyle=`rgba(3,12,10,${fade})`;c.fillRect(0,0,w,h);}
   if(game.focusTime>0){c.strokeStyle='#bcecdba0';c.lineWidth=5;c.strokeRect(3,3,w-6,h-6);}
   if(this.flash>0){c.fillStyle=`rgba(215,65,32,${this.flash*.22})`;c.fillRect(0,0,w,h);}
   // The reticle blooms under sustained fire, rings on a hit and brackets a head in its sights.
   const x=aim.x*w,y=aim.y*h,spread=8+this.heat*9;let head=null;
   for(const e of game.entities){if(e.boss||e.dead||e.age<.15||['supply','barrel','rock','spit'].includes(e.kind))continue;const p=this.project(e);if(p?.visible&&Math.hypot((aim.x-p.hx)*w/h,aim.y-p.hy)<Math.max(.035,p.h*.15)){head=p;break;}}
   c.save();c.strokeStyle=this.hitMark?'#ffe1a5':head?'#ffd27a':'#f4ecd2';c.shadowBlur=4;c.shadowColor='#000';c.lineWidth=1.5;
   for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.moveTo(x+Math.cos(a)*spread,y+Math.sin(a)*spread);c.lineTo(x+Math.cos(a)*(spread+10),y+Math.sin(a)*(spread+10));c.stroke();}
   c.beginPath();c.arc(x,y,3,0,7);c.stroke();if(this.hitMark){c.beginPath();c.moveTo(x-7,y-7);c.lineTo(x+7,y+7);c.moveTo(x+7,y-7);c.lineTo(x-7,y+7);c.stroke();}
   if(this.confirm){const k=1-this.confirm.life/.22;c.globalAlpha=1-k;c.strokeStyle=this.confirm.precise?'#ffd27a':'#f4ecd2';c.beginPath();c.arc(x,y,spread+4+k*14,0,7);c.stroke();c.globalAlpha=1;}
   if(head){const hx=head.hx*w,hy=head.hy*h,r=Math.max(10,head.h*h*.13),l=r*.45;c.strokeStyle='#ffd27a';c.lineWidth=2;for(const [sx,sy]of [[-1,-1],[1,-1],[-1,1],[1,1]]){c.beginPath();c.moveTo(hx+sx*r,hy+sy*(r-l));c.lineTo(hx+sx*r,hy+sy*r);c.lineTo(hx+sx*(r-l),hy+sy*r);c.stroke();}}
   c.restore();
  }
 }
}
