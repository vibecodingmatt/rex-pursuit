import * as THREE from 'three';
// Rebind the imported skeleton in the authored standing pose. This removes the
// source's mixed cm/m transforms and makes the asset editable in Blender.
export function prepareModel(source){
 source.updateMatrixWorld(true);source.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const originals=[];source.traverse(o=>{if(o.isBone)originals.push(o);});
 const group=new THREE.Group();group.name='Rex_Encounter';
 const worldPos=new Map(),worldQuat=new Map();
 for(const b of originals){worldPos.set(b,b.getWorldPosition(new THREE.Vector3()));worldQuat.set(b,b.getWorldQuaternion(new THREE.Quaternion()));}
 const head=originals.find(b=>b.name==='head_012');const hp=worldPos.get(head).clone();
 // Broader, deeper skull and fuller neck, with all mouth/eye pieces following.
 function sculpt(p){const h=THREE.MathUtils.smoothstep(p.z,hp.z-.9,hp.z+.15)*THREE.MathUtils.smoothstep(p.y,hp.y-1.5,hp.y-.7);p.x=hp.x+(p.x-hp.x)*(1+.40*h);p.y=hp.y+(p.y-hp.y)*(1+.25*h)+h*.07;p.z=hp.z+(p.z-hp.z)*(1+.15*h);const brow=Math.exp(-1*((p.z-hp.z-.72)/.32)**2-((Math.abs(p.x-hp.x)-.59)/.26)**2-((p.y-hp.y-.52)/.25)**2);p.y+=brow*.13;return p;}
 const clean=new Map(originals.map(b=>[b,new THREE.Bone()]));
 for(const b of originals){const n=clean.get(b);n.name=b.name;let p=b.parent;while(p&&!p.isBone)p=p.parent;if(b.name==='Ctrl_head_033')p=head;const parent=clean.get(p);const wp=sculpt(worldPos.get(b).clone());if(parent){parent.add(n);n.position.copy(wp.sub(sculpt(worldPos.get(p).clone())).applyQuaternion(worldQuat.get(p).clone().invert()));n.quaternion.copy(worldQuat.get(p).clone().invert().multiply(worldQuat.get(b)));}else{group.add(n);n.position.copy(wp);n.quaternion.copy(worldQuat.get(b));}}
 group.updateMatrixWorld(true);
 const allBones=originals.map(b=>clean.get(b)),skeleton=new THREE.Skeleton(allBones),indexMap=new Map(originals.map((b,i)=>[b,i]));
 const meshes=[];source.traverse(o=>{if(o.isMesh&&o.visible&&o.material.name!=='BlackMat')meshes.push(o);});
 for(const o of meshes){const g=o.geometry.clone();const positions=g.attributes.position;const v=new THREE.Vector3();for(let i=0;i<positions.count;i++){o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld);sculpt(v);positions.setXYZ(i,v.x,v.y,v.z);}positions.needsUpdate=true;
  const skinIndex=new Uint16Array(positions.count*4),skinWeight=new Float32Array(positions.count*4);
  if(o.isSkinnedMesh){const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight;for(let i=0;i<positions.count;i++)for(let k=0;k<4;k++){skinIndex[i*4+k]=indexMap.get(o.skeleton.bones[si.getComponent(i,k)])||0;skinWeight[i*4+k]=sw.getComponent(i,k);}}
  else{let parent=o.parent;while(parent&&!parent.isBone)parent=parent.parent;for(let i=0;i<positions.count;i++){skinIndex[i*4]=indexMap.get(parent)||indexMap.get(head);skinWeight[i*4]=1;}}
  g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));g.deleteAttribute('tangent');g.computeVertexNormals();g.computeBoundingBox();
  const material=o.material.clone();material.onBeforeCompile=()=>{};material.color.setRGB(1,1,1);
  const mesh=new THREE.SkinnedMesh(g,material);mesh.name={BodyMat:'Rex_Skin',EyesMat:'Rex_Eyes',GlassMat:'Rex_Cornea'}[material.name]||o.name;mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);mesh.bind(skeleton);mesh.normalizeSkinWeights();
 }
 group.updateMatrixWorld(true);skeleton.update();
 const box=new THREE.Box3().setFromObject(group,true);const shift=new THREE.Vector3(-(box.min.x+box.max.x)/2,-box.min.y,0);
 // Shift vertices and root bones together, then bind again at identity.
 group.traverse(o=>{if(o.isMesh)o.geometry.translate(shift.x,shift.y,shift.z);});for(const b of allBones)if(b.parent===group)b.position.add(shift);group.updateMatrixWorld(true);skeleton.calculateInverses();group.traverse(o=>{if(o.isSkinnedMesh)o.bind(skeleton);});
 group.userData={title:'Rex Encounter — 1993 design study',source:'Tyrannosaurus Rex 2.0 by Stevenson / TStevenz',license:'CC-BY-4.0',modifications:'Standing pose, skull proportions, clean skeleton rebind, original behavior clips. Not a verified film replica.'};
 return group;
}
