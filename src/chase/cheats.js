// A cheat taints the whole run, including points earned before activation.
export function activateCheat(round,code){
 if(code!=='idkfa'||round.result||round.infiniteAmmo)return false;
 round.cheated=round.infiniteAmmo=true;round.ammo=80;round.reload=0;round.heat=0;round.overheated=false;
 if(round.safari)round.safari.cheated=true;
 return true;
}
export function createCheatInput({isPlaying,activate,clock=()=>performance.now()}){
 let buffer='',last=0;const code='idkfa';
 return {reset(){buffer='';last=0;},key(event){
  if(!isPlaying()||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])')){buffer='';return false;}
  if(event.repeat)return false;
  const now=clock(),key=event.key.toLowerCase();if(now-last>2500)buffer='';last=now;
  buffer+=key;while(buffer&&!code.startsWith(buffer))buffer=buffer.slice(1);
  if(buffer===code){buffer='';activate(code);return true;}
  return buffer.length>0;
 }};
}
export function createCheatBadge(){
 const badge=document.createElement('div');badge.id='cheat-status';badge.setAttribute('role','status');badge.hidden=true;document.body.append(badge);
 return {update(active){badge.hidden=!active;badge.textContent=active?'IDKFA · INFINITE AMMO · CHEAT RUN':'';}};
}
