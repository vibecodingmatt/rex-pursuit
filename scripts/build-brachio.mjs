// Builds public/models/brachio.bin (and a coarser brachio-low.bin for the Low tier): a Brachiosaurus (Giraffatitan proportions, the
// Jurassic Park look) sculpted as a signed distance field from ~60 smoothly
// blended anatomical volumes, meshed with marching cubes, projected onto the true
// surface, and baked with per-vertex ambient occlusion, crease cavity, body region
// and a spine coordinate that drives the neck, tail and jaw in the vertex shader.
//
//   npm run art:brachio
//
// Units are metres. +Z is forward, +Y up, the origin is on the ground under the torso.
import {writeFileSync} from 'node:fs';
import {edgeTable,triTable} from 'three/addons/objects/MarchingCubes.js';

// ------------------------------------------------------------------ SDF kit --
const len=(x,y,z)=>Math.sqrt(x*x+y*y+z*z);
function smin(a,b,k){if(k<=0)return Math.min(a,b);const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
function smax(a,b,k){return -smin(-a,-b,k);}
/** Rotation (pitch about X, then yaw about Y) into a primitive's local frame. */
function frame(pitch=0,yaw=0){const cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw);
 return (x,y,z)=>{const x1=cy*x-sy*z,z1=sy*x+cy*z;return [x1,cp*y+sp*z1,-sp*y+cp*z1];};}
function ellipsoid([cx,cy,cz],[rx,ry,rz],{pitch=0,yaw=0}={}){const f=frame(pitch,yaw),m=Math.max(rx,ry,rz);
 return {bound:[cx,cy,cz,m],d(x,y,z){const [a,b,c]=f(x-cx,y-cy,z-cz),k0=len(a/rx,b/ry,c/rz),k1=len(a/(rx*rx),b/(ry*ry),c/(rz*rz));return k1<1e-9?-Math.min(rx,ry,rz):k0*(k0-1)/k1;}};}
/** Inigo Quilez's exact round cone, optionally squeezed sideways (neck, tail). */
function roundCone(A,B,r1,r2,{squeeze=1}={}){
 const [ax,ay,az]=A,bx=B[0]-ax,by=B[1]-ay,bz=B[2]-az,l2=bx*bx+by*by+bz*bz,rr=r1-r2,a2=l2-rr*rr,il2=1/l2;
 const cx=(A[0]+B[0])/2,cy=(A[1]+B[1])/2,cz=(A[2]+B[2])/2;
 return {bound:[cx,cy,cz,Math.sqrt(l2)/2+Math.max(r1,r2)],d(x,y,z){
  x=ax+(x-ax)/squeeze;const px=x-ax,py=y-ay,pz=z-az,yy=px*bx+py*by+pz*bz,zz=yy-l2;
  const qx=px*l2-bx*yy,qy=py*l2-by*yy,qz=pz*l2-bz*yy,x2=qx*qx+qy*qy+qz*qz,y2=yy*yy*l2,z2=zz*zz*l2,k=Math.sign(rr)*rr*rr*x2;
  let d;if(Math.sign(zz)*a2*z2>k)d=Math.sqrt(x2+z2)*il2-r2;else if(Math.sign(yy)*a2*y2<k)d=Math.sqrt(x2+y2)*il2-r1;else d=(Math.sqrt(x2*a2*il2)+yy*rr)*il2-r1;
  return d*(squeeze<1?squeeze*.5+.5:1);}};}
const sphere=(c,r)=>ellipsoid(c,[r,r,r]);

// ------------------------------------------------------------------ anatomy --
// Regions (baked per vertex): 0 torso, 1 neck, 2 head, 3 jaw, 4 eye, 5 claw, 6 foreleg, 7 hindleg, 8 tail.
const R={torso:0,neck:1,head:2,jaw:3,eye:4,claw:5,fore:6,hind:7,tail:8};
// Centreline from the tail tip to the snout: arclength along it is the spine coordinate.
// The front stands higher than the hips (long forelimbs); the tail is short and carried
// clear of the ground.
const SPINE=[[.7,1.7,-12.8],[.4,2.35,-11.3],[.15,3.15,-9.5],[0,3.9,-7.6],[0,4.45,-5.7],[0,4.7,-3.7],[0,4.9,-1],[0,5.35,1.9],
 [0,6,3.4],[0,7.5,4.4],[0,9.05,5.1],[0,10.6,5.7],[0,12,6.25],[0,12.95,6.75],[0,13.45,7.2],[0,13.62,7.55],[0,13.05,8.75]];
const NECK=SPINE.slice(8,15);

const groups=[];
const group=(region,k,prims,blend)=>groups.push({region,k,prims,blend});
// Torso: pelvis, deep ribcage tilted up at the front, tall withers and a shoulder hump
// at the neck base, so the back slopes down to the hips; clear air under the chest.
group(R.torso,.65,[
 ellipsoid([0,4.7,-2.8],[1.1,1.1,1.5]),
 ellipsoid([0,4.45,-.6],[1.38,1.55,2.25],{pitch:-.06}),
 ellipsoid([0,5,1.5],[1.34,1.9,2.05],{pitch:-.08}),
 ellipsoid([0,6.45,1.55],[.85,1,2.3],{pitch:-.3}),
 ellipsoid([0,5.4,-1.4],[.75,.6,2.2],{pitch:-.2}),
 ellipsoid([0,4.15,2.8],[1.05,1.15,1]),
 ellipsoid([0,3.75,.35],[1.08,.9,1.8]),
 ellipsoid([0,6.75,2.65],[.92,.95,1.15])],0);
// Neck: deep at the base (cervical ribs and throat), funnelling out of the shoulders,
// still heavy near the head, S-curving forward at the top; heavier throat below.
group(R.neck,.35,[...NECK.slice(0,-1).map((a,i)=>roundCone(a,NECK[i+1],[1.55,1.22,.98,.8,.64,.54][i],[1.22,.98,.8,.64,.54,.47][i],{squeeze:i<3?.78:.88})),
 ellipsoid([0,6.4,4.3],[.85,1.2,1.5],{pitch:.95}),ellipsoid([0,8.1,5.02],[.64,.9,1.05],{pitch:.9}),ellipsoid([0,9.8,5.6],[.5,.68,.85],{pitch:.85})],.85);
// Head, built in its own frame: the skull pitches 25 degrees nose-down from the top of
// the neck. a runs forward along the skull, b up across it; S scales the whole skull.
const HO=[0,13.5,7.2],HF=[0,-.42,.91],HU=[0,.91,.42],S=1.2,hp=(x,a,b)=>[x*S+HO[0],HO[1]+(HF[1]*a+HU[1]*b)*S,HO[2]+(HF[2]*a+HU[2]*b)*S],hr=r=>r.map(v=>v*S);
group(R.head,.16,[
 ellipsoid(hp(0,.2,.12),hr([.36,.38,.38])),
 // The tall nasal arch rises above the eyes like a crest.
 ellipsoid(hp(0,.5,.5),hr([.23,.3,.5]),{pitch:-.55}),ellipsoid(hp(0,.28,.4),hr([.27,.3,.3])),
 roundCone(hp(0,.45,.05),hp(0,1.28,-.04),.3*S,.2*S),
 ellipsoid(hp(0,.9,-.14),hr([.27,.15,.36]),{pitch:.45}),
 ellipsoid(hp(.21,.25,-.05),hr([.14,.2,.25])),ellipsoid(hp(-.21,.25,-.05),hr([.14,.2,.25])),
 ellipsoid(hp(.25,.34,.35),hr([.1,.06,.17]),{pitch:-.3}),ellipsoid(hp(-.25,.34,.35),hr([.1,.06,.17]),{pitch:-.3})],.3);
group(R.jaw,.1,[roundCone(hp(0,.15,-.22),hp(0,1.12,-.25),.22*S,.14*S),ellipsoid(hp(0,.6,-.3),hr([.2,.12,.42]),{pitch:.45})],.06);
// Eyes bulge from the sides of the skull under the brow.
group(R.eye,.03,[sphere(hp(.31,.3,.24),.085*S),sphere(hp(-.31,.3,.24),.085*S)],.05);
// Tail: short and heavy for a sauropod, curving a little aside.
group(R.tail,.3,SPINE.slice(0,6).reverse().map((a,i,arr)=>i<arr.length-1?roundCone(a,arr[i+1],[1.35,1.02,.72,.46,.26][i],[1.02,.72,.46,.26,.1][i],{squeeze:.86}):null).filter(Boolean),.85);
// Legs: long columnar forelimbs and massive hindlimbs, with shoulder and thigh muscle
// masses, elbow and knee, padded feet.
for(const s of [-1,1]){
 group(R.fore,.3,[
  ellipsoid([s*1.05,5.75,2.1],[.52,1.25,.95],{pitch:.3}),
  roundCone([s*1.12,5.45,2.45],[s*1.1,3.25,2.25],.7,.5),
  sphere([s*1.1,3.3,2],.42),
  roundCone([s*1.1,3.2,2.3],[s*1.06,1.2,2.5],.47,.35),
  roundCone([s*1.06,1.2,2.5],[s*1.07,.3,2.56],.36,.43),
  ellipsoid([s*1.07,.22,2.58],[.47,.24,.47])],.5);
 group(R.hind,.3,[
  ellipsoid([s*1.05,3.95,-2.5],[.72,1.35,1.1],{pitch:-.1}),
  roundCone([s*1,4.6,-2.6],[s*1.05,2.4,-2.05],.9,.55),
  sphere([s*1.05,2.4,-2.02],.52),
  roundCone([s*1.07,2.35,-2.08],[s*1.05,.85,-2.42],.52,.4),
  ellipsoid([s*1.07,.42,-2.2],[.55,.44,.72])],.55);
 // Short, blunt claws tucked at the front of the feet: one thumb claw, three on each hind foot.
 group(R.claw,.03,[roundCone([s*.8,.42,2.92],[s*.75,.08,3.08],.07,.03),
  ...[0,1,2].map(k=>roundCone([s*(1.07-.2+k*.18),.24,-1.62],[s*(1.07-.21+k*.19),.04,-1.4],.08,.03))],.04);
}
// Nostrils (high on the front of the crest) are too small for the mesh; the shader paints them from the header.
const nostrils=[];

function field(x,y,z,withRegion=false){
 let d=1e9,region=0,best=1e9;
 for(const g of groups){
  let gd=1e9;
  for(const p of g.prims){const [bx,by,bz,br]=p.bound,lb=len(x-bx,y-by,z-bz)-br;if(lb>gd+g.k&&lb>d+g.blend)continue;gd=smin(gd,p.d(x,y,z),g.k);}
  if(gd<1e8){if(withRegion&&gd<best){best=gd;region=g.region;}d=smin(d,gd,g.blend);}
 }
 for(const n of nostrils)d=smax(d,-n.d(x,y,z),.03);
 d=Math.max(d,-y);// flat soles on the ground
 return withRegion?[d,region]:d;
}

// -------------------------------------------------------------- meshing --
function build(VOX,file){
const MIN=[-2.1,0-VOX,-14.4],MAX=[2.1,14.8,9];
const NX=Math.ceil((MAX[0]-MIN[0])/VOX)+1,NY=Math.ceil((MAX[1]-MIN[1])/VOX)+1,NZ=Math.ceil((MAX[2]-MIN[2])/VOX)+1;
const t0=Date.now(),F=new Float32Array(NX*NY*NZ),idx=(i,j,k)=>i+NX*(j+NY*k);
// Coarse pass first; only cells near the surface get the exact field.
const C=4,CX=Math.ceil(NX/C)+1,CY=Math.ceil(NY/C)+1,CZ=Math.ceil(NZ/C)+1,CF=new Float32Array(CX*CY*CZ);
for(let k=0;k<CZ;k++)for(let j=0;j<CY;j++)for(let i=0;i<CX;i++)CF[i+CX*(j+CY*k)]=field(MIN[0]+i*C*VOX,MIN[1]+j*C*VOX,MIN[2]+k*C*VOX);
let exact=0;const band=C*VOX*1.9;
for(let k=0;k<NZ;k++)for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){
 const ci=Math.min(CX-2,Math.floor(i/C)),cj=Math.min(CY-2,Math.floor(j/C)),ck=Math.min(CZ-2,Math.floor(k/C));let near=false,lo=1e9;
 for(let c=0;c<8&&!near;c++){const v=CF[(ci+(c&1))+CX*((cj+(c>>1&1))+CY*(ck+(c>>2&1)))];lo=Math.min(lo,Math.abs(v));if(Math.abs(v)<band)near=true;}
 const x=MIN[0]+i*VOX,y=MIN[1]+j*VOX,z=MIN[2]+k*VOX;
 if(near){F[idx(i,j,k)]=field(x,y,z);exact++;}
 else{const fx=i/C-ci,fy=j/C-cj,fz=k/C-ck,g=(a,b,c)=>CF[(ci+a)+CX*((cj+b)+CY*(ck+c))];
  F[idx(i,j,k)]=((g(0,0,0)*(1-fx)+g(1,0,0)*fx)*(1-fy)+(g(0,1,0)*(1-fx)+g(1,1,0)*fx)*fy)*(1-fz)+((g(0,0,1)*(1-fx)+g(1,0,1)*fx)*(1-fy)+(g(0,1,1)*(1-fx)+g(1,1,1)*fx)*fy)*fz;}
}
// Marching cubes on the negated field (three's tables flag corners below the isovalue).
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
const nV=P.length/3;
// Project onto the true surface and take normals from the field gradient.
const N=new Float32Array(nV*3),h=.012,grad=(x,y,z)=>{const gx=field(x+h,y,z)-field(x-h,y,z),gy=field(x,y+h,z)-field(x,y-h,z),gz=field(x,y,z+h)-field(x,y,z-h),l=len(gx,gy,gz)||1;return [gx/l,gy/l,gz/l];};
for(let v=0;v<nV;v++){let x=P[v*3],y=P[v*3+1],z=P[v*3+2];
 for(let it=0;it<2;it++){const d=field(x,y,z),[gx,gy,gz]=grad(x,y,z);x-=gx*d;y-=gy*d;z-=gz*d;}
 P[v*3]=x;P[v*3+1]=Math.max(0,y);P[v*3+2]=z;const g=grad(x,y,z);N.set(g,v*3);}
// Winding: make faces agree with the outward gradient.
{let agree=0;for(let t=0;t<Math.min(I.length,30000);t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],wx=P[c]-P[a],wy=P[c+1]-P[a+1],wz=P[c+2]-P[a+2];
 agree+=Math.sign((uy*wz-uz*wy)*N[a]+(uz*wx-ux*wz)*N[a+1]+(ux*wy-uy*wx)*N[a+2]);}
 if(agree<0)for(let t=0;t<I.length;t+=3){const s=I[t+1];I[t+1]=I[t+2];I[t+2]=s;}}

// -------------------------------------------------------------- baking --
const withGround=(x,y,z)=>Math.min(field(x,y,z),y);
const AO=new Uint8Array(nV),CAV=new Uint8Array(nV),REG=new Uint8Array(nV),SP=new Uint16Array(nV);
const segs=[],cum=[0];for(let i=0;i<SPINE.length-1;i++){const [a,b]=[SPINE[i],SPINE[i+1]],l=len(b[0]-a[0],b[1]-a[1],b[2]-a[2]);segs.push({a,b,l});cum.push(cum[i]+l);}
function spineCoord(x,y,z,from=0,to=segs.length){let best=1e9,s=0;for(let i=from;i<to;i++){const {a,b,l}=segs[i],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];let t=((x-a[0])*dx+(y-a[1])*dy+(z-a[2])*dz)/(l*l);t=Math.max(0,Math.min(1,t));const d=len(x-a[0]-dx*t,y-a[1]-dy*t,z-a[2]-dz*t);if(d<best){best=d;s=cum[i]+t*l;}}return s;}
const AO_STEPS=[.1,.25,.45,.75,1.1,1.6];
for(let v=0;v<nV;v++){const x=P[v*3],y=P[v*3+1],z=P[v*3+2],nx=N[v*3],ny=N[v*3+1],nz=N[v*3+2];
 let occ=0,wsum=0;AO_STEPS.forEach((s,i)=>{const w=1/(1+i*.6),d=withGround(x+nx*s,y+ny*s,z+nz*s);occ+=w*Math.max(0,Math.min(1,(s-d)/s));wsum+=w;});
 AO[v]=Math.round(255*Math.max(0,1-1.35*occ/wsum));
 const e=.14,lap=(field(x+e,y,z)+field(x-e,y,z)+field(x,y+e,z)+field(x,y-e,z)+field(x,y,z+e)+field(x,y,z-e)-6*field(x,y,z))/(e*e);
 CAV[v]=Math.round(255*Math.max(0,Math.min(1,-lap*.12)));
 const [,region]=field(x,y,z,true);REG[v]=region;
 // Limbs ride the torso: their spine coordinate comes from the torso span only.
 const s=region===R.fore||region===R.hind||region===R.claw&&y<1?spineCoord(x,y,z,5,7):spineCoord(x,y,z);SP[v]=Math.round(s*1000);
}

// -------------------------------------------------------------- output --
const joints=i=>({s:+cum[i].toFixed(3),p:SPINE[i]});
const header={version:1,vertices:nV,indices:I.length,voxel:VOX,
 neck:[9,10,11,12,14].map(joints),tail:[4,3,2,1].map(joints),jaw:{hinge:hp(0,.12,-.12)},head:hp(0,.3,.1),eyes:{centres:[hp(.31,.3,.24),hp(-.31,.3,.24)],radius:.085*S},nostrils:{centres:[hp(.11,.72,.66),hp(-.11,.72,.66)],radius:.06*S},spineLength:+cum[cum.length-1].toFixed(3),
 regions:R};
const idxArr=nV<65536?new Uint16Array(I):new Uint32Array(I);
const Nq=new Int8Array(nV*4);for(let v=0;v<nV;v++){Nq[v*4]=Math.round(N[v*3]*127);Nq[v*4+1]=Math.round(N[v*3+1]*127);Nq[v*4+2]=Math.round(N[v*3+2]*127);}
const aux=new Uint8Array(nV*4);for(let v=0;v<nV;v++){aux[v*4]=AO[v];aux[v*4+1]=CAV[v];aux[v*4+2]=REG[v];}
const parts=[new Float32Array(P),Nq,aux,SP,idxArr];header.layout=['position:f32x3','normal:i8x4','aux:u8x4(ao,cavity,region)','spine:u16(mm)',`index:${idxArr instanceof Uint16Array?'u16':'u32'}`];
let json=Buffer.from(JSON.stringify(header));const pad=(4-(json.length+4)%4)%4;json=Buffer.concat([json,Buffer.alloc(pad,32)]);
const out=[Buffer.from(new Uint32Array([json.length]).buffer),json];for(const a of parts){out.push(Buffer.from(a.buffer,a.byteOffset,a.byteLength));const r=(4-a.byteLength%4)%4;if(r)out.push(Buffer.alloc(r));}
writeFileSync(new URL('../public/models/'+file,import.meta.url),Buffer.concat(out));
console.log(`${file}: ${nV} vertices, ${I.length/3} triangles, ${exact} exact samples of ${F.length}, ${((Date.now()-t0)/1000).toFixed(1)} s, ${(Buffer.concat(out).length/1e6).toFixed(2)} MB`);
}
build(.07,'brachio.bin');
build(.12,'brachio-low.bin');
