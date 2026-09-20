import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {Encounter} from '../src/chase/combat.js';
import {TARGET_SITES} from '../src/chase/target-sites.js';
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const profiles=[
 {name:'head-only',accuracy:1,head:1,targets:0,aim:.1},
 {name:'learning',accuracy:.48,head:.35,targets:.72,aim:.40},
 {name:'steady',accuracy:.68,head:.45,targets:.85,aim:.30},
 {name:'expert',accuracy:.88,head:.65,targets:.94,aim:.20},
];
const results=[];
for(const profile of profiles){
 const runs=[];
 for(let seed=1;seed<=80;seed++){
  const state=new Encounter(rng(seed*73)),random=rng(seed*397);let focus='',delay=0,cooling=false;
  for(let i=0;i<60*120&&!state.result;i++){
   state.tick(1/60);state.drainEvents();if(state.weaponsLocked)continue;
   const d=profile.targets&&state.debris?.status==='active'?state.debris:null,o=profile.targets&&state.phase==='challenge'?state.objective:null;
   const key=d?`debris${d.id}`:o?`target${o.number}/${o.current}`:'rex';if(key!==focus){focus=key;delay=profile.aim;}
   delay=Math.max(0,delay-1/60);
   if((['stunned','recover'].includes(state.phase)&&state.ammo<55)||(state.overheated&&state.ammo<60))state.startReload();
   if(state.heat>.88)cooling=true;if(state.heat<.47)cooling=false;
   if(!delay){
    if(d&&state.reload>0&&state.launch())state.hitDebris(d.id,true);
    else if(!d&&!o&&state.launch()&&random()<profile.accuracy)state.hit(false,true);
    if((d||o||!cooling)&&state.fire()){
     if(d){if(random()<profile.targets)state.hitDebris(d.id);}
     else if(o){if(random()<profile.targets){state.hit(TARGET_SITES[o.order[o.current]].region==='head');state.hitTarget(o.order[o.current]);}}
     else if(random()<profile.accuracy)state.hit(random()<profile.head);
    }
   }
  }
  runs.push({result:state.result,seconds:state.fightTime,jeep:state.jeep,health:state.health,cleared:state.objectivesCleared,missed:state.objectivesMissed,debris:state.debrisCleared});
 }
 const won=runs.filter(r=>r.result==='won'),mean=(list,key)=>list.length?+(list.reduce((sum,r)=>sum+r[key],0)/list.length).toFixed(1):null;
 results.push({profile:profile.name,wins:won.length,runs:runs.length,meanWinSeconds:mean(won,'seconds'),meanWinJeep:mean(won,'jeep'),meanRemainingRex:mean(runs,'health'),meanObjectives:mean(runs,'cleared'),meanMissed:mean(runs,'missed'),meanDebris:mean(runs,'debris')});
}
console.log(JSON.stringify(results,null,2));
await writeFile('art/review/pressure-balance.json',JSON.stringify({note:'Seeded input simulations, not human playtests. Accuracy, aim time and simple reload/heat policies vary by profile.',results},null,2));
assert.equal(results[0].wins,0,'Ignoring all threats should not win through perfect head fire');
assert.ok(results[3].wins>=60,'Accurate, fast target switching must remain viable');
assert.ok(results[3].meanWinSeconds>45&&results[3].meanWinSeconds<90,'A skilled run should experience multiple escalating attacks');
