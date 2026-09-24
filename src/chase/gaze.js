import * as T from 'three';

// Aim the painted iris on the existing eye surface, leaving the sockets and
// corneas attached to the head. Each eye converges on the same world point.
export function createGaze(mesh,head){
 const a=mesh.geometry.attributes.position,mid=(mesh.geometry.boundingBox.min.x+mesh.geometry.boundingBox.max.x)/2;
 const boxes=[new T.Box3(),new T.Box3()],p=new T.Vector3();
 for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i);boxes[p.x<mid?0:1].expandByPoint(p);}
 const centers=boxes.map(b=>b.getCenter(new T.Vector3())),directions=[new T.Vector3(0,0,1),new T.Vector3(0,0,1)];
 const uniforms={rexEyeLeft:{value:directions[0]},rexEyeRight:{value:directions[1]},rexEyeSplit:{value:mid},blink:{value:0},eyeShine:{value:0}};
 const material=mesh.material=mesh.material.clone();material.roughness=.42;material.color.setRGB(1,.74,.3);
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rexEyeNormal;\nvarying float rexEyeSide;\nuniform float rexEyeSplit;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nrexEyeNormal=normal;\nrexEyeSide=step(rexEyeSplit,position.x);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 rexEyeNormal;\nvarying float rexEyeSide;\nuniform vec3 rexEyeLeft;\nuniform vec3 rexEyeRight;\nuniform float blink;\nuniform float eyeShine;')
   .replace('#include <map_fragment>',`vec3 eyeForward=normalize(mix(rexEyeLeft,rexEyeRight,rexEyeSide));
    vec3 eyeRight=normalize(cross(vec3(0.0,1.0,0.0),eyeForward));
    vec3 eyeUp=cross(eyeForward,eyeRight);
    vec3 eyeNormal=normalize(rexEyeNormal);
    vec2 eyeUV=vec2(dot(eyeNormal,eyeRight),dot(eyeNormal,eyeUp))*.23+.5;
    diffuseColor*=texture2D(map,eyeUV);
    // Dark limbal ring, then an upper lid that sweeps down on each blink.
    float eyeR=length(eyeUV-.5);diffuseColor.rgb*=mix(1.,.62,smoothstep(.15,.225,eyeR));
    float lidEdge=mix(.78,.2,blink)+.9*(eyeUV.x-.5)*(eyeUV.x-.5);
    float eyeOpen=1.-smoothstep(lidEdge-.015,lidEdge+.015,eyeUV.y);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.055,.038,.028),1.-eyeOpen);`)
   // Night eye shine: a tapetum behind the pupil returns the flashlight beam.
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.95,1.,.42)*eyeShine*9.*smoothstep(.2,.08,eyeR)*eyeOpen;');
 };
 material.customProgramCacheKey=()=> 'rex-converging-eyes-v3';
 // Natural blinks every few seconds; impacts can force one.
 let blinkAge=1,nextBlink=2.4;const blinkCurve=a=>a<.07?a/.07:a<.1?1:Math.max(0,1-(a-.1)/.11);
 const inverse=new T.Matrix4(),localTarget=new T.Vector3(),desired=new T.Vector3();
 const boneInverse=mesh.skeleton.boneInverses[mesh.skeleton.bones.indexOf(head)];
 return{centers,directions,uniforms,blink(){if(blinkAge>.25)blinkAge=0;},reset(){directions.forEach(d=>d.set(0,0,1));blinkAge=1;nextBlink=2.4;uniforms.blink.value=0;},update(dt,target){
  if(dt<=0)return;
  blinkAge+=dt;nextBlink-=dt;if(nextBlink<=0){blinkAge=0;nextBlink=2.2+Math.random()*4.5;}uniforms.blink.value=blinkAge<.21?blinkCurve(blinkAge):0;
  inverse.copy(head.matrixWorld).multiply(boneInverse).multiply(mesh.bindMatrix).invert();
  localTarget.copy(target).applyMatrix4(inverse);
  for(let i=0;i<2;i++){
   desired.subVectors(localTarget,centers[i]);
   // Stop at a natural range if she turns away or the camera crosses her face.
   // The authored sockets cover the inner halves of the eyes. A small outward
   // optical bias keeps the pupil visible under the brow as the gaze converges.
   const bias=i===0?-.50:.50;
   const yaw=bias+T.MathUtils.clamp(Math.atan2(desired.x,desired.z),-.65,.65)*.70;
   const pitch=T.MathUtils.clamp(Math.atan2(desired.y,Math.hypot(desired.x,desired.z)),-.55,.45);
   desired.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
   directions[i].lerp(desired,1-Math.exp(-dt*13)).normalize();
  }
 }};
}
