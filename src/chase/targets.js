import * as T from 'three';
import {TARGET_SITES,SITE_OFFSETS} from './target-sites.js';

// Rest-space surface anchors, recovered from skinned vertices each frame.
export function createTargets(rex,camera,container){
 const mesh=rex.skin,positions=mesh.geometry.attributes.position,world=new T.Vector3();
 const targets=TARGET_SITES.map((def,id)=>{
  const indices=SITE_OFFSETS.map(offset=>{let index=0,best=Infinity;for(let i=0;i<positions.count;i++){const d=(positions.getX(i)-def.at[0]-offset[0])**2+(positions.getY(i)-def.at[1]-offset[1])**2+(positions.getZ(i)-def.at[2]-offset[2])**2;if(d<best){best=d;index=i;}}return index;});
  const el=document.createElement('div');el.className='weakpoint';el.innerHTML='<i></i><strong></strong><small></small>';el.hidden=true;container.append(el);
  return{id,indices,index:indices[0],name:def.name,el,world:new T.Vector3(),radius:.35,screen:{x:0,y:0,radius:0},visible:false};
 });
 function update(state){
  const o=state.objective,active=state.phase==='challenge'&&o?.status==='active'&&!state.result;
  for(const target of targets){
   const order=o?.order.indexOf(target.id)??-1;target.visible=false;target.el.hidden=true;
   if(!active||order<o.current||order>o.current+1||order<0)continue;
   target.index=target.indices[o.variants?.[target.id]??0];
   mesh.getVertexPosition(target.index,world);mesh.localToWorld(world);target.world.copy(world);
   const p=world.clone().project(camera);if(p.z<0||p.z>1||Math.abs(p.x)>.97||Math.abs(p.y)>.91)continue;
   const depth=world.clone().applyMatrix4(camera.matrixWorldInverse).z;
   const pixelsPerMeter=innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*Math.abs(depth));
   const min=matchMedia('(pointer:coarse)').matches?29:22,base=.30-o.tier*.025;
   const radius=T.MathUtils.clamp(base*pixelsPerMeter,min,35);target.radius=radius/pixelsPerMeter;
   target.screen={x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,radius};target.visible=true;
   const current=order===o.current;target.el.hidden=false;target.el.classList.toggle('active',current);
   target.el.style.left=`${target.screen.x}px`;target.el.style.top=`${target.screen.y}px`;target.el.style.width=target.el.style.height=`${radius*2}px`;
   target.el.querySelector('strong').textContent=order+1;target.el.querySelector('small').textContent=current?`${target.name} · ${o.hitsRequired-o.hits} HIT${o.hitsRequired-o.hits===1?'':'S'}`:'NEXT';
  }
 }
 function hit(ray,state){
  const o=state.objective;if(!o||state.phase!=='challenge'||o.status!=='active')return -1;
  const target=targets[o.order[o.current]];if(!target?.visible)return -1;
  const delta=target.world.clone().sub(ray.origin),along=delta.dot(ray.direction);
  // The numbered ring is the arcade hit area. A moving lip or tooth must not
  // reject a shot inside it; ordinary wounds still use the first mesh impact.
  return along>0&&ray.distanceSqToPoint(target.world)<=target.radius**2?target.id:-1;
 }
 return{targets,update,hit,reset(){for(const t of targets){t.el.hidden=true;t.visible=false;}}};
}
