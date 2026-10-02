import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const mix=T.MathUtils.lerp, smooth=T.MathUtils.smoothstep;
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function noise(x,y){
 const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 return mix(mix(hash(i,j),hash(i+1,j),u),mix(hash(i,j+1),hash(i+1,j+1),u),v);
}
function fbm(x,y){return noise(x,y)*.58+noise(x*2.03,y*2.03)*.28+noise(x*4.11,y*4.11)*.14;}

// A continuous geological field, sampled by every chunk with the same world
// coordinates. No stretched open scan edges, overlapping sheets or wrap seam.
// Keep the backing above the highest stacked relief. Otherwise the cut bottom
// of a scan on the top row becomes a sky hole at some points on the route.
function crown(z,side){return 23.5+noise(z*.035,side*19+30)*4+noise(z*.15,side+6)*1.5;}
function point(z,t,side){
 const top=crown(z,side),y=-3+t*(top+3),seed=side*13+23;
 const buttress=fbm(z*.052,seed),broad=noise(z*.014,seed+4);
 const layer=y+noise(z*.032,seed)*1.8;
 const ledges=smooth(layer,7,8.2)*1.45+smooth(layer,16,17.2)*1.85+smooth(layer,25,26.5)*2.2;
 const flute=Math.pow(noise(z*.24,seed+8),3)*1.4;
 const chips=(fbm(z*.28,y*.24+seed)-.5)*2;
 // Low scree slopes ease into buttresses, rather than vertical walls meeting
// an infinitely flat road. The driveable corridor remains at least 15m wide.
 const toe=(1-smooth(y,0,5))*2.8;
 const x=18+broad*4+buttress*3+y*.19+ledges+flute+chips-toe;
 return new T.Vector3(side*x,y,z);
}

function wallChunk(z0,side){
 const nz=96,ny=80,length=120,positions=[],uvs=[],colors=[],normals=[],indices=[];
 const c=new T.Color(),ochre=new T.Color('#858e91'),pale=new T.Color('#b0b5b4'),oxide=new T.Color('#7d8080');
 const tangentZ=new T.Vector3(),tangentY=new T.Vector3(),normal=new T.Vector3();
 // Front face plus a broad cap and rear face: the silhouette has real depth.
 const rows=ny+4;
 function sample(z,row){
  if(row<=ny)return point(z,row/ny,side);
  const p=point(z,1,side);
  if(row===ny+1)return new T.Vector3(p.x+side*8,p.y+2.5+noise(z*.08,8)*3,z);
  if(row===ny+2)return new T.Vector3(side*85,p.y+7,z);
  return new T.Vector3(side*85,-3,z);
 }
 for(let iz=0;iz<=nz;iz++)for(let iy=0;iy<rows;iy++){
  const z=z0+iz*length/nz,p=sample(z,iy),layer=p.y+noise(z*.032,side*13+23)*1.8;
  positions.push(p.x,p.y,p.z);
  uvs.push(z*.23,(iy<=ny?p.y:Math.abs(p.x))*.23);
  c.copy(ochre).lerp(pale,smooth(layer,11,15)*.65).lerp(oxide,(1-smooth(Math.abs(layer-8),1,4))*.33);
  c.multiplyScalar(.84+fbm(z*.16,p.y*.5)*.27);colors.push(c.r,c.g,c.b);
  if(iy<=ny){
   tangentZ.subVectors(point(z+.02,iy/ny,side),point(z-.02,iy/ny,side));
   tangentY.subVectors(point(z,Math.min(1,iy/ny+.0004),side),point(z,Math.max(0,iy/ny-.0004),side));
   normal.crossVectors(tangentZ,tangentY).multiplyScalar(side).normalize();
  }else normal.set(0,iy===ny+3?0:1,0);
  if(iy===ny+3)normal.set(side,0,0);
  normals.push(normal.x,normal.y,normal.z);
 }
 for(let iz=0;iz<nz;iz++)for(let iy=0;iy<rows-1;iy++){
  const a=iz*rows+iy,b=a+rows;
  if(side>0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);
 }
 // Close ends beyond the viewable route. Adjacent interior ends also meet
 // exactly, so lighting/frustum culling cannot reveal a sky crack.
 for(const iz of [0,nz]){const base=positions.length/3,z=z0+iz*length/nz;positions.push(side*85,-3,z);uvs.push(0,0);colors.push(c.r,c.g,c.b);normals.push(0,0,iz===0?-1:1);for(let iy=0;iy<rows-1;iy++){const a=iz*rows+iy;indices.push(base,a,a+1);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeBoundingSphere();return geo;
}

export async function createGeology(parent){
 const maps=await Promise.all(['diff','nor_gl','rough'].map(n=>new T.TextureLoader().loadAsync(`./textures/ravine/sandstone-${n}.jpg`)));
 maps.forEach(t=>{t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;});maps[0].colorSpace=T.SRGBColorSpace;
 const material=new T.MeshStandardMaterial({map:maps[0],normalMap:maps[1],roughnessMap:maps[2],normalScale:new T.Vector2(.85,.85),roughness:1,vertexColors:true,envMapIntensity:.35,side:T.DoubleSide});
 const root=new T.Group();root.name='Continuous sandstone canyon';parent.add(root);
 for(const side of [-1,1])for(let z=-960;z<360;z+=120){const mesh=new T.Mesh(wallChunk(z,side),material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 // The same stone on fallen blocks connects the large cliff forms to the road.
 const debrisMaterial=material.clone();debrisMaterial.vertexColors=false;debrisMaterial.color.set('#8a9190');
 const asset=await new GLTFLoader().loadAsync('./models/ravine-outcrop.glb');asset.scene.updateMatrixWorld(true);
 const scans=['Ravine_Outcrop_High','Ravine_Outcrop_LOD'].map(name=>{const source=asset.scene.getObjectByName(name);const geo=source.geometry.clone().applyMatrix4(source.matrixWorld);geo.computeBoundingBox();const b=geo.boundingBox,center=b.getCenter(new T.Vector3());geo.translate(-center.x,-b.min.y,-center.z);return{geo,material:source.material};});
 const scanMaterial=scans[0].material;scanMaterial.color.set('#c4b9a6');scanMaterial.roughness=.96;scanMaterial.envMapIntensity=.3;scanMaterial.side=T.DoubleSide;scanMaterial.normalScale.set(.85,.85);for(const map of [scanMaterial.map,scanMaterial.normalMap,scanMaterial.roughnessMap])if(map)map.anisotropy=8;
 // Scans are reliefs, not watertight boulders. Their side/bottom cuts are
 // deliberately buried in neighbouring faces and the continuous rock mass.
 function mirrored(geo){const g=geo.clone().scale(-1,1,1),index=g.index;for(let i=0;i<index.count;i+=3){const a=index.getX(i);index.setX(i,index.getX(i+2));index.setX(i+2,a);}return g;}
 const groups=scans.map((s,lod)=>[s.geo,mirrored(s.geo)].map((geo,mirror)=>{const mesh=new T.InstancedMesh(geo,scanMaterial,80);mesh.name=`Scanned outcrops ${lod?'far':'near'} ${mirror}`;mesh.castShadow=lod===0;mesh.receiveShadow=true;mesh.frustumCulled=false;parent.add(mesh);return mesh;}));
 const placements=[],dummy=new T.Object3D();
 for(const side of [-1,1])for(let i=-50;i<18;i++)for(let row=0;row<3;row++){
  const h=hash(i,side*6+row),z=i*18+row*9+side*4+(h-.5)*3,scale=1.35+h*.4;
  placements.push({side,z,x:side*(17.7+row*3.4+noise(i*.34,side+4)*2),y:row===0?-1.8:row*4.8-1.2+h*1.5,scale,height:.82+hash(i+91,side+row)*.26,mirror:hash(i+24,row+side)<.5?0:1,yaw:-side*Math.PI/2+(h-.5)*.19,roll:(hash(i,4)-.5)*.08});
 }
 let closeDistance=60;
 function update(travel){root.position.z=travel;const count=[[0,0],[0,0]];for(const p of placements){const z=p.z+travel;if(z<-45||z>270)continue;const lod=z<closeDistance?0:1,group=groups[lod][p.mirror],n=count[lod][p.mirror]++;dummy.position.set(p.x,p.y,z);dummy.rotation.set(p.roll,p.yaw,0);dummy.scale.set(p.scale,p.scale*p.height,p.scale);dummy.updateMatrix();group.setMatrixAt(n,dummy.matrix);}groups.forEach((row,lod)=>row.forEach((m,mirror)=>{m.count=count[lod][mirror];m.instanceMatrix.needsUpdate=true;}));}
 return {root,material,debrisMaterial,update,point,setQuality(t){closeDistance=t.detail?60:28;}};
}
