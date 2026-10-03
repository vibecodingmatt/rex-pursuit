import {TYPES,project} from './rules.js';
import {drawPuppet} from './puppet.js';
// Individual cell padding avoids the generated atlas's occasional boundary overlap.
const CUTS=[[0,0,.247,.471],[.249,0,.249,.482],[.507,0,.233,.48],[.738,0,.262,.445],[0,.489,.25,.511],[.252,.493,.249,.507],[.498,.478,.26,.522],[.754,.485,.246,.515]];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
export class RideRenderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.images={};this.particles=[];this.labels=[];this.tracers=[];this.shake=0;this.flash=0;this.recoil=0;this.hitMark=0;this.age=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.resize();}
 async load(onProgress){let n=0;await Promise.all(['worlds','predators','wildlife','landmarks','launcher'].map(async key=>{const im=new Image();im.src=new URL(`./arcade/${key}.png`,document.baseURI).href;await im.decode();this.images[key]=im;onProgress(++n/5);}));}
 resize(){this.w=innerWidth;this.h=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.6);this.canvas.width=Math.round(this.w*dpr);this.canvas.height=Math.round(this.h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 reset(){this.particles=[];this.labels=[];this.tracers=[];this.shake=0;this.flash=0;this.recoil=0;this.hitMark=0;}
 burst(x,y,color,count=20,power=1){for(let i=0;i<count;i++){const a=hash(i+this.age*71)*Math.PI*2,v=(50+hash(i*9+this.age)*180)*power;this.particles.push({x:x*this.w,y:y*this.h,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.35+hash(i*3)*.6,max:1,color,size:1+hash(i*11)*4});}if(this.particles.length>200)this.particles.splice(0,this.particles.length-200);}
 event(e){
  if(e.type==='shot'){this.recoil=1;this.tracers.push({x:e.x*this.w,y:e.y*this.h,life:.085,hit:e.hit});if(e.hit){this.hitMark=.11;this.burst(e.x,e.y,e.precise?'#ffe0a0':'#b8e1d0',7,.4);}}
  if(e.type==='kill'){this.burst(e.x,e.y,e.boss?'#f5cf88':'#d4af6f',e.boss?50:20,1);this.labels.push({x:e.x*this.w,y:e.y*this.h,text:`${e.precise?'PRECISION ':''}+${e.points.toLocaleString()}`,life:1.1,color:'#ffe0a0'});if(e.boss)this.shake=.5;}
  if(e.type==='damage'||e.type==='attack'){this.shake=.7;this.flash=.5;}
  if(e.type==='blast'){this.shake=.7;this.burst(e.x,e.y,'#ffbb69',65,2);}
  if(e.type==='stagger'){this.shake=.3;this.labels.push({x:e.x*this.w,y:e.y*this.h,text:'ATTACK BROKEN',life:1.3,color:'#9ff8e0'});}
  if(e.type==='supply'){this.burst(e.x,e.y,'#a8ffcb');this.labels.push({x:e.x*this.w,y:e.y*this.h,text:'REPAIR +22',life:1.2,color:'#a8ffcb'});}
  if(e.type==='bridge')this.shake=1.2;
 }
 update(dt){this.age+=dt;this.shake=Math.max(0,this.shake-dt);this.flash=Math.max(0,this.flash-dt);this.recoil=Math.max(0,this.recoil-dt*9);this.hitMark=Math.max(0,this.hitMark-dt);
  for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=150*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);
  for(const p of this.labels){p.y-=dt*35;p.life-=dt;}this.labels=this.labels.filter(p=>p.life>0);
  for(const p of this.tracers)p.life-=dt;this.tracers=this.tracers.filter(p=>p.life>0);
 }
 background(index,time,aim,game){
  const c=this.ctx,w=this.w,h=this.h,im=this.images[index>=4?'landmarks':'worlds'];if(!im){c.fillStyle='#101c17';c.fillRect(0,0,w,h);return;}index%=4;
  const cw=im.width/2,ch=im.height/2,sx=(index%2)*cw,sy=Math.floor(index/2)*ch;
  const move=this.reduced?0:1,travel=game?clamp(game.stageTime/game.stage.duration,0,1)*.34*move:0,scale=Math.max(w/cw,h/ch)*(1.065+travel),iw=cw*scale,ih=ch*scale;
  const ox=(w-iw)/2+(aim.x-.5)*-15*move+Math.sin(time*.15)*w*.012*move;
  const drop=game?.stage.id==='fault'&&game.stageTime>19&&game.stageTime<23?Math.sin((game.stageTime-19)/4*Math.PI)*h*.09*move:0;
  const oy=(h-ih)/2+Math.sin(time*6.3)*1.8*move+drop+(this.shake?Math.sin(time*70)*this.shake*8*move:0);
  c.drawImage(im,sx,sy,cw,ch,ox,oy,iw,ih);
  // Ground-level mist, dust, rain and embers create moving layers across the depth field.
  c.save();
  for(let i=0;i<55;i++){
   const z=(hash(i*3)+time*(index===1?.07:.04))%1,p=z*z;
   const x=w*(.5+(hash(i*11)-.5)*(p*2.2+.2)),y=h*(.4+p*.65);
   c.globalAlpha=(1-z)*.24;
   if(index===1){c.fillStyle='#ffc478';c.beginPath();c.ellipse(x,h-y+h*.4,1+p*2,2+p*4,.4,0,7);c.fill();}
   else if(index>1){c.strokeStyle='#c5e5e5';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y+8+p*18);c.stroke();}
   else{c.fillStyle='#e5d6a7';c.beginPath();c.arc(x,y,1+p*2,0,7);c.fill();}
  }c.restore();
  // Near-camera vegetation passes independently of the distant scenery.
  if(index<2)for(let i=0;i<12;i++){
   const p=(i/12+time*.06)%1,side=i%2?1:-1,x=w*.5+side*w*(.32+p*p*.44),y=h*(.5+p*p*.57);
   c.save();c.translate(x,y);c.scale(side,1);c.globalAlpha=clamp(p*2,0,1);c.strokeStyle=index===1?'#352a19':'#182b1a';c.fillStyle=index===1?'#3d3620':'#24412b';
   const s=15+p*p*160;c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-s*.5,-s*.9,-s,-s);c.stroke();
   for(let j=1;j<8;j++){const q=j/8,l=s*.25*Math.sin(q*Math.PI);c.beginPath();c.moveTo(-s*q,-s*q);c.quadraticCurveTo(-s*q-l,-s*q-l*.1,-s*q-l*.5,-s*q-l);c.quadraticCurveTo(-s*q,-s*q-l*.6,-s*q,-s*q);c.fill();}c.restore();
  }
 }
 sprite(kind,x,y,size,{flip=false,alpha=1,age=0,hit=false,fall=0,menu=false}={}){
  const c=this.ctx,def=TYPES[kind],im=this.images[def?.atlas||'predators'];if(!im||def?.cell===undefined)return;
  const cols=def.atlas?2:4,cut=def.atlas?[def.cell%cols/cols,Math.floor(def.cell/cols)/2,1/cols,.5]:CUTS[def.cell];
  const [sx,sy,cw,ch]=[cut[0]*im.width,cut[1]*im.height,cut[2]*im.width,cut[3]*im.height];
  c.save();c.translate(x,y);c.scale(flip?-1:1,1);c.globalAlpha=alpha;
  const rotate=fall?fall*.65:Math.sin(age*5)*.012;c.rotate(rotate);
  if(hit)c.filter='brightness(1.75) saturate(.7)';
  // Larger foreground animals use an articulated image mesh; distant wildlife
  // uses the cheaper strip deformation. Neither path allocates a texture per frame.
  if(!def.atlas&&size>this.h*.27&&!menu){drawPuppet(c,im,[sx,sy,cw,ch],size,kind,age,this.reduced);c.restore();return;}
  const bands=menu?28:20;
  for(let i=0;i<bands;i++){
   const p=i/bands,dx=(kind==='ptero'?Math.sin(age*10+p*5)*size*.021:Math.sin(age*4+p*4)*size*.008)*(this.reduced?.2:1);
   const stretch=1+Math.sin(age*3+p*4)*.008;
   c.drawImage(im,sx,sy+p*ch,cw,ch/bands,-size*.5+dx,-size*.5+p*size,size*stretch,size/bands+.9);
  }c.restore();
 }
 setpiece(game,time){
  if(!game)return;const c=this.ctx,w=this.w,h=this.h,t=game.stageTime,kind=game.stage.setpiece;
  if(kind==='brachio'&&t>7&&t<26){
   const p=(t-7)/19,sz=h*(.8+Math.sin(p*Math.PI)*.5),x=w*(1.3-p*1.55);
   this.sprite('brachio',x,h*.44,sz,{age:time*.3});
   if(p>.25&&p<.65){c.save();c.globalAlpha=.18;const glow=c.createLinearGradient(0,0,w,h);glow.addColorStop(0,'#ffc474');glow.addColorStop(1,'transparent');c.fillStyle=glow;c.fillRect(0,0,w,h);c.restore();}
  }
  if(kind==='stampede'&&t>9&&t<19)for(let i=0;i<6;i++){const p=((t-9)*.22+i*.18)%1;this.sprite('galli',w*(1.2-p*1.4),h*(.49+i*.009),h*(.17+i*.009),{flip:true,age:time+i});}
  if(kind==='bridge'&&t>10&&t<24){
   const collapse=clamp((t-19)/4,0,1),hy=h*.46;c.save();c.globalAlpha=1-collapse*.8;
   const boards=Array.from({length:22},(_,i)=>({i,p:(i/22+time*.13)%1})).sort((a,b)=>a.p-b.p);
   for(const {i,p}of boards){const z=p*p,y=hy+z*h*.63+collapse*z*180,half=z*w*.48,depth=2+p*18;
    c.save();c.translate(w*.5,y);c.rotate(Math.sin(i*4)*collapse*.45);const wood=c.createLinearGradient(0,-depth,0,depth);wood.addColorStop(0,'#91764c');wood.addColorStop(.18,'#695439');wood.addColorStop(.85,'#453e2e');wood.addColorStop(1,'#242c23');c.fillStyle=wood;
    c.beginPath();c.moveTo(-half+depth,-depth);c.lineTo(half-depth,-depth);c.lineTo(half,depth);c.lineTo(-half,depth);c.closePath();c.fill();
    c.strokeStyle='#201b1680';c.lineWidth=Math.max(.5,p);for(let j=0;j<5;j++){c.beginPath();c.moveTo(-half+depth,-depth+j*depth*.4);c.bezierCurveTo(-half*.3,-depth+j*depth*.4+2,half*.4,-depth+j*depth*.4-2,half-depth,-depth+j*depth*.4);c.stroke();}
    c.fillStyle='#cab38680';for(const side of [-1,1]){c.beginPath();c.arc(side*half*.85,0,Math.max(.5,p*2),0,7);c.fill();}c.restore();
   }
   for(const side of [-1,1]){
    c.strokeStyle='#2d2a1b';c.lineWidth=7;c.beginPath();c.moveTo(w*.5,hy-10);c.quadraticCurveTo(w*(.5+side*.2),h*.5,w*(.5+side*.6),h*.86+collapse*250);c.stroke();c.strokeStyle='#a49067';c.lineWidth=2;c.stroke();
    for(let j=1;j<10;j++){const p=(j/10+time*.13)%1,z=p*p,x=w*(.5+side*z*.48),y=hy+z*h*.63;c.strokeStyle='#5d4d34';c.lineWidth=1+p*6;c.beginPath();c.moveTo(x,y+collapse*z*180);c.lineTo(x,y-p*h*.13+collapse*z*120);c.stroke();}
   }c.restore();
  }
  if(kind==='water'||kind==='brachio'){
   c.save();const g=c.createLinearGradient(0,h*.6,0,h);g.addColorStop(0,'#398d9900');g.addColorStop(.3,'#24677124');g.addColorStop(1,'#032a37c0');c.fillStyle=g;c.fillRect(0,h*.6,w,h*.4);
   for(let i=0;i<22;i++){const p=(i/22+time*.19)%1;c.globalAlpha=p*.4;c.strokeStyle='#a9edec';c.lineWidth=1+p*2;c.beginPath();c.ellipse(w*.5,h*(.65+p*.4),w*(.05+p*.6),h*.009,0,0,Math.PI*2);c.stroke();}c.restore();
  }
 }
 prop(e,p,time){
  const c=this.ctx,x=p.x*this.w,y=p.y*this.h,s=p.h*this.h;c.save();c.translate(x,y);c.globalAlpha=e.alpha;
  if(e.kind==='rock'){
   c.rotate(e.age*.6);const g=c.createLinearGradient(-s/2,-s/2,s/2,s/2);g.addColorStop(0,'#b8a58a');g.addColorStop(.5,'#615849');g.addColorStop(1,'#262b26');c.fillStyle=g;c.strokeStyle='#d3b583';c.lineWidth=1;c.beginPath();
   for(let i=0;i<9;i++){const a=i/9*7,r=s*(.36+hash(i+e.seed)*.16);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();
   c.strokeStyle='#d5c3a440';for(let i=0;i<5;i++){c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(i*2)*s*.38,Math.sin(i*2)*s*.4);c.stroke();}
  }else if(e.kind==='spit'){const g=c.createRadialGradient(0,0,0,0,0,s*.7);g.addColorStop(0,'#dfff8e');g.addColorStop(.4,'#73a44b');g.addColorStop(1,'#57853200');c.fillStyle=g;c.fillRect(-s,-s,s*2,s*2);}
  else{
   const supply=e.kind==='supply',color=supply?'#aaf9d2':'#ffad72';c.rotate(Math.sin(time*2)*.07);c.shadowColor=color;c.shadowBlur=15;c.fillStyle=supply?'#204b43':'#613b26';c.strokeStyle=color;c.lineWidth=2;c.fillRect(-s*.36,-s*.4,s*.72,s*.8);c.strokeRect(-s*.36,-s*.4,s*.72,s*.8);c.shadowBlur=0;
   c.fillStyle=color;if(supply){c.fillRect(-s*.06,-s*.22,s*.12,s*.44);c.fillRect(-s*.22,-s*.06,s*.44,s*.12);}else{c.beginPath();c.moveTo(0,-s*.25);c.lineTo(s*.2,s*.15);c.lineTo(-s*.2,s*.15);c.closePath();c.fill();}
  }c.restore();
 }
 entity(e,time,game){
  if(e.age<0)return;const c=this.ctx,w=this.w,h=this.h,p=project(e,w/h),size=p.h*h;
  if(!['ptero','ichthy','mosa','spit'].includes(e.kind)){
   c.save();c.globalAlpha=e.alpha*.45;c.fillStyle='#030905';c.beginPath();c.ellipse(p.x*w,(p.y+p.h*.43)*h,size*.39,size*.045,0,0,7);c.fill();c.restore();
  }
  if(TYPES[e.kind].cell!==undefined)this.sprite(e.kind,p.x*w,p.y*h,size,{age:e.age,alpha:e.alpha,hit:e.hit>0,fall:e.dead?e.fade:0});else this.prop(e,p,time);
  if(e.dead)return;
  if(e.boss&&e.weak){
   const x=p.hx*w,y=p.hy*h,r=Math.max(21,size*.115),danger=e.attack>0;
   c.save();c.strokeStyle=danger?'#ff895e':'#ffd68b';c.lineWidth=2;c.shadowColor=c.strokeStyle;c.shadowBlur=9;c.setLineDash([6,5]);c.beginPath();c.arc(x,y,r,0,7);c.stroke();c.setLineDash([]);c.shadowBlur=0;
   c.lineWidth=4;c.beginPath();c.arc(x,y,r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-e.attack));c.stroke();c.fillStyle='#fff1d1';c.font='bold 8px Arial';c.textAlign='center';c.fillText(danger?'STOP THE ATTACK':'WEAK POINT',x,y-r-14);c.restore();
  }else if(!e.boss&&e.age/e.life>.67&&!['supply','barrel','galli'].includes(e.kind)){
   c.save();c.strokeStyle='#ffb777';c.globalAlpha=.7;c.lineWidth=2;c.beginPath();c.arc(p.x*w,(p.y-p.h*.48)*h,12,-Math.PI/2,-Math.PI/2+7*(1-e.age/e.life));c.stroke();c.restore();
  }
 }
 cockpit(aim,time,active){
  const c=this.ctx,w=this.w,h=this.h;
  c.save();const dash=c.createLinearGradient(0,h*.93,0,h);dash.addColorStop(0,'#26302a');dash.addColorStop(1,'#050908');c.fillStyle=dash;c.beginPath();c.moveTo(0,h);c.lineTo(0,h*.93);c.quadraticCurveTo(w*.5,h*.98,w,h*.93);c.lineTo(w,h);c.fill();c.strokeStyle='#c1ae7133';c.lineWidth=2;c.stroke();
  if(!active){c.restore();return;}
  const scale=Math.min(w/1250,h/800),gx=w*(.52+(aim.x-.5)*.07),gy=h+this.recoil*10; c.translate(gx,gy);c.scale(scale,scale);c.rotate((aim.x-.5)*.12);
  if(this.images.launcher){
   c.drawImage(this.images.launcher,-160,-267,320,320);
   if(this.recoil>.5){c.globalCompositeOperation='screen';const glow=c.createRadialGradient(0,-252,0,0,-252,55);glow.addColorStop(0,'#fffbd7');glow.addColorStop(.2,'#f8d290a0');glow.addColorStop(1,'#efb55500');c.fillStyle=glow;c.fillRect(-55,-307,110,110);}c.restore();return;
  }
  const gun=c.createLinearGradient(-75,0,65,0);gun.addColorStop(0,'#111b1d');gun.addColorStop(.42,'#647776');gun.addColorStop(.5,'#243d3e');gun.addColorStop(.85,'#142428');gun.addColorStop(1,'#426062');
  c.fillStyle=gun;c.strokeStyle='#7d8f81';c.lineWidth=1;c.beginPath();c.moveTo(-85,0);c.lineTo(-57,-83);c.lineTo(-19,-191);c.lineTo(19,-191);c.lineTo(58,-83);c.lineTo(86,0);c.closePath();c.fill();c.stroke();
  c.fillStyle='#111e20';for(let i=0;i<7;i++){c.fillRect(-22-i*3,-166+i*13,44+i*6,5);}c.fillStyle='#6c806f';c.fillRect(-11,-208,22,46);c.fillStyle='#142123';c.fillRect(-7,-202,14,30);c.fillStyle='#d7a253';c.fillRect(-35,-35,70,8);c.fillStyle='#73cdb6';c.fillRect(-9,-80,18,6);
  if(this.recoil>.5){c.globalCompositeOperation='screen';const g=c.createRadialGradient(0,-217,0,0,-217,70);g.addColorStop(0,'#ffffcf');g.addColorStop(.25,'#ffc969c9');g.addColorStop(1,'#f1b53c00');c.fillStyle=g;c.fillRect(-70,-287,140,140);}c.restore();
 }
 render(game,aim,{menu=false,time=0}={}){
  const c=this.ctx,w=this.w,h=this.h;let index=menu?0:game?.stage.bg||0;c.clearRect(0,0,w,h);
  if(game?.stage.id==='fault'&&game.stageTime<10)index=5;
  if(game?.stage.id==='hybrid'&&game.stageTime<12)index=7;
  this.background(index,time,aim,menu?null:game);
  if(menu){const portrait=w<h;this.sprite('rex',w*(portrait?.72:.73),h*(portrait?.29:.47),Math.min(h*.89,w*(portrait?1:.72)),{age:time*.3,menu:true});}
  else{
   this.setpiece(game,time);
   for(const e of [...game.entities].sort((a,b)=>a.size-b.size))this.entity(e,time,game);
   if((game.stage.id==='gates'&&game.stageTime>20&&game.stageTime<29)||(game.stage.id==='manor')){
    c.save();const rad=Math.max(w,h)*.62,g=c.createRadialGradient(aim.x*w,aim.y*h,70,aim.x*w,aim.y*h,rad);g.addColorStop(0,'#01080800');g.addColorStop(.3,'#01080820');g.addColorStop(1,'#010808dc');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore();
   }
   for(const p of this.particles){c.globalAlpha=clamp(p.life*2,0,1);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size);}c.globalAlpha=1;
   for(const p of this.tracers){c.save();c.globalAlpha=p.life/.085;c.strokeStyle=p.hit?'#fff7c4':'#cbe5d2';c.lineWidth=1.5;c.beginPath();c.moveTo(w*.52,h*.84);c.lineTo(p.x,p.y);c.stroke();c.restore();}
   for(const p of this.labels){c.save();c.globalAlpha=Math.min(1,p.life*3);c.fillStyle=p.color;c.shadowColor='#07110d';c.shadowBlur=7;c.font='bold 11px Arial';c.textAlign='center';c.fillText(p.text,p.x,p.y);c.restore();}
  }
  const vignette=c.createRadialGradient(w*.5,h*.48,h*.2,w*.5,h*.48,Math.max(w,h)*.75);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#020c0ac9');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  this.cockpit(aim,time,!menu);
  if(!menu){
   const fade=game.phase==='clear'?clamp((game.phaseTime-2.7)/.8,0,1):game.phase==='intro'?clamp(1-game.phaseTime/.6,0,1):0;
   if(fade){c.fillStyle=`rgba(3,12,10,${fade})`;c.fillRect(0,0,w,h);}
   if(game.focusTime>0){c.strokeStyle='#bcecdba0';c.lineWidth=5;c.strokeRect(3,3,w-6,h-6);}
   if(this.flash>0){c.fillStyle=`rgba(215,65,32,${this.flash*.22})`;c.fillRect(0,0,w,h);}
   const x=aim.x*w,y=aim.y*h;c.save();c.strokeStyle=this.hitMark?'#ffe1a5':'#f4ecd2';c.shadowBlur=4;c.shadowColor='#000';c.lineWidth=1.5;
   for(let i=0;i<4;i++){const a=i*Math.PI/2;c.beginPath();c.moveTo(x+Math.cos(a)*8,y+Math.sin(a)*8);c.lineTo(x+Math.cos(a)*18,y+Math.sin(a)*18);c.stroke();}
   c.beginPath();c.arc(x,y,3,0,7);c.stroke();if(this.hitMark){c.beginPath();c.moveTo(x-7,y-7);c.lineTo(x+7,y+7);c.moveTo(x+7,y-7);c.lineTo(x-7,y+7);c.stroke();}c.restore();
  }
 }
}
