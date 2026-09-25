import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
// Procedural rainforest kit: painted textures, plant geometry and a shared
// wind/translucency shader. Everything is deterministic from its seed, built
// once at load, and instanced by the scenery.

import {WET,WIND_GUST,NIGHT} from './weather-state.js';
import {AO_MASK} from './post.js';
export const WIND={value:0};
// Share of each chunk's grass capacity the quality tier draws, 0..1.
export const GRASS_DENSITY={value:1};
export function seeded(seed){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
const canvas=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function texture(c,{srgb=true,repeat=false,aniso=8}={}){const t=new T.CanvasTexture(c);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=aniso;return t;}
/** Tangent-space normal map from a tileable luminance height canvas. */
function normalMap(source,strength=2){
 const w=source.width,h=source.height,src=source.getContext('2d').getImageData(0,0,w,h).data,out=canvas(w,h),ctx=out.getContext('2d'),img=ctx.createImageData(w,h);
 const H=(x,y)=>src[(((y+h)%h)*w+((x+w)%w))*4]/255;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=(H(x+1,y)-H(x-1,y))*strength,dy=(H(x,y+1)-H(x,y-1))*strength,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;
  img.data[i]=(-dx/l*.5+.5)*255;img.data[i+1]=(dy/l*.5+.5)*255;img.data[i+2]=(1/l*.5+.5)*255;img.data[i+3]=255;
 }
 ctx.putImageData(img,0,0);return texture(out,{srgb:false,repeat:true});
}
const mixHex=(a,b,t)=>{const A=new T.Color(a),B=new T.Color(b);return '#'+A.lerp(B,t).getHexString();};

// ---------------------------------------------------------------- textures --
function frondTexture(kind){
 const rand=seeded(kind==='palm'?311:127),c=canvas(512,1024),x=c.getContext('2d');
 const pairs=kind==='palm'?42:24,base=kind==='palm'?'#35521f':'#29451a',tip=kind==='palm'?'#8aa24c':'#6f9437';
 x.lineCap='round';
 for(let side of [-1,1])for(let i=0;i<pairs;i++){
  const t=(i+.5+(side>0?.35:0))/pairs,y=1000-t*975,profile=Math.pow(Math.sin(Math.PI*(.1+.9*t)),kind==='palm'?.55:.8)*(1-t*.3);
  const length=(kind==='palm'?248:228)*profile+8,angle=(kind==='palm'?.62:.95)-t*.25+(rand()-.5)*.1,width=(kind==='palm'?11:19)*(.55+.45*profile);
  const ex=256+side*Math.sin(angle)*length,ey=y-Math.cos(angle)*length*(kind==='palm'?.72:.55),droop=kind==='palm'?length*.18:length*.06;
  const g=x.createLinearGradient(256,y,ex,ey);g.addColorStop(0,mixHex(base,tip,t*.5));g.addColorStop(1,mixHex(base,tip,.45+t*.55+rand()*.12));x.fillStyle=g;
  // Leaflet: lanceolate blade, lobed for fern pinnae, drooping for palm leaflets.
  x.beginPath();const steps=18,pts=[];
  for(let s=0;s<=steps;s++){const u=s/steps,px=256+(ex-256)*u,py=y+(ey-y)*u+droop*u*u,w=width*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.08)),.7)*(kind==='fern'?1+.28*Math.abs(Math.sin(u*9*Math.PI)):1);pts.push([px,py,w]);}
  const nx=-(ey-y),ny=ex-256,nl=Math.hypot(nx,ny);
  pts.forEach(([px,py,w],k)=>{const X=px+nx/nl*w*.5,Y=py+ny/nl*w*.5;k?x.lineTo(X,Y):x.moveTo(X,Y);});
  for(let k=pts.length-1;k>=0;k--){const [px,py,w]=pts[k];x.lineTo(px-nx/nl*w*.5,py-ny/nl*w*.5);}
  x.closePath();x.fill();
  x.strokeStyle='rgba(205,220,140,.32)';x.lineWidth=1.2;x.beginPath();x.moveTo(256,y);pts.forEach(([px,py])=>x.lineTo(px,py));x.stroke();
  if(kind==='palm'&&rand()<.18){x.fillStyle='rgba(120,92,48,.55)';x.beginPath();const [px,py]=pts[pts.length-2];x.arc(px,py,width*.6,0,7);x.fill();}
 }
 const g=x.createLinearGradient(0,1010,0,20);g.addColorStop(0,'#4a3f25');g.addColorStop(1,'#6e7f3a');x.strokeStyle=g;
 for(let k=0;k<3;k++){x.lineWidth=[7,4,1.6][k];x.globalAlpha=[1,.9,.5][k];x.beginPath();x.moveTo(256,1015);x.quadraticCurveTo(252,500,256,18);x.stroke();}
 x.globalAlpha=1;return texture(c);
}
function broadleafTexture(){
 const rand=seeded(4471),c=canvas(1024,512),x=c.getContext('2d');
 // Left: heart-shaped elephant ear. Right: long, split banana/heliconia blade.
 const leaf=(ox,shape)=>{
  x.save();x.translate(ox,0);x.beginPath();
  if(shape==='heart'){x.moveTo(256,470);x.bezierCurveTo(70,500,8,250,120,120);x.bezierCurveTo(170,52,226,36,256,14);x.bezierCurveTo(286,36,342,52,392,120);x.bezierCurveTo(504,250,442,500,256,470);}
  else{x.moveTo(256,500);x.bezierCurveTo(150,430,138,120,250,10);x.lineTo(262,10);x.bezierCurveTo(374,120,362,430,256,500);}
  x.closePath();
  const g=x.createRadialGradient(256,300,20,256,260,300);g.addColorStop(0,shape==='heart'?'#5f8a34':'#6b8f36');g.addColorStop(.7,'#3d6424');g.addColorStop(1,'#2b4b1a');x.fillStyle=g;x.fill();x.clip();
  for(let i=0;i<900;i++){x.fillStyle=`rgba(${rand()<.5?'20,40,10':'150,180,90'},${rand()*.07})`;x.fillRect(rand()*512,rand()*512,rand()*14,rand()*3);}
  x.strokeStyle='rgba(215,230,160,.55)';x.lineWidth=5;x.beginPath();x.moveTo(256,500);x.lineTo(256,12);x.stroke();
  for(let i=0;i<(shape==='heart'?11:24);i++){const y=470-i*(shape==='heart'?38:20);for(const s of [-1,1]){x.lineWidth=shape==='heart'?2.2:1.2;x.strokeStyle='rgba(200,220,150,.35)';x.beginPath();x.moveTo(256,y);x.quadraticCurveTo(256+s*90,y-(shape==='heart'?40:8),256+s*250,y-(shape==='heart'?95:30));x.stroke();}}
  if(shape==='banana')for(let i=0;i<7;i++){const y=60+rand()*400,s=rand()<.5?-1:1;x.globalCompositeOperation='destination-out';x.lineWidth=2+rand()*2;x.beginPath();x.moveTo(256+s*(30+rand()*40),y);x.lineTo(256+s*260,y-30);x.stroke();x.globalCompositeOperation='source-over';}
  x.restore();
 };
 leaf(0,'heart');leaf(512,'banana');return texture(c);
}
function barkTextures(){
 const rand=seeded(8827),c=canvas(512),x=c.getContext('2d');
 x.fillStyle='#8a8272';x.fillRect(0,0,512,512);
 for(let i=0;i<5200;i++){const l=rand();x.fillStyle=`rgba(${l>.5?'170,160,140':'40,34,28'},${rand()*.12})`;x.fillRect(rand()*512,rand()*512,rand()*3+1,rand()*22+2);}
 // Vertical fissures wrap across the tile edges.
 for(let i=0;i<70;i++){let px=rand()*512;const w=1+rand()*4.5,dark=20+rand()*30;x.strokeStyle=`rgba(${dark},${dark*.9},${dark*.75},${.55+rand()*.4})`;x.lineWidth=w;x.beginPath();x.moveTo(px,-10);for(let y=-10;y<=522;y+=16){px+=(rand()-.5)*6;x.lineTo(px,y);}x.stroke();x.save();x.translate(px>256?-512:512,0);x.stroke();x.restore();}
 for(let i=0;i<60;i++){const px=rand()*512,py=rand()*512,r=4+rand()*18;x.fillStyle=`rgba(${rand()<.6?'196,202,170':'120,150,80'},${.25+rand()*.35})`;x.beginPath();x.ellipse(px,py,r,r*(.6+rand()*.6),rand()*3,0,7);x.fill();}
 const map=texture(c,{repeat:true});
 return{map,normal:normalMap(c,3.2)};
}
function groundTextures(){
 const rand=seeded(2231),dirt=canvas(512),d=dirt.getContext('2d');
 d.fillStyle='#808080';d.fillRect(0,0,512,512);
 const wrap=(fn)=>{for(const ox of [-512,0,512])for(const oy of [-512,0,512]){d.save();d.translate(ox,oy);fn();d.restore();}};
 for(let i=0;i<60000;i++){const v=90+rand()*80;d.fillStyle=`rgba(${v},${v},${v},.18)`;d.fillRect(rand()*512,rand()*512,1+rand()*2,1+rand()*2);}
 for(let i=0;i<900;i++){const px=rand()*512,py=rand()*512,r=1.2+rand()*rand()*9,v=150+rand()*80;wrap(()=>{d.fillStyle=`rgba(30,30,30,.5)`;d.beginPath();d.ellipse(px+1,py+1.5,r,r*.75,0,0,7);d.fill();d.fillStyle=`rgb(${v},${v},${v})`;d.beginPath();d.ellipse(px,py,r,r*.72,rand()*3,0,7);d.fill();});}
 for(let i=0;i<40;i++){let px=rand()*512,py=rand()*512;d.strokeStyle='rgba(20,20,20,.45)';d.lineWidth=.6+rand()*1.4;d.beginPath();d.moveTo(px,py);for(let k=0;k<8;k++){px+=(rand()-.5)*30;py+=(rand()-.5)*30;d.lineTo(px,py);}d.stroke();}
 const litter=canvas(512),l=litter.getContext('2d');l.fillStyle='#3b2c1d';l.fillRect(0,0,512,512);
 const lwrap=(fn)=>{for(const ox of [-512,0,512])for(const oy of [-512,0,512]){l.save();l.translate(ox,oy);fn();l.restore();}};
 const palette=['#5a3d22','#7a5430','#8b6a3c','#4a3620','#9a7442','#5c5a2c','#3e4a22','#6b3f23'];
 for(let i=0;i<1400;i++){const px=rand()*512,py=rand()*512,r=3+rand()*11,a=rand()*6.28,col=palette[Math.floor(rand()*palette.length)];
  lwrap(()=>{l.save();l.translate(px,py);l.rotate(a);l.fillStyle='rgba(0,0,0,.35)';l.beginPath();l.ellipse(1.5,2,r,r*.42,0,0,7);l.fill();l.fillStyle=col;l.beginPath();l.ellipse(0,0,r,r*.42,0,0,7);l.fill();l.strokeStyle='rgba(20,12,6,.45)';l.lineWidth=.7;l.beginPath();l.moveTo(-r,0);l.lineTo(r,0);l.stroke();l.restore();});}
 for(let i=0;i<60;i++){const px=rand()*512,py=rand()*512,a=rand()*6.28,len=20+rand()*60;lwrap(()=>{l.strokeStyle='#2a1f14';l.lineWidth=1+rand()*2;l.beginPath();l.moveTo(px,py);l.lineTo(px+Math.cos(a)*len,py+Math.sin(a)*len);l.stroke();});}
 return{dirt:texture(dirt,{srgb:false,repeat:true}),dirtNormal:normalMap(dirt,2.4),litter:texture(litter,{repeat:true}),litterNormal:normalMap(litter,1.8)};
}
export function dustTexture(){
 const c=canvas(128),x=c.getContext('2d'),rand=seeded(77);
 for(let i=0;i<46;i++){const px=64+(rand()-.5)*50,py=64+(rand()-.5)*44,r=18+rand()*30,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(222,200,160,${.045+rand()*.035})`);g.addColorStop(1,'rgba(222,200,160,0)');x.fillStyle=g;x.fillRect(0,0,128,128);}
 const fade=x.createRadialGradient(64,64,30,64,64,64);fade.addColorStop(0,'rgba(0,0,0,0)');fade.addColorStop(1,'rgba(0,0,0,1)');x.globalCompositeOperation='destination-out';x.fillStyle=fade;x.fillRect(0,0,128,128);
 const t=texture(c);return t;
}

// ------------------------------------------------------ shared plant shader --
/** Compose wind sway, leaf flutter and back-lit translucency onto a standard material. */
export function plant(material,{sway=.2,flutter=0,height=10,translucency=0,moss=0,volume=false,key}){
 const grass=key==='grass';
 material.onBeforeCompile=s=>{
  s.uniforms.uWindTime=WIND;s.uniforms.uWet=WET;s.uniforms.uNight=NIGHT;s.uniforms.uWindGust=WIND_GUST;s.uniforms.uAoMask=AO_MASK;s.uniforms.uGrassDensity=GRASS_DENSITY;
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>\nuniform float uWindTime,uWindGust,uGrassDensity;varying vec3 vPlantWorld;varying vec3 vPlantUp;varying float vFade;${grass?'attribute float tuftRank;':'attribute vec4 plant;'}`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    {
     // Each plant sways as one body. Merged scenery carries its plant's root (x, z,
     // base y) and height (negative: lying still, like fallen wood and litter), so a
     // trunk and its crown share one phase and one bend; instanced tufts use their
     // instance root. Swaying by each vertex's own position (and by different
     // amounts for trunk and leaves) made crowns stretch and slide like jelly.
     float H=${height.toFixed(2)},base=0.,amp=${sway.toFixed(3)},still=0.;
     #ifdef USE_INSTANCING
      vec3 anchor=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
     #else
      vec3 anchor=(modelMatrix*vec4(plant.x,0.,plant.y,1.)).xyz;base=plant.z;still=step(plant.w,0.);H=max(abs(plant.w),.3);
      amp=${sway>0?'clamp(H*.012,.015,.3)':'0.'}*(1.-still);
     #endif
     float h=clamp((position.y-base)/H,0.,1.2),bend=h*h;
     // Tall trees sway slowly, small plants quicker; storm gusts strengthen it, within reason.
     float omega=clamp(2.2*inversesqrt(H*.25),.7,2.6),phase=uWindTime*omega+anchor.x*.045+anchor.z*.06;
     transformed.xz+=vec2(sin(phase)+.4*sin(phase*2.7+1.3),cos(phase*.7+.4)*.55)*amp*bend*(1.+(uWindGust-1.)*.45);
     ${grass?`#ifdef USE_INSTANCING
     {
      // Tufts thin with distance from the rig in rank order; each grows from its root
      // across its own 8% band of the density instead of popping as the draw count changes.
      float density=max(.12,1.-max(0.,abs(anchor.z-6.)-18.)/70.)*uGrassDensity*1.08;
      transformed*=clamp((density-tuftRank)/.08,0.,1.);
     }
     #endif`:''}
     // Leaf flutter varies slowly across a plant, so whole leaf cards move rather than warp.
     ${flutter?`transformed+=${flutter.toFixed(3)}*(1.+(uWindGust-1.)*.3)*(1.-still)*min(h*3.,1.)*vec3(sin(uWindTime*5.+dot(position,vec3(.35,.15,.3))+anchor.x),sin(uWindTime*4.1+dot(position,vec3(.1,.3,.35)))*.6,cos(uWindTime*4.6+dot(position,vec3(.3,.35,.12))+anchor.z));`:''}
    }`)
   .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vPlantWorld=(modelMatrix*vec4(transformed,1.)).xyz;
    #ifdef USE_INSTANCING
     vPlantWorld=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;vPlantUp=normalize(mat3(modelMatrix*instanceMatrix)*vec3(0,1,0));
    #else
     vPlantUp=normalize(mat3(modelMatrix)*vec3(0,1,0));
    #endif
    // Scenery chunks (28 m) switch on and off with their centre at -96 m and +150 m.
    // Everything within reach of either switch sinks fully into the fog first; a
    // screen-door dither here would sit permanently on the far verge.
    vFade=smoothstep(-82.,-62.,vPlantWorld.z)*(1.-smoothstep(112.,136.,vPlantWorld.z));`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uWet,uAoMask,uNight;varying vec3 vPlantWorld;varying vec3 vPlantUp;varying float vFade;')
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>\nroughnessFactor*=1.-uWet*${translucency?'.15':'.45'};`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    diffuseColor.rgb*=1.-uWet*${translucency?'.12':'.32'};
    ${moss?`{
     // Moss collects on up-facing and lower surfaces; lichen speckles above. Nothing
     // grows on the track itself: its stones are scrubbed and its fallen wood is fresh.
     vec3 wn=normalize(cross(dFdx(vPlantWorld),dFdy(vPlantWorld)));
     float n=fract(sin(dot(floor(vPlantWorld*6.),vec3(12.9,78.2,37.7)))*43758.5);
     float m=smoothstep(.25,.85,wn.y*.8+.35-vPlantWorld.y*.035+n*.2)*${moss.toFixed(2)}*smoothstep(3.5,6.,abs(vPlantWorld.x));
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.075,.12,.035)*(.8+.4*n),m);
    }`:''}`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    ${translucency?`{
     // Leaf cards are double-sided. Card clusters use normals radiating from the
     // bush centre, so undo three's back-face flip for them; then keep every leaf
     // normal facing the viewer. Normals facing away drive Fresnel/GGX to their
     // maximum and leaves turned snow-white.
     ${volume?'normal*=faceDirection;':''}
     vec3 toEye=normalize(vViewPosition);float nv=dot(normal,toEye);
     if(nv<.2)normal=normalize(normal+toEye*(.2-nv));
    }`:''}`)
   .replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    ${translucency?`
    // Leaves lying flat on the ground (fallen fronds, torn limbs) are seen edge-on,
    // where the leaf finish mirrors the bright sky and reads as snow. Litter is dull
    // and lets no light through.
    float litter=(1.-smoothstep(.12,.4,vPlantWorld.y))*smoothstep(.55,.85,abs(normalize(cross(dFdx(vPlantWorld),dFdy(vPlantWorld))).y));
    reflectedLight.directSpecular*=.45*(1.-.85*litter);reflectedLight.indirectSpecular*=mix(.35,.42,uWet)*(1.-.85*litter);
    // The rim light (the moon, at night) has no shadow map, so it lit every leaf in
    // the forest alike, even under the canopy, and turned the foliage a flat frost.
    // Leaves keep a quarter of it at night: dark masses with moonlit edges.
    #if NUM_DIR_LIGHTS>1
     reflectedLight.directDiffuse=max(vec3(0.),reflectedLight.directDiffuse-directionalLights[1].color*max(dot(normal,directionalLights[1].direction),0.)*BRDF_Lambert(diffuseColor.rgb)*.75*uNight);
    #endif`:''}
    ${translucency?`#if NUM_DIR_LIGHTS>0
    {
     vec3 L=directionalLights[0].direction;vec3 toFrag=normalize(-vViewPosition);
     float through=pow(max(dot(toFrag,L),0.),3.)*.9+max(-dot(normal,L),0.)*.35;
     reflectedLight.directDiffuse+=directionalLights[0].color*diffuseColor.rgb*vec3(.9,1.05,.42)*through*${translucency.toFixed(2)}*(1.-litter);
    }
    #endif`:''}`)
   .replace('#include <fog_fragment>','#include <fog_fragment>\n#ifdef USE_FOG\ngl_FragColor.rgb=mix(fogTint,gl_FragColor.rgb,vFade);\n#endif')
   // Leaves and grass tag themselves in the occlusion mask (see post.js).
   .replace('#include <dithering_fragment>',`#include <dithering_fragment>\n${translucency?'gl_FragColor.a=mix(gl_FragColor.a,.3,uAoMask);':''}`);
 };
 material.customProgramCacheKey=()=>`rex-plant-${key}-v5`;
 return material;
}

// --------------------------------------------------------- geometry kits ----
function build(positions,normals,uvs,colors,indices){
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);return g;
}
/** Tube along a path; radius(v,theta) allows buttress flanges and taper. */
function tube(path,radius,{radial=10,rings=20,color=()=>[1,1,1],uvScale=[1,.25]}={}){
 const curve=new T.CatmullRomCurve3(path),P=[],N=[],U=[],C=[],I=[],frames=curve.computeFrenetFrames(rings,false),length=curve.getLength();
 for(let r=0;r<=rings;r++){
  const v=r/rings,c=curve.getPointAt(v),n=frames.normals[r],b=frames.binormals[r];
  for(let k=0;k<=radial;k++){
   const th=k/radial*Math.PI*2,rad=radius(v,th),dir=n.clone().multiplyScalar(Math.cos(th)).addScaledVector(b,Math.sin(th));
   P.push(c.x+dir.x*rad,c.y+dir.y*rad,c.z+dir.z*rad);N.push(dir.x,dir.y,dir.z);U.push(k/radial*uvScale[0],v*length*uvScale[1]);C.push(...color(v,th));
  }
 }
 for(let r=0;r<rings;r++)for(let k=0;k<radial;k++){const a=r*(radial+1)+k,b=a+radial+1;I.push(a,b,a+1,a+1,b,b+1);}
 const g=build(P,N,U,C,I);g.computeVertexNormals();return g;
}
/** Arched, V-folded ribbon (fronds, leaves). Lies along +Z from the origin. */
function ribbon({length,width,arch=.4,droop=.3,fold=.12,segments=10,cup=0,twist=0,uv=[0,0,1,1],shade=[.75,1]}){
 const P=[],N=[],U=[],C=[],I=[],cols=3;
 for(let s=0;s<=segments;s++){
  const v=s/segments,z=v*length,y=Math.sin(v*Math.PI*.8)*arch*length*.5-droop*length*v*v,w=width*(v<.08?v/.08*.6+.4:1);
  for(let k=0;k<cols;k++){
   const u=k/(cols-1),side=u*2-1,tw=twist*v,x=side*w*.5*Math.cos(tw),yy=y+(1-Math.abs(side))*fold*w+Math.abs(side)*cup*w-side*w*.5*Math.sin(tw);
   P.push(x,yy,z);N.push(0,1,0);U.push(uv[0]+(uv[2]-uv[0])*u,uv[1]+(uv[3]-uv[1])*v);const l=shade[0]+(shade[1]-shade[0])*v;C.push(l,l,l);
  }
 }
 for(let s=0;s<segments;s++)for(let k=0;k<cols-1;k++){const a=s*cols+k,b=a+cols;I.push(a,b,a+1,a+1,b,b+1);}
 const g=build(P,N,U,C,I);g.computeVertexNormals();
 // Soften: bias normals upward so thin blades don't flip dark from behind.
 const n=g.attributes.normal;for(let i=0;i<n.count;i++){const v=new T.Vector3(n.getX(i),n.getY(i)+.8,n.getZ(i)).normalize();n.setXYZ(i,v.x,v.y,v.z);}
 return g;
}
function place(g,{pos=[0,0,0],rot=[0,0,0],scale=1}){const m=new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rot,'YXZ')),new T.Vector3().setScalar(scale));return g.applyMatrix4(m);}
function tint(g,rgb){const c=g.attributes.color;for(let i=0;i<c.count;i++)c.setXYZ(i,c.getX(i)*rgb[0],c.getY(i)*rgb[1],c.getZ(i)*rgb[2]);return g;}
/** Leaf cards with normals radiating from the cluster centre, so bushes shade as volumes. */
function cardCluster(rand,{count,radius,size,center=[0,0,0],lift=.2,flat=.6}){
 const parts=[];
 for(let i=0;i<count;i++){
  const a=rand()*Math.PI*2,r=Math.sqrt(rand())*radius,y=(rand()-.3)*radius*flat,s=size*(.7+rand()*.6);
  const g=new T.PlaneGeometry(s,s);g.translate(0,s*.3,0);
  place(g,{pos:[center[0]+Math.cos(a)*r,center[1]+y,center[2]+Math.sin(a)*r],rot:[-.5+rand()*1.1,rand()*6.28,(rand()-.5)*.9]});
  const c=[];const p=g.attributes.position,n=g.attributes.normal;
  for(let k=0;k<p.count;k++){const v=new T.Vector3(p.getX(k)-center[0],(p.getY(k)-center[1])+radius*lift,p.getZ(k)-center[2]).normalize();n.setXYZ(k,v.x,v.y,v.z);const l=.62+.38*Math.max(0,v.y)+(rand()-.5)*.1;c.push(l*(.92+rand()*.1),l,l*(.9+rand()*.1));}
  g.setAttribute('color',new T.Float32BufferAttribute(c,3));parts.push(g);
 }
 return mergeGeometries(parts);
}
function stripColor(g,rgb=[1,1,1]){const n=g.attributes.position.count,c=new Float32Array(n*3);for(let i=0;i<n;i++)c.set(rgb,i*3);g.setAttribute('color',new T.BufferAttribute(c,3));if(!g.index)return g;return g;}
function strip(g){for(const k of Object.keys(g.attributes))if(!['position','normal','uv','color'].includes(k))g.deleteAttribute(k);return g.index?g:g;}

export function createFoliageKit(branchMap){
 const rand=seeded(5150);
 const bark=barkTextures(),fern=frondTexture('fern'),palm=frondTexture('palm'),broad=broadleafTexture(),ground=groundTextures();
 // Scenery is merged per chunk, so heights are world metres above the road.
 const M={
  bark:plant(new T.MeshStandardMaterial({map:bark.map,normalMap:bark.normal,normalScale:new T.Vector2(1.2,1.2),vertexColors:true,roughness:.93}),{sway:.12,height:30,moss:.8,key:'bark'}),
  canopy:plant(new T.MeshStandardMaterial({map:branchMap,alphaTest:.42,side:T.DoubleSide,vertexColors:true,roughness:.58,color:0xb4c496}),{sway:.32,flutter:.05,height:30,translucency:.85,volume:true,key:'canopy'}),
  shrub:plant(new T.MeshStandardMaterial({map:branchMap,alphaTest:.42,side:T.DoubleSide,vertexColors:true,roughness:.62,color:0x93ab70}),{sway:.12,flutter:.035,height:7,translucency:.7,volume:true,key:'shrub'}),
  fern:plant(new T.MeshStandardMaterial({map:fern,alphaTest:.38,side:T.DoubleSide,vertexColors:true,roughness:.7}),{sway:.08,flutter:.025,height:5,translucency:.9,key:'fern'}),
  palm:plant(new T.MeshStandardMaterial({map:palm,alphaTest:.38,side:T.DoubleSide,vertexColors:true,roughness:.62}),{sway:.3,flutter:.05,height:14,translucency:.9,key:'palm'}),
  broad:plant(new T.MeshStandardMaterial({map:broad,alphaTest:.4,side:T.DoubleSide,vertexColors:true,roughness:.62,envMapIntensity:.6}),{sway:.08,flutter:.03,height:2.5,translucency:.6,key:'broad'}),
  rock:plant(new T.MeshStandardMaterial({map:ground.dirt,normalMap:ground.dirtNormal,normalScale:new T.Vector2(1.6,1.6),vertexColors:true,roughness:.9}),{sway:0,height:1,moss:.55,key:'rock'}),
  grass:plant(new T.MeshStandardMaterial({vertexColors:true,roughness:.78,side:T.DoubleSide}),{sway:.12,flutter:.015,height:.9,translucency:.8,key:'grass'})
 };
 M.bark.color.setHex(0x9c9384);M.rock.color.setHex(0x8f8a7d);

 // Buttressed rainforest giant with a leaning, tapering trunk, limbs, lianas and a crown.
 function giant(seed){
  const r=seeded(seed),h=1,lean=[(r()-.5)*.05,(r()-.5)*.05],pts=[];for(let i=0;i<=6;i++){const v=i/6;pts.push(new T.Vector3(lean[0]*v*v+(r()-.5)*.012,v,lean[1]*v*v+(r()-.5)*.012));}
  const flanges=4+Math.floor(r()*3),offset=r()*6;
  const trunk=tube(pts,(v,th)=>{const taper=.036*(1-v*.5),but=Math.pow(Math.max(0,Math.cos(flanges*(th+offset)*.5)),5)*Math.exp(-v*12)*.11;return taper+but+.014*Math.exp(-v*30);},
   {radial:14,rings:26,uvScale:[1,6],color:(v)=>{const m=.72+.28*Math.min(1,v*4);return [m*.95,m,m*.9];}});
  const parts=[trunk],crown=[];
  const limbs=3+Math.floor(r()*3);
  for(let i=0;i<limbs;i++){
   const a=r()*6.28,start=.62+r()*.3,base=new T.Vector3(lean[0]*start*start,start,lean[1]*start*start),len=.12+r()*.12;
   const tip=base.clone().add(new T.Vector3(Math.cos(a)*len,len*(.35+r()*.4),Math.sin(a)*len)),mid=base.clone().lerp(tip,.5).add(new T.Vector3(0,.02,0));
   parts.push(tube([base,mid,tip],(v)=>.014*(1-v*.7),{radial:7,rings:6,uvScale:[1,6]}));
   crown.push(tip);
  }
  crown.push(new T.Vector3(lean[0],1.02,lean[1]));
  // Lianas: sagging strands from the limbs toward the understory.
  const lianas=[];for(let i=0;i<1+Math.floor(r()*2);i++){const from=crown[Math.floor(r()*crown.length)],to=new T.Vector3(from.x+(r()-.5)*.25,.02+r()*.2,from.z+(r()-.5)*.25),mid=from.clone().lerp(to,.5);mid.y-=.08;mid.x+=(r()-.5)*.08;
   lianas.push(tube([from,from.clone().lerp(mid,.5).add(new T.Vector3(0,-.02,0)),mid,to],()=>.0035,{radial:5,rings:14,uvScale:[1,3],color:()=>[.5,.55,.4]}));}
  const leaves=mergeGeometries(crown.map((c,i)=>cardCluster(r,{count:i===crown.length-1?22:16,radius:.12+r()*.06,size:.12,center:c.toArray(),flat:.5})));
  return{wood:mergeGeometries([...parts,...lianas].map(strip)),leaves};
 }
 function leaner(seed){
  const r=seeded(seed),reach=.14+r()*.12,kink=.55+r()*.2,pts=[];for(let i=0;i<=6;i++){const v=i/6;pts.push(new T.Vector3(reach*Math.pow(Math.max(0,v-kink*.4),1.3)+(r()-.5)*.025,v*(1-.06*v),(r()-.5)*.04*v));}
  const trunk=tube(pts,(v,th)=>.03*(1-v*.55)+Math.pow(Math.max(0,Math.cos(2*(th+1.1))),6)*Math.exp(-v*14)*.06,{radial:12,rings:22,uvScale:[1,5],color:(v)=>{const m=.7+.3*Math.min(1,v*3);return[m*.95,m,m*.9];}});
  const top=pts[6],crowns=[];
  for(let i=0;i<6;i++){const c=top.clone().add(new T.Vector3(r()*.38-.06,(r()-.6)*.14,(r()-.5)*.4));crowns.push(cardCluster(r,{count:18,radius:.13+r()*.05,size:.13,center:c.toArray(),flat:.42,lift:.3}));}
  const limbs=[1,2].map(()=>{const b=pts[4].clone(),t=top.clone().add(new T.Vector3((r()-.5)*.2,-.05,(r()-.5)*.35));return tube([b,b.clone().lerp(t,.5).add(new T.Vector3(0,.03,0)),t],(v)=>.011*(1-v*.6),{radial:6,rings:6,uvScale:[1,5]});});
  // Roosts: points on the road side of the trunk (+x, the way it leans) below the crown,
  // with the outward surface normal, where a small pterosaur can cling.
  const roosts=[.42,.52,.62].map(v=>{const f=v*6,i=Math.min(5,Math.floor(f)),a=pts[i].clone().lerp(pts[i+1],f-i),t=pts[i+1].clone().sub(pts[i]).normalize(),n=new T.Vector3(1,0,0).addScaledVector(t,-t.x).normalize();return{p:a.addScaledVector(n,.03*(1-v*.55)),n};});
  return{wood:mergeGeometries([trunk,...limbs].map(strip)),leaves:mergeGeometries(crowns),roosts};
 }
 function palmTree(seed){
  const r=seeded(seed),bendX=(r()-.5)*.3,bendZ=.12+r()*.2,pts=[];for(let i=0;i<=6;i++){const v=i/6;pts.push(new T.Vector3(bendX*v*v,v,bendZ*v*v));}
  const trunk=tube(pts,(v)=>.018*(1-v*.35)*(1+.12*Math.max(0,Math.sin(v*110))),{radial:9,rings:40,uvScale:[1,4],color:(v)=>{const ring=.8+.2*Math.sin(v*110);return [.62*ring,.56*ring,.44*ring];}});
  const top=pts[6],fronds=[];const n=11+Math.floor(r()*4);
  for(let i=0;i<n;i++){const a=i/n*6.28+r()*.3,g=ribbon({length:.36+r()*.1,width:.11,arch:.5,droop:.75+r()*.3,fold:.12,segments:12,shade:[.7,1.05]});
   place(g,{pos:[top.x,top.y,top.z],rot:[-.25-r()*.35,a,0]});fronds.push(g);}
  return{wood:trunk,fronds:mergeGeometries(fronds)};
 }
 function treeFern(seed){
  const r=seeded(seed),pts=[];for(let i=0;i<=4;i++){const v=i/4;pts.push(new T.Vector3((r()-.5)*.03*v,v,(r()-.5)*.03*v));}
  const trunk=tube(pts,(v)=>.05*(1-v*.25)+.012*Math.sin(v*60),{radial:8,rings:12,uvScale:[1,2],color:()=>[.42,.34,.26]});
  const fronds=[];const n=10+Math.floor(r()*4),top=pts[4];
  for(let i=0;i<n;i++){const a=i/n*6.28+r()*.3,g=ribbon({length:.62+r()*.2,width:.26,arch:.55,droop:.55,fold:.08,segments:10,shade:[.72,1.05]});place(g,{pos:top.toArray(),rot:[-.55-r()*.35,a,0]});fronds.push(g);}
  // Fiddleheads unfurling at the crown.
  return{wood:trunk,fronds:mergeGeometries(fronds)};
 }
 function groundFern(seed){
  const r=seeded(seed),fronds=[],n=9+Math.floor(r()*5);
  for(let i=0;i<n;i++){const a=i/n*6.28+r()*.4,g=ribbon({length:.8+r()*.4,width:.36,arch:.9,droop:.55,fold:.07,segments:8,shade:[.55,1.05]});place(g,{rot:[-.95+r()*.4,a,0]});fronds.push(g);}
  return mergeGeometries(fronds);
 }
 function broadleaf(seed,kind){
  const r=seeded(seed),leaves=[],n=kind==='banana'?6:5+Math.floor(r()*4);
  for(let i=0;i<n;i++){
   const a=i/n*6.28+r()*.5,stem=kind==='banana'?.3:.45+r()*.5,uv=kind==='banana'?[.5,0,1,1]:[0,0,.5,1];
   const g=ribbon({length:kind==='banana'?1.5+r()*.5:.8+r()*.3,width:kind==='banana'?.55:.75,arch:kind==='banana'?.35:.2,droop:kind==='banana'?.45:.35,fold:-.04,cup:.07,segments:8,uv,twist:(r()-.5)*.6,shade:[.8,1.05]});
   place(g,{pos:[Math.cos(a)*.05,stem,Math.sin(a)*.05],rot:[-.35-r()*.5,a,0]});leaves.push(g);
   const petiole=tube([new T.Vector3(0,0,0),new T.Vector3(Math.cos(a)*.02,stem*.6,Math.sin(a)*.02),new T.Vector3(Math.cos(a)*.05,stem,Math.sin(a)*.05)],()=>.018,{radial:5,rings:4,color:()=>[.55,.68,.36]});
   // Petioles sample the opaque midrib of the atlas.
   const puv=petiole.attributes.uv;for(let k=0;k<puv.count;k++)puv.setXY(k,kind==='banana'?.75:.25,.5);
   leaves.push(strip(petiole));
  }
  return mergeGeometries(leaves);
 }
 function rock(seed,detail=3){
  const r=seeded(seed);let g=new T.IcosahedronGeometry(1,detail);g.deleteAttribute('normal');g.deleteAttribute('uv');g=mergeVertices(g);
  const p=g.attributes.position,v=new T.Vector3(),uv=[];
  const lumps=[...Array(7)].map(()=>[new T.Vector3(r()-.5,r()-.5,r()-.5).normalize(),r()*.35,1.5+r()*3]);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);let s=1;for(const [d,a,k]of lumps)s+=a*Math.pow(Math.max(0,v.dot(d)),k);s+=(Math.sin(v.x*17.1+v.y*9.3)*Math.sin(v.z*13.7-v.y*5.1))*.035;v.multiplyScalar(s);v.y=v.y>0?v.y*.62:v.y*.3;p.setXYZ(i,v.x,v.y,v.z);uv.push(v.x*.9+v.z*.45,v.y*.9+v.z*.45);}
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();stripColor(g,[1,1,1]);return strip(g);
 }
 function grassTuft(seed){
  const r=seeded(seed),P=[],N=[],C=[],I=[];let base=0;
  const blades=14;for(let b=0;b<blades;b++){
   const a=r()*6.28,rad=r()*.16,h=(.16+r()*.34)*(r()<.2?1.6:1),w=.018+r()*.018,lean=.15+r()*.45,dir=r()*6.28,x0=Math.cos(a)*rad,z0=Math.sin(a)*rad,seg=4;
   const tone=r(),dry=r()<.14;
   for(let s=0;s<=seg;s++){const v=s/seg,bend=lean*v*v*h,x=x0+Math.cos(dir)*bend,z=z0+Math.sin(dir)*bend,y=v*h,ww=w*(1-v*.92);
    for(const side of [-1,1]){P.push(x+Math.cos(dir+1.57)*ww*side,y,z+Math.sin(dir+1.57)*ww*side);N.push(Math.cos(dir)*.3,1,Math.sin(dir)*.3);
     const c=dry?[.34+.2*v,.3+.16*v,.15+.07*v]:[(.06+.16*v)*(.75+tone*.4),(.1+.24*v)*(.8+tone*.3),(.03+.07*v)*(.75+tone*.35)];C.push(...c);}}
   for(let s=0;s<seg;s++){const a0=base+s*2;I.push(a0,a0+2,a0+1,a0+1,a0+2,a0+3);}base+=(seg+1)*2;
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setIndex(I);g.normalizeNormals?.();return g;
 }
 // Understory bushes double as the midpoint-feint cover: a dense lower mass plus a
 // taller crown so the Rex's head (4-6 m) stays hidden from the seat and chase cam.
 function bush(seed,size){const r=seeded(seed),low=cardCluster(r,{count:size>4?26:16,radius:size*.44,size:size*.52,center:[0,size*.36,0],lift:.35,flat:.8}),
  // Leafy skirt down to the ground: without it, legs show through beneath the canopy.
  skirt=cardCluster(r,{count:12,radius:size*.5,size:size*.34,center:[0,size*.1,0],lift:.2,flat:.3});
  const parts=[skirt,low];if(size>=4)parts.push(cardCluster(r,{count:14,radius:size*.32,size:size*.44,center:[0,size*.78,0],lift:.3,flat:.6}));return mergeGeometries(parts);}

 // ---- Ground clutter (real metres, lying on the ground at y=0) ----
 // A limb the storm snapped off: crooked, resting on its own radius, with a pale
 // splintered break at the base and a few side twigs, some propped up off the ground.
 function snappedBranch(seed,length){
  const r=seeded(seed),rad=.055+r()*.035,pts=[];for(let i=0;i<=5;i++){const v=i/5;pts.push(new T.Vector3((r()-.5)*.12*v,rad*(1-v*.5)+Math.max(0,Math.sin(v*3.1))*.02,v*length));}
  const limb=tube(pts,(v,th)=>rad*(1-v*.55)*(v<.05?.75+.45*Math.abs(Math.sin(th*3.5+seed)):1),{radial:7,rings:10,uvScale:[1,2],color:v=>v<.04?[2.1,1.7,1.2]:[1.25,1.15,1]});
  const parts=[limb];for(let i=0;i<2+Math.floor(r()*3);i++){const v=.25+r()*.65,base=new T.Vector3().lerpVectors(pts[Math.floor(v*5)],pts[Math.min(5,Math.floor(v*5)+1)],v*5%1),a=(r()<.5?-1:1)*(.5+r()*.7),len=.25+r()*.45,up=r()<.2?.15+r()*.25:.03;
   const tip=base.clone().add(new T.Vector3(Math.sin(a)*len,up*len,Math.cos(a)*len*.6));parts.push(tube([base,base.clone().lerp(tip,.5).add(new T.Vector3(0,.01,0)),tip],v2=>rad*.35*(1-v2*.7),{radial:5,rings:4,uvScale:[1,2],color:()=>[1.2,1.1,.95]}));}
  return mergeGeometries(parts.map(strip));
 }
 // A leafy limb torn from the canopy: the wood plus a flattened spray of leaf cards.
 function tornLimb(seed){
  const r=seeded(seed),wood=snappedBranch(seed+1,1.3+r()*.6),leaves=[];
  // Squashed flat: the spray lies on the ground rather than standing like a bush.
  for(let i=0;i<3;i++)leaves.push(cardCluster(r,{count:10,radius:.45,size:.42,center:[(r()-.5)*.5,.05,.7+i*.35],lift:.5,flat:.12}).scale(1,.45,1));
  return{wood,leaves:mergeGeometries(leaves)};
 }
 // A dead frond lying on the ground: flat, curling a little at the tip.
 function deadFrond(seed,kind){
  const r=seeded(seed),g=ribbon(kind==='fern'?{length:1.1+r()*.3,width:.4,arch:.2,droop:-.06,fold:.32,segments:8,twist:(r()-.5)*.8,shade:[.85,1.1]}:{length:1.9+r()*.5,width:.62,arch:.12,droop:-.07,fold:.34,segments:12,twist:(r()-.5)*.7,shade:[.85,1.1]});
  g.translate(0,.015,0);return g;
 }

 const kit={
  materials:M,textures:{bark,fern,palm,broad,ground},
  clutter:{pebbles:[21,33,37].map(s=>rock(s,1)),branches:[[61,1.9],[67,2.6],[83,1.5]].map(([s,l])=>snappedBranch(s,l)),limbs:[91,97].map(tornLimb),palmFronds:[101,103].map(s=>deadFrond(s,'palm')),fernFronds:[107].map(s=>deadFrond(s,'fern'))},
  giants:[31,47,63,89].map(giant),leaners:[13,27,58].map(leaner),palms:[5,17,29].map(palmTree),treeFerns:[3,11].map(treeFern),
  ferns:[7,19,23].map(groundFern),elephant:[41,43].map(s=>broadleaf(s,'heart')),banana:[51].map(s=>broadleaf(s,'banana')),
  rocks:[2,9,14].map(rock),grass:[1,2].map(grassTuft),bushes:[[71,3.5],[73,5.2],[79,6.8]].map(([s,z])=>bush(s,z))
 };
 return kit;
}
