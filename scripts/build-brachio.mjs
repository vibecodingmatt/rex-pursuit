// Builds public/models/brachio.bin (and a coarser brachio-low.bin for the Low tier): a Brachiosaurus (Giraffatitan proportions, the
// Jurassic Park look) sculpted as a signed distance field from profile-controlled
// lofts and blended skull volumes, meshed with marching cubes, projected onto the true
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
  const cap=Math.max(z0-z,z-z1);
  return Math.min(Math.max(d,cap),0)+Math.hypot(Math.max(d,0),Math.max(cap,0));}};
}

/** An upright loft, with independently drawn throat/back contours. Unlike a chain
 * of round cones, its width and sagittal depth need not taper at the same rate. */
function uprightLoft(keys,cx=0){
 const Z=curve(keys.map(([y,z])=>[y,z])),D=curve(keys.map(([y,z,d])=>[y,d])),W=curve(keys.map(([y,z,d,w])=>[y,w])),X=curve(keys.map(k=>[k[0],k[4]??cx]));
 const y0=keys[0][0],y1=keys.at(-1)[0];
 const zmid=keys.reduce((sum,k)=>sum+k[1],0)/keys.length;
 return {bound:[cx,(y0+y1)/2,zmid,(y1-y0)/2+3],d(x,y,z){
  const yc=Math.min(y1,Math.max(y0,y)),[zc,dz]=Z(yc),[depth,dd]=D(yc),[width,dw]=W(yc),[xc,dx]=X(yc);
  const a=(x-xc)/width,b=(z-zc)/depth,k0=Math.hypot(a,b),k1=Math.hypot(a/width,b/depth);
  const distance=(k1<1e-9?-Math.min(width,depth):k0*(k0-1)/k1)/Math.sqrt(1+dz*dz+dd*dd+dw*dw+dx*dx);
  // Include the cap distance on BOTH sides of each end. Returning the side field
  // right up to the end plane then switching to the cap outside introduces a jump;
  // smooth unions turn that discontinuity into a visible horizontal ledge.
  const cap=Math.max(y0-y,y-y1);
  return Math.min(Math.max(distance,cap),0)+Math.hypot(Math.max(distance,0),Math.max(cap,0));
 }};
}

// ------------------------------------------------------------------ anatomy --
// Regions (baked per vertex): 0 torso, 1 neck, 2 head, 3 jaw, 4 eye, 5 claw, 6 foreleg, 7 hindleg, 8 tail.
const R={torso:0,neck:1,head:2,jaw:3,eye:4,claw:5,fore:6,hind:7,tail:8};
// Matched to the Jurassic World brachiosaur (user reference, art/review/drop6/ref-jw-brachio.png).
// About 14.6 m to the crown, withers 6.6 m, belly 2.4 m. The compact ribcage stays
// deep through the hips, then drops into a low, short tail with a gentle upturn.
// The neck sweeps forward from the shoulders and keeps its depth high up; a conical
// taper made it read as a spire. Continuous leg profiles avoid swollen ball joints.
//
// Centreline from the tail tip to the snout: arclength along it is the spine coordinate.
const TAIL=[[0,2.65,-7.1],[0,3,-6.4],[0,3.15,-5.5],[0,3.05,-4.5],[0,3.1,-3.7],[0,3.7,-2.8]];
const TORSO=[[0,4,-1.5],[0,4.3,0],[0,4.55,1.8]];
const NECK=[[0,5.1,2.55],[0,6.8,3.35],[0,8.5,4.35],[0,10.1,4.95],[0,11.6,5.2],[0,12.8,5.4],[0,13.6,5.7],[0,14,6.05]];
// Head, built in its own frame: the skull pitches about 10 degrees nose-down from the top of
// the neck. a runs forward along the skull, b up across it; S scales the whole skull.
const HO=[0,13.98,6.05],HF=[0,-.17,.985],HU=[0,.985,.17],S=1,hp=(x,a,b)=>[x*S+HO[0],HO[1]+(HF[1]*a+HU[1]*b)*S,HO[2]+(HF[2]*a+HU[2]*b)*S],hr=r=>r.map(v=>v*S);
const SPINE=[...TAIL,...TORSO,...NECK,hp(0,.98,-.01)];
const IDX={neck:[10,11,12,14,16],tail:[4,3,2,1],torso:[5,9]};

const groups=[];
const group=(region,k,prims,blend)=>groups.push({region,k,prims,blend});
// Torso and tail: one lofted body. Keys run tail tip (z -7.2) to chest front (z 3.3).
group(({2:z})=>z<-3.3?R.tail:R.torso,0,[loft({
 top:[[-7.2,2.65],[-6.4,3.11],[-5.5,3.34],[-4.5,3.33],[-3.7,3.57],[-3.1,4.25],[-2.4,4.95],[-1.6,5.65],[-.8,6.08],[.3,6.43],[1.4,6.62],[2.15,6.48],[2.8,6.05],[3.1,5.42],[3.3,4.95]],
 bottom:[[-7.2,2.61],[-6.4,2.91],[-5.5,2.98],[-4.5,2.78],[-3.7,2.68],[-3.1,2.7],[-2.4,2.65],[-1.6,2.55],[-.8,2.38],[.3,2.4],[1.4,2.65],[2.15,2.98],[2.8,3.48],[3.1,4.1],[3.3,4.7]],
 width:[[-7.2,.025],[-6.4,.09],[-5.5,.17],[-4.5,.3],[-3.7,.51],[-3.1,.8],[-2.4,1.2],[-1.6,1.5],[-.8,1.65],[.3,1.67],[1.4,1.56],[2.15,1.35],[2.8,1.05],[3.1,.65],[3.3,.12]]})],0);
// Neck: one uninterrupted swept form. Its depth and width taper independently;
// its lower end is buried in the chest so a flat loft cap cannot show on the throat.
group(R.neck,0,[uprightLoft([
 // y, centre z, sagittal half-depth, transverse half-width.
 [3,1.8,.5,.55],[4,2.05,.95,.85],[4.8,2.3,1.14,.95],
 [5.5,2.65,1.23,.92],[6.5,3.18,1.18,.78],
 [7.5,3.82,.96,.64],[8.5,4.35,.77,.55],[9.5,4.78,.64,.48],
 [10.5,5.04,.57,.44],[11.5,5.2,.52,.41],[12.5,5.34,.49,.38],
 [13.2,5.49,.46,.36],[13.7,5.78,.4,.34],[14.1,6.08,.27,.29]
])],.65);
group(R.head,.16,[
 ellipsoid(hp(0,.2,.12),hr([.39,.4,.44])),
 // The tall nasal arch rises above the eyes like a crest.
 ellipsoid(hp(0,.48,.4),hr([.31,.29,.4]),{pitch:-.2}),ellipsoid(hp(0,.28,.35),hr([.32,.3,.34])),
 roundCone(hp(0,.45,.05),hp(0,.98,-.01),.33*S,.25*S),
 ellipsoid(hp(0,.83,-.1),hr([.31,.18,.32]),{pitch:.17}),
 ellipsoid(hp(.21,.25,-.05),hr([.14,.2,.25])),ellipsoid(hp(-.21,.25,-.05),hr([.14,.2,.25])),
 ellipsoid(hp(.25,.34,.35),hr([.1,.06,.17]),{pitch:-.3}),ellipsoid(hp(-.25,.34,.35),hr([.1,.06,.17]),{pitch:-.3})],.3);
group(R.jaw,.1,[roundCone(hp(0,.15,-.22),hp(0,.96,-.25),.23*S,.16*S),ellipsoid(hp(0,.57,-.3),hr([.23,.12,.36]),{pitch:.17})],.06);
// Eyes bulge from the sides of the skull under the brow.
group(R.eye,.03,[sphere(hp(.31,.3,.24),.085*S),sphere(hp(-.31,.3,.24),.085*S)],.05);
// Legs: weight-bearing columns with shoulder/thigh mass kept below the back line.
// The far forefoot rests slightly back and the far hindfoot forward, as in the
// reference, rather than all four feet standing in identical parallel pairs.
for(const s of [-1,1]){
 // Continuous columns: elbow/knee transitions are drawn into the profile, not
 // unions of spherical joints. The top caps are buried inside the ribcage.
 group(R.fore,0,[uprightLoft([
  [-.1,2.34,.37,.35],[.12,2.34,.49,.45],[.36,2.3,.47,.43],
  [.8,2.23,.37,.35],[1.35,2.1,.37,.34],[2,1.96,.41,.38],
  [2.6,1.89,.46,.42],[3.25,1.89,.53,.47],[4,1.92,.68,.54],
  [4.7,1.89,.8,.59],[5.3,1.72,.67,.51,s*.9],[5.85,1.55,.3,.22,s*.55]
 ].map(k=>[k[0],k[1]-(s<0?.42*Math.max(0,1-k[0]/3.8):0),...k.slice(2)]),s*1.1)],.42);
 group(R.hind,0,[uprightLoft([
  [-.1,-1.66,.43,.35],[.13,-1.66,.59,.44],[.35,-1.7,.54,.42],
  [.7,-1.84,.35,.34],[1.15,-1.8,.36,.35],[1.7,-1.64,.41,.39],
  [2.2,-1.46,.46,.43],[2.85,-1.57,.57,.51],[3.6,-1.82,.77,.65],
  [4.25,-1.8,.78,.65],[4.8,-1.65,.62,.47,s*.8],[5.3,-1.45,.28,.25,s*.5]
 ].map(k=>[k[0],k[1]+.15+(s<0?.9*Math.max(0,1-k[0]/3.8):0),...k.slice(2)]),s*1.12)],.44);
 // Short, blunt claws tucked at the front of the feet: one thumb claw, three on each hind foot.
 const foreStep=s<0?-.4:0,hindStep=.15+(s<0?.88:0);
 group(R.claw,.03,[roundCone([s*.8,.3,2.62+foreStep],[s*.75,.07,2.8+foreStep],.08,.035),
  ...[0,1,2].map(k=>roundCone([s*(1.14-.22+k*.19),.2,-1.13+hindStep],[s*(1.14-.23+k*.2),.045,-.98+hindStep],.085,.035))],.04);
}
// Nostrils (high on the front of the crest) are too small for the mesh; the shader paints them from the header.
const nostrils=[];

function field(x,y,z,withRegion=false){
 let d=1e9,region=0,best=1e9,limb=1e9,body=1e9;
 for(const g of groups){
  let gd=1e9;
  for(const p of g.prims){const [bx,by,bz,br]=p.bound,lb=len(x-bx,y-by,z-bz)-br;if(lb>gd+g.k&&lb>d+g.blend)continue;gd=smin(gd,p.d(x,y,z),g.k);}
  if(gd<1e8){if(withRegion){
   if(gd<best){best=gd;region=typeof g.region==='function'?g.region([x,y,z]):g.region;}
   if(g.region===R.fore||g.region===R.hind)limb=Math.min(limb,gd);else body=Math.min(body,gd);
  }d=smin(d,gd,g.blend);}
 }
 for(const n of nostrils)d=smax(d,-n.d(x,y,z),.03);
 d=Math.max(d,-y);// flat soles on the ground
 const w=Math.max(0,Math.min(1,.5+(body-limb)/1.2));
 return withRegion?[d,region,w*w*(3-2*w)]:d;
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
const AO=new Uint8Array(nV),CAV=new Uint8Array(nV),REG=new Uint8Array(nV),LIMB=new Uint8Array(nV),SP=new Uint16Array(nV);
const segs=[],cum=[0];for(let i=0;i<SPINE.length-1;i++){const [a,b]=[SPINE[i],SPINE[i+1]],l=len(b[0]-a[0],b[1]-a[1],b[2]-a[2]);segs.push({a,b,l});cum.push(cum[i]+l);}
function spineCoord(x,y,z,from=0,to=segs.length){let best=1e9,s=0;for(let i=from;i<to;i++){const {a,b,l}=segs[i],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];let t=((x-a[0])*dx+(y-a[1])*dy+(z-a[2])*dz)/(l*l);t=Math.max(0,Math.min(1,t));const d=len(x-a[0]-dx*t,y-a[1]-dy*t,z-a[2]-dz*t);if(d<best){best=d;s=cum[i]+t*l;}}return s;}
const AO_STEPS=[.1,.25,.45,.75,1.1,1.6];
for(let v=0;v<nV;v++){const x=P[v*3],y=P[v*3+1],z=P[v*3+2],nx=N[v*3],ny=N[v*3+1],nz=N[v*3+2];
 let occ=0,wsum=0;AO_STEPS.forEach((s,i)=>{const w=1/(1+i*.6),d=withGround(x+nx*s,y+ny*s,z+nz*s);occ+=w*Math.max(0,Math.min(1,(s-d)/s));wsum+=w;});
 AO[v]=Math.round(255*Math.max(0,1-1.35*occ/wsum));
 const e=.14,lap=(field(x+e,y,z)+field(x-e,y,z)+field(x,y+e,z)+field(x,y-e,z)+field(x,y,z+e)+field(x,y,z-e)-6*field(x,y,z))/(e*e);
 CAV[v]=Math.round(255*Math.max(0,Math.min(1,-lap*.12)));
 const [,region,limbWeight]=field(x,y,z,true);REG[v]=region;LIMB[v]=Math.round(limbWeight*255);
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
const aux=new Uint8Array(nV*4);for(let v=0;v<nV;v++){aux[v*4]=AO[v];aux[v*4+1]=CAV[v];aux[v*4+2]=REG[v];aux[v*4+3]=LIMB[v];}
const parts=[new Float32Array(P),Nq,aux,SP,idxArr];header.layout=['position:f32x3','normal:i8x4','aux:u8x4(ao,cavity,region,limb)','spine:u16(mm)',`index:${idxArr instanceof Uint16Array?'u16':'u32'}`];
let json=Buffer.from(JSON.stringify(header));const pad=(4-(json.length+4)%4)%4;json=Buffer.concat([json,Buffer.alloc(pad,32)]);
const out=[Buffer.from(new Uint32Array([json.length]).buffer),json];for(const a of parts){out.push(Buffer.from(a.buffer,a.byteOffset,a.byteLength));const r=(4-a.byteLength%4)%4;if(r)out.push(Buffer.alloc(r));}
writeFileSync(new URL('../public/models/'+file,import.meta.url),Buffer.concat(out));
console.log(`${file}: ${nV} vertices, ${I.length/3} triangles, ${exact} exact samples of ${F.length}, ${((Date.now()-t0)/1000).toFixed(1)} s, ${(Buffer.concat(out).length/1e6).toFixed(2)} MB`);
}
build(.07,'brachio.bin');
build(.12,'brachio-low.bin');
