import * as T from 'three';
import {createDebrisModels} from './debris-models.js';

export function debrisPosition(d,out=new T.Vector3()){
 const u=T.MathUtils.clamp(d.age/d.duration,0,1);
 return out.set(T.MathUtils.lerp(d.fromX??d.side*2.5,d.side*.18,u)+d.side*.25*Math.sin(Math.PI*u),T.MathUtils.lerp(d.height,2.85,u)+.30*Math.sin(Math.PI*u),T.MathUtils.lerp(d.fromZ,2.4,u));
}
/** One readable incoming branch, plus a bounded pool of wooden splinters. */
export function createDebris(scene,camera,container){
 const {variants,cut}=createDebrisModels();
 const source=new T.Group(),limb=new T.Group(),root=new T.Group();source.add(limb);scene.add(source,root);
 for(const v of variants){source.add(v.tree);limb.add(v.limb);root.add(v.projectile);}
 const fragments=new T.InstancedMesh(new T.BoxGeometry(.035,.23,.065),cut,24);fragments.frustumCulled=false;scene.add(fragments);
 const chips=Array.from({length:24},()=>({life:0,p:new T.Vector3(),v:new T.Vector3(),r:new T.Euler()})),dummy=new T.Object3D();
 const el=document.createElement('div');el.className='debris-target';el.innerHTML='<i></i><strong>!</strong><small></small>';el.hidden=true;container.append(el);
 let active=null,radius=.4,visible=false,sourceCoast=0,appearance=null,selected=null,lastVariant=-1;const bag=[],screen={x:0,y:0,radius:0};
 function reset(){active=null;appearance=null;selected=null;bag.length=0;lastVariant=-1;for(const v of variants)v.tree.visible=v.limb.visible=v.projectile.visible=false;sourceCoast=0;source.visible=false;root.visible=false;el.hidden=true;visible=false;for(const c of chips)c.life=0;updateFragments(0,0);}
 function selectAppearance(d){
  if(appearance===d)return;
  appearance=d;
  if(!bag.length){
   bag.push(...variants.map((_,i)=>i));
   for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
   // Every six hazards use all six forms, with no repeat at the bag boundary.
   if(bag[bag.length-1]===lastVariant)[bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];
  }
  lastVariant=bag.pop();selected=variants[lastVariant];
  for(const v of variants)v.tree.visible=v.limb.visible=v.projectile.visible=v===selected;
  source.userData.variant=root.userData.variant=selected.name;
 }
 function updateFragments(dt,speed){
  chips.forEach((c,i)=>{c.life=Math.max(0,c.life-dt);if(c.life){c.v.y-=dt*8;c.p.addScaledVector(c.v,dt);c.p.z+=speed*dt*.6;c.r.x+=dt*7;c.r.z+=dt*5;if(c.p.y<.02)c.life=0;}dummy.position.copy(c.p);dummy.rotation.copy(c.r);dummy.scale.setScalar(c.life?Math.min(1,c.life*4):0);dummy.updateMatrix();fragments.setMatrixAt(i,dummy.matrix);});fragments.instanceMatrix.needsUpdate=true;
 }
 function update(dt,state,speed=10){
  updateFragments(dt,speed);const d=state.debris;
  if(d){selectAppearance(d);selected.stump.visible=d.status!=='attached';}
  if(state.result)sourceCoast+=dt*speed;else sourceCoast=0;
  source.visible=!!d&&d.sourceAge<8&&state.phase!=='intro';
  if(source.visible){
   source.position.set(0,d.height-3.8,d.branchZ+sourceCoast);source.scale.x=d.side;
   const age=d.brokenAt===null?0:Math.max(0,state.time-d.brokenAt),bend=age?Math.exp(-age*1.3)*Math.sin(age*7)*.06:Math.max(0,1-(state.distance-6.55-d.branchZ)/1.2)*.014;
   limb.rotation.z=bend;limb.rotation.y=age?Math.exp(-age)*Math.sin(age*5)*.06:0;
  }
  active=d?.status==='active'&&!state.result&&state.phase!=='intro'?d:null;visible=false;root.visible=!!active||d?.status==='attached'&&!state.result;el.hidden=true;
  if(d?.status==='attached'&&!state.result){root.position.set(d.fromX,d.height,d.branchZ);root.rotation.set(0,0,-d.side*d.spin);return;}
  if(!active)return;
  const flight=T.MathUtils.clamp(d.age/d.duration,0,1);
  debrisPosition(d,root.position);root.rotation.set(flight*6.6,flight*3.9,-d.side*d.spin+flight*7.8);
  const p=root.position.clone().project(camera),depth=-root.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
  if(depth<=0||p.z>1||Math.abs(p.x)>.96||Math.abs(p.y)>.92)return;
  const ppm=innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*depth),coarse=matchMedia('(pointer:coarse)').matches;
  const pixels=T.MathUtils.clamp(.35*ppm,coarse?27:23,36);radius=pixels/ppm;Object.assign(screen,{x:(p.x*.5+.5)*innerWidth,y:(.5-p.y*.5)*innerHeight,radius:pixels});
  visible=true;el.hidden=false;el.style.left=`${screen.x}px`;el.style.top=`${screen.y}px`;el.style.width=el.style.height=`${pixels*2}px`;el.style.setProperty('--time',`${100*(1-d.age/d.duration)}%`);
  const card=document.querySelector('#challenge-card'),box=card&&!card.hidden?card.getBoundingClientRect():null;
  el.classList.toggle('label-below',!!box&&screen.x+60>box.left&&screen.x-60<box.right&&screen.y-pixels-30<box.bottom&&screen.y-pixels-10>box.top);
  el.querySelector('strong').textContent=d.hitsRequired-d.hits;el.querySelector('small').textContent=`DEBRIS · ${(d.duration-d.age).toFixed(1)}s`;el.classList.toggle('urgent',d.duration-d.age<1);
 }
 function hit(ray,meshDistance=Infinity){
  if(active?.status!=='active'||!visible)return null;const along=root.position.clone().sub(ray.origin).dot(ray.direction);
  return along>0&&along<meshDistance+radius&&ray.distanceSqToPoint(root.position)<=radius*radius?{id:active.id,distance:along,point:root.position.clone()}:null;
 }
 function shatter(){
  for(const c of chips){c.life=.5+Math.random()*.6;c.p.copy(root.position);c.v.set((Math.random()-.5)*5,1+Math.random()*3,(Math.random()-.5)*4);c.r.set(Math.random()*6,Math.random()*6,Math.random()*6);}root.visible=false;el.hidden=true;visible=false;
 }
 function breakBranch(d){
  debrisPosition(d,root.position);
  for(const c of chips){c.life=.65+Math.random()*.55;c.p.set(d.fromX,d.height,d.fromZ);c.v.set((Math.random()-.5)*7,1+Math.random()*3,-1-Math.random()*4);c.r.set(Math.random()*6,Math.random()*6,Math.random()*6);}
 }
 reset();return{root,source,el,screen,update,hit,shatter,breakBranch,reset,get visible(){return visible;}};
}
