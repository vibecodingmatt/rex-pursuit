import * as T from 'three';
// A startled flock bursting out of the canopy when she roars. One instanced
// draw; wing flap is done in the vertex shader, flight paths on the CPU.
// Birds can be shot: a hit stops the wings (drooped) and it drops, turning over, to the road.
export function createBirds(scene,{count=28}={}){
 // Body plus two wing triangles; wing vertices carry a flap weight in uv.x.
 const P=[0,0,.16, 0,0,-.12, -.03,.02,0, .03,.02,0, 0,0,.08, 0,0,-.05, -.46,.02,-.06, 0,0,.08, 0,0,-.05, .46,.02,-.06];
 const W=[0,0,0,0, 0,0,1, 0,0,1];
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('flap',new T.Float32BufferAttribute(W,1));
 geo.setIndex([0,2,1, 0,1,3, 4,5,6, 7,9,8]);geo.computeVertexNormals();
 const still=new T.InstancedBufferAttribute(new Float32Array(count),1);still.setUsage(T.DynamicDrawUsage);geo.setAttribute('still',still);
 const uniforms={time:{value:0}};
 const material=new T.MeshBasicMaterial({color:0x1a1d17,side:T.DoubleSide,fog:true});
 material.onBeforeCompile=s=>{s.uniforms.uBirdTime=uniforms.time;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float flap;attribute float still;uniform float uBirdTime;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    float phase=uBirdTime*(11.+float(gl_InstanceID%5))+float(gl_InstanceID)*1.7;
    transformed.y+=flap*(sin(phase)*(1.-still)-still*.7)*abs(position.x)*1.1;`);};
 material.customProgramCacheKey=()=> 'rex-birds-v2';
 const mesh=new T.InstancedMesh(geo,material,count);mesh.frustumCulled=false;mesh.count=0;mesh.name='Startled flock';scene.add(mesh);
 const birds=Array.from({length:count},()=>({p:new T.Vector3(),v:new T.Vector3(),age:99,life:7,size:1,wobble:0,dead:false,roll:0,down:false}));
 const obj=new T.Object3D(),look=new T.Vector3(),w=new T.Vector3();let active=0,api;const tally={kills:0};
 const alive=b=>b.age>=0&&b.age<=b.life&&!b.dead;
 function kill(i,dir,power=1){const b=birds[i];if(!b||!alive(b))return false;
  b.dead=true;b.down=false;b.life=b.age+9;b.v.multiplyScalar(.3).addScaledVector(dir,2.5*power);b.v.y=Math.max(b.v.y*.3,0)+1.2;b.roll=0;
  tally.kills++;api.onKill?.(b.p.clone(),'bird');return true;}
 api={mesh,onKill:null,
  scatter(origin,{spread=18,count:n=count}={}){
   active=Math.min(count,n);
   for(let i=0;i<active;i++){const b=birds[i],a=Math.random()*Math.PI*2,r=Math.random()*spread;
    b.p.set(origin.x+Math.cos(a)*r,origin.y+Math.random()*5,origin.z+Math.sin(a)*r*.6);
    b.v.set((Math.random()-.5)*6+(b.p.x>0?3:-3),5+Math.random()*4,4+Math.random()*6);b.age=-Math.random()*.6;b.life=5+Math.random()*3;b.size=.7+Math.random()*.6;b.wobble=Math.random()*6;b.dead=false;b.down=false;}
   mesh.count=active;
  },
  reset(){for(const b of birds){b.age=99;b.dead=false;}mesh.count=0;active=0;tally.kills=0;},
  /** The nearest live bird on a world-space ray (a sphere no smaller than minAngle radians from the gun), or null. */
  hit(ray,far=Infinity,minAngle=0){let best=null;
   for(let i=0;i<active;i++){const b=birds[i];if(!alive(b))continue;const t=w.subVectors(b.p,ray.origin).dot(ray.direction);if(t<=0||t>far||best&&t>=best.distance)continue;
    const r=Math.max(.35*b.size,t*minAngle);if(ray.distanceSqToPoint(b.p)<=r*r)best={index:i,kind:'bird',distance:t,point:b.p.clone()};}
   return best;},
  kill,
  blast(p,radius=5){const out=[];for(let i=0;i<active;i++)if(alive(birds[i])&&birds[i].p.distanceTo(p)<radius&&kill(i,w.subVectors(birds[i].p,p).normalize(),1.5))out.push('bird');return out;},
  stats(){return{flying:birds.slice(0,active).filter(alive).length,kills:tally.kills};},
  /** Positions of the live birds (for aiming checks). */
  live(){return birds.slice(0,active).filter(alive).map(b=>({x:b.p.x,y:b.p.y,z:b.p.z}));},
  update(dt,time,roadSpeed){
   uniforms.time.value=time;if(!active)return;let live=0;
   for(let i=0;i<active;i++){const b=birds[i];b.age+=dt;
    if(b.age<0||b.age>b.life){obj.position.set(0,-500,0);obj.scale.setScalar(.001);obj.rotation.set(0,0,0);}
    else if(b.dead){live++;
     // Falling, turning over; once down it lies on the road and rides away with it.
     if(!b.down){b.v.y-=9.8*dt;b.p.addScaledVector(b.v,dt);b.p.z+=roadSpeed*dt*.4;b.roll+=dt*9;if(b.p.y<.05){b.p.y=.05;b.down=true;}}
     else b.p.z+=roadSpeed*dt;
     obj.position.copy(b.p);look.copy(b.p).add(w.set(b.v.x,0,b.v.z||1));obj.lookAt(look);obj.rotateZ(b.down?1.4:b.roll);obj.scale.setScalar(b.size*Math.min(1,b.life-b.age));}
    else{live++;b.v.y=Math.max(1.2,b.v.y-dt*1.4);b.v.x+=Math.sin(time*1.3+b.wobble)*dt*2;b.p.addScaledVector(b.v,dt);b.p.z+=roadSpeed*dt*.4;
     obj.position.copy(b.p);look.copy(b.p).add(b.v);obj.lookAt(look);obj.scale.setScalar(b.size*(1-Math.max(0,(b.age-b.life+1))));}
    obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);still.array[i]=b.dead?1:0;}
   mesh.instanceMatrix.needsUpdate=true;still.needsUpdate=true;if(!live&&birds.slice(0,active).every(b=>b.age>b.life)){active=0;mesh.count=0;}
  }};
 return api;
}
