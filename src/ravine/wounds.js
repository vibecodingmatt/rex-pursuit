import * as T from 'three';
// Small bounded rest-space punctures per pooled animal. Their centres follow
// skinning through the fall; shared textures and the authored normals remain.
export function createRaptorWounds(mesh){
 const points=Array.from({length:16},()=>new T.Vector4()),material=mesh.material.clone();mesh.material=material;let count=0;
 material.onBeforeCompile=s=>{
  s.uniforms.raptorWounds={value:points};
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHideRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHideRest=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHideRest; uniform vec4 raptorWounds[16];')
   .replace('#include <color_fragment>',`#include <color_fragment>
float bloodMark=0.,hole=0.;float stipple=fract(sin(dot(floor(vHideRest*97.),vec3(12.31,71.17,39.57)))*13758.3);
for(int i=0;i<16;i++){if(raptorWounds[i].w<.001)continue;vec3 d=vHideRest-raptorWounds[i].xyz;float r=length(d)/raptorWounds[i].w+(stipple-.5)*.2;bloodMark=max(bloodMark,1.-smoothstep(.25,1.15,r));hole=max(hole,1.-smoothstep(.08,.3,r));float run=-d.y;float drip=(1.-smoothstep(.014,.055,abs(d.x)))*(1.-smoothstep(.05,.18,abs(d.z)))*smoothstep(0.,.1,run)*(1.-smoothstep(raptorWounds[i].w,raptorWounds[i].w*2.1,run));bloodMark=max(bloodMark,drip*.8);}
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.008,.012)*(0.7+stipple*.5),bloodMark*.94);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.022,.002,.004),hole*.9);`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.36,bloodMark*.8);');
 };material.customProgramCacheKey=()=> 'ravine-punctures-v1';
 return {points,add(point,bone,scale,explosive=false){
  const index=mesh.skeleton.bones.indexOf(bone),transform=new T.Matrix4().copy(mesh.matrixWorld).multiply(mesh.bindMatrixInverse).multiply(bone.matrixWorld).multiply(mesh.skeleton.boneInverses[index]).multiply(mesh.bindMatrix).invert(),rest=point.clone().applyMatrix4(transform),radius=(explosive?.65:.17)/scale;
  points[count++%points.length].set(rest.x,rest.y,rest.z,radius);
 },reset(){count=0;for(const p of points)p.set(0,0,0,0);},get count(){return count;}};
}
