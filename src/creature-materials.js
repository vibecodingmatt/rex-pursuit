/** Shared oral finish for the chase and creature study; retain the authored maps. */
export function finishTongue(mesh){
 if(mesh.name!=='Object_150')return;
 const material=mesh.material=mesh.material.clone();
 // The source atlas is warm flesh, so a saturated red multiplier overwhelms it.
 material.color.setRGB(.49,.38,.55);
 material.roughness=.66;
 material.normalScale.set(.45,Math.sign(material.normalScale.y)*.45);
 material.userData.oralPalette='muted-rose';
 mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uTongueMin={value:bounds.min};
  shader.uniforms.uTongueSize={value:bounds.max.clone().sub(bounds.min)};
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vTongueRest; uniform vec3 uTongueMin; uniform vec3 uTongueSize;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvTongueRest=(position-uTongueMin)/uTongueSize;');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>','#include <common>\nvarying vec3 vTongueRest;')
   .replace('#include <color_fragment>',`#include <color_fragment>
    float rootShade=mix(.72,1.,smoothstep(.02,.62,vTongueRest.z));
    float crease=exp(-pow((vTongueRest.x-.50)/.055,2.))*smoothstep(.2,.45,vTongueRest.z)*(1.-smoothstep(.78,.96,vTongueRest.z))*smoothstep(.4,.7,vTongueRest.y);
    diffuseColor.rgb*=rootShade*(1.-crease*.13);
   `)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor,.48,.82);');
 };
 material.customProgramCacheKey=()=> 'rex-muted-tongue-v1';
 material.needsUpdate=true;
}
