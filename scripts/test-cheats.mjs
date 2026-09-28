import assert from 'node:assert/strict';
import {Encounter} from '../src/chase/combat.js';
import {BreachRound} from '../src/breach/rules.js';
import {activateCheat,createCheatInput} from '../src/chase/cheats.js';
import {saveScore,readScores,SCORE_COOKIE,CHEAT_SCORE_COOKIE} from '../src/chase/safari-rules.js';
import {saveRun,readBoard,scoreKey} from '../src/chase/scoreboard.js';

for(const scenario of ['pursuit','safari','breach']){
 const round=scenario==='breach'?new BreachRound():new Encounter();if(scenario==='safari'){round.startSafari();round.safari.ready=0;}else if(scenario==='pursuit')round.transition('pursuit');
 round.ammo=2;round.startReload();round.heat=1;round.overheated=true;assert.ok(round.reload>0);assert.ok(activateCheat(round,'idkfa'));assert.equal(round.reload,0);assert.equal(round.ammo,80);assert.equal(round.cheated,true);assert.equal(round.heat,0,'activation instantly clears heat');assert.equal(round.overheated,false,'activation clears an existing overheat lock');
 if(scenario==='safari')assert.equal(round.safari.cheated,true);
 assert.equal(round.startReload(),false);
 for(let i=0;i<160;i++){round.shotTimer=0;assert.equal(scenario==='breach'?round.shoot():round.fire(),true,'sustained firing never overheats');}
 assert.equal(round.ammo,80);assert.equal(round.heat,0);assert.equal(round.overheated,false);assert.equal(round.shots,160);assert.equal(scenario==='breach'?round.shoot():round.fire(),false,'fire interval stays enforced');
 round.shotTimer=0;round.heat=1;round.overheated=true;assert.equal(scenario==='breach'?round.shoot():round.fire(),true,'cheat bypasses the heat gate');assert.equal(round.heat,0);
 assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),true);assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),false,'rocket cooldown unchanged');
 assert.ok(round.grenade>0);assert.ok(activateCheat(round,'idspispipd'));assert.equal(round.grenade,0,'rocket activation clears an existing cooldown');
 for(let i=0;i<160;i++)assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),true,'every rocket is accepted without advancing time');
 assert.equal(round.grenade,0);assert.equal(round.ammo,80);assert.equal(round.infiniteAmmo,true,'both codes coexist');
 assert.ok(activateCheat(round,'idkfa'));assert.equal(round.infiniteAmmo,false);assert.equal(round.infiniteRockets,true);
 round.shotTimer=0;assert.equal(scenario==='breach'?round.shoot():round.fire(),true);assert.equal(round.ammo,79);assert.ok(round.heat>0,'disabling IDKFA restores normal gun heat');assert.equal(round.startReload(),true);
 assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),true,'rockets remain unlimited with gun cheat off');
 assert.ok(activateCheat(round,'idkfa'));assert.equal(round.reload,0);assert.ok(activateCheat(round,'idspispipd'));assert.equal(round.infiniteRockets,false);assert.equal(round.infiniteAmmo,true);
 assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),true);assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),false,'disabling rocket cheat restores cooldown');
 assert.ok(activateCheat(round,'idkfa'));assert.equal(round.infiniteAmmo,false);assert.equal(round.cheated,true,'turning both off never restores fair-run eligibility');if(round.safari)assert.equal(round.safari.cheated,true);
 // Starting with rockets alone must not refill the gun, clear heat or reload.
 round.ammo=2;round.reload=1;round.heat=.7;assert.ok(activateCheat(round,'idspispipd'));assert.equal(round.ammo,2);assert.equal(round.reload,1);assert.equal(round.heat,.7);assert.equal(round.infiniteAmmo,false);
 assert.equal(activateCheat(round,'constructor'),false);round.result='won';for(const code of ['idkfa','idspispipd'])assert.equal(activateCheat(round,code),false);
 assert.equal(scenario==='breach'?round.shoot():round.fire(),false);assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),false);round.reset();assert.equal(round.cheated,false);assert.equal(round.infiniteAmmo,false);assert.equal(round.infiniteRockets,false);
 if(scenario==='safari'){round.startSafari();round.safari.ready=0;}else if(scenario==='pursuit')round.transition('pursuit');
 let fairShots=0;for(let i=0;i<80;i++){round.shotTimer=0;if(!(scenario==='breach'?round.shoot():round.fire()))break;fairShots++;}assert.ok(fairShots>0&&fairShots<80,'a clean restart restores normal overheating');assert.ok(round.heat>=.98);
 round.result='lost';assert.equal(activateCheat(round,'idkfa'),false);
}
let playing=true,now=1,activations=0;const input=createCheatInput({isPlaying:()=>playing,activate:()=>activations++,clock:()=>now});
function type(s,options={}){for(const key of s)input.key({key,...options});}
type('xxiIDKFA');assert.equal(activations,1,'case-insensitive code and prefix recovery');
type('idkfa',{repeat:true});type('idkfa',{ctrlKey:true});type('idkfa',{metaKey:true});type('idkfa',{altKey:true});type('idkfa',{isComposing:true});type('idkfa',{target:{closest:()=>true}});assert.equal(activations,1);
playing=false;type('idkfa');playing=true;type('id');input.reset();type('kfa');type('id');now+=3000;type('kfa');assert.equal(activations,1,'menu/pause/restart and timed-out sequences never activate');
type('idkfa');assert.equal(activations,2);
type('iDspISpiPD');type('idspispipd');type('idkfa');assert.equal(activations,5,'both codes can toggle repeatedly');
for(const options of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{target:{closest:()=>true}}])type('idspispipd',options);
assert.equal(activations,5);playing=false;type('idspispipd');playing=true;type('idspi');input.reset();type('spipd');type('idspi');now+=3000;type('spipd');assert.equal(activations,5);
const codes=[],keys=createCheatInput({isPlaying:()=>true,activate:code=>codes.push(code)});
for(const key of 'idspispipdidkfaidspispipdidkfa')assert.equal(keys.key({key}),true,'every code letter is consumed, including P pause/F flashlight');
assert.deepEqual(codes,['idspispipd','idkfa','idspispipd','idkfa']);

const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},cookies=new Map();
const doc={get cookie(){return [...cookies].map(([k,v])=>`${k}=${v}`).join('; ');},set cookie(v){const [pair]=v.split(';'),at=pair.indexOf('=');cookies.set(pair.slice(0,at),pair.slice(at+1));}};
saveScore({score:100,kills:1,rare:0,breakdown:{compy:100}},doc,storage);const fair=cookies.get(SCORE_COOKIE);
saveScore({cheated:true,score:99999,kills:30,rare:2,breakdown:{ghostRaptor:5000}},doc,storage);
assert.equal(cookies.get(SCORE_COOKIE),fair,'cheat run cannot alter the fair cookie, run count or field guide');assert.ok(cookies.has(CHEAT_SCORE_COOKIE));assert.equal(readScores(doc,storage).top[0].score,100);assert.equal(readScores(doc,storage,true).top[0].score,99999);
for(const scenario of ['pursuit','breach']){
 saveRun(scenario,{score:100,kills:1},storage);const clean=memory.get(scoreKey(scenario));
 for(let i=0;i<9;i++)saveRun(scenario,{score:9999+i,kills:50,cheated:true},storage);
 assert.equal(memory.get(scoreKey(scenario)),clean);assert.equal(readBoard(scenario,true,storage).length,5);assert.equal(readBoard(scenario,false,storage)[0].score,100);
}
const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},blockedDoc={get cookie(){throw Error('blocked');},set cookie(v){throw Error('blocked');}};
assert.equal(saveRun('breach',{score:1,kills:0,cheated:true},blocked).saved,false);assert.equal(saveScore({score:1,kills:0,rare:0,cheated:true},blockedDoc,blocked).saved,false);
assert.equal(saveScore({score:777,kills:1,rare:0,cheated:true},blockedDoc,storage).saved,true);assert.equal(readScores(blockedDoc,storage,true).top[0].score,777);assert.equal(readScores(blockedDoc,storage).top.length,0);
console.log('Cheats passed: all scenario ammo/reload/heat/cooldown rules, input guards and reset, isolated fair/cheater cookies and top five, blocked storage.');
