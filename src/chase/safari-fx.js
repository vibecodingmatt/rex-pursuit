import * as T from 'three';
import {SPECIES} from './safari-rules.js';
// Screen-space Safari feedback anchored to the world: points rising from each kill
// (riding the road with the body), and one tag over the animal that matters most
// right now, the one just wounded or else the announced rare, with its remaining hits.
const RARITY={Common:'common',Uncommon:'uncommon',Rare:'rare',Legendary:'legendary'};
export function createSafariFx(root,camera){
 const v=new T.Vector3(),pops=[],MAX_POPS=8;
 const tag=document.createElement('div');tag.className='safari-tag';tag.hidden=true;
 const tagName=document.createElement('b'),tagInfo=document.createElement('small'),tagBar=document.createElement('span'),tagFill=document.createElement('i');
 tagBar.append(tagFill);tag.append(tagName,tagInfo,tagBar);root.append(tag);
 let focus=null,shown=null;
 /** Screen position of a world point, or null when it is behind the camera or well off screen. */
 function screen(p,out={}){v.copy(p).project(camera);if(v.z>1||Math.abs(v.x)>1.15||Math.abs(v.y)>1.15)return null;out.x=(v.x*.5+.5)*innerWidth;out.y=(-v.y*.5+.5)*innerHeight;return out;}
 const alive=c=>c?.on&&c.state!=='dead'&&c.state!=='hide'&&c.p;
 // Just above the animal: body centre height for runners, the wing line for flyers.
 const top=(c,out)=>out.set(c.p.x,c.p.y+(c.kind.centre!==undefined?c.kind.centre*c.scale*2.05+.35:c.kind.hitR*c.scale*1.6+.5),c.p.z);
 const at=new T.Vector3(),point={};
 return{
  /** Points rising from a kill at `p` (world). */
  pop(p,points,kind,multiplier=1){
   let e=pops.find(e=>!e.on);
   if(!e){if(pops.length>=MAX_POPS)e=pops.reduce((a,b)=>a.age>b.age?a:b);else{const el=document.createElement('div');el.className='safari-pop';const big=document.createElement('b'),small=document.createElement('small');el.append(big,small);root.append(el);e={el,big,small,p:new T.Vector3()};pops.push(e);}}
   // Kills close together on screen stack upward instead of printing over each other.
   const at=screen(p,{}),stack=at?pops.filter(o=>o!==e&&o.on&&o.age<.8&&Math.hypot(o.x-at.x,o.y-at.y)<90).length:0;
   const s=SPECIES[kind];e.on=true;e.age=0;e.stack=Math.min(3,stack);e.x=at?.x;e.y=at?.y;e.p.copy(p);e.big.textContent=`+${points.toLocaleString()}`;e.small.textContent=multiplier>1?`${s.name} · ×${multiplier}`:s.name;
   e.el.dataset.rarity=RARITY[s.rarity];e.el.style.opacity=0;e.el.hidden=false;
  },
  /** The animal just hit keeps the tag for a while. */
  focus(c,kind){if(alive(c)&&SPECIES[kind]?.hp>1)focus={c,kind,left:2.6};},
  update(dt,{speed=0,notice=null}={}){
   for(const e of pops){if(!e.on)continue;e.age+=dt;e.p.z+=speed*dt;
    const s=screen(e.p,point);if(!s||e.age>1.15){e.on=false;e.el.hidden=true;continue;}e.x=s.x;e.y=s.y;
    const rise=Math.min(1,e.age/.9),grow=e.age<.14?1.3-e.age/.14*.3:1,fade=e.age<.06?e.age/.06:1-Math.max(0,(e.age-.7)/.45);
    e.el.style.transform=`translate(${s.x}px,${s.y-18-e.stack*34-rise*(1-rise*.4)*70}px) translate(-50%,-50%) scale(${grow})`;e.el.style.opacity=fade;}
   if(focus){focus.left-=dt;if(focus.left<=0||!alive(focus.c))focus=null;}
   const pick=focus||(notice?.target&&alive(notice.target)?{c:notice.target,kind:notice.kind}:null);
   const s=pick&&screen(top(pick.c,at),point);
   if(!s){if(!tag.hidden){tag.hidden=true;shown=null;}return;}
   const sp=SPECIES[pick.kind];
   if(shown!==pick.c){shown=pick.c;tagName.textContent=sp.name.toUpperCase();tag.dataset.rarity=RARITY[sp.rarity];}
   tagInfo.textContent=`${sp.rarity.toUpperCase()} · ${sp.points.toLocaleString()} · ${pick.c.hp} HIT${pick.c.hp===1?'':'S'}`;
   tagFill.style.transform=`scaleX(${Math.max(0,pick.c.hp)/sp.hp})`;
   tag.hidden=false;tag.style.transform=`translate(${s.x}px,${s.y}px) translate(-50%,-100%)`;
  },
  reset(){focus=null;shown=null;tag.hidden=true;for(const e of pops){e.on=false;e.el.hidden=true;}},
 };
}
