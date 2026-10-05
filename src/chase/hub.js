import {MODES,MODE_IDS,previewFiles} from './modes.js';
import {readBoard} from './scoreboard.js';
import {readScores} from './safari-rules.js';
import {campaignProgress} from './campaign.js';
// The homepage hub: one rail of every experience, the selected mode's copy and options, and
// its preview. Live modes draw in the page's 3D scene; video modes cover it with a recorded
// loop, and while one does the scene stops rendering (see `covered`).
const $=s=>document.querySelector(s),abs=u=>new URL(u,document.baseURI).href;
const ARCADE_KEY='rex-pursuit-hub-arcade',FADE=420;
const today=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;};
function readArcade(){try{const v=JSON.parse(localStorage.getItem(ARCADE_KEY)||'{}');return{route:v.route==='classic'?'classic':'extended',difficulty:['tour','expert'].includes(v.difficulty)?v.difficulty:'arcade',run:['rush','daily'].includes(v.run)?v.run:'full'};}catch{return{route:'extended',difficulty:'arcade',run:'full'};}}
// Mirrors Lost Circuit's record keys (src/arcade/rules.js recordKey) so the hub shows the same best.
function arcadeBest(o){const route=o.run==='rush'?'bossrush':o.run==='daily'?`daily-${today()}`:o.route;try{const n=Number(localStorage.getItem(`rex-lost-circuit-v1:${route}:${o.difficulty}:one-credit`));return Number.isSafeInteger(n)&&n>0?n:0;}catch{return 0;}}
// Each tile's line under its name: a cleared chapter or the best fair score, else the mode's short description.
function lostCircuitBest(){let best=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^rex-lost-circuit-v1:(extended|classic|bossrush):[a-z]+:one-credit$/.test(k))best=Math.max(best,Number(localStorage.getItem(k))||0);}}catch{/* Storage denied. */}return best;}
function records(){
 const progress=campaignProgress(),score=n=>n>0?`BEST ${Math.round(n).toLocaleString('en-US')}`:'';
 return{pursuit:progress.ravine?'✓ CLEARED':'',ravine:progress.completed?'✓ CLEARED':score(readBoard('ravine-arcade')[0]?.score),safari:score(readScores().top[0]?.score),containment:score(readBoard('breach')[0]?.score),arcade:score(lostCircuitBest())};
}
export function createHub({reducedMotion=false,onSelect}={}){
 const layer=$('#hub-preview'),video=layer.querySelector('video'),rail=$('.mode-rail'),tiles=[...rail.querySelectorAll('[data-game-mode]')];
 const saveData=!!navigator.connection?.saveData,portrait=matchMedia('(orientation: portrait)');
 let selected='pursuit',covered=false,live=false,coverTimer=0,prefetched=new Set(),arcade=readArcade();
 // Thumbnails and posters are small; load them up front so a switch never shows an empty frame.
 for(const t of tiles){const f=previewFiles(t.dataset.gameMode);t.querySelector('.mode-thumb')?.style.setProperty('--thumb',`url("${abs(f.thumb)}")`);}
 function warmPosters(){for(const id of MODE_IDS)if(MODES[id].preview==='video'){const f=previewFiles(id);new Image().src=portrait.matches?f.posterTall:f.poster;}}
 function showVideo(id){
  const f=previewFiles(id),tall=portrait.matches,src=tall?f.tall:f.wide,poster=tall?f.posterTall:f.poster;
  clearTimeout(coverTimer);layer.dataset.mode=id;layer.classList.remove('still');layer.style.setProperty('--poster',`url("${abs(poster)}")`);
  if(!reducedMotion&&!saveData&&video.dataset.src!==src){video.dataset.src=src;video.poster=poster;video.src=src;video.load();}
  if(!reducedMotion&&!saveData)video.play().catch(()=>{});
  layer.classList.add('on');coverTimer=setTimeout(()=>{covered=true;},FADE);
 }
 // Until the page's own scene is ready, a live mode shows its still.
 function showStill(id){const f=previewFiles(id);clearTimeout(coverTimer);covered=false;video.pause();layer.dataset.mode=id;layer.style.setProperty('--poster',`url("${abs(portrait.matches?f.posterTall:f.poster)}")`);layer.classList.add('on','still');}
 function hideVideo(){clearTimeout(coverTimer);covered=false;layer.classList.remove('on');coverTimer=setTimeout(()=>{if(!layer.classList.contains('on'))video.pause();},FADE);}
 // Warm the next page's code while the player reads the card (production builds list every chunk in the HTML).
 async function prefetch(id){
  const href=MODES[id].href;if(!href||prefetched.has(id))return;prefetched.add(id);
  try{const page=new URL(href,location.href),html=await (await fetch(page.pathname,{credentials:'same-origin'})).text(),doc=new DOMParser().parseFromString(html,'text/html');
   for(const el of doc.querySelectorAll('script[type=module][src],link[rel=modulepreload][href],link[rel=stylesheet][href]')){const url=new URL(el.getAttribute('src')||el.getAttribute('href'),page).href;if(url.startsWith(location.origin)&&!document.querySelector(`link[rel=prefetch][href="${url}"]`))document.head.append(Object.assign(document.createElement('link'),{rel:'prefetch',href:url,as:el.tagName==='LINK'&&el.rel==='stylesheet'?'style':'script'}));}
  }catch{prefetched.delete(id);}
 }
 function describe(id){
  const m=MODES[id];$('#start-screen .mode-card>.eyebrow').innerHTML='<span></span> '+m.eyebrow;$('#start-screen h1').innerHTML=m.title;$('#start-screen .mode-copy').innerHTML=m.copy;
  $('#start-screen .start-tip span.mouse-copy').textContent=m.tip;$('#start-screen .start-tip span.touch-copy').innerHTML=m.touch;
  for(const el of document.querySelectorAll('[data-for-modes]'))el.hidden=!el.dataset.forModes.split(' ').includes(id);
  // Restart the copy's entrance so each switch reads as a new card.
  const copy=$('#start-screen .mode-card');copy.classList.remove('swap');void copy.offsetWidth;copy.classList.add('swap');
 }
 function updateRecords(){const r=records();for(const t of tiles){const id=t.dataset.gameMode,line=t.querySelector('.mode-label em');line.textContent=r[id]||MODES[id].short;line.classList.toggle('record',!!r[id]);}}
 updateRecords();
 function select(id,{focus=false}={}){
  id=MODES[id]?id:'pursuit';const changed=id!==selected;selected=id;document.body.dataset.game=id;
  for(const t of tiles){const on=t.dataset.gameMode===id;t.setAttribute('aria-pressed',String(on));t.tabIndex=on?0:-1;if(on&&focus)t.focus();if(on)t.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:changed&&!reducedMotion?'smooth':'auto'});}
  describe(id);updateArcade();updateRecords();
  if(MODES[id].preview==='video')showVideo(id);else if(!live)showStill(id);else hideVideo();
  if(MODES[id].href)setTimeout(()=>{if(selected===id)prefetch(id);},500);
  return id;
 }
 portrait.addEventListener?.('change',()=>{if(MODES[selected].preview==='video')showVideo(selected);else if(!live)showStill(selected);warmPosters();});
 for(const t of tiles)t.addEventListener('click',()=>onSelect(t.dataset.gameMode));
 // Arrow keys move along the rail (one tab stop for the whole group).
 rail.addEventListener('keydown',e=>{const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(e.key==='Home'||e.key==='End'||step){e.preventDefault();const i=tiles.findIndex(t=>t.dataset.gameMode===selected),n=e.key==='Home'?0:e.key==='End'?tiles.length-1:(i+step+tiles.length)%tiles.length;onSelect(tiles[n].dataset.gameMode,{focus:true});}});
 // Gamepads on the hub (Lost Circuit plays with them): D-pad or left stick moves along the rail, A starts.
 // Polled only while a pad is connected and the menu is showing.
 let padLoop=0,padHeld={},padRepeat=0;
 function pollPad(now){
  padLoop=0;const pad=[...(navigator.getGamepads?.()||[])].find(p=>p?.connected);if(!pad)return;padLoop=requestAnimationFrame(pollPad);
  if(!['menu','loading'].includes(document.body.dataset.state)||document.querySelector('dialog[open]'))return;
  const x=pad.axes[0]||0,dir=pad.buttons[15]?.pressed||x>.6?1:pad.buttons[14]?.pressed||x<-.6?-1:0,a=!!pad.buttons[0]?.pressed;
  if(dir&&(padHeld.dir!==dir||now>padRepeat)){const i=tiles.findIndex(t=>t.dataset.gameMode===selected);onSelect(tiles[(i+dir+tiles.length)%tiles.length].dataset.gameMode,{focus:true});padRepeat=now+(padHeld.dir===dir?180:420);}
  if(a&&!padHeld.a&&!$('#start').disabled)$('#start').click();
  padHeld={dir,a};
 }
 addEventListener('gamepadconnected',()=>{if(!padLoop)padLoop=requestAnimationFrame(pollPad);});
 if([...(navigator.getGamepads?.()||[])].some(p=>p?.connected))padLoop=requestAnimationFrame(pollPad);
 // Lost Circuit's ride options, carried to its page as URL parameters.
 function updateArcade(){
  for(const b of document.querySelectorAll('[data-arcade]')){const [key,value]=b.dataset.arcade.split(':');b.setAttribute('aria-pressed',String(arcade[key]===value));}
  $('#arcade-route').classList.toggle('locked',arcade.run!=='full');const best=arcadeBest(arcade);$('#arcade-best').textContent=best?`BEST ${best.toLocaleString('en-US')}`:'NO RECORD YET';
  try{localStorage.setItem(ARCADE_KEY,JSON.stringify(arcade));}catch{/* Storage denied: the choice lasts this visit. */}
 }
 for(const b of document.querySelectorAll('[data-arcade]'))b.addEventListener('click',()=>{const [key,value]=b.dataset.arcade.split(':');arcade[key]=value;if(key==='route')arcade.run='full';updateArcade();});
 function launchURL(id){
  const url=new URL(MODES[id].href,location.href);
  if(id==='arcade'){if(arcade.run==='full')url.searchParams.set('route',arcade.route);if(arcade.run!=='full')url.searchParams.set(arcade.run,'1');url.searchParams.set('difficulty',arcade.difficulty);}
  return url.href;
 }
 // A short fade to black, then the game's own page. The hub's own history entry first records the
 // mode, so Back (or the game's own exit) returns to this card.
 function launch(id){const here=new URL(location.href);here.searchParams.set('mode',id);history.replaceState(history.state,'',here);document.body.classList.add('leaving');setTimeout(()=>location.assign(launchURL(id)),reducedMotion?0:260);}
 addEventListener('pageshow',e=>{if(!e.persisted)return;document.body.classList.remove('leaving');if(MODES[selected].preview==='video'&&!reducedMotion&&!saveData)video.play().catch(()=>{});});
 return{select,launch,launchURL,warmPosters,setLive(){live=true;},get selected(){return selected;},get covered(){return covered;},isLive:id=>MODES[id].preview==='live',isExternal:id=>!!MODES[id].href};
}
