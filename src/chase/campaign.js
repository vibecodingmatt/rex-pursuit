// Browser-local campaign progress. Failure to persist never blocks this visit.
const KEY='rex-pursuit-campaign-v1';
// Temporary open access while chapter two is being art-directed/play-tested.
// Keep this separate from earned progress; switch off to restore progression.
export const RAVINE_PLAYTEST_OPEN=true;
export function ravineAvailable(storage){return RAVINE_PLAYTEST_OPEN||campaignProgress(storage).ravine;}
let session={ravine:false,completed:false};
export function campaignProgress(storage){
 try{const s=storage??globalThis.localStorage,p=JSON.parse(s.getItem(KEY)||'null');if(p?.version===1){session.ravine||=p.ravine===true;session.completed||=p.completed===true;}}catch{}
 return {...session};
}
export function completeChapter(chapter,storage){
 campaignProgress(storage);
 if(chapter===1)session.ravine=true;
 if(chapter===2&&(session.ravine||RAVINE_PLAYTEST_OPEN))session.completed=true;
 let saved=false;try{(storage??globalThis.localStorage).setItem(KEY,JSON.stringify({version:1,...session}));saved=true;}catch{}
 return {...session,saved};
}
