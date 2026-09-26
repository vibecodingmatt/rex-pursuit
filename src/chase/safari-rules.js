// One catalogue for scoring, the field guide, encounter health and results.
export const SAFARI_SECONDS=90;
export const SPECIES={
 compy:{name:'Compy',points:100,hp:1,rarity:'Common',hint:'Small, fast crossers'},
 bird:{name:'Jungle bird',points:125,hp:1,rarity:'Common',hint:'Brief canopy flushes'},
 lizard:{name:'Lizard',points:150,hp:1,rarity:'Common',hint:'Tiny; basks on verge rocks'},
 gallimimus:{name:'Gallimimus',points:200,hp:2,rarity:'Common',hint:'Fast-moving herds'},
 dimorphodon:{name:'Dimorphodon',points:250,hp:1,rarity:'Uncommon',hint:'Roosts on the edge trees'},
 pteranodon:{name:'Pteranodon',points:300,hp:2,rarity:'Uncommon',hint:'Glides down the canopy gap'},
 raptor:{name:'Velociraptor',points:450,hp:3,rarity:'Uncommon',hint:'Quick, weaving runners'},
 pachycephalosaurus:{name:'Pachycephalosaurus',points:550,hp:3,rarity:'Uncommon',hint:'Dome-headed; zigzags as it runs'},
 dilophosaurus:{name:'Dilophosaurus',points:700,hp:4,rarity:'Rare',hint:'Twin crests; a short crossing'},
 parasaurolophus:{name:'Parasaurolophus',points:900,hp:6,rarity:'Rare',hint:'Heavy hide, swept crest'},
 stegosaurus:{name:'Stegosaurus',points:1000,hp:9,rarity:'Rare',hint:'Plated and slow; soaks up rounds'},
 triceratops:{name:'Triceratops',points:1200,hp:10,rarity:'Rare',hint:'Three horns, one armoured crossing'},
 quetzalcoatlus:{name:'Quetzalcoatlus',points:1800,hp:8,rarity:'Legendary',hint:'One fast pass overhead'},
 ghostRaptor:{name:'Ghost raptor',points:2500,hp:9,rarity:'Legendary',hint:'Pale hide; exceptionally elusive'},
 goldenCompy:{name:'Golden compy',points:3000,hp:1,rarity:'Legendary',hint:'Tiny, gold and gone in a blink'}
};
/** Streak multiplier by kills in a row: x2 from the 3rd, x3 from the 6th, x4 from the 10th, x5 from the 15th. */
export const CHAIN=[[15,5],[10,4],[6,3],[3,2]],CHAIN_SECONDS=4;
export const chainMultiplier=chain=>CHAIN.find(([n])=>chain>=n)?.[1]||1;
export const isRare=kind=>['Rare','Legendary'].includes(SPECIES[kind]?.rarity);
export class SafariRound{
 constructor(){Object.assign(this,{ready:3,elapsed:0,score:0,kills:0,rare:0,chain:0,bestChain:0,lastKill:-Infinity,lastAward:0,breakdown:{},complete:false});}
 tick(dt){
  if(this.complete)return;
  const step=Math.max(0,dt),waiting=Math.min(this.ready,step);this.ready-=waiting;
  this.elapsed=Math.min(SAFARI_SECONDS,this.elapsed+step-waiting);
  if(this.elapsed>=SAFARI_SECONDS-1e-6){this.elapsed=SAFARI_SECONDS;this.complete=true;}
 }
 get multiplier(){return this.elapsed-this.lastKill<=CHAIN_SECONDS?chainMultiplier(this.chain):1;}
 get chainLeft(){return Math.max(0,1-(this.elapsed-this.lastKill)/CHAIN_SECONDS);}
 /** Kills still needed for the next multiplier step, or 0 at the top. */
 get nextStep(){const next=[...CHAIN].reverse().find(([n])=>n>(this.chainLeft?this.chain:0));return next?next[0]-(this.chainLeft?this.chain:0):0;}
 award(kind){
  const s=SPECIES[kind];if(!s||this.ready>0||this.complete)return 0;
  this.chain=this.elapsed-this.lastKill<=CHAIN_SECONDS?this.chain+1:1;this.lastKill=this.elapsed;
  this.bestChain=Math.max(this.bestChain,this.chain);const points=s.points*this.multiplier;
  this.score+=points;this.kills++;if(isRare(kind))this.rare++;
  this.breakdown[kind]=(this.breakdown[kind]||0)+points;this.lastAward=points;return points;
 }
}
export const RANKS=[[30000,'Jungle legend'],[18000,'Master tracker'],[9000,'Expert marksman'],[3000,'Field scout'],[0,'Trail rookie']];
export function safariRank(score){return RANKS.find(([n])=>score>=n)[1];}

// Scores are local to this browser. Keep the cookie comfortably below 4 KB and
// treat imported/corrupt values as data, never markup. No identity or network.
export const SCORE_COOKIE='rex_safari_v1';
// `seen` lists every species this browser has ever bagged, for the field guide.
export function parseScores(raw){
 try{const data=JSON.parse(raw);if(data.v!==1||!Array.isArray(data.top))return {v:1,runs:0,top:[],seen:[]};
  const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9,seen=Array.isArray(data.seen)?[...new Set(data.seen.filter(k=>typeof k==='string'&&Object.hasOwn(SPECIES,k)))]:[];
  return {v:1,runs:valid(data.runs)?data.runs:0,top:data.top.filter(r=>r&&valid(r.score)&&valid(r.kills)&&valid(r.rare)&&Number.isSafeInteger(r.at)&&r.at>0).sort((a,b)=>b.score-a.score).slice(0,5).map(({score,kills,rare,at})=>({score,kills,rare,at})),seen};
 }catch{return {v:1,runs:0,top:[],seen:[]};}
}
export function readScores(doc=globalThis.document,storage){
 try{storage??=globalThis.localStorage;}catch{}
 try{const value=doc.cookie.split('; ').find(c=>c.startsWith(SCORE_COOKIE+'='));if(value)return parseScores(decodeURIComponent(value.slice(SCORE_COOKIE.length+1)));}catch{}
 try{return parseScores(storage.getItem(SCORE_COOKIE));}catch{return parseScores('');}
}
export function saveScore(round,doc=globalThis.document,storage){
 // Access to storage itself can throw in privacy modes.
 try{storage??=globalThis.localStorage;}catch{}
 const board=readScores(doc,storage),previous=board.top[0]?.score||0;
 const row={score:round.score,kills:round.kills,rare:round.rare,at:Date.now()};
 board.runs++;board.seen=[...new Set([...board.seen,...Object.keys(round.breakdown||{})])];board.top.push(row);board.top.sort((a,b)=>b.score-a.score||b.at-a.at);board.top=board.top.slice(0,5);
 const value=JSON.stringify(board);let saved=false;
 try{const path=new URL('.',globalThis.location?.href||'https://local.invalid/').pathname;
  doc.cookie=`${SCORE_COOKIE}=${encodeURIComponent(value)}; Max-Age=31536000; Path=${path}; SameSite=Lax${globalThis.location?.protocol==='https:'?'; Secure':''}`;
  saved=doc.cookie.split('; ').some(c=>c===`${SCORE_COOKIE}=${encodeURIComponent(value)}`);
 }catch{}
 if(!saved)try{storage.setItem(SCORE_COOKIE,value);saved=storage.getItem(SCORE_COOKIE)===value;}catch{}
 return {board,saved,record:round.score>previous};
}
