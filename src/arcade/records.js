import {recordKey} from './rules.js';
function valid(value){const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:0;}
export function readRecord(getStorage,route,difficulty,continued=false){try{return valid(getStorage().getItem(recordKey(route,difficulty,continued)));}catch{return 0;}}
export function saveRecord(getStorage,game){
 try{const storage=getStorage(),key=recordKey(game.route,game.difficulty,game.continues>0),best=Math.max(valid(storage.getItem(key)),valid(game.score));storage.setItem(key,String(best));return{saved:true,best};}
 catch{return{saved:false,best:game.score};}
}
