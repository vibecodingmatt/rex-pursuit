import * as T from 'three';

// Conservative body/feet, muzzle and tapered tail volumes in model metres.
// Checking a root point alone lets most of a dinosaur pass through a prop.
export function creatureHull(c){
 const heavy=c.species==='pachycephalosaurus';
 return [[0,.16,0,.145],[0,.33,0,heavy?.18:.16],[0,.34,-.16,.13],
  [0,heavy?.51:.495,heavy?.25:.315,.12],[0,.42,.18,.10],
  [0,.35,-.36,.09],[0,.35,-.55,.065],[0,.34,-.74,.04]];
}
export function createObstacles(offset=new T.Vector3()){
 const boxes=[],point=new T.Vector3(),near=new T.Vector3(),sample=new T.Vector3(),ray=new T.Ray(),direction=new T.Vector3();
 function add(mesh,name){mesh.updateWorldMatrix(true,false);boxes.push({name,box:new T.Box3().setFromObject(mesh)});return mesh;}
 function addBox(name,min,max){const obstacle={name,box:new T.Box3(new T.Vector3(...min),new T.Vector3(...max))};boxes.push(obstacle);return obstacle;}
 function contact(c,p=c.p,yaw=c.yaw){
  const sin=Math.sin(yaw),cos=Math.cos(yaw),scale=c.scale;
  for(const [x,y,z,r] of c.collisionHull??(c.collisionHull=creatureHull(c))){
   point.set(p.x+(x*cos+z*sin)*scale,p.y+y*scale,p.z+(z*cos-x*sin)*scale).sub(offset);
   for(const obstacle of boxes){if(obstacle.enabled===false)continue;obstacle.box.clampPoint(point,near);if(near.distanceToSquared(point)<(r*scale)**2-1e-7)return obstacle;}
  }return null;
 }
 function canMove(c,from,yaw){
  const turn=Math.atan2(Math.sin(c.yaw-yaw),Math.cos(c.yaw-yaw));
  // Substeps include turning: a tail must not sweep through a wall, nor may
  // a fast charge tunnel through a thin cabinet between rendered frames.
  const steps=Math.max(1,Math.ceil(from.distanceTo(c.p)/.12),Math.ceil(Math.abs(turn)/.045));
  for(let i=1;i<=steps;i++){sample.lerpVectors(from,c.p,i/steps);if(contact(c,sample,yaw+turn*i/steps))return false;}
  return true;
 }
 function trace(from,to){
  direction.subVectors(to,from);const length=direction.length();if(length<.04)return null;
  ray.direction.copy(direction).divideScalar(length);ray.origin.copy(from).sub(offset).addScaledVector(ray.direction,.03);
  let best=null,distance=length-.03;
  for(const obstacle of boxes)if(obstacle.enabled!==false&&ray.intersectBox(obstacle.box,point)){const d=point.distanceTo(ray.origin);if(d<distance){distance=d;best={type:'cover',distance:d+.03,point:point.clone().add(offset)};}}
  return best;
 }
 return {boxes,add,addBox,contact,canMove,trace,clearLine:(from,to)=>!trace(from,to)};
}
