import * as T from 'three';
/**
 * The Safari sculpts in one request: every species at two geometry budgets
 * (scripts/build-safari.mjs, format 2). Positions arrive quantized to each model's
 * bounds and the rig as bytes plus a pivot table; both are expanded here into the
 * float attributes the critter shader reads (part 3: legs, part 4: shoulder/arm,
 * with fingers and nails following the same shoulder). The spare fourth bytes carry the hide:
 * `hide` (colour alpha) is the fine-scale amount and `gloss` (the normal's fourth
 * byte) is positive for eyes, horn and beak, negative for large tubercles. Also returns
 * per-species hit spheres, the body centre and the hull a dead body rests on.
 */
export async function loadSafariModels(){
 const response=await fetch('./models/safari-runners.bin');if(!response.ok)throw Error(`Safari models: ${response.status}`);
 const buffer=await response.arrayBuffer(),size=new DataView(buffer).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,size)));
 if(header.version!==2)throw Error(`Safari models: unsupported format ${header.version}`);
 const models={};
 for(const m of header.models){
  let offset=4+size+m.offset;const take=(Type,count)=>{const values=new Type(buffer,offset,count);offset+=Math.ceil(values.byteLength/4)*4;return values;};
  const n=m.vertices,q=take(Int16Array,n*3),normal=take(Int8Array,n*4),color=take(Uint8Array,n*4),bytes=take(Uint8Array,n*4),index=take(Uint16Array,m.indices);
  const [lo,hi]=m.bounds,position=new Float32Array(n*3),rig=new Float32Array(n*4),pivot=new Float32Array(n*3);
  for(let i=0;i<n;i++){
   for(let a=0;a<3;a++)position[i*3+a]=lo[a]+(q[i*3+a]+32768)/65535*(hi[a]-lo[a]);
   const [part,side,lead,px,py,pz]=m.pivots[bytes[i*4+2]];rig[i*4]=part;rig[i*4+1]=bytes[i*4+1]/255;rig[i*4+2]=side;
   // Head vertices do not need a fore/hind-leg sign. Reuse that component for
   // the membrane weight to stay within WebGL's 16 vertex-attribute slots.
   rig[i*4+3]=part===1?bytes[i*4+3]/255:lead;pivot[i*3]=px;pivot[i*3+1]=py;pivot[i*3+2]=pz;
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(position,3));
  const normals=new T.InterleavedBuffer(normal,4),colors=new T.InterleavedBuffer(color,4);
  g.setAttribute('normal',new T.InterleavedBufferAttribute(normals,3,0,true));g.setAttribute('gloss',new T.InterleavedBufferAttribute(normals,1,3,true));
  g.setAttribute('color',new T.InterleavedBufferAttribute(colors,3,0,true));g.setAttribute('hide',new T.InterleavedBufferAttribute(colors,1,3,true));
  g.setAttribute('rig',new T.BufferAttribute(rig,4));g.setAttribute('pivot',new T.BufferAttribute(pivot,3));g.setIndex(new T.BufferAttribute(index,1));g.computeBoundingSphere();
  (models[m.name]??={})[m.tier]=g;
 }
 return {models,species:header.species};
}
