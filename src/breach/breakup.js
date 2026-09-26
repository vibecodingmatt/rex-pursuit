import * as T from 'three';

// Split the existing sculpt into bounded, reusable head/torso/limb/tail pieces.
// Each piece freezes the *same* pose shader and instance transform as its living
// source, so the explosion does not snap the animal into a rest pose first.
export function createBreakup(scene){
 const cache=new Map(),matrix=new T.Matrix4(),dummy=new T.Object3D(),origin=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3(),axis=new T.Vector3(),turn=new T.Quaternion();
 const stats={bursts:0,pieces:0};let detail=true;
 const patch=(s,pivot)=>{s.uniforms.uBreakPivot={value:pivot};s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 uBreakPivot;').replace('#include <project_vertex>','transformed-=uBreakPivot;\n#include <project_vertex>');};
 function prepare(source){
  const g=source.geometry;if(cache.has(g))return cache.get(g);
  const pos=g.attributes.position,index=g.index,groups=Array.from({length:9},()=>[]),low=pos.count<20000;
  for(let i=0;i<(index?.count??pos.count);i+=3){
   const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);let x=0,y=0,z=0;for(const id of ids){x+=pos.getX(id)/3;y+=pos.getY(id)/3;z+=pos.getZ(id)/3;}
   const part=z<-.48?0:z<-.19?1:y>.34&&z>.17?2:y<.265?(x<0?3:4):!low&&Math.abs(x)>.078&&z>.035?(x<0?5:6):x<0?7:8;groups[part].push(...ids);
  }
  const pieces=groups.filter(ids=>ids.length).map(ids=>{
   const geometry=new T.BufferGeometry();for(const [name,attribute]of Object.entries(g.attributes))if(!attribute.isInstancedBufferAttribute)geometry.setAttribute(name,attribute);
   geometry.setIndex(ids);const bounds=new T.Box3();for(const id of ids)bounds.expandByPoint(axis.fromBufferAttribute(pos,id));const pivot=bounds.getCenter(new T.Vector3()),radius=bounds.getSize(new T.Vector3()).length()*.22;
   // A uniform per piece keeps the existing rig within WebGL's 16 attributes.
   const material=source.material.clone(),depth=source.customDepthMaterial.clone();material.side=T.DoubleSide;
   material.onBeforeCompile=s=>{source.material.onBeforeCompile(s);patch(s,pivot);s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb=vec3(.20,.012,.018);');};
   material.customProgramCacheKey=()=>source.material.customProgramCacheKey()+'-breakup-2';
   depth.onBeforeCompile=s=>{source.customDepthMaterial.onBeforeCompile(s);patch(s,pivot);};depth.customProgramCacheKey=()=>source.customDepthMaterial.customProgramCacheKey()+'-breakup-2';
   for(const [name,size]of [['aPose',4],['aBody',4],['aFrill',1]])geometry.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(3*size),size));
   const mesh=new T.InstancedMesh(geometry,material,3);mesh.customDepthMaterial=depth;mesh.frustumCulled=false;mesh.count=0;mesh.castShadow=detail;mesh.receiveShadow=true;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
   const entries=Array.from({length:3},()=>({life:0,p:new T.Vector3(),v:new T.Vector3(),q:new T.Quaternion(),spin:new T.Vector3(),size:1,landed:false,deck:false}));
   return {mesh,pivot,radius,entries,next:0};
  });cache.set(g,pieces);return pieces;
 }
 function burst(c,dir){
  const k=c.kind,source=k.mesh;let slot=0;for(const candidate of k.pool){if(candidate===c)break;if(candidate.on)slot++;}
  source.getMatrixAt(slot,matrix);matrix.premultiply(source.matrixWorld);matrix.decompose(origin,rotation,scale);
  for(const piece of prepare(source)){
   const i=piece.next++%3,b=piece.entries[i],g=piece.mesh.geometry;b.life=6;b.p.copy(piece.pivot).applyMatrix4(matrix);b.q.copy(rotation);b.size=c.scale;b.landed=b.deck=false;
   axis.subVectors(b.p,origin).setY(.15+Math.random()*.6).normalize();b.v.copy(c.v).multiplyScalar(.3).addScaledVector(axis,4+Math.random()*5).addScaledVector(dir,2);b.v.y=3+Math.random()*5;
   b.spin.set(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(10);
   for(const name of ['aPose','aBody']){g.attributes[name].setXYZW(i,...source.geometry.attributes[name].array.slice(slot*4,slot*4+4));g.attributes[name].needsUpdate=true;}
   g.attributes.aFrill.setX(i,c.frill??1);g.attributes.aFrill.needsUpdate=true;
   piece.mesh.setColorAt(i,c.tint);piece.mesh.instanceColor.needsUpdate=true;stats.pieces++;
  }stats.bursts++;update(0);
 }
 function update(dt,speed=0){
  for(const pieces of cache.values())for(const piece of pieces){let count=0;for(let i=0;i<3;i++){
   const b=piece.entries[i];dummy.scale.setScalar(0);
   if(b.life>0){b.life=Math.max(0,b.life-dt);count=i+1;
    if(!b.landed){const previous=b.p.y;b.v.y-=dt*11;b.p.addScaledVector(b.v,dt);b.v.multiplyScalar(Math.exp(-dt*.35));b.p.z+=speed*dt;
     const floor=Math.abs(b.p.x)<1.02&&b.p.z>1.75&&b.p.z<3.26&&previous>1.075?1.075:0,radius=piece.radius*b.size;
     if(b.p.y<floor+radius){b.p.y=floor+radius;b.deck=floor>0;if(b.v.y<-2){b.v.y*=-.25;b.v.x*=.45;b.v.z*=.45;b.spin.multiplyScalar(.5);}else{b.landed=true;b.v.set(0,0,0);}}
     const w=b.spin.length();if(w>0){turn.setFromAxisAngle(axis.copy(b.spin).divideScalar(w),w*dt);b.q.premultiply(turn);}
    }else if(!b.deck)b.p.z+=speed*dt;
    dummy.position.copy(b.p);dummy.quaternion.copy(b.q);dummy.scale.setScalar(b.size*Math.min(1,b.life/.7));
   }dummy.updateMatrix();piece.mesh.setMatrixAt(i,dummy.matrix);
  }piece.mesh.count=count;piece.mesh.instanceMatrix.needsUpdate=true;}
 }
 return {stats,cache,prepare,burst,update,setQuality(t){detail=!!t.detail;for(const pieces of cache.values())for(const piece of pieces)piece.mesh.castShadow=detail;},reset(){for(const pieces of cache.values())for(const piece of pieces){piece.entries.forEach(b=>b.life=0);piece.mesh.count=0;piece.next=0;}stats.bursts=stats.pieces=0;}};
}
