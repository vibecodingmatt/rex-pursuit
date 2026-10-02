import {rankFor} from './arcade.js';
export function createArcadeUI(camera,{reduced=false}={}){
 const $=id=>document.getElementById(id),labels=Array.from({length:6},()=>{const el=document.createElement('div');el.className='score-pop';el.hidden=true;$('arcade-feedback').append(el);return{el,life:0,p:null};});
 let cursor=0,bannerTime=0,displayScore=0,lastScore=-1;
 const cache=new Map();function text(id,value){if(cache.get(id)===value)return;cache.set(id,value);$(id).textContent=value;}
 function style(id,property,value){const key=id+property;if(cache.get(key)===value)return;cache.set(key,value);$(id).style[property]=value;}
 function banner(title,copy,seconds=2.4){$('setpiece-title').textContent=title;$('setpiece-copy').textContent=copy;bannerTime=seconds;$('setpiece-banner').style.opacity='1';}
 function award(e,p){if(!p)return;const slot=labels[cursor++%labels.length];slot.p=p.clone();slot.life=1.25;slot.el.textContent=`${e.label} +${e.points.toLocaleString()}`;slot.el.dataset.multi=e.multiplier>1?'yes':'no';}
 function update(dt,round,speed){
  const a=round.arcade;displayScore=reduced?a.score:displayScore+(a.score-displayScore)*(1-Math.exp(-dt*14));const score=Math.round(displayScore);if(score!==lastScore){$('score-value').textContent=String(score).padStart(6,'0');lastScore=score;}
  text('combo-value',`×${a.multiplier}`);text('chain-label',a.chain>1?`${a.chain} CHAIN`:'BUILD YOUR CHAIN');style('chain-fill','transform',`scaleX(${(a.chainTime/5.5).toFixed(3)})`);const hot=a.multiplier>=3?'yes':'no';if($('arcade-score').dataset.hot!==hot)$('arcade-score').dataset.hot=hot;
  const disabled=a.charge<100&&a.turbo<=0,ready=a.charge>=100?'yes':'no',active=a.turbo>0?'yes':'no';if($('turbo').disabled!==disabled)$('turbo').disabled=disabled;if($('turbo').dataset.ready!==ready)$('turbo').dataset.ready=ready;if($('turbo').dataset.active!==active)$('turbo').dataset.active=active;
  style('turbo-fill','transform',`scaleX(${(a.turbo>0?a.turbo/6:a.charge/100).toFixed(3)})`);text('turbo-title',a.turbo>0?`TURBO ${a.turbo.toFixed(1)}s`:a.charge>=100?'UNLEASH TURBO':'EARN TURBO');text('turbo-copy',a.turbo>0?'RAPID FIRE · NO HEAT':a.charge>=100?'E / TAP TO ACTIVATE':`${Math.floor(a.charge)}% · KILLS CHARGE IT`);
  style('turbo-vision','opacity',a.turbo>0?'.8':'0');
  bannerTime=Math.max(0,bannerTime-dt);$('setpiece-banner').style.opacity=bannerTime>0?'1':'0';
  for(const l of labels){l.life=Math.max(0,l.life-dt);l.el.hidden=!l.life;if(!l.life)continue;l.p.z+=speed*dt;l.p.y+=dt*(reduced?0:.7);const p=l.p.clone().project(camera);l.el.hidden=p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;l.el.style.left=`${(p.x*.5+.5)*innerWidth}px`;l.el.style.top=`${(.5-p.y*.5)*innerHeight}px`;l.el.style.opacity=Math.min(1,l.life*3);}
 }
 return{banner,award,update,reset(){bannerTime=displayScore=cursor=0;lastScore=-1;for(const l of labels){l.life=0;l.el.hidden=true;}},result(round){const score=round.arcade.total(round.result==='won',round.jeep);return{score,rank:rankFor(score)};}};
}
