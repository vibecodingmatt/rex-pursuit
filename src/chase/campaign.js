// Browser-local campaign progress. Failure to persist never blocks this visit.
const KEY='rex-pursuit-campaign-v1';
let session={ravine:false,completed:false};
export function campaignProgress(storage){
 try{const s=storage??globalThis.localStorage,p=JSON.parse(s.getItem(KEY)||'null');if(p?.version===1){session.ravine||=p.ravine===true;session.completed||=p.completed===true;}}catch{}
 return {...session};
}
export function completeChapter(chapter,storage){
 campaignProgress(storage);
 if(chapter===1)session.ravine=true;
 if(chapter===2&&session.ravine)session.completed=true;
 let saved=false;try{(storage??globalThis.localStorage).setItem(KEY,JSON.stringify({version:1,...session}));saved=true;}catch{}
 return {...session,saved};
}
