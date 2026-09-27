import assert from 'node:assert/strict';
import {Encounter} from '../src/chase/combat.js';
import {BreachRound} from '../src/breach/rules.js';
import {activateCheat,createCheatInput} from '../src/chase/cheats.js';
import {saveScore,readScores,SCORE_COOKIE,CHEAT_SCORE_COOKIE} from '../src/chase/safari-rules.js';
import {saveRun,readBoard,scoreKey} from '../src/chase/scoreboard.js';

for(const scenario of ['pursuit','safari','breach']){
 const round=scenario==='breach'?new BreachRound():new Encounter();if(scenario==='safari'){round.startSafari();round.safari.ready=0;}else if(scenario==='pursuit')round.transition('pursuit');
 round.ammo=2;round.startReload();assert.ok(round.reload>0);assert.ok(activateCheat(round,'idkfa'));assert.equal(round.reload,0);assert.equal(round.ammo,80);assert.equal(round.cheated,true);
 if(scenario==='safari')assert.equal(round.safari.cheated,true);
 assert.equal(activateCheat(round,'idkfa'),false);assert.equal(round.startReload(),false);
 for(let i=0;i<160;i++){round.shotTimer=0;round.heat=0;round.overheated=false;assert.equal(scenario==='breach'?round.shoot():round.fire(),true);}
 assert.equal(round.ammo,80);assert.equal(round.shots,160);assert.equal(scenario==='breach'?round.shoot():round.fire(),false,'fire interval stays enforced');
 round.shotTimer=0;round.heat=1;round.overheated=true;assert.equal(scenario==='breach'?round.shoot():round.fire(),false,'heat still limits firing');
 assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),true);assert.equal(scenario==='breach'?round.launchGrenade():round.launch(),false,'rocket cooldown unchanged');
 round.result='won';assert.equal(scenario==='breach'?round.shoot():round.fire(),false);round.reset();assert.equal(round.cheated,false);assert.equal(round.infiniteAmmo,false);
 round.result='lost';assert.equal(activateCheat(round,'idkfa'),false);
}
let playing=true,now=1,activations=0;const input=createCheatInput({isPlaying:()=>playing,activate:()=>activations++,clock:()=>now});
function type(s,options={}){for(const key of s)input.key({key,...options});}
type('xxiIDKFA');assert.equal(activations,1,'case-insensitive code and prefix recovery');
type('idkfa',{repeat:true});type('idkfa',{ctrlKey:true});type('idkfa',{metaKey:true});type('idkfa',{altKey:true});type('idkfa',{isComposing:true});type('idkfa',{target:{closest:()=>true}});assert.equal(activations,1);
playing=false;type('idkfa');playing=true;type('id');input.reset();type('kfa');type('id');now+=3000;type('kfa');assert.equal(activations,1,'menu/pause/restart and timed-out sequences never activate');
type('idkfa');assert.equal(activations,2);

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
