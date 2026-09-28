const CODES={idkfa:'infiniteAmmo',idspispopd:'infiniteRockets'};
// Toggle each effect independently. Using either taints the entire run even
// after both effects are disabled, including points earned before activation.
export function activateCheat(round,code){
 const flag=Object.hasOwn(CODES,code)&&CODES[code];if(!flag||round.result)return false;
 round[flag]=!round[flag];round.cheated=true;
 if(round.infiniteAmmo&&code==='idkfa'){round.ammo=80;round.reload=0;round.heat=0;round.overheated=false;}
 if(round.infiniteRockets&&code==='idspispopd')round.grenade=0;
 if(round.safari)round.safari.cheated=true;
 return true;
}
export function createCheatInput({isPlaying,activate,clock=()=>performance.now()}){
 let buffer='',last=0;const codes=Object.keys(CODES);
 return {reset(){buffer='';last=0;},key(event){
  if(event.ctrlKey||event.metaKey||event.altKey||event.isComposing||event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')){buffer='';return false;}
  if(event.repeat)return false;
  const now=clock(),key=event.key.toLowerCase();if(now-last>2500)buffer='';last=now;
  buffer+=key;while(buffer&&!codes.some(code=>code.startsWith(buffer)))buffer=buffer.slice(1);
  // Consume code letters even while paused so IDSPISPOPD's P characters do
  // not resume the game. Lifecycle reset prevents carrying a partial code in.
  if(codes.includes(buffer)){const code=buffer;buffer='';if(isPlaying())activate(code);return true;}
  return buffer.length>0;
 }};
}
export function createCheatBadge(){
 const badge=document.createElement('div');badge.id='cheat-status';badge.setAttribute('role','status');badge.hidden=true;document.body.append(badge);
 return {update(round){badge.hidden=!round?.cheated;const active=Object.keys(CODES).filter(code=>round?.[CODES[code]]).map(code=>code.toUpperCase());badge.textContent=round?.cheated?`${active.join(' + ')||'CODES OFF'} · CHEAT RUN`:'';}};
}
