import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Phone pass 4: merge sibling meshes that share a material into one mesh per group, so a rig built from many
 * small parts (the Jeep, the gun) costs one draw call per material per moving group instead of one per part.
 * Only static leaves merge: no children, not skinned or instanced, visible, single material, and not in `keep`
 * (anything code toggles, moves or recolours on its own). Groups keep their transforms, so animation survives.
 * Returns the number of draw calls saved.
 */
export function mergeSiblings(root,{keep=new Set()}={}){
 let saved=0;const groups=[];root.traverse(o=>{if(o.children.length)groups.push(o);});
 for(const g of groups){
  const byKey=new Map();
  for(const o of g.children){
   if(!o.isMesh||o.isInstancedMesh||o.isSkinnedMesh||o.children.length||keep.has(o)||!o.visible||Array.isArray(o.material)||o.morphTargetInfluences)continue;
   const key=`${o.material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(o);
  }
  for(const list of byKey.values()){
   if(list.length<2)continue;const indexed=list.every(o=>o.geometry.index);
   const geos=list.map(o=>{o.updateMatrix();const geo=indexed?o.geometry.clone():o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();return geo.applyMatrix4(o.matrix);});
   const names=x=>Object.keys(x.attributes).sort().join();
   if(geos.some(x=>names(x)!==names(geos[0]))){for(const x of geos)x.dispose();continue;}
   const geo=mergeGeometries(geos,false);for(const x of geos)x.dispose();if(!geo)continue;
   const m=new T.Mesh(geo,list[0].material);m.name='Merged parts';m.castShadow=list[0].castShadow;m.receiveShadow=list[0].receiveShadow;m.renderOrder=list[0].renderOrder;
   g.add(m);for(const o of list)g.remove(o);saved+=list.length-1;
  }
 }
 return saved;
}
/** Every Object3D an API object refers to (its own properties and arrays of them), to keep out of a merge. */
export function referenced(api){const out=new Set();for(const v of Object.values(api||{}))for(const x of Array.isArray(v)?v:[v])if(x?.isObject3D)out.add(x);return out;}
