import * as T from 'three';
// A startled flock bursting out of the canopy when she roars. One instanced
// draw; wing flap is done in the vertex shader, flight paths on the CPU.
export function createBirds(scene,{count=28}={}){
 // Body plus two wing triangles; wing vertices carry a flap weight in uv.x.
 const P=[0,0,.16, 0,0,-.12, -.03,.02,0, .03,.02,0, 0,0,.08, 0,0,-.05, -.46,.02,-.06, 0,0,.08, 0,0,-.05, .46,.02,-.06];
 const W=[0,0,0,0, 0,0,1, 0,0,1];
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('flap',new T.Float32BufferAttribute(W,1));
 geo.setIndex([0,2,1, 0,1,3, 4,5,6, 7,9,8]);geo.computeVertexNormals();
 const uniforms={time:{value:0}};
 const material=new T.MeshBasicMaterial({color:0x1a1d17,side:T.DoubleSide,fog:true});
 material.onBeforeCompile=s=>{s.uniforms.uBirdTime=uniforms.time;
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float flap;uniform float uBirdTime;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    float phase=uBirdTime*(11.+float(gl_InstanceID%5))+float(gl_InstanceID)*1.7;
    transformed.y+=flap*sin(phase)*abs(position.x)*1.1;`);};
 material.customProgramCacheKey=()=> 'rex-birds-v1';
 const mesh=new T.InstancedMesh(geo,material,count);mesh.frustumCulled=false;mesh.count=0;mesh.name='Startled flock';scene.add(mesh);
 const birds=Array.from({length:count},()=>({p:new T.Vector3(),v:new T.Vector3(),age:99,life:7,size:1,wobble:0}));
 const obj=new T.Object3D(),look=new T.Vector3();let active=0;
 return{mesh,
  scatter(origin,{spread=18,count:n=count}={}){
   active=Math.min(count,n);
   for(let i=0;i<active;i++){const b=birds[i],a=Math.random()*Math.PI*2,r=Math.random()*spread;
    b.p.set(origin.x+Math.cos(a)*r,origin.y+Math.random()*5,origin.z+Math.sin(a)*r*.6);
    b.v.set((Math.random()-.5)*6+(b.p.x>0?3:-3),5+Math.random()*4,4+Math.random()*6);b.age=-Math.random()*.6;b.life=5+Math.random()*3;b.size=.7+Math.random()*.6;b.wobble=Math.random()*6;}
   mesh.count=active;
  },
  reset(){for(const b of birds)b.age=99;mesh.count=0;active=0;},
  update(dt,time,roadSpeed){
   uniforms.time.value=time;if(!active)return;let alive=0;
   for(let i=0;i<active;i++){const b=birds[i];b.age+=dt;
    if(b.age<0||b.age>b.life){obj.position.set(0,-500,0);obj.scale.setScalar(.001);}
    else{alive++;b.v.y=Math.max(1.2,b.v.y-dt*1.4);b.v.x+=Math.sin(time*1.3+b.wobble)*dt*2;b.p.addScaledVector(b.v,dt);b.p.z+=roadSpeed*dt*.4;
     obj.position.copy(b.p);look.copy(b.p).add(b.v);obj.lookAt(look);obj.scale.setScalar(b.size*(1-Math.max(0,(b.age-b.life+1))));}
    obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);}
   mesh.instanceMatrix.needsUpdate=true;if(!alive&&birds.slice(0,active).every(b=>b.age>b.life)){active=0;mesh.count=0;}
  }};
}
