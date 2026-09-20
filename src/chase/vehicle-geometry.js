import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function box(parent,material,size,position,rotation){
 const radius=Math.min(...size)*.12;
 const mesh=new T.Mesh(radius>.005?new RoundedBoxGeometry(...size,2,radius):new T.BoxGeometry(...size),material);
 mesh.position.set(...position);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function cylinder(parent,material,top,bottom,length,position,rotation=[Math.PI/2,0,0],segments=20){
 const mesh=new T.Mesh(new T.CylinderGeometry(top,bottom,length,segments),material);mesh.position.set(...position);mesh.rotation.set(...rotation);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
export function tube(parent,material,a,b,radius){
 const av=new T.Vector3(...a),bv=new T.Vector3(...b),direction=bv.clone().sub(av);
 const mesh=cylinder(parent,material,radius,radius,direction.length(),av.add(bv).multiplyScalar(.5).toArray(),[0,0,0],12);
 mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());return mesh;
}
export function sphere(parent,material,radius,position,scale=[1,1,1]){
 const mesh=new T.Mesh(new T.SphereGeometry(radius,20,14),material);mesh.position.set(...position);mesh.scale.set(...scale);mesh.castShadow=true;parent.add(mesh);return mesh;
}
export function mergeStatic(group){
 const sets=new Map();for(const child of [...group.children]){
  if(!child.isMesh||child.isInstancedMesh||child.material.transparent)continue;
  child.updateMatrix();let geometry=child.geometry.clone().applyMatrix4(child.matrix);if(geometry.index)geometry=geometry.toNonIndexed();
  if(!sets.has(child.material))sets.set(child.material,[]);sets.get(child.material).push(geometry);group.remove(child);child.geometry.dispose();
 }
 for(const [material,geometries]of sets){const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
}
export function canvasDecal(parent,width,height,draw,size,position,rotation){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
 const material=new T.MeshStandardMaterial({map,transparent:true,depthWrite:false,roughness:.68,metalness:.04,polygonOffset:true,polygonOffsetFactor:-2});
 const mesh=new T.Mesh(new T.PlaneGeometry(...size),material);mesh.position.set(...position);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;
}
