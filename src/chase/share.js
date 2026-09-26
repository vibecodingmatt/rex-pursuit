// Always share the public game, including when testing on localhost or a preview.
const GAME_URL='https://vibecodingmatt.github.io/rex-pursuit/';
export function setupSharing({button,copyButton,status,fallback,input,getState}){
 let generation=0;
 input.value=GAME_URL;
 const reset=()=>{generation++;button.disabled=copyButton.disabled=false;status.textContent='';fallback.hidden=true;};
 async function copy(){
  const token=generation;
  try{await navigator.clipboard.writeText(GAME_URL);if(token===generation)status.textContent='Link copied. Send it to your friends!';}
  catch{if(token!==generation)return;fallback.hidden=false;input.focus();input.select();status.textContent='Select and copy the link below.';}
 }
 copyButton.onclick=copy;
 input.onclick=()=>input.select();
 button.onclick=async()=>{
  if(!navigator.share){await copy();return;}
  const token=generation,s=getState(),text=s.safari?`I scored ${s.safari.score.toLocaleString()} points and bagged ${s.safari.kills} animals in Safari Run. Can you beat my 90-second run? Play Rex: Pursuit.`:s.result==='won'?`I escaped the T. rex in ${Math.floor(s.fightTime)} seconds and made it to the Visitor Center. Can you make it?`:'The T. rex caught my Jeep. Think you can escape? Play Rex: Pursuit.';
  button.disabled=true;
  try{await navigator.share({title:'Rex: Pursuit',text,url:GAME_URL});if(token===generation)status.textContent='Thanks for sharing the chase!';}
  catch(error){if(token===generation&&error.name!=='AbortError'){fallback.hidden=false;status.textContent='Sharing is unavailable here. Copy the game link below.';}}
  finally{if(token===generation)button.disabled=false;}
 };
 return {reset};
}
