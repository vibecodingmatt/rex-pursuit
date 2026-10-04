import * as T from 'three';
import {addRim} from './light.js';

// Lost Circuit's Mosasaurus (A12), sculpted by scripts/build-mosa.mjs; boss-mosa.js directs her.
// The vertex shader swims her (a lateral wave that grows toward the tail), strokes the paddles
// about their roots, arches the spine for a breach and opens the lower jaw about its hinge by the
// baked jaw weight. The fragment shader paints a wet, countershaded hide, a pink mouth, ivory
// teeth and an amber eye. All inputs are model-local; the bin format is ichthy.js's.

function parse(buffer){
 const n=new Uint32Array(buffer,0,1)[0],header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,n)));let o=4+n;
 const take=(Type,count)=>{const a=new Type(buffer,o,count);o+=a.byteLength;o+=(4-o%4)%4;return a;};
 const V=header.vertices,pos=take(Float32Array,V*3),nrm=take(Int8Array,V*4),aux=take(Uint8Array,V*4),index=take(V>65535?Uint32Array:Uint16Array,header.indices);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
 g.setAttribute('normal',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(nrm,4),3,0,true));
 g.setAttribute('aux',new T.BufferAttribute(aux,4,true));g.setIndex(new T.BufferAttribute(index,1));
 g.computeBoundingSphere();g.boundingSphere.radius+=1;g.userData.shared=true;return{geometry:g,header};
}
const models={};
export function loadMosa(file='mosa.bin'){return models[file]??=fetch('./models/'+file).then(r=>{if(!r.ok)throw Error(file+' '+r.status);return r.arrayBuffer();}).then(parse);}

const v3=a=>`vec3(${a.map(x=>(+x).toFixed(3)).join(',')})`;
const pose=h=>`
 attribute vec4 aux;uniform float uSwim,uAmp,uStroke,uJaw,uArch;varying vec4 vAux;varying vec3 vModel,vModelN;
 void mosaPose(inout vec3 p,inout vec3 n){
  float region=floor(aux.z*255.+.5);
  // The lower jaw drops about its hinge, all of it but a fade at the back of the mouth.
  if(aux.w>.004){float a=uJaw*aux.w,c=cos(a),s=sin(a);vec2 q=p.yz-${v3(h.hinge)}.yz;p.yz=${v3(h.hinge)}.yz+vec2(c*q.x-s*q.y,s*q.x+c*q.y);n.yz=vec2(c*n.y-s*n.z,s*n.y+c*n.z);}
  // Fore (4) and hind (5) paddles stroke about their roots, the far edge most.
  if(region>3.5&&region<5.5){bool fore=region<4.5;float side=p.x<0.?-1.:1.;vec2 piv=fore?vec2(side*${(+h.fore.pivot[0]).toFixed(3)},${(+h.fore.pivot[1]).toFixed(3)}):vec2(side*${(+h.hind.pivot[0]).toFixed(3)},${(+h.hind.pivot[1]).toFixed(3)});
   float w=clamp((abs(p.x)-abs(piv.x))/.45,0.,1.),a=side*(fore?.4:.28)*sin(uStroke+(fore?0.:1.9))*w,c=cos(a),s=sin(a);
   vec2 q=p.xy-piv;p.xy=piv+vec2(c*q.x-s*q.y,s*q.x+c*q.y);n.xy=vec2(c*n.x-s*n.y,s*n.x+c*n.y);}
  // Arch: the spine bows (positive lifts the middle), the tail most.
  float az=p.z<0.?p.z/3.8:p.z/2.5;p.y-=uArch*az*az*(p.z<0.?1.:.55);
  // The swimming wave: lateral, travelling tailward and growing toward the fin.
  float s=clamp((.6-p.z)/4.35,0.,1.),A=uAmp*(.05+.95*s*s),dA=p.z<.6&&p.z>-3.75?-uAmp*1.9*s/4.35:0.,k=1.55,ph=uSwim-p.z*k;
  float slope=dA*sin(ph)-A*k*cos(ph),t=atan(slope),c=cos(t),sn=sin(t);
  p.x+=A*sin(ph);n.xz=vec2(c*n.x+sn*n.z,-sn*n.x+c*n.z);
 }`;
const SKIN=h=>`
 varying vec4 vAux;varying vec3 vModel,vModelN;
 float mosaNoise(vec3 p){return sin(p.x*7.1+sin(p.z*3.3))*sin(p.y*6.3+p.z*1.7)*sin(p.z*5.9+p.x*2.3);}
 float mosaMouth(float z){return ${(+h.mouth[0]).toFixed(3)}+${(+h.mouth[1]).toFixed(3)}*(z-${(+h.mouth[2]).toFixed(3)});}`;

function makeMaterial(uniforms,header){
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.3,metalness:0}),POSE=pose(header);
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>'+POSE)
   .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n{vec3 p=position;mosaPose(p,objectNormal);}')
   .replace('#include <begin_vertex>','#include <begin_vertex>\n{vec3 n=normal;mosaPose(transformed,n);vModel=position;vModelN=normal;vAux=aux;}');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>'+SKIN(header))
   .replace('#include <color_fragment>',`#include <color_fragment>
    {float region=floor(vAux.z*255.+.5),top=smoothstep(-.35,.35,vModelN.y*.8+vModel.y*1.4),n=mosaNoise(vModel*1.6),fine=mosaNoise(vModel*11.+3.);
     // Countershaded: a dark slate back, blue-grey flanks with darker mottling, a pale belly and throat.
     vec3 back=vec3(.03,.045,.055),flank=vec3(.11,.14,.15),belly=vec3(.5,.5,.46);
     vec3 col=mix(belly,mix(flank,back,smoothstep(.55,1.,top)),smoothstep(0.,.5,top));
     col*=1.+.18*n*top+.07*fine;col=mix(col,back*.6,smoothstep(.3,.7,n)*smoothstep(.2,.6,top)*.6);
     // Scute rows: a faint crosshatch that reads as wet scales up close.
     col*=1.-.08*smoothstep(.6,.95,abs(sin(vModel.z*40.+vModel.y*9.)*sin(vModel.x*38.-vModel.y*7.)));
     if(region>2.5&&region<5.5)col*=.75;
     // Inside the mouth: the palate above the mouth line and the floor of the jaw, gums along the edges.
     float m=mosaMouth(vModel.z);
     if(region>.5&&region<2.5&&vModel.z>1.12){float inside=region<1.5?smoothstep(.3,.7,-vModelN.y)*(1.-smoothstep(m+.012,m+.05,vModel.y)):smoothstep(.3,.7,vModelN.y)*smoothstep(m-.1,m-.04,vModel.y);
      col=mix(col,vec3(.34,.07,.07)*(1.+.3*fine),inside);}
     // Skin only partly carried by the jaw stretches across the back of the gape: dark, wet throat.
     col=mix(col,vec3(.09,.015,.015),smoothstep(.02,.12,vAux.w)*(1.-smoothstep(.88,.98,vAux.w)));
     if(region>6.5)col=vec3(.62,.58,.47);
     // The eye: a black slit in amber.
     if(region>5.5&&region<6.5){vec2 e=vec2(vModel.y-.12,vModel.z-1.36);float r=length(e/vec2(.06,.08));col=mix(vec3(.55,.36,.08),vec3(.01),step(abs(e.y),.012)+smoothstep(.8,1.,r));}
     col*=mix(.3,1.,vAux.x)*(1.-vAux.y*.45);diffuseColor.rgb=col;}`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    {float region=floor(vAux.z*255.+.5);roughnessFactor=vAux.w>.02&&vAux.w<.95?.15:region>5.5&&region<6.5?.05:region>6.5?.3:mix(.4,.18,smoothstep(-.2,.4,vModelN.y));}`);
 };
 m.customProgramCacheKey=()=>'arcade-mosa-v1';addRim(m);
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
 depth.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>'+POSE).replace('#include <begin_vertex>','#include <begin_vertex>\n{vec3 n=normal;mosaPose(transformed,n);}');};
 depth.customProgramCacheKey=()=>'arcade-mosa-depth-v1';
 return{material:m,depth};
}

/** The Mosasaurus mesh; `pose(swim, amp, stroke, jaw, arch)` drives the shader. */
export function createMosa({geometry,header}){
 const uniforms={uSwim:{value:0},uAmp:{value:.1},uStroke:{value:0},uJaw:{value:0},uArch:{value:0}},{material,depth}=makeMaterial(uniforms,header);
 const mesh=new T.Mesh(geometry,material);mesh.customDepthMaterial=depth;mesh.castShadow=true;mesh.receiveShadow=true;mesh.rotation.order='YXZ';mesh.userData.creature=true;mesh.name='Mosasaurus';mesh.frustumCulled=false;
 mesh.userData.pose=(swim,amp,stroke,jaw,arch)=>{uniforms.uSwim.value=swim;uniforms.uAmp.value=amp;uniforms.uStroke.value=stroke;uniforms.uJaw.value=jaw;uniforms.uArch.value=arch;};
 mesh.userData.header=header;return mesh;
}
