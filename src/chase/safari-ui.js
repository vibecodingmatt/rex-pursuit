import {SPECIES,SAFARI_SECONDS,RANKS,readScores,saveScore,safariRank} from './safari-rules.js';
import {createScoreboard} from './scoreboard.js';
import {MODES} from './modes.js';
const $=s=>document.querySelector(s),number=n=>Math.round(n).toLocaleString();
export function createSafariUI({state,director,hub,onSelect,reducedMotion=false}){
 let selected='pursuit',board=readScores(),best=board.top[0]?.score||0,lastCue=-1,shownScore=0,lastMultiplier=1,lastTick=performance.now(),countUp=0;
 const guide=$('#field-guide'),list=$('#species-list'),callout=$('#safari-callout');
 const scores=createScoreboard({root:$('#safari-scoreboard'),list:$('#safari-board'),load:cheated=>readScores(undefined,undefined,cheated).top});
 let cheatBest=readScores(undefined,undefined,true).top[0]?.score||0;
 function renderGuide(){
  list.replaceChildren();const seen=new Set(board.seen);
  for(const [kind,s]of Object.entries(SPECIES)){
   const row=document.createElement('div');row.className='species-row';row.dataset.rarity=s.rarity;row.dataset.seen=String(seen.has(kind));
   const name=document.createElement('strong'),detail=document.createElement('small'),points=document.createElement('b'),mark=document.createElement('em');
   name.textContent=s.name;detail.textContent=`${s.rarity} · ${s.hp} hit${s.hp===1?'':'s'} · ${s.hint}`;points.textContent=number(s.points);mark.textContent=seen.has(kind)?'BAGGED':'';
   const label=document.createElement('span');label.append(name,detail);row.append(label,mark,points);list.append(row);
  }
  $('#guide-count').textContent=`${seen.size} / ${Object.keys(SPECIES).length} SPECIES BAGGED`;
 }
 renderGuide();
 $('#guide-open').onclick=()=>guide.showModal();$('#guide-close').onclick=()=>guide.close();
 // The hub owns the rail, copy and preview; this keeps the Safari details and the start label in step.
 function select(value,options){
  selected=hub.select(value,options);
  $('#safari-menu-info').hidden=selected!=='safari';$('#safari-best').textContent=best?`PERSONAL BEST ${number(best)}`:'NO DAMAGE · JUST THE HUNT';
  if(!$('#start').disabled)$('#start-label').textContent=MODES[selected].cta;
  onSelect?.(selected);
 }
 function flash(text,kind=''){if(!callout)return;callout.textContent=text;callout.dataset.kind=kind;callout.classList.remove('show');void callout.offsetWidth;callout.classList.add('show');}
 return{
  get selected(){return selected;},select,flash,
  reset(){lastCue=-1;shownScore=0;lastMultiplier=1;countUp=0;callout?.classList.remove('show');$('#safari-results').hidden=true;$('#safari-hud').hidden=!state.safari;$('#mission-clock>span').textContent=state.safari?'TIME LEFT':'OVERRUN IN';
   $('.integrity .hud-label').textContent=state.safari?'ANIMALS BAGGED':'JEEP INTEGRITY';$('#pause-screen h2').textContent=state.safari?'Safari paused.':'Chase paused.';$('#resume').textContent=state.safari?'BACK TO THE RUN ↗':'BACK TO THE CHASE ↗';},
  update(cue){
   const s=state.safari;if(!s)return;const now=performance.now(),dt=Math.min(.1,(now-lastTick)/1000);lastTick=now;
   // The score counts up to its value rather than jumping.
   shownScore=shownScore<s.score?Math.min(s.score,shownScore+Math.max(40,(s.score-shownScore)*dt*9)):s.score;
   $('#safari-score').textContent=number(shownScore);$('#safari-record').textContent=`${state.cheated?'CHEAT BEST':'BEST'} ${number(Math.max(state.cheated?cheatBest:best,s.score))}`;
   const m=s.multiplier;$('#safari-multiplier').textContent=`×${m}`;$('#safari-multiplier').dataset.level=String(m);
   $('#safari-chain').textContent=s.chainLeft?(s.nextStep?`${s.chain} IN A ROW · ${s.nextStep} TO ×${m+1}`:`${s.chain} IN A ROW · MAX`):'KILL WITHIN 4s TO CHAIN';
   $('#safari-streak-fill').style.transform=`scaleX(${s.chainLeft})`;
   if(m>lastMultiplier){flash(`×${m} STREAK`,'streak');cue(true);}lastMultiplier=m;
   const notice=director.notice,rare=notice&&notice.points;
   $('#safari-notice').textContent=notice?(rare?`${notice.rarity.toUpperCase()} · ${notice.name.toUpperCase()} · ${number(notice.points)} PTS`:`${notice.name.toUpperCase()} · ${notice.rarity.toUpperCase()}`):s.elapsed>SAFARI_SECONDS-30?'FINAL SECTOR · KEEP THE STREAK ALIVE':'SAFARI RUN · 90 SECOND SCORE ATTACK';
   $('#safari-notice').dataset.rare=notice?notice.rarity==='Legendary'?'legendary':'rare':'';
   $('#jeep-value').textContent=s.kills;$('#distance').textContent=`BEST STREAK ${s.bestChain}`;$('#pressure-level').textContent=s.ready?'GET READY':`${s.rare} RARE`;
   if(s.ready){$('#warning-title').textContent=Math.ceil(s.ready);$('#warning-tip').textContent='SHOOT THE WILDLIFE · NOTHING HURTS YOU';$('#warning').style.opacity=1;}
   else if(s.elapsed<1.1){$('#warning-title').textContent='OPEN SEASON';$('#warning-tip').textContent='KEEP MOVING. KEEP SCORING.';$('#warning').style.opacity=1;}
   const beat=s.ready?Math.ceil(s.ready):s.elapsed<1?0:state.remaining<=10?100+Math.ceil(state.remaining):-1;
   if(beat>=0&&beat!==lastCue){lastCue=beat;cue(beat===0);}
  },
  finish(){
   const s=state.safari;s.cheated=state.cheated;const result=saveScore(s);
   if(result.cheated)cheatBest=result.board.top[0]?.score||0;else{board=result.board;best=board.top[0]?.score||0;renderGuide();}
   $('#end-eyebrow').textContent=result.cheated?'SAFARI COMPLETE · CHEAT RUN':result.record?'NEW PERSONAL BEST':'SAFARI RUN COMPLETE';
   const rank=safariRank(s.score),next=RANKS.slice().reverse().find(([n])=>n>s.score);
   const rarest=Object.keys(s.breakdown).sort((a,b)=>SPECIES[b].points-SPECIES[a].points)[0];
   $('#end-copy').textContent=`${rank}. `+(s.rare?`${s.rare} rare animal${s.rare===1?'':'s'} bagged${rarest?`; best trophy: ${SPECIES[rarest].name}`:''}.`:'The rarest creatures are still out there.')+(next?` ${number(next[0]-s.score)} more for ${next[1]}.`:'');
   $('#end-stats').textContent=`90s · ${s.kills} animals · ${s.bestChain} best streak`;
   $('#safari-results').hidden=false;$('#safari-hud').hidden=true;
   const breakdown=$('#safari-breakdown');breakdown.replaceChildren();
   for(const [kind,points]of Object.entries(s.breakdown).sort((a,b)=>b[1]-a[1])){const row=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');row.dataset.rarity=SPECIES[kind].rarity;label.textContent=`${SPECIES[kind].name} ×${state.bag[kind]}`;value.textContent=number(points);row.append(label,value);breakdown.append(row);}
   if(!s.kills)breakdown.textContent='Hold FIRE and lead the moving animals. Grenades clear clustered packs.';
   scores.show({...result,rows:result.board.top});$('#safari-save-status').textContent='';
   $('#mission-clock').hidden=true;
   // Count the final score up on the results card.
   const end=$('#end-title'),target=s.score,started=performance.now(),run=++countUp,span=reducedMotion?0:Math.min(1400,500+target/25);
   const step=t=>{if(run!==countUp)return;const u=span?Math.min(1,(t-started)/span):1;end.textContent=`${number(target*(1-(1-u)**3))} points`;if(u<1)requestAnimationFrame(step);};step(started);
  }
 };
}
