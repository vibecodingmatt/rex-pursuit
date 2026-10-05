// Lost Circuit's river brachiosaur keeps a steady stride whatever the display rate. The arcade steps its rules at a fixed
// 1/60 s, syncs the scene once per step while the gun fires and again to render, so at 120-144 Hz most renders follow no
// step at all. A pace measured per sync read 0 on those and snapped her legs straight every other frame (2026-10-05).
const {chromium}=require('playwright-core'),assert=require('node:assert/strict');
const base=process.env.TEST_URL||'http://127.0.0.1:5188/';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[];
 try{const p=await b.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>errors.push(e.message));
  await p.goto(new URL('arcade.html?test=1&quality=low',base).href);await p.waitForFunction(()=>window.lostCircuit?.ready,null,{timeout:180000});
  await p.evaluate(()=>{document.getElementById('start').click();lostCircuit.freeze(true);});
  const out=await p.evaluate(()=>{const L=lostCircuit,c=L.renderer.actors.crossing,res={};
   // Frames as main.js runs them: fixed steps (a sync per step while firing), then one render.
   const frame=(steps,firing)=>{for(let i=0;i<steps;i++){const g=L.getGame();g.update(1/60);if(firing)L.renderer.sync(g,{x:.5,y:.5});}L.render();return c.walking;};
   for(const [name,pattern,firing] of [['60 Hz',[1],false],['120 Hz',[1,0],false],['144 Hz',[1,0,0,1,0],false],['60 Hz firing',[1],true],['120 Hz firing',[1,0],true]]){
    L.seek('river',4);for(let i=0;i<400;i++)frame(1,false);
    const w=[];for(let i=0;i<60;i++)w.push(frame(pattern[i%pattern.length],firing));
    res[name]={min:Math.min(...w),max:Math.max(...w),jump:Math.max(...w.slice(1).map((x,i)=>Math.abs(x-w[i])))};
   }return res;});
  for(const [name,r]of Object.entries(out)){assert.ok(r.min>.9,`${name}: she walks (stride ${r.min.toFixed(2)})`);assert.ok(r.jump<.05,`${name}: no stride jumps between frames (${r.jump.toFixed(2)})`);}
  assert.deepEqual(errors,[]);console.log('Arcade brachiosaur passed: a steady stride at 60/120/144 Hz pacing, firing or not.',JSON.stringify(out));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1);});
