import * as T from 'three';
import {installAtmosphericFog,createSky,createEnvironmentMap,createCanopy,SUN_DIRECTION} from './chase/atmosphere.js';
import {createPost} from './chase/post.js';
import {TIERS,ORDER,detectTier,storedQuality,storeQuality,createGovernor} from './chase/graphics.js';
import {createJungle} from './chase/environment.js';
import {createJeep} from './chase/jeep.js';
import {createRex} from './chase/creature.js';
import {createEffects} from './chase/effects.js';
import {ChaseAudio} from './chase/audio.js';
import {Encounter,RULES} from './chase/combat.js';
import {openingPose,createOpeningScenery} from './chase/opening.js';
import {createTargets} from './chase/targets.js';
import {createDebris} from './chase/debris.js';
import {AMBUSH} from './chase/ambush.js';
import {DEFEAT,defeatPose,defeatVision} from './chase/defeat.js';
import {createPointerControls} from './chase/pointer-controls.js';
import {createSwallow} from './chase/swallow.js';
import {VICTORY,victoryPose} from './chase/victory.js';
import {createVisitorCenter} from './chase/visitor-center.js';
import {setupSharing} from './chase/share.js';
import {createBirds} from './chase/birds.js';
import {createWeather} from './chase/weather.js';
import {createMud} from './chase/mud.js';
import {createSkid} from './chase/skid.js';
import {createNight} from './chase/night.js';
import {createCritters} from './chase/critters.js';
import {createInsects} from './chase/insects.js';
import {createBrachio} from './chase/brachio.js';
import {createFlyers} from './chase/flyers.js';
import {createFord} from './chase/ford.js';
import {createRexCoat} from './chase/rex-coat.js';
import {SPECIES,isRare} from './chase/safari-rules.js';
import {createSafariDirector} from './chase/safari-director.js';
import {createSafariUI} from './chase/safari-ui.js';
import {createSafariFx} from './chase/safari-fx.js';
const $=s=>document.querySelector(s),canvas=$('#scene');
installAtmosphericFog();
const renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;renderer.info.autoReset=false;
const post=createPost(renderer),governor=createGovernor(),detected=detectTier(renderer);let quality=storedQuality(),autoTier=detected.tier;
const JUNGLE={fog:0x74825f,density:.0138,zenith:0x7ea8c6};let weather=null,night=null;
const scene=new T.Scene();scene.background=new T.Color(JUNGLE.fog);scene.fog=new T.FogExp2(JUNGLE.fog,JUNGLE.density);
const camera=new T.PerspectiveCamera(56,innerWidth/innerHeight,.045,240);
scene.environment=createEnvironmentMap(renderer);scene.environmentIntensity=.38;
// Key sun high over the left verge, cool sky rim from behind the animal, soft
// fill from the Jeep side, warm earth bounce from below.
const hemi=new T.HemisphereLight(0xa9bf9a,0x463a26,.6);scene.add(hemi);
const sun=new T.DirectionalLight(0xffd9a6,4.1);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.normalBias=.04;sun.shadow.bias=-.00025;
// Keep the rim the second directional light (the sun sorts first as the only shadow caster):
// foliage leaves it out by that slot (plant() in foliage.js), since it has no shadows.
const rim=new T.DirectionalLight(0xc4d4e4,.6);rim.position.set(-6,10,34);scene.add(rim);
const fill=new T.DirectionalLight(0xdce3d4,.62);fill.position.set(7,6,-12);scene.add(fill);
const sky=createSky(scene),canopy=createCanopy(scene,sun);
// Location lighting sets every value the storm blends from, then records it.
function baseLights(){sun.intensity=4.1;sun.color.setHex(0xffd9a6);fill.intensity=.62;scene.environmentIntensity=.38;hemi.color.setHex(0xa9bf9a);hemi.groundColor.setHex(0x463a26);rim.position.set(-6,10,34);}
function jungleLighting(){
 baseLights();scene.background.setHex(JUNGLE.fog);scene.fog.color.setHex(JUNGLE.fog);scene.fog.density=JUNGLE.density;
 sun.target.position.set(0,0,13);sun.position.copy(sun.target.position).addScaledVector(SUN_DIRECTION,55);
 Object.assign(sun.shadow.camera,{left:-28,right:28,top:31,bottom:-31,near:4,far:125});sun.shadow.camera.updateProjectionMatrix();
 sky.palette(scene.fog.color,JUNGLE.zenith);sky.uniforms.sunDir.value.copy(SUN_DIRECTION);canopy.enabled=true;rim.intensity=.6;hemi.intensity=.62;
 weather?.captureBase({sun,hemi,rim,fill,post});
}
function tierName(){return quality==='auto'?autoTier:quality;}
function applyQuality(){
 const t=TIERS[tierName()];renderer.setPixelRatio(Math.min(devicePixelRatio,t.pixelRatio));governor.setRange(t.scale);governor.reset();
 if(sun.shadow.mapSize.x!==t.shadow){sun.shadow.mapSize.set(t.shadow,t.shadow);sun.shadow.map?.dispose();sun.shadow.map=null;}
 post.configure({scale:governor.scale,msaa:t.msaa,bloomLevels:t.bloomLevels,volumetric:t.volumetric,ao:t.ao});jungle?.setQuality?.(t);critters?.setQuality(t);flyers?.setQuality(t);insects?.setQuality(t);brachio?.setQuality(t);effects?.setQuality?.(t);weather?.setQuality(t);night?.setQuality(t);mud?.setQuality(t);skid?.setQuality(t);ford?.setQuality(t);
 document.body.dataset.quality=tierName();document.body.dataset.post=post.supported?'on':'off';document.querySelectorAll('[data-quality]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quality===quality)));
 const gpu=(detected.gpu.match(/(rtx|gtx|rx|arc|radeon|apple md|adreno|mali|intel|iris|uhd)[^,(]*/i)?.[0]||'').replace(/s+/g,' ').trim().toUpperCase();
 document.querySelectorAll('.quality-readout').forEach(e=>e.textContent=`Rendering ${t.label.toUpperCase()}${quality==='auto'?' (auto)':''}${gpu?' · '+gpu:''} · ${t.volumetric?'volumetric light':'light shafts'} · ${t.msaa}× MSAA`);
 document.querySelectorAll('.quality-readout-inline').forEach(e=>e.textContent=`${t.label.toUpperCase()} QUALITY`);
 resize();
}
function setQuality(next){if(next!=='auto'&&!TIERS[next])return;quality=next;storeQuality(next);autoTier=detected.tier;applyQuality();}
jungleLighting();
const jungleRoot=new T.Group();scene.add(jungleRoot);
const jungle=createJungle(jungleRoot,{canopy}),jeep=createJeep(scene),effects=createEffects(scene,jungle.dustMap),audio=new ChaseAudio(),state=new Encounter();
const visitorCenter=createVisitorCenter(scene);
const swallow=createSwallow(renderer);
const opening=createOpeningScenery(scene,jungle.dustMap);let targets;
const ambushScenery=createOpeningScenery(scene,jungle.dustMap,{offsetZ:-6,anchorAt:1.28});
ambushScenery.root.scale.x=-1;
const debris=createDebris(scene,camera,$('#target-layer'));
const birds=createBirds(scene);
const mud=createMud(scene);effects.splash=(p,strength)=>mud.burst(p,strength);
const skid=createSkid(scene,{effects,mud});
// The river ford: a chunk of road where a jungle river crosses; the Jeep rides down its banks.
const ford=createFord(scene,{jungle,effects,mud,canopy}),drips=[];jeep.ground=(x,z)=>jungle.fordDip(x,z);
ford.onSplash=(kind,at,strength)=>audio.splash(kind,at,strength);
const raycaster=new T.Raycaster(),pointer=new T.Vector2(),aimTarget=new T.Vector3(0,3.7,16);let rex,coat,mode='loading',view='first',firing=false,breathClock=0,stomp=0,stompVel=0,stompOffset=0,time=0,last=performance.now(),shake=0,gunKick=0,hitTime=0,damageFlash=0,endTime=0,frameCount=0,freeze=false;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
weather=createWeather(scene,{renderer,sky,makeEnvironment:createEnvironmentMap,reducedMotion});weather.captureBase({sun,hemi,rim,fill,post});
weather.onThunder=(delay,near)=>audio.thunder(delay,near);
night=createNight(scene,{jeep,weather,renderer});
// Living jungle: compies, lizards and Gallimimus herds that flee the chase, pterosaurs in the
// trees and the sky, insects, a passing brachiosaur. All but the insects can be shot.
const critters=createCritters(scene,{jungle,camera}),flyers=createFlyers(scene,{jungle,camera}),insects=createInsects(scene,{night}),brachio=createBrachio(scene,{jungle});
const safariDirector=createSafariDirector({critters,flyers,birds,vector:new T.Vector3()});
const safariFx=createSafariFx($('#safari-fx'),camera);
// The picked mode is remembered, and the title screen follows it: the Rex (and the brachiosaur) for
// the chase, the Safari roster crossing the road for Safari.
const MODE_KEY='rex-pursuit-mode';
function storedMode(){try{return localStorage.getItem(MODE_KEY)==='safari'?'safari':'pursuit';}catch{return 'pursuit';}}
function menuScene(){if(mode!=='menu')return;const safari=safariUI.selected==='safari';if(rex)rex.actor.visible=!safari;if(safari)safariDirector.resetParade();}
const safariUI=createSafariUI({state,director:safariDirector,reducedMotion,onSelect:picked=>{try{localStorage.setItem(MODE_KEY,picked);}catch{}menuScene();}});
let lastNotice=null;
critters.onScatter=p=>audio.chirp(p);critters.onHerd=p=>audio.herd(p);brachio.onCall=p=>audio.brachio(p);flyers.onFlush=p=>audio.flush(p);flyers.onCall=p=>audio.screech(p);
critters.onKill=flyers.onKill=birds.onKill=(p,kind)=>audio.death(kind,p);critters.onCall=(p,kind)=>audio.call(kind,p);
// A shot Gallimimus or pterosaur hitting the ground throws up dirt.
critters.onLand=(p,s)=>{effects.bodyImpact(p,.45*s);audio.groundImpact(.2*s,p);};flyers.onLand=(p,s)=>{effects.bodyImpact(p,.35*s);audio.groundImpact(.12*s,p);};
// Dropping back onto her forefeet from a rear-up: dust, a ground-shaking thud, and everything small bolts.
brachio.onStomp=feet=>{for(const p of feet){effects.bodyImpact(p,1.7);critters.alarm(p,24);flyers.alarm(p,30);}audio.groundImpact(1.2,feet[0]);const d=Math.hypot(feet[0].x,feet[0].z);shake=Math.max(shake,.55*T.MathUtils.clamp(1-(d-12)/60,0,1));};
function setConditions(kind,instant=mode==='paused'){weather.set(kind,{instant});weather.apply({sun,hemi,rim,fill,post});night.update(0,{camera,rex,ground:jungleRoot.visible});document.querySelectorAll('[data-conditions]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.conditions===weather.kind)));document.body.dataset.conditions=weather.kind;updateLightButton();}
// The picker offers Day, Storm (the default for a first visit), Night and Night + Storm.
const OFFERED=['clear','storm','night','night-storm'];
document.querySelectorAll('[data-conditions]').forEach(b=>b.onclick=()=>setConditions(b.dataset.conditions));
function toggleFlashlight(){if(!night.active)return;night.toggleFlashlight();updateLightButton();}
function updateLightButton(){const b=$('#touch-light');if(!b)return;b.setAttribute('aria-pressed',String(night.flashlightOn));b.querySelector('small').textContent=night.flashlightOn?'ON':'OFF';}
$('#touch-light').onclick=()=>mode==='playing'&&toggleFlashlight();
setConditions(OFFERED.includes(weather.kind)?weather.kind:'storm',true);
// ?fps shows frame rate, frame time, tier and render scale for performance checks.
const fpsMeter=new URLSearchParams(location.search).has('fps')?Object.assign(document.body.appendChild(document.createElement('div')),{id:'fps-meter'}):null;let fpsFrames=0,fpsSince=performance.now();
if(fpsMeter)fpsMeter.style.cssText='position:fixed;left:8px;top:8px;z-index:9999;padding:3px 7px;font:600 11px/1.3 ui-monospace,monospace;color:#e8f0d8;background:#000a;pointer-events:none;white-space:pre';
const hud={boss:$('#boss-fill'),trail:$('#boss-trail'),percent:$('#boss-percent'),phase:$('#boss-phase'),jeep:$('#jeep-value'),jeepFill:$('#jeep-fill'),ammo:$('#ammo-value'),heat:$('#heat-fill'),weapon:$('#weapon-state'),distance:$('#distance'),grenade:$('#grenade-state'),warning:$('#warning'),warningTitle:$('#warning-title'),warningTip:$('#warning-tip'),reticle:$('#reticle'),hit:$('#hit-marker'),hitLabel:$('#hit-label'),flash:$('#damage-flash')};
const arcade={clock:$('#mission-clock'),time:$('#time-left'),pressure:$('#pressure-level'),card:$('#challenge-card'),name:$('#challenge-name'),seconds:$('#challenge-seconds'),instruction:$('#challenge-instruction'),fill:$('#challenge-fill'),progress:$('#challenge-progress')};
const touchHud={fire:$('#touch-fire'),fireStatus:$('#touch-fire small'),reload:$('#touch-reload'),reloadStatus:$('#touch-reload small'),grenade:$('#touch-grenade'),grenadeStatus:$('#touch-grenade small'),contact:$('#touch-contact')};let controls;
function resize(){controls?.reset();renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();swallow.resize(innerWidth,innerHeight);moveReticle();}addEventListener('resize',resize);applyQuality();
document.querySelectorAll('[data-quality]').forEach(b=>b.onclick=()=>setQuality(b.dataset.quality));
function setMode(next){mode=next;document.body.dataset.state=next;if(next!=='playing')controls?.reset();}
function setView(next){if(state.result==='lost'&&next!=='first'||state.result==='won'&&next!=='third')return;view=next;document.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===view));}
function moveReticle(){const x=(pointer.x*.5+.5)*innerWidth,y=(-pointer.y*.5+.5)*innerHeight;hud.reticle.style.left=`${x}px`;hud.reticle.style.top=`${y}px`;}
controls=createPointerControls({canvas,fireButton:touchHud.fire,isPlaying:()=>mode==='playing'&&!state.result,
 onAim:point=>{pointer.set(point.x/innerWidth*2-1,1-point.y/innerHeight*2);moveReticle();},onFire:held=>firing=held,onGrenade:grenade,
 onContact:point=>{touchHud.contact.hidden=!point;if(!point)return;touchHud.contact.style.left=`${point.x}px`;touchHud.contact.style.top=`${point.y}px`;const dx=point.aim.x-point.x,dy=point.aim.y-point.y;touchHud.contact.style.setProperty('--reach',`${Math.max(0,Math.hypot(dx,dy)-22)}px`);touchHud.contact.style.setProperty('--angle',`${Math.atan2(dx,-dy)}rad`);}});
touchHud.reload.onclick=()=>mode==='playing'&&state.startReload();touchHud.grenade.onclick=grenade;
document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>setView(b.dataset.camera));$('#grenade').onclick=grenade;
addEventListener('keydown',e=>{if(e.target.matches('input,textarea')||(e.code==='Space'&&e.target.closest('button,a')))return;if(['Space','KeyR','KeyV','Escape','KeyP','KeyM','KeyF'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='KeyV')setView(view==='first'?'third':'first');if(e.code==='KeyM')toggleSound();if(e.code==='KeyF'&&mode==='playing')toggleFlashlight();if((e.code==='Escape'||e.code==='KeyP')&&['playing','paused'].includes(mode))pause();if(mode!=='playing')return;if(e.code==='KeyR')state.startReload();if(e.code==='Space')grenade();});
function toggleSound(){const muted=audio.mute();$('#sound').textContent=muted?'SOUND OFF':'SOUND ON';$('#sound').setAttribute('aria-label',muted?'Unmute sound':'Mute sound');}$('#sound').onclick=toggleSound;
function pause(){firing=false;const paused=mode==='playing';setMode(paused?'paused':'playing');$('#pause-screen').hidden=!paused;audio.pause(paused);hud.warning.style.opacity=0;}
$('#pause').onclick=()=>['playing','paused'].includes(mode)&&pause();$('#resume').onclick=pause;document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});
addEventListener('blur',()=>{controls.reset();if(mode==='playing')pause();});
$('#credits-open').onclick=()=>$('#credits').showModal();$('#credits-close').onclick=()=>$('#credits').close();
async function start(){
 if(!rex)return;controls.reset();$('#start').disabled=true;$('#start-label').textContent='STARTING THE ENGINE';
 try{await audio.init();}catch(e){console.warn('Audio initialization failed',e.message);}
 audio.stopCalls();state.reset();if(safariUI.selected==='safari')state.startSafari();safariDirector.reset();safariUI.reset();
 state.introDuration=Math.max(RULES.intro,RULES.roarAt+(audio.buffers.get(audio.roles.opening)?.duration||3.64)/.95+1.5);
 rex.reset();coat.reset();effects.reset();night.reset();updateLightButton();mud.reset();skid.reset();ford.reset();birds.reset();jeep.reset();jungle.reset();critters.reset({intro:!state.safari});flyers.reset();safariFx.reset();lastNotice=null;insects.reset();brachio.reset();opening.reset();ambushScenery.reset();targets?.reset();debris.reset();swallow.reset();visitorCenter.reset();sharing.reset();
 jungleRoot.visible=true;rex.actor.visible=!state.safari;jungleLighting();canopy.reset();
 $('#arrival-caption').style.opacity=0;
 time=0;endTime=0;shake=0;stomp=stompVel=stompOffset=0;damageFlash=0;hitTime=0;hud.hit.style.opacity=hud.hitLabel.style.opacity=0;firing=false;pointer.set(0,.08);moveReticle();
 $('#fatal-blood').style.opacity=$('#fatal-black').style.opacity=0;jeep.root.visible=true;updateVision();
 camera.position.set(.06,2.4,-.45);cameraLook.set(state.safari?0:-10,3.2,16);camera.lookAt(cameraLook);
 $('#start-screen').hidden=true;$('#end-screen').hidden=true;$('#pause-screen').hidden=true;setMode('playing');updateHud();
}
$('#start').onclick=start;$('#restart').onclick=start;
function showMenu(){
 controls.reset();audio.pause(false);audio.stopCalls();audio.update(0,0,false,false);audio.river(0,null,0);state.reset();rex.reset();coat.reset();effects.reset();mud.reset();skid.reset();ford.reset();birds.reset();jungle.reset();critters.reset();flyers.reset();brachio.reset();opening.reset();ambushScenery.reset();targets.reset();debris.reset();swallow.reset();visitorCenter.reset();jeep.reset();safariFx.reset();
 jungleRoot.visible=rex.actor.visible=jeep.root.visible=true;jungleLighting();canopy.reset();time=endTime=shake=stomp=stompVel=stompOffset=damageFlash=0;
 $('#fatal-blood').style.opacity=$('#fatal-black').style.opacity=$('#arrival-caption').style.opacity=0;document.body.dataset.cinematic='';hud.warning.style.opacity=0;arcade.clock.hidden=arcade.card.hidden=true;$('#safari-hud').hidden=true;
 $('#end-screen').hidden=$('#pause-screen').hidden=true;$('#start-screen').hidden=false;$('#start').disabled=false;setMode('menu');safariUI.select(safariUI.selected);$('#start').focus({preventScroll:true});
}
document.querySelectorAll('[data-menu]').forEach(b=>b.onclick=showMenu);
const sharing=setupSharing({button:$('#share-game'),copyButton:$('#copy-game-link'),status:$('#share-status'),fallback:$('#share-fallback'),input:$('#share-link'),getState:()=>state});
// World point under the reticle: Rex proxy, else the ground, else far down range.
const groundPlane=new T.Plane(new T.Vector3(0,1,0),0);
function aimPoint(out){if(rex?.actor.visible&&!state.concealed&&rex?.aimHit(raycaster.ray,out))return out;if(raycaster.ray.intersectPlane(groundPlane,out)&&out.distanceTo(raycaster.ray.origin)<90)return out;return raycaster.ray.at(80,out);}
function getHit(){scene.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);raycaster.far=170;return rex.actor.visible&&!state.concealed?raycaster.intersectObjects(rex.meshes,false)[0]:undefined;}
function weaponHit(hit,explosive){const rest=rex.damage.add(hit,explosive),head=rest?rest.z>4.75:false;state.hit(head,explosive);rex.hit();effects.burst(hit.point,true,explosive);showHit(explosive?'EXPLOSIVE HIT':'HIT');}
function showHit(label,color='#eee8c9'){
 hitTime=.18;hud.hit.style.left=hud.hitLabel.style.left=hud.reticle.style.left;hud.hit.style.top=hud.reticle.style.top;hud.hitLabel.style.top=`${(-pointer.y*.5+.5)*innerHeight+28}px`;hud.hitLabel.textContent=label;hud.hit.style.color=color;
}
function targetHit(index,explosive=false){
 if(index<0||!state.hitTarget(index,explosive))return;
 showHit('TARGET HIT','#ffe2a0');
}
// Wildlife in the line of fire: the nearest animal closer than `far` (the Rex, when she is hit).
// Small ones have a hit sphere that never drops below about 12 px (18 on touch).
function wildlifeHit(far){
 const px=innerHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2))),min=(matchMedia('(pointer:coarse)').matches?18:12)/px,ray=raycaster.ray;
 let best=null;for(const h of [critters.hit(ray,far,min),flyers.hit(ray,far,min),birds.hit(ray,far,min),state.safari?null:brachio.hit(ray)])if(h&&h.distance<far&&(!best||h.distance<best.distance))best=h.kind?h:{...h,kind:'brachio'};
 return best;
}
const WILDLIFE={compy:['COMPY','compies',1],lizard:['LIZARD','lizards',.6],gallimimus:['GALLIMIMUS','gallimimus',2.4],dimorphodon:['DIMORPHODON','dimorphodons',1],pteranodon:['PTERANODON','pteranodons',2],bird:['BIRD','birds',.7]};
/** Tally a kill and show it with the running count. */
function bag(kind,point){if(state.result||state.safari?.ready)return;state.bagged(kind);const points=state.safari?.award(kind);
 if(!points){showHit(`${WILDLIFE[kind]?.[0]||SPECIES[kind]?.name||kind} DOWN · ${state.bagTotal}`,'#f3c89a');return;}
 safariFx.pop(point||aimTarget,points,kind,state.safari.multiplier);showHit('','#f3c89a');
 if(kind==='goldenCompy'&&point)effects.glint(point);
 if(isRare(kind)){safariUI.flash(`${SPECIES[kind].name.toUpperCase()} BAGGED`,SPECIES[kind].rarity==='Legendary'?'legendary':'trophy');audio.rare(SPECIES[kind].rarity==='Legendary');}}
// Blood by body size for the Safari animals (the chase wildlife sizes are in WILDLIFE).
const PUFF={raptor:1.8,ghostRaptor:1.8,dilophosaurus:2.2,pachycephalosaurus:2,parasaurolophus:2.8,triceratops:3,stegosaurus:3,quetzalcoatlus:2.6,goldenCompy:1};
function wildlifeStrike(b,explosive=false){
 const dir=raycaster.ray.direction;
 if(b.kind==='brachio'){if(!explosive)effects.burst(b.point,true);brachio.startle();showHit('');return;}
 const power=explosive?2.4:1,killed=b.kind==='bird'?birds.kill(b.index,dir,power):b.target?flyers.strike(b.target,dir,power,explosive?4:1):critters.strike(b.critter,dir,power,explosive?4:1);
 const puff=WILDLIFE[b.kind]?.[2]||PUFF[b.kind]||2;
 if(killed){effects.critter(b.point,dir,puff);bag(b.kind,b.point);}
 else if(state.safari){effects.critter(b.point,dir,puff*.4);safariFx.focus(b.target||b.critter,b.kind);showHit('');}
}
/** Everything a blast kills: tallied, with the last shown. */
function blastWildlife(p,radius){const dead=[...critters.blast(p,radius),...flyers.blast(p,radius),...birds.blast(p,radius)],at=new T.Vector3();dead.forEach((k,i)=>bag(k,at.set(p.x+(i%3-1)*1.3,p.y+1.2+Math.floor(i/3)*.9,p.z)));return dead.length;}
function debrisHit(hit,explosive=false){if(!state.hitDebris(hit.id,explosive))return;effects.burst(hit.point,false,explosive);showHit(state.debris.status==='cleared'?'DEBRIS CLEARED':'DEBRIS HIT','#ffb38e');}
function shoot(){
 if(mode!=='playing'||!state.fire())return false;
 const rexHit=getHit(),threat=debris.hit(raycaster.ray,rexHit?.distance),target=threat?-1:targets?.hit(raycaster.ray,state)??-1,origin=jeep.muzzle.getWorldPosition(new T.Vector3());
 // Debris and numbered targets keep priority; otherwise a compy or the brachiosaur nearer than the Rex takes the round.
 const beast=threat||target>=0?null:wildlifeHit(rexHit?.distance??170),hit=beast?null:rexHit;
 const end=threat?threat.point:hit?hit.point:target>=0?targets.targets[target].world:beast?beast.point:aimPoint(new T.Vector3());
 effects.trace(origin,end);jeep.shoot();audio.gun();gunKick=.035;critters.alarm(end,end.y<.3?4:2.5);flyers.nearMiss(raycaster.ray,end.distanceTo(raycaster.ray.origin));
 const water=!threat&&!hit&&!beast&&target<0&&end.y<.05&&ford.depth(end)>.03;
 {const dist=end.distanceTo(origin);if(threat)audio.hit('wood',dist,end);else if(hit||target>=0||beast)audio.hit('flesh',dist,end);else if(water)audio.hit('water',dist,end);else if(end.y<.05)audio.hit('dirt',dist,end);}
 if(threat)debrisHit(threat);else if(hit)weaponHit(hit,false);else if(target>=0){state.hit(false);effects.burst(end,true);}
 else if(beast)wildlifeStrike(beast);
 else if(water)ford.impact(end);
 else if(end.y<.05)effects.burst(end,false);
 targetHit(target);return !!threat||!!hit||target>=0||!!beast;
}
function grenade(){
 if(mode!=='playing'||!state.launch())return false;
 const rexHit=getHit(),threat=debris.hit(raycaster.ray,rexHit?.distance),target=threat?-1:targets?.hit(raycaster.ray,state)??-1,origin=jeep.muzzle.getWorldPosition(new T.Vector3());
 const beast=threat||target>=0?null:wildlifeHit(rexHit?.distance??170),hit=beast?null:rexHit;
 // A round aimed at the road bursts on it, not 40 m down the line of sight below the surface.
 const road=raycaster.ray.intersectPlane(groundPlane,new T.Vector3()),open=road&&road.distanceTo(raycaster.ray.origin)<40?road:raycaster.ray.at(40,new T.Vector3());
 const point=threat?threat.point:hit?hit.point:target>=0?targets.targets[target].world:beast?beast.point:open;
 effects.trace(origin,point);if(threat)debrisHit(threat,true);else if(hit)weaponHit(hit,true);else{effects.burst(point,false,true);if(beast?.kind==='brachio')wildlifeStrike(beast,true);if(point.y<.8&&ford.impact(point,true))audio.splash('blast',point);if(target>=0)state.hit(false,true);}
 blastWildlife(point,5.5);
 targetHit(target,true);audio.impact(true);critters.alarm(point,16);flyers.alarm(point,18);shake=.2;return !!threat||!!hit||target>=0||!!beast;
}
function updateHud(){
 const health=state.health/RULES.health;hud.boss.style.transform=hud.trail.style.transform=`scaleX(${health})`;hud.percent.textContent=`${Math.ceil(health*100)}%`;
 hud.phase.textContent=({intro:'JUNGLE BREAKOUT',pursuit:'IN PURSUIT',warning:'ATTACK INCOMING',challenge:'BREAK THE ATTACK',charge:'CLOSING FAST',bite:'BRACE FOR IMPACT',ram:'SIDE IMPACT',recover:'REGAINING GROUND',stunned:'ATTACK REPELLED',execution:'OVERRUN'})[state.phase]||'IN PURSUIT';
 if(state.phase==='flank')hud.phase.textContent=state.phaseTime<AMBUSH.vanish?'BREAKING OFF':state.phaseTime<AMBUSH.crashAt?'CONTACT LOST':'TOO CLOSE';
 $('#boss-status').textContent=state.tier===2?'RELENTLESS':health<.3?'ENRAGED':health<.65?'WOUNDED':'APEX PREDATOR';
 hud.jeep.textContent=state.jeep;hud.jeepFill.style.transform=`scaleX(${state.jeep/100})`;hud.jeepFill.style.background=state.jeep<30?'#e67950':'#e8be75';
 hud.ammo.textContent=String(state.ammo).padStart(3,'0');hud.heat.style.transform=`scaleX(${state.reload?1-state.reload/RULES.reload:state.heat})`;hud.heat.style.background=state.overheated?'#e9794b':'#d4b171';
 hud.weapon.textContent=state.phase==='intro'?'HOLD FIRE':state.phase==='execution'?'OVERRUN':state.reload?`RELOADING ${state.reload.toFixed(1)}s`:state.overheated?'COOLING':state.ammo===0?'PRESS R':'READY';
 if(state.ammo===0&&!state.reload&&matchMedia('(pointer:coarse)').matches)hud.weapon.textContent='TAP RELOAD';
 touchHud.fireStatus.textContent=state.weaponsLocked?'WAIT':state.reload?'RELOADING':state.overheated?'COOLING':'HOLD';
 touchHud.fire.classList.toggle('waiting',!!state.reload||state.overheated||state.weaponsLocked);
 touchHud.reloadStatus.textContent=state.reload?`${state.reload.toFixed(1)}s`:state.ammo===RULES.magazine?'FULL':'READY';
 touchHud.reload.setAttribute('aria-disabled',String(!!state.reload||state.ammo===RULES.magazine||!!state.result));
 touchHud.grenadeStatus.textContent=state.grenade?`${Math.ceil(state.grenade)}s`:'READY';touchHud.grenade.setAttribute('aria-disabled',String(state.grenade>0||state.weaponsLocked||!!state.result));
 hud.distance.textContent=`${Math.max(0,Math.round(state.distance-7))} m · ${state.phase==='charge'?'CLOSING FAST':'IN PURSUIT'}`;hud.grenade.textContent=state.grenade?`${Math.ceil(state.grenade)}s`:'READY';
 const o=state.objective,challenge=state.phase==='challenge'&&o?.status==='active'&&!state.result;
 document.body.dataset.cinematic=state.result==='lost'?'defeat':state.result==='won'?'victory':state.phase==='intro'?'intro':state.phase==='flank'?'flank':challenge?'challenge':'';
 arcade.clock.hidden=state.phase==='intro';const remaining=Math.ceil(state.remaining);arcade.time.textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;arcade.clock.classList.toggle('urgent',remaining<=20);arcade.pressure.textContent=`PRESSURE ${['I','II','III'][state.tier]}`;
 arcade.card.hidden=!challenge;
 if(state.phase==='flank'){arcade.pressure.textContent=state.phaseTime<AMBUSH.vanish?'BREAKING OFF':'CONTACT LOST';hud.distance.textContent=state.phaseTime<AMBUSH.crashAt?'SEARCHING THE TREELINE':'RIGHT BEHIND US';if(state.phaseTime>=AMBUSH.crashAt)arcade.pressure.textContent='CONTACT REGAINED';}
 if(challenge){arcade.name.textContent=['BREAK THE LUNGE','STOP THE RUSH','BREAK THE FRENZY'][o.tier];arcade.seconds.textContent=`${o.remaining.toFixed(1)}s`;arcade.instruction.textContent=`Shoot ${o.order.length} numbered targets in order · ${o.hitsRequired} hit${o.hitsRequired===1?'':'s'} each`;arcade.fill.style.transform=`scaleX(${o.remaining/o.duration})`;arcade.progress.textContent=`TARGET ${o.current+1} / ${o.order.length}`;arcade.card.classList.toggle('critical',o.remaining<1.3);}
 const incoming=state.debris?.status==='active'&&!state.result;$('#challenge-hazard').classList.toggle('incoming',incoming);$('#challenge-hazard').textContent=incoming?`DEBRIS IN ${(state.debris.duration-state.debris.age).toFixed(1)}s`:'MISS IT → TAKE A HIT';
 let title='',tip='';
 if(state.phase==='flank'){
  const t=state.phaseTime;
  title=t<2.35?'SHE’S BREAKING OFF':t<5.6?'DID WE LOSE HER?':t<AMBUSH.crashAt?'':'SHE’S RIGHT BEHIND US!';
  tip=t>=2.35&&t<5.6?(t<3.1?'RELOAD · WATCH THE TREES':'SHOOT THE COMPIES · WATCH THE TREES'):t>=AMBUSH.fireAt?'OPEN FIRE!':'';
 }
 if(state.phase==='intro'){const t=state.phaseTime,launch=state.introDuration-3.2;title=t<1.25?'SOMETHING IN THE TREES':t<RULES.roarAt?'HOLD ON':t<launch?'DON’T. MOVE.':'GO! GO! GO!';tip=t<launch?'':'90 SECONDS TO STOP HER';}
 if(state.phase==='warning'){title='TARGETS INCOMING';tip='SHOOT THE NUMBERED WEAK POINTS · GET READY';}
 if(state.phase==='charge'){title=state.attackCommitted?'TOO SLOW':'BREAK THE CHARGE';tip=state.attackCommitted?'SHE’S COMMITTED · BRACE FOR IMPACT':`AIM FOR THE HEAD · ${Math.max(0,10-state.stagger)} HITS TO STAGGER`;}
 if(state.phase==='bite'||state.phase==='ram'){title=state.phase==='ram'?'SIDE IMPACT':'BRACE FOR IMPACT';}
 if(state.phase==='stunned'){title='ATTACK REPELLED';tip='RELOAD WHILE SHE FALLS BACK';}
 if(incoming&&['pursuit','recover','stunned'].includes(state.phase)){title='INCOMING DEBRIS';tip=`SHOOT THE RED TARGET · ${state.debris.hitsRequired-state.debris.hits} HITS · HE CLEARS IT`;}
 if(state.phase==='execution'){title='TIME’S UP';tip='SHE’S GOT US';}
 if(state.result==='won'){title=tip='';hud.phase.textContent='PREDATOR DOWN';$('#boss-status').textContent='DEFEATED';hud.distance.textContent='THREAT NEUTRALIZED';}
 if(state.result==='lost'){title=tip='';arcade.card.hidden=true;}
 hud.warningTitle.textContent=title;hud.warningTip.textContent=tip;hud.warning.style.opacity=title&&mode==='playing'?1:0;hud.warning.classList.toggle('danger',['charge','bite','ram','execution'].includes(state.phase));
}
function handleEvents(){for(const event of state.drainEvents()){
 if(event==='safari-complete'){controls.reset();state.reload=0;audio.cue(true);finish();}
 if(event==='flank')audio.stopCalls();
 if(event==='contact-lost'){audio.stopCalls();critters.stream(1,{count:6,delay:.35,over:1.3});critters.stream(1,{count:7,delay:2,over:1.6});}
 if(event==='ambush-rustle')audio.woodBreak(.35);
 if(event==='ambush-crash'){critters.alarm(new T.Vector3(4,0,9),25);effects.bodyImpact(new T.Vector3(4,.04,9),1.5);audio.woodBreak();audio.groundImpact(.95);audio.roar();shake=.85;audio.birds();birds.scatter(new T.Vector3(9,13,16),{spread:10,count:14});flyers.alarm(new T.Vector3(8,8,12),25);}
 if(event==='jungle-crash'){effects.bodyImpact(new T.Vector3(-5.5,.04,16),1.3);audio.impact();audio.groundImpact(.85);shake=.35;}
 if(event==='opening-roar'){critters.alarm(rex.actor.position,40);flyers.alarm(rex.actor.position,40);audio.roar(true);audio.birds();birds.scatter(new T.Vector3(-4,15,38),{spread:22});}
 if(event==='jeep-launch')shake=.12;
 if(event==='warning'&&!audio.voice)audio.roar();
 if(event==='challenge')audio.cue();
 if(event==='charge')audio.growl();
 if(['bite','ram','execution'].includes(event))audio.bite();
 if(event==='target-cleared')audio.cue();
 if(event==='objective-cleared')audio.cue(true);
 if(event==='branch-break'){debris.breakBranch(state.debris);audio.woodBreak(.75);shake=Math.max(shake,.16);}
 if(event==='debris-incoming')audio.debrisWarning();
 if(event==='debris-cleared'){debris.shatter();audio.cue(true);}
 if(event==='debris-impact'){debris.shatter();audio.groundImpact(.45);}
 if(event==='impact'){shake=state.lossReason==='timeout'?1:.8;damageFlash=.85;audio.impact();}
 if(event==='stunned'){shake=.13;audio.pain(true);}
 if(event==='reload')audio.reload();
 if(event==='won'){
  audio.stopCalls();audio.pain(true);controls.reset();endTime=0;damageFlash=0;state.reload=0;
  state.victory={time:0,arrival:false,exterior:view==='third',camera:camera.position.toArray(),look:cameraLook.toArray(),fov:camera.fov};
  setView('third');targets.reset();debris.reset();
 }
 if(event==='lost'){
  audio.stopCalls();audio.growl();controls.reset();endTime=0;damageFlash=0;shake=.16;
  state.defeat={time:0,x:rex.actor.position.x,z:rex.actor.position.z,heading:rex.actor.rotation.y,speed:state.phase==='execution'?Math.max(1,10-state.phaseTime*6):10,cues:new Set()};
  if(state.objective)state.objective.status='cancelled';if(state.debris)state.debris.status='cancelled';targets.reset();debris.reset();
  setView('first');camera.position.set(.06,2.4,-.45);cameraLook.set(0,3.4,12);camera.lookAt(cameraLook);camera.fov=62;camera.updateProjectionMatrix();
 }
}}
function handleMotionEvents(playing,speed){for(const e of rex.drainMotionEvents()){
 if(e.type==='footstep'){
  // In the river a footfall is a plunge (ford.js); just out of it the foot is still streaming.
  const wade=ford.footfall(e.position,e.speed,e.side);
  critters.alarm(e.position,4+Math.min(6,e.speed*.5));if(wade!=='water'){effects.footstep(e.position,e.speed);mud.step(e.position,e.speed,e.side,wade||0);if(playing&&!state.result)coat.step(e.speed);}if(playing&&!(state.result==='lost'&&endTime>DEFEAT.contact)){const concealed=state.phase==='flank'&&state.phaseTime>=AMBUSH.vanish&&state.phaseTime<AMBUSH.returnAt;audio.footstep(.22*Math.min(1,18/state.distance)*(concealed?.13:1),e.position);
   // Each footfall carries through the ground: a small jolt that grows as she closes.
   // No stomp while aiming at targets or debris: the framing must hold still.
   const aiming=['warning','challenge'].includes(state.phase)||state.debris?.status==='active';
   if(!concealed&&!aiming&&!(state.result==='lost'&&endTime>DEFEAT.openAt-.4)){const d=Math.hypot(e.position.x,e.position.z);stomp=Math.max(stomp,.045*T.MathUtils.clamp(1-(d-7)/13,0,1));}}}
 // The victory fall: each landing (chin, chest, hips, tail) and her last breath.
 if(e.type==='body-impact'){critters.alarm(e.position,14);if(e.part)skid.impact(e,speed);else effects.bodyImpact(e.position,e.strength);if(playing){audio.groundImpact(e.part==='chin'?e.strength*.75:e.strength,e.position);if(e.part==='chest')audio.impact();shake=Math.max(shake,e.strength*(e.part==='chest'||e.part==='hips'?.38:.22));}}
 if(e.type==='body-slide')effects.bodySlide(e.position,e.strength);
 if(e.type==='exhale')skid.exhale(e);
}}
function finish(){
 if(state.safari){safariFx.reset();setMode('ended');audio.stopCalls();audio.update(0,0,false,false);audio.river(0,null,0);$('#end-screen').hidden=false;hud.warning.style.opacity=0;arcade.card.hidden=true;safariUI.finish();sharing.reset();$('#restart').focus({preventScroll:true});return;}
 setMode('ended');audio.stopCalls();$('#end-screen').hidden=false;const won=state.result==='won',timeout=state.lossReason==='timeout';
 $('#end-eyebrow').textContent=won?'VISITOR CENTER REACHED':timeout?'ESCAPE WINDOW CLOSED':'JEEP LOST';$('#end-title').textContent=won?'You made it.':timeout?'Time ran out.':'Too close.';
 $('#end-copy').textContent=won?'The Jeep is safe at the Visitor Center. Take a breath. You earned it.':timeout?'She caught the Jeep. Take her down before the 90-second clock reaches zero.':'Break her attacks with the numbered targets. Shoot incoming debris—or save a grenade to clear it.';
 $('#end-stats').textContent=`${Math.floor(state.fightTime)}s · ${state.objectivesCleared} attacks repelled · ${state.debrisCleared} debris cleared`;
 // The wildlife bag, species by species, on a line of its own.
 const bagged=Object.entries(state.bag).filter(([,n])=>n).map(([k,n])=>`${n} ${n===1?k:WILDLIFE[k][1]}`);
 if(bagged.length){const line=document.createElement('span');line.id='end-bag';line.textContent=`Wildlife bagged: ${bagged.join(' · ')}`;$('#end-stats').append(document.createElement('br'),line);}hud.warning.style.opacity=0;arcade.card.hidden=true;audio.update(0,0,false,false);audio.river(0,null,0);sharing.reset();$('#restart').focus({preventScroll:true});
}
const cameraTarget=new T.Vector3(),cameraPos=new T.Vector3(),cameraLook=new T.Vector3(0,3.16,18),fallFocus=new T.Vector3(),fallLean=new T.Vector3();
function updateCamera(dt){
 if(state.result==='won'&&state.victory){
  const v=state.victory,p=victoryPose(v.time,state.distance),portrait=innerHeight>innerWidth;
  if(p.arrival){
   const crane=reducedMotion?p.crane*.65:p.crane;
   cameraPos.set(p.jeepX+T.MathUtils.lerp(6,portrait?7:16,crane),T.MathUtils.lerp(3.4,portrait?5.5:6.4,crane),p.jeepZ+T.MathUtils.lerp(portrait?25:12,portrait?54:32,p.crane));
   cameraTarget.set(p.jeepX,1.8,p.jeepZ-3).lerp(new T.Vector3(0,8.2,-72),.3+p.crane*.6);
   camera.fov=portrait?64:54;
  }else{
   cameraPos.fromArray(v.camera);if(!v.exterior)cameraPos.add(fallLean.set(portrait?.3:.5,.32,.1).multiplyScalar(p.lean));
   cameraPos.lerp(new T.Vector3(portrait?-3.4:-5.2,4.5,-8),p.pullback);
   cameraTarget.fromArray(v.look).lerp(new T.Vector3(0,2.5,10),p.pullback);let fov=T.MathUtils.lerp(v.fov,portrait?68:58,p.pullback);
   // Follow her down: the look tracks her chest and the lens pushes in by distance.
   if(rex&&p.watch>0){rex.actor.localToWorld(fallFocus.set(0,2.3,3.4));fallFocus.y=Math.min(fallFocus.y,2.6);const d=fallFocus.distanceTo(cameraPos),tight=T.MathUtils.clamp(2*Math.atan((portrait?6:4.4)/d)*57.3,18,fov),k=p.watch*(reducedMotion?.5:1);cameraTarget.lerp(fallFocus,k*.9);fov=T.MathUtils.lerp(fov,tight,k);}
   camera.fov=fov;
  }
  camera.position.copy(cameraPos);cameraLook.copy(cameraTarget);camera.lookAt(cameraLook);camera.updateProjectionMatrix();camera.updateMatrixWorld();return;
 }
 const menu=mode==='menu'||mode==='loading',third=view==='third'||menu,intro=mode==='playing'&&state.phase==='intro',challenge=state.phase==='challenge'&&!state.result;let fov=56;
 const fatal=state.result==='lost'&&state.defeat?defeatPose(state.defeat.time,state.defeat):null;
 if(menu){cameraPos.set(-4+Math.sin(time*.11)*.7,3+Math.sin(time*.17)*.22,-1.3+Math.sin(time*.07)*.5);cameraTarget.set(2.2,2.65+Math.sin(time*.13)*.12,17);fov=48;}
 else if(third){cameraPos.set(-3.6,4.6,-8.4);cameraTarget.set(0,2.6,10);fov=58;}
 else{cameraPos.set(.06,2.40,-.45);cameraTarget.set(0,3.16,18);}
 // In Safari the road is the subject: look over the receiver so tiny crossers
 // remain visible, especially on portrait screens. Chase framing stays intact.
 if(state.safari&&!menu&&!third){cameraPos.y=3.05;cameraTarget.set(0,2.5,24);fov=60;}
 if(intro){const p=openingPose(state.phaseTime,state.introDuration),look=T.MathUtils.smoothstep(state.phaseTime,.8,3.3);cameraPos.set(.06,2.45,-.45);cameraTarget.set(T.MathUtils.lerp(-10,0,look),T.MathUtils.lerp(3.1,3.9,look),16+2*p.launch);fov=T.MathUtils.lerp(64,54,look);}
 else if(challenge){cameraPos.set(...(third?[-2.4,3.55,-5.8]:[.06,2.52,-.40]));cameraTarget.set(0,3.35,13);fov=third?54:52;}
 if(!menu&&state.phase==='flank'){
  const t=state.phaseTime,returning=T.MathUtils.smoothstep(t,6.2,7.15);
  cameraTarget.set(T.MathUtils.lerp(2.8*Math.sin(Math.min(1,t/3)*Math.PI/2),0,returning),T.MathUtils.lerp(3.2,3.65,returning),T.MathUtils.lerp(18,8,returning));
  fov=T.MathUtils.lerp(third?58:56,third?66:65,returning);
  if(innerWidth<600){cameraTarget.y=T.MathUtils.lerp(3.3,4.1,returning);if(third)cameraPos.x=-1.5;else if(rex)cameraTarget.x=T.MathUtils.lerp(cameraTarget.x,rex.headPosition().x,returning*.85);}
 }
 if(challenge&&(innerWidth<600||(matchMedia('(pointer:coarse)').matches&&innerHeight>innerWidth)))cameraTarget.y=4.5+Math.max(0,800-innerHeight)*.0065+(innerHeight<740?.25:0);
 else if(challenge&&innerHeight<570)cameraTarget.y=4.9;
 if(innerWidth<600){fov=intro?70:state.phase==='flank'?72:third?68:64;if(menu){cameraPos.set(3.2,3.3,5);cameraTarget.set(.4,3.3,14);fov=61;}}
 if(fatal){
  const t=state.defeat.time,mouth=rex.mouthPosition(),focus=T.MathUtils.smoothstep(t,DEFEAT.lungeAt+.05,DEFEAT.contact-.04),axis=new T.Vector3(0,1,0),offset=new T.Vector3(fatal.jeepX,0,fatal.jeepZ);
  // Rotate the player's seat with the actual Jeep, so the scenery makes one
  // full revolution while the cage remains anchored around the player.
  cameraPos.set(.06,2.4-Math.sin(Math.PI*T.MathUtils.smoothstep(t,DEFEAT.ram,DEFEAT.spinEnd))*.18,-.45).applyAxisAngle(axis,fatal.jeepYaw).add(offset);
  cameraTarget.set(0,2.95,16).applyAxisAngle(axis,fatal.jeepYaw).add(offset);
  if(t<DEFEAT.ram)cameraTarget.lerp(mouth.center,T.MathUtils.smoothstep(t,0,1.0));
  if(t>=DEFEAT.spinEnd){const gazeY=T.MathUtils.lerp(mouth.center.y,3.25,fatal.look*(1-focus));cameraTarget.lerp(new T.Vector3(mouth.center.x,gazeY,Math.max(fatal.jeepZ+2,mouth.center.z+1.4)),T.MathUtils.smoothstep(t,DEFEAT.spinEnd,5.4));cameraPos.x=T.MathUtils.lerp(cameraPos.x,mouth.center.x,focus);cameraPos.y=T.MathUtils.lerp(cameraPos.y,mouth.center.y,focus);}
  fov=T.MathUtils.lerp(innerWidth<600?80:72,innerWidth<600?67:54,T.MathUtils.smoothstep(t,DEFEAT.openAt,DEFEAT.contact));
 }
 // Through the ford the Jeep dips and pitches on the banks; the seat and the chase camera ride with it.
 {const lift=jeep.root.position.y,pitch=jeep.root.rotation.x;if(lift||pitch){cameraPos.y+=lift;cameraTarget.y+=lift-(cameraTarget.z-cameraPos.z)*Math.sin(pitch)*.6;}}
 const intensity=reducedMotion?.2:1,speed=fatal?fatal.speed/10:state.phase==='intro'?openingPose(state.phaseTime,state.introDuration).launch:1;
 if(mode==='playing'){cameraPos.y-=stompOffset*intensity;cameraPos.x+=Math.sin(time*17)*.011*intensity*speed;cameraPos.y+=(Math.sin(time*18)*.014+Math.sin(time*27)*.01)*intensity*speed;cameraPos.x+=(Math.random()-.5)*shake*.32*intensity;cameraPos.y+=(Math.random()-.5)*shake*.2*intensity;cameraTarget.y+=gunKick*6*intensity;}
 if(fatal){camera.position.copy(cameraPos);cameraLook.copy(cameraTarget);}else{camera.position.lerp(cameraPos,1-Math.exp(-dt*7));cameraLook.lerp(cameraTarget,1-Math.exp(-dt*8));}camera.lookAt(cameraLook);camera.fov=T.MathUtils.damp(camera.fov,fov,7,dt);camera.rotation.z+=(Math.sin(time*13)*.0015*speed+Math.sin(time*44)*shake*.024+(fatal?.jeepRoll||0))*intensity;camera.updateProjectionMatrix();camera.updateMatrixWorld();
}
camera.position.set(-5.4,3,-1.3);camera.lookAt(-2.2,2.65,17);
function updateVision(){
 const amount=state.result==='lost'&&state.defeat?defeatVision(state.defeat.time):0,shortEdge=Math.min(innerWidth,innerHeight);
 const radius=+(amount*Math.min(12,Math.max(6,shortEdge*.012))*(reducedMotion?.65:1)).toFixed(3);
 // Blur only the world canvas. Small overscan keeps the filter's transparent
 // edge outside the viewport; both properties follow the paused game clock.
 const filter=radius?`blur(${radius}px)`:'',transform=radius?`scale(${+(1+6*radius/shortEdge).toFixed(5)})`:'';
 if(canvas.style.filter!==filter)canvas.style.filter=filter;
 if(canvas.style.transform!==transform)canvas.style.transform=transform;
 return amount;
}
function renderFrame(now=performance.now()){
 // Camera motion blur by tier, never with reduced motion, and handing over to the defeat blur.
 const vision=updateVision();post.settings.motionBlur=reducedMotion?0:TIERS[tierName()].motionBlur*Math.max(0,1-vision*4);post.settings.aoAmount=swallow.active?0:1;renderer.info.reset();sky.update(camera,now/1000);
 if(!swallow.coversFrame){
  if(post.supported)post.render(scene,camera,{time:now/1000,sun,canopy:canopy.caster.visible&&jungleRoot.visible?canopy:null,overlay:effects.soft.render});
  else{renderer.render(scene,camera);renderer.autoClear=false;effects.soft.render(renderer,camera,null,innerWidth,innerHeight);renderer.autoClear=true;}
 }
 swallow.render();
}
function frame(now){
 // A frame's timestamp can precede the clock sampled during long start-up work;
 // a negative step would make every damped camera/FOV blend diverge.
 requestAnimationFrame(frame);const raw=Math.max(0,now-last),dt=Math.min(.045,raw/1000);last=Math.max(last,now);frameCount++;
 if(!document.hidden&&governor.sample(raw,mode!=='loading'))post.configure({scale:governor.scale});
 if(quality==='auto'&&governor.strained&&ORDER.indexOf(autoTier)>0){autoTier=ORDER[ORDER.indexOf(autoTier)-1];applyQuality();}
 if(mode==='paused'||mode==='ended'||freeze){renderFrame(now);return;}
 time+=dt;const playing=mode==='playing',menu=mode==='menu'||mode==='loading';
 // The Safari clock uses real active time even if a slow frame caps the physics step.
 if(playing&&!state.result)state.tick(state.safari?raw/1000:dt);if(playing)handleEvents();if(mode==='ended'){renderFrame(now);return;}
 let speed=playing?state.phase==='intro'?openingPose(state.phaseTime,state.introDuration).speed:state.phase==='execution'?Math.max(1,10-state.phaseTime*6):10:menu?2.2:5;
 if(playing&&state.result){
  endTime+=dt;
  if(state.result==='lost'&&state.defeat){
   const d=state.defeat;d.time=endTime;const pose=defeatPose(endTime,d);speed=pose.speed;
   for(const [cue,at]of [['ram',DEFEAT.ram],['stopped',DEFEAT.spinEnd],['bite',DEFEAT.biteSound],['contact',DEFEAT.contact],['sealed',DEFEAT.contact+.14],['swallow',DEFEAT.slideAt],['digest',DEFEAT.bellyAt-.85],['splash',DEFEAT.acidAt],['silence',DEFEAT.black]])if(endTime>=at&&!d.cues.has(cue)){d.cues.add(cue);if(cue==='ram'){audio.vehicleCrash();effects.bodyImpact(new T.Vector3(.9,.04,.5),1.15);shake=1;}if(cue==='stopped'){audio.stopCalls();audio.growl();}if(cue==='bite')audio.bite();if(cue==='contact'){audio.impact();audio.groundImpact(.95);shake=.75;}if(cue==='sealed')audio.stopCalls();if(cue==='swallow'){audio.stopCalls();audio.swallow(DEFEAT.acidAt-DEFEAT.slideAt+.1);}if(cue==='digest')audio.digest();if(cue==='splash')audio.acidSplash();if(cue==='silence')audio.stopCalls();}
   if(endTime>=DEFEAT.ram&&endTime<DEFEAT.spinEnd&&Math.floor(endTime*14)!==d.skidTick){d.skidTick=Math.floor(endTime*14);for(const side of [-1,1]){const wheel=new T.Vector3(side,.04,1.16).applyAxisAngle(new T.Vector3(0,1,0),pose.jeepYaw).add(new T.Vector3(pose.jeepX,0,pose.jeepZ));effects.bodySlide(wheel,.55*speed/10);}}
   $('#fatal-blood').style.opacity=pose.blood;$('#fatal-black').style.opacity=pose.black;
  }else if(state.victory){
   const v=state.victory;v.time=endTime;const pose=victoryPose(endTime,state.distance);speed=pose.speed;
   if(pose.arrival&&!v.arrival){v.arrival=true;baseLights();visitorCenter.root.visible=true;jungleRoot.visible=false;opening.reset();ambushScenery.reset();effects.reset();mud.reset();skid.reset();ford.reset();birds.reset();audio.stopCalls();scene.background.setHex(0xbac8c4);scene.fog.color.setHex(0xbac8c4);scene.fog.density=.004;sun.position.set(-30,50,-35);sun.target.position.set(0,4,-80);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:.5,far:150});sun.shadow.camera.updateProjectionMatrix();
    // Open sky over the Visitor Center: no canopy, a brighter dome and softer rim.
    canopy.enabled=false;sky.palette(scene.fog.color,0x8fb8d8);sky.uniforms.sunDir.value.subVectors(sun.position,sun.target.position).normalize();rim.intensity=.45;hemi.intensity=1.45;weather.captureBase({sun,hemi,rim,fill,post});}
   $('#fatal-black').style.opacity=pose.black;$('#arrival-caption').style.opacity=pose.caption;
  }
  if(state.result==='won'?endTime>=VICTORY.duration&&rex.death.complete:endTime>=DEFEAT.duration)finish();
 }
 jungle.update(dt,speed,time);canopy.update(dt,speed);opening.update(dt,state.phaseTime,speed,playing&&state.phase==='intro');
 const ambushTime=state.ambush?state.time-state.ambush.startedAt+endTime:0,breakoutTime=ambushTime-(AMBUSH.crashAt-1.28);
 ambushScenery.update(dt,breakoutTime,speed,playing&&!!state.ambush&&breakoutTime>0&&breakoutTime<6);
 const vocal=audio.vocalPose(dt);
 if(rex&&(!state.safari||menu)&&!(menu&&!rex.actor.visible)){const actorState=menu?{phase:'pursuit',phaseTime:0,distance:20,result:null}:state;rex.update(dt,actorState,time,speed,vocal);if(state.victory?.arrival)rex.actor.visible=false;handleMotionEvents(playing,speed);
  if(state.result==='won'&&rex.death.active&&!state.victory?.arrival){const contacts=rex.death.contacts;skid.contacts(contacts,dt,speed,rex.death.heading);let scrape=0,at=null;for(const c of contacts)if(!c.kind.startsWith('foot')&&c.slip*Math.min(1,c.load)>scrape){scrape=c.slip*Math.min(1,c.load);at=c.position;}if(playing)audio.skid(Math.min(1,scrape/7),at,dt);}
  skid.update(dt,speed,jungleRoot.visible&&!state.victory?.arrival);
  // Humid-air breath and saliva stream from the jaws while she roars.
  const roaring=rex.vocal?.roar||0;breathClock-=dt;if(roaring>.3&&rex.actor.visible&&breathClock<=0&&!swallow.coversFrame){breathClock=.13;const m=rex.mouthPosition(),dir=m.center.clone().sub(rex.headPosition()).setY(0).normalize();dir.y=-.12;effects.breath(m.center,dir.normalize(),Math.min(1,roaring*1.2));}}
 jeep.pose(time,speed,state);updateCamera(dt);camera.updateMatrixWorld();audio.listen(camera,rex?.actor.visible?rex.headPosition():null);
 weather.update(dt,speed,camera,{ground:jungleRoot.visible,shelter:state.result==='lost'&&state.defeat&&endTime>DEFEAT.contact-.4?1:0});weather.apply({sun,hemi,rim,fill,post});effects.soft.light(sun,hemi,scene.fog);audio.weather(weather.rainLevel);
 // Lens beads only where there is a real lens: third person, menu and exterior cinematics.
 post.final.lensRain.value=(view==='third'||menu||state.result==='won')&&jungleRoot.visible?weather.value:0;post.final.lensTime.value+=dt;
 mud.update(dt,speed,camera,renderer,jungleRoot.visible);mud.tint(weather.rain.material.uniforms.tint.value);visitorCenter.update(time);birds.update(dt,time,speed);
 // The jungle's own life runs in both modes; in Safari it is a bonus layer under the director's crossings.
 const wild=menu||(playing&&state.phase!=='intro'&&!state.result&&!(state.safari?.ready>0)),safariMenu=menu&&mode==='menu'&&safariUI.selected==='safari';
 if(playing&&state.safari){safariDirector.update(dt,state.safari);const n=safariDirector.notice;if(n&&n!==lastNotice&&n.points)audio.rare(n.rarity==='Legendary');lastNotice=n;safariFx.update(dt,{speed,notice:n});}
 if(safariMenu)safariDirector.parade(dt);
 critters.update(dt,{speed,rex:rex?.actor.visible?rex.actor.position:null,visible:jungleRoot.visible,spawn:wild,herds:playing&&!state.safari&&!state.result&&!['intro','flank'].includes(state.phase)});flyers.update(dt,{speed,visible:jungleRoot.visible,spawn:wild,rex:rex?.actor.visible&&!state.result?rex.actor.position:null});insects.update(dt,{speed,visible:jungleRoot.visible});brachio.update(dt,{speed:state.safari?0:speed,visible:jungleRoot.visible&&!state.safari&&!safariMenu});
 if(state.result==='lost'&&state.defeat)swallow.update(state.defeat.time,camera,rex.mouthPosition(),reducedMotion);
 if(rex?.actor.visible&&state.result!=='won')rex.gaze.update(dt,view==='third'&&!menu?new T.Vector3(.06,2.4,-.45):camera.position);
 raycaster.setFromCamera(pointer,camera);aimPoint(aimTarget);
 if(state.victory?.arrival)aimTarget.copy(jeep.root.position).add(new T.Vector3(0,2.4,18));
 // At night the menu gunner holds the beam on her face, so the eyes shine back.
 else if(menu&&night.active&&rex?.actor.visible){aimTarget.copy(rex.headPosition());aimTarget.y-=.5;}
 else if(safariMenu)critters.showcase(aimTarget);
 const exterior=state.result==='won'?state.victory?.exterior||state.victory?.time>VICTORY.pullback+.25:menu||(view==='third'&&state.phase!=='intro');
 jeep.update(dt,time,speed,aimTarget,exterior,state);night.update(dt,{time,speed,camera,rex,ground:jungleRoot.visible});
 ford.update(dt,{speed,pursuit:playing&&state.phase!=='intro'&&!state.result,state,jeep,rex:rex?.actor.visible&&state.result!=='won'?rex:null,tint:weather.rain.material.uniforms.tint.value,sun,beam:weather.rainUniforms,renderer,visible:jungleRoot.visible});
 // The river is heard from the nearest point of the channel; the tyres churn while they are in it.
 {const fz=ford.active&&jungleRoot.visible?jungle.ford.z:null,near=fz===null?0:T.MathUtils.clamp(1-(Math.abs(fz-camera.position.z)-10)/45,0,1);
  audio.river(mode==='playing'?near:0,fz===null?null:new T.Vector3(camera.position.x,.2,fz),mode==='playing'&&ford.jeep.inWater?1:0);}
 // Mud and water she gathers: the river rinses and soaks her, and she streams water for a while after.
 if(coat){coat.update(dt,{active:playing&&!state.result});if(ford.rexWet.inWater)coat.wade(.42);
  if(coat.soak>.25&&rex.actor.visible&&!ford.rexWet.inWater){for(let i=0;i<drips.length;i++)drips[i].bone.getWorldPosition(drips[i].p).y-=drips[i].drop;ford.drip(drips.map(d=>d.p),coat.soak*coat.soak*.3);}}effects.update(dt,speed);targets?.update(state);debris.update(dt,state,speed);
 if(playing){if(firing)shoot();handleEvents();updateHud();safariUI.update(won=>audio.cue(won));}audio.update(speed,dt,mode==='playing'&&(!state.result||state.result==='won'&&endTime<VICTORY.fade||(state.result==='lost'&&endTime<DEFEAT.spinEnd)),!state.result&&!['intro','flank'].includes(state.phase));
 shake=Math.max(0,shake-dt*1.8);stompVel+=(stomp*40-stompOffset*260-stompVel*26)*dt;stompOffset=Math.max(0,stompOffset+stompVel*dt);stomp=Math.max(0,stomp-dt*6);gunKick=Math.max(0,gunKick-dt*.4);hitTime=Math.max(0,hitTime-dt);damageFlash=Math.max(0,damageFlash-dt*.65);
 hud.hit.style.opacity=hitTime>0?1:0;hud.hitLabel.style.opacity=hitTime>0?1:0;hud.flash.style.opacity=damageFlash;
 post.final.flash.value.setRGB(1,.78,.5).multiplyScalar(effects.flash*.28);weather.addFlash(post.final.flash.value);
 if(fpsMeter){fpsFrames++;if(now-fpsSince>500){fpsMeter.textContent=`${Math.round(fpsFrames*1000/(now-fpsSince))} fps · ${governor.frameMs.toFixed(1)} ms
${tierName()} · scale ${Math.round(governor.scale*100)}% · ${renderer.info.render.calls} calls`;fpsFrames=0;fpsSince=now;}}
 renderFrame(now);
}
requestAnimationFrame(frame);
const boot=(stage,fraction)=>{$('#boot-stage').textContent=stage;$('#boot-fill').style.transform=`scaleX(${fraction})`;$('#boot-percent').textContent=`${Math.round(fraction*100)}%`;};boot('Waking the predator',.12);
try{rex=await createRex(scene,p=>{const f=p.total?p.loaded/p.total:0;$('#loading-status').textContent=p.total?`Creature ${Math.round(f*100)}%`:'Preparing the creature…';boot('Waking the predator',.12+f*.66);});boot('Compiling light and shadow',.82);await critters.ready();targets=createTargets(rex,camera,$('#target-layer'));skid.attachCoat(rex.hide.uniforms.uRexFallMud);coat=createRexCoat(rex.hide.uniforms);
 // Where river water streams off her: belly, thighs, shins, feet and the underside of the tail.
 drips.push(...[['back_02_',1.1],['back_03_',1.2],['tail_02_',.7],['tail_05_',.45],['leg_02_L_',.5],['leg_02_R_',.5],['leg_03_L_',.2],['leg_03_R_',.2],['foot_02_01_L_',.1],['foot_02_01_R_',.1]].map(([n,drop])=>({bone:rex.bones.find(b=>b.name.startsWith(n)),drop,p:new T.Vector3()})).filter(d=>d.bone));rex.gait.ground=(x,z)=>jungle.fordDip(x,z);rex.gait.water=(x,z)=>jungle.waterDepth(x,z);skid.prepare(true);await renderer.compileAsync(scene,camera);skid.prepare(false);await swallow.prepare();boot('Ready',1);setMode('menu');$('#start').disabled=false;safariUI.select(storedMode());$('#loading-status').textContent='Headphones recommended · First / third person';}
catch(e){console.error(e);$('#loading-status').textContent='The creature could not load. Refresh to try again.';$('#start-label').textContent='LOAD FAILED';}
// Exposed for local visual and interaction verification; no network or remote state.
window.rexChase={safariDirector,safariUI,safariFx,scene,camera,renderer,post,birds,critters,flyers,insects,brachio,ford,get coat(){return coat;},sky,canopy,weather,night,setConditions,toggleFlashlight,mud,governor,sun,lights:{hemi,rim,fill},jungle,get quality(){return{setting:quality,tier:tierName(),detected:detected.tier,gpu:detected.gpu,scale:governor.scale,frameMs:governor.frameMs};},setQuality,jeep,effects,opening,ambushScenery,debris,swallow,visitorCenter,get targets(){return targets;},get rex(){return rex;},state,audio,start,setView,shoot,grenade,get mode(){return mode;},get view(){return view;},get frames(){return frameCount;},set freeze(v){freeze=v;},get freeze(){return freeze;},aimAt(world){pointer.copy(world.clone().project(camera));moveReticle();},snapshot(){return{mode,view,safari:state.safari?{score:state.safari.score,kills:state.safari.kills,ready:state.safari.ready}:null,health:state.health,jeep:state.jeep,phase:state.phase,ammo:state.ammo,wounds:rex?.damage.count,damageStage:rex?.damage.stage,persistentImpacts:rex?.damage.totalImpacts,headshots:state.headshots,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,audioClips:audio.buffers.size,remaining:state.remaining,objectives:state.objectivesCleared,debrisCleared:state.debrisCleared,debrisMissed:state.debrisMissed};}};
