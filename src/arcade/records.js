import {recordKey} from './rules.js';
function valid(value){const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:0;}
export function readRecord(getStorage,route,difficulty,continued=false){try{return valid(getStorage().getItem(recordKey(route,difficulty,continued)));}catch{return 0;}}
export function saveRecord(getStorage,game){
 try{const storage=getStorage(),key=recordKey(game.route,game.difficulty,game.continues>0),best=Math.max(valid(storage.getItem(key)),valid(game.score));storage.setItem(key,String(best));return{saved:true,best};}
 catch{return{saved:false,best:game.score};}
}
// A15: the cabinet's local top ten per route and difficulty, with three-letter initials.
// Entries: {n:'ABC', s:score, g:rank letter, c:1 if continued}; best first; corrupt storage reads as empty.
const boardKey=(route,difficulty)=>recordKey(route,difficulty,false)+'.board';
export function readBoard(getStorage,route,difficulty){try{const v=JSON.parse(getStorage().getItem(boardKey(route,difficulty))||'[]');return Array.isArray(v)?v.filter(e=>e&&/^[A-Z]{1,3}$/.test(e.n)&&valid(e.s)===e.s&&e.s>0).sort((a,b)=>b.s-a.s).slice(0,10):[];}catch{return [];}}
/** Where a score would place on the board (0-9), or -1. */
export function boardPlace(board,score){if(!(score>0))return -1;const i=board.findIndex(e=>score>e.s);return i>=0?i:board.length<10?board.length:-1;}
export function addToBoard(getStorage,route,difficulty,entry){
 const board=readBoard(getStorage,route,difficulty),index=boardPlace(board,entry.s);if(index<0)return{board,index};
 board.splice(index,0,entry);board.length=Math.min(board.length,10);try{getStorage().setItem(boardKey(route,difficulty),JSON.stringify(board));}catch{/* shown, not kept */}return{board,index};
}
