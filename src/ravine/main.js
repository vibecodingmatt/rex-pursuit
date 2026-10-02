import * as T from 'three';
import {installAtmosphericFog,createSky,createEnvironmentMap} from '../chase/atmosphere.js';
import {createPost} from '../chase/post.js';
import {TIERS,detectTier,storedQuality,storeQuality,createGovernor} from '../chase/graphics.js';
import {createJeep} from '../chase/jeep.js';
import {createEffects} from '../chase/effects.js';
import {dustTexture} from '../chase/foliage.js';
import {ChaseAudio} from '../chase/audio.js';
import {createPointerControls} from '../chase/pointer-controls.js';
import {createScreenBlood} from '../chase/screen-blood.js';
import {activateCheat,createCheatInput,createCheatBadge} from '../chase/cheats.js';
import {createScoreboard,readBoard,saveRun} from '../chase/scoreboard.js';
import {campaignProgress,completeChapter} from '../chase/campaign.js';
import {RAVINE,RavineRound,sectionAt} from './rules.js';
import {createRaptors} from './raptors.js';
import {createRavine} from './world.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// This continuation is also the in-session fallback when browser storage is
// unavailable. It is a convenience unlock in a local game, not an auth token.
const entry=new URL(location.href),continuing=entry.searchParams.get('continue')==='1';
if(continuing){completeChapter(1);entry.searchParams.delete('continue');history.replaceState(null,'',entry);}
const unlocked=campaignProgress().ravine;
installAtmosphericFog();
const renderer=new T.WebGLRenderer({canvas:$('scene'),antialias:false,powerPreference:'high-performance'});renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.info.autoReset=false;
const scene=new T.Scene();scene.background=new T.Color(0xaaab9f);scene.fog=new T.FogExp2(0xaaab9f,.0068);scene.environment=createEnvironmentMap(renderer);scene.environmentIntensity=.38;
const camera=new T.PerspectiveCamera(56,innerWidth/innerHeight,.045,280),post=createPost(renderer),governor=createGovernor(),detected=detectTier(renderer);
let quality=storedQuality(),tier=quality==='auto'?detected.tier:quality;
const sun=new T.DirectionalLight(0xffd1a0,3.8);sun.position.set(-10,48,-36);sun.target.position.set(0,0,15);sun.castShadow=true;sun.shadow.normalBias=.025;sun.shadow.bias=-.00025;Object.assign(sun.shadow.camera,{left:-27,right:27,top:38,bottom:-25,near:1,far:125});scene.add(sun,sun.target);
const hemi=new T.HemisphereLight(0xc4d6d6,0x766653,1);scene.add(hemi);const rim=new T.DirectionalLight(0xafd1da,.75);rim.position.set(15,17,40);scene.add(rim);const fill=new T.DirectionalLight(0xffe4bd,.8);fill.position.set(3,9,-20);scene.add(fill);
const sky=createSky(scene);sky.palette(scene.fog.color,0x7cabbf);sky.uniforms.sunDir.value.subVectors(sun.position,sun.target.position).normalize();
const jeep=createJeep(scene),effects=createEffects(scene,dustTexture()),audio=new ChaseAudio(),round=new RavineRound(),blood=createScreenBlood(camera,{reducedMotion:reduced}),badge=createCheatBadge();
const scores=createScoreboard({root:$('ravine-scoreboard'),title:'RAVINE · LOCAL TOP FIVE',noun:'repelled',load:cheated=>readBoard('ravine',cheated)});
let world=null,pack=null,ready=false,mode='loading',view='first',firing=false,time=0,last=performance.now(),freeze=false,radioAge=0,shake=0,flash=0,hitAge=0,ending=0,audioInit=null,starting=false,dustClock=0;
const aim=new T.Vector2(0,.06),raycaster=new T.Raycaster(),aimTarget=new T.Vector3(),muzzle=new T.Vector3(),point=new T.Vector3(),cameraTo=new T.Vector3(),lookTo=new T.Vector3(),look=new T.Vector3(0,2,15),ground=new T.Plane(new T.Vector3(0,1,0),0);
const vehicle={phase:'pursuit',phaseTime:0,distance:20,reload:0,ammo:80,result:null,time:0};
const markers=Array.from({length:4},()=>{const el=document.createElement('div');el.className='threat';el.hidden=true;el.innerHTML='<span>STOP THE LEAP</span>';$('threats').append(el);return el;});
const cheat=createCheatInput({isPlaying:()=>mode==='playing'&&!round.result,activate:code=>{if(activateCheat(round,code)){badge.update(round);audio.cue(true);}}});
function setMode(value){mode=value;document.body.dataset.state=value;cheat.reset();if(value!=='playing')controls.reset();}
function reticle(){const x=(aim.x*.5+.5)*innerWidth,y=(.5-aim.y*.5)*innerHeight;for(const id of ['reticle','hit-marker']){$(id).style.left=`${x}px`;$(id).style.top=`${y}px`;}}
const controls=createPointerControls({canvas:$('scene'),fireButton:$('fire'),isPlaying:()=>mode==='playing'&&round.phase==='chase'&&!round.result,onAim:p=>{aim.set(p.x/innerWidth*2-1,1-p.y/innerHeight*2);reticle();},onFire:value=>firing=value,onGrenade:grenade,onContact:()=>{}});
function resize(){controls.reset();renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<.8?100:56;camera.updateProjectionMatrix();reticle();}
addEventListener('resize',resize);
function applyQuality(){tier=quality==='auto'?detected.tier:quality;const t=TIERS[tier];renderer.setPixelRatio(Math.min(devicePixelRatio,t.pixelRatio));governor.setRange(t.scale);governor.reset();sun.shadow.mapSize.set(t.shadow,t.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;post.configure({scale:governor.scale,msaa:t.msaa,bloomLevels:t.bloomLevels,volumetric:null,ao:t.ao,motionBlur:reduced?0:.35,grain:.024});effects.setQuality(t);blood.setQuality(t);world?.setQuality(t);resize();}
$('quality').value=quality;$('quality').onchange=()=>{quality=$('quality').value;storeQuality(quality);applyQuality();};applyQuality();
function radio(title,copy,seconds=5){$('radio-title').textContent=title;$('radio-copy').textContent=copy;radioAge=seconds;}
function pause(){if(!['playing','paused'].includes(mode))return;const p=mode==='playing';setMode(p?'paused':'playing');$('pause-screen').hidden=!p;audio.pause(p);}
$('pause').onclick=$('resume').onclick=pause;
$('sound').onclick=()=>{$('sound').textContent=audio.mute()?'SOUND OFF':'SOUND ON';};
function changeView(){view=view==='first'?'third':'first';$('view').textContent=view==='first'?'3RD':'1ST';}
$('view').onclick=$('pause-view').onclick=changeView;$('reload').onclick=()=>{if(mode==='playing')round.startReload();};$('grenade').onclick=grenade;
$('credits-open').onclick=()=>{$('credits').showModal();};$('credits-close').onclick=()=>$('credits').close();
addEventListener('keydown',e=>{if(cheat.key(e)){e.preventDefault();return;}if(e.target.closest('input,select,textarea,[contenteditable]')||(e.code==='Space'&&e.target.closest('button,a')))return;if(['Space','KeyR','KeyV','Escape','KeyP'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Escape'||e.code==='KeyP')pause();if(e.code==='KeyV')changeView();if(mode!=='playing')return;if(e.code==='KeyR')round.startReload();if(e.code==='Space')grenade();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});addEventListener('blur',()=>{if(mode==='playing')pause();});
for(const kind of ['pointerdown','keydown'])addEventListener(kind,e=>{if(e.isTrusted&&mode==='playing'&&audio.context?.state!=='running')audio.pause(false).catch(()=>{});},{passive:true});
async function start({automatic=false}={}){
 if(!ready||!unlocked||starting)return;starting=true;
 try{
  audioInit??=audio.init().then(()=>{if(mode==='paused'||mode==='ended')return audio.pause(true);}).catch(e=>console.warn('Ravine audio:',e.message));
  if(!automatic){const resumed=audio.pause(false);await audioInit;await resumed;}
  audio.stopCalls();controls.reset();round.reset();pack.reset();world.reset();effects.reset();blood.reset();jeep.reset();badge.update(false);firing=false;time=ending=shake=flash=hitAge=dustClock=0;aim.set(0,.06);reticle();view='first';look.set(0,2,17);camera.position.set(.06,2.4,-.45);camera.lookAt(look);
  $('end-screen').hidden=$('pause-screen').hidden=$('start-screen').hidden=true;setMode('playing');radio('CHAPTER 02 · RAPTOR RAVINE','Stay on the road. Stop the pack before it reaches the Jeep.',7);hud();
 }finally{starting=false;}
}
$('start').onclick=()=>start();$('restart').onclick=()=>start();
function nearest(){scene.updateMatrixWorld(true);raycaster.setFromCamera(aim,camera);return pack.hit(raycaster.ray);}
function shoot(){
 if(mode!=='playing'||!round.shoot())return false;const target=nearest();jeep.shoot();audio.gun();jeep.muzzle.getWorldPosition(muzzle);const end=target?.point||(raycaster.ray.intersectPlane(ground,point)&&point.distanceTo(camera.position)<100?point:raycaster.ray.at(70,point));effects.trace(muzzle,end);shake=Math.max(shake,.02);
 if(target){const dead=round.hit(target.id,{head:target.head});effects.burst(target.point,true);audio.hit('flesh',target.distance,target.point);hitAge=.13;if(dead&&target.distance<9)blood.splash(target.point);}
 else if(end.y<.1)effects.burst(end,false);return true;
}
function grenade(){
 if(mode!=='playing'||!round.launchGrenade())return false;const target=nearest(),end=target?.point.clone()||(raycaster.ray.intersectPlane(ground,point)&&point.distanceTo(camera.position)<75?point.clone():raycaster.ray.at(28,new T.Vector3()));
 jeep.muzzle.getWorldPosition(muzzle);effects.trace(muzzle,end);effects.burst(end,!!target,true);audio.impact(true);shake=.3;hitAge=.2;
 for(const a of pack.pool){if(a.root.visible&&a.data.phase!=='dead'&&(a.id===target?.id||a.body.distanceTo(end)<5)){if(round.hit(a.id,{explosive:true})&&a.body.distanceTo(camera.position)<9)blood.splash(a.head);}}
 return true;
}
function events(){for(const e of round.drain()){
 const actor=e.id?pack.get(e.id):null,at=actor?.body;
 if(e.type==='reload')audio.reload();
 if(e.type==='spawn')audio.call('raptor',at);
 if(e.type==='warn'){audio.debrisWarning();radio('RAPTOR CLOSING','Shoot the marked hunter before it leaps.',2.3);}
 if(e.type==='leap')audio.call('raptor',at);
 if(e.type==='kill'){audio.death('raptor',at);if(at)effects.bodyImpact(at,.45);}
 if(e.type==='damage'){flash=.6;shake=.45;audio.impact();}
 if(e.type==='section'){if(e.section===1)radio('02 / UNDER THE VIADUCT','They are using both shoulders. Keep your bursts short.',6);else radio('03 / NORTH PASS','The evacuation gate is ahead. Hold them off a little longer.',6);}
 if(e.type==='escape'){controls.reset();radio('THROUGH THE GATE','Closing the barrier. We are clear!',6);audio.cue(true);view='third';}
 if(e.type==='won'||e.type==='lost'){setMode('ending');ending=0;audio.stopCalls();}
 }}
function finish(){
 setMode('ended');$('end-screen').hidden=false;audio.update(0,0,false,false);audio.pause(true);const won=round.result==='won';
 $('end-eyebrow').textContent=won?'CHAPTER 02 COMPLETE':'THE PACK CAUGHT UP';$('end-title').textContent=won?'The gate holds.':'They found a way.';
 const progress=won?completeChapter(2):null;$('end-copy').textContent=won?`The pack is sealed behind the north pass. Both chapters complete.${progress.saved?'':' Progress could not be saved on this browser.'}`:'Focus the marked raptor before it leaps. Grenades clear a tight pack while you reload.';
 $('end-stats').textContent=`${round.kills} REPELLED · ${Math.round(round.jeep)}% JEEP · ${round.shots?Math.min(100,Math.round(round.hits/round.shots*100)):0}% HIT RATE`;
 scores.show(saveRun('ravine',{cheated:round.cheated,kills:round.kills,score:round.kills*150+(won?1000+Math.round(round.jeep)*10:0)}));$('restart').focus({preventScroll:true});
}
function hud(){
 $('sector').textContent=['01 / THE CUT','02 / VIADUCT','03 / NORTH PASS'][sectionAt(round.time)];$('remaining').textContent=round.phase==='escape'?'CLEAR':`${Math.ceil(round.remaining)}s`;$('route-progress').style.width=`${round.time/RAVINE.duration*100}%`;
 $('integrity').innerHTML=`${Math.ceil(round.jeep)}<small>%</small>`;$('integrity-bar').style.width=`${round.jeep}%`;$('kills').textContent=`${round.kills} REPELLED`;$('ammo').textContent=round.infiniteAmmo?'∞':String(round.ammo).padStart(3,'0');$('heat').style.width=`${round.heat*100}%`;$('weapon-status').textContent=round.reload>0?`RELOADING ${round.reload.toFixed(1)}s`:round.heat>.9?'LET IT COOL':'READY';$('grenade-state').textContent=round.infiniteRockets?'∞':round.grenade>0?`${Math.ceil(round.grenade)}s`:'READY';
 $('damage-flash').style.opacity=flash;$('hit-marker').style.opacity=Math.min(1,hitAge*10);$('radio').style.opacity=radioAge>0?1:0;
 let n=0;for(const a of pack?.pool||[]){if(mode!=='playing'||!a.root.visible||!['warn','leap'].includes(a.data.phase))continue;const p=a.head.clone().project(camera),el=markers[n++];if(!el)break;el.hidden=p.z>1;el.classList.toggle('leap',a.data.phase==='leap');el.style.left=`${T.MathUtils.clamp((p.x*.5+.5)*innerWidth,38,innerWidth-38)}px`;el.style.top=`${T.MathUtils.clamp((.5-p.y*.5)*innerHeight,165,innerHeight-175)}px`;el.firstChild.textContent=a.data.phase==='leap'?'INCOMING':`LEAP IN ${Math.max(0,1.85-a.data.age).toFixed(1)}s`;}
 for(;n<markers.length;n++)markers[n].hidden=true;
}
const preview={time:0,escapeTime:0,attackers:[{id:900,side:1,lane:-3.1,x:-3.1,z:8,hp:150,phase:'run',age:0,seed:.3}]};
function step(dt){
 const sim=mode==='playing'?dt:0,active=mode==='playing'||mode==='menu'||mode==='ending';if(active)time=(time+dt)%600;
 if(mode==='playing')round.tick(dt);
 const speed=mode==='playing'?8.5:0;
 if(mode==='menu'){preview.attackers[0].age+=dt;preview.attackers[0].x=camera.aspect<.8?-.3:-3.1;pack.update(dt,preview,2);world.update(0,preview,0);}
 else if(mode==='playing')pack.update(sim,round,speed);
 if(mode==='playing'){world.update(sim,round,speed);dustClock+=sim;if(dustClock>.14){dustClock=0;for(const x of [-1,1])effects.groundDust(new T.Vector3(x,.07,1.5),new T.Vector3(x*.2,.16,0),{size:.3,growth:1.7,opacity:.14,life:1.5,color:0xb4a185});}}
 if(mode==='ending'){ending+=dt;if(ending>1.5)finish();}
 if(mode!=='paused'&&mode!=='ended'){
  const portrait=camera.aspect<.8,third=view==='third';
  if(mode==='menu'){cameraTo.set(portrait?.2:-3.7,portrait?2.8:3.1,portrait?1:-4.8);lookTo.set(portrait?-.3:1.2,portrait?-1.25:2,portrait?10:11);}
  else if(third){cameraTo.set(portrait?-5.8:-7,4.4,-8.8);lookTo.set(0,1.65,11);}
  else{cameraTo.set(.06,2.4,-.45);lookTo.set(0,2.05,17);}
  const blend=1-Math.exp(-dt*5);camera.position.lerp(cameraTo,blend);look.lerp(lookTo,blend);if(!reduced&&sim){camera.position.y+=Math.sin(time*18)*.008;camera.position.x+=Math.sin(time*47)*shake*.1;}camera.lookAt(look);camera.updateMatrixWorld();
 }
 jeep.root.visible=!(mode==='menu'&&camera.aspect<.8);
 Object.assign(vehicle,{reload:round.reload,ammo:round.ammo,time});raycaster.setFromCamera(aim,camera);raycaster.ray.at(30,aimTarget);if(active)jeep.update(dt,time,speed,aimTarget,view==='third'||mode==='menu',vehicle);
 effects.update(sim,speed);blood.update(sim);shake=Math.max(0,shake-sim*2);flash=Math.max(0,flash-sim*1.7);hitAge=Math.max(0,hitAge-sim);radioAge=Math.max(0,radioAge-sim);
 if(mode==='playing'){if(firing)shoot();events();}
 audio.listen(camera,null);audio.update(speed,sim,mode==='playing',false);hud();
}
function render(now){requestAnimationFrame(render);const raw=Math.max(0,(now-last)/1000),dt=Math.min(.05,raw);last=now;if(mode==='loading'||document.hidden)return;if(!freeze)step(dt);sky.update(camera,time);renderer.info.reset();if(post.supported)post.render(scene,camera,{time,sun,overlay:effects.soft.render});else renderer.render(scene,camera);if(governor.sample(raw*1000,mode==='playing'||mode==='menu'))post.configure({scale:governor.scale});}
requestAnimationFrame(render);
async function load(){try{
 [pack,world]=await Promise.all([createRaptors(scene),createRavine(scene)]);world.setQuality(TIERS[tier]);world.reset();pack.onFoot=(p,speed)=>{if(mode!=='playing')return;effects.groundDust(p,new T.Vector3(0,.2,0),{size:.16,growth:.7,opacity:.2,life:.8,color:0xa38e73});if(p.z<18)audio.footstep(.045,p);};
 setMode('menu');step(1);$('loading-status').textContent='Preparing light and shadow…';await post.prepare(scene,camera);ready=true;
 if(!unlocked){$('chapter-status').textContent='CHAPTER 02 / LOCKED';$('start').textContent='BEAT THE T. REX TO UNLOCK';$('loading-status').textContent='Win Rex Pursuit, then choose Next level from the victory screen.';}
 else{$('start').disabled=false;$('start').textContent='RUN THE RAVINE ↗';$('loading-status').textContent='Mouse: hold to fire. Touch: drag to aim, hold FIRE.';if(continuing)await start({automatic:true});}
 }catch(e){$('loading-status').textContent=`The ravine could not load. Reload to retry. (${e.message})`;console.error(e);}}
load();
window.ravine={round,scene,camera,renderer,jeep,audio,post,blood,get pack(){return pack;},get world(){return world;},get ready(){return ready;},get mode(){return mode;},get view(){return view;},get freeze(){return freeze;},set freeze(v){freeze=v;},start,pause,step,shoot,grenade,aimAt(p){aim.copy(p.clone().project(camera));reticle();},snapshot(){return{mode,time:round.time,phase:round.phase,result:round.result,jeep:round.jeep,kills:round.kills,live:round.live.length,actors:pack?.pool.filter(a=>a.root.visible).length,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}};
