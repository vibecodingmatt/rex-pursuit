const {chromium}=require('playwright-core'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const output='art/review/lost-circuit';fs.mkdirSync(output,{recursive:true});
(async()=>{
 let server;const built=process.env.CIRCUIT_DIST==='1';let base=process.env.TEST_URL||'http://127.0.0.1:5188/';
 if(built){const root=path.resolve('dist');server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;if(!pathname.startsWith('/rex-pursuit/'))throw Error('base');const file=path.resolve(root,pathname.slice(13)||'index.html');if(!file.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.wav':'audio/wav','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(5193,'127.0.0.1',r));base='http://127.0.0.1:5193/rex-pursuit/';}
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const errors=[];
 const report=[];
 try{
  for(const [name,width,height,touch] of [['desktop',1440,900,false],['phone',390,844,true],['compact',320,568,true],['landscape',844,390,true]]){
   const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch});const page=await context.newPage();
   page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));page.on('console',m=>{if(m.type()==='error')errors.push(`${name}: ${m.text()}`);});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
   await page.goto(new URL('arcade.html?test=1',base).href);await page.waitForFunction(()=>lostCircuit.ready);await page.screenshot({path:`${output}/${built?'dist-':''}${name}-menu.png`});
   await page.locator('#start').click();await page.waitForFunction(()=>lostCircuit.mode==='playing');await page.evaluate(()=>lostCircuit.freeze(true));
   await page.evaluate(()=>lostCircuit.step(7));const target=await page.evaluate(()=>{const e=lostCircuit.getGame().entities.find(e=>!e.dead&&e.age>.2);return{...lostCircuit.project(e),id:e.id};});
   if(touch){await page.touchscreen.tap(target.hx*width,Math.min(height-1,target.hy*height+42));await page.evaluate(()=>lostCircuit.freeze(false));const client=await context.newCDPSession(page);await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.hx*width,y:target.hy*height+42}]});
    // The finger follows the animal (it keeps moving while the ride runs), so a hit does not depend on frame timing.
    for(let i=0;i<8;i++){const t=await page.evaluate(id=>{const e=lostCircuit.getGame().entities.find(x=>x.id===id&&!x.dead);return e?lostCircuit.project(e):null;},target.id);if(!t)break;await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:Math.min(width-1,t.hx*width),y:Math.min(height-1,t.hy*height+42)}]});await page.waitForTimeout(50);}await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await page.mouse.move(target.hx*width,target.hy*height);await page.mouse.down();await page.evaluate(()=>lostCircuit.freeze(false));await page.waitForTimeout(400);await page.mouse.up();}
   assert((await page.evaluate(()=>lostCircuit.snapshot().hits))>0,`${name}: actual pointer input hits`);
   await page.locator('#pause').click();const time=await page.evaluate(()=>lostCircuit.snapshot().time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>lostCircuit.snapshot().time),time);assert.equal(await page.evaluate(()=>lostCircuit.audioState),'suspended');await page.locator('#resume').click();
   await page.evaluate(()=>{lostCircuit.freeze(true);lostCircuit.getGame().focus=100;});await page.locator('#focus').click();assert.equal(await page.evaluate(()=>lostCircuit.getGame().focusTime),5);
   for(const [id,at,steps]of [['gates',10,3],['river',10,4],['fault',19,1],['hybrid',30,3],['lagoon',28,3],['manor',30,3],['visitor',30,3]]){
    await page.evaluate(({id,at,steps})=>{lostCircuit.seek(id,at);lostCircuit.getGame().hp=100;lostCircuit.step(steps);lostCircuit.render();},{id,at,steps});
    if(name==='desktop'||name==='phone')await page.screenshot({path:`${output}/${built?'dist-':''}${name}-${id}.png`});
    const clipped=await page.evaluate(()=>{const e=lostCircuit.getGame().entities.find(e=>e.boss&&!e.dead);if(!e)return false;const p=lostCircuit.project(e);return p.hx<0||p.hx>1||p.hy<.15||p.hy>.88;});assert(!clipped,`${name} ${id} weak point visible`);
   }
   await page.evaluate(()=>{lostCircuit.getGame().invulnerable=0;lostCircuit.getGame().damage(1000);lostCircuit.step(.02);});assert.equal(await page.evaluate(()=>lostCircuit.mode),'continue');await page.locator('#continue').click();assert.equal(await page.evaluate(()=>lostCircuit.snapshot().continues),1);
   await page.locator('#pause').click();await page.locator('#to-menu').click();await page.locator('[data-route=classic]').click();await page.locator('#start').click();await page.evaluate(()=>{lostCircuit.freeze(true);lostCircuit.step(650,true);});assert.equal(await page.evaluate(()=>lostCircuit.mode),'result');assert.equal(await page.evaluate(()=>lostCircuit.snapshot().status),'won');
   await page.screenshot({path:`${output}/${built?'dist-':''}${name}-results.png`});report.push({name,...await page.evaluate(()=>lostCircuit.snapshot()),entities:undefined});await context.close();
  }
  const context=await browser.newContext({viewport:{width:1280,height:800}});await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL('arcade.html?test=1',base).href);await page.waitForFunction(()=>lostCircuit.ready);await page.locator('#start').click();await page.evaluate(()=>{lostCircuit.freeze(true);lostCircuit.step(800,true);});assert.equal(await page.evaluate(()=>lostCircuit.snapshot().status),'won','Extended route and denied storage complete');await context.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(`${output}/${built?'dist-':''}report.json`,JSON.stringify(report,null,2));console.log('Lost Circuit browser flow passed: input, pause/audio, Overdrive, all stages, continues, full classic and extended wins, four viewports, denied storage, clean console/assets.');
 }finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
