import * as T from 'three';
import {ROAD_SPEED,shoulderHeight,hash} from './route.js';
const v=new T.Vector3(),w=new T.Vector3(),normal=new T.Vector3(),axis=new T.Vector3(),turn=new T.Quaternion();
const skinMatrix=new T.Matrix4(),worldBind=new T.Matrix4();
function bakePose(mesh,source){
 // Compose each joint once; rebuilding four Matrix4s for every skin vertex
 // and normal made a direct impact noticeably stall the simulation.
 const matrices=source.jointMatrices;worldBind.multiplyMatrices(mesh.matrixWorld,mesh.bindMatrixInverse);
 for(let j=0;j<mesh.skeleton.bones.length;j++)skinMatrix.copy(worldBind).multiply(mesh.skeleton.bones[j].matrixWorld).multiply(mesh.skeleton.boneInverses[j]).multiply(mesh.bindMatrix).toArray(matrices,j*16);
 const {position:p,normal:n,skinIndex:si,skinWeight:sw}=source.g.attributes;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=n.getX(i),ny=n.getY(i),nz=n.getZ(i);let px=0,py=0,pz=0,ax=0,ay=0,az=0;
  for(let k=0;k<4;k++){const weight=sw.getComponent(i,k);if(!weight)continue;const m=si.getComponent(i,k)*16;
   px+=(matrices[m]*x+matrices[m+4]*y+matrices[m+8]*z+matrices[m+12])*weight;py+=(matrices[m+1]*x+matrices[m+5]*y+matrices[m+9]*z+matrices[m+13])*weight;pz+=(matrices[m+2]*x+matrices[m+6]*y+matrices[m+10]*z+matrices[m+14])*weight;
   ax+=(matrices[m]*nx+matrices[m+4]*ny+matrices[m+8]*nz)*weight;ay+=(matrices[m+1]*nx+matrices[m+5]*ny+matrices[m+9]*nz)*weight;az+=(matrices[m+2]*nx+matrices[m+6]*ny+matrices[m+10]*nz)*weight;
  }
  const at=i*3,length=Math.hypot(ax,ay,az)||1;source.posed[at]=px;source.posed[at+1]=py;source.posed[at+2]=pz;source.normals[at]=ax/length;source.normals[at+1]=ay/length;source.normals[at+2]=az/length;
 }
}
function region(name){const n=Number(name.replace('Bone',''));if([13,14,15,16,17,19,20,21].includes(n))return 0;if([11,12].includes(n))return 1;if(n===10)return 2;if([22,23,40,18,45,46,48,49,51].includes(n))return 3;if(n>=41)return 4;if([24,26,28,29,30,31,32,33].includes(n))return 5;if(n>=25&&n<=39)return 6;return [0,4,3,2].includes(n)?7:8;}
// CPU-bake the *current skinned pose* once per direct impact. Bounded fragment
// slots reuse their buffers; UVs/normals survive, and shared cut edges get flesh
// caps so a severed limb is a solid piece rather than an empty textured shell.
export function createRaptorBreakup(scene,sourceMeshes,{surface=(x,z)=>shoulderHeight(x),deck=false}={}){
 const flesh=new T.MeshStandardMaterial({color:0x780c18,roughness:.63,metalness:0,side:T.DoubleSide,envMapIntensity:.14});
 flesh.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTissue;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTissue=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vTissue;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=.65+.35*sin(vTissue.x*64.+sin(vTissue.y*34.)*2.+vTissue.z*25.);');};flesh.customProgramCacheKey=()=> 'ravine-cut-flesh';
 const sources=sourceMeshes.filter(m=>m.isSkinnedMesh).map(source=>{
  const g=source.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,index=g.index,groups=Array.from({length:9},()=>({ids:[],cuts:new Map()})),edges=new Map();
  const labels=Array.from({length:p.count},(_,i)=>{let best=0;for(let k=1;k<4;k++)if(sw.getComponent(i,k)>sw.getComponent(i,best))best=k;return region(source.skeleton.bones[si.getComponent(i,best)].name);});
  const keys=Array.from({length:p.count},(_,i)=>`${Math.round(p.getX(i)*1e5)},${Math.round(p.getY(i)*1e5)},${Math.round(p.getZ(i)*1e5)}`);
  for(let i=0;i<(index?.count??p.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),ls=ids.map(n=>labels[n]),part=ls[0]===ls[1]||ls[0]===ls[2]?ls[0]:ls[1]===ls[2]?ls[1]:ls[0];groups[part].ids.push(...ids);
   for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[keys[a],keys[b]].sort().join('|');if(!edges.has(key))edges.set(key,[]);edges.get(key).push({a,b,part});}}
  for(const es of edges.values())if(es.length===2&&es[0].part!==es[1].part)for(let i=0;i<2;i++){const e=es[i],cuts=groups[e.part].cuts,other=es[1-i].part;if(!cuts.has(other))cuts.set(other,[]);cuts.get(other).push([e.a,e.b]);}
  const material=source.material.clone();material.side=T.DoubleSide;material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(!gl_FrontFacing)diffuseColor.rgb=vec3(.18,.004,.012);');};material.customProgramCacheKey=()=> 'ravine-severed-hide';
  return{name:source.name,g,groups,material,posed:new Float32Array(p.count*3),normals:new Float32Array(p.count*3),jointMatrices:new Float64Array(source.skeleton.bones.length*16)};
 });
 const directions=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)directions.push(new T.Vector3(x,y,z).normalize());
 const gutPath=new T.CatmullRomCurve3(Array.from({length:24},(_,i)=>new T.Vector3(Math.sin(i*1.7)*.24,Math.cos(i*1.7)*.09,(i/23-.5)*.75))),gutGeometry=new T.TubeGeometry(gutPath,96,.035,7,false);
 let serial=0,detail=true;const stats={bursts:0,pieces:0},slots=Array.from({length:4},()=>({life:0,age:0,pieces:Array.from({length:11},(_,part)=>{
  const group=new T.Group();group.visible=false;scene.add(group);const meshes=[];
  for(const source of sources){const def=source.groups[part];if(!def?.ids.length)continue;const capCount=[...def.cuts.values()].reduce((n,es)=>n+es.length*3,0),count=def.ids.length+capCount,geo=new T.BufferGeometry();for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',4]])geo.setAttribute(name,new T.BufferAttribute(new Float32Array(count*size),size).setUsage(T.DynamicDrawUsage));geo.addGroup(0,def.ids.length,0);if(capCount)geo.addGroup(def.ids.length,capCount,1);const hide=source.material.clone();hide.onBeforeCompile=source.material.onBeforeCompile;hide.customProgramCacheKey=source.material.customProgramCacheKey;const mesh=new T.Mesh(geo,[hide,flesh]);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);meshes.push({mesh,source,def});}
  if(part>=9){const organ=new T.Mesh(gutGeometry,flesh);organ.rotation.y=(part-9)*1.6;organ.castShadow=organ.receiveShadow=true;group.add(organ);}
  return{group,meshes,v:new T.Vector3(),spin:new T.Vector3(),supports:[],center:new T.Vector3(),part};
 })}));
 function burst(actor,direction){const slot=slots.find(s=>s.life<=0)||slots.reduce((a,b)=>a.life<b.life?a:b);slot.life=7;slot.age=0;serial++;
  for(const source of sources){const mesh=actor.meshes.find(m=>m.name===source.name);mesh.updateWorldMatrix(true,false);bakePose(mesh,source);}
  for(const piece of slot.pieces){const {group,meshes,part}=piece,bounds=new T.Box3(),all=[];
   for(const {source,def}of meshes)for(const id of def.ids){v.fromArray(source.posed,id*3);bounds.expandByPoint(v);}
   if(part>=9){piece.center.copy(actor.body).add(new T.Vector3((part-9.5)*.15,0,.1));for(const d of directions)all.push(d.clone().multiplyScalar(.32));}
   else bounds.getCenter(piece.center);
   piece.deck=false;group.position.copy(piece.center);group.quaternion.identity();group.scale.setScalar(1);group.visible=part<10||detail;
   for(const {mesh,source,def}of meshes){mesh.material[0].color.copy(actor.meshes.find(m=>m.name===source.name).material.color);const geo=mesh.geometry,p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv,col=geo.attributes.color;let at=0;
    const put=(point,norm,u=0,vv=0,id=-1)=>{p.setXYZ(at,point.x,point.y,point.z);n.setXYZ(at,norm.x,norm.y,norm.z);uv.setXY(at,u,vv);const c=source.g.attributes.color;col.setXYZW(at,id>=0&&c?c.getX(id):1,id>=0&&c?c.getY(id):1,id>=0&&c?c.getZ(id):1,id>=0&&c?.itemSize===4?c.getW(id):1);at++;if(at%12===0)all.push(point.clone());};
    for(const id of def.ids){v.fromArray(source.posed,id*3).sub(piece.center);w.fromArray(source.normals,id*3);const tex=source.g.attributes.uv;put(v,w,tex?.getX(id)||0,tex?.getY(id)||0,id);}
    for(const es of def.cuts.values()){const center=new T.Vector3();for(const [a,b]of es)center.add(v.fromArray(source.posed,a*3)).add(w.fromArray(source.posed,b*3));center.divideScalar(es.length*2).sub(piece.center);
     for(const [a,b]of es){v.fromArray(source.posed,b*3).sub(piece.center);w.fromArray(source.posed,a*3).sub(piece.center);normal.crossVectors(axis.subVectors(v,center),turnVector(w,center)).normalize();put(center,normal,.5,.5);put(v,normal,0,0);put(w,normal,1,1);}}
    p.needsUpdate=n.needsUpdate=uv.needsUpdate=col.needsUpdate=true;geo.computeBoundingSphere();}
   piece.supports=directions.map(d=>all.reduce((a,b)=>b.dot(d)>a.dot(d)?b:a,all[0]||new T.Vector3()).clone());
   axis.subVectors(piece.center,actor.body).add(new T.Vector3((hash(part+serial)-.5)*.3,.2,0)).normalize();piece.v.copy(axis).multiplyScalar(3.5+hash(part+41)*4).addScaledVector(direction,2.5);piece.v.y=3+hash(part+serial*3)*4;piece.v.z-=Math.min(13,actor.data.deadSpeed||10)*.35;piece.spin.set(hash(part+9)-.5,hash(part+19)-.5,hash(part+29)-.5).multiplyScalar(12);stats.pieces++;
  }stats.bursts++;
 }
 const crossScratch=new T.Vector3();function turnVector(a,b){return crossScratch.subVectors(a,b);}
 function update(dt,speed=ROAD_SPEED){if(dt<=0)return;for(const slot of slots)if(slot.life>0){slot.life=Math.max(0,slot.life-dt);slot.age+=dt;for(const piece of slot.pieces){const g=piece.group;if(!g.visible)continue;let left=dt;while(left>1e-8){const h=Math.min(left,1/120);left-=h;piece.v.y-=12*h;g.position.addScaledVector(piece.v,h);if(!piece.deck)g.position.z+=speed*h;const spin=piece.spin.length();if(spin>1e-4)g.quaternion.premultiply(turn.setFromAxisAngle(axis.copy(piece.spin).divideScalar(spin),spin*h));let correction=0;for(const p of piece.supports){v.copy(p).applyQuaternion(g.quaternion).add(g.position);correction=Math.max(correction,surface(v.x,v.z)+.015-v.y);}if(correction>0){g.position.y+=correction;piece.v.y=piece.v.y< -2&&slot.age<1.6?-piece.v.y*.14:0;piece.v.x*=Math.exp(-h*7);piece.v.z*=Math.exp(-h*7);piece.spin.multiplyScalar(Math.exp(-h*11));if(deck)piece.deck=surface(g.position.x,g.position.z)>.5;}}
    g.scale.setScalar(Math.min(1,slot.life/.5));if(!slot.life)g.visible=false;}}}
 return{slots,stats,burst,update,reset(){for(const s of slots){s.life=0;for(const p of s.pieces)p.group.visible=false;}stats.bursts=stats.pieces=0;},setQuality(t){detail=!!t.detail;for(const s of slots)for(const p of s.pieces)p.group.traverse(o=>{if(o.isMesh)o.castShadow=detail;});}};
}
