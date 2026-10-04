import {Circuit,STAGES,project,grade} from './rules.js';
import {RideRenderer} from './renderer.js';
import {RideAudio} from './audio.js';
import {readRecord,saveRecord,readBoard,boardPlace,addToBoard,MEDALS,readMedals,awardMedal} from './records.js';
import {UPGRADES,OFFER_TIME} from './rules.js';
import {ChaseAudio} from '../chase/audio.js';import {StageAmbience} from './ambience.js';import {CircuitQuality} from './quality.js';
// RideAudio keeps the score and UI cues; Pursuit's recorded library supplies the
// world: gunfire, impacts, engine, wind, and the Rex's voice placed at her head.
const $=id=>document.getElementById(id),canvas=$('ride'),renderer=new RideRenderer(canvas),audio=new RideAudio(),field=new ChaseAudio(),ambience=new StageAmbience(field);let fieldInit=null;
const test=new URLSearchParams(location.search).get('test')==='1';
let clearCard=0,game=null,mode='menu',route='extended',ready=false,fire=false,frozen=false,clock=0,accumulator=0,last=performance.now(),announcementTime=0,radioTime=0,saved=false;
const aim={x:.5,y:.5},keys=new Set();let pointerId=null;
// A15: the cabinet's ten-second CONTINUE? countdown, and gamepad state (buttons held last frame).
let continueClock=0,padHeld=[],entering=false,lastMultiplier=1,hiBest=0,lastTally=null,heartbeat=0;
// The clear card's tally (rules tally()): accuracy bonus, NO DAMAGE bonus and the sector bonus.
const points=n=>n.toLocaleString('en-US'),clearCopy=()=>lastTally?.perfect?'Perfect. Not a scratch.':'Still in one piece.';
const tallyLine=()=>{const t=lastTally||{accuracy:0,accBonus:0};return[`ACCURACY ${t.accuracy}% +${points(t.accBonus)}`,t.perfect&&`NO DAMAGE +${points(t.perfectBonus)}`,'SECTOR +1,500'].filter(Boolean).join(' · ');};
// A15 attract mode: after ATTRACT_IDLE seconds on the menu a demo plays live gameplay, a stage per segment.
const ATTRACT_IDLE=25,ATTRACT_SEGMENT=18,ATTRACT_STAGES=['gates','river','fault','hybrid','lagoon','manor','visitor'];let idle=0,attract=null;
canvas.tabIndex=0;
const fmt=n=>Math.round(n).toLocaleString('en-US');
const names={trike:'TRICERATOPS · STAMPEDE LEADER',rex:'TYRANNOSAURUS REX',indominus:'INDOMINUS REX',indoraptor:'INDORAPTOR',mosa:'MOSASAURUS',twins:'TWO KINGS. ONE EXIT.'};
function readBest(){return readRecord(()=>localStorage,rush?'bossrush':daily?dailyRoute():route,$('difficulty').value);}
// The daily run: the Extended Cut on today's seed (local date), with its own best and top ten.
let daily=false;const today=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;},dailyRoute=()=>`daily-${today()}`;
// Boss rush: every boss back to back (rules rushStart); its own best and top ten. Exclusive with the daily run.
let rush=false;function setRush(on){rush=on;$('rush').setAttribute('aria-pressed',String(on));if(on&&daily)setDaily(false);document.querySelector('.route-picker').classList.toggle('locked',on||daily);updateBest();}
$('rush').addEventListener('click',()=>setRush(!rush));
// Medals (records.js): a toast the first time each is earned; the menu counts them.
let medalTime=0,runMedals=[];function medal(id){if(test&&!new URLSearchParams(location.search).has('medals')||attract||!awardMedal(()=>localStorage,id))return;const [name,how]=MEDALS[id];runMedals.push(name);const t=$('medal');t.querySelector('b').textContent=name;t.querySelector('span').textContent=how;t.hidden=false;t.classList.remove('show');void t.offsetWidth;t.classList.add('show');medalTime=3.2;audio.chime(5);updateMedals();}
function updateMedals(){$('medals-count').textContent=`MEDALS ${readMedals(()=>localStorage).length}/${Object.keys(MEDALS).length}`;}
function setDaily(on){daily=on;if(on&&rush)setRush(false);$('daily').setAttribute('aria-pressed',String(on));document.querySelector('.route-picker').classList.toggle('locked',on);updateBest();}
$('daily').addEventListener('click',()=>setDaily(!daily));
function updateBest(){updateMedals();$('best').textContent=`BEST ${readBest()?fmt(readBest()):'—'}`;}
function persist(){
 if(saved||test)return;saved=true;
 if(!saveRecord(()=>localStorage,game).saved)$('overlay-copy').textContent+=' Browser storage is unavailable; this score could not be saved.';
}
function showMode(value){mode=value;document.body.dataset.screen=value;$('menu').hidden=value!=='menu';$('hud').hidden=value==='menu';$('pause').hidden=value==='menu';$('overlay').hidden=!['paused','result','continue'].includes(value);}
function announce(top,title,bottom='',seconds=3,over=false){const el=$('announcement');el.classList.toggle('over',over);el.children[0].textContent=top;el.children[1].textContent=title;el.children[2].textContent=bottom;announcementTime=seconds;el.style.opacity='1';}
function radio(copy){$('radio').querySelector('span').textContent=copy;radioTime=7;$('radio').style.opacity='1';}
// Practice unlocks: the furthest stage reached in a full run (local storage).
const REACHED='rex-lost-circuit-v1:reached',reached=()=>{try{return Math.max(0,+localStorage.getItem(REACHED)||0);}catch{return 0;}};
function stageChanged(){if(!attract&&game&&!game.route.startsWith('practice-')&&game.route!=='bossrush'){const i=game.path[game.stageIndex];if(i>reached())try{localStorage.setItem(REACHED,String(i));}catch{/* Storage denied. */}}
 const stage=game.stage;ambience.setStage(stage.id);$('location').textContent=stage.location;$('stage-name').textContent=stage.name;
 $('route-dots').replaceChildren(...game.path.map((_,i)=>{const dot=document.createElement('i');dot.className=i<game.stageIndex?game.perfects?.includes(i)?'done perfect':'done':i===game.stageIndex?'current':'';return dot;}));
 announce(`${String(game.stageIndex+1).padStart(2,'0')} / ${String(game.path.length).padStart(2,'0')} — ${stage.era}`,stage.name,'HOLD TO FIRE · SHOOT DEBRIS · KEEP MOVING');radio(stage.radio);
}
function unlockField(){fieldInit??=field.init().then(()=>{audio.worldSounds=false;if(field.muted!==audio.muted)field.mute();if(mode!=='playing')return field.pause(true);}).catch(e=>{console.warn('Recorded audio unavailable:',e.message);});if(field.context)field.pause(false).catch(()=>{});}
function start(override){if(!ready)return;clearCard=0;p2=null;runMedals=[];hiBest=readBest()||0;audio.reset();field.stopCalls();void audio.unlock();unlockField();const practice=typeof override==='string'?override:null;game=new Circuit({route:practice||(rush?'bossrush':daily?'extended':route),difficulty:$('difficulty').value,seed:daily&&!practice?Number(today()):94});if(daily&&!practice)game.route=dailyRoute();game.projector=(e,aspect)=>renderer.project(e,aspect);saved=false;fire=false;keys.clear();renderer.reset();clock=0;accumulator=0;showMode('playing');canvas.focus({preventScroll:true});processEvents();updateHud();}
function processEvents(){for(const event of game.drain()){
 renderer.event(event);audio.event(event);fieldEvent(event);
 if(event.type==='stage')stageChanged();
 if(event.type==='boss'){announce('APEX ENCOUNTER',names[event.kind],'KEEP FIRING AT THE AMBER WEAK POINT',2.4,true);radio(event.kind==='mosa'?'It is coming up! Break the attack before it reaches us.':'Amber marks stop the charge. Keep your aim on the head.');}
 // After a Rex, let her fall read before the card arrives.
 if(event.type==='clear'){lastTally=event;if(event.perfect)audio.chime(5);if(game.clearHold>3.5)clearCard=game.stage.id==='visitor'?3.9:2.1;else announce('SECTOR CLEAR',clearCopy(),tallyLine(),3);}
 if(event.type==='bridge'){announce('HOLD ON','There goes the bridge.','SHOOT THE FALLING DEBRIS',2);radio('Brace! Clear the debris. We are jumping the gap!');}
 if(event.type==='focus'){radio('Overdrive online. Five seconds. Make them count.');audio.tone(880,.6,.08,'sine',110);audio.hiss(.45,.07,1300);}
 if(event.type==='clear'&&event.perfect)medal('clean');if(event.type==='kill'&&event.kind==='golden')medal('golden');if(event.type==='grenade'&&event.hits.length>=3)medal('sweep');
 if(event.type==='win'){if(game.route==='extended')medal('kings');if(!game.continues)medal('credit');if(game.route==='bossrush')medal('rush');if(game.difficulty==='expert')medal('expert');}
 if(event.type==='golden')radio('Golden compy crossing! Five thousand if you can tag it!');
 if(event.type==='kill'&&event.kind==='golden'){announce('GOLDEN COMPY','Lucky shot.','+5,000',1.3);audio.chime(5);}
 if(event.type==='upgrade'){announce('UPGRADE',event.label,'FOR THE REST OF THE RUN',1.4);audio.chime(4);}
 if(event.type==='power'){if(event.kind==='spread'){announce('SPREAD SHOT','Every round finds two more.','8 SECONDS · SWEEP THE PACK',1.6);radio('Spread rounds loaded! Sweep them!');}else{announce('EXPLOSIVE ROUNDS','Every round counts double.','8 SECONDS · SHOOT EVERYTHING',1.6);radio('Explosive rounds loaded! Light them up!');}}
 if(event.type==='beat'&&event.text)radio(event.text);
 if(event.type==='threat')radio(`Raptors on the ${event.side}! They are keeping pace. Watch for the turn!`);
 if(attract&&(event.type==='loss'||event.type==='win')){nextAttract();continue;}
 if(event.type==='loss')showContinue();
 if(event.type==='win')showResult(true);
}}
const BOSS_STAGES=['gates','river','hybrid','visitor'];
function fieldEvent(e){
 if(e.type==='damage')rumble(.9,.6,260);if(e.type==='grenade')rumble(.75,.5,230);if(e.type==='blast')rumble(.6,.45,190);if(e.type==='stagger')rumble(.35,.55,130);if(e.type==='shot'&&!e.pellet)rumble(0,.14,40);
 // Bodies and the vehicle react with or without sound; a blow knocks the camera away from its source.
 if(e.type==='shot'&&e.hit)renderer.actors?.hit(e.id,e.precise,e.x);
 // A broken boss attack freezes the action for 50 ms and lands a low thump.
 // A head-shot kill lands with a 30 ms hit-stop.
 if(e.type==='kill'&&e.precise&&!e.boss)hitStop=Math.max(hitStop,.03);
 if(e.type==='stagger'){hitStop=.05;if(field.context)field.groundImpact(1);}
 if(e.type==='damage')renderer.vehicle?.hit(renderer.actors?.actors.get(e.id)?.position||null,Math.min(1.6,.4+e.amount/14));
 if(!field.context)return;
 // Each beat is announced by its animals, from their side of the track.
 if(e.type==='beat'){const cam=renderer.world.camera.position,at={x:cam.x+e.side*14,y:cam.y,z:cam.z+28},name={raptor:'raptor',dilo:'dilophosaurus',galli:'gallimimus',trike:'triceratops',compy:'compy'}[e.kind];if(e.kind==='ptero')field.screech(at);else if(e.pattern==='stampede')field.herd(at);else if(name)field.call(name,at);}
 if(e.type==='shot'){if(!e.pellet)field.gun();if(e.hit){const wound=renderer.lastWound,actor=renderer.actors?.actors.get(e.id),at=wound?.point||actor?.position;if(at)field.hit('flesh',at.distanceTo(renderer.world.camera.position),at);renderer.lastWound=null;}}
 if(e.type==='blast')field.impact(true);
 // A swarm breaks with a scatter of chirps; each compy squeals as it drops.
 if(e.type==='beat'&&e.pattern==='swarm'){const cam=renderer.world.camera.position;for(let i=0;i<3;i++)field.chirp({x:cam.x+e.side*(6+i*3),y:cam.y,z:cam.z+20+i*2});}
 if(e.type==='kill'&&e.kind==='compy'){const a=renderer.actors?.actors.get(e.id);if(a)field.death('compy',a.position);}
 if(e.type==='launch'){audio.tone(120,.16,.16,'sine',48);audio.hiss(.1,.08,900);}
 if(e.type==='grenade'){field.impact(true);field.groundImpact(1);}
 if(e.type==='leap'){const a=renderer.actors?.actors.get(e.id);if(a)field.call('raptor',a.position);}
}
// Her calls, bite, pain and footfalls come from the modeled Rex's own timing.
function bossCues(){
 // The gate's doors hit their stops: timber on timber.
 for(const cue of renderer.world.fault?.drain()||[]){if(!field.context||mode!=='playing')continue;if(cue.type==='snap')field.woodBreak(cue.weight*.7);if(cue.type==='bounce'){field.groundImpact(Math.min(1,cue.weight*.8),cue.at);renderer.shake=Math.max(renderer.shake,cue.weight*.3);}if(cue.type==='land'){field.groundImpact(1);field.woodBreak(.5);renderer.shake=Math.max(renderer.shake,.7);const c=renderer.world.camera.position;for(let i=0;i<5;i++)renderer.effects.groundDust(c.clone().set(c.x+(i-2)*1.4,c.y-2.4,c.z+2+i%2),c.clone().set((i-2)*.8,.6,1.5),{life:1.6,size:1.1,opacity:.38,color:0x8a6f5a});}}
 for(const cue of renderer.world.promenade?.drain()||[])if(field.context&&mode==='playing'){field.sample('wind',{volume:.6,rate:1.45,duration:4.2,lowpass:2600,at:cue.at,fade:.8});field.sample('engine-loop',{volume:.32,rate:2.3,duration:3.4,lowpass:1700,at:cue.at,fade:.7});}
 for(const cue of renderer.world.gate?.drain()||[])if(field.context&&mode==='playing'&&cue.type==='slam'){field.woodBreak(.45);field.groundImpact(.7,cue.at);renderer.shake=Math.max(renderer.shake,.25);}
 // A13: roof glass shattering, and the Indoraptor (boss-indoraptor.js).
 // A14: the rotunda's displays clatter down and its banner tears loose (rotunda.js).
 for(const cue of renderer.world.rotunda?.drain()||[])if(field.context&&mode==='playing'){if(cue.type==='collapse'){field.woodBreak(cue.big?1:.75);field.groundImpact(cue.big?.8:.55,cue.at);renderer.shake=Math.max(renderer.shake,cue.big?.35:.2);for(let i=0;i<7;i++)field.sample('branch-snap',{volume:.5+Math.random()*.3,rate:1.5+Math.random()*1.2,at:cue.at,delay:.05+i*.08+Math.random()*.05,wet:.6});}if(cue.type==='banner'){field.sample('branch-snap',{volume:.7,rate:.9,at:cue.at,wet:.6});field.sample('wind',{volume:.45,rate:1.7,duration:1.8,lowpass:2200,at:cue.at,fade:.6});}}
 for(const cue of renderer.world.glass?.drain()||[])if(field.context&&mode==='playing'){field.sample('branch-snap',{volume:.9,rate:2.4,at:cue.at,wet:.5});field.sample('branch-snap',{volume:.6,rate:3.1,at:cue.at,delay:.07,wet:.5});for(let i=0;i<5;i++)audio.hiss(.03+Math.random()*.07,.05+Math.random()*.05,5200+Math.random()*4200);}
 for(const cue of renderer.bossIndo?.drain()||[]){if(!field.context||mode!=='playing')continue;
  if(cue.type==='crash')renderer.shake=Math.max(renderer.shake,.4);
  if(cue.type==='land'){field.groundImpact(.6,cue.at);renderer.shake=Math.max(renderer.shake,.5);}
  if(cue.type==='step')field.footstep(.35,cue.at);
  if(cue.type==='shriek')field.play(10,1,.82,{vocal:false,at:cue.at,wet:.55});
  if(cue.type==='bite'){field.bite();field.impact();renderer.shake=Math.max(renderer.shake,1.1);}
  if(cue.type==='pain')field.play(13,.85,1,{vocal:false,at:cue.at,wet:.5});
  if(cue.type==='fall'){field.play(13,1,.78,{vocal:false,at:cue.at,wet:.6});field.groundImpact(.7,cue.at);}}
 // The Mosasaurus (boss-mosa.js): breach, slam, surfacing, bite, pain and her death roll.
 for(const cue of renderer.bossMosa?.drain()||[]){if(!field.context||mode!=='playing')continue;
  if(cue.type==='breach'){field.splash('enter',cue.at,1);field.play(field.roles.opening,1,.58,{vocal:false,at:cue.at,wet:.5});renderer.shake=Math.max(renderer.shake,.5);}
  if(cue.type==='slam'){field.splash('enter',cue.at,1);field.groundImpact(1,cue.at);renderer.shake=Math.max(renderer.shake,1.1);}
  if(cue.type==='swell'){field.splash('step',cue.at,1.2);renderer.shake=Math.max(renderer.shake,.45);}
  if(cue.type==='surface'){field.splash('step',cue.at,1);field.play(field.roles.growl,.8,.62,{vocal:false,at:cue.at,wet:.4});}
  if(cue.type==='bite'){field.bite();field.impact();renderer.shake=Math.max(renderer.shake,1.2);}
  if(cue.type==='pain')field.play(field.roles.opening,.8,.75,{vocal:false,at:cue.at,wet:.4});
  if(cue.type==='fall'){field.play(field.roles.opening,1,.5,{vocal:false,at:cue.at,wet:.6});field.splash('enter',cue.at,1);}}
 // The Triceratops' bellows, footfalls, pawing, horn lock and shoves (boss-trike.js).
 const trike=renderer.bossTrike,eye=renderer.world.camera.position;
 for(const cue of trike?.drain()||[]){if(!field.context||mode!=='playing')continue;const near=Math.max(0,1-cue.at.distanceTo(eye)/32);
  if(cue.type==='bellow')field.play(30,cue.loud?1:.7,cue.loud?.6:.68,{vocal:false,at:cue.at,wet:.35});
  if(cue.type==='snort')field.play(30,.4,1.05,{vocal:false,at:cue.at,wet:.2});
  if(cue.type==='step'){field.footstep(.75,cue.at);renderer.effects.footstep(cue.at,cue.speed);renderer.shake=Math.max(renderer.shake,.42*near);}
  if(cue.type==='paw')renderer.effects.groundDust(cue.at.clone().setY(cue.at.y+.2),cue.at.clone().set(0,1,0),{size:.9,growth:2.5,opacity:.4,life:1.2});
  if(cue.type==='lock'){field.impact();field.groundImpact(1,cue.at);renderer.effects.bodyImpact(cue.at,1);renderer.shake=Math.max(renderer.shake,1.2);radio('She has the bumper! Shoot her off!');}
  if(cue.type==='shove'){field.groundImpact(.45,cue.at);renderer.shake=Math.max(renderer.shake,.55);}
  if(cue.type==='pain'){field.play(30,.85,.78,{vocal:false,at:cue.at,wet:.3});radio('She is reeling! Keep it on her head!');}
  if(cue.type==='fall'){field.death('triceratops',cue.at);radio('She is down. Go, go!');}
 }
 // A cut wire's live end crackles.
 for(const cue of renderer.world.sparks?.drain()||[])if(mode==='playing')audio.hiss(.04+Math.random()*.07,.03+.1*cue.near,3600+Math.random()*2400);
 const boss=renderer.bossRex;if(!boss)return;const cam=renderer.world.camera.position;audio.modeledRex=boss.ready&&!!field.context;audio.modeledMosa=!!renderer.bossMosa?.ready&&!!field.context;
 for(const cue of boss.drain()){
  if(!field.context||mode!=='playing')continue;
  // The Indominus (A11) is the Rex rig: her calls are the Rex's pitched up, with a raptor shriek over them.
  if(cue.type==='roar'){boss.voiceSlot=cue.slot;if(boss.slots[cue.slot]?.kind==='indominus'){field.play(cue.opening?field.roles.opening:field.roles.charge,cue.opening?1.3:1.1,cue.opening?1.2:1.26,{vocal:'roar'});field.play(10,.75,.8,{vocal:false,wet:.4});}else field.roar(cue.opening);}
  if(cue.type==='bite'){boss.voiceSlot=cue.slot;field.bite();renderer.shake=Math.max(renderer.shake,1.1);}
  if(cue.type==='pain'){boss.voiceSlot=cue.slot;field.pain(true);radio('She is reeling! Keep it on her head!');}
  if(cue.type==='fall')radio('She is going down. Clear out!');
  if(cue.type==='step'||cue.type==='impact'){
   const near=Math.max(0,1-cue.at.distanceTo(cam)/32),heavy=cue.type==='impact';
   renderer.shake=Math.max(renderer.shake,(heavy?.9:.32)*near);
   if(cue.water){field.splash('step',cue.at,heavy?1:.75);renderer.effects.spume(cue.at.clone().setY(-.3),cue.at.clone().set(0,2.2,0),{size:.9,opacity:.2});renderer.world.spray.burst(cue.at,heavy?1.3:.7);renderer.world.river.ring(cue.at.x,cue.at.z,heavy?1.4:.8);}
   else if(heavy){field.groundImpact(cue.strength,cue.at);renderer.effects.bodyImpact(cue.at,cue.strength);}
   else{field.footstep(.55,cue.at);renderer.effects.footstep(cue.at,cue.speed);}
  }
 }
}
function updateHud(){
 if(!game)return;{const s=String(game.score).padStart(6,'0'),el=$('score'),h=String(Math.max(game.score,hiBest)).padStart(6,'0'),hi=$('hi-score');el.textContent=s;el.dataset.ghost='8'.repeat(s.length);hi.textContent=h;hi.dataset.ghost='8'.repeat(h.length);
  // Passing the standing record mid-run: the readout flashes gold, relabels and chimes, once.
  const beaten=hiBest>0&&game.score>hiBest,block=hi.closest('.hi-block');if(beaten&&!block.classList.contains('beaten')){block.classList.add('beaten');block.querySelector('.label').textContent='NEW HI-SCORE';audio.chime(5);}else if(!beaten&&block.classList.contains('beaten')){block.classList.remove('beaten');block.querySelector('.label').textContent='HI-SCORE';}}
 {const w=document.querySelector('.weapon-label'),pw=game.power>0,sp=game.scatter>0,on=pw||sp;w.classList.toggle('powered',pw);w.classList.toggle('spread',sp&&!pw);w.querySelector('b').textContent=pw&&sp?'EXPLOSIVE SPREAD':sp?'SPREAD SHOT':pw?'EXPLOSIVE ROUNDS':'TX–94 AUTOMATIC';w.querySelector('span').innerHTML=on?`${[sp&&'THREE TARGETS',pw&&'EVERY ROUND ×2'].filter(Boolean).join(' · ')} · <i>${Math.ceil(Math.max(game.power,game.scatter))}s</i>`:game.upgrades?.length?`${Object.entries(game.upgrades.reduce((n,k)=>(n[k]=(n[k]||0)+1,n),{})).map(([k,c])=>UPGRADES[k][0]+(c>1?` ×${c}`:'')).join(' · ')} <i>∞</i>`:'TRANQUILIZER SYSTEM <i>∞</i>';}$('health').textContent=Math.ceil(game.hp);$('players').textContent=p2?'PLAYER 01 + 02':'PLAYER 01';{const box=$('upgrades'),o=game.offerTime<=OFFER_TIME?game.offer:null;box.hidden=!o;if(o){const key=o.join();if(box.dataset.key!==key){box.dataset.key=key;box.querySelectorAll('[data-pick]').forEach((b,i)=>{b.querySelector('b').textContent=UPGRADES[o[i]][0];b.querySelector('span').textContent=UPGRADES[o[i]][1];});}$('upgrade-time').style.width=`${game.offerTime/OFFER_TIME*40}%`;}}{const n=game.grenades||0,b=$('grenade');$('grenade-count').textContent=n?'●'.repeat(n):'EMPTY';b.classList.toggle('empty',!n);}{const panel=document.querySelector('.lower-hud .health');panel.classList.toggle('low',game.hp<=30);panel.classList.toggle('mid',game.hp>30&&game.hp<=60);$('credits').textContent=`CREDITS ${'●'.repeat(game.credits)}${'○'.repeat(Math.max(0,2-game.credits))}`;}
 $('health-bars').replaceChildren(...Array.from({length:10},(_,i)=>{const bar=document.createElement('i');if(i>=Math.ceil(game.hp/10))bar.className='empty';if(game.hp<30&&bar.className!=='empty')bar.style.background='#ef9c6f';return bar;}));
 {const mult=Math.min(5,1+Math.floor(game.combo/5)),badge=$('multiplier');badge.textContent=`×${mult}`;
  // Each step up the chain multiplier pops the badge and chimes higher; the top step gets a radio call.
  if(mult>lastMultiplier&&!attract){badge.classList.remove('bump');void badge.offsetWidth;badge.classList.add('bump');audio.chime(mult);if(mult===5){radio('Five times multiplier! Keep the chain alive!');medal('chain');}}lastMultiplier=mult;}$('chain-text').textContent=game.combo?`${game.combo} CHAIN`:'MAKE IT COUNT';$('chain-fill').style.width=`${game.chainTime/4.5*100}%`;
 $('focus-fill').style.width=`${game.focusTime>0?game.focusTime/5*100:game.focus}%`;$('focus-value').textContent=game.focusTime>0?'ACTIVE':game.focus>=100?'READY ↗':`${Math.floor(game.focus)}%`;$('focus').classList.toggle('ready',game.focus>=100);$('focus').setAttribute('aria-label',game.focus>=100?'Activate Overdrive':`Overdrive charging ${Math.floor(game.focus)} percent`);
 $('credit-label').textContent=game.continues?`CONTINUED RUN · ${game.credits} CREDITS LEFT`:'ONE CREDIT RUN';
 const bosses=game.entities.filter(e=>e.boss&&!e.dead);$('boss-hud').hidden=!bosses.length;
 if(bosses.length){$('boss-name').textContent=names[game.stage.boss];$('boss-fill').style.width=`${100*bosses.reduce((sum,e)=>sum+e.hp,0)/bosses.reduce((sum,e)=>sum+e.maxHp,0)}%`;}
}
function overlay(title,copy,kicker){$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('overlay-kicker').textContent=kicker;$('resume').hidden=true;$('continue').hidden=true;$('restart').hidden=true;$('result-stats').replaceChildren();$('board').hidden=true;$('board-entry').hidden=true;entering=false;fire=false;keys.clear();audio.pause(true);}
function pause(){if(mode!=='playing')return;field.pause(true).catch(()=>{});showMode('paused');overlay('Ride paused.','Aim with mouse or arrow keys. Hold mouse or Space to fire. Right-click or G lobs a grenade. E activates Overdrive.','TAKE A BREATH');$('resume').hidden=false;$('resume').focus();}
function resume(){if(mode!=='paused')return;showMode('playing');void audio.unlock();unlockField();canvas.focus({preventScroll:true});}
function showContinue(){showMode('continue');overlay('Ride interrupted.',game.credits?`Your vehicle took one hit too many. ${game.credits} free continues remain. Your route and score will be preserved.`:'You gave the island a run for its money. Your score is ready.','CONTINUE?');
 if(game.credits){$('continue').hidden=false;$('continue').textContent=`CONTINUE · ${game.credits} CREDITS ↗`;$('continue').focus();continueClock=10;$('overlay-kicker').textContent='CONTINUE? 10';}
 else showResult(false);
}
function showResult(won){showMode('result');overlay(won?'You made it out.':'The island wins.',won?`${game.route==='classic'?'The ’94 Circuit':game.route.startsWith('daily-')?'Today’s daily run':game.route==='bossrush'?'The boss rush':game.route.startsWith('practice-')?`Practice: ${game.stage.name}`:'The Extended Cut'} complete. ${game.continues?'Continued-run record.':'One credit. A whole lot of dinosaurs.'}`:`Reached ${game.stage.name}. Ride again for a cleaner run.`,won?'EXPEDITION COMPLETE':'GAME OVER');if(runMedals.length)$('overlay-copy').textContent+=` Medals earned: ${runMedals.join(', ')}.`;
 const stats=[[fmt(game.score),'FINAL SCORE'],[grade(game),'RANK'],[`${Math.round(game.hits/Math.max(1,game.shots)*100)}%`,'ACCURACY'],[String(game.maxCombo),'BEST CHAIN'],[`${game.perfects?.length||0}/${game.path.length}`,'PERFECT STAGES'],game.p2?[`${Math.round(game.p2.hits/Math.max(1,game.p2.shots)*100)}%`,'P2 ACCURACY']:[String(game.continues),'CONTINUES']];
 $('result-stats').replaceChildren(...stats.map(([v,l])=>{const el=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');if(l==='RANK')el.className='flourish';b.textContent=v;small.textContent=l;el.append(b,small);return el;}));$('restart').hidden=false;$('restart').focus();persist();showBoard();
}
// A15: the local top ten. A qualifying score asks for initials first (keyboard, phone or d-pad).
function showBoard(){
 const board=readBoard(()=>localStorage,game.route,game.difficulty),place=boardPlace(board,game.score),allow=!test||new URLSearchParams(location.search).has('board');
 if(place<0||!allow||game.boardSaved){renderBoard(board,-1);return;}
 entering=true;$('board-entry').hidden=false;$('board-title').textContent=`NEW HIGH SCORE · #${place+1} · ENTER YOUR INITIALS`;
 let last='';try{last=localStorage.getItem('lost-circuit.initials')||'';}catch{}$('initials').value=last;$('initials').focus();$('initials').select();renderBoard(board,-1);
}
function saveInitials(){
 if(!entering)return;entering=false;const n=($('initials').value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3))||'AAA';try{localStorage.setItem('lost-circuit.initials',n);}catch{}
 const {board,index}=addToBoard(()=>localStorage,game.route,game.difficulty,{n,s:game.score,g:grade(game),c:game.continues?1:0});game.boardSaved=true;
 $('board-entry').hidden=true;renderBoard(board,index);$('restart').focus();
}
function renderBoard(board,highlight){
 const ol=$('board');ol.hidden=!board.length;ol.replaceChildren(...board.map((e,i)=>{const li=document.createElement('li');if(i===highlight)li.className='new';for(const t of [e.n,fmt(e.s),e.g||'']){const s=document.createElement('span');s.textContent=t;li.append(s);}return li;}));
}
function backToMenu(){audio.reset();audio.pause(true);field.stopCalls();field.pause(true).catch(()=>{});showMode('menu');game=null;fire=false;keys.clear();pointerId=null;renderer.reset();updateBest();$('start').focus();}
$('start').addEventListener('click',start);$('initials-save').addEventListener('click',saveInitials);$('initials').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveInitials();}});$('restart').addEventListener('click',start);$('pause').addEventListener('click',()=>mode==='playing'?pause():resume());$('resume').addEventListener('click',resume);$('to-menu').addEventListener('click',backToMenu);
$('continue').addEventListener('click',()=>{if(game?.continueRun()){showMode('playing');void audio.unlock();unlockField();canvas.focus({preventScroll:true});processEvents();updateHud();}});
// A grenade at the sight: right mouse, G or Q, a gamepad shoulder (LB/LT) or the touch button.
function lob(){if(mode==='playing'&&game?.launch(aim.x,aim.y,innerWidth/innerHeight))processEvents();}
$('grenade').addEventListener('click',lob);
document.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('pointerdown',e=>{e.stopPropagation();if(mode==='playing'&&game?.pick(+b.dataset.pick))processEvents();}));canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===2)lob();});
$('focus').addEventListener('click',()=>{if(mode==='playing'){game.activateFocus();processEvents();canvas.focus({preventScroll:true});}});
$('sound').addEventListener('click',()=>{audio.mute(!audio.muted);if(field.muted!==audio.muted)field.mute();$('sound').textContent=audio.muted?'SOUND OFF':'SOUND ON';$('sound').setAttribute('aria-pressed',String(audio.muted));$('sound').setAttribute('aria-label',audio.muted?'Enable sound':'Mute sound');if(mode==='playing')void audio.unlock();});
let quality=null,hitStop=0,slow=0,slowDone=false;
// The leap over the broken bridge plays 0.6 s of slow motion at the top of the arc (presentation
// only: the rules still step in fixed 1/60 s ticks, just fewer of them per real second).
function slowScale(dt){if(!game||game.stage.id!=='fault'||!game.bridgeBroken){slowDone=false;slow=0;return 1;}
 if(!slowDone&&(game.travel-game.bridgeOrigin+30)/60>.3&&!renderer.reduced){slowDone=true;slow=.6;}
 if(slow<=0)return 1;slow=Math.max(0,slow-dt);return 1-.74*Math.min(1,(.6-slow)/.08,slow/.14);}function qualityLabel(){$('quality').textContent=`QUALITY ${quality?.label||'AUTO'}`;}$('quality').onclick=()=>{quality?.cycle();qualityLabel();};
function motionLabel(){$('motion').textContent=renderer.reduced?'MOTION LOW':'MOTION FULL';$('motion').setAttribute('aria-pressed',String(renderer.reduced));}motionLabel();
$('motion').addEventListener('click',()=>{renderer.reduced=!renderer.reduced;motionLabel();});
$('difficulty').addEventListener('change',updateBest);
document.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>{route=button.dataset.route;setDaily(false);setRush(false);document.querySelectorAll('[data-route]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateBest();}));
$('about-open').addEventListener('click',()=>$('about').showModal());
// The medal list: earned in gold, the rest greyed with how to earn them.
$('medals-open').addEventListener('click',()=>{const have=readMedals(()=>localStorage);$('medal-list').replaceChildren(...Object.entries(MEDALS).map(([id,[name,how]])=>{const li=document.createElement('li');li.className=have.includes(id)?'earned':'';li.innerHTML=`<b>${have.includes(id)?'★':'☆'} ${name}</b><span>${how}</span>`;return li;}));$('medals').showModal();});
$('medals-close').addEventListener('click',()=>$('medals').close());
// Practice: any stage up to the furthest reached plays alone (route practice-N, its own best).
$('practice-open').addEventListener('click',()=>{const top=reached();$('practice-list').replaceChildren(...STAGES.map((s,i)=>{const li=document.createElement('li'),b=document.createElement('button');b.disabled=i>top;b.innerHTML=`<b>${String(i+1).padStart(2,'0')} · ${s.name}</b><span>${i>top?'Reach it in a run to unlock':s.location}</span>`;b.addEventListener('click',()=>{$('practice').close();start(`practice-${i}`);});li.append(b);return li;}));$('practice').showModal();});
$('practice-close').addEventListener('click',()=>$('practice').close());$('about-close').addEventListener('click',()=>$('about').close());
function pointer(e){aim.x=Math.max(.02,Math.min(.98,e.clientX/innerWidth));aim.y=Math.max(.19,Math.min(.85,(e.clientY-(e.pointerType==='touch'?42:0))/innerHeight));}
canvas.addEventListener('pointerdown',e=>{if(mode!=='playing'||(e.pointerType==='mouse'&&e.button!==0)||pointerId!==null)return;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);pointer(e);fire=true;void audio.unlock();e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(pointerId===null||e.pointerId===pointerId)pointer(e);});
function release(e){if(e.pointerId===pointerId){pointerId=null;fire=false;}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);canvas.addEventListener('contextmenu',e=>e.preventDefault());
// Any press ends the attract demo; movement only counts as someone being there.
for(const type of ['pointerdown','keydown','touchstart'])addEventListener(type,()=>{idle=0;if(attract)stopAttract();},true);
addEventListener('pointermove',()=>{idle=0;});
addEventListener('keydown',e=>{
 if($('about').open)return;
 if(e.key==='Escape'&&!e.repeat){if(mode==='playing')pause();else if(mode==='paused')resume();return;}
 if(mode!=='playing'||e.target.closest('button,select,a,input'))return;
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)){e.preventDefault();keys.add(e.key);}
 if(e.key.toLowerCase()==='e'&&!e.repeat){game.activateFocus();processEvents();}
 if(['1','2','3'].includes(e.key)&&game?.offer&&!e.repeat){game.pick(+e.key-1);processEvents();}
 if(['g','q'].includes(e.key.toLowerCase())&&!e.repeat)lob();
});
addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>{fire=false;pointerId=null;keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('resize',()=>renderer.resize());
/** The first connected gamepad: stick (with dead zone), fire, and buttons pressed this frame. */
// Seat rumble: a gamepad's dual-rumble motors, or a short buzz on a phone for heavy hits; off with reduced motion.
let touchSeen=false;
function rumble(strong,weak,ms){if(renderer.reduced||mode!=='playing')return;const p=[...(navigator.getGamepads?.()||[])].find(g=>g&&g.connected);
 if(p?.vibrationActuator?.playEffect){try{p.vibrationActuator.playEffect('dual-rumble',{duration:ms,strongMagnitude:strong,weakMagnitude:weak}).catch(()=>{});}catch{/* Unsupported effect. */}}
 else if(touchSeen&&strong>=.5&&navigator.vibrate){try{navigator.vibrate(Math.min(ms,140));}catch{/* Blocked. */}}}
addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touchSeen=true;},true);
function gamepad(){
 const pads=navigator.getGamepads?.()||[],p=[...pads].find(g=>g&&g.connected&&g.index!==p2?.index);if(!p){padHeld=[];return null;}
 const dz=v=>Math.abs(v)<.16?0:Math.sign(v)*((Math.abs(v)-.16)/.84)**1.6,b=i=>!!p.buttons[i]?.pressed||(p.buttons[i]?.value||0)>.35;
 const held=p.buttons.map((_,i)=>b(i)),prev=padHeld,pressed=i=>held[i]&&!prev[i];const out={index:p.index,x:dz(p.axes[0]||0)+(held[15]?1:0)-(held[14]?1:0),y:dz(p.axes[1]||0)+(held[13]?1:0)-(held[12]?1:0),fire:held[7]||held[0]||held[5],pressed};if(held.some(Boolean)||out.x||out.y)p1Pad=p.index;padHeld=held;return out;
}
// Co-op (A15 stretch): a gamepad player 1 is not using joins as player 2 with Start: its stick aims a second
// (blue) reticle and RT, A or RB fires from the Jeep's other side. Score, integrity and credits are shared.
let p2=null,p1Pad=null;
function coop(dt){
 const pads=[...(navigator.getGamepads?.()||[])].filter(g=>g&&g.connected),free=pads.find(g=>g.index!==p1Pad&&g.index!==p2?.index);
 $('coop-hint').hidden=!(mode==='playing'&&!p2&&free);
 if(!p2&&free&&mode==='playing'&&(free.buttons[9]?.pressed)){p2={index:free.index,aim:{x:.62,y:.5}};medal('coop');announce('PLAYER 2','Two guns on the Jeep.','SHARED SCORE · SHARED INTEGRITY',1.6);radio('Second gunner on board! Cover the other side!');}
 if(!p2)return;const g=pads.find(x=>x.index===p2.index);if(!g){p2=null;return;}
 const dz=v=>Math.abs(v)<.16?0:Math.sign(v)*((Math.abs(v)-.16)/.84)**1.6,b=i=>!!g.buttons[i]?.pressed||(g.buttons[i]?.value||0)>.35;
 p2.aim.x=Math.max(.02,Math.min(.98,p2.aim.x+(dz(g.axes[0]||0)+(b(15)?1:0)-(b(14)?1:0))*dt*1.15));p2.aim.y=Math.max(.19,Math.min(.85,p2.aim.y+(dz(g.axes[1]||0)+(b(13)?1:0)-(b(12)?1:0))*dt*1.15));
 if(mode==='playing'&&(b(7)||b(0)||b(5))&&game.shoot(p2.aim.x,p2.aim.y,innerWidth/innerHeight,2))processEvents();
}
let pad=null;
/** Jumps the running game to a stage at a time (shared by the attract mode and the test API). */
function seekTo(id,at=0){const idx=game.path.findIndex(n=>STAGES[n].id===id);if(idx<0)return false;game.stageIndex=idx;game.stageTime=at;game.travel=at*(id==='manor'?14:id==='fault'?27:24);renderer.actors.reset();game.phase='ride';game.phaseTime=at;game.entities=[];game.spawnTimer=.2;game.bossSpawned=false;game.bridgeBroken=false;stageChanged();updateHud();return true;}
function startAttract(){const was=route;route='extended';start();route=was;attract={index:Math.floor(Math.random()*ATTRACT_STAGES.length)-1,t:0};nextAttract();$('attract').hidden=false;document.body.dataset.attract='1';}
function nextAttract(){if(!attract)return;attract.index=(attract.index+1)%ATTRACT_STAGES.length;attract.t=0;const id=ATTRACT_STAGES[attract.index];game.hp=100;game.status='playing';seekTo(id,['gates','river','hybrid','visitor'].includes(id)&&Math.random()<.5?26:2+Math.random()*10);}
function stopAttract(){if(!attract)return;attract=null;$('attract').hidden=true;delete document.body.dataset.attract;backToMenu();}
/** The demo's gunner: eases the reticle onto the nearest visible threat and fires when on it. */
function autopilot(dt){
 renderer.sync(game,aim);const target=game.entities.find(e=>!e.dead&&e.age>.2&&renderer.project(e)?.visible!==false);
 if(target){const p=renderer.project(target,innerWidth/innerHeight),k=Math.min(1,dt*7);aim.x+=(p.hx-aim.x)*k;aim.y+=(p.hy-aim.y)*k;if(Math.hypot(p.hx-aim.x,p.hy-aim.y)<.05)game.shoot(aim.x,aim.y,innerWidth/innerHeight);}
 else{aim.x+=(.5+Math.sin(game.time*.7)*.12-aim.x)*dt*2;aim.y+=(.47-aim.y)*dt*2;}
 if(game.focus>=100)game.activateFocus();game.hp=Math.max(game.hp,60);
}
function step(dt){
 if(attract){attract.t+=dt;autopilot(dt);if(attract.t>ATTRACT_SEGMENT)nextAttract();}
 if(mode!=='playing')return;
 const speed=.65;aim.x=Math.max(.02,Math.min(.98,aim.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*dt*speed));aim.y=Math.max(.19,Math.min(.85,aim.y+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*dt*speed));
 if(pad){aim.x=Math.max(.02,Math.min(.98,aim.x+pad.x*dt*1.15));aim.y=Math.max(.19,Math.min(.85,aim.y+pad.y*dt*1.15));if((pad.pressed(3)||pad.pressed(1))&&game.focus>=100){game.activateFocus();}if(pad.pressed(4)||pad.pressed(6))lob();if(game.offer){const i=pad.pressed(14)?0:pad.pressed(12)?1:pad.pressed(15)?2:-1;if(i>=0){game.pick(i);processEvents();}}}
 game.update(dt);if(fire||keys.has(' ')||pad?.fire){renderer.sync(game,aim);game.shoot(aim.x,aim.y,innerWidth/innerHeight);}processEvents();renderer.update(dt);audio.update(game);
 if(field.context&&renderer.bossRex){renderer.bossRex.voice=field.vocalPose(dt);field.listen(renderer.world.camera,renderer.bossRex.headOf(renderer.bossRex.voiceSlot??0));field.update(Math.min(16,Math.abs(game.speed)),dt,true,BOSS_STAGES.includes(game.stage.id));}
 if(field.context)ambience.update(true);
 if(clearCard>0&&(clearCard-=dt)<=0){if(game?.stage.id==='visitor')announce('THE KINGS HAVE FALLEN','The park is yours.',tallyLine(),2.6,true);else announce('SECTOR CLEAR',clearCopy(),tallyLine(),2.6,true);}
 announcementTime=Math.max(0,announcementTime-dt);radioTime=Math.max(0,radioTime-dt);$('announcement').style.opacity=String(Math.min(1,announcementTime*2));$('radio').style.opacity=String(Math.min(1,radioTime));
}
let hudTick=0;
function frame(now){const raw=now-last,dt=Math.min(.1,raw/1000);last=now;
 pad=gamepad();
 // The attract mode: idle on the menu starts it; any input (here, a gamepad button) ends it.
 if(mode==='menu'&&ready&&!test&&!document.hidden&&!$('about').open&&!$('medals').open&&!$('practice').open){idle+=Math.min(2,raw/1000);if(idle>ATTRACT_IDLE){idle=0;startAttract();}}else if(mode!=='playing')idle=0;
 if(attract&&pad&&padHeld.some(Boolean)){stopAttract();padHeld=padHeld.map(()=>true);}
 // Gamepad on the screens: A starts, continues or restarts; Start pauses and resumes.
 if(pad){if(pad.pressed(9)){if(mode==='playing')pause();else if(mode==='paused')resume();}
  // Initials by d-pad: up and down turn the last letter, right adds one, left removes one, A saves.
  if(entering){const v=$('initials').value.toUpperCase().replace(/[^A-Z]/g,''),turn=d=>{const s=v||'A',c=s.charCodeAt(s.length-1)-65;$('initials').value=s.slice(0,-1)+String.fromCharCode(65+((c+d+26)%26));};
   if(pad.pressed(12))turn(1);if(pad.pressed(13))turn(-1);if(pad.pressed(15)&&v.length<3)$('initials').value=(v||'A')+'A';if(pad.pressed(14))$('initials').value=v.slice(0,-1);}
  if(pad.pressed(0)){if(entering)saveInitials();else if(mode==='menu')$('start').click();else if(mode==='continue'&&!$('continue').hidden)$('continue').click();else if(mode==='result')$('restart').click();}}
 // CONTINUE? 10 … 1: the last three tick higher; at zero the run ends.
 if(!frozen&&mode==='continue'&&continueClock>0){const was=Math.ceil(continueClock);continueClock-=dt;const left=Math.max(0,Math.ceil(continueClock));if(left!==was&&left>0)audio.tone(left<=3?880:620,.08,.1,'square');$('overlay-kicker').textContent=`CONTINUE? ${left}`;if(continueClock<=0){continueClock=0;showResult(false);}}if(quality&&!frozen&&!document.hidden&&quality.sample(raw,mode==='playing'))qualityLabel();
 if(!frozen){if(mode==='menu'&&!document.hidden)clock+=dt;if(mode==='playing'){if(hitStop>0)hitStop-=dt;else{accumulator+=dt*slowScale(dt);while(accumulator>=1/60){step(1/60);accumulator-=1/60;}}hudTick+=dt;if(hudTick>.08){updateHud();hudTick=0;}
   // Low integrity: a heartbeat in time with the pulsing vignette (light.js).
   if(medalTime>0&&(medalTime-=dt)<=0)$('medal').hidden=true;
   heartbeat-=dt;if(game.hp<=30&&game.status==='playing'&&heartbeat<=0){heartbeat=.84;audio.tone(58,.11,.14,'sine',42);setTimeout(()=>audio.tone(52,.13,.11,'sine',38),170);}}}
 coop(dt);renderer.render(game,aim,{menu:mode==='menu',time:game?.time??clock,aim2:mode==='playing'?p2?.aim:null});bossCues();
 // Inside the rotunda the reverb becomes a stone hall: gunfire and roars ring off the walls.
 field.space?.(mode==='playing'&&renderer.world.rotunda?.root.visible?'hall':'forest');requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
async function load(){
 try{await renderer.load(p=>$('load-status').textContent=`Preparing the island · ${Math.round(p*100)}%`);ready=true;
  // A leaping ichthyosaur throws a ring of spray where it breaks the surface.
  // Tests pin High (or ?quality=) so captures and timings stay comparable.
  quality=new CircuitQuality(renderer,{fixed:test?new URLSearchParams(location.search).get('quality')||'high':null});quality.apply();qualityLabel();
  ambience.world=renderer.world;renderer.actors.effects=renderer.effects;renderer.actors.onSplash=(at,strength)=>{field.splash('step',at,strength);renderer.world.spray.burst(at,strength);renderer.world.river.ring(at.x,at.z,strength);for(let i=0;i<8;i++){const r=i/8*Math.PI*2;renderer.effects.spume(at.clone().setY(at.y-.2),at.clone().set(Math.cos(r)*2.4*strength,3.4*strength+Math.random(),Math.sin(r)*2.4*strength),{size:1.1,opacity:.24,life:1.5});}};
  // A9: the wading brachiosaur's call and footfalls (brachio-crossing.js).
  renderer.actors.brachio.onCall=p=>field.brachio?.(p);renderer.actors.crossing.onStep=p=>{field.splash('step',p,1);renderer.shake=Math.max(renderer.shake,.55*Math.max(0,1-p.distanceTo(renderer.world.camera.position)/45));};
  $('start').disabled=false;$('start-label').textContent='START THE RIDE';$('load-status').textContent='';updateBest();void renderer.loadBosses();}
 catch{$('load-status').textContent='The island could not load. Check your connection and reload this page.';$('start-label').textContent='RELOAD TO RETRY';$('start').disabled=false;$('start').onclick=()=>location.reload();}
}void load();
window.lostCircuit={get ready(){return ready;},get mode(){return mode;},get room(){return field.room||null;},snapshot:()=>game?.snapshot(),get audioState(){return audio.context?.state||'uninitialized';},get art(){return Object.fromEntries(Object.entries(renderer.images).map(([key,im])=>[key,{width:im.width,height:im.height}]));}};
// Object.assign would copy a getter's current value; quality is created after loading.
if(test)Object.defineProperty(window.lostCircuit,'quality',{get:()=>quality});
if(test)Object.assign(window.lostCircuit,{getGame:()=>game,get renderer(){return renderer;},get ambience(){return ambience;},project:e=>renderer.project(e,innerWidth/innerHeight),bossesReady:()=>renderer.loadBosses().then(()=>renderer.bossRex.ready),diagnostics:()=>({trike:renderer.bossTrike?.diagnostics(),bosses:renderer.bossRex?.diagnostics(),weapon:renderer.weapon.diagnostics(),camera:renderer.world.camera.position.toArray(),actors:renderer.actors.diagnostics(),draws:renderer.world.renderer.info.render.calls,triangles:renderer.world.renderer.info.render.triangles}),freeze:v=>{frozen=v;},step:(seconds,autoplay=false,live=false)=>{
 // live: sync the scene every substep, as real frames do (modeled bosses integrate motion per frame).
 for(let t=0;t<seconds&&mode==='playing';t+=1/60){if(live&&!autoplay)renderer.sync(game,aim);if(autoplay){renderer.sync(game,aim);const target=game.entities.find(e=>!e.dead&&e.age>.2&&renderer.project(e)?.visible!==false);if(target){const p=renderer.project(target,innerWidth/innerHeight);aim.x=p.hx;aim.y=p.hy;game.shoot(aim.x,aim.y,innerWidth/innerHeight);}if(game.focus>=100)game.activateFocus();}step(1/60);}updateHud();renderer.render(game,aim,{time:game.time});},seek:(id,at=0)=>{if(!seekTo(id,at))throw Error('Stage is not on route');},setAim:(x,y)=>{aim.x=x;aim.y=y;},render:()=>renderer.render(game,aim,{time:game?.time??0,menu:mode==='menu'})});
