import * as T from 'three';
import {addRim} from './light.js';

// Lost Circuit's ichthyosaur, sculpted by scripts/build-ichthy.mjs. The vertex shader
// swims it: a lateral spine wave that grows toward the tail and flipper strokes about
// their roots (region baked per vertex). The fragment shader paints a wet, countershaded
// hide with mottling, a toothed mouth line and a ringed eye. All inputs are model-local.

/** ichthy.bin: u32 header length, JSON header, then position f32x3, normal i8x4, aux u8x4, indices. */
function parse(buffer){
 const n=new Uint32Array(buffer,0,1)[0],header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,4,n)));let o=4+n;
 const take=(Type,count)=>{const a=new Type(buffer,o,count);o+=a.byteLength;o+=(4-o%4)%4;return a;};
 const V=header.vertices,pos=take(Float32Array,V*3),nrm=take(Int8Array,V*4),aux=take(Uint8Array,V*4),index=take(V>65535?Uint32Array:Uint16Array,header.indices);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
 g.setAttribute('normal',new T.InterleavedBufferAttribute(new T.InterleavedBuffer(nrm,4),3,0,true));
 g.setAttribute('aux',new T.BufferAttribute(aux,4,true));g.setIndex(new T.BufferAttribute(index,1));
 g.computeBoundingSphere();g.boundingSphere.radius+=.6;g.userData.shared=true;return{geometry:g,header};
}
const models={};
export function loadIchthy(file='ichthy.bin'){return models[file]??=fetch('./models/'+file).then(r=>{if(!r.ok)throw Error(file+' '+r.status);return r.arrayBuffer();}).then(parse);}

const POSE=`
 attribute vec4 aux;uniform float uSwim,uAmp,uStroke;varying vec4 vAux;varying vec3 vModel,vModelN;
 void ichthyPose(inout vec3 p,inout vec3 n){
  float region=floor(aux.z*255.+.5);
  // Fore (4) and hind (5) flippers stroke about their roots, the far edge most.
  if(region>3.5&&region<5.5){bool fore=region<4.5;float side=p.x<0.?-1.:1.;vec2 piv=fore?vec2(side*.28,-.24):vec2(side*.18,-.26);
   float w=clamp((abs(p.x)-abs(piv.x))/.35,0.,1.),a=side*(fore?.34:.24)*sin(uStroke+(fore?0.:1.7))*w,c=cos(a),s=sin(a);
   vec2 q=p.xy-piv;p.xy=piv+vec2(c*q.x-s*q.y,s*q.x+c*q.y);n.xy=vec2(c*n.x-s*n.y,s*n.x+c*n.y);}
  // The spine wave: lateral, travelling tailward and growing toward the fluke.
  float s=clamp((.35-p.z)/2.9,0.,1.),A=uAmp*(.08+.92*s*s),dA=p.z<.35&&p.z>-2.55?-uAmp*1.84*s/2.9:0.,k=2.2,ph=uSwim-p.z*k;
  float slope=dA*sin(ph)-A*k*cos(ph),t=atan(slope),c=cos(t),sn=sin(t);
  p.x+=A*sin(ph);n.xz=vec2(c*n.x+sn*n.z,-sn*n.x+c*n.z);
 }`;
const SKIN=`
 varying vec4 vAux;varying vec3 vModel,vModelN;
 float ichthyNoise(vec3 p){return sin(p.x*7.1+sin(p.z*3.3))*sin(p.y*6.3+p.z*1.7)*sin(p.z*5.9+p.x*2.3);}`;

function makeMaterial(uniforms){
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.32,metalness:0});
 m.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>'+POSE)
   .replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\n{vec3 p=position;ichthyPose(p,objectNormal);}')
   .replace('#include <begin_vertex>','#include <begin_vertex>\n{vec3 n=normal;ichthyPose(transformed,n);vModel=transformed;vModelN=n;vAux=aux;}');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>'+SKIN)
   .replace('#include <color_fragment>',`#include <color_fragment>
    {float region=floor(vAux.z*255.+.5),top=smoothstep(-.3,.32,vModelN.y*.75+vModel.y*1.2),n=ichthyNoise(vModel*1.8),fine=ichthyNoise(vModel*9.+3.);
     vec3 back=vec3(.055,.1,.13),flank=vec3(.2,.27,.29),belly=vec3(.66,.67,.62);
     vec3 col=mix(belly,mix(flank,back,smoothstep(.55,1.,top)),smoothstep(0.,.55,top));
     col*=1.+.16*n*top+.06*fine;col=mix(col,back*.7,smoothstep(.35,.7,n)*top*.55);
     // Fins and flippers darken toward their trailing edges.
     if(region>1.5&&region<5.5)col*=.72;
     // A toothed mouth line along the rostrum.
     if(region>.5&&region<1.5&&vModel.z>1.28){float y=-.03-(vModel.z-1.28)*.02,line=1.-smoothstep(.006,.014,abs(vModel.y-y));
      float teeth=step(.55,sin(vModel.z*95.))*(1.-smoothstep(.0,.012,abs(vModel.y-y+.008)));col=mix(col,vec3(.03),line*.85);col=mix(col,vec3(.82,.8,.7),teeth*.8);}
     // The huge eye: dark lens inside a pale sclerotic ring.
     if(region>5.5){float r=length(vModel.yz-vec2(.115,1.2))/.1;col=mix(vec3(.01,.012,.014),vec3(.5,.43,.28),smoothstep(.55,.75,r));}
     col*=mix(.32,1.,vAux.x)*(1.-vAux.y*.45);diffuseColor.rgb=col;}`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n roughnessFactor=floor(vAux.z*255.+.5)>5.5?.06:mix(.42,.2,smoothstep(-.2,.4,vModelN.y));');
 };
 m.customProgramCacheKey=()=>'arcade-ichthy-v1';addRim(m);
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
 depth.onBeforeCompile=s=>{Object.assign(s.uniforms,uniforms);s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>'+POSE).replace('#include <begin_vertex>','#include <begin_vertex>\n{vec3 n=normal;ichthyPose(transformed,n);}');};
 depth.customProgramCacheKey=()=>'arcade-ichthy-depth-v1';
 return{material:m,depth};
}

/** One swimming ichthyosaur. Each has its own uniforms, so each gets its own material (same program). */
export function createIchthy({geometry}){
 const uniforms={uSwim:{value:0},uAmp:{value:.12},uStroke:{value:0}},{material,depth}=makeMaterial(uniforms);
 const mesh=new T.Mesh(geometry,material);mesh.customDepthMaterial=depth;mesh.castShadow=true;mesh.receiveShadow=true;mesh.rotation.order='YXZ';mesh.userData.creature=true;mesh.name='Ichthyosaur';
 mesh.userData.swim=(swim,amp,stroke)=>{uniforms.uSwim.value=swim;uniforms.uAmp.value=amp;uniforms.uStroke.value=stroke;};
 return mesh;
}
