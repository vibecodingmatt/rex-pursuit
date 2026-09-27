// Separate physical keys make it impossible for a cheat save to replace a fair
// score through an ordinary game path. These are local records, not a server.
export const scoreKey=(scenario,cheated=false)=>`rex-${scenario}-${cheated?'cheaters':'scores'}-v1`;
export function readBoard(scenario,cheated=false,storage){
 try{storage??=globalThis.localStorage;const rows=JSON.parse(storage.getItem(scoreKey(scenario,cheated)));
  return Array.isArray(rows)?rows.filter(r=>r&&Number.isSafeInteger(r.score)&&r.score>=0&&r.score<=1e9&&Number.isSafeInteger(r.kills)&&r.kills>=0&&Number.isSafeInteger(r.at)&&r.at>0).sort((a,b)=>b.score-a.score||b.at-a.at).slice(0,5):[];
 }catch{return [];}
}
export function saveRun(scenario,round,storage){
 const cheated=!!round.cheated,rows=readBoard(scenario,cheated,storage),previous=rows[0]?.score||0;
 rows.push({score:round.score,kills:round.kills,at:Date.now()});rows.sort((a,b)=>b.score-a.score||b.at-a.at);rows.length=Math.min(5,rows.length);
 let saved=false;try{storage??=globalThis.localStorage;const value=JSON.stringify(rows);storage.setItem(scoreKey(scenario,cheated),value);saved=storage.getItem(scoreKey(scenario,cheated))===value;}catch{}
 return {rows,saved,cheated,record:round.score>previous};
}
export function createScoreboard({root,list=null,title='LOCAL TOP FIVE',noun='bagged',load}){
 const heading=document.createElement('h3'),tabs=document.createElement('div'),status=document.createElement('p');heading.textContent=title;tabs.className='score-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Leaderboard category');
 root.classList.add('scoreboard');root.append(heading,tabs);if(!list)list=document.createElement('ol');root.append(list,status);status.className='score-save-status';
 let selected=false,current=null;const buttons=[false,true].map(cheated=>{const b=document.createElement('button');b.type='button';b.textContent=cheated?'CHEATERS':'FAIR PLAY';b.onclick=()=>render(cheated);tabs.append(b);return b;});
 function render(cheated){selected=cheated;buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(Boolean(i)===cheated)));list.replaceChildren();
  const rows=current?.cheated===cheated?current.rows:load(cheated);
  for(const r of rows){const row=document.createElement('li'),value=document.createElement('b'),detail=document.createElement('span');value.textContent=r.score.toLocaleString();detail.textContent=`${r.kills} ${noun} · ${new Date(r.at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;row.append(value,detail);list.append(row);}
  if(!rows.length){const row=document.createElement('li');row.textContent='No runs recorded yet.';list.append(row);}
  status.textContent=(current?.cheated?'Cheat run — excluded from fair-play records. ':'')+(current?.saved===false?'Storage unavailable. This run lasts for this visit.':'Top five saved on this browser.');
 }
 return {show(result){current=result;render(result.cheated);},refresh(){render(selected);}};
}
