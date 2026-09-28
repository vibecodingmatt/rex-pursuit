import * as T from 'three';

// A continuous circuit inside the cabinets, barriers and paddock gate. Menu
// animals stay at full size, with no offscreen respawn or gameplay attackers.
export function createCompoundPatrol(critters){
 const radius=2.2,near=8.2,far=28,straight=far-near,arc=Math.PI*radius,length=2*(straight+arc);
 const tangent=new T.Vector3(),actors=[];
 // Tangent-matched semicircles keep the long bodies turning broadly, without
 // the tight curvature spikes a spline can introduce beside a long straight.
 function pose(distance,c){
  if(distance<straight){c.p.set(radius,0,near+distance);tangent.set(0,0,1);}
  else if(distance<straight+arc){const a=(distance-straight)/radius;c.p.set(radius*Math.cos(a),0,far+radius*Math.sin(a));tangent.set(-Math.sin(a),0,Math.cos(a));}
  else if(distance<2*straight+arc){c.p.set(-radius,0,far-(distance-straight-arc));tangent.set(0,0,-1);}
  else{const a=(distance-2*straight-arc)/radius;c.p.set(-radius*Math.cos(a),0,near-radius*Math.sin(a));tangent.set(Math.sin(a),0,-Math.cos(a));}
 }
 let travel=0,clock=0;
 function update(dt){
  clock=(clock+dt*1.1)%(Math.PI*2);const speed=2.65;
  travel=(travel+speed*dt/length)%1;
  for(const [i,c]of actors.entries()){
   const u=(travel+i/actors.length+.08)%1;
   pose(u*length,c);
   c.yaw=Math.atan2(tangent.x,tangent.z);c.v.copy(tangent).multiplyScalar(speed);
   const stride=c.kind.stride;
   c.phase=(c.phase+dt*speed/(stride[0]+speed*stride[1])*c.cadence)%1;
   c.stride=Math.min(1,.28+.72*speed/c.kind.fullRun);
   c.peck=.025*Math.sin(clock+i*1.7);
  }
  critters.updateDirected(dt);
 }
 function reset(){
  critters.reset({empty:true});actors.length=0;travel=clock=0;
  for(const [i,species]of ['raptor','raptor','pachycephalosaurus','raptor'].entries()){
   const c=critters.huntSpawn(species,1,20);if(!c)continue;
   c.scale=species==='raptor'?3.15-i*.06:4.3;c.phase=i*.27;c.cadence=.96+i*.025;c.vigor=1;c.fade=1;
   actors.push(c);
  }
  update(0);
 }
 return {actors,reset,update};
}
