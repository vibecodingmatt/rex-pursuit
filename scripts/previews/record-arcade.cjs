// Records Lost Circuit preview frames with a virtual clock (see README.md). node scripts/previews/record-arcade.cjs <out-dir> <width> <height> [plan-json]
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path');
const [out,W,H]=[process.argv[2],+process.argv[3],+process.argv[4]],plan=JSON.parse(process.argv[5]||require('fs').readFileSync(require('path').join(__dirname,'arcade-plan.json'),'utf8'));
fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.addInitScript({path:path.join(__dirname,'vclock.js')});
 await p.goto(`${process.env.TEST_URL||'http://127.0.0.1:5188/'}arcade.html?test=1&quality=${process.env.Q||'ultra'}`);
 await p.waitForFunction(()=>window.lostCircuit?.ready,null,{timeout:180000});
 await p.evaluate(()=>window.lostCircuit.bossesReady());
 await p.addStyleTag({content:'#menu,#hud,.topbar,#announcement,#radio,.grain,#attract,#medal{display:none!important}.screen-shade{opacity:0!important}'});
 await p.waitForTimeout(1500);await p.evaluate(()=>__vclock.start());
 let n=0;const shot=async()=>{await p.screenshot({path:`${out}/${String(n++).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});};
 for(const seg of plan){
  if(seg.kind==='title'){for(let i=0;i<seg.warm*30;i++)await p.evaluate(()=>__vclock.tick(1000/30));for(let i=0;i<seg.frames;i++){await p.evaluate(()=>__vclock.tick(1000/30));await shot();}}
  else{
   await p.evaluate(({route})=>{if(lostCircuit.mode!=='playing')document.getElementById('start').click();},seg);
   await p.evaluate(({id,at})=>{lostCircuit.seek(id,at);},seg);
   if(seg.fire!==false)await p.keyboard.down('Space');
   const frame=async()=>p.evaluate(()=>{const g=lostCircuit.getGame();g.hp=Math.max(g.hp,70);
    const t=g.entities.find(e=>!e.dead&&e.age>.2&&lostCircuit.project(e)?.visible!==false);
    const a=window.__aim??={x:.55,y:.5};if(t){const q=lostCircuit.project(t);a.x+=(q.hx-a.x)*.22;a.y+=(q.hy-a.y)*.22;}else{a.x+=(.55-a.x)*.05;a.y+=(.48-a.y)*.05;}
    lostCircuit.setAim(a.x,a.y);if(g.focus>=100)g.activateFocus();__vclock.tick(1000/30);});
   for(let i=0;i<seg.warm*30;i++)await frame();
   for(let i=0;i<seg.frames*(seg.every||1);i++){await frame();if(i%(seg.every||1)===0)await shot();}
   if(seg.fire!==false)await p.keyboard.up('Space');
  }
  console.log('segment',seg.kind,seg.id||'',n);
 }
 console.log('errors',errors.slice(0,5));await b.close();})();
