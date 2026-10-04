// Builds public/models/mosa.bin (and mosa-low.bin for the Low tier): Lost Circuit's
// Mosasaurus (A12), the lagoon boss. A long, deep-chested marine lizard with a hypocercal
// tail (the spine bends down into the lower lobe, a fin above), four paddles, and a long
// crocodilian skull whose lower jaw is a separate surface hinged at the back, with rows of
// conical teeth on both jaws. Same method as scripts/build-ichthy.mjs:
// Sculpted as a signed distance field (a lofted body plus blended fins), meshed with
// marching cubes, projected onto the true surface and baked with per-vertex occlusion,
// crease cavity, body region and a jaw weight (1 on the lower jaw, fading to 0 at the hinge).
// The arcade's vertex shader swims her, strokes the paddles and opens the jaw
// (src/arcade/mosa.js); boss-mosa.js scales her to about 15 m.
//
//   npm run art:mosa
//
// Model units (scaled at runtime). +Z is forward (the snout), +Y up, origin at the chest.
import {writeFileSync} from 'node:fs';
import {edgeTable,triTable} from 'three/addons/objects/MarchingCubes.js';

const len=(x,y,z)=>Math.sqrt(x*x+y*y+z*z);
function smin(a,b,k){if(k<=0)return Math.min(a,b);const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
/** Rotation (pitch about X, then yaw about Y, then roll about Z) into a primitive's local frame. */
function frame(pitch=0,yaw=0,roll=0){const cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll);
 return (x,y,z)=>{const x1=cy*x-sy*z,z1=sy*x+cy*z,y1=cp*y+sp*z1,z2=-sp*y+cp*z1;return [cr*x1+sr*y1,-sr*x1+cr*y1,z2];};}
function ellipsoid([cx,cy,cz],[rx,ry,rz],{pitch=0,yaw=0,roll=0}={}){const f=frame(pitch,yaw,roll);
 return (x,y,z)=>{const [a,b,c]=f(x-cx,y-cy,z-cz),k0=len(a/rx,b/ry,c/rz),k1=len(a/(rx*rx),b/(ry*ry),c/(rz*rz));return k1<1e-9?-Math.min(rx,ry,rz):k0*(k0-1)/k1;};}
/** Capsule tapering from radius r1 at A to r2 at B, squeezed sideways by `squeeze`. */
function taper(A,B,r1,r2,squeeze=1){const bx=B[0]-A[0],by=B[1]-A[1],bz=B[2]-A[2],l2=bx*bx+by*by+bz*bz;
 return (x,y,z)=>{const px=(x-A[0])/squeeze,py=y-A[1],pz=z-A[2],t=Math.max(0,Math.min(1,(px*bx+py*by+pz*bz)/l2));return len(px-bx*t,py-by*t,pz-bz*t)*(squeeze*.5+.5)-(r1+(r2-r1)*t);};}
/** Monotone cubic through [z, value] keys: smooth, never overshoots. */
function curve(keys){
 const n=keys.length,X=keys.map(k=>k[0]),Y=keys.map(k=>k[1]),D=[],M=[];
 for(let i=0;i<n-1;i++)D[i]=(Y[i+1]-Y[i])/(X[i+1]-X[i]);
 M[0]=D[0];M[n-1]=D[n-2];for(let i=1;i<n-1;i++)M[i]=D[i-1]*D[i]<=0?0:(D[i-1]+D[i])/2;
 return z=>{z=Math.max(X[0],Math.min(X[n-1],z));let i=0;while(i<n-2&&z>X[i+1])i++;const h=X[i+1]-X[i],t=(z-X[i])/h,t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*Y[i]+(t3-2*t2+t)*h*M[i]+(-2*t3+3*t2)*Y[i+1]+(t3-t2)*h*M[i+1];};
}
/** Elliptical cross-sections along Z, closed with rounded ends. */
function loft(z0,z1,W,H,C){const w=curve(W),h=curve(H),c=curve(C);
 return (x,y,z)=>{const zc=Math.max(z0,Math.min(z1,z)),rw=w(zc),rh=h(zc),r=Math.min(rw,rh),d=(len(x/rw,(y-c(zc))/rh,0)-1)*r,out=Math.max(z0-z,z-z1,0);
  return out>0?len(Math.max(d,0),out,0)+Math.min(d,0):d;};}


// ------------------------------------------------------------- the animal --
// Regions: 0 body, 1 skull and upper jaw, 2 lower jaw, 3 tail fin, 4 fore paddle, 5 hind paddle, 6 eye, 7 upper teeth, 8 lower teeth.
const R={body:0,head:1,jaw:2,fluke:3,fore:4,hind:5,eye:6,upperTeeth:7,lowerTeeth:8};
const ss=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// The mouth: the line the jaws close on (falling slightly toward the snout), and the gap between
// them, nothing at the hinge and three voxels at the front, so each jaw is its own surface (a
// thinner gap gets bridged by the meshing and those bridges stretch into a cage when she opens).
export const HINGE=[0,-.085,1.0];
const mouth=z=>-.075-.015*(z-1.2),gap=z=>ss(1.02,1.45,z)*.085;
const body=loft(-3.75,1.05,
 [[-3.75,.03],[-3.2,.08],[-2.5,.16],[-1.6,.27],[-.8,.38],[0,.43],[.5,.4],[1.05,.31]],
 [[-3.75,.05],[-3.2,.12],[-2.5,.2],[-1.6,.32],[-.8,.45],[0,.5],[.5,.44],[1.05,.33]],
 [[-3.75,-.3],[-3.2,-.14],[-2.5,-.04],[-1.6,0],[0,0],[1.05,.02]]);
const skull=ellipsoid([0,.04,1.35],[.27,.24,.55]),snout=taper([0,0,1.7],[0,-.035,2.5],.16,.05,.95);
const jawLong=taper([0,-.16,1.1],[0,-.125,2.42],.17,.05,.9),jawBulge=ellipsoid([0,-.16,1.25],[.24,.13,.38]);
const upper=(x,y,z)=>Math.max(smin(skull(x,y,z),snout(x,y,z),.12),mouth(z)-y);
const lower=(x,y,z)=>Math.max(smin(jawLong(x,y,z),jawBulge(x,y,z),.1),y-(mouth(z)-gap(z)));
const eyes=[ellipsoid([.205,.12,1.36],[.06,.07,.09]),ellipsoid([-.205,.12,1.36],[.06,.07,.09])];
const finUp=ellipsoid([0,.28,-3.7],[.025,.42,.17],{pitch:.55}),finLow=ellipsoid([0,-.55,-3.55],[.03,.42,.16],{pitch:-.6});
const fore=[1,-1].map(s=>ellipsoid([s*.55,-.34,.55],[.52,.04,.19],{yaw:-s*.5,roll:-s*.25}));
const hind=[1,-1].map(s=>ellipsoid([s*.38,-.32,-.95],[.36,.035,.14],{yaw:-s*.6,roll:-s*.2}));
// Teeth: conical, upper ones hanging from the upper jaw's edge, lower ones standing between them.
const jawHalf=curve([[1.2,.24],[1.6,.19],[2,.13],[2.45,.06]]),TEETH=[];
for(const s of [1,-1])for(let i=0;i<11;i++){const z=1.3+i*.1,w=jawHalf(z)-.035,l=.085-i*.003;
 TEETH.push([taper([s*w,mouth(z)+.012,z],[s*w*.97,mouth(z)-l,z+.012],.022,.003),R.upperTeeth]);
 const zl=z+.05;if(zl<2.4)TEETH.push([taper([s*(jawHalf(zl)-.05),mouth(zl)-gap(zl)-.012,zl],[s*(jawHalf(zl)-.05)*.97,mouth(zl)-gap(zl)+l*.85,zl+.01],.02,.003),R.lowerTeeth]);}
function teeth(x,y,z){if(z<1.22||z>2.5||Math.abs(x)>.3||y>.02||y<-.26)return [1e9,0];let d=1e9,r=0;for(const [f,reg]of TEETH){const v=f(x,y,z);if(v<d){d=v;r=reg;}}return [d,r];}
const PARTS=[[body,R.body,0],[upper,R.head,.28],[lower,R.jaw,.22],[finUp,R.fluke,.08],[finLow,R.fluke,.08],
 ...fore.map(f=>[f,R.fore,.1]),...hind.map(f=>[f,R.hind,.08]),...eyes.map(e=>[e,R.eye,.03])];
function field(x,y,z,withRegion=false){
 let d=1e9,best=1e9,region=0;
 for(const [f,r,k]of PARTS){const v=f(x,y,z);if(v<best){best=v;region=r;}d=smin(d,v,k);}
 // The jaws stay apart: the blend above can fill the gap, so the gap is carved back out ahead of the hinge.
 if(z>1.15&&z<2.6&&Math.abs(x)<.32){const g=gap(z),m=mouth(z);if(g>.004)d=Math.max(d,g*.5-Math.abs(y-(m-g*.5)));}
 const [td,tr]=teeth(x,y,z);if(td<d){d=td;region=tr;}else if(td<best){best=td;region=tr;}
 return withRegion?[d,region]:d;
}
/** 1 on the lower jaw and its teeth, 0 on the skull and upper teeth, fading to 0 at the hinge. */
function jawWeight(x,y,z,region){if(region===R.upperTeeth||region===R.eye)return 0;const h=ss(.95,1.3,z);if(region===R.lowerTeeth)return h;
 // Where the jaws are apart the split is sharp (mid-gap); only at the hinge does the cheek stretch.
 const g=gap(z),wid=.05+(.003-.05)*ss(0,.03,g);return h*ss(-wid*.1,wid,mouth(z)-g*.5-y);}
// -------------------------------------------------------------- meshing --
function build(VOX,file){
 const MIN=[-1.4,-1.2,-4.1],MAX=[1.4,1.0,2.7];
 const NX=Math.ceil((MAX[0]-MIN[0])/VOX)+1,NY=Math.ceil((MAX[1]-MIN[1])/VOX)+1,NZ=Math.ceil((MAX[2]-MIN[2])/VOX)+1;
 const t0=Date.now(),F=new Float32Array(NX*NY*NZ),idx=(i,j,k)=>i+NX*(j+NY*k);
 for(let k=0;k<NZ;k++)for(let j=0;j<NY;j++)for(let i=0;i<NX;i++)F[idx(i,j,k)]=field(MIN[0]+i*VOX,MIN[1]+j*VOX,MIN[2]+k*VOX);
 const P=[],I=[],edgeVert=new Int32Array(NX*NY*NZ*3).fill(-1);
 function vert(i,j,k,axis){const e=idx(i,j,k)*3+axis;if(edgeVert[e]>=0)return edgeVert[e];
  const a=F[idx(i,j,k)],b=F[idx(i+(axis===0),j+(axis===1),k+(axis===2))],t=a/(a-b);
  P.push(MIN[0]+(i+(axis===0?t:0))*VOX,MIN[1]+(j+(axis===1?t:0))*VOX,MIN[2]+(k+(axis===2?t:0))*VOX);return edgeVert[e]=P.length/3-1;}
 const EDGES=[[0,0,0,0],[1,0,0,1],[0,1,0,0],[0,0,0,1],[0,0,1,0],[1,0,1,1],[0,1,1,0],[0,0,1,1],[0,0,0,2],[1,0,0,2],[1,1,0,2],[0,1,0,2]];
 const CORNERS=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 for(let k=0;k<NZ-1;k++)for(let j=0;j<NY-1;j++)for(let i=0;i<NX-1;i++){
  let cube=0;for(let c=0;c<8;c++){const [a,b,d]=CORNERS[c];if(-F[idx(i+a,j+b,k+d)]<0)cube|=1<<c;}
  if(!edgeTable[cube])continue;
  const ev=[];for(let e=0;e<12;e++)if(edgeTable[cube]&(1<<e)){const [a,b,d,axis]=EDGES[e];ev[e]=vert(i+a,j+b,k+d,axis);}
  for(let t=cube*16;triTable[t]!==-1;t+=3)I.push(ev[triTable[t]],ev[triTable[t+1]],ev[triTable[t+2]]);
 }
 const nV=P.length/3,N=new Float32Array(nV*3),h=.008;
 const grad=(x,y,z)=>{const gx=field(x+h,y,z)-field(x-h,y,z),gy=field(x,y+h,z)-field(x,y-h,z),gz=field(x,y,z+h)-field(x,y,z-h),l=len(gx,gy,gz)||1;return [gx/l,gy/l,gz/l];};
 for(let v=0;v<nV;v++){let x=P[v*3],y=P[v*3+1],z=P[v*3+2];
  for(let it=0;it<2;it++){const d=field(x,y,z),[gx,gy,gz]=grad(x,y,z);x-=gx*d;y-=gy*d;z-=gz*d;}
  P[v*3]=x;P[v*3+1]=y;P[v*3+2]=z;N.set(grad(x,y,z),v*3);}
 {let agree=0;for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],wx=P[c]-P[a],wy=P[c+1]-P[a+1],wz=P[c+2]-P[a+2];
  agree+=Math.sign((uy*wz-uz*wy)*N[a]+(uz*wx-ux*wz)*N[a+1]+(ux*wy-uy*wx)*N[a+2]);}
  if(agree<0)for(let t=0;t<I.length;t+=3){const s=I[t+1];I[t+1]=I[t+2];I[t+2]=s;}}
 // Occlusion, crease cavity and region per vertex.
 const aux=new Uint8Array(nV*4),STEPS=[.04,.1,.2,.35,.55];
 for(let v=0;v<nV;v++){const x=P[v*3],y=P[v*3+1],z=P[v*3+2],nx=N[v*3],ny=N[v*3+1],nz=N[v*3+2];
  let occ=0,wsum=0;STEPS.forEach((s,i)=>{const w=1/(1+i*.6),d=field(x+nx*s,y+ny*s,z+nz*s);occ+=w*Math.max(0,Math.min(1,(s-d)/s));wsum+=w;});
  const e=.05,lap=(field(x+e,y,z)+field(x-e,y,z)+field(x,y+e,z)+field(x,y-e,z)+field(x,y,z+e)+field(x,y,z-e)-6*field(x,y,z))/(e*e);
  aux[v*4]=Math.round(255*Math.max(0,1-1.3*occ/wsum));aux[v*4+1]=Math.round(255*Math.max(0,Math.min(1,-lap*.05)));const region=field(x,y,z,true)[1];aux[v*4+2]=region;aux[v*4+3]=Math.round(255*jawWeight(x,y,z,region));}
 const header={version:1,vertices:nV,indices:I.length,voxel:VOX,regions:R,length:+(MAX[2]-MIN[2]).toFixed(2),
  eyes:{centres:[[.205,.12,1.36],[-.205,.12,1.36]]},fore:{pivot:[.3,-.3,.55]},hind:{pivot:[.22,-.28,-.95]},hinge:HINGE,mouth:[-.075,-.015,1.2],tail:-3.75,snout:2.5};
 const idxArr=nV<65536?new Uint16Array(I):new Uint32Array(I);
 const Nq=new Int8Array(nV*4);for(let v=0;v<nV;v++){Nq[v*4]=Math.round(N[v*3]*127);Nq[v*4+1]=Math.round(N[v*3+1]*127);Nq[v*4+2]=Math.round(N[v*3+2]*127);}
 const parts=[new Float32Array(P),Nq,aux,idxArr];header.layout=['position:f32x3','normal:i8x4','aux:u8x4(ao,cavity,region,jaw)',`index:${idxArr instanceof Uint16Array?'u16':'u32'}`];
 let json=Buffer.from(JSON.stringify(header));const pad=(4-(json.length+4)%4)%4;json=Buffer.concat([json,Buffer.alloc(pad,32)]);
 const out=[Buffer.from(new Uint32Array([json.length]).buffer),json];for(const a of parts){out.push(Buffer.from(a.buffer,a.byteOffset,a.byteLength));const r=(4-a.byteLength%4)%4;if(r)out.push(Buffer.alloc(r));}
 writeFileSync(new URL('../public/models/'+file,import.meta.url),Buffer.concat(out));
 console.log(`${file}: ${nV} vertices, ${I.length/3} triangles, ${((Date.now()-t0)/1000).toFixed(1)} s, ${(Buffer.concat(out).length/1e6).toFixed(2)} MB`);
}
build(.028,'mosa.bin');
build(.05,'mosa-low.bin');
