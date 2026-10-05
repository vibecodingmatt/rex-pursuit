// Records Raptor Ravine preview frames with a virtual clock (see README.md). node scripts/previews/record-ravine.cjs <out-dir> <width> <height> [plan-json]
const {chromium}=require('playwright-core'),fs=require('fs'),path=require('path');
const [out,W,H]=[process.argv[2],+process.argv[3],+process.argv[4]],plan=JSON.parse(process.argv[5]||require('fs').readFileSync(require('path').join(__dirname,'ravine-plan.json'),'utf8'));
fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
 const p=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.addInitScript({path:path.join(__dirname,'vclock.js')});await p.addInitScript(()=>localStorage.setItem('rex-pursuit-quality','ultra'));
 await p.goto(`${process.env.TEST_URL||'http://127.0.0.1:5188/'}ravine.html?menu=1`);
 await p.waitForFunction(()=>window.ravine?.ready,null,{timeout:180000});
 await p.addStyleTag({content:'body>*:not(#scene){visibility:hidden!important}'});
 await p.waitForTimeout(1000);await p.evaluate(()=>__vclock.start());
 let n=0;const shot=async()=>{await p.screenshot({path:`${out}/${String(n++).padStart(4,'0')}.jpg`,type:'jpeg',quality:92});};
 const tick=()=>p.evaluate(()=>{const r=window.ravine;if(r.mode==='playing'){const round=r.round;round.jeep=Math.max(round.jeep,60);
   const cam=r.camera.position,live=r.pack.pool.filter(a=>a.root.visible&&!['dead','withdrawn','retreat'].includes(a.data.phase)).sort((a,b)=>(b.data.phase==='leap')-(a.data.phase==='leap')||a.body.distanceTo(cam)-b.body.distanceTo(cam));
   const t=live[0];window.__aim??=t?t.head.clone():null;if(t&&window.__aim){window.__aim.lerp(t.head,.2);r.aimAt(window.__aim);if(window.__aim.distanceTo(t.head)<.6)r.shoot();}
   if(round.arcade.turboReady&&round.activateTurbo)round.activateTurbo();}
  __vclock.tick(1000/30);});
 for(const seg of plan){
  if(seg.kind==='play'&&await p.evaluate(()=>ravine.mode)!=='playing')await p.evaluate(()=>ravine.start({automatic:true}));
  if(seg.until)while(await p.evaluate(()=>ravine.round.time)<seg.until)await tick();
  for(let i=0;i<(seg.warm||0)*30;i++)await tick();
  for(let i=0;i<seg.frames;i++){await tick();await shot();}
  console.log('segment',seg.kind,seg.until||'',n,await p.evaluate(()=>JSON.stringify(ravine.snapshot())));
 }
 console.log('errors',errors.slice(0,5));await b.close();})();
