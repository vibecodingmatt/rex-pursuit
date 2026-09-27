// A small fixed pool on the lens. Simulation dt owns the drip/fade, so Pause
// freezes it and neither long sessions nor repeated blasts accumulate nodes.
export function createScreenBlood(camera,{reducedMotion=false}={}){
 const canvas=document.createElement('canvas');canvas.id='screen-blood';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
 const ctx=canvas.getContext('2d'),drops=Array.from({length:48},()=>({life:0})),local=camera.position.clone();let next=0,dirty=false,budget=1;
 const stats={splashes:0};
 function resize(){const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);dirty=true;}
 addEventListener('resize',resize);resize();
 function splash(point,{closeContact=false,amount=1}={}){
  camera.updateMatrixWorld();local.copy(point).applyMatrix4(camera.matrixWorldInverse);
  // A boarded attacker is at the player's vehicle even when the external
  // camera sits farther back. Other hits retain the camera-distance guard.
  const distance=point.distanceTo(camera.position);if((!closeContact&&distance>=9)||local.z>=0)return false;
  const strength=closeContact?.85:Math.max(0,1-distance/9),projected=point.clone().project(camera);
  // Centre remains mostly clear; little satellites make it read as liquid on
  // glass instead of a red damage vignette. Stronger blasts reach farther in.
  const count=Math.round((9+strength*20)*budget*amount);
  for(let i=0;i<count;i++){
   const b=drops[next++%drops.length],side=Math.random()<.5?-1:1;
   Object.assign(b,{life:3+Math.random()*1.7,max:4.7,x:Math.max(.02,Math.min(.98,.5+side*(.19+Math.random()*.3)+projected.x*.07)),y:Math.max(.02,Math.min(.93,Math.random()*.85-projected.y*.08)),r:(i%4===0?.019:.0035+Math.random()*.006)*(1+strength*.7)*(.6+amount*.4),stretch:1+Math.random()*.6,drip:0,phase:Math.random()*6.28});
  }
  stats.splashes++;dirty=true;return true;
 }
 function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);const w=canvas.width,h=canvas.height,unit=Math.min(w,h);
  for(const b of drops){if(b.life<=0)continue;const x=b.x*w,y=b.y*h,r=b.r*unit,fade=Math.min(1,b.life/1.3),gradient=ctx.createRadialGradient(x-r*.2,y-r*.25,0,x,y,r*1.5);
   gradient.addColorStop(0,`rgba(96,4,12,${.84*fade})`);gradient.addColorStop(.6,`rgba(67,2,8,${.78*fade})`);gradient.addColorStop(1,`rgba(112,9,17,${.24*fade})`);ctx.fillStyle=gradient;
   ctx.beginPath();for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,edge=1+.14*Math.sin(a*5+b.phase)+.09*Math.sin(a*9-b.phase),px=x+Math.cos(a)*r*edge,py=y+Math.sin(a)*r*b.stretch*edge+(Math.sin(a)>0?b.drip*unit*Math.sin(a)**4:0);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();
   if(r>6){ctx.fillStyle=`rgba(232,119,102,${.14*fade})`;ctx.beginPath();ctx.ellipse(x-r*.3,y-r*.4,r*.15,r*.07,-.4,0,6.28);ctx.fill();}
  }
 }
 return {canvas,drops,stats,splash,setQuality(t){budget=t.gore??t.particles;},update(dt){let active=false;for(const b of drops)if(b.life>0){active=true;if(dt>0){b.life=Math.max(0,b.life-dt);if(!reducedMotion){b.y+=dt*.006;b.drip+=dt*.004;}dirty=true;}}if(dirty){draw();dirty=false;}canvas.hidden=!active;},reset(){drops.forEach(b=>b.life=0);next=0;stats.splashes=0;ctx.clearRect(0,0,canvas.width,canvas.height);canvas.hidden=true;dirty=false;}};
}
