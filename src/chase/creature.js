import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {ImpactDamage} from './damage.js';
import {RunGait} from './locomotion.js';
import {DeathMotion} from './death-motion.js';
import {finishTongue} from '../creature-materials.js';
import {openingPose} from './opening.js';
import {AMBUSH,ambushPose} from './ambush.js';
import {RULES} from './combat.js';
import {DEFEAT,defeatPose} from './defeat.js';
import {createGaze} from './gaze.js';
import {createRexSkin,finishRexDetails,markGape} from './rex-skin.js';
const X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0),Z=new T.Vector3(0,0,1);
const menuLike=state=>state.distance===20&&state.phaseTime===0&&state.phase==='pursuit';
export async function createRex(scene,onProgress){
 const draco=new DRACOLoader().setDecoderPath('./draco/');const loader=new GLTFLoader().setDRACOLoader(draco);
 const gltf=await loader.loadAsync('./models/rex-hero.glb',onProgress);draco.dispose();
 const actor=new T.Group();actor.rotation.y=Math.PI;actor.position.z=24;scene.add(actor);actor.add(gltf.scene);
 const bones=[],meshes=[],rest=new Map(),damage=new ImpactDamage(),hide=createRexSkin();let skin;
 gltf.scene.traverse(o=>{if(o.isBone){bones.push(o);rest.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});}if(o.isMesh){meshes.push(o);o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material.envMapIntensity=.45;if(o.name==='Rex_Skin'){skin=o;o.material.roughness=1;o.material.envMapIntensity=.3;damage.install(o.material,hide);}if(o.material.name==='GlassMat'){o.material.transparent=true;o.material.opacity=.26;}}});
 meshes.forEach(finishTongue);
 markGape(skin);
 damage.prepareStages(skin);
 const find=prefix=>bones.find(b=>b.name.startsWith(prefix));const q=new T.Quaternion();
 const pose=(prefix,angle,axis=X)=>{const b=find(prefix);if(b)b.quaternion.multiply(q.setFromAxisAngle(axis,angle));};
 actor.updateMatrixWorld(true);
 const gait=new RunGait(actor,find);
 const death=new DeathMotion(actor,meshes,bones,rest,gait,pose);
 const updateSkeleton=()=>{actor.updateMatrixWorld(true);for(const m of meshes)if(m.isSkinnedMesh){m.skeleton.update();m.boundingSphere=new T.Sphere(new T.Vector3(0,2,0),16);m.boundingBox=null;}};
 let reaction=0,breathPhase=0,lastVocal={jaw:0,energy:0};const head=find('head_');
 const eyeMesh=meshes.find(m=>m.name==='Rex_Eyes');eyeMesh.geometry.computeBoundingBox();const gaze=createGaze(eyeMesh,head);
 finishRexDetails(meshes,gaze.uniforms);
 // Skinned lip landmarks keep the fatal first-person framing between the jaws.
 const mouthIndices=[[.18,4.04,6.97],[.20,3.62,6.75]].map(site=>{const p=skin.geometry.attributes.position;let best=Infinity,index=0;for(let i=0;i<p.count;i++){const d=(p.getX(i)-site[0])**2+(p.getY(i)-site[1])**2+(p.getZ(i)-site[2])**2;if(d<best){best=d;index=i;}}return index;});
 const mouthPoints=[new T.Vector3(),new T.Vector3()];
 // Bone-attached spheres roughly covering the body, for per-frame gun aiming only
 // (hits still use the skinned mesh).
 const proxies=[['head_',1.05],['neck_03_',.95],['neck_01_',1.05],['back_04_',1.45],['back_03_',1.5],['back_02_',1.45],['back_01_',1.25],['tail_02_',.9],['tail_05_',.6],['leg_01_L_',.85],['leg_01_R_',.85],['leg_02_L_',.75],['leg_02_R_',.75],['leg_03_L_',.5],['leg_03_R_',.5],['foot_02_01_L_',.45],['foot_02_01_R_',.45],['arm_01_L_',.35],['arm_01_R_',.35]].map(([n,r])=>({bone:find(n),r})).filter(p=>p.bone);
 const sphere=new T.Sphere(),hitPoint=new T.Vector3();
 return{actor,meshes,skin,damage,bones,head,gait,death,gaze,hide,
  /** Nearest proxy intersection along a ray, or null. */
  aimHit(ray,out){if(!actor.visible)return null;let best=Infinity;for(const p of proxies){p.bone.getWorldPosition(sphere.center);sphere.radius=p.r;if(ray.intersectSphere(sphere,hitPoint)){const d=hitPoint.distanceTo(ray.origin);if(d<best){best=d;out.copy(hitPoint);}}}return best<Infinity?out:null;},get vocal(){return lastVocal;},hit(){reaction=.16;gaze.blink();},reset(){damage.reset();death.reset();gaze.reset();reaction=0;breathPhase=0;gait.reset();actor.visible=true;},drainMotionEvents(){return [...gait.drainFootfalls(),...death.drainEvents()];},mouthPosition(){mouthIndices.forEach((index,i)=>{skin.getVertexPosition(index,mouthPoints[i]);skin.localToWorld(mouthPoints[i]);});return{upper:mouthPoints[0].clone(),lower:mouthPoints[1].clone(),center:mouthPoints[0].clone().lerp(mouthPoints[1],.5)};},update(dt,state,time,roadSpeed=10,vocal=null){
  damage.setHealth((state.health??RULES.health)/RULES.health,dt);
  if(state.result==='won'){death.update(dt,roadSpeed);updateSkeleton();return;}
  for(const [b,r]of rest){b.position.copy(r.p);b.quaternion.copy(r.q);b.scale.copy(r.s);}
  // Vocalizations are upper-body layers; locomotion never stops for a roar.
  const fatal=state.result==='lost'&&state.defeat?defeatPose(state.defeat.time,state.defeat):null;
  const run=1,opening=!fatal&&state.phase==='intro'&&state.introDuration?openingPose(state.phaseTime,state.introDuration):null;
  const ambush=!fatal&&state.phase==='flank'&&state.ambush?ambushPose(state.phaseTime,state.ambush.distance,state.ambush.x):null,scripted=fatal||opening||ambush;
  const settle=ambush?T.MathUtils.smoothstep(state.phaseTime,7.65,AMBUSH.duration):0;
  const lane=scripted?scripted.x+Math.sin(time*.73)*.7*settle:Math.sin(time*.73)*.7;
  const distance=scripted?scripted.z:state.distance;
  if((opening||ambush)&&!gait.lastPosition&&dt>0){
   const priorTime=state.phaseTime-dt;
   const prior=opening?openingPose(priorTime,state.introDuration):ambushPose(priorTime,state.ambush.distance,state.ambush.x);
   gait.lastPosition=new T.Vector3(prior.x,0,prior.z);
   gait.rootVelocity.set((lane-prior.x)/dt,0,(distance-prior.z)/dt);
   gait.speed=Math.hypot(gait.rootVelocity.x,roadSpeed-gait.rootVelocity.z);
  }
  const motion=gait.advance(dt,new T.Vector3(lane,0,distance),roadSpeed,run,!!fatal&&state.defeat.time>=DEFEAT.walkAt);
  const stride=motion.cycle,heading=scripted?scripted.heading+Math.sin(time*.73)*.027*settle:Math.PI+Math.sin(time*.73)*.027;
  actor.visible=scripted?scripted.visible!==false:true;
  // The body rides down into the river ford with her feet (gait.ground).
  actor.position.set(lane+motion.sway,motion.height+(gait.ground?gait.ground(lane,distance):0),distance);actor.rotation.set(0,heading,motion.roll);
  pose('back_02_',motion.pitch);pose('back_04_',Math.sin(motion.step-.45)*.009*run);
  // Let the torso absorb landings while the gaze remains comparatively steady.
  pose('neck_01_',-.025-motion.pitch*.8);pose('neck_03_',Math.sin(motion.step-1)*.007*run);
  pose('head_',-.04+motion.pitch*.45);pose('head_',Math.sin(time*.7)*.035*(1-(fatal?.look||0)),Y);
  pose('jaw_01_',-.045-Math.sin(motion.step-.35)*.010*run);
  for(let i=1;i<=11;i++){
   pose(`tail_${String(i).padStart(2,'0')}_`,Math.sin(stride-i*.22)*(.010+i*.001)*run,Z);
   pose(`tail_${String(i).padStart(2,'0')}_`,Math.sin(motion.step-.5-i*.16)*.0035*run);
  }
  const armLag=Math.sin(motion.step-.8)*.021*run;
  pose('arm_01_L_',armLag);pose('arm_01_R_',armLag*.91);
  pose('arm_02_L_',-armLag*.5);pose('arm_02_R_',-armLag*.5);
  const branchAge=state.debris?.brokenAt===null?99:state.time-(state.debris?.brokenAt??-99);
  const throughBranch=branchAge>=0&&branchAge<.65?Math.sin(Math.PI*branchAge/.65)*Math.exp(-branchAge*2):0;
  pose('neck_01_',-.085*throughBranch);pose('head_',.10*throughBranch);pose('head_',state.debris?.side*.04*throughBranch||0,Z);
  // The live encounter supplies actual clip playback. Isolated rig reviews can
  // still pose a silent roar without constructing an AudioContext.
  let roar=vocal?.roar||0,jaw=vocal?.jaw||0,bite=0;
  if(!vocal&&state.phase==='intro'){roar=T.MathUtils.smoothstep(state.phaseTime,.15,.8)*(1-T.MathUtils.smoothstep(state.phaseTime,2.8,3.8));jaw=roar;}
  if(!fatal&&state.phase==='bite'){bite=Math.sin(Math.min(1,state.phaseTime/.85)*Math.PI);jaw=Math.max(jaw,1-T.MathUtils.smoothstep(state.phaseTime,.52,.78));}
  if(!fatal&&state.phase==='execution'){bite=T.MathUtils.smoothstep(state.phaseTime,.3,1.35);jaw=Math.max(jaw,T.MathUtils.smoothstep(state.phaseTime,.10,.8));}
  if(!fatal&&state.phase==='ram'){bite=Math.sin(Math.min(1,state.phaseTime/.85)*Math.PI);actor.position.x+=Math.sin(state.phaseTime*5)*1.1;actor.rotation.y+=bite*.16;pose('head_',bite*-.18,Z);}
  if(fatal){jaw=Math.max(fatal.jaw,state.defeat.time<6.5?(vocal?.jaw||0):0);roar=0;pose('neck_01_',-.12*fatal.lean+.14*fatal.rear-.11*fatal.ram+.22*fatal.headLift);pose('neck_03_',-.08*fatal.lean+.095*fatal.rear+.16*fatal.headLift);pose('head_',.045*fatal.lean+.075*fatal.rear+.07*fatal.headLift);pose('back_04_',.018*fatal.rear-.025*fatal.lunge);pose('head_',-.14*fatal.ram,Z);}
  lastVocal={...(vocal||{}),jaw,roar};hide.uniforms.uRexJaw.value=jaw;pose('jaw_01_',-.68*jaw);pose('neck_01_',.10*roar-.23*bite);pose('neck_03_',.065*roar-.16*bite);pose('head_',.035*roar+.07*bite);pose('back_04_',-.065*bite);actor.position.z-=bite;
  // Breathing: the ribcage flares on each inhale. Heavier, faster panting in the
  // chase; held while she roars; a slow, deep rhythm on the final walk-up.
  const exertion=fatal?.55:state.phase==='intro'?.45:menuLike(state)?.25:1;
  breathPhase+=dt*Math.PI*2*(.32+.55*exertion);
  const inhale=Math.pow(.5+.5*Math.sin(breathPhase),1.6)*(1-Math.min(1,roar*1.5))*(.55+.45*exertion);
  for(const side of ['L','R']){const k=side==='L'?1:-1;pose(`ribCage_front_01_${side}_`,k*inhale*.05,Z);pose(`ribCage_back_01_${side}_`,k*inhale*.038,Z);}
  pose('neck_01_',-inhale*.008);pose('jaw_01_',-inhale*.018*exertion);
  reaction=Math.max(0,reaction-dt);const hurt=state.phase==='stunned'?Math.exp(-state.phaseTime*1.7):reaction*.8;pose('head_',hurt*.12);pose('neck_01_',hurt*.1);pose('head_',hurt*.13,Z);pose('jaw_01_',hurt*-.13);
  const recoil=fatal?T.MathUtils.smoothstep(state.defeat.time,DEFEAT.ram+.1,DEFEAT.ram+.5)*(1-T.MathUtils.smoothstep(state.defeat.time,DEFEAT.spinEnd,DEFEAT.walkAt)):0;
  actor.updateMatrixWorld(true);gait.solve(dt,actor.rotation.y,!!fatal||!!ambush||(!!opening&&state.phaseTime<state.introDuration-3.2),recoil);actor.updateMatrixWorld(true);
  updateSkeleton();
 },headPosition(){return head.getWorldPosition(new T.Vector3());}};
}
