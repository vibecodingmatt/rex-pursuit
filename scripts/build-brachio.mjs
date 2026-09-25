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
/** Monotone cubic (Fritsch-Carlson) through [z, value] keys: smooth, never overshoots. Returns [value, slope]. */
function curve(keys){
 const n=keys.length,X=keys.map(k=>k[0]),Y=keys.map(k=>k[1]),D=[],M=[];
 for(let i=0;i<n-1;i++)D[i]=(Y[i+1]-Y[i])/(X[i+1]-X[i]);
 M[0]=D[0];M[n-1]=D[n-2];for(let i=1;i<n-1;i++)M[i]=D[i-1]*D[i]<=0?0:(D[i-1]+D[i])/2;
 for(let i=0;i<n-1;i++){if(D[i]===0){M[i]=M[i+1]=0;continue;}const a=M[i]/D[i],b=M[i+1]/D[i],q=a*a+b*b;if(q>9){const t=3/Math.sqrt(q);M[i]=t*a*D[i];M[i+1]=t*b*D[i];}}
 return z=>{let i=0;while(i<n-2&&z>X[i+1])i++;const h=X[i+1]-X[i],t=(z-X[i])/h,t2=t*t,t3=t2*t;
  return [(2*t3-3*t2+1)*Y[i]+(t3-2*t2+t)*h*M[i]+(-2*t3+3*t2)*Y[i+1]+(t3-t2)*h*M[i+1],((6*t2-6*t)*Y[i]+(3*t2-4*t+1)*h*M[i]+(-6*t2+6*t)*Y[i+1]+(3*t2-2*t)*h*M[i+1])/h];};
}
/** A body lofted along z from explicit side and top profiles: the dorsal line, the ventral
 *  line and the half-width, each a smooth curve through keys. The cross-section is an
 *  ellipse that narrows toward the spine (a ribcage is broader low down). */
function loft({top,bottom,width}){
 const T=curve(top),B=curve(bottom),W=curve(width),z0=top[0][0],z1=top[top.length-1][0];
 return {bound:[0,4.2,(z0+z1)/2,(z1-z0)/2+2.5],d(x,y,z){
  const zc=Math.min(z1,Math.max(z0,z)),[t,dt]=T(zc),[b,db]=B(zc),[w,dw]=W(zc),yc=(t+b)/2,ry=Math.max(.02,(t-b)/2);
  const u=Math.max(0,Math.min(1,(y-yc)/ry)),rx=Math.max(.02,w*(1-.22*u*u)),Y=y-yc;
  const k0=len(x/rx,Y/ry,0),k1=len(x/(rx*rx),Y/(ry*ry),0);let d=k1<1e-9?-Math.min(rx,ry):k0*(k0-1)/k1;
  d/=Math.sqrt(1+Math.max(dt*dt,db*db,dw*dw)*.5);
  return z===zc?d:d>0?Math.hypot(d,z-zc):Math.max(d,Math.abs(z-zc));}};
}

// ------------------------------------------------------------------ anatomy --
// Regions (baked per vertex): 0 torso, 1 neck, 2 head, 3 jaw, 4 eye, 5 claw, 6 foreleg, 7 hindleg, 8 tail.
const R={torso:0,neck:1,head:2,jaw:3,eye:4,claw:5,fore:6,hind:7,tail:8};
// Matched to the Jurassic World brachiosaur (user reference, art/review/drop6/ref-jw-brachio.png).
// Heights for a 14.9 m head: withers 6.35 m, belly 2.25 m, hips 5 m, tail tip about 2.1 m.
// The body is short, deep and pear-shaped with a great rounded chest under the neck;
// the neck is massive at the base and rises almost vertically; the forelegs are long
// columns, the hind legs shorter under big thighs; the tail is short and thick at the
// root, runs out nearly level, lifting a little, then droops to the tip.
//
// Centreline from the tail tip to the snout: arclength along it is the spine coordinate.
const TAIL=[[0,2.14,-11.7],[0,2.55,-10.8],[0,3.22,-9.5],[0,3.88,-8],[0,4.12,-6.5],[0,4.08,-3.6]];
const TORSO=[[0,4.05,-2],[0,4,0],[0,4.35,2]];
const NECK=[[0,5.2,3.3],[0,6.9,3.95],[0,8.5,4.4],[0,10.1,4.7],[0,11.6,4.95],[0,12.8,5.2],[0,13.6,5.5],[0,14,5.9]];
// Head, built in its own frame: the skull pitches 25 degrees nose-down from the top of
// the neck. a runs forward along the skull, b up across it; S scales the whole skull.
const HO=[0,13.98,5.95],HF=[0,-.17,.985],HU=[0,.985,.17],S=.95,hp=(x,a,b)=>[x*S+HO[0],HO[1]+(HF[1]*a+HU[1]*b)*S,HO[2]+(HF[2]*a+HU[2]*b)*S],hr=r=>r.map(v=>v*S);
const SPINE=[...TAIL,...TORSO,...NECK,hp(0,1.28,-.04)];
const IDX={neck:[10,11,12,14,16],tail:[4,3,2,1],torso:[5,9]};

const groups=[];
const group=(region,k,prims,blend)=>groups.push({region,k,prims,blend});
// Torso and tail: one lofted body. Keys run tail tip (z -11.8) to chest front (z 4.3).
group(({2:z})=>z<-3.3?R.tail:R.torso,0,[loft({
 top:[[-11.9,2.18],[-10.8,2.72],[-9.5,3.45],[-8,4.22],[-6.5,4.6],[-5,4.72],[-3.6,4.8],[-2.8,4.95],[-2,5.12],[-1,5.4],[0,5.72],[1,6.02],[2,6.28],[2.8,6.35],[3.6,6.1],[4.3,5.65],[4.75,5.15],[4.95,4.75]],
 bottom:[[-11.9,2.06],[-10.8,2.38],[-9.5,3],[-8,3.5],[-6.5,3.62],[-5,3.42],[-3.6,3.35],[-2.8,3.2],[-2,2.85],[-1,2.45],[0,2.25],[1,2.3],[2,2.42],[3,2.55],[3.7,2.8],[4.3,3.3],[4.75,4.05],[4.95,4.6]],
 width:[[-11.9,.04],[-10.8,.12],[-9.5,.23],[-8,.36],[-6.5,.52],[-5,.7],[-3.6,.88],[-2.8,1.25],[-2,1.5],[-1,1.62],[0,1.66],[1,1.66],[2,1.7],[2.8,1.68],[3.6,1.5],[4.3,1.18],[4.75,.72],[4.95,.2]]})],0);
// Neck: massive where it leaves the chest, tapering steadily; taller than wide. The
// segments meet cleanly, so they join with almost no blend (a soft blend rings each joint).
group(R.neck,.02,NECK.slice(0,-1).map((a,i)=>roundCone(a,NECK[i+1],[1.55,.98,.66,.46,.36,.31,.28][i],[.98,.66,.46,.36,.31,.28,.26][i],{squeeze:[.72,.76,.8,.84,.87,.9,.92][i]})),1.1);
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
// Legs: straight columns. A big shoulder and upper-arm mass sits on the side of the
// chest and a big thigh on the flank, both below the back line.
for(const s of [-1,1]){
 group(R.fore,.3,[
  // Shoulder and upper-arm muscle, heavy on the side of the chest.
  ellipsoid([s*1.3,4.55,2.5],[.66,1.35,1.12],{pitch:.25}),
  roundCone([s*1.24,4.4,2.55],[s*1.15,2.3,2.35],.8,.58),
  sphere([s*1.15,2.3,2.3],.5),
  roundCone([s*1.15,2.25,2.35],[s*1.12,.95,2.45],.52,.45),
  roundCone([s*1.12,.95,2.45],[s*1.13,.25,2.5],.45,.52),
  ellipsoid([s*1.13,.22,2.52],[.57,.24,.57])],.45);
 group(R.hind,.3,[
  ellipsoid([s*1.12,3.5,-2.35],[.72,1.15,1.15],{pitch:-.1}),
  roundCone([s*1.08,3.95,-2.4],[s*1.12,1.95,-2],.85,.6),
  sphere([s*1.13,1.95,-1.95],.56),
  roundCone([s*1.13,1.9,-2],[s*1.13,.75,-2.35],.56,.47),
  ellipsoid([s*1.14,.4,-2.15],[.6,.42,.8])],.45);
 // Short, blunt claws tucked at the front of the feet: one thumb claw, three on each hind foot.
 group(R.claw,.03,[roundCone([s*.82,.42,2.95],[s*.77,.08,3.12],.08,.035),
  ...[0,1,2].map(k=>roundCone([s*(1.14-.24+k*.2),.26,-1.48],[s*(1.14-.25+k*.21),.04,-1.25],.09,.035))],.04);
}
// Nostrils (high on the front of the crest) are too small for the mesh; the shader paints them from the header.
const nostrils=[];

function field(x,y,z,withRegion=false){
 let d=1e9,region=0,best=1e9;
 for(const g of groups){
  let gd=1e9;
  for(const p of g.prims){const [bx,by,bz,br]=p.bound,lb=len(x-bx,y-by,z-bz)-br;if(lb>gd+g.k&&lb>d+g.blend)continue;gd=smin(gd,p.d(x,y,z),g.k);}
  if(gd<1e8){if(withRegion&&gd<best){best=gd;region=typeof g.region==='function'?g.region([x,y,z]):g.region;}d=smin(d,gd,g.blend);}
 }
 for(const n of nostrils)d=smax(d,-n.d(x,y,z),.03);
 d=Math.max(d,-y);// flat soles on the ground
 return withRegion?[d,region]:d;
}

// -------------------------------------------------------------- meshing --
function build(VOX,file){
const MIN=[-2.3,0-VOX,-12.4],MAX=[2.3,15.6,8.2];
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
 const s=region===R.fore||region===R.hind||region===R.claw&&y<1?spineCoord(x,y,z,IDX.torso[0],IDX.torso[1]):spineCoord(x,y,z);SP[v]=Math.round(s*1000);
}

// -------------------------------------------------------------- output --
const joints=i=>({s:+cum[i].toFixed(3),p:SPINE[i]});
const header={version:1,vertices:nV,indices:I.length,voxel:VOX,
 neck:IDX.neck.map(joints),tail:IDX.tail.map(joints),jaw:{hinge:hp(0,.12,-.12)},head:hp(0,.3,.1),eyes:{centres:[hp(.31,.3,.24),hp(-.31,.3,.24)],radius:.085*S},nostrils:{centres:[hp(.11,.72,.66),hp(-.11,.72,.66)],radius:.06*S},spineLength:+cum[cum.length-1].toFixed(3),
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
