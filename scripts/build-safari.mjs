// Original Safari sculpts, baked offline so meshing never costs a game frame.
// SDF loft kit and mesher follow build-brachio.mjs; units share the critter rig
// (bipeds have hips at about 0.31; the game scales each instance to life size).
//
// Six species, two geometry budgets each, in one compact file (format 2):
// positions are quantized to 16 bits inside each model's bounds, normals and
// colours are bytes, the rig is four bytes (part, weight, pivot index), and the
// pivots the rig turns about live in a small per-model table. The loader expands
// them to the float attributes the critter shader reads.
import {writeFileSync} from 'node:fs';
import {edgeTable,triTable} from 'three/addons/objects/MarchingCubes.js';
const len=(x,y,z)=>Math.sqrt(x*x+y*y+z*z);
function smin(a,b,k){if(k<=0)return Math.min(a,b);const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
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
/** Inigo Quilez's rhombus, extruded to a rounded plate: length L and height H (half extents), half thickness t. */
function plate([cx,cy,cz],L,H,t,{pitch=0,yaw=0,round=.004}={}){const f=frame(pitch,yaw);
 return {bound:[cx,cy,cz,Math.max(L,H)+t+round],d(x,y,z){const [a,b,c]=f(x-cx,y-cy,z-cz),px=Math.abs(c),py=Math.abs(b),bx=L,by=H;
  const h=Math.max(-1,Math.min(1,((bx-2*px)*bx-(by-2*py)*by)/(bx*bx+by*by))),qx=px-.5*bx*(1-h),qy=py-.5*by*(1+h);
  const d2=Math.hypot(qx,qy)*Math.sign(px*by+py*bx-bx*by),w=Math.abs(a)-t*(1-.55*Math.min(1,Math.max(0,py/H)));
  return Math.min(Math.max(d2,w),0)+Math.hypot(Math.max(d2,0),Math.max(w,0))-round;}};}
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
 return {top:z=>T(Math.min(z1,Math.max(z0,z)))[0],bound:[0,.3,(z0+z1)/2,(z1-z0)/2+.4],d(x,y,z){
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

// ------------------------------------------------------------------ anatomy --
// Each species adds named groups of primitives. A group can carry `leg` (the pivot it
// swings about, its side and lead: +1 hind, -1 fore) and the rig follows it.
function sculpt(){
 const groups=[];
 const add=(region,prims,blend=.016,internal=.008,leg=null)=>{groups.push({region,prims,blend,internal,leg});};
 const field=(x,y,z,region=false)=>{
  let d=1e6,closest=1e6,which='body',limb=1e6,body=1e6,leg=null,legD=1e6;
  for(const g of groups){let gd=1e6;for(const p of g.prims){const [bx,by,bz,br]=p.bound;if(len(x-bx,y-by,z-bz)-br>Math.max(gd,d)+g.blend+g.internal+.02)continue;gd=smin(gd,p.d(x,y,z),g.internal);}
   if(gd<closest){closest=gd;which=g.region;}if(g.leg){limb=Math.min(limb,gd);if(gd<legD){legD=gd;leg=g.leg;}}else body=Math.min(body,gd);d=smin(d,gd,g.blend);
  }
  d=Math.max(d,-y);return region?{which,leg,limb:smooth(-.025,.025,body-limb)}:d;
 };
 return {add,field};
}
/** Theropod-style runner legs: thigh buried in the ribs, lean knee, long metatarsus and three toes. */
function runnerLegs(add,{hipX=.06,heavy=false,claw=false}){
 for(const side of [-1,1]){
  const leg={pivot:[side*hipX,.31,-.025],side,lead:1};
  add('leg',[uprightLoft([
   [.005,.064,.016,.012,side*.06],[.034,.028,.016,.011,side*.06],
   [.079,-.04,.02,.012,side*.063],[.13,-.015,.017,.013,side*.065],
   [.203,.065,.03,heavy?.036:.027,side*.073],[.267,.025,.06,heavy?.047:.033,side*.075],
   [.332,-.031,.067,heavy?.056:.036,side*(heavy?.09:.064)],[.387,-.047,.04,.025,side*(heavy?.057:.04)]
  ])],.022,0,leg);
  add('toes',[-1,0,1].map(sp=>roundCone([side*.06,.013,.05],[side*.06+sp*.012,.009,.092-Math.abs(sp)*.01],.008,.003)),.006,.003,leg);
  if(claw)add('claw',[roundCone([side*.047,.042,.041],[side*.045,.056,.074],.007,.004),roundCone([side*.045,.056,.074],[side*.045,.04,.09],.004,.001)],.003,.003,leg);
 }
}
function runnerArms(add,{shoulder=[.048,.357,.103],elbow=[.08,.292,.145],hand=[.09,.29,.235],r=[.015,.01]}){
 for(const side of [-1,1]){
  const s=p=>[side*p[0],p[1],p[2]];
  add('arm',[roundCone(s(shoulder),s(elbow),r[0],r[1]),roundCone(s(elbow),s(hand),r[1],.006)],.009,.006);
  for(const spread of [-1,0,1])add('finger',[roundCone(s(hand),[side*hand[0]+spread*.006,hand[1]-.015,hand[2]+.024],.004,.001)],.003,.002);
 }
}
/** Deep skull behind, a wedge snout that narrows to the tip, and a slimmer lower jaw. */
function theropodHead(headY,headZ){
 return [ellipsoid([0,headY+.012,headZ],[.035,.032,.058]),roundCone([0,headY+.004,headZ+.03],[0,headY-.004,headZ+.118],.027,.012,{squeeze:.78}),
  roundCone([0,headY-.02,headZ+.012],[0,headY-.021,headZ+.106],.024,.009,{squeeze:.82}),...[-1,1].map(s=>ellipsoid([s*.026,headY+.022,headZ+.008],[.012,.011,.032],{pitch:.12}))];
}
function theropodNeck(add,headY,thick=1){
 add('neck',[uprightLoft([
  [.315,.095,.037*thick,.028*thick],[.35,.133,.05*thick,.043*thick],
  [.39,.176,.044*thick,.032*thick],[headY-.008,.217,.029*thick,.024*thick],[headY+.025,.271,.036*thick,.026*thick]
 ])],.018,0);
}
const RUNNER_BODY=[[-.8,.325,.322,.001],[-.63,.338,.31,.009],[-.42,.352,.299,.021],[-.24,.397,.263,.046],[-.09,.425,.238,.073],[.055,.416,.25,.068],[.15,.388,.29,.046],[.2,.353,.321,.014]];

const SPECIES={
 // Velociraptor (film scale): slim, long-snouted, the sickle claw held up off the ground.
 raptor(){
  const {add,field}=sculpt(),headY=.422,headZ=.31;
  add('body',[loft(RUNNER_BODY)],0,0);theropodNeck(add,headY);
  add('head',[
   ...theropodHead(headY,headZ)
  ],.009,.008);
  const eye=[.035,headY+.018,headZ+.014];add('eye',[-1,1].map(s=>ellipsoid([s*eye[0],eye[1],eye[2]],[.0065,.008,.009])),.003,.001);
  runnerLegs(add,{claw:true});runnerArms(add,{});
  return {field,eye,headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.32,.41],tail:[-.18,-.76],tailPivot:[0,.33,-.15],centre:.33,
   bounds:[[-.2,-.012,-.85],[.2,.6,.45]],
   paint:{back:[.16,.11,.06],belly:[.42,.36,.26],stripe:[65,.5],face:true,iris:[.36,.21,.035]},
   spheres:[[0,.35,.02,.078],[0,.33,-.12,.07],[0,.43,.29,.05],[0,.33,-.36,.042],[0,.16,0,.06]]};
 },
 // Dilophosaurus: longer neck, twin thin crests running back along the top of the snout.
 dilophosaurus(){
  const {add,field}=sculpt(),headY=.47,headZ=.31;
  add('body',[loft(RUNNER_BODY)],0,0);theropodNeck(add,headY);
  add('head',[
   ...theropodHead(headY,headZ)
  ],.009,.008);
  const eye=[.035,headY+.018,headZ+.014];add('eye',[-1,1].map(s=>ellipsoid([s*eye[0],eye[1],eye[2]],[.0065,.008,.009])),.003,.001);
  // Two semicircular plates on the skull roof, splayed a little, highest over the eyes.
  add('crest',[-1,1].map(s=>ellipsoid([s*.0165,headY+.04,headZ+.05],[.0052,.03,.064],{pitch:-.1,yaw:s*.1})),.005,.001);
  runnerLegs(add,{});runnerArms(add,{});
  return {field,eye,headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.32,.41],tail:[-.18,-.76],tailPivot:[0,.33,-.15],centre:.33,
   bounds:[[-.2,-.012,-.85],[.2,.6,.45]],
   paint:{back:[.07,.12,.075],belly:[.4,.37,.24],stripe:[58,.5],spots:true,crest:[.42,.12,.04],face:true,iris:[.36,.21,.035]},
   spheres:[[0,.35,.02,.078],[0,.33,-.12,.07],[0,.47,.3,.05],[0,.4,.2,.035],[0,.33,-.36,.042],[0,.16,0,.06]]};
 },
 // Parasaurolophus: heavy-hipped, long tube crest swept back from the skull.
 parasaurolophus(){
  const {add,field}=sculpt(),headY=.485,headZ=.285;
  add('body',[loft([[-.8,.32,.316,.001],[-.65,.345,.312,.011],[-.43,.357,.285,.026],[-.27,.406,.232,.06],[-.14,.448,.205,.106],[0,.451,.215,.119],[.12,.408,.252,.089],[.205,.356,.296,.024]])],0,0);
  add('neck',[uprightLoft([[.315,.095,.037,.028],[.35,.133,.057,.05],[.39,.176,.044,.032],[headY-.008,.217,.029,.024],[headY+.025,.271,.036,.026]])],.018,0);
  add('head',[
   ellipsoid([0,headY+.013,headZ],[.035,.032,.06]),ellipsoid([0,headY-.002,headZ+.058],[.032,.018,.055]),
   ellipsoid([0,headY-.023,headZ+.032],[.03,.015,.066]),...[-1,1].map(s=>ellipsoid([s*.027,headY+.024,headZ+.008],[.013,.012,.034],{pitch:.12}))
  ],.009,.008);
  const eye=[.035,headY+.018,headZ+.014];add('eye',[-1,1].map(s=>ellipsoid([s*eye[0],eye[1],eye[2]],[.0065,.008,.009])),.003,.001);
  add('crest',[roundCone([0,headY+.026,headZ],[0,.547,.232],.021,.026),roundCone([0,.547,.232],[0,.548,.135],.026,.019),roundCone([0,.548,.135],[0,.489,.008],.019,.003)],.012,.014);
  runnerLegs(add,{hipX:.084,heavy:true});runnerArms(add,{shoulder:[.063,.357,.103],elbow:[.093,.265,.145],hand:[.08,.192,.2],r:[.02,.014]});
  return {field,eye,headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.32,.41],tail:[-.18,-.76],tailPivot:[0,.33,-.15],centre:.34,
   bounds:[[-.2,-.012,-.85],[.2,.6,.45]],
   paint:{back:[.13,.1,.05],belly:[.38,.32,.2],stripe:[50,.26],crest:[.26,.1,.05],face:true,iris:[.12,.07,.02]},
   spheres:[[0,.34,.0,.11],[0,.34,-.16,.09],[0,.5,.26,.055],[0,.34,-.4,.05],[0,.16,0,.07]]};
 },
 // Pachycephalosaurus: a thick bony dome ringed with knobs, carried low on a short neck.
 pachycephalosaurus(){
  const {add,field}=sculpt(),headY=.415,headZ=.265;
  add('body',[loft([[-.78,.325,.318,.001],[-.62,.34,.306,.012],[-.42,.356,.29,.028],[-.24,.407,.25,.058],[-.09,.438,.222,.088],[.05,.428,.232,.083],[.15,.397,.272,.052],[.2,.36,.31,.017]])],0,0);
  add('neck',[uprightLoft([[.315,.1,.04,.032],[.35,.14,.052,.046],[.385,.18,.046,.036],[headY-.012,.212,.034,.029],[headY+.02,.245,.036,.03]])],.02,0);
  const dome=[0,headY+.03,headZ-.004];
  add('head',[
   ellipsoid([0,headY+.004,headZ],[.034,.03,.05]),ellipsoid([0,headY-.012,headZ+.042],[.021,.018,.037],{pitch:.28}),
   ellipsoid([0,headY-.024,headZ+.02],[.026,.013,.045])
  ],.01,.008);
  add('dome',[sphere(dome,.041),ellipsoid([0,headY+.026,headZ-.02],[.037,.032,.036])],.012,.01);
  // Knobs and short spikes round the back of the dome and on the snout.
  const knobs=[];for(let i=0;i<11;i++){const a=-1.5+i*.3;knobs.push(sphere([Math.sin(a)*.037,headY+.004+Math.abs(Math.sin(a))*.006,headZ-.03-Math.cos(a)*.016],.0072));}
  for(const s of [-1,1])knobs.push(roundCone([s*.024,headY+.018,headZ-.034],[s*.034,headY+.01,headZ-.056],.007,.002),sphere([s*.011,headY+.002,headZ+.07],.005));
  add('knob',knobs,.006,.002);
  const eye=[.031,headY+.011,headZ+.018];add('eye',[-1,1].map(s=>ellipsoid([s*eye[0],eye[1],eye[2]],[.006,.0075,.0085])),.003,.001);
  runnerLegs(add,{hipX:.07,heavy:true});runnerArms(add,{shoulder:[.052,.35,.1],elbow:[.078,.29,.132],hand:[.08,.268,.2],r:[.015,.01]});
  return {field,eye,headY,headZ,biped:true,neckBase:[0,.34,.1],neckY:[.33,.4],tail:[-.18,-.76],tailPivot:[0,.33,-.15],centre:.33,
   bounds:[[-.2,-.012,-.83],[.2,.56,.4]],
   paint:{back:[.19,.12,.06],belly:[.45,.37,.25],stripe:[44,.52],dome:[.48,.41,.3],knob:[.1,.075,.05],iris:[.1,.06,.02]},
   spheres:[[0,.34,.02,.085],[0,.33,-.13,.075],[0,.44,.26,.052],[0,.33,-.37,.045],[0,.16,0,.065]]};
 },
 // Triceratops: barrel body on four pillar legs, a tall epoccipital-edged frill, beak and three horns.
 triceratops(){
  const {add,field}=sculpt();
  add('body',[loft([[-.62,.205,.195,.002],[-.5,.235,.198,.018],[-.36,.29,.205,.042],[-.22,.355,.17,.086],[-.06,.37,.135,.118],[.1,.335,.14,.108],[.2,.3,.185,.074],[.26,.275,.215,.045]])],0,0);
  // The whole head is drawn at 1.2x about the neck joint.
  const K=1.2,P=([x,y,z])=>[x*K,.26+(y-.26)*K,.2+(z-.2)*K],E=(c,r,o)=>ellipsoid(P(c),r.map(v=>v*K),o),R=(a,b,r1,r2,o)=>roundCone(P(a),P(b),r1*K,r2*K,o);
  add('head',[
   E([0,.245,.335],[.05,.056,.085],{pitch:.3}),R([0,.238,.4],[0,.18,.478],.037,.014,{squeeze:.85}),
   ...[-1,1].map(s=>E([s*.036,.22,.34],[.028,.036,.05],{pitch:.25}))
  ],.012,.012);
  add('beak',[R([0,.198,.462],[0,.16,.492],.016,.006),E([0,.166,.485],[.011,.015,.013])],.006,.004);
  add('horn',[R([0,.26,.43],[0,.3,.45],.0135,.004),...[-1,1].flatMap(s=>[R([s*.032,.285,.338],[s*.05,.342,.47],.0145,.003),R([s*.053,.214,.33],[s*.076,.197,.334],.01,.0035)])],.008,.003);
  // The frill rises up and back from the skull; its rim is studded with epoccipitals.
  const F=P([0,.318,.262]),U=[0,Math.cos(.75),-Math.sin(.75)],a=.108*K,b=.104*K;
  add('frill',[ellipsoid(F,[a,b,.012*K],{pitch:-.75})],.02,.006);
  const rim=[];for(let i=0;i<17;i++){const t=-.15+i*(Math.PI+.3)/16,c=Math.cos(t),s=Math.sin(t);rim.push(sphere([c*a*.975,F[1]+U[1]*s*b*.975,F[2]+U[2]*s*b*.975],.0078*K));}
  add('epoc',rim,.006,.003);
  const eye=P([.044,.268,.36]);add('eye',[-1,1].map(s=>ellipsoid([s*eye[0],eye[1],eye[2]],[.006,.007,.009])),.003,.001);
  for(const side of [-1,1]){
   const hind={pivot:[side*.078,.3,-.205],side,lead:1},fore={pivot:[side*.084,.235,.12],side,lead:-1};
   add('leg',[uprightLoft([[.004,-.188,.037,.033,side*.083],[.035,-.198,.03,.027,side*.083],[.1,-.214,.027,.025,side*.082],[.16,-.2,.034,.031,side*.08],[.235,-.21,.062,.047,side*.077],[.31,-.215,.082,.052,side*.07]])],.03,0,hind);
   add('toes',[-.8,-.25,.3,.8].map(sp=>ellipsoid([side*.083+sp*.022,.011,-.16+(1-Math.abs(sp))*.012],[.011,.011,.013])),.008,.004,hind);
   add('leg',[uprightLoft([[.004,.138,.031,.03,side*.1],[.05,.132,.025,.024,side*.1],[.11,.126,.026,.026,side*.104],[.17,.124,.036,.034,side*.098],[.245,.12,.052,.042,side*.084]])],.028,0,fore);
   add('toes',[-.9,-.45,0,.45,.9].map(sp=>ellipsoid([side*.1+sp*.022,.01,.162+(1-Math.abs(sp))*.01],[.009,.01,.011])),.007,.004,fore);
  }
  return {field,eye,headY:.25,headZ:.34,quad:true,neckBase:[0,.26,.2],neckZ:[.19,.3],tail:[-.26,-.62],tailPivot:[0,.3,-.25],centre:.26,
   bounds:[[-.2,-.012,-.66],[.2,.5,.6]],
   paint:{back:[.1,.09,.06],belly:[.3,.27,.19],stripe:[26,.2],frill:[.2,.1,.05],frillRim:[.05,.038,.026],frillCentre:[0,.33,.27],horn:[.5,.45,.34],beak:[.07,.06,.045],epoc:[.1,.08,.055],iris:[.1,.06,.02]},
   spheres:[[0,.26,-.04,.15],[0,.28,-.24,.1],[0,.25,.37,.1],[0,.35,.27,.11],[0,.23,-.43,.05]]};
 },
 // Stegosaurus: high hips and low head, two staggered rows of plates, a four-spiked tail.
 stegosaurus(){
  const {add,field}=sculpt();
  const keys=[[-.62,.2,.195,.002],[-.5,.237,.205,.017],[-.36,.3,.214,.04],[-.22,.37,.198,.07],[-.1,.397,.17,.095],[.02,.372,.155,.094],[.12,.312,.155,.08],[.2,.252,.16,.056],[.26,.218,.165,.036]],body=loft(keys);
  add('body',[body],0,0);
  add('neck',[roundCone([0,.2,.24],[0,.176,.318],.036,.024)],.02,.006);
  add('head',[ellipsoid([0,.168,.352],[.023,.021,.042],{pitch:.25}),ellipsoid([0,.153,.386],[.015,.013,.026],{pitch:.35})],.01,.008);
  const eye=[.02,.176,.356];add('eye',[-1,1].map(s=>ellipsoid([s*eye[0],eye[1],eye[2]],[.005,.006,.007])),.003,.001);
  // Plates: tallest over the hips, alternating either side of the spine, leaning back a little.
  // Kite plates: tallest over the hips, alternating either side of the spine, leaning back a little.
  const plates=[];for(let i=0;i<13;i++){const z=.215-i*.054,bell=Math.exp(-(((z+.1)/.21)**2)),h=.02+.058*bell,s=i%2?1:-1;
   plates.push(plate([s*.011,body.top(z)+h*.5,z],.03+.024*bell,h,.0045,{pitch:-.16,yaw:s*.05}));}
  add('plate',plates,.009,.002);
  add('spike',[-1,1].flatMap(s=>[roundCone([s*.012,.226,-.49],[s*.07,.264,-.515],.012,.0035),roundCone([s*.01,.214,-.545],[s*.062,.248,-.588],.011,.003)]),.007,.002);
  for(const side of [-1,1]){
   const hind={pivot:[side*.068,.34,-.15],side,lead:1},fore={pivot:[side*.07,.2,.17],side,lead:-1};
   add('leg',[uprightLoft([[.004,-.128,.032,.028,side*.073],[.05,-.14,.024,.022,side*.073],[.12,-.158,.024,.022,side*.072],[.19,-.14,.032,.028,side*.07],[.27,-.15,.056,.041,side*.068],[.34,-.155,.07,.046,side*.06]])],.03,0,hind);
   add('toes',[-.7,0,.7].map(sp=>ellipsoid([side*.073+sp*.019,.01,-.1+(1-Math.abs(sp))*.01],[.01,.01,.013])),.007,.004,hind);
   add('leg',[uprightLoft([[.004,.182,.027,.025,side*.079],[.05,.176,.022,.02,side*.079],[.1,.171,.024,.022,side*.078],[.15,.172,.032,.028,side*.074],[.205,.17,.042,.034,side*.066]])],.026,0,fore);
   add('toes',[-.8,-.27,.27,.8].map(sp=>ellipsoid([side*.079+sp*.018,.009,.2+(1-Math.abs(sp))*.008],[.008,.009,.01])),.006,.004,fore);
  }
  return {field,eye,top:z=>body.top(z),headY:.17,headZ:.38,quad:true,neckBase:[0,.2,.22],neckZ:[.21,.31],tail:[-.18,-.62],tailPivot:[0,.33,-.18],centre:.27,
   bounds:[[-.17,-.012,-.66],[.17,.54,.47]],
   paint:{back:[.1,.11,.055],belly:[.36,.33,.2],stripe:[30,.26],plate:[.42,.13,.05],plateEdge:[.52,.32,.12],spike:[.5,.44,.32],iris:[.1,.06,.02]},
   spheres:[[0,.29,-.06,.13],[0,.33,-.2,.1],[0,.44,-.12,.07],[0,.17,.37,.05],[0,.23,-.45,.05]]};
 },
};

// ---------------------------------------------------------------------- bake --
const out=[],header={version:2,models:[],species:{}};let offset=0;
const pad=b=>b.length%4?Buffer.concat([b,Buffer.alloc(4-b.length%4)]):b;
for(const name of Object.keys(SPECIES))for(const tier of ['high','low']){
 const a=SPECIES[name](),{field,eye,headY,headZ,paint:pt}=a,vox=tier==='high'?.0075:.0115,{positions:P,normals:N,indices:I}=mesh(field,vox,a.bounds),n=P.length/3;
 const pivots=[],pivotIndex=(part,side,lead,p)=>{const key=[part,side,lead,...p].join();let i=pivots.findIndex(q=>q.key===key);if(i<0){i=pivots.length;pivots.push({key,part,side,lead,p});}return i;};
 const rig=new Uint8Array(n*4),color=new Uint8Array(n*4),normal=new Int8Array(n*4),pos=new Int16Array(n*3+(n*3)%2);
 const [lo,hi]=a.bounds,q=(v,i)=>Math.round(((v-lo[i])/(hi[i]-lo[i]))*65535-32768);
 const tail=a.tail;
 for(let i=0;i<n;i++){
  const x=P[i*3],y=P[i*3+1],z=P[i*3+2],nx=N[i*3],ny=N[i*3+1],nz=N[i*3+2],f=field(x,y,z,true),side=Math.sign(x)||1;
  let part=0,weight=0,piv=pivotIndex(0,0,1,[0,0,0]);
  const head=!['body','leg','toes','claw','arm','finger','plate','spike'].includes(f.which);
  // Continuous weights fade limb, neck and tail deformation into the shared torso.
  if(['leg','toes','claw'].includes(f.which)||a.biped&&y<.24&&z<.16){const leg=f.leg;part=3;weight=Math.max(0,Math.min(1,(leg.pivot[1]-y)/leg.pivot[1]))*f.limb;piv=pivotIndex(3,leg.side,leg.lead,leg.pivot);}
  else if(z<tail[0]&&(f.which==='body'||f.which==='spike'||f.which==='plate'&&z<tail[0]-.05)){part=2;weight=smooth(tail[0]+.01,tail[1],z);piv=pivotIndex(2,0,1,a.tailPivot);}
  else if(head){part=1;weight=a.neckY?smooth(a.neckY[0],a.neckY[1],y):['frill','epoc'].includes(f.which)?1:smooth(a.neckZ[0],a.neckZ[1],z);piv=pivotIndex(1,0,1,a.neckBase);}
  else if(a.neckZ&&z>a.neckZ[0]&&f.which==='body'){part=1;weight=smooth(a.neckZ[0],a.neckZ[1],z);piv=pivotIndex(1,0,1,a.neckBase);}
  rig.set([part,Math.round(weight*255),piv,0],i*4);
  // Hide: dorsal colour over a pale belly, banded, baked cavity shading, then the special regions.
  const region=f.which,limb=['leg','toes'].includes(region);
  const dorsal=a.quad?(limb?.9:smooth(-.6,-.05,ny)*smooth(.1,.22,y)):smooth(.22,.4,y)*smooth(-.5,.2,ny);
  let col=mix(pt.belly,pt.back,dorsal);if(a.quad&&limb)col=col.map(v=>v*(.78+.22*smooth(.02,.2,y)));
  const [freq,depth]=pt.stripe,stripe=smooth(.26,.75,Math.sin(z*freq+Math.sin(y*45)*1.2+Math.abs(x)*12))*(a.quad?smooth(.15,.3,y):smooth(.22,.36,y));
  col=col.map(v=>v*(1-stripe*depth));
  if(pt.spots){const s=Math.sin(x*190+z*37)*Math.sin(z*150+y*61)*Math.sin(y*170+x*40);if(s>.35)col=col.map(v=>v*.62);}
  let occ=0;for(const d of [.008,.02,.04])occ+=Math.max(0,(d-field(x+nx*d,y+ny*d,z+nz*d))/d)/3;
  col=col.map(v=>v*(1-Math.min(.45,occ*.7)));
  const speckle=((Math.sin(x*357+y*299+z*151)*43758.5)%1+1)%1;col=col.map(v=>v*(.93+speckle*.07));
  if(region==='crest'&&pt.crest)col=pt.crest.map(v=>v*(.7+.3*smooth(headY+.02,headY+.08,y)));
  if(region==='dome'&&pt.dome)col=mix(col,pt.dome,smooth(.2,.75,ny)).map(v=>v*(.92+speckle*.12));
  if(region==='knob'&&pt.knob)col=pt.knob;
  if(region==='frill'&&pt.frill){
   // A dark rim band, pale fenestra marks and a warm centre.
   const [,fy,fz]=pt.frillCentre,r=Math.hypot(x/.13,(y-fy)/.12,(z-fz)/.12);col=mix(mix(pt.back,pt.frill,smooth(.25,.5,r)),pt.frillRim,smooth(.78,.95,r)).map(v=>v*(.86+.14*Math.sin(x*80)*Math.sin(y*70)));}
  if(region==='epoc'&&pt.epoc)col=pt.epoc;
  if(region==='horn'&&pt.horn)col=mix(pt.horn,[.1,.08,.06],smooth(.25,.34,y+Math.abs(x)*.4)*.6);
  if(region==='beak'&&pt.beak)col=pt.beak;
  if(region==='plate'&&pt.plate){const up=y-a.top(z);col=mix(mix([.07,.05,.03],pt.plate,smooth(.012,.045,up)),pt.plateEdge,smooth(.06,.11,up)).map(v=>v*(.88+.12*Math.sin(z*300+y*120)));}
  if(region==='spike'&&pt.spike)col=mix(pt.spike,[.1,.08,.06],smooth(.5,1,Math.abs(x)/.06));
  if((region==='toes'||region==='claw'||region==='finger')&&y<.075)col=[.032,.024,.016];
  const ex=(Math.abs(x)-eye[0])/.009,ey=(y-eye[1])/.01,ez=(z-eye[2])/.013;
  if(ex*ex+ey*ey+ez*ez<1.35){col=pt.iris||[.36,.21,.035];if(ey*ey+ez*ez<.27)col=[.003,.004,.002];}
  // Thin mouth seam and nostril in the skull, not a separate open-ended tube.
  if(pt.face){if(z>headZ+.014&&z<headZ+.11&&Math.abs(y-(headY-.016))<.0024&&Math.abs(x)>.017)col=[.028,.019,.012];
   if(Math.hypot((Math.abs(x)-.021)*1.3,y-(headY+.003),z-(headZ+.083))<.0045)col=[.015,.012,.008];}
  color.set([...col.map(v=>Math.round(Math.max(0,Math.min(1,v))*255)),255],i*4);normal.set([Math.round(nx*127),Math.round(ny*127),Math.round(nz*127),0],i*4);
  pos[i*3]=q(x,0);pos[i*3+1]=q(y,1);pos[i*3+2]=q(z,2);
 }
 const index=new Uint16Array(I);if(n>65535)throw Error(`${name} ${tier}: too many vertices for 16-bit indices`);
 const arrays=[pos,normal,color,rig,index],entry={name,tier,vertices:n,indices:I.length,offset,bounds:a.bounds,pivots:pivots.map(({part,side,lead,p})=>[part,side,lead,...p])};
 for(const arr of arrays){const b=pad(Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength));out.push(b);offset+=b.length;}
 header.models.push(entry);
 if(tier==='high'){
  // Resting hull for the dead body (extreme surface points about the body centre) and hit spheres.
  const dirs=[];for(const dx of [-1,0,1])for(const dy of [-1,0,1])for(const dz of [-1,0,1])if(dx||dy||dz)dirs.push([dx,dy,dz].map(v=>v/Math.hypot(dx,dy,dz)));
  const hull=dirs.map(d=>{let best=-1e9,at=null;for(let v=0;v<n;v++){const px=P[v*3],py=P[v*3+1]-a.centre,pz=P[v*3+2],s=px*d[0]+py*d[1]+pz*d[2];if(s>best){best=s;at=[px,py,pz];}}return at.map(v=>+v.toFixed(4));});
  header.species[name]={centre:a.centre,quad:!!a.quad,spheres:a.spheres,hull};
 }
 console.log(`${name} ${tier}: ${n} vertices / ${I.length/3} triangles`);
}
let json=Buffer.from(JSON.stringify(header));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
writeFileSync('public/models/safari-runners.bin',Buffer.concat([Buffer.from(new Uint32Array([json.length]).buffer),json,...out]));
console.log(`Safari runners: ${(offset/1e6).toFixed(2)} MB of geometry, both quality tiers.`);
