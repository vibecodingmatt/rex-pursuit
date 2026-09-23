import * as T from 'three';
const MAX=36;
const STAGE_SITES=[
 [.57,4.70,5.95,.28],[.0,4.18,6.92,.19],
 [.28,3.65,6.75,.28],[-.27,4.75,5.81,.28],
 [.56,4.05,6.48,.34],[.30,4.03,6.94,.24],
 [-.05,3.77,6.71,.26],[.17,4.45,6.65,.25],
 [.72,3.73,4.65,.49],[-.74,3.7,4.6,.46],
 [1.10,3.1,2.7,.58],[-1.10,3.1,2.7,.56]
];
export class ImpactDamage {
 constructor(){
  this.points=Array.from({length:MAX},()=>new T.Vector4());this.count=0;this.serial=0;this.totalImpacts=0;
  this.stages=STAGE_SITES.map(p=>new T.Vector4(...p));this.wear={value:0};this.worst=0;
  // This atlas is never cycled out: every hit remains after the detailed
  // recent-impact pool wraps, including wounds acquired before the detour.
  this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=1024;this.ctx=this.canvas.getContext('2d');
  this.atlas=new T.CanvasTexture(this.canvas);this.atlas.colorSpace=T.NoColorSpace;this.atlas.generateMipmaps=false;this.atlas.minFilter=T.LinearFilter;
  this.reset();
 }
 prepareStages(mesh){
  this.skin=mesh;
  const positions=mesh.geometry.attributes.position,p=new T.Vector3();
  for(let j=0;j<this.stages.length;j++){
   const wanted=new T.Vector3(...STAGE_SITES[j].slice(0,3));let best=Infinity,index=0;
   for(let i=0;i<positions.count;i++){p.fromBufferAttribute(positions,i);const d=p.distanceToSquared(wanted);if(d<best){best=d;index=i;}}
   p.fromBufferAttribute(positions,index);this.stages[j].set(p.x,p.y,p.z,STAGE_SITES[j][3]);
  }
 }
 setHealth(fraction,dt){this.worst=Math.max(this.worst,1-T.MathUtils.clamp(fraction,0,1));this.wear.value=T.MathUtils.damp(this.wear.value,this.worst,5,dt);}
 get stage(){return this.worst>=.8?3:this.worst>=.5?2:this.worst>=.22?1:0;}
 install(material,finish=null){
  material.onBeforeCompile=s=>{
   s.uniforms.uWounds={value:this.points};
   s.uniforms.uWoundAtlas={value:this.atlas};s.uniforms.uWear=this.wear;s.uniforms.uWearSites={value:this.stages};
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vImpactRest; varying vec2 vImpactUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nvImpactRest=position; vImpactUv=uv;');
   s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 vImpactRest; varying vec2 vImpactUv; uniform vec4 uWounds[${MAX}];
    uniform sampler2D uWoundAtlas; uniform float uWear; uniform vec4 uWearSites[${STAGE_SITES.length}];
    float impactNoise(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
    float woundNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
     return mix(mix(mix(impactNoise(i),impactNoise(i+vec3(1,0,0)),f.x),mix(impactNoise(i+vec3(0,1,0)),impactNoise(i+vec3(1,1,0)),f.x),f.y),mix(mix(impactNoise(i+vec3(0,0,1)),impactNoise(i+vec3(1,0,1)),f.x),mix(impactNoise(i+vec3(0,1,1)),impactNoise(i+vec3(1,1,1)),f.x),f.y),f.z);
    }
   `).replace('#include <color_fragment>',`#include <color_fragment>
    vec3 history=texture2D(uWoundAtlas,vImpactUv).rgb;
    float blood=history.r*.9;float pit=history.b;float soot=history.g*.75;float bruising=0.;
    float grain=impactNoise(floor(vImpactRest*130.));
    float mottling=woundNoise(vImpactRest*11.);
    for(int i=0;i<${MAX};i++){
     float radius=abs(uWounds[i].w);if(radius<.001)continue;
     vec3 delta=vImpactRest-uWounds[i].xyz;
     float dist=length(delta)/radius+(grain-.5)*.18;
     if(uWounds[i].w<0.)soot=max(soot,(1.-smoothstep(.25,1.8,dist))*.86);
     blood=max(blood,(1.-smoothstep(.30,1.15,dist))*(.65+grain*.35));
     pit=max(pit,1.-smoothstep(.13,.38,dist));
    }
    // Larger bruised / powder-burned patches accumulate in staggered stages.
    // Their rest-space anchors follow the skin through roars, turns and death.
    if(uWear>.12)for(int i=0;i<${STAGE_SITES.length};i++){
     float severity=smoothstep(.14+float(i)*.044,.40+float(i)*.038,uWear);
     vec3 delta=vImpactRest-uWearSites[i].xyz;
     float radius=uWearSites[i].w*(.64+.55*severity);
     float dist=length(delta/vec3(1.,.82,1.05))/radius+(mottling-.5)*.48;
     bruising=max(bruising,(1.-smoothstep(.50,1.85,dist))*severity*(.6+.4*mottling));
     blood=max(blood,(1.-smoothstep(.28,1.03,dist))*severity*(.50+.50*mottling));
     pit=max(pit,(1.-smoothstep(.08,.34,dist))*severity*.91);
     if(i==1||i==5||i==8)soot=max(soot,(1.-smoothstep(.45,1.6,dist))*severity*.72);
     // Short gravity runs from punctures, rather than long claw-like cuts.
     float drop=-delta.y,drip=(1.-smoothstep(.016,.044,abs(delta.x+.019*sin(drop*20.))))*(1.-smoothstep(.065,.14,abs(delta.z)))*smoothstep(.02,.11,drop)*(1.-smoothstep(radius*.65,radius*2.15,drop));
     blood=max(blood,drip*severity*.64);
    }
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.38+vec3(.025,.009,.008),bruising*.74);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.19+vec3(.014,.011,.008),soot);
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.18+vec3(.105,.013,.008),blood*.86);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.019,.004,.003),pit*.91);
   `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    // Preserve the scale-to-scale map variation within a dry, leathery range.
    // Multiplying the source map by .72 made the clean hide look wet up close.
    roughnessFactor=mix(.48,.86,clamp(roughnessFactor,0.,1.));
    roughnessFactor=mix(roughnessFactor,.96,soot*.65);
    roughnessFactor=mix(roughnessFactor,.55,blood*.65);
    roughnessFactor=mix(roughnessFactor,.49,pit*.45);
   `);
   // The hide finish composes after the wound code so its inserts sit beneath it.
   finish?.extend(s);
  };material.customProgramCacheKey=()=>`persistent-ballistic-wear-6${finish?'-'+finish.key:''}`;material.needsUpdate=true;
 }
 restPoint(hit){
  const mesh=hit.object,face=hit.face;if(!face)return null;
  const local=mesh.worldToLocal(hit.point.clone()),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),weights=new T.Vector3();
  mesh.getVertexPosition(face.a,a);mesh.getVertexPosition(face.b,b);mesh.getVertexPosition(face.c,c);new T.Triangle(a,b,c).getBarycoord(local,weights);
  const p=mesh.geometry.attributes.position;
  return a.fromBufferAttribute(p,face.a).multiplyScalar(weights.x).addScaledVector(b.fromBufferAttribute(p,face.b),weights.y).addScaledVector(c.fromBufferAttribute(p,face.c),weights.z);
 }
 paint(hit,explosive){
  if(!hit.uv||hit.object!==this.skin)return;const size=this.canvas.width,x=hit.uv.x*size,y=(1-hit.uv.y)*size,mesh=hit.object,f=hit.face;
  const positions=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv;let ratio=0;
  for(const [a,b]of [[f.a,f.b],[f.b,f.c],[f.c,f.a]]){const world=new T.Vector3().fromBufferAttribute(positions,a).distanceTo(new T.Vector3().fromBufferAttribute(positions,b));ratio+=new T.Vector2().fromBufferAttribute(uv,a).distanceTo(new T.Vector2().fromBufferAttribute(uv,b))/Math.max(.001,world);}
  const r=T.MathUtils.clamp(ratio/3*(explosive?.56:.13),explosive?.009:.0028,explosive?.042:.011)*size,ctx=this.ctx;
  ctx.globalCompositeOperation='lighten';
  const disc=(radius,color)=>{const g=ctx.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(.43,color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);};
  if(explosive)disc(r*1.9,'rgb(0,210,0)');disc(r,'rgb(205,0,0)');disc(r*.31,'rgb(0,0,245)');
  for(let i=0;i<7;i++){const a=i*2.399+this.totalImpacts*.47,d=r*(.35+(i%3)*.25);ctx.fillStyle='rgba(125,0,0,.7)';ctx.beginPath();ctx.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,r*(.08+(i%2)*.05),0,Math.PI*2);ctx.fill();}
  this.atlas.needsUpdate=true;
 }
 add(hit,explosive=false){const p=this.restPoint(hit);if(!p)return;const radius=explosive?.56:.13;this.totalImpacts++;this.paint(hit,explosive);
  for(let i=0;i<this.count;i++){const w=this.points[i];if(p.distanceTo(new T.Vector3(w.x,w.y,w.z))<.12){w.w=explosive?-Math.max(Math.abs(w.w),radius):Math.sign(w.w)*Math.min(w.w<0?.8:.3,Math.abs(w.w)+.022);return p;}}
  const index=this.count<MAX?this.count++:this.serial++%MAX;this.points[index].set(p.x,p.y,p.z,explosive?-radius:radius);return p;
 }
 reset(){this.count=0;this.serial=0;this.totalImpacts=0;this.worst=0;this.wear.value=0;for(const p of this.points)p.set(0,0,0,0);this.ctx.globalCompositeOperation='source-over';this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);this.atlas.needsUpdate=true;}
}
