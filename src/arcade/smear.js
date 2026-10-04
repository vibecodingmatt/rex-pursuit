// Dilophosaur spit on the windshield: a glossy glob where it struck, a spray of satellites,
// and strings that run down the glass. The glass under the goo is blurred (a backdrop
// filter masked by the same shapes), so the smear really costs the player their view.
// Like screen-blood.js, simulation dt drives the fade, so Pause freezes it.
export function createSpitSmear({reducedMotion=false}={}){
 const canvas=document.createElement('canvas');canvas.id='spit-smear';canvas.setAttribute('aria-hidden','true');
 // Hidden until a glob lands: shown, the veil's backdrop blur covers everything beneath it (the menu too).
 const veil=document.createElement('div');veil.id='spit-veil';veil.setAttribute('aria-hidden','true');veil.hidden=true;canvas.hidden=true;document.body.append(veil,canvas);
 // The mask is redrawn small and only when a glob lands; the veil's opacity does the fade.
 const mask=document.createElement('canvas');mask.width=192;mask.height=108;
 const ctx=canvas.getContext('2d'),mctx=mask.getContext('2d'),globs=[],stats={splats:0};let dirty=false,budget=1;
 function resize(){const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);dirty=true;}
 addEventListener('resize',resize);resize();
 const outline=(c,g,w,h,grow=1)=>{const unit=Math.min(w,h),x=g.x*w,y=g.y*h,r=g.r*unit*grow;c.beginPath();
  for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,edge=1+.16*Math.sin(a*3+g.phase)+.08*Math.sin(a*5-g.phase*1.7)+.035*Math.sin(a*8+g.phase*.6),below=Math.sin(a)>0?g.run*unit*Math.sin(a)**6:0,px=x+Math.cos(a)*r*edge*g.wide,py=y+Math.sin(a)*r*edge+below;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();};
 function paintMask(){mctx.clearRect(0,0,mask.width,mask.height);mctx.fillStyle='#fff';mctx.filter='blur(3px)';for(const g of globs)if(g.life>0&&g.r>.012){outline(mctx,g,mask.width,mask.height,1.25);mctx.fill();}mctx.filter='none';
  const url=`url(${mask.toDataURL()})`;veil.style.maskImage=url;veil.style.webkitMaskImage=url;}
 /** Spit reaching the glass at normalized screen point (x,y), 0..1 from the top left. */
 function splat(x=.5,y=.4){
  for(let i=globs.length-1;i>=0;i--)if(globs[i].life<=0)globs.splice(i,1);
  const cx=Math.max(.2,Math.min(.8,x)),cy=Math.max(.18,Math.min(.62,y)),n=Math.round(6+16*budget);
  // One big glob, a few heavy lobes beside it, then fine spray thrown outward.
  globs.push({x:cx,y:cy,r:.15,wide:1.3,life:5.2,max:5.2,run:0,speed:.012,phase:Math.random()*6.28});
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,lobe=i<4,d=lobe?.1+Math.random()*.07:.18+Math.random()*.3,r=lobe?.045+Math.random()*.03:.005+Math.random()*.013;
   globs.push({x:cx+Math.cos(a)*d*.9,y:cy+Math.sin(a)*d*.7,r,wide:.8+Math.random()*.6,life:3.4+Math.random()*1.6,max:5,run:0,speed:lobe?.008+Math.random()*.008:Math.random()*.004,phase:Math.random()*6.28});}
  while(globs.length>64)globs.shift();
  stats.splats++;veil.style.opacity='1';paintMask();dirty=true;
 }
 function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);const w=canvas.width,h=canvas.height,unit=Math.min(w,h);
  for(const g of globs){if(g.life<=0)continue;const fade=Math.min(1,g.life/1.6),x=g.x*w,y=g.y*h,r=g.r*unit;
   // Thick mucus: dark olive at the rim, a paler yellow body, a bright wet highlight.
   const body=ctx.createRadialGradient(x-r*.25,y-r*.3,r*.1,x,y,r*1.3);
   body.addColorStop(0,`rgba(226,240,150,${.3*fade})`);body.addColorStop(.6,`rgba(160,192,60,${.42*fade})`);body.addColorStop(.92,`rgba(96,124,26,${.62*fade})`);body.addColorStop(1,`rgba(60,80,12,${.75*fade})`);
   ctx.fillStyle=body;outline(ctx,g,w,h);ctx.fill();
   if(r>5){ctx.strokeStyle=`rgba(40,58,8,${.45*fade})`;ctx.lineWidth=Math.max(1,r*.06);ctx.stroke();
    ctx.fillStyle=`rgba(250,255,220,${.55*fade})`;ctx.beginPath();ctx.ellipse(x-r*.35*g.wide,y-r*.42,r*.22,r*.08,-.5,0,6.28);ctx.fill();
    ctx.fillStyle=`rgba(250,255,220,${.3*fade})`;ctx.beginPath();ctx.ellipse(x+r*.3,y+r*.25,r*.07,r*.04,-.5,0,6.28);ctx.fill();}
  }
 }
 return {canvas,veil,globs,stats,splat,setQuality(t){budget=t.particles??1;},
  update(dt){let active=false,top=0;for(const g of globs)if(g.life>0){active=true;if(dt>0){g.life=Math.max(0,g.life-dt);if(!reducedMotion)g.run+=dt*g.speed*(1+g.run*30);dirty=true;}top=Math.max(top,g.life/g.max);}
   if(dirty){draw();dirty=false;}canvas.hidden=!active;veil.hidden=!active;if(active)veil.style.opacity=String(Math.min(1,top*1.6));},
  reset(){globs.length=0;stats.splats=0;ctx.clearRect(0,0,canvas.width,canvas.height);canvas.hidden=true;veil.hidden=true;dirty=false;}};
}
