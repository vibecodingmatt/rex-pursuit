// Original Safari sculpts, baked offline so meshing never costs a game frame.
// SDF loft kit and mesher follow build-brachio.mjs; units share the critter rig
// (bipeds have hips at about 0.31; the game scales each instance to life size).
//
// Seven species, two geometry budgets each, in one compact file (format 2):
// positions are quantized to 16 bits inside each model's bounds, normals and
// colours are bytes, the rig is four bytes (part, weight, pivot index), and the
// pivots the rig turns about live in a small per-model table. The loader expands
// them to the float attributes the critter shader reads. The two spare bytes carry
// the hide: colour alpha is the fine-scale amount, the normal's fourth byte is gloss
// (positive: eyes, horn, beak, hoof) or large tubercles (negative).
//
// Heads are authored in their own frame (origin at the neck joint, z along the skull)
// and placed with a pitch, so a posture change never distorts the anatomy. Sockets,
// nostrils and grooves are carved; frills, crests and plates are thin curved sheets.
import {writeFileSync} from 'node:fs';
import {edgeTable,triTable} from 'three/addons/objects/MarchingCubes.js';
const len=(x,y,z)=>Math.sqrt(x*x+y*y+z*z);
// The voxel size being meshed: thin sheets never get thinner than it, or the coarse tier breaks them up.
let VOX=.0064;
function smin(a,b,k){if(k<=0)return Math.min(a,b);const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
const smax=(a,b,k)=>-smin(-a,-b,k);
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
/** A horn or crest tube through points with radii: a chain of round cones. */
const chain=(pts,{squeeze=1}={})=>pts.slice(1).map(([p,r],i)=>roundCone(pts[i][0],p,pts[i][1],r,{squeeze}));
/** Rigid placement of primitives authored in a local frame: roll about local z, then pitch
 *  (positive: nose down), then yaw, a uniform scale, about origin `o`. */
function placer({o=[0,0,0],pitch=0,yaw=0,roll=0,scale=1}={}){
 const f=frame(pitch,yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cy=Math.cos(yaw),sy=Math.sin(yaw),cr=Math.cos(roll),sr=Math.sin(roll);
 const local=(x,y,z)=>{const [a,b,c]=f(x-o[0],y-o[1],z-o[2]);return [(cr*a+sr*b)/scale,(-sr*a+cr*b)/scale,c/scale];};
 const toWorld=([u,v,w])=>{u*=scale;v*=scale;w*=scale;const a=cr*u-sr*v,b=sr*u+cr*v,y1=cp*b-sp*w,z1=sp*b+cp*w;return [o[0]+cy*a+sy*z1,o[1]+y1,o[2]-sy*a+cy*z1];};
 const wrap=p=>({bound:[...toWorld(p.bound.slice(0,3)),p.bound[3]*scale],d:(x,y,z)=>p.d(...local(x,y,z))*scale});
 return {wrap,all:ps=>ps.map(wrap),toWorld,local:p=>local(...p)};
}
/** Inigo Quilez's rhombus, extruded to a rounded plate: length L and height H (half extents), half thickness t.
 *  `leaf` blends the rhombus toward an ellipse of the same extents (a rounded, leaf-like outline). */
function plate([cx,cy,cz],L,H,t,{pitch=0,yaw=0,round=.004,leaf=0}={}){const f=frame(pitch,yaw);
 return {bound:[cx,cy,cz,Math.max(L,H)+t+round],d(x,y,z){const [a,b,c]=f(x-cx,y-cy,z-cz),px=Math.abs(c),py=Math.abs(b),bx=L,by=H;
  const h=Math.max(-1,Math.min(1,((bx-2*px)*bx-(by-2*py)*by)/(bx*bx+by*by))),qx=px-.5*bx*(1-h),qy=py-.5*by*(1+h);
  let d2=Math.hypot(qx,qy)*Math.sign(px*by+py*bx-bx*by);
  if(leaf){const ea=c/L,eb=b/H,k0=Math.hypot(ea,eb),k1=Math.hypot(ea/L,eb/H);d2=d2*(1-leaf)+(k1<1e-9?-Math.min(L,H):k0*(k0-1)/k1)*leaf;}
  const w=Math.abs(a)-Math.max(VOX*.6,t*(1-.55*Math.min(1,Math.max(0,py/H))));
  return Math.min(Math.max(d2,w),0)+Math.hypot(Math.max(d2,0),Math.max(w,0))-round;}};}
/** A 2D ellipse distance in a sheet's x-z plane. */
const ellipse2=(cx,cz,A,B)=>(x,z)=>{const a=(x-cx)/A,b=(z-cz)/B,k0=Math.hypot(a,b),k1=Math.hypot(a/A,b/B);return k1<1e-9?-Math.min(A,B):k0*(k0-1)/k1;};
/** A thin curved sheet in its local x-z plane (y through its thickness): an outline (signed 2D
 *  distance), a half-thickness and a bend along y, all functions of (x, z); rounded rim. */
function sheet(outline,half,bend,[cx,cz,r],round=.002){
 return {bound:[cx,0,cz,r],d(x,y,z){const h=1e-3,gx=(bend(x+h,z)-bend(x-h,z))/(2*h),gz=(bend(x,z+h)-bend(x,z-h))/(2*h);
  const e=outline(x,z)+round,w=(Math.abs(y-bend(x,z))-Math.max(VOX*.6,half(x,z)))/Math.sqrt(1+gx*gx+gz*gz)+round;
  return Math.min(Math.max(e,w),0)+Math.hypot(Math.max(e,0),Math.max(w,0))-round;}};
}
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
 *  line and the half-width, each a smooth curve through [z, top, bottom, half-width] keys.
 *  The cross-section is an ellipse that narrows toward the spine (a ribcage is broader low down). */
function loft(keys){
 const T=curve(keys.map(k=>[k[0],k[1]])),B=curve(keys.map(k=>[k[0],k[2]])),W=curve(keys.map(k=>[k[0],k[3]])),z0=keys[0][0],z1=keys.at(-1)[0];
 const ys=keys.flatMap(k=>[k[1],k[2]]),y0=Math.min(...ys),y1=Math.max(...ys),w=Math.max(...keys.map(k=>k[3]));
 return {top:z=>T(Math.min(z1,Math.max(z0,z)))[0],bottom:z=>B(Math.min(z1,Math.max(z0,z)))[0],bound:[0,(y0+y1)/2,(z0+z1)/2,Math.hypot((z1-z0)/2,(y1-y0)/2,w)+.01],d(x,y,z){
  const zc=Math.min(z1,Math.max(z0,z)),[t,dt]=T(zc),[b,db]=B(zc),[w,dw]=W(zc),yc=(t+b)/2,ry=Math.max(.0008,(t-b)/2);
  const u=Math.max(0,Math.min(1,(y-yc)/ry)),rx=Math.max(.0008,w*(1-.22*u*u)),Y=y-yc;
  const k0=len(x/rx,Y/ry,0),k1=len(x/(rx*rx),Y/(ry*ry),0);let d=k1<1e-9?-Math.min(rx,ry):k0*(k0-1)/k1;
  d/=Math.sqrt(1+Math.max(dt*dt,db*db,dw*dw)*.5);
  const cap=Math.max(z0-z,z-z1);
  return Math.min(Math.max(d,cap),0)+Math.hypot(Math.max(d,0),Math.max(cap,0));}};
}
/** An upright loft through [y, z, depth, half-width, x] keys: a limb or a raised neck whose
 *  width and sagittal depth need not taper at the same rate. */
function uprightLoft(keys){
 const Z=curve(keys.map(([y,z])=>[y,z])),D=curve(keys.map(([y,z,d])=>[y,d])),W=curve(keys.map(([y,z,d,w])=>[y,w])),X=curve(keys.map(k=>[k[0],k[4]??0]));
 const y0=keys[0][0],y1=keys.at(-1)[0],zmid=keys.reduce((sum,k)=>sum+k[1],0)/keys.length,xmid=keys.reduce((sum,k)=>sum+(k[4]??0),0)/keys.length;
 return {bound:[xmid,(y0+y1)/2,zmid,(y1-y0)/2+.25],d(x,y,z){
  const yc=Math.min(y1,Math.max(y0,y)),[zc,dz]=Z(yc),[depth,dd]=D(yc),[width,dw]=W(yc),[xc,dx]=X(yc);
  const a=(x-xc)/width,b=(z-zc)/depth,k0=Math.hypot(a,b),k1=Math.hypot(a/width,b/depth);
  const distance=(k1<1e-9?-Math.min(width,depth):k0*(k0-1)/k1)/Math.sqrt(1+dz*dz+dd*dd+dw*dw+dx*dx);
  // Include the cap distance on BOTH sides of each end; a jump there becomes a ledge in smooth unions.
  const cap=Math.max(y0-y,y-y1);
  return Math.min(Math.max(distance,cap),0)+Math.hypot(Math.max(distance,0),Math.max(cap,0));
 }};
}

function mesh(field,VOX,[MIN,MAX]){
 const NX=Math.ceil((MAX[0]-MIN[0])/VOX)+1,NY=Math.ceil((MAX[1]-MIN[1])/VOX)+1,NZ=Math.ceil((MAX[2]-MIN[2])/VOX)+1;
 const F=new Float32Array(NX*NY*NZ),idx=(i,j,k)=>i+NX*(j+NY*k);
 // Coarse pass first; only cells near the surface get the exact field.
 const C=4,CX=Math.ceil(NX/C)+1,CY=Math.ceil(NY/C)+1,CZ=Math.ceil(NZ/C)+1,CF=new Float32Array(CX*CY*CZ);
 for(let k=0;k<CZ;k++)for(let j=0;j<CY;j++)for(let i=0;i<CX;i++)CF[i+CX*(j+CY*k)]=field(MIN[0]+i*C*VOX,MIN[1]+j*C*VOX,MIN[2]+k*C*VOX);
 const band=C*VOX*1.9;
 for(let k=0;k<NZ;k++)for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){
  const ci=Math.min(CX-2,Math.floor(i/C)),cj=Math.min(CY-2,Math.floor(j/C)),ck=Math.min(CZ-2,Math.floor(k/C));let near=false;
  for(let c=0;c<8&&!near;c++){const v=CF[(ci+(c&1))+CX*((cj+(c>>1&1))+CY*(ck+(c>>2&1)))];if(Math.abs(v)<band)near=true;}
  const x=MIN[0]+i*VOX,y=MIN[1]+j*VOX,z=MIN[2]+k*VOX;
  if(near)F[idx(i,j,k)]=field(x,y,z);
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
 const N=new Float32Array(nV*3),h=.0008,grad=(x,y,z)=>{const gx=field(x+h,y,z)-field(x-h,y,z),gy=field(x,y+h,z)-field(x,y-h,z),gz=field(x,y,z+h)-field(x,y,z-h),l=len(gx,gy,gz)||1;return [gx/l,gy/l,gz/l];};
 for(let v=0;v<nV;v++){let x=P[v*3],y=P[v*3+1],z=P[v*3+2];
  for(let it=0;it<2;it++){const d=field(x,y,z),[gx,gy,gz]=grad(x,y,z);x-=gx*d;y-=gy*d;z-=gz*d;}
  P[v*3]=x;P[v*3+1]=Math.max(0,y);P[v*3+2]=z;const g=grad(x,y,z);N.set(g,v*3);}
 // Winding: make faces agree with the outward gradient.
 {let agree=0;for(let t=0;t<Math.min(I.length,30000);t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],wx=P[c]-P[a],wy=P[c+1]-P[a+1],wz=P[c+2]-P[a+2];
  agree+=Math.sign((uy*wz-uz*wy)*N[a]+(uz*wx-ux*wz)*N[a+1]+(ux*wy-uy*wx)*N[a+2]);}
  if(agree<0)for(let t=0;t<I.length;t+=3){const s=I[t+1];I[t+1]=I[t+2];I[t+2]=s;}}
 return {positions:P,normals:N,indices:I};
}
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const clamp01=v=>Math.max(0,Math.min(1,v));
// Value noise for mottling (baked, so any cost is offline).
const hash3=(x,y,z)=>{const h=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return h-Math.floor(h);};
function vnoise(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z),fx=x-X,fy=y-Y,fz=z-Z,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=fz*fz*(3-2*fz),c=(i,j,k)=>hash3(X+i,Y+j,Z+k);
 return ((c(0,0,0)*(1-u)+c(1,0,0)*u)*(1-v)+(c(0,1,0)*(1-u)+c(1,1,0)*u)*v)*(1-w)+((c(0,0,1)*(1-u)+c(1,0,1)*u)*(1-v)+(c(0,1,1)*(1-u)+c(1,1,1)*u)*v)*w;}
const fbm=(x,y,z)=>vnoise(x,y,z)*.55+vnoise(x*2.13+5.2,y*2.13,z*2.13)*.3+vnoise(x*4.37,y*4.37+1.7,z*4.37)*.15;

// ------------------------------------------------------------------ anatomy --
// Each species adds named groups of primitives. A group can carry `leg` (the pivot it
// swings about, its side and lead: +1 hind, -1 fore); arm joints use the same
// metadata with `arm:true`. The rig follows it. Carves
// subtract (sockets, nostrils, grooves) after every group is joined.
const HEADISH=new Set(['head','jaw','beak','horn','frill','displayFrill','epoc','eye','lid','crest','dome','knob','neck','brow','ossicle']);
const KERATIN=new Set(['horn','beak','hoof','claw','nail','spike']);
function sculpt(){
 const groups=[],carves=[];
 const add=(region,prims,blend=.016,internal=.008,leg=null)=>{
  groups.push({region,prims,blend,internal,leg});
  if(region==='eye'){
   // A fleshy elliptical lid occludes the globe's upper/lower edges. Both
   // globe and lid are added AFTER carving, so sockets cannot eat them away.
   const lids=prims.map(p=>{const [cx,cy,cz,r]=p.bound,s=Math.sign(cx),xx=cx+s*r*.64;
    return {bound:[cx,cy,cz,r*1.4],d(x,y,z){const radial=Math.hypot((y-cy)/.64,(z-cz)/.89)-r;return Math.hypot(x-xx,radial*.75)-r*.24;}};});
   groups.push({region:'lid',prims:lids,blend:0,internal:0,leg:null});
  }
 };
 const carve=(region,prims,k=.005)=>{carves.push({region,prims,k});};
 const field=(x,y,z,region=false)=>{
  let d=1e6,closest=1e6,which='body',own=null,limb=1e6,body=1e6,leg=null,legD=1e6,eyeD=1e6,lidD=1e6;
  for(const g of groups){let gd=1e6;for(const p of g.prims){const [bx,by,bz,br]=p.bound;if(len(x-bx,y-by,z-bz)-br>Math.max(gd,d)+g.blend+g.internal+.02)continue;gd=smin(gd,p.d(x,y,z),g.internal);}
   // Socket cutters belong to the skull, never to the globe inside it.
   if(g.region==='eye'){eyeD=Math.min(eyeD,gd);continue;}
   if(g.region==='lid'){lidD=Math.min(lidD,gd);continue;}
   if(gd<closest){closest=gd;which=g.region;own=g.leg;}if(g.leg){limb=Math.min(limb,gd);if(!g.leg.arm&&gd<legD){legD=gd;leg=g.leg;}}else body=Math.min(body,gd);d=smin(d,gd,g.blend);
  }
  let hole=null;
  for(const c of carves){let cd=1e6;for(const p of c.prims){const [bx,by,bz,br]=p.bound;if(len(x-bx,y-by,z-bz)-br>c.k+.012)continue;cd=Math.min(cd,p.d(x,y,z));}
   if(cd<1e5){d=smax(d,-cd,c.k);if(cd<.004)hole=c.region;}}
  // Broad sculpted folds remain visible on the silhouette and on the Low mesh.
  // Keep their wavelength above the meshing grid; pores live in the shader.
  if(which==='neck')d+=.00028*Math.sin(y*205+z*62)*smooth(.29,.37,y)*(1-smooth(.5,.56,y));
  if(which==='leg'){
   const knee=Math.exp(-(((y-.195)/.045)**2)),ankle=Math.exp(-(((y-.065)/.028)**2));
   d+=.00022*Math.sin(y*235+z*35)*(knee+ankle*.55);
  }
  if(which==='body'&&z>-.24&&z<.14){
   const side=smooth(.025,.065,Math.abs(x))*(1-smooth(.39,.43,y));
   d+=.0003*Math.sin(z*135+y*38)*side*smooth(.21,.26,y)*(1-smooth(.33,.39,y));
  }
  if(eyeD<d){d=eyeD;which='eye';own=null;hole=null;}
  if(lidD<d){d=lidD;which='lid';own=null;hole=null;}
  d=Math.max(d,-y);return region?{which,own,leg,hole,limb:smooth(-.025,.025,body-limb)}:d;
 };
 return {add,carve,field};
}
const both=fn=>[-1,1].flatMap(s=>[fn(s)].flat());
/** Theropod-style runner legs: thigh buried in the ribs, lean knee, long metatarsus, three clawed toes. */
function runnerLegs(add,{hipX=.06,heavy=false,claw=false,slim=1}){
 for(const side of [-1,1]){
  const leg={pivot:[side*hipX,.31,-.025],side,lead:1},t=v=>v*slim;
  add('leg',[uprightLoft([
   [.005,.064,.016,.012,side*.06],[.034,.028,.016,.011,side*.06],
   [.079,claw?-.025:-.04,t(.02),t(.012),side*.063],[.13,claw?.006:-.015,t(.017),t(.013),side*.065],
   [.203,.065,t(.03),t(heavy?.036:claw?.034:.027),side*.073],[.267,.025,t(.06),t(heavy?.047:claw?.047:.033),side*.075],
   [.332,-.031,.067,heavy?.056:claw?.045:.036,side*(heavy?.09:.064)],[.387,-.047,.04,.025,side*(heavy?.057:.04)]
  ])],.022,0,leg);
  const spreads=claw?[0,side]:[-1,0,1],tips=spreads.map(sp=>[side*.06+sp*.018,.009,.103-Math.abs(sp)*.017]);
  add('toes',spreads.map((sp,i)=>roundCone([side*.06+sp*.008,.013,.04],tips[i],.009,.0048)),.005,.002,leg);
  add('claw',tips.map(([x,y,z])=>roundCone([x,y+.002,z-.004],[x,.002,z+.011],.0042,.0012)),.003,.002,leg);
  if(claw){
   add('toes',chain([[[side*.047,.023,.034],.008],[[side*.041,.052,.046],.008],[[side*.039,.063,.059],.006]]),.004,.003,leg);
   add('claw',chain([[[side*.039,.063,.059],.007],[[side*.038,.069,.079],.006],[[side*.037,.059,.095],.004],[[side*.037,.034,.098],.0009]]),.002,.001,leg);
  }
 }
}
function runnerArms(add,{shoulder=[.048,.357,.103],elbow=[.08,.292,.145],hand=[.09,.29,.235],r=[.015,.01],fingers=3,hoof=false,grasp=false}){
 for(const side of [-1,1]){
  const s=p=>[side*p[0],p[1],p[2]],arm={pivot:s(shoulder),side,lead:1,arm:true};
  add('arm',[roundCone(s(shoulder),s(elbow),r[0],r[1]),roundCone(s(elbow),s(hand),r[1],r[1]*.62)],.009,.006,arm);
  if(hoof){add('nail',[ellipsoid(s([hand[0],hand[1]-.008,hand[2]+.006]),[r[1]*.75,r[1]*.9,r[1]*.8])],.004,.002,arm);continue;}
  if(grasp){
   // Long separate metacarpals with inward-facing palms and hooked unguals.
   add('arm',[ellipsoid(s([hand[0],hand[1]-.007,hand[2]+.003]),[.008,.017,.013],{pitch:-.3})],.005,.003,arm);
   for(let finger=0;finger<3;finger++){
    const dz=(finger-1)*.016,L=[.038,.056,.046][finger],bx=hand[0]+.003*finger;
    const root=s([bx,hand[1]-.009,hand[2]+dz]),joint=s([bx+.009,hand[1]-L*.64,hand[2]+dz+.012]),tip=s([bx+.003,hand[1]-L,hand[2]+dz+.012]);
    // Low must keep a continuous digit, not disconnected islands at the tips.
    add('finger',chain([[root,Math.max(.0058,VOX*.72)],[joint,Math.max(.0048,VOX*.65)],[tip,Math.max(.0036,VOX*.68)]]),.003,.002,arm);
    add('nail',chain([[tip,Math.max(.0048,VOX*.7)],[s([bx-.009,hand[1]-L-.009,hand[2]+dz+.006]),Math.max(.0034,VOX*.6)],[s([bx-.022,hand[1]-L-.005,hand[2]+dz-.001]),.0009]]),.002,.001,arm);
   }
   continue;
  }
  const spreads=fingers===3?[-1,0,1]:[-1,1];
  for(const spread of spreads){const tip=[side*hand[0]+spread*.006,hand[1]-.016,hand[2]+.024];
   add('finger',[roundCone(s(hand),tip,.004,.0022)],.003,.002,arm);
   add('nail',[roundCone(tip,[tip[0],tip[1]-.009,tip[2]+.006],.0024,.0008)],.002,.0015,arm);}
 }
}
/** Four quadruped legs from upright lofts, with a muscle mass over each hip and shoulder and hoofed toes. */
function pillarLegs(add,{hind,fore}){
 for(const side of [-1,1])for(const L of [hind,fore]){
  const leg={pivot:[side*L.pivot[0],L.pivot[1],L.pivot[2]],side,lead:L===hind?1:-1};
  const end=L.keys.at(-1),keys=[...L.keys,[end[0]+.024,end[1],.024,.009,end[4]*.25]];
  add('leg',[uprightLoft(keys.map(([y,z,d,w,x])=>[y,z,d,w,side*x])),ellipsoid([side*L.muscle[0][0],L.muscle[0][1],L.muscle[0][2]],L.muscle[1])],.03,.02,leg);
  const [fx,fz]=[L.keys[0][4],L.keys[0][1]],toes=L.toes;
  add('toes',[ellipsoid([side*fx,.013,fz],[L.keys[0][3]*1.02,.016,L.keys[0][2]*1.02]),...toes.map(sp=>roundCone([side*fx+side*sp*L.spread*.5,.016,fz],[side*(fx+sp*L.spread)+side*L.splay,.01,fz+L.reach*(1-Math.abs(sp)*.18)],L.toeR,L.toeR*.8))],.012,.004,leg);
  add('hoof',toes.map(sp=>ellipsoid([side*(fx+sp*L.spread)+side*L.splay,.008,fz+L.reach*(1-Math.abs(sp)*.18)+.003],[L.toeR*1.05,L.toeR*.85,L.toeR*.9])),.004,.002,leg);
 }
}

/** A theropod skull in its own frame: skull and jaw lofts, brow ridge, eye in a carved socket,
 *  antorbital hollow and nostril. `snout` stretches the face; `kink` drops the premaxilla (Dilophosaurus). */
function theropodSkull(add,carve,H,{snout=1,kink=0,brow=1}={}){
 const S=z=>z>0?z*snout:z;
 add('head',H.all([loft([[-.06,.028,-.02,.026],[-.035,.04,-.028,.034],[-.005,.042,-.026,.033],[S(.03),.034,-.022,.026],[S(.065),.026,-.019,.02],[S(.095),.019,-.016-kink*.4,.016],[S(.112),.015,-.014-kink,.014],[S(.13),.004,-.01-kink*.8,.009]]),
  ...both(s=>ellipsoid([s*.0235,.028+.002*brow,.002],[.0085,.005*brow,.021],{pitch:-.06}))]),.008,.008);
 add('jaw',H.all([loft([[-.05,-.008,-.04,.027],[-.02,-.014,-.044,.028],[S(.02),-.016,-.036,.022],[S(.06),-.016,-.028,.017],[S(.1),-.013-kink*.3,-.021-kink*.3,.012],[S(.125),-.01,-.016,.008]])]),.006,.006);
 const eye=[.025,.02,.0];
 add('eye',H.all(both(s=>sphere([s*eye[0],eye[1],eye[2]],.0085))),0,0);
 carve('socket',H.all(both(s=>ellipsoid([s*.034,.021,.001],[.0095,.0085,.012]))),.004);
 carve('fenestra',H.all(both(s=>ellipsoid([s*.026,.009,S(.05)],[.0075,.009,.019*snout]))),.005);
 carve('nostril',H.all(both(s=>ellipsoid([s*.0105,.004-kink*.4,S(.121)],[.0035,.003,.0055]))),.002);
 return {eye,mouth:z=>-.0155+.005*smooth(S(.06),S(.13),z)-kink*.5*smooth(S(.08),S(.11),z)*(1-smooth(S(.12),S(.14),z)),front:S(.132)};
}
function theropodNeck(add,headY,thick=1){
 add('neck',[uprightLoft([
  [.315,.095,.04*thick,.03*thick],[.35,.133,.052*thick,.044*thick],
  [.39,.176,.044*thick,.033*thick],[headY-.008,.217,.031*thick,.026*thick],[headY+.028,.262,.036*thick,.028*thick]
 ])],.02,0);
}
/** JP-style raptor: deep temporal box, low orbital boss, a squared premaxilla,
 * a defined jaw hinge and a nearly level muzzle. No conical/duck-billed tip. */
function raptorSkull(add,carve,H){
 add('head',H.all([loft([
  [-.079,.021,-.021,.023],[-.056,.052,-.031,.038],[-.02,.058,-.033,.042],
  [.018,.047,-.024,.035],[.049,.038,-.02,.028],[.092,.034,-.021,.025],
  [.129,.03,-.024,.025],[.15,.019,-.023,.024],[.16,.002,-.022,.017]]),
  ...both(s=>ellipsoid([s*.026,.041,-.018],[.012,.006,.028],{pitch:.08})),
  ...both(s=>ellipsoid([s*.028,-.022,-.042],[.015,.024,.035]))]),.006,.007);
 add('jaw',H.all([loft([[-.064,-.016,-.057,.031],[-.028,-.023,-.06,.032],[.018,-.022,-.052,.027],[.07,-.018,-.044,.023],[.13,-.021,-.042,.023],[.156,-.019,-.034,.016]])]),.004,.004);
 const eye=[.032,.031,-.021];
 carve('socket',H.all(both(s=>ellipsoid([s*.043,.032,-.019],[.012,.012,.016]))),.0025);
 add('eye',H.all(both(s=>sphere([s*eye[0],eye[1],eye[2]],.0101))),0,0);
 carve('fenestra',H.all(both(s=>ellipsoid([s*.034,.014,.039],[.007,.012,.026]))),.004);
 carve('nostril',H.all(both(s=>ellipsoid([s*.025,.013,.131],[.0042,.004,.008],{pitch:.15}))),.002);
 // Incised closed mouth and the crease below the heavy cheek, not painted teeth.
 const mouth=z=>-.026+.004*smooth(.11,.16,z)-.005*Math.exp(-(((z+.005)/.025)**2));
 carve('lip',H.all(both(s=>chain([[-.037,.031],[.0,.029],[.05,.0245],[.1,.023],[.145,.021]].map(([z,x])=>[[s*x,mouth(z),z],.0018])))),.0006);
 return {eye,mouth,front:.162};
}
/** Eye descriptions for the paint: centre (model space), radius and outward axis, both sides. */
const eyesOf=(H,[x,y,z],r,fwd=.25)=>both(s=>{const c=H.toWorld([s*x,y,z]),o=H.toWorld([s*(x+1),y,z+fwd]),a=[o[0]-c[0],o[1]-c[1],o[2]-c[2]],l=len(...a);return {c,r,axis:a.map(v=>v/l)};});
/** Theropod teeth and lip line along the mouth, in head-local coordinates. */
function toothPaint(mouth,front,{teeth=[.6,.55,.44],lip=.55,pitch=260}={}){
 return (L,col)=>{const [x,y,z]=L;if(z<-.035||z>front-.004||Math.abs(x)<.004)return col;const m=mouth(z),dy=y-m;
  if(Math.abs(dy)<.0017)return [.02,.014,.01];
  if(dy>0&&dy<.0058&&(z*pitch%1+1)%1<.58)return mix(teeth,col,smooth(.003,.0058,dy));
  if(Math.abs(dy)<.006)return col.map(v=>v*lip+(1-lip)*v*smooth(.002,.006,Math.abs(dy)));return col;};
}

const SPECIES={
 // Jurassic Park raptor silhouette. The ghost variant deliberately shares this anatomy.
 raptor(){
  const {add,carve,field}=sculpt(),headY=.487,headZ=.272,H=placer({o:[0,headY,headZ],pitch:.055});
  add('body',[loft([[-.86,.354,.35,.001],[-.72,.371,.355,.007],[-.53,.371,.34,.017],[-.35,.37,.317,.028],[-.2,.399,.274,.051],[-.08,.408,.243,.071],[.045,.4,.233,.063],[.137,.381,.28,.041],[.18,.356,.314,.021]])],0,0);
  add('neck',[uprightLoft([[.325,.103,.04,.033],[.369,.139,.05,.042],[.409,.159,.047,.035],[.45,.18,.043,.034],[.48,.216,.043,.037],[.503,.238,.036,.03]])],.019,0);
  // Shoulder blade, chest and caudofemoral muscles interrupt the old smooth barrel.
  add('body',both(s=>[ellipsoid([s*.048,.354,.098],[.021,.044,.064],{pitch:-.38}),ellipsoid([s*.052,.318,-.12],[.027,.055,.094],{pitch:-.22})]),.014,.01);
  const skull=raptorSkull(add,carve,H);
  runnerLegs(add,{claw:true});runnerArms(add,{shoulder:[.052,.365,.108],elbow:[.08,.3,.127],hand:[.088,.26,.205],r:[.02,.013],grasp:true});
  return {field,H,eyes:eyesOf(H,skull.eye,.0101,.35),headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.34,.47],tail:[-.18,-.83],tailPivot:[0,.33,-.15],centre:.33,
   bounds:[[-.2,-.012,-.89],[.2,.6,.48]],
   paint:{back:[.105,.074,.046],belly:[.34,.29,.215],bands:[43,.38],mottle:.43,iris:[.42,.37,.13],slit:true,scale:.72,tub:.06},
   decorate:(L,col)=>{const [x,y,z]=L;if(z>-.04&&z<skull.front&&Math.abs(y-skull.mouth(z))<.002)return [.025,.019,.013];return col;},
   spheres:[[0,.33,.02,.078],[0,.33,-.12,.07],[0,.495,.315,.083],[0,.42,.185,.045],[0,.35,-.36,.042],[0,.16,0,.06]]};
 },
 // The film's small, broad-faced spitter, with paired swept crests and a pleated neck fan.
 dilophosaurus(){
  const {add,carve,field}=sculpt(),headY=.455,headZ=.29,H=placer({o:[0,headY,headZ],pitch:.04,scale:1.16});
  add('body',[loft([[-.72,.324,.32,.001],[-.55,.347,.313,.012],[-.34,.37,.287,.031],[-.18,.408,.243,.057],[-.045,.421,.234,.077],[.075,.41,.256,.066],[.166,.379,.299,.04],[.2,.355,.328,.019]])],0,0);theropodNeck(add,headY,1.12);
  const skull=theropodSkull(add,carve,H,{snout:.88,kink:.011,brow:1.1});
  // Each crest is a thin half-disc standing on the skull roof, splayed a little outward, tallest over the eyes.
  const crests=both(s=>{const C=placer({o:H.toWorld([s*.016,.029,-.013]),pitch:.06,roll:Math.PI/2-s*.1});
   return C.wrap(sheet(ellipse2(.021,.023,.043,.069),()=>.0036,()=>0,[.021,.023,.09],.0015));});
  add('crest',crests,.006,.002);
  const F=placer({o:[0,.441,.226],pitch:-Math.PI/2}),fan={A:.167,B:.129};
  const edge=(x,z)=>{const a=Math.atan2(z/fan.B,x/fan.A),ripple=.004*(.5+.5*Math.cos(a*22));
   return Math.max(ellipse2(0,0,fan.A,fan.B)(x,z)+ripple,(z>.032?.023-Math.abs(x):-1));};
  add('displayFrill',[F.wrap(sheet(edge,()=>.0034,(x,z)=>.024*(1-Math.hypot(x/fan.A,z/fan.B))+.003*Math.cos(Math.atan2(z,x)*22),[0,0,.19],.001))],.006,.002);
  runnerLegs(add,{});runnerArms(add,{shoulder:[.053,.359,.106],elbow:[.079,.292,.137],hand:[.082,.249,.207],r:[.017,.011],grasp:true});
  return {field,H,F,fan,eyes:eyesOf(H,skull.eye,.0085*1.16),headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.32,.42],tail:[-.18,-.7],tailPivot:[0,.33,-.15],centre:.33,
   bounds:[[-.21,-.012,-.76],[.21,.64,.48]],
   paint:{back:[.047,.079,.047],belly:[.32,.315,.19],bands:[47,.48],spots:true,mottle:.4,crest:[.26,.19,.055],crestTip:[.44,.39,.17],iris:[.36,.28,.06],slit:true,scale:.68,tub:.09},
   decorate:toothPaint(skull.mouth,skull.front),
   spheres:[[0,.35,.02,.078],[0,.33,-.12,.07],[0,.47,.32,.055],[-.09,.45,.23,.084],[.09,.45,.23,.084],[0,.33,-.36,.042],[0,.16,0,.06]]};
 },
 // Parasaurolophus: heavy-hipped, deep-tailed, a broad duck bill and the long tube crest swept back from the skull.
 parasaurolophus(){
  const {add,carve,field}=sculpt(),headY=.538,headZ=.26,H=placer({o:[0,headY,headZ],pitch:.1,scale:1.13});
  add('body',[loft([[-.8,.32,.312,.002],[-.65,.35,.302,.011],[-.43,.378,.27,.025],[-.27,.428,.222,.058],[-.13,.462,.197,.104],[.01,.458,.207,.116],[.12,.418,.247,.088],[.2,.37,.293,.034]])],0,0);
  add('neck',[uprightLoft([[.315,.098,.052,.042],[.36,.135,.065,.056],[.413,.171,.058,.046],[.46,.188,.046,.036],[.51,.213,.044,.034],[.555,.236,.039,.031]])],.022,0);
  add('head',H.all([loft([[-.05,.026,-.022,.027],[-.02,.034,-.028,.032],[.015,.031,-.026,.028],[.05,.02,-.02,.021],[.08,.01,-.016,.018],[.105,.003,-.013,.021],[.122,-.002,-.011,.02]]),
   ...both(s=>ellipsoid([s*.02,-.012,.002],[.014,.02,.03]))]),.009,.008);
  add('jaw',H.all([loft([[-.04,-.012,-.045,.026],[.0,-.018,-.048,.026],[.045,-.018,-.038,.019],[.085,-.014,-.027,.016],[.115,-.013,-.022,.018]])]),.006,.006);
  add('beak',H.all([ellipsoid([0,-.004,.121],[.023,.0085,.019]),ellipsoid([0,-.02,.114],[.019,.007,.016])]),.005,.004);
  add('crest',H.all(chain([[[0,.018,.065],.012],[[0,.046,.006],.018],[[0,.079,-.06],.019],[[0,.088,-.14],.0175],[[0,.075,-.215],.0145],[[0,.055,-.25],.008]],{squeeze:.84})),.012,.007);
  const eye=[.024,.017,.008];add('eye',H.all(both(s=>sphere([s*eye[0],eye[1],eye[2]],.0082))),0,0);
  carve('socket',H.all(both(s=>ellipsoid([s*.033,.018,.009],[.0095,.0085,.011]))),.004);
  carve('nostril',H.all(both(s=>ellipsoid([s*.0175,.004,.096],[.0045,.0038,.014]))),.003);
  runnerLegs(add,{hipX:.084,heavy:true});runnerArms(add,{shoulder:[.063,.357,.103],elbow:[.092,.268,.14],hand:[.084,.196,.19],r:[.021,.014],hoof:true});
  return {field,H,eyes:eyesOf(H,eye,.0082*1.13),headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.33,.51],tail:[-.18,-.76],tailPivot:[0,.33,-.15],centre:.34,
   bounds:[[-.2,-.012,-.85],[.2,.77,.46]],
   paint:{back:[.265,.153,.058],belly:[.47,.405,.285],bands:[50,.12],mottle:.4,crest:[.11,.057,.033],crestTip:[.035,.025,.019],beak:[.078,.064,.046],iris:[.15,.085,.025],scale:.62,tub:.14},
   decorate:(L,col)=>{const [x,y,z]=L;if(z>.02&&z<.11&&Math.abs(x)>.012&&Math.abs(y+.0185+.004*smooth(.06,.11,z))<.0016)return [.03,.022,.015];return col;},
   spheres:[[0,.34,.0,.11],[0,.34,-.16,.09],[0,.54,.29,.062],[0,.48,.21,.048],[0,.34,-.4,.05],[0,.16,0,.07]]};
 },
 // Pachycephalosaurus: a massive bone dome over a short face, ringed behind with a shelf of knobs and spikes.
 pachycephalosaurus(){
  const {add,carve,field}=sculpt(),headY=.472,headZ=.25,H=placer({o:[0,headY,headZ],pitch:.12,scale:1.23});
  add('body',[loft([[-.78,.325,.318,.001],[-.62,.34,.306,.012],[-.42,.356,.29,.028],[-.24,.407,.25,.058],[-.09,.44,.22,.09],[.05,.43,.23,.085],[.15,.398,.272,.053],[.2,.36,.31,.017]])],0,0);
  add('neck',[uprightLoft([[.315,.1,.043,.035],[.365,.14,.056,.05],[.41,.175,.052,.042],[headY-.012,.202,.04,.035],[headY+.022,.233,.038,.034]])],.023,0);
  add('head',H.all([loft([[-.045,.028,-.022,.03],[-.015,.036,-.03,.035],[.015,.032,-.03,.031],[.04,.02,-.027,.023],[.06,.008,-.023,.015],[.076,-.004,-.019,.009]])]),.008,.008);
  add('jaw',H.all([loft([[-.035,-.02,-.05,.027],[.0,-.026,-.054,.027],[.035,-.026,-.045,.02],[.066,-.022,-.033,.011]])]),.006,.006);
  add('beak',H.all([ellipsoid([0,-.013,.077],[.0072,.0115,.0085])]),.004,.003);
  add('dome',H.all([ellipsoid([0,.045,-.009],[.04,.031,.044]),ellipsoid([0,.031,.021],[.03,.021,.029],{pitch:.25})]),.01,.01);
  add('head',H.all([ellipsoid([0,.019,-.04],[.045,.019,.032])]),.01,.01);
  // Knobs: a ring of short spikes round the back and sides of the squamosal shelf, rows on the cheeks and nose.
  const knobs=[];for(let i=0;i<13;i++){const a=-1.45+i*2.9/12,sx=Math.sin(a),cz=Math.cos(a),bx=sx*.045,by=.014+Math.abs(sx)*.004,bz=-.046-cz*.026,L=.011+.004*Math.cos(a*3);
   knobs.push(roundCone([bx,by,bz],[bx+sx*L*1.2,by-.002,bz-cz*L*1.2],.0078,.0026));}
  for(const s of [-1,1]){for(let i=0;i<3;i++)knobs.push(sphere([s*(.031-.004*i),-.008-.006*i,.004+.012*i],.0045));
   for(let i=0;i<3;i++)knobs.push(sphere([s*.007,[.0155,.0095,.003][i],.048+.01*i],.0038));}
  add('knob',H.all(knobs),.005,.002);
  const eye=[.026,.016,.02];add('eye',H.all(both(s=>sphere([s*eye[0],eye[1],eye[2]],.0078))),0,0);
  carve('socket',H.all(both(s=>ellipsoid([s*.035,.017,.021],[.009,.008,.011]))),.004);
  carve('nostril',H.all(both(s=>ellipsoid([s*.0085,.001,.068],[.0032,.003,.005]))),.002);
  runnerLegs(add,{hipX:.07,heavy:true});runnerArms(add,{shoulder:[.052,.35,.1],elbow:[.078,.29,.132],hand:[.08,.268,.2],r:[.015,.01]});
  return {field,H,eyes:eyesOf(H,eye,.0078*1.23),headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.33,.45],tail:[-.18,-.76],tailPivot:[0,.33,-.15],centre:.33,
   bounds:[[-.2,-.012,-.83],[.2,.62,.42]],
   paint:{back:[.075,.115,.118],belly:[.39,.36,.27],bands:[44,.24],mottle:.4,dome:[.49,.415,.3],knob:[.27,.225,.16],beak:[.063,.052,.038],iris:[.21,.12,.04],scale:.64,tub:.12},
   decorate:(L,col)=>{const [x,y,z]=L;if(z>-.01&&z<.07&&Math.abs(x)>.01&&Math.abs(y+.027)<.0014)return col.map(v=>v*.35);return col;},
   spheres:[[0,.34,.02,.085],[0,.33,-.13,.075],[0,.51,.25,.071],[0,.42,.19,.045],[0,.33,-.37,.045],[0,.16,0,.065]]};
 },
 // Triceratops: barrel body on four pillar legs; a deep, narrow face ending in a hooked beak, a short
 // nose horn, two long brow horns, cheek spikes and a broad solid frill scalloped with epoccipitals.
 triceratops(){
  const {add,carve,field}=sculpt();
  add('body',[loft([[-.64,.184,.17,.003],[-.54,.214,.176,.016],[-.42,.262,.184,.036],[-.3,.332,.176,.07],[-.19,.374,.156,.1],[-.08,.382,.128,.12],[.04,.366,.122,.124],[.14,.334,.138,.11],[.21,.302,.168,.086],[.27,.286,.2,.06]])],0,0);
  add('neck',[roundCone([0,.25,.22],[0,.262,.3],.066,.052,{squeeze:.92}),ellipsoid([0,.2,.27],[.052,.046,.06])],.03,.02);
  // Broad Winston-style facial mass; the shorter rostrum sits under the nasal boss.
  const H=placer({o:[0,.262,.29],pitch:.29,scale:1.08});
  add('head',H.all([
   ellipsoid([0,.036,.042],[.062,.055,.066]),
   loft([[.0,.062,-.042,.062],[.06,.078,-.052,.065],[.11,.071,-.052,.055],[.151,.052,-.049,.04],[.18,.027,-.044,.029],[.207,.003,-.04,.019],[.222,-.013,-.035,.014]]),
   ...both(s=>ellipsoid([s*.05,-.018,.051],[.032,.043,.042]))]),.014,.012);
  add('jaw',H.all([loft([[.0,-.022,-.068,.044],[.055,-.036,-.09,.044],[.115,-.04,-.084,.035],[.175,-.04,-.07,.024],[.222,-.038,-.056,.013]])]),.008,.008);
  // Hooked upper beak (rostral) over a pointed lower beak (predentary).
  add('beak',H.all([
   loft([[.176,.015,-.041,.025],[.204,.02,-.054,.025],[.227,-.006,-.058,.018],[.242,-.034,-.045,.005]]),
   loft([[.177,-.034,-.073,.022],[.21,-.039,-.075,.02],[.233,-.048,-.061,.008]])]),.004,.003);
  add('horn',H.all([
   ...chain([[[0,.048,.152],.0155],[[0,.078,.166],.009],[[0,.098,.18],.0025]]),
   ...both(s=>chain([[[s*.039,.068,.064],.023],[[s*.051,.111,.127],.017],[[s*.066,.149,.191],.0105],[[s*.073,.195,.235],.0017]])),
   ...both(s=>roundCone([s*.06,-.036,.046],[s*.08,-.066,.04],.012,.003))]),.008,.003);
  const eye=[.047,.041,.075];add('eye',H.all(both(s=>sphere([s*eye[0],eye[1],eye[2]],.0102))),0,0);
  carve('socket',H.all(both(s=>ellipsoid([s*.057,.043,.078],[.015,.012,.016]))),.003);
  carve('nostril',H.all(both(s=>ellipsoid([s*.034,.007,.181],[.009,.008,.016],{pitch:-.3}))),.003);
  // The frill: a solid shield rising back from the skull roof, dished slightly forward, thickest along its
  // midline; its lower corners reach down beside the cheeks. Local x lateral, z up the frill, y through it.
  const Fr=placer({o:H.toWorld([0,.05,-.004]),pitch:.29-(Math.PI-.52)}),A=.153,B=.131,ZC=.04;
  const bend=(x,z)=>-.9*x*x-.2*Math.max(0,z-.1)**2;
  const frill=sheet(ellipse2(0,ZC,A,B),(x,z)=>.0052+.0055*clamp01(1-(x/A)**2-((z-ZC)/B)**2)+.0035*Math.exp(-((x/.014)**2))*smooth(-.03,.03,z)*(1-smooth(.12,.165,z)),bend,[0,ZC,A+.01]);
  add('frill',[Fr.wrap(frill)],.02,.006);
  const rim=[];for(let i=0;i<19;i++){const t=-.42+i*(Math.PI+.84)/18,x=Math.cos(t)*A,z=ZC+Math.sin(t)*B,nx=Math.cos(t)/A,nz=Math.sin(t)/B,nl=Math.hypot(nx,nz);
   rim.push(ellipsoid([x+nx/nl*.003,bend(x,z),z+nz/nl*.003],[.0092,.0048,.0105],{yaw:Math.atan2(nx,nz)}));}
  add('epoc',Fr.all(rim),.006,.002);
  pillarLegs(add,{
   hind:{pivot:[.08,.3,-.2],muscle:[[.086,.255,-.19],[.046,.088,.086]],keys:[[.005,-.168,.036,.034,.086],[.03,-.176,.03,.029,.086],[.07,-.19,.027,.026,.085],[.11,-.203,.03,.028,.084],[.16,-.19,.038,.033,.083],[.21,-.172,.048,.04,.082],[.27,-.188,.07,.05,.08],[.32,-.2,.085,.055,.076]],
    toes:[-1,0,1],spread:.017,splay:.003,reach:.034,toeR:.0105},
   fore:{pivot:[.09,.24,.13],muscle:[[.092,.245,.14],[.044,.07,.068]],keys:[[.005,.152,.03,.033,.106],[.03,.15,.026,.028,.106],[.07,.146,.024,.025,.105],[.12,.14,.028,.03,.106],[.17,.132,.036,.038,.109],[.215,.133,.05,.045,.1],[.26,.13,.06,.05,.086]],
    toes:[-1,-.5,0,.5,1],spread:.019,splay:.005,reach:.026,toeR:.0085},
  });
  return {field,H,Fr,frill:{A,B,ZC},eyes:eyesOf(H,eye,.0102*1.08,.35),headY:.25,headZ:.34,quad:true,neckBase:[0,.26,.2],neckZ:[.19,.3],tail:[-.26,-.64],tailPivot:[0,.3,-.25],centre:.26,
   bounds:[[-.23,-.012,-.68],[.23,.57,.62]],
   paint:{back:[.094,.076,.067],belly:[.27,.224,.183],bands:[26,.08],mottle:.48,frill:[.16,.116,.092],frillRim:[.059,.048,.041],horn:[.34,.285,.203],beak:[.14,.113,.074],hoof:[.065,.053,.042],epoc:[.24,.201,.151],iris:[.16,.074,.041],scale:.58,tub:.56},
   decorate(L,col){const [x,y,z]=L;
    // A closed lip line from the beak back under the eye.
    if(z>.03&&z<.226&&Math.abs(x)>.012){const m=-.047+.006*smooth(.14,.22,z),d=Math.abs(y-m);if(d<.0024)return col.map(v=>v*(.4+.6*smooth(.0008,.0024,d)));}
    return col;},
   spheres:[[0,.26,-.04,.15],[0,.28,-.24,.1],[0,.2,.41,.09],[0,.38,.27,.11],[0,.22,-.43,.05]]};
 },
 // Stegosaurus: high hips and a low small head, two staggered rows of broad plates, a four-spiked tail.
 stegosaurus(){
  const {add,carve,field}=sculpt();
  const keys=[[-.66,.2,.186,.004],[-.56,.224,.19,.014],[-.44,.266,.198,.03],[-.32,.328,.2,.052],[-.2,.386,.186,.078],[-.1,.405,.164,.096],[.0,.392,.148,.1],[.1,.342,.15,.09],[.18,.284,.158,.068],[.24,.236,.164,.046]],body=loft(keys);
  add('body',[body],0,0);
  add('neck',chain([[[0,.214,.235],.046],[[0,.196,.29],.035],[[0,.184,.328],.025]],{squeeze:.8}),.02,.012);
  // Ossicles: a pavement of small bony studs under the throat.
  add('ossicle',[...Array(9)].map((_,i)=>{const z=.25+i*.011,t=(z-.235)/.105,y=.212+(.18-.212)*t-(.044+(.026-.044)*t)*.86;return sphere([(i%2?1:-1)*.008,y,z],.0052);}),.004,.002);
  const H=placer({o:[0,.18,.338],pitch:.3,scale:1.02});
  add('head',H.all([loft([[-.018,.028,-.022,.024],[.005,.033,-.024,.026],[.03,.03,-.022,.022],[.055,.021,-.018,.016],[.075,.011,-.013,.011],[.088,.002,-.01,.007]]),...both(s=>ellipsoid([s*.016,-.008,.026],[.0095,.014,.022])),...both(s=>ellipsoid([s*.014,.026,.02],[.008,.006,.017]))]),.007,.008);
  add('jaw',H.all([loft([[-.012,-.012,-.036,.02],[.02,-.014,-.034,.019],[.05,-.013,-.026,.013],[.08,-.01,-.017,.0065]])]),.006,.006);
  add('beak',H.all([ellipsoid([0,-.007,.086],[.0066,.0098,.0085])]),.004,.003);
  const eye=[.0205,.013,.022];add('eye',H.all(both(s=>sphere([s*eye[0],eye[1],eye[2]],.0062))),.002,.001);
  carve('socket',H.all(both(s=>ellipsoid([s*.027,.014,.023],[.008,.0072,.009]))),.003);
  carve('nostril',H.all(both(s=>ellipsoid([s*.0065,.002,.08],[.003,.003,.0045]))),.002);
  // Plates: broad rounded leaves, tallest over the hips and the base of the tail, in two staggered rows.
  const plates=[];for(let i=0;i<17;i++){const z=.28-i*.048,bell=Math.exp(-(((z+.12)/.23)**2)),neck=smooth(.1,.27,z),h=.021+.116*bell-.01*neck,s=i%2?1:-1,t=body.top(z);
   plates.push(plate([s*.018,t+h*.52,z],(.024+.035*bell)*(1-.25*neck),h,.006,{pitch:-.11-.13*bell,yaw:s*.065,leaf:.24,round:.004}));}
  add('plate',plates,.009,.002);
  add('spike',both(s=>[roundCone([s*.012,.228,-.5],[s*.115,.286,-.552],.014,.002),roundCone([s*.01,.215,-.56],[s*.097,.272,-.661],.013,.0018)]),.007,.002);
  pillarLegs(add,{
   hind:{pivot:[.07,.34,-.15],muscle:[[.075,.29,-.15],[.04,.082,.078]],keys:[[.005,-.128,.034,.03,.075],[.035,-.134,.027,.025,.075],[.08,-.143,.025,.024,.074],[.13,-.158,.028,.026,.073],[.19,-.143,.034,.03,.072],[.25,-.124,.045,.036,.071],[.3,-.14,.065,.046,.07],[.36,-.155,.08,.05,.066]],
    toes:[-1,0,1],spread:.016,splay:.002,reach:.03,toeR:.0095},
   fore:{pivot:[.075,.2,.17],muscle:[[.076,.2,.17],[.036,.06,.056]],keys:[[.005,.186,.028,.029,.085],[.03,.184,.024,.024,.085],[.07,.181,.022,.022,.086],[.11,.177,.026,.026,.088],[.16,.173,.036,.034,.085],[.21,.17,.046,.038,.077]],
    toes:[-1,-.5,0,.5,1],spread:.015,splay:.004,reach:.022,toeR:.0072},
  });
  return {field,H,eyes:eyesOf(H,eye,.0062*1.02),top:z=>body.top(z),headY:.17,headZ:.38,quad:true,neckBase:[0,.2,.22],neckZ:[.21,.31],tail:[-.18,-.66],tailPivot:[0,.33,-.18],centre:.27,
   bounds:[[-.18,-.012,-.71],[.18,.67,.47]],
   paint:{back:[.077,.105,.071],belly:[.31,.3,.205],bands:[30,.15],mottle:.43,plate:[.18,.139,.075],plateEdge:[.23,.213,.13],spike:[.31,.281,.19],beak:[.055,.048,.034],hoof:[.062,.054,.039],ossicle:[.25,.245,.16],iris:[.2,.115,.026],scale:.6,tub:.44},
   decorate(L,col){const [x,y,z]=L;if(z>.0&&z<.082&&Math.abs(x)>.006&&Math.abs(y+.014+.003*smooth(.05,.085,z))<.0017)return col.map(v=>v*.35);return col;},
   spheres:[[0,.29,-.06,.13],[0,.33,-.2,.1],[0,.51,-.19,.092],[0,.51,-.04,.087],[0,.17,.37,.05],[0,.23,-.45,.05]]};
 },
 // Gallimimus: an ostrich-like runner; small big-eyed head with a long toothless beak on a slender S-curved
 // neck, a deep compact body, a long level tail and long slim legs. Rigged like the chase's herd animals.
 gallimimus(){
  const {add,carve,field}=sculpt();
  add('body',[loft([[-.64,.318,.306,.002],[-.5,.328,.3,.008],[-.36,.34,.291,.018],[-.22,.362,.27,.037],[-.1,.398,.25,.062],[.0,.412,.24,.074],[.08,.406,.248,.068],[.14,.388,.282,.05],[.18,.37,.318,.028]])],0,0);
  add('neck',[uprightLoft([[.335,.13,.035,.028],[.382,.163,.03,.024],[.43,.178,.026,.02],[.482,.183,.022,.017],[.535,.22,.019,.016],[.583,.278,.022,.018]])],.016,0);
  const H=placer({o:[0,.582,.303],pitch:.03,scale:1.08});
  add('head',H.all([loft([[-.024,.012,-.012,.015],[-.004,.019,-.013,.018],[.018,.015,-.01,.014],[.036,.007,-.007,.008],[.05,.002,-.005,.005]])]),.006,.006);
  add('jaw',H.all([loft([[-.016,-.004,-.017,.013],[.012,-.006,-.014,.01],[.042,-.005,-.008,.005]])]),.004,.004);
  add('beak',H.all([ellipsoid([0,-.002,.057],[.0085,.0055,.023])]),.004,.003);
  const eye=[.0125,.007,.0];add('eye',H.all(both(s=>sphere([s*eye[0],eye[1],eye[2]],.0072))),0,0);
  carve('socket',H.all(both(s=>ellipsoid([s*.0205,.0075,.001],[.0068,.0068,.0082]))),.003);
  runnerLegs(add,{hipX:.052,slim:.83});runnerArms(add,{shoulder:[.044,.371,.11],elbow:[.064,.294,.137],hand:[.068,.245,.205],r:[.012,.0085],grasp:true});
  return {field,H,eyes:eyesOf(H,eye,.0072*1.08,.1),headY:.58,headZ:.33,biped:true,neckBase:[0,.35,.13],neckY:[.37,.55],tail:[-.14,-.64],tailPivot:[0,.32,-.1],centre:.31,
   bounds:[[-.17,-.012,-.68],[.17,.65,.43]],
   paint:{back:[.235,.119,.046],belly:[.49,.404,.27],bands:[38,.14],mottle:.38,beak:[.13,.102,.068],iris:[.27,.17,.058],scale:.55,tub:0},
   spheres:[[0,.33,0,.1]]};
 },
};

// ---------------------------------------------------------------------- bake --
const out=[],header={version:2,models:[],species:{}};let offset=0;
const pad=b=>b.length%4?Buffer.concat([b,Buffer.alloc(4-b.length%4)]):b;
const only=process.argv[2]?.split(',');
for(const name of Object.keys(SPECIES))for(const tier of ['high','low']){
 if(only&&!only.includes(name))continue;
 const vox=VOX=tier==='high'?(name==='raptor'?.0042:.0048):.0102,a=SPECIES[name](),{field,paint:pt}=a,{positions:P,normals:N,indices:I}=mesh(field,vox,a.bounds),n=P.length/3;
 // Positions are quantized inside the bounds; a surface that reaches them would be clipped open and wrap.
 for(let i=0;i<n*3;i++){const ax=i%3,v=P[i];if((ax!==1&&v<a.bounds[0][ax]+vox)||v>a.bounds[1][ax]-vox)throw Error(`${name} ${tier}: the sculpt reaches its ${'xyz'[ax]} bound (${v.toFixed(3)})`);}
 const pivots=[],pivotIndex=(part,side,lead,p)=>{const key=[part,side,lead,...p].join();let i=pivots.findIndex(q=>q.key===key);if(i<0){i=pivots.length;pivots.push({key,part,side,lead,p});}return i;};
 const rig=new Uint8Array(n*4),color=new Uint8Array(n*4),normal=new Int8Array(n*4),pos=new Int16Array(n*3+(n*3)%2);
 const [lo,hi]=a.bounds,q=(v,i)=>Math.round(((v-lo[i])/(hi[i]-lo[i]))*65535-32768);
 const tail=a.tail;
 for(let i=0;i<n;i++){
  const x=P[i*3],y=P[i*3+1],z=P[i*3+2],nx=N[i*3],ny=N[i*3+1],nz=N[i*3+2],f=field(x,y,z,true),region=f.which;
  let part=0,weight=0,piv=pivotIndex(0,0,1,[0,0,0]);
  // Continuous weights fade limb, neck and tail deformation into the shared torso.
  const L=f.own||(a.biped&&y<.24&&z<.16?f.leg:null);
  if(L){part=L.arm?4:3;weight=(L.arm?smooth(0,.065,len(x-L.pivot[0],y-L.pivot[1],z-L.pivot[2])):clamp01((L.pivot[1]-y)/L.pivot[1]))*f.limb;piv=pivotIndex(part,L.side,L.lead,L.pivot);}
  else if(z<tail[0]&&(region==='body'||region==='spike'||region==='plate'&&z<tail[0]-.05)){part=2;weight=smooth(tail[0]+.01,tail[1],z);piv=pivotIndex(2,0,1,a.tailPivot);}
  else if(HEADISH.has(region)){part=1;const neckish=region==='neck'||region==='ossicle';
   weight=a.neckY?(neckish?smooth(a.neckY[0],a.neckY[1],y):1):neckish?smooth(a.neckZ[0],a.neckZ[1],z):region==='frill'||region==='epoc'?1:smooth(a.neckZ[0]-.02,a.neckZ[0]+.06,z);piv=pivotIndex(1,0,1,a.neckBase);}
  else if(a.neckZ&&z>a.neckZ[0]&&region==='body'){part=1;weight=smooth(a.neckZ[0],a.neckZ[1],z);piv=pivotIndex(1,0,1,a.neckBase);}
  // Spare rig byte: isolate the display membrane from the skull/neck. Fade at
  // its attachment so the cone fold never pulls a seam out of the throat.
  const frill=region==='displayFrill'?smooth(.032,.065,Math.hypot(x,y-.441)):0;
  rig.set([part,Math.round(weight*255),piv,Math.round(frill*255)],i*4);
  // ---- hide: dorsal colour over a pale belly, mottled and banded, then the special regions.
  const limb=region==='leg'||region==='toes';
  const dorsal=a.quad?(limb?.9:smooth(-.6,-.05,ny)*smooth(.1,.22,y)):smooth(.22,.4,y)*smooth(-.5,.2,ny);
  let col=mix(pt.belly,pt.back,dorsal);if(a.quad&&limb)col=col.map(v=>v*(.78+.22*smooth(.02,.2,y)));
  const m=fbm(x*22,y*22,z*22),m2=vnoise(x*70+3,y*70,z*70);
  col=col.map((v,c)=>v*(1+(pt.mottle||0)*((m-.5)*1.6+(m2-.5)*.5))*(c===1?1+(m-.5)*.12:1));
  const [freq,depth]=pt.bands,band=smooth(.28,.78,Math.sin(z*freq+Math.sin(y*45)*1.2+Math.abs(x)*12+(m-.5)*2.2))*(a.quad?smooth(.15,.3,y):smooth(.22,.36,y))*dorsal;
  col=col.map(v=>v*(1-band*depth));
  if(name==='parasaurolophus'&&(region==='body'||region==='neck')){
   // The Lost World maquette has longitudinal dark dorsal ribbons and a
   // stippled ochre saddle, rather than the shared theropod zebra pattern.
   const ribbon=smooth(.39,.5,ny)*(1-smooth(.64,.74,ny)),spine=smooth(.88,.98,ny);
   col=mix(col,[.062,.034,.019],Math.max(ribbon*.78,spine*.7)*smooth(.31,.4,y));
   const dots=smooth(.64,.78,vnoise(x*175,y*175,z*175))*smooth(.26,.34,y)*(1-smooth(.41,.45,y));
   col=col.map(v=>v*(1-dots*.46));
  }
  if(name==='raptor'&&region==='head'){
   const L=a.H.local([x,y,z]),mask=(1-smooth(.01,.036,Math.abs(L[1]-.025)))*(1-smooth(.03,.1,L[2]));
   col=col.map(v=>v*(1-mask*.28));
  }
  if(pt.spots){const s=Math.sin(x*190+z*37)*Math.sin(z*150+y*61)*Math.sin(y*170+x*40);if(s>.35)col=col.map(v=>v*.6);}
  const speckle=hash3(Math.round(x*900),Math.round(y*900),Math.round(z*900));col=col.map(v=>v*(.94+speckle*.08));
  let scale=pt.scale*(region==='head'||region==='jaw'?.75:1),tub=(pt.tub||0)*dorsal*(region==='head'||region==='jaw'?.3:1),gloss=0;
  const H=a.H&&HEADISH.has(region)?a.H.local([x,y,z]):null;
  if(region==='crest'&&pt.crest){
   // Dilophosaurus: pale-edged, dark-barred plates; Parasaurolophus: a tube darkening to the tip.
   if(pt.crestTip&&name==='dilophosaurus'){const up=H[1]-.03;col=mix(mix(col,pt.crest,smooth(.0,.014,up)),pt.crestTip,smooth(.03,.05,up));if(Math.sin(H[2]*170+up*40)>.45&&up>.008&&up<.04)col=col.map(v=>v*.4);}
   else col=mix(pt.crest,pt.crestTip||pt.crest,smooth(-.05,-.2,H[2])).map(v=>v*(.85+.15*smooth(.01,.06,H[1])));
   scale=.3;tub=0;}
  if(region==='dome'&&pt.dome){col=mix(col,pt.dome,smooth(.15,.7,ny)).map(v=>v*(.9+m2*.18));scale=.08;tub=0;gloss=.18;}
  if(region==='knob'&&pt.knob){col=mix(col,pt.knob,.75);scale=0;tub=0;gloss=.25;}
  if(region==='lid'){scale=.18;tub=0;}
  if(region==='frill'&&pt.frill){
   // Warm field darkening to a banded rim, with radiating vascular streaks.
   const [u,,w]=a.Fr.local([x,y,z]),{A,B,ZC}=a.frill,r=Math.hypot(u/A,(w-ZC)/B),ang=Math.atan2(w-ZC,u);
   col=mix(mix(col,pt.frill,smooth(-.02,.05,w)),pt.frillRim,smooth(.8,.96,r)).map(v=>v*(.84+.16*Math.sin(ang*23+m*3)*smooth(.3,.7,r)));
   if(r>.55&&r<.72)col=col.map(v=>v*.78);scale=.35;tub=0;}
  if(region==='displayFrill'){
   const [u,,v]=a.F.local([x,y,z]),r=Math.hypot(u/a.fan.A,v/a.fan.B),angle=Math.atan2(v/a.fan.B,u/a.fan.A);
   const ray=(.5+.5*Math.sin(angle*22+Math.sin(r*12)*.25))**6,rim=smooth(.78,.97,r);
   col=mix([.15,.052,.024],[.35,.22,.055],smooth(.2,.55,r));
   col=mix(col,[.028,.037,.016],rim*.94+ray*smooth(.25,.52,r)*(1-rim)*.65);
   col=col.map(v=>v*(.8+m*.35));scale=.22;tub=0;
  }
  if(region==='epoc'&&pt.epoc){col=pt.epoc.map(v=>v*(.85+m2*.2));scale=0;tub=0;gloss=.2;}
  if(region==='horn'&&pt.horn){
   // Keratin: skin-coloured at the base, pale along the shaft, darker at the tip.
   const L=a.H.local([x,y,z]),base=name==='triceratops'?(Math.abs(L[0])>.05&&L[1]<0?smooth(-.04,-.056,L[1]):Math.abs(L[0])<.01?smooth(.05,.07,L[1]):smooth(.075,.1,L[1])):1;
   col=mix(col,pt.horn,base).map(v=>v*(.92+.08*Math.sin((L[1]+L[2])*900)));
   const tip=Math.abs(L[0])<.01?smooth(.085,.1,L[1]):Math.abs(L[0])>.05&&L[1]<0?smooth(-.058,-.068,L[1]):smooth(.19,.21,L[2]);col=mix(col,[.09,.075,.055],tip*.7);
   scale=0;tub=0;gloss=.45;}
  if(region==='beak'&&pt.beak){col=pt.beak.map(v=>v*(.9+m2*.2));scale=0;tub=0;gloss=.4;}
  if((region==='hoof'||region==='claw'||region==='nail')){col=(pt.hoof||[.035,.028,.02]).map(v=>v*(.85+m2*.25));scale=0;tub=0;gloss=.4;}
  if(region==='ossicle'&&pt.ossicle){col=pt.ossicle;scale=0;tub=0;gloss=.15;}
  if(region==='plate'&&pt.plate){const up=y-a.top(z);col=mix(mix([.07,.055,.035],pt.plate,smooth(.008,.04,up)),pt.plateEdge,smooth(.05,.1,up)).map(v=>v*(.84+.16*Math.sin(z*300+y*120+m*4)));scale=0;tub=0;gloss=.12;}
  if(region==='spike'&&pt.spike){col=mix(col,pt.spike,smooth(.012,.03,Math.abs(x))).map(v=>v*(1-.5*smooth(.05,.075,Math.abs(x))));scale=0;tub=0;gloss=.4;}
  // Eyes: iris with a dark pupil (a slit for the theropods), a dark rim of lid round the eyeball.
  for(const e of a.eyes){const dx=x-e.c[0],dy=y-e.c[1],dz=z-e.c[2],dist=len(dx,dy,dz);if(dist>e.r*1.9)continue;
   if(region==='eye'){const t=(dx*e.axis[0]+dy*e.axis[1]+dz*e.axis[2])/dist;col=mix(pt.iris.map(v=>v*.55),pt.iris,smooth(.55,.8,t));
    const vy=dy-e.axis[1]*t*dist,hz=Math.sqrt(Math.max(0,dist*dist*(1-t*t)-vy*vy));if(pt.slit?t>.62&&hz<e.r*.2:t>.86)col=[.004,.004,.003];scale=0;tub=0;gloss=1;}
   else col=col.map(v=>v*(.45+.55*smooth(e.r*1.15,e.r*1.9,dist)));}
  if(f.hole==='nostril'||f.hole==='lip')col=col.map(v=>v*.3);
  if(a.decorate&&H&&region!=='eye'&&!KERATIN.has(region))col=a.decorate(H,col);
  // Baked occlusion: close cavities and broad shadowing (between the legs, under the frill).
  let occ=0;for(const [d,w] of [[.006,.32],[.016,.3],[.035,.24],[.07,.14]])occ+=Math.max(0,(d-field(x+nx*d,y+ny*d,z+nz*d))/d)*w;
  col=col.map(v=>v*(1-Math.min(.45,occ*.9)));
  if((region==='toes'||region==='claw')&&y<.05&&!pt.hoof)col=col.map(v=>v*.6);
  color.set([...col.map(v=>Math.round(clamp01(v)*255)),Math.round(clamp01(scale)*255)],i*4);
  normal.set([Math.round(nx*127),Math.round(ny*127),Math.round(nz*127),gloss>0?Math.round(clamp01(gloss)*127):-Math.round(clamp01(tub)*127)],i*4);
  pos[i*3]=q(x,0);pos[i*3+1]=q(y,1);pos[i*3+2]=q(z,2);
 }
 const index=new Uint16Array(I);if(n>65535)throw Error(`${name} ${tier}: too many vertices for 16-bit indices`);
 const arrays=[pos,normal,color,rig,index],entry={name,tier,vertices:n,indices:I.length,offset,bounds:a.bounds,pivots:pivots.map(({part,side,lead,p})=>[part,side,lead,...p])};
 for(const arr of arrays){const b=pad(Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength));out.push(b);offset+=b.length;}
 header.models.push(entry);
 if(tier==='high'){
  // Resting hull for the dead body (extreme surface points about the body centre) and hit spheres.
  const dirs=[];for(const dx of [-1,0,1])for(const dy of [-1,0,1])for(const dz of [-1,0,1])if(dx||dy||dz)dirs.push([dx,dy,dz].map(v=>v/Math.hypot(dx,dy,dz)));
  const hullFrill=[];
  const hull=dirs.map(d=>{let best=-1e9,at=null,weight=0;for(let v=0;v<n;v++){const px=P[v*3],py=P[v*3+1]-a.centre,pz=P[v*3+2],s=px*d[0]+py*d[1]+pz*d[2];if(s>best){best=s;at=[px,py,pz];weight=rig[v*4+3]/255;}}hullFrill.push(weight);return at.map(v=>+v.toFixed(4));});
  header.species[name]={centre:a.centre,quad:!!a.quad,spheres:a.spheres,hull,...(name==='dilophosaurus'?{hullFrill}:{}),eyes:a.eyes,iris:pt.iris,slit:!!pt.slit};
 }
 console.log(`${name} ${tier}: ${n} vertices / ${I.length/3} triangles`);
}
let json=Buffer.from(JSON.stringify(header));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const file=only?'art/review/safari3/partial.bin':'public/models/safari-runners.bin';
writeFileSync(file,Buffer.concat([Buffer.from(new Uint32Array([json.length]).buffer),json,...out]));
console.log(`Safari runners: ${(offset/1e6).toFixed(2)} MB of geometry, both quality tiers → ${file}`);
