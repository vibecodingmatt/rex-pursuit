// Keep aim and fire contacts independent: lifting one thumb must not release
// the other. All positions are CSS pixels, shared by the reticle and raycast.
export function touchAimOffset(width,height){return height<width?72:96;}
export function aimPoint(x,y,width,height,touch=false){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),offset=touch?touchAimOffset(width,height):0;
 const point={x:clamp(x,width*.025,width*.975),y:clamp(y-offset,height*.075,height*.925)};
 // At the top edge there is no room above the finger: slide beside it instead
 // of clamping the crosshair back underneath the thumb.
 const clearance=offset*.75,dy=point.y-y;
 if(touch&&Math.abs(dy)<clearance){const dx=Math.sqrt(clearance*clearance-dy*dy);point.x=clamp(x+(x<width/2?dx:-dx),width*.025,width*.975);}
 return point;
}
export function createPointerControls({canvas,fireButton,isPlaying,onAim,onFire,onGrenade,onContact}){
 let aimId=null;const firing=new Set(),captures=new Map();
 const sync=()=>{onFire(firing.size>0);fireButton.classList.toggle('pressed',firing.size>0);};
 const capture=(e,element)=>{if(e.isTrusted)element.setPointerCapture(e.pointerId);captures.set(e.pointerId,element);};
 const aim=e=>{
  const touch=e.pointerType==='touch',point=aimPoint(e.clientX,e.clientY,innerWidth,innerHeight,touch);
  onAim(point);if(touch)onContact({x:e.clientX,y:e.clientY,aim:point});
 };
 const release=e=>{
  firing.delete(e.pointerId);sync();captures.delete(e.pointerId);
  if(e.pointerId===aimId){aimId=null;onContact(null);}
 };
 canvas.addEventListener('pointerdown',e=>{
  if(!isPlaying())return;e.preventDefault();
  if(e.pointerType==='touch'){if(aimId!==null)return;aimId=e.pointerId;}
  else if(e.pointerType==='mouse'&&e.button!==0&&e.button!==2)return;
  aim(e);
  if(e.pointerType==='mouse'&&e.button===2){onGrenade();return;}
  if(e.pointerType==='mouse'){firing.add(e.pointerId);sync();}
  capture(e,canvas);
 });
 canvas.addEventListener('pointermove',e=>{
  if(!isPlaying()||(e.pointerType==='touch'?e.pointerId!==aimId:aimId!==null))return;
  if(e.pointerType==='touch')e.preventDefault();aim(e);
 });
 fireButton.addEventListener('pointerdown',e=>{
  if(!isPlaying()||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();firing.add(e.pointerId);sync();capture(e,fireButton);
 });
 for(const name of ['pointerup','pointercancel'])window.addEventListener(name,release);
 for(const element of [canvas,fireButton])element.addEventListener('lostpointercapture',release);
 // iOS callouts and desktop selection gestures are never game input.
 for(const name of ['contextmenu','selectstart','dragstart'])document.addEventListener(name,e=>{
  if(e.target.closest?.('#scene,#touch-controls,#hud-bottom,.masthead button'))e.preventDefault();
 });
 return{reset(){
  const held=[...captures];captures.clear();aimId=null;firing.clear();sync();onContact(null);
  for(const [id,element]of held)if(element.hasPointerCapture(id))element.releasePointerCapture(id);
 }};
}
